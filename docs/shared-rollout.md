# Shared runtime rollout

Issue #154 changes shared connectivity without changing scoring, activity rows, local storage, or
challenge-day rules. Protocol v14 is additive and explicitly negotiated.

## Compatibility matrix

| Browser | Backend | Request and response |
| --- | --- | --- |
| Existing v11/v12 | Existing v11/v12 | Existing unnegotiated behavior |
| Updated v14 | Existing v11–v13 | Browser requests v14; backend returns its genuine compatible version |
| Existing v11–v13 | Updated v14 | Request is unnegotiated or older; backend returns the requested compatible envelope, or v12 for an unnegotiated request |
| Updated v14 | Updated v14 | Browser requests v14; backend returns v14 with protocol negotiation and recoverable configuration commands |

For additive backend versions, a request from 13 through the deployed `API_VERSION` receives
the requested envelope version. Missing, invalid, or newer requests receive v12. This lets later
backend changes retain already-open compatible clients.

## Organizer deployment order

1. Verify a fresh private recovery copy and record the intended live deployment privately.
2. Copy the updated Apps Script into the disposable rehearsal container.
3. Run `configureSpreadsheet` from that bound Sheet and verify its script property points to the
   disposable Sheet. Never use the live or recovery Sheet for rehearsal.
4. Deploy a rehearsal web-app version. Exercise negotiated and unnegotiated GET/POST requests,
   rejected bodies, and concurrent saves; compare all activity identities and rows afterward.
5. Deploy the backend to the intended live container, then publish the browser. The compatibility
   matrix also permits browser-first rollout if Pages finishes first.

Rollback the browser independently to the prior artifact while the backend continues serving v12
to unnegotiated requests. Roll back the Apps Script deployment to its prior version if runtime
checks fail. Before either rollback, reconcile every acknowledged activity written after the
recovery snapshot; restoring an older Sheet alone is not a no-data-loss rollback.

## Residual release gates

The repository tests use controlled Apps Script and Sheet doubles. Before merge, the disposable
deployment still must prove real GET/POST and concurrency behavior, correct explicit routing,
rejected-request envelopes, and preservation of copied current-schema rows. The organizer must also
confirm the intended live source and active deployment, refresh the private recovery copy, and
verify replay of all later acknowledged writes. Deployment URLs, Sheet IDs, crew rows, and private
recovery evidence stay outside the repository.
