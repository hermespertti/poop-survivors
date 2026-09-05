// One-shot M12 probe: mirror the balance bot VERBATIM (incl. M12 lint-king
// contact-retreat), run one dying seed, sample 5s-res from 1500s to the end.
// Goal: see WHAT the bot dies to at the Lint King — rings (chip), contact
// (16dmg), spitter minions, or cornering.
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned, URL } from './server.mjs';
const SEED = parseInt(process.argv[2] || '42');
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'] });
const page = await b.newPage();
await page.setViewport({ width: 960, height: 720 });
await ensureServer();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 2200));
const thinkSrc = await (await import('node:fs')).promises.readFile('/home/lex/poop-survivors/test/balance.mjs', 'utf8');
// extract the __bot object verbatim from balance.mjs (single source of truth)
const m = thinkSrc.match(/window\.__bot = \{[\s\S]*?\n  \};/);
if (!m) { console.error('could not extract __bot'); process.exit(2); }
const botObj = m[0].replace('window.__bot = ', '').replace(/\};\s*$/, '}');
await page.evaluate((src) => { window.__botSrc = src; }, botObj);
await page.evaluate(() => { window.__bot = eval('(' + window.__botSrc + ')'); });
// driver with 5s sampling + build/HP capture after 1500s
await page.evaluate(() => {
  window.__probe = [];
  window.__drive = (nFrames) => {
    const c = window.__cap;
    for (let i = 0; i < nFrames; i++) {
      const s = c.state();
      if (s.mode === 'dead' || s.mode === 'win') {
        const w = s.weapons, ps = s.passives;
        window.__probe.push({ t: Math.round(s.time), hp: Math.round(s.hp), mb: s.maxHp, boss: s.boss ? s.boss.name : '', bhp: s.boss ? Math.round(s.boss.hp) : 0, e: s.enemies, w: JSON.stringify(w), p: JSON.stringify(ps), eb: (c.enemyBullets(6) || []).map(x => Math.round(x.d)) });
        return s;
      }
      if (s.mode === 'levelup') window.__bot.pick();
      window.__bot.think();
      c.step();
      if (s.time >= 1500 && Math.round(s.time * 2) % 10 === 0) {
        const s2 = c.state();
        window.__probe.push({ t: Math.round(s2.time), hp: Math.round(s2.hp), mb: s2.maxHp, boss: s2.boss ? s2.boss.name : '', bhp: s2.boss ? Math.round(s2.boss.hp) : 0, e: s2.enemies, w: s2.time ? JSON.stringify(s2.weapons) : '', p: JSON.stringify(s2.passives), eb: (c.enemyBullets(6) || []).map(x => Math.round(x.d)) });
      }
    }
    return c.state();
  };
});
await page.evaluate(() => window.__cap.freeze());
await page.evaluate((sd) => { window.__cap.restart(sd); }, SEED);
const t0 = Date.now();
let finalState = null;
while (Date.now() - t0 < 360000) {
  const s = await page.evaluate(() => window.__drive(6000));
  if (s.mode === 'dead' || s.mode === 'win') { finalState = s; break; }
}
if (!finalState) finalState = await page.evaluate(() => window.__cap.state());
console.log(`seed ${SEED}: ${finalState.mode} @ ${finalState.time.toFixed(0)}s lv ${finalState.level}`);
const samples = await page.evaluate(() => window.__probe);
for (const s of samples.slice(-45)) {
  console.log(`t=${s.t} hp=${s.hp}/${s.mb} boss=${s.boss || '-'} bhp=${s.bhp} e=${s.e} eb=${(s.eb || []).join(' ')} ${s.w || ''} ${s.p || ''}`);
}
await b.close();
killIfOwned();
