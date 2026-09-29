// TRAP: the function's modules are ESM (.mjs) and this file is CommonJS, so load them with
// dynamic import() inside async tests. index.mjs calls Deno.serve at import time; the entry test
// stubs globalThis.Deno before importing it and removes the stub afterwards, so it must stay the
// only test that imports index.mjs. The store tests are the one place PostgREST request shapes
// are asserted; the conformance suite asserts wire payloads only. The contract test spawns
// scripts/check-generated.mjs against a temp copy and never touches the committed contract.
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const fn = name => import(new URL(`../supabase/functions/road-to-send/${name}`, `file://${__filename}`));
const build = () => import(new URL('../scripts/build.mjs', `file://${__filename}`));
const now = () => new Date('2026-07-13T12:00:00Z');

function stubFetch(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({url, init});
    const hit = Object.entries(routes).find(([fragment]) => url.includes(fragment));
    const {status = 200, body = []} = hit ? hit[1] : {status: 404};
    return {ok: status >= 200 && status < 300, status, json: async () => body};
  };
  return {fetch, calls};
}

test('the PostgREST store reads ordered rows with the service-role headers', async () => {
  const {createPostgrestStore} = await fn('store.mjs');
  const {fetch, calls} = stubFetch({
    '/settings': {body: [{start_date: '2026-07-01', trip_date: '2026-07-31', goal: 500, time_zone: 'America/Denver'}]},
    '/participants': {body: [{name: 'Zed'}, {name: 'Alex'}]},
    '/activities': {body: [{id: 'x', name: 'Zed', type: 'climb', category: 'climb', points: 3, date: '2026-07-02', created_at: '2026-07-02T10:00:00.000Z', hardest_grade: 'V4', bounty_id: '', bounty_title: '', note: 'n'}]},
  });
  const store = createPostgrestStore({url: 'https://proj.supabase.co/', serviceKey: 'service-key', fetch});
  assert.deepEqual(await store.getSettings(), {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'America/Denver'});
  assert.deepEqual(await store.listParticipants(), [{name: 'Zed'}, {name: 'Alex'}]);
  assert.deepEqual(await store.listActivities(), [{id: 'x', name: 'Zed', type: 'climb', category: 'climb', points: 3, date: '2026-07-02', createdAt: '2026-07-02T10:00:00.000Z', hardestGrade: 'V4', bountyId: '', bountyTitle: '', note: 'n'}]);
  const urls = calls.map(call => call.url);
  assert.ok(urls[0].startsWith('https://proj.supabase.co/rest/v1/settings?'));
  assert.ok(urls[1].startsWith('https://proj.supabase.co/rest/v1/participants?') && urls[1].includes('order=position.asc'));
  assert.ok(urls[2].startsWith('https://proj.supabase.co/rest/v1/activities?') && urls[2].includes('order=seq.asc'));
  for (const call of calls) {
    assert.equal(call.init.headers.apikey, 'service-key');
    assert.equal(call.init.headers.Authorization, 'Bearer service-key');
  }
});

test('the PostgREST store returns null settings when there is no row and pages past 1000 rows', async () => {
  const {createPostgrestStore} = await fn('store.mjs');
  const rows = n => Array.from({length: n}, (_, i) => ({name: `P${i}`}));
  const pages = [rows(1000), rows(5)];
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    return {ok: true, status: 200, json: async () => (url.includes('/participants') ? pages.shift() : [])};
  };
  const store = createPostgrestStore({url: 'https://proj.supabase.co', serviceKey: 'k', fetch});
  assert.equal(await store.getSettings(), null);
  assert.equal((await store.listParticipants()).length, 1005);
  const paged = calls.filter(url => url.includes('/participants'));
  assert.ok(paged[0].includes('offset=0') && paged[1].includes('offset=1000'));
});

test('a non-2xx PostgREST response becomes the server_error envelope at the handler', async () => {
  const {createPostgrestStore} = await fn('store.mjs');
  const {handle, API_VERSION} = await fn('core.mjs');
  const {fetch} = stubFetch({'/settings': {status: 500, body: {message: 'db exploded'}}});
  const store = createPostgrestStore({url: 'https://proj.supabase.co', serviceKey: 'k', fetch});
  const reply = await handle({method: 'GET', bodyText: ''}, store, now);
  assert.deepEqual(reply, {version: API_VERSION, ok: false, error: {code: 'server_error', message: 'The request could not be completed', details: []}});
});

