const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const values = new Map();
const context = {
  assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Intl,
  location: {search: '', href: 'https://example.test/'},
  localStorage: {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  },
  setTimeout() {}, clearTimeout() {},
};

const checks = `(()=>{
  assert.equal(activityPoints({type:'climb'}),3);
  assert.equal(activityPoints({type:'exercise'}),2);
  assert.equal(activityPoints({type:'mobility'}),1);
  assert.equal(activityPoints({type:'bounty',bountyId:'send-it'}),3);
  assert.equal(activityPoints({type:'bounty',bountyId:'not-real'}),0,'unknown bounty scores zero');

  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};

  // Each category scores once per day; a full mix earns the +2 balanced-day bonus.
  const day=[
    {id:'c1',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-13',createdAt:'1'},
    {id:'c2',name:'Alex',type:'climb',hardestGrade:'V6',date:'2026-07-13',createdAt:'2'},
    {id:'e1',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'3'},
    {id:'m1',name:'Alex',type:'mobility',date:'2026-07-13',createdAt:'4'},
  ];
  let scored=computeCredits(day);
  assert.equal(scored.info.get('c1').credit,3,'first climb scores');
  assert.equal(scored.info.get('c2').credit,0,'second same-category same-day earns nothing');
  assert.equal(scored.info.get('c2').reason,'already logged');
  assert.equal(scored.info.get('e1').credit,2);
  assert.equal(scored.info.get('m1').credit,1);
  assert.equal(scored.dayMeter.get('alex|2026-07-13'),8,'balanced day tops the daily meter at 8');
  assert.equal(scored.totals.get('alex'),8);
  assert.equal(scored.weeks.get('alex|2026-07-13'),8);

  // No balanced-day bonus without all three categories.
  scored=computeCredits(day.filter(x=>x.type!=='mobility'));
  assert.equal(scored.dayMeter.get('alex|2026-07-13'),5,'two categories = 3 + 2, no bonus');

  // Weekly bounty cap: first 6 points count; the rest are bragging rights only.
  const bounties=[
    {id:'b1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'b2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-14',createdAt:'1'},
    {id:'b3',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-15',createdAt:'1'},
  ];
  scored=computeCredits(bounties);
  assert.equal(scored.info.get('b1').credit,3);
  assert.equal(scored.info.get('b2').credit,3,'cap of 6 reached exactly');
  assert.equal(scored.info.get('b3').credit,0,'over-cap bounty earns nothing');
  assert.equal(scored.info.get('b3').reason,'weekly cap');
  assert.equal(scored.bountyWeekCount.get('alex|2026-07-13'),3,'every completion counts toward Bounty Hunter');
  assert.equal(scored.totals.get('alex'),6);

  assert.equal(computeCredits([{id:'before',name:'Alex',type:'climb',date:'2026-06-30'}]).info.get('before').reason,'outside challenge');

  // Rotating bounties are deterministic and offer one per category.
  const today=dailyBounties('2026-07-16');
  assert.equal(today.length,3);
  assert.equal(today.map(b=>b.category).join(','),'climb,exercise,mobility');
  assert.equal(dailyBounties('2026-07-16').map(b=>b.id).join(','),today.map(b=>b.id).join(','),'same date yields the same bounties');
  assert.notEqual(dailyBounties('2026-07-17').map(b=>b.id).join(','),today.map(b=>b.id).join(','),'a different day rotates the set');

  // dailyBounties is a pure function of the date string across a two-week span.
  const spanSets=[];
  for(let i=0;i<14;i++){
    const key=localDate(new Date(2026,6,1+i)),ids=dailyBounties(key).map(b=>b.id).join(',');
    assert.equal(dailyBounties(key).map(b=>b.id).join(','),ids,'repeated calls agree for '+key);
    assert.equal(dailyBounties(key).map(b=>b.category).join(','),'climb,exercise,mobility','exactly one bounty per category on '+key);
    spanSets.push(ids);
  }
  assert.ok(new Set(spanSets).size>=2,'at least two distinct daily sets appear over 14 days');

  assert.equal(weekKey('2026-07-13'),'2026-07-13');
  assert.equal(weekKey('2026-07-19'),'2026-07-13');
  assert.equal(dateInTimeZone(new Date('2026-03-08T07:30:00Z'),'America/Los_Angeles'),'2026-03-07');

  const parsed=parseRemoteConfig({startDate:'2026-07-01',tripDate:'2026-07-31',goal:750,crew:[{name:'Alex'},'alex',{name:'Maya'}]},[]);
  assert.equal(parsed.value.crew.length,2,'crew names are canonicalized case-insensitively');
  assert.equal(parsed.value.crew.map(x=>x.name).join(','),'Alex,Maya');
  assert.equal(parsed.value.crew[0].pullMode,undefined,'participants are name-only');
  assert.throws(()=>unpackRemote({version:8,features:[],activities:[],config:null}),/version/,'v8 requires redeployment');
  assert.throws(()=>unpackRemote({version:9,features:[],activities:[],config:null}),/version/,'v9 requires redeployment');
  assert.equal(unpackRemote({version:10,features:['categories-v1'],activities:[null,{type:'exercise'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,1);

  // Local upgrade: v8 config migrates (pull mode dropped); logs start fresh; identity persists.
  localStorage.setItem('roadToSendConfigV8',JSON.stringify({startDate:'2026-07-01',tripDate:'2026-07-31',goal:600,crew:[{name:'Alex',pullMode:'super-hard'}]}));
  localStorage.setItem('roadToSendMe','Alex');
  endpoint='';logs=[];config=defaultConfig();me='';recordingFor='';
  loadInitialState();
  assert.equal(config.goal,600,'v8 local config migrates to v9');
  assert.equal(config.crew[0].name,'Alex');
  assert.equal(config.crew[0].pullMode,undefined,'pull mode is stripped on migration');
  assert.equal(me,'Alex','remembered identity is restored');
  recordingFor='Maya';
  assert.equal(me,'Alex','temporary proxy target does not replace device owner');

  // Pace toward the group goal: expected points scale linearly across the window.
  const paceSettings={startDate:'2026-07-01',tripDate:'2026-07-10',goal:100};
  assert.deepEqual(paceInfo(50,paceSettings,'2026-07-05'),{state:'on',diff:0,perDay:9},'exactly expected is on pace');
  assert.deepEqual(paceInfo(52,paceSettings,'2026-07-05'),{state:'on',diff:2,perDay:8},'a small lead still reads as on pace');
  assert.equal(paceInfo(53,paceSettings,'2026-07-05').state,'ahead');
  assert.equal(paceInfo(53,paceSettings,'2026-07-05').diff,3);
  assert.deepEqual(paceInfo(40,paceSettings,'2026-07-05'),{state:'behind',diff:-10,perDay:10},'behind reports the catch-up rate');
  assert.deepEqual(paceInfo(100,paceSettings,'2026-07-05'),{state:'met'},'reaching the goal wins regardless of date');
  assert.deepEqual(paceInfo(0,paceSettings,'2026-06-30'),{state:'before'},'before the window there is no pace yet');
  assert.deepEqual(paceInfo(80,paceSettings,'2026-07-11'),{state:'ended',short:20},'after the window the shortfall is reported');
  assert.equal(paceInfo(10,{tripDate:'2026-07-10',goal:100},'2026-07-05'),null,'missing start date hides the indicator');
  assert.equal(paceInfo(10,{startDate:'2026-07-01',tripDate:'2026-07-10',goal:0},'2026-07-05'),null,'a zero goal hides the indicator');
  assert.equal(paceInfo(10,{startDate:'2026-07-10',tripDate:'2026-07-01',goal:100},'2026-07-05'),null,'an inverted window hides the indicator');
  assert.equal(paceInfo(10,paceSettings,'garbage'),null,'an unparseable today hides the indicator');

  // challengeToday only trusts serverDate while the sync that produced it is from the current local day.
  endpoint='https://sheet.example.test/exec';challengeTimeZone='Not/AZone';serverDate='2000-01-01';
  lastSyncedAt=Date.now();
  assert.equal(challengeToday(),'2000-01-01','a same-day sync may fall back to serverDate');
  lastSyncedAt=Date.now()-2*86400000;
  assert.equal(challengeToday(),localDate(),'a stale serverDate is ignored');
  lastSyncedAt=0;
  assert.equal(challengeToday(),localDate(),'never synced falls back to the local date');
  challengeTimeZone='America/Los_Angeles';
  assert.equal(challengeToday(),dateInTimeZone(new Date(),'America/Los_Angeles'),'a valid challenge timezone always wins');
  endpoint='';challengeTimeZone='';serverDate='';lastSyncedAt=0;
})()`;

vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});

// DOM-backed harness: a minimal document stub so init()/render() run and the
// Record tab's date/bounty behavior can be asserted alongside the You tab.
function makeElement() {
  const classes = new Set();
  return {
    value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      contains: c => classes.has(c),
      toggle: (c, force) => {const on = force === undefined ? !classes.has(c) : Boolean(force); on ? classes.add(c) : classes.delete(c); return on},
    },
    setAttribute() {}, removeAttribute() {}, getAttribute() {return null},
    addEventListener() {}, removeEventListener() {}, focus() {},
    querySelectorAll() {return []},
  };
}
const domElements = new Map();
const documentListeners = new Map();
const domValues = new Map();
const documentStub = {
  visibilityState: 'visible',
  activeElement: null,
  querySelector: selector => {if (!domElements.has(selector)) domElements.set(selector, makeElement()); return domElements.get(selector)},
  querySelectorAll: () => [],
  addEventListener: (type, handler) => documentListeners.set(type, handler),
  removeEventListener: () => {},
  createElement: () => makeElement(),
};
const domContext = {
  assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Intl,
  location: {search: '', href: 'https://example.test/', hash: ''},
  history: {replaceState() {}},
  window: {scrollTo() {}},
  document: documentStub,
  fireDocumentEvent: type => {const handler = documentListeners.get(type); if (handler) handler({})},
  localStorage: {
    getItem: key => domValues.has(key) ? domValues.get(key) : null,
    setItem: (key, value) => domValues.set(key, String(value)),
    removeItem: key => domValues.delete(key),
  },
  setTimeout() {}, clearTimeout() {},
};

