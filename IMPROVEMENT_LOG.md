# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim in `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 22 — Share my progress: one clipboard helper, and stop a denied copy failing setup — Done — 2026-07-26

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

## 22. Share my progress: one clipboard helper, and stop a denied copy failing setup

Status: Done — 2026-07-26
Notes: Commit `Share your progress through one clipboard helper`. `copyText(text, okMessage)` is
the only place the clipboard is written: it guards on a missing `navigator`/`clipboard`/`writeText`,
`await`s the write inside a `try`, toasts `okMessage` and returns `true`, and on any rejection
toasts `Copy failed — copy it manually.` and returns `false` — it never throws. `copyCrewLink()`,
`copyScript()` and the `#diagnosticCode` handler all route through it, and `copyCrewLink()` returns
the boolean. `saveSetup()` keeps the save and `loadRemote()` inside its `try` and now reads
`const copied = await copyCrewLink()`, toasting `Shared setup saved. Crew link copied.` or
`Shared setup saved. Copy the crew link from setup.`; `#setupErrors` stays hidden either way.
`publicUrl()` returns `location.href` with the hash cleared and the `sheet` param deleted;
`copyCrewLink()` builds on it and re-adds `sheet` deliberately. `shareSummary(nameLower, today =
challengeToday())` composes only `totalsModel().sorted` (name, total, rank), `challengeProgress()`,
`categoryBreakdown()`, `streakInfo()`, `personalRecords().hardest` and `publicUrl()`; a person with
no credited points gets the two-line "Just getting started" variant and a blank or unknown name
returns `''`. `#shareBtn` sits in the You panel's `.page-head` inside a new `.head-actions` wrapper
next to `#changeMeBtn`, is wired in `init()` to `copyText(shareSummary(…), 'Progress copied — paste
it anywhere.')`, and `render()` both hides and disables it when no profile is selected. index.html
133,957 → 135,867 bytes (87.1% of the 156,000-byte budget, inside the ~3,000 this entry was
projected to cost); `BUDGET` untouched. Deviations: (1) `copyText` cannot write
`navigator?.clipboard?.writeText` as the guard — `navigator` is undeclared in the test harnesses and
optional chaining still throws `ReferenceError` on an undeclared identifier, so the guard reads
`typeof navigator === 'undefined' ? null : navigator` and the single literal
`navigator.clipboard.writeText` the architectural guard counts lives on the `await` line. (2) The
Share button is both hidden (`hide`) and `disabled` rather than one or the other; the entry allows
either and doing both keeps the stub-harness assertion honest for each. (3) `.head-actions` is one
new wrapper `div` so the two head buttons group at the right of the `space-between` `.page-head`
instead of being spread apart; the CSS is the spacing rule the entry allows plus `min-height:44px`
on both buttons. (4) Two extra `static-check.mjs` assertions (`function copyText(`,
`function publicUrl(`) accompany the required ones; nothing existing was retargeted. (5) Rule 10
archiving: entry 21 was moved verbatim into `IMPROVEMENTS.md` after the archived entry 20 and its
index line dropped; the lifted block was string-matched back out of the archive (exactly one
occurrence, gone from the log) and entry 20 was confirmed intact and unsplit.

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
