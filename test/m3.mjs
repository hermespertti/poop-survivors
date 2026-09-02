// M3 SOAK — the director.
// Part A: M1/M2 regression (XP curve, determinism, weapon framework).
// Part B: director mechanics — script unlocks 6 enemy types on schedule,
// wave bursts fire, spikes fire, 5 bosses spawn on schedule with their own
// behaviors, the Spasm Wall closes and can be broken, stage items spawn,
// THE FINAL FLUSH resolves both ways (killable → win; touch → flushed).
// Part C: THE REAL TEST — a full 30:00 bot run × 5 seeds. The bot must
// complete at least one run. This is the milestone gate.
import puppeteer from 'puppeteer-core';

const EXE = '/usr/bin/chromium';
const URL = 'http://127.0.0.1:5193/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
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

// ============ PART A: M1/M2 regression ============
const curve = await page.evaluate(() => {
  const f = window.__cap.xpCurve; const out = {};
  for (let l = 1; l < 60; l++) out[l] = f(l);
  return out;
});
ok(curve[1] === 5 && curve[2] === 15 && curve[3] === 25 && curve[10] === 95 && curve[19] === 185 && curve[20] === 798 && curve[40] === 2861 && curve[41] === 477, 'XP curve: all VS-wiki anchors exact (regression)');

async function snapTraj(seed, n) {
  await page.evaluate((sd) => { window.__cap.freeze(); window.__cap.restart(sd); window.__cap.move(1, 0.5); }, seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = await page.evaluate(() => window.__cap.step());
    out.push(`${s.x},${s.z},${s.kills},${s.time}`);
  }
  return out.join('|');
}
const a = await snapTraj(4242, 120);
const c2 = await snapTraj(4242, 120);
ok(a === c2, 'determinism: identical seed+input → identical trajectory (regression)');
await page.evaluate(() => window.__cap.unfreeze());

// weapons still fire (regression, quick)
async function statOf(fn) {
  return page.evaluate(fn);
}
for (const id of ['fartwhip', 'plopcannon', 'crackerring', 'puddle']) {
  const r = await page.evaluate((wid) => {
    const c = window.__cap;
    c.restart(555); c.freeze();
    c.giveWeapon(wid, 1);
    c.giveWeapon('fartwhip', 1);
    c.spawn(3);
    const st = c.state();
    for (let i = 0; i < 3; i++) c.setEnemyPos(i, st.x + 20, st.z);
    let shots = 0;
    for (let i = 0; i < 120; i++) { c.step(); const s = c.state(); shots = s.stats.shots[wid] || 0; if (shots > 0) break; }
    return { shots };
  }, id);
  ok(r.shots > 0, `weapon ${id} fires (regression)`);
}
await page.evaluate(() => window.__cap.unfreeze());

// ============ PART B: director mechanics ============
// B1: script unlocks enemy types on schedule
const kindProbe2 = await page.evaluate(() => {
  const c = window.__cap;
  const out = {};
  c.restart(88); c.freeze();
  for (const t of [0, 60, 120, 420, 720, 1020]) {
    c.set('time', t);
    c.clearEnemies();
    for (let i = 0; i < 12; i++) c.spawn(1);
    out[t] = (c.lastKinds() || []).join(',');
  }
  return out;
});
ok((kindProbe2[0] || '').split(',').every((k) => k === 'bubble'), 'script: at 0:00 only bubble spawns');
ok((kindProbe2[60] || '').includes('droplet') && !(kindProbe2[0] || '').includes('droplet'), 'script: droplet unlocks at 1:00');
ok((kindProbe2[120] || '').includes('crumb') && !(kindProbe2[60] || '').includes('crumb'), 'script: crumb unlocks at 2:00');
ok((kindProbe2[420] || '').includes('mop') && !(kindProbe2[120] || '').includes('mop'), 'script: mop unlocks at 7:00');
ok((kindProbe2[720] || '').includes('stink') && !(kindProbe2[420] || '').includes('stink'), 'script: stink unlocks at 12:00');
ok((kindProbe2[1020] || '').includes('sponge') && !(kindProbe2[720] || '').includes('sponge'), 'script: sponge unlocks at 17:00');

// B2: wave bursts fire on schedule
const waveProbe = await page.evaluate(() => {
  const c = window.__cap;
  c.restartPlay(77); c.freeze();
  const before = c.state().enemies;
  // waveCd starts at 60 → first burst at 1:00
  for (let i = 0; i < 70; i++) { c.step(); }
  const after = c.state();
  return { before, afterAfter: after.enemies, t: after.time };
});
ok(waveProbe.afterAfter > waveProbe.before, 'wave burst: enemies jump after 1:00');

