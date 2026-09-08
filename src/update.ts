// M19 phase 2: update module — moved verbatim from main.ts.
// M20 readability split: the 444-line update() body is now a pipeline of
// named step* passes in EXACTLY the old order. The old mid-function
// `endRun(...); return;` early-exits become `return false` (stop the
// pipeline); update() consumes the signal identically. Evaluation order and
// RNG consumption are frozen by test/fingerprint.mjs (`815bf2e5…`) — any
// pass reorder or re-extraction that shifts an RNG draw fails loud.

import { setMusicMsgOff, setMusicMsgT, setMuteMsgOn, setMuteMsgT, setPaused, setSelectedChar } from './game';

import { toggleFullscreen } from './canvas';
import { damageEnemy, eDmg, nearestEnemy, nearestEnemyExcluding, wArea, wProjSpeed } from './combat';
import { DT, PLAYER, RUN_LEN, SPIKE_EVERY, SPIKE_T, WORLD_H, WORLD_W } from './constants';
import { fxGem } from './fx';
import { G, buyUpgrade, clampNum, cycleStage, endRun, musicMsgOff, musicMsgT, muteMsgOn, muteMsgT, paused, selectedChar, startRun } from './game';
import { currentMove, justPressed, keyIndex, syncKeys } from './input';
import { gainXp, pickOption } from './levelup';
import { META } from './meta';
import { musicIntensity, muted, sfx, toggleMusicMute, toggleMute } from './sfx';
import { pickKind, spawnEnemy, spawnItem, spawnSpasmWall, spawnWave } from './spawner';
import { damageWall, fireWeapons, hitBoss, hitFlush, resolveChest, spawnBoss } from './systems';
import { CHARACTERS, STAGES, UPGRADES } from './tables/chars';
import { BOSS_SCHEDULE, BOSS_STATS } from './tables/enemies';
import { Enemy, Game } from './types';

type Player = Game['player'];
// true = continue the pipeline; false = run ended mid-pass (old `return`)
type Step = (p: Player) => boolean;

// ---------- input + mode routing (unchanged, runs every frame) ----------
function stepInput(): void {
  syncKeys();
  // mute toggles (M16 split): [M] = attack/hit/UI sounds, [N] = music only.
  // Both work on title/play/levelup/dead/win (before mode gates).
  if (justPressed('m')) { toggleMute(); G.flashT = 0.2; setMuteMsgT(1.4); setMuteMsgOn(muted()); }
  if (justPressed('n')) { const on = toggleMusicMute(); G.flashT = 0.15; setMusicMsgT(1.4); setMusicMsgOff(!on); }
  // pause: P — play mode only (the soak harnesses run with __cap.step, which
  // bypasses this gate, so pause never touches determinism tests)
  if (justPressed('p') && G.mode === 'play') setPaused(!paused);
  // M13 fullscreen: F — works from title and play (a user gesture, as the
  // Fullscreen API requires)
  if (justPressed('f') && (G.mode === 'play' || G.mode === 'title')) toggleFullscreen();
  if (G.mode === 'levelup') {
    const idx = keyIndex('1', '2', '3', '4');
    if (idx >= 0) pickOption(idx);
  } else if (G.mode === 'title') {
    // character select (1-6, M13: two more chars) + stage toggle (S) + start (SPACE)
    const chIdx = keyIndex('1', '2', '3', '4', '5', '6');
    if (chIdx >= 0) {
      const id = Object.keys(CHARACTERS)[chIdx];
      const ch = CHARACTERS[id];
      if (ch.unlock === 'default' || META.unlocked.includes(ch.unlock)) setSelectedChar(id);
    }
    if (justPressed('s')) {
      cycleStage(); // M13/M21: stage cycle (keyboard mirrors the tap)
    }
    // M11: shop buys on the keyboard (QWER mirror the title rows)
    const upIdx = keyIndex('q', 'w', 'e', 'r');
    if (upIdx >= 0) buyUpgrade(UPGRADES[upIdx].id);
    if (justPressed(' ') || justPressed('enter')) startRun(G.seed);
  } else if (G.mode === 'dead' || G.mode === 'win') {
    if (justPressed(' ') || justPressed('enter')) startRun(G.seed);
  }
}

