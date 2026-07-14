# Road to Send

A mobile-friendly group fitness challenge for a November climbing trip.

## Live site

https://huangmj0.github.io/road-to-send/

## What it includes

- Six activities with points derived by the server
- Duration-scaled climbing: 3 points for 60–119 minutes, 4 for 120–179, and 5 for 180+
- A 16-point weekly activity cap, plus a +2 balanced-week bonus and up to two +2 bounties (22 max)
- Per-activity weekly limits, one scoring climbing session per day, and recovery-day conflict checks
- Non-scoring new-area, new-style, and project-progress tags on climbing sessions
- Three rotating daily bounties, with at least two solo/no-equipment choices each day
- Week 1 and final-week send-pyramid check-ins for a personal-baseline Most Improved award
- Group progress and leaderboard
- Personal weekly progress ("You this week") for the remembered logger, plus a group points-per-week trend chart
- Recent activity feed with delete/undo for mistaken entries (works in both local and shared mode)
- Live sync status with a manual refresh control
- Centrally managed trip date, crew roster, and group goal
- Shared logging through a private-to-your-group Google Sheet

## Turn on shared logging

GitHub Pages hosts the interface, but a static site cannot save group activity by itself. One organizer completes this once:

1. Open the live site and select **Shared setup**.
2. Create a Google Sheet, then open **Extensions → Apps Script**.
3. Copy the Apps Script shown in the setup window into the editor.
4. Select **Deploy → New deployment → Web app**.
5. Set **Execute as** to yourself and access to **Anyone**.
6. Paste the resulting `/exec` URL into the site and press **Test connection** to confirm the deployment answers correctly before saving.
7. Set the trip date, group goal, and comma-separated crew names.
8. Select **Save centrally & copy crew link**, then send that generated link to everyone.

API version 5 creates four active tabs in the Sheet:

- `Activities` stores duration bands, tags, activities, and bounty claims.
- `Settings` stores `tripDate` and `groupGoal`.
- `Participants` stores one crew member per row.
- `Benchmarks` stores baseline and final send pyramids.

The first version-5 request starts the redesigned challenge fresh. If the existing `Activities` tab contains rows, the script renames it to a timestamped `Activities Archive …` tab before creating the new version-5 `Activities` tab. No historical rows are deleted or included in the new leaderboard.

You can edit `Settings` or `Participants` directly in Google Sheets at any time. Every connected browser makes a cache-bypassing read on its next sync (normally within 45 seconds), so changing the roster or goal does not require a redeploy or a new crew link. Tap the sync status under the progress bar to refresh immediately. Existing activity rows remain intact when a participant is removed.

Settings keys ignore capitalization, spaces, underscores, and hyphens, so `tripDate`, `Trip Date`, and `trip_date` are equivalent. Trip dates may be Sheet date cells, `YYYY-MM-DD`, US-style `MM/DD/YYYY`, or unambiguous named-month dates such as `November 15, 2026`. The group goal must be a whole number from 50 through 10,000.

The version 5 read response is `{ version, features, activities, benchmarks, config, configErrors, serverDate, timeZone, fetchedAt }`. Feature flags are `scoring-v2`, `bounties`, and `benchmarks`. Invalid settings produce `config: null` plus field-specific errors while valid activity rows still load. Writes return `{ version: 5, ok, ... }`; failures include `{ error: { code, message, details } }`.

The backend ignores submitted point values. It derives climbing points from `durationBand`, derives other points from the activity type, validates climbing tags, enforces daily/weekly eligibility, and uses the Sheet timezone for bounty dates. A bounty requires a positively credited climbing session that day, one claim per day, and no more than two claims per week.

Relative bounty terms are deliberately personal rather than gendered: “recent maximum” is the hardest send in the prior 30 days, “flash level” is the hardest level flashed at least twice in that period, and “project level” is a problem with completed individual moves but no send. Without 30-day history, use the Week 1 benchmark.

For Most Improved, each climber records five Week 1 sends and five final-week sends from the same gym and ordered scale. The app compares mean grade movement, then improvement in the lowest send as the tiebreaker. Bounties do not affect this award.

The script also supports deleting entries: the activity feed shows a small **×** on each recent entry, which removes the matching row from the Sheet (and doubles as undo for a mistaken log).

**Already deployed an earlier version?** Paste the new script over the old one, then choose **Deploy → Manage deployments → Edit → Version: New version → Deploy**. The web-app URL stays the same. The site rejects older API responses because they lack duration data and cannot safely apply scoring v2.

The generated link carries the shared Sheet connection; the challenge settings come from the Sheet itself. Anyone with that link can submit or change setup through the site, so only share it with the climbing group and do not store sensitive information.

## Development

The app is intentionally self-contained in `index.html`. Pushes to `main` deploy automatically through the Pages workflow.

Run `npm test` before publishing. It runs the embedded backend contract tests, scoring and state tests, and static checks for the activity, bounty, benchmark, dialog, live-region, and sync interfaces.

See `IMPROVEMENTS.md` for the prioritized product and engineering backlog.
