# Repository Guidelines

## Project Structure & Module Organization

This is an intentionally self-contained static application. The editable sources live in `src/`: `index.template.html` (markup), `styles.css`, `app.js` (browser code), `apps-script.js` (the Google Apps Script source shown during shared setup), plus the shared `scoring.json` and `schema.json` contracts. `scripts/build.mjs` inlines them into the generated `index.html` at the repository root — never edit `index.html` by hand; `scripts/check-generated.mjs` fails if the committed artifact is stale. `src/scoring.json`, `src/schema.json` and `src/apps-script.js` are the shared browser/backend contract and are **out of scope for log-driven entries** (rule 2 of `IMPROVEMENT_LOG.md`): they change only in an organizer-coordinated task that bumps the API version, gets its own log entry, and ships the Apps Script redeploy together with the frontend change. `tests/` contains Node-based behavioral and contract tests: `client-state.test.js` exercises browser state and scoring, `backend-script.test.js` validates the embedded Apps Script, `protocol-fixtures.test.js` checks wire-format fixtures against `src/schema.json`, `smoke.test.js` covers the shared workflow end to end, and `static-check.mjs` checks syntax, accessibility, and required UI hooks. `README.md` documents setup and deployment; `IMPROVEMENTS.md` is the historical backlog and `IMPROVEMENT_LOG.md` tracks queued frontend enhancements.

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
