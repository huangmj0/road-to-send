# Road to Send improvement log

Frontend-only enhancement queue for the live app. Implementers (subagents) work entries **top to bottom, one entry per commit**, and update the entry's `Status:`/`Notes:` lines in the same commit as the implementation. This file holds **live work only** — shipped entries are archived verbatim in `IMPROVEMENTS.md`, which is the audit trail and never a queue.

Status values: `Todo` · `In progress — YYYY-MM-DD` · `Done — YYYY-MM-DD` · `Blocked — reason`.

## Queue index

- 22 — Share my progress: one clipboard helper, and stop a denied copy failing setup — Done — 2026-07-26
- 24 — Re-baseline the bundle budget for this queue — Todo
- 25 — Score the live log once per render — Todo
- 26 — Delete the entry you confirmed — Todo
- 27 — One guarded localStorage write — Todo
- 28 — Undo a local delete — Todo
- 29 — Keep the Crew feed read-only — Todo
- 30 — One row-markup helper for the repeated cards — Todo
- 31 — Say something when the export fails — Todo
- 32 — Show the save in the credit preview — Todo
- 33 — Tap a category chip to start recording it — Todo
- 34 — Show the note you wrote on a bounty — Todo
- 35 — Say which day the app thinks it is — Todo
- 36 — Caption the heatmap and the trend chart — Todo
- 37 — Focus the dialog you just opened — Todo
- 38 — Show more of the feed — Todo
- 40 — Share through the system share sheet — Todo
- 41 — Preview the week's bounties — Todo

Entries 1–14 shipped and now live in `IMPROVEMENTS.md` under "v11 pass — frontend enhancement queue (entries 1–14)", together with five backfilled stubs (B1–B5) for feature commits that shipped without an entry. Entry numbers never restart.

## Rules for implementers (read before every entry)

**Before you start.** Implement the **first** entry whose `Status:` is `Todo`, top to bottom; skip `Done`, `Blocked`, and anyone else's `In progress`. If no entry is `Todo`, stop and report "queue empty — no Todo entries" without inventing, re-doing, or reopening work. Never work from `IMPROVEMENTS.md` — it is closed, shipped history. The numbered rules below keep their numbers permanently; entries cite them by number, so never renumber them.

1. **This app is LIVE.** Real crew data lives in a shared Google Sheet and in users' localStorage. Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change (`index.html` stays at the repository root).
2. **Edit only** `src/app.js`, `src/index.template.html`, `src/styles.css`, and test files. **Never** edit `index.html` directly, and **never** touch `src/apps-script.js`, `src/schema.json`, or `src/scoring.json` — those three are the shared browser/backend contract, and any change there forces an API version bump and an organizer redeploy. They are **out of scope for log-driven entries**: they change only in an organizer-coordinated task that bumps the API version, gets its own entry, and ships the redeploy (see B4/B5 in `IMPROVEMENTS.md` for what happens when that pairing is skipped). An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
3. **After editing:** run `npm run build`, then `npm test` (all must pass). Commit the regenerated `index.html` together with your `src/` and test changes. Never weaken or delete an existing test assertion. `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`. `tests/size-check.mjs` caps `index.html` at a byte `BUDGET`: raise `BUDGET` deliberately in a log entry that explains the growth — never as a side effect of another change.
4. **localStorage keys are frozen:** `roadToSendEndpoint`, `roadToSendMe`, `roadToSendLogsV9`, `roadToSendConfigV9`, `roadToSendConfigV8` (read-only migration source — only the existing one-time migration writes `roadToSendConfigV9` from it), `roadToSendWeekReview`, and `roadToSendShared:{activities|config|meta}:{endpoint}`. Read them; never rename them; only write shapes existing code already reads. Do not add new localStorage keys unless an entry explicitly says so (none currently do). `tests/docs-check.mjs` asserts every `roadToSend…` literal in `src/app.js` appears in this list, so a new key means updating this rule in the same commit.
5. **Structural constraints enforced by tests:** exactly **one `<script>` block** in the template (all JS goes in `src/app.js`); exactly **one `<table>`** in the page (new visualizations use divs/CSS grid); the built lines `const SCRIPT=\`…\`;` and the `const SUPPORTED_API_VERSIONS` line immediately after it are untouchable (no backticks may enter the Apps Script string); DOM ids stay unique; every labeled input keeps its `<label for>`.
6. **Reuse the scoring core:** `computeCredits()`, `totalsModel()`, `paceInfo()`, `weekKey()`, `fmtDay()`, `parseDateOnly()`, and `challengeToday()`. Never call `new Date()` for challenge-date logic — shared mode follows the Sheet's timezone via `challengeToday()`. Never fork or re-derive scoring math; consume the maps `computeCredits()` returns. New display logic = small pure helper functions called from `render()`; `render()` runs often, so keep additions idempotent and cheap.
7. **Accessibility:** minimum 44px touch targets; graphics get `role="img"` with a meaningful `aria-label` text alternative (decorative inner elements `aria-hidden="true"`); dynamic status text uses `aria-live="polite"`; keep visible focus (site uses `:focus-visible`). **Motion:** CSS-only transitions/animations so the existing `@media(prefers-reduced-motion:reduce)` kill-switch applies; no JS-driven animation.
8. **No external dependencies (runtime or dev), no new network requests, no frameworks, no build-tool changes.** Match the existing compact single-line code style of `app.js`/`styles.css`. An entry may carve itself out of these limits in its own `### Requirements`; absent an explicit carve-out they are hard limits and rule 10 applies.
9. **Tests per entry:** behavioral coverage for new helpers goes in `tests/client-state.test.js` (it evals the built script — new top-level helper functions are directly reachable there); DOM/a11y presence assertions go in `tests/static-check.mjs`. Copy must not trip the banned-strings assertion in `static-check.mjs` (no "Hard mode", "Super hard mode", "pull-up mode", "Record send pyramid", "Balanced week bonus").
10. **Bookkeeping:** set `Status: In progress — date` when starting; on completion set `Status: Done — date` and put the commit subject plus any deviations in `Notes:`, and update the queue index above. If an entry cannot be completed inside these rules, set `Status: Blocked — reason` and move on — do not bend the rules. **Archiving:** a finished entry stays here only until the next iteration — before you start yours, move any entry already marked `Done` (heading through its `---` separator, **verbatim**) to the v11 archive in `IMPROVEMENTS.md` and drop its index line. This file therefore carries at most one `Done` entry, the one completed in the current commit, and `tests/docs-check.mjs` enforces that.

