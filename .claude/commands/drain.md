---
description: One autonomous loop tick — implement one entry through the local gates, or ship and release a ready batch.
model: sonnet
effort: medium
---

You are the loop orchestrator. Stay small. Do not read `src/`, tests, or diffs; do not edit files,
run build/test, implement, or review inline. Fresh subagents own those contexts. Never enable
auto-merge. Your only push to `main` is the exact non-force reviewed fast-forward in step 5.

A tick does **one** of two things: put one more entry through the local gates, or ship the batch
that has accumulated. Never both.

## 1. Check state

Run `npm run queue`, the only repository state read before branching:

- **0** — continue with the `next:` entry at step 2.
- **3** — report `queue complete — no Todo entries` and end. `/refill` is a separate deliberate
  design run; do not make a finite drain endless.
- **4** — parse the JSON object on `hold:` and recover that entry in step 4. Stop if it is absent,
  malformed, or lacks its recorded subject.
- **5** — report the stuck `In progress` entry and end. Resetting it is a human decision.
- **6** — the batch is substantial. Skip step 2 entirely and ship it at step 3.

Do not switch branches, reset, clean, or inspect source before this check. On exit 0, if
`batch:` already reports `BATCH_MAX` unshipped `Done` entries, treat it as exit 6 — the batch caps
the amount of uncommitted work at risk.

On exit 0, first list open PRs whose heads match the controlled `codex/entry-<N>-*` or
`claude/entry-<N>-*` prefix for `next:`. Exactly one candidate skips local implementation and goes
to step 4, whether draft or ready. Zero continues to step 2. Stop on multiple or mismatched
candidates. This recovers a published batch when `origin/main` still shows its first entry Todo.

## 2. Gate 1 — implement one entry locally

Spawn exactly one `queue-entry` agent and wait. Never run entry agents in parallel. It drives
Codex through `scripts/codex-run.mjs`, verifies, and leaves the work **uncommitted**.

```
Agent(
  subagent_type: "queue-entry",
  run_in_background: false,
  description: "Work one queue entry",
  prompt: "Invoke the `entry` skill. ENTRY: <replace with actual entry number and title>. Return its seven fixed report lines only."
)
```

- `ENTRY: <number> — <title>`
- `CODEX: <ok|failed> <session id or none>`
- `TESTS: <green|red>`
- `UI: <none|minor|major>`
- `BYTES: <before> -> <after>`
- `DEVIATIONS: <one line or none>`
- `STATUS: <implemented|blocked|stopped>`

Stop on blocked, stopped, red tests, or a deviation. On `implemented`, review it:

```
Agent(
  subagent_type: "queue-precommit-review",
  run_in_background: false,
  description: "Review one uncommitted entry diff",
  prompt: "Invoke the `precommit-review` skill. ENTRY: <replace with actual entry number and title>. Return its five fixed report lines only."
)
```

On `VERDICT: findings`, spawn a fresh `queue-entry` driver in **FIX** mode with the concrete entry,
the `CODEX` session id retained from its report, and the reviewer's complete `FINDINGS`. It skips
queue orientation, resumes Codex, rebuilds, and retests. Then re-review from a **fresh**
`queue-precommit-review`, discarding the previous report. Allow at most three fix rounds per entry;
a third sets the entry `Blocked` and ends the tick.

When the entry agent reports `UI: major`, spawn `queue-design-review` after gate 1 approves, and
treat its findings the same way — Codex fixes, fresh reviewer re-reads:

```
Agent(
  subagent_type: "queue-design-review",
  run_in_background: false,
  description: "Design-review one major UI change",
  prompt: "Invoke the `design-review` skill. ENTRY: <replace with actual entry number and title>. Return its five fixed report lines only."
)
```

On `VERDICT: approved` from every gate that applies, spawn `queue-entry` once in explicit
**APPROVE** mode with the concrete entry, verified summary, and deviations. It updates only that
entry's `Status: Done`, `Notes:`, and queue index. The work stays uncommitted and joins the batch.
Rerun `npm run queue`: exit 0 means another entry is available next tick, exit 6 means the batch
is ready to ship.

## 3. Ship the batch

Only on exit 6. Spawn one `queue-entry` agent in ship mode; it squashes every unshipped `Done`
entry into **one** commit, performs the rule-10 archive move for each of them, publishes through
`node scripts/queue-git-guard.mjs publish <N> <HEAD> <SUBJECT>`, and opens a draft PR that it
marks ready once CI is green. It never merges.

Require a valid PR URL and `STATUS: shipped` before continuing. Stop otherwise.

## 4. Gate 2 — independently review the batch PR

On exit 4, use the entry, ref, and subject from machine-readable `hold:`, never `archive-due:` or
title text. Strip the single leading `origin/` from `hold.ref` before comparing it with GitHub's
`headRefName`. If `ref` is non-null require that exact normalized PR head; otherwise use the
controlled entry prefix. Require the commit subject to match `hold:`.

Exactly one open candidate is recovered and skips implementation, whether ready or draft; a
recovered draft proceeds to independent review rather than stalling. Stop on multiple candidates,
a mismatched entry number, or ambiguity; never create a duplicate PR.

Spawn one `queue-review` agent at a time with only the entry numbers and PR URL.

```
Agent(
  subagent_type: "queue-review",
  run_in_background: false,
  description: "Review one queue batch PR",
  prompt: "Invoke the `review` skill. ENTRY: <replace with actual entry number and title>. PR: <replace with actual PR URL>. Return its nine fixed report lines only."
)
```

On `VERDICT: findings`, discard every prior head and base SHA. Spawn `queue-entry` in explicit
**PR-FIX** mode with the PR, `OLD_HEAD`, and complete findings. It sends the batch brief to Codex,
amends the single commit, and runs
`node scripts/queue-git-guard.mjs amend <PR> <OLD_HEAD> <NEW_HEAD>`, then review again from a
fresh agent. Allow at most three review passes per tick. Stop on blocked, red or pending CI, a
malformed report, or a third consecutive round. Continue only for `VERDICT: approved`,
`CI: green`, 40-character `HEAD` and `BASE` SHAs, and a non-empty exact `SUBJECT` from `Notes:`.

## 5. Guard and merge

Immediately re-read PR metadata and require it to be open, non-draft, based on `main`, cleanly
mergeable, still at the approved `HEAD` and `BASE`, and green on every check. Require exactly one
commit whose parent is `BASE`, the entry number and subject to match, and no unsatisfied approval
requirement. Any change invalidates review.

Run `node scripts/queue-git-guard.mjs release <PR> <ENTRY> <BASE> <HEAD> <SUBJECT>` with safely
quoted values. The deterministic guard re-reads GitHub state and validates green checks, entry
branch, subject, one-commit parentage, base, and head before its exact non-force fast-forward. If
`main` advances, Git rejects it atomically. Never bypass the guard or fall back to `gh pr merge`.

Fetch `origin/main`, require it to equal `HEAD`, verify the PR is merged, and rerun `npm run queue`.
Success is exit 0 for the next entry or exit 3 for a complete queue. Never start a second entry.

## 6. Report and pace

Stay silent after a clean gate-1 pass or a clean reviewed merge. Report only blocked/stopped work,
draft or red checks, three non-converging rounds at either gate, a merge-guard failure, exit 5, a
repeated entry, a bundle above 95% of budget, or queue completion.

Under `/loop`, reschedule after 120–300 seconds. End on completion, exit 5, stopped work, repeated
entries, or a merge-guard failure. Never poll in the foreground.
