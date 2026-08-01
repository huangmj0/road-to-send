# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 57 — Re-baseline the bundle budget for this queue — Done — 2026-08-01
- 58 — Caption the claimed bounty list — Todo
- 59 — Show a crewmate's claimed bounties in their card — Todo
- 60 — Announce the crewmate's grade pyramid — Todo
- 61 — Mark today's bounties you have already claimed — Todo
- 62 — Key the heatmap shades — Todo
- 64 — Say the size of the field next to a rank — Todo
- 65 — Stop promising a local delete cannot be undone — Todo
- 66 — Re-baseline the bundle budget for the rolling-window pass — Todo
- 67 — A rolling seven-day window — Todo
- 68 — Bounty Hunter counts the last seven days — Todo
- 69 — Three titles for the habits people keep — Todo
- 70 — On Fire and Apex Beast — Todo
- 71 — Retire the podium medals — Todo
- 72 — Recent, not Weekly — Todo
- 73 — The trend arrow reads the last seven days — Todo
- 74 — A daily momentum curve — Todo

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

## 57. Re-baseline the bundle budget for this queue

Status: Done — 2026-08-01
Notes: Commit `Re-baseline the bundle budget for this queue`. `tests/size-check.mjs`'s `BUDGET`
lowered 200,000 → 165,000; added a comment paragraph recording the measured 152,071 bytes on
`main` after entry 56, the +13..+1,515-byte range of entries 58–65's nearest archive analogues, and
the ~12,900-byte headroom that leaves. No `src/` change; `npm run build` produced no diff.
index.html unchanged at 152,071 bytes (92.2% of the new 165,000-byte budget). `npm test`: 5/5
suites.
Deviations: None.

### Why
`BUDGET` in `tests/size-check.mjs` is 200,000 bytes and `index.html` weighs 152,071 — the cap is 48,000 bytes above the artifact it guards, so it would not catch a change that doubled a card's markup. The comment on that constant says so itself: the 200,000 step was taken on maintainer instruction to buy a whole pass rather than to track the measured figure, and it asks the next budget entry to lower `BUDGET` back toward what `index.html` actually weighs. This is that entry, and it goes first so the tighter cap governs entries 58–65 rather than being set after they land.

### Requirements
- `tests/size-check.mjs` — `const BUDGET = 165000;`. This is the only change; the `readFileSync` measurement, the `console.log` line and the assertion message stay exactly as they are.
- Add a paragraph to the comment block above the constant, in the same voice as the two re-baselines already recorded there: measured 152,071 bytes on `main` after entry 56; entries 58–65 are eight small display entries whose nearest analogues in the archive cost between +13 and +1,515 bytes each, so ~12,900 bytes of headroom covers the pass with room for the worst case. Say that this step is a **reduction**, taken because a cap that only ratchets upward stops being a guard, and keep the standing instruction that the next budget entry re-measures rather than assuming.
- No `src/` change, so `index.html` does not change and `npm run build` is a no-op here. Run it anyway before `npm test` — rule 3 — and commit nothing but the test file if the build produces no diff.

### Tests
- `tests/size-check.mjs` is itself the test. `npm test` must print the new percentage line and pass; if it does not, the figure in the comment is wrong and the comment gets corrected rather than the cap raised.
- No assertion anywhere else changes.

### Do not
Raise `BUDGET` back, set it below the measured 152,071, or touch `ARCHIVE_CAP` in `tests/docs-check.mjs` — that is a different guard with its own rule. Do not bundle any user-visible change into this commit; a budget move that rides along with a feature is exactly what rule 3 forbids.

---

## 58. Caption the claimed bounty list

Status: Todo

### Why
Opening "Bounties you have claimed" gives a list of rows and nothing else. Entries 36 and 51 gave the heatmap, both trend charts and the grade pyramid a one-line plain-text caption that states the total underneath the graphic, because reading a total off a list of rows is work the app can do. The claimed list is the last of those surfaces without one: to know how many bounties you have claimed all challenge, or how many of those points actually counted after the weekly cap, you count rows and add up the `+N` column by hand.

### Requirements
- `src/app.js` — add a pure helper `claimedCaption(rows)` taking the array `claimedBounties()` already returns (items shaped `{date,label,note,base,credit}`). It returns `''` for an empty array, and otherwise a single string naming the number of claims and the credited total: `` `${n} claim${n===1?'':'s'} · ${points} point${points===1?'':'s'} counted` ``, where `points` is the sum of `credit` across the rows. Follow `heatmapCaption()`/`trendCaption()`/`pyramidCaption()`: pure, no DOM, no `new Date()` (rule 6).
- `src/index.template.html` — add `<p id="claimedSummary" class="hint"></p>` immediately after `<div id="claimedList" class="bounty-week hide"></div>`, inside the same bounty `<article>`. It sits before `#youEmptyState`, so the source-order assertion at `tests/static-check.mjs` line 124 keeps passing unchanged.
- `src/app.js` — `renderClaimed()` writes the caption. It already computes `rows` only when open; the caption follows the same contract as the list it captions: set `#claimedSummary`'s `textContent` to `claimedCaption(rows)` when `claimedOpen` is true, and to `''` on the closed branch that clears `box.innerHTML`. Guard the lookup (`const cap=document.querySelector('#claimedSummary');if(cap)…`) the way the rest of that function guards its elements.
- No new CSS: `.hint` is the class every other caption uses.

### Tests
- `tests/client-state.state.test.js`: `claimedCaption([])` is `''`; a two-row array totals both `credit` values and pluralises "claims"; a one-row array with `credit` 1 says "1 claim" and "1 point"; a row whose `credit` is below its `base` (weekly cap) contributes its **credit**, not its base.
- `tests/client-state.dom.test.js`: extend the existing entry 46 claimed-list block. While closed, `#claimedSummary` is `''`; after `toggleClaimed()` it names the claim count; a repaint keeps it; closing empties it again. Keep every existing assertion in that block, including `claimedBox.innerHTML===''` while closed — the caption is a separate element and must not put anything inside `#claimedList`.
- `tests/static-check.mjs`: `#claimedSummary` exists, follows `#claimedList` in source order, and a `function claimedCaption(` is present.

### Do not
Put the caption inside `#claimedList` (it would break the "renders nothing at all until it is opened" assertion), give it `aria-live` (it changes only on a tap the user made, and `renderClaimed()` runs on every `render()`), or state anything about bounties **not** claimed — no "0 of 3 today", no cap-remaining figure, no crew comparison. The tone rule binds here: this caption reports what the user did, in the panel they opened to look.

