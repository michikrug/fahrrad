import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { Arm, Layout } from "../types";
import { buildDecor } from "./decor";
import { buildLight, type LightControl } from "./lights";
import { ARMS, DIR, ROAD_HALF, buildRoads, edgeDist, rightOf, stopLine } from "./roads";
import { signPost } from "./signs";

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
  controls.maxDistance = 70;
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

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    for (const f of frameHooks) f(dt);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  /** Back to the default oblique view; bigger junctions (roundabout) need more distance. */
  function resetCamera(far = false) {
    camera.position.set(0, far ? 30 : 22, far ? 40 : 30);
    controls.target.set(0, 0, 0);
  }
  resetCamera();

  return { renderer, scene, camera, controls, resetCamera, onFrame: (f: (dt: number) => void) => frameHooks.push(f) };
}

export type World = ReturnType<typeof createWorld>;

/** Everything static for one scenario: roads, signs, lights, houses. Lights stay controllable. */
export function buildLevel(layout: Layout) {
  const group = new THREE.Group();
  group.add(buildRoads(layout), buildDecor(layout));
  const lights = new Map<Arm, LightControl>();
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
    const arriving = [...(spec.signs ?? []), ...(spec.zebra ? (["350"] as const) : [])];
    if (arriving.length) group.add(signPost(arriving, info, at(stopLine(layout, arm) + (spec.light ? 2 : 0.5), arriveRight), out));
    // Signs at the mouth for traffic turning into this arm. 220 hangs parallel to the road.
    const exiting = [...(spec.exitSigns ?? []).filter((id) => id !== "220"), ...(spec.zebra ? (["350"] as const) : [])];
    if (exiting.length) group.add(signPost(exiting, info, at(edge + 0.6, exitRight), out.clone().negate()));
    if (spec.exitSigns?.includes("220")) {
      group.add(signPost(["220"], info, at(edge + 4, exitRight), rightOf(out).negate(), 2.6));
    }
  }
  return { group, lights };
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
