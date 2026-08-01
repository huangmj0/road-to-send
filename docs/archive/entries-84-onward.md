# v11 pass — entries 84 onward

The current open archive file: rule 10 moves each finished entry here. When it approaches the
per-file cap in `tests/docs-check.mjs`, start the next file rather than raising the cap.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.

## 83. Stop announcing what did not change, and put the chart label where ARIA reads it

Status: Done — 2026-08-01
Notes: Commit `Guard repeated live announcements`. Archived entry 82. index.html 156,217 → 156,103 bytes (-114, 91.8% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
Two `aria-live` regions speak far more than they should, and one accessible name is set where ARIA discards it.

- **The record preview.** `<div class="preview" role="status" aria-live="polite">` (`src/index.template.html:52`) wraps `#rawPreview` and `#creditPreview`, and `updateRecordPreview()` (`src/app.js:140`) rewrites both unconditionally. `init()` binds it to the note field's `input` event (`src/app.js:185`: `noteField.addEventListener('input',updateRecordPreview)`), so typing a note re-announces the point preview on **every keystroke** — a 40-character note queues 40 announcements — even though typing a note never changes the points.
- **The sync diagnostics.** `<div id="syncDiagnostics" class="diagnostics" role="status" aria-live="polite">` (`src/index.template.html:59`), and `renderSync()` (`src/app.js:148`) rewrites `#diagnosticTitle` and `#diagnosticDetail` unconditionally. `render()` calls `renderSync()` every time it runs, so a screen-reader user hears the protocol version and last-sync time re-read on every repaint, whether or not anything about the connection changed.
- **The person card's chart label.** `renderPersonCard()` (`src/app.js:113`) does `trendEl.setAttribute('aria-label',personTrendLabel(weeks))` on `<div id="personTrend" class="trend">` (`src/index.template.html:76`) — a `<div>` with no role. ARIA does not expose `aria-label` on a generic element, so that string is never announced. The inner `<svg>` already carries `role="img"` and its own `aria-label` from `trendAria()`, so the label on the div is both dead and redundant.

Rule 6 asks for idempotent, cheap additions because `render()` runs often; these three are the places where that was not honoured, and the fix makes the app speak strictly **less**.

### Requirements
- `src/app.js`, plus `src/index.template.html` only if the `#personTrend` fix needs it.
- Add one small pure guard helper — `setText(el,text)` — that writes `textContent` **only when the value differs**, and route **every** text write inside the two live regions through it: `#rawPreview` and `#creditPreview` in `updateRecordPreview()`, and `#diagnosticTitle`, `#diagnosticDetail` **and `#diagnosticCode`** in `renderSync()`. One helper, reused; do not write a second copy.
- `#diagnosticCode` is easy to miss because it is written through a local rather than a `document.querySelector(...).textContent=` chain — `renderSync()` ends with `const code=document.querySelector('#diagnosticCode');code.classList.toggle('hide',!syncErrorCode);code.textContent=syncErrorCode` (`src/app.js:148`). It sits inside `#syncDiagnostics`, so guarding only the title and detail would leave an unchanged error code being rewritten, and potentially re-announced, on every repaint — exactly the defect this entry exists to remove. Leave the `classList.toggle` alone; only the `textContent` write needs the guard.
- The helper must be a top-level function so `tests/client-state.state.test.js` can reach it — the client-state suites eval the built script (rule 9).
- **`#personTrend`:** stop setting `aria-label` on the role-less `<div>`. The `<svg>` that `trendSvg()` returns already carries `role="img"` and a full `aria-label`, so the correct fix is to drop the dead attribute; keep `personTrendLabel()` only if something still consumes it, and delete it if nothing does. When the series is empty the card renders `<p class="hint">No challenge days yet.</p>` and needs no label at all.
- **Sequencing:** entry 77 rewrites `trendSvg()`'s output. This entry only removes an attribute set outside it, so the two do not collide, but do not start this while 77 is `In progress`.
- Behaviour must not change for anyone not using a screen reader: the same text still appears, it is just not re-announced when it is identical.
- Match the existing compact single-line style of `src/app.js` (rule 8).

### Tests
- `tests/client-state.state.test.js`: the guard writes when the text differs and leaves the node untouched when it does not. Build expected substrings with `+` — the state suite's TRAP forbids backticks and `${` inside its checks literal.
- `tests/client-state.dom.test.js`: calling `updateRecordPreview()` twice with only the note field changed leaves `#creditPreview`'s text node identical; two consecutive `render()` calls with an unchanged sync state leave `#diagnosticDetail` and `#diagnosticCode` identical.
- **Do not assert the `#personTrend` attribute removal in the DOM suite — it is unobservable there.** `tests/harness.js:7` states it outright: `setAttribute()` is a no-op and `getAttribute()` always returns `null`, so "`#personTrend` carries no `aria-label`" passes whether or not the `setAttribute` call was removed, and the stub does not parse assigned `innerHTML` into a queryable nested `<svg>` either. That assertion would be green on day one and green if the change were reverted — worse than no test. The same TRAP names the remedy: cover aria-* in `tests/static-check.mjs`.
- `tests/static-check.mjs`: the built script no longer contains a `setAttribute('aria-label'` call against `#personTrend`'s element (assert the exact compact text, as the suite does elsewhere); `#syncDiagnostics` and the record `.preview` keep `role="status"` and `aria-live="polite"` — the regions stay, they just stop repeating themselves.

### Do not
Do not remove either `aria-live` region or downgrade one to `off` — the point is to announce the right things, not to go silent. Do not add a new live region anywhere (the comment above `renderYouPace()` in `src/app.js:81` records why `#todayRemaining` is the You card's only one). Do not add `aria-live` to the trend charts. Do not add `role="img"` to `#personTrend` as a way of keeping the dead label — the SVG inside it is already the labelled graphic and a second one would double-announce. Tone rule: this entry makes the app speak **less**, which is the direction the tone rule asks for; do not add anything that opens, appears or speaks on its own while you are in these two code paths.

---
