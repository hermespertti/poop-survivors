// M19: deterministic RNG (mulberry32) — the sim's only randomness source.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- world / camera ----------

// ---------- player ----------

// ---------- XP curve (VS wiki). req N -> N+1 ----------

// ---------- weapons (data table) ----------
// base dmg/cd, per-level deltas. Slot: 'weapon'. superfart is evolution-only.
