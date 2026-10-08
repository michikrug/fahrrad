import * as THREE from "three";
import type { Layout } from "../types";
import { ARMS, DIR, RING_OUT, ROAD_HALF, WALK, rightOf } from "./roads";

// Houses and trees along the roads. Seeded so every scenario looks the same each time.
const HOUSE_COLORS = [0xf4e1c1, 0xf2c6b4, 0xcfe3f2, 0xe6efc9, 0xf6d8e7, 0xfff1b5];
const geo = {
  house: new THREE.BoxGeometry(1, 1, 1),
  roof: new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4),
  trunk: new THREE.CylinderGeometry(0.2, 0.28, 2, 6),
  crown: new THREE.IcosahedronGeometry(1.6, 0),
};
const roofMat = new THREE.MeshLambertMaterial({ color: 0xb8492f });
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5232 });
const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f9b45, flatShading: true });
const houseMats = HOUSE_COLORS.map((color) => new THREE.MeshLambertMaterial({ color }));

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function house(r: () => number) {
  const g = new THREE.Group();
  const w = 4 + r() * 2, h = 3 + r() * 3;
  const body = new THREE.Mesh(geo.house, houseMats[Math.floor(r() * houseMats.length)]);
  body.scale.set(w, h, w);
  body.position.y = h / 2;
  const roof = new THREE.Mesh(geo.roof, roofMat);
  roof.scale.set(w, 2.5, w);
  roof.position.y = h + 1.25;
  for (const m of [body, roof]) (m.castShadow = true), (m.receiveShadow = true);
  g.add(body, roof);
  return g;
}

function tree(r: () => number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(geo.trunk, trunkMat);
  trunk.position.y = 1;
  const crown = new THREE.Mesh(geo.crown, crownMat);
  const s = 0.8 + r() * 0.5;
  crown.scale.setScalar(s);
  crown.position.y = 2 + 1.3 * s;
  for (const m of [trunk, crown]) m.castShadow = true;
  g.add(trunk, crown);
  return g;
}

/** Ground footprint (x/z extent, height flattened) of a house or tree, roof and crown included. */
function footprint(o: THREE.Object3D) {
  const b = new THREE.Box3().setFromObject(o);
  b.min.y = 0;
  b.max.y = 0;
  return b;
}

export function buildDecor(layout: Layout): THREE.Group {
  const g = new THREE.Group();
  const r = rng(7);
  const start = (layout.roundabout ? RING_OUT + WALK + 6 : 15);
  // Rows of neighbouring arms meet at the corners; skip whatever would overlap something already placed.
  const placed: THREE.Box3[] = [];
  for (const arm of ARMS) {
    const across = rightOf(DIR[arm]);
    // Without a road on this arm the houses stand right where it would be.
    const lats = layout.arms[arm] ? [1, -1].map((s) => s * (ROAD_HALF + WALK + 6)) : [0];
    for (const lat of lats) {
      for (let s = start; s < 42; s += 8 + r() * 3) {
        const item = r() < 0.55 ? house(r) : tree(r);
        item.position.copy(DIR[arm]).multiplyScalar(s).addScaledVector(across, lat + Math.sign(lat) * r() * 2);
        const box = footprint(item).expandByScalar(0.5);
        if (placed.some((b) => b.intersectsBox(box))) continue;
        placed.push(box);
        g.add(item);
      }
    }
  }
  if (layout.roundabout) g.add(tree(r)); // on the island
  return g;
}
