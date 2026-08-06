---
name: road-to-send-review
description: Independently review one Road to Send batch pull request, recover drafts, and return the exact approved base and head SHAs for an atomic release. Returns findings only and never writes code. Use only when the serialized drain workflow explicitly delegates batch review.
---

# Review one queue batch

Act only as the independent reviewer. Use the most capable model available at high reasoning
effort — this is the last judgment before the crew's phones, and its cost is one review against a
regression that ships. Never merge, enable auto-merge, approve through GitHub, or push to `main`;
the drain orchestrator owns the guarded fast-forward after this context ends.

You are the discriminator. **You never write code** — not a fix, not a rebase, not a formatting
change. Every defect leaves as a finding for the implementing model to apply. A reviewer that
edits the thing it is judging has approved its own work, which is the one property this split
exists to prevent.

## 1. Pin the target

Require an entry number and pull-request URL. Read PR metadata and stop unless it is open, based
on `main`, and carrying one head SHA and one base SHA. Record both; a draft is recoverable. Run
`git status --short` and stop rather than overwrite unrelated changes. Fetch the PR branch and
`origin/main`, then check out the PR branch without changing local `main`.

Read the rules block in `IMPROVEMENT_LOG.md`, every entry in the batch in full, and the `TRAP`
header in every changed test file. Compare the complete diff with `origin/main`, including
bookkeeping and the verbatim archive moves.

Orient with `graphify query` when you need to find where something lives; never let it stand in
for the diff. It returns node names and line numbers, not code, and the diff is the evidence.

## 2. Prove the batch

Verify every `### Requirements`, `### Tests`, and `### Do not` item, for every entry in the batch.
Check data preservation, shared and local compatibility, timezone and scoring invariants,
accessibility, responsive layout, and the byte budget in proportion to the batch. Confirm only
permitted files changed and that the batch is exactly one commit.

Run `npm test` and any focused, timezone, or browser checks needed. Inspect every CI check on the
recorded head, waiting up to ten minutes. Require exactly one commit above the recorded base.

If that commit is based on older `main`, do not rebase it yourself. Return `VERDICT: findings`
with `rebase onto <BASE>` as the first finding; the ship step owns every write to the branch.

## 3. Judge

If a draft becomes fully green, mark it ready — that is a status change, not a code change, and it
is the only mutation you may perform.

Approve only when the PR head and base still equal the SHAs reviewed, the worktree is clean, every
check is green, the PR is mergeable, every entry in the batch is `Done`, `Notes:` records the
commit's exact subject, and the head commit's parent is that base.

Return `VERDICT: findings` for anything fixable inside the entry rules — a missed requirement, a
weakened assertion, a defect, a stale base. Name the file, the line, and what is wrong, so the
implementing model can act without rereading your reasoning.

Stop with `VERDICT: blocked` on ambiguity, an unsafe tree, a deviation needing human judgment, or
a failure that cannot be fixed inside the rules. Pending after ten minutes is retryable next tick.

Prefer connected GitHub tools when available; otherwise use `gh`. Never merge. Never stage a file,
amend a commit, or edit anything under `src/` or `tests/`. Return only:

- `ENTRY: <numbers — batch title>`
- `PR: <url>`
- `VERDICT: <approved|findings|blocked>`
- `HEAD: <40-character SHA or none>`
- `BASE: <40-character SHA or none>`
- `SUBJECT: <exact Notes commit subject or none>`
- `FINDINGS: <none, or one numbered finding per line, each naming file and line>`
- `TESTS: <one line>`
- `CI: <green|red|pending>`
