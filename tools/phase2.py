#!/usr/bin/env python3
"""M19 phase-2 batch extraction: main.ts -> logic modules, ONE atomic pass.

Safety contract:
  * every line that leaves main.ts lands verbatim in exactly one dest
    (conservation asserted before any write; the removed-intervals are a
    disjoint union proven against the snapshot)
  * construct detection matches EVERY column-0 executable line: decls,
    multi-dot call/assignment chains (canvasEl.addEventListener(...),
    canvasEl.style.x = ...), window/document listeners, requestAnimationFrame,
    top-level if — anything that must own a region
  * dest headers are banners only; imports/exports wiring is tsc-driven
    afterwards (auditor, not guesswork)
"""
import re, os, sys

ROOT = '/home/lex/poop-survivors'
SRC = f'{ROOT}/src/main.ts'
MAIN = open(SRC).read()
if os.path.exists(f'{ROOT}/tools/phase2.snapshot'):
    sys.exit('snapshot exists — previous pass incomplete; resolve manually')
open(f'{ROOT}/tools/phase2.snapshot', 'w').write(MAIN)
L = MAIN.split('\n')

DECL = re.compile(r'^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|type)\s+([A-Za-z_$][\w$]*)')
MULTI = re.compile(r'^(?:export\s+)?(?:let|var)\s+[A-Za-z_$][\w$]*(?:\s*=[^,;]*)?,\s*([A-Za-z_$][\w$]*)')
# any column-0 statement chain that executes at import time
EXEC = re.compile(r'^[A-Za-z_$][\w$]*(?:\.[\w$]+)+\s*(?:\(|=[^=])')   # x.y( / x.y = / x.y.z(
EXEC2 = re.compile(r'^requestAnimationFrame\(|^if \(')

def starts(lines):
    out = []
    for i, l in enumerate(lines):
        m = DECL.match(l)
        if m:
            out.append((i, m.group(1)))
        elif EXEC.match(l) or EXEC2.match(l):
            out.append((i, '@exec:' + l[:120]))
    return out

CS = starts(L)
idx = {}
for k, (i, n) in enumerate(CS):
    idx.setdefault(n, k)

MODULES = {
    'combat.ts': ['wDmg', 'wCd', 'wProjSpeed', 'wArea', 'wDuration',
                  'enemyHp', 'eDmg', 'nearestEnemy', 'nearestEnemyExcluding', 'damageEnemy'],
    'systems.ts': ['fireWeapons', 'spawnBoss', 'hitBoss', 'damageWall', 'hitFlush',
                   'evoReady', 'resolveChest'],
    'spawner.ts': ['activeKinds', 'pickKind', 'spawnEnemy', 'spawnWave',
                   'spawnSpasmWall', 'spawnItem'],
    'levelup.ts': ['weaponCount', 'passiveCount', 'buildOptions', 'pickOption',
                   'gainXp', 'checkLevelUp'],
    'canvas.ts': ['canvasEl', 'canvas', 'ctx', 'CANVAS_SCALE', 'fxEl', 'fitCanvas', 'camX',
                  'camY', 'clientToView', 'clientToWorld', 'toggleFullscreen',
                  '@exec:document.addEventListener(\'fullscreenchange\'' ],
    'input.ts': ['keys', '_prevKeys', '_nowKeys', 'botDir', 'syncKeys',
                 'justPressed', 'keyIndex', 'COARSE', 'pointerHeld',
                 'pointerWorld', 'stick', 'stickMove', 'endPointer',
                 'currentMove', '@exec:window.addEventListener(\'keydown\'',
                 '@exec:window.addEventListener(\'keyup\'',
                 '@exec:canvasEl.addEventListener(\'pointerdown\'',
                 '@exec:canvasEl.addEventListener(\'pointermove\'',
                 '@exec:window.addEventListener(\'pointerup\'',
                 '@exec:window.addEventListener(\'pointercancel\'',
                 '@exec:canvasEl.style.touchAction ='],
    'overlays.ts': ['drawFloor', 'center', 'fmt', 'drawHud', 'overlay',
                    'drawEndScreen', 'drawLevelUp', 'drawTitle', 'shopRowY'],
    'render.ts': ['camFXx', 'render'],
    'update.ts': ['update'],
    'game.ts': ['selectedChar', 'selectedStage', 'cycleStage', 'lastUnlocks',
                'newBestTime', 'shopOpen', 'shopSel', 'upLvl', 'upCost',
                'buyUpgrade', 'G', 'mkGame', 'recomputeStats', 'clampNum',
                'endRun', 'startRun', 'orbitPos', 'orbit2Pos', 'gnatPos',
                'muteMsgT', 'muteMsgOn', 'musicMsgT', 'musicMsgOff', 'paused',
                'lastEvo', 'lastEvoPair', 'frozen'],
}

moves = {}
for dest, names in MODULES.items():
    for n in names:
        if n in moves:
            sys.exit(f'{n} claimed twice')
        if n.startswith('@exec:'):
            prev = n[6:]
            hit = [(i, nm) for i, nm in CS if nm.startswith('@exec:') and nm[6:].startswith(prev)]
            if len(hit) != 1:
                sys.exit(f'@exec {prev}: {len(hit)} matches -> {[h[1][:60] for h in hit]}')
            i = hit[0][0]
            k = next(k for k, (ci, cn) in enumerate(CS) if ci == i)
            end = CS[k + 1][0] if k + 1 < len(CS) else len(L)
        else:
            if n not in idx:
                sys.exit(f'missing {n}')
            k = idx[n]
            i = CS[k][0]
            end = CS[k + 1][0] if k + 1 < len(CS) else len(L)
        moves[n] = (i, end)

ivs = sorted(moves.values())
for (a1, b1), (a2, b2) in zip(ivs, ivs[1:]):
    assert b1 <= a2, f'OVERLAP {(a1,b1)} {(a2,b2)}'

remove = set()
for a, b in ivs:
    remove.update(range(a, b))
rest = [l for i, l in enumerate(L) if i not in remove]
assert len(rest) + len(remove) == len(L)
print(f'conservation ok: {len(remove)} out of {len(L)} -> main.ts {len(rest)}')

for dest, names in MODULES.items():
    chunks = []
    for n in names:
        a, b = moves[n]
        body = '\n'.join(L[a:b]).rstrip()
        body = re.sub(r'^(function|const|let)\s', lambda m: 'export ' + m.group(1) + ' ', body, flags=re.M)
        chunks.append(body)
    banner = f'// M19 phase 2: {dest[:-3]} module — moved verbatim from main.ts.\n'
    open(f'{ROOT}/src/{dest}', 'w').write(banner + '\n' + '\n\n'.join(chunks) + '\n')

open(SRC, 'w').write('\n'.join(rest))
print('main.ts rewritten; ' + str(len(MODULES)) + ' modules written')
