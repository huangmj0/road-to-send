# Running the improvement loop

`IMPROVEMENT_LOG.md` is a queue. A loop implements one entry per invocation, reviews each local
diff, and ships several approved entries as one squashed commit and one pull request.

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

Prefer dynamic pacing at two to five minutes. A clean tick either adds one locally reviewed entry
to the batch or ships and releases a substantial batch. The short gap keeps contexts isolated while
letting GitHub update remote state before the next tick.

## How a run hands work back

The entry driver sends a scoped brief to Codex, verifies the built tree, and leaves the change
uncommitted. A fresh pre-commit reviewer judges the diff against the binding entry. A diff-derived
`major` UI classification adds a fresh design reviewer that renders the app at mobile and desktop
widths. Both reviewers return findings only; Codex applies fixes, and a fresh reviewer judges again.
An approved entry becomes `Done` and joins the open batch.

At `BATCH_MIN` entries, or an operator `--ship`, exit `6` creates one commit and draft PR. Ready
means local checks and CI are green; still draft names the failure. A fresh PR reviewer judges the
whole batch and returns findings or the exact base, head, and subject. Review never writes: Codex
fixes, ship mode amends through the guard, and a new reviewer judges the changed head.
`BATCH_MAX` caps how many reviewed-but-uncommitted entries a lost worktree can take with it.

Only drain may release, and only after proving the PR is open, non-draft, green, and still at the
reviewed base and head, with the sole batch commit directly atop that base. It then pushes that exact
SHA to `main` as a non-force fast-forward through `scripts/queue-git-guard.mjs`. The same guard
publishes only new one-commit controlled branches and restricts force-with-lease amendments to the
PR branch. A concurrent `main` change makes Git reject release atomically, so
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
alone is tens of kilobytes — and a handful of them exhaust the window. That is the same rot the split test
suites and the split archive were meant to stop, arriving by a different route.

So drain reads almost nothing. It branches on `npm run queue`, delegates Codex execution and fresh
Claude review, retains only fixed reports, and stops after one entry or one release. Source, diff,
screenshots, and test output die with the worker that needed them.

Before releasing, drain checks controlled head prefixes for an already-open batch PR. That makes a
fresh window recover published work without duplicating it. The reviewer still validates entry
numbers, subject, diff, base, and head; a prefix locates a candidate but never authorizes release.

Each drain implementation delegates by naming its entry and review workflows rather than restating
either one. `tests/docs-check.mjs` asserts both agent surfaces preserve that boundary.

## Which model runs which step

The steps are not equally hard, so they do not run on the same model. The split follows where a
mistake gets caught:

- **Refill — the most capable model, high effort.** This is the design step. Every entry it writes
  becomes a binding spec that a later run executes literally without re-litigating it, so a vague
  `### Requirements` block, a named helper that does not exist, or two entries colliding in the same
  DOM region each cost a full implementation iteration and two reviews. It also runs rarely —
  once per drained queue, against six to twelve entries — so its cost amortises to almost nothing.
- **Codex entry/fix — Terra, medium effort.** These roles execute a merged binding spec through the
  repo wrapper's explicit workspace sandbox. Hard retry and diagnosis use Sol/high; scouting uses
  Mini/low and a read-only sandbox. The wrapper keeps reasoning JSONL out of Claude's context.
- **Claude entry driver — Haiku, medium effort.** It assembles a Graphify-scoped brief, runs tests,
  and relays fixed reports. It neither writes source nor judges the diff.
- **Claude review — Opus, high effort.** Pre-commit, rendered design, and PR review are the
  discriminator gates. They return findings only, so no reviewer approves its own edits.
- **Drain — Sonnet, medium effort.** It reads queue and PR state, delegates, checks fixed reports,
  and guards one merge.

Claude command frontmatter and matching agents pin their tiers. `scripts/codex-run.mjs` is the only
place Codex model, effort, schemas, and explicit sandboxes are selected.

Two files per workflow is two places to drift, so `tests/docs-check.mjs` holds them together: each
command pins a ranked model and an effort rather than inheriting the session's, each agent agrees
with its command on both, `/drain` spawns named agents instead of `general-purpose`, and
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
- `3` — queue complete, or a sub-threshold tail is waiting. Stop; use `--ship` for the tail or run
  `/refill` only when another design pass is wanted.
- `4` — a published batch is not on `origin/main` yet. Recover its PR for review and release.
- `5` — an entry is stuck `In progress` from a run that died. Needs a human.
- `6` — the open batch reached `BATCH_MIN`, or `--ship` forced a non-empty tail. Ship it now.

Run it by hand any time you want to know where things stand. `--no-fetch` reports against the local
ref; passing a path reads that file instead of the live queue, which is how the exit codes are
exercised in testing.

Exit 4 also prints a machine-readable `hold:` JSON object. Drain uses its entry and recorded subject,
strips the single remote-tracking `origin/` prefix from its ref before comparing GitHub's
`headRefName`, and stops on multiple matching remote branches rather than selecting one arbitrarily.
The normal queue refresh prunes deleted remote refs first, so stale branches cannot become recovery
candidates.

### Why exit 4 exists

Once a batch is published, starting more uncommitted work before it lands would mix two bases and
make recovery ambiguous. Exit `4` binds recovery to the subject recorded in the shipped entries and
the exact remote ref. Review still validates the batch, subject, diff, and SHA independently.

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
