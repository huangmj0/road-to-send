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
  assert.ok(sql.startsWith('begin;\nset local standard_conforming_strings = on;') && sql.trimEnd().endsWith('commit;'));
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

test('escapes quotes, backslashes, unicode and newlines in crew names and activity names', async () => {
  const {renderSnapshot} = await load();
  const names = ["O'Neil", 'back\\slash', 'Zoë 🧗', 'two\nlines', "''"];
  const snap = snapshot({
    config: {startDate: '2026-09-07', tripDate: '2026-11-15', goal: 3000, crew: names.map(name => ({name}))},
    activities: names.map((name, i) => activity({id: `n${i}`, name})),
    timeZone: "Pacific/Chatham",
  });
  const {sql} = renderSnapshot(snap);
  const parsed = parseSql(sql);
  assert.deepEqual(parsed.participants, names.map((name, position) => ({name, position})));
  assert.deepEqual(parsed.activities, snap.activities);
  assert.ok(sql.includes("values ('O''Neil', 0)") && sql.includes("values ('''''', 4)"));
});

test('output is deterministic', async () => {
  const {snapshotToSql} = await load();
  assert.equal(snapshotToSql(snapshot()), snapshotToSql(snapshot()));
});

test('escapes quotes, backslashes, unicode and newlines in strings', async () => {
  const {snapshotToSql} = await load();
  const note = "it's a \\ back\\slash\nline two 🧗 café'; drop table activities;--";
  const sql = snapshotToSql(snapshot({activities: [activity({note})]}));
  // an independent reader of the emitted literals recovers the exact note
  assert.equal(parseSql(sql).activities[0].note, note);
  assert.ok(sql.includes("café''; drop table activities;--'"));
});

// Independent SQL literal reader: walks 'quoted' strings ('' is an escaped quote) and bare numbers.
function readTuple(sql, from) {
  const out = [];
  let i = sql.indexOf('(', from) + 1;
  for (;;) {
    while (sql[i] === ' ') i++;
    if (sql[i] === "'") {
      let v = '';
      i++;
      for (;;) {
        if (sql[i] === "'" && sql[i + 1] === "'") { v += "'"; i += 2; }
        else if (sql[i] === "'") { i++; break; }
        else v += sql[i++];
      }
      out.push(v);
    } else {
      const m = /^-?[0-9.]+(?:e[+-]?[0-9]+)?/.exec(sql.slice(i));
      out.push(Number(m[0]));
      i += m[0].length;
    }
    while (sql[i] === ' ') i++;
    if (sql[i] === ',') { i++; continue; }
    assert.equal(sql[i], ')');
    return [out, i];
  }
}
function parseSql(sql) {
  const parsed = {settings: null, participants: [], activities: []};
  const keys = ['id', 'name', 'type', 'category', 'points', 'date', 'createdAt', 'hardestGrade', 'bountyId', 'bountyTitle', 'note'];
  const [s, end] = readTuple(sql, sql.indexOf('values', sql.indexOf('insert into settings')));
  parsed.settings = {startDate: s[1], tripDate: s[2], goal: s[3], timeZone: s[4]};
  let pos = end;
  for (;;) {
    const p = sql.indexOf('insert into participants', pos);
    if (p < 0) break;
    const [t, e] = readTuple(sql, sql.indexOf('values', p));
    parsed.participants.push({name: t[0], position: t[1]});
    pos = e;
  }
  for (;;) {
    const a = sql.indexOf('insert into activities', pos);
    if (a < 0) break;
    const [t, e] = readTuple(sql, sql.indexOf('values', a));
    parsed.activities.push(Object.fromEntries(keys.map((k, n) => [k, t[n]])));
    pos = e;
  }
  return parsed;
}

test('round trip: rendered rows and independently parsed SQL both reproduce the snapshot', async () => {
  const {renderSnapshot} = await load();
  const snap = snapshot({activities: [
    activity({note: "it's \\ tricky\nnewline 🧗"}),
    activity({id: 'a2', name: "O'Neil", note: ''}),
    activity({id: 'a3', points: 0}),
  ]});
  const {sql, rows} = renderSnapshot(snap);
  assert.deepEqual(rows.activities, snap.activities);
  assert.deepEqual(rows.settings, {startDate: snap.config.startDate, tripDate: snap.config.tripDate, goal: snap.config.goal, timeZone: snap.timeZone});
  assert.deepEqual(rows.participants, [{name: 'Alex', position: 0}, {name: 'Maya', position: 1}]);
  const parsed = parseSql(sql);
  assert.deepEqual(parsed.activities, snap.activities);
  assert.deepEqual(parsed.settings, rows.settings);
  assert.deepEqual(parsed.participants, rows.participants);
});