// ---------- pass 1: clock, movement, timers ----------
const stepPlayerMove: Step = (p) => {
  G.time += DT;

  let [mx, my] = currentMove();
  const mlen = Math.hypot(mx, my);
  if (mlen > 1) { mx /= mlen; my /= mlen; }
  p.moving = mlen > 0;
  const spd = PLAYER.speed * G.stats.speedMult;
  if (p.moving) {
    p.x = clampNum(p.x + mx * spd * DT);
    p.z = clampNum(p.z + my * spd * DT);
    p.x = Math.max(PLAYER.radius, Math.min(WORLD_W - PLAYER.radius, p.x));
    p.z = Math.max(PLAYER.radius, Math.min(WORLD_H - PLAYER.radius, p.z));
    p.face = Math.atan2(my, mx);
    p.walkT += DT;
  }
  const tgt = nearestEnemy();
  if (tgt) p.face = Math.atan2(tgt.e.z - p.z, tgt.e.x - p.x);

  if (p.invuln > 0) p.invuln -= DT;
  if (G.flashT > 0) G.flashT -= DT;
  if (G.evolutionT > 0) G.evolutionT -= DT;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - DT * 40);
  return true;
};

// ---------- pass 2: bullets (player + enemy), pierce/ricochet/mine/sticky ----------
const stepBullets: Step = (p) => {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * DT; b.z += b.vz * DT; b.life -= DT;
    // M13 Gunk Boomer: the outbound countdown (bounces = seconds) runs out →
    // flip and come home. The return is a FRESH strike (pierce set reset), so
    // it hits again on the way back, as the weapon promises.
    if (b.kind === 'boomer' && b.dir === 1) {
      if (b.bounces) b.bounces -= DT;
      if ((b.bounces || 0) <= 0) { b.vx = -b.vx; b.vz = -b.vz; b.dir = -1; b.hitIds = []; }
    }
    if (b.life <= 0) {
      // mine (M8): fuse ran out — detonate a one-shot blast zone, then vanish
      if (b.kind === 'mine') {
        G.zones.push({ x: b.x, z: b.z, r: b.blast || 30, life: 0.3, tick: 0, dmg: b.dmg });
        G.shake = Math.max(G.shake, 5);
        sfx('pop');
      }
      G.bullets.splice(i, 1); continue;
    }
    if (b.x < 0 || b.x > WORLD_W || b.z < 0 || b.z > WORLD_H) { G.bullets.splice(i, 1); continue; }
    // enemy bullets (M7 spitter gunk): hit the PLAYER, not enemies. Whether or
    // not they connect, they skip the enemy/wall/boss/flush damage blocks.
    if (b.enemy) {
      if (Math.hypot(p.x - b.x, p.z - b.z) < PLAYER.radius + b.hitR && p.invuln <= 0) {
        p.hp -= Math.max(1, eDmg(b.dmg) - G.armor); p.invuln = PLAYER.invulnAfterHit;
        G.shake = Math.max(G.shake, 4);
        sfx('hurt');
        G.dmgNums.push({ x: p.x, z: p.z - 8, vy: -26, t: 0.8, txt: '-' + Math.max(1, Math.round(eDmg(b.dmg)) - G.armor), crit: true });
        if (p.hp <= 0) { p.hp = 0; endRun(false, false); return false; }
        G.bullets.splice(i, 1);
      }
      continue;
    }
    // visual bullets (M8 gnat beam / zap flash): pure flair, no damage blocks
    if (b.visual) continue;
    // pierce: each bullet may hit a given enemy once (or a few times for
    // piercing weapons) — a hitSet of enemy indices refreshed per-frame so a
    // bullet passing THROUGH an enemy doesn't re-damage it every frame.
    if (b.kind !== 'bouncy') {
      if (!b.hitIds) b.hitIds = [];
      if (b.hitIds.length > 12) b.hitIds.length = 0; // cheap cap: re-hit allowed after it clears
      for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
        const e = G.enemies[ei];
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + b.hitR) {
          if (b.hitIds.includes(ei)) continue;
          b.hitIds.push(ei);
          damageEnemy(e, b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
        }
      }
    } else {
      for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
        const e = G.enemies[ei];
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + b.hitR) damageEnemy(e, b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
        // bouncy: ricochet to the next-nearest enemy (VS Runetracer)
        if (b.kind === 'bouncy' && (b.bounces || 0) > 0) {
          const next = nearestEnemyExcluding(e, 120);
          if (next) {
            const a = Math.atan2(next.e.z - b.x, next.e.x - b.x);
            const spd = b.bounceSpeed || 240;
            b.vx = Math.cos(a) * spd; b.vz = Math.sin(a) * spd;
            b.bounces = (b.bounces || 0) - 1;
          } else {
            b.vx = -b.vx; b.vz = -b.vz; // no target: reflect
            b.bounces = (b.bounces || 0) - 1;
          }
        }
      }
    }
    for (let wi = G.wall.length - 1; wi >= 0; wi--) {
      const e = G.wall[wi];
      if (Math.hypot(e.x - b.x, e.z - b.z) < e.radius + b.hitR) damageWall(e, b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02, wi);
    }
    if (G.boss && Math.hypot(G.boss.x - b.x, G.boss.z - b.z) < G.boss.radius + b.hitR) hitBoss(b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
    if (G.flush && Math.hypot(G.flush.x - b.x, G.flush.z - b.z) < G.flush.radius + b.hitR) hitFlush(b.dmg, b.x - b.vx * 0.02, b.z - b.vz * 0.02);
    // stickyplop: on expiry (or wall/boss impact), spawn a lingering zone
    if (b.kind === 'stickyplop' && b.life <= 0) {
      G.zones.push({ x: b.x, z: b.z, r: 30, life: 3, tick: 0.5, dmg: b.dmg });
      b.life = 1; // keep it one more frame so the loop can splice it
      b.kind = 'expired';
    }
  }
  return true;
};

