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

test('the committed artifact deletes a local activity through its controls', async () => {
  const now = new Date();
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const window = new Window({url: 'https://example.test/'});
  window.localStorage.setItem('roadToSendConfigV9', JSON.stringify({startDate: day, tripDate: day, goal: 50, crew: [{name: 'Alex'}]}));
  window.localStorage.setItem('roadToSendMe', 'Alex');
  window.localStorage.setItem('roadToSendLogsV9', JSON.stringify([{id: 'local-1', name: 'Alex', type: 'climb', date: day, createdAt: '1'}]));
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.eval(script);
  const deleteButton = window.document.querySelector('#personalActivity [data-del]');
  assert.ok(deleteButton, 'a delete control is rendered for the local activity');
  assert.equal(window.document.querySelector('#youTotal').textContent, '3');
  deleteButton.dispatchEvent(new window.Event('click', {bubbles: true}));
  assert.equal(window.document.querySelector('#confirmModal').classList.contains('open'), true);
  window.document.querySelector('#confirmOk').dispatchEvent(new window.Event('click', {bubbles: true}));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(JSON.parse(window.localStorage.getItem('roadToSendLogsV9')).length, 0);
  assert.equal(window.document.querySelector('#personalActivity [data-del]'), null);
});

test('the committed artifact renders a shared Sheet response', async () => {
  const now = new Date();
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const window = new Window({url: 'https://example.test/'});
  window.localStorage.setItem('roadToSendEndpoint', 'https://sheet.example.test/exec');
  window.fetch = async () => ({ok: true, json: async () => ({version: 12, features: [], activities: [{id: 'shared-1', name: 'Alex', type: 'exercise', date: day, createdAt: '1'}], config: {startDate: day, tripDate: day, goal: 50, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: day, timeZone: 'America/Los_Angeles'})});
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(window.document.querySelector('#totalPoints').textContent, '2');
  assert.match(window.document.querySelector('#syncStatus').textContent, /^Live/);
});
