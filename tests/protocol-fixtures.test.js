// TRAP: current follows the schema version; moved and v12 pin frozen compatibility versions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'remote-responses.json'), 'utf8'),
);
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'schema.json'), 'utf8'),
);

test('protocol fixtures cover current, legacy, malformed, partial, moved, and v12 responses', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['current', 'legacy', 'malformed', 'moved', 'partial', 'v12']);
});

test('current fixture follows the versioned settings and collection contract', () => {
  assert.equal(fixtures.current.version, schema.properties.version.const);
  assert.ok(Array.isArray(fixtures.current.features));
  assert.ok(Array.isArray(fixtures.current.activities));
  assert.deepEqual(
    Object.keys(fixtures.current.config).sort(),
    schema.$defs.settings.required.slice().sort(),
  );
  assert.match(fixtures.current.config.startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(fixtures.current.config.tripDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('compatibility fixtures retain intentionally unsafe response shapes', () => {
  assert.ok(Array.isArray(fixtures.legacy), 'legacy Apps Script returned a bare activity array');
  assert.equal(typeof fixtures.malformed.features, 'string');
  assert.ok(fixtures.malformed.activities.some(value => value === null));
  assert.equal(fixtures.partial.config, null);
  assert.ok(fixtures.partial.configErrors.length > 0);
});

test('the v13 moved fixture carries an https movedTo, and the v12 fixture predates it', () => {
  assert.equal(fixtures.moved.version, 13);
  assert.match(fixtures.moved.movedTo, new RegExp(schema.properties.movedTo.pattern));
  assert.equal(schema.properties.movedTo.type, 'string');
  assert.equal(schema.required.includes('movedTo'), false, 'movedTo stays optional');
  assert.equal(fixtures.v12.version, 12);
  assert.equal('movedTo' in fixtures.v12, false);
  assert.equal('movedTo' in fixtures.current, false);
  assert.match(schema.$id, /v14\.json$/);
});
