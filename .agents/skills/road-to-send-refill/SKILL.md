---
name: road-to-send-refill
description: Propose new Road to Send Todo entries after the improvement queue is empty, validate them, open a queue-only draft pull request, and mark it ready for review once its checks pass. Use only when explicitly invoked to refill IMPROVEMENT_LOG.md without implementing the proposals.
---

# Refill the improvement queue

Add new `Todo` entries to `IMPROVEMENT_LOG.md`, then stop. Do not implement any of them.

## Run this on the most capable model available

This is the loop's design step. Every entry written here becomes a binding spec that a later
`$road-to-send-entry` run executes literally, on a cheaper model, without re-litigating it — so a
vague `### Requirements` block, a named helper that does not exist, or two entries colliding in the
same DOM region each cost a full implementation iteration and two reviews. A refill runs once per
drained queue, against six to twelve entries, so the cost amortises to almost nothing. `docs/loop-prompt.md`
explains the split across all four workflows.

## Hard boundary

The pull request changes `IMPROVEMENT_LOG.md` and nothing else. A run that invents work and ships it
has no human gate on what reaches a live app. Implementation belongs in a later
`$road-to-send-entry` run after the queue proposal merges.

## 1. Confirm a refill is wanted

Run `npm run queue`. Continue only on exit code **3**. On any other exit code, report the queue
state and stop. Codes 4 and 5 require resolution; a queue with `Todo` entries does not need more.

Run `git status --short`. If unrelated changes exist, stop instead of carrying or overwriting them.

Branch from the latest `origin/main`:

`git switch -C codex/queue-<N>-<N+k> origin/main`

## 2. Read the constraints

Read:

- The complete rules block at the top of `IMPROVEMENT_LOG.md`, especially rules 2, 4, 5, 6, 7,
  and 8.
- The tone rule in the same file. Propose information people intentionally seek out; do not add
  nudges, reminders, crew-wide participation pressure, or unsolicited surfaces.
- Only the title index in `IMPROVEMENTS.md` to avoid repeating shipped work. Read a specific archive
  pass only when a title looks like a collision.
- `src/app.js`, `src/index.template.html`, and `src/styles.css` to verify each proposed gap and named
  helper is real. Use Graphify as a locator, then read the source it points to.

This is the only loop step that asks what the app should do. Reason from the real usage encoded in
the screens, Sheet-backed records, and frozen localStorage shapes: what people log, which mobile
surfaces carry the workflow, what they currently calculate or hunt for, and what is missing.
Propose features, views, UX improvements, and polish — not a pass made only of internal cleanup.

Every proposal must fit `src/app.js`, `src/index.template.html`, `src/styles.css`, and `tests/`.
Never propose contract-file changes (`src/apps-script.js`, `src/schema.json`, `src/scoring.json`),
build/tooling/dependency changes, moving root `index.html`, or a multi-entry epic. Those require
organizer coordination or broaden the loop beyond its safe frontend scope.

## 3. Write the entries

Continue from the highest number ever used. Never restart or reuse entry numbers. Propose six to
twelve entries when the codebase supports that many real, bounded improvements.

Follow the existing entry shape exactly:

- `## <N>. <Title>` — imperative, concrete, and user-visible.
- `Status: Todo`.
- `### Why` — a real capability gap.
- `### Requirements` — binding scope, files, helpers, and DOM placement. Grant a rule 2 or 8
  carve-out only when genuinely necessary, and explain why.
- `### Tests` — name the correct suite: state for pure helpers, DOM for render behavior, shared for
  shared mode, and static checks for presence, order, and accessibility.
- `### Do not` — specific prohibitions, including the applicable tone constraint.
- `---`.

Add every entry to `## Queue index` and preserve ordering. Sequence dependencies top to bottom and
state them in the later entry. Keep each entry independently implementable and bounded enough for
one local gate. Compare estimated
aggregate growth with `BUDGET` in `tests/size-check.mjs`; if the pass is likely to exceed it, make
the first entry a deliberate, explained re-baseline.

## 4. Ship only the proposal

- Run `npm test`.
- Run `npm run queue`; it should name the first proposed entry on `next:`.
- Confirm with `git diff --name-only` and `git status --short` that the worktree changes
  `IMPROVEMENT_LOG.md` and nothing else.
- Commit, push `codex/queue-<N>-<N+k>`, and open a draft pull request listing the proposals and any
  carve-out or budget re-baseline. Prefer the connected GitHub tools when available; otherwise use
  `gh`.
- Mark that pull request **ready for review** — `update_pull_request` with `draft: false`, or
  `gh pr ready` — once `npm test` passed every suite, the diff against `origin/main` covers
  `IMPROVEMENT_LOG.md` alone, `npm run queue` names your first entry, and every check run on the
  pushed head commit concluded successfully. Allow up to ten minutes for the checks. If they are
  still pending, or any of those four is untrue, leave it a draft and report which one.
- **Never merge it** and never enable auto-merge. A human reading the queue and merging it is the
  gate on what gets built at all.

Report the pull-request URL, entry range, and whether the pull request is ready for review or still a
draft, then stop. Do not invoke `$road-to-send-entry`.