---

## 22. Share my progress: one clipboard helper, and stop a denied copy failing setup

Status: Done — 2026-07-26
Notes: Commit `Share your progress through one clipboard helper`. `copyText(text, okMessage)` is
the only place the clipboard is written: it guards on a missing `navigator`/`clipboard`/`writeText`,
`await`s the write inside a `try`, toasts `okMessage` and returns `true`, and on any rejection
toasts `Copy failed — copy it manually.` and returns `false` — it never throws. `copyCrewLink()`,
`copyScript()` and the `#diagnosticCode` handler all route through it, and `copyCrewLink()` returns
the boolean. `saveSetup()` keeps the save and `loadRemote()` inside its `try` and now reads
`const copied = await copyCrewLink()`, toasting `Shared setup saved. Crew link copied.` or
`Shared setup saved. Copy the crew link from setup.`; `#setupErrors` stays hidden either way.
`publicUrl()` returns `location.href` with the hash cleared and the `sheet` param deleted;
`copyCrewLink()` builds on it and re-adds `sheet` deliberately. `shareSummary(nameLower, today =
challengeToday())` composes only `totalsModel().sorted` (name, total, rank), `challengeProgress()`,
`categoryBreakdown()`, `streakInfo()`, `personalRecords().hardest` and `publicUrl()`; a person with
no credited points gets the two-line "Just getting started" variant and a blank or unknown name
returns `''`. `#shareBtn` sits in the You panel's `.page-head` inside a new `.head-actions` wrapper
next to `#changeMeBtn`, is wired in `init()` to `copyText(shareSummary(…), 'Progress copied — paste
it anywhere.')`, and `render()` both hides and disables it when no profile is selected. index.html
133,957 → 135,867 bytes (87.1% of the 156,000-byte budget, inside the ~3,000 this entry was
projected to cost); `BUDGET` untouched. Deviations: (1) `copyText` cannot write
`navigator?.clipboard?.writeText` as the guard — `navigator` is undeclared in the test harnesses and
optional chaining still throws `ReferenceError` on an undeclared identifier, so the guard reads
`typeof navigator === 'undefined' ? null : navigator` and the single literal
`navigator.clipboard.writeText` the architectural guard counts lives on the `await` line. (2) The
Share button is both hidden (`hide`) and `disabled` rather than one or the other; the entry allows
either and doing both keeps the stub-harness assertion honest for each. (3) `.head-actions` is one
new wrapper `div` so the two head buttons group at the right of the `space-between` `.page-head`
instead of being spread apart; the CSS is the spacing rule the entry allows plus `min-height:44px`
on both buttons. (4) Two extra `static-check.mjs` assertions (`function copyText(`,
`function publicUrl(`) accompany the required ones; nothing existing was retargeted. (5) Rule 10
archiving: entry 21 was moved verbatim into `IMPROVEMENTS.md` after the archived entry 20 and its
index line dropped; the lifted block was string-matched back out of the archive (exactly one
occurrence, gone from the log) and entry 20 was confirmed intact and unsplit.

### Why
There is no way to share or brag about progress — `exportData()` only downloads raw JSON — and there are three hand-rolled `navigator.clipboard.writeText` call sites with **no shared helper and no `try`/`catch`**: `copyCrewLink()`, `copyScript()`, and the inline `#diagnosticCode` handler. That missing catch is a real bug: `saveSetup()` `await`s `copyCrewLink()` **inside its `try`**, so a rejected clipboard write (insecure context, denied permission) lands in the `catch` and paints `#setupErrors` as though setup itself had failed — even though the config was saved to the Sheet and the endpoint persisted.

### Requirements
- `src/app.js` — new `async function copyText(text, okMessage)`: returns `false` and toasts `Copy failed — copy it manually.` when `navigator?.clipboard?.writeText` is missing or rejects; otherwise toasts `okMessage` and returns `true`. **It never throws.** Rewire all three call sites — `copyCrewLink()`, `copyScript()` and the `#diagnosticCode` handler in `init()` — through it, and have `copyCrewLink()` return `copyText`'s boolean.
- Fix `saveSetup()`: keep the save and `loadRemote` work inside the `try`, and let the success toast reflect the copy result — `Shared setup saved. Crew link copied.` when `copyCrewLink()` returns true, `Shared setup saved. Copy the crew link from setup.` when it does not. `#setupErrors` must stay hidden in both cases.
- New pure helper `publicUrl()` → `location.href` with the hash cleared and the `sheet` query param **removed**, so shared text never leaks the crew's Apps Script endpoint. `copyCrewLink()` keeps its own behaviour — it intentionally *includes* `sheet` — so factor out only the URL construction, not the semantics.
- New pure helper `shareSummary(nameLower, today = challengeToday())` → a short multi-line string composed from existing helpers only: name, `challengeProgress()` (entry 18) for the `Day N of M` line, total and rank from `totalsModel().sorted`, the `categoryBreakdown()` rows as icon/number pairs, `streakInfo()` for the streak, `personalRecords().hardest` when graded, and `publicUrl()` on the last line. A person with no credited points gets a short "just getting started" variant; a blank or unknown `me` returns `''`. No new scoring math, no `new Date()`.
- `src/index.template.html` — `<button id="shareBtn" class="text-btn" type="button">Share</button>` in the You panel's existing `.page-head`, next to `#changeMeBtn`. That is **above** every You-panel anchor (`today-card`, `#bountyCapHint`, `#todayBounties`, `#personalActivity`, `.stat-grid`), so no existing order assertion is affected. Wire it in `init()` to `copyText(shareSummary(String(me).toLowerCase()), 'Progress copied — paste it anywhere.')`, and hide or disable it when no profile is selected.
- `src/styles.css` — no new rules if `.text-btn` suffices; add only spacing for the two-button `.page-head` group, keeping both at least 44px.

