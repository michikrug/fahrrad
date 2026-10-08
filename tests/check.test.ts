import { expect, test } from "bun:test";
import { isCorrect, isValidPrefix } from "../src/check";

const g = [["a"], ["b", "c"], ["d"]];

test("accepts any order inside a group", () => {
  expect(isCorrect(g, ["a", "b", "c", "d"])).toBe(true);
  expect(isCorrect(g, ["a", "c", "b", "d"])).toBe(true);
});

test("rejects wrong order, duplicates and incomplete answers", () => {
  expect(isCorrect(g, ["b", "a", "c", "d"])).toBe(false);
  expect(isCorrect(g, ["a", "b", "b", "d"])).toBe(false);
  expect(isCorrect(g, ["a", "b", "c"])).toBe(false);
});

test("prefix check for step-by-step feedback", () => {
  expect(isValidPrefix(g, [])).toBe(true);
  expect(isValidPrefix(g, ["a", "c"])).toBe(true);
  expect(isValidPrefix(g, ["a", "d"])).toBe(false);
});
