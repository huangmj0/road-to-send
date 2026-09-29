// Backend conformance scenarios, written once and run against every target (in-process today;
// the real-Supabase stack in a later ticket). Each scenario receives a transport
// `send({method, bodyText}) -> parsed JSON` and assumes an EMPTY backend at the start, with
// relative expectations only: ids and timestamps are checked for shape, never for value.
// Scenarios that need seeded data or an injected clock are in-process only and live in
// tests/supabase-conformance.test.js.
import assert from 'node:assert/strict';
import {schemaProblems} from './schema-check.mjs';

export function assertConforms(schema, payload) {
  assert.deepEqual(schemaProblems(schema, payload), [], 'payload conforms to src/schema.json');
}

const get = send => send({method: 'GET', bodyText: ''});
const post = (send, body) => send({method: 'POST', bodyText: typeof body === 'string' ? body : JSON.stringify(body)});

export const scenarios = [
  {
    name: 'an empty backend serves no config and no activities',
    async run({send, schema}) {
      const board = await get(send);
      assertConforms(schema, board);
      assert.equal(board.version, schema.properties.version.const);
      assert.equal(board.config, null);
      assert.deepEqual(board.activities, []);
      assert.deepEqual(board.configErrors, []);
      assert.match(board.serverDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(board.timeZone, 'UTC');
      assert.ok(!Number.isNaN(Date.parse(board.fetchedAt)));
    },
  },
  {
    name: 'reading twice changes nothing',
    async run({send}) {
      const first = await get(send), second = await get(send);
      assert.deepEqual({...second, fetchedAt: ''}, {...first, fetchedAt: ''});
    },
  },
  {
    name: 'an unsupported action gets the unknown_action envelope',
    async run({send, schema}) {
      const reply = await post(send, {action: '__smoke__'});
      assert.deepEqual(reply, {version: schema.properties.version.const, ok: false, error: {code: 'unknown_action', message: 'Unsupported action: __smoke__', details: []}});
    },
  },
  {
    name: 'a POST does not mutate the board',
    async run({send}) {
      await post(send, {action: '__smoke__'});
      const board = await get(send);
      assert.equal(board.config, null);
      assert.deepEqual(board.activities, []);
    },
  },
  {
    name: 'a method other than GET, POST and OPTIONS gets the invalid_request envelope',
    async run({send, schema}) {
      const reply = await send({method: 'PUT', bodyText: ''});
      assert.equal(reply.ok, false);
      assert.equal(reply.version, schema.properties.version.const);
      assert.equal(reply.error.code, 'invalid_request');
      assert.deepEqual(reply.error.details, []);
    },
  },
];