// ---------- pass 3: zones (puddles, lakes, blast aftermath, drag) ----------
const stepZones: Step = () => {
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const zn = G.zones[i];
    zn.life -= DT; zn.tick -= DT;
    if (zn.life <= 0) { G.zones.splice(i, 1); continue; }
    if (zn.tick <= 0) {
      zn.tick = 0.5;
      for (let ei = G.enemies.length - 1; ei >= 0; ei--) {
        const e = G.enemies[ei];
        const edx = zn.x - e.x, edz = zn.z - e.z;
        const ed = Math.hypot(edx, edz);
        if (ed < zn.r + e.radius) {
          damageEnemy(e, zn.dmg, zn.x, zn.z);
          // M18 Slime Lake drag: suck everything inside toward the center
          // (heavy enemies resist it like they resist knockback).
          if (zn.drag && ed > 4) {
            const pull = zn.drag * (1 - (e.kbResist || 0)) * zn.tick;
            e.x += (edx / ed) * pull; e.z += (edz / ed) * pull;
          }
        }
      }
      for (let wi = G.wall.length - 1; wi >= 0; wi--) {
        const e = G.wall[wi];
        if (Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r + e.radius) damageWall(e, zn.dmg, zn.x, zn.z, wi);
      }
      if (G.boss && Math.hypot(G.boss.x - zn.x, G.boss.z - zn.z) < zn.r + G.boss.radius) hitBoss(zn.dmg, zn.x, zn.z);
      if (G.flush && Math.hypot(G.flush.x - zn.x, G.flush.z - zn.z) < zn.r + G.flush.radius) hitFlush(zn.dmg, zn.x, zn.z);
    }
  }
  return true;
};

