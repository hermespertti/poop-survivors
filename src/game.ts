// M19 phase 2: game module — moved verbatim from main.ts.

import { setBotDir } from './input';



import { PLAYER, RUN_LEN, WORLD_H, WORLD_W } from './constants';
import { fxReset } from './fx';
import { botDir } from './input';
import { META, saveMeta } from './meta';
import { mulberry32 } from './rng';
import { sfx } from './sfx';
import { CHARACTERS, STAGES, STAGE_IDS, UPGRADES } from './tables/chars';
import { xpToNext } from './tables/weapons';
import { Game } from './types';

export let selectedChar = 'crouton';

export let selectedStage = 'kitchen';
// M11: run-end display state (set in endRun, cleared in startRun) — the
// pre-M11 death/win screen was 3 lines of brown text; now it's stats, gold
// banked, best-time records, and a fanfare for anything THIS run unlocked.

export function cycleStage(): void {
  // advance to the next UNLOCKED stage (wrap). Repeats on the same one only
  // if it's the sole unlocked stage (kitchen-only new save).
  const cur = STAGE_IDS.indexOf(selectedStage);
  for (let i = 1; i <= STAGE_IDS.length; i++) {
    const cand = STAGE_IDS[(cur + i) % STAGE_IDS.length];
    if (STAGES[cand].unlock === 'default' || META.unlocked.includes(STAGES[cand].unlock)) { selectedStage = cand; return; }
  }
}

export let lastUnlocks: string[] = [];

export let newBestTime = false;
// M11: the gold shop — banked gold finally spends. VS-style meta progression:
// each buy is a small permanent buff, applied at the START of the next run
// (via recomputeStats, so in-run passives can't wipe it). Costs stack
// base*(lvl+1) so the late game slows. A decent run banks ~300-800, so the
// first level is 1-2 runs of play.

export let shopOpen = false;

export let shopSel = 0;

export function upLvl(id: string): number { return META.upgrades[id] || 0; }

export function upCost(id: string): number { const u = UPGRADES.find((x) => x.id === id)!; return u.price * (upLvl(id) + 1); }

export function buyUpgrade(id: string): boolean {
  const u = UPGRADES.find((x) => x.id === id)!;
  const lvl = upLvl(id);
  if (lvl >= u.max) { sfx('hurt'); return false; }
  const cost = upCost(id);
  if (META.gold < cost) { sfx('hurt'); return false; }
  META.gold -= cost;
  META.upgrades[id] = lvl + 1;
  saveMeta(META);
  sfx('levelup');
  return true;
}

export let G: Game = mkGame(1);

export function mkGame(seed: number): Game {
  const rng = mulberry32(seed);
  const ch = CHARACTERS[selectedChar];
  const st = STAGES[selectedStage];
  return {
    seed, rng, mode: 'title', time: 0,
    player: { x: WORLD_W / 2, z: WORLD_H / 2, hp: PLAYER.maxHp, face: 0, moving: false, invuln: 0, walkT: 0 },
    enemies: [], gems: [], bullets: [], zones: [], dmgNums: [], items: [],
    xp: 0, level: 1, xpNeed: xpToNext(1), gold: 0,
    weapons: { [ch.startWeapon]: { lvl: 1, cd: 0, ang: 0 } },
    passives: {},
    boss: null, chest: null, bossIdx: 0,
    flush: null, flushResolved: false, flushed: false, wall: [],
    options: [], flashT: 0, shake: 0, evolutionT: 0, evolved: false,
    kills: 0, bossKilled: 0,
    // M13: base 1.0/100 here — recomputeStats() (called by startRun) is now
    // the single source of truth for char+passive+shop stats (the pre-M13
    // baked-bonus convention meant recompute could never see new char bonuses;
    // the m2 "fresh baseline" pins apply AFTER recompute: crouton 1.1/100).
    stats: { maxLevel: 1, levelUps: 0, gems: 0, nan: 0, shots: {}, kbApplied: 0, chestTaken: 0, itemTaken: 0, dmgMult: 1, cdMult: 1, speedMult: 1, xpMult: 1, projSpeedMult: 1, areaMult: 1, durationMult: 1, goldMult: 1, maxHp: PLAYER.maxHp, turretCap: 1, boomerMult: 1, trailMult: 1 },
    spawnCd: 1.0, spawnInterval: 0.85, waveIdx: 0, itemIdx: 0,
    char: selectedChar, stage: selectedStage, armor: ch.armor,
    turrets: [], trailT: 0, trailX: 0, trailZ: 0,
  };
}

