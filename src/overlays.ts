// M19 phase 2: overlays module — moved verbatim from main.ts.


import { setMusicMsgT, setMuteMsgT } from './game';

import { SPRITES, drawScaled, drawSprite, drawText } from './art';
import { ctx } from './canvas';
import { DT, RUN_LEN, TILE, VIEW_H, VIEW_W } from './constants';
import { G, lastUnlocks, musicMsgOff, musicMsgT, muteMsgOn, muteMsgT, newBestTime, paused, selectedChar, selectedStage, upCost, upLvl } from './game';
import { COARSE } from './input';
import { META } from './meta';
import { muted } from './sfx';
import { evoReady } from './systems';
import { CHARACTERS, STAGES, STAGE_IDS, UPGRADES } from './tables/chars';
import { UNLOCK_LABEL } from './tables/sprites';
import { WEAPONS } from './tables/weapons';

export function drawFloor(cx: number, cy: number): void {
  const st = STAGES[G.stage] || STAGES.kitchen;
  const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
  for (let ty = y0; ty < y0 + VIEW_H / TILE + 1; ty++) {
    for (let tx = x0; tx < x0 + VIEW_W / TILE + 1; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? st.tileA : st.tileB;
      ctx.fillRect(tx * TILE - cx, ty * TILE - cy, TILE, TILE);
    }
  }
  // M13: per-stage floor detail so each stage reads as a distinct place
  // (pre-M13 it was a flat 2-tone checker everywhere — "the background could
  // be worked to be more interesting"). Deterministic per tile (hash), so it
  // doesn't shimmer as the camera scrolls. detail: 0 kitchen crumbs, 1
  // bathroom water/soap specks, 2 compost organic mottling.
  if (st.detail > 0) {
    ctx.fillStyle = st.accent;
    for (let ty = y0; ty < y0 + VIEW_H / TILE + 1; ty++) {
      for (let tx = x0; tx < x0 + VIEW_W / TILE + 1; tx++) {
        // cheap integer hash → 0..250; only some tiles carry a speck
        const h = Math.abs((tx * 7349 + ty * 9151 + 11) % 251);
        if (st.detail === 1) {
          // bathroom: sparse water/soap dots
          if (h % 13 === 0) ctx.fillRect(tx * TILE - cx + (h % 16) + 1, ty * TILE - cy + ((h >> 3) % 16) + 1, 1, 1);
        } else if (st.detail === 2) {
          // compost: organic mottling — darker patches + leaf flecks
          if (h % 9 === 0) ctx.fillRect(tx * TILE - cx + (h % 14), ty * TILE - cy + ((h >> 2) % 14), 2, 1);
          if (h % 17 === 0) ctx.fillRect(tx * TILE - cx + ((h >> 1) % 16), ty * TILE - cy + ((h >> 4) % 16), 1, 1);
        } else if (st.detail === 4) {
          // M21 sewers: wet-concrete streaks + heavier mold than compost
          // (detail 3 is kitchen — the crumb branch is the else-fallback;
          // new stages must claim a fresh detail number)
          if (h % 7 === 0) ctx.fillRect(tx * TILE - cx, ty * TILE - cy + (h % 16), 16, 1);
          if (h % 5 === 0) ctx.fillRect(tx * TILE - cx + (h % 12), ty * TILE - cy + ((h >> 2) % 12), 2, 2);
          if (h % 19 === 0) ctx.fillRect(tx * TILE - cx + ((h >> 1) % 16), ty * TILE - cy + ((h >> 3) % 16), 1, 1);
        } else if (st.detail === 5) {
          // M22 septic tank: sludge blobs + rising bubbles (the tank is ALIVE)
          if (h % 4 === 0) ctx.fillRect(tx * TILE - cx + (h % 10), ty * TILE - cy + ((h >> 2) % 10), 3, 2);
          if (h % 11 === 0) ctx.fillRect(tx * TILE - cx + ((h >> 1) % 14), ty * TILE - cy + ((h >> 4) % 14), 1, 2);
          if (h % 23 === 0) ctx.fillRect(tx * TILE - cx + ((h >> 3) % 12) + 2, ty * TILE - cy + 2, 1, 1);
        } else {
          // kitchen (M13): sparse crumbs + a few flour streaks
          if (h % 15 === 0) ctx.fillRect(tx * TILE - cx + (h % 15) + 1, ty * TILE - cy + ((h >> 2) % 15) + 1, 1, 1);
          if (h % 29 === 0) ctx.fillRect(tx * TILE - cx + (h % 10), ty * TILE - cy + ((h >> 3) % 10), 3, 1);
        }
      }
    }
  }
}

