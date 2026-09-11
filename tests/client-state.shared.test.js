// Shared-mode harnesses with a stubbed fetch: background sync, setup, clipboard, storage,
// export, dialog focus and the share sheet. Unlike the other two client-state suites these are
// real async test() blocks, each building its own context.
//
// TRAP — each case uses a fresh happy-dom page so mutations cannot leak between asynchronous
// cases. Assertions inside a `checks` template literal may contain no backtick and no `${`.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {test} = require('node:test');
const {source, createDom} = require('./harness.js');

function sharedDom() {
  const window = createDom();
  return {window, document: window.document, fire: type => window.document.dispatchEvent(new window.Event(type, {bubbles: true}))};
}

function deferredTimers() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    setTimeout(callback, delay = 0) {
      const id = ++nextId;
      timers.set(id, {callback, due: now + Number(delay) || now});
      return id;
    },
    clearTimeout(id) {timers.delete(id)},
    advance(milliseconds) {
      now += milliseconds;
      let due;
      while ((due = [...timers.entries()].filter(([, timer]) => timer.due <= now).sort((a, b) => a[1].due - b[1].due)[0])) {
        timers.delete(due[0]);
        due[1].callback();
      }
    },
  };
}

async function flushPromises() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

test('a shared save finishing after navigation keeps confirmation in the original workflow', async () => {
  for (const features of [[], ['idempotent-activity-v1']]) {
    const dom = sharedDom();
    const timers = deferredTimers();
    const store = new Map();
    let resolvePost;
    let request;
    const context = {
      assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
      location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
      localStorage: {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
      fetch: (url, options = {}) => {
        if (!options.method) return new Promise(() => {});
        request = JSON.parse(options.body);
        return new Promise(resolve => {resolvePost = resolve});
      },
      setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    };
    vm.runInNewContext(source, context, {filename: 'index.html'});
    vm.runInContext(`state.endpoint='https://sheet.example.test/exec';state.protocolEndpoint=state.endpoint;state.protocolFeatures=${JSON.stringify(features)};state.config={startDate:'2026-09-01',tripDate:'2026-10-01',goal:500,crew:[{name:'Alex'}]};state.me='Alex';state.recordingFor='Alex';closeModal('identityModal');showTab('record');document.querySelector('#dateToggle').click();document.querySelector('#activityDate').value='2026-09-10';document.querySelector('#activityNote').value='Saved before moving on';document.querySelector('#saveActivityBtn').click();`, context);
    await flushPromises();
    assert.ok(request, 'the shipped form submits the activity');
    vm.runInContext("showTab('crew')", context);
    const previousStatus = dom.document.querySelector('#toast').textContent;
    timers.advance(15000);
    await flushPromises();
    assert.equal(dom.document.querySelector('#toast').textContent, previousStatus, 'the expired foreground wait stays quiet after navigation');
    resolvePost({ok: true, json: async () => ({...request, ok: true, id: 'late-away', category: 'climb', points: 3, createdAt: '2026-09-10T12:00:00Z'})});
    await flushPromises();
    assert.equal(dom.document.querySelector('[data-panel="crew"]').classList.contains('active'), true, 'late confirmation preserves the chosen page');
    assert.equal(dom.document.querySelector('#toast').textContent, previousStatus, 'late confirmation does not speak in another workflow');
    assert.equal(context.state.logs.filter(row => row.id === 'late-away').length, 1, 'the acknowledged record still reconciles');
    assert.equal(store.has('roadToSendPendingActivityV1'), false, 'successful confirmation still clears its pending command');
    assert.equal(dom.document.querySelector('#activityNote').value, '', 'the unchanged saved form resets without reopening it');
  }
});

test('shared requests explicitly negotiate the current additive protocol', async () => {
  const calls = [];
  const context = {
    console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    fetch: async (url, options) => {calls.push({url, options}); return {ok: true};},
    setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{await fetchShared('https://sheet.example.test/exec');await fetchShared('https://sheet.example.test/exec',{method:'POST',body:JSON.stringify({action:'delete',id:'a1'})})})()`, context, {filename: 'index.html'});
  assert.equal(new URL(calls[0].url).searchParams.get('protocolVersion'), '17');
  assert.equal(new URL(calls[1].url).searchParams.get('protocolVersion'), '17');
  assert.equal(JSON.parse(calls[1].options.body).protocolVersion, 17);
  assert.equal(JSON.parse(calls[1].options.body).id, 'a1', 'negotiation preserves the request payload');
});

test('a setup command keeps its identity across an interrupted response and cold restart', () => {
  const store = new Map();
  const makeContext = () => ({
    console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  });
  const config = {startDate: '2026-09-01', tripDate: '2026-10-01', goal: 500, crew: [{name: 'Alex'}]};
  const firstContext = makeContext();
  vm.runInNewContext(source, firstContext, {filename: 'index.html'});
  const first = firstContext.configCommand('https://sheet.example.test/exec', config);
  const restartedContext = makeContext();
  vm.runInNewContext(source, restartedContext, {filename: 'index.html'});
  const replay = restartedContext.configCommand('https://sheet.example.test/exec', config);
  assert.equal(replay.id, first.id, 'the same complete payload reuses its durable command identity');
  assert.equal(replay.expectedConfigRevision, 0, 'the pending command carries the observed configuration revision');
  assert.deepEqual(JSON.parse(JSON.stringify(replay.config)), config, 'the durable retry retains the complete validated draft');
  assert.throws(() => restartedContext.configCommand('https://sheet.example.test/exec', {...config, goal: 700}), /Resolve the pending setup command/, 'an unresolved identity cannot be replaced by different settings');
});

test('background sync respects the open date picker and refreshes stale caches', async () => {
  const dom = sharedDom();
  const store = new Map();
  store.set('roadToSendEndpoint', 'https://sheet.example.test/exec');
  store.set('roadToSendMe', 'Alex');
  const dayShift = n => {const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`};
  const payload = {version: 12, features: [], activities: [], config: {startDate: dayShift(-5), tripDate: dayShift(5), goal: 500, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: dayShift(0), timeZone: 'America/Los_Angeles'};
  let gets = 0;
  const syncContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    document: dom.document,
    fireDocumentEvent: dom.fire,
    countGets: () => gets,
    setPayloadVersion: v => {payload.version = v},
    setNumericActivity: activity => {payload.activities = [activity]},
    fetch: async (url, options = {}) => {if (!options.method) gets++; return {ok: true, json: async () => JSON.parse(JSON.stringify(payload))}},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const syncChecks = `(async()=>{
    await loadRemote();
    assert.equal(state.protocolEndpoint,'https://sheet.example.test/exec','a successful read records which endpoint supplied the capabilities');
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
    state.lastSyncedAt=Date.now()-6*60*1000;
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before+1,'a stale cache refreshes on tab return');
    // Entry 35: a crew member travelling, or anyone whose device clock has rolled past the Sheet's
    // midnight, can now see which day the app is actually scoring against and whose midnight it is.
    state.lastSyncedAt=Date.now();renderSync();
    const detail=document.querySelector('#diagnosticDetail').textContent;
    assert.ok(detail.indexOf('Challenge day: '+challengeToday())>=0,'the diagnostics name the challenge day the app is using');
    assert.ok(detail.indexOf('America/Los_Angeles')>=0,'and the timezone that day comes from');
    assert.ok(detail.indexOf('Protocol')===0,'the protocol line still leads');
    assert.equal(detail.indexOf('sheet.example.test'),-1,'and the endpoint is still nowhere in the diagnostics');
    // Entry 55: the diagnostics also name the protocol version this build expects, so the
    // organizer reading them has a number to deploy against.
    const expectedVersion=[...SUPPORTED_API_VERSIONS][0];
    assert.ok(detail.indexOf('This build expects v'+expectedVersion)>=0,'the diagnostics name the protocol version this build expects');
    setPayloadVersion(99);
    await loadRemote();
    const mismatchDetail=document.querySelector('#diagnosticDetail').textContent;
    assert.equal(state.protocolEndpoint,'','an unsupported response expires the verified endpoint');
    assert.ok(mismatchDetail.indexOf('This build expects v'+expectedVersion)>=0,'the expected version is still named after an unsupported payload');
    assert.equal(document.querySelector('#diagnosticCode').textContent,'RTS-REFRESH-VERSION','the version-mismatch code is still reported');
    setPayloadVersion(12);
    setNumericActivity({id:'numeric-name',name:7,type:'climb',date:'${dayShift(-1)}',createdAt:'1'});
    await loadRemote();
    assert.equal(state.syncState,'live','a reachable payload with a numeric activity name remains a live sync');
    state.endpoint='';renderSync();
    const localDetail=document.querySelector('#diagnosticDetail').textContent;
    assert.equal(localDetail.indexOf('Challenge day'),-1,'local mode says nothing about a challenge day');
    assert.equal(localDetail.indexOf('America/Los_Angeles'),-1,'nor about a timezone it does not follow');
  })()`;
  await vm.runInNewContext(`${source}\n${syncChecks}`, syncContext, {filename: 'index.html'});
});

// Entry 55: testConnection()'s outdated-script message used to hard-code "deploy v11", which
// would quietly go stale the next time the protocol version bumps. It now derives the version
// from SUPPORTED_API_VERSIONS, the same expression saveSetup() and exportData() already use.
test('testConnection names the expected protocol version instead of a stale literal', async () => {
  const dom = sharedDom();
  const store = new Map();
  const testContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    document: dom.document,
    fetch: async () => ({ok: true, json: async () => ({version: 99, features: [], activities: [], config: null, configErrors: []})}),
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const testChecks = `(async()=>{
    document.querySelector('#endpoint').value='https://sheet.example.test/exec';
    const expectedVersion=[...SUPPORTED_API_VERSIONS][0];
    const ok=await testConnection();
    assert.equal(ok,false,'an unsupported version reports the connection as not usable');
    assert.equal(document.querySelector('#testResult').textContent,'Outdated Apps Script — deploy v'+expectedVersion,'the outdated-script message names the version this build expects, not a hard-coded literal');
  })()`;
  await vm.runInNewContext(`${source}\n${testChecks}`, testContext, {filename: 'index.html'});
});

// Entry 22 regression lock: saveSetup() awaits copyCrewLink() inside its try, so a rejected
// clipboard write used to land in the catch and paint #setupErrors as if setup had failed —
// even though the config was already on the Sheet and the endpoint had persisted.
test('a denied clipboard copy never reports shared setup as failed', async () => {
  const dom = sharedDom();
  const queryAll = dom.document.querySelectorAll.bind(dom.document);
  const store = new Map();
  const posted = [];
  const dayShift = n => {const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`};
  const crewConfig = {startDate: dayShift(-5), tripDate: dayShift(5), goal: 500, crew: [{name: 'Alex'}]};
  const payload = {version: 12, features: [], activities: [], config: crewConfig, configErrors: [], serverDate: '', timeZone: ''};
  const setupContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    navigator: {clipboard: {writeText: () => Promise.reject(Error('denied'))}},
    document: dom.document,
    postedActions: () => posted.join(','),
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {posted.push(JSON.parse(options.body).action); return {ok: true, json: async () => ({ok: true, config: JSON.parse(JSON.stringify(crewConfig))})}}
      return {ok: true, json: async () => JSON.parse(JSON.stringify(payload))};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const setupChecks = `(async()=>{
    document.querySelector('#endpoint').value='https://sheet.example.test/exec';
    document.querySelector('#challengeStart').value='${crewConfig.startDate}';
    document.querySelector('#tripDate').value='${crewConfig.tripDate}';
    document.querySelector('#groupGoalInput').value='500';
    document.querySelector('#participantRows').innerHTML='<div class="participant-row"><input class="participant-name" value="Alex" /></div>';
    await saveSetup();
    assert.equal(state.endpoint,'https://sheet.example.test/exec','the endpoint persisted even though the clipboard refused');
    assert.equal(localStorage.getItem('roadToSendEndpoint'),'https://sheet.example.test/exec','the endpoint reached localStorage');
    assert.equal(postedActions(),'saveConfig','the config was saved to the Sheet exactly once');
    assert.equal(document.querySelector('#setupErrors').classList.contains('hide'),true,'a denied copy never paints the setup error box');
    assert.equal(document.querySelector('#toast').textContent,'Shared setup saved. Copy the crew link from setup.','the toast reports a saved setup with an uncopied link');
    assert.equal(document.querySelector('#saveSetupBtn').disabled,false,'the Save button is released either way');
  })()`;
  await vm.runInNewContext(`${source}\n${setupChecks}`, setupContext, {filename: 'index.html'});
});

test('copyText reports a successful clipboard write and keeps the crew link deliberate', async () => {
  const dom = sharedDom();
  const store = new Map();
  const written = [];
  const copyContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/?sheet=https%3A%2F%2Fsheet.example.test%2Fexec#you', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    navigator: {clipboard: {writeText: value => {written.push(String(value)); return Promise.resolve()}}},
    document: dom.document,
    lastWritten: () => written[written.length - 1],
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const copyChecks = `(async()=>{
    const ok=await copyText('hello','Progress copied — paste it anywhere.');
    assert.equal(ok,true,'a resolved clipboard write reports true');
    assert.equal(lastWritten(),'hello','the text reaches the clipboard');
    assert.equal(document.querySelector('#toast').textContent,'Progress copied — paste it anywhere.','a successful copy toasts the caller message');
    state.endpoint='https://sheet.example.test/exec';
    assert.equal(await copyCrewLink(),true,'the crew link copy hands back the helper result');
    assert.ok(lastWritten().indexOf('sheet=')>=0,'the crew link deliberately still carries the sheet param');
    assert.equal(lastWritten().indexOf('#you'),-1,'the crew link still drops the tab hash');
    assert.equal(document.querySelector('#toast').textContent,'Crew link copied.','a copied crew link keeps its own toast');
    state.endpoint='';
  })()`;
  await vm.runInNewContext(`${source}\n${copyChecks}`, copyContext, {filename: 'index.html'});
});

test('a failed local write keeps a complete recovery draft that can be retried or exported', async () => {
  const dom = sharedDom();
  const store = new Map();
  const today = new Date().toISOString().slice(0, 10);
  const existing = {id: 'local-existing', name: 'Alex', type: 'exercise', category: 'exercise', points: 2, date: today, createdAt: '1', note: 'Already durable'};
  store.set('roadToSendLogsV9', JSON.stringify([existing]));
  let logWrites = 0;
  let downloaded = '';
  const storageContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    document: dom.document,
    // An exhausted quota throws on the first activity write while reads remain available, which
    // exercises a partial config-success/activity-failure without hiding existing history.
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => {if (key === 'roadToSendLogsV9' && logWrites++ === 0) throw Error('QuotaExceededError'); store.set(key, String(value))}, removeItem: key => store.delete(key)},
    Blob: class {constructor(parts) {downloaded = String(parts[0])}},
    getDownloaded: () => downloaded,
    URL: Object.assign(URL, {createObjectURL: () => 'blob:recovery', revokeObjectURL() {}}),
    setTimeout() {}, clearTimeout() {},
  };
  const storageChecks = `(async()=>{
    state.endpoint='';
    state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};
    state.logs=JSON.parse(localStorage.getItem('roadToSendLogsV9'));state.me='';state.recordingFor='';
    document.querySelector('#identityMember').innerHTML='<option value="Alex">Alex</option>';
    document.querySelector('#identityMember').value='Alex';
    document.querySelector('#identityModal').classList.add('open');
    saveIdentity();
    assert.equal(state.me,'Alex','a failed write still records the identity in memory');
    assert.equal(document.querySelector('#identityModal').classList.contains('open'),false,'and the dialog closes instead of trapping the user behind an uncaught throw');
    document.querySelector('#activityDate').value='${today}';
    document.querySelector('#hardestGrade').value='V6';
    document.querySelector('#activityNote').value='Steep red problem';
    await submitActivity({preventDefault(){}});
    assert.equal(state.logs.length,2,'the entry stays available in memory beside existing history');
    assert.equal(JSON.parse(localStorage.getItem('roadToSendLogsV9')).length,1,'the partial write failure leaves existing durable history untouched');
    assert.deepEqual({name:state.recoveryDraft.name,date:state.recoveryDraft.date,type:state.recoveryDraft.type,hardestGrade:state.recoveryDraft.hardestGrade,bountyId:state.recoveryDraft.bountyId||'',note:state.recoveryDraft.note},{name:'Alex',date:'${today}',type:'climb',hardestGrade:'V6',bountyId:'',note:'Steep red problem'},'the recovery draft retains every activity field, including the empty bounty choice for a climb');
    assert.equal(document.querySelector('#storageRecovery').classList.contains('hide'),false,'the deliberate recovery controls are visible on the Record tab');
    assert.equal(document.querySelector('#toast').textContent,'Activity kept as a recovery draft — it is not saved yet.','the app does not describe a memory-only entry as durable');
    assert.equal(document.querySelector('#activityNote').value,'Steep red problem','the form remains intact after the failed save');
    assert.equal(document.querySelector('#saveActivityBtn').textContent,'Save activity','and the button is handed back');
    assert.equal(document.querySelector('#saveActivityBtn').disabled,true,'a second ordinary save cannot duplicate the memory-only draft');
    exportRecoveryDraft();
    const exported=JSON.parse(getDownloaded());
    assert.deepEqual({name:exported.activity.name,date:exported.activity.date,hardestGrade:exported.activity.hardestGrade,note:exported.activity.note},{name:'Alex',date:'${today}',hardestGrade:'V6',note:'Steep red problem'},'export downloads the same complete recovery draft');
    await retryRecoveryDraft();
    assert.equal(state.recoveryDraft,null,'a successful retry clears the recovery state');
    assert.equal(document.querySelector('#storageRecovery').classList.contains('hide'),true,'successful retry dismisses the recovery controls');
    assert.equal(JSON.parse(localStorage.getItem('roadToSendLogsV9')).length,2,'the retry preserves existing history and durably adds the draft once');
    assert.match(localStorage.getItem('roadToSendLogsV9'),/Steep red problem/,'the retry durably writes the activity');
    assert.equal(document.querySelector('#toast').textContent,'Activity saved.','successful retry gives the normal durable confirmation');
  })()`;
  await vm.runInNewContext(`${source}\n${storageChecks}`, storageContext, {filename: 'index.html'});
});

test('blocked storage reads never turn unknown local history into an empty writable store', async () => {
  const dom = sharedDom();
  let readsBlocked = true;
  const store = new Map([['roadToSendLogsV9', JSON.stringify([{id: 'local-existing', name: 'Alex', type: 'exercise', date: '2026-07-13', createdAt: '1'}])]]);
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    localStorage: {getItem: key => {if (readsBlocked) throw Error('SecurityError'); return store.has(key) ? store.get(key) : null}, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    unblockReads: () => {readsBlocked = false},
    setTimeout() {}, clearTimeout() {},
  };
  const checks = `(()=>{
    assert.doesNotThrow(()=>loadInitialState(),'blocked reads fall back without crashing startup');
    state.config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
    state.logs=[{id:'local-draft',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'2'}];
    assert.equal(persistLocal(),false,'a write is refused while existing history cannot be read');
    unblockReads();
    assert.equal(JSON.parse(localStorage.getItem('roadToSendLogsV9')).length,1,'the refused write did not replace unknown history');
    assert.equal(persistLocal(),true,'the same write can be retried once reads recover');
    const saved=JSON.parse(localStorage.getItem('roadToSendLogsV9'));
    assert.equal(saved.length,2,'retry merges the draft with history that became readable');
    assert.ok(saved.some(x=>x.id==='local-existing')&&saved.some(x=>x.id==='local-draft'),'both the old activity and draft survive');
  })()`;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

// Lever 1: a shared-mode save no longer blocks the confirmation on a full reload. The write
// response is the authoritative row, so it lands in the feed at once; reconciliation is a
// background loadRemote(). Here that reconcile GET never resolves, proving the save does not wait
// on it — the pre-optimistic code awaited loadRemote() and would hang forever on this stub.
test('a shared save shows the entry from the write response without waiting on a reload', async () => {
  const dom = sharedDom();
  const store = new Map();
  let posted = 0;
  const today = new Date().toISOString().slice(0, 10);
  store.set('roadToSendEndpoint', 'https://sheet.example.test/exec');
  store.set('roadToSendMe', 'Alex');
  const savedContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    document: dom.document,
    postedCount: () => posted,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {posted++; return {ok: true, json: async () => ({version: 12, ok: true, id: 'srv-1', name: 'Alex', type: 'climb', category: 'climb', points: 3, date: today, createdAt: '2026-01-01T00:00:00.000Z', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''})}}
      return new Promise(() => {});
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const savedChecks = `(async()=>{
    state.endpoint='https://sheet.example.test/exec';
    state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};
    state.logs=[];state.me='Alex';state.recordingFor='Alex';
    document.querySelector('#activityDate').value='${today}';
    await submitActivity({preventDefault(){}});
    assert.equal(postedCount(),1,'the activity is written to the Sheet exactly once');
    assert.equal(state.logs.length,1,'the saved row appears immediately, without awaiting a full reload');
    assert.equal(state.logs[0].id,'srv-1','the row is the authoritative record the write returned');
    assert.equal(state.logs[0].points,3,'including the points the backend derived, not the raw request');
    assert.equal(document.querySelector('#toast').textContent,'Activity saved.','and success is confirmed at once');
    assert.equal(state.saving,false,'the save flag is released');
  })()`;
  await vm.runInNewContext(`${source}\n${savedChecks}`, savedContext, {filename: 'index.html'});
});

test('a timed-out save keeps its draft and reuses the same mutation before commit', async () => {
  const dom = sharedDom();
  const timers = deferredTimers();
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]};
  const store = new Map();
  const posted = [];
  const resolvers = [];
  let serverActivities = [];
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    advanceTimers: timers.advance,
    posted, resolvers, serverActivities,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {posted.push(JSON.parse(options.body)); return new Promise(resolve => resolvers.push(resolve))}
      return {ok: true, json: async () => ({version: 14, features: ['idempotent-activity-v1'], activities: JSON.parse(JSON.stringify(serverActivities)), config, configErrors: [], serverDate: today, timeZone: 'UTC'})};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
  };
  const checks = `(async()=>{
    state.endpoint='${endpoint}';state.protocolEndpoint='${endpoint}';state.protocolFeatures=['idempotent-activity-v1'];state.config=${JSON.stringify(config)};state.me='Alex';state.recordingFor='Alex';state.logs=[];
    document.querySelector('#activityDate').value='${today}';document.querySelector('#hardestGrade').value='V7';document.querySelector('#activityNote').value='Steep red problem';
    const first=submitActivity({preventDefault(){}});await Promise.resolve();advanceTimers(15000);await first;
    const pending=JSON.parse(localStorage.getItem('roadToSendPendingActivityV1'));
    assert.equal(state.logs.length,0,'a timeout before either response keeps the activity unresolved');
    assert.equal(state.saving,false,'the foreground save lock is released at the deadline');
    assert.equal(document.querySelector('#activityDate').value,'${today}','the chosen date stays in the form');
    assert.equal(document.querySelector('#hardestGrade').value,'V7','the grade stays in the form');
    assert.equal(document.querySelector('#activityNote').value,'Steep red problem','the note stays in the form');
    assert.equal(document.querySelector('#saveActivityBtn').textContent,'Retry save','the form offers the same recoverable command');
    assert.equal(pending.endpoint,'${endpoint}');assert.ok(pending.mutationId,'the pending command has a durable mutation id');
    const retry=submitActivity({preventDefault(){}});await Promise.resolve();advanceTimers(15000);await retry;
    assert.equal(posted.length,2,'retrying an unresolved save sends one second safe command');
    assert.equal(posted[0].mutationId,posted[1].mutationId,'both attempts use the same mutation identity');
    const saved={version:14,ok:true,id:'srv-timeout-before',name:'Alex',type:'climb',category:'climb',points:3,date:'${today}',createdAt:'2026-09-09T12:00:00.000Z',hardestGrade:'V7',bountyId:'',bountyTitle:'',note:'Steep red problem'};
    serverActivities.splice(0,serverActivities.length,saved);
    resolvers[0]( {ok:true,json:async()=>saved} );resolvers[1]( {ok:true,json:async()=>saved} );await flushPromises();
    assert.equal(state.logs.filter(x=>x.id==='srv-timeout-before').length,1,'duplicate late responses reconcile to one canonical row');
    assert.equal(localStorage.getItem('roadToSendPendingActivityV1'),null,'the acknowledged command is cleared after the late response');
  })()`;
  context.flushPromises = flushPromises;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

test('a save that commits before the deadline but answers after it reconciles independently of a hanging refresh', async () => {
  const dom = sharedDom();
  const timers = deferredTimers();
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]};
  const store = new Map();
  const reads = [];
  const serverActivities = [];
  let resolvePost;
  let committed = false;
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    advanceTimers: timers.advance, serverActivities,
    committedState: () => committed,
    resolvePost: value => resolvePost(value),
    reads,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {committed=true; return new Promise(resolve => {resolvePost=resolve})}
      const snapshot=JSON.parse(JSON.stringify(serverActivities));
      return new Promise(resolve => reads.push(response => resolve(response||{ok:true,json:async()=>({version:14,features:['idempotent-activity-v1'],activities:snapshot,config,configErrors:[],serverDate:today,timeZone:'UTC'})})));
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
  };
  const checks = `(async()=>{
    state.endpoint='${endpoint}';state.protocolEndpoint='${endpoint}';state.protocolFeatures=['idempotent-activity-v1'];state.config=${JSON.stringify(config)};state.me='Alex';state.recordingFor='Alex';state.logs=[];
    document.querySelector('#activityDate').value='${today}';document.querySelector('#activityNote').value='Committed, response delayed';
    const save=submitActivity({preventDefault(){}});await Promise.resolve();assert.equal(committedState(),true,'the request reached the backend before the foreground deadline');advanceTimers(15000);await save;
    assert.equal(state.logs.length,0,'the unresolved form does not claim a row before confirmation');
    assert.ok(localStorage.getItem('roadToSendPendingActivityV1'),'the recoverable command remains while the response is delayed');
    const saved={version:14,ok:true,id:'srv-timeout-after',name:'Alex',type:'climb',category:'climb',points:3,date:'${today}',createdAt:'2026-09-09T12:01:00.000Z',hardestGrade:'',bountyId:'',bountyTitle:'',note:'Committed, response delayed'};
    serverActivities.push(saved);resolvePost({ok:true,json:async()=>saved});await flushPromises();
    assert.equal(state.logs.filter(x=>x.id==='srv-timeout-after').length,1,'the late authoritative row appears without waiting for GET');
    assert.equal(reads.length,1,'the background refresh starts after the write acknowledgement');
    reads[0]();await flushPromises();
    serverActivities.splice(0,serverActivities.length);const laterRead=loadRemote();await Promise.resolve();
    reads[1]();await flushPromises();await laterRead;
    assert.equal(state.logs.filter(x=>x.id==='srv-timeout-after').length,0,'a read begun after acknowledgement can report another browser deletion');
    assert.equal(localStorage.getItem('roadToSendPendingActivityV1'),null,'the late authoritative response resolves the command');
    assert.equal(document.querySelector('#activityNote').value,'','the acknowledged save can clear the form');
    assert.equal(document.querySelector('#toast').textContent,'Activity saved.','the acknowledgement owns its own success status');
  })()`;
  context.flushPromises = flushPromises;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

test('a late save response stays with its endpoint across a crew-link change', async () => {
  const dom = sharedDom();
  const timers = deferredTimers();
  const oldEndpoint = 'https://old.example.test/exec';
  const newEndpoint = 'https://new.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]};
  const store = new Map();
  const serverActivities = new Map([[oldEndpoint, []], [newEndpoint, []]]);
  let resolvePost;
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    advanceTimers: timers.advance,
    serverActivities,
    resolvePost: value => resolvePost(value),
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') return new Promise(resolve => {resolvePost=resolve});
      const current = serverActivities.get(new URL(url).origin + new URL(url).pathname) || [];
      return {ok: true, json: async () => ({version: 14, features: ['idempotent-activity-v1'], activities: JSON.parse(JSON.stringify(current)), config, configErrors: [], serverDate: today, timeZone: 'UTC'})};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
  };
  const checks = `(async()=>{
    state.endpoint='${oldEndpoint}';state.protocolEndpoint='${oldEndpoint}';state.protocolFeatures=['idempotent-activity-v1'];state.config=${JSON.stringify(config)};state.me='Alex';state.recordingFor='Alex';state.logs=[];
    document.querySelector('#activityDate').value='${today}';document.querySelector('#activityNote').value='Old crew entry';
    const save=submitActivity({preventDefault(){}});await Promise.resolve();advanceTimers(15000);await save;
    const pending=JSON.parse(localStorage.getItem('roadToSendPendingActivityV1'));assert.equal(pending.endpoint,'${oldEndpoint}','the unresolved command remembers its crew link');
    state.endpoint='${newEndpoint}';state.protocolEndpoint='${newEndpoint}';
    const saved={version:14,ok:true,id:'srv-old-crew',name:'Alex',type:'climb',category:'climb',points:3,date:'${today}',createdAt:'2026-09-09T12:02:00.000Z',hardestGrade:'',bountyId:'',bountyTitle:'',note:'Old crew entry'};
    serverActivities.set('${oldEndpoint}',[saved]);
    resolvePost({ok:true,json:async()=>saved});await flushPromises();
    assert.equal(state.logs.length,0,'a late old-crew response cannot paint the current crew feed');
    assert.equal(localStorage.getItem('roadToSendPendingActivityV1'),null,'the old endpoint command clears only after its own response arrives');
    state.endpoint='${oldEndpoint}';state.protocolEndpoint='${oldEndpoint}';await loadRemote();
    assert.equal(state.logs.filter(x=>x.id==='srv-old-crew').length,1,'returning to the old crew reconciles its confirmed row');
  })()`;
  context.flushPromises = flushPromises;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

test('a delayed snapshot cannot resurrect an acknowledged shared deletion', async () => {
  const dom = sharedDom();
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]};
  const row = {id: 'srv-delete-delayed', name: 'Alex', type: 'exercise', category: 'exercise', points: 2, date: today, createdAt: '1', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''};
  const store = new Map();
  const reads = [];
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    reads,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') return {ok: true, json: async () => ({version: 14, ok: true, deleted: row.id})};
      return new Promise(resolve => reads.push(resolve));
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const checks = `(async()=>{
    state.endpoint='${endpoint}';state.protocolEndpoint='${endpoint}';state.config=${JSON.stringify(config)};state.me='Alex';state.recordingFor='Alex';state.logs=[${JSON.stringify(row)}];render();
    const oldRead=loadRemote();await Promise.resolve();
    const del=document.querySelector('#personalActivity [data-del]');del.dispatchEvent(new window.Event('click',{bubbles:true}));document.querySelector('#confirmOk').dispatchEvent(new window.Event('click',{bubbles:true}));await flushPromises();
    assert.equal(state.logs.length,0,'the accepted delete leaves the row gone immediately');assert.equal(reads.length,2,'delete reconciliation starts a second snapshot');
    const oldSnapshot={version:14,features:[],activities:[${JSON.stringify(row)}],config:${JSON.stringify(config)},configErrors:[],serverDate:'${today}',timeZone:'UTC'};
    reads[0]({ok:true,json:async()=>oldSnapshot});await flushPromises();assert.equal(state.logs.length,0,'the delayed pre-delete snapshot is ignored');
    reads[1]({ok:true,json:async()=>({version:14,features:[],activities:[],config:${JSON.stringify(config)},configErrors:[],serverDate:'${today}',timeZone:'UTC'})});await flushPromises();
    const laterRead=loadRemote();await Promise.resolve();
    reads[2]({ok:true,json:async()=>oldSnapshot});await flushPromises();await laterRead;await oldRead;assert.equal(state.logs.length,0,'even a stale snapshot after the Sheet reflects the delete respects the tombstone');
  })()`;
  context.flushPromises = flushPromises;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

test('a late save acknowledgement cannot undo an acknowledged deletion or draft edit', async () => {
  const dom = sharedDom();
  const timers = deferredTimers();
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]};
  const store = new Map();
  const reads = [];
  const serverActivities = [];
  const posted = [];
  let resolveSave;
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    advanceTimers: timers.advance,
    serverActivities, posted, reads,
    resolveSave: value => resolveSave(value),
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {
        const request = JSON.parse(options.body);posted.push(request);
        if (request.action === 'delete') {serverActivities.splice(0, serverActivities.length);return {ok: true, json: async () => ({version: 14, ok: true, deleted: request.id})}}
        return new Promise(resolve => {resolveSave = resolve});
      }
      const snapshot = JSON.parse(JSON.stringify(serverActivities));
      return new Promise(resolve => reads.push(done => resolve(done || {ok: true, json: async () => ({version: 14, features: ['idempotent-activity-v1'], activities: snapshot, config, configErrors: [], serverDate: today, timeZone: 'UTC'})})));
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
  };
  const checks = `(async()=>{
    state.endpoint='${endpoint}';state.protocolEndpoint='${endpoint}';state.protocolFeatures=['idempotent-activity-v1'];state.config=${JSON.stringify(config)};state.me='Alex';state.recordingFor='Alex';state.logs=[];
    document.querySelector('#activityDate').value='${today}';document.querySelector('#activityNote').value='Original';
    const save=submitActivity({preventDefault(){}});await Promise.resolve();advanceTimers(15000);await save;
    const saved={version:14,ok:true,id:'saved-then-deleted',name:'Alex',type:'climb',category:'climb',points:3,date:'${today}',createdAt:'2026-09-11T00:00:00.000Z',hardestGrade:'',bountyId:'',bountyTitle:'',note:'Original'};
    serverActivities.push(saved);const observed=loadRemote();await Promise.resolve();reads[0]();await flushPromises();await observed;
    document.querySelector('#activityNote').value='Edited draft';
    const del=document.querySelector('#personalActivity [data-del]');del.dispatchEvent(new window.Event('click',{bubbles:true}));document.querySelector('#confirmOk').dispatchEvent(new window.Event('click',{bubbles:true}));await flushPromises();
    assert.equal(state.logs.length,0,'the acknowledged delete removes the observed row immediately');assert.equal(reads.length,2,'delete reconciliation starts a fresh snapshot');
    reads[1]();await flushPromises();assert.equal(state.logs.length,0,'the fresh post-delete snapshot stays authoritative');
    resolveSave({ok:true,json:async()=>saved});await flushPromises();
    assert.equal(state.logs.length,0,'the late save acknowledgement cannot resurrect the deleted row');assert.equal(localStorage.getItem('roadToSendPendingActivityV1'),null,'the resolved command is cleared after the late acknowledgement');assert.equal(document.querySelector('#activityNote').value,'Edited draft','the late acknowledgement preserves an edited draft');assert.equal(document.querySelector('#toast').textContent,'Entry deleted.','the delete status is not overwritten by the late acknowledgement');
  })()`;
  context.flushPromises = flushPromises;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

test('a late legacy save acknowledgement preserves an edited draft', async () => {
  const dom = sharedDom();
  const timers = deferredTimers();
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]};
  const store = new Map();
  let resolveSave;
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    advanceTimers: timers.advance,
    resolveSave: value => resolveSave(value),
    fetch: async (url, options = {}) => options.method === 'POST' ? new Promise(resolve => {resolveSave = resolve}) : new Promise(() => {}),
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
  };
  const checks = `(async()=>{
    state.endpoint='${endpoint}';state.protocolEndpoint='${endpoint}';state.protocolFeatures=[];state.config=${JSON.stringify(config)};state.me='Alex';state.recordingFor='Alex';state.logs=[];
    document.querySelector('#activityDate').value='${today}';document.querySelector('#activityNote').value='Original';
    const save=submitActivity({preventDefault(){}});await Promise.resolve();advanceTimers(15000);await save;
    document.querySelector('#activityNote').value='Edited draft';
    const saved={version:14,ok:true,id:'legacy-late',name:'Alex',type:'climb',category:'climb',points:3,date:'${today}',createdAt:'2026-09-11T00:00:00.000Z',hardestGrade:'',bountyId:'',bountyTitle:'',note:'Original'};
    resolveSave({ok:true,json:async()=>saved});await flushPromises();
    assert.equal(state.logs.filter(x=>x.id==='legacy-late').length,1,'the late legacy acknowledgement still shows the saved row');assert.equal(document.querySelector('#activityNote').value,'Edited draft','the late legacy acknowledgement does not reset an edited draft');assert.equal(document.querySelector('#toast').textContent,'Activity saved.','the acknowledgement reports success without changing the draft');
  })()`;
  context.flushPromises = flushPromises;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

test('proxy saves return to the personal target before the next personal form save', async () => {
  const dom = sharedDom();
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}, {name: 'Bea'}]};
  const store = new Map();
  const posted = [];
  const serverActivities = [];
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    posted,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {const request=JSON.parse(options.body),saved={version:14,ok:true,id:'srv-proxy-'+(posted.length+1),name:request.name,type:request.type,category:request.type,points:3,date:request.date,createdAt:'2026-09-09T12:03:00.000Z',hardestGrade:'',bountyId:'',bountyTitle:'',note:request.note};posted.push(request);serverActivities.push(saved);return {ok:true,json:async()=>saved}}
      return {ok:true,json:async()=>({version:14,features:['idempotent-activity-v1'],activities:JSON.parse(JSON.stringify(serverActivities)),config,configErrors:[],serverDate:today,timeZone:'UTC'})};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const checks = `(async()=>{
    state.endpoint='${endpoint}';state.protocolEndpoint='${endpoint}';state.protocolFeatures=['idempotent-activity-v1'];state.config=${JSON.stringify(config)};state.me='Alex';state.recordingFor='Alex';state.logs=[];render();
    openProxy();document.querySelector('#proxyMember').value='Bea';saveProxy();document.querySelector('#activityDate').value='${today}';document.querySelector('#activityNote').value='For Bea';await submitActivity({preventDefault(){}});
    assert.equal(posted[0].name,'Bea','the first form save carries the proxy target');assert.equal(state.recordingFor,'Alex','the acknowledged proxy save returns recording to the personal target');assert.equal(state.logs[0].name,'Bea');
    showTab('record');document.querySelector('#activityDate').value='${today}';document.querySelector('#activityNote').value='For Alex';await submitActivity({preventDefault(){}});
    assert.equal(posted[1].name,'Alex','the next form save carries the personal target');assert.equal(state.logs.filter(x=>x.name==='Bea').length,1);assert.equal(state.logs.filter(x=>x.name==='Alex').length,1,'both canonical rows survive stale snapshots');
  })()`;
  context.flushPromises = flushPromises;
  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});

test('a negotiated shared save keeps one mutation id across response loss and reload', async () => {
  const store = new Map();
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const config = {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]};
  const remote = {version: 16, features: ['idempotent-activity-v1'], activities: [], config, configErrors: [], serverDate: today, timeZone: 'UTC'};
  store.set('roadToSendEndpoint', endpoint);
  store.set('roadToSendMe', 'Alex');
  store.set('roadToSendShared:config:' + encodeURIComponent(endpoint), JSON.stringify(config));
  store.set('roadToSendShared:activities:' + encodeURIComponent(endpoint), '[]');
  store.set('roadToSendShared:meta:' + encodeURIComponent(endpoint), JSON.stringify({protocolVersion: 15, protocolFeatures: ['idempotent-activity-v1'], serverDate: today, timeZone: 'UTC'}));
  const posted = [];
  const makeContext = (saveResult, dom = sharedDom()) => ({
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async (url, options = {}) => {
      if (!options.method) return {ok: true, json: async () => JSON.parse(JSON.stringify(remote))};
      posted.push(JSON.parse(options.body));
      if (saveResult instanceof Error) throw saveResult;
      remote.activities = [JSON.parse(JSON.stringify(saveResult))];
      return {ok: true, json: async () => JSON.parse(JSON.stringify(saveResult))};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  });

  const first = makeContext(Error('response lost'));
  await vm.runInNewContext(`${source}\n(async()=>{await Promise.resolve();state.protocolFeatures=['idempotent-activity-v1'];state.protocolEndpoint=state.endpoint;document.querySelector('#activityDate').value='${today}';document.querySelector('#activityNote').value='Steep red problem';await submitActivity({preventDefault(){}});assert.ok(localStorage.getItem('roadToSendPendingActivityV1'),'the uncertain command is durable');assert.equal(document.querySelector('#saveActivityBtn').textContent,'Retry save');assert.ok(document.querySelector('#toast').textContent.indexOf('same activity ID')>=0,'the negotiated failure promises the bounded safe retry')})()`, first, {filename: 'index.html'});

  const canonical = {version: 16, ok: true, id: 'canonical-1', name: 'Alex', type: 'climb', category: 'climb', points: 3, date: today, createdAt: '2026-09-06T12:00:00.000Z', hardestGrade: '', bountyId: '', bountyTitle: '', note: 'Steep red problem'};
  const second = makeContext(canonical);
  await vm.runInNewContext(`${source}\n(async()=>{await loadRemote();assert.equal(document.querySelector('#activityNote').value,'Steep red problem','reload restores the pending draft');assert.equal(document.querySelector('#saveActivityBtn').textContent,'Retry save','reload presents the recovered command as a retry');await submitActivity({preventDefault(){}});assert.equal(localStorage.getItem('roadToSendPendingActivityV1'),null,'the authoritative result clears the pending command');assert.equal(state.logs.filter(x=>x.id==='canonical-1').length,1,'the canonical activity appears once')})()`, second, {filename: 'index.html'});
  assert.equal(posted.length, 2);
  assert.equal(posted[0].mutationId, posted[1].mutationId, 'reload reuses the stable mutation id');
});

test('a pending shared save reloads when its shared cache is unavailable', async () => {
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const request = {name: 'Alex', type: 'climb', date: today, hardestGrade: 'V5', note: 'Steep red problem', bountyId: ''};
  const pending = {endpoint, mutationId: 'reload-command', fingerprint: JSON.stringify(request), request};
  const remote = {version: 15, features: ['idempotent-activity-v1'], activities: [], config: {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: today, timeZone: 'UTC'};
  const store = new Map([['roadToSendEndpoint', endpoint], ['roadToSendMe', 'Alex'], ['roadToSendPendingActivityV1', JSON.stringify(pending)]]);
  const posted = [];
  const dom = sharedDom();
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async (url, options = {}) => {
      if (!options.method) return {ok: true, json: async () => JSON.parse(JSON.stringify(remote))};
      posted.push(JSON.parse(options.body));
      return {ok: true, json: async () => ({version: 15, ok: true, id: 'reloaded-1', name: 'Alex', type: 'climb', category: 'climb', points: 3, date: today, createdAt: '2026-09-06T12:00:00.000Z', hardestGrade: 'V5', bountyId: '', bountyTitle: '', note: 'Steep red problem'})};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{await loadRemote();assert.equal(document.querySelector('#activityNote').value,'Steep red problem','the pending request is restored after the remote roster loads');assert.equal(document.querySelector('#saveActivityBtn').textContent,'Retry save');await submitActivity({preventDefault(){}});assert.equal(localStorage.getItem('roadToSendPendingActivityV1'),null,'the replay clears the pending request')})()`, context, {filename: 'index.html'});
  assert.equal(posted.filter(body => body.mutationId === 'reload-command').length, 1, 'reload retries the stored mutation ID once');
});

