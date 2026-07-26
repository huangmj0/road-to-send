# Road to Send improvement backlog

This backlog is the historical record of the v6–v11 passes: the P0–P3 priorities below, the fourteen entries of the v11 frontend enhancement queue, and the feature commits that shipped without an entry. Everything recorded here has shipped. Live, unshipped work is queued in `IMPROVEMENT_LOG.md`, which is the only file implementers work from — this one is the audit trail and is never re-run.

## P0 — Define and enforce the challenge window

Status: implemented in API v6.

The interface describes a ten-week challenge, but the data model only has a trip date and currently counts activities outside any defined start/end window.

- Add an explicit challenge start date and decide whether the trip date is inclusive.
- Reject or visibly exclude entries before the start or after the end.
- Define behavior for timezone boundaries and backdated entries.
- Add unit tests for the first and last valid day, Sunday/Monday week boundaries, daylight-saving transitions, and entries logged after the trip.
- Derive “ten-week” and “November” copy from settings instead of hard-coding it.

## P1 — Improve maintainability and automated coverage

Status: implemented with source generation, shared contracts, smoke coverage, and CI.

The application, styles, and embedded Apps Script currently live in one compact HTML file. That makes reviews and behavioral tests unnecessarily difficult.

- Split browser code, styles, and Apps Script source into formatted files while preserving a simple deploy artifact.
- Define one versioned schema for settings, participants, activities, and error responses.
- Centralize scoring constants so browser and backend cannot drift.
- Keep unit coverage for settings validation, scoring caps, the balanced-day bonus, the weekly bounty cap, challenge-window boundaries, bounties, malformed rows, and local-calendar date formatting current.
- Add contract fixtures for current, legacy, malformed, and partial Apps Script responses.
- Run the static UX checks and future behavioral tests in continuous integration.

## P2 — Clarify recovery and data ownership

Status: implemented with separated caches, retry-safe messaging, diagnostics, and recovery documentation.

- Distinguish “save failed” from “saved, but refresh failed” to prevent duplicate retries.
- Provide export, backup, and restore instructions for organizers.
- Keep local demo entries separate from cached shared entries.
- Show protocol version, last successful sync, and a copyable sanitized error code in diagnostics.

## P3 — Improve the available bounties

Status: resolved in API v9. Balanced three-category scoring (Climbing / Exercise / Mobility) with a
+2 balanced-day bonus, plus rotating daily bounties returned as a clear catalog in `src/scoring.json`.

- Circuit-board references removed.
- Bounties simplified to a curated catalog; three rotate per day (one per category), chosen
  deterministically from the date so the whole crew sees the same set.
- Each bounty has a fun name, a one-line description, and a 1–3 point value scaled to difficulty.
- A weekly bounty-point cap keeps them a spice; over-cap claims still count toward the 🏹 Bounty
  Hunter tag (most weekly completions) for bragging rights.

## v11 pass — frontend enhancement queue (entries 1–14)

Entries 1–14 of `IMPROVEMENT_LOG.md`, moved here verbatim on 2026-07-25 once all fourteen were `Done`. Entry numbers never restart, so the live queue continues at 15; nothing below is renumbered, reworded, or re-run. The only text added to the originals is the supersession sentence appended to entry 13's `Notes:`.

## 1. Per-category breakdown card (You tab)

Status: Done — 2026-07-20
Notes: Add per-category breakdown card to You tab. Pure helper `categoryBreakdown(nameLower)` sums credited points per type from `computeCredits(logs).info` (using `credit`) with the balanced-day bonus derived as total minus the four type sums; `renderBreakdown()` draws one row per category plus a Balanced bonus row into `#youBreakdown` (decorative aria-hidden bars, plain-text numbers), with a one-line empty state when the person has no credited points. No deviations from the spec.

### Why
The whole premise of the scoring economy is balance across Climbing/Exercise/Mobility/Bounties, yet the You tab only shows a single total. No per-category view exists anywhere.

### Requirements
- New pure helper (e.g. `categoryBreakdown(nameLower)`) that sums **credited** points per activity type from `computeCredits(logs).info` — use each entry's `credit`, not `base`, so daily-dedup and the weekly bounty cap match the leaderboard.
- Show the balanced-day bonus as its own "Balanced bonus" row (computed as total minus the four type sums, or tracked explicitly) so the rows visibly sum to `#youTotal`.
- New card on the You tab, placed after the `.stat-grid` card in `src/index.template.html`, with one row per category: emoji icon (`aria-hidden="true"`), label, credited points, and a proportional horizontal CSS bar (width = points / max row points). Bars are decorative (`aria-hidden`); the numbers are plain text, so no `role="img"` needed.
- Category labels/points derive from `SCORING.categories` and `CAT_ICONS`/`CAT_LABELS` if present — never hard-code point values.
- When the selected person has no credited points, show a one-line empty state inside the card (or hide the card) rather than five zero rows.
- Render from `render()`.

### Tests
- `tests/client-state.test.js`: helper returns capped sums (duplicate same-day climbs credit once), bounty over-cap weeks contribute at most `weeklyBountyCap` per week, rows + balanced bonus sum to the person's total.
- `tests/static-check.mjs`: assert the new container id exists inside the `you` panel.

### Do not
- Add a `<table>`; re-implement scoring; touch the Crew tab; hard-code `3/2/1/+2` in copy (derive from `SCORING`).

---

## 2. Weekly bounty-cap progress (You tab)

Status: Done — 2026-07-21
Notes: Show weekly bounty-cap progress on the You tab. Pure helper `bountyWeekProgress(nameLower,today)` sums credited bounty points for `weekKey(today)` from `computeCredits(logs).info` (caller passes `challengeToday()`; no clock reads inside). `renderBounties()` (called from `render()`) writes "X / N bounty points this week" into `#bountyCapHint` in the bounty card head (N from `SCORING.weeklyBountyCap`), appending the 🏹 Bounty Hunter note at/over the cap. The new hint span replaces the static "Rotates daily" hint at render time (the spec allows replacement); "Rotates daily" remains only as the pre-render fallback text. No other deviations.

### Why
The 6-point weekly bounty cap silently zeroes credit; users currently discover it only in the record-form preview at save time.

### Requirements
- Pure helper computing the selected person's **credited** bounty points for the current week: filter `computeCredits(logs).info` to `type==='bounty'` entries whose `weekKey(date)` equals `weekKey(challengeToday())`, summing `credit`.
- Render "X / N bounty points this week" (N = `SCORING.weeklyBountyCap`, never hard-coded) into the head of the existing "Today's bounties" card on the You tab, as muted hint text. When at/over cap, append a short note that further claims still count toward the 🏹 Bounty Hunter tag.
- Update from `render()`/`renderBounties()`. No `aria-live` needed (text updates only on re-render).

### Tests
- `tests/client-state.test.js`: helper for a week under cap, exactly at cap, and over cap (credited stays at cap).
- `tests/static-check.mjs`: assert the new element id exists.

### Do not
- Change `weeklyBountyCap`; alter the record-form preview logic (it already handles cap messaging); duplicate cap math instead of reading `computeCredits()` output.

---

## 3. Grade pyramid (You tab)

Status: Done — 2026-07-21
Notes: Add grade pyramid card to the You tab. Pure helper `gradePyramid(nameLower)` counts the person's `type==='climb'` logs per `hardestGrade` (all graded sends, including zero-credit same-day duplicates and outside-window entries; blank/unknown grades skipped), ordered hardest-first by `GRADES` index. `renderPyramid()` (called from `render()`) draws CSS-grid rows (grade label, proportional bar with `aria-hidden`, count) into `#gradePyramid` (`role="img"` with a per-grade send-count `aria-label` summary; no transitions on bars) and toggles the `hide` class on the wrapping card `#gradePyramidCard` when there are no graded climbs. Deviations: none — the card wrapper got its own id (`#gradePyramidCard`) so the whole card, head included, hides.

### Why
`hardestGrade` is captured on every climb entry and stored, but never aggregated — it only appears as flavor text in feeds.

### Requirements
- Pure helper (e.g. `gradePyramid(nameLower)`) returning counts of the person's climb entries per grade, ordered hardest-first by `GRADES` index (the `SCORING.grades` array), including only grades with count > 0. Blank/unknown grades are ignored. Count **all** graded climb logs including zero-credit same-day duplicates — a send is a send; this is deliberately not credit-weighted.
- New You-tab card rendering CSS-grid rows: grade label, horizontal bar sized proportionally to the max count, count number. Entirely hidden (e.g. `hide` class) when the person has no graded climbs.
- Wrapper has `role="img"` and an `aria-label` summary like "Grade pyramid: 3 sends at V5, 1 send at V4"; inner bars `aria-hidden="true"`. No transitions on bars.

### Tests
- `tests/client-state.test.js`: ordering follows `GRADES` index (V10 sorts above V9 — no string comparison), blank grades ignored, duplicates counted.
- `tests/static-check.mjs`: assert the new container id exists. (The single-`<table>` assertion implicitly verifies no table was used.)

### Do not
- String-compare grade names; filter by challenge window differently from the raw log list; show the card for users with zero graded climbs.

---

## 4. Streak tracking (You tab)

Status: Done — 2026-07-21
Notes: Add current and best streak cards to the You tab. Pure helper `streakInfo(nameLower,today)` collects the person's ≥1-point days from `computeCredits(logs).dayMeter` (in-window days only, so pre-start days never count), anchors the current streak at `today` or, failing that, `yesterday` (a zero-point today keeps yesterday's streak alive), and takes the longest run as best; all date stepping goes through `parseDateOnly`/`localDate` and the helper never reads the clock. Two new `.stat` cards (`#youStreak`/`#youBestStreak`, values "N days"/"1 day", "—" when none) join the existing `.stat-grid`, rendered from `render()`. No deviations from the spec.

### Why
Streaks are a strong daily motivator and `computeCredits().dayMeter` already contains per-person daily points.

### Requirements
- Pure helper `streakInfo(nameLower, today)` over `computeCredits(logs).dayMeter` (keys `name|date`): **current streak** = consecutive days with ≥1 point ending at `today` or `yesterday` — a zero-point `today` does not break the streak until the day is over; **best streak** = longest run within the challenge window. `today` is passed in by the caller from `challengeToday()`; the helper itself never reads the clock.
- Add two `.stat` cards ("Current streak" / "Best streak", value in days) to the existing `.stat-grid` on the You tab; the `1fr 1fr` grid wraps to a second row naturally — verify layout at 320px width.
- Date arithmetic via existing `parseDateOnly`/date-string helpers, not raw `Date` math on local time.