---

## 59. Show a crewmate's claimed bounties in their card

Status: Todo

### Why
Tapping a crewmate's name opens a card with their breakdown, records, weekly trend, pyramid and recent activity. Bounties appear there only as a number in the summary grid ("2 this week · 7 all time"), so you can see that someone claimed seven bounties and never which ones. Your own card has had that list since entry 46; the person card is the same information for someone else, and `claimedBounties()` already takes any name.

### Requirements
- **Sequencing:** entry 58 lands first and introduces `claimedCaption()`. This entry consumes it; if it is somehow missing, implement entry 58 first rather than writing a second caption helper.
- `src/app.js` — extract the claimed-row markup from `renderClaimed()` into a pure helper `claimedRow(r)` taking one `claimedBounties()` item and returning the existing `<div class="bounty-peek">…</div>` string **verbatim**, including the `🎯` icon, the `esc()` calls, the `· weekly bounty cap` suffix when `r.credit<r.base`, and the `+${r.credit}` cell. `renderClaimed()` then maps over it. This is the entry 30 pattern: one row shape, two owners.
- `src/index.template.html` — in `#personModal`, between `<div id="personBreakdown" class="breakdown"></div>` and `<h3 class="person-head">Personal records</h3>`, add `<h3 class="person-head">Bounties claimed</h3><div id="personClaimed" class="bounty-week"></div><p id="personClaimedSummary" class="hint"></p>`. It must go **there** and not after `#personPyramid`: `tests/static-check.mjs` line 184 pins the recent-activity section as the last one in the dialog, and line 180 pins records → trend → pyramid. Reuse `.bounty-week` and `.hint`; no new CSS.
- `src/app.js` — `renderPersonCard()` fills both. Compute the rows once from the card's own lowercased name (the same expression `personRecent(...)` is already called with), then `set('#personClaimed', rows.length?rows.map(claimedRow).join(''):'<p class="hint">No bounty claims yet.</p>')` using the local `set()` helper, and put `claimedCaption(rows)` in `#personClaimedSummary` via `textContent`. `renderPersonCard()` re-runs on every `render()` while the card is open, so keep it idempotent (rule 6).

### Tests
- `tests/client-state.dom.test.js`: with two climbers who have each claimed a bounty, `openPersonCard()` on one shows only that person's claim in `#personClaimed`, the other person's bounty title is absent, `#personClaimedSummary` names the count, and the markup contains `bounty-peek` but neither `data-claim-bounty` nor `data-del` — a crewmate's card is read-only. A person with no claims renders the plain empty state and an empty caption. Then assert the shared row: for the same climber, the string `renderClaimed()` puts in `#claimedList` equals the string `renderPersonCard()` puts in `#personClaimed`, the way entry 30 compares `#youBreakdown` with `#personBreakdown`.
- `tests/static-check.mjs`: `#personClaimed` and `#personClaimedSummary` exist and fall between `#personBreakdown` and `#personRecords` in source order; `function claimedRow(` is present; and `(script.match(/class="bounty-peek"/g)||[]).length` is exactly `2`, with a comment naming the two owners — `renderBountyWeek()` for upcoming days and `claimedRow()` for claims.

### Do not
Make a crewmate's claimed rows tappable or deletable, add a claim button inside the person card, or add a fourth copy of the `bounty-peek` markup. Do not report what a crewmate has not claimed, how far they are from the weekly cap, or how they compare to anyone — the tone rule allows this section only because it lists what that person did, in a card the viewer opened by tapping their name.

---

## 60. Announce the crewmate's grade pyramid

Status: Todo

### Why
`#gradePyramid` on the You panel is `role="img"` and `renderPyramid()` gives it an `aria-label` listing every grade and count. The identical chart in the person card, `#personPyramid`, is a bare `<div class="pyramid">`: no role, no label. A screen-reader user tapping a crewmate's name gets the summary grid, the breakdown bars and the trend chart announced, then reaches a block of unlabelled bars. Rule 7 requires the text alternative, and the label text already exists — it is inlined in `renderPyramid()`.

### Requirements
- **Sequencing:** entry 59 has already inserted a section into `#personModal` above the records heading. This entry touches only `#personPyramid`'s own attributes and the two render functions, so it applies cleanly on top.
- `src/app.js` — extract the label string `renderPyramid()` builds into a pure helper `pyramidLabel(rows)`, taking the `gradePyramid()` output. For a non-empty array it returns exactly what `renderPyramid()` produces today: `'Grade pyramid: '` followed by `` `${r.count} send${r.count===1?'':'s'} at ${r.grade}` `` joined with `', '`. For an empty array it returns `'Grade pyramid: no graded climbs yet'`, which is the case the person card has and the You card does not (that card hides itself when there are no rows).
- `renderPyramid()` calls `pyramidLabel(rows)` instead of building the string inline. Its behaviour must not change: it is only reached with a non-empty `rows`.
- `src/index.template.html` — `<div id="personPyramid" class="pyramid">` gains `role="img"` and a non-empty static `aria-label="Grade pyramid"`, matching how `#gradePyramid`, `#youTrend` and `#personTrend` are declared in the template and then relabelled from JS. Keep the element's closing `></div>` immediately followed by the Recent activity heading — `tests/static-check.mjs` line 184 pins that adjacency and `[^>]*` in it accommodates the added attributes.
- `src/app.js` — `renderPersonCard()` captures the element the existing `set('#personPyramid',…)` call returns and sets `aria-label` to `pyramidLabel(data.pyramid)`, exactly the way it already does for `#personTrend` with `personTrendLabel()`.

### Tests
- `tests/client-state.state.test.js`: `pyramidLabel([])` is the no-graded-climbs string; a two-row array lists both grades in order with singular/plural `send`/`sends` correct.
- `tests/client-state.dom.test.js`: the existing entry 30 block already asserts `youPy.innerHTML===personPy.innerHTML`; keep that assertion untouched — this entry changes attributes, not rows.
- `tests/static-check.mjs`: `id="personPyramid"` carries `role="img"` and a non-empty `aria-label`; `function pyramidLabel(` is present; and the literal `'Grade pyramid: '` appears exactly once in the script, so the label text has one owner.

