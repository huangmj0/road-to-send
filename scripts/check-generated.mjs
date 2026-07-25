import { readFileSync } from 'node:fs';
import { artifactPath, buildHtml } from './build.mjs';

// Read-only: renders src/ in memory and compares. It never writes index.html, so a
// stale artifact keeps failing until it is rebuilt and committed.
const committed = readFileSync(artifactPath, 'utf8');
const rendered = buildHtml();

if (committed !== rendered) {
  throw new Error(
    'index.html does not match src/. Run `npm run build` and commit the regenerated index.html.',
  );
}

console.log('Generated index.html is current.');
