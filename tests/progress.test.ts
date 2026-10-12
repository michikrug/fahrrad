import { expect, test } from "bun:test";
import { isUnlocked, levelStats, needsPractice, record, type Progress } from "../src/progress";
import type { Level, Scenario } from "../src/types";

const sc = (id: string) => ({ id }) as Scenario;
const levels = [
  { id: "a", title: "", icon: "", scenarios: ["a1", "a2", "a3", "a4", "a5"].map(sc) },
  { id: "b", title: "", icon: "", scenarios: ["b1"].map(sc) },
] as Level[];

test("next level unlocks at 80 % solved", () => {
  let p: Progress = {};
  for (const id of ["a1", "a2", "a3"]) p = record(p, id, true, true);
  expect(isUnlocked(levels, 1, p)).toBe(false); // 3/5
  p = record(p, "a4", true, false);
  expect(isUnlocked(levels, 1, p)).toBe(true); // 4/5
  expect(isUnlocked(levels, 0, {})).toBe(true);
});

test("stars only for first-try solves and never lost", () => {
  let p = record({}, "a1", false, false);
  p = record(p, "a1", true, false);
  expect(levelStats(levels[0], p)).toEqual({ n: 5, solved: 1, stars: 0 });
  p = record(p, "a2", true, true);
  p = record(p, "a2", false, false); // replay with a mistake
  expect(p.a2).toEqual({ solved: true, firstTry: true });
});

test("practice list: wrong or retried tasks until one clean run", () => {
  let p: Progress = {};
  expect(needsPractice(p, "a1")).toBe(false); // never played
  p = record(p, "a1", false, true); // wrong
  expect(needsPractice(p, "a1")).toBe(true);
  p = record(p, "a1", true, false); // right, but after a mistake: still practise
  expect(needsPractice(p, "a1")).toBe(true);
  p = record(p, "a1", true, true); // clean run
  expect(needsPractice(p, "a1")).toBe(false);
  p = record(p, "a1", false, false); // a later slip never takes the star back
  expect(needsPractice(p, "a1")).toBe(false);
});
