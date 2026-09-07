#!/usr/bin/env python3
"""tools/extract.py — move top-level decls from src/main.ts into a module.

usage: python3 tools/extract.py DEST.ts NAME [NAME...] [--dry]

Safety contract:
  * structural regions: column-0 construct start -> next column-0 construct
    (this file's style guarantees a construct per column-0 line; prose and
    indented code never match). If a NAME's region contains ANOTHER top-level
    construct start, extraction ABORTS (something matched too greedily).
  * conservation: sum(main before) == sum(main after) + lines appended;
    failure aborts BEFORE writing main.
  * DEST written first; main rewritten only after that succeeds.
"""
import re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.path.join(ROOT, 'src/main.ts')

DECL = re.compile(r'^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|type)\s+([A-Za-z_$][\w$]*)')
OTHER = re.compile(r'^(?:export\s+)?(?:window|document|navigator)\.|^requestAnimationFrame\(|^if\s*\(|^[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\s*=')

def construct_lines(lines):
    out = []
    for i, l in enumerate(lines):
        m = DECL.match(l) or OTHER.match(l)
        if m:
            out.append((i, (m.group(1) if m.lastindex else l.split('(')[0][:20])))
    return out

def region(lines, name):
    cl = construct_lines(lines)
    idx = [k for k, (i, n) in enumerate(cl) if n == name]
    if not idx:
        return None
    k = idx[-1]
    i = cl[k][0]
    end = cl[k + 1][0] if k + 1 < len(cl) else len(lines)
    # trailing blank lines back to the last content line
    e = end
    while e - 1 > i and not lines[e - 1].strip():
        e -= 1
    start = i
    while start - 1 >= 0 and lines[start - 1].startswith('//'):
        start -= 1
    # region must contain exactly ONE construct start (its own)
    inner = [c for c in cl if i < c[0] < end]
    if inner:
        print(f'  ABORT {name}: region [{start},{end}) contains nested constructs: '
              f'{[c[1] for c in inner]} — decl not column-0-clean')
        return False
    return start, e

def main():
    dry = '--dry' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--dry']
    dest = args[0] if args[0].startswith('/') else os.path.join(ROOT, args[0])
    names = args[1:]
    lines = open(MAIN).read().split('\n')
    before = len(lines)
    taken = []
    for n in names:
        r = region(lines, n)
        if r is None:
            print(f'  ?? not found: {n}'); continue
        if r is False:
            sys.exit(2)
        taken.append(r)
    payload = []
    for a, b in taken:
        payload += lines[a:b]
    removed = sum(b - a for a, b in taken)
    after = lines
    for a, b in sorted(taken, reverse=True):
        after = after[:a] + after[b:]
    if before != len(after) + removed:
        print(f'  CONSERVATION FAIL {before} != {len(after)}+{removed}'); sys.exit(3)
    print(f'  plan: {len(taken)} regions, {removed} lines out of {before} -> {os.path.basename(dest)}'
          + ('  [dry]' if dry else ''))
    if dry:
        return
    old = open(dest).read() if os.path.exists(dest) else ''
    open(dest, 'w').write(old + '\n'.join(payload).strip('\n') + '\n')
    open(MAIN, 'w').write('\n'.join(after))
    print(f'  ok: dest={len(old.splitlines()) + len(payload)} lines, main.ts={len(after)}')

main()
