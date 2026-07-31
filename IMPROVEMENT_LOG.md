# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 45 — Chart your own weeks on the You tab — Done — 2026-07-31
- 46 — List the bounties you have claimed — Todo
- 47 — Start the grade select where you left it — Todo
- 48 — Open a crewmate's card from the Crew feed — Todo

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

## 45. Chart your own weeks on the You tab

Status: Done — 2026-07-31
Notes: Commit `Chart your own weeks on the You tab`. `personalWeeklyTrend(nameLower,today)` is
`weeklyTrend()`'s week walk with one line changed: instead of pre-summing the `weeks` map into a
per-week crew total it reads `weeks.get(key+'|'+wk)||0` straight out of the map `computeCredits()`
returns, which is the same key shape `weekTrend()` and `personalRecords()` already index by. It
carries `weeklyTrend()`'s four guards verbatim (unparseable `startDate`/`tripDate`/`today`,
inverted window, `today` before the start) plus two the entry asked for — a blank `nameLower`, and
`!logs.some(x=>nameKey(x)===key)` for a person with nothing logged — so the "nothing logged" case
returns `[]` rather than a row of zeros, which is what lets the card hide. Rows are the same
`{week,label,points}` shape, so `trendCaption()` consumes them unchanged. `weeklyTrend()` itself is
untouched, and a test asserts the crew chart still sums both climbers while the personal one counts
three points. `renderYouTrend()` mirrors `renderHeatmap()`/`renderPyramid()`: `classList.toggle(
'hide',!rows.length)`, empty the container and the caption when hidden, and it is called from
`render()` immediately after `renderHeatmap()`. Template: one `<article id="youTrendCard" class=
"card hide">` after `#heatmapCard` — the last card on the You panel, so every existing You-panel
order assertion is untouched — wrapping `<div id="youTrend" class="trend" role="img" aria-label=
"Your weekly points">` in the existing `.trend-scroll`, with `#youTrendSummary` beneath it. **No CSS
change at all**: reusing `trend-scroll`/`trend`/`trend-col`/`trend-bar`/`trend-label` means the
horizontal scroll, the bar geometry and the `prefers-reduced-motion` kill-switch all apply as they
stand, which is what "reuse the existing trend bar CSS rather than adding a second visual language"
asked for. index.html 145,995 → 147,510 bytes (+1,515, 91.6% of the 161,000-byte budget). Tests: 20
assertions in `tests/client-state.state.test.js` (one row per challenge week across the same span
`weeklyTrend()` charts, the W1..Wn labels, the row shape, per-week points checked against
`computeCredits().weeks` directly, another climber's entries staying out, the crew chart unchanged,
nothing-logged/blank-name/before-start/unparseable-today/blank-today/missing-start/missing-trip/
inverted-window all returning `[]`, the window capped at the week of today, and a logged-nothing
week appearing as a plain zero row); 14 in `tests/client-state.dom.test.js` (card hidden with no
entries, opening once something is logged, a column per week, the caption written by
`trendCaption()`, a repaint drawing the same bar count rather than a second set, and switching to a
climber with nothing logged closing and emptying it again); six in `tests/static-check.mjs` for the
`#heatmapCard` → `#youTrendCard` order, `role="img"` with a non-empty `aria-label`, the reused
`.trend-scroll` wrapper, the caption following its chart, and both new helper functions. Verified
the suite bites by mutating the built script six ways — zeroing the personal weeks, dropping
`renderYouTrend()` from `render()`, removing the empty-person guard, pinning the card open, making
the repaint append rather than assign, and deleting the card from the markup — each of which failed
the DOM suite, the state suite or `static-check`. Deviations: (1) the entry forbids changing "the
Crew tab's chart", and `renderTrend()` was still edited — its bar markup and its aria-label list
were lifted into two pure helpers, `trendColumns(rows)` and `trendAria(rows)`, that both charts now
call. The Crew chart's rendered output is byte-identical (its own DOM assertions still pass
untouched); duplicating ~300 characters of bar markup was the alternative, and rule 6 asks for small
pure helpers rather than a forked copy. `weeklyTrend()` itself, and what the Crew chart draws, are
unchanged. (2) `Object.keys()` in the state suite hands back a **host-realm** array that no
`deepEqual` against a literal inside the vm template can match — the row-shape assertion compares
`.sort().join('|')` instead, with a comment saying why. (3) Rule 10 archiving: entry 44 was moved
verbatim into `docs/archive/entries-41-onward.md` (the file `IMPROVEMENTS.md` marks current) and its
index line dropped; the lifted block was string-matched back out of the archive — exactly one
occurrence, gone from the log, heading at the start of its own line — and entry 43 above it was
confirmed intact and unsplit.

