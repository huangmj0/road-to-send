# Road to Send — agent guide

This is the one guide for every coding agent working here. `CLAUDE.md` only imports it.

**This app is live** at <https://huangmj0.github.io/road-to-send/>, serving a real crew's data from a
shared Supabase backend and from their browsers' localStorage. `index.html` is the deployed artifact and
**stays at the repository root**. Moving or renaming it changes the published URL.

## Workflow

- **Never edit `index.html` by hand.** It is generated from `src/` by `npm run build`. After any
  `src/` change, run `npm run build`, then `npm test`, and commit the regenerated `index.html` and
  `supabase/functions/road-to-send/contract.generated.json` with the source edit.
  `npm run check:generated` is read-only and fails when either artifact is stale.
- `npm test` runs every suite and prints one `PASS`/`FAIL` line per suite. CI runs the same command,
  and `pages.yml` deploys only after it passes.
- **Every test file opens with a `TRAP` comment** that describes its harness's sharp edges. Read it
  before you add assertions to that file.
- `npm run test:supabase` is **not** part of `npm test`. It needs Docker, the Supabase CLI and `psql`
  (`PSQL` overrides the binary). Run `supabase start` and `supabase functions serve` first. It
  refuses any URL that is not loopback and empties every table between tests.
  `.github/workflows/supabase.yml` runs it in CI without secrets.
- `supabase/` is **the** implementation of the wire protocol, the only one the crew runs. Shared
  scenarios in `tests/supabase/scenarios.mjs` and the golden fixture
  `tests/fixtures/supabase-validation.golden.json` pin its behavior. The fixture was recorded once
  from the frozen script by `scripts/capture-validation-golden.mjs`, which only ever reproduces that
  baseline. After an intended validation change, edit the affected `expected` entries by hand and
  review them like any other assertion change; rerunning the generator would restore the old values.
  `legacy/apps-script-v13.js` is the frozen record of the old Sheet redirector. **Never edit it**,
  and never redeploy it for the live crew. Pasting it is only for README's cutover runbook, when a
  crew still on a Sheet moves to Supabase. The function cannot import from `src/`, which is why the build generates its
  contract copy.
- `scripts/import-snapshot.mjs` and `scripts/smoke-check.mjs` are organizer cutover tools, and
  README.md's "Moving the shared backend to Supabase" runbook walks through them. Snapshots and the
  SQL generated from them hold crew data and are **never committed**. The smoke check must stay
  non-mutating: every request it sends comes from its frozen `SMOKE_REQUESTS`.
- `README.md` documents setup and deployment for organizers. Shared-mode changes may require
  organizers to redeploy the Supabase function, as README.md describes.

## Hard constraints

Each constraint below protects **the crew**, the real people whose data and daily use this app
carries. A rule belongs here only if relaxing it would reach them. A change may step outside one only
if it says so explicitly and gives the reason.

Rules about shape bind **the artifact**, the `index.html` that `npm run build` produces. How `src/`
is arranged to produce it is not a constraint. See *Not constraints* below.

1. **This app is LIVE.** Real crew data lives in the shared Supabase backend and in users' localStorage.
   Nothing you ship may drop, rewrite, or re-key that data, and the GitHub Pages URL must not change
   (`index.html` stays at the repository root). `.github/workflows/pages.yml` publishes only from a
   green `npm test`. That gate keeps a broken build off the crew's phones.
2. **localStorage keys are frozen:** `roadToSendEndpoint`, `roadToSendMe`, `roadToSendLogsV9`,
   `roadToSendConfigV9`, `roadToSendConfigV8` (read-only migration source — only the existing
   one-time migration writes `roadToSendConfigV9` from it), `roadToSendWeekReview`, and
   `roadToSendShared:{activities|config|meta}:{endpoint}`. Read them; write only shapes existing code
   already reads. A new shape ships as a new key plus a migration that reads the old one — the V8→V9
   path is the worked example. Renaming a key instead makes a climber's history vanish on their next
   load. `tests/docs-check.mjs` asserts every `roadToSend…` literal in the browser sources the build
   bundles — every `src/*.js` — appears in this list, so a new key means
   updating this section in the same commit.
