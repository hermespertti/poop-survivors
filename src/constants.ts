// M19 phase 1: named tuning constants extracted verbatim from main.ts.
// These are the global knobs; per-weapon/per-boss tuning lives in src/tables/.

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
export const DT = 1 / 60;
export const RUN_LEN = 1800; // 30:00 — the full director run (M3)
export const STICK_R = 40; // view units — full-stick throw
export const SPIKE_T = 720; // 12:00
export const SPIKE_EVERY = 120; // every 2 min after
export const ITEM_T = 150; // first item at 2:30, every 2.5 min after
export const META_KEY = 'poop-survivors-meta';