### Do not
Add `aria-live` to the pyramid (it is a graphic, not a status), remove `aria-hidden="true"` from the decorative `<i>` fills inside `pyramidRow()`, or change `pyramidCaption()` — the visible caption from entry 51 and the text alternative are separate things and both stay. Do not put the label on the person card's rows instead of the container; `pyramidRow()` already labels each bar and is shared with the You panel.

---

## 61. Mark today's bounties you have already claimed

Status: Todo

### Why
The three bounty rows on the You card are one-tap claim buttons and look identical whether or not you have already claimed that bounty today. Bounties are not de-duplicated per day the way categories are — a second claim of the same bounty scores again until the weekly cap — so tapping one twice by accident is silent, and the only way to check what you already claimed today is to open the claimed list and read dates. The card that offers the claim should say what you already did with it.

### Requirements
- `src/app.js` — add a pure helper `claimedTodayIds(nameLower,today)` returning a `Set` of the `bountyId` strings that person logged on that date: filter `logs` for `x.type==='bounty'`, `nameKey(x)===nameLower` and `String(x.date).slice(0,10)===String(today).slice(0,10)`. Count every claim, credited or capped — this reports what was logged, not what scored.
- `src/app.js` — `renderBounties()` computes the set once (`claimedTodayIds(String(me).toLowerCase(),challengeToday())`) before mapping the daily list, and for a bounty already in the set appends ` · claimed today` to the row's existing `<small>` description text and the same suffix to the end of the row's `aria-label`.
- **The button markup is pinned.** `tests/static-check.mjs` line 143 matches `<button class="bounty" type="button"` followed by `data-claim-bounty=` and then `aria-label="Claim `. Keep the `class` attribute exactly `"bounty"`, keep `type="button"` in the same position, and keep `aria-label` starting with `Claim `. Put the new state in the text content, not in the class list — no `class="bounty claimed"`.
- The button stays enabled and stays a claim button. No new CSS, no new element, no change to `button.bounty`'s four-column grid.

### Tests
- `tests/client-state.state.test.js`: `claimedTodayIds` returns an empty `Set` for an unknown name; it includes a bounty claimed by that person on that date; it excludes the same bounty claimed by someone else, and the same person's claim on a different date; two claims of one bounty on the same day yield a set of size 1.
- `tests/client-state.dom.test.js`: extend the entry 11 bounty block. With no logs, `#todayBounties` contains no `claimed today`. After adding a `bounty` log for `me` with today's first bounty id and re-rendering, that row's markup carries `claimed today` while the other two rows do not, the row still carries `data-claim-bounty` and `aria-label="Claim `, and `claimBounty()` on it still preselects it on the Record form — every existing assertion in that block keeps passing.
- `tests/static-check.mjs`: `function claimedTodayIds(` is present. Do not add a second assertion about the button markup; line 143 already pins it and this entry's job is to keep it passing.

### Do not
Disable, hide, grey out or reorder a claimed row — the crew can claim a bounty twice and this entry does not change that. Do not add a "2 of 3 claimed" counter, a per-day cap figure, or anything naming a bounty the user has **not** claimed; the tone rule forbids the absence framing, and an aggregate of it is the same nudge. Do not touch `#bountyCapHint`, `claimedBounties()` or the weekly cap maths in `computeCreditsRaw()` (rule 6).

---

## 62. Key the heatmap shades

Status: Todo

### Why
The daily activity heatmap paints five shades from `heatLevel()`, and nothing on the page says what they mean. A darker square is more points, but how many is a guess, and the `title` tooltip that carries the real figure never appears on a touch device — which is what this crew uses. Entry 36 gave the heatmap a caption naming the best day; a shade key is the other half, and every other graphic on the page (`.trend` bars, `.breakdown` bars, `.pyramid` bars) carries its number in the row.

### Requirements
- `src/index.template.html` — inside `#heatmapCard`, between `<div id="youHeatmap" …></div>` and `<p id="heatmapSummary" class="hint"></p>`, add a static key: a container `<div id="heatmapLegend" class="heat-legend" role="img" aria-label="Shade key: lighter squares are fewer points, darker squares are more">`, holding the word `Less`, five `<i aria-hidden="true">` swatches carrying the existing classes `heat-cell heat0` through `heat-cell heat4`, and the word `More`. The `Less`/`More` words sit in `<span aria-hidden="true">` — the container's `aria-label` is the text alternative, so the key announces once, not seven times (rule 7).
- The key lives inside `#heatmapCard`, so it hides and shows with the card `renderHeatmap()` already toggles. **No JavaScript change at all** — this is template plus CSS only.
- `src/styles.css` — add one compact rule block in the existing style: `.heat-legend` is a flex row, small gap, `.hint`-sized muted text, right-aligned or left-aligned to match the card, with the swatches sized around 12px square and inheriting `.heat-cell`'s existing border-radius and colours. Do not restate the `heat0`–`heat4` background colours; reuse the classes. Match the file's single-line compact formatting — `tests/static-check.mjs` matches exact CSS text elsewhere and reformatting breaks unrelated assertions.
- Nothing here is interactive, so the 44px rule does not apply; keep it non-interactive.

### Tests
- `tests/static-check.mjs`: `#heatmapLegend` exists, carries `role="img"` and a non-empty `aria-label`, and falls between `#youHeatmap` and `#heatmapSummary` in source order — which also keeps line 62's existing heatmap/caption assertion true. Assert the five swatch classes `heat0`–`heat4` all appear inside the card, and that the legend's swatches are `aria-hidden="true"`.
- No client-state assertions: there is no new helper and no render path to exercise.

### Do not
Add a JS-driven legend, a hover-only tooltip, or a sixth shade; change `heatLevel()`'s thresholds or the `heat0`–`heat4` colours (the state suite pins the buckets at lines 336–344); or put the key on the Crew tab, where there is no heatmap. Do not caption it with anything about days with no points — "Less" is a scale label, and a count of blank days is the absence framing the tone rule rules out.

---

## 64. Say the size of the field next to a rank

Status: Todo

### Why
The You panel's "Crew rank" stat reads `#3`, and the person card's summary grid reads `Rank #3`. Third out of four and third out of twelve are different facts, and the app knows which it is — `totalsModel().sorted` is the ranked field — but never says. The number the crew looks at most is the one carrying the least context.

