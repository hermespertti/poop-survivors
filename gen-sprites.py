"""Generate M4 sprites — every row is BUILT programmatically from segments
with '.'-fill, so widths can never be wrong.
"""
SRC = '/home/lex/poop-survivors/src/art.ts'

def row(w: int, segs: list) -> str:
    total = sum(len(s) for s in segs)
    assert total <= w, f'row content {total} > {w}: {segs}'
    left = (w - total) // 2
    right = w - total - left
    return '.' * left + ''.join(segs) + '.' * right

def frame(w: int, h: int, rows: list) -> list:
    assert len(rows) == h, f'{len(rows)} rows != {h}'
    for r in rows:
        assert len(r) == w, f'row {len(r)} != {w}: {r!r}'
    return rows

def sprite(name: str, w: int, h: int, frames: list, comment: str, hit_map=None) -> str:
    out = [f'// {comment}']
    out.append(f'const {name}Frames: string[][] = [')
    for fr in frames:
        out.append('  [')
        for r in fr:
            out.append(f"    '{r}',")
        out.append('  ],')
    out.append('];')
    out.append(f'const {name} = mk({w}, {h}, {name}Frames);')
    if hit_map:
        out.append(f'const {name}Hit = mk({w}, {h}, {name}Frames.map((f) => f.map((row) =>')
        out.append(f"  row.split(\"\").map((c) => ({hit_map})).join(\"\"))));")
    return '\n'.join(out)

# ---- ghost (12x12): googly ghost, 2 frames ----
def G(segs): return row(12, segs)
ghost1 = frame(12, 12, [
    G(['444444']),
    G(['4cccccc4']),
    G(['cc55cc55']),
    G(['cc65cc65']),
    G(['cccccccc']),
    G(['cc55cc55']),
    G(['cccccccc']),
    G(['cccccccc']),
    G(['c5c5c5c5']),
    G(['ccccccc']),
    G(['44444']),
    G([]),
])
ghost2 = frame(12, 12, [
    G(['444444']),
    G(['4cccccc4']),
    G(['cc55cc55']),
    G(['cc65cc65']),
    G(['cccccccc']),
    G(['cc65cc65']),
    G(['cccccccc']),
    G(['cccccccc']),
    G(['c5c5c5c5']),
    G(['ccccccc']),
    G(['44444']),
    G([]),
])
ghost_sprite = sprite('ghost', 12, 12, [ghost1, ghost2], 'Ghost of Last Night: a googly ghost that bites', "c === 'c' ? '5' : c === '4' ? '5' : c")

# ---- bigburp (12x12): massive explosion cloud, 1 frame ----
def B(segs): return row(12, segs)
bigburp1 = frame(12, 12, [
    B(['444444']),
    B(['4ddddd4']),
    B(['4dddddddd']),
    B(['dd5555dd']),
    B(['dd5555dd']),
    B(['4dddddddd']),
    B(['4dddddddd']),
    B(['4ddddd4']),
    B(['444444']),
    B([]),
    B([]),
    B([]),
])
bigburp_sprite = sprite('bigburp', 12, 12, [bigburp1], 'BIG BURP: a massive multi-target explosion cloud')

# ---- moon (12x12): full moon of doom, 1 frame ----
def M(segs): return row(12, segs)
moon1 = frame(12, 12, [
    M(['444444']),
    M(['42222224']),
    M(['422222224']),
    M(['22552224']),
    M(['22552224']),
    M(['422222224']),
    M(['422222224']),
    M(['422332224']),
    M(['422222224']),
    M(['42222224']),
    M(['444444']),
    M([]),
])
moon_sprite = sprite('moon', 12, 12, [moon1], 'MOON OF THE BOWEL: a full moon of doom')

# ---- hotdog (12x12): hot dog character, 2 frames ----
def H(segs): return row(12, segs)
hotdog1 = frame(12, 12, [
    H(['444444']),
    H(['4dddddd4']),
    H(['dd2222dd']),
    H(['d2222222d']),
    H(['dd2222dd']),
    H(['4dddddd4']),
    H(['dd55dd']),
    H(['4dddddd4']),
    H(['4dddddd4']),
    H(['444444']),
    H([]),
    H([]),
])
hotdog2 = frame(12, 12, [
    H(['444444']),
    H(['4dddddd4']),
    H(['dd2222dd']),
    H(['d2222222d']),
    H(['dd2222dd']),
    H(['4dddddd4']),
    H(['dd55dd']),
    H(['4dddddd4']),
    H(['4dddddd4']),
    H(['444444']),
    row(12, ['44....44']),
    H([]),
])
hotdog_sprite = sprite('hotdog', 12, 12, [hotdog1, hotdog2], 'Hot Dog: a hot dog character, 2 walk frames', "c === 'd' ? '5' : c === '4' ? '5' : c")

