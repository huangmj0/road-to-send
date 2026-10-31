// TRAP: the modules under test are ESM (.mjs) and this file is CommonJS, so everything is loaded
// with dynamic import() inside async tests, never a top-level require. The function reads
// `version` from the generated contract, so a stale contract.generated.json (run
// `npm run build`) fails here as a version mismatch, not as a logic bug. The only Apps Script input
// is FEATURES, read from the frozen v13 redirector (legacy/apps-script-v13.js) through
// tests/apps-script-harness.js; its arrays come from another vm realm, so copy them with Array.from
// before deepStrictEqual. Scenarios in tests/supabase/scenarios.mjs must stay valid against an empty
// real backend: seeded-data and injected-clock cases belong in this file, not there.
// The golden tests (bottom of the file) assert the core against tests/fixtures/supabase-validation.golden.json,
// recorded from the frozen script by scripts/capture-validation-golden.mjs (it reads legacy/apps-script-v13.js,
// so no build is needed); the golden is a fixed record, not a live comparison, so a behavior change in
// the core fails here until the affected expectations are deliberately edited by hand or the change is
// reverted. Rerunning the generator only restores the frozen baseline (see AGENTS.md).
// Inputs come from tests/supabase/parity-inputs.mjs and each fixture entry carries its decoded input,
// so editing a table without updating the fixture fails on a stale input, not on a vague diff.
// The HTTP-transport test rebuilds index.mjs's Request/Response adaptation around route() by
// hand (index.mjs calls Deno.serve on import, so it is never imported here); the real entry is
// exercised only by tests/supabase-stack.test.mjs against a local stack.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const {loadScript} = require('./apps-script-harness.js');

const schema = JSON.parse(fs.readFileSync(new URL('../src/schema.json', `file://${__filename}`), 'utf8'));
const fn = name => import(new URL(`../supabase/functions/road-to-send/${name}`, `file://${__filename}`));
const helper = name => import(new URL(`./supabase/${name}`, `file://${__filename}`));

const clock = iso => () => new Date(iso);
const transport = (handle, store, now) => request => handle(request, store, now);

const appsScriptFeatures = () => Array.from(vm.runInContext('FEATURES', loadScript()));

test('conformance scenarios pass in-process against an empty in-memory store', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const {scenarios} = await helper('scenarios.mjs');
  for (const scenario of scenarios) {
    const send = transport(handle, createMemoryStore(), clock('2026-07-13T12:00:00Z'));
    await assert.doesNotReject(scenario.run({send, schema}), scenario.name);
  }
});

