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
assert.deepEqual(parseRemoteConfig({tripDate:'2026-11-15',goal:750,crew:['Alex','alex',' Maya ']},{}).value,{tripDate:'2026-11-15',goal:750,crew:['Alex','Maya']});
assert.match(parseRemoteConfig({tripDate:'11/15/2026',goal:'1,000',crew:[]},{}).errors.tripDate,/YYYY-MM-DD/);
assert.match(parseRemoteConfig({tripDate:'11/15/2026',goal:'1,000',crew:[]},{}).errors.groupGoal,/whole number/);
assert.equal(parseRemoteConfig(null,[{field:'tripDate',cell:'Settings!B2',reason:'must be a real calendar date'}]).errors.tripDate,'must be a real calendar date');
assert.match(parseRemoteConfig({tripDate:'2026-11-15',goal:750,crew:['x'.repeat(31)]},{}).errors.crew,/30 characters/);
assert.equal(unpackRemote({version:4,activities:[null,{id:'ok'}],config:null}).activities.length,1,'malformed remote rows are ignored');
assert.throws(()=>unpackRemote({version:99,activities:[]}),/version/);
assert.equal(unpackRemote({version:3,activities:[],config:null}).version,3);
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
