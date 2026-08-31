// POOP SURVIVORS — M1
// Core loop: move, Bubble chasers, Fart Whip auto-fire, XP gems + magnet,
// level-up 3-choice, HP/invuln, 3:00 timer, death screen.
// Top-down 2D canvas, fixed timestep, seeded determinism, __cap probe.
// Art: hand-authored pixel arrays over one 16-color palette, 8x8 bitmap font.

import { PALETTE, SPRITES, drawSprite, drawScaled, drawText } from './art';

// ---------- deterministic RNG (mulberry32) ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- world / camera ----------
const TILE = 16;
const WORLD_W = 1280;            // 80 tiles
const WORLD_H = 800;             // 50 tiles
const VIEW_W = 320;
const VIEW_H = 240;

// ---------- player ----------
const PLAYER = {
  maxHp: 100, speed: 90, radius: 5,
  magnetBase: 26, magnetPerLevel: 1.5,
  invulnAfterHit: 0.8,
  invulnOnLevel: 1.2,            // VS-verified: leveling grants brief invuln
};

// ---------- enemies ----------
const ENEMY = {
  bubble: { hp: 6, speed: 34, dmg: 8, radius: 5, xp: 1 },
};

// ---------- XP curve (VS wiki). req to go N -> N+1 ----------
// 1:5, 2:15, 3:25 ... +10 to 19:185; +13 from 20; +16 from 40;
// one-time +600 wall at 20, +2400 wall at 40.
function xpToNext(level: number): number {
  let base: number;
  if (level < 20) base = 5 + 10 * (level - 1);
  else if (level < 40) base = 185 + 13 * (level - 19);
  else base = 445 + 16 * (level - 39);
  if (level === 20) base += 600;
  if (level === 40) base += 2400;
  return base;
}

// ---------- types ----------
type Enemy = { x: number; z: number; hp: number; maxHp: number; speed: number; dmg: number; radius: number; xp: number; kind: string; hitT: number; wob: number };
type Gem = { x: number; z: number; val: number; vx: number; vz: number; pulled: boolean; t: number };
type Bullet = { x: number; z: number; vx: number; vz: number; life: number; dmg: number; ang: number };
type DmgNum = { x: number; z: number; vy: number; t: number; txt: string; crit: boolean };
type ItemOption = { id: string; name: string; desc: string; kind: 'weapon' | 'passive' | 'gold' | 'hp'; lvl: number };
type Mode = 'title' | 'play' | 'levelup' | 'dead' | 'win';

type Game = {
  seed: number; rng: () => number;
  mode: Mode; time: number;
  player: { x: number; z: number; hp: number; face: number; moving: boolean; invuln: number; walkT: number };
  enemies: Enemy[]; gems: Gem[]; bullets: Bullet[]; dmgNums: DmgNum[];
  xp: number; level: number; xpNeed: number;
  whip: { lvl: number; cd: number; cdMax: number; dmg: number };
  options: ItemOption[];
  flashT: number; shake: number; kills: number;
  stats: { maxLevel: number; levelUps: number; gems: number; whipShots: number; nan: number; whipFiredAt: number[] };
  spawnCd: number; spawnInterval: number;
};

let G: Game = mkGame(1);
function mkGame(seed: number): Game {
  const rng = mulberry32(seed);
  return {
    seed, rng, mode: 'title', time: 0,
    player: { x: WORLD_W / 2, z: WORLD_H / 2, hp: PLAYER.maxHp, face: 0, moving: false, invuln: 0, walkT: 0 },
    enemies: [], gems: [], bullets: [], dmgNums: [],
    xp: 0, level: 1, xpNeed: xpToNext(1),
    whip: { lvl: 1, cd: 0, cdMax: 1.6, dmg: 10 },
    options: [], flashT: 0, shake: 0, kills: 0,
    stats: { maxLevel: 1, levelUps: 0, gems: 0, whipShots: 0, nan: 0, whipFiredAt: [] },
    spawnCd: 1.0, spawnInterval: 1.0,
  };
}

// ---------- input (keyboard for humans, botDir for the harness) ----------
const keys = new Set<string>();
let _prevKeys = new Set<string>();
let _nowKeys = new Set<string>();
let botDir = { x: 0, y: 0 };
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function syncKeys() { _prevKeys = _nowKeys; _nowKeys = new Set(keys); }
function justPressed(k: string): boolean { return _nowKeys.has(k) && !_prevKeys.has(k); }
function keyIndex(...ks: string[]): number {
  for (let i = 0; i < ks.length; i++) if (justPressed(ks[i])) return i;
  return -1;
}
function readKeyboard(): [number, number] {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  return [x, y];
}
function currentMove(): [number, number] {
  if (botDir.x !== 0 || botDir.y !== 0) return [botDir.x, botDir.y];
  return readKeyboard();
}