test('a later shared refresh preserves edits to the already restored pending retry', async () => {
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const earlier = new Date(today + 'T12:00:00');
  earlier.setDate(earlier.getDate() - 1);
  const chosen = earlier.toISOString().slice(0, 10);
  const request = {name: 'Alex', type: 'climb', date: today, hardestGrade: 'V5', note: 'Steep red problem', bountyId: ''};
  const pending = {endpoint, mutationId: 'refresh-command', fingerprint: JSON.stringify(request), request};
  const remote = {version: 15, features: ['idempotent-activity-v1'], activities: [], config: {startDate: chosen, tripDate: today, goal: 500, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: today, timeZone: 'UTC'};
  const store = new Map([['roadToSendEndpoint', endpoint], ['roadToSendMe', 'Alex'], ['roadToSendPendingActivityV1', JSON.stringify(pending)]]);
  const dom = sharedDom();
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async (url, options = {}) => {if (options.method) throw Error('unexpected write'); return {ok: true, json: async () => JSON.parse(JSON.stringify(remote))}},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{await loadRemote();const dateBox=document.querySelector('#dateFields'),dateField=document.querySelector('#activityDate'),noteField=document.querySelector('#activityNote');dateBox.classList.remove('hide');dateField.value='${chosen}';noteField.value='Edited locally';await loadRemote();assert.equal(dateField.value,'${chosen}','a later refresh leaves the deliberately chosen retry date alone');assert.equal(noteField.value,'Edited locally','a later refresh leaves the edited retry note alone')})()`, context, {filename: 'index.html'});
});

test('a pending shared save remains retryable after its climber leaves the roster', async () => {
  const endpoint = 'https://sheet.example.test/exec';
  const today = new Date().toISOString().slice(0, 10);
  const request = {name: 'Alex', type: 'climb', date: today, hardestGrade: 'V5', note: 'Steep red problem', bountyId: ''};
  const pending = {endpoint, mutationId: 'removed-climber-command', fingerprint: JSON.stringify(request), request};
  const remote = {version: 15, features: ['idempotent-activity-v1'], activities: [], config: {startDate: today, tripDate: today, goal: 500, crew: [{name: 'Maya'}]}, configErrors: [], serverDate: today, timeZone: 'UTC'};
  const store = new Map([['roadToSendEndpoint', endpoint], ['roadToSendMe', 'Alex'], ['roadToSendPendingActivityV1', JSON.stringify(pending)]]);
  const posted = [];
  const dom = sharedDom();
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async (url, options = {}) => {
      if (!options.method) return {ok: true, json: async () => JSON.parse(JSON.stringify(remote))};
      posted.push(JSON.parse(options.body));
      return {ok: true, json: async () => ({version: 15, ok: true, id: 'removed-1', name: 'Alex', type: 'climb', category: 'climb', points: 3, date: today, createdAt: '2026-09-06T12:00:00.000Z', hardestGrade: 'V5', bountyId: '', bountyTitle: '', note: 'Steep red problem'})};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{await loadRemote();assert.equal(document.querySelector('#activityNote').value,'Steep red problem','the stored request remains visible after roster refresh');state.me='';state.recordingFor='';await submitActivity({preventDefault(){}});assert.equal(localStorage.getItem('roadToSendPendingActivityV1'),null,'the receipt replay clears the pending request')})()`, context, {filename: 'index.html'});
  assert.equal(posted.filter(body => body.mutationId === 'removed-climber-command').length, 1, 'the removed climber request is replayed with its original ID');
});

