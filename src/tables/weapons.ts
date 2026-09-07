// M19 phase 1: weapons + passives + XP curve (extracted verbatim).
// Columns are raw table data; the scaling that applies them lives in main.ts
// (wDmg/wCd/wProjSpeed/wArea/wDuration) — balance lives HERE, mechanics there.

export const WEAPONS: Record<string, {
  name: string; desc: string; maxLvl: number;
  baseDmg: number; baseCd: number; dmgPerLvl: number; cdPerLvl: number;
  evolved: boolean;
  // evolution requirement (base maxed + this passive) → evolved weapon id
  evoWith?: string; evolvesTo?: string;
}> = {
  fartwhip:   { name: 'Fart Whip',    desc: 'Piercing gusts in your facing dir', maxLvl: 8, baseDmg: 10, baseCd: 1.6, dmgPerLvl: 3, cdPerLvl: -0.04, evolved: false, evoWith: 'quick', evolvesTo: 'superfart' },
  plopcannon: { name: 'Plop Cannon',  desc: 'Heavy aimed gunk blob',             maxLvl: 8, baseDmg: 22, baseCd: 2.4, dmgPerLvl: 8, cdPerLvl: -0.10, evolved: false, evoWith: 'sticky', evolvesTo: 'stickyplop' },
  crackerring:{ name: 'Cracker Ring', desc: 'Orbiting cracker shards',           maxLvl: 8, baseDmg: 6,  baseCd: 0.22, dmgPerLvl: 1.5, cdPerLvl: -0.004, evolved: false, evoWith: 'widestink', evolvesTo: 'halo' }, // M14: 3→1.5 — playtest round 2 item 3 (AFK-able to ~lvl 40): capped the DPS growth so the ring is defense + chip, not a mid-game solo-clearer (lvl8 27→16.5/tick, 141→86 DPS); halo evo untouched
  puddle:     { name: 'Puddle',       desc: 'Damaging puddles near you',         maxLvl: 8, baseDmg: 12, baseCd: 3.0, dmgPerLvl: 5, cdPerLvl: -0.06, evolved: false, evoWith: 'meats', evolvesTo: 'slakelake' },
  bouncy:     { name: 'Bouncy Poop',  desc: 'Bounces between enemies',           maxLvl: 8, baseDmg: 8,  baseCd: 1.2, dmgPerLvl: 4, cdPerLvl: -0.05, evolved: false, evoWith: 'gloves', evolvesTo: 'superball' },
  stinkaura:  { name: 'Stink Aura',   desc: 'Damages nearby enemies, passive',   maxLvl: 8, baseDmg: 4,  baseCd: 0.5, dmgPerLvl: 2, cdPerLvl: -0.02, evolved: false, evoWith: 'lucky', evolvesTo: 'ghost' },
  fartbomb:   { name: 'Fart Bomb',    desc: 'Big explosion at a random enemy',   maxLvl: 8, baseDmg: 35, baseCd: 3.5, dmgPerLvl: 10, cdPerLvl: -0.12, evolved: false, evoWith: 'breakfast', evolvesTo: 'bigburp' },
  turd:       { name: 'Orbiting Turd', desc: 'Heavy orbiting damage zone, slow', maxLvl: 8, baseDmg: 14, baseCd: 1.0, dmgPerLvl: 6, cdPerLvl: -0.03, evolved: false, evoWith: 'slippers', evolvesTo: 'moon' },
  spritz:     { name: 'Gunk Spritz',  desc: 'Short-range gunk cone',             maxLvl: 8, baseDmg: 9,  baseCd: 1.5, dmgPerLvl: 4, cdPerLvl: -0.03, evolved: false, evoWith: 'tp', evolvesTo: 'gunkfountain' },
  mine:       { name: 'Gunk Mine',    desc: 'Drops timed mines that blow up',    maxLvl: 8, baseDmg: 26, baseCd: 2.6, dmgPerLvl: 8, cdPerLvl: -0.08, evolved: false, evoWith: 'fuse', evolvesTo: 'minelord' },
  chainfart:  { name: 'Chain Fart',   desc: 'Zap that chains between enemies',   maxLvl: 8, baseDmg: 14, baseCd: 1.1, dmgPerLvl: 5, cdPerLvl: -0.03, evolved: false, evoWith: 'chain', evolvesTo: 'chainstorm' },
  gnat:       { name: 'Gnat',         desc: 'A chomping buddy that zaps for you',maxLvl: 8, baseDmg: 10, baseCd: 0.9, dmgPerLvl: 4, cdPerLvl: -0.04, evolved: false, evoWith: 'winged', evolvesTo: 'supergnat' },
  // ---------- M13: mechanics beyond shoot/orbit/ring ----------
  turret:     { name: 'Plop Turret',  desc: 'Drops a stationary turret that fires for you', maxLvl: 8, baseDmg: 14, baseCd: 1.0, dmgPerLvl: 5, cdPerLvl: -0.05, evolved: false, evoWith: 'ammo', evolvesTo: 'autoblast' },
  boomer:     { name: 'Gunk Boomer',  desc: 'Gunk boomerang: goes out, comes back for a 2nd hit', maxLvl: 8, baseDmg: 16, baseCd: 1.8, dmgPerLvl: 5, cdPerLvl: -0.05, evolved: false, evoWith: 'grip', evolvesTo: 'cyclone' },
  trail:      { name: 'Slime Trail',  desc: 'Leaves a damaging slime trail where you walk', maxLvl: 8, baseDmg: 6, baseCd: 0.18, dmgPerLvl: 2, cdPerLvl: -0.002, evolved: false, evoWith: 'slush', evolvesTo: 'quagmire' },
  // ---------- evolved weapons (chest-only, evolved: true) ----------
  superfart:   { name: 'SUPER FART',     desc: 'Wide devastating piercing beam', maxLvl: 8, baseDmg: 40, baseCd: 1.1, dmgPerLvl: 6, cdPerLvl: -0.02, evolved: true },
  stickyplop:  { name: 'Sticky Plop',    desc: 'Bigger blob, lingers, re-explodes', maxLvl: 8, baseDmg: 30, baseCd: 2.2, dmgPerLvl: 10, cdPerLvl: -0.08, evolved: true },
  halo:        { name: 'Halo of Crumbs', desc: 'Orbit ring becomes a damaging disc', maxLvl: 8, baseDmg: 10, baseCd: 0.2, dmgPerLvl: 5, cdPerLvl: -0.004, evolved: true },
  slakelake:   { name: 'Slime Lake',     desc: 'Big slow-zone that drags enemies in', maxLvl: 8, baseDmg: 20, baseCd: 2.5, dmgPerLvl: 8, cdPerLvl: -0.05, evolved: true },
  superball:   { name: 'Superball Splat', desc: '3 superballs, huge bounce range', maxLvl: 8, baseDmg: 16, baseCd: 0.9, dmgPerLvl: 8, cdPerLvl: -0.04, evolved: true },
  ghost:       { name: 'Ghost of Last Night', desc: 'Orbiting ghost that bites + auras', maxLvl: 8, baseDmg: 8, baseCd: 0.4, dmgPerLvl: 4, cdPerLvl: -0.02, evolved: true },
  bigburp:     { name: 'BIG BURP',       desc: 'Massive multi-target AOE', maxLvl: 8, baseDmg: 55, baseCd: 2.8, dmgPerLvl: 14, cdPerLvl: -0.1, evolved: true },
  moon:        { name: 'MOON OF THE BOWEL', desc: 'A full moon of doom circles you', maxLvl: 8, baseDmg: 24, baseCd: 0.8, dmgPerLvl: 10, cdPerLvl: -0.02, evolved: true },
  gunkfountain:{ name: 'GUNK FOUNTAIN',  desc: 'Radial gunk geyser + splash zone', maxLvl: 8, baseDmg: 12, baseCd: 1.2, dmgPerLvl: 5, cdPerLvl: -0.03, evolved: true },
  minelord:    { name: 'MINE LORD',      desc: 'Rains a field of fast-fusing mines', maxLvl: 8, baseDmg: 40, baseCd: 1.8, dmgPerLvl: 12, cdPerLvl: -0.05, evolved: true },
  chainstorm:  { name: 'CHAIN STORM',    desc: 'Lightning storms over the field', maxLvl: 8, baseDmg: 22, baseCd: 0.7, dmgPerLvl: 8, cdPerLvl: -0.02, evolved: true },
  supergnat:   { name: 'SUPER GNAT',     desc: 'A furious swarm that zaps nonstop', maxLvl: 8, baseDmg: 16, baseCd: 0.5, dmgPerLvl: 6, cdPerLvl: -0.02, evolved: true },
  // ---------- M13 evolutions ----------
  autoblast:   { name: 'AUTOBLAST',      desc: 'Turret fires a fast 3-way plop spread', maxLvl: 8, baseDmg: 12, baseCd: 0.5, dmgPerLvl: 4, cdPerLvl: -0.02, evolved: true },
  cyclone:     { name: 'CYCLONE',        desc: '3 gunk boomerangs, each rebounds again', maxLvl: 8, baseDmg: 14, baseCd: 1.4, dmgPerLvl: 4, cdPerLvl: -0.03, evolved: true },
  quagmire:    { name: 'QUAGMIRE',       desc: 'A wide choking muck that trails and lingers', maxLvl: 8, baseDmg: 10, baseCd: 0.15, dmgPerLvl: 3, cdPerLvl: -0.002, evolved: true },
};

