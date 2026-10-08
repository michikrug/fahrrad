// Read text aloud in German — for kids who still read slowly. Uses the browser's built-in voices.

// Voice quality varies a lot by device. Prefer the high-quality voices iOS/macOS/Chrome ship
// ("Premium"/"Enhanced" need to be downloaded once in iOS settings → Bedienungshilfen → Gesprochene Inhalte).
const QUALITY = [/premium/i, /enhanced|erweitert/i, /natural/i, /google/i, /anna|helena|petra/i];

let voice: SpeechSynthesisVoice | undefined;
function pickVoice() {
  const de = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("de"));
  const best = (vs: SpeechSynthesisVoice[]) => QUALITY.map((re) => vs.find((v) => re.test(v.name))).find(Boolean) ?? vs[0];
  // On-device voices first: offline, desktop Chrome's network "Google Deutsch" silently falls back to the
  // English default voice, and navigator.onLine can't tell (it stays true with a VPN or WLAN without internet).
  voice = best(de.filter((v) => v.localService)) ?? best(de);
}
// Voices load asynchronously; pick early so the first click doesn't wait for them.
pickVoice();
speechSynthesis.addEventListener("voiceschanged", pickVoice);

// The engine spins up on first use, which causes the start delay. Warm it up with a silent
// utterance on the first touch (browsers only allow speech after a user gesture).
addEventListener("pointerdown", () => speechSynthesis.speak(new SpeechSynthesisUtterance("")), { once: true });

export function speak(text: string, onEnd: () => void) {
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  if (voice) u.voice = voice;
  u.onend = u.onerror = onEnd;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  // cancel() while idle delays the next speak() in Chrome, so only cancel when needed.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
}

let audio: AudioContext | undefined;

/**
 * "Ring ring" of a bicycle bell, synthesised — no sound file.
 * A bell is a few inharmonic partials with a fast attack and a long decay.
 */
export function ringBell() {
  audio ??= new AudioContext();
  const now = audio.currentTime;
  const out = audio.createGain();
  out.gain.value = 0.25;
  out.connect(audio.destination);
  for (const strike of [0, 0.18]) {
    for (const [ratio, level] of [[1, 1], [2.76, 0.5], [5.4, 0.25]] as const) {
      const osc = audio.createOscillator();
      const env = audio.createGain();
      osc.frequency.value = 2200 * ratio;
      env.gain.setValueAtTime(0, now + strike);
      env.gain.linearRampToValueAtTime(level, now + strike + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, now + strike + 1.2 / ratio);
      osc.connect(env).connect(out);
      osc.start(now + strike);
      osc.stop(now + strike + 1.3);
    }
  }
}
