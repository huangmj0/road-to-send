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

Prefer dynamic pacing at two to five minutes. Each clean tick implements or recovers one entry PR,
sends it through independent review, fast-forwards the exact approved base and head, and stops. The short
gap keeps contexts isolated while letting GitHub finish updating `origin/main` before the next tick.

## How a run hands work back

Every entry run opens its pull request as a draft, because at that moment it has not finished
checking itself. It then checks the full `npm test` summary, permitted-file scope, clean worktree,
`Status:`/`Notes:` bookkeeping, and every CI check on the pushed commit. When green it marks the PR
**ready for review** and stops without merge authority.

So the draft flag reads as a signal rather than a formality. Ready means the run believes the change
is complete and CI agrees; still-a-draft means something did not pass, and the run says which thing
on the way out. Drain then creates a fresh high-effort review context. The reviewer checks the
binding entry line by line, runs the relevant verification, and returns the exact base SHA, head
SHA, and recorded commit subject. A reviewer that fixes or rebases the single entry commit stages
only permitted paths, amends it, and may not approve that head; drain sends it to a fresh reviewer.

Only drain may release, and only after proving the PR is open, non-draft, green, and still at the
reviewed base and head, with the sole entry commit directly atop that base. It then pushes that exact
SHA to `main` as a non-force fast-forward through `scripts/queue-git-guard.mjs`. The same guard
publishes only new one-commit entry branches and restricts reviewer force-with-lease updates to the
PR's controlled entry branch. A concurrent `main` change makes Git reject release atomically, so
the new base must be rebased and freshly reviewed. This separates implementation, review, and
release while allowing the loop to run without a human merge click.

Independence here is a fresh agent context: the approving reviewer neither implemented nor changed
the head it approves. All agents currently authenticate to GitHub as the same account, so this is
not a separate-identity GitHub approval and the workflow never claims it is. If identity-level
separation becomes a requirement, install a separately credentialed GitHub App or bot for review
and require its approval through branch protection before release.

## Why the loop delegates

`/loop` fires into the **same session**, so everything an iteration reads stays in context for
every iteration after it. Worked inline, one entry costs tens of thousands of tokens — `src/app.js`
alone is 78 KB — and a handful of them exhaust the window. That is the same rot the split test
suites and the split archive were meant to stop, arriving by a different route.

So the drain workflow reads almost nothing. It runs `npm run queue`, delegates implementation and
review to cold subagents, retains only their fixed reports, guards one merge, and stops. Source,
diff, and test-output context dies with the worker that needed it.

Before implementing the named entry, drain checks the controlled `codex/entry-<N>-*` and
`claude/entry-<N>-*` head prefixes for an already-open PR. That makes a fresh window recover work
left between ticks instead of duplicating it. Draft candidates are recoverable too: review may fix
red work or promote a now-green draft. The reviewer still validates the entry number, subject, diff,
base, and head; the prefix locates a candidate but never authorizes release.

Each drain implementation delegates by naming its entry and review workflows rather than restating
either one. `tests/docs-check.mjs` asserts both agent surfaces preserve that boundary.

## Which model runs which step

The four workflows are not equally hard, so they do not run on the same model. The split follows
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
- **Review — the most capable model, high effort.** This is the release judgment. It verifies the
  binding spec, adversarial cases, and exact head; a reviewer that changes the head cannot approve
  it, so fixes receive a fresh pass.
- **Drain — a mid-tier model, medium effort.** It reads queue and PR state, delegates, checks a fixed
  report, guards one merge, and picks a delay. It runs on every tick, so it stays context-light.

In Claude Code this is enforced twice, because there are two ways in. The `queue-entry`,
`queue-review`, and `queue-refill` agents pin their delegated tiers, and the command frontmatter on
`entry.md`, `review.md`, `refill.md`, and `drain.md` pins direct invocation to the same values.

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

On exit 3, drain reports `queue complete — no Todo entries` and ends. Refill is intentionally not
part of autonomous drain: otherwise “finish this queue” becomes an endless request to invent more
work. Invoke refill separately when you deliberately want another design pass.

## What the loop branches on

`npm run queue` is the whole control surface. It refreshes `origin/main`, reports the queue in a
few lines, and exits with the code the loop acts on:

- `0` — a `Todo` entry is next. Recover its open controlled-prefix PR if one exists; otherwise work it.
- `3` — queue complete. Stop; run `/refill` separately only when another pass is wanted.
- `4` — the `head:` entry is not on `origin/main` yet. Recover its PR for review and release.
- `5` — an entry is stuck `In progress` from a run that died. Needs a human.

Run it by hand any time you want to know where things stand. `--no-fetch` reports against the local
ref; passing a path reads that file instead of the live queue, which is how the exit codes are
exercised in testing.

Exit 4 also prints a machine-readable `hold:` JSON object. Drain uses its entry and recorded subject,
strips the single remote-tracking `origin/` prefix from its ref before comparing GitHub's
`headRefName`, and stops on multiple matching remote branches rather than selecting one arbitrarily.
The normal queue refresh prunes deleted remote refs first, so stale branches cannot become recovery
candidates.

### Why exit 4 exists

Entries overlap in the files they touch — 17 and 18 both edited the today-card, 19 and 20 both
extended the same dialog-accessibility array in `tests/static-check.mjs` — so two open branches
conflict. An earlier guard used only a stale, incorrect branch prefix to decide whether an entry had
merged, so it matched nothing and allowed stacking. The queue guard still decides merge state from
the recorded commit subject on `origin/main`, independent of branch names. Controlled Codex/Claude
head prefixes now serve only to locate an open recovery candidate; review must independently
validate its entry, subject, diff, and exact SHA before drain can merge it.

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
- **Claude Code workflows** — `.claude/commands/entry.md`, `.claude/commands/review.md`,
  `.claude/commands/refill.md`, and `.claude/commands/drain.md`.
- **Codex workflows** — `.agents/skills/road-to-send-entry/`,
  `road-to-send-review/`, `road-to-send-refill/`, and `road-to-send-drain/`.
