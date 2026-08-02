# v11 pass — entries 84 onward

The current open archive file: rule 10 moves each finished entry here. When it approaches the
per-file cap in `tests/docs-check.mjs`, start the next file rather than raising the cap.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.

## 89. Collapse the superseded 44px one-offs and the declarations the cascade already discards

Status: Done — 2026-08-01
Notes: Commit `Collapse superseded CSS declarations`. Archived entry 88. index.html 156,624 → 156,324 bytes (-300 bytes, 92.0% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
Entry 85 gave the base classes their 44px minimum and its own "Why" named the underlying debt: `.head-actions .text-btn`, `.del` and `#bountyWeekToggle,#claimedToggle` were "three separate one-off patches of the same defect". Now that `.text-btn` carries the minimum itself, those patches are duplicates of the base rule, and a maintainer reading the file still cannot tell where a control's 44px actually comes from. Alongside them sit four declarations that never reach a pixel because a later rule overrides them verbatim.

All in `src/styles.css`, where cascade order is line order:

- `:21` `.head-actions .text-btn{display:inline-flex;align-items:center;min-height:44px}` — a byte-identical declaration block to `.text-btn` at `:34`, at higher specificity. Same computed style.
- `:24` `#bountyWeekToggle,#claimedToggle{min-height:44px}` — both elements carry `class="text-btn"` (`src/index.template.html:32`), so `:34` already gives them the minimum.
- `:22` `.undo-bar #undoDelete,.undo-bar #undoDismiss{min-height:44px;flex:none}` — `#undoDelete` is `.text-btn` (44px at `:34`) and `#undoDismiss` is `.icon-btn` (44px at `:3`). **Only `min-height:44px` is redundant here; `flex:none` is load-bearing and stays.**
- `:9` `.pts,.rank,.bottom-nav button.active{color:var(--orange-ink)}` — all three selectors already set that exact colour at `:3`. The whole rule is a no-op.
- `:3` `.del{…min-width:35px;min-height:35px}` — overridden verbatim by `.del{min-width:44px;min-height:44px;border-radius:10px}` at `:9`.
- `:3` `.progress i{…background:var(--green);transition:width .3s}` — both declarations overridden by `.progress i{background:var(--orange-ink);transition:width .4s cubic-bezier(.4,0,.2,1)}` at `:9`.
- `:18` `.trend-baseline{stroke:var(--line);stroke-width:1}` — `stroke` overridden by `:30`. **`stroke-width:1` is not set at `:30` and stays.**

### Requirements
- `src/styles.css` only, plus tests. Nothing a user sees may change — every removal is either a byte-identical duplicate or a declaration the cascade already discards. Verify in the built page that the 44px targets entry 85 established are still met.
- Remove the rules and declarations listed above, keeping `flex:none` in the `.undo-bar` rule and `stroke-width:1` on `.trend-baseline`. `min-height:44px` occurs seven times in the file, so scope that edit inside the `.undo-bar` rule rather than replacing globally.
- **Explicitly leave alone**, all verified as load-bearing: `.del{min-width:44px…}` at `:9` (the base `.del` is 35px, so this rule is the only thing giving the delete button its target); `.card.table-card{padding:18px 0}` at `:31` (a specificity bump that beats `@media(max-width:430px){.card{padding:17px}}` at `:8`, and is pinned by `tests/static-check.mjs:252`); `.btn.primary` at `:9` (changes the token). Also leave `.tab-panel.active` and `.bottom-nav button.active` — those classes are live.
- This entry should reduce `index.html` by roughly 300 bytes. Do not raise `BUDGET` (rule 3).

### Tests
- `tests/static-check.mjs:154` asserts the literal `#bountyWeekToggle,#claimedToggle{min-height:44px}`, which this entry removes. **Per rule 3 this assertion is named here and its coverage is replaced, not dropped:** assert instead that both ids carry `class="text-btn"` in `src/index.template.html` and that `.text-btn` declares `min-height:44px` (already asserted at `:191`). The guarantee — those two controls are 44px tall — stays covered; only its route changes.
- `tests/static-check.mjs`: assert `.del`, `.progress i` and `.trend-baseline` each appear exactly once with the surviving values, so a future entry cannot quietly re-add a shadowed duplicate.
- No other assertion touches these rules: `:230` pins only the `:30` form of `.trend-baseline`, and `:70`/`:76` still match after the `.progress i` removal. Confirm that before editing.

### Do not
Do not remove `flex:none` from the `.undo-bar` rule or `stroke-width:1` from `.trend-baseline`. Do not change any colour token, padding, font or radius — this entry deletes dead text and changes no computed style. Do not "tidy" any rule not listed above. Do not weaken the 44px guarantees entry 85 shipped; this entry consolidates where they come from, it does not relax them.

---

## 85. Give the Bounty Hunter marker visible text and the small controls a 44px target

Status: Done — 2026-08-01
Notes: Commit `Label Bounty Hunter controls`. Archived entry 84. index.html 156,367 → 156,621 bytes (+254, 92.1% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

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

## 86. Count a bounty-only day as a day you were active

Status: Done — 2026-08-01
Notes: Commit `Count bounty-only days as active`. Archived entry 85. index.html 156,621 → 156,621 bytes (0 bytes, 92.1% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
The heatmap card is titled "Daily activity" / "Points per day" (`src/index.template.html:38`), but `heatmapDays()` reads `dayMeter` (`src/app.js:95`), and `dayMeter` is the **category meter**, not points per day. In `computeCreditsRaw()` the bounty branch calls `addWeek`, `addTotal` and `addDayTotal` and then `continue`s — it never reaches `addMeter` (`src/app.js:30`). `dayMeter` also clamps each day to `DAILY_MAX`, which is right for a meter and wrong for a total.

So a day on which someone claimed bounties and logged nothing else is worth real points everywhere else in the app, and renders as a **blank `heat0` square** — identical to a day they did nothing. The chart erases work that was done. The same wrong map is read by three more surfaces, so the error is consistent across the You tab rather than isolated:

- `heatmapDays()` (`:95`) — the blank square, and `heatmapCaption()` (`:96`) undercounts "N active days" and can name the wrong best day.
- `streakInfo()` (`:99`) — a bounty-only day **breaks the streak**.
- `personalRecords()` (`:92`) — `bestDay` ignores bounty points, so "Best single day" can be beaten by a day it does not show.
- `weekReviewModel()` (`:52`) — `activeDays` in the Week in Review undercounts the same way.

This is settled, documented ground: entry 67 created `dayTotal` precisely because "`dayMeter` skips bounty points entirely (the bounty branch `continue`s before `addMeter`) and clamps to `DAILY_MAX` … copying it here would silently drop bounty points" (`docs/archive/entries-61-onward.md:296`). The heatmap shipped before `dayTotal` existed and was never migrated.

### Requirements
- `src/app.js` only, plus tests.
- Move these four readers from `dayMeter` to the `dayTotal` map that `computeCredits()` already returns: `heatmapDays()` (`:95`), `streakInfo()` (`:99`), `personalRecords()`'s `bestDay` accumulation (`:92`), and `weekReviewModel()`'s `activeDays` count (`:52`). Do not re-derive any of these totals — read the map (rule 6).
- **Two readers of `dayMeter` are correct and must not change:** `todayProgress()` (`:76`) and `updateRecordPreview()`'s `meterAfter` (`:140`). Those drive the eight-pip day meter, which is deliberately per-category and deliberately capped at `DAILY_MAX`. Changing them would let a bounty fill the meter and misreport the balanced-day bonus.
- `heatLevel()` (`:94`) saturates at `>=DAILY_MAX`, so uncapped input is already safe and needs no change.
- Fix all four in one commit. Migrating only the heatmap would leave a bounty-only day showing as a coloured square while "Current streak" still treats it as a broken chain and "Best single day" still ignores it — a visible contradiction on one screen.

### Tests
- `tests/client-state.state.test.js`: with a fixture in which a person claims a bounty and logs nothing else that day — the heatmap day carries that day's points and a non-zero `heatLevel()`; `heatmapCaption()` counts it as an active day; `streakInfo()` treats it as continuing the streak; `personalRecords().bestDay` reflects it. Assert the day meter is unchanged for the same fixture, so the split between `dayTotal` and `dayMeter` is pinned rather than assumed.
- `tests/client-state.state.test.js:450-461` currently carries the message `'points come from dayMeter'` on an assertion whose 3/2/0 values are identical under either map (the fixture has no bounties). Reword that message to name `dayTotal`. **Per rule 3 this is named here deliberately:** the assertion and its expected values stay exactly as they are — only the description string changes, and no coverage is retired.
- `tests/client-state.dom.test.js`: a bounty-only day is not rendered as an empty `heat0` cell.

### Do not
Do not change `DAILY_MAX`, the balanced-day bonus, the weekly bounty cap, or anything in `computeCreditsRaw()` — the scoring is correct; only the four readers are wrong. Do not point `todayProgress()` or the record preview at `dayTotal`. Do not add a new map to the object `computeCredits()` returns. Tone rule: this entry only ever **adds** days a person was active — it must not introduce an inactive-day count, a "days missed" figure, or any streak-loss warning.

---

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

## 87. Make "rank" mean one thing

Status: Done — 2026-08-01
Notes: Commit `Clarify all-time rank labels`. Archived entry 86. index.html 156,621 → 156,634 bytes (+13 bytes, 92.1% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
The app shows a person two different ranks, one tap apart, and both are labelled just "rank".

`render()` paints the leaderboard from `rankLeaders(model.sorted,metric)` and numbers the rows `#${i+1}` (`src/app.js:114`) — a rank in the **currently selected metric and scope**, which defaults to Recent (`leaderScope='week'`, `src/app.js:36`). But `#youRank` on the You tab (same line) and `personSummary().rank` (`src/app.js:109`) both use `model.sorted.indexOf(...)`, and `model.sorted` is sorted `b.total-a.total||a.name.localeCompare(b.name)` (`src/app.js:44`) — **all-time points only**.

With a crew of two where Bo has 48 older points and Alex 30 recent ones, the default Crew tab shows Alex at `#1`; tapping that very row opens a card reading `Rank #2 of 2`; the You tab's "Crew rank" stat also reads `#2 of 2`. Nothing on screen explains that these are two different questions. Any crew whose recent order differs from its all-time order hits this, which is most crews after week two.

### Requirements
- `src/index.template.html` and `src/app.js`, plus tests. Label the two all-time figures for what they already are rather than changing any ranking maths.
- `src/index.template.html:34`: the `#youRank` stat's `<span>` label becomes "All-time rank".
- `src/app.js:112`: `renderPersonCard()`'s `cell('Rank',…)` becomes `cell('All-time rank',…)`.
- Leave the leaderboard alone. Its `<th>Rank</th>` sits inside a table whose runtime `aria-label` already names the active metric and range (`src/app.js:114`), and the `.seg-toggle` pair states the scope on screen.
- Do not touch `rankLabel()` (`:45`), `rankLeaders()` (`:46`), `model.sorted`'s comparator (`:44`), or `personSummary()`'s rank derivation (`:109`). This entry changes two label strings and nothing else.
- Keep the stat grid's alignment from entry 84 intact — "All-time rank" is longer than "Crew rank", so verify at 320px that the label does not push the figure out of line or wrap the cell.

### Tests
- `tests/static-check.mjs`: the `#youRank` stat's visible label reads "All-time rank"; the leaderboard's rank column header is unchanged.
- `tests/client-state.dom.test.js`: with a crew whose recent order differs from its all-time order, the person card's rank cell is labelled "All-time rank" and still reports the all-time position; the leaderboard's row numbering still follows the selected metric. This pins the two ranks as deliberately different rather than as a bug someone later "fixes" by unifying them.

### Do not
Do not change how any rank is computed, and do not make the leaderboard and the You tab agree by re-sorting either one — they answer different questions and both answers are wanted. Do not introduce dense ranking for ties; positional ranks with an alphabetical tiebreak are the current behaviour and changing that is a separate entry. Tone rule: do not add a rank-change indicator, a "dropped N places" line, or anything reporting a decline.

---

## 88. One name key, so one odd Sheet row cannot empty or crash the You tab

Status: Done — 2026-08-01
Notes: Commit `Handle irregular Sheet names`. Archived entry 87. index.html 156,634 → 156,624 bytes (-10 bytes, 92.1% of the 170,000-byte budget). `npm test`: 5/5 suites. Deviations: None.

### Why
Every name comparison in the app goes through `nameKey()` — `String(x&&x.name||'').trim().toLowerCase()` (`src/app.js:25`) — except one. `render()` filters the personal feed with `logs.filter(x=>x.name.toLowerCase()===meLower)` (`src/app.js:114`): no trim, no string coercion.

`sanitizeActivities()` (`src/app.js:19`) validates `type` and leaves `name` as it arrived, so a row typed straight into the Sheet reaches this filter raw. Two failures follow, both verified by running `render()`:

- **A leading space** (`name:' Alex'`). The totals use `nameKey()` and count the row; the feed filter does not. The You tab shows "Total points 5" and a crew rank, while `#personalActivity` is hidden and the "New here? … Log something to start your streak" empty state is displayed. One screen, flatly contradicting itself.
- **A numeric cell** (`name:7`, or a column shifted by one). `x.name.toLowerCase` is not a function, so `render()` throws. `loadRemote()` calls `render()` inside its own `try` (`src/app.js:147`), so the throw is caught by the **network** handler; `syncFailureCode()` (`:144`) has no branch for it and returns the default. The crew sees "Sync failed · retry ↻", "Could not reach the Sheet" and the code `RTS-REFRESH-NETWORK` — while `logs` has already been replaced. The Sheet was reached perfectly well; retrying cannot help, and the diagnostic points at the wrong thing.

### Requirements
- `src/app.js` only, plus tests. The fix is entirely client-side, and it is a **read-site** fix only.
- Use the existing `nameKey(x)` helper for the personal-feed filter at `src/app.js:114` — `const myLogs=logs.filter(x=>x.name.toLowerCase()===meLower)` — instead of `x.name.toLowerCase()`, so it matches how the totals were computed. `nameKey()` already does `String(x&&x.name||'')`, so this alone fixes both the whitespace contradiction and the numeric-name throw; no coercion at ingestion is needed.
- **That one filter is the whole exposure — verify before widening.** Line 114 contains four `x.name.toLowerCase()` reads, but only the `myLogs` filter iterates `logs`; the other three read `model.sorted` and `leaders`. Every other raw `.name.toLowerCase()` in the file (`:44`, `:52`, `:59`, `:109`, `:179`) iterates `config.crew` or a crew-derived model, and `normalizeCrew()` (`:16`) already coerces those with `String(x&&x.name||'')).trim()`. Activity rows are the only unnormalized source.
- **Do not coerce `name` inside `sanitizeActivities()` (`src/app.js:19`) or anywhere else on the ingestion path.** `sanitizeActivities()` runs on the `roadToSendLogsV9` load (`src/app.js:37`, `:184`), and `persistLocal()` (`src/app.js:40`) serializes `logs` **wholesale** with `JSON.stringify(logs)`. Normalizing on ingestion would therefore rewrite every historical row's stored name on the next save or delete — a rule 1 violation, and a contradiction of this entry's own next requirement. Leave `sanitizeActivities()` exactly as it is.
- **`src/apps-script.js` is out of scope** (rule 2). `normalizeActivityRow()` there does not trim or coerce, and that stays true; the client must tolerate what the Sheet sends.
- Do not change any stored data, and do not rewrite what is posted back to the Sheet — only what the client reads (rule 1).

### Tests
- `tests/client-state.dom.test.js`: with a log row named `' Alex'` for the current user, the personal feed lists it and the "New here?" empty state is **not** shown, while the totals are unchanged. With a row named `7`, `render()` completes without throwing.
- `tests/client-state.state.test.js`: `sanitizeActivities()` returns each row's `name` **unchanged** — `' Alex'` stays `' Alex'` and `7` stays `7`. This pins the read-site-only approach so a later change cannot reintroduce ingestion normalization and start rewriting stored names.
- `tests/client-state.shared.test.js`: a remote payload containing a numeric name loads and renders without the sync status falling to the failure state — the Sheet was reachable, so the app must not report a network failure.

### Do not
Do not touch `src/apps-script.js`, `src/schema.json` or `src/scoring.json` (rule 2). Do not rename or re-key anything in localStorage (rule 4). **Do not normalize, trim, coerce or rewrite any stored activity row** — `persistLocal()` writes `logs` back wholesale, so mutating a row on load silently edits the crew's history (rule 1). Do not silently discard rows with unexpected names — the crew's data stays visible; this is about reading it consistently. Do not add a new user-facing warning about malformed rows; the diagnostics surface already exists and this entry does not add copy to it. Tone rule: removing a false empty state is the whole point — do not replace it with any message about what someone has not logged.

---
