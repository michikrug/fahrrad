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
];
