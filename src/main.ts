// POOP SURVIVORS — M2

import { setBotDir } from './input';

import { camFXy } from './render';

import { setFrozen, setSelectedChar, setSelectedStage } from './game';

import { ctx, fitCanvas } from './canvas';
import { G, frozen, lastEvo, orbitPos, paused, recomputeStats, selectedChar, selectedStage, startRun } from './game';
import { COARSE, botDir, currentMove, stick } from './input';
import { gainXp, pickOption } from './levelup';
import { camFXx, render } from './render';
import { pickKind, spawnEnemy, spawnItem, spawnSpasmWall } from './spawner';
import { evoReady, spawnBoss } from './systems';
import { update } from './update';
// M1 core loop + the weapon FRAMEWORK: weapons as a data table, passive stat
// multipliers, knockback, a boss (The First Wind) at 3:00, and the chest →
// evolution system (Fart Whip max + Quick Hands + chest = SUPER FART).
// Top-down 2D canvas, fixed timestep, seeded determinism, __cap probe.
// Art: hand-authored pixel arrays over one 16-color palette, 8x8 bitmap font.

import { PALETTE, SPRITES, drawSprite, drawSpriteFlipped, drawScaled, drawText } from './art';
import { sfx, toggleMute, toggleMusicMute, muted, musicIntensity } from './sfx';
import { fxKill, fxGem, fxLevelUp, fxEvolve, fxBossKill, fxFlushKill, fxTick, fxDraw, fxState, fxReset } from './fx';

// ---------- deterministic RNG (mulberry32) ----------
import {
  TILE, WORLD_W, WORLD_H, VIEW_W, VIEW_H, PLAYER, DT, RUN_LEN, STICK_R,
  SPIKE_T, SPIKE_EVERY, ITEM_T
} from './constants';
import type {
  Enemy, Gem, Bullet, Zone, Turret, DmgNum, Mode, WState, ItemOpt, Game, Meta, Boss
} from './types';
import { WEAPONS, PASSIVES, xpToNext } from './tables/weapons';
import { CHARACTERS, STAGES, STAGE_IDS, UPGRADES } from './tables/chars';
import { ENEMY_TYPES, BOSS_SCHEDULE, BOSS_STATS, SCRIPT } from './tables/enemies';
import { ENEMY_SPR, BOSS_SPR, UNLOCK_LABEL } from './tables/sprites';
import { mulberry32 } from './rng';
import { META, saveMeta, resetMeta } from './meta';
import { enemySprite, bossSprite } from './sprites';


ctx.imageSmoothingEnabled = false;
window.addEventListener('resize', fitCanvas);
fitCanvas();

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  if (!frozen) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 8) { update(); acc -= DT; steps++; }
  }
  render(now / 1000);
  // M15 FX: age the particle sim on the WALL clock (rAF), never the game DT —
  // a frozen run still animates its FX, and a stepped soak never advances it.
  fxTick(now);
  fxDraw(camFXx, camFXy);
}
requestAnimationFrame(frame);

// M6: register the PWA service worker (offline shell + hashed assets).
// GH Pages serves the repo sub-path, so sw.js must scope to the page's own
// directory (vite base './' keeps the bundle path-relative too).
if ('serviceWorker' in navigator && !location.hostname.includes('localhost')) {
  const swScope = location.href.replace(/[^/]*$/, '');
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swScope + 'sw.js', { scope: swScope })
      .catch(() => { /* dev/hmr or non-https: the game still plays online */ });
  });
}

