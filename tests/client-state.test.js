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
  const boundaries=[
    ['men',19,0],['men',20,3],['men',29,3],['men',30,4],['men',39,4],['men',40,5],
    ['women',9,0],['women',10,3],['women',14,3],['women',15,4],['women',19,4],['women',20,5]
  ];
  boundaries.forEach(([category,count,points])=>assert.equal(pullPoints(count,category),points,category+' '+count));
  assert.equal(activityPoints({type:'climb',hardestGrade:'V0'}),5);
  assert.equal(activityPoints({type:'climb',hardestGrade:'VB'}),0);
  assert.equal(activityPoints({type:'pull',pullUps:5,pullCategory:'women'}),0,'below-threshold pull-ups remain valid zero-point activity');

  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  const entries=[
    {id:'climb',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-13',createdAt:'2'},
    {id:'pull',name:'Alex',type:'pull',pullUps:20,pullCategory:'men',date:'2026-07-13',createdAt:'1'},
    {id:'next',name:'Alex',type:'pull',pullUps:40,pullCategory:'men',date:'2026-07-14',createdAt:'1'},
    {id:'maya',name:'Maya',type:'climb',hardestGrade:'V3',date:'2026-07-13',createdAt:'1'},
  ];
  let scored=computeCredits(entries);
  assert.equal(scored.info.get('pull').credit,3);
  assert.equal(scored.info.get('climb').credit,2,'creation order determines remaining daily credit');
  assert.equal(scored.info.get('next').credit,5,'cap resets each person and date');
  assert.equal(scored.info.get('maya').credit,5,'cap is per person');
  scored=computeCredits(entries.filter(x=>x.id!=='pull'));
  assert.equal(scored.info.get('climb').credit,5,'deleting earlier activity frees later credit');
  assert.equal(computeCredits([{id:'before',name:'Alex',type:'climb',hardestGrade:'V1',date:'2026-06-30'}]).info.get('before').reason,'outside challenge');
  assert.equal(weekKey('2026-07-13'),'2026-07-13');
  assert.equal(weekKey('2026-07-19'),'2026-07-13');
  assert.equal(dateInTimeZone(new Date('2026-03-08T07:30:00Z'),'America/Los_Angeles'),'2026-03-07');

  const parsed=parseRemoteConfig({startDate:'2026-07-01',tripDate:'2026-07-31',goal:750,crew:[{name:'Alex',pullCategory:'men'},{name:'alex',pullCategory:'women'},{name:'Maya',pullCategory:null}]},[]);
  assert.equal(parsed.value.crew.length,2,'crew names are canonicalized case-insensitively');
  assert.equal(parsed.value.crew[1].pullCategory,null,'migration can surface a missing category');
  assert.throws(()=>unpackRemote({version:6,features:[],activities:[],config:null}),/version/,'v6 requires redeployment');
  assert.equal(unpackRemote({version:7,features:['daily-cap-v1'],activities:[null,{type:'climb',hardestGrade:'V1'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,1);

  localStorage.setItem('roadToSendLogs',JSON.stringify([{id:'v6'}]));
  localStorage.setItem('roadToSendMe','Alex');
  endpoint='';logs=[];config=defaultConfig();me='';recordingFor='';
  loadInitialState();
  assert.equal(localStorage.getItem('roadToSendLogsV6Archive'),JSON.stringify([{id:'v6'}]),'old local activity is archived once');
  assert.equal(logs.length,0,'v7 local leaderboard starts clean');
  assert.equal(me,'Alex','remembered identity is restored');
  recordingFor='Maya';
  assert.equal(me,'Alex','temporary proxy target does not replace device owner');
})()`;

vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
console.log('Client state and scoring tests passed.');