test('a legacy shared save reports uncertainty without promising a safe retry', async () => {
  const dom = sharedDom();
  const today = new Date().toISOString().slice(0, 10);
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async () => {throw Error('response lost')},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}}, setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{state.endpoint='https://sheet.example.test/exec';state.protocolFeatures=[];state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};state.me='Alex';state.recordingFor='Alex';document.querySelector('#activityDate').value='${today}';await submitActivity({preventDefault(){}});assert.ok(document.querySelector('#toast').textContent.indexOf('may have reached the Sheet')>=0);assert.equal(document.querySelector('#toast').textContent.indexOf('safe to retry'),-1,'legacy copy makes no idempotency promise')})()`, context, {filename: 'index.html'});
});

test('an unverified endpoint cannot borrow the safe activity retry capability', async () => {
  const dom = sharedDom();
  const today = new Date().toISOString().slice(0, 10);
  const posts = [];
  const context = {
    posts, assert, console, URL, URLSearchParams, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async (url, options = {}) => {if (options.method) posts.push(JSON.parse(options.body)); throw Error('response unavailable')},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}}, setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{
    state.endpoint='https://older.example.test/exec';state.protocolEndpoint='https://newer.example.test/exec';state.protocolFeatures=['idempotent-activity-v1'];
    state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};state.me='Alex';state.recordingFor='Alex';
    document.querySelector('#activityDate').value='${today}';await submitActivity({preventDefault(){}});
    assert.equal(state.pendingActivity,null,'an unverified endpoint does not create a retry command');
    assert.equal(posts.length,1);assert.equal(posts[0].mutationId,undefined,'the request does not claim idempotency from another endpoint');
    assert.ok(document.querySelector('#toast').textContent.includes('Check Crew before retrying'));
  })()`, context, {filename: 'index.html'});
});

