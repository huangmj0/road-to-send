// TRAP: The browser rotation is read from editable sources, never from the shipped artifact, through
// harness.js (src/app-core.js and src/app.js concatenated). That is load-bearing, not incidental.
// `vm.runInContext` can only reach `dailyBounties` because those sources are unbundled top-level
// declarations; the build emits a minified IIFE, which exports nothing onto the context. Point the
// browser side at index.html and `dailyBounties` becomes undefined, so the harness throws instead of
// reporting a rotation mismatch. The backend side is the Supabase function's
// supabase/functions/road-to-send/core.mjs, an ES module, so it is loaded with dynamic import() in an
// async loader and the tests are async. core.mjs reads its scoring from the generated
// contract.generated.json, so a stale contract (run `npm run build`) surfaces as a rotation
// mismatch, not as a clear staleness error. What this file proves is that the two *sources* agree;
// agreement between the deployed page and the function rides on the build, which check:generated and
// the artifact smoke suite cover instead. The frozen Apps Script redirector (ADR-0004) no longer
// validates claims and is not compared.
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const {source} = require('./harness.js');

/** Load the browser-side daily bounty rotation from the editable page source. */
function loadBrowserRotation() {
  const values = new Map();
  const context = {
    console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number,
    RegExp, Error, Intl,
    location: {search: '', href: 'https://example.test/', hash: ''},
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    },
    setTimeout() {}, clearTimeout() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return date => Array.from(context.dailyBounties(date), bounty => bounty.id);
}

/** Load the backend daily bounty rotation from the Supabase function's core module. */
async function loadBackendRotation() {
  const core = await import(new URL('../supabase/functions/road-to-send/core.mjs', `file://${__filename}`));
  return date => Array.from(core.dailyBounties(date), bounty => bounty.id);
}

/** Convert a Date to the YYYY-MM-DD key consumed by the rotation implementations. */
function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

/** Return the first browser/backend rotation mismatch within an inclusive date range. */
function firstMismatch(browserRotation, backendRotation, start, end) {
  for (let cursor = new Date(start + 'T12:00:00Z'); cursor <= new Date(end + 'T12:00:00Z'); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = isoDay(cursor);
    const browser = browserRotation(date);
    const backend = backendRotation(date);
    if (browser.join(',') !== backend.join(',')) return {date, browser, backend};
  }
  return null;
}

test('browser and backend bounty rotation agree across six months', async () => {
  // Scope is rotation only. normalizeCrew intentionally differs between client and backend;
  // ADR-0003 records why duplicated helpers are not all identity-tested (superseded by ADR-0004 for the backend side).
  const mismatch = firstMismatch(loadBrowserRotation(), await loadBackendRotation(), '2026-01-01', '2026-06-30');
  assert.equal(mismatch, null, mismatch && `bounty rotation first disagrees on ${mismatch.date}: browser=${mismatch.browser.join(',')} backend=${mismatch.backend.join(',')}`);
});

test('rotation drift diagnosis names the first disagreeing date', async () => {
  const browser = loadBrowserRotation();
  const backend = await loadBackendRotation();
  const changedBrowser = date => {
    const ids = browser(date);
    return date === '2026-03-01' ? ['deliberate-drift', ...ids.slice(1)] : ids;
  };
  const mismatch = firstMismatch(changedBrowser, backend, '2026-02-27', '2026-03-03');
  assert.equal(mismatch.date, '2026-03-01');
  const expectedMessage = `bounty rotation first disagrees on ${mismatch.date}: browser=${mismatch.browser.join(',')} backend=${mismatch.backend.join(',')}`;
  assert.throws(
    () => assert.equal(mismatch, null, expectedMessage),
    error => error instanceof assert.AssertionError && error.message.includes(expectedMessage),
  );
});
