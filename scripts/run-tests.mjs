import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Every suite runs, even after one fails: an `&&` chain hides the suites behind the
// first failure, which is exactly how a stale artifact used to mask real regressions.
// Nothing here tolerates a failure — the run still exits 1 if any suite failed.
const root = fileURLToPath(new URL('..', import.meta.url));

const suites = [
  { name: 'check:generated', args: ['scripts/check-generated.mjs'] },
  {
    name: 'node --test',
    args: [
      '--test',
      'tests/backend-script.test.js',
      'tests/client-state.state.test.js',
      'tests/client-state.dom.test.js',
      'tests/client-state.shared.test.js',
      'tests/codex-run.test.mjs',
      'tests/protocol-fixtures.test.js',
      'tests/queue-git-guard.test.mjs',
      'tests/queue-status.test.mjs',
      'tests/smoke.test.js',
      'tests/ui-scope.test.mjs',
    ],
  },
  { name: 'static-check', args: ['tests/static-check.mjs'] },
  { name: 'docs-check', args: ['tests/docs-check.mjs'] },
  { name: 'size-check', args: ['tests/size-check.mjs'] },
];

const results = [];

for (const suite of suites) {
  console.log(`\n=== ${suite.name} ===`);
  const run = spawnSync(process.execPath, suite.args, { cwd: root, stdio: 'inherit' });
  if (run.error) console.error(`${suite.name} could not be started: ${run.error.message}`);
  const ok = !run.error && run.status === 0;
  if (!ok && run.signal) console.error(`${suite.name} was killed by ${run.signal}.`);
  results.push({ name: suite.name, ok });
}

const failed = results.filter(result => !result.ok);

console.log('\n=== summary ===');
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
console.log(`${results.length - failed.length}/${results.length} suites passed.`);

if (failed.length) {
  console.error(`Failing suites: ${failed.map(result => result.name).join(', ')}.`);
  process.exit(1);
}
