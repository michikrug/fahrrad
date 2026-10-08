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

/** Progress bar; `color` defaults to the level colour (--lc). */
function progressBar(parent: HTMLElement, share: number, color?: string) {
  const b = el("span", "bar-track", parent);
  const fill = el("span", "bar-fill", b);
  fill.style.width = `${Math.round(share * 100)}%`;
  if (color) fill.style.background = color;
}

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
  done: boolean; // enough solved to open the next level
  next: boolean; // the level to play now
  hint?: string; // what is missing, on the first locked level only
}

// One colour per level for its icon tile and progress bar, in map order.
const LEVEL_COLORS = ["#2f6fd6", "#ff7a00", "#e23d6e", "#2fa84f", "#555e6b", "#1f8fb3", "#7a4fc4", "#d9534f", "#e0a800"];

/** Emoji-only read-aloud button; speak() itself stops whatever was being read. */
function speakBtn(parent: HTMLElement, text: () => string) {
  const b = el("button", "speak", parent, "🔊");
  b.setAttribute("aria-label", "Vorlesen");
  b.addEventListener("click", () => speak(text(), () => {}));
  return b;
}

const sourceLink = (parent: HTMLElement, card: RuleCard, prefix = "") => {
  const a = el("a", "source", parent, `${prefix}${card.source} ↗`);
  a.href = card.url;
  a.target = "_blank";
  a.rel = "noopener";
};

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
  function openModal(build: (into: HTMLElement) => void, close = { icon: "✓", text: "Schließen", then: () => {}, primary: true }) {
    sheet.replaceChildren();
    build(sheet);
    afterClose = close.then;
    const btn = el("button", close.primary ? "btn primary close" : "btn close", sheet);
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
      sound: boolean;
      setSound: (on: boolean) => void;
      close?: () => void;
    }) {
      map.replaceChildren();
      const head = el("div", "map-head", map);
      const top = el("div", "map-title", head);
      el("h1", "", top, "🚲 Fahrrad-Führerschein");
      const cheat = el("button", "cheat", top);
      el("span", "cheat-ico", cheat, "📖");
      el("span", "", cheat, "Spickzettel");
      cheat.addEventListener("click", o.openSheet);
      const solved = levels.reduce((n, l) => n + l.solved, 0), total = levels.reduce((n, l) => n + l.n, 0);
      progressBar(head, solved / total, "#2fa84f");
      el("div", "map-total", head, `${solved} von ${total} Aufgaben geschafft`);

      const list = el("div", "levels", map);
      levels.forEach((l, i) => {
        const b = el("button", `level${l.locked ? " locked" : ""}${l.next ? " next" : ""}`, list);
        b.style.setProperty("--lc", LEVEL_COLORS[i % LEVEL_COLORS.length]);
        el("span", "level-icon", b, l.locked ? "🔒" : l.icon);
        const info = el("span", "level-info", b);
        el("strong", "", info, `${i + 1}. ${l.title}`);
        if (!l.locked) {
          const sub = el("span", "level-sub", info);
          el("span", "level-stars", sub, `${"★".repeat(l.stars)}${"☆".repeat(l.n - l.stars)}`);
          progressBar(sub, l.solved / l.n);
          el("span", "", sub, `${l.solved}/${l.n}`);
        } else if (l.hint) el("span", "level-hint", info, l.hint);
        if (l.done) el("span", "level-badge done", b, "✓");
        else if (l.next) el("span", "level-badge", b, "Los ▸");
        if (!l.locked) b.addEventListener("click", () => o.pick(i));
      });

      const settings = el("div", "settings", map);
      el("h3", "", settings, "Einstellungen");
      const option = (text: string, on: boolean, set: (on: boolean) => void) => {
        const label = el("label", "option", settings);
        el("span", "", label, text);
        // A real checkbox, styled as a switch: keyboard, screen readers and labels keep working.
        const box = el("input", "switch", label);
        box.type = "checkbox";
        box.setAttribute("role", "switch");
        box.checked = on;
        box.addEventListener("change", () => set(box.checked));
      };
      option("🔓 Alle Level frei wählen", o.free, o.setFree);
      option("🔈 Geräusche", o.sound, o.setSound);
      if (o.close) {
        const back = el("button", "btn primary map-close", map);
        setLabel(back, "←", "Zurück zur Aufgabe");
        back.addEventListener("click", o.close);
      }
      map.classList.remove("hidden");
    },
    hideMap: () => map.classList.add("hidden"),
    /** Close any sheet without its follow-up action — the URL decides what shows next. */
    hideModal() {
      afterClose = () => {};
      if (!modal.classList.contains("hidden")) closeModal();
    },

    showCard(card: RuleCard, signs: HTMLCanvasElement[]) {
      openModal((s) => {
        el("h2", "", s, card.title);
        if (signs.length) {
          const row = el("div", "card-signs", s);
          for (const c of signs) row.appendChild(c);
        }
        el("p", "", s, card.text);
        sourceLink(s, card, "Quelle: ");
        readToggle(el("button", "btn small", s), () => `${card.title}. ${card.text}`);
      });
    },

    /** Spickzettel: all rules (with source) first, then every sign. Header with ✕ and jump tabs stays on top. */
    showSheet(cards: { card: RuleCard; signs: HTMLCanvasElement[] }[], entries: SheetEntry[]) {
      openModal((s) => {
        const head = el("div", "sheet-head", s);
        const row = el("div", "sheet-title", head);
        el("h2", "", row, "📖 Spickzettel");
        const x = el("button", "sheet-x", row, "✕");
        x.setAttribute("aria-label", "Schließen");
        x.addEventListener("click", closeModal);
        const tabs = el("div", "tabs", head);

        const section = (title: string) => {
          const h = el("h3", "", s, title);
          el("button", "tab", tabs, title).addEventListener("click", () => h.scrollIntoView({ behavior: "smooth" }));
        };
        section("Regeln");
        for (const { card, signs } of cards) {
          const box = el("div", "sheet-rule", s);
          const top = el("div", "sheet-rule-top", box);
          el("strong", "", top, card.title);
          for (const c of signs) top.appendChild(c);
          speakBtn(top, () => `${card.title}. ${card.text}`);
          el("p", "", box, card.text);
          sourceLink(box, card);
        }
        section("Verkehrszeichen");
        for (const e of entries) {
          const row = el("div", "sheet-row", s);
          el("div", "sign-box", row).appendChild(e.canvas);
          const t = el("div", "sign-text", row);
          el("strong", "", t, e.name);
          el("p", "", t, e.text);
          speakBtn(row, () => `${e.name}. ${e.text}`);
        }
      });
    },

    /**
     * End of a level. `missing` = tasks still needed for the unlock share (0 = level done).
     * `next` (the next level's name) is set when that level is playable; it then gets the main button.
     */
    showLevelDone(
      o: { title: string; stars: number; n: number; missing: number; next?: string; last: boolean },
      go: { map: () => void; next: () => void },
    ) {
      openModal((s) => {
        const done = o.missing === 0;
        el("h2", "level-done", s, done ? "🎉 Level geschafft!" : "Fast geschafft!");
        el("div", "stars-big", s, `${"★".repeat(o.stars)}${"☆".repeat(o.n - o.stars)}`);
        el("p", "", s, `„${o.title}“: ${o.stars} von ${o.n} Aufgaben ohne Fehler gelöst.`);
        if (!done) el("p", "", s, `Löse noch ${o.missing} ${o.missing === 1 ? "Aufgabe" : "Aufgaben"}, dann ist das Level geschafft.`);
        else if (o.last) el("p", "", s, "Du hast die Abschlussprüfung geschafft! 🏆");
        if (o.next) {
          const b = el("button", "btn primary close", s);
          setLabel(b, "➜", `Weiter: ${o.next}`);
          b.addEventListener("click", () => ((afterClose = go.next), closeModal()));
        }
      }, { icon: "☰", text: "Zur Übersicht", then: go.map, primary: !o.next });
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