### Why
`weeklyTrend(today)` builds week-by-week bars from `computeCredits(logs)` across the whole crew, and the Crew tab renders them. An individual only ever gets `weekTrend(name)`, which is a single up/down/even arrow against last week. So the app can show the crew's shape over the whole challenge but shows one person only whether this week beat last week — and the per-week numbers for one climber are already in the same `computeCredits()` output.

### Requirements
- `src/app.js` — a pure helper `personalWeeklyTrend(nameLower,today)` returning the same row shape `weeklyTrend()` returns, restricted to one person. Derive it from the maps `computeCredits(logs)` returns (rule 6); never re-derive scoring math and never call `new Date()` for challenge dates — use `challengeToday()`, `weekKey()` and `parseDateOnly()` as `weeklyTrend()` does.
- Return `[]` when the person has nothing logged, when the config dates are unparseable, or when `today` precedes `config.startDate` — matching `weeklyTrend()`'s existing guards rather than inventing new ones.
- `src/index.template.html` — a card on the You panel after `#heatmapCard`, so the existing You-panel order assertions keep passing. It carries `role="img"` with an `aria-label` naming the per-week figures, and decorative bars are `aria-hidden="true"` (rule 7).
- Reuse `trendCaption()` for the text caption beneath it, as `#trendSummary` does on the Crew tab, and reuse the existing trend bar CSS rather than adding a second visual language.
- Hide the card when the helper returns `[]`, the way `renderPyramid()` and `renderHeatmap()` already toggle `hide` on their cards.

### Tests
- `tests/client-state.state.test.js`: the helper returns one row per challenge week for a person with entries spread across weeks; totals for a week match what `computeCredits()` credits that person for it; a person with nothing logged returns `[]`; a blank or unparseable date returns `[]`; another climber's entries never appear in the result.
- `tests/client-state.dom.test.js`: the card is hidden for a climber with no entries and populated for one with entries; a repaint does not duplicate the bars.
- `tests/static-check.mjs`: presence assertions for the card and chart ids, `role="img"` and a non-empty `aria-label`, and an order assertion `id="heatmapCard"` → the new card id.

### Do not
Change `weeklyTrend()` or the Crew tab's chart; compare the person against anyone else or against the crew average; render a week they logged nothing as a callout rather than simply a zero-height bar (tone rule — no absence counts); add a new localStorage key; animate the bars in JavaScript.

---

## 46. List the bounties you have claimed

Status: Todo

### Why
`bountyWeekProgress()` knows how many bounty points this week have been credited against the weekly cap, and entry 41 added a preview of what the coming days will offer. Nothing shows what you actually claimed. The bounty rows in the feed are interleaved with every other activity, so reconstructing "which bounties have I done" means scrolling the whole log and reading each row's title.

### Requirements
- `src/app.js` — a pure helper `claimedBounties(nameLower)` returning that person's bounty entries newest-first as `{date,label,note}`, resolving each title through `x.bountyTitle` then `bountyById(x.bountyId)` with the same fallback chain `activityMarkup()` already uses, and labelling the day with `fmtDay()`.
- `src/index.template.html` — a collapsible section under `#bountyWeek` and above `#youEmptyState`, opened by a `type="button"` toggle carrying `aria-expanded` and `aria-controls`. **Closed by default, rendering nothing until opened**, exactly as entry 41's preview does; the render function empties the container whenever it is closed.
- Follow entry 41's precedent for state: a module-level open/closed flag is the source of truth and the render writes `aria-expanded` from it, rather than reading the attribute back (the DOM harness cannot observe it).
- Reuse the existing bounty row visual language; the toggle keeps `min-height:44px` (rule 7); expand/collapse is CSS-only (rule 7).

