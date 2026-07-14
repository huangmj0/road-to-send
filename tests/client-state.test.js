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
    ['super-hard',19,0],['super-hard',20,3],['super-hard',29,3],['super-hard',30,4],['super-hard',39,4],['super-hard',40,5],
    ['hard',9,0],['hard',10,3],['hard',14,3],['hard',15,4],['hard',19,4],['hard',20,5]
  ];
  boundaries.forEach(([category,count,points])=>assert.equal(pullPoints(count,category),points,category+' '+count));
  assert.equal(activityPoints({type:'climb',hardestGrade:'V0'}),5);
  assert.equal(activityPoints({type:'climb',hardestGrade:'VB'}),0);
  assert.equal(activityPoints({type:'pull',pullUps:5,pullMode:'hard'}),0,'below-threshold pull-ups remain valid zero-point activity');

  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  const entries=[
    {id:'climb',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-13',createdAt:'2'},
    {id:'pull',name:'Alex',type:'pull',pullUps:20,pullMode:'super-hard',date:'2026-07-13',createdAt:'1'},
    {id:'next',name:'Alex',type:'pull',pullUps:40,pullMode:'super-hard',date:'2026-07-14',createdAt:'1'},
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

  const parsed=parseRemoteConfig({startDate:'2026-07-01',tripDate:'2026-07-31',goal:750,crew:[{name:'Alex',pullMode:'super-hard'},{name:'alex',pullMode:'hard'},{name:'Maya',pullMode:null}]},[]);
  assert.equal(parsed.value.crew.length,2,'crew names are canonicalized case-insensitively');
  assert.equal(parsed.value.crew[1].pullMode,null,'migration can surface a missing mode');
  assert.throws(()=>unpackRemote({version:6,features:[],activities:[],config:null}),/version/,'v6 requires redeployment');
  assert.equal(unpackRemote({version:8,features:['daily-cap-v1'],activities:[null,{type:'climb',hardestGrade:'V1'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,1);

  localStorage.setItem('roadToSendLogsV7',JSON.stringify([{id:'v7',name:'Alex',type:'pull',pullUps:20,pullCategory:'men'}]));
  localStorage.setItem('roadToSendMe','Alex');
  endpoint='';logs=[];config=defaultConfig();me='';recordingFor='';
  loadInitialState();
  assert.equal(logs[0].pullMode,'super-hard','v7 local activity migrates to the new mode');
  assert.equal(me,'Alex','remembered identity is restored');
  recordingFor='Maya';
  assert.equal(me,'Alex','temporary proxy target does not replace device owner');
})()`;

vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
console.log('Client state and scoring tests passed.');
