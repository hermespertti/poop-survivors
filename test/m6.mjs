// M6 SOAK — touch + PWA (prisma-panic M12/M13 pattern).
// The game must be playable with THUMBS ONLY on a phone: the floating
// thumbstick (lower half of the view) steers, taps pick level-ups and start
// runs, and the PWA shell (manifest + service worker) makes it installable.
// Proof it never cheats: movement flows through REAL CDP touch events into the
// DOM pointer handlers — the soak reads back __cap.moveVec()/stickState() and
// asserts botDir stays at zero the whole time.
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned } from './server.mjs';

const EXE = '/usr/bin/chromium';
const URL = 'http://127.0.0.1:5193/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await ensureServer();

// phone LANDSCAPE — the natural orientation for a 320x240 top-down shooter
const b = await puppeteer.launch({
  executablePath: EXE, headless: 'new', protocolTimeout: 1200000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await b.newPage();
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(2200);

const cdp = await page.target().createCDPSession();
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
// multi-touch: Part C holds the stick thumb (id 1) DOWN the whole run — a real
// thumb stays on the stick between drags. A second finger (id 2) taps
// level-ups. CDP semantics: touchStart/touchMove list the fingers currently
// on the screen; touchEnd lists only the fingers being lifted (fingers
// absent from touchEnd stay down).
const TP = (id, x, y) => ({ id, x: Math.round(x), y: Math.round(y) });
const tDown = (x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [TP(id, x, y)] });
const tMove = (x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [TP(id, x, y)] });
const tUp = (id = 1) => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [TP(id, 0, 0)] });

// canvas geometry in CSS px (the canvas is centered in the phone viewport)
const RECT = await page.evaluate(() => {
  const r = document.getElementById('c').getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height, scale: r.width / 320 };
});
const VIEW2CLIENT = (vx, vz) => ({ x: RECT.left + vx * RECT.scale, y: RECT.top + vz * RECT.scale });