export const PASSIVES: Record<string, { name: string; desc: string; maxLvl: number }> = {
  meats:      { name: 'Meat Shakes',    desc: '+10% weapon damage / lv', maxLvl: 5 },
  quick:      { name: 'Quick Hands',    desc: '-8% weapon cooldown / lv', maxLvl: 5 },
  slippers:   { name: 'Slippers',       desc: '+10% move speed / lv', maxLvl: 5 },
  tp:         { name: 'TP Crown',       desc: '+8% XP gain / lv', maxLvl: 5 },
  breakfast:  { name: 'Big Breakfast',  desc: '+25 max HP / lv (max 3)', maxLvl: 3 },
  gloves:     { name: 'Gloves',         desc: '+10% projectile speed / lv', maxLvl: 5 },
  widestink:  { name: 'Wide Stink',     desc: '+10% weapon area / lv', maxLvl: 5 },
  sticky:     { name: 'Sticky',         desc: '+10% duration / lv', maxLvl: 5 },
  lucky:      { name: 'Lucky Charms',   desc: '+10% luck / lv (evolution unlocks)', maxLvl: 5 },
  goldrush:   { name: 'Gold Rush',      desc: '+15% gold / lv (M7)', maxLvl: 5 },
  fuse:       { name: 'Fuse',           desc: '+20% mine blast radius / lv (M8)', maxLvl: 5 },
  chain:      { name: 'Chain',          desc: '+1 chain hop / lv (M8)', maxLvl: 5 },
  winged:     { name: 'Winged',       desc: '+1 gnat zap +speed / lv (M8)', maxLvl: 5 },
  ammo:       { name: 'Extra Ammo',   desc: '+1 turret plop / lv (M13)', maxLvl: 3 },
  grip:       { name: 'Boomer Grip',  desc: 'Boomer +range +1 rebound / lv (M13)', maxLvl: 3 },
  slush:      { name: 'Slush Pails',  desc: '+20% slime trail width / lv (M13)', maxLvl: 3 },
};

export function xpToNext(level: number): number {
  let base: number;
  if (level < 20) base = 5 + 10 * (level - 1);
  else if (level < 40) base = 185 + 13 * (level - 19);
  else base = 445 + 16 * (level - 39);
  // M14: smooth the 20/40 milestone walls. Pre-M14 they dumped a flat +600 /
  // +2400 onto a SINGLE transition — 20->21 = 798 (a 4.3x spike vs the 185
  // before / 224 after) and 40->41 = 2861 (a 6.4x spike vs 445/477). A normal
  // kill drip (1-6 XP each) cleared that in a minute, so the bar to 21/41 felt
  // "very slow exactly at 20/40, normal at 21/41" (playtest round 2, item 2:
  // "not linear"). The wall is a designed milestone moment (m1 pins the drop),
  // so keep it as THE single hardest level-up but cap the bump at ~2.5x the
  // surrounding slope — still clearly a wall, no dry spell.
  if (level === 20) base = Math.round(base * 2.5); // 198 -> 495 (was 798)
  if (level === 40) base = Math.round(base * 2.5); // 461 -> 1153 (was 2861)
  return base;
}

