// Shared-mode harnesses with a stubbed fetch: background sync, setup, clipboard, storage,
// export, dialog focus and the share sheet. Unlike the other two client-state suites these are
// real async test() blocks, each building its own context.
//
// TRAP — each case uses a fresh happy-dom page so mutations cannot leak between asynchronous
// cases. Close each page after its case: happy-dom retains page tasks otherwise, exhausting
// the heap as coverage grows. Assertions inside a `checks` literal may contain no backtick and no `${`.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {test, afterEach} = require('node:test');
const {source, createDom} = require('./harness.js');

const sharedWindows=new Set();
afterEach(async()=>{await Promise.all([...sharedWindows].map(window=>window.happyDOM.close()));sharedWindows.clear()});
function sharedDom() {
  const window = createDom();
  sharedWindows.add(window);
  return {window, document: window.document, fire: type => window.document.dispatchEvent(new window.Event(type, {bubbles: true}))};
}

test('background sync respects the open date picker and refreshes the board on tab return', async () => {
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

    // Returning to the tab checks fresh JSON before any replay, even with a fresh cache.
    const before=countGets();
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before+1,'a fresh cache is still checked on tab return');
    state.lastSyncedAt=Date.now()-6*60*1000;
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before+2,'a stale cache also refreshes on tab return');
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

// Entry 55: testConnection()'s outdated-board message used to hard-code "deploy v11", which
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
    assert.equal(document.querySelector('#testResult').textContent,'Outdated board — update it to v'+expectedVersion,'the outdated-board message names the version this build expects, not a hard-coded literal');
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

test('a full disk never reports a saved entry as failed, and never traps the identity dialog', async () => {
  const dom = sharedDom();
  const store = new Map();
  const today = new Date().toISOString().slice(0, 10);
  const storageContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: dom.window,
    document: dom.document,
    // Safari private mode and an exhausted quota both throw here. Reads still work, which is why
    // safeJson() was never the problem — every write in the app was the unguarded half.
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: () => {throw Error('QuotaExceededError')}, removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const storageChecks = `(async()=>{
    state.endpoint='';
    state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};
    state.logs=[];state.me='';state.recordingFor='';
    document.querySelector('#identityMember').innerHTML='<option value="Alex">Alex</option>';
    document.querySelector('#identityMember').value='Alex';
    document.querySelector('#identityModal').classList.add('open');
    saveIdentity();
    assert.equal(state.me,'Alex','a failed write still records the identity in memory');
    assert.equal(document.querySelector('#identityModal').classList.contains('open'),false,'and the dialog closes instead of trapping the user behind an uncaught throw');
    document.querySelector('#activityDate').value='${today}';
    await submitActivity({preventDefault(){}});
    assert.equal(state.logs.length,1,'the entry is in the log either way, so it must not be reported as lost');
    assert.equal(document.querySelector('#toast').textContent,'Saved on this device only — storage is full.','the toast names the real failure instead of claiming the save failed');
    assert.equal(document.querySelector('#saveActivityBtn').textContent,'Save activity','and the button is handed back');
  })()`;
  await vm.runInNewContext(`${source}\n${storageChecks}`, storageContext, {filename: 'index.html'});
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
    for(let i=0;i<20;i++)await Promise.resolve();
    assert.equal(JSON.stringify(postedActions()),JSON.stringify([{action:'delete',id:'srv-delete-1'}]),'confirmation posts the exact shared row id');
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

// Protocol v13: a backend that answers with movedTo is followed, once per page load.
const OLD_URL = 'https://old.example.test/exec';
const NEW_URL = 'https://new.example.test/fn';
async function movedScenario({endpoint = OLD_URL, search = '', hash = '', seed = {}, extra = {}, backends, checks}) {
  const dom = sharedDom();
  const store = new Map(Object.entries(seed));
  if (endpoint) store.set('roadToSendEndpoint', endpoint);
  if (!store.has('roadToSendMe')) store.set('roadToSendMe', 'Alex');
  const fetched = [];
  const replaced = [];
  const pageLocation = {search, href: 'https://example.test/app/' + search + hash, hash};
  const board = version => ({version, features: [], activities: [{id: 'a1', name: 'Alex', type: 'exercise', date: '2026-07-13', createdAt: '1'}], config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: '2026-07-13', timeZone: 'UTC'});
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: pageLocation,
    history: {replaceState: (state, title, url) => {
      replaced.push(url);
      const page = new URL(url, pageLocation.href);
      Object.assign(pageLocation, {href: page.toString(), search: page.search, hash: page.hash});
    }},
    window: dom.window, document: dom.document,
    store: {get: key => store.get(key), keys: () => [...store.keys()].sort()},
    fetched: () => fetched, replaced: () => replaced,
    fetch: async (url, options = {}) => {
      const base = String(url).split('?')[0];
      const method = options.method || 'GET';
      fetched.push(method + ' ' + base);
      const handler = backends[base];
      return {ok: true, json: async () => handler(method, options.body ? JSON.parse(options.body) : null, board)};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
    ...extra,
  };
  await vm.runInNewContext(`${source}\n(async()=>{${checks}\n})()`, context, {filename: 'index.html'});
}
const movedReply = (to = NEW_URL) => ({version: 13, ok: false, error: {code: 'moved', message: 'The crew board has moved. Try again.', details: []}, movedTo: to});
const settle = 'for(let i=0;i<20;i++)await Promise.resolve();';

test('loading shared mode keeps the resolved endpoint in the URL and preserves other params and the hash', async () => {
  for (const search of ['', '?keep=1', '?sheet=' + encodeURIComponent(OLD_URL) + '&keep=1']) {
    await movedScenario({
      search, hash: '#crew',
      seed: {roadToSendMoves: JSON.stringify({[OLD_URL]: NEW_URL})},
      backends: {[NEW_URL]: (m, b, board) => board(13)},
      checks: `
        ${settle}
        const page=new URL(location.href);
        assert.equal(page.searchParams.get('sheet'),'${NEW_URL}');
        assert.equal(page.searchParams.get('keep'),${search ? "'1'" : 'null'});
        assert.equal(page.hash,'#crew');
      `,
    });
  }
});

test('local mode removes an empty sheet param and preserves other params and the hash', async () => {
  await movedScenario({endpoint: '', search: '?sheet=&keep=1', hash: '#crew', backends: {}, checks: `
    assert.equal(state.endpoint,'');
    const page=new URL(location.href);
    assert.equal(page.searchParams.has('sheet'),false);
    assert.equal(page.searchParams.get('keep'),'1');
    assert.equal(page.hash,'#crew');
    assert.equal(fetched().length,0);
  `});
});

test('successful setup keeps its endpoint in the URL while rejected setup keeps the current board URL', async () => {
  for (const accepted of [true, false]) {
    await movedScenario({search: '?keep=1', hash: '#crew', backends: {
      [OLD_URL]: (m, b, board) => board(13),
      [NEW_URL]: (m, b, board) => m === 'POST'
        ? accepted ? {ok: true, config: b.config} : {ok: false, error: {message: 'Setup rejected.'}}
        : board(13),
    }, checks: `
      ${settle}
      populateSetup();document.querySelector('#endpoint').value='${NEW_URL}';
      await saveSetup();
      const page=new URL(location.href);
      assert.equal(page.searchParams.get('sheet'),'${accepted ? NEW_URL : OLD_URL}');
      assert.equal(page.searchParams.get('keep'),'1');
      assert.equal(page.hash,'#crew');
    `});
  }
});

test('confirming local mode removes sheet from the URL while opening confirmation keeps it', async () => {
  await movedScenario({search: '?sheet=' + encodeURIComponent(OLD_URL) + '&keep=1', hash: '#crew',
    backends: {[OLD_URL]: (m, b, board) => board(13)}, checks: `
      ${settle}
      disconnect();
      assert.equal(new URL(location.href).searchParams.get('sheet'),'${OLD_URL}');
      confirmProceed();
      const page=new URL(location.href);
      assert.equal(page.searchParams.has('sheet'),false);
      assert.equal(page.searchParams.get('keep'),'1');
      assert.equal(page.hash,'#crew');
      assert.equal(state.endpoint,'');
    `,
  });
});

test('blocked URL replacement does not prevent loading the shared board or switching to local mode', async () => {
  await movedScenario({extra: {history: {replaceState(state, title, url) {if (!url.startsWith('#')) throw Error('History unavailable')}}},
    backends: {[OLD_URL]: (m, b, board) => board(13)}, checks: `
      ${settle}
      assert.equal(state.syncState,'live');
      performDisconnect();
      assert.equal(state.endpoint,'');
    `,
  });
});

test('a Home Screen launch URL loads the shared board with empty storage and asks for identity again', async () => {
  await movedScenario({endpoint: '', search: '?sheet=' + encodeURIComponent(NEW_URL) + '&keep=1', hash: '#crew',
    seed: {roadToSendMe: ''}, backends: {[NEW_URL]: (m, b, board) => board(13)}, checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(store.get('roadToSendEndpoint'),'${NEW_URL}');
      assert.equal(state.syncState,'live');
      assert.equal(state.me,'');
      assert.equal(document.querySelector('#identityModal').classList.contains('open'),true);
      assert.equal(new URL(location.href).searchParams.get('keep'),'1');
      assert.equal(new URL(location.href).hash,'#crew');
    `,
  });
});

test('a GET carrying movedTo adopts the new endpoint, caches there, keeps the old cache and rewrites the sheet param', async () => {
  let releaseDestination;
  await movedScenario({
    extra: {releaseDestination: () => releaseDestination()},
    search: '?sheet=' + encodeURIComponent(OLD_URL) + '&keep=1',
    seed: {['roadToSendShared:activities:' + encodeURIComponent(OLD_URL)]: '[]'},
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => new Promise(resolve => {releaseDestination = () => resolve(board(13))}),
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(store.get('roadToSendEndpoint'),'${NEW_URL}','the stored endpoint follows the move');
      assert.equal(store.get('roadToSendMoves'),undefined,'the pending destination GET has not recorded the move');
      assert.equal(state.syncState,'loading');
      releaseDestination();
      ${settle}
      assert.equal(JSON.parse(store.get('roadToSendMoves'))['${OLD_URL}'],'${NEW_URL}','the followed move is remembered');
      for(const kind of ['activities','config','meta'])assert.notEqual(store.get(cacheKey(kind,'${NEW_URL}')),undefined,kind+' is cached under the new endpoint');
      assert.equal(store.get(cacheKey('activities','${OLD_URL}')),'[]','the old activities cache is byte-for-byte unchanged');
      assert.equal(store.keys().filter(k=>k.endsWith(':'+encodeURIComponent('${OLD_URL}'))).length,1,'no other old endpoint cache key is created');
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${OLD_URL}','GET ${NEW_URL}']),'the next fetch goes to the new URL');
      const rewritten=new URL(replaced().filter(u=>u[0]!=='#').at(-1));
      assert.equal(rewritten.searchParams.get('sheet'),'${NEW_URL}','the sheet param is rewritten');
      assert.equal(rewritten.searchParams.get('keep'),'1','other params are left alone');
      assert.equal(state.syncState,'live');
      assert.equal(state.logs.length,1);
    `,
  });
});

test('adopting a move from a bare URL keeps the destination in the address bar', async () => {
  await movedScenario({
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(12), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => board(13),
    },
    checks: `
      ${settle}
      assert.equal(new URL(location.href).searchParams.get('sheet'),'${NEW_URL}','a bare URL keeps the moved board for Home Screen launches');
      assert.equal(state.endpoint,'${NEW_URL}','a v12 payload carrying movedTo is followed too');
    `,
  });
});

test('every POST that answers moved shows the server message and adopts the new endpoint', async () => {
  const today = '2026-07-13';
  const config = `state.config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};`;
  const cases = {
    submit: `${config}state.logs=[];state.me='Alex';state.recordingFor='Alex';document.querySelector('#activityDate').value='${today}';await submitActivity({preventDefault(){}});`,
    create: `${config}document.querySelector('#newParticipantName').value='Maya';await createProfile();`,
    remove: `${config}state.logs=[{id:'a1',name:'Alex',type:'exercise',date:'${today}',createdAt:'1'}];state.pendingDelete={entry:state.logs[0],index:0,id:'a1',feed:'personal',position:0};await performDelete();`,
    setup: `${config}populateSetup();document.querySelector('#endpoint').value='${OLD_URL}';await saveSetup();`,
  };
  for (const [name, action] of Object.entries(cases)) {
    await movedScenario({
      search: '?sheet=' + encodeURIComponent(OLD_URL),
      backends: {
        [OLD_URL]: (method, body, board) => method === 'POST' ? movedReply() : board(13),
        [NEW_URL]: (method, body, board) => board(13),
      },
      checks: `
        ${settle}
        state.endpoint='${OLD_URL}';
        const before=fetched().length;
        ${action}${settle}
        assert.equal(state.endpoint,'${NEW_URL}','${name}: adopts the new endpoint');
        assert.equal(store.get('roadToSendEndpoint'),'${NEW_URL}','${name}: stores it');
        const shown=[document.querySelector('#toast').textContent,document.querySelector('#setupErrors').textContent,document.querySelector('#createProfileError').textContent].join('|');
        assert.equal(shown.indexOf('The crew board has moved. Try again.')>=0,true,'${name}: shows the server message, got '+shown);
        assert.equal(fetched().slice(before).filter(x=>x.startsWith('POST')).length,1,'${name}: the write is not retried automatically');
        assert.equal(fetched().slice(before).includes('GET ${NEW_URL}'),true,'${name}: reloads from the new URL');
      `,
    });
  }
});

test('a late POST move rejection does not remember a move for a different connected endpoint', async () => {
  const otherUrl = 'https://other.example.test/fn';
  let releasePost;
  await movedScenario({
    extra: {releasePost: () => releasePost()},
    backends: {
      [OLD_URL]: (method, body, board) => method === 'POST'
        ? new Promise(resolve => {releasePost = () => resolve(movedReply())})
        : board(13),
      [NEW_URL]: (method, body, board) => board(13),
    },
    checks: `
      ${settle}
      state.pendingDelete={entry:state.logs[0],index:0,id:'a1',feed:'personal',position:0};
      const deletion=performDelete();
      ${settle}
      assert.equal(fetched().includes('POST ${OLD_URL}'),true,'the pending POST was sent to the original endpoint');
      state.endpoint='${otherUrl}';
      writeStore('roadToSendEndpoint',state.endpoint);
      releasePost();
      await deletion;
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}','the rejection still follows the move');
      assert.equal(state.syncState,'live','the destination served a supported board');
      assert.equal(fetched().includes('GET ${NEW_URL}'),true);
      const moves=JSON.parse(store.get('roadToSendMoves')||'{}');
      assert.equal(Object.hasOwn(moves,'${otherUrl}'),false,'the newly connected endpoint never answered with this move');
    `,
  });
});

test('setup at a different URL adopts its move without remembering a move for either origin', async () => {
  const setupUrl = 'https://setup.example.test/exec';
  await movedScenario({
    backends: {
      [OLD_URL]: (method, body, board) => board(13),
      [setupUrl]: () => movedReply(),
      [NEW_URL]: (method, body, board) => board(13),
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${OLD_URL}');
      populateSetup();
      document.querySelector('#endpoint').value='${setupUrl}';
      await saveSetup();
      ${settle}
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${OLD_URL}','POST ${setupUrl}','GET ${NEW_URL}']));
      assert.equal(state.endpoint,'${NEW_URL}','the move is still adopted');
      assert.equal(state.syncState,'live','the destination served a supported board');
      const moves=JSON.parse(store.get('roadToSendMoves')||'{}');
      assert.equal(Object.hasOwn(moves,'${OLD_URL}'),false,'the connected endpoint never answered with this move');
      assert.equal(Object.hasOwn(moves,'${setupUrl}'),false,'the setup URL was never the connected endpoint');
    `,
  });
});

test('a move is followed at most once per page load, so A to B to A stops after one hop', async () => {
  await movedScenario({
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => Object.assign(board(13), {movedTo: OLD_URL}),
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}','the browser stays on B');
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${OLD_URL}','GET ${NEW_URL}']),'exactly one hop');
      assert.equal(state.syncState,'live');
    `,
  });
});

test('movedTo that is not https, is not a URL, or equals the current endpoint is ignored', async () => {
  for (const bad of ['http://new.example.test/fn', 'ftp://new.example.test', 'not a url', OLD_URL, '', 42, null, {href: NEW_URL}]) {
    await movedScenario({
      backends: {[OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: bad})},
      checks: `
        ${settle}
        assert.equal(state.endpoint,'${OLD_URL}');
        assert.equal(store.get('roadToSendEndpoint'),'${OLD_URL}');
        assert.equal(fetched().length,1);
        assert.equal(state.syncState,'live');
      `,
    });
  }
});

test('local mode never looks at movedTo', async () => {
  await movedScenario({
    endpoint: '',
    backends: {
      [OLD_URL]: (m, b, board) => m === 'POST' ? movedReply() : Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => board(13),
    },
    checks: `
      ${settle}
      assert.equal(state.syncState,'local','the page booted in local mode');
      state.config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
      populateSetup();document.querySelector('#endpoint').value='';
      await saveSetup();${settle}
      assert.equal(store.get('roadToSendEndpoint'),undefined,'saving local setup leaves the endpoint unset');
      assert.equal(followMove('${NEW_URL}'),false,'no endpoint means no adoption');
      followRejectedMove(${JSON.stringify(movedReply())});
      await loadRemote();${settle}
      assert.equal(state.endpoint,'');
      assert.equal(store.get('roadToSendEndpoint'),undefined);
      assert.equal(fetched().length,0);
    `,
  });
});

test('both v12 and v13 payloads load', async () => {
  for (const version of [12, 13]) {
    await movedScenario({
      backends: {[OLD_URL]: (m, b, board) => board(version)},
      checks: `
        ${settle}
        assert.equal(state.syncState,'live');
        assert.equal(state.protocolVersion,${version});
        assert.equal(state.logs.length,1);
      `,
    });
  }
});

test('a v13 sheet answering movedTo is followed to the destination board', async () => {
  await movedScenario({
    backends: {[OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}), [NEW_URL]: (m, b, board) => board(13)},
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(state.syncState,'live');
      assert.equal(state.logs.length,1);
    `,
  });
});

test('a redirector answering an unsupported version with movedTo is still followed', async () => {
  await movedScenario({
    backends: {[OLD_URL]: (m, b, board) => Object.assign(board(99), {movedTo: NEW_URL}), [NEW_URL]: (m, b, board) => board(13)},
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(state.syncState,'live');
      assert.equal(state.protocolVersion,13);
      assert.equal(store.get(cacheKey('activities','${OLD_URL}')),undefined,'nothing from the redirector is cached');
    `,
  });
});

