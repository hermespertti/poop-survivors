// M13 kb-resist probe: measure the EXACT hit pattern (kbApplied trajectory +
// per-step kick) for bubble vs boulder vs shell under one cannon shot.
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned, URL } from './server.mjs';

await ensureServer();
const b = await puppeteer.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__cap && window.__cap.state', { timeout: 15000 });

for (const kind of ['bubble', 'boulder', 'shell']) {
  const trace = await page.evaluate((k) => {
    const c = window.__cap;
    c.restart(911); c.freeze();
    c.giveWeapon('plopcannon', 1);
    c.spawn(1, k);
    const st = c.state();
    c.setEnemyPos(0, st.x + 18, st.z);
    c.setEnemyHp(0, 5000);
    const rows = [];
    for (let i = 0; i < 60; i++) {
      c.step();
      const s = c.state();
      const arr = c.enemies(1);
      const e = arr[0] || { kx: 0, kz: 0 };
      rows.push({ i, kb: s.stats.kbApplied, kx: e.kx, kz: e.kz });
      if (s.stats.kbApplied >= 4) break;
    }
    c.unfreeze();
    return rows;
  }, kind);
  console.log(`== ${kind} ==`);
  for (const r of trace) console.log(`  step ${r.i}: kbApplied=${r.kb} kx=${r.kx} kz=${r.kz}`);
}
await b.close();
killIfOwned();