### Requirements
- **Sequencing:** entries 59 and 60 have already edited `renderPersonCard()` and `#personModal`. This entry changes the Rank cell's text only, so it applies on top of both.
- `src/app.js` — add a pure helper `rankLabel(rank,field)` returning `'—'` when `rank` is not a positive integer or `field` is smaller than `rank`, and otherwise `` `#${rank} of ${field}` ``.
- `render()` — the `#youRank` assignment becomes `rankLabel(rank,model.sorted.length)`; when `rank` is `0` (the signed-in climber is not in the field) `rankLabel` already yields `'—'`, which is the current behaviour, so the surrounding ternary can go.
- `personSummary()` — add `field:model.sorted.length` to the object it returns; `renderPersonCard()`'s Rank cell becomes `cell('Rank',rankLabel(data.rank,data.field))`. `data.rank` is `i+1` and `i` came from that same array, so the two always agree.
- `field` is the size of the ranked roster: everyone in `config.crew` plus anyone who appears in `logs`, which is exactly what `totalsModel()` already assembles. It does not depend on who has logged anything.

### Tests
- `tests/client-state.state.test.js`: `rankLabel(3,12)` is `'#3 of 12'`; `rankLabel(1,1)` is `'#1 of 1'`; `rankLabel(0,5)`, `rankLabel(-1,5)` and `rankLabel(3,2)` are all `'—'`. Also assert `personSummary()` returns a `field` equal to the crew size for a known name, and `null` for an unknown one as it does today.
- `tests/client-state.dom.test.js`: with a two-person crew both holding logs, `#youRank` reads `#1 of 2` for the leader; the existing entry 20 assertion that `#personSummary` contains `#1` keeps passing, and one added assertion checks it now also contains `of 2`. A crew member with no logs is still ranked — `totalsModel()` seeds `sorted` from every `config.crew` name, so in a two-person crew where the other has logs they read `#2 of 2`, not `—`. `—` is reserved for a signed-in name that is absent from the field entirely, which is the `rank` of `0` case above.
- No new `tests/static-check.mjs` assertion: the stat-grid order assertion at line 160 already covers `#youRank`'s placement and this entry does not move it.

### Do not
Report how many of the field have logged anything, how many are inactive, or any figure that changes with participation — `model.sorted.length` is roster size and must stay roster size. The tone rule's aggregation clause is what this entry lives closest to: a crew-wide participation figure is out of scope even with the names removed. Do not add rank to the leaderboard rows (they already show `#N` in the rank column) or to `shareSummary()`.

---

## 65. Stop promising a local delete cannot be undone

Status: Todo

### Why
The confirm dialog carries a fixed line of copy: "This cannot be undone." Since entry 28 that has been false in local mode — deleting your own entry raises an undo bar that puts the row back. The same dialog is also reused by `disconnect()`, where the line is false in a second way: switching to local mode leaves the shared Sheet untouched and is reversible by reconnecting. A confirmation that overstates the stakes on the one path that is reversible teaches the crew to distrust the one that is not.

### Requirements
- `src/index.template.html` — give the existing `<p class="hint">This cannot be undone.</p>` inside `#confirmModal` an id: `<p id="confirmNote" class="hint">This cannot be undone.</p>`. Its position between `#confirmBody` and `.confirm-actions` does not change.
- `src/app.js` — `askConfirm(title,message,action,okLabel,note)` takes a fifth argument and writes it: set `#confirmNote`'s `textContent` to `note`, and toggle the element's `hide` class on an empty or omitted `note`. Guard the lookup the way the function's other three lookups are guarded.
- `requestDelete()` passes `endpoint?'This cannot be undone.':'You can undo this from the bar that appears.'` — shared-mode deletes go to the Sheet and `renderUndo()` clears `lastDeleted` whenever `endpoint` is set, so the shared branch keeps today's copy exactly.
- `disconnect()` passes `''`, which hides the note; its own body message already says the shared Sheet data remains untouched.
- No new CSS: `.hide` and `.hint` both exist.

### Tests
- `tests/client-state.dom.test.js`: in local mode (`endpoint=''`), `requestDelete()` leaves `#confirmNote` naming the undo bar and not hidden; with `endpoint` set to a URL it reads "cannot be undone"; `disconnect()` hides it. The existing entry 26 assertions on `#confirmBody` naming the activity, the grade and the person must keep passing untouched, as must the entry 28 undo assertions that follow.
- `tests/static-check.mjs`: `#confirmNote` exists and sits between `#confirmBody` and `id="confirmCancel"` in source order; the literal `This cannot be undone.` appears in the script (the shared-mode branch) as well as in the markup.

### Do not
Remove the confirmation, change `#confirmTitle`, `#confirmOk`'s label, or the `askConfirm`/`confirmProceed`/`pendingDelete` flow that `tests/static-check.mjs` lines 35–37 and 131 pin; add a native `window.confirm` (line 44 forbids it); or make the undo bar appear in shared mode — entry 29 keeps the Crew feed read-only and `renderUndo()` clearing `lastDeleted` when `endpoint` is set is deliberate. Do not add a "you have N seconds to undo" countdown; nothing here appears or speaks on its own.

---

## 66. Re-baseline the bundle budget for the rolling-window pass

Status: Todo

### Why
Entry 57 lowered `BUDGET` in `tests/size-check.mjs` from 200,000 to 165,000 against a measured 152,071 bytes, and its comment earmarked the resulting headroom for entries 58–65 — eight small display entries. Entries 67–74 are a different shape: two of them delete live UI and give bytes back, one replaces a div-bar chart with inline SVG and takes them. The cap that governs a pass has to be set before the pass and from a fresh measurement, which is the standing instruction entry 57 left behind.

### Requirements
- `tests/size-check.mjs` only. **Measure `index.html` on `main` after entries 58–65 have merged** — read the number off the file, do not carry 152,071 forward, and do not assume the queue shipped in the order it was written.
- Set `BUDGET` to that measurement plus headroom for entries 67–74. Size the headroom from the pass itself rather than a flat percentage: 67 adds a helper and a map with no markup; 68 and 72 are label changes; 69 and 70 add a tile grid and its CSS; 73 changes a comparison; 74 swaps `trendColumns()`'s div output for inline SVG. Entries 70 and 71 **remove** markup, CSS and JS, so this pass is not monotonic growth — take those credits into account rather than budgeting for additions alone.
- Add a paragraph to the comment block above the constant, in the voice of the two re-baselines already recorded there: the measured figure and what it was measured after, what this pass adds and what it removes, and the standing instruction that the next budget entry re-measures rather than assuming.
- No `src/` change, so `npm run build` is a no-op. Run it anyway before `npm test` (rule 3) and commit nothing but the test file if the build produces no diff.