test('an unsupported version without movedTo keeps the version error state', async () => {
  await movedScenario({
    backends: {[OLD_URL]: (m, b, board) => board(99)},
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${OLD_URL}');
      assert.equal(state.syncState,'error');
      assert.equal(state.syncErrorCode,'RTS-REFRESH-VERSION');
    `,
  });
});

test('a non-OK destination GET does not remember the followed move', async () => {
  const fetched = [];
  await movedScenario({
    backends: {},
    extra: {fetch: async url => {
      const base = String(url).split('?')[0];
      fetched.push(base);
      return base === OLD_URL
        ? {ok: true, json: async () => ({movedTo: NEW_URL})}
        : {ok: false, json: async () => {throw new Error('non-OK body must not be read')}};
    }, fetched: () => fetched},
    checks: `
      ${settle}
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['${OLD_URL}','${NEW_URL}']));
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(state.syncErrorCode,'RTS-REFRESH-NETWORK');
      assert.equal(store.get('roadToSendMoves'),undefined,'a non-OK destination does not record the move');
    `,
  });
});

test('a failed destination fetch leaves an existing destination cache untouched', async () => {
  const seed = {};
  for (const kind of ['activities', 'config', 'meta']) seed['roadToSendShared:' + kind + ':' + encodeURIComponent(NEW_URL)] = '"keep-' + kind + '"';
  await movedScenario({
    seed,
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: () => {throw new Error('offline')},
    },
    checks: `
      ${settle}
      for(const kind of ['activities','config','meta'])assert.equal(store.get(cacheKey(kind,'${NEW_URL}')),'"keep-'+kind+'"',kind+' destination cache is unchanged');
      for(const kind of ['activities','config','meta'])assert.equal(store.get(cacheKey(kind,'${OLD_URL}')),undefined,kind+' old cache is not written');
      assert.notEqual(state.syncState,'live');
      assert.equal(store.get('roadToSendMoves'),undefined,'a failed destination does not record the move');
    `,
  });
});

test('an unsupported response carrying movedTo after the hop was used is a version error with nothing cached', async () => {
  await movedScenario({
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => Object.assign(board(99), {movedTo: OLD_URL}),
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(state.syncErrorCode,'RTS-REFRESH-VERSION');
      assert.notEqual(state.syncState,'live');
      assert.equal(store.get('roadToSendMoves'),undefined,'a failed destination does not record the move');
      assert.equal(store.keys().filter(k=>k.indexOf('roadToSendShared:')===0).length,0,'nothing is cached');
    `,
  });
});

test('testConnection on an unsupported response with movedTo is not connected and names the destination', async () => {
  await movedScenario({
    backends: {[OLD_URL]: (m, b, board) => Object.assign(board(99), {movedTo: NEW_URL})},
    checks: `
      ${settle}
      document.querySelector('#endpoint').value='${OLD_URL}';
      const ok=await testConnection();
      const text=document.querySelector('#testResult').textContent;
      assert.equal(ok,false);
      assert.equal(text.indexOf('Connected'),-1);
      assert.ok(text.indexOf('${NEW_URL}')>=0,'names the destination, got '+text);
    `,
  });
});

test('testConnection on a supported v13 redirector with movedTo is not connected and names the destination', async () => {
  await movedScenario({
    backends: {[OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL})},
    checks: `
      ${settle}
      document.querySelector('#endpoint').value='${OLD_URL}';
      const ok=await testConnection();
      const text=document.querySelector('#testResult').textContent;
      assert.equal(ok,false);
      assert.equal(text.indexOf('Connected'),-1);
      assert.ok(text.indexOf('${NEW_URL}')>=0,'names the destination, got '+text);
    `,
  });
});

