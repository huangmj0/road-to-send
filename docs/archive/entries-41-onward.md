# v11 pass — entries 41 onward

The current open archive file: rule 10 moves each finished entry here. When it approaches the
per-file cap in `tests/docs-check.mjs`, start the next file rather than raising the cap.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.

---

## 41. Preview the week's bounties

Status: Done — 2026-07-26
Notes: Commit `Preview the bounties the rest of the week will offer`. Pure helper
`upcomingBounties(today,days=7)` walks forward from `today` with `parseDateOnly()`/`localDate()`,
returning `{date,label,bounties}` per day from `dailyBounties()` and `fmtDay()`; it starts at
**tomorrow**, stops at `config.tripDate`, and returns `[]` for an unparseable day. No `new Date()`
for challenge dates (rule 6) — the only `new Date(start)` is a copy of an already-parsed date used
to step the walk. `#bountyWeekToggle` (a `type="button"` carrying `aria-expanded`, `aria-controls`)
and the `#bountyWeek` container sit under `#todayBounties` and `#bountyCapHint`, above
`#personalActivity`, so the existing `data-panel="you"` → `id="todayBounties"` →
`id="personalActivity"` chain is intact. It is **closed by default and renders nothing until
opened**: `renderBountyWeek()` empties the container whenever it is closed. Each future day shows
`fmtDay()`'s label and its three bounties as plain rows — no claim buttons, since claiming stays
same-day through entry 14's `claimBounty()`, which the backend enforces regardless. `src/styles.css`
gains one appended line reusing the existing bounty visual language, with `min-height:44px` on the
toggle (rule 7) and no animation at all, so there is nothing for the `prefers-reduced-motion`
kill-switch to suppress. No modal, so `static-check.mjs`'s dialog-naming array is untouched.
index.html 141,849 → 144,001 bytes (+2,152; 89.4% of the 161,000-byte budget, close to the ~2,500
this entry was projected to cost). Tests: harness-1 covers the helper — seven days from a
mid-challenge date starting at tomorrow, one bounty per category per day, labels matching `fmtDay()`,
picks identical to `dailyBounties()` for that date, the same date always yielding the same picks,
three days left near the trip date, nothing on the last day or past it, and nothing for a blank
date. Harness-2 asserts the container is empty and hidden until the toggle runs, that opening lists
the days without a single `data-claim-bounty`, that a repaint keeps an open preview open, and that
closing empties it again. `static-check.mjs` gains presence assertions for both ids, `aria-expanded`
on the toggle, an order assertion, and `function upcomingBounties\(`. Deviations: (1) The open/closed
state is a module-level `bountyWeekOpen` rather than being read back out of the toggle's
`aria-expanded` attribute. The first draft read the DOM, which is both fragile and untestable —
`setAttribute` is a no-op and `getAttribute` always returns `null` in the stub harness — so the flag
is the source of truth and `renderBountyWeek()` writes `aria-expanded` from it. (2)
`renderBountyWeek()` is called from the top of `renderBounties()`, so an open preview stays fresh
across repaints and a day rollover; it renders nothing while closed, so this costs nothing in the
common case (rule 6). (3) Rule 10 archiving: entry 40 was moved verbatim into `IMPROVEMENTS.md`
after the archived entry 38 and its index line dropped; the lifted block was string-matched back out
of the archive (exactly one occurrence, gone from the log, heading confirmed at the start of its own
line) and entry 38 was confirmed intact and unsplit.

### Why
`dailyBounties(date)` picks three bounties per day by hashing the date across the catalog, so the rotation is deterministic and every future day's picks are already computable on the client. The app only ever renders today's three. Someone planning a gym session on Thursday cannot see what Thursday offers, even though the answer is a pure function call away — and browsing the whole catalog would be worse, since most of it is unclaimable on any given day.

### Requirements
- `src/app.js` — a pure helper taking `today` and returning the next seven days' picks, built from `dailyBounties()` with `parseDateOnly()`/`localDate()` for the walk. Never `new Date()` for challenge dates (rule 6); stop at the challenge end date.
- `src/index.template.html` — a collapsible preview under the existing bounty card on the You panel, below `#todayBounties` and `#bountyCapHint`, opened by a `type="button"` toggle carrying `aria-expanded`. It is **closed by default** and renders nothing until opened. Placing it before `#personalActivity` keeps the existing `data-panel="you"` → `id="todayBounties"` → `id="personalActivity"` chain intact.
- Each future day shows `fmtDay()`'s label and its three bounties as plain rows — **not** claim buttons. Claiming stays same-day through entry 14's `claimBounty()`, which the backend enforces regardless.
- `src/styles.css` — reuse the existing bounty row styling; the toggle keeps `min-height:44px` (rule 7). Any expand/collapse is CSS-only so the `prefers-reduced-motion` kill-switch applies.
- No new modal, so `static-check.mjs`'s dialog-naming array is untouched — this is an in-page disclosure.

### Tests
- `tests/client-state.test.js` harness-1: the helper returns seven days from a mid-challenge date, fewer as the trip date approaches and none after it; the first day's picks equal `dailyBounties(today)`; the same date always yields the same picks.
- `tests/client-state.test.js` harness-2 `domChecks`: the preview container is empty until the toggle function runs.
- `tests/static-check.mjs` — **add** presence assertions for the container and toggle ids, `aria-expanded` on the toggle, and an order assertion `id="todayBounties"` → the new id, keeping the existing You-panel chains passing.

### Do not
Render claim buttons for future days or change `claimBounty()`'s same-day rule; list the whole catalog; change `dailyBounties()`, `hashText()` or anything in `src/scoring.json` (rule 2); add a modal or a new nav route; open the preview by default.

