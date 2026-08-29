const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const {Window} = require('happy-dom');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('the committed artifact boots in a real DOM', () => {
  const window = new Window({url: 'https://example.test/'});
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.eval(script);
  assert.equal(window.document.querySelector('#recordForm') instanceof window.HTMLFormElement, true);
  assert.notEqual(window.document.querySelector('#activityDate').value, '');
  assert.notEqual(window.document.querySelector('#leaderRows').innerHTML, '');
});