### Tests
- `tests/client-state.test.js` harness-1 `checks` literal (no backticks, no `${`; emoji are fine): `shareSummary` on a crafted roster contains the person's name, `Day ` plus the day number, the total, the rank and the streak, and does **not** contain `sheet=` or the endpoint host — that is the privacy assertion. A person with no logs yields the short variant; a blank name yields `''`. `publicUrl()` strips both the hash and the `sheet` param.
- `tests/client-state.test.js` — a **new** async `test(...)` case modelled on the existing `test('background sync respects the open date picker…')` harness, whose context is the only one already carrying `Promise`, `fetch` and its own `makeElement()` map. Give it `navigator:{clipboard:{writeText:()=>Promise.reject(Error('denied'))}}` plus a `fetch` stub that accepts `saveConfig`, populate the setup fields, `await saveSetup()`, then assert `endpoint` is set, `#setupErrors` still has the `hide` class, and the toast reports a saved setup with an uncopied link. That is the regression lock for the false-failure bug. Add a second case with a resolving `writeText` asserting `copyText` returns `true` and toasts `okMessage`. Adding a `navigator` stub to a context object is additive, not a weakened assertion.
- `tests/static-check.mjs` — **add**: `#shareBtn` exists inside `data-panel="you"` with `type="button"`; a new order assertion `data-panel="you"` → `id="shareBtn"` → `today-card`; and an architectural guard, `assert.equal((script.match(/navigator\.clipboard\.writeText/g)||[]).length, 1, 'clipboard writes funnel through one helper')`.

### Do not
Use `navigator.share` — a permission-gated async path that still needs the clipboard fallback and is not observable in the stub harness, so propose it separately; include the `sheet` param, the endpoint, or any other person's data in the shared text; make `copyText` throw or re-throw; change `exportData()`'s JSON shape or the `action:'saveConfig'` request body; add a network request, a dependency, or a localStorage key.

---

## Tone rule for entries 24–41

This app runs on a real crew's shared data, and everyone in it sees the same board. **No entry in this pass adds a nudge, a reminder, or a prompt to participate.** Concretely:

