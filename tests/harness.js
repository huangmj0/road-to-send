// Shared plumbing for the client-state suites: the source module assembled with its build-time
// constants, a happy-dom page tree for DOM behavior, and a small legacy element stub used only
// by the shared-mode and temporary fingerprint harnesses.
//
// The stub stores attributes and dispatches listeners registered on the element itself, so an
// aria-* attribute written from JS is readable with `getAttribute()` and a handler bound in
// `init()` can be fired with `el.dispatchEvent({type: 'change'})`.
//
// TRAP — makeElement() remains intentionally flat for the suites that only need isolated
// controls. Its gaps do not fail loudly, they answer wrongly and quietly:
//
//   * Elements have NO tree: no parent, no children, no `closest()`, and `querySelectorAll()`
//     always returns `[]`. A delegated handler — one bound to a container that reads
//     `event.target.closest(...)` — therefore still cannot be fired. Expose every new delegated
//     interaction cannot be exercised through this helper.
//   * With no tree there is no bubbling: `dispatchEvent()` runs the listeners on that one element
//     and stops. It does not build the event either — pass the object the handler expects, at
//     minimum `{type}`, plus whatever fields the handler reads (`preventDefault`, `key`, …).
//   * `document.querySelector()` in these suites returns one cached stub per selector string, so
//     two different selectors naming the same real element are two different stubs here.
const fs = require('node:fs');
const {Window} = require('happy-dom');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const read = path => fs.readFileSync(new URL(path, `file://${__filename}`), 'utf8').trimEnd();
const scoring = JSON.stringify(JSON.parse(read('../src/scoring.json')));
const apiVersion = String(JSON.parse(read('../src/schema.json')).properties.version.const);
const appsScript = read('../src/apps-script.js')
  .replaceAll('__SCORING_CONFIG__', scoring)
  .replaceAll('__API_VERSION__', apiVersion);
const source = (read('../src/app-core.js') + '\n' + read('../src/app.js'))
  .replaceAll('__SCORING_CONFIG__', scoring)
  .replaceAll('__API_VERSION__', apiVersion)
  .replace('const SCRIPT=__APPS_SCRIPT__;', `const SCRIPT=${JSON.stringify(appsScript)};`);

function createDom() {
  const window = new Window({url: 'https://example.test/'});
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  return window;
}

function makeElement() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  const element = {
    value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      contains: c => classes.has(c),
      toggle: (c, force) => {const on = force === undefined ? !classes.has(c) : Boolean(force); on ? classes.add(c) : classes.delete(c); return on},
    },
    setAttribute: (name, value) => {attributes.set(String(name), String(value))},
    removeAttribute: name => {attributes.delete(String(name))},
    getAttribute: name => attributes.has(String(name)) ? attributes.get(String(name)) : null,
    hasAttribute: name => attributes.has(String(name)),
    addEventListener: (type, handler) => {
      if (typeof handler !== 'function') return;
      const bound = listeners.get(type) || [];
      if (!bound.includes(handler)) bound.push(handler);
      listeners.set(type, bound);
    },
    removeEventListener: (type, handler) => {
      const bound = listeners.get(type);
      if (bound) listeners.set(type, bound.filter(h => h !== handler));
    },
    dispatchEvent: event => {
      const bound = listeners.get(event && event.type) || [];
      bound.slice().forEach(handler => handler.call(element, event));
      return true;
    },
    focus() {},
    querySelectorAll() {return []},
  };
  return element;
}

module.exports = {source, makeElement, createDom};
