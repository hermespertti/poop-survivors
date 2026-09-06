// M15 SOAK — the WebGL2 FX pass (GDD Q2, locked 2026-08-31).
// What must be true:
//   1. The FX overlay exists and is registered exactly on the game canvas.
//   2. The event contract: real game paths (kill / gem / levelup / boss kill /
//      evolution / flush kill) each emit exactly one FX event of their type,
//      even without a GPU (the queue is the contract; rendering is cosmetic
//      on top). Per-type counts keep the assertion clean: the boss sheds
//      minions that the test ring also kills, and those stray fxKill events
//      must not pollute the boss/evolve/flush assertions.
//   3. Determinism: with the FX layer ACTIVE (emitting every step), the game
//      sim is byte-identical across two identical frozen runs — the Q2 rule
//      that the FX layer never touches the CPU sim.
//   4. GL health: if WebGL2 is available, the pipeline compiles+links and a
//      live rendered soak leaves zero GL errors.
//
// Bot strategy: grant crackerring (orbit AoE at r=34+2*lvl around the
// player, hits enemies/wall/boss/flush in its band — facing-independent,
// unlike the whip's directional beam) and keep the player parked in the
// band around each target. Probes (set pos / setEnemyPos / nearestGem /
// setFlushHp / set bossHp) do the placement. Every trigger still runs the
// REAL game code (damage -> death -> fxKill, pickup -> fxGem, chest ->
// resolveChest -> fxEvolve, ...).
import puppeteer from 'puppeteer-core';

