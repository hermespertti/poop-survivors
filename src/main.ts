// POOP SURVIVORS — M2
// M1 core loop + the weapon FRAMEWORK: weapons as a data table, passive stat
// multipliers, knockback, a boss (The First Wind) at 3:00, and the chest →
// evolution system (Fart Whip max + Quick Hands + chest = SUPER FART).
// Top-down 2D canvas, fixed timestep, seeded determinism, __cap probe.
// Art: hand-authored pixel arrays over one 16-color palette, 8x8 bitmap font.

import { PALETTE, SPRITES, drawSprite, drawScaled, drawText } from './art';
import { sfx, toggleMute } from './sfx';

// ---------- deterministic RNG (mulberry32) ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- world / camera ----------
const TILE = 16;
const WORLD_W = 1280;
const WORLD_H = 800;
const VIEW_W = 320;
const VIEW_H = 240;

// ---------- player ----------
const PLAYER = {
  maxHp: 100, speed: 90, radius: 5,
  magnetBase: 26, magnetPerLevel: 1.5,
  invulnAfterHit: 0.8,
  invulnOnLevel: 1.2,
};

// ---------- XP curve (VS wiki). req N -> N+1 ----------
function xpToNext(level: number): number {
  let base: number;
  if (level < 20) base = 5 + 10 * (level - 1);
  else if (level < 40) base = 185 + 13 * (level - 19);
  else base = 445 + 16 * (level - 39);
  if (level === 20) base += 600;
  if (level === 40) base += 2400;
  return base;
}

// ---------- weapons (data table) ----------
// base dmg/cd, per-level deltas. Slot: 'weapon'. superfart is evolution-only.
const WEAPONS: Record<string, {
  name: string; desc: string; maxLvl: number;
  baseDmg: number; baseCd: number; dmgPerLvl: number; cdPerLvl: number;
  evolved: boolean;
  // evolution requirement (base maxed + this passive) → evolved weapon id
  evoWith?: string; evolvesTo?: string;
}> = {
  fartwhip:   { name: 'Fart Whip',    desc: 'Piercing gusts in your facing dir', maxLvl: 8, baseDmg: 10, baseCd: 1.6, dmgPerLvl: 3, cdPerLvl: -0.04, evolved: false, evoWith: 'quick', evolvesTo: 'superfart' },
  plopcannon: { name: 'Plop Cannon',  desc: 'Heavy aimed gunk blob',             maxLvl: 8, baseDmg: 22, baseCd: 2.4, dmgPerLvl: 8, cdPerLvl: -0.10, evolved: false, evoWith: 'sticky', evolvesTo: 'stickyplop' },
  crackerring:{ name: 'Cracker Ring', desc: 'Orbiting cracker shards',           maxLvl: 8, baseDmg: 6,  baseCd: 0.22, dmgPerLvl: 3, cdPerLvl: -0.004, evolved: false, evoWith: 'widestink', evolvesTo: 'halo' },
  puddle:     { name: 'Puddle',       desc: 'Damaging puddles near you',         maxLvl: 8, baseDmg: 12, baseCd: 3.0, dmgPerLvl: 5, cdPerLvl: -0.06, evolved: false, evoWith: 'meats', evolvesTo: 'slakelake' },
  bouncy:     { name: 'Bouncy Poop',  desc: 'Bounces between enemies',           maxLvl: 8, baseDmg: 8,  baseCd: 1.2, dmgPerLvl: 4, cdPerLvl: -0.05, evolved: false, evoWith: 'gloves', evolvesTo: 'superball' },
  stinkaura:  { name: 'Stink Aura',   desc: 'Damages nearby enemies, passive',   maxLvl: 8, baseDmg: 4,  baseCd: 0.5, dmgPerLvl: 2, cdPerLvl: -0.02, evolved: false, evoWith: 'lucky', evolvesTo: 'ghost' },
  fartbomb:   { name: 'Fart Bomb',    desc: 'Big explosion at a random enemy',   maxLvl: 8, baseDmg: 35, baseCd: 3.5, dmgPerLvl: 10, cdPerLvl: -0.12, evolved: false, evoWith: 'breakfast', evolvesTo: 'bigburp' },
  turd:       { name: 'Orbiting Turd', desc: 'Heavy orbiting damage zone, slow', maxLvl: 8, baseDmg: 14, baseCd: 1.0, dmgPerLvl: 6, cdPerLvl: -0.03, evolved: false, evoWith: 'slippers', evolvesTo: 'moon' },
  // ---------- evolved weapons (chest-only, evolved: true) ----------
  superfart:   { name: 'SUPER FART',     desc: 'Wide devastating piercing beam', maxLvl: 8, baseDmg: 40, baseCd: 1.1, dmgPerLvl: 6, cdPerLvl: -0.02, evolved: true },
  stickyplop:  { name: 'Sticky Plop',    desc: 'Bigger blob, lingers, re-explodes', maxLvl: 8, baseDmg: 30, baseCd: 2.2, dmgPerLvl: 10, cdPerLvl: -0.08, evolved: true },
  halo:        { name: 'Halo of Crumbs', desc: 'Orbit ring becomes a damaging disc', maxLvl: 8, baseDmg: 10, baseCd: 0.2, dmgPerLvl: 5, cdPerLvl: -0.004, evolved: true },
  slakelake:   { name: 'Slime Lake',     desc: 'Big slow-zone that drags enemies in', maxLvl: 8, baseDmg: 20, baseCd: 2.5, dmgPerLvl: 8, cdPerLvl: -0.05, evolved: true },
  superball:   { name: 'Superball Splat', desc: '3 superballs, huge bounce range', maxLvl: 8, baseDmg: 16, baseCd: 0.9, dmgPerLvl: 8, cdPerLvl: -0.04, evolved: true },
  ghost:       { name: 'Ghost of Last Night', desc: 'Orbiting ghost that bites + auras', maxLvl: 8, baseDmg: 8, baseCd: 0.4, dmgPerLvl: 4, cdPerLvl: -0.02, evolved: true },
  bigburp:     { name: 'BIG BURP',       desc: 'Massive multi-target AOE', maxLvl: 8, baseDmg: 55, baseCd: 2.8, dmgPerLvl: 14, cdPerLvl: -0.1, evolved: true },
  moon:        { name: 'MOON OF THE BOWEL', desc: 'A full moon of doom circles you', maxLvl: 8, baseDmg: 24, baseCd: 0.8, dmgPerLvl: 10, cdPerLvl: -0.02, evolved: true },
};
const PASSIVES: Record<string, { name: string; desc: string; maxLvl: number }> = {
  meats:      { name: 'Meat Shakes',    desc: '+10% weapon damage / lv', maxLvl: 5 },
  quick:      { name: 'Quick Hands',    desc: '-8% weapon cooldown / lv', maxLvl: 5 },
  slippers:   { name: 'Slippers',       desc: '+10% move speed / lv', maxLvl: 5 },
  tp:         { name: 'TP Crown',       desc: '+8% XP gain / lv', maxLvl: 5 },
  breakfast:  { name: 'Big Breakfast',  desc: '+25 max HP / lv (max 3)', maxLvl: 3 },
  gloves:     { name: 'Gloves',         desc: '+10% projectile speed / lv', maxLvl: 5 },
  widestink:  { name: 'Wide Stink',     desc: '+10% weapon area / lv', maxLvl: 5 },
  sticky:     { name: 'Sticky',         desc: '+10% duration / lv', maxLvl: 5 },
  lucky:      { name: 'Lucky Charms',   desc: '+10% luck / lv (evolution unlocks)', maxLvl: 5 },
};

function wDmg(id: string, lvl: number): number { return (WEAPONS[id].baseDmg + WEAPONS[id].dmgPerLvl * (lvl - 1)) * G.stats.dmgMult; }
function wCd(id: string, lvl: number): number { return Math.max(0.15, (WEAPONS[id].baseCd + WEAPONS[id].cdPerLvl * (lvl - 1)) * G.stats.cdMult); }
// M4 scaling helpers: passives feed these (VS: weapons scale with these stats)
function wProjSpeed(v: number): number { return v * G.stats.projSpeedMult; }
function wArea(v: number): number { return v * G.stats.areaMult; }
function wDuration(v: number): number { return v * G.stats.durationMult; }

// ---------- characters (M4) ----------
const CHARACTERS: Record<string, {
  name: string; sprite: string; startWeapon: string;
  dmgBonus: number; speedBonus: number; armor: number; hpBonus: number; goldBonus: number; magnetBonus: number;
  unlock: string; unlockDesc: string;
}> = {
  crouton:  { name: 'Crouton',  sprite: 'crouton',  startWeapon: 'fartwhip',
              dmgBonus: 0.10, speedBonus: 0, armor: 0, hpBonus: 0, goldBonus: 0, magnetBonus: 0,
              unlock: 'default', unlockDesc: 'default' },
  hotdog:   { name: 'Hot Dog',  sprite: 'hotdog',   startWeapon: 'plopcannon',
              dmgBonus: 0, speedBonus: 0.15, armor: 0, hpBonus: 0, goldBonus: 0, magnetBonus: 0,
              unlock: 'survive10', unlockDesc: 'survive 10 min' },
  avocado:  { name: 'Avocado',  sprite: 'avocado',  startWeapon: 'puddle',
              dmgBonus: 0, speedBonus: 0, armor: 1, hpBonus: 0, goldBonus: 0, magnetBonus: 0,
              unlock: 'kills500', unlockDesc: 'kill 500 enemies' },
};

// ---------- enemies (M3 roster) ----------
type Enemy = {
  x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number;
  radius: number; xp: number; kind: string; hitT: number; wob: number;
  kbx: number; kbz: number;
};
// enemy archetype data table (per the GDD director script)
// bubble: chaser. droplet: fast thin. crumb: tanky slow. mop: swarmer (weak,
// many). stink: slow heavy cloud. sponge: shielded (takes half damage).
const ENEMY_TYPES: Record<string, {
  hp: number; speed: number; dmg: number; radius: number; xp: number;
}> = {
  bubble:  { hp: 6,  speed: 34, dmg: 8,  radius: 5, xp: 1 },
  droplet: { hp: 4,  speed: 52, dmg: 6,  radius: 4, xp: 1 },
  crumb:   { hp: 30, speed: 20, dmg: 12, radius: 6, xp: 3 },
  mop:     { hp: 3,  speed: 40, dmg: 5,  radius: 4, xp: 1 },
  stink:   { hp: 60, speed: 16, dmg: 16, radius: 7, xp: 5 },
  sponge:  { hp: 40, speed: 24, dmg: 10, radius: 5, xp: 4 },
};
// spawn-time HP scaling (VS: enemies get tankier over the run)
function enemyHp(kind: string): number {
  const base = ENEMY_TYPES[kind].hp;
  return base * (1 + G.time / 90);
}
type Gem = { x: number; z: number; val: number; vx: number; vz: number; pulled: boolean };
type Bullet = { x: number; z: number; vx: number; vz: number; life: number; dmg: number; ang: number; hitR: number; kind: string; bounces?: number; bounceSpeed?: number; linger?: number; hitIds?: number[] };
type Zone = { x: number; z: number; r: number; life: number; tick: number; dmg: number };
type DmgNum = { x: number; z: number; vy: number; t: number; txt: string; crit: boolean };
type Mode = 'title' | 'play' | 'levelup' | 'dead' | 'win';
type WState = { lvl: number; cd: number; ang: number };
type ItemOpt = { kind: 'weapon' | 'passive' | 'gold' | 'hp'; id: string; name: string; desc: string; lvl: number };