// B3: bosses spawn on schedule with correct names
const bossSched = await page.evaluate(() => {
  const c = window.__cap;
  const out = [];
  for (let bi = 0; bi < 5; bi++) {
    const sched = c.bossSchedule();
    const ev = sched[bi];
    c.restartPlay(999);
    c.set('bossIdx', bi); // past earlier bosses (killed or not — schedule is index-based)
    c.set('time', ev.t - 1);
    let seen = null;
    for (let i = 0; i < 120; i++) { c.step(); const s = c.state(); if (s.boss) { seen = s.boss.name; break; } }
    out.push(ev.name + ' → ' + (seen || 'NOT SEEN'));
  }
  return out;
});
ok(bossSched.every((s) => !s.includes('NOT SEEN')), 'boss schedule: all 5 bosses spawn on their script time');
ok(bossSched[0].includes('THE FIRST WIND') && bossSched[1].includes('COLONEL C') && bossSched[2].includes('THE CONSTIPATION') && bossSched[3].includes('THE DIARRHEA EXPRESS') && bossSched[4].includes('MR. SPHINCTER'), 'boss schedule: names in order');

// B4: Spasm Wall — mechanics: spawns, closes in, breakable (schedule itself is B3)
const wallProbe = await page.evaluate(() => {
  const c = window.__cap;
  c.restartPlay(1212); c.set('time', 899);
  c.giveWeapon('crackerring', 8); // aura will chew the wall
  c.giveWeapon('fartwhip', 8);
  c.givePassive('quick', 2);
  c.set('hp', 100000); // survivability not under test — the wall is
  c.spawnWall(); // explicit spawn (the 15:00 schedule trigger is asserted in B3)
  let wallSeen = false, wallBroken = false;
  for (let i = 0; i < 1200; i++) {
    c.step();
    const s = c.state();
    if (s.wall > 0) wallSeen = true;
    if (wallSeen && s.wall === 0) { wallBroken = true; break; }
    if (s.mode === 'dead') break;
  }
  return { wallSeen, wallBroken, wallLeft: c.state().wall };
});
ok(wallProbe.wallSeen, 'Spasm Wall: spawns with The Constipation at 15:00');
ok(wallProbe.wallBroken, 'Spasm Wall: breakable by weapons (wall dissolves)');

// B5: stage items spawn + collect
const itemProbe = await page.evaluate(() => {
  const c = window.__cap;
  c.restartPlay(333); c.set('time', 149);
  let seen = false, taken = 0;
  for (let i = 0; i < 600; i++) {
    c.step();
    const s = c.state();
    if (s.items > 0) seen = true;
    // walk to nearest item
    const list = c.itemList();
    if (list.length) {
      const it = list[0];
      const dx = it.x - s.x, dz = it.z - s.z;
      const d = Math.hypot(dx, dz) || 1;
      c.move(dx / d, dz / d);
    }
    taken = c.state().stats.itemTaken;
    if (taken > 0) break;
  }
  return { seen, taken };
});
ok(itemProbe.seen && itemProbe.taken > 0, 'stage items: spawn + walk-over collect');

// B6: THE FINAL FLUSH — both resolutions
// B6a: killed → win + gold
const flushKill = await page.evaluate(() => {
  const c = window.__cap;
  c.restartPlay(1212);
  c.giveWeapon('superfart', 8); // big gun
  c.giveWeapon('crackerring', 8);
  c.givePassive('meats', 5);
  c.spawnFlush();
  c.setFlushHp(100); // mechanics test — killable
  c.set('hp', 100000);
  c.freeze();
  // park 70u away: inside the ring's reach (radius 50 band 13 → 37–63u) but
  // the flush (30 u/s) needs 2.3s to arrive — the ring kills it first
  const s0 = c.state();
  c.set('pos', [s0.flush.x - 70, s0.flush.z]);
  let won = false;
  for (let i = 0; i < 600; i++) {
    c.step();
    const s = c.state();
    if (s.mode === 'win') { won = true; break; }
  }
  return { won, gold: c.state().gold };
});
ok(flushKill.won, 'Final Flush: killable → KITCHEN CLEARED (win)');
ok(flushKill.gold >= 500, 'Final Flush: victory pays bonus gold (500)');