---

## 42. Show the note you wrote on a climb

Status: Done — 2026-07-27
Notes: Commit `Show the note you wrote on a climb`. One segment added to the `climb` branch of
`activityMarkup()`'s three-way `detail` expression — `${x.note?' · '+esc(x.note):''}`, the same
shape and the same `esc()` the bounty and fall-through branches already use, placed after the
grade so the row reads `Climbing · V4 · crimpy · Jul 5`. The branch structure is unchanged (the
entry forbade restructuring it), no template or CSS change, and `render()` gains no work — this is
string concatenation inside a map that already ran. index.html 144,001 → 144,032 bytes (+31, 89.5%
of the 161,000-byte budget; the entry projected ~300, so the pass has more headroom than estimated).
Tests: six assertions in `tests/client-state.state.test.js` — the note reaches the row, the grade
precedes it, a climb with a note but no grade still shows the note, a climb with a grade but no
note keeps rendering exactly as before, no stray separator appears, and a note containing markup is
escaped rather than injected. Verified the assertions fail against the pre-fix source and pass
after it, so they lock the bug rather than merely describing it. Deviations: (1) `activityMarkup()`
was covered in the DOM suite by entry 34, but the entry specified the state suite; it is reachable
there because it touches no document, so the assertions call it directly with no `render()` and no
stub — a smaller test for the same behaviour. (2) Rule 10 archiving: entry 41 was moved verbatim
into `docs/archive/entries-41-onward.md` (the file `IMPROVEMENTS.md` marks current) and its index
line dropped; the lifted block was string-matched back out of the archive — exactly one occurrence,
gone from the log, heading at the start of its own line — and the archive file held no prior entry,
so nothing above it could be split.

### Why
`activityMarkup()` builds each feed row's `detail` string with a three-way branch on `x.type`. The bounty branch appends `x.note` and the fall-through branch (exercise, mobility) appends `x.note`, but the `climb` branch renders `CAT_LABELS.climb` plus the grade and drops the note on the floor. So a note typed against a climb — the category people most want to annotate — is saved, synced, exported, and never shown back. The Record tab offers the field, and the feed silently swallows it.

### Requirements
- `src/app.js` — in `activityMarkup()`, the `climb` branch appends the note the same way the other two branches already do, escaped through `esc()` and separated by the same ` · ` the other branches use. Keep the grade segment ahead of the note.
- Do not restructure the three-way branch into something cleverer; this is a one-segment addition to one branch, and rule 6 keeps `render()` cheap.
- No template or CSS change — the row markup and its styling are unchanged.

### Tests
- `tests/client-state.state.test.js`: a climb logged with a note renders the note in its row; a climb with a grade and a note renders both, grade first; a climb with no note renders exactly what it renders today (no stray separator); a note containing `<` is escaped.
- No `tests/static-check.mjs` change — nothing new appears in the built markup.

### Do not
Add the note to the leaderboard, the person card, or any summary; change what `exportData()` writes; change `CAT_LABELS`; touch `src/scoring.json` (rule 2).

---

## 43. Filter your own feed by category

Status: Done — 2026-07-27
Notes: Commit `Filter your own feed by category`. `filterByType(items,type)` is a one-line pure
helper that returns `items` itself for a falsy or `'all'` type and otherwise `items.filter()` on
`x.type` — it does not sort, slice or re-key, so `activityMarkup(items,limit,allowDelete)` stays
the single place ordering and limiting happen, and delete still works through the filter because
`activityMarkup()` derives `data-del` from `logs.indexOf(x)` rather than the position in the list
it was handed. `feedChips()` builds the chip faces from `CATEGORIES`/`CAT_LABELS`
(`SCORING.categoryLabels`) and `TYPE_ICONS`, so nothing is hard-coded but the word "All";
`renderFeedChips()` writes them into the new `#feedFilter` container, and `setFeedType(type)`
validates against `CATEGORIES`, returns early when unchanged, calls `resetFeedLimits()` and
re-renders through `render()`. The selected type is module-level `feedType` (default `'all'`,
declared beside the feed limits), never read back out of the DOM. `render()` gains one call and one
`filterByType()` pass over the already-computed `myLogs`; `hasMyLogs` still comes from the
unfiltered list, so the empty state and the feed's `hide` toggle behave exactly as before.
Template: one `<div id="feedFilter" class="cat-chips feed-filter" role="group" aria-label=…>`
between `#youEmptyState` and `#personalActivity`, which leaves the
`data-panel="you"` → `#todayBounties` → `#personalActivity` → `.stat-grid` chain intact. CSS is
four selectors reusing the existing `.cat-chip` pill (min-height 44px, rule 7) with the pressed
state expressed as `[aria-pressed="true"]` — CSS only, so the `prefers-reduced-motion` kill-switch
applies. index.html 144,032 → 145,443 bytes (+1,411, 90.3% of the 161,000-byte budget). Tests: 15
assertions in `tests/client-state.state.test.js` covering `filterByType()` (all/empty/missing type,
each category including `bounty`, a type nobody logged, an empty feed, and two order assertions on
deliberately unsorted input) plus four on `feedChips()` reading its faces from the scoring config;
17 in `tests/client-state.dom.test.js` for the rendered feed narrowing, restoring, the pressed chip
flipping, and the show-more limit resetting across a filter change; seven in
`tests/static-check.mjs` for the container id, `role="group"`, the chip button shape with
`aria-pressed`, the two helper names, the `resetFeedLimits()` call site and the CSS pressed rule,
plus a source-order assertion `#youEmptyState` → `#feedFilter` → `#personalActivity`. Verified the
suite bites by mutating the built source three ways — `filterByType()` returning `items`
unconditionally, `setFeedType()` skipping `resetFeedLimits()`, and `render()` dropping
`renderFeedChips()` — each of which failed, so the assertions lock the behaviour rather than
describing it. Deviations: (1) the entry's chip-row wording put the row "below `#youEmptyState`",
which is where it sits, so it is visible even when the user has no activity yet; hiding it would be
behaviour the entry did not ask for and did not test, so it was left visible. (2) `feedChips()` is
a second small helper the entry did not name, extracted only so the chip faces are assertable
without a document; `renderFeedChips()` remains the sole writer of the container. (3) Rule 10
archiving: entry 42 was moved verbatim into `docs/archive/entries-41-onward.md` (the file
`IMPROVEMENTS.md` marks current) and its index line dropped; the lifted block was string-matched
back out of the archive — exactly one occurrence, gone from the log, heading at the start of its
own line — and entry 41 above it was confirmed intact and unsplit.

