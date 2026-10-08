import { speak, stopSpeaking } from "./audio";
import type { RuleCard } from "./types";

// Plain DOM overlay, smartphone portrait first: everything you tap lives in a dock at the
// bottom (thumb reach), stacked so panels never overlap. Short sentences — readers are 8–10.

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text = "") => {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  parent.appendChild(e);
  return e;
};

/**
 * Button content as separate icon + text spans, so flexbox can centre the emoji vertically —
 * emoji glyphs sit on the text baseline with different metrics and look misaligned otherwise.
 */
function setLabel(b: HTMLElement, icon: string, text: string, iconAfter = false) {
  const ico = document.createElement("span");
  ico.className = "ico";
  ico.textContent = icon;
  const txt = document.createElement("span");
  txt.textContent = text;
  b.replaceChildren(...(iconAfter ? [txt, ico] : [ico, txt]));
}

/**
 * Turns a button into a Vorlesen/Stopp toggle. Both labels share one fixed-size button so it
 * doesn't jump when switching. Returns a reset for when the text goes away.
 */
function readToggle(b: HTMLElement, text: () => string) {
  let reading = false;
  const label = (on: boolean) => ((reading = on), on ? setLabel(b, "⏹", "Stopp") : setLabel(b, "🔊", "Vorlesen"));
  label(false);
  b.addEventListener("click", () => {
    if (reading) {
      stopSpeaking();
      return label(false);
    }
    label(true);
    speak(text(), () => label(false));
  });
  return () => label(false);
}

export interface Chip {
  id: string;
  label: string;
  color: string; // CSS colour of the participant, so kids match chip and vehicle
}

export interface MapLevel {
  title: string;
  icon: string;
  solved: number;
  stars: number;
  n: number;
  locked: boolean;
}

export interface SheetEntry {
  canvas: HTMLCanvasElement;
  name: string;
  text: string;
}

