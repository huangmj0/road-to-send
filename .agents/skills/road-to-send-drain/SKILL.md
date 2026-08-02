---
name: road-to-send-drain
description: Run one context-light Road to Send queue tick by implementing or recovering exactly one entry PR, delegating independent review, and atomically fast-forwarding only the exact approved base and head. Use only when explicitly invoked to operate the serialized agentic improvement loop.
---

# Drain one queue tick

Act only as the loop orchestrator. Stay small. A mid-tier model at moderate reasoning effort is
enough: write-heavy implementation and high-judgment review live in fresh subagents whose contexts
die when they finish.

Do not read `src/`, open tests, edit files, run the build or test suite, or review a diff here. Never
enable auto-merge. The only push to `main` this orchestrator may perform is the exact, non-force,
reviewed fast-forward in step 4.

## 1. Check state

Run `npm run queue`. This is the only repository state to read before branching on its exit code:

- **0** — continue to step 2 with the entry named on `next:`.
- **3** — report `queue complete — no Todo entries` and stop. Refill is a separate, explicitly
  invoked design workflow; do not turn a finite drain into an endless loop.
- **4** — parse the JSON object on `hold:` and recover that entry in step 2. Stop if it is absent,
  malformed, or lacks its recorded subject.
- **5** — report the entry stuck `In progress` and stop. Resetting it remains a human decision.

Do not switch branches, reset, clean, or inspect source before this check.

## 2. Obtain one ready entry PR

Before spawning implementation on exit 0, list open PRs and look for head refs matching the
controlled `codex/entry-<N>-*` or `claude/entry-<N>-*` prefix for `next:`. This recovery check is
mandatory after a reset: `origin/main` can still say `Todo` while a ready PR already carries the
entry's `Done` state. On exit 4, use the entry, ref, and subject from the machine-readable `hold:`
object, never `archive-due:` or title text. Strip the single leading `origin/` from `hold.ref` before
comparing it with GitHub's `headRefName`. If `ref` is non-null, require the PR head to equal that
normalized ref; otherwise use the controlled entry prefix. Require its commit subject to match
`hold:`.

Zero candidates on exit 0 means implementation may start. Exactly one open candidate means recover
it and skip implementation, whether ready or draft; review can repair red work and promote a green
draft. Stop on multiple candidates, a mismatched entry number, or any ambiguity; never create a
duplicate PR.

When no candidate exists on exit 0, **Spawn exactly one** fresh implementation subagent at high
reasoning effort and wait.
Never run entry agents in parallel. Give it this task:

> Invoke `$road-to-send-entry` and follow it exactly from start to finish. Return only seven lines:
> `ENTRY: <number> — <title>`, `PR: <url or none>`, `CI: <green|red|pending>`,
> `REVIEW: <ready|draft — reason>`, `BYTES: <before> -> <after>`,
> `DEVIATIONS: <one line or none>`, and `STATUS: <shipped|blocked|stopped>`. Do not include diffs,
> file contents, test output, or the PR body.

Continue for `STATUS: shipped`, a valid PR URL, and `DEVIATIONS: none`. A draft, red, or pending PR
still proceeds to independent review for recovery. Stop on `blocked`, `stopped`, no PR, or a
deviation. A recovered PR also proceeds directly to review.

## 3. Delegate independent review

Spawn one fresh review subagent at a time, using the most capable available model at high reasoning
effort, and wait. Give it only the entry number and PR URL:

> Invoke `$road-to-send-review` for this entry and PR, and follow it exactly. Return only its nine
> fixed report lines. Do not include diffs, file contents, test output, or the PR body.

If it returns `VERDICT: fixed`, discard every prior head and base SHA and delegate the updated PR to a second
fresh reviewer. Allow at most three review passes in one tick. A reviewer may never approve a head
it changed. Stop on `blocked`, red or pending CI, a malformed report, or a third consecutive fix.

Continue only when a fresh reviewer returns `VERDICT: approved`, `CI: green`, 40-character `HEAD`
and `BASE` SHAs, and the exact non-empty `SUBJECT` recorded in the entry's `Notes:` line.

## 4. Guard and merge

Immediately re-read PR metadata. Require all of the following on the same request:

- the PR is open, non-draft, based on `main`, and cleanly mergeable;
- its head and base SHAs exactly equal the reviewer's `HEAD` and `BASE`;
- the head contains exactly one entry commit and that commit's sole parent is `BASE`;
- every check run on that head concluded successfully;
- the entry number and subject match the review report; and
- there is no approval requirement the authenticated account cannot satisfy.

If any value changed, do not release; send the new base and head through fresh review on a later tick.

Run `node scripts/queue-git-guard.mjs release <PR> <ENTRY> <BASE> <HEAD> <SUBJECT>`, passing each
value as a safely quoted argument. The deterministic guard re-reads GitHub state and validates
green CI, entry branch, subject, one-commit parentage, base, and head before its exact non-force
fast-forward. If `main` advances, Git rejects it atomically; never bypass the guard, force the push,
or fall back to `gh pr merge`.

Fetch `origin/main`, require it to equal `HEAD`, verify the PR reports merged, and rerun
`npm run queue`. Success is `0` for the next entry or `3` for a complete queue. Do not start another
entry in this tick.

## 5. Report only actionable state

Stay silent after a clean reviewed merge. Speak only for a blocked/stopped implementation, a draft
or red check, a review defect that did not converge in three passes, a merge guard failure, exit 5,
a repeated entry number, or a bundle crossing 95% of its budget. Report queue completion once.

One invocation performs one tick and never sleeps or polls. An outer runner owns the next tick; a
two-to-five-minute cadence is appropriate now that no human merge wait remains.