// The real-stack target (npm run test:supabase) sends these scenarios over HTTP. Here the same
// HTTP transport runs against route() behind a fetch stub, so a transport bug fails without Docker.
test('conformance scenarios pass through the HTTP transport against route() behind a fetch stub', async () => {
  const {route} = await fn('http.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const {createHttpTransport} = await helper('local-stack.mjs');
  const {scenarios} = await helper('scenarios.mjs');
  const url = 'http://127.0.0.1:54321/functions/v1/road-to-send';
  for (const scenario of scenarios) {
    const store = createMemoryStore(), requests = [];
    const fetch = async (to, init = {}) => {
      requests.push({to, method: init.method, type: init.headers?.['Content-Type']});
      const result = await route({method: init.method || 'GET', bodyText: init.body ?? ''}, store, clock('2026-07-13T12:00:00Z'));
      return new Response(result.status === 204 ? null : result.body, {status: result.status, headers: result.headers});
    };
    await assert.doesNotReject(scenario.run({send: createHttpTransport(url, fetch), schema}), scenario.name);
    assert.ok(requests.length && requests.every(r => r.to === url), scenario.name);
    for (const r of requests.filter(r => r.method === 'POST')) assert.equal(r.type, 'text/plain;charset=utf-8', 'POSTs like the browser does');
  }
});

test('the HTTP transport reports a non-JSON or non-200 reply with its status and body', async () => {
  const {createHttpTransport} = await helper('local-stack.mjs');
  const reply = (status, body, type) => async () => new Response(body, {status, headers: {'Content-Type': type}});
  const send = fetch => createHttpTransport('http://127.0.0.1:54321/functions/v1/road-to-send', fetch)({method: 'GET', bodyText: ''});
  await assert.rejects(send(reply(502, 'bad gateway', 'text/plain')), /GET .* 502 .*bad gateway/);
  await assert.rejects(send(reply(200, '<html>', 'text/html')), /GET .* 200 .*<html>/);
  await assert.rejects(send(reply(200, 'not json', 'application/json')), /not JSON.*not json/);
  assert.deepEqual(await send(reply(200, '{"ok":true}', 'application/json; charset=utf-8')), {ok: true});
});

test('the local stack comes from `supabase status -o env` and must be on loopback', async () => {
  const {localStack} = await helper('local-stack.mjs');
  const status = ['API_URL="http://127.0.0.1:54321"', 'ANON_KEY="anon.jwt"', 'SERVICE_ROLE_KEY="service.jwt"', 'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"', ''].join('\n');
  assert.deepEqual(localStack(status), {apiUrl: 'http://127.0.0.1:54321', functionUrl: 'http://127.0.0.1:54321/functions/v1/road-to-send', anonKey: 'anon.jwt', serviceKey: 'service.jwt', dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});
  assert.equal(localStack(`${status}FUNCTIONS_URL="http://localhost:54321/functions/v1/"\n`).functionUrl, 'http://localhost:54321/functions/v1/road-to-send');
  assert.throws(() => localStack(status.replace('127.0.0.1:54321', 'proj.supabase.co')), /not a local stack/);
  assert.throws(() => localStack('API_URL="http://127.0.0.1:54321"\n'), /ANON_KEY/);
  assert.throws(() => localStack(status.replace('127.0.0.1:54322', 'db.proj.supabase.co:5432')), /not a local stack/);
  assert.throws(() => localStack(status.replace(/DB_URL=.*\n/, '')), /DB_URL/);
});

// The real-stack import check (tests/supabase-stack.test.mjs) applies generated SQL with psql.
test('runPsql feeds SQL on stdin to psql, stops on the first error, and refuses a non-loopback database', async () => {
  const {runPsql} = await helper('local-stack.mjs');
  const dbUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const calls = [];
  const spawn = result => (cmd, args, options) => { calls.push({cmd, args, options}); return {status: 0, stdout: '', stderr: '', ...result}; };
  runPsql(dbUrl, 'begin;\ncommit;\n', {spawn: spawn({})});
  assert.equal(calls[0].cmd, 'psql');
  assert.deepEqual(calls[0].args, [dbUrl, '--no-psqlrc', '--quiet', '--set', 'ON_ERROR_STOP=1']);
  assert.equal(calls[0].options.input, 'begin;\ncommit;\n');
  runPsql(dbUrl, '', {spawn: spawn({}), psql: '/opt/pg/bin/psql'});
  assert.equal(calls[1].cmd, '/opt/pg/bin/psql');
  assert.throws(() => runPsql(dbUrl, 'x', {spawn: spawn({status: 3, stderr: 'ERROR:  syntax error'})}), /exited 3.*syntax error/s);
  assert.throws(() => runPsql(dbUrl, 'x', {spawn: spawn({status: null, error: Object.assign(new Error('spawn psql ENOENT'), {code: 'ENOENT'})})}), /psql.*postgresql-client/);
  assert.throws(() => runPsql('postgresql://postgres:pw@db.proj.supabase.co:5432/postgres', 'x', {spawn: spawn({})}), /not a local stack/);
  assert.equal(calls.length, 4, 'a non-loopback database is refused before psql starts');
});

test('a seeded store serves activities in insertion order and crew in position order', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const {assertConforms} = await helper('scenarios.mjs');
  const activity = (seq, id, name, createdAt) => ({seq, id, name, type: 'exercise', category: 'exercise', points: 2, date: '2026-07-13', createdAt, hardestGrade: '', bountyId: '', bountyTitle: '', note: ''});
  const activities = [activity(3, 'c', 'Zed', '2026-07-13T07:00:00.000Z'), activity(1, 'b', 'Maya', '2026-07-13T09:00:00.000Z'), activity(2, 'a', 'Alex', '2026-07-13T08:00:00.000Z')];
  const store = createMemoryStore({settings: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'UTC'}, participants: [{name: 'Zed', position: 2}, {name: 'Alex', position: 0}, {name: 'Maya', position: 1}], activities});
  const board = await handle({method: 'GET', bodyText: ''}, store, clock('2026-07-13T12:00:00Z'));
  assertConforms(schema, board);
  assert.deepEqual(board.activities.map(x => x.id), ['b', 'a', 'c']);
  assert.deepEqual(board.config, {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}, {name: 'Maya'}, {name: 'Zed'}]});
  assert.ok(board.activities.every(x => !('seq' in x)), 'seq is storage order, not wire data');
  assert.deepEqual(board.configErrors, []);
});

