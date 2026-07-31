---
description: Propose new Todo entries for IMPROVEMENT_LOG.md in a queue-only PR, then stop.
---

Refill `IMPROVEMENT_LOG.md` with new `Todo` entries, then stop. **You are not implementing
anything in this run.**

## The one hard rule

The pull request you open changes **`IMPROVEMENT_LOG.md` and nothing else**. No `src/`, no
`index.html`, no tests. A run that both invents work and ships it has no gate on what gets built
into an app a real crew uses; that gate is a human reading the queue and merging it. Implementation
is a separate `/entry` run, after your PR merges.

## 1. Check that a refill is wanted

Run `npm run queue`. Refill only on exit code **3** (queue empty). On any other code, report what it
said and STOP — a queue with `Todo` entries left does not need more, and `4` or `5` mean something
is wrong that new entries would only bury.

Branch from the latest `origin/main`: `git checkout -B claude/queue-<N>-<N+k> origin/main`.

## 2. Read what constrains the entries

- The **rules block** at the top of `IMPROVEMENT_LOG.md`, in full. Every entry you write has to be
  implementable inside it — rules 2, 4, 5, 6, 7 and 8 are the ones that usually decide whether a
  proposal is legal.
- The **tone rule** further down the same file. It is binding on what you may propose, not just on
  how it is worded: surface what people did, never what they didn't; no nudges, reminders, or
  prompts to participate; a crew-wide participation figure is the same nudge with the names filed
  off; nothing new opens, appears, or speaks on its own; new information appears only where the
  user went looking for it.
- The **index in `IMPROVEMENTS.md`** — titles only, so you do not propose something already
  shipped. Do not read the pass files under `docs/archive/` unless a specific title looks like a
  collision and you need to check.
- `src/app.js` and `src/index.template.html`, to find gaps that are real. An entry that names a
  helper which does not exist wastes the iteration that picks it up.

## 3. Write the entries

Continue from the highest number ever used — **entry numbers never restart** and never get reused,
including for entries that were dropped. Six to twelve entries is a good pass.

Each entry follows the existing shape exactly:

- `## <N>. <Title>` — imperative, concrete, the user-visible change.
- `Status: Todo`
- `### Why` — the actual gap, in terms of what someone using the app cannot currently do.
- `### Requirements` — the binding spec. Name the files, the existing helpers to reuse, and where
  the new surface sits relative to existing DOM ids. This is the only place an entry may carve
  itself out of rules 2 or 8; grant a carve-out only when the entry is genuinely impossible without
  one, and say why in the entry.
- `### Tests` — which suite gets which assertions: `tests/client-state.state.test.js` for pure
  helpers, `.dom.test.js` for anything needing `render()`, `.shared.test.js` for shared mode,
  `tests/static-check.mjs` for presence, order and aria-*.
- `### Do not` — the specific prohibitions, including whichever part of the tone rule binds it.
- `---` separator.

Add an index line for each under `## Queue index`, and keep the file's existing ordering.

**Sequence matters.** If one entry depends on a helper another introduces, or two entries touch the
same DOM region, put them in an order that works when drained top to bottom, and say so in the
later entry's `### Requirements`. The loop does not reorder.

Keep each entry small enough to be one commit. Watch the aggregate byte cost against the `BUDGET`
in `tests/size-check.mjs` — `npm run queue` and `npm test` both report where `index.html` currently
sits. If the pass plausibly exceeds it, make the first entry a deliberate re-baseline of `BUDGET`
that explains the growth, as entries 23 and 24 did.

## 4. Ship the proposal

- `npm test` — `docs-check.mjs` validates every `Status:` line, the queue index and the archive
  invariants, so it catches a malformed entry now rather than in the iteration that picks it up.
- `npm run queue` should now report your first entry on the `next:` line.
- Commit, `git push -u origin claude/queue-<N>-<N+k>`, open a **draft** PR that lists the proposed
  entries and flags any carve-out you granted or budget you re-baselined.
- Promote it to **ready for review** — `update_pull_request` with `draft: false`, or `gh pr ready` —
  once `npm test` passed every suite, `git diff --name-only` against `origin/main` shows
  `IMPROVEMENT_LOG.md` and nothing else, `npm run queue` names your first entry, and CI on the
  pushed head commit concluded successfully. Give the checks up to ten minutes to conclude; if they
  are still pending, or any of those four is not true, leave it a draft and say which one.
- **Never merge it**, and never enable auto-merge. A human reading this queue and merging it is the
  gate on what gets built at all; marking it ready is as far as you go.
- Report the PR URL, the entry range, and whether the PR is ready for review or still a draft. Then
  stop. Do not start `/entry` — that is the next run, after a human merges this.
