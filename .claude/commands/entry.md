---
description: Work exactly one entry from IMPROVEMENT_LOG.md, then stop.
---

Work exactly ONE entry from `IMPROVEMENT_LOG.md`, then stop.

## 1. Orient

Run `npm run queue`. It refreshes `origin/main` and reports where the loop stands. Branch on its
exit code and do not go further than it allows:

- **4** — the previous entry has not merged. Report which entry is blocking, then STOP. Do not
  start a second entry on top of unmerged work; entries routinely overlap in the files they touch.
- **5** — an entry is stuck `In progress` from a run that died. Report it and STOP: resetting it
  is a human's call, not yours.
- **3** — queue empty. Report "queue empty — no Todo entries" and STOP. Do not invent work, re-do
  a `Done` entry, or reopen anything. Refuelling the queue is `/refill`, a separate run.
- **0** — the `next:` line names your entry. Continue.

Start from the latest `origin/main` — never from local `main`, which has been 37 commits behind
before: `git checkout -B claude/entry-<N>-<slug> origin/main`.

Now read the rules block at the top of `IMPROVEMENT_LOG.md` in full, then your entry.

## 2. Clear the finished entry first

If `npm run queue` printed an `archive-due:` line, rule 10 applies before you start: move that
entry — heading through its `---` separator, **verbatim** — into the current archive file and drop
its index line. Check the lifted block back out of the archive (exactly one occurrence, gone from
the log, heading at the start of its own line) and confirm the entry above it is intact and unsplit.

## 3. Implement

- Set `Status: In progress — <today>` as your first action.
- Do exactly what the entry's `### Requirements` says, and nothing its `### Do not` forbids.
- An entry may carve itself out of rules 2 and 8 in its own `### Requirements`. Honour that
  carve-out — do **not** go `Blocked` on rules 2/8 for an entry that grants itself one. Absent an
  explicit carve-out they are hard limits: `src/app.js`, `src/index.template.html`,
  `src/styles.css` and tests only.
- Reuse the helpers the entry names. Never fork scoring math, never call `new Date()` for
  challenge dates (use `challengeToday()`), never add a localStorage key, a dependency, or a
  network request.
- **The test files carry their own trap notes in a header comment.** Read the header of any test
  file before you add assertions to it — that is where the harness's sharp edges are documented.
- If the entry genuinely cannot be done inside its own rules, set `Status: Blocked — <reason>`,
  commit that, and stop. Do not bend the rules to finish.

## 4. Verify

Run `npm run build`, then `npm test`. All suites must pass; never weaken or delete an existing
assertion. The runner reports every suite before exiting, so read the `=== summary ===` block, not
just the first failure. `check:generated` is read-only: if it fails, run `npm run build` and commit
`index.html` together with your `src/` changes.

## 5. Ship

- Set `Status: Done — <today>` and update the queue index.
- Record the commit subject in `Notes:` in exactly this shape: ``Commit `<subject>`.`` —
  `npm run queue` reads that subject back out to tell the next iteration whether you landed, so an
  entry without it reports as unverifiable and stalls the loop. Add any deviations after it.
- All of that goes in the **same commit** as the implementation. One entry = one commit.
- `git push -u origin claude/entry-<N>-<slug>`, then open a **draft** PR filling in the
  repository's pull request template.

## 6. Hand it to the reviewer

A draft means "this run has not finished checking itself". Once it has, say so: promote the PR to
**ready for review** — `update_pull_request` with `draft: false`, or `gh pr ready` — but only when
every one of these holds.

- `npm test` printed `PASS` for every suite in the `=== summary ===` block. One `FAIL` anywhere,
  including `check:generated` or `size-check`, means no.
- The commit touches only what this entry was allowed to touch, plus the regenerated `index.html`,
  and `git status --short` is clean afterwards — no stray file left behind, nothing uncommitted.
- `Status: Done — <today>` and the ``Commit `<subject>`.`` note landed in that same commit.
- CI on the pushed head commit has **concluded successfully** — every check run, not just the first
  one to report back.
- The entry is not `Blocked`, and nothing in `Notes:` is a deviation a human has to rule on.

CI takes about a minute. Re-read the PR's check runs until they conclude, for up to ten minutes;
don't spin on a foreground `sleep` — use whatever wait your harness gives you. If they are still
pending when that budget runs out, leave the PR a draft and report `CI: pending`.

If any item above fails, **leave it a draft** and say which one. A draft that names its problem is
worth more than a ready PR that buries it.

**Never merge it.** Not by merging, not by enabling auto-merge, not by approving, not by pushing to
`main`. Marking ready is the entire handoff; the merge is the human's, and it is the only gate
between this loop and an app a real crew uses.

- Report the entry number, the PR URL, CI status, and whether the PR is ready for review or still a
  draft and why. Then stop — do not start the next entry.
