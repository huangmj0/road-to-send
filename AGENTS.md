# Repository Guidelines

## Project Structure & Module Organization

This is an intentionally self-contained static application. `index.html` contains the markup, compact CSS, browser JavaScript, and the Google Apps Script source shown during shared setup. Keep changes to those layers coordinated, especially scoring constants and API version checks. `tests/` contains Node-based behavioral and contract tests: `client-state.test.js` exercises browser state and scoring, `backend-script.test.js` validates the embedded Apps Script, and `static-check.mjs` checks syntax, accessibility, and required UI hooks. `README.md` documents setup and deployment; `IMPROVEMENTS.md` is the prioritized backlog.

## Build, Test, and Development Commands

- `npm test` runs all behavioral, backend-contract, and static checks. Run it before every pull request.
- `python3 -m http.server 8000` serves the repository locally; open `http://localhost:8000/` to exercise browser behavior. There is no compilation or bundling step.

Pushes to `main` are expected to deploy the static page through GitHub Pages. Shared-mode changes may also require copying and redeploying the embedded Apps Script as described in `README.md`.

## Coding Style & Naming Conventions

Use two-space indentation in HTML and test files. Preserve the existing compact style inside inline CSS, browser code, and the embedded Apps Script unless a change deliberately restructures the file. Prefer `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for scoring/configuration constants, and kebab-case for CSS classes and HTML filenames. Keep DOM IDs descriptive and unique. Use Node built-ins and browser APIs; do not add dependencies without a clear maintenance benefit.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`; no external framework or coverage threshold is configured. Name behavioral cases by expected outcome, and add regression coverage for scoring limits, date/timezone boundaries, malformed remote data, API validation, accessibility labels, and sync ordering. Because tests extract scripts directly from `index.html`, preserve the script boundaries and embedded `SCRIPT` declaration they match.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout, so use short, imperative commit subjects such as `Fix weekly bounty eligibility`. Keep commits focused. Pull requests should explain user-visible behavior, identify scoring or API compatibility effects, link relevant issues, include screenshots for UI changes, and report `npm test` results. Never commit live Apps Script endpoints, shared crew URLs, or sensitive Sheet data.
