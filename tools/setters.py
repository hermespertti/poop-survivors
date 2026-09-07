#!/usr/bin/env python3
# M19 setters: uniform rule for cross-module rebinding (TS2632).
#   foreign write:  NAME = RHS;        -> setNAME(RHS);
#   owner adds:     export function setNAME(v: T): void { NAME = v; }
# `NAME -= X` -> setNAME(NAME - X) via tsc line-rewrites below. tsc drives
# everything; loop until green.
import re, os, subprocess, sys

ROOT = '/home/lex/poop-survivors'
SRC = f'{ROOT}/src'

def tsc2632():
    r = subprocess.run('npx tsc --noEmit -p tsconfig.json 2>&1', shell=True, cwd=ROOT,
                      capture_output=True, text=True)
    return re.findall(r'src/([\w.]+\.ts)\((\d+),(\d+)\): error TS2632: Cannot assign to \'([A-Za-z_$][\w$]*)\'', r.stdout)

DECL = re.compile(r'^export (?:let|var)\s+([A-Za-z_$][\w$]*)\s*(:\s*(.+?))?\s*=')

def owners():
    own = {}
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.ts'):
            continue
        for l in open(f'{SRC}/{f}'):
            m = DECL.match(l)
            if m:
                own[m.group(1)] = (f, (m.group(3) or '').strip())
    return own

def compound_fix(ln, name):
    # NAME -= X;  / NAME += X;  (banner timers)
    m = re.search(r'(?<![\w.$])' + re.escape(name) + r'\s*([-+*/])=\s*([^;]+);', ln)
    if m:
        return ln[:m.start()] + f'set{name[0].upper()+name[1:]}({name} {m.group(1)} {m.group(2)});' + ln[m.end():]
    return None

def simple_fix(ln, name):
    fn = 'set' + name[0].upper() + name[1:]
    return re.sub(r'(?<![\w.$])' + re.escape(name) + r'\s*=\s*([^;]+);', fn + r'(\1);', ln, count=1)

OWN = owners()
added = set()
for it in range(15):
    hits = tsc2632()
    if not hits:
        break
    # group by name
    names = {}
    for f, line, col, name in hits:
        names.setdefault(name, []).append((f, int(line)))
    for name, sites in names.items():
        if name not in OWN:
            print(f'no owner for {name}'); sys.exit(1)
        ownf, typ = OWN[name]
        fn = 'set' + name[0].upper() + name[1:]
        if fn not in added:
            added.add(fn)
            p = f'{SRC}/{ownf}'
            t = open(p).read()
            if f'function {fn}(' not in t:
                t = t.rstrip() + f'\nexport function {fn}(v: {typ or "any"}): void {{ {name} = v; }}\n'
                open(p, 'w').write(t)
        for f, line in sites:
            p = f'{SRC}/{f}'
            lines = open(p).read().split('\n')
            ln = lines[line - 1]
            new = compound_fix(ln, name) or simple_fix(ln, name)
            if new == ln:
                print(f'  ?? could not rewrite {f}:{line} for {name}\n      {ln.strip()[:110]}')
                sys.exit(1)
            lines[line - 1] = new
            open(p, 'w').write('\n'.join(lines))
    subprocess.run('python3 tools/wire.py >/dev/null 2>&1', shell=True, cwd=ROOT)
    OWN = owners()

subprocess.run('python3 tools/wire.py >/dev/null 2>&1', shell=True, cwd=ROOT)
r = subprocess.run('npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^npm" | head -20', shell=True, cwd=ROOT, capture_output=True, text=True)
print(r.stdout.strip() or 'CLEAN')
n = subprocess.run('npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"', shell=True, cwd=ROOT, capture_output=True, text=True)
print('errors:', n.stdout.strip())
