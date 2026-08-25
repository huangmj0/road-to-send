// Shared-mode harnesses with a stubbed fetch: background sync, setup, clipboard, storage,
// export, dialog focus and the share sheet. Unlike the other two client-state suites these are
// real async test() blocks, each building its own context.
//
// TRAP — the element stub in harness.js stores attributes and fires listeners bound to the element
// itself, but elements have no tree, so a delegated handler still cannot be fired. Read the trap
// note at the top of tests/harness.js before adding assertions here. Assertions inside a `checks` template literal may contain no backtick and no `${`.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {test} = require('node:test');
const {source, makeElement} = require('./harness.js');

test('background sync respects the open date picker and refreshes stale caches', async () => {
  const elements = new Map();
  const listeners = new Map();
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
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    fireDocumentEvent: type => {const handler = listeners.get(type); if (handler) handler({})},
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
    lastSyncedAt=Date.now()-6*60*1000;
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before+1,'a stale cache refreshes on tab return');
    // Entry 35: a crew member travelling, or anyone whose device clock has rolled past the Sheet's
    // midnight, can now see which day the app is actually scoring against and whose midnight it is.
    lastSyncedAt=Date.now();renderSync();
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
    assert.equal(syncState,'live','a reachable payload with a numeric activity name remains a live sync');
    endpoint='';renderSync();
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
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  const testContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
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
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  const posted = [];
  const dayShift = n => {const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`};
  const crewConfig = {startDate: dayShift(-5), tripDate: dayShift(5), goal: 500, crew: [{name: 'Alex'}]};
  const payload = {version: 12, features: [], activities: [], config: crewConfig, configErrors: [], serverDate: '', timeZone: ''};
  const participantRow = {querySelector: () => ({value: 'Alex'})};
  const setupContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    navigator: {clipboard: {writeText: () => Promise.reject(Error('denied'))}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: selector => selector === '.participant-row' ? [participantRow] : [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
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
    await saveSetup();
    assert.equal(endpoint,'https://sheet.example.test/exec','the endpoint persisted even though the clipboard refused');
    assert.equal(localStorage.getItem('roadToSendEndpoint'),'https://sheet.example.test/exec','the endpoint reached localStorage');
    assert.equal(postedActions(),'saveConfig','the config was saved to the Sheet exactly once');
    assert.equal(document.querySelector('#setupErrors').classList.contains('hide'),true,'a denied copy never paints the setup error box');
    assert.equal(document.querySelector('#toast').textContent,'Shared setup saved. Copy the crew link from setup.','the toast reports a saved setup with an uncopied link');
    assert.equal(document.querySelector('#saveSetupBtn').disabled,false,'the Save button is released either way');
  })()`;
  await vm.runInNewContext(`${source}\n${setupChecks}`, setupContext, {filename: 'index.html'});
});

