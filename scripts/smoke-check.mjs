// Live smoke check for a deployed Road to Send function (spec #175, "Live smoke check"). Point it
// at the function URL during the cutover:
//
//   node scripts/smoke-check.mjs https://<project-ref>.supabase.co/functions/v1/road-to-send
//
// It sends exactly three requests and prints PASS or FAIL for each, exiting 1 if any failed:
//   GET      the board; the payload must satisfy src/schema.json at its current version
//   OPTIONS  the CORS headers a browser needs
//   POST     {"action":"__smoke__"}, which every backend answers with unknown_action
//
// It is non-mutating by construction: every request it can send is an init in the frozen
// SMOKE_REQUESTS below, sent unmodified from one call site, and none of them is a write action.
// tests/smoke-check.test.js holds it to that. Not part of the app.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {schemaProblems} from '../tests/supabase/schema-check.mjs';

const schema = JSON.parse(readFileSync(new URL('../src/schema.json', import.meta.url), 'utf8'));
const VERSION = schema.properties.version.const;

export const SMOKE_REQUESTS = Object.freeze([
  Object.freeze({name: 'GET', init: Object.freeze({method: 'GET'})}),
  Object.freeze({name: 'OPTIONS', init: Object.freeze({method: 'OPTIONS'})}),
  Object.freeze({
    name: 'POST __smoke__',
    init: Object.freeze({method: 'POST', headers: Object.freeze({'Content-Type': 'text/plain;charset=utf-8'}), body: '{"action":"__smoke__"}'}),
  }),
]);

class CheckFailed extends Error {}
const fail = message => { throw new CheckFailed(message); };

const list = value => String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);

function expectOrigin(response) {
  const origin = response.headers.get('access-control-allow-origin');
  if (origin !== '*') fail(`Access-Control-Allow-Origin is ${origin ? JSON.stringify(origin) : 'missing'}, expected "*"`);
}

async function readJson(response) {
  if (response.status !== 200) fail(`answered HTTP ${response.status}, expected 200: ${(await response.text()).slice(0, 200)}`);
  expectOrigin(response);
  const type = response.headers.get('content-type') || '';
  if (!/^application\/json\b/i.test(type)) fail(`content-type is ${JSON.stringify(type)}, expected application/json`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return fail(`body is not JSON: ${text.slice(0, 200)}`);
  }
}

// One judge per request name: each reads the Response and returns a PASS detail or throws.
const JUDGES = {
  async GET(response) {
    const payload = await readJson(response);
    if (payload && payload.ok === false) fail(`answered an error envelope: ${payload.error?.code}: ${payload.error?.message}`);
    const problems = schemaProblems(schema, payload);
    if (problems.length) fail(`payload does not match src/schema.json v${VERSION}: ${problems.slice(0, 5).join('; ')}`);
    const crew = payload.config ? `${payload.config.crew.length} crew` : 'config not set yet';
    return `version ${payload.version}, ${payload.activities.length} activities, ${crew}`;
  },
  async OPTIONS(response) {
    if (response.status < 200 || response.status > 299) fail(`answered HTTP ${response.status}, expected 204`);
    expectOrigin(response);
    const methods = response.headers.get('access-control-allow-methods');
    for (const method of ['GET', 'POST']) {
      if (!list(methods).includes(method.toLowerCase())) fail(`Access-Control-Allow-Methods is ${JSON.stringify(methods)}, which does not allow ${method}`);
    }
    const headers = response.headers.get('access-control-allow-headers');
    if (!list(headers).some(name => name === 'content-type' || name === '*')) {
      fail(`Access-Control-Allow-Headers is ${JSON.stringify(headers)}, which does not allow content-type`);
    }
    return `HTTP ${response.status}, CORS allows any origin, GET and POST, content-type`;
  },
  async 'POST __smoke__'(response) {
    const payload = await readJson(response);
    if (payload?.version !== VERSION) fail(`version is ${JSON.stringify(payload?.version)}, expected ${VERSION}`);
    const code = payload.ok === false ? payload.error?.code : undefined;
    if (code !== 'unknown_action') fail(`expected ok:false with code unknown_action, got ${JSON.stringify(payload).slice(0, 200)}`);
    return 'unknown_action, as expected; nothing was written';
  },
};

// Runs every check against url with the injected fetch. Never throws: a request that fails to
// send, or a reply that fails its check, becomes {ok: false, detail}.
export async function runSmokeCheck(url, {fetch: fetchImpl = globalThis.fetch} = {}) {
  const checks = [];
  for (const request of SMOKE_REQUESTS) {
    try {
      const response = await fetchImpl(url, request.init);
      checks.push({name: request.name, ok: true, detail: await JUDGES[request.name](response)});
    } catch (error) {
      checks.push({name: request.name, ok: false, detail: error instanceof CheckFailed ? error.message : `request failed: ${error?.message || error}`});
    }
  }
  return {ok: checks.every(check => check.ok), checks};
}

// The command line: returns the exit code (0 all passed, 1 a check failed, 2 bad usage).
export async function main(argv, {fetch: fetchImpl = globalThis.fetch, log = console.log} = {}) {
  const [url] = argv;
  let protocol;
  try {
    protocol = new URL(url).protocol;
  } catch {}
  if (protocol !== 'https:' && protocol !== 'http:') {
    log('Usage: node scripts/smoke-check.mjs <function-url>');
    log('  e.g. node scripts/smoke-check.mjs https://<project-ref>.supabase.co/functions/v1/road-to-send');
    return 2;
  }
  const result = await runSmokeCheck(url, {fetch: fetchImpl});
  for (const check of result.checks) log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name} — ${check.detail}`);
  log(result.ok ? 'Smoke check passed.' : 'Smoke check FAILED.');
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
