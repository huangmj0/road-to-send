// TRAP: the modules under test are ESM (.mjs) and this file is CommonJS, so everything is loaded
// with dynamic import() inside async tests, never a top-level require. The function reads
// `version` from the generated contract, so a stale contract.generated.json (run
// `npm run build`) fails here as a version mismatch, not as a logic bug. The vm harness for the
// Apps Script FEATURES come from tests/apps-script-harness.js, shared with backend-script.test.js. Scenarios in
// tests/supabase/scenarios.mjs must stay valid against an empty real backend: seeded-data and
// injected-clock cases belong in this file, not there. The parity tests run the Apps Script in a
// vm realm: its arrays and Dates fail deepStrictEqual against ours on prototype alone, so compare
// through plain() and build Date inputs inside the context. appsScriptBackend() stubs the
// Sheet-touching helpers (readConfig, tab, appendActivity...) by reassigning context globals; a
// helper the Apps Script adds later that reads the Sheet directly will throw there, not diverge.
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

test('version comes from schema.json and features equal the Apps Script FEATURES', async () => {
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

test('an activity takes its id from crypto.randomUUID and createdAt from the injected clock', async () => {
  const {handle} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const store = createMemoryStore({settings: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, timeZone: 'America/Los_Angeles'}, participants: ['Alex']});
  const reply = await handle({method: 'POST', bodyText: JSON.stringify({name: 'Alex', type: 'climb', date: '2026-07-13', id: 'forged', createdAt: '2000-01-01T00:00:00.000Z'})}, store, clock('2026-07-14T06:30:00Z'));
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

// ---- Parity: the same input tables through the Apps Script (vm harness) and the core module ----

// vm objects come from another realm, so deepStrictEqual would reject them on prototype alone;
// every Apps Script result is compared through a JSON round trip.
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
function outcome(run) {
  try {
    return {value: plain(run())};
  } catch (error) {
    if (!error.code) throw error;
    return {error: {code: error.code, message: error.message, details: plain(error.details)}};
  }
}

const PARITY_DATES = [
  '2026-07-13', '2026-7-3', ' 2026-07-13 ', '2024-02-29', '2025-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '1900-01-01', '1899-12-31', '2200-12-31', '2201-01-01',
  '07/13/2026', '7/3/2026', '07-13-2026', '13/07/2026', '02/29/2025', 'July 13, 2026', 'Jul 13 2026', 'july 3, 2026', 'SEPT 9, 2026', 'Sept 31, 2026', 'Foo 3, 2026', 'July 13th, 2026',
  '2026/07/13', '2026-07-13T00:00:00Z', '20260713', 'tomorrow', '', '   ', null, undefined, 20260713, 0, true,
];
const PARITY_GOALS = [49, 50, 10000, 10001, '1,000', 12.5, '12.5', '500', ' 500 ', '1e3', '0x1F4', 'abc', '', null, undefined, -100, '10,001', Infinity, '50.0'];
const PARITY_CREWS = [
  ['Alex', 'Maya'], ['Alex', 'alex', 'ALEX ', 'Maya'], ['', '  ', 'Zed', null, undefined, 0, {name: ''}], [{name: ' Maya '}, {nom: 'x'}, 'Maya'],
  ['x'.repeat(30)], ['x'.repeat(31)], ['Alex', 'y'.repeat(31)], ['', 'z'.repeat(31)], [], 'Alex', null, undefined, {name: 'Alex'}, [42, 'Alex'],
];
const PARITY_CONFIGS = [
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: ['Alex']},
  {startDate: '7/1/2026', tripDate: 'July 31, 2026', goal: '1,000', crew: ['Alex', 'alex', 'Maya']},
  {startDate: '2026-07-31', tripDate: '2026-07-01', goal: 500, crew: ['Alex']},
  {startDate: '2026-07-31', tripDate: '2026-07-31', goal: 500, crew: ['Alex']},
  {startDate: 'soon', tripDate: '2026-02-30', goal: 12.5, crew: []},
  {startDate: '', tripDate: '', goal: '', crew: ['x'.repeat(31)]},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 10001, crew: ['Alex']},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 49, crew: ['Alex']},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: ['', ' ']},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: ['Alex', 'x'.repeat(31)]},
  {}, null, 'config',
];
const DAY = '2026-07-13';
const PARITY_ACTIVITIES = rotation => {
  const catalog = rotation.catalog, offered = rotation.offered;
  const offDay = catalog.find(b => !offered.some(o => o.id === b.id));
  return [
    {name: 'Alex', type: 'climb', date: DAY},
    {name: ' alex ', type: 'climb', date: DAY, hardestGrade: 'V17', note: '  top out  ', points: 99, category: 'mobility'},
    {name: 'Maya', type: 'climb', date: DAY, hardestGrade: 'VB'},
    {name: 'Maya', type: 'climb', date: DAY, hardestGrade: 'v4'},
    {name: 'Maya', type: 'exercise', date: '07/13/2026', hardestGrade: 'V4', bountyId: offered[0].id},
    {name: 'Maya', type: 'mobility', date: 'July 13, 2026'},
    ...offered.map(b => ({name: 'Alex', type: 'bounty', date: DAY, bountyId: b.id, points: 0})),
    {name: 'Alex', type: 'bounty', date: DAY, bountyId: 'no-such-bounty'},
    {name: 'Alex', type: 'bounty', date: DAY},
    {name: 'Alex', type: 'bounty', date: DAY, bountyId: offDay.id},
    {name: 'Alex', type: 'bounty', date: '2026-02-30', bountyId: offered[0].id},
    {name: 'Alex', type: 'run', date: DAY},
    {name: 'Alex', type: 'Climb', date: DAY},
    {name: 'Alex', date: DAY},
    {name: 'Alex', type: 'mobility', date: DAY, note: 'n'.repeat(120)},
    {name: 'Alex', type: 'mobility', date: DAY, note: 'n'.repeat(121)},
    {name: 'Alex', type: 'mobility', date: DAY, note: ` ${'n'.repeat(120)} `},
    {name: 'Alex', type: 'climb', date: 'yesterday', hardestGrade: 'V99', note: 'n'.repeat(121)},
    {name: 'Alex', type: 'mobility'},
    {name: 'Nobody', type: 'run', date: 'never'},
    {name: '', type: 'climb', date: DAY},
    {type: 'climb', date: DAY},
    null,
    {name: 'Alex', type: 'mobility', date: '2026-06-30'},
    {name: 'Alex', type: 'mobility', date: '2026-07-01'},
    {name: 'Alex', type: 'mobility', date: '2026-07-31'},
    {name: 'Alex', type: 'mobility', date: '2026-08-01'},
  ];
};
const PARITY_SETTINGS = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500};
const PARITY_CREW = ['Alex', 'Maya'];

