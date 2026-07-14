# Road to Send

A self-contained, mobile-first climbing challenge. The app has three views: **You**, **Record**, and **Crew**. It remembers the selected person on each device, supports temporary proxy recording, and shares data through Google Sheets and Apps Script.

## Scoring

- Maximum **5 credited points per person per day**.
- A climbing session is 5 points and records the hardest grade sent from V0 through V17.
- Pull-ups use the participant category stored in the central roster:
  - Men: 20 / 30 / 40 pull-ups earn 3 / 4 / 5 points.
  - Women: 10 / 15 / 20 pull-ups earn 3 / 4 / 5 points.
- Below-threshold pull-ups may be logged for 0 points.
- Same-day activities receive credit in creation order until the 5-point cap is reached. Deleting an earlier activity can free credit for a later entry.
- Weekly leaderboard totals are informational. There are no weekly caps, bonuses, bounties, benchmarks, or activity-frequency limits.

## Shared setup

GitHub Pages hosts the interface, while a Google Sheet stores shared settings and activity:

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Open the app’s settings, expand **Apps Script source**, copy it, and replace the editor contents.
3. Choose **Deploy → New deployment → Web app**. Execute as yourself and allow access to anyone with the link.
4. Paste the `/exec` deployment URL into the app.
5. Set the challenge dates, group goal, and each participant’s Men/Women pull-up category.
6. Save setup and distribute the copied crew link.

The Sheet uses `Settings`, `Participants`, and `Activities` tabs. `Participants` contains `name` and `pullCategory`; `Activities` contains raw activity details, while the app deterministically applies the daily cap.

### Upgrading from API v6

Paste the v7 script over the old Apps Script and deploy a new version from **Deploy → Manage deployments**. The `/exec` URL stays the same. On the first v7 request:

- Existing `Activities` and `Benchmarks` tabs are renamed to timestamped archive tabs.
- A fresh v7 `Activities` tab is created.
- Existing settings and participant names remain.
- A `pullCategory` column is added to `Participants`.

Assign Men/Women categories after upgrading. Climbing can still be recorded for a participant with a missing category, but pull-ups are blocked until that roster value is set. API v6 endpoints are intentionally rejected by the new client so old scoring cannot mix with v7.

Anyone with the crew link can submit or delete entries and change setup. Keep it within the group and never commit a live Apps Script endpoint or sensitive Sheet data.

## API v7

Reads return:

```json
{
  "version": 7,
  "features": ["daily-cap-v1", "participant-pull-category", "challenge-window"],
  "activities": [],
  "config": {
    "startDate": "2026-07-01",
    "tripDate": "2026-11-15",
    "goal": 750,
    "crew": [{"name": "Alex", "pullCategory": "men"}]
  },
  "configErrors": [],
  "serverDate": "2026-07-13",
  "timeZone": "America/Los_Angeles"
}
```

Activity writes send `name`, `type`, `date`, and either `hardestGrade` or `pullUps`. The backend ignores submitted points and pull-up categories, looks up the participant centrally, and derives the raw score. Writes return `{ version: 7, ok, ... }`; structured failures return `{ error: { code, message, details } }`. The machine-readable contract is in `src/schema.json`.

The app distinguishes **Save failed** from **Saved to the Sheet, but refresh failed**. In the latter case, do not submit again; use the Crew sync control.

## Development

The editable sources live in `src/`. `npm run build` generates the self-contained `index.html`; do not edit the generated file directly.

```bash
npm run build
npm test
python3 -m http.server 8000
```

Open `http://localhost:8000/`. `npm test` verifies the generated artifact, client scoring/state, Apps Script validation and migration, protocol fixtures, shared workflow, accessibility, and required mobile UI hooks.

Pushes to `main` are expected to deploy through GitHub Pages. Shared-mode backend changes also require copying and redeploying the embedded Apps Script.
