// POOP SURVIVORS — M2
// M1 core loop + the weapon FRAMEWORK: weapons as a data table, passive stat
// multipliers, knockback, a boss (The First Wind) at 3:00, and the chest →
// evolution system (Fart Whip max + Quick Hands + chest = SUPER FART).
// Top-down 2D canvas, fixed timestep, seeded determinism, __cap probe.
// Art: hand-authored pixel arrays over one 16-color palette, 8x8 bitmap font.

import { PALETTE, SPRITES, drawSprite, drawScaled, drawText } from './art';

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
}> = {
  fartwhip:   { name: 'Fart Whip',    desc: 'Piercing gusts in your facing dir', maxLvl: 8, baseDmg: 10, baseCd: 1.6, dmgPerLvl: 3, cdPerLvl: -0.04, evolved: false },
  plopcannon: { name: 'Plop Cannon',  desc: 'Heavy aimed gunk blob',             maxLvl: 8, baseDmg: 22, baseCd: 2.4, dmgPerLvl: 8, cdPerLvl: -0.10, evolved: false },
  crackerring:{ name: 'Cracker Ring', desc: 'Orbiting cracker shards',           maxLvl: 8, baseDmg: 6,  baseCd: 0.22, dmgPerLvl: 3, cdPerLvl: -0.004, evolved: false },
  puddle:     { name: 'Puddle',       desc: 'Damaging puddles near you',         maxLvl: 8, baseDmg: 12, baseCd: 3.0, dmgPerLvl: 5, cdPerLvl: -0.06, evolved: false },
  superfart:  { name: 'SUPER FART',   desc: 'A wide, devastating piercing beam', maxLvl: 8, baseDmg: 40, baseCd: 1.1, dmgPerLvl: 6, cdPerLvl: -0.02, evolved: true },
};
const PASSIVES: Record<string, { name: string; desc: string; maxLvl: number }> = {
  meats:    { name: 'Meat Shakes',  desc: '+10% weapon damage / lv', maxLvl: 5 },
  quick:    { name: 'Quick Hands',  desc: '-8% weapon cooldown / lv', maxLvl: 5 },
  slippers: { name: 'Slippers',     desc: '+10% move speed / lv', maxLvl: 5 },
  tp:       { name: 'TP Crown',     desc: '+8% XP gain / lv', maxLvl: 5 },
};

function wDmg(id: string, lvl: number): number { return (WEAPONS[id].baseDmg + WEAPONS[id].dmgPerLvl * (lvl - 1)) * G.stats.dmgMult; }
function wCd(id: string, lvl: number): number { return Math.max(0.15, (WEAPONS[id].baseCd + WEAPONS[id].cdPerLvl * (lvl - 1)) * G.stats.cdMult); }

// ---------- enemies ----------
type Enemy = {
  x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number;
  radius: number; xp: number; kind: string; hitT: number; wob: number;
  kbx: number; kbz: number;
};
type Gem = { x: number; z: number; val: number; vx: number; vz: number; pulled: boolean };
type Bullet = { x: number; z: number; vx: number; vz: number; life: number; dmg: number; ang: number; hitR: number; kind: string };
type Zone = { x: number; z: number; r: number; life: number; tick: number; dmg: number };
type DmgNum = { x: number; z: number; vy: number; t: number; txt: string; crit: boolean };
type Boss = { x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number; radius: number; hitT: number; minionCd: number; wob: number };
type Mode = 'title' | 'play' | 'levelup' | 'dead' | 'win';
type WState = { lvl: number; cd: number; ang: number };
type ItemOpt = { kind: 'weapon' | 'passive' | 'gold' | 'hp'; id: string; name: string; desc: string; lvl: number };

type Game = {
  seed: number; rng: () => number;
  mode: Mode; time: number;
  player: { x: number; z: number; hp: number; face: number; moving: boolean; invuln: number; walkT: number };
  enemies: Enemy[]; gems: Gem[]; bullets: Bullet[]; zones: Zone[]; dmgNums: DmgNum[];
  xp: number; level: number; xpNeed: number; gold: number;
  weapons: Record<string, WState>;
  passives: Record<string, number>;
  boss: Boss | null; chest: { x: number; z: number } | null;
  options: ItemOpt[];
  flashT: number; shake: number; evolutionT: number; evolved: boolean;
  kills: number; bossKilled: number;
  stats: {
    maxLevel: number; levelUps: number; gems: number; nan: number;
    shots: Record<string, number>; kbApplied: number; chestTaken: number;
    dmgMult: number; cdMult: number; speedMult: number; xpMult: number;
  };
  spawnCd: number; spawnInterval: number;
};

