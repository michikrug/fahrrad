import type { Groups } from "./check";

/** Arms of the junction, clockwise. Screen-wise N is away from the default camera. */
export type Arm = "N" | "E" | "S" | "W";
export type Move = "straight" | "left" | "right";
export type Kind = "car" | "bus" | "bike" | "player" | "pedestrian";

/** StVO sign numbers we can draw. "1002" = Zusatzzeichen for the bending priority road (drawn from Layout.priority). */
export type SignId =
  | "102" | "205" | "206" | "215" | "220" | "267" | "301" | "306" | "350" | "720" | "721" | "1002" | "1022-10";

export type Phase = "red" | "redyellow" | "yellow" | "green";

export interface Participant {
  id: string;
  kind: Kind;
  arm: Arm; // vehicles: where they come from; pedestrians: which arm they cross
  move?: Move; // default straight
  /** Pedestrians: start on the right (1) or left (-1) sidewalk, looking out along the arm from the junction. */
  side?: 1 | -1;
  /** Roundabout: already driving on the ring, just past the entry of `arm`. */
  inRing?: boolean;
  color?: number;
}

export interface ArmSpec {
  /** Signs for traffic arriving on this arm, top to bottom. */
  signs?: SignId[];
  /** Signs at the arm mouth for traffic turning into it, e.g. 267 + 1022-10. "220" is mounted parallel to the road. */
  exitSigns?: SignId[];
  zebra?: boolean;
  light?: { car: Phase; ped?: "red" | "green"; bike?: Phase; arrow?: "720" | "721" };
  oneway?: boolean; // no centre line
}

export interface Layout {
  roundabout?: boolean;
  arms: Partial<Record<Arm, ArmSpec>>;
  /** Bending priority road ("abknickende Vorfahrt"): the two arms it connects. Drawn on Zusatzzeichen 1002. */
  priority?: [Arm, Arm];
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
