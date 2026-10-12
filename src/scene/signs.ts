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
  "m 126.133,155.603 0,-119.878 c -11.508,0 -20.836,9.343 -20.836,20.847 l 0,72.973 L 53.176,46.15 c -9.774,6.106 -12.731,18.969 -6.641,28.727 l 37.91,60.652 0,20.074",
  "m 126.133,160.814 -41.688,0 0,39.313 -27.832,-44.524 c -8.543,5.332 -11.144,16.598 -5.797,25.129 l 36.805,58.891 c 6.09,9.758 18.953,12.73 28.727,6.625 6.09,-3.813 9.785,-10.488 9.785,-17.688 l 0,-23.449 39.097,-23.445 c -5.187,-8.641 -16.386,-11.438 -25.023,-6.254 l -14.074,8.438",
  "m 139.168,278.084 c 0,-11.52 -9.332,-20.852 -20.848,-20.852 -11.519,0 -20.847,9.332 -20.847,20.852 0,11.516 9.328,20.848 20.847,20.848 11.516,0 20.848,-9.332 20.848,-20.848",
  "m 248.504,50.842 c 0,-8.344 -6.774,-15.117 -15.117,-15.117 -8.36,0 -15.129,6.773 -15.129,15.117 0,8.359 6.769,15.129 15.129,15.129 8.343,0 15.117,-6.77 15.117,-15.129",
  "M 321.086,114.346 302.062,98.564 c -4.21,-3.48 -10.382,-3.187 -14.25,0.664 l 33.54,33.54 c 6.984,-2.946 14.984,-2.2 21.316,1.972 l 22.367,-4.945 c 0.895,-0.211 1.653,-0.785 2.055,-1.613 l 11.449,-22.899 c -5.227,-2.613 -11.582,-0.492 -14.195,4.731 l -5.465,10.386 -10.586,0 9.078,-36.285 20.461,-1.547 c 5.52,-0.414 9.785,-5.011 9.785,-10.547 l -34.672,0 c -1.011,0 -1.961,0.508 -2.519,1.348 l -5.145,7.719 -10.586,-3.012 0,-31.781 c 0,-5.664 -4.465,-10.305 -10.117,-10.57",
  "m 345.281,153.67 c 0,-8.356 -6.773,-15.129 -15.117,-15.129 -8.359,0 -15.129,6.773 -15.129,15.129 0,8.359 6.77,15.117 15.129,15.117 8.344,0 15.117,-6.758 15.117,-15.117",
  "m 227.035,339.885 c -2.906,0 -5.547,-1.727 -6.707,-4.395 L 208.77,308.893 c -0.817,-1.868 -1.86,-3.649 -3.086,-5.29 l -1.75,-2.332 c -1.133,-1.519 -1.746,-3.355 -1.746,-5.25 l 0,-19.039 c 0,-4.023 3.25,-7.289 7.289,-7.289 l 108.222,0 c 4.028,0 7.313,3.266 7.313,7.289 l 0,19.039 c 0,1.895 -0.625,3.731 -1.77,5.25 l -1.75,2.332 c -1.242,1.641 -2.25,3.422 -3.062,5.29 l -11.582,26.597 c -1.157,2.668 -3.801,4.395 -6.707,4.395 l -73.106,0 z m 1.77,-7.328 69.566,0 c 1.176,0 2.223,-0.684 2.688,-1.75 l 10.058,-23.102 -95.039,0 10.039,23.102 c 0.469,1.066 1.528,1.75 2.688,1.75 z m -10.539,-32.161 c 4.851,0 8.769,-3.937 8.769,-8.789 0,-4.839 -3.918,-8.769 -8.769,-8.769 -4.84,0 -8.789,3.93 -8.789,8.769 0,4.852 3.949,8.789 8.789,8.789 z m 90.644,0 c 4.852,0 8.789,-3.937 8.789,-8.789 0,-4.839 -3.937,-8.769 -8.789,-8.769 -4.836,0 -8.769,3.93 -8.769,8.769 0,4.852 3.933,8.789 8.769,8.789 z",
  "m 209.484,266.764 17.543,0 0,-16.09 c 0,-2.426 -1.961,-4.383 -4.386,-4.383 l -8.77,0 c -2.426,0 -4.387,1.957 -4.387,4.383",
  "m 300.145,266.764 17.554,0 0,-16.09 c 0,-2.426 -1.972,-4.383 -4.398,-4.383 l -8.758,0 c -2.426,0 -4.398,1.957 -4.398,4.383",
  "m 474.164,352.217 -15.746,-10.289 0,7.144 -15.766,0 0,-17.433 -50.386,-32.95 28.347,0 0,-110.246 107.082,0 0,110.246 28.348,0 -81.879,53.528 z m 0,-9.434 44.094,-36.223 0,-108.664 -31.512,0 0,47.243 -25.184,0 0,-47.243 -31.492,0 0,108.664 44.094,36.223 z",
  "m 442.641,298.674 25.223,0 0,-31.496 -25.223,0 0,31.496 z",
  "m 480.445,298.674 25.203,0 0,-31.496 -25.203,0 0,31.496 z",
  "m 526.785,59.119 -108.07,78.168 c -34.977,25.289 -55.692,65.84 -55.692,109.004 l 13.157,0 c 0,-38.938 18.687,-75.531 50.242,-98.352 L 526.785,74.943",
];
const PLAY_STREET_END = "m 10.09,35.299 518.496,345.758 30.805,0 c 8.984,0 16.261,-7.278 16.261,-16.247 l 0,-8.64 -518.504,-345.758 -30.82,0 c -8.957,0 -16.238,7.289 -16.238,16.273";

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