type Game = {
  seed: number; rng: () => number;
  mode: Mode; time: number;
  player: { x: number; z: number; hp: number; face: number; moving: boolean; invuln: number; walkT: number };
  enemies: Enemy[]; gems: Gem[]; bullets: Bullet[]; zones: Zone[]; dmgNums: DmgNum[]; items: Item[];
  xp: number; level: number; xpNeed: number; gold: number;
  weapons: Record<string, WState>;
  passives: Record<string, number>;
  boss: Boss | null; chest: { x: number; z: number } | null;
  bossIdx: number;
  flush: { x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number; radius: number; hitT: number; wob: number } | null;
  flushResolved: boolean; flushed: boolean;
  wall: Enemy[];
  options: ItemOpt[];
  flashT: number; shake: number; evolutionT: number; evolved: boolean;
  kills: number; bossKilled: number;
  stats: {
    maxLevel: number; levelUps: number; gems: number; nan: number;
    shots: Record<string, number>; kbApplied: number; chestTaken: number; itemTaken: number;
    dmgMult: number; cdMult: number; speedMult: number; xpMult: number;
    projSpeedMult: number; areaMult: number; durationMult: number; maxHp: number;
  };
  spawnCd: number; spawnInterval: number; waveIdx: number; itemIdx: number;
  char: string; stage: string; armor: number;
};

// ---------- meta (M4): gold + unlocks persist across runs (localStorage) ----------
const META_KEY = 'poop-survivors-meta';
type Meta = { gold: number; unlocked: string[]; achievements: string[]; bestTime: number; bestKills: number };
function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) { const m = JSON.parse(raw); if (m && Array.isArray(m.unlocked)) return m as Meta; }
  } catch {}
  return { gold: 0, unlocked: ['crouton'], achievements: [], bestTime: 0, bestKills: 0 };
}
function saveMeta(m: Meta): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
}
let META: Meta = loadMeta();
// stage selection: 'kitchen' (default) or 'bathroom' (unlocked via meta)
const STAGES: Record<string, { name: string; unlock: string; tileA: string; tileB: string; scriptShift: number }> = {
  kitchen:  { name: 'The Kitchen',   unlock: 'default', tileA: '#f3e2b8', tileB: '#e8cf94', scriptShift: 0 },
  bathroom: { name: 'The Bathroom',  unlock: 'survive5', tileA: '#cfe8f6', tileB: '#a5cde6', scriptShift: 60 },
};
let selectedChar = 'crouton';
let selectedStage = 'kitchen';

let G: Game = mkGame(1);
function mkGame(seed: number): Game {
  const rng = mulberry32(seed);
  const ch = CHARACTERS[selectedChar];
  const st = STAGES[selectedStage];
  return {
    seed, rng, mode: 'title', time: 0,
    player: { x: WORLD_W / 2, z: WORLD_H / 2, hp: PLAYER.maxHp, face: 0, moving: false, invuln: 0, walkT: 0 },
    enemies: [], gems: [], bullets: [], zones: [], dmgNums: [], items: [],
    xp: 0, level: 1, xpNeed: xpToNext(1), gold: 0,
    weapons: { [ch.startWeapon]: { lvl: 1, cd: 0, ang: 0 } },
    passives: {},
    boss: null, chest: null, bossIdx: 0,
    flush: null, flushResolved: false, flushed: false, wall: [],
    options: [], flashT: 0, shake: 0, evolutionT: 0, evolved: false,
    kills: 0, bossKilled: 0,
    stats: { maxLevel: 1, levelUps: 0, gems: 0, nan: 0, shots: {}, kbApplied: 0, chestTaken: 0, itemTaken: 0, dmgMult: 1 + ch.dmgBonus, cdMult: 1, speedMult: 1 + ch.speedBonus, xpMult: 1, projSpeedMult: 1, areaMult: 1, durationMult: 1, maxHp: PLAYER.maxHp + ch.hpBonus },
    spawnCd: 1.0, spawnInterval: 1.1, waveIdx: 0, itemIdx: 0,
    char: selectedChar, stage: selectedStage, armor: ch.armor,
  };
}

function recomputeStats(): void {
  const p = (id: string) => G.passives[id] || 0;
  G.stats.dmgMult = 1 + 0.10 * p('meats');
  G.stats.cdMult = Math.max(0.3, 1 - 0.08 * p('quick'));
  G.stats.speedMult = 1 + 0.10 * p('slippers');
  G.stats.xpMult = 1 + 0.08 * p('tp');
  G.stats.projSpeedMult = 1 + 0.10 * p('gloves');
  G.stats.areaMult = 1 + 0.10 * p('widestink');
  G.stats.durationMult = 1 + 0.10 * p('sticky');
  G.stats.maxHp = PLAYER.maxHp + 25 * p('breakfast');
  if (G.player.hp > G.stats.maxHp) G.player.hp = G.stats.maxHp;
}

// ---------- input ----------
const keys = new Set<string>();
let _prevKeys = new Set<string>();
let _nowKeys = new Set<string>();
let botDir = { x: 0, y: 0 };
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function syncKeys() { _prevKeys = _nowKeys; _nowKeys = new Set(keys); }
function justPressed(k: string): boolean { return _nowKeys.has(k) && !_prevKeys.has(k); }
function keyIndex(...ks: string[]): number {
  for (let i = 0; i < ks.length; i++) if (justPressed(ks[i])) return i;
  return -1;
}
// ---------- mouse/touch move (click-and-hold steers the player) ----------
// While a pointer (mouse LMB or touch) is held, the player walks toward the
// cursor's world position. Touch also taps the level-up options.
let pointerHeld = false;
let pointerWorld: { x: number; z: number } | null = null;
function screenToWorld(sx: number, sy: number): { x: number; z: number } {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  const offX = (window.innerWidth - VIEW_W * scale) / 2;
  const offY = (window.innerHeight - VIEW_H * scale) / 2;
  return { x: (sx - offX) / scale, z: (sy - offY) / scale };
}
const canvasEl = (document.getElementById('c') as HTMLCanvasElement);
canvasEl.addEventListener('pointerdown', (e: PointerEvent) => {
  pointerHeld = true;
  const w = screenToWorld(e.clientX, e.clientY);
  pointerWorld = w;
  if (G.mode === 'levelup') {
    // tap the option row (mobile level-up)
    const rowH = 44, top = 36;
    const idx = Math.floor((w.z - top) / rowH);
    if (idx >= 0 && idx < G.options.length) { pickOption(idx); pointerHeld = false; return; }
  }
  e.preventDefault();
});
canvasEl.addEventListener('pointermove', (e: PointerEvent) => {
  if (!pointerHeld) return;
  pointerWorld = screenToWorld(e.clientX, e.clientY);
});
window.addEventListener('pointerup', () => { pointerHeld = false; pointerWorld = null; });
canvasEl.style.touchAction = 'none';
function currentMove(): [number, number] {
  if (pointerHeld && pointerWorld) {
    // walk toward the cursor: direction from player to pointer world pos
    const dx = pointerWorld.x - G.player.x, dz = pointerWorld.z - G.player.z;
    const d = Math.hypot(dx, dz);
    if (d > 3) return [dx / d, dz / d];
    return [0, 0];
  }
  if (botDir.x !== 0 || botDir.y !== 0) return [botDir.x, botDir.y];
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  return [x, y];
}