test('OPTIONS answers 204 with CORS headers and no body', async () => {
  const {route, CORS_HEADERS} = await fn('http.mjs');
  const result = await route({method: 'OPTIONS', bodyText: ''}, null, now);
  assert.equal(result.status, 204);
  assert.equal(result.body, '');
  assert.deepEqual(result.headers, CORS_HEADERS);
  assert.equal(result.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(result.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
  assert.equal(result.headers['Access-Control-Allow-Headers'], 'content-type');
});

test('GET, POST and other methods carry CORS and JSON headers with an HTTP 200 body', async () => {
  const {route, CORS_HEADERS} = await fn('http.mjs');
  const {createMemoryStore} = await import(new URL('./supabase/memory-store.mjs', `file://${__filename}`));
  for (const [method, code] of [['GET', undefined], ['POST', 'unknown_action'], ['DELETE', 'invalid_request']]) {
    const result = await route({method, bodyText: '{"action":"x"}'}, createMemoryStore(), now);
    assert.equal(result.status, 200, method);
    assert.deepEqual(result.headers, {...CORS_HEADERS, 'Content-Type': 'application/json'}, method);
    assert.equal(JSON.parse(result.body).error?.code, code, method);
  }
});

test('the entry reads a text/plain POST as text, ignores GET query params, and hides failures', async () => {
  const seen = [];
  globalThis.Deno = {env: {get: name => ({SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'})[name]}, serve: handler => { seen.push(handler); }};
  const realFetch = globalThis.fetch;
  let fetchImpl = async () => ({ok: true, status: 200, json: async () => []});
  globalThis.fetch = (...args) => fetchImpl(...args); // the entry's store captured this wrapper at import
  try {
    const entry = await fn('index.mjs');
    assert.equal(seen.length, 1, 'the entry registers one Deno.serve handler');
    const get = await seen[0](new Request('https://f.example/functions/v1/road-to-send?_=123&x=y'));
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('access-control-allow-origin'), '*');
    assert.equal(get.headers.get('content-type'), 'application/json');
    assert.equal((await get.json()).config, null);
    const post = await entry.serve(new Request('https://f.example/', {method: 'POST', headers: {'content-type': 'text/plain;charset=UTF-8'}, body: '{"action":"__smoke__"}'}));
    assert.equal((await post.json()).error.code, 'unknown_action');
    const options = await entry.serve(new Request('https://f.example/', {method: 'OPTIONS'}));
    assert.equal(options.status, 204);
    fetchImpl = async () => { throw new Error('network down'); };
    const failed = await entry.serve(new Request('https://f.example/'));
    assert.equal(failed.headers.get('access-control-allow-origin'), '*');
    assert.equal((await failed.json()).error.code, 'server_error');
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.Deno;
  }
});

test('the generated contract is byte-stable and equals the shared sources', async () => {
  const {buildContract, contractPath} = await build();
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'src/schema.json'), 'utf8'));
  const scoring = JSON.parse(fs.readFileSync(path.join(root, 'src/scoring.json'), 'utf8'));
  assert.equal(buildContract(), buildContract());
  assert.equal(fs.readFileSync(contractPath, 'utf8'), buildContract());
  assert.deepEqual(JSON.parse(buildContract()), {apiVersion: schema.properties.version.const, scoring});
});

test('check:generated fails on a stale contract and passes on a current one', async () => {
  const {buildContract} = await build();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rts-contract-'));
  try {
    const run = file => spawnSync(process.execPath, ['scripts/check-generated.mjs', `--contract=${file}`], {cwd: root, encoding: 'utf8'});
    const file = path.join(dir, 'contract.generated.json');
    fs.writeFileSync(file, buildContract());
    assert.equal(run(file).status, 0);
    fs.writeFileSync(file, buildContract().replace('"apiVersion": ', '"apiVersion": 1'));
    const stale = run(file);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /contract does not match src/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
