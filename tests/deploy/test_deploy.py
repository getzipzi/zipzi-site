"""Offline regression: no SSH, production paths, account changes or credentials."""
import copy
import fcntl
import io
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tooling/deploy'))
import protocol as p
import receiver as r
import client
import ssh_gate

COMMIT = 'a' * 40
NEXT = 'b' * 40


def site_fixture(label=b'new'):
    return {**{name: label + b':' + name.encode() for name in p.FIXED}, '_astro/Page.abc123.css': b'body{color:white}'}


def artifact_files(site=None, commit=COMMIT):
    site = site or site_fixture()
    entries = [{'path': n, 'bytes': len(d), 'sha256': p.digest(d)} for n, d in sorted(site.items())]
    files = {'site/' + n: d for n, d in site.items()}
    files.update({'source.json': json.dumps({'commit': commit, 'dirty': False}).encode(),
                  'manifest.json': json.dumps({'files': entries, 'totalBytes': sum(len(d) for d in site.values())}).encode(),
                  'SHA256SUMS': ''.join(f'{e["sha256"]}  site/{e["path"]}\n' for e in entries).encode(),
                  'DEPLOYMENT.txt': b'Static files only.'})
    return files


def tar_blob(files, extra=None):
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, data in files.items():
            entry = tarfile.TarInfo(name); entry.size = len(data)
            archive.addfile(entry, io.BytesIO(data))
        if extra:
            archive.addfile(extra)
    return out.getvalue()


class ProtocolTests(unittest.TestCase):
    def test_round_trip_and_wire_checksum(self):
        blob = tar_blob(artifact_files())
        request = {'protocol': 1, 'action': 'deploy', 'commit': COMMIT, 'bytes': len(blob), 'archive_sha256': p.digest(blob)}
        parsed, body = p.read_request(io.BytesIO(p.encode_request(request, blob)))
        self.assertEqual(parsed, request)
        self.assertEqual(p.read_archive(body, COMMIT), site_fixture())
        with self.assertRaises(p.Rejected): p.read_request(io.BytesIO(p.encode_request(request, blob[:-1] + b'x')))

    def test_rejects_traversal_backend_and_operational_files(self):
        for name in ['../index.html', '/etc/nginx/site.conf', 'jobs/index.html', 'api/health', 'assets/legacy.js',
                     '_astro/../assets/x.js', '.env', 'media/secret.key', '_astro/x.php', '_astro/a/b.js']:
            with self.subTest(name=name):
                self.assertFalse(p.allowed(name))
                files = artifact_files(); files['site/' + name] = b'bad'
                with self.assertRaises(p.Rejected): p.read_archive(tar_blob(files), COMMIT)

    def test_rejects_links_duplicates_and_extra_files(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE]:
            entry = tarfile.TarInfo('site/_astro/link.hash.js'); entry.type = kind; entry.linkname = '/etc/passwd'
            with self.assertRaises(p.Rejected): p.read_archive(tar_blob(artifact_files(), entry), COMMIT)
        entry = tarfile.TarInfo('site/index.html')
        with self.assertRaises(p.Rejected): p.read_archive(tar_blob(artifact_files(), entry), COMMIT)
        files = artifact_files(); files['deploy.sh'] = b'bad'
        with self.assertRaises(p.Rejected): p.read_archive(tar_blob(files), COMMIT)

    def test_rejects_dirty_wrong_revision_checksums_and_missing_files(self):
        variants = []
        for dirty in [True, 0, 'false']:
            files = artifact_files(); files['source.json'] = json.dumps({'commit': COMMIT, 'dirty': dirty}).encode(); variants.append(files)
        files = artifact_files(commit=NEXT); variants.append(files)
        files = artifact_files(); files['site/index.html'] = b'tampered'; variants.append(files)
        files = artifact_files(); del files['site/robots.txt']; variants.append(files)
        files = artifact_files(); files['SHA256SUMS'] += b'extra'; variants.append(files)
        for files in variants:
            with self.assertRaises(p.Rejected): p.read_archive(tar_blob(files), COMMIT)

    def test_rejects_oversized_headers_unknown_actions_and_duplicate_json(self):
        for raw in [b'x' * 4097, b'{"protocol":1,"action":"shell"}\n',
                    b'{"protocol":1,"action":"status","action":"deploy"}\n',
                    b'{"protocol":1,"action":"status"}\nextra']:
            with self.assertRaises(p.Rejected): p.read_request(io.BytesIO(raw))
        with self.assertRaises(p.Rejected): p.read_archive(b'x' * (p.MAX_ARCHIVE + 1), COMMIT)


