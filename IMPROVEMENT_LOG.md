# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim in `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 21 — Record tab: show the bounty's description, and make the submit guard real — Done — 2026-07-26
- 22 — Share my progress: one clipboard helper, and stop a denied copy failing setup — Todo

Entries 1–14 shipped and now live in `IMPROVEMENTS.md` under "v11 pass — frontend enhancement queue (entries 1–14)", together with five backfilled stubs (B1–B5) for feature commits that shipped without an entry. Entry numbers never restart.

## Rules for implementers (read before every entry)

**Before you start.** Implement the **first** entry whose `Status:` is `Todo`, top to bottom; skip `Done`, `Blocked`, and anyone else's `In progress`. If no entry is `Todo`, stop and report "queue empty — no Todo entries" without inventing, re-doing, or reopening work. Never work from `IMPROVEMENTS.md` — it is closed, shipped history. The numbered rules below keep their numbers permanently; entries cite them by number, so never renumber them.

1. **This app is LIVE.** Real crew data lives in a shared Google Sheet and in users' localStorage. Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change (`index.html` stays at the repository root).
2. **Edit only** `src/app.js`, `src/index.template.html`, `src/styles.css`, and test files. **Never** edit `index.html` directly, and **never** touch `src/apps-script.js`, `src/schema.json`, or `src/scoring.json` — those three are the shared browser/backend contract, and any change there forces an API version bump and an organizer redeploy. They are **out of scope for log-driven entries**: they change only in an organizer-coordinated task that bumps the API version, gets its own entry, and ships the redeploy (see B4/B5 in `IMPROVEMENTS.md` for what happens when that pairing is skipped). An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
3. **After editing:** run `npm run build`, then `npm test` (all must pass). Commit the regenerated `index.html` together with your `src/` and test changes. Never weaken or delete an existing test assertion. `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`. `tests/size-check.mjs` caps `index.html` at a byte `BUDGET`: raise `BUDGET` deliberately in a log entry that explains the growth — never as a side effect of another change.
4. **localStorage keys are frozen:** `roadToSendEndpoint`, `roadToSendMe`, `roadToSendLogsV9`, `roadToSendConfigV9`, `roadToSendConfigV8` (read-only migration source — only the existing one-time migration writes `roadToSendConfigV9` from it), `roadToSendWeekReview`, and `roadToSendShared:{activities|config|meta}:{endpoint}`. Read them; never rename them; only write shapes existing code already reads. Do not add new localStorage keys unless an entry explicitly says so (none currently do). `tests/docs-check.mjs` asserts every `roadToSend…` literal in `src/app.js` appears in this list, so a new key means updating this rule in the same commit.
5. **Structural constraints enforced by tests:** exactly **one `<script>` block** in the template (all JS goes in `src/app.js`); exactly **one `<table>`** in the page (new visualizations use divs/CSS grid); the built lines `const SCRIPT=\`…\`;` and the `const SUPPORTED_API_VERSIONS` line immediately after it are untouchable (no backticks may enter the Apps Script string); DOM ids stay unique; every labeled input keeps its `<label for>`.
6. **Reuse the scoring core:** `computeCredits()`, `totalsModel()`, `paceInfo()`, `weekKey()`, `fmtDay()`, `parseDateOnly()`, and `challengeToday()`. Never call `new Date()` for challenge-date logic — shared mode follows the Sheet's timezone via `challengeToday()`. Never fork or re-derive scoring math; consume the maps `computeCredits()` returns. New display logic = small pure helper functions called from `render()`; `render()` runs often, so keep additions idempotent and cheap.
7. **Accessibility:** minimum 44px touch targets; graphics get `role="img"` with a meaningful `aria-label` text alternative (decorative inner elements `aria-hidden="true"`); dynamic status text uses `aria-live="polite"`; keep visible focus (site uses `:focus-visible`). **Motion:** CSS-only transitions/animations so the existing `@media(prefers-reduced-motion:reduce)` kill-switch applies; no JS-driven animation.
8. **No external dependencies (runtime or dev), no new network requests, no frameworks, no build-tool changes.** Match the existing compact single-line code style of `app.js`/`styles.css`. An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
9. **Tests per entry:** behavioral coverage for new helpers goes in `tests/client-state.test.js` (it evals the built script — new top-level helper functions are directly reachable there); DOM/a11y presence assertions go in `tests/static-check.mjs`. Copy must not trip the banned-strings assertion in `static-check.mjs` (no "Hard mode", "Super hard mode", "pull-up mode", "Record send pyramid", "Balanced week bonus").
10. **Bookkeeping:** set `Status: In progress — date` when starting; on completion set `Status: Done — date` and put the commit subject plus any deviations in `Notes:`, and update the queue index above. If an entry cannot be completed inside these rules, set `Status: Blocked — reason` and move on — do not bend the rules. **Archiving:** a finished entry stays here only until the next iteration — before you start yours, move any entry already marked `Done` (heading through its `---` separator, **verbatim**) to the v11 archive in `IMPROVEMENTS.md` and drop its index line. This file therefore carries at most one `Done` entry, the one completed in the current commit, and `tests/docs-check.mjs` enforces that.

