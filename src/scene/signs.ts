import * as THREE from "three";
import type { Arm, Layout, SignId } from "../types";
import { ARMS, DIR, rightOf } from "./roads";

// StVO signs drawn on canvas textures — no image files, and shapes/colours stay editable here.
// ponytail: pictograms are simplified look-alikes, not the official vector artwork.

const RED = "#c1121c", BLUE = "#17509a", YELLOW = "#f7c600", WHITE = "#fff", BLACK = "#111", GREEN = "#009650";
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
  /**
   * White rim with a thin dark edge, as on most real signs: the artwork is drawn scaled by `k`
   * about (W/2, cy·H) inside the shape. For triangles cy is their centre, so the rim stays even.
   */
  rim?: { k: number; cy?: number };
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

/**
 * Z. 325.1 / 325.2 pictogram, path for path from the official artwork (Wikimedia Commons, "Zeichen 325.1 -
 * Beginn eines verkehrsberuhigten Bereichs, StVO 2009.svg" and "Zeichen 325.2.svg"; public domain as an
 * official work, § 5 UrhG). Units: the 586 × 392 sign, y pointing up. Too detailed to draw by hand convincingly.
 */
const PLAY_STREET = [
  "m126.1 155.6l0-119.9c-11.5 0-20.8 9.4-20.8 20.9l0 72.9l-52.1-83.4c-9.8 6.2-12.8 19-6.7 28.8l37.9 60.6l0 20.1",
  "m126.1 160.8l-41.7 0l0 39.3l-27.8-44.5c-8.5 5.3-11.1 16.6-5.8 25.1l36.8 58.9c6.1 9.8 19 12.8 28.7 6.6c6.1-3.8 9.8-10.4 9.8-17.6l0-23.5l39.1-23.4c-5.2-8.7-16.4-11.5-25-6.3l-14.1 8.4",
  "m139.2 278.1c0-11.5-9.4-20.9-20.9-20.9c-11.5 0-20.8 9.4-20.8 20.9c0 11.5 9.3 20.8 20.8 20.8c11.5 0 20.9-9.3 20.9-20.8",
  "m248.5 50.8c0-8.3-6.8-15.1-15.1-15.1c-8.4 0-15.1 6.8-15.1 15.1c0 8.4 6.7 15.2 15.1 15.2c8.3 0 15.1-6.8 15.1-15.2",
  "m321.1 114.3l-19-15.7c-4.2-3.5-10.4-3.2-14.3 .6l33.6 33.6c6.9-3 14.9-2.2 21.3 1.9l22.3-4.9c.9-.2 1.7-.8 2.1-1.6l11.4-22.9c-5.2-2.6-11.5-.5-14.2 4.7l-5.4 10.4l-10.6 0l9.1-36.3l20.4-1.5c5.6-.4 9.8-5 9.8-10.6l-34.7 0c-1 0-1.9 .5-2.5 1.4l-5.1 7.7l-10.6-3l0-31.8c0-5.7-4.5-10.3-10.1-10.6",
  "m345.3 153.7c0-8.4-6.8-15.2-15.1-15.2c-8.4 0-15.2 6.8-15.2 15.2c0 8.3 6.8 15.1 15.2 15.1c8.3 0 15.1-6.8 15.1-15.1",
  "m227 339.9c-2.9 0-5.5-1.7-6.7-4.4l-11.5-26.6c-.8-1.9-1.9-3.7-3.1-5.3l-1.8-2.3c-1.1-1.5-1.7-3.4-1.7-5.3l0-19c0-4 3.2-7.3 7.3-7.3l108.2 0c4 0 7.3 3.3 7.3 7.3l0 19c0 1.9-.6 3.8-1.8 5.3l-1.7 2.3c-1.3 1.6-2.3 3.4-3.1 5.3l-11.6 26.6c-1.1 2.7-3.8 4.4-6.7 4.4l-73.1 0zm1.8-7.3l69.6 0c1.1 0 2.2-.7 2.7-1.8l10-23.1l-95 0l10 23.1c.5 1.1 1.5 1.8 2.7 1.8zm-10.5-32.2c4.8 0 8.7-3.9 8.7-8.8c0-4.8-3.9-8.8-8.7-8.8c-4.9 0-8.8 4-8.8 8.8c0 4.9 3.9 8.8 8.8 8.8zm90.6 0c4.9 0 8.8-3.9 8.8-8.8c0-4.8-3.9-8.8-8.8-8.8c-4.8 0-8.8 4-8.8 8.8c0 4.9 4 8.8 8.8 8.8z",
  "m209.5 266.8l17.5 0l0-16.1c0-2.5-1.9-4.4-4.4-4.4l-8.7 0c-2.5 0-4.4 1.9-4.4 4.4",
  "m300.1 266.8l17.6 0l0-16.1c0-2.5-2-4.4-4.4-4.4l-8.8 0c-2.4 0-4.4 1.9-4.4 4.4",
  "m474.2 352.2l-15.8-10.3l0 7.2l-15.7 0l0-17.5l-50.4-32.9l28.3 0l0-110.3l107.1 0l0 110.3l28.3 0l-81.8 53.5zm0-9.4l44.1-36.2l0-108.7l-31.6 0l0 47.2l-25.1 0l0-47.2l-31.5 0l0 108.7l44.1 36.2z",
  "m442.6 298.7l25.3 0l0-31.5l-25.3 0l0 31.5z",
  "m480.4 298.7l25.2 0l0-31.5l-25.2 0l0 31.5z",
  "m526.8 59.1l-108.1 78.2c-35 25.3-55.7 65.8-55.7 109l13.2 0c0-38.9 18.7-75.5 50.2-98.4l100.4-73",
];
const PLAY_STREET_END = "m10.1 35.3l518.5 345.8l30.8 0c9 0 16.3-7.3 16.3-16.3l0-8.6l-518.6-345.8l-30.8 0c-8.9 0-16.2 7.3-16.2 16.3";

