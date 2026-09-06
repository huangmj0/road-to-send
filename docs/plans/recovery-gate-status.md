# Recovery gate status — issue #153

Verification on September 5, 2026 is **partial; the release gate remains open**.
This document contains no Sheet links, endpoints, participant records, or private manifests.

## Verified

- Two existing, distinct Sheets were found: the untouched recovery copy and disposable rehearsal copy created earlier on September 5.
- Drive returned owner-only permissions for both copies and the candidate source, with no broader sharing.
- Bounded CellData reads covered every allocated cell in all 13 tabs. The copies match each other in raw values/formulas, effective values, number formats, notes, tab properties, and timezone.
- The candidate source has the same tab identities and timezone. Its only cell differences from the recovery copy are two additional activity rows; the recovery snapshot predates those rows. No source or copy was mutated during verification.
- Source/copy metadata and raw comparison evidence are retained privately outside the repository in the orchestrator's local evidence directory. Public PRs must report only gate outcomes.
- A third, owner-only private Sheet was restored from the recovery copy and read back across all 13 tabs. Its cell contents and tab properties match the recovery snapshot exactly; the recovery copy was not changed. This verifies snapshot restoration, not replay of later writes.
- The copied Apps Script project's container points to the disposable rehearsal Sheet, and its overview showed no previous executions. Its visible script-property list is empty; document properties and effective runtime routing still require verification.
- The two observed post-snapshot activity rows were replayed into the separate restoration target with their original values, IDs, and timestamps. Full Activities readback then matched the captured source; all other tabs had already matched. Native Sheet inspection confirmed the restored rows. This proves the bounded replay exercise, not future-write capture or production cutover.

## Still required

- Organizer confirmation of the intended live source and deployed backend, including a private deployment/version manifest.
- Inspection of Apps Script provisioning properties, explicit rehearsal routing to the disposable copy, and protection of copied current-schema activities during setup.
- Real web-app GET/POST rehearsals and rollback preserving every later acknowledged activity, including writes made after this snapshot.
- A fresh verified recovery copy immediately before an intended merge, as required by #163. The current snapshot must never be described as a current backup or a no-data-loss rollback.

All implementation PRs remain draft and unmerged with auto-merge disabled while these gates are open. Unit tests with a Sheet stub do not satisfy real deployment or recovery acceptance criteria.