class FakeHealth:
    def __init__(self, root): self.root, self.calls, self.fail_at = root, 0, None
    def check(self, hashes):
        self.calls += 1
        if self.calls == self.fail_at: raise p.Rejected('simulated-public-health-failure')
        for name, sha in hashes.items():
            if p.digest((self.root / name).read_bytes()) != sha: raise AssertionError('actual filesystem does not match health expectation')


class FilesystemTests(unittest.TestCase):
    def setUp(self):
        # CI repeats these tests as root in its disposable runner. Root-owned
        # fixtures exercise the real production ownership checks without sudo
        # on a developer machine or any connection to the production host.
        qa = Path('/root') if os.getuid() == 0 else ROOT / 'qa/deploy-tests'
        qa.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=qa)
        self.base = Path(self.temp.name)
        for name in ['public', 'state', 'backups', 'legacy']:
            (self.base / name).mkdir(mode=0o700)
        self.root = self.base / 'public'; self.root.chmod(0o755)
        (self.root / 'assets').mkdir(); (self.root / 'assets/legacy.js').write_bytes(b'protected app')
        (self.root / 'index.html').write_bytes(b'old homepage')
        (self.base / 'nginx.conf').write_bytes(b'reviewed routing')
        (self.base / 'legacy/jobs.html').write_bytes(b'original protected jobs entry')
        guards = [('nginx', self.base / 'nginx.conf'), ('legacy-jobs', self.base / 'legacy/jobs.html'), ('legacy-asset', self.root / 'assets/legacy.js')]
        self.policy = {'routing_approved': True, 'site_root': str(self.root), 'state_root': str(self.base / 'state'),
                       'backup_root': str(self.base / 'backups'), 'initial_files': {'index.html': p.digest(b'old homepage')},
                       'protected_files': [{'role': role, 'path': str(path), 'sha256': p.digest(path.read_bytes())} for role, path in guards]}
        self.health = FakeHealth(self.root)
        self.installer = r.Installer(self.policy, self.health, owner=os.getuid())

    def tearDown(self): self.temp.cleanup()

    def test_success_preserves_backend_and_restores_previous_version(self):
        receipt = self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual(receipt['status'], 'deployed')
        self.assertEqual(self.installer.status()['commit'], COMMIT)
        self.assertEqual((self.root / 'assets/legacy.js').read_bytes(), b'protected app')
        self.assertEqual((self.base / 'nginx.conf').read_bytes(), b'reviewed routing')
        self.assertEqual((self.base / 'legacy/jobs.html').read_bytes(), b'original protected jobs entry')
        rollback = self.installer.rollback(receipt['transaction'], COMMIT)
        self.assertEqual(rollback['status'], 'rolled_back')
        self.assertEqual((self.root / 'index.html').read_bytes(), b'old homepage')
        self.assertFalse((self.root / 'robots.txt').exists())
        self.assertTrue((self.root / '_astro/Page.abc123.css').exists(), 'Cached newer HTML retains its hashed asset')
        self.assertFalse(self.installer.active_path.exists())
        self.assertTrue((self.base / 'backups' / receipt['transaction'] / 'before/index.html').exists())

    def test_index_switches_last_and_failure_rolls_back(self):
        seen = []
        def fail_after_switch(name):
            seen.append(name)
            if name == 'index.html': raise RuntimeError('simulated post-switch fault')
        self.installer.checkpoint = fail_after_switch
        with self.assertRaises(RuntimeError): self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual(seen[-1], 'index.html')
        self.assertEqual((self.root / 'index.html').read_bytes(), b'old homepage')
        self.assertFalse(self.installer.journal.exists())

    def test_failed_health_rolls_back_without_claiming_success(self):
        self.health.fail_at = 2
        with self.assertRaises(p.Rejected): self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual((self.root / 'index.html').read_bytes(), b'old homepage')
        self.assertIsNone(self.installer.active())

    def test_unapproved_or_changed_routing_is_refused_before_public_write(self):
        disabled = dict(self.policy, routing_approved=False)
        with self.assertRaises(p.Rejected): r.Installer(disabled, self.health, owner=os.getuid())
        (self.base / 'nginx.conf').write_bytes(b'changed routing')
        with self.assertRaises(p.Rejected): self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual((self.root / 'index.html').read_bytes(), b'old homepage')
        self.assertEqual(list((self.base / 'backups').iterdir()), [])

    def test_incomplete_guard_set_and_public_backup_directory_are_rejected(self):
        bad = copy.deepcopy(self.policy); bad['protected_files'][1]['role'] = 'unrelated'
        with self.assertRaises(p.Rejected): r.Installer(bad, self.health, owner=os.getuid()).deploy(COMMIT, site_fixture())
        (self.root / 'backups').mkdir()
        with self.assertRaises(p.Rejected): r.Installer(dict(self.policy, backup_root=str(self.root / 'backups')), self.health)

    def test_symlink_and_existing_unmanaged_file_collisions_are_rejected(self):
        target = self.root / 'robots.txt'; target.symlink_to(self.base / 'nginx.conf')
        with self.assertRaises(p.Rejected): self.installer.deploy(COMMIT, site_fixture())
        target.unlink(); target.write_bytes(b'unrelated existing resource')
        with self.assertRaises(p.Rejected): self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual(target.read_bytes(), b'unrelated existing resource')

    def test_installer_itself_rejects_malicious_paths_and_symlink_parents(self):
        # Exercise the filesystem layer too, even if a future caller bypasses
        # transport validation. These same assertions run as root in CI.
        for name in ['../nginx.conf', '/etc/passwd', 'assets/legacy.js',
                     'jobs/index.html', 'api/health', '_astro/../nginx.conf']:
            with self.subTest(name=name):
                with self.assertRaises(p.Rejected):
                    self.installer.deploy(COMMIT, {**site_fixture(), name: b'bad'})
        (self.root / '_astro').symlink_to(self.base / 'legacy', target_is_directory=True)
        with self.assertRaises(p.Rejected):
            self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual((self.base / 'nginx.conf').read_bytes(), b'reviewed routing')
        self.assertEqual((self.base / 'legacy/jobs.html').read_bytes(), b'original protected jobs entry')
        self.assertEqual((self.root / 'index.html').read_bytes(), b'old homepage')

    def test_unsafe_permissions_and_nested_operator_roots_are_rejected(self):
        self.root.chmod(0o777)
        with self.assertRaises(p.Rejected):
            self.installer.deploy(COMMIT, site_fixture())
        self.root.chmod(0o755)
        with self.assertRaises(p.Rejected):
            r.Installer(dict(self.policy, state_root=str(self.base)), self.health)
        (self.base / 'state').chmod(0o755)
        with self.assertRaises(p.Rejected):
            self.installer.deploy(COMMIT, site_fixture())

    def test_atomic_asset_collision_and_manual_drift_are_rejected(self):
        self.installer.deploy(COMMIT, site_fixture())
        changed = site_fixture(); changed['_astro/Page.abc123.css'] = b'different bytes same filename'
        with self.assertRaises(p.Rejected): self.installer.deploy(NEXT, changed)
        (self.root / 'index.html').write_bytes(b'concurrent human edit')
        with self.assertRaises(p.Rejected): self.installer.deploy(NEXT, site_fixture())
        self.assertEqual((self.root / 'index.html').read_bytes(), b'concurrent human edit')

    def test_server_lock_prevents_overlapping_transactions(self):
        with self.installer.locked():
            with self.assertRaises(p.Rejected): self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual(list((self.base / 'backups').iterdir()), [])

    def test_wrong_rollback_revision_and_corrupt_backup_do_not_overwrite_site(self):
        receipt = self.installer.deploy(COMMIT, site_fixture())
        with self.assertRaises(p.Rejected): self.installer.rollback(receipt['transaction'], NEXT)
        (self.base / 'backups' / receipt['transaction'] / 'before/index.html').write_bytes(b'corrupt backup')
        with self.assertRaises(p.Rejected): self.installer.rollback(receipt['transaction'], COMMIT)
        self.assertEqual((self.root / 'index.html').read_bytes(), site_fixture()['index.html'])

    def test_interrupted_transaction_is_recoverable_without_repeating_publish(self):
        class PowerLoss(BaseException): pass
        def power_loss(name):
            if name == 'index.html': raise PowerLoss()
        self.installer.checkpoint = power_loss
        with self.assertRaises(PowerLoss): self.installer.deploy(COMMIT, site_fixture())
        self.assertEqual(self.installer.status(), {'status': 'recovery_required'})
        self.installer.checkpoint = lambda _: None
        with self.installer.locked(): self.installer.recover()
        self.assertEqual((self.root / 'index.html').read_bytes(), b'old homepage')
        self.assertFalse(self.installer.journal.exists())


