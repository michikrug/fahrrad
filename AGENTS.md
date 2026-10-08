# AGENTS.md

Notes for coding agents working on this repo. The README says what the app is; this file says how to change it safely.

## Ground rules

- **Audience:** children aged 8–10 and their teachers. All UI text, questions and explanations are **German, short, kid-friendly**: "du", no jargon, no blame on a wrong answer. Code, comments and commits are English.
- **Phone portrait first** (~390×844). Check every UI change there before tablet or desktop. Touch targets ≥ 44 px.
- **Rules must be correct.** Every rule card cites the StVO passage it rests on (`source` + `url`). Do not teach anything without a primary source. Topics left out on purpose are listed at the top of `src/content/rules.ts`.
- **No asset files.** 3D models, traffic signs (canvas textures), sounds (Web Audio) and icons are all generated in code. Keep it that way unless asked.
- **No UI framework**, no new runtime dependencies. three.js is the only one.

## Commands

```sh
npm run dev     # vite --host, reachable from phones on the LAN
npm run check   # tsc --noEmit && bun test
npm run build   # check types, then vite build into dist/
npx wrangler deploy   # after build; deploys dist/ to fahrrad.michikrug.de. Only with the owner's OK.
```

Open one task directly with `/?s=<scenario id>`. In dev, `window.world`, `window.rig` and `window.voices` are exposed for poking at the scene from the console or a headless browser.

## Map

| Path | What |
|------|------|
| `src/content/scenarios.ts` | All levels and tasks, **plain data**. Most extensions happen here. |
| `src/content/rules.ts` | Rule cards (Lernkarten) and the sign cheat sheet (`signInfo`). |
| `src/types.ts` | `Scenario`, `Layout`, `ArmSpec`, `Participant`, `RuleCard`: read this first. |
| `src/check.ts` | Pure answer checking (no three.js). |
| `src/main.ts` | App state: task loading, tapping, driving the animation, sounds per frame, result. |
| `src/ui.ts` + `src/style.css` | All DOM: HUD, answer chips and cards, feedback sheet, menu (Aufgaben, Spickzettel, Einstellungen), modals. |
| `src/play.ts` | Route timing, near-miss detection. |
| `src/camera.ts` | Bird view (OrbitControls), ego view on the handlebar, tweens, HUD-aware framing. |
| `src/audio.ts` | Synthesised sounds, read-aloud (`speechSynthesis`), voice picking. |
| `src/progress.ts` | localStorage: progress, settings flags. |
| `src/scene/*` | Junction generator: `roads`, `signs`, `lights`, `actors`, `decor`, `world`. |
| `public/sw.js` | Hand-written service worker for offline use. |

## Adding a task

1. Add a `Scenario` to `scenarios` in `src/content/scenarios.ts` and put it into a `Level`.
2. Pick exactly one question type:
   - **`answer`**: tap the road users in order. It is a list of **groups** (`[["a","b"],["c"]]`): members of one group may be tapped in any order, e.g. two oncoming vehicles going straight.
   - **`choice`**: 2–3 answer cards. `correct` indexes `options` as written. Cards are shuffled at display time, so the order in the data does not matter.
3. `rule` must point to an existing rule card. Write `explain` in kid-friendly German. If it names a colour ("das rote Auto"), a participant of that colour must exist (enforced by a test).
4. Prefer existing layout helpers in `scenarios.ts` (`cross()`, `roundabout`, `bend()`, …) over new geometry.
5. Run `npm run check`. `tests/content.test.ts` validates every scenario.

There is **no traffic-rule solver**: the right answer is written by hand, like a teacher would. Keep it that way unless the task count grows past ~100.

## Adding a sign

Signs are drawn on canvas in `src/scene/signs.ts`, following the real StVO shapes, colours and white/black rims. Add the id to `SignId` in `types.ts`, draw it, and add a `signInfo` entry if it belongs in the cheat sheet. Check the result against the official image (Wikipedia "Bildtafel der Verkehrszeichen").

## Gotchas (learned the hard way)

- **Service worker:** precaches `index.html` and whatever it links to. It uses `ignoreVary` (Cloudflare sends `Vary: Origin`). It rejects `text/html` responses for asset URLs, because SPA hosts answer missing files with index.html and 200. Assets are cached before the shell. Test offline changes against a production build (`vite preview`), not the dev server.
- **Read-aloud voices:** online, pick the best German voice. Offline, local voices only, and skip plain "Anna" when network voices exist: in Chrome it read German with English pronunciation. Speaking ducks the sound effects. Only the *current* utterance may un-duck (`current === u` guard).
- **One read button everywhere** (`readToggle` in `ui.ts`): round, ▶/■ drawn in CSS, and a second tap stops. Reuse it; don't make new speak buttons.
- **Sounds** are synthesised in `audio.ts`. Engines idle while waiting and only rev once their vehicle starts. A near miss plays a horn (car or bus) or the bell (bike), never a squeal. Correct answer: `fanfare()`; wrong: `oops()`, deliberately soft. Ask before making anything harsher.
- **Camera framing:** the HUD covers the top and bottom of the screen unevenly. `ui.insets()` measures it, and the camera shifts the picture with `setViewOffset`. If you change the HUD layout, check that the junction is still centred in the free area in both views.
- **CSS centring of letters and numbers** in circles uses `text-box: trim-both cap alphabetic` in an `@supports` block at the **end** of `style.css`. It does not work on grid containers, and base rules placed after it override it.
- **Coplanar surfaces flicker.** Sidewalk pieces must abut, not overlap (see `ringCorner` in `roads.ts`).
- **Free GPU memory** of a removed scene with `disposeTree`. Old school tablets run out fast.

## Verifying UI changes

Type checks and tests do not cover visuals. Look at the result:

- Run headless Chrome via the DevTools protocol at 390×844, `deviceScaleFactor: 2`, `mobile: true`, with `--use-angle=swiftshader`.
- Open `/?s=<id>`, click, and take screenshots.
- Look at both "Von oben" and "Vom Rad" for scene changes.
- Sounds can't be checked headless. Ask the owner to listen.
- If a change visibly alters what the README screenshots show (`docs/screenshots/`, 390×844 at 2×), retake them the same way.

## Git

`main` is the default branch. Never commit to it directly: use a short, descriptive branch name without slashes, then fast-forward merge after the owner's OK. Commits follow Conventional Commits; reasoning goes in the body (`intent(…)`, `decision(…)`, `rejected(…)`, `learned(…)` lines).
