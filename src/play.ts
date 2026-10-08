import * as THREE from "three";

/**
 * Calls `cb` with the tapped actor id. A tap must be short and nearly still —
 * otherwise kids rotating the camera would select vehicles by accident.
 */
export function listenForTaps(
  dom: HTMLElement,
  camera: THREE.Camera,
  targets: () => THREE.Object3D[],
  cb: (id: string) => void,
) {
  const down = new Map<number, { x: number; y: number; t: number }>();
  let multi = false; // a pinch is never a tap
  const ray = new THREE.Raycaster();

  dom.addEventListener("pointerdown", (e) => {
    down.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    if (down.size > 1) multi = true;
  });
  const end = (e: PointerEvent) => {
    const d = down.get(e.pointerId);
    down.delete(e.pointerId);
    if (!d) return;
    const wasMulti = multi;
    if (down.size === 0) multi = false;
    if (wasMulti || e.type !== "pointerup") return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 300) return;

    const r = dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(targets(), true).find((h) => h.object.userData.actorId);
    if (hit) cb(hit.object.userData.actorId);
  };
  dom.addEventListener("pointerup", end);
  dom.addEventListener("pointercancel", end);
}