// ---------- __cap probe ----------
const win = window;
(win as any).__cap = {
  state: () => ({
    mode: G.mode, time: +G.time.toFixed(3), paused: paused, // M11: paused readback (mobile button soak)
    x: +G.player.x.toFixed(2), z: +G.player.z.toFixed(2),
    hp: G.player.hp, level: G.level, xp: +G.xp.toFixed(2), xpNeed: G.xpNeed,
    gold: G.gold,
    char: G.char, stage: G.stage, armor: G.armor, maxHp: G.stats.maxHp,
    meta: { gold: META.gold, unlocked: [...META.unlocked], achievements: [...META.achievements], bestTime: META.bestTime, bestKills: META.bestKills, upgrades: { ...META.upgrades } },
    options: G.mode === 'levelup' ? G.options.map((o) => ({ kind: o.kind, id: o.id, name: o.name, lvl: o.lvl })) : [],
    weapons: Object.fromEntries(Object.entries(G.weapons).map(([k, v]) => [k, v.lvl])),
    passives: { ...G.passives },
    evolved: G.evolved, boss: G.boss ? { x: +G.boss.x.toFixed(1), z: +G.boss.z.toFixed(1), hp: Math.round(G.boss.hp), name: G.boss.name, kind: G.boss.kind, phase2: G.boss.phase2 } : null,
    chest: G.chest ? { x: +G.chest.x.toFixed(1), z: +G.chest.z.toFixed(1) } : null,
    flush: G.flush ? { hp: Math.round(G.flush.hp), maxHp: G.flush.maxHp, x: +G.flush.x.toFixed(1), z: +G.flush.z.toFixed(1) } : null,
    flushResolved: G.flushResolved, flushed: G.flushed,
    bossIdx: G.bossIdx,
    wall: G.wall.length, items: G.items.length,
    enemies: G.enemies.length, gems: G.gems.length, bullets: G.bullets.length, zones: G.zones.length,
    kills: G.kills, bossKilled: G.bossKilled,
    fx: fxState(), // M15: the FX event queue (emitted works even without a GPU)
    world: { w: WORLD_W, h: WORLD_H },
    stats: {
      maxLevel: G.stats.maxLevel, levelUps: G.stats.levelUps, gems: G.stats.gems,
      nan: G.stats.nan, shots: { ...G.stats.shots }, kbApplied: G.stats.kbApplied,
      chestTaken: G.stats.chestTaken, itemTaken: G.stats.itemTaken,
      dmgMult: +G.stats.dmgMult.toFixed(3), cdMult: +G.stats.cdMult.toFixed(3),
      speedMult: +G.stats.speedMult.toFixed(3), xpMult: +G.stats.xpMult.toFixed(3),
      projSpeedMult: +G.stats.projSpeedMult.toFixed(3), areaMult: +G.stats.areaMult.toFixed(3),
      durationMult: +G.stats.durationMult.toFixed(3), goldMult: +G.stats.goldMult.toFixed(3), maxHp: G.stats.maxHp,
      turretCap: G.stats.turretCap, boomerMult: +G.stats.boomerMult.toFixed(3), trailMult: +G.stats.trailMult.toFixed(3), // M13
    },
  }),
  xpCurve: (lvl: number) => xpToNext(lvl),
  restart: (seed: number) => { startRun(seed); return (win as any).__cap.state(); },
  // restart + start immediately (bypasses the title screen: startRun sets mode
  // to play; a subsequent update() in title mode would consume SPACE and restart)
  restartPlay: (seed: number) => { startRun(seed); return (win as any).__cap.state(); },
  set: (k: string, v: any) => {
    if (k === 'hp') G.player.hp = v;
    if (k === 'xp') G.xp = v;
    if (k === 'level') { G.level = v; G.xpNeed = xpToNext(v); }
    if (k === 'mode') G.mode = v as Mode;
    if (k === 'time') G.time = v;
    if (k === 'pos') { G.player.x = v[0]; G.player.z = v[1]; }
    if (k === 'bossHp' && G.boss) G.boss.hp = v;
    if (k === 'bossIdx') G.bossIdx = v;
    if (k === 'flushResolved') G.flushResolved = v;
  },
  gainXp: (amt: number) => { if (G.mode === 'play') gainXp(amt); return (win as any).__cap.state(); },
  pick: (i: number) => { pickOption(i); return (win as any).__cap.state(); },
  spawn: (n = 1, kind?: string) => { for (let i = 0; i < n; i++) spawnEnemy(kind || pickKind()); return (win as any).__cap.state(); },
  move: (x: number, y: number) => { setBotDir({ x, y }); },
  spawnBoss: (kind?: string) => {
    G.boss = null;
    if (kind) { const ev = BOSS_SCHEDULE.find((e) => e.kind === kind) || BOSS_SCHEDULE[0]; spawnBoss(ev.kind, ev.name); }
    else spawnBoss('wind', 'THE FIRST WIND');
    return (win as any).__cap.state();
  },
  spawnWall: () => { spawnSpasmWall(); return (win as any).__cap.state(); },
  spawnFlush: () => {
    const st = BOSS_STATS.flush;
    G.flush = { x: Math.max(20, Math.min(WORLD_W - 20, G.player.x + 240)), z: Math.max(20, Math.min(WORLD_H - 20, G.player.z)), hp: st.hp, maxHp: st.hp, speed: st.speed, dmg: st.dmg, radius: st.radius, hitT: 0, wob: 0 };
    return (win as any).__cap.state();
  },
  spawnItem: (kind?: string) => { spawnItem(); if (kind && G.items.length) G.items[G.items.length - 1].kind = (kind as 'gold' | 'heal'); return (win as any).__cap.state(); },
  setFlushHp: (hp: number) => { if (G.flush) { G.flush.hp = hp; G.flush.maxHp = Math.max(G.flush.maxHp, hp); } return (win as any).__cap.state(); },
  setWallHp: (i: number, hp: number) => { if (G.wall[i]) { G.wall[i].hp = hp; G.wall[i].maxHp = Math.max(G.wall[i].maxHp, hp); } return (win as any).__cap.state(); },
  wallList: () => G.wall.map((e) => ({ x: e.x, z: e.z, hp: +e.hp.toFixed(1), d: Math.hypot(e.x - G.player.x, e.z - G.player.z) })),
  itemList: () => G.items.map((it) => ({ x: it.x, z: it.z, kind: it.kind })),
  lastKinds: () => G.enemies.slice(-30).map((e) => e.kind),
  clearEnemies: () => { G.enemies.length = 0; return (win as any).__cap.state(); },
  bossSchedule: () => BOSS_SCHEDULE.map((e) => ({ t: e.t, name: e.name, kind: e.kind })),
  giveWeapon: (id: string, lvl = 1) => { G.weapons[id] = { lvl, cd: 0, ang: G.rng() * 6.28 }; return (win as any).__cap.state(); },
  givePassive: (id: string, lvl = 1) => { G.passives[id] = lvl; recomputeStats(); return (win as any).__cap.state(); },
  // grant on the CURRENT run (post-restart head start for soak harnesses)
  giveWeaponNow: (id: string, lvl = 1) => { G.weapons[id] = { lvl, cd: 0, ang: G.rng() * 6.28 }; return (win as any).__cap.state(); },
  givePassiveNow: (id: string, lvl = 1) => { G.passives[id] = lvl; recomputeStats(); return (win as any).__cap.state(); },
  evoReady: () => evoReady(),
  lastEvo: () => lastEvo,
  selectChar: (id: string) => {
    const ch = CHARACTERS[id];
    if (!ch) return { err: 'no char ' + id };
    if (ch.unlock !== 'default' && !META.unlocked.includes(ch.unlock)) return { err: 'locked: ' + ch.unlock };
    setSelectedChar(id);
    return { ok: true, char: selectedChar };
  },
  selectStage: (id: string) => {
    const st = STAGES[id];
    if (!st) return { err: 'no stage ' + id };
    if (st.unlock !== 'default' && !META.unlocked.includes(st.unlock)) return { err: 'locked: ' + st.unlock };
    setSelectedStage(id);
    return { ok: true, stage: selectedStage };
  },
  metaReset: () => { resetMeta(); return (win as any).__cap.state(); },
  metaGive: (unlock: string) => { if (!META.unlocked.includes(unlock)) META.unlocked.push(unlock); saveMeta(META); return (win as any).__cap.state(); },
  metaGold: (n: number) => { META.gold = n; saveMeta(META); return (win as any).__cap.state(); },
  metaUpgrade: (id: string, lvl = 1) => { META.upgrades[id] = lvl; saveMeta(META); return (win as any).__cap.state(); }, // M11: seed shop levels (soak harness)
  chars: () => Object.keys(CHARACTERS).map((id) => ({ id, name: CHARACTERS[id].name, unlock: CHARACTERS[id].unlock, startWeapon: CHARACTERS[id].startWeapon })),
  stages: () => Object.keys(STAGES).map((id) => ({ id, name: STAGES[id].name, unlock: STAGES[id].unlock, scriptShift: STAGES[id].scriptShift })),
  enemiesNear: (r: number) => G.enemies.filter((e) => Math.hypot(e.x - G.player.x, e.z - G.player.z) < r).length,
  // nearest INCOMING enemy bullets (spitter gunk etc) — soak bots use this to
  // dodge like a human (the m3 endgame wall was the bot standing still in a
  // 160u gunk field, blind to projectiles)
  enemyBullets: (n = 10) => {
    return G.bullets.filter((b) => b.enemy)
      .map((b) => ({ x: b.x, z: b.z, vx: b.vx, vz: b.vz, d: Math.hypot(b.x - G.player.x, b.z - G.player.z) }))
      .sort((a, b) => a.d - b.d).slice(0, n);
  },
  // M18: active damage zones (the Slime Lake drag assertion reads drag from here)
  zones: () => G.zones.map((z) => ({ x: +z.x.toFixed(1), z: +z.z.toFixed(1), r: +z.r.toFixed(1), drag: z.drag || 0 })),
  enemies: (n = 8) => {
    const arr = G.enemies.map((e) => ({ x: e.x, z: e.z, hp: +e.hp.toFixed(1), d: Math.hypot(e.x - G.player.x, e.z - G.player.z), kx: +e.kbx.toFixed(1), kz: +e.kbz.toFixed(1) })).sort((a, b) => a.d - b.d).slice(0, n);
    return arr;
  },
  setEnemyPos: (i: number, x: number, z: number) => {
    if (G.enemies[i]) { G.enemies[i].x = x; G.enemies[i].z = z; G.enemies[i].kbx = 0; G.enemies[i].kbz = 0; }
    return (win as any).__cap.state();
  },
  setEnemyHp: (i: number, hp: number) => {
    if (G.enemies[i]) { G.enemies[i].hp = hp; G.enemies[i].maxHp = Math.max(hp, G.enemies[i].maxHp); }
    return (win as any).__cap.state();
  },
  nearestGem: () => {
    let best: Gem | null = null, bd = 1e9;
    for (const g of G.gems) { const d = Math.hypot(g.x - G.player.x, g.z - G.player.z); if (d < bd) { bd = d; best = g; } }
    return best ? { x: best.x, z: best.z, d: bd } : null;
  },
  // determinism probes
  freeze: () => { setFrozen(true); },
  unfreeze: () => { setFrozen(false); },
  step: () => { update(); return (win as any).__cap.state(); },
  // M6 mobile probes: the touch UI is real DOM/pointer code — these let a soak
  // drive the ACTUAL widget path (dispatched pointer events) and read back
  // what currentMove() would consume, instead of injecting botDir directly.
  isTouch: () => COARSE,
  stickState: () => ({ a: stick.active, id: stick.id, x: +stick.x.toFixed(3), z: +stick.z.toFixed(3) }),
  moveVec: () => currentMove(),
  botDir: () => ({ x: botDir.x, y: botDir.y }),
  manifest: () => (document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null)?.href || null,
  sw: () => ('serviceWorker' in navigator) ? !!navigator.serviceWorker.controller : null,
  magnetRadius: () => PLAYER.magnetBase + (G.level - 1) * PLAYER.magnetPerLevel,
  // orbit weapon: expose the live orbit position for the bot (distance to ring)
  orbit: () => orbitPos ? { x: orbitPos.x, z: orbitPos.z } : null,
};
