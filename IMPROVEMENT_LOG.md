# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 46 — List the bounties you have claimed — Done — 2026-07-31
- 47 — Start the grade select where you left it — Todo
- 48 — Open a crewmate's card from the Crew feed — Todo

Entries 1–40 shipped and now live under `docs/archive/`, together with five backfilled stubs (B1–B5) for feature commits that shipped without an entry. `IMPROVEMENTS.md` indexes them by title. Entry numbers never restart.

## Rules for implementers (read before every entry)

**Before you start.** Implement the **first** entry whose `Status:` is `Todo`, top to bottom; skip `Done`, `Blocked`, and anyone else's `In progress`. If no entry is `Todo`, stop and report "queue empty — no Todo entries" without inventing, re-doing, or reopening work. Never work from `IMPROVEMENTS.md` or anything under `docs/archive/` — that is closed, shipped history. Read an archived entry only to answer a specific question about how something already shipped, and read the one pass file that holds it rather than all of them. The numbered rules below keep their numbers permanently; entries cite them by number, so never renumber them.

1. **This app is LIVE.** Real crew data lives in a shared Google Sheet and in users' localStorage. Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change (`index.html` stays at the repository root).
2. **Edit only** `src/app.js`, `src/index.template.html`, `src/styles.css`, and test files. **Never** edit `index.html` directly, and **never** touch `src/apps-script.js`, `src/schema.json`, or `src/scoring.json` — those three are the shared browser/backend contract, and any change there forces an API version bump and an organizer redeploy. They are **out of scope for log-driven entries**: they change only in an organizer-coordinated task that bumps the API version, gets its own entry, and ships the redeploy (see B4/B5 in `IMPROVEMENTS.md` for what happens when that pairing is skipped). An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
3. **After editing:** run `npm run build`, then `npm test` (all must pass). Commit the regenerated `index.html` together with your `src/` and test changes. Never weaken or delete an existing test assertion. `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`. `tests/size-check.mjs` caps `index.html` at a byte `BUDGET`: raise `BUDGET` deliberately in a log entry that explains the growth — never as a side effect of another change.
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

Status: Todo

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

Status: Todo

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
