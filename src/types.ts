import type { Groups } from "./check";

/** Arms of the junction, clockwise. Screen-wise N is away from the default camera. */
export type Arm = "N" | "E" | "S" | "W";
export type Move = "straight" | "left" | "right";
export type Kind = "car" | "bus" | "bike" | "player";

export interface Participant {
  id: string;
  kind: Kind;
  arm: Arm; // where it comes from
  move: Move;
  color?: number;
}

// Grows in P3 (signs, lights, zebra, one-way).
export interface ArmSpec {}

export interface Layout {
  arms: Partial<Record<Arm, ArmSpec>>;
}

export interface Scenario {
  id: string;
  title: string;
  layout: Layout;
  participants: Participant[];
  answer: Groups;
  /** Shown after answering — kid-friendly German. */
  explain: string;
}
