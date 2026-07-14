const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const values = new Map([
  ['roadToSendLogs', '[null,42,"bad"]'],
  ['roadToSendConfig', '{"crew":null,"goal":"bad"}'],
  ['brokenValue', '{broken json'],
]);
const elements = new Map();
const element = () => ({
  value: '', textContent: '', innerHTML: '', title: '', disabled: false,
  style: {}, dataset: {}, nextSibling: {textContent: ''},
  classList: {add() {}, remove() {}, toggle() {}},
  addEventListener() {}, setAttribute() {}, focus() {}, reset() {},
  querySelector() { return element(); }, closest() { return null; }
});
const context = {
  console, URL, URLSearchParams, Blob, Map, Set, Date, Math, JSON, Object, Array,
  String, Number, RegExp, Error, Promise,
  location: {href: 'https://example.test/', search: ''},
  localStorage: {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  },
  document: {
    hidden: false,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    addEventListener() {}, createElement() { return element(); }
  },
  navigator: {clipboard: {writeText: async () => {}}},
  requestAnimationFrame(callback) { callback(); },
  setInterval() {}, setTimeout() {}, confirm() { return true; }, fetch: async () => {},
};

const checks = `(async()=>{
assert.equal(logs.length, 0, 'corrupt local storage falls back safely');
assert.deepEqual(config.crew, [], 'wrong-shaped cached config falls back safely');
assert.equal(config.goal, 500, 'invalid cached goal falls back safely');
assert.equal(safeJson('brokenValue','fallback'),'fallback','malformed JSON falls back safely');
assert.equal(localDate(new Date(2026, 10, 15, 12)), '2026-11-15');
assert.equal(parseDateOnly('2026-02-30'), null);
assert.equal(weekKey('2026-11-16'), '2026-11-16');
assert.equal(weekKey('2026-11-15'), '2026-11-09');
assert.equal(BOUNTIES.length,24,'catalog contains 24 bounties');
const bountyWeek=['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22'].map(d=>dailyBounties(d));
assert.equal(new Set(bountyWeek.flatMap(day=>day.map(x=>x.id))).size,21,'no bounty repeats within a week');
assert.ok(bountyWeek.every(day=>day.length===3&&new Set(day.map(x=>x.category)).size===3),'each day has three categories');
assert.equal(dateInTimeZone(new Date('2026-03-08T07:30:00Z'),'America/Los_Angeles'),'2026-03-07','timezone date works across DST boundary');
const scored=[
{id:'c1',name:'Maya',type:'climb',points:3,date:'2026-11-16',createdAt:'1'},
{id:'p1',name:'Maya',type:'pull',points:2,date:'2026-11-16',createdAt:'2'},
{id:'r1',name:'Maya',type:'prehab',points:2,date:'2026-11-16',createdAt:'3'},
{id:'c2',name:'Maya',type:'climb',points:3,date:'2026-11-17',createdAt:'4'},
{id:'c3',name:'Maya',type:'climb',points:3,date:'2026-11-18',createdAt:'5'},
{id:'m1',name:'Maya',type:'mobility',points:1,date:'2026-11-19',createdAt:'6'},
...['2026-11-16','2026-11-17','2026-11-18'].map((date,i)=>{const b=dailyBounties(date)[0];return{id:'b'+i,name:'Maya',type:'bounty',points:2,date,createdAt:'9'+i,bountyId:b.id,bountyTitle:b.title}})
];
const scoredWeek=computeCredits(scored).weeks.get('maya|2026-11-16');
assert.equal(scoredWeek.credited,14);
assert.equal(scoredWeek.bonus,2);
assert.equal(scoredWeek.bounty,6);
assert.equal(scoredWeek.credited+scoredWeek.bonus+scoredWeek.bounty,22);
assert.deepEqual(parseRemoteConfig({tripDate:'2026-11-15',goal:750,crew:['Alex','alex',' Maya ']},{}).value,{tripDate:'2026-11-15',goal:750,crew:['Alex','Maya']});
assert.match(parseRemoteConfig({tripDate:'11/15/2026',goal:'1,000',crew:[]},{}).errors.tripDate,/YYYY-MM-DD/);
assert.match(parseRemoteConfig({tripDate:'11/15/2026',goal:'1,000',crew:[]},{}).errors.groupGoal,/whole number/);
assert.equal(parseRemoteConfig(null,[{field:'tripDate',cell:'Settings!B2',reason:'must be a real calendar date'}]).errors.tripDate,'must be a real calendar date');
assert.match(parseRemoteConfig({tripDate:'2026-11-15',goal:750,crew:['x'.repeat(31)]},{}).errors.crew,/30 characters/);
assert.equal(unpackRemote({version:4,activities:[null,{id:'ok'}],config:null}).activities.length,1,'malformed remote rows are ignored');
assert.throws(()=>unpackRemote({version:99,activities:[]}),/version/);
assert.equal(unpackRemote({version:3,activities:[],config:null}).version,3);
assert.equal(unpackRemote({version:4,features:['bounties'],activities:[],config:null,serverDate:'2026-11-16',timeZone:'America/Los_Angeles'}).features[0],'bounties');
const beforeConfig=JSON.stringify(config),beforeEndpoint=endpoint;
document.querySelector('#endpoint').value='https://script.google.com/macros/s/test/exec';
fetch=async()=>({ok:true,json:async()=>({version:3,activities:[],config:{tripDate:'2026-11-15',goal:750,crew:['Alex']}})});
await testConnection();
assert.equal(endpoint,beforeEndpoint,'Test Connection must not change the active endpoint');
assert.equal(JSON.stringify(config),beforeConfig,'Test Connection must not apply remote config');
assert.equal(localStorage.getItem('roadToSendEndpoint'),null,'Test Connection must not persist the candidate endpoint');

endpoint='https://script.google.com/macros/s/ordered/exec';
let resolveFirst,resolveSecond,calls=0;
const first=new Promise(resolve=>{resolveFirst=resolve}),second=new Promise(resolve=>{resolveSecond=resolve});
fetch=()=>++calls===1?first:second;
const oldRequest=loadRemote(),newRequest=loadRemote();
resolveSecond({ok:true,json:async()=>({version:3,activities:[{id:'new',name:'Alex',type:'climb',points:3,date:'2026-11-15'}],config:{tripDate:'2026-11-15',goal:750,crew:['Alex']}})});
await newRequest;
resolveFirst({ok:true,json:async()=>({version:3,activities:[{id:'old',name:'Alex',type:'climb',points:3,date:'2026-11-14'}],config:{tripDate:'2026-11-14',goal:500,crew:['Alex']}})});
await oldRequest;
assert.equal(logs[0].id,'new','an older request must not overwrite a newer response');
})()`;
context.assert = assert;
vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'})
  .then(()=>console.log('client state tests passed'))
  .catch(error=>{console.error(error);process.exitCode=1});
