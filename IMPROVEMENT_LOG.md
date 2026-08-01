# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 65 — Stop promising a local delete cannot be undone — Done — 2026-08-01
- 66 — Re-baseline the bundle budget for the rolling-window pass — Todo
- 67 — A rolling seven-day window — Todo
- 68 — Bounty Hunter counts the last seven days — Todo
- 69 — Three titles for the habits people keep — Todo
- 70 — On Fire and Beast — Todo
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

## 69. Three titles for the habits people keep

Status: Todo

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

## 70. On Fire and Beast

Status: Todo

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

## 71. Retire the podium medals

Status: Todo

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

## 72. Recent, not Weekly

Status: Todo

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
- `tests/client-state.state.test.js`: equal points in both windows is `'even'`; more recent is `'up'`; fewer is `'down'`; the guard returns `null` when the earlier window predates `config.startDate`. A bounty claimed in the recent window moves the arrow — the case `dayMeter` would have missed.
- **Boundary arithmetic, stated once so it is not re-derived wrongly.** `windowStart(today,14)` is `today-13`, so the two windows are `[today-6, today]` and `[today-13, today-7]` — seven days each, adjacent, non-overlapping. Assert that a day **13** days old falls in the earlier window and a day **14** days old falls outside both. A test that expects a 14-day-old day to count would force the earlier window to eight days and break the symmetry the comparison depends on.
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
