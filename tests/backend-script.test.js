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
        ? [['key', 'value'], [' challenge_start ', '2027-02-30'], [' Trip Date ', '2027-02-29'], ['GROUP_goal', 'five hundred']]
        : [['name'], ['Maya']],
    }),
  });
  const result = context.readConfig();
  assert.equal(result.config, null);
  assert.deepEqual(
    Array.from(result.errors, item => item.field),
    ['challengeStart', 'tripDate', 'groupGoal'],
  );
  assert.equal(result.errors[0].cell, 'Settings!B2');
  assert.equal(result.errors[1].cell, 'Settings!B3');
  assert.equal(result.errors[2].cell, 'Settings!B4');
});

test('challenge window is inclusive and rejects pre-start and post-trip activity dates', () => {
  const context = loadScript();
  context.readConfig = () => ({config: {startDate:'2027-09-06',tripDate:'2027-11-14'}, errors: []});
  const entry = date => ({name:'Maya',type:'pull',points:2,date});
  assert.equal(context.validateActivityEligibility(entry('2027-09-06'), []).date, '2027-09-06');
  assert.equal(context.validateActivityEligibility(entry('2027-11-14'), []).date, '2027-11-14');
  assert.throws(() => context.validateActivityEligibility(entry('2027-09-05'), []), error => error.code === 'outside_challenge_window');
  assert.throws(() => context.validateActivityEligibility(entry('2027-11-15'), []), error => error.code === 'outside_challenge_window');
  assert.equal(context.weekKeyValue('2027-11-14'),'2027-11-08','Sunday stays in the preceding Monday week');
  assert.equal(context.weekKeyValue('2027-11-15'),'2027-11-15','Monday starts a new week');
});

test('activity validation derives points instead of trusting the request', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  const activity = context.validateActivity({
    name: 'maya',
    type: 'climb',
    points: 9999,
    durationBand: '120-179',
    tags: ['new-area', 'project-progress'],
    date: '2027-11-15',
    note: 'Good session',
  });
  assert.equal(activity.name, 'Maya');
  assert.equal(activity.points, 4);
  assert.deepEqual(Array.from(activity.tags), ['new-area', 'project-progress']);
  assert.throws(
    () => context.validateActivity({ name: 'Other', type: 'climb', date: '2027-11-15' }),
    error => error.code === 'invalid_activity' && error.details.some(item => item.field === 'name'),
  );
});

test('climbing duration boundaries and tags are validated', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  for (const [durationBand, points] of [['60-119', 3], ['120-179', 4], ['180-plus', 5]]) {
    assert.equal(context.validateActivity({name: 'Maya', type: 'climb', durationBand, date: '2027-11-15'}).points, points);
  }
  assert.throws(
    () => context.validateActivity({name: 'Maya', type: 'climb', date: '2027-11-15'}),
    error => error.details.some(item => item.field === 'durationBand'),
  );
  assert.throws(
    () => context.validateActivity({name: 'Maya', type: 'climb', durationBand: '60-119', tags: ['fake'], date: '2027-11-15'}),
    error => error.details.some(item => item.field === 'tags'),
  );
  assert.equal(context.validateActivity({name: 'Maya', type: 'prehab', points: 99, date: '2027-11-15'}).points, 1);
});

test('activity rows normalize Sheet Date cells without shifting their day', () => {
  const context = loadScript();
  const sheetDate = vm.runInContext('new Date(Date.UTC(2027, 10, 15))', context);
  const row = context.normalizeActivityRow(
    ['id-1', 'Maya', 'climb', 3, sheetDate, '', 'created', '60-119', '["new-style"]'],
    ['id', 'name', 'type', 'points', 'date', 'note', 'createdAt', 'durationBand', 'tags'],
  );
  assert.equal(row.date, '2027-11-15');
  assert.deepEqual(Array.from(row.tags), ['new-style']);
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
    assert.ok(Array.from(day, item => item.access).filter(access => access === 'solo').length >= 2);
    assert.ok(Array.from(day, item => item.points).every(points => [1, 2, 3].includes(points)));
  }
  assert.equal(new Set(selections.flatMap(day => Array.from(day, item => item.id))).size, 21);
});

