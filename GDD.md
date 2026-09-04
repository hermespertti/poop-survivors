# POOP SURVIVORS — Game Design Document

**Working title:** Poop Survivors
**Genre:** Bullet-heaven / survivors-like (Vampire Survivors clone)
**One-liner:** You are a crouton that just dropped into a soup bowl, and the kitchen
has been infested. Move. Auto-attack. Snowball until the screen is soup. Survive
30 minutes until The Final Flush finds you.
**Platform:** Web (browser, keyboard + touch/PWA), GitHub Pages
**Art:** hand-coded pixel art, limited palette, integer-scaled sprites (this is THE
signature requirement for this project)

---

## 1. Design pillars (what we're cloning, and why it works)

Research summary — VS wiki (level-up, weapons, evolution, stages, reaper pages) +
core-loop design analyses:

1. **ONE control.** Movement is the entire skill expression. Attacks auto-fire.
   Every decision is "where do I stand." This is the clone's soul — do not add
   attack buttons, dash, or aim.
2. **The spiral, not the loop.** Kill → XP gems → level up → more damage is the
   loop; the *spiral* is that each phase of the run re-contextualizes it:
   - 0–3 min: you are fragile, you pick up gems you're running away from
   - 3–8 min: you start clearing the room faster than it refills
   - 8–12 min: "bullet heaven" tipping point — the screen fills, you mow
   - 12–25 min: you are a force of nature, survival is about positioning and
     one big boss at a time
   - 25–30 min: godlike, waiting for The Final Flush
   Every systems decision (XP curve, enemy pacing, weapon power) serves this arc.
3. **Casino-fever anticipation.** The designer (ex-online-casino dev, per
   interviews) tuned the *feels* of uncertainty: the level-up 3-choice screen,
   the boss chest opening, the evolution reveal. These moments get outsized
   polish (pause, flash, sound, animation). The quiet minutes between them are
   the actual gameplay.
4. **Build discoverability is the retention engine.** Weapon + passive →
   evolution combos are the "what did I find this time" hook. The level-up pool
   is rarity-weighted; owned items can re-offer (upgrade), with luck shifting
   odds. Reproducible builds that players can chase across runs.
5. **Escalation schedule is a script, not a sim.** VS stages are a fixed event
   timeline (bosses at set minutes, special enemy types at set minutes, item
   spawns at cardinal points). A timed director script is what makes the 30-min
   arc land — we copy that, not emergent difficulty.

## 2. Run structure

