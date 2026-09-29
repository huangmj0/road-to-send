import { readFileSync } from 'node:fs';
import { artifactPath, buildContract, buildHtml, contractPath } from './build.mjs';

// Read-only: renders src/ in memory and compares. It never writes a generated file, so a
// stale one keeps failing until it is rebuilt and committed. `--contract=<path>` points the
// contract comparison at another file; the tests use it to prove a stale contract is caught.
const contractOverride = process.argv.find(arg => arg.startsWith('--contract='))?.slice('--contract='.length);
const committed = readFileSync(artifactPath, 'utf8');
const rendered = buildHtml();

if (committed !== rendered) {
  throw new Error(
    'index.html does not match src/. Run `npm run build` and commit the regenerated index.html.',
  );
}

if (readFileSync(contractOverride || contractPath, 'utf8') !== buildContract()) {
  throw new Error(
    'The Supabase function contract does not match src/. Run `npm run build` and commit the regenerated contract.generated.json.',
  );
}

console.log('Generated index.html and Supabase function contract are current.');
