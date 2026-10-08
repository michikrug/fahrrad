import * as THREE from "three";
import type { Actor } from "./scene/actors";

/**
 * Calls `cb` with the tapped actor id (or "bell" for the handlebar bell). A tap must be short and nearly still —
 * otherwise kids rotating the camera would select vehicles by accident.
 */
export function listenForTaps(
  dom: HTMLElement,
  camera: THREE.Camera,
  targets: () => THREE.Object3D[],
  cb: (id: string) => void,
) {
  const down = new Map<number, { x: number; y: number; t: number }>();
  let multi = false; // a pinch is never a tap
  const ray = new THREE.Raycaster();

  dom.addEventListener("pointerdown", (e) => {
    down.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    if (down.size > 1) multi = true;
  });
  const end = (e: PointerEvent) => {
    const d = down.get(e.pointerId);
    down.delete(e.pointerId);
    if (!d) return;
    const wasMulti = multi;
    if (down.size === 0) multi = false;
    if (wasMulti || e.type !== "pointerup") return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 300) return;

    const r = dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(targets(), true);
    // The bell sits inside the handlebar's "yourself" hit box, so it wins regardless of distance.
    if (hits.some((h) => h.object.userData.bell)) return cb("bell");
    const hit = hits.find((h) => h.object.userData.actorId);
    if (hit) cb(hit.object.userData.actorId);
  };
  dom.addEventListener("pointerup", end);
  dom.addEventListener("pointercancel", end);
}

export interface Run {
  a: Actor;
  start: number; // seconds after "Los"
  started?: boolean;
}

/** Distance after which an actor's rear has left the junction square. */
const clearDist = (a: Actor) => a.clear + a.len / 2;

/** Moment the last actor has left the junction. */
export const clearTime = (runs: Run[]) => Math.max(...runs.map((r) => r.start + clearDist(r.a) / r.a.speed));

/** Groups drive one after another; members of a group drive together. */
export function schedule(groups: Actor[][], t0 = 0): { runs: Run[]; end: number } {
  const runs: Run[] = [];
  let t = t0;
  for (const g of groups) {
    let next = t;
    for (const a of g) {
      runs.push({ a, start: t });
      next = Math.max(next, t + clearDist(a) / a.speed);
    }
    t = next;
  }
  return { runs, end: t };
}

/** Closest approach of two driving lines: distance along each path and the spot — or null if they never meet. */
function conflictPoint(a: Actor, b: Actor): [number, number, THREE.Vector3] | null {
  const N = 150;
  const pa = a.path.getSpacedPoints(N);
  const pb = b.path.getSpacedPoints(N);
  let best = Infinity, ia = 0, ib = 0;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const d = pa[i].distanceToSquared(pb[j]);
    if (d < best) [best, ia, ib] = [d, i, j];
  }
  if (best > 1.5 ** 2) return null;
  return [(ia / N) * a.path.getLength(), (ib / N) * b.path.getLength(), pa[ia].clone().lerp(pb[ib], 0.5)];
}

/**
 * Wrong order: everyone up to the mistake drives as tapped, then the wrongly early one
 * and the one with priority set off timed to reach the crossing point together.
 * Returns null when their lines don't cross — then we just play the tapped order.
 */
export function nearMissSchedule(
  byId: Map<string, Actor>, tapped: string[], index: number, expected: string,
): { runs: Run[]; pair: [Actor, Actor]; at: THREE.Vector3 } | null {
  const x = byId.get(tapped[index])!;
  const y = byId.get(expected)!;
  const hit = conflictPoint(x, y);
  if (!hit) return null;
  const before = schedule(tapped.slice(0, index).map((id) => [byId.get(id)!]));
  const tx = hit[0] / x.speed, ty = hit[1] / y.speed;
  before.runs.push({ a: x, start: before.end + Math.max(0, ty - tx) }, { a: y, start: before.end + Math.max(0, tx - ty) });
  return { runs: before.runs, pair: [x, y], at: hit[2] };
}

/** Gap at which the watched pair freezes: close enough to scare, never touching. */
export const nearMissDist = (x: Actor, y: Actor) => ((x.len + y.len) / 2) * 0.55 + 1.2;

/**
 * Freeze only near the spot where the two lines cross. Otherwise a car following a bike on the
 * same approach (right-hook scenario) "nearly hits" it from behind before the actual conflict.
 */
export function isNearMiss(x: Actor, y: Actor, at: THREE.Vector3) {
  const close = x.obj.position.distanceTo(y.obj.position) < nearMissDist(x, y);
  return close && Math.min(x.obj.position.distanceTo(at), y.obj.position.distanceTo(at)) < 3;
}
