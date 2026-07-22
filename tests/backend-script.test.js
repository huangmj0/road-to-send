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

test('embedded v11 Apps Script is syntactically valid and exposes only simple capabilities', () => {
  const context = loadScript();
  assert.equal(vm.runInContext('API_VERSION', context), 11);
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
