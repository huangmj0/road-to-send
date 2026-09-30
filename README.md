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

### Upgrading to API v13

API v13 adds one optional field, `movedTo`. Redeploy the Apps Script (paste the new script over the old one and deploy a new version; the `/exec` URL stays the same) to use it. The browser accepts v13 and v12, so the site and the script can update in either order.

**Moving the crew board.** Add a row to the `Settings` tab with key `movedTo` and an `https://` URL as the value. Anything that is not an https URL is ignored. While it is set, the Sheet still serves the full board on GET, now including `movedTo`, but refuses every write with error code `moved` and the message "The crew board has moved. Try again." Nothing is written. A browser that sees `movedTo` switches to the new endpoint (once per page load), so old crew links keep working. Keep the Sheet deployed as the redirector.

### Earlier upgrade: API v12

Paste the v12 script over the old Apps Script and deploy a new version from **Deploy → Manage deployments**. The `/exec` URL stays the same.

- v12 changes only how the backend works, not the data or the wire format. The Apps Script used to re-provision and re-format every tab on **every** read and write; it now does that formatting once, when a Sheet is first set up, and skips it on every later call. Together with the client no longer reloading the whole `Activities` tab just to confirm one save, logging an activity is markedly faster. An already-set-up Sheet keeps every tab and its data and is never re-archived.
- Because `src/apps-script.js` is part of the versioned browser/backend contract, the protocol version is bumped even though the JSON is unchanged. The rollout is graceful: the v12 client accepted both a redeployed v12 backend and a not-yet-redeployed v11 one, since their wire format is byte-for-byte identical — there is no outage window, so the site and the script can update in either order. Deploy the v12 script when convenient to pick up the speedup; until you do, clients keep working against v11.
- Upgrading from v10 or v9 keeps every tab and its data. Upgrading from v8 or earlier renames any existing `Activities` (and leftover `Benchmarks`) tab to a timestamped archive tab exactly once, then a fresh `Activities` tab is created. The redesigned scoring starts clean. Existing `Settings` remain; the `Participants` tab is rewritten to a name-only column (the old `pullMode` column is dropped).
- v11 was accepted only transitionally, to bridge the v12 rollout. The v13 client accepts v13 and v12 only; v11 and earlier endpoints are rejected, so redeploy the script.

Anyone with the crew link can submit or delete entries and change setup. Keep it within the group and never commit a live Apps Script endpoint or sensitive Sheet data.

## API v13

Reads return the following (`movedTo` appears only while the organizer has set it):

```json
{
  "version": 13,
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
  "timeZone": "America/Los_Angeles",
  "movedTo": "https://example.test/new-endpoint"
}
```

Activity writes send `name`, `type` (`climb`, `exercise`, `mobility`, or `bounty`), `date`, and optionally `hardestGrade`, `note`, or `bountyId`. The backend ignores submitted points, looks up the participant centrally, derives the category or bounty points, and (for bounties) verifies the claim is one of that date's rotating bounties. New profiles use the `addParticipant` action with just `name`. Writes return `{ version: 13, ok, ... }` — the full saved activity record, which the app adds to the feed immediately and then reconciles with a background sync; structured failures return `{ error: { code, message, details } }`. The machine-readable contract is in `src/schema.json`.

A save is confirmed as soon as the Sheet accepts the write, so the only outcomes are **Activity saved** and **Save failed** (safe to retry). The Crew sync control refreshes the shared board on demand.

## Moving the shared backend to Supabase

This is the organizer's runbook for moving a crew's shared board from the Google Sheet to a Supabase Edge Function that speaks the same API. The app URL stays the same. Crew members don't have to do anything: each browser follows the Sheet's `movedTo` to the new backend on its next load. Profiles, local logs and caches stay in each browser.

Run every command from a checkout of this repository. The placeholders are `<project-ref>` (your Supabase project's reference id), `<apps-script-url>` (the Sheet's `/exec` URL), `<app-url>` (the GitHub Pages address) and `<database-connection-string>` (from the project's **Connect** dialog). **Snapshots and generated SQL hold crew data.** Write them only to the temporary directory below, which is outside the repository, and never commit them.

### Prerequisites

- A Supabase account and a new, empty project for this crew.
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), logged in with `supabase login`.
- Node.js 22 or later, `curl`, and `psql` (the PostgreSQL client). You can paste the import SQL into the project's SQL editor instead of using `psql`.
- Edit access to the crew's Google Sheet and its Apps Script.
- About half an hour. Between steps 3 and 4, crew members see an empty board and can't log.

### Create the project and apply the migration

```bash
supabase link --project-ref <project-ref>
supabase db push
```

`db push` applies `supabase/migrations/`: the `settings`, `participants` and `activities` tables, with row-level security on and no policies. Only the function can reach the data.

### Deploy the function

```bash
supabase functions deploy road-to-send
```

`supabase/config.toml` sets `verify_jwt = false` for this function. The crew's browsers call it with a plain, unauthenticated `fetch`, just like the Apps Script URL, so the platform must not require a JWT. If a request is rejected with HTTP 401, deploy again with `supabase functions deploy road-to-send --no-verify-jwt`. The function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects, so there are no secrets to set.

The function URL is `https://<project-ref>.supabase.co/functions/v1/road-to-send`.

