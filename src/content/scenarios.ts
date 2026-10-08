import type { Scenario } from "../types";

const cross = { arms: { N: {}, E: {}, S: {}, W: {} } };

// Answers are written by hand like a teacher would. tests/content.test.ts checks consistency.
export const scenarios: Scenario[] = [
  {
    id: "rvl-1",
    title: "Rechts vor links",
    layout: cross,
    participants: [
      { id: "you", kind: "player", arm: "S", move: "straight" },
      { id: "car", kind: "car", arm: "E", move: "straight", color: 0xd63a3a },
    ],
    answer: [["car"], ["you"]],
    explain:
      "Hier gibt es keine Schilder und keine Ampel. Dann gilt: Rechts vor links. Das rote Auto kommt von deiner rechten Seite. Es darf zuerst fahren.",
  },
  {
    id: "rvl-2",
    title: "Rechts vor links mit drei",
    layout: cross,
    participants: [
      { id: "you", kind: "player", arm: "S", move: "straight" },
      { id: "red", kind: "car", arm: "E", move: "straight", color: 0xd63a3a },
      { id: "blue", kind: "car", arm: "W", move: "straight", color: 0x2f6fd6 },
    ],
    answer: [["red"], ["you"], ["blue"]],
    explain:
      "Das rote Auto hat niemanden rechts von sich, also fährt es zuerst. Danach bist du dran, denn das blaue Auto kommt von links und muss auf dich warten.",
  },
  {
    id: "rvl-3",
    title: "Links abbiegen",
    layout: cross,
    participants: [
      { id: "you", kind: "player", arm: "S", move: "left" },
      { id: "car", kind: "car", arm: "N", move: "straight", color: 0x2f9e5a },
    ],
    answer: [["car"], ["you"]],
    explain:
      "Du willst links abbiegen. Wer links abbiegt, muss den Gegenverkehr durchlassen. Das grüne Auto fährt geradeaus, also darf es zuerst fahren.",
  },
  // --- P3 demo scenarios: one per junction type. Content gets reviewed against StVO sources in P5. ---
  {
    id: "t-1",
    title: "T-Kreuzung",
    layout: { arms: { E: {}, S: {}, W: {} } },
    participants: [
      { id: "you", kind: "player", arm: "W", move: "straight" },
      { id: "car", kind: "car", arm: "S", move: "left", color: 0x8e44ad },
    ],
    answer: [["car"], ["you"]],
    explain:
      "Auch an einer T-Kreuzung gilt ohne Schilder: Rechts vor links. Das lila Auto kommt von deiner rechten Seite, also darf es zuerst fahren.",
  },
  {
    id: "sign-1",
    title: "Vorfahrtstraße",
    layout: {
      arms: {
        N: { signs: ["306"] },
        S: { signs: ["306"] },
        E: { signs: ["205"] },
        W: { signs: ["205"], oneway: true, exitSigns: ["267", "1022-10"] },
      },
    },
    participants: [
      { id: "you", kind: "player", arm: "S", move: "straight" },
      { id: "car", kind: "car", arm: "E", move: "straight", color: 0xd63a3a },
    ],
    answer: [["you"], ["car"]],
    explain:
      "Du fährst auf der Vorfahrtstraße. Das siehst du am gelben Schild. Das rote Auto hat das Dreieck-Schild „Vorfahrt gewähren“. Es muss warten, auch wenn es von rechts kommt.",
  },
  {
    id: "sign-2",
    title: "Stoppschild",
    layout: {
      arms: { N: { signs: ["301"] }, S: { signs: ["206"] }, E: { signs: ["301"] }, W: { signs: ["206"] } },
    },
    participants: [
      { id: "you", kind: "player", arm: "S", move: "straight" },
      { id: "car", kind: "car", arm: "E", move: "straight", color: 0x2f6fd6 },
    ],
    answer: [["car"], ["you"]],
    explain:
      "Vor dir steht ein Stoppschild. Du musst an der Linie ganz anhalten und alle anderen vorlassen. Erst dann darfst du fahren.",
  },
  {
    id: "bend-1",
    title: "Abknickende Vorfahrt",
    layout: {
      priority: ["S", "W"],
      arms: {
        S: { signs: ["306", "1002"] },
        W: { signs: ["306", "1002"] },
        N: { signs: ["205", "1002"] },
        E: { signs: ["205", "1002"] },
      },
    },
    participants: [
      { id: "you", kind: "player", arm: "S", move: "left" },
      { id: "car", kind: "car", arm: "E", move: "straight", color: 0x2f9e5a },
    ],
    answer: [["you"], ["car"]],
    explain:
      "Das kleine Schild unter dem gelben zeigt: Die Vorfahrtstraße knickt nach links ab. Du folgst ihr und hast Vorfahrt. Das grüne Auto muss warten.",
  },
  {
    id: "zebra-1",
    title: "Zebrastreifen",
    layout: { arms: { N: { zebra: true, signs: ["306"] }, S: { signs: ["306"] }, E: { signs: ["205"] }, W: { signs: ["205"] } } },
    participants: [
      { id: "you", kind: "player", arm: "S", move: "straight" },
      { id: "kid", kind: "pedestrian", arm: "N", side: 1 },
    ],
    answer: [["kid"], ["you"]],
    explain:
      "Am Zebrastreifen dürfen Fußgänger zuerst gehen. Du wartest, bis das Mädchen auf der anderen Seite ist.",
  },
  {
    id: "light-1",
    title: "Ampel",
    layout: {
      arms: {
        N: { light: { car: "green", ped: "red" } },
        S: { light: { car: "green", ped: "red", bike: "green" } },
        E: { light: { car: "red", ped: "green", arrow: "720" } },
        W: { light: { car: "red", ped: "green" } },
      },
    },
    participants: [
      { id: "you", kind: "player", arm: "S", move: "straight" },
      { id: "car", kind: "car", arm: "E", move: "straight", color: 0xd63a3a },
    ],
    answer: [["you"], ["car"]],
    explain: "Deine Ampel ist grün, die vom roten Auto ist rot. Grün heißt: Du darfst fahren. Rot heißt: Stehen bleiben!",
  },
  {
    id: "round-1",
    title: "Kreisverkehr",
    layout: {
      roundabout: true,
      arms: Object.fromEntries((["N", "E", "S", "W"] as const).map((a) => [a, { signs: ["215", "205"] }])),
    },
    participants: [
      { id: "you", kind: "player", arm: "S", move: "right" },
      { id: "car", kind: "car", arm: "W", move: "straight", inRing: true, color: 0xf39c12 },
    ],
    answer: [["car"], ["you"]],
    explain:
      "Wer schon im Kreisverkehr fährt, hat Vorfahrt. Das zeigen die beiden Schilder an der Einfahrt. Du wartest, bis das orange Auto vorbei ist.",
  },
];
