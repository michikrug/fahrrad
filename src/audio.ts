// Read text aloud in German — for kids who still read slowly. Uses the browser's built-in voices.

// Voice quality varies a lot by device. Prefer the high-quality voices iOS/macOS/Chrome ship
// ("Premium"/"Enhanced" need to be downloaded once in iOS settings → Bedienungshilfen → Gesprochene Inhalte).
const QUALITY = [/premium/i, /enhanced|erweitert/i, /natural/i, /google/i, /anna|helena|petra/i];

let voice: SpeechSynthesisVoice | undefined;
function pickVoice() {
  const de = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("de"));
  voice = QUALITY.map((re) => de.find((v) => re.test(v.name))).find(Boolean) ?? de[0];
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
