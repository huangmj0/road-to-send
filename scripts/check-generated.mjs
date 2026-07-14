import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const artifact = new URL('../index.html', import.meta.url);
const before = readFileSync(artifact, 'utf8');
execFileSync(process.execPath, [new URL('./build.mjs', import.meta.url).pathname], {
  stdio: 'inherit',
});
const after = readFileSync(artifact, 'utf8');

if (before !== after) {
  throw new Error('index.html was stale and has been rebuilt. Commit the generated result.');
}

console.log('Generated index.html is current.');
