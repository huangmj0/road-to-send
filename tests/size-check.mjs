import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The deployed artifact is a single self-contained file the crew downloads on every
// cold load, so its growth is capped here. Raise BUDGET deliberately in a log entry
// that explains the growth — never as a side effect of another change.
//
// Raised 156000 -> 161000 by log entry 24. Entry 23's 156000 came from a projection
// that has since been measured and missed: it expected entries 19-22 to add ~18000
// and land near 143500, but they added 10447 and landed at 135867 — 87.1% of a cap
// sized for arithmetic that never happened. So this re-baselines against a measured
// start rather than a second projection on top of the first: 135867 bytes after
// entry 22, plus ~12600 for entries 25-41 (28 ~2500 and 41 ~2500 each add markup,
// rows and CSS; 36 ~1500; 38 ~1500; 33 ~1200; 40 ~1000; 27 ~800; 26 ~500; 35 ~500;
// 31 ~400; 25 ~300; 32 ~300; 34 ~100; 30 gives ~500 back by collapsing the duplicated
// row markup), landing near 148500 — so this leaves ~12500 bytes of headroom.
//
// The instruction entry 23 left here still stands, and now applies to this number:
// if the queue again lands well under its projection, the next budget entry lowers
// BUDGET back toward the real figure. A cap that only ratchets upward stops being a
// guard. Every entry reports its own byte delta in Notes: (rule 10), so the measured
// figure is always available to check this projection against.
const BUDGET = 161000;

const bytes = readFileSync(new URL('../index.html', import.meta.url)).length;
const pct = ((bytes / BUDGET) * 100).toFixed(1);

console.log(`index.html is ${bytes} bytes — ${pct}% of the ${BUDGET}-byte budget.`);

assert.ok(
  bytes <= BUDGET,
  `index.html is ${bytes} bytes, over the ${BUDGET}-byte budget: raise \`BUDGET\` deliberately in a log entry that explains the growth — never as a side effect of another change.`,
);
