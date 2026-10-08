import * as THREE from "three";
import { ringBell } from "./audio";
import { createCameraRig } from "./camera";
import { firstMistake, isCorrect } from "./check";
import { rules, signInfo } from "./content/rules";
import { levels, scenarios } from "./content/scenarios";
import { UNLOCK_SHARE, isUnlocked, levelStats, loadFree, loadProgress, record, saveFree, saveProgress } from "./progress";
import { signCanvas } from "./scene/signs";
import { clearTime, isNearMiss, listenForTaps, nearMissSchedule, schedule, type Run } from "./play";
import { buildActor, placeAt, updateSignal, type Actor } from "./scene/actors";
import type { LightControl } from "./scene/lights";
import { ARMS } from "./scene/roads";
import { buildLevel, createWorld, disposeTree } from "./scene/world";
import type { Arm, Layout, SignId } from "./types";
import { createUI } from "./ui";

const app = document.querySelector<HTMLDivElement>("#app")!;
const world = createWorld(app);
const ui = createUI(app);
const rig = createCameraRig(world);

let index = 0; // into the flat `scenarios` list; levels are consecutive slices of it
let progress = loadProgress();
let free = loadFree(); // all levels open, ignoring the 80 % rule
let mistakes = 0; // wrong answers on the current scenario — a star needs zero
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
  at?: THREE.Vector3; // where the pair's lines cross
  /** Fired once — on the near-miss, or when everyone has left the junction. */
  done: ((nearMiss: boolean) => void) | null;
} | null = null;

const current = () => scenarios[index];
const levelOf = (i: number) => levels.findIndex((l) => l.scenarios.includes(scenarios[i]));

/** Store the answer and show the result sheet with a link to the rule card. */
function finish(ok: boolean) {
  const s = current();
  progress = record(progress, s.id, ok, mistakes === 0);
  saveProgress(progress);
  if (!ok) mistakes++;
  const card = rules.find((r) => r.id === s.rule)!;
  ui.showResult(ok, s.explain, { title: card.title, open: () => showCard(card.id) });
}

// The 1002 Zusatzzeichen is drawn from a layout; outside a scene, show a typical left bend.
const SAMPLE: { layout: Layout; arm: "S" } = {
  layout: { priority: ["S", "W"], arms: { N: {}, E: {}, S: {}, W: {} } },
  arm: "S",
};
const signImg = (id: SignId) => signCanvas(id, SAMPLE);

function showCard(id: string) {
  const card = rules.find((r) => r.id === id)!;
  ui.showCard(card, (card.signs ?? []).map(signImg));
}

function openSheet() {
  ui.showSheet(rules, (Object.keys(signInfo) as SignId[]).map((id) => ({ canvas: signImg(id), ...signInfo[id] })));
}

/** `canClose`: opened from a running task (menu button), so offer the way back to it. */
function showMap(canClose = false) {
  // The scene behind keeps running, so closing the map resumes exactly where the kid was.
  ui.showMap(
    levels.map((l, i) => ({ ...l, ...levelStats(l, progress), locked: !free && !isUnlocked(levels, i, progress) })),
    {
      pick(i) {
        ui.hideMap();
        // Continue where the kid left off: first unsolved scenario, else from the start.
        const first = levels[i].scenarios.find((s) => !progress[s.id]?.solved) ?? levels[i].scenarios[0];
        index = scenarios.indexOf(first);
        load(index);
      },
      openSheet,
      free,
      setFree(on) {
        free = on;
        saveFree(on);
        showMap(canClose);
      },
      close: canClose ? ui.hideMap : undefined,
    },
  );
}

function load(i: number) {
  mistakes = 0;
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
  const lvl = levels[levelOf(i)].scenarios;
  ui.showScenario(s.title, s.choice?.question ?? "Wer darf zuerst? Tippe alle der Reihe nach an.", {
    i: lvl.indexOf(s),
    n: lvl.length,
  });
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
  ui.showChoice(s.choice!.options, (i) => finish(i === s.choice!.correct));
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
  const showResult = () => finish(ok);
  const mistake = ok ? null : firstMistake(answer, tapped);
  const near = mistake && nearMissSchedule(byId, tapped, mistake.index, mistake.expected[0]);
  if (near) {
    sim = { runs: near.runs, t: 0, pair: near.pair, at: near.at, done: (nearMiss) => {
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
  if (x && y && sim.at && isNearMiss(x, y, sim.at)) {
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
/**
 * Summary at the end of a level. Judged by progress, not position: with the stepper or free choice
 * a kid can reach the last task with others unsolved.
 */
function levelDone() {
  const i = levelOf(index);
  const { n, solved, stars } = levelStats(levels[i], progress);
  const last = i === levels.length - 1;
  ui.showLevelDone({
    title: levels[i].title, n, stars, last,
    missing: Math.max(0, Math.ceil(n * UNLOCK_SHARE) - solved),
    next: !last && isUnlocked(levels, i + 1, progress) ? `${i + 2}. ${levels[i + 1].title}` : undefined,
  }, showMap);
}

ui.onNext(() => {
  if (index + 1 >= scenarios.length || levelOf(index + 1) !== levelOf(index)) return levelDone();
  load(++index);
});
ui.onMenu(() => showMap(true));
// Stay inside the level; the stepper's buttons are disabled at both ends.
ui.onStep((d) => {
  if (levelOf(index + d) === levelOf(index)) load((index += d));
});

// A scene always sits behind the map. ?s=2 jumps straight into a scenario — handy for testing.
const jump = new URLSearchParams(location.search).get("s");
index = Math.min(Number(jump) || 0, scenarios.length - 1);
load(index);
if (jump === null) showMap();

// ?fps shows the frame rate — for checking smoothness on a real phone (also in the production build).
if (new URLSearchParams(location.search).has("fps")) {
  const meter = Object.assign(document.createElement("div"), { className: "fps" });
  app.appendChild(meter);
  let frames = 0, since = performance.now();
  world.onFrame(() => {
    frames++;
    const now = performance.now();
    if (now - since < 1000) return;
    meter.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${world.renderer.info.render.calls} calls`;
    (frames = 0), (since = now);
  });
}

// Dev only: lets headless tests inspect state from the console.
if (import.meta.env.DEV) Object.assign(window, { world, rig });