### Tests
- `tests/size-check.mjs` is itself the test. `npm test` must print the new percentage line and pass. If it does not, the figure in the comment is wrong and the comment gets corrected — the cap does not get raised to fit.
- No assertion anywhere else changes.

### Do not
Set `BUDGET` below the measured size of `index.html`, raise it beyond what this pass needs "to be safe", or touch `ARCHIVE_CAP` in `tests/docs-check.mjs` — that is a different guard with its own rule. Do not bundle any user-visible change into this commit; a budget move riding along with a feature is exactly what rule 3 forbids.

---

## 67. A rolling seven-day window

Status: Todo

### Why
Every time-boxed surface in the app runs on calendar weeks through `weekKey`. That makes recency unreadable: on a Monday, "this week" is decided by a single day of data, and the weekly trend chart's rightmost bar is always a partial week, so it reads as a decline until Sunday whatever anyone did. Entries 68–74 move the app's **state** surfaces — the ones answering "what is true right now" — to a trailing seven-day window, which always has seven days of evidence behind it. This entry lands the two pieces they all need and changes nothing on screen.

### Requirements
- `src/app.js` — pure helper `windowStart(today,days=7)`: `parseDateOnly(String(today||'').slice(0,10))`, return `''` if it does not parse, otherwise step back `days-1` and return `localDate(...)`. This is the `step()` idiom `streakInfo()` already uses (`src/app.js:90`) and the day walk in `heatmapDays()` (`src/app.js:86`). It never reads the clock — `today` is always an argument (rule 6).
- Callers compare ISO date strings directly (`d>=start&&d<=today`), the way `dateInChallenge()` does at `src/app.js:24`. No new date parsing at the call sites.
- `computeCreditsRaw()` gains **one additive returned map**, `dayTotal`, keyed `name|date`, holding every point credited to that person that day — category credit, bounty credit, and the balanced-day bonus — uncapped. Add to it at each of the three places credit is awarded: in the bounty branch before its `continue`, in the category branch beside `addMeter`, and in the balanced-day bonus branch. Return it alongside the existing six maps.
- This map is necessary because nothing carries that figure today: `dayMeter` skips bounty points entirely (the bounty branch `continue`s before `addMeter`) and clamps to `DAILY_MAX`; `info` holds per-entry credit but not the `+2` bonus, which is added straight to `weeks`/`totals` and belongs to no entry; `weeks` has the true total but is keyed by `weekKey`, which is the thing this pass stops using.
- **Additive only.** No existing map's values change, no existing helper changes behaviour, and nothing renders differently. Rule 3's carve-out is not needed here and must not be invoked.

### Tests
- `tests/client-state.state.test.js`: `windowStart('2026-07-13')` is `'2026-07-07'` — seven days inclusive, not eight; `windowStart('2026-07-13',1)` is `'2026-07-13'`; `windowStart('')` and `windowStart('not-a-date')` are `''`; a month boundary (`windowStart('2026-08-02')` is `'2026-07-27'`) proves the arithmetic is not string slicing.
- `tests/client-state.state.test.js`: for a crafted day holding a climb, an exercise log, a mobility log and a bounty, `dayTotal` for that `name|date` equals category points **plus** the balanced-day bonus **plus** the bounty's credit — and is strictly greater than `dayMeter` for the same key, which is the omission this map exists to fix. A bounty credited `0` by the weekly cap contributes `0`. Summing `dayTotal` across the days of one calendar week equals the existing `weeks` value for that week and person, which pins the new map against the old maths.
- No `tests/client-state.dom.test.js` or `tests/static-check.mjs` assertions: nothing renders differently.

### Do not
Change `dayMeter`, `weeks`, `totals`, `info`, `bountyWeekCount` or `bountyTotal` — a rolling window is a reading of the credit engine, never a fork of it (rule 6). Do not clamp `dayTotal` to `DAILY_MAX`; the clamp on `dayMeter` is a display decision for the day meter, and copying it here would silently drop bounty points. Do not call `new Date()` anywhere in this entry, do not add a `windowEnd()` helper (the end is always `today`), and do not change any user-visible string.

---

## 68. Bounty Hunter counts the last seven days

Status: Todo

### Why
🏹 is decided on calendar weeks: `totalsModel()` reads `bountyWeekCount` at `weekKey(challengeToday())` (`src/app.js:42`), so on a Monday the tag reflects one day of claims and it resets to nobody every seven days regardless of what the crew is doing. The tag and the six-point weekly cap are already independent in the engine — `bountyUsed` enforces the cap while `bountyWeekCount` feeds the tag, and the tag counts every claim whether or not it scored, which `tests/client-state.state.test.js:65` pins. So the tag's window can move without touching scoring at all.

### Requirements
- **Sequencing:** entry 67 lands `windowStart()` first. This entry consumes it; if it is missing, implement 67 rather than inlining the date arithmetic.
- `src/app.js` — `totalsModel()`'s `bounties` field counts that person's `type==='bounty'` logs whose date falls in `[windowStart(challengeToday()), challengeToday()]`, instead of reading `credits.bountyWeekCount` at the week key. Every claim counts, credited or capped, exactly as `bountyWeekCount` does today — this is a window change, not a counting change. `hunters`/`huntCount` and the `maxB>0` guard are untouched, so nobody holds the tag when every count is zero.
- `src/index.template.html` — the card's `<h2>Bounty Hunter</h2>` becomes `<h2>Titles</h2>` and its `<span class="hint">This week</span>` becomes `Last 7 days`. **Keep `#bountyHunter`** as the first row inside the card; it is asserted in `tests/static-check.mjs`, and renaming ids is churn across the suites for no user-visible benefit. Entries 69 and 70 fill the rest of this card.
- **The weekly bounty cap stays on calendar weeks.** `SCORING.weeklyBountyCap` lives in the frozen `src/scoring.json` and the cap is real scoring maths — making it rolling would retroactively rescore live crew points (rules 1 and 2). `#bountyCapHint` keeps its "this week" wording and `bountyWeekProgress()` keeps reading `weekKey`. The cap resetting on Monday while the tag rolls is deliberate; the two surfaces must never both say "week".
- `weekReviewModel()` keeps its own calendar-week hunter (`src/app.js:50`) — it reviews a bounded week and needs a bounded figure.

