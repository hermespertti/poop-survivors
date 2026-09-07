#!/usr/bin/env python3
# M19 wiring: generate import statements for every cross-module reference,
# from the ownership index built off the modules' own export headers.
import re, os

ROOT = '/home/lex/poop-survivors'
SRC = f'{ROOT}/src'
FILES = ['combat.ts', 'systems.ts', 'spawner.ts', 'levelup.ts', 'canvas.ts',
         'input.ts', 'overlays.ts', 'render.ts', 'update.ts', 'game.ts', 'main.ts']
LEAVES = ['constants.ts', 'types.ts', 'rng.ts', 'meta.ts', 'sprites.ts',
          'tables/weapons.ts', 'tables/chars.ts', 'tables/enemies.ts', 'tables/sprites.ts',
          'art.ts', 'sfx.ts', 'fx.ts']

owner = {}
MULTI = re.compile(r'^(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^,;{}]*,\s*([A-Za-z_$][\w$]*)(?:\s*=\s*[^;{}]+)?;' , re.M)

def index(path, mod):
    t = open(path).read()
    for m in re.finditer(r'^export (?:async )?(?:function|const|let|var|type)\s+([A-Za-z_$][\w$]*)', t, re.M):
        owner.setdefault(m.group(1), mod)
    for m in MULTI.finditer(t):   # `let a = 0, b = 0;` — second+ names too
        owner.setdefault(m.group(2), mod)
for f in LEAVES:
    index(f'{SRC}/{f}', './' + f[:-3])
for f in FILES:
    index(f'{SRC}/{f}', './' + f[:-3])

# names that must NOT be auto-imported (local types / globals / dom)
SKIP = {'document', 'window', 'navigator', 'matchMedia', 'performance',
        'requestAnimationFrame', 'Math', 'Object', 'Array', 'JSON', 'localStorage',
        'Set', 'Map', 'number', 'string', 'boolean', 'void', 'any', 'null', 'true', 'false',
        'HTMLElement', 'HTMLCanvasElement', 'PointerEvent', 'Element', 'HTMLLinkElement', 'console', 'Promise'}

changed = []
for f in FILES:
    p = f'{SRC}/{f}'
    t = open(p).read()
    body = '\n'.join(l for l in t.split('\n') if not l.startswith('import '))
    # strip comments + string literals so prose never generates fake imports
    body = re.sub(r'//[^\n]*', '', body)
    body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
    body = re.sub(r"'(?:\\.|[^'\\])*'", "''", body)
    body = re.sub(r'"(?:\\.|[^"\\])*"', '""', body)
    body = re.sub(r'`(?:\\.|[^`\\])*`', '``', body)
    have = set()
    for b in re.findall(r'import (?:type )?\{([^}]*)\}', t):
        have |= {n.strip() for n in b.split(',') if n.strip()}
    need = {}
    for m in re.finditer(r'(?<![\w.$])([A-Za-z_][A-Za-z0-9_]*)\b(?!\s*:)', body):
        n = m.group(1)
        if n in SKIP or n in have:
            continue
        o = owner.get(n)
        if o and o != './' + f[:-3]:
            need.setdefault(o, set()).add(n)
    if not need:
        continue
    hdr = ''.join(f"import {{ {', '.join(sorted(v))} }} from '{k}';\n" for k, v in sorted(need.items()))
    nl = t.index('\n') + 1
    # drop stale junk imports from earlier wire runs (object-literal false owners)
    t = re.sub(r"^import \{[^}]*\b(?:id|y)\b[^}]*\} from '\./input';\n", '', t, flags=re.M)
    # insert after the banner comment block (first blank line)
    nl = t.index('\n') + 1
    open(p, 'w').write(t[:nl] + '\n' + hdr + t[nl:])
    changed.append((f, {k: sorted(v) for k, v in need.items()}))

for f, n in changed:
    print(f, n)
print('wired', len(changed), 'files')