### Tests
- `tests/client-state.test.js`: single-day streak; gap resets; today-with-0-points keeps yesterday's streak alive; streak broken when yesterday is empty; best-streak over a window with two runs.
- `tests/static-check.mjs`: assert the two new stat ids exist.

### Do not
- Call `new Date()` inside the helper; count days before `config.startDate`.

---

## 5. Calendar heatmap of daily points (You tab)

Status: Done — 2026-07-21
Notes: Add daily activity heatmap card to the You tab. Pure helpers `heatmapDays(nameLower,today)` (enumerates `config.startDate` through `min(config.tripDate,today)` via `parseDateOnly`/`localDate`, returning `{date,points}` from `computeCredits(logs).dayMeter`; empty array for invalid windows or a today before the start — caller passes `challengeToday()`, no clock reads inside) and `heatLevel(points)` (intensity buckets 0 / 1–2 / 3–5 / 6–7 / max with thresholds derived from `DAILY_MAX`). `renderHeatmap()` (called from `render()`) draws a 7-column CSS grid into `#youHeatmap` (`role="img"` with an "Active X of N days, P points" summary; cells `aria-hidden` with `fmtDay` titles like "Jul 14 · 5 pts"; no transitions), pads the first row with blank placeholders so day one lands on its Monday-start weekday column, and fills the rest of the current week (capped at `tripDate`) with dashed "upcoming" cells visually distinct from zero-point past days; the whole card `#heatmapCard` hides via the `hide` class when the helper returns nothing. Cell colors ramp `--sand` → `--orange` via `color-mix()` steps in styles.css; the grid uses `repeat(7,minmax(0,1fr))` so cells shrink cleanly at 320px. No deviations from the spec.

### Why
Per-day effort (`dayMeter`) is invisible today; a heatmap shows consistency at a glance.

### Requirements
- Pure helper enumerating dates from `config.startDate` through `min(config.tripDate, challengeToday())` (pass `today` in as an argument), returning `{date, points}` per day from `computeCredits().dayMeter` for the selected person. Skip rendering entirely if the challenge window is invalid or hasn't started.
- Render a 7-column CSS grid (one row per week) in a new You-tab card. Each cell gets an intensity class stepped 0 / 1–2 / 3–5 / 6–7 / 8+ points (8 = `DAILY_MAX`, computed not hard-coded), colored on a `--sand` → `--orange` ramp, plus a `title` like "Jul 14 · 5 pts" (use `fmtDay`).
- Remaining future days in the window may render as dim "upcoming" placeholders but must be visually distinct from zero-point past days.
- Wrapper `role="img"` with `aria-label` summary like "Active 12 of 20 days, 96 points"; cells `aria-hidden="true"`. No transitions on cells.

### Tests
- `tests/client-state.test.js`: day-enumeration (start=end single day; multi-week span; capped at today), intensity bucketing at boundaries (0, 1, 2, 3, 5, 6, 7, 8).
- `tests/static-check.mjs`: assert the new container id exists.

### Do not
- Fetch anything; use `new Date()`; let the grid overflow the card on 320px screens (cells must shrink or the card scrolls internally).

---

## 6. Projected finish on the Crew tab

Status: Done — 2026-07-21
Notes: Add projected group finish line to the Crew tab. Pure helper `projectedTotal(total,settings,today)` (separate from `paceInfo`, which is untouched) returns null for invalid windows/goals, before the start, after the end, or with fewer than 3 elapsed days; otherwise `{projected}` = round(total/elapsed × totalDays), plus `goalDate` (the day cumulative rate×days first reaches the goal, clamped to the window end) whenever rate > 0 and the goal ≤ projected. New `<p id="goalProjection" class="hint hide" role="status" aria-live="polite">` right after `#goalPace`; `render()` fills it as "On pace for ~X points by the end" or "On pace to hit the goal around <fmtDay date>" and hides it on null. Today is always passed in (`challengeToday()` at the call site); no clock reads inside the helper. No deviations from the spec. Post-review refinement: both the projection and the pre-existing pace line now take a through-today group total from the new `earnedThrough(today)` helper (credited points for entries dated on or before today) instead of `model.total`, so future-dated entries — which the record form permits through the challenge end — no longer inflate the elapsed-days rate. `paceInfo`/`projectedTotal` signatures and their tests are unchanged; only the value passed at the render call site changed. Cumulative displays (group total, progress bar, leaderboard) still count all in-window entries.

### Why
`paceInfo()` already computes needed per-day rate; the natural next sentence is "at this rate the crew lands at ~X points".

### Requirements
- New pure helper `projectedTotal(total, settings, today)`: elapsed-days average rate → projected end-of-challenge total; if the goal will be met early, also the projected date (via `fmtDay`). Suppress (return null) before the start, after the end, and during the first 3 elapsed days (rate too noisy).
- Render as a new `<p id="goalProjection" role="status" aria-live="polite">` adjacent to the existing `#goalPace` line in the Crew group card; hidden when the helper returns null.
- Do **not** modify `paceInfo()` — its return states are covered by existing tests; the new helper is separate.

### Tests
- `tests/client-state.test.js`: helper across before-start / first-3-days / mid-challenge on-pace / goal-met-early / ended states.
- `tests/static-check.mjs`: assert `#goalProjection` exists with `role="status"`.

### Do not
- Change `paceInfo()` or `#goalPace` semantics; project per-person values (group only).

---

## 7. Weekly trend bars (Crew tab)

Status: Done — 2026-07-21
Notes: Add weekly trend bar chart to the Crew tab. Pure helper `weeklyTrend(today)` sums `computeCredits(logs).weeks` across all names into per-week group totals for consecutive week keys from `weekKey(config.startDate)` through `weekKey(today)` (stepping +7 days via `parseDateOnly`/`localDate`), labeled "W1"…"Wn" with empty weeks at 0; returns [] for invalid windows or a today before the start — caller passes `challengeToday()`, no clock reads inside. `renderTrend()` (called from `render()`) draws div-based columns into `#weeklyTrend` (`role="img"` with a "Weekly points: W1 30, W2 42, …" summary; per-column `title` like "W3 · 42 pts"; bars/labels `aria-hidden`; no transitions) inside a `.trend-scroll{overflow-x:auto}` wrapper so >12 weeks scroll; the max week maps to a 96px bar and zero weeks keep a 3px sliver. The card `#weeklyTrendCard` sits between the group-goal and Bounty Hunter cards and hides via the `hide` class when the helper returns [] or every week is zero. No deviations from the spec.

### Why
The group only sees one cumulative progress bar; week-by-week momentum is invisible.

### Requirements
- Pure helper aggregating `computeCredits(logs).weeks` (keys `name|week`) across all names into per-week group totals, ordered from `weekKey(config.startDate)` through the current week (pass `today` in). Label weeks "W1"…"Wn".
- New card between the group-goal card and the Bounty Hunter card on the Crew panel: a div-based bar chart (heights proportional to the max week), each bar with a `title` ("W3 · 42 pts") and its label underneath. Wrap the bars in a container with `overflow-x:auto` (like `.table-scroll`) so >12 weeks scrolls horizontally.
- Wrapper `role="img"` + `aria-label` summary ("Weekly points: W1 30, W2 42, …" or a compact best/latest summary); bars `aria-hidden="true"`. CSS-only styling, no transitions needed.

### Tests
- `tests/client-state.test.js`: week bucketing matches `weekKey` (Monday-start boundary), multi-person weeks sum, empty weeks render as zero bars.
- `tests/static-check.mjs`: assert the new container id exists.

### Do not
- Add a `<table>`; recompute week keys with custom date math (use `weekKey`).

---

## 8. Leaderboard week-trend arrows

