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
  assert.equal(new URL(calls[0].url).searchParams.get('protocolVersion'), '13');
  assert.equal(new URL(calls[1].url).searchParams.get('protocolVersion'), '13');
  assert.equal(JSON.parse(calls[1].options.body).protocolVersion, 13);
  assert.equal(JSON.parse(calls[1].options.body).id, 'a1', 'negotiation preserves the request payload');
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
    assert.equal(JSON.stringify(postedActions()),JSON.stringify([{action:'delete',id:'srv-delete-1',protocolVersion:13}]),'confirmation posts the exact shared row id with protocol negotiation');
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
    const createElement = dom.document.createElement.bind(dom.document);
    dom.document.createElement = tag => {
      const el = createElement(tag);
      if (tag === 'a') el.click = () => {if (clickThrows) throw Error('downloads are blocked'); anchors.push({href: el.href, download: el.download})};
      return el;
    };
    return {
      revoked, anchors,
      context: {
        assert, console, URL: Object.assign(function () {}, URL, {
          createObjectURL: () => 'blob:road-to-send/1',
          revokeObjectURL: value => revoked.push(value),
        }),
        URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
        location: {search: '', href: 'https://example.test/app/', hash: ''},
        history: {replaceState() {}},
        window: dom.window,
        Blob: function (parts) {if (blobThrows) throw Error('Blob is not available here'); this.parts = parts},
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
  await vm.runInNewContext(`${source}\nexportData();`, good.context, {filename: 'index.html'});
  assert.equal(good.context.document.querySelector('#toast').textContent, 'Export downloaded.', 'a working export reports success');
  assert.deepEqual(good.anchors, [{href: 'blob:road-to-send/1', download: todayFilename}], 'and the download really fired, named for challengeToday()');
  assert.deepEqual(good.revoked, ['blob:road-to-send/1'], 'the object URL is revoked on the success path');

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
