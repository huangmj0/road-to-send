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

test('the weekly recap opens only from its deliberate entry point', async () => {
  const now = new Date();
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const config = {startDate: day, tripDate: day, goal: 50, crew: [{name: 'Alex'}]};
  const window = new Window({url: 'https://example.test/'});
  window.localStorage.setItem('roadToSendConfigV9', JSON.stringify(config));
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.eval(script);

  const recap = window.document.querySelector('#weekReviewModal');
  assert.equal(recap.classList.contains('open'), false, 'boot does not open the recap');
  window.document.querySelector('#navCrew').click();
  window.document.querySelector('#navYou').click();
  assert.equal(recap.classList.contains('open'), false, 'navigation does not open the recap');

  window.document.querySelector('#identityMember').value = 'Alex';
  window.document.querySelector('#saveIdentity').click();
  assert.equal(recap.classList.contains('open'), false, 'identity selection does not open the recap');
  const openButton = window.document.querySelector('#weekReviewOpen');
  assert.equal(openButton.hidden, false, 'a chosen climber can reach the recap');
  openButton.focus();
  openButton.click();
  assert.equal(recap.classList.contains('open'), true, 'the recap opens after the explicit button click');
  assert.equal(window.document.querySelector('#weekReviewCelebrate').classList.contains('hide'), true, 'a recap with no personal achievement has no absence callout');
  assert.equal(window.document.querySelector('#weekReviewLeadersSection').classList.contains('hide'), true, 'a recap with no point earners has no participation prompt');
  assert.equal(window.document.querySelector('#weekReviewHunterSection').classList.contains('hide'), true, 'a recap with no bounty claims has no crown prompt');
  assert.doesNotMatch(recap.textContent, /log|make it count|weeks until|crown is up for grabs/i, 'the opened recap contains no participation or countdown pressure');
  window.document.querySelector('#weekReviewClose').click();
  assert.equal(window.document.activeElement, openButton, 'closing the recap returns focus to its entry point');

  const shared = new Window({url: 'https://example.test/'});
  shared.localStorage.setItem('roadToSendEndpoint', 'https://sheet.example.test/exec');
  shared.localStorage.setItem('roadToSendMe', 'Alex');
  shared.fetch = async () => ({ok: true, json: async () => ({version: 12, features: [], activities: [], config, configErrors: [], serverDate: day, timeZone: 'America/Los_Angeles'})});
  shared.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  shared.eval(script);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(shared.document.querySelector('#weekReviewModal').classList.contains('open'), false, 'shared sync does not open the recap');
});
