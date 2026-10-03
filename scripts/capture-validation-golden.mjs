// Dev tool: runs every PARITY input through the frozen v13 Apps Script (legacy/apps-script-v13.js, read
// directly, so no build is needed) and records the normalized outputs in
// tests/fixtures/supabase-validation.golden.json. tests/supabase-conformance.test.js asserts the
// Supabase core against that file. It only ever reproduces the frozen v13 baseline, so do not rerun it
// once any expectation has been edited by hand: an intended behavior change, or a new input row whose
// expected outcome differs from the frozen script, is recorded by editing the fixture by hand.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {DAY, PARITY_ACTIVITIES, PARITY_CALENDAR, PARITY_CONFIGS, PARITY_CREW, PARITY_CREWS, PARITY_DATES, PARITY_DATE_OBJECTS, PARITY_GOALS, PARITY_REQUESTS, PARITY_SETTINGS, PARITY_STATES, encode, maskReply, outcome, plain} from '../tests/supabase/parity-inputs.mjs';
import {SCORING, dailyBounties} from '../supabase/functions/road-to-send/core.mjs';

const {loadScript} = createRequire(import.meta.url)('../tests/apps-script-harness.js');

// The Apps Script with its Sheet I/O replaced (same stubs as the conformance suite's parity tests).
function appsScriptBackend({config = null, crew = [], activityIds = []} = {}) {
  const context = loadScript();
  const sink = {getLastRow: () => 0, getRange: () => ({clearContent() {}, setValues() {}}), clearContents() {}};
  context.ContentService = {createTextOutput: text => ({setMimeType: () => text}), MimeType: {JSON: 'json'}};
  context.LockService = {getDocumentLock: () => ({waitLock() {}, releaseLock() {}})};
  context.setup = () => {};
  context.tab = () => sink;
  context.formatSheets = () => {};
  context.readConfig = () => ({config: config && {...config, crew: crew.map(name => ({name}))}, errors: [], movedTo: ''});
  context.participantRecords = () => crew.map(name => ({name}));
  context.appendActivity = item => item;
  context.deleteActivity = id => activityIds.includes(id);
  return context;
}

const entry = (input, expected) => ({input: encode(input), expected});
const cases = (inputs, run) => inputs.map(input => entry(input, run(input)));

export function captureGolden() {
  const script = appsScriptBackend();
  const rotation = {catalog: SCORING.bounties, offered: dailyBounties(DAY)};
  const activityScript = appsScriptBackend({config: PARITY_SETTINGS, crew: PARITY_CREW});
  const requests = PARITY_REQUESTS(rotation);
  return {
    dates: cases(PARITY_DATES, input => outcome(() => script.parseDateValue(input))),
    dateObjects: cases(PARITY_DATE_OBJECTS, iso => outcome(() => script.parseDateValue(vm.runInContext(`new Date(${JSON.stringify(iso)})`, script)))),
    calendarDates: cases(PARITY_CALENDAR, ([y, m, d]) => plain(script.calendarDate(y, m, d)) ?? null),
    goals: cases(PARITY_GOALS, input => outcome(() => script.parseGoal(input))),
    crews: cases(PARITY_CREWS, input => outcome(() => script.normalizeCrew(input))),
    configs: cases(PARITY_CONFIGS, input => outcome(() => script.writeConfig(input))),
    activities: cases(PARITY_ACTIVITIES(rotation), input => outcome(() => activityScript.validateActivityWindow(activityScript.validateActivity(input)))),
    requests: Object.fromEntries(Object.entries(PARITY_STATES).map(([state, setup]) => [state, requests.map(bodyText => entry(bodyText, maskReply(JSON.parse(appsScriptBackend(setup).doPost({postData: {contents: bodyText}})))))])),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL('../tests/fixtures/supabase-validation.golden.json', import.meta.url);
  const golden = captureGolden();
  fs.writeFileSync(target, `${JSON.stringify(golden, null, 2)}\n`);
  const counts = Object.entries(golden).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : Object.entries(v).map(([s, l]) => `${s}:${l.length}`).join(',')}`);
  console.log(`wrote ${fileURLToPath(target)}\n${counts.join(' ')}`);
}
