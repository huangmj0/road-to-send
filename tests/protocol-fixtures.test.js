const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'remote-responses.json'), 'utf8'),
);
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'schema.json'), 'utf8'),
);
const scoring = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'scoring.json'), 'utf8'),
);

function loadClientProtocol() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8')
    .replace('__SCORING_CONFIG__', JSON.stringify(scoring))
    .replace('__API_VERSION__', String(schema.properties.version.const))
    .replace('const SCRIPT=__APPS_SCRIPT__;', 'const SCRIPT="";');
  const context = {
    URL,
    URLSearchParams,
    Map,
    Set,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    Error,
    Intl,
    location: {search: '', href: 'https://example.test/', hash: ''},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    setTimeout() {},
    clearTimeout() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, {filename: 'src/app.js'});
  return result => vm.runInContext('unpackRemote(input)', Object.assign(context, {input: result}));
}

const unpackRemote = loadClientProtocol();

test('protocol fixtures cover current, legacy, malformed, and partial responses', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['current', 'legacy', 'malformed', 'partial']);
});

test('current fixture is accepted and sanitized by the client protocol', () => {
  const remote = unpackRemote(fixtures.current);
  assert.equal(remote.version, schema.properties.version.const);
  assert.deepEqual(Array.from(remote.features), fixtures.current.features);
  assert.equal(remote.activities.length, 2);
  assert.deepEqual(
    JSON.parse(JSON.stringify(remote.activities)),
    [
      {name: 'Alex', type: 'climb', date: '2026-09-07', id: 'a1', createdAt: '2026-09-07T16:00:00.000Z', hardestGrade: 'V4'},
      {name: 'Maya', type: 'bounty', date: '2026-09-07', id: 'a2', createdAt: '2026-09-07T17:00:00.000Z', bountyId: 'century-club', bountyTitle: 'Century Club', category: 'exercise'},
    ],
    'the client keeps valid fields and derives bounty metadata from its catalog',
  );
  assert.deepEqual(JSON.parse(JSON.stringify(remote.config)), fixtures.current.config);
  assert.deepEqual(
    Object.keys(remote.config).sort(),
    schema.$defs.settings.required.slice().sort(),
  );
  assert.deepEqual(Object.keys(remote.configErrors), []);
  assert.equal(remote.serverDate, fixtures.current.serverDate);
  assert.equal(remote.timeZone, fixtures.current.timeZone);
});

test('legacy bare-array fixture is rejected as an incompatible protocol version', () => {
  assert.throws(() => unpackRemote(fixtures.legacy), error => error.message === 'version');
});

test('malformed fixture is accepted defensively with unsafe collections removed', () => {
  const remote = unpackRemote(fixtures.malformed);
  assert.deepEqual(Array.from(remote.features), [], 'non-array features are ignored');
  assert.deepEqual(Array.from(remote.activities), [], 'invalid activity rows are discarded');
  assert.equal(remote.config, null);
  assert.equal(remote.configErrors.startDate, 'must be a real calendar date');
});

test('partial fixture preserves server validation details without inventing config', () => {
  const remote = unpackRemote(fixtures.partial);
  assert.equal(remote.config, null);
  assert.deepEqual(Array.from(remote.activities), []);
  assert.equal(remote.configErrors.tripDate, 'must be a real calendar date');
  assert.equal(remote.serverDate, '');
  assert.equal(remote.timeZone, '');
});
