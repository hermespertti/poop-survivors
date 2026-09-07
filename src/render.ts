// M19 phase 2: render module — moved verbatim from main.ts.

import { SPRITES, drawScaled, drawSprite, drawSpriteFlipped, drawText } from './art';
import { camX, camY, ctx } from './canvas';
import { STICK_R, VIEW_H, VIEW_W } from './constants';
import { G, gnatPos, lastEvoPair, orbit2Pos, orbitPos } from './game';
import { COARSE, stick } from './input';
import { center, drawFloor, drawHud, drawTitle } from './overlays';
import { bossSprite, enemySprite } from './sprites';
import { CHARACTERS } from './tables/chars';
import { PASSIVES, WEAPONS } from './tables/weapons';

export let camFXx = 0, camFXy = 0; // M15: the last render's camera — fxDraw rides it

export function render(t: number): void {
  if (G.mode === 'title') { drawTitle(t); camFXx = camX(); camFXy = camY(); return; }
  const sx = G.shake > 0 ? Math.sin(t * 47) * G.shake * 0.5 : 0;
  const sy = G.shake > 0 ? Math.cos(t * 39) * G.shake * 0.5 : 0;
  const cx = camX() + sx, cy = camY() + sy;
  camFXx = cx; camFXy = cy; // M15: FX layer shares the exact (shake-included) camera
  drawFloor(cx, cy);
  // zones under everything (M13: tint lets the slime trail read as green muck)
  for (const zn of G.zones) {
    ctx.fillStyle = zn.tint ? zn.tint + '73' : 'rgba(138,90,43,0.45)';
    ctx.beginPath(); ctx.arc(zn.x - cx, zn.z - cy, zn.r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = zn.tint ? zn.tint + '99' : 'rgba(74,50,32,0.6)'; ctx.stroke();
  }
  // M13 Plop Turrets (drawn over zones, under the player)
  for (const tu of G.turrets) {
    const tx = Math.round(tu.x - cx), tz = Math.round(tu.z - cy);
    drawSprite(ctx, SPRITES.turret, tx - 4, tz - 4, Math.floor(t * 4) % 2);
    // barrel toward the last aim so you can read what it's tracking
    ctx.fillStyle = 'rgba(200,220,255,0.7)';
    ctx.fillRect(tx + Math.round(Math.cos(tu.angle) * 6) - 1, tz + Math.round(Math.sin(tu.angle) * 6) - 1, 2, 2);
  }
  for (const g of G.gems) drawSprite(ctx, SPRITES.gem, Math.round(g.x - cx), Math.round(g.z - cy), Math.floor(t / 0.3) % 2);
  for (const it of G.items) {
    drawSprite(ctx, it.kind === 'gold' ? SPRITES.goldbag : SPRITES.donut, Math.round(it.x - cx) - 5, Math.round(it.z - cy) - 5, 0);
  }
  if (G.chest) drawSprite(ctx, SPRITES.chest, Math.round(G.chest.x - cx) - 6, Math.round(G.chest.z - cy) - 8, 0);
  for (const b of G.bullets) {
    if (b.enemy && b.kind === 'gunk') drawSprite(ctx, SPRITES.spit, Math.round(b.x - cx) - 3, Math.round(b.z - cy) - 3, Math.floor(t * 8) % 2); // M14: hostile blue spit, not the green-ish player plop
    else if (b.kind === 'plop' || b.kind === 'gunk' || b.kind === 'spritz' || b.kind === 'stickyplop') drawSprite(ctx, SPRITES.plop, Math.round(b.x - cx) - 4, Math.round(b.z - cy) - 4, 0);
    else if (b.kind === 'superfart') drawScaled(ctx, SPRITES.bolt, Math.round(b.x - cx) - 8, Math.round(b.z - cy) - 3, 2, 0);
    else if (b.kind === 'mine') {
      // arming blink: faster + brighter as the fuse runs out
      const arm = Math.floor(t * (4 + 16 * (1 - Math.max(0, b.life) / 1.2))) % 2;
      drawSprite(ctx, SPRITES.mine, Math.round(b.x - cx) - 3, Math.round(b.z - cy) - 3, arm);
    }
    else if (b.kind === 'zapflash' || b.kind === 'gnatbeam') drawSprite(ctx, SPRITES.chainfart, Math.round(b.x - cx) - 3, Math.round(b.z - cy) - 3, Math.floor(t * 30) % 2);
    else drawSprite(ctx, SPRITES.bolt, Math.round(b.x - cx), Math.round(b.z - cy), 0);
  }
  for (const e of G.enemies) {
    const frame = Math.floor(t * 8 + e.wob) % 2;
    const spr = enemySprite(e.kind, false);
    const hitSpr = enemySprite(e.kind, true);
    drawSprite(ctx, e.hitT > 0 ? hitSpr : spr, Math.round(e.x - cx), Math.round(e.z - cy), frame);
  }
  for (const e of G.wall) {
    const frame = Math.floor(t * 4 + e.wob) % 2;
    drawSprite(ctx, e.hitT > 0 ? SPRITES.crumbHit : SPRITES.crumb, Math.round(e.x - cx) - 1, Math.round(e.z - cy) - 1, frame);
  }
  if (G.boss) {
    const frame = Math.floor(t * 6) % 2;
    const { spr, hit } = bossSprite(G.boss.kind);
    drawSprite(ctx, G.boss.hitT > 0 ? hit : spr, Math.round(G.boss.x - cx) - 7, Math.round(G.boss.z - cy) - 7, frame);
  }
  if (G.flush) {
    const frame = Math.floor(t * 5) % 2;
    drawSprite(ctx, G.flush.hitT > 0 ? SPRITES.flushHit : SPRITES.flush, Math.round(G.flush.x - cx) - 8, Math.round(G.flush.z - cy) - 8, frame);
  }
  {
    const p = G.player;
    const frame = p.moving ? Math.floor(p.walkT * 10) % 2 : 0;
    const blink = p.invuln > 0 && Math.floor(t * 16) % 2 === 0;
    const chSpr = SPRITES[CHARACTERS[G.char]?.sprite || 'crouton'];
    const chHit = SPRITES[(CHARACTERS[G.char]?.sprite || 'crouton') + 'Hit'];
    // M13 facing animation: the sprite mirrors to face whatever way p.face
    // points (nearest enemy / last movement). The chars now have off-center
    // eyes, so left vs right reads as a real turn.
    const spr = blink && chHit ? chHit : chSpr;
    if (Math.cos(p.face) < 0) drawSpriteFlipped(ctx, spr, Math.round(p.x - cx), Math.round(p.z - cy), frame);
    else drawSprite(ctx, spr, Math.round(p.x - cx), Math.round(p.z - cy), frame);
  }
  // orbiting cracker ring (M13): N orbiting shards + a visible damage band.
  // The band is the actual damage zone (|d - r| < band), so it's drawn as a
  // semi-transparent annulus the exact width of the damage — the pre-M13
  // 1-dot + faint circle didn't read as "this whole ring hurts".
  if (orbitPos) {
    const p = G.player;
    const cr = G.weapons.crackerring;
    if (cr) {
      const r = 34 + 2 * cr.lvl;
      const band = 13;
      const cxp = Math.round(p.x - cx), cyp = Math.round(p.z - cy);
      // damage annulus (the real hitbox), gold-tinted
      ctx.fillStyle = 'rgba(255,224,130,0.14)';
      ctx.beginPath();
      ctx.arc(cxp, cyp, r + band, 0, Math.PI * 2);
      ctx.arc(cxp, cyp, Math.max(0, r - band), 0, Math.PI * 2, true);
      ctx.fill();
      // the shard count is derived from level, same as the fire loop
      const N = Math.min(8, 3 + Math.ceil(cr.lvl / 2));
      for (let s = 0; s < N; s++) {
        const a = cr.ang + (s / N) * Math.PI * 2;
        drawSprite(ctx, SPRITES.cracker, Math.round(p.x + Math.cos(a) * r - cx) - 4, Math.round(p.z + Math.sin(a) * r - cy) - 4, Math.floor(t * 12) % 2);
      }
    }
  }
  // orbiting turd (counter-rotation)
  if (orbit2Pos) {
    drawSprite(ctx, SPRITES.turd, Math.round(orbit2Pos.x - cx) - 5, Math.round(orbit2Pos.z - cy) - 5, Math.floor(t * 8) % 2);
  }
  for (const n of G.dmgNums) drawText(ctx, n.txt, Math.round(n.x - cx - 4), Math.round(n.z - cy), n.crit ? 1 : 0);
  // M8 gnat companion (drawn over the player so it reads as a buddy)
  if (gnatPos) drawSprite(ctx, SPRITES.gnat, Math.round(gnatPos.x - cx) - 4, Math.round(gnatPos.z - cy) - 4, Math.floor(t * 8) % 2);
  if (G.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, G.flashT * 2)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawHud(t);
  if (G.evolutionT > 0) {
    ctx.fillStyle = 'rgba(18,12,6,0.8)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const bounce = Math.round(Math.sin(t * 8) * 2);
    center('EVOLUTION!', 90 + bounce, 1);
    // show the actual pair that evolved (read from the last chest resolution)
    const pair = lastEvoPair();
    center(pair ? (WEAPONS[pair.base].name + '  +  ' + PASSIVES[pair.passive].name) : '???', 116, 0);
    center('= ' + (pair ? WEAPONS[pair.to].name : '?'), 128, 1);
  }
  // M6 thumbstick overlay (canvas-space, over everything): base + knob
  if (COARSE && G.mode === 'play' && stick.active) {
    ctx.strokeStyle = 'rgba(255,224,130,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(stick.bx, stick.bz, STICK_R, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(255,224,130,0.65)';
    ctx.beginPath(); ctx.arc(stick.bx + stick.x * STICK_R, stick.bz + stick.z * STICK_R, 12, 0, 6.283); ctx.fill();
  }
}
