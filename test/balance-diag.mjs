// BALANCE DIAGNOSTIC — is early death a GAME issue or a BOT-BUILD artifact?
// A/B: same kiting AI, two build orders, same seeds. Prints per-30s
// clear-rate (kill delta) vs analytic spawn-rate + live population, so we
// can SEE where (if ever) clear rate crosses spawn rate = "bullet heaven."
// Spawn rate is analytic: interval = max(0.25, 1.1 - t/300) s → 1/interval.
// (wave bursts add spikes on top; noted, not in the analytic baseline.)
import puppeteer from 'puppeteer-core';
const EXE = '/usr/bin/chromium';
const URL = 'http://127.0.0.1:5193/';
const SEEDS = [42, 1337, 9001, 7777];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({
  executablePath: EXE, headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'],
});
const page = await b.newPage();
await page.setViewport({ width: 960, height: 720 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(2200);

// think(): the proven M3/M4 kiting AI (identical). Only pick() varies.
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
        const tdx = best[0] - s.x, tdz = best[1] - s.z;
        const td = Math.hypot(tdx, tdz) || 1;
        cap.move(tdx / td, tdz / td); return;
      }
      if (d > 70) { cap.move(dx / d, dz / d); return; }
      if (d < 30) { cap.move(-dx / d, -dz / d); return; }
      let sx = -dz / d, sz = dx / d;
      if ((sx > 0.3 && s.x > W - 120) || (sx < -0.3 && s.x < 120) ||
          (sz > 0.3 && s.z > H - 120) || (sz < -0.3 && s.z < 120)) { sx = -sx; sz = -sz; }
      cap.move(sx, sz);
    },
  };
  // A = dps-first (whip → quick → ring → diversify late)  [the current bot]
  // B = defense+diversify-first (ring → 2nd weapon → 3rd → then max dps)
  window.__pickA = () => {
    const cap = window.__cap; const s = cap.state();
    if (s.mode !== 'levelup') return;
    const o = s.options; let p = -1;
    if (s.hp < 30) p = o.findIndex((x) => x.id === 'hp');
    if (p < 0) p = o.findIndex((x) => x.id === 'fartwhip' && x.lvl < 8);
    if (p < 0 && !s.passives.quick) p = o.findIndex((x) => x.id === 'quick');
    if (p < 0 && !s.weapons.crackerring) p = o.findIndex((x) => x.id === 'crackerring');
    if (p < 0) p = o.findIndex((x) => x.id === 'crackerring' && x.lvl < 8);
    if (p < 0) p = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
    if (p < 0) p = o.findIndex((x) => x.kind === 'passive');
    if (p < 0) p = 0;
    cap.pick(p);
  };
  window.__pickB = () => {
    const cap = window.__cap; const s = cap.state();
    if (s.mode !== 'levelup') return;
    const o = s.options; let p = -1;
    if (s.hp < 30) p = o.findIndex((x) => x.id === 'hp');
    // grab a DEFENSIVE ring up (survives the early swarm)
    if (p < 0) p = o.findIndex((x) => x.id === 'crackerring' && x.lvl < 6);
    // diversify EARLY: 2nd then 3rd weapon (clear-rate explosion, VS-style)
    if (p < 0) p = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
    // then scale what we have
    if (p < 0) p = o.findIndex((x) => x.kind === 'weapon' && x.lvl < 8);
    if (p < 0) p = o.findIndex((x) => x.kind === 'passive');
    if (p < 0) p = 0;
    cap.pick(p);
  };
  window.__diagnose = (variant, nFrames) => {
    const c = window.__cap;
    const pick = variant === 'A' ? window.__pickA : window.__pickB;
    if (!window.__dsamp) window.__dsamp = [];
    for (let i = 0; i < nFrames; i++) {
      const s = c.state();
      if (s.mode === 'dead' || s.mode === 'win') {
        window.__dsamp.push({ t: Math.round(s.time), k: s.kills, e: s.enemies, l: s.level, hp: s.hp });
        return s;
      }
      if (s.mode === 'levelup') pick();
      window.__bot.think();
      c.step();
      if (i % 180 === 0) { const s2 = c.state(); window.__dsamp.push({ t: Math.round(s2.time), k: s2.kills, e: s2.enemies, l: s2.level, hp: s2.hp }); } // every 3s
    }
    return c.state();
  };
});
await page.evaluate(() => window.__cap.freeze());

