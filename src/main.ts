import * as THREE from "three";
import { isCorrect } from "./check";
import { scenarios } from "./content/scenarios";
import { listenForTaps } from "./play";
import { buildActor, type Actor } from "./scene/actors";
import { buildRoads } from "./scene/roads";
import { createWorld, disposeTree } from "./scene/world";
import { createUI } from "./ui";

const app = document.querySelector<HTMLDivElement>("#app")!;
const world = createWorld(app);
const ui = createUI(app);

let index = 0;
let level = new THREE.Group();
let actors: Actor[] = [];
let tapped: string[] = [];

function load(i: number) {
  disposeTree(level);
  level = new THREE.Group();
  const s = scenarios[i];
  level.add(buildRoads(s.layout));
  actors = s.participants.map(buildActor);
  for (const a of actors) level.add(a.obj);
  world.scene.add(level);
  tapped = [];
  ui.showScenario(s.title, "Wer darf zuerst fahren? Tippe alle in der richtigen Reihenfolge an.");
}

function renderPins() {
  for (const a of actors) {
    const n = tapped.indexOf(a.p.id);
    a.pin.textContent = n < 0 ? "" : String(n + 1);
    a.pin.classList.toggle("on", n >= 0);
  }
}

listenForTaps(world.renderer.domElement, world.camera, () => actors.map((a) => a.obj), (id) => {
  const s = scenarios[index];
  if (tapped.length === actors.length) return; // answer already given
  // Tapping the last one again takes it back — kids mis-tap a lot.
  if (tapped.at(-1) === id) tapped.pop();
  else if (!tapped.includes(id)) tapped.push(id);
  renderPins();
  if (tapped.length === actors.length) ui.showResult(isCorrect(s.answer, tapped), s.explain);
});

ui.onReset(() => {
  tapped = [];
  renderPins();
  ui.hideResult();
});
ui.onNext(() => {
  index = (index + 1) % scenarios.length;
  load(index);
});

load(index);
