// M17 BALANCE VARIANTS SOAK — the build-diversity pass (GDD §22 tail).
//
// The official gate (balance.mjs) soaks ONE build: the crouton ladder
// (ring + whip→SUPER FART). It proves THAT build clears the curve — it says
// nothing about whether the other five characters' evo lines survive the M13
// density pass + M14 damage ramp, which is what a player who picks Hot Dog
// or Cheese actually experiences.
//
// Same AI, same metrics, different ladder per character: think() is copied
// VERBATIM from balance.mjs (chest seek, Lint King react, gap dodge, heal
// seek, weighted centroid kiting, corner flee). pick() keeps the official
// ladder SHAPE — ring defense backbone, own base line to 8, the gate passive
// that arms the evolution, evolved line post-chest, sustain for the gauntlet
// — but parameterized to each character's start weapon. No head starts: the
// ladder only takes what the level-up screen actually offers.
//
// Exit criteria per build (5 seeds): survival ≥1/5 OR ≥20:00 by ≥3/5; OR
// heaven by ≥3/5; OR boss median ≥2. A build failing ALL three = the curve
// eats that character whole and needs a tune.
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned, URL } from './server.mjs';

const EXE = '/usr/bin/chromium';
const SEEDS = [42, 1337, 9001, 7777, 31415]; // the official gate's first 5
const HORIZON_MS = 360000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// char → its own evo line, from the WEAPONS/CHARACTERS tables
const BUILDS = [
  { char: 'crouton', base: 'fartwhip',   gate: 'quick',   evo: 'superfart',    unlock: null },
  { char: 'hotdog',  base: 'plopcannon', gate: 'sticky',  evo: 'stickyplop',   unlock: 'survive10' },
  { char: 'avocado', base: 'puddle',     gate: 'meats',   evo: 'slakelake',    unlock: 'kills500' },
  { char: 'plunger', base: 'spritz',     gate: 'tp',      evo: 'gunkfountain', unlock: 'boss3' },
  { char: 'cheese',  base: 'mine',       gate: 'fuse',    evo: 'minelord',     unlock: 'minekill' },
  { char: 'onion',   base: 'bouncy',     gate: 'gloves',  evo: 'superball',    unlock: 'goldrun' },
];

