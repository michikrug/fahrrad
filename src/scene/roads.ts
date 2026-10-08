import * as THREE from "three";
import type { Arm, ArmSpec, Layout, Move } from "../types";

export const ARMS: Arm[] = ["N", "E", "S", "W"];
export const ROAD_HALF = 3.5; // two 3.5 m lanes
export const WALK = 2.5;
export const CURB = 0.15;
export const ARM_LEN = 45;
// Roundabout: island radius and outer ring radius.
const RING_IN = 5;
export const RING_OUT = 11.5;

/** Unit vector from the junction centre out along an arm. */
export const DIR: Record<Arm, THREE.Vector3> = {
  N: new THREE.Vector3(0, 0, -1),
  E: new THREE.Vector3(1, 0, 0),
  S: new THREE.Vector3(0, 0, 1),
  W: new THREE.Vector3(-1, 0, 0),
};

/** Right-hand side of a heading (y up, so right of north is east). */
export const rightOf = (h: THREE.Vector3) => new THREE.Vector3(-h.z, 0, h.x);

/** Arm a vehicle leaves through. Arms are clockwise, so a right turn is one step back. */
export function exitArm(from: Arm, move: Move): Arm {
  const step = { right: 3, straight: 2, left: 1 }[move];
  return ARMS[(ARMS.indexOf(from) + step) % 4];
}

/** Arms with a pedestrian crossing get a band right after the junction edge. */
const hasCrossing = (a?: ArmSpec) => !!a && (!!a.zebra || !!a.light);
/** Distance from the centre where an arm's road starts. */
export const edgeDist = (layout: Layout) => (layout.roundabout ? RING_OUT : ROAD_HALF);
/** Pedestrian crossing band [from, to] along the arm. */
export const crossingBand = (layout: Layout) => [edgeDist(layout) + 1, edgeDist(layout) + 4] as const;
/** Where the stop/wait line is on an arm — behind the crossing if there is one. */
export const stopLine = (layout: Layout, arm: Arm) =>
  hasCrossing(layout.arms[arm]) ? crossingBand(layout)[1] + 0.6 : edgeDist(layout) + 0.4;

export interface Lane {
  path: THREE.Curve<THREE.Vector3>;
  /** Distance along the path after which the junction is left behind. */
  clear: number;
  /** Roundabout: distance at which the ring is entered (0 if already on it). */
  enter?: number;
}

/**
 * Driving line from the waiting position through the junction and out.
 * `offset` = distance from road centre line (cars ~1.75, bikes near the curb).
 * `entryOffset` differs when the vehicle has moved over before turning (bikes turning left wait at the centre).
 */
export function lanePath(
  layout: Layout, from: Arm, move: Move, offset: number, len: number, inRing = false, back = 0, entryOffset = offset,
): Lane {
  const to = exitArm(from, move);
  const inRight = rightOf(DIR[from].clone().negate()).multiplyScalar(entryOffset);
  const outRight = rightOf(DIR[to]).multiplyScalar(offset);
  const P = (s: number) => DIR[from].clone().multiplyScalar(s).add(inRight);
  const Q = (s: number) => DIR[to].clone().multiplyScalar(s).add(outRight);
  const wait = stopLine(layout, from) + 0.8 + len / 2 + back;
  const edge = edgeDist(layout);

  if (layout.roundabout) {
    // Counter-clockwise seen from above, i.e. angle decreases. Ring lane keeps the same distance to the curb.
    const R = RING_OUT - (ROAD_HALF - offset);
    const angle = (a: Arm) => Math.atan2(DIR[a].z, DIR[a].x);
    const a0 = angle(from) - 0.45;
    let a1 = angle(to) + 0.45;
    while (a1 >= a0) a1 -= Math.PI * 2;
    const pts = inRing ? [] : [P(wait), P(edge + 1)];
    for (let a = a0; a > a1; a -= 0.2) pts.push(new THREE.Vector3(R * Math.cos(a), 0, R * Math.sin(a)));
    pts.push(Q(edge + 1), Q(edge + 6), Q(ARM_LEN));
    const path = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    return { path, clear: path.getLength() - (ARM_LEN - edge - 1), enter: inRing ? 0 : wait - edge };
  }

  const edgeIn = P(edge);
  const edgeOut = Q(edge);
  // Arms are perpendicular, so the two lane lines meet at inRight + outRight.
  const ctrl = move === "straight" ? edgeIn.clone().lerp(edgeOut, 0.5) : inRight.clone().add(outRight);
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(P(wait), edgeIn));
  path.add(new THREE.QuadraticBezierCurve3(edgeIn, ctrl, edgeOut));
  path.add(new THREE.LineCurve3(edgeOut, Q(ARM_LEN)));
  return { path, clear: path.getCurveLengths()[1] };
}