### Cutover

Open one terminal and keep it open for every step. It holds the function URL and the temporary directory:

```bash
FUNCTION_URL='https://<project-ref>.supabase.co/functions/v1/road-to-send'
WORK="$(mktemp -d)"
echo "Snapshot and SQL go in $WORK"
```

**1. Ship the v13 browser.** Pushing to `main` publishes the page. Before you go on, confirm that the live page accepts v13, so every browser understands `movedTo`. The Sheet can stay on v12 for now.

```bash
curl -fsSL '<app-url>' | grep -o 'SUPPORTED_API_VERSIONS=new Set(\[[0-9,]*\])'
# expect: SUPPORTED_API_VERSIONS=new Set([13,12])
```

**2. Check the new backend.** Complete the two sections above, then run the smoke check against the empty function:

```bash
node scripts/smoke-check.mjs "$FUNCTION_URL"
```

All three checks must pass, and GET reports `config not set yet`. The smoke check never writes: it sends a GET, an OPTIONS and a POST of `{"action":"__smoke__"}`, which every backend rejects with `unknown_action`. An empty backend rejects every write with `setup_required` or `invalid_activity`, so nothing can land on it before the import.

**3. Freeze the Sheet and start the move.** Redeploy the Apps Script at v13. Paste the script from the app's **Apps Script source** over the old one and deploy a new version from **Deploy → Manage deployments**. The `/exec` URL stays the same. Then, in the Sheet's `Settings` tab, add a row with key `movedTo` and the function URL as its value. From now on, the Sheet serves reads but refuses every write with `moved`. Browsers start switching to the function, and they show an empty board until step 4 finishes. Confirm the Sheet is frozen:

```bash
curl -fsSL '<apps-script-url>' | node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log("version", p.version, "movedTo", p.movedTo)'
# expect: version 13 movedTo https://<project-ref>.supabase.co/functions/v1/road-to-send
```

**4. Snapshot the Sheet and import it.** The Sheet is frozen now, so the snapshot is final:

```bash
curl -fsSL '<apps-script-url>' > "$WORK/snapshot.json"
node scripts/import-snapshot.mjs < "$WORK/snapshot.json" > "$WORK/import.sql"
psql '<database-connection-string>' --set ON_ERROR_STOP=1 --file "$WORK/import.sql"
```

The import tool stops with a message and writes no SQL if the snapshot has no activities array, has no config, or is not version 12 or 13. The SQL runs as one transaction. It keeps every activity id, timestamp and the feed order, and running it again changes nothing. Without `psql`, paste the contents of `import.sql` into the SQL editor and run it.

**5. Verify.** Run the smoke check again. GET now reports the crew and the activity count:

```bash
node scripts/smoke-check.mjs "$FUNCTION_URL"
```

Then check that the function serves exactly the snapshot's activities, in the same order:

```bash
curl -fsS "$FUNCTION_URL" > "$WORK/after.json"
node -e 'const fs=require("fs"),ids=f=>JSON.parse(fs.readFileSync(f,"utf8")).activities.map(a=>a.id);const [a,b]=[ids(process.argv[1]),ids(process.argv[2])];console.log(a.length,"in snapshot,",b.length,"served:",JSON.stringify(a)===JSON.stringify(b)?"MATCH":"MISMATCH")' "$WORK/snapshot.json" "$WORK/after.json"
# expect: MATCH
```

Last, open the app. Your browser follows `movedTo` on this load. Log one activity, then delete it.

**6. Leave the Sheet deployed permanently.** Don't delete the Apps Script deployment or clear `movedTo`. The Sheet is now a read-only redirector and a frozen backup. Once step 5 passes, delete the temporary directory: `rm -rf "$WORK"`.

### Rollback is fix-forward

**Browsers that have moved don't move back.** Each one has stored the function URL as its endpoint. Clearing `movedTo` doesn't return them to the Sheet. It only stops the browsers that haven't moved yet, which splits the crew across two backends. So fix problems on Supabase, and keep `movedTo` set:

- If the smoke check or the id comparison fails, fix the function or project and run `supabase functions deploy road-to-send` again.
- If the import failed or was cut short, fix the cause and run the same `import.sql` again. It's one transaction, and rows that are already there are skipped.
- If the database needs to start over, rebuild it with `supabase db reset --linked`, which erases the project's data. Then run the same `import.sql` again. The snapshot is still the whole board, because the Sheet refused every write after step 3.

### Why the Sheet stays up

Crew links in chats and bookmarks carry `?sheet=<apps-script-url>`. Each time someone opens one, the browser sets the Sheet as its endpoint again. It reaches the function only through the Sheet's `movedTo`. Then it rewrites the link in the address bar to the new backend. If you take the Sheet down, every old crew link stops working.

## Development

The editable sources live in `src/`. `npm run build` generates the self-contained `index.html`; do not edit the generated file directly.

```bash
npm run build
npm test
python3 -m http.server 8000
```

Open `http://localhost:8000/`. `npm test` verifies the generated artifact, client scoring/state, Apps Script validation and migration, protocol fixtures, shared workflow, accessibility, and required mobile UI hooks.

Pushes to `main` are expected to deploy through GitHub Pages. Shared-mode backend changes also require copying and redeploying the embedded Apps Script.
