// TRAP: the modules under test are ESM (.mjs) and this file is CommonJS, so everything is loaded
// with dynamic import() inside async tests, never a top-level require. The function reads
// `version` from the generated contract, so a stale contract.generated.json (run
// `npm run build`) fails here as a version mismatch, not as a logic bug. The vm harness for the
// Apps Script FEATURES come from tests/apps-script-harness.js, shared with backend-script.test.js. Scenarios in
// tests/supabase/scenarios.mjs must stay valid against an empty real backend: seeded-data and
// injected-clock cases belong in this file, not there.
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

test('the schema checker rejects payloads that break the contract', async () => {
  const {schemaProblems} = await helper('schema-check.mjs');
  const board = {version: schema.properties.version.const, features: [], activities: [], config: null};
  assert.deepEqual(schemaProblems(schema, board), []);
  assert.ok(schemaProblems(schema, {...board, version: 1}).length);
  assert.ok(schemaProblems(schema, {...board, serverDate: '13/07/2026'}).length);
  assert.ok(schemaProblems(schema, {...board, config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 5, crew: []}}).length);
  assert.ok(schemaProblems(schema, {version: schema.properties.version.const}).length);
});
