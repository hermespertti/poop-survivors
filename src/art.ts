// POOP SURVIVORS — art pipeline (M1)
// Hand-authored pixel art as string grids over one shared 16-color palette.
// '.' = transparent. Palette index = one char: 0-9, a-f.
// Sprites are validated at load: a row-length typo throws so a bad grid can
// never silently ship as a ragged smear.

export const PALETTE: string[] = [
  '#f3e2b8', // 0 light kitchen tile
  '#e8cf94', // 1 dark kitchen tile
  '#d99a2b', // 2 crouton gold
  '#a5651d', // 3 crouton shade
  '#4a3220', // 4 dark outline / brown
  '#ffffff', // 5 white (eyes, highlights)
  '#2b1c10', // 6 near-black (pupils, deep outline)
  '#7ee081', // 7 gem green
  '#3fa34d', // 8 gem green dark
  '#cfe8ff', // 9 bubble light
  '#5aa9e6', // a bubble blue
  '#2b6fb0', // b bubble dark
  '#eaf6ff', // c bubble highlight
  '#8a5a2b', // d fart/bolt brown
  '#d9b877', // e fart/bolt light
  '#0d0b0f', // f bg / deep
];
const CHARS = '0123456789abcdef';
const PAL_IDX: Record<string, number> = {};
for (let i = 0; i < PALETTE.length; i++) PAL_IDX[CHARS[i]] = i;

// A sprite is { w, h, frames: string[][] } — each frame is h rows of w chars.
export type Sprite = { w: number; h: number; frames: string[][] };

function mk(w: number, h: number, frames: string[][]): Sprite {
  for (const fr of frames) {
    if (fr.length !== h) throw new Error(`sprite row count ${fr.length} != h ${h}`);
    for (const row of fr) {
      if (row.length !== w) throw new Error(`sprite row width ${row.length} != ${w}: ${row}`);
      for (const c of row) if (c !== '.' && PAL_IDX[c] === undefined) throw new Error(`bad palette char '${c}' in ${row}`);
    }
  }
  return { w, h, frames };
}

// ---------- crouton (12x12) — a little golden crouton, 2 walk frames ----------
const CR_O = 4, CR_B = 2, CR_D = 3, WH = 5, BL = 6;
const croutonFrames: string[][] = [
  [
    '...444444...',
    '..42222224..',
    '.4255225524.',
    '.4256225624.',
    '.4222222224.',
    '.4222442224.',
    '.4222222224.',
    '.4333333334.',
    '..44444444..',
    '...44..44...',
    '....4...4...',
    '............',
  ],
  [
    '...444444...',
    '..42222224..',
    '.4255225524.',
    '.4256225624.',
    '.4222222224.',
    '.4222442224.',
    '.4222222224.',
    '.4333333334.',
    '..44444444..',
    '..44....44..',
    '..4......4..',
    '............',
  ],
];
const crouton = mk(12, 12, croutonFrames);
const croutonHit = mk(12, 12, croutonFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === '2' || c === '3' ? '5' : c === '4' ? '5' : c === '6' ? '4' : c)).join(''))));

// ---------- bubble (12x12) — googly gunk monster, 2 squish frames ----------
const bubbleFrames: string[][] = [
  [
    '............',
    '....4444....',
    '...4bbbb4...',
    '..4bbaabb4..',
    '.4ba55aa55b4',
    '.4ba65aa65b4',
    '..4baaaab4..',
    '..44444444..',
    '....4..4....',
    '............',
    '............',
    '............',
  ],
  [
    '............',
    '.....44.....',
    '....4bb4....',
    '...4baab4...',
    '..4ba55a55b4',
    '..4ba65a65b4',
    '..4bbaaabb4.',
    '...444444...',
    '............',
    '............',
    '............',
    '............',
  ],
];
const bubble = mk(12, 12, bubbleFrames);
const bubbleHit = mk(12, 12, bubbleFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === 'a' || c === 'b' ? 'c' : c === '4' ? '5' : c)).join(''))));

// ---------- gem (8x8) — XP pickup, 2 sparkle frames ----------
const gem = mk(8, 8, [
  [
    '...44...',
    '..4774..',
    '.475774.',
    '.477774.',
    '..4774..',
    '...44...',
    '........',
    '........',
  ],
  [
    '...44...',
    '..4884..',
    '.487884.',
    '.488884.',
    '..4884..',
    '...44...',
    '........',
    '........',
  ],
]);