test('a pending save for another endpoint is preserved and blocks a new write', async () => {
  const dom = sharedDom();
  const today = new Date().toISOString().slice(0, 10);
  const old = {endpoint: 'https://old.example.test/exec', mutationId: 'old-command', fingerprint: 'old', request: {name: 'Alex', type: 'climb', date: today}};
  const store = new Map([['roadToSendPendingActivityV1', JSON.stringify(old)]]);
  let fetches = 0;
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async () => {fetches++; throw Error('must not send')}, fetchCount: () => fetches,
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)}, setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{state.endpoint='https://new.example.test/exec';state.protocolFeatures=['idempotent-activity-v1'];state.protocolEndpoint=state.endpoint;state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};state.me='Alex';state.recordingFor='Alex';state.pendingActivity=JSON.parse(localStorage.getItem('roadToSendPendingActivityV1'));document.querySelector('#activityDate').value='${today}';await submitActivity({preventDefault(){}});assert.equal(fetchCount(),0,'the new command is not sent');assert.equal(JSON.parse(localStorage.getItem('roadToSendPendingActivityV1')).mutationId,'old-command','the other endpoint command remains intact');assert.ok(document.querySelector('#toast').textContent.indexOf('another crew link')>=0)})()`, context, {filename: 'index.html'});
});

test('a negotiated save is not sent when its recovery command cannot be stored', async () => {
  const dom = sharedDom();
  const today = new Date().toISOString().slice(0, 10);
  let fetches = 0;
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async () => {fetches++; throw Error('must not send')}, fetchCount: () => fetches,
    localStorage: {getItem: () => null, setItem() {throw Error('quota')}, removeItem() {}}, setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{state.endpoint='https://sheet.example.test/exec';state.protocolFeatures=['idempotent-activity-v1'];state.protocolEndpoint=state.endpoint;state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};state.me='Alex';state.recordingFor='Alex';document.querySelector('#activityDate').value='${today}';await submitActivity({preventDefault(){}});assert.equal(fetchCount(),0);assert.ok(document.querySelector('#toast').textContent.indexOf('not sent')>=0)})()`, context, {filename: 'index.html'});
});

