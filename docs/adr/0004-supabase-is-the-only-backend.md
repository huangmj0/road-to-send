---
status: accepted
---

# Supabase is the only backend

Supersedes ADR-0003.

## Context

The shared board used to run on a Google Sheet with an Apps Script that each organizer pasted in
and redeployed by hand. Cutover (#182, 2026-10-01) moved the live crew to the Supabase function in
`supabase/functions/road-to-send/`, which had been built as a second implementation of the same
wire protocol and kept equal to the Apps Script by a parity suite. The old Sheet stays deployed at
API v13 as a redirector: it serves its frozen board on GET with `movedTo` set and refuses writes.
Crew links in chats still carry `?sheet=<apps-script-url>`, so that Sheet must keep answering.

Keeping two implementations after cutover would cost every contract change a hand redeploy of a
script nobody runs, and the Apps Script source shipped inside `index.html` (about 22 KB) for a
backend no new crew would use.

## Decision

- The Supabase function is the only implementation of the contract. New crews deploy it by
  following README.md's "Shared setup".
- The Apps Script is frozen at v13 in `legacy/apps-script-v13.js` as a record of what the redirector
  runs. It is never edited, and the live crew's redirector is never redeployed; the README cutover
  runbook may still paste it to freeze another crew's Sheet. It is no longer embedded in the artifact or offered
  in the setup dialog.
- The browser follows a valid `https` `movedTo` before the version check, still at most once per
  page load and after dropping superseded responses. Old `?sheet=` links therefore survive future
  API version bumps, even though the frozen Sheet will only ever report v13.
- A contract change (`src/schema.json`, `src/scoring.json` or the function) still bumps the API
  version, but now needs only a redeploy of the Supabase function.

## Consequences

- The Apps Script parity suite became a golden fixture
  (`tests/fixtures/supabase-validation.golden.json`, recorded once from the frozen script by
  `scripts/capture-validation-golden.mjs`; later intended changes edit its expectations by hand) plus the shared conformance scenarios.
- The core's 184-day bounty rotation is still compared live against the frozen script. An intended
  catalog or rotation change records those outputs in the golden fixture instead and edits them by
  hand. That moves the assertion; it does not retire it.
- The rotation agreement test now pins the browser's `dailyBounties()` against the function's
  `core.mjs`, so ADR-0003's two-way pin is retargeted rather than dropped.
- The artifact is about 22 KB smaller.
- `legacy/apps-script-v13.js` keeps its redirector behavior tests (`tests/backend-script.test.js`).
- Editing entries, previously blocked by having to ship it through every organizer's script, is now
  feasible as API v14 and is a follow-up, not part of this decision.
