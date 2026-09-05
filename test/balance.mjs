// M7 BALANCE SOAK — the GDD's "M7" deliverable: run the full 30:00 N times
// with a natural build (no head start — the level-up path a real player
// experiences) and report a RATE, not pass/fail.
//
// The GDD's balance target (script section): "bullet heaven = your clear
// rate exceeds the spawn rate; that moment must land around 8–10 min."
//
// Metrics produced:
//   - HEAVEN MINUTE: per seed, the first sustained (60s) low-population
//     window (enemies < 15) after the 5:00 warm-up. Report min/median/max.
//   - POPULATION CURVE: median live enemies per game-minute across seeds —
//     the pressure curve. Where it's flat-high = too many; where it hits 0
//     early = too easy.
//   - DEATHS: how many of the 10 seeds die, at what time/level/cause
//     (flushed vs soup). A natural bot should die a FEW times — 0/10 means
//     too easy, 6+/10 means too hard.
//   - LEVEL PACING: median level at each 5:00 checkpoint.
//   - HP PRESSURE: median hp% per 5:00 band (where the pain lives).
//   - BOSS CLEAR RATE: how often the bot kills each scheduled boss.
//
// Deterministic per seed (same as M3): the report is stable across reruns,
// so a tuning change moves the numbers predictably.
import puppeteer from 'puppeteer-core';
import { ensureServer, killIfOwned, URL } from './server.mjs';

