import { expect, test } from "bun:test";
import * as THREE from "three";
import { scenarios } from "../src/content/scenarios";
import { buildDecor } from "../src/scene/decor";

test("houses and trees never overlap", () => {
  const ground = (o: THREE.Object3D) => {
    const b = new THREE.Box3().setFromObject(o);
    return (b.min.y = b.max.y = 0), b;
  };
  for (const s of scenarios) {
    const boxes = buildDecor(s.layout).children.map(ground);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) expect(boxes[i].intersectsBox(boxes[j]), `${s.id}: items ${i} and ${j}`).toBe(false);
  }
});
