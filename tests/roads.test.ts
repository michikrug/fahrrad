import { expect, test } from "bun:test";
import { scenarios } from "../src/content/scenarios";
import { ARMS, DIR, ENTRY_R, RING_OUT, ROAD_HALF, lanePath, rightOf } from "../src/scene/roads";
import type { Move } from "../src/types";

// Asphalt of a roundabout: the ring disc, the straight arms, and the rounded pockets at each entry corner.
// `m` keeps that much room to the curb (half a vehicle's width).
const C = [Math.sqrt((RING_OUT + ENTRY_R) ** 2 - (ROAD_HALF + ENTRY_R) ** 2), ROAD_HALF + ENTRY_R]; // corner centre
function onRoad(x: number, z: number, m: number) {
  if (Math.hypot(x, z) <= RING_OUT - m) return true;
  return ARMS.some((a) => {
    const along = x * DIR[a].x + z * DIR[a].z;
    const lat = Math.abs(x * rightOf(DIR[a]).x + z * rightOf(DIR[a]).z);
    if (along < 0) return false;
    if (lat <= ROAD_HALF - m) return true;
    // Pocket: between the arm and the corner centre's direction, and clear of the rounded curb.
    return lat / along <= C[1] / C[0] && Math.hypot(along - C[0], lat - C[1]) >= ENTRY_R + m;
  });
}

test("roundabout lanes keep clear of the curb", () => {
  const layout = scenarios.find((s) => s.layout.roundabout)!.layout;
  // Offsets and half widths as in actors.ts: bikes ride near the curb, cars mid-lane.
  for (const [offset, half] of [[ROAD_HALF - 0.7, 0.3], [ROAD_HALF / 2, 0.9]])
    for (const from of ARMS)
      for (const move of ["straight", "left", "right"] as Move[])
        for (const inRing of [false, true])
          for (const p of lanePath(layout, from, move, offset, 2, inRing).path.getSpacedPoints(400))
            expect(onRoad(p.x, p.z, half), `${from} ${move} offset ${offset} inRing ${inRing} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`).toBe(true);
});
