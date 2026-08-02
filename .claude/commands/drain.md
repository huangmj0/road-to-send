---
description: One autonomous loop tick — implement or recover one entry PR, review it, and guarded-fast-forward it.
model: sonnet
effort: medium
---

You are the loop orchestrator. Stay small. Do not read `src/`, tests, or diffs; do not edit files,
run build/test, implement, or review inline. Fresh subagents own those contexts. Never enable
auto-merge. Your only push to `main` is the exact non-force reviewed fast-forward in step 4.

## 1. Check state

Run `npm run queue`, the only repository state read before branching:

- **0** — continue with the `next:` entry.
- **3** — report `queue complete — no Todo entries` and end. `/refill` is a separate deliberate
  design run; do not make a finite drain endless.
- **4** — parse the JSON object on `hold:` and recover that entry in step 2. Stop if it is absent,
  malformed, or lacks its recorded subject.
- **5** — report the stuck `In progress` entry and end. Resetting it is a human decision.

Do not switch branches, reset, clean, or inspect source before this check.

## 2. Obtain one ready PR

Before implementing on exit 0, list open PRs for head refs matching the controlled
`codex/entry-<N>-*` or `claude/entry-<N>-*` prefix for `next:`. This is mandatory after a clean
reset, because `origin/main` may still say `Todo` while a ready PR already carries `Done`. On exit 4,
use the entry, ref, and subject from machine-readable `hold:`, never `archive-due:` or title text.
Strip the single leading `origin/` from `hold.ref` before comparing it with GitHub's `headRefName`.
If `ref` is non-null require that exact normalized PR head; otherwise use the controlled entry
prefix. Require the commit subject to match `hold:`.

Zero candidates on exit 0 permits implementation. Exactly one open candidate is recovered and
skips implementation, whether ready or draft; review may repair red work and promote a green draft.
Stop on multiple candidates, a mismatched entry number, or ambiguity; never create a duplicate PR.

When no candidate exists on exit 0, spawn exactly one `queue-entry` agent and wait. Never run entry
agents in parallel. Tell it to invoke the `entry` skill and return only:

```
Agent(
  subagent_type: "queue-entry",
  run_in_background: false,
  description: "Work one queue entry",
  prompt: "Invoke the `entry` skill and return its seven fixed report lines only."
)
```

- `ENTRY: <number> — <title>`
- `PR: <url or none>`
- `CI: <green|red|pending>`
- `REVIEW: <ready|draft — reason>`
- `BYTES: <before> -> <after>`
- `DEVIATIONS: <one line or none>`
- `STATUS: <shipped|blocked|stopped>`

Continue for shipped, a valid PR URL, and no deviations. A draft, red, or pending PR still goes to
review for recovery. Stop on blocked, stopped, no PR, or a deviation. A recovered PR goes directly
to review.

## 3. Independently review

Spawn one `queue-review` agent at a time with only the entry number and PR URL. Tell it to invoke
the `review` skill and return only its nine fixed lines.

```
Agent(
  subagent_type: "queue-review",
  run_in_background: false,
  description: "Review one queue entry PR",
  prompt: "Invoke the `review` skill. ENTRY: <replace with actual entry number and title>. PR: <replace with actual PR URL>. Return its nine fixed report lines only."
)
```

On `VERDICT: fixed`, discard every prior head and base SHA and send the updated PR to a fresh `queue-review`
agent. Allow at most three review passes per tick. Stop on blocked, red/pending CI, a malformed
report, or a third consecutive fix. Continue only for `VERDICT: approved`, `CI: green`,
40-character `HEAD` and `BASE` SHAs, and a non-empty exact `SUBJECT` from the entry's `Notes:`.

## 4. Guard and merge

Immediately re-read PR metadata and require it to be open, non-draft, based on `main`, cleanly
mergeable, still at the approved `HEAD` and `BASE`, and green on every check. Require exactly one
entry commit whose parent is `BASE`, the entry number and subject to match, and no unsatisfied
approval requirement. Any change invalidates review.

Run `node scripts/queue-git-guard.mjs release <PR> <ENTRY> <BASE> <HEAD> <SUBJECT>` with safely
quoted values. The deterministic guard re-reads GitHub state and validates green checks, entry
branch, subject, one-commit parentage, base, and head before its exact non-force fast-forward. If
`main` advances, Git rejects it atomically. Never bypass the guard or fall back to `gh pr merge`.

Fetch `origin/main`, require it to equal `HEAD`, verify the PR is merged, and rerun `npm run queue`.
Success is exit 0 for the next entry or exit 3 for a complete queue. Never start a second entry.

## 5. Report and pace

Stay silent after a clean reviewed merge. Report only blocked/stopped work, draft or red checks,
three non-converging review passes, a merge-guard failure, exit 5, a repeated entry, a bundle above
95% of budget, or queue completion.

Under `/loop`, reschedule a clean merge after 120–300 seconds. End on completion, exit 5, stopped
work, repeated entries, or a merge-guard failure. Never poll in the foreground.
