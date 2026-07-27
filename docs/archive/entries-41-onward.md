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