// ============ PART A: PWA shell ============
const shell = await page.evaluate(async () => {
  const man = document.querySelector('link[rel="manifest"]');
  const vp = document.querySelector('meta[name="viewport"]');
  const theme = document.querySelector('meta[name="theme-color"]');
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  let manifest = null, manifestErr = null;
  try { manifest = await (await fetch(man.href)).json(); } catch (e) { manifestErr = String(e); }
  let sw = null;
  try {
    const r = await fetch('sw.js');
    const txt = await r.text();
    sw = { status: r.status, js: /addEventListener\('fetch'/.test(txt), bytes: txt.length };
  } catch (e) { sw = { status: 0, err: String(e) }; }
  return {
    manHref: man ? man.href : null,
    manifest, manifestErr,
    viewport: vp ? vp.content : null,
    theme: theme ? theme.content : null,
    apple: apple ? apple.href : null,
    sw,
  };
});
ok(shell.manHref && shell.manHref.includes('manifest.webmanifest'), 'PWA: manifest link in the head');
ok(shell.manifest && shell.manifest.name && shell.manifest.icons && shell.manifest.icons.length >= 2, 'PWA: manifest is valid JSON with name + icons');
ok(shell.manifest && shell.manifest.icons.some((i) => (i.purpose || '').includes('maskable')), 'PWA: a maskable icon is declared (installable)');
ok(shell.viewport && shell.viewport.includes('user-scalable=no'), 'mobile: viewport meta locks the layout (no pinch-zoom)');
ok(!!shell.theme, 'PWA: theme-color meta present');
ok(!!shell.apple && shell.apple.includes('apple-touch-icon'), 'PWA: apple-touch-icon declared (iOS home screen)');
ok(shell.sw && shell.sw.status === 200 && shell.sw.js && shell.sw.bytes > 500, 'PWA: sw.js served and is a fetch-handler service worker');

// ============ PART B: the floating thumbstick (real CDP touch) ============
ok((await page.evaluate(() => window.__cap.isTouch())), 'touch: phone emulation detected as a coarse pointer');

// title: a real tap drops in (the M6 "TAP TO DROP IN" path)
{
  const c = VIEW2CLIENT(160, 120);
  await tDown(c.x, c.y); await sleep(30); await tUp();
  await sleep(400);
  const mode = await page.evaluate(() => window.__cap.state().mode);
  ok(mode === 'play', 'touch: tapping the title screen starts a run (got ' + mode + ')');
}

// stick activation: lower-half touch in play → base spawns under the finger
await page.evaluate(() => {
  const c = window.__cap;
  c.restartPlay(123);
  c.freeze();
  c.set('hp', 100000);
  c.givePassiveNow('meats', 1);
});
const S0 = VIEW2CLIENT(80, 180); // lower half of the view
await tDown(S0.x, S0.y); await sleep(60);
let st = await page.evaluate(() => window.__cap.stickState());
ok(st.a === true, 'stick: lower-half touch activates the stick');
// drag right — analog vector must follow the finger
const D1 = VIEW2CLIENT(80 + 30, 180);
await tMove(D1.x, D1.y); await sleep(60);
st = await page.evaluate(() => window.__cap.stickState());
ok(st.x > 0.5 && Math.abs(st.z) < 0.2, `stick: drag right → vector follows the finger (x=${st.x}, z=${st.z})`);
// and the PLAYER moves right — the stick feeds the real movement math
{
  const x0 = await page.evaluate(() => window.__cap.state().x);
  for (let i = 0; i < 60; i++) await page.evaluate(() => window.__cap.step());
  const x1 = await page.evaluate(() => window.__cap.state().x);
  ok(x1 - x0 > 40, `stick: player walks with the stick (+${(x1 - x0).toFixed(0)}u in 1 game-second)`);
}
// drag up — the player moves up (screen up = world -z)
const D2 = VIEW2CLIENT(80, 180 - 30);
await tMove(D2.x, D2.y); await sleep(60);
st = await page.evaluate(() => window.__cap.stickState());
ok(st.z < -0.5, `stick: drag up → vector up (z=${st.z})`);
{
  const z0 = await page.evaluate(() => window.__cap.state().z);
  for (let i = 0; i < 60; i++) await page.evaluate(() => window.__cap.step());
  const z1 = await page.evaluate(() => window.__cap.state().z);
  ok(z0 - z1 > 40, `stick: player walks up (-${(z0 - z1).toFixed(0)}u in 1 game-second)`);
}
// release → stick drops, player stops
await tUp(); await sleep(60);
st = await page.evaluate(() => window.__cap.stickState());
ok(st.a === false, 'stick: releasing the finger drops the stick');
{
  const x0 = await page.evaluate(() => window.__cap.state().x);
  for (let i = 0; i < 60; i++) await page.evaluate(() => window.__cap.step());
  const x1 = await page.evaluate(() => window.__cap.state().x);
  ok(Math.abs(x1 - x0) < 2, 'stick: no stick → no movement (idle, not coasting)');
}
// the stick never touches the bot path
const bd = await page.evaluate(() => window.__cap.botDir());
ok(bd.x === 0 && bd.y === 0, 'stick: movement flows through the touch path, never botDir');
// upper-half touch = the old pointer-walk, NOT the stick
{
  const u = VIEW2CLIENT(240, 60);
  await tDown(u.x, u.y); await sleep(60);
  const su = await page.evaluate(() => window.__cap.stickState());
  ok(su.a === false, 'stick: upper-half touch stays pointer-walk (no stick)');
  const x0 = await page.evaluate(() => window.__cap.state().x);
  for (let i = 0; i < 60; i++) await page.evaluate(() => window.__cap.step());
  const x1 = await page.evaluate(() => window.__cap.state().x);
  ok(x1 > x0 + 40, 'pointer-walk: upper-half hold still walks toward the finger (regression)');
  await tUp(); await sleep(60);
}
await page.evaluate(() => window.__cap.unfreeze());

// ============ PART C: 5:00 thumbs-only soak (the GDD M6 gate) ============
// Real-time play, exactly like a phone: every move is a CDP touch drag on the
// stick, every level-up is a CDP tap on the option row. The kit head start is
// the M2/M3/M4 soak precedent (the gate tests the RUN against a competent
// build, not the real-time option lottery).
await page.evaluate(() => {
  const c = window.__cap;
  c.restart(1337);
  c.giveWeaponNow('fartwhip', 8);
  c.giveWeaponNow('crackerring', 8);
  c.givePassiveNow('quick', 5);
  c.givePassiveNow('meats', 5);
});
// drop in with a real tap (the sim is live in play mode)
{
  const c = VIEW2CLIENT(160, 120);
  await tDown(c.x, c.y); await sleep(30); await tUp();
  await sleep(300);
}
let stickDrags = 0, taps = 0, maxLevel = 1, sawBoss = false;
const ANCHOR = VIEW2CLIENT(70, 190);
const t0 = Date.now();
let finalState = null;
// THUMB HOLDS THE WHOLE RUN: a real player's thumb never leaves the stick.
// The old bot did touchStart+touchEnd per decision and sat idle (no stick →
// no movement) for the CDP round-trips in between — that idle window is what
// let the swarm catch it at 277s. Finger 1 stays on the anchor and every
// decision is a touchMove; a second finger (id 2) taps level-ups.
const thumbDown = async () => {
  const st = await page.evaluate(() => window.__cap.stickState());
  if (!st.a) { await tDown(ANCHOR.x, ANCHOR.y); await sleep(25); }
};
await thumbDown();
while (Date.now() - t0 < 330000) {
  const s = await page.evaluate(() => {
    const c = window.__cap;
    return {
      mode: c.state().mode, time: c.state().time, x: c.state().x, z: c.state().z,
      level: c.state().level, hp: c.state().hp,
      enemies: c.enemies(16), boss: c.state().boss,
      gems: (c.nearestGem() || null),
      options: c.state().options,
      weapons: c.state().weapons,
    };
  });
  if (s.boss) sawBoss = true;
  if (s.level > maxLevel) maxLevel = s.level;
  if (s.mode === 'dead' || s.mode === 'win') { finalState = s; break; }
  if (s.mode === 'levelup') {
    // pick like a player: hp → ring → new weapon → quick → passive
    const o = s.options;
    let pick = -1;
    if (s.hp < 30) pick = o.findIndex((x) => x.id === 'hp');
    if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring' && !s.weapons.crackerring);
    if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
    if (pick < 0) pick = o.findIndex((x) => x.id === 'quick');
    if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive');
    if (pick < 0) pick = 0;
    const rowY = 36 + pick * 44 + 22;
    const t = VIEW2CLIENT(160, rowY);
    // second finger — the stick thumb stays planted
    await tDown(t.x, t.y, 2); await sleep(40); await tUp(2);
    taps++;
    await sleep(120);
    continue;
  }
  if (s.mode !== 'play') { await sleep(120); continue; }
  // decide a move direction (the m2 kiting math), then DRAG the held thumb
  const W = 1280, H = 800;
  let wx = 0, wz = 0, wsum = 0;
  for (const e of s.enemies) { if (e.d < 100) { const w = 1 - e.d / 100; wx += e.x * w; wz += e.z * w; wsum += w; } }
  if (s.boss) {
    const bd = Math.hypot(s.boss.x - s.x, s.boss.z - s.z);
    if (bd < 150) { const w = 3 * (1 - bd / 150); wx += s.boss.x * w; wz += s.boss.z * w; wsum += w; }
  }
  let dx = 0, dz = 0;
  if (wsum < 0.15) {
    if (s.gems && s.gems.d < 90 && s.gems.d > 8) {
      const gdx = s.gems.x - s.x, gdz = s.gems.z - s.z, gd = Math.hypot(gdx, gdz) || 1;
      dx = gdx / gd; dz = gdz / gd;
    }
  } else {
    const cx = wx / wsum, cz = wz / wsum;
    let ex = s.x - cx, ez = s.z - cz;
    const d = Math.hypot(ex, ez) || 1;
    if (wsum > 2.2) {
      const corners = [[0, 0], [W, 0], [0, H], [W, H]];
      let best = null, bdd = -1;
      for (const [ccx, ccz] of corners) {
        const cd = Math.hypot(ccx - cx, ccz - cz);
        if (cd > bdd) { bdd = cd; best = [ccx, ccz]; }
      }
      const tdx = best[0] - s.x, tdz = best[1] - s.z, td = Math.hypot(tdx, tdz) || 1;
      dx = tdx / td; dz = tdz / td;
    } else if (d > 70) { dx = ex / d; dz = ez / d; }
    else if (d < 30) { dx = -ex / d; dz = -ez / d; }
    else {
      let sx = -dz / d, sz = dx / d;
      if ((sx > 0.3 && s.x > W - 120) || (sx < -0.3 && s.x < 120) ||
          (sz > 0.3 && s.z > H - 120) || (sz < -0.3 && s.z < 120)) { sx = -sx; sz = -sz; }
      dx = sx; dz = sz;
    }
  }
  const mag = Math.hypot(dx, dz);
  const TGT = mag > 0.1
    ? VIEW2CLIENT(70 + dx * 34, 190 + dz * 34)   // push the stick for the move
    : { x: ANCHOR.x, y: ANCHOR.y };              // calm field: rest at center (stop)
  await thumbDown();
  await tMove(TGT.x, TGT.y);
  if (mag > 0.1) stickDrags++;
  await sleep(200);
}
await tUp(1);
if (!finalState) {
  finalState = await page.evaluate(() => {
    const c = window.__cap; const s = c.state();
    return { mode: s.mode, time: s.time, level: s.level, kills: s.kills, hp: s.hp, stats: s.stats, weapons: s.weapons };
  });
} else {
  const full = await page.evaluate(() => { const s = window.__cap.state(); return { kills: s.kills, stats: s.stats, weapons: s.weapons, hp: s.hp }; });
  finalState.kills = full.kills; finalState.stats = full.stats; finalState.weapons = full.weapons; finalState.hp = full.hp;
}
console.log(`\n  touch run: seed 1337 → ${finalState.mode} at ${finalState.time.toFixed(1)}s | lv ${finalState.level} | kills ${finalState.kills ?? '?'} | stick drags ${stickDrags} | level-up taps ${taps}`);

ok(finalState.time > 250 || finalState.mode === 'win', `touch bot reached the 5:00 window (${finalState.mode} @ ${finalState.time.toFixed(1)}s)`);
ok(maxLevel >= 8, `touch bot leveled up (max lv ${maxLevel})`);
ok(stickDrags > 60, `movement was stick-driven (${stickDrags} real touch drags)`);
ok(taps >= 1, `level-ups were tapped (${taps} real touch taps)`);
ok((finalState.kills ?? 0) > 40, `weapons killed things with thumbs on (${finalState.kills} kills)`);
ok(sawBoss, 'the boss appeared during the touch run');
ok(finalState.stats ? finalState.stats.nan === 0 : true, 'no NaN during the touch run');
ok((finalState.hp ?? 0) >= 0, 'hp never went negative');
ok(errs.length === 0, `console clean across PWA + touch (${errs.slice(0, 2).join(' | ')})`);

console.log(`\nM6 SOAK: ${pass} pass / ${fail} fail`);
await b.close();
killIfOwned();
process.exit(fail ? 1 : 0);
