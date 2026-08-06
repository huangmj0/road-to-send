---
description: Drive Codex through exactly one entry from IMPROVEMENT_LOG.md, or ship the accumulated batch, then stop.
model: haiku
effort: medium
---

Work exactly ONE entry from `IMPROVEMENT_LOG.md`, then stop. **Codex writes the code; you drive
it.** You never edit `src/` yourself and never fix Codex's output by hand — findings go back to
Codex.

`/drain` chooses one mode in its prompt:

- **ENTRY** — implement the next Todo locally; follow steps 1–5.
- **FIX** — provide `ENTRY`, `SESSION`, and the reviewer's complete `FINDINGS`; skip queue
  orientation and resume Codex as described in step 5.
- **APPROVE** — provide `ENTRY`, the verified summary, and deviations after all local gates pass;
  update only that entry's bookkeeping as described in step 5.
- **SHIP** — publish the approved open batch; follow step 6.
- **PR-FIX** — provide `PR`, `OLD_HEAD`, and complete `FINDINGS`; follow step 7.

Never infer FIX or PR-FIX from a dirty tree. Require the mode and its fields so findings cannot be
applied to the wrong entry, session, or published head.

## 1. Orient

Run `npm run queue`. It refreshes `origin/main` and reports where the loop stands. Branch on its
exit code and do not go further than it allows:

- **0** — implement the `next:` entry. Continue at step 2.
- **3** — report `queue empty — no Todo entries` and stop.
- **4** — report the held entry and stop; `/drain` owns recovery.
- **5** — report the stuck `In progress` entry and stop.
- **6** — the batch is ready. Skip to step 6.

Work on the current branch. The batch stays uncommitted until step 6, so do not create a branch,
reset, or clean here.

The Git index is the boundary between entries: already approved batch work is staged; the one
currently under review is unstaged. Before setting the next entry `In progress`, require
`git diff --quiet` while allowing `git diff --cached` to contain only prior `Done` entries. Stop on
any leftover unstaged change, because it belongs to an interrupted entry rather than this one.

## 2. Clear the finished entries first

If `npm run queue` reports `archive-due:`, perform the rule-10 archive move for each named entry
before starting new work: lift the block verbatim, heading through its `---`, into the pass file
`IMPROVEMENTS.md` marks `current`, and drop its index line. Verify the lifted block is
byte-identical to what you removed. Start a new pass file rather than raising a cap.

## 3. Build the brief

Set the entry's `Status: In progress — <date>` first.

Assemble the Codex brief into a temporary file, containing in this order:

1. The entry verbatim — `### Why`, `### Requirements`, `### Tests`, `### Do not`.
2. The rules block from `IMPROVEMENT_LOG.md`, and the tone rule for entries 24 onward.
3. `graphify query "<entry title and every helper it names>" --budget 1500` — the locator block
   telling Codex which files and symbols this touches, so it does not rediscover the repository.
   Say plainly that this lists names and line numbers, not code, and that it must read the files.
4. The `TRAP` header of every test file the entry will touch, quoted.
5. The hard constraints: edit only `src/app.js`, `src/index.template.html`, `src/styles.css` and
   `tests/`; never edit `index.html` by hand — run `npm run build`; never weaken an existing
   assertion; reuse `computeCredits()`, `totalsModel()`, `paceInfo()`, `weekKey()`, `fmtDay()`,
   `parseDateOnly()`, `challengeToday()`; never `new Date()` in challenge-date logic; no
   dependencies, no network requests, no frameworks; **do not commit anything**.

## 4. Dispatch

```bash
node scripts/codex-run.mjs --role entry --brief <brief file>
```

Read only its report. The JSONL transcript stays in the log file — do not open it unless the run
failed and you need the reason for your own report.

If `STATUS: failed`, retry once with `--role entry-hard`. A second failure is blocked: set the
entry `Blocked — <reason>` and stop.

## 5. Verify, then hand it to the reviewers