### Tests
- `tests/client-state.state.test.js`: with `challengeToday()` stubbed, a claim exactly seven days old counts toward `bounties` and one eight days old does not; a claim capped to `0` credit still counts, keeping the existing "every completion counts toward Bounty Hunter" guarantee at line 65 true under the new window; two people tied both appear in `hunters`; `huntCount` is `0` and `hunters` empty when nobody has claimed in the window. Every existing assertion in that block keeps passing.
- `tests/client-state.dom.test.js`: `#bountyHunter` still renders the holder line after a rolling-window claim, and the You tab's `#bountyCapHint` still reports the **calendar-week** figure — assert both in the same test so the deliberate split is pinned, not merely documented.
- `tests/static-check.mjs`: the card's heading reads `Titles`, its hint reads `Last 7 days`, and `#bountyHunter` still exists inside it.

### Do not
Touch `bountyUsed`, `SCORING.weeklyBountyCap`, or anything in `computeCreditsRaw()`'s bounty branch that decides credit (rule 2 — `scoring.json` is the browser/backend contract, and changing it forces an API version bump and an organizer redeploy). Do not make `#bountyCapHint` or the claimed list say "last 7 days"; they report the cap, which is weekly. Do not rename `#bountyHunter`, and do not change `weekReviewModel()`.

---

## 69. Three titles for the habits people keep

Status: Todo

### Why
The app names exactly one thing a person can be: Bounty Hunter. Points reward showing up and the balanced-day bonus rewards spreading it around, but nothing names the crewmate who climbs four times a week or the one who actually does their mobility. Those are the habits the trip is training for, and the data to see them is already in the credit engine.

### Requirements
- **Sequencing:** entries 67 and 68 land first — `windowStart()` and the Titles card. This entry adds tiles to that card.
- **Threshold, not leader.** A title is held by anyone who clears a fixed bar in the window, and several people can hold the same one. A "most days" rule was considered and rejected: with three categories it would hand out three tags every week regardless of what anyone did, and in a quiet week a single mobility log would take a title. A fixed bar means holding one says something specific.
- `src/app.js` — pure helper `categoryDays(nameLower,type,today)`: count that person's logs of that `type` whose date is inside `[windowStart(today), today]` **and** whose `computeCredits(logs).info` credit is greater than zero. A credited entry *is* a distinct day, because the engine credits only the first log of each category per day (`daySeen`, `src/app.js:28`) — so this counts days without needing a second day-set. It is the same derive-from-`info` pattern `bountyWeekProgress()` uses at `src/app.js:55`.
- `src/app.js` — pure helper `crewTitles(today)` returning one row per title: `{id,glyph,title,scope,holders,detail}`. The three category titles and their bars live in a module-level constant in `app.js` — **not** `scoring.json` (rule 2); keeping them here is what lets a later entry retune them without an organizer redeploy:

  | Title | Glyph | Category | Bar |
  |---|---|---|---|
  | Rock Hound | 🪨 | `climb` | 4 of the last 7 days |
  | Gym Rat | ⚙️ | `exercise` | 4 of the last 7 days |
  | Yogi | 🌿 | `mobility` | 5 of the last 7 days |

  Mobility's bar is higher deliberately: it is the cheapest thing in the app to log — one point, one tap — so a three-day bar would be close to automatic.
- Glyphs are **not** `CAT_ICONS` (🧗 💪 🧘). Those already mean "logged a climb" throughout the log and bounty cards, and reusing them would read as an activity rather than a title.
- `src/index.template.html` / `src/styles.css` — the Titles card holds a tile grid: `grid-template-columns:repeat(auto-fit,minmax(150px,1fr))`, which wraps to one column at 320px and needs no media query. Each tile carries the glyph, the title name, the holders (or `—`), and the qualifying figure (`4 of last 7 days`) so the title explains itself. The window label reuses the existing `.champ-scope` treatment — 10px, weight 800, uppercase, `.06em` tracking, `--muted` — because the window is the genuinely confusing part of this feature, and encoding it in the design beats a paragraph of copy. Held tiles take the `--orange-tint`/`--orange-ring` fill already used by `.me-row`; unheld tiles stay flat. Match the stylesheet's compact single-line formatting.
- Names and figures use `--ink`/`--muted`. The glyph and the tile fill carry identity — never colour the text by standing.
- The container carries `aria-live="polite"`; decorative glyphs are `aria-hidden="true"` with the title name in text (rule 7).

### Tests
- `tests/client-state.state.test.js`: `categoryDays` counts a climb logged on each of four days in the window as `4`; a second climb the same day does not raise the count (it is credited `0`); a log eight days old is excluded; another person's logs are excluded; an unknown name is `0`. `crewTitles()` gives Rock Hound holders at exactly four climb days and none at three; Yogi needs five mobility days and not four; two people over the bar both appear as holders; every title reports empty holders on an empty roster.
- `tests/client-state.dom.test.js`: with a crafted roster, the Titles card renders a tile per title, a held tile names its holder and its count, an unheld tile renders `—`, and a repaint is idempotent (`render()` runs often — rule 6). The `#bountyHunter` assertions from entry 68 keep passing.
- `tests/static-check.mjs`: the tile container exists inside the Titles card with `aria-live="polite"`; the grid rule and the tile classes are styled in CSS; `function categoryDays(` and `function crewTitles(` are present; and none of 🧗 💪 🧘 appears in the titles constant.

### Do not
Put the thresholds in `src/scoring.json` (rule 2), award a title to whoever has the most rather than to everyone over the bar, or rank the holders of one title against each other. Do not write copy about a title nobody holds, how far anyone is from a bar, or how many days someone has left — the tone rule forbids the absence framing and aggregating it does not launder it; an unheld tile shows `—` and says nothing. Do not add a localStorage key (rule 4), a media query where `auto-fit` does the work, or a fourth category.

---

## 70. On Fire and Apex Beast

Status: Todo

### Why
`#leaderChampions` (built inside `render()`, `src/app.js:105`) already computes both of the standings this crew cares about — `lead('week')` and `lead('total')` — and renders them as an unnamed "🏆 Points · This week · Overall" line above the leaderboard. The figures are right; they just have no names, and they sit in a panel that duplicates what the leaderboard's own ordering already shows. Naming them turns two anonymous numbers into titles and lets the panel retire, which is how this pass adds six titles while leaving the Crew tab simpler than it found it.

