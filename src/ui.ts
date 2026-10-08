// Plain DOM overlay. Big buttons and short sentences — the readers are 8–10 years old.

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text = "") => {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  parent.appendChild(e);
  return e;
};

export function createUI(root: HTMLElement) {
  const top = el("div", "top", root);
  const title = el("h1", "title", top);
  const task = el("p", "task", top);

  const bottom = el("div", "bottom", root);
  const reset = el("button", "btn", bottom, "↺ Nochmal");
  const next = el("button", "btn primary", bottom, "Weiter ➜");

  const result = el("div", "result hidden", root);
  const resultHead = el("h2", "", result);
  const resultText = el("p", "", result);

  return {
    showScenario(t: string, taskText: string) {
      title.textContent = t;
      task.textContent = taskText;
      result.classList.add("hidden");
      next.classList.add("hidden");
    },
    showResult(ok: boolean, explain: string) {
      result.classList.remove("hidden");
      result.classList.toggle("ok", ok);
      resultHead.textContent = ok ? "Klasse gemacht! 🎉" : "Fast! Schau noch mal genau hin.";
      resultText.textContent = explain;
      next.classList.toggle("hidden", !ok);
    },
    hideResult: () => result.classList.add("hidden"),
    onReset: (f: () => void) => reset.addEventListener("click", f),
    onNext: (f: () => void) => next.addEventListener("click", f),
  };
}
