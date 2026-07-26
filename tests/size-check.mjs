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
const BUDGET = 161000;

const bytes = readFileSync(new URL('../index.html', import.meta.url)).length;
const pct = ((bytes / BUDGET) * 100).toFixed(1);

console.log(`index.html is ${bytes} bytes — ${pct}% of the ${BUDGET}-byte budget.`);

assert.ok(
  bytes <= BUDGET,
  `index.html is ${bytes} bytes, over the ${BUDGET}-byte budget: raise \`BUDGET\` deliberately in a log entry that explains the growth — never as a side effect of another change.`,
);
