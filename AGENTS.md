# Repository Guidelines

## Project Structure & Module Organization

This is an intentionally self-contained static application. The editable sources live in `src/`: `index.template.html` (markup), `styles.css`, `app.js` (browser code), `apps-script.js` (the Google Apps Script source shown during shared setup), plus the shared `scoring.json` and `schema.json` contracts. `scripts/build.mjs` inlines them into the generated `index.html` at the repository root — never edit `index.html` by hand; `scripts/check-generated.mjs` fails if the committed artifact is stale. Keep changes to those layers coordinated, especially scoring constants and API version checks. `tests/` contains Node-based behavioral and contract tests: `client-state.test.js` exercises browser state and scoring, `backend-script.test.js` validates the embedded Apps Script, `protocol-fixtures.test.js` checks wire-format fixtures against `src/schema.json`, `smoke.test.js` covers the shared workflow end to end, and `static-check.mjs` checks syntax, accessibility, and required UI hooks. `README.md` documents setup and deployment; `IMPROVEMENTS.md` is the historical backlog and `IMPROVEMENT_LOG.md` tracks queued frontend enhancements.

## Build, Test, and Development Commands

- `npm run build` regenerates `index.html` from `src/`. Run it after any `src/` change and commit the regenerated artifact alongside the source edits.
- `npm test` runs the generated-artifact check plus all behavioral, backend-contract, and static checks. Run it before every pull request; `.github/workflows/test.yml` runs the same suite in CI, and `pages.yml` deploys the repository root to GitHub Pages on pushes to `main`.
- `python3 -m http.server 8000` serves the repository locally; open `http://localhost:8000/` to exercise browser behavior.

Pushes to `main` are expected to deploy the static page through GitHub Pages. Shared-mode changes may also require copying and redeploying the embedded Apps Script as described in `README.md`.

## Coding Style & Naming Conventions

Use two-space indentation in HTML and test files. Preserve the existing compact style inside inline CSS, browser code, and the embedded Apps Script unless a change deliberately restructures the file. Prefer `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for scoring/configuration constants, and kebab-case for CSS classes and HTML filenames. Keep DOM IDs descriptive and unique. Use Node built-ins and browser APIs; do not add dependencies without a clear maintenance benefit.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`; no external framework or coverage threshold is configured. Name behavioral cases by expected outcome, and add regression coverage for scoring limits, date/timezone boundaries, malformed remote data, API validation, accessibility labels, and sync ordering. Because tests extract scripts directly from `index.html`, preserve the script boundaries and embedded `SCRIPT` declaration they match.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects such as `Fix weekly bounty eligibility`. Keep commits focused. Pull requests should explain user-visible behavior, identify scoring or API compatibility effects, link relevant issues, include screenshots for UI changes, and report `npm test` results. Never commit live Apps Script endpoints, shared crew URLs, or sensitive Sheet data.