const b = await puppeteer.launch({
  executablePath: EXE, headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'],
});
const page = await b.newPage();
await page.setViewport({ width: 960, height: 720 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await ensureServer();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(2200);

// unlock the roster (the M11 shop-unlock wall is not what this soak tests)
await page.evaluate((builds) => {
  for (const bd of builds) if (bd.unlock) window.__cap.metaGive(bd.unlock);
}, BUILDS);

await page.evaluate(() => {
  window.__bot = {
    think() { // VERBATIM from test/balance.mjs (the official natural bot)
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
          const cd = Math.hypot(ccx - s.x, ccz - s.z);
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
    pick() { // the official ladder shape, parameterized per character
      const cap = window.__cap;
      const s = cap.state();
      if (s.mode !== 'levelup') return;
      const o = s.options;
      const bd = window.__var;
      let pick = -1;
      if (s.hp < 30) pick = o.findIndex((x) => x.id === 'hp');
      if (pick < 0 && !s.weapons.crackerring) pick = o.findIndex((x) => x.id === 'crackerring'); // ring acquire: defense
      if (pick < 0 && !s.evolved && s.weapons.crackerring && s.weapons.crackerring < 3) pick = o.findIndex((x) => x.id === 'crackerring'); // ring 3: boss-window defense
      if (pick < 0 && !s.weapons[bd.evo]) pick = o.findIndex((x) => x.id === bd.base); // own line to 8 (the evo line)
      if (pick < 0 && !(s.passives[bd.gate])) pick = o.findIndex((x) => x.id === bd.gate); // the evo gate passive
      if (pick < 0) pick = o.findIndex((x) => x.id === bd.evo && x.lvl < 8); // post-evo: evolved line first
      if (pick < 0 && s.weapons.crackerring && s.weapons.crackerring < 8) pick = o.findIndex((x) => x.id === 'crackerring'); // ring 8: AoE wall
      if (pick < 0 && s.evolved && s.passives[bd.gate] && s.passives[bd.gate] < 5) pick = o.findIndex((x) => x.id === bd.gate); // gate passive to 5
      if (pick < 0 && s.evolved && (s.passives.breakfast || 0) < 3) pick = o.findIndex((x) => x.id === 'breakfast'); // sustain pillar (M10k)
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && s.weapons[x.id] && x.lvl < 8 && (x.id !== bd.base || !s.weapons[bd.evo])); // scale owned (never re-add consumed base)
      const dpsCount = Object.keys(s.weapons).filter((k) => k !== 'crackerring').length;
      if (pick < 0 && s.evolved && dpsCount < 3) { // kit slot: AoE first (M12e)
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
  window.__varDrive = (nFrames) => {
    const c = window.__cap;
    if (!window.__vsamp) window.__vsamp = [];
    for (let i = 0; i < nFrames; i++) {
      const s = c.state();
      if (s.mode === 'dead' || s.mode === 'win') {
        window.__vsamp.push({ t: Math.round(s.time), k: s.kills, e: s.enemies, l: s.level, hp: s.hp, mb: s.maxHp, b: s.boss ? 1 : 0, bk: s.bossKilled, w: { ...s.weapons }, p: { ...s.passives } });
        return s;
      }
      if (s.mode === 'levelup') {
        window.__bot.pick();
        // M17 trace: what was on offer vs what the ladder chose
        try {
          if (window.__vtrace && window.__vtrace.length < 60) {
            const s2 = cap.state();
            window.__vtrace.push({ t: Math.round(s.time), opts: (s.options || []).map((x) => x.id + (x.kind === 'weapon' ? ':' + x.lvl : '')), got: (s2.options && s2.options[s2.pickIdx]) ? '?' : '', lv: s.level });
          }
        } catch (e) {}
      }
      window.__bot.think();
      c.step();
      if (i % 300 === 0) {
        const s2 = c.state();
        window.__vsamp.push({ t: Math.round(s2.time), k: s2.kills, e: s2.enemies, l: s2.level, hp: s2.hp, mb: s2.maxHp, b: s2.boss ? 1 : 0, bk: s2.bossKilled });
      }
    }
    return c.state();
  };
});
await page.evaluate(() => window.__cap.freeze());

const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const spawnRate = (t) => 1 / Math.max(0.18, 0.85 - t / 260);
function heavenOf(samples) {
  const wins = [];
  for (let i = 0; i + 5 < samples.length; i += 6) {
    const a = samples[i], bb = samples[i + 5];
    if (bb.t - a.t < 25) break;
    const clears30 = ((bb.k - a.k) / (bb.t - a.t)) * 30;
    wins.push({ t: bb.t, cross: clears30 > spawnRate(bb.t) * 30 });
  }
  let streak = 0, first = -1;
  for (const w of wins) {
    if (w.t < 300) { streak = 0; continue; }
    if (w.cross) { streak++; if (streak >= 2 && first < 0) first = w.t; }
    else streak = 0;
  }
  return first;
}

// ============ run every build ============
const results = [];
for (const bd of BUILDS) {
  const runs = [];
  for (const seed of SEEDS) {
    // select FIRST: restart → startRun → mkGame reads selectedChar at call
    // time, so the char must be selected before the game object is built.
    await page.evaluate((bobj) => {
      window.__vsamp = [];
      window.__var = bobj;
      const r = window.__cap.selectChar(bobj.char);
      if (r.err) throw new Error('selectChar ' + JSON.stringify(r));
    }, bd);
    await page.evaluate((sd) => { window.__cap.restart(sd); }, seed);
    const s0 = await page.evaluate(() => window.__cap.state());
    if (s0.char !== bd.char) throw new Error(`char mismatch: asked ${bd.char}, got ${s0.char}`);
    const t0 = Date.now();
    let finalState = null;
    while (Date.now() - t0 < HORIZON_MS) {
      const s = await page.evaluate(() => window.__varDrive(6000));
      if (s.mode === 'dead' || s.mode === 'win') { finalState = s; break; }
    }
    if (!finalState) finalState = await page.evaluate(() => window.__cap.state());
    const samples = await page.evaluate(() => window.__vsamp);
    runs.push({ seed, mode: finalState.mode, time: +finalState.time.toFixed(0), level: finalState.level, kills: finalState.kills, flushed: !!finalState.flushed, samples });
    console.log(`  [${bd.char}] seed ${seed}: ${finalState.mode} @ ${finalState.time.toFixed(0)}s | lv ${finalState.level} | kills ${finalState.kills}${finalState.flushed ? ' | FLUSHED' : ''}`);
  }
  results.push({ bd, runs });
}

// ============ report + gate ============
console.log('\n================ M17 VARIANTS REPORT ================');
let fail = 0;
for (const { bd, runs } of results) {
  const heavens = runs.map((r) => heavenOf(r.samples)).filter((t) => t > 0);
  const surv = runs.filter((r) => r.mode === 'win').length;
  const deep = runs.filter((r) => r.time >= 1200).length;
  const deaths = runs.filter((r) => r.mode === 'dead');
  const bossMed = med(runs.map((r) => r.samples[r.samples.length - 1]?.bk ?? 0));
  const survives = surv >= 1 || deep >= 3;
  const outclears = heavens.length >= 3;
  const fights = bossMed >= 2;
  const okBuild = survives || outclears || fights; // fails ALL three = eaten whole
  if (!okBuild) fail++;
  console.log(`[${bd.char.padEnd(8)}] ${okBuild ? 'OK  ' : 'FAIL'} surv ${surv}/5 | ≥20min ${deep}/5 | heaven ${heavens.length}/5 (${heavens.length ? (med(heavens) / 60).toFixed(1) + 'min' : '—'}) | boss med ${bossMed} | deaths ${deaths.length}${deaths.length ? ' (' + deaths.map((d) => `${d.seed}@${Math.round(d.time / 60)}m`).join(' ') : ''}`);
}
console.log(errs.length === 0 ? 'console clean across all runs' : `console: ${errs.length} errors: ${errs.slice(0, 2).join(' | ')}`);
console.log(`M17 VARIANTS: ${results.length - fail}/${results.length} builds viable`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