### Why
The You feed lists every activity newest-first, and entry 38 made it show more of itself. Someone who wants to see just their climbs — to check what grades they have been logging, or find the session they wrote a note about — has to scroll past exercise and mobility rows to do it. The category totals already exist on the same tab in `categoryBreakdown()`, so the app knows the split; it just will not narrow the list to it.

### Requirements
- `src/app.js` — a pure helper `filterByType(items,type)` returning `items` unchanged for a falsy/`'all'` type and otherwise only entries whose `type` matches. It must not sort, slice, or otherwise duplicate what `activityMarkup()` already does; `activityMarkup(items,limit,allowDelete)` stays the single place ordering and limiting happen.
- `src/index.template.html` — a chip row directly above `#personalActivity` and below `#youEmptyState`, so the existing `data-panel="you"` → `#todayBounties` → `#personalActivity` chain is unbroken. Each chip is a `type="button"` carrying `aria-pressed`, one per category in `SCORING.categories` plus an "All" chip that is pressed by default.
- Reuse `TYPE_ICONS` and `SCORING.categoryLabels` for the chip faces rather than hard-coding labels. The selected type is a module-level `feedType` (default `'all'`), not read back out of the DOM — `getAttribute` returns `null` in the DOM harness, so a DOM-derived flag is untestable.
- Changing the filter must call `resetFeedLimits()` so entry 38's show-more count does not carry across filters, and must re-render through the existing `render()` path.
- `src/styles.css` — reuse the existing chip/pill visual language; each chip keeps `min-height:44px` (rule 7). Any state change is CSS-only so the `prefers-reduced-motion` kill-switch applies (rule 7).

### Tests
- `tests/client-state.state.test.js`: `filterByType()` returns every item for `'all'` and for an empty argument, only matching items for each category, an empty array for a type nobody logged, and never reorders what it is given.
- `tests/client-state.dom.test.js`: the You feed shows all rows initially; selecting a category narrows it to that category's rows; selecting "All" restores them; switching filters resets the show-more limit.
- `tests/static-check.mjs`: presence assertions for the chip container id and `aria-pressed`, plus an order assertion that the chip row precedes `id="personalActivity"`.

### Do not
Add a localStorage key to remember the filter (rule 4 — it resets on reload, deliberately); filter the Crew feed here (that is entry 44); add a count of what is hidden, or any copy about what the user has not logged (tone rule); animate the chips in JavaScript.

---

## 44. Filter the Crew feed with the same chips

Status: Done — 2026-07-27
Notes: Commit `Filter the Crew feed with the same chips`. Entry 43 had merged, so the dependency
held and this entry stayed unblocked. No new function was added: the two functions entry 43
introduced were parameterised instead, which is what "adds no second helper" costs least.
`renderFeedChips(sel,active)` now takes the container selector and the filter it should show as
pressed — `render()` calls it twice, `renderFeedChips('#feedFilter',feedType)` and
`renderFeedChips('#crewFeedFilter',crewFeedType)` — and `setFeedType(type,crew)` grew one optional
flag choosing which module variable it writes (`if(crew)crewFeedType=next;else feedType=next`),
keeping its single `resetFeedLimits();render()` tail so either feed's change still clears entry
38's show-more count. `crewFeedType` is declared beside `feedType` on the same `let` line, default
`'all'`, and the two are never read through one another; `filterByType()` is untouched and now has
two callers, `filterByType(myLogs,feedType)` and `filterByType(logs,crewFeedType)`. The Crew feed's
`renderShowMore()` argument moved from `logs.length` to the filtered `crewShown.length`, so the
show-more offer counts the rows the current filter actually has rather than the whole log. Template:
one `<div id="crewFeedFilter" class="cat-chips feed-filter" role="group" aria-label=…>` inside the
Activity card between its `card-head` and `#activityList` — `#crewLocalHint` lives in the preceding
leaderboard card, so the required `#crewLocalHint` → chips → `#activityList` source order holds
without moving either card. `init()` gains one delegated listener on the new container, mirroring
43's and passing `true` as the second argument. **No CSS change at all**: reusing the
`cat-chips feed-filter` classes means the existing pill, the 44px `min-height` (rule 7) and the
CSS-only `[aria-pressed="true"]` state all apply as they stand, which is what the entry asked for.
index.html 145,443 → 145,995 bytes (+552, 90.7% of the 161,000-byte budget). Tests: 20 assertions in
`tests/client-state.dom.test.js` — the Crew feed opening unfiltered, narrowing across every
climber, switching category, and restoring, with the You feed deliberately parked on a *different*
category throughout so each step asserts both feeds, plus the symmetric check that changing the You
filter leaves `crewFeedType` and the Crew rows alone; eight in `tests/static-check.mjs` for the
container id, `role="group"`, its non-empty `aria-label`, the reused `feed-filter` class, the
`#crewLocalHint` → `#crewFeedFilter` → `#activityList` order, both `renderFeedChips()` call sites,
the two-branch assignment in `setFeedType()`, and that `filterByType()` is still defined exactly
once. Verified the suite bites by mutating the built script four ways — collapsing the two branches
of `setFeedType()` onto `feedType`, passing `logs` unfiltered to the Crew feed, dropping the Crew
`renderFeedChips()` call, and painting the Crew chips from `feedType` — each of which failed both
the DOM suite and `static-check`. Deviations: (1) the entry says "adds no second helper"; adding
the crew chip row still needs a second delegated click listener in `init()`, which is a listener
rather than a helper and has no shared-state alternative, so it was added. (2) Rule 10 archiving:
entry 43 was moved verbatim into `docs/archive/entries-41-onward.md` (the file `IMPROVEMENTS.md`
marks current) and its index line dropped; the lifted block was string-matched back out of the
archive — exactly one occurrence, gone from the log, heading at the start of its own line — and
entry 42 above it was confirmed intact and unsplit.