// ---------- level up (VS rules, simplified) ----------
function weaponCount(): number { return Object.keys(G.weapons).filter((id) => !WEAPONS[id].evolved).length; }
function passiveCount(): number { return Object.keys(G.passives).length; }
function buildOptions(): ItemOpt[] {
  const opts: ItemOpt[] = [];
  for (const id of Object.keys(WEAPONS)) {
    if (WEAPONS[id].evolved) continue;
    const w = G.weapons[id];
    if (w) { if (w.lvl < WEAPONS[id].maxLvl) opts.push({ kind: 'weapon', id, name: WEAPONS[id].name, desc: 'Upgrade ' + WEAPONS[id].name, lvl: w.lvl }); }
    else if (weaponCount() < 6) opts.push({ kind: 'weapon', id, name: WEAPONS[id].name, desc: WEAPONS[id].desc, lvl: 1 });
  }
  for (const id of Object.keys(PASSIVES)) {
    const lvl = G.passives[id] || 0;
    if (lvl > 0) { if (lvl < PASSIVES[id].maxLvl) opts.push({ kind: 'passive', id, name: PASSIVES[id].name, desc: 'Upgrade ' + PASSIVES[id].name, lvl }); }
    else if (passiveCount() < 6) opts.push({ kind: 'passive', id, name: PASSIVES[id].name, desc: PASSIVES[id].desc, lvl: 1 });
  }
  if (opts.length === 0) {
    opts.push({ kind: 'hp', id: 'hp', name: 'Donut', desc: 'Restore 25 HP', lvl: 0 });
    opts.push({ kind: 'gold', id: 'gold', name: 'Golden Scoop', desc: '+50 Gold', lvl: 0 });
    return opts;
  }
  // VS: show 3 options. Guarantee at least one FRESH pick (a weapon/passive the
  // bot doesn't own yet) so a build can actually diversify — a pure owned-upgrade
  // pool lets a single weapon snowball and starve the player of new tools.
  const shuf = (a: ItemOpt[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(G.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ownedUp = opts.filter((o) => (o.kind === 'weapon' && G.weapons[o.id]) || (o.kind === 'passive' && G.passives[o.id]));
  const fresh = opts.filter((o) => !ownedUp.includes(o));
  const freshWeapons = fresh.filter((o) => o.kind === 'weapon');
  const freshOther = fresh.filter((o) => o.kind !== 'weapon');
  let result: ItemOpt[];
  if (fresh.length >= 2) {
    // one fresh weapon (if any) + one other fresh + one owned upgrade
    result = [
      shuf(freshWeapons)[0] || shuf(freshOther)[0],
      shuf(fresh)[0],
      shuf(ownedUp)[0] || shuf(fresh)[1],
    ];
  } else if (fresh.length === 1) {
    result = [fresh[0], shuf(ownedUp)[0], shuf(ownedUp)[1] || shuf(fresh)[0]];
  } else {
    result = shuf(ownedUp).slice(0, 3);
  }
  // de-dup by id (guard against a single-option pool)
  const seen = new Set<string>();
  result = result.filter((o) => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
  return result.length ? result : shuf(opts).slice(0, 3);
}
function pickOption(i: number): void {
  const o = G.options[i];
  if (!o) return;
  if (o.kind === 'weapon') {
    if (G.weapons[o.id]) G.weapons[o.id].lvl++;
    else G.weapons[o.id] = { lvl: 1, cd: 0, ang: G.rng() * 6.28 };
  } else if (o.kind === 'passive') {
    G.passives[o.id] = (G.passives[o.id] || 0) + 1;
    recomputeStats();
  } else if (o.kind === 'hp') {
    G.player.hp = Math.min(PLAYER.maxHp, G.player.hp + 25);
  } else if (o.kind === 'gold') {
    G.gold += 50;
  }
  G.mode = 'play';
  G.player.hp = PLAYER.maxHp; // VS rule: leveling up restores health
  G.player.invuln = Math.max(G.player.invuln, PLAYER.invulnOnLevel);
  G.flashT = 0.25;
}

// ---------- combat helpers ----------
function nearestEnemy(maxD = 1e9): { e: Enemy; d: number } | null {
  let best: Enemy | null = null, bd = maxD;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - G.player.x, e.z - G.player.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}
// for bouncy ricochets: nearest enemy from a POINT, excluding one enemy
function nearestEnemyExcluding(ex: Enemy, maxD: number): { e: Enemy; d: number } | null {
  let best: Enemy | null = null, bd = maxD;
  for (const e of G.enemies) {
    if (e === ex || e.hp <= 0) continue;
    const d = Math.hypot(e.x - ex.x, e.z - ex.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}
function damageEnemy(e: Enemy, dmg: number, srcX: number, srcZ: number): void {
  e.hp -= dmg; e.hitT = 0.12;
  if (e.hitT >= 0.12) sfx('hit'); // only on fresh contact (not every re-hit)
  G.dmgNums.push({ x: e.x, z: e.z - 6, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  // knockback, away from the hit source (VS-style; boss resists)
  const dx = e.x - srcX, dz = e.z - srcZ;
  const d = Math.hypot(dx, dz) || 1;
  e.kbx += (dx / d) * 70; e.kbz += (dz / d) * 70;
  G.stats.kbApplied++;
  if (e.hp <= 0) {
    G.kills++;
    const idx = G.enemies.indexOf(e);
    if (idx >= 0) G.enemies.splice(idx, 1);
    G.gems.push({ x: e.x, z: e.z, val: e.xp, vx: (G.rng() - 0.5) * 40, vz: (G.rng() - 0.5) * 40, pulled: false });
  }
}

// ---------- weapon firing ----------
function fireWeapons(): void {
  const p = G.player;
  for (const id of Object.keys(G.weapons)) {
    const w = G.weapons[id];
    w.cd -= DT;
    if (id === 'crackerring') {
      // continuous orbit: a full 2π ring at radius r — hit everything in the band.
      // Shards are the visual (and the thing that knocks); the band is the damage.
      // The angle advances EVERY tick (smooth spin); damage stays on its own cadence.
      const spd = 2.0 + 0.15 * (w.lvl - 1);
      w.ang += spd * DT;
      const r = 34 + 2 * w.lvl;
      const band = 13; // ring thickness (VS aura)
      orbitPos = { x: p.x + Math.cos(w.ang) * r, z: p.z + Math.sin(w.ang) * r, r: r + 6 };
      if (w.cd <= 0) {
        w.cd = wCd('crackerring', w.lvl);
        G.stats.shots['crackerring'] = (G.stats.shots['crackerring'] || 0) + 1;
        const dmg = wDmg('crackerring', w.lvl);
        for (const e of G.enemies) {
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (Math.abs(d - r) < band + e.radius) damageEnemy(e, dmg, p.x, p.z);
        }
        for (let wi = G.wall.length - 1; wi >= 0; wi--) {
          const e = G.wall[wi];
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (Math.abs(d - r) < band + e.radius) damageWall(e, dmg, p.x, p.z, wi);
        }
        // boss (resists knockback, same as before)
        if (G.boss) {
          const d = Math.hypot(G.boss.x - p.x, G.boss.z - p.z);
          if (Math.abs(d - r) < band + G.boss.radius) hitBoss(dmg, p.x, p.z);
        }
        if (G.flush) {
          const d = Math.hypot(G.flush.x - p.x, G.flush.z - p.z);
          if (Math.abs(d - r) < band + G.flush.radius) hitFlush(dmg, p.x, p.z);
        }
      }
      continue;
    }
    if (id === 'puddle') {
      if (w.cd <= 0) {
        w.cd = wCd('puddle', w.lvl);
        G.stats.shots['puddle'] = (G.stats.shots['puddle'] || 0) + 1;
        const a = G.rng() * Math.PI * 2, d = 20 + G.rng() * 50;
        G.zones.push({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, r: 30 + 6 * w.lvl, life: 4, tick: 0.5, dmg: wDmg('puddle', w.lvl) });
      }
      continue;
    }
    if (id === 'stinkaura' || id === 'ghost') {
      // passive aura: a zone centered on the player, ticking — no aiming
      if (w.cd <= 0) {
        w.cd = wCd(id, w.lvl);
        G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
        const r = id === 'ghost' ? 26 : 22 + 2 * w.lvl;
        G.zones.push({ x: p.x, z: p.z, r, life: 0.5, tick: 0.5, dmg: wDmg(id, w.lvl) });
      }
      continue;
    }
    if (id === 'turd' || id === 'moon') {
      // heavy slow orbit: a damage zone that circles the player (opposite dir)
      // The angle advances EVERY tick (smooth spin); damage stays on its own cadence.
      const spd = id === 'moon' ? 1.6 : 1.2;
      w.ang -= spd * DT; // counter-rotate against the cracker ring
      const r = id === 'moon' ? 55 + 3 * w.lvl : 30 + 2 * w.lvl;
      const rr = id === 'moon' ? 12 : 8;
      const ox = p.x + Math.cos(w.ang) * r, oz = p.z + Math.sin(w.ang) * r;
      orbit2Pos = { x: ox, z: oz, r: rr };
      if (w.cd <= 0) {
        w.cd = wCd(id, w.lvl);
        G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
        for (const e of G.enemies) {
          if (Math.hypot(e.x - ox, e.z - oz) < rr + e.radius) damageEnemy(e, wDmg(id, w.lvl), ox, oz);
        }
        for (let wi = G.wall.length - 1; wi >= 0; wi--) {
          const e = G.wall[wi];
          if (Math.hypot(e.x - ox, e.z - oz) < rr + e.radius) damageWall(e, wDmg(id, w.lvl), ox, oz, wi);
        }
        if (G.boss && Math.hypot(G.boss.x - ox, G.boss.z - oz) < rr + G.boss.radius) hitBoss(wDmg(id, w.lvl), ox, oz);
        if (G.flush && Math.hypot(G.flush.x - ox, G.flush.z - oz) < rr + G.flush.radius) hitFlush(wDmg(id, w.lvl), ox, oz);
      }
      continue;
    }
    if (w.cd > 0) continue;
    const n = nearestEnemy(240);
    if (!n) continue;
    p.face = Math.atan2(n.e.z - p.z, n.e.x - p.x);
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    if (id === 'fartwhip') {
      const count = Math.min(3, 1 + Math.floor(w.lvl / 3));
      for (let k = 0; k < count; k++) {
        const a = p.face + (k - (count - 1) / 2) * 0.14;
        G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(a) * 300), vz: wProjSpeed(Math.sin(a) * 300), life: wDuration(0.9), dmg: wDmg('fartwhip', w.lvl), ang: a, hitR: wArea(3), kind: 'whip' });
      }
    } else if (id === 'plopcannon') {
      G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(p.face) * 170), vz: wProjSpeed(Math.sin(p.face) * 170), life: wDuration(1.6), dmg: wDmg('plopcannon', w.lvl), ang: p.face, hitR: wArea(5), kind: 'plop' });
    } else if (id === 'superfart') {
      for (let k = 0; k < 3; k++) {
        const a = p.face + (k - 1) * 0.22;
        G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(a) * 340), vz: wProjSpeed(Math.sin(a) * 340), life: wDuration(1.3), dmg: wDmg('superfart', w.lvl), ang: a, hitR: wArea(8), kind: 'superfart' });
      }
    } else if (id === 'bouncy' || id === 'superball') {
      const count = id === 'superball' ? 3 : 1;
      for (let k = 0; k < count; k++) {
        const a = p.face + (k - (count - 1) / 2) * 0.3;
        const spd = wProjSpeed(240);
        G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, life: wDuration(2.4), dmg: wDmg(id, w.lvl), ang: a, hitR: wArea(4), kind: 'bouncy', bounces: id === 'superball' ? 8 : 3, bounceSpeed: spd });
      }
    } else if (id === 'fartbomb' || id === 'bigburp') {
      const tgt = G.enemies.length ? G.enemies[Math.floor(G.rng() * G.enemies.length)] : null;
      const tx = tgt ? tgt.x : p.x + G.rng() * 100 - 50, tz = tgt ? tgt.z : p.z + G.rng() * 100 - 50;
      const r = wArea(id === 'bigburp' ? 60 : 40);
      G.zones.push({ x: tx, z: tz, r, life: wDuration(0.6), tick: 0.25, dmg: wDmg(id, w.lvl) });
    } else if (id === 'stickyplop') {
      G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(p.face) * 150), vz: wProjSpeed(Math.sin(p.face) * 150), life: wDuration(1.6), dmg: wDmg('stickyplop', w.lvl), ang: p.face, hitR: wArea(6), kind: 'stickyplop', linger: 3 });
    }
  }
}