test('a superseded response carrying movedTo is dropped without a redirect or cache write', async () => {
  const waiting = [];
  let calls = 0;
  await movedScenario({
    search: '?sheet=' + encodeURIComponent(OLD_URL),
    extra: {release: (i, payload) => waiting[i](payload)},
    backends: {
      [OLD_URL]: (m, b, board) => ++calls === 1 ? board(13) : new Promise(resolve => waiting.push(resolve)),
      [NEW_URL]: (m, b, board) => board(13),
    },
    checks: `
      ${settle}
      const older=loadRemote(),newer=loadRemote();
      ${settle}
      release(1,Object.assign({version:13,features:[],activities:[],config:state.config,configErrors:[],serverDate:'2026-07-13',timeZone:'UTC'}));
      await newer;
      const snapshot=JSON.stringify(store.keys().map(k=>[k,store.get(k)]));
      const replacedBefore=replaced().length;
      release(0,Object.assign({version:13,features:[],activities:[{id:'z',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'9'}],config:state.config,configErrors:[],serverDate:'2026-07-13',timeZone:'UTC'},{movedTo:'${NEW_URL}'}));
      assert.equal(await older,false);
      assert.equal(state.endpoint,'${OLD_URL}','no redirect');
      assert.equal(store.get('roadToSendEndpoint'),'${OLD_URL}','stored endpoint unchanged');
      assert.equal(replaced().length,replacedBefore,'address bar unchanged');
      assert.equal(JSON.stringify(store.keys().map(k=>[k,store.get(k)])),snapshot,'no cache write');
      assert.equal(fetched().includes('GET ${NEW_URL}'),false);
    `,
  });
});

// A move adopts the destination's own cache: the page shows it while the destination is unreachable,
// and the old endpoint's board is never written under the destination's keys.
const OLD_CACHE = {
  activities: [{id: 'o1', name: 'Alex', type: 'exercise', date: '2026-07-10', createdAt: '1'}],
  config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]},
  meta: {lastSyncedAt: 1000, protocolVersion: 13, serverDate: '2026-07-10', timeZone: 'UTC'},
};
const DEST_CACHE = {
  activities: [{id: 'd1', name: 'Alex', type: 'climb', date: '2026-07-12', createdAt: '2'}, {id: 'd2', name: 'Maya', type: 'mobility', date: '2026-07-12', createdAt: '3'}],
  config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 700, crew: [{name: 'Alex'}, {name: 'Maya'}]},
  meta: {lastSyncedAt: 2000, protocolVersion: 13, serverDate: '2026-07-12', timeZone: 'America/Los_Angeles'},
};
function cacheSeed(url, cache) {
  return Object.fromEntries(Object.entries(cache).map(([kind, value]) => ['roadToSendShared:' + kind + ':' + encodeURIComponent(url), JSON.stringify(value)]));
}
const showsDestinationCache = `
  assert.equal(JSON.stringify(state.logs.map(x=>x.id)),'["d1","d2"]','shows the destination cache');
  assert.equal(state.config.goal,700);
  assert.equal(state.config.crew.map(x=>x.name).join(),'Alex,Maya');
  assert.equal(state.challengeTimeZone,'America/Los_Angeles');
  assert.equal(state.lastSyncedAt,2000);
  assert.equal(state.syncState,'stale');
  assert.equal(document.querySelector('#groupGoal').textContent,'700','the destination cache is rendered');
  assert.equal(store.get('roadToSendMe'),'Alex','the climber is remembered');
  for(const kind of ['activities','config','meta'])assert.equal(store.get(cacheKey(kind,'${NEW_URL}')),JSON.stringify(${JSON.stringify(DEST_CACHE)}[kind]),kind+' destination cache is unchanged');
`;

test('a GET move whose destination is unreachable shows the destination cache, not the old board', async () => {
  await movedScenario({
    seed: {...cacheSeed(OLD_URL, OLD_CACHE), ...cacheSeed(NEW_URL, DEST_CACHE)},
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: () => { throw new Error('offline'); },
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      ${showsDestinationCache}
    `,
  });
});

test('a write rejected as moved never caches the old board under the destination and shows the destination cache', async () => {
  let gets = 0;
  await movedScenario({
    seed: {...cacheSeed(OLD_URL, OLD_CACHE), ...cacheSeed(NEW_URL, DEST_CACHE)},
    backends: {
      // The page loaded before the organizer set movedTo, so the first GET carries no move.
      [OLD_URL]: (m, b, board) => m === 'POST' ? movedReply() : (gets++, board(13)),
      [NEW_URL]: () => { throw new Error('offline'); },
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${OLD_URL}');
      state.pendingDelete={entry:state.logs[0],index:0,id:'a1',feed:'personal',position:0};
      await performDelete();
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(fetched().includes('GET ${NEW_URL}'),true,'the destination is fetched');
      ${showsDestinationCache}
    `,
  });
  assert.equal(gets, 1);
});

test('a move to a destination without a cache keeps the shown board and the climber until it answers', async () => {
  await movedScenario({
    seed: cacheSeed(OLD_URL, OLD_CACHE),
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: () => { throw new Error('offline'); },
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(state.logs.map(x=>x.id).join(),'o1','still shows the board it had');
      assert.equal(store.get('roadToSendMe'),'Alex','an empty default crew never makes render() forget the climber');
      assert.equal(store.keys().filter(k=>k.indexOf(encodeURIComponent('${NEW_URL}'))>=0).length,0,'nothing is cached for the destination');
    `,
  });
});

test('a move adopts a partial destination cache, drops the old setup errors, and survives a throwing cache probe', async () => {
  const partial = cacheSeed(NEW_URL, {config: DEST_CACHE.config});
  await movedScenario({
    seed: {...cacheSeed(OLD_URL, OLD_CACHE), ...partial},
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: () => { throw new Error('offline'); },
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(state.config.goal,700,'a config-only destination cache is adopted');
      assert.equal(state.logs.length,0,'with no cached activities of its own');
    `,
  });
  await movedScenario({
    seed: {...cacheSeed(OLD_URL, OLD_CACHE), ...cacheSeed(NEW_URL, DEST_CACHE)},
    backends: {
      [OLD_URL]: (m, b, board) => m === 'POST' ? movedReply() : board(13),
      [NEW_URL]: () => { throw new Error('offline'); },
    },
    checks: `
      ${settle}
      state.configErrors={goal:'Old board goal is invalid.'};
      followRejectedMove(${JSON.stringify(movedReply())});
      ${settle}
      assert.equal(Object.keys(state.configErrors).length,0,'the old board setup errors are dropped');
      assert.equal(document.querySelector('#configNotice').classList.contains('hide'),true);
    `,
  });
  await movedScenario({
    seed: cacheSeed(OLD_URL, OLD_CACHE),
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => board(13),
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(fetched().includes('GET ${NEW_URL}'),true,'the destination is still fetched');
      assert.equal(state.syncState,'live');
    `,
    // Storage that refuses to read the destination's keys: the cache probe throws, the move goes on.
    extra: {localStorage: {
      getItem: key => { if (key.includes(encodeURIComponent(NEW_URL))) throw new Error('denied'); return {roadToSendEndpoint: OLD_URL, roadToSendMe: 'Alex'}[key] ?? null; },
      setItem() {}, removeItem() {},
    }},
  });
});


test('an old crew link with a remembered move fetches only the destination and renders its cache while pending', async () => {
  let release;
  await movedScenario({
    search: '?sheet=' + encodeURIComponent(OLD_URL) + '&keep=1',
    seed: {roadToSendMoves: JSON.stringify({[OLD_URL]: NEW_URL}), ...cacheSeed(OLD_URL, OLD_CACHE), ...cacheSeed(NEW_URL, DEST_CACHE)},
    extra: {finish: () => release()},
    backends: {[NEW_URL]: (m, b, board) => new Promise(resolve => {release = () => resolve(board(13));})},
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(store.get('roadToSendEndpoint'),'${NEW_URL}');
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${NEW_URL}']));
      const rewritten=new URL(replaced().filter(u=>u[0]!=='#').at(-1));
      assert.equal(rewritten.searchParams.get('sheet'),'${NEW_URL}');
      assert.equal(rewritten.searchParams.get('keep'),'1');
      assert.equal(JSON.stringify(state.logs.map(x=>x.id)),'["d1","d2"]');
      assert.equal(state.config.goal,700);
      assert.equal(document.querySelector('#groupGoal').textContent,'700','the destination cache is rendered before the response');
      for(const kind of ['activities','config','meta'])assert.equal(store.get(cacheKey(kind,'${NEW_URL}')),JSON.stringify(${JSON.stringify(DEST_CACHE)}[kind]));
      finish();${settle}
      assert.equal(state.syncState,'live');
    `,
  });
});

