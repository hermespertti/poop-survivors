// M20 fire registry — every weapon's firing behavior lives HERE, keyed by
// weapon id. M18 shipped a real bug class: a weapon registered in the table
// with no fire branch (halo + slakelake) silently disarmed the player from
// the chest that granted it. The m4 B1b test catches that after the fact;
// this registry makes it structurally visible: adding a WEAPONS entry without
// a FIRE handler trips `assertFireCoverage()` at boot (loud in console +
// stored on window.__cap.fireMissing for the test gate), not at minute 12 of
// a human run.
//
// Handlers were moved VERBATIM from fireWeapons() (M19 split discipline:
// evaluation order and RNG consumption are frozen by test/fingerprint.mjs —
// `815bf2e5…` must survive this move byte-identically).

import { damageEnemy, nearestEnemy, wArea, wCd, wDmg, wDuration, wProjSpeed } from './combat';
import { DT, WORLD_H, WORLD_W } from './constants';
import { setGnatPos, setOrbit2Pos, setOrbitPos } from './game';
import { G } from './game';
import { sfx } from './sfx';
import { damageWall, hitBoss, hitFlush } from './systems';
import { WEAPONS } from './tables/weapons';
import { Enemy, Game, WState } from './types';

type Player = Game['player'];
type Target = { e: Enemy; d: number };
export type FireHandler = (w: WState, p: Player, id: string) => void;

// ---------- shared sweeps ----------
// The ring/disc weapons damage the same four layers in the same order:
// enemies (forward) → wall (reverse) → boss → flush. One helper each so the
// band-vs-disc distinction (crackerring vs halo) is the only difference.

function sweepBand(cx: number, cy: number, r: number, band: number, dmg: number): void {
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - cx, e.z - cy);
    if (Math.abs(d - r) < band + e.radius) damageEnemy(e, dmg, cx, cy);
  }
  for (let wi = G.wall.length - 1; wi >= 0; wi--) {
    const e = G.wall[wi];
    const d = Math.hypot(e.x - cx, e.z - cy);
    if (Math.abs(d - r) < band + e.radius) damageWall(e, dmg, cx, cy, wi);
  }
  if (G.boss) {
    const d = Math.hypot(G.boss.x - cx, G.boss.z - cy);
    if (Math.abs(d - r) < band + G.boss.radius) hitBoss(dmg, cx, cy);
  }
  if (G.flush) {
    const d = Math.hypot(G.flush.x - cx, G.flush.z - cy);
    if (Math.abs(d - r) < band + G.flush.radius) hitFlush(dmg, cx, cy);
  }
}

function sweepDisc(cx: number, cy: number, r: number, dmg: number): void {
  for (const e of G.enemies) {
    if (Math.hypot(e.x - cx, e.z - cy) < r + e.radius) damageEnemy(e, dmg, cx, cy);
  }
  for (let wi = G.wall.length - 1; wi >= 0; wi--) {
    const e = G.wall[wi];
    if (Math.hypot(e.x - cx, e.z - cy) < r + e.radius) damageWall(e, dmg, cx, cy, wi);
  }
  if (G.boss && Math.hypot(G.boss.x - cx, G.boss.z - cy) < r + G.boss.radius) hitBoss(dmg, cx, cy);
  if (G.flush && Math.hypot(G.flush.x - cx, G.flush.z - cy) < r + G.flush.radius) hitFlush(dmg, cx, cy);
}

// ---------- self-timed handlers (no target acquire) ----------
// These manage their own cd/orbit/zone logic; fireWeapons only ticks w.cd.

function fireCrackerRing(w: WState, p: Player): void {
  // continuous orbit: a full 2π ring at radius r — hit everything in the band.
  // Shards are the visual (and the thing that knocks); the band is the damage.
  // The angle advances EVERY tick (smooth spin); damage stays on its own cadence.
  const spd = 2.0 + 0.15 * (w.lvl - 1);
  w.ang += spd * DT;
  const r = 34 + 2 * w.lvl;
  const band = 13; // ring thickness (VS aura)
  // M13: the shards ARE the ring now — N cracker chunks at even angles
  // around the band (N grows with level, 4 → 8), derived at render from
  // w.ang (the same spin the damage band rides). Pre-M13 it was ONE shard
  // marker + a 30%-alpha circle, so the visual (a dot) didn't match the
  // mechanic (a full ring) — human feedback: "no indicator it even works".
  setOrbitPos({ x: p.x + Math.cos(w.ang) * r, z: p.z + Math.sin(w.ang) * r, r: r + 6 });
  if (w.cd <= 0) {
    w.cd = wCd('crackerring', w.lvl);
    G.stats.shots['crackerring'] = (G.stats.shots['crackerring'] || 0) + 1;
    sweepBand(p.x, p.z, r, band, wDmg('crackerring', w.lvl));
  }
}

