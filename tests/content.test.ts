import { expect, test } from "bun:test";
import { rules, signInfo } from "../src/content/rules";
import { levels, scenarios } from "../src/content/scenarios";
import { isCorrect } from "../src/check";

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
