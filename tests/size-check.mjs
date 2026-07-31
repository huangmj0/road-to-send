import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The deployed artifact is a single self-contained file the crew downloads on every
// cold load, so its growth is capped here. Raise BUDGET deliberately in a log entry
// that explains the growth — never as a side effect of another change.
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
const BUDGET = 200000;

const bytes = readFileSync(new URL('../index.html', import.meta.url)).length;
const pct = ((bytes / BUDGET) * 100).toFixed(1);

console.log(`index.html is ${bytes} bytes — ${pct}% of the ${BUDGET}-byte budget.`);

assert.ok(
  bytes <= BUDGET,
  `index.html is ${bytes} bytes, over the ${BUDGET}-byte budget: raise \`BUDGET\` deliberately in a log entry that explains the growth — never as a side effect of another change.`,
);