// ---------- pass 4: dropped turrets (M13) ----------
// M13 Plop Turrets: stationary, each acquires the nearest enemy within 220u
// and fires plops on its own rate. They expire (life) — dropped turrets are
// a tempo weapon, not a permanent base (VS: your drops have a window).
const stepTurrets: Step = () => {
  for (let i = G.turrets.length - 1; i >= 0; i--) {
    const tu = G.turrets[i];
    tu.life -= DT;
    if (tu.life <= 0) { G.turrets.splice(i, 1); continue; }
    tu.cd -= DT;
    if (tu.cd > 0) continue;
    let t: Enemy | null = null, bd = 220;
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - tu.x, e.z - tu.z);
      if (d < bd) { bd = d; t = e; }
    }
    if (!t) { tu.cd = 0.1; continue; }
    tu.cd = tu.rate;
    const a = Math.atan2(t.z - tu.z, t.x - tu.x);
    tu.angle = a;
    const spd = wProjSpeed(200);
    for (let k = 0; k < tu.spread; k++) {
      const aa = a + (k - (tu.spread - 1) / 2) * 0.2;
      G.bullets.push({ x: tu.x, z: tu.z, vx: Math.cos(aa) * spd, vz: Math.sin(aa) * spd, life: 1.2, dmg: tu.dmg, ang: aa, hitR: wArea(3), kind: 'plop' });
    }
  }
  return true;
};

// ---------- pass 5: enemies (chase, spitter band, contact damage) ----------
const stepEnemies: Step = (p) => {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.wob += DT * 6;
    if (e.hitT > 0) e.hitT -= DT;
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    if (e.kind === 'spitter') {
      // spitter (M7): holds its distance band — close in if far, back off if
      // tight, strafe while in band — and lobs gunk shots at the player
      let vx = 0, vz = 0;
      if (d > 110) { vx = (dx / d) * e.speed; vz = (dz / d) * e.speed; }
      else if (d < 60) { vx = -(dx / d) * e.speed; vz = -(dz / d) * e.speed; }
      else {
        const side = Math.sin(e.wob * 0.35) > 0 ? 1 : -1;
        vx = (-dz / d) * e.speed * side; vz = (dx / d) * e.speed * side;
      }
      e.x += (vx + e.kbx) * DT; e.z += (vz + e.kbz) * DT;
      e.spitCd = (e.spitCd === undefined ? 3 : e.spitCd) - DT;
      if (e.spitCd <= 0 && d < 280) {
        e.spitCd = 2.4 + G.rng();
        G.bullets.push({ x: e.x, z: e.z, vx: (dx / d) * 130, vz: (dz / d) * 130, life: 3, dmg: 9, ang: Math.atan2(dz, dx), hitR: 4, kind: 'gunk', enemy: true });
      }
    } else {
      e.x += ((dx / d) * e.speed + e.kbx) * DT;
      e.z += ((dz / d) * e.speed + e.kbz) * DT;
    }
    const kd = Math.exp(-4 * DT);
    e.kbx *= kd; e.kbz *= kd;
    if (d < e.radius + PLAYER.radius && p.invuln <= 0) {
      p.hp -= Math.max(1, eDmg(e.dmg) - G.armor); p.invuln = PLAYER.invulnAfterHit;
      G.shake = 6; G.flashT = Math.max(G.flashT, 0.12);
      sfx('hurt'); // the player takes damage — distinct from the enemy 'hit' clatter
      G.dmgNums.push({ x: p.x, z: p.z - 8, vy: -26, t: 0.8, txt: '-' + Math.max(1, Math.round(eDmg(e.dmg)) - G.armor), crit: true });
      if (p.hp <= 0) { p.hp = 0; endRun(false, false); return false; }
    }
  }
  return true;
};

