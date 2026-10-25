// Procedural Web Audio
const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

let masterGain: GainNode;
try {
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
} catch (_) {
  masterGain = ctx.createGain();
}

export function resumeAudio() {
  if (ctx.state === 'suspended') ctx.resume();
}

function playTone(freq: number, type: OscillatorType, duration: number, volume = 0.3, detune = 0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playFootstep(surface: 'grass' | 'wood' | 'gravel' | 'felt' = 'grass') {
  const configs: Record<string, [number, OscillatorType, number]> = {
    grass: [80, 'sawtooth', 0.12],
    wood: [200, 'square', 0.08],
    gravel: [120, 'sawtooth', 0.10],
    felt: [60, 'sine', 0.06],
  };
  const [freq, type, dur] = configs[surface];
  playTone(freq + Math.random() * 20 - 10, type, dur, 0.15);
}

export function playWaterSlosh() {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
  }
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 2;
  src.buffer = buf;
  src.connect(filter);
  filter.connect(masterGain);
  src.start();
}

export function playCardFlick() {
  playTone(800 + Math.random() * 200, 'triangle', 0.08, 0.2);
}

export function playNotificationPing() {
  playTone(880, 'sine', 0.15, 0.2);
  setTimeout(() => playTone(1100, 'sine', 0.1, 0.15), 80);
}

export function playSuccess() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.3, 0.25), i * 100));
}

export function playFailure() {
  playTone(200, 'sawtooth', 0.4, 0.2);
  setTimeout(() => playTone(150, 'sawtooth', 0.3, 0.15), 200);
}

export function playChewSound() {
  playTone(80 + Math.random() * 20, 'sawtooth', 0.08, 0.1);
}

export function playBuzz() {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 60;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

export function playYakGrunt() {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

// Ambient wind loop
let windNode: AudioBufferSourceNode | null = null;
export function startWind() {
  if (windNode) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const gain = ctx.createGain();
  gain.gain.value = 0.04;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start();
  windNode = src;
}

export function playTitleMusic() {
  const notes = [261, 293, 329, 392, 440, 392, 329, 293];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 'sine', 1.5, 0.15);
      playTone(freq / 2, 'sine', 1.5, 0.08);
    }, i * 600);
  });
}

export function setVolume(v: number) {
  masterGain.gain.value = Math.max(0, Math.min(1, v));
}

export function initAudio() {
  // Start wind ambience on user interaction (auto-started on first click)
  document.addEventListener('click', () => {
    resumeAudio();
    startWind();
  }, { once: true });
}

export function playSound(name: string) {
  switch (name) {
    case 'footstep': playFootstep(); break;
    case 'slosh': playWaterSlosh(); break;
    case 'card': playCardFlick(); break;
    case 'notif': playNotificationPing(); break;
    case 'success': playSuccess(); break;
    case 'fail': playFailure(); break;
    case 'chew': playChewSound(); break;
    case 'buzz': playBuzz(); break;
    case 'yak': playYakGrunt(); break;
  }
}
