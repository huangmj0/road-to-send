---
status: accepted
---

# The bounty rotation stays duplicated, and is pinned by a test instead

`dailyBounties()`, `hashText()`, `bountyById()` and `normalizeCrew()` are implemented twice — once
in `src/app-core.js` and once in `src/apps-script.js` — in deliberately different code. The rotation
rule is load-bearing across the wire: the browser offers a day's three bounties, and
`validateActivity()` in the backend rejects a claim that is not in *its* computed set. Only the
bounty catalog lives in the shared contract (`src/scoring.json`); the selection rule does not.

The build tool from ADR-0001 makes injecting one shared module into both possible. We still do not
do it. Each crew's organizer deploys the Apps Script by hand, so a shared module only protects a
backend once that organizer redeploys — the fix is slow-acting and arrives crew by crew, while the
drift it guards against is immediate.

Instead the two `dailyBounties()` implementations are pinned to each other by
`tests/bounty-rotation-agreement.test.js`, which loads both contexts and asserts identical id
sequences across a long date range. Scope is the rotation only — `bountyById()`, `hashText()` and
`normalizeCrew()` stay uncovered by it, and `normalizeCrew()` deliberately differs (the backend
raises `apiError` on an over-long name where the browser drops the row), so it is not a candidate
for an identity assertion. The rotation is the one whose drift silently rejects a claim the UI
offered. It costs no shipped bytes, protects every crew immediately including those on a
not-yet-redeployed backend, and fails the build on drift.

Revisit if the Apps Script ever gains a deploy path that does not depend on a human copying it.
