import type { RuleCard, SignId } from "../types";

// Lernkarten and the sign cheat sheet. Kid-friendly German; every card cites the StVO passage it
// rests on. Checked against gesetze-im-internet.de (StVO 2013) on 2026-10-08.
// Deliberately NOT taught (no primary source found yet): "am Zebrastreifen absteigen und schieben",
// meaning of Rot-Gelb, direct vs. indirect left turn as taught in the Radfahrprüfung.

const STVO = "https://www.gesetze-im-internet.de/stvo_2013/";

export const rules: RuleCard[] = [
  {
    id: "rechts-vor-links",
    title: "Rechts vor links",
    text: "Gibt es keine Schilder und keine Ampel, darf zuerst fahren, wer von rechts kommt. Das gilt auch an T-Kreuzungen. Schau also immer zuerst nach rechts!",
    signs: ["102"],
    source: "§ 8 Abs. 1 StVO",
    url: `${STVO}__8.html`,
  },
  {
    id: "gegenverkehr",
    title: "Abbiegen: Gegenverkehr zuerst",
    text: "Wer abbiegt, muss alle durchlassen, die entgegenkommen – Autos und Fahrräder. Das gilt für Autos genauso wie für dich.",
    source: "§ 9 Abs. 3 StVO",
    url: `${STVO}__9.html`,
  },
  {
    id: "rechtsabbieger",
    title: "Rechts abbiegen: Radfahrer geradeaus zuerst",
    text: "Ein Auto, das rechts abbiegen will, muss Radfahrer durchlassen, die neben ihm geradeaus fahren. Aber Achtung: Schau immer, ob der Fahrer dich wirklich gesehen hat!",
    source: "§ 9 Abs. 3 Satz 1 StVO",
    url: `${STVO}__9.html`,
  },
  {
    id: "fussgaenger-abbiegen",
    title: "Abbiegen: Rücksicht auf Fußgänger",
    text: "Wenn du abbiegst und jemand zu Fuß über die Straße geht, nimmst du besondere Rücksicht. Wenn nötig, wartest du.",
    source: "§ 9 Abs. 3 Satz 3 StVO",
    url: `${STVO}__9.html`,
  },
  {
    id: "vorfahrtstrasse",
    title: "Vorfahrtsschilder",
    text: "Das gelbe Schild heißt: Du bist auf der Vorfahrtstraße. Das Dreieck mit dem dicken Strich heißt: An der nächsten Kreuzung hast du Vorfahrt. Wer das rote Dreieck mit der Spitze nach unten sieht, muss warten – auch wenn er von rechts kommt.",
    signs: ["306", "301", "205"],
    source: "§ 8 Abs. 1 StVO, Anlage 2 und 3",
    url: `${STVO}anlage_3.html`,
  },
  {
    id: "stopp",
    title: "Stoppschild",
    text: "Am Stoppschild musst du an der weißen Linie ganz anhalten – auch wenn niemand kommt. Dann lässt du alle anderen vorbei.",
    signs: ["206"],
    source: "Anlage 2 Zeichen 206 StVO",
    url: `${STVO}anlage_2.html`,
  },
  {
    id: "abknickend",
    title: "Abknickende Vorfahrt",
    text: "Das kleine Schild unter dem gelben Schild zeigt mit dem dicken Strich, wohin die Vorfahrtstraße abbiegt. Wer dem dicken Strich folgt, hat Vorfahrt – muss das Abbiegen aber deutlich anzeigen. Auf Fußgänger nimmst du dabei besonders Rücksicht.",
    signs: ["306", "1002"],
    source: "Anlage 3 Zeichen 306 mit Zusatzzeichen StVO",
    url: `${STVO}anlage_3.html`,
  },
  {
    id: "zebrastreifen",
    title: "Zebrastreifen",
    text: "Will jemand zu Fuß über den Zebrastreifen gehen, müssen Fahrzeuge ihn hinüberlassen. Du fährst langsam heran und hältst an, wenn nötig.",
    signs: ["350"],
    source: "§ 26 Abs. 1 StVO",
    url: `${STVO}__26.html`,
  },
  {
    id: "ampel",
    title: "Ampel",
    text: "Grün heißt: Du darfst fahren. Gelb heißt: Vor der Kreuzung warten. Rot heißt: Halt vor der Kreuzung! Als Radfahrer achtest du auf die Ampel für die Fahrzeuge. Fährst du auf einem Radweg mit eigener Fahrrad-Ampel, gilt die Fahrrad-Ampel.",
    source: "§ 37 Abs. 2 Nr. 1 und 6 StVO",
    url: `${STVO}__37.html`,
  },
  {
    id: "gruenpfeil",
    title: "Grünpfeil",
    text: "Hängt neben dem roten Licht ein grüner Pfeil auf schwarzem Schild, darfst du bei Rot rechts abbiegen – aber erst, nachdem du angehalten hast. Ist ein Fahrrad auf dem Schild, gilt es nur für Radfahrer.",
    signs: ["720", "721"],
    source: "§ 37 Abs. 2 Nr. 1 StVO",
    url: `${STVO}__37.html`,
  },
  {
    id: "einbahn",
    title: "Einbahnstraße",
    text: "In eine Einbahnstraße darfst du nur in Pfeilrichtung fahren. Am anderen Ende steht das rote Schild mit dem weißen Balken: Hier darf niemand hinein. Steht darunter „Radverkehr frei“, dürfen Radfahrer trotzdem hineinfahren.",
    signs: ["220", "267", "1022-10"],
    source: "Anlage 2 Zeichen 220 und 267 StVO",
    url: `${STVO}anlage_2.html`,
  },
  {
    id: "einbahn-ausfahrt",
    title: "Aus der Einbahnstraße heraus",
    text: "Zeigt ein kleines Schild unter dem Einbahnstraßen-Schild ein Fahrrad mit zwei Pfeilen, dürfen Radfahrer auch entgegen der Pfeilrichtung fahren. Wer so aus der Einbahnstraße kommt, hat Vorfahrt, wenn er von rechts kommt. Rechts vor links gilt weiter.",
    signs: ["220", "1000-32"],
    source: "Anlage 2 Zeichen 220 StVO",
    url: `${STVO}anlage_2.html`,
  },
  {
    id: "kreisverkehr",
    title: "Kreisverkehr",
    text: "Wer schon im Kreisverkehr fährt, hat Vorfahrt. Beim Hineinfahren gibst du kein Zeichen. Beim Hinausfahren zeigst du mit dem rechten Arm, dass du abbiegst.",
    signs: ["215", "205"],
    source: "§ 8 Abs. 1a und § 9 Abs. 1 StVO",
    url: `${STVO}__8.html`,
  },
  {
    id: "zeichen-geben",
    title: "Zeichen geben",
    text: "Bevor du abbiegst, schaust du über die Schulter nach hinten und streckst den Arm in die Richtung, in die du willst. Autos blinken. Willst du links abbiegen, fährst du dann rechtzeitig bis zur Straßenmitte („einordnen“). Kurz vor dem Abbiegen schaust du noch einmal nach hinten.",
    source: "§ 9 Abs. 1 StVO",
    url: `${STVO}__9.html`,
  },
  {
    id: "gehweg",
    title: "Gehweg oder Straße?",
    text: "Bis du 8 Jahre alt bist, musst du mit dem Rad auf dem Gehweg fahren. Bis 10 Jahre darfst du es noch. Danach fährst du auf der Straße oder dem Radweg.",
    source: "§ 2 Abs. 5 StVO",
    url: `${STVO}__2.html`,
  },
];