# ---- avocado (12x12): green pit character, 2 frames ----
def A(segs): return row(12, segs)
avocado1 = frame(12, 12, [
    A(['444444']),
    A(['47777774']),
    A(['4777777774']),
    A(['77555577']),
    A(['77567777']),
    A(['4777777774']),
    A(['4777777774']),
    A(['77557777']),
    A(['4777777774']),
    A(['47777774']),
    A(['444444']),
    A([]),
])
avocado2 = frame(12, 12, [
    A(['444444']),
    A(['47777774']),
    A(['4777777774']),
    A(['77555577']),
    A(['77567777']),
    A(['4777777774']),
    A(['4777777774']),
    A(['77557777']),
    A(['4777777774']),
    A(['47777774']),
    A(['444444']),
    row(12, ['44....44']),
])
avocado_sprite = sprite('avocado', 12, 12, [avocado1, avocado2], 'Avocado: the green pit character, 2 walk frames', "c === '7' ? '5' : c === '4' ? '5' : c")

# ---- stickyplop (12x12): big gunk blob, 1 frame ----
def S(segs): return row(12, segs)
sp1 = frame(12, 12, [
    S(['444444']),
    S(['4dddddd4']),
    S(['4dddddddd']),
    S(['dd5555dd']),
    S(['dd5555dd']),
    S(['4dddddddd']),
    S(['4dddddddd']),
    S(['4dddddd4']),
    S(['444444']),
    S([]),
    S([]),
    S([]),
])
stickyplop_sprite = sprite('stickyplop', 12, 12, [sp1], 'Sticky Plop: big gunk blob that lingers')

# ---- halo (12x12): glowing gold disc, 1 frame ----
def HH(segs): return row(12, segs)
halo1 = frame(12, 12, [
    HH(['444444']),
    HH(['42222224']),
    HH(['25555552']),
    HH(['25522552']),
    HH(['22552522']),
    HH(['22222222']),
    HH(['22552522']),
    HH(['25522552']),
    HH(['25555552']),
    HH(['42222224']),
    HH(['444444']),
    HH([]),
])
halo_sprite = sprite('halo', 12, 12, [halo1], 'Halo of Crumbs: a glowing gold disc')

# ---- slakelake (12x12): wide green lake, 1 frame ----
def SL(segs): return row(12, segs)
sl1 = frame(12, 12, [
    SL(['44444444']),
    SL(['477777777']),
    SL(['755555575']),
    SL(['755555575']),
    SL(['755555575']),
    SL(['755555575']),
    SL(['755555575']),
    SL(['755555575']),
    SL(['755555575']),
    SL(['477777777']),
    SL(['44444444']),
    SL([]),
])
slakelake_sprite = sprite('slakelake', 12, 12, [sl1], 'Slime Lake: a wide green lake zone')

# ---- bouncy (10x10): rubbery brown ball, 2 frames ----
def BB(segs): return row(10, segs)
b1 = frame(10, 10, [
    BB(['4444']),
    BB(['4dddddd']),
    BB(['dd55dd']),
    BB(['dd5555dd']),
    BB(['ddddddddd']),
    BB(['dd55dd']),
    BB(['4dddddd']),
    BB(['444444']),
    BB([]),
    BB([]),
])
b2 = frame(10, 10, [
    BB(['4444']),
    BB(['4dddddd']),
    BB(['d5555dd']),
    BB(['d555555d']),
    BB(['dddddddd']),
    BB(['d5555dd']),
    BB(['4dddddd']),
    BB(['444444']),
    BB([]),
    BB([]),
])
bouncy_sprite = sprite('bouncy', 10, 10, [b1, b2], 'Bouncy Poop: a rubbery brown ball, 2 bounce frames')

