// Backend conformance scenarios, written once and run against every target: in-process under
// `npm test` (tests/supabase-conformance.test.js) and over HTTP against a real local Supabase
// stack (tests/supabase-stack.test.mjs via `npm run test:supabase`, which empties the tables
// before each one). Each scenario receives a transport `send({method, bodyText}) -> parsed JSON`
// and assumes an EMPTY backend at the start, with relative expectations only: ids and timestamps
// are checked for shape, never for value. Scenarios that need seeded data or an injected clock are
// in-process only and live in tests/supabase-conformance.test.js.
import assert from 'node:assert/strict';
import {SCORING, dailyBounties} from '../../supabase/functions/road-to-send/core.mjs';
import {schemaProblems} from './schema-check.mjs';

export function assertConforms(schema, payload) {
  assert.deepEqual(schemaProblems(schema, payload), [], 'payload conforms to src/schema.json');
}

// Checks part of a payload against one of schema.json's $defs (settings, activity, participant).
function assertConformsTo(schema, def, value) {
  assert.deepEqual(schemaProblems({$defs: schema.$defs, ...schema.$defs[def]}, value), [], `payload conforms to $defs.${def}`);
}

const get = send => send({method: 'GET', bodyText: ''});
const post = (send, body) => send({method: 'POST', bodyText: typeof body === 'string' ? body : JSON.stringify(body)});

const START = '2026-07-01', TRIP = '2026-07-31';
const setup = (send, crew = ['Alex', 'Maya'], extra = {}) => post(send, {action: 'saveConfig', config: {startDate: START, tripDate: TRIP, goal: 500, crew, ...extra}});
const failure = (version, code, message, details = []) => ({version, ok: false, error: {code, message, details}});
const WIRE_ACTIVITY_KEYS = ['id', 'createdAt', 'name', 'type', 'category', 'points', 'date', 'hardestGrade', 'bountyId', 'bountyTitle', 'note'];