---

## 21. Record tab: show the bounty's description, and make the submit guard real

Status: Done — 2026-07-26
Notes: Commit `Show the bounty description and make the submit guard real`. Module-level `let
saving=false`; `submitActivity` returns early when it is set, sets it before its `try` and clears it
in `finally`; `#saveActivityBtn.disabled` gained `saving ||` as its first term and no input was
disabled. `creditPreviewCopy(opts)` extracts the ladder verbatim and adds the no-target and
out-of-window states; `#bountyHint` (with `aria-describedby` on the select, the existing
`<label for="bountySelect">` untouched) shows the chosen bounty's `description`; `#hardestGrade`
resets only in the success block. Deviations: (1) the hint is written with `textContent`, not
`esc()` + `textContent` — `textContent` already escapes, and wrapping in `esc()` would render
literal `&#39;` in the many descriptions containing apostrophes and would break the specified
`#bountyHint.textContent === description` assertion. (2) `creditPreviewCopy` accepts the documented
opts object including `saving`, but does not branch on it: the entry specifies no copy for the
in-flight state and inventing one is out of scope, so the message keeps its last value while the
button is disabled. index.html 133,052 → 133,957 bytes (85.9% of the 156,000-byte budget); `BUDGET`
untouched.

### Why
`populateBountySelect()` renders each `<option>` as icon + title + points and **never** the `description` from `scoring.json` — descriptions appear only in the You-tab bounty cards — so on the Record tab you pick a bounty by name alone. Worse, double-submit protection is defeatable: `submitActivity()` disables `#saveActivityBtn`, but `updateRecordPreview()` ends by recomputing `disabled` from the draft alone, and it is bound to `change` on the type radios, `#hardestGrade`, `#bountySelect` and `#activityDate` — none of which are disabled during the save — so changing the grade mid-POST re-enables Save. There is no in-flight flag. Two smaller papercuts: with a date outside the challenge window the button is disabled while `#creditPreview` still reads "Counts in full · +N today", a dead button with no explanation; and after a successful save `#hardestGrade` keeps its previous value while every other field resets.

