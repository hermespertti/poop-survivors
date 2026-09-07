// M19: sprite pickers — kind -> art sprite resolution (data tables live in
// tables/sprites.ts; these are the tiny resolvers the renderer calls).
import { SPRITES } from './art';
import { ENEMY_SPR, BOSS_SPR } from './tables/sprites';

// M19: sprite pickers — kind -> art sprite resolution (data tables live in
// tables/sprites.ts; these are the tiny resolvers the renderer calls).
import { SPRITES } from './art';
import { ENEMY_SPR, BOSS_SPR } from './tables/sprites';

// sprite pickers for the M3 roster
export function enemySprite(kind: string, hit: boolean): any {
  const e = ENEMY_SPR[kind] || ENEMY_SPR.bubble;
  return SPRITES[hit ? e.hit : e.spr];
}
export function bossSprite(kind: string): { spr: any; hit: any } {
  const e = BOSS_SPR[kind] || BOSS_SPR.wind;
  return { spr: SPRITES[e.spr], hit: SPRITES[e.hit] };
}
// sprite pickers for the M3 roster
export function enemySprite(kind: string, hit: boolean): any {
  const e = ENEMY_SPR[kind] || ENEMY_SPR.bubble;
  return SPRITES[hit ? e.hit : e.spr];
}
export function bossSprite(kind: string): { spr: any; hit: any } {
  const e = BOSS_SPR[kind] || BOSS_SPR.wind;
  return { spr: SPRITES[e.spr], hit: SPRITES[e.hit] };
}