function playStreet(c: Ctx, W: number, H: number, end: boolean) {
  roundRect(c, 2, 2, W - 4, H - 4, 8);
  fill(c, BLUE);
  c.save();
  c.translate(0, H);
  c.scale(W / 586, -H / 392); // SVG units, y up
  c.fillStyle = WHITE;
  for (const d of PLAY_STREET) c.fill(new Path2D(d));
  if (end) (c.fillStyle = RED), c.fill(new Path2D(PLAY_STREET_END));
  c.restore();
}

// Pictograms from the official artwork on Wikimedia Commons (official signs are public domain, § 5 UrhG):
// the bicycle from "Zusatzzeichen 1022-10 - Radfahrer frei, StVO 1992.svg", the walker on the crossing and its
// white triangle from "Zeichen 350-10 - Fußgängerüberweg (rechts), StVO 1992.svg". SVG units, y pointing up.
const BIKE = "m203.7 303.6c-8.7 0-16.4-5.7-19-14l-14.5-46.7c-23.2 4.7-46.5-7.6-55.7-29.4c-10.7-25.4 1.1-54.6 26.4-65.3c25.4-10.7 54.6 1.1 65.3 26.4c10.7 25.4-1.1 54.6-26.5 65.3l4 12.8l58.9-65.3c1.9-2.1 4.5-3.3 7.4-3.3l20.9 0c.4-1.9 .9-3.7 1.4-5.5c8.6-26.1 36.7-40.4 62.8-31.9c26.2 8.5 40.4 36.6 31.9 62.8c-8.5 26.1-36.6 40.4-62.7 31.9l-14.5 32.3l3.7 10l11.2 0l0 9.9l-42.3 0c-1.1 0-2.1-.7-2.4-1.9c-.3-1.3 .5-2.6 1.8-3l21.1-5l-3.7-10l-89 0l4 12.9c1.3 4.2 5.2 7 9.5 7l16.4 0l0 10l-16.4 0zm-16.6-39.8l88.3 0l-25.9-69.2l-62.4 69.2zm97.7-3.4l10.3-23c-15.6-8.8-25.2-25.4-25.2-43.3l-10 0l24.9 66.3zm-124.2-26.5c2.2 0 4.4-.2 6.7-.6l-11.7-37.8c-.8-2.6 .6-5.4 3.3-6.2c2.6-.8 5.4 .7 6.2 3.3l11.7 37.7c20-9 28.9-32.6 19.8-52.7c-9-20-32.7-28.9-52.7-19.8c-20 9.1-28.9 32.7-19.9 52.7c6.6 14.5 21.1 23.5 36.6 23.4zm155.7-.1c18.4 1.6 36.1-9.9 41.6-28.4c6.2-21.1-5.8-43.3-26.9-49.5c-21.1-6.3-43.2 5.7-49.5 26.8c-.1 .5-.3 .9-.4 1.4l41.1 0c2.7 0 4.9 2.2 4.9 5c0 .7-.1 1.4-.4 2l-18.4 41.1c2.7 .8 5.3 1.3 8 1.6zm-17.1-5.6l15.3-34.1l-34.7 0c0 14 7.4 26.9 19.4 34.1z";
const BIKE_BOX = { cx: 240.005, cy: 223.92, w: 258.95 }; // bounding box of BIKE, measured with getBBox()
const ZEBRA_TRIANGLE = "m37.5 71.7h375.8l-187.9 325.4";
const ZEBRA_WALKER = "m237.3 320.4c0-9.7-7.8-17.5-17.5-17.5c-9.6 0-17.4 7.8-17.4 17.5c0 9.6 7.8 17.4 17.4 17.4c9.7 0 17.5-7.8 17.5-17.4zm8.7-52v-50.6h-34.9v41.9l-22.7-35c-4.6-7-14-9-21.1-4.5l43 66.2c6.5 10.1 20.1 13 30.2 6.4c.7-.4 1.4-1 2.1-1.5l29.3-24.6c3-2.5 4.7-6.2 4.7-10.1v-21.3c0-8.5-6.9-15.3-15.3-15.3v35.6zm-17.4-63.8l-41.3-75.9c-4.6-8.5-15.2-11.6-23.6-7l46.4 85.4c.7 1.3 1 2.7 1 4.2v2.1h34.9v-2.1c0-1.5 .4-2.9 1.1-4.2l34.7-63.8c4.6-8.5 1.4-19.1-7-23.7zm105.4-117l-28.2 63.9h28.3l38.2-63.9zm-63.9 0l-8.3 45.8l11-20.3l4.2 2.3c10.8 5.8 14.8 19.3 9 30.1l-3.3 6h4.2l21.5-63.9zm-63.9 0l5 63.9h28.4l5-63.9zm-63.9 0l21.6 63.9h10.5l-17.2-31.7l4.2-2.3c8.1-4.5 18.2-3.4 25.2 2.7l-5.9-32.6zm-63.8 0l38.1 63.9h28.4l-28.2-63.9";
const ZEBRA_SIZE = 450.75; // the 350 sign's square in these units