Run `npm run build`, then `npm test`, and read the whole `=== summary ===` block rather than
stopping at the first failure. A red suite goes straight back to Codex —
`node scripts/codex-run.mjs --role fix --brief <findings file> --resume <CODEX session id>` — without spending a
reviewer on it. At most three fix rounds, then `Blocked`.

Run `node scripts/ui-scope.mjs` and report its level; `/drain` uses it to decide whether a design
review is owed.

Then report and stop. **Do not commit.** The entry stays uncommitted for gate 1, and `/drain`
spawns the reviewers. In explicit FIX mode, write the complete findings to a brief, verify the
entry and current diff are the named target, and run
`node scripts/codex-run.mjs --role fix --brief <file> --resume <SESSION>`. Rebuild, retest,
reclassify UI, and return the same seven lines. In explicit APPROVE mode, confirm the named entry
is the sole `In progress` entry and its working diff is still present, set `Status: Done — <date>`,
record its verified summary and deviations but no commit subject in `Notes:`, update the queue
index, then stage the complete approved working state with explicit paths. That advances the index
snapshot so the next entry's ordinary `git diff` contains only its own work. APPROVE never touches
`src/`, rebuilds, commits, or judges the diff.

Return only:

- `ENTRY: <number> — <title>`
- `CODEX: <ok|failed> <session id or none>`
- `TESTS: <green|red>`
- `UI: <none|minor|major>`
- `BYTES: <before> -> <after>`
- `DEVIATIONS: <one line or none>`
- `STATUS: <implemented|blocked|stopped>`

## 6. Ship mode

Only on exit 6, or when `/drain` explicitly asks. Every unshipped `Done` entry ships as **one**
commit.

Fetch `origin/main`, but do not try to switch the dirty index directly onto it. First create the
controlled branch at the batch's current base, preserving the staged and unstaged state:

```bash
git switch -C claude/entry-<lowest N>-<slug>
```

Choose a subject that names the batch and a body that lists each entry number and title. Add that
exact subject to each entry's `Notes:`, then move every batch entry — heading through separator,
verbatim — to the current archive and update `IMPROVEMENTS.md`. The subject remains available in
the archived entry for audit and recovery; no shipped batch entry stays in the live queue. Run the
build and tests, stage explicit paths, and commit once. Then rebase that single commit onto the
latest `origin/main`; this is the safe way to carry a dirty batch across a moving base. Stop on
conflicts rather than dropping work. Confirm the branch remains exactly one commit above
`origin/main` and run `npm run build && npm test` again on the rebased head.

Publish through the guard, never a raw `git push`:

```bash
node scripts/queue-git-guard.mjs publish <N> <HEAD> <SUBJECT>
```

Open a **draft** pull request from the template. Mark it **ready for review** only once the
working tree is clean, the branch is exactly one commit above `origin/main`, `npm test` is green
locally, every CI check is green, and the log bookkeeping matches. Give CI about ten minutes;
never `sleep` in the foreground.

**Never merge it.** Marking it ready is the entire handoff — gate 2 reviews it and `/drain`
releases it. Report `STATUS: shipped` with the PR URL, or say why it stayed a draft.

## 7. Published PR fix mode

Only on an explicit PR-FIX request. Require the controlled PR branch to be clean and exactly at
`OLD_HEAD`. Put the reviewer's complete findings, every batch entry, and the rules into a brief.
Run `node scripts/codex-run.mjs --role fix --brief <file>`; add `--resume <SESSION>` only when the
finding belongs unambiguously to one retained entry session.

Run `npm run build && npm test`, inspect the full diff, and stop unless every changed path is
permitted by the batch. Stage only those explicit paths, run `git commit --amend --no-edit`, record
`NEW_HEAD`, and publish only through
`node scripts/queue-git-guard.mjs amend <PR> <OLD_HEAD> <NEW_HEAD>`. Never raw-force-push. Return
the PR, old/new heads, tests, CI, deviations, and `STATUS: fixed|blocked|stopped`. The changed head
must go to a fresh PR reviewer; this mode never judges or releases it.
