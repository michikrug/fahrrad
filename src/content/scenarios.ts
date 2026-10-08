import type { Arm, ArmSpec, Layout, Level, Move, Participant, Phase, Scenario, SignId } from "../types";

// Answers are written by hand like a teacher would; tests/content.test.ts checks consistency.
// Every rule used here is backed by a RuleCard with its StVO source (content/rules.ts).
// Orange is reserved for the player (bike + route arrow) — do not give other participants orange colours.
// Avoided on purpose: situations the StVO doesn't settle clearly (e.g. two vehicles waiting at
// give-way entries of a roundabout, four arms all occupied under "rechts vor links").

const RED = 0xd63a3a, BLUE = 0x2f6fd6, GREEN = 0x2f9e5a, PURPLE = 0x8e44ad, TEAL = 0x16a3a3, PINK = 0xe23d6e;

// --- layout helpers -------------------------------------------------------------------------
const cross = (arms: Partial<Record<Arm, ArmSpec>> = {}): Layout => ({ arms: { N: {}, E: {}, S: {}, W: {}, ...arms } });
const tee = (arms: Partial<Record<Arm, ArmSpec>> = {}): Layout => ({ arms: { E: {}, S: {}, W: {}, ...arms } });
/** Same sign(s) on the N/S road and on the E/W road. */
const signed = (ns: SignId[], ew: SignId[]): Layout =>
  cross({ N: { signs: ns }, S: { signs: ns }, E: { signs: ew }, W: { signs: ew } });
/** Traffic lights; pedestrians crossing an arm get green when the traffic along that arm has red. */
const lights = (ns: Phase, ew: Phase, extra: Partial<Record<Arm, ArmSpec>> = {}): Layout => {
  const ped = (p: Phase): "red" | "green" => (p === "red" ? "green" : "red");
  const l = (car: Phase) => ({ light: { car, ped: ped(car) } });
  return cross({ N: l(ns), S: l(ns), E: l(ew), W: l(ew), ...extra });
};
const roundabout: Layout = {
  roundabout: true,
  arms: { N: { signs: ["215", "205"] }, E: { signs: ["215", "205"] }, S: { signs: ["215", "205"] }, W: { signs: ["215", "205"] } },
};
const bend = (priority: [Arm, Arm]): Layout => ({
  priority,
  arms: Object.fromEntries(
    (["N", "E", "S", "W"] as const).map((a) => [a, { signs: priority.includes(a) ? ["306", "1002"] : ["205", "1002"] }]),
  ),
});

// --- participant helpers --------------------------------------------------------------------
const you = (move: Move = "straight", extra: Partial<Participant> = {}): Participant =>
  ({ id: "you", kind: "player", arm: "S", move, ...extra });
const car = (id: string, arm: Arm, move: Move, color: number, extra: Partial<Participant> = {}): Participant =>
  ({ id, kind: "car", arm, move, color, ...extra });
const walker = (id: string, arm: Arm, side: 1 | -1, color = PINK): Participant => ({ id, kind: "pedestrian", arm, side, color });

const L1: Scenario[] = [
  {
    id: "rvl-1", rule: "rechts-vor-links", title: "Rechts vor links",
    layout: cross(),
    participants: [you(), car("car", "E", "straight", RED)],
    answer: [["car"], ["you"]],
    explain: "Hier gibt es keine Schilder und keine Ampel. Dann gilt: Rechts vor links. Das rote Auto kommt von deiner rechten Seite. Es darf zuerst fahren.",
  },
  {
    id: "rvl-bike", rule: "rechts-vor-links", title: "Radfahrer von rechts",
    layout: cross(),
    participants: [you(), { id: "bike", kind: "bike", arm: "E", move: "straight", color: PURPLE }],
    answer: [["bike"], ["you"]],
    explain: "Rechts vor links gilt für alle – auch für andere Radfahrer. Der Junge auf dem lila Rad kommt von rechts, also fährt er zuerst.",
  },
  {
    id: "rvl-2", rule: "rechts-vor-links", title: "Rechts vor links mit drei",
    layout: cross(),
    participants: [you(), car("red", "E", "straight", RED), car("blue", "W", "straight", BLUE)],
    answer: [["red"], ["you"], ["blue"]],
    explain: "Das rote Auto hat niemanden rechts von sich, also fährt es zuerst. Danach bist du dran, denn das blaue Auto kommt von links und muss auf dich warten.",
  },
  {
    id: "t-1", rule: "rechts-vor-links", title: "T-Kreuzung",
    layout: tee(),
    participants: [you("straight", { arm: "W" }), car("car", "S", "left", PURPLE)],
    answer: [["car"], ["you"]],
    explain: "Auch an einer T-Kreuzung gilt ohne Schilder: Rechts vor links. Das lila Auto kommt von deiner rechten Seite, also darf es zuerst fahren.",
  },
  {
    id: "t-2", rule: "rechts-vor-links", title: "T-Kreuzung von unten",
    layout: tee(),
    participants: [you("left"), car("car", "W", "straight", BLUE)],
    answer: [["you"], ["car"]],
    explain: "Du kommst von unten und willst links abbiegen. Das blaue Auto kommt von links. Für das Auto kommst du von rechts – also muss es dich vorlassen. Rechts vor links gilt auch für die Straße, die auf die Querstraße trifft.",
  },
];

