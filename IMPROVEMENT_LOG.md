# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Rules for implementers (read before every entry)

1. **This app is LIVE.** Real crew data lives in a shared Google Sheet and in users' localStorage. Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change (`index.html` stays at the repository root).
2. **Edit only** `src/app.js`, `src/index.template.html`, `src/styles.css`, and test files. **Never** edit `index.html` directly, and **never** touch `src/apps-script.js`, `src/schema.json`, or `src/scoring.json` — any change there forces an API version bump and an organizer redeploy, which is out of scope for every entry in this log.
3. **After editing:** run `npm run build`, then `npm test` (all must pass). Commit the regenerated `index.html` together with your `src/` and test changes. Never weaken or delete an existing test assertion.
4. **localStorage keys are frozen:** `roadToSendEndpoint`, `roadToSendMe`, `roadToSendLogsV9`, `roadToSendConfigV9`, and `roadToSendShared:{activities|config|meta}:{endpoint}`. Read them; never rename them; only write shapes existing code already reads. Do not add new localStorage keys unless an entry explicitly says so (none currently do).
5. **Structural constraints enforced by tests:** exactly **one `<script>` block** in the template (all JS goes in `src/app.js`); exactly **one `<table>`** in the page (new visualizations use divs/CSS grid); the built lines `const SCRIPT=\`…\`;` and the `const SUPPORTED_API_VERSIONS` line immediately after it are untouchable (no backticks may enter the Apps Script string); DOM ids stay unique; every labeled input keeps its `<label for>`.
6. **Reuse the scoring core:** `computeCredits()`, `totalsModel()`, `paceInfo()`, `weekKey()`, `fmtDay()`, `parseDateOnly()`, and `challengeToday()`. Never call `new Date()` for challenge-date logic — shared mode follows the Sheet's timezone via `challengeToday()`. Never fork or re-derive scoring math; consume the maps `computeCredits()` returns. New display logic = small pure helper functions called from `render()`; `render()` runs often, so keep additions idempotent and cheap.
7. **Accessibility:** minimum 44px touch targets; graphics get `role="img"` with a meaningful `aria-label` text alternative (decorative inner elements `aria-hidden="true"`); dynamic status text uses `aria-live="polite"`; keep visible focus (site uses `:focus-visible`). **Motion:** CSS-only transitions/animations so the existing `@media(prefers-reduced-motion:reduce)` kill-switch applies; no JS-driven animation.
8. **No external dependencies, no new network requests, no frameworks, no build-tool changes.** Match the existing compact single-line code style of `app.js`/`styles.css`.
9. **Tests per entry:** behavioral coverage for new helpers goes in `tests/client-state.test.js` (it evals the built script — new top-level helper functions are directly reachable there); DOM/a11y presence assertions go in `tests/static-check.mjs`. Copy must not trip the banned-strings assertion in `static-check.mjs` (no "Hard mode", "Super hard mode", "pull-up mode", "Record send pyramid", "Balanced week bonus").
10. **Bookkeeping:** set `Status: In progress — date` when starting; on completion set `Status: Done — date` and put the commit subject plus any deviations in `Notes:`. If an entry cannot be completed inside these rules, set `Status: Blocked — reason` and move on — do not bend the rules.

---

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
Notes: Add projected group finish line to the Crew tab. Pure helper `projectedTotal(total,settings,today)` (separate from `paceInfo`, which is untouched) returns null for invalid windows/goals, before the start, after the end, or with fewer than 3 elapsed days; otherwise `{projected}` = round(total/elapsed × totalDays), plus `goalDate` (the day cumulative rate×days first reaches the goal, clamped to the window end) whenever rate > 0 and the goal ≤ projected. New `<p id="goalProjection" class="hint hide" role="status" aria-live="polite">` right after `#goalPace`; `render()` fills it as "On pace for ~X points by the end" or "On pace to hit the goal around <fmtDay date>" and hides it on null. Today is always passed in (`challengeToday()` at the call site); no clock reads inside the helper. No deviations from the spec.

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

Status: Todo
Notes: —

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

Status: Todo
Notes: —

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

Status: Todo
Notes: —

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

Status: Todo
Notes: —

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

Status: Todo
Notes: —

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

Status: Todo
Notes: —

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
Notes: Add weekly/overall leaderboard toggle with podium medals. Segmented `#leaderToggle` (`#leaderWeekBtn`/`#leaderOverallBtn`, real `type="button"` with `aria-pressed`) in the Leaderboard card head; active view held in module var `leaderView` (defaults `'week'`, no localStorage key). Two pure helpers called from `render()`: `rankLeaders(rows,metric)` re-sorts `totalsModel().sorted` by the active metric (week/total desc, name tie-break) and `podiumMedals(rows,metric)` maps name→🥇🥈🥉 by dense rank over distinct positive values (ties share, 0 earns none). Medal renders as a `role="img"` `<span class="medal">` inside the existing Climber cell mirroring the 🏹 span; both Week and Total columns stay in both views; 🏹 Bounty Hunter logic untouched. Deviations from spec: none.

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
