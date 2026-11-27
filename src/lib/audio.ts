/**
 * Synthesised two-tone SAR alarm using the Web Audio API.
 * No audio assets. Browsers require a user gesture before audio can start,
 * so `unlockAudio()` is wired to the first pointer / key event.
 */

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

export function isAudioRunning(): boolean {
  return ctx?.state === 'running';
}

function tone(c: AudioContext, freq: number, start: number, dur: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
  gain.gain.setValueAtTime(0.16, start + dur - 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  osc.connect(lp).connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function cycle() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    void c.resume();
    return;
  }
  const t = c.currentTime + 0.03;
  tone(c, 960, t, 0.3);
  tone(c, 720, t + 0.36, 0.3);
}

export function startAlarm(): void {
  if (timer) return;
  cycle();
  timer = setInterval(cycle, 900);
}

export function stopAlarm(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
