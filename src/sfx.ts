// POOP SURVIVORS — audio (WebAudio synth, no assets)
// SFX: shoot, hit, levelup, boss, chest, flush, death, win. Music: looped
// 8-bar chiptune built from oscillators, scheduled ahead (lookahead pattern).
// Audio unlocks on the first user gesture (key/pointer) per browser policy.

const A: AudioContext | null = window.AudioContext ? new window.AudioContext() : null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let started = false;
let voiceCount = 0; // concurrent one-shots (voice cap)
setInterval(() => { if (voiceCount > 0) voiceCount = 0; }, 100); // decay window

// ---------- music: dual-source. (1) a REAL generated track (M16: a local
// HeartMuLa "banger", public/music.mp3, looped via an <audio> element) with
// (2) the old synth chiptune as fallback when the file is absent/failed.
// The synth stays for the title screen's first seconds and for no-file
// fallback; the mp3 takes over once it loads. musicIntensity() drives BOTH
// (the boss-rush duck/intensify API is unchanged — main.ts just calls it).
const MUSIC_SRC = './music.mp3';
const musicEl: HTMLAudioElement = new Audio(MUSIC_SRC);
musicEl.loop = true;
musicEl.preload = 'auto';
musicEl.crossOrigin = 'anonymous';
let mp3Ready = false;
let mp3Active = false; // the real track is playing — the synth is ducked out
let mp3Src: MediaElementAudioSourceNode | null = null; // created ONCE per element (WebAudio rule)
musicEl.addEventListener('canplaythrough', () => { mp3Ready = true; });
musicEl.addEventListener('error', () => { mp3Ready = false; });
musicEl.volume = 0.55; // relative to master (bump above the SFX bed, under clipping)

const MUTE_KEY = 'poop-survivors-mute';
export function muted(): boolean { return localStorage.getItem(MUTE_KEY) === '1'; } // M11: exported for the mobile mute button label
export function toggleMute(): boolean {
  const m = muted();
  localStorage.setItem(MUTE_KEY, m ? '0' : '1');
  if (master) master.gain.value = m ? 0.75 : 0;
  if (musicEl) musicEl.muted = m;
  return !m;
}

function ensure(): boolean {
  if (!A) return false;
  if (!started) {
    started = true;
    // M16: gain -> compressor -> destination. The snappy attack pass pushed
    // per-sound volumes up; under heavy combat + music the bus can sum past
    // 1.0, and a compressor makes that a transient "punch" instead of a clip.
    const comp = A.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.15;
    comp.connect(A.destination);
    master = A.createGain();
    master.gain.value = muted() ? 0 : 0.75; // M16: 0.6->0.75 — playtest R3 "could be more snappier/louder"
    master.connect(comp);
    musicGain = A.createGain();
    musicGain.gain.value = 0.25;
    musicGain.connect(master);
    startMusic();
  }
  if (A.state === 'suspended') A.resume();
  // M16: the real track takes over as soon as it's ready — the synth loop
  // keeps playing underneath until then (no audible gap on slow devices).
  // createMediaElementSource must be called ONCE per element (WebAudio),
  // so cache the node; the file's absence (404) keeps mp3Ready false and
  // the synth fallback just plays — the game is identical to pre-M16.
  if (mp3Ready && A.state === 'running') {
    const m = master;
    if (!mp3Src && m) {
      try { mp3Src = A.createMediaElementSource(musicEl); mp3Src.connect(m); } catch { mp3Src = null; }
    }
    musicEl.muted = muted();
    if (musicEl.paused) void musicEl.play().then(() => { mp3Active = true; }).catch(() => { /* autoplay still pending */ });
    else mp3Active = true;
  }
  return true;
}

// unlock on first user gesture
window.addEventListener('keydown', () => ensure(), { once: true });
window.addEventListener('pointerdown', () => ensure(), { once: true });