const L2: Scenario[] = [
  {
    id: "turn-1", rule: "gegenverkehr", title: "Links abbiegen",
    layout: cross(),
    participants: [you("left"), car("car", "N", "straight", GREEN)],
    answer: [["car"], ["you"]],
    explain: "Du willst links abbiegen. Wer abbiegt, muss den Gegenverkehr durchlassen. Das grüne Auto fährt geradeaus, also darf es zuerst fahren.",
  },
  {
    id: "turn-2", rule: "gegenverkehr", title: "Gegenverkehr biegt ab",
    layout: cross(),
    participants: [you("left"), car("car", "N", "right", TEAL)],
    answer: [["car"], ["you"]],
    explain: "Das Auto kommt dir entgegen und biegt rechts ab – in die gleiche Straße wie du. Du biegst links ab und musst den Gegenverkehr durchlassen. Erst das Auto, dann du.",
  },
  {
    id: "blink-1", rule: "gegenverkehr", title: "Blinker lesen", hideRoutes: true,
    layout: cross(),
    participants: [you(), car("car", "N", "left", GREEN)],
    answer: [["you"], ["car"]],
    explain: "Schau auf den Blinker: Das grüne Auto blinkt links. Es will abbiegen und muss dich als Gegenverkehr zuerst durchlassen.",
  },
  {
    id: "turn-hook", rule: "rechtsabbieger", title: "Auto biegt rechts ab",
    layout: cross(),
    participants: [you(), car("car", "S", "right", BLUE, { back: 4 })],
    answer: [["you"], ["car"]],
    explain: "Das blaue Auto hinter dir blinkt rechts. Wer rechts abbiegt, muss Radfahrer durchlassen, die geradeaus fahren. Du darfst zuerst. Aber schau trotzdem, ob der Fahrer dich gesehen hat!",
  },
  {
    id: "turn-walk", rule: "fussgaenger-abbiegen", title: "Abbiegen und Fußgänger",
    layout: cross(),
    participants: [you("right"), walker("kid", "E", 1)],
    answer: [["kid"], ["you"]],
    explain: "Du biegst rechts ab, und in der Straße geht ein Mädchen über die Fahrbahn. Wer abbiegt, nimmt besondere Rücksicht auf Fußgänger und wartet, wenn nötig.",
  },
  {
    id: "turn-sign", rule: "zeichen-geben", title: "Bevor du abbiegst", view: "ego",
    layout: cross(),
    participants: [you("left")],
    choice: {
      question: "Du willst gleich links abbiegen. Was machst du vorher?",
      options: [
        "Über die linke Schulter schauen, linken Arm ausstrecken und zur Straßenmitte fahren",
        "Den rechten Arm ausstrecken und am Rand bleiben",
        "Gar nichts, ich biege einfach ab",
      ],
      correct: 0,
    },
    explain: "Vor dem Abbiegen schaust du nach hinten, ob jemand kommt, und zeigst mit dem Arm, wohin du willst. Dann fährst du bis zur Straßenmitte – das heißt „einordnen“. Kurz vor dem Abbiegen schaust du noch einmal nach hinten.",
  },
];

