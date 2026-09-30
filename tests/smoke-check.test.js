// TRAP: scripts/smoke-check.mjs is ESM and this file is CommonJS, so load it with dynamic import()
// inside async tests. Nothing here touches the network: every run gets a stubbed fetch that
// answers from a per-method table of Response objects, and a Response body can be read once, so
// each stub builds fresh Responses per call. The "never writes" guarantee is proven twice: at run
// time (every request the stub sees is one of SMOKE_REQUESTS' frozen inits, by identity) and
// statically (the source has one fetch call site and one request body). If you add a request to
// the smoke check, both halves must still hold.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const script = path.join(__dirname, '..', 'scripts', 'smoke-check.mjs');
const load = () => import(script);
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'schema.json'), 'utf8'));
const VERSION = schema.properties.version.const;
const URL_ = 'https://project-ref.example.test/functions/v1/road-to-send';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const json = (payload, {status = 200, headers = {}} = {}) => () =>
  new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {status, headers: {...CORS, 'Content-Type': 'application/json', ...headers}});

const board = {version: VERSION, features: ['categories-v1'], activities: [], config: null, configErrors: [], serverDate: '2026-09-30', timeZone: 'UTC', fetchedAt: '2026-09-30T12:00:00.000Z'};
const healthy = {
  GET: json(board),
  OPTIONS: () => new Response(null, {status: 204, headers: CORS}),
  POST: json({version: VERSION, ok: false, error: {code: 'unknown_action', message: 'Unsupported action: __smoke__', details: []}}),
};

// A fetch stub answering from a {METHOD: () => Response | throw} table, recording every call.
function stub(overrides = {}) {
  const table = {...healthy, ...overrides};
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({url, init});
    return table[init.method]();
  };
  return {fetch, calls};
}

const byName = result => Object.fromEntries(result.checks.map(check => [check.name, check]));

test('a healthy function passes all three checks', async () => {
  const {runSmokeCheck} = await load();
  const {fetch, calls} = stub();
  const result = await runSmokeCheck(URL_, {fetch});
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.map(check => [check.name, check.ok]), [['GET', true], ['OPTIONS', true], ['POST __smoke__', true]]);
  assert.ok(calls.every(call => call.url === URL_), 'every request goes to the URL given');
  assert.match(byName(result).GET.detail, /0 activities/);
});

