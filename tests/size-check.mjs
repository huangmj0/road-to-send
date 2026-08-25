import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The deployed artifact is a single self-contained file the crew downloads on every
// cold load, so its growth is capped here. Raise BUDGET deliberately, in a change that
// explains the growth — never as a side effect of another change.
//
// The re-baselines below are the record of that rule being applied. They cite entry
// numbers from the improvement queue that used to drive this repo; the queue is gone,
// but the measurements and the reasoning still say why BUDGET is where it is.
//
// Re-baselined 156000 -> 161000 by log entry 24: measured at 135867 bytes after
// entry 22, plus ~12600 projected for entries 25–41, landing near 148500 — so this
// leaves ~12500 bytes of headroom. If this queue again lands well under its
// projection, the next budget entry lowers BUDGET toward the real figure: a cap
// that only ratchets upward stops being a guard.
//
// Re-baselined 161000 -> 200000 on maintainer instruction, measured at 149886 bytes
// on main after entry 48 (entry 49, in flight, takes it to 150088). Entries 45–49
// cost +1515, +1457, +657, +157 and +202 bytes, so the
// 161000 cap left roughly two to six entries of room and would have halted the queue
// partway through entries 49–56. This is a larger step than the growth alone argues
// for: it buys the whole pass rather than tracking the measured figure. Per the note
// above, the next budget entry should lower BUDGET back toward what index.html
// actually weighs once this pass lands.
//
// Re-baselined 200000 -> 165000 by log entry 57: measured 152071 bytes on main after
// entry 56. This step is a reduction, not another raise: a cap that only ratchets
// upward stops being a guard. Entries 58–65 are eight small display entries whose
// nearest analogues in the archive cost between +13 and +1,515 bytes each, so
// ~12,900 bytes of headroom covers the pass with room for the worst case. As before,
// the next budget entry re-measures rather than assuming.
//
// Re-baselined 165000 -> 170000 by log entry 66: measured 154670 bytes on main
// after entries 58–65. Entries 67–74 add the rolling-window helper and credit map,
// title tiles and their CSS, a comparison update, and an SVG trend; labels change
// in entries 68 and 72, while entries 70 and 71 remove the champions panel and
// podium markup, CSS and JS. The 5330 bytes of headroom covers that net pass shape;
// the next budget entry re-measures rather than assuming.
//
// Re-baselined 170000 -> 174000 by the Crag design pass: measured 169598 bytes, which
// clears the 170000 cap by 402 bytes. Three commits (the goal ring; the palette,
// grain and hero; then the numeral grammar, timeline rail, raised Record pill and
// one-shot reveals) spent all but those 402 of the 5330-byte headroom the entry-66
// note set aside. The growth is almost entirely CSS: it re-skins every surface at
// once, and a token-driven sheet means most of it is new rules rather than edited
// ones. The raise is not covering an overrun — the pass fits — it is buying back
// working room, because 402 bytes would halt the next display change on its first
// rule. 174000 leaves roughly 4400. Per the rule above the next budget entry
// re-measures rather than assuming, and a pass that lands under its projection
// lowers the cap again.
//
// Re-baselined 174000 -> 184000 by the Crag structural pass: measured 179346 bytes, 9748 over the
// 169598 the previous note recorded and 5346 past the cap. The growth is three things, measured
// rather than estimated: +5881 in styles.css (the glyph system, the restructured today hero and
// meta strip, the stacked category chips, the bounty rows and their claimed state, the day
// headings and the flat stat grid), +2037 in index.template.html (almost all of it the inline
// <svg class="sprite"> symbol set, which is paid once and then referenced), and +1830 in app.js
// (the cap-aware ring geometry with its merge-on-bank pass, the leaderboard comparison rail, and
// glyph() replacing the emoji tables). It is a structural pass, not a re-skin: it changes what the
// markup is, so most of the CSS is new rules rather than edited ones, and the sprite is a one-time
// cost that made every icon site smaller. 184000 leaves roughly 4650 -- the same working room the
// entry-66 and Crag-skin notes settled on. Per the rule above the next budget entry re-measures
// rather than assuming, and a pass that lands under its projection lowers the cap again.
//
// Re-baselined 184000 -> 187000 by the activity-normalization pass: measured 182091 bytes, 1925 above
// the 180166 main carried in, leaving 1909 under the cap. Every byte is app.js — no other bundled
// source changed — and it splits +752 code against +1173 comment. The code is normalizeActivity(),
// which coerces each field of a Sheet row to the shape src/schema.json already declares, plus the
// normalizeActivities() wrapper that keeps the frozen roadToSendLogsV9 rows out of it. The comment is
// the larger half and is kept deliberately: it records why local rows are exempt and why the date is
// matched whole rather than sliced, and this pass regressed on both of those points in review before
// the comments were written. 1909 bytes would halt the next display change on its first rule, so
// 187000 buys back roughly 4900 — the working room the entry-66 and Crag notes settled on. Per the
// rule above the next budget entry re-measures rather than assuming, and a pass that lands under its
// projection lowers the cap again.
const BUDGET = 187000;

const bytes = readFileSync(new URL('../index.html', import.meta.url)).length;
const pct = ((bytes / BUDGET) * 100).toFixed(1);

console.log(`index.html is ${bytes} bytes — ${pct}% of the ${BUDGET}-byte budget.`);

assert.ok(
  bytes <= BUDGET,
  `index.html is ${bytes} bytes, over the ${BUDGET}-byte budget: raise \`BUDGET\` deliberately, in a change that explains the growth — never as a side effect of another change.`,
);
