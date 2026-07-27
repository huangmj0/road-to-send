# v11 pass — shipped without a log entry (backfill B1–B5)

Five feature commits reached the live site without a queue entry. They are recorded here as stubs so
the archive matches the shipped app. The `B` prefix is deliberate: these labels can never collide
with the queue's integers, so no future entry number is consumed by backfilled history.

## B1. First-open Week in Review recap

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `cb77882` ("Add first-open Week in Review recap") added a celebratory modal shown on the first app open of each ISO week, and immediately after a brand-new user is assigned a profile: the viewer's previous-week points, active days and hardest grade (with a welcome fallback for users with no history), the weeks remaining in the challenge, and the previous week's top three point contributors plus its 🏹 Bounty Hunter, all derived client-side from the raw logs via `computeCredits()` — no API, schema, URL or scoring change. It also introduced the client-only `roadToSendWeekReview` localStorage key that gates the modal to once per week; that key was missing from rule 4's frozen list until entry 15 corrected it, which is why `tests/docs-check.mjs` now asserts every `roadToSend…` literal in `src/app.js` appears in that list.

---

## B2. All-time bounty leaderboard view and champions callout

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `f45e3a3` ("Add all-time bounty leaderboard view and champions callout") added a third "Bounties" segment to the Crew leaderboard toggle ranking climbers by total bounties completed across the whole challenge, counting every claim including those past the weekly 6-point cap, consistent with how the 🏹 Bounty Hunter tag is decided. `computeCredits()` gained a `bountyTotal` map, `totalsModel()` exposes `bountiesTotal` per row, the Bounties view re-ranks the same single table by it while swapping the last two column headers, and a champions line names the current points leader and most-bounties leader (ties shared) without hard-coding prizes. Covered by additions to `tests/client-state.test.js` and `tests/static-check.mjs`.

---

## B3. Split leaderboard toggle into metric and time range

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `21a2ee9` ("Split leaderboard toggle into metric and time range") replaced the single three-way toggle shipped by entry 13 and B2 — which mixed two dimensions, so points had Weekly/Overall but bounties only an all-time view — with two toggles, `#leaderMetricToggle` (`#leaderPointsBtn`/`#leaderBountyBtn`) and `#leaderScopeToggle` (`#leaderWeekBtn`/`#leaderOverallBtn`), giving all four combinations. `leaderView` split into `leaderMetric` and `leaderScope` with the sort key chosen from the pair (`week`, `total`, `bounties`, `bountiesTotal`); the columns became fixed "This week" and "Overall" with the active one highlighted and the table carrying a dynamic `aria-label`; the champions block lists weekly and overall leaders for both metrics. This is the commit that supersedes entry 13's `#leaderToggle` ids; `tests/static-check.mjs` asserts the current ones.

---

## B4. New directional bounties

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `3a7da67` ("Add new directional bounties") added 6 climbing, 2 exercise and 4 mobility bounties to the catalog in `src/scoring.json`, in the same effort-focused style as the existing set. It edited a shared contract file that rule 2 places out of scope for log-driven entries, and it enlarged the catalog without bumping the API version — daily bounties are picked by hashing the date across the pool, so a larger catalog reshuffles every day's picks. B5 is the follow-up that repaired the resulting client/backend drift; together they are the concrete reason entry 15 made rule 2 and `AGENTS.md` agree that `scoring.json`, `schema.json` and `apps-script.js` change only in an organizer-coordinated task that bumps the API version and gets its own entry.

---

## B5. Bump protocol to v11 so catalog changes reject stale backends

Status: Done — shipped without a log entry (backfilled 2026-07-25)
Notes: Commit `0695742` ("Bump protocol to v11 so catalog changes reject stale backends") advanced the API version in `src/schema.json` (plus the client check, README and fixtures) after B4 enlarged the bounty catalog under version 10. Because the version had not moved, an updated site still accepted a not-yet-redeployed v10 Apps Script computing the smaller catalog, so the site could offer a bounty the server refused as "not available on that date". A v11 client now refuses a v10 endpoint with "Apps Script update required", forcing the organizer redeploy that keeps both sides on one catalog; the catalog itself was untouched, so the offered bounties did not change. This is the organizer-coordinated shape of change that rule 2 reserves for its own entry.
