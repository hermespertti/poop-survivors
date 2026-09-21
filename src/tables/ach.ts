// M25: achievement ladder — the visible chase list. Everything is evaluated
// at endRun() from run stats only (nothing tick-level), so the state()
// fingerprint (which samples mid-run) is untouched by construction.
// Pairs with the unlock keys in chars.ts — unlocks OPEN things, these are
// the trophies that show the player what there is to chase.
export type Ach = { id: string; name: string; desc: string };
export const ACHIEVEMENTS: Ach[] = [
  { id: 'firstkill',    name: 'FIRST BLOOD',      desc: 'KILL YOUR FIRST TARGET' },
  { id: 'kills100',     name: 'CRUMB CRUSHER',    desc: 'KILL 100 IN ONE RUN' },
  { id: 'kills500b',    name: 'KITCHEN CLEANER',   desc: 'KILL 500 IN ONE RUN' },
  { id: 'kills2500',    name: 'EXTERMINATOR',      desc: 'KILL 2500 IN ONE RUN' },
  { id: 'survivor10',   name: 'STILL BREATHING',   desc: 'SURVIVE 10 MINUTES' },
  { id: 'survivor20',   name: 'IRON GUT',          desc: 'SURVIVE 20 MINUTES' },
  { id: 'winner',       name: 'FINAL FLUSHED OUT', desc: 'SURVIVE THE FULL 30:00' },
  { id: 'firstboss',    name: 'WIND BREEZE',       desc: 'KILL YOUR FIRST BOSS' },
  { id: 'boss5',        name: 'KING OF CRAP',      desc: 'KILL 5 BOSSES IN ONE RUN' },
  { id: 'flushkillAch', name: 'FLUSH FIGHTER',     desc: 'KILL THE FINAL FLUSH' },
  { id: 'evolve1',      name: 'UPGRADE!',          desc: 'EVOLVE A WEAPON' },
  { id: 'evolve3',      name: 'EVOLUTION MACHINE', desc: 'EVOLVE 3 WEAPONS IN ONE RUN' },
  { id: 'rich',         name: 'GOLDEN SHIPMENT',   desc: 'COLLECT 400 GOLD IN ONE RUN' },
  { id: 'stagesAll',    name: 'PLUMBING FOREVER',  desc: 'CLEAR ALL 5 STAGES' },
];
