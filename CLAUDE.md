# Road to Send — agent orientation

**This app is live** at <https://huangmj0.github.io/road-to-send/>, serving a real crew's data from a
shared Google Sheet and from their browsers' localStorage. `index.html` is the deployed artifact and
**stays at the repository root** — moving or renaming it changes the published URL.

## The loop protocol

- `IMPROVEMENT_LOG.md` is the work queue. Read its rules block in full before touching anything.
- **Start with `npm run queue`.** It reports the queue in a few lines and exits with the code that
  says whether you may start: `0` clear · `3` empty · `4` the previous entry has not merged ·
  `5` an entry is stuck `In progress`. Do not start an entry it told you not to start.
- Take the **first** entry whose `Status:` is `Todo`, top to bottom. Skip `Done`, `Blocked`, and
  anyone else's `In progress`. If nothing is `Todo`, stop and report "queue empty — no Todo entries".
- One entry = one commit. Set `Status: In progress — <date>` first, and `Status: Done — <date>` plus
  the commit subject and any deviations in `Notes:` in the same commit as the implementation.
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
