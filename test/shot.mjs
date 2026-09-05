// M11 screenshots: title, levelup, death, boss-fight (pre/post compare)
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned, URL } from './server.mjs';
const EXE = '/usr/bin/chromium';
const b = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'] });
const page = await b.newPage();
await page.setViewport({ width: 320, height: 240, deviceScaleFactor: 3 });
await ensureServer();
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
const OUT = process.argv[2] || '/tmp/m11';

// title
await page.screenshot({ path: OUT + '-title.png' });

// death screen
await page.evaluate(() => {
  const c = window.__cap;
  c.restart(7);
  c.giveWeaponNow('fartwhip', 3);
});
await page.evaluate(() => window.__cap.set('hp', 1));
for (let i = 0; i < 30000; i++) {
  await page.evaluate(() => window.__cap.step());
  const m = await page.evaluate(() => window.__cap.state().mode);
  if (m === 'dead' || m === 'win') break;
}
await page.screenshot({ path: OUT + '-dead.png' });

// levelup: force a pick screen
await page.evaluate(() => {
  const c = window.__cap;
  c.restart(99);
  c.set('level', 5);
  c.set('xp', 100000);
});
await page.screenshot({ path: OUT + '-levelup.png' });

// boss fight (THE FIRST WIND at 300s): fast-forward
await page.evaluate(() => {
  const c = window.__cap;
  c.restart(42);
  c.giveWeaponNow('fartwhip', 6);
  c.givePassiveNow('quick', 1);
  c.set('time', 299);
});
for (let i = 0; i < 2000; i++) {
  await page.evaluate(() => window.__cap.step());
  const b2 = await page.evaluate(() => window.__cap.state().boss);
  if (b2) break;
}
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: OUT + '-boss.png' });

await b.close();
killIfOwned();
console.log('shots -> ' + OUT);
