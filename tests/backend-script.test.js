// TRAP: this suite loads the FROZEN v13 redirector (legacy/apps-script-v13.js, ADR-0004) through
// apps-script-harness.js, not the shipped artifact: the build no longer embeds it. The script's
// scoring and version are literals now, so a change to src/scoring.json or src/schema.json never
// reaches it and these tests must not follow the contract. Its arrays and objects come from another
// vm realm, so copy them (Array.from, spread) before deepStrictEqual. Sheet I/O is replaced by
// hand-built fakes (movedBook) or by reassigning context globals such as participantRecords, and a
// helper the script reads the Sheet through directly will throw there. Only behavior the deployed
// redirector still exhibits is tested here. Retired with ADR-0004 (the redirector is already
// provisioned and frozen, so these paths can no longer run): the whole test 'v9 setup archives prior
// activity and benchmark sheets exactly once and rewrites to name-only participants', and the
// fresh-doc half of 'formatSheets runs once while provisioning, then every read and write skips it'
// (its already-stamped-doc half is kept below).
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const {loadScript} = require('./apps-script-harness.js');

test('frozen v13 Apps Script is syntactically valid and exposes only simple capabilities', () => {
  const context = loadScript();
  assert.equal(vm.runInContext('API_VERSION', context), 13, 'the frozen redirector serves version 13, whatever the contract version becomes');
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

test('an already-stamped doc never formats sheets or archives its live data when the redirector reads it', () => {
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
  let formats = 0;
  context.formatSheets = () => { formats += 1; };
  const live = {sheets: {}, getSheetByName(name) { return this.sheets[name] || null; }, insertSheet(name) { return this.sheets[name] = new Sheet(this, name); }, getSpreadsheetTimeZone: () => 'UTC'};
  live.sheets.Activities = new Sheet(live, 'Activities', [Array.from(vm.runInContext('ACTIVITY_HEADERS', context))]);
  live.sheets.Settings = new Sheet(live, 'Settings', [['key', 'value']]);
  live.sheets.Participants = new Sheet(live, 'Participants', [['name'], ['Alex']]);
  context.SpreadsheetApp.getActive = () => live;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: () => '9', setProperty: () => {}})};
  context.setup();
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
