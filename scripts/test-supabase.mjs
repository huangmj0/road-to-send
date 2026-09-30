// npm run test:supabase: the conformance scenarios and the real-stack checks, over HTTP, against a
// local Supabase stack. Not part of `npm test`: it needs Docker and the Supabase CLI, plus psql
// (postgresql-client, or PSQL=<path>) for the import-tool check. Start the stack first, from the
// repository root:
//
//   supabase start               # applies supabase/migrations
//   supabase functions serve     # in another terminal; serves supabase/functions/road-to-send
//   npm run test:supabase
//
// The stack's URLs and dev keys come from `supabase status -o env`; only a loopback stack is
// accepted, because the suite deletes every row between tests.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localStack} from '../tests/supabase/local-stack.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = process.env.SUPABASE_CLI || 'supabase';

const status = spawnSync(cli, ['status', '-o', 'env'], {cwd: root, encoding: 'utf8'});
// A non-zero exit alone is not fatal: status also reports services left out with -x. What counts
// is whether it printed the URLs and keys.
let stack;
try {
  if (status.error) throw status.error;
  stack = localStack(status.stdout);
} catch (error) {
  console.error(`\`${cli} status -o env\` did not describe a local stack (exit ${status.status}): ${error.message}`);
  if (status.stderr) console.error(status.stderr.trim());
  console.error('Start the local stack with `supabase start` and `supabase functions serve` (Docker required).');
  process.exit(1);
}
console.log(`Local stack: API ${stack.apiUrl}, function ${stack.functionUrl}`);

const run = spawnSync(process.execPath, ['--test', 'tests/supabase-stack.test.mjs'], {cwd: root, stdio: 'inherit', env: {...process.env, ROAD_TO_SEND_STACK: JSON.stringify(stack)}});
if (run.error) console.error(`node --test could not be started: ${run.error.message}`);
process.exit(run.status ?? 1);