// ---------- bolt (10x6) — fart projectile ----------
const bolt = mk(10, 6, [
  [
    '......444.',
    '....4de44.',
    '..4deee44.',
    '..4eeee44.',
    '....4ee4..',
    '......44..',
  ],
]);

// ---------- plop (8x8) — cannon projectile, a heavy brown-gunk blob ----------
const plop = mk(8, 8, [
  [
    '...444..',
    '..4d7d4.',
    '.4d777d4',
    '.4d887d4',
    '..47774.',
    '...444..',
    '........',
    '........',
  ],
]);

// ---------- cracker (8x8) — orbiting cracker shard ----------
const cracker = mk(8, 8, [
  [
    '..4222..',
    '.4225224',
    '.4255224',
    '.4222224',
    '.4223324',
    '..4222..',
    '........',
    '........',
  ],
]);

// ---------- boss (12x12) — The First Wind, a swirling gas cyclone ----------
const bossFrames: string[][] = [
  [
    '............',
    '....7777....',
    '...799997...',
    '..79cccc97..',
    '..9cc9cc99..',
    '.79cc99cc97.',
    '.9cc999cc99.',
    '..9cc99cc9..',
    '..799cc997..',
    '...799997...',
    '....7777....',
    '............',
  ],
  [
    '............',
    '....7777....',
    '...799997...',
    '..9cc9cc97..',
    '..799cc997..',
    '.9cc99cc997.',
    '.79cc99cc99.',
    '..9cc9cc99..',
    '..799cc997..',
    '...799997...',
    '....7777....',
    '............',
  ],
];
const boss = mk(12, 12, bossFrames);
const bossHit = mk(12, 12, bossFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === '7' ? 'c' : c === '9' ? '5' : c === 'c' ? '5' : c)).join(''))));

// ---------- chest (12x8) — treasure chest (boss drops) ----------
const chest = mk(12, 8, [
  [
    '............',
    '..44444444..',
    '.4222222224.',
    '.4242224224.',
    '.4444444444.',
    '.4233333334.',
    '.4233333334.',
    '............',
  ],
]);

// ---------- M3 enemy roster (6 types) — all reuse the 16-color palette ----------
// 1. bubble (12x12, above) — the chaser from M1.
// 2. droplet (10x10) — fast, thin, blue-white droplet with a tail.
const droplet = mk(10, 10, [
  [
    '......44..',
    '.....4bb4.',
    '....4baab4',
    '...4ba55ab',
    '..4ba55a5b',
    '.4bbbaaab4',
    '.4b4bbbbb4',
    '..4..4bb4.',
    '.....4....',
    '..........',
  ],
]);

// 3. crumb (12x12) — tanky brown crumb blob, slow, 2 frames
const crumbFrames: string[][] = [
  [
    '...444444...',
    '.4dddddddd4.',
    '.4dd33dd33d4',
    '.4dd3ddd33d4',
    '.4dd33dd33d4',
    '.4dd33dd33d4',
    '.4dd33dd33d4',
    '.4dd33dd33d4',
    '.4dddddddd4.',
    '...444444...',
    '............',
    '............',
  ],
  [
    '...444444...',
    '.4dddddddd4.',
    '.4dd33dd33d4',
    '.4dd3ddd33d4',
    '.4dd33dd33d4',
    '.4dd33dd33d4',
    '.4dd33dd33d4',
    '.4dd33dd33d4',
    '.4dddddddd4.',
    '...444444...',
    '..44.....44.',
    '............',
  ],
];
const crumb = mk(12, 12, crumbFrames);
const crumbHit = mk(12, 12, crumbFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === 'd' ? '5' : c === '3' ? '5' : c === '4' ? '5' : c)).join(''))));

// 4. mop (12x12) — swarmer: little mop head on a stick, 2 frames
const mopFrames: string[][] = [
  [
    '...444444...',
    '.4dd4dd4d44.',
    '.4d4dd44d44.',
    '.4dd4dd4d44.',
    '.4d44d44d44.',
    '.4d44d4d44..',
    '...444444...',
    '.....44.....',
    '....4d4.....',
    '....4d4.....',
    '.....4......',
    '............',
  ],
  [
    '...444444...',
    '.4dd4dd4d44.',
    '.4d4dd44d44.',
    '.4dd4dd4d44.',
    '.4d44d44d44.',
    '.4d44d4d44..',
    '...444444...',
    '.....44.....',
    '....4d4.....',
    '....44d4....',
    '....4d......',
    '............',
  ],
];
const mop = mk(12, 12, mopFrames);
const mopHit = mk(12, 12, mopFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === 'd' ? '5' : c === '4' ? '5' : c)).join(''))));