// ---------- pass 6: boss schedule + boss behavior ----------
const stepBoss: Step = (p) => {
  // boss schedule (M3): spawn the next scheduled boss when its time arrives
  if (!G.boss && G.bossIdx < BOSS_SCHEDULE.length && G.time >= BOSS_SCHEDULE[G.bossIdx].t) {
    const ev = BOSS_SCHEDULE[G.bossIdx];
    spawnBoss(ev.kind, ev.name);
    G.bossIdx++;
    if (ev.kind === 'constipation') spawnSpasmWall(); // 15:00: the wall closes in
  }
  if (G.boss) {
    const b = G.boss;
    b.wob += DT * 4;
    if (b.hitT > 0) b.hitT -= DT;
    const dx = p.x - b.x, dz = p.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    // per-kind behavior
    if (b.kind === 'express') {
      // The Diarrhea Express: telegraphed charges — pause 0.6s (aim), then
      // dash 1.0s in a LOCKED direction (can't turn mid-dash → dodgeable)
      b.chargeCd -= DT;
      if (b.chargeCd <= 0) { b.chargeCd = 3; b.dashT = 1.2; b.aimT = 0.6; }
      if (b.aimT > 0) {
        // aim: hold position (telegraph), face the player
        b.aimT -= DT;
        b.lockAng = Math.atan2(p.z - b.z, p.x - b.x);
      } else if (b.dashT > 0) {
        b.dashT -= DT;
        b.x += Math.cos(b.lockAng) * b.speed * 2.4 * DT;
        b.z += Math.sin(b.lockAng) * b.speed * 2.4 * DT;
      } else {
        b.x += (dx / d) * b.speed * 0.3 * DT;
        b.z += (dz / d) * b.speed * 0.3 * DT;
      }
    } else if (b.kind === 'sphincter') {
      // Mr. Sphincter: phase 2 at 50% HP — clamps down (speed burst) + shockwaves
      if (!b.phase2 && b.hp < b.maxHp * 0.5) { b.phase2 = true; G.shake = 12; G.flashT = 0.4; }
      const spd = b.phase2 ? b.speed * 1.6 : b.speed;
      b.x += (dx / d) * spd * DT; b.z += (dz / d) * spd * DT;
      if (b.phase2 && b.chargeCd <= 0) {
        b.chargeCd = 2.5;
        // shockwave: ring of damage zones around the boss
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          G.zones.push({ x: b.x + Math.cos(a) * 30, z: b.z + Math.sin(a) * 30, r: 24, life: 1.5, tick: 0.5, dmg: 10 });
        }
      }
    } else if (b.kind === 'lintking') {
      // THE LINT KING (M7): a slow fluff tank that sheds lint; at 50% HP it
      // RAGES — faster, gunk rings, and spitter minions in pairs
      if (!b.phase2 && b.hp < b.maxHp * 0.5) { b.phase2 = true; G.shake = 10; G.flashT = 0.4; sfx('boss'); }
      const spd = b.phase2 ? b.speed * 1.4 : b.speed;
      b.x += (dx / d) * spd * DT; b.z += (dz / d) * spd * DT;
      if (b.chargeCd <= 0) {
        b.chargeCd = b.phase2 ? 3.5 : 6;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + b.wob;
          G.bullets.push({ x: b.x, z: b.z, vx: Math.cos(a) * 100, vz: Math.sin(a) * 100, life: 2.5, dmg: 10, ang: a, hitR: 4, kind: 'gunk', enemy: true }); // M12: 12→10 (see GDD §25)
        }
        if (b.phase2 && G.enemies.length < 40) { spawnEnemy('spitter'); spawnEnemy('spitter'); }
      }
    } else {
      b.x += (dx / d) * b.speed * DT;
      b.z += (dz / d) * b.speed * DT;
    }
    b.minionCd -= DT;
    if (b.minionCd <= 0 && G.enemies.length < 40) { b.minionCd = 8; spawnEnemy(pickKind()); }
    if (d < b.radius + PLAYER.radius && p.invuln <= 0) {
      p.hp -= Math.max(1, eDmg(b.dmg) - G.armor); p.invuln = PLAYER.invulnAfterHit;
      G.shake = 10; G.flashT = 0.2;
      sfx('hurt');
      G.dmgNums.push({ x: p.x, z: p.z - 10, vy: -26, t: 0.9, txt: '-' + Math.max(1, Math.round(eDmg(b.dmg)) - G.armor), crit: true });
      if (p.hp <= 0) { p.hp = 0; endRun(false, false); return false; }
    }
  }
  return true;
};

