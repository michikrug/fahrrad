// Pure answer check, no three.js — so it is testable with `bun test`.
// The solution is a list of groups: members of one group may drive at the same time,
// so any order inside a group is accepted (e.g. two oncoming cars both going straight).

export type Groups = string[][];

/** Is `tapped` (possibly incomplete) still a valid prefix of the solution? */
export function isValidPrefix(groups: Groups, tapped: string[]): boolean {
  let i = 0;
  for (const group of groups) {
    const left = new Set(group);
    while (left.size && i < tapped.length) {
      if (!left.delete(tapped[i])) return false;
      i++;
    }
    if (i === tapped.length) return true;
  }
  return i === tapped.length;
}

export function isCorrect(groups: Groups, tapped: string[]): boolean {
  return tapped.length === groups.flat().length && isValidPrefix(groups, tapped);
}

/**
 * First wrong tap and who should have gone there instead.
 * Used to stage the near-miss: the wrongly early one meets the one with priority.
 */
export function firstMistake(groups: Groups, tapped: string[]): { index: number; expected: string[] } | null {
  const i = tapped.findIndex((_, n) => !isValidPrefix(groups, tapped.slice(0, n + 1)));
  if (i < 0) return null;
  const done = new Set(tapped.slice(0, i));
  // The prefix before i is valid, so the first group with untapped members is the current one.
  const expected = groups.map((g) => g.filter((id) => !done.has(id))).find((g) => g.length)!;
  return { index: i, expected };
}
