---
name: road-to-send-drain
description: Run one context-light Road to Send queue tick by checking queue state and delegating exactly one entry or refill to a fresh subagent. Use only when explicitly invoked to operate the serialized agentic improvement loop.
---

# Drain one queue tick

Act only as the loop orchestrator. Stay small.

Do not read `src/`, open a test file, edit a file, run `npm run build` or `npm test`, commit, push, or
draft a pull request body in the main thread. The delegated subagent owns those actions so its noisy
context dies when it finishes.

## 1. Check state

Run `npm run queue`. This is the only repository state to read in the main thread. Branch on the
exit code:

- **0** — continue to step 2 with the entry named on `next:`.
- **3** — continue to step 3.
- **4** — stop silently. Waiting for the prior pull request to merge is the normal resting state.
- **5** — tell the user which entry is stuck `In progress`, then end the loop. Resetting it is a
  human decision.

Do not switch branches, reset, clean, or inspect source before this check.

## 2. Delegate one entry

Spawn exactly one general-purpose or worker subagent and wait for it to finish. Never run two at
once; serialized entries overlap in the files they touch.

Give the subagent this task:

> Invoke `$road-to-send-entry` and follow it exactly from start to finish. Return only six lines:
> `ENTRY: <number> — <title>`, `PR: <url or none>`, `CI: <green|red|pending>`,
> `BYTES: <before> -> <after>`, `DEVIATIONS: <one line or none>`, and
> `STATUS: <shipped|blocked|stopped>`. Do not include diffs, file contents, test output, or the PR
> body. If stopped, put the reason on the `DEVIATIONS` line.

Keep only those six lines in the orchestrator context.

## 3. Delegate at most one refill

Exit code 3 means the queue is empty. Before delegating, list open pull requests through the
connected GitHub tools when available, falling back to `gh`. If a queue proposal is already open,
stop silently; two proposals cannot both merge.

Otherwise spawn exactly one general-purpose or worker subagent and wait. Give it this task:

> Invoke `$road-to-send-refill` and follow it exactly from start to finish. Return only four lines:
> `QUEUE: <first>-<last>`, `PR: <url or none>`, `COUNT: <n> entries`, and
> `STATUS: <proposed|stopped>`. Do not include entry bodies or the PR description.

Tell the user that the queue pull request awaits review, then stop. A future tick must detect the
open proposal instead of proposing another queue.

## 4. Report only actionable state

The pull request is the record. Stay silent after a clean shipped iteration. Speak only when:

- exit code 5 occurs;
- a subagent reports `blocked` or `stopped`;
- CI is red;
- a refill proposal needs human review;
- the same entry number appears twice in a row; or
- `BYTES` crosses 95% of the budget.

The final two conditions indicate a loop failure. End instead of iterating.

## 5. Leave pacing outside the tick

One invocation performs one tick and never sleeps or polls. A recurring automation, scheduler, or
human operator owns the next invocation. Use a long cadence—30 minutes or slower—because the usual
wait is for a human pull-request merge.
