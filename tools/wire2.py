#!/usr/bin/env python3
# M19 wire2: resolve TS2632 (cross-module rebinding) by generating owner-side
# setters and rewriting the foreign write sites. Driven entirely by tsc's own
# error list — no guessing: every rewrite corresponds to a reported violation,
# every setter to a name whose declaration line we found. Idempotent.
import re, os, subprocess, sys

ROOT = '/home/lex/poop-survivors'
SRC = f'{ROOT}/src'

def tsc():
    r = subprocess.run('npx tsc --noEmit -p tsconfig.json 2>&1', shell=True, cwd=ROOT,
                      capture_output=True, text=True)
    return [l for l in r.stdout.split('\n') if 'error TS' in l]

DECL = re.compile(r'^(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)(?::\s*([^=]+?))?\s*=')

def find_decl(name):
    for f in os.listdir(SRC):
        if not f.endswith('.ts'):
            continue
        for l in open(f'{SRC}/{f}'):
            m = DECL.match(l)
            if m and m.group(1) == name:
                return f, l.rstrip(), (m.group(2) or '').strip()
    return None, None, None

setters = {}   # owner file -> [(fn, name, type)]
rewrites = []  # (file, name)

for it in range(12):
    errs = [l for l in tsc() if 'TS2632' in l]
    if not errs:
        # also fix leftover "Did you mean" stragglers like camFXy import
        print('no TS2632 left after', it, 'iterations')
        break
    progressed = False
    for e in errs:
        m = re.match(r'src/(\w+\.ts)\((\d+),(\d+)\): error TS2632: Cannot assign to \'([A-Za-z_$][\w$]*)\'', e)
        if not m:
            print('unparsed:', e); continue
        f, line, col, name = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        ownf, declline, typ = find_decl(name)
        if ownf is None:
            print('no decl for', name); continue
        lines = open(f'{SRC}/{f}').read().split('\n')
        ln = lines[line - 1]
        # rewrite this occurrence only
        if re.search(r'(?<![\w.$])' + re.escape(name) + r'\s*=\s*!_?name', ln):
            pass
        toggle = re.search(r'(?<![\w.$])' + re.escape(name) + r'\s*=\s*!' + re.escape(name), ln)
        if toggle:
            fn = 'toggle' + name[0].upper() + name[1:]
            if ownf not in setters or not any(s[0] == fn for s in setters.get(ownf, [])):
                setters.setdefault(ownf, []).append((fn, name, None))
            newln = ln[:col - 1] + fn + '()' + ln[col - 1:].split(';', 1)[0].replace(name, '', 1).split('=', 1)[-1] if False else None
            # simpler: replace `name = !name` with fn()
            newln = re.sub(r'(?<![\w.$])' + re.escape(name) + r'\s*=\s*!' + re.escape(name), fn + '()', ln)
            if newln != ln:
                lines[line - 1] = newln
                open(f'{SRC}/{f}', 'w').write('\n'.join(lines))
                progressed = True
            continue
        fn = 'set' + name[0].upper() + name[1:]
        if ownf not in setters and fn not in [s[0] for s in setters.get(ownf, [])] and fn not in [s[0] for s in setters.values().__iter__().__self__.values().__iter__().__next__()] if False else True:
            seen = any(any(s[0] == fn for s in v) for v in setters.values())
            if not seen:
                setters.setdefault(ownf, []).append((fn, name, typ or f'typeof {name}'))
        newln = re.sub(r'(?<![\w.$])' + re.escape(name) + r'\s*=', fn + '(', ln, count=1)
        # balance: original `name = EXPR;` -> `fn(EXPR);` — append closing paren before the statement end
        # find matching end of assignment expression (first top-level ; at end of line)
        if newln != ln:
            # add the closing paren right before trailing ';' or end-of-line comment
            mm = re.match(r'(.*?)(\s*(?://.*)?)$', newln)
            head, tail = mm.group(1), mm.group(2)
            newln = head + ')' + tail
            lines[line - 1] = newln
            open(f'{SRC}/{f}', 'w').write('\n'.join(lines))
            progressed = True
    # emit setters into owner files
    for ownf, lst in setters.items():
        p = f'{SRC}/{ownf}'
        t = open(p).read()
        for fn, name, typ in lst:
            if f'function {fn}(' in t:
                continue
            typ = typ or f'typeof {name}'
            if typ.startswith('toggle'):
                continue
            t = t.rstrip() + f'\nexport function {fn}(v: {typ}): void {{ {name} = v; }}\n'
        open(p, 'w').write(t)
    toggles = [(fn, name) for ownf, lst in setters.items() for fn, name, typ in lst if typ is None]
    for ownf, lst in setters.items():
        p = f'{SRC}/{ownf}'
        t = open(p).read()
        for fn, name, typ in lst:
            if typ is None and f'function {fn}(' not in t:
                t = t.rstrip() + f'\nexport function {fn}(): void {{ {name} = !{name}; }}\n'
        open(p, 'w').write(t)
    setters.clear()
    # re-wire imports (setter names are new cross-module refs)
    subprocess.run('python3 tools/wire.py >/dev/null 2>&1', shell=True, cwd=ROOT)
    if not progressed:
        print('STALL with', len(errs), 'errors left:')
        for e in errs[:10]:
            print('  ', e)
        sys.exit(1)

# final: any remaining non-2632 error must be addressed by wire (imports)
subprocess.run('python3 tools/wire.py >/dev/null 2>&1', shell=True, cwd=ROOT)
left = [l for l in tsc() if 'error TS' in l]
print('remaining errors:', len(left))
for l in left[:15]:
    print(' ', l)