### Requirements
- `src/app.js` — add a module-level `let saving = false`. `submitActivity` returns immediately when `saving` is true, sets `saving = true` before its `try`, and clears it in `finally`. `updateRecordPreview` becomes `…disabled = saving || !target || !dateInChallenge(draft.date) || (type === 'bounty' && !draft.bountyId)`. That single added term is the fix — do **not** try to fix this by disabling more inputs.
- New pure helper `creditPreviewCopy(opts)` → string, taking a plain object (`{type, hasTarget, inWindow, bountyId, base, credit, reason, startDate, tripDate, saving}`) so it is testable with no DOM. Extract today's message ladder into it and add the two missing states: `!inWindow` → `Outside the challenge window (Jul 1 – Jul 31) · pick a date in range` (dates via `fmtDay()`), and `!hasTarget` → `Choose who you are to save this.` Preserve every existing string exactly for the states that already work (full credit, `already logged`, bounty unchosen, weekly cap) so the harness-2 preview assertions keep passing.
- Bounty description: add `<small id="bountyHint" class="hint"></small>` inside `#bountyFields`, **after** `#bountySelect`, and give the select `aria-describedby="bountyHint"`. `updateRecordPreview()` — which already runs on `#bountySelect` change — sets its text from the selected bounty's `description` via `esc()`, and empties it when nothing is selected. **Keep** the existing `<label id="bountySelectLabel" for="bountySelect">`: `static-check.mjs` asserts a `<label for="bountySelect">`, and the label already carries the day context.
- After a successful save, reset `#hardestGrade` to `''` alongside the existing `#activityNote`/`#bountySelect` resets, inside the same success block — never in the `catch`, because a failed save must keep the draft intact.
- `src/styles.css` — one rule for `#bountyHint` (block, `margin-top`, `--muted`, small line-height) reusing existing tokens. All edits live in the `record` panel, so no You/Crew order assertion is involved.

### Tests
- `tests/client-state.test.js` harness-1 `checks` literal (no backticks, no `${` — build expected strings with `+`): `creditPreviewCopy` for full credit, `already logged`, bounty-not-chosen, bounty over the weekly cap, no target, and out-of-window — the last asserting the message names **both** window dates.
- `tests/client-state.test.js` harness-2 `domChecks` literal: with the date picker open and `#activityDate` set outside `config`'s window, `updateRecordPreview()` → `#creditPreview.textContent` starts with `Outside the challenge window` and `#saveActivityBtn.disabled === true`; back in range → enabled. Then `saving = true; updateRecordPreview()` → still disabled with an otherwise valid draft; `saving = false; updateRecordPreview()` → enabled. That pair is the in-flight regression test. Select the Bounty radio, call `populateBountySelect()`, set `#bountySelect.value` to `dailyBounties(challengeToday())[0].id`, `updateRecordPreview()` → `#bountyHint.textContent` equals that bounty's `description`; clear the value → `#bountyHint.textContent === ''`.
- `tests/static-check.mjs` — **add**: `#bountyHint` exists; `#bountySelect` carries `aria-describedby="bountyHint"`; the existing `<label for="bountySelect">` assertion still passes; the bounty-catalog assertions over `scoring.json` are untouched.

### Do not
Put descriptions inside `<option>` text — unstyleable, verbose in the closed select, and it bloats the artifact; remove or replace the `<label for="bountySelect">` with `aria-describedby`; disable the type radios, date or grade inputs during a save (the `saving` flag is the guard); reset `#hardestGrade` on a failed save; touch `src/scoring.json` (the descriptions already exist there) or the weekly-cap math; add a localStorage key.

---

## 22. Share my progress: one clipboard helper, and stop a denied copy failing setup

Status: Todo
Notes:

### Why
There is no way to share or brag about progress — `exportData()` only downloads raw JSON — and there are three hand-rolled `navigator.clipboard.writeText` call sites with **no shared helper and no `try`/`catch`**: `copyCrewLink()`, `copyScript()`, and the inline `#diagnosticCode` handler. That missing catch is a real bug: `saveSetup()` `await`s `copyCrewLink()` **inside its `try`**, so a rejected clipboard write (insecure context, denied permission) lands in the `catch` and paints `#setupErrors` as though setup itself had failed — even though the config was saved to the Sheet and the endpoint persisted.

