import { expect, test } from "bun:test";
import { firstMistake, isCorrect, isValidPrefix } from "../src/check";

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

test("firstMistake names who had priority", () => {
  expect(firstMistake(g, ["a", "b", "c", "d"])).toBeNull();
  expect(firstMistake(g, ["b", "a", "c", "d"])).toEqual({ index: 0, expected: ["a"] });
  expect(firstMistake(g, ["a", "d", "b", "c"])).toEqual({ index: 1, expected: ["b", "c"] });
  expect(firstMistake(g, ["a", "c", "d", "b"])).toEqual({ index: 2, expected: ["b"] });
});
