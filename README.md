# Road to Send

A mobile-friendly group fitness challenge for an upcoming climbing trip.

## Live site

https://huangmj0.github.io/road-to-send/

## What it includes

- Six activities with points derived by the server
- Duration-scaled climbing: 3 points for 60–119 minutes, 4 for 120–179, and 5 for 180+
- A 16-point weekly activity cap, plus a +2 balanced-week bonus and up to two difficulty-scaled 1–3 point bounties (24 max)
- Per-activity weekly limits, one scoring climbing session per day, and recovery-day conflict checks
- Non-scoring new-area, new-style, and project-progress tags on climbing sessions
- Three rotating daily bounties with fun names, simple descriptions, difficulty-scaled points, and at least two solo/no-equipment choices each day
- Week 1 and final-week send-pyramid check-ins for a personal-baseline Most Improved award
- Group progress and leaderboard
- Personal weekly progress ("You this week") for the remembered logger, plus a group points-per-week trend chart
- Recent activity feed with delete/undo for mistaken entries (works in both local and shared mode)
- Live sync status with a manual refresh control
- Centrally managed inclusive challenge window, crew roster, and group goal
- Shared logging through a private-to-your-group Google Sheet

## Turn on shared logging

GitHub Pages hosts the interface, but a static site cannot save group activity by itself. One organizer completes this once:

1. Open the live site and select **Shared setup**.
2. Create a Google Sheet, then open **Extensions → Apps Script**.
3. Copy the Apps Script shown in the setup window into the editor.
4. Select **Deploy → New deployment → Web app**.
5. Set **Execute as** to yourself and access to **Anyone**.
6. Paste the resulting `/exec` URL into the site and press **Test connection** to confirm the deployment answers correctly before saving.
7. Set the challenge start date, inclusive trip date, group goal, and comma-separated crew names.
8. Select **Save centrally & copy crew link**, then send that generated link to everyone.

API version 6 creates four active tabs in the Sheet:

- `Activities` stores duration bands, tags, activities, and bounty claims.
- `Settings` stores `challengeStart`, `tripDate`, and `groupGoal`.
- `Participants` stores one crew member per row.
- `Benchmarks` stores baseline and final send pyramids.

The first version-5 request started the redesigned challenge fresh by archiving older activity rows. Upgrading from version 5 to version 6 preserves active activities and adds the explicit challenge window. A pre-version-5 sheet is still archived to a timestamped `Activities Archive …` tab rather than deleted.

You can edit `Settings` or `Participants` directly in Google Sheets at any time. Every connected browser makes a cache-bypassing read on its next sync (normally within 45 seconds), so changing the roster or goal does not require a redeploy or a new crew link. Tap the sync status under the progress bar to refresh immediately. Existing activity rows remain intact when a participant is removed.

Settings keys ignore capitalization, spaces, underscores, and hyphens, so `challengeStart`, `Challenge Start`, and `challenge_start` are equivalent. Start and trip dates may be Sheet date cells, `YYYY-MM-DD`, US-style `MM/DD/YYYY`, or unambiguous named-month dates such as `November 15, 2026`. Both boundary days count; activities before the start or after the trip are rejected. The group goal must be a whole number from 50 through 10,000.

The version 6 read response is `{ version, features, activities, benchmarks, config, configErrors, serverDate, timeZone, fetchedAt }`. Feature flags are `scoring-v2`, `bounties`, `benchmarks`, and `challenge-window`. The config shape is `{ startDate, tripDate, goal, crew }`. Invalid settings produce `config: null` plus field-specific errors while valid activity rows still load. Writes return `{ version: 6, ok, ... }`; failures include `{ error: { code, message, details } }`. The machine-readable contract lives in `src/schema.json`.

The backend ignores submitted point values. It derives climbing points from `durationBand`, derives other points from the activity type, validates climbing tags, enforces daily/weekly eligibility, and uses the Sheet timezone for bounty dates. A bounty requires a positively credited climbing session that day, one claim per day, and no more than two claims per week.

Relative bounty terms are deliberately personal rather than gendered: “your limit” is the hardest level sent recently, “flash level” is a level usually sent first try, and “project” is a climb with completed individual moves but no send.

For Most Improved, each climber records five Week 1 sends and five final-week sends from the same gym and ordered scale. The app compares mean grade movement, then improvement in the lowest send as the tiebreaker. Bounties do not affect this award.

The script also supports deleting entries: the activity feed shows a small **×** on each recent entry, which removes the matching row from the Sheet (and doubles as undo for a mistaken log).

**Already deployed an earlier version?** Paste the new script over the old one, then choose **Deploy → Manage deployments → Edit → Version: New version → Deploy**. The web-app URL stays the same. The site accepts only API v6 responses because older responses do not define the challenge window.

The generated link carries the shared Sheet connection; the challenge settings come from the Sheet itself. Anyone with that link can submit or change setup through the site, so only share it with the climbing group and do not store sensitive information.

## Data ownership, backup, and recovery

The Google Sheet is the authoritative copy in shared mode. Browser storage is only an endpoint-specific offline cache. Local demo activities use different storage and are never uploaded or merged when a crew link is opened. **Export current snapshot** downloads the current browser view (settings, activities, benchmarks, protocol version, and last successful sync) as JSON for reference; it is not an automatic Sheet restore file.

For organizer backups:

1. In Google Sheets, choose **File → Make a copy** before changing the Apps Script, tab structure, or large amounts of data. Name the copy with the date.
2. For an offline backup, choose **File → Download → Microsoft Excel (.xlsx)**. Keep the Apps Script source separately because Sheet downloads do not include the bound script project.
3. Optionally select **Export current snapshot** in the site after a successful sync. Confirm its `mode` is `shared-cache` and `lastSuccessfulSync` is current before relying on it as a reference export.

To recover accidental edits or deleted rows, open the authoritative Sheet and use **File → Version history → See version history**, inspect the target version, then restore it. After restoration, select the sync status in the site and verify the protocol version, last successful sync time, totals, and recent activity. For a larger incident, keep the damaged Sheet unchanged, make a copy of the known-good backup, redeploy the current embedded Apps Script from that copy, and test its new `/exec` URL before distributing a replacement crew link. Do not paste rows from an older schema or an `Activities Archive …` tab into the active tabs; use the archive for reference and reconcile entries through the current interface.

Write messages deliberately distinguish two outcomes. **Save failed** means the Sheet did not confirm the write and it is safe to retry. **Saved to the Sheet, but refresh failed** means the write was confirmed; do not submit it again, because that can create a duplicate. Select the sync status to refresh instead. If sync still fails, copy the sanitized `RTS-…` error code from diagnostics when asking the organizer for help; the code does not contain the Sheet URL or activity details.

## Development

The deploy artifact remains self-contained in `index.html`, while maintainable sources live in `src/`: `index.template.html`, `styles.css`, `app.js`, and `apps-script.js`. `schema.json` defines protocol v6, and `scoring.json` is injected into both browser and backend code so scoring constants cannot drift.

Run `npm run build` after changing source files. `npm run check:generated` verifies that the committed `index.html` matches them. Pushes to `main` deploy the generated artifact through the Pages workflow.

Run `npm test` before publishing. It checks the generated artifact, embedded backend contracts, scoring/state behavior, protocol fixtures, the shared-workflow smoke test, and static accessibility/UX hooks. GitHub Actions runs the same command for pushes and pull requests.

See `IMPROVEMENTS.md` for the prioritized product and engineering backlog.
