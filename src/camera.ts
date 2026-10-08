import * as THREE from "three";
import { BAR, type Actor } from "./scene/actors";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { World } from "./scene/world";

// Two views: free bird's-eye (OrbitControls) and the kid's own view from the bike.
// Switching tweens position, rotation and field of view so kids don't lose orientation.

// Eye in bike model space. A bit lower and further back than the model's head (y 1.58, z 0.02):
// at true head position the bar sits so low on a portrait phone that the dock covers it.
const EYE = new THREE.Vector3(0, 1.32, -0.25);
/** World position of the eye. Not localToWorld: matrixWorld is a frame old while the bike moves. */
const eyeOf = (o: THREE.Object3D) => EYE.clone().multiply(o.scale).applyQuaternion(o.quaternion).add(o.position);
const BIRD_FOV = 50;
const BIRD_ELEVATION = THREE.MathUtils.degToRad(58); // steeper than 45° — portrait screens have height to spare

/**
 * Ego field of view, vertical as three.js expects. Aim for ~75° horizontally so kids see the junction
 * beside them; on a portrait phone that needs a tall vertical FOV, capped to avoid fisheye.
 */
function egoFov(aspect: number) {
  const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(37.5)) / aspect);
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), 70, 100);
}
const TWEEN_S = 0.9;

/**
 * Ego-only extras at the handlebar of your own bike: bell, a tap target for "yourself" and your pin.
 * Built in bike model space (faces +z, driver's right is -x) and scaled like the model.
 */
function handlebarExtras() {
  const g = new THREE.Group();
  g.position.copy(BAR);
  // Bell on the right side of the bar, where kids' thumbs are.
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xd8dde2, emissive: 0x222222 }),
  );
  bell.position.set(-0.13, 0.025, 0);
  // Invisible, bigger hit sphere: the bell is tiny on screen.
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6));
  hit.visible = false;
  hit.userData.bell = true;
  bell.add(hit);
  // Tapping the handlebar = tapping yourself (your body is hidden in this view).
  const self = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.22));
  self.visible = false;
  // Order number for yourself, above the bar since the pin over your head is out of sight.
  const pin = document.createElement("div");
  pin.className = "pin";
  const label = new CSS2DObject(pin);
  label.position.set(0.09, 0.07, 0);
  g.add(bell, self, label);
  return { g, self, pin };
}

