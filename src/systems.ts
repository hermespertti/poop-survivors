// M19 phase 2: systems module — moved verbatim from main.ts.


import { setGnatPos, setLastEvo, setOrbit2Pos, setOrbitPos } from './game';

import { damageEnemy, nearestEnemy, wArea, wCd, wDmg, wDuration, wProjSpeed } from './combat';
import { DT, WORLD_H, WORLD_W } from './constants';
import { fxBossKill, fxEvolve, fxFlushKill } from './fx';
import { G, endRun, gnatPos, lastEvo, orbit2Pos, orbitPos, recomputeStats } from './game';
import { sfx } from './sfx';
import { BOSS_STATS } from './tables/enemies';
import { WEAPONS } from './tables/weapons';
import { Enemy } from './types';

export function fireWeapons(): void {
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
      // M13: the shards ARE the ring now — N cracker chunks at even angles
      // around the band (N grows with level, 4 → 8), derived at render from
      // w.ang (the same spin the damage band rides). Pre-M13 it was ONE shard
      // marker + a 30%-alpha circle, so the visual (a dot) didn't match the
      // mechanic (a full ring) — human feedback: "no indicator it even works".
      setOrbitPos({ x: p.x + Math.cos(w.ang) * r, z: p.z + Math.sin(w.ang) * r, r: r + 6 });
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
    if (id === 'halo') {
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
        const dmg = wDmg('halo', w.lvl);
        for (const e of G.enemies) {
          if (Math.hypot(e.x - p.x, e.z - p.z) < r + e.radius) damageEnemy(e, dmg, p.x, p.z);
        }
        for (let wi = G.wall.length - 1; wi >= 0; wi--) {
          const e = G.wall[wi];
          if (Math.hypot(e.x - p.x, e.z - p.z) < r + e.radius) damageWall(e, dmg, p.x, p.z, wi);
        }
        if (G.boss && Math.hypot(G.boss.x - p.x, G.boss.z - p.z) < r + G.boss.radius) hitBoss(dmg, p.x, p.z);
        if (G.flush && Math.hypot(G.flush.x - p.x, G.flush.z - p.z) < r + G.flush.radius) hitFlush(dmg, p.x, p.z);
      }
      setOrbitPos({ x: p.x + Math.cos(w.ang) * r, z: p.z + Math.sin(w.ang) * r, r: r + 6 });
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
    if (id === 'slakelake') {
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
      setOrbit2Pos({ x: ox, z: oz, r: rr });
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
    if (id === 'gnat' || id === 'supergnat') {
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
      continue;
    }
    if (id === 'turret' || id === 'autoblast') {
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
      continue;
    }
    if (id === 'boomer' || id === 'cyclone') {
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
      continue;
    }
    if (id === 'trail' || id === 'quagmire') {
      // M13 Slime Trail: a damaging muck drops BEHIND you as you move (like
      // VS' Vito trail). The weapon cd gates each drop; Slush Pails widens the
      // slick, Sticky lengthens it. QUAGMIRE: wider, longer, more frequent.
      if (w.cd <= 0) {
        w.cd = wCd(id, w.lvl);
        // moving? (walked since the last drop) — the trail follows your feet,
        // it doesn't pour at you while you stand still
        const dxm = p.x - G.trailX, dzm = p.z - G.trailZ;
        const moved = G.trailT === 0 || Math.hypot(dxm, dzm) > 4;
        if (!moved) continue;
        G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
        const r = (id === 'quagmire' ? 15 : 10) * wArea(1) * G.stats.trailMult;
        // drop slightly BEHIND the player along their last movement so the
        // blobs string out into a trail.
        const mdd = Math.hypot(dxm, dzm) || 1;
        const bx = p.x - (dxm / mdd) * 6, bz = p.z - (dzm / mdd) * 6;
        G.zones.push({ x: bx, z: bz, r, life: wDuration(id === 'quagmire' ? 2.4 : 1.2), tick: 0.35, dmg: wDmg(id, w.lvl), tint: '#3fa34d' });
        G.trailX = p.x; G.trailZ = p.z; G.trailT = G.time;
      }
      continue;
    }
    if (w.cd > 0) continue;
    const n = nearestEnemy(240);
    if (!n) continue;
    p.face = Math.atan2(n.e.z - p.z, n.e.x - p.x);
    w.cd = wCd(id, w.lvl);
    G.stats.shots[id] = (G.stats.shots[id] || 0) + 1;
    sfx('shoot'); // one blip per weapon volley (not per bullet)
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
    } else if (id === 'spritz') {
      // M7: short-range gunk cone in the facing dir
      const count = Math.min(5, 2 + Math.floor(w.lvl / 2));
      for (let k = 0; k < count; k++) {
        const a = p.face + (k - (count - 1) / 2) * 0.18;
        G.bullets.push({ x: p.x, z: p.z, vx: wProjSpeed(Math.cos(a) * 180), vz: wProjSpeed(Math.sin(a) * 180), life: wDuration(0.5), dmg: wDmg('spritz', w.lvl), ang: a, hitR: wArea(4), kind: 'spritz' });
      }
    } else if (id === 'gunkfountain') {
      // M7 evolution: radial gunk geyser + a lingering splash zone at your feet
      const n = 10 + w.lvl;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + G.rng() * 0.2;
        G.bullets.push({ x: p.x, z: p.z, vx: Math.cos(a) * 200, vz: Math.sin(a) * 200, life: wDuration(0.7), dmg: wDmg('gunkfountain', w.lvl), ang: a, hitR: wArea(5), kind: 'gunk' });
      }
      G.zones.push({ x: p.x, z: p.z, r: wArea(40), life: wDuration(0.8), tick: 0.3, dmg: wDmg('gunkfountain', w.lvl) * 0.5 });
    } else if (id === 'mine' || id === 'minelord') {
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
    } else if (id === 'chainfart' || id === 'chainstorm') {
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
    }
  }
}