test('round trip on the shared synthetic snapshot the real-stack suite imports', async () => {
  const {renderSnapshot} = await load();
  const {snapshotFixture} = await import(path.join(__dirname, 'supabase', 'snapshot-fixture.mjs'));
  for (const version of [12, 13]) {
    const snap = snapshotFixture({version, features: ['categories-v1']});
    const {sql, rows} = renderSnapshot(snap);
    const parsed = parseSql(sql);
    assert.deepEqual(parsed.activities, snap.activities);
    assert.deepEqual(rows.activities, snap.activities);
    assert.deepEqual(parsed.settings, {startDate: snap.config.startDate, tripDate: snap.config.tripDate, goal: snap.config.goal, timeZone: snap.timeZone});
    assert.deepEqual(parsed.participants.map(p => ({name: p.name})), snap.config.crew);
    assert.deepEqual(parsed.participants.map(p => p.position), snap.config.crew.map((_, i) => i));
  }
});

test('raw Sheet cells: numbers and booleans are kept verbatim as text, null is empty', async () => {
  const {renderSnapshot} = await load();
  const snap = snapshot({activities: [
    activity({id: 42, note: 100, bountyId: true, hardestGrade: null, date: 20260907, category: undefined}),
  ]});
  const {sql, rows} = renderSnapshot(snap);
  const want = activity({id: '42', note: '100', bountyId: 'true', hardestGrade: '', date: '20260907', category: ''});
  assert.deepEqual(rows.activities, [want]);
  assert.deepEqual(parseSql(sql).activities, [want]);
});

test('fractional points are accepted and emitted for the int column to round', async () => {
  const {renderSnapshot} = await load();
  const {sql, rows} = renderSnapshot(snapshot({activities: [activity({points: 1.5}), activity({id: 'b', points: '2'})]}));
  assert.deepEqual(rows.activities.map(a => a.points), [1.5, 2]);
  assert.deepEqual(parseSql(sql).activities.map(a => a.points), [1.5, 2]);
});

test('crew name length counts code points like char_length', async () => {
  const {snapshotToSql} = await load();
  const crew = names => snapshot({config: {startDate: '2026-09-07', tripDate: '2026-11-15', goal: 3000, crew: names.map(name => ({name}))}});
  assert.doesNotThrow(() => snapshotToSql(crew(['🧗'.repeat(30)])), '30 emoji is 60 UTF-16 units but 30 characters');
  assert.throws(() => snapshotToSql(crew(['🧗'.repeat(31)])));
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
    'version as a string': snapshot({version: '13'}),
    'no version': snapshot({version: undefined}),
    'activities not an array': snapshot({activities: {a1: activity()}}),
    'start after trip': snapshot({config: {...crew([]), startDate: '2026-11-16'}}),
    'no time zone': snapshot({timeZone: undefined}),
    'bad goal': snapshot({config: {...crew([]), goal: 5}}),
    'bad date': snapshot({config: {...crew([]), startDate: '9/7'}}),
    'empty crew name': snapshot({config: crew([{name: ''}])}),
    'non-numeric points': snapshot({activities: [activity({points: 'lots'})]}),
    'points beyond int': snapshot({activities: [activity({points: 3e9})]}),
    'crew name over 30 code points': snapshot({config: crew([{name: 'x'.repeat(31)}])}),
    'object in a text field': snapshot({activities: [activity({note: {a: 1}})]}),
    'activity without id': snapshot({activities: [activity(), activity({id: ''})]}),
    'NUL in note': snapshot({activities: [activity({note: 'a\0b'})]}),
    'not an object': [],
  };
  for (const [label, payload] of Object.entries(bad)) {
    assert.throws(() => snapshotToSql(payload), ImportError, label);
  }
});

test('CLI reads stdin, writes SQL to stdout; every abort exits 1 with a message and an empty stdout', () => {
  const ok = spawnSync(process.execPath, [script], {input: JSON.stringify(snapshot())});
  assert.equal(ok.status, 0);
  assert.equal(ok.stderr.length, 0);
  assert.match(ok.stdout.toString(), /^begin;/);
  const aborts = {
    'not JSON': ['not json', /not valid JSON/],
    'empty input': ['', /not valid JSON/],
    'activities not an array': [JSON.stringify(snapshot({activities: 'none'})), /no activities array/],
    'null config': [JSON.stringify(snapshot({config: null})), /config: null/],
    'version 11': [JSON.stringify(snapshot({version: 11})), /Unsupported snapshot version 11/],
    'version 14': [JSON.stringify(snapshot({version: 14})), /Unsupported snapshot version 14/],
    'late bad activity': [JSON.stringify(snapshot({activities: [activity(), activity({id: 'b', points: 'lots'})]})), /activities\[1\]\.points/],
  };
  for (const [label, [input, message]] of Object.entries(aborts)) {
    const bad = spawnSync(process.execPath, [script], {input});
    assert.equal(bad.status, 1, label);
    assert.equal(bad.stdout.length, 0, `${label}: no SQL on stdout`);
    assert.match(bad.stderr.toString(), /^import-snapshot: /, label);
    assert.match(bad.stderr.toString(), message, label);
  }
});