/** Spickzettel: every sign the app can draw, with a one-line kid explanation. */
export const signInfo: Record<SignId, { name: string; text: string }> = {
  // ponytail: the X pictogram of 102 is drawn from memory — the legal text gives only the name.
  "102": { name: "Kreuzung oder Einmündung mit Vorfahrt von rechts", text: "Gleich kommt eine Kreuzung. Hier gilt: Rechts vor links." },
  "205": { name: "Vorfahrt gewähren", text: "Du musst die anderen auf der Querstraße vorlassen." },
  "206": { name: "Halt. Vorfahrt gewähren", text: "Ganz anhalten und alle vorlassen." },
  "215": { name: "Kreisverkehr", text: "Hier kommt ein Kreisverkehr." },
  "220": { name: "Einbahnstraße", text: "Hier darf man nur in Pfeilrichtung fahren." },
  "267": { name: "Verbot der Einfahrt", text: "Hier darfst du nicht hineinfahren." },
  "301": { name: "Vorfahrt", text: "An der nächsten Kreuzung hast du Vorfahrt." },
  "306": { name: "Vorfahrtstraße", text: "Du fährst auf der Vorfahrtstraße und hast an den Kreuzungen Vorfahrt." },
  "350": { name: "Fußgängerüberweg", text: "Hier ist ein Zebrastreifen. Wer zu Fuß hinüber will, darf zuerst." },
  "720": { name: "Grünpfeil", text: "Bei Rot nach dem Anhalten vorsichtig rechts abbiegen erlaubt." },
  "721": { name: "Grünpfeil nur für Radverkehr", text: "Wie der Grünpfeil – aber nur für Radfahrer." },
  "1002": { name: "Verlauf der Vorfahrtstraße", text: "Der dicke Strich zeigt, wohin die Vorfahrtstraße geht." },
  "1000-32": { name: "Radverkehr in der Gegenrichtung", text: "Unter dem Einbahnstraßen-Schild: Radfahrer dürfen in beide Richtungen fahren." },
  "1022-10": { name: "Radverkehr frei", text: "Das Verbot auf dem Schild darüber gilt nicht für Radfahrer." },
};
