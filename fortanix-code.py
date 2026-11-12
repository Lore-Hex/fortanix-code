#!/usr/bin/env python3
"""Launch Fortanix Code. Never persists the API key."""
import getpass
import os
import pathlib
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent
bun = shutil.which('bun')
if not bun:
    raise SystemExit('Bun is required')
env = dict(os.environ)
env['TR_FORTANIX_API_KEY'] = getpass.getpass('TrustedRouter API key (not saved): ')
raise SystemExit(subprocess.call([bun, str(root / 'packages/desktop/scripts/fortanix-agent.ts'), *sys.argv[1:]], env=env))
