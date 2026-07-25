import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The deployed artifact is a single self-contained file the crew downloads on every
// cold load, so its growth is capped here. Raise BUDGET deliberately in a log entry
// that explains the growth — never as a side effect of another change.
//
// Raised 132000 -> 156000 by log entry 23. Projection it derives from: 125420 bytes
// after entry 18, plus ~18000 for the rest of the queue (19 ~6000 and 20 ~6000 are
// modal-class, matching the 5973 the Week in Review modal cost; 21 ~2500; 22 ~3000),
// landing near 143500 — so this leaves ~12500 bytes of headroom. If the queue lands
// under that, lower BUDGET back toward the real figure: a cap that only ratchets
// upward stops being a guard.
const BUDGET = 156000;

const bytes = readFileSync(new URL('../index.html', import.meta.url)).length;
const pct = ((bytes / BUDGET) * 100).toFixed(1);

console.log(`index.html is ${bytes} bytes — ${pct}% of the ${BUDGET}-byte budget.`);

assert.ok(
  bytes <= BUDGET,
  `index.html is ${bytes} bytes, over the ${BUDGET}-byte budget: raise \`BUDGET\` deliberately in a log entry that explains the growth — never as a side effect of another change.`,
);
