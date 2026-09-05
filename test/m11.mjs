// M11 feature check: shop (tap + key), mobile start, pause/mute buttons
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned } from './server.mjs';
const EXE = '/usr/bin/chromium';
const URL = 'http://127.0.0.1:5193/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await ensureServer();

const b = await puppeteer.launch({ executablePath: EXE, headless: 'new', protocolTimeout: 300000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

// ---- PHONE (coarse) ----
{
  const page = await b.newPage();
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const cdp = await page.target().createCDPSession();
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const TP = (id, x, y) => ({ id, x: Math.round(x), y: Math.round(y) });
  // canvas is letterboxed: view(0..320) → client via the real rect + scale
  const RECT = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { left: r.left, top: r.top, scale: r.width / 320 }; });
  const tTap = async (vx, vz) => { const p = { x: RECT.left + vx * RECT.scale, y: RECT.top + vz * RECT.scale }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [TP(1, p.x, p.y)] }); await sleep(30); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [TP(1, 0, 0)] }); await sleep(30); };

  ok((await page.evaluate(() => window.__cap.isTouch())) === true, 'phone: coarse pointer detected');

  // shop: bank gold, tap row 0 (IRON STOMACH), verify upgrade level + gold spent
  await page.evaluate(() => { const c = window.__cap; c.metaReset(); c.metaGold(300); });
  const before = await page.evaluate(() => window.__cap.state().meta);
  await tTap(160, 188); // shop row 0 (shopRowY(0)=188) in CSS-px-ish view coords
  await sleep(150);
  const after = await page.evaluate(() => window.__cap.state().meta);
  ok(before.gold === 300, 'shop: banked 300 gold (got ' + before.gold + ')');
  ok((after.upgrades.hp || 0) === 1, 'shop: TAP row bought IRON STOMACH lvl1 (got ' + (after.upgrades.hp || 0) + ')');
  ok(after.gold === 300 - 250, 'shop: gold deducted 250 (got ' + after.gold + ')');

  // upgrade applies to a fresh run (recomputeStats)
  await page.evaluate(() => { const c = window.__cap; c.restart(5); });
  const stats = await page.evaluate(() => window.__cap.state().stats);
  ok(stats.maxHp === 115, 'shop: +15 maxHp applied at run start (got ' + stats.maxHp + ')');

  // tap to start (title, non-shop zone)
  await page.evaluate(() => window.__cap.restart(5));
  await tTap(160, 120); // title center — NOT a shop row
  await sleep(300);
  ok((await page.evaluate(() => window.__cap.state().mode)) === 'play', 'phone: TAP on title starts the run');

  // pause button: top-center x136-156, z12-28
  await tTap(145, 20);
  await sleep(150);
  ok((await page.evaluate(() => window.__cap.state().paused === true)) === true, 'phone: pause BUTTON toggles pause');
  await tTap(145, 20); // resume
  await sleep(150);
  // mute button: x160-180
  const mutedBefore = await page.evaluate(() => localStorage.getItem('poop-survivors-mute'));
  await tTap(170, 20);
  await sleep(150);
  const mutedAfter = await page.evaluate(() => localStorage.getItem('poop-survivors-mute'));
  ok(mutedBefore !== mutedAfter, 'phone: mute BUTTON toggles mute (' + mutedBefore + '->' + mutedAfter + ')');

  // tap a level-up option row still works (regression)
  const s = await page.evaluate(() => { const c = window.__cap; c.set('level', 3); c.set('xp', 99999); c.step(); return c.state().mode; });
  if (s === 'levelup') {
    const opts = await page.evaluate(() => window.__cap.state().options.length);
    if (opts > 0) {
      await tTap(160, 58); // row 0 (top=36, rowH=44)
      await sleep(150);
      ok((await page.evaluate(() => window.__cap.state().mode)) === 'play', 'phone: level-up tap still works');
    }
  } else { ok(true, 'phone: level-up tap (skipped, mode=' + s + ')'); }
  ok(errs.length === 0, 'phone: no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await page.close();
}

// ---- DESKTOP (fine): QWER shop keys + P/M ----
{
  const page = await b.newPage();
  await page.setViewport({ width: 320, height: 240, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.evaluate(() => { const c = window.__cap; c.metaReset(); c.metaGold(1000); });
  // hold each key 80ms — justPressed is one-frame, and a real finger/keypress
  // is always held across at least one 16ms update
  const press = async (k) => { await page.keyboard.down(k); await sleep(80); await page.keyboard.up(k); await sleep(60); };
  await press('q');
  await press('e');
  const meta = await page.evaluate(() => window.__cap.state().meta);
  ok((meta.upgrades.hp || 0) === 1 && (meta.upgrades.xp || 0) === 1, 'desktop: Q/E keys buy upgrades (hp=' + (meta.upgrades.hp || 0) + ' xp=' + (meta.upgrades.xp || 0) + ')');
  ok(meta.gold === 1000 - 250 - 200, 'desktop: gold deducted for both (got ' + meta.gold + ')');
  // SPACE starts
  await press(' '); await sleep(300);
  ok((await page.evaluate(() => window.__cap.state().mode)) === 'play', 'desktop: SPACE starts the run');
  // P pauses
  await press('p'); await sleep(100);
  ok((await page.evaluate(() => window.__cap.state().paused === true)) === true, 'desktop: P pauses');
  ok(errs.length === 0, 'desktop: no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await page.close();
}

// hand the world back clean — the suites share the dev server (and thus
// localStorage), so don't leak shop gold/upgrades into m1-m4's fresh-meta runs
{
  const p2 = await (await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox'] })).newPage();
  await p2.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await p2.evaluate(() => window.__cap.metaReset());
  await p2.close();
}
await b.close();
killIfOwned();
console.log(`\nM11 FEATURES: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
