// TRAP — temporary migration scaffold for #125: this custom VM uses the shared flat element
// stub, so it cannot validate DOM-tree behavior. Delete this file in #138:
// freezing rendered markup is useful only while proving relocation and bundling preserve the
// artifact, and would otherwise make legitimate UI changes costly.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const vm = require('node:vm');
const {test} = require('node:test');
const {source, makeElement} = require('./harness.js');

const EXPECTED = {scoring:{credits:[{id:'a1',base:3,credit:3,reason:''},{id:'a2',base:2,credit:2,reason:''},{id:'a3',base:1,credit:1,reason:''},{id:'a4',base:3,credit:3,reason:''},{id:'a5',base:3,credit:3,reason:''},{id:'a6',base:3,credit:0,reason:'weekly cap'},{id:'b1',base:3,credit:3,reason:''},{id:'b2',base:2,credit:2,reason:''},{id:'c1',base:1,credit:1,reason:''}],totals:[['alex',14],['blair',5],['casey',1]],weeks:[['alex|2026-07-13',14],['blair|2026-07-13',5],['casey|2026-07-13',1]],meters:[['alex|2026-07-13',8],['blair|2026-07-14',5],['casey|2026-07-15',1]],dayTotals:[['alex|2026-07-13',11],['blair|2026-07-14',5],['alex|2026-07-14',3],['casey|2026-07-15',1],['alex|2026-07-15',0]]},bountyRotation:[['2026-01-01',['send-it','recovery-respect','night-owl']],['2026-01-02',['dyno-mike','century-club','zen-sender']],['2026-01-03',['send-it','lockdown','splits-curious']],['2026-02-14',['down-climber','century-club','prehab-pro']],['2026-03-31',['no-excuses','weighted-wonder','shoulder-saver']],['2026-06-01',['comeback-kid','cross-trainer','rest-day-respect']],['2026-09-22',['dyno-mike','legs-exist','zen-sender']],['2026-12-31',['crux-focus','cardio-engine','bendy']]],weeks:[['2026-07-12','2026-07-06'],['2026-07-13','2026-07-13'],['2026-07-19','2026-07-13'],['2026-07-20','2026-07-20']],sharedDays:[['America/Los_Angeles','2026-07-14'],['Pacific/Auckland','2026-07-15']],pace:{before:{state:'before'},on:{state:'on',diff:0,perDay:2},ahead:{state:'ahead',diff:9,perDay:2},behind:{state:'behind',diff:-11,perDay:3},met:{state:'met'},ended:{state:'ended',short:40}},projection:{before:null,early:null,miss:{projected:62,goalDate:'2026-07-25'},hit:{projected:62,goalDate:'2026-07-25'},ended:null},rendered:{'#personalActivity':'6bb7f1433f44b7e78e4da997d23f17876d32890859722e7a133f2abf367f9097','#todayBounties':'37461058628f3b847589a65e98d666b6454ddc944125f53b20e7be51fcddef03','#todayCategories':'ebb087c349f37f11d2cd05800e272ef61508efe4cfe83aa4790178b7f6b3431a','#youTotal':'89b88ed60285dd121ce0a3a5df4ff520ff2dc6104f3f6f8483e57b898528e685','#youRank':'e9ef8546f91f7ebaa938d011280988b0e70842c30b3dc51f4218046a43911ea4','#todayRemaining':'40fabc96ecfba383ddeb6a8791c308f327c8908870dbe12d80ededcaf2d77b6d','#goalPace':'fd8e480916ca7d80b759d819b2992dd1d30e29f55d5ff83737224c3d9af15537','#goalProjection':'318c4d44df7cad15a3ddac442ec147bb8087dc2c4107b4fcd23627109ce15a2a','#leaderRows':'3d943051a02bafa1e3ddc7a9d8bb297c7c87fe56f19b23065f58e7cfee0f73f8','#activityList':'326b8ec08f88ff48d1cf466332d2bdd6890b163fef0688ab7f04c2ded0882a60'}};