### Requirements
- `src/app.js` — new `async function copyText(text, okMessage)`: returns `false` and toasts `Copy failed — copy it manually.` when `navigator?.clipboard?.writeText` is missing or rejects; otherwise toasts `okMessage` and returns `true`. **It never throws.** Rewire all three call sites — `copyCrewLink()`, `copyScript()` and the `#diagnosticCode` handler in `init()` — through it, and have `copyCrewLink()` return `copyText`'s boolean.
- Fix `saveSetup()`: keep the save and `loadRemote` work inside the `try`, and let the success toast reflect the copy result — `Shared setup saved. Crew link copied.` when `copyCrewLink()` returns true, `Shared setup saved. Copy the crew link from setup.` when it does not. `#setupErrors` must stay hidden in both cases.
- New pure helper `publicUrl()` → `location.href` with the hash cleared and the `sheet` query param **removed**, so shared text never leaks the crew's Apps Script endpoint. `copyCrewLink()` keeps its own behaviour — it intentionally *includes* `sheet` — so factor out only the URL construction, not the semantics.
- New pure helper `shareSummary(nameLower, today = challengeToday())` → a short multi-line string composed from existing helpers only: name, `challengeProgress()` (entry 18) for the `Day N of M` line, total and rank from `totalsModel().sorted`, the `categoryBreakdown()` rows as icon/number pairs, `streakInfo()` for the streak, `personalRecords().hardest` when graded, and `publicUrl()` on the last line. A person with no credited points gets a short "just getting started" variant; a blank or unknown `me` returns `''`. No new scoring math, no `new Date()`.
- `src/index.template.html` — `<button id="shareBtn" class="text-btn" type="button">Share</button>` in the You panel's existing `.page-head`, next to `#changeMeBtn`. That is **above** every You-panel anchor (`today-card`, `#bountyCapHint`, `#todayBounties`, `#personalActivity`, `.stat-grid`), so no existing order assertion is affected. Wire it in `init()` to `copyText(shareSummary(String(me).toLowerCase()), 'Progress copied — paste it anywhere.')`, and hide or disable it when no profile is selected.
- `src/styles.css` — no new rules if `.text-btn` suffices; add only spacing for the two-button `.page-head` group, keeping both at least 44px.

### Tests
- `tests/client-state.test.js` harness-1 `checks` literal (no backticks, no `${`; emoji are fine): `shareSummary` on a crafted roster contains the person's name, `Day ` plus the day number, the total, the rank and the streak, and does **not** contain `sheet=` or the endpoint host — that is the privacy assertion. A person with no logs yields the short variant; a blank name yields `''`. `publicUrl()` strips both the hash and the `sheet` param.
- `tests/client-state.test.js` — a **new** async `test(...)` case modelled on the existing `test('background sync respects the open date picker…')` harness, whose context is the only one already carrying `Promise`, `fetch` and its own `makeElement()` map. Give it `navigator:{clipboard:{writeText:()=>Promise.reject(Error('denied'))}}` plus a `fetch` stub that accepts `saveConfig`, populate the setup fields, `await saveSetup()`, then assert `endpoint` is set, `#setupErrors` still has the `hide` class, and the toast reports a saved setup with an uncopied link. That is the regression lock for the false-failure bug. Add a second case with a resolving `writeText` asserting `copyText` returns `true` and toasts `okMessage`. Adding a `navigator` stub to a context object is additive, not a weakened assertion.
- `tests/static-check.mjs` — **add**: `#shareBtn` exists inside `data-panel="you"` with `type="button"`; a new order assertion `data-panel="you"` → `id="shareBtn"` → `today-card`; and an architectural guard, `assert.equal((script.match(/navigator\.clipboard\.writeText/g)||[]).length, 1, 'clipboard writes funnel through one helper')`.

### Do not
Use `navigator.share` — a permission-gated async path that still needs the clipboard fallback and is not observable in the stub harness, so propose it separately; include the `sheet` param, the endpoint, or any other person's data in the shared text; make `copyText` throw or re-throw; change `exportData()`'s JSON shape or the `action:'saveConfig'` request body; add a network request, a dependency, or a localStorage key.
