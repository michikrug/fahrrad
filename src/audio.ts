// Read text aloud in German — for kids who still read slowly. Uses the browser's built-in voices.

// Voice quality varies a lot by device. Prefer the high-quality voices iOS/macOS/Chrome ship
// ("Premium"/"Enhanced" need to be downloaded once in iOS settings → Bedienungshilfen → Gesprochene Inhalte).
const QUALITY = [/premium/i, /enhanced|erweitert/i, /natural/i, /google/i, /anna|helena|petra/i];

let voice: SpeechSynthesisVoice | undefined;
let offlineVoice: SpeechSynthesisVoice | undefined;
function pickVoice() {
  const de = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("de"));
  const best = (vs: SpeechSynthesisVoice[]) => QUALITY.map((re) => vs.find((v) => re.test(v.name))).find(Boolean) ?? vs[0];
  voice = best(de);
  // Chrome's "Google" voices stream from the network and stay silent offline (school without WLAN).
  // Desktop Chrome (the only browser listing network voices) reads the plain macOS "Anna" with English
  // pronunciation, so skip it there; Eddy & co. sound worse but speak German.
  // ponytail: seen with Chrome 154 on macOS 26; drop the Anna skip once Chrome reads it right.
  const chrome = de.some((v) => !v.localService);
  offlineVoice = best(de.filter((v) => v.localService && !(chrome && v.name === "Anna")));
}
// Voices load asynchronously; pick early so the first click doesn't wait for them.
pickVoice();
speechSynthesis.addEventListener("voiceschanged", pickVoice);

// The engine spins up on first use, which causes the start delay. Warm it up with a silent
// utterance on the first touch (browsers only allow speech after a user gesture).
addEventListener("pointerdown", () => speechSynthesis.speak(new SpeechSynthesisUtterance("")), { once: true });

let current: SpeechSynthesisUtterance | undefined;
export function speak(text: string, onEnd: () => void) {
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  const v = navigator.onLine ? voice : (offlineVoice ?? voice);
  if (v) u.voice = v;
  // A cancelled utterance ends asynchronously, after the next one has started: only the current one un-ducks.
  current = u;
  u.onend = u.onerror = () => (current === u && duck(false), onEnd());
  duck(true);
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  duck(false);
  // cancel() while idle delays the next speak() in Chrome, so only cancel when needed.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
}

// --- Sound effects: all synthesised with Web Audio, no files (nothing to download, works offline).

let audio: AudioContext | undefined;
let master: GainNode | undefined;
let soundOn = true;
/** Effects go through one master gain, so the on/off setting mutes them all at once. */
function out() {
  audio ??= new AudioContext();
  if (!master) {
    master = audio.createGain();
    master.gain.value = soundOn ? 1 : 0;
    master.connect(audio.destination);
  }
  return { c: audio, out: master };
}
// iOS starts an AudioContext created outside a touch as "suspended", and suspends it again after
// interruptions (calls, other apps). Resuming on every touch is cheap and covers both.
addEventListener("pointerdown", () => void out().c.resume());

export function setSound(on: boolean) {
  soundOn = on;
  if (master) master.gain.value = on ? 1 : 0;
}

/** Engines and footsteps go quiet while text is read aloud, so the voice stays clear. */
function duck(on: boolean) {
  if (master && audio) master.gain.setTargetAtTime(soundOn ? (on ? 0.25 : 1) : 0, audio.currentTime, 0.1);
}

let noiseBuf: AudioBuffer | undefined;
function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

/** Two footsteps per loop: short noise thumps, the second a bit softer. */
let stepsBuf: AudioBuffer | undefined;
function steps(c: AudioContext) {
  if (!stepsBuf) {
    const len = 0.9;
    stepsBuf = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
    const d = stepsBuf.getChannelData(0);
    for (const [at, level] of [[0, 1], [len / 2, 0.7]]) {
      const i0 = Math.floor(at * c.sampleRate);
      for (let i = 0; i < c.sampleRate * 0.12; i++) d[i0 + i] = (Math.random() * 2 - 1) * level * Math.exp(-i / (c.sampleRate * 0.02));
    }
  }
  const src = c.createBufferSource();
  src.buffer = stepsBuf;
  src.loop = true;
  return src;
}

export type MoverKind = "car" | "bus" | "bike" | "pedestrian";
export interface Voice {
  /** `gain` 0..1 (distance), `pan` -1 (left) .. 1 (right), `rev` 0 (engine idling) .. 1 (driving). */
  set(gain: number, pan: number, rev?: number): void;
  stop(): void;
}

