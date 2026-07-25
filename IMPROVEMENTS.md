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