### Why
Entry 43 gives the You feed a category filter. The Crew feed on `#activityList` has the same problem and the same shape, and a filter that exists on one feed and not the other reads as an oversight rather than a decision.

### Requirements
- **Depends on entry 43** and must be implemented after it: this entry consumes `filterByType()` and the chip markup pattern 43 introduces, and adds no second helper. If 43 is not yet merged, this entry is `Blocked`.
- `src/index.template.html` — a chip row above `#activityList`, below `#crewLocalHint`, mirroring 43's markup with its own ids.
- `src/app.js` — a module-level `crewFeedType` kept separate from 43's `feedType`, so the two feeds filter independently. Changing it calls `resetFeedLimits()` and re-renders through `render()`.
- Reuse 43's chip styling as-is; `src/styles.css` should need no new rule beyond selecting the new container, if that.

### Tests
- `tests/client-state.dom.test.js`: the Crew feed narrows to a category and back; the two feeds' filters do not affect each other (setting one leaves the other's rows intact).
- `tests/static-check.mjs`: presence and `aria-pressed` assertions for the new chip container, and an order assertion that it precedes `id="activityList"`.

### Do not
Re-implement `filterByType()`; share one filter variable between the two feeds; add delete affordances to Crew rows (entry 29 made that feed read-only); add any per-person or crew-wide participation figure (tone rule).

---

## 45. Chart your own weeks on the You tab

Status: Done — 2026-07-31
Notes: Commit `Chart your own weeks on the You tab`. `personalWeeklyTrend(nameLower,today)` is
`weeklyTrend()`'s week walk with one line changed: instead of pre-summing the `weeks` map into a
per-week crew total it reads `weeks.get(key+'|'+wk)||0` straight out of the map `computeCredits()`
returns, which is the same key shape `weekTrend()` and `personalRecords()` already index by. It
carries `weeklyTrend()`'s four guards verbatim (unparseable `startDate`/`tripDate`/`today`,
inverted window, `today` before the start) plus two the entry asked for — a blank `nameLower`, and
`!logs.some(x=>nameKey(x)===key)` for a person with nothing logged — so the "nothing logged" case
returns `[]` rather than a row of zeros, which is what lets the card hide. Rows are the same
`{week,label,points}` shape, so `trendCaption()` consumes them unchanged. `weeklyTrend()` itself is
untouched, and a test asserts the crew chart still sums both climbers while the personal one counts
three points. `renderYouTrend()` mirrors `renderHeatmap()`/`renderPyramid()`: `classList.toggle(
'hide',!rows.length)`, empty the container and the caption when hidden, and it is called from
`render()` immediately after `renderHeatmap()`. Template: one `<article id="youTrendCard" class=
"card hide">` after `#heatmapCard` — the last card on the You panel, so every existing You-panel
order assertion is untouched — wrapping `<div id="youTrend" class="trend" role="img" aria-label=
"Your weekly points">` in the existing `.trend-scroll`, with `#youTrendSummary` beneath it. **No CSS
change at all**: reusing `trend-scroll`/`trend`/`trend-col`/`trend-bar`/`trend-label` means the
horizontal scroll, the bar geometry and the `prefers-reduced-motion` kill-switch all apply as they
stand, which is what "reuse the existing trend bar CSS rather than adding a second visual language"
asked for. index.html 145,995 → 147,510 bytes (+1,515, 91.6% of the 161,000-byte budget). Tests: 20
assertions in `tests/client-state.state.test.js` (one row per challenge week across the same span
`weeklyTrend()` charts, the W1..Wn labels, the row shape, per-week points checked against
`computeCredits().weeks` directly, another climber's entries staying out, the crew chart unchanged,
nothing-logged/blank-name/before-start/unparseable-today/blank-today/missing-start/missing-trip/
inverted-window all returning `[]`, the window capped at the week of today, and a logged-nothing
week appearing as a plain zero row); 14 in `tests/client-state.dom.test.js` (card hidden with no
entries, opening once something is logged, a column per week, the caption written by
`trendCaption()`, a repaint drawing the same bar count rather than a second set, and switching to a
climber with nothing logged closing and emptying it again); six in `tests/static-check.mjs` for the
`#heatmapCard` → `#youTrendCard` order, `role="img"` with a non-empty `aria-label`, the reused
`.trend-scroll` wrapper, the caption following its chart, and both new helper functions. Verified
the suite bites by mutating the built script six ways — zeroing the personal weeks, dropping
`renderYouTrend()` from `render()`, removing the empty-person guard, pinning the card open, making
the repaint append rather than assign, and deleting the card from the markup — each of which failed
the DOM suite, the state suite or `static-check`. Deviations: (1) the entry forbids changing "the
Crew tab's chart", and `renderTrend()` was still edited — its bar markup and its aria-label list
were lifted into two pure helpers, `trendColumns(rows)` and `trendAria(rows)`, that both charts now
call. The Crew chart's rendered output is byte-identical (its own DOM assertions still pass
untouched); duplicating ~300 characters of bar markup was the alternative, and rule 6 asks for small
pure helpers rather than a forked copy. `weeklyTrend()` itself, and what the Crew chart draws, are
unchanged. (2) `Object.keys()` in the state suite hands back a **host-realm** array that no
`deepEqual` against a literal inside the vm template can match — the row-shape assertion compares
`.sort().join('|')` instead, with a comment saying why. (3) Rule 10 archiving: entry 44 was moved
verbatim into `docs/archive/entries-41-onward.md` (the file `IMPROVEMENTS.md` marks current) and its
index line dropped; the lifted block was string-matched back out of the archive — exactly one
occurrence, gone from the log, heading at the start of its own line — and entry 43 above it was
confirmed intact and unsplit.

