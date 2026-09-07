// M19 phase 2: canvas module — moved verbatim from main.ts.

import { VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './constants';
import { G } from './game';
import { COARSE } from './input';

export const canvasEl = (document.getElementById('c') as HTMLCanvasElement);

export const canvas = (document.getElementById('c') as HTMLCanvasElement);

export const ctx = canvas.getContext('2d')!;

export let CANVAS_SCALE = 1;

export const fxEl = document.getElementById('fx') as HTMLCanvasElement | null;

export function fitCanvas(): void {
  let scale: number;
  if (COARSE) {
    // M6: phones letterbox FILL — integer scale leaves a 320x240 island on a
    // 844x390 screen. Non-integer here (pixelated rendering keeps it crisp
    // enough); aspect-preserved by the min().
    scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  } else {
    scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  }
  CANVAS_SCALE = scale;
  canvas.width = VIEW_W; canvas.height = VIEW_H;
  canvas.style.width = Math.round(VIEW_W * scale) + 'px';
  canvas.style.height = Math.round(VIEW_H * scale) + 'px';
  // M15: the FX overlay matches the game canvas's displayed size 1:1 (its
  // internal buffer stays 320x240 — 1 canvas px = 1 view unit, same mapping
  // as #c — so CSS scaling keeps the two layers perfectly registered).
  if (fxEl) {
    fxEl.style.width = Math.round(VIEW_W * scale) + 'px';
    fxEl.style.height = Math.round(VIEW_H * scale) + 'px';
  }
}

export function camX(): number { return Math.max(0, Math.min(WORLD_W - VIEW_W, G.player.x - VIEW_W / 2)); }

export function camY(): number { return Math.max(0, Math.min(WORLD_H - VIEW_H, G.player.z - VIEW_H / 2)); }

export function clientToView(cx: number, cy: number): { x: number; z: number } {
  const r = canvasEl.getBoundingClientRect();
  return { x: (cx - r.left) / CANVAS_SCALE, z: (cy - r.top) / CANVAS_SCALE };
}
// M6 fix: cursor view pos → WORLD pos via the camera. The pre-M6 code compared
// the cursor's VIEW coords (0..320) against the player's WORLD coords
// (0..1280), so walk-toward-cursor skewed up-left, worse the farther the
// player was from the world's top-left corner.

export function clientToWorld(cx: number, cy: number): { x: number; z: number } {
  const v = clientToView(cx, cy);
  return { x: camX() + v.x, z: camY() + v.z };
}

export function toggleFullscreen(): void {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void; webkitExitFullscreen?: () => void };
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
  const isFs = !!(document.fullscreenElement || doc.webkitFullscreenElement);
  try {
    if (isFs) { if (document.exitFullscreen) document.exitFullscreen(); else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen(); }
    else if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch { /* fullscreen denied (no gesture / unsupported) — keep the letterbox */ }
}

document.addEventListener('fullscreenchange', fitCanvas);
