// POOP SURVIVORS — M15 WebGL2 FX pass (GDD Q2 locked decision, 2026-08-31).
// GPU-rendered additive particles + shockwave rings on a canvas OVERLAY
// (z-ordered above the game canvas, same 320x240 view units, same camera).
//
// Architecture (per Q2): the game logic (src/main.ts) stays pure CPU + fixed
// timestep and only EMITS events into this module's queue (fxKill/fxGem/...).
// The particle sim ages on the rAF WALL clock, never on the game DT — a
// frozen run (m1 determinism test) and a stepped soak trajectory are
// byte-identical with or without the FX layer. If WebGL2 is unavailable
// (headless chromium, older phones) every call is a counted no-op and the
// game plays exactly as pre-M15. The event queue itself always works, so
// a test can prove the game emitted the event even without a GPU.
//
// One draw call: a single interleaved buffer. Particles are POINTS
// (gl_PointSize), rings are 4-corner TRIANGLE_STRIP quads whose corners are
// baked world-space on the CPU; the band is computed in the fragment shader
// from per-fragment world distance to the ring center. Canvas is 320x240
// (1 view unit = 1 canvas px, CSS scales it pixelated like the game).

export interface FXState { supported: boolean; particles: number; rings: number; pending: number; emitted: number; glErrors: number; counts: Record<string, number>; }

interface P { x: number; z: number; vx: number; vz: number; life: number; max: number; size: number; c: [number, number, number]; }
interface R { x: number; z: number; rad: number; v: number; life: number; max: number; c: [number, number, number]; }

const MAX_P = 240;
const MAX_R = 10;
const ps: P[] = [];
const rs: R[] = [];
// events emitted since the last rendered frame — the __cap probe reads this
let pending = 0;
// lifetime emission count (never reset except fxReset) — works even without a
// GPU: proves the deterministic game logic EMITTED the FX events (Q2: the
// event queue is the contract; rendering is cosmetic on top).
let emitted = 0;
// GL errors observed on a rendered frame — the __cap probe exposes this so a
// suite can assert "no GL errors" (a shader/link/attr mistake must not ride
// a 30-min soak undetected just because it didn't throw).
let glErrors = 0;
// per-event-type emission counts (kill/gem/levelup/evolve/bosskill/flushkill)
// — the __cap probe exposes these so a suite can assert a SPECIFIC path fired
// exactly once regardless of background events (a boss sheds minions the test
// ring kills, and those stray fxKill events would pollute a total-emitted
// assertion).
const counts: Record<string, number> = {};

// palette-true colors (GDD Q3: the 16-color shared palette)
const GOLD: [number, number, number] = [0.85, 0.60, 0.17];    // #d99a2b
const CREAM: [number, number, number] = [0.95, 0.89, 0.72];   // #f3e2b8
const GREEN: [number, number, number] = [0.49, 0.88, 0.51];   // #7ee081
const WHITE: [number, number, number] = [1, 1, 1];            // #ffffff
const ICE: [number, number, number] = [0.81, 0.90, 1.0];      // #cfe8ff
const BLUE: [number, number, number] = [0.35, 0.66, 0.90];    // #5aa9e6

let gl: WebGL2RenderingContext | null = null;
let supported = false;
let prog: WebGLProgram | null = null;
let buf: WebGLBuffer | null = null;
let uniCam: WebGLUniformLocation | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let lastNow = 0;

const VS = `#version 300 es
layout(location=0) in vec2 a_pos;    // world (x,z): particle center / ring corner
layout(location=1) in float a_size;  // point px | ring outer radius (world)
layout(location=2) in vec3 a_col;
layout(location=3) in float a_life;  // life/max, 1 -> 0
layout(location=4) in float a_kind;  // 0 particle, 1 ring
layout(location=5) in vec2 a_center; // ring center (world); unused for points
uniform vec2 u_cam;
out vec3 v_col; out float v_life; out float v_kind;
out vec2 v_wpos; out vec2 v_center; out float v_size;
void main() {
  v_col = a_col; v_life = a_life; v_kind = a_kind;
  v_wpos = a_pos; v_center = a_center; v_size = a_size;
  // world (x,z) -> NDC. The game canvas maps world px (cx,cy) to canvas px
  // (0,0) with +z DOWN (canvas convention); NDC +y is UP, so flip y or every
  // particle moves vertically backwards relative to the sprites below it.
  vec2 view = (a_pos - u_cam) / vec2(320.0, 240.0) * 2.0 - 1.0;
  view.y = -view.y;
  gl_Position = vec4(view, 0.0, 1.0);
  if (a_kind < 0.5) gl_PointSize = a_size;
}
`;
const FS = `#version 300 es
precision mediump float;
in vec3 v_col; in float v_life; in float v_kind;
in vec2 v_wpos; in vec2 v_center; in float v_size;
out vec4 o;
void main() {
  if (v_kind < 0.5) {
    // soft round point, additive
    float d = length(gl_PointCoord - vec2(0.5));
    float m = smoothstep(0.5, 0.1, d);
    o = vec4(v_col * (v_life * 1.6), v_life * m);
  } else {
    // shockwave ring: a bright band at the current radius, fading with life
    float dist = distance(v_wpos, v_center);
    float band = smoothstep(5.0, 0.5, abs(dist - v_size));
    o = vec4(v_col * (v_life * 1.3), v_life * band * 0.8);
  }
}
`;

