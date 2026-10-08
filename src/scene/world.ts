import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

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
  camera.position.set(0, 22, 30); // oblique, so kids see the scene is 3D
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

  return { renderer, scene, camera, controls, onFrame: (f: (dt: number) => void) => frameHooks.push(f) };
}

export type World = ReturnType<typeof createWorld>;

/** Free GPU memory of a removed scenario; tablets run out fast otherwise. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
    // CSS2DObjects leave their DOM node behind unless removed explicitly.
    if ("element" in o && o.element instanceof HTMLElement) o.element.remove();
  });
  root.removeFromParent();
}
