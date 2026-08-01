# v11 pass — entries 61 onward

The current open archive file: rule 10 moves each finished entry here. When it approaches the
per-file cap in `tests/docs-check.mjs`, start the next file rather than raising the cap.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.

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
