const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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

  assert.equal(weekKey('2026-07-13'),'2026-07-13');
  assert.equal(weekKey('2026-07-19'),'2026-07-13');
  assert.equal(dateInTimeZone(new Date('2026-03-08T07:30:00Z'),'America/Los_Angeles'),'2026-03-07');

  const parsed=parseRemoteConfig({startDate:'2026-07-01',tripDate:'2026-07-31',goal:750,crew:[{name:'Alex'},'alex',{name:'Maya'}]},[]);
  assert.equal(parsed.value.crew.length,2,'crew names are canonicalized case-insensitively');
  assert.equal(parsed.value.crew.map(x=>x.name).join(','),'Alex,Maya');
  assert.equal(parsed.value.crew[0].pullMode,undefined,'participants are name-only');
  assert.throws(()=>unpackRemote({version:8,features:[],activities:[],config:null}),/version/,'v8 requires redeployment');
  assert.equal(unpackRemote({version:9,features:['categories-v1'],activities:[null,{type:'exercise'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,1);

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
console.log('Client state and scoring tests passed.');