// 5. stink (12x12) — slow heavy cloud, near-black, 2 frames
const stinkFrames: string[][] = [
  [
    '....4444....',
    '..44ffff44..',
    '.4fffffff44.',
    '.4fff44ff44.',
    '.4ff4444f44.',
    '.4ff4444f44.',
    '.4fff44ff44.',
    '.4fffffff44.',
    '..44ffff44..',
    '....4444....',
    '............',
    '............',
  ],
  [
    '....4444....',
    '..44ffff44..',
    '.4fffffff44.',
    '.4fff44ff44.',
    '.4ff4444f44.',
    '.4ff4444f44.',
    '.4fff44ff44.',
    '.4fffffff44.',
    '..44ffff44..',
    '....4444....',
    '..44....44..',
    '............',
  ],
];
const stink = mk(12, 12, stinkFrames);
const stinkHit = mk(12, 12, stinkFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === 'f' ? '5' : c === '4' ? '5' : c)).join(''))));

// 6. sponge (10x10) — shielded, yellow sponge with dark pores, 2 frames
const spongeFrames: string[][] = [
  [
    '..444444..',
    '.42222224.',
    '.42552264.',
    '.42266224.',
    '.42562224.',
    '.42265524.',
    '.42222624.',
    '.42222224.',
    '..444444..',
    '..........',
  ],
  [
    '..444444..',
    '.42222224.',
    '.42652254.',
    '.42226524.',
    '.42526624.',
    '.42226524.',
    '.42562224.',
    '.42222224.',
    '..444444..',
    '..........',
  ],
];
const sponge = mk(10, 10, spongeFrames);
const spongeHit = mk(10, 10, spongeFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === '2' ? '5' : c === '4' ? '5' : c === '6' ? '4' : c)).join(''))));

// ---------- M3 bosses (14x14) + Final Flush (16x16) ----------
// Colonel C — a squat colon-shaped brute, gold-brown with eyes
const colonelFrames: string[][] = [
  [
    '..4444444444..',
    '.422222222224.',
    '.422552255224.',
    '.422652265224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '..4444444444..',
    '..............',
  ],
  [
    '..4444444444..',
    '.422222222224.',
    '.422652265224.',
    '.422552255224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '.422222222224.',
    '..4444444444..',
    '..............',
  ],
];
const colonel = mk(14, 14, colonelFrames);
const colonelHit = mk(14, 14, colonelFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === '2' ? '5' : c === '4' ? '5' : c === '6' ? '4' : c)).join(''))));

// The Constipation — a big clenched lump, dark brown, 14x14
const constipationFrames: string[][] = [
  [
    '....444444....',
    '..44dddddd44..',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '..44dddddd44..',
    '....444444....',
    '..............',
  ],
  [
    '....444444....',
    '..44dddddd44..',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '.4dd44dd44dd4.',
    '.4dddddddddd4.',
    '..44dddddd44..',
    '....444444....',
    '..............',
  ],
];
const constipation = mk(14, 14, constipationFrames);
const constipationHit = mk(14, 14, constipationFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === 'd' ? '5' : c === '4' ? '5' : c)).join(''))));

// The Diarrhea Express — a long fast slither, light brown, 14x14
const expressFrames: string[][] = [
  [
    '..............',
    '....444444....',
    '..44dddddd44..',
    '.4dddddddddd4.',
    '.4dd55dd55dd4.',
    '.4dddddddddd4.',
    '.4dddddddddd4.',
    '.4dddddddddd4.',
    '..44dddddd44..',
    '....444444....',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  [
    '..............',
    '....444444....',
    '..44dddddd44..',
    '.4dddddddddd4.',
    '.4dd55dd55dd4.',
    '.4dddddddddd4.',
    '.4dddddddddd4.',
    '.4dddddddddd4.',
    '..44dddddd44..',
    '....444444....',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
];
const express = mk(14, 14, expressFrames);
const expressHit = mk(14, 14, expressFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === 'd' ? '5' : c === '4' ? '5' : c)).join(''))));