test('a successful shared delete disappears without waiting on a reload', async () => {
  const dom = sharedDom();
  const store = new Map();
  const posted = [];
  const today = new Date().toISOString().slice(0, 10);
  const deleteContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    document: dom.document,
    postedActions: () => posted,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {posted.push(JSON.parse(options.body)); return {ok: true, json: async () => ({version: 12, ok: true, deleted: 'srv-delete-1'})}}
      return new Promise(() => {});
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const deleteChecks = `(async()=>{
    state.endpoint='https://sheet.example.test/exec';
    state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};
    state.logs=[{id:'srv-delete-1',name:'Alex',type:'exercise',date:'${today}',createdAt:'1'}];state.me='Alex';state.recordingFor='Alex';
    render();
    document.querySelector('#personalActivity [data-del]').dispatchEvent(new window.Event('click',{bubbles:true}));
    assert.equal(document.querySelector('#confirmModal').classList.contains('open'),true,'the rendered delete control opens confirmation');
    document.querySelector('#confirmOk').dispatchEvent(new window.Event('click',{bubbles:true}));
    await Promise.resolve();await Promise.resolve();
    assert.equal(JSON.stringify(postedActions()),JSON.stringify([{action:'delete',id:'srv-delete-1',protocolVersion:17}]),'confirmation posts the exact shared row id with protocol negotiation');
    assert.equal(state.logs.length,0,'the accepted delete leaves memory immediately');
    assert.equal(document.querySelector('#personalActivity [data-del]'),null,'the deleted row leaves the rendered feed without waiting on GET');
    assert.equal(document.querySelector('#confirmModal').classList.contains('open'),false,'the confirmation closes without waiting on GET');
  })()`;
  await vm.runInNewContext(`${source}\n${deleteChecks}`, deleteContext, {filename: 'index.html'});
});

