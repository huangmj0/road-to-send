# Road to Send — repository guidelines

**This app is live** at <https://huangmj0.github.io/road-to-send/>, serving a real crew's data from a
shared Google Sheet and from their browsers' localStorage. `index.html` is the deployed artifact and
**stays at the repository root** — moving or renaming it changes the published URL.

## Project structure & module organization

This is an intentionally self-contained static application. The editable sources live in `src/`:
`index.template.html` (markup), `styles.css`, `app.js` (browser code), `apps-script.js` (the Google
Apps Script source shown during shared setup), plus the shared `scoring.json` and `schema.json`
contracts. `scripts/build.mjs` inlines them into the generated `index.html` at the repository root —
never edit `index.html` by hand; `scripts/check-generated.mjs` fails if the committed artifact is
stale.

`tests/` contains Node-based behavioral and contract tests. The client-state suites all eval the
built script and split by harness so a change loads only the one it touches:
`client-state.state.test.js` covers pure scoring, date and text helpers with no DOM,
`client-state.dom.test.js` runs `init()`/`render()` against a document stub, and
`client-state.shared.test.js` covers shared mode behind a stubbed `fetch`; `harness.js` holds the
script extraction and the element stub they share. Alongside them, `backend-script.test.js`
validates the embedded Apps Script, `protocol-fixtures.test.js` checks wire-format fixtures against
`src/schema.json`, `smoke.test.js` covers the shared workflow end to end, `static-check.mjs` checks
syntax, accessibility, and required UI hooks, `docs-check.mjs` checks the documented invariants
below, and `size-check.mjs` caps the bundle.

**Every test file opens with a `TRAP` comment describing its harness's sharp edges — read it before
adding assertions to that file.** `README.md` documents setup and deployment.

## Build, test, and development commands

- `npm run build` regenerates `index.html` from `src/`. Run it after any `src/` change and commit the
  regenerated artifact alongside the source edits.
- `npm test` runs `scripts/run-tests.mjs`, which runs every suite — the generated-artifact check plus
  the behavioral, backend-contract, static, documentation, and bundle-size checks — without
  short-circuiting, prints a `PASS`/`FAIL` line per suite, and exits non-zero if any failed. Run it
  before every pull request; `.github/workflows/test.yml` runs the same suite in CI, and `pages.yml`
  runs it again in a `verify` job that gates the deploy job, which publishes only `index.html` to
  GitHub Pages on pushes to `main`.
- `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`.
- `python3 -m http.server 8000` serves the repository locally; open `http://localhost:8000/` to
  exercise browser behavior.

Pushes to `main` are expected to deploy the static page through GitHub Pages. Shared-mode changes may
also require copying and redeploying the embedded Apps Script as described in `README.md`.

## Hard constraints

These are properties of a live app with real users, not workflow preferences. A change may step
outside one only when it says so explicitly and says why.

1. **This app is LIVE.** Real crew data lives in a shared Google Sheet and in users' localStorage.
   Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change
   (`index.html` stays at the repository root).
2. **The browser/backend contract is coordinated.** `src/apps-script.js`, `src/schema.json` and
   `src/scoring.json` are the shared contract; any change there forces an API version bump and an
   organizer redeploy of the Apps Script alongside the frontend change. Do not touch them as a side
   effect of a frontend change.
3. **Never weaken a test to make a change pass.** A change that *deliberately removes a feature* may
   retire that feature's assertions, but only by naming each assertion retired and why. Retiring an
   assertion for a feature that still exists is always forbidden. `tests/size-check.mjs` caps
   `index.html` at a byte `BUDGET`: raise `BUDGET` deliberately, in a change that explains the
   growth — never as a side effect of another change.
4. **localStorage keys are frozen:** `roadToSendEndpoint`, `roadToSendMe`, `roadToSendLogsV9`,
   `roadToSendConfigV9`, `roadToSendConfigV8` (read-only migration source — only the existing
   one-time migration writes `roadToSendConfigV9` from it), `roadToSendWeekReview`, and
   `roadToSendShared:{activities|config|meta}:{endpoint}`. Read them; never rename them; only write
   shapes existing code already reads. `tests/docs-check.mjs` asserts every `roadToSend…` literal in
   `src/app.js` appears in this list, so a new key means updating this section in the same commit.
