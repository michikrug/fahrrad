import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Layout, Participant } from "../types";
import { CURB, ROAD_HALF, crossPath, lanePath } from "./roads";

export interface Actor {
  p: Participant;
  obj: THREE.Group;
  path: THREE.Curve<THREE.Vector3>;
  clear: number; // distance along the path after which the junction is left
  pin: HTMLDivElement;
  /** Arrow on the ground showing where this one wants to go. Hidden once it sets off. */
  route: THREE.Mesh;
  color: number; // also used for its chip in the UI
  /** Blinker lamps (cars) or stretched-out arm (bikes) per side. */
  signal: Record<"left" | "right", THREE.Object3D[]>;
  enter?: number;
  d: number; // current distance along the path
  len: number; // metres along the driving direction, for the near-miss check
  speed: number; // m/s in the animation
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

const blinkMat = new THREE.MeshBasicMaterial({ color: 0xffa000 });

/** Blinker lamps at the four corners. Models face +z, so the driver's left is +x. */
function blinkers(halfW: number, halfL: number, y: number) {
  const sig = { left: [] as THREE.Object3D[], right: [] as THREE.Object3D[] };
  // Oversized like the signs, so the blinking reads from the bird's-eye view.
  const geo = new THREE.BoxGeometry(0.45, 0.3, 0.2);
  for (const [side, x] of [["left", halfW], ["right", -halfW]] as const) {
    for (const z of [halfL, -halfL]) {
      const m = new THREE.Mesh(geo, blinkMat);
      m.position.set(x, y, z);
      m.visible = false;
      sig[side].push(m);
    }
  }
  return sig;
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

/** Cylinder from a to b — for frames and limbs. */
function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), m);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

/** Handlebar centre in bike model space — the ego view hangs the bell and your pin there. */
export const BAR = new THREE.Vector3(0, 0.98, 0.36);

/**
 * Kid on a bike, built to read from above: the wide handlebar with both arms reaching for it,
 * knees and saddle give the typical bike-and-rider silhouette that a box and a ball didn't.
 * Faces +z; the driver's left is +x. The ego view shows this same model with the `rider` parts hidden.
 */
function bike(shirt: number, helmet: number) {
  const g = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const frame = lambert(0xd33f3f);
  const steel = lambert(0x9aa3ab);
  const top = lambert(shirt);
  const trousers = lambert(0x2e3a59);

  const wheel = new THREE.TorusGeometry(0.33, 0.06, 6, 20).rotateY(Math.PI / 2);
  // Mudguards in frame colour: from above, the black tyres vanish on asphalt — the red stripes don't.
  const guard = new THREE.TorusGeometry(0.41, 0.025, 4, 12, 1.6).rotateZ(Math.PI / 2 - 0.8).rotateY(Math.PI / 2).scale(1.6, 1, 1);
  for (const z of [-0.55, 0.55]) {
    const w = new THREE.Mesh(wheel, black);
    w.position.set(0, 0.38, z);
    const m = new THREE.Mesh(guard, frame);
    m.position.copy(w.position);
    g.add(w, m);
  }
  // Front lamp and rear reflector (a road-safe bike has both) — also show which way the bike faces.
  // Lamp on the handlebar, reflector behind the saddle: lower down they would sit inside the wheels.
  g.add(box(0.08, 0.07, 0.06, lambert(0xfff6c0), 0, 0.93, 0.43), box(0.08, 0.05, 0.03, lambert(0xe02020), 0, 0.83, -0.37));
  // Diamond frame and fork.
  const rearHub = v(0, 0.38, -0.55), crank = v(0, 0.36, -0.05), seat = v(0, 0.84, -0.2);
  const headTop = v(0, 0.86, 0.36), headLow = v(0, 0.7, 0.4), frontHub = v(0, 0.38, 0.55);
  for (const [a, b] of [[rearHub, crank], [rearHub, seat], [crank, seat], [crank, headLow], [seat, headTop], [headLow, headTop]])
    g.add(tube(a, b, 0.035, frame));
  for (const x of [-0.05, 0.05]) g.add(tube(headLow.clone().setX(x), frontHub.clone().setX(x), 0.025, steel));
  g.add(box(0.14, 0.05, 0.28, black, 0, 0.88, -0.22)); // saddle

  // Handlebar: stem plus a wide bar with grips — the clearest "bike" cue from above.
  const bar = BAR;
  g.add(tube(headTop, bar, 0.03, steel), tube(bar.clone().setX(-0.31), bar.clone().setX(0.31), 0.022, steel));
  for (const x of [-0.27, 0.27]) g.add(tube(bar.clone().setX(x - 0.05), bar.clone().setX(x + 0.05), 0.032, black));

  // Rider: legs to the pedals, torso leaning forward, head with helmet. Tagged `rider`: the ego
  // camera sits inside them, so they hide there. Both arms too: they start right next to the
  // camera, so on the grips they fill a screen corner and stretched out they hide whoever is beside you.
  const body: THREE.Object3D[] = [];
  for (const x of [-0.11, 0.11]) {
    const hip = v(x, 0.95, -0.17), knee = v(x * 1.8, 0.82, 0.14), pedal = v(x * 1.3, 0.38, 0); // knees out: visible from above
    body.push(tube(hip, knee, 0.065, trousers), tube(knee, pedal, 0.055, trousers));
  }
  const torso = box(0.32, 0.46, 0.22, top, 0, 1.2, -0.1); // slim, so the bar stays visible from behind
  torso.rotation.x = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), lambert(0xf1c27d));
  head.position.set(0, 1.58, 0.02);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(helmet));
  hat.position.set(0, 1.61, 0.02);
  body.push(torso, head, hat);
  for (const o of body) o.userData.rider = true;
  g.add(...body);

  // Arms: on the grips while riding; the signalling arm swaps for one stretched out sideways.
  const arms = { left: [] as THREE.Object3D[], right: [] as THREE.Object3D[] };
  for (const [side, x] of [["left", 1], ["right", -1]] as const) {
    const shoulder = v(x * 0.17, 1.36, 0.0);
    const rest = tube(shoulder, v(x * 0.27, bar.y + 0.03, bar.z), 0.05, top);
    rest.userData.rest = true; // shown unless this side signals
    const out = box(0.6, 0.11, 0.11, top, x * 0.5, shoulder.y, shoulder.z);
    out.visible = false;
    for (const a of [rest, out]) a.userData.rider = a.userData.arm = true;
    g.add(rest, out);
    arms[side].push(rest, out);
  }
  g.userData.signal = arms;
  g.traverse((o) => (o.castShadow = true));
  // ponytail: 1.4× real size so bikes stay readable from the bird's-eye view; revisit if ego view looks off.
  g.scale.setScalar(1.4);
  return g;
}