const L3: Scenario[] = [
  {
    id: "sign-1", rule: "vorfahrtstrasse", title: "Vorfahrtstraße",
    layout: signed(["306"], ["205"]),
    participants: [you(), car("car", "E", "straight", RED)],
    answer: [["you"], ["car"]],
    explain: "Du fährst auf der Vorfahrtstraße. Das siehst du am gelben Schild. Das rote Auto hat das Dreieck-Schild „Vorfahrt gewähren“. Es muss warten, auch wenn es von rechts kommt.",
  },
  {
    id: "sign-left", rule: "vorfahrtstrasse", title: "Vorfahrt von links",
    layout: signed(["205"], ["306"]),
    participants: [you(), car("car", "W", "straight", BLUE)],
    answer: [["car"], ["you"]],
    explain: "Vor dir steht „Vorfahrt gewähren“. Das blaue Auto fährt auf der Vorfahrtstraße. Es darf zuerst fahren – obwohl es von links kommt. Schilder gehen vor Rechts vor links.",
  },
  {
    id: "sign-301", rule: "vorfahrtstrasse", title: "Vorfahrt an dieser Kreuzung",
    layout: signed(["301"], ["205"]),
    participants: [you(), car("car", "E", "straight", GREEN)],
    answer: [["you"], ["car"]],
    explain: "Das Dreieck mit dem dicken schwarzen Strich sagt: An dieser Kreuzung hast du Vorfahrt. Das grüne Auto hat das Dreieck mit der Spitze nach unten und muss warten.",
  },
  {
    id: "sign-102", rule: "rechts-vor-links", title: "Schild: Rechts vor links",
    layout: signed(["102"], ["102"]),
    participants: [you(), car("car", "E", "straight", PURPLE)],
    answer: [["car"], ["you"]],
    explain: "Das Dreieck mit dem schwarzen Kreuz warnt: Gleich kommt eine Kreuzung, an der Rechts vor links gilt. Das lila Auto kommt von rechts und fährt zuerst.",
  },
  {
    id: "sign-stop", rule: "stopp", title: "Stoppschild",
    layout: cross({ N: { signs: ["301"] }, S: { signs: ["206"] }, E: { signs: ["301"] }, W: { signs: ["206"] } }),
    participants: [you(), car("car", "E", "straight", BLUE)],
    answer: [["car"], ["you"]],
    explain: "Vor dir steht ein Stoppschild. Du musst an der Linie ganz anhalten und alle anderen vorlassen. Erst dann darfst du fahren.",
  },
  {
    id: "sign-stop-empty", rule: "stopp", title: "Stopp – und keiner kommt", view: "ego",
    layout: cross({ S: { signs: ["206"] }, N: { signs: ["206"] }, E: { signs: ["306"] }, W: { signs: ["306"] } }),
    participants: [you()],
    choice: {
      question: "Vor dir ist ein Stoppschild. Es kommt gerade niemand. Was machst du?",
      options: ["An der Linie ganz anhalten, dann fahren", "Langsam weiterrollen, es kommt ja keiner"],
      correct: 0,
    },
    explain: "Am Stoppschild hältst du immer ganz an – auch wenn niemand kommt. Erst schauen, dann fahren.",
  },
];

const L4: Scenario[] = [
  {
    id: "light-1", rule: "ampel", title: "Ampel grün",
    layout: lights("green", "red", { S: { light: { car: "green", ped: "red", bike: "green" } } }),
    participants: [you(), car("car", "E", "straight", RED)],
    answer: [["you"], ["car"]],
    explain: "Deine Ampel ist grün, die vom roten Auto ist rot. Grün heißt: Du darfst fahren. Rot heißt: Halt vor der Kreuzung!",
  },
  {
    id: "light-red", rule: "ampel", title: "Ampel rot",
    layout: lights("red", "green"),
    participants: [you(), car("car", "E", "straight", BLUE)],
    answer: [["car"], ["you"]],
    explain: "Deine Ampel ist rot – also wartest du vor der Kreuzung. Das blaue Auto hat Grün und fährt zuerst. Danach wird deine Ampel grün.",
  },
  {
    id: "light-yellow", rule: "ampel", title: "Ampel gelb", view: "ego",
    layout: lights("yellow", "red"),
    participants: [you("straight", { back: 6 })], // further back so the signal head is in view
    choice: {
      question: "Deine Ampel springt auf Gelb. Was machst du?",
      options: ["Vor der Kreuzung warten", "Schnell noch losfahren", "Gelb ist wie Grün, also fahren"],
      correct: 0,
    },
    explain: "Gelb heißt: Vor der Kreuzung auf das nächste Licht warten. Gleich kommt Rot – also nicht mehr losfahren.",
  },
  {
    id: "light-walk", rule: "fussgaenger-abbiegen", title: "Grün – und ein Fußgänger",
    layout: lights("green", "red"),
    participants: [you("right"), walker("kid", "E", 1)],
    answer: [["kid"], ["you"]],
    explain: "Du hast Grün und willst rechts abbiegen. Das Mädchen hat auch Grün und geht über die Straße, in die du fährst. Wer abbiegt, nimmt Rücksicht und wartet, bis sie drüben ist.",
  },
  {
    id: "light-arrow", rule: "gruenpfeil", title: "Grünpfeil", view: "ego",
    layout: lights("red", "green", { S: { light: { car: "red", ped: "green", arrow: "721" } } }),
    participants: [you("right", { back: 6 })], // further back so light and arrow are in view
    choice: {
      question: "Deine Ampel ist rot. Rechts daneben hängt ein grüner Pfeil mit Fahrrad. Du willst rechts abbiegen. Was machst du?",
      options: ["Erst anhalten, dann vorsichtig rechts abbiegen", "Ohne anzuhalten rechts abbiegen", "Bei Rot darf ich nie abbiegen"],
      correct: 0,
    },
    explain: "Der grüne Pfeil mit Fahrrad gilt nur für Radfahrer. Du darfst bei Rot rechts abbiegen – aber erst, nachdem du angehalten und geschaut hast.",
  },
];