test('a remembered move from the stored endpoint fetches only the destination without rewriting the address bar', async () => {
  await movedScenario({
    seed: {roadToSendMoves: JSON.stringify({[OLD_URL]: NEW_URL})},
    backends: {[NEW_URL]: (m, b, board) => board(13)},
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(store.get('roadToSendEndpoint'),'${NEW_URL}');
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${NEW_URL}']));
      assert.equal(new URL(location.href).searchParams.get('sheet'),'${NEW_URL}','the remembered destination is kept for Home Screen launches');
    `,
  });
});

test('remembered move chains stop at the destination, before repeats, and after five hops', async () => {
  const mid = 'https://mid.example.test/fn';
  const chain = Array.from({length: 7}, (_, i) => 'https://chain' + i + '.example.test/fn');
  const cases = [
    {moves: {[OLD_URL]: mid, [mid]: NEW_URL}, destination: NEW_URL},
    {moves: {[OLD_URL]: NEW_URL, [NEW_URL]: OLD_URL}, destination: NEW_URL},
    {moves: {[OLD_URL]: OLD_URL}, destination: OLD_URL},
    {moves: Object.fromEntries([OLD_URL, ...chain].slice(0, -1).map((url, i) => [url, chain[i]])), destination: chain[4]},
  ];
  for (const {moves, destination} of cases) {
    await movedScenario({
      search: '?sheet=' + encodeURIComponent(OLD_URL),
      seed: {roadToSendMoves: JSON.stringify(moves)},
      backends: {[destination]: (m, b, board) => board(13)},
      checks: `
        ${settle}
        assert.equal(state.endpoint,'${destination}');
        assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${destination}']));
        assert.equal(store.get('roadToSendMoves'),${JSON.stringify(JSON.stringify(moves))},'resolution does not change the move record');
      `,
    });
  }
});

test('malformed and invalid remembered moves leave the old crew link and live follow working', async () => {
  const invalid = ['{bad', 'null', '[]', '"url"', '42', JSON.stringify({[OLD_URL]: 'http://new.example.test/fn'}), JSON.stringify({[OLD_URL]: 'not a URL'}), JSON.stringify({[OLD_URL]: 7}), JSON.stringify({'http://old.example.test/exec': NEW_URL})];
  for (const moves of invalid) {
    await movedScenario({
      search: '?sheet=' + encodeURIComponent(OLD_URL),
      seed: {roadToSendMoves: moves},
      backends: {[OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}), [NEW_URL]: (m, b, board) => board(13)},
      checks: `
        ${settle}
        assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${OLD_URL}','GET ${NEW_URL}']));
        assert.equal(state.endpoint,'${NEW_URL}');
        assert.equal(state.syncState,'live');
        assert.equal(JSON.parse(store.get('roadToSendMoves'))['${OLD_URL}'],'${NEW_URL}');
      `,
    });
  }
});

test('a remembered move keeps the origin cache and saved climber while an uncached destination is pending and after failure', async () => {
  let reject;
  await movedScenario({
    search: '?sheet=' + encodeURIComponent(OLD_URL),
    seed: {roadToSendMoves: JSON.stringify({[OLD_URL]: NEW_URL}), ...cacheSeed(OLD_URL, OLD_CACHE)},
    extra: {fail: () => reject(new Error('offline'))},
    backends: {[NEW_URL]: () => new Promise((resolve, fail) => {reject = fail;})},
    checks: `
      ${settle}
      const check=()=>{
        assert.equal(state.endpoint,'${NEW_URL}');
        assert.equal(store.get('roadToSendEndpoint'),'${NEW_URL}');
        assert.equal(state.me,'Alex');
        assert.equal(store.get('roadToSendMe'),'Alex');
        assert.equal(state.logs[0].id,'o1');
        assert.equal(state.config.crew[0].name,'Alex');
        assert.equal(document.querySelector('#groupGoal').textContent,'500');
        assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${NEW_URL}']));
        for(const kind of ['activities','config','meta']){
          assert.equal(store.get(cacheKey(kind,'${OLD_URL}')),JSON.stringify(${JSON.stringify(OLD_CACHE)}[kind]),'origin cache is unchanged');
          assert.equal(store.get(cacheKey(kind,'${NEW_URL}')),undefined,'destination cache is not written');
        }
      };
      check();
      assert.equal(state.syncState,'loading');
      fail();${settle}
      assert.equal(state.syncState,'stale');
      assert.equal(state.syncErrorCode,'RTS-REFRESH-NETWORK');
      render();check();
    `,
  });
});

test('a remembered resolution leaves one live move available from the adopted destination', async () => {
  const finalUrl = 'https://final.example.test/fn';
  await movedScenario({
    search: '?sheet=' + encodeURIComponent(OLD_URL),
    seed: {roadToSendMoves: JSON.stringify({[OLD_URL]: NEW_URL})},
    backends: {[NEW_URL]: (m, b, board) => Object.assign(board(13), {movedTo: finalUrl}), [finalUrl]: (m, b, board) => Object.assign(board(13), {movedTo: OLD_URL})},
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${finalUrl}');
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${NEW_URL}','GET ${finalUrl}']));
      assert.equal(JSON.parse(store.get('roadToSendMoves'))['${NEW_URL}'],'${finalUrl}');
      assert.equal(state.syncState,'live');
    `,
  });
});

test('recording a followed move retains only the ten most recent valid origins', async () => {
  const entries = Array.from({length: 10}, (_, i) => ['https://previous' + i + '.example.test/fn', NEW_URL]);
  entries.splice(4, 0, [OLD_URL, 'https://outdated.example.test/fn']);
  await movedScenario({
    seed: {roadToSendMoves: JSON.stringify(Object.fromEntries(entries))},
    endpoint: NEW_URL,
    backends: {[NEW_URL]: (m, b, board) => board(13)},
    checks: `
      ${settle}
      state.endpoint='${OLD_URL}';
      assert.equal(followMove('${NEW_URL}'),true);
      assert.equal(store.get('roadToSendMoves'),${JSON.stringify(JSON.stringify(Object.fromEntries(entries)))},'adoption leaves the record unchanged');
      assert.equal(await loadRemote(),true);
      const moves=Object.entries(JSON.parse(store.get('roadToSendMoves')));
      assert.equal(moves.length,10);
      assert.equal(moves[0][0],'https://previous1.example.test/fn','the oldest origin was evicted');
      assert.equal(moves[9][0],'${OLD_URL}','a repeated origin becomes the most recent');
      assert.equal(moves[9][1],'${NEW_URL}');
    `,
  });
});

test('saving setup at a remembered origin removes only that origin and old crew links reach it again', async () => {
  const other = 'https://other.example.test/fn';
  await movedScenario({
    seed: {roadToSendMoves: JSON.stringify({[OLD_URL]: NEW_URL, [other]: NEW_URL})},
    backends: {
      [NEW_URL]: (method, body, board) => board(13),
      [OLD_URL]: (method, body, board) => method === 'POST' ? {ok: true, config: body.config} : board(13),
    },
    checks: `
      await loadRemote();
      populateSetup();document.querySelector('#endpoint').value='${OLD_URL}';
      await saveSetup();
      const moves=JSON.parse(store.get('roadToSendMoves'));
      assert.equal(Object.hasOwn(moves,'${OLD_URL}'),false,'the deliberately saved origin is forgotten');
      assert.equal(moves['${other}'],'${NEW_URL}','unrelated moves stay remembered');
      assert.equal(state.endpoint,'${OLD_URL}');
      assert.equal(resolveMove('${OLD_URL}'),'${OLD_URL}','an old crew link will reach the saved URL on its next load');
      assert.ok(fetched().includes('POST ${OLD_URL}'));
      assert.ok(fetched().includes('GET ${OLD_URL}'));
    `,
  });
});

test('a failed setup save keeps remembered moves', async () => {
  const moves = JSON.stringify({[OLD_URL]: NEW_URL});
  await movedScenario({
    seed: {roadToSendMoves: moves},
    backends: {[NEW_URL]: (method, body, board) => board(13), [OLD_URL]: () => ({ok: false, error: {message: 'Setup rejected.'}})},
    checks: `
      await loadRemote();populateSetup();document.querySelector('#endpoint').value='${OLD_URL}';
      await saveSetup();
      assert.equal(store.get('roadToSendMoves'),${JSON.stringify(moves)});
      assert.equal(document.querySelector('#setupErrors').textContent,'Setup rejected.');
    `,
  });
});

test('confirming local mode clears all remembered moves and a pending move', async () => {
  for (const moves of [JSON.stringify({[OLD_URL]: NEW_URL}), 'broken JSON']) {
    await movedScenario({
      seed: {roadToSendMoves: moves},
      backends: {[OLD_URL]: (method, body, board) => board(13), [NEW_URL]: (method, body, board) => board(13)},
      checks: `
        await loadRemote();pendingMove={from:'${OLD_URL}',to:'${NEW_URL}'};
        disconnect();
        assert.ok(store.get('roadToSendMoves'),'opening the confirmation keeps the record');
        confirmProceed();
        assert.equal(store.get('roadToSendMoves'),undefined,'confirming removes the whole key');
        assert.equal(pendingMove,null,'a pending adoption cannot remember the move again');
        assert.equal(state.endpoint,'');
        assert.equal(resolveMove('${OLD_URL}'),'${OLD_URL}');
      `,
    });
  }
});

// Real aborts with a short test deadline; the watchdog makes a missing timeout fail promptly.
async function timeoutScenario({signalApi = AbortSignal, checks, bodyStalls = false, callerSignal, fetchImpl, extra = {}}) {
  const dom = sharedDom();
  const store = new Map();
  let aborts = 0;
  const stall = signal => new Promise((resolve, reject) => {
    const watchdog = setTimeout(() => reject(Error('Timeout did not abort the request')), 500);
    const abort = () => {aborts++; clearTimeout(watchdog); reject(signal.reason || Error('aborted'))};
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, {once: true});
  });
  const context = {
    assert, console, URL, URLSearchParams, AbortSignal: signalApi, AbortController, callerSignal,
    window: dom.window, document: dom.document,
    location: {search: '', href: 'https://example.test/', hash: ''}, history: {replaceState() {}},
    localStorage: {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    // Only the abort fallback needs a real timer; toast dismissal is irrelevant to these checks.
    setTimeout: (fn, ms) => ms === 10 ? setTimeout(fn, ms) : undefined, clearTimeout,
    abortedCount: () => aborts,
    fetch: fetchImpl ? (url, options) => fetchImpl(url, options, stall) : ((url, options) => bodyStalls ? Promise.resolve({ok: true, json: () => stall(options.signal)}) : stall(options.signal)),
    ...extra,
  };
  assert.ok(source.includes('const SHARED_REQUEST_TIMEOUT_MS = 15000;'),'the shipped deadline is 15 seconds');
  const shortSource = source.replace('const SHARED_REQUEST_TIMEOUT_MS = 15000;', 'const SHARED_REQUEST_TIMEOUT_MS = 10;');
  await vm.runInNewContext(`${shortSource}\n(async()=>{${checks}})()`, context);
}

const saveDraftChecks = `
  state.endpoint='https://board.example.test/fn';state.me='Alex';state.recordingFor='Alex';
  state.config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
  state.serverDate='2026-07-13';state.challengeTimeZone='';state.lastSyncedAt=Date.now();state.logs=[];
  setDefaultRecordDate();
  document.querySelector('input[name="activityType"][value="bounty"]').checked=true;
  populateBountySelect();document.querySelector('#bountySelect').value=dailyBounties(challengeToday())[0].id;
  document.querySelector('#activityNote').value='Keep this draft';
`;

test('an unconfirmed activity save refreshes the board without holding the button or clearing the draft', async () => {
  for (const failure of ['timeout', 'body timeout', 'network', 'unreadable body']) {
    let gets = 0, posts = 0, completeRefresh, savedPost;
    await timeoutScenario({
      extra: {getCount: () => gets, postCount: () => posts, completeRefresh: () => completeRefresh()},
      fetchImpl: (url, options, stall) => {
        if (options.method === 'POST') {
          posts++;
          savedPost = JSON.parse(options.body);
          if (failure === 'timeout') return stall(options.signal);
          if (failure === 'network') return Promise.reject(Error('Connection lost'));
          return Promise.resolve({ok: true, json: () => failure === 'body timeout'
            ? stall(options.signal) : Promise.reject(SyntaxError('Unreadable response'))});
        }
        gets++;
        return new Promise(resolve => {completeRefresh = () => resolve({ok: true, json: async () => ({
          version: 13, activities: [{id: 'saved-remotely', name: 'Alex', type: 'bounty',
            bountyId: savedPost.bountyId, date: '2026-07-13', createdAt: '1'}],
          config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]},
          configErrors: [], serverDate: '2026-07-13', timeZone: '',
        })})});
      },
      checks: `${saveDraftChecks}
        const bountyId=document.querySelector('#bountySelect').value;
        await submitActivity({preventDefault(){}});
        assert.equal(document.querySelector('#toast').textContent,'Could not confirm the save — refreshing the board. Check your feed before saving again.');
        assert.equal(getCount(),1,'one reconciliation GET is sent');
        assert.equal(postCount(),1,'the save is never automatically reposted');
        assert.equal(state.syncState,'loading','the reconciliation GET is still pending');
        assert.equal(state.saving,false);
        assert.equal(document.querySelector('#saveActivityBtn').disabled,false);
        assert.equal(document.querySelector('#saveActivityBtn').textContent,'Save activity');
        assert.equal(document.querySelector('#activityNote').value,'Keep this draft');
        assert.equal(document.querySelector('#bountySelect').value,bountyId);
        assert.equal(state.logs.length,0,'the unconfirmed save does not create a local row');
        completeRefresh();${settle}
        assert.equal(state.logs.length,1,'the refresh discovers the server-committed entry');
        assert.equal(state.logs[0].id,'saved-remotely');
        assert.equal(document.querySelector('#saveActivityBtn').disabled,true,'the reconciled bounty cannot be claimed again');
      `,
    });
  }
});

