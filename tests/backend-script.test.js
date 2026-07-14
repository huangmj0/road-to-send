const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadScript() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/const SCRIPT=(`[^`]*`);\nconst SUPPORTED_API_VERSIONS/);
  assert.ok(match, 'embedded Apps Script was found');
  const outer = {};
  vm.createContext(outer);
  vm.runInContext(`SCRIPT=${match[1]}`, outer);

  const context = {
    __source: outer.SCRIPT,
    Utilities: {
      getUuid() { return 'uuid-test'; },
      formatDate(date) {
        return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
      },
    },
    SpreadsheetApp: {
      getActive() {
        return { getSpreadsheetTimeZone: () => 'UTC' };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(outer.SCRIPT, context);
  return context;
}

test('embedded Apps Script is syntactically valid', () => {
  const context = loadScript();
  assert.equal(typeof context.doGet, 'function');
  assert.equal(typeof context.doPost, 'function');
  assert.doesNotMatch(context.__source, /\.clearContents\(/);
});

test('settings keys ignore case, whitespace, underscores, and hyphens', () => {
  const context = loadScript();
  assert.equal(context.normalizeKey(' Trip Date '), 'tripdate');
  assert.equal(context.normalizeKey('GROUP_goal'), 'groupgoal');
  assert.equal(context.normalizeKey('group-goal'), 'groupgoal');
});

test('dates are canonicalized and impossible dates are rejected', () => {
  const context = loadScript();
  assert.equal(context.parseDateValue('2027-2-9').value, '2027-02-09');
  assert.equal(context.parseDateValue('11/15/2027').value, '2027-11-15');
  assert.equal(context.parseDateValue('November 15, 2027').value, '2027-11-15');
  assert.equal(context.parseDateValue('15 Nov 2027').value, '2027-11-15');
  assert.match(context.parseDateValue('2027-02-29').error, /real calendar date/);
  assert.match(context.parseDateValue('15/11/2027').error, /real calendar date/);
});

test('goals must be finite in-range integers', () => {
  const context = loadScript();
  assert.equal(context.parseGoal('1,250').value, 1250);
  assert.match(context.parseGoal('not a number').error, /whole number/);
  assert.match(context.parseGoal('500.5').error, /whole number/);
  assert.match(context.parseGoal('49').error, /50 to 10,000/);
  assert.match(context.parseGoal('10001').error, /50 to 10,000/);
});

test('invalid settings return field errors without manufacturing a config', () => {
  const context = loadScript();
  context.tab = name => ({
    getDataRange: () => ({
      getValues: () => name === 'Settings'
        ? [['key', 'value'], [' Trip Date ', '2027-02-29'], ['GROUP_goal', 'five hundred']]
        : [['name'], ['Maya']],
    }),
  });
  const result = context.readConfig();
  assert.equal(result.config, null);
  assert.deepEqual(
    Array.from(result.errors, item => item.field),
    ['tripDate', 'groupGoal'],
  );
  assert.equal(result.errors[0].cell, 'Settings!B2');
  assert.equal(result.errors[1].cell, 'Settings!B3');
});

test('activity validation derives points instead of trusting the request', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  const activity = context.validateActivity({
    name: 'maya',
    type: 'climb',
    points: 9999,
    date: '2027-11-15',
    note: 'Good session',
  });
  assert.equal(activity.name, 'Maya');
  assert.equal(activity.points, 3);
  assert.throws(
    () => context.validateActivity({ name: 'Other', type: 'climb', date: '2027-11-15' }),
    error => error.code === 'invalid_activity' && error.details.some(item => item.field === 'name'),
  );
});

test('activity rows normalize Sheet Date cells without shifting their day', () => {
  const context = loadScript();
  const sheetDate = vm.runInContext('new Date(Date.UTC(2027, 10, 15))', context);
  const row = context.normalizeActivityRow(
    ['id-1', 'Maya', 'climb', 3, sheetDate, '', 'created'],
    ['id', 'name', 'type', 'points', 'date', 'note', 'createdAt'],
  );
  assert.equal(row.date, '2027-11-15');
});

test('daily bounty selection is deterministic, balanced, and unique within a week', () => {
  const context = loadScript();
  const dates = ['2027-11-15', '2027-11-16', '2027-11-17', '2027-11-18', '2027-11-19', '2027-11-20', '2027-11-21'];
  const selections = dates.map(date => Array.from(context.dailyBounties(date)));
  assert.deepEqual(
    Array.from(selections[0], item => item.id),
    Array.from(context.dailyBounties(dates[0]), item => item.id),
  );
  for (const day of selections) {
    assert.equal(day.length, 3);
    assert.equal(new Set(Array.from(day, item => item.category)).size, 3);
  }
  assert.equal(new Set(selections.flatMap(day => Array.from(day, item => item.id))).size, 21);
});

test('bounty claims require evidence and a credited same-day climb', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  context.sheetToday = () => '2027-11-15';
  const bounty = context.dailyBounties('2027-11-15')[0];
  const climb = {id: 'climb-1', name: 'Maya', type: 'climb', points: 3, date: '2027-11-15', createdAt: '2027-11-15T10:00:00Z'};
  const claim = context.validateBountyClaim({name: 'maya', bountyId: bounty.id, note: 'Sent it clean.'}, [climb]);
  assert.equal(claim.name, 'Maya');
  assert.equal(claim.points, 2);
  assert.equal(claim.bountyTitle, bounty.title);
  assert.throws(
    () => context.validateBountyClaim({name: 'Maya', bountyId: bounty.id, note: ''}, [climb]),
    error => error.code === 'invalid_bounty',
  );
  assert.throws(
    () => context.validateBountyClaim({name: 'Maya', bountyId: bounty.id, note: 'Done'}, []),
    error => error.code === 'missing_climb',
  );
});

test('bounty validation enforces daily and weekly claim limits', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  context.sheetToday = () => '2027-11-18';
  const bounty = context.dailyBounties('2027-11-18')[0];
  const climbs = [
    {id: 'c1', name: 'Maya', type: 'climb', points: 3, date: '2027-11-18', createdAt: '1'},
  ];
  const prior = ['2027-11-15', '2027-11-16', '2027-11-17'].map((date, i) => ({
    id: `b${i}`, name: 'Maya', type: 'bounty', points: 2, date, createdAt: String(i), bountyId: 'historical', bountyTitle: 'Historical',
  }));
  assert.throws(
    () => context.validateBountyClaim({name: 'Maya', bountyId: bounty.id, note: 'Done'}, climbs.concat(prior)),
    error => error.code === 'weekly_bounty_limit',
  );
  const todayClaim = {id: 'today', name: 'Maya', type: 'bounty', points: 2, date: '2027-11-18'};
  assert.throws(
    () => context.validateBountyClaim({name: 'Maya', bountyId: bounty.id, note: 'Done'}, climbs.concat(todayClaim)),
    error => error.code === 'daily_bounty_limit',
  );
});
