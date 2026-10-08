import * as THREE from "three";
import { moverSound, nearMissSound, ringBell, setSound, type MoverKind, type Voice } from "./audio";
import { createCameraRig } from "./camera";
import { firstMistake, isCorrect } from "./check";
import { rules, signInfo } from "./content/rules";
import { levels, scenarios } from "./content/scenarios";
import { UNLOCK_SHARE, isUnlocked, levelStats, loadAutoRead, loadFree, loadProgress, loadSound, record, saveAutoRead, saveFree, saveProgress, saveSound } from "./progress";
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

let index = -1; // into the flat `scenarios` list (-1 = none loaded yet); levels are consecutive slices of it
let progress = loadProgress();
let free = loadFree(); // all levels open, ignoring the 80 % rule
let sound = loadSound();
setSound(sound);
let autoRead = loadAutoRead();
ui.setAutoRead(autoRead);
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

const sheetData = () => ({
  rules: rules.map((card) => ({ card, signs: (card.signs ?? []).map(signImg) })),
  signs: (Object.keys(signInfo) as SignId[]).map((id) => ({ canvas: signImg(id), ...signInfo[id] })),
});

/** Continue where the kid left off: first unsolved scenario, else from the start. */
function startLevel(i: number) {
  const first = levels[i].scenarios.find((s) => !progress[s.id]?.solved) ?? levels[i].scenarios[0];
  go(scenarios.indexOf(first));
}

function showMap() {
  // The scene behind keeps running, so closing the map resumes exactly where the kid was.
  const stats = levels.map((l) => levelStats(l, progress));
  const need = (i: number) => Math.max(0, Math.ceil(stats[i].n * UNLOCK_SHARE) - stats[i].solved);
  const locked = levels.map((_, i) => !free && !isUnlocked(levels, i, progress));
  const next = levels.findIndex((_, i) => !locked[i] && need(i) > 0);
  // Only the first locked level says what is missing; repeating it on every one is noise.
  const firstLocked = locked.indexOf(true);
  const hint = (i: number) => `Noch ${need(i)} ${need(i) === 1 ? "Aufgabe" : "Aufgaben"} in „${levels[i].title}“`;
  ui.showMap(
    levels.map((l, i) => ({
      ...l, ...stats[i], locked: locked[i], done: need(i) === 0, next: i === next,
      hint: i === firstLocked ? hint(i - 1) : undefined,
    })),
    {
      pick: startLevel,
      sheet: sheetData,
      // The big button: back into a running task, else straight into the level to play now.
      cta: played
        ? { label: "Zurück zur Aufgabe", go: () => go(index, false) }
        : { label: `Los geht's: ${levels[Math.max(next, 0)].title}`, go: () => startLevel(Math.max(next, 0)) },
      free,
      setFree(on) {
        free = on;
        saveFree(on);
        showMap();
      },
      sound,
      setSound(on) {
        sound = on;
        saveSound(on);
        setSound(on);
      },
      autoRead,
      setAutoRead(on) {
        autoRead = on;
        saveAutoRead(on);
        ui.setAutoRead(on);
      },
      resetProgress() {
        progress = {};
        saveProgress(progress);
        showMap();
      },
    },
  );
}

function load(i: number) {
  index = i;
  mistakes = 0;
  disposeTree(level);
  const s = scenarios[i];
  ({ group: level, lights } = buildLevel(s.layout));
  actors = s.participants.map((p) => buildActor(p, s.layout));
  for (const a of actors) level.add(a.obj, a.route);
  world.scene.add(level);
  rig.setRider(actors.find((a) => a.p.kind === "player") ?? null);
  reset();
  const lvl = levels[levelOf(i)].scenarios;
  ui.showScenario(s.title, s.choice?.question ?? "Wer darf zuerst? Tippe alle der Reihe nach an.", {
    i: lvl.indexOf(s),
    n: lvl.length,
  });
  ui.showChips(s.choice ? [] : actors.map(chipFor), pick);
  if (s.choice) askChoice();
  // Frame everyone where they wait (lights/zebras push them further out), plus a little air —
  // around the HUD as it is laid out now, so measure it after the texts and chips are in.
  rig.setInsets(...insetsNow());
  const radius = Math.max(10, ...actors.map((a) => a.obj.position.length() + a.len / 2)) + 1.5;
  rig.snap(s.view ?? "bird", radius);
  ui.setView(rig.mode);
}

const insetsNow = () => {
  const { top, bottom } = ui.insets();
  return [top, bottom] as const;
};
addEventListener("resize", () => rig.setInsets(...insetsNow()));

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
    nearMissSound([x, y].some((a) => a.p.kind === "car" || a.p.kind === "bus"));
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

