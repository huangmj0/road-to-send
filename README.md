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
- Recent activity feed
- Climbing bingo
- Configurable trip date, crew roster, and group goal
- Shared logging through a private-to-your-group Google Sheet

## Turn on shared logging

GitHub Pages hosts the interface, but a static site cannot save group activity by itself. One organizer completes this once:

1. Open the live site and select **Shared setup**.
2. Create a Google Sheet, then open **Extensions → Apps Script**.
3. Copy the Apps Script shown in the setup window into the editor.
4. Select **Deploy → New deployment → Web app**.
5. Set **Execute as** to yourself and access to **Anyone**.
6. Paste the resulting `/exec` URL into the site.
7. Set the trip date, group goal, and comma-separated crew names.
8. Select **Save & copy crew link**, then send that generated link to everyone.

The generated link carries the shared Sheet connection and challenge settings. Anyone with that link can submit, so only share it with the climbing group and do not store sensitive information.

## Development

The app is intentionally self-contained in `index.html`. Pushes to `main` deploy automatically through the Pages workflow.