function initFX(): void {
  if (supported || gl) return;
  try {
    canvasEl = document.getElementById('fx') as HTMLCanvasElement | null;
    if (!canvasEl) return;
    canvasEl.width = 320; canvasEl.height = 240;
    const g = canvasEl.getContext('webgl2', {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: 'low-power',
    }) as WebGL2RenderingContext | null;
    if (!g) return;
    const mk = (type: number, src: string): WebGLShader | null => {
      const sh = g.createShader(type)!;
      g.shaderSource(sh, src); g.compileShader(sh);
      if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
        console.warn('fx: shader', g.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const v = mk(g.VERTEX_SHADER, VS), f = mk(g.FRAGMENT_SHADER, FS);
    if (!v || !f) return;
    const p = g.createProgram()!;
    g.attachShader(p, v); g.attachShader(p, f); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) {
      console.warn('fx: link', g.getProgramInfoLog(p));
      return;
    }
    gl = g; prog = p;
    buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    uniCam = g.getUniformLocation(p, 'u_cam');
    g.disable(g.DEPTH_TEST);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE); // additive, premultiplied
    g.clearColor(0, 0, 0, 0);
    g.viewport(0, 0, 320, 240);
    supported = true;
  } catch {
    gl = null; supported = false;
  }
}

// draw layout per vertex: x,z | size | col(3) | life | kind | center(2) = 10 f
const VSTRIDE = 10 * 4;
function setupAttribs(g: WebGL2RenderingContext): void {
  const attrs: [number, number, number][] = [[0, 2, 0], [1, 1, 8], [2, 3, 12], [3, 1, 24], [4, 1, 28], [5, 2, 32]];
  for (const [loc, size, off] of attrs) {
    g.enableVertexAttribArray(loc);
    g.vertexAttribPointer(loc, size, g.FLOAT, false, VSTRIDE, off);
  }
}

export function fxTick(nowMs: number): void {
  try {
    if (!ps.length && !rs.length) { lastNow = nowMs; return; }
    const dt = Math.min(0.1, lastNow ? (nowMs - lastNow) / 1000 : 0.016);
    lastNow = nowMs;
    if (dt <= 0) return;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.z += p.vz * dt;
      const drag = Math.pow(0.15, dt);
      p.vx *= drag; p.vz *= drag;
    }
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      r.life -= dt;
      if (r.life <= 0) { rs.splice(i, 1); continue; }
      r.rad += r.v * dt;
    }
  } catch {
    // FX is cosmetic on top of the pure CPU sim (Q2) — it must never throw
    // out of frame() and trip the gate's console check.
  }
}

export function fxDraw(camx: number, camy: number): void {
  initFX();
  const g = gl;
  if (!g || !prog || !buf) return;
  try {
    if (g.isContextLost()) { supported = false; gl = null; prog = null; buf = null; return; }
    g.clear(g.COLOR_BUFFER_BIT);
    if (!ps.length && !rs.length) { pending = 0; return; }
    const n = ps.length + rs.length * 4;
    const data = new Float32Array(n * 10);
    let o = 0;
    for (const p of ps) {
      data[o++] = p.x; data[o++] = p.z; data[o++] = p.size;
      data[o++] = p.c[0]; data[o++] = p.c[1]; data[o++] = p.c[2];
      data[o++] = p.life / p.max; data[o++] = 0;
      data[o++] = p.x; data[o++] = p.z;
    }
    for (const r of rs) {
      const half = r.rad + 6; // quad must extend PAST the band (5u wide) or
      // the smoothstep band lands outside the fragment area and the ring is invisible
      const life = r.life / r.max;
      const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [sx, sy] of corners) {
        data[o++] = r.x + sx * half; data[o++] = r.z + sy * half;
        data[o++] = r.rad;
        data[o++] = r.c[0]; data[o++] = r.c[1]; data[o++] = r.c[2];
        data[o++] = life; data[o++] = 1;
        data[o++] = r.x; data[o++] = r.z;
      }
    }
    g.useProgram(prog);
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, data, g.DYNAMIC_DRAW);
    setupAttribs(g);
    g.uniform2f(uniCam!, camx, camy);
    g.drawArrays(g.POINTS, 0, ps.length);
    g.drawArrays(g.TRIANGLE_STRIP, ps.length, rs.length * 4);
    if (g.getError() !== g.NO_ERROR) glErrors++;
    pending = 0; // consumed by a rendered frame
  } catch {
    // cosmetic layer — never throw out of frame() (gate console check).
  }
}

