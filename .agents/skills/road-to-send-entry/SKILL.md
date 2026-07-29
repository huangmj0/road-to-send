---
name: road-to-send-entry
description: Implement exactly one queued Road to Send improvement, verify it, commit it, push it, and open a draft pull request. Use only when explicitly invoked to work the next Todo entry in IMPROVEMENT_LOG.md.
---

# Work one queue entry

Work exactly one entry from `IMPROVEMENT_LOG.md`, then stop.

## 1. Orient

Run `npm run queue`. It refreshes `origin/main` and reports where the loop stands. Branch on its
exit code and do not go further than it allows:

- **4** — report which previous entry is blocking, then stop. Do not stack an entry on unmerged
  work; entries routinely overlap in the files they touch.
- **5** — report the entry left `In progress`, then stop. Resetting it is a human decision.
- **3** — report "queue empty — no Todo entries", then stop. Do not invent work, redo a `Done`
  entry, or reopen anything. Refilling is a separate `$road-to-send-refill` run.
- **0** — continue with the entry named on the `next:` line.

Run `git status --short` before switching branches. If the worktree contains changes that do not
belong to this run, stop and report them instead of overwriting or carrying them forward.

Start from the latest `origin/main`, never local `main`:

`git switch -C codex/entry-<N>-<slug> origin/main`

Read the rules block at the top of `IMPROVEMENT_LOG.md` in full, then read the selected entry.

## 2. Clear the finished entry first

If `npm run queue` printed `archive-due:`, apply rule 10 before implementation. Move that entry,
from its heading through its `---` separator, **verbatim** into the current archive file and remove
its index line. Verify that the block appears exactly once in the archive, is gone from the live
log, starts at the beginning of its own line, and did not split the entry above it.

## 3. Implement

- Set `Status: In progress — <today>` as the first edit.
- Do exactly what the entry's `### Requirements` requires and nothing its `### Do not` forbids.
- Honor explicit rule 2 or rule 8 carve-outs in the entry. Without one, those rules are hard
  limits: edit only `src/app.js`, `src/index.template.html`, `src/styles.css`, and tests.
- Reuse the helpers the entry names. Never fork scoring math, call `new Date()` for challenge dates,
  add a localStorage key, add a dependency, or add a network request.
- Read the `TRAP` header in every test file before adding assertions to it.
- If the entry genuinely cannot be completed inside its rules, set
  `Status: Blocked — <reason>`, commit that status, and stop.

Keep the change narrow. Preserve unrelated user changes, and do not weaken or delete an assertion.

## 4. Verify

Run `npm run build`, then `npm test`. Read the complete `=== summary ===` block. If
`check:generated` fails, rerun `npm run build`; never edit `index.html` directly.

## 5. Ship

- Set `Status: Done — <today>` and update the queue index.
- Record the commit subject in `Notes:` exactly as ``Commit `<subject>`.`` Add deviations after it.
  `npm run queue` reads the subject to determine whether the entry merged.
- Inspect `git diff` and `git status`. Stage only this entry's files, including regenerated
  `index.html`. Put the implementation, status, notes, and archive/index maintenance in one commit.
- Push with `git push -u origin codex/entry-<N>-<slug>`.
- Open a draft pull request using the repository template. Prefer the connected GitHub tools when
  available; otherwise use `gh`.
- Check CI without pretending pending checks are green.

Report the entry number and title, pull-request URL, CI status, byte count before and after, and any
deviations. Then stop.
