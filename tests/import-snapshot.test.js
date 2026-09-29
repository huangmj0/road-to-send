// TRAP: scripts/import-snapshot.mjs is ESM and this file is CommonJS, so load it with dynamic
// import() inside async tests. Fixtures are synthetic; never put a real snapshot here. No SQL
// engine runs: assertions are on the emitted text, so they pin statement shape and escaping.
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const script = path.join(__dirname, '..', 'scripts', 'import-snapshot.mjs');
const load = () => import(script);

const activity = (over = {}) => ({
  id: 'a1', name: 'Alex', type: 'climb', category: 'climb', points: 3, date: '2026-09-07',
  createdAt: '2026-09-07T16:00:00.000Z', hardestGrade: 'V4', bountyId: '', bountyTitle: '', note: '', ...over,
});
const snapshot = (over = {}) => ({
  version: 13,
  features: [],
  activities: [activity(), activity({id: 'a2', name: 'Maya', type: 'exercise', category: 'exercise', points: 1, hardestGrade: ''})],
  config: {startDate: '2026-09-07', tripDate: '2026-11-15', goal: 3000, crew: [{name: 'Alex'}, {name: 'Maya'}]},
  configErrors: [],
  serverDate: '2026-09-07',
  timeZone: 'America/Los_Angeles',
  ...over,
});

test('emits one transaction: settings upsert, roster in order, activities in order', async () => {
  const {snapshotToSql} = await load();
  const sql = snapshotToSql(snapshot());
  assert.ok(sql.startsWith('begin;') && sql.trimEnd().endsWith('commit;'));
  assert.equal(sql.match(/^begin;/gm).length, 1);
  assert.match(sql, /insert into settings \(id, start_date, trip_date, goal, time_zone\)\nvalues \(1, '2026-09-07', '2026-11-15', 3000, 'America\/Los_Angeles'\)\non conflict \(id\) do update/);
  const alex = sql.indexOf("values ('Alex', 0)"), maya = sql.indexOf("values ('Maya', 1)");
  assert.ok(alex > 0 && maya > alex);
  assert.equal(sql.match(/on conflict \(\(lower\(name\)\)\) do nothing;/g).length, 2);
  const a1 = sql.indexOf("values ('a1'"), a2 = sql.indexOf("values ('a2'");
  assert.ok(sql.indexOf('insert into activities') < a1 && a1 < a2);
  assert.equal(sql.match(/on conflict \(id\) do nothing;/g).length, 2);
  assert.ok(sql.includes("'2026-09-07T16:00:00.000Z'"), 'createdAt is kept verbatim');
});

test('output is deterministic', async () => {
  const {snapshotToSql} = await load();
  assert.equal(snapshotToSql(snapshot()), snapshotToSql(snapshot()));
});

test('escapes quotes, backslashes, unicode and newlines in strings', async () => {
  const {snapshotToSql} = await load();
  const note = "it's a \\ back\\slash\nline two 🧗 café'; drop table activities;--";
  const sql = snapshotToSql(snapshot({activities: [activity({note})]}));
  assert.ok(sql.includes(`'${note.replaceAll("'", "''")}'`));
  // the injection text stays inside the literal because its quote is doubled
  assert.ok(sql.includes("café''; drop table activities;--'"));
});

test('keeps activities that name people outside the roster, and imports v12 snapshots', async () => {
  const {snapshotToSql} = await load();
  const sql = snapshotToSql(snapshot({version: 12, activities: [activity({name: 'Former Member'})]}));
  assert.ok(sql.includes("'Former Member'"));
  assert.ok(!sql.includes("values ('Former Member', "), 'not added to the roster');
});

test('does not import movedTo', async () => {
  const {snapshotToSql} = await load();
  assert.ok(!snapshotToSql(snapshot({movedTo: 'https://example.invalid/fn'})).includes('example.invalid'));
});

test('missing optional activity fields become empty strings', async () => {
  const {snapshotToSql} = await load();
  const sql = snapshotToSql(snapshot({activities: [{id: 'z', name: 'Alex', type: 'mobility', points: 1, date: '2026-09-08', createdAt: 'x'}]}));
  assert.ok(sql.includes("'mobility', '', 1, '2026-09-08', 'x', '', '', '', '')"));
});

test('aborts on bad payloads and never returns partial SQL', async () => {
  const {snapshotToSql, ImportError} = await load();
  const crew = crew => ({startDate: '2026-09-07', tripDate: '2026-11-15', goal: 3000, crew});
  const bad = {
    'no activities': snapshot({activities: undefined}),
    'null config': snapshot({config: null}),
    'version 11': snapshot({version: 11}),
    'version 14': snapshot({version: 14}),
    'no time zone': snapshot({timeZone: undefined}),
    'bad goal': snapshot({config: {...crew([]), goal: 5}}),
    'bad date': snapshot({config: {...crew([]), startDate: '9/7'}}),
    'empty crew name': snapshot({config: crew([{name: ''}])}),
    'fractional points': snapshot({activities: [activity({points: 1.5})]}),
    'activity without id': snapshot({activities: [activity(), activity({id: ''})]}),
    'NUL in note': snapshot({activities: [activity({note: 'a\0b'})]}),
    'not an object': [],
  };
  for (const [label, payload] of Object.entries(bad)) {
    assert.throws(() => snapshotToSql(payload), ImportError, label);
  }
});

test('CLI reads stdin, writes SQL to stdout; bad input exits 1 with an empty stdout', () => {
  const ok = spawnSync(process.execPath, [script], {input: JSON.stringify(snapshot())});
  assert.equal(ok.status, 0);
  assert.match(ok.stdout.toString(), /^begin;/);
  const bad = spawnSync(process.execPath, [script], {input: JSON.stringify(snapshot({config: null}))});
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout.length, 0);
  assert.match(bad.stderr.toString(), /config: null/);
  const junk = spawnSync(process.execPath, [script], {input: 'not json'});
  assert.equal(junk.status, 1);
  assert.equal(junk.stdout.length, 0);
});
