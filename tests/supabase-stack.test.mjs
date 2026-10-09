// TRAP: this suite needs a running local Supabase stack (Docker) and is NOT part of `npm test`;
// run it with `npm run test:supabase`, which reads the stack from `supabase status -o env` and
// passes it in ROAD_TO_SEND_STACK. The stack is real and shared by every test here, so each test
// starts with resetDatabase() and tests run in order (node:test's default within a file); do not
// make them concurrent. Every row is deleted between tests, but the activities `seq` identity is
// not reset, which is why scenarios compare order and never seq values. The local gateway (Kong)
// runs a CORS plugin that answers a real browser preflight (Origin + Access-Control-Request-Method)
// itself and forces Access-Control-Allow-Origin on every reply, so the OPTIONS check sends a bare
// OPTIONS to reach the function. Assertions the in-process target already makes belong in
// tests/supabase/scenarios.mjs, not here: this file holds only what needs the real stack.
// The RLS probes accept exactly a permission denial (401/403 with PostgREST code 42501) or, for a
// read, a 200 with no rows; any other failure fails them. The stack is re-checked for loopback
// here, not only in the runner, because every test deletes every row. The import-tool check is
// the one test that writes around the function: it pipes scripts/import-snapshot.mjs's SQL into
// psql (postgresql-client; PSQL overrides the binary) as the local postgres superuser from
// DB_URL, which bypasses RLS the way the Supabase SQL editor does. It cannot live in
// scenarios.mjs because no in-process target runs SQL; tests/import-snapshot.test.js holds the
// SQL-free half of it against the same fixture (tests/supabase/snapshot-fixture.mjs). The live
// smoke check (scripts/smoke-check.mjs) runs here with the real fetch, as the organizer runs it;
// like the CORS test it sends a bare OPTIONS, so the function, not Kong, answers it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {snapshotToSql} from '../scripts/import-snapshot.mjs';
import {runSmokeCheck} from '../scripts/smoke-check.mjs';
import {FEATURES, dailyBounties} from '../supabase/functions/road-to-send/core.mjs';
import {assertLoopback, createHttpTransport, createRest, resetDatabase, runPsql} from './supabase/local-stack.mjs';
import {scenarios} from './supabase/scenarios.mjs';
import {snapshotFixture} from './supabase/snapshot-fixture.mjs';

const schema = JSON.parse(readFileSync(new URL('../src/schema.json', import.meta.url), 'utf8'));
if (!process.env.ROAD_TO_SEND_STACK) throw new Error('ROAD_TO_SEND_STACK is not set: run this suite with `npm run test:supabase`.');
const stack = JSON.parse(process.env.ROAD_TO_SEND_STACK);
assertLoopback(stack.apiUrl, stack.functionUrl, stack.dbUrl);

const send = createHttpTransport(stack.functionUrl);
const service = createRest({apiUrl: stack.apiUrl, key: stack.serviceKey});
const anon = createRest({apiUrl: stack.apiUrl, key: stack.anonKey});
const reset = () => resetDatabase(service);
const post = body => send({method: 'POST', bodyText: JSON.stringify(body)});
const v = schema.properties.version.const;
const CONFIG = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500};
const TABLES = ['settings', 'participants', 'activities'];

// A permission denial as PostgREST reports one to the anon role: 401 (or 403) and, when there is
// a body, SQLSTATE 42501 (insufficient_privilege, which also covers an RLS-denied insert).
function assertDenied(status, body, what) {
  assert.ok(status === 401 || status === 403, `${what} must be denied with 401 or 403, got ${status}: ${body.slice(0, 200)}`);
  if (body.trim()) assert.equal(JSON.parse(body).code, '42501', `${what} is denied as a permission error: ${body.slice(0, 200)}`);
}

async function rows(table) {
  const response = await service.select(table);
  assert.equal(response.status, 200, `service-role read of ${table}: ${await response.clone().text()}`);
  return response.json();
}

for (const scenario of scenarios) {
  test(`scenario over HTTP: ${scenario.name}`, async () => {
    await reset();
    await scenario.run({send, schema});
  });
}

