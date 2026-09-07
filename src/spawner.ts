// M19 phase 2: spawner module — moved verbatim from main.ts.

import { enemyHp } from './combat';
import { VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './constants';
import { G } from './game';
import { STAGES } from './tables/chars';
import { ENEMY_TYPES, SCRIPT } from './tables/enemies';

export function activeKinds(): string[] {
  const shift = STAGES[G.stage]?.scriptShift || 0;
  return SCRIPT.filter((s) => G.time >= s.t - shift).map((s) => s.kind);
}
// pick a kind by weight among active kinds

export function pickKind(): string {
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

export function spawnEnemy(kind: string): void {
  const p = G.player;
  const ang = G.rng() * Math.PI * 2;
  const dist = Math.max(VIEW_W, VIEW_H) / 2 + 40 + G.rng() * 60;
  let x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
  x = Math.max(8, Math.min(WORLD_W - 8, x));
  z = Math.max(8, Math.min(WORLD_H - 8, z));
  const t = ENEMY_TYPES[kind];
  const hp = enemyHp(kind);
  G.enemies.push({ x, z, hp, maxHp: hp, speed: t.speed, dmg: t.dmg, radius: t.radius, xp: t.xp, kind, hitT: 0, wob: G.rng() * 6.28, kbx: 0, kbz: 0, kbResist: t.kbResist });
}
// wave burst: ring of N enemies around the player (the "swarm burst")

export function spawnWave(n: number, kind?: string): void {
  const k = kind || pickKind();
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const dist = Math.max(VIEW_W, VIEW_H) / 2 + 20 + G.rng() * 20;
    const x = Math.max(8, Math.min(WORLD_W - 8, G.player.x + Math.cos(ang) * dist));
    const z = Math.max(8, Math.min(WORLD_H - 8, G.player.z + Math.sin(ang) * dist));
    const t = ENEMY_TYPES[k];
    const hp = enemyHp(k);
    G.enemies.push({ x, z, hp, maxHp: hp, speed: t.speed, dmg: t.dmg, radius: t.radius, xp: t.xp, kind: k, hitT: 0, wob: G.rng() * 6.28, kbx: 0, kbz: 0, kbResist: t.kbResist });
  }
}
// THE SPASM WALL (15:00, with The Constipation): a slow ring of tanky crumb
// enemies closing around the player. You must break out — kill a gap and dash.

export function spawnSpasmWall(): void {
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

export function spawnItem(): void {
  const p = G.player;
  const ang = G.rng() * Math.PI * 2;
  const dist = 60 + G.rng() * 120;
  const x = Math.max(20, Math.min(WORLD_W - 20, p.x + Math.cos(ang) * dist));
  const z = Math.max(20, Math.min(WORLD_H - 20, p.z + Math.sin(ang) * dist));
  G.items.push({ x, z, kind: G.rng() < 0.7 ? 'gold' : 'heal' });
}
// ---------- xp / level ----------