test('explicit activity save rejections keep safe retry copy and send no reconciliation GET', async () => {
  for (const httpRejected of [true, false]) {
    let gets = 0, posts = 0;
    await timeoutScenario({
      extra: {getCount: () => gets, postCount: () => posts},
      fetchImpl: async (url, options) => {
        if (options.method !== 'POST') {gets++; throw Error('Unexpected refresh')}
        posts++;
        return {ok: !httpRejected, json: async () => {
          assert.equal(httpRejected,false,'a rejected HTTP response needs no readable body');
          return {ok: false, error: {message: 'The shared board rejected this entry.'}};
        }};
      },
      checks: `${saveDraftChecks}
        await submitActivity({preventDefault(){}});
        assert.equal(document.querySelector('#toast').textContent,'Save failed—${httpRejected ? 'Request failed.' : 'The shared board rejected this entry.'} It is safe to retry.');
        assert.equal(getCount(),0);
        assert.equal(postCount(),1);
        assert.equal(state.saving,false);
        assert.equal(document.querySelector('#saveActivityBtn').disabled,false);
        assert.equal(document.querySelector('#activityNote').value,'Keep this draft');
        assert.equal(state.logs.length,0);
      `,
    });
  }
});

test('stalled shared requests use network failures and restore every busy control after timeout', async () => {
  for (const signalApi of [AbortSignal, { /* timeout unavailable */ }]) {
    await timeoutScenario({signalApi, checks: `
      state.endpoint='https://board.example.test/fn';state.me='Alex';state.recordingFor='Alex';
      state.config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
      state.serverDate='2026-07-13';state.challengeTimeZone='UTC';
      state.logs=[{id:'keep',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'1'}];
      setDefaultRecordDate();
      assert.equal(await loadRemote(),false);
      assert.equal(state.syncState,'error');
      assert.equal(state.syncErrorCode,'RTS-REFRESH-NETWORK');
      assert.equal(state.syncDetail,'Could not reach the shared board');
      assert.equal(document.querySelector('#syncStatus').textContent,'Sync failed · retry ↻');
      document.querySelector('input[name="activityType"][value="climb"]').checked=true;
      const saving=submitActivity({preventDefault(){}});
      assert.equal(state.saving,true);assert.equal(document.querySelector('#saveActivityBtn').textContent,'Saving…');
      await saving;
      assert.equal(state.saving,false);
      assert.equal(document.querySelector('#saveActivityBtn').disabled,false);
      assert.equal(document.querySelector('#saveActivityBtn').textContent,'Save activity');
      assert.notEqual(document.querySelector('#creditPreview').textContent,'Saving…');
      assert.equal(document.querySelector('#toast').textContent,'Could not confirm the save — refreshing the board. Check your feed before saving again.');
      assert.equal(state.logs.length,1,'a timed-out save does not add a local row');
      state.pendingDelete={entry:state.logs[0],id:'keep',feed:'personal',position:0};
      await performDelete();
      assert.equal(state.logs.length,1,'a timed-out delete keeps the entry');
      assert.match(document.querySelector('#toast').textContent,/Delete failed.*Could not reach the shared board/);
      document.querySelector('#newParticipantName').value='Maya';
      await createProfile();
      assert.equal(document.querySelector('#createProfile').disabled,false);
      assert.equal(document.querySelector('#createProfile').textContent,'Create my profile');
      assert.equal(document.querySelector('#createProfileError').textContent,'Could not reach the shared board.');
      populateSetup();document.querySelector('#endpoint').value=state.endpoint;
      assert.equal(await testConnection(),false);
      assert.equal(document.querySelector('#testResult').textContent,'Connection failed');
      const setupSaving=saveSetup();
      assert.equal(document.querySelector('#saveSetupBtn').textContent,'Saving…');
      await setupSaving;
      assert.equal(document.querySelector('#saveSetupBtn').disabled,false);
      assert.equal(document.querySelector('#saveSetupBtn').textContent,'Save centrally & copy crew link');
      assert.equal(document.querySelector('#setupErrors').textContent,'Could not reach the shared board.');
      assert.equal(abortedCount(),7,'each shared operation and the uncertain-save refresh was aborted');
    `});
  }
});

test('the request deadline also covers stalled JSON bodies', async () => {
  for (const signalApi of [AbortSignal, {}]) {
    await timeoutScenario({signalApi, bodyStalls: true, checks: `
      state.endpoint='https://board.example.test/fn';
      assert.equal(await loadRemote(),false);
      assert.equal(state.syncErrorCode,'RTS-REFRESH-NETWORK');
      assert.equal(abortedCount(),1);
      assert.equal(state.syncDetail,'Could not reach the shared board');
    `});
  }
});

test('caller cancellation is combined with the deadline and retained on browsers without signal composition', async () => {
  const controller = new AbortController();
  controller.abort(Error('Caller cancelled'));
  await timeoutScenario({callerSignal: controller.signal, checks: `
    await assert.rejects(fetchShared('https://board.example.test/fn',{signal:callerSignal}),/Caller cancelled/);
    assert.equal(abortedCount(),1);
  `});
  // A non-aborted caller still gets a timeout when AbortSignal.any is available.
  await timeoutScenario({callerSignal: new AbortController().signal, checks: `
    await assert.rejects(fetchShared('https://board.example.test/fn',{signal:callerSignal}),/Could not reach the shared board/);
    assert.equal(callerSignal.aborted,false,'the timeout never aborts the caller controller');
  `});
  for (const signalApi of [{timeout: ms => AbortSignal.timeout(ms)}, {}]) {
    await timeoutScenario({signalApi, callerSignal: controller.signal, fetchImpl: async (url, options) => {
      assert.equal(options.signal, controller.signal,'older browsers retain the caller signal');
      throw options.signal.reason;
    }, checks: `await assert.rejects(fetchShared('https://board.example.test/fn',{signal:callerSignal}),/Caller cancelled/);`});
  }
});

const v14DraftChecks = `
  state.endpoint='https://board.example.test/fn';state.protocolVersion=14;state.outboxConfirmedEndpoint=state.endpoint;state.me='Alex';state.recordingFor='Alex';
  state.config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
  state.serverDate='2026-07-13';state.challengeTimeZone='';state.lastSyncedAt=Date.now();state.logs=[];
  document.querySelector('#hardestGrade').innerHTML='<option value="">None</option><option value="V4">V4</option>';
  setDefaultRecordDate();document.querySelector('input[name="activityType"][value="climb"]').checked=true;
  document.querySelector('#activityNote').value='Keep this draft';
`;
const v14Entry = {id:'00000000-0000-4000-8000-000000000014',name:'Alex',type:'climb',category:'climb',points:3,date:'2026-07-13',createdAt:'2026-07-13T01:00:00.000Z',hardestGrade:'V4',bountyId:'',bountyTitle:'',note:'Original'};
const v14Board = activities => ({version:14,features:[],activities,config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]},configErrors:[],serverDate:'2026-07-13',timeZone:''});

test('a timed-out create queues the UUID and flushes the same request on retry', async () => {
  const posts=[];
  await timeoutScenario({
    extra:{posted:()=>posts},
    fetchImpl:(url,options,stall)=>{
      if(options.method==='POST') {
        const body=JSON.parse(options.body);posts.push(body);
        if(posts.length===1) return stall(options.signal);
        return Promise.resolve({ok:true,json:async()=>({...v14Entry,...body,ok:true})});
      }
      return Promise.resolve({ok:true,json:async()=>v14Board(posts.length<2?[]:[{...v14Entry,...posts[1]}])});
    },
    checks:`${v14DraftChecks}
      await submitActivity({preventDefault(){}});${settle}
      assert.equal(state.logs.length,1,'the pending entry appears immediately');
      assert.equal(outboxItems()[0].body.id,posted()[0].id);
      assert.match(posted()[0].id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.equal(document.querySelector('#activityNote').value,'');
      await flushOutbox();${settle}
      assert.equal(outboxItems().length,0);
      assert.equal(posted().length,2);assert.equal(posted()[1].id,posted()[0].id);
      assert.equal(state.logs.length,1);assert.equal(state.logs[0].id,posted()[0].id);
      assert.equal(document.querySelector('#activityNote').value,'');
    `,
  });
});

test('creates keep a UUID at v13 because the older function ignores unknown create fields', async () => {
  for (const version of [12,13,14]) {
    const posts=[];let saved;
    await timeoutScenario({
      extra:{posted:()=>posts},
      fetchImpl:async(url,options)=>{
        if(options.method==='POST') {
          const body=JSON.parse(options.body);posts.push(body);
          saved={...v14Entry,...body,id:version>=14?body.id:'server-minted',createdAt:v14Entry.createdAt};
          return {ok:true,json:async()=>({...saved,version,ok:true})};
        }
        return {ok:true,json:async()=>({...v14Board(saved?[saved]:[]),version})};
      },
      checks:`${v14DraftChecks}
        state.protocolVersion=${version};await submitActivity({preventDefault(){}});${settle}
        assert.match(posted()[0].id,/^[0-9a-f-]{36}$/);
        assert.equal(state.logs.length,1);
        assert.equal(state.logs[0].id,${version}>=14?posted()[0].id:'server-minted');
      `,
    });
  }
});

test('an edit updates the shared feed scores and persisted cache while preserving identity and order', async () => {
  const posts=[];let saved=v14Entry,finish;const cache=new Map();
  await timeoutScenario({
    extra:{posted:()=>posts,cache,finish:()=>finish(),localStorage:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,String(value)),removeItem:key=>cache.delete(key)}},
    fetchImpl:async(url,options)=>{
      if(options.method==='POST') {
        const body=JSON.parse(options.body);posts.push(body);
        saved={...v14Entry,...body,type:body.type,category:body.type,points:1,hardestGrade:''};
        delete saved.action;
        return {ok:true,json:async()=>({...saved,version:14,ok:true})};
      }
      return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>v14Board([saved])})});
    },
    checks:`${v14DraftChecks}
      state.logs=${JSON.stringify([v14Entry])};render();
      assert.equal(Number(document.querySelector('#youTotal').textContent),3);
      const trigger=document.querySelector('#personalActivity [data-edit]');trigger.focus();openEdit(0,trigger);
      assert.equal(document.querySelector('#activityNote').value,'Original');
      assert.equal(document.querySelector('#hardestGrade').value,'V4');
      document.querySelector('input[name="activityType"][value="mobility"]').checked=true;
      document.querySelector('#activityNote').value='Edited activity';updateRecordPreview();
      await submitActivity({preventDefault(){}});${settle}
      assert.equal(posted().length,1);assert.equal(posted()[0].action,'update');assert.equal(posted()[0].id,'${v14Entry.id}');
      assert.equal(state.logs.length,1);assert.equal(state.logs[0].createdAt,'${v14Entry.createdAt}');
      assert.equal(state.logs[0].name,'Alex');assert.equal(state.logs[0].type,'mobility');
      assert.equal(Number(document.querySelector('#youTotal').textContent),1);
      assert.ok(document.querySelector('#personalActivity').textContent.includes('Edited activity'));
      const cached=JSON.parse(cache.get(cacheKey('activities')));
      assert.equal(cached[0].id,'${v14Entry.id}');assert.equal(cached[0].note,'Edited activity');
      assert.equal(document.querySelector('#editModal').classList.contains('open'),false);
      assert.equal(document.querySelector('#recordForm').parentElement.id,'recordFormHome');
      assert.equal(document.activeElement.dataset.id,'${v14Entry.id}','focus returns to the refreshed row');
      assert.equal(document.querySelector('#activityNote').value,'Keep this draft','the create draft is restored');
      assert.equal(state.syncState,'loading','the write is already rendered and cached before GET completes');
      finish();${settle}
      assert.equal(document.activeElement.dataset.id,'${v14Entry.id}','background refresh preserves row focus');
    `,
  });
});

