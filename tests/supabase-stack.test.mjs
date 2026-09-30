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
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createHttpTransport, createRest, resetDatabase} from './supabase/local-stack.mjs';
import {scenarios} from './supabase/scenarios.mjs';

const schema = JSON.parse(readFileSync(new URL('../src/schema.json', import.meta.url), 'utf8'));
if (!process.env.ROAD_TO_SEND_STACK) throw new Error('ROAD_TO_SEND_STACK is not set: run this suite with `npm run test:supabase`.');
const stack = JSON.parse(process.env.ROAD_TO_SEND_STACK);

const send = createHttpTransport(stack.functionUrl);
const service = createRest({apiUrl: stack.apiUrl, key: stack.serviceKey});
const anon = createRest({apiUrl: stack.apiUrl, key: stack.anonKey});
const reset = () => resetDatabase(service);
const post = body => send({method: 'POST', bodyText: JSON.stringify(body)});
const v = schema.properties.version.const;
const CONFIG = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500};
const TABLES = ['settings', 'participants', 'activities'];

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
    assert.ok(!response.ok, `anon insert into ${table} must fail, got ${response.status}`);
    assert.deepEqual(await rows(table), [], `nothing reached ${table}`);
  }
  // Seed through the function, so there is something to hide.
  assert.equal((await post({action: 'saveConfig', config: {...CONFIG, crew: ['Alex']}})).ok, true);
  assert.equal((await post({name: 'Alex', type: 'climb', date: CONFIG.startDate})).ok, true);
  for (const table of TABLES) {
    assert.ok((await rows(table)).length > 0, `${table} holds a row for the service role`);
    const response = await anon.select(table);
    const body = await response.text();
    assert.ok(!response.ok || JSON.parse(body).length === 0, `anon read of ${table} must return no rows, got ${response.status}: ${body.slice(0, 200)}`);
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