/** Pedestrian walking across an arm on its crossing (or just past the junction if there is none). */
export function crossPath(layout: Layout, arm: Arm, side: 1 | -1): Lane {
  const [a, b] = crossingBand(layout);
  // Walkers from opposite sides keep to their right half of the crossing, so they pass instead of colliding.
  const s = (hasCrossing(layout.arms[arm]) ? (a + b) / 2 : edgeDist(layout) + 1.5) + side * 0.6;
  // Start mid-sidewalk, clear of the sign posts at the curb.
  const across = rightOf(DIR[arm]).multiplyScalar(ROAD_HALF + 1.9);
  const at = DIR[arm].clone().multiplyScalar(s);
  const start = at.clone().addScaledVector(across, side);
  const end = at.clone().addScaledVector(across, -side);
  const path = new THREE.LineCurve3(start, end);
  return { path, clear: path.getLength() };
}

const mat = {
  asphalt: new THREE.MeshLambertMaterial({ color: 0x4a4d52 }),
  walk: new THREE.MeshLambertMaterial({ color: 0xc9c3b8 }),
  white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  island: new THREE.MeshLambertMaterial({ color: 0x6fb85a }),
};

/** Box lying on the ground, given its x/z extents. */
function slab(x0: number, x1: number, z0: number, z1: number, h: number, m: THREE.Material, y = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), m);
  mesh.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
  mesh.receiveShadow = true;
  return mesh;
}

/** Axis-aligned rect along an arm: `a..b` along the arm, `l0..l1` across it (towards rightOf(DIR)). */
function armRect(arm: Arm, a: number, b: number, l0: number, l1: number) {
  const d = DIR[arm];
  const r = rightOf(d);
  const p1 = d.clone().multiplyScalar(a).addScaledVector(r, l0);
  const p2 = d.clone().multiplyScalar(b).addScaledVector(r, l1);
  return [Math.min(p1.x, p2.x), Math.max(p1.x, p2.x), Math.min(p1.z, p2.z), Math.max(p1.z, p2.z)] as const;
}

/** Flat disc lying on the ground (roundabout asphalt). */
function ring(r0: number, r1: number, m: THREE.Material, y: number) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

/** Where the arm sidewalks of a roundabout start; the corner pieces fill everything inside. */
const RING_WALK_END = 13;

/**
 * Raised sidewalk corner between arm direction `u` and the arm to its right `v`: it follows the ring's
 * curb and both arms' road edges exactly and ends flush with the arm sidewalks, so nothing overlaps
 * (coplanar tops would flicker) and no grass shows through.
 */