/** The StVO bicycle pictogram, `w` wide and centred on (x, y); `mirror` makes it face left (as on Z. 721). */
function bikeIcon(c: Ctx, x: number, y: number, w: number, color: string, mirror = false) {
  const k = w / BIKE_BOX.w;
  c.save();
  c.translate(x, y);
  c.scale(mirror ? -k : k, -k);
  c.translate(-BIKE_BOX.cx, -BIKE_BOX.cy);
  c.fillStyle = color;
  c.fill(new Path2D(BIKE));
  c.restore();
}

/**
 * Z. 720: green arrow with a chevron head and a white outline on a black square.
 * Drawn into the square (x, y, size) so 721 can show it small.
 */
function gruenpfeil(c: Ctx, x: number, y: number, size: number) {
  c.fillStyle = BLACK;
  c.fillRect(x, y, size, size);
  const pts = [[0.1, 0.4], [0.5, 0.4], [0.33, 0.21], [0.47, 0.08], [0.88, 0.5], [0.47, 0.92], [0.33, 0.79], [0.5, 0.6], [0.1, 0.6]];
  c.beginPath();
  for (const [px, py] of pts) c.lineTo(x + px * size, y + py * size);
  c.closePath();
  c.lineJoin = "miter";
  c.strokeStyle = WHITE;
  c.lineWidth = size * 0.07; // half of it shows outside the green: the white edge
  c.stroke();
  c.fillStyle = GREEN;
  c.fill();
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
    w: 0.9, h: 0.9, rim: { k: 0.92, cy: 0.62 },
    shape: (c, W) => triUp(c, W),
    paint: (c, W) => {
      warnTriangle(c, W);
      c.strokeStyle = BLACK;
      c.lineWidth = W * 0.06;
      c.beginPath(); // X around the triangle's centre, about a fifth of its width
      c.moveTo(W * 0.4, W * 0.52); c.lineTo(W * 0.6, W * 0.74);
      c.moveTo(W * 0.6, W * 0.52); c.lineTo(W * 0.4, W * 0.74);
      c.stroke();
    },
  },
  // Vorfahrt gewähren
  "205": { w: 0.9, h: 0.9, rim: { k: 0.92, cy: 0.38 }, shape: (c, W) => triDown(c, W), paint: (c, W) => warnTriangle(c, W, true) },
  // Halt. Vorfahrt gewähren
  "206": {
    w: 0.75, h: 0.75, rim: { k: 0.93 },
    shape: (c, W) => poly(c, 8, W * 0.49, 22.5, W / 2, W / 2),
    paint: (c, W) => {
      poly(c, 8, W * 0.49, 22.5, W / 2, W / 2);
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
    w: 0.7, h: 0.7, rim: { k: 0.94 },
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
  // Einbahnstraße — arrow points right: the sign hangs parallel to the road, facing away from it (see placement).
  "220": {
    w: 1.0, h: 0.37, twoSided: true,
    shape: (c, W, H) => roundRect(c, 1, 1, W - 2, H - 2, H * 0.12),
    paint: (c, W, H, { flip }) => {
      // White rim with a thin dark edge around the blue field, like the real plate.
      roundRect(c, 1, 1, W - 2, H - 2, H * 0.12);
      fill(c, WHITE);
      c.strokeStyle = "#444";
      c.lineWidth = 2;
      c.stroke();
      roundRect(c, W * 0.02, H * 0.05, W * 0.96, H * 0.9, H * 0.09);
      fill(c, BLUE);
      // Arrow (points right unless `flip`): long shaft, big head with rounded corners.
      const x = (u: number) => (flip ? W * (1 - u) : W * u);
      c.beginPath();
      for (const [u, v] of [[0.045, 0.335], [0.7, 0.335], [0.69, 0.13], [0.95, 0.5], [0.69, 0.87], [0.7, 0.665], [0.045, 0.665]])
        c.lineTo(x(u), H * v);
      c.closePath();
      c.lineJoin = "round";
      c.strokeStyle = WHITE;
      c.lineWidth = H * 0.05;
      c.stroke();
      fill(c, WHITE);
      // Narrow DIN-like lettering, left in the shaft; shrunk to fit if the font runs wide.
      c.fillStyle = BLACK;
      c.font = `500 ${H * 0.28}px "DIN Alternate", "DIN Condensed", "Arial Narrow", Arial, sans-serif`;
      const room = W * 0.6, w = c.measureText("Einbahnstraße").width;
      if (w > room) c.font = c.font.replace(/[\d.]+px/, `${(H * 0.28 * room) / w}px`);
      c.textAlign = flip ? "right" : "left";
      c.textBaseline = "middle";
      c.fillText("Einbahnstraße", x(0.075), H * 0.51);
    },
  },
  // Verbot der Einfahrt
  "267": {
    w: 0.7, h: 0.7, rim: { k: 0.94 },
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
    w: 0.9, h: 0.9, rim: { k: 0.92, cy: 0.62 },
    shape: (c, W) => triUp(c, W),
    paint: (c, W) => {
      warnTriangle(c, W);
      c.fillStyle = BLACK;
      c.fillRect(W * 0.345, W * 0.555, W * 0.31, W * 0.05); // side road
      // Priority road: wide bar with a 45° roof on top and a deep V notch at the foot (Z. 301 artwork).
      c.beginPath();
      for (const [x, y] of [[0.5, 0.39], [0.58, 0.47], [0.58, 0.76], [0.5, 0.68], [0.42, 0.76], [0.42, 0.47]]) c.lineTo(W * x, W * y);
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
  // Haltestelle: green H on a yellow disc with a green ring
  "224": {
    w: 0.6, h: 0.6, rim: { k: 0.94 },
    shape: (c, W) => circle(c, W / 2, W / 2, W * 0.49),
    paint: (c, W) => {
      circle(c, W / 2, W / 2, W * 0.49);
      fill(c, GREEN);
      circle(c, W / 2, W / 2, W * 0.42);
      fill(c, YELLOW);
      c.fillStyle = GREEN;
      c.font = `900 ${W * 0.5}px Arial, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("H", W / 2, W / 2 + W * 0.02);
    },
  },
  // Verkehrsberuhigter Bereich (Beginn / Ende)
  "325.1": { w: 0.9, h: 0.6, rim: { k: 0.95 }, shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 8), paint: (c, W, H) => playStreet(c, W, H, false) },
  "325.2": { w: 0.9, h: 0.6, rim: { k: 0.95 }, shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 8), paint: (c, W, H) => playStreet(c, W, H, true) },
  "350": {
    w: 0.7, h: 0.7, rim: { k: 0.94 },
    shape: (c, W) => roundRect(c, 2, 2, W - 4, W - 4, 10),
    paint: (c, W) => {
      roundRect(c, 2, 2, W - 4, W - 4, 10);
      fill(c, BLUE);
      c.save();
      c.translate(0, W);
      c.scale(W / ZEBRA_SIZE, -W / ZEBRA_SIZE);
      c.fillStyle = WHITE;
      c.fill(new Path2D(ZEBRA_TRIANGLE));
      c.fillStyle = BLACK;
      c.fill(new Path2D(ZEBRA_WALKER)); // walker and the crossing's stripes in one shape
      c.restore();
    },
  },
  // Grünpfeil
  "720": {
    w: 0.4, h: 0.4,
    shape: (c, W) => c.rect(0, 0, W, W),
    paint: (c, W) => gruenpfeil(c, 0, 0, W),
  },
  // Grünpfeil nur für den Radverkehr
  "721": {
    w: 0.42, h: 0.56,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 10),
    paint: (c, W, H) => {
      roundRect(c, 2, 2, W - 4, H - 4, 10);
      fill(c, BLACK);
      roundRect(c, W * 0.05, W * 0.05, W * 0.9, H - W * 0.1, 6);
      fill(c, WHITE);
      gruenpfeil(c, W * 0.27, H * 0.08, W * 0.46);
      c.fillStyle = BLACK;
      c.font = `700 ${H * 0.15}px Arial, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("nur", W / 2, H * 0.55);
      bikeIcon(c, W / 2, H * 0.78, W * 0.52, BLACK, true); // faces left on the real sign
    },
  },
  // Zusatzzeichen: course of the bending priority road, seen by traffic on this arm (arriving from the bottom)
  "1002": {
    w: 0.55, h: 0.55,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H, { layout, arm }) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      roundRect(c, 6, 6, W - 12, H - 12, 4);
      fill(c, WHITE);
      const viewRight = rightOf(DIR[arm].clone().negate());
      const cx = W / 2, cy = H / 2, L = H * 0.36, thick = H * 0.13;
      // Canvas x = viewer's right, canvas y (down) = towards the viewer, i.e. along DIR[arm].
      const end = (a: Arm, k = 1) => [cx + DIR[a].dot(viewRight) * L * k, cy + DIR[a].dot(DIR[arm]) * L * k] as const;
      c.strokeStyle = BLACK;
      c.lineCap = "butt";
      const prio = (layout.priority ?? []).filter((a) => layout.arms[a]);
      c.lineWidth = H * 0.05;
      for (const a of ARMS) {
        if (!layout.arms[a] || prio.includes(a)) continue;
        c.beginPath(); // stops short of the priority road, like on the real sign
        c.moveTo(...end(a));
        c.lineTo(...end(a, (thick / 2 + H * 0.06) / L));
        c.stroke();
      }
      if (prio.length === 2) {
        c.lineWidth = thick;
        c.beginPath(); // one stroke with a rounded bend (straight if the arms are opposite)
        c.moveTo(...end(prio[0]));
        c.arcTo(cx, cy, ...end(prio[1]), L * 0.45);
        c.lineTo(...end(prio[1]));
        c.stroke();
      }
    },
  },
  // Zusatzzeichen under Z. 220 (StVO Anlage 2 Nr. 9.1 "Radverkehr in Gegenrichtung"): bicycle over ⇄
  "1000-32": {
    w: 0.6, h: 0.45, twoSided: true,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      roundRect(c, 6, 6, W - 12, H - 12, 4);
      fill(c, WHITE);
      bikeIcon(c, W / 2, H * 0.32, W * 0.56, BLACK);
      arrow(c, W * 0.68, W * 0.32, H * 0.68, H * 0.05, BLACK);
      arrow(c, W * 0.32, W * 0.68, H * 0.82, H * 0.05, BLACK);
    },
  },
  // Zusatzzeichen "Radverkehr frei"
  "1022-10": {
    w: 0.6, h: 0.45,
    shape: (c, W, H) => roundRect(c, 2, 2, W - 4, H - 4, 6),
    paint: (c, W, H) => {
      roundRect(c, 2, 2, W - 4, H - 4, 6);
      fill(c, BLACK);
      roundRect(c, 6, 6, W - 12, H - 12, 4);
      fill(c, WHITE);
      bikeIcon(c, W / 2, H * 0.375, W * 0.54, BLACK);
      c.fillStyle = BLACK;
      c.font = `700 ${H * 0.28}px Arial, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("frei", W / 2, H * 0.76);
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
  } else {
    const W = canvas.width, H = canvas.height;
    if (def.rim) {
      def.shape(c, W, H);
      fill(c, WHITE);
      c.strokeStyle = "#777";
      c.lineWidth = W * 0.008;
      c.stroke();
      const cy = H * (def.rim.cy ?? 0.5);
      c.translate(W / 2, cy);
      c.scale(def.rim.k, def.rim.k);
      c.translate(-W / 2, -cy);
    }
    def.paint(c, W, H, info);
  }
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
