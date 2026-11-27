// Alert sounds via the Web Audio API — no audio files needed. The sound is chosen per device
// in the Alerts panel and plays on any screen, also with the tab in the background.

export const ALERT_SOUND_KEY = 'alerts.sound';

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Browsers keep audio silent until a user gesture: the first click or key in the app starts
// the audio context, so a later alert sounds even with the tab in the background.
export function unlockAlertSound(): () => void {
  const unlock = () => {
    audioContext();
    remove();
  };
  const remove = () => {
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  return remove;
}

type Layer = readonly [OscillatorType, number, number];

interface Tone {
  freq: number;
  start: number;
  duration: number;
  peak: number;
  hold?: boolean;
  layers?: readonly Layer[];
}

const SINE: readonly Layer[] = [['sine', 1, 1]];
const BRIGHT: readonly Layer[] = [['triangle', 1, 1], ['square', 0.25, 1]];
const BELL: readonly Layer[] = [['sine', 1, 1], ['sine', 0.5, 2.76], ['sine', 0.25, 5.4]];
const LOUD = 0.9;
const RELEASE_S = 0.08;

// A limiter keeps the louder tones from clipping.
function limiter(ac: AudioContext): AudioNode {
  const node = ac.createDynamicsCompressor();
  node.threshold.value = -6;
  node.knee.value = 6;
  node.ratio.value = 12;
  node.connect(ac.destination);
  return node;
}

// `hold` keeps the level until the end; otherwise the tone fades from the start, like a bell.
function tone(ac: AudioContext, out: AudioNode, t: Tone): void {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t.start);
  gain.gain.exponentialRampToValueAtTime(t.peak, t.start + 0.01);
  if (t.hold) gain.gain.setValueAtTime(t.peak, t.start + t.duration - RELEASE_S);
  gain.gain.exponentialRampToValueAtTime(0.0001, t.start + t.duration);
  gain.connect(out);
  for (const [type, level, ratio] of t.layers ?? SINE) {
    const osc = ac.createOscillator();
    const mix = ac.createGain();
    osc.type = type;
    osc.frequency.value = t.freq * ratio;
    mix.gain.value = level;
    osc.connect(mix);
    mix.connect(gain);
    osc.start(t.start);
    osc.stop(t.start + t.duration);
  }
}

type Play = (ac: AudioContext, out: AudioNode, now: number) => void;

const classic = (peak: number, offset = 0): Play => (ac, out, now) => {
  tone(ac, out, { freq: 880, start: now + offset, duration: 0.18, peak });
  tone(ac, out, { freq: 1175, start: now + offset + 0.2, duration: 0.22, peak });
};

const bells = (count: number, gapS: number): Play => (ac, out, now) => {
  for (let i = 0; i < count; i++) tone(ac, out, { freq: 1046, start: now + i * gapS, duration: 1.4, peak: LOUD, layers: BELL });
};

export interface AlertSound {
  id: string;
  label: string;
  quiet?: boolean;
  play: Play;
}

export const ALERT_SOUNDS: readonly AlertSound[] = [
  { id: 'classic', label: 'Classic (soft)', quiet: true, play: classic(0.3) },
  { id: 'classic-loud', label: 'Classic, loud', play: classic(LOUD) },
  {
    id: 'classic-held', label: 'Classic, loud and held',
    play: (ac, out, now) => {
      tone(ac, out, { freq: 880, start: now, duration: 0.3, peak: LOUD, hold: true });
      tone(ac, out, { freq: 1175, start: now + 0.32, duration: 0.32, peak: LOUD, hold: true });
    },
  },
  { id: 'classic-twice', label: 'Classic, loud, twice', play: (ac, out, now) => { classic(LOUD)(ac, out, now); classic(LOUD, 0.55)(ac, out, now); } },
  {
    id: 'bright-twice', label: 'Bright, twice',
    play: (ac, out, now) => {
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.7;
        tone(ac, out, { freq: 880, start: t, duration: 0.3, peak: LOUD, hold: true, layers: BRIGHT });
        tone(ac, out, { freq: 1175, start: t + 0.32, duration: 0.3, peak: LOUD, hold: true, layers: BRIGHT });
      }
    },
  },
  { id: 'bell', label: 'Bell', play: bells(1, 0) },
  { id: 'bell-3', label: 'Bell, 3 times', play: bells(3, 0.5) },
  { id: 'bell-3-spaced', label: 'Bell, 3 times spaced', play: bells(3, 0.8) },
  {
    id: 'rising', label: 'Three rising notes',
    play: (ac, out, now) => [784, 988, 1175].forEach((freq, i) => tone(ac, out, { freq, start: now + i * 0.16, duration: 0.2, peak: LOUD })),
  },
  {
    id: 'double-high', label: 'Double high beep',
    play: (ac, out, now) => {
      tone(ac, out, { freq: 1320, start: now, duration: 0.12, peak: LOUD });
      tone(ac, out, { freq: 1320, start: now + 0.18, duration: 0.12, peak: LOUD });
    },
  },
];

export const DEFAULT_ALERT_SOUND = 'bell-3-spaced';

function chosenSound(): AlertSound {
  let id = DEFAULT_ALERT_SOUND;
  try {
    const raw = localStorage.getItem(ALERT_SOUND_KEY);
    if (raw !== null) id = JSON.parse(raw) as string;
  } catch {
    // keep the default
  }
  return ALERT_SOUNDS.find(s => s.id === id) ?? ALERT_SOUNDS.find(s => s.id === DEFAULT_ALERT_SOUND)!;
}

export function playAlertSound(id: string): void {
  const ac = audioContext();
  const sound = ALERT_SOUNDS.find(s => s.id === id);
  if (!ac || !sound) return;
  sound.play(ac, sound.quiet ? ac.destination : limiter(ac), ac.currentTime + 0.02);
}

// The sound chosen on this device (Alerts panel), for a triggered alert.
export function playAlertBeep(): void {
  playAlertSound(chosenSound().id);
}
