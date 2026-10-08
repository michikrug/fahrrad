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

// Settings flags, each under its own key so resetting progress doesn't flip them.
function loadFlag(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function saveFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // see saveProgress
  }
}
// Free choice of levels (for parents/teachers or kids who already know the basics).
export const loadFree = () => loadFlag("fahrrad.free.v1", false);
export const saveFree = (on: boolean) => saveFlag("fahrrad.free.v1", on);
// Sound effects; on by default, a class full of tablets wants them off.
export const loadSound = () => loadFlag("fahrrad.sound.v1", true);
export const saveSound = (on: boolean) => saveFlag("fahrrad.sound.v1", on);
// Read every task and result aloud on its own. Off by default: a class of tablets all talking at once.
export const loadAutoRead = () => loadFlag("fahrrad.read.v1", false);
export const saveAutoRead = (on: boolean) => saveFlag("fahrrad.read.v1", on);

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
