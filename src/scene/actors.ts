import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Participant } from "../types";
import { ROAD_HALF, lanePath } from "./roads";

export interface Actor {
  p: Participant;
  obj: THREE.Group;
  path: THREE.CurvePath<THREE.Vector3>;
  pin: HTMLDivElement;
}

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
const black = lambert(0x222222);
const glass = lambert(0x9cc9e8);

function box(w: number, h: number, l: number, m: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function wheels(g: THREE.Group, r: number, halfW: number, zs: number[]) {
  const geo = new THREE.CylinderGeometry(r, r, 0.3, 14).rotateZ(Math.PI / 2);
  for (const z of zs) for (const x of [-halfW, halfW]) {
    const w = new THREE.Mesh(geo, black);
    w.position.set(x, r, z);
    g.add(w);
  }
}

// All models face +z, so Object3D.lookAt() points them along the path.
function car(color: number) {
  const g = new THREE.Group();
  g.add(box(1.8, 0.7, 4.2, lambert(color), 0, 0.65, 0));
  g.add(box(1.6, 0.6, 2.2, glass, 0, 1.3, -0.3));
  wheels(g, 0.35, 0.9, [-1.3, 1.3]);
  return g;
}

function bus() {
  const g = new THREE.Group();
  g.add(box(2.5, 2.6, 11, lambert(0xf2c230), 0, 1.7, 0));
  g.add(box(2.55, 0.9, 10, glass, 0, 2.3, 0.2));
  wheels(g, 0.5, 1.2, [-3.5, 3.5]);
  return g;
}

function bike(shirt: number, helmet: number) {
  const g = new THREE.Group();
  const wheel = new THREE.TorusGeometry(0.33, 0.05, 6, 18).rotateY(Math.PI / 2);
  for (const z of [-0.55, 0.55]) {
    const w = new THREE.Mesh(wheel, black);
    w.position.set(0, 0.38, z);
    g.add(w);
  }
  g.add(box(0.08, 0.08, 1.1, lambert(0xd33f3f), 0, 0.7, 0));
  // Rider: body, head, helmet — chunky so kids recognise a child on a bike.
  g.add(box(0.4, 0.6, 0.3, lambert(shirt), 0, 1.15, -0.1));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), lambert(0xf1c27d));
  head.position.set(0, 1.6, -0.05);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(helmet));
  hat.position.set(0, 1.63, -0.05);
  g.add(head, hat);
  g.traverse((o) => (o.castShadow = true));
  // ponytail: 1.4× real size so bikes stay readable from the bird's-eye view; revisit if ego view looks off.
  g.scale.setScalar(1.4);
  return g;
}

const SIZE = { car: [1.8, 4.2], bus: [2.5, 11], bike: [0.6, 1.6], player: [0.6, 1.6] } as const;

export function buildActor(p: Participant): Actor {
  const model =
    p.kind === "car" ? car(p.color ?? 0x2f6fd6)
    : p.kind === "bus" ? bus()
    : p.kind === "player" ? bike(0xff7a00, 0x22aa44)
    : bike(p.color ?? 0x6a4fc4, 0x3355cc);
  const [w, l] = SIZE[p.kind];
  const isBike = p.kind === "bike" || p.kind === "player";

  // Invisible, oversized hit box: small fingers and tiny bikes are hard to hit.
  // Raycaster ignores `visible`, so a hidden mesh still catches taps.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w * 1.6, 2.5), 3, Math.max(l * 1.3, 3)));
  hit.position.y = 1.5;
  hit.visible = false;
  hit.userData.actorId = p.id;
  model.add(hit);

  const pin = document.createElement("div");
  pin.className = "pin";
  const label = new CSS2DObject(pin);
  label.position.y = p.kind === "bus" ? 4.2 : 2.8;
  model.add(label);
  if (p.kind === "player") {
    const you = document.createElement("div");
    you.className = "you";
    you.textContent = "Du";
    const youLabel = new CSS2DObject(you);
    youLabel.position.y = 2.1;
    model.add(youLabel);
  }

  const path = lanePath(p.arm, p.move, isBike ? ROAD_HALF - 0.7 : ROAD_HALF / 2, ROAD_HALF + 1.5 + l / 2);
  model.position.copy(path.getPointAt(0));
  model.lookAt(path.getPointAt(0.01));
  return { p, obj: model, path, pin };
}
