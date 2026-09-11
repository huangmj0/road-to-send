# Shared runtime rollout

Issues #154–#160 change shared connectivity without changing scoring, activity rows, local storage,
or challenge-day rules. Protocol v17 is additive and explicitly negotiated. API17 adds an expected
configuration revision for setup commands; the Config Journal remains the authoritative source.

## Compatibility matrix

| Browser | Backend | Request and response |
| --- | --- | --- |
| Existing v11/v12 | Existing v11/v12 | Existing unnegotiated behavior |
| Updated v17 | Existing v11–v16 | Browser requests v17; backend returns its genuine compatible version and the browser uses only that endpoint's verified capabilities |
| Existing v11–v16 | Updated v17 | Request is unnegotiated or older; backend returns the requested compatible envelope, or v12 for an unnegotiated request; setup saves without an expected revision retain legacy last-writer-wins behavior |
| Updated v17 | Updated v17 | Browser requests v17; backend returns v17 with literal text, activity receipts, the Config Journal, and revision-checked setup saves |

For additive backend versions, a request from 13 through the deployed `API_VERSION` receives the
requested envelope version. Missing, invalid, or newer requests receive v12. This lets later
backend changes retain already-open compatible clients while keeping revision checks opt-in to
requests that actually provide an expected revision.

## Organizer deployment order

1. Verify a fresh private recovery copy and record the intended live deployment privately.
2. Copy the updated Apps Script into the disposable rehearsal container.
3. Run `configureSpreadsheet` from that bound Sheet and verify its script property points to the
   disposable Sheet. Never use the live or recovery Sheet for rehearsal.
4. Deploy a rehearsal web-app version. Exercise negotiated and unnegotiated GET/POST requests,
   rejected bodies, and concurrent saves; compare all activity identities and rows afterward.
5. Deploy the backend to the intended live container at the existing web-app URL, then publish the
   browser. Keep that URL stable so endpoint-bound pending commands continue to reach the same
   journal.

Rollback the browser independently to the prior artifact while the new backend continues serving
v12 to unnegotiated requests. Once activity receipts or configuration journal entries exist, an
older backend cannot replace the new backend safely without reconciling the journals. It may miss
committed configuration, ignore deletion receipts, or duplicate a pending retry. Keep the new
compatible backend in place for browser rollback. Any backend rollback must separately demonstrate
preservation of every acknowledged activity, deletion, setup command, and pending retry after the
recovery snapshot; restoring an older Sheet alone is not a no-data-loss rollback.

## Residual release gates

The repository tests use controlled Apps Script and Sheet doubles. Before merge, the disposable
deployment still must prove real GET/POST and concurrency behavior, correct explicit routing,
rejected-request envelopes, and preservation of copied current-schema rows. The organizer must also
confirm the intended live source and active deployment, refresh the private recovery copy, and
verify replay of all later acknowledged writes. Deployment URLs, Sheet IDs, crew rows, and private
recovery evidence stay outside the repository.


## Capabilities through API v17

| Requested version | Capabilities added at that version |
| --- | --- |
| Missing or invalid | v12 envelope and legacy uncertainty |
| v13 | Explicit protocol negotiation and web-runtime routing |
| v14 | Literal names and notes (`literal-text-v1`) |
| v15 | Durable activity commands (`idempotent-activity-v1`) |
| v16 | Durable setup commands (`config-journal-v1`) |
| v17 | Revision-checked setup saves (`config-revision-v1`) |

Each supported version retains the capabilities below it. A newer browser talking to an older
backend accepts its genuine older envelope and uses only that endpoint's verified capabilities.
Keep the deployment URL stable when publishing a new backend version so existing crew links and
endpoint-bound pending commands continue to reach the same data and command history.

The Activity Receipts and Config Journal tabs must travel with the Sheet during recovery. Never
clear them as a performance cleanup or restore only the visible projection tabs.