const EXE = '/usr/bin/chromium';
const SEEDS = [42, 1337, 9001, 7777, 31415, 27182, 1618, 272, 404, 55];
const HORIZON_MS = 360000; // real-time budget per seed (good builds survive 15+ min of game-time)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ============ the natural player bot ============
// think(): identical kiting AI to M3/M4 (weighted enemy avoidance, corner
// flee, strafe, gem grab). This is a DECENT player — it survives long enough
// for the DIRECTOR to show its curve, but it's not invincible.
// pick(): the real level-up path — no head start. Crouton starts Fart Whip
// lvl 1. The bot builds like a player would: heal when low, max the start
// weapon (its evolution line), grab the evo passive, then a ring for
// defense, then diversify. The level-up LOTTERY decides what's actually
// offered — that's the point of a natural soak.
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
      // M12: THE LINT KING — react to CONTACT, not to the fight. Pre-M12 the
      // bot had no lint-king logic and survived the rings by the generic
      // one-shot dodge below; the baseline soak still lost 8/10 to the boss
      // (1655–1719s) because when the king closed in, the dodge + centroid
      // churn left it cornered. So: when the king is INSIDE 110u, radial
      // retreat wins (player 140u/s outruns the king's 24/34 raged) — UNLESS
      // a ring bullet is inside 60u, in which case the perpendicular dodge
      // below handles it. The M12c probe (test/probe-lint.mjs, seed 42)
      // measured the failure this prevents: the death frame had a bullet 7u
      // from center — a pure retreat runs ALONG the radial bullet line. At
      // standoff range, fall through to the shot-dodge (measured: a gate-less
      // strafe block that pre-empted the dodge went 9/10, worse than 8/10).
      if (s.boss && s.boss.kind === 'lintking') {
        const bd = Math.hypot(s.boss.x - s.x, s.boss.z - s.z);
        const nearShot = (cap.enemyBullets(3) || []).some((bb) => bb.d < 60);
        if (bd < 110 && !nearShot) {
          const kx = (s.x - s.boss.x) / (bd || 1), kz = (s.z - s.boss.z) / (bd || 1);
          cap.move(kx, kz); return;
        }
      }
      // M9: dodge incoming spitter gunk like a human (perpendicular to the shot
      // line). The pre-M9 natural bot stood still in the endgame gunk field —
      // the m3 trace showed hp bleeding 100→10 at near60=0 before the Lint King
      // even spawned, so the 27-30 min wall was ranged chip, not the boss.
      // M12g GAP DODGE: with 2+ shots close (a radial ring), the one-shot
      // perpendicular can step onto a SECOND shot's line — the 42b probe
      // measured the death frame: bullets at 25/72/91/98u all around, hp
      // 56→0 in 4s. So when several shots are near, orient the perpendicular
      // AWAY from the shot cluster (toward the ring's gap) instead of an
      // arbitrary side.
      const shots = cap.enemyBullets(6).filter((b) => b.d < 110);
      if (shots.length) {
        const b0 = shots[0];
        const sp = Math.hypot(b0.vx, b0.vz) || 1;
        let px = -b0.vz / sp, pz = b0.vx / sp;
        if (shots.length >= 2) {
          // away from the cluster centroid: the gap is on the far side
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
      // M12d: seek a donut when hurt. The bot caps at lv 40 (~20:00), so
      // after the XP wall the only heal sources are donut items (30% of the
      // 150s item drops) — and pre-M12d it never touched them. The 9001
      // probe measured the cost: HP 36→9 across the Lint King window with
      // donuts on the floor the whole time. A decent player at <45 HP runs
      // for food instead of kiting.
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
    pick() {
      const cap = window.__cap;
      const s = cap.state();
      if (s.mode !== 'levelup') return;
      const o = s.options;
      let pick = -1;
      if (s.hp < 30) pick = o.findIndex((x) => x.id === 'hp');
      // M10i: tight early game + free superfart ramp. The M10h official gate
      // (test/balance.mjs) hit the named deliverables — heaven 8/10 (median
      // 7.4min), boss median 2 — but death rate stayed 10/10, with 6/10 dead
      // at THE CONSTIPATION (900–935s) carrying superfart:1. Two trace
      // patterns, both ladder shape:
      //  (1) ring-8 rung starvation: the ring (now ×4 common) flooded the
      //      fresh pool, so its 3→8 upgrades occupied the 3-option draw and
      //      superfart 1→8 (ranked after the ring) rarely appeared — the
      //      evolved line sat at lvl 1 into the 2000hp wall.
      //  (2) pre-evo kit scatter: the dpsCount<3 slot pulled 2nd/3rd weapons
      //      (bouncy/stinkaura) BEFORE the evo line finished — 1618 at 900s:
      //      whip 8 + bouncy 8 + quick 2, no evo. A new weapon before the
      //      evo is pure pick-tax on the build's backbone.
      // M10i: the ring is acquired + 3 pre-evo (the boss-window defense),
      // kit is locked until the evo fires, and post-evo the superfart ramp
      // outranks the ring (ring continues to 8 only AFTER superfart 8).
      // Ladder: ring(acquire)→ring 3→whip 8→quick(evo)→[evo fired] superfart 8
      //   → ring 8 → quick 5 → scale owned → kit → owned passives → fill.
      if (pick < 0 && !s.weapons.crackerring) pick = o.findIndex((x) => x.id === 'crackerring'); // acquire ring (forced common guarantees it)
      if (pick < 0 && !s.evolved && s.weapons.crackerring && s.weapons.crackerring < 3) pick = o.findIndex((x) => x.id === 'crackerring'); // ring to 3 pre-evo: boss-window defense
      // base evo line ONLY while the evo hasn't fired: once superfart exists,
      // the base whip is a RE-ADD (fresh option) — the M10g gate measured the
      // re-add bug directly: seeds 42/27182 at 1500s ran superfart:1 +
      // fartwhip:8, i.e. the ladder sprinted the consumed base line while the
      // evolved line stalled at lvl 1. Same guard the m3 bot ships.
      if (pick < 0 && !s.weapons.superfart) pick = o.findIndex((x) => x.id === 'fartwhip');       // whip 1→8: the evo line
      if (pick < 0 && !(s.passives.quick)) pick = o.findIndex((x) => x.id === 'quick');          // the evo gate (×2 common now)
      if (pick < 0) pick = o.findIndex((x) => x.id === 'superfart' && x.lvl < 8);                // post-evo: the evolved line outranks everything (ring deferred past it)
      if (pick < 0 && s.weapons.crackerring && s.weapons.crackerring < 8) pick = o.findIndex((x) => x.id === 'crackerring'); // ring 3→8 post-evo: the AoE wall
      if (pick < 0 && s.evolved && s.passives.quick && s.passives.quick < 5) pick = o.findIndex((x) => x.id === 'quick'); // quick 5 = global cd cut (post-evo only: the gate quick must survive to be consumed)
      // SUSTAIN PILLAR (M10k): the M10j2 gate (heaven 10/10, boss median 4,
      // death 10/10) measured every death at the endgame boss wall — 6/10 at
      // MR. SPHINCTER (1500s, 2600hp/18dmg), 2 at the 20-min population spike,
      // HP pressure 100% through 25 min. The bot's DPS out-cleared the spawn
      // curve (10/10 heaven) but its 100 max HP couldn't out-tank the 25-min
      // boss gauntlet. A decent player grabs sustain for the endgame: Big
      // Breakfast (+25 max HP x3 = +75). Stacked post-evo, it's a survivability
      // pillar, not a DPS tax — the evo/ring/cd are already locked by then.
      if (pick < 0 && s.evolved && (s.passives.breakfast || 0) < 3) pick = o.findIndex((x) => x.id === 'breakfast'); // breakfast x3 = +75 max HP for the boss gauntlet
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && s.weapons[x.id] && x.lvl < 8 && (x.id !== 'fartwhip' || !s.weapons.superfart)); // scale other owned lines (never the re-added base whip)
      const dpsCount = Object.keys(s.weapons).filter((k) => k !== 'crackerring').length;
      // M12e KIT: when opening the 2nd/3rd DPS line, PREFER anti-mob AoE.
      // The win/loss probes (test/probe-lint.mjs, M12e) isolated the cause
      // of the 8/10 death rate: winner 1337 ran ring 8 + superfart 8 +
      // STINKAURA 8 (passive aura clears the endgame swarm, survives at
      // 130 enemies) while loser 9001 ran the identical build with PLOP
      // CANNON 8 (aimed single-target) and died to the Lint King's
      // 50-130-enemy field at full boss HP — same passives, same maxHp.
      // A decent player opening a kit slot against a swarm grabs AoE, not
      // the aimed line the lottery offers first. Preference list = the AoE
      // archetypes (aura > bomb > zone > mine > chain); falls through to
      // any fresh weapon if none is on offer (no pick tax).
      if (pick < 0 && s.evolved && dpsCount < 3) {
        const AOE_PREF = ['stinkaura', 'fartbomb', 'puddle', 'mine', 'chainfart'];
        for (const pref of AOE_PREF) {
          const i = o.findIndex((x) => x.kind === 'weapon' && x.id === pref && !s.weapons[pref]);
          if (i >= 0) { pick = i; break; }
        }
        if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      }
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive' && s.passives[x.id]);                 // owned passives (meats etc.)
      if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring' && x.lvl < 8);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive');
      if (pick < 0) pick = 0;
      cap.pick(pick);
    },
  };
  // batched driver: sample every 300 frames (5 game-seconds), run until an
  // ending mode or the frame budget (a full 30:00 = 108000 frames).
  window.__balanceDrive = (nFrames) => {
    const c = window.__cap;
    if (!window.__bsamp) window.__bsamp = [];
    for (let i = 0; i < nFrames; i++) {
      const s = c.state();
      if (s.mode === 'dead' || s.mode === 'win') {
        window.__bsamp.push({ t: Math.round(s.time), k: s.kills, e: s.enemies, l: s.level, hp: s.hp, mb: s.maxHp, b: s.boss ? 1 : 0, bk: s.bossKilled });
        return s;
      }
      if (s.mode === 'levelup') window.__bot.pick();
      window.__bot.think();
      c.step();
      if (i % 300 === 0) {
        const s2 = c.state();
        window.__bsamp.push({ t: Math.round(s2.time), k: s2.kills, e: s2.enemies, l: s2.level, hp: s2.hp, mb: s2.maxHp, b: s2.boss ? 1 : 0, bk: s2.bossKilled });
      }
    }
    return c.state();
  };
});
await page.evaluate(() => window.__cap.freeze());