test('every reply carries the CORS headers: GET, POST and OPTIONS', async () => {
  await reset();
  const replies = {
    GET: await fetch(stack.functionUrl),
    POST: await fetch(stack.functionUrl, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action: '__smoke__'})}),
    OPTIONS: await fetch(stack.functionUrl, {method: 'OPTIONS'}),
  };
  for (const [method, response] of Object.entries(replies)) {
    const body = await response.text();
    assert.equal(response.status, method === 'OPTIONS' ? 204 : 200, `${method}: ${body}`);
    assert.equal(response.headers.get('access-control-allow-origin'), '*', method);
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS', method);
    assert.equal(response.headers.get('access-control-allow-headers'), 'content-type', method);
    if (method === 'OPTIONS') assert.equal(body, '', 'OPTIONS has no body');
    else assert.match(response.headers.get('content-type'), /^application\/json\b/, method);
  }
});

test('a text/plain;charset=utf-8 POST is read as the JSON it carries', async () => {
  await reset();
  const response = await fetch(stack.functionUrl, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action: 'saveConfig', config: {...CONFIG, crew: ['Alex', 'Zoë']}})});
  const reply = await response.json();
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.deepEqual((await send({method: 'GET', bodyText: ''})).config, {...CONFIG, crew: [{name: 'Alex'}, {name: 'Zoë'}]});
});

test('GET ignores its query string, including the client cache-buster ?_=123', async () => {
  await reset();
  await post({action: 'saveConfig', config: {...CONFIG, crew: ['Alex']}});
  await post({name: 'Alex', type: 'climb', date: CONFIG.startDate});
  const plain = await send({method: 'GET', bodyText: ''});
  const busted = await createHttpTransport(`${stack.functionUrl}?_=123`)({method: 'GET', bodyText: ''});
  const withAction = await createHttpTransport(`${stack.functionUrl}?_=123&action=delete&id=${plain.activities[0].id}`)({method: 'GET', bodyText: ''});
  assert.equal(plain.activities.length, 1);
  for (const reply of [busted, withAction]) assert.deepEqual({...reply, fetchedAt: ''}, {...plain, fetchedAt: ''});
});

test('RLS: the anon key can neither insert into nor read any table through /rest/v1', async () => {
  await reset();
  const attempts = {
    settings: {id: 1, start_date: '2026-07-01', trip_date: '2026-07-31', goal: 500},
    participants: {name: 'Mallory', position: 0},
    activities: {id: 'anon-insert', name: 'Mallory', type: 'climb', category: 'climb', points: 3, date: '2026-07-01', created_at: '2026-07-01T00:00:00.000Z'},
  };
  for (const [table, row] of Object.entries(attempts)) {
    const response = await anon.insert(table, row);
    assertDenied(response.status, await response.text(), `anon insert into ${table}`);
    assert.deepEqual(await rows(table), [], `nothing reached ${table}`);
  }
  // Seed through the function, so there is something to hide.
  assert.equal((await post({action: 'saveConfig', config: {...CONFIG, crew: ['Alex']}})).ok, true);
  assert.equal((await post({name: 'Alex', type: 'climb', date: CONFIG.startDate})).ok, true);
  for (const table of TABLES) {
    assert.ok((await rows(table)).length > 0, `${table} holds a row for the service role`);
    const response = await anon.select(table);
    const body = await response.text();
    if (response.status === 200) assert.deepEqual(JSON.parse(body), [], `anon read of ${table} returns no rows`);
    else assertDenied(response.status, body, `anon read of ${table}`);
  }
});

test('two concurrent addParticipant requests differing only in case: exactly one wins', async () => {
  await reset();
  assert.equal((await post({action: 'saveConfig', config: {...CONFIG, crew: ['Alex']}})).ok, true);
  const duplicate = {version: v, ok: false, error: {code: 'duplicate_participant', message: 'That name already exists', details: [{field: 'name', reason: 'must be unique'}]}};
  const pairs = [['Maya', 'maya'], ['Zed', 'ZED'], ['Kai', 'kAI'], ['Noor', 'NOOR'], ['Ines', 'ines']];
  for (const [a, b] of pairs) {
    const replies = await Promise.all([post({action: 'addParticipant', name: a}), post({action: 'addParticipant', name: b})]);
    const wins = replies.filter(reply => reply.ok === true);
    assert.equal(wins.length, 1, `${a}/${b}: ${JSON.stringify(replies)}`);
    assert.deepEqual(replies.find(reply => reply.ok !== true), duplicate, `${a}/${b}`);
  }
  const crew = (await send({method: 'GET', bodyText: ''})).config.crew.map(p => p.name.toLowerCase());
  assert.deepEqual(crew, ['alex', ...pairs.map(([a]) => a.toLowerCase())]);
  assert.equal((await rows('participants')).length, pairs.length + 1, 'one row per name in the table itself');
});

