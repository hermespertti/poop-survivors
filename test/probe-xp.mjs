// Probe v2: XP telemetry with the official bot, crouton seed 42, returned to node.
import puppeteer from 'puppeteer-core';
import { ensureServer, URL } from './server.mjs';

const EXE = '/usr/bin/chromium';
const b = await puppeteer.launch({
  executablePath: EXE, headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'],
});
const page = await b.newPage();
await page.setViewport({ width: 960, height: 720 });
page.on('pageerror', (e) => console.log('PAGEERR', String(e)));
await ensureServer();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 2200));

await page.evaluate(() => {
  window.__bot = {
    think() { // VERBATIM from test/balance.mjs
      const cap = window.__cap;
      const s = cap.state();
      if (s.mode !== 'play') return;
      const W = s.world.w, H = s.world.h;
      if (s.chest && !s.boss) {
        const cdx = s.chest.x - s.x, cdz = s.chest.z - s.z;
        const cd = Math.hypot(cdx, cdz) || 1;
        if (cd < 220) { cap.move(cdx / cd, cdz / cd); return; }
      }
      if (s.boss && s.boss.kind === 'lintking') {
        const bd = Math.hypot(s.boss.x - s.x, s.boss.z - s.z);
        const nearShot = (cap.enemyBullets(3) || []).some((bb) => bb.d < 60);
        if (bd < 110 && !nearShot) {
          const kx = (s.x - s.boss.x) / (bd || 1), kz = (s.z - s.boss.z) / (bd || 1);
          cap.move(kx, kz); return;
        }
      }
      const shots = cap.enemyBullets(6).filter((b) => b.d < 110);
      if (shots.length) {
        const b0 = shots[0];
        const sp = Math.hypot(b0.vx, b0.vz) || 1;
        let px = -b0.vz / sp, pz = b0.vx / sp;
        if (shots.length >= 2) {
          let cxx = 0, czz = 0;
          for (const bb of shots) { cxx += bb.x; czz += bb.z; }
          cxx /= shots.length; czz /= shots.length;
          const ax = s.x - cxx, az = s.z - czz;
          if (px * ax + pz * az < 0) { px = -px; pz = -pz; }
        } else {
          if ((px > 0.3 && s.x > W - 120) || (px < -0.3 && s.x < 120) ||
              (pz > 0.3 && s.z > H - 120) || (pz < -0.3 && s.z < 120)) { px = -px; pz = -pz; }
        }
        cap.move(px, pz); return;
      }
      if (s.hp < 45) {
        const items = cap.itemList ? cap.itemList() : [];
        let best = null, bd = 160;
        for (const it of items) {
          if (it.kind !== 'heal') continue;
          const dd = Math.hypot(it.x - s.x, it.z - s.z);
          if (dd < bd) { bd = dd; best = it; }
        }
        if (best) {
          const dx = best.x - s.x, dz = best.z - s.z;
          const dd = Math.hypot(dx, dz) || 1;
          cap.move(dx / dd, dz / dd); return;
        }
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
    pick() { // VERBATIM official ladder (crouton hardwired)
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
      if (pick < 0 && s.evolved && dpsCount < 3) {
        const AOE_PREF = ['stinkaura', 'fartbomb', 'puddle', 'mine', 'chainfart'];
        for (const pref of AOE_PREF) {
          const i = o.findIndex((x) => x.kind === 'weapon' && x.id === pref && !s.weapons[pref]);
          if (i >= 0) { pick = i; break; }
        }
        if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      }
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive' && s.passives[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring' && x.lvl < 8);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive');
      if (pick < 0) pick = 0;
      cap.pick(pick);
    },
  };
  window.__p = [];
  window.__drive = (nFrames) => {
    const c = window.__cap;
    let last = (window.__p[window.__p.length - 1] || { t: -30 }).t;
    for (let i = 0; i < nFrames; i++) {
      const s = c.state();
      if (s.mode === 'levelup') window.__bot.pick();
      if (s.mode === 'dead' || s.mode === 'win') {
        window.__p.push({ t: Math.round(s.time), l: s.level, xp: Math.round(s.xp), xn: s.xpNeed, gems: s.stats.gems, k: s.kills, e: s.enemies, hp: s.hp, w: { ...s.weapons } });
        return s;
      }
      window.__bot.think();
      c.step();
      const s2 = c.state();
      if (Math.floor(s2.time) >= last + 30) {
        last = Math.floor(s2.time);
        window.__p.push({ t: last, l: s2.level, xp: Math.round(s2.xp), xn: s2.xpNeed, gems: s2.stats.gems, k: s2.kills, e: s2.enemies, hp: s2.hp, w: { ...s2.weapons } });
      }
    }
    return c.state();
  };
});
await page.evaluate(() => window.__cap.freeze());
await page.evaluate(() => { window.__cap.restart(42); });

let fin = null;
const t0 = Date.now();
while (Date.now() - t0 < 200000) {
  const s = await page.evaluate(() => window.__drive(6000));
  if (s.mode === 'dead' || s.mode === 'win') { fin = s; break; }
}
fin = fin || await page.evaluate(() => window.__cap.state());
const p = await page.evaluate(() => window.__p);
for (const r of p) console.log(`t=${String(r.t).padStart(4)}s lv=${String(r.l).padStart(2)} xp=${r.xp}/${r.xn} gems=${String(r.gems).padStart(5)} kills=${String(r.k).padStart(5)} enemies=${String(r.e).padStart(3)} hp=${String(r.hp).padStart(3)} w=${JSON.stringify(r.w)}`);
console.log(`FINAL ${fin.mode} @${fin.time.toFixed(0)}s lv ${fin.level}`);
await b.close();