// ---------- level up ----------
function buildOptions(): ItemOption[] {
  const avail: ItemOption[] = [
    { id: 'whip', name: 'Fart Whip', desc: 'Upgrade whip +damage', kind: 'weapon', lvl: G.whip.lvl },
    { id: 'hp', name: 'Donut', desc: 'Restore 25 HP', kind: 'hp', lvl: 0 },
    { id: 'gold', name: 'Golden Scoop', desc: '+25 Gold', kind: 'gold', lvl: 0 },
  ];
  const picks = avail.filter((o) => !(o.id === 'whip' && G.whip.lvl >= 8));
  const arr = picks.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(G.rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, 3);
}
function pickOption(i: number): void {
  const o = G.options[i];
  if (!o) return;
  if (o.id === 'whip' && G.whip.lvl < 8) { G.whip.lvl++; G.whip.dmg = 10 + (G.whip.lvl - 1) * 3; }
  else if (o.id === 'hp') { G.player.hp = Math.min(PLAYER.maxHp, G.player.hp + 25); }
  G.mode = 'play';
  G.player.invuln = Math.max(G.player.invuln, PLAYER.invulnOnLevel);
  G.flashT = 0.25;
}

// ---------- combat ----------
function fireWhip(): void {
  const w = G.whip;
  w.cd = w.cdMax;
  G.stats.whipShots++;
  G.stats.whipFiredAt.push(G.time);
  const n = Math.min(3, 1 + Math.floor(w.lvl / 3));
  for (let k = 0; k < n; k++) {
    const spread = (k - (n - 1) / 2) * 0.14;
    const a = G.player.face + spread;
    G.bullets.push({ x: G.player.x, z: G.player.z, vx: Math.cos(a) * 300, vz: Math.sin(a) * 300, life: 0.9, dmg: w.dmg, ang: a });
  }
}
function nearestEnemy(): Enemy | null {
  let best: Enemy | null = null, bd = 1e9;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - G.player.x, e.z - G.player.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- spawning ----------
function spawnEnemy(): void {
  const p = G.player;
  const ang = G.rng() * Math.PI * 2;
  const dist = Math.max(VIEW_W, VIEW_H) / 2 + 40 + G.rng() * 60;
  let x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
  x = Math.max(8, Math.min(WORLD_W - 8, x));
  z = Math.max(8, Math.min(WORLD_H - 8, z));
  const b = ENEMY.bubble;
  const hpScale = 1 + G.time / 90;
  G.enemies.push({ x, z, hp: b.hp * hpScale, maxHp: b.hp * hpScale, speed: b.speed, dmg: b.dmg, radius: b.radius, xp: b.xp, kind: 'bubble', hitT: 0, wob: G.rng() * 6.28 });
}

function gainXp(amt: number): void {
  G.xp += amt;
  checkLevelUp();
}
function checkLevelUp(): void {
  while (G.xp >= G.xpNeed) {
    G.xp -= G.xpNeed;
    G.level++;
    G.xpNeed = xpToNext(G.level);
    G.stats.maxLevel = Math.max(G.stats.maxLevel, G.level);
    if (G.mode === 'play') { G.mode = 'levelup'; G.options = buildOptions(); G.stats.levelUps++; break; }
  }
}

// ---------- main update (fixed step) ----------
const DT = 1 / 60;
const RUN_LEN = 180; // 3:00

function update(): void {
  syncKeys();
  // selection (works in title/dead/win/levelup)
  if (G.mode === 'levelup') {
    const idx = keyIndex('1', '2', '3');
    if (idx >= 0) pickOption(idx);
  } else if (G.mode === 'title' || G.mode === 'dead' || G.mode === 'win') {
    if (justPressed(' ') || justPressed('enter')) startRun(G.seed);
  }
  if (G.mode !== 'play') return;

  G.time += DT;

  const p = G.player;
  let [mx, my] = currentMove();
  const mlen = Math.hypot(mx, my);
  if (mlen > 1) { mx /= mlen; my /= mlen; }
  p.moving = mlen > 0;
  if (p.moving) {
    p.x = clampNum(p.x + mx * PLAYER.speed * DT);
    p.z = clampNum(p.z + my * PLAYER.speed * DT);
    p.x = Math.max(PLAYER.radius, Math.min(WORLD_W - PLAYER.radius, p.x));
    p.z = Math.max(PLAYER.radius, Math.min(WORLD_H - PLAYER.radius, p.z));
    p.face = Math.atan2(my, mx);
    p.walkT += DT;
  }
  const tgt = nearestEnemy();
  if (tgt) p.face = Math.atan2(tgt.z - p.z, tgt.x - p.x);

  if (p.invuln > 0) p.invuln -= DT;
  if (G.flashT > 0) G.flashT -= DT;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - DT * 40);

  G.whip.cd -= DT;
  if (G.whip.cd <= 0 && tgt) fireWhip();

  // bullets (piercing)
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * DT; b.z += b.vz * DT; b.life -= DT;
    if (b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.z < 0 || b.z > WORLD_H) { G.bullets.splice(i, 1); continue; }
    for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
      const e = G.enemies[ei];
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + 3) {
        e.hp -= b.dmg; e.hitT = 0.12;
        G.dmgNums.push({ x: e.x, z: e.z - 6, vy: -22, t: 0.7, txt: String(Math.round(b.dmg)), crit: false });
        if (e.hp <= 0) {
          G.kills++; G.enemies.splice(ei, 1);
          G.gems.push({ x: e.x, z: e.z, val: e.xp, vx: (G.rng() - 0.5) * 40, vz: (G.rng() - 0.5) * 40, pulled: false, t: 0 });
        }
      }
    }
  }

  // enemies chase
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.wob += DT * 6;
    if (e.hitT > 0) e.hitT -= DT;
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d) * e.speed * DT;
    e.z += (dz / d) * e.speed * DT;
    if (d < e.radius + PLAYER.radius && p.invuln <= 0) {
      p.hp -= e.dmg; p.invuln = PLAYER.invulnAfterHit;
      G.shake = 6; G.flashT = Math.max(G.flashT, 0.12);
      G.dmgNums.push({ x: p.x, z: p.z - 8, vy: -26, t: 0.8, txt: '-' + e.dmg, crit: true });
      if (p.hp <= 0) { p.hp = 0; G.mode = 'dead'; return; }
    }
  }

  // spawn
  G.spawnCd -= DT;
  G.spawnInterval = Math.max(0.25, 1.0 - G.time / 240);
  if (G.spawnCd <= 0) { spawnEnemy(); G.spawnCd = G.spawnInterval; }
  if (G.enemies.length > 260) G.enemies.splice(0, G.enemies.length - 260);

  // gems / magnet
  const magnetR = PLAYER.magnetBase + (G.level - 1) * PLAYER.magnetPerLevel;
  for (let i = G.gems.length - 1; i >= 0; i--) {
    const g = G.gems[i];
    g.t += DT;
    const dx = p.x - g.x, dz = p.z - g.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < magnetR) g.pulled = true;
    if (g.pulled) { g.x += (dx / d) * 160 * DT; g.z += (dz / d) * 160 * DT; }
    else { g.x += g.vx * DT; g.z += g.vz * DT; g.vx *= 0.9; g.vz *= 0.9; }
    if (d < PLAYER.radius + 3) { G.gems.splice(i, 1); G.stats.gems++; gainXp(g.val); }
  }

  // damage numbers
  for (let i = G.dmgNums.length - 1; i >= 0; i--) {
    const n = G.dmgNums[i]; n.z += n.vy * DT; n.t -= DT;
    if (n.t <= 0) G.dmgNums.splice(i, 1);
  }

  if (G.time >= RUN_LEN) G.mode = 'win';
}