test('version comes from schema.json and features equal the frozen v13 script FEATURES', async () => {
  const {handle, API_VERSION, FEATURES} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const board = await handle({method: 'GET', bodyText: ''}, createMemoryStore(), clock('2026-07-13T12:00:00Z'));
  assert.equal(API_VERSION, schema.properties.version.const);
  assert.equal(board.version, schema.properties.version.const);
  assert.deepEqual(board.features, appsScriptFeatures());
  assert.deepEqual(FEATURES, appsScriptFeatures());
});

test('serverDate follows the settings time zone across a UTC midnight', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const settings = timeZone => ({startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone});
  const at = (timeZone, iso) => handle({method: 'GET', bodyText: ''}, createMemoryStore({settings: settings(timeZone)}), clock(iso));
  const la = await at('America/Los_Angeles', '2026-07-14T06:30:00Z');
  assert.equal(la.serverDate, '2026-07-13');
  assert.equal(la.timeZone, 'America/Los_Angeles');
  assert.equal((await at('UTC', '2026-07-14T06:30:00Z')).serverDate, '2026-07-14');
  assert.equal((await at('Pacific/Auckland', '2026-07-13T13:00:00Z')).serverDate, '2026-07-14');
});

test('a store failure becomes the server_error envelope, never a stack trace', async () => {
  const {handle} = await fn('core.mjs');
  const store = {getSettings: async () => { throw new Error('boom: secret detail'); }, listParticipants: async () => [], listActivities: async () => []};
  const reply = await handle({method: 'GET', bodyText: ''}, store, clock('2026-07-13T12:00:00Z'));
  assert.deepEqual(reply, {version: schema.properties.version.const, ok: false, error: {code: 'server_error', message: 'The request could not be completed', details: []}});
});

test('saveConfig keeps the stored time zone while replacing dates, goal and crew', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const store = createMemoryStore({settings: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'America/Los_Angeles'}, participants: ['Alex', 'Maya']});
  const at = clock('2026-08-02T06:30:00Z');
  const saved = await handle({method: 'POST', bodyText: JSON.stringify({action: 'saveConfig', config: {startDate: '2026-08-01', tripDate: '2026-08-31', goal: 750, crew: ['Zed', 'Alex']}})}, store, at);
  assert.equal(saved.ok, true);
  const board = await handle({method: 'GET', bodyText: ''}, store, at);
  assert.deepEqual(board.config, {startDate: '2026-08-01', tripDate: '2026-08-31', goal: 750, crew: [{name: 'Zed'}, {name: 'Alex'}]});
  assert.equal(board.timeZone, 'America/Los_Angeles');
  assert.equal(board.serverDate, '2026-08-01', 'serverDate still follows the kept time zone');
});

test('participants sharing a position are served in name order', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const store = createMemoryStore({settings: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'UTC'}, participants: [{name: 'Zed', position: 1}, {name: 'Maya', position: 1}, {name: 'Alex', position: 0}]});
  const board = await handle({method: 'GET', bodyText: ''}, store, clock('2026-07-13T12:00:00Z'));
  assert.deepEqual(board.config.crew, [{name: 'Alex'}, {name: 'Maya'}, {name: 'Zed'}]);
});

test('a store failure on a write becomes the server_error envelope', async () => {
  const {handle, API_VERSION} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const store = {...createMemoryStore({settings: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'UTC'}, participants: ['Alex']})};
  const fail = async () => { throw Object.assign(new Error('insert failed: secret'), {code: 'ECONNRESET'}); };
  Object.assign(store, {saveConfig: fail, addParticipant: fail, appendActivity: fail, deleteActivity: fail});
  const serverError = {version: API_VERSION, ok: false, error: {code: 'server_error', message: 'The request could not be completed', details: []}};
  for (const body of [{action: 'saveConfig', config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: ['Alex']}}, {action: 'addParticipant', name: 'Maya'}, {action: 'delete', id: 'x'}, {name: 'Alex', type: 'climb', date: '2026-07-13'}]) {
    assert.deepEqual(await handle({method: 'POST', bodyText: JSON.stringify(body)}, store, clock('2026-07-13T12:00:00Z')), serverError, JSON.stringify(body));
  }
});

test('a create without id takes its id from crypto.randomUUID and createdAt from the injected clock', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const store = createMemoryStore({settings: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'America/Los_Angeles'}, participants: ['Alex']});
  const reply = await handle({method: 'POST', bodyText: JSON.stringify({name: 'Alex', type: 'climb', date: '2026-07-13', createdAt: '2000-01-01T00:00:00.000Z'})}, store, clock('2026-07-14T06:30:00Z'));
  assert.equal(reply.createdAt, '2026-07-14T06:30:00.000Z');
  assert.match(reply.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const [stored] = await store.listActivities();
  assert.deepEqual(stored, {id: reply.id, createdAt: reply.createdAt, name: 'Alex', type: 'climb', category: 'climb', points: 3, date: '2026-07-13', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''});
});

