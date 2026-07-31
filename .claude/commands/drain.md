---
description: One loop tick — check the queue and delegate the work to a fresh subagent.
---

You are the loop's orchestrator. **Stay small.**

Do not read `src/`, do not open a test file, do not edit anything, do not run `npm run build` or
`npm test`, do not write a commit or a pull request body. Every one of those happens inside a
subagent whose context dies when it finishes — that is the entire point of this command.

The reason is arithmetic. `/loop` fires into the *same* session, so whatever you read stays with
you for every later iteration. An entry worked inline costs tens of thousands of tokens — `app.js`
alone is 78 KB — and ten of those end the window. Worked through a subagent it costs you seven lines.
Your job is to check state, delegate, keep those seven lines, and pick the next wake-up.

## 1. Check state

Run `npm run queue`. That is the only repository state you read. Branch on its exit code:

- **0** — a `Todo` entry is next, named on the `next:` line. Go to step 2.
- **3** — queue empty. Go to step 3.
- **4** — the previous entry is not merged yet. Say nothing, idle (step 5). This is the ordinary
  resting state of a healthy loop, not a problem to report.
- **5** — an entry is stuck `In progress` from a run that died. Tell the user which one and **end
  the loop**. Resetting a half-finished entry is a human's call, not yours.

Do not switch branches, reset, or clean the tree before running it. `npm run queue` works out what
is in flight on its own, including from branches this session never touched.

## 2. Work one entry, in a subagent

Spawn exactly one, and wait for it (`run_in_background: false`). **Never run two at once** —
entries overlap in the files they touch, which is why the queue serialises on merge at all.

```
Agent(
  subagent_type: "general-purpose",
  run_in_background: false,
  description: "Work one queue entry",
  prompt: """
Invoke the `entry` skill and follow it exactly, start to finish.

Then reply with ONLY these seven lines, and nothing else:
  ENTRY: <number> — <title>
  PR: <url, or "none">
  CI: <green|red|pending>
  REVIEW: <ready|draft — reason>
  BYTES: <before> -> <after>
  DEVIATIONS: <one line, or "none">
  STATUS: <shipped|blocked|stopped>

Do not paste diffs, file contents, test output, or the PR body into your reply. Your report is the
only thing that survives you, and it is read by an orchestrator whose context has to last dozens of
iterations. If you stopped without shipping, say why on the DEVIATIONS line.
"""
)
```

Keep those seven lines. Nothing else from that run enters your context.

`REVIEW: ready` means the entry's PR passed its own checks and is now waiting on the user to merge —
which is the one thing the loop never does for itself.

## 3. Refill, in a subagent, at most once

Exit 3 means the queue is drained. A refill opens a proposal PR that a human has to merge before
any entry can run, so **check first that one is not already waiting** — proposing twice creates two
conflicting queues that cannot both be merged.

List the repository's open pull requests. If one is already a queue proposal, say nothing and idle
(step 5). Otherwise spawn one subagent and wait for it:

```
Agent(
  subagent_type: "general-purpose",
  run_in_background: false,
  description: "Refill the queue",
  prompt: """
Invoke the `refill` skill and follow it exactly, start to finish.

Then reply with ONLY these five lines, and nothing else:
  QUEUE: <first>-<last>
  PR: <url, or "none">
  COUNT: <n> entries
  REVIEW: <ready|draft — reason>
  STATUS: <proposed|stopped>

Do not paste entry bodies or the PR description into your reply.
"""
)
```

Then tell the user the queue PR is waiting on them, and idle. **Do not refill again** — the next
exit 3 will find the open proposal and idle silently until it merges.

## 4. What to say

The PR is the record, so stay silent on a clean iteration that opened a green one and marked it
ready. Speak up only when the user has something to do or something is wrong:

- exit 5, or a subagent reported `STATUS: blocked` or `stopped`
- a subagent reported `CI: red`, or `REVIEW: draft` — the PR could not hand itself over, so say
  which check stopped it
- a refill PR was opened — the loop cannot continue until it is merged
- the same entry number comes back twice running, or `BYTES` crossed 95% of the budget

That last pair means something is wrong with the loop itself rather than with one entry. Stop and
say so rather than iterating into it.

## 5. Pacing

Under `/loop` dynamic pacing, choose the next delay from what you are actually waiting for. In
every ordinary case that is a human merging a pull request, which is not a thing that happens in
sixty seconds:

- shipped an entry, or exit 4 — **1800s**
- opened a refill PR, or found one already open — **1800s**
- exit 5, a repeated entry number, or `STATUS: stopped` — do not reschedule; end the loop

Never poll faster. A short interval just wakes into "still not merged" and spends context to learn
nothing, which is the failure this whole command exists to avoid.