// ============ run the 10 seeds ============
const runs = [];
for (const seed of SEEDS) {
  await page.evaluate(() => { window.__bsamp = []; });
  await page.evaluate((sd) => { window.__cap.restart(sd); }, seed);
  const t0 = Date.now();
  let finalState = null;
  while (Date.now() - t0 < HORIZON_MS) {
    const s = await page.evaluate(() => window.__balanceDrive(6000));
    if (s.mode === 'dead' || s.mode === 'win') { finalState = s; break; }
  }
  if (!finalState) finalState = await page.evaluate(() => window.__cap.state());
  const samples = await page.evaluate(() => window.__bsamp);
  runs.push({
    seed, mode: finalState.mode, time: +finalState.time.toFixed(0),
    level: finalState.level, kills: finalState.kills,
    flushed: !!finalState.flushed, levelUps: finalState.level, samples,
  });
  console.log(`  seed ${seed}: ${finalState.mode} @ ${finalState.time.toFixed(0)}s | lv ${finalState.level} | kills ${finalState.kills}${finalState.flushed ? ' | FLUSHED' : ''} | ${samples.length} samples`);
}

// ============ aggregate ============
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// heaven minute (the GDD's actual definition): "bullet heaven = your clear
// rate exceeds the spawn rate." Measured as the first t>=300 where the
// rolling 30s kill-rate exceeds the analytic spawn rate (director formula:
// interval = max(0.25, 1.1 - t/300)) SUSTAINED over 2 consecutive 30s
// windows (60s) — one lucky kill-spike shouldn't count. The population
// <15 heuristic is kept below as a secondary context metric, not the gate.
const spawnRate = (t) => 1 / Math.max(0.25, 1.1 - t / 300);
function heavenOf(samples) {
  const wins = [];
  for (let i = 0; i + 5 < samples.length; i += 6) { // 6 samples * 5s = 30s
    const a = samples[i], b = samples[i + 5];
    if (b.t - a.t < 25) break;
    const clears30 = ((b.k - a.k) / (b.t - a.t)) * 30;
    wins.push({ t: b.t, cross: clears30 > spawnRate(b.t) * 30 });
  }
  let streak = 0, first = -1;
  for (const w of wins) {
    if (w.t < 300) { streak = 0; continue; }
    if (w.cross) { streak++; if (streak >= 2 && first < 0) first = w.t; }
    else streak = 0;
  }
  return first;
}
// secondary context: first sustained low-population window (enemies <15)
function lowPopOf(samples) {
  let streak = 0, first = -1;
  for (const s of samples) {
    if (s.t < 300) { streak = 0; continue; }
    if (s.e < 15) { streak++; if (streak >= 3 && first < 0) first = s.t; }
    else streak = 0;
  }
  return first;
}
const heavens = runs.map((r) => heavenOf(r.samples)).filter((t) => t > 0);
const lowPops = runs.map((r) => lowPopOf(r.samples)).filter((t) => t > 0);