export function createUI(root: HTMLElement) {
  const top = el("div", "top", root);
  const menu = el("button", "menu-btn", top, "☰");
  const title = el("h1", "title", top);
  const task = el("p", "task", top);
  // Skip back and forth inside a level — kids want to retry one or peek at the next.
  const steps = el("div", "steps", top);
  const prev = el("button", "step-btn", steps, "‹");
  const count = el("span", "", steps);
  const fwd = el("button", "step-btn", steps, "›");
  prev.ariaLabel = "Vorherige Aufgabe";
  fwd.ariaLabel = "Nächste Aufgabe";

  const banner = el("div", "banner hidden", root, "Achtung!");
  const hint = el("div", "hint hidden", root, "👀 Wische zur Seite, um dich umzuschauen");

  const dock = el("div", "dock", root);
  const result = el("div", "result hidden", dock);
  const resultHead = el("h2", "", result);
  const resultText = el("p", "", result);
  const resultBtns = el("div", "row", result);
  const read = el("button", "btn small", resultBtns);
  const ruleBtn = el("button", "btn small", resultBtns);
  const cards = el("div", "cards hidden", dock);
  const chips = el("div", "chips hidden", dock);
  const bar = el("div", "bar", dock);
  const reset = el("button", "btn", bar);
  const view = el("button", "btn", bar);
  const next = el("button", "btn primary", bar);
  setLabel(reset, "↺", "Nochmal");
  setLabel(next, "➜", "Weiter", true);

  const resetRead = readToggle(read, () => `${resultHead.textContent} ${resultText.textContent}`);

  const chipEls = new Map<string, HTMLButtonElement>();

  // Full-screen panels on top of the scene: level map, rule card, cheat sheet.
  const map = el("div", "screen hidden", root);
  const modal = el("div", "modal hidden", root);
  const sheet = el("div", "sheet", modal);
  modal.addEventListener("click", (e) => e.target === modal && closeModal());
  let afterClose = () => {};
  function closeModal() {
    stopSpeaking();
    modal.classList.add("hidden");
    afterClose();
  }
  function openModal(build: (into: HTMLElement) => void, close = { icon: "✓", text: "Schließen", then: () => {} }) {
    sheet.replaceChildren();
    build(sheet);
    afterClose = close.then;
    const btn = el("button", "btn primary close", sheet);
    setLabel(btn, close.icon, close.text);
    btn.addEventListener("click", closeModal);
    modal.classList.remove("hidden");
    sheet.scrollTop = 0;
  }

  let onRule = () => {};
  ruleBtn.addEventListener("click", () => onRule());

  return {
    onMenu: (f: () => void) => menu.addEventListener("click", f),

    /**
     * Level overview. Locked levels say what is missing instead of just showing a lock.
     * `close` (only when opened from a running task) adds a big "back" button in thumb reach.
     */
    showMap(levels: MapLevel[], o: {
      pick: (i: number) => void;
      openSheet: () => void;
      free: boolean;
      setFree: (on: boolean) => void;
      close?: () => void;
    }) {
      map.replaceChildren();
      const head = el("div", "map-head", map);
      el("h1", "", head, "🚲 Fahrrad-Führerschein");
      const cheat = el("button", "btn", head);
      setLabel(cheat, "📖", "Spickzettel");
      cheat.addEventListener("click", o.openSheet);
      const list = el("div", "levels", map);
      levels.forEach((l, i) => {
        const b = el("button", `level${l.locked ? " locked" : ""}`, list);
        el("span", "level-icon", b, l.locked ? "🔒" : l.icon);
        const info = el("span", "level-info", b);
        el("strong", "", info, `${i + 1}. ${l.title}`);
        el("span", "level-sub", info, l.locked
          ? "Schaffe erst das Level davor."
          : `${"★".repeat(l.stars)}${"☆".repeat(l.n - l.stars)}  ${l.solved}/${l.n} geschafft`);
        if (!l.locked) b.addEventListener("click", () => o.pick(i));
      });
      const free = el("label", "free", map);
      const box = el("input", "", free);
      box.type = "checkbox";
      box.checked = o.free;
      box.addEventListener("change", () => o.setFree(box.checked));
      el("span", "", free, "🔓 Alle Level frei wählen");
      if (o.close) {
        const back = el("button", "btn primary map-close", map);
        setLabel(back, "←", "Zurück zur Aufgabe");
        back.addEventListener("click", o.close);
      }
      map.classList.remove("hidden");
    },
    hideMap: () => map.classList.add("hidden"),

    showCard(card: RuleCard, signs: HTMLCanvasElement[]) {
      openModal((s) => {
        el("h2", "", s, card.title);
        if (signs.length) {
          const row = el("div", "card-signs", s);
          for (const c of signs) row.appendChild(c);
        }
        el("p", "", s, card.text);
        const src = el("a", "source", s, `Quelle: ${card.source}`);
        src.href = card.url;
        src.target = "_blank";
        src.rel = "noopener";
        readToggle(el("button", "btn small", s), () => `${card.title}. ${card.text}`);
      });
    },

    /** Spickzettel: all rules (with source) first, then every sign. */
    showSheet(cards: RuleCard[], entries: SheetEntry[]) {
      openModal((s) => {
        el("h2", "", s, "📖 Spickzettel");
        el("h3", "", s, "Regeln");
        for (const c of cards) {
          const row = el("div", "sheet-rule", s);
          el("strong", "", row, c.title);
          el("p", "", row, c.text);
          const src = el("a", "source", row, `Quelle: ${c.source}`);
          src.href = c.url;
          src.target = "_blank";
          src.rel = "noopener";
        }
        el("h3", "", s, "Verkehrszeichen");
        for (const e of entries) {
          const row = el("div", "sheet-row", s);
          row.appendChild(e.canvas);
          const t = el("div", "", row);
          el("strong", "", t, e.name);
          el("p", "", t, e.text);
        }
      });
    },

    /**
     * End of a level. `next` names the level that is now open; `missing` = tasks still needed
     * for the unlock share (0 = level done). Closing leads to the map.
     */
    showLevelDone(o: { title: string; stars: number; n: number; missing: number; next?: string; last: boolean }, then: () => void) {
      openModal((s) => {
        const done = o.missing === 0;
        el("h2", "level-done", s, done ? "🎉 Level geschafft!" : "Fast geschafft!");
        el("div", "stars-big", s, `${"★".repeat(o.stars)}${"☆".repeat(o.n - o.stars)}`);
        el("p", "", s, `„${o.title}“: ${o.stars} von ${o.n} Aufgaben ohne Fehler gelöst.`);
        if (!done) el("p", "", s, `Löse noch ${o.missing} ${o.missing === 1 ? "Aufgabe" : "Aufgaben"}, dann ist das Level geschafft.`);
        else if (o.last) el("p", "", s, "Du hast die Abschlussprüfung geschafft! 🏆");
        else if (o.next) el("p", "", s, `Als Nächstes: ${o.next}`);
      }, { icon: "➜", text: "Zur Übersicht", then });
    },

    setView(mode: "bird" | "ego") {
      if (mode === "bird") setLabel(view, "🚲", "Vom Rad");
      else setLabel(view, "🦅", "Von oben");
      // Re-insert to restart the fade-out animation each time the ego view opens.
      hint.classList.toggle("hidden", mode !== "ego");
      hint.replaceWith(hint);
    },
    onView: (f: () => void) => view.addEventListener("click", f),

    /** One button per road user — the main way to pick the order, works in every view. */
    showChips(items: Chip[], pick: (id: string) => void) {
      chips.replaceChildren();
      chipEls.clear();
      for (const c of items) {
        const b = el("button", "chip", chips);
        b.style.setProperty("--c", c.color);
        el("span", "num", b);
        el("span", "", b, c.label);
        b.addEventListener("click", () => pick(c.id));
        chipEls.set(c.id, b);
      }
      chips.classList.toggle("hidden", !items.length);
    },
    setChipNumbers(tapped: string[]) {
      for (const [id, b] of chipEls) {
        const n = tapped.indexOf(id);
        b.querySelector(".num")!.textContent = n < 0 ? "" : String(n + 1);
        b.classList.toggle("on", n >= 0);
      }
    },

    /** Big answer cards for "choice" questions. */
    showChoice(options: string[], pick: (i: number) => void) {
      cards.replaceChildren();
      cards.classList.remove("hidden");
      options.forEach((text, i) => el("button", "btn card", cards, text).addEventListener("click", () => {
        cards.classList.add("hidden");
        pick(i);
      }));
    },
    /** `pos` = place in the level, for the ‹ 2 von 5 › stepper. */
    showScenario(t: string, taskText: string, pos: { i: number; n: number }) {
      count.textContent = `Aufgabe ${pos.i + 1} von ${pos.n}`;
      prev.disabled = pos.i === 0;
      fwd.disabled = pos.i === pos.n - 1;
      stopSpeaking();
      resetRead();
      title.textContent = t;
      task.textContent = taskText;
      result.classList.add("hidden");
      cards.classList.add("hidden");
      next.classList.add("hidden");
    },
    /** `rule` adds a button to the result sheet that opens the Lernkarte. */
    showResult(ok: boolean, explain: string, rule?: { title: string; open: () => void }) {
      ruleBtn.classList.toggle("hidden", !rule);
      if (rule) {
        setLabel(ruleBtn, "📖", "Regel");
        onRule = rule.open;
      }
      banner.classList.add("hidden");
      chips.classList.add("hidden"); // the sheet needs the room on a phone
      result.classList.remove("hidden");
      result.classList.toggle("ok", ok);
      resultHead.textContent = ok ? "Klasse gemacht! 🎉" : "Fast! Schau noch mal genau hin.";
      resultText.textContent = explain;
      next.classList.toggle("hidden", !ok);
    },
    hideResult() {
      stopSpeaking();
      resetRead();
      result.classList.add("hidden");
      banner.classList.add("hidden");
      chips.classList.toggle("hidden", !chipEls.size);
    },
    showBanner: () => banner.classList.remove("hidden"),
    onStep(f: (delta: number) => void) {
      prev.addEventListener("click", () => f(-1));
      fwd.addEventListener("click", () => f(1));
    },
    onReset: (f: () => void) => reset.addEventListener("click", f),
    onNext: (f: () => void) => next.addEventListener("click", f),
  };
}