test('bounty claims require evidence and a credited same-day climb', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  context.readConfig = () => ({config: null, errors: []});
  context.sheetToday = () => '2027-11-15';
  const bounty = context.dailyBounties('2027-11-15')[0];
  const climb = {id: 'climb-1', name: 'Maya', type: 'climb', points: 3, date: '2027-11-15', createdAt: '2027-11-15T10:00:00Z'};
  const claim = context.validateBountyClaim({name: 'maya', bountyId: bounty.id, note: 'Sent it clean.'}, [climb]);
  assert.equal(claim.name, 'Maya');
  assert.equal(claim.points, bounty.points);
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

test('bounty validation logs extra distinct claims while preventing duplicate bounty claims', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  context.readConfig = () => ({config: null, errors: []});
  context.sheetToday = () => '2027-11-18';
  const bounty = context.dailyBounties('2027-11-18')[0];
  const climbs = [
    {id: 'c1', name: 'Maya', type: 'climb', points: 3, date: '2027-11-18', createdAt: '1'},
  ];
  const prior = ['2027-11-15', '2027-11-16'].map((date, i) => ({
    id: `b${i}`, name: 'Maya', type: 'bounty', points: 2, date, createdAt: String(i), bountyId: 'historical', bountyTitle: 'Historical',
  }));
  const extraClaim = context.validateBountyClaim({name: 'Maya', bountyId: bounty.id, note: 'Done'}, climbs.concat(prior));
  assert.equal(extraClaim.bountyId, bounty.id, 'claims after the weekly point limit are still logged');
  const todayClaim = {id: 'today', name: 'Maya', type: 'bounty', points: 2, date: '2027-11-18', bountyId: bounty.id};
  assert.throws(
    () => context.validateBountyClaim({name: 'Maya', bountyId: bounty.id, note: 'Done'}, climbs.concat(todayClaim)),
    error => error.code === 'duplicate_bounty',
  );
});

test('a climb after the base cap cannot unlock a bounty', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  context.readConfig = () => ({config: null, errors: []});
  context.sheetToday = () => '2027-11-18';
  const bounty = context.dailyBounties('2027-11-18')[0];
  const entries = [
    {id: 'c1', name: 'Maya', type: 'climb', points: 5, date: '2027-11-15'},
    {id: 'c2', name: 'Maya', type: 'climb', points: 5, date: '2027-11-16'},
    {id: 'c3', name: 'Maya', type: 'climb', points: 5, date: '2027-11-17'},
    {id: 'p1', name: 'Maya', type: 'pull', points: 2, date: '2027-11-17'},
    {id: 'c4', name: 'Maya', type: 'climb', points: 3, date: '2027-11-18'},
  ];
  assert.equal(context.baseCreditInfo(entries).c4, 0);
  assert.throws(
    () => context.validateBountyClaim({name: 'Maya', bountyId: bounty.id, note: 'Done'}, entries),
    error => error.code === 'missing_climb',
  );
});

test('base credit allocation is date ordered, climb first, and capped at 16', () => {
  const context = loadScript();
  const entries = [
    {id: 'late', name: 'Maya', type: 'climb', points: 5, date: '2027-11-18', createdAt: '1'},
    {id: 'care', name: 'Maya', type: 'prehab', points: 1, date: '2027-11-15', createdAt: '0'},
    {id: 'early', name: 'Maya', type: 'climb', points: 5, date: '2027-11-15', createdAt: '9'},
    {id: 'middle', name: 'Maya', type: 'climb', points: 5, date: '2027-11-16', createdAt: '8'},
    {id: 'pull', name: 'Maya', type: 'pull', points: 2, date: '2027-11-17', createdAt: '7'},
  ];
  const credit = context.baseCreditInfo(entries);
  assert.equal(credit.early, 5, 'climb is allocated before care on the same date');
  assert.equal(credit.care, 1);
  assert.equal(credit.middle, 5);
  assert.equal(credit.pull, 2);
  assert.equal(credit.late, 3);
});

test('benchmark validation compares the same gym and grade scale', () => {
  const context = loadScript();
  context.participantNames = () => ['Maya'];
  context.sheetToday = () => '2027-11-15';
  const baseline = {name: 'Maya', phase: 'baseline', gym: 'Home Gym', gradeScale: 'V scale', grades: [4, 4, 3, 3, 2], createdAt: '1'};
  const result = context.validateBenchmark({name: 'Maya', phase: 'final', gym: 'home gym', gradeScale: 'v SCALE', grades: [5, 4, 4, 3, 3]}, [baseline]);
  assert.deepEqual(Array.from(result.grades), [5, 4, 4, 3, 3]);
  assert.throws(
    () => context.validateBenchmark({name: 'Maya', phase: 'final', gym: 'Other Gym', gradeScale: 'V scale', grades: [5, 4, 4, 3, 3]}, [baseline]),
    error => error.code === 'invalid_benchmark',
  );
});

test('version 6 advertises the challenge window and preserves v5 activity data', () => {
  const context = loadScript();
  assert.match(context.__source, /Activities Archive/);
  assert.match(context.__source, /FEATURES=\['scoring-v2','bounties','benchmarks','challenge-window'\]/);
  assert.match(context.__source, /schema!=='5'&&schema!=='6'/);
  assert.match(context.__source, /setProperty\('roadToSendSchema','6'\)/);
});
