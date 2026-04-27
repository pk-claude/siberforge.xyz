#!/usr/bin/env python3
"""
check-truncation.py - Pre-commit guard against silent file truncation.

Compares each tracked text file against its git HEAD copy.
A file is FLAGGED only when BOTH conditions hold:
  (a) it lost its expected closing marker, AND
  (b) it shrunk by more than 30% (or its size differs significantly).

A file is OK if its closing marker is intact, even if it shrunk -
that means a legitimate cleanup (NUL stripping, etc.) happened.

Closing markers checked:
  .html  -> </html> in last 200 bytes (after NUL strip)
  .js    -> last non-blank line ends with } ; ) ] or */
  .css   -> balanced braces

Exit 0 if all files OK, exit 1 if any file looks truncated.
Run manually before deploys, or wire as a git pre-commit hook:
  ln -sf ../../scripts/check-truncation.py .git/hooks/pre-commit

Bypass with --force for legitimate intentional shrinkage.
"""
import subprocess, sys, os

SHRINK_THRESHOLD = 0.30  # 30% shrink without close marker = truncated

def git_head_size(path):
    try:
        out = subprocess.run(['git', 'show', f'HEAD:{path}'],
                              capture_output=True, check=True)
        return len(out.stdout)
    except subprocess.CalledProcessError:
        return None

def check_html(content):
    return b'</html>' in content[-200:]

def check_css(content):
    text = content.decode('utf-8', errors='replace')
    return text.count('{') == text.count('}')

def check_js(content):
    text = content.decode('utf-8', errors='replace').rstrip()
    if not text:
        return True
    last = text.split('\n')[-1].rstrip()
    return last.endswith(('}', ';', '*/', ')', ']'))

CHECKS = {'.html': check_html, '.css': check_css, '.js': check_js}

def main():
    out = subprocess.run(['git', 'ls-files'], capture_output=True, text=True, check=True)
    files = out.stdout.strip().split('\n')

    failures = []
    notes = []
    for path in files:
        ext = os.path.splitext(path)[1]
        if ext not in CHECKS:
            continue
        if not os.path.exists(path):
            continue
        with open(path, 'rb') as f:
            content = f.read().rstrip(b'\x00')

        marker_ok = CHECKS[ext](content)
        head_size = git_head_size(path)
        cur_size = len(content)
        shrunk = head_size is not None and head_size > 200 \
                 and cur_size < head_size * (1 - SHRINK_THRESHOLD)

        if not marker_ok:
            if shrunk:
                failures.append((path, f'TRUNCATED: missing close marker AND shrunk {head_size} -> {cur_size}'))
            else:
                failures.append((path, f'missing expected closing marker for {ext}'))
        elif shrunk:
            notes.append((path, f'shrunk {head_size} -> {cur_size} ({100*(1-cur_size/head_size):.0f}% loss) but closing marker intact - assumed intentional'))

    if notes:
        print(f'truncation guard: {len(notes)} file(s) shrunk but closed properly:')
        for path, msg in notes:
            print(f'  {path}: {msg}')
        print()

    if failures:
        print(f'TRUNCATION GUARD: {len(failures)} suspicious file(s):')
        for path, reason in failures:
            print(f'  {path}: {reason}')
        print()
        print('Bypass with --force only if you are certain:')
        print('  python3 scripts/check-truncation.py --force')
        if '--force' in sys.argv:
            print('FORCED: continuing despite warnings.')
            sys.exit(0)
        sys.exit(1)

    print(f'truncation guard: {len(files)} files checked, all OK')
    sys.exit(0)

if __name__ == '__main__':
    main()