/**
 * One looping sound per road user that is moving right now; louder when near, panned to its side.
 * Cars and buses still waiting their turn idle quietly: otherwise an engine would only start up
 * when the car sets off — on a wrong answer that is right before the near miss, under the horn.
 */
const voices = new Map<Actor, Voice>();
const toCamera = new THREE.Vector3();
const IDLE = 0.35;
function updateSounds() {
  const level = new Map<Actor, number>();
  for (const r of sim?.runs ?? []) {
    if (r.a.d >= r.a.path.getLength()) continue;
    if (r.started) level.set(r.a, 1);
    else if (r.a.p.kind === "car" || r.a.p.kind === "bus") level.set(r.a, IDLE);
  }
  for (const [a, v] of voices) if (!level.has(a)) (v.stop(), voices.delete(a));
  for (const [a, k] of level) {
    let v = voices.get(a);
    if (!v) voices.set(a, (v = moverSound((a.p.kind === "player" ? "bike" : a.p.kind) as MoverKind)));
    toCamera.copy(a.obj.position).applyMatrix4(world.camera.matrixWorldInverse);
    // Full volume within 12 m (the bike view), fading with distance; bird's-eye view sits ~30 m up.
    const gain = Math.min(1, 12 / Math.max(toCamera.length(), 1));
    v.set(gain * k, THREE.MathUtils.clamp(toCamera.x / (Math.abs(toCamera.z) + 2), -1, 1) * 0.8, k === 1 ? 1 : 0);
  }
}

// Order matters: move actors first, then the camera follows the (possibly moved) bike.
world.onFrame((dt) => {
  stepSim(dt);
  clock += dt;
  for (const a of actors) updateSignal(a, clock, !!current().layout.roundabout);
  rig.update(dt);
  updateSounds();
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
  const all = levels.map((l) => levelStats(l, progress));
  ui.showLevelDone({
    number: i + 1, title: levels[i].title, n, solved, stars, last,
    total: { solved: all.reduce((a, l) => a + l.solved, 0), n: all.reduce((a, l) => a + l.n, 0) },
    missing: Math.max(0, Math.ceil(n * UNLOCK_SHARE) - solved),
    next: !last && (free || isUnlocked(levels, i + 1, progress)) ? levels[i + 1].title : undefined,
  }, { map: () => go(null), next: () => startLevel(i + 1) });
}

ui.onNext(() => {
  if (index + 1 >= scenarios.length || levelOf(index + 1) !== levelOf(index)) return levelDone();
  go(index + 1);
});
ui.onMenu(() => go(null));
// Stay inside the level; the stepper's buttons are disabled at both ends.
ui.onStep((d) => {
  if (levelOf(index + d) === levelOf(index)) go(index + d);
});

// --- URL and history: ?s=<scenario id> is a task, no ?s is the level map. ---
let played = false; // a task has been opened — the map then offers "Zurück zur Aufgabe"

/** Scenario from ?s=: its id, or its number (handy for testing). */
function indexFromUrl(): number | null {
  const s = new URLSearchParams(location.search).get("s");
  if (s === null) return null;
  const i = /^\d+$/.test(s) ? Number(s) : scenarios.findIndex((x) => x.id === s);
  return i >= 0 && i < scenarios.length ? i : null;
}

/** Same URL with ?s= set to the task, or removed for the map. Other parameters (?fps) stay. */
function urlFor(i: number | null) {
  const url = new URL(location.href);
  if (i === null) url.searchParams.delete("s");
  else url.searchParams.set("s", scenarios[i].id);
  return url;
}

/** Navigate: new history entry, then show it. `restart` = load the task fresh even if it is the current one. */
function go(i: number | null, restart = true) {
  const url = urlFor(i);
  if (url.href !== location.href) history.pushState(null, "", url);
  render(restart);
}

/** Show what the URL says: on start, after go(), and on browser back/forward. */
function render(restart: boolean) {
  ui.hideModal();
  const i = indexFromUrl();
  if (i === null) {
    showMap(); // first: auto-read stays quiet while the overview is open
    if (index < 0) load(0); // a scene always sits behind the map
    return;
  }
  played = true;
  ui.hideMap();
  // Back/forward to the task you were on resumes it instead of starting over.
  if (restart || i !== index) load(i);
}

addEventListener("popstate", () => render(false));
// Unknown ?s= falls back to the map; numbers are rewritten to ids so the URL stays readable.
history.replaceState(null, "", urlFor(indexFromUrl()));
render(true);

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
if (import.meta.env.DEV) Object.assign(window, { world, rig, voices });
// Offline use (public/sw.js). Not in dev: a cached app would hide Vite's hot reload.
if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