const L5: Scenario[] = [
  {
    id: "zebra-1", rule: "zebrastreifen", title: "Zebrastreifen",
    layout: cross({ N: { zebra: true } }),
    participants: [you(), walker("kid", "N", 1)],
    answer: [["kid"], ["you"]],
    explain: "Das Mädchen will über den Zebrastreifen. Fahrzeuge müssen es hinüberlassen – auch du mit dem Rad. Du wartest, bis es drüben ist.",
  },
  {
    id: "zebra-own", rule: "zebrastreifen", title: "Zebrastreifen vor dir",
    layout: cross({ S: { zebra: true } }),
    participants: [you(), walker("kid", "S", -1, TEAL)],
    answer: [["kid"], ["you"]],
    explain: "Direkt vor dir ist ein Zebrastreifen, und ein Junge geht hinüber. Du hältst an und lässt ihn gehen.",
  },
  {
    id: "zebra-two", rule: "zebrastreifen", title: "Zwei Fußgänger",
    layout: cross({ N: { zebra: true } }),
    participants: [you(), walker("kid1", "N", 1), walker("kid2", "N", -1, TEAL)],
    answer: [["kid1", "kid2"], ["you"]],
    explain: "Beide wollen über den Zebrastreifen. Die beiden dürfen gleichzeitig gehen – du wartest, bis beide drüben sind.",
  },
  {
    id: "zebra-wait", rule: "zebrastreifen", title: "Jemand will hinüber", view: "ego",
    layout: cross({ N: { zebra: true } }),
    participants: [you(), walker("kid", "N", 1, TEAL)], // right side: the narrow ego view must show him
    choice: {
      question: "Am Zebrastreifen vor dir steht ein Junge und will hinüber. Was machst du?",
      options: ["Anhalten und ihn hinübergehen lassen", "Klingeln, damit er wartet", "Schnell vorbeifahren"],
      correct: 0,
    },
    explain: "Wer erkennbar über den Zebrastreifen gehen will, muss hinübergelassen werden. Du fährst langsam heran und hältst an.",
  },
];