- **Surface what people did, never what they didn't.** No absence counts, no laggard lists, no "you haven't logged" copy, no per-person zero-week callout, no streak-loss warnings, no "still time to log today" prompts.
- **Aggregating does not launder it.** A crew-wide participation figure is the same nudge with the names filed off, and is equally out of scope. An earlier draft of this queue proposed one; it was dropped rather than reworded, which is why the numbering skips 39.
- **Nothing new opens, appears, or speaks on its own.** Every surface these entries add is reached by a tap, and the one persistent element (entry 28's undo bar) carries its own dismissal and clears when the user moves on.
- New information is reported **only where the user went looking for it** — their own card, their own feed, the diagnostics they opened.

Each entry restates the part of this that binds it in its own `### Do not`. This block is a shared statement of intent, not a numbered rule, and it renumbers nothing.

---

## 24. Re-baseline the bundle budget for this queue

Status: Todo

### Why
`tests/size-check.mjs` caps `index.html` at `BUDGET = 156000`, a figure entry 23 derived from a projection that has since been measured and missed: it expected entries 19–22 to add ~18,000 bytes and land near 143,500, but they added 10,447 and landed at 135,867 (87.1%). The comment at `tests/size-check.mjs:8-13` therefore carries a standing instruction — "If the queue lands under that, lower `BUDGET` back toward the real figure: a cap that only ratchets upward stops being a guard" — and rule 3 says the number moves only in an entry that explains it. Entries 25–41 below project ~+12,600 bytes (landing near 148,500), so the honest move is neither to leave stale arithmetic in place nor to ratchet silently, but to restate the cap against a measured start and a written projection.

### Requirements
- `tests/size-check.mjs` — set `BUDGET = 161000` and rewrite the comment block to record the measured start (135,867 bytes after entry 22), this queue's projection (~+12,600 for entries 25–41, landing near 148,500) and the ~12,500 cushion that leaves, in the same arithmetic style entry 23 used.
- Keep the always-printed size/percent line and the failure message exactly as they are. This entry moves the constant and its explanation, nothing else (rule 3).
- Keep the standing instruction alive in the comment: if this queue again lands well under its projection, the next budget entry lowers `BUDGET` toward the real figure.
- Touch no file under `src/`, so `index.html` does not change — `npm run build` is a no-op here, but still run it and `npm test` (rule 3).

### Tests
- `tests/size-check.mjs` is itself the test: `npm test` must report the new percentage against 161,000 with `index.html` unchanged at 135,867 bytes.

### Do not
Raise the cap without writing the arithmetic into the comment; touch any file under `src/`; weaken or delete the budget assertion or its size/percent line; treat this entry as licence for later entries to grow unmeasured — each still reports its own byte delta in `Notes:` (rule 10).

---

## 25. Score the live log once per render

Status: Todo

### Why
`computeCredits(entries,settings=config)` is a full scan-and-sort of the whole activity log, and one `render()` runs it about a dozen times — `totalsModel()`, `activityMarkup()` twice, `todayProgress()`, `categoryBreakdown()`, `personalRecords()`, `heatmapDays()`, `streakInfo()`, `weeklyTrend()`, `bountyWeekProgress()`, `earnedThrough()` and `updateRecordPreview()` — **plus one more per leaderboard row**, because `weekTrend()` calls it inside `leaders.map(...)`. A six-person crew therefore scores the same log about nineteen times to paint one screen, and the cost grows with both crew size and challenge length. The blocker for a cache is that `logs` is mutated in place in two spots — `logs.push(draft)` in `submitActivity()` and `logs.splice(index,1)` in `performDelete()` — so a reference-keyed memo would serve stale results.

### Requirements
- `src/app.js` — rename the existing function body to `computeCreditsRaw(entries,settings)` **without changing a character of its logic**, and add a wrapper keeping the exact name, arity and `settings=config` default. The wrapper consults the memo only when `entries===logs&&settings===config`; every other call goes straight to `computeCreditsRaw` and neither reads nor writes the cache, which is what stops `updateRecordPreview()`'s `[...logs,draft]` and `earnedThrough()`'s filtered copy from poisoning it.
- Module-level `creditMemo` of shape `{ref,len,value}`, plus a module-level `creditRuns` counter incremented on every raw scan (the test hook). `len` catches an in-place mutation that keeps the same reference.
- Replace both in-place mutations so the reference is load-bearing: `logs=logs.concat([draft])` in `submitActivity()`, `logs=logs.filter(...)` in `performDelete()`'s local branch. Every other write already reassigns `logs`.
- The returned `Map`s are now shared by every caller within a render (`totalsModel()` shallow-copies with `Object.assign`), so treat them as read-only.
- `computeCredits()`'s return shape is locked by `deepEqual` assertions (rule 6) and must not change.

### Tests
- `tests/client-state.test.js` harness-1 `checks` (no backticks, no `${`; build strings with `+`): an invalidation matrix in which a stale answer would give a **different number** — reassignment, an in-place `push`, an in-place `splice`, and a replaced `config` each yield the freshly correct `totals` value.
- `tests/client-state.test.js` harness-2 `domChecks`: read `creditRuns` before and after `render()` and pin the delta to an exact number; assert `computeCredits(logs)` returns the identical object before and after `updateRecordPreview()`, proving the preview array neither evicts nor replaces the live memo.
- `tests/static-check.mjs` — **add** `assert.match(script,/function computeCreditsRaw\(/)` and a structural guard `assert.doesNotMatch(script,/\blogs\.(push|splice|unshift|shift|pop|sort|reverse|fill|copyWithin)\(/,'logs is replaced, never mutated in place')`, so a later entry cannot silently reintroduce staleness.

### Do not
Change what `computeCredits()` returns or the order in which it applies caps and bonuses; memoize calls that pass a derived array or explicit settings; call `.set()` or `.delete()` on a returned `Map`; delete harness-1's existing in-place `logs.push` line (it is precisely the case the `len` guard exists for); memoize any other helper in this entry.

---

## 26. Delete the entry you confirmed

Status: Todo

### Why
`requestDelete(index,id,feed)` stores `pendingDelete={index,id,feed,position}`, and `performDelete()` acts on that index — but nothing clears `pendingDelete` when the dialog goes away by any route other than confirmation. The `#confirmCancel` path, the × button and the Escape handler all leave it set, and `askConfirm()` has been shared with `disconnect()` since entry 19, so a cancelled delete can sit in module state across an unrelated confirm. The local branch also removes by position rather than by identity, which is only correct for as long as nothing else reorders `logs`.

### Requirements
- `src/app.js` — carry the captured row on `pendingDelete` (`{entry,index,id,feed,position}`) so the confirm acts on the object it described rather than a position that may no longer mean the same thing.
- `performDelete()`'s local branch removes by identity: `logs=logs.filter(x=>x!==entry)` (entry 25 has already replaced the `splice`). The shared branch keeps deleting by `id`.
- Clear `pendingDelete` whenever the confirm dialog closes without deleting — the cancel button, the × and the Escape handler — so no cancelled intent survives into the next `askConfirm()` call.
- If the captured row is no longer in `logs` when the confirm fires, close the dialog and do nothing else; never fall back to deleting by index.

### Tests
- `tests/client-state.test.js` harness-2 `domChecks`: `requestDelete()` then cancel leaves `logs` unchanged **and** a following `performDelete()` is a no-op; `requestDelete()` on the middle of three rows then `performDelete()` removes exactly that row, leaving the other two in order.
- `tests/static-check.mjs` — **add** `assert.ok((script.match(/pendingDelete=null/g)||[]).length>=2,'a dismissed confirm clears the pending delete')`.

### Do not
Change the shared-mode delete request body or its `action:'delete'` id semantics; reintroduce an in-place `splice` (entry 25's static guard forbids it); alter `restoreFeedFocus()` or the focus-position logic entry 19 shipped; add a second confirm dialog.

---

## 27. One guarded localStorage write

Status: Todo

### Why
`safeJson()` wraps every read in a `try`, but every write is bare: `persistLocal()`, `persistShared()`, `saveIdentity()`, `maybeShowWeekReview()` and `saveSetup()` all call `localStorage.setItem` unguarded. In Safari private mode and on quota exhaustion those throw, and two paths then fail badly. In local mode `submitActivity()` appends to `logs` and calls `persistLocal()` inside its `try`, so a throw is caught and toasted as `Save failed` — but the entry is already in the in-memory `logs` and `render()` was skipped, so it appears on the next repaint having never been persisted. And `saveIdentity()` has no `try` at all, so a throw escapes the click handler and `closeModal`/`render` never run, leaving the identity dialog stuck open. This is the shape of bug entry 22 fixed for the clipboard: an unguarded side effect reported as a failure of the thing around it.

### Requirements
- `src/app.js` — new `function writeStore(key,value)` returning `true` on success and `false` when storage is missing or `setItem` throws. It never throws. Guard the global the way `copyText()` does (`typeof localStorage === 'undefined' ? null : localStorage`); optional chaining still throws `ReferenceError` on an undeclared identifier in the harnesses (entry 22, deviation 1).
- Route **every** `localStorage.setItem` call through it: `persistLocal()`, `persistShared()`, `saveIdentity()`, `maybeShowWeekReview()`, `saveSetup()`.
- Keep `submitActivity()`'s local branch honest: if `persistLocal()` reports a failed write, still `render()` and toast `Saved on this device only — storage is full.` rather than `Save failed`, because the entry is in `logs` either way.
- `saveIdentity()` closes its dialog and repaints regardless of the write result.
- No new localStorage key, and no change to any existing key or stored value shape (rule 4).

### Tests
- `tests/client-state.test.js` — a **new** async `test(...)` modelled on the existing clipboard cases, with a `localStorage` stub whose `setItem` throws: `saveIdentity()` still closes `#identityModal` (its `classList` no longer contains `open`) and sets `me`; a local-mode `submitActivity()` leaves the new row in `logs` and toasts the storage message rather than `Save failed`.
- `tests/client-state.test.js` harness-1: `writeStore()` returns `false` without throwing when `setItem` throws, and `true` on a normal write.
- `tests/static-check.mjs` — **add** `assert.match(script,/function writeStore\(/)` and an architectural guard `assert.equal((script.match(/localStorage\.setItem/g)||[]).length,1,'storage writes funnel through one helper')`.

### Do not
Add a localStorage key, change a stored value's shape, or migrate anything (rule 4); make `writeStore` throw or re-throw; collapse a genuine network `Save failed` into the storage message; change `safeJson()`'s read behaviour or its fallbacks.

---

## 28. Undo a local delete

Status: Todo

### Why
Entry 19 shipped the confirm dialog and deferred undo in as many words — "undo deserves its own entry (local-mode only, a real button, not the toast)" — because `#toast` is `pointer-events:none` and cannot carry a control, and because re-POSTing a deleted row in shared mode would mint a new `id`/`createdAt` against the live Sheet. In local mode neither constraint applies: the row is a plain object and putting it back is an array rebuild.

### Requirements
- `src/index.template.html` — `<div id="undoBar" class="undo-bar hide" role="status" aria-live="polite"><span id="undoText"></span><button id="undoDelete" class="text-btn" type="button">Undo</button><button id="undoDismiss" class="icon-btn" type="button" aria-label="Dismiss">×</button></div>` immediately **before** `#toast`, outside every `[data-panel]` — deletes fire from both feeds, and this position collides with no existing order assertion.
- `src/app.js` — module-level `lastDeleted` holding `{entry,index,label}`, set **only** in `performDelete()`'s local branch. Named top-level `undoDelete()` restores the row at its original index (`logs=logs.slice(0,i).concat([entry],logs.slice(i))`), persists, repaints and toasts `Entry restored.`; named top-level `renderUndo()` shows the bar only when `lastDeleted` is set and `endpoint` is falsy, called from the tail of `render()` and cheap enough to run every time (rule 6).
- **No timer.** `setTimeout` is a no-op in the harnesses, so a timed dismissal would be untestable and permanently sticky in tests. The bar clears on: undo, dismiss, the next delete, a successful `submitActivity()`, `performDisconnect()`, an endpoint appearing, and `showTab()` — switching tabs puts it away, so it never outlives the action it describes.
- `src/styles.css` — `.undo-bar` sits at the toast's slot above `.bottom-nav`, and `.undo-bar:not(.hide)~.toast{bottom:160px}` lifts the toast while the bar is up so the two never overlap. CSS only, so the existing `prefers-reduced-motion` kill-switch applies (rule 7); both buttons keep `min-height:44px`.
- Shared mode never offers undo: `renderUndo()` force-hides whenever `endpoint` is truthy.

### Tests
- `tests/client-state.test.js` harness-2 `domChecks` (`performDelete()`'s local branch contains no `await`, so its effects land synchronously — the same reason entry 19's harness could call it): delete the middle of three rows and assert `#undoBar` is visible with `#undoText` starting `Deleted `; `undoDelete()` restores the length **and** puts the row back at its original index; the bar hides again; setting `endpoint` and calling `renderUndo()` hides it.
- `tests/static-check.mjs` — **add**: `#undoBar` with `role="status"` and `aria-live="polite"`; `#undoDelete` and `#undoDismiss` as `type="button"`; an order assertion `id="undoBar"` → `id="toast"`; `assert.match(script,/function undoDelete\(/)`; and the exact compact CSS text `.undo-bar:not(.hide)~.toast{bottom:160px}`.

### Do not
Offer undo in shared mode, re-POST a deleted row, or touch the `action:'delete'` request (rule 2 places the Apps Script out of scope); put the control in `#toast`; use `setTimeout` for dismissal; add a localStorage key so undo survives a reload (rule 4); leave the bar on screen after the user has moved on.

---

## 29. Keep the Crew feed read-only

Status: Todo

### Why
`render()` paints the crew feed with `activityMarkup(logs,20,true)` — the same `allowDelete` flag the You feed uses — and `#activityList`'s click handler calls `requestDelete(...,'crew')` with no ownership check. Every crew member therefore sees a × on every other member's entry and can remove it in two taps against live shared data. Entry 19 added delete deliberately and its `### Do not` fenced "delete buttons for other people's entries", but only the You feed was in its scope, so the crew feed has been offering them ever since. The backend permits the write — anyone with the crew link may delete — which is exactly why the interface should not invite it.

### Requirements
- `src/app.js` — the crew feed renders without delete controls: `activityMarkup(logs,20,false)` for `#activityList`. `#personalActivity` keeps its delete buttons unchanged, so deleting your own entry is unaffected.
- Remove the now-dead `#activityList` delete listener rather than leaving a handler that can act on a row the user has no control for; record which you did in `Notes:`.
- `feedSelector()`, `restoreFeedFocus()` and `nextFocusIndex()` keep working for the `'personal'` feed; do not change their signatures.

### Tests
- `tests/client-state.test.js` harness-2 `domChecks`: after `render()`, `#activityList`'s `innerHTML` contains no `data-del=` while `#personalActivity`'s still does.
- `tests/static-check.mjs` — **add** `assert.match(script,/#activityList'\)\.innerHTML=activityMarkup\([^)]*,false\)/,'the crew feed is read-only')`. Match the `false` argument, not the limit — entry 38 replaces that number with a variable and must not have to retarget this assertion.

### Do not
Remove delete from the You feed; add an ownership check to `requestDelete()` instead of removing the affordance (the backend still permits the write — this entry is about not inviting it); change the shared delete request; weaken entry 19's focus-restoration assertions.

---

## 30. One row-markup helper for the repeated cards

Status: Todo

### Why
The breakdown, records and pyramid rows are written twice: once in `renderBreakdown()`, `renderRecords()` and `renderPyramid()` for the You panel, and again in `renderPersonCard()` for `#personModal`. The two copies have drifted, and the drift is an accessibility one — the person-card bars carry `role="img"` with a per-row `aria-label`, while the You-panel bars are bare `aria-hidden="true"` decoration. The same information is announced inside the modal and silent on the main tab, and roughly 1,350 characters of near-duplicate template are kept in sync by hand.

### Requirements
- `src/app.js` — three small pure helpers returning markup strings, shared by both call sites: a labelled proportional bar row (breakdown), a records row, and a pyramid row. Take plain values rather than model objects so neither renderer has to reshape its data.
- Adopt the **person-card** version as the shared one: every bar gets `role="img"` with a meaningful `aria-label` and decorative inner elements stay `aria-hidden="true"` (rule 7). This upgrades the You panel and must not downgrade the modal.
- `renderBreakdown()`, `renderRecords()`, `renderPyramid()` and `renderPersonCard()` all render through the helpers, with no change to what any of them computes or to any container id.
- Keep the compact single-line style of the surrounding code (rule 8).

### Tests
- `tests/client-state.test.js` harness-2 `domChecks`: `#youBreakdown` and `#personBreakdown` contain the same row markup for the same data, and the You-panel rows now carry `role="img"` in their `innerHTML`.
- `tests/static-check.mjs` — **add** a presence assertion for each new helper, and keep every existing `role="img"[^>]*aria-label=` assertion passing.

### Do not
Change what `categoryBreakdown()`, `personalRecords()` or `gradePyramid()` return; rename or remove `#youBreakdown`, `#recordsList`, `#gradePyramid`, `#personBreakdown`, `#personRecords` or `#personPyramid`; drop the modal's existing labels to make the two shapes match; introduce a templating abstraction beyond three string-returning functions.

---

## 31. Say something when the export fails

Status: Todo

### Why
`exportData()` builds a `Blob`, calls `URL.createObjectURL`, clicks a synthetic anchor and revokes the URL, with no `try` anywhere and no toast on either outcome. `Blob` construction and `createObjectURL` both throw in restricted contexts and a synthetic `.click()` is a no-op in others, so the one documented recovery path in the app (P2, data ownership) can fail in total silence — leaving the user to conclude their data is gone rather than that the download was blocked.

### Requirements
- `src/app.js` — wrap `exportData()`'s body in a `try`/`catch`. Toast `Export downloaded.` on success and `Export failed — try a different browser.` on any throw. It never throws.
- Keep the exported JSON byte-identical: the same `{version, exportedAt, mode, config, activities}` keys in the same order with the same `null,2` formatting. Other tooling reads this file.
- Revoke the object URL on both paths.

### Tests
- `tests/client-state.test.js` — a **new** async `test(...)` whose context adds a `Blob` stub and an element factory whose `click()` throws (neither `Blob` nor `click` exists in any current harness, so both are additive, not a weakened assertion): `exportData()` does not throw and `#toast` reports the failure; with working stubs it reports the success message.
- `tests/static-check.mjs` — **add** `assert.match(script,/Export downloaded\./)`.

### Do not
Change the export's JSON shape, key order or filename; add a network upload or a second export format; make `exportData()` throw; add a dependency for file saving (rule 8).

---

## 32. Show the save in the credit preview

Status: Todo

### Why
`creditPreviewCopy(opts)` already accepts a documented `saving` flag and never branches on it — entry 21 shipped the parameter and recorded the gap as its deviation 2, because inventing the copy was outside that entry's scope. Nothing repaints `#creditPreview` during a save either: `submitActivity()` sets `saving=true` and updates only `#saveActivityBtn`'s label, while `updateRecordPreview()` runs in the `finally`. So the preview line goes on asserting what the entry *will* score for the whole time the request is in flight.

### Requirements
- `src/app.js` — add a `saving` branch **first** in `creditPreviewCopy()`'s ladder, returning `Saving…`. All six existing harness assertions call it without `saving`, so their results are unchanged.
- Call `updateRecordPreview()` immediately after `saving=true` in `submitActivity()` so the branch is reachable, and let the existing `finally` restore the normal copy.
- `updateRecordPreview()` passes the module-level `saving` through in its opts object.
- No change to `#creditPreview`'s element or its live-region behaviour, and none to the `#recordMeter` beside it.

### Tests
- `tests/client-state.test.js` harness-1: `creditPreviewCopy({saving:true, …})` returns the saving copy whatever the other options say, and every existing assertion in that block still returns its current string.
- `tests/static-check.mjs` — **add** `assert.ok((script.match(/Saving…/g)||[]).length>=2,'the preview reports an in-flight save')`; the string already exists once for the button label, so assert a count rather than presence.

### Do not
Change any other branch of `creditPreviewCopy()` or its option names; add a second `aria-live` region to the Record tab; alter the `saving` double-submit guard entry 21 shipped; change `#saveActivityBtn`'s label text.

---

## 33. Tap a category chip to start recording it

Status: Todo

### Why
Entry 17 shipped `#todayCategories` as status chips and explicitly left interaction for later — "a tap-to-preselect path duplicates entry 14's claim flow and the card's own Record CTA, so leave it for a later entry". Entry 14 has since shipped exactly that flow for bounties, where `claimBounty(id)` jumps to Record pre-filled, so the pattern now exists. The chips are the one place in the today-card that shows a missing category without offering the action that fixes it.

### Requirements
- `src/index.template.html` / `src/app.js` — each chip becomes a real `<button class="cat-chip …" type="button">` nested **inside** its existing `role="listitem"` wrapper. The chip cannot itself be the list item (a `role="listitem"` on a button destroys the button semantics) and the container keeps `role="list"`, which `static-check.mjs` asserts.
- Named top-level `prefillCategory(type)` mirroring `claimBounty()`: select the matching activity-type radio, reset the date fields the way `claimBounty()` does, `showTab('record')`, and repaint the preview. No new module state.
- Already-logged chips stay tappable. Logging a category twice is legal and simply scores 0, so the affordance must not imply an error.
- `src/styles.css` — chips keep `min-height:44px` (rule 7) and gain only the focus/press styling `.text-btn` does not already provide.
- Harness-2's three chip assertions count occurrences of `cat-chip` and `cat-chip done` rather than matching exact markup, so nesting a button inside the wrapper keeps every count intact. Say so in `Notes:` so a later pass does not "fix" them.

### Tests
- `tests/client-state.test.js` harness-2 `domChecks`: `prefillCategory('exercise')` selects the exercise radio and leaves the Record panel active; the existing chip counts still hold.
- `tests/static-check.mjs` — **add** `assert.match(script,/<button class="cat-chip/)` and `assert.match(script,/function prefillCategory\(/)`, keeping the `role="list"` assertion passing.

### Do not
Remove `role="list"` or put `role="listitem"` on the button; change what `todayProgress()` returns or add bounty rows to it (entry 14's card owns those); copy `claimBounty()`'s body instead of mirroring its steps; add a fourth chip state or new copy to `#todayRemaining`.

---

## 34. Show the note you wrote on a bounty

Status: Todo

### Why
`#noteFields` is visible for bounty entries, `draftActivity()` sets `base.note` for them and `submitActivity()` POSTs it, so the note round-trips to the Sheet and back. But `activityMarkup()`'s bounty branch renders `🎯 <title>` and nothing else — notes are only rendered for exercise and mobility. Whatever a crew member writes on a bounty claim is stored and shown to no one.

### Requirements
- `src/app.js` — the bounty branch of `activityMarkup()`'s `detail` appends ` · ` plus the escaped note when one is present, matching the exercise/mobility branch exactly. Climb entries keep showing the grade in that slot.
- Keep `esc()` around the note: it is user-entered text arriving from a shared Sheet.
- No change to the feed row structure, the delete-button markup, or the 120-character `maxlength` on `#activityNote`.

### Tests
- `tests/client-state.test.js` harness-2 `domChecks`: a bounty entry carrying a note renders that text in `#personalActivity`; a bounty without one renders exactly as it does today.
- `tests/static-check.mjs` — no new assertion needed; the existing parse and markup checks cover it.

### Do not
Change the note's storage, length limit or POST body; render notes for climb entries (the grade owns that slot); alter the bounty title fallback chain (`bountyTitle` → catalog lookup → `Bounty`).

---

## 35. Say which day the app thinks it is

Status: Todo

### Why
`challengeToday()` follows the Sheet's timezone, falling back to `serverDate` and then to the device's local date, and both `serverDate` and `challengeTimeZone` are cached in `roadToSendShared:meta:{endpoint}` on every sync. Neither is ever displayed: `renderSync()` shows only the protocol version and `lastSyncedAt`. A crew member travelling — or anyone whose device clock has rolled past the Sheet's midnight — has no way to see why the today-card looks a day out.

### Requirements
- `src/app.js` — `renderSync()` appends the challenge date and timezone to `#diagnosticDetail`, reading `Challenge day: 2026-07-26 · America/Los_Angeles`, only when both values are known and an `endpoint` is set.
- Reuse `challengeToday()` and the cached `challengeTimeZone`; never call `new Date()` for challenge-date logic (rule 6).
- Leave `#diagnosticCode` and its copy handler exactly as they are — it routes through `copyText()` per entry 22.
- The line is diagnostic, not an error: it must not render as a warning, and must not appear in local mode.

### Tests
- `tests/client-state.test.js` — extend the existing fetch-stubbed harness: after a sync returning a `timeZone` and `serverDate`, `#diagnosticDetail`'s `textContent` contains both; in local mode it contains neither.
- `tests/static-check.mjs` — **add** `assert.match(script,/Challenge day: /)`.

### Do not
Change `challengeToday()`'s fallback order or `#syncDiagnostics`' show/hide rule; add a timezone picker or any client-side timezone conversion; surface the endpoint URL anywhere (entry 22's privacy rule); touch the diagnostic error codes.

---

## 36. Caption the heatmap and the trend chart

Status: Todo

### Why
Both graphics already carry `role="img"` with a summarising `aria-label` — `#youHeatmap` announces its active-day and point totals, `#weeklyTrend` its per-week list — so the container level is covered and this entry must not redo it. What is missing is per-datum detail for everyone else: each heatmap cell and each trend column keeps its numbers in a `title=` attribute on an `aria-hidden="true"` element, which never appears on touch, is invisible on a phone, and is the only place that individual day's or week's figure exists.

### Requirements
- `src/index.template.html` — `<p id="heatmapSummary" class="muted">` inside `#heatmapCard` after `#youHeatmap`, and `<p id="trendSummary" class="muted">` inside `#weeklyTrendCard` after the `.trend-scroll` wrapper. Both are plain text set with `textContent`. Placing the trend caption after the wrapper keeps the existing `.trend-scroll` → `<div id="weeklyTrend">` adjacency assertion intact.
- `src/app.js` — two small pure helpers building the caption strings from what `heatmapDays()` and `weeklyTrend()` already return: the heatmap caption names the best day and the active-day count, the trend caption the best week and the current one. Reuse `fmtDay()` for dates (rule 6).
- Keep both existing `aria-label`s. The captions are additive and must not simply restate them.
- Do not enumerate every day into an `aria-label` — a ten-week challenge would make it unusable.
- `src/styles.css` — reuse the existing muted-caption styling; add at most a spacing rule.

### Tests
- `tests/client-state.test.js` harness-1: both caption helpers against crafted days and weeks, including the empty case (returns `''`) and a single-day case (no stray plural).
- `tests/client-state.test.js` harness-2 `domChecks`: after `render()` both captions have non-empty `textContent`, and both are empty when their cards are hidden.
- `tests/static-check.mjs` — **add** presence assertions for both ids plus order assertions `id="youHeatmap"` → `id="heatmapSummary"` and `class="trend-scroll"` → `id="trendSummary"`; the existing `.trend-scroll{overflow-x:auto}` and adjacency assertions must keep passing.

### Do not
Remove or rewrite the existing `aria-label`s; make heatmap cells or trend columns focusable (a seventy-cell tab-stop run is worse than the caption); drop the `title` attributes; change what `heatmapDays()`, `heatLevel()` or `weeklyTrend()` return.

---

## 37. Focus the dialog you just opened

Status: Todo

### Why
`openModal()` installs a Tab trap and `closeModal()` restores focus to the trigger, but neither moves focus **into** the dialog. Three call sites compensate by focusing a field themselves — `openIdentity()`, `openProxy()`, `openSetup()` — and three do not: `#personModal`, `#confirmModal` and `#weekReviewModal` open with focus still on the element behind them, so the first Tab can land outside the trap and a screen-reader user is never told a dialog opened. Clicking the scrim closes nothing either; only Escape and the explicit × do. `#weekReviewModal` is also the one dialog missing from `static-check.mjs`'s dialog-naming loop, despite carrying the right attributes.

### Requirements
- `src/app.js` — `openModal(id)` moves focus to the dialog's first focusable element through the existing `focusableIn()` helper, after the trap is installed. The three dialogs that focus a specific field keep doing so, since their explicit `.focus()` calls run afterwards.
- Named top-level `closeIfScrim(event,id)` closing the modal only when `event.target` is the backdrop itself (`event.target===m`) — no `closest`, so the stub harness can call it. Wire it on each modal's backdrop.
- Escape, the × buttons and `closeModal()`'s focus restoration are unchanged. Reuse `openModal`/`closeModal`; no second focus-trap implementation.

### Tests
- `tests/client-state.test.js` — a **new** async `test(...)` whose element factory records `focus()` calls. The shared `makeElement()` stubs `focus` as a no-op and returns `[]` from `querySelectorAll`, so this is not observable in any existing harness; a richer factory in a new context is additive, not a weakened assertion. Assert that opening `#confirmModal` focuses an element inside it, that `closeIfScrim({target:modal},'confirmModal')` closes it, and that `closeIfScrim({target:innerNode},'confirmModal')` does not.
- `tests/static-check.mjs` — **append** `'weekReviewTitle'` to the existing dialog-naming array. Append, never retarget: entries 19 and 20 previously collided in this exact array.

### Do not
Replace the focus trap or write a second one; auto-focus a destructive control such as `#confirmOk` — the dialog's first focusable element is the safer default; close a modal on any click that is not the backdrop itself; change `lastFocused` restoration; make any modal open on its own (the Week in Review's once-a-week rule is entry B1's and stays as it is).

---

## 38. Show more of the feed

Status: Todo

### Why
`render()` paints `activityMarkup(logs,20,…)` into `#activityList` and `activityMarkup(myLogs,5,…)` into `#personalActivity`. Those caps are hard: across a ten-week challenge the personal feed shows the last five entries and the crew feed the last twenty, with no way to see anything older — no "show more", no pagination, no filter. The data is already in memory; only the slice is missing.

### Requirements
- `src/app.js` — module-level `crewFeedLimit` and `personalFeedLimit` seeded at the current 20 and 5, and a named top-level `showMoreFeed(feed)` raising the relevant one by a page and repainting. Reset both to their defaults in `loadInitialState()` and `performDisconnect()`.
- `src/index.template.html` — a `Show more` button under each feed, hidden when that feed already shows everything it has.
- Keep the crew feed read-only: its `activityMarkup(...)` call keeps `false` for `allowDelete` (entry 29). Entry 29's static assertion matches that argument rather than the number, so swapping in a variable limit keeps it passing.
- `src/styles.css` — both buttons at least 44px (rule 7); reuse `.text-btn`.
- Growth is bounded by `logs.length`; never render a page beyond the data.

### Tests
- `tests/client-state.test.js` harness-2 `domChecks`: with more entries than the default limit the feed renders the default count and the button is visible; `showMoreFeed('personal')` renders more; once everything is shown the button hides.
- `tests/static-check.mjs` — **add** presence assertions for both button ids and `assert.match(script,/function showMoreFeed\(/)`.

### Do not
Add a filter, sort control or search box in this entry; persist the expanded limit (rule 4 — no new localStorage key); re-enable delete controls on the crew feed; change `activityMarkup()`'s sort order or signature.

---

## 40. Share through the system share sheet

Status: Todo

### Why
Entry 22 built `shareSummary()`, routed `#shareBtn` through `copyText()`, and deferred the native path in as many words: "`navigator.share` — a permission-gated async path that still needs the clipboard fallback and is not observable in the stub harness, so propose it separately." On a phone, which is what this app is built for, copying to the clipboard means opening another app and pasting; the system share sheet is one tap to any destination.

### Requirements
- `src/app.js` — new `async function shareProgress()` behind `#shareBtn`: when `navigator.share` exists, `await` it with the `shareSummary()` text inside a `try`; when it is missing, or on a genuine rejection, fall back to `copyText(shareSummary(…), 'Progress copied — paste it anywhere.')`. It never throws.
- Guard the global the way `copyText()` does (`typeof navigator === 'undefined' ? null : navigator`); optional chaining throws `ReferenceError` on an undeclared identifier in the harnesses (entry 22, deviation 1).
- A **dismissed** share sheet is a completed action, not a failure: `navigator.share` rejects with an `AbortError` when the user closes it, and that path must do nothing at all — no clipboard fallback, no error toast, no second prompt. Only a missing API or a non-abort rejection reaches the fallback.
- `shareSummary()` and `publicUrl()` are unchanged, so the shared text still excludes the `sheet` param and every other person's data.
- The single `navigator.clipboard.writeText` call site stays inside `copyText()` (entry 22's architectural guard).

### Tests
- `tests/client-state.test.js` — a **new** async `test(...)` covering four contexts: `navigator.share` resolving (nothing reaches the clipboard), `navigator.share` absent (the fallback copies and toasts), `navigator.share` rejecting with an `AbortError` (nothing happens at all), and `navigator.share` rejecting otherwise (the fallback runs). Assert on the recorded clipboard writes and `#toast`'s `textContent`.
- `tests/static-check.mjs` — **add** `assert.match(script,/function shareProgress\(/)`, keeping `assert.equal((script.match(/navigator\.clipboard\.writeText/g)||[]).length,1)` passing.

### Do not
Share a file, URL list or any payload beyond the summary text; include the `sheet` param, the endpoint or another person's data; treat a dismissed share sheet as a failure or follow it with a second prompt; add a second clipboard write; make `shareProgress()` throw.

---

## 41. Preview the week's bounties

Status: Todo

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
