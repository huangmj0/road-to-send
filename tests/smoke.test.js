const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const apiVersion = Number(source.match(/SUPPORTED_API_VERSIONS=new Set\(\[(\d+)/)[1]);

test('shared workflow connects, saves settings, adds and syncs activity, then deletes it', async () => {
  const values = new Map();
  const elements = new Map();
  const requests = [];
  const copied = [];
  const server = {
    config: {startDate: '2026-09-07', tripDate: '2026-11-15', goal: 500, crew: ['Old Crew']},
    activities: [],
    benchmarks: [],
    nextId: 1,
  };

  const makeElement = () => {
    const listeners = new Map();
    const submitButton = {disabled: false, textContent: ''};
    const classNames = new Set();
    return {
      value: '', textContent: '', innerHTML: '', title: '', disabled: false, required: false,
      min: '', max: '', style: {}, dataset: {}, nextSibling: {textContent: ''}, isConnected: true,
      classList: {
        add(...names) { names.forEach(name => classNames.add(name)); },
        remove(...names) { names.forEach(name => classNames.delete(name)); },
        toggle(name, force) {
          const enabled = force === undefined ? !classNames.has(name) : force;
          if (enabled) classNames.add(name); else classNames.delete(name);
          return enabled;
        },
      },
      addEventListener(type, handler) { listeners.set(type, handler); },
      getListener(type) { return listeners.get(type); },
      setAttribute(name, value) { this[name] = value; },
      focus() {}, reset() {}, click() {}, closest() { return null; },
      querySelector(selector) { return selector === 'button[type=submit]' ? submitButton : makeElement(); },
    };
  };
  const getElement = selector => {
    if (!elements.has(selector)) elements.set(selector, makeElement());
    return elements.get(selector);
  };
  const remote = () => ({
    version: apiVersion,
    features: ['scoring-v2', 'bounties', 'benchmarks', 'challenge-window'],
    activities: server.activities.map(item => ({...item})),
    benchmarks: server.benchmarks.map(item => ({...item})),
    config: {...server.config, crew: [...server.config.crew]},
    configErrors: [],
    serverDate: '2026-10-01',
    timeZone: 'America/Los_Angeles',
    fetchedAt: new Date().toISOString(),
  });
  const response = body => ({ok: true, json: async () => body});
  const fetch = async (url, options) => {
    if (!options?.method || options.method === 'GET') {
      requests.push({method: 'GET', url});
      return response(remote());
    }
    const body = JSON.parse(options.body);
    requests.push({method: 'POST', url, body});
    if (body.action === 'saveConfig') {
      server.config = {...body.config, crew: [...body.config.crew]};
      return response({version: apiVersion, ok: true, config: server.config, configErrors: []});
    }
    if (body.action === 'delete') {
      server.activities = server.activities.filter(item => item.id !== body.id);
      return response({version: apiVersion, ok: true, deleted: body.id});
    }
    const saved = {...body, id: `activity-${server.nextId++}`};
    server.activities.push(saved);
    return response({version: apiVersion, ok: true, ...saved});
  };

  const context = {
    assert, console, URL, URLSearchParams, Blob, Map, Set, Date, Math, JSON, Object, Array,
    String, Number, RegExp, Error, Promise,
    location: {href: 'https://example.test/', search: ''},
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); },
    },
    document: {
      hidden: false,
      activeElement: null,
      querySelector: getElement,
      querySelectorAll() { return []; },
      addEventListener() {},
      createElement: makeElement,
    },
    navigator: {clipboard: {writeText: async value => { copied.push(value); }}},
    requestAnimationFrame(callback) { callback(); },
    setInterval() {},
    setTimeout() {},
    confirm() { return true; },
    fetch,
    getListener(selector, type) { return getElement(selector).getListener(type); },
  };

  const checks = `(async()=>{
    const sharedUrl='https://script.google.com/macros/s/smoke-test/exec';
    document.querySelector('#endpoint').value=sharedUrl;
    const probe=await fetchShared(sharedUrl);
    assert.equal(probe.ok,true);
    assert.equal(unpackRemote(await probe.json()).version,${apiVersion});
    await testConnection();
    assert.match(document.querySelector('#testResult').textContent,/Connected — API v${apiVersion}/);
    assert.equal(endpoint,'','testing a connection does not activate it');

    document.querySelector('#challengeStart').value='2026-09-07';
    document.querySelector('#tripDate').value='2026-11-15';
    document.querySelector('#groupGoal').value='750';
    document.querySelector('#crewNames').value='Alex, Maya';
    await saveSetup();
    assert.equal(endpoint,sharedUrl);
    assert.equal(config.goal,750);
    assert.equal(JSON.stringify(config.crew),JSON.stringify(['Alex','Maya']));
    assert.equal(JSON.parse(localStorage.getItem('roadToSendShared:config:'+encodeURIComponent(sharedUrl))).goal,750);

    document.querySelector('#activityType').value='pull';
    document.querySelector('#member').value='Alex';
    document.querySelector('#activityDate').value='2026-10-01';
    document.querySelector('#note').value='Smoke test pull session';
    const submit=getListener('#logForm','submit');
    assert.equal(typeof submit,'function','activity form submit handler is registered');
    await submit({preventDefault(){},target:document.querySelector('#logForm')});
    assert.equal(logs.length,1);
    assert.equal(logs[0].id,'activity-1');
    assert.equal(logs[0].name,'Alex');

    const beforeSync=lastSyncedAt;
    assert.equal(await loadRemote(true),true);
    assert.ok(lastSyncedAt>=beforeSync);
    assert.equal(syncState,'live');

    await deleteEntry(0,'activity-1');
    assert.equal(logs.length,0);
  })()`;

  await vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});

  assert.deepEqual(
    requests.filter(request => request.method === 'POST').map(request => request.body.action || 'activity'),
    ['saveConfig', 'activity', 'delete'],
  );
  assert.equal(server.activities.length, 0);
  assert.ok(requests.filter(request => request.method === 'GET').length >= 4);
  assert.ok(copied.some(value => value.includes('sheet=')), 'successful setup copies a crew link');
});