test('a blocked export says so instead of failing silently', async () => {
  // The real document only needs an anchor-download seam layered over it.
  const makeExportContext = ({clickThrows = false, blobThrows = false} = {}) => {
    const dom = sharedDom();
    const revoked = [];
    const anchors = [];
    const blobs = [];
    const createElement = dom.document.createElement.bind(dom.document);
    dom.document.createElement = tag => {
      const el = createElement(tag);
      if (tag === 'a') el.click = () => {if (clickThrows) throw Error('downloads are blocked'); anchors.push({href: el.href, download: el.download})};
      return el;
    };
    return {
      revoked, anchors, blobs,
      context: {
        assert, console, URL: Object.assign(function () {}, URL, {
          createObjectURL: () => 'blob:road-to-send/1',
          revokeObjectURL: value => revoked.push(value),
        }),
        URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
        location: {search: '', href: 'https://example.test/app/', hash: ''},
        history: {replaceState() {}},
        window: dom.window,
        Blob: function (parts) {if (blobThrows) throw Error('Blob is not available here'); this.parts = parts; blobs.push(String(parts[0]))},
        document: dom.document,
        fetch: async () => {throw Error('this harness makes no network calls')},
        localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
        setTimeout() {}, clearTimeout() {},
      },
    };
  };

  const now = new Date();
  const todayFilename = `road-to-send-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;

  const good = makeExportContext();
  await vm.runInNewContext(`${source}\nstate.endpoint='https://sheet.example.test/exec';state.logs=[{id:'literal',name:'=Alex <crew>',type:'exercise',date:'2026-07-13',createdAt:'1',note:'岩 🧗 <b>& two  spaces'}];exportData();`, good.context, {filename: 'index.html'});
  assert.equal(good.context.document.querySelector('#toast').textContent, 'Export downloaded.', 'a working export reports success');
  assert.deepEqual(good.anchors, [{href: 'blob:road-to-send/1', download: todayFilename}], 'and the download really fired, named for challengeToday()');
  assert.deepEqual(good.revoked, ['blob:road-to-send/1'], 'the object URL is revoked on the success path');
  const exported = JSON.parse(good.blobs[0]);
  assert.deepEqual({name: exported.activities[0].name, note: exported.activities[0].note}, {name: '=Alex <crew>', note: '岩 🧗 <b>& two  spaces'}, 'shared-cache export preserves literal text exactly');

  const blockedClick = makeExportContext({clickThrows: true});
  await vm.runInNewContext(`${source}\nexportData();`, blockedClick.context, {filename: 'index.html'});
  assert.equal(blockedClick.context.document.querySelector('#toast').textContent, 'Export failed — try a different browser.', 'a blocked download is reported, not swallowed');
  assert.deepEqual(blockedClick.revoked, ['blob:road-to-send/1'], 'and the object URL is revoked on the failure path too');

  const blockedBlob = makeExportContext({blobThrows: true});
  await vm.runInNewContext(`${source}\nexportData();`, blockedBlob.context, {filename: 'index.html'});
  assert.equal(blockedBlob.context.document.querySelector('#toast').textContent, 'Export failed — try a different browser.', 'a restricted context that cannot even build the Blob is reported the same way');
  assert.deepEqual(blockedBlob.revoked, [], 'with nothing to revoke, nothing is revoked');
});

test('opening a dialog moves focus into it, and only the backdrop closes it', async () => {
  const dom = sharedDom();
  const focusContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    document: dom.document,
    innerNode: () => dom.document.querySelector('#confirmOk'),
    theModal: () => dom.document.querySelector('#confirmModal'),
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    setTimeout() {}, clearTimeout() {},
  };
  const focusChecks = `(()=>{
    openModal('confirmModal');
    assert.equal(document.querySelector('#confirmModal').classList.contains('open'),true,'the dialog opened');
    assert.equal(document.activeElement.id,'confirmClose','focus lands on the dialog first focusable element, not on the destructive one');
    // A click inside the dialog is not a dismissal.
    closeIfScrim({target:innerNode()},'confirmModal');
    assert.equal(document.querySelector('#confirmModal').classList.contains('open'),true,'a click on something inside the dialog leaves it open');
    // A click on the backdrop itself is.
    closeIfScrim({target:theModal()},'confirmModal');
    assert.equal(document.querySelector('#confirmModal').classList.contains('open'),false,'a click on the backdrop closes it');
    closeIfScrim({target:theModal()},'confirmModal');
    assert.equal(document.querySelector('#confirmModal').classList.contains('open'),false,'and closing an already-closed dialog is harmless');
  })()`;
  await vm.runInNewContext(`${source}\n${focusChecks}`, focusContext, {filename: 'index.html'});
});

test('the share sheet is tried first, and a dismissed one is not a failure', async () => {
  const dayShift = n => {const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`};
  const makeShareContext = share => {
    const dom = sharedDom();
    const written = [];
    const shared = [];
    const navigator = {clipboard: {writeText: value => {written.push(String(value)); return Promise.resolve()}}};
    if (share) navigator.share = payload => {shared.push(payload); return share()};
    return {
      written, shared,
      context: {
        assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
        location: {search: '', href: 'https://example.test/app/?sheet=https%3A%2F%2Fsheet.example.test%2Fexec#you', hash: '#you'},
        history: {replaceState() {}},
        window: dom.window,
        navigator,
        document: dom.document,
        fetch: async () => {throw Error('this harness makes no network calls')},
        localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
        setTimeout() {}, clearTimeout() {},
      },
    };
  };
  const setup = `state.me='Alex';state.recordingFor='Alex';state.endpoint='';state.config={startDate:'${dayShift(-5)}',tripDate:'${dayShift(5)}',goal:500,crew:[{name:'Alex'}]};state.logs=[{id:'x1',name:'Alex',type:'climb',date:'${dayShift(-1)}',createdAt:'1'}];`;
  const abort = () => {const error = Error('user dismissed the sheet'); error.name = 'AbortError'; return Promise.reject(error)};

  const native = makeShareContext(() => Promise.resolve());
  await vm.runInNewContext(`${source}\n(async()=>{${setup}await shareProgress()})()`, native.context, {filename: 'index.html'});
  assert.equal(native.shared.length, 1, 'a working share sheet is used');
  assert.equal(native.written.length, 0, 'and nothing reaches the clipboard behind it');
  assert.ok(native.shared[0].text.indexOf('Alex') >= 0, 'the shared payload is the summary text');
  assert.equal(native.shared[0].text.indexOf('sheet='), -1, 'and it still excludes the crew endpoint');

  const noShare = makeShareContext(null);
  await vm.runInNewContext(`${source}\n(async()=>{${setup}await shareProgress()})()`, noShare.context, {filename: 'index.html'});
  assert.equal(noShare.written.length, 1, 'with no share sheet at all, the clipboard fallback runs');
  assert.equal(noShare.context.document.querySelector('#toast').textContent, 'Progress copied — paste it anywhere.', 'and says so');

  const dismissed = makeShareContext(abort);
  await vm.runInNewContext(`${source}\n(async()=>{${setup}await shareProgress()})()`, dismissed.context, {filename: 'index.html'});
  assert.equal(dismissed.shared.length, 1, 'the sheet was opened');
  assert.equal(dismissed.written.length, 0, 'a dismissed sheet is a completed action: nothing is copied');
  assert.equal(dismissed.context.document.querySelector('#toast').textContent, '', 'and nothing is said -- no error toast, no second prompt');

  const broken = makeShareContext(() => Promise.reject(Error('share is not allowed here')));
  await vm.runInNewContext(`${source}\n(async()=>{${setup}await shareProgress()})()`, broken.context, {filename: 'index.html'});
  assert.equal(broken.written.length, 1, 'a genuine share failure falls back to the clipboard');
  assert.equal(broken.context.document.querySelector('#toast').textContent, 'Progress copied — paste it anywhere.', 'and reports the copy');
});