let G: Game = mkGame(1);
function mkGame(seed: number): Game {
  const rng = mulberry32(seed);
  return {
    seed, rng, mode: 'title', time: 0,
    player: { x: WORLD_W / 2, z: WORLD_H / 2, hp: PLAYER.maxHp, face: 0, moving: false, invuln: 0, walkT: 0 },
    enemies: [], gems: [], bullets: [], zones: [], dmgNums: [],
    xp: 0, level: 1, xpNeed: xpToNext(1), gold: 0,
    weapons: { fartwhip: { lvl: 1, cd: 0, ang: 0 } },
    passives: {},
    boss: null, chest: null,
    options: [], flashT: 0, shake: 0, evolutionT: 0, evolved: false,
    kills: 0, bossKilled: 0,
    stats: { maxLevel: 1, levelUps: 0, gems: 0, nan: 0, shots: {}, kbApplied: 0, chestTaken: 0, dmgMult: 1, cdMult: 1, speedMult: 1, xpMult: 1 },
    spawnCd: 1.0, spawnInterval: 1.1,
  };
}

function recomputeStats(): void {
  const p = (id: string) => G.passives[id] || 0;
  G.stats.dmgMult = 1 + 0.10 * p('meats');
  G.stats.cdMult = Math.max(0.3, 1 - 0.08 * p('quick'));
  G.stats.speedMult = 1 + 0.10 * p('slippers');
  G.stats.xpMult = 1 + 0.08 * p('tp');
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
function currentMove(): [number, number] {
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
function damageEnemy(e: Enemy, dmg: number, srcX: number, srcZ: number): void {
  e.hp -= dmg; e.hitT = 0.12;
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
      const spd = 2.0 + 0.15 * (w.lvl - 1);
      w.ang += spd * DT;
      if (w.cd <= 0) {
        w.cd = wCd('crackerring', w.lvl);
        G.stats.shots['crackerring'] = (G.stats.shots['crackerring'] || 0) + 1;
        const r = 34 + 2 * w.lvl;
        const band = 13; // ring thickness (VS aura)
        orbitPos = { x: p.x + Math.cos(w.ang) * r, z: p.z + Math.sin(w.ang) * r, r: r + 6 };
        const dmg = wDmg('crackerring', w.lvl);
        for (const e of G.enemies) {
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (Math.abs(d - r) < band + e.radius) damageEnemy(e, dmg, p.x, p.z);
        }
        // boss (resists knockback, same as before)
        if (G.boss) {
          const d = Math.hypot(G.boss.x - p.x, G.boss.z - p.z);
          if (Math.abs(d - r) < band + G.boss.radius) hitBoss(dmg, p.x, p.z);
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
        G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(a) * 300, vz: Math.sin(a) * 300, life: 0.9, dmg: wDmg('fartwhip', w.lvl), ang: a, hitR: 3, kind: 'whip' });
      }
    } else if (id === 'plopcannon') {
      G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(p.face) * 170, vz: Math.sin(p.face) * 170, life: 1.6, dmg: wDmg('plopcannon', w.lvl), ang: p.face, hitR: 5, kind: 'plop' });
    } else if (id === 'superfart') {
      for (let k = 0; k < 3; k++) {
        const a = p.face + (k - 1) * 0.22;
        G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(a) * 340, vz: Math.sin(a) * 340, life: 1.3, dmg: wDmg('superfart', w.lvl), ang: a, hitR: 8, kind: 'superfart' });
      }
    }
  }
}

// ---------- boss ----------
const BOSS_T = 180; // 3:00
function spawnBoss(): void {
  const hp = 500 + 25 * G.level; // 3-min checkpoint: a threat, not an executioner (M3 director re-scales)
  const ang = G.rng() * Math.PI * 2;
  G.boss = {
    x: G.player.x + Math.cos(ang) * 200, z: G.player.z + Math.sin(ang) * 200,
    hp, maxHp: hp, speed: 26, dmg: 12, radius: 11, hitT: 0, minionCd: 4, wob: 0,
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
    G.chest = { x: b.x, z: b.z };
    G.shake = 10; G.flashT = 0.4;
  }
}

// ---------- evolution ----------
function evoReady(): boolean {
  return (G.weapons.fartwhip?.lvl || 0) >= WEAPONS.fartwhip.maxLvl && (G.passives.quick || 0) >= 1;
}
function resolveChest(): void {
  G.stats.chestTaken++;
  if (evoReady() && !G.evolved) {
    delete G.weapons.fartwhip;
    G.weapons.superfart = { lvl: 1, cd: 0, ang: 0 };
    G.evolved = true;
    G.evolutionT = 2.2;
    G.flashT = 0.5; G.shake = 8;
  } else {
    G.gold += 50;
    G.player.hp = Math.min(PLAYER.maxHp, G.player.hp + 25);
  }
  G.chest = null;
}