### Requirements
- **Sequencing:** entry 69 lands the tile grid. This entry adds two tiles to it and removes a panel.
- `src/app.js` — `crewTitles()` gains two standing titles, computed from `totalsModel().sorted` exactly as `lead()` does today (highest value, ties shared, nobody holds it when the top value is `0`):

  | Title | Glyph | Metric | Scope label |
  |---|---|---|---|
  | On Fire | 🔥 | most points in the last 7 days, summed from `dayTotal` | `LAST 7 DAYS` |
  | Apex Beast | 👑 | most points all challenge (`totals`) | `ALL CHALLENGE` |

  Each tile's detail line carries the value (`214 pts`), so retiring the panel loses no information.
- The two scope labels are why entry 69 put the window into the tile design: this card now holds titles on two different windows, and the reader has to be able to tell at a glance.
- **Retire `#leaderChampions`.** Remove the markup from `src/index.template.html`, the block that builds it in `render()`, and the `.champions`/`.champ-line`/`.champ-who`/`.champ-val` rules from `src/styles.css`. **Keep `.champ-scope`** — entry 69 reuses it for the tile window labels. Its 🎯 Bounties line goes with it: that information is Bounty Hunter, already a tile since entry 68.
- **Rule 3 carve-out, sanctioned by the maintainer.** This entry deliberately removes a feature, so it retires that feature's assertions: the `#leaderChampions` presence and source-order assertions in `tests/static-check.mjs`, the `.champions`/`.champ-line` CSS assertions, and the champions-content assertions in `tests/client-state.dom.test.js`. Name each one in the commit message. Every other assertion in those files keeps passing untouched, and no assertion for a feature that still exists may be weakened.

### Tests
- `tests/client-state.state.test.js`: On Fire holders are whoever has most points in the window, ties shared, empty when everyone is at `0`; a bounty claimed in the window counts toward On Fire — the case `dayMeter` would have missed and `dayTotal` exists to catch. Apex Beast matches the top of `totalsModel().sorted`. Someone leading all challenge but quiet for eight days holds Apex Beast and not On Fire; that separation is the point of having both.
- `tests/client-state.dom.test.js`: both tiles render with holder and value; `#leaderChampions` is gone from the document; the leaderboard's own rows and ordering are unchanged.
- `tests/static-check.mjs`: `.champ-scope` is still styled and `.champions{`/`.champ-line{` are not; `#leaderChampions` does not appear in the template.

### Do not
Re-derive either standing — consume `totalsModel().sorted` (rule 6). Do not keep a trimmed champions panel "just for the values"; the values live on the tiles now, and leaving both is the duplication this entry exists to remove. Do not remove the leaderboard, its rank column, or its scope toggle — entry 72 handles the toggle. Do not report anyone's distance from a leader.

---

## 71. Retire the podium medals

Status: Todo

### Why
`podiumMedals()` (`src/app.js:44`) puts 🥇🥈🥉 beside names in the leaderboard, dense-ranked on whichever metric the toggle is showing. That is a third encoding of an ordering the table already states twice — the rows are sorted, and each carries its numeric rank, which is the unambiguous version of the same fact and does not stop at three. With 👑 Apex Beast and 🔥 On Fire naming the top of both scopes as of entry 70, the medals are the redundant one, and a row that can carry 🥇 plus a title glyph plus the 🏹 span is exactly the clutter this pass set out to reduce.

### Requirements
- **Sequencing:** entry 70 lands first. Removing the medals before the titles exist would briefly leave the top of the leaderboard unmarked.
- `src/app.js` — remove `podiumMedals()` and the `.medal` spans from the leaderboard row markup. The rows keep their sort order, their numeric rank column and the `.me-row` highlight.
- `src/styles.css` — remove the `.medal` rule.
- The 🏹 span beside names stays. It marks a title, not a rank, and it is the one per-row glyph that survives.
- **Rule 3 carve-out, sanctioned by the maintainer.** This entry deliberately removes a feature and retires its assertions: the `podiumMedals()` unit assertions in `tests/client-state.state.test.js` (including the dense-ranking and tie cases), the medal-in-row assertions in `tests/client-state.dom.test.js`, and the `.medal{` CSS assertion in `tests/static-check.mjs`. Name each in the commit message. Assertions about row order, rank text, the 🏹 span and `.me-row` are **not** covered by this carve-out and must keep passing.

### Tests
- `tests/client-state.dom.test.js`: rendered leaderboard rows contain no 🥇, 🥈 or 🥉 and no `class="medal"`, on both toggle scopes; the rank column still reads `#1`, `#2`, `#3` in order; the 🏹 span still renders beside its holder; `.me-row` still marks the signed-in climber.
- `tests/static-check.mjs`: `podiumMedals` does not appear in the built script and `.medal{` is not styled — the removal is asserted, not merely performed.

### Do not
Remove the rank column, the row ordering, the 🏹 span, `.me-row`, or the scope toggle. Do not replace the medals with a different per-row glyph — the point is fewer marks in the row, not different ones. Do not touch `totalsModel().sorted`, which the whole leaderboard reads (rule 6).

---

## 72. Recent, not Weekly

Status: Todo

### Why
The leaderboard's scope toggle reads `Weekly` / `Overall`, and after entry 68 the word is wrong: the card above it reports the last seven days while this button still scopes to a calendar week. Two controls on one screen using "week" for two different spans is worse than either span on its own.

### Requirements
- **Sequencing:** entry 67 lands `windowStart()` and `dayTotal`.
- `src/app.js` — the toggle's recent scope sums each person's `dayTotal` across `[windowStart(challengeToday()), challengeToday()]` instead of reading `weeks` at the current week key. Ordering, ties and the metric toggle (`Points`/`Bounties`) are unchanged.
- `src/index.template.html` — the button label becomes `Recent`. `.leader-toggles` puts **four** buttons on one row at 320px, so "Last 7 days" does not fit; `Recent` is the same width as `Weekly` and opposes `Overall` cleanly. Where there is room — the card hint and the tile scope labels — the span is spelled out in full.
- **`#leaderWeekBtn` keeps its id**, as do `#weeklyTrend` and `#weeklyTrendCard`. They are asserted in `tests/static-check.mjs`; renaming ids is churn across the suites for no user-visible benefit. Labels change, ids stay.
- The toggle's `aria-label="Time range"` group stays; the button's `aria-pressed` behaviour is unchanged.

### Tests
- `tests/client-state.dom.test.js`: with the recent scope selected, a person whose only points are eight days old sorts below one who scored inside the window — the assertion that proves the window moved and not just the label. The existing toggle assertions (`aria-pressed` flipping, the metric toggle, the scope surviving a repaint) keep passing untouched.
- `tests/static-check.mjs`: `#leaderWeekBtn` still exists and its label reads `Recent`; the string `>Weekly<` no longer appears in the template.

