#!/usr/bin/env python3
# Replace lines 1480-1550 in src/art.ts (the ragged M26 sprite block) with
# exact-12-wide generated grids.
def toast(leg_up):
    g = [list('.' * 12) for _ in range(12)]
    for x in range(1, 11): g[0][x] = '4'
    for y in range(1, 10):
        g[y][1] = '4'; g[y][10] = '4'
        for x in range(2, 10): g[y][x] = 'e'
    for x in range(1, 11): g[9][x] = '4'
    for (x, y) in [(2, 1), (9, 1), (2, 8), (9, 8)]: g[y][x] = '4'
    for (x, y) in [(3, 3), (4, 3), (7, 3), (8, 3)]: g[y][x] = '5'
    g[4][3] = '6'; g[4][7] = '6'
    for x in range(4, 8): g[6][x] = '6'
    g[10][3] = '2'; g[10][8] = '2'
    if not leg_up:
        g[11][3] = '2'; g[11][8] = '2'
    return [''.join(r) for r in g]

def roach(step):
    g = [list('.' * 12) for _ in range(12)]
    # antennae (bent forward)
    g[0][2] = '4'; g[1][3] = '4'; g[0][9] = '4'; g[1][8] = '4'
    # head
    g[2][4] = '4'; g[2][5] = 'd'; g[2][6] = 'd'; g[2][7] = '4'
    # thorax with white eyes
    g[3][3] = '4'; g[3][4] = '5'; g[3][5] = 'd'; g[3][6] = 'd'; g[3][7] = '5'; g[3][8] = '4'
    # wing cases: outline + center split + segment lines
    body = {4: (2, 10), 5: (1, 11), 6: (1, 11), 7: (1, 11), 8: (2, 10), 9: (3, 9)}
    for y, (a, b) in body.items():
        g[y][a] = '4'; g[y][b - 1] = '4'
        for x in range(a + 1, b - 1): g[y][x] = 'd'
        g[y][5] = '4'  # wing split
    g[5][3] = '4'; g[5][8] = '4'  # segment notches
    g[7][3] = '4'; g[7][8] = '4'
    # six legs (diagonal strokes from the body edge)
    for y in (3, 5, 7):
        g[y][0] = '4'; g[y][11] = '4'
    if step == 0:
        g[4][0] = '4'; g[4][11] = '4'
    else:
        g[6][0] = '4'; g[6][11] = '4'
    return [''.join(r) for r in g]

def emit(name, frames):
    out = f"const {name}Frames: string[][] = [\n"
    for f in frames:
        out += "  [\n"
        for row in f:
            assert len(row) == 12, (name, repr(row), len(row))
            out += f"    '{row}',\n"
        out += "  ],\n"
    return out + "];"

block = (
    "// M26: toast — a slice of burnt toast with a face. Start weapon: fart bomb\n"
    "// (the smoke alarm of the kitchen). Unlock: survive a full run.\n"
    + emit('toast', [toast(False), toast(True)])
    + "\n\n"
    + "// M26: roach — fast little brown cockroach. Start weapon: Cracker Ring.\n"
    + "// Unlock: kill all 6 scheduled bosses in one run.\n"
    + emit('roach', [roach(0), roach(1)])
    + "\n\n"
    + "const toast = mk(12, 12, toastFrames);\n"
    + "const toastHit = mk(12, 12, toastFrames.map((f) => f.map((row) =>\n"
    + "  row.split('').map((c) => (c === 'e' ? 'c' : c === 'd' ? 'f' : c === '6' ? 'e' : c)).join(''))));\n"
    + "\n"
    + "const roach = mk(12, 12, roachFrames);\n"
    + "const roachHit = mk(12, 12, roachFrames.map((f) => f.map((row) =>\n"
    + "  row.split('').map((c) => (c === 'd' ? 'e' : c === 'c' ? 'f' : c)).join(''))));\n"
)

path = 'src/art.ts'
lines = open(path).read().split('\n')
# block starts at the "// M26: toast" comment line and ends at the blank line
# before "// ---------- M13: three new weapon icons"
start = next(i for i, l in enumerate(lines) if l.startswith('// M26: toast'))
end = next(i for i, l in enumerate(lines) if l.startswith('// ---------- M13: three new weapon icons'))
new = lines[:start] + block.split('\n') + lines[end:]
open(path, 'w').write('\n'.join(new))
print('OK: replaced lines', start + 1, '-', end)