test('import tool: a snapshot applied with psql is served back exactly, and re-running it changes nothing', async () => {
  await reset();
  const snapshot = snapshotFixture({version: v, features: FEATURES});
  const sql = snapshotToSql(snapshot);
  const counts = {settings: 1, participants: snapshot.config.crew.length, activities: snapshot.activities.length};
  for (const run of ['first', 'second']) {
    runPsql(stack.dbUrl, sql);
    const board = await send({method: 'GET', bodyText: ''});
    assert.match(board.serverDate, /^\d{4}-\d{2}-\d{2}$/, `${run} import: serverDate`);
    assert.deepEqual({...board, fetchedAt: '', serverDate: ''}, {...snapshot, fetchedAt: '', serverDate: ''}, `${run} import: GET reproduces the snapshot`);
    for (const [table, count] of Object.entries(counts)) {
      assert.equal((await rows(table)).length, count, `${run} import: ${table} row count`);
    }
  }
});

test('live smoke check: passes against the empty and the imported backend, and writes nothing', async () => {
  await reset();
  const snapshot = snapshotFixture({version: v, features: FEATURES});
  for (const stage of ['empty (cutover step 2)', 'imported (cutover step 5)']) {
    if (stage.startsWith('imported')) runPsql(stack.dbUrl, snapshotToSql(snapshot));
    // Row order from an unordered select is not guaranteed, so compare each table as a sorted set.
    const tables = () => Promise.all(TABLES.map(async table => (await rows(table)).map(row => JSON.stringify(row)).sort()));
    const before = await tables();
    const result = await runSmokeCheck(stack.functionUrl);
    assert.deepEqual(result.checks.map(check => [check.name, check.ok]), [['GET', true], ['OPTIONS', true], ['POST __smoke__', true]], `${stage}: ${JSON.stringify(result.checks)}`);
    assert.deepEqual(await tables(), before, `${stage}: the smoke check changed no table`);
  }
});


test('organizer imports preserve editable historical duplicate bounty claims and reject moving back onto a claim', async () => {
  await reset();
  const snapshot=snapshotFixture({version:v,features:FEATURES});
  const bounty=dailyBounties('2026-07-13')[0];
  const claim={id:'historical-claim',name:'Alex',type:'bounty',category:bounty.category,points:bounty.points,date:'2026-07-13',createdAt:'2026-07-13T01:00:00.000Z',hardestGrade:'',bountyId:bounty.id,bountyTitle:bounty.title,note:''};
  snapshot.activities.push(claim,{...claim,id:'historical-duplicate',name:claim.name.toUpperCase()});
  runPsql(stack.dbUrl,snapshotToSql(snapshot));
  const board=await send({method:'GET',bodyText:''});
  assert.deepEqual(board.activities,snapshot.activities);
  runPsql(stack.dbUrl,snapshotToSql(snapshot));
  assert.deepEqual((await send({method:'GET',bodyText:''})).activities,snapshot.activities);
  const changed=await post({action:'update',id:claim.id,note:'edit'});
  assert.equal(changed.ok,true);
  snapshot.activities[snapshot.activities.length-2]={...claim,note:'edit'};
  assert.deepEqual((await send({method:'GET',bodyText:''})).activities,snapshot.activities,'only the stored note changes');
  const other=dailyBounties(claim.date)[1];
  const moved=await post({action:'update',id:'historical-duplicate',bountyId:other.id});
  assert.equal(moved.ok,true);
  snapshot.activities[snapshot.activities.length-1]={...snapshot.activities.at(-1),bountyId:other.id,bountyTitle:other.title,category:other.category,points:other.points};
  assert.deepEqual((await send({method:'GET',bodyText:''})).activities,snapshot.activities);
  const conflict=await post({action:'update',id:'historical-duplicate',bountyId:claim.bountyId});
  assert.equal(conflict.error.code,'duplicate_bounty');
  assert.deepEqual((await send({method:'GET',bodyText:''})).activities,snapshot.activities);
});
