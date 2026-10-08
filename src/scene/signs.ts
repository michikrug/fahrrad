import * as THREE from "three";
import type { Arm, Layout, SignId } from "../types";
import { ARMS, DIR, rightOf } from "./roads";

// StVO signs drawn on canvas textures — no image files, and shapes/colours stay editable here.
// ponytail: pictograms are simplified look-alikes, not the official vector artwork.

const RED = "#c1121c", BLUE = "#1d5fae", YELLOW = "#f7c600", WHITE = "#fff", BLACK = "#111", GREEN = "#1fa33a";
const PX = 256; // canvas pixels per sign "unit" (the longer side)

type Ctx = CanvasRenderingContext2D;
interface Info { layout: Layout; arm: Arm; flip?: boolean }
interface SignDef {
  w: number; // metres (real signs are ~0.6–0.9 m)
  h: number;
  shape: (c: Ctx, W: number, H: number) => void; // outline path, also used for the grey back side
  paint: (c: Ctx, W: number, H: number, info: Info) => void;
  /** Printed on both faces (like real one-way signs); the back gets `flip` so arrows keep their world direction. */
  twoSided?: boolean;
}

/** Regular polygon path around the canvas centre; `rot` in degrees, 0 = first vertex pointing right. */
function poly(c: Ctx, n: number, R: number, rot: number, cx: number, cy: number) {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    c.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
  }
  c.closePath();
}
const circle = (c: Ctx, cx: number, cy: number, r: number) => {
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
};
const roundRect = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
};
const fill = (c: Ctx, color: string) => ((c.fillStyle = color), c.fill());

// Triangles: centroid placed so the triangle fills the square canvas nicely.
const triUp = (c: Ctx, W: number, R = W * 0.56) => poly(c, 3, R, -90, W / 2, W * 0.62);
const triDown = (c: Ctx, W: number, R = W * 0.56) => poly(c, 3, R, 90, W / 2, W * 0.38);
/** Red-bordered white warning/priority triangle. Inset by border/cos(60°) keeps the border even. */
function warnTriangle(c: Ctx, W: number, down = false) {
  const R = W * 0.56, t = W * 0.075;
  (down ? triDown : triUp)(c, W, R);
  fill(c, RED);
  (down ? triDown : triUp)(c, W, R - t / Math.cos(Math.PI / 3));
  fill(c, WHITE);
}

function bikeIcon(c: Ctx, x: number, y: number, s: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = s * 0.09;
  c.lineCap = c.lineJoin = "round";
  for (const dx of [-0.55, 0.55]) {
    c.beginPath();
    c.arc(x + dx * s, y + 0.25 * s, 0.32 * s, 0, Math.PI * 2);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(x - 0.55 * s, y + 0.25 * s); // rear hub
  c.lineTo(x - 0.1 * s, y - 0.25 * s); // seat
  c.lineTo(x + 0.35 * s, y - 0.25 * s);
  c.lineTo(x + 0.55 * s, y + 0.25 * s); // front hub
  c.moveTo(x - 0.55 * s, y + 0.25 * s);
  c.lineTo(x, y + 0.25 * s); // crank
  c.lineTo(x + 0.35 * s, y - 0.25 * s);
  c.moveTo(x + 0.3 * s, y - 0.45 * s); // handlebar
  c.lineTo(x + 0.35 * s, y - 0.25 * s);
  c.stroke();
}

function walkerIcon(c: Ctx, x: number, y: number, s: number, color: string) {
  c.strokeStyle = c.fillStyle = color;
  c.lineWidth = s * 0.14;
  c.lineCap = "round";
  circle(c, x + 0.05 * s, y - 0.75 * s, 0.14 * s);
  c.fill();
  c.beginPath();
  c.moveTo(x, y - 0.5 * s);
  c.lineTo(x - 0.05 * s, y + 0.05 * s); // body
  c.lineTo(x - 0.35 * s, y + 0.55 * s); // back leg
  c.moveTo(x - 0.05 * s, y + 0.05 * s);
  c.lineTo(x + 0.3 * s, y + 0.55 * s); // front leg
  c.moveTo(x - 0.3 * s, y - 0.1 * s);
  c.lineTo(x, y - 0.4 * s);
  c.lineTo(x + 0.3 * s, y - 0.15 * s); // arms
  c.stroke();
}

function arrow(c: Ctx, x0: number, x1: number, y: number, t: number, color: string) {
  const dir = Math.sign(x1 - x0);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x0, y - t / 2);
  c.lineTo(x1 - dir * t * 1.4, y - t / 2);
  c.lineTo(x1 - dir * t * 1.4, y - t * 1.2);
  c.lineTo(x1, y);
  c.lineTo(x1 - dir * t * 1.4, y + t * 1.2);
  c.lineTo(x1 - dir * t * 1.4, y + t / 2);
  c.lineTo(x0, y + t / 2);
  c.closePath();
  c.fill();
}