// The Apps Script with its Sheet I/O replaced: the given config and roster are what it reads,
// writes land in a sink, and doPost returns the JSON text it would have served.
function appsScriptBackend({config = null, crew = [], activityIds = []} = {}) {
  const context = loadScript();
  const sink = {getLastRow: () => 0, getRange: () => ({clearContent() {}, setValues() {}}), clearContents() {}};
  context.ContentService = {createTextOutput: text => ({setMimeType: () => text}), MimeType: {JSON: 'json'}};
  context.LockService = {getDocumentLock: () => ({waitLock() {}, releaseLock() {}})};
  context.setup = () => {};
  context.tab = () => sink;
  context.formatSheets = () => {};
  context.readConfig = () => ({config: config && {...config, crew: crew.map(name => ({name}))}, errors: [], movedTo: ''});
  context.participantRecords = () => crew.map(name => ({name}));
  context.appendActivity = item => item;
  context.deleteActivity = id => activityIds.includes(id);
  return context;
}

test('parity: dates in every accepted format and every invalid one parse identically', async () => {
  const core = await fn('core.mjs');
  const script = appsScriptBackend();
  for (const input of PARITY_DATES) assert.deepEqual(outcome(() => core.parseDateValue(input)), outcome(() => script.parseDateValue(input)), JSON.stringify(input));
  for (const iso of ['2026-07-13T12:00:00Z', '2026-07-13T00:00:00Z', 'not a date']) {
    const scriptDate = vm.runInContext(`new Date(${JSON.stringify(iso)})`, script);
    assert.deepEqual(outcome(() => core.parseDateValue(new Date(iso), 'UTC')), outcome(() => script.parseDateValue(scriptDate)), iso);
  }
  assert.deepEqual(core.parseDateValue(new Date('2026-07-14T06:30:00Z'), 'America/Los_Angeles'), {value: '2026-07-13'}, 'a Date is read in the configured time zone');
  for (const [y, m, d] of [[2026, 2, 29], [2024, 2, 29], [1899, 1, 1], [2200, 12, 31], ['2026', '07', '13'], [2026.5, 1, 1]]) assert.equal(core.calendarDate(y, m, d), script.calendarDate(y, m, d), `${y}-${m}-${d}`);
});

test('parity: goals, crews and whole setups validate identically', async () => {
  const core = await fn('core.mjs');
  const script = appsScriptBackend();
  for (const input of PARITY_GOALS) assert.deepEqual(outcome(() => core.parseGoal(input)), outcome(() => script.parseGoal(input)), String(input));
  for (const input of PARITY_CREWS) assert.deepEqual(outcome(() => core.normalizeCrew(input)), outcome(() => script.normalizeCrew(input)), JSON.stringify(input));
  for (const input of PARITY_CONFIGS) assert.deepEqual(outcome(() => core.validateConfig(input)), outcome(() => script.writeConfig(input)), JSON.stringify(input));
  assert.deepEqual(core.parseGoal('1,000'), {value: 1000});
  assert.equal(outcome(() => core.normalizeCrew(['x'.repeat(31)])).error.code, 'invalid_config');
});

