// Shared plumbing for the client-state suites: the inline script pulled out of the built
// index.html, and the element stub the DOM-backed harnesses run against.
//
// The stub stores attributes and dispatches listeners registered on the element itself, so an
// aria-* attribute written from JS is readable with `getAttribute()` and a handler bound in
// `init()` can be fired with `el.dispatchEvent({type: 'change'})`.
//
// TRAP — what the stub still does not do, and its gaps do not fail loudly, they answer wrongly
// and quietly:
//
//   * Elements have NO tree: no parent, no children, no `closest()`, and `querySelectorAll()`
//     always returns `[]`. A delegated handler — one bound to a container that reads
//     `event.target.closest(...)` — therefore still cannot be fired. Expose every new delegated
//     interaction as a named top-level function in `src/app.js` and call that function directly.
//   * With no tree there is no bubbling: `dispatchEvent()` runs the listeners on that one element
//     and stops. It does not build the event either — pass the object the handler expects, at
//     minimum `{type}`, plus whatever fields the handler reads (`preventDefault`, `key`, …).
//   * `document.querySelector()` in these suites returns one cached stub per selector string, so
//     two different selectors naming the same real element are two different stubs here.
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

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

module.exports = {source, makeElement};
