---
name: road-to-send-review
description: Independently review one Road to Send queue-entry pull request, recover drafts, rebase or fix one-commit entries, and return the exact approved base and head SHAs for an atomic release. Use only when the serialized drain workflow explicitly delegates review of an entry PR.
---

# Review one queue entry

Act only as the independent reviewer. Use the most capable model available at high reasoning effort.
Never merge, enable auto-merge, approve through GitHub, or push to `main`; the drain orchestrator owns
the guarded fast-forward after this context ends.

## 1. Pin the target

Require an entry number and pull-request URL. Read PR metadata and stop unless it is open, based on
`main`, and has exactly one head SHA and base SHA. Record both before reading the diff; a draft is
recoverable, not a reason to duplicate the PR. Run `git status --short`; stop rather than overwrite
unrelated changes. Fetch the PR branch and `origin/main`, then check out the PR branch without
changing local `main`.

Read the rules block in `IMPROVEMENT_LOG.md` and the named entry in full. Read the `TRAP` header in
every changed test file. Compare the complete diff with `origin/main`, including bookkeeping and the
verbatim archive move.

## 2. Review the implementation

Verify every `### Requirements`, `### Tests`, and `### Do not` item. Check data preservation,
shared/local compatibility, timezone and scoring invariants, accessibility, responsive layout, and
the byte budget in proportion to the entry. Confirm the diff contains only files the entry permits,
plus regenerated `index.html`, and that one entry remains one commit.

Run `npm test` and any focused, timezone, or browser checks needed to prove the entry rather than
merely exercise it. Require exactly one entry commit above the recorded base. If the sole commit is
based on an older `main`, rebase it onto the recorded base and rerun `npm test`. Record the old and
new head SHAs, then run `node scripts/queue-git-guard.mjs amend <PR> <OLD_HEAD> <NEW_HEAD>` with
safely quoted arguments. Wait for checks on the new head and return `VERDICT: fixed`; a fresh
reviewer must inspect the rebased integration.

Inspect every CI check on the recorded head. Give pending checks up to ten minutes using the
available wait mechanism. Pending after that is retryable on a later drain tick, not permission to
approve.

## 3. Fix or approve

If a concrete defect exists, fix only that defect with `apply_patch`, run `npm run build` after any
`src/` edit, and rerun `npm test`. Inspect the changed filenames, stage only the explicit permitted
paths with `git add -- <paths>`, and confirm the staged diff contains the fix and nothing else.
Preserve one-entry/one-commit history with `git commit --amend --no-edit`, then invoke
`node scripts/queue-git-guard.mjs amend <PR> <OLD_HEAD> <NEW_HEAD>` instead of a raw force-push.
The guard permits only a lease update of the PR's controlled entry branch. Wait for every check on the new head to succeed. Return
`VERDICT: fixed`; never approve a head you changed. The drain must discard the old SHAs and delegate
the new head to a fresh reviewer.

If the PR is still a draft after all local and remote checks pass, mark it ready. Approve only when
the PR head and base still equal the SHAs reviewed, the sole head commit's parent is that base, the
worktree is clean, all checks are green, the PR is mergeable, the entry is `Done`, and its `Notes:`
line records the commit's exact subject. Return that subject verbatim.

Stop with `VERDICT: blocked` on ambiguous scope, a deviation requiring judgment, unsafe worktree
state, red or pending checks, or any failure you cannot fix inside the entry rules.

Return only these nine lines:

`ENTRY: <number> — <title>`
`PR: <url>`
`VERDICT: <approved|fixed|blocked>`
`HEAD: <40-character SHA or none>`
`BASE: <40-character SHA or none>`
`SUBJECT: <exact Notes commit subject or none>`
`FINDINGS: <one line or none>`
`TESTS: <one line>`
`CI: <green|red|pending>`