const SIGNS: Record<SignId, SignDef> = {
  // Kreuzung oder Einmündung mit Vorfahrt von rechts
  "102": {
    w: 0.9, h: 0.9,
    shape: (c, W) => triUp(c, W),
    paint: (c, W) => {
      warnTriangle(c, W);
      c.strokeStyle = BLACK;
      c.lineWidth = W * 0.07;
      c.beginPath();
      c.moveTo(W * 0.36, W * 0.5); c.lineTo(W * 0.64, W * 0.8);
      c.moveTo(W * 0.64, W * 0.5); c.lineTo(W * 0.36, W * 0.8);
      c.stroke();
    },
  },
  // Vorfahrt gewähren
  "205": { w: 0.9, h: 0.9, shape: (c, W) => triDown(c, W), paint: (c, W) => warnTriangle(c, W, true) },
  // Halt. Vorfahrt gewähren
  "206": {
    w: 0.75, h: 0.75,
    shape: (c, W) => poly(c, 8, W * 0.49, 22.5, W / 2, W / 2),
    paint: (c, W) => {
      poly(c, 8, W * 0.49, 22.5, W / 2, W / 2);
      fill(c, WHITE);
      poly(c, 8, W * 0.45, 22.5, W / 2, W / 2);
      fill(c, RED);
      c.fillStyle = WHITE;
      c.font = `900 ${W * 0.26}px Arial, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("STOP", W / 2, W / 2 + W * 0.01);
    },
  },
  // Kreisverkehr: three white arrows going round anticlockwise
  "215": {
    w: 0.7, h: 0.7,
    shape: (c, W) => circle(c, W / 2, W / 2, W * 0.49),
    paint: (c, W) => {
      circle(c, W / 2, W / 2, W * 0.49);
      fill(c, BLUE);
      c.strokeStyle = c.fillStyle = WHITE;
      c.lineWidth = W * 0.08;
      const r = W * 0.25;
      for (let i = 0; i < 3; i++) {
        const a0 = (i * 2 * Math.PI) / 3 + 0.35, a1 = a0 + 1.45;
        c.beginPath();
        c.arc(W / 2, W / 2, r, a1, a0, true);
        c.stroke();
        // Arrow head at the anticlockwise end, pointing along the motion.
        const hx = W / 2 + r * Math.cos(a0), hy = W / 2 + r * Math.sin(a0);
        const tx = Math.sin(a0), ty = -Math.cos(a0); // tangent towards decreasing angle
        const nx = Math.cos(a0), ny = Math.sin(a0);
        const s = W * 0.09;
        c.beginPath();
        c.moveTo(hx + tx * s * 1.3, hy + ty * s * 1.3);
        c.lineTo(hx + nx * s, hy + ny * s);
        c.lineTo(hx - nx * s, hy - ny * s);
        c.closePath();
        c.fill();
      }
    },
  },
  // Einbahnstraße — arrow points left because the sign is mounted parallel to the road (see placement).
  "220": {
    w: 1.0, h: 0.33, twoSided: true,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 8),
    paint: (c, W, H, { flip }) => {
      roundRect(c, 2, 2, W - 4, H - 4, 8);
      fill(c, BLUE);
      if (flip) arrow(c, W * 0.07, W * 0.94, H / 2, H * 0.42, WHITE);
      else arrow(c, W * 0.93, W * 0.06, H / 2, H * 0.42, WHITE);
      c.fillStyle = BLACK;
      c.font = `700 ${H * 0.24}px Arial, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("Einbahnstraße", W * 0.55, H / 2);
    },
  },
  // Verbot der Einfahrt
  "267": {
    w: 0.7, h: 0.7,
    shape: (c, W) => circle(c, W / 2, W / 2, W * 0.49),
    paint: (c, W) => {
      circle(c, W / 2, W / 2, W * 0.49);
      fill(c, RED);
      c.fillStyle = WHITE;
      c.fillRect(W * 0.18, W * 0.42, W * 0.64, W * 0.16);
    },
  },
  // Vorfahrt (an der nächsten Kreuzung)
  "301": {
    w: 0.9, h: 0.9,
    shape: (c, W) => triUp(c, W),
    paint: (c, W) => {
      warnTriangle(c, W);
      c.fillStyle = BLACK;
      c.fillRect(W * 0.3, W * 0.62, W * 0.4, W * 0.03); // thin side road
      c.beginPath(); // thick priority road with pointed top
      c.moveTo(W * 0.5, W * 0.36);
      c.lineTo(W * 0.545, W * 0.44);
      c.lineTo(W * 0.545, W * 0.86);
      c.lineTo(W * 0.455, W * 0.86);
      c.lineTo(W * 0.455, W * 0.44);
      c.closePath();
      c.fill();
    },
  },
  // Vorfahrtstraße
  "306": {
    w: 0.7, h: 0.7,
    shape: (c, W) => poly(c, 4, W * 0.49, 0, W / 2, W / 2),
    paint: (c, W) => {
      poly(c, 4, W * 0.49, 0, W / 2, W / 2);
      fill(c, BLACK);
      poly(c, 4, W * 0.47, 0, W / 2, W / 2);
      fill(c, WHITE);
      poly(c, 4, W * 0.3, 0, W / 2, W / 2);
      fill(c, YELLOW);
    },
  },
  // Fußgängerüberweg (sign Z. 350; the road marking itself is Z. 293)
  "350": {
    w: 0.7, h: 0.7,
    shape: (c, W) => roundRect(c, 2, 2, W - 4, W - 4, 10),
    paint: (c, W) => {
      roundRect(c, 2, 2, W - 4, W - 4, 10);
      fill(c, BLUE);
      poly(c, 3, W * 0.42, -90, W / 2, W * 0.58);
      fill(c, WHITE);
      c.fillStyle = BLACK;
      for (let i = 0; i < 4; i++) c.fillRect(W * (0.3 + i * 0.11), W * 0.73, W * 0.06, W * 0.04);
      walkerIcon(c, W / 2, W * 0.55, W * 0.17, BLACK);
    },
  },
  // Grünpfeil
  "720": {
    w: 0.5, h: 0.25,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      arrow(c, W * 0.15, W * 0.85, H / 2, H * 0.3, GREEN);
    },
  },
  // Grünpfeil nur für den Radverkehr
  "721": {
    w: 0.5, h: 0.25,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      arrow(c, W * 0.45, W * 0.9, H / 2, H * 0.3, GREEN);
      bikeIcon(c, W * 0.24, H * 0.47, H * 0.42, GREEN);
    },
  },
  // Zusatzzeichen: course of the bending priority road, seen by traffic on this arm (arriving from the bottom)
  "1002": {
    w: 0.6, h: 0.45,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H, { layout, arm }) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      roundRect(c, 6, 6, W - 12, H - 12, 4);
      fill(c, WHITE);
      const viewRight = rightOf(DIR[arm].clone().negate());
      const cx = W / 2, cy = H / 2, L = H * 0.36;
      c.strokeStyle = BLACK;
      c.lineCap = "butt";
      for (const a of ARMS) {
        if (!layout.arms[a]) continue;
        // Canvas x = viewer's right, canvas y (down) = towards the viewer, i.e. along DIR[arm].
        const dx = DIR[a].dot(viewRight), dy = DIR[a].dot(DIR[arm]);
        c.lineWidth = layout.priority?.includes(a) ? H * 0.12 : H * 0.04;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + dx * L * 1.3, cy + dy * L);
        c.stroke();
      }
    },
  },
  // Zusatzzeichen under Z. 220: bikes may ride against the one-way direction (number not confirmed in the legal text)
  "1000-32": {
    w: 0.6, h: 0.33, twoSided: true,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      roundRect(c, 6, 6, W - 12, H - 12, 4);
      fill(c, WHITE);
      bikeIcon(c, W * 0.28, H * 0.5, H * 0.4, BLACK);
      arrow(c, W * 0.55, W * 0.9, H * 0.33, H * 0.1, BLACK);
      arrow(c, W * 0.9, W * 0.55, H * 0.67, H * 0.1, BLACK);
    },
  },
  // Zusatzzeichen "Radverkehr frei"
  "1022-10": {
    w: 0.6, h: 0.33,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      roundRect(c, 6, 6, W - 12, H - 12, 4);
      fill(c, WHITE);
      bikeIcon(c, W * 0.3, H * 0.47, H * 0.42, BLACK);
      c.fillStyle = BLACK;
      c.font = `700 ${H * 0.36}px Arial, sans-serif`;
      c.textBaseline = "middle";
      c.fillText("frei", W * 0.55, H * 0.52);
    },
  },
};

