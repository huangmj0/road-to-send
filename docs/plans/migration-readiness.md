# Migration readiness — issue #163

Status: **not ready to migrate**. This is the acceptance record for the complete reliability
stack, not authorization to deploy or merge. All release PRs remain draft with auto-merge off.

## Data comparison

The September 9, 2026 read-only inspection covered every allocated cell in all 13 source tabs.
Existing captured activity records were unchanged; the source contained additional activities
since the earlier snapshot. Settings, Participants, and the other tabs matched the earlier
capture. Private raw evidence and comparison results remain outside the repository.

The captured source was evaluated through the activity and configuration readers in the
activity-receipt and configuration-journal branches. Both preserved all captured activities,
reported no configuration errors, and accepted the historical names and dates. This proves
source-reader compatibility at those branch versions. It does not prove the final integrated
artifact, deployed Apps Script routing, or real Google runtime behavior.

The recovery snapshot is older than the source. Refresh it immediately before an intended merge;
do not use the earlier comparison as evidence of a current recovery point.

## Required release evidence

| Requirement | Evidence required to close the gate | Status |
| --- | --- | --- |
| Complete implementation | #153–#162 integrated in the intended stack, with Standards and Spec reviews resolved | In progress |
| Exact artifact | Clean dependency install, full suite, generated artifact, and commit SHA recorded together | Pending final integration |
| CI | Green individual PR checks and aggregate integration checks at their final heads | Pending final stack |
| Real runtime | Disposable Apps Script GET/POST with explicit routing, null active-document helpers, and negotiated/legacy clients | Pending authorization and rehearsal |
| User workflow | Shipped artifact tested for local/shared capture, proxy, lost-response retry, late completion, delete, setup, identity, timezone boundaries, and concurrency | Pending final artifact and disposable runtime |
| Literal text | Names and notes with formula-like prefixes round-trip exactly through real Sheets | Pending disposable runtime |
| Fresh recovery | Private source/deployment manifest, fresh native copy, all-tab comparison and permissions evidence immediately before merge | Pending cutover timing |
| Rollback | Rehearsal accounts for every acknowledged post-snapshot activity, deletion, configuration change, and command receipt | Pending complete-stack rehearsal |
| Deployment order | Final version/capability matrix and tested browser/backend rollback procedure | Pending final stack |

## Rollback constraints introduced by durable commands

The Activity Receipts and Config Journal tabs become authoritative for accepted commands. A
projection in Activities, Settings, or Participants may lag a committed receipt after an
interruption. Preserve these journals along with the visible tabs when copying or recovering the
Sheet. Replaying only newly appended activity rows cannot recover setup changes or deletions.

An older backend that does not read the journals cannot safely replace the new backend merely
because its request envelope is compatible. First reconcile every committed command and prove
that subsequent writes and pending retries retain their deduplication and ordering guarantees.
The preferred browser rollback keeps the compatible new backend and its journals in place.
Any backend rollback needs its own demonstrated recovery procedure before release.

Keep the untouched recovery copy separate from the disposable write-test and restoration targets.
Do not test mutations against the live source. Deployment IDs, Sheet URLs, crew records, and raw
recovery manifests must never be committed here.
