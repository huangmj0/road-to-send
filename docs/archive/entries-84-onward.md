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

## 84. Line up the numbers and close the double gap in the stat grid

Status: Done — 2026-08-01
Notes: Commit `Align stat grid figures`. Archived entry 83 into a new pass file because the prior archive would exceed its 90,000-byte cap. index.html 156,103 → 156,367 bytes (+264, 92.0% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
Numbers that update in place jitter, and one grid spaces itself twice.

`font-variant-numeric:tabular-nums` is already applied to six selectors — `.rank` (`src/styles.css:9`), `.breakdown-pts` (`:11`), `.pyramid-count` (`:13`), `.records-value` (`:14`), `.cat-chip em` (`:19`), `.bounty-peek .bounty-pts` (`:24`) — and is missing from the three places that most need it: `.stat strong{…font:800 42px 'Roboto Condensed';…}` (`:3`), which is the You tab's four big counters; `.pts{color:var(--orange);font-weight:800;text-align:right}` (`:3`), the right-aligned points column in every feed row; and the leaderboard's two value columns, which sit directly beside `.rank` — a column that *does* have it. Proportional digits make a right-aligned column of numbers wander, which is exactly the case tabular figures exist for.

`.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}` (`:3`) contains four `<article class="card stat">` elements (`src/index.template.html:34`), and `.card{…margin-bottom:16px}` (`:3`) still applies inside it. So the grid's rows are spaced **32px** while its columns are spaced **16px** — the four counters on the You tab are visibly further apart vertically than horizontally, for no reason anyone chose.

`#groupPercent` — the Crew tab's headline percentage — is `<strong id="groupPercent">0%</strong>` (`src/index.template.html:59`) with **no class at all**, so it inherits 16px body text and sits beside `.group-card h2{font-size:31px}` (`:3`) as an afterthought. It is the number the whole card is about.

### Why not more
Card padding varies across 20/24/22/18/23px and there are nine gap values and five radii. A full spacing scale is a larger change than one commit and would touch every card in the app; this entry fixes the two spacing defects that are visible as defects and leaves the scale alone.

### Requirements
- `src/styles.css`, plus `src/index.template.html` only for the `#groupPercent` class attribute.
- Add `font-variant-numeric:tabular-nums` to `.stat strong` (`:3`), `.pts` (`:3`), and the leaderboard's third and fourth `<td>`s. Prefer extending the existing comma-separated selector list where one exists over adding a new rule.
- `.stat-grid .card{margin-bottom:0}` so the grid's own `gap` is the only vertical spacing. Verify the four cards on the You tab end up equally spaced in both directions.
- Give `#groupPercent` a class and size it as the card's headline figure — it must read as a peer of the `<h2>` beside it, carry `font-variant-numeric:tabular-nums`, and keep working with the existing `#groupPercent.reached{color:var(--orange-ink)}` state rule (`:9`). Do not change what the number says or when `.reached` applies.
- **Sequencing:** entry 76 retokenises `.stat strong`'s font stack. Both entries edit that declaration. Edit around whatever is there; do not revert 76's `var(--head)`.
- Append new CSS at the end of `src/styles.css`; do not reformat existing lines.

### Tests
- `tests/static-check.mjs`: `.stat strong`, `.pts` and the leaderboard value cells carry `font-variant-numeric:tabular-nums`; `.stat-grid .card` zeroes its bottom margin; `#groupPercent` has a class in the template and a rule that styles it. Assert the exact compact text.
- `tests/client-state.dom.test.js`: `#groupPercent` still toggles `.reached` at and above 100%.

### Do not
Do not introduce a spacing scale, rename tokens, or restyle cards that are not named here — that is a bigger change than one commit and this entry is deliberately not it. Do not change any number's value, rounding or wording. Do not move `#groupPercent` in the DOM — `tests/static-check.mjs:190` pins the crew panel's card order. Tone rule: this entry changes type and spacing only; the group percentage stays a figure of what the crew has done and must not gain a target, a shortfall, or a "to go" line.

---
