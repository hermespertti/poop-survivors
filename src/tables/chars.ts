// M19 phase 1: characters, stages, shop ladder (extracted verbatim).

export const CHARACTERS: Record<string, {
  name: string; sprite: string; startWeapon: string;
  dmgBonus: number; speedBonus: number; armor: number; hpBonus: number; goldBonus: number; magnetBonus: number;
  unlock: string; unlockDesc: string;
}> = {
  crouton:  { name: 'Crouton',  sprite: 'crouton',  startWeapon: 'fartwhip',
              dmgBonus: 0.10, speedBonus: 0, armor: 0, hpBonus: 0, goldBonus: 0, magnetBonus: 0,
              unlock: 'default', unlockDesc: 'default' },
  hotdog:   { name: 'Hot Dog',  sprite: 'hotdog',   startWeapon: 'plopcannon',
              dmgBonus: 0, speedBonus: 0.15, armor: 0, hpBonus: 0, goldBonus: 0, magnetBonus: 0,
              unlock: 'survive10', unlockDesc: 'survive 10 min' },
  avocado:  { name: 'Avocado',  sprite: 'avocado',  startWeapon: 'puddle',
              // M17 soak: puddle denial keeps XP pace fine (lv 15 by the
              // first boss) but the body is paper — died at the first boss
              // window ~7min on every seed, boss med 1. Tank identity gets
              // the body: +armor, +hp. Second soak pass: armor/hp didn't move
              // boss med — puddle slows but never bursts; the tank needs
              // teeth: +15% dmg on the whole kit.
              dmgBonus: 0.15, speedBonus: 0, armor: 2, hpBonus: 40, goldBonus: 0, magnetBonus: 0,
              unlock: 'kills500', unlockDesc: 'kill 500 enemies' },
  plunger:  { name: 'Plunger',  sprite: 'plunger',  startWeapon: 'spritz',
              dmgBonus: 0, speedBonus: 0, armor: 0, hpBonus: 0, goldBonus: 0, magnetBonus: 0.5,
              unlock: 'boss3', unlockDesc: 'kill 3 bosses' },
  // M13: two more characters. Cheese starts Gunk Mine (its holes are full of
  // them) and is tanky; Onion starts Bouncy Poop (it bounces off things) and
  // greases the gold. goldBonus is wired in recomputeStats (M13).
  cheese:   { name: 'Cheese',   sprite: 'cheese',   startWeapon: 'mine',
              // M17 soak: mine kit starves — swarm reaches melee before the
              // fuse economy pays off; died 5–10min on 5/5 seeds, boss med 0
              // (no burst). Give it a tanky
              // identity: tough + fast so it outlives the early swarm, plus a
              // small dmg bump so fuse has boss relevance.
              dmgBonus: 0.15, speedBonus: 0.10, armor: 1, hpBonus: 40, goldBonus: 0, magnetBonus: 0,
              unlock: 'minekill', unlockDesc: 'kill 1000 enemies' },
  onion:    { name: 'Onion',    sprite: 'onion',    startWeapon: 'bouncy',
              dmgBonus: 0, speedBonus: 0, armor: 0, hpBonus: 0, goldBonus: 0.15, magnetBonus: 0,
              unlock: 'goldrun', unlockDesc: 'collect 400 gold in one run' },
};

export const STAGES: Record<string, { name: string; unlock: string; tileA: string; tileB: string; accent: string; detail: number; scriptShift: number }> = {
  kitchen:  { name: 'The Kitchen',   unlock: 'default',  tileA: '#f3e2b8', tileB: '#e8cf94', accent: '#c9a35e', detail: 3,   scriptShift: 0 },
  bathroom: { name: 'The Bathroom',  unlock: 'survive5', tileA: '#cfe8f6', tileB: '#a5cde6', accent: '#7fb3cf', detail: 1,   scriptShift: 60 },
  compost:  { name: 'The Compost',   unlock: 'lintking', tileA: '#7a6a3f', tileB: '#655733', accent: '#4a3f24', detail: 2,   scriptShift: 120 },
};

export const STAGE_IDS = ['kitchen', 'bathroom', 'compost'];

export const UPGRADES: { id: string; name: string; desc: string; price: number; max: number }[] = [
  { id: 'hp',   name: 'IRON STOMACH', desc: '+15 max HP each',   price: 250, max: 5 },
  { id: 'dmg',  name: 'MEAT LOADER',  desc: '+10% damage each',  price: 300, max: 5 },
  { id: 'xp',   name: 'FAST DIGEST',  desc: '+10% XP each',      price: 200, max: 5 },
  { id: 'gold', name: 'GOLD RUSH',    desc: '+10% gold each',    price: 200, max: 5 },
];

