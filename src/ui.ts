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
function readToggle(b: HTMLElement, text: () => string, iconOnly = false) {
  let reading = false;
  const label = (on: boolean) => {
    reading = on;
    if (iconOnly) {
      b.textContent = on ? "⏹" : "🔊";
      b.ariaLabel = on ? "Stopp" : "Vorlesen";
    } else if (on) setLabel(b, "⏹", "Stopp");
    else setLabel(b, "🔊", "Vorlesen");
  };
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

/** Round ▶ read-aloud button, no stop state; speak() itself stops whatever was being read. */
function speakBtn(parent: HTMLElement, text: () => string) {
  const b = el("button", "speak", parent, "▶");
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
export interface SheetData {
  rules: { card: RuleCard; signs: HTMLCanvasElement[] }[];
  signs: SheetEntry[];
}

/** A real checkbox styled as a switch: keyboard, screen readers and the label keep working. */
function switchRow(parent: HTMLElement, title: string, sub: string, on: boolean, set: (on: boolean) => void) {
  const label = el("label", "set-row", parent);
  const t = el("span", "set-text", label);
  el("strong", "", t, title);
  el("span", "", t, sub);
  const box = el("input", "switch", label);
  box.type = "checkbox";
  box.setAttribute("role", "switch");
  box.checked = on;
  box.addEventListener("change", () => set(box.checked));
}

export function createUI(root: HTMLElement) {
  // Top: round back button and a pill with ‹ AUFGABE 2 VON 5 / title ›. Small, so the scene stays free.
  const top = el("div", "hud-top", root);
  // Burger as SVG: the ☰ glyph sits off-centre (font baseline and side bearings differ per platform).
  const menu = el("button", "round-btn", top);
  menu.innerHTML = '<svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M2 2h18M2 9h18M2 16h18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  menu.ariaLabel = "Menü";
  const pill = el("div", "task-pill", top);
  // Skip back and forth inside a level — kids want to retry one or peek at the next.
  const prev = el("button", "step-btn", pill, "‹");
  const mid = el("div", "pill-mid", pill);
  const count = el("span", "pill-count", mid);
  const title = el("strong", "pill-title", mid);
  const fwd = el("button", "step-btn", pill, "›");
  prev.ariaLabel = "Vorherige Aufgabe";
  fwd.ariaLabel = "Nächste Aufgabe";

  const banner = el("div", "banner hidden", root, "Achtung!");
  const hint = el("div", "hint hidden", root, "👀 Wische zur Seite, um dich umzuschauen");

  // Bottom, in thumb reach: chips or answer cards over a sheet with the question; after answering,
  // the feedback sheet takes its place.
  const dock = el("div", "dock", root);
  const result = el("div", "fb-sheet hidden", dock);
  const badge = el("div", "fb-badge", result);
  const resultHead = el("h2", "", result);
  const resultText = el("p", "", result);
  const resultBtns = el("div", "fb-pills", result);
  const read = el("button", "pill-btn", resultBtns);
  const ruleBtn = el("button", "pill-btn", resultBtns);
  const fbActions = el("div", "fb-actions", result);
  const again = el("button", "", fbActions);
  again.ariaLabel = "Nochmal";
  const next = el("button", "btn3d green grow", fbActions, "Weiter");
  const cards = el("div", "cards hidden", dock);
  const chips = el("div", "chips hidden", dock);
  const taskSheet = el("div", "task-sheet", dock);
  const taskRow = el("div", "task-row", taskSheet);
  const task = el("p", "task-q", taskRow);
  const taskRead = el("button", "read-round", taskRow);
  const bar = el("div", "bar", taskSheet);
  const reset = el("button", "soft-btn", bar);
  // View switch as a two-way toggle; the highlighted side is the view you are in.
  const view = el("div", "view-toggle", bar);
  view.setAttribute("role", "group");
  view.ariaLabel = "Ansicht";
  const viewBtns = { bird: el("button", "", view, "Von oben"), ego: el("button", "", view, "Vom Rad") };
  setLabel(reset, "↺", "Nochmal");

  const resetTaskRead = readToggle(taskRead, () => `${title.textContent}. ${task.textContent}`, true);
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
  /** `variant` "full": a full-screen page (level summary) instead of a bottom sheet. */
  function openModal(build: (into: HTMLElement) => void, close = { icon: "✓", text: "Schließen", then: () => {}, primary: true }, variant = "") {
    modal.className = `modal ${variant}`;
    sheet.replaceChildren();
    build(sheet);
    afterClose = close.then;
    const btn = el("button", close.primary ? "btn primary close" : "btn close", sheet);
    if (close.icon) setLabel(btn, close.icon, close.text);
    else btn.textContent = close.text;
    btn.addEventListener("click", closeModal);
    modal.classList.remove("hidden");
    sheet.scrollTop = 0;
  }

  let onRule = () => {};
  ruleBtn.addEventListener("click", () => onRule());
  let mapTab: "karte" | "spick" | "settings" = "karte";
  let autoRead = false;

  function mapPane(pane: HTMLElement, levels: MapLevel[], pick: (i: number) => void) {
    const head = el("div", "map-head", pane);
    const row = el("div", "map-title", head);
    const t = el("div", "", row);
    el("h1", "", t, "Fahrrad-Führerschein");
    const solved = levels.reduce((n, l) => n + l.solved, 0), total = levels.reduce((n, l) => n + l.n, 0);
    el("div", "map-total", t, `${solved} von ${total} Aufgaben geschafft`);
    el("div", "pct", row, `${Math.round((solved / total) * 100)}%`);
    const track = el("div", "map-track", head);
    el("span", "map-fill", track).style.width = `${(solved / total) * 100}%`;

    const list = el("div", "levels", pane);
    levels.forEach((l, i) => {
      const state = l.locked ? "locked" : l.next ? "next" : l.done ? "done" : "open";
      const b = el("button", `level ${state}`, list);
      // Badge: the level's icon for the one to play now, ✓ when done, else its number.
      el("span", state === "next" ? "level-tile" : "level-num", b, state === "next" ? l.icon : state === "done" ? "✓" : String(i + 1));
      const info = el("span", "level-info", b);
      el("strong", "", info, state === "next" ? `${i + 1} · ${l.title}` : l.title);
      if (!l.locked) {
        const sub = el("span", "level-sub", info);
        el("span", "level-stars", sub, `${"★".repeat(l.stars)}${"☆".repeat(l.n - l.stars)}`);
        el("span", "", sub, `${l.solved}/${l.n}`);
      } else if (l.hint) el("span", "level-hint", info, l.hint);
      if (!l.locked) b.addEventListener("click", () => pick(i));
      else b.disabled = true;
    });
  }

  /** Spickzettel: rules or signs (segmented control), each with ▶ read-aloud and the source. */
  function sheetPane(pane: HTMLElement, data: SheetData, close: () => void) {
    const head = el("div", "pane-head", pane);
    el("h1", "", head, "Spickzettel");
    const x = el("button", "round-btn", head, "✕");
    x.setAttribute("aria-label", "Schließen");
    x.addEventListener("click", close);
    const seg = el("div", "segmented", pane);
    const list = el("div", "cards-list", pane);
    const fill = (which: "rules" | "signs") => {
      for (const b of seg.children) b.classList.toggle("on", (b as HTMLElement).dataset.k === which);
      list.replaceChildren();
      if (which === "rules")
        for (const { card, signs } of data.rules) {
          const box = el("div", "info-card", list);
          const top = el("div", "info-top", box);
          const tile = el("span", "info-tile", top, signs.length ? "" : (card.icon ?? "📘"));
          if (signs[0]) tile.appendChild(signs[0]);
          el("strong", "", top, card.title);
          speakBtn(top, () => `${card.title}. ${card.text}`);
          el("p", "", box, card.text);
          sourceLink(box, card);
        }
      else
        for (const e of data.signs) {
          const box = el("div", "info-card", list);
          const top = el("div", "info-top", box);
          el("span", "info-tile sign", top).appendChild(e.canvas);
          const t = el("div", "info-name", top);
          el("strong", "", t, e.name);
          el("p", "", t, e.text);
          speakBtn(top, () => `${e.name}. ${e.text}`);
        }
    };
    for (const [k, label] of [["rules", "Regeln"], ["signs", "Verkehrszeichen"]] as const) {
      const b = el("button", "", seg, label);
      b.dataset.k = k;
      b.addEventListener("click", () => fill(k));
    }
    fill("rules");
  }

  function settingsPane(pane: HTMLElement, o: {
    sound: boolean; setSound: (on: boolean) => void; autoRead: boolean; setAutoRead: (on: boolean) => void;
    free: boolean; setFree: (on: boolean) => void; resetProgress: () => void;
  }) {
    el("h1", "", el("div", "pane-head", pane), "Einstellungen");
    switchRow(pane, "Geräusche", "Hupen, Klingeln, Motoren", o.sound, o.setSound);
    switchRow(pane, "Vorlesen", "Aufgaben automatisch vorlesen", o.autoRead, o.setAutoRead);
    switchRow(pane, "Alle Level freischalten", "Für Eltern und Lehrkräfte", o.free, o.setFree);
    const reset = el("button", "set-row danger", pane);
    el("strong", "", reset, "Fortschritt zurücksetzen");
    el("span", "chev", reset, "›");
    reset.addEventListener("click", () =>
      openModal((s) => {
        el("h2", "", s, "Wirklich alles löschen?");
        el("p", "", s, "Alle Sterne und geschafften Aufgaben werden gelöscht. Das kann man nicht rückgängig machen.");
        const yes = el("button", "btn3d red wide", s, "Ja, alles löschen");
        yes.addEventListener("click", () => ((afterClose = o.resetProgress), closeModal()));
      }, { icon: "", text: "Abbrechen", then: () => {}, primary: false }),
    );
  }

  return {
    onMenu: (f: () => void) => menu.addEventListener("click", f),

    /**
     * Overview with three tabs (Karte, Spickzettel, Einstellungen) and a bottom panel in thumb reach.
     * The tabs are not URLs: back/forward only moves between overview and tasks.
     */
    showMap(levels: MapLevel[], o: {
      pick: (i: number) => void;
      sheet: () => SheetData;
      cta: { label: string; go: () => void };
      free: boolean;
      setFree: (on: boolean) => void;
      sound: boolean;
      setSound: (on: boolean) => void;
      autoRead: boolean;
      setAutoRead: (on: boolean) => void;
      resetProgress: () => void;
    }) {
      stopSpeaking();
      map.replaceChildren();
      const pane = el("div", "pane", map);
      const foot = el("div", "map-foot", map);
      const cta = el("button", "btn3d orange cta", foot, o.cta.label);
      cta.addEventListener("click", o.cta.go);
      const tabs = el("nav", "tabbar", foot);
      const TABS = [["karte", "Aufgaben"], ["spick", "Spickzettel"], ["settings", "Einstellungen"]] as const;
      const show = (t: typeof mapTab) => {
        mapTab = t;
        stopSpeaking();
        pane.replaceChildren();
        pane.scrollTop = 0;
        cta.classList.toggle("hidden", t !== "karte");
        for (const b of tabs.children) b.classList.toggle("on", (b as HTMLElement).dataset.tab === t);
        if (t === "karte") mapPane(pane, levels, o.pick);
        else if (t === "spick") sheetPane(pane, o.sheet(), () => show("karte"));
        else settingsPane(pane, o);
      };
      for (const [id, label] of TABS) {
        const b = el("button", "tab", tabs, label);
        b.dataset.tab = id;
        b.addEventListener("click", () => show(id));
      }
      show(mapTab);
      map.classList.remove("hidden");
    },
    hideMap: () => map.classList.add("hidden"),
    setAutoRead: (on: boolean) => void (autoRead = on),
    /** Close any sheet without its follow-up action — the URL decides what shows next. */
    hideModal() {
      afterClose = () => {};
      if (!modal.classList.contains("hidden")) closeModal();
    },

    /** Lernkarte, laid out like the feedback sheet: the sign sits in the round badge where ✓/! would be. */
    showCard(card: RuleCard, signs: HTMLCanvasElement[]) {
      openModal((s) => {
        const badge = el("div", "fb-badge sign", s, signs.length ? "" : (card.icon ?? "📘"));
        if (signs[0]) badge.appendChild(signs[0]);
        el("h2", "", s, card.title);
        if (signs.length > 1) {
          const row = el("div", "card-signs", s);
          for (const c of signs.slice(1)) row.appendChild(c);
        }
        el("p", "", s, card.text);
        sourceLink(s, card, "Quelle: ");
        readToggle(el("button", "pill-btn", el("div", "fb-pills", s)), () => `${card.title}. ${card.text}`);
      }, { icon: "", text: "Zurück", then: () => {}, primary: true }, "rule");
    },

    /**
     * End of a level. `missing` = tasks still needed for the unlock share (0 = level done).
     * `next` (the next level's name) is set when that level is playable; it then gets the main button.
     */
    showLevelDone(
      o: {
        number: number; title: string; n: number; solved: number; stars: number; missing: number;
        next?: string; last: boolean; total: { solved: number; n: number };
      },
      go: { map: () => void; next: () => void },
    ) {
      openModal((s) => {
        const done = o.missing === 0;
        el("div", "done-kicker", s, done ? `Level ${o.number} geschafft` : `Level ${o.number}: fast geschafft`);
        el("h2", "", s, o.title);
        // Stars on a gentle arch, the middle ones highest; earned ones gold, the rest outlined.
        const row = el("div", "done-stars", s);
        for (let k = 0; k < o.n; k++) {
          const star = el("span", k < o.stars ? "on" : "", row, k < o.stars ? "★" : "☆");
          const d = Math.abs(k - (o.n - 1) / 2) / Math.max(1, (o.n - 1) / 2); // 0 in the middle, 1 at the ends
          star.style.transform = `translateY(${d * d * 22}px)`;
          star.style.animationDelay = `${k * 0.08}s`;
        }
        el("div", "done-count", s, `${o.stars} von ${o.n} Sternen`);
        const stats = el("div", "done-stats", s);
        for (const [v, label] of [[`${o.solved}/${o.n}`, "geschafft"], [`${o.stars}/${o.n}`, "ohne Fehler"], [`${o.total.solved}/${o.total.n}`, "Gesamt"]]) {
          const c = el("div", "", stats);
          el("strong", "", c, v);
          el("span", "", c, label);
        }
        if (!done) el("p", "", s, `Löse noch ${o.missing} ${o.missing === 1 ? "Aufgabe" : "Aufgaben"}, dann ist das Level geschafft.`);
        else if (o.last) el("p", "", s, "Du hast die Abschlussprüfung geschafft! 🏆");
        if (o.next) {
          const b = el("button", "btn3d orange wide", s, `Nächstes Level: ${o.next}`);
          b.addEventListener("click", () => ((afterClose = go.next), closeModal()));
        }
      }, { icon: "", text: "Zu den Aufgaben", then: go.map, primary: false }, "full");
    },

    setView(mode: "bird" | "ego") {
      for (const [m, b] of Object.entries(viewBtns)) {
        b.classList.toggle("on", m === mode);
        b.ariaPressed = String(m === mode);
      }
      // Re-insert to restart the fade-out animation each time the ego view opens.
      hint.classList.toggle("hidden", mode !== "ego");
      hint.replaceWith(hint);
    },
    /** `f` switches the view; tapping the side that is already on does nothing. */
    onView: (f: () => void) => {
      for (const b of Object.values(viewBtns)) b.addEventListener("click", () => b.classList.contains("on") || f());
    },

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
      count.textContent = `Aufgabe ${pos.i + 1} von ${pos.n}`; // shown in capitals
      prev.disabled = pos.i === 0;
      fwd.disabled = pos.i === pos.n - 1;
      stopSpeaking();
      resetRead();
      resetTaskRead();
      title.textContent = t;
      task.textContent = taskText;
      // Through the button, so it shows ⏹ while reading and can stop it.
      if (autoRead && map.classList.contains("hidden")) taskRead.click();
      result.classList.add("hidden");
      taskSheet.classList.remove("hidden");
      cards.classList.add("hidden");
    },
    /** `rule` adds a button to the result sheet that opens the Lernkarte. */
    showResult(ok: boolean, explain: string, rule?: { title: string; open: () => void }) {
      ruleBtn.classList.toggle("hidden", !rule);
      if (rule) {
        setLabel(ruleBtn, "📖", "Regel ansehen");
        onRule = rule.open;
      }
      banner.classList.add("hidden");
      chips.classList.add("hidden"); // the sheet needs the room on a phone
      taskSheet.classList.add("hidden");
      result.classList.remove("hidden");
      result.classList.toggle("ok", ok);
      badge.textContent = ok ? "✓" : "!";
      // Right: Weiter is the big one, retry a small round button. Wrong: retry is the big one.
      again.className = ok ? "round-soft" : "btn3d orange grow";
      again.textContent = ok ? "↺" : "Nochmal";
      resultHead.textContent = ok ? "Klasse gemacht!" : "Fast! Schau nochmal.";
      resultText.textContent = explain;
      // Through the Vorlesen button, so it shows "Stopp" while reading — after the fanfare on a right
      // answer, and only if the sheet is still there by then.
      if (autoRead && map.classList.contains("hidden"))
        setTimeout(() => result.classList.contains("hidden") || read.click(), ok ? 1100 : 0);
      next.classList.toggle("hidden", !ok);
    },
    hideResult() {
      stopSpeaking();
      resetRead();
      result.classList.add("hidden");
      banner.classList.add("hidden");
      taskSheet.classList.remove("hidden");
      chips.classList.toggle("hidden", !chipEls.size);
    },
    showBanner: () => banner.classList.remove("hidden"),
    onStep(f: (delta: number) => void) {
      prev.addEventListener("click", () => f(-1));
      fwd.addEventListener("click", () => f(1));
    },
    onReset: (f: () => void) => (reset.addEventListener("click", f), again.addEventListener("click", f)),
    /** Screen pixels the HUD covers at the top and bottom right now, so the camera can frame around it. */
    insets: () => ({ top: top.getBoundingClientRect().bottom, bottom: innerHeight - dock.getBoundingClientRect().top }),
    onNext: (f: () => void) => next.addEventListener("click", f),
  };
}