- **Run length:** 30:00. (Decision pending Q1 — alternatives: 15/20.)
- **Director script (minutes):**
  | time | event |
  |---|---|
  | 0:00 | run starts, 1st enemy type |
  | 1:00 | 2nd type; first "swarm burst" |
  | 2:00 | 3rd type; swarm bursts repeat every ~2 min |
  | 5:00 | **BOSS 1 — The First Wind** (mini-boss, drops first chest) |
  | 7:00 | 4th type |
  | 10:00 | **BOSS 2 — Colonel C** (chest, evolution-grade) |
  | 12:00 | 5th type; first "spike" (density spike for 30 s) |
  | 15:00 | **BOSS 3 — The Constipation** (spawns the Spasm Wall: a slow ring of tanky enemies closing around the player — VS's flower-wall; you must break out) |
  | 17:00 | 6th type |
  | 20:00 | **BOSS 4 — The Diarrhea Express** (fast charging, chest) |
  | 25:00 | **BOSS 5 — Mr. Sphincter** (two-phase: clamps + shockwaves; final chest) |
  | 28:00 | everything that exists, all at once, for 2 minutes |
  | 30:00 | **THE FINAL FLUSH** spawns. Stage is won. Kill it → victory screen + bonus gold. Let it touch you → run ends "flushed." Surviving to 30:00 counts as a completed run either way (VS parity). |
- **Enemies always refill** from off-screen; density scales on the script.
  Bullet heaven = your clear rate exceeds the spawn rate; that moment must
  land around 8–10 min (balance target, see M7 soak).

## 3. Combat & stats

- Player: HP (base 100), armor (flat damage reduction), move speed,
  XP magnet radius.
- Enemy contact damage + 1 s of i-frames per hit (VS-style brief invuln;
  level-up choice also grants a short invuln — wiki-verified).
- **Weapon scaling stats** (VS-verified — weapons scale with these; passives
  feed them):
  - Damage (%)
  - Area / size (%)
  - Projectile speed (%)
  - Duration (%)
  - Cooldown reduction (%)
  - Amount (+projectiles)
  - Move speed, XP gain, luck, gold gain
- Damage numbers, hit-flash on enemies, knockback (garlic-analog reduces it).
- XP gems: kill → gem pops → drifts, magnet-pulled within radius (radius grows
  with level, VS-verified behavior: collection gets easier as you level).

## 4. Weapons (8 at launch)

Mapped to VS archetypes (all 8 max level 8; first 4 = "default pool", rest
unlock via achievements — VS-verified structure):

| # | name | archetype (VS analog) | behavior | evolves with | evolution |
|---|---|---|---|---|---|
| 1 | **Fart Whip** | Whip | horizontal slashing wave in facing dir, pierces all | Quick Hands (cooldown) | **SUPER FART** — huge piercing screen-clearing beam |
| 2 | **Plop Cannon** | Magic Wand | slow aimed shot at nearest enemy | Sticky (duration) | **Sticky Plop** — bigger, lingers, re-explodes |
| 3 | **Cracker Ring** | King Bible | orbiting projectiles, contact damage | Wide Stink (area) | **Halo of Crumbs** — orbit ring becomes a damaging disc |
| 4 | **Puddle** | Santa Water | spawns damaging ground zones at random | Meat Shakes (damage) | **Slime Lake** — big slow-zone that drags enemies in |
| 5 | **Bouncy Poop** | Runetracer | bounces between enemies | Gloves (proj speed) | **Superball Splat** — 3 superballs, huge bounce range |
| 6 | **Stink Aura** | Garlic | passive aura, damages nearby, -knockback to you | Lucky Charms (luck) | **Ghost of Last Night** — orbiting ghost that bites + auras |
| 7 | **Fart Bomb** | Fire Wand | big explosion at a random enemy | Big Breakfast (HP) | **BIG BURP** — massive multi-target AOE |
| 8 | **Orbiting Turd** | Peachone | heavy orbiting damage zone, slow | Slippers (speed) | **MOON OF THE BOWEL** — a full moon of doom circles you |

- Weapons are **unique per run** (one copy each — wiki-verified).
- Upgrading an owned weapon re-offers it at level-up (chance scales with luck,
  even/odd-level modulation — wiki-verified; we use a simplified owned-chance).
- Evolved weapon replaces the base; the passive is consumed (wiki-verified).

## 5. Passive items (8 at launch + 3 unlockable)

Max 5 levels each (wiki-verified structure). Stat passives only — no gimmicks
in v1.

| name | effect / level |
|---|---|
| **Meat Shakes** | +10% weapon damage |
| **Big Breakfast** | +25 max HP (max 3) |
| **Slippers** | +10% move speed |
| **TP Crown** | +8% XP gain |
| **Gloves** | +10% projectile speed |
| **Wide Stink** | +10% area |
| **Quick Hands** | −8% cooldown |
| **Sticky** | +10% duration |
| *Armor: Underwear Belt* (unlock) | +1 armor |
| *Lucky Charms* (unlock) | +luck |
| *Golden Scoop* (unlock) | +gold gain |

## 6. Level-up system (wiki-verified, simplified where safe)

- XP curve: 5 to lvl 2, then +10 XP per level to lvl 20, +13 to lvl 40, +16
  beyond; +600/+2400 XP walls at levels 20/40 with +100% XP growth while inside
  the wall. (Exact VS numbers.)
- On level up: **run pauses**, 3 unique rarity-weighted options (4th option
  possible via luck), weapons + passives in one pool, no repeats within a
  screen. Picking owned = level-up of it. New item only if a slot is free
  (6 weapon + 6 passive slots). If nothing to offer: gold option (VS Floor
  Chicken analog: a donut, +25 HP... we do +gold and +HP options).
- After choosing: brief invuln, resume. This screen is the #1 "casino moment"
  — gets the best animation/sound budget in the game.

## 7. Enemies (6 at launch)

| name | analog | role |
|---|---|---|
| **Bubble** | Bat | basic chaser, weak, early |
| **Goo Blob** | Skull | standard chaser, medium speed/HP |
| **Gassy Bat** | swarm bats | fast, tiny HP, spawns in 10+ bursts |
| **Spicy Pepper** | (new) | fast, high contact damage, 7:00+ |
| **Crumb** | (new) | very tiny, very fast, 12:00+, appears in flocks |
| **Burp** | Ghost | contact-explodes for damage, 17:00+ |

- Bosses (5, above) each: distinct 30–60 s pattern, big HP pool scaling with
  player level (VS-style HP×level so you can't one-shot bosses late), drop a
  **chest** on death (10:00+ chests carry an evolution-grade reward: if you
  hold max base + required passive, the chest *offers* the evolution — the
  reveal moment).
- **The Final Flush** (30:00): giant scythe-wielding poop. Chases relentlessly.
  Killable by a real build; touching you ends the run.

## 8. Stage: The Kitchen

- One large open map at launch (~4× the screen), tiled 64×64 kitchen-floor
  pixels, sparse obstacle clusters (counters, tables — solid, knockback
  against them) so positioning matters.
- **Stage items** (VS-verified): 3 passive items spawn at cardinal points of
  the map; walk over = auto-offer pickup; if you already own 6 passives it
  becomes a 7th (wiki rule).
- Second stage (M4, "The Bathroom") reuses the engine with new tileset +
  obstacle layout + script variant.

## 9. Meta progression (thin, VS-accurate)

- Gold drops from enemies (amount scales with gold-gain passive).
- Meta shop: unlock characters (2 more), unlock weapons 5–8 into the pool,
  unlock passives (Belt/Lucky Charms/Scoop), unlock stage 2.
- Characters (3):
  - **Crouton** (default): starts Fart Whip, +10% damage
  - **Hot Dog** (unlock: survive 10 min): starts Plop Cannon, +15% speed
  - **Avocado** (unlock: kill 500 enemies): starts Puddle, +1 armor
- Achievement-lite: a wall of small unlock conditions (VS's achievement list
  is itself a retention tool per the design analyses).
- No persistent stat upgrades. Unlocks only. (VS parity.)

## 10. Art direction (pixel — the project's signature)

- **Sprites:** hand-authored pixel art as JS pixel-array data (16×16 or
  32×32), no source PNGs to license, full palette control. 2-frame walk/idle
  animation minimum per entity; bosses 4-frame.
- **Palette:** one shared 16-color palette across everything (cohesion +
  charm). (Decision pending Q3 — cartoon-bright vs gothic vs neon.)
- **Rendering:** integer camera scale (2–3×), `imageSmoothing off`, entities
  snap to half-pixels max; background tiles 1:1 pixel with a gentle
  parallax-free top-down. Vignette + hit-flash as the only full-screen FX.
- **Enemy design rule:** every enemy is readable at 16×16 silhouette-first
  (a gassy bat and a bubble must be distinguishable in 0.1 s — VS's readability
  rule for hordes).
- Damage numbers, gem sparkles, and the level-up screen are pixel-animated
  (no font scaling tricks — use a proper 8×8 bitmap font).

## 11. Audio (researched 2026-08-31 — 8/16-bit VS style)

Research findings (VS wiki music pages, Zandara/Davies OST notes, chiptune
production guides):
- The real VS OST is **retro-flavored but modernly produced** — chip-influenced
  riffs over a "decidedly modern soundscape." It is NOT pure 8-bit.
- The **authentic 8/16-bit recipe** (what we're building): the NES APU =
  2 pulse/square oscillators (lead + counter-melody) + 1 triangle (bass) +
  1 noise (drums). 16-bit layer = sawtooth enrichment + a short delay/reverb
  for the "modern" VS sheen without leaving the chip family.
- **The full-sound trick:** arpeggios fake chords (a chip can't hold many
  notes). Square lead over arpeggiated pulse 2 + driving triangle bass +
  noise backbeat = the banger. Melodies from pentatonic/minor scales; a
  relentless backbeat.

### Architecture: in-code chiptune sequencer (the laziest correct way)
A mini fami-tracker on the Web Audio API. No audio files, no DAW, no DAW
exports. BGM is composed as **note-pattern data** (16th-note steps over N
bars) and played by a `Chip` synth that emulates the APU channels.
- **Why:** BGM must loop **seamlessly for 30 min** — a code sequencer loops
  by construction (bar count is known), an MP3 risks a seam. It's
  deterministic in headless soaks (and trivially mute-able), zero deps, and I
  can retune the riff until it bangers without re-rendering anything.
- **Tracks (composed as data):** `menu`, `kitchen` (the normal banger),
  `bathroom` (stage-2 variant, same feel new motif), `boss` (harder — drop
  the arpeggio, double-time feel, louder noise), `victory` + `gameover`
  stings. Hard cut (or 1-bar crossfade) on boss spawn/despawn.
- **SFX (one-shots on the same engine):** weapon fire (per-weapon timbre),
  enemy hit pop, enemy death splat, **gem chime whose pitch rises as the
  magnet fills** (the XP-pickup dopamine channel — make it *good*), level-up
  jingle (the #1 casino moment, best sting), evolution reveal sting, boss
  sting, The Final Flush horn, player damage, player death.
- **Mix:** one master gain, simple low-pass for the "16-bit" warmth, short
  feedback delay on the lead only. Mute button persisted to localStorage
  (prisma-panic pattern). Everything audible but never masking SFX.
- **Optional upgrade path:** HeartMuLa (local GPU music-gen) can render a
  richer "modern VS" arrangement as an alternate track — A/B it if the code
  sequencer ever feels thin. Default stays the code sequencer (loop-safe).
- **Milestone:** audio engine + first loop in M5 (juice pass); boss/menu
  variants and full SFX by M5 exit; both stage variants by M4 content pass.

## 12. Controls

- **Keyboard:** WASD/arrows. Nothing else. (P = pause.)
- **Touch (M6):** one virtual thumbstick anywhere on the lower half; full
  screen is the look/aim zone is *not* needed (auto-aim at nearest) — single
  stick only. PWA manifest + service worker (prisma-panic pattern, 390×844
  portrait + landscape).

## 13. Tech

- (Decision pending Q2 — default: **2D canvas, zero deps**, no engine.)
  Rationale: top-down 2D is VS's actual dimensionality; canvas + nearest-
  neighbor pixel arrays is the laziest correct renderer; headless-Chrome
  testing is cheapest without WebGL.
- Vite + TS (prisma-panic toolchain), `npm run dev` on a fixed port.
- **Test harness (prisma-panic M13–M15 pattern, reused):**
  - `window.__cap` probe surface (state, restart(seed), setStats, spawnEnemy)
  - headless chromium via CDP; deterministic seed runs
  - a **bot** that plays full runs (greedy: nearest gem, kinesis away from
    hordes, boss avoidance) — this is how balance is *measured*, not guessed
  - soak assertions: time-to-bullet-heaven lands 7–11 min; bot can reach 15
    min with a sane build; dies by 25–30 min if it stalls; no NaN; XP curve
    matches the wiki table exactly (property test); evolution chest actually
    offers the evolution when conditions hold
  - regression script: every suite, one result line each, green = done

## 14. Milestones (prisma-panic style; each = shippable + tested)

| M | content | exit criteria |
|---|---|---|
| **M1** | core loop: move, Bubble chasers, Fart Whip, gems, XP, 3-choice level up (pool of 2 items), HP, 3:00 timer, death screen; art pipeline (pixel arrays, palette, 8×8 font); __cap probe v0; seeded determinism | bot plays 3:00 headless; 8/8 assertions |
| **M2** | combat depth: 4 weapons + 4 passives + scaling stats; damage numbers; knockback; evolution v1 (Fart Whip → SUPER FART, chest at 3:00 boss); boss 1 | soak: bot reaches 5:00 |
| **M3** | director: 6 enemies, full timed script, 5 bosses + The Final Flush, chest/evolution system complete, 30:00 end, stage items | soak: bot completes a 30:00 run at least once across 5 seeds |
| **M4** | content completion: 8 weapons/8 passives/8 evolutions, 3 characters, meta (gold, unlocks, achievement wall), stage 2 | all evolutions reachable (test per character); unlock math verified |
| **M5** | juice + audio: hit flash, death pops, screen shake, XP sparkle, level-up animation, all SFX, 2 music loops | human-feel pass (you play 10 min, it feels alive) |
| **M6** | touch + PWA: thumbstick, layout 390×844 + landscape, manifest/SW, persisted mute | touch bot plays 5:00 on emulated phone (prisma-panic M12 pattern) — **DONE 2026-09-04, 28/0** |
| **M7** | balance soak + regression: bot soaks over 10 seeds × 30 min, rate reported (not boolean — the M15 lesson), tuning pass, full suite green | soak rate: ≥60% of bot runs reach 20:00, ≥1 full clear; 100% regression |
| **M8** | launch: GH Pages, hero screenshot, README, final commit log | playable at https://hermespertti.github.io/poop-survivors — **assets done 2026-09-04 (og.png, README, og tags); deploy pending** |

## 15. Decisions (locked 2026-08-31, user)

- **Q1 run length:** 30:00 (faithful to VS).
- **Q2 engine:** 2D canvas, zero deps, **+ a WebGL2 FX pass** on top:
  GPU-rendered additive particles/shockwaves/flash (hit sparks, XP sparkle
  trails, level-up and evolution stings, boss death). Game logic stays pure
  CPU + fixed timestep so the headless bot soaks remain deterministic; the FX
  layer is cosmetic and reads a particle event queue.
- **Q3 art direction:** cartoon-bright — sunny kitchen, googly-eyed gunk
  monsters, meme energy, 16-color shared palette.
- **Q4 launch scope:** FAT — 12 weapons, 8 passives, 6 characters, 2 stages
  (The Kitchen + The Bathroom) at M8. Added weapons 9–12: **Toilet Tornado**
  (orbiting vortex, VS Summon Spirit analog), **Plunger** (melee arc slash,
  Sword Brothers analog), **Roller** (pierce shot in move dir, Candy
  Cane/Cane analog), **The Big One** (periodic massive explosion, Troll Bomb
  analog). Added characters 4–6: **Wonton** (starts Bouncy Poop, +50 HP),
  **Lettuce** (starts Stink Aura, +25% magnet radius), **Mustard** (starts
  Fart Bomb, +25% gold). M4 absorbs the delta vs the lean plan.

## 16. Research notes (verified facts we're copying)

- XP curve and level-up pool rules: VS wiki "Level up" page (5/+10/+13/+16,
  20/40 walls, 3-4 options, rarity weights, owned-item re-offer, 4th option
  via luck, Floor Chicken fallback).
- Slots: 6 weapons + 6 passives; weapons unique per run, max 8; passives max 5.
- Evolutions: max base + required passive + chest; base removed, passive
  consumed; chest rewards from bosses (10:00+ are evolution-grade); reveal is
  a dedicated celebration moment.
- Stage = 30:00 script; mid-bosses at set minutes; stage items at cardinal
  points; flower-wall event at 15:00-analog; **Reaper** at 30:00 (65,535 dmg,
  HP = 655,350 × level, survives base game as "you lose on purpose" — we make
  ours killable for a real victory screen).
- Weapon stat scaling (damage/area/speed/duration/cooldown/amount) is the
  entire build-creation surface.
- Genre lessons: single control; the spiral; casino-feel polish on
  anticipation moments; boss chests as slot machines; achievement wall as
  retention; XP pickup sound as a dopamine channel; readable silhouettes in
  hordes.
- Brotato comparison: it wins on decision density (shops, dodging), loses on
  variety/snowball — we take VS's lane (auto-attack, positioning only) and
  steal one Brotato idea: the between-moment pause (level-up screen is our
  shop; it must *feel* like optimizing).

## 17. Content round 2 (shipped 2026-09-03, "M7" in commit/test parlance)

The user's "more content and polish" pass. Everything below is live and
covered by the M2/M3/M4 suites (33/27/51 assertions respectively):

- **2 new enemy archetypes** — the script's late-run gap (17:00→30:00 used
  to re-roll the same six kinds):
  - `splitter` (22:00): big slow lump; on death splits into two mops — the
    "kill it and it gets worse, don't kill it and it gets you" choice.
  - `spitter` (27:00): FIRST ranged enemy — holds a 60–110u band, strafes,
    lobs gunk shots that hit the player (new `enemy` bullet flag; enemy
    bullets skip the enemy/wall/boss damage blocks entirely).
- **9th weapon line**: `spritz` (Gunk Spritz, short-range cone) → +TP Crown→
  `gunkfountain` (GUNK FOUNTAIN: radial geyser + splash zone). TP Crown was
  the only unpaired evo passive; now all 9 passives have an evolution or a
  job.
- **10th passive**: `goldrush` (Gold Rush, +15% gold/lvl) — scales every
  gold gain (chest/flush/item/gold-option), so the meta actually compounds.
- **4th character**: `plunger` — Gunk Spritz start weapon, +50% gem magnet,
  unlock = kill 3 bosses (new `boss3` meta flag, tracked via bossKilled).
- **6th boss**: `THE LINT KING` @ 27:30 (1650s) — between Mr. Sphincter and
  the Final Flush. Slow fluff tank; 8-way gunk ring on a timer; at 50% HP
  it RAGES (faster, faster rings, spawns spitter pairs). Penultimate-horror
  slot: the run's last new *kind* of pressure before the flush.
- **Bathroom stage now means something**: `scriptShift: 60` was declared but
  never applied — `activeKinds()` now subtracts the stage's scriptShift from
  every unlock time, so the bathroom runs the identical script 60s early
  (droplet at 0:00 instead of 1:00). Stage difficulty is still scripted, not
  simulated (VS rule #5).
- **Polish**: `P` pause (play mode only, with blinking PAUSED banner; the
  __cap.step soak path bypasses it so determinism tests are untouched),
  title screen advertises P/M, win screen shows the actual stage name
  (was "KITCHEN CLEARED" even in the bathroom).
- **Audio (previous pass, same release)**: sfx voice cap (8 one-shots per
  100ms — heavy clatter can't tank the real-time loop), hurt/pop/gem/pickup
  kinds, music intensity scaled to director pressure, M mute.

## 18. Balance soak (M7 GDD deliverable, 2026-09-03) — the game is balanced

The GDD asked for a soak that "reports a rate, not pass/fail." Built
`test/balance.mjs` (10 seeds, full 30:00, **natural build** — no head start,
the level-up path a real player experiences) + `test/balance-diag.mjs`
(A/B build orders with per-30s clear-rate vs analytic spawn-rate crossover).

Findings (canonical: `test/balance-base.log`):

- **Bullet heaven** (GDD: clear rate > spawn rate, target 8–10 min): median
  **8.7 min**, reached by 8/10 seeds — on target. (Measured by rolling 30s
  kill rate vs the analytic spawn-rate curve, sustained 2 windows, not a
  population floor — the GDD's actual definition.)
- **Death rate 10/10 but spread 110s → 25.5min**, levels 4 → 40: a real
  skill curve, not a wall. The "10/10 dead by 178s" from the first (dps-first
  bot) was a BUILD-ORDER artifact: maxing one weapon before diversifying
  never crosses spawn rate (skill floor), the diversified build does.
- **Boss clears**: median 2.5/6, up to 4; deaths are "soup" (swarm), flush
  deaths rare — the flush gate is a true end-game event.
- **Level pacing** median: 11 @5min, 20 @10, 26 @15, 33 @20, 39 @25.
- HP pressure medians 100% across all bands for the diversified bot (the bot
  kites to full — a real player's dips are skill, not a heal-starve curve).

Conclusion: **no director tuning needed.** The 10-seed natural soak is the
standing balance gate; rerun after any content/balance change (it's
deterministic per seed, so numbers move predictably).

## 19. Content round 3 (M8, 2026-09-03) — playtest-driven

Anon playtest round 1: "lisää aseita vaihtoehdoiks" (more weapon options) +
the pixel font was hard to read ("varmaan tyylivalinta").

- **3 new weapon lines** (12 base weapons + 12 evolutions total, 13
  passives):
  - `mine` **Gunk Mine** → +`fuse`→ `minelord` **MINE LORD** — timed
    landmines: a mine drops, blinks faster as the fuse runs out, then blasts
    a wide one-shot AoE (new `blast` bullet field + explosion-on-expiry in
    the bullet loop). Mine Lord rains a 3-mine fast-fusing ring.
  - `chainfart` **Chain Fart** → +`chain`→ `chainstorm` **CHAIN STORM** —
    lightning that jumps enemy-to-enemy (Runetracer analog); Chain passive
    +1 hop; the storm hurls 3 bolts per shot.
  - `gnat` **Gnat** → +`winged`→ `supergnat` **SUPER GNAT** — a chomping
    companion that orbits and zaps the nearest enemies on its own cadence
    (tick-weapon like the cracker band; `gnatbeam` is a purely visual
    bullet — new `visual` flag makes visual bullets skip every damage block).
    Super Gnat = 3 zaps/tick; Winged adds zaps + spin.
- **3 new passives**: `fuse` (+20% mine blast/lvl), `chain` (+1 hop/lvl),
  `winged` (+1 zap +speed/lvl) — each is the evo key for its weapon line.
- **Font readability (the actual complaint)**:
  - Glyph advance was **6px for 7px-wide glyphs — letters overlapped**.
    Fixed to 7px advance (all width calcs updated: `center`, title, boss
    name).
  - **1px near-black halo** under every text style (drawn first, ink on top)
    — classic readable pixel-font look on any background.
  - **`scale` param on drawText**: title "POOP SURVIVORS", "LEVEL UP!", and
    the death/win overlay titles now render at **2×** — big screens are the
    ones people read, gameplay HUD stays 1×.
  - Verified by vision check: crisp outline, no collision/cutoff/smear.

## 20. Playtest round 2 (anon, 2026-09-03) — PARKED, not yet addressed

1. **~lvl 40 a shooter spawns whose bullets look identical to the XP gems**
   — the spitter's gunk shots (`kind:'gunk'` renders the green `gem` sprite).
   Fix direction: give spitter shots their own color/sprite (or a distinct
   projectile art) so "enemy bullet = dodge" vs "gem = grab" reads at a
   glance.
2. **XP pickup felt very slow exactly at lvl 20 and 40, normal at 21/41**
   — "ei ollu ihan lineaarinen" (not linear). Fix direction: audit the
   `xpToNext` curve + gem values around the 20/40 walls (VS has 798/477
   steps there — verify the *pickup* (magnet + gem value) matches the curve
   slope, or smooth the wall).
3. **The ring is too strong — AFK-able to ~lvl 40 (except bosses)**:
   crackerring/halo "suli kaikki" (melted everything), constant knockback,
   only bosses got through. Fix direction: the ring's DPS/tick may be too
   high per level, or its band too thick late; consider capping ring DPS
   growth or scaling band damage down vs clear-rate needs so the ring is
   defense + chip, not a solo-clearer. (This is the one that could reshape
   the balance-soak numbers — rerun the soak after.)
4. (neutral note) wave bursts still spawn in the meantime — no action.

## 21. M8 balance gate rerun (2026-09-03) — the pool dilution regression

The 10-seed natural-build balance gate was rerun after the M8 content round
(9 → 12 weapons, 10 → 13 passives). The director is untouched, so any move is
the level-up pool:

| | M7 pool (9 weapons) | M8 pool (12 weapons) |
|---|---|---|
| bullet heaven, median | 8.7 min (on target) | 9.9 min (still on target) |
| heaven reached by | 8/10 seeds | **3/10 seeds** |
| death rate | 10/10, spread 110s–25.5min | 10/10, **7/10 dead by lv 18 (~5 min)** |
| boss clears, median | 2.5/6 | **0/6** |
| population @ 20:00 | ~82 median | **95 median** |

Canonical log: `test/balance-base-m8.log`.

**Root cause (measured, not folklore):** the pool guarantees fresh picks. With
9 weapons a fresh roll was ~1/9 of the lottery, so the bot's upgrade-first
strategy (ring up, 2nd weapon, then scale) mostly got its upgrades. With 12,
an owned-weapon upgrade is ~3% of a per-screen lottery, so builds scatter
across 6+ weapons and no line ever maxes — clear rate never crosses the spawn
curve and the 10:00+ population wall is simply too thick.

**Half-fix measured and reverted:** reweighting the pool to VS-true owned-
first (1 fresh + 2 upgrades) moved heaven 3/10 → 4/10 and *hurt* the death
median (394s → 315s), and flipped the deterministic m3 gate (1/5 → 0/5 wins).
Reason: the natural bot's own pick priority grabs fresh weapons before owned
upgrades, so it ignores the extra upgrade slots — the pool and the pick
strategy fight each other. Reverted; ship them together in M9.

**M9 balance pass (the work this opens):**
1. Pool → VS-true owned-first (the diff above, one hunk).
2. Natural bot pick → upgrade-first with the fresh slot as tiebreak.
3. Ring strength (playtest round 2, item 3) — the bot's ring-8 builds now
   live to 20+ min in the m3/m4 soaks, and an AFK ring to lvl 40 is the
   player-reported experience; ring as defense+chip, not solo-clearer.
4. Then: rerun `node test/balance.mjs` until heaven ≥ majority of seeds,
   deaths spread, and median boss clears ≥ 2 — and the m3 gate back to ≥ 1 win.

**Process notes from this session:**
- `npm test` now runs the whole gate: `test/run-all.mjs` auto-starts the dev
  server if 5193 is down (and stops it again if it started it), runs m1–m4 in
  parallel (~5.6 min wall), streams `[mN]`-prefixed output, exits non-zero on
  any failure. `npm run test:mN` runs a single suite.
- Parallel is safe for these soaks: the bots drive the game through batched
  in-page `step()` (deterministic fixed-timestep), so CPU contention delays
  wall time but never the trajectory — measured byte-identical m3 output
  parallel vs sequential, all 5 seeds, 2026-09-03.
- Every harness now calls `test/server.mjs` `ensureServer()` first — a dead
  dev server no longer costs a suite its first lines.

## 22. M9 balance pass (in progress, 2026-09-03) — the endgame wall was ranged chip

Two measured, non-obvious fixes landed this session. Gate is 140/0 GREEN with
m3 back to **2/5 completions** (was 1/5 pre-M8, 0/5 mid-M9).

**Fix 1 — the m3 27:00–30:00 wall was spitter gunk, not the Lint King.**
A one-shot in-page trace of seed 1337 (the `__cap` probe, bot verbatim) showed
HP bleeding 100→10 from t=1632 with `near60=0` the whole time — no contact,
and the Lint King doesn't even spawn until 1650. Spitters unlock at t=1620
(27:00): they hold a 60–110u band, strafe, and lob 9-dmg gunk out to 280u. The
soak bots only sensed enemies within 100u and had zero projectile-dodging, so
they stood still in a gunk field, blind to the shots, then the 8250-HP Lint
King finished them at 10 HP. The fix is a measuring-tool upgrade, not a game
nerf: a new `__cap.enemyBullets(n)` probe + perpendicular-to-shot-line dodging
in the m3 and balance bots (a human strafes off incoming fire). Result: m3
wins at 1800s ×2, and the win builds keep their superfart:8 endgame weapon to
the end (the earlier `!s.weapons.superfart` guard stops the bot re-maxing the
base whip and resetting the evolved form to lvl 1).

**Fix 2 — the ring is a COMMON item (×3 weight in the fresh bag).**
The M8 pool-dilution regression (§21) starved the ring: with 12 weapons the
even fresh lottery offered it ~1/12, so 7/10 natural seeds went ring-less and
died before 5:00. VS treats the ring as a common, low-weight-drop item.
Weighting it ×3 in the fresh bag restores roughly the M7 acquisition rate
without touching the phase split (early 2-fresh / late 1-fresh). Result:
median death level up, heaven 3/10 → 4/10, boss median 0 → 1, deaths spread
from "7/10 by 5 min" to 116s–921s.

**Where it stands (vs the §21 M9 targets):**

| | M8 baseline | M9 now | target |
|---|---|---|---|
| m3 completions | 1/5 | **2/5** ✓ | ≥1 |
| gate | 140/0 | **140/0** ✓ | 100% |
| heaven reached | 3/10 | 4/10 | ≥5/10 (majority) |
| heaven median | 9.9 min | 9.7 min ✓ | 8–10 |
| boss median | 0 | 1 | ≥2 |
| death rate | 10/10, 7 by 5min | 10/10, spread 116s–921s | 1–5/10 |

**Remaining (next session):** the natural bot still dies 10/10 — but now
*spread* (3 early at 116–343s, 7 mid at 612–921s) rather than clustered. The
early deaths are the fresh-pick lottery (a seed that doesn't see the ring in
its first 2–3 level-ups wastes picks on 2nd/3rd weapons and falls to the
swarm). The mid deaths at lv 20–27 are the 10:00–15:00 population wall that a
"decent but not great" bot is meant to sometimes lose to. Getting heaven to a
majority + boss median ≥2 is a pick-strategy / early-pressure tune, not
another content change — the pool and director are in good shape. Parked
alongside M6 (mobile) — see the mobile milestone below.


## 23. M6 mobile (2026-09-04) — thumbstick + PWA shipped, soak green 28/0

**What landed:**
- **Floating thumbstick** (lower half of the view, coarse pointers only): the base
  spawns under the finger, drag = analog move vector, released finger = stop.
  Upper half stays pointer-walk (mouse-style hold-to-walk). Movement routes
  through `currentMove()` above `botDir`, so the touch path is provably separate
  from the bot path (`__cap.botDir()` stays 0 the whole run).
- **Phone fit**: `fitCanvas()` letterbox-FILLS on coarse pointers (non-integer
  scale; pixelated CSS keeps it crisp) — a 320×240 island on an 844×390 screen
  is the pre-M6 look. `clientToView/clientToWorld` use the canvas rect +
  `CANVAS_SCALE` (and the M6 fix: cursor → WORLD via the camera, not view-coords
  compared against world coords).
- **PWA shell** (`public/`): manifest.webmanifest (landscape, maskable icon),
  sw.js (network-first shell, cache-first hashed assets, versioned cache purge),
  icons 192/512/maskable/apple-touch. SW registers only off-localhost, scoped to
  the page's own directory (GH Pages serves a sub-path; vite `base:'./'` keeps
  the bundle relative).
- **Tap UX**: title/dead/win screens start a run on tap; level-up options are
  tappable (row math in VIEW space).

**The soak bug (27/1 → 28/0):** the touch bot did touchStart+touchEnd per
decision and sat idle for the CDP round-trips in between — no stick → no
movement — which let the swarm catch it at 277.4s, 23s short of the 5:00 boss.
Fix is in the harness, not the game: the thumb (finger 1) now HOLDS the whole
run and every decision is a touchMove; a second finger (finger 2) taps
level-ups. Real CDP `Input.dispatchTouchEvent` throughout (multi-touch: touchEnd
lists only the lifted finger). Result: seed 1337 → **lv 12 at 329.2s, 734 kills,
boss seen, 662 stick drags, 11 taps** — past the 5:00 window the GDD gate asks
for.

**Gate wiring:** `npm test` now runs m1–m4 in parallel (batched step() — safe,
byte-identical under contention) then m6 ALONE: its Part C is the only real-time
rAF soak, and the pre-M7 rule that real-time bots degrade under CPU contention
still applies to it. `npm run test:m6` runs it standalone.

**Parked alongside (unchanged):** the natural-bot balance tail from §22 (heaven
majority + boss median ≥2) is a pick-strategy tune, not mobile work.
