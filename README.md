# Road to Send

A self-contained, mobile-first climbing challenge. The app has three views: **You**, **Record**, and **Crew**. It remembers the selected person on each device, lets new crew members create their own profile, supports temporary proxy recording, and shares data through Google Sheets and Apps Script.

## Scoring

A **balanced** economy across three categories — you can't win by grinding one activity.

- **Three categories, each scores once per person per day:**
  - 🧗 **Climbing** — **3 points** (optionally record the hardest grade sent, V0–V17; flavor only).
  - 💪 **Exercise** — **2 points** (any strength or cardio workout: pull-ups, gym, hangboard, run, bike).
  - 🧘 **Mobility** — **1 point** (mobility, stretching, prehab, or intentional recovery).
- Logging a category a second time the same day earns **0** more (it still shows in the feed). This diminishing return is what keeps the game balanced.
- **Balanced Day bonus: +2** when you log all three categories in one day. A full balanced day is **8 points** (3 + 2 + 1 + 2).
- **Rotating daily bounties:** each day surfaces **three** bounties (one per category), chosen deterministically from the date so everyone sees the same set. Each has a fun name, a one-line description, and **1–3 points** by difficulty. Claim from that day's offering.
- **Weekly bounty cap:** the first **6 bounty points** each week (Monday–Sunday) count toward your score. You can keep claiming past the cap — those claims score **0** but still count toward the **🏹 Bounty Hunter** tag, awarded to whoever completes the most bounties that week (bragging rights, ties shared).
- Everyone appears together in one leaderboard. Deleting an entry recomputes credit for the rest of that day/week.

## Shared setup

GitHub Pages hosts the interface, while a Google Sheet stores shared settings and activity:

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Open the app’s settings, expand **Apps Script source**, copy it, and replace the editor contents.
3. Choose **Deploy → New deployment → Web app**. Execute as yourself and allow access to anyone with the link.
4. Paste the `/exec` deployment URL into the app.
5. Set the challenge dates and group goal. Participants can join from the identity prompt; organizers can also manage the roster in setup.
6. Save setup and distribute the copied crew link.

The Sheet uses `Settings`, `Participants`, and `Activities` tabs. `Participants` contains a single `name` column; `Activities` contains raw activity details (category, points, grade/bounty/note), while the app deterministically applies the daily-category, balanced-day, and weekly-bounty rules at render time.

### Upgrading to API v12

Paste the v12 script over the old Apps Script and deploy a new version from **Deploy → Manage deployments**. The `/exec` URL stays the same.

- v12 changes only how the backend works, not the data or the wire format. The Apps Script used to re-provision and re-format every tab on **every** read and write; it now does that formatting once, when a Sheet is first set up, and skips it on every later call. Together with the client no longer reloading the whole `Activities` tab just to confirm one save, logging an activity is markedly faster. An already-set-up Sheet keeps every tab and its data and is never re-archived.
- Because `src/apps-script.js` is part of the versioned browser/backend contract, the protocol version is bumped even though the JSON is unchanged. The rollout is graceful: the v12 client accepts both a redeployed v12 backend and a not-yet-redeployed v11 one, since their wire format is byte-for-byte identical — there is no outage window, so the site and the script can update in either order. Deploy the v12 script when convenient to pick up the speedup; until you do, clients keep working against v11.
- Upgrading from v10 or v9 keeps every tab and its data. Upgrading from v8 or earlier renames any existing `Activities` (and leftover `Benchmarks`) tab to a timestamped archive tab exactly once, then a fresh `Activities` tab is created. The redesigned scoring starts clean. Existing `Settings` remain; the `Participants` tab is rewritten to a name-only column (the old `pullMode` column is dropped).
- v11 is accepted only transitionally, to bridge the v12 rollout; v10 and earlier endpoints are still rejected by the new client, so genuinely incompatible writes cannot mix with API v12.

Anyone with the crew link can submit or delete entries and change setup. Keep it within the group and never commit a live Apps Script endpoint or sensitive Sheet data.

## API v12

Reads return:

```json
{
  "version": 12,
  "features": ["categories-v1", "balanced-day-bonus", "daily-bounties-v3", "bounty-hunter", "challenge-window", "self-registration-v1"],
  "activities": [],
  "config": {
    "startDate": "2026-07-16",
    "tripDate": "2026-11-04",
    "goal": 3000,
    "crew": [{"name": "Alex"}]
  },
  "configErrors": [],
  "serverDate": "2026-07-16",
  "timeZone": "America/Los_Angeles"
}
```

Activity writes send `name`, `type` (`climb`, `exercise`, `mobility`, or `bounty`), `date`, and optionally `hardestGrade`, `note`, or `bountyId`. The backend ignores submitted points, looks up the participant centrally, derives the category or bounty points, and (for bounties) verifies the claim is one of that date's rotating bounties. New profiles use the `addParticipant` action with just `name`. Writes return `{ version: 12, ok, ... }` — the full saved activity record, which the app adds to the feed immediately and then reconciles with a background sync; structured failures return `{ error: { code, message, details } }`. The machine-readable contract is in `src/schema.json`.

A save is confirmed as soon as the Sheet accepts the write, so the only outcomes are **Activity saved** and **Save failed** (safe to retry). The Crew sync control refreshes the shared board on demand.

## Development

The editable sources live in `src/`. `npm run build` generates the self-contained `index.html`; do not edit the generated file directly.

```bash
npm run build
npm test
python3 -m http.server 8000
```

Open `http://localhost:8000/`. `npm test` verifies the generated artifact, client scoring/state, Apps Script validation and migration, protocol fixtures, shared workflow, accessibility, and required mobile UI hooks.

Pushes to `main` are expected to deploy through GitHub Pages. Shared-mode backend changes also require copying and redeploying the embedded Apps Script.