function addP(x: number, z: number, vx: number, vz: number, life: number, size: number, c: [number, number, number]): void {
  if (ps.length >= MAX_P) ps.shift();
  ps.push({ x, z, vx, vz, life, max: life, size, c });
}
function addR(x: number, z: number, r0: number, v: number, life: number, c: [number, number, number]): void {
  if (rs.length >= MAX_R) rs.shift();
  rs.push({ x, z, rad: r0, v, life, max: life, c });
}

// ---------- public event API (called from the deterministic game logic) ----------
function emit(type: string): void { pending++; emitted++; counts[type] = (counts[type] || 0) + 1; }
export function fxKill(x: number, z: number): void {
  emit('kill');
  if (!supported) return;
  const n = 3 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = 18 + Math.random() * 42;
    addP(x, z, Math.cos(a) * s, Math.sin(a) * s, 0.28 + Math.random() * 0.22, 1.5 + Math.random() * 1.5, Math.random() < 0.6 ? GREEN : GOLD);
  }
}
export function fxGem(x: number, z: number): void {
  emit('gem');
  if (!supported) return;
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * 6.283, s = 8 + Math.random() * 18;
    addP(x, z, Math.cos(a) * s, Math.sin(a) * s - 22, 0.35 + Math.random() * 0.2, 1.2 + Math.random() * 1.2, GOLD);
  }
}
export function fxLevelUp(x: number, z: number): void {
  emit('levelup');
  if (!supported) return;
  addR(x, z, 6, 90, 0.5, GOLD);
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.283, s = 24 + Math.random() * 46;
    addP(x, z, Math.cos(a) * s, Math.sin(a) * s - 30, 0.5 + Math.random() * 0.3, 1.6 + Math.random() * 1.6, Math.random() < 0.5 ? GOLD : CREAM);
  }
}
export function fxEvolve(x: number, z: number): void {
  emit('evolve');
  if (!supported) return;
  addR(x, z, 10, 150, 0.7, WHITE);
  addR(x, z, 4, 90, 0.9, GOLD);
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.283, s = 40 + Math.random() * 80;
    addP(x, z, Math.cos(a) * s, Math.sin(a) * s, 0.7 + Math.random() * 0.4, 2 + Math.random() * 2, Math.random() < 0.4 ? WHITE : GOLD);
  }
}
export function fxBossKill(x: number, z: number): void {
  emit('bosskill');
  if (!supported) return;
  addR(x, z, 16, 240, 0.8, WHITE);
  addR(x, z, 6, 140, 1.0, GOLD);
  addR(x, z, 2, 80, 1.2, CREAM);
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * 6.283, s = 50 + Math.random() * 110;
    addP(x, z, Math.cos(a) * s, Math.sin(a) * s, 0.8 + Math.random() * 0.5, 2 + Math.random() * 2.5, Math.random() < 0.3 ? WHITE : GOLD);
  }
}
export function fxFlushKill(x: number, z: number): void {
  emit('flushkill');
  if (!supported) return;
  addR(x, z, 18, 260, 0.9, ICE);
  addR(x, z, 8, 150, 1.1, BLUE);
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * 6.283, s = 50 + Math.random() * 120;
    addP(x, z, Math.cos(a) * s, Math.sin(a) * s, 0.8 + Math.random() * 0.5, 2 + Math.random() * 2.5, Math.random() < 0.5 ? ICE : BLUE);
  }
}

export function fxState(): FXState {
  return { supported, particles: ps.length, rings: rs.length, pending, emitted, glErrors, counts: { ...counts } };
}
export function fxReset(): void { ps.length = 0; rs.length = 0; pending = 0; emitted = 0; for (const k in counts) delete counts[k]; }
