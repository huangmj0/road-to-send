const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadScript() {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
  const match = html.match(/const SCRIPT=(`[^`]*`);\nconst SUPPORTED_API_VERSIONS/);
  assert.ok(match, 'embedded Apps Script was found');
  const outer = {};
  vm.createContext(outer);
  vm.runInContext(`SCRIPT=${match[1]}`, outer);
  const context = {
    Utilities: {
      getUuid: () => 'uuid-test',
      formatDate: date => [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-'),
    },
    SpreadsheetApp: {getActive: () => ({getSpreadsheetTimeZone: () => 'UTC'})},
  };
  vm.createContext(context);
  vm.runInContext(outer.SCRIPT, context);
  context.__source = outer.SCRIPT;
  return context;
}

test('embedded v13 Apps Script is syntactically valid and exposes only simple capabilities', () => {
  const context = loadScript();
  assert.equal(vm.runInContext('API_VERSION', context), JSON.parse(fs.readFileSync(new URL('../src/schema.json', `file://${__filename}`), 'utf8')).properties.version.const);
  assert.deepEqual(Array.from(vm.runInContext('FEATURES', context)), ['categories-v1', 'balanced-day-bonus', 'daily-bounties-v3', 'bounty-hunter', 'challenge-window', 'self-registration-v1']);
  assert.doesNotMatch(context.__source, /pullPoints|pullMode|saveBenchmark|durationBand/);
});

test('backend derives category and bounty points instead of trusting the request', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Alex'}, {name: 'Maya'}];
  const climb = context.validateActivity({name: 'alex', type: 'climb', hardestGrade: 'V7', points: 999, date: '2026-07-13'});
  assert.equal(climb.name, 'Alex');
  assert.equal(climb.category, 'climb');
  assert.equal(climb.points, 3);
  assert.equal(climb.hardestGrade, 'V7');
  assert.equal(context.validateActivity({name: 'Maya', type: 'exercise', points: 0, date: '2026-07-13'}).points, 2);
  assert.equal(context.validateActivity({name: 'Maya', type: 'mobility', date: '2026-07-13'}).points, 1);
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'run', date: '2026-07-13'}), error => error.code === 'invalid_activity');
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'climb', hardestGrade: 'VB', date: '2026-07-13'}), error => error.code === 'invalid_activity');
});

test('a bounty claim must be one of that date rotating set', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Alex'}];
  const date = '2026-07-13';
  const offered = context.dailyBounties(date);
  assert.equal(offered.length, 3);
  const claim = context.validateActivity({name: 'Alex', type: 'bounty', bountyId: offered[0].id, points: 999, date});
  assert.equal(claim.type, 'bounty');
  assert.equal(claim.points, offered[0].points);
  assert.equal(claim.category, offered[0].category);
  assert.equal(claim.bountyTitle, offered[0].title);
  const catalog = vm.runInContext('SCORING.bounties', context);
  const sameCategoryOther = catalog.find(b => b.category === offered[0].category && b.id !== offered[0].id);
  assert.throws(() => context.validateActivity({name: 'Alex', type: 'bounty', bountyId: sameCategoryOther.id, date}), error => error.details.some(x => x.field === 'bountyId'));
  assert.throws(() => context.validateActivity({name: 'Alex', type: 'bounty', bountyId: 'not-a-bounty', date}), error => error.code === 'invalid_activity');
});

test('self-registration adds one name-only participant and rejects duplicate names', () => {
  const context = loadScript();
  const current = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]};
  context.readConfig = () => ({config: current, errors: []});
  context.writeConfig = config => config;
  const added = context.addParticipant('Maya');
  assert.equal(added.participant.name, 'Maya');
  assert.deepEqual(Array.from(added.config.crew, person => ({...person})), [{name: 'Alex'}, {name: 'Maya'}]);
  assert.throws(() => context.addParticipant('alex'), error => error.code === 'duplicate_participant');
});

test('challenge window remains inclusive', () => {
  const context = loadScript();
  context.readConfig = () => ({config: {startDate: '2026-07-01', tripDate: '2026-07-31'}, errors: []});
  assert.equal(context.validateActivityWindow({date: '2026-07-01'}).date, '2026-07-01');
  assert.equal(context.validateActivityWindow({date: '2026-07-31'}).date, '2026-07-31');
  assert.throws(() => context.validateActivityWindow({date: '2026-08-01'}), error => error.code === 'outside_challenge_window');
});