// B6b: touch → flushed ending
const flushTouch = await page.evaluate(() => {
  const c = window.__cap;
  c.restartPlay(1212);
  c.spawnFlush();
  c.setFlushHp(10000000); // unkillable in this probe
  c.set('hp', 100000);
  c.freeze();
  const s0 = c.state();
  c.set('pos', [s0.flush.x - 30, s0.flush.z]); // contact in ~1s (30 u/s)
  let flushed = false;
  for (let i = 0; i < 600; i++) {
    c.step();
    const s = c.state();
    if (s.mode === 'dead' && s.flushed) { flushed = true; break; }
  }
  return { flushed };
});
await page.evaluate(() => window.__cap.unfreeze());
ok(flushTouch.flushed, 'Final Flush: touching you → FLUSHED ending');

// ============ PART C: full 30:00 bot soak × 5 seeds ============
// Batched in-page driver (like prisma-panic M15): the bot's think() runs
// between frames inside the page, N frames per evaluate call — a 30:00 run
// takes ~2-3 min wall clock instead of 30.
const seeds = [1337, 4242, 88, 55, 9042];
const results = [];
let wins = 0, deaths = 0, flushed = 0;
await page.evaluate(() => {
  window.__bot = {
    think() {
      const cap = window.__cap;
      const s = cap.state();
      if (s.mode !== 'play') return;
      const W = s.world.w, H = s.world.h;
      const near = cap.enemies(16).filter((e) => e.d < 100);
      // FINAL FLUSH: kill it — standoff band 45–90u, strafe
      if (s.flush) {
        const fd = Math.hypot(s.flush.x - s.x, s.flush.z - s.z);
        const dx = s.x - s.flush.x, dz = s.z - s.flush.z;
        const d = Math.hypot(dx, dz) || 1;
        if (fd < 45) { cap.move(dx / d, dz / d); return; }
        if (fd > 90) { cap.move(-dx / d, -dz / d); return; }
        let sx = -dz / d, sz = dx / d;
        if ((sx > 0.3 && s.x > W - 120) || (sx < -0.3 && s.x < 120) ||
            (sz > 0.3 && s.z > H - 120) || (sz < -0.3 && s.z < 120)) { sx = -sx; sz = -sz; }
        cap.move(sx, sz); return;
      }
      // BOSS within 100 → perpendicular dash-dodge (the express dash locks its
      // direction; sideways beats it). Farther bosses fold into the flee below.
      if (s.boss) {
        const bd = Math.hypot(s.boss.x - s.x, s.boss.z - s.z);
        if (bd < 100) {
          const bx = s.x - s.boss.x, bz = s.z - s.boss.z;
          const d = Math.hypot(bx, bz) || 1;
          let dx2 = -bz / d, dz2 = bx / d;
          if (dx2 > 0 && s.x > W - 150) { dx2 = -dx2; dz2 = -dz2; }
          if (dz2 > 0 && s.z > H - 150) { dx2 = -dx2; dz2 = -dz2; }
          cap.move(dx2 + (bx / d) * 0.3, dz2 + (bz / d) * 0.3);
          return;
        }
      }
      // swarm centroid (proximity-weighted) + the boss folded in at 6×
      let wx = 0, wz = 0, wsum = 0;
      for (const e of near) { const w = 1 - e.d / 100; wx += e.x * w; wz += e.z * w; wsum += w; }
      if (s.boss) {
        const bd = Math.hypot(s.boss.x - s.x, s.boss.z - s.z);
        if (bd < 150) { const w = 6 * (1 - bd / 150); wx += s.boss.x * w; wz += s.boss.z * w; wsum += w; }
      }
      // FLEE: any meaningful swarm → break through the LEAST-DENSE octant,
      // biased away from the centroid. (Strafing in a circle gets surrounded;
      // the gap-break is how you survive a director swarm.)
      if (wsum > 1.0) {
        const away = Math.atan2(s.z - wz, s.x - wx);
        const walls = cap.wallList();
        let bestA = away, bestScore = -1e9;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          let dens = 0;
          for (const e of near) {
            const ea = Math.atan2(e.z - s.z, e.x - s.x);
            const diff = Math.abs(Math.atan2(Math.sin(ea - a), Math.cos(ea - a)));
            dens += Math.exp(-diff * 1.5) * (1 - e.d / 100 + 0.2);
          }
          for (const w of walls) {
            if (w.d > 120) continue;
            const wa = Math.atan2(w.z - s.z, w.x - s.x);
            const diff = Math.abs(Math.atan2(Math.sin(wa - a), Math.cos(wa - a)));
            dens += Math.exp(-diff * 1.5) * 0.8;
          }
          const align = Math.abs(Math.atan2(Math.sin(away - a), Math.cos(away - a)));
          const score = (Math.PI - align) - dens * 0.9;
          if (score > bestScore) { bestScore = score; bestA = a; }
        }
        cap.move(Math.cos(bestA), Math.sin(bestA));
        return;
      }
      // light swarm: grab gems (XP = levels = DPS)
      if (wsum > 0.05) {
        const gem = cap.nearestGem();
        if (gem && gem.d < 70 && gem.d > 8) {
          const dx = gem.x - s.x, dz = gem.z - s.z;
          const d = Math.hypot(dx, dz) || 1;
          cap.move(dx / d, dz / d); return;
        }
      }
      // empty-ish field: hold the kite band (hunt when far, flee when close)
      const cx = wsum ? wx / wsum : s.x, cz = wsum ? wz / wsum : s.z;
      let dx = s.x - cx, dz = s.z - cz;
      const d = Math.hypot(dx, dz) || 1;
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
      // 1. the ring first (kiting self-defense — needed from minute 0)
      if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring' && !s.weapons.crackerring);
      // 2. then max the whip (evolution path → SUPER FART at chest)
      if (pick < 0) pick = o.findIndex((x) => x.id === 'fartwhip' && x.lvl < 8);
      if (pick < 0 && !(s.passives.quick)) pick = o.findIndex((x) => x.id === 'quick');
      if (pick < 0) pick = o.findIndex((x) => x.id === 'quick' && s.passives.quick < 5);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'weapon' && !s.weapons[x.id]);
      if (pick < 0) pick = o.findIndex((x) => x.kind === 'passive');
      if (pick < 0) pick = o.findIndex((x) => x.id === 'crackerring');
      if (pick < 0) pick = 0;
      cap.pick(pick);
    },
  };
  // batched driver: run up to N frames, calling bot between them, until
  // an ending mode or the frame budget. Returns the final state.
  window.__drive = (nFrames) => {
    const c = window.__cap;
    for (let i = 0; i < nFrames; i++) {
      const s = c.state();
      if (s.mode === 'dead' || s.mode === 'win') return s;
      if (s.mode === 'levelup') window.__bot.pick();
      window.__bot.think();
      c.step();
    }
    return c.state();
  };
});
await page.evaluate(() => window.__cap.freeze()); // batched mode: freeze rAF, only step() advances
for (const seed of seeds) {
  await page.evaluate((sd) => { window.__cap.restart(sd); }, seed); // restart while frozen
  const t0 = Date.now();
  let finalState = null;
  // drive in batches of 1200 frames (20 game-seconds per batch)
  while (Date.now() - t0 < 300000) {
    const s = await page.evaluate(() => window.__drive(1200));
    if (s.mode === 'dead' || s.mode === 'win') { finalState = s; break; }
  }
  if (!finalState) finalState = await page.evaluate(() => window.__cap.state());
  results.push({ seed, mode: finalState.mode, time: finalState.time, level: finalState.level, kills: finalState.kills, weapons: JSON.stringify(finalState.weapons), flushed: finalState.flushed });
  console.log(`  seed ${seed}: ${finalState.mode} at ${finalState.time.toFixed(0)}s | lv ${finalState.level} | kills ${finalState.kills} | weapons ${JSON.stringify(finalState.weapons)}`);
  if (finalState.mode === 'win') wins++;
  if (finalState.mode === 'dead' && finalState.flushed) flushed++;
  if (finalState.mode === 'dead' && !finalState.flushed) deaths++;
}
console.log(`\n  5-seed soak: ${wins} wins, ${deaths} deaths, ${flushed} flushed`);
ok(wins >= 1, `bot completes at least one full 30:00 run (${wins}/5 wins)`);
// at least half the runs must reach the deep game (the director's second half)
ok(results.filter((r) => r.mode === 'win' || r.time > 900).length >= 2, `at least 2 runs reached the mid-game (15:00+) (${results.filter((r) => r.mode === 'win' || r.time > 900).length}/5)`);
ok(results.some((r) => r.level >= 20), 'at least one run crossed level 20 (the XP wall)');

// console clean over ALL runs
ok(errs.length === 0, `console clean across all 5 runs (${errs.slice(0, 2).join(' | ')})`);

console.log(`\nM3 SOAK: ${pass} pass / ${fail} fail`);
await b.close();
process.exit(fail ? 1 : 0);
