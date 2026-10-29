#!/usr/bin/python3 -I
"""Optional forced-command gate; also usable through explicitly approved root SSH."""
import os
import sys

COMMAND = '/usr/local/libexec/zipzi-site-deploy/ssh_gate.py receive'
RECEIVER = '/usr/local/libexec/zipzi-site-deploy/receiver.py'


def command(argv, original, uid):
    if argv != ['receive'] or original not in (None, COMMAND):
        raise ValueError('unsupported-ssh-command')
    invocation = ['/usr/bin/python3', '-I', RECEIVER]
    return invocation if uid == 0 else ['/usr/bin/sudo', '-n', '--', *invocation]


if __name__ == '__main__':
    try:
        args = command(sys.argv[1:], os.environ.get('SSH_ORIGINAL_COMMAND'), os.geteuid())
    except ValueError:
        print('Unsupported deployment command.', file=sys.stderr)
        sys.exit(1)
    # No user environment, argv interpolation, arbitrary commands or shell.
    os.execve(args[0], args, {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'})