// [width, length] in metres; bikes include the 1.4× display scale.
const SIZE = { car: [1.8, 4.2], bus: [2.5, 11], bike: [0.9, 2.2], player: [0.9, 2.2], pedestrian: [0.8, 0.8] } as const;
// Slower than real life so kids can follow; bikes visibly slower than cars.
const SPEED = { car: 7, bus: 5, bike: 4.5, player: 4.5, pedestrian: 2.5 } as const;

function walker(shirt: number) {
  const g = new THREE.Group();
  for (const x of [-0.12, 0.12]) g.add(box(0.16, 0.8, 0.18, lambert(0x2e3a59), x, 0.4, 0));
  g.add(box(0.5, 0.65, 0.28, lambert(shirt), 0, 1.12, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), lambert(0xe0a878));
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  g.scale.setScalar(1.5); // readability boost, like the bikes
  return g;
}

/**
 * Flat ribbon with an arrow head along the first part of a path — through the junction and a bit beyond.
 * Lets kids read intent (straight/left/right) the way they would read a blinker or hand signal.
 */
function routeArrow(path: THREE.Curve<THREE.Vector3>, from: number, to: number, color: number, y: number) {
  const W = 0.35, HEAD = 1.2, N = 40;
  const total = path.getLength();
  const at = (d: number) => {
    const u = Math.min(d / total, 1);
    const t = path.getTangentAt(u);
    return { p: path.getPointAt(u), side: new THREE.Vector3(-t.z, 0, t.x).normalize(), t };
  };
  const pos: number[] = [];
  const idx: number[] = [];
  const shaftEnd = to - HEAD;
  for (let i = 0; i <= N; i++) {
    const { p, side } = at(from + ((shaftEnd - from) * i) / N);
    pos.push(p.x + side.x * W, y, p.z + side.z * W, p.x - side.x * W, y, p.z - side.z * W);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const { p, side } = at(shaftEnd);
  const tip = at(to).p;
  const base = pos.length / 3;
  pos.push(p.x + side.x * W * 3, y, p.z + side.z * W * 3, p.x - side.x * W * 3, y, p.z - side.z * W * 3, tip.x, y, tip.z);
  idx.push(base, base + 1, base + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  return new THREE.Mesh(geo, m);
}

let routeCount = 0;

/** Body colour; also used for the route arrow and the chip. Explanations name it ("das rote Auto"). */
export const colorOf = (p: Participant) =>
  p.kind === "player" ? 0xff7a00 : p.kind === "bus" ? 0xf2c230 : p.kind === "pedestrian" ? (p.color ?? 0xe23d6e)
  : p.kind === "bike" ? (p.color ?? 0x6a4fc4) : (p.color ?? 0x2f6fd6);

export function buildActor(p: Participant, layout: Layout): Actor {
  const model =
    p.kind === "car" ? car(p.color ?? 0x2f6fd6)
    : p.kind === "bus" ? bus()
    : p.kind === "player" ? bike(0xff7a00, 0x22aa44)
    : p.kind === "pedestrian" ? walker(p.color ?? 0xe23d6e)
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

  // Pin and "Du" share one stacked label so they never overlap at any zoom.
  const tag = document.createElement("div");
  tag.className = "tag";
  const pin = document.createElement("div");
  pin.className = "pin";
  tag.appendChild(pin);
  if (p.kind === "player") {
    const you = document.createElement("div");
    you.className = "you";
    you.textContent = "Du";
    tag.appendChild(you);
  }
  const label = new CSS2DObject(tag);
  // Local units: bike models are scaled 1.4×, so their label sits lower in model space.
  // Bikes: high enough that the label doesn't cover the rider in the oblique bird view.
  label.position.y = p.kind === "bus" ? 4.2 : isBike ? 2.4 : p.kind === "pedestrian" ? 1.9 : 2.6;
  label.userData.rider = true; // ego view: your own pin moves to the handlebar
  model.add(label);

  let signal: Actor["signal"] = model.userData.signal ?? { left: [], right: [] };
  if (p.kind === "car" || p.kind === "bus") {
    signal = p.kind === "car" ? blinkers(0.85, 2.05, 0.75) : blinkers(1.2, 5.45, 1.0);
    for (const m of [...signal.left, ...signal.right]) model.add(m);
  }

  const { path, clear, enter } =
    p.kind === "pedestrian"
      ? crossPath(layout, p.arm, p.side ?? 1)
      : lanePath(
          layout, p.arm, p.move ?? "straight", isBike ? ROAD_HALF - 0.7 : ROAD_HALF / 2, l, p.inRing, p.back,
          // § 9 Abs. 1 StVO: left-turners "bis zur Mitte einordnen" — bikes wait just right of the centre line.
          isBike && p.move === "left" && !layout.roundabout ? 0.9 : undefined,
        );
  const color = colorOf(p);
  // Start just ahead of the vehicle, end a few metres after the junction. Each arrow a hair higher
  // than the last so crossing arrows don't z-fight. All sit above sidewalk height: pedestrians walk
  // there, and bikes turn so close to the curb that the arrowhead reaches over the corner.
  const y = CURB + 0.02 + (routeCount++ % 10) * 0.004;
  const route = routeArrow(path, p.kind === "pedestrian" ? 0.4 : l / 2 + 0.3, Math.min(clear + 4, path.getLength()), color, y);
  const actor: Actor = { p, obj: model, path, clear, enter, route, color, pin, signal, d: 0, len: l, speed: SPEED[p.kind] };
  placeAt(actor, 0);
  return actor;
}

/**
 * Blinkers flash and arms stay out while the intent should be shown:
 * turning at a junction → before and (cars) during the turn;
 * roundabout → only when leaving it (StVO: no blinker on entry, signal right on exit).
 */
export function updateSignal(a: Actor, time: number, roundabout: boolean) {
  const isBike = a.p.kind === "bike" || a.p.kind === "player";
  let side: "left" | "right" | null = null;
  if (roundabout) {
    if (a.d > Math.max(a.enter ?? 0, a.clear - 9) && a.d < a.clear + 1) side = "right";
  } else if (a.p.move === "left" || a.p.move === "right") {
    // Kids need both hands for the turn itself, so the arm only shows while waiting.
    if (isBike ? a.d < 0.5 : a.d < a.clear) side = a.p.move;
  }
  const on = isBike || time % 0.8 < 0.45; // ~1.25 Hz like a real blinker
  for (const s of ["left", "right"] as const)
    for (const m of a.signal[s]) m.visible = m.userData.rest ? side !== s : side === s && on;
}

/** Put the actor `d` metres along its path, facing forward. */
export function placeAt(a: Actor, d: number) {
  a.d = d;
  const len = a.path.getLength();
  const u = Math.min(d / len, 1);
  a.obj.position.copy(a.path.getPointAt(u));
  // Look a bit ahead; at the very end look along the last segment instead.
  const ahead = a.path.getPointAt(Math.min(u + 0.5 / len, 1));
  if (ahead.distanceToSquared(a.obj.position) > 1e-6) a.obj.lookAt(ahead);
}