// ---------- bosses (M3 schedule) ----------
// 5 bosses on the script + THE FINAL FLUSH at 30:00. Each boss has its own
// behavior; killing one drops a chest (10:00+ chests are evolution-grade).
const BOSS_SCHEDULE: Array<{ t: number; name: string; kind: string }> = [
  { t: 300,   name: 'THE FIRST WIND',      kind: 'wind' },
  { t: 600,   name: 'COLONEL C',           kind: 'colonel' },
  { t: 900,   name: 'THE CONSTIPATION',    kind: 'constipation' },
  { t: 1200,  name: 'THE DIARRHEA EXPRESS', kind: 'express' },
  { t: 1500,  name: 'MR. SPHINCTER',       kind: 'sphincter' },
];
type Boss = {
  x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number;
  radius: number; hitT: number; minionCd: number; wob: number;
  kind: string; name: string; phase2: boolean; chargeCd: number; dashT: number;
  aimT: number; lockAng: number;
};
// boss behavior data per kind
const BOSS_STATS: Record<string, { hp: number; speed: number; dmg: number; radius: number }> = {
  wind:         { hp: 500,  speed: 26, dmg: 12, radius: 11 },
  colonel:      { hp: 1200, speed: 22, dmg: 14, radius: 12 },
  constipation: { hp: 2000, speed: 14, dmg: 16, radius: 13 },
  express:      { hp: 1400, speed: 55, dmg: 14, radius: 10 },
  sphincter:    { hp: 2600, speed: 20, dmg: 18, radius: 13 },
  flush:        { hp: 1200, speed: 30, dmg: 30, radius: 14 },
};
function spawnBoss(kind: string, name: string): void {
  const st = BOSS_STATS[kind];
  const ang = G.rng() * Math.PI * 2;
  const hp = st.hp * (1 + G.time / 600); // mild TIME scaling (not level — level rewards slow play)
  sfx('boss');
  G.boss = {
    x: Math.max(20, Math.min(WORLD_W - 20, G.player.x + Math.cos(ang) * 200)),
    z: Math.max(20, Math.min(WORLD_H - 20, G.player.z + Math.sin(ang) * 200)),
    hp, maxHp: hp, speed: st.speed, dmg: st.dmg, radius: st.radius,
    hitT: 0, minionCd: 4, wob: 0, kind, name, phase2: false, chargeCd: 0, dashT: 0, aimT: 0, lockAng: 0,
  };
}
function hitBoss(dmg: number, srcX: number, srcZ: number): void {
  const b = G.boss;
  if (!b) return;
  b.hp -= dmg; b.hitT = 0.1;
  G.dmgNums.push({ x: b.x, z: b.z - 10, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  if (b.hp <= 0) {
    G.boss = null;
    G.bossKilled++;
    // BOSS DROPS (VS rule): a chest ALWAYS + a gold bag. Chests from the
    // 10:00+ bosses (COLONEL C onward) are evolution-grade (they can resolve
    // an evolution); earlier chests fall through to gold+heal if no evo.
    G.chest = { x: b.x, z: b.z };
    G.items.push({ x: b.x + 20, z: b.z, kind: 'gold' });
    G.shake = 10; G.flashT = 0.4;
  }
}
// wall units are tanky; killing one leaves a gap (the wall is just an array)
function damageWall(e: Enemy, dmg: number, srcX: number, srcZ: number, idx: number): void {
  e.hp -= dmg; e.hitT = 0.12;
  G.dmgNums.push({ x: e.x, z: e.z - 6, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  const dx = e.x - srcX, dz = e.z - srcZ;
  const d = Math.hypot(dx, dz) || 1;
  e.kbx += (dx / d) * 20; e.kbz += (dz / d) * 20; // wall resists knockback
  if (e.hp <= 0) {
    G.wall.splice(idx, 1);
    G.kills++;
  }
}
// THE FINAL FLUSH: killable → victory + bonus gold; touching you → flushed
function hitFlush(dmg: number, srcX: number, srcZ: number): void {
  const f = G.flush;
  if (!f) return;
  f.hp -= dmg; f.hitT = 0.1;
  G.dmgNums.push({ x: f.x, z: f.z - 12, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  if (f.hp <= 0) {
    G.flush = null;
    G.gold += 500; // bonus gold for killing the Flush
    endRun(true, false);
    G.shake = 12; G.flashT = 0.5;
  }
}

// ---------- evolution (M4: generalized — any evo-ready base + its passive) ----------
function evoReady(): { baseId: string; toId: string } | null {
  for (const id of Object.keys(WEAPONS)) {
    const w = WEAPONS[id];
    if (w.evolved || !w.evoWith || !w.evolvesTo) continue;
    if ((G.weapons[id]?.lvl || 0) >= w.maxLvl && (G.passives[w.evoWith] || 0) >= 1) {
      return { baseId: id, toId: w.evolvesTo };
    }
  }
  return null;
}
function resolveChest(): void {
  G.stats.chestTaken++;
  const rdy = evoReady();
  if (rdy && !G.evolved) {
    // the chest offers the evolution: base removed, passive consumed (VS rule)
    delete G.weapons[rdy.baseId];
    G.weapons[rdy.toId] = { lvl: 1, cd: 0, ang: G.rng() * 6.28 };
    // consume the required passive (wiki-verified)
    const req = WEAPONS[rdy.baseId].evoWith!;
    G.passives[req] = (G.passives[req] || 1) - 1;
    if (G.passives[req] <= 0) delete G.passives[req];
    recomputeStats();
    G.evolved = true;
    G.evolutionT = 2.2;
    G.flashT = 0.5; G.shake = 8;
    sfx('evolution');
    lastEvo = { base: rdy.baseId, passive: req, to: rdy.toId };
  } else {
    G.gold += 50;
    G.player.hp = Math.min(PLAYER.maxHp, G.player.hp + 25);
    sfx('chest');
  }
  G.chest = null;
}

// ---------- spawning (M3 director) ----------
// The director script is a fixed event timeline (VS rule #5: escalation is a
// script, not a sim). Enemy types unlock on schedule; density scales on script;
// wave bursts repeat. spawnEnemy(kind) is the single entry point.
// script: [time, kind, weight] — weight = share of spawns while active
const SCRIPT: Array<{ t: number; kind: string; weight: number }> = [
  { t: 0,     kind: 'bubble',  weight: 1.0 },
  { t: 60,    kind: 'droplet', weight: 0.5 },
  { t: 120,   kind: 'crumb',   weight: 0.4 },
  { t: 420,   kind: 'mop',     weight: 0.6 },
  { t: 720,   kind: 'stink',   weight: 0.35 },
  { t: 1020,  kind: 'sponge',  weight: 0.3 },
];
// density spikes (30s of extra spawns): first at 12:00, repeats every 2 min
const SPIKE_T = 720; // 12:00
const SPIKE_EVERY = 120; // every 2 min after
// active kinds at time T (all kinds whose unlock time has passed)
function activeKinds(): string[] {
  return SCRIPT.filter((s) => G.time >= s.t).map((s) => s.kind);
}
// pick a kind by weight among active kinds
function pickKind(): string {
  const kinds = activeKinds();
  let total = 0;
  for (const k of kinds) total += SCRIPT.find((s) => s.kind === k)!.weight;
  let r = G.rng() * total;
  for (const k of kinds) {
    const w = SCRIPT.find((s) => s.kind === k)!.weight;
    if (r < w) return k;
    r -= w;
  }
  return kinds[0] || 'bubble';
}
function spawnEnemy(kind: string): void {
  const p = G.player;
  const ang = G.rng() * Math.PI * 2;
  const dist = Math.max(VIEW_W, VIEW_H) / 2 + 40 + G.rng() * 60;
  let x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
  x = Math.max(8, Math.min(WORLD_W - 8, x));
  z = Math.max(8, Math.min(WORLD_H - 8, z));
  const t = ENEMY_TYPES[kind];
  const hp = enemyHp(kind);
  G.enemies.push({ x, z, hp, maxHp: hp, speed: t.speed, dmg: t.dmg, radius: t.radius, xp: t.xp, kind, hitT: 0, wob: G.rng() * 6.28, kbx: 0, kbz: 0 });
}
// wave burst: ring of N enemies around the player (the "swarm burst")
function spawnWave(n: number, kind?: string): void {
  const k = kind || pickKind();
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const dist = Math.max(VIEW_W, VIEW_H) / 2 + 20 + G.rng() * 20;
    const x = Math.max(8, Math.min(WORLD_W - 8, G.player.x + Math.cos(ang) * dist));
    const z = Math.max(8, Math.min(WORLD_H - 8, G.player.z + Math.sin(ang) * dist));
    const t = ENEMY_TYPES[k];
    const hp = enemyHp(k);
    G.enemies.push({ x, z, hp, maxHp: hp, speed: t.speed, dmg: t.dmg, radius: t.radius, xp: t.xp, kind: k, hitT: 0, wob: G.rng() * 6.28, kbx: 0, kbz: 0 });
  }
}
// THE SPASM WALL (15:00, with The Constipation): a slow ring of tanky crumb
// enemies closing around the player. You must break out — kill a gap and dash.
function spawnSpasmWall(): void {
  const n = 16;
  const st = ENEMY_TYPES.crumb;
  const ringR = Math.max(VIEW_W, VIEW_H) / 2 + 30;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const x = Math.max(8, Math.min(WORLD_W - 8, G.player.x + Math.cos(ang) * ringR));
    const z = Math.max(8, Math.min(WORLD_H - 8, G.player.z + Math.sin(ang) * ringR));
    const hp = st.hp * 3; // tanky wall units
    G.wall.push({ x, z, hp, maxHp: hp, speed: 12, dmg: 14, radius: 6, xp: 2, kind: 'crumb', hitT: 0, wob: G.rng() * 6.28, kbx: 0, kbz: 0 });
  }
}

// stage items (M3): gold bags + donuts drop on a schedule, walk over to collect
type Item = { x: number; z: number; kind: 'gold' | 'heal' };
const ITEM_T = 150; // first item at 2:30, every 2.5 min after
function spawnItem(): void {
  const p = G.player;
  const ang = G.rng() * Math.PI * 2;
  const dist = 60 + G.rng() * 120;
  const x = Math.max(20, Math.min(WORLD_W - 20, p.x + Math.cos(ang) * dist));
  const z = Math.max(20, Math.min(WORLD_H - 20, p.z + Math.sin(ang) * dist));
  G.items.push({ x, z, kind: G.rng() < 0.7 ? 'gold' : 'heal' });
}
// ---------- xp / level ----------
function gainXp(amt: number): void {
  G.xp += amt;
  checkLevelUp();
}
function checkLevelUp(): void {
  while (G.xp >= G.xpNeed) {
    G.xp -= G.xpNeed;
    G.level++;
    G.xpNeed = xpToNext(G.level);
    G.stats.maxLevel = Math.max(G.stats.maxLevel, G.level);
    if (G.mode === 'play') { G.mode = 'levelup'; G.options = buildOptions(); G.stats.levelUps++; sfx('levelup'); break; }
  }
}

// ---------- main update ----------
const DT = 1 / 60;
const RUN_LEN = 1800; // 30:00 — the full director run (M3)
let orbitPos: { x: number; z: number; r: number } | null = null;
let orbit2Pos: { x: number; z: number; r: number } | null = null;

function update(): void {
  syncKeys();
  if (G.mode === 'levelup') {
    const idx = keyIndex('1', '2', '3');
    if (idx >= 0) pickOption(idx);
  } else if (G.mode === 'title') {
    // character select (1/2/3) + stage toggle (S) + start (SPACE)
    const chIdx = keyIndex('1', '2', '3');
    if (chIdx >= 0) {
      const id = Object.keys(CHARACTERS)[chIdx];
      const ch = CHARACTERS[id];
      if (ch.unlock === 'default' || META.unlocked.includes(ch.unlock)) selectedChar = id;
    }
    if (justPressed('s')) {
      // toggle stage if unlocked
      const next = selectedStage === 'kitchen' ? 'bathroom' : 'kitchen';
      if (STAGES[next].unlock === 'default' || META.unlocked.includes(STAGES[next].unlock)) selectedStage = next;
    }
    if (justPressed(' ') || justPressed('enter')) startRun(G.seed);
  } else if (G.mode === 'dead' || G.mode === 'win') {
    if (justPressed(' ') || justPressed('enter')) startRun(G.seed);
  }
  if (G.mode !== 'play') { if (G.evolutionT > 0) G.evolutionT -= DT; return; }

  G.time += DT;
  const p = G.player;

  let [mx, my] = currentMove();
  const mlen = Math.hypot(mx, my);
  if (mlen > 1) { mx /= mlen; my /= mlen; }
  p.moving = mlen > 0;
  const spd = PLAYER.speed * G.stats.speedMult;
  if (p.moving) {
    p.x = clampNum(p.x + mx * spd * DT);
    p.z = clampNum(p.z + my * spd * DT);
    p.x = Math.max(PLAYER.radius, Math.min(WORLD_W - PLAYER.radius, p.x));
    p.z = Math.max(PLAYER.radius, Math.min(WORLD_H - PLAYER.radius, p.z));
    p.face = Math.atan2(my, mx);
    p.walkT += DT;
  }
  const tgt = nearestEnemy();
  if (tgt) p.face = Math.atan2(tgt.e.z - p.z, tgt.e.x - p.x);

  if (p.invuln > 0) p.invuln -= DT;
  if (G.flashT > 0) G.flashT -= DT;
  if (G.evolutionT > 0) G.evolutionT -= DT;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - DT * 40);

  fireWeapons();

  // bullets
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * DT; b.z += b.vz * DT; b.life -= DT;
    if (b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.z < 0 || b.z > WORLD_H) { G.bullets.splice(i, 1); continue; }
    // pierce: each bullet may hit a given enemy once (or a few times for
    // piercing weapons) — a hitSet of enemy indices refreshed per-frame so a
    // bullet passing THROUGH an enemy doesn't re-damage it every frame.
    if (b.kind !== 'bouncy') {
      if (!b.hitIds) b.hitIds = [];
      if (b.hitIds.length > 12) b.hitIds.length = 0; // cheap cap: re-hit allowed after it clears
      for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
        const e = G.enemies[ei];
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + b.hitR) {
          if (b.hitIds.includes(ei)) continue;
          b.hitIds.push(ei);
          damageEnemy(e, b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
        }
      }
    } else {
      for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
        const e = G.enemies[ei];
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + b.hitR) damageEnemy(e, b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
        // bouncy: ricochet to the next-nearest enemy (VS Runetracer)
        if (b.kind === 'bouncy' && (b.bounces || 0) > 0) {
          const next = nearestEnemyExcluding(e, 120);
          if (next) {
            const a = Math.atan2(next.e.z - b.x, next.e.x - b.x);
            const spd = b.bounceSpeed || 240;
            b.vx = Math.cos(a) * spd; b.vz = Math.sin(a) * spd;
            b.bounces = (b.bounces || 0) - 1;
          } else {
            b.vx = -b.vx; b.vz = -b.vz; // no target: reflect
            b.bounces = (b.bounces || 0) - 1;
          }
        }
      }
    }
    for (let wi = G.wall.length - 1; wi >= 0; wi--) {
      const e = G.wall[wi];
      if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + b.hitR) damageWall(e, b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02, wi);
    }
    if (G.boss && Math.hypot(G.boss.x - b.x, G.boss.z - b.z) < G.boss.radius + b.hitR) hitBoss(b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
    if (G.flush && Math.hypot(G.flush.x - b.x, G.flush.z - b.z) < G.flush.radius + b.hitR) hitFlush(b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
    // stickyplop: on expiry (or wall/boss impact), spawn a lingering zone
    if (b.kind === 'stickyplop' && b.life <= 0) {
      G.zones.push({ x: b.x, z: b.z, r: 30, life: 3, tick: 0.5, dmg: b.dmg });
      b.life = 1; // keep it one more frame so the loop can splice it
      b.kind = 'expired';
    }
  }

  // zones (puddles)
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const zn = G.zones[i];
    zn.life -= DT; zn.tick -= DT;
    if (zn.life <= 0) { G.zones.splice(i, 1); continue; }
    if (zn.tick <= 0) {
      zn.tick = 0.5;
      for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
        const e = G.enemies[ei];
        if (Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r + e.radius) damageEnemy(e, zn.dmg, zn.x, zn.z);
      }
      for (let wi = G.wall.length - 1; wi >= 0; wi--) {
        const e = G.wall[wi];
        if (Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r + e.radius) damageWall(e, zn.dmg, zn.x, zn.z, wi);
      }
      if (G.boss && Math.hypot(G.boss.x - zn.x, G.boss.z - zn.z) < zn.r + G.boss.radius) hitBoss(zn.dmg, zn.x, zn.z);
      if (G.flush && Math.hypot(G.flush.x - zn.x, G.flush.z - zn.z) < zn.r + G.flush.radius) hitFlush(zn.dmg, zn.x, zn.z);
    }
  }

  // enemies
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.wob += DT * 6;
    if (e.hitT > 0) e.hitT -= DT;
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.x += ((dx / d) * e.speed + e.kbx) * DT;
    e.z += ((dz / d) * e.speed + e.kbz) * DT;
    const kd = Math.exp(-4 * DT);
    e.kbx *= kd; e.kbz *= kd;
    if (d < e.radius + PLAYER.radius && p.invuln <= 0) {
      p.hp -= Math.max(1, e.dmg - G.armor); p.invuln = PLAYER.invulnAfterHit;
      G.shake = 6; G.flashT = Math.max(G.flashT, 0.12);
      G.dmgNums.push({ x: p.x, z: p.z - 8, vy: -26, t: 0.8, txt: '-' + Math.max(1, e.dmg - G.armor), crit: true });
      if (p.hp <= 0) { p.hp = 0; endRun(false, false); return; }
    }
  }

  // boss schedule (M3): spawn the next scheduled boss when its time arrives
  if (!G.boss && G.bossIdx < BOSS_SCHEDULE.length && G.time >= BOSS_SCHEDULE[G.bossIdx].t) {
    const ev = BOSS_SCHEDULE[G.bossIdx];
    spawnBoss(ev.kind, ev.name);
    G.bossIdx++;
    if (ev.kind === 'constipation') spawnSpasmWall(); // 15:00: the wall closes in
  }
  if (G.boss) {
    const b = G.boss;
    b.wob += DT * 4;
    if (b.hitT > 0) b.hitT -= DT;
    const dx = p.x - b.x, dz = p.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    // per-kind behavior
    if (b.kind === 'express') {
      // The Diarrhea Express: telegraphed charges — pause 0.6s (aim), then
      // dash 1.0s in a LOCKED direction (can't turn mid-dash → dodgeable)
      b.chargeCd -= DT;
      if (b.chargeCd <= 0) { b.chargeCd = 3; b.dashT = 1.2; b.aimT = 0.6; }
      if (b.aimT > 0) {
        // aim: hold position (telegraph), face the player
        b.aimT -= DT;
        b.lockAng = Math.atan2(p.z - b.z, p.x - b.x);
      } else if (b.dashT > 0) {
        b.dashT -= DT;
        b.x += Math.cos(b.lockAng) * b.speed * 2.4 * DT;
        b.z += Math.sin(b.lockAng) * b.speed * 2.4 * DT;
      } else {
        b.x += (dx / d) * b.speed * 0.3 * DT;
        b.z += (dz / d) * b.speed * 0.3 * DT;
      }
    } else if (b.kind === 'sphincter') {
      // Mr. Sphincter: phase 2 at 50% HP — clamps down (speed burst) + shockwaves
      if (!b.phase2 && b.hp < b.maxHp * 0.5) { b.phase2 = true; G.shake = 12; G.flashT = 0.4; }
      const spd = b.phase2 ? b.speed * 1.6 : b.speed;
      b.x += (dx / d) * spd * DT; b.z += (dz / d) * spd * DT;
      if (b.phase2 && b.chargeCd <= 0) {
        b.chargeCd = 2.5;
        // shockwave: ring of damage zones around the boss
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          G.zones.push({ x: b.x + Math.cos(a) * 30, z: b.z + Math.sin(a) * 30, r: 24, life: 1.5, tick: 0.5, dmg: 10 });
        }
      }
    } else {
      b.x += (dx / d) * b.speed * DT;
      b.z += (dz / d) * b.speed * DT;
    }
    b.minionCd -= DT;
    if (b.minionCd <= 0 && G.enemies.length < 40) { b.minionCd = 8; spawnEnemy(pickKind()); }
    if (d < b.radius + PLAYER.radius && p.invuln <= 0) {
      p.hp -= Math.max(1, b.dmg - G.armor); p.invuln = PLAYER.invulnAfterHit;
      G.shake = 10; G.flashT = 0.2;
      G.dmgNums.push({ x: p.x, z: p.z - 10, vy: -26, t: 0.9, txt: '-' + Math.max(1, b.dmg - G.armor), crit: true });
      if (p.hp <= 0) { p.hp = 0; endRun(false, false); return; }
    }
  }
  // THE FINAL FLUSH (30:00): spawns at RUN_LEN; killable → victory+gold, touch → flushed
  // The flush hp does NOT time-scale (unlike bosses) — a 30:00 player's build
  // must be able to kill it in ~8s of contact window, so it stays flat.
  if (!G.flush && G.time >= RUN_LEN && !G.flushResolved) {
    const st = BOSS_STATS.flush;
    G.flush = {
      x: Math.max(20, Math.min(WORLD_W - 20, G.player.x + Math.cos(0) * 240)),
      z: Math.max(20, Math.min(WORLD_H - 20, G.player.z + Math.sin(0) * 240)),
      hp: st.hp, maxHp: st.hp, speed: st.speed, dmg: st.dmg, radius: st.radius, hitT: 0, wob: 0,
    };
    sfx('boss');
    G.shake = 14; G.flashT = 0.6;
  }
  if (G.flush) {
    const f = G.flush;
    if (f.hitT > 0) f.hitT -= DT;
    const dx = p.x - f.x, dz = p.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    f.x += (dx / d) * f.speed * DT;
    f.z += (dz / d) * f.speed * DT;
    if (d < f.radius + PLAYER.radius) {
      // touched → flushed ending
      endRun(false, true);
      return;
    }
  }
  // Spasm Wall update: the slow ring of tanky enemies closing around the player
  if (G.wall.length > 0) {
    for (let i = G.wall.length - 1; i >= 0; i--) {
      const e = G.wall[i];
      const dx = p.x - e.x, dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      e.x += (dx / d) * e.speed * DT;
      e.z += (dz / d) * e.speed * DT;
      if (d < e.radius + PLAYER.radius && p.invuln <= 0) {
        p.hp -= Math.max(1, e.dmg - G.armor); p.invuln = PLAYER.invulnAfterHit;
        G.shake = 6;
        if (p.hp <= 0) { p.hp = 0; endRun(false, false); return; }
      }
    }
  }

  // chest pickup
  if (G.chest && Math.hypot(G.chest.x - p.x, G.chest.z - p.z) < 14) resolveChest();
  // stage items pickup
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    if (Math.hypot(it.x - p.x, it.z - p.z) < PLAYER.radius + 8) {
      if (it.kind === 'gold') { G.gold += 30; }
      else { G.player.hp = Math.min(PLAYER.maxHp, G.player.hp + 30); }
      G.items.splice(i, 1);
      G.stats.itemTaken++;
      G.flashT = Math.max(G.flashT, 0.15);
    }
  }

  // spawn director (M3): script density + wave bursts + spikes
  G.spawnCd -= DT;
  G.spawnInterval = Math.max(0.25, 1.1 - G.time / 300);
  if (G.spawnCd <= 0) { spawnEnemy(pickKind()); G.spawnCd = G.spawnInterval; }
  // wave bursts: absolute schedule — 1:00, then every 2 min, size grows
  const waveNext = Math.floor((G.time - 60) / 120) + 1;
  if (G.time >= 60 && G.waveIdx < waveNext) {
    G.waveIdx = waveNext;
    const size = 8 + Math.floor(G.time / 60) * 2;
    spawnWave(Math.min(30, size));
  }
  // density spike: 30s of doubled spawn rate (first at 12:00, every 2 min after)
  const spikeActive = G.time >= SPIKE_T && ((G.time - SPIKE_T) % SPIKE_EVERY) < 30;
  if (spikeActive && G.spawnCd > 0.25) { G.spawnCd = 0.25; }
  if (G.enemies.length > 260) G.enemies.splice(0, G.enemies.length - 260);
  // stage items: absolute schedule — 2:30, then every 2.5 min
  const itemNext = Math.floor((G.time - 150) / 150) + 1; // index of next item slot
  if (G.time >= 150 && G.itemIdx < itemNext) { G.itemIdx = itemNext; spawnItem(); }

  // gems
  const magnetR = PLAYER.magnetBase + (G.level - 1) * PLAYER.magnetPerLevel;
  for (let i = G.gems.length - 1; i >= 0; i--) {
    const g = G.gems[i];
    const dx = p.x - g.x, dz = p.z - g.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < magnetR) g.pulled = true;
    if (g.pulled) { g.x += (dx / d) * 160 * DT; g.z += (dz / d) * 160 * DT; }
    else { g.x += g.vx * DT; g.z += g.vz * DT; g.vx *= 0.9; g.vz *= 0.9; }
    if (d < PLAYER.radius + 3) { G.gems.splice(i, 1); G.stats.gems++; gainXp(g.val * G.stats.xpMult); }
  }

  // damage numbers
  for (let i = G.dmgNums.length - 1; i >= 0; i--) {
    const n = G.dmgNums[i]; n.z += n.vy * DT; n.t -= DT;
    if (n.t <= 0) G.dmgNums.splice(i, 1);
  }

  if (G.time >= RUN_LEN) endRun(true, false);
}