// ---------- spawning ----------
function spawnEnemy(): void {
  const p = G.player;
  const ang = G.rng() * Math.PI * 2;
  const dist = Math.max(VIEW_W, VIEW_H) / 2 + 40 + G.rng() * 60;
  let x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
  x = Math.max(8, Math.min(WORLD_W - 8, x));
  z = Math.max(8, Math.min(WORLD_H - 8, z));
  const hp = 6 * (1 + G.time / 90);
  G.enemies.push({ x, z, hp, maxHp: hp, speed: 34, dmg: 8, radius: 5, xp: 1, kind: 'bubble', hitT: 0, wob: G.rng() * 6.28, kbx: 0, kbz: 0 });
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
    if (G.mode === 'play') { G.mode = 'levelup'; G.options = buildOptions(); G.stats.levelUps++; break; }
  }
}

// ---------- main update ----------
const DT = 1 / 60;
const RUN_LEN = 300; // 5:00 for M2 (full 30:00 director lands in M3)
let orbitPos: { x: number; z: number; r: number } | null = null;

function update(): void {
  syncKeys();
  if (G.mode === 'levelup') {
    const idx = keyIndex('1', '2', '3');
    if (idx >= 0) pickOption(idx);
  } else if (G.mode === 'title' || G.mode === 'dead' || G.mode === 'win') {
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
    for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
      const e = G.enemies[ei];
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + b.hitR) damageEnemy(e, b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
    }
    if (G.boss && Math.hypot(G.boss.x - b.x, G.boss.z - b.z) < G.boss.radius + b.hitR) hitBoss(b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
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
      if (G.boss && Math.hypot(G.boss.x - zn.x, G.boss.z - zn.z) < zn.r + G.boss.radius) hitBoss(zn.dmg, zn.x, zn.z);
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
      p.hp -= e.dmg; p.invuln = PLAYER.invulnAfterHit;
      G.shake = 6; G.flashT = Math.max(G.flashT, 0.12);
      G.dmgNums.push({ x: p.x, z: p.z - 8, vy: -26, t: 0.8, txt: '-' + e.dmg, crit: true });
      if (p.hp <= 0) { p.hp = 0; G.mode = 'dead'; return; }
    }
  }

  // boss
  if (!G.boss && G.time >= BOSS_T && G.bossKilled < 1) spawnBoss();
  if (G.boss) {
    const b = G.boss;
    b.wob += DT * 4;
    if (b.hitT > 0) b.hitT -= DT;
    const dx = p.x - b.x, dz = p.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    b.x += (dx / d) * b.speed * DT;
    b.z += (dz / d) * b.speed * DT;
    b.minionCd -= DT;
    if (b.minionCd <= 0 && G.enemies.length < 40) { b.minionCd = 8; spawnEnemy(); }
    if (d < b.radius + PLAYER.radius && p.invuln <= 0) {
      p.hp -= b.dmg; p.invuln = PLAYER.invulnAfterHit;
      G.shake = 10; G.flashT = 0.2;
      G.dmgNums.push({ x: p.x, z: p.z - 10, vy: -26, t: 0.9, txt: '-' + b.dmg, crit: true });
      if (p.hp <= 0) { p.hp = 0; G.mode = 'dead'; return; }
    }
  }

  // chest pickup
  if (G.chest && Math.hypot(G.chest.x - p.x, G.chest.z - p.z) < 14) resolveChest();

  // spawn director
  G.spawnCd -= DT;
  G.spawnInterval = Math.max(0.25, 1.1 - G.time / 300);
  if (G.spawnCd <= 0) { spawnEnemy(); G.spawnCd = G.spawnInterval; }
  if (G.enemies.length > 260) G.enemies.splice(0, G.enemies.length - 260);

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

  if (G.time >= RUN_LEN) G.mode = 'win';
}

