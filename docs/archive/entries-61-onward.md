# v11 pass — entries 61 onward

The current open archive file: rule 10 moves each finished entry here. When it approaches the
per-file cap in `tests/docs-check.mjs`, start the next file rather than raising the cap.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.

---

## 61. Mark today's bounties you have already claimed

Status: Done — 2026-07-31
Notes: Commit `Mark today's claimed bounties`. Added `claimedTodayIds()` to identify a person's
same-day bounty claims without consulting scoring, then used the single set in `renderBounties()`
to append the state to the existing description and accessible claim label while preserving its
enabled one-tap markup. Archived entry 60. index.html 153,245 → 153,623 bytes (+378, 93.1% of the
165,000-byte budget). `npm test`: 5/5 suites.
Deviations: None.

### Why
The three bounty rows on the You card are one-tap claim buttons and look identical whether or not you have already claimed that bounty today. Bounties are not de-duplicated per day the way categories are — a second claim of the same bounty scores again until the weekly cap — so tapping one twice by accident is silent, and the only way to check what you already claimed today is to open the claimed list and read dates. The card that offers the claim should say what you already did with it.

### Requirements
- `src/app.js` — add a pure helper `claimedTodayIds(nameLower,today)` returning a `Set` of the `bountyId` strings that person logged on that date: filter `logs` for `x.type==='bounty'`, `nameKey(x)===nameLower` and `String(x.date).slice(0,10)===String(today).slice(0,10)`. Count every claim, credited or capped — this reports what was logged, not what scored.
- `src/app.js` — `renderBounties()` computes the set once (`claimedTodayIds(String(me).toLowerCase(),challengeToday())`) before mapping the daily list, and for a bounty already in the set appends ` · claimed today` to the row's existing `<small>` description text and the same suffix to the end of the row's `aria-label`.
- **The button markup is pinned.** `tests/static-check.mjs` line 143 matches `<button class="bounty" type="button"` followed by `data-claim-bounty=` and then `aria-label="Claim `. Keep the `class` attribute exactly `"bounty"`, keep `type="button"` in the same position, and keep `aria-label` starting with `Claim `. Put the new state in the text content, not in the class list — no `class="bounty claimed"`.
- The button stays enabled and stays a claim button. No new CSS, no new element, no change to `button.bounty`'s four-column grid.

### Tests
- `tests/client-state.state.test.js`: `claimedTodayIds` returns an empty `Set` for an unknown name; it includes a bounty claimed by that person on that date; it excludes the same bounty claimed by someone else, and the same person's claim on a different date; two claims of one bounty on the same day yield a set of size 1.
- `tests/client-state.dom.test.js`: extend the entry 11 bounty block. With no logs, `#todayBounties` contains no `claimed today`. After adding a `bounty` log for `me` with today's first bounty id and re-rendering, that row's markup carries `claimed today` while the other two rows do not, the row still carries `data-claim-bounty` and `aria-label="Claim `, and `claimBounty()` on it still preselects it on the Record form — every existing assertion in that block keeps passing.
- `tests/static-check.mjs`: `function claimedTodayIds(` is present. Do not add a second assertion about the button markup; line 143 already pins it and this entry's job is to keep it passing.

### Do not
Disable, hide, grey out or reorder a claimed row — the crew can claim a bounty twice and this entry does not change that. Do not add a "2 of 3 claimed" counter, a per-day cap figure, or anything naming a bounty the user has **not** claimed; the tone rule forbids the absence framing, and an aggregate of it is the same nudge. Do not touch `#bountyCapHint`, `claimedBounties()` or the weekly cap maths in `computeCreditsRaw()` (rule 6).

---
