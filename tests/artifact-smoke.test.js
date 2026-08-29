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

test('the committed artifact records a local activity through its form', async () => {
  const now = new Date();
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const window = new Window({url: 'https://example.test/'});
  window.localStorage.setItem('roadToSendConfigV9', JSON.stringify({startDate: day, tripDate: day, goal: 50, crew: [{name: 'Alex'}]}));
  window.localStorage.setItem('roadToSendMe', 'Alex');
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.eval(script);
  const form = window.document.querySelector('#recordForm');
  form.dispatchEvent(new window.Event('submit', {bubbles: true, cancelable: true}));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(window.document.querySelector('#youTotal').textContent, '3');
  assert.match(window.localStorage.getItem('roadToSendLogsV9'), /"type":"climb"/);
  const bounty = window.document.querySelector('#todayBounties [data-claim-bounty]');
  assert.ok(bounty, 'a daily bounty claim is rendered');
  bounty.dispatchEvent(new window.Event('click', {bubbles: true}));
  assert.equal(window.document.querySelector('input[name="activityType"][value="bounty"]').checked, true);
  assert.equal(window.document.querySelector('#bountySelect').value, bounty.dataset.claimBounty);
});