test('v9 setup archives prior activity and benchmark sheets exactly once and rewrites to name-only participants', () => {
  const context = loadScript();
  class Sheet {
    constructor(book, name, values = []) { this.book = book; this.name = name; this.values = values.map(row => [...row]); }
    getName() { return this.name; }
    setName(name) { delete this.book.sheets[this.name]; this.name = name; this.book.sheets[name] = this; }
    getLastRow() { return this.values.length; }
    getLastColumn() { return Math.max(0, ...this.values.map(row => row.length)); }
    appendRow(row) { this.values.push([...row]); }
    getRange(row, col, rows = 1, cols = 1) { return {
      getValues: () => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => this.values[row - 1 + r]?.[col - 1 + c] ?? '')),
      setValue: value => { this.values[row - 1] ||= []; this.values[row - 1][col - 1] = value; },
    }; }
  }
  const book = {sheets: {}, getSheetByName(name) { return this.sheets[name] || null; }, insertSheet(name) { return this.sheets[name] = new Sheet(this, name); }, getSpreadsheetTimeZone: () => 'UTC'};
  book.sheets.Activities = new Sheet(book, 'Activities', [['id'], ['old']]);
  book.sheets.Benchmarks = new Sheet(book, 'Benchmarks', [['id'], ['old-benchmark']]);
  book.sheets.Settings = new Sheet(book, 'Settings', [['key', 'value']]);
  book.sheets.Participants = new Sheet(book, 'Participants', [['name'], ['Alex']]);
  let schema = '8';
  context.SpreadsheetApp.getActive = () => book;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: () => schema, setProperty: (_, value) => { schema = value; }})};
  context.formatSheets = () => {};
  context.setup();
  context.setup();
  assert.equal(schema, '9');
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Activities Archive')).length, 1);
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Benchmarks Archive')).length, 1);
  assert.deepEqual(book.sheets.Activities.values[0], Array.from(vm.runInContext('ACTIVITY_HEADERS', context)));
  assert.deepEqual(book.sheets.Participants.values[0], ['name']);
  assert.equal(book.sheets.Participants.values[1][0], 'Alex');
});

test('formatSheets runs once while provisioning, then every read and write skips it', () => {
  const context = loadScript();
  class Sheet {
    constructor(book, name, values = []) { this.book = book; this.name = name; this.values = values.map(row => [...row]); }
    getName() { return this.name; }
    setName(name) { delete this.book.sheets[this.name]; this.name = name; this.book.sheets[name] = this; }
    getLastRow() { return this.values.length; }
    getLastColumn() { return Math.max(0, ...this.values.map(row => row.length)); }
    appendRow(row) { this.values.push([...row]); }
    getRange(row, col, rows = 1, cols = 1) { return {
      getValues: () => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => this.values[row - 1 + r]?.[col - 1 + c] ?? '')),
      setValue: value => { this.values[row - 1] ||= []; this.values[row - 1][col - 1] = value; },
    }; }
  }
  const makeBook = () => ({sheets: {}, getSheetByName(name) { return this.sheets[name] || null; }, insertSheet(name) { return this.sheets[name] = new Sheet(this, name); }, getSpreadsheetTimeZone: () => 'UTC'});
  let formats = 0;
  context.formatSheets = () => { formats += 1; };

  // A brand-new doc: the first setup() provisions and formats once; a second identical setup()
  // (schema now stamped) is the steady state every doGet/doPost hits and must not format again.
  const fresh = makeBook();
  const freshStore = {};
  context.SpreadsheetApp.getActive = () => fresh;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: key => key in freshStore ? freshStore[key] : null, setProperty: (key, value) => { freshStore[key] = value; }})};
  context.setup();
  assert.equal(formats, 1, 'the first setup() on an unprovisioned doc formats exactly once');
  context.setup();
  context.setup();
  assert.equal(formats, 1, 'once the schema is stamped, later setup() calls never re-run formatSheets');

  // An already-provisioned doc (the live Sheet after redeploy) never pays for formatSheets at all.
  formats = 0;
  const live = makeBook();
  live.sheets.Activities = new Sheet(live, 'Activities', [Array.from(vm.runInContext('ACTIVITY_HEADERS', context))]);
  live.sheets.Settings = new Sheet(live, 'Settings', [['key', 'value']]);
  live.sheets.Participants = new Sheet(live, 'Participants', [['name'], ['Alex']]);
  context.SpreadsheetApp.getActive = () => live;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: () => '9', setProperty: () => {}})};
  context.setup();
  assert.equal(formats, 0, 'a doc already stamped at the current schema formats zero times');
  assert.equal(Object.keys(live.sheets).filter(name => name.startsWith('Activities Archive')).length, 0, 'and its live data is never archived');
});

