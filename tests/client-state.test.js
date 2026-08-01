const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const appSource = fs.readFileSync(new URL('../src/app.js', `file://${__filename}`), 'utf8');
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

// Exercise the editable source directly: generated index.html is checked separately.
const sanitizerSource = appSource.match(/^function sanitizeActivities\(value\)\{.*\}$/m)[0];
const sanitizerContext = {
  GRADES: ['V0','V1','V2','V3'],
  parseDateOnly: value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null,
  bountyById: id => id === 'send-it' ? {id, title: 'Send It', category: 'climb'} : null,
};
vm.runInNewContext(sanitizerSource, sanitizerContext, {filename: 'src/app.js'});
const sanitized = sanitizerContext.sanitizeActivities([
  null,
  {name: null, type: 'climb', date: '2026-07-13'},
  {name: 'Alex', type: 'climb', date: 'not-a-date'},
  {name: 'Alex', type: 'bounty', bountyId: 'not-real', date: '2026-07-13'},
  {id: 42, name: ' Alex ', type: 'climb', hardestGrade: '<bad>', date: '2026-07-13', createdAt: 7},
  {name: 'Maya', type: 'bounty', bountyId: 'send-it', bountyTitle: '<spoofed>', category: 'mobility', date: '2026-07-14'},
]);
assert.deepEqual(JSON.parse(JSON.stringify(sanitized)), [
  {id: '42', name: 'Alex', type: 'climb', date: '2026-07-13', createdAt: '7'},
  {name: 'Maya', type: 'bounty', date: '2026-07-14', bountyId: 'send-it', bountyTitle: 'Send It', category: 'climb'},
], 'malformed rows are dropped and accepted fields are normalized from trusted scoring data');

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
  assert.equal(weekKey('2026-03-08'),'2026-03-02','Sunday remains in the week that began the prior Monday');
  assert.equal(weekKey('2026-03-09'),'2026-03-09','Monday starts a new scoring week');

  // Los Angeles calendar dates remain stable across both US daylight-saving transitions.
  assert.equal(dateInTimeZone(new Date('2026-03-08T07:59:00Z'),'America/Los_Angeles'),'2026-03-07','spring transition: UTC is still Saturday locally before midnight PST');
  assert.equal(dateInTimeZone(new Date('2026-03-08T08:00:00Z'),'America/Los_Angeles'),'2026-03-08','spring transition: local calendar advances at midnight PST');
  assert.equal(dateInTimeZone(new Date('2026-03-08T09:59:00Z'),'America/Los_Angeles'),'2026-03-08','spring transition: instant before the skipped hour stays Sunday');
  assert.equal(dateInTimeZone(new Date('2026-03-08T10:00:00Z'),'America/Los_Angeles'),'2026-03-08','spring transition: instant after the skipped hour stays Sunday');
  assert.equal(dateInTimeZone(new Date('2026-11-01T06:59:00Z'),'America/Los_Angeles'),'2026-10-31','fall transition: UTC is still Saturday locally before midnight PDT');
  assert.equal(dateInTimeZone(new Date('2026-11-01T07:00:00Z'),'America/Los_Angeles'),'2026-11-01','fall transition: local calendar advances at midnight PDT');
  assert.equal(dateInTimeZone(new Date('2026-11-01T08:59:00Z'),'America/Los_Angeles'),'2026-11-01','fall transition: instant before the repeated hour stays Sunday');
  assert.equal(dateInTimeZone(new Date('2026-11-01T09:00:00Z'),'America/Los_Angeles'),'2026-11-01','fall transition: instant after the repeated hour stays Sunday');

  const parsed=parseRemoteConfig({startDate:'2026-07-01',tripDate:'2026-07-31',goal:750,crew:[{name:'Alex'},'alex',{name:'Maya'}]},[]);
  assert.equal(parsed.value.crew.length,2,'crew names are canonicalized case-insensitively');
  assert.equal(parsed.value.crew.map(x=>x.name).join(','),'Alex,Maya');
  assert.equal(parsed.value.crew[0].pullMode,undefined,'participants are name-only');
  assert.throws(()=>unpackRemote({version:8,features:[],activities:[],config:null}),/version/,'v8 requires redeployment');
  assert.throws(()=>unpackRemote({version:9,features:[],activities:[],config:null}),/version/,'v9 requires redeployment');
  assert.equal(unpackRemote({version:10,features:['categories-v1'],activities:[null,{type:'exercise'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,0,'incomplete remote rows are rejected');

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
})()`;

vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});

// DOM-backed harness: a minimal document stub so init()/render() run and the
// Record tab's date/bounty behavior can be asserted alongside the You tab.
function makeElement() {
  const classes = new Set();
  const listeners = new Map();
  return {
    value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
    offsetParent: {}, isConnected: true,
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      contains: c => classes.has(c),
      toggle: (c, force) => {const on = force === undefined ? !classes.has(c) : Boolean(force); on ? classes.add(c) : classes.delete(c); return on},
    },
    setAttribute() {}, removeAttribute() {}, getAttribute() {return null},
    addEventListener(type, handler) {listeners.set(type, handler)}, removeEventListener(type) {listeners.delete(type)},
    focus() {documentStub.activeElement = this},
    fire(type, event) {const handler=listeners.get(type);if(handler)handler(event)},
    contains() {return false},
    querySelectorAll() {return []},
  };
}
const domElements = new Map();
const documentListeners = new Map();
const domValues = new Map();
const documentStub = {
  visibilityState: 'visible',
  activeElement: null,
  body: makeElement(),
  querySelector: selector => {if (!domElements.has(selector)) domElements.set(selector, makeElement()); return domElements.get(selector)},
  querySelectorAll: () => [],
  addEventListener: (type, handler) => documentListeners.set(type, handler),
  removeEventListener: () => {},
  createElement: () => makeElement(),
};
documentStub.activeElement=documentStub.body;
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
  populateBountySelect();
  assert.equal(label.textContent,'Bounties for '+fmtDay(shift(-10)),'label names the clamped bounty day');

  // Use the editable modal implementation without regenerating index.html.
  ${appSource.match(/^function focusableIn\(container\)\{.*\}$/m)[0]}
  ${appSource.match(/^function openModal\(id\)\{.*\}$/m)[0]}
  ${appSource.match(/^function closeModal\(id\)\{.*\}$/m)[0]}
  const modal=document.querySelector('#focusTestModal'),first=document.querySelector('#focusFirst'),last=document.querySelector('#focusLast'),invoker=document.querySelector('#focusInvoker');
  modal.querySelectorAll=()=>[first,last];
  modal.contains=element=>element===first||element===last;
  invoker.focus();
  openModal('focusTestModal');
  assert.equal(document.activeElement,first,'opening a modal moves focus to its first control');
  let prevented=false;
  last.focus();
  modal.fire('keydown',{key:'Tab',shiftKey:false,preventDefault(){prevented=true}});
  assert.equal(document.activeElement,first,'Tab wraps from the final control to the first');
  assert.equal(prevented,true,'focus wrapping prevents the browser default');
  closeModal('focusTestModal');
  assert.equal(document.activeElement,invoker,'closing restores the invoking control');

  document.body.focus();
  openModal('focusTestModal');
  assert.equal(document.activeElement,first,'startup-opened modal moves focus off BODY');
  closeModal('focusTestModal');
  assert.notEqual(document.activeElement,document.body,'startup close does not restore BODY as an artificial invoker');
})()`;

vm.runInNewContext(`${source}\n${domChecks}`, domContext, {filename: 'index.html'});
console.log('Client state and scoring tests passed.');
