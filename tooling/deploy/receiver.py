"""Root-owned fixed-purpose installer. No Nginx/service/credential changes."""
from __future__ import annotations

import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import stat
import sys
import tempfile
import urllib.request
import urllib.error
import uuid

# Production invocation uses python -I. Only this root-owned directory is imported.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from protocol import Rejected, allowed, immutable, digest, json_load, read_archive, read_request, SHA

POLICY_PATH = Path('/etc/zipzi-site-deploy/policy.json')


def regular(path: Path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode):
        raise Rejected('non-regular-file')
    return info


def secure(path: Path, uid: int, private=False):
    for part in [path, *path.parents]:
        info = part.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid not in {0, uid} or info.st_mode & 0o022:
            raise Rejected('unsafe-owner-permissions-or-link')
    if private and path.stat().st_mode & 0o077:
        raise Rejected('non-private-operator-directory')


def atomic(path: Path, data: bytes, mode=0o600):
    if path.is_symlink():
        raise Rejected('write-through-link')
    fd, temporary = tempfile.mkstemp(prefix='.zipzi-write-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            os.fchmod(handle.fileno(), mode)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def save(path, value):
    atomic(path, json.dumps(value, sort_keys=True).encode() + b'\n')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Health:
    """Strict TLS; fixed public hosts; no proxy, auth, secret or redirect bypass."""
    def __init__(self, api_hash):
        self.api_hash = api_hash
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def get(self, host, route):
        if host not in ('clwai.cn', 'www.clwai.cn') or not route.startswith('/'):
            raise Rejected('unapproved-health-destination')
        try:
            response = self.opener.open('https://' + host + route, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        except (OSError, urllib.error.URLError) as error:
            raise Rejected('https-health-connection-failed') from error
        with response:
            body = response.read(4 * 1024 * 1024 + 1)
            if len(body) > 4 * 1024 * 1024:
                raise Rejected('health-response-too-large')
            return response.status, response.headers, digest(body)

    def protected(self):
        for host in ('clwai.cn', 'www.clwai.cn'):
            for route in ('/jobs', '/api/admin/jobs'):
                status, headers, _ = self.get(host, route)
                if status != 401 or headers.get('WWW-Authenticate') != 'Basic realm="FA Stock Research Admin"':
                    raise Rejected('protected-route-auth-changed')
            status, headers, sha = self.get(host, '/api/health')
            if status != 200 or 'application/json' not in headers.get('Content-Type', '') or sha != self.api_hash:
                raise Rejected('api-health-changed')
            if self.get(host, '/__zipzi_internal_jobs')[0] != 404:
                raise Rejected('legacy-entry-is-not-private')
        if self.get('clwai.cn', '/__zipzi_ci_missing_probe')[0] != 404:
            raise Rejected('public-404-routing-not-ready')
        status, headers, _ = self.get('www.clwai.cn', '/')
        if status != 301 or headers.get('Location') != 'https://clwai.cn/':
            raise Rejected('canonical-routing-not-ready')

    def check(self, hashes):
        self.protected()
        for path, expected in hashes.items():
            route = '/' if path == 'index.html' else '/' + path
            expected_status = 200
            if path == '404.html':
                route, expected_status = '/__zipzi_ci_missing_probe', 404
            status, headers, sha = self.get('clwai.cn', route)
            if status != expected_status or sha != expected:
                raise Rejected('public-file-health-mismatch')
            mime = {'index.html': 'text/html', '404.html': 'text/html',
                    'robots.txt': 'text/plain', 'sitemap.xml': 'application/xml',
                    'sitemap-index.xml': 'application/xml', 'sitemap-0.xml': 'application/xml'}
            if path in mime and mime[path] not in headers.get('Content-Type', ''):
                raise Rejected('public-file-content-type-mismatch')


class Installer:
    """Filesystem transaction engine; tests inject temporary roots and fake health."""
    def __init__(self, policy, health, owner=0, checkpoint=None):
        if policy.get('routing_approved') is not True:
            raise Rejected('routing-approval-required')
        self.root, self.state, self.backups = (Path(policy[k]) for k in ('site_root', 'state_root', 'backup_root'))
        for p in (self.root, self.state, self.backups):
            if not p.is_absolute() or '..' in p.parts or not p.is_dir() or p.is_symlink():
                raise Rejected('invalid-operator-directory')
        for a, b in ((self.state, self.root), (self.backups, self.root), (self.state, self.backups), (self.backups, self.state)):
            if a == b or b in a.parents or a in b.parents:
                raise Rejected('operator-data-overlaps-public-or-private-root')
        self.policy, self.health, self.owner = policy, health, owner
        self.checkpoint = checkpoint or (lambda stage: None)
        self.active_path, self.journal = self.state / 'active.json', self.state / 'pending.json'

    def guard(self):
        # Production roots and policy are root-owned. Never allow a writable upload
        # directory or symlink to become an installation/configuration target.
        secure(self.root, self.owner)
        secure(self.state, self.owner, private=True)
        secure(self.backups, self.owner, private=True)
        guards = self.policy.get('protected_files', [])
        if not {'nginx', 'legacy-jobs', 'legacy-asset'}.issubset({entry.get('role') for entry in guards}):
            raise Rejected('incomplete-routing-guards')
        for entry in guards:
            p = Path(entry['path'])
            if (not p.is_absolute() or not SHA.fullmatch(entry['sha256'])
                    or any(word in p.name.lower() for word in ('privkey', 'htpasswd'))
                    or p.suffix in ('.key', '.pem')):
                raise Rejected('invalid-protected-file')
            secure(p, self.owner)
            regular(p)
            if digest(p.read_bytes()) != entry['sha256']:
                raise Rejected('protected-routing-or-legacy-file-changed')
            if entry['role'] == 'legacy-jobs' and (p == self.root or self.root in p.parents):
                raise Rejected('legacy-entry-inside-public-root')
        for path, sha in self.policy.get('initial_files', {}).items():
            if not allowed(path) or not SHA.fullmatch(sha):
                raise Rejected('invalid-initial-managed-file')
        if 'index.html' not in self.policy.get('initial_files', {}):
            raise Rejected('initial-homepage-baseline-required')

    @contextlib.contextmanager
    def locked(self):
        self.guard()
        fd = os.open(self.state / 'deploy.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            if os.fstat(fd).st_uid != self.owner or os.fstat(fd).st_mode & 0o077:
                raise Rejected('unsafe-lock')
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise Rejected('deployment-already-running') from error
            yield
        finally:
            os.close(fd)

    def target(self, relative, create=False):
        if not allowed(relative):
            raise Rejected('target-outside-static-allowlist')
        target = self.root / relative
        parent = target.parent
        if not parent.exists() and create:
            parent.mkdir(mode=0o755)
            os.chmod(parent, 0o755)
        if parent.exists():
            secure(parent, self.owner)
        if target.exists() or target.is_symlink():
            secure(target, self.owner)
            regular(target)
        return target

    def active(self):
        if not self.active_path.exists():
            return None
        secure(self.active_path, self.owner)
        return json_load(self.active_path.read_bytes())

    def assert_hashes(self, hashes):
        for name, sha in hashes.items():
            p = self.target(name)
            if not p.is_file() or digest(p.read_bytes()) != sha:
                raise Rejected('managed-file-drift')

    def record(self, pending):
        identity = pending.get('transaction', '')
        if not isinstance(identity, str) or len(identity) != 32 or any(c not in '0123456789abcdef' for c in identity):
            raise Rejected('invalid-transaction-identity')
        directory = self.backups / identity
        secure(directory, self.owner, private=True)
        record_path = directory / 'record.json'
        secure(record_path, self.owner)
        regular(record_path)
        raw = record_path.read_bytes()
        if digest(raw) != pending['record_sha256']:
            raise Rejected('rollback-record-checksum-mismatch')
        return directory, json_load(raw)

    def restore(self, pending):
        directory, record = self.record(pending)
        # Validate every backup and current target before any restore write.
        old_bytes = {}
        for name, prior in record['before'].items():
            if not allowed(name):
                raise Rejected('unsafe-backup-path')
            if prior is not None:
                p = directory / 'before' / name
                secure(p, self.owner)
                regular(p)
                data = p.read_bytes()
                if digest(data) != prior['sha256']:
                    raise Rejected('rollback-backup-checksum-mismatch')
                old_bytes[name] = data
            target = self.target(name)
            if target.exists():
                acceptable = {record['after'][name]}
                if prior is not None:
                    acceptable.add(prior['sha256'])
                if digest(target.read_bytes()) not in acceptable:
                    raise Rejected('refuse-rollback-over-concurrent-edit')
        for name in sorted(record['before'], key=lambda p: (p == 'index.html', p)):
            target = self.target(name, create=True)
            if name in old_bytes:
                atomic(target, old_bytes[name], record['before'][name]['mode'])
            elif not immutable(name) and target.exists():
                target.unlink()
            # New hashed assets are retained for browsers caching the newer HTML.
        previous = record['previous']
        if previous is None:
            if self.active_path.exists():
                self.active_path.unlink()
        else:
            save(self.active_path, previous)
        self.guard()
        self.health.check(record['prior_hashes'])
        if self.journal.exists():
            self.journal.unlink()
        save(directory / 'rolled-back.json', {'status': 'rolled_back'})
        return {'status': 'rolled_back', 'transaction': pending['transaction'], 'commit': previous['commit'] if previous else None}

    def recover(self):
        if self.journal.exists():
            secure(self.journal, self.owner)
            self.restore(json_load(self.journal.read_bytes()))

    def deploy(self, commit, site):
        with self.locked():
            self.recover()
            previous = self.active()
            prior_hashes = previous['files'] if previous else self.policy['initial_files']
            self.assert_hashes(prior_hashes)
            self.health.check(prior_hashes)
            after = {name: digest(data) for name, data in site.items()}
            before = {}
            for name in site:
                target = self.target(name)
                if target.exists():
                    data = target.read_bytes()
                    if immutable(name) and digest(data) != after[name]:
                        raise Rejected('immutable-asset-collision')
                    if not immutable(name) and name not in prior_hashes:
                        raise Rejected('unmanaged-file-collision')
                    before[name] = {'sha256': digest(data), 'mode': stat.S_IMODE(target.stat().st_mode)}
                else:
                    before[name] = None
            identity = uuid.uuid4().hex
            directory = self.backups / identity
            directory.mkdir(mode=0o700)
            for name, prior in before.items():
                if prior is not None:
                    backup = directory / 'before' / name
                    backup.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
                    atomic(backup, self.target(name).read_bytes())
                    if digest(backup.read_bytes()) != prior['sha256']:
                        raise Rejected('backup-verification-failed')
            record = {'previous': previous, 'before': before, 'after': after, 'commit': commit, 'prior_hashes': prior_hashes}
            save(directory / 'record.json', record)
            pending = {'transaction': identity, 'record_sha256': digest((directory / 'record.json').read_bytes())}
            save(self.journal, pending)
            try:
                for name in sorted(site, key=lambda p: (p == 'index.html', p)):
                    target = self.target(name, create=True)
                    if not target.exists() or digest(target.read_bytes()) != after[name]:
                        atomic(target, site[name], 0o644)
                    self.checkpoint(name)
                self.guard()
                self.assert_hashes(after)
                self.health.check(after)
                active = {'commit': commit, 'transaction': identity, 'record_sha256': pending['record_sha256'], 'files': after}
                save(self.active_path, active)
                save(directory / 'committed.json', {'status': 'deployed', 'commit': commit})
                self.journal.unlink()
                return {'status': 'deployed', 'commit': commit, 'transaction': identity}
            except Exception:
                self.restore(pending)
                raise

    def rollback(self, transaction, expected_commit):
        with self.locked():
            if self.journal.exists():
                raise Rejected('pending-transaction-needs-recovery')
            active = self.active()
            if not active or active['commit'] != expected_commit or active['transaction'] != transaction:
                raise Rejected('rollback-does-not-match-current-release')
            self.assert_hashes(active['files'])
            return self.restore(active)

    def status(self):
        with self.locked():
            if self.journal.exists():
                return {'status': 'recovery_required'}
            active = self.active()
            if not active:
                return {'status': 'not_deployed'}
            self.assert_hashes(active['files'])
            self.health.check(active['files'])
            return {'status': 'verified', 'commit': active['commit'], 'transaction': active['transaction']}


def main():
    os.umask(0o077)
    if os.geteuid() != 0 or len(sys.argv) != 1:
        raise Rejected('root-fixed-entrypoint-required')
    secure(POLICY_PATH, 0)
    regular(POLICY_PATH)
    if POLICY_PATH.stat().st_mode & 0o077:
        raise Rejected('policy-must-be-private')
    policy = json_load(POLICY_PATH.read_bytes())
    if not SHA.fullmatch(policy.get('api_health_sha256', '')):
        raise Rejected('api-baseline-required')
    installer = Installer(policy, Health(policy['api_health_sha256']))
    # Receive the full bounded request before any transaction is opened.
    signal.alarm(120)
    request, blob = read_request(sys.stdin.buffer)
    signal.alarm(0)
    if request['action'] == 'deploy':
        site = read_archive(blob, request['commit'])
        receipt = installer.deploy(request['commit'], site)
    elif request['action'] == 'rollback':
        receipt = installer.rollback(request['transaction'], request['expected_commit'])
    else:
        receipt = installer.status()
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__':
    def interrupted(_signal, _frame):
        raise Rejected('deployment-interrupted')
    for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP, signal.SIGALRM):
        signal.signal(signum, interrupted)
    try:
        main()
    except Exception as error:
        # Never echo server configuration, archive contents or credentials.
        reason = str(error) if isinstance(error, Rejected) else type(error).__name__
        print(json.dumps({'status': 'failed', 'reason': reason}), flush=True)
        sys.exit(1)
