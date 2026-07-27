// Shared plumbing for the client-state suites: the inline script pulled out of the built
// index.html, and the element stub the DOM-backed harnesses run against.
//
// TRAP — the element stub is deliberately thin, and its gaps do not fail loudly, they answer
// wrongly and quietly:
//
//   * `setAttribute()` is a no-op and `getAttribute()` always returns `null`, so an aria-*
//     attribute set from JS is NOT observable here. Assert `textContent`/`innerHTML` in these
//     suites and cover aria-* in `tests/static-check.mjs` instead.
//   * `addEventListener()` is a no-op and elements have no `closest()`, so a delegated handler
//     can never be fired. Expose every new interaction as a named top-level function in
//     `src/app.js` and call that function directly.
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeElement() {
  const classes = new Set();
  return {
    value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      contains: c => classes.has(c),
      toggle: (c, force) => {const on = force === undefined ? !classes.has(c) : Boolean(force); on ? classes.add(c) : classes.delete(c); return on},
    },
    setAttribute() {}, removeAttribute() {}, getAttribute() {return null},
    addEventListener() {}, removeEventListener() {}, focus() {},
    querySelectorAll() {return []},
  };
}

module.exports = {source, makeElement};
