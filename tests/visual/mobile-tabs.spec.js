const {test, expect} = require('@playwright/test');

const FIXED_NOW = '2026-07-16T19:00:00.000Z';
const config = {
  startDate: '2026-07-01',
  tripDate: '2026-09-08',
  goal: 500,
  crew: [{name: 'Alex'}, {name: 'Maya'}, {name: 'Jordan'}],
};
const activities = [
  {id: 'a1', name: 'Alex', type: 'climb', hardestGrade: 'V5', date: '2026-07-16', createdAt: '2026-07-16T16:00:00.000Z'},
  {id: 'a2', name: 'Alex', type: 'exercise', note: 'Morning run', date: '2026-07-16', createdAt: '2026-07-16T17:00:00.000Z'},
  {id: 'a3', name: 'Maya', type: 'mobility', note: 'Shoulder prehab', date: '2026-07-16', createdAt: '2026-07-16T18:00:00.000Z'},
  {id: 'a4', name: 'Jordan', type: 'climb', hardestGrade: 'V3', date: '2026-07-15', createdAt: '2026-07-15T18:00:00.000Z'},
  {id: 'a5', name: 'Alex', type: 'mobility', note: 'Hip mobility', date: '2026-07-15', createdAt: '2026-07-15T19:00:00.000Z'},
];
const viewports = [
  {name: 'mobile-375x812', width: 375, height: 812},
  {name: 'mobile-390x844', width: 390, height: 844},
];

test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(new Date(FIXED_NOW));
  await page.addInitScript(({settings, logs}) => {
    localStorage.setItem('roadToSendConfigV9', JSON.stringify(settings));
    localStorage.setItem('roadToSendLogsV9', JSON.stringify(logs));
    localStorage.setItem('roadToSendMe', 'Alex');
  }, {settings: config, logs: activities});
});

for (const viewport of viewports) {
  test(`mobile tabs at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize({width: viewport.width, height: viewport.height});
    await page.goto('/#you');
    await expect(page.locator('#identityModal')).not.toHaveClass(/open/);

    for (const tab of ['you', 'record', 'crew']) {
      await page.locator(`.bottom-nav [data-tab="${tab}"]`).click();
      await expect(page.locator(`[data-panel="${tab}"]`)).toHaveClass(/active/);
      await expect(page).toHaveScreenshot(`${viewport.name}-${tab}.png`, {fullPage: false});
    }
  });
}
