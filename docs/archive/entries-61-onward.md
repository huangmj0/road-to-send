# v11 pass — entries 61 onward

The current open archive file: rule 10 moves each finished entry here. When it approaches the
per-file cap in `tests/docs-check.mjs`, start the next file rather than raising the cap.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.
## 79. Fit the leaderboard on a 320px screen

Status: Done — 2026-08-01
Notes: Commit `Fit leaderboard on 320px`. Archived entry 78. index.html 155,877 → 155,985 bytes (+108, 91.8% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

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
## 82. Stop three remaining surfaces pushing past their card

Status: Done — 2026-08-01
Notes: Commit `Stop card overflow`. Archived entry 81. index.html 155,931 → 156,217 bytes (+286, 91.9% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

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

## 77. Stop the momentum curve stretching its text and its points

Status: Done — 2026-08-01
Notes: Commit `Fix momentum curve rendering`. Archived entry 76. index.html 155,413 → 155,411
bytes (-2, 91.4% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

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
## 75. Keep the You page head on screen at 320px

Status: Done — 2026-08-01
Notes: Commit `Keep You page head in view`. Archived entry 74. index.html 155,267 → 155,362
bytes (+95, 91.4% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
On the You tab the greeting and the Share / Change me buttons sit in one `.page-head` row that is wider than the phone. Measured in Chromium at `origin/main`, `#you .page-head` has a `scrollWidth` of **506px** at every phone width — **+186px at 320px, +116px at 390px, +76px at 430px** — and it is the **only** document-level horizontal overflow in the app (Crew and Record never overflow at any viewport). At 320px both "Share" and "Change me" are pushed **entirely off-screen**: a climber on a small phone cannot reach their own share button or switch profile without sideways-scrolling the whole page. This is not a contrived name. `.page-head h1` is `800 44px` on phones and the crew's real first names measure 159–235px against an h1 budget of 146px at 320px, 216px at 390px and 256px at 430px; a short name shows no overflow at all, which is why this has stayed invisible to whoever tested it.

### Requirements
- **Sequencing: this entry lands first in the pass.** Entry 76 widens `.head-actions` from 140.5px to 151px ("Share" +3.4, "Change me" +7.1), which pushes this same overflow from 186px to **197px at 320px**. Entry 76 does not cause the defect but makes it measurably worse, so this fix goes in ahead of it.
- `src/styles.css` only. The three declarations that produce it, quoted from the current file:
  - `:3` — `.page-head,.card-head,.recording-for,.roster-head,.inline{display:flex;align-items:center;justify-content:space-between;gap:14px}` (flex items default to `min-width:auto`, so the h1 cannot shrink below its min-content 342px)
  - `:3` — `.page-head h1{font:800 clamp(42px,10vw,62px)/.95 'Roboto Condensed';color:var(--green);margin:5px 0 0}`
  - `:8` — `@media(max-width:430px){….page-head h1{font-size:44px}…}`
  - `:21` — `.head-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto}`
- Let the heading shrink and break: `min-width:0` on the `.page-head` text block **and** `overflow-wrap:anywhere` on `.page-head h1`. `overflow-wrap:anywhere` is the correct value here and `break-word` is not — only `anywhere` lowers the element's **min-content** width, which is what the flex layout reads. Precedent for the idiom is `.person-cell strong{…overflow-wrap:anywhere}` at `src/styles.css:7`.
- `.head-actions` must be reachable at 320px. Either drop its `flex:0 0 auto` so it can shrink, or let `.page-head` wrap. Whichever you pick, both buttons must be fully inside the viewport at 320px and keep the 44px minimum height `.head-actions .text-btn{display:inline-flex;align-items:center;min-height:44px}` (`:21`) already gives them.
- **Append new declarations at the end of `src/styles.css`; do not reformat or reorder the existing lines.** `tests/static-check.mjs` matches exact compact CSS text in several places and its own TRAP header says so.
- The Record and Crew page heads use the same `.page-head` rule. Whatever you change must leave those two non-overflowing — they are clean today and must stay clean.
- Budget: this pass (entries 75–85) is estimated at roughly **+1,400 bytes** in total against **14,733 bytes of headroom** (`index.html` is 155,267 bytes, `BUDGET` is 170,000 in `tests/size-check.mjs`). **No re-baseline is needed or authorised in this pass.** Record the real figure in your `Notes:` so later entries can check the running total.

### Tests
- `tests/static-check.mjs`: `.page-head h1` carries `overflow-wrap:anywhere`; `.head-actions` no longer pins itself with `flex:0 0 auto`, or the wrap rule that replaces it is present. Assert the exact compact text you added.
- No client-state assertions — this is layout only, and the element stub in `tests/harness.js` cannot measure geometry.

### Do not
Do not shorten, truncate, ellipsise or abbreviate anybody's name to make it fit — the heading is the one place the app says who you are. Do not hide `#shareBtn` or `#changeMeBtn` at small widths; making them reachable is the point. Do not move `#shareBtn` out of the You page head — `tests/static-check.mjs` pins it to `data-panel="you"` above the today card. Tone rule: this entry changes layout only and adds no copy; do not add a prompt, a reminder or a participation figure to the page head while you are in it.

---

## 74. A daily momentum curve

Status: Done — 2026-08-01
Notes: Commit `Render daily momentum curve; retire trend-bar assertions`. Archived entry 73.
Retired the sanctioned `trendColumns()`/`.trend-col`/`.trend-bar` assertions with the removed bar
markup. index.html 156,778 → 157,247 bytes (+469, 92.5% of the 170,000-byte budget). `npm test`:
5/5 suites. Deviations: None.

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
## 73. The trend arrow reads the last seven days

Status: Done — 2026-08-01
Notes: Commit `Compare trend over seven days`. Archived entry 72. index.html 156,302 → 156,778
bytes (+476, 92.2% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
`weekTrend()` (`src/app.js:46`) compares this calendar week's points to last week's and shows up, down or even. Early in a week it compares a partial week against a whole one, so on a Monday it is holding one day up against seven and reads `down` for almost everyone almost every Monday. It is the app's only momentum signal and it is wrong by construction half the time.

### Requirements
- **Sequencing:** entry 67 lands `windowStart()` and `dayTotal`.
- `src/app.js` — `weekTrend(nameLower,today)` compares the sum of `dayTotal` over `[windowStart(today), today]` against the sum over the seven days immediately before it — `[windowStart(today,14), the day before windowStart(today)]`. The two windows must not overlap. Return `'up'`, `'down'` or `'even'` as it does today.
- Keep a guard that returns `null` before there is anything to compare against. Today it is `wk===weekKey(config.startDate)`; it becomes "the earlier window falls entirely before `config.startDate`", so the arrow stays absent during the challenge's first week rather than reporting a fall from zero.
- The helper keeps the name `weekTrend` — it is referenced from `personSummary()` and the person card, and renaming it is churn. Its label copy changes from week wording to "last 7 days".
- Pure, no DOM, no `new Date()` (rule 6).

### Tests
- `tests/client-state.state.test.js`: equal points in both windows is `'even'`; more recent is `'up'`; fewer is `'down'`; the guard returns `null` when the earlier window predates `config.startDate`. A bounty claimed in the recent window moves the arrow — the case `dayMeter` would have missed.
- **Boundary arithmetic, stated once so it is not re-derived wrongly.** `windowStart(today,14)` is `today-13`, so the two windows are `[today-6, today]` and `[today-13, today-7]` — seven days each, adjacent, non-overlapping. Assert that a day **13** days old falls in the earlier window and a day **14** days old falls outside both. A test that expects a 14-day-old day to count would force the earlier window to eight days and break the symmetry the comparison depends on.
- `tests/client-state.dom.test.js`: the existing person-card and You-panel trend assertions keep passing with the new wording.

### Do not
Compare overlapping windows, read the clock, or fork the scoring maths — sum `dayTotal` (rule 6). Do not show an arrow during the first week, and do not add copy about a decline; the glyph is the whole message, and "you did less" copy is the absence framing the tone rule rules out.

---

## 72. Recent, not Weekly

Status: Done — 2026-08-01
Notes: Commit `Make leaderboard recent`. Archived entry 71. index.html 156,196 → 156,302 bytes
(+106, 91.9% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
The leaderboard's scope toggle reads `Weekly` / `Overall`, and after entry 68 the word is wrong: the card above it reports the last seven days while this button still scopes to a calendar week. Two controls on one screen using "week" for two different spans is worse than either span on its own.

### Requirements
- **Sequencing:** entries 68 and 70 land first. They add the two rolling fields this entry consumes — `recentBounties` and `recent` — and this is the commit where the leaderboard starts reading them.
- `src/app.js` — the toggle's recent scope reads `recent` for the `Points` metric and `recentBounties` for the `Bounties` metric, instead of `week` and `bounties`. Both fields already exist on `totalsModel().sorted`; derive neither a second time (rule 6). Ordering, ties and the metric toggle itself are unchanged.
- This is the commit that makes the leaderboard's label and its data agree again. Entry 68 deliberately left `bounties` weekly so this pair would move together — relabelling without repointing, or repointing without relabelling, reintroduces exactly the mismatch entry 68 avoided.
- `src/index.template.html` — the button label becomes `Recent`. `.leader-toggles` puts **four** buttons on one row at 320px, so "Last 7 days" does not fit; `Recent` is the same width as `Weekly` and opposes `Overall` cleanly. Where there is room — the card hint and the tile scope labels — the span is spelled out in full.
- **`#leaderWeekBtn` keeps its id**, as do `#weeklyTrend` and `#weeklyTrendCard`. They are asserted in `tests/static-check.mjs`; renaming ids is churn across the suites for no user-visible benefit. Labels change, ids stay.
- The toggle's `aria-label="Time range"` group stays; the button's `aria-pressed` behaviour is unchanged.

### Tests
- `tests/client-state.dom.test.js`: with the recent scope selected, a person whose only points are eight days old sorts below one who scored inside the window — the assertion that proves the window moved and not just the label. The existing toggle assertions (`aria-pressed` flipping, the metric toggle, the scope surviving a repaint) keep passing untouched.
- `tests/static-check.mjs`: `#leaderWeekBtn` still exists and its label reads `Recent`; the string `>Weekly<` no longer appears in the template.

### Do not
Rename `#leaderWeekBtn`, `#weeklyTrend` or `#weeklyTrendCard`; add a third scope; add a localStorage key to remember the scope (rule 4 — no entry authorises one); or let the buttons wrap to a second row at 320px. Do not change what the `Bounties` metric counts — entry 68 already set that window.

---

## 69. Three titles for the habits people keep

Status: Done — 2026-08-01
Notes: Commit `Add crew habit titles`. Archived entry 68. index.html 155,300 → 157,644 bytes
(+2,344, 92.7% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
The app names exactly one thing a person can be: Bounty Hunter. Points reward showing up and the balanced-day bonus rewards spreading it around, but nothing names the crewmate who climbs four times a week or the one who actually does their mobility. Those are the habits the trip is training for, and the data to see them is already in the credit engine.

### Requirements
- **Sequencing:** entries 67 and 68 land first — `windowStart()` and the Titles card. This entry adds tiles to that card.
- **Most days in the window, ties shared.** A title goes to whoever has the most credited days of that category in the last seven days, and everyone tied for the top holds it. Nobody holds it when every count is zero — the same `maxB>0` guard `totalsModel()` already applies to 🏹 (`src/app.js:42`). There is deliberately **no minimum, floor or qualifying bar**: in a quiet week the title still goes to whoever did the most, exactly as Bounty Hunter goes to someone with a single claim. One rule governs all six titles in this card rather than two.
- `src/app.js` — pure helper `categoryDays(nameLower,type,today)`: count that person's logs of that `type` whose date is inside `[windowStart(today), today]` **and** whose `computeCredits(logs).info` credit is greater than zero. A credited entry *is* a distinct day, because the engine credits only the first log of each category per day (`daySeen`, `src/app.js:28`) — so this counts days without needing a second day-set. It is the same derive-from-`info` pattern `bountyWeekProgress()` uses at `src/app.js:55`.
- `src/app.js` — pure helper `crewTitles(today)` returning one row per title: `{id,glyph,title,scope,holders,detail}`. The three category titles live in a module-level constant in `app.js` — **not** `scoring.json` (rule 2); keeping them here is what lets a later entry adjust them without an organizer redeploy:

  | Title | Glyph | Category |
  |---|---|---|
  | Rock Hound | 🪨 | `climb` |
  | Gym Rat | ⚙️ | `exercise` |
  | Yogi | 🌿 | `mobility` |
- Glyphs are **not** `CAT_ICONS` (🧗 💪 🧘). Those already mean "logged a climb" throughout the log and bounty cards, and reusing them would read as an activity rather than a title.
- `src/index.template.html` / `src/styles.css` — the Titles card holds a tile grid: `grid-template-columns:repeat(auto-fit,minmax(150px,1fr))`, which wraps to one column at 320px and needs no media query. Each tile carries the glyph, the title name, the holders (or `—`), and the qualifying figure (`4 of last 7 days`) so the title explains itself. The window label reuses the existing `.champ-scope` treatment — 10px, weight 800, uppercase, `.06em` tracking, `--muted` — because the window is the genuinely confusing part of this feature, and encoding it in the design beats a paragraph of copy. Held tiles take the `--orange-tint`/`--orange-ring` fill already used by `.me-row`; unheld tiles stay flat. Match the stylesheet's compact single-line formatting.
- Names and figures use `--ink`/`--muted`. The glyph and the tile fill carry identity — never colour the text by standing.
- The container carries `aria-live="polite"`; decorative glyphs are `aria-hidden="true"` with the title name in text (rule 7).

### Tests
- `tests/client-state.state.test.js`: `categoryDays` counts a climb logged on each of four days in the window as `4`; a second climb the same day does not raise the count (it is credited `0`); another person's logs are excluded; an unknown name is `0`. Take the window boundary from entry 67 rather than re-deriving it: with `today` at `2026-07-13` a log dated `2026-07-07` is the oldest one inside the window and `2026-07-06` is outside — assert both. `crewTitles()` gives Rock Hound to whoever has the most climb days in the window and not to the runner-up; two people tied at the top both hold it; every title reports empty holders on an empty roster and when nobody logged that category in the window. **Assert the no-minimum case explicitly**: one person with a single mobility day and nobody else logging mobility holds Yogi — that is the intended rule, and pinning it stops a later reader from filing it as a bug.
- `tests/client-state.dom.test.js`: with a crafted roster, the Titles card renders a tile per title, a held tile names its holder and its count, an unheld tile renders `—`, and a repaint is idempotent (`render()` runs often — rule 6). The `#bountyHunter` assertions from entry 68 keep passing.
- `tests/static-check.mjs`: the tile container exists inside the Titles card with `aria-live="polite"`; the grid rule and the tile classes are styled in CSS; `function categoryDays(` and `function crewTitles(` are present; and none of 🧗 💪 🧘 appears in the titles constant.

### Do not
Add a minimum, a floor or a qualifying bar to any title — a quiet week's holder is the intended behaviour, not a defect, and it is the behaviour 🏹 has always had. Put the titles constant in `src/scoring.json` (rule 2), rank the holders of one title against each other, or break a tie. Do not write copy about a title nobody holds, how far anyone is from the leader, or how many days someone has left — the tone rule forbids the absence framing and aggregating it does not launder it; an unheld tile shows `—` and says nothing. Do not add a localStorage key (rule 4), a media query where `auto-fit` does the work, or a fourth category.

---

## 67. A rolling seven-day window

Status: Done — 2026-08-01
Notes: Commit `A rolling seven-day window`. Archived entry 66. index.html 154,670 → 155,020 bytes
(+350, 91.2% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

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

## 66. Re-baseline the bundle budget for the rolling-window pass

Status: Done — 2026-08-01
Notes: Commit `Re-baseline the bundle budget for the rolling-window pass`. Archived entry 65.
Measured index.html at 154,670 bytes after entries 58–65 and set the rolling-window-pass budget to
170,000 bytes (91.0%). `npm test`: 5/5 suites.
Deviations: None.

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

## 65. Stop promising a local delete cannot be undone

Status: Done — 2026-08-01
Notes: Commit `Stop promising a local delete cannot be undone`. Archived entry 64. index.html
154,455 → 154,670 bytes (+215, 93.7% of the 165,000-byte budget). `npm test`: 5/5 suites.
Deviations: None.

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

## 64. Say the size of the field next to a rank

Status: Done — 2026-08-01
Notes: Commit `Say the size of the field next to a rank`. Added a pure rank label that names the
ranked roster field in the You stat and person card, while preserving zero-log crew members in the
field. Archived entry 62. index.html 154,286 → 154,455 bytes (+169, 93.6% of the 165,000-byte
budget). `npm test`: 5/5 suites.
Deviations: None.

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

## 62. Key the heatmap shades

Status: Done — 2026-07-31
Notes: Commit `Key the heatmap shades`. Added a static, non-interactive heatmap shade key using
the existing five shade classes, with one accessible text alternative. Archived entry 61 into the
new current `entries-61-onward.md` pass because the previous archive would exceed the 90,000-byte
cap. index.html 153,623 → 154,286 bytes (+663, 93.5% of the 165,000-byte budget). `npm test`:
5/5 suites.
Deviations: None.

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

## 61. Mark today's bounties you have already claimed

Status: Done — 2026-07-31
Notes: Commit `Mark today's claimed bounties`. Added `claimedTodayIds()` to identify a person's
same-day bounty claims without consulting scoring, then used the single set in `renderBounties()`
to append the state to the existing description and accessible claim label while preserving its
enabled one-tap markup. Archived entry 60. index.html 153,245 → 153,623 bytes (+378, 93.1% of the
165,000-byte budget). `npm test`: 5/5 suites.
Deviations: None.

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
## 71. Retire the podium medals

Status: Done — 2026-08-01
Notes: Commit `Retire podium medals`. Archived entry 70. index.html 156,839 → 156,196 bytes
(-643, 91.9% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
`podiumMedals()` (`src/app.js:44`) puts 🥇🥈🥉 beside names in the leaderboard, dense-ranked on whichever metric the toggle is showing. That is a third encoding of an ordering the table already states twice — the rows are sorted, and each carries its numeric rank, which is the unambiguous version of the same fact and does not stop at three. With 👑 Beast and 🔥 On Fire naming the top of both scopes as of entry 70, the medals are the redundant one, and a row that can carry 🥇 plus a title glyph plus the 🏹 span is exactly the clutter this pass set out to reduce.

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

## 68. Bounty Hunter counts the last seven days

Status: Done — 2026-08-01
Notes: Commit `Count Bounty Hunter over seven days`. Archived entry 67. index.html 155,020 →
155,300 bytes (+280, 91.4% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
🏹 is decided on calendar weeks: `totalsModel()` reads `bountyWeekCount` at `weekKey(challengeToday())` (`src/app.js:42`), so on a Monday the tag reflects one day of claims and it resets to nobody every seven days regardless of what the crew is doing. The tag and the six-point weekly cap are already independent in the engine — `bountyUsed` enforces the cap while `bountyWeekCount` feeds the tag, and the tag counts every claim whether or not it scored, which `tests/client-state.state.test.js:65` pins. So the tag's window can move without touching scoring at all.

### Requirements
- **Sequencing:** entry 67 lands `windowStart()` first. This entry consumes it; if it is missing, implement 67 rather than inlining the date arithmetic.
- `src/app.js` — `totalsModel()` gains a **new** row field `recentBounties`: that person's `type==='bounty'` logs whose date falls in `[windowStart(challengeToday()), challengeToday()]`, counting every claim credited or capped, exactly as `bountyWeekCount` does today. `hunters`/`huntCount` are computed from `recentBounties` instead of `bounties`; the `maxB>0` guard is unchanged, so nobody holds the tag when every count is zero.
- **Leave the existing `bounties` field on calendar weeks — do not repoint it.** It has two other consumers that are still weekly at this point in the pass, and repointing it would publish rolling counts under calendar-week labels the moment this entry merges: the leaderboard's `Bounties` metric, labelled `Weekly` until entry 72, and `personSummary()`, which the person card renders as "N this week". Entry 72 switches the leaderboard metric to `recentBounties` and relabels it in the same commit. The person card's figure **stays weekly on purpose** — the six-point cap it reflects is weekly, so "this week" is the true label there. Entries ship independently, so an intermediate state that lies is a defect, not a rounding error.
- `src/index.template.html` — the card's `<h2>Bounty Hunter</h2>` becomes `<h2>Titles</h2>` and its `<span class="hint">This week</span>` becomes `Last 7 days`. **Keep `#bountyHunter`** as the first row inside the card; it is asserted in `tests/static-check.mjs`, and renaming ids is churn across the suites for no user-visible benefit. Entries 69 and 70 fill the rest of this card.
- **The weekly bounty cap stays on calendar weeks.** `SCORING.weeklyBountyCap` lives in the frozen `src/scoring.json` and the cap is real scoring maths — making it rolling would retroactively rescore live crew points (rules 1 and 2). `#bountyCapHint` keeps its "this week" wording and `bountyWeekProgress()` keeps reading `weekKey`. The cap resetting on Monday while the tag rolls is deliberate; the two surfaces must never both say "week".
- `weekReviewModel()` keeps its own calendar-week hunter (`src/app.js:50`) — it reviews a bounded week and needs a bounded figure.

### Tests
- `tests/client-state.state.test.js`: with `challengeToday()` stubbed at `2026-07-13`, a claim dated `2026-07-07` — **six** days old, the first day of the window — counts toward `recentBounties`, and one dated `2026-07-06` does not. Seven days *inclusive* means `today-6` is the earliest date in the window, which is what entry 67 pins; a test written to expect a seven-day-old claim to count would silently specify an **eight**-day window, and every downstream entry in this pass would inherit it. A claim capped to `0` credit still counts, keeping the existing "every completion counts toward Bounty Hunter" guarantee at line 65 true under the new window; two people tied both appear in `hunters`; `huntCount` is `0` and `hunters` empty when nobody has claimed in the window. Assert in the same test that `bounties` still reports the **calendar-week** count for that roster, so the deliberate split between the two fields is pinned rather than merely described. Every existing assertion in that block keeps passing.
- `tests/client-state.dom.test.js`: `#bountyHunter` renders the holder line from the rolling count, while the You tab's `#bountyCapHint`, the leaderboard's `Bounties` metric and the person card's bounty figure all still report the **calendar-week** number — assert them together, because this entry's whole risk is one field quietly changing meaning for consumers it was not meant to touch.
- `tests/static-check.mjs`: the card's heading reads `Titles`, its hint reads `Last 7 days`, and `#bountyHunter` still exists inside it.

### Do not
Touch `bountyUsed`, `SCORING.weeklyBountyCap`, or anything in `computeCreditsRaw()`'s bounty branch that decides credit (rule 2 — `scoring.json` is the browser/backend contract, and changing it forces an API version bump and an organizer redeploy). **Do not repoint the existing `bounties` field**, and do not "tidy up" by pointing the leaderboard metric or the person card at `recentBounties` here — that is entry 72's job for the leaderboard, and never the person card's. Do not make `#bountyCapHint` or the claimed list say "last 7 days"; they report the cap, which is weekly. Do not rename `#bountyHunter`, and do not change `weekReviewModel()`.

---

## 70. On Fire and Beast

Status: Done — 2026-08-01
Notes: Commit `Add On Fire and Beast titles`. Archived entry 69. index.html 157,644 → 156,839 bytes
(-805, 92.3% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
`#leaderChampions` (built inside `render()`, `src/app.js:105`) already computes both of the standings this crew cares about — `lead('week')` and `lead('total')` — and renders them as an unnamed "🏆 Points · This week · Overall" line above the leaderboard. The figures are right; they just have no names, and they sit in a panel that duplicates what the leaderboard's own ordering already shows. Naming them turns two anonymous numbers into titles and lets the panel retire, which is how this pass adds six titles while leaving the Crew tab simpler than it found it.

### Requirements
- **Sequencing:** entry 69 lands the tile grid. This entry adds two tiles to it and removes a panel.
- `src/app.js` — **`totalsModel()` gains a `recent` field on each `sorted` row**: that person's points over `[windowStart(challengeToday()), challengeToday()]`, summed from `dayTotal`. This field has to exist before On Fire can be computed the way the rest of this card is — `sorted` rows currently carry only `name`, `total`, `week`, `bounties` and `bountiesTotal`, none of which is a rolling points figure. Entry 72 consumes the same field rather than deriving it a second time.
- `src/app.js` — `crewTitles()` gains two standing titles, each read off `totalsModel().sorted` exactly as `lead()` does today (highest value, ties shared, nobody holds it when the top value is `0`) — the same rule entry 69 applies to the category titles, so one rule now governs all six tiles:

  | Title | Glyph | Field | Scope label |
  |---|---|---|---|
  | On Fire | 🔥 | `recent` | `LAST 7 DAYS` |
  | Beast | 👑 | `total` | `ALL CHALLENGE` |

  Each tile's detail line carries the value (`214 pts`), so retiring the panel loses no information.
- The two scope labels are why entry 69 put the window into the tile design: this card now holds titles on two different windows, and the reader has to be able to tell at a glance.
- **Retire `#leaderChampions`.** Remove the markup from `src/index.template.html`, the block that builds it in `render()`, and the `.champions`/`.champ-line`/`.champ-who`/`.champ-val` rules from `src/styles.css`. **Keep `.champ-scope`** — entry 69 reuses it for the tile window labels. Its 🎯 Bounties line goes with it: that information is Bounty Hunter, already a tile since entry 68.
- **Rule 3 carve-out, sanctioned by the maintainer.** This entry deliberately removes a feature, so it retires that feature's assertions: the `#leaderChampions` presence and source-order assertions in `tests/static-check.mjs`, the `.champions`/`.champ-line` CSS assertions, and the champions-content assertions in `tests/client-state.dom.test.js`. Name each one in the commit message. Every other assertion in those files keeps passing untouched, and no assertion for a feature that still exists may be weakened.

### Tests
- `tests/client-state.state.test.js`: On Fire holders are whoever has most points in the window, ties shared, empty when everyone is at `0`; a bounty claimed in the window counts toward On Fire — the case `dayMeter` would have missed and `dayTotal` exists to catch. Beast matches the top of `totalsModel().sorted`. Someone leading all challenge but quiet for eight days holds Beast and not On Fire; that separation is the point of having both.
- `tests/client-state.dom.test.js`: both tiles render with holder and value; `#leaderChampions` is gone from the document; the leaderboard's own rows and ordering are unchanged.
- `tests/static-check.mjs`: `.champ-scope` is still styled and `.champions{`/`.champ-line{` are not; `#leaderChampions` does not appear in the template.

### Do not
Sum `dayTotal` inside `crewTitles()` — the rolling figure belongs on `totalsModel().sorted` as `recent`, where entry 72 also reads it, and a second derivation is the fork rule 6 forbids. Do not keep a trimmed champions panel "just for the values"; the values live on the tiles now, and leaving both is the duplication this entry exists to remove. Do not remove the leaderboard, its rank column, or its scope toggle — entry 72 handles the toggle. Do not report anyone's distance from a leader.

---

## 78. Draw the curve on day one, and the smallest bars at all

Status: Done — 2026-08-01
Notes: Commit `Fix day-one curve and bar floors`. Archived entry 77. index.html 155,411 →
155,877 bytes (+466, 91.7% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

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

## 80. Raise the progress bar, the sorted column and the meter fills to a visible contrast

Status: Done — 2026-08-01
Notes: Commit `Raise visible contrast`. Archived entry 79. index.html 155,985 → 156,050 bytes (+65, 91.8% of the 170,000-byte budget). Meter ratios against sand (climb/exercise/mobility/bonus) light 7.34/3.64/4.80/3.64, dark 5.26/5.69/4.94/5.69; orange-ink progress against sand 3.64/5.69 and sorted text against card 4.83/7.38. Heatmap adjacent ratios (base→1→2→3→4) light 1.22/1.23/1.23/1.22, dark 1.39/1.42/1.43/1.43. `npm test`: 5/5 suites. Deviations: None.

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

Status: Done — 2026-08-01
Notes: Commit `Unify focus ring contrast`. Archived entry 80. index.html 156,050 → 155,931 bytes (-119, 91.7% of the 170,000-byte budget). Green ring ratios against bg/card/input/wash/orange-tint: light 8.77/9.73/9.91/8.18/8.42, dark 7.52/6.83/6.26/6.61/6.73. `npm test`: 5/5 suites. Deviations: None.

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