test('parity: activity payloads validate identically, window edges included', async () => {
  const core = await fn('core.mjs');
  const script = appsScriptBackend({config: PARITY_SETTINGS, crew: PARITY_CREW});
  const tables = PARITY_ACTIVITIES({catalog: core.SCORING.bounties, offered: core.dailyBounties(DAY)});
  const participants = PARITY_CREW.map(name => ({name}));
  const results = tables.map(input => {
    const ours = outcome(() => core.checkWindow(core.validateActivity(input, participants), PARITY_SETTINGS));
    assert.deepEqual(ours, outcome(() => script.validateActivityWindow(script.validateActivity(input))), JSON.stringify(input));
    return ours;
  });
  const codes = new Set(results.map(r => r.error?.code || 'ok'));
  assert.deepEqual([...codes].sort(), ['invalid_activity', 'ok', 'outside_challenge_window'], 'the table reaches every activity outcome');
});

test('parity: the bounty rotation agrees over 184 consecutive days', async () => {
  const core = await fn('core.mjs');
  const script = appsScriptBackend();
  const cursor = new Date('2026-01-01T12:00:00Z');
  for (let i = 0; i < 184; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    assert.deepEqual(core.dailyBounties(day), plain(script.dailyBounties(day)), day);
    assert.equal(core.hashText(`${day}|climb`), script.hashText(`${day}|climb`), day);
  }
  assert.deepEqual(core.dailyBounties(''), plain(script.dailyBounties('')));
});

test('parity: whole POST requests get the same envelopes from doPost and the handler', async () => {
  const {handle, SCORING, dailyBounties} = await fn('core.mjs');
  const {createMemoryStore} = await helper('memory-store.mjs');
  const states = {
    empty: {config: null, crew: [], activityIds: []},
    seeded: {config: PARITY_SETTINGS, crew: PARITY_CREW, activityIds: ['a1']},
  };
  const requests = [
    '', 'not json', '{"a":', 'null', '[]', '5', '"x"', '{}',
    {action: '__smoke__'}, {action: 1}, {action: 'saveConfig'}, {action: 'saveConfig', config: 'x'},
    ...PARITY_CONFIGS.filter(c => c && typeof c === 'object').map(config => ({action: 'saveConfig', config})),
    ...['Zed', ' zed ', 'alex', 'MAYA', '', '  ', null, undefined, 42, 'q'.repeat(30), 'q'.repeat(31)].map(name => ({action: 'addParticipant', name})),
    ...['a1', ' a1 ', 'a2', '', '   ', null, undefined, 0].map(id => ({action: 'delete', id})),
    ...PARITY_ACTIVITIES({catalog: SCORING.bounties, offered: dailyBounties(DAY)}).filter(Boolean),
  ];
  // Ids and timestamps are generated; they are compared for shape, then masked.
  const mask = reply => {
    if (reply.ok && 'createdAt' in reply) {
      assert.match(reply.id, /\S/);
      assert.ok(!Number.isNaN(Date.parse(reply.createdAt)));
      return {...reply, id: '<id>', createdAt: '<createdAt>'};
    }
    return reply;
  };
  const seen = new Set();
  for (const [stateName, state] of Object.entries(states)) {
    for (const request of requests) {
      const bodyText = typeof request === 'string' ? request : JSON.stringify(request);
      const script = appsScriptBackend(state);
      const expected = mask(JSON.parse(script.doPost({postData: {contents: bodyText}})));
      const store = createMemoryStore({settings: state.config && {...state.config, timeZone: 'UTC'}, participants: state.crew, activities: state.activityIds.map(id => ({id, name: 'Alex', type: 'climb', category: 'climb', points: 3, date: DAY, createdAt: '2026-07-13T08:00:00.000Z', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''}))});
      const actual = mask(await handle({method: 'POST', bodyText}, store, clock('2026-07-13T12:00:00Z')));
      assert.deepEqual(actual, expected, `${stateName}: ${bodyText}`);
      seen.add(expected.ok ? 'ok' : expected.error.code);
    }
  }
  assert.deepEqual([...seen].sort(), ['duplicate_participant', 'invalid_activity', 'invalid_config', 'invalid_delete', 'invalid_json', 'invalid_participant', 'invalid_request', 'not_found', 'ok', 'outside_challenge_window', 'setup_required', 'unknown_action'], 'the request table reaches every write outcome');
});