// Protocol v13: a Settings movedTo key turns the Sheet into a read-only redirector.
function movedBook(context, settingsRows) {
  class Sheet {
    constructor(name, values) { this.name = name; this.values = values.map(row => [...row]); this.writes = 0; }
    getLastRow() { return this.values.length; }
    getLastColumn() { return Math.max(0, ...this.values.map(row => row.length)); }
    appendRow(row) { this.writes++; this.values.push([...row]); }
    deleteRow(n) { this.writes++; this.values.splice(n - 1, 1); }
    clearContents() { this.writes++; this.values = []; }
    getDataRange() { return {getValues: () => this.values.map(row => [...row])}; }
    getRange(row, col, rows = 1, cols = 1) { return {
      getValues: () => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => this.values[row - 1 + r]?.[col - 1 + c] ?? '')),
      setValue: value => { this.writes++; this.values[row - 1] ||= []; this.values[row - 1][col - 1] = value; },
      setValues: grid => { this.writes++; grid.forEach((line, r) => line.forEach((value, c) => { this.values[row - 1 + r] ||= []; this.values[row - 1 + r][col - 1 + c] = value; })); },
      clearContent: () => { this.writes++; },
    }; }
  }
  const headers = Array.from(vm.runInContext('ACTIVITY_HEADERS', context));
  const book = {sheets: {}, getSheetByName(name) { return this.sheets[name] || null; }, insertSheet(name) { return this.sheets[name] = new Sheet(name, []); }, getSpreadsheetTimeZone: () => 'UTC'};
  book.sheets.Activities = new Sheet('Activities', [headers, ['a1', 'Alex', 'climb', 'climb', 3, '2026-07-13', '2026-07-13T10:00:00.000Z', 'V4', '', '', '']]);
  book.sheets.Settings = new Sheet('Settings', [['key', 'value'], ['challengeStart', '2026-07-01'], ['tripDate', '2026-07-31'], ['groupGoal', 500], ...settingsRows]);
  book.sheets.Participants = new Sheet('Participants', [['name'], ['Alex']]);
  context.SpreadsheetApp.getActive = () => book;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: () => '9', setProperty: () => {}})};
  context.LockService = {getDocumentLock: () => ({waitLock() {}, releaseLock() {}})};
  context.ContentService = {MimeType: {JSON: 'json'}, createTextOutput: text => ({getContent: () => text, setMimeType() { return this; }})};
  context.formatSheets = () => {};
  const snapshot = () => JSON.stringify(Object.values(book.sheets).map(sheet => [sheet.name, sheet.values]));
  const writes = () => Object.values(book.sheets).reduce((n, sheet) => n + sheet.writes, 0);
  return {book, snapshot, writes};
}
const parsed = output => JSON.parse(output.getContent());
const post = (context, body) => parsed(context.doPost({postData: {contents: JSON.stringify(body)}}));
const target = 'https://project.example.test/functions/v1/road-to-send';

test('a Settings movedTo is echoed on GET beside the full board, matching its header loosely', () => {
  for (const key of ['movedTo', ' Moved To ', 'MOVED_TO']) {
    const context = loadScript();
    movedBook(context, [[key, ' ' + target + ' ']]);
    const body = parsed(context.doGet());
    assert.equal(body.movedTo, target, 'the trimmed https URL is echoed for header ' + key);
    assert.equal(body.activities.length, 1, 'reads keep serving the full board');
    assert.equal(body.config.goal, 500);
    assert.deepEqual(body.configErrors, []);
  }
});

test('a non-https or garbage movedTo is ignored and adds no config error', () => {
  for (const value of ['http://project.example.test/x', 'not a url', 'https://', 'https:// spaced', 'ftp://x.test', '', 42]) {
    const context = loadScript();
    const sheets = movedBook(context, [['movedTo', value]]);
    const body = parsed(context.doGet());
    assert.equal('movedTo' in body, false, 'no movedTo for ' + JSON.stringify(value));
    assert.deepEqual(body.configErrors, []);
    assert.equal(post(context, {name: 'Alex', type: 'exercise', date: '2026-07-13'}).ok, true, 'writes still succeed for ' + JSON.stringify(value));
    assert.ok(sheets.writes() > 0);
  }
});

test('with movedTo set every POST kind is rejected as moved and no sheet changes', () => {
  const requests = [
    {name: 'Alex', type: 'exercise', date: '2026-07-13'},
    {action: 'delete', id: 'a1'},
    {action: 'saveConfig', config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 600, crew: [{name: 'Alex'}]}},
    {action: 'addParticipant', name: 'Maya'},
    {action: 'nonsense'},
    {name: 'Nobody', type: 'run'},
  ];
  for (const request of requests) {
    const context = loadScript();
    const sheets = movedBook(context, [['movedTo', target]]);
    const before = sheets.snapshot();
    let setups = 0, locks = 0;
    const realSetup = context.setup;
    context.setup = () => { setups++; return realSetup(); };
    context.LockService = {getDocumentLock: () => { locks++; return {waitLock() {}, releaseLock() {}}; }};
    const response = post(context, request);
    assert.equal(setups, 0, 'a moved Sheet never runs setup for ' + JSON.stringify(request));
    assert.equal(locks, 0, 'a moved Sheet never takes the lock for ' + JSON.stringify(request));
    assert.deepEqual(response, {version: vm.runInContext('API_VERSION', context), ok: false, error: {code: 'moved', message: 'The crew board has moved. Try again.', details: []}, movedTo: target}, JSON.stringify(request));
    assert.equal(sheets.snapshot(), before, 'nothing changed for ' + JSON.stringify(request));
    assert.equal(sheets.writes(), 0, 'nothing was written for ' + JSON.stringify(request));
  }
});
