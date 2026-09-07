// M19 phase 2: input module — moved verbatim from main.ts.

import { setMuteMsgT, setPaused, setSelectedChar } from './game';

import { canvasEl, clientToView, clientToWorld, toggleFullscreen } from './canvas';
import { STICK_R, VIEW_H } from './constants';
import { G, buyUpgrade, cycleStage, muteMsgT, paused, selectedChar, startRun } from './game';
import { pickOption } from './levelup';
import { META } from './meta';
import { shopRowY } from './overlays';
import { sfx, toggleMute } from './sfx';
import { CHARACTERS, UPGRADES } from './tables/chars';

export const keys = new Set<string>();

export let _prevKeys = new Set<string>();

export let _nowKeys = new Set<string>();

export let botDir = { x: 0, y: 0 };

export function syncKeys() { _prevKeys = _nowKeys; _nowKeys = new Set(keys); }

export function justPressed(k: string): boolean { return _nowKeys.has(k) && !_prevKeys.has(k); }

export function keyIndex(...ks: string[]): number {
  for (let i = 0; i < ks.length; i++) if (justPressed(ks[i])) return i;
  return -1;
}
// ---------- mouse/touch input ----------
// mouse LMB / touch hold (upper half) = walk toward the pointer.
// M6 touch (lower half of the view) = FLOATING THUMBSTICK: the base spawns
// where the finger lands, drag = analog move vector (prisma-panic M12 pattern).
// Touch also TAPS: level-up options, and title/dead/win screens start a run.

export const COARSE = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; // phone/tablet

export let pointerHeld = false;

export let pointerWorld: { x: number; z: number } | null = null;

export let stick = { active: false, id: -1, bx: 0, bz: 0, x: 0, z: 0 };

export function stickMove(e: PointerEvent): void {
  const v = clientToView(e.clientX, e.clientY);
  let dx = v.x - stick.bx, dz = v.z - stick.bz;
  const len = Math.hypot(dx, dz);
  if (len > STICK_R) { dx = dx * STICK_R / len; dz = dz * STICK_R / len; }
  stick.x = dx / STICK_R; stick.z = dz / STICK_R;
}
// M13 fullscreen: a phone run should own the whole screen (the pre-M13
// letterbox left dead browser chrome around the play area). Fullscreen API
// with the iOS/Safari webkit prefix fallback; must be called from a user
// gesture (button tap / key press), which both paths are.

export function endPointer(e: PointerEvent): void {
  if (stick.active && e.pointerId === stick.id) {
    stick.active = false; stick.id = -1; stick.x = 0; stick.z = 0;
  }
  pointerHeld = false; pointerWorld = null;
}

export function currentMove(): [number, number] {
  if (stick.active && (stick.x !== 0 || stick.z !== 0)) return [stick.x, stick.z];
  if (pointerHeld && pointerWorld) {
    // walk toward the cursor: direction from player to pointer world pos
    const dx = pointerWorld.x - G.player.x, dz = pointerWorld.z - G.player.z;
    const d = Math.hypot(dx, dz);
    if (d > 3) return [dx / d, dz / d];
    return [0, 0];
  }
  if (botDir.x !== 0 || botDir.y !== 0) return [botDir.x, botDir.y];
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  return [x, y];
}

// ---------- level up (VS rules, simplified) ----------

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  keys.add(k);
});

window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

canvasEl.addEventListener('pointerdown', (e: PointerEvent) => {
  const v = clientToView(e.clientX, e.clientY);
  // M11 mobile: pause / mute buttons, top-center under the timer (the only
  // free strip in play mode — the corners hold LV/XP and HP/gold). Checked
  // before the stick logic so a tap on one doesn't spawn the stick or walk.
  if (COARSE && G.mode === 'play' && v.z >= 12 && v.z < 28) {
    if (v.x >= 136 && v.x < 156) { setPaused(!paused); sfx('pop'); e.preventDefault(); return; }
    if (v.x >= 160 && v.x < 180) { const on = toggleMute(); G.flashT = 0.2; setMuteMsgT(on ? 0 : 1.4); e.preventDefault(); return; }
    if (v.x >= 184 && v.x < 204) { toggleFullscreen(); sfx('pop'); e.preventDefault(); return; } // M13
  }
  // M11 mobile: the title-screen shop rows are tap targets — a tap on a row
  // buys that upgrade, anywhere else on the title starts the run. The CH /
  // STAGE lines also tap-cycle (a phone had no way to pick before). Zones are
  // tuned to the drawTitle row baselines (152 CH, 164 STAGE, 174 header,
  // 188+i*10 shop) so a tap on a row never leaks into the one above.
  if (COARSE && G.mode === 'title') {
    for (let i = 0; i < UPGRADES.length; i++) {
      if (v.z >= shopRowY(i) - 4 && v.z < shopRowY(i) + 7) { buyUpgrade(UPGRADES[i].id); e.preventDefault(); return; }
    }
    const chars = Object.keys(CHARACTERS);
    if (v.z >= 150 && v.z < 161) {
      for (let i = 0; i < chars.length; i++) {
        const id = chars[i];
        if (id === selectedChar) {
          const nid = chars[(i + 1) % chars.length];
          if (CHARACTERS[nid].unlock === 'default' || META.unlocked.includes(CHARACTERS[nid].unlock)) setSelectedChar(nid);
          break;
        }
      }
      sfx('pop'); e.preventDefault(); return;
    }
    if (v.z >= 162 && v.z < 173 && v.x > 112) {
      cycleStage(); sfx('pop'); // M13: 3-stage cycle (kitchen→bathroom→compost)
      e.preventDefault(); return;
    }
  }
  if (COARSE && G.mode === 'play' && v.z > VIEW_H / 2 && !stick.active) {
    // M6 thumbstick: lower half of the view, touch only
    stick.active = true; stick.id = e.pointerId;
    stick.bx = v.x; stick.bz = v.z; stick.x = 0; stick.z = 0;
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* headless CDP pointers may reject capture — movement still routes while the finger stays inside */ }
    stickMove(e);
    e.preventDefault();
    return;
  }
  pointerHeld = true;
  pointerWorld = clientToWorld(e.clientX, e.clientY); // walk target in WORLD space
  if (G.mode === 'levelup') {
    // tap the option row (mobile level-up) — the row is laid out in VIEW space
    const rowH = 44, top = 36;
    const idx = Math.floor((v.z - top) / rowH);
    if (idx >= 0 && idx < G.options.length) { pickOption(idx); pointerHeld = false; return; }
  } else if (COARSE && (G.mode === 'title' || G.mode === 'dead' || G.mode === 'win')) {
    startRun(G.seed); // M6: tap to (re)start
  }
  e.preventDefault();
});

canvasEl.addEventListener('pointermove', (e: PointerEvent) => {
  if (stick.active && e.pointerId === stick.id) { stickMove(e); e.preventDefault(); return; }
  if (!pointerHeld) return;
  pointerWorld = clientToWorld(e.clientX, e.clientY);
});

window.addEventListener('pointerup', endPointer);

window.addEventListener('pointercancel', endPointer);

canvasEl.style.touchAction = 'none';
export function setBotDir(v: any): void { botDir = v; }