// Mr. Sphincter — two-phase clamp boss, pink-gold ring, 14x14
const sphincterFrames: string[][] = [
  [
    '....444444....',
    '..4222222244..',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '..4222222244..',
    '....444444....',
    '..............',
    '..............',
  ],
  [
    '....444444....',
    '..4222222244..',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '.423333333224.',
    '..4222222244..',
    '....444444....',
    '..............',
    '..............',
  ],
];
const sphincter = mk(14, 14, sphincterFrames);
const sphincterHit = mk(14, 14, sphincterFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === '3' ? '5' : c === '4' ? '5' : c)).join(''))));

// THE FINAL FLUSH — a giant scythe-wielding poop, 16x16
const flushFrames: string[][] = [
  [
    '.....444444.....',
    '...44dddddd44...',
    '..4dddddddddd4..',
    '.4ddd44dd44dd4..',
    '.4dddddddddd44..',
    '.4ddd44dd44dd4..',
    '.4dddddddddd4...',
    '.4dd44dd44dd4...',
    '.4dddddddddd4...',
    '.4dd44dd44dd4...',
    '.4dddddddddd4...',
    '..4dddddddd4....',
    '...44dddd44.....',
    '.....4444.......',
    '................',
    '................',
  ],
  [
    '.....444444.....',
    '...44dddddd44...',
    '..4dddddddddd4..',
    '.4ddd44dd44dd4..',
    '.4dddddddddd44..',
    '.4ddd44dd44dd4..',
    '.4dddddddddd4...',
    '.4dd44dd44dd4...',
    '.4dddddddddd4...',
    '.4dd44dd44dd4...',
    '.4dddddddddd4...',
    '..4dddddddd4....',
    '...44dddd44.....',
    '.....4444.......',
    '................',
    '................',
  ],
];
const flush = mk(16, 16, flushFrames);
const flushHit = mk(16, 16, flushFrames.map((f) => f.map((row) =>
  row.split('').map((c) => (c === 'd' ? '5' : c === '4' ? '5' : c)).join(''))));

// ---------- M4 weapons 5-8 (10x10 each) ----------
[] = [
  [
    '...4444...',
    '.4dddddd4.',
    '.4dd55dd4.',
    '4dd5555dd4',
    '4ddddddddd',
    '.4dd55dd4.',
    '.4dddddd4.',
    '..444444..',
    '..........',
    '..........',
  ],
  [
    '...4444...',
    '.4dddddd4.',
    '.4d5555d4.',
    '4d555555d4',
    '4dddddddd4',
    '.4d5555d4.',
    '.4dddddd4.',
    '..444444..',
    '..........',
    '..........',
  ],
];
// stinkaura (10x10) — Stink Aura: a wavy stink cloud puff
// fartbomb (10x10) — Fart Bomb: a round bomb with a fuse
[] = [
  [
    '..444444..',
    '.4dddddd4.',
    '.4d5555d4.',
    '.4d5555d4.',
    '.4dddddd4.',
    '.4dd44dd4.',
    '.4dddddd4.',
    '..444444..',
    '..........',
    '..........',
  ],
  [
    '..444444..',
    '.4dddddd4.',
    '.4d5555d4.',
    '.4d5555d4.',
    '.4dddddd4.',
    '.4dd44dd4.',
    '.4dddddd4.',
    '..444444..',
    '..........',
    '..........',
  ],
];
// ---------- M4 evolution sprites (12x12) ----------
// sticky plop (12x12) — big gunk blob that lingers
// halo of crumbs (12x12) — a glowing gold disc
// slime lake (12x12) — a wide green lake zone
// superball (10x10) — Superball Splat: a fast elastic ball
// (rows verified: each exactly 10 chars)
[] = [
  [
    '...444444...',
    '..4cccccc4.',
    '.4cc55cc55.',
    '.4cc65cc65.',
    '.4cccccccc.',
    '.4cc55cc55.',
    '.4cccccccc.',
    '.4cccccccc.',
    '.4c5c5c5c4.',
    '..cccccc4..',
    '...44444...',
    '............',
  ],
  [
    '...444444...',
    '..4cccccc4.',
    '.4cc55cc55.',
    '.4cc65cc65.',
    '.4cccccccc.',
    '.4cc65cc65.',
    '.4cccccccc.',
    '.4cccccccc.',
    '.4c5c5c5c4.',
    '..cccccc4..',
    '...44444...',
    '............',
  ],
];
// bigburp (12x12) — BIG BURP: a massive multi-target explosion cloud
// moon (12x12) — MOON OF THE BOWEL: a full moon of doom
// ---------- M4 stage 2 (The Bathroom) — tile colors are code-drawn; sprites here are the characters ----------
[] = [
  [
    '...444444...',
    '..4dddddd4.',
    '.4dd2222d4.',
    '.4d2222224.',
    '.4dd2222d4.',
    '.4dddddd4.',
    '.4dd55dd4.',
    '.4dddddd4.',
    '..4dddd4..',
    '...4444...',
    '............',
    '............',
  ],
  [
    '...444444...',
    '..4dddddd4.',
    '.4dd2222d4.',
    '.4d2222224.',
    '.4dd2222d4.',
    '.4dddddd4.',
    '.4dd55dd4.',
    '.4dddddd4.',
    '..4dddd4..',
    '...4444...',
    '..44....44.',
    '............',
  ],
];
[] = [
  [
    '...444444...',
    '..4777777..',
    '.477777777.',
    '.47755577.',
    '.47756777.',
    '.47777777.',
    '.47777777.',
    '.47755777.',
    '.47777777.',
    '..477777..',
    '...44444...',
    '............',
  ],
  [
    '...444444...',
    '..4777777..',
    '.477777777.',
    '.47755577.',
    '.47756777.',
    '.47777777.',
    '.47777777.',
    '.47755777.',
    '.47777777.',
    '..477777..',
    '...44444...',
    '..44....44.',
    '............',
  ],
];
// ---------- M3 stage items (restored) ----------
// goldbag (10x10) — floor gold pickup
const goldbag = mk(10, 10, [
  [
    '...444....',
    '..422244..',
    '.42222224.',
    '.42222224.',
    '.42233224.',
    '.42222224.',
    '..422224..',
    '...4444...',
    '..........',
    '..........',
  ],
]);
// donut (10x10) — floor heal pickup
const donut = mk(10, 10, [
  [
    '..444444..',
    '.42222224.',
    '.42266224.',
    '.42266224.',
    '.42222224.',
    '.42222224.',
    '..444444..',
    '..........',
    '..........',
    '..........',
  ],
]);


