// one-shot in-page trace of seed 1337 (m3 head start): the 27:00-30:00 death window
// all in a SINGLE page.evaluate — the slow multi-roundtrip probe died on CDP cost
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await b.newPage();
await page.goto('http://127.0.0.1:5193/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cap);
const t0 = Date.now();
const trace = await page.evaluate(async () => {
  // ---- m3.mjs bot, verbatim (think + pick) ----
  const cap = window.__cap;
  const bot = {
    think() {
      const s = cap.state();
      if (s.mode !== 'play') return;
      const W = s.world.w, H = s.world.h;
      const near = cap.enemies(16).filter((e) => e.d < 100);
      if (s.flush) {
        const fd = Math.hypot(s.flush.x - s.x, s.flush.z - s.z);
        const dx = s.x - s.flush.x, dz = s.z - s.flush.z;
        const d = Math.hypot(dx, dz) || 1;
        if (fd > 60) { cap.move(-dx / d, -dz / d); return; }
        if (fd < 45) { cap.move(dx / d, dz / d); return; }
        let sx = -dz / d, sz = dx / d;
        if ((sx > 0.3 && s.x > W - 120) || (sx < -0.3 && s.x < 120) ||
            (sz > 0.3 && s.z > H - 120) || (sz < -0.3 && s.z < 120)) { sx = -sx; sz = -sz; }
        cap.move(sx, sz); return;
      }
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
    pick() {
      const s = cap.state();
      if (s.mode !== 'levelup') return;
      const o = s.options;
      let pick = -1;
      if (s.hp < 30) pick = o.findIndex((x) => x.id === 'hp');
      if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring' && !s.weapons.crackerring);
      if (pick < 0) pick = o.findIndex((x) => x.id === 'fartwhip' && x.lvl < 8 && !s.weapons.superfart);
      if (pick < 0 && !(s.passives.quick)) pick = o.findIndex((x) => x.id === 'quick');
      if (pick < 0) pick = o.findIndex((x) => x.id === 'quick' && s.passives.quick < 5);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive');
      if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring');
      if (pick < 0) pick = 0;
      cap.pick(pick);
    },
  };
  cap.freeze();
  cap.restart(1337);
  cap.giveWeaponNow('superfart', 8);
  cap.giveWeaponNow('crackerring', 8);
  cap.givePassiveNow('quick', 5);
  cap.givePassiveNow('meats', 5);
  const rows = [];
  const snap = (t) => {
    const s = cap.state();
    rows.push({
      t: Math.round(t), hp: Math.round(s.hp), maxHp: Math.round(s.maxHp),
      pop: s.enemies, lvl: s.level,
      boss: s.boss ? { n: s.boss.name, hp: Math.round(s.boss.hp), p2: !!s.boss.phase2 } : null,
      near60: cap.enemiesNear(60),
    });
  };
  for (let f = 0; f < 120000; f++) {
    const s0 = cap.state();
    if (s0.mode === 'dead' || s0.mode === 'win') break;
    if (s0.mode === 'levelup') bot.pick();
    bot.think();
    cap.step();
    if (s0.time >= 1440 && f % 30 === 0) snap(s0.time);
  }
  const end = cap.state();
  return {
    rows,
    end: { t: end.time, mode: end.mode, lvl: end.level, kills: end.kills, flushed: end.flushed,
           weapons: end.weapons, bossKilled: end.bossKilled },
  };
});
console.log('wall ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
const e = trace.end;
console.log('END t=' + e.t + ' mode=' + e.mode + ' lv=' + e.lvl + ' kills=' + e.kills + ' flushed=' + e.flushed);
console.log('weapons ' + JSON.stringify(e.weapons));
for (const r of trace.rows) {
  console.log(`t=${r.t} hp=${r.hp}/${r.maxHp} pop=${r.pop} lv=${r.lvl} near60=${r.near60} boss=${r.boss ? r.boss.n + ':' + r.boss.hp + (r.boss.p2 ? ':RAGE' : '') : '-'}`);
}
await b.close();
