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

test('protocol fixtures cover current, legacy, malformed, and partial responses', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), ['current', 'legacy', 'malformed', 'partial']);
});

test('current fixture follows the versioned settings and collection contract', () => {
  assert.equal(fixtures.current.version, schema.properties.version.const);
  assert.ok(Array.isArray(fixtures.current.features));
  assert.ok(Array.isArray(fixtures.current.activities));
  assert.ok(Array.isArray(fixtures.current.benchmarks));
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
