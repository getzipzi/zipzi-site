"""CI transport only. Authentication is supplied separately after explicit approval."""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from protocol import COMMIT, Rejected, digest, encode_request, read_directory

COMMAND = '/usr/local/libexec/zipzi-site-deploy/ssh_gate.py receive'


def trusted_run(env):
    if (env.get('GITHUB_REPOSITORY') != 'getzipzi/zipzi-site' or env.get('GITHUB_REF') != 'refs/heads/main'
            or env.get('GITHUB_EVENT_NAME') != 'push' or not COMMIT.fullmatch(env.get('GITHUB_SHA', ''))):
        raise Rejected('only-trusted-main-push-may-deploy')


def ssh_arguments(host, user, key, hosts):
    if host != 'clwai.cn' or not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', user):
        raise Rejected('invalid-deployment-target')
    return ['ssh', '-F', '/dev/null', '-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
            '-o', 'IdentityAgent=none', '-o', 'PasswordAuthentication=no', '-o', 'KbdInteractiveAuthentication=no',
            '-o', 'StrictHostKeyChecking=yes', '-o', f'UserKnownHostsFile={hosts}',
            '-o', 'GlobalKnownHostsFile=/dev/null', '-o', 'ClearAllForwardings=yes',
            '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2',
            '-i', str(key), f'{user}@{host}', COMMAND]


def validate_hosts(contents):
    lines = [line.split() for line in contents.splitlines() if line.strip() and not line.startswith('#')]
    if not lines or any(len(line) != 3 or line[0] != 'clwai.cn'
                        or line[1] not in ('ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-rsa')
                        or not re.fullmatch(r'[A-Za-z0-9+/=]+', line[2]) for line in lines):
        raise Rejected('explicit-pinned-clwai-host-key-required')


def exchange(args, request):
    try:
        result = subprocess.run(args, input=request, capture_output=True, timeout=360, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Rejected('ssh-result-uncertain') from error
    try:
        receipt = json.loads(result.stdout)
    except (ValueError, UnicodeError) as error:
        raise Rejected('ssh-result-uncertain') from error
    if result.returncode or not isinstance(receipt, dict) or receipt.get('status') not in ('deployed', 'verified'):
        raise Rejected('server-did-not-confirm-deployment')
    return receipt


def main():
    trusted_run(os.environ)
    if len(sys.argv) != 2:
        raise Rejected('usage-client-artifact-directory')
    commit = os.environ['GITHUB_SHA']
    blob, _ = read_directory(Path(sys.argv[1]), commit)
    # Same-run artifacts only; a stale run must not roll production back to an old main.
    result = subprocess.run(['gh', 'api', 'repos/getzipzi/zipzi-site/git/ref/heads/main', '--jq', '.object.sha'],
                            capture_output=True, text=True, check=True)
    if result.stdout.strip() != commit:
        raise Rejected('main-advanced-no-deployment-attempted')
    key = os.environ.pop('ZIPZI_DEPLOY_SSH_KEY', '')
    known = os.environ.pop('ZIPZI_DEPLOY_KNOWN_HOSTS', '')
    if not key.strip():
        raise Rejected('deployment-credential-not-configured')
    validate_hosts(known)
    host, user = os.environ.get('ZIPZI_DEPLOY_HOST', ''), os.environ.get('ZIPZI_DEPLOY_USER', '')
    with tempfile.TemporaryDirectory(prefix='zipzi-deploy-', dir=os.environ.get('RUNNER_TEMP')) as temp:
        root = Path(temp)
        os.chmod(root, 0o700)
        private, pins = root / 'identity', root / 'known_hosts'
        for file, value in ((private, key), (pins, known)):
            fd = os.open(file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, 'w') as handle:
                handle.write(value.rstrip() + '\n')
        del key, known
        args = ssh_arguments(host, user, private, pins)
        request = encode_request({'protocol': 1, 'action': 'deploy', 'commit': commit,
                                  'archive_sha256': digest(blob), 'bytes': len(blob)}, blob)
        try:
            receipt = exchange(args, request)
        except Rejected:
            # Check an uncertain outcome once; never repeat a mutation blindly.
            receipt = exchange(args, encode_request({'protocol': 1, 'action': 'status'}))
        if receipt.get('commit') != commit or not re.fullmatch(r'[a-f0-9]{32}', str(receipt.get('transaction', ''))):
            raise Rejected('deployment-receipt-mismatch')
    # Only a server-verified, matching revision earns this success message.
    print(json.dumps({'status': 'deployed_and_verified', 'commit': commit, 'transaction': receipt['transaction']}))
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as handle:
            handle.write(f'Production deployment verified: `{commit}`. Rollback transaction: `{receipt["transaction"]}`.\n')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        reason = str(error) if isinstance(error, Rejected) else type(error).__name__
        print(json.dumps({'status': 'not_confirmed_deployed', 'reason': reason}), file=sys.stderr)
        sys.exit(1)