/** The StVO bicycle pictogram: diamond frame, saddle on a post, handlebar on a raised stem. `s` ≈ half the wheelbase. */
function bikeIcon(c: Ctx, x: number, y: number, s: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = s * 0.08;
  c.lineCap = c.lineJoin = "round";
  const p = (dx: number, dy: number) => [x + dx * s, y + dy * s] as const;
  for (const dx of [-0.55, 0.55]) {
    c.beginPath();
    c.arc(...p(dx, 0.25), 0.33 * s, 0, Math.PI * 2);
    c.stroke();
  }
  const line = (...pts: (readonly [number, number])[]) => {
    c.beginPath();
    c.moveTo(...pts[0]);
    for (const q of pts.slice(1)) c.lineTo(...q);
    c.stroke();
  };
  const rear = p(-0.55, 0.25), crank = p(-0.05, 0.25), seat = p(-0.2, -0.2), head = p(0.36, -0.2), front = p(0.55, 0.25);
  line(rear, crank, seat, rear); // chain stay, seat tube, seat stay
  line(seat, head, crank); // top tube, down tube
  line(p(0.33, -0.32), front); // fork and head tube
  line(seat, p(-0.23, -0.36)); // seat post
  line(p(-0.36, -0.38), p(-0.1, -0.38)); // saddle
  line(p(0.33, -0.32), p(0.3, -0.45), p(0.46, -0.45)); // stem and bar
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
      poly(c, 3, W * 0.45, -90, W / 2, W * 0.57);
      fill(c, WHITE);
      // Zebra stripes in perspective under the walker: fanning out towards the viewer.
      c.fillStyle = BLACK;
      for (let i = -2; i <= 2; i++) {
        const top = W * (0.5 + i * 0.085), bot = W * (0.5 + i * 0.105);
        c.beginPath();
        c.moveTo(top - W * 0.025, W * 0.69);
        c.lineTo(top + W * 0.025, W * 0.69);
        c.lineTo(bot + W * 0.032, W * 0.775);
        c.lineTo(bot - W * 0.032, W * 0.775);
        c.closePath();
        c.fill();
      }
      walkerIcon(c, W * 0.5, W * 0.48, W * 0.24, BLACK);
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
      bikeIcon(c, W / 2, H * 0.76, W * 0.27, BLACK);
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
      bikeIcon(c, W / 2, H * 0.34, H * 0.3, BLACK);
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
      bikeIcon(c, W / 2, H * 0.33, H * 0.3, BLACK);
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
