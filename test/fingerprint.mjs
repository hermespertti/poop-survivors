// M19 refactor oracle — NOT part of npm test. Freezes the sim at multiple
// checkpoints across several seeds and hashes the full state JSON at each.
// The architecture refactor must reproduce this file's output byte-for-byte:
// module boundaries must not change evaluation order or RNG consumption.
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned, URL } from './server.mjs';
import { createHash } from 'node:crypto';

const EXE = '/usr/bin/chromium';
const SEEDS = [42, 1337, 9001];
const CHECKPOINTS = [300, 900, 1800, 3000, 4800, 7200]; // fixed-step frames

const b = await puppeteer.launch({
  executablePath: EXE, headless: 'new', protocolTimeout: 600000,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'],
});
const page = await b.newPage();
await page.setViewport({ width: 960, height: 720 });
await ensureServer();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 2200));
await page.evaluate(() => window.__cap.freeze());

const out = [];
for (const seed of SEEDS) {
  await page.evaluate((sd) => { window.__cap.restart(sd); }, seed);
  let cp = 0, frame = 0, dead = false;
  const runs = [];
  while (!dead && cp < CHECKPOINTS.length) {
    const r = await page.evaluate((n) => {
      for (let i = 0; i < n; i++) { window.__cap.step(); const s = window.__cap.state(); if (s.mode === 'dead' || s.mode === 'win') return { s, early: true }; }
      return { s: window.__cap.state(), early: false };
    }, CHECKPOINTS[cp] - frame);
    frame = CHECKPOINTS[cp];
    delete r.s.fx; // fx counters ride wall-clock rAF (cosmetic layer, excluded per the m15 determinism rule)
    const json = JSON.stringify(r.s);
    const h = createHash('sha256').update(json).digest('hex').slice(0, 16);
    runs.push({ frame, hash: h, mode: r.s.mode, t: +r.s.time.toFixed(2), lv: r.s.level, kills: r.s.kills });
    dead = r.early || r.s.mode === 'dead' || r.s.mode === 'win';
    cp++;
  }
  out.push({ seed, runs });
  console.log(`seed ${seed}: ` + runs.map((r) => `${r.frame}:${r.hash}(${r.mode})`).join(' '));
}
await b.close();
killIfOwned();
console.log('FP ' + createHash('sha256').update(JSON.stringify(out)).digest('hex'));