# ---- stinkaura (10x10): stink cloud puff, 1 frame ----
def SA(segs): return row(10, segs)
sa1 = frame(10, 10, [
    SA(['44']),
    SA(['4dd4']),
    SA(['dddddd']),
    SA(['dd55dd']),
    SA(['dd55dd']),
    SA(['dddddd']),
    SA(['4dd4']),
    SA(['44']),
    SA([]),
    SA([]),
])
stinkaura_sprite = sprite('stinkaura', 10, 10, [sa1], 'Stink Aura: a wavy stink cloud puff')

# ---- fartbomb (10x10): round bomb with fuse, 1 frame ----
def FB(segs): return row(10, segs)
fb1 = frame(10, 10, [
    FB(['4']),
    FB(['444']),
    FB(['4ddd']),
    FB(['ddddd']),
    FB(['ddddd']),
    FB(['ddddd']),
    FB(['4ddd']),
    FB(['444']),
    FB([]),
    FB([]),
])
fartbomb_sprite = sprite('fartbomb', 10, 10, [fb1], 'Fart Bomb: a round bomb with a fuse')

# ---- turd (10x10): classic swirl, 2 frames ----
def T(segs): return row(10, segs)
t1 = frame(10, 10, [
    T(['444444']),
    T(['4dddddd']),
    T(['d5555dd']),
    T(['d5555dd']),
    T(['4dddddd']),
    T(['dd44dd']),
    T(['4dddddd']),
    T(['444444']),
    T([]),
    T([]),
])
t2 = frame(10, 10, [
    T(['444444']),
    T(['4dddddd']),
    T(['d5555dd']),
    T(['d5555dd']),
    T(['4dddddd']),
    T(['dd44dd']),
    T(['4dddddd']),
    T(['444444']),
    T([]),
    T([]),
])
turd_sprite = sprite('turd', 10, 10, [t1, t2], 'Orbiting Turd: the classic swirl, 2 frames')

# ---- superball (10x10): fast elastic ball, 1 frame ----
def SB(segs): return row(10, segs)
sb1 = frame(10, 10, [
    SB(['4444']),
    SB(['4cccc4']),
    SB(['c5555c']),
    SB(['c5555c']),
    SB(['ccccccc']),
    SB(['c5555c']),
    SB(['c5555c']),
    SB(['4cccc4']),
    SB(['4444']),
    SB([]),
])
superball_sprite = sprite('superball', 10, 10, [sb1], 'Superball Splat: a fast elastic ball')

new_blocks = [
    ghost_sprite, bigburp_sprite, moon_sprite, hotdog_sprite, avocado_sprite,
    stickyplop_sprite, halo_sprite, slakelake_sprite, bouncy_sprite,
    stinkaura_sprite, fartbomb_sprite, turd_sprite, superball_sprite,
]

src = open(SRC).read()

def remove_block(src: str, name: str) -> str:
    for decl in [f'const {name}Frames', f'const {name} = mk', f'const {name}Hit = mk']:
        idx = src.find(decl)
        if idx == -1:
            continue
        if decl.endswith('Frames'):
            depth = 0
            i = idx
            while i < len(src):
                c = src[i]
                if c == '[': depth += 1
                elif c == ']':
                    depth -= 1
                    if depth == 0:
                        i += 1
                        while i < len(src) and src[i] in ' \n;':
                            i += 1
                        break
                i += 1
            start = idx
            pre = src.rfind('\n//', 0, idx)
            if pre != -1 and src[pre:idx].count('\n') <= 3:
                start = pre + 1
            src = src[:start] + src[i:]
        else:
            end = src.find(');', idx) + 2
            while end < len(src) and src[end] in ' \n':
                end += 1
            src = src[:idx] + src[end:]
    return src

for name in ['ghost', 'bigburp', 'moon', 'hotdog', 'avocado', 'stickyplop',
             'halo', 'slakelake', 'bouncy', 'stinkaura', 'fartbomb', 'turd', 'superball']:
    src = remove_block(src, name)

export_idx = src.index('export const SPRITES')
src = src[:export_idx] + '\n// ---------- M4 sprites (programmatic, width-verified) ----------\n' + '\n\n'.join(new_blocks) + '\n\n' + src[export_idx:]

open(SRC, 'w').write(src)
print('done — all M4 sprites written with width-verified rows')
