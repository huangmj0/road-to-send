---
name: road-to-send-entry
description: Drive Codex through exactly one queued Road to Send improvement, verify it, and leave it uncommitted for the local review gates; or ship a reviewed batch when queue status returns 6. Use only when explicitly invoked for the serialized queue loop.
---

# Drive one queue entry

Codex writes the code through `scripts/codex-run.mjs`; this workflow builds the brief, verifies the
result, and leaves the diff uncommitted. Reviewers return findings only. The ship mode is the only
mode that commits or publishes.

## 1. Orient

Run `npm run queue` and obey the exit code: `0` works `next:`, `3` reports an empty queue, `4`
reports the held entry, `5` reports the stale `In progress` entry, and `6` jumps to ship mode. Do
not reset, clean, or change branches while an open batch is uncommitted.

Approved batch work is staged and the current entry stays unstaged. Require an empty ordinary
`git diff` before starting the next entry, while allowing `git diff --cached` to hold prior `Done`
entries. This index snapshot is how gate 1 sees one entry even when several remain uncommitted.

Read the full rules block and the selected entry. Archive only `archive-due:` entries that already
record a commit subject; unshipped `Done` entries are the open batch and stay in the log.

## 2. Build and dispatch the brief

Set the entry `In progress`. Put these in a temporary brief:

1. The entry's `Why`, `Requirements`, `Tests`, and `Do not` blocks verbatim.
2. The rules block and the tone rule.
3. `graphify query "<title and named helpers>" --budget 1500`, labelled as a locator rather than
   source code.
4. The `TRAP` header of each relevant test file.
5. The file-scope, generated-file, helper-reuse, data-safety, no-dependency, and no-commit limits.

Run `node scripts/codex-run.mjs --role entry --brief <file>`. Retry one bridge failure with
`entry-hard`; otherwise mark the entry blocked. Never edit `src/` or fix the diff by hand.

## 3. Verify and hand off locally

Run `npm run build`, `npm test`, and `node scripts/ui-scope.mjs`. A red suite goes back through
`--role fix --brief <file> --resume <CODEX session id>` before a reviewer is spent. Allow three fix rounds total.
An orchestrator must invoke this as explicit FIX mode with the entry, session, and complete
findings; FIX skips the normal queue gate so an expected `In progress` status cannot stop it.

Return only the fixed report requested by the orchestrator, including entry, Codex session, test
state, UI class, byte delta, deviations, and status. The orchestrator sends the uncommitted diff to
fresh pre-commit review and, for `major`, rendered design review. Feed findings back to Codex; after
all applicable local gates approve, invoke explicit APPROVE mode with the entry, verified summary,
and deviations. It changes only the entry bookkeeping and queue index, records no commit subject,
stages the complete approved state as the next entry's baseline, and leaves the tree uncommitted.

## 4. Ship mode

Only on exit `6` or an explicit `--ship` request, archive every previously shipped `archive-due:`
entry and create the controlled branch at the batch's current base so the dirty index is preserved.
Archive every entry in this batch in the same commit, and update
each `Notes:` line with the exact batch commit subject before moving its block verbatim.

Create exactly one commit whose subject names the batch and whose body lists every entry, then
rebase that commit onto current `origin/main` and rerun the full suite. Stop on conflicts and require
the result to remain one commit directly atop `origin/main`. Publish
only with `node scripts/queue-git-guard.mjs publish <N> <HEAD> <SUBJECT>`, open a draft PR, and mark
it ready for review only after local tests and every CI check are green. Never merge it or approve it; the fresh
PR reviewer and drain's guarded release own gate 2.

For published PR findings, require explicit PR-FIX mode with the PR, old head, and complete
findings. Ask Codex to fix the batch, rebuild and retest, stage only permitted paths, amend the one
commit, and publish only through `queue-git-guard.mjs amend`. A fresh reviewer must judge the new
head; PR-FIX never releases it.
