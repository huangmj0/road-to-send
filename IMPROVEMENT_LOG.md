# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 48 — Open a crewmate's card from the Crew feed — Done — 2026-07-31

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
