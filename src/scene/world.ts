import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { Arm, Layout, SignId } from "../types";
import { buildDecor } from "./decor";
import { buildLight, type LightControl } from "./lights";
import { ARMS, CURB, DIR, ROAD_HALF, buildRoads, edgeDist, rightOf, stopLine } from "./roads";
import { signPost } from "./signs";
import { parkedBus } from "./actors";

export function createWorld(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // Cap at 2: school iPads report 2–3, and 3 costs a lot of fill rate for no visible gain.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Pins/labels are plain HTML on top; pointer-events off so taps reach the canvas.
  const labels = new CSS2DRenderer();
  labels.domElement.className = "labels";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd7ff);
  scene.fog = new THREE.Fog(0x9fd7ff, 70, 140);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 12;
  controls.maxDistance = 110; // phones in portrait need to back off far to see the whole junction
  controls.maxPolarAngle = Math.PI / 2.3; // never dip below the ground

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a9a60, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(20, 40, 15);
  sun.castShadow = true;
  // One small shadow map covering only the junction keeps old tablets smooth.
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
  scene.add(sun);

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x86c46e }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.01;
  grass.receiveShadow = true;
  scene.add(grass);

  const frameHooks: ((dt: number) => void)[] = [];
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  const timer = new THREE.Timer();
  timer.connect(document); // pauses while the tab is hidden, so nothing jumps on return
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    // Clamp both ways: the first rAF timestamp can precede the timer's start, giving a negative delta.
    const dt = THREE.MathUtils.clamp(timer.getDelta(), 0, 0.1);
    for (const f of frameHooks) f(dt);
    // update() calls lookAt(target), which would fight the ego view and camera tweens.
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  return { renderer, scene, camera, controls, onFrame: (f: (dt: number) => void) => frameHooks.push(f) };
}

export type World = ReturnType<typeof createWorld>;

/** Everything static for one scenario: roads, signs, lights, houses. Lights stay controllable. */
export function buildLevel(layout: Layout) {
  const group = new THREE.Group();
  group.add(buildRoads(layout), buildDecor(layout));
  const lights = new Map<Arm, LightControl>();
  const hazards: THREE.Object3D[] = []; // blink together, driven by the frame loop
  const edge = edgeDist(layout);
  for (const arm of ARMS) {
    const spec = layout.arms[arm];
    if (!spec) continue;
    const info = { layout, arm };
    const out = DIR[arm];
    const arriveRight = rightOf(out.clone().negate()).multiplyScalar(ROAD_HALF + 0.9);
    const exitRight = rightOf(out).multiplyScalar(ROAD_HALF + 0.9);
    const at = (s: number, lat: THREE.Vector3) => out.clone().multiplyScalar(s).add(lat);

    if (spec.light) {
      const l = buildLight(layout, arm);
      group.add(l.group);
      lights.set(arm, l.control);
    }
    // Signs for arriving traffic, behind the signal pole if there is one. Zebra sign joins the same post.
    const arriving = [...(spec.signs ?? []), ...(spec.zone ? (["325.2"] as const) : []), ...(spec.zebra ? (["350"] as const) : [])];
    if (arriving.length) group.add(signPost(arriving, info, at(stopLine(layout, arm) + (spec.light ? 2 : 0.5), arriveRight), out));
    // Signs at the mouth for traffic turning into this arm. 220 hangs parallel to the road.
    const parallel = (id: SignId) => id === "220" || id === "1000-32";
    const exiting = [
      ...(spec.exitSigns ?? []).filter((id) => !parallel(id)), ...(spec.zone ? (["325.1"] as const) : []), ...(spec.zebra ? (["350"] as const) : []),
    ];
    if (exiting.length) group.add(signPost(exiting, info, at(edge + 0.6, exitRight), out.clone().negate()));
    const along = (spec.exitSigns ?? []).filter(parallel);
    // Facing away from the road, towards traffic on the crossing street on that corner's side: from
    // there you see the face with the post behind it, not the post cutting through the back.
    if (along.length) group.add(signPost(along, info, at(edge + 4, exitRight), rightOf(out), 2.8));

    if (spec.zone) {
      // Children may play anywhere here: a ball on the street says so at a glance.
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshLambertMaterial({ color: 0xe23d6e }));
      ball.position.copy(at(16, rightOf(out).multiplyScalar(-1.2))).setY(0.27);
      ball.castShadow = true;
      group.add(ball);
    }

    if (spec.busStop) {
      // Bus on the arriving lane (that traffic's right-hand side), front 6.5 m from the centre; stop sign at its front.
      const side = rightOf(out.clone().negate());
      const bus = parkedBus();
      bus.obj.position.copy(at(12, side.clone().multiplyScalar(ROAD_HALF / 2)));
      bus.obj.lookAt(bus.obj.position.clone().sub(out));
      hazards.push(...bus.hazards);
      group.add(bus.obj);
      group.add(signPost(["224"], info, at(6, side.clone().multiplyScalar(ROAD_HALF + 0.6)), out, 2.6));
      group.add(shelter(at(11, side.clone().multiplyScalar(ROAD_HALF + 1.9)), side));
    }
  }
  return { group, lights, hazards };
}

/** Bus shelter: back wall away from the road, a roof, two posts. `side` points away from the road. */
function shelter(pos: THREE.Vector3, side: THREE.Vector3) {
  const g = new THREE.Group();
  const glass = new THREE.MeshLambertMaterial({ color: 0xbfe0ee, transparent: true, opacity: 0.6 });
  const steel = new THREE.MeshLambertMaterial({ color: 0x6d747c });
  const part = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
  };
  // Model space: x along the road, +z away from it.
  part(3.2, 2.1, 0.06, glass, 0, 1.2, 0.5);
  part(3.4, 0.08, 1.3, steel, 0, 2.3, 0);
  for (const x of [-1.6, 1.6]) part(0.08, 2.3, 0.08, steel, x, 1.15, 0.5);
  g.position.copy(pos).setY(CURB);
  g.lookAt(pos.clone().add(side).setY(CURB));
  return g;
}

/** Free GPU memory of a removed scenario; tablets run out fast otherwise. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      o.geometry.dispose();
      // Shared materials get re-uploaded on next use, so disposing everything is safe.
      for (const m of [o.material].flat()) {
        m.map?.dispose();
        m.dispose();
      }
    }
    // CSS2DObjects leave their DOM node behind unless removed explicitly.
    if ("element" in o && o.element instanceof HTMLElement) o.element.remove();
  });
  root.removeFromParent();
}
