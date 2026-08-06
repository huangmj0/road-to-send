---
name: road-to-send-drain
description: Run one context-light Road to Send queue tick: implement one local entry through independent review, or ship and release one reviewed batch. Use only when explicitly invoked to operate the serialized loop.
---

# Drain one queue tick

Stay orchestration-only: do not read source, inspect a diff, or judge implementation here. Codex
writes through `scripts/codex-run.mjs`; fresh Claude reviewers judge; the git guard alone releases.

## 1. Branch on queue state

Run `npm run queue`. On `0`, drive exactly the named entry. On `6`, ship the accumulated batch. On
`3`, report `queue complete — no Todo entries`. On `4`, recover the exact held PR from the `hold:`
record. On `5`, stop on the stale entry. Never start a second entry in this tick.

## 2. Local gate

Spawn exactly one `$road-to-send-entry` driver and retain only its fixed report. It briefs Codex, runs the build
and tests, classifies UI scope, and leaves the diff uncommitted. When green, send the entry number
and local diff to a fresh findings-only pre-commit reviewer. Feed `findings` back to Codex through
the driver, then use a fresh reviewer. For a diff-derived `major` UI class, also send the rendered
app to a fresh design reviewer at mobile and desktop widths. Three fix rounds total are allowed;
then mark the entry blocked and stop.

Only after every applicable local gate returns `approved` may the driver mark the entry `Done`.
That means locally reviewed, not shipped, and no commit is created.

## 3. Ship and PR gate

Queue exit `6` means the declared `BATCH_MIN` threshold was met or shipping was forced. Delegate
ship mode: archive the batch, create exactly one commit directly atop current `origin/main`, publish
through `queue-git-guard.mjs`, open a draft PR, and wait for green CI before making it ready.

Send the batch PR to a fresh findings-only `$road-to-send-review` reviewer. On findings, Codex fixes the branch, the
ship step amends the single commit and runs `queue-git-guard.mjs amend`, and a new reviewer judges
the new base/head. Discard every prior head and base SHA. Allow three PR review passes.

For recovery on exit `0`, search open `codex/entry-<N>-*` and `claude/entry-<N>-*` heads before
starting local work; one candidate, whether ready or draft, proceeds to independent review, zero
continues locally, and ambiguity stops. Never create a duplicate PR. On exit `4`, consume the
machine-readable `hold:` JSON object. Use its entry, ref, and subject — never `archive-due:` or title
text. Strip the single leading `origin/` before comparing a remote-tracking ref to GitHub's head
name. A missing or mismatched value stops recovery.

## 4. Guarded release

Continue only with `VERDICT: approved`, green CI, exact 40-character `BASE` and `HEAD`, and the
recorded non-empty subject. Re-read PR metadata and require an open, non-draft, clean, same-repo PR
whose one commit is the sole child of `BASE` and whose checks are green.

Run `node scripts/queue-git-guard.mjs release <PR> <ENTRY> <BASE> <HEAD> <SUBJECT>`. Never force,
fall back to `gh pr merge`, or approve a head a reviewer changed. A moving base requires fresh
review. Verify `origin/main` equals the released head and stop after this single tick.

Independence is model/context separation, not GitHub identity separation: all steps currently use
one GitHub account, so do not represent this as a distinct-account approval.
