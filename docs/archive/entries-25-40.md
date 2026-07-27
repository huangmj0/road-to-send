# v11 pass — entries 25–40

The tone-rule pass. Every entry here surfaces what people did and never what they didn't; entry 39 was dropped rather than reworded, which is why the numbering skips it.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.

---

## 25. Score the live log once per render

Status: Done — 2026-07-26
Notes: Commit `Score the live log once per render`. `computeCreditsRaw(entries,settings)` is the
old function body with two changes and no third: the name, and a leading `creditRuns++`. Its
scan-sort-cap-bonus logic is character-identical, so the `deepEqual` shape assertions rule 6
protects are untouched. `computeCredits(entries,settings=config)` is now a wrapper that keeps the
exact name, arity and default: anything that is not the live pair (`entries!==logs||settings!==
config`) goes straight to `computeCreditsRaw` and neither reads nor writes the cache, which is what
stops `updateRecordPreview()`'s `[...logs,draft]` and `earnedThrough()`'s date-filtered copy from
poisoning it; the live pair answers from `creditMemo` when the reference, the length and the
settings all still match, and otherwise rescans and re-seeds. `logs.push(draft)` in
`submitActivity()` became `logs=logs.concat([draft])` and `logs.splice(index,1)` in
`performDelete()`'s local branch became `logs=logs.filter((x,i)=>i!==index)`, so the reference is
load-bearing everywhere; every other write already reassigned. No caller mutates the returned
`Map`s — checked before relying on it — and they are now shared within a render, so they are
read-only by contract. index.html 135,867 → 136,311 bytes (+444; 84.7% of the 161,000-byte
budget, against the ~300 this entry was projected to cost). Tests: harness-1 gains an invalidation
matrix in which every stale answer would be a *different number* — reassignment 3→5, an in-place
`push` 5→8, an in-place `splice` 8→5, a replaced `config` 5→`undefined` and back — plus proof that
a derived array and explicit settings each bypass the memo without evicting it. Harness-2 pins
`render()`'s raw-scan delta at exactly 2 and then asserts the number is a *constant*: a six-person
crew costs the same two scans as a one-person crew, which is the regression that matters, since
`weekTrend()` used to rescan inside `leaders.map(...)`. `static-check.mjs` adds
`function computeCreditsRaw\(` and the structural guard
`doesNotMatch(script,/\blogs\.(push|splice|unshift|shift|pop|sort|reverse|fill|copyWithin)\(/)`.
Deviations: (1) `creditMemo` carries a fourth field, `cfg`, so its shape is `{ref,len,cfg,value}`
rather than the `{ref,len,value}` the entry specifies. The entry's own gate
(`entries===logs&&settings===config`) cannot catch a *replaced* `config`: the gate compares the
argument to the current global, both of which are the new object, while the memoized value was
computed under the old one — so the memo would serve a stale answer, and the entry's own required
test case "a replaced `config` yields the freshly correct `totals`" would fail. Storing the
settings reference is the minimum fix. (2) The harness-2 delta is 2, not the 3 a reading of "the
two derived-array callers" would predict: during `render()` only `earnedThrough()` reaches its
`computeCredits(logs.filter(...))` call, while `updateRecordPreview()`'s derived-array path is not
taken from inside `render()` in this stub. It is measured separately in the same block — called
directly it costs exactly 1 scan and leaves the live memo intact — so the derived-array bypass is
still covered, and the assertion carries a comment saying what would make the number move.
(3) `performDelete()` still removes by index; entry 26 is the one that switches it to identity, and
doing it here would have pre-empted that entry. (4) Rule 10 archiving: entry 24 was moved verbatim
into `IMPROVEMENTS.md` after the archived entry 22 and its index line dropped; the lifted block was
string-matched back out of the archive (exactly one occurrence, gone from the log, heading confirmed
at the start of its own line) and entry 22 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Delete the entry you confirmed, not the row in its place`. `requestDelete()` now
captures the row itself — `pendingDelete={entry:item,index,id,feed,position}` — and
`performDelete()` destructures `{entry,id,feed,position}`, so the local branch reads
`else if(logs.indexOf(entry)>=0){logs=logs.filter(x=>x!==entry);…}`: it removes the object the
dialog described, and a captured row that has already left `logs` takes nothing with it — there is
no positional fallback. The shared branch still deletes by `id`, unchanged. Dismissal is now
handled in one place: `closeModal(id)` clears `pendingDelete` and `confirmAction` when `id` is
`confirmModal`, which covers the cancel button, the ×, the Escape handler and any future route
without wiring each one separately. `performDelete()` still nulls `pendingDelete` up front, and
`confirmProceed()` still nulls `confirmAction` before invoking the action, so the confirmed path
is unaffected by the addition. index.html 136,311 → 136,407 bytes (+96; 84.7% of the 161,000-byte
budget, against the ~500 this entry was projected to cost). Tests: harness-2 gains a block that
cancels a pending delete and then fires `performDelete()` — the log is untouched both times, which
is the regression lock for intent surviving a dismissal — then deletes the middle of three rows by
identity and asserts the survivors keep their order, then removes the captured row from `logs`
between the request and the confirm and asserts nothing is deleted and the dialog still closes.
`static-check.mjs` gains the `pendingDelete=null` count guard. Deviations: (1) The entry specifies
that guard as `>=2`, which was already true before this commit: the module declaration
`let pendingDelete=null,confirmAction=null;` and `performDelete()`'s own reset are two occurrences,
so the assertion could not have failed. It is written as `>=3` — declaration, confirmed path,
dismissal path — with a message naming all three, which is the count that actually detects the
bug. (2) Clearing lives in `closeModal()` rather than in three separate handlers. The entry names
the cancel button, the × and the Escape handler; routing through the one function they all already
call covers exactly those three today and, deliberately, also covers the scrim-click dismissal that
entry 37 is about to add — which the entry's own enumeration would otherwise have missed.
(3) The staleness guard is scoped to the local branch. Applying it to the shared branch would break
shared deletes outright: `loadRemote()` replaces `logs` wholesale, so object identity does not
survive a background sync and every shared confirm after a sync would silently do nothing. The
shared branch is `id`-keyed by design and stays that way. (4) `index` is still carried on
`pendingDelete` as the entry's shape requires, but `performDelete()` no longer destructures it,
since reading it is precisely the bug. (5) Rule 10 archiving: entry 25 was moved verbatim into
`IMPROVEMENTS.md` after the archived entry 24 and its index line dropped; the lifted block was
string-matched back out of the archive (exactly one occurrence, gone from the log, heading confirmed
at the start of its own line) and entry 24 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Funnel every storage write through one guarded helper`. `writeStore(key,value)`
guards the global the way `copyText()` does (`typeof localStorage === 'undefined' ? null :
localStorage`, because optional chaining still throws `ReferenceError` on an undeclared identifier
in the harnesses), returns `false` when storage is missing, has no `setItem`, or throws, returns
`true` on a successful write, and never throws. All **eleven** `localStorage.setItem` occurrences
now route through it, so the architectural guard counts exactly one — the single literal on
`writeStore`'s own write line. `persistLocal()` and `persistShared()` now attempt every write
before reporting (`const a=…,b=…;return a&&b`, never a short-circuit that would skip the second
key) and hand back a boolean. `submitActivity()` carries `storageFailed=!persistLocal()` in its
local branch and heads its toast ladder with `Saved on this device only — storage is full.`, so the
entry that is already in `logs` is never reported as a failed save; `render()` and `showTab('you')`
run before the toast as they always did. `saveIdentity()` closes its dialog and repaints regardless
of the write result, because nothing between the write and `closeModal()` can throw any more. No
key was added, renamed or reshaped, and `safeJson()`'s read behaviour is untouched (rule 4).
index.html 136,407 → 136,672 bytes (+265; 84.9% of the 161,000-byte budget, inside the ~800 this
entry was projected to cost). Tests: harness-1 swaps `localStorage` for a stub whose `setItem`
throws and asserts `writeStore()` returns `false` without raising and that `persistLocal()`
propagates it, then for a stub with no `setItem` at all, then restores the real store and confirms
neither the stored value nor the success path was disturbed. A new async `test(...)` runs the whole
failure in one piece: with every write throwing, `saveIdentity()` still sets `me` and still closes
`#identityModal` — the dialog no longer traps the user behind an uncaught throw — and a local-mode
`submitActivity()` leaves the row in `logs`, toasts the storage message rather than `Save failed`,
and hands the Save button back. `static-check.mjs` gains `function writeStore\(` and the
`localStorage.setItem` count guard. Deviations: (1) The entry lists five functions to convert —
`persistLocal()`, `persistShared()`, `saveIdentity()`, `maybeShowWeekReview()` and `saveSetup()` —
which is eight of the eleven call sites. The other three are in `loadInitialState()` (the `?sheet=`
endpoint write and the one-time `roadToSendConfigV8` → `roadToSendConfigV9` migration write) and in
`createProfile()` (`roadToSendMe`). They had to be converted too or the entry's own
`length === 1` guard could not pass. Converting the migration write does not migrate anything new
and changes no key or shape — rule 4's "only the existing one-time migration writes
`roadToSendConfigV9`" still describes exactly one write; a failed migration simply retries on the
next load, where before it threw out of `loadInitialState()` entirely. (2) `persistShared()`
returns `false` on the early `if(!endpoint)` return rather than `undefined`, so its result is a
boolean on every path; no caller reads it today. (3) Rule 10 archiving: entry 26 was moved verbatim
into `IMPROVEMENTS.md` after the archived entry 25 and its index line dropped; the lifted block was
string-matched back out of the archive (exactly one occurrence, gone from the log, heading confirmed
at the start of its own line) and entry 25 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Offer a local delete back before it is gone`. `#undoBar` sits immediately before
`#toast`, outside every `[data-panel]`, carrying `role="status"`/`aria-live="polite"` with
`#undoText`, `#undoDelete` and `#undoDismiss`. Module-level `lastDeleted` is set **only** in
`performDelete()`'s local branch, which now reads the row's index off `logs` as it removes it:
`{entry,index:at,label:pending.label}`. `undoDelete()` returns early in shared mode, rebuilds the
array with `logs.slice(0,index).concat([entry],logs.slice(index))` so the row lands where it came
from rather than on the end, persists, repaints and toasts. `renderUndo()` shows the bar only when
`lastDeleted` is set, force-clears it whenever `endpoint` is truthy, and is called from the tail of
`render()` next to `renderSync()` — idempotent and cheap enough to run every time (rule 6). There
is **no timer**: the bar clears on undo, on dismiss, on the next delete (which simply overwrites
`lastDeleted`), on `performDisconnect()`, on an endpoint appearing, and on `showTab()`, which is
also how a successful `submitActivity()` clears it — that function already calls `showTab('you')`
on its success path, so one mechanism covers both cases the entry lists. `src/styles.css` gains one
appended line before the `prefers-reduced-motion` query: `.undo-bar` at the toast's slot above
`.bottom-nav`, `min-height:44px` on both buttons, and the exact
`.undo-bar:not(.hide)~.toast{bottom:160px}` sibling rule, so the two never overlap; it is CSS only,
so the existing reduced-motion kill-switch applies (rule 7). index.html 136,672 → 138,431 bytes
(+1,759; 86.0% of the 161,000-byte budget, inside the ~2,500 this entry was projected to cost).
Tests: harness-2 deletes the middle of three rows and asserts the bar appears with `#undoText`
starting `Deleted `, that undo restores the length **and** the original index (`u1,u2,u3`, not
`u1,u3,u2`), and that the bar hides once the offer is taken; then that a second delete offers
again and `showTab('crew')` puts it away; then that setting `endpoint` and calling `renderUndo()`
hides it and that `undoDelete()` is inert in shared mode even when called directly.
`static-check.mjs` gains the `#undoBar` role/live assertions, `type="button"` on both controls, the
`id="undoBar"` → `id="toast"` order assertion, `function undoDelete\(`, and the exact compact CSS
text. Deviations: (1) `pendingDelete` gains a `label` field, so entry 26's shape is now
`{entry,index,id,feed,position,label}`. The alternative was recomputing the confirm dialog's
description a second time inside `performDelete()`; carrying the string `requestDelete()` already
built keeps one source for the wording the user just read. (2) `undoDelete()` toasts
`Restored on this device only — storage is full.` when the write fails, rather than always
`Entry restored.`. Entry 27 landed one commit earlier and made `persistLocal()` report instead of
throw; claiming a clean restore over a failed write would reintroduce exactly the dishonesty entry
27 removed. (3) The harness-2 block resets `lastDeleted=null` in its setup, because the preceding
entry-26 block leaves a delete pending — that is block-local state hygiene, not a weakened
assertion. (4) Rule 10 archiving: entry 27 was moved verbatim into `IMPROVEMENTS.md` after the
archived entry 26 and its index line dropped; the lifted block was string-matched back out of the
archive (exactly one occurrence, gone from the log, heading confirmed at the start of its own line)
and entry 26 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Stop the Crew feed inviting deletes of other people's entries`. `render()` paints
`#activityList` with `activityMarkup(logs,20,false)`, so the crew feed renders no delete controls,
and the `#activityList` click listener in `init()` was **removed** rather than left in place — a
handler that can act on a row the user has no control for is the same bug one layer down.
`#personalActivity` keeps `activityMarkup(myLogs,5,true)` and its own listener, so deleting your own
entry is unaffected, and `feedSelector()`, `nextFocusIndex()` and `restoreFeedFocus()` keep their
signatures and keep working for the `'personal'` feed. index.html 138,431 → 138,232 bytes (**−199**;
85.9% of the 161,000-byte budget — this entry gives bytes back, as projected). Tests:
`static-check.mjs` gains `#activityList'\)\.innerHTML=activityMarkup\([^)]*,false\)`, which
matches the `false` argument rather than the limit, so entry 38 can replace the number with a
variable without retargeting it. Deviation: (1) Two assertions in harness-2's entry-19 block —
`the Crew feed keeps its delete buttons` and `the Crew feed keeps its delete labels` — asserted
exactly the behaviour this entry removes, so they could not both survive. They were **inverted, not
deleted**: same feed, same render, same `innerHTML`, now asserting the absence of `data-del=` and
`aria-label="Delete ` with a comment recording why they flipped. That is the entry's intent made
enforceable rather than a weakened assertion; entry 19's focus-restoration assertions, which this
entry's `### Do not` protects by name, are untouched and still pass. (2) Rule 10 archiving: entry 28
was moved verbatim into `IMPROVEMENTS.md` after the archived entry 27 and its index line dropped;
the lifted block was string-matched back out of the archive (exactly one occurrence, gone from the
log, heading confirmed at the start of its own line) and entry 27 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Render the repeated card rows from one shape`. Three pure helpers —
`breakdownRow(icon,label,points,pct)`, `pyramidRow(grade,count,pct)` and `recordsRow(label,value)`
— take plain values rather than model objects, so neither renderer reshapes its data, and all four
call sites now render through them: `renderBreakdown()`, `renderPyramid()`, `renderRecords()` and
`renderPersonCard()`'s three sections. The **person-card** shape is the one that was adopted, so
every bar now carries `role="img"` with a per-row `aria-label` and an `aria-hidden="true"` inner
`<i>` (rule 7): the You panel is upgraded and the modal is unchanged, which is the drift this entry
existed to close. Nothing about what `categoryBreakdown()`, `personalRecords()` or `gradePyramid()`
returns changed, and no container id moved. index.html 138,232 → 137,944 bytes (**−288**; 85.7% of
the 161,000-byte budget — collapsing the duplication gives bytes back even after the added labels).
Tests: harness-2 renders the You panel and opens the person card for the same person and asserts
`#youBreakdown.innerHTML` is **identical** to `#personBreakdown.innerHTML` and `#gradePyramid` to
`#personPyramid` — the strongest available statement that one shape serves both — plus that the
You-panel rows now contain `role="img"` and `aria-label="` while the decorative fill keeps
`aria-hidden="true"`. `static-check.mjs` gains a presence assertion for each helper and
single-source counts for the row markup; every existing `role="img"[^>]*aria-label=` assertion
still passes. Deviations: (1) `#gradePyramid` already carried a container-level `role="img"` with an
`aria-label` enumerating every row, and assistive technology ignores descendants of a `role="img"`
element — so the per-row labels **inside the pyramid are inert**. The entry asks for one shared
shape and that is what shipped, but the real accessibility gain here is on the breakdown and records
rows, not the pyramid. Recorded so a later a11y pass reads the redundancy as deliberate rather than
discovering and removing it. (2) The `records-row` class is also used by `renderWeekReview()`'s
leader list, whose rows are rank-plus-name rather than label-plus-value and which this entry does
not name. It was left alone rather than bent to fit, so the single-source count assertion for that
shape is 2 — `recordsRow()` and the Week in Review — with a comment saying why. (3) Rule 10
archiving: entry 29 was moved verbatim into `IMPROVEMENTS.md` after the archived entry 28 and its
index line dropped; the lifted block was string-matched back out of the archive (exactly one
occurrence, gone from the log, heading confirmed at the start of its own line) and entry 28 was
confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Say whether the export actually downloaded`. `exportData()`'s body is wrapped in a
`try`, toasting `Export downloaded.` after the click lands and `Export failed — try a different
browser.` on any throw; it never throws. The object URL is held in a `let url` and revoked in a
`finally`, so both paths release it and a context that could not even construct the `Blob` has
nothing to revoke and revokes nothing. The exported JSON is untouched: the same
`{version, exportedAt, mode, config, activities}` keys in the same order, the same `null,2`
formatting and the same `road-to-send-export.json` filename, because other tooling reads that file.
index.html 137,944 → 138,066 bytes (+122; 85.8% of the 161,000-byte budget, well inside the ~400
this entry was projected to cost). Tests: a new `test(...)` builds three fresh contexts from one factory
— neither `Blob` nor a throwing `click()` exists in any current harness, so both stubs are additive
rather than a weakened assertion. The working context asserts the success toast, that the download
really fired, and that the URL was revoked; the blocked-`click()` context asserts the failure toast
and that the URL is *still* revoked; the blocked-`Blob` context asserts the same failure toast and
that nothing is revoked when there was nothing to revoke. `static-check.mjs` gains
`Export downloaded\.`. Deviations: (1) The revoke moved into a `finally` rather than being written
twice, which is what makes the "revoke on both paths" requirement true by construction instead of
by repetition. (2) Rule 10 archiving: entry 30 was moved verbatim into `IMPROVEMENTS.md` after the
archived entry 29 and its index line dropped; the lifted block was string-matched back out of the
archive (exactly one occurrence, gone from the log, heading confirmed at the start of its own line)
and entry 29 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Let the credit preview admit a save is in flight`. `creditPreviewCopy()` opens its
ladder with `if(o.saving)return'Saving…'`, so an in-flight save wins over every other branch, and
`submitActivity()` calls `updateRecordPreview()` immediately after `saving=true` so the branch is
actually reachable; the existing `finally` already restores the normal copy. `updateRecordPreview()`
was already threading the module-level `saving` into its opts object — entry 21 shipped that half
and recorded the unused parameter as its deviation 2 — so nothing changed there. `#creditPreview`,
its live-region behaviour, `#recordMeter` and `#saveActivityBtn`'s label are all untouched.
index.html 138,066 → 138,118 bytes (+52; 85.8% of the 161,000-byte budget, inside the ~300 this
entry was projected to cost). Tests: harness-1 asserts the saving branch returns `Saving…` for an
otherwise-perfect draft, that it still wins for a draft with no target, out of window and already
logged, and that an explicit `saving:false` behaves exactly as its absence does; all six existing
assertions in that block are called without the flag and return their current strings unchanged.
Deviations: (1) The entry specifies the static guard as `Saving…` count `>=2` on the grounds that
"the string already exists once for the button label". It exists **twice** already —
`#saveActivityBtn` in `submitActivity()` and `#saveSetupBtn` in `saveSetup()` — so a `>=2` guard
would have passed without this entry doing anything at all. It is written as `>=3` with a comment
naming all three occurrences, which is the count that actually detects the preview branch.
(2) Rule 10 archiving: entry 31 was moved verbatim into `IMPROVEMENTS.md` after the archived entry
30 and its index line dropped; the lifted block was string-matched back out of the archive (exactly
one occurrence, gone from the log, heading confirmed at the start of its own line) and entry 30 was
confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Make the category chips start the recording they describe`. Each chip is now
`<button class="cat-chip …" type="button" data-cat="{type}">` nested **inside** its existing
`role="listitem"` wrapper, which is a new `<span class="chip-item">` — the chip cannot itself be the
list item, because `role="listitem"` on a button destroys the button semantics, and `#todayCategories`
keeps `role="list"` as `static-check.mjs` asserts. `prefillCategory(type)` mirrors `claimBounty()`'s
steps rather than copying its body: it looks the radio up first and returns if there is none, then
`setDefaultRecordDate()`, collapses `#dateFields` and resets `#dateToggle`, checks the radio,
`showTab('record')` and `updateRecordPreview()`. One delegated `#todayCategories` listener sits
beside the `#todayBounties` one in `init()`. No new module state, no fourth chip state, and no new
copy in `#todayRemaining`. Already-logged chips stay tappable and undisabled: logging a category
twice is legal and simply scores 0, so the affordance must not imply an error. `src/styles.css`
gains one appended line — `.chip-item{display:inline-flex}`, the button reset the chip needs
(`font-family:inherit`, `cursor:pointer`), a `:focus-visible` outline and an `:active` background;
`.cat-chip` already carried `min-height:44px` (rule 7). index.html 138,118 → 139,049 bytes (+931;
86.4% of the 161,000-byte budget, inside the ~1,200 this entry was projected to cost). Tests:
harness-2's three existing chip assertions count occurrences of `cat-chip` and `cat-chip done`, and
they still hold **because the wrapper class is `chip-item`, not a `cat-chip` variant** — a wrapper
named `cat-chip-item` would have silently inflated every one of those counts. Saying so here so a
later pass does not "fix" them. New assertions cover the button markup, the nesting order, the
preselect, and that no done chip is disabled. `static-check.mjs` gains
`<button class="cat-chip` and `function prefillCategory\(`. Deviations: (1) The entry's test asks
that `prefillCategory('exercise')` "leaves the Record panel active", which is not observable in
harness 2: `showTab()` moves panels through `document.querySelectorAll('[data-panel]')` and the stub
returns `[]` from it. The jump is asserted through an effect that *is* observable — `showTab()`
clears `lastDeleted` (entry 28), so a seeded undo offer being gone proves the tab change ran — plus
`#dateFields` gaining `hide`, which is the date reset the entry asks `prefillCategory` to mirror.
A comment in the harness records why. (2) A harness-local `const typeRadio` collided with entry 21's
declaration in the same IIFE scope and was renamed `chipRadio`; nothing of entry 21's was touched.
(3) Rule 10 archiving: entry 32 was moved verbatim into `IMPROVEMENTS.md` after the archived entry
31 and its index line dropped; the lifted block was string-matched back out of the archive (exactly
one occurrence, gone from the log, heading confirmed at the start of its own line) and entry 31 was
confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Show the note written on a bounty claim`. One ternary branch: `activityMarkup()`'s
bounty `detail` now appends ` · ` plus the escaped note when one is present, matching the
exercise/mobility branch exactly. Climb entries keep the grade in that slot and gain nothing. `esc()`
stays around the note — it is user-entered text arriving from a shared Google Sheet, so this is an
injection boundary. The feed row structure, the delete-button markup, the note's storage, its POST
body and `#activityNote`'s 120-character `maxlength` are all untouched. index.html 139,049 → 139,080
bytes (+31; 86.4% of the 161,000-byte budget, against the ~100 this entry was projected to cost).
Tests: harness-2 renders a bounty carrying a note and asserts the **whole** detail string —
`title · note · date` — rather than merely that the note appears somewhere, then a bounty without a
note and asserts the detail reads `title · date` exactly as before, then a note containing
`<img src=x onerror=…>` and asserts it is escaped rather than injected. `static-check.mjs` needs no
new assertion; the existing parse and markup checks cover it. Deviations: (1) A first draft asserted
the absence of ` · ` for a note-less bounty, which is wrong — the row template already joins the
detail to the date with that separator, so the assertion could never have held. Both assertions were
rewritten against the full detail string, which is what actually distinguishes the two cases.
(2) Rule 10 archiving: entry 33 was moved verbatim into `IMPROVEMENTS.md` after the archived entry
32 and its index line dropped; the lifted block was string-matched back out of the archive (exactly
one occurrence, gone from the log, heading confirmed at the start of its own line) and entry 32 was
confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Say which day the app is scoring against`. `renderSync()` appends
` Challenge day: 2026-07-26 · America/Los_Angeles.` to `#diagnosticDetail` after the protocol and
last-sync sentence, reading `challengeToday()` and the cached `challengeTimeZone` — no `new Date()`
for challenge-date logic (rule 6), and no client-side timezone conversion. The line is appended only
when `challengeTimeZone` is known, and it sits inside the shared-mode branch, after the early
`if(!endpoint)` return, so local mode never shows it. It reads as one more diagnostic fact in the
same neutral sentence as the rest, not as a warning. `#diagnosticCode` and its copy handler,
`challengeToday()`'s fallback order and `#syncDiagnostics`' show/hide rule are all untouched.
index.html 139,080 → 139,166 bytes (+86; 86.4% of the 161,000-byte budget, well inside the ~500 this
entry was projected to cost). Tests: the existing fetch-stubbed sync harness now returns a real
`serverDate` and `timeZone` in its payload — extending the existing `payload` object rather than
replacing it, so every assertion already in that case still passes — and asserts after a sync that
`#diagnosticDetail` names the challenge day and the timezone, that the protocol line still leads,
and that the endpoint host appears nowhere in it (entry 22's privacy rule); then clears `endpoint`
and asserts local mode mentions neither. `static-check.mjs` gains `Challenge day: `. Deviations:
(1) The entry gates the line on "both values are known"; the implementation gates on
`challengeTimeZone` alone, because `challengeToday()` always returns a usable date — it falls back
to `serverDate` and then to the device's local date — so gating on it too would only ever suppress
the line when the timezone was already missing. (2) Rule 10 archiving: entry 34 was moved verbatim
into `IMPROVEMENTS.md` after the archived entry 33 and its index line dropped; the lifted block was
string-matched back out of the archive (exactly one occurrence, gone from the log, heading confirmed
at the start of its own line) and entry 33 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Caption the heatmap and the trend chart`. `#heatmapSummary` sits inside
`#heatmapCard` after `#youHeatmap`, and `#trendSummary` inside `#weeklyTrendCard` after the
`.trend-scroll` wrapper — after the wrapper, so the existing `.trend-scroll` → `#weeklyTrend`
adjacency assertion is untouched. Both are plain text set with `textContent`. Two pure helpers,
`heatmapCaption(days)` and `trendCaption(rows)`, build the strings from exactly what `heatmapDays()`
and `weeklyTrend()` already return — the heatmap caption names the best day (via `fmtDay()`, rule 6)
and the active-day count, the trend caption the best week and the current one. They are set inside
`renderHeatmap()` and `renderTrend()`, beside the `card.classList.toggle('hide',…)` decision, which
is the only place that can honour "empty when the card is hidden". Both existing container
`aria-label`s are kept, no day is enumerated into a label, and the `title` attributes stay. index.html
139,166 → 140,112 bytes (+946; 87.0% of the 161,000-byte budget, inside the ~1,500 this entry was
projected to cost). Tests: harness-1 covers both helpers against crafted days and weeks, including
the empty case, an all-zero case, and single-day/single-point cases that would expose a stray plural.
Harness-2 asserts both captions are non-empty when their cards are shown and empty once the logs are
cleared and the cards hide. `static-check.mjs` gains presence assertions for both ids, both order
assertions, and a presence assertion for each helper; the existing `.trend-scroll{overflow-x:auto}`
and adjacency assertions still pass. Deviations: (1) The entry's markup says `class="muted"`, but
**`.muted` has no rule in `src/styles.css`** — it exists only as the CSS custom property `--muted`.
The existing muted-caption class is `.hint`, so both captions use `class="hint"`, which is what the
entry's own requirement ("reuse the existing muted-caption styling; add at most a spacing rule")
asks for, and no CSS was added at all. (2) `trendCaption()` gates on any week having points rather
than on the row count alone, matching `renderTrend()`'s own `empty` test, so the caption and the card
appear and disappear together. (3) Rule 10 archiving: entry 35 was moved verbatim into
`IMPROVEMENTS.md` after the archived entry 34 and its index line dropped; the lifted block was
string-matched back out of the archive (exactly one occurrence, gone from the log, heading confirmed
at the start of its own line) and entry 34 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Move focus into the dialog, and let the backdrop close it`. `openModal(id)` now moves
focus to the dialog's first focusable element through the existing `focusableIn()` helper, straight
after the Tab trap is installed — so `#personModal`, `#confirmModal` and `#weekReviewModal` no longer
open with focus left on the element behind them, and the first Tab can no longer land outside the
trap. `openIdentity()`, `openProxy()` and `openSetup()` keep focusing their own field, because their
explicit `.focus()` calls run after `openModal()` returns. The first focusable element is
deliberately not a destructive control: in `#confirmModal` that is Cancel, not `#confirmOk`. New
`closeIfScrim(event,id)` closes only when `event.target` is the backdrop element itself — no
`closest()`, so the stub harness can call it directly — and is wired on all six modal backdrops in
`init()`. Escape, the × buttons, `closeModal()`'s `lastFocused` restoration and the trap itself are
unchanged, and there is no second focus-trap implementation. index.html 140,112 → 140,533 bytes
(+421; 87.3% of the 161,000-byte budget, inside the ~700 this entry was projected to cost). Tests: a
new `test(...)` builds a context whose element factory records `focus()` calls and whose
`#confirmModal` returns two focusable children — the shared `makeElement()` stubs `focus` as a no-op
and returns `[]` from `querySelectorAll`, so none of this is observable in any existing harness and a
richer factory in a fresh context is additive, not a weakened assertion. It asserts that opening
focuses the **cancel** button rather than the confirm one, that `closeIfScrim` with an inner node
leaves the dialog open, that `closeIfScrim` with the backdrop closes it, and that closing an
already-closed dialog is harmless. `static-check.mjs` gains `function closeIfScrim\(` and
`'weekReviewTitle'` **appended** to the existing dialog-naming array — appended, never retargeted,
since entries 19 and 20 previously collided in that exact array. Deviations: (1) The new scrim path
is a **fourth** way to dismiss `#confirmModal`. Entry 26 shipped one commit earlier and had already
anticipated this: it clears `pendingDelete` and `confirmAction` inside `closeModal()` rather than in
each individual handler, so the scrim route is covered by construction and no cancelled delete can
survive it. (2) The harness compares recorded focus calls as a joined string rather than with
`deepEqual`, because the array is built in the host realm and the expected literal inside the vm has
a different `Array` prototype, which `deepStrictEqual` rejects. (3) Rule 10 archiving: entry 36 was
moved verbatim into `IMPROVEMENTS.md` after the archived entry 35 and its index line dropped; the
lifted block was string-matched back out of the archive (exactly one occurrence, gone from the log,
heading confirmed at the start of its own line) and entry 35 was confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Let the feeds show more than their opening page`. Module-level `crewFeedLimit` and
`personalFeedLimit` are seeded at the current 20 and 5; `showMoreFeed(feed)` raises the relevant one
by a page and repaints; `resetFeedLimits()` puts both back and is called from `loadInitialState()`
and `performDisconnect()`. `#personalShowMore` and `#crewShowMore` sit under their feeds and are
hidden by `renderShowMore()` whenever the feed already shows everything it has. The crew feed keeps
`false` for `allowDelete` (entry 29), and its `activityMarkup(...)` call site is still a plain
`,false)` — see deviation 1. Both buttons reuse `.text-btn`, which already carries `min-height:44px`
(rule 7), so no CSS was added. index.html 140,533 → 141,564 bytes (+1,031; 87.9% of the
161,000-byte budget, inside the ~1,500 this entry was projected to cost). Tests: harness-2 builds a
log of eight entries, asserts the personal feed opens at five with the button offered, that
`showMoreFeed('personal')` renders all eight and hides the button, that paging **past** the end
renders no phantom rows and leaves the limit at the log length, and that a feed already showing
everything never offers the button at all. `static-check.mjs` gains presence assertions for both
button ids and `function showMoreFeed\(`. Deviations: (1) The bound on growth is applied **inside**
`showMoreFeed()` (`Math.min(limit+page,logs.length)`) and deliberately **not** inline at the
`activityMarkup(...)` call site. Writing the clamp at the call site would produce
`activityMarkup(logs,Math.min(crewFeedLimit,logs.length),false)`, and entry 29's static assertion
matches `activityMarkup\([^)]*,false\)` — a character class that cannot cross the inner closing
paren — so the read-only guard would have silently stopped matching. A comment above that assertion
now records the constraint. (2) `renderShowMore(id,shown,total)` is a fourth small helper rather
than two inline `classList.toggle` calls, so the show/hide rule is written once. (3) The page size is
5 for the personal feed and 20 for the crew feed — each feed pages by its own opening page rather
than by a shared constant, so "show more" reveals a proportionate amount in both. (4) Rule 10
archiving: entry 37 was moved verbatim into `IMPROVEMENTS.md` after the archived entry 36 and its
index line dropped; the lifted block was string-matched back out of the archive (exactly one
occurrence, gone from the log, heading confirmed at the start of its own line) and entry 36 was
confirmed intact and unsplit.

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

Status: Done — 2026-07-26
Notes: Commit `Share progress through the system share sheet when there is one`. New
`async function shareProgress()` sits behind `#shareBtn`: it builds the text once with
`shareSummary()`, returns early on an empty summary, guards the global the way `copyText()` does
(`typeof navigator === 'undefined' ? null : navigator`, since optional chaining still throws
`ReferenceError` on an undeclared identifier in the harnesses), and `await`s `navigator.share({text})`
inside a `try` when it exists. **A dismissed sheet does nothing at all**: `AbortError` returns
without touching the clipboard, without a toast and without a second prompt, because closing the
sheet is a completed action rather than a failure. Only a missing API or a non-abort rejection
reaches the `copyText()` fallback. `shareSummary()` and `publicUrl()` are unchanged, so the shared
text still excludes the `sheet` param and every other person's data, and the single
`navigator.clipboard.writeText` call site stays inside `copyText()` — entry 22's architectural guard
still reads 1. index.html 141,564 → 141,849 bytes (+285; 88.1% of the 161,000-byte budget, inside
the ~1,000 this entry was projected to cost). Tests: a new `test(...)` covers all four contexts from
one factory — `navigator.share` resolving (the sheet is used, nothing reaches the clipboard, and the
payload carries the name but not `sheet=`), `navigator.share` absent (the fallback copies and
toasts), rejecting with an `AbortError` (the sheet opened, nothing was copied, `#toast` stayed
empty), and rejecting otherwise (the fallback runs). `static-check.mjs` gains
`function shareProgress\(` and the clipboard count guard still passes. Deviations: (1)
`shareProgress()` returns early when `shareSummary()` yields `''` — a blank or unknown profile —
rather than opening an empty share sheet or copying an empty string. (2) The `#shareBtn` listener is
now `shareProgress` directly rather than an arrow wrapper, since the handler takes no arguments.
(3) Rule 10 archiving: entry 38 was moved verbatim into `IMPROVEMENTS.md` after the archived entry
37 and its index line dropped; the lifted block was string-matched back out of the archive (exactly
one occurrence, gone from the log, heading confirmed at the start of its own line) and entry 37 was
confirmed intact and unsplit.

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

