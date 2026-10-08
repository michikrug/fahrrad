import { speak, stopSpeaking } from "./audio";

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

export interface Chip {
  id: string;
  label: string;
  color: string; // CSS colour of the participant, so kids match chip and vehicle
}

export function createUI(root: HTMLElement) {
  const top = el("div", "top", root);
  const title = el("h1", "title", top);
  const task = el("p", "task", top);

  const banner = el("div", "banner hidden", root, "Achtung!");
  const hint = el("div", "hint hidden", root, "👀 Wische zur Seite, um dich umzuschauen");

  const dock = el("div", "dock", root);
  const result = el("div", "result hidden", dock);
  const resultHead = el("h2", "", result);
  const resultText = el("p", "", result);
  const read = el("button", "btn small", result);
  const cards = el("div", "cards hidden", dock);
  const chips = el("div", "chips hidden", dock);
  const bar = el("div", "bar", dock);
  const reset = el("button", "btn", bar);
  const view = el("button", "btn", bar);
  const next = el("button", "btn primary", bar);
  setLabel(reset, "↺", "Nochmal");
  setLabel(next, "➜", "Weiter", true);

  let reading = false;
  const readLabel = (on: boolean) => ((reading = on), on ? setLabel(read, "⏹", "Stopp") : setLabel(read, "🔊", "Vorlesen"));
  readLabel(false);
  read.addEventListener("click", () => {
    if (reading) {
      stopSpeaking();
      return readLabel(false);
    }
    readLabel(true);
    speak(`${resultHead.textContent} ${resultText.textContent}`, () => readLabel(false));
  });

  const chipEls = new Map<string, HTMLButtonElement>();

  return {
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
    showScenario(t: string, taskText: string) {
      stopSpeaking();
      readLabel(false);
      title.textContent = t;
      task.textContent = taskText;
      result.classList.add("hidden");
      cards.classList.add("hidden");
      next.classList.add("hidden");
    },
    showResult(ok: boolean, explain: string) {
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
      readLabel(false);
      result.classList.add("hidden");
      banner.classList.add("hidden");
      chips.classList.toggle("hidden", !chipEls.size);
    },
    showBanner: () => banner.classList.remove("hidden"),
    onReset: (f: () => void) => reset.addEventListener("click", f),
    onNext: (f: () => void) => next.addEventListener("click", f),
  };
}