test('an edit timeout reconciles the committed update and preserves the edit draft', async () => {
  let posts=0,gets=0,finish;
  await timeoutScenario({
    extra:{postCount:()=>posts,getCount:()=>gets,finish:()=>finish()},
    fetchImpl:(url,options,stall)=>{
      if(options.method==='POST'){posts++;assert.equal(JSON.parse(options.body).action,'update');return stall(options.signal)}
      gets++;return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>v14Board([{...v14Entry,type:'exercise',category:'exercise',points:2,hardestGrade:'',note:'Updated remotely'}])})});
    },
    checks:`${v14DraftChecks}
      state.logs=${JSON.stringify([v14Entry])};render();openEdit(0,document.querySelector('#personalActivity [data-edit]'));
      document.querySelector('input[name="activityType"][value="exercise"]').checked=true;
      document.querySelector('#activityNote').value='Updated remotely';updateRecordPreview();
      await submitActivity({preventDefault(){}});
      assert.equal(postCount(),1);assert.equal(getCount(),1);assert.equal(outboxItems().length,0,'edits remain online-only');
      assert.equal(document.querySelector('#toast').textContent,'Could not confirm the save — refreshing the board. Check your feed before saving again.');
      assert.equal(state.saving,false);assert.equal(document.querySelector('#saveActivityBtn').textContent,'Save changes');
      assert.equal(state.logs[0].type,'climb','no optimistic edit before confirmation');
      assert.equal(document.querySelector('#editModal').classList.contains('open'),true);
      assert.equal(document.querySelector('#activityNote').value,'Updated remotely');
      finish();${settle}
      assert.equal(state.logs.length,1);assert.equal(state.logs[0].id,'${v14Entry.id}');assert.equal(state.logs[0].type,'exercise');
      assert.equal(Number(document.querySelector('#youTotal').textContent),2);
      assert.equal(document.querySelector('#activityNote').value,'Updated remotely');
      closeModal('editModal');
      assert.equal(document.activeElement.dataset.id,'${v14Entry.id}','Escape/close can return to a row replaced by reconciliation');
    `,
  });
});

test('duplicate_bounty on create and edit shows clear copy without adding or changing a row', async () => {
  for (const editing of [false,true]) {
    let posts=0,gets=0;
    await timeoutScenario({
      extra:{postCount:()=>posts,getCount:()=>gets},
      fetchImpl:async(url,options)=>{
        if(options.method==='POST'){posts++;return {ok:true,json:async()=>({ok:false,error:{code:'duplicate_bounty',message:'Server technical text'}})}}
        gets++;throw Error('Unexpected reconciliation');
      },
      checks:`${v14DraftChecks}
        state.logs=${JSON.stringify(editing?[v14Entry]:[])};render();
        ${editing?"openEdit(0,document.querySelector('#personalActivity [data-edit]'));":''}
        const original=JSON.stringify(state.logs);
        document.querySelector('input[name="activityType"][value="bounty"]').checked=true;
        populateBountySelect();document.querySelector('#bountySelect').value=dailyBounties(recordDate())[0].id;
        await submitActivity({preventDefault(){}});
        assert.equal(document.querySelector('#toast').textContent,'That bounty is already claimed on that date.');
        assert.equal(postCount(),1);assert.equal(getCount(),0);assert.equal(JSON.stringify(state.logs),original);
        assert.equal(document.querySelector('#activityNote').value,${JSON.stringify(editing?'Original':'Keep this draft')});
      `,
    });
  }
});

const outboxBody = (id, note = id) => ({id, name:'Alex', type:'climb', date:'2026-07-13', hardestGrade:'', note, bountyId:''});
const outboxIds = [1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);

test('queued and in-flight creates hide feed actions until replay settles after refresh confirmation', async () => {
  const row={...v14Entry,...outboxBody(outboxIds[0])};let finishPost;
  await timeoutScenario({extra:{finishPost:()=>finishPost()},fetchImpl:(url,options)=>{
    if(options.method!=='POST')return Promise.resolve({ok:true,json:async()=>v14Board([row])});
    return new Promise(resolve=>{finishPost=()=>resolve({ok:true,json:async()=>({...row,ok:true})})});
  },checks:`${v14DraftChecks}
    enqueueCreate(state.endpoint,${JSON.stringify(outboxBody(outboxIds[0]))});
    state.logs=[${JSON.stringify(row)}];render();
    assert.equal(document.querySelectorAll('#personalActivity .activity').length,1);
    assert.equal(document.querySelector('#personalActivity [data-del],[data-edit]'),null,'a queued id has no actions even on a server row');
    const sending=flushOutbox();await loadRemote();
    assert.equal(outboxItems().length,0,'the fresh server id acknowledges the queue');
    assert.equal(state.logs[0].outboxEndpoint,undefined);
    assert.equal(document.querySelector('#personalActivity [data-del],[data-edit]'),null,'refresh confirmation cannot expose actions during the POST');
    finishPost();await sending;
    assert.equal(outboxItems().length,0);
    assert.ok(document.querySelector('#personalActivity [data-del]'),'delete returns when replay settles');
    assert.ok(document.querySelector('#personalActivity [data-edit]'),'edit returns when replay settles');
  `});
});

test('a late create timeout cannot enqueue an id already confirmed by a fresh board', async () => {
  let body,posts=0;
  await timeoutScenario({extra:{posted:()=>posts},fetchImpl:(url,options,stall)=>{
    if(options.method==='POST'){posts++;body=JSON.parse(options.body);return stall(options.signal)}
    return Promise.resolve({ok:true,json:async()=>v14Board([{...v14Entry,...body}])});
  },checks:`${v14DraftChecks}
    const saving=submitActivity({preventDefault(){}});await loadRemote();
    const id=state.logs[0].id;assert.equal(state.logs[0].outboxEndpoint,undefined);
    await saving;
    assert.equal(outboxItems().length,0,'the late timeout does not queue the confirmed create');
    assert.equal(state.logs.length,1);assert.equal(state.logs[0].id,id);
    await flushOutbox();assert.equal(posted(),1,'the confirmed create is never replayed');
  `});
});

test('replay hands off to a freshly confirmed endpoint after the old endpoint POST settles', async () => {
  const posts=[];let finishPost;
  await timeoutScenario({extra:{posted:()=>posts,finishPost:()=>finishPost()},fetchImpl:(url,options)=>{
    if(options.method!=='POST')return Promise.resolve({ok:true,json:async()=>v14Board([])});
    const body=JSON.parse(options.body);posts.push({endpoint:new URL(url).origin,body});
    if(posts.length===1)return new Promise(resolve=>{finishPost=()=>resolve({ok:true,json:async()=>({...v14Entry,...body,ok:true})})});
    return Promise.resolve({ok:true,json:async()=>({...v14Entry,...body,ok:true})});
  },checks:`${v14DraftChecks}
    const first=state.endpoint,second='https://other.example.test/fn';
    enqueueCreate(first,${JSON.stringify(outboxBody(outboxIds[0]))});enqueueCreate(second,${JSON.stringify(outboxBody(outboxIds[1]))});
    const sending=flushOutbox();state.endpoint=second;state.logs=[];
    await loadRemote();assert.equal(state.outboxConfirmedEndpoint,second);
    assert.equal(posted().length,1,'the new endpoint waits for the existing sender');
    finishPost();await sending;${settle}
    assert.equal(posted().length,2,'the new endpoint queue resumes without another event');
    assert.equal(posted()[1].endpoint,'https://other.example.test');assert.equal(posted()[1].body.id,'${outboxIds[1]}');
    assert.equal(outboxItems(first).length,0);assert.equal(outboxItems(second).length,0);
    assert.equal(state.logs.length,1);assert.equal(state.logs[0].id,'${outboxIds[1]}');
  `});
});

test('offline v14 creates persist on this phone without sending or contaminating the shared cache', async () => {
  let requests=0;
  await timeoutScenario({extra:{navigator:{onLine:false},requests:()=>requests},fetchImpl:async()=>{requests++;throw Error('No signal')},checks:`${v14DraftChecks}
    state.logs=[${JSON.stringify(v14Entry)}];persistShared();
    const before=['activities','config','meta'].map(k=>localStorage.getItem(cacheKey(k)));
    await submitActivity({preventDefault(){}});
    assert.equal(requests(),0);assert.equal(outboxItems().length,1);
    const item=outboxItems()[0];assert.ok(item.queuedAt>0);assert.equal(item.body.note,'Keep this draft');
    assert.equal(state.logs.length,2);assert.equal(state.logs[1].id,item.body.id);
    assert.match(document.querySelector('#toast').textContent,/Saved on this phone/);
    assert.deepEqual(['activities','config','meta'].map(k=>localStorage.getItem(cacheKey(k))),before);
    persistShared();assert.equal(JSON.parse(localStorage.getItem(cacheKey('activities'))).length,1);
    loadSharedCache();assert.equal(state.logs.length,2,'cached board merges the persisted outbox');
    render();render();assert.equal(state.logs.length,2,'render does not duplicate queued rows');
    assert.equal(outboxItems().length,1);
  `});
});

test('queued bounty claims disable a second claim and contribute to local score previews', async () => {
  await timeoutScenario({extra:{navigator:{onLine:false}},checks:`${v14DraftChecks}
    document.querySelector('input[name="activityType"][value="bounty"]').checked=true;
    populateBountySelect();const bounty=dailyBounties(recordDate())[0];document.querySelector('#bountySelect').value=bounty.id;
    await submitActivity({preventDefault(){}});
    assert.equal(outboxItems().length,1);assert.ok(claimedTodayIds('alex',recordDate()).has(bounty.id));
    assert.equal(computeCredits(state.logs).totals.get('alex'),bounty.points);
    assert.equal(Number(document.querySelector('#youTotal').textContent),bounty.points);
    assert.equal(document.querySelector('[data-claim-bounty="'+bounty.id+'"]').disabled,true);
    document.querySelector('input[name="activityType"][value="bounty"]').checked=true;
    populateBountySelect();document.querySelector('#bountySelect').value=bounty.id;updateRecordPreview();
    assert.equal(document.querySelector('#saveActivityBtn').disabled,true);
    await submitActivity({preventDefault(){}});assert.equal(outboxItems().length,1);
    assert.equal(document.querySelector('#toast').textContent,'That bounty is already claimed on that date.');
  `});
});