test('a unique-index race on addParticipant is reported as duplicate_participant', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  // The roster read before the insert misses a concurrent registration; the store's insert sees it.
  const store = {...createMemoryStore({settings: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'UTC'}, participants: ['Alex']}), addParticipant: async () => false};
  const reply = await handle({method: 'POST', bodyText: JSON.stringify({action: 'addParticipant', name: 'Maya'})}, store, clock('2026-07-13T12:00:00Z'));
  assert.deepEqual(reply.error, {code: 'duplicate_participant', message: 'That name already exists', details: [{field: 'name', reason: 'must be unique'}]});
});

test('the schema checker rejects payloads that break the contract', async () => {
  const {schemaProblems} = await helper('schema-check.mjs');
  const board = {version: schema.properties.version.const, features: [], activities: [], config: null};
  assert.deepEqual(schemaProblems(schema, board), []);
  assert.ok(schemaProblems(schema, {...board, version: 1}).length);
  assert.ok(schemaProblems(schema, {...board, serverDate: '13/07/2026'}).length);
  assert.ok(schemaProblems(schema, {...board, config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 5, crew: []}}).length);
  assert.ok(schemaProblems(schema, {version: schema.properties.version.const}).length);
});

// ---- Golden: the core's validation outcomes against outputs recorded from the Apps Script (frozen v13) ----

const golden = JSON.parse(fs.readFileSync(new URL('./fixtures/supabase-validation.golden.json', `file://${__filename}`), 'utf8'));

// Every fixture entry must still describe the table input it was recorded from, then the core must
// reproduce the recorded outcome exactly.
async function checkGolden(entries, inputs, run, label) {
  const {decode, plain} = await helper('parity-inputs.mjs');
  assert.equal(entries.length, inputs.length, `${label}: fixture and table have the same number of cases (update the fixture; by hand once expectations diverge from the frozen script)`);
  for (const [i, input] of inputs.entries()) {
    assert.deepEqual(decode(entries[i].input), input, `${label}[${i}]: fixture input is stale (update the fixture entry; by hand once expectations diverge from the frozen script)`);
    assert.deepEqual(plain(await run(input)) ?? null, entries[i].expected, `${label}[${i}]: ${JSON.stringify(input)}`);
  }
}

test('golden: dates parse to the recorded value or error, leap years and year limits included', async () => {
  const core = await fn('core.mjs');
  const inputs = await helper('parity-inputs.mjs');
  const {outcome} = inputs;
  await checkGolden(golden.dates, inputs.PARITY_DATES, input => outcome(() => core.parseDateValue(input)), 'dates');
  await checkGolden(golden.dateObjects, inputs.PARITY_DATE_OBJECTS, iso => outcome(() => core.parseDateValue(new Date(iso), 'UTC')), 'dateObjects');
  await checkGolden(golden.calendarDates, inputs.PARITY_CALENDAR, ([y, m, d]) => core.calendarDate(y, m, d), 'calendarDates');
  assert.deepEqual(core.parseDateValue(new Date('2026-07-14T06:30:00Z'), 'America/Los_Angeles'), {value: '2026-07-13'}, 'a Date is read in the configured time zone');
  const dateAt = date => golden.dates[inputs.PARITY_DATES.indexOf(date)].expected.value;
  assert.deepEqual(dateAt('2024-02-29'), {value: '2024-02-29'}, 'a leap day is accepted');
  assert.ok(dateAt('2025-02-29').error, 'a non-leap Feb 29 is rejected');
  assert.ok(dateAt('2200-12-31').value && dateAt('2201-01-01').error, 'the year ceiling is 2200');
  assert.ok(dateAt('1900-01-01').value && dateAt('1899-12-31').error, 'the year floor is 1900');
});

test('golden: goals, crews and whole setups validate to the recorded outcomes', async () => {
  const core = await fn('core.mjs');
  const inputs = await helper('parity-inputs.mjs');
  const {outcome} = inputs;
  await checkGolden(golden.goals, inputs.PARITY_GOALS, input => outcome(() => core.parseGoal(input)), 'goals');
  await checkGolden(golden.crews, inputs.PARITY_CREWS, input => outcome(() => core.normalizeCrew(input)), 'crews');
  await checkGolden(golden.configs, inputs.PARITY_CONFIGS, input => outcome(() => core.validateConfig(input)), 'configs');
  const goalAt = goal => golden.goals[inputs.PARITY_GOALS.indexOf(goal)].expected.value;
  assert.deepEqual(goalAt('1,000'), {value: 1000});
  assert.ok(goalAt(49).error && goalAt(50).value === 50 && goalAt(10000).value === 10000 && goalAt(10001).error, 'goal bounds are 50..10000');
});