Status: Done — 2026-07-21
Notes: Add leaderboard week-trend arrows. Pure helpers `prevWeekKey(today)` (steps `weekKey(today)` back one Monday-aligned week via `parseDateOnly`/`localDate`; '' for unparseable input) and `weekTrend(nameLower,today)` (compares this-week vs previous-week points from `computeCredits(logs).weeks` → 'up' | 'down' | 'even', zero-previous → up when this week > 0, both zero → even; returns null during the challenge's first week when `weekKey(today)===weekKey(config.startDate)`; today is always an argument, never the clock). `render()` appends the arrow inside the existing Week `<td>` as a `<span class="week-trend up|down|even" role="img" aria-label="up vs last week|down vs last week|even with last week">` rendering ▲/▼/— colored via `--green`/`--orange-ink`/`--muted`; null suppresses the span. Works in both Weekly and Overall toggle views (metric-independent, keyed on name). No new column, no `<thead>` change, no sort change; single `<table>` preserved. Deviation from spec: first-week suppression lives in `weekTrend` (returns null) rather than only in `render()`, so it is directly unit-testable; `role="img"` added to the span (rule 7) alongside the specced `aria-label`.

### Why
Cheap glanceable momentum on the leaderboard: is each climber up or down versus last week?

### Requirements
- Helper computing each member's previous-week points from `computeCredits().weeks` using the week key 7 days before `challengeToday()` (derive via existing date helpers).
- In `render()`'s leaderboard row markup (rows are built in `app.js`; the template `<thead>` does not change), append ▲ / ▼ / — inside the **existing Week cell** comparing this week vs last, wrapped in a `<span>` with `aria-label` "up vs last week" / "down vs last week" / "even with last week", colored via existing `--green` / `--orange-ink` / `--muted`.
- Suppress arrows during the first week of the challenge (no previous week to compare).

### Tests
- `tests/client-state.test.js`: previous-week key derivation across a Monday boundary; up/down/even classification.
- `tests/static-check.mjs`: unchanged (single table preserved — run and confirm).

### Do not
- Add a table column; reorder columns; change sort logic.

---

## 9. Empty-state and onboarding polish

Status: Done — 2026-07-21
Notes: Add onboarding empty state and crew local-mode hint. New `#youEmptyState` block in the You-tab "Recent activity" card (paragraph `#youEmptyCopy` plus a `.btn` with `data-tab="record"`); `render()` builds the copy via the pure helper `youEmptyStateCopy()` — Climbing/Exercise/Mobility values and the balanced-day bonus derived from `SCORING.categories`/`SCORING.balancedDayBonus`, never hard-coded — shows the block and hides `#personalActivity` only when the selected person has no logs, and swaps back to the feed once a log exists. New `#crewLocalHint` line in the Leaderboard card head, toggled by the `hide` class on `endpoint` truthiness in `render()` (visible in local mode, hidden once a Sheet is connected). Copy avoids the banned strings. Deviation: the empty-state button lives statically in the template (so the existing `[data-tab]` init listener binds it) while only its copy paragraph is set from SCORING in JS.

### Why
A fresh device in local mode shows bare zeros and "No activity yet." with no guidance.

### Requirements
- You tab: when the selected person has no logs, replace the bare "No activity yet." feed text with a short guided block: how scoring works (derive every number from `SCORING.categories`, `SCORING.balancedDayBonus` — never hard-code), plus a button that jumps to the Record tab (reuse the existing `showTab('record')` path and style as `.btn`).
- Crew tab, local mode only (`endpoint` falsy): a one-line hint near the leaderboard clarifying data is stored on this device until a shared setup is connected.
- All new copy must pass the banned-strings assertion in `static-check.mjs` (no "Hard mode", "pull-up mode", "Balanced week bonus", etc.).

### Tests
- `tests/static-check.mjs`: assert the empty-state container id exists; banned-strings assertion still passes.
- `tests/client-state.test.js`: empty-state markup present when logs are empty and absent after adding a log (via the DOM-stub harness).

### Do not
- Change modal flows or the identity prompt; hard-code point values in copy.

---

## 10. Personal records card (You tab)

Status: Done — 2026-07-21
Notes: Add personal records card to the You tab. Pure helper `personalRecords(nameLower,today)` returns `{hasLog,graded,hardest,hardestWeek,bestDay,bestWeek}` — hardest grade ever and hardest for `weekKey(today)` compared by `GRADES.indexOf` (blank/unknown grades skipped), best single day = max of that person's `computeCredits(logs).dayMeter`, best week = max of their `weeks`; `today` is a parameter, never the clock. `renderRecords()` (called from `render()`) writes labeled stat rows into `#recordsList`, toggles the `hide` class on `#recordsCard` until the person has ≥1 log, and omits the two grade rows when they have no graded climbs. Plain-text rows (no `role="img"`). Card sits between the grade pyramid and the heatmap. No deviations from the spec.

### Why
Celebrates progress; pairs with the grade pyramid (#3).

### Requirements
- Pure helper computing for the selected person: hardest grade ever and hardest this week (comparison by `GRADES` **index** — "V10" < "V2" lexicographically is the trap), best single day (`computeCredits().dayMeter` max), best week (`computeCredits().weeks` max).
- Small You-tab card of labeled stat rows; entirely hidden until the person has ≥1 log. Grade rows hidden if no graded climbs.
- Plain text rows (no `role="img"` needed).

### Tests
- `tests/client-state.test.js`: grade comparison uses GRADES index (explicit V10-vs-V9 case); best day/week maxima; hidden-when-empty behavior.
- `tests/static-check.mjs`: assert the new container id exists.

### Do not
- String-compare grades; recompute daily/weekly sums from raw logs (use `computeCredits()`).

---

## 11. Theme polish: theme-color meta + inline favicon

Status: Done — 2026-07-21
Notes: Add theme-color meta and inline SVG favicon. Added to the template `<head>`: `<meta name="theme-color" content="#f5eee3">` matching `--bg`, plus `<link rel="icon">` and `<link rel="apple-touch-icon">` both pointing at the same `data:image/svg+xml,...` URI — a `--green` (#174a3a) rounded square carrying the 🧗 brand emoji as a centered `<text>` element, fully URL-encoded (via `encodeURIComponent`, so no raw `#`/`<`/`>`/quotes/spaces break the attribute). No new files, no manifest, no service worker, no external URLs. static-check.mjs asserts both the `theme-color` meta and the `rel="icon"` `data:image/svg+xml` link. Deviation: also added the optional `apple-touch-icon` (as a data URI, per the entry's allowance).

### Why
The page ships zero icons or theme metadata; browser chrome is default gray and the tab has no icon.

### Requirements
- In `src/index.template.html` `<head>`: add `<meta name="theme-color" content="#f5eee3">` and an inline SVG favicon as a `data:` URI `<link rel="icon">` (a simple climbing glyph/emoji on the brand palette). If adding `<link rel="apple-touch-icon">`, it must also be a `data:` URI.
- **No new files at the repository root and no `manifest.json`** — a manifest brings install/scope/caching semantics unwanted for a live single-file app.

### Tests
- `tests/static-check.mjs`: assert the `theme-color` meta and `rel="icon"` link are present.

### Do not
- Add a service worker, manifest, or any file-based asset; reference any external URL.

---

## 12. Dark mode via prefers-color-scheme

Status: Done — 2026-07-21
Notes: Add dark mode via prefers-color-scheme. Step (a) hoisted every theme-relevant color literal in styles.css into new `:root` variables (surfaces, text, borders/washes, scrims/shadows, tint overlays) with zero light-mode value change. Step (b) added one `@media(prefers-color-scheme:dark){:root{...}}` override block (variables only), a `<meta name="color-scheme" content="light dark">`, and light/dark media-attributed `theme-color` metas (#f5eee3 / #1a1613). Deviation from the strict "variables only" note: two extra decoupling variables were introduced in step (a) — `--green-solid` and `--accent-solid` — because `--green` and `--orange-ink` are dual-use (foreground text that must lighten in dark mode AND solid backgrounds under white text on `.toast`/`.btn.primary`/pressed `.seg-btn` that must stay dark). In light mode both equal the originals (`#174a3a`/`#c0481f`), so light rendering is byte-for-byte identical; in dark mode the solids stay dark for white-text legibility while the text vars lighten. Dark-palette AA notes: `--muted` (#a6ad9f) ≈7:1, `--orange-ink` text (#ff9166) ≈7:1, `--green` text (#5fb896) ≈6:1, white on `--green-solid`/`--accent-solid` ≈7:1 — all on the dark card (#241f1a). Alpha borders/washes flipped to low-alpha white so they read on dark surfaces.

### Why
Evening gym use; the app is currently light-only. Done last because it has the widest blast radius.

### Requirements
- **Step (a), pure refactor:** hoist the hard-coded color literals repeated through `src/styles.css` (e.g. `#174a3aXX` borders/washes, `#f5eee3ed` topbar, `#fffaf2f2` nav, `#ef6940XX` tints, `#142a24` code block, `#102b23XX` modal scrim/shadow) into new `:root` variables. Zero visual change — verify by rebuilding and comparing rendered pages.
- **Step (b):** one `@media(prefers-color-scheme:dark)` block overriding `:root` variables only; add `<meta name="color-scheme" content="light dark">` and a second dark `theme-color` meta using the `media` attribute.
- Check WCAG AA contrast for `--muted` and `--orange-ink` text on the dark surfaces; adjust the dark values (not the light ones) as needed.
- No manual toggle and no new localStorage key — OS preference only.

### Tests
- `tests/static-check.mjs`: assert `prefers-color-scheme` appears in the built page and the `color-scheme` meta exists.
- Existing suite must pass unchanged after step (a) alone.

### Do not
- Change any light-mode rendered value; add a toggle or storage key; introduce per-component dark overrides outside the `:root` variable block (variables only).

---

## 13. Weekly / Overall leaderboard toggle with dynamic podium medals (Crew tab)

Status: Done — 2026-07-21
Notes: Add weekly/overall leaderboard toggle with podium medals. Segmented `#leaderToggle` (`#leaderWeekBtn`/`#leaderOverallBtn`, real `type="button"` with `aria-pressed`) in the Leaderboard card head; active view held in module var `leaderView` (defaults `'week'`, no localStorage key). Two pure helpers called from `render()`: `rankLeaders(rows,metric)` re-sorts `totalsModel().sorted` by the active metric (week/total desc, name tie-break) and `podiumMedals(rows,metric)` maps name→🥇🥈🥉 by dense rank over distinct positive values (ties share, 0 earns none). Medal renders as a `role="img"` `<span class="medal">` inside the existing Climber cell mirroring the 🏹 span; both Week and Total columns stay in both views; 🏹 Bounty Hunter logic untouched. Deviations from spec: none. Superseded by 21a2ee9: the single #leaderToggle became #leaderMetricToggle (#leaderPointsBtn/#leaderBountyBtn) + #leaderScopeToggle (#leaderWeekBtn/#leaderOverallBtn); tests/static-check.mjs asserts the current ids.

### Why
The leaderboard always ranks by all-time total, so weekly standing is buried in a column. A Weekly/Overall toggle lets the crew see who is winning *this week* versus overall, and 🥇🥈🥉 podium medals make the top three instantly readable in whichever view is active. (Requested by the organizer.)

### Requirements
- Add a two-button segmented toggle ("Weekly" / "Overall") to the Leaderboard card on the Crew tab (`src/index.template.html`, the `.table-card` wrapping the existing `#leaderRows` table). Real `<button type="button">`s with `aria-pressed` reflecting the active view; each ≥44px touch target; keep visible `:focus-visible`.
- **Default to Weekly on every load.** Hold the active view in a module-level JS variable (e.g. `leaderView='week'`); **do not** add a localStorage key (rule 4). Clicking a button updates the variable and re-renders the leaderboard (call `render()` or a focused rows-refresh + toggle-state update).
- Ranking metric follows the toggle, consuming `totalsModel().sorted` (it already carries both `week` and `total`) — never re-derive scoring: Weekly ranks by `week` descending, Overall by `total` descending, both tie-broken by name (match the existing comparator). The `.rank` numbers reflect the active metric.
- Podium medals: new pure helper (e.g. `podiumMedals(rows, metric)`) returning a `Map` of name→medal emoji for the top three by **dense rank over distinct positive values** of `metric` — ties share a medal (weekly points `8,8,5,3` → two 🥇, then 🥈, then 🥉); a score of 0 earns no medal. Recompute for the active view so medals are dynamic. In the row markup, render the medal inside the **existing Climber cell** as a `<span>` with an `aria-label` ("1st this week" / "1st overall", etc.), the emoji itself decorative (`aria-hidden` inner if needed) — mirror the existing 🏹 `.hunter` span pattern. Keep both Week and Total columns visible in both views.
- Leave the 🏹 Bounty Hunter card and logic (`#bountyHunter`, `totalsModel().hunters`/`huntCount`) completely unchanged — it stays week-based regardless of the toggle, and its 🏹 span stays next to names.

### Tests
- `tests/client-state.test.js`: `podiumMedals` — three distinct values (🥇🥈🥉), tie for 1st (two 🥇 then 🥈🥉 over the next distinct values), fewer than three climbers, all-zero scores (empty map). A crafted roster where Weekly and Overall orderings differ yields different top-3 sets.
- `tests/static-check.mjs`: assert the toggle container id and both buttons (with `type="button"` and `aria-pressed`) exist inside the `crew` panel; the single-`<table>` assertion still passes (the toggle is buttons, not a table).

### Do not
- Add a second `<table>` or a new table column (medals go inside the Climber cell); add a localStorage key for the toggle; change the 🏹 Bounty Hunter logic; sort with string/lexical comparison of numeric scores; fork scoring math instead of reading `totalsModel().sorted`.

---

## 14. Surface daily bounties: move card up + one-tap claim (You tab)

Status: Done — 2026-07-25
Notes: Relocate "Today's bounties" card directly under the today-card (was 9th of 10 cards, below three conditional analytics cards) and lift "Recent activity" up beside it, so action/engagement content sits above the analytics cluster. Make each bounty row a real `<button class="bounty" data-claim-bounty=…>` with an `aria-label="Claim …"`; new pure-ish helper `claimBounty(id)` checks the Bounty radio, snaps the record date to today (closing the date picker so `submitActivity`'s date guard can't fire), `showTab('record')`, populates and preselects `#bountySelect`, then focuses it — reusing `showTab`/`populateBountySelect`/`updateRecordPreview`. A delegated click listener on `#todayBounties` in `init()` (mirroring the `#activityList` pattern) routes taps. Card ordering only — no scoring, `dailyBounties`, weekly-cap, or `scoring.json` changes. Deviations from spec: none.

### Why
Daily bounties are a core pillar of the scoring economy but are buried near the bottom of the You tab and are display-only — claiming one means leaving for the Record tab, flipping the Bounty radio, and hunting a dropdown. Moving the card above the fold and making rows one-tap claimable makes the daily bounties immediately visible and actionable without adding a route.

### Requirements
- `src/index.template.html`: move the Today's-bounties `<article>` to directly under the `today-card` article; move the Recent-activity `<article>` up to just below it (order: today-card → bounties → recent activity → stat-grid → breakdown → pyramid → records → heatmap). Keep `#bountyCapHint` before `#todayBounties` and all DOM ids unique.
- `src/app.js`: in `renderBounties()`, render each bounty as `<button class="bounty" type="button" data-claim-bounty="{id}" aria-label="Claim {title} · {category} bounty · plus N point(s)">` with the category emoji + chevron `aria-hidden`; keep the empty-state string and `#bountyCapHint` block. Add `claimBounty(id)` reusing existing functions only; add one delegated `#todayBounties` click listener in `init()`.
- `src/styles.css`: `button.bounty` UA reset + `:hover`/`:active`/`:focus-visible` states and a `.bounty-go` chevron, reusing existing tokens; rows stay ≥44px touch targets.

### Tests
- `tests/client-state.test.js`: after `render()`, `claimBounty(dailyBounties(challengeToday())[0].id)` selects the Bounty radio, preselects that id in `#bountySelect`, and closes `#dateFields` (`location.hash` not asserted — the DOM stub's `history.replaceState` is a no-op).
- `tests/static-check.mjs`: bounty card sits under the today-card above the stat grid; recent activity sits above the stat grid; rows render as labelled claim buttons and `claimBounty` exists. Retarget the two pyramid/heatmap ordering assertions off the (now-moved) `#bountyCapHint` anchor.

### Do not
- Move the bounty list onto the Record tab (it belongs on the You landing view; the Record tab already has the Bounty radio + dropdown for entry); add a 4th nav tab / new hash route; add a localStorage key; fork scoring or touch `scoring.json`/the weekly cap.

---

## 15. Make the improvement loop safe: archive shipped work, add a selection rule, reconcile the rules

Status: Done — 2026-07-25
Notes: Archive shipped log entries and reconcile the loop rules. Entries 1–14 moved verbatim (byte-for-byte, verified against the pre-move file) to `IMPROVEMENTS.md` under `## v11 pass — frontend enhancement queue (entries 1–14)`, whose line 3 now covers v6–v11 and says the file is history, never a queue; the only edit to an archived entry is the supersession sentence appended to entry 13's `Notes:`. Five backfill stubs `B1`–`B5` (`cb77882`, `f45e3a3`, `21a2ee9`, `3a7da67`, `0695742`) sit under `## v11 pass — shipped without a log entry (backfill B1–B5)`; the `B` prefix keeps them from ever colliding with the queue's integers. `IMPROVEMENT_LOG.md` now holds the title, preamble, a queue index (one line per live entry), the rules and entries 15–22. The unnumbered "Before you start" selection paragraph heads the rules block with rules 1–10 unrenumbered; rule 2 now states the `scoring.json`/`schema.json`/`apps-script.js` out-of-scope policy, rule 3 documents the `check:generated` rebuild foot-gun, rule 4 lists the real seven localStorage keys, and rules 2 and 8 both carry the carve-out sentence. `AGENTS.md` got the matching contract-file and no-dependencies statements; new root `CLAUDE.md` (28 lines) points at the rules block and `AGENTS.md` instead of duplicating them. New `tests/docs-check.mjs` (plain `node:assert/strict`) is appended to the `test` script. `src/`, `index.html` and `.github/` untouched; `npm run build` is a no-op. Deviations: (1) the entry's `### Tests` bullet asks the docs check to assert that **no** `Status: Done` remains in this file, which the entry itself contradicts — rule 10 and the entry's own bookkeeping require entry 15 to be `Done` here in this commit. The assertion is implemented as **at most one** `Status: Done` (the entry finished in the current commit), and rule 10 now requires the next iteration to archive it verbatim before starting, so the queue still converges on live work only and the invariant is enforced from here on. (2) `tests/docs-check.mjs` also asserts that every numbered entry appears in the new queue index, so the index cannot silently drift — an addition, not a relaxation.

### Why
This log is 331 lines / 37,005 bytes and **all 14 entries are `Done`**, yet nothing in the file tells an implementer to skip them — line 3 says only "work entries top to bottom", so a looping agent reads 37KB (90% of it finished work, 12.9KB of it `Notes:` prose) before discovering the queue is empty, and the literal first entry it meets is Done. Three rules are also factually wrong or contradicted: rule 4 lists 5 frozen localStorage keys while `src/app.js` uses 7, rule 2 ("never touch `src/scoring.json`/`src/schema.json`/`src/apps-script.js`") contradicts `AGENTS.md` and was broken by commits `804cab0`, `3a7da67` and `0695742`, and entry 13's `Notes:` still describes a `#leaderToggle` that commit `21a2ee9` replaced with `#leaderMetricToggle`/`#leaderScopeToggle`.

### Requirements
- **Rule carve-out (rules 2 and 8):** this entry is documentation-and-tests only and is explicitly permitted to edit `IMPROVEMENT_LOG.md`, `AGENTS.md`, `IMPROVEMENTS.md`, a new `CLAUDE.md`, `package.json` (one added test invocation), and to add `tests/docs-check.mjs`. It must not touch `src/`, so `index.html` stays byte-identical and `npm run build` is a no-op. Do **not** go `Blocked` on rule 2 for this entry.
- Move entries 1–14 out of this file and append them to `IMPROVEMENTS.md` under a new `## v11 pass — frontend enhancement queue (entries 1–14)` heading. Move them **verbatim**: heading, `Status:`, `Notes:`, `### Why`, `### Requirements`, `### Tests`, `### Do not`, separator. Do not reword, summarise, or renumber them — entry numbers never restart, and the archive is the audit trail. `IMPROVEMENTS.md` is already the repo's historical record, so also fix its line 3, which still claims the history ends at v10.
- Backfill archive stubs in `IMPROVEMENTS.md` for the five feature commits that shipped with no entry, each as `Status: Done — shipped without a log entry (backfilled <date>)` plus a one-paragraph `Notes:` naming the commit: `cb77882` (first-open Week in Review, which also added the `roadToSendWeekReview` key), `f45e3a3` (all-time bounty view + champions callout), `21a2ee9` (split leaderboard toggle), `3a7da67` (new directional bounties, `scoring.json`), `0695742` (API v11 bump, `schema.json`). Label them so they cannot collide with this queue's integers.
- Correct entry 13's archived `Notes:` by **appending** (never rewriting): `Superseded by 21a2ee9: the single #leaderToggle became #leaderMetricToggle (#leaderPointsBtn/#leaderBountyBtn) + #leaderScopeToggle (#leaderWeekBtn/#leaderOverallBtn); tests/static-check.mjs asserts the current ids.`
- `IMPROVEMENT_LOG.md` after the move contains: the title, the preamble, a **queue index** (one line per live entry — number, title, status), the rules, then entries 15–22 only. Archive only `Done` work; leave every `Todo` entry in place.
- Add a **selection rule** as an unnumbered "Before you start" paragraph at the top of the rules block — insert it *without* renumbering rules 1–10, which other entries cite by number: *implement the **first** entry whose `Status:` is `Todo`, top to bottom; skip `Done`, `Blocked`, and anyone else's `In progress`; if no entry is `Todo`, stop and report "queue empty — no Todo entries" without inventing, re-doing, or reopening work; never work from `IMPROVEMENTS.md`.*
- Fix rule 4's frozen-key list to the real seven: `roadToSendEndpoint`, `roadToSendMe`, `roadToSendLogsV9`, `roadToSendConfigV9`, `roadToSendConfigV8` (read-only migration source — only the existing one-time migration writes `roadToSendConfigV9` from it), `roadToSendWeekReview`, and `roadToSendShared:{activities|config|meta}:{endpoint}`.
- Reconcile the contradictions. In `AGENTS.md`, replace "Keep changes to those layers coordinated, especially scoring constants and API version checks" with an explicit statement that `src/scoring.json`, `src/schema.json` and `src/apps-script.js` are **out of scope for log-driven entries** and change only in an organizer-coordinated task that bumps the API version and gets its own entry; change "do not add dependencies without a clear maintenance benefit" to match rule 8's absolute "no dependencies — runtime or dev". Add to both rule 2 and rule 8: *an entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.*
- Add a repo-root `CLAUDE.md` (~25 lines, loaded automatically by agent sessions) stating: the app is live at `https://huangmj0.github.io/road-to-send/` and `index.html` stays at the repository root; the loop protocol (read `IMPROVEMENT_LOG.md`, take the first `Todo`, one entry per commit, update `Status:`/`Notes:` in the same commit); edit `src/`, never `index.html`; `npm run build` then `npm test`. It must **point at** the rules block and `AGENTS.md`, not duplicate them — a third copy is a third thing to drift.
- Document the rebuild foot-gun in both `CLAUDE.md` and rule 3: *`npm run check:generated` shells out to `build.mjs`, which **overwrites `index.html` in place** before comparing — so a stale-artifact failure silently "passes" on the second run, leaving an unstaged `index.html`. After any test failure, run `git status` and commit the regenerated `index.html` alongside your `src/` changes.* Entry 16 removes this foot-gun and deletes the note when it does.

### Tests
- `tests/docs-check.mjs` (new; plain `node:assert/strict` script in the style of `static-check.mjs`): every `## N.` heading in `IMPROVEMENT_LOG.md` is followed by a `Status:` line whose value is one of the four documented states; **no `Status: Done` remains in `IMPROVEMENT_LOG.md`** (shipped work belongs in `IMPROVEMENTS.md`); every `roadToSend…` string literal appearing in `src/app.js` also appears in the rules' frozen-key list — this is the assertion that would have caught `roadToSendWeekReview`; `IMPROVEMENTS.md` contains the entry-1 heading; `CLAUDE.md` exists and links `IMPROVEMENT_LOG.md`.
- `package.json`: append `&& node tests/docs-check.mjs` to the `test` script. Entry 16 folds it into the non-short-circuiting runner.
- No `tests/client-state.test.js` and no `tests/static-check.mjs` changes — `index.html` is byte-identical, so both suites must pass untouched.

### Do not
Delete, reword, or summarise archived entries; renumber live entries; renumber rules 1–10; archive anything that is not `Done`; touch `src/`, `index.html`, or `.github/` in this entry (workflows belong to entry 16); add a localStorage key or a dependency while "reconciling" the rules.

---

## 16. Stop unverified deploys reaching the live URL, and stop `npm test` hiding failures

Status: Done — 2026-07-25
Notes: Gate the Pages deploy on a green test run and stop `npm test` short-circuiting. `pages.yml` gains a `verify` job (checkout, `actions/setup-node@v4` with `node-version: 22`, `npm test`) and `deploy` gains `needs: verify`; the `push: branches: ["main"]` trigger, `workflow_dispatch`, the `pages`/`id-token` permissions and the `concurrency` group are byte-identical to before, and `test.yml` is untouched. The artifact is narrowed by an `mkdir -p _site && cp index.html _site/index.html` step with `path: _site`, so `src/`, `tests/` and the markdown files stop being published; `index.html` stays at the repository root and the published page stays at the artifact root, so `https://huangmj0.github.io/road-to-send/` is unchanged. `scripts/build.mjs` now exports a pure `buildHtml()` (plus `artifactPath`) and keeps its `writeFileSync` + `Built self-contained index.html from src/.` line behind a direct-invocation guard, so `npm run build` behaves exactly as before; `scripts/check-generated.mjs` imports `buildHtml()` and compares in memory — no `execFileSync`, no writes, verified by appending a byte to `index.html` and watching the check fail identically on two consecutive runs. New `scripts/run-tests.mjs` is wired as `"test": "node scripts/run-tests.mjs"`, runs every suite via `spawnSync` regardless of earlier failures, prints a `PASS`/`FAIL` line per suite plus an `n/m suites passed.` line, and exits 1 if any failed; `build` and `check:generated` remain separate scripts. New `tests/size-check.mjs` caps `index.html` at `BUDGET = 132000` bytes and always prints the size and percent (118,394 bytes, 89.7% today). `tests/docs-check.mjs` gains the repo-hygiene assertions: `pages.yml` has `needs: verify` and an `npm test` run step and no `path: .`; `check-generated.mjs` contains neither `execFileSync` nor `writeFileSync`; `buildHtml()` returns a string equal to the committed `index.html`. The foot-gun note is deleted from `CLAUDE.md` and rule 3, replaced by "`npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`", and rule 3 also carries the `BUDGET` sentence. `docs/loop-prompt.md` gets its two scheduled maintenance edits (stale-`index.html` paragraph replaced by the read-only wording, carve-out paragraph generalised to rules 2 and 8); its "Maintenance" section is removed because both items it tracked are now done. `src/` and `index.html` are byte-identical to `origin/main` and `npm run build` is a no-op. Deviations: (1) the entry's `### Tests` bullet says "the new runner reports all six suites" while `### Requirements` enumerates five (`check:generated`, one `node --test` over the four `tests/*.test.js` files, `static-check`, `docs-check`, `size-check`) — implemented as the five the Requirements list, which the runner reports as `5/5 suites passed.`; splitting the `node --test` invocation per file would give eight, not six. (2) Forcing `check:generated` to throw was verified to leave the other four suites running and the process exiting 1 (`4/5 suites passed.`), then reverted byte-identically. (3) One clause of `AGENTS.md` ("`pages.yml` deploys the repository root … on pushes to `main`") was made accurate by this change and is corrected here even though the carve-out does not name the file — leaving a doc that contradicts the workflow this entry just rewrote is the drift entry 15 was written to stop. No other `AGENTS.md` line was touched.

### Why
`.github/workflows/pages.yml` deploys on every push to `main` with **no dependency on the test workflow and no `npm test` step**, so a red or stale `index.html` merged to `main` goes straight to the live site the crew is using; it also uploads with `path: .`, publishing `src/`, `tests/` and every markdown file alongside the app. Meanwhile `npm test` is a single `&&` chain, so a `check:generated` failure short-circuits and hides the other four suites — and `check-generated.mjs` is not read-only: it rewrites `index.html` before comparing, so the same failure disappears on a re-run.

### Requirements
- **Rule carve-out (rules 2, 3 and 8):** this entry is explicitly permitted to edit `.github/workflows/pages.yml`, `package.json`, `scripts/build.mjs`, `scripts/check-generated.mjs`, and to add `scripts/run-tests.mjs`. It must not change `src/` or `index.html`, and it must not change the published URL. Do **not** go `Blocked` on rules 2/8 for this entry.
- `pages.yml`: add a `verify` job (checkout, `actions/setup-node@v4` with `node-version: 22`, `npm test`) and give the `deploy` job `needs: verify`. GitHub Actions `needs:` cannot reference another workflow, so the gate must live inside `pages.yml`; leave `test.yml` alone — it still covers pull requests. Keep the `push: branches: ["main"]` trigger, `workflow_dispatch`, the `pages`/`id-token` permissions and the `concurrency` group exactly as they are. Accepted trade-off: a failing test now blocks deploys until it is fixed.
- Narrow the artifact: before `upload-pages-artifact`, assemble a `_site/` directory containing **only `index.html`** (`mkdir -p _site && cp index.html _site/index.html`) and set `path: _site`. The published page stays at the artifact root, so `https://huangmj0.github.io/road-to-send/` is unchanged. Add a comment noting `index.html` is intentionally self-contained — if it ever gains a sibling asset, copy that here too.
- Make the generated-artifact check read-only: refactor `scripts/build.mjs` to export a pure `buildHtml()` returning the rendered string, keeping the CLI path (`writeFileSync` + the console line) unchanged when the file is run directly. `scripts/check-generated.mjs` then imports `buildHtml()` and compares against the committed `index.html` in memory — no `execFileSync`, no writes. Its failure message tells the implementer to run `npm run build` and commit the result. Delete the foot-gun note entry 15 added to `CLAUDE.md` and rule 3, replacing it with: *`npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`.*
- Replace the `&&` chain with `scripts/run-tests.mjs`, invoked as `"test": "node scripts/run-tests.mjs"`. It runs each suite in sequence (`check:generated`, `node --test` over the four `tests/*.test.js` files, `tests/static-check.mjs`, `tests/docs-check.mjs`, `tests/size-check.mjs`), **never short-circuits**, prints a one-line PASS/FAIL summary per suite at the end, and exits `1` if any failed. Keep `build` and `check:generated` as separate scripts so `npm run build` and CI stay unchanged.
- Add a bundle-size guard, `tests/size-check.mjs`: assert `index.html` is at most `BUDGET = 132000` bytes (it is 118,394 today — the artifact grew +30.9KB / +35% in 14 working days at roughly 1.5–2.5KB per feature commit), and always print the current size and percent of budget so growth is visible in every run. The failure message must read: *raise `BUDGET` deliberately in a log entry that explains the growth — never as a side effect of another change.* Add that sentence to rule 3 as well.

### Tests
- `tests/size-check.mjs` (new) as specified. `tests/docs-check.mjs` (from entry 15) gains repo-hygiene assertions: `pages.yml` contains `needs: verify` and an `npm test` step and does **not** contain `path: .`; `scripts/check-generated.mjs` contains neither `execFileSync` nor `writeFileSync`; `buildHtml()` imported from `scripts/build.mjs` returns a string equal to the committed `index.html`.
- No `tests/client-state.test.js` and no `tests/static-check.mjs` changes: `index.html` is untouched, so both must pass byte-for-byte as they stand. Verify the new runner reports all six suites, and that forcing one failure still runs the rest and still exits non-zero.

### Do not
Move `index.html` out of the repository root, add a `_config.yml`, change the branch or base path, or otherwise touch the live URL; delete or weaken `test.yml`; make `npm test` tolerate a failure (the runner reports everything, then exits non-zero); add a dependency, a lint/format tool, or a git hook (out of scope — propose a separate entry); edit `src/` or rebuild `index.html` in this entry.

---

## 17. "What's left today": category status and balanced-bonus reachability (You tab)

Status: Done — 2026-07-25
Notes: Show what's left today on the You card. `src/app.js` gains four pure helpers plus one renderer: `todayProgress(nameLower,today)` reads `computeCredits(logs).info` (a category is logged when an in-window entry of that type exists for that person and day, so a duplicate whose `reason` is `already logged` still counts) and `dayMeter` for `points`, returning `{today,inWindow,points,max,rows,loggedCount,remainingPoints,bonusPoints,bonusEarned,bonusReachable,potential}`; `todayPillState(prog)` returns the five states (`Balanced day`, `N more for +2`, `Ready`, `Not started`, `Complete`) with `cls:'max'` exactly when `points >= DAILY_MAX`, so the existing `.max` CSS still applies; `meterSegments(prog)` returns `DAILY_MAX` `{cls,label}` pips (three climb, two exercise, one mobility, two bonus, `filled` per what is earned); `joinLabels()` formats the derived copy lists. `renderTodayStatus()` runs from `render()` at the head of the existing `renderBreakdown()`/`renderBounties()` cluster and makes exactly one `computeCredits` pass (inside `todayProgress`); the old two-state pill/meter lines were removed from their former spot in `render()`, and `#youTodayPoints` still reads from the `model` already in scope. `setSegmentedMeter()` is new and additive — `meterMarkup()`, `setMeter()`, `weeksUntilDone()`, `paceInfo()` and `computeCredits()`'s return shape are untouched, so `#recordMeter` keeps plain pips. `src/index.template.html` adds `<div id="todayCategories" class="cat-chips" role="list">` and `<p id="todayRemaining" class="hint" role="status" aria-live="polite">` inside the today-card between `#youMeter` and the `data-tab="record"` button, above `#bountyCapHint`, so every existing You-panel order assertion still holds. `#youMeter` keeps `role="img"` and its `aria-label` now names what is filled and what is missing (`5 of 8 points today · logged Climbing and Exercise · still open: Mobility and the +2 balanced-day bonus`); chip emoji and meter pips are `aria-hidden="true"`. All numbers and labels derive from `CATEGORIES`/`CAT_LABELS`/`CAT_ICONS`/`SCORING.categories`/`SCORING.balancedDayBonus`/`DAILY_MAX` — no `3`/`2`/`1`/`+2`/`8` literals in logic or copy — and `today` is always an argument (`challengeToday()` at the call site, `dateInChallenge(today)` for `inWindow`), never `new Date()`. `src/styles.css` adds one line: `.cat-chips`/`.cat-chip` (inline-flex, 44px minimum hit height on both the row and each chip, `--sand`/`--green`/`--muted`/`--wash` tokens, `.done` vs `.todo`), `#todayRemaining` spacing, and per-category pip classes next to the existing `.point-meter` rules; the only motion is CSS transitions, so the existing `prefers-reduced-motion` kill-switch covers it. Tests: `tests/client-state.test.js` harness-1 covers nothing-logged, climb+exercise, all three, a duplicate climb, a bounty-only day, an out-of-window day, `meterSegments` filled-count equalling `points` across six log sets, and all five `todayPillState` states; harness-2 asserts `#todayStatus.textContent`, `#todayCategories.innerHTML`, `#todayRemaining.textContent` and `#youMeter.innerHTML` after `render()` in the nothing-logged, two-of-three and all-three states (textContent/innerHTML only — the stub's `getAttribute` returns `null`). `tests/static-check.mjs` gains six assertions including the new order assertion `data-panel="you"` → `id="youMeter"` → `id="todayCategories"` → `id="todayRemaining"` → `data-tab="record"` → `id="bountyCapHint"`; no existing assertion was relaxed or retargeted. `npm test`: 5/5 suites, `index.html` 122,963 bytes (93.2% of the 132000-byte budget, +4,569); `BUDGET` unchanged. Rule 10 archiving: entry 16 was moved verbatim (25 lines, heading through its `---`) into `IMPROVEMENTS.md` after archived entry 15 in the v11 section, and its queue-index line dropped. Deviations: (1) `todayProgress` returns one key beyond the list in `### Requirements` — `today`, the normalized date string — because `todayPillState(prog)` takes only `prog` and cannot otherwise tell `Not started` from `Complete`; nothing `deepEqual`s this shape. (2) `potential` is `points` (not the daily max) outside the window, since nothing is reachable on a day that cannot score. (3) The out-of-window `#todayRemaining` copy needed a before-the-start variant the entry does not enumerate: `The challenge starts Jul 28.` via `fmtDay(config.startDate)`, matching the `Not started` pill. (4) One extra helper, `joinLabels()`, formats the derived category lists for both the copy and the `aria-label` rather than duplicating the join twice.

### Why
Nothing in the app shows **which** of the three categories the person has already logged today, or whether the +2 balanced-day bonus is still reachable — `computeCredits()` tracks exactly this in its internal `daySeen` map but returns only `dayMeter`, a bare number per person-day. The `#todayStatus` pill is binary (`Balanced day` at or above the daily max, otherwise `Ready`), so a climb + exercise day worth 5 of 8 points reads "Ready", and `#youMeter`'s pips are identity-less, so a half-full meter says nothing about what is missing.

### Requirements
- `src/app.js` — new pure helper `todayProgress(nameLower, today)` returning `{inWindow, points, max, rows:[{type,label,icon,points,logged}], loggedCount, remainingPoints, bonusPoints, bonusEarned, bonusReachable, potential}`. Derive everything from `computeCredits(logs).info` — a category counts as logged when an in-window entry of that type exists for that person and day, **including** a duplicate whose `reason` is `already logged` — plus `dayMeter` for `points`. Category order, labels, icons and values come from `CATEGORIES`/`CAT_LABELS`/`CAT_ICONS`/`SCORING.categories`, the bonus from `SCORING.balancedDayBonus`. `today` is an **argument**, never `new Date()`; `inWindow` uses `dateInChallenge(today)`. Bounties never touch `dayMeter`, so this helper covers the three categories plus the bonus only — do not add bounty rows, entry 14's card owns those.
- New pure helper `todayPillState(prog)` → `{text, cls}`, replacing the binary pill: `bonusEarned` → `Balanced day`; `loggedCount > 0` → `1 more for +2` / `2 more for +2`; nothing logged and in-window → `Ready`; outside the window → `Not started` / `Complete`. Keep toggling the existing `.max` class exactly when `points >= DAILY_MAX` so current CSS still applies.
- New pure helper `meterSegments(prog)` → an array of `DAILY_MAX` descriptors `{cls, label}` — three climb pips, two exercise, one mobility, two bonus — each `filled` per what is earned, rendered through a new `setSegmentedMeter('#youMeter', segments, label)`. **Leave `meterMarkup()` and `setMeter()` untouched**: `#recordMeter` and the record preview keep the plain pips.
- `src/index.template.html` — inside the existing `article.card.today-card`, **after `#youMeter` and before the `data-tab="record"` button**: a `<div id="todayCategories" role="list">` of `<span class="cat-chip done|todo" role="listitem">` (emoji `aria-hidden="true"`, visible label, `✓` or `+N`), and a `<p id="todayRemaining" class="hint" role="status" aria-live="polite">`. Both sit inside the today-card, i.e. **before** `#bountyCapHint`/`#todayBounties`/`.stat-grid`, so every existing You-panel order assertion still holds unchanged.
- `#todayRemaining` copy is derived, never hard-coded: e.g. `Log Exercise and Mobility for +3 more and the +2 balanced-day bonus.` / `Balanced day complete — 8 of 8 points.` / `Challenge complete.` Keep `#youMeter`'s `role="img"` and update its `aria-label` to name both what is filled and what is missing.
- Render from `render()` via one `renderTodayStatus()` call placed with the existing `renderBreakdown()`/`renderBounties()` cluster; idempotent and cheap — one `computeCredits` pass, reusing the `model` already in scope where convenient.
- `src/styles.css` — `.cat-chip` (inline-flex, 44px minimum hit height on the row, existing `--sand`/`--green`/`--muted` tokens, `.done` vs `.todo` states) and the per-category pip classes next to the existing `.point-meter` rules. CSS-only transitions.

### Tests
- `tests/client-state.test.js` behaviour, inside the harness-1 `checks` **template literal** — no backticks and no `${` in added code, build strings with `+`. Cover: nothing logged (`loggedCount` 0, `potential` 8, `bonusReachable` true); climb+exercise (`points` 5, one row `logged:false`, `remainingPoints` 1, `bonusReachable` true); all three (`points` 8, `bonusEarned` true, `bonusReachable` false); a duplicate same-day climb still reads `logged:true` without double-counting; a bounty-only day leaves all three rows `logged:false` with `points` 0; a `today` outside the window gives `inWindow:false`; `meterSegments` filled count always equals `points`; `todayPillState` for each of the five states.
- `tests/client-state.test.js` DOM, in the harness-2 `domChecks` literal (same backtick hazard): after `render()`, assert `#todayStatus.textContent`, `#todayCategories.innerHTML` and `#todayRemaining.textContent` in the nothing-logged, two-of-three and all-three states. Assert **textContent/innerHTML only** — the element stub's `setAttribute` is a no-op and `getAttribute` always returns `null`, so `aria-label` changes are not observable there; cover those in `static-check.mjs` against the static template.
- `tests/static-check.mjs` — **add** assertions, never retarget an existing one: `#todayCategories` and `#todayRemaining` exist inside `data-panel="you"`; `#todayRemaining` carries `role="status"` and `aria-live="polite"`; `#youMeter` still has `role="img"` with an `aria-label`; plus one **new** order assertion `data-panel="you"` → `id="youMeter"` → `id="todayCategories"` → `id="todayRemaining"` → `data-tab="record"` → `id="bountyCapHint"`.

### Do not
Change `weeksUntilDone()`, `paceInfo()`, `meterMarkup()`, `setMeter()`, or `computeCredits()`'s return shape (`tests/client-state.test.js` `deepEqual`s several of them); make the chips interactive in this entry — a tap-to-preselect path duplicates entry 14's claim flow and the card's own Record CTA, so leave it for a later entry; add a card (this lives inside the existing today-card); write any banned string; hard-code 3/2/1/+2/8 anywhere; add a localStorage key.

---

## 18. Personal countdown and personal pace (You tab)

Status: Done — 2026-07-25
Notes: Add a personal countdown and personal pace line to the You card. Pure helper `challengeProgress(today,settings)` derives `{state,day,totalDays,daysLeft,weeksLeft,pct}` from `parseDateOnly` plus `weeksUntilDone()` for `daysLeft`/`weeksLeft` (never re-deriving them), returning `null` for an unparseable or inverted window; `personalPaceInfo(nameLower,today,settings,model)` computes `share = ceil(goal / crewSize)` from `totalsModel().sorted.length` (falling back to `config.crew.length`, floor 1) and calls `paceInfo()` unchanged on a shallow settings copy with `goal: share`. `renderYouPace(model)` writes `#youCountdown` and `#youPace` (reusing the Crew card's existing `.pace`/`.ahead`/`.behind` classes, so no new colour CSS) and is called from `render()` beside entry 17's `renderTodayStatus()`, consuming the `model` already in scope. Neither element takes `aria-live` — a code comment records that `#todayRemaining` is the today-card's single polite live region so a later pass does not "fix" it. `weeksUntilDone()`, `paceInfo()` and `projectedTotal()` return shapes are untouched, and a test asserts `challengeProgress(d).daysLeft === weeksUntilDone(d).days` so the two can never drift. index.html 122,963 → 125,420 bytes (+2,457; 95.0% of the 132,000-byte budget). Deviations: (1) `personalPaceInfo` takes an optional fourth argument `model` (defaulting to `totalsModel()`) so `render()` can pass the model already in scope — the entry requires that reuse but lists a three-argument signature; the first three arguments are exactly as specified. (2) `#youPace` also renders a `before`-state line, `Your share of the goal is N pts`, which the entry does not enumerate — it only enumerates hiding for `null`/ended — because a person opening the app before the start would otherwise see a blank element where the countdown promises context.

### Why
`weeksUntilDone(today, settings)` already returns `{days, weeks}` but **`.days` is never rendered anywhere**, and the app's only countdown lives in `#weekReviewCountdown` inside a modal that opens once per ISO week — so the You tab has no date context at all: no "day N of M", no days remaining, no personal pace. `paceInfo()` and `projectedTotal()` exist but are Crew-tab-only and crew-wide (fed `earnedThrough(today)`), so a person can never see whether *they* are on track.

### Requirements
- `src/app.js` — new pure helper `challengeProgress(today = challengeToday(), settings = config)` → `{state:'before'|'active'|'ended', day, totalDays, daysLeft, weeksLeft, pct}`, or `null` for an unparseable or inverted window. It must **consume** `weeksUntilDone()` for `daysLeft`/`weeksLeft` rather than re-deriving them, and must not change that helper's return shape — `tests/client-state.test.js` `deepEqual`s both `{days, weeks}` and `{done:true}`. `today` is an argument; never `new Date()`.
- New pure helper `personalPaceInfo(nameLower, today = challengeToday(), settings = config)` → `{share, total, pace}`, where `share = Math.ceil(goal / Math.max(1, crewSize))` (crew size from `totalsModel().sorted.length`, falling back to `config.crew.length`, floor 1) and `pace = paceInfo(total, {...settings, goal: share}, today)`. This **reuses `paceInfo` unchanged** on a shallow settings copy — do not fork or re-derive its math, and do not change its `{state, diff, perDay}` shape.
- `src/index.template.html` — inside the existing `today-card`, **after `#todayRemaining` (entry 17) and before the `data-tab="record"` button**: `<p id="youCountdown" class="hint">` and `<p id="youPace" class="hint pace hide">`. Both are inside the today-card, so all existing You-panel order assertions still hold. Reuse the Crew card's existing `.pace`/`.ahead`/`.behind` classes so no new colour CSS is needed.
- Neither element gets `aria-live`: `#youCountdown` changes once per day, and `#todayRemaining` (entry 17) is already the today-card's single polite live region — a second and third region in one card would triple-announce on every `render()`. State this in a code comment so a later pass does not "fix" it.
- Copy, all derived: `#youCountdown` → `Day 12 of 31 · 19 days left` / `Starts Mon Jul 27 · 31 days` / `Challenge complete · ended Jul 31` (dates via `fmtDay()`); `#youPace` → `84 / 100 pts · 6 ahead of your share` / `84 / 100 pts · 16 behind · ~3 pts/day` / `Your share of the goal is done 🎉`, hidden when `pace` is `null` or the window has ended.
- Render from `render()` in one `renderYouPace()` call beside entry 17's `renderTodayStatus()`; reuse the `model` already in scope for the person's total (`model.totals.get(meLower)`) — no extra `computeCredits` pass.

### Tests
- `tests/client-state.test.js` harness-1 `checks` literal (no backticks, no `${`): `challengeProgress` over a `2026-07-01`–`2026-07-31` window — first day `{state:'active', day:1, totalDays:31, daysLeft:31}`, `2026-07-15` → `day:15, daysLeft:17`, final day → `day:31, daysLeft:1`, `2026-08-05` → `state:'ended'`, `2026-06-30` → `state:'before'`, `'garbage'` → `null`; and assert `challengeProgress(d).daysLeft === weeksUntilDone(d).days` so the two can never drift. `personalPaceInfo`: share math for 1-, 3- and 4-person crews; `pace.state === 'met'` once the person passes their share; `pace === null` for a zero goal or inverted window; and that `today` is honoured as an argument.
- `tests/client-state.test.js` harness-2 `domChecks` literal: with `config={startDate:shift(-5), tripDate:shift(5)}` and zero logs, `render()` then assert `#youCountdown.textContent` contains `Day 6 of 11` and `6 days left`, and that `#youPace` is not hidden and its text starts with the behind-pace copy; then a past window (`shift(-20)`–`shift(-10)`) hides `#youPace` and `#youCountdown` reads as complete. textContent only — the stub's `getAttribute` returns `null`.
- `tests/static-check.mjs` — **add**: `#youCountdown` and `#youPace` exist inside `data-panel="you"`; one **new** order assertion `data-panel="you"` → `id="todayCategories"` → `id="youCountdown"` → `id="youPace"` → `data-tab="record"` → `id="bountyCapHint"`. Do not retarget the existing today-card/bounty/stat-grid assertions.

### Do not
Change the return shape of `weeksUntilDone()`, `paceInfo()` or `projectedTotal()` (all three are `deepEqual`-asserted); call `new Date()` for challenge dates; add a card, a nav tab or a hash route; add a third `aria-live` region to the today-card; duplicate the Crew tab's crew-wide pace line here — this one is the person's share; add a localStorage key.

---

## 23. Raise the bundle budget to cover the rest of the queue

Status: Done — 2026-07-25
Notes: Raise the bundle budget to 156,000 bytes. `BUDGET` in `tests/size-check.mjs` goes from `132000` to `156000`, with the projection it derives from recorded in a comment beside the constant so the next person can check the arithmetic instead of re-guessing it. Placed above entry 19 in the queue while keeping the number 23 — the selection rule is positional, not numeric, so this is the next entry worked, which it has to be because 19 and 20 are the two entries that would otherwise breach the cap. `src/` and `index.html` are untouched, so `npm run build` is a no-op and the artifact stays byte-identical at 125,420 bytes. No deviations from the requirements below.

### Why
`tests/size-check.mjs` caps `index.html` at 132,000 bytes. Entry 18 took the artifact to 125,420 bytes — **95.0% of budget** — leaving roughly 6.5KB for the four remaining entries (19–22). Measured across the fourteen feature commits that changed `index.html`, growth runs a median of 1,835 bytes and a mean of 2,268, but modal-class features are far heavier: the first-open Week in Review recap cost 5,973 bytes and entry 17 cost 4,569. Entries 19 and 20 are both modal-class — a confirm dialog with focus restoration, and a per-person card — so the queue as written cannot fit under the current budget. Entry 16 requires the budget to move only in a log entry that explains the growth, never as a side effect of another change. This is that entry.

### Requirements
- **Rule carve-out (rule 2):** this entry is documentation-and-tests only and is explicitly permitted to edit `tests/size-check.mjs`. It must not touch `src/`, so `index.html` stays byte-identical and `npm run build` is a no-op. Do **not** go `Blocked` on rule 2 for this entry.
- Raise `BUDGET` from `132000` to `156000`, and record the projection beside the constant:
  - 125,420 bytes today (after entry 18)
  - +18,000 projected for entries 19–22 (19 ≈ 6,000; 20 ≈ 6,000; 21 ≈ 2,500; 22 ≈ 3,000), giving ≈ 143,500 when the queue is drained
  - 156,000 leaves ≈ 12,500 bytes (8%) of headroom on top of that
- Leave the failure message's "raise `BUDGET` deliberately in a log entry that explains the growth" wording exactly as it stands — this entry follows that rule, it does not relax it. Rule 3 keeps the same sentence for the same reason.
- Do not change the always-printed size/percent line. Visible growth on every run is the point of the guard, and a looser cap makes that reporting more important, not less.

### Tests
- `tests/size-check.mjs` passes and prints the new percentage against the raised budget.
- No other suite changes: `index.html` is untouched, so all five suites must pass exactly as they stand.

### Do not
Touch `src/` or rebuild `index.html`; weaken or delete the budget assertion itself; remove the size/percent reporting line; renumber any entry; treat the raised number as licence to stop noticing growth — if the queue lands under 143,500 bytes, a later entry should lower `BUDGET` back toward the real figure. A budget that only ever ratchets upward is not a guard.

---

## 19. Delete your own entries from the You feed, with a real confirm dialog and focus restoration

Status: Done — 2026-07-25
Notes: Delete your own entries from the You feed via a confirm dialog. `render()` now passes `activityMarkup(myLogs,5,true)` (own-entries-only by construction, `data-del` still the global `logs.indexOf(x)`), and `init()` gains a `#personalActivity` click listener mirroring the `#activityList` one, which now passes the feed key. `deleteEntry` is split into `requestDelete(index,id,feed)` — stashes `{index,id,feed,position}`, where `position` is the row's place among that feed's `[data-del]` buttons (0 when the feed cannot be queried) — and `async performDelete()`, the old body minus `confirm()`, with the shared branch's `action:'delete'` request body, toasts and `loadRemote(true)` untouched, then `closeModal('confirmModal')` and `restoreFeedFocus(feedSelector(feed),position)`. `nextFocusIndex(position,count)` is `-1` for an empty feed and `Math.min(position,count-1)` otherwise; `restoreFeedFocus(feedSelector,position)` is null-safe (the stub's `querySelectorAll` returns `[]`) and falls back to the You card's `data-tab="record"` button or `#syncStatus`. `#confirmModal` sits after `#weekReviewModal` and before `#setupModal`, outside every `data-panel`, reusing `.modal`/`.dialog`/`.dialog-head`/`.btn` and the existing `openModal`/`closeModal` trap — no second modal or focus-trap implementation. `src/styles.css` gains one fragment: `.confirm-actions{display:flex;gap:12px}.confirm-actions .btn{flex:1}.btn.danger{border-color:var(--danger);color:var(--danger)}`. Tests: harness-1 covers `nextFocusIndex` (0/0, 0/3, 2/2, 5/3); harness-2 asserts both feeds render `data-del=` and `aria-label="Delete `, then calls `requestDelete(0,'d1','personal')` and `performDelete()` directly (the stub cannot fire delegated handlers) and checks the dialog opens, names the activity/grade/person, drops exactly one log, and closes — the shared branch is left to the fetch-stubbed harness, as noted in a comment. `static-check.mjs` adds `confirmTitle` to the existing dialog array, the `Close delete confirmation` label, `#confirmOk`/`#confirmCancel` as `type="button"`, `function requestDelete(`, and `assert.doesNotMatch(script,/[^.\w]confirm\(/)`; no assertion was relaxed or retargeted. index.html 125,420 → 128,114 bytes (+2,694; 82.1% of the 156,000-byte budget, well inside the ~6,000 this entry was projected to cost); `BUDGET` unchanged. Deviations: (1) `disconnect()` carried a **second** native `confirm()`, so the entry's premise that the delete prompt is "the only such prompt" is wrong and the required `doesNotMatch` assertion could not pass while it stood; `disconnect()` now opens the same dialog and its old body moved verbatim (same copy) to `performDisconnect()`. To serve both callers, `#confirmOk` is wired to `confirmProceed()`, a one-line dispatcher that runs the action stashed by `askConfirm(title,message,action,okLabel)` — for a delete that action is `performDelete`, and `askConfirm` also sets `#confirmTitle` and the confirm button's label so the shared dialog stays honest ("Delete" vs "Use local mode"). (2) `#confirmBody` is filled with `textContent`, not `esc()` into `innerHTML`: the entry's own test bullet asserts `#confirmBody.textContent`, and `textContent` is escape-safe by construction, where escaping into it would print `&amp;` in a name. (3) One extra helper, `feedSelector(feed)`, maps the feed key to `#personalActivity`/`#activityList` so the listener, the stash and the focus restore cannot drift apart. (4) Rule 10 archiving: entry 23 moved verbatim into `IMPROVEMENTS.md` and its index line dropped — but the previous iteration's archive of entry 18 had been pasted **into the middle of entry 15's `Notes:` line** (split at "sit under `"), leaving entry 15 truncated and entry 18 nested inside it. Entry 18's block was lifted out verbatim to its proper place after entry 17, entry 15's `Notes:` line rejoined byte-for-byte, and entry 23 appended after entry 18.

### Why
`deleteEntry` is wired only to the Crew feed (`#activityList`), and the You feed renders with `activityMarkup(myLogs, 5, false)` — so removing your own mistyped entry means switching to the Crew tab and hunting for it among the newest 20 crew entries. The confirm is a native `window.confirm()`, the only such prompt in an app that already has four custom modals, and because it cannot be stubbed, `deleteEntry` is untestable today. After a local-mode delete, `render()` replaces `#activityList.innerHTML`, destroying the focused `.del` button so focus falls to `<body>`.

### Requirements
- `src/app.js` — pass `true` as `activityMarkup`'s `allowDelete` for the personal feed (`activityMarkup(myLogs, 5, true)`). `myLogs` is already filtered to `x.name.toLowerCase() === meLower`, so this is own-entries-only by construction, and the existing `data-del` index is `logs.indexOf(x)` (a global index) so it needs no change. Add one delegated `#personalActivity` click listener in `init()`, mirroring the existing `#activityList` listener exactly.
- Split `deleteEntry(index, id)` into `requestDelete(index, id, feed)` and `async performDelete()`. `requestDelete` stashes `{index, id, feed, position}` in a module-level variable, fills the new confirm dialog and calls `openModal('confirmModal')`; `performDelete` is the current async body **minus `confirm()`** (shared and local branches unchanged, same toasts, same `loadRemote(true)`), then `closeModal('confirmModal')` and focus restoration. Dropping `confirm()` also removes the un-stubbed global that makes this path untestable.
- Focus restoration: new pure helper `nextFocusIndex(position, count)` → `Math.min(position, count - 1)`, or `-1` when `count === 0`. Then `restoreFeedFocus(feedSelector, position)` queries `feedSelector + ' [data-del]'`, focuses the element at `nextFocusIndex(...)`, and falls back to the feed card's `data-tab="record"` button (You) or `#syncStatus` (Crew) when the feed is empty. Must be null-safe — the test stub's `querySelectorAll` returns `[]`.
- `src/index.template.html` — new `#confirmModal` placed **after `#weekReviewModal` and before `#setupModal`**, i.e. outside every `data-panel` section, so no existing order assertion is affected: `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">` with `#confirmTitle`, `#confirmBody`, `#confirmClose` (`aria-label="Close delete confirmation"`), and a `.confirm-actions` row of `#confirmCancel` (secondary) and `#confirmOk` (`class="btn danger"`), both real `type="button"` and at least 44px. Reuse `openModal`/`closeModal`, which already trap Tab and restore `lastFocused` — do not write a second modal implementation.
- Wire `#confirmOk` → `performDelete`, and `#confirmCancel`/`#confirmClose` → `closeModal('confirmModal')`, in `init()`. `#confirmBody` names the entry the way the current `confirm()` string does (`Delete Climbing V5 for Alex?`), via `esc()`.
- `src/styles.css` — reuse `.modal`/`.dialog`/`.dialog-head`/`.btn`; add only `.confirm-actions{display:flex;gap:12px}` plus a `.btn.danger` variant if none exists (the `.text-btn.danger` colour token can be reused).

### Tests
- `tests/client-state.test.js` harness-1 `checks` literal: `nextFocusIndex(0,0) === -1`, `(0,3) === 0`, `(2,2) === 1`, `(5,3) === 2`.
- `tests/client-state.test.js` harness-2 `domChecks` literal (no backticks, no `${`): with three own logs and `endpoint=''`, `render()` then assert `#personalActivity.innerHTML` contains `data-del=` and `aria-label="Delete ` **and** that `#activityList.innerHTML` still does. Call `requestDelete(0,'first','personal')` → `#confirmModal` has the `open` class and `#confirmBody.textContent` names the activity and the person; call `performDelete()` → `logs.length` drops by one, the modal loses `open`, and nothing throws. Only the **local** branch is testable here (harness 2 has no `fetch` stub); leave the shared branch to harness 3's pattern or a comment.
- `tests/static-check.mjs` — **strengthen** the existing dialog loop by adding `confirmTitle` to the `['identityTitle','proxyTitle','setupTitle']` array (it already asserts `role="dialog" aria-modal="true" aria-labelledby=…`); assert `aria-label="Close delete confirmation"`, that `#confirmOk`/`#confirmCancel` exist with `type="button"`, and `assert.match(script, /function requestDelete\(/)`. Add `assert.doesNotMatch(script, /[^.\w]confirm\(/)` to lock the native prompt out for good. The single-`<table>` count and unique-id assertions must still pass.

### Do not
Add an undo path in this entry — the toast is `pointer-events:none`, and re-POSTing a deleted row in shared mode would mint a new `id`/`createdAt` against the live Sheet; the custom confirm is the accidental-delete fix, and undo deserves its own entry (local-mode only, a real button, not the toast). Do not render delete buttons for other people's entries in the You feed; do not change `deleteEntry`'s shared-mode request body or its `action:'delete'` contract, or `activityMarkup`'s markup for the Crew feed; do not build a second modal or focus-trap implementation; do not add a localStorage key.

---

## v11 pass — shipped without a log entry (backfill B1–B5)

Five feature commits reached the live site without a queue entry. They are recorded here as stubs so
the archive matches the shipped app. The `B` prefix is deliberate: these labels can never collide
with the queue's integers, so no future entry number is consumed by backfilled history.

## B1. First-open Week in Review recap

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `cb77882` ("Add first-open Week in Review recap") added a celebratory modal shown on the first app open of each ISO week, and immediately after a brand-new user is assigned a profile: the viewer's previous-week points, active days and hardest grade (with a welcome fallback for users with no history), the weeks remaining in the challenge, and the previous week's top three point contributors plus its 🏹 Bounty Hunter, all derived client-side from the raw logs via `computeCredits()` — no API, schema, URL or scoring change. It also introduced the client-only `roadToSendWeekReview` localStorage key that gates the modal to once per week; that key was missing from rule 4's frozen list until entry 15 corrected it, which is why `tests/docs-check.mjs` now asserts every `roadToSend…` literal in `src/app.js` appears in that list.

---

## B2. All-time bounty leaderboard view and champions callout

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `f45e3a3` ("Add all-time bounty leaderboard view and champions callout") added a third "Bounties" segment to the Crew leaderboard toggle ranking climbers by total bounties completed across the whole challenge, counting every claim including those past the weekly 6-point cap, consistent with how the 🏹 Bounty Hunter tag is decided. `computeCredits()` gained a `bountyTotal` map, `totalsModel()` exposes `bountiesTotal` per row, the Bounties view re-ranks the same single table by it while swapping the last two column headers, and a champions line names the current points leader and most-bounties leader (ties shared) without hard-coding prizes. Covered by additions to `tests/client-state.test.js` and `tests/static-check.mjs`.

---

## B3. Split leaderboard toggle into metric and time range

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `21a2ee9` ("Split leaderboard toggle into metric and time range") replaced the single three-way toggle shipped by entry 13 and B2 — which mixed two dimensions, so points had Weekly/Overall but bounties only an all-time view — with two toggles, `#leaderMetricToggle` (`#leaderPointsBtn`/`#leaderBountyBtn`) and `#leaderScopeToggle` (`#leaderWeekBtn`/`#leaderOverallBtn`), giving all four combinations. `leaderView` split into `leaderMetric` and `leaderScope` with the sort key chosen from the pair (`week`, `total`, `bounties`, `bountiesTotal`); the columns became fixed "This week" and "Overall" with the active one highlighted and the table carrying a dynamic `aria-label`; the champions block lists weekly and overall leaders for both metrics. This is the commit that supersedes entry 13's `#leaderToggle` ids; `tests/static-check.mjs` asserts the current ones.

---

## B4. New directional bounties

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `3a7da67` ("Add new directional bounties") added 6 climbing, 2 exercise and 4 mobility bounties to the catalog in `src/scoring.json`, in the same effort-focused style as the existing set. It edited a shared contract file that rule 2 places out of scope for log-driven entries, and it enlarged the catalog without bumping the API version — daily bounties are picked by hashing the date across the pool, so a larger catalog reshuffles every day's picks. B5 is the follow-up that repaired the resulting client/backend drift; together they are the concrete reason entry 15 made rule 2 and `AGENTS.md` agree that `scoring.json`, `schema.json` and `apps-script.js` change only in an organizer-coordinated task that bumps the API version and gets its own entry.

---

## B5. Bump protocol to v11 so catalog changes reject stale backends

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `0695742` ("Bump protocol to v11 so catalog changes reject stale backends") advanced the API version in `src/schema.json` (plus the client check, README and fixtures) after B4 enlarged the bounty catalog under version 10. Because the version had not moved, an updated site still accepted a not-yet-redeployed v10 Apps Script computing the smaller catalog, so the site could offer a bounty the server refused as "not available on that date". A v11 client now refuses a v10 endpoint with "Apps Script update required", forcing the organizer redeploy that keeps both sides on one catalog; the catalog itself was untouched, so the offered bounties did not change. This is the organizer-coordinated shape of change that rule 2 reserves for its own entry.