/** Exported so the cheat sheet (Spickzettel) can reuse the exact same artwork. */
export function signCanvas(id: SignId, info: Info, back = false): HTMLCanvasElement {
  const def = SIGNS[id];
  const canvas = document.createElement("canvas");
  const k = PX / Math.max(def.w, def.h);
  canvas.width = Math.round(def.w * k);
  canvas.height = Math.round(def.h * k);
  const c = canvas.getContext("2d")!;
  if (back && def.twoSided) def.paint(c, canvas.width, canvas.height, { ...info, flip: true });
  else if (back) {
    def.shape(c, canvas.width, canvas.height);
    fill(c, "#8a8f94");
  } else def.paint(c, canvas.width, canvas.height, info);
  return canvas;
}

// Real signs are tiny from the bird's-eye view; enlarge for readability.
const DISPLAY_SCALE = 1.8;
const poleMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });

function signMesh(id: SignId, info: Info) {
  const def = SIGNS[id];
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(def.w * DISPLAY_SCALE, def.h * DISPLAY_SCALE);
  for (const back of [false, true]) {
    const tex = new THREE.CanvasTexture(signCanvas(id, info, back));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // Unlit so colours stay true to the StVO originals regardless of the sun angle.
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }));
    if (back) m.rotation.y = Math.PI;
    g.add(m);
  }
  return { g, h: def.h * DISPLAY_SCALE };
}

/** A pole with signs stacked top to bottom. `facing` = direction the sign faces (towards the viewer). */
export function signPost(ids: SignId[], info: Info, pos: THREE.Vector3, facing: THREE.Vector3, top = 3.8) {
  const g = new THREE.Group();
  g.position.copy(pos);
  g.rotation.y = Math.atan2(facing.x, facing.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, top, 8), poleMat);
  pole.position.y = top / 2;
  pole.castShadow = true;
  g.add(pole);
  let y = top;
  for (const id of ids) {
    const { g: s, h } = signMesh(id, info);
    s.position.set(0, y - h / 2, 0.08);
    g.add(s);
    y -= h + 0.08;
  }
  return g;
}