const L6: Scenario[] = [
  {
    id: "oneway-1", rule: "einbahn", title: "Einbahnstraße: Radverkehr frei", view: "ego",
    layout: cross({ N: { oneway: true, exitSigns: ["267", "1022-10"] } }),
    participants: [you()],
    choice: {
      question: "Du willst geradeaus in die Straße vor dir fahren. Darfst du das?",
      options: ["Ja, Radfahrer dürfen hier hineinfahren.", "Nein, hier darf niemand hinein."],
      correct: 0,
    },
    explain: "Das rote Schild mit dem weißen Balken heißt: Hier darf niemand hineinfahren. Aber das kleine Schild darunter sagt: Radverkehr frei! Du darfst also fahren und achtest auf entgegenkommende Autos.",
  },
  {
    id: "oneway-no", rule: "einbahn", title: "Einfahrt verboten", view: "ego",
    layout: cross({ N: { oneway: true, exitSigns: ["267"] } }),
    participants: [you()],
    choice: {
      question: "Du willst geradeaus in die Straße vor dir fahren. Darfst du das?",
      options: ["Ja, mit dem Rad darf ich überall hinein.", "Nein, hier darf niemand hinein."],
      correct: 1,
    },
    explain: "Das rote Schild mit dem weißen Balken heißt: Verbot der Einfahrt. Es steht kein Zusatzschild darunter – also gilt es auch für dich.",
  },
  {
    id: "oneway-220", rule: "einbahn", title: "In die Einbahnstraße",
    layout: cross({ E: { oneway: true, exitSigns: ["220"] } }),
    participants: [you("right")],
    choice: {
      question: "Du willst rechts in die Straße mit dem blauen Pfeil-Schild abbiegen. Darfst du das?",
      options: ["Ja, ich fahre in Pfeilrichtung hinein.", "Nein, in eine Einbahnstraße darf ich nie."],
      correct: 0,
    },
    explain: "Das blaue Schild zeigt eine Einbahnstraße. In Pfeilrichtung darfst du hineinfahren.",
  },
  {
    id: "oneway-out", rule: "einbahn-ausfahrt", title: "Radfahrer aus der Einbahnstraße",
    layout: cross({ E: { oneway: true, exitSigns: ["220", "1000-32"] } }),
    participants: [you(), { id: "bike", kind: "bike", arm: "E", move: "straight", color: PURPLE }],
    answer: [["bike"], ["you"]],
    explain: "Das kleine Schild unter der Einbahnstraße zeigt: Radfahrer dürfen auch entgegen fahren. Der Junge kommt so aus der Einbahnstraße – von deiner rechten Seite. Rechts vor links gilt weiter, also fährt er zuerst.",
  },
];

const L7: Scenario[] = [
  {
    id: "bend-1", rule: "abknickend", title: "Abknickende Vorfahrt",
    layout: bend(["S", "W"]),
    participants: [you("left"), car("car", "E", "straight", GREEN)],
    answer: [["you"], ["car"]],
    explain: "Das kleine Schild unter dem gelben zeigt: Die Vorfahrtstraße knickt nach links ab. Du folgst ihr und hast Vorfahrt. Das grüne Auto muss warten.",
  },
  {
    id: "bend-side", rule: "abknickend", title: "Du kommst von der Seite",
    layout: bend(["W", "N"]),
    participants: [you(), car("car", "W", "left", BLUE)],
    answer: [["car"], ["you"]],
    explain: "Du hast das Dreieck „Vorfahrt gewähren“. Die Vorfahrtstraße kommt von links und knickt nach oben ab. Das blaue Auto folgt ihr und blinkt – es darf zuerst fahren.",
  },
  {
    id: "bend-walk", rule: "abknickend", title: "Abknicken und Fußgänger",
    layout: bend(["S", "W"]),
    participants: [you("left"), walker("kid", "W", -1)],
    answer: [["kid"], ["you"]],
    explain: "Du folgst der Vorfahrtstraße nach links. Trotzdem nimmst du besondere Rücksicht auf Fußgänger. Das Mädchen geht über die Straße – du wartest.",
  },
  {
    id: "bend-signal", rule: "abknickend", title: "Zeichen beim Abknicken", view: "ego",
    layout: bend(["S", "W"]),
    participants: [you("left")],
    choice: {
      question: "Du folgst der Vorfahrtstraße nach links. Musst du ein Zeichen geben?",
      options: ["Ja, ich strecke den linken Arm aus.", "Nein, ich habe ja Vorfahrt."],
      correct: 0,
    },
    explain: "Wer der abknickenden Vorfahrtstraße folgt, muss das deutlich anzeigen. Mit dem Rad streckst du den linken Arm aus.",
  },
];