// ---------- M4 sprites (programmatic, width-verified) ----------
// Ghost of Last Night: a googly ghost that bites
const ghostFrames: string[][] = [
  [
    '...444444...',
    '..4cccccc4..',
    '..cc55cc55..',
    '..cc65cc65..',
    '..cccccccc..',
    '..cc55cc55..',
    '..cccccccc..',
    '..cccccccc..',
    '..c5c5c5c5..',
    '..ccccccc...',
    '...44444....',
    '............',
  ],
  [
    '...444444...',
    '..4cccccc4..',
    '..cc55cc55..',
    '..cc65cc65..',
    '..cccccccc..',
    '..cc65cc65..',
    '..cccccccc..',
    '..cccccccc..',
    '..c5c5c5c5..',
    '..ccccccc...',
    '...44444....',
    '............',
  ],
];
const ghost = mk(12, 12, ghostFrames);
const ghostHit = mk(12, 12, ghostFrames.map((f) => f.map((row) =>
  row.split("").map((c) => (c === 'c' ? '5' : c === '4' ? '5' : c)).join(""))));

// BIG BURP: a massive multi-target explosion cloud
const bigburpFrames: string[][] = [
  [
    '...444444...',
    '..4ddddd4...',
    '.4dddddddd..',
    '..dd5555dd..',
    '..dd5555dd..',
    '.4dddddddd..',
    '.4dddddddd..',
    '..4ddddd4...',
    '...444444...',
    '............',
    '............',
    '............',
  ],
];
const bigburp = mk(12, 12, bigburpFrames);

// MOON OF THE BOWEL: a full moon of doom
const moonFrames: string[][] = [
  [
    '...444444...',
    '..42222224..',
    '.422222224..',
    '..22552224..',
    '..22552224..',
    '.422222224..',
    '.422222224..',
    '.422332224..',
    '.422222224..',
    '..42222224..',
    '...444444...',
    '............',
  ],
];
const moon = mk(12, 12, moonFrames);

