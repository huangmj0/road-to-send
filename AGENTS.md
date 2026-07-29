# Road to Send — Codex orientation

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

## Codex workflows

- Invoke `$road-to-send-entry` to implement, verify, commit, push, and open a draft PR for exactly
  one queue entry.
- Invoke `$road-to-send-refill` only when the queue is empty to propose new entries in a queue-only
  draft PR.
- Invoke `$road-to-send-drain` for a context-light loop tick. It reads only queue state and delegates
  the entry or refill workflow to one fresh subagent, then stops. The outer automation or operator
  owns the next tick.
- The Codex skills live under `.agents/skills/`; the Claude Code commands remain under
  `.claude/commands/`. `docs/loop-prompt.md` is the shared operator guide.

## Loop working rules

The full, authoritative rules live in the "Rules for implementers" block at the top of
`IMPROVEMENT_LOG.md`. The short version:

- Edit `src/app.js`, `src/index.template.html`, `src/styles.css` and `tests/`. **Never** edit
  `index.html` by hand; run `npm run build` to regenerate it, then `npm test`.
- Commit the regenerated `index.html` with your `src/` changes. Never weaken an existing assertion.
- `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`.
- Harness traps live in a header comment in the test file they apply to — read it before adding
  assertions there.

# Repository Guidelines

## Project Structure & Module Organization

This is an intentionally self-contained static application. The editable sources live in `src/`: `index.template.html` (markup), `styles.css`, `app.js` (browser code), `apps-script.js` (the Google Apps Script source shown during shared setup), plus the shared `scoring.json` and `schema.json` contracts. `scripts/build.mjs` inlines them into the generated `index.html` at the repository root — never edit `index.html` by hand; `scripts/check-generated.mjs` fails if the committed artifact is stale. `src/scoring.json`, `src/schema.json` and `src/apps-script.js` are the shared browser/backend contract and are **out of scope for log-driven entries** (rule 2 of `IMPROVEMENT_LOG.md`): they change only in an organizer-coordinated task that bumps the API version, gets its own log entry, and ships the Apps Script redeploy together with the frontend change. `tests/` contains Node-based behavioral and contract tests. The client-state suites all eval the built script and split by harness so an entry loads only the one it touches: `client-state.state.test.js` covers pure scoring, date and text helpers with no DOM, `client-state.dom.test.js` runs `init()`/`render()` against a document stub, and `client-state.shared.test.js` covers shared mode behind a stubbed `fetch`; `harness.js` holds the script extraction and the element stub they share. Alongside them, `backend-script.test.js` validates the embedded Apps Script, `protocol-fixtures.test.js` checks wire-format fixtures against `src/schema.json`, `smoke.test.js` covers the shared workflow end to end, and `static-check.mjs` checks syntax, accessibility, and required UI hooks. **Every test file opens with a `TRAP` comment describing its harness's sharp edges — read it before adding assertions to that file.** `README.md` documents setup and deployment; `IMPROVEMENT_LOG.md` tracks queued frontend enhancements, and shipped entries are archived verbatim under `docs/archive/` with `IMPROVEMENTS.md` as the index over them. `docs/loop-prompt.md` explains how the loop that drains the queue is run.

## Build, Test, and Development Commands

- `npm run queue` reports the state of `IMPROVEMENT_LOG.md` — counts, the next `Todo` entry, any entry still awaiting archiving — and refreshes `origin/main` to check that the previously completed entry actually landed there. Its exit code is what a loop iteration branches on: `0` clear to start, `3` queue empty, `4` the previous entry is unmerged so a second entry must not be stacked on it, `5` an entry is stuck `In progress`. `--no-fetch` reports against the local ref; a path argument reads that file instead of the live queue.
- `npm run build` regenerates `index.html` from `src/`. Run it after any `src/` change and commit the regenerated artifact alongside the source edits.
- `npm test` runs `scripts/run-tests.mjs`, which runs every suite — the generated-artifact check plus the behavioral, backend-contract, static, documentation, and bundle-size checks — without short-circuiting, prints a `PASS`/`FAIL` line per suite, and exits non-zero if any failed. Run it before every pull request; `.github/workflows/test.yml` runs the same suite in CI, and `pages.yml` runs it again in a `verify` job that gates the deploy job, which publishes only `index.html` to GitHub Pages on pushes to `main`.
- `python3 -m http.server 8000` serves the repository locally; open `http://localhost:8000/` to exercise browser behavior.

Pushes to `main` are expected to deploy the static page through GitHub Pages. Shared-mode changes may also require copying and redeploying the embedded Apps Script as described in `README.md`.

## Coding Style & Naming Conventions

Use two-space indentation in HTML and test files. Preserve the existing compact style inside inline CSS, browser code, and the embedded Apps Script unless a change deliberately restructures the file. Prefer `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for scoring/configuration constants, and kebab-case for CSS classes and HTML filenames. Keep DOM IDs descriptive and unique. Use Node built-ins and browser APIs only: **no dependencies — runtime or dev** (rule 8 of `IMPROVEMENT_LOG.md`), no frameworks, and no build-tool changes, unless an entry explicitly carves itself out in its own `### Requirements`.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`; no external framework or coverage threshold is configured. Name behavioral cases by expected outcome, and add regression coverage for scoring limits, date/timezone boundaries, malformed remote data, API validation, accessibility labels, and sync ordering. Because tests extract scripts directly from `index.html`, preserve the script boundaries and embedded `SCRIPT` declaration they match.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects such as `Fix weekly bounty eligibility`. Keep commits focused. Pull requests should explain user-visible behavior, identify scoring or API compatibility effects, link relevant issues, include screenshots for UI changes, and report `npm test` results. Never commit live Apps Script endpoints, shared crew URLs, or sensitive Sheet data.
