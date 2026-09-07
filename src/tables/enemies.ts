// M19 phase 1: enemy archetypes + boss schedule/stats + spawn director script
// (extracted verbatim — the timeline IS the difficulty curve).

export const ENEMY_TYPES: Record<string, {
  hp: number; speed: number; dmg: number; radius: number; xp: number; kbResist?: number;
}> = {
  bubble:  { hp: 6,  speed: 34, dmg: 8,  radius: 5, xp: 1 },
  droplet: { hp: 4,  speed: 52, dmg: 6,  radius: 4, xp: 1 },
  crumb:   { hp: 30, speed: 20, dmg: 12, radius: 6, xp: 3 },
  mop:     { hp: 3,  speed: 40, dmg: 5,  radius: 4, xp: 1 },
  stink:   { hp: 60, speed: 16, dmg: 16, radius: 7, xp: 5 },
  sponge:  { hp: 40, speed: 24, dmg: 10, radius: 5, xp: 4 },
  splitter:{ hp: 26, speed: 22, dmg: 10, radius: 7, xp: 3 },
  spitter: { hp: 18, speed: 18, dmg: 8,  radius: 6, xp: 3 },
  // M13: kbResist = fraction of knockback ignored (0.7 = shrugs off 70%)
  boulder: { hp: 80, speed: 15, dmg: 16, radius: 8, xp: 6, kbResist: 0.75 },
  shell:   { hp: 36, speed: 26, dmg: 12, radius: 7, xp: 4, kbResist: 0.6 },
};

export const BOSS_SCHEDULE: Array<{ t: number; name: string; kind: string }> = [
  { t: 300,   name: 'THE FIRST WIND',      kind: 'wind' },
  { t: 600,   name: 'COLONEL C',           kind: 'colonel' },
  { t: 900,   name: 'THE CONSTIPATION',    kind: 'constipation' },
  { t: 1200,  name: 'THE DIARRHEA EXPRESS', kind: 'express' },
  { t: 1500,  name: 'MR. SPHINCTER',       kind: 'sphincter' },
  { t: 1650,  name: 'THE LINT KING',       kind: 'lintking' }, // M7: the penultimate horror
];

export const BOSS_STATS: Record<string, { hp: number; speed: number; dmg: number; radius: number }> = {
  wind:         { hp: 500,  speed: 26, dmg: 12, radius: 11 },
  colonel:      { hp: 1200, speed: 22, dmg: 14, radius: 12 },
  constipation: { hp: 2000, speed: 14, dmg: 16, radius: 13 },
  express:      { hp: 1400, speed: 55, dmg: 14, radius: 10 },
  sphincter:    { hp: 2600, speed: 20, dmg: 18, radius: 13 },
  lintking:     { hp: 1800, speed: 24, dmg: 13, radius: 12 }, // M7; M12: 2200→1800 HP, 16→13 contact (see GDD §25)
  flush:        { hp: 1200, speed: 30, dmg: 30, radius: 14 },
};

export const SCRIPT: Array<{ t: number; kind: string; weight: number }> = [
  { t: 0,     kind: 'bubble',  weight: 1.0 },
  { t: 60,    kind: 'droplet', weight: 0.5 },
  { t: 120,   kind: 'crumb',   weight: 0.4 },
  { t: 420,   kind: 'mop',     weight: 0.6 },
  { t: 720,   kind: 'stink',   weight: 0.35 },
  { t: 1020,  kind: 'sponge',  weight: 0.3 },
  { t: 1320,  kind: 'splitter', weight: 0.4 }, // M7: 22:00
  { t: 1620,  kind: 'spitter',  weight: 0.4 }, // M7: 27:00
  // M13: the heavy/KB-resistant join the late gauntlet
  { t: 1140,  kind: 'shell',    weight: 0.35 }, // 19:00
  { t: 1500,  kind: 'boulder',  weight: 0.3 },  // 25:00
];

