import type { Level } from "./types";

// Progress lives in localStorage only — no accounts, nothing leaves the device.
// Bump the key version if the shape changes; old progress is then simply ignored.

export interface Result {
  solved: boolean;
  firstTry: boolean; // solved without a wrong answer before — earns the star
}
export type Progress = Record<string, Result>;

const KEY = "fahrrad.progress.v1";
/** Share of a level's scenarios that must be solved to unlock the next level. */
export const UNLOCK_SHARE = 0.8;

export function loadProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {}; // corrupt or blocked storage: start fresh rather than crash
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode / full storage: progress just isn't kept.
  }
}

/** Merge one answer; a star once earned is never lost by replaying. */
export function record(p: Progress, id: string, ok: boolean, firstTry: boolean): Progress {
  const old = p[id];
  return { ...p, [id]: { solved: ok || !!old?.solved, firstTry: (ok && firstTry) || !!old?.firstTry } };
}

// Free choice of levels (for parents/teachers or kids who already know the basics). Own key, so
// resetting progress doesn't flip it.
const FREE_KEY = "fahrrad.free.v1";
export function loadFree() {
  try {
    return localStorage.getItem(FREE_KEY) === "1";
  } catch {
    return false;
  }
}
export function saveFree(on: boolean) {
  try {
    localStorage.setItem(FREE_KEY, on ? "1" : "0");
  } catch {
    // see saveProgress
  }
}

export function levelStats(level: Level, p: Progress) {
  const n = level.scenarios.length;
  const solved = level.scenarios.filter((s) => p[s.id]?.solved).length;
  const stars = level.scenarios.filter((s) => p[s.id]?.firstTry).length;
  return { n, solved, stars };
}

export function isUnlocked(levels: Level[], i: number, p: Progress) {
  if (i === 0) return true;
  const { n, solved } = levelStats(levels[i - 1], p);
  return solved >= Math.ceil(n * UNLOCK_SHARE);
}
