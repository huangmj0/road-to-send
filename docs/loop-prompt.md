# Running the improvement loop

`IMPROVEMENT_LOG.md` is a queue. A loop drains it — one entry per invocation, one entry per commit,
one entry per pull request.

The executable workflows do not live here. Claude Code uses `.claude/commands/`; Codex uses the
repository skills under `.agents/skills/`. This file is the shared operator guide. Keeping full
prompts out of the guide is deliberate: another embedded copy is another thing to drift, which is
the same reason `CLAUDE.md` and `AGENTS.md` point to the authoritative rules block rather than
restating it. `tests/docs-check.mjs` asserts this file carries no fenced prompt.

## Usage

In Claude Code, run `/loop /drain` with dynamic pacing. `/drain` is one loop tick. To work a single
entry by hand, run `/entry`.

In Codex, invoke `$road-to-send-drain` for one context-light tick or `$road-to-send-entry` to work
one entry directly. Codex's drain skill never sleeps: an outer automation, scheduler, or human
operator owns the next tick. Invoke `$road-to-send-refill` directly only when you intentionally want
to propose the next queue.

Prefer dynamic pacing or a long interval. Every iteration is a real feature commit awaiting review,
so a short interval mostly wakes into "the previous pull request is still open". That is harmless —
the first thing either command does is check — but it is wasted work.

## How a run hands work back

Every run opens its pull request as a draft, because at that moment it has not finished checking
itself. It then checks: the full `npm test` summary, the diff confined to the files the entry was
allowed to touch, a clean worktree, the `Status:`/`Notes:` bookkeeping, and every CI check run on
the pushed commit. When all of that is green it marks the pull request **ready for review** — and
stops there.

So the draft flag reads as a signal rather than a formality. Ready means the run believes the change
is complete and CI agrees; still-a-draft means something did not pass, and the run says which thing
on the way out — a red suite, a check still pending after ten minutes, a deviation that needs a
ruling. Either way the loop never merges, never enables auto-merge and never approves. Reading the
diff and merging it is yours, and it is the only gate between this loop and an app a real crew is
using.

## Why the loop delegates

`/loop` fires into the **same session**, so everything an iteration reads stays in context for
every iteration after it. Worked inline, one entry costs tens of thousands of tokens — `src/app.js`
alone is 78 KB — and a handful of them exhaust the window. That is the same rot the split test
suites and the split archive were meant to stop, arriving by a different route.

So the drain workflow reads almost nothing. It runs `npm run queue`, branches on the exit code, and
delegates the entry itself to a subagent that starts cold and dies when it finishes, reporting back
seven fixed lines: entry, PR, CI, review, bytes, deviations, status. Those seven lines are all the
orchestrator keeps, which is what lets one session run many iterations.

Each drain implementation delegates by naming its own entry and refill workflow rather than
restating either one. `tests/docs-check.mjs` asserts both agent surfaces preserve that boundary.

## Which model runs which step

The three workflows are not equally hard, so they do not run on the same model. The split follows
where a mistake gets caught:

- **Refill — the most capable model, high effort.** This is the design step. Every entry it writes
  becomes a binding spec that a later run executes literally without re-litigating it, so a vague
  `### Requirements` block, a named helper that does not exist, or two entries colliding in the same
  DOM region each cost a full implementation iteration and a human review. It also runs rarely —
  once per drained queue, against six to twelve entries — so its cost amortises to almost nothing.
- **Entry — a mid-tier model, high effort.** It executes a spec a human already read and merged, and
  `npm test` catches what it gets wrong before anyone else sees it. The saving comes from the model
  tier, not from thinking less: effort stays high because the failures that matter here are the
  `TRAP` notes, the helper reuse and the full `=== summary ===` read, and those reward care.
- **Drain — a mid-tier model, medium effort.** It reads one exit code, delegates, keeps seven lines
  and picks a delay. It runs on every tick, so it is the largest cumulative cost and the least
  demanding work in the loop.

In Claude Code this is enforced twice, because there are two ways in. `.claude/agents/queue-entry.md`
and `queue-refill.md` pin the model and effort for the subagents `/drain` spawns, and the `model` and
`effort` frontmatter on `.claude/commands/entry.md`, `refill.md` and `drain.md` pins the same values
when a human invokes one directly.

Two files per workflow is two places to drift, so `tests/docs-check.mjs` holds them together: each
command pins a ranked model and an effort rather than inheriting the session's, each agent agrees
with its command on both, `/drain` spawns the two agents by name instead of `general-purpose`, and
refill outranks entry. Retuning a tier is a deliberate edit to both files — and if you retune the
one that makes refill the design step, the suite will tell you the rationale here, in `AGENTS.md`
and in both agent files needs rewriting with it.

Codex has no equivalent declarative field in `.agents/skills/*/agents/openai.yaml`, so the same
split is stated in prose at the top of each Codex skill. There it is guidance for the operator
choosing a model, not something the harness enforces.

## When the queue runs dry

On exit 3, the drain workflow delegates a refill — but only after checking that no queue proposal
is already open, since a refill PR has to be merged by a human before any entry can run and two
open proposals cannot both land. It tells you the PR is waiting, then stops or idles until the
outer runner invokes it again. It never proposes a second queue.

## What the loop branches on

`npm run queue` is the whole control surface. It refreshes `origin/main`, reports the queue in a
few lines, and exits with the code the loop acts on:

- `0` — a `Todo` entry is next, named on the `next:` line. Work it.
- `3` — queue empty. Run `/refill` to propose new entries, or stop.
- `4` — the previous entry is not on `origin/main` yet. Stop and wait for the merge; a long wakeup.
- `5` — an entry is stuck `In progress` from a run that died. Needs a human.

Run it by hand any time you want to know where things stand. `--no-fetch` reports against the local
ref; passing a path reads that file instead of the live queue, which is how the exit codes are
exercised in testing.

### Why exit 4 exists

Entries overlap in the files they touch — 17 and 18 both edited the today-card, 19 and 20 both
extended the same dialog-accessibility array in `tests/static-check.mjs` — so two open branches
conflict. An earlier version of this guard looked for an open PR from a branch named
`claude/entry-<N>-<slug>`. No branch in this repository's history has ever used that prefix, so it
matched nothing, and the loop was free to stack entries on unmerged work — which it did. Exit 4
instead asks git whether the previous entry's recorded commit subject is on `origin/main`. That
depends on no naming convention, so it cannot drift the same way.

This is why rule 10's `Notes:` format is load-bearing: the entry records ``Commit `<subject>`.``
and the next iteration reads it back.

## Refuelling

When the queue drains, `/refill` proposes new entries in a pull request that touches **only**
`IMPROVEMENT_LOG.md`. It never implements what it proposes — a human reads the queue and merges it,
and the next `/entry` picks it up. Keeping those two runs apart is the gate on what gets built into
an app real people use.

## Review the first iterations by hand

Read the diff on the first two pull requests a fresh queue produces before letting the loop run
unattended. An entry that reshapes the log, the test runner, or the rules is inherited by every
later iteration, so a bad one compounds.

## Where guidance lives

Guidance sits with the thing it governs, so an iteration reads only what its work touches:

- **The rules** — the numbered block at the top of `IMPROVEMENT_LOG.md`. Read in full, every entry.
- **Repository conventions** — `AGENTS.md`.
- **Harness traps** — a header comment in the test file they apply to, read only when editing it.
- **Claude Code workflows** — `.claude/commands/entry.md`, `refill.md`, and `drain.md`.
- **Codex workflows** — `.agents/skills/road-to-send-entry/`,
  `road-to-send-refill/`, and `road-to-send-drain/`.
