# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim under `docs/archive/`, indexed by `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 41 — Preview the week's bounties — Done — 2026-07-26

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

## Tone rule for entries 24–41

This app runs on a real crew's shared data, and everyone in it sees the same board. **No entry in this pass adds a nudge, a reminder, or a prompt to participate.** Concretely:

- **Surface what people did, never what they didn't.** No absence counts, no laggard lists, no "you haven't logged" copy, no per-person zero-week callout, no streak-loss warnings, no "still time to log today" prompts.
- **Aggregating does not launder it.** A crew-wide participation figure is the same nudge with the names filed off, and is equally out of scope. An earlier draft of this queue proposed one; it was dropped rather than reworded, which is why the numbering skips 39.
- **Nothing new opens, appears, or speaks on its own.** Every surface these entries add is reached by a tap, and the one persistent element (entry 28's undo bar) carries its own dismissal and clears when the user moves on.
- New information is reported **only where the user went looking for it** — their own card, their own feed, the diagnostics they opened.

Each entry restates the part of this that binds it in its own `### Do not`. This block is a shared statement of intent, not a numbered rule, and it renumbers nothing.

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
