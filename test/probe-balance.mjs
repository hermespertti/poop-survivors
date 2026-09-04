// BALANCE PROBE (one-shot) — the §22 tail: WHY do the natural seeds die?
// Runs the balance.mjs bot VERBATIM (think + pick, M9 dodge included) on all
// 10 seeds, compact per-seed timeline: level / hp% / pop / ring / whip /
// evo state every 30s, plus the exact build at death. Read-only diagnostic —
// never a gate.
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned, URL } from './server.mjs';

const EXE = '/usr/bin/chromium';
const SEEDS = [55, 404, 31415, 272, 42, 1337, 9001, 7777, 1618, 27182];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await ensureServer();
const b = await puppeteer.launch({
  executablePath: EXE, headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'],
});
const page = await b.newPage();
await page.setViewport({ width: 960, height: 720 });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 2200));

// verbatim from test/balance.mjs (think + pick), with denser sampling
await page.evaluate(() => {
  window.__bot = {
    think() {
      const cap = window.__cap;
      const s = cap.state();
      if (s.mode !== 'play') return;
      const W = s.world.w, H = s.world.h;
      if (s.chest && !s.boss) {
        const cdx = s.chest.x - s.x, cdz = s.chest.z - s.z;
        const cd = Math.hypot(cdx, cdz) || 1;
        if (cd < 220) { cap.move(cdx / cd, cdz / cd); return; }
      }
      const shots = cap.enemyBullets(6).filter((b) => b.d < 110);
      if (shots.length) {
        const b0 = shots[0];
        const sp = Math.hypot(b0.vx, b0.vz) || 1;
        let px = -b0.vz / sp, pz = b0.vx / sp;
        if ((px > 0.3 && s.x > W - 120) || (px < -0.3 && s.x < 120) ||
            (pz > 0.3 && s.z > H - 120) || (pz < -0.3 && s.z < 120)) { px = -px; pz = -pz; }
        cap.move(px, pz); return;
      }
      const near = cap.enemies(16).filter((e) => e.d < 100);
      let wx = 0, wz = 0, wsum = 0;
      for (const e of near) { const w = 1 - e.d / 100; wx += e.x * w; wz += e.z * w; wsum += w; }
      if (s.boss) {
        const bd = Math.hypot(s.boss.x - s.x, s.boss.z - s.z);
        if (bd < 150) { const w = 3 * (1 - bd / 150); wx += s.boss.x * w; wz += s.boss.z * w; wsum += w; }
      }
      if (wsum < 0.15) {
        const gem = cap.nearestGem();
        if (gem && gem.d < 90 && gem.d > 8) {
          const dx = gem.x - s.x, dz = gem.z - s.z;
          const d = Math.hypot(dx, dz) || 1;
          cap.move(dx / d, dz / d); return;
        }
        cap.move(0, 0); return;
      }
      const cx = wx / wsum, cz = wz / wsum;
      let dx = s.x - cx, dz = s.z - cz;
      const d = Math.hypot(dx, dz) || 1;
      if (wsum > 2.2) {
        const corners = [[0, 0], [W, 0], [0, H], [W, H]];
        let best = null, bd = -1;
        for (const [ccx, ccz] of corners) {
          const cd = Math.hypot(ccx - cx, ccz - cz);
          if (cd > bd) { bd = cd; best = [ccx, ccz]; }
        }
        const tdx = best[0] - s.x, tdz = best[1] - s.z; const td = Math.hypot(tdx, tdz) || 1;
        cap.move(tdx / td, tdz / td); return;
      }
      if (d > 70) { cap.move(dx / d, dz / d); return; }
      if (d < 30) { cap.move(-dx / d, -dz / d); return; }
      let sx = -dz / d, sz = dx / d;
      if ((sx > 0.3 && s.x > W - 120) || (sx < -0.3 && s.x < 120) ||
          (sz > 0.3 && s.z > H - 120) || (sz < -0.3 && s.z < 120)) { sx = -sx; sz = -sz; }
      cap.move(sx, sz);
    },
    pick() {
      const cap = window.__cap;
      const s = cap.state();
      if (s.mode !== 'levelup') return;
      const o = s.options;
      let pick = -1;
      if (s.hp < 30) pick = o.findIndex((x) => x.id === 'hp');
      if (pick < 0 && !s.weapons.crackerring) pick = o.findIndex((x) => x.id === 'crackerring');
      if (pick < 0 && !s.evolved && s.weapons.crackerring && s.weapons.crackerring < 3) pick = o.findIndex((x) => x.id === 'crackerring');
      if (pick < 0 && !s.weapons.superfart) pick = o.findIndex((x) => x.id === 'fartwhip');
      if (pick < 0 && !(s.passives.quick)) pick = o.findIndex((x) => x.id === 'quick');
      if (pick < 0) pick = o.findIndex((x) => x.id === 'superfart' && x.lvl < 8);
      if (pick < 0 && s.weapons.crackerring && s.weapons.crackerring < 8) pick = o.findIndex((x) => x.id === 'crackerring');
      if (pick < 0 && s.evolved && s.passives.quick && s.passives.quick < 5) pick = o.findIndex((x) => x.id === 'quick');
      if (pick < 0 && s.evolved && (s.passives.breakfast || 0) < 3) pick = o.findIndex((x) => x.id === 'breakfast');
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && s.weapons[x.id] && x.lvl < 8 && (x.id !== 'fartwhip' || !s.weapons.superfart));
      const dpsCount = Object.keys(s.weapons).filter((k) => k !== 'crackerring').length;
      if (pick < 0 && s.evolved && dpsCount < 3) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive' && s.passives[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring' && x.lvl < 8);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive');
      if (pick < 0) pick = 0;
      cap.pick(pick);
    },
  };
  window.__drive = (nFrames) => {
    const c = window.__cap;
    if (!window.__ps) window.__ps = [];
    for (let i = 0; i < nFrames; i++) {
      const s = c.state();
      if (s.mode === 'dead' || s.mode === 'win') {
        const w = s.weapons, ps = s.passives;
        window.__ps.push({ t: Math.round(s.time), l: s.level, hp: Math.round(s.hp), mb: s.mb || 60, e: s.enemies, w: JSON.stringify(w), p: JSON.stringify(ps), b: s.boss ? s.boss.name : '' });
        return s;
      }
      if (s.mode === 'levelup') window.__bot.pick();
      window.__bot.think();
      c.step();
      if (i % 1800 === 0) { // every 30 game-seconds
        const s2 = c.state();
        const w = s2.weapons, ps = s2.passives;
        window.__ps.push({ t: Math.round(s2.time), l: s2.level, hp: Math.round(s2.hp), mb: 60, e: s2.enemies, w: JSON.stringify(w), p: JSON.stringify(ps), b: s2.boss ? s2.boss.name : '' });
      }
    }
    return c.state();
  };
});
await page.evaluate(() => window.__cap.freeze());

for (const seed of SEEDS) {
  await page.evaluate(() => { window.__ps = []; });
  await page.evaluate((sd) => { window.__cap.restart(sd); }, seed);
  const t0 = Date.now();
  let fin = null;
  while (Date.now() - t0 < 120000) {
    const s = await page.evaluate(() => window.__drive(9000));
    if (s.mode === 'dead' || s.mode === 'win') { fin = s; break; }
    if (s.time > 1500) { fin = s; break; } // 25 min is enough to see the wall
  }
  if (!fin) fin = await page.evaluate(() => window.__cap.state());
  const rows = await page.evaluate(() => window.__ps);
  console.log(`\n=== seed ${seed}: ${fin.mode} @ ${Math.round(fin.time)}s lv ${fin.level} kills ${fin.kills} bossKilled ${fin.bossKilled} ===`);
  for (const r of rows) {
    console.log(`  ${String(r.t).padStart(4)}s lv${String(r.l).padStart(2)} hp${String(r.hp).padStart(3)} pop${String(r.e).padStart(3)} ${r.b ? '[' + r.b + '] ' : ''}W:${r.w} P:${r.p}`);
  }
}
await b.close();
killIfOwned();