### Tests
- `tests/client-state.state.test.js`: the helper returns only bounty-type entries for the named person, newest-first; resolves a title from `bountyId` when `bountyTitle` is absent; falls back cleanly for an unknown `bountyId`; returns `[]` for someone with no claims; never includes another person's claims.
- `tests/client-state.dom.test.js`: the container is empty until the toggle runs; opening lists the claims; a repaint keeps an open list open; closing empties it again.
- `tests/static-check.mjs`: presence assertions for the container and toggle ids, `aria-expanded` on the toggle, and an order assertion `id="bountyWeek"` → the new toggle id.

### Do not
Add claim buttons or change `claimBounty()`'s same-day rule; show which bounties were *not* claimed, or a claimed-out-of-total figure (tone rule — surface what people did, never what they didn't); list another person's claims here; open the section by default; change `src/scoring.json` (rule 2).

---

## 47. Start the grade select where you left it

Status: Todo

### Why
`#hardestGrade` resets to its first option every time the Record form repaints. A climber logging three sessions in a week re-picks the same grade from an eighteen-entry list each time, on a phone, at the gym. The information needed to do better is already in `logs`.

### Requirements
- `src/app.js` — a pure helper `lastLoggedGrade(nameLower)` returning the `hardestGrade` of that person's most recent climb entry, or `''` when they have none or the stored value is not in `SCORING.grades`. Order by the same date/`createdAt` comparison `activityMarkup()` uses so "most recent" means one thing in this app.
- Apply it only when the Record form is populated for a climb and the field is otherwise at its default — never overwrite a grade the user has already picked in the open form.
- This is a default, not a memory: no localStorage key (rule 4), so it derives from `logs` on each populate and follows the person selected in `recordingFor`.

### Tests
- `tests/client-state.state.test.js`: returns the most recent climb's grade; ignores exercise, mobility and bounty entries; returns `''` for a person with no climbs; returns `''` for a grade absent from `SCORING.grades`; is unaffected by another person's climbs.
- `tests/client-state.dom.test.js`: populating the Record form for a climber with history preselects their last grade, and a grade already chosen in the open form is not overwritten by a repaint.

### Do not
Add a localStorage key (rule 4); prefill the note, the date, or the bounty select; change `SCORING.grades` or anything in `src/scoring.json` (rule 2); surface copy about how long since the last session, or anything else framed around not logging (tone rule).

---

## 48. Open a crewmate's card from the Crew feed

Status: Todo

### Why
Entry 20 made leaderboard rows open a per-person card, wired through a single delegated `closest('[data-person]')` handler and `openPersonCard()`. The Crew feed names a person on every row and none of them are tappable, so the same gesture works in one list and silently does nothing in the other.

### Requirements
- `src/app.js` — the Crew feed's name element carries `data-person` with the same value the leaderboard rows use, so the **existing** delegated handler opens the card. Add no second listener and no new handler function.
- The name becomes a `type="button"` (or otherwise reaches a 44px target, rule 7) and keeps visible focus via the site's `:focus-visible` (rule 7). Escape the name through `esc()` as the surrounding markup already does.
- Only the Crew feed changes. The You feed lists one person's own entries, where a card of themselves adds nothing.
- `src/styles.css` — reuse the existing tappable-name styling from the leaderboard rather than adding a second one.

### Tests
- `tests/client-state.dom.test.js`: Crew feed rows carry `data-person` matching the entry's climber, and the You feed's rows do not; calling `openPersonCard()` with that value populates `#personTitle`.
- `tests/static-check.mjs`: an assertion that the built script emits `data-person` for the Crew feed rows.
- Note for the implementer: the delegated handler cannot be fired from the DOM harness — the element stub has no `closest()` and its listeners are no-ops (see the TRAP comment in `tests/harness.js`). Assert the emitted attribute and call `openPersonCard()` directly rather than trying to simulate the tap.

### Do not
Add a second delegated listener or duplicate `openPersonCard()`; make You feed rows tappable; add delete affordances to Crew rows (entry 29 made that feed read-only); change `personSummary()` or what the card shows.
