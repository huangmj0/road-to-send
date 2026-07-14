const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('shared workflow connects, saves categorized roster, adds, syncs, and deletes activity', async () => {
  const values = new Map(), requests = [];
  const server = {
    config: {startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Old Crew',pullMode:null}]},
    activities: [],
  };
  const remote = () => ({version:8,features:['daily-cap-v1','participant-pull-mode','challenge-window','self-registration-v1'],activities:server.activities.map(x=>({...x})),config:{...server.config,crew:server.config.crew.map(x=>({...x}))},configErrors:server.config.crew.filter(x=>!x.pullMode).map(x=>({field:'pullMode',value:x.name,reason:'must be hard or super-hard'})),serverDate:'2026-07-13',timeZone:'America/Los_Angeles'});
  const response = body => ({ok:true,json:async()=>body});
  const fetch = async (url,options={}) => {
    if(!options.method||options.method==='GET'){requests.push({method:'GET'});return response(remote())}
    const body=JSON.parse(options.body);requests.push({method:'POST',body});
    if(body.action==='saveConfig'){server.config=body.config;return response({version:8,ok:true,config:server.config,configErrors:[]})}
    if(body.action==='addParticipant'){const participant={name:body.name,pullMode:body.pullMode};server.config.crew.push(participant);return response({version:8,ok:true,participant,config:server.config,configErrors:[]})}
    if(body.action==='delete'){server.activities=server.activities.filter(x=>x.id!==body.id);return response({version:8,ok:true,deleted:body.id})}
    const participant=server.config.crew.find(x=>x.name===body.name),bands=participant.pullMode==='super-hard'?[[20,3],[30,4],[40,5]]:[[10,3],[15,4],[20,5]],points=body.type==='climb'?5:bands.reduce((score,[count,value])=>body.pullUps>=count?value:score,0);
    const saved={...body,id:'activity-1',createdAt:'2026-07-13T12:00:00Z',points,pullMode:body.type==='pull'?participant.pullMode:'',hardestGrade:body.type==='climb'?body.hardestGrade:'',pullUps:body.type==='pull'?body.pullUps:''};
    server.activities.push(saved);return response({version:8,ok:true,...saved});
  };
  const context={assert,console,URL,URLSearchParams,Map,Set,Date,Math,JSON,Object,Array,String,Number,RegExp,Error,Promise,Intl,fetch,location:{search:'',href:'https://example.test/'},localStorage:{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},setTimeout(){},clearTimeout(){}};
  const checks=`(async()=>{
    render=()=>{};renderSync=()=>{};setDefaultRecordDate=()=>{};
    endpoint='https://script.google.com/macros/s/smoke/exec';
    const probe=unpackRemote(await (await fetchShared(endpoint)).json());
    assert.equal(probe.version,8);
    assert.match(Object.values(probe.configErrors).join(' '),/Old Crew/);
    const next={startDate:'2026-07-01',tripDate:'2026-07-31',goal:750,crew:[{name:'Alex',pullMode:'super-hard'}]};
    let saved=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({action:'saveConfig',config:next})})).json();
    assert.equal(saved.ok,true);config=saved.config;me='Alex';recordingFor='Alex';
    const joined=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({action:'addParticipant',name:'Maya',pullMode:'hard'})})).json();
    assert.equal(joined.participant.pullMode,'hard');assert.equal(joined.config.crew.length,2);
    saved=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({name:'Alex',type:'pull',pullUps:30,date:'2026-07-13',points:999,pullMode:'hard'})})).json();
    assert.equal(saved.points,4);assert.equal(saved.pullMode,'super-hard');
    assert.equal(await loadRemote(),true,syncDetail||syncErrorCode);assert.equal(logs.length,1);assert.equal(logs[0].id,'activity-1');assert.equal(syncState,'live');
    const deleted=await (await fetchShared(endpoint,{method:'POST',body:JSON.stringify({action:'delete',id:'activity-1'})})).json();
    assert.equal(deleted.ok,true);await loadRemote();assert.equal(logs.length,0);
  })()`;
  await vm.runInNewContext(`${source}\n${checks}`,context,{filename:'index.html'});
  assert.deepEqual(requests.filter(x=>x.method==='POST').map(x=>x.body.action||'activity'),['saveConfig','addParticipant','activity','delete']);
  assert.ok(requests.filter(x=>x.method==='GET').length>=3);
});
