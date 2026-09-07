#!/usr/bin/env python3
# M19 phase 1: extract PURE data from main.ts (types, constants, tables).
# No function moves, no renames, zero behavior risk — audited by tsc,
# the fingerprint oracle, and the full 248-assertion gate.
import re, os

ROOT = '/home/lex/poop-survivors'
MAIN = f'{ROOT}/src/main.ts'
src = open(MAIN).read()
orig = src

def grab_decl(text, name):
    """Return (decl_text, text_without_it) for top-level `const NAME`/`type NAME`."""
    m = re.search(r'^(?:const|type) ' + re.escape(name) + r'\b', text, re.M)
    if not m: raise SystemExit(f'decl not found: {name}')
    # walk forward to balanced end
    i = m.start(); depth = 0; j = i
    while j < len(text):
        c = text[j]
        if c in '{[(': depth += 1
        elif c in '}])': depth -= 1
        elif c == ';' and depth == 0:
            j += 1; break
        j += 1
    end = text.find('\n', j)
    end = len(text) if end == -1 else end + 1
    return text[i:end], text[:i] + text[end:]

def autoexport(t):
    return re.sub(r'^(?:const|let|function|type) ', lambda m: 'export ' + m.group(0), t, flags=re.M)

moved = {}
def take(name, optional=False):
    global src
    if optional and not re.search(r'^(?:const|type) ' + re.escape(name) + r'\b', src, re.M):
        return
    decl, src = grab_decl(src, name)
    moved.setdefault(name, decl.rstrip() + '\n')

# constants
for n in ['TILE', 'WORLD_W', 'WORLD_H', 'VIEW_W', 'VIEW_H', 'PLAYER',
          'STICK_R', 'DT', 'RUN_LEN', 'SPIKE_T', 'SPIKE_EVERY', 'ITEM_T',
          'META_KEY']:
    take(n)
consts = ('// M19 phase 1: named tuning constants extracted verbatim from main.ts.\n'
          '// These are the global knobs; per-weapon/per-boss tuning lives in src/tables/.\n\n'
          + ''.join(moved[n] for n in ['TILE','WORLD_W','WORLD_H','VIEW_W','VIEW_H','PLAYER',
                                        'DT','RUN_LEN','STICK_R','SPIKE_T','SPIKE_EVERY','ITEM_T','META_KEY']))

# types
for n in ['Enemy','Gem','Bullet','Zone','Turret','DmgNum','Mode','WState','ItemOpt','Boss','Item']:
    take(n)
take('Game'); take('Meta')
types_text = ('// M19 phase 1: all entity/state types, extracted verbatim from main.ts.\n\n'
              + ''.join(v for k, v in moved.items() if k[0].isupper()))
moved = {}

# tables
os.makedirs(f'{ROOT}/src/tables', exist_ok=True)
for n in ['WEAPONS','PASSIVES']: take(n)
dec, src = grab_decl(src, 'xpToNext') if False else (None, src)
# xpToNext is a function — grab by header comment through closing brace
m = re.search(r'^function xpToNext\(level: number\): number \{', src, re.M)
i = m.start(); depth = 0; j = i
while True:
    if src[j] == '{': depth += 1
    elif src[j] == '}':
        depth -= 1
        if depth == 0: break
    j += 1
eol = src.find('\n', j) + 1
xp_decl = src[i:eol]; src = src[:i] + src[eol:]
w_tbl = ('// M19 phase 1: weapons + passives + XP curve (extracted verbatim).\n'
         '// Columns are raw table data; the scaling that applies them lives in main.ts\n'
         '// (wDmg/wCd/wProjSpeed/wArea/wDuration) — balance lives HERE, mechanics there.\n\n'
         + moved['WEAPONS'] + '\n' + moved['PASSIVES'] + '\n' + xp_decl + '\n')
moved = {}

for n in ['CHARACTERS','STAGES','STAGE_IDS','UPGRADES']: take(n)
c_tbl = ('// M19 phase 1: characters, stages, shop ladder (extracted verbatim).\n\n'
         + moved['CHARACTERS'] + '\n' + moved['STAGES'] + '\n' + moved['STAGE_IDS']
         + '\n' + moved['UPGRADES'] + '\n')
moved = {}

for n in ['ENEMY_TYPES','BOSS_SCHEDULE','BOSS_STATS','SCRIPT']: take(n)
e_tbl = ('// M19 phase 1: enemy archetypes + boss schedule/stats + spawn director script\n'
         '// (extracted verbatim — the timeline IS the difficulty curve).\n\n'
         + moved['ENEMY_TYPES'] + '\n' + moved['BOSS_SCHEDULE'] + '\n'
         + moved['BOSS_STATS'] + '\n' + moved['SCRIPT'] + '\n')
moved = {}

for n in ['ENEMY_SPR','BOSS_SPR','UNLOCK_LABEL']: take(n)
s_tbl = ('// M19 phase 1: sprite pick tables + unlock label copy (extracted verbatim).\n\n'
         + moved['ENEMY_SPR'] + '\n' + moved['BOSS_SPR'] + '\n' + moved['UNLOCK_LABEL'] + '\n')

# STAGE_IDS/StageDef etc: StageDef may not exist (inline). Remove missing names first pass.

imports = (
    "import {\n  TILE, WORLD_W, WORLD_H, VIEW_W, VIEW_H, PLAYER, DT, RUN_LEN, STICK_R,\n"
    "  SPIKE_T, SPIKE_EVERY, ITEM_T, META_KEY\n} from './constants';\n"
    "import type {\n  Enemy, Gem, Bullet, Zone, Turret, DmgNum, Mode, WState, ItemOpt, Game, Meta, Boss\n} from './types';\n"
    "import { WEAPONS, PASSIVES, xpToNext } from './tables/weapons';\n"
    "import { CHARACTERS, STAGES, STAGE_IDS, UPGRADES } from './tables/chars';\n"
    "import { ENEMY_TYPES, BOSS_SCHEDULE, BOSS_STATS, SCRIPT } from './tables/enemies';\n"
    "import { ENEMY_SPR, BOSS_SPR, UNLOCK_LABEL } from './tables/sprites';\n\n")

# splice imports after the first comment banner at top of main.ts
first_code = re.search(r'^(const|let|function|type) ', src, re.M)
src2 = src[:first_code.start()] + imports + src[first_code.start():]

for path_, txt in [('constants.ts', consts), ('types.ts', types_text),
                   ('tables/weapons.ts', w_tbl), ('tables/chars.ts', c_tbl),
                   ('tables/enemies.ts', e_tbl), ('tables/sprites.ts', s_tbl)]:
    open(f'{ROOT}/src/{path_}', 'w').write(autoexport(txt))
open(MAIN, 'w').write(src2)
print('main.ts:', src2.count('\n') + 1, 'lines (was', orig.count('\n') + 1, ')')
print('DONE')