// analytic spawn rate (per second) from the director formula
const spawnRate = (t) => 1 / Math.max(0.25, 1.1 - t / 300);

function report(variant, runs) {
  console.log(`\n############ VARIANT ${variant} ############`);
  const deaths = runs.filter((r) => r.mode === 'dead');
  console.log(`death: ${deaths.length}/${runs.length}  times: ${runs.map((r) => r.time + 's').join(', ')}`);
  // per-seed: print 30s-window clear-rate vs spawn-rate until death or 15:00
  for (const r of runs) {
    console.log(`  seed ${r.seed} (${r.mode}@${r.time}s lv${r.level}):`);
    const s = r.samples;
    let line = '    t(s)  clear/30s  spawn/30s  pop  clear>spawn?';
    console.log(line);
    for (let w = 0; w < s.length; w += 10) { // 10 samples * 3s = 30s windows
      const chunk = s.slice(w, w + 10);
      if (!chunk.length) break;
      const t0 = chunk[0].t, t1 = chunk[chunk.length - 1].t;
      if (t1 - t0 < 20) break;
      const clears = chunk[chunk.length - 1].k - chunk[0].k;
      const clears30 = (clears / (t1 - t0)) * 30;
      const sp30 = spawnRate(t1) * 30;
      const pop = chunk[chunk.length - 1].e;
      const cross = clears30 > sp30 ? 'HEAVEN' : '';
      console.log(`    ${String(t1).padStart(3)}   ${clears30.toFixed(1).padStart(7)}   ${sp30.toFixed(1).padStart(9)}   ${String(pop).padStart(3)}   ${cross}`);
    }
  }
}

// run both variants, all seeds
const resA = [], resB = [];
for (const seed of SEEDS) {
  await page.evaluate(() => { window.__dsamp = []; });
  await page.evaluate((sd) => { window.__cap.restart(sd); }, seed);
  const t0 = Date.now(); let fin = null;
  while (Date.now() - t0 < 180000) {
    const s = await page.evaluate(() => window.__diagnose('A', 6000));
    if (s.mode === 'dead' || s.mode === 'win') { fin = s; break; }
    if (s.time > 900) { fin = s; break; }
  }
  if (!fin) fin = await page.evaluate(() => window.__cap.state());
  resA.push({ seed, mode: fin.mode, time: +fin.time.toFixed(0), level: fin.level, samples: await page.evaluate(() => window.__dsamp) });
}
for (const seed of SEEDS) {
  await page.evaluate(() => { window.__dsamp = []; });
  await page.evaluate((sd) => { window.__cap.restart(sd); }, seed);
  const t0 = Date.now(); let fin = null;
  while (Date.now() - t0 < 180000) {
    const s = await page.evaluate(() => window.__diagnose('B', 6000));
    if (s.mode === 'dead' || s.mode === 'win') { fin = s; break; }
    if (s.time > 900) { fin = s; break; }
  }
  if (!fin) fin = await page.evaluate(() => window.__cap.state());
  resB.push({ seed, mode: fin.mode, time: +fin.time.toFixed(0), level: fin.level, samples: await page.evaluate(() => window.__dsamp) });
}

console.log('\n' + '='.repeat(60));
console.log('BALANCE DIAGNOSTIC — clear rate vs spawn rate');
console.log('='.repeat(60));
report('A  (dps-first, current)', resA);
report('B  (defense+diversify-first)', resB);
console.log('\nconsole:', errs.length === 0 ? 'clean' : errs.slice(0, 3).join(' | '));
await b.close();
