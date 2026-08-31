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
| **M6** | touch + PWA: thumbstick, layout 390×844 + landscape, manifest/SW, persisted mute | touch bot plays 5:00 on emulated phone (prisma-panic M12 pattern) |
| **M7** | balance soak + regression: bot soaks over 10 seeds × 30 min, rate reported (not boolean — the M15 lesson), tuning pass, full suite green | soak rate: ≥60% of bot runs reach 20:00, ≥1 full clear; 100% regression |
| **M8** | launch: GH Pages, hero screenshot, README, final commit log | playable at https://hermespertti.github.io/poop-survivors |

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
