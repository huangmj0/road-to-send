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

test('embedded v7 Apps Script is syntactically valid and exposes only simple capabilities', () => {
  const context = loadScript();
  assert.equal(vm.runInContext('API_VERSION', context), 7);
  assert.deepEqual(Array.from(vm.runInContext('FEATURES', context)), ['daily-cap-v1', 'participant-pull-category', 'challenge-window']);
  assert.doesNotMatch(context.__source, /claimBounty|saveBenchmark|balancedBonus/);
});

test('pull-up scoring covers every threshold boundary', () => {
  const {pullPoints} = loadScript();
  const cases = [
    ['men', 0, 0], ['men', 19, 0], ['men', 20, 3], ['men', 29, 3], ['men', 30, 4], ['men', 39, 4], ['men', 40, 5], ['men', 80, 5],
    ['women', 0, 0], ['women', 9, 0], ['women', 10, 3], ['women', 14, 3], ['women', 15, 4], ['women', 19, 4], ['women', 20, 5], ['women', 80, 5],
  ];
  for (const [category, count, points] of cases) assert.equal(pullPoints(count, category), points, `${category} ${count}`);
  assert.equal(pullPoints(-1, 'men'), 0);
  assert.equal(pullPoints(20.5, 'women'), 0);
});

test('backend derives points and participant category instead of trusting the request', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Alex', pullCategory: 'men'}, {name: 'Maya', pullCategory: 'women'}];
  const pull = context.validateActivity({name: 'alex', type: 'pull', pullUps: 30, pullCategory: 'women', points: 999, date: '2026-07-13'});
  assert.equal(pull.name, 'Alex');
  assert.equal(pull.pullCategory, 'men');
  assert.equal(pull.points, 4);
  const climb = context.validateActivity({name: 'Maya', type: 'climb', hardestGrade: 'V7', points: 0, date: '2026-07-13'});
  assert.equal(climb.points, 5);
  assert.equal(climb.hardestGrade, 'V7');
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'climb', hardestGrade: 'VB', date: '2026-07-13'}), error => error.code === 'invalid_activity');
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'pull', pullUps: -1, date: '2026-07-13'}), error => error.code === 'invalid_activity');
});

test('missing roster category blocks pull-ups but not climbing', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Taylor', pullCategory: null}];
  assert.equal(context.validateActivity({name: 'Taylor', type: 'climb', hardestGrade: 'V0', date: '2026-07-13'}).points, 5);
  assert.throws(() => context.validateActivity({name: 'Taylor', type: 'pull', pullUps: 20, date: '2026-07-13'}), error => error.details.some(x => x.field === 'pullCategory'));
});

test('daily credits follow creation order, cap at five, and recompute after deletion', () => {
  const context = loadScript();
  const entries = [
    {id: 'later', name: 'Alex', type: 'climb', hardestGrade: 'V5', date: '2026-07-13', createdAt: '2'},
    {id: 'first', name: 'Alex', type: 'pull', pullUps: 20, pullCategory: 'men', date: '2026-07-13', createdAt: '1'},
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

test('v7 setup archives v6 activity and benchmark sheets exactly once', () => {
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
  assert.equal(schema, '7');
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Activities Archive')).length, 1);
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Benchmarks Archive')).length, 1);
  assert.deepEqual(book.sheets.Activities.values[0], Array.from(vm.runInContext('ACTIVITY_HEADERS', context)));
  assert.deepEqual(book.sheets.Participants.values[0], ['name', 'pullCategory']);
  assert.equal(book.sheets.Participants.values[1][0], 'Alex');
});
