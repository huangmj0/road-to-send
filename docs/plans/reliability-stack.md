# Reliability and voluntary reflection: proposed PR stack

Status: draft breakdown awaiting review. No GitHub tickets have been published. No application changes have been implemented.

## Baseline

Integration branch: codex/reliability-stack, in an isolated worktree based on freshly fetched main at 65dd2ff97b1b071ecff5ccc57200016fa7c22142.

A fresh npm ci followed by npm test passed all five suites and 29 top-level behavioral tests. The generated artifact is current and measures 153,762 bytes against its 159,000-byte cap. Existing source splitting, pinned bundling, CI installation, and recent UI fixes are retained.

## Scope

Deliver compatible shared writes, recoverable local and shared saves, literal Sheet text, interruption/conflict-safe setup, voluntary reflection, and efficient history rendering. Preserve scoring, activity identities, frozen storage data, challenge timezone semantics, the existing visual language, and the published URL.

Database replacement, authentication/organizer permissions, atomic activity editing/restoration, a broader Record redesign, and neutral first-run browsing remain separate follow-on decisions. This stack establishes the reliability they require; it does not authorize a storage cutover.

## Proposed tickets

1. **Clone the live Sheet and prove recovery**\n   - Blocked by: None.\n   - Delivers: The organizer has a private untouched recovery copy and a separate disposable shared-mode rehearsal copy before any change can reach the crew.

2. **Keep shared reads and saves working across backend rollout**\n   - Blocked by: 1.\n   - Delivers: A climber using either the existing browser or the updated browser can load the board and save an activity through a real Apps Script web-app deployment.

3. **Keep local drafts recoverable when storage fails**\n   - Blocked by: None.\n   - Delivers: A climber in local mode sees whether an activity was durably saved and can recover the draft when browser storage is unavailable or full.

4. **Retry an uncertain shared activity without duplicates**\n   - Blocked by: 2.\n   - Delivers: A climber whose save response disappears can retry the same activity and receive one authoritative saved record.

5. **Resolve slow shared saves without trapping the form**\n   - Blocked by: 4.\n   - Delivers: A climber gets a bounded save wait, a clear unresolved outcome when confirmation is unavailable, and a reliable path back to the saved activity.

6. **Preserve climber names and notes as literal text**\n   - Blocked by: 2.\n   - Delivers: Names and notes remain exactly what a climber entered when saved to, read from, and exported from shared mode.

7. **Recover a shared setup save interrupted mid-write**\n   - Blocked by: 4.\n   - Delivers: If the organizer's setup save is interrupted, the crew continues to see a complete committed configuration and the organizer can resolve the save safely.

8. **Keep stale setup edits from removing a newly joined climber**\n   - Blocked by: 7.\n   - Delivers: An organizer saving an older roster receives a recoverable conflict instead of overwriting a climber who joined while setup was open.

9. **Make weekly reflection voluntary and history ranges explicit**\n   - Blocked by: None.\n   - Delivers: A climber opens their recap when wanted, sees only recorded achievements, and can distinguish rolling seven-day totals from calendar-week bounty limits.

10. **Render growing activity history without repeated full scans**\n   - Blocked by: None.\n   - Delivers: A climber browsing a larger personal or crew history gets the same credits and entries with less repeated computation.

11. **Verify the complete stack and refresh the recovery clone**\n   - Blocked by: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10.\n   - Delivers: The organizer can review a tested release with a verified fresh recovery copy and a demonstrated rollback before any merge to main.

## Branch and PR structure

The root draft PR is the integration/release review and targets main. Ticket branches are stacked in a stable topological order, each based on its preceding branch so every PR exposes only its own changes. The proposed order is 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11. Native issue blocking edges express true prerequisites; a neighboring position in the PR stack does not invent a semantic dependency.

If a pending external gate blocks a ticket, independent frontier work may branch directly from the integration base and be restacked later. Keep each slice green, regenerate the artifact for source changes, and run aggregate checks after restacking. Advance the integration tip by reviewed branch commits; do not merge the root PR to main as a shortcut for an unfinished slice.

The root PR stays draft with auto-merge disabled. No merge to main until the exact final commit passes all tests, the private live-Sheet recovery clone is refreshed and verified, the disposable-copy rehearsal is complete, and the rollout/rollback sequence is reviewed. Do not place Sheet URLs, deployment URLs, copied crew records, or private recovery manifests in GitHub.

## Private database-copy gate

The live Google Sheet URL has been requested and is still needed. A clone has not been created. The required outputs are (1) an untouched private recovery copy and (2) a different disposable copy for mutation rehearsals. Confirm copied script/provisioning properties separately rather than assuming a Sheet file copy carries them. Never point rehearsal writes at the live Sheet.

A snapshot is time-bounded. Refresh it before the intended merge and rehearse preservation of later acknowledged writes; restoring an old snapshot by itself is not a no-data-loss rollback.

## Ticket publication

The configured tracker is GitHub. Once the breakdown is approved, publish one issue per ticket with ready-for-agent, in dependency order, and attach native blocking relationships using each blocker's database ID. Ticket 1 may need organizer input for account access; retain that explicit external gate. Do not modify or close a parent issue. No existing open issues or PRs were found during preparation.

The full acceptance-criteria drafts are available locally as one file per ticket under .scratch/reliability-stack/issues. They intentionally contain no implementation file paths or code snippets. Publication is deferred solely for the review step required by the invoked to-tickets skill.
