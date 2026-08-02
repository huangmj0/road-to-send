# Road to Send improvement archive

Shipped work, closed and verbatim. **This is the audit trail and never a queue** — live work is in
`IMPROVEMENT_LOG.md`, and an implementer never works from anything here.

The entries live in `docs/archive/`, split by pass so that looking one up costs a bounded read
instead of loading every entry ever shipped. `tests/docs-check.mjs` caps each file; when the open
file approaches the cap, start the next one rather than raising it.

## `docs/archive/entries-84-onward.md` — current — entries 83 onward

The open file. Rule 10 archives each finished entry here.

- 83. Stop announcing what did not change, and put the chart label where ARIA reads it
- 84. Line up the numbers and close the double gap in the stat grid
- 85. Give the Bounty Hunter marker visible text and the small controls a 44px target
- 86. Count a bounty-only day as a day you were active
- 87. Make "rank" mean one thing
- 88. One name key, so one odd Sheet row cannot empty or crash the You tab
- 89. Collapse the superseded 44px one-offs and the declarations the cascade already discards
- 90. Delete three class attributes that style nothing
- 91. Guard the five live regions entry 83 left unguarded
- 92. Hide the bottom-nav glyphs from the screen reader, and keep focus on the chip you tapped
- 93. Break a long note inside the claimed-bounty row
- 94. Key the heatmap's columns with weekday letters
- 95. Mark the bounties you already claimed inside the Record tab's select
- 96. Cut render()'s avoidable rescoring

## `docs/archive/entries-61-onward.md` — v11 pass — entries 61–82

- 61. Mark today's bounties you have already claimed
- 62. Key the heatmap shades
- 64. Say the size of the field next to a rank
- 65. Stop promising a local delete cannot be undone
- 66. Re-baseline the bundle budget for the rolling-window pass
- 67. A rolling seven-day window
- 68. Bounty Hunter counts the last seven days
- 69. Three titles for the habits people keep
- 70. On Fire and Beast
- 71. Retire the podium medals
- 72. Recent, not Weekly
- 73. The trend arrow reads the last seven days
- 74. A daily momentum curve
- 75. Keep the You page head on screen at 320px
- 76. Repair the seven dropped `font` shorthands and give the display font a fallback
- 77. Stop the momentum curve stretching its text and its points
- 78. Draw the curve on day one, and the smallest bars at all
- 79. Fit the leaderboard on a 320px screen
- 80. Raise the progress bar, the sorted column and the meter fills to a visible contrast
- 81. One focus ring, at a contrast you can see
- 82. Stop three remaining surfaces pushing past their card

## `docs/archive/entries-41-onward.md` — v11 pass — entries 41–60

- 41. Preview the week's bounties
- 42. Show the note you wrote on a climb
- 43. Filter your own feed by category
- 44. Filter the Crew feed with the same chips
- 45. Chart your own weeks on the You tab
- 46. List the bounties you have claimed
- 47. Start the grade select where you left it
- 48. Open a crewmate's card from the Crew feed
- 49. Say which filter emptied the feed
- 50. Show what each claimed bounty scored
- 51. Caption the grade pyramid
- 52. Let a climb carry a note
- 53. Show a crewmate's weekly points in their card
- 54. Show a crewmate's most recent entries in their card
- 55. Say which protocol version this build expects
- 56. Date the export snapshot
- 57. Re-baseline the bundle budget for this queue
- 58. Caption the claimed bounty list
- 59. Show a crewmate's claimed bounties in their card
- 60. Announce the crewmate's grade pyramid

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
