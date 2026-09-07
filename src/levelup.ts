// M19 phase 2: levelup module — moved verbatim from main.ts.


import { PLAYER } from './constants';
import { fxLevelUp } from './fx';
import { G, recomputeStats } from './game';
import { sfx } from './sfx';
import { PASSIVES, WEAPONS, xpToNext } from './tables/weapons';
import { ItemOpt } from './types';

export function weaponCount(): number { return Object.keys(G.weapons).filter((id) => !WEAPONS[id].evolved).length; }

export function passiveCount(): number { return Object.keys(G.passives).length; }

export function buildOptions(): ItemOpt[] {
  const opts: ItemOpt[] = [];
  for (const id of Object.keys(WEAPONS)) {
    const w = G.weapons[id];
    if (w) {
      // OWNED weapon (evolved or base) offered up to maxLvl. M10k fix: the
      // pre-M10 `if (WEAPONS[id].evolved) continue;` dropped the evolved
      // weapon from the pool entirely, so superfart was stuck at lvl 1 for the
      // rest of every NATURAL run (M10j2 gate: 6/10 died at MR. SPHINCTER
      // 1500s with superfart:1 + a maxed secondary line; m3/m4 were immune
      // only because their bots head-start superfart at 8 via giveWeaponNow).
      // The evo'd weapon IS the build — it must be levelable to 8 (VS
      // behavior). weaponCount() (the 6-weapon cap) still excludes evolved.
      if (w.lvl < WEAPONS[id].maxLvl) opts.push({ kind: 'weapon', id, name: WEAPONS[id].name, desc: 'Upgrade ' + WEAPONS[id].name, lvl: w.lvl });
    }
    else if (weaponCount() < 6 && !WEAPONS[id].evolved) {
      // FRESH base weapons respect the 6-weapon cap; evolved weapons are never
      // offered fresh (you evolve INTO them — a fresh evolved option would be
      // an un-evolvable orphan, e.g. a second superfart with no whip to consume).
      opts.push({ kind: 'weapon', id, name: WEAPONS[id].name, desc: WEAPONS[id].desc, lvl: 1 });
    }
  }
  for (const id of Object.keys(PASSIVES)) {
    const lvl = G.passives[id] || 0;
    if (lvl > 0) { if (lvl < PASSIVES[id].maxLvl) opts.push({ kind: 'passive', id, name: PASSIVES[id].name, desc: 'Upgrade ' + PASSIVES[id].name, lvl }); }
    else if (passiveCount() < 6) opts.push({ kind: 'passive', id, name: PASSIVES[id].name, desc: PASSIVES[id].desc, lvl: 1 });
  }
  if (opts.length === 0) {
    opts.push({ kind: 'hp', id: 'hp', name: 'Donut', desc: 'Restore 25 HP', lvl: 0 });
    opts.push({ kind: 'gold', id: 'gold', name: 'Golden Scoop', desc: '+50 Gold', lvl: 0 });
    return opts;
  }
  // VS-true pool (M9): OWNED UPGRADES first, PHASE-AWARE. The M7 split
  // (2 fresh + 1 upgrade) was tuned for 9 weapons; at 12, an owned-weapon
  // upgrade was ~3% of the per-screen lottery, so late-game builds scattered
  // across 6+ weapons and never crossed the spawn curve (GDD 21). But a flat
  // 1-fresh pool backfires early: the ring becomes a ~4%/screen lottery
  // (1 of ~24 fresh options) and builds gamble their defense (measured M9c:
  // heaven 4/10). VS behavior: fresh picks matter early, upgrades dominate
  // late. So: <3 owned weapons -> 2 fresh + 1 upgrade (M7 early experience,
  // fast ring/kit acquisition); >=3 -> 1 fresh + 2 upgrades (max lines,
  // don't dilute).
  const shuf = (a: ItemOpt[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(G.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ownedUp = opts.filter((o) => (o.kind === 'weapon' && G.weapons[o.id]) || (o.kind === 'passive' && G.passives[o.id]));
  // VS-true rarity (M10): the ring is a COMMON item (weight 4 in the fresh
  // bag) — M9's ×3 still left 7/10 seeds ring-less in the M10c probe, and the
  // 60–130s window (60s wave + bubble swarms) is lethal for a whip-only
  // build (directional beam, no orbiting AoE). ×4: P(ring by lv-up 5) ≈ 41%.
  // PASSIVES are the common tier too (weight 2): the M10g gate showed the
  // evo gate (quick) never landed in some runs — the evo is the build's
  // backbone (VS core loop), so its gate can't be a 1/18 lottery. ×2 doubles
  // passive offer rate without diluting the weapon lines.
  const freshBag = opts
    .filter((o) => !ownedUp.includes(o))
    .flatMap((o) => (o.id === 'crackerring' ? [o, o, o, o] : o.kind === 'passive' ? [o, o] : [o]));
  const fresh = shuf(freshBag).filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i);
  // EVOLVED-WEAPON PIN (M10k): once the build has evolved, the evolved weapon
  // is its signature DPS — pin it into slot 0 of the owned-upgrade half so it
  // is offered in every draw until maxed. The M10j2 gate (test/balance.mjs)
  // measured 6/10 deaths at MR. SPHINCTER (1500s) carrying superfart:1 with a
  // SECONDARY line maxed (plopcannon 8, bouncy 8, turd 7) — in the even
  // owned-upgrade shuffle the evo'd line is 1 of ~6 upgrades competing for 2
  // slots, so the bot filled the other lines instead. VS behavior: after the
  // chest you level the evolved weapon first; nothing outranks it. Only the
  // unmaxed evolved line pins (a maxed one isn't offered anyway), and the rest
  // is a plain shuffle so no other item's relative odds change.
  const evolvedOpts = ownedUp.filter((o) => WEAPONS[o.id]?.evolved && (G.weapons[o.id]?.lvl || 0) < WEAPONS[o.id].maxLvl);
  const restOpts = ownedUp.filter((o) => !evolvedOpts.includes(o));
  const owned = [...evolvedOpts, ...shuf(restOpts)];
  // M12: FOUR options (VS shows 3 + a 4th luck option; GDD §16 noted it, we
  // never built it). Pre-M12 the 3 slots were 1-2 fresh + 1-2 upgrades — and
  // early upgrades are structurally ONLY whip+ring (the only owned items), so
  // every level-up screen was {whip, ring, quick} and it read as the same
  // choices forever (human feedback). Now: 2 fresh + 2 upgrades. The evolved
  // line stays pinned to slot 0 of the upgrade half (the M10k superfart:1
  // fix — it's the build's signature and balance-critical), so it's 1 of 4
  // instead of 1 of 3. The shuf() calls above keep the same draw order, so
  // the per-seed rng stream is unchanged from pre-M12.
  const MAXOPTS = 4;
  let result: ItemOpt[] = fresh.slice(0, 2);
  for (const o of owned) {
    if (result.length >= MAXOPTS) break;
    if (!result.some((r) => r.id === o.id)) result.push(o);
  }
  for (const o of fresh.slice(2)) {
    if (result.length >= MAXOPTS) break;
    if (!result.some((r) => r.id === o.id)) result.push(o);
  }
  if (result.length === 0) result = shuf(opts).slice(0, MAXOPTS);
  // de-dup by id (guard against a single-option pool)
  const seen = new Set<string>();
  result = result.filter((o) => { if (seen.has(o.id)) return false; seen.add(o.id); return o; });
  // EVO-GATE GUARANTEE (M10j): once a base weapon is COMMITTED (lvl >= 6 — the
  // build is clearly going for that line), one fresh slot is always its evo
  // passive until that passive is owned. The M10j probe (test/probe-balance.mjs)
  // measured the wall this removes: with the 1-fresh slot and ×2 passives,
  // quick's offer rate is ~4.5%/level-up, so 6/10 seeds maxed whip 8 + ring 8
  // with zero passives and hit COLONEL C / THE CONSTIPATION evo-less. The
  // evolution is the game's core loop (VS: the chest resolves your evo), so
  // its gate can't ride the fresh-item lottery. Mirrors the ring's forced
  // common below; fires once per line (after the gate is consumed by the evo,
  // a second base line can re-arm it for its own gate).
  if (!G.evolved) {
    // the HIGHEST-LEVEL owned base line (its evo passive missing) is the
    // committed build — force ITS gate into a fresh slot. The ring is excluded:
    // it's a utility/defense item, and the M10j gate run measured the head
    // start's ring-8 (m4 avocado) arming crackerring→halo ahead of the
    // character's own line (evoReady() resolves in table order, and the ring
    // sits above puddle). The ring's halo evo stays reachable the normal way
    // — it just can't hijack a character's own evolution.
    let gateId: string | null = null;
    let gateLvl = 0;
    for (const id of Object.keys(WEAPONS)) {
      const w = WEAPONS[id];
      if (w.evolved || !w.evoWith || !w.evolvesTo) continue;
      if (id === 'crackerring') continue;
      const lvl = G.weapons[id]?.lvl || 0;
      if (lvl >= 6 && !(G.passives[w.evoWith] || 0) && lvl > gateLvl) { gateLvl = lvl; gateId = w.evoWith; }
    }
    if (gateId && !result.some((o) => o.id === gateId)) {
      const gate = opts.find((o) => o.id === gateId && o.kind === 'passive');
      if (gate) {
        for (let i = result.length - 1; i >= 0; i--) {
          if (!ownedUp.includes(result[i])) { result[i] = gate; break; }
        }
      }
    }
  }
  // VS-true common drop (M10): while the ring is UNOWNED, one fresh slot is
  // always the ring. The M10c probe (test/probe-balance.mjs) measured that
  // even a ×4-weighted ring left 7/10 seeds ring-less — they die before the
  // 4th level-up where the lottery would eventually deliver it, and the
  // 60–130s window (60s wave + bubble swarms) is lethal for a whip-only
  // build (directional beam, no orbiting AoE). A forced common slot makes
  // ring acquisition deterministic; once owned it's a normal upgrade item.
  if (!G.weapons['crackerring']) {
    if (!result.some((o) => o.id === 'crackerring')) {
      const ringOpt = opts.find((o) => o.id === 'crackerring');
      if (ringOpt) {
        for (let i = result.length - 1; i >= 0; i--) {
          if (!ownedUp.includes(result[i])) { result[i] = ringOpt; break; }
        }
      }
    }
  }
  return result.length ? result : shuf(opts).slice(0, 3);
}

export function pickOption(i: number): void {
  const o = G.options[i];
  if (!o) return;
  if (o.kind === 'weapon') {
    if (G.weapons[o.id]) G.weapons[o.id].lvl++;
    else G.weapons[o.id] = { lvl: 1, cd: 0, ang: G.rng() * 6.28 };
  } else if (o.kind === 'passive') {
    G.passives[o.id] = (G.passives[o.id] || 0) + 1;
    recomputeStats();
  } else if (o.kind === 'hp') {
    G.player.hp = Math.min(G.stats.maxHp, G.player.hp + 25); // M10k: clamp to EXPANDED maxHp so breakfast (+25/stack) can be held, not just buffered
  } else if (o.kind === 'gold') {
    G.gold += Math.round(50 * G.stats.goldMult); // M7 gold rush scaling
  }
  G.mode = 'play';
  G.player.hp = G.stats.maxHp; // VS rule: leveling up restores health — to the EXPANDED max (M10k) so breakfast builds keep their buffer
  G.player.invuln = Math.max(G.player.invuln, PLAYER.invulnOnLevel);
  G.flashT = 0.25;
}

// ---------- combat helpers ----------

export function gainXp(amt: number): void {
  G.xp += amt;
  checkLevelUp();
}

export function checkLevelUp(): void {
  while (G.xp >= G.xpNeed) {
    G.xp -= G.xpNeed;
    G.level++;
    G.xpNeed = xpToNext(G.level);
    G.stats.maxLevel = Math.max(G.stats.maxLevel, G.level);
    if (G.mode === 'play') { G.mode = 'levelup'; G.options = buildOptions(); G.stats.levelUps++; fxLevelUp(G.player.x, G.player.z); sfx('levelup'); break; }
  }
}

// ---------- main update ----------
