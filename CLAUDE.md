# Road to Send — agent orientation

**This app is live** at <https://huangmj0.github.io/road-to-send/>, serving a real crew's data from a
shared Google Sheet and from their browsers' localStorage. `index.html` is the deployed artifact and
**stays at the repository root** — moving or renaming it changes the published URL.

## The loop protocol

- `IMPROVEMENT_LOG.md` is the work queue. Read its rules block in full before touching anything.
- **Start with `npm run queue`.** It reports the queue in a few lines and exits with the code that
  says whether you may start: `0` clear · `3` empty · `4` the previous entry has not merged ·
  `5` an entry is stuck `In progress` · `6` the batch is ready to ship. Do not start an entry it
  told you not to start.
- Take the **first** entry whose `Status:` is `Todo`, top to bottom. Skip `Done`, `Blocked`, and
  anyone else's `In progress`. If nothing is `Todo`, stop and report "queue empty — no Todo entries".
- Set `Status: In progress — <date>` first. `Done` means implemented and reviewed locally; entries
  remain uncommitted until the batch ships as one squashed commit.
- **Codex writes the code; Claude judges it.** `/entry` never edits `src/` — it briefs Codex through
  `node scripts/codex-run.mjs`, which pins the model, effort and sandbox per role. Reviewers return
  findings; Codex applies them. No agent both writes and approves the same diff.
- **Entries batch.** An approved entry is `Done` but uncommitted; several ship as one squashed
  commit when `npm run queue` reports exit 6. Gate 1 (`precommit-review`) judges the local diff,
  gate 2 (`review`) judges the published PR, and a `major` UI change from `scripts/ui-scope.mjs`
  adds a `design-review` that looks at the rendered app rather than the CSS.
- A run opens its PR as a draft and marks it **ready for review** itself once the suites and CI are
  green; a run that could not get there leaves the PR a draft and says why. Only `/drain` releases,
  through `scripts/queue-git-guard.mjs`; no run merges its own work.
- Shipped entries live under `docs/archive/`, split by pass and indexed by `IMPROVEMENTS.md`. That
  is the archive, not a queue — never work from it, and when you do need to look something up, read
  the one pass file that holds it.

## Working rules

The full, authoritative rules live in the "Rules for implementers" block at the top of
`IMPROVEMENT_LOG.md`; repository conventions (structure, style, testing, commits) live in
`AGENTS.md`. Read those two — this file deliberately does not restate them, because a third copy is
a third thing to drift. The short version:

- Edit `src/app.js`, `src/index.template.html`, `src/styles.css` and `tests/`. **Never** edit
  `index.html` by hand; run `npm run build` to regenerate it, then `npm test`.
- Commit the regenerated `index.html` with your `src/` changes. Never weaken an existing assertion.
- `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`.
- The loop body is `.claude/commands/entry.md` (`/entry`); `docs/loop-prompt.md` explains how to run
  it. Harness traps live in a header comment in the test file they apply to — read it before adding
  assertions there.
- Codex mirrors this orientation in `AGENTS.md` and exposes equivalent repository skills under
  `.agents/skills/`; changes to the loop should keep both agent surfaces aligned.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