### Do not
Rename `#leaderWeekBtn`, `#weeklyTrend` or `#weeklyTrendCard`; add a third scope; add a localStorage key to remember the scope (rule 4 — no entry authorises one); or let the buttons wrap to a second row at 320px. Do not change what the `Bounties` metric counts — entry 68 already set that window.

---

## 73. The trend arrow reads the last seven days

Status: Todo

### Why
`weekTrend()` (`src/app.js:46`) compares this calendar week's points to last week's and shows up, down or even. Early in a week it compares a partial week against a whole one, so on a Monday it is holding one day up against seven and reads `down` for almost everyone almost every Monday. It is the app's only momentum signal and it is wrong by construction half the time.

### Requirements
- **Sequencing:** entry 67 lands `windowStart()` and `dayTotal`.
- `src/app.js` — `weekTrend(nameLower,today)` compares the sum of `dayTotal` over `[windowStart(today), today]` against the sum over the seven days immediately before it — `[windowStart(today,14), the day before windowStart(today)]`. The two windows must not overlap. Return `'up'`, `'down'` or `'even'` as it does today.
- Keep a guard that returns `null` before there is anything to compare against. Today it is `wk===weekKey(config.startDate)`; it becomes "the earlier window falls entirely before `config.startDate`", so the arrow stays absent during the challenge's first week rather than reporting a fall from zero.
- The helper keeps the name `weekTrend` — it is referenced from `personSummary()` and the person card, and renaming it is churn. Its label copy changes from week wording to "last 7 days".
- Pure, no DOM, no `new Date()` (rule 6).

### Tests
- `tests/client-state.state.test.js`: equal points in both windows is `'even'`; more recent is `'up'`; fewer is `'down'`; a day exactly 14 days old falls in the earlier window while 15 days old falls outside both; the guard returns `null` when the earlier window predates `config.startDate`. A bounty claimed in the recent window moves the arrow — the case `dayMeter` would have missed.
- `tests/client-state.dom.test.js`: the existing person-card and You-panel trend assertions keep passing with the new wording.

### Do not
Compare overlapping windows, read the clock, or fork the scoring maths — sum `dayTotal` (rule 6). Do not show an arrow during the first week, and do not add copy about a decline; the glyph is the whole message, and "you did less" copy is the absence framing the tone rule rules out.

---

## 74. A daily momentum curve

Status: Todo

### Why
The three trend charts draw one div bar per calendar week (`trendColumns()`, `.trend-col`), which has two problems this pass makes acute. The rightmost bar is always a partial week, so every chart reads as a decline until Sunday. And each bar's point total exists only in a `title` attribute, which never appears on the phones this crew uses — the need behind withdrawn entry 63, carried here. A trailing-seven-day total plotted once per day answers both: it is the momentum this pass is about, and it has no partial-period artefact, because every point covers a full seven days.

### Requirements
- **Sequencing:** last in the pass. Entries 66 and 67 land first; entry 66's budget is what pays for this.
- `src/app.js` — a pure helper returning one point per challenge day: `{date,label,points}`, where `points` is that person's `dayTotal` summed over the seven days ending on that date. Walk days the way `heatmapDays()` does (`src/app.js:86`), stopping at `challengeToday()` or `config.tripDate`, whichever is earlier.
- **Form change: inline SVG, not div bars.** A 70-day challenge is ~70 points; at `.trend-col`'s `min-width:34px` that is a 2,380px horizontal scroll, which is not a chart. Render an SVG area with a 2px line, sized to the card with a `viewBox` so it scales — **no horizontal scroll**.
- Single series, so **no legend**: the card heading names it. One axis only. Axes and any gridline are recessive; the baseline is the only required rule.
- One hue: `var(--orange-ink)` for the line with a low-alpha fill beneath. Introduce no new colour token. `--orange-ink` is already re-stepped for dark mode (`#c0481f` → `#ff9166`) in the `prefers-color-scheme:dark` block, so the chart inherits a *selected* dark treatment rather than an automatic flip.
- **Selective direct labels, never one per point** — this is withdrawn entry 63's requirement, carried: label the peak and the current value in `--ink`/`--muted` text so the figure is readable without a hover. Text wears text tokens, never the series colour.
- `role="img"` on the `<svg>` with an `aria-label` naming the peak and the current value; inner marks `aria-hidden="true"` (rule 7). Keep a hover affordance in the spirit of the existing `title=` tooltips.
- Inline SVG markup is not a dependency — rule 8 is satisfied. No JS-driven animation; any transition is CSS so the `prefers-reduced-motion` kill-switch applies (rule 7).
- All three charts — `#weeklyTrend`, `#youTrend`, `#personTrend` — draw through the one helper, as they do today. Do not special-case one. `trendColumns()`, `.trend-col`, `.trend-bar` and `.trend-label` go with the bars they served; `trendCaption()` is rewritten off "Best week … this week …".

### Tests
- `tests/client-state.state.test.js`: the series has one point per challenge day up to today and none beyond; each point equals the seven-day `dayTotal` sum ending that day; the challenge's first days sum a truncated window rather than reaching before `config.startDate`; a person with no logs yields an all-zero series, not an empty one. Build expected substrings with `+`, never a template literal — the state suite's TRAP forbids backticks and `${` inside the checks literal.
- `tests/client-state.dom.test.js`: `#youTrend` contains an `<svg>` with `role="img"` and a non-empty `aria-label`; the peak value appears as visible text; the existing entry 53 assertion comparing `#personTrend` with `#youTrend` keeps passing; a repaint is idempotent.
- `tests/static-check.mjs`: the chart carries `role="img"`; `.trend-col{` is no longer styled.
- **Rule 3 carve-out, sanctioned by the maintainer:** the `trendColumns()`/`.trend-col`/`.trend-bar` assertions are retired along with the markup they describe. Name them in the commit message. Assertions about the charts' `aria-label`s, the `#personTrend`/`#youTrend` equality and `trendCaption()`'s existence are **not** covered and must keep passing against the new output.

### Do not
Add a second y-axis, a rainbow or per-series palette (there is one series), a number on every point, or a JS-driven animation. Do not let the chart scroll horizontally — fitting the card is the reason for the form change. Do not reach past `challengeToday()` or `config.tripDate`, and do not plot a day that has not happened. Do not add a charting dependency (rule 8) or a second `<script>` block (rule 5).

---
