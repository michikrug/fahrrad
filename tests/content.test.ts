import { expect, test } from "bun:test";
import { rules, signInfo } from "../src/content/rules";
import { levels, scenarios } from "../src/content/scenarios";
import { isCorrect } from "../src/check";
import { colorOf } from "../src/scene/actors";

// Colour words kids read in the explanations, per body colour. Keep in sync when adding a colour.
const COLOR_WORDS: Record<number, string> = {
  0xd63a3a: "rot", 0x2f6fd6: "blau", 0x2f9e5a: "grün", 0x8e44ad: "lila", 0x6a4fc4: "lila",
  0x16a3a3: "türkis", 0xe23d6e: "pink", 0xf2c230: "gelb", 0xff7a00: "orange",
};
// Only colour + road user — "das rote Schild" or "der grüne Pfeil" are not about a participant.
const NAMED = /\b(rot|blau|grün|lila|türkis|pink|gelb|orange)\w*\s+(Auto|Rad|Fahrrad|Bus)\b/g;

test("scenario ids are unique", () => {
  expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
});

for (const s of scenarios) {
  test(`${s.id}: answer is consistent`, () => {
    const ids = s.participants.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.participants.filter((p) => p.kind === "player").length).toBe(1);
    expect(!!s.answer !== !!s.choice).toBe(true); // exactly one question type
    if (s.answer) {
      // Every participant appears exactly once in the answer.
      expect([...s.answer.flat()].sort()).toEqual([...ids].sort());
      expect(isCorrect(s.answer, s.answer.flat())).toBe(true);
    }
    if (s.choice) {
      expect(s.choice.options.length).toBeGreaterThanOrEqual(2);
      expect(s.choice.options.length).toBeLessThanOrEqual(3); // big cards, no more than three
      expect(s.choice.options[s.choice.correct]).toBeDefined();
    }
    // "Das rote Auto" must exist: catches explanations left behind after a recolour.
    for (const [, word, noun] of `${s.explain} ${s.choice?.question ?? ""}`.matchAll(NAMED)) {
      const kinds = noun === "Auto" ? ["car"] : noun === "Bus" ? ["bus"] : ["bike"];
      const match = s.participants.filter((p) => kinds.includes(p.kind) && COLOR_WORDS[colorOf(p)] === word);
      expect(match.length, `${word} ${noun}`).toBeGreaterThan(0);
    }
    // Every participant comes from an arm that exists.
    for (const p of s.participants) expect(s.layout.arms[p.arm]).toBeDefined();
  });
}

test("every scenario is in exactly one level and points to an existing rule card", () => {
  const ids = levels.flatMap((l) => l.scenarios.map((s) => s.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (const s of scenarios) expect(rules.some((r) => r.id === s.rule)).toBe(true);
});

test("rule cards are unique, cite a source, and only use signs from the cheat sheet", () => {
  expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  for (const r of rules) {
    expect(r.source.length).toBeGreaterThan(0);
    expect(r.url.startsWith("https://")).toBe(true);
    for (const id of r.signs ?? []) expect(signInfo[id]).toBeDefined();
  }
});