test('golden: activity payloads validate to the recorded outcomes, window edges and note lengths included', async () => {
  const core = await fn('core.mjs');
  const inputs = await helper('parity-inputs.mjs');
  const {outcome, DAY, PARITY_CREW, PARITY_SETTINGS} = inputs;
  const table = inputs.PARITY_ACTIVITIES({catalog: core.SCORING.bounties, offered: core.dailyBounties(DAY)});
  const participants = PARITY_CREW.map(name => ({name}));
  await checkGolden(golden.activities, table, input => outcome(() => core.checkWindow(core.validateActivity(input, participants), PARITY_SETTINGS)), 'activities');
  const codes = new Set(golden.activities.map(c => c.expected.error?.code || 'ok'));
  assert.deepEqual([...codes].sort(), ['invalid_activity', 'ok', 'outside_challenge_window'], 'the table reaches every activity outcome');
  const noteAt = length => golden.activities[table.findIndex(a => a && a.note === 'n'.repeat(length) && a.type === 'mobility')].expected;
  assert.ok(noteAt(120).value && noteAt(121).error, 'a note may be 120 characters, not 121');
});

test('golden: whole POST requests get the recorded envelopes from the handler', async () => {
  const {handle, SCORING, dailyBounties} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const inputs = await helper('parity-inputs.mjs');
  const {DAY, PARITY_STATES, maskReply} = inputs;
  const bodies = inputs.PARITY_REQUESTS({catalog: SCORING.bounties, offered: dailyBounties(DAY)});
  assert.deepEqual(Object.keys(golden.requests), Object.keys(PARITY_STATES));
  const seen = new Set();
  for (const [stateName, state] of Object.entries(PARITY_STATES)) {
    const store = () => createMemoryStore({settings: state.config && {...state.config, timeZone: 'UTC'}, participants: state.crew, activities: state.activityIds.map(id => ({id, name: 'Alex', type: 'climb', category: 'climb', points: 3, date: DAY, createdAt: '2026-07-13T08:00:00.000Z', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''}))});
    await checkGolden(golden.requests[stateName], bodies, async bodyText => {
      const reply = await handle({method: 'POST', bodyText}, store(), clock('2026-07-13T12:00:00Z'));
      if (reply.ok && 'createdAt' in reply) assert.ok(!Number.isNaN(Date.parse(reply.createdAt)) && /\S/.test(reply.id));
      return maskReply(reply);
    }, `requests.${stateName}`);
    for (const c of golden.requests[stateName]) seen.add(c.expected.ok ? 'ok' : c.expected.error.code);
  }
  assert.deepEqual([...seen].sort(), ['duplicate_participant', 'invalid_activity', 'invalid_config', 'invalid_delete', 'invalid_json', 'invalid_participant', 'invalid_request', 'not_found', 'ok', 'outside_challenge_window', 'setup_required', 'unknown_action'], 'the request table reaches every write outcome');
});

// An intended bounty catalog or rotation change (an API bump, constraint 3) records this comparison's
// 184 days of outputs in the golden fixture and asserts the core against them, and edits them by hand.
// That moves the assertion onto a recorded surface; it does not retire it (ADR-0004).
// Kept from the retired 'parity: the bounty rotation agrees over 184 consecutive days' test: the frozen
// v13 script is now the recorded reference, so the core's full bounty objects, hashText and the empty
// date edge case stay pinned at their original strength.
test('golden: the core bounty rotation matches the frozen v13 script over 184 consecutive days, empty date included', async () => {
  const core = await fn('core.mjs');
  const {plain} = await helper('parity-inputs.mjs');
  const script = loadScript();
  const cursor = new Date('2026-01-01T12:00:00Z');
  for (let i = 0; i < 184; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    assert.deepEqual(core.dailyBounties(day), plain(script.dailyBounties(day)), day);
    assert.equal(core.hashText(`${day}|climb`), script.hashText(`${day}|climb`), day);
  }
  assert.deepEqual(core.dailyBounties(''), plain(script.dailyBounties('')));
});

test('golden: hashText and the daily rotation seed match values recorded from the frozen script', async () => {
  const core = await fn('core.mjs');
  for (const [day, hash] of [['2026-01-01', 2742051474], ['2026-07-13', 456467503], ['2026-12-31', 3646867301]]) {
    assert.equal(core.hashText(`${day}|climb`), hash, day);
    assert.equal(core.dailyBounties(day).length, 3, day);
  }
});