// one-shot synth: envelope a simple oscillator shape
function blip(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number): void {
  const ac = A; if (!ensure() || !master || !ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

// noise burst (hits, flushes): buffer of white noise through a lowpass
function noise(dur: number, vol: number, cut: number): void {
  const ac = A; if (!ensure() || !master || !ac) return;
  const t = ac.currentTime;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = cut;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export function sfx(kind: string): void {
  if (!ensure()) return;
  // voice cap: max ~8 one-shots per 100ms window — under heavy clatter
  // (hundreds of hits/second) this keeps the audio graph cheap so the game
  // loop stays real-time
  if (voiceCount > 8) return;
  voiceCount++;
  // M16 audio pass (playtest R3: "attacks too quiet + too slow, levelup is
  // the only one that feels right"). Levelup works because it's FAST notes
  // with NO slow pitch glide — the old attacks all had long downward slides
  // (0.12–0.4s) that read as a slow "whooo". Fix: short, steep, LOUD — a
  // broadband transient (noise click) + a low thump = a punchy "crack", not
  // a glide. Every attack is <70ms and louder than before.
  if (kind === 'shoot') { blip(720, 0.05, 'square', 0.11, 0.45); noise(0.025, 0.07, 4500); }
  else if (kind === 'hit') { noise(0.05, 0.20, 3200); blip(150, 0.06, 'sine', 0.17, 0.5); }
  else if (kind === 'levelup') { blip(520, 0.09, 'square', 0.13); setTimeout(() => blip(660, 0.09, 'square', 0.13), 90); setTimeout(() => blip(780, 0.14, 'square', 0.13), 180); }
  else if (kind === 'boss') { blip(150, 0.22, 'sawtooth', 0.17, 0.55); noise(0.3, 0.13, 400); }
  else if (kind === 'chest') { blip(440, 0.08, 'triangle', 0.11); setTimeout(() => blip(550, 0.08, 'triangle', 0.11), 80); setTimeout(() => blip(660, 0.12, 'triangle', 0.11), 160); }
  else if (kind === 'evolution') { blip(392, 0.1, 'triangle', 0.13); setTimeout(() => blip(523, 0.1, 'triangle', 0.13), 100); setTimeout(() => blip(659, 0.1, 'triangle', 0.13), 200); setTimeout(() => blip(784, 0.2, 'triangle', 0.13), 300); }
  else if (kind === 'flush') { noise(0.7, 0.16, 1100); blip(90, 0.5, 'sawtooth', 0.14, 0.4); }
  else if (kind === 'death') { blip(280, 0.3, 'sawtooth', 0.15, 0.35); noise(0.25, 0.11, 600); }
  else if (kind === 'win') { blip(523, 0.1, 'square', 0.13); setTimeout(() => blip(659, 0.1, 'square', 0.13), 110); setTimeout(() => blip(784, 0.1, 'square', 0.13), 220); setTimeout(() => blip(1046, 0.3, 'square', 0.13), 330); }
  else if (kind === 'pickup') { blip(880, 0.06, 'square', 0.10); setTimeout(() => blip(1320, 0.08, 'square', 0.09), 40); }
  else if (kind === 'gem') { blip(1320, 0.045, 'triangle', 0.09); }
  else if (kind === 'hurt') { blip(170, 0.09, 'sawtooth', 0.16, 0.5); noise(0.06, 0.12, 900); }
  else if (kind === 'pop') { blip(300, 0.045, 'square', 0.11, 2.2); noise(0.03, 0.10, 3500); }
}

// ---------- music: 8-bar loop, two voices + noise hat, scheduled ahead ----------
// Am-ish chiptune: bassline square, lead triangle, noise hats every other step.
const BPM = 132;
const STEP = 60 / BPM / 2; // 8th notes
const BARS = 8;
// bassline (semitone offsets from 55Hz A1), one note per 8th, -1 = rest
const BASS: number[] = [
  0, -1, 0, -1, 3, -1, 5, -1,   0, -1, 0, -1, 3, -1, 5, -1,
  5, -1, 5, -1, 7, -1, 8, -1,   3, -1, 3, -1, 5, -1, 7, -1,
  0, -1, 0, -1, 3, -1, 5, -1,   0, -1, 0, -1, 3, -1, 5, -1,
  5, -1, 5, -1, 7, -1, 8, -1,   10, -1, 8, -1, 7, -1, 5, -1,
  // bars 5-8: lift (higher octave)
  12, -1, 12, -1, 15, -1, 17, -1,  12, -1, 12, -1, 15, -1, 17, -1,
  17, -1, 17, -1, 19, -1, 20, -1,  15, -1, 15, -1, 17, -1, 19, -1,
  12, -1, 12, -1, 15, -1, 17, -1,  12, -1, 12, -1, 15, -1, 17, -1,
  17, -1, 17, -1, 19, -1, 20, -1,  22, -1, 20, -1, 19, -1, 17, -1,
];
// lead melody (semitones from 220Hz A3), sparse
const LEAD: number[] = [
  0, -1, 4, -1, 7, -1, 4, -1,   0, -1, 4, -1, 7, -1, 4, -1,
  7, -1, 7, -1, 9, -1, 11, -1,  4, -1, 4, -1, 7, -1, 9, -1,
  0, -1, 4, -1, 7, -1, 4, -1,   0, -1, 4, -1, 7, -1, 4, -1,
  7, -1, 7, -1, 9, -1, 11, -1,  14, -1, 11, -1, 9, -1, 7, -1,
  12, -1, 16, -1, 19, -1, 16, -1,  12, -1, 16, -1, 19, -1, 16, -1,
  19, -1, 19, -1, 21, -1, 23, -1,  16, -1, 16, -1, 19, -1, 21, -1,
  12, -1, 16, -1, 19, -1, 16, -1,  12, -1, 16, -1, 19, -1, 16, -1,
  19, -1, 19, -1, 21, -1, 23, -1,  26, -1, 23, -1, 21, -1, 19, -1,
];
const STEPS = BASS.length; // 128 (8 bars × 16 8ths)
const TOTAL_STEPS = STEPS * 4; // 4 loops of the pattern, then it restarts
function freqFrom(base: number, semi: number): number { return base * Math.pow(2, semi / 12); }
function scheduleMusic(): void {
  const ac = A; if (!ac || !musicGain) return;
  if (mp3Active) return; // M16: the real track is playing — the synth is the
  // fallback only (two different tempos at once would clash, not layer)
  // schedule the next ~0.5s of steps ahead
  while (musicStep * STEP < ac.currentTime + 0.5 - musicEpoch) {
    const step = musicStep % STEPS;
    const t = musicEpoch + musicStep * STEP;
    const bass = BASS[step];
    if (bass >= 0) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = freqFrom(55, bass);
      g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.9);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + STEP);
    }
    const lead = LEAD[step];
    if (lead >= 0) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = freqFrom(220, lead);
      g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 1.8);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + STEP * 2);
    }
    if (step % 2 === 0) {
      const len = Math.floor(ac.sampleRate * 0.04);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      const g = ac.createGain(); g.gain.value = 0.05;
      src.connect(f); f.connect(g); g.connect(musicGain); src.start(t);
    }
    musicStep++;
  }
}
let musicEpoch = 0;
function startMusic(): void {
  const ac = A; if (!ac || !musicGain) return;
  musicEpoch = ac.currentTime + 0.1;
  musicStep = 0;
  musicTimer = window.setInterval(scheduleMusic, 250);
}

// pause/resume with the game loop (title/dead: keep music, lower gain)
export function musicIntensity(level: number): void {
  if (muted()) return;
  if (musicGain) musicGain.gain.value = 0.25 * Math.min(1.6, level);
  // M16: the real track rides the same pressure curve (louder as the
  // screen fills / a boss shows) — the boss-rush duck API is unchanged.
  if (mp3Ready) musicEl.volume = 0.5 + 0.25 * Math.min(1.0, level);
}
export function setMuted(m: boolean): void {
  localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 0.75;
  musicEl.muted = m;
}