function clampNum(v: number): number { if (Number.isNaN(v)) { G.stats.nan++; return 0; } return v; }
function startRun(seed: number): void { G = mkGame(seed); G.mode = 'play'; botDir = { x: 0, y: 0 }; orbitPos = null; }

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
  if (G.chest) drawSprite(ctx, SPRITES.chest, Math.round(G.chest.x - cx) - 6, Math.round(G.chest.z - cy) - 8, 0);
  for (const b of G.bullets) {
    if (b.kind === 'plop') drawSprite(ctx, SPRITES.plop, Math.round(b.x - cx) - 4, Math.round(b.z - cy) - 4, 0);
    else if (b.kind === 'superfart') drawScaled(ctx, SPRITES.bolt, Math.round(b.x - cx) - 8, Math.round(b.z - cy) - 3, 2, 0);
    else drawSprite(ctx, SPRITES.bolt, Math.round(b.x - cx), Math.round(b.z - cy), 0);
  }
  for (const e of G.enemies) {
    const frame = Math.floor(t * 8 + e.wob) % 2;
    drawSprite(ctx, e.hitT > 0 ? SPRITES.bubbleHit : SPRITES.bubble, Math.round(e.x - cx), Math.round(e.z - cy), frame);
  }
  if (G.boss) {
    const frame = Math.floor(t * 6) % 2;
    drawSprite(ctx, G.boss.hitT > 0 ? SPRITES.bossHit : SPRITES.boss, Math.round(G.boss.x - cx) - 6, Math.round(G.boss.z - cy) - 6, frame);
  }
  {
    const p = G.player;
    const frame = p.moving ? Math.floor(p.walkT * 10) % 2 : 0;
    const blink = p.invuln > 0 && Math.floor(t * 16) % 2 === 0;
    drawSprite(ctx, blink ? SPRITES.croutonHit : SPRITES.crouton, Math.round(p.x - cx), Math.round(p.z - cy), frame);
  }
  // orbiting cracker: faint full aura ring centered on the PLAYER + the shard marker
  if (orbitPos) {
    const p = G.player;
    const cr = G.weapons.crackerring;
    if (cr) {
      const ar = 34 + 2 * cr.lvl;
      ctx.strokeStyle = 'rgba(255,224,130,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.round(p.x - cx), Math.round(p.z - cy), ar, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawSprite(ctx, SPRITES.cracker, Math.round(orbitPos.x - cx) - 4, Math.round(orbitPos.z - cy) - 4, Math.floor(t * 12) % 2);
  }
  for (const n of G.dmgNums) drawText(ctx, n.txt, Math.round(n.x - cx - 4), Math.round(n.z - cy), n.crit ? 1 : 0);
  if (G.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, G.flashT * 2)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawHud(t);
  if (G.evolutionT > 0) {
    ctx.fillStyle = 'rgba(18,12,6,0.8)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const bounce = Math.round(Math.sin(t * 8) * 2);
    center('EVOLUTION!', 90 + bounce, 1);
    center('Fart Whip  +  Quick Hands', 116, 0);
    center('= SUPER FART', 128, 1);
  }
}

