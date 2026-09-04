// RUN-ALL — one command for the whole gate: `npm test`.
//
// What it does:
//   1. Starts the dev server if 127.0.0.1:5193 is not already up (and kills it
//      again on exit if it started it).
//   2. Runs the batch suites (m1..m4) IN PARALLEL. Parallel is safe here:
//      every bot drives the game through batched in-page step() (deterministic,
//      fixed-timestep), so CPU contention delays wall time but never changes
//      the trajectory. Measured 2026-09-03: parallel m3 output is
//      byte-identical to the sequential baseline, all 5 seeds.
//   3. Then runs m6 (touch/PWA) ALONE: its Part C is the only real-time rAF
//      soak (CDP touch, 330s wall) — the pre-M7 rule that real-time bots
//      degrade under CPU contention still applies to it, so it gets the box to
//      itself after the batch finishes.
//   4. Streams each suite's output with a [mN] prefix and prints a summary.
//   5. Exits non-zero if any suite fails.
//
// Wall time (measured, this box): ~11-12 min — ~6 min batch gate + m6's 5.5
// min phone soak.
import { spawn } from 'node:child_process';
import { ensureServer, killIfOwned } from './server.mjs';

const SUITES = ['m1', 'm2', 'm3', 'm4'];
const REALTIME = ['m6'];

await ensureServer();

const t0 = Date.now();
async function runSuite(s) {
  const child = spawn('node', ['test/' + s + '.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  let emitted = 0;
  const pipe = (d) => {
    out += d.toString();
    const nl = out.lastIndexOf('\n');
    if (nl < 0) return;
    const fresh = out.slice(emitted, nl);
    for (const line of fresh.split('\n')) {
      if (!line.trim()) continue;
      console.log(`[${s}] ${line}`);
    }
    emitted = nl + 1;
  };
  child.stdout.on('data', pipe);
  child.stderr.on('data', pipe);
  const code = await new Promise((res) => child.on('close', res));
  const m = out.match(/(\d+) pass \/ (\d+) fail/);
  return { suite: s, code, pass: m ? +m[1] : null, fail: m ? +m[2] : null };
}
const results = (await Promise.all(SUITES.map(runSuite))).concat(await Promise.all(REALTIME.map(runSuite)));

const secs = ((Date.now() - t0) / 1000).toFixed(0);
let totalPass = 0, totalFail = 0, bad = 0;
for (const r of results) {
  totalPass += r.pass ?? 0;
  totalFail += r.fail ?? 0;
  const ok = r.code === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${r.suite}: ${r.pass ?? '?'} pass / ${r.fail ?? '?'} fail (exit ${r.code})`);
}
console.log(`\nGATE: ${totalPass} pass / ${totalFail} fail across ${results.length} suites in ${secs}s — ${bad === 0 ? 'GREEN' : bad + ' suite(s) FAILED'}`);
killIfOwned();
process.exit(bad === 0 ? 0 : 1);