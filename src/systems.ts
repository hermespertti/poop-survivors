// M19 phase 2: systems module — moved verbatim from main.ts.
// M20: fireWeapons() is now a thin dispatch over the FIRE registry (fire.ts);
// the M18 dead-evolution bug class is structurally closed at boot via
// assertFireCoverage().

import { setLastEvo } from './game';

import { DT, WORLD_H, WORLD_W } from './constants';
import { fxBossKill, fxEvolve, fxFlushKill } from './fx';
import { FIRE } from './fire';
import { G, endRun, recomputeStats } from './game';
import { sfx } from './sfx';
import { BOSS_STATS } from './tables/enemies';
import { WEAPONS } from './tables/weapons';
import { Enemy } from './types';

export function fireWeapons(): void {
  const p = G.player;
  for (const id of Object.keys(G.weapons)) {
    const w = G.weapons[id];
    w.cd -= DT;
    // M20: every weapon's behavior lives in FIRE[id] (fire.ts). The dispatch
    // order (Object.keys insertion order, cd ticked before the handler) is
    // the fingerprint-frozen old-chain order — do not reorder.
    FIRE[id]?.(w, p, id);
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