function drawFloor(cx: number, cy: number): void {
  const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
  for (let ty = y0; ty < y0 + VIEW_H / TILE + 1; ty++) {
    for (let tx = x0; tx < x0 + VIEW_W / TILE + 1; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? '#f3e2b8' : '#e8cf94';
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
  ctx.fillStyle = '#e0563a'; ctx.fillRect(hbx, hby, Math.round(84 * Math.max(0, Math.min(1, G.player.hp / PLAYER.maxHp))), 7);
  drawText(ctx, 'HP', hbx + 2, hby + 1, 0);
  // weapon levels, small, under the XP bar
  const wtxt = Object.keys(G.weapons).map((id) => id[0].toUpperCase() + (G.weapons[id].lvl)).join(' ');
  drawText(ctx, wtxt, 6, 26, 0);
  // gold
  drawText(ctx, 'G' + G.gold, VIEW_W - 40, 16, 0);
  // boss bar
  if (G.boss) {
    const bbw = VIEW_W - 60, bbx = 30, bby = 34;
    ctx.fillStyle = '#1a0f08'; ctx.fillRect(bbx - 1, bby - 1, bbw + 2, 8);
    ctx.fillStyle = '#5a2e4e'; ctx.fillRect(bbx, bby, bbw, 6);
    ctx.fillStyle = '#c95aa0'; ctx.fillRect(bbx, bby, Math.round(bbw * Math.max(0, G.boss.hp / G.boss.maxHp)), 6);
    drawText(ctx, 'THE FIRST WIND', Math.round(VIEW_W / 2 - 36), bby + 8, 1);
  }

  if (G.mode === 'dead') overlay('FLUSHED', `lv${G.level}  kills ${G.kills}  ${fmt(G.time)}`, 'press SPACE to retry', t, true);
  else if (G.mode === 'win') overlay('SOLVED IT', `lv${G.level}  kills ${G.kills}  gold ${G.gold}`, 'press SPACE to go again', t, false);
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
  G.options.forEach((o, i) => {
    const y = 36 + i * 44;
    ctx.fillStyle = '#332616'; ctx.fillRect(14, y, VIEW_W - 28, 40);
    ctx.strokeStyle = '#c9a24a'; ctx.strokeRect(14.5, y + 0.5, VIEW_W - 29, 39);
    drawText(ctx, `[${i + 1}] ${o.name}`, 22, y + 6, 1);
    drawText(ctx, o.desc, 22, y + 20, 0);
    if (o.kind === 'weapon' || o.kind === 'passive') drawText(ctx, `LV${o.lvl}`, VIEW_W - 60, y + 6, 0);
  });
}

function drawTitle(t: number): void {
  for (let ty = 0; ty < VIEW_H / TILE; ty++) {
    for (let tx = 0; tx < VIEW_W / TILE; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? '#f7ecc9' : '#ecd79c';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  const bob = Math.round(Math.sin(t * 2.2) * 3);
  drawScaled(ctx, SPRITES.crouton, Math.round(VIEW_W / 2 - 24), 54 + bob, 4, 0);
  const bounce = Math.round(Math.sin(t * 2) * 2);
  const title = 'POOP SURVIVORS';
  const tw = title.length * 6;
  const tx = Math.round((VIEW_W - tw) / 2);
  drawText(ctx, title, tx + 1, 109 + bounce + 1, 0);
  drawText(ctx, title, tx, 108 + bounce, 1);
  if (Math.floor(t * 1.6) % 2 === 0) center('press SPACE to drop in', 136, 0);
  center('move: WASD or arrows', 152, 0);
  center('survive the 5:00', 164, 0);
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
    options: G.mode === 'levelup' ? G.options.map((o) => ({ kind: o.kind, id: o.id, name: o.name, lvl: o.lvl })) : [],
    weapons: Object.fromEntries(Object.entries(G.weapons).map(([k, v]) => [k, v.lvl])),
    passives: { ...G.passives },
    evolved: G.evolved, boss: G.boss ? { x: +G.boss.x.toFixed(1), z: +G.boss.z.toFixed(1), hp: Math.round(G.boss.hp) } : null,
    chest: G.chest ? { x: +G.chest.x.toFixed(1), z: +G.chest.z.toFixed(1) } : null,
    enemies: G.enemies.length, gems: G.gems.length, bullets: G.bullets.length, zones: G.zones.length,
    kills: G.kills, bossKilled: G.bossKilled,
    world: { w: WORLD_W, h: WORLD_H },
    stats: {
      maxLevel: G.stats.maxLevel, levelUps: G.stats.levelUps, gems: G.stats.gems,
      nan: G.stats.nan, shots: { ...G.stats.shots }, kbApplied: G.stats.kbApplied,
      chestTaken: G.stats.chestTaken,
      dmgMult: +G.stats.dmgMult.toFixed(3), cdMult: +G.stats.cdMult.toFixed(3),
      speedMult: +G.stats.speedMult.toFixed(3), xpMult: +G.stats.xpMult.toFixed(3),
    },
  }),
  xpCurve: (lvl: number) => xpToNext(lvl),
  restart: (seed: number) => { startRun(seed); return (win as any).__cap.state(); },
  set: (k: string, v: any) => {
    if (k === 'hp') G.player.hp = v;
    if (k === 'xp') G.xp = v;
    if (k === 'level') { G.level = v; G.xpNeed = xpToNext(v); }
    if (k === 'mode') G.mode = v as Mode;
    if (k === 'time') G.time = v;
    if (k === 'pos') { G.player.x = v[0]; G.player.z = v[1]; }
    if (k === 'bossHp' && G.boss) G.boss.hp = v;
  },
  gainXp: (amt: number) => { if (G.mode === 'play') gainXp(amt); return (win as any).__cap.state(); },
  pick: (i: number) => { pickOption(i); return (win as any).__cap.state(); },
  spawn: (n = 1) => { for (let i = 0; i < n; i++) spawnEnemy(); return (win as any).__cap.state(); },
  move: (x: number, y: number) => { botDir = { x, y }; },
  spawnBoss: () => { G.boss = null; spawnBoss(); return (win as any).__cap.state(); },
  giveWeapon: (id: string, lvl = 1) => { G.weapons[id] = { lvl, cd: 0, ang: G.rng() * 6.28 }; return (win as any).__cap.state(); },
  givePassive: (id: string, lvl = 1) => { G.passives[id] = lvl; recomputeStats(); return (win as any).__cap.state(); },
  evoReady: () => evoReady(),
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
