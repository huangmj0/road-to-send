# Loop prompt: executing the improvement log

`IMPROVEMENT_LOG.md` is a queue. This file is the prompt that drains it — one entry per
invocation, one entry per commit, one entry per pull request.

## Usage

Paste the prompt below into a looping agent (for example `/loop` with dynamic pacing, or
`/loop 45m`). Each invocation does exactly one entry and stops.

Pick a long interval or dynamic pacing rather than a short one. Every iteration is a real
feature commit, so a short interval mostly wakes into "the previous pull request is still
open" — which is harmless, because the prompt's first check stops and reports the blocker,
but it is wasted work.

**Review the first two iterations by hand.** Entry 15 rewrites the log the loop reads from,
and entry 16 rewrites the test runner the loop depends on. If either lands wrong, every later
iteration inherits it.

## Why iterations serialize on merge

Entries overlap in the files they touch: 17 and 18 both edit the today-card, and 19 and 20
both extend the same dialog-accessibility array in `tests/static-check.mjs`. Two open branches
would conflict, so the prompt refuses to start an entry while a previous one is unmerged.

## The prompt

```
Work exactly ONE entry from IMPROVEMENT_LOG.md in huangmj0/road-to-send, then stop.

## Before you start

1. `git fetch origin main` and start from the latest `origin/main`. Never branch from a
   stale local `main` — it has been 37 commits behind before.
2. Check for an open PR from a previous iteration (branch prefix `claude/entry-`). If one
   exists and is not merged, STOP and report which PR is blocking. Do not stack a second
   entry on top of unmerged work: entries 17 and 18 both edit the today-card, and 19 and 20
   both extend the same dialog-a11y array in tests/static-check.mjs, so parallel branches
   will conflict.
3. Read the rules block at the top of IMPROVEMENT_LOG.md in full before touching anything.

## Pick the entry

Take the FIRST entry, top to bottom, whose `Status:` is `Todo`. Skip `Done`, `Blocked`, and
any `In progress`. Do not cherry-pick, reorder, or batch entries — the sequence is
load-bearing (16 adds the byte budget the feature entries are measured against; 18 consumes
a helper 17 introduces; 20 places a modal after the one 19 adds).

If no entry is `Todo`: STOP and report "queue empty — no Todo entries". Do not invent work,
re-do a `Done` entry, or reopen anything.

## Implement it

- Set `Status: In progress — <today>` as your first action.
- Do exactly what that entry's `### Requirements` says, and nothing its `### Do not` forbids.
- Entries 15 and 16 contain explicit carve-outs permitting edits to docs, .github/,
  package.json and scripts/. Honour the carve-out — do NOT go `Blocked` on rules 2/8 for
  those two. Every other entry is limited to src/app.js, src/index.template.html,
  src/styles.css and tests.
- Reuse the existing helpers the entry names. Never fork scoring math, never call `new Date()`
  for challenge dates (use `challengeToday()`), never add a localStorage key, a dependency,
  or a network request.
- If the entry genuinely cannot be done inside its own rules, set `Status: Blocked — <reason>`,
  commit that, and stop. Do not bend the rules to finish.

## Two traps that have bitten before

- tests/static-check.mjs asserts DOM *source order* and exact compact CSS text
  (`.trend-scroll{overflow-x:auto}`, `@media(prefers-color-scheme:dark)` with no space).
  ADD new assertions; never relax or retarget an existing one. Reformatting CSS breaks tests
  with an unhelpful message.
- In tests/client-state.test.js the element stub's `setAttribute` is a no-op and `getAttribute`
  always returns `null`, so aria-* set from JS is NOT observable — assert textContent/innerHTML
  there and cover aria-* in static-check.mjs. Element listeners are no-ops and elements have no
  `closest`, so delegated handlers cannot be fired: expose every new interaction as a named
  top-level function. New assertions live inside backtick template literals — no backticks and
  no `${` in added test code; build strings with `+`.

## Verify

Run `npm run build` then `npm test`. All suites must pass; never weaken an assertion.

Then run `git status`. If index.html shows as modified, the committed artifact was stale and
`check:generated` silently rebuilt it — commit the regenerated index.html together with your
src/ changes. (Entry 16 removes this foot-gun; until it lands, check every time.)

## Ship

- Set `Status: Done — <today>` and put the commit subject plus any deviations in `Notes:`,
  in the SAME commit as the implementation.
- One entry = one commit. Branch `claude/entry-<N>-<slug>`, push with `-u origin`, open a
  DRAFT PR describing the entry, its tests, and anything you deviated on.
- Report the entry number, the PR URL, and CI status. Then stop — do not start the next entry.
```

## Maintenance

Two lines in the prompt are deliberately temporary and should be removed when they stop being
true:

- The `git status` / stale-`index.html` paragraph describes a foot-gun that **entry 16
  removes** by making `check:generated` read-only. Delete it once entry 16 has landed.
- The "entries 15 and 16 contain explicit carve-outs" paragraph is specific to those two
  entries. Once both are `Done`, reduce it to the general rule: an entry may carve itself out
  of rules 2 and 8 in its own `### Requirements`, and absent that they are hard limits.