function fireHalo(w: WState, p: Player): void {
  // M18: the ring evolution was REGISTERED but never FIRED (same class of
  // dead-code bug as slakelake) — an early chest that gave Halo silently
  // disarmed the ring owner. Halo: full disc, not a band — everything
  // inside the radius gets ticked, the shards keep spinning as the skin.
  const spd = 2.0 + 0.15 * (w.lvl - 1);
  w.ang += spd * DT;
  const r = wArea(34 + 2 * w.lvl);
  if (w.cd <= 0) {
    w.cd = wCd('halo', w.lvl);
    G.stats.shots['halo'] = (G.stats.shots['halo'] || 0) + 1;
    sweepDisc(p.x, p.z, r, wDmg('halo', w.lvl));
  }
  setOrbitPos({ x: p.x + Math.cos(w.ang) * r, z: p.z + Math.sin(w.ang) * r, r: r + 6 });
}

function firePuddle(w: WState, p: Player): void {
  if (w.cd <= 0) {
    w.cd = wCd('puddle', w.lvl);
    G.stats.shots['puddle'] = (G.stats.shots['puddle'] || 0) + 1;
    const a = G.rng() * Math.PI * 2, d = 20 + G.rng() * 50;
    G.zones.push({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, r: 30 + 6 * w.lvl, life: 4, tick: 0.5, dmg: wDmg('puddle', w.lvl) });
  }
}

function fireSlakelake(w: WState, p: Player): void {
  // M18: the puddle evolution was REGISTERED but never FIRED — a chest
  // that gave Slime Lake silently disarmed the player (the real reason
  // avocado's boss med was 1: no weapon after the chest, not weak
  // numbers). Big lake at the nearest enemy: ticks hard AND drags
  // everything inside toward its center (VS Black Hole crowd control).
  if (w.cd <= 0) {
    const t = nearestEnemy(320);
    w.cd = wCd('slakelake', w.lvl);
    G.stats.shots['slakelake'] = (G.stats.shots['slakelake'] || 0) + 1;
    sfx('shoot');
    const tx = t ? t.e.x : p.x, tz = t ? t.e.z : p.z;
    G.zones.push({ x: tx, z: tz, r: wArea(55 + 5 * w.lvl), life: wDuration(3.5), tick: 0.4, dmg: wDmg('slakelake', w.lvl), tint: '#2f7f3f', drag: 55 + 6 * w.lvl });
  }
}

function fireAura(w: WState, p: Player, id: string): void {
  // passive aura: a zone centered on the player, ticking — no aiming
  if (w.cd <= 0) {
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    const r = id === 'ghost' ? 26 : 22 + 2 * w.lvl;
    G.zones.push({ x: p.x, z: p.z, r, life: 0.5, tick: 0.5, dmg: wDmg(id, w.lvl) });
  }
}

function fireOrbitHeavy(w: WState, p: Player, id: string): void {
  // heavy slow orbit: a damage zone that circles the player (opposite dir)
  // The angle advances EVERY tick (smooth spin); damage stays on its own cadence.
  const spd = id === 'moon' ? 1.6 : 1.2;
  w.ang -= spd * DT; // counter-rotate against the cracker ring
  const r = id === 'moon' ? 55 + 3 * w.lvl : 30 + 2 * w.lvl;
  const rr = id === 'moon' ? 12 : 8;
  const ox = p.x + Math.cos(w.ang) * r, oz = p.z + Math.sin(w.ang) * r;
  setOrbit2Pos({ x: ox, z: oz, r: rr });
  if (w.cd <= 0) {
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    sweepDisc(ox, oz, rr, wDmg(id, w.lvl));
  }
}