class TransportTests(unittest.TestCase):
    def test_custom_404_requires_error_status_and_exact_generated_content(self):
        health = r.Health('a' * 64)
        with patch.object(health, 'protected'):
            health.get = lambda host, route: (404, {'Content-Type': 'text/html'}, 'b' * 64)
            health.check({'404.html': 'b' * 64})
            for status, sha in [(200, 'b' * 64), (404, 'c' * 64)]:
                health.get = lambda host, route: (status, {'Content-Type': 'text/html'}, sha)
                with self.assertRaises(p.Rejected):
                    health.check({'404.html': 'b' * 64})

    def test_only_trusted_main_push_is_accepted(self):
        env = {'GITHUB_REPOSITORY': 'getzipzi/zipzi-site', 'GITHUB_REF': 'refs/heads/main', 'GITHUB_EVENT_NAME': 'push', 'GITHUB_SHA': COMMIT}
        client.trusted_run(env)
        for key, value in [('GITHUB_EVENT_NAME', 'pull_request'), ('GITHUB_EVENT_NAME', 'release'),
                           ('GITHUB_REF', 'refs/pull/1/merge'), ('GITHUB_REPOSITORY', 'fork/zipzi-site')]:
            with self.assertRaises(p.Rejected): client.trusted_run(dict(env, **{key: value}))

    def test_ssh_is_pinned_noninteractive_and_has_no_shell_interpolation(self):
        args = client.ssh_arguments('clwai.cn', 'root', Path('/tmp/example-identity'), Path('/tmp/example-hosts'))
        for option in ['StrictHostKeyChecking=yes', 'BatchMode=yes', 'IdentitiesOnly=yes', 'IdentityAgent=none', 'ClearAllForwardings=yes']:
            self.assertIn(option, args)
        self.assertEqual(args[-1], client.COMMAND)
        with self.assertRaises(p.Rejected): client.ssh_arguments('bad.example', 'root', Path('k'), Path('h'))
        with self.assertRaises(p.Rejected): client.ssh_arguments('clwai.cn', 'root;id', Path('k'), Path('h'))
        client.validate_hosts('clwai.cn ssh-ed25519 AAAATESTPUBLICHOSTKEY=')
        for pin in ['', '* ssh-ed25519 AAAATEST=', '@cert-authority * ssh-ed25519 AAAATEST=', 'other.example ssh-ed25519 AAAATEST=']:
            with self.assertRaises(p.Rejected): client.validate_hosts(pin)

    def test_gate_allows_only_fixed_receiver_for_both_authentication_choices(self):
        root = ssh_gate.command(['receive'], None, 0)
        limited = ssh_gate.command(['receive'], ssh_gate.COMMAND, 1000)
        self.assertEqual(root, ['/usr/bin/python3', '-I', ssh_gate.RECEIVER])
        self.assertEqual(limited, ['/usr/bin/sudo', '-n', '--', *root])
        for args, original in [(['shell'], None), (['receive', '--config=/tmp/x'], None), (['receive'], 'bash')]:
            with self.assertRaises(ValueError): ssh_gate.command(args, original, 0)

    def test_auth_and_routing_regressions_fail_health(self):
        health = r.Health('a' * 64)
        def okay(host, route):
            if route in ('/jobs', '/api/admin/jobs'): return 401, {'WWW-Authenticate': 'Basic realm="FA Stock Research Admin"'}, ''
            if route == '/api/health': return 200, {'Content-Type': 'application/json'}, 'a' * 64
            if host == 'www.clwai.cn' and route == '/': return 301, {'Location': 'https://clwai.cn/'}, ''
            return 404, {}, ''
        health.get = okay
        health.protected()
        for path, reply in [('/jobs', (200, {}, '')), ('/__zipzi_internal_jobs', (200, {}, '')), ('/__zipzi_ci_missing_probe', (200, {}, ''))]:
            health.get = lambda host, route, path=path, reply=reply: reply if route == path else okay(host, route)
            with self.assertRaises(p.Rejected): health.protected()


if __name__ == '__main__': unittest.main()