### Why
`weeklyTrend(today)` builds week-by-week bars from `computeCredits(logs)` across the whole crew, and the Crew tab renders them. An individual only ever gets `weekTrend(name)`, which is a single up/down/even arrow against last week. So the app can show the crew's shape over the whole challenge but shows one person only whether this week beat last week — and the per-week numbers for one climber are already in the same `computeCredits()` output.

### Requirements
- `src/app.js` — a pure helper `personalWeeklyTrend(nameLower,today)` returning the same row shape `weeklyTrend()` returns, restricted to one person. Derive it from the maps `computeCredits(logs)` returns (rule 6); never re-derive scoring math and never call `new Date()` for challenge dates — use `challengeToday()`, `weekKey()` and `parseDateOnly()` as `weeklyTrend()` does.
- Return `[]` when the person has nothing logged, when the config dates are unparseable, or when `today` precedes `config.startDate` — matching `weeklyTrend()`'s existing guards rather than inventing new ones.
- `src/index.template.html` — a card on the You panel after `#heatmapCard`, so the existing You-panel order assertions keep passing. It carries `role="img"` with an `aria-label` naming the per-week figures, and decorative bars are `aria-hidden="true"` (rule 7).
- Reuse `trendCaption()` for the text caption beneath it, as `#trendSummary` does on the Crew tab, and reuse the existing trend bar CSS rather than adding a second visual language.
- Hide the card when the helper returns `[]`, the way `renderPyramid()` and `renderHeatmap()` already toggle `hide` on their cards.

### Tests
- `tests/client-state.state.test.js`: the helper returns one row per challenge week for a person with entries spread across weeks; totals for a week match what `computeCredits()` credits that person for it; a person with nothing logged returns `[]`; a blank or unparseable date returns `[]`; another climber's entries never appear in the result.
- `tests/client-state.dom.test.js`: the card is hidden for a climber with no entries and populated for one with entries; a repaint does not duplicate the bars.
- `tests/static-check.mjs`: presence assertions for the card and chart ids, `role="img"` and a non-empty `aria-label`, and an order assertion `id="heatmapCard"` → the new card id.

### Do not
Change `weeklyTrend()` or the Crew tab's chart; compare the person against anyone else or against the crew average; render a week they logged nothing as a callout rather than simply a zero-height bar (tone rule — no absence counts); add a new localStorage key; animate the bars in JavaScript.

---

## 46. List the bounties you have claimed

