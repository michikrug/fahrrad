import * as THREE from "three";
import type { Arm, ArmSpec, Layout, Phase } from "../types";
import { DIR, ROAD_HALF, WALK, crossingBand, rightOf, stopLine } from "./roads";
import { signPost } from "./signs";

type Lamp = "red" | "yellow" | "green";
const COLORS: Record<Lamp, number> = { red: 0xff2a1a, yellow: 0xffb000, green: 0x22e05a };
const LIT: Record<Phase, Lamp[]> = { red: ["red"], redyellow: ["red", "yellow"], yellow: ["yellow"], green: ["green"] };

const housingMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
const poleMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });

// Soft radial halo around a lit lamp — cheaper than bloom post-processing on tablets.
const glowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

type Icon = "bike" | "stand" | "walk";

/**
 * White pictogram on black, tinted by the lamp colour — like real lenses, where only the symbol lights up.
 * ponytail: shapes drawn from memory and simplified, not to the RiLSA templates.
 */
const iconTex = (() => {
  const cache = new Map<Icon, THREE.CanvasTexture>();
  return (icon: Icon) => {
    if (cache.has(icon)) return cache.get(icon)!;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#000";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = x.fillStyle = "#fff";
    x.lineCap = x.lineJoin = "round";
    const line = (w: number, ...pts: number[]) => {
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
      x.stroke();
    };
    const dot = (cx: number, cy: number, r: number) => (x.beginPath(), x.arc(cx, cy, r, 0, Math.PI * 2), x.fill());
    if (icon === "bike") {
      for (const cx of [36, 92]) (x.beginPath(), (x.lineWidth = 8), x.arc(cx, 80, 20, 0, Math.PI * 2), x.stroke());
      line(8, 36, 80, 58, 80, 82, 56, 50, 56, 36, 80); // frame
      line(8, 58, 80, 46, 46); // seat tube
      line(8, 38, 46, 54, 46); // saddle
      line(8, 92, 80, 80, 40, 90, 40); // fork and bar
    } else if (icon === "stand") {
      dot(64, 22, 12);
      x.fillRect(50, 38, 28, 46); // body
      line(10, 56, 84, 56, 116); // legs together
      line(10, 72, 84, 72, 116);
      line(8, 46, 42, 46, 80); // arms down
      line(8, 82, 42, 82, 80);
    } else {
      dot(68, 20, 12);
      line(16, 66, 38, 60, 74); // body, leaning into the step
      line(10, 60, 74, 40, 114); // back leg
      line(10, 60, 74, 72, 94, 84, 114); // front leg
      line(8, 64, 44, 46, 66); // arms swinging
      line(8, 64, 44, 84, 62);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    cache.set(icon, t);
    return t;
  };
})();

/** Housing with lamps; returns a setter that switches which lamps glow. */
function signalHead(lamps: Lamp[], r: number, icon?: "bike" | "walk") {
  // Pedestrian signals: red shows a standing, green a walking figure, in square lenses.
  const lensIcon = (color: Lamp): Icon | undefined => (icon === "walk" ? (color === "red" ? "stand" : "walk") : icon);
  const g = new THREE.Group();
  const h = lamps.length * r * 2.6;
  const box = new THREE.Mesh(new THREE.BoxGeometry(r * 2.8, h, r * 1.6), housingMat);
  box.castShadow = true;
  g.add(box);
  const parts = lamps.map((color, i) => {
    const ic = lensIcon(color);
    const m = new THREE.MeshBasicMaterial({ color: COLORS[color], map: ic ? iconTex(ic) : null });
    const lamp = new THREE.Mesh(icon === "walk" ? new THREE.PlaneGeometry(r * 1.9, r * 1.9) : new THREE.CircleGeometry(r, 20), m);
    lamp.position.set(0, h / 2 - r * 1.3 - i * r * 2.6, r * 0.81);
    // A flat halo on the housing front, not a camera-facing sprite: a sprite cut through the housing
    // when seen from above and also glowed out of the back of the head.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(r * 4, r * 4), new THREE.MeshBasicMaterial({
      map: glowTex, color: COLORS[color], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    glow.position.copy(lamp.position).setZ(r * 0.9);
    g.add(lamp, glow);
    return { color, m, glow };
  });
  const set = (on: Lamp[]) => {
    for (const p of parts) {
      const lit = on.includes(p.color);
      // Off lamps stay faintly visible, like real lenses.
      p.m.color.setHex(COLORS[p.color]).multiplyScalar(lit ? 1 : 0.18);
      p.glow.visible = lit;
    }
  };
  return { g, h, set };
}

export interface LightControl {
  car(p: Phase): void;
  ped(p: "red" | "green"): void;
  state: NonNullable<ArmSpec["light"]>;
}

/** Signal pole for one arm: car head, optional bike head and green arrow, pedestrian heads at the crossing. */
export function buildLight(layout: Layout, arm: Arm): { group: THREE.Group; control: LightControl } {
  const spec = layout.arms[arm]!.light!;
  const state = { ...spec };
  const group = new THREE.Group();
  const facing = DIR[arm];
  const right = rightOf(facing.clone().negate()); // right of arriving traffic
  const pos = DIR[arm].clone().multiplyScalar(stopLine(layout, arm)).addScaledVector(right, ROAD_HALF + 0.8);

  const pole = new THREE.Group();
  pole.position.copy(pos);
  pole.rotation.y = Math.atan2(facing.x, facing.z);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8), poleMat);
  stick.position.y = 2.1;
  stick.castShadow = true;
  pole.add(stick);
  // Heads are a bit oversized (like the signs) so they read from the bird's-eye view.
  const car = signalHead(["red", "yellow", "green"], 0.2);
  car.g.position.set(0, 3.6, 0.15);
  pole.add(car.g);
  let bike: ReturnType<typeof signalHead> | undefined;
  if (spec.bike) {
    bike = signalHead(["red", "yellow", "green"], 0.12, "bike");
    bike.g.position.set(0, 2.1, 0.15);
    pole.add(bike.g);
  }
  if (spec.arrow) {
    // Green arrow sign sits right of the red lamp; local +x is the arriving traffic's right.
    const s = signPost([spec.arrow], { layout, arm }, new THREE.Vector3(0.75, 0, 0.15), new THREE.Vector3(0, 0, 1), 4.1);
    s.children[0].visible = false; // no own pole, it hangs on the signal pole
    pole.add(s);
  }
  group.add(pole);

  // Pedestrian heads on both curbs, facing across the road (walkers look at the opposite side).
  const peds: ReturnType<typeof signalHead>[] = [];
  if (spec.ped) {
    const [a, b] = crossingBand(layout);
    for (const side of [1, -1]) {
      const head = signalHead(["red", "green"], 0.15, "walk");
      const across = rightOf(DIR[arm]).multiplyScalar(side);
      const p = DIR[arm].clone().multiplyScalar(side > 0 ? a - 0.3 : b + 0.3).addScaledVector(across, ROAD_HALF + WALK - 0.4);
      const post = new THREE.Group();
      post.position.copy(p);
      post.rotation.y = Math.atan2(-across.x, -across.z);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), poleMat);
      s.position.y = 1.3;
      head.g.position.set(0, 2.4, 0.1);
      post.add(s, head.g);
      group.add(post);
      peds.push(head);
    }
  }

  const control: LightControl = {
    state,
    car(p) {
      state.car = p;
      car.set(LIT[p]);
      // ponytail: bike signal mirrors the car signal; give it its own phase when a scenario needs that.
      if (bike) bike.set(LIT[p]);
    },
    ped(p) {
      state.ped = p;
      for (const h of peds) h.set([p]);
    },
  };
  control.car(spec.car);
  if (spec.bike) bike!.set(LIT[spec.bike]);
  if (spec.ped) control.ped(spec.ped);
  return { group, control };
}