3. **The browser/backend contract is coordinated.** `src/schema.json`, `src/scoring.json` and the
   Supabase function are shared with a backend that the organizer redeploys by hand. Changing any
   of them **bumps the API version and requires an organizer redeploy of the function.** Deciding whether the
   *previous* version stays in `SUPPORTED_API_VERSIONS` is a compatibility judgement, not a
   formality. Work it out and state it in the comment, as the v11 entry does with "its JSON is
   identical". Keep the old version only if an older function's responses and validation still agree
   with the new browser. That overlap keeps shared mode working for crews whose organizer has not
   redeployed yet. Drop it when the change alters scoring, the bounty catalog or the schema. In that
   case the browser scores with its new `SCORING` while the old function validates against its own
   copy, so claims get rejected and totals disagree. Failing the version check and asking the
   organizer to redeploy is the kinder outcome.
4. **Scoring has one implementation:** `computeCredits()`, `totalsModel()`, `paceInfo()`,
   `weekKey()`, `fmtDay()`, `parseDateOnly()`, and `challengeToday()`. Consume the maps
   `computeCredits()` returns rather than re-deriving them. All challenge-date logic goes through
   `challengeToday()`. Shared mode follows the backend's timezone, so a raw `new Date()` scores the
   wrong day for anyone in another zone. `render()` runs often, so keep display helpers pure,
   idempotent and cheap.
5. **Accessibility:** touch targets are at least 44px. Graphics get `role="img"` with a meaningful
   `aria-label`, and decorative inner elements get `aria-hidden="true"`. Dynamic status text uses
   `aria-live="polite"`. Keep visible focus (the site uses `:focus-visible`). **Motion:** use
   CSS-only transitions and animations so the existing `@media(prefers-reduced-motion:reduce)`
   kill-switch applies. No JS-driven animation.
6. **The page loads cold, on a trailhead connection.** It is one self-contained artifact with no
   runtime dependency on another host and no network request beyond the crew's configured shared-board endpoint.
   `tests/size-check.mjs` caps `index.html` at a byte `BUDGET`. Moving the cap, in either direction,
   needs a change that reports what was measured and why. A cap that only ratchets upward stops being
   a guard. There is one stated exception to "no request beyond the configured endpoint": a shared-mode
   browser follows an organizer-set `movedTo` to the new endpoint. The organizer controls the
   backend that names it (today the old Sheet redirector), the URL must be `https`, and the browser follows it at most once per page load.
7. **What the built artifact holds:** exactly **one `<script>`** and exactly **one `<table>`** in
   `index.html` (new visualizations use divs/CSS grid). The built `const SUPPORTED_API_VERSIONS` line
   survives intact. DOM ids stay unique, and every labeled input keeps its `<label for>`.
8. **Tests only get stronger.** Moving an assertion onto a surface that proves more, such as
   rendered DOM rather than matched source text, counts as strengthening it and is encouraged.
   Retiring an assertion requires the feature to be gone, and the PR must name each retired
   assertion. An assertion for a feature that still exists stays.
   **Declared exception, scoped to the real-Supabase job:** the assertions in
   `tests/supabase-stack.test.mjs` run only where Docker and the Supabase CLI exist, which means the
   `supabase.yml` CI job and a maintainer's machine. They do not run under `npm test`, which must keep
   passing without those tools. The suite is still bound by this rule. Any scenario it runs lives in
   `tests/supabase/scenarios.mjs`, so `npm test` also runs that scenario in-process.

## Not constraints

Changing these reaches nobody on the crew, so change them freely, in a commit that says what it did.
They are listed because they read like rules but are not. Read both lists before you conclude that a
design is blocked.

- **Dev tooling.** This covers bundlers, minifiers, linters, formatters, type checking, test runners
  and DOM implementations. A dev dependency that the crew never downloads is not a runtime
  dependency, and constraint 6 still governs anything that ships. Pin dev dependencies to exact
  versions, with the lockfile updated in the same commit, so the artifact stays reproducible.
- **The layout of `src/`.** It can be one file or thirty, modules or globals, as long as the build
  collapses it into the artifact constraint 7 describes.
- **Compact source style.** It dates from before the build had a minifier. esbuild now minifies the
  bundled browser sources, so new code there can be written for people to read. `src/styles.css`
  is still inlined as written. When you edit in place, match the local
  style.
- **The shape of the test suites.** This covers how they split, which harness they use and how they
  load the code under test. Constraint 8 governs what an assertion proves, not which file it lives in.
- **`BUDGET`'s exact number.** The guard is the ratchet discipline in constraint 6, not the figure.

## Tone

The app runs on a real crew's shared data, and everyone in the crew sees the same board. **Nothing
here adds a nudge, a reminder, or a prompt to participate.**

- **Surface what people did, never what they didn't do.** That rules out absence counts, laggard
  lists, "you haven't logged" copy, per-person zero-week callouts, streak-loss warnings and "still
  time to log today" prompts.
