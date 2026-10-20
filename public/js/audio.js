// All sounds are synthesized with WebAudio, so the game ships with no assets.
let ctx = null, master = null, crowdGain = null, noiseBuf = null;
let volume = 0.7, crowdLevel = 0.15;

try { const v = parseFloat(localStorage.getItem('bs_volume')); if (!isNaN(v)) volume = v; } catch {}

export function getVolume() { return volume; }
export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
  try { localStorage.setItem('bs_volume', String(v)); } catch {}
}

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Looping crowd murmur.
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
  src.connect(bp).connect(crowdGain).connect(master);
  src.start();
}

export function setCrowd(level) {
  crowdLevel = level;
  if (crowdGain) crowdGain.gain.setTargetAtTime(level * 0.12, ctx.currentTime, 0.25);
}

function env(g, t, a, peak, dcy) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}

function tone(type, f0, f1, dur, peak = 0.3, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g, t, 0.005, peak, dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, freq, q, peak = 0.3, type = 'bandpass', delay = 0, attack = 0.005) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, attack, peak, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random()); s.stop(t + dur + attack + 0.05);
}

const SOUNDS = {
  dribble: () => { tone('sine', 140, 60, 0.09, 0.35); noise(0.04, 400, 1, 0.08); },
  bounce: v => { tone('sine', 130, 55, 0.12, 0.35 * (v ?? 1)); },
  shoot: () => noise(0.12, 1800, 1.2, 0.08),
  jump: () => noise(0.08, 600, 1, 0.06),
  swish: () => { noise(0.35, 4500, 0.7, 0.25, 'highpass', 0, 0.03); },
  rim: () => { tone('square', 620, 590, 0.18, 0.08); tone('triangle', 1240, 1200, 0.25, 0.08); },
  board: () => { tone('sine', 220, 120, 0.12, 0.3); noise(0.06, 900, 1, 0.1); },
  dunk: () => { tone('sine', 90, 40, 0.35, 0.5); noise(0.25, 300, 0.8, 0.35); tone('square', 520, 500, 0.3, 0.06, 0.02); },
  block: () => { tone('sine', 160, 70, 0.15, 0.45); noise(0.1, 700, 1, 0.25); },
  steal: () => { tone('triangle', 500, 900, 0.12, 0.15); },
  swipe: () => noise(0.09, 2500, 2, 0.06),
  cross: () => { noise(0.07, 3500, 3, 0.07); tone('sine', 300, 600, 0.08, 0.06); },
  pass: () => noise(0.1, 1500, 1, 0.08),
  catch: () => tone('sine', 180, 100, 0.06, 0.2),
  whistle: () => { tone('sine', 2900, 2800, 0.35, 0.18); tone('sine', 3100, 3000, 0.35, 0.08); },
  buzzer: () => { tone('sawtooth', 220, 218, 0.9, 0.18); tone('square', 110, 110, 0.9, 0.08); },
  tick: () => tone('square', 880, 880, 0.08, 0.08),
  cheer: () => { noise(1.6, 1100, 0.5, 0.35, 'bandpass', 0, 0.15); noise(1.2, 2600, 0.8, 0.12, 'bandpass', 0.05, 0.2); },
  ooh: () => { tone('sawtooth', 300, 200, 0.8, 0.05); noise(1.0, 700, 0.8, 0.25, 'bandpass', 0, 0.12); },
  fire: () => { noise(0.8, 300, 0.5, 0.4, 'lowpass', 0, 0.05); tone('sawtooth', 110, 440, 0.6, 0.1); },
  power: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.12, 0.12, i * 0.06)); },
  spawn: () => tone('sine', 900, 1400, 0.15, 0.06),
  click: () => tone('triangle', 700, 700, 0.05, 0.1),
  swing: () => noise(0.12, 1800, 1.5, 0.12, 'bandpass', 0, 0.02),
  punch: () => { tone('sine', 180, 50, 0.18, 0.55); noise(0.12, 900, 0.8, 0.4); },
  thud: () => { tone('sine', 90, 40, 0.2, 0.45); noise(0.1, 300, 1, 0.2); },
  clang: () => { tone('square', 900, 860, 0.25, 0.1); tone('triangle', 1800, 1750, 0.3, 0.08); },
  shield: () => { tone('sine', 300, 900, 0.35, 0.15); tone('triangle', 600, 1200, 0.4, 0.08, 0.05); },
  shieldOff: () => tone('sine', 700, 250, 0.25, 0.1),
  megaUp: () => { tone('sawtooth', 120, 600, 0.7, 0.12); noise(0.7, 800, 0.6, 0.2, 'bandpass', 0, 0.3); },
  mega: () => { tone('sine', 70, 30, 0.6, 0.7); noise(0.5, 400, 0.6, 0.5); noise(0.9, 5000, 0.5, 0.15, 'highpass', 0.05, 0.02); },
  fireball: () => { noise(0.6, 350, 0.6, 0.35, 'lowpass', 0, 0.05); tone('sawtooth', 200, 500, 0.4, 0.08); },
  ready: () => { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.1, 0.12, i * 0.07)); },
  win: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.2, 0.15, i * 0.12)); },
};

export function play(name, arg) {
  if (!ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
  SOUNDS[name](arg);
}
