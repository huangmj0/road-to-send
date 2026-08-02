---
description: Independently review one ready queue-entry PR and return its exact approved head.
model: opus
effort: high
---

Review exactly one Road to Send entry pull request. Require its entry number and PR URL.

## 1. Pin the target

Read the PR metadata and stop unless it is open, based on `main`, and has one head SHA and base SHA.
Record both; a draft is recoverable. Run `git status --short`; stop rather than overwrite unrelated
changes. Fetch the PR branch and `origin/main`, then check out the PR branch without changing local
`main`.

Read the rules block in `IMPROVEMENT_LOG.md`, the named entry in full, and the `TRAP` header in every
changed test file. Compare the complete diff with `origin/main`, including bookkeeping and the
verbatim archive move.

## 2. Prove the entry

Verify every `### Requirements`, `### Tests`, and `### Do not` item. Check data preservation,
shared/local compatibility, timezone and scoring invariants, accessibility, responsive layout, and
the byte budget in proportion to the entry. Confirm only permitted files changed and one entry
remains one commit.

Run `npm test` and any focused, timezone, or browser checks needed. Inspect every CI check on the
recorded head, waiting up to ten minutes. Require exactly one entry commit above the recorded base.
If the sole commit is based on older `main`, rebase it onto the recorded base, rerun `npm test`,
then invoke `node scripts/queue-git-guard.mjs amend <PR> <OLD_HEAD> <NEW_HEAD>`
with safely quoted values. Wait for checks on the new head and return `VERDICT: fixed`; a fresh
reviewer must inspect the rebased integration.

## 3. Fix or approve

Fix a concrete defect only inside the entry rules. Use `npm run build` after a `src/` edit, rerun
`npm test`, inspect the changed filenames, stage only explicit permitted paths with
`git add -- <paths>`, and verify the staged diff. Preserve the single entry commit with
`git commit --amend --no-edit`, then invoke the guarded amend script instead of a raw force-push.
Wait for every check on the new head. Return `VERDICT: fixed`; never approve a head you changed.
`/drain` must send the new head to a fresh reviewer.

If a draft becomes fully green, mark it ready. Approve only when the PR head and base still equal
the SHAs reviewed, the head commit's parent is that base, the worktree is clean, all checks are
green, the PR is mergeable, the entry is `Done`, and `Notes:` records the commit's exact subject.
Stop with `VERDICT: blocked` on ambiguity, an unsafe tree, a deviation needing judgment, or a
failure that cannot be fixed inside the rules. Pending after ten minutes is retryable next tick.

Never merge, enable auto-merge, approve through GitHub, or push to `main`. Return only:

- `ENTRY: <number> — <title>`
- `PR: <url>`
- `VERDICT: <approved|fixed|blocked>`
- `HEAD: <40-character SHA or none>`
- `BASE: <40-character SHA or none>`
- `SUBJECT: <exact Notes commit subject or none>`
- `FINDINGS: <one line or none>`
- `TESTS: <one line>`
- `CI: <green|red|pending>`
