import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

assert.ok(script, 'index.html contains an inline application script');
assert.doesNotThrow(() => new Function(script), 'application JavaScript parses');

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML ids are unique');

for (const id of ['member', 'activityType', 'durationBand', 'activityDate', 'note', 'bountyMember', 'bountyNote', 'benchmarkMember', 'benchmarkPhase', 'benchmarkGym', 'benchmarkScale', 'endpoint', 'tripDate', 'groupGoal', 'crewNames']) {
  assert.match(html, new RegExp(`<label[^>]+for="${id}"`), `${id} has an associated label`);
}

assert.match(html, /<button[^>]+id="syncStatus"/, 'sync control is a native button');
assert.match(html, /id="syncDiagnostics"[^>]+role="status"[^>]+aria-live="polite"/, 'persistent diagnostics are announced');
assert.match(html, /id="toast"[^>]+role="status"[^>]+aria-live="polite"/, 'toast is a polite live region');
assert.match(html, /role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="logTitle"/, 'activity dialog has an accessible name');
assert.match(html, /role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="setupTitle"/, 'setup dialog has an accessible name');
assert.match(html, /role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="bountyClaimTitle"/, 'bounty dialog has an accessible name');
assert.match(html, /role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="benchmarkTitle"/, 'benchmark dialog has an accessible name');
assert.match(html, /aria-label="Close activity log"/, 'activity dialog close button is named');
assert.match(html, /aria-label="Close shared setup"/, 'setup dialog close button is named');
assert.match(html, /aria-label="Close benchmark check-in"/, 'benchmark dialog close button is named');
assert.match(html, /id="bountyStatus"[^>]+role="status"[^>]+aria-live="polite"/, 'bounty status is announced');
assert.match(html, /id="bountyNote"[^>]+required[^>]+maxlength="120"/, 'bounty evidence is required and bounded');
assert.match(script, /data-bounty="\$\{esc\(b\.id\)\}"/, 'daily bounty cards expose claim controls');
assert.match(script, /features\.includes\('bounties'\)/, 'shared claims require the bounty capability');
assert.match(script, /features\.includes\('benchmarks'\)/, 'shared check-ins require the benchmark capability');
assert.match(script, /const WEEK_CAP=16,BONUS=2,BOUNTY_POINTS=2,BOUNTY_WEEK_LIMIT=2/, 'weekly maximum is 16 + 2 + 4');
assert.match(html, /No gender categories/, 'rules state the universal participation policy');
assert.doesNotMatch(html, /\b(male|female|men's|women's)\b/i, 'no gender-specific scoring category is present');
assert.match(script, /if\(ok&&!setupDirty\)populateSetup\(\)/, 'remote refresh preserves dirty setup fields');

for (const id of ['endpointError', 'tripDateError', 'groupGoalError', 'crewNamesError']) {
  assert.ok(ids.includes(id), `${id} exists for inline validation`);
}

console.log('Road to Send static accessibility and UX checks passed.');