// ---------- run end (M4 meta): bank gold + check unlocks ----------
function endRun(won: boolean, flushed: boolean): void {
  G.flushResolved = true;
  G.mode = won ? 'win' : 'dead';
  G.flushed = flushed;
  sfx(won ? 'win' : (flushed ? 'flush' : 'death'));
  // bank the run's gold into the meta wallet
  META.gold += G.gold;
  META.bestTime = Math.max(META.bestTime, Math.floor(G.time));
  META.bestKills = Math.max(META.bestKills, G.kills);
  // unlock checks (VS: achievements-lite)
  const unlocks: string[] = [];
  if (won && G.time >= RUN_LEN) unlocks.push('survive5'); // bathroom stage
  if (G.time >= 600) unlocks.push('survive10'); // Hot Dog
  if (G.kills >= 500) unlocks.push('kills500'); // Avocado
  let any = false;
  for (const u of unlocks) if (!META.unlocked.includes(u)) { META.unlocked.push(u); any = true; }
  if (any || G.gold > 0) saveMeta(META);
}

function clampNum(v: number): number { if (Number.isNaN(v)) { G.stats.nan++; return 0; } return v; }
function startRun(seed: number): void { G = mkGame(seed); G.mode = 'play'; botDir = { x: 0, y: 0 }; orbitPos = null; orbit2Pos = null; lastEvo = null; }
// ---------- rendering ----------
const canvas = (document.getElementById('c') as HTMLCanvasElement);
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
function fitCanvas(): void {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.width = VIEW_W; canvas.height = VIEW_H;
  canvas.style.width = (VIEW_W * scale) + 'px';
  canvas.style.height = (VIEW_H * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function camX(): number { return Math.max(0, Math.min(WORLD_W - VIEW_W, G.player.x - VIEW_W / 2)); }
function camY(): number { return Math.max(0, Math.min(WORLD_H - VIEW_H, G.player.z - VIEW_H / 2)); }

// sprite pickers for the M3 roster
const ENEMY_SPR: Record<string, { spr: string; hit: string }> = {
  bubble: { spr: 'bubble', hit: 'bubbleHit' },
  droplet: { spr: 'droplet', hit: 'droplet' }, // single frame — no hit variant authored
  crumb: { spr: 'crumb', hit: 'crumbHit' },
  mop: { spr: 'mop', hit: 'mopHit' },
  stink: { spr: 'stink', hit: 'stinkHit' },
  sponge: { spr: 'sponge', hit: 'spongeHit' },
};
function enemySprite(kind: string, hit: boolean): any {
  const e = ENEMY_SPR[kind] || ENEMY_SPR.bubble;
  return SPRITES[hit ? e.hit : e.spr];
}
const BOSS_SPR: Record<string, { spr: string; hit: string }> = {
  wind: { spr: 'boss', hit: 'bossHit' },
  colonel: { spr: 'colonel', hit: 'colonelHit' },
  constipation: { spr: 'constipation', hit: 'constipationHit' },
  express: { spr: 'express', hit: 'expressHit' },
  sphincter: { spr: 'sphincter', hit: 'sphincterHit' },
};
function bossSprite(kind: string): { spr: any; hit: any } {
  const e = BOSS_SPR[kind] || BOSS_SPR.wind;
  return { spr: SPRITES[e.spr], hit: SPRITES[e.hit] };
}

function render(t: number): void {
  if (G.mode === 'title') { drawTitle(t); return; }
  const sx = G.shake > 0 ? Math.sin(t * 47) * G.shake * 0.5 : 0;
  const sy = G.shake > 0 ? Math.cos(t * 39) * G.shake * 0.5 : 0;
  const cx = camX() + sx, cy = camY() + sy;
  drawFloor(cx, cy);
  // zones under everything
  for (const zn of G.zones) {
    ctx.fillStyle = 'rgba(138,90,43,0.45)';
    ctx.beginPath(); ctx.arc(zn.x - cx, zn.z - cy, zn.r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(74,50,32,0.6)'; ctx.stroke();
  }
  for (const g of G.gems) drawSprite(ctx, SPRITES.gem, Math.round(g.x - cx), Math.round(g.z - cy), Math.floor(t / 0.3) % 2);
  for (const it of G.items) {
    drawSprite(ctx, it.kind === 'gold' ? SPRITES.goldbag : SPRITES.donut, Math.round(it.x - cx) - 5, Math.round(it.z - cy) - 5, 0);
  }
  if (G.chest) drawSprite(ctx, SPRITES.chest, Math.round(G.chest.x - cx) - 6, Math.round(G.chest.z - cy) - 8, 0);
  for (const b of G.bullets) {
    if (b.kind === 'plop') drawSprite(ctx, SPRITES.plop, Math.round(b.x - cx) - 4, Math.round(b.z - cy) - 4, 0);
    else if (b.kind === 'superfart') drawScaled(ctx, SPRITES.bolt, Math.round(b.x - cx) - 8, Math.round(b.z - cy) - 3, 2, 0);
    else drawSprite(ctx, SPRITES.bolt, Math.round(b.x - cx), Math.round(b.z - cy), 0);
  }
  for (const e of G.enemies) {
    const frame = Math.floor(t * 8 + e.wob) % 2;
    const spr = enemySprite(e.kind, false);
    const hitSpr = enemySprite(e.kind, true);
    drawSprite(ctx, e.hitT > 0 ? hitSpr : spr, Math.round(e.x - cx), Math.round(e.z - cy), frame);
  }
  for (const e of G.wall) {
    const frame = Math.floor(t * 4 + e.wob) % 2;
    drawSprite(ctx, e.hitT > 0 ? SPRITES.crumbHit : SPRITES.crumb, Math.round(e.x - cx) - 1, Math.round(e.z - cy) - 1, frame);
  }
  if (G.boss) {
    const frame = Math.floor(t * 6) % 2;
    const { spr, hit } = bossSprite(G.boss.kind);
    drawSprite(ctx, G.boss.hitT > 0 ? hit : spr, Math.round(G.boss.x - cx) - 7, Math.round(G.boss.z - cy) - 7, frame);
  }
  if (G.flush) {
    const frame = Math.floor(t * 5) % 2;
    drawSprite(ctx, G.flush.hitT > 0 ? SPRITES.flushHit : SPRITES.flush, Math.round(G.flush.x - cx) - 8, Math.round(G.flush.z - cy) - 8, frame);
  }
  {
    const p = G.player;
    const frame = p.moving ? Math.floor(p.walkT * 10) % 2 : 0;
    const blink = p.invuln > 0 && Math.floor(t * 16) % 2 === 0;
    const chSpr = SPRITES[CHARACTERS[G.char]?.sprite || 'crouton'];
    const chHit = SPRITES[(CHARACTERS[G.char]?.sprite || 'crouton') + 'Hit'];
    drawSprite(ctx, blink && chHit ? chHit : chSpr, Math.round(p.x - cx), Math.round(p.z - cy), frame);
  }
  // orbiting cracker: faint full aura ring centered on the PLAYER + the shard marker
  if (orbitPos) {
    const p = G.player;
    const cr = G.weapons.crackerring;
    if (cr) {
      const ar = (34 + 2 * cr.lvl) * G.stats.areaMult;
      ctx.strokeStyle = 'rgba(255,224,130,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.round(p.x - cx), Math.round(p.z - cy), ar, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawSprite(ctx, SPRITES.cracker, Math.round(orbitPos.x - cx) - 4, Math.round(orbitPos.z - cy) - 4, Math.floor(t * 12) % 2);
  }
  // orbiting turd (counter-rotation)
  if (orbit2Pos) {
    drawSprite(ctx, SPRITES.turd, Math.round(orbit2Pos.x - cx) - 5, Math.round(orbit2Pos.z - cy) - 5, Math.floor(t * 8) % 2);
  }
  for (const n of G.dmgNums) drawText(ctx, n.txt, Math.round(n.x - cx - 4), Math.round(n.z - cy), n.crit ? 1 : 0);
  if (G.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, G.flashT * 2)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawHud(t);
  if (G.evolutionT > 0) {
    ctx.fillStyle = 'rgba(18,12,6,0.8)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const bounce = Math.round(Math.sin(t * 8) * 2);
    center('EVOLUTION!', 90 + bounce, 1);
    // show the actual pair that evolved (read from the last chest resolution)
    const pair = lastEvoPair();
    center(pair ? (WEAPONS[pair.base].name + '  +  ' + PASSIVES[pair.passive].name) : '???', 116, 0);
    center('= ' + (pair ? WEAPONS[pair.to].name : '?'), 128, 1);
  }
}

let lastEvo: { base: string; passive: string; to: string } | null = null;
function lastEvoPair(): { base: string; passive: string; to: string } | null { return lastEvo; }

function drawFloor(cx: number, cy: number): void {
  const st = STAGES[G.stage] || STAGES.kitchen;
  const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
  for (let ty = y0; ty < y0 + VIEW_H / TILE + 1; ty++) {
    for (let tx = x0; tx < x0 + VIEW_W / TILE + 1; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? st.tileA : st.tileB;
      ctx.fillRect(tx * TILE - cx, ty * TILE - cy, TILE, TILE);
    }
  }
}

function center(text: string, y: number, style: number): void {
  const w = text.length * 6;
  drawText(ctx, text, Math.round((VIEW_W - w) / 2), y, style);
}
function fmt(s: number): string {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}
function drawHud(t: number): void {
  center(fmt(G.time), 4, 0);
  drawText(ctx, 'LV' + G.level, 6, 4, 0);
  const bw = 120, bx = 6, by = 14;
  ctx.fillStyle = '#3a2b1a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
  ctx.fillStyle = '#7a5a2e'; ctx.fillRect(bx, by, bw, 5);
  ctx.fillStyle = '#58d68d'; ctx.fillRect(bx, by, Math.round(bw * Math.max(0, Math.min(1, G.xp / G.xpNeed))), 5);
  const hbx = VIEW_W - 84, hby = 4;
  ctx.fillStyle = '#3a2b1a'; ctx.fillRect(hbx - 1, hby - 1, 86, 9);
  ctx.fillStyle = '#7a2e2e'; ctx.fillRect(hbx, hby, 84, 7);
  ctx.fillStyle = '#e0563a'; ctx.fillRect(hbx, hby, Math.round(84 * Math.max(0, Math.min(1, G.player.hp / G.stats.maxHp))), 7);
  drawText(ctx, 'HP', hbx + 2, hby + 1, 0);
  // VS-style item HUD: ACTIVE weapons row (top icons, y=24) then PASSIVE row (y=36)
  const ICONS: Record<string, string> = {
    fartwhip: 'bolt', plopcannon: 'plop', crackerring: 'cracker', puddle: 'plop',
    bouncy: 'bouncy', stinkaura: 'stinkaura', fartbomb: 'fartbomb', turd: 'turd',
    superfart: 'bolt', stickyplop: 'stickyplop', halo: 'cracker', slakelake: 'plop',
    superball: 'bouncy', ghost: 'ghost', bigburp: 'fartbomb', moon: 'moon',
    meats: 'donut', quick: 'bolt', slippers: 'gem', tp: 'gem', breakfast: 'donut',
    gloves: 'bolt', widestink: 'cracker', sticky: 'plop', lucky: 'gem',
  };
  let ax = 6;
  for (const id of Object.keys(G.weapons)) {
    const icon = ICONS[id] && SPRITES[ICONS[id]];
    if (!icon) continue;
    drawScaled(ctx, icon, ax, 24, 2, 0);
    // level tag under the icon (tiny)
    drawText(ctx, String(G.weapons[id].lvl), ax + 6, 30, 0);
    ax += 20;
  }
  let px = 6;
  for (const id of Object.keys(G.passives)) {
    const icon = ICONS[id] && SPRITES[ICONS[id]];
    if (!icon) continue;
    drawScaled(ctx, icon, px, 40, 2, 0);
    drawText(ctx, String(G.passives[id]), px + 6, 46, 2);
    px += 20;
  }
  // evolution hint: the base is maxed + its passive owned → chest will evolve
  const rdy = evoReady();
  if (rdy) center('EVO READY: ' + WEAPONS[rdy.toId].name, 56, 1);
  // gold
  drawText(ctx, 'G' + G.gold, VIEW_W - 40, 16, 0);
  // boss bar (per-boss name)
  if (G.boss) {
    const bbw = VIEW_W - 60, bbx = 30, bby = 64;
    ctx.fillStyle = '#1a0f08'; ctx.fillRect(bbx - 1, bby - 1, bbw + 2, 8);
    ctx.fillStyle = '#5a2e4e'; ctx.fillRect(bbx, bby, bbw, 6);
    ctx.fillStyle = '#c95aa0'; ctx.fillRect(bbx, bby, Math.round(bbw * Math.max(0, G.boss.hp / G.boss.maxHp)), 6);
    const nm = G.boss.name;
    drawText(ctx, nm, Math.round((VIEW_W - nm.length * 6) / 2), bby + 8, 1);
  }
  // FINAL FLUSH warning banner
  if (G.flush) {
    const blink = Math.floor(t * 3) % 2 === 0;
    if (blink) center('THE FINAL FLUSH!', 76, 1);
  } else if (G.time > RUN_LEN - 30 && !G.flushResolved) {
    center('THE FINAL FLUSH APPROACHES...', 76, 0);
  }

  if (G.mode === 'dead') overlay(G.flushed ? 'FLUSHED' : 'SOUPED', `lv${G.level}  kills ${G.kills}  ${fmt(G.time)}`, 'press SPACE to retry', t, true);
  else if (G.mode === 'win') overlay('KITCHEN CLEARED', `lv${G.level}  kills ${G.kills}  gold ${G.gold}`, 'press SPACE to go again', t, false);
  else if (G.mode === 'levelup') drawLevelUp();
}
function overlay(title: string, sub1: string, sub2: string, t: number, dark: boolean): void {
  ctx.fillStyle = dark ? 'rgba(20,10,6,0.82)' : 'rgba(30,22,10,0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const bounce = Math.round(Math.sin(t * 2) * 2);
  center(title, 80 + bounce, 1);
  center(sub1, 112, 0);
  center(sub2, 124, 0);
}
function drawLevelUp(): void {
  ctx.fillStyle = 'rgba(18,12,6,0.86)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  center('LEVEL UP!', 12, 1);
  // weapon id → icon sprite (the projectile/zone art for that weapon)
  const ICONS: Record<string, string> = {
    fartwhip: 'bolt', plopcannon: 'plop', crackerring: 'cracker', puddle: 'plop',
    bouncy: 'bouncy', stinkaura: 'stinkaura', fartbomb: 'fartbomb', turd: 'turd',
    superfart: 'bolt', stickyplop: 'stickyplop', halo: 'cracker', slakelake: 'plop',
    superball: 'bouncy', ghost: 'ghost', bigburp: 'fartbomb', moon: 'moon',
    // passive item icons: use the closest kit art (VS passives get icons too)
    meats: 'donut', quick: 'bolt', slippers: 'gem', tp: 'gem', breakfast: 'donut',
    gloves: 'bolt', widestink: 'cracker', sticky: 'plop', lucky: 'gem',
  };
  G.options.forEach((o, i) => {
    const y = 36 + i * 44;
    // LIGHT panel + DARK text (readability): the panel is warm parchment so
    // the dark-outline ink (style 0) and white ink (style 1) both pop.
    ctx.fillStyle = '#f3e2b8'; ctx.fillRect(14, y, VIEW_W - 28, 40);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(14, y, VIEW_W - 28, 2); ctx.fillRect(14, y + 38, VIEW_W - 28, 2);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(14, y, 2, 40); ctx.fillRect(VIEW_W - 16, y, 2, 40);
    // item icon (scaled 2× from the sprite art) at the left of the row
    const iconId = ICONS[o.id];
    if (iconId && SPRITES[iconId]) {
      drawScaled(ctx, SPRITES[iconId], 20, y + 12, 2, 0);
      // shift the text right so the icon has room
      drawText(ctx, `[${i + 1}] ${o.name}`, 44, y + 6, 0);
      drawText(ctx, o.desc, 44, y + 20, 2);
    } else {
      drawText(ctx, `[${i + 1}] ${o.name}`, 22, y + 6, 0);
      drawText(ctx, o.desc, 22, y + 20, 2);
    }
    if (o.kind === 'weapon' || o.kind === 'passive') drawText(ctx, `LV${o.lvl}`, VIEW_W - 60, y + 6, 2);
  });
}

function drawTitle(t: number): void {
  const st = STAGES[selectedStage] || STAGES.kitchen;
  for (let ty = 0; ty < VIEW_H / TILE; ty++) {
    for (let tx = 0; tx < VIEW_W / TILE; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? '#f7ecc9' : '#ecd79c';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  const bob = Math.round(Math.sin(t * 2.2) * 3);
  drawScaled(ctx, SPRITES[CHARACTERS[selectedChar].sprite], Math.round(VIEW_W / 2 - 24), 54 + bob, 4, 0);
  const bounce = Math.round(Math.sin(t * 2) * 2);
  const title = 'POOP SURVIVORS';
  const tw = title.length * 6;
  const tx = Math.round((VIEW_W - tw) / 2);
  drawText(ctx, title, tx + 1, 109 + bounce + 1, 0);
  drawText(ctx, title, tx, 108 + bounce, 1);
  if (Math.floor(t * 1.6) % 2 === 0) center('press SPACE to drop in', 136, 0);
  // character select: 1/2/3
  const chars = Object.keys(CHARACTERS);
  let line = '';
  chars.forEach((id, i) => {
    const unlocked = CHARACTERS[id].unlock === 'default' || META.unlocked.includes(CHARACTERS[id].unlock);
    const tag = unlocked ? '' : '?';
    const sel = selectedChar === id ? '>' : ' ';
    line += `${sel}${i + 1}${CHARACTERS[id].name[0]}${tag} `;
  });
  center('CH: ' + line.trim(), 152, 0);
  // stage select: S
  const stageLine = STAGES.kitchen.unlock === 'default' || META.unlocked.includes(STAGES.kitchen.unlock) ? 'K' : '?';
  const bathLine = META.unlocked.includes(STAGES.bathroom.unlock) ? 'B' : '?';
  center('STAGE: ' + (selectedStage === 'kitchen' ? 'KITCHEN' : 'BATHROOM') + `  [S] (${stageLine}${bathLine})`, 164, 0);
  center('move: WASD or arrows', 176, 0);
  center('survive the 30:00', 188, 0);
  center('gold bank: ' + META.gold, 200, 0);
  for (let i = 0; i < 3; i++) {
    const bx = (t * 24 + i * 120) % (VIEW_W + 24) - 12;
    const by = 16 + i * 10 + Math.round(Math.sin(t * 3 + i) * 4);
    drawSprite(ctx, SPRITES.bubble, Math.round(bx), by, Math.floor(t * 6 + i) % 2);
  }
}

// ---------- main loop ----------
let frozen = false;
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  if (!frozen) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 8) { update(); acc -= DT; steps++; }
  }
  render(now / 1000);
}
requestAnimationFrame(frame);

// ---------- __cap probe ----------
const win = window;
(win as any).__cap = {
  state: () => ({
    mode: G.mode, time: +G.time.toFixed(3),
    x: +G.player.x.toFixed(2), z: +G.player.z.toFixed(2),
    hp: G.player.hp, level: G.level, xp: +G.xp.toFixed(2), xpNeed: G.xpNeed,
    gold: G.gold,
    char: G.char, stage: G.stage, armor: G.armor, maxHp: G.stats.maxHp,
    meta: { gold: META.gold, unlocked: [...META.unlocked], achievements: [...META.achievements], bestTime: META.bestTime, bestKills: META.bestKills },
    options: G.mode === 'levelup' ? G.options.map((o) => ({ kind: o.kind, id: o.id, name: o.name, lvl: o.lvl })) : [],
    weapons: Object.fromEntries(Object.entries(G.weapons).map(([k, v]) => [k, v.lvl])),
    passives: { ...G.passives },
    evolved: G.evolved, boss: G.boss ? { x: +G.boss.x.toFixed(1), z: +G.boss.z.toFixed(1), hp: Math.round(G.boss.hp), name: G.boss.name, kind: G.boss.kind, phase2: G.boss.phase2 } : null,
    chest: G.chest ? { x: +G.chest.x.toFixed(1), z: +G.chest.z.toFixed(1) } : null,
    flush: G.flush ? { hp: Math.round(G.flush.hp), maxHp: G.flush.maxHp, x: +G.flush.x.toFixed(1), z: +G.flush.z.toFixed(1) } : null,
    flushResolved: G.flushResolved, flushed: G.flushed,
    bossIdx: G.bossIdx,
    wall: G.wall.length, items: G.items.length,
    enemies: G.enemies.length, gems: G.gems.length, bullets: G.bullets.length, zones: G.zones.length,
    kills: G.kills, bossKilled: G.bossKilled,
    world: { w: WORLD_W, h: WORLD_H },
    stats: {
      maxLevel: G.stats.maxLevel, levelUps: G.stats.levelUps, gems: G.stats.gems,
      nan: G.stats.nan, shots: { ...G.stats.shots }, kbApplied: G.stats.kbApplied,
      chestTaken: G.stats.chestTaken, itemTaken: G.stats.itemTaken,
      dmgMult: +G.stats.dmgMult.toFixed(3), cdMult: +G.stats.cdMult.toFixed(3),
      speedMult: +G.stats.speedMult.toFixed(3), xpMult: +G.stats.xpMult.toFixed(3),
      projSpeedMult: +G.stats.projSpeedMult.toFixed(3), areaMult: +G.stats.areaMult.toFixed(3),
      durationMult: +G.stats.durationMult.toFixed(3), maxHp: G.stats.maxHp,
    },
  }),
  xpCurve: (lvl: number) => xpToNext(lvl),
  restart: (seed: number) => { startRun(seed); return (win as any).__cap.state(); },
  // restart + start immediately (bypasses the title screen: startRun sets mode
  // to play; a subsequent update() in title mode would consume SPACE and restart)
  restartPlay: (seed: number) => { startRun(seed); return (win as any).__cap.state(); },
  set: (k: string, v: any) => {
    if (k === 'hp') G.player.hp = v;
    if (k === 'xp') G.xp = v;
    if (k === 'level') { G.level = v; G.xpNeed = xpToNext(v); }
    if (k === 'mode') G.mode = v as Mode;
    if (k === 'time') G.time = v;
    if (k === 'pos') { G.player.x = v[0]; G.player.z = v[1]; }
    if (k === 'bossHp' && G.boss) G.boss.hp = v;
    if (k === 'bossIdx') G.bossIdx = v;
    if (k === 'flushResolved') G.flushResolved = v;
  },
  gainXp: (amt: number) => { if (G.mode === 'play') gainXp(amt); return (win as any).__cap.state(); },
  pick: (i: number) => { pickOption(i); return (win as any).__cap.state(); },
  spawn: (n = 1, kind?: string) => { for (let i = 0; i < n; i++) spawnEnemy(kind || pickKind()); return (win as any).__cap.state(); },
  move: (x: number, y: number) => { botDir = { x, y }; },
  spawnBoss: (kind?: string) => {
    G.boss = null;
    if (kind) { const ev = BOSS_SCHEDULE.find((e) => e.kind === kind) || BOSS_SCHEDULE[0]; spawnBoss(ev.kind, ev.name); }
    else spawnBoss('wind', 'THE FIRST WIND');
    return (win as any).__cap.state();
  },
  spawnWall: () => { spawnSpasmWall(); return (win as any).__cap.state(); },
  spawnFlush: () => {
    const st = BOSS_STATS.flush;
    G.flush = { x: Math.max(20, Math.min(WORLD_W - 20, G.player.x + 240)), z: Math.max(20, Math.min(WORLD_H - 20, G.player.z)), hp: st.hp, maxHp: st.hp, speed: st.speed, dmg: st.dmg, radius: st.radius, hitT: 0, wob: 0 };
    return (win as any).__cap.state();
  },
  spawnItem: (kind?: string) => { spawnItem(); if (kind && G.items.length) G.items[G.items.length - 1].kind = (kind as 'gold' | 'heal'); return (win as any).__cap.state(); },
  setFlushHp: (hp: number) => { if (G.flush) { G.flush.hp = hp; G.flush.maxHp = Math.max(G.flush.maxHp, hp); } return (win as any).__cap.state(); },
  setWallHp: (i: number, hp: number) => { if (G.wall[i]) { G.wall[i].hp = hp; G.wall[i].maxHp = Math.max(G.wall[i].maxHp, hp); } return (win as any).__cap.state(); },
  wallList: () => G.wall.map((e) => ({ x: e.x, z: e.z, hp: +e.hp.toFixed(1), d: Math.hypot(e.x - G.player.x, e.z - G.player.z) })),
  itemList: () => G.items.map((it) => ({ x: it.x, z: it.z, kind: it.kind })),
  lastKinds: () => G.enemies.slice(-30).map((e) => e.kind),
  clearEnemies: () => { G.enemies.length = 0; return (win as any).__cap.state(); },
  bossSchedule: () => BOSS_SCHEDULE.map((e) => ({ t: e.t, name: e.name, kind: e.kind })),
  giveWeapon: (id: string, lvl = 1) => { G.weapons[id] = { lvl, cd: 0, ang: G.rng() * 6.28 }; return (win as any).__cap.state(); },
  givePassive: (id: string, lvl = 1) => { G.passives[id] = lvl; recomputeStats(); return (win as any).__cap.state(); },
  // grant on the CURRENT run (post-restart head start for soak harnesses)
  giveWeaponNow: (id: string, lvl = 1) => { G.weapons[id] = { lvl, cd: 0, ang: G.rng() * 6.28 }; return (win as any).__cap.state(); },
  givePassiveNow: (id: string, lvl = 1) => { G.passives[id] = lvl; recomputeStats(); return (win as any).__cap.state(); },
  evoReady: () => evoReady(),
  lastEvo: () => lastEvo,
  selectChar: (id: string) => {
    const ch = CHARACTERS[id];
    if (!ch) return { err: 'no char ' + id };
    if (ch.unlock !== 'default' && !META.unlocked.includes(ch.unlock)) return { err: 'locked: ' + ch.unlock };
    selectedChar = id;
    return { ok: true, char: selectedChar };
  },
  selectStage: (id: string) => {
    const st = STAGES[id];
    if (!st) return { err: 'no stage ' + id };
    if (st.unlock !== 'default' && !META.unlocked.includes(st.unlock)) return { err: 'locked: ' + st.unlock };
    selectedStage = id;
    return { ok: true, stage: selectedStage };
  },
  metaReset: () => { META = { gold: 0, unlocked: ['crouton'], achievements: [], bestTime: 0, bestKills: 0 }; saveMeta(META); return (win as any).__cap.state(); },
  metaGive: (unlock: string) => { if (!META.unlocked.includes(unlock)) META.unlocked.push(unlock); saveMeta(META); return (win as any).__cap.state(); },
  metaGold: (n: number) => { META.gold = n; saveMeta(META); return (win as any).__cap.state(); },
  chars: () => Object.keys(CHARACTERS).map((id) => ({ id, name: CHARACTERS[id].name, unlock: CHARACTERS[id].unlock, startWeapon: CHARACTERS[id].startWeapon })),
  stages: () => Object.keys(STAGES).map((id) => ({ id, name: STAGES[id].name, unlock: STAGES[id].unlock, scriptShift: STAGES[id].scriptShift })),
  enemiesNear: (r: number) => G.enemies.filter((e) => Math.hypot(e.x - G.player.x, e.z - G.player.z) < r).length,
  enemies: (n = 8) => {
    const arr = G.enemies.map((e) => ({ x: e.x, z: e.z, hp: +e.hp.toFixed(1), d: Math.hypot(e.x - G.player.x, e.z - G.player.z), kx: +e.kbx.toFixed(1), kz: +e.kbz.toFixed(1) })).sort((a, b) => a.d - b.d).slice(0, n);
    return arr;
  },
  setEnemyPos: (i: number, x: number, z: number) => {
    if (G.enemies[i]) { G.enemies[i].x = x; G.enemies[i].z = z; G.enemies[i].kbx = 0; G.enemies[i].kbz = 0; }
    return (win as any).__cap.state();
  },
  setEnemyHp: (i: number, hp: number) => {
    if (G.enemies[i]) { G.enemies[i].hp = hp; G.enemies[i].maxHp = Math.max(hp, G.enemies[i].maxHp); }
    return (win as any).__cap.state();
  },
  nearestGem: () => {
    let best: Gem | null = null, bd = 1e9;
    for (const g of G.gems) { const d = Math.hypot(g.x - G.player.x, g.z - G.player.z); if (d < bd) { bd = d; best = g; } }
    return best ? { x: best.x, z: best.z, d: bd } : null;
  },
  // determinism probes
  freeze: () => { frozen = true; },
  unfreeze: () => { frozen = false; },
  step: () => { update(); return (win as any).__cap.state(); },
  magnetRadius: () => PLAYER.magnetBase + (G.level - 1) * PLAYER.magnetPerLevel,
  // orbit weapon: expose the live orbit position for the bot (distance to ring)
  orbit: () => orbitPos ? { x: orbitPos.x, z: orbitPos.z } : null,
};