5. **Structural constraints enforced by tests:** exactly **one `<script>` block** in the template
   (all JS goes in `src/app.js`); exactly **one `<table>`** in the page (new visualizations use
   divs/CSS grid); the built lines ``const SCRIPT=`…`;`` and the `const SUPPORTED_API_VERSIONS` line
   immediately after it are untouchable (no backticks may enter the Apps Script string); DOM ids stay
   unique; every labeled input keeps its `<label for>`.
6. **Reuse the scoring core:** `computeCredits()`, `totalsModel()`, `paceInfo()`, `weekKey()`,
   `fmtDay()`, `parseDateOnly()`, and `challengeToday()`. Never call `new Date()` for challenge-date
   logic — shared mode follows the Sheet's timezone via `challengeToday()`. Never fork or re-derive
   scoring math; consume the maps `computeCredits()` returns. New display logic = small pure helper
   functions called from `render()`; `render()` runs often, so keep additions idempotent and cheap.
7. **Accessibility:** minimum 44px touch targets; graphics get `role="img"` with a meaningful
   `aria-label` text alternative (decorative inner elements `aria-hidden="true"`); dynamic status text
   uses `aria-live="polite"`; keep visible focus (site uses `:focus-visible`). **Motion:** CSS-only
   transitions/animations so the existing `@media(prefers-reduced-motion:reduce)` kill-switch applies;
   no JS-driven animation.
8. **No external dependencies (runtime or dev), no new network requests, no frameworks, no
   build-tool changes.**

## Tone

This app runs on a real crew's shared data, and everyone in it sees the same board. **Nothing here
adds a nudge, a reminder, or a prompt to participate.**

- **Surface what people did, never what they didn't.** No absence counts, no laggard lists, no "you
  haven't logged" copy, no per-person zero-week callout, no streak-loss warnings, no "still time to
  log today" prompts.
- **Aggregating does not launder it.** A crew-wide participation figure is the same nudge with the
  names filed off, and is equally out of scope.
- **Nothing new opens, appears, or speaks on its own.** Every surface is reached by a tap, and the one
  persistent element (the undo bar) carries its own dismissal and clears when the user moves on.
- New information is reported **only where the user went looking for it** — their own card, their own
  feed, the diagnostics they opened.

## Coding style & naming conventions

Use two-space indentation in HTML and test files. Preserve the existing compact style inside inline
CSS, browser code, and the embedded Apps Script unless a change deliberately restructures the file.
Prefer `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for scoring/configuration
constants, and kebab-case for CSS classes and HTML filenames. Keep DOM IDs descriptive and unique.
Use Node built-ins and browser APIs only.

## Testing guidelines

Tests use `node:test` and `node:assert/strict`; no external framework or coverage threshold is
configured. Name behavioral cases by expected outcome, and add regression coverage for scoring
limits, date/timezone boundaries, malformed remote data, API validation, accessibility labels, and
sync ordering. Because tests extract scripts directly from `index.html`, preserve the script
boundaries and embedded `SCRIPT` declaration they match.

Behavioral coverage for new helpers goes in the client-state suites, which eval the built script so
new top-level helper functions are directly reachable — `tests/client-state.state.test.js` for pure
scoring/date/text helpers, `tests/client-state.dom.test.js` for anything that needs `render()` and a
document, `tests/client-state.shared.test.js` for shared-mode behaviour behind a stubbed `fetch`.
DOM/a11y presence assertions go in `tests/static-check.mjs`. Copy must not trip the banned-strings
assertion in `static-check.mjs` (no "Hard mode", "Super hard mode", "pull-up mode", "Record send
pyramid", "Balanced week bonus").

## Commit & pull request guidelines

Use short, imperative commit subjects such as `Fix weekly bounty eligibility`. Keep commits focused.
Pull requests should explain user-visible behavior, identify scoring or API compatibility effects,
link relevant issues, include screenshots for UI changes, and report `npm test` results. Never commit
live Apps Script endpoints, shared crew URLs, or sensitive Sheet data.

## Agent skills

This repo uses [Matt Pocock's skills](https://github.com/mattpocock/skills), vendored under
`.agents/skills/` and pinned by `skills-lock.json`. `CLAUDE.md` records the per-repo configuration
they read; `npx skills@latest update` refreshes them.