function runFingerprint() {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-07-15T06:30:00Z'])); }
    static now() { return new Date('2026-07-15T06:30:00Z').getTime(); }
  }
  const elements = new Map();
  const values = new Map();
  const document = {
    activeElement: null,
    visibilityState: 'visible',
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    createElement: makeElement,
  };
  const context = {
    console, URL, URLSearchParams, Map, Set, Date: FixedDate, Math, JSON, Object, Array, String, Number, RegExp, Error, Intl,
    document, window: {scrollTo() {}}, history: {replaceState() {}}, location: {search: '', href: 'https://example.test/', hash: ''},
    localStorage: {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-02-14', '2026-03-31', '2026-06-01', '2026-09-22', '2026-12-31'];
  const settings = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 50, crew: [{name: 'Alex'}, {name: 'Blair'}, {name: 'Casey'}]};
  const logs = [
    {id: 'a1', name: 'Alex', type: 'climb', hardestGrade: 'V5', date: '2026-07-13', createdAt: '1'},
    {id: 'a2', name: 'Alex', type: 'exercise', date: '2026-07-13', createdAt: '2'},
    {id: 'a3', name: 'Alex', type: 'mobility', date: '2026-07-13', createdAt: '3'},
    {id: 'a4', name: 'Alex', type: 'bounty', bountyId: 'send-it', date: '2026-07-13', createdAt: '4'},
    {id: 'a5', name: 'Alex', type: 'bounty', bountyId: 'outdoor-send', date: '2026-07-14', createdAt: '5'},
    {id: 'a6', name: 'Alex', type: 'bounty', bountyId: 'century-club', date: '2026-07-15', createdAt: '6'},
    {id: 'b1', name: 'Blair', type: 'climb', hardestGrade: 'V3', date: '2026-07-14', createdAt: '1'},
    {id: 'b2', name: 'Blair', type: 'exercise', date: '2026-07-14', createdAt: '2'},
    {id: 'c1', name: 'Casey', type: 'mobility', date: '2026-07-15', createdAt: '1'},
  ];
  const credits = context.computeCredits(logs, settings);
  context.fingerprintSettings = settings;
  context.fingerprintLogs = logs;
  vm.runInContext("state.config=fingerprintSettings;state.logs=fingerprintLogs;state.me='Alex';state.recordingFor='Alex';fingerprintChallengeToday=challengeToday;challengeToday=()=> '2026-07-15';", context);
  context.render();
  vm.runInContext("challengeToday=fingerprintChallengeToday;state.endpoint='https://sheet.example.test/exec';state.challengeTimeZone='America/Los_Angeles';sharedPacificDay=challengeToday();state.challengeTimeZone='Pacific/Auckland';sharedAucklandDay=challengeToday();", context);
  const rendered = Object.fromEntries([...elements].filter(([selector]) => [
    '#youTotal', '#youRank', '#todayCategories', '#todayRemaining', '#todayBounties', '#leaderRows', '#activityList', '#goalPace', '#goalProjection', '#personalActivity',
  ].includes(selector)).map(([selector, el]) => [selector, createHash('sha256').update(JSON.stringify({text: el.textContent, html: el.innerHTML, aria: el.getAttribute('aria-label')})).digest('hex')]));
  return {
    scoring: {
      credits: logs.map((entry, index) => ({id: entry.id, ...credits.info.get(entry.id || index)})),
      totals: [...credits.totals], weeks: [...credits.weeks], meters: [...credits.dayMeter], dayTotals: [...credits.dayTotal],
    },
    bountyRotation: dates.map(date => [date, context.dailyBounties(date).map(bounty => bounty.id)]),
    weeks: ['2026-07-12', '2026-07-13', '2026-07-19', '2026-07-20'].map(date => [date, context.weekKey(date)]),
    sharedDays: [['America/Los_Angeles', context.sharedPacificDay], ['Pacific/Auckland', context.sharedAucklandDay]],
    pace: {
      before: context.paceInfo(0, settings, '2026-06-30'), on: context.paceInfo(21, settings, '2026-07-13'), ahead: context.paceInfo(30, settings, '2026-07-13'), behind: context.paceInfo(10, settings, '2026-07-13'), met: context.paceInfo(50, settings, '2026-07-13'), ended: context.paceInfo(10, settings, '2026-08-01'),
    },
    projection: {
      before: context.projectedTotal(6, settings, '2026-06-30'), early: context.projectedTotal(6, settings, '2026-07-02'), miss: context.projectedTotal(6, settings, '2026-07-03'), hit: context.projectedTotal(20, settings, '2026-07-10'), ended: context.projectedTotal(6, settings, '2026-08-01'),
    },
    rendered,
  };
}

test('temporary artifact behavior fingerprint remains unchanged', () => {
  const actual = JSON.parse(JSON.stringify(runFingerprint()));
  for (const section of Object.keys(EXPECTED).filter(section => section !== 'rendered')) {
    assert.deepEqual(actual[section], EXPECTED[section], 'Artifact behavior fingerprint changed in ' + section);
  }
  for (const selector of Object.keys(EXPECTED.rendered)) {
    assert.equal(actual.rendered[selector], EXPECTED.rendered[selector], 'Artifact render output changed at ' + selector);
  }
});