/** Looping sound of one moving road user, until stop(). */
export function moverSound(kind: MoverKind): Voice {
  const { c, out: dest } = out();
  const vol = c.createGain();
  vol.gain.value = 0;
  const pan = c.createStereoPanner();
  pan.connect(vol).connect(dest);
  const filter = c.createBiquadFilter();
  const sources: AudioScheduledSourceNode[] = [];
  /** Slow volume pulse, like firing cylinders. */
  const pulse = (rate: number, depth: number) => {
    const am = c.createGain();
    am.gain.value = 1 - depth;
    const lfo = c.createOscillator();
    lfo.frequency.value = rate;
    const amount = c.createGain();
    amount.gain.value = depth;
    lfo.connect(amount).connect(am.gain);
    sources.push(lfo);
    return { am, lfo };
  };
  let rev = (_r: number) => {};
  if (kind === "car" || kind === "bus") {
    // Engine: two slightly detuned low saws, muffled and pulsing like firing cylinders.
    // Idle runs lower and slower; setting off glides pitch, pulse and brightness up (the "rev").
    const f = kind === "bus" ? 38 : 55;
    filter.type = "lowpass";
    filter.Q.value = 2;
    const { am, lfo } = pulse(0, 0.5);
    filter.connect(am).connect(pan);
    const oscs = [1, 1.03].map((k) => {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.connect(filter);
      sources.push(o);
      return { o, k };
    });
    rev = (r) => {
      const t = c.currentTime, glide = 0.35;
      for (const { o, k } of oscs) o.frequency.setTargetAtTime(f * k * (0.7 + 0.5 * r), t, glide);
      lfo.frequency.setTargetAtTime(f * (0.35 + 0.25 * r), t, glide);
      filter.frequency.setTargetAtTime((kind === "bus" ? 220 : 320) + 260 * r, t, glide);
    };
  } else if (kind === "bike") {
    // Tyres on asphalt: a steady, soft "shh". A wobble of the turning wheel sounded like a windmill.
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.connect(pan);
    const n = noise(c);
    n.connect(filter);
    sources.push(n);
  } else {
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.connect(pan);
    const st = steps(c);
    st.connect(filter);
    sources.push(st);
  }
  let lastRev = 0;
  rev(0);
  // The engine pulse halves the average volume, hence the higher car/bus levels.
  const level = { car: 0.6, bus: 0.8, bike: 0.2, pedestrian: 0.8 }[kind];
  for (const src of sources) src.start();
  return {
    set(g, p, r = 1) {
      // Smoothed, so moving cameras don't make it crackle.
      vol.gain.setTargetAtTime(g * level, c.currentTime, 0.05);
      pan.pan.setTargetAtTime(p, c.currentTime, 0.05);
      if (r !== lastRev) rev((lastRev = r));
    },
    stop() {
      vol.gain.setTargetAtTime(0, c.currentTime, 0.05);
      for (const s of sources) s.stop(c.currentTime + 0.3);
    },
  };
}

/** Near miss: a honk if a car or bus is involved (`horn`), else the bell. */
export function nearMissSound(horn: boolean) {
  if (!horn) return ringBell();
  const { c, out: dest } = out();
  const now = c.currentTime;
  // Car horn: two square tones a third apart, slightly muffled.
  const h = c.createGain();
  h.gain.setValueAtTime(0, now);
  h.gain.linearRampToValueAtTime(0.12, now + 0.02);
  h.gain.setValueAtTime(0.12, now + 0.5);
  h.gain.linearRampToValueAtTime(0, now + 0.55);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1800;
  lp.connect(h).connect(dest);
  for (const f of [349, 440]) {
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    o.connect(lp);
    o.start(now);
    o.stop(now + 0.6);
  }
}

/**
 * "Ring ring" of a bicycle bell, synthesised — no sound file.
 * A bell is a few inharmonic partials with a fast attack and a long decay.
 */
export function ringBell() {
  const { c, out: dest } = out();
  const now = c.currentTime;
  const bell = c.createGain();
  bell.gain.value = 0.25;
  bell.connect(dest);
  for (const strike of [0, 0.18]) {
    for (const [ratio, level] of [[1, 1], [2.76, 0.5], [5.4, 0.25]] as const) {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.frequency.value = 2200 * ratio;
      env.gain.setValueAtTime(0, now + strike);
      env.gain.linearRampToValueAtTime(level, now + strike + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, now + strike + 1.2 / ratio);
      osc.connect(env).connect(bell);
      osc.start(now + strike);
      osc.stop(now + strike + 1.3);
    }
  }
}
