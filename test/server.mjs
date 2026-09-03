// Shared dev-server bootstrap for the soak harnesses.
// Every suite hits http://127.0.0.1:5193/ — if the server is down a suite
// dies with ERR_CONNECTION_REFUSED before it can say anything useful.
// ensureServer() starts it if needed; killIfOwned() tears it down again.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

export const URL = 'http://127.0.0.1:5193/';
const PORT = 5193;
let owned = null;

export async function serverUp() {
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function ensureServer() {
  if (await serverUp()) return;
  console.log('dev server down — starting it for the run');
  owned = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore', detached: true,
  });
  owned.unref();
  for (let i = 0; i < 60; i++) {
    if (await serverUp()) return;
    await sleep(500);
  }
  console.error('FATAL: dev server did not come up on ' + PORT);
  owned.kill('SIGTERM');
  owned = null;
  process.exit(2);
}

export function killIfOwned() {
  if (owned) { owned.kill('SIGTERM'); owned = null; }
}