test('literal-text rollout holds sensitive fields before sending and preserves supported payloads', async () => {
  const calls = [];
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    fetch: async (url, options) => {calls.push(JSON.parse(options.body)); return {ok: true};},
    setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{
    const send=body=>fetchShared('https://sheet.example.test/exec',{method:'POST',body:JSON.stringify(body)});
    state.protocolFeatures=[];
    await assert.rejects(send({name:'Alex',note:'=1+1'}),/Note.*Apps Script/);
    await assert.rejects(send({action:'addParticipant',name:'+Alex'}),/Name.*Apps Script/);
    await assert.rejects(send({action:'saveConfig',config:{crew:[{name:'@Alex'}]}}),/Name.*Apps Script/);
    await send({name:'Alex',note:'ordinary text'});
    state.literalEndpoint='https://sheet.example.test/exec';
    await assert.rejects(fetchShared('https://other.example.test/exec',{method:'POST',body:JSON.stringify({name:'=Alex'})}),/Name.*Apps Script/);
    for(const prefix of ['=','+','-','@',String.fromCharCode(39)])await send({name:prefix+'Alex',note:prefix+'  <text> 雪'});
  })()`, context, {filename: 'index.html'});
  assert.equal(calls.length, 6, 'held fields never reach an older backend');
  assert.equal(calls[1].note, '=  <text> 雪');
  assert.equal(calls[5].name, "'Alex");
});


test('failed endpoint verification cannot lend safe-retry capability to another crew', async () => {
  const dom = sharedDom();
  const posts = [];
  const context = {
    assert, URL, URLSearchParams, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''}, history: {replaceState() {}}, window: dom.window, document: dom.document,
    fetch: async (url, options = {}) => {if (options.method) posts.push(JSON.parse(options.body)); throw Error('response unavailable')},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}}, setTimeout() {}, clearTimeout() {},
  };
  await vm.runInNewContext(`${source}\n(async()=>{
    await Promise.resolve();
    state.endpoint='https://older.example.test/exec';
    state.protocolEndpoint='https://newer.example.test/exec';
    state.protocolFeatures=['idempotent-activity-v1'];
    state.config={startDate:'2026-09-09',tripDate:'2026-09-09',goal:500,crew:[{name:'Alex'}]};
    state.me='Alex';state.recordingFor='Alex';
    document.querySelector('#activityDate').value='2026-09-09';
    await loadRemote();
    await submitActivity({preventDefault(){}});
    assert.equal(state.pendingActivity,null,'an unverified endpoint cannot create a safe-retry command');
    assert.ok(document.querySelector('#toast').textContent.includes('Check Crew before retrying'));
    assert.equal(document.querySelector('#toast').textContent.includes('same activity ID'),false);
  })()`, context, {filename: 'index.html'});
  assert.equal(posts.length, 1);
  assert.equal(posts[0].mutationId, undefined);
});

test('a fresh snapshot retires the temporary acknowledged activity overlay', () => {
  const context = {assert};
  vm.runInNewContext(`${source}\nconst endpoint='https://sheet.example.test/exec';const row={id:'saved-row',name:'Alex',type:'climb',points:3,date:'2026-09-09'};authoritativeActivities(endpoint).set('mutation',row);assert.equal(reconcileRemoteActivities(endpoint,[row]).length,1);assert.equal(reconcileRemoteActivities(endpoint,[]).length,0,'a subsequent authoritative deletion is allowed to remove the row');`, context);
});

test('a fresh read may omit a saved activity deleted before its first refresh', () => {
  const context = {assert};
  vm.runInNewContext(`${source}\nconst endpoint='https://sheet.example.test/exec';authoritativeActivities(endpoint).set('mutation',{id:'saved-then-deleted'});assert.equal(reconcileRemoteActivities(endpoint,[]).length,0,'fresh server state owns deletion even before the saved row was observed');`, context);
});

test('setup retries preserve uncertain command identity until a conflict explicitly permits reapply', async () => {
  const dom = sharedDom(), store = new Map(), posts = [], responses = [];
  const context = {
    assert, URL, URLSearchParams, console, posts, responses,
    window: dom.window, document: dom.document,
    location: {search: '', href: 'https://example.test/', hash: ''}, history: {replaceState() {}},
    localStorage: {getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
    fetch: async (url, options) => {posts.push(JSON.parse(options.body)); const next = responses.shift(); if (next instanceof Error) throw next; return {ok: true, json: async () => next}},
  };
  await vm.runInNewContext(`${source}\n(async()=>{
    const url='https://sheet.example.test/exec', draft={startDate:'2026-07-01',tripDate:'2026-12-01',goal:500,crew:[{name:'Alex'}]}, current={...draft,crew:[{name:'Alex'},{name:'Maya'}]};
    state.endpoint=url;state.protocolEndpoint=url;state.protocolFeatures=['config-journal-v1','config-revision-v1'];state.configRevision=1;state.config=draft;state.me='Alex';
    document.querySelector('#endpoint').value=url;
    readSetupConfig=()=>draft;loadRemote=async()=>true;copyCrewLink=async()=>true;
    responses.push(new Error('lost response'));await saveSetup();
    const original=posts[0].configCommandId;
    state.configRevision=2;
    responses.push({ok:true,configCommandId:original,config:draft,configRevision:2,version:17});await saveSetup();
    assert.equal(posts[1].configCommandId,original,'observing a newer revision cannot replace an uncertain command');
    assert.equal(posts[1].expectedConfigRevision,1,'retry retains its original precondition');
    assert.equal(storedConfigCommand(url),null);
    responses.push({ok:false,error:{code:'config_conflict'},config:current,configRevision:3});await saveSetup();
    const rejected=storedConfigCommand(url);
    assert.equal(rejected.conflictRevision,3,'the authoritative rejection is retained across reload');
    assert.ok(document.querySelector('#configConflictDetails').innerHTML.includes('Maya'),'the committed roster is visible beside the retained draft');
    state.configConflict=null;state.configRevision=3;
    responses.push(new Error('lost reapply response'));await saveSetup();
    assert.notEqual(posts[3].configCommandId,rejected.id,'explicit save after a confirmed conflict uses a new command');
    assert.equal(posts[3].expectedConfigRevision,3);
  })()`, context);
});
