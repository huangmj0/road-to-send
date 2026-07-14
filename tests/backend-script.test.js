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

test('embedded v8 Apps Script is syntactically valid and exposes only simple capabilities', () => {
  const context = loadScript();
  assert.equal(vm.runInContext('API_VERSION', context), 8);
  assert.deepEqual(Array.from(vm.runInContext('FEATURES', context)), ['daily-cap-v1', 'participant-pull-mode', 'challenge-window', 'self-registration-v1']);
  assert.doesNotMatch(context.__source, /claimBounty|saveBenchmark|balancedBonus/);
});

test('pull-up scoring covers every threshold boundary', () => {
  const {pullPoints} = loadScript();
  const cases = [
    ['super-hard', 0, 0], ['super-hard', 19, 0], ['super-hard', 20, 3], ['super-hard', 29, 3], ['super-hard', 30, 4], ['super-hard', 39, 4], ['super-hard', 40, 5], ['super-hard', 80, 5],
    ['hard', 0, 0], ['hard', 9, 0], ['hard', 10, 3], ['hard', 14, 3], ['hard', 15, 4], ['hard', 19, 4], ['hard', 20, 5], ['hard', 80, 5],
  ];
  for (const [category, count, points] of cases) assert.equal(pullPoints(count, category), points, `${category} ${count}`);
  assert.equal(pullPoints(-1, 'super-hard'), 0);
  assert.equal(pullPoints(20.5, 'hard'), 0);
});

test('backend derives points and participant mode instead of trusting the request', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Alex', pullMode: 'super-hard'}, {name: 'Maya', pullMode: 'hard'}];
  const pull = context.validateActivity({name: 'alex', type: 'pull', pullUps: 30, pullMode: 'hard', points: 999, date: '2026-07-13'});
  assert.equal(pull.name, 'Alex');
  assert.equal(pull.pullMode, 'super-hard');
  assert.equal(pull.points, 4);
  const climb = context.validateActivity({name: 'Maya', type: 'climb', hardestGrade: 'V7', points: 0, date: '2026-07-13'});
  assert.equal(climb.points, 5);
  assert.equal(climb.hardestGrade, 'V7');
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'climb', hardestGrade: 'VB', date: '2026-07-13'}), error => error.code === 'invalid_activity');
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'pull', pullUps: -1, date: '2026-07-13'}), error => error.code === 'invalid_activity');
});

test('missing roster mode blocks pull-ups but not climbing', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Taylor', pullMode: null}];
  assert.equal(context.validateActivity({name: 'Taylor', type: 'climb', hardestGrade: 'V0', date: '2026-07-13'}).points, 5);
  assert.throws(() => context.validateActivity({name: 'Taylor', type: 'pull', pullUps: 20, date: '2026-07-13'}), error => error.details.some(x => x.field === 'pullMode'));
});

test('self-registration adds one opted-in participant and rejects duplicate names', () => {
  const context = loadScript();
  const current = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex', pullMode: 'hard'}]};
  context.readConfig = () => ({config: current, errors: []});
  context.writeConfig = config => config;
  const added = context.addParticipant('Maya', 'super-hard');
  assert.equal(added.participant.pullMode, 'super-hard');
  assert.deepEqual(Array.from(added.config.crew, person => ({...person})), [
    {name: 'Alex', pullMode: 'hard'},
    {name: 'Maya', pullMode: 'super-hard'},
  ]);
  assert.throws(() => context.addParticipant('alex', 'hard'), error => error.code === 'duplicate_participant');
});

test('daily credits follow creation order, cap at five, and recompute after deletion', () => {
  const context = loadScript();
  const entries = [
    {id: 'later', name: 'Alex', type: 'climb', hardestGrade: 'V5', date: '2026-07-13', createdAt: '2'},
    {id: 'first', name: 'Alex', type: 'pull', pullUps: 20, pullMode: 'super-hard', date: '2026-07-13', createdAt: '1'},
    {id: 'other', name: 'Maya', type: 'climb', hardestGrade: 'V4', date: '2026-07-13', createdAt: '1'},
  ];
  const credit = context.dailyCreditInfo(entries);
  assert.equal(credit.first.credit, 3);
  assert.equal(credit.later.credit, 2);
  assert.equal(credit.other.credit, 5);
  const afterDelete = context.dailyCreditInfo(entries.filter(x => x.id !== 'first'));
  assert.equal(afterDelete.later.credit, 5);
});

test('challenge window remains inclusive', () => {
  const context = loadScript();
  context.readConfig = () => ({config: {startDate: '2026-07-01', tripDate: '2026-07-31'}, errors: []});
  assert.equal(context.validateActivityWindow({date: '2026-07-01'}).date, '2026-07-01');
  assert.equal(context.validateActivityWindow({date: '2026-07-31'}).date, '2026-07-31');
  assert.throws(() => context.validateActivityWindow({date: '2026-08-01'}), error => error.code === 'outside_challenge_window');
});

test('v8 setup archives pre-v7 activity and benchmark sheets exactly once', () => {
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
  let schema = '6';
  context.SpreadsheetApp.getActive = () => book;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: () => schema, setProperty: (_, value) => { schema = value; }})};
  context.formatSheets = () => {};
  context.setup();
  context.setup();
  assert.equal(schema, '8');
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Activities Archive')).length, 1);
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Benchmarks Archive')).length, 1);
  assert.deepEqual(book.sheets.Activities.values[0], Array.from(vm.runInContext('ACTIVITY_HEADERS', context)));
  assert.deepEqual(book.sheets.Participants.values[0], ['name', 'pullMode']);
  assert.equal(book.sheets.Participants.values[1][0], 'Alex');
});
