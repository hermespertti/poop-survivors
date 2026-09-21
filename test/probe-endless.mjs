import puppeteer from 'puppeteer-core';
import { ensureServer, URL } from './server.mjs';
const EXE = '/usr/bin/chromium';
const b = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage();
await page.setViewport({ width: 320, height: 240, deviceScaleFactor: 1 });
await ensureServer();
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  const meta = { gold: 0, unlocked: ['crouton','endless'], achievements: [], bestTime: 0, bestKills: 0, upgrades: {} };
  localStorage.setItem('poop-survivors-meta', JSON.stringify(meta));
});
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => {
  window.__cap.metaReset();
  window.__cap.metaGive('endless');
  window.__cap.selectStage('endless');
  window.__cap.restart(4242);
  window.__cap.giveWeaponNow('fartwhip', 8);
  window.__cap.giveWeaponNow('crackerring', 8);
  window.__cap.givePassiveNow('quick', 5);
});
// step until past 31 minutes or dead
let last = null;
const t0 = Date.now();
while (Date.now() - t0 < 240000) {
  last = await page.evaluate(() => { for (let i = 0; i < 600; i++) { window.__cap.step(); if (window.__cap.state().mode === "levelup") window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" })); } return window.__cap.state(); });
  if (last.mode !== 'play') break;
  if (last.time > 1860) break;
}
console.log('RESULT:', JSON.stringify({ mode: last.mode, time: last.time, flush: !!last.flush, kills: last.kills, level: last.level }));
const septic = await page.evaluate(() => window.__cap.septicState());
console.log('septicState:', JSON.stringify(septic));
await page.screenshot({ path: '/tmp/endless.png' });
await b.close();