// ---------- bosses (M3 schedule) ----------
// 5 bosses on the script + THE FINAL FLUSH at 30:00. Each boss has its own
// behavior; killing one drops a chest (10:00+ chests are evolution-grade).
// boss behavior data per kind

export function spawnBoss(kind: string, name: string): void {
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

export function hitBoss(dmg: number, srcX: number, srcZ: number): void {
  const b = G.boss;
  if (!b) return;
  b.hp -= dmg; b.hitT = 0.1;
  G.dmgNums.push({ x: b.x, z: b.z - 10, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  sfx('hit'); // boss hit — heavier clatter than an enemy hit
  if (b.hp <= 0) {
    G.boss = null;
    G.bossKilled++;
    sfx('chest'); // boss dies → the chest fanfare (drop is the chest)
    // BOSS DROPS (VS rule): a chest ALWAYS + a gold bag. Chests from the
    // 10:00+ bosses (COLONEL C onward) are evolution-grade (they can resolve
    // an evolution); earlier chests fall through to gold+heal if no evo.
    G.chest = { x: b.x, z: b.z };
    G.items.push({ x: b.x + 20, z: b.z, kind: 'gold' });
    G.shake = 10; G.flashT = 0.4;
    fxBossKill(b.x, b.z); // M15 FX: the boss-death shockwave
  }
}
// wall units are tanky; killing one leaves a gap (the wall is just an array)

export function damageWall(e: Enemy, dmg: number, srcX: number, srcZ: number, idx: number): void {
  e.hp -= dmg; e.hitT = 0.12;
  G.dmgNums.push({ x: e.x, z: e.z - 6, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  const dx = e.x - srcX, dz = e.z - srcZ;
  const d = Math.hypot(dx, dz) || 1;
  e.kbx += (dx / d) * 20; e.kbz += (dz / d) * 20; // wall resists knockback
  if (e.hp <= 0) {
    G.wall.splice(idx, 1);
    G.kills++;
    sfx('pop');
  }
}
// THE FINAL FLUSH: killable → victory + bonus gold; touching you → flushed

export function hitFlush(dmg: number, srcX: number, srcZ: number): void {
  const f = G.flush;
  if (!f) return;
  f.hp -= dmg; f.hitT = 0.1;
  G.dmgNums.push({ x: f.x, z: f.z - 12, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  sfx('hit'); // flush takes a hit — the same clatter as an enemy hit
  if (f.hp <= 0) {
    fxFlushKill(f.x, f.z); // M15 FX: the Flush's victory burst (before null)
    G.flush = null;
    G.gold += Math.round(500 * G.stats.goldMult); // bonus gold for killing the Flush
    sfx('win');
    endRun(true, false);
    G.shake = 12; G.flashT = 0.5;
  }
}

// ---------- evolution (M4: generalized — any evo-ready base + its passive) ----------

export function evoReady(): { baseId: string; toId: string } | null {
  for (const id of Object.keys(WEAPONS)) {
    const w = WEAPONS[id];
    if (w.evolved || !w.evoWith || !w.evolvesTo) continue;
    if ((G.weapons[id]?.lvl || 0) >= w.maxLvl && (G.passives[w.evoWith] || 0) >= 1) {
      return { baseId: id, toId: w.evolvesTo };
    }
  }
  return null;
}

export function resolveChest(): void {
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
    fxEvolve(G.player.x, G.player.z); // M15 FX: the evolution sting
    sfx('evolution');
    setLastEvo({ base: rdy.baseId, passive: req, to: rdy.toId });
  } else {
    G.gold += Math.round(50 * G.stats.goldMult);
    G.player.hp = Math.min(G.stats.maxHp, G.player.hp + 25); // M10k: clamp to EXPANDED maxHp so breakfast (+25/stack) can be held, not just buffered
    sfx('chest');
  }
  G.chest = null;
}

// ---------- spawning (M3 director) ----------
// The director script is a fixed event timeline (VS rule #5: escalation is a
// script, not a sim). Enemy types unlock on schedule; density scales on script;
// wave bursts repeat. spawnEnemy(kind) is the single entry point.
// script: [time, kind, weight] — weight = share of spawns while active
// density spikes (30s of extra spawns): first at 12:00, repeats every 2 min
// active kinds at time T (all kinds whose unlock time has passed).
// STAGE VARIANT (M7): the bathroom shifts the whole script 60s EARLIER —
// the same run, but the kitchen's 1:00 pressure hits you at 0:00. That is
// the stage's difficulty, scripted not simulated (VS rule #5).