Status: Done — 2026-07-31
Notes: Commit `List the bounties you have claimed`. `claimedBounties(nameLower)` filters `logs` to
`x.type==='bounty'&&nameKey(x)===key`, sorts with `activityMarkup()`'s exact date-then-`createdAt`
comparison (reversed for newest-first), and maps each entry to `{date,label,note}` — `label` through
the same `x.bountyTitle||(bountyById(x.bountyId)||{}).title||'Bounty'` chain `activityMarkup()` uses,
`date` through `fmtDay()`, `note` coerced with `String(x.note||'')` so a missing note is `''` rather
than `undefined`. It re-reads `logs` on each call and never touches scoring, so rule 6 is satisfied
by consumption rather than re-derivation; no `new Date()` anywhere. A blank `nameLower` returns `[]`
rather than matching entries whose own name is blank. `renderClaimed()` mirrors `renderBountyWeek()`
line for line — `toggle.setAttribute('aria-expanded',String(claimedOpen))`, `classList.toggle('hide',
!claimedOpen)`, and `if(!claimedOpen){box.innerHTML='';return}` so a closed section renders nothing
at all — driven by the module-level `let claimedOpen=false` that entry 41's precedent asks for, never
by reading the attribute back. `toggleClaimed()` flips the flag and repaints; `renderBounties()`
calls `renderClaimed()` immediately after `renderBountyWeek()`, and `init()` wires the toggle beside
the existing `#bountyWeekToggle` listener. Template: one `<button id="claimedToggle" class="text-btn"
type="button" aria-expanded="false" aria-controls="claimedList">` plus `<div id="claimedList" class=
"bounty-week hide">`, appended inside the existing Today's-bounties article after `#bountyWeek` —
under `#bountyWeek` and above `#youEmptyState` as required, and no existing id moved. Rows reuse the
`.bounty-peek` / `.bounty-cat` markup verbatim, so the only CSS change is widening one selector to
`#bountyWeekToggle,#claimedToggle{min-height:44px}` for rule 7's touch target; expand/collapse stays
the existing `.hide` class toggle, so it is CSS-only and the `prefers-reduced-motion` kill-switch
still applies. index.html 147,510 → 148,967 bytes (+1,457, 92.5% of the 161,000-byte budget).
Tests: 20 assertions in `tests/client-state.state.test.js` (only the named person's bounty rows,
newest-first ordering, the `createdAt` tiebreak within one day, the note carried through, a missing
note as `''`, the day formatted by `fmtDay()` and demonstrably not the raw ISO date, climb entries
excluded, title resolved from `bountyId` when `bountyTitle` is absent, `'Bounty'` for an unknown id
and for no id at all, and empty results for a person with no claims, a blank name and an empty log);
17 in `tests/client-state.dom.test.js` (closed by default with an empty container, opening lists the
claim and its note using `.bounty-peek`, another person's claim absent, no `data-claim-bounty` and no
`data-del` on these rows, a repaint keeping it open and redrawing one row rather than appending a
second, closing emptying it again, and a climber with no claims opening to no rows); seven in
`tests/static-check.mjs` (toggle id with `type="button"` and `aria-expanded="false"`, its
`aria-controls`, the container id, the `#bountyWeek` → `#claimedToggle` → `#claimedList` →
`#youEmptyState` order, the 44px rule, and both new functions). Verified the suite bites by mutating
the built script 11 ways — dropping the name filter, dropping `renderClaimed()` from
`renderBounties()`, letting a closed section keep its markup, sorting oldest-first, renaming the
toggle id, making the repaint append, collapsing the title chain to a constant, removing the 44px
rule, defaulting the flag to open, blanking the note, and deleting `aria-expanded` — each failed the
state suite, the DOM suite or `static-check`, against a confirmed-clean baseline.
Deviations: (1) the entry specifies the row shape `{date,label,note}` while also asking for a
resolved title and an `fmtDay()` day label, which is three derivations for two free fields. Read as:
`label` carries the resolved bounty title (it is the only field the title can occupy, and entry 45's
`{week,label,points}` uses `label` for display text the same way) and `date` carries the `fmtDay()`
label. No raw ISO date is exposed, because the newest-first sort happens inside the helper and no
caller needs one. (2) `assert.deepEqual` against a literal `[]` was avoided for the empty cases in
favour of `.length` checks, with a comment saying why — entry 45 hit a cross-realm array comparison
in this vm harness and length is sufficient here. (3) Rule 10 archiving: entry 45 was moved verbatim
into `docs/archive/entries-41-onward.md` (the file `IMPROVEMENTS.md` marks current, 21KB against the
90KB cap) and its index line dropped; the lifted block was string-matched back out of the archive —
exactly one occurrence, gone from the log, heading at the start of its own line — and entry 44 above
it was confirmed intact and unsplit.

### Why
`bountyWeekProgress()` knows how many bounty points this week have been credited against the weekly cap, and entry 41 added a preview of what the coming days will offer. Nothing shows what you actually claimed. The bounty rows in the feed are interleaved with every other activity, so reconstructing "which bounties have I done" means scrolling the whole log and reading each row's title.

### Requirements
- `src/app.js` — a pure helper `claimedBounties(nameLower)` returning that person's bounty entries newest-first as `{date,label,note}`, resolving each title through `x.bountyTitle` then `bountyById(x.bountyId)` with the same fallback chain `activityMarkup()` already uses, and labelling the day with `fmtDay()`.
- `src/index.template.html` — a collapsible section under `#bountyWeek` and above `#youEmptyState`, opened by a `type="button"` toggle carrying `aria-expanded` and `aria-controls`. **Closed by default, rendering nothing until opened**, exactly as entry 41's preview does; the render function empties the container whenever it is closed.
- Follow entry 41's precedent for state: a module-level open/closed flag is the source of truth and the render writes `aria-expanded` from it, rather than reading the attribute back (the DOM harness cannot observe it).
- Reuse the existing bounty row visual language; the toggle keeps `min-height:44px` (rule 7); expand/collapse is CSS-only (rule 7).

### Tests
- `tests/client-state.state.test.js`: the helper returns only bounty-type entries for the named person, newest-first; resolves a title from `bountyId` when `bountyTitle` is absent; falls back cleanly for an unknown `bountyId`; returns `[]` for someone with no claims; never includes another person's claims.
- `tests/client-state.dom.test.js`: the container is empty until the toggle runs; opening lists the claims; a repaint keeps an open list open; closing empties it again.
- `tests/static-check.mjs`: presence assertions for the container and toggle ids, `aria-expanded` on the toggle, and an order assertion `id="bountyWeek"` → the new toggle id.

### Do not
Add claim buttons or change `claimBounty()`'s same-day rule; show which bounties were *not* claimed, or a claimed-out-of-total figure (tone rule — surface what people did, never what they didn't); list another person's claims here; open the section by default; change `src/scoring.json` (rule 2).

---

## 47. Start the grade select where you left it