export function center(text: string, y: number, style: number, scale = 1): void {
  const w = text.length * 7 * scale;
  drawText(ctx, text, Math.round((VIEW_W - w) / 2), y, style, scale);
}

export function fmt(s: number): string {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function drawHud(t: number): void {
  center(fmt(G.time), 4, 0);
  drawText(ctx, 'LV' + G.level, 6, 4, 0);
  const bw = 120, bx = 6, by = 14;
  ctx.fillStyle = '#3a2b1a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
  ctx.fillStyle = '#7a5a2e'; ctx.fillRect(bx, by, bw, 5);
  ctx.fillStyle = '#58d68d'; ctx.fillRect(bx, by, Math.round(bw * Math.max(0, Math.min(1, G.xp / G.xpNeed))), 5);
  const hbx = VIEW_W - 84, hby = 4;
  ctx.fillStyle = '#3a2b1a'; ctx.fillRect(hbx - 1, hby - 1, 86, 9);
  ctx.fillStyle = '#7a2e2e'; ctx.fillRect(hbx, hby, 84, 7);
  ctx.fillStyle = '#e0563a'; ctx.fillRect(hbx, hby, Math.round(84 * Math.max(0, Math.min(1, G.player.hp / G.stats.maxHp))), 7);
  drawText(ctx, 'HP', hbx + 2, hby + 1, 0);
  // VS-style item HUD: ACTIVE weapons row (top icons, y=24) then PASSIVE row (y=36)
  const ICONS: Record<string, string> = {
    fartwhip: 'bolt', plopcannon: 'plop', crackerring: 'cracker', puddle: 'plop',
    bouncy: 'bouncy', stinkaura: 'stinkaura', fartbomb: 'fartbomb', turd: 'turd',
    superfart: 'bolt', stickyplop: 'stickyplop', halo: 'cracker', slakelake: 'plop',
    superball: 'bouncy', ghost: 'ghost', bigburp: 'fartbomb', moon: 'moon',
    spritz: 'spritz', gunkfountain: 'plop', // M7
    mine: 'mine', minelord: 'mine', chainfart: 'chainfart', chainstorm: 'chainfart', gnat: 'gnat', supergnat: 'gnat', // M8
    meats: 'donut', quick: 'bolt', slippers: 'gem', tp: 'gem', breakfast: 'donut',
    gloves: 'bolt', widestink: 'cracker', sticky: 'plop', lucky: 'gem',
    goldrush: 'goldbag', // M7
    fuse: 'mine', chain: 'chainfart', winged: 'gnat', // M8
    turret: 'turret', boomer: 'boomer', trail: 'trail', // M13 base
    autoblast: 'turret', cyclone: 'boomer', quagmire: 'trail', // M13 evos
    ammo: 'turret', grip: 'boomer', slush: 'trail', // M13 passives
  };
  let ax = 6;
  for (const id of Object.keys(G.weapons)) {
    const icon = ICONS[id] && SPRITES[ICONS[id]];
    if (!icon) continue;
    drawScaled(ctx, icon, ax, 24, 2, 0);
    // level tag under the icon (tiny)
    drawText(ctx, String(G.weapons[id].lvl), ax + 6, 30, 0);
    ax += 20;
  }
  let px = 6;
  for (const id of Object.keys(G.passives)) {
    const icon = ICONS[id] && SPRITES[ICONS[id]];
    if (!icon) continue;
    drawScaled(ctx, icon, px, 40, 2, 0);
    drawText(ctx, String(G.passives[id]), px + 6, 46, 2);
    px += 20;
  }
  // evolution hint: the base is maxed + its passive owned → chest will evolve
  const rdy = evoReady();
  if (rdy) center('EVO READY: ' + WEAPONS[rdy.toId].name, 56, 1);
  // gold
  drawText(ctx, 'G' + G.gold, VIEW_W - 40, 16, 0);
  // M11 mobile pause/mute buttons (top-center under the timer — the only free
  // strip in play mode). COARSE-only: desktop has P/M keys, listed on the
  // title. Hit-rects are the same coords the pointerdown handler checks.
  if (COARSE && G.mode === 'play') {
    // pause: two bars
    ctx.fillStyle = '#3a2b1a'; ctx.fillRect(135, 11, 20, 16);
    ctx.fillStyle = '#f3e2b8'; ctx.fillRect(136, 12, 18, 14);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(141, 14, 3, 9); ctx.fillRect(147, 14, 3, 9);
    // mute: M (struck through when muted)
    ctx.fillStyle = '#3a2b1a'; ctx.fillRect(159, 11, 20, 16);
    ctx.fillStyle = '#f3e2b8'; ctx.fillRect(160, 12, 18, 14);
    drawText(ctx, 'M', 163, 14, 0);
    if (muted()) { ctx.fillStyle = '#4a3220'; ctx.fillRect(160, 18, 18, 2); }
    // M13 fullscreen: 4-corner bracket icon — outward brackets = "enter",
    // a smaller inset set = "exit" (you're already in). F key on desktop.
    const fsOn = !!(document.fullscreenElement);
    ctx.fillStyle = '#3a2b1a'; ctx.fillRect(183, 11, 20, 16);
    ctx.fillStyle = '#f3e2b8'; ctx.fillRect(184, 12, 18, 14);
    ctx.fillStyle = '#4a3220';
    if (fsOn) {
      // inset (exit): x 190-196, y 17-20
      ctx.fillRect(190, 17, 1, 3); ctx.fillRect(190, 17, 3, 1);
      ctx.fillRect(196, 17, 1, 3); ctx.fillRect(194, 17, 3, 1);
      ctx.fillRect(190, 20, 1, 3); ctx.fillRect(190, 20, 3, 1);
      ctx.fillRect(196, 20, 1, 3); ctx.fillRect(194, 20, 3, 1);
    } else {
      // outward (enter): x 187-199, y 14-23
      ctx.fillRect(187, 14, 1, 4); ctx.fillRect(187, 14, 4, 1);
      ctx.fillRect(199, 14, 1, 4); ctx.fillRect(196, 14, 4, 1);
      ctx.fillRect(187, 23, 1, 4); ctx.fillRect(187, 23, 4, 1);
      ctx.fillRect(199, 20, 1, 4); ctx.fillRect(196, 23, 4, 1);
    }
  }
  // boss bar (per-boss name)
  if (G.boss) {
    const bbw = VIEW_W - 60, bbx = 30, bby = 64;
    ctx.fillStyle = '#1a0f08'; ctx.fillRect(bbx - 1, bby - 1, bbw + 2, 8);
    ctx.fillStyle = '#5a2e4e'; ctx.fillRect(bbx, bby, bbw, 6);
    ctx.fillStyle = '#c95aa0'; ctx.fillRect(bbx, bby, Math.round(bbw * Math.max(0, G.boss.hp / G.boss.maxHp)), 6);
    const nm = G.boss.name;
    drawText(ctx, nm, Math.round((VIEW_W - nm.length * 7) / 2), bby + 8, 1);
  }
  // FINAL FLUSH warning banner
  if (G.flush) {
    const blink = Math.floor(t * 3) % 2 === 0;
    if (blink) center('THE FINAL FLUSH!', 76, 1);
  } else if (G.time > RUN_LEN - 30 && !G.flushResolved) {
    center('THE FINAL FLUSH APPROACHES...', 76, 0);
  }
  // mute banners (M16 split): [M] sounds, [N] music — each shows its own
  // state for 1.4s so you always know which key did what
  if (muteMsgT > 0) {
    setMuteMsgT(muteMsgT - DT);
    if (Math.floor(t * 4) % 2 === 0) center(muteMsgOn ? 'SOUNDS OFF [M]' : 'SOUNDS ON [M]', 66, 2);
  }
  if (musicMsgT > 0) {
    setMusicMsgT(musicMsgT - DT);
    if (Math.floor(t * 4) % 2 === 0) center(musicMsgOff ? 'MUSIC OFF [N]' : 'MUSIC ON [N]', 78, 2);
  }
  // pause banner (P key): while paused, the sim is frozen — say so
  if (paused && G.mode === 'play') {
    if (Math.floor(t * 3) % 2 === 0) center('PAUSED [P]', 66, 1);
  }

  if (G.mode === 'dead') drawEndScreen(t, false, G.flushed);
  else if (G.mode === 'win') drawEndScreen(t, true, G.flushed);
  else if (G.mode === 'levelup') drawLevelUp();
}

export function overlay(title: string, sub1: string, sub2: string, t: number, dark: boolean): void {
  ctx.fillStyle = dark ? 'rgba(20,10,6,0.82)' : 'rgba(30,22,10,0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const bounce = Math.round(Math.sin(t * 2) * 2);
  center(title, 78 + bounce, 1, 2);
  center(sub1, 116, 0);
  center(sub2, 128, 0);
}
// M11 unlock id → what it unlocked (the reward the run earned). Shown on the
// end screen so a player who dies at 10:30 sees "NEW: Hot Dog" instead of a
// silent unlock in the localStorage.

export function drawEndScreen(t: number, won: boolean, flushed: boolean): void {
  ctx.fillStyle = won ? 'rgba(30,22,10,0.72)' : 'rgba(20,10,6,0.84)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const bounce = Math.round(Math.sin(t * 2) * 2);
  const title = won ? (STAGES[G.stage]?.name || 'KITCHEN').toUpperCase() + ' CLEARED!' : (flushed ? 'FLUSHED!' : 'SOUPED!');
  center(title, 40 + bounce, 1, 2);
  // stats + gold banked (white primary, parchment secondary)
  center(`lv ${G.level}   kills ${G.kills}   ${fmt(G.time)}`, 84, 1);
  center(`gold ${G.gold}  (bank ${META.gold})`, 98, 0);
  let y = 116;
  if (newBestTime) { center('* NEW BEST TIME *', y, 1); y += 14; }
  if (META.bestTime > 0) center(`best ${fmt(META.bestTime)}`, y, 2);
  // unlock fanfare — anything this run earned glows white, others skip
  for (const u of lastUnlocks) { center('NEW: ' + (UNLOCK_LABEL[u] || u), y + 14, 1); }
  // the prompt: tap on a phone, SPACE on a keyboard
  const prompt = COARSE ? (won ? 'tap to go again' : 'tap to try again') : (won ? 'press SPACE to go again' : 'press SPACE to retry');
  if (Math.floor(t * 1.6) % 2 === 0) center(prompt, 208, 1);
}

export function drawLevelUp(): void {
  ctx.fillStyle = 'rgba(18,12,6,0.86)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  center('LEVEL UP!', 8, 1, 2);
  // weapon id → icon sprite (the projectile/zone art for that weapon)
  const ICONS: Record<string, string> = {
    fartwhip: 'bolt', plopcannon: 'plop', crackerring: 'cracker', puddle: 'plop',
    bouncy: 'bouncy', stinkaura: 'stinkaura', fartbomb: 'fartbomb', turd: 'turd',
    superfart: 'bolt', stickyplop: 'stickyplop', halo: 'cracker', slakelake: 'plop',
    superball: 'bouncy', ghost: 'ghost', bigburp: 'fartbomb', moon: 'moon',
    spritz: 'spritz', gunkfountain: 'plop', // M7
    mine: 'mine', minelord: 'mine', chainfart: 'chainfart', chainstorm: 'chainfart', gnat: 'gnat', supergnat: 'gnat', // M8
    // passive item icons: use the closest kit art (VS passives get icons too)
    meats: 'donut', quick: 'bolt', slippers: 'gem', tp: 'gem', breakfast: 'donut',
    gloves: 'bolt', widestink: 'cracker', sticky: 'plop', lucky: 'gem',
    goldrush: 'goldbag', // M7
    fuse: 'mine', chain: 'chainfart', winged: 'gnat', // M8
    turret: 'turret', boomer: 'boomer', trail: 'trail', // M13 base
    autoblast: 'turret', cyclone: 'boomer', quagmire: 'trail', // M13 evos
    ammo: 'turret', grip: 'boomer', slush: 'trail', // M13 passives
  };
  G.options.forEach((o, i) => {
    const y = 36 + i * 44;
    // LIGHT panel + DARK text (readability): the panel is warm parchment so
    // the dark-outline ink (style 0) and white ink (style 1) both pop.
    ctx.fillStyle = '#f3e2b8'; ctx.fillRect(14, y, VIEW_W - 28, 40);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(14, y, VIEW_W - 28, 2); ctx.fillRect(14, y + 38, VIEW_W - 28, 2);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(14, y, 2, 40); ctx.fillRect(VIEW_W - 16, y, 2, 40);
    // item icon (scaled 2× from the sprite art) at the left of the row
    const iconId = ICONS[o.id];
    if (iconId && SPRITES[iconId]) {
      drawScaled(ctx, SPRITES[iconId], 20, y + 12, 2, 0);
      // shift the text right so the icon has room
      drawText(ctx, `[${i + 1}] ${o.name}`, 44, y + 6, 0);
      drawText(ctx, o.desc, 44, y + 20, 2);
    } else {
      drawText(ctx, `[${i + 1}] ${o.name}`, 22, y + 6, 0);
      drawText(ctx, o.desc, 22, y + 20, 2);
    }
    if (o.kind === 'weapon' || o.kind === 'passive') drawText(ctx, `LV${o.lvl}`, VIEW_W - 60, y + 6, 2);
  });
}

export function drawTitle(t: number): void {
  const st = STAGES[selectedStage] || STAGES.kitchen;
  for (let ty = 0; ty < VIEW_H / TILE; ty++) {
    for (let tx = 0; tx < VIEW_W / TILE; tx++) {
      ctx.fillStyle = ((tx + ty) % 2) === 0 ? '#f7ecc9' : '#ecd79c';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  const bob = Math.round(Math.sin(t * 2.2) * 3);
  drawScaled(ctx, SPRITES[CHARACTERS[selectedChar].sprite], Math.round(VIEW_W / 2 - 24), 54 + bob, 4, 0);
  const bounce = Math.round(Math.sin(t * 2) * 2);
  const title = 'POOP SURVIVORS';
  const tw = title.length * 14; // 7px advance x 2x scale
  const tx = Math.round((VIEW_W - tw) / 2);
  drawText(ctx, title, tx + 2, 109 + bounce + 2, 0, 2);
  drawText(ctx, title, tx, 108 + bounce, 1, 2);
  // M11: the start prompt is ALWAYS ON and big — the pre-M11 version blinked
  // and said "press SPACE" on a phone, so a first-time mobile player had no
  // clear way to start (verified: title tap works, the CUE was the gap).
  center(COARSE ? 'TAP TO DROP IN' : 'PRESS SPACE TO DROP IN', 132, 1, 2);
  // character select: 1/2/3 (tap the line on a phone)
  const chars = Object.keys(CHARACTERS);
  let line = '';
  chars.forEach((id, i) => {
    const unlocked = CHARACTERS[id].unlock === 'default' || META.unlocked.includes(CHARACTERS[id].unlock);
    const tag = unlocked ? '' : '?';
    const sel = selectedChar === id ? '>' : ' ';
    line += `${sel}${i + 1}${CHARACTERS[id].name[0]}${tag} `;
  });
  // M12: dark panel behind the select/shop block. Pre-M12 these lines were
  // style-0 dark ink on the tan checkered floor — the faintest text on the
  // screen (vision-verified: "crisp but soft, lowest contrast block"). A
  // dark overlay is exactly where the M11 light-halo style-0 ink reads best,
  // so one panel fixes the CH/STAGE/header/shop rows at once. The white
  // GOLD/BEST line (y=230) sits below the panel's bottom edge.
  ctx.fillStyle = 'rgba(26,15,8,0.88)';
  ctx.fillRect(10, 148, VIEW_W - 20, 82);
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(10, 148, VIEW_W - 20, 1);
  ctx.fillRect(10, 229, VIEW_W - 20, 1);
  center('CH: ' + line.trim(), 152, 0);
  // stage select: S (tap the right half on a phone) — M13: three stages,
  // M21/M22: five. M22: slots use the stage's `letter` (sewers and septic
  // both start with S — id[0] collided).
  const stgChar = (id: string) => (STAGES[id].unlock === 'default' || META.unlocked.includes(STAGES[id].unlock)) ? (STAGES[id].letter || id[0].toUpperCase()) : '?';
  center('STAGE: ' + STAGES[selectedStage].name.toUpperCase() + `  [S] (${STAGE_IDS.map((sid) => stgChar(sid)).join('')})`, 164, 0);
  // M11 gold shop (VS-style meta): banked gold finally spends. Keyboard Q/W/E/R
  // buys a row; on a phone, TAP the row. Rows match shopRowY() for hit-testing.
  center(COARSE ? 'UPGRADES: TAP A ROW' : 'UPGRADES QWER  P PAUSE  M SOUND  N MUSIC  F FS', 176, 2);
  const SHOPKEYS = ['Q', 'W', 'E', 'R'];
  const SHOPBRIEF: Record<string, string> = { hp: '+15HP', dmg: '+10%DMG', xp: '+10%XP', gold: '+10%GOLD' };
  UPGRADES.forEach((up, i) => {
    const lvl = upLvl(up.id);
    const right = lvl >= up.max ? 'MAX' : 'G' + upCost(up.id);
    center(`[${SHOPKEYS[i]}] ${up.name} ${SHOPBRIEF[up.id]} ${lvl}/${up.max} ${right}`, shopRowY(i), 0);
  });
  center(`GOLD ${META.gold}  BEST ${fmt(META.bestTime)}`, 230, 1);
  for (let i = 0; i < 3; i++) {
    const bx = (t * 24 + i * 120) % (VIEW_W + 24) - 12;
    const by = 16 + i * 10 + Math.round(Math.sin(t * 3 + i) * 4);
    drawSprite(ctx, SPRITES.bubble, Math.round(bx), by, Math.floor(t * 6 + i) % 2);
  }
}
// M11: shop row baselines — drawTitle renders the rows here, pointerdown
// hit-tests the same rects (one source of truth so tap-targets never drift).

export function shopRowY(i: number): number { return 188 + i * 10; }

// ---------- main loop ----------
