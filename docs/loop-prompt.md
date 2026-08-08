# The plan → execute → review loop

Claude plans and reviews; Codex executes. One tick works one issue from the GitHub tracker, hands
implementation to Codex, reviews the result in a fresh context, and stops. The prompt below is the
whole workflow — paste it into `/loop` with dynamic pacing.

Everything the loop leans on is a vendored skill under `.agents/skills/`, so this file adds no
machinery of its own. That is deliberate: the previous loop shipped four commands, four agents, three
scripts and a queue file, and all of it drifted against the app it was meant to improve.

## The prompt

```text
Run ONE tick of the plan → execute → review loop, then stop. One issue per tick, one commit per
tick. Stay context-light: delegate anything that requires reading src/ or a diff, and never read
src/app.js or a full diff in this session.

PICK — `gh issue list --state open --label ready-for-agent --json number,title,body,labels,comments`.
Take the lowest-numbered issue whose blockers are all closed (native
`issue_dependencies_summary.blocked_by`, else the "Blocked by" line in the body). If none qualify,
report "queue empty — refill with /triage and /to-tickets" and END THE LOOP. Never invent work;
refilling is mine, not yours.

PLAN (Claude, inline) — `gh issue view <n> --comments`. The agent brief on the issue is the binding
spec; do not re-litigate it. Use /domain-modeling to check the terms against CONTEXT.md and
docs/adr/, and /codebase-design if the brief implies a new seam. Then write a Codex brief: what to
build, acceptance criteria verbatim from the issue, the test seam (prefer an existing one), and
these hard constraints from AGENTS.md — edit only src/ and tests/; never hand-edit index.html; run
`npm run build` then `npm test`; commit the regenerated index.html with the src/ change; no new
dependencies; frozen localStorage keys; changing src/apps-script.js, src/schema.json or
src/scoring.json forces an API version bump. If the brief is ambiguous enough that two readings give
different code, stop and ask me instead of guessing.

BRANCH — `git fetch origin`, branch off origin/main as `claude/issue-<n>-<slug>`, record the base SHA.

EXECUTE (Codex) — `/codex:rescue --wait --fresh <brief>`, instructing Codex to run `$implement`,
which uses `$tdd` at the named seam. Write access is the rescue default; do not pass --write, which
is not a rescue flag and would land in the task text. Do not implement any of it yourself and do not
read the diff while it runs.

VERIFY (Claude) — `npm run build && npm test && npm run check:generated`. Read the full
`=== summary ===`. Confirm `git status` is clean and `git diff --name-only <base>...HEAD` touches
only permitted paths.

REVIEW (Claude) — /code-review <base-sha>, with the issue as the spec source. Both axes run in fresh
sub-agents; keep only their verdicts.

FIX — blocking findings go back via `/codex:rescue --wait --resume`, naming only the findings, then
re-verify and re-review. Maximum two rounds. If it is still not clean, comment the findings on the
issue, relabel it ready-for-human, and end the tick.

LAND — clean and green: commit to the branch if Codex has not, then STOP. Report the issue number,
branch, base..head, the test summary line, and both review verdicts. Push and `gh pr create --draft`
are not pre-approved, so ask me once before either — that is the only checkpoint in the tick.

CLOSE — when a tick's PR merges into an integration branch rather than `main`, close its issue by
hand. GitHub only honours `Closes #N` for PRs that target the default branch, so on a queue that
lands as one unit the blocker never clears itself and PICK deadlocks on the first ticket.

PACE — after a completed tick, wait 120–300s so origin/main settles. Stop the loop on "queue empty",
on ready-for-human, or on any question you have to ask me.
```

## Before the first run

Create the triage labels the tracker does not have yet. `wontfix` already exists.

```bash
for l in needs-triage needs-info ready-for-agent ready-for-human; do gh label create "$l" --force; done
```

Then fill the queue by hand — `/to-spec` to turn a design conversation into a spec issue,
`/to-tickets` to slice it into `ready-for-agent` issues carrying blocking edges. Read
`docs/agents/issue-tracker.md` for the tracker conventions and `docs/agents/triage-labels.md` for the
label vocabulary.

Running the loop before either step is harmless: `gh issue list --label ready-for-agent` against a
label that does not exist returns `[]` and exits 0 rather than failing, so the tick takes the
queue-empty branch and stops.

## Why refilling is a human step

`implement`, `to-spec`, `to-tickets`, `triage` and `handoff` are all marked
`disable-model-invocation: true`, so Claude cannot reach for them on its own — only `code-review`,
`tdd`, `domain-modeling`, `codebase-design`, `research`, `prototype` and `grilling` are
model-invocable. The loop is shaped around that rather than fighting it, and it lands in the right
place anyway: a loop that can refill its own queue turns "finish this queue" into a standing request
to invent work for a live app. Codex is not affected by the flag, because the brief names
`$implement` explicitly.

## Why the loop delegates

`/loop` fires into the **same session**, so whatever one tick reads stays in context for every tick
after it. `src/app.js` alone is tens of kilobytes; worked inline, a handful of issues exhausts the
window. So the tick reads issue text and test summaries, hands source and diffs to workers whose
context dies with them, and keeps only the issue number, the base and head SHAs, the summary line and
the two review verdicts.

## Where it stops

`.claude/settings.json` pre-approves `git commit` but neither `git push` nor `gh pr create`, so a
tick cannot land a pull request unattended. That is the single checkpoint, pushed as late as it
goes: the tick does all its work first and asks once, with tests green and both review axes reported.
Pre-approving the push would remove the last gate between an autonomous loop and a live app.

## Review the first ticks by hand

Read the diff on the first two pull requests a fresh queue produces before letting the loop run
unattended. A change that reshapes the tests, the build, or the rules is inherited by every tick
after it.

Note also what the review does and does not prove. Claude reviewing Codex's code is genuine
cross-model review, but the Standards axis judges against the same brief Claude wrote, and the Spec
axis can only catch drift from the issue — never a bad issue.
