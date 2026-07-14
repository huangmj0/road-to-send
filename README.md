# Road to Send

A self-contained, mobile-first climbing challenge. The app has three views: **You**, **Record**, and **Crew**. It remembers the selected person on each device, lets new crew members create their own profile, supports temporary proxy recording, and shares data through Google Sheets and Apps Script.

## Scoring

- Maximum **5 credited points per person per day**.
- A climbing session is 5 points and records the hardest grade sent from V0 through V17.
- Pull-ups use the mode each participant chooses when creating their profile:
  - Hard mode: 10 / 15 / 20 pull-ups earn 3 / 4 / 5 points.
  - Super hard mode: 20 / 30 / 40 pull-ups earn 3 / 4 / 5 points.
- Below-threshold pull-ups may be logged for 0 points.
- Same-day activities receive credit in creation order until the 5-point cap is reached. Deleting an earlier activity can free credit for a later entry.
- Everyone appears together in one leaderboard regardless of mode. Weekly totals are informational; there are no weekly caps, bonuses, bounties, benchmarks, or activity-frequency limits.

## Shared setup

GitHub Pages hosts the interface, while a Google Sheet stores shared settings and activity:

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Open the app’s settings, expand **Apps Script source**, copy it, and replace the editor contents.
3. Choose **Deploy → New deployment → Web app**. Execute as yourself and allow access to anyone with the link.
4. Paste the `/exec` deployment URL into the app.
5. Set the challenge dates and group goal. Participants can join from the identity prompt and choose Hard or Super hard mode; organizers can also manage them in setup.
6. Save setup and distribute the copied crew link.

The Sheet uses `Settings`, `Participants`, and `Activities` tabs. `Participants` contains `name` and `pullMode`; `Activities` contains raw activity details, while the app deterministically applies the daily cap.

### Upgrading to API v8

Paste the v8 script over the old Apps Script and deploy a new version from **Deploy → Manage deployments**. The `/exec` URL stays the same.

- Existing `Activities` and `Benchmarks` tabs are renamed to timestamped archive tabs.
- A fresh activity sheet is created only when upgrading from pre-v7 data.
- Existing settings and participant names remain.
- A `pullMode` column is added to `Participants`.

Legacy Men values migrate to Super hard mode and Women values migrate to Hard mode so existing thresholds and activity scores remain unchanged. Climbing can still be recorded for a participant with a missing mode, but pull-ups are blocked until a mode is chosen. Older endpoints are rejected by the new client so incompatible profile writes cannot mix with API v8.

Anyone with the crew link can submit or delete entries and change setup. Keep it within the group and never commit a live Apps Script endpoint or sensitive Sheet data.

## API v8

Reads return:

```json
{
  "version": 8,
  "features": ["daily-cap-v1", "participant-pull-mode", "challenge-window", "self-registration-v1"],
  "activities": [],
  "config": {
    "startDate": "2026-07-01",
    "tripDate": "2026-11-15",
    "goal": 750,
    "crew": [{"name": "Alex", "pullMode": "super-hard"}]
  },
  "configErrors": [],
  "serverDate": "2026-07-13",
  "timeZone": "America/Los_Angeles"
}
```

Activity writes send `name`, `type`, `date`, and either `hardestGrade` or `pullUps`. The backend ignores submitted points and pull-up modes, looks up the participant centrally, and derives the raw score. New profiles use the `addParticipant` action with `name` and `pullMode`. Writes return `{ version: 8, ok, ... }`; structured failures return `{ error: { code, message, details } }`. The machine-readable contract is in `src/schema.json`.

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
