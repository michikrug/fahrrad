import * as THREE from "three";
import type { Arm, Layout, Move } from "../types";

export const ARMS: Arm[] = ["N", "E", "S", "W"];
export const ROAD_HALF = 3.5; // two 3.5 m lanes
const WALK = 2.5;
const CURB = 0.15;
const ARM_LEN = 45;

/** Unit vector from the junction centre out along an arm. */
export const DIR: Record<Arm, THREE.Vector3> = {
  N: new THREE.Vector3(0, 0, -1),
  E: new THREE.Vector3(1, 0, 0),
  S: new THREE.Vector3(0, 0, 1),
  W: new THREE.Vector3(-1, 0, 0),
};

/** Right-hand side of a heading (y up, so right of north is east). */
const rightOf = (h: THREE.Vector3) => new THREE.Vector3(-h.z, 0, h.x);

/** Arm a vehicle leaves through. Arms are clockwise, so a right turn is one step back. */
export function exitArm(from: Arm, move: Move): Arm {
  const step = { right: 3, straight: 2, left: 1 }[move];
  return ARMS[(ARMS.indexOf(from) + step) % 4];
}

/**
 * Driving line from the waiting position through the junction and out.
 * `offset` = distance from road centre line (cars ~1.75, bikes near the curb).
 */
export function lanePath(from: Arm, move: Move, offset: number, waitDist: number): THREE.CurvePath<THREE.Vector3> {
  const to = exitArm(from, move);
  const inRight = rightOf(DIR[from].clone().negate()).multiplyScalar(offset);
  const outRight = rightOf(DIR[to]).multiplyScalar(offset);
  const P = (s: number) => DIR[from].clone().multiplyScalar(s).add(inRight);
  const Q = (s: number) => DIR[to].clone().multiplyScalar(s).add(outRight);
  const edgeIn = P(ROAD_HALF);
  const edgeOut = Q(ROAD_HALF);
  // Arms are perpendicular, so the two lane lines meet at inRight + outRight.
  const ctrl = move === "straight" ? edgeIn.clone().lerp(edgeOut, 0.5) : inRight.clone().add(outRight);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(P(waitDist), edgeIn));
  path.add(new THREE.QuadraticBezierCurve3(edgeIn, ctrl, edgeOut));
  path.add(new THREE.LineCurve3(edgeOut, Q(ARM_LEN)));
  return path;
}

const mat = {
  asphalt: new THREE.MeshLambertMaterial({ color: 0x4a4d52 }),
  walk: new THREE.MeshLambertMaterial({ color: 0xc9c3b8 }),
  white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
};

/** Box lying on the ground, given its x/z extents. */
function slab(x0: number, x1: number, z0: number, z1: number, h: number, m: THREE.Material, y = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), m);
  mesh.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
  mesh.receiveShadow = true;
  return mesh;
}

/** Axis-aligned rect along an arm: `a..b` along the arm, `l0..l1` across it. */
function armRect(arm: Arm, a: number, b: number, l0: number, l1: number) {
  const d = DIR[arm];
  const r = rightOf(d); // across direction, sign irrelevant for rects
  const p1 = d.clone().multiplyScalar(a).addScaledVector(r, l0);
  const p2 = d.clone().multiplyScalar(b).addScaledVector(r, l1);
  return [Math.min(p1.x, p2.x), Math.max(p1.x, p2.x), Math.min(p1.z, p2.z), Math.max(p1.z, p2.z)] as const;
}

export function buildRoads(layout: Layout): THREE.Group {
  const g = new THREE.Group();
  g.add(slab(-ROAD_HALF, ROAD_HALF, -ROAD_HALF, ROAD_HALF, 0.02, mat.asphalt));
  for (const arm of ARMS) {
    if (!layout.arms[arm]) continue;
    g.add(slab(...armRect(arm, ROAD_HALF, ARM_LEN, -ROAD_HALF, ROAD_HALF), 0.02, mat.asphalt));
    // Sidewalks on both sides. N/S ones start at the road edge and so also fill the
    // corner squares; E/W start past them to avoid coplanar z-fighting.
    const start = arm === "N" || arm === "S" ? ROAD_HALF : ROAD_HALF + WALK;
    g.add(slab(...armRect(arm, start, ARM_LEN, ROAD_HALF, ROAD_HALF + WALK), CURB, mat.walk));
    g.add(slab(...armRect(arm, start, ARM_LEN, -ROAD_HALF - WALK, -ROAD_HALF), CURB, mat.walk));
    // Dashed centre line, starting a bit back from the junction like real markings.
    for (let s = ROAD_HALF + 4; s < ARM_LEN; s += 6) {
      g.add(slab(...armRect(arm, s, s + 3, -0.06, 0.06), 0.01, mat.white, 0.02));
    }
  }
  return g;
}