// ---------- pass 7: THE FINAL FLUSH ----------
// THE FINAL FLUSH (30:00): spawns at RUN_LEN; killable → victory+gold, touch → flushed
// The flush hp does NOT time-scale (unlike bosses) — a 30:00 player's build
// must be able to kill it in ~8s of contact window, so it stays flat.
const stepFlush: Step = (p) => {
  if (!G.flush && G.time >= RUN_LEN && !G.flushResolved) {
    const st = BOSS_STATS.flush;
    G.flush = {
      x: Math.max(20, Math.min(WORLD_W - 20, G.player.x + Math.cos(0) * 240)),
      z: Math.max(20, Math.min(WORLD_H - 20, G.player.z + Math.sin(0) * 240)),
      hp: st.hp, maxHp: st.hp, speed: st.speed, dmg: st.dmg, radius: st.radius, hitT: 0, wob: 0,
    };
    sfx('boss');
    G.shake = 14; G.flashT = 0.6;
  }
  if (G.flush) {
    const f = G.flush;
    if (f.hitT > 0) f.hitT -= DT;
    const dx = p.x - f.x, dz = p.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    f.x += (dx / d) * f.speed * DT;
    f.z += (dz / d) * f.speed * DT;
    if (d < f.radius + PLAYER.radius) {
      // touched → flushed ending
      endRun(false, true);
      return false;
    }
  }
  return true;
};

// ---------- pass 8: spasm wall (15:00 constipation) ----------
// Spasm Wall update: the slow ring of tanky enemies closing around the player
const stepWall: Step = (p) => {
  if (G.wall.length > 0) {
    for (let i = G.wall.length - 1; i >= 0; i--) {
      const e = G.wall[i];
      const dx = p.x - e.x, dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      e.x += (dx / d) * e.speed * DT;
      e.z += (dz / d) * e.speed * DT;
      if (d < e.radius + PLAYER.radius && p.invuln <= 0) {
        p.hp -= Math.max(1, eDmg(e.dmg) - G.armor); p.invuln = PLAYER.invulnAfterHit;
        G.shake = 6;
        sfx('hurt');
        if (p.hp <= 0) { p.hp = 0; endRun(false, false); return false; }
      }
    }
  }
  return true;
};

// ---------- pass 9: pickups (chest + stage items) ----------
const stepPickups: Step = (p) => {
  // chest pickup
  if (G.chest && Math.hypot(G.chest.x - p.x, G.chest.z - p.z) < 14) resolveChest();
  // stage items pickup
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    if (Math.hypot(it.x - p.x, it.z - p.z) < PLAYER.radius + 8) {
      if (it.kind === 'gold') { G.gold += Math.round(30 * G.stats.goldMult); }
      else { G.player.hp = Math.min(G.stats.maxHp, G.player.hp + 30); }
      G.items.splice(i, 1);
      G.stats.itemTaken++;
      G.flashT = Math.max(G.flashT, 0.15);
      sfx('pickup'); // stage-item pickup blip (gold bag / donut)
    }
  }
  return true;
};