test('offline saves below v14 retain the existing network and reconciliation behavior', async () => {
  for(const version of [0,12,13]){
    let posts=0,gets=0;
    await timeoutScenario({extra:{navigator:{onLine:false},posts:()=>posts,gets:()=>gets},fetchImpl:async(url,options)=>{if(options.method==='POST')posts++;else gets++;throw Error('No signal')},checks:`${v14DraftChecks}
      state.protocolVersion=${version};await submitActivity({preventDefault(){}});${settle}
      assert.equal(posts(),1);assert.equal(gets(),1);assert.equal(outboxItems().length,0);
      assert.equal(localStorage.getItem('roadToSendOutboxV1'),null);assert.equal(state.logs.length,0);
      assert.equal(document.querySelector('#activityNote').value,'Keep this draft');
      assert.match(document.querySelector('#toast').textContent,/Could not confirm the save/);
    `});
  }
});

test('v14 validation conflict duplicate bounty and HTTP validation rejections are never queued', async () => {
  for(const code of ['invalid_activity','outside_challenge_window','conflict','duplicate_bounty','http']){
    await timeoutScenario({fetchImpl:async()=>({ok:code!=='http',status:code==='http'?400:200,json:async()=>({ok:false,error:{code:code==='http'?'invalid_activity':code,message:'Rejected entry'}})}),checks:`${v14DraftChecks}
      await submitActivity({preventDefault(){}});
      assert.equal(outboxItems().length,0);assert.equal(localStorage.getItem('roadToSendOutboxV1'),null);
      assert.equal(state.logs.length,0);assert.equal(document.querySelector('#activityNote').value,'Keep this draft');
      assert.equal(document.querySelector('#toast').textContent,${JSON.stringify(code==='duplicate_bounty'?'That bounty is already claimed on that date.':'Save failed—Rejected entry It is safe to retry.')});
    `});
  }
});

test('online flushes preserve request ids and queued order with one sender and stop on network failure', async () => {
  const posts=[];let finishFirst;
  await timeoutScenario({extra:{navigator:{onLine:false},posted:()=>posts,finishFirst:()=>finishFirst()},fetchImpl:(url,options)=>{
    if(options.method!=='POST')return Promise.resolve({ok:true,json:async()=>v14Board([])});
    const body=JSON.parse(options.body);posts.push(body);
    if(posts.length===1)return new Promise(resolve=>{finishFirst=()=>resolve({ok:true,json:async()=>({...v14Entry,...body,ok:true,alreadyExists:true})})});
    return Promise.reject(Error('Signal lost'));
  },checks:`${v14DraftChecks}
    const bodies=${JSON.stringify(outboxIds.map(id=>outboxBody(id)))};
    writeOutboxItems(state.endpoint,[{body:bodies[2],queuedAt:3},{body:bodies[0],queuedAt:1},{body:bodies[1],queuedAt:2}]);render();
    navigator.onLine=true;window.dispatchEvent(new window.Event('online'));window.dispatchEvent(new window.Event('online'));${settle}
    assert.equal(posted().length,1,'concurrent triggers cannot send a second request');
    assert.equal(JSON.stringify(posted()[0]),JSON.stringify(bodies[0]));finishFirst();${settle}
    assert.equal(posted().length,2);assert.equal(JSON.stringify(posted()[1]),JSON.stringify(bodies[1]));
    assert.equal(outboxItems().length,2,'the failed request and later item remain queued');
    assert.equal(state.logs.filter(x=>x.id===bodies[0].id).length,1);
    assert.equal(state.logs.find(x=>x.id===bodies[0].id).outboxEndpoint,undefined);
    assert.equal(JSON.parse(localStorage.getItem(cacheKey('activities')))[0].id,bodies[0].id,'idempotent success is confirmed in cache');
  `});
});

test('flush rejections persist a dismissible failed entry without a toast or score', async () => {
  for(const code of ['invalid_activity','invalid_request','duplicate_bounty','conflict','outside_challenge_window','http']){
    let posts=0;
    await timeoutScenario({extra:{posted:()=>posts},fetchImpl:async()=>{posts++;return {ok:code!=='http',status:code==='http'?400:200,json:async()=>({ok:false,error:{code:code==='http'?'invalid_activity':code,message:'Outside the challenge window.'}})}},checks:`${v14DraftChecks}
      enqueueCreate(state.endpoint,${JSON.stringify(outboxBody(outboxIds[0]))});render();
      const before=document.querySelector('#toast').textContent;await flushOutbox();
      assert.equal(posted(),1);assert.equal(state.logs.length,0);assert.equal(computeCredits(state.logs).totals.get('alex')||0,0);
      assert.equal(outboxItems()[0].failed,${JSON.stringify(code==='duplicate_bounty'?'That bounty is already claimed on that date.':'Outside the challenge window.')});
      assert.equal(document.querySelector('#toast').textContent,before);
      loadSharedCache();state.config=${JSON.stringify(v14Board([]).config)};render();
      assert.equal(failedOutboxEntries().length,1,'failed state survives reloading the board');
      await flushOutbox();assert.equal(posted(),1,'failed entries are never retried');
      document.querySelector('[data-dismiss-outbox]').click();assert.equal(outboxItems().length,0);
    `});
  }
});

test('endpoint changes and local mode preserve other queues and cannot send them to another board', async () => {
  const posts=[];let complete;
  await timeoutScenario({extra:{posted:()=>posts,complete:()=>complete()},fetchImpl:(url,options)=>{const body=JSON.parse(options.body);posts.push({url:new URL(url).origin,body});return new Promise(resolve=>{complete=()=>resolve({ok:true,json:async()=>({...v14Entry,...body,ok:true})})})},checks:`${v14DraftChecks}
    const first=state.endpoint,second='https://other.example.test/fn';
    enqueueCreate(first,${JSON.stringify(outboxBody(outboxIds[0]))});enqueueCreate(second,${JSON.stringify(outboxBody(outboxIds[1]))});
    const sending=flushOutbox();state.endpoint=second;state.logs=[];render();complete();await sending;
    assert.equal(posted().length,1);assert.equal(posted()[0].url,'https://board.example.test');
    assert.equal(outboxItems(first).length,0);assert.equal(outboxItems(second).length,1);
    assert.equal(state.logs.length,1);assert.equal(state.logs[0].id,'${outboxIds[1]}');
    assert.equal(localStorage.getItem(cacheKey('activities',second)),null,'old response cannot enter new board cache');
    performDisconnect();await flushOutbox();assert.equal(posted().length,1);
    assert.equal(outboxItems(second).length,1);assert.equal(state.logs.length,0);
    state.endpoint=second;mergeOutbox();assert.equal(state.logs[0].id,'${outboxIds[1]}');
  `});
});

test('corrupt outbox JSON and malformed records are ignored without throwing', async () => {
  const invalid=[null,{}, {body:outboxBody(outboxIds[0]),queuedAt:1e100},{body:{...outboxBody(outboxIds[0]),action:'delete'},queuedAt:1},{body:{...outboxBody(outboxIds[0]),date:'nonsense'},queuedAt:1}];
  await timeoutScenario({checks:`${v14DraftChecks}
    for(const raw of ['{broken','null','[]','42',JSON.stringify({[state.endpoint]:${JSON.stringify(invalid)}})]){
      writeStore('roadToSendOutboxV1',raw);assert.equal(outboxItems().length,0);render();await flushOutbox();assert.equal(state.logs.length,0);
    }
    localStorage.setItem('roadToSendOutboxV1',JSON.stringify({[state.endpoint]:[...${JSON.stringify(invalid)},{body:${JSON.stringify(outboxBody(outboxIds[0]))},queuedAt:1}]}));
    assert.equal(outboxItems().length,1);render();assert.equal(state.logs.length,1);
  `});
});

test('full storage preserves the draft and never claims an offline entry was saved', async () => {
  await timeoutScenario({extra:{navigator:{onLine:false},localStorage:{getItem:()=>null,setItem(){throw Error('Quota exceeded')},removeItem(){}}},checks:`${v14DraftChecks}
    await submitActivity({preventDefault(){}});assert.equal(state.logs.length,0);assert.equal(outboxItems().length,0);
    assert.equal(document.querySelector('#activityNote').value,'Keep this draft');assert.equal(state.saving,false);
    assert.match(document.querySelector('#toast').textContent,/Could not save on this phone/);
  `});
});

test('unconfirmed v14 network and body failures retain the full create request', async () => {
  for(const failure of ['network','body timeout','unreadable body']){
    let posted;
    await timeoutScenario({extra:{posted:()=>posted},fetchImpl:(url,options,stall)=>{
      posted=JSON.parse(options.body);
      if(failure==='network')return Promise.reject(Error('No signal'));
      return Promise.resolve({ok:true,json:()=>failure==='body timeout'?stall(options.signal):Promise.reject(SyntaxError('Broken JSON'))});
    },checks:`${v14DraftChecks}
      await submitActivity({preventDefault(){}});
      assert.equal(outboxItems().length,1);assert.equal(JSON.stringify(outboxItems()[0].body),JSON.stringify(posted()));
      assert.equal(state.logs[0].id,posted().id);assert.equal(document.querySelector('#activityNote').value,'');
    `});
  }
});

test('page load suspends cached v14 queues after unsupported or failed fresh loads', async () => {
  for(const failure of ['version','network','json']){
    const endpoint='https://board.example.test/fn',body=outboxBody(outboxIds[0]),store=new Map([
      ['roadToSendEndpoint',endpoint],['roadToSendMe','Alex'],
      ['roadToSendShared:config:'+encodeURIComponent(endpoint),JSON.stringify(v14Board([]).config)],
      ['roadToSendShared:meta:'+encodeURIComponent(endpoint),JSON.stringify({protocolVersion:14,lastSyncedAt:Date.now(),serverDate:'2026-07-13'})],
      ['roadToSendOutboxV1',JSON.stringify({[endpoint]:[{body,queuedAt:1}]})],
    ]);let posts=0,gets=0;
    await timeoutScenario({extra:{posted:()=>posts,gets:()=>gets,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}},fetchImpl:async(url,options)=>{
      if(options.method==='POST'){posts++;return {ok:true,json:async()=>({...v14Entry,...body,ok:true})}}
      gets++;if(failure==='network')throw Error('Refresh unavailable');
      return {ok:true,json:async()=>{if(failure==='json')throw SyntaxError('Unreadable');return {...v14Board([]),version:99}}};
    },checks:`${settle}
      assert.equal(gets(),1);assert.equal(posted(),0);assert.equal(outboxItems().length,1);
      await flushOutbox();assert.equal(posted(),0,'cached protocol never authorizes replay');
      assert.equal(outboxItems()[0].failed,undefined);
      assert.equal(state.logs.length,1);assert.equal(state.logs[0].outboxEndpoint,state.endpoint);
      assert.equal(state.outboxConfirmedEndpoint,'');
    `});
  }
});

