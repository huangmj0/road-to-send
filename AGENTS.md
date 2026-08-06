# Road to Send — Codex orientation

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
- Set `Status: In progress — <date>` first. `Done` means implemented and reviewed locally; up to
  `BATCH_MAX` entries remain uncommitted until exit `6` ships them as one squashed commit.
- Shipped entries live under `docs/archive/`, split by pass and indexed by `IMPROVEMENTS.md`. That
  is the archive, not a queue — never work from it, and when you do need to look something up, read
  the one pass file that holds it.

## Codex workflows

- Invoke `$road-to-send-entry` to drive Codex through one entry and leave its reviewed diff
  uncommitted, or to ship the accumulated batch on exit `6`.
- Invoke `$road-to-send-review` only as a fresh independent judge for a ready batch PR. It returns
  findings only; Codex applies them and a new reviewer judges the changed head.
- Invoke `$road-to-send-refill` only when the queue is empty to propose new entries in a queue-only
  draft PR.
- Ship and refill open their PR as a draft and mark it **ready for review** once local suites and
  CI are green. Neither may merge. Drain sends a batch PR to a fresh review agent and may perform
  only an atomic non-force fast-forward when the approved head is the sole child of the approved
  base. `scripts/queue-git-guard.mjs` enforces initial entry publication, reviewer lease updates,
  and release. If `main` advances, Git rejects the release and a fresh review is required.
- “Independent” means a fresh agent context that did not implement or modify the head. The current
  setup uses one GitHub account, so GitHub cannot attest separate reviewer identity. Enforcing that
  stronger boundary requires a separately credentialed GitHub App or bot; do not represent the
  fresh-context boundary as a distinct GitHub approval.
- Invoke `$road-to-send-drain` for one context-light tick. It either implements one entry through a
  fresh pre-commit reviewer (plus rendered design review for major UI), or ships and releases one
  batch through fresh PR review. On an empty queue it reports completion; refill stays deliberate.
- The loop is a generator/discriminator split. The repo wrapper pins Codex roles from mini/low
  read-only scouting through Terra/medium writes to Sol/high diagnosis. Claude entry/drain drivers
  stay cheap and context-light; pre-commit, design, PR review, and refill use Opus/high because they
  make the judgment and design decisions. `docs/loop-prompt.md` carries the full rationale.
- The Codex skills live under `.agents/skills/`; the Claude Code commands remain under
  `.claude/commands/`, with the subagent tiers pinned in `.claude/agents/`.
  `docs/loop-prompt.md` is the shared operator guide.

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

- `npm run queue` reports the queue and open batch and refreshes `origin/main`. Its exit codes are `0` clear to start, `3` empty, `4` an unmerged published batch, `5` stale `In progress`, and `6` batch ready to ship. `--ship` forces a non-empty batch to exit `6`; `--no-fetch` reports against local refs; a path reads a fixture.
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