- **Aggregating does not launder it.** A crew-wide participation figure is the same nudge with the
  names filed off, and it is equally out of scope.
- **Nothing new opens, appears, or speaks on its own.** Every surface is reached by a tap. The one
  persistent element, the undo bar, carries its own dismissal and clears when the user moves on.
- New information appears **only where the user went looking for it**: their own card, their own
  feed, or the diagnostics they opened.

## Code and tests

- Anything that ships to the browser uses browser APIs only. Build and test code may take dev
  dependencies.
- Naming: use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for scoring and
  configuration constants, and kebab-case for CSS classes and HTML filenames. Keep DOM ids
  descriptive and unique.
- Tests use `node:test` and `node:assert/strict`. Name cases after the expected outcome. Add
  regression coverage for scoring limits, date and timezone boundaries, malformed remote data, API
  validation, accessibility labels and sync ordering.
- Where a new assertion goes:
  - Pure scoring, date and text helpers go in `tests/client-state.state.test.js`.
  - Anything that needs `render()` and a document goes in `tests/client-state.dom.test.js`.
  - Shared-mode behavior behind a stubbed `fetch` goes in `tests/client-state.shared.test.js`.
  - DOM and accessibility presence checks go in `tests/static-check.mjs`.
- Copy must not trip the banned-strings assertion in `tests/static-check.mjs`. The banned strings
  are "Hard mode", "Super hard mode", "pull-up mode", "Record send pyramid" and "Balanced week
  bonus".

## Domain language and decisions

- Before you explore an area, read `CONTEXT.md` (the glossary) and any ADR in `docs/adr/` that
  touches it. If a file you expect is missing, carry on without comment. These files are created
  lazily, once terms and decisions are actually resolved.
- When your output names a domain concept, such as an issue title, a proposal or a test name, use
  the term `CONTEXT.md` defines and avoid the synonyms it lists. If a concept you need is missing,
  either you are inventing language the project doesn't use or the glossary has a real gap. Say
  which.
- If your work contradicts an ADR, say so explicitly, for example *"Contradicts ADR-0004 (Supabase is
  the only backend) — but worth reopening because…"*. Do not override it silently.
- New ADRs are `docs/adr/NNNN-short-title.md`, numbered in sequence, with `status:` frontmatter.

## Issues and triage

Issues and specs live as GitHub issues in `huangmj0/road-to-send`. Use the `gh` CLI for everything.

- Read an issue with `gh issue view <n> --comments`. Create one with
  `gh issue create --title … --body …`, using a heredoc for multi-line bodies.
- GitHub numbers issues and PRs from the same sequence, so a bare `#42` could be either. Resolve it
  with `gh pr view 42` and fall back to `gh issue view 42`. Pull requests are **not** a triage
  surface here.
- Triage uses these five state labels:

  | Label             | Meaning                                  |
  | ----------------- | ---------------------------------------- |
  | `needs-triage`    | Maintainer needs to evaluate this issue  |
  | `needs-info`      | Waiting on the reporter for more information |
  | `ready-for-agent` | Fully specified, ready for an AFK agent  |
  | `ready-for-human` | Requires human implementation            |
  | `wontfix`         | Will not be actioned                     |

- For multi-issue work, one **map** issue labelled `wayfinder:map` holds Notes, Decisions so far and
  Fog. Each child ticket is a GitHub sub-issue of the map, labelled `wayfinder:<type>` (`research`,
  `prototype`, `grilling` or `task`). Where sub-issues aren't available, add the child to a task
  list in the map body (that list sets map order) and put `Part of #<map>` at the top of the child.
  - Record blocking with GitHub's native issue dependencies. The fallback is a `Blocked by: #<n>`
    line at the top of the child. A ticket is unblocked once every blocker is closed.
  - The next ticket to work on is the first open, unassigned and unblocked child in map order.
  - Claim it with `gh issue edit <n> --add-assignee @me` as the session's **first write**, before any
    other change, so no other agent picks the same ticket.
  - Resolve it by commenting the answer, closing it, and appending a pointer to the map's Decisions
    so far.

## Commits and pull requests

- Commit subjects are short and imperative, such as `Fix weekly bounty eligibility`. Keep each
  commit focused.
- Pull requests use `.github/pull_request_template.md`. Describe the user-visible behavior, any
  scoring or API compatibility effects and the `npm test` result. Link the relevant issues, and
  include screenshots for UI changes. Name every retired assertion (see constraint 8).
- **Never commit** live backend or Apps Script endpoints, shared crew URLs, Sheet data or snapshots.
