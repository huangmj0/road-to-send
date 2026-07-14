# Road to Send

A mobile-friendly group fitness challenge for a November climbing trip.

## Live site

https://huangmj0.github.io/road-to-send/

## What it includes

- Eight activities with automatic point values
- A 14-point weekly cap per person, applied to the week each activity actually happened
- Per-activity weekly limits (e.g. climbing counts up to 4×/week, rest days up to 2×/week)
- A +2 "balanced week" bonus for logging climbing, strength, and care work in the same week (16 max)
- Group progress and leaderboard
- Personal weekly progress ("You this week") for the remembered logger, plus a group points-per-week trend chart
- Recent activity feed with delete/undo for mistaken entries (works in both local and shared mode)
- Live sync status with a manual refresh control
- Climbing bingo
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

- `Activities` stores submitted activity entries.
- `Settings` stores `tripDate` and `groupGoal`.
- `Participants` stores one crew member per row.

You can edit `Settings` or `Participants` directly in Google Sheets at any time. Every connected browser makes a cache-bypassing read on its next sync (normally within 45 seconds), so changing the roster or goal does not require a redeploy or a new crew link. Tap the sync status under the progress bar to refresh immediately. Existing activity rows remain intact when a participant is removed.

The script also supports deleting entries: the activity feed shows a small **×** on each recent entry, which removes the matching row from the Sheet (and doubles as undo for a mistaken log).

**Already deployed an earlier version of the script?** Paste the new script over the old one in Apps Script, then choose **Deploy → Manage deployments → Edit → Version: New version → Deploy**. This keeps the same web-app URL, so the existing crew link keeps working. The site detects the older activity-only response and will not attempt to write centralized settings until the script is upgraded.

The generated link carries the shared Sheet connection; the challenge settings come from the Sheet itself. Anyone with that link can submit or change setup through the site, so only share it with the climbing group and do not store sensitive information.

## Development

The app is intentionally self-contained in `index.html`. Pushes to `main` deploy automatically through the Pages workflow.