// Hot Dog: a hot dog character, 2 walk frames
const hotdogFrames: string[][] = [
  [
    '...444444...',
    '..4dddddd4..',
    '..dd2222dd..',
    '.d2222222d..',
    '..dd2222dd..',
    '..4dddddd4..',
    '...dd55dd...',
    '..4dddddd4..',
    '..4dddddd4..',
    '...444444...',
    '............',
    '............',
  ],
  [
    '...444444...',
    '..4dddddd4..',
    '..dd2222dd..',
    '.d2222222d..',
    '..dd2222dd..',
    '..4dddddd4..',
    '...dd55dd...',
    '..4dddddd4..',
    '..4dddddd4..',
    '...444444...',
    '..44....44..',
    '............',
  ],
];
const hotdog = mk(12, 12, hotdogFrames);
const hotdogHit = mk(12, 12, hotdogFrames.map((f) => f.map((row) =>
  row.split("").map((c) => (c === 'd' ? '5' : c === '4' ? '5' : c)).join(""))));

// Avocado: the green pit character, 2 walk frames
const avocadoFrames: string[][] = [
  [
    '...444444...',
    '..47777774..',
    '.4777777774.',
    '..77555577..',
    '..77567777..',
    '.4777777774.',
    '.4777777774.',
    '..77557777..',
    '.4777777774.',
    '..47777774..',
    '...444444...',
    '............',
  ],
  [
    '...444444...',
    '..47777774..',
    '.4777777774.',
    '..77555577..',
    '..77567777..',
    '.4777777774.',
    '.4777777774.',
    '..77557777..',
    '.4777777774.',
    '..47777774..',
    '...444444...',
    '..44....44..',
  ],
];
const avocado = mk(12, 12, avocadoFrames);
const avocadoHit = mk(12, 12, avocadoFrames.map((f) => f.map((row) =>
  row.split("").map((c) => (c === '7' ? '5' : c === '4' ? '5' : c)).join(""))));

// Sticky Plop: big gunk blob that lingers
const stickyplopFrames: string[][] = [
  [
    '...444444...',
    '..4dddddd4..',
    '.4dddddddd..',
    '..dd5555dd..',
    '..dd5555dd..',
    '.4dddddddd..',
    '.4dddddddd..',
    '..4dddddd4..',
    '...444444...',
    '............',
    '............',
    '............',
  ],
];
const stickyplop = mk(12, 12, stickyplopFrames);

// Halo of Crumbs: a glowing gold disc
const haloFrames: string[][] = [
  [
    '...444444...',
    '..42222224..',
    '..25555552..',
    '..25522552..',
    '..22552522..',
    '..22222222..',
    '..22552522..',
    '..25522552..',
    '..25555552..',
    '..42222224..',
    '...444444...',
    '............',
  ],
];
const halo = mk(12, 12, haloFrames);

// Slime Lake: a wide green lake zone
const slakelakeFrames: string[][] = [
  [
    '..44444444..',
    '.477777777..',
    '.755555575..',
    '.755555575..',
    '.755555575..',
    '.755555575..',
    '.755555575..',
    '.755555575..',
    '.755555575..',
    '.477777777..',
    '..44444444..',
    '............',
  ],
];
const slakelake = mk(12, 12, slakelakeFrames);

// Bouncy Poop: a rubbery brown ball, 2 bounce frames
const bouncyFrames: string[][] = [
  [
    '...4444...',
    '.4dddddd..',
    '..dd55dd..',
    '.dd5555dd.',
    'ddddddddd.',
    '..dd55dd..',
    '.4dddddd..',
    '..444444..',
    '..........',
    '..........',
  ],
  [
    '...4444...',
    '.4dddddd..',
    '.d5555dd..',
    '.d555555d.',
    '.dddddddd.',
    '.d5555dd..',
    '.4dddddd..',
    '..444444..',
    '..........',
    '..........',
  ],
];
const bouncy = mk(10, 10, bouncyFrames);

// Stink Aura: a wavy stink cloud puff
const stinkauraFrames: string[][] = [
  [
    '....44....',
    '...4dd4...',
    '..dddddd..',
    '..dd55dd..',
    '..dd55dd..',
    '..dddddd..',
    '...4dd4...',
    '....44....',
    '..........',
    '..........',
  ],
];
const stinkaura = mk(10, 10, stinkauraFrames);

// Fart Bomb: a round bomb with a fuse
const fartbombFrames: string[][] = [
  [
    '....4.....',
    '...444....',
    '...4ddd...',
    '..ddddd...',
    '..ddddd...',
    '..ddddd...',
    '...4ddd...',
    '...444....',
    '..........',
    '..........',
  ],
];
const fartbomb = mk(10, 10, fartbombFrames);

