# Running the improvement loop

`IMPROVEMENT_LOG.md` is a queue. A loop drains it — one entry per invocation, one entry per commit,
one entry per pull request.

**The prompt itself lives in `.claude/commands/entry.md`**, not here. This file is the operator's
guide to running it. Keeping the prompt in exactly one place is deliberate: a second copy is a
second thing to drift, which is the same reason `CLAUDE.md` refuses to restate the rules block.
`tests/docs-check.mjs` asserts this file carries no fenced block, so the copy cannot creep back.

## Usage

Run `/loop /drain` with dynamic pacing. `/drain` is one loop tick: it checks the queue, hands the
actual work to a subagent, and picks the next wake-up. To work a single entry by hand instead, run
`/entry` directly — it does exactly one entry and stops.

Prefer dynamic pacing or a long interval. Every iteration is a real feature commit awaiting review,
so a short interval mostly wakes into "the previous pull request is still open". That is harmless —
the first thing either command does is check — but it is wasted work.

## Why the loop delegates

`/loop` fires into the **same session**, so everything an iteration reads stays in context for
every iteration after it. Worked inline, one entry costs tens of thousands of tokens — `src/app.js`
alone is 78 KB — and a handful of them exhaust the window. That is the same rot the split test
suites and the split archive were meant to stop, arriving by a different route.

So `/drain` reads almost nothing. It runs `npm run queue`, branches on the exit code, and delegates
the entry itself to a subagent that starts cold and dies when it finishes, reporting back six
fixed lines: entry, PR, CI, bytes, deviations, status. Those six lines are all the orchestrator
keeps, which is what lets one session run many iterations.

`/drain` delegates by naming the `entry` and `refill` skills rather than restating them, so the
loop body still lives in exactly one place. `tests/docs-check.mjs` asserts it names both.

## When the queue runs dry

On exit 3, `/drain` runs `/refill` in a subagent — but only after checking that no queue proposal
is already open, since a refill PR has to be merged by a human before any entry can run and two
open proposals cannot both land. It tells you the PR is waiting, then idles on a long interval and
resumes on its own once you merge. It never proposes a second queue.

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
- **The loop body** — `.claude/commands/entry.md`.
