# Road to Send

A mobile-friendly group fitness challenge for a November climbing trip.

## Live site

https://huangmj0.github.io/road-to-send/

## What it includes

- Eight activities with automatic point values
- A 14-point weekly cap per person, applied to the week each activity actually happened
- Per-activity weekly limits (e.g. climbing counts up to 4×/week, rest days up to 2×/week)
- A +2 "balanced week" bonus for logging climbing, strength, and care work in the same week
- Three deterministic daily bounties scaled to each climber's level; one +2 claim per day and three per week above the cap (22 max total)
- Group progress and leaderboard
- Personal weekly progress ("You this week") for the remembered logger, plus a group points-per-week trend chart
- Recent activity feed with delete/undo for mistaken entries (works in both local and shared mode)
- Live sync status with a manual refresh control
- Shared bounty completions with required notes, daily/weekly limits, and Sheet-timezone resets
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

The first centralized save creates three tabs in the Sheet:

- `Activities` stores submitted activity and bounty entries. Existing sheets gain `bountyId` and `bountyTitle` columns without rewriting historical rows.
- `Settings` stores `tripDate` and `groupGoal`.
- `Participants` stores one crew member per row.

You can edit `Settings` or `Participants` directly in Google Sheets at any time. Every connected browser makes a cache-bypassing read on its next sync (normally within 45 seconds), so changing the roster or goal does not require a redeploy or a new crew link. Tap the sync status under the progress bar to refresh immediately. Existing activity rows remain intact when a participant is removed.

Settings keys ignore capitalization, spaces, underscores, and hyphens, so `tripDate`, `Trip Date`, and `trip_date` are equivalent. Trip dates may be Sheet date cells, `YYYY-MM-DD`, US-style `MM/DD/YYYY`, or unambiguous named-month dates such as `November 15, 2026`. The group goal must be a whole number from 50 through 10,000. The script formats these cells and installs data-validation guidance when API version 4 is first used.

The version 4 read response is `{ version, features, activities, config, configErrors, serverDate, timeZone, fetchedAt }`. The `bounties` feature flag distinguishes the current deployment from earlier version-4 scripts. Invalid or incomplete settings produce `config: null` plus field-specific `configErrors`; activity rows still load. Write failures return `{ version: 4, ok: false, error: { code, message, details } }`. Activity writes validate names, types, dates, and notes, and the script derives points from the activity type rather than trusting client-supplied points. If the `Participants` tab contains names, activity names must match one of them.

Bounty claims use `{ action: "claimBounty", name, bountyId, note }`. The backend derives the date, title, and +2 value, then verifies the current daily selection, a credited same-day climbing session, one claim per day, and no more than three claims in the Monday-Sunday week. A qualifying climbing session cannot be deleted while its bounty depends on it; delete the bounty first.

The script also supports deleting entries: the activity feed shows a small **×** on each recent entry, which removes the matching row from the Sheet (and doubles as undo for a mistaken log).

**Already deployed an earlier version of the script?** Paste the new script over the old one in Apps Script, then choose **Deploy → Manage deployments → Edit → Version: New version → Deploy**. This keeps the same web-app URL, so the existing crew link keeps working. The site detects the older activity-only response and will not attempt to write centralized settings until the script is upgraded.

The generated link carries the shared Sheet connection; the challenge settings come from the Sheet itself. Anyone with that link can submit or change setup through the site, so only share it with the climbing group and do not store sensitive information.

## Development

The app is intentionally self-contained in `index.html`. Pushes to `main` deploy automatically through the Pages workflow.

Run `npm test` before publishing. It runs embedded backend contract tests, client-state and scoring tests, and static checks that compile the browser script and guard key form, dialog, live-region, sync, and bounty accessibility semantics.

See `IMPROVEMENTS.md` for the prioritized product and engineering backlog.
