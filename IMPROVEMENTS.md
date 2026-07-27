# Road to Send improvement archive

Shipped work, closed and verbatim. **This is the audit trail and never a queue** — live work is in
`IMPROVEMENT_LOG.md`, and an implementer never works from anything here.

The entries live in `docs/archive/`, split by pass so that looking one up costs a bounded read
instead of loading every entry ever shipped. `tests/docs-check.mjs` caps each file; when the open
file approaches the cap, start the next one rather than raising it.

## `docs/archive/entries-41-onward.md` — current

The open file. Rule 10 archives each finished entry here.

## `docs/archive/entries-1-14.md` — v11 pass — entries 1–14

- 1. Per-category breakdown card (You tab)
- 2. Weekly bounty-cap progress (You tab)
- 3. Grade pyramid (You tab)
- 4. Streak tracking (You tab)
- 5. Calendar heatmap of daily points (You tab)
- 6. Projected finish on the Crew tab
- 7. Weekly trend bars (Crew tab)
- 8. Leaderboard week-trend arrows
- 9. Empty-state and onboarding polish
- 10. Personal records card (You tab)
- 11. Theme polish: theme-color meta + inline favicon
- 12. Dark mode via prefers-color-scheme
- 13. Weekly / Overall leaderboard toggle with dynamic podium medals (Crew tab)
- 14. Surface daily bounties: move card up + one-tap claim (You tab)

## `docs/archive/entries-15-24.md` — v11 pass — entries 15–24

- 15. Make the improvement loop safe: archive shipped work, add a selection rule, reconcile the rules
- 16. Stop unverified deploys reaching the live URL, and stop `npm test` hiding failures
- 17. "What's left today": category status and balanced-bonus reachability (You tab)
- 18. Personal countdown and personal pace (You tab)
- 23. Raise the bundle budget to cover the rest of the queue
- 19. Delete your own entries from the You feed, with a real confirm dialog and focus restoration
- 20. Tap a leaderboard row for a per-person card (Crew tab)
- 21. Record tab: show the bounty's description, and make the submit guard real
- 22. Share my progress: one clipboard helper, and stop a denied copy failing setup
- 24. Re-baseline the bundle budget for this queue

## `docs/archive/entries-25-40.md` — v11 pass — entries 25–40

- 25. Score the live log once per render
- 26. Delete the entry you confirmed
- 27. One guarded localStorage write
- 28. Undo a local delete
- 29. Keep the Crew feed read-only
- 30. One row-markup helper for the repeated cards
- 31. Say something when the export fails
- 32. Show the save in the credit preview
- 33. Tap a category chip to start recording it
- 34. Show the note you wrote on a bounty
- 35. Say which day the app thinks it is
- 36. Caption the heatmap and the trend chart
- 37. Focus the dialog you just opened
- 38. Show more of the feed
- 40. Share through the system share sheet

## `docs/archive/backfill-b1-b5.md` — v11 pass — shipped without a log entry

- B1. First-open Week in Review recap
- B2. All-time bounty leaderboard view and champions callout
- B3. Split leaderboard toggle into metric and time range
- B4. New directional bounties
- B5. Bump protocol to v11 so catalog changes reject stale backends

## `docs/archive/pre-queue-priorities.md` — P0–P3 (v6–v11)

The backlog that predates the four-state entry protocol; statuses there are free text.

- P0 — Define and enforce the challenge window
- P1 — Improve maintainability and automated coverage
- P2 — Clarify recovery and data ownership
- P3 — Improve the available bounties