function fireGnat(w: WState, p: Player, id: string): void {
  // Gnat (M8): a chomping companion orbiting you that zaps enemies on its
  // own cadence. SUPER GNAT: multiple zaps per tick. Winged passive adds
  // zaps + spin. Damage applies on the tick (like the cracker band), the
  // beam bullet is purely visual.
  const spd = 3.0 + 0.15 * (G.passives.winged || 0);
  w.ang += spd * DT;
  const r = 24 + 2 * w.lvl;
  const gp = { x: p.x + Math.cos(w.ang) * r, z: p.z + Math.sin(w.ang) * r };
  setGnatPos(gp);
  if (w.cd <= 0) {
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    const zaps = (id === 'supergnat' ? 3 : 1) + (G.passives.winged || 0);
    const taken: Enemy[] = [];
    for (let k = 0; k < zaps; k++) {
      let t: Enemy | null = null, bd = 260;
      for (const e of G.enemies) {
        if (taken.includes(e) || e.hp <= 0) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < bd) { bd = d; t = e; }
      }
      if (!t) break;
      taken.push(t);
      G.bullets.push({ x: gp.x, z: gp.z, vx: (t.x - gp.x) / 0.1, vz: (t.z - gp.z) / 0.1, life: 0.1, dmg: 0, ang: 0, hitR: 3, kind: 'gnatbeam', visual: true });
      damageEnemy(t, wDmg(id, w.lvl), gp.x, gp.z);
    }
    sfx('shoot');
  }
}

function fireTurret(w: WState, p: Player, id: string): void {
  // M13 Plop Turret: drop a STATIONARY turret at your feet; it targets and
  // fires on its own cadence — you can walk away and it keeps punching.
  // Levels: +dmg, +lifetime, +rate. AUTOBLAST: faster + a 3-way spread.
  // Extra Ammo passive: +1 plop per level (max 3 turrets on the field).
  if (w.cd <= 0 && G.turrets.length < G.stats.turretCap) {
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    const tx = Math.max(10, Math.min(WORLD_W - 10, p.x + (G.rng() - 0.5) * 26));
    const tz = Math.max(10, Math.min(WORLD_H - 10, p.z + (G.rng() - 0.5) * 26));
    const spread = id === 'autoblast' ? 3 : 1;
    G.turrets.push({ x: tx, z: tz, cd: 0, life: (id === 'autoblast' ? 8 : 6) + w.lvl * 1.5, dmg: wDmg(id, w.lvl), angle: G.rng() * 6.28, rate: Math.max(0.35, (id === 'autoblast' ? 0.5 : 0.9) - 0.05 * w.lvl), spread });
    sfx('shoot');
  }
}

function fireBoomer(w: WState, p: Player, id: string): void {
  // M13 Gunk Boomer: a boomerang that goes out AND comes back — hits on
  // the way out, again on the way home. Grip passive: +range, +1 rebound.
  // CYCLONE: three boomerangs per throw, each rebounds once more.
  if (w.cd <= 0) {
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    const count = id === 'cyclone' ? 3 : 1;
    const range = wArea(110 + 12 * w.lvl) * G.stats.boomerMult;
    const rebounds = (id === 'cyclone' ? 2 : 1) + (G.passives.grip || 0);
    for (let k = 0; k < count; k++) {
      const a = p.face + (k - (count - 1) / 2) * 0.35;
      const spd = wProjSpeed(160);
      G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, life: wDuration(2.4), dmg: wDmg(id, w.lvl), ang: a, hitR: wArea(4), kind: 'boomer', bounces: range / spd, bounceSpeed: spd, dir: 1, returnHits: rebounds });
    }
    sfx('shoot');
  }
}

function fireTrail(w: WState, p: Player, id: string): void {
  // M13 Slime Trail: a damaging muck drops BEHIND you as you move (like
  // VS' Vito trail). The weapon cd gates each drop; Slush Pails widens the
  // slick, Sticky lengthens it. QUAGMIRE: wider, longer, more frequent.
  if (w.cd <= 0) {
    w.cd = wCd(id, w.lvl);
    // moving? (walked since the last drop) — the trail follows your feet,
    // it doesn't pour at you while you stand still
    const dxm = p.x - G.trailX, dzm = p.z - G.trailZ;
    const moved = G.trailT === 0 || Math.hypot(dxm, dzm) > 4;
    if (!moved) return;
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    const r = (id === 'quagmire' ? 15 : 10) * wArea(1) * G.stats.trailMult;
    // drop slightly BEHIND the player along their last movement so the
    // blobs string out into a trail.
    const mdd = Math.hypot(dxm, dzm) || 1;
    const bx = p.x - (dxm / mdd) * 6, bz = p.z - (dzm / mdd) * 6;
    G.zones.push({ x: bx, z: bz, r, life: wDuration(id === 'quagmire' ? 2.4 : 1.2), tick: 0.35, dmg: wDmg(id, w.lvl), tint: '#3fa34d' });
    G.trailX = p.x; G.trailZ = p.z; G.trailT = G.time;
  }
}

