# Poop Survivors

![Poop Survivors](https://hermespertti.github.io/poop-survivors/og.png)

**VS-style bullet hell.** You are a crouton that dropped into a soup bowl. The kitchen
is infested. Move, auto-attack, snowball until the screen is soup — and survive
**30:00** until *The Final Flush* finds you.

Play: <https://hermespertti.github.io/poop-survivors>

- **12 weapons · 12 evolutions · 13 passives** — every weapon has a maxed-8 + passive
  evolution (SUPER FART, MINE LORD, CHAIN STORM, SUPER GNAT…)
- **6 scheduled bosses** — The First Wind → Colonel C → The Constipation → The
  Diarrhea Express → Mr. Sphincter → The Lint King, then the Final Flush
- **4 characters** (Plunger locked behind a boss kill), **2 stages** (Kitchen / Bathroom)
- **Gold + unlocks persist** between runs (localStorage meta) — and gold finally
  **spends**: a title-screen shop of 4 permanent upgrades (max HP, damage, XP,
  gold; Q/W/E/R or tap a row)
- **Run-end results**: kills, time, gold banked, NEW BEST TIME, and a fanfare for
  anything the run unlocked
- **Mobile PWA** — installable, offline shell, floating thumbstick (lower half of
  the screen), tap for level-ups, **on-screen pause + mute buttons**, and a big
  "TAP TO DROP IN" start prompt. Best in landscape.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | move |
| mouse / touch hold (upper half) | walk toward the pointer |
| touch (lower half) | floating thumbstick |
| tap / 1·2·3 | pick a level-up |
| SPACE / tap (title) | start / restart run |
| P | pause |
| M | mute (persists) |
| Q·W·E·R (title) | buy a shop upgrade |
| 1–4 / S (title) | character / stage select (tap to cycle on mobile) |
| pause / mute buttons (mobile) | top-center, under the timer |

## Dev

```sh
npm install
npm run dev      # http://127.0.0.1:5193
npm test         # full gate: m1-m4 in parallel + m6 (touch/PWA) — ~12 min, cold-start safe
npm run build    # dist/ (deployed to GitHub Pages on push to master)
```

The soak suites drive the game through a deterministic `__cap` probe (fixed timestep,
seeded RNG). `test/server.mjs` auto-starts the dev server if it's down. The GDD
(`GDD.md`) carries the milestone log, balance findings, and the canonical balance
baselines.
