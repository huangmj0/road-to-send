# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 76 — Repair the seven dropped `font` shorthands and give the display font a fallback — Done — 2026-08-01
- 77 — Stop the momentum curve stretching its text and its points — Todo
- 78 — Draw the curve on day one, and the smallest bars at all — Todo
- 79 — Fit the leaderboard on a 320px screen — Todo
- 80 — Raise the progress bar, the sorted column and the meter fills to a visible contrast — Todo
- 81 — One focus ring, at a contrast you can see — Todo
- 82 — Stop three remaining surfaces pushing past their card — Todo
- 83 — Stop announcing what did not change, and put the chart label where ARIA reads it — Todo
- 84 — Line up the numbers and close the double gap in the stat grid — Todo
- 85 — Give the Bounty Hunter marker visible text and the small controls a 44px target — Todo

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



## 76. Repair the seven dropped `font` shorthands and give the display font a fallback

Status: Done — 2026-08-01
Notes: Commit `Repair font shorthand fallbacks`. Archived entry 75. index.html 155,362 → 155,413
bytes (+51, 91.4% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
Seven CSS rules use a `font` shorthand ending in `inherit` — `font:800 15px inherit` and friends. `inherit` is not a valid *component* of the `font` shorthand, so the whole declaration is invalid and the browser drops it at parse time. Confirmed by walking `document.styleSheets` in Chromium: those rules contain **no `font` property at all**, while valid shorthands in the same sheet survive. Because the UA stylesheet sets its own `font` shorthand on form controls, and a shorthand beats an inherited `font-family`, every affected button falls back to the UA's **`400 13.3333px Arial`**. So the ⚙ settings button renders at **13.33px instead of the intended 25px**, "Record activity" renders 87.4px wide instead of 115.0px — 24% narrower and a full 400 weight lighter than designed — and the two heading selectors land at **18.72px instead of 14px**. Nothing in the app looks like the stylesheet says it should. The control that proves the mechanism is `button.climber` (`src/styles.css:7`), which uses bare `font:inherit` — valid as a whole value — and correctly computes to DM Sans 800 16px. Separately, `src/styles.css:1` `@import`s DM Sans and Roboto Condensed from Google Fonts, and every `'Roboto Condensed'` shorthand stops at the quoted name with no fallback family. The visual audit hit this for real: in a sandbox that could not reach Google Fonts, **every heading in the app fell back to serif** while body copy stayed sans. That is a live-app resilience bug on the app's only network dependency, not a hypothesis.

### Requirements
- **Sequencing: entry 75 lands first.** Repairing these declarations widens `.head-actions` from 140.5px to 151px and makes the You page-head overflow ~6% worse (186px → 197px at 320px). Do not start this entry while 75 is still `Todo`.
- `src/styles.css` only. Add two font tokens to `:root` (`:2`) beside the existing colour tokens — a body stack and a display stack, e.g. `--font:'DM Sans',system-ui,sans-serif` and `--head:'Roboto Condensed',Arial Narrow,system-ui,sans-serif`. `var()` **is** legal inside a `font` shorthand, which is what makes the repair a token swap rather than a rewrite.
- Replace `inherit` with `var(--font)` in exactly these seven declarations, quoted from the current file:
  - `:3` — `.icon-btn{…font:700 25px/1 inherit;…}`
  - `:3` — `.btn{…font:800 15px inherit;…}`
  - `:3` — `.text-btn{…font:800 14px inherit;…}`
  - `:3` — `.sync{…font:800 12px inherit;…}`
  - `:3` — `.bottom-nav button{…font:800 12px inherit;…}`
  - `:16` — `.seg-btn{…font:800 13px inherit;…}`
  - `:14` — `.review-section h3,.person-head{font:800 14px inherit;…}`
- Point every `'Roboto Condensed'` shorthand at `var(--head)`: `.brand` (`:3`), `.page-head h1` (`:3`), `.card h2` (`:3`), `.stat strong` (`:3`), `.preview-copy strong` (`:3`), `.rank` (`:3`), `.dialog h2` (`:3`), `.wr-lead` (`:14`). Set `body{font-family:var(--font)}` (`:3`) from the same token so there is one definition of each stack.
- **Do not reformat the surrounding compact CSS.** Edit these declarations in place, character for character, and leave the rest of each rule untouched — `tests/static-check.mjs` matches exact compact CSS text and its TRAP header names this as a trap.
- Verify the repair the way the audit did rather than by eye: the seven rules must expose a `font` property when read back from the CSSOM, and `.icon-btn` must compute to 25px.
- This measurably changes rendered widths app-wide. Re-check that the repaired sizes introduce no new horizontal overflow. The crew-tab case was already re-measured with these seven declarations repaired: `.leader-toggles` grows **+16.7px** as a group and still fits at every viewport (320/360/375/390/414/430), because `.table-card .card-head{flex-wrap:wrap;row-gap:12px}` (`:16`) lets the toggle group drop to its own row. **The leaderboard does not gate this entry** — but confirm it, and confirm entry 75's fix still holds at 320px.
- Rule 8: no new network requests. This entry adds fallback families to an existing `@import`; it does not add, remove or change a font request.

### Tests
- `tests/static-check.mjs`: `--font:` and `--head:` are defined in `:root`; **no `font:` declaration in the built stylesheet ends in `inherit`** except `button.climber{…font:inherit…}` and `button.bounty{…font:inherit…}`, which are bare-`inherit` whole values and correct; every `'Roboto Condensed'` occurrence outside the `@import` and the `--head` token is gone. Assert the exact compact text of the seven repaired declarations.

### Do not
Do not add a font file, a second `@import`, a `<link rel=preload>`, or any new network request (rule 8). Do not change which weights are requested. Do not "fix" the shorthands by splitting them into `font-size` + `font-weight` + `font-family` longhands — that inflates the stylesheet and loses the intent; the token belongs in the shorthand. Do not restyle, resize or re-weight anything beyond restoring what these declarations already ask for. Tone rule: this is a typography repair and adds no copy — do not introduce a nudge, a reminder or a participation figure anywhere you touch.

---

## 77. Stop the momentum curve stretching its text and its points

Status: Todo

### Why
`trendSvg()` (`src/app.js:105`) emits `viewBox="0 0 100 100"` with `preserveAspectRatio="none"` into `.trend-svg{display:block;width:100%;height:160px;overflow:visible}` (`src/styles.css:18`). The vertical scale is pinned at 1.6 while the horizontal scale is the card width over 100, so everything inside the SVG is stretched horizontally by a measured **1.65× at 320px, 2.09× at 390px, 2.34× at 430px, 4.24× at 768px and above, and 2.96× for `#personTrend` at 1440px**. The line escapes because it carries `vector-effect:non-scaling-stroke`; the text and the point markers do not. At 1440px the "Current 93" label renders **245.6px wide by 11.0px tall** — letterforms smeared four times wider than they are tall — and `circle r="1.6"` renders as a **21.7 × 5.1px ellipse**, so the data points read as dashes rather than dots. The dots also overlap once the series passes **32 days** and overlap 2.2× at 70 days, which is the challenge length entry 74 designed the curve for. This is the stretched-text symptom the maintainer named.

### Requirements
- `src/app.js` (`trendSvg()`, `src/app.js:105`) and `src/styles.css:18`. All three mount points — `#weeklyTrend`, `#youTrend` and `#personTrend` — draw through this one helper and must keep doing so; do not special-case one.
- **Keep `preserveAspectRatio="none"` for the filled area and the line.** An area chart is meant to stretch to its box, and `.trend-line` is already immune via `vector-effect:non-scaling-stroke` (`:18`). The bug is the two things that must not stretch: text and point markers.
- **Move the two value labels out of the SVG.** Return them from `trendSvg()` as HTML siblings of the `<svg>` inside the same returned string — not as `<text>` — so they render at a true typographic size in every card and cannot be distorted or collide with the polyline. Today they are `<text class="trend-value peak">Peak N</text>` and `<text class="trend-value current">Current N</text>` positioned at `y=Math.min(98,now.y+8)`, which is 12.8px below the last point and overlaps the line and the final marker at every viewport. Because `renderTrend()`, `renderYouTrend()` and `renderPersonCard()` all assign the helper's output as `innerHTML` of a plain `<div class="trend">`, this needs no template change.
  - This keeps `tests/client-state.dom.test.js:363` green (it reads `#youTrend`'s `innerHTML` for the strings `Peak 0` and `Current 0`) and `:958` green (it compares `#personTrend`'s `innerHTML` with `#youTrend`'s). Both must still pass — do not retire either.
  - Retire the `.trend-value{font:700 6px system-ui,sans-serif}` / `.peak` / `.current` SVG text rules along with the `<text>` elements they styled, and style the HTML labels with the app's own tokens. Text wears text tokens — `var(--ink)` for the peak, `var(--muted)` for the current value — never the series colour, as entry 74 required.
- **Replace the visible per-point `<circle class="trend-point" r="1.6">` markers with one full-height transparent hover band per day** — a `<rect>` per point spanning that day's slice of the chart, `fill="transparent"`, carrying the same `<title>` the circle carries today (`${label} · ${points} point${s}`). A rect used as an invisible hit target is unaffected by the horizontal stretch, and one band per day removes the marker overlap entirely at any series length.
  - `tests/client-state.dom.test.js:368` asserts `'trend-line'` and `'<title>'` are present with the message "the SVG keeps a line and per-point hover affordance". **Per-day hover bands satisfy that assertion's stated intent, so no rule-3 carve-out is granted or needed here.** If your implementation cannot keep a per-point `<title>`, stop and mark the entry `Blocked` rather than retiring the assertion.
  - Retire `.trend-point{fill:var(--orange-ink)}` (`:18`) with the circles it styled. That is the only assertion-free rule going out.
- Inner marks stay `aria-hidden="true"` and the `<svg>` keeps `role="img"` with its `aria-label` from `trendAria()` (rule 7). No JS-driven animation; any transition stays CSS so the `@media(prefers-reduced-motion:reduce)` kill-switch at `:26` applies.
- The chart must still fit its card with **no horizontal scroll** at any viewport — that was entry 74's reason for choosing an SVG and it still binds.
- Append new CSS at the end of `src/styles.css`; do not reformat existing lines.

### Tests
- `tests/client-state.dom.test.js`: `#youTrend` contains an `<svg>` with `role="img"` and a non-empty `aria-label`; `Peak N` and `Current N` appear as visible text outside the `<svg>` element; the SVG contains no `<text>` element; there is one `<title>` per point; a repaint is idempotent. The existing `#personTrend` / `#youTrend` equality assertion keeps passing.
- `tests/static-check.mjs`: `.trend-value{`, `.trend-point{` are no longer styled; the classes for the HTML labels are.

### Do not
Do not scale the text by hand with a per-viewport `font-size`, a transform, or a JS measurement — moving it out of the distorted coordinate space is the fix. Do not add a second `<script>` block (rule 5) or a charting dependency (rule 8). Do not add a number on every point, a second series, a second y-axis or a legend — entry 74 ruled all four out and there is still one series. Do not let the chart scroll horizontally. Do not reach past `challengeToday()` or `config.tripDate`. Tone rule: this entry redraws an existing chart and adds no copy — no nudge, no reminder, no absence count, and nothing that opens or speaks on its own.

---

## 78. Draw the curve on day one, and the smallest bars at all

Status: Todo

### Why
Two graphics silently draw the wrong thing for small values.

On the **first day of a challenge**, `trendSvg()` has one row, so `x=i=>rows.length===1?50` and the path string is `line="M50,<y>"` — a lone `moveto` with `fill:none`, which strokes nothing at all — while `area=line+' L100,88 L0,88 Z'` becomes a full-width **triangle** from the single point down to both bottom corners. A crew opening the app on day one sees an orange wedge and no line.

The **baseline** the entry-74 spec called the chart's one required rule is `.trend-baseline{stroke:var(--line);stroke-width:1}` (`src/styles.css:18`), computing to **1.23:1** against the card, drawn coincident with the area's own lower edge at 1.25:1 — the two are indistinguishable. It also lacks `vector-effect:non-scaling-stroke`, so it renders at 1.6px while `.trend-line` beside it renders at 2px.

The **bar charts** round their widths: `breakdownRow(…, Math.round(r.points/max*100))` and `pyramidRow(…, Math.round(r.count/max*100))` in `renderBreakdown()`/`renderPyramid()` (`src/app.js:92`, `:97`). A real nonzero value whose share is under 0.5% rounds to `width:0%` and **draws nothing**, and anything under a few percent is clipped to a sliver by `border-radius:999px` on a 12–14px-tall track. A climber with 1 bounty point against a 300-point climbing total sees an empty bar next to a "1" — the number says one thing and the bar says zero.

### Requirements
- **Sequencing: entry 77 lands first.** Both entries edit `trendSvg()` and the `.trend-*` rules. Do not start this while 77 is `Todo`.
- `src/app.js` and `src/styles.css`.
- **Day one:** when `rows.length===1`, emit a path that actually strokes and an area that is a rectangle, not a triangle — a horizontal segment across the full width at that point's `y` is the natural form for a single-day series. Keep the existing coordinate rounding.
- **Baseline:** give `.trend-baseline` `vector-effect:non-scaling-stroke` so it renders 1px crisp like `.trend-line` does, and raise its stroke from `var(--line)` (`#174a3a1f`) to `var(--line-strong)` (`#174a3a24`) so it separates from the area's own lower edge. It stays a **recessive** rule, as entry 74 required. **Introduce no new colour token** — entry 74 forbade that for this chart and that still binds.
- **Bar floor:** give `.breakdown-bar i` (`:11`), `.pyramid-bar i` (`:13`) and `.progress i` (`:9`) a minimum rendered width so a nonzero value is always visible — a `min-width` in the low single-digit pixels is enough, and it must apply **only when the value is nonzero**, so a genuine zero still draws nothing. Prefer fixing it in CSS over changing the percentage math; if you change the math, keep `0` mapping to `0`.
- Rule 6: `renderBreakdown()` and `renderPyramid()` run from `render()`, which runs often. Whatever you add stays idempotent and cheap.
- Append new CSS at the end of `src/styles.css`; do not reformat existing lines.

### Tests
- `tests/client-state.dom.test.js`: a config whose `startDate` equals `challengeToday()` yields exactly one point, and `#youTrend`'s SVG contains a `trend-line` path with more than a single `M` command and an area path that is not the `L100,88 L0,88 Z` triangle; a breakdown row whose points are a tiny fraction of the maximum still renders a bar with nonzero width, while a row worth zero points does not.
- `tests/static-check.mjs`: `.trend-baseline` carries `vector-effect:non-scaling-stroke`; the three bar-fill rules carry the minimum-width floor. Assert the exact compact text.

### Do not
Do not hide the card on day one — `tests/client-state.dom.test.js:360`, `:378` and `:963` lock the all-zero personal curve as deliberate behaviour and must keep passing. Do not add a new colour token, a second series, a legend or a per-point number. Do not raise the baseline to a foreground weight; it is a rule, not data. Do not give a zero-point row a visible bar — inventing a value is worse than the bug. Tone rule: this entry changes geometry only; it adds no copy, no absence count and no prompt to participate.

---

## 79. Fit the leaderboard on a 320px screen

Status: Todo

### Why
The Crew leaderboard needs a sideways scroll on a small phone. Its table has an intrinsic width of **496px** — Rank 58, Climber 287, Recent 71, Overall 80 — against roughly 264px of available card width at 320px, so **232px is hidden at 320px, 162px at 390px and 122px at 430px**, and at 320px the Recent column *starts* 81px past the right edge. The two score columns, which are the whole point of a leaderboard, are off-screen. This is the horizontal-scroll symptom the maintainer named.

Two independent causes. First, the Climber column is set by the longest **name** — 240px of max-content plus the 19px 🏹 marker plus padding — because `th,td{…white-space:nowrap}` (`src/styles.css:3`) forbids it wrapping. It is **not** caused by the title tag added in `e445abb`, whose intrinsic width is only 141.4px; both the visual and the leaderboard audits cleared that commit independently. Second, `.table-card{padding:18px 0}` (`:3`) deliberately gives the table zero horizontal padding, and `@media(max-width:430px){….card{padding:17px}…}` (`:8`) silently overrides it on every phone — equal specificity `(0,0,1,0)`, a media query adds none, and source order decides. The table loses **34px** of width on exactly the screens that can least afford it, and the card head ends up inset 37px while the cells are inset 29px.

### Requirements
- `src/styles.css` only. No template change, no JS change.
- **Restore the intended zero horizontal padding on phones** by raising specificity rather than by reordering: `.card.table-card{padding:18px 0}`, appended at the end of the stylesheet. That alone buys back 34px. Do not edit or move the `:8` media block.
- **Let the climber name wrap.** `th,td{…white-space:nowrap}` (`:3`) has to be relaxed for the second column only: `white-space:normal` plus `overflow-wrap:anywhere` on `#leaderTable td:nth-child(2)`. `anywhere` is required and `break-word` will not do — only `anywhere` lowers the cell's **min-content** width, which is what the table layout algorithm reads. Precedent for the idiom is `.person-cell strong{…overflow-wrap:anywhere}` (`:7`).
  - The name is rendered inside `button.climber`, which is `display:inline-flex` (`:7`). Verify the wrap actually reaches the text and add `min-width:0` on `.climber` if it does not. Measure; do not assume.
  - `.title-tag{display:block;white-space:normal;…}` (`:16`) already wraps and needs nothing.
- **Success criterion, measured not eyeballed:** at a 320px viewport with the crew's longest real name, `#leaderTable`'s `scrollWidth` is no greater than `.table-scroll`'s `clientWidth`, and all four columns are visible. `.table-scroll{overflow-x:auto}` (`:3`) stays as the safety net; the goal is that it never has to engage.
- `tests/static-check.mjs:220` pins `.leader-toggles{display:flex;flex-wrap:nowrap` as exact text. **This entry does not touch it and no carve-out is granted.** `.table-card .card-head{flex-wrap:wrap;row-gap:12px}` (`:16`) already lets the whole toggle group drop to its own row, which is why the four pills fit at every viewport once entry 76 lands; any declaration you add to `.leader-toggles` must come **after** `flex-wrap:nowrap` in the same rule or live in a separate appended rule.
- Opportunistic and optional: the tightest point in the phone range is **361px**, not 375 or 390 — that is where the `@media(max-width:360px){.leader-toggles .seg-btn{padding-left:4px;padding-right:4px}}` relief (`:16`) stops and padding jumps from 4px to 13px a side. Widening that relief to about 380px is cheap. It gates nothing and is cosmetic only; skip it if it costs assertions.
- Append at the end of `src/styles.css`; do not reformat existing lines.

### Tests
- `tests/static-check.mjs`: `.card.table-card{padding:18px 0}` is present; the second-column wrap rule is present with `overflow-wrap:anywhere`. Assert the exact compact text.
- `tests/client-state.dom.test.js`: a crew containing a very long single-word name still renders four `<td>`s per row and keeps the `class="hunter"` marker and any `.title-tag` inside the second cell.

### Do not
Do not replace the table with CSS grid or flex — `tests/static-check.mjs:232` asserts the page contains exactly **one** `<table>`, and `minmax()` is not available to table columns anyway. Do not truncate, ellipsise or initialise anybody's name. Do not shorten the `<th>` labels to `7d` / `All`: the saving is only 30px, the table's runtime `aria-label` already carries the scope in long form, and a screen reader announcing "7d" per cell is a regression. Do not rename the `#leaderWeekBtn` toggle — `tests/static-check.mjs:213` pins `>Recent</button>` and `:214` bans the string `>Weekly<`. Do not drop a column, and do not hide one at small widths. Tone rule: the leaderboard shows what people did; do not add an absence column, a participation figure, or a "not logged yet" state to it while you are in there.

---

## 80. Raise the progress bar, the sorted column and the meter fills to a visible contrast

Status: Todo

### Why
Three tokens — `--sky`, `--orange` and the heatmap's orange mix — were never re-stepped when the dark block was added, and they are the root of four separate contrast failures on the app's most-looked-at widgets.

- `.progress i{background:var(--orange);…}` (`src/styles.css:9`) is the crew's headline KPI, and its fill measures **2.25:1** against the `--sand` track. This is a graphical object whose boundary *is* the value, so 3:1 is the floor. Swapping the fill to `var(--orange-ink)` gives **3.64:1** for **+4 bytes** — the best value-per-byte fix in the audit.
- `td.sorted strong{color:var(--orange)}` (`:16`) measures **2.99:1** and fails AA outright as text. Every other orange *text* in the app already correctly uses `--orange-ink` — `.pts`, `.rank`, `.breakdown-pts`, `.pyramid-count`, `.records-value`, `.week-trend.down`, `.pace.behind`. This one selector is the outlier, and it is the leaderboard's currently-sorted score.
- The point meter's category fills, `.point-meter i.seg-exercise.filled{background:var(--sky);…}` and `.point-meter i.seg-mobility.filled{background:var(--orange);…}` (`:19`), measure **1.48:1** and **2.25:1** against the `--sand` empty segment. Logging Exercise barely changes the widget the app puts at the top of the You tab. `.point-meter i.seg-bonus{border-style:dashed}` sits at **1.17:1**, so the balanced-day bonus signal effectively does not exist.
- The heatmap ramp mixes toward `--orange` while its base `--sand` was re-stepped: `color-mix(in srgb,var(--orange) 30%/55%/80%,var(--sand))` (`:15`). Adjacent steps measure **1.29 / 1.23 / 1.22 / 1.16**, so a 6-point day and an 8-point day are the same colour to the eye.

### Requirements
- `src/styles.css` only. Every fix here is a token swap or a re-step of an existing mix; **introduce no new colour token** and change no `:root` value that other rules depend on.
- `.progress i` (`:9`): `var(--orange)` → `var(--orange-ink)`. `--orange-ink` is already re-stepped for dark (`#c0481f` → `#ff9166` at `:27`), so both schemes get a chosen treatment.
- `td.sorted strong` (`:16`): `var(--orange)` → `var(--orange-ink)`, joining the seven text rules that already do this.
- `.point-meter i.seg-exercise.filled` and `.point-meter i.seg-mobility.filled` (`:19`): reach at least **3:1** against `--sand` in both schemes, using existing tokens. `--green` and `--orange-ink` are the two already-re-stepped candidates; the three categories must stay visually distinguishable from each other, so pick deliberately and state the resulting ratios in your `Notes:`.
- `.point-meter i.seg-bonus` (`:19`): make the dashed empty state visible — the border must reach 3:1 against the segment it outlines. Keep it dashed; the dash is what distinguishes the bonus segment from the three category segments.
- Heatmap (`:15`): re-step the three `color-mix` percentages so **every adjacent pair of levels, including `.heat-cell` → `.heat1` and `.heat3` → `.heat4`, is distinguishable**. Keep four levels and keep `heatLevel()` (`src/app.js:85`) unchanged — this is a colour re-step, not a threshold change.
- Measure the ratios rather than estimating them, in both the light `:root` (`:2`) and the `@media(prefers-color-scheme:dark)` block (`:27`), and record them in your `Notes:`.
- `--accent-solid` is **out of scope**: its two reported drops (4.35 → 3.59 and 4.83 → 3.26) both still clear 3:1, so it is a consistency observation, not a failure. Leave it alone.
- Edit these declarations in place, character for character, and do not reformat the surrounding compact CSS.

### Tests
- `tests/static-check.mjs`: `.progress i` and `td.sorted strong` no longer reference `var(--orange)`; the point-meter segment rules and the heatmap mix percentages match the exact compact text you wrote. Assert that no rule outside `:root` still paints *text* with `var(--orange)`.

### Do not
Do not add a colour token, a gradient, a pattern or a texture. Do not change the number of heatmap levels or the thresholds in `heatLevel()`. Do not restyle `--accent-solid`, `.btn.primary` or the brand colours. Do not turn contrast into meaning — a darker bar must not come to signal anything the current bar does not already signal. Tone rule: this entry changes colour only and adds no copy; do not let a re-step introduce a "behind" or "not logged" visual state that the app does not have today.

---

## 81. One focus ring, at a contrast you can see

Status: Todo

### Why
Someone navigating by keyboard cannot reliably see where they are. The global ring `:focus-visible{outline:3px solid var(--sky);outline-offset:2px}` (`src/styles.css:3`) measures **1.96:1** against the page background, well under the 3:1 a non-text indicator needs, and `--sky` is one of the three tokens the dark block never re-steps, so it is the same weak blue in both schemes. Three different rings then coexist and disagree with each other:

- `:focus-visible{outline:3px solid var(--sky);outline-offset:2px}` (`:3`) — global, 1.96:1
- `button.climber:focus-visible{outline:3px solid var(--sky);outline-offset:2px;border-radius:8px}` (`:7`) — the same weak ring, restated to add a radius
- `.activity-picker input:focus-visible+span{outline:3px solid var(--sky);outline-offset:2px}` (`:9`) — the same again
- `button.bounty:focus-visible{outline:2px solid var(--orange);outline-offset:-2px;border-radius:10px}` (`:3`) — 2px, orange at 2.25:1, inset
- `.cat-chip:focus-visible{outline:2px solid var(--green);outline-offset:2px}` (`:23`) — 2px, green, and the only one of the five with real contrast

Rule 7 requires visible focus, and the app currently has four thicknesses-and-colours of it, three of which are too faint to serve.

### Requirements
- `src/styles.css` only. Settle on **one** ring: `var(--green)` at 3px with `outline-offset:2px`. `--green` is re-stepped for dark (`#174a3a` → `#5fb896` at `:27`), and `.cat-chip:focus-visible` (`:23`) is the existing precedent for green focus in this codebase.
- Apply it in the global `:focus-visible` rule and delete the restatements that then say nothing new: `button.climber:focus-visible` keeps **only** its `border-radius:8px`, `.cat-chip:focus-visible` keeps only what differs from the global. Fewer rules, not more.
- **`.activity-picker input:focus-visible+span` (`:9`) is the one restatement that must stay — recolour it, do not delete it.** The radio it belongs to is `.activity-picker input{position:absolute;opacity:0}` (`:9`), so the global rule would draw the ring on a fully transparent, absolutely-positioned element and keyboard focus would be **invisible on all four activity choices**. The adjacent-sibling selector exists precisely to move the ring onto the visible `<span>`. Change its colour and width to match the shared ring and leave the selector alone.
- `button.bounty:focus-visible` (`:3`) keeps `outline-offset:-2px` and `border-radius:10px` — the bounty row is full-bleed inside its card, so an outset ring would be clipped. Only its colour and width change to match.
- Measure the ring against **every background it lands on** — `--bg`, `--card`, `--input-bg` and the `--wash`/`--orange-tint` states — in both the light `:root` (`:2`) and the dark block (`:27`), and confirm at least 3:1 everywhere. Record the ratios in your `Notes:`.
- `--sky` stays in `:root`: it is still used by `--notice-bg`, `--avatar-bg` and the point meter. This entry retires its use **as a focus colour only**.
- Rule 7 also requires the ring stay on `:focus-visible`, not `:focus` — do not widen it to mouse clicks.
- Edit in place; do not reformat the surrounding compact CSS, and append anything new at the end of the file.

### Tests
- `tests/static-check.mjs`: exactly one `outline:3px solid var(--green)` focus declaration in the global `:focus-visible` rule; no `:focus-visible` rule anywhere in the built stylesheet still uses `var(--sky)`; `button.bounty:focus-visible` keeps `outline-offset:-2px`. Assert the exact compact text.

### Do not
Do not remove focus from anything, do not use `outline:none` anywhere, and do not replace the outline with a `box-shadow` — an outline is what respects forced-colors mode. **Do not delete `.activity-picker input:focus-visible+span`** — see the requirement above; deleting it hides focus on the whole activity picker, which is the opposite of what this entry is for. Do not add a fourth ring style for a new special case. Do not attach the ring to `:focus` instead of `:focus-visible`. Do not change the tab order or add a skip link in this entry. Tone rule: this entry changes colour and thickness only; it adds no copy, no prompt and no new surface.

---

## 82. Stop three remaining surfaces pushing past their card

Status: Todo

### Why
Three more places let content run past the edge it is supposed to sit inside, each with a different cause and each measured.

- **The You feed rows.** `.activity{display:grid;grid-template-columns:40px 1fr auto auto;…}` (`src/styles.css:3`, and `38px 1fr auto auto` at `:8`) — a `1fr` track keeps its min-content minimum, so a long note or grade string pushes the row wider than the card. At 320px the row is 288px inside 264px of card and the 44px delete button ends up **7px outside the card's own border**. The idiom that fixes it is already in this stylesheet: `.heatmap{grid-template-columns:repeat(7,minmax(0,1fr));…}` (`:15`).
- **The Week in Review modal.** `#weekReviewTitle` has a min-content width of 266px inside a 242px `.dialog-head` at 320px. `openModal()` (`src/app.js:118`) focuses the close button, the browser scrolls it into view, and the dialog settles at **`scrollLeft = 45`** — so every line in the modal loses its first ~45px and it opens reading "lexandra / eatherstonehaugh's / eek in review". The threshold is roughly a 14-character name word; a short name opens at `scrollLeft 0`. This modal opens on first visit each week, so it is the first thing some of the crew see.
- **The shared-setup script block.** `#scriptCode` has a `scrollWidth` of 2095px inside 242px. `.setup-copy pre{white-space:pre-wrap;…}` (`:3`) cannot break a 501-character run with no whitespace in it, so `pre-wrap` has nothing to break on.

### Requirements
- `src/styles.css` only. No template change, no JS change.
- `.activity` (`:3` and the `:8` phone override): `1fr` → `minmax(0,1fr)` in both, matching `.heatmap` (`:15`). Verify the delete button lands inside the card border at 320px.
- `.dialog h2` (`:3`, `font:800 32px 'Roboto Condensed';color:var(--green);margin:0`): add `min-width:0` so the flex item can shrink below its min-content, and `overflow-wrap:anywhere` so the long word actually breaks. Success criterion: `#weekReviewModal`'s dialog opens at `scrollLeft === 0` at 320px with the crew's longest name.
- `.setup-copy pre` (`:3`): add `overflow-wrap:anywhere`. Keep `white-space:pre-wrap` and keep the `overflow:auto` scroll — the block is a code snippet an organizer copies, so it must stay selectable and complete.
- **Sequencing:** entry 76 changes `.dialog h2`'s font stack to `var(--head)`. Both entries edit that declaration. If 76 has landed, edit around it and do not revert it; if it has not, leave the font component exactly as you find it.
- Append at the end of `src/styles.css`; do not reformat existing lines.

### Tests
- `tests/static-check.mjs`: `.activity` uses `minmax(0,1fr)` in both the base rule and the `max-width:430px` override; `.dialog h2` carries `min-width:0`; `.setup-copy pre` carries `overflow-wrap:anywhere`. Assert the exact compact text.
- `tests/client-state.dom.test.js`: a feed entry with a very long unbroken note still renders its `.del` button and its `.pts` cell in the same row.

### Do not
Do not truncate, ellipsise or clip the note text, the setup script or anybody's name — all three are content the user needs whole. Do not remove `overflow:auto` from `#scriptCode`; an organizer copies that block. Do not shrink the modal heading's font size to make it fit; breaking is the fix, not shrinking. Do not change what `openModal()` focuses — `tests/client-state.dom.test.js` covers entry 37's focus behaviour and it is correct. Tone rule: this entry changes layout only; the Week in Review modal is the one thing in the app that opens on its own and it is grandfathered — do not give anything else that behaviour, and do not add copy to any of these three surfaces.

---

## 83. Stop announcing what did not change, and put the chart label where ARIA reads it

Status: Todo

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

Status: Todo

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

## 85. Give the Bounty Hunter marker visible text and the small controls a 44px target

Status: Todo

### Why
The leaderboard marks the last seven days' Bounty Hunter with `<span class="hunter" title="Bounty Hunter of the last 7 days">🏹</span>` (`src/app.js:115`). The only explanation of that emoji is a `title` attribute, and `IMPROVEMENT_LOG.md:13` is the maintainer's own record that **a `title` never appears on the phones this crew uses** — that is precisely why entry 63 was withdrawn and why entry 74 carried its requirement forward. So on a phone the marker is an unexplained bow-and-arrow, and to a screen reader it is an unlabelled emoji. The three other crew titles — Crusher, Gym Rat, Yogi — already render as visible text through `titleMap` and `.title-tag` (`src/styles.css:16`) in the same cell. The Bounty Hunter is the odd one out.

Separately, rule 7 sets a 44px minimum touch target and several controls miss it, all because the **base class** was never fixed even though individual instances were:

- `.text-btn{…padding:8px}` (`:3`) renders **31px** tall today, and 34px once entry 76 restores its `font:800 14px`. That is `#personalShowMore`, `#crewShowMore`, `#dateToggle`, `#addParticipant`, the "Someone else" button, and all three `.setup-actions` buttons — including the destructive "Use local mode".
- `.sync{…max-width:190px}` (`:3`) — `#syncStatus` measures **80.9 × 17px** and is the **only** refresh control in shared mode.
- `.brand` (`:3`) — `a.brand` measures **260 × 29px**.

`.head-actions .text-btn{display:inline-flex;align-items:center;min-height:44px}` (`:21`), `.del{min-width:44px;min-height:44px;border-radius:10px}` (`:9`) and `#bountyWeekToggle,#claimedToggle{min-height:44px}` (`:24`) are three separate one-off patches of the same defect. The gap is the base class, not the intent.

### Requirements
- `src/app.js` and `src/styles.css`.
- **Bounty Hunter:** add it to the `titleMap` that `render()` builds (`src/app.js:115`: `const titleMap=new Map()` populated from `crewTitles(today)`), sourced from `model.hunters`, so it renders through the existing `.title-tag` path alongside the other three titles. Drop the `title=` attribute from the glyph span.
  - **Keep `class="hunter"` on the glyph span** — `tests/client-state.dom.test.js:737` asserts `class="hunter"` remains beside its holder and that assertion stays. Mark the glyph `aria-hidden="true"`, since the title text now names it.
  - Do **not** add the Bounty Hunter to the `TITLE_CATEGORIES` constant (`src/app.js:6`): `tests/static-check.mjs:160` asserts that constant carries no glyph, and the hunter is derived from bounty claims rather than from a category's active days. Merge it into the runtime `titleMap` only.
  - Reuse `model.hunters` from `totalsModel()`. Do not re-derive who the hunter is (rule 6).
- **Touch targets:** give the base classes the minimum rather than patching more instances — `.text-btn` (`:3`), `.sync` (`:3`) and `.brand` (`:3`) each reach **44px** of height. `.head-actions .text-btn` (`:21`) is the working precedent for the technique: `display:inline-flex;align-items:center;min-height:44px`.
  - `.text-btn` is used inline inside prose in places; verify none of them gain an unwanted line break or a visible box, and that `#undoDelete` inside `.undo-bar` (`:22`) still fits its pill.
  - Do not change the visible text size, colour, underline or padding-left of any of these — only the hit area.
- **Sequencing:** entry 76 repairs `.text-btn`'s and `.sync`'s `font` shorthands and must land first, because the repaired sizes are what these heights have to accommodate. Do not revert 76's `var(--font)`.
- Append new CSS at the end of `src/styles.css`; edit `src/app.js` in the existing compact single-line style.

### Tests
- `tests/client-state.dom.test.js`: the current Bounty Hunter's leaderboard row contains a `.title-tag` naming the title as visible text; the `class="hunter"` glyph is still present and is `aria-hidden="true"`; the glyph span carries no `title` attribute; a climber holding both a category title and the hunter title shows both.
- `tests/static-check.mjs`: `.text-btn`, `.sync` and `.brand` each declare `min-height:44px`; no `title="Bounty Hunter` string remains in the built script. Assert the exact compact text.

### Do not
Do not reintroduce a `title` tooltip as the only carrier of any label — it does not render on this crew's phones, and that is settled history. Do not add a fourth entry to `TITLE_CATEGORIES` or change how titles are computed. Do not enlarge the visible text or padding of `.text-btn`, `.sync` or `.brand` — grow the hit area, not the type. Do not add a new title, badge or award of any kind. Tone rule: a title marks something a person **did**; do not add a marker for what anyone did not do, a "no hunter this week" line, or any count of how many people claimed nothing.

---