// ---------- aimed handlers ----------
// Shared preamble (cd gate → acquire → face → reset cd → count → blip),
// then the per-weapon shot. Body order is byte-identical to the old chain.

function aimed(fire: (w: WState, p: Player, n: Target, id: string) => void): FireHandler {
  return (w, p, id) => {
    if (w.cd > 0) return;
    const n = nearestEnemy(240);
    if (!n) return;
    p.face = Math.atan2(n.e.z - p.z, n.e.x - p.x);
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    sfx('shoot'); // one blip per weapon volley (not per bullet)
    fire(w, p, n, id);
  };
}

// ---------- shared aimed shots (base + evolution share one body) ----------
// bouncy/superball and fartbomb/bigburp were one `id ===` branch pair in the
// old chain; the shared body rides on both registry keys, unchanged.

const bouncyShot = aimed((w, p, _n, id) => {
  const count = id === 'superball' ? 3 : 1;
  for (let k = 0; k < count; k++) {
    const a = p.face + (k - (count - 1) / 2) * 0.3;
    const spd = wProjSpeed(240);
    G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, life: wDuration(2.4), dmg: wDmg(id, w.lvl), ang: a, hitR: wArea(4), kind: 'bouncy', bounces: id === 'superball' ? 8 : 3, bounceSpeed: spd });
  }
});

const bombShot = aimed((w, p, _n, id) => {
  const tgt = G.enemies.length ? G.enemies[Math.floor(G.rng() * G.enemies.length)] : null;
  const tx = tgt ? tgt.x : p.x + G.rng() * 100 - 50, tz = tgt ? tgt.z : p.z + G.rng() * 100 - 50;
  const r = wArea(id === 'bigburp' ? 60 : 40);
  G.zones.push({ x: tx, z: tz, r, life: wDuration(0.6), tick: 0.25, dmg: wDmg(id, w.lvl) });
});

const mineShot = aimed((w, p, n, id) => {
  // M8: Gunk Mine drops a timed mine at the nearest enemy (landmine: it
  // sits still, then blasts a wide radius). MINE LORD rains a volley of
  // fast-fusing mines in a ring. Fuse scales with duration passive.
  const count = id === 'minelord' ? 3 : 1;
  const fuse = (id === 'minelord' ? 0.8 : 1.2) * wDuration(1);
  for (let k = 0; k < count; k++) {
    let tx: number, tz: number;
    if (k === 0 && n && id === 'mine') { tx = n.e.x + (G.rng() - 0.5) * 24; tz = n.e.z + (G.rng() - 0.5) * 24; }
    else { const a = G.rng() * Math.PI * 2, d = 28 + G.rng() * (id === 'minelord' ? 85 : 45); tx = p.x + Math.cos(a) * d; tz = p.z + Math.sin(a) * d; }
    tx = Math.max(8, Math.min(WORLD_W - 8, tx)); tz = Math.max(8, Math.min(WORLD_H - 8, tz));
    // blast radius: base per weapon, +20%/lv from the Fuse passive, area passive on top
    const blast = (id === 'minelord' ? 42 : 30) * (1 + 0.20 * (G.passives.fuse || 0)) * G.stats.areaMult;
    G.bullets.push({ x: tx, z: tz, vx: 0, vz: 0, life: fuse, dmg: wDmg(id, w.lvl), ang: 0, hitR: 3, kind: 'mine', blast });
  }
});

const chainShot = aimed((w, p, _n, id) => {
  // M8: Chain Fart — lightning jumps enemy-to-enemy (VS Runetracer-style).
  // CHAIN STORM hurls three storms per shot. Chain passive adds hops.
  const bolts = id === 'chainstorm' ? 3 : 1;
  const maxHops = 3 + Math.floor(w.lvl / 2) + (G.passives.chain || 0);
  for (let bb = 0; bb < bolts; bb++) {
    let fx = p.x, fz = p.z;
    const taken: Enemy[] = [];
    for (let hop = 0; hop < maxHops; hop++) {
      let t: Enemy | null = null, bd = hop === 0 ? 260 : 120;
      for (const e of G.enemies) {
        if (taken.includes(e) || e.hp <= 0) continue;
        const d = Math.hypot(e.x - fx, e.z - fz);
        if (d < bd) { bd = d; t = e; }
      }
      if (!t) break;
      taken.push(t);
      damageEnemy(t, wDmg(id, w.lvl), fx, fz);
      G.bullets.push({ x: t.x, z: t.z, vx: 0, vz: 0, life: 0.18, dmg: 0, ang: 0, hitR: 1, kind: 'zapflash', visual: true });
      fx = t.x; fz = t.z;
    }
  }
});