test('each failure fails its own check and only that check', async () => {
  const {runSmokeCheck} = await load();
  const cases = [
    ['GET', 'a non-200 GET', {GET: json(board, {status: 500})}, /500/],
    ['GET', 'a GET that is not JSON', {GET: json('<html>')}, /not JSON/],
    ['GET', 'a GET with a non-JSON content type', {GET: json(board, {headers: {'Content-Type': 'text/html'}})}, /content-type/],
    ['GET', 'a GET error envelope', {GET: json({version: VERSION, ok: false, error: {code: 'server_error', message: 'The request could not be completed', details: []}})}, /server_error/],
    ['GET', 'a GET that breaks the schema', {GET: json({...board, activities: 'none'})}, /activities/],
    ['GET', 'a GET at another protocol version', {GET: json({...board, version: VERSION - 1})}, /version/],
    ['GET', 'a GET without the CORS origin header', {GET: json(board, {headers: {'Access-Control-Allow-Origin': ''}})}, /Access-Control-Allow-Origin/],
    ['GET', 'a GET that throws', {GET: () => { throw new TypeError('fetch failed'); }}, /fetch failed/],
    ['OPTIONS', 'an OPTIONS that answers 401', {OPTIONS: () => new Response('{}', {status: 401, headers: CORS})}, /401/],
    ['OPTIONS', 'an OPTIONS without the CORS origin header', {OPTIONS: () => new Response(null, {status: 204, headers: {...CORS, 'Access-Control-Allow-Origin': ''}})}, /Access-Control-Allow-Origin/],
    ['OPTIONS', 'an OPTIONS that does not allow POST', {OPTIONS: () => new Response(null, {status: 204, headers: {...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS'}})}, /POST/],
    ['OPTIONS', 'an OPTIONS that does not allow content-type', {OPTIONS: () => new Response(null, {status: 204, headers: {...CORS, 'Access-Control-Allow-Headers': 'authorization'}})}, /content-type/],
    ['OPTIONS', 'an OPTIONS that throws', {OPTIONS: () => { throw new TypeError('fetch failed'); }}, /fetch failed/],
    ['POST __smoke__', 'a POST answering another error code', {POST: json({version: VERSION, ok: false, error: {code: 'invalid_activity', message: 'x', details: []}})}, /invalid_activity/],
    ['POST __smoke__', 'a POST that reports success', {POST: json({version: VERSION, ok: true})}, /unknown_action/],
    ['POST __smoke__', 'a POST at another protocol version', {POST: json({version: VERSION - 1, ok: false, error: {code: 'unknown_action', message: 'x', details: []}})}, /version/],
    ['POST __smoke__', 'a non-200 POST', {POST: json('{}', {status: 401})}, /401/],
    ['POST __smoke__', 'a POST that is not JSON', {POST: json('oops')}, /not JSON/],
    ['POST __smoke__', 'a POST without the CORS origin header', {POST: json({version: VERSION, ok: false, error: {code: 'unknown_action', message: 'x', details: []}}, {headers: {'Access-Control-Allow-Origin': ''}})}, /Access-Control-Allow-Origin/],
    ['POST __smoke__', 'a POST that throws', {POST: () => { throw new TypeError('fetch failed'); }}, /fetch failed/],
  ];
  for (const [failing, what, overrides, detail] of cases) {
    const result = await runSmokeCheck(URL_, {fetch: stub(overrides).fetch});
    assert.equal(result.ok, false, `${what} fails the run`);
    for (const check of result.checks) {
      assert.equal(check.ok, check.name !== failing, `${what}: ${check.name} ${check.name === failing ? 'fails' : 'still passes'}`);
    }
    assert.match(byName(result)[failing].detail, detail, `${what} says why`);
  }
});

test('main prints PASS or FAIL per check and exits non-zero on any failure', async () => {
  const {main} = await load();
  const lines = [];
  const log = line => lines.push(line);
  assert.equal(await main([URL_], {fetch: stub().fetch, log}), 0);
  assert.deepEqual(lines.slice(0, 3).map(line => line.split(/\s+/).slice(0, 2).join(' ')), ['PASS GET', 'PASS OPTIONS', 'PASS POST']);

  lines.length = 0;
  assert.equal(await main([URL_], {fetch: stub({OPTIONS: () => new Response(null, {status: 404})}).fetch, log}), 1);
  assert.deepEqual(lines.slice(0, 3).map(line => line.split(/\s+/)[0]), ['PASS', 'FAIL', 'PASS']);
});

test('main refuses to run without an http(s) function URL', async () => {
  const {main} = await load();
  for (const argv of [[], ['not a url'], ['ftp://example.test/']]) {
    const lines = [];
    const {fetch, calls} = stub();
    assert.equal(await main(argv, {fetch, log: line => lines.push(line)}), 2, JSON.stringify(argv));
    assert.equal(calls.length, 0, 'nothing is sent');
    assert.match(lines.join('\n'), /usage: node scripts\/smoke-check\.mjs/i);
  }
});

test('the smoke check can only send GET, OPTIONS and the __smoke__ POST', async () => {
  const {SMOKE_REQUESTS, runSmokeCheck} = await load();

  // The one constant every request comes from, deeply frozen.
  assert.deepEqual(JSON.parse(JSON.stringify(SMOKE_REQUESTS)), [
    {name: 'GET', init: {method: 'GET'}},
    {name: 'OPTIONS', init: {method: 'OPTIONS'}},
    {name: 'POST __smoke__', init: {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: '{"action":"__smoke__"}'}},
  ]);
  const frozen = value => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(frozen));
  assert.ok(frozen(SMOKE_REQUESTS), 'SMOKE_REQUESTS and everything in it is frozen');

  // At run time, even when every check fails, each request sent is one of those inits, by identity.
  const inits = new Set(SMOKE_REQUESTS.map(request => request.init));
  for (const overrides of [{}, {GET: json('x', {status: 500}), OPTIONS: () => new Response(null, {status: 500}), POST: json({ok: true})}]) {
    const {fetch, calls} = stub(overrides);
    await runSmokeCheck(URL_, {fetch});
    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => inits.has(call.init)), 'every request is sent with a SMOKE_REQUESTS init, unmodified');
  }

  // Statically: one fetch call site, fed from SMOKE_REQUESTS, and one request body in the source.
  const source = fs.readFileSync(script, 'utf8');
  const code = source.replace(/^\s*\/\/.*$/gm, '');
  assert.deepEqual(code.match(/\bfetch\w*\s*\(/g), ['fetchImpl('], 'exactly one fetch call site');
  assert.match(code, /for \(const request of SMOKE_REQUESTS\)[\s\S]*fetchImpl\(url, request\.init\)/, 'it sends each SMOKE_REQUESTS init as is');
  assert.equal((code.match(/\bbody\s*:/g) || []).length, 1, 'exactly one request body in the source');
  for (const action of ['saveConfig', 'addParticipant', 'delete']) {
    assert.ok(!new RegExp(`['"\`]${action}['"\`]`).test(code), `the source never names the ${action} write action`);
  }
});