test('successful loads and visible-page events flush queues without automatic toast messages', async () => {
  const posts=[];let saved=[];
  await timeoutScenario({extra:{navigator:{onLine:false},posted:()=>posts},fetchImpl:async(url,options)=>{
    if(options.method==='POST'){const body=JSON.parse(options.body);posts.push(body);const row={...v14Entry,...body};saved.push(row);return {ok:true,json:async()=>({...row,ok:true})}}
    return {ok:true,json:async()=>v14Board(saved)};
  },checks:`${v14DraftChecks}
    enqueueCreate(state.endpoint,${JSON.stringify(outboxBody(outboxIds[0]))});
    navigator.onLine=true;await loadRemote();${settle}
    assert.equal(posted().length,1);assert.equal(outboxItems().length,0);
    enqueueCreate(state.endpoint,${JSON.stringify(outboxBody(outboxIds[1]))});navigator.onLine=false;
    document.dispatchEvent(new window.Event('visibilitychange'));${settle}assert.equal(posted().length,1);
    navigator.onLine=true;document.dispatchEvent(new window.Event('visibilitychange'));${settle}
    assert.equal(posted().length,2);assert.equal(outboxItems().length,0);assert.equal(state.logs.length,2);
    assert.equal(document.querySelector('#toast').textContent,'');
  `});
});

test('a refresh started before an outbox confirmation cannot replace the confirmed row with an older snapshot', async () => {
  let gets=0,finish,confirmed,finishPost;
  await timeoutScenario({extra:{finish:()=>finish(),finishPost:()=>finishPost(),gets:()=>gets},fetchImpl:(url,options)=>{
    if(options.method==='POST'){confirmed={...v14Entry,...JSON.parse(options.body)};return new Promise(resolve=>{finishPost=()=>resolve({ok:true,json:async()=>({...confirmed,ok:true})})})}
    gets++;
    if(gets===1)return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>v14Board([])})});
    return Promise.resolve({ok:true,json:async()=>v14Board([confirmed])});
  },checks:`${v14DraftChecks}
    enqueueCreate(state.endpoint,${JSON.stringify(outboxBody(outboxIds[0]))});render();
    const sending=flushOutbox(),refresh=loadRemote();finishPost();await sending;finish();await refresh;${settle}
    assert.equal(gets(),2,'a snapshot superseded by confirmation is refreshed');assert.equal(outboxItems().length,0);
    assert.equal(state.logs.length,1);assert.equal(state.logs[0].id,'${outboxIds[0]}');
    assert.equal(JSON.parse(localStorage.getItem(cacheKey('activities')))[0].id,'${outboxIds[0]}');
  `});
});

test('a success body with an unconfirmed id cannot lose a queued create', async () => {
  await timeoutScenario({fetchImpl:async()=>({ok:true,json:async()=>({ok:true,id:'wrong-id'})}),checks:`${v14DraftChecks}
    await submitActivity({preventDefault(){}});assert.equal(outboxItems().length,1);
    const id=outboxItems()[0].body.id;await flushOutbox();assert.equal(outboxItems().length,1);
    assert.equal(state.logs.length,1);assert.equal(state.logs[0].id,id);assert.equal(outboxItems()[0].failed,undefined);
    assert.equal(localStorage.getItem(cacheKey('activities')),null);
  `});
});

test('a refreshed committed create is removed before deletion and can never be replayed', async () => {
  const posts=[];let serverRows=[];
  await timeoutScenario({extra:{posted:()=>posts},fetchImpl:async(url,options)=>{
    if(options.method!=='POST')return {ok:true,json:async()=>v14Board(serverRows)};
    const body=JSON.parse(options.body);posts.push(body);
    if(body.action==='delete'){serverRows=serverRows.filter(x=>x.id!==body.id);return {ok:true,json:async()=>({ok:true})}}
    serverRows.push({...v14Entry,...body});throw Error('Response lost after commit');
  },checks:`${v14DraftChecks}
    await submitActivity({preventDefault(){}});
    assert.equal(posted().length,1);assert.equal(outboxItems().length,1);
    const id=outboxItems()[0].body.id;
    assert.equal(await loadRemote(),true);${settle}
    assert.equal(outboxItems().length,0,'the server id acknowledges the lost response');
    assert.equal(JSON.parse(localStorage.getItem('roadToSendOutboxV1'))[state.endpoint].length,0,'confirmation removes the durable request immediately');
    const row=state.logs.find(x=>x.id===id);assert.ok(row);assert.equal(row.outboxEndpoint,undefined);
    assert.equal(document.querySelector('#personalActivity [aria-live]'),null);
    assert.equal(posted().length,1,'refresh does not resend an acknowledged create');
    state.pendingDelete={entry:row,id,feed:'personal',position:0};await performDelete();${settle}
    assert.equal(state.logs.length,0);assert.equal(posted().length,2);assert.equal(posted()[1].action,'delete');
    await flushOutbox();${settle}
    assert.equal(posted().length,2,'a flush after deletion sends nothing');assert.equal(state.logs.length,0);
  `});
});

test('fresh board acknowledgements clear failed creates and their Not saved flags', async () => {
  const row={...v14Entry,...outboxBody(outboxIds[0])};let posts=0;
  await timeoutScenario({extra:{posted:()=>posts},fetchImpl:async(url,options)=>{
    if(options.method==='POST')posts++;
    return {ok:true,json:async()=>v14Board([row])};
  },checks:`${v14DraftChecks}
    writeOutboxItems(state.endpoint,[{body:${JSON.stringify(outboxBody(outboxIds[0]))},queuedAt:1,failed:'Rejected earlier'}]);render();
    assert.match(document.querySelector('#personalActivity').textContent,/Not saved/);
    await loadRemote();${settle}
    assert.equal(outboxItems().length,0);assert.equal(failedOutboxEntries().length,0);
    const feed=document.querySelector('#personalActivity');assert.equal(feed.querySelectorAll('.activity').length,1);
    assert.ok(feed.querySelector('[data-del]'));assert.equal(feed.querySelector('[data-dismiss-outbox],[aria-live]'),null);
    assert.equal(state.logs[0].outboxFailure,undefined);assert.equal(posted(),0);
  `});
});

test('every write response reconciles acknowledged queued and failed creates for its endpoint', async () => {
  for(const action of ['create','update','delete','addParticipant','saveConfig']){
    const rows=outboxIds.slice(0,2).map(id=>({...v14Entry,...outboxBody(id)}));
    await timeoutScenario({fetchImpl:async()=>({ok:action!=='delete',json:async()=>({ok:action!=='delete',activities:rows})}),checks:`${v14DraftChecks}
      const bodies=${JSON.stringify(outboxIds.map(id=>outboxBody(id)))};
      const other='https://other.example.test/fn';
      writeOutboxItems(state.endpoint,[{body:bodies[0],queuedAt:1},{body:bodies[1],queuedAt:2,failed:'Not accepted before'}]);
      enqueueCreate(other,bodies[2]);render();
      const response=await fetchShared(state.endpoint,{method:'POST',body:JSON.stringify({action:${JSON.stringify(action)}})});
      await response.json();
      assert.equal(outboxItems().length,0,'write activity ids confirm both pending and failed creates');
      assert.equal(JSON.parse(localStorage.getItem('roadToSendOutboxV1'))[state.endpoint].length,0);
      assert.equal(outboxItems(other).length,1,'another endpoint keeps its request');
      assert.equal(state.logs.length,2);assert.ok(state.logs.every(x=>!x.outboxEndpoint));
      const feed=document.querySelector('#personalActivity');assert.equal(feed.querySelectorAll('.activity').length,2);
      assert.equal(feed.querySelector('[aria-live],[data-dismiss-outbox]'),null);
      assert.equal(JSON.parse(localStorage.getItem(cacheKey('activities'))).length,2);
    `});
  }
});

test('transient create and replay failures stay queued stop the sender and retry the same ids', async () => {
  for(const operation of ['create','replay'])for(const failure of ['server_error','5xx','gateway','json','timeout','body timeout','unknown rejection']){
    const posts=[];
    await timeoutScenario({extra:{posted:()=>posts},fetchImpl:(url,options,stall)=>{
      const body=JSON.parse(options.body);posts.push(body);
      if(posts.length>1)return Promise.resolve({ok:true,json:async()=>({...v14Entry,...body,ok:true})});
      if(failure==='timeout')return stall(options.signal);
      if(failure==='body timeout')return Promise.resolve({ok:true,json:()=>stall(options.signal)});
      if(failure==='json'||failure==='gateway')return Promise.resolve({ok:failure==='json',status:failure==='gateway'?502:200,json:async()=>{throw SyntaxError('Gateway HTML or broken JSON')}});
      return Promise.resolve({ok:failure!=='5xx',status:failure==='5xx'?503:200,json:async()=>({ok:false,error:{code:failure==='5xx'?'invalid_activity':failure==='server_error'?'server_error':'unknown',message:'Temporary rejection'}})});
    },checks:`${v14DraftChecks}
      ${operation==='create'?"await submitActivity({preventDefault(){}});":"enqueueCreate(state.endpoint,"+JSON.stringify(outboxBody(outboxIds[0]))+");enqueueCreate(state.endpoint,"+JSON.stringify(outboxBody(outboxIds[1]))+");render();await flushOutbox();"}
      assert.equal(posted().length,1,'a transient failure stops this flush before later requests');
      assert.equal(outboxItems().length,${operation==='create'?1:2});
      assert.ok(outboxItems().every(x=>x.failed===undefined));
      assert.equal(JSON.stringify(outboxItems()[0].body),JSON.stringify(posted()[0]));
      assert.equal(document.querySelectorAll('#personalActivity [data-dismiss-outbox]').length,0);
      assert.ok(document.querySelector('#personalActivity').textContent.includes('Waiting to send'));
      await flushOutbox();
      assert.equal(posted().length,${operation==='create'?2:3});assert.equal(posted()[1].id,posted()[0].id);
      assert.equal(outboxItems().length,0,'later retry confirms the unchanged requests');
    `});
  }
});

test('a failed or unsupported refresh revokes replay until a fresh supported board succeeds', async () => {
  for(const failure of ['version','network','json','old version']){
    let mode='supported',posts=0,gets=0;
    await timeoutScenario({extra:{setMode:value=>{mode=value},posted:()=>posts,gets:()=>gets},fetchImpl:async(url,options)=>{
      if(options.method==='POST'){posts++;return {ok:true,json:async()=>({...v14Entry,...JSON.parse(options.body),ok:true})}}
      gets++;if(mode==='network')throw Error('No signal');
      return {ok:true,json:async()=>{if(mode==='json')throw SyntaxError('Broken JSON');return {...v14Board([]),version:mode==='version'?99:mode==='old version'?13:14}}};
    },checks:`${v14DraftChecks}
      assert.equal(await loadRemote(),true);assert.equal(state.outboxConfirmedEndpoint,state.endpoint);
      enqueueCreate(state.endpoint,${JSON.stringify(outboxBody(outboxIds[0]))});
      setMode(${JSON.stringify(failure)});await loadRemote();await flushOutbox();
      assert.equal(posted(),0);assert.equal(outboxItems().length,1);
      window.dispatchEvent(new window.Event('online'));${settle}
      assert.equal(posted(),0,'online checks fresh JSON before replay');
      document.dispatchEvent(new window.Event('visibilitychange'));${settle}
      assert.equal(posted(),0,'visible-page replay also waits for a successful load');
      assert.equal(gets(),4);
      setMode('supported');window.dispatchEvent(new window.Event('online'));${settle}
      assert.equal(gets(),5);assert.equal(posted(),1);assert.equal(outboxItems().length,0);
    `});
  }
});