const EXE = '/usr/bin/chromium';
const URL = 'http://127.0.0.1:5193/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({
  executablePath: EXE, headless: 'new', protocolTimeout: 600000,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=vulkan'],
});
const page = await b.newPage();
await page.setViewport({ width: 960, height: 720 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(2200);

// ---------- 1. the FX overlay is present and registered on the game canvas ----------
const layout = await page.evaluate(() => {
  const g = document.getElementById('c').getBoundingClientRect();
  const f = document.getElementById('fx');
  if (!f) return { hasCanvas: false };
  const fr = f.getBoundingClientRect();
  return {
    hasCanvas: true,
    registered: Math.abs(fr.x - g.x) < 2 && Math.abs(fr.y - g.y) < 2 && Math.abs(fr.width - g.width) < 3 && Math.abs(fr.height - g.height) < 3,
    transparent: getComputedStyle(f).pointerEvents === 'none',
  };
});
ok(layout.hasCanvas, 'fx overlay canvas exists in the DOM');
ok(layout.registered, 'fx overlay is registered 1:1 on the game canvas (no parallax drift)');
ok(layout.transparent, 'fx overlay is pointer-transparent (never eats a tap)');

// ---------- 2. the event contract: each real game path emits exactly one typed event ----------
async function fx() { return await page.evaluate(() => window.__cap.state().fx); }
async function st() { return await page.evaluate(() => window.__cap.state()); }
async function fresh(seed) {
  await page.evaluate((sd) => {
    const c = window.__cap;
    c.restartPlay(sd);
    c.giveWeaponNow('crackerring', 1);
    c.set('hp', 999);
  }, seed);
}

// KILL: spawn a bubble inside the ring band; the ring's sweep finishes it
await fresh(9915);
const e0 = await fx();
await page.evaluate(() => {
  const c = window.__cap;
  c.clearEnemies();
  c.spawn(1, 'bubble');
  c.setEnemyPos(0, c.state().x + 36, c.state().z); // ring band at r=36 (lvl 1)
});
let killDone = false;
for (let i = 0; i < 240 && !killDone; i++) {
  // re-park the bubble in the ring band: it drifts, the ring must stay the killer
  const s0 = await st();
  if (s0.enemies > 0) {
    const e0pos = await page.evaluate(() => window.__cap.enemies(1));
    if (e0pos[0]) await page.evaluate(([ex, ez]) => { window.__cap.setEnemyPos(0, ex, ez); window.__cap.step(); },
      [s0.x + 36, s0.z]);
    else await page.evaluate(() => window.__cap.step());
  } else {
    await page.evaluate(() => window.__cap.step());
  }
  killDone = (await st()).kills >= 1;
}
const e1 = await fx();
ok(killDone, 'a kill actually happened (ring sweep -> death, real damage path)');
ok(e1.counts.kill === (e0.counts.kill || 0) + 1, `kill emits exactly one fxKill (kill ${e0.counts.kill || 0}->${e1.counts.kill})`);

// GEM: the kill dropped one near the ring; walk straight to it
let gemTaken = false;
for (let i = 0; i < 200 && !gemTaken; i++) {
  const ng = await page.evaluate(() => window.__cap.nearestGem());
  if (ng) await page.evaluate(([x, z]) => { window.__cap.set('pos', [x, z]); window.__cap.step(); }, [ng.x, ng.z]);
  else await page.evaluate(() => window.__cap.step());
  gemTaken = (await st()).stats.gems >= 1;
}
const e2 = await fx();
ok(gemTaken, "the kill's gem was picked up (real pickup path)");
ok(e2.counts.gem === (e1.counts.gem || 0) + 1, `gem pickup emits exactly one fxGem (gem ${e1.counts.gem || 0}->${e2.counts.gem})`);

// LEVELUP: fill the bar over the wall in one call
const sLvl = await st();
await page.evaluate((need) => { window.__cap.gainXp(need + 1); }, sLvl.xpNeed);
const mAfter = (await st()).mode;
const e3 = await fx();
ok(mAfter === 'levelup' && e3.counts.levelup === (e2.counts.levelup || 0) + 1, 'level-up emits exactly one fxLevelUp (ring + sparkle burst)');
await page.evaluate(() => { const s = window.__cap.state(); if (s.mode === 'levelup' && s.options.length) window.__cap.pick(0); });

// BOSS KILL: park in the ring band around the 1hp boss; the sweep finishes it
await page.evaluate(() => {
  const c = window.__cap;
  c.spawnBoss('wind');
  c.set('bossHp', 1);
  c.set('hp', 999);
});
const bossDone = await (async () => {
  for (let i = 0; i < 240; i++) {
    const s = await st();
    if (s.bossKilled >= 1) return true;
    if (!s.boss) return false;
    const bx = s.boss.x, bz = s.boss.z;
    await page.evaluate(([tx, tz]) => { window.__cap.set('pos', [tx, tz]); window.__cap.step(); },
      [bx + 36, bz]); // re-park: the boss drifts, the band must follow
  }
  return (await st()).bossKilled >= 1;
})();
const e4 = await fx();
ok(bossDone, 'the boss actually died (ring sweep on 1hp, real hitBoss path)');
ok(e4.counts.bosskill === (e3.counts.bosskill || 0) + 1, `boss death emits exactly one fxBossKill shockwave (bosskill ${e3.counts.bosskill || 0}->${e4.counts.bosskill})`);

// EVOLUTION: arm fartwhip 8 + quick, kill the next boss, walk into the chest
await page.evaluate(() => {
  const c = window.__cap;
  c.giveWeaponNow('fartwhip', 8);
  c.givePassiveNow('quick', 1);
  c.spawnBoss('wind');
  c.set('bossHp', 1);
  c.set('hp', 999);
});
let chestAt = null;
for (let i = 0; i < 240 && !chestAt; i++) {
  const s = await st();
  if (s.chest) { chestAt = s.chest; break; }
  if (!s.boss) continue;
  await page.evaluate(([tx, tz]) => { window.__cap.set('pos', [tx, tz]); window.__cap.step(); }, [s.boss.x + 36, s.boss.z]);
}
ok(!!chestAt, 'the second boss died and dropped the evolution chest');
let evolved = false;
if (chestAt) {
  for (let i = 0; i < 30 && !evolved; i++) {
    await page.evaluate((p) => { window.__cap.set('pos', [p.x, p.z]); window.__cap.step(); }, chestAt);
    evolved = (await st()).evolved;
  }
}
const e5 = await fx();
ok(evolved, 'the chest resolved the evolution (fartwhip 8 + quick -> superfart, real resolveChest)');
ok(e5.counts.evolve === (e4.counts.evolve || 0) + 1, `evolution emits exactly one fxEvolve sting (evolve ${e4.counts.evolve || 0}->${e5.counts.evolve})`);

// FLUSH KILL: spawn the final flush at 1hp; it walks into the ring band and dies
await page.evaluate(() => {
  const c = window.__cap;
  c.set('mode', 'play');
  c.spawnFlush();
  c.setFlushHp(1);
  c.set('hp', 999);
});
const e6 = await fx();
let flushed = false;
for (let i = 0; i < 600 && !flushed; i++) {
  const s = await st();
  if (s.flush) {
    // re-park at its band if it stalls (it approaches, but the ring must stay the killer)
    await page.evaluate(([tx, tz]) => { window.__cap.set('pos', [tx, tz]); window.__cap.step(); }, [s.flush.x - 36, s.flush.z]);
  } else {
    await page.evaluate(() => window.__cap.step());
  }
  flushed = (await st()).flushResolved;
}
const e7 = await fx();
ok(flushed, 'the Flush was killed (real hitFlush path)');
ok(e7.counts.flushkill === (e6.counts.flushkill || 0) + 1, `flush (victory) emits exactly one fxFlushKill (flushkill ${e6.counts.flushkill || 0}->${e7.counts.flushkill})`);

// the per-type counters reconcile with the lifetime total (no untyped emit)
const total = Object.values(e7.counts).reduce((a, v) => a + v, 0);
ok(total === e7.emitted, `typed counts reconcile with total emitted (${total} === ${e7.emitted})`);

// ---------- 3. determinism: the FX layer never moves the sim ----------
async function traj(seed, n) {
  await page.evaluate((sd) => {
    window.__cap.freeze();
    window.__cap.restart(sd);
    window.__cap.giveWeaponNow('crackerring', 1);
    window.__cap.move(1, 0.5);
    window.__cap.set('hp', 999);
  }, seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = await page.evaluate(() => window.__cap.step());
    out.push(`${s.x},${s.z},${s.kills},${s.time},${s.fx.emitted}`);
  }
  return out.join('|');
}
const d1 = await traj(7715, 120);
const d2 = await traj(7715, 120);
ok(d1 === d2, 'determinism: identical seed+input → identical trajectory WITH the FX layer emitting (120 frozen steps)');
await page.evaluate(() => window.__cap.unfreeze());
const dFx = await fx();
ok(dFx.emitted > 0, `fx layer was live during the determinism runs (emitted=${dFx.emitted})`);

// ---------- 4. GL health: a live real-time soak renders without GL errors ----------
const gl = await fx();
ok(typeof gl.supported === 'boolean' && typeof gl.glErrors === 'number', '__cap probe exposes fx.supported + fx.glErrors');
if (gl.supported) {
  // real-time soak: the rAF loop runs fxDraw every frame against the live
  // context — a shader/attr mistake surfaces as GL errors here. The levelup
  // burst fires ~immediately so the POINTS path renders too (not just rings).
  await page.evaluate(() => {
    const c = window.__cap;
    c.restartPlay(4242);
    c.giveWeaponNow('crackerring', 1);
    c.set('hp', 999);
    c.gainXp(c.state().xpNeed + 1);
    c.pick(0);
  });
  await sleep(5000);
  const gl2 = await fx();
  ok(gl2.glErrors === 0, `live GL soak: zero GL errors over ~5s of real-time rendering (emitted=${gl2.emitted})`);
} else {
  console.log('  note: WebGL2 unavailable in this headless context — event contract + determinism still fully verified (Q2: the queue is the contract)');
}

ok(errs.length === 0, `no console/page errors (got ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''})`);

console.log(`\nm15: ${pass} pass / ${fail} fail`);
await b.close();
process.exit(fail === 0 ? 0 : 1);