Status: Done — 2026-07-31
Notes: Commit `Start the grade select where you left it`. `lastLoggedGrade(nameLower)` filters `logs`
to `x.type==='climb'&&nameKey(x)===key`, sorts a **copy** (the array `filter()` returned, so `logs`
is never reordered) with `activityMarkup()`'s exact date-then-`createdAt` comparison reversed for
newest-first, takes `[0]`, and returns `String(last.hardestGrade||'')` only when
`GRADES.indexOf(grade)>=0` — so an unlisted grade, a blank grade and a missing one all give `''`,
matching the "not in `SCORING.grades`" clause. `GRADES` is `SCORING.grades`, read not written, so
rule 2 is untouched. A blank `nameLower` returns `''` rather than matching entries whose own name is
blank, mirroring entry 46's precedent. No `new Date()`, no scoring re-derivation, no localStorage
key: it derives from `logs` on every call. `applyGradeDefault()` reads `#hardestGrade`, returns
immediately if the field is missing **or already has a value**, and otherwise writes
`lastLoggedGrade(currentTarget()?.name.toLowerCase())`. `currentTarget()` (not `me`) is the source of
the name, which is what makes the default follow `recordingFor` and matches the name
`draftActivity()` will save under. The single call site is `updateRecordPreview()`, guarded by
`if(type==='climb')` and placed beside the existing `if(type==='bounty')populateBountySelect()` line
and before `draftActivity()`, so the preview sees the applied grade. That is the app's one
form-populate path — the type radios, `prefillCategory()`, `showTab('record')` and `render()` all
funnel through it — so no second hook was needed and no new listener was added. The field-has-value
guard is what satisfies "never overwrite a grade the user has already picked": a repaint with a
chosen grade is a no-op. After `submitActivity()` clears the field, the following `render()`
re-applies the just-saved grade, which is the entry's stated point. No template and no CSS change —
the select, its `<label for>` and its 44px sizing already exist. index.html 148,967 → 149,624 bytes
(+657, 92.9% of the 161,000-byte budget). Tests: 17 assertions in `tests/client-state.state.test.js`
(most recent climb wins, the `createdAt` tiebreak inside one day, the oldest climb explicitly not the
answer, exercise/mobility/bounty entries ignored even when they are the newest rows, another
person's later climb not leaking in while their own default does move, `''` for an unlisted grade,
for a climb with no grade, for a person with no climbs, for a blank name against a nameless entry,
and for an empty log, a padded stored name resolving through `nameKey()`, and `logs` left in its
arrival order after a call); nine in `tests/client-state.dom.test.js` (populate preselects the last
grade, a chosen grade survives both a repaint and a re-populate, switching `recordingFor` picks up
the other person's grade and switching back picks up the first person's, a climber with no climbs
left on the placeholder, and an unlistable stored grade never reaching the select). Verified the
suites bite by mutating the built script nine ways — dropping the `updateRecordPreview()` hook,
dropping the already-chosen guard, sorting oldest-first, dropping the `createdAt` tiebreak, dropping
the `GRADES` membership check, dropping the climb-type filter, dropping the blank-name guard, reading
`me` instead of `currentTarget()`, and sorting `logs` in place — each failed the state or DOM suite
against a confirmed-clean baseline.
Deviations: (1) Rule 10 archiving: entry 46 was moved verbatim into
`docs/archive/entries-41-onward.md` (the file `IMPROVEMENTS.md` marks current, 35,974 bytes against
the 90,000-byte cap) and its index line dropped; the lifted block was string-matched back out of the
archive — exactly one occurrence, gone from the log, heading at the start of its own line — and entry
45 above it was confirmed intact and unsplit. (2) The entry names one helper; a second one-line
`applyGradeDefault()` holds the DOM side so the pure helper stays pure and testable without a
document, which is what rule 9 asks for.
Follow-up in the same PR — commit `Re-derive the grade default when the target changes`: the
field-has-value guard could not tell a grade the form had filled in from one the user picked, so
choosing "Record for someone else" while the auto-applied default was still showing kept person A's
grade and would have saved it under person B. `applyGradeDefault()` now remembers the value it wrote
in a module-level `gradeDefaultApplied` and treats only a value it did not write as a manual choice;
a still-untouched default is re-derived (and cleared when the new target has no climbs), while a
hand-picked grade is left alone exactly as before. `lastLoggedGrade()` is unchanged and still pure.
The original DOM test cleared the select before each `recordingFor` switch, so it never crossed the
guard; four assertions were added on top of it (the switch with the default still showing, the draft
`hardestGrade` that would be saved, the switch back, and a hand-picked grade surviving a switch) and
no existing assertion was touched. Verified the first fails on a rebuild of the pre-fix script.
index.html 149,624 → 149,729 bytes (+105, 93.0% of budget). `npm test`: 5/5 suites.

### Why
`#hardestGrade` resets to its first option every time the Record form repaints. A climber logging three sessions in a week re-picks the same grade from an eighteen-entry list each time, on a phone, at the gym. The information needed to do better is already in `logs`.

### Requirements
- `src/app.js` — a pure helper `lastLoggedGrade(nameLower)` returning the `hardestGrade` of that person's most recent climb entry, or `''` when they have none or the stored value is not in `SCORING.grades`. Order by the same date/`createdAt` comparison `activityMarkup()` uses so "most recent" means one thing in this app.
- Apply it only when the Record form is populated for a climb and the field is otherwise at its default — never overwrite a grade the user has already picked in the open form.
- This is a default, not a memory: no localStorage key (rule 4), so it derives from `logs` on each populate and follows the person selected in `recordingFor`.

### Tests
- `tests/client-state.state.test.js`: returns the most recent climb's grade; ignores exercise, mobility and bounty entries; returns `''` for a person with no climbs; returns `''` for a grade absent from `SCORING.grades`; is unaffected by another person's climbs.
- `tests/client-state.dom.test.js`: populating the Record form for a climber with history preselects their last grade, and a grade already chosen in the open form is not overwritten by a repaint.