// A successful activity reply: the stored activity plus version, features and ok.
function assertActivityReply(schema, reply, expected) {
  assert.equal(reply.ok, true, JSON.stringify(reply.error));
  assert.equal(reply.version, schema.properties.version.const);
  assert.ok(Array.isArray(reply.features));
  const {version, features, ok, ...activity} = reply;
  assert.deepEqual(Object.keys(activity).sort(), [...WIRE_ACTIVITY_KEYS].sort());
  assertConformsTo(schema, 'activity', activity);
  assert.match(activity.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.ok(!Number.isNaN(Date.parse(activity.createdAt)) && activity.createdAt === new Date(activity.createdAt).toISOString());
  const {id, createdAt, ...rest} = activity;
  assert.deepEqual(rest, expected);
  return activity;
}

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
  {
    name: 'an empty backend rejects activity and participant writes',
    async run({send, schema}) {
      const v = schema.properties.version.const;
      assert.deepEqual(await post(send, {name: 'Alex', type: 'climb', date: START}), failure(v, 'invalid_activity', 'Choose a participant from the Participants tab', [{field: 'name', reason: 'must match a participant'}]));
      assert.deepEqual(await post(send, {action: 'addParticipant', name: 'Alex'}), failure(v, 'setup_required', 'Challenge setup must be completed before profiles can be created'));
      const board = await get(send);
      assert.equal(board.config, null);
      assert.deepEqual(board.activities, []);
    },
  },
  {
    name: 'malformed bodies get invalid_json and invalid_request, a truthy unknown action unknown_action',
    async run({send, schema}) {
      const v = schema.properties.version.const;
      for (const body of ['', 'not json', '{"action":', '{\'a\':1}']) assert.deepEqual(await post(send, body), failure(v, 'invalid_json', 'Request body must be valid JSON'), body);
      for (const body of ['null', '[]', '[{"action":"saveConfig"}]', '5', '"saveConfig"', 'true']) assert.deepEqual(await post(send, body), failure(v, 'invalid_request', 'Request body must be a JSON object'), body);
      assert.deepEqual(await post(send, {action: 'SAVECONFIG'}), failure(v, 'unknown_action', 'Unsupported action: SAVECONFIG'));
      assert.deepEqual(await post(send, {action: 7}), failure(v, 'unknown_action', 'Unsupported action: 7'));
    },
  },
  {
    name: 'saveConfig stores a normalized setup and GET serves it',
    async run({send, schema}) {
      const reply = await post(send, {action: 'saveConfig', config: {startDate: '7/1/2026', tripDate: 'July 31, 2026', goal: '1,000', crew: [' Alex ', {name: 'Maya'}, 'alex', '', null, 'Zed']}});
      const config = {startDate: START, tripDate: TRIP, goal: 1000, crew: [{name: 'Alex'}, {name: 'Maya'}, {name: 'Zed'}]};
      assert.deepEqual(reply, {version: schema.properties.version.const, features: reply.features, ok: true, config, configErrors: []});
      assertConformsTo(schema, 'settings', reply.config);
      const board = await get(send);
      assertConforms(schema, board);
      assert.deepEqual(board.config, config);
      assert.equal(board.timeZone, 'UTC');
      assert.deepEqual(board.features, reply.features);
    },
  },
  {
    name: 'saveConfig rejects invalid settings with invalid_config and writes nothing',
    async run({send, schema}) {
      const v = schema.properties.version.const;
      const save = config => post(send, {action: 'saveConfig', config});
      assert.deepEqual(await save({startDate: '2026-02-30', tripDate: '', goal: 49, crew: ['Alex']}), failure(v, 'invalid_config', 'Invalid challenge settings', [
        {field: 'challengeStart', cell: 'Settings', value: '2026-02-30', reason: 'must be a real calendar date'},
        {field: 'tripDate', cell: 'Settings', value: '', reason: 'is required'},
        {field: 'groupGoal', cell: 'Settings', value: '49', reason: 'must be from 50 to 10,000'},
      ]));
      assert.deepEqual(await save({startDate: TRIP, tripDate: START, goal: 500, crew: ['Alex']}), failure(v, 'invalid_config', 'Invalid challenge settings', [{field: 'challengeStart', cell: 'Settings', value: TRIP, reason: 'must be on or before the challenge end'}]));
      assert.deepEqual(await save({startDate: START, tripDate: TRIP, goal: 500, crew: ['', '  ']}), failure(v, 'invalid_config', 'Add at least one participant', [{field: 'crew', reason: 'is required'}]));
      assert.deepEqual(await save({startDate: START, tripDate: TRIP, goal: 500, crew: ['x'.repeat(31)]}), failure(v, 'invalid_config', 'Participant names must be 30 characters or fewer', [{field: 'crew', reason: 'name is too long'}]));
      assert.equal((await post(send, {action: 'saveConfig'})).error.code, 'invalid_config');
      assert.equal((await get(send)).config, null);
    },
  },
  {
    name: 'addParticipant appends to the roster and rejects blank, long and case-insensitive duplicate names',
    async run({send, schema}) {
      const v = schema.properties.version.const;
      await setup(send, ['Alex']);
      const added = await post(send, {action: 'addParticipant', name: '  Maya  '});
      const config = {startDate: START, tripDate: TRIP, goal: 500, crew: [{name: 'Alex'}, {name: 'Maya'}]};
      assert.deepEqual(added, {version: v, features: added.features, ok: true, participant: {name: 'Maya'}, config, configErrors: []});
      assert.deepEqual((await post(send, {action: 'addParticipant', name: 'Zed'})).config.crew, [{name: 'Alex'}, {name: 'Maya'}, {name: 'Zed'}]);
      const duplicate = failure(v, 'duplicate_participant', 'That name already exists', [{field: 'name', reason: 'must be unique'}]);
      assert.deepEqual(await post(send, {action: 'addParticipant', name: 'ALEX'}), duplicate);
      assert.deepEqual(await post(send, {action: 'addParticipant', name: ' maya'}), duplicate);
      assert.deepEqual(await post(send, {action: 'addParticipant', name: '   '}), failure(v, 'invalid_participant', 'Enter a name', [{field: 'name', reason: 'is required'}]));
      assert.deepEqual(await post(send, {action: 'addParticipant'}), failure(v, 'invalid_participant', 'Enter a name', [{field: 'name', reason: 'is required'}]));
      assert.deepEqual(await post(send, {action: 'addParticipant', name: 'y'.repeat(31)}), failure(v, 'invalid_config', 'Participant names must be 30 characters or fewer', [{field: 'crew', reason: 'name is too long'}]));
      const board = await get(send);
      assertConforms(schema, board);
      assert.deepEqual(board.config.crew, [{name: 'Alex'}, {name: 'Maya'}, {name: 'Zed'}], 'crew is served in position order');
    },
  },
  {
    name: 'an activity is appended with server-derived category and points and served in order',
    async run({send, schema}) {
      await setup(send);
      const date = '2026-07-13', [bounty] = dailyBounties(date);
      const climb = assertActivityReply(schema, await post(send, {name: 'alex', type: 'climb', date, hardestGrade: 'V5', note: '  sent it  ', points: 99, category: 'mobility', id: 'mine', createdAt: 'then'}),
        {name: 'Alex', type: 'climb', category: 'climb', points: 3, date, hardestGrade: 'V5', bountyId: '', bountyTitle: '', note: 'sent it'});
      assert.notEqual(climb.id, 'mine');
      const exercise = assertActivityReply(schema, await post(send, {name: 'Maya', type: 'exercise', date: '07/14/2026', hardestGrade: 'V5', bountyId: bounty.id}),
        {name: 'Maya', type: 'exercise', category: 'exercise', points: 2, date: '2026-07-14', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''});
      const mobility = assertActivityReply(schema, await post(send, {name: 'Maya', type: 'mobility', date: 'Jul 15 2026'}),
        {name: 'Maya', type: 'mobility', category: 'mobility', points: 1, date: '2026-07-15', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''});
      const claim = assertActivityReply(schema, await post(send, {name: 'Alex', type: 'bounty', date, bountyId: bounty.id, points: 0}),
        {name: 'Alex', type: 'bounty', category: bounty.category, points: bounty.points, date, hardestGrade: '', bountyId: bounty.id, bountyTitle: bounty.title, note: ''});
      const board = await get(send);
      assertConforms(schema, board);
      assert.deepEqual(board.activities.map(x => x.id), [climb.id, exercise.id, mobility.id, claim.id]);
      assert.deepEqual(board.activities, [climb, exercise, mobility, claim]);
      assert.equal(new Set(board.activities.map(x => x.id)).size, 4);
    },
  },
  {
    name: 'invalid activities are rejected with invalid_activity details and nothing is stored',
    async run({send, schema}) {
      const v = schema.properties.version.const;
      await setup(send);
      const invalid = details => failure(v, 'invalid_activity', 'Invalid activity', details);
      const date = '2026-07-13', offered = dailyBounties(date).map(b => b.id);
      assert.deepEqual(await post(send, {name: 'Nobody', type: 'climb', date}), failure(v, 'invalid_activity', 'Choose a participant from the Participants tab', [{field: 'name', reason: 'must match a participant'}]));
      assert.deepEqual(await post(send, {name: 'Alex', type: 'run', date: '2026-13-01'}), invalid([{field: 'type', reason: 'must be climb, exercise, mobility, or bounty'}, {field: 'date', reason: 'must be a real calendar date'}]));
      assert.deepEqual(await post(send, {name: 'Alex', type: 'climb', date, hardestGrade: 'VB', note: 'n'.repeat(121)}), invalid([{field: 'hardestGrade', reason: 'must be V0 through V17'}, {field: 'note', reason: 'must be 120 characters or fewer'}]));
      assert.deepEqual(await post(send, {name: 'Alex', type: 'bounty', date, bountyId: 'no-such-bounty'}), invalid([{field: 'bountyId', reason: 'must be one of today’s bounties'}]));
      const offDay = SCORING.bounties.find(b => !offered.includes(b.id));
      assert.deepEqual(await post(send, {name: 'Alex', type: 'bounty', date, bountyId: offDay.id}), invalid([{field: 'bountyId', reason: 'is not available on that date'}]));
      assert.deepEqual(await post(send, {name: 'Alex', type: 'exercise'}), invalid([{field: 'date', reason: 'is required'}]));
      assert.deepEqual((await get(send)).activities, []);
    },
  },
  {
    name: 'the challenge window accepts its start and end days and rejects the days just outside',
    async run({send, schema}) {
      const v = schema.properties.version.const;
      await setup(send);
      const outside = failure(v, 'outside_challenge_window', `Activity date must be from ${START} through ${TRIP} (inclusive)`, [{field: 'date', reason: 'is outside the challenge window'}]);
      assert.equal((await post(send, {name: 'Alex', type: 'mobility', date: START})).ok, true);
      assert.equal((await post(send, {name: 'Alex', type: 'mobility', date: TRIP})).ok, true);
      assert.deepEqual(await post(send, {name: 'Alex', type: 'mobility', date: '2026-06-30'}), outside);
      assert.deepEqual(await post(send, {name: 'Alex', type: 'mobility', date: '2026-08-01'}), outside);
      assert.deepEqual((await get(send)).activities.map(x => x.date), [START, TRIP]);
    },
  },
  {
    name: 'delete removes an activity once, then answers not_found',
    async run({send, schema}) {
      const v = schema.properties.version.const;
      await setup(send);
      const kept = await post(send, {name: 'Alex', type: 'climb', date: START});
      const gone = await post(send, {name: 'Maya', type: 'exercise', date: START});
      assert.deepEqual(await post(send, {action: 'delete', id: `  ${gone.id} `}), {version: v, ok: true, deleted: gone.id});
      assert.deepEqual(await post(send, {action: 'delete', id: gone.id}), {version: v, ok: false, error: {code: 'not_found', message: 'Activity not found'}});
      assert.deepEqual(await post(send, {action: 'delete', id: 'never-existed'}), {version: v, ok: false, error: {code: 'not_found', message: 'Activity not found'}});
      for (const id of [undefined, null, '', '   ']) assert.deepEqual(await post(send, {action: 'delete', id}), failure(v, 'invalid_delete', 'An activity id is required', [{field: 'id', reason: 'is required'}]));
      assert.deepEqual((await get(send)).activities.map(x => x.id), [kept.id]);
    },
  },
  {
    name: 'removing a participant via saveConfig keeps their activities',
    async run({send, schema}) {
      await setup(send, ['Alex', 'Maya']);
      const logged = await post(send, {name: 'Maya', type: 'climb', date: START});
      const reply = await setup(send, ['Alex'], {goal: 600});
      assert.deepEqual(reply.config.crew, [{name: 'Alex'}]);
      const board = await get(send);
      assertConforms(schema, board);
      assert.deepEqual(board.config, {startDate: START, tripDate: TRIP, goal: 600, crew: [{name: 'Alex'}]});
      assert.deepEqual(board.activities.map(x => [x.id, x.name]), [[logged.id, 'Maya']]);
      assert.equal((await post(send, {name: 'Maya', type: 'climb', date: START})).error.code, 'invalid_activity', 'a removed participant can no longer log');
    },
  },
];