// ---------- pass 10: spawn director (script density + waves + spikes) ----------
// spawn director (M3): script density + wave bursts + spikes
// M13 density pass (human feedback: "way more enemies, bigger waves"): the
// ambient interval falls faster and floors lower (1.1/0.25 → 0.85/0.18),
// wave bursts grow faster and hit a 45 cap, field cap 260 → 380. The
// balance gate's analytic spawnRate (test/balance.mjs) mirrors the ambient.
const stepDirector: Step = () => {
  G.spawnCd -= DT;
  G.spawnInterval = Math.max(0.18, 0.85 - G.time / 260);
  if (G.spawnCd <= 0) { spawnEnemy(pickKind()); G.spawnCd = G.spawnInterval; }
  // music intensity follows the pressure curve (density → louder/heavier)
  musicIntensity(Math.min(1.6, 0.4 + G.enemies.length / 120 + (G.boss ? 0.4 : 0)));
  // wave bursts: absolute schedule — 1:00, then every 2 min, size grows.
  // M10k: no fresh wave into the LINT KING gauntlet (27:00+) — the M10k4 gate
  // (test/balance.mjs) measured all 8 deaths at 1646–1749s (the LINT KING
  // window), and the 1620s + 1740s waves (30 enemies each) burst *into* that
  // boss fight on top of max-rate ambient + spikes + the rage. A human boss
  // fight doesn't add a 30-enemy wave; the rest of the director (waves
  // < 27:00, spikes, ambient) is untouched.
  const waveNext = Math.floor((G.time - 60) / 120) + 1;
  if (G.time >= 60 && G.time < 1620 && G.waveIdx < waveNext) {
    G.waveIdx = waveNext;
    let size = 12 + Math.floor(G.time / 60) * 3; // M13: 8+2/min → 12+3/min
    size = Math.round(size * (STAGES[G.stage]?.waveMult || 1)); // M21: sewers ×1.25 (kitchen/others ×1 — untouched)
    spawnWave(Math.min(45, size)); // M13: cap 30 → 45
  }
  // density spike: 30s of doubled spawn rate (first at 12:00, every 2 min after)
  const spikeActive = G.time >= SPIKE_T && ((G.time - SPIKE_T) % SPIKE_EVERY) < 30;
  if (spikeActive && G.spawnCd > 0.18) { G.spawnCd = 0.18; } // M13: floor 0.25 → 0.18
  if (G.enemies.length > 380) G.enemies.splice(0, G.enemies.length - 380); // M13: cap 260 → 380
  // stage items: absolute schedule — 2:30, then every 2.5 min
  const itemNext = Math.floor((G.time - 150) / 150) + 1; // index of next item slot
  if (G.time >= 150 && G.itemIdx < itemNext) { G.itemIdx = itemNext; spawnItem(); }
  return true;
};

// ---------- pass 11: gems (magnet + pickup + XP) ----------
const stepGems: Step = (p) => {
  const magnetR = PLAYER.magnetBase * (1 + (CHARACTERS[G.char]?.magnetBonus || 0)) + (G.level - 1) * PLAYER.magnetPerLevel;
  for (let i = G.gems.length - 1; i >= 0; i--) {
    const g = G.gems[i];
    const dx = p.x - g.x, dz = p.z - g.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < magnetR) g.pulled = true;
    if (g.pulled) { g.x += (dx / d) * 160 * DT; g.z += (dz / d) * 160 * DT; }
    else { g.x += g.vx * DT; g.z += g.vz * DT; g.vx *= 0.9; g.vz *= 0.9; }
    if (d < PLAYER.radius + 3) { G.gems.splice(i, 1); G.stats.gems++; fxGem(g.x, g.z); gainXp(g.val * G.stats.xpMult); sfx('gem'); }
  }
  return true;
};

// ---------- pass 12: damage numbers + run clock ----------
const stepFxAndClock: Step = () => {
  for (let i = G.dmgNums.length - 1; i >= 0; i--) {
    const n = G.dmgNums[i]; n.z += n.vy * DT; n.t -= DT;
    if (n.t <= 0) G.dmgNums.splice(i, 1);
  }
  if (G.time >= RUN_LEN) endRun(true, false);
  return true;
};

const stepFire: Step = () => { fireWeapons(); return true; };

// ---------- the pipeline (order FROZEN by test/fingerprint.mjs) ----------
const PASSES: Step[] = [
  stepPlayerMove,
  stepFire, // M20 registry dispatch (fireWeapons ticks every weapon's cd itself)
  stepBullets,
  stepZones,
  stepTurrets,
  stepEnemies,
  stepBoss,
  stepFlush,
  stepWall,
  stepPickups,
  stepDirector,
  stepGems,
  stepFxAndClock,
];

export function update(): void {
  stepInput();
  if (G.mode !== 'play') { if (G.evolutionT > 0) G.evolutionT -= DT; return; }
  if (paused) return;
  const p = G.player;
  for (const pass of PASSES) {
    if (!pass(p)) return; // run ended mid-pass (old mid-function returns)
  }
}
