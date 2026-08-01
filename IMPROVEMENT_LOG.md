# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 51 — Caption the grade pyramid — Done — 2026-08-01
- 52 — Let a climb carry a note — Todo
- 53 — Show a crewmate's weekly points in their card — Todo
- 54 — Show a crewmate's most recent entries in their card — Todo
- 55 — Say which protocol version this build expects — Todo
- 56 — Date the export snapshot — Todo

Entries 1–40 shipped and now live under `docs/archive/`, together with five backfilled stubs (B1–B5) for feature commits that shipped without an entry. `IMPROVEMENTS.md` indexes them by title. Entry numbers never restart.

## Rules for implementers (read before every entry)

**Before you start.** Implement the **first** entry whose `Status:` is `Todo`, top to bottom; skip `Done`, `Blocked`, and anyone else's `In progress`. If no entry is `Todo`, stop and report "queue empty — no Todo entries" without inventing, re-doing, or reopening work. Never work from `IMPROVEMENTS.md` or anything under `docs/archive/` — that is closed, shipped history. Read an archived entry only to answer a specific question about how something already shipped, and read the one pass file that holds it rather than all of them. The numbered rules below keep their numbers permanently; entries cite them by number, so never renumber them.

1. **This app is LIVE.** Real crew data lives in a shared Google Sheet and in users' localStorage. Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change (`index.html` stays at the repository root).
2. **Edit only** `src/app.js`, `src/index.template.html`, `src/styles.css`, and test files. **Never** edit `index.html` directly, and **never** touch `src/apps-script.js`, `src/schema.json`, or `src/scoring.json` — those three are the shared browser/backend contract, and any change there forces an API version bump and an organizer redeploy. They are **out of scope for log-driven entries**: they change only in an organizer-coordinated task that bumps the API version, gets its own entry, and ships the redeploy (see B4/B5 in `IMPROVEMENTS.md` for what happens when that pairing is skipped). An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
3. **After editing:** run `npm run build`, then `npm test` (all must pass). Commit the regenerated `index.html` together with your `src/` and test changes. Never weaken or delete an existing test assertion. `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`. `tests/size-check.mjs` caps `index.html` at a byte `BUDGET`: raise `BUDGET` deliberately in a log entry that explains the growth — never as a side effect of another change.
4. **localStorage keys are frozen:** `roadToSendEndpoint`, `roadToSendMe`, `roadToSendLogsV9`, `roadToSendConfigV9`, `roadToSendConfigV8` (read-only migration source — only the existing one-time migration writes `roadToSendConfigV9` from it), `roadToSendWeekReview`, and `roadToSendShared:{activities|config|meta}:{endpoint}`. Read them; never rename them; only write shapes existing code already reads. Do not add new localStorage keys unless an entry explicitly says so (none currently do). `tests/docs-check.mjs` asserts every `roadToSend…` literal in `src/app.js` appears in this list, so a new key means updating this rule in the same commit.
5. **Structural constraints enforced by tests:** exactly **one `<script>` block** in the template (all JS goes in `src/app.js`); exactly **one `<table>`** in the page (new visualizations use divs/CSS grid); the built lines `const SCRIPT=\`…\`;` and the `const SUPPORTED_API_VERSIONS` line immediately after it are untouchable (no backticks may enter the Apps Script string); DOM ids stay unique; every labeled input keeps its `<label for>`.
6. **Reuse the scoring core:** `computeCredits()`, `totalsModel()`, `paceInfo()`, `weekKey()`, `fmtDay()`, `parseDateOnly()`, and `challengeToday()`. Never call `new Date()` for challenge-date logic — shared mode follows the Sheet's timezone via `challengeToday()`. Never fork or re-derive scoring math; consume the maps `computeCredits()` returns. New display logic = small pure helper functions called from `render()`; `render()` runs often, so keep additions idempotent and cheap.
7. **Accessibility:** minimum 44px touch targets; graphics get `role="img"` with a meaningful `aria-label` text alternative (decorative inner elements `aria-hidden="true"`); dynamic status text uses `aria-live="polite"`; keep visible focus (site uses `:focus-visible`). **Motion:** CSS-only transitions/animations so the existing `@media(prefers-reduced-motion:reduce)` kill-switch applies; no JS-driven animation.
8. **No external dependencies (runtime or dev), no new network requests, no frameworks, no build-tool changes.** Match the existing compact single-line code style of `app.js`/`styles.css`. An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
9. **Tests per entry:** behavioral coverage for new helpers goes in the client-state suites, which eval the built script so new top-level helper functions are directly reachable — `tests/client-state.state.test.js` for pure scoring/date/text helpers, `tests/client-state.dom.test.js` for anything that needs `render()` and a document, `tests/client-state.shared.test.js` for shared-mode behaviour behind a stubbed `fetch`. DOM/a11y presence assertions go in `tests/static-check.mjs`. **Each test file opens with a `TRAP` comment describing its harness's sharp edges — read it before adding assertions to that file.** Copy must not trip the banned-strings assertion in `static-check.mjs` (no "Hard mode", "Super hard mode", "pull-up mode", "Record send pyramid", "Balanced week bonus").
10. **Bookkeeping:** set `Status: In progress — date` when starting; on completion set `Status: Done — date` and put the commit subject plus any deviations in `Notes:`, and update the queue index above. If an entry cannot be completed inside these rules, set `Status: Blocked — reason` and move on — do not bend the rules. **Archiving:** a finished entry stays here only until the next iteration — before you start yours, move any entry already marked `Done` (heading through its `---` separator, **verbatim**) into the **current** archive file, the one `IMPROVEMENTS.md` marks `current` at the top of its index, and drop its index line here. `IMPROVEMENTS.md` itself is only the index over `docs/archive/`; never paste an entry into it. If the current file is at the cap `tests/docs-check.mjs` enforces, start the next pass file and mark it current instead of raising the cap. This file therefore carries at most one `Done` entry, the one completed in the current commit, and `tests/docs-check.mjs` enforces that too.

