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
    await Promise.resolve();await Promise.resolve();
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
async function movedScenario({endpoint = OLD_URL, search = '', seed = {}, extra = {}, backends, checks}) {
  const dom = sharedDom();
  const store = new Map(Object.entries(seed));
  if (endpoint) store.set('roadToSendEndpoint', endpoint);
  store.set('roadToSendMe', 'Alex');
  const fetched = [];
  const replaced = [];
  const board = version => ({version, features: [], activities: [{id: 'a1', name: 'Alex', type: 'exercise', date: '2026-07-13', createdAt: '1'}], config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: '2026-07-13', timeZone: 'UTC'});
  const context = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search, href: 'https://example.test/app/' + search, hash: ''},
    history: {replaceState: (state, title, url) => replaced.push(url)},
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

test('a GET carrying movedTo adopts the new endpoint, caches there, keeps the old cache and rewrites the sheet param', async () => {
  await movedScenario({
    search: '?sheet=' + encodeURIComponent(OLD_URL) + '&keep=1',
    seed: {['roadToSendShared:activities:' + encodeURIComponent(OLD_URL)]: '[]'},
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(13), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => board(13),
    },
    checks: `
      ${settle}
      assert.equal(state.endpoint,'${NEW_URL}');
      assert.equal(store.get('roadToSendEndpoint'),'${NEW_URL}','the stored endpoint follows the move');
      for(const kind of ['activities','config','meta'])assert.notEqual(store.get(cacheKey(kind,'${NEW_URL}')),undefined,kind+' is cached under the new endpoint');
      assert.equal(store.get(cacheKey('activities','${OLD_URL}')),'[]','the old activities cache is byte-for-byte unchanged');
      assert.equal(store.keys().filter(k=>k.endsWith(':'+encodeURIComponent('${OLD_URL}'))).length,1,'no other old endpoint cache key is created');
      assert.equal(JSON.stringify(fetched()),JSON.stringify(['GET ${OLD_URL}','GET ${NEW_URL}']),'the next fetch goes to the new URL');
      const rewritten=new URL(replaced().filter(u=>u[0]!=='#')[0]);
      assert.equal(rewritten.searchParams.get('sheet'),'${NEW_URL}','the sheet param is rewritten');
      assert.equal(rewritten.searchParams.get('keep'),'1','other params are left alone');
      assert.equal(state.syncState,'live');
      assert.equal(state.logs.length,1);
    `,
  });
});

test('adopting a move without a sheet param does not touch the address bar', async () => {
  await movedScenario({
    backends: {
      [OLD_URL]: (m, b, board) => Object.assign(board(12), {movedTo: NEW_URL}),
      [NEW_URL]: (m, b, board) => board(13),
    },
    checks: `
      ${settle}
      assert.equal(replaced().filter(u=>u[0]!=='#').length,0,'no sheet param means no address bar rewrite');
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
