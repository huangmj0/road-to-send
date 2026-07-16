const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('shared workflow connects, saves a name-only roster, adds, syncs, and deletes activity', async () => {
  const values = new Map(), requests = [];
  const features = ['categories-v1', 'balanced-day-bonus', 'daily-bounties-v3', 'bounty-hunter', 'challenge-window', 'self-registration-v1'];
  const points = {climb: 3, exercise: 2, mobility: 1};
  const server = {
    config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Old Crew'}]},
    activities: [],
  };
  const remote = () => ({version: 10, features, activities: server.activities.map(x => ({...x})), config: {...server.config, crew: server.config.crew.map(x => ({...x}))}, configErrors: [], serverDate: '2026-07-13', timeZone: 'America/Los_Angeles'});
  const response = body => ({ok: true, json: async () => body});
  const fetch = async (url, options = {}) => {
    if (!options.method || options.method === 'GET') { requests.push({method: 'GET'}); return response(remote()); }
    const body = JSON.parse(options.body); requests.push({method: 'POST', body});
    if (body.action === 'saveConfig') { server.config = body.config; return response({version: 10, ok: true, config: server.config, configErrors: []}); }
    if (body.action === 'addParticipant') { const participant = {name: body.name}; server.config.crew.push(participant); return response({version: 10, ok: true, participant, config: server.config, configErrors: []}); }
    if (body.action === 'delete') { server.activities = server.activities.filter(x => x.id !== body.id); return response({version: 10, ok: true, deleted: body.id}); }
    const saved = {...body, id: 'activity-1', createdAt: '2026-07-13T12:00:00Z', category: body.type, points: points[body.type] || 0, hardestGrade: body.type === 'climb' ? body.hardestGrade : '', bountyId: '', bountyTitle: '', note: body.note || ''};
    server.activities.push(saved); return response({version: 10, ok: true, ...saved});
  };
  const context = {assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Promise, Intl, fetch, location: {search: '', href: 'https://example.test/'}, localStorage: {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)}, setTimeout() {}, clearTimeout() {}};
  const checks = `(async()=>{
    render=()=>{};renderSync=()=>{};setDefaultRecordDate=()=>{};
    endpoint='https://script.google.com/macros/s/smoke/exec';
    const probe=unpackRemote(await (await fetchShared(endpoint)).json());
    assert.equal(probe.version,10);
    assert.equal(probe.config.crew[0].name,'Old Crew');
    assert.equal(probe.config.crew[0].pullMode,undefined);
    const next={startDate:'2026-07-01',tripDate:'2026-07-31',goal:3000,crew:[{name:'Alex'}]};
    let saved=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({action:'saveConfig',config:next})})).json();
    assert.equal(saved.ok,true);config=saved.config;me='Alex';recordingFor='Alex';
    const joined=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({action:'addParticipant',name:'Maya'})})).json();
    assert.equal(joined.participant.name,'Maya');assert.equal(joined.config.crew.length,2);
    saved=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({name:'Alex',type:'climb',date:'2026-07-13',hardestGrade:'V4',points:999})})).json();
    assert.equal(saved.points,3);assert.equal(saved.category,'climb');
    assert.equal(await loadRemote(),true,syncDetail||syncErrorCode);assert.equal(logs.length,1);assert.equal(logs[0].id,'activity-1');assert.equal(syncState,'live');
    const deleted=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({action:'delete',id:'activity-1'})})).json();
    assert.equal(deleted.ok,true);await loadRemote();assert.equal(logs.length,0);
  })()`;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
  assert.deepEqual(requests.filter(x => x.method === 'POST').map(x => x.body.action || 'activity'), ['saveConfig', 'addParticipant', 'activity', 'delete']);
  assert.ok(requests.filter(x => x.method === 'GET').length >= 3);
});
