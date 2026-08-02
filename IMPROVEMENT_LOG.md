# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 91 — Guard the five live regions entry 83 left unguarded — Done — 2026-08-01
- 92 — Hide the bottom-nav glyphs from the screen reader, and keep focus on the chip you tapped — Todo
- 93 — Break a long note inside the claimed-bounty row — Todo
- 94 — Key the heatmap's columns with weekday letters — Todo
- 95 — Mark the bounties you already claimed inside the Record tab's select — Todo
- 96 — Cut render()'s avoidable rescoring — Todo
- 97 — Re-index the archive and correct the stale figures in the loop docs — Todo

Entries 1–40 shipped and now live under `docs/archive/`, together with five backfilled stubs (B1–B5) for feature commits that shipped without an entry. `IMPROVEMENTS.md` indexes them by title. Entry numbers never restart.

**63 was withdrawn, not shipped**, and like 39 its number is retired rather than reused. It put a visible point total on each weekly trend bar and forbade an SVG; entry 74 replaces those bars with an inline SVG curve, so shipping 63 first would have built markup for 74 to delete. The need behind it was real — a `title` tooltip never appears on the phones this crew uses — so 74 carries it as a requirement instead.

## Rules for implementers (read before every entry)

**Before you start.** Implement the **first** entry whose `Status:` is `Todo`, top to bottom; skip `Done`, `Blocked`, and anyone else's `In progress`. If no entry is `Todo`, stop and report "queue empty — no Todo entries" without inventing, re-doing, or reopening work. Never work from `IMPROVEMENTS.md` or anything under `docs/archive/` — that is closed, shipped history. Read an archived entry only to answer a specific question about how something already shipped, and read the one pass file that holds it rather than all of them. The numbered rules below keep their numbers permanently; entries cite them by number, so never renumber them.

1. **This app is LIVE.** Real crew data lives in a shared Google Sheet and in users' localStorage. Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change (`index.html` stays at the repository root).
2. **Edit only** `src/app.js`, `src/index.template.html`, `src/styles.css`, and test files. **Never** edit `index.html` directly, and **never** touch `src/apps-script.js`, `src/schema.json`, or `src/scoring.json` — those three are the shared browser/backend contract, and any change there forces an API version bump and an organizer redeploy. They are **out of scope for log-driven entries**: they change only in an organizer-coordinated task that bumps the API version, gets its own entry, and ships the redeploy (see B4/B5 in `IMPROVEMENTS.md` for what happens when that pairing is skipped). An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
3. **After editing:** run `npm run build`, then `npm test` (all must pass). Commit the regenerated `index.html` together with your `src/` and test changes. Never weaken or delete an existing test assertion **as a side effect of making your change pass** — that is what this rule exists to stop. An entry that *deliberately removes a feature* may retire that feature's assertions, but only if its own `### Requirements` names each assertion being retired and says why, the same explicit carve-out rules 2 and 8 allow; absent that carve-out this is a hard limit and rule 10 applies. Retiring an assertion for a feature that still exists is always forbidden. `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`. `tests/size-check.mjs` caps `index.html` at a byte `BUDGET`: raise `BUDGET` deliberately in a log entry that explains the growth — never as a side effect of another change.
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



## 91. Guard the five live regions entry 83 left unguarded

