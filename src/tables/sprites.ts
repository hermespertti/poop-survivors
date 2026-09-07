// M19 phase 1: sprite pick tables + unlock label copy (extracted verbatim).

export const ENEMY_SPR: Record<string, { spr: string; hit: string }> = {
  bubble: { spr: 'bubble', hit: 'bubbleHit' },
  droplet: { spr: 'droplet', hit: 'droplet' }, // single frame — no hit variant authored
  crumb: { spr: 'crumb', hit: 'crumbHit' },
  mop: { spr: 'mop', hit: 'mopHit' },
  stink: { spr: 'stink', hit: 'stinkHit' },
  sponge: { spr: 'sponge', hit: 'spongeHit' },
  splitter: { spr: 'splitter', hit: 'splitterHit' }, // M7
  spitter: { spr: 'spitter', hit: 'spitterHit' }, // M7
  boulder: { spr: 'boulder', hit: 'boulderHit' }, // M13
  shell: { spr: 'shell', hit: 'shellHit' }, // M13
};

export const BOSS_SPR: Record<string, { spr: string; hit: string }> = {
  wind: { spr: 'boss', hit: 'bossHit' },
  colonel: { spr: 'colonel', hit: 'colonelHit' },
  constipation: { spr: 'constipation', hit: 'constipationHit' },
  express: { spr: 'express', hit: 'expressHit' },
  sphincter: { spr: 'sphincter', hit: 'sphincterHit' },
  lintking: { spr: 'lintking', hit: 'lintkingHit' }, // M7
};

export const UNLOCK_LABEL: Record<string, string> = {
  survive5: 'THE BATHROOM', survive10: 'HOT DOG', kills500: 'AVOCADO', boss3: 'PLUNGER',
  minekill: 'CHEESE', goldrun: 'ONION', // M13
  compost: 'THE COMPOST', // M13
};