### Do not
Add a localStorage key (rule 4); prefill the note, the date, or the bounty select; change `SCORING.grades` or anything in `src/scoring.json` (rule 2); surface copy about how long since the last session, or anything else framed around not logging (tone rule).

---
## 48. Open a crewmate's card from the Crew feed

Status: Done — 2026-07-31
Notes: Commit `Open a crewmate's card from the Crew feed`. `activityMarkup()` now derives
`nm=esc(x.name)` once and a `who` fragment beside the existing `del` fragment, gated on the same
`allowDelete` flag that already distinguishes the two feeds (`true` at the `#personalActivity` call
site, `false` at `#activityList`): the You feed keeps the `<strong>${nm}</strong>` it always
rendered, and the Crew feed emits the leaderboard's button markup **character for character** —
`<button class="climber" type="button" data-person="${nm}" aria-haspopup="dialog" aria-label="Open
${nm}'s details">${nm}</button>` — so the two lists cannot drift apart. No fourth parameter was added;
`allowDelete` already means "this is the owner's own feed" at both call sites. `openPersonCard()`,
`personSummary()` and the card's contents are untouched, and no delete affordance reaches the Crew
rows (entry 29's assertions still pass unchanged).
Deviations: (1) The delegated `closest('[data-person]')` listener was bound to `#leaderRows`, and
clicks inside `#activityList` do not bubble through a sibling `<tbody>`, so the *existing* handler
could never have seen them. Its one `addEventListener` was retargeted from `#leaderRows` to `#crew`,
the section that contains both lists — still exactly one listener and one handler function, which is
what the entry's "no second listener and no new handler function" asks for, but it is a change to an
existing line rather than a pure addition. A static assertion pins the count at one so a second
handler cannot be added later. Nothing else in `#crew` carries `data-person`, so the widened scope is
a no-op for every other click. (2) No `src/styles.css` change was needed: `button.climber` (44px
min-height, `:focus-visible` outline, dotted underline) is already global rather than scoped to the
leaderboard, so adding the class *is* the reuse the entry asks for — writing any rule at all would
have been the second styling it forbids. index.html 149,729 → 149,886 bytes (+157, 93.1% of the
161,000-byte budget).
Tests: 11 assertions in `tests/client-state.dom.test.js` (both Crew rows carry the hook, not just the
newest; the shared climber button and its `aria-haspopup`; the You feed has rows yet carries no hook
and keeps its plain `<strong>` name; the Crew feed still has no delete buttons; the hook value is
parsed back out of the rendered Crew markup and fed straight into `openPersonCard()`, which titles
and opens the dialog) and six in `tests/static-check.mjs`, scoped to `activityMarkup()`'s own line so
that a `data-person=` elsewhere in the script cannot satisfy them, plus the handler-target and
handler-count assertions. Per the harness trap the delegated handler is never simulated. Verified the
new assertions bite, and that each mutation is caught by the assertion **named for it** rather than
by collateral damage: dropping the crew hook fails "a Crew row carries the climber it names as a
per-person hook"; hooking the You feed too fails "the You feed lists your own entries, so its names
get no per-person hook"; rendering a `<span>` instead of the shared button fails "the Crew name
reuses the leaderboard climber button rather than a new control"; putting the listener back on
`#leaderRows` fails "a single delegated handler on the Crew panel covers both the leaderboard and the
feed"; adding a second `#activityList` handler fails "there is exactly one such handler"; and making
`openPersonCard()` bail for the crew row's name fails "the value a Crew row carries opens that
climber card" **first**, with `expected 'Bo', actual ''` — confirming that assertion reaches the code
path it names and is not masked by entry 20's older card assertions. (3) Rule 10 archiving: entry 47
was moved verbatim into `docs/archive/entries-41-onward.md` (the file `IMPROVEMENTS.md` marks
current, 42,988 bytes against the 90,000-byte cap) and its index line dropped; the lifted block was
matched back out of the archive — exactly one occurrence, gone from the log, heading at the start of
its own line — and entry 46 above it confirmed intact and unsplit. `npm test`: 5/5 suites.

### Why
Entry 20 made leaderboard rows open a per-person card, wired through a single delegated `closest('[data-person]')` handler and `openPersonCard()`. The Crew feed names a person on every row and none of them are tappable, so the same gesture works in one list and silently does nothing in the other.

### Requirements
- `src/app.js` — the Crew feed's name element carries `data-person` with the same value the leaderboard rows use, so the **existing** delegated handler opens the card. Add no second listener and no new handler function.
- The name becomes a `type="button"` (or otherwise reaches a 44px target, rule 7) and keeps visible focus via the site's `:focus-visible` (rule 7). Escape the name through `esc()` as the surrounding markup already does.
- Only the Crew feed changes. The You feed lists one person's own entries, where a card of themselves adds nothing.
- `src/styles.css` — reuse the existing tappable-name styling from the leaderboard rather than adding a second one.

### Tests
- `tests/client-state.dom.test.js`: Crew feed rows carry `data-person` matching the entry's climber, and the You feed's rows do not; calling `openPersonCard()` with that value populates `#personTitle`.
- `tests/static-check.mjs`: an assertion that the built script emits `data-person` for the Crew feed rows.
- Note for the implementer: the delegated handler cannot be fired from the DOM harness — the element stub has no `closest()` and its listeners are no-ops (see the TRAP comment in `tests/harness.js`). Assert the emitted attribute and call `openPersonCard()` directly rather than trying to simulate the tap.

### Do not
Add a second delegated listener or duplicate `openPersonCard()`; make You feed rows tappable; add delete affordances to Crew rows (entry 29 made that feed read-only); change `personSummary()` or what the card shows.

---
