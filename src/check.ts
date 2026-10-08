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
