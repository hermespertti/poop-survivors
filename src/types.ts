// M19 phase 1: all entity/state types, extracted verbatim from main.ts.

export const TILE = 16;
export const WORLD_W = 1280;
export const WORLD_H = 800;
export const VIEW_W = 320;
export const VIEW_H = 240;
export const PLAYER = {
  maxHp: 100, speed: 90, radius: 5,
  magnetBase: 26, magnetPerLevel: 1.5,
  invulnAfterHit: 0.8,
  invulnOnLevel: 1.2,
};
export const STICK_R = 40; // view units — full-stick throw
export const DT = 1 / 60;
export const RUN_LEN = 1800; // 30:00 — the full director run (M3)
export const SPIKE_T = 720; // 12:00
export const SPIKE_EVERY = 120; // every 2 min after
export const ITEM_T = 150; // first item at 2:30, every 2.5 min after
export const META_KEY = 'poop-survivors-meta';
export type Enemy = {
  x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number;
  radius: number; xp: number; kind: string; hitT: number; wob: number;
  kbx: number; kbz: number; spitCd?: number; kbResist?: number;
};
export type Gem = { x: number; z: number; val: number; vx: number; vz: number; pulled: boolean };
export type Bullet = { x: number; z: number; vx: number; vz: number; life: number; dmg: number; ang: number; hitR: number; kind: string; bounces?: number; bounceSpeed?: number; linger?: number; hitIds?: number[]; enemy?: boolean; visual?: boolean; blast?: number; dir?: number; returnHits?: number };
export type Zone = { x: number; z: number; r: number; life: number; tick: number; dmg: number; tint?: string; drag?: number };
export type Turret = { x: number; z: number; cd: number; life: number; dmg: number; angle: number; rate: number; spread: number };
export type DmgNum = { x: number; z: number; vy: number; t: number; txt: string; crit: boolean };
export type Mode = 'title' | 'play' | 'levelup' | 'dead' | 'win';
export type WState = { lvl: number; cd: number; ang: number };
export type ItemOpt = { kind: 'weapon' | 'passive' | 'gold' | 'hp'; id: string; name: string; desc: string; lvl: number };
export type Boss = {
  x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number;
  radius: number; hitT: number; minionCd: number; wob: number;
  kind: string; name: string; phase2: boolean; chargeCd: number; dashT: number;
  aimT: number; lockAng: number;
};
export type Item = { x: number; z: number; kind: 'gold' | 'heal' };
export type Game = {
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
  flushKilled: boolean; // M22: any Flush killed this run (unlock: flushkill → The Septic Tank)
  flushBack: number; // M22 septic: game-time the slain early Flush reforms and hunts again (0 = unset)
  stats: {
    maxLevel: number; levelUps: number; gems: number; nan: number;
    shots: Record<string, number>; kbApplied: number; chestTaken: number; itemTaken: number;
    dmgMult: number; cdMult: number; speedMult: number; xpMult: number;
    projSpeedMult: number; areaMult: number; durationMult: number; maxHp: number;
    goldMult: number;
    turretCap: number; // M13: max dropped turrets (1 + Extra Ammo levels, capped 3)
    boomerMult: number; // M13: Gunk Boomer range (1 + Grip levels)
    trailMult: number; // M13: Slime Trail width (1 + Slush Pails levels)
  };
  spawnCd: number; spawnInterval: number; waveIdx: number; itemIdx: number;
  char: string; stage: string; armor: number;
  turrets: Turret[]; // M13: dropped Plop Turrets (stationary, fire for you)
  trailT: number; // M13: Slime Trail drop cadence
  trailX: number; trailZ: number; // M13: last position the trail was dropped at
};
export type Meta = { gold: number; unlocked: string[]; achievements: string[]; bestTime: number; bestKills: number; upgrades: Record<string, number> };
