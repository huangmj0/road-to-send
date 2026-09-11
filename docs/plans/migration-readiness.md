# Migration readiness — issue #163

Status: **not ready to migrate**. This is the acceptance record for the complete reliability
stack, not authorization to deploy or merge. All release PRs remain draft with auto-merge off.

## Data comparison

The September 10, 2026 read-only inspection refreshed every allocated cell in all 13 source tabs.
All previously captured activity records were unchanged; additional activities had accumulated
since September 9 and since the recovery snapshot. Settings and Participants values were
unchanged; the comparison with the recovery-era capture found header-format differences only
in those tabs. Private raw evidence and comparison results remain outside the repository.

The captured source was evaluated through the activity and configuration readers at API v15,
v16, and the integrated v17 implementation. All preserved every captured activity, reported no
configuration errors, and accepted the historical names and dates. There were no missing or
duplicate activity IDs. This proves source-reader compatibility, including the integrated v17
implementation. Deployed Apps Script routing and real Google runtime behavior remain unverified.

The same September 10 capture produced identical scoring credits and every scoring map through
the integrated API v17 browser source and the captured `origin/main` source. The private parity
record pins both commit IDs. Repeat these comparisons if review changes the implementation.

The recovery snapshot is older than the source. Refresh it immediately before an intended merge;
do not use the earlier comparison as evidence of a current recovery point.

A September 10 read-only Apps Script inspection confirmed that the rehearsal project remains
bound to the disposable Sheet. Its deployment list contains only Head, its script-property list
is empty, and its only recorded execution is the property-access helper. No web-app runtime or
explicit routing rehearsal has yet been demonstrated.

## Required release evidence

Local integration checkpoint: commit `55f5f12b5797d35d818735dca713eea08114627b` passed a clean
`npm ci --ignore-scripts` followed by `npm test`: 68 behavioral tests and all five suites passed.
The generated artifact measured 173408 bytes within the deliberately documented 174000-byte
budget. This includes implementation through #160 on top of #156, #159, #161, #162, and #157.
Independent reviews, remote CI for the remaining PRs, and the real-runtime rehearsal remain open.

| Requirement | Evidence required to close the gate | Status |
| --- | --- | --- |
| Complete implementation | #153–#162 integrated in the intended stack, with Standards and Spec reviews resolved | Integrated; independent reviews pending |
| Exact artifact | Clean dependency install, full suite, generated artifact, and commit SHA recorded together | Local checkpoint passed; repeat after review changes |
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