// population curve: median enemies per game-minute (0..29)
const pop = {};
for (let m = 0; m < 30; m++) {
  const vals = runs.map((r) => {
    const s = r.samples.find((x) => Math.floor(x.t / 60) === m);
    return s ? s.e : null;
  }).filter((v) => v !== null);
  pop[m] = med(vals);
}
// level at 5:00 checkpoints
const lvlAt = {};
for (const m of [5, 10, 15, 20, 25, 29]) {
  const vals = runs.map((r) => {
    const s = r.samples.find((x) => Math.floor(x.t / 60) === m);
    return s ? s.l : null;
  }).filter((v) => v !== null);
  lvlAt[m] = med(vals);
}
// hp% per 5:00 band
const hpBand = {};
for (let band = 0; band < 6; band++) {
  const vals = [];
  for (const r of runs) {
    for (const s of r.samples) {
      if (Math.floor(s.t / 300) === band && s.mb) vals.push(s.hp / s.mb * 100);
    }
  }
  hpBand[band] = vals.length ? med(vals) : 0;
}
// boss clear rate: per seed, count of bossKilled at end (0..6)
const bossClears = runs.map((r) => {
  const last = r.samples[r.samples.length - 1];
  return last ? last.bk : 0;
});

// ============ the report ============
console.log('\n================ M7 BALANCE REPORT ================');
console.log(`seeds: ${SEEDS.length} (crouton, natural build, no head start)`);
const deaths = runs.filter((r) => r.mode === 'dead');
const wins = runs.filter((r) => r.mode === 'win');
const flushed = runs.filter((r) => r.flushed);
console.log(`\n-- DEATH RATE --`);
console.log(`  wins (full 30:00): ${wins.length}/10`);
console.log(`  deaths: ${deaths.length}/10 (of which flushed ${flushed.length})`);
for (const d of deaths) console.log(`    seed ${d.seed}: died @ ${d.time}s (lv ${d.level}, kills ${d.kills})${d.flushed ? ' — FLUSHED' : ' — soup'}`);
console.log(`\n-- BULLET HEAVEN (GDD: clear rate > spawn rate; target 8–10 min = 480–600s) --`);
if (heavens.length) {
  const hs2 = heavens.sort((a, b) => a - b);
  console.log(`  reached by ${heavens.length}/10 seeds`);
  console.log(`  first: ${Math.min(...hs2)}s | median: ${med(hs2)}s | last: ${Math.max(...hs2)}s`);
  console.log(`  (median in minutes: ${(med(hs2) / 60).toFixed(1)} min — target 8–10)`);
} else {
  console.log(`  NOT reached by any seed (clear rate never sustained above spawn rate after 5:00)`);
}
if (lowPops.length) {
  const lp = lowPops.sort((a, b) => a - b);
  console.log(`  (context: low-population <15 window — reached by ${lowPops.length}/10, median ${med(lp)}s)`);
}
console.log(`\n-- POPULATION CURVE (median live enemies / minute) --`);
let row = '';
for (let m = 0; m < 30; m += 5) {
  for (let i = 0; i < 5; i++) {
    const v = pop[m + i];
    row += ` ${String(v).padStart(3)}`;
  }
  console.log(`  ${String(m).padStart(2)}:00 |${row.slice(-17)}`);
}
console.log(`  (min of the whole curve: ${Math.min(...Object.values(pop))} @ minute ${Object.entries(pop).sort((a, b) => a[1] - b[1])[0][0]})`);
console.log(`\n-- LEVEL PACING (median level) --`);
for (const m of [5, 10, 15, 20, 25, 29]) console.log(`  ${String(m).padStart(2)}:00 → lv ${lvlAt[m]}`);
console.log(`\n-- HP PRESSURE (median hp% per 5:00 band) --`);
for (let band = 0; band < 6; band++) console.log(`  ${band * 5}:00–${band * 5 + 5}:00 → ${hpBand[band].toFixed(0)}%`);
console.log(`\n-- BOSS CLEAR RATE (bossKilled at run end, 0–6) --`);
const bcMed = med(bossClears);
console.log(`  median bosses killed: ${bcMed} | distribution: ${bossClears.sort((a, b) => a - b).join(', ')}`);
console.log(`\n-- CONSOLE --`);
console.log(errs.length === 0 ? '  clean across all 10 runs' : `  ${errs.length} errors: ${errs.slice(0, 2).join(' | ')}`);
console.log(`==================================================`);

// ============ the gate (a RATE, per GDD — soft bounds, not pass/fail) ============
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const hs = heavens.slice().sort((a, b) => a - b);
const hmed = hs.length ? med(hs) : 0;
ok(deaths.length >= 1 && deaths.length <= 5, `death rate in the 1–5/10 band (got ${deaths.length}/10) — 0 = too easy, 6+ = too hard`);
ok(heavens.length >= 5, `bullet heaven reached by a MAJORITY of seeds (${heavens.length}/10)`);
if (heavens.length) ok(hmed >= 420 && hmed <= 720, `heaven median in the 7–12 min band (target 8–10; got ${(hmed / 60).toFixed(1)} min)`);
ok(med(bossClears) >= 2, `a median run clears at least 2 scheduled bosses (got ${bcMed})`);
ok(errs.length === 0, 'console clean across all 10 runs');

console.log(`\nM7 BALANCE: ${pass} pass / ${fail} fail`);
await b.close();
process.exit(fail ? 1 : 0);
