# v11 pass — entries 61 onward

The current open archive file: rule 10 moves each finished entry here. When it approaches the
per-file cap in `tests/docs-check.mjs`, start the next file rather than raising the cap.

Entries are the originals from `IMPROVEMENT_LOG.md`, moved here verbatim under rule 10. Nothing here
is renumbered, reworded, or re-run. This is closed history and never a queue — see
`IMPROVEMENT_LOG.md` for live work.

---

## 62. Key the heatmap shades

Status: Done — 2026-07-31
Notes: Commit `Key the heatmap shades`. Added a static, non-interactive heatmap shade key using
the existing five shade classes, with one accessible text alternative. Archived entry 61 into the
new current `entries-61-onward.md` pass because the previous archive would exceed the 90,000-byte
cap. index.html 153,623 → 154,286 bytes (+663, 93.5% of the 165,000-byte budget). `npm test`:
5/5 suites.
Deviations: None.

### Why
The daily activity heatmap paints five shades from `heatLevel()`, and nothing on the page says what they mean. A darker square is more points, but how many is a guess, and the `title` tooltip that carries the real figure never appears on a touch device — which is what this crew uses. Entry 36 gave the heatmap a caption naming the best day; a shade key is the other half, and every other graphic on the page (`.trend` bars, `.breakdown` bars, `.pyramid` bars) carries its number in the row.

### Requirements
- `src/index.template.html` — inside `#heatmapCard`, between `<div id="youHeatmap" …></div>` and `<p id="heatmapSummary" class="hint"></p>`, add a static key: a container `<div id="heatmapLegend" class="heat-legend" role="img" aria-label="Shade key: lighter squares are fewer points, darker squares are more">`, holding the word `Less`, five `<i aria-hidden="true">` swatches carrying the existing classes `heat-cell heat0` through `heat-cell heat4`, and the word `More`. The `Less`/`More` words sit in `<span aria-hidden="true">` — the container's `aria-label` is the text alternative, so the key announces once, not seven times (rule 7).
- The key lives inside `#heatmapCard`, so it hides and shows with the card `renderHeatmap()` already toggles. **No JavaScript change at all** — this is template plus CSS only.
- `src/styles.css` — add one compact rule block in the existing style: `.heat-legend` is a flex row, small gap, `.hint`-sized muted text, right-aligned or left-aligned to match the card, with the swatches sized around 12px square and inheriting `.heat-cell`'s existing border-radius and colours. Do not restate the `heat0`–`heat4` background colours; reuse the classes. Match the file's single-line compact formatting — `tests/static-check.mjs` matches exact CSS text elsewhere and reformatting breaks unrelated assertions.
- Nothing here is interactive, so the 44px rule does not apply; keep it non-interactive.

### Tests
- `tests/static-check.mjs`: `#heatmapLegend` exists, carries `role="img"` and a non-empty `aria-label`, and falls between `#youHeatmap` and `#heatmapSummary` in source order — which also keeps line 62's existing heatmap/caption assertion true. Assert the five swatch classes `heat0`–`heat4` all appear inside the card, and that the legend's swatches are `aria-hidden="true"`.
- No client-state assertions: there is no new helper and no render path to exercise.

### Do not
Add a JS-driven legend, a hover-only tooltip, or a sixth shade; change `heatLevel()`'s thresholds or the `heat0`–`heat4` colours (the state suite pins the buckets at lines 336–344); or put the key on the Crew tab, where there is no heatmap. Do not caption it with anything about days with no points — "Less" is a scale label, and a count of blank days is the absence framing the tone rule rules out.

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