---

## Tone rule for entries 24 onward

This app runs on a real crew's shared data, and everyone in it sees the same board. **No entry in this pass adds a nudge, a reminder, or a prompt to participate.** Concretely:

- **Surface what people did, never what they didn't.** No absence counts, no laggard lists, no "you haven't logged" copy, no per-person zero-week callout, no streak-loss warnings, no "still time to log today" prompts.
- **Aggregating does not launder it.** A crew-wide participation figure is the same nudge with the names filed off, and is equally out of scope. An earlier draft of this queue proposed one; it was dropped rather than reworded, which is why the numbering skips 39.
- **Nothing new opens, appears, or speaks on its own.** Every surface these entries add is reached by a tap, and the one persistent element (entry 28's undo bar) carries its own dismissal and clears when the user moves on.
- New information is reported **only where the user went looking for it** — their own card, their own feed, the diagnostics they opened.

Each entry restates the part of this that binds it in its own `### Do not`. This block is a shared statement of intent, not a numbered rule, and it renumbers nothing.

---

## 51. Caption the grade pyramid

Status: Done — 2026-08-01
Notes: Commit `Caption the grade pyramid`. `pyramidCaption(rows)` sits next to `heatmapCaption()`/
`trendCaption()`: `''` for an empty list, otherwise `` `${total} graded send${total===1?'':'s'} ·
hardest ${rows[0].grade}` `` with `total` summed across every row's `count`. `<p id="pyramidSummary"
class="hint"></p>` sits inside `#gradePyramidCard`, immediately after `#gradePyramid`, as a sibling
(never inside it, so the existing `#gradePyramid`/`#personPyramid` `innerHTML` parity assertion
stays true). `renderPyramid()` sets it from the `rows` it already computed and clears it to `''` on
the hidden-card path, exactly as `renderHeatmap()` does with `#heatmapSummary`. index.html 150,365 →
150,693 bytes (+328, 75.3% of the 200,000-byte budget). `npm test`: 5/5 suites.
Deviations: None.

### Why
Entry 36 gave the heatmap and both trend charts a visible plain-text caption (`#heatmapSummary`, `#trendSummary`, `#youTrendSummary`) because a `role="img"` `aria-label` is read by a screen reader and by nobody else. `#gradePyramid` was left out, so the card shows bars whose totals a sighted user has to add up by eye.

### Requirements
- `src/app.js` — a pure `pyramidCaption(rows)` in the shape of `heatmapCaption()`/`trendCaption()`: `''` for an empty list, otherwise a sentence naming the total number of graded sends and the hardest grade. `gradePyramid()` already returns rows hardest-first, so the hardest is `rows[0].grade`; pluralise `send`/`sends` the way the existing captions do.
- `src/index.template.html` — `<p id="pyramidSummary" class="hint"></p>` immediately after `#gradePyramid`, still inside `#gradePyramidCard`, mirroring where `#heatmapSummary` sits. No new CSS: `.hint` is global.
- `renderPyramid()` sets it from the same `rows` it already computed and clears it to `''` on the hidden-card path, exactly as `renderHeatmap()` does with `#heatmapSummary`.
- The caption is a **sibling** of `#gradePyramid`, never inside it: `tests/client-state.dom.test.js` asserts `#gradePyramid`'s `innerHTML` equals `#personPyramid`'s, and putting the caption inside would break that.

### Tests
- `tests/client-state.state.test.js`: `pyramidCaption([])` is `''`; a one-send list is singular; a multi-grade list names the total across grades and `rows[0].grade` as the hardest.
- `tests/client-state.dom.test.js`: with graded climbs, `#pyramidSummary` carries the caption and `#gradePyramid` still matches `#personPyramid`; with none, the card hides and `#pyramidSummary` is empty.
- `tests/static-check.mjs`: `#pyramidSummary` sits between `#gradePyramid` and the close of the card, and `#gradePyramid` keeps its `role="img"` and `aria-label`.

### Do not
Add `aria-live` (the pyramid changes only when the user logs a climb, and `#todayRemaining` is the You card's one live region — see the comment above `renderYouPace()`); change `gradePyramid()`, `pyramidRow()`, or the existing `aria-label`; caption `#personPyramid` — that is a different surface and a later entry's business.

---

## 52. Let a climb carry a note

Status: Todo

### Why
`activityMarkup()`'s climb branch already renders `x.note` after the grade, and `validateActivity()` in `src/apps-script.js` already accepts and stores a note on every activity type. But `updateRecordPreview()` hides `#noteFields` whenever the selected type is `climb`, and `draftActivity()` sets `base.note` only for the bounty and fall-through branches — so the note a climb row is built to display can never be written. "V4, first try on the slab" has nowhere to go.

### Requirements
- `src/app.js` — `updateRecordPreview()` stops hiding `#noteFields` for climb, so the note field is available for all four types. `draftActivity()` sets `base.note=noteValue()` on the climb branch alongside `base.hardestGrade`.
- `src/index.template.html` — drop `hide` from `#noteFields`'s class list, since the pre-script default type is `climb` and the field now belongs there. Its `<label for="activityNote">` stays exactly as it is (`tests/static-check.mjs` requires it).
- `submitActivity()` already sends `note:draft.note||''` and already clears `#activityNote` after a save — do not touch it.
- **No carve-out from rule 2 is needed or granted.** `src/apps-script.js` and `src/schema.json` already permit a ≤120-character note on any type; `noteValue()` already truncates to 120. Do not edit either file.

### Tests
- `tests/client-state.dom.test.js`: with the climb radio selected, `updateRecordPreview()` leaves `#noteFields` unhidden and `draftActivity()` carries the typed note; the grade field is still shown for climb and still hidden for the other types; switching to exercise and back keeps the note field visible.
- `tests/client-state.state.test.js`: `activityMarkup()` on a climb with both a grade and a note renders both, in that order, escaped (the existing escaping assertion at the climb row already covers injection — extend, do not replace).

### Do not
Make the note required, raise the 120-character cap, or prefill it; add a note to the activity-type picker copy; touch `src/apps-script.js`, `src/schema.json`, or `src/scoring.json` (rule 2); add a localStorage key (rule 4).

---

## 53. Show a crewmate's weekly points in their card

Status: Todo

### Why
`personalWeeklyTrend(nameLower,today)` already computes any climber's week-by-week points, and `#youTrendCard` renders it for the signed-in user through `trendColumns()`/`trendAria()`. A crewmate's card (`#personModal`) shows rank, records, breakdown and pyramid — every static figure — but no week-over-week shape, so the one view that shows whether someone is building or coasting exists only for yourself.

### Requirements
- `src/app.js` — `personSummary()` adds one field, `trend` is taken; call it `weeks:personalWeeklyTrend(key,today)`. Adding a field is safe: every existing assertion reads `personSummary()` by named field.
- `src/index.template.html` — inside `#personModal`, after `#personRecords` and before the existing `Grade pyramid` heading: `<h3 class="person-head">Weekly points</h3><div class="trend-scroll"><div id="personTrend" class="trend" role="img" aria-label="Weekly points"></div></div>`. No new CSS — `.trend-scroll`, `.trend` and `.person-head` are all global.
- `renderPersonCard()` fills `#personTrend` with `trendColumns(data.weeks)` and sets its `aria-label` from `trendAria()` the way `renderYouTrend()` does; with no rows it emits the same `<p class="hint">` fallback shape the card's other empty sections use. Reuse `renderPersonCard()`'s existing `set()` closure rather than a second `querySelector` ladder.
- Sequence: this entry and entry 54 both add a section to `#personModal`. Take them in order — 54 assumes this section is already the one between `#personRecords` and the pyramid.

### Tests
- `tests/client-state.dom.test.js`: `openPersonCard()` for a climber with logs across two weeks fills `#personTrend` with the same markup `#youTrend` holds for that same person, and a climber with no logs gets the hint fallback rather than an empty box.
- `tests/client-state.state.test.js`: `personSummary().weeks` deep-equals `personalWeeklyTrend()` for the same name and day — the card reads the shared helper, not a second implementation.
- `tests/static-check.mjs`: `#personTrend` carries `role="img"` and an `aria-label`, sits inside a `.trend-scroll`, and falls between `#personRecords` and `#personPyramid` in document order.

### Do not
Add a heatmap, a projection, or a pace line to the card; compare the person to you, to the crew, or to a crew average; add `aria-live` to a dialog that only exists because the user tapped a name; change `personalWeeklyTrend()`, `trendColumns()` or `trendAria()`.

---

## 54. Show a crewmate's most recent entries in their card

Status: Todo

### Why
The Crew feed mixes everyone together and its filter narrows by category, not by person. Entry 48 made a feed row open that climber's card, but the card then answers everything except the obvious follow-up question — what has this person actually been logging lately.

### Requirements
- Depends on entry 53: this section goes **below** `#personTrend`, as the last section of `#personModal`.
- `src/app.js` — a pure `personRecent(nameLower,limit=5)` filtering `logs` by `nameKey()`, sorted newest-first by `date` then `createdAt` exactly as `claimedBounties()` sorts, sliced to `limit`. Each row is `{label,value}`: `label` is the entry's title — `CAT_LABELS[x.type]` plus the grade when there is one, or the bounty title resolved through the `x.bountyTitle || bountyById(x.bountyId).title || 'Bounty'` chain `claimedBounties()` already uses — and `value` is `fmtDay(x.date)` (rule 6: never `new Date()` for a challenge date).
- `src/index.template.html` — `<h3 class="person-head">Recent activity</h3><div id="personRecent" class="records"></div>` as the final section of `#personModal`. No new CSS: `.records` is global.
- `renderPersonCard()` renders the rows with the existing `recordsRow(label,value)` and falls back to the same `<p class="hint">` shape as the card's other sections.
- **Do not reuse `activityMarkup()` here.** With `allowDelete` false it emits `<button class="climber" data-person=…>` rows, and `#personModal` sits outside the `#crew` element the single delegated handler is bound to, so those buttons would render dead. `recordsRow()` is the right shared helper for a two-column list.

### Tests
- `tests/client-state.state.test.js`: `personRecent()` returns at most `limit` rows, newest first with the `createdAt` tiebreak; resolves a bounty title through the same fallback chain; includes the grade on a climb; excludes other people; returns `[]` for a blank name and for an empty log.
- `tests/client-state.dom.test.js`: `openPersonCard()` fills `#personRecent` with `records-row` markup naming that person's newest entry and not a crewmate's, and a person with no entries gets the hint fallback.
- `tests/static-check.mjs`: `#personRecent` is the last section of `#personModal`, uses the `records` class, and the built script's `renderPersonCard()` line does not call `activityMarkup()`.

### Do not
Add a delete button, a "show more", a second delegated listener, or a `data-person` hook inside the dialog; show points on these rows (the breakdown above already carries them); pad the list to `limit` with placeholder rows, or add copy about days with nothing logged (tone rule).

---

## 55. Say which protocol version this build expects

Status: Todo

### Why
`unpackRemote()` rejects any payload whose version is not in `SUPPORTED_API_VERSIONS`, and `renderSync()` then reports `Apps Script update required` plus the code `RTS-REFRESH-VERSION`. Neither says which version this build wants, so the organizer reading the diagnostics has no number to deploy against. `testConnection()` does name one, but as the literal string `deploy v11`, which will quietly go stale the next time the version bumps.

### Requirements
- `src/app.js` — `renderSync()` appends the expected version to the existing `#diagnosticDetail` sentence, using `[...SUPPORTED_API_VERSIONS][0]`, the same expression `saveSetup()` and `exportData()` already use. Append only: `tests/client-state.shared.test.js` asserts `detail.indexOf('Protocol')===0`, so the `Protocol …` clause must keep leading.
- `testConnection()`'s outdated-script message derives its version from that same expression instead of the hard-coded `deploy v11`.
- No template change and no new element — this is text inside `#syncDiagnostics`, which already exists and already has its `role="status"`.

### Tests
- `tests/client-state.shared.test.js`: after a successful sync, `#diagnosticDetail` still starts with `Protocol` and now also names the expected version; after a payload with an unsupported version, the diagnostics name the expected version while `#diagnosticCode` still reads `RTS-REFRESH-VERSION`; `testConnection()` against a stale payload names the same version rather than a literal.
- `tests/static-check.mjs`: the built script contains no `deploy v11` literal.

### Do not
Change `SUPPORTED_API_VERSIONS`, `unpackRemote()`, `syncFailureCode()`, or the `RTS-REFRESH-*` codes; touch `src/apps-script.js` or `src/schema.json` (rule 2); add a second `aria-live` region; surface the endpoint URL — the shared suite asserts it never appears in the diagnostics.

---

## 56. Date the export snapshot

Status: Todo

### Why
`exportData()` always names the download `road-to-send-export.json`. Take a snapshot before a risky change and another after, and the second either overwrites the first or lands as `road-to-send-export (1).json`; either way the folder listing says nothing about when each was taken. The timestamp exists only inside the file, which is exactly where you cannot see it while choosing between two of them.

### Requirements
- `src/app.js` — `exportData()` builds the filename from `challengeToday()`: `road-to-send-<YYYY-MM-DD>.json`. Rule 6 applies: `challengeToday()`, never `new Date()`, so a shared-mode export is named for the Sheet's day the same way every other date in the app is.
- The blob's contents, including its `exportedAt` ISO timestamp, are unchanged; so is the `URL.revokeObjectURL()` cleanup in the `finally` block and both toast messages.
- One line changes. Do not restructure the try/catch — entry 31's assertions cover a blocked `click()` and a failing `Blob` separately, and both must keep passing.

### Tests
- `tests/client-state.shared.test.js`: extend the existing export test so the anchor stub records `download` alongside `href`, and assert the filename carries `challengeToday()` and still ends in `.json`; the success and both failure paths keep their current assertions unchanged.

### Do not
Add a time-of-day, a person's name, or a counter to the filename; change the export payload, its `version` field, or the `mode` field; add a localStorage key (rule 4); prompt anyone to take a snapshot.

---