function clampNum(v: number): number { if (Number.isNaN(v)) { G.stats.nan++; return 0; } return v; }

function startRun(seed: number): void { G = mkGame(seed); G.mode = 'play'; botDir = { x: 0, y: 0 }; }

// ---------- rendering ----------
const canvas = (document.getElementById('c') as HTMLCanvasElement);
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
function fitCanvas(): void {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.width = VIEW_W; canvas.height = VIEW_H;
  canvas.style.width = (VIEW_W * scale) + 'px';
  canvas.style.height = (VIEW_H * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function camX(): number { return Math.max(0, Math.min(WORLD_W - VIEW_W, G.player.x - VIEW_W / 2)); }
function camY(): number { return Math.max(0, Math.min(WORLD_H - VIEW_H, G.player.z - VIEW_H / 2)); }

function render(t: number): void {
  if (G.mode === 'title') { drawTitle(t); return; }
  // time-based shake (does NOT consume the game RNG → deterministic logic)
  const sx = G.shake > 0 ? Math.sin(t * 47) * G.shake * 0.5 : 0;
  const sy = G.shake > 0 ? Math.cos(t * 39) * G.shake * 0.5 : 0;
  const cx = camX() + sx, cy = camY() + sy;
  drawFloor(cx, cy);
  for (const g of G.gems) drawSprite(ctx, SPRITES.gem, Math.round(g.x - cx), Math.round(g.z - cy), Math.floor(t / 0.3) % 2);
  for (const b of G.bullets) drawSprite(ctx, SPRITES.bolt, Math.round(b.x - cx), Math.round(b.z - cy), 0);
  for (const e of G.enemies) {
    const frame = Math.floor(t * 8 + e.wob) % 2;
    drawSprite(ctx, e.hitT > 0 ? SPRITES.bubbleHit : SPRITES.bubble, Math.round(e.x - cx), Math.round(e.z - cy), frame);
  }
  {
    const p = G.player;
    const frame = p.moving ? Math.floor(p.walkT * 10) % 2 : 0;
    const blink = p.invuln > 0 && Math.floor(t * 16) % 2 === 0;
    drawSprite(ctx, blink ? SPRITES.croutonHit : SPRITES.crouton, Math.round(p.x - cx), Math.round(p.z - cy), frame);
  }
  for (const n of G.dmgNums) drawText(ctx, n.txt, Math.round(n.x - cx - 4), Math.round(n.z - cy), n.crit ? 1 : 0);
  if (G.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, G.flashT * 2)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawHud(t);
}

function drawFloor(cx: number, cy: number): void {
  const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
  for (let ty = y0; ty < y0 + VIEW_H / TILE + 1; ty++) {
    for (let tx = x0; tx < x0 + VIEW_W / TILE + 1; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? '#f3e2b8' : '#e8cf94';
      ctx.fillRect(tx * TILE - cx, ty * TILE - cy, TILE, TILE);
    }
  }
}

function center(text: string, y: number, style: number): void {
  const w = text.length * 6;
  drawText(ctx, text, Math.round((VIEW_W - w) / 2), y, style);
}
function fmt(s: number): string {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}
function drawHud(t: number): void {
  center(fmt(G.time), 4, 0);
  drawText(ctx, 'LV' + G.level, 6, 4, 0);
  const bw = 120, bx = 6, by = 14;
  ctx.fillStyle = '#3a2b1a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
  ctx.fillStyle = '#7a5a2e'; ctx.fillRect(bx, by, bw, 5);
  ctx.fillStyle = '#58d68d'; ctx.fillRect(bx, by, Math.round(bw * Math.max(0, Math.min(1, G.xp / G.xpNeed))), 5);
  const hbx = VIEW_W - 84, hby = 4;
  ctx.fillStyle = '#3a2b1a'; ctx.fillRect(hbx - 1, hby - 1, 86, 9);
  ctx.fillStyle = '#7a2e2e'; ctx.fillRect(hbx, hby, 84, 7);
  ctx.fillStyle = '#e0563a'; ctx.fillRect(hbx, hby, Math.round(84 * Math.max(0, Math.min(1, G.player.hp / PLAYER.maxHp))), 7);
  drawText(ctx, 'HP', hbx + 2, hby + 1, 0);

  if (G.mode === 'title') overlay('POOP SURVIVORS', 'move: WASD / arrows', 'press SPACE to drop in', t, false);
  else if (G.mode === 'dead') overlay('FLUSHED', `lv${G.level}  kills ${G.kills}  ${fmt(G.time)}`, 'press SPACE to retry', t, true);
  else if (G.mode === 'win') overlay('SOLVED IT', `lv${G.level}  kills ${G.kills}`, 'press SPACE to go again', t, false);
  else if (G.mode === 'levelup') drawLevelUp();
}
function overlay(title: string, sub1: string, sub2: string, t: number, dark: boolean): void {
  ctx.fillStyle = dark ? 'rgba(20,10,6,0.82)' : 'rgba(30,22,10,0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const bounce = Math.round(Math.sin(t * 2) * 2);
  center(title, 80 + bounce, 1);
  center(sub1, 112, 0);
  center(sub2, 124, 0);
}
function drawLevelUp(): void {
  ctx.fillStyle = 'rgba(18,12,6,0.86)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  center('LEVEL UP!', 16, 1);
  G.options.forEach((o, i) => {
    const y = 40 + i * 44;
    ctx.fillStyle = '#332616'; ctx.fillRect(18, y, VIEW_W - 36, 38);
    ctx.strokeStyle = '#c9a24a'; ctx.strokeRect(18.5, y + 0.5, VIEW_W - 37, 37);
    drawText(ctx, `[${i + 1}] ${o.name}`, 26, y + 6, 1);
    drawText(ctx, o.desc, 26, y + 18, 0);
    if (o.kind === 'weapon') drawText(ctx, `LV${o.lvl}/8`, VIEW_W - 64, y + 6, 0);
  });
}

function drawTitle(t: number): void {
  // bright checkered kitchen floor, full-bleed
  for (let ty = 0; ty < VIEW_H / TILE; ty++) {
    for (let tx = 0; tx < VIEW_W / TILE; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? '#f7ecc9' : '#ecd79c';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  // the mascot: a big crouton, gently bobbing
  const bob = Math.round(Math.sin(t * 2.2) * 3);
  drawScaled(ctx, SPRITES.crouton, Math.round(VIEW_W / 2 - 24), 58 + bob, 4, 0);
  // title with a hard drop-shadow for contrast on the bright floor
  const bounce = Math.round(Math.sin(t * 2) * 2);
  const title = 'POOP SURVIVORS';
  const tw = title.length * 6;
  const tx = Math.round((VIEW_W - tw) / 2);
  drawText(ctx, title, tx + 1, 113 + bounce + 1, 0);   // shadow
  drawText(ctx, title, tx, 112 + bounce, 1);            // main
  const blink = Math.floor(t * 1.6) % 2 === 0;
  if (blink) center('press SPACE to drop in', 140, 0);
  center('move: WASD or arrows', 156, 0);
  // a couple of bubbles drifting for life
  for (let i = 0; i < 3; i++) {
    const bx = (t * 24 + i * 120) % (VIEW_W + 24) - 12;
    const by = 18 + i * 10 + Math.round(Math.sin(t * 3 + i) * 4);
    drawSprite(ctx, SPRITES.bubble, Math.round(bx), by, Math.floor(t * 6 + i) % 2);
  }
}

// ---------- main loop ----------
let frozen = false;
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
}
requestAnimationFrame(frame);

// ---------- __cap probe ----------
const win = window;
(win as any).__cap = {
  state: () => ({
    mode: G.mode, time: +G.time.toFixed(3),
    x: +G.player.x.toFixed(2), z: +G.player.z.toFixed(2),
    hp: G.player.hp, level: G.level, xp: +G.xp.toFixed(2), xpNeed: G.xpNeed,
    enemies: G.enemies.length, gems: G.gems.length, bullets: G.bullets.length,
    kills: G.kills, whipLvl: G.whip.lvl,
    stats: { maxLevel: G.stats.maxLevel, levelUps: G.stats.levelUps, gems: G.stats.gems, whipShots: G.stats.whipShots, nan: G.stats.nan },
  }),
  xpCurve: (lvl: number) => xpToNext(lvl),
  restart: (seed: number) => { startRun(seed); return (win as any).__cap.state(); },
  set: (k: string, v: any) => {
    if (k === 'hp') G.player.hp = v;
    if (k === 'xp') G.xp = v;
    if (k === 'level') { G.level = v; G.xpNeed = xpToNext(v); }
    if (k === 'mode') G.mode = v as Mode;
  },
  gainXp: (amt: number) => { if (G.mode === 'play') gainXp(amt); return (win as any).__cap.state(); },
  pick: (i: number) => { pickOption(i); return (win as any).__cap.state(); },
  spawn: (n = 1) => { for (let i = 0; i < n; i++) spawnEnemy(); return (win as any).__cap.state(); },
  move: (x: number, y: number) => { botDir = { x, y }; },
  nearestGem: () => {
    let best: Gem | null = null, bd = 1e9;
    for (const g of G.gems) { const d = Math.hypot(g.x - G.player.x, g.z - G.player.z); if (d < bd) { bd = d; best = g; } }
    return best ? { x: best.x, z: best.z, d: bd } : null;
  },
  enemiesNear: (r: number) => G.enemies.filter((e) => Math.hypot(e.x - G.player.x, e.z - G.player.z) < r).length,
  // determinism probes: stop the loop, then advance exactly one fixed step
  freeze: () => { frozen = true; },
  unfreeze: () => { frozen = false; },
  step: () => { update(); return (win as any).__cap.state(); },
  magnetRadius: () => PLAYER.magnetBase + (G.level - 1) * PLAYER.magnetPerLevel,
};