// Orbiting Turd: the classic swirl, 2 frames
const turdFrames: string[][] = [
  [
    '..444444..',
    '.4dddddd..',
    '.d5555dd..',
    '.d5555dd..',
    '.4dddddd..',
    '..dd44dd..',
    '.4dddddd..',
    '..444444..',
    '..........',
    '..........',
  ],
  [
    '..444444..',
    '.4dddddd..',
    '.d5555dd..',
    '.d5555dd..',
    '.4dddddd..',
    '..dd44dd..',
    '.4dddddd..',
    '..444444..',
    '..........',
    '..........',
  ],
];
const turd = mk(10, 10, turdFrames);

// Superball Splat: a fast elastic ball
const superballFrames: string[][] = [
  [
    '...4444...',
    '..4cccc4..',
    '..c5555c..',
    '..c5555c..',
    '.ccccccc..',
    '..c5555c..',
    '..c5555c..',
    '..4cccc4..',
    '...4444...',
    '..........',
  ],
];
const superball = mk(10, 10, superballFrames);

export const SPRITES: Record<string, Sprite> = {
  crouton, croutonHit, bubble, bubbleHit, gem, bolt,
  plop, cracker, boss, bossHit, chest,
  droplet, crumb, crumbHit, mop, mopHit, stink, stinkHit,
  sponge, spongeHit, colonel, colonelHit, constipation, constipationHit,
  express, expressHit, sphincter, sphincterHit, flush, flushHit,
  goldbag, donut,
  bouncy, stinkaura, fartbomb, turd,
  stickyplop, halo, slakelake, superball, ghost, bigburp, moon,
  hotdog, avocado,
};

// ---------- 8x8 bitmap font ----------
// Ink is the char '1' (rendered in the chosen color); '.' is blank.
function g(rows: string[]): string[] { return rows; }
const F: Record<string, string[]> = {
  A: g(['..111..','..1..1.','..1..1.','..111..','..1..1.','..1..1.','..1..1.','.......']),
  B: g(['..111..','..1..1.','..1..1.','..111..','..1..1.','..1..1.','..111..','.......']),
  C: g(['..111..','..1..1.','..1....','..1....','..1....','..1..1.','..111..','.......']),
  D: g(['..111..','..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','..111..','.......']),
  E: g(['..111..','..1....','..1....','..111..','..1....','..1....','..111..','.......']),
  F: g(['..111..','..1....','..1....','..111..','..1....','..1....','..1....','.......']),
  G: g(['..111..','..1..1.','..1....','..1..1.','..1..1.','..1..1.','..111..','.......']),
  H: g(['..1..1.','..1..1.','..1..1.','..111..','..1..1.','..1..1.','..1..1.','.......']),
  I: g(['.11111.','...1...','...1...','...1...','...1...','...1...','.11111.','.......']),
  J: g(['...11..','...1...','...1...','...1...','...1...','..11...','..1....','.......']),
  K: g(['..1..1.','..1.1..','..11...','..11...','..1.1..','..1..1.','..1..1.','.......']),
  L: g(['..1....','..1....','..1....','..1....','..1....','..1....','..111..','.......']),
  M: g(['..1..1.','..1.1..','..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','.......']),
  N: g(['..1..1.','..1..1.','..11.1.','..1.1..','..1..1.','..1..1.','..1..1.','.......']),
  O: g(['..111..','..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','..111..','.......']),
  P: g(['..111..','..1..1.','..111..','..1....','..1....','..1....','..1....','.......']),
  Q: g(['..111..','..1..1.','..1..1.','..1..1.','..1.1..','..1..1.','..11.1.','.......']),
  R: g(['..111..','..1..1.','..111..','..1.1..','..1..1.','..1..1.','..1..1.','.......']),
  S: g(['..111..','..1....','..1....','..111..','....1..','....1..','..111..','.......']),
  T: g(['..111..','...1...','...1...','...1...','...1...','...1...','...1...','.......']),
  U: g(['..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','..111..','.......']),
  V: g(['..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','...1...','...1...','.......']),
  W: g(['..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','..1.1..','..1..1.','.......']),
  X: g(['..1..1.','..1..1.','...1...','...1...','..1..1.','..1..1.','..1..1.','.......']),
  Y: g(['..1..1.','..1..1.','...1...','...1...','...1...','...1...','...1...','.......']),
  Z: g(['..111..','....1..','...1...','..1....','..1....','..1....','..111..','.......']),
  '0': g(['..111..','..1..1.','..1..1.','..1..1.','..1..1.','..1..1.','..111..','.......']),
  '1': g(['...1...','..11...','...1...','...1...','...1...','...1...','.1111..','.......']),
  '2': g(['..111..','....1..','...1...','..1....','..1....','..1....','..111..','.......']),
  '3': g(['..111..','....1..','...1...','..111..','....1..','....1..','..111..','.......']),
  '4': g(['...11..','...11..','...11..','..111..','...1...','...1...','...1...','.......']),
  '5': g(['..111..','..1....','..111..','....1..','....1..','....1..','..111..','.......']),
  '6': g(['..111..','..1....','..111..','..1..1.','..1..1.','..1..1.','..111..','.......']),
  '7': g(['..111..','....1..','...1...','...1...','..1....','..1....','..1....','.......']),
  '8': g(['.11.11.','..1.1..','..1.1..','.1111..','..1.1..','..1.1..','.11.11.','.......']),
  '9': g(['.111...','..1.11.','..1..1.','.11111.','....1..','....1..','.11111.','.......']),
  ' ': g(['.......','.......','.......','.......','.......','.......','.......','.......']),
  ':': g(['.......','...1...','...1...','.......','...1...','...1...','...1...','.......']),
  '-': g(['.......','.......','.......','..111..','.......','.......','.......','.......']),
  '/': g(['.....1.','.....1.','....1..','...1...','..1....','.1.....','.......','.......']),
  '|': g(['...1...','...1...','...1...','...1...','...1...','...1...','...1...','.......']),
  '!': g(['...1...','...1...','...1...','...1...','...1...','.......','...1...','.......']),
  '.': g(['.......','.......','.......','.......','.......','.......','..1....','..1....']),
  '+': g(['.......','...1...','...1...','.1111..','...1...','...1...','.......','.......']),
  ',': g(['.......','.......','.......','.......','.......','..1....','..1....','.1.....']),
  '(': g(['...1...','..1....','..1....','..1....','..1....','..1....','...1...','.......']),
  ')': g(['...1...','....1..','....1..','....1..','....1..','....1..','...1...','.......']),
  '[': g(['..111..','..1....','..1....','..1....','..1....','..1....','..111..','.......']),
  ']': g(['..111..','....1..','....1..','....1..','....1..','....1..','..111..','.......']),
  '?': g(['..111..','....1..','...1...','..1....','..1....','.......','..1....','.......']),
  '%': g(['.11..1.','....1..','...1...','...1...','..1....','..1....','.......','.......']),
};