const L8: Scenario[] = [
  {
    id: "round-1", rule: "kreisverkehr", title: "Kreisverkehr",
    layout: roundabout,
    participants: [you("right"), car("car", "W", "straight", BLUE, { inRing: true })],
    answer: [["car"], ["you"]],
    explain: "Wer schon im Kreisverkehr fährt, hat Vorfahrt. Das zeigen die beiden Schilder an der Einfahrt. Du wartest, bis das blaue Auto vorbei ist.",
  },
  {
    id: "round-in", rule: "kreisverkehr", title: "Du bist schon im Kreisel",
    layout: roundabout,
    participants: [you("straight", { arm: "W", inRing: true }), car("car", "S", "right", RED)],
    answer: [["you"], ["car"]],
    explain: "Diesmal fährst du schon im Kreisverkehr. Das rote Auto an der Einfahrt muss dich vorbeilassen.",
  },
  {
    id: "round-enter", rule: "kreisverkehr", title: "Hinein in den Kreisel",
    layout: roundabout,
    participants: [you("straight")],
    choice: {
      question: "Du fährst gleich in den Kreisverkehr hinein. Gibst du ein Zeichen?",
      options: ["Nein, beim Hineinfahren nicht.", "Ja, den linken Arm.", "Ja, den rechten Arm."],
      correct: 0,
    },
    explain: "Beim Hineinfahren in den Kreisverkehr gibst du kein Zeichen. Erst beim Hinausfahren zeigst du mit dem rechten Arm.",
  },
  {
    id: "round-out", rule: "kreisverkehr", title: "Raus aus dem Kreisel",
    layout: roundabout,
    participants: [you("straight")],
    choice: {
      question: "Du willst den Kreisverkehr gleich wieder verlassen. Was machst du?",
      options: ["Rechten Arm ausstrecken", "Linken Arm ausstrecken", "Gar nichts"],
      correct: 0,
    },
    explain: "Beim Hinausfahren zeigst du mit dem rechten Arm an, dass du abbiegst.",
  },
];

// Final test: no route arrows — kids read the situation, blinkers and signs themselves.
const L9: Scenario[] = [
  {
    id: "exam-bus", rule: "rechts-vor-links", title: "Prüfung: Bus von rechts", hideRoutes: true,
    layout: cross(),
    participants: [you(), { id: "bus", kind: "bus", arm: "E", move: "straight" }],
    answer: [["bus"], ["you"]],
    explain: "Keine Schilder, keine Ampel: Rechts vor links. Der Bus kommt von rechts und fährt zuerst.",
  },
  {
    id: "exam-turn", rule: "gegenverkehr", title: "Prüfung: Links auf der Vorfahrtstraße", hideRoutes: true,
    layout: signed(["306"], ["205"]),
    participants: [you("left"), car("car", "N", "straight", GREEN)],
    answer: [["car"], ["you"]],
    explain: "Ihr seid beide auf der Vorfahrtstraße. Du biegst links ab und musst den Gegenverkehr durchlassen.",
  },
  {
    id: "exam-tee", rule: "rechts-vor-links", title: "Prüfung: T-Kreuzung", hideRoutes: true,
    layout: tee(),
    participants: [you("left"), car("car", "E", "straight", PURPLE)],
    answer: [["car"], ["you"]],
    explain: "Das lila Auto kommt von deiner rechten Seite. Rechts vor links – es fährt zuerst.",
  },
  {
    id: "exam-light", rule: "ampel", title: "Prüfung: Ampel", hideRoutes: true,
    layout: lights("red", "green"),
    participants: [you(), car("car", "W", "straight", BLUE)],
    answer: [["car"], ["you"]],
    explain: "Deine Ampel ist rot. Das blaue Auto hat Grün – auch wenn es von links kommt. Die Ampel geht vor.",
  },
  {
    id: "exam-round", rule: "kreisverkehr", title: "Prüfung: Kreisverkehr", hideRoutes: true,
    layout: roundabout,
    participants: [you("right"), car("car", "W", "straight", TEAL, { inRing: true })],
    answer: [["car"], ["you"]],
    explain: "Das Auto fährt schon im Kreisverkehr und hat Vorfahrt. Du wartest an der Einfahrt.",
  },
];

export const levels: Level[] = [
  { id: "rvl", title: "Rechts vor links", icon: "➡️", scenarios: L1 },
  { id: "turn", title: "Abbiegen", icon: "↩️", scenarios: L2 },
  { id: "signs", title: "Vorfahrtsschilder", icon: "🔶", scenarios: L3 },
  { id: "light", title: "Ampel", icon: "🚦", scenarios: L4 },
  { id: "zebra", title: "Zebrastreifen", icon: "🦓", scenarios: L5 },
  { id: "oneway", title: "Einbahnstraße", icon: "⛔", scenarios: L6 },
  { id: "bend", title: "Abknickende Vorfahrt", icon: "↰", scenarios: L7 },
  { id: "round", title: "Kreisverkehr", icon: "🔄", scenarios: L8 },
  { id: "exam", title: "Abschlussprüfung", icon: "🏆", scenarios: L9 },
];

export const scenarios: Scenario[] = levels.flatMap((l) => l.scenarios);
