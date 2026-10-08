/** Read text aloud in German — for kids who still read slowly. Uses the browser's built-in voices. */
export function speak(text: string) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}
