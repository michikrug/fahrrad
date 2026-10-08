import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// P0 placeholder: grey-box crossing to prove the toolchain renders on a tablet.
const app = document.querySelector<HTMLDivElement>("#app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Cap at 2: school iPads report 2–3, and 3 costs a lot of fill rate for no visible gain.
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd7ff);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
camera.position.set(25, 30, 25);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI / 2.2; // never look from below the ground

scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 2));
const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x7cc46a }));
grass.rotation.x = -Math.PI / 2;
scene.add(grass);
const asphalt = new THREE.MeshLambertMaterial({ color: 0x555555 });
for (const [w, d] of [[80, 8], [8, 80]]) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), asphalt);
  road.position.y = 0.05;
  scene.add(road);
}

function resize() {
  renderer.setSize(app.clientWidth, app.clientHeight);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