export function drawSprite(
  ctx: CanvasRenderingContext2D, spr: Sprite, px: number, py: number, frame: number,
): void {
  const fr = spr.frames[((frame % spr.frames.length) + spr.frames.length) % spr.frames.length];
  for (let y = 0; y < spr.h; y++) {
    const row = fr[y];
    for (let x = 0; x < spr.w; x++) {
      const c = row[x];
      if (c === '.') continue;
      const idx = PAL_IDX[c];
      if (idx < 0) continue;
      ctx.fillStyle = PALETTE[idx];
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }
}

export function drawScaled(
  ctx: CanvasRenderingContext2D, spr: Sprite, px: number, py: number, scale: number, frame: number,
): void {
  const fr = spr.frames[((frame % spr.frames.length) + spr.frames.length) % spr.frames.length];
  for (let y = 0; y < spr.h; y++) {
    const row = fr[y];
    for (let x = 0; x < spr.w; x++) {
      const c = row[x];
      if (c === '.') continue;
      const idx = PAL_IDX[c];
      if (idx < 0) continue;
      ctx.fillStyle = PALETTE[idx];
      ctx.fillRect(px + x * scale, py + y * scale, scale, scale);
    }
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: number,
): void {
  // 0 = dark outline (default), 1 = white, 2 = medium brown (secondary text)
  const ink = style === 1 ? PALETTE[5] : style === 2 ? '#a5651d' : PALETTE[4];
  for (let i = 0; i < text.length; i++) {
    const glyph = F[text[i].toUpperCase()] ?? F['?'];
    for (let r = 0; r < 8; r++) {
      const row = glyph[r];
      for (let c = 0; c < 7; c++) {
        if (row[c] === '1') { ctx.fillStyle = ink; ctx.fillRect(x + i * 6 + c, y + r, 1, 1); }
      }
    }
  }
}