// ---------- the registry ----------
// EVERY id in WEAPONS must appear here — assertFireCoverage() checks it.

export const FIRE: Record<string, FireHandler> = {
  fartwhip: aimed((w, p, _n, id) => {
    const count = Math.min(3, 1 + Math.floor(w.lvl / 3));
    for (let k = 0; k < count; k++) {
      const a = p.face + (k - (count - 1) / 2) * 0.14;
      G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(a) * 300), vz: wProjSpeed(Math.sin(a) * 300), life: wDuration(0.9), dmg: wDmg('fartwhip', w.lvl), ang: a, hitR: wArea(3), kind: 'whip' });
    }
  }),
  superfart: aimed((w, p) => {
    for (let k = 0; k < 3; k++) {
      const a = p.face + (k - 1) * 0.22;
      G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(a) * 340), vz: wProjSpeed(Math.sin(a) * 340), life: wDuration(1.3), dmg: wDmg('superfart', w.lvl), ang: a, hitR: wArea(8), kind: 'superfart' });
    }
  }),
  plopcannon: aimed((w, p) => {
    G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(p.face) * 170), vz: wProjSpeed(Math.sin(p.face) * 170), life: wDuration(1.6), dmg: wDmg('plopcannon', w.lvl), ang: p.face, hitR: wArea(5), kind: 'plop' });
  }),
  bouncy: bouncyShot,
  superball: bouncyShot,
  fartbomb: bombShot,
  bigburp: bombShot,
  stickyplop: aimed((w, p) => {
    G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(p.face) * 150), vz: wProjSpeed(Math.sin(p.face) * 150), life: wDuration(1.6), dmg: wDmg('stickyplop', w.lvl), ang: p.face, hitR: wArea(6), kind: 'stickyplop', linger: 3 });
  }),
  spritz: aimed((w, p) => {
    // M7: short-range gunk cone in the facing dir
    const count = Math.min(5, 2 + Math.floor(w.lvl / 2));
    for (let k = 0; k < count; k++) {
      const a = p.face + (k - (count - 1) / 2) * 0.18;
      G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(a) * 180), vz: wProjSpeed(Math.sin(a) * 180), life: wDuration(0.5), dmg: wDmg('spritz', w.lvl), ang: a, hitR: wArea(4), kind: 'spritz' });
    }
  }),
  gunkfountain: aimed((w, p) => {
    // M7 evolution: radial gunk geyser + a lingering splash zone at your feet
    const n = 10 + w.lvl;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + G.rng() * 0.2;
      G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(a) * 200, vz: Math.sin(a) * 200, life: wDuration(0.7), dmg: wDmg('gunkfountain', w.lvl), ang: a, hitR: wArea(5), kind: 'gunk' });
    }
    G.zones.push({ x: p.x, z: p.z, r: wArea(40), life: wDuration(0.8), tick: 0.3, dmg: wDmg('gunkfountain', w.lvl) * 0.5 });
  }),
  mine: mineShot,
  minelord: mineShot,
  chainfart: chainShot,
  chainstorm: chainShot,
  crackerring: fireCrackerRing,
  halo: fireHalo,
  puddle: firePuddle,
  slakelake: fireSlakelake,
  stinkaura: fireAura,
  ghost: fireAura,
  turd: fireOrbitHeavy,
  moon: fireOrbitHeavy,
  gnat: fireGnat,
  supergnat: fireGnat,
  turret: fireTurret,
  autoblast: fireTurret,
  boomer: fireBoomer,
  cyclone: fireBoomer,
  trail: fireTrail,
  quagmire: fireTrail,
};

// ---------- coverage guard ----------
// The M18 bug, made unrepresentable: WEAPONS without a FIRE handler boots loud.

export function missingFireHandlers(): string[] {
  return Object.keys(WEAPONS).filter((id) => !FIRE[id]);
}

export function assertFireCoverage(): void {
  const missing = missingFireHandlers();
  if (missing.length > 0) {
    (globalThis as any).__capMissingFire = missing;
    console.error(`FIRE REGISTRY COVERAGE: weapons with NO fire handler: ${missing.join(', ')}`);
  }
}
