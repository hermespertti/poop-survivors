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
// M23 density knob: the whole spawn pressure ×3 (user ask: "3x the enemies",
// dialed back from 10x — 3800 enemies/frame dies on the canvas, 1140 rides
// the cull). The director divides its ambient cadence (start AND floor ×1/3,
// same ramp shape), multiplies wave size/cap and the field cap by this ONE
// number; test/balance.mjs mirrors it so the heaven/spawn-rate math tracks.
// Ambient 0.85→0.285 start / 0.18→0.06 floor, waves 12→36 start / 45→135
// cap, field 380→1140.
export const DENSITY = 3;