export function recomputeStats(): void {
  const p = (id: string) => G.passives[id] || 0;
  const u = (id: string) => META.upgrades[id] || 0; // M11: gold-shop levels (persist across runs)
  // M13: character bonuses folded in — recomputeStats is the single source of
  // truth for stats (the pre-M13 convention baked char bonuses in mkGame and
  // recompute only touched passives, so it could never see new char bonuses).
  // The m2/m4 pins (crouton: dmg 1.1, rest 1.0) hold because the char terms
  // are 1.0 for every non-bonus stat and 1.1 dmg for crouton.
  const ch = CHARACTERS[G.char];
  G.stats.dmgMult = (1 + 0.10 * u('dmg')) * (1 + 0.10 * p('meats')) * (1 + (ch?.dmgBonus || 0));
  G.stats.cdMult = Math.max(0.3, 1 - 0.08 * p('quick'));
  G.stats.speedMult = 1 + 0.10 * p('slippers') + (ch?.speedBonus || 0);
  G.stats.xpMult = (1 + 0.10 * u('xp')) * (1 + 0.08 * p('tp'));
  G.stats.projSpeedMult = 1 + 0.10 * p('gloves');
  G.stats.areaMult = 1 + 0.10 * p('widestink');
  G.stats.durationMult = 1 + 0.10 * p('sticky');
  G.stats.goldMult = (1 + 0.10 * u('gold')) * (1 + 0.15 * p('goldrush')) * (1 + (ch?.goldBonus || 0));
  G.stats.maxHp = PLAYER.maxHp + (ch?.hpBonus || 0) + 25 * p('breakfast') + 15 * u('hp');
  G.stats.turretCap = 1 + Math.min(2, p('ammo')); // M13: Extra Ammo → more dropped turrets
  G.stats.boomerMult = 1 + 0.10 * p('grip');      // M13: Grip → boomerang range
  G.stats.trailMult = 1 + 0.20 * p('slush');      // M13: Slush Pails → slime width
  if (G.player.hp > G.stats.maxHp) G.player.hp = G.stats.maxHp;
}

// ---------- input ----------

export function clampNum(v: number): number { if (Number.isNaN(v)) { G.stats.nan++; return 0; } return v; }

export function endRun(won: boolean, flushed: boolean): void {
  G.flushResolved = true;
  G.mode = won ? 'win' : 'dead';
  G.flushed = flushed;
  sfx(won ? 'win' : (flushed ? 'flush' : 'death'));
  // bank the run's gold into the meta wallet
  META.gold += G.gold;
  const prevBest = META.bestTime;
  META.bestTime = Math.max(META.bestTime, Math.floor(G.time));
  newBestTime = Math.floor(G.time) > prevBest && Math.floor(G.time) > 0;
  META.bestKills = Math.max(META.bestKills, G.kills);
  // unlock checks (VS: achievements-lite) — remember which are NEW this run
  const unlocks: string[] = [];
  if (won && G.time >= RUN_LEN) unlocks.push('survive5'); // bathroom stage
  if (G.time >= 600) unlocks.push('survive10'); // Hot Dog
  if (G.kills >= 500) unlocks.push('kills500'); // Avocado
  if (G.bossKilled >= 3) unlocks.push('boss3'); // M7: Plunger
  if (G.bossKilled >= 5) unlocks.push('lintking'); // M13: The Compost stage (beat the Lint King)
  if (won && G.stage === 'compost') unlocks.push('compostwin'); // M21: The Sewers stage (clear The Compost — one rung deeper)
  if (G.kills >= 1000) unlocks.push('minekill'); // M13: Cheese
  if (G.gold >= 400) unlocks.push('goldrun'); // M13: Onion (400 gold in one run)
  lastUnlocks = [];
  for (const u of unlocks) if (!META.unlocked.includes(u)) { META.unlocked.push(u); lastUnlocks.push(u); }
  if (lastUnlocks.length > 0 || G.gold > 0) saveMeta(META);
}

export function startRun(seed: number): void { G = mkGame(seed); G.mode = 'play'; setBotDir({ x: 0, y: 0 }); orbitPos = null; orbit2Pos = null; gnatPos = null; lastEvo = null; paused = false; lastUnlocks = []; newBestTime = false; fxReset(); recomputeStats(); }
// ---------- rendering ----------

export let orbitPos: { x: number; z: number; r: number } | null = null;

export let orbit2Pos: { x: number; z: number; r: number } | null = null;

export let gnatPos: { x: number; z: number } | null = null; // M8: gnat companion

export let muteMsgT = 0; // "SOUNDS MUTED" banner timer (set by the M key)

export let muteMsgOn = true; // true = banner says SOUNDS MUTED, false = SOUNDS ON

export let musicMsgT = 0; // M16: music-mute banner timer (N key)

export let musicMsgOff = false; // true = banner says MUSIC OFF, false = MUSIC ON

export let paused = false; // M7: P toggles pause (play mode only)

export let lastEvo: { base: string; passive: string; to: string } | null = null;

export function lastEvoPair(): { base: string; passive: string; to: string } | null { return lastEvo; }

export let frozen = false;
export function setPaused(v: any): void { paused = v; }
export function setMuteMsgT(v: any): void { muteMsgT = v; }
export function setSelectedChar(v: any): void { selectedChar = v; }
export function setSelectedStage(v: any): void { selectedStage = v; }
export function setFrozen(v: any): void { frozen = v; }
export function setMusicMsgT(v: any): void { musicMsgT = v; }
export function setOrbitPos(v: { x: number; z: number; r: number } | null): void { orbitPos = v; }
export function setOrbit2Pos(v: { x: number; z: number; r: number } | null): void { orbit2Pos = v; }
export function setGnatPos(v: { x: number; z: number } | null): void { gnatPos = v; }
export function setLastEvo(v: { base: string; passive: string; to: string } | null): void { lastEvo = v; }
export function setMuteMsgOn(v: any): void { muteMsgOn = v; }
export function setMusicMsgOff(v: any): void { musicMsgOff = v; }