function ringCorner(u: THREE.Vector3, v: THREE.Vector3) {
  const pts: [number, number][] = []; // (along u, along v)
  const arc = (r: number, from: number, to: number) => {
    for (let i = 0; i <= 16; i++) {
      const t = from + ((to - from) * i) / 16;
      pts.push([r * Math.cos(t), r * Math.sin(t)]);
    }
  };
  const [inner, outer, end] = [ROAD_HALF, ROAD_HALF + WALK, RING_WALK_END];
  const rOut = RING_OUT + WALK;
  const a0 = Math.atan2(inner, Math.sqrt(RING_OUT ** 2 - inner ** 2)); // ring curb meets the road edge
  const a1 = Math.atan2(outer, Math.sqrt(rOut ** 2 - outer ** 2)); // outer arc meets the sidewalk's back edge
  pts.push([end, inner], [end, outer]);
  arc(rOut, a1, Math.PI / 2 - a1);
  pts.push([outer, end], [inner, end]);
  arc(RING_OUT, Math.PI / 2 - a0, a0);
  // Shape is drawn in x/-z so that rotating it flat makes the extrusion point up.
  const shape = new THREE.Shape(pts.map(([a, b]) => {
    const w = u.clone().multiplyScalar(a).addScaledVector(v, b);
    return new THREE.Vector2(w.x, -w.z);
  }));
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: CURB, bevelEnabled: false }), mat.walk);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildRoads(layout: Layout): THREE.Group {
  const g = new THREE.Group();
  const edge = edgeDist(layout);
  const isNS = (arm: Arm) => arm === "N" || arm === "S";

  if (layout.roundabout) {
    g.add(ring(0, RING_OUT, mat.asphalt, 0.02));
    const island = new THREE.Mesh(new THREE.CylinderGeometry(RING_IN, RING_IN + 0.3, 0.3, 48), mat.island);
    island.position.y = 0.15;
    island.receiveShadow = true;
    g.add(island);
    // Sidewalk round the ring, one corner piece between each pair of neighbouring arms (roundabouts have all four).
    for (const arm of ARMS) g.add(ringCorner(DIR[arm], rightOf(DIR[arm])));
  } else {
    g.add(slab(-edge, edge, -edge, edge, 0.02, mat.asphalt));
  }

  for (const arm of ARMS) {
    const spec = layout.arms[arm];
    if (!spec) {
      // Missing arm (T-junction): sidewalk runs straight across its mouth.
      // N/S strips own the corner squares, so only N/S mouths need the full width.
      const w = isNS(arm) ? ROAD_HALF + WALK : ROAD_HALF;
      if (!layout.roundabout) g.add(slab(...armRect(arm, ROAD_HALF, ROAD_HALF + WALK, -w, w), CURB, mat.walk));
      continue;
    }
    const start = edge - (layout.roundabout ? 1 : 0);
    g.add(slab(...armRect(arm, start, ARM_LEN, -ROAD_HALF, ROAD_HALF), 0.02, mat.asphalt));
    // Sidewalks on both sides. N/S ones start at the road edge and so also fill the corner
    // squares; E/W start past them to avoid coplanar z-fighting.
    const walkStart = layout.roundabout ? RING_WALK_END : isNS(arm) ? ROAD_HALF : ROAD_HALF + WALK;
    g.add(slab(...armRect(arm, walkStart, ARM_LEN, ROAD_HALF, ROAD_HALF + WALK), CURB, mat.walk));
    g.add(slab(...armRect(arm, walkStart, ARM_LEN, -ROAD_HALF - WALK, -ROAD_HALF), CURB, mat.walk));

    const line = (a: number, b: number, l0: number, l1: number) => g.add(slab(...armRect(arm, a, b, l0, l1), 0.01, mat.white, 0.02));
    const stop = stopLine(layout, arm);
    // Dashed centre line, starting behind the stop line like real markings.
    if (!spec.oneway) for (let s = stop + 2; s < ARM_LEN; s += 6) line(s, s + 3, -0.06, 0.06);

    // Stop line across the arriving lane (left half of the road seen from outside = right lane of arriving traffic):
    // solid "Haltlinie" (Z. 294) at stop signs and lights, dashed "Wartelinie" (Z. 341) at give-way.
    const signs = spec.signs ?? [];
    if (signs.includes("206") || spec.light) line(stop - 0.25, stop + 0.25, -ROAD_HALF, 0);
    else if (signs.includes("205") && !layout.roundabout) {
      for (let l = -ROAD_HALF + 0.1; l < -0.3; l += 1) line(stop - 0.25, stop + 0.25, l, l + 0.5);
    }

    if (spec.zebra) {
      const [a, b] = crossingBand(layout);
      for (let l = -ROAD_HALF + 0.25; l < ROAD_HALF; l += 1) line(a, b, l, l + 0.5);
    }
  }
  return g;
}
