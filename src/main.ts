import * as THREE from "three";
import { ringBell } from "./audio";
import { createCameraRig } from "./camera";
import { firstMistake, isCorrect } from "./check";
import { scenarios } from "./content/scenarios";
import { clearTime, listenForTaps, nearMissDist, nearMissSchedule, schedule, type Run } from "./play";
import { buildActor, placeAt, updateSignal, type Actor } from "./scene/actors";
import type { LightControl } from "./scene/lights";
import { ARMS } from "./scene/roads";
import { buildLevel, createWorld, disposeTree } from "./scene/world";
import type { Arm } from "./types";
import { createUI } from "./ui";

const app = document.querySelector<HTMLDivElement>("#app")!;
const world = createWorld(app);
const ui = createUI(app);
const rig = createCameraRig(world);

// ?s=2 jumps to a scenario — handy for testing on the tablet.
let index = Math.min(Number(new URLSearchParams(location.search).get("s")) || 0, scenarios.length - 1);
let level = new THREE.Group();
let actors: Actor[] = [];
let tapped: string[] = [];
let lights = new Map<Arm, LightControl>();
let clock = 0; // drives blinkers even while nobody moves

/** Running drive animation. `pair` is watched for the near-miss freeze. */
let sim: {
  runs: Run[];
  t: number;
  pair?: [Actor, Actor];
  /** Fired once — on the near-miss, or when everyone has left the junction. */
  done: ((nearMiss: boolean) => void) | null;
} | null = null;

const current = () => scenarios[index];

function load(i: number) {
  disposeTree(level);
  const s = scenarios[i];
  ({ group: level, lights } = buildLevel(s.layout));
  actors = s.participants.map((p) => buildActor(p, s.layout));
  for (const a of actors) level.add(a.obj, a.route);
  world.scene.add(level);
  rig.setRider(actors.find((a) => a.p.kind === "player") ?? null);
  // Frame everyone where they wait (lights/zebras push them further out), plus a little air.
  const radius = Math.max(10, ...actors.map((a) => a.obj.position.length() + a.len / 2)) + 1.5;
  rig.snap(s.view ?? "bird", radius);
  ui.setView(rig.mode);
  reset();
  ui.showScenario(s.title, s.choice?.question ?? "Wer darf zuerst? Tippe alle der Reihe nach an.");
  ui.showChips(s.choice ? [] : actors.map(chipFor), pick);
  if (s.choice) askChoice();
}

// No emoji on purpose: 🚗 is always red, which confuses next to a blue car. The chip colour does the matching.
const NAME = { car: "Auto", bus: "Bus", bike: "Rad", player: "Du", pedestrian: "Fußgänger" } as const;
const chipFor = (a: Actor) => ({
  id: a.p.id,
  label: NAME[a.p.kind],
  color: `#${a.color.toString(16).padStart(6, "0")}`,
});

/** One pick, from a chip or a tap in the scene. */
function pick(id: string) {
  if (current().choice || tapped.length === actors.length) return; // no order question / answer given
  // Picking the last one again takes it back — kids mis-tap a lot.
  if (tapped.at(-1) === id) tapped.pop();
  else if (!tapped.includes(id)) tapped.push(id);
  renderPins();
  if (tapped.length === actors.length) drive();
}

function askChoice() {
  const s = current();
  ui.showChoice(s.choice!.options, (i) => ui.showResult(i === s.choice!.correct, s.explain));
}

function reset() {
  sim = null;
  const s = current();
  for (const [arm, l] of lights) {
    const spec = s.layout.arms[arm]!.light!;
    l.car(spec.car);
    if (spec.ped) l.ped(spec.ped);
  }
  tapped = [];
  for (const a of actors) placeAt(a, 0), (a.route.visible = !s.hideRoutes);
  renderPins();
  ui.hideResult();
  if (s.choice) askChoice();
}

function renderPins() {
  for (const a of actors) {
    const n = tapped.indexOf(a.p.id);
    a.pin.textContent = n < 0 ? "" : String(n + 1);
    a.pin.classList.toggle("on", n >= 0);
    if (a.p.kind === "player") {
      rig.pin.textContent = a.pin.textContent;
      rig.pin.className = a.pin.className;
    }
  }
  ui.setChipNumbers(tapped);
}

function drive() {
  const s = current();
  const answer = s.answer!;
  const byId = new Map(actors.map((a) => [a.p.id, a]));
  const ok = isCorrect(answer, tapped);
  const showResult = () => ui.showResult(ok, s.explain);
  const mistake = ok ? null : firstMistake(answer, tapped);
  const near = mistake && nearMissSchedule(byId, tapped, mistake.index, mistake.expected[0]);
  if (near) {
    sim = { runs: near.runs, t: 0, pair: near.pair, done: (nearMiss) => {
      if (!nearMiss) return showResult();
      ui.showBanner();
      setTimeout(showResult, 1300);
    } };
  } else {
    // Correct: drive as the solution groups say (simultaneous where allowed). Wrong without conflict: as tapped.
    const groups = ok ? answer : tapped.map((id) => [id]);
    sim = { runs: schedule(groups.map((g) => g.map((id) => byId.get(id)!))).runs, t: 0, done: showResult };
  }
}

/**
 * Whoever sets off at a red light gets green first, so the animation never shows anyone running a red.
 * ponytail: instant switch without the yellow/red-yellow in between; add timed phases when a level teaches them.
 */
function switchLightsFor(a: Actor) {
  const l = lights.get(a.p.arm);
  if (!l) return;
  if (a.p.kind === "pedestrian") {
    if (l.state.ped !== "green") (l.car("red"), l.ped("green"));
    return;
  }
  if (l.state.car === "green") return;
  const axis = (arm: Arm) => ARMS.indexOf(arm) % 2; // N/S = 0, E/W = 1
  for (const [arm, other] of lights) {
    const same = axis(arm) === axis(a.p.arm);
    other.car(same ? "green" : "red");
    if (other.state.ped) other.ped(same ? "red" : "green");
  }
}

function stepSim(dt: number) {
  if (!sim) return;
  sim.t += dt;
  for (const r of sim.runs) {
    if (!r.started && sim.t >= r.start) {
      r.started = true;
      r.a.route.visible = false;
      switchLightsFor(r.a);
    }
    placeAt(r.a, Math.max(0, sim.t - r.start) * r.a.speed);
  }
  const [x, y] = sim.pair ?? [];
  if (x && y && x.obj.position.distanceTo(y.obj.position) < nearMissDist(x, y)) {
    sim.done?.(true);
    sim = null; // freeze in place
    return;
  }
  // Explain as soon as the junction is clear; vehicles keep driving off in the background.
  if (sim.done && sim.t > clearTime(sim.runs) + 0.5) {
    sim.done(false);
    sim.done = null;
  }
}

// Order matters: move actors first, then the camera follows the (possibly moved) bike.
world.onFrame((dt) => {
  stepSim(dt);
  clock += dt;
  for (const a of actors) updateSignal(a, clock, !!current().layout.roundabout);
  rig.update(dt);
});

listenForTaps(world.renderer.domElement, world.camera, () => [...actors.map((a) => a.obj), ...rig.targets()], (id) => {
  if (id === "bell") return ringBell();
  pick(id);
});

ui.onView(() => {
  rig.toggle();
  ui.setView(rig.mode);
});
ui.onReset(reset);
ui.onNext(() => {
  index = (index + 1) % scenarios.length;
  load(index);
});

load(index);

// Dev only: lets headless tests inspect state from the console.
if (import.meta.env.DEV) Object.assign(window, { world, rig });
