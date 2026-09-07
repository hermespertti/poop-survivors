// M19: persistence leaf — localStorage meta wallet.
// META is rebound only via resetMeta() (the __cap probe). Owners write here.
import type { Meta } from './types';
import { META_KEY } from './constants';

// ---------- meta (M4): gold + unlocks persist across runs (localStorage) ----------
// M11: upgrades = persistent gold-shop levels (the pre-M11 loop banked gold
// and never spent it — the meta wallet was a counter, not a progression).
export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) { const m = JSON.parse(raw); if (m && Array.isArray(m.unlocked)) { if (!m.upgrades || typeof m.upgrades !== 'object') m.upgrades = {}; return m as Meta; } }
  } catch {}
  return { gold: 0, unlocked: ['crouton'], achievements: [], bestTime: 0, bestKills: 0, upgrades: {} };
}
export function saveMeta(m: Meta): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
}
export let META: Meta = loadMeta();
// stage selection: 'kitchen' (default), 'bathroom' (survive a run),
// 'compost' (M13: beat the Lint King once — the final stage)
// M13: ordered id list — the title selector and tap handler cycle through all
// of these (pre-M13 it was a 2-way kitchen/bathroom toggle).

export function resetMeta(): Meta { META = { gold: 0, unlocked: ['crouton'], achievements: [], bestTime: 0, bestKills: 0, upgrades: {} }; saveMeta(META); return META; }