const domChecks = `(()=>{
  const todayStart=parseDateOnly(challengeToday());
  const shift=n=>{const d=new Date(todayStart);d.setDate(d.getDate()+n);return localDate(d)};
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  const dateField=document.querySelector('#activityDate'),dateBox=document.querySelector('#dateFields'),label=document.querySelector('#bountySelectLabel');

  // Closed picker: render() re-syncs the record date to the current challenge day,
  // so the Record dropdown and the You card draw the same bounty set after a rollover.
  dateBox.classList.add('hide');
  dateField.value=shift(-1);
  render();
  assert.equal(recordDate(),challengeToday(),'closed picker snaps the record date back to today');
  const paceEl=document.querySelector('#goalPace');
  assert.equal(paceEl.classList.contains('hide'),false,'pace indicator shows inside the challenge window');
  assert.ok(paceEl.textContent.startsWith('Behind pace'),'zero points partway through the window reads behind');
  assert.equal(dailyBounties(recordDate()).map(b=>b.id).join(','),dailyBounties(challengeToday()).map(b=>b.id).join(','),'Record dropdown and You card agree on the bounty set');
  populateBountySelect();
  assert.equal(label.textContent,"Today's bounties",'label reads as today when the bounty day is today');

  // Open picker: render() must not fight a manually chosen date, and the label is honest.
  dateBox.classList.remove('hide');
  dateField.value=shift(-1);
  render();
  assert.equal(recordDate(),shift(-1),'open picker keeps the manual date');
  populateBountySelect();
  assert.equal(label.textContent,'Bounties for Yesterday','label names the non-today bounty day');

  // Day rollover: becoming visible re-renders when the rendered day is stale.
  dateBox.classList.add('hide');
  assert.equal(renderedDay,challengeToday(),'render records the day it drew');
  renderedDay='2000-01-01';
  dateField.value=shift(-1);
  fireDocumentEvent('visibilitychange');
  assert.equal(renderedDay,challengeToday(),'visibilitychange re-renders after a day rollover');
  assert.equal(recordDate(),challengeToday(),'the record date follows the rollover');

  // Outside the challenge window the record date clamps and the label says so.
  config={startDate:shift(-20),tripDate:shift(-10),goal:500,crew:[{name:'Alex'}]};
  render();
  assert.equal(recordDate(),shift(-10),'record date clamps to the window end');
  assert.ok(paceEl.textContent.startsWith('Challenge complete'),'a finished window reports the outcome');
  populateBountySelect();
  assert.equal(label.textContent,'Bounties for '+fmtDay(shift(-10)),'label names the clamped bounty day');
})()`;

vm.runInNewContext(`${source}\n${domChecks}`, domContext, {filename: 'index.html'});

// Shared-mode harness with a stubbed fetch: a background sync (loadRemote) must
// never overwrite a date the user picked in the open "Different day" field.
test('background sync respects the open date picker and refreshes stale caches', async () => {
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  store.set('roadToSendEndpoint', 'https://sheet.example.test/exec');
  store.set('roadToSendMe', 'Alex');
  const dayShift = n => {const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`};
  const payload = {version: 10, features: [], activities: [], config: {startDate: dayShift(-5), tripDate: dayShift(5), goal: 500, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: '', timeZone: ''};
  let gets = 0;
  const syncContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    fireDocumentEvent: type => {const handler = listeners.get(type); if (handler) handler({})},
    countGets: () => gets,
    fetch: async (url, options = {}) => {if (!options.method) gets++; return {ok: true, json: async () => JSON.parse(JSON.stringify(payload))}},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const syncChecks = `(async()=>{
    await loadRemote();
    const dateBox=document.querySelector('#dateFields'),dateField=document.querySelector('#activityDate');

    // Closed picker: a sync still re-syncs the record date to today.
    dateBox.classList.add('hide');
    dateField.value='${dayShift(-1)}';
    await loadRemote();
    assert.equal(recordDate(),challengeToday(),'closed picker re-syncs to today after a sync');

    // Open picker with a manually chosen day: the sync must not touch it.
    dateBox.classList.remove('hide');
    dateField.value='${dayShift(-1)}';
    await loadRemote();
    assert.equal(recordDate(),'${dayShift(-1)}','a background sync leaves the chosen date alone');

    // Returning to the tab only refetches once the cache is older than five minutes.
    const before=countGets();
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before,'a fresh cache is not refetched on tab return');
    lastSyncedAt=Date.now()-6*60*1000;
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before+1,'a stale cache refreshes on tab return');
  })()`;
  await vm.runInNewContext(`${source}\n${syncChecks}`, syncContext, {filename: 'index.html'});
});

console.log('Client state and scoring tests passed.');