Status: Done — 2026-08-01
Notes: Commit `Guard repeated live-region writes`. Archived entry 90. index.html 156,244 → 156,480 bytes (+236 bytes, 92.0% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
Entry 83 added `setText()` (`src/app.js:138`) so a live region only announces when its text actually changed, and routed `#rawPreview`, `#creditPreview`, `#diagnosticTitle`, `#diagnosticDetail` and `#diagnosticCode` through it. Five more writes inside `aria-live="polite"` regions were left unguarded, and every one of them fires on **every** `render()`:

- `#todayRemaining` — `role="status" aria-live="polite"` (`src/index.template.html:27`), written as `remainEl.textContent=copy` (`src/app.js:80`). The comment at `src/app.js:81` calls this the You card's only live region.
- `#goalPace` and `#goalProjection` (`src/index.template.html:59`), both written at `src/app.js:114`.
- `#configNotice` (`src/index.template.html:22`), `notice.textContent=…` at `src/app.js:114`.
- `#undoText` inside `#undoBar` (`src/index.template.html:80`), written at `src/app.js:167`.

`render()` runs on identity change, both leaderboard toggles, every filter chip, Show more, save, delete, undo, disconnect and every sync. So tapping "Bounties", then "Overall", then a filter chip re-reads "Behind pace by 12 pts · ~4 pts/day to hit the goal" and the whole remaining-today sentence three times each, verbatim — exactly the defect entry 83 exists to remove.

The same region has a second, larger source of churn. `setMeter('#recordMeter',…)` (`src/app.js:53`, called from `:140`) unconditionally rewrites `style.gridTemplateColumns`, `innerHTML` (eight `<i>` nodes) and the `aria-label` on a `role="img"` element that sits **inside** `<div class="preview" role="status" aria-live="polite">` (`src/index.template.html:52`). `init()` binds `updateRecordPreview` to the note field's `input` event (`src/app.js:185`), so typing a 40-character note performs 40 rebuilds and 40 inline-style writes inside a live region.

### Requirements
- `src/app.js` only, plus tests. No markup changes and no visible change for a sighted user — this entry only stops redundant writes.
- Route the five writes above through the existing `setText()` helper (`src/app.js:138`). Do not write a second helper.
- Give `setMeter()` (`:53`) and `setSegmentedMeter()` (`:54`) the same early-return shape: when the points value **and** the label both match what the element was last given, leave the DOM untouched. Keep the guard cheap and local — compare against what is already in the DOM or a single cached value per element; do not add a new module-level cache keyed by anything that can grow.
- The guards must be idempotent and safe on first render, when the element is empty (rule 6).
- Entry 83's `### Do not` forbids removing live regions or adding new ones. This entry does neither: the regions and their markup stay exactly as they are. `tests/static-check.mjs:139,195,196,199` pin their existence — guard the writes, never the markup.

### Tests
- `tests/client-state.dom.test.js`: for each of the five regions, calling `render()` twice with unchanged data leaves the node untouched on the second pass (assert via a write counter or a mutation-detecting stub in the style the suite already uses for entry 83's regions), while a genuine change still updates the text.
- `tests/client-state.dom.test.js`: `updateRecordPreview()` called twice with an unchanged draft does not rewrite `#recordMeter`'s `innerHTML` or its `aria-label`; changing the activity type or date still rebuilds it.
- Read the `TRAP` header at the top of `tests/client-state.dom.test.js` before adding these — the harness's sharp edges around `render()` and the stub document are described there (rule 9).

### Do not
Do not remove, rename or relocate any live region, and do not add one. Do not change any of the copy in these regions. Do not switch a region from `polite` to `assertive`. Do not make the meter stop updating when its value genuinely changes — the guard is on redundant writes only. Tone rule: this entry adds no new announcement of any kind; announcing less is the entire point.

---

## 92. Hide the bottom-nav glyphs from the screen reader, and keep focus on the chip you tapped

Status: Todo

### Why
Two rule 7 defects, both in controls a keyboard or screen-reader user touches constantly.

**The nav glyphs are read aloud.** `src/index.template.html:66` ships `<button id="navYou" …><span>●</span>You</button>`, `<span>＋</span>Record` and `<span>♟</span>Crew`. None of the three spans is `aria-hidden="true"`, so the primary navigation announces as "black circle You", "plus sign Record" and "black chess pawn Crew". Worse, all three `<section>`s use `aria-labelledby` pointing at those buttons (`src/index.template.html:20`, `:42`, `:57`), so the three landmark regions inherit the glyph names too. Rule 7 names this case explicitly, and `.brand` (`src/index.template.html:18`) and the category chips (`src/app.js:80`) already do it correctly — the bottom nav is the outlier.

**Tapping a filter chip throws focus to the top of the document.** `renderFeedChips()` (`src/app.js:161`) rebuilds its container's `innerHTML` wholesale, `render()` calls it for both rows (`src/app.js:114`), and `setFeedType()` (`src/app.js:162`) ends in `render()`. So activating a chip destroys the very button that was activated: `document.activeElement` falls back to `<body>`, a keyboard user must tab from the top of the page to reach the next chip, and the `aria-pressed` change is never announced because the node carrying it no longer exists. Both `#feedFilter` (You) and `#crewFeedFilter` (Crew) are affected.

### Requirements
- `src/index.template.html`, `src/app.js` and `src/styles.css` if needed, plus tests.
- Add `aria-hidden="true"` to the three glyph `<span>`s in the bottom nav (`src/index.template.html:66`). Do not change the glyphs, the visible labels, or the `aria-current` handling.
- After `renderFeedChips()` re-renders a row, restore focus to the chip carrying the newly selected `data-feed-type` in that same row, but **only when focus was inside that row before the re-render** — `render()` runs for many reasons, and a sync or a save must never steal focus from wherever the user actually is.
- `restoreFeedFocus()` (`src/app.js:155`) is the working precedent for re-finding an element after a re-render and focusing it; follow its shape rather than inventing a second mechanism. `data-feed-type` (`src/app.js:161`) gives the selector.
- The stub harness cannot observe focus (`tests/harness.js:7-12`), so put the decision — which chip should receive focus, or none — in a small pure helper that the state suite can call directly, exactly as `nextFocusIndex()` (`src/app.js:154`) is tested at `tests/client-state.state.test.js:911-914`.
- `tests/static-check.mjs:106-108` and `:118-119` pin the chip markup and both `renderFeedChips(...)` call sites as exact text. Extend those assertions rather than reshaping the call signature (rule 5).

### Tests
- `tests/static-check.mjs`: each of the three bottom-nav glyph spans carries `aria-hidden="true"`; the visible labels "You", "Record" and "Crew" are unchanged; the three sections still use `aria-labelledby`.
- `tests/client-state.state.test.js`: the new pure helper returns the selected chip's type when focus was in that row and returns nothing when it was not.
- `tests/client-state.dom.test.js`: after `setFeedType()`, the selected chip in the affected row carries `aria-pressed="true"`, and the other row is untouched.

### Do not
Do not move focus on any render that the user did not initiate from within that chip row — a background sync must not pull the caret. Do not convert the chips to links, change their order, or alter `data-feed-type` values. Do not remove the glyphs from the nav; hide them from assistive technology only. Do not add a new focus-management helper when `restoreFeedFocus()`'s pattern fits. Tone rule: this entry announces nothing new and adds no copy.

---

## 93. Break a long note inside the claimed-bounty row

Status: Todo

### Why
Entry 82 fixed the overflowing rows it found, changing `1fr` to `minmax(0,1fr)` on `.activity` and adding `.activity>div{min-width:0;overflow-wrap:anywhere}` (`src/styles.css:32`). It did not reach `.bounty-peek{display:grid;grid-template-columns:auto 1fr auto;…}` (`src/styles.css:24`), whose middle track is a bare `1fr` — a min-content floor — holding a `<span>` with neither `min-width:0` nor `overflow-wrap`.

`claimedRow()` (`src/app.js:71`) interpolates the user's own note straight into that cell: `<small>${esc(r.date)}${r.note?' · '+esc(r.note):''}…</small>`, and `noteValue()` (`src/app.js:134`) allows 120 characters. A pasted URL, or any long unbroken run, gives the middle track a min-content width of several hundred pixels inside roughly 264px of card, and the `+N` points column is pushed off the card entirely. Two surfaces show it: `#claimedList` on the You tab (`renderClaimed()`, `src/app.js:73`) and `#personClaimed` in the person dialog (`renderPersonCard()`, `src/app.js:112`) — and the dialog is `overflow:auto` (`src/styles.css:3`), so it reproduces entry 82's sideways-scroll symptom at roughly 242px of content width.

### Requirements
- `src/styles.css` only, plus tests. Append the new rule at the end of the file.
- Give `.bounty-peek` the same treatment entry 82 applied to `.activity`: a `minmax(0,1fr)` middle track, and `min-width:0;overflow-wrap:anywhere` on the cell that carries the note. Reuse the existing idiom — `.heatmap` (`:15`), `.activity>div` (`:32`) and `.person-cell strong` (`:7`) already use it.
- The fix must hold in both surfaces, `#claimedList` and `#personClaimed`, and at 320px.
- **Leave `button.bounty`/`.bounty` (`src/styles.css:3`) alone.** Those render catalog copy only, whose longest token is `Shoulder-focused` (16 characters, hyphen-breakable), so they are not at risk and are out of scope here.

### Tests
- `tests/static-check.mjs`: `.bounty-peek` declares a `minmax(0,1fr)` track and its note cell declares `min-width:0` and `overflow-wrap:anywhere`. Assert the exact compact text.
- `tests/client-state.dom.test.js`: a claimed bounty whose note is a long unbroken string still renders its points cell in both `#claimedList` and `#personClaimed`, and the note text is present in full.

### Do not
Do not truncate, ellipsise, clip or cap the note — entry 82's prohibition applies here: break the text, never hide it. Do not change `noteValue()`'s 120-character limit or anything in `claimedRow()`. Do not restyle `button.bounty`. Do not introduce a horizontal scroll wrapper; `tests/static-check.mjs:219` asserts the curve has none and the same principle holds here.

---

## 94. Key the heatmap's columns with weekday letters

Status: Todo

### Why
`renderHeatmap()` pads the grid so column one is Monday (`src/app.js:98`), but nothing on screen says so. The only per-cell identification is `title="Jul 12 · 3 pts"` on each `<i>` (`src/app.js:98`) — and `IMPROVEMENT_LOG.md:13` is the maintainer's own record that **a `title` never renders on the phones this crew uses**, which is why entry 63 was withdrawn and why entry 85 stripped the Bounty Hunter's tooltip. So on a phone the heatmap is thirty-odd anonymous squares: you can see how much, never when.

The card already carries a shade key (entry 62) and a caption (entry 36). The column axis is the last unlabelled dimension of the chart.

### Requirements
- `src/index.template.html` and `src/styles.css`, plus tests. No JavaScript is needed — the letters are static markup, because the grid's first column is always Monday.
- Add a seven-cell header row immediately above `#youHeatmap` inside `#heatmapCard` (`src/index.template.html:38`), reading Monday through Sunday.
- The row must line up with the grid exactly: mirror the three declarations from `.heatmap{grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;max-width:400px}` (`src/styles.css:15`). Append the new rule at the end of `src/styles.css`.
- Mark the row `aria-hidden="true"`. `#youHeatmap` already owns the graphic's text alternative through its `role="img"` and `aria-label` (`src/app.js:98`), and a screen reader must not read seven stray letters before it.
- Keep the letters small and muted enough not to compete with the cells; do not introduce a new colour token — reuse the existing muted token.
- Verify at 320px that seven letters fit their columns without wrapping or widening the card.
- `tests/static-check.mjs:85,89,214,215` use permissive `[\s\S]*` around this region and keep passing; the new assertion below is what pins the row's position.

### Tests
- `tests/static-check.mjs`: the weekday row sits immediately before `#youHeatmap` inside `#heatmapCard`, carries `aria-hidden="true"`, and holds exactly seven cells starting with Monday; its CSS rule declares the same seven-column template, gap and max-width as `.heatmap`.
- `tests/client-state.dom.test.js`: the heatmap's `aria-label` is unchanged by this entry — the row adds no text to the accessible name.

### Do not
Do not make the heatmap cells tappable or focusable. At 320px the cells compute to roughly 34px, under rule 7's 44px minimum, with no way to reach 44px across seven columns at that width — a tap-to-read heatmap cannot be built inside the accessibility rule, and this entry must not smuggle one in. Do not add a `title` tooltip anywhere, and do not treat the existing ones as the fix. Do not change the shade key, the caption, `heatLevel()`, or the Monday-based padding. Tone rule: label the axis only — do not annotate empty cells or count them.

---

## 95. Mark the bounties you already claimed inside the Record tab's select

Status: Todo

### Why
The You tab's bounty card marks each of today's bounties you have already claimed with "· claimed today" (`renderBounties()`, `src/app.js:75`, shipped as entry 61). The Record tab's select, which lists the same three bounties, does not: `populateBountySelect()` builds each option as `icon title · +points` with no marker (`src/app.js:136`). So the parity breaks at exactly the moment of choosing — you can see what you have claimed everywhere except in the control where you pick one.

Worth stating plainly, because it shapes the scope: a duplicate claim still scores against the weekly cap (`computeCreditsRaw`, `src/app.js:30`), and the existing submit guard (`src/app.js:149`) does not treat it as an error. This entry is informational parity, not a new restriction.

### Requirements
- `src/app.js` only, plus tests.
- In `populateBountySelect()` (`src/app.js:136`), append the same marker the You tab uses to any option already claimed. Reuse `claimedTodayIds(nameLower,today)` (`src/app.js:68`) — despite its name it takes any date, so pass the currently selected `recordDate()` (`src/app.js:133`) rather than assuming today. The select's own label already distinguishes today from a back-dated day.
- Use `currentTarget()` (`src/app.js:43`) for whose claims to check, so recording on someone else's behalf marks that person's claims and not your own.
- An `<option>` carries no styling hook, so the marker is plain text inside the option label. **Use the date-neutral word "claimed", not the You tab's "claimed today".** The select is date-aware: its label already reads "Bounties for Jul 30" when a past day is chosen (`src/app.js:136`), so a "claimed today" marker inside it would misstate when the claim happened. The You tab's card is always today-scoped and keeps its existing wording unchanged.
- Leave `#bountyHint`'s description behaviour (`src/app.js:140`) and the submit guard (`src/app.js:149`) exactly as they are.
- Preserve the existing selection-restoring behaviour: `populateBountySelect()` re-selects the previous value when it is still in the list, and that must keep working with the marker appended.

### Tests
- `tests/client-state.dom.test.js`: with one of today's three bounties already claimed by the current user, that option's text carries the marker and the other two do not; changing the record date to a day with no claims removes the marker; recording on behalf of another person marks that person's claims. Assert the previous selection still survives a repopulate.
- `tests/static-check.mjs`: no new `title` attribute is introduced by this entry.

### Do not
Do not disable, hide, reorder or remove a claimed option — a repeat claim is still allowed and still counts toward the Bounty Hunter tag. Do not change the submit guard or the scoring. Do not add a `title` tooltip. Do not reword the You tab's existing marker. Tone rule: mark only what someone **did** claim; add no "not yet claimed" marker, no count of unclaimed bounties, and no prompt to claim one.

---

## 96. Cut render()'s avoidable rescoring

Status: Todo

### Why
Rule 6 says `render()` runs often, so additions stay cheap. Three existing call sites are not, and two of them re-derive values `render()` is already holding. Measured on the stub DOM at 960 logs, 8 crew and 60 days (a phone pays more, since this excludes layout and HTML parsing): `render()` totals 23.2ms, of which `weeklyTrend()` is 5.1ms, `personalWeeklyTrend()` 4.6ms, `earnedThrough()` 2.8ms and `crewTitles()` 1.5ms.

- `momentumCurve()` (`src/app.js:101`) walks the **entire** `dayTotal` map once per challenge day — 60 days × ~480 entries ≈ 29k iterations — and `render()` calls it twice (`renderTrend()` `:106`, `renderYouTrend()` `:107`), with a third call from `renderPersonCard()`. It computes a rolling seven-day sum, which a single bucketing pass plus a sliding window does in O(days + entries).
- `earnedThrough()` (`src/app.js:100`) builds a filtered copy of the log and hands it to `computeCredits()`, which by design bypasses the memo when `entries!==logs` (`src/app.js:31`) — a **full re-score of every activity on every render**. It is exactly the sum of `model.dayTotal` entries whose date is on or before the cutoff, and `render()` already holds `model`.
- `crewTitles()` (`src/app.js:59`) calls `totalsModel()` a second time, on the same line where `render()` already has `model`.

### Requirements
- `src/app.js` only, plus tests. No visible change: every number on screen must be identical before and after.
- Rewrite `momentumCurve()` to bucket `dayTotal` by date once and slide a seven-day window across the challenge days. Keep it a pure helper with the same signature and the same return shape.
- Compute `earnedThrough()` from the `dayTotal` map instead of re-scoring a filtered copy. This reads the map `computeCredits()` returns — it must not re-implement or fork any scoring maths (rule 6). The weekly bounty cap and the per-day category dedup are already baked into `dayTotal`, which is why the sum matches.
- Pass the `model` `render()` already holds into `crewTitles()` rather than having it call `totalsModel()` again. Keep `crewTitles()` callable with its current behaviour from any other site that needs it.
- **Rule 3, named deliberately:** `tests/client-state.dom.test.js:122` and `:133` assert `creditRuns-runsBefore===2` ("one render scores the live log exactly twice"). Removing `earnedThrough()`'s derived-array call moves that constant to **1**. The comment at `:110-115` explains that the number rising means a new derived-array caller appeared; this entry moves it in the intended direction, so update the expected value and the surrounding comment to match. This is a strengthening, not a weakening: the assertion still pins an exact scan count. `tests/client-state.dom.test.js:138` (the preview costs exactly one scan) is untouched and must stay.
- Sequencing: this entry lands after entry 91, which adds guards inside `updateRecordPreview()` and the meter helpers. Do not revert those guards.

### Tests
- `tests/client-state.state.test.js`: `momentumCurve()` returns identical rows to the current implementation for a fixture spanning a full challenge, including the first six days where the window is partial, a day-one crew, and a crew with a single logged day.
- `tests/client-state.state.test.js`: `earnedThrough()` equals the sum of `dayTotal` at a range of cutoffs, including one where the weekly bounty cap binds and one where a category is logged twice in a day.
- `tests/client-state.dom.test.js`: the updated `creditRuns` assertion, plus a check that the crew and personal curves render the same points as before.

### Do not
Do not change any displayed value, curve shape, or caption. Do not fork, re-implement or inline any scoring maths — read the maps `computeCredits()` returns (rule 6). Do not add a new memo, cache or module-level map keyed by anything that grows with the log. Do not weaken the `creditRuns` assertions to "at most N" — keep them exact. Do not touch `computeCreditsRaw()`.

---

## 97. Re-index the archive and correct the stale figures in the loop docs

Status: Todo

### Why
`IMPROVEMENT_LOG.md:11` tells every implementer that `IMPROVEMENTS.md` "indexes them by title", and rule 10 tells them to look an entry up by reading "the one pass file that holds it". Both instructions currently fail for **41 of the 84 shipped entries**.

- `IMPROVEMENTS.md:10`, `:14` and `:15` are bare headings with no title bullets at all, so entries 41–84 cannot be found by title. The sections for entries 1–40 and B1–B5 do list every title, which is the working shape.
- `IMPROVEMENTS.md:10` labels the current file `entries-84-onward.md`, but that file's first heading is `## 83.` — the section label is off by one against its own contents.
- `IMPROVEMENT_LOG.md:11` still says only "Entries 1–40 shipped and now live under `docs/archive/`", which stopped being true 44 entries ago.
- `docs/loop-prompt.md:45` argues the loop must delegate because "one entry costs tens of thousands of tokens — `src/app.js` alone is 78 KB". `src/app.js` is now 88,160 bytes (86 KB). The argument gets stronger, but the number is wrong and drifts every entry.

### Requirements
- `IMPROVEMENTS.md`, `IMPROVEMENT_LOG.md:11` and `docs/loop-prompt.md`. **This entry takes an explicit carve-out from rule 2**, which allows only `src/app.js`, `src/index.template.html`, `src/styles.css` and tests. The carve-out is necessary because the defect *is* in those documents: the index an implementer is told to trust is wrong about half the archive, and no change to `src/` can fix that. No file under `src/` is touched, `index.html` is not regenerated by this entry, and `index.html`'s byte count does not change.
- Add title bullets for **every** `## N.` heading present in `docs/archive/` at the moment this entry runs, under that file's existing section in `IMPROVEMENTS.md`, matching the format the 1–40 sections already use. Take the titles verbatim from the headings.
- **Do not treat the ranges named here as the scope.** At proposal time the gap is entries 41–60, 61–82 and 83–84, but this entry is last in the queue and rule 10 archives each preceding `Done` entry as the queue drains — so by the time it runs, entries 85 through 96 will also be in the current pass file. Read `docs/archive/` and index what is actually there; a literal implementation of the proposal-time range would fail this entry's own test.
- Entries within `entries-61-onward.md` are stored out of numeric order, because rule 10 appends each finished entry verbatim. List the bullets in **numeric** order regardless, since the index exists to be scanned.
- Correct the `entries-84-onward.md` section label so it matches the file's actual contents (it starts at 83). Prefer relabelling to renaming the file — a rename would break `IMPROVEMENTS.md`'s existing section and `tests/docs-check.mjs`'s archive check for no benefit.
- Update `IMPROVEMENT_LOG.md:11` to state the real shipped range.
- Correct the `src/app.js` size figure in `docs/loop-prompt.md:45`. Phrase it so it does not need updating every entry.
- `tests/docs-check.mjs:45` already asserts every archive file has a section in the index, and `:49` asserts `IMPROVEMENTS.md` carries no `## N.` headings — bullet lines satisfy both. Confirm before editing.

### Tests
- `tests/docs-check.mjs`: every `## N.` heading across `docs/archive/*.md` has a matching title bullet in `IMPROVEMENTS.md`. This is the assertion that keeps the index honest as future passes are archived, and it is the substantive deliverable of this entry.
- `tests/docs-check.mjs`: `IMPROVEMENTS.md` still contains no `## N.` entry headings (the existing `:49` assertion, unchanged).

### Do not
Do not paste any entry body into `IMPROVEMENTS.md` — it is an index of titles over `docs/archive/`, and `tests/docs-check.mjs:49` enforces that. Do not edit, reorder or reformat any archived entry; archived text is closed history and stays verbatim. Do not rename any archive file. Do not raise `ARCHIVE_CAP` or `BUDGET`. Do not touch `src/`, and do not regenerate `index.html` in this commit. Do not restate the rules block in a third place — the point of this entry is fewer wrong copies, not more copies.

---