test('copyText reports a successful clipboard write and keeps the crew link deliberate', async () => {
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  const written = [];
  const copyContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/?sheet=https%3A%2F%2Fsheet.example.test%2Fexec#you', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    navigator: {clipboard: {writeText: value => {written.push(String(value)); return Promise.resolve()}}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
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
    endpoint='https://sheet.example.test/exec';
    assert.equal(await copyCrewLink(),true,'the crew link copy hands back the helper result');
    assert.ok(lastWritten().indexOf('sheet=')>=0,'the crew link deliberately still carries the sheet param');
    assert.equal(lastWritten().indexOf('#you'),-1,'the crew link still drops the tab hash');
    assert.equal(document.querySelector('#toast').textContent,'Crew link copied.','a copied crew link keeps its own toast');
    endpoint='';
  })()`;
  await vm.runInNewContext(`${source}\n${copyChecks}`, copyContext, {filename: 'index.html'});
});

test('a full disk never reports a saved entry as failed, and never traps the identity dialog', async () => {
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  const today = new Date().toISOString().slice(0, 10);
  const storageContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    // Safari private mode and an exhausted quota both throw here. Reads still work, which is why
    // safeJson() was never the problem — every write in the app was the unguarded half.
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: () => {throw Error('QuotaExceededError')}, removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const storageChecks = `(async()=>{
    endpoint='';
    config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};
    logs=[];me='';recordingFor='';
    document.querySelector('#identityMember').value='Alex';
    document.querySelector('#identityModal').classList.add('open');
    saveIdentity();
    assert.equal(me,'Alex','a failed write still records the identity in memory');
    assert.equal(document.querySelector('#identityModal').classList.contains('open'),false,'and the dialog closes instead of trapping the user behind an uncaught throw');
    document.querySelector('#activityDate').value='${today}';
    document.querySelector('#recordFor').value='Alex';
    await submitActivity({preventDefault(){}});
    assert.equal(logs.length,1,'the entry is in the log either way, so it must not be reported as lost');
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
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  let posted = 0;
  const today = new Date().toISOString().slice(0, 10);
  store.set('roadToSendEndpoint', 'https://sheet.example.test/exec');
  store.set('roadToSendMe', 'Alex');
  const savedContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    postedCount: () => posted,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {posted++; return {ok: true, json: async () => ({version: 12, ok: true, id: 'srv-1', name: 'Alex', type: 'climb', category: 'climb', points: 3, date: today, createdAt: '2026-01-01T00:00:00.000Z', hardestGrade: '', bountyId: '', bountyTitle: '', note: ''})}}
      return new Promise(() => {});
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const savedChecks = `(async()=>{
    endpoint='https://sheet.example.test/exec';
    config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};
    logs=[];me='Alex';recordingFor='Alex';
    document.querySelector('#activityDate').value='${today}';
    await submitActivity({preventDefault(){}});
    assert.equal(postedCount(),1,'the activity is written to the Sheet exactly once');
    assert.equal(logs.length,1,'the saved row appears immediately, without awaiting a full reload');
    assert.equal(logs[0].id,'srv-1','the row is the authoritative record the write returned');
    assert.equal(logs[0].points,3,'including the points the backend derived, not the raw request');
    assert.equal(document.querySelector('#toast').textContent,'Activity saved.','and success is confirmed at once');
    assert.equal(saving,false,'the save flag is released');
  })()`;
  await vm.runInNewContext(`${source}\n${savedChecks}`, savedContext, {filename: 'index.html'});
});

test('a blocked export says so instead of failing silently', async () => {
  // Neither Blob nor a throwing click() exists in any other harness, so both stubs are additive.
  const makeExportContext = ({clickThrows = false, blobThrows = false} = {}) => {
    const elements = new Map();
    const revoked = [];
    const anchors = [];
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
        window: {scrollTo() {}},
        Blob: function (parts) {if (blobThrows) throw Error('Blob is not available here'); this.parts = parts},
        document: {
          visibilityState: 'visible', activeElement: null,
          querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
          querySelectorAll: () => [],
          addEventListener() {}, removeEventListener() {},
          createElement: () => {
            const el = makeElement();
            el.click = () => {if (clickThrows) throw Error('downloads are blocked'); anchors.push({href: el.href, download: el.download})};
            return el;
          },
        },
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
  // The shared makeElement() stubs focus as a no-op and returns [] from querySelectorAll, so none of
  // this is observable in the existing harnesses. A richer factory in a fresh context is additive.
  const focused = [];
  const elements = new Map();
  const makeFocusable = name => {
    const el = makeElement();
    el.name = name;
    el.focus = () => focused.push(name);
    el.offsetParent = {};
    return el;
  };
  const okBtn = makeFocusable('confirmOk');
  const cancelBtn = makeFocusable('confirmCancel');
  const confirmModal = makeElement();
  confirmModal.querySelectorAll = () => [cancelBtn, okBtn];
  elements.set('#confirmModal', confirmModal);
  const focusContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {}, createElement: () => makeElement(),
    },
    focusOrder: () => focused,
    innerNode: () => okBtn,
    theModal: () => confirmModal,
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    setTimeout() {}, clearTimeout() {},
  };
  const focusChecks = `(()=>{
    openModal('confirmModal');
    assert.equal(document.querySelector('#confirmModal').classList.contains('open'),true,'the dialog opened');
    assert.equal(focusOrder().join(','),'confirmCancel','focus lands on the dialog first focusable element, not on the destructive one');
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
    const elements = new Map();
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
        window: {scrollTo() {}},
        navigator,
        document: {
          visibilityState: 'visible', activeElement: null,
          querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
          querySelectorAll: () => [],
          addEventListener() {}, removeEventListener() {}, createElement: () => makeElement(),
        },
        fetch: async () => {throw Error('this harness makes no network calls')},
        localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
        setTimeout() {}, clearTimeout() {},
      },
    };
  };
  const setup = `me='Alex';recordingFor='Alex';endpoint='';config={startDate:'${dayShift(-5)}',tripDate:'${dayShift(5)}',goal:500,crew:[{name:'Alex'}]};logs=[{id:'x1',name:'Alex',type:'climb',date:'${dayShift(-1)}',createdAt:'1'}];`;
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