export function createCameraRig(world: World) {
  const { camera, controls, scene } = world;
  // The ego view shows your own bike model (minus your body), so it matches the bird's-eye view.
  // The handlebar belongs to the bike, not the head: it stays put while the view turns
  // (look over your shoulder and it leaves the picture, like in real life).
  // The extras live in their own group, not in the bike: the bird view taps the bike, and the
  // raycaster ignores `visible`, so a bell inside it would ring instead of picking you.
  const bar = handlebarExtras();
  const mount = new THREE.Group();
  mount.visible = false;
  mount.add(bar.g);
  scene.add(mount);
  let body: THREE.Object3D[] = [];

  let mode: "bird" | "ego" = "bird";
  let rider: Actor | null = null;
  let t = 1; // tween progress, 1 = settled
  const from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: BIRD_FOV };
  const fov = (m: "bird" | "ego") => (m === "bird" ? BIRD_FOV : egoFov(camera.aspect));
  let birdRadius = 12;

  /**
   * Default bird view: back off until a circle of `radius` metres around the junction fits
   * the narrower screen axis — on a portrait phone that is the width.
   */
  function fitBird(radius: number) {
    const v = THREE.MathUtils.degToRad(BIRD_FOV);
    const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
    // Title card and dock cover roughly a quarter of the height, so only ~70% of it really shows the scene.
    const d = radius / Math.tan(Math.min(v * 0.7, h) / 2);
    camera.position.set(0, Math.sin(BIRD_ELEVATION) * d, Math.cos(BIRD_ELEVATION) * d);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    // Fog starts behind the junction, so far-backed-off phone views don't look washed out.
    if (scene.fog instanceof THREE.Fog) Object.assign(scene.fog, { near: d * 1.2, far: d * 2.5 });
  }
  // Phone rotated: refit, since a view framed for portrait is far too wide for landscape and vice versa.
  addEventListener("resize", () => {
    if (mode === "bird" && t >= 1) fitBird(birdRadius);
  });
  const bird = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  let yaw = 0, dragging = false, lastX = 0;

  const turnAround = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  // Look ~17° down: the road fills portrait screens, and the handlebar stays above the dock in landscape.
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.3);
  function egoPose() {
    const a = rider!;
    const pos = eyeOf(a.obj);
    // Models face +z, cameras look along -z: turn around, then look-around yaw, then a slight downward tilt.
    const look = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const quat = a.obj.quaternion.clone().multiply(turnAround).multiply(look).multiply(tilt);
    return { pos, quat };
  }

  function start() {
    from.pos.copy(camera.position);
    from.quat.copy(camera.quaternion);
    from.fov = camera.fov;
    t = 0;
  }

  // Ego view: horizontal drag turns the head (Schulterblick!); it swings back when released.
  const dom = world.renderer.domElement;
  dom.addEventListener("pointerdown", (e) => ((dragging = mode === "ego"), (lastX = e.clientX)));
  dom.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw = THREE.MathUtils.clamp(yaw + (e.clientX - lastX) * 0.006, -2.6, 2.6);
    lastX = e.clientX;
  });
  for (const ev of ["pointerup", "pointercancel"]) dom.addEventListener(ev, () => (dragging = false));

  return {
    pin: bar.pin,
    /** Tap targets that only exist in the ego view (bell + handlebar as "yourself"). */
    targets: () => (mode === "ego" ? [bar.g] : []),
    get mode() {
      return mode;
    },
    setRider(a: Actor | null) {
      rider = a;
      bar.self.userData.actorId = a?.p.id;
      body = [];
      a?.obj.traverse((o) => o.userData.rider && body.push(o));
      if (!a && mode === "ego") this.toggle();
    },
    toggle() {
      if (mode === "bird") {
        if (!rider) return;
        bird.pos.copy(camera.position);
        bird.quat.copy(camera.quaternion);
        mode = "ego";
        yaw = 0;
      } else mode = "bird";
      controls.enabled = false;
      start();
    },
    /** Jump without tween when a new scenario loads. `radius` = metres around the centre the bird view must show. */
    snap(to: "bird" | "ego", radius: number) {
      birdRadius = radius;
      camera.fov = BIRD_FOV;
      camera.updateProjectionMatrix();
      fitBird(radius);
      if (to === "ego" && !rider) to = "bird";
      mode = to;
      if (to === "ego") {
        bird.pos.copy(camera.position);
        bird.quat.copy(camera.quaternion);
        yaw = 0;
      }
      controls.enabled = to === "bird";
      from.fov = fov(to);
      t = 1;
      this.update(0);
    },
    update(dt: number) {
      if (!dragging) yaw *= Math.exp(-3 * dt);
      const target = mode === "ego" && rider ? egoPose() : bird;
      t = Math.min(1, t + dt / TWEEN_S);
      const k = t < 1 ? THREE.MathUtils.smootherstep(t, 0, 1) : 1;
      if (mode === "bird" && t >= 1) {
        controls.enabled = true;
      } else {
        camera.position.lerpVectors(from.pos, target.pos, k);
        camera.quaternion.slerpQuaternions(from.quat, target.quat, k);
      }
      camera.fov = THREE.MathUtils.lerp(from.fov, fov(mode), k);
      camera.updateProjectionMatrix();
      // Hide your body by camera distance to your head, not by tween progress — otherwise
      // flying out of ego view shows the rider while the camera is still inside it.
      const head = rider ? eyeOf(rider.obj) : null;
      const inEgo = !!head && camera.position.distanceTo(head) < 2.5;
      mount.visible = inEgo;
      // Arms are left alone outside ego view: updateSignal decides which one shows.
      for (const o of body) if (inEgo || !o.userData.arm) o.visible = !inEgo;
      if (rider) {
        mount.position.copy(rider.obj.position);
        mount.quaternion.copy(rider.obj.quaternion);
        mount.scale.copy(rider.obj.scale);
      }
    },
  };
}
