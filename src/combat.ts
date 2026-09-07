// M19 phase 2: combat module — moved verbatim from main.ts.


import { fxKill } from './fx';
import { G } from './game';
import { sfx } from './sfx';
import { ENEMY_TYPES } from './tables/enemies';
import { WEAPONS } from './tables/weapons';
import { Enemy } from './types';

export function wDmg(id: string, lvl: number): number { return (WEAPONS[id].baseDmg + WEAPONS[id].dmgPerLvl * (lvl - 1)) * G.stats.dmgMult; }

export function wCd(id: string, lvl: number): number { return Math.max(0.15, (WEAPONS[id].baseCd + WEAPONS[id].cdPerLvl * (lvl - 1)) * G.stats.cdMult); }
// M4 scaling helpers: passives feed these (VS: weapons scale with these stats)

export function wProjSpeed(v: number): number { return v * G.stats.projSpeedMult; }

export function wArea(v: number): number { return v * G.stats.areaMult; }

export function wDuration(v: number): number { return v * G.stats.durationMult; }

// ---------- characters (M4) ----------

// ---------- enemies (M3 roster, M7 extensions, M13 heavy/KB-resistant) ----------
// enemy archetype data table (per the GDD director script)
// bubble: chaser. droplet: fast thin. crumb: tanky slow. mop: swarmer (weak,
// many). stink: slow heavy cloud. sponge: shielded (takes half damage).
// splitter (M7): big lump, splits into two mops on death. spitter (M7):
// ranged — holds its distance band and lobs gunk shots.
// boulder (M13): heavy armored lump — high HP, shrugs off knockback.
// shell (M13): spiked shell — medium HP, shrugs off knockback.
// spawn-time HP scaling (VS: enemies get tankier over the run)

export function enemyHp(kind: string): number {
  const base = ENEMY_TYPES[kind].hp;
  return base * (1 + G.time / 90);
}
// M14: enemy DAMAGE now scales too. Pre-M14 it didn't — HP ramped 21x by
// 30:00 but a Lint King hit for 13 at 2:00 AND 13 at 29:00. The bot (and a
// player) won a pure tankiness race with zero lethality race, so after the
// M14 ring nerf the natural soak went 1/10 -> 0/10 deaths, 100% HP in every
// band, boss 6/6: the gate's "0 = too easy" and the GDD's "decent-but-not-
// invincible, loses to specific bad rolls" shape both say the endgame needs
// real threat. Ramp is 1.0 -> ~1.3 over the run (/6000). Tuned by soak:
// /3000 (1.6x) gave 6/10 deaths (too hot), /6000 (1.3x) lands the 1-5 band.
// Much milder than the 21x HP ramp, so the early game (where the bot
// historically dies) is nearly untouched and only the 15-30 min boss gauntlet
// feels lethal. Applied at every enemy->player hit site (contact, boss,
// flush, enemy bullet) before armor subtraction.

export function eDmg(base: number): number { return base * (1 + G.time / 6000); }
// M13: a dropped Plop Turret — stationary, fires for you on its own cadence.

export function nearestEnemy(maxD = 1e9): { e: Enemy; d: number } | null {
  let best: Enemy | null = null, bd = maxD;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - G.player.x, e.z - G.player.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}
// for bouncy ricochets: nearest enemy from a POINT, excluding one enemy

export function nearestEnemyExcluding(ex: Enemy, maxD: number): { e: Enemy; d: number } | null {
  let best: Enemy | null = null, bd = maxD;
  for (const e of G.enemies) {
    if (e === ex || e.hp <= 0) continue;
    const d = Math.hypot(e.x - ex.x, e.z - ex.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}

export function damageEnemy(e: Enemy, dmg: number, srcX: number, srcZ: number): void {
  e.hp -= dmg; e.hitT = 0.12;
  if (e.hitT >= 0.12) sfx('hit'); // only on fresh contact (not every re-hit)
  G.dmgNums.push({ x: e.x, z: e.z - 6, vy: -22, t: 0.7, txt: String(Math.round(dmg)), crit: false });
  // knockback, away from the hit source (VS-style; boss resists). M13: heavy
  // enemies (boulder/shell) ignore a share of knockback — they don't flinch.
  const dx = e.x - srcX, dz = e.z - srcZ;
  const d = Math.hypot(dx, dz) || 1;
  const kb = 70 * (1 - (ENEMY_TYPES[e.kind].kbResist || 0));
  e.kbx += (dx / d) * kb; e.kbz += (dz / d) * kb;
  G.stats.kbApplied++;
  if (e.hp <= 0) {
    G.kills++;
    const idx = G.enemies.indexOf(e);
    if (idx >= 0) G.enemies.splice(idx, 1);
    // splitter (M7): death splits into two mops — the "big lump" payoff
    if (e.kind === 'splitter') {
      for (let s2 = 0; s2 < 2; s2++) {
        const a = G.rng() * Math.PI * 2;
        G.enemies.push({ x: e.x + Math.cos(a) * 6, z: e.z + Math.sin(a) * 6, hp: enemyHp('mop'), maxHp: enemyHp('mop'), speed: ENEMY_TYPES.mop.speed, dmg: ENEMY_TYPES.mop.dmg, radius: ENEMY_TYPES.mop.radius, xp: ENEMY_TYPES.mop.xp, kind: 'mop', hitT: 0, wob: G.rng() * 6.28, kbx: 0, kbz: 0 });
      }
    }
    G.gems.push({ x: e.x, z: e.z, val: e.xp, vx: (G.rng() - 0.5) * 40, vz: (G.rng() - 0.5) * 40, pulled: false });
    fxKill(e.x, e.z); // M15 FX: kill burst (cosmetic queue — never touches G.rng/G stats)
    sfx('pop'); // enemy dies — a squishy little pop
  }
}

// ---------- weapon firing ----------
