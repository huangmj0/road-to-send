const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadScript() {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
  const match = html.match(/const SCRIPT=(`[^`]*`);\nconst SUPPORTED_API_VERSIONS/);
  assert.ok(match, 'embedded Apps Script was found');
  const outer = {};
  vm.createContext(outer);
  vm.runInContext(`SCRIPT=${match[1]}`, outer);
  const context = {
    Utilities: {
      getUuid: () => 'uuid-test',
      formatDate: date => [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-'),
    },
    SpreadsheetApp: {getActive: () => ({getSpreadsheetTimeZone: () => 'UTC'})},
  };
  vm.createContext(context);
  vm.runInContext(outer.SCRIPT, context);
  context.__source = outer.SCRIPT;
  return context;
}

test('embedded v17 Apps Script advertises idempotent activity saves', () => {
  const context = loadScript();
  assert.equal(vm.runInContext('API_VERSION', context), 17);
  assert.deepEqual(Array.from(vm.runInContext('FEATURES', context)), ['categories-v1', 'balanced-day-bonus', 'daily-bounties-v3', 'bounty-hunter', 'challenge-window', 'self-registration-v1', 'idempotent-activity-v1']);
  assert.doesNotMatch(context.__source, /pullPoints|pullMode|saveBenchmark|durationBand/);
});

test('web requests use a script lock and preserve negotiated or legacy envelopes on errors', () => {
  const context = loadScript();
  let waited = 0, released = 0, documentLockCalls = 0;
  context.LockService = {
    getScriptLock: () => ({waitLock: ms => { assert.equal(ms, 10000); waited += 1; }, releaseLock: () => { released += 1; }}),
    getDocumentLock: () => { documentLockCalls += 1; return null; },
  };
  context.out = value => value;
  context.setup = () => {};

  const negotiated = context.doPost({postData: {contents: JSON.stringify({protocolVersion: 15, action: 'unknown'})}});
  assert.equal(negotiated.version, 15);
  assert.equal(negotiated.ok, false);
  assert.equal(negotiated.error.code, 'unknown_action');
  assert.ok(Array.from(negotiated.features).includes('protocol-negotiation-v1'));

  const legacy = context.doPost({postData: {contents: JSON.stringify({action: 'unknown'})}});
  assert.equal(legacy.version, 12, 'an already-open browser receives the old envelope');
  assert.equal(Array.from(legacy.features).includes('protocol-negotiation-v1'), false);
  assert.equal(waited, 2, 'each mutating request waits on the script-scoped lock');
  assert.equal(released, 2, 'each acquired lock is released after an error');
  assert.equal(documentLockCalls, 0, 'the null document lock is never requested in a web app');

  const malformed = context.doPost({postData: {contents: '{'}});
  assert.equal(malformed.version, 12);
  assert.equal(malformed.error.code, 'invalid_json');
  assert.equal(waited, 2, 'a rejected body does not acquire a mutation lock');

  context.LockService.getScriptLock = () => null;
  const unavailable = context.doPost({postData: {contents: JSON.stringify({protocolVersion: 13, action: 'unknown'})}});
  assert.equal(unavailable.version, 13);
  assert.equal(unavailable.error.code, 'runtime_lock');
});

test('GET negotiation is additive and failures use the selected envelope', () => {
  const context = loadScript();
  context.out = value => value;
  context.setup = () => {};
  context.readConfig = () => ({config: null, errors: []});
  context.rows = () => [];
  context.sheetToday = () => '2026-07-13';
  context.sheetTimeZone = () => 'UTC';
  assert.equal(context.doGet().version, 12);
  assert.equal(context.doGet({parameter: {protocolVersion: '13'}}).version, 13);
  assert.equal(context.negotiatedVersion(18), 12, 'a version newer than this deployment falls back to the legacy envelope');
  assert.equal(context.doGet({parameter: {protocolVersion: '14'}}).version, 14);
  assert.ok(context.responseFeatures(14).includes('literal-text-v1'));
  assert.equal(context.responseFeatures(14).includes('idempotent-activity-v1'), false);
  assert.ok(context.responseFeatures(15).includes('idempotent-activity-v1'));
  assert.equal(context.responseFeatures(15).includes('config-journal-v1'), false);
  assert.ok(context.responseFeatures(16).includes('config-journal-v1'));
  assert.equal(context.responseFeatures(16).includes('config-revision-v1'), false);
  assert.ok(context.responseFeatures(17).includes('config-revision-v1'));
  assert.equal(context.responseFeatures(13).includes('literal-text-v1'), false);
  context.setup = () => { context.apiError('runtime_configuration', 'not configured'); };
  const failed = context.doGet({parameter: {protocolVersion: '13'}});
  assert.equal(failed.version, 13);
  assert.equal(failed.error.code, 'runtime_configuration');
});

test('web runtime opens the configured spreadsheet when active document helpers are null', () => {
  const context = loadScript();
  const book = {getSpreadsheetTimeZone: () => 'UTC'};
  const store = {roadToSendSpreadsheetId: 'sheet-copy'};
  context.PropertiesService = {getScriptProperties: () => ({getProperty: key => store[key] || null, setProperty: (key, value) => { store[key] = value; }})};
  context.SpreadsheetApp = {getActive: () => null, openById: id => { assert.equal(id, 'sheet-copy'); return book; }};
  assert.equal(context.spreadsheet(), book);
  assert.equal(context.sheetTimeZone(), 'UTC');

  delete store.roadToSendSpreadsheetId;
  assert.throws(() => context.spreadsheet(), error => error.code === 'runtime_configuration');
  context.PropertiesService = {getScriptProperties: () => null, getDocumentProperties: () => null};
  assert.throws(() => context.runtimeProperties(), error => error.code === 'runtime_configuration');
});

test('backend derives category and bounty points instead of trusting the request', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Alex'}, {name: 'Maya'}];
  const climb = context.validateActivity({name: 'alex', type: 'climb', hardestGrade: 'V7', points: 999, date: '2026-07-13'});
  assert.equal(climb.name, 'Alex');
  assert.equal(climb.category, 'climb');
  assert.equal(climb.points, 3);
  assert.equal(climb.hardestGrade, 'V7');
  assert.equal(context.validateActivity({name: 'Maya', type: 'exercise', points: 0, date: '2026-07-13'}).points, 2);
  assert.equal(context.validateActivity({name: 'Maya', type: 'mobility', date: '2026-07-13'}).points, 1);
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'run', date: '2026-07-13'}), error => error.code === 'invalid_activity');
  assert.throws(() => context.validateActivity({name: 'Maya', type: 'climb', hardestGrade: 'VB', date: '2026-07-13'}), error => error.code === 'invalid_activity');
});

test('new activity names and notes round-trip as literal Sheet text', () => {
  const context = loadScript();
  context.receiptRecords = () => [];
  // Text-storage seam: runtime routing is exercised separately above.
  context.spreadsheet = () => context.SpreadsheetApp.getActive();
  const formulas = [];
  const writes = [];
  const parseCell = value => {
    if (typeof value === 'string' && value.startsWith('=')) {formulas.push(value); return '#FORMULA!'}
    return value;
  };
  const values = [Array.from(vm.runInContext('ACTIVITY_HEADERS', context))];
  const range = (row, col, rows = 1, cols = 1) => ({
    getValues: () => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => values[row - 1 + r]?.[col - 1 + c] ?? '')),
    setValues: input => {writes.push('values'); input.forEach((inputRow, r) => inputRow.forEach((value, c) => {(values[row - 1 + r] ||= [])[col - 1 + c] = parseCell(value)})); return range(row, col, rows, cols)},
    setRichTextValues: input => {writes.push('rich-text'); input.forEach((inputRow, r) => inputRow.forEach((value, c) => {(values[row - 1 + r] ||= [])[col - 1 + c] = value.getText()})); return range(row, col, rows, cols)},
  });
  const sheet = {
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    getRange: range,
    getDataRange: () => range(1, 1, values.length, values[0].length),
    appendRow: row => values.push(row.map(parseCell)),
  };
  context.SpreadsheetApp = {
    getActive: () => ({getSheetByName: () => sheet}),
    newRichTextValue: () => {let text = ''; return {setText: value => {text = value; return {build: () => ({getText: () => text})}}}},
  };
  const samples = [
    ['=1+1', '=HYPERLINK("https://example.test","x")'],
    ['+plus', '-minus'],
    ['@handle', "'apostrophe"],
    ['岩 🧗', '<b>& raw markup</b>'],
    ['Alex Smith', 'two  internal  spaces'],
  ];
  for (const [name, note] of samples) context.appendActivity({id: 'id-' + values.length, name, type: 'exercise', category: 'exercise', points: 2, date: '2026-07-13', createdAt: '2026-07-13T12:00:00Z', note});
  const saved = context.rows();
  assert.deepEqual(Array.from(saved, row => [row.name, row.note]), samples, 'every supported prefix, Unicode string, markup-like value, and internal whitespace survives the Sheet boundary exactly');
  assert.deepEqual(writes, samples.map(() => 'rich-text'), 'each activity is committed by one complete literal row write');
  assert.deepEqual(Array.from(saved, row => row.points), samples.map(() => 2), 'numeric text in a new point cell is normalized back to the numeric API type');
  assert.deepEqual(formulas, [], 'no user-controlled name or note is ever submitted to the formula-parsing value API');
});

test('a failed activity row commit leaves no partial row', () => {
  const context = loadScript();
  // Text-storage seam: runtime routing is exercised separately above.
  context.spreadsheet = () => context.SpreadsheetApp.getActive();
  const headers = Array.from(vm.runInContext('ACTIVITY_HEADERS', context));
  const values = [headers];
  const range = (row, col, rows = 1, cols = 1) => ({
    getValues: () => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => values[row - 1 + r]?.[col - 1 + c] ?? '')),
    setValues: input => {input.forEach((inputRow, r) => inputRow.forEach((value, c) => {(values[row - 1 + r] ||= [])[col - 1 + c] = value})); return range(row, col, rows, cols)},
    setRichTextValues: () => {throw Error('Sheet write failed')},
  });
  const sheet = {getLastRow: () => values.length, getLastColumn: () => headers.length, getRange: range};
  context.SpreadsheetApp = {
    getActive: () => ({getSheetByName: () => sheet}),
    newRichTextValue: () => {let text = ''; return {setText: value => {text = value; return {build: () => ({getText: () => text})}}}},
  };
  assert.throws(() => context.appendActivity({id: 'id-failed', name: '=Alex', type: 'exercise', category: 'exercise', points: 2, date: '2026-07-13', createdAt: '2026-07-13T12:00:00Z', note: '=1+1'}), /Sheet write failed/);
  assert.deepEqual(values, [headers], 'the only row mutation is the failed whole-row commit');
});

test('a bounty claim must be one of that date rotating set', () => {
  const context = loadScript();
  context.participantRecords = () => [{name: 'Alex'}];
  const date = '2026-07-13';
  const offered = context.dailyBounties(date);
  assert.equal(offered.length, 3);
  const claim = context.validateActivity({name: 'Alex', type: 'bounty', bountyId: offered[0].id, points: 999, date});
  assert.equal(claim.type, 'bounty');
  assert.equal(claim.points, offered[0].points);
  assert.equal(claim.category, offered[0].category);
  assert.equal(claim.bountyTitle, offered[0].title);
  const catalog = vm.runInContext('SCORING.bounties', context);
  const sameCategoryOther = catalog.find(b => b.category === offered[0].category && b.id !== offered[0].id);
  assert.throws(() => context.validateActivity({name: 'Alex', type: 'bounty', bountyId: sameCategoryOther.id, date}), error => error.details.some(x => x.field === 'bountyId'));
  assert.throws(() => context.validateActivity({name: 'Alex', type: 'bounty', bountyId: 'not-a-bounty', date}), error => error.code === 'invalid_activity');
});

test('self-registration adds one name-only participant and rejects duplicate names', () => {
  const context = loadScript();
  const current = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]};
  context.readConfig = () => ({config: current, errors: []});
  context.writeConfig = config => config;
  const added = context.addParticipant('Maya');
  assert.equal(added.participant.name, 'Maya');
  assert.deepEqual(Array.from(added.config.crew, person => ({...person})), [{name: 'Alex'}, {name: 'Maya'}]);
  assert.throws(() => context.addParticipant('alex'), error => error.code === 'duplicate_participant');
});

test('setup writes formula-like participant names as literal text after existing trim normalization', () => {
  const context = loadScript();
  // Text-storage seam: runtime routing is exercised separately above.
  context.spreadsheet = () => context.SpreadsheetApp.getActive();
  const formulas = [];
  const literals = [];
  const makeRange = () => ({
    clearContent() {return this},
    setValues(rows) {for (const row of rows) for (const value of row) if (typeof value === 'string' && value.startsWith('=')) formulas.push(value); return this},
    setRichTextValues(rows) {literals.push(...rows.flat().map(value => value.getText())); return this},
  });
  const settings = {getLastRow: () => 0, getRange: makeRange};
  const participants = {clearContents() {}, getRange: makeRange};
  const activities = {};
  context.SpreadsheetApp = {
    getActive: () => ({getSheetByName: name => ({Settings: settings, Participants: participants, Activities: activities})[name]}),
    newRichTextValue: () => {let text = ''; return {setText: value => {text = value; return {build: () => ({getText: () => text})}}}},
  };
  context.formatSheets = () => {};
  const saved = context.projectConfig(context.validateConfig({startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: '  =Alex 🧗  '}]}));
  assert.equal(saved.crew[0].name, '=Alex 🧗', 'the preexisting outer trim remains the only name normalization');
  assert.deepEqual(formulas, [], 'the normalized name never reaches formula-parsing setValues');
  assert.deepEqual(literals, ['=Alex 🧗'], 'the normalized name is written through the literal text API');
});

test('config commands commit once, replay immutably, and never roll the head backward', () => {
  const context = loadScript();
  const cells = [['entry']];
  let failCommit = false;
  const journal = {
    getLastRow: () => cells.length,
    getDataRange: () => ({getValues: () => cells.map(row => [...row])}),
    getRange: row => ({setValue: value => {if (failCommit) throw Error('commit failed'); cells[row - 1] = [value]}}),
  };
  context.tab = name => {assert.equal(name, 'Config Journal'); return journal};
  context.projectConfig = config => config;
  context.Utilities.getUuid = () => 'receipt-id';
  const first = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]};
  const second = {startDate: '2026-07-01', tripDate: '2026-08-31', goal: 700, crew: [{name: 'Alex'}, {name: 'Maya'}]};
  const result = context.saveConfigCommand('command-1', first);
  assert.deepEqual(JSON.parse(JSON.stringify(result.config)), first);
  assert.equal(cells.length, 2, 'one complete journal cell is the commit point');
  assert.deepEqual(JSON.parse(JSON.stringify(context.saveConfigCommand('command-1', first))), JSON.parse(JSON.stringify(result)), 'replay returns the original immutable result');
  assert.equal(cells.length, 2, 'replay does not append another commit');
  assert.throws(() => context.saveConfigCommand('command-1', second), error => error.code === 'command_mismatch');
  context.saveConfigCommand('command-2', second);
  context.saveConfigCommand('command-1', first);
  assert.deepEqual(JSON.parse(JSON.stringify(context.readConfig().config)), second, 'replaying an older command does not roll the committed head backward');
  failCommit = true;
  assert.throws(() => context.saveConfigCommand('command-3', first), /commit failed/);
  assert.equal(cells.length, 3, 'a failed single-cell commit leaves no partial journal entry');
  failCommit = false;
  context.projectConfig = () => {throw Error('projection interrupted')};
  assert.throws(() => context.saveConfigCommand('command-3', first), /projection interrupted/);
  assert.equal(cells.length, 4, 'the complete command remains committed when rollback projection repair is interrupted');
  assert.deepEqual(JSON.parse(JSON.stringify(context.readConfig().config)), first, 'a cold read sees the complete journal head instead of the interrupted projection');
  context.projectConfig = config => config;
  const recovered = context.saveConfigCommand('command-3', first);
  assert.equal(recovered.configCommandId, 'command-3');
  assert.equal(cells.length, 4, 'recovery returns the original receipt without another commit');
  const oversized = {...first, crew: Array.from({length: 2000}, (_, i) => ({name: 'Climber ' + String(i).padStart(20, '0')}))};
  assert.throws(() => context.saveConfigCommand('command-large', oversized), error => error.code === 'config_too_large');
  assert.equal(cells.length, 4, 'oversize validation happens before the commit point');
});

test('every rollback projection interruption recovers from the committed journal without touching activities', () => {
  const config = {startDate: '2026-07-01', tripDate: '2026-08-31', goal: 700, crew: [{name: 'Alex'}, {name: 'Maya'}]};
  for (let failAt = 1; failAt <= 6; failAt++) {
    const context = loadScript();
    const journalCells = [['entry']];
    const activities = [['id'], ['activity-kept']];
    let stepNumber = 0;
    const step = () => {stepNumber++; if (stepNumber === failAt) throw Error('projection step ' + failAt)};
    const journal = {getLastRow: () => journalCells.length, getDataRange: () => ({getValues: () => journalCells.map(row => [...row])}), getRange: row => ({setValue: value => {journalCells[row - 1] = [value]}})};
    const settings = {getLastRow: () => 4, getRange: () => ({clearContent: () => {step()}, setValues: () => {step()}})};
    const participants = {clearContents: () => {step()}, getRange: () => ({setValues: () => {step()}, setRichTextValues: () => {step()}})};
    context.tab = name => ({'Config Journal': journal, Settings: settings, Participants: participants, Activities: activities})[name];
    context.SpreadsheetApp.newRichTextValue = () => ({setText: text => ({build: () => text})});
    context.formatSheets = () => {step()};
    assert.throws(() => context.saveConfigCommand('command-' + failAt, config), new RegExp('projection step ' + failAt));
    assert.equal(journalCells.length, 2, 'step ' + failAt + ' fails after the complete journal commit');
    assert.deepEqual(JSON.parse(JSON.stringify(context.readConfig().config)), config, 'step ' + failAt + ' cannot expose a partial projection to current readers');
    assert.deepEqual(activities, [['id'], ['activity-kept']], 'step ' + failAt + ' leaves activities untouched');
    stepNumber = -100;
    context.saveConfigCommand('command-' + failAt, config);
    assert.equal(journalCells.length, 2, 'step ' + failAt + ' replay repairs without appending');
  }
});

test('revisioned setup commits reject stale drafts with the current snapshot and never append on conflict', () => {
  const context = loadScript();
  const cells = [['entry']];
  const journal = {
    getLastRow: () => cells.length,
    getDataRange: () => ({getValues: () => cells.map(row => [...row])}),
    getRange: row => ({setValue: value => {cells[row - 1] = [value]}}),
  };
  context.tab = name => {assert.equal(name, 'Config Journal'); return journal};
  context.projectConfig = config => config;
  context.Utilities.getUuid = () => 'receipt-id';
  const first = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]};
  const second = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}, {name: 'Maya'}]};
  context.saveConfigCommand('command-1', first, 0);
  const committed = context.saveConfigCommand('command-2', second, 1);
  assert.equal(committed.configRevision, 2);
  assert.throws(() => context.saveConfigCommand('command-3', {...second, goal: 700}, 1), error => {
    assert.equal(error.code, 'config_conflict');
    assert.deepEqual(JSON.parse(JSON.stringify(error.currentConfig)), second);
    assert.equal(error.currentConfigRevision, 2);
    return true;
  });
  assert.equal(cells.length, 3, 'a stale draft does not append a journal entry');
  assert.deepEqual(JSON.parse(JSON.stringify(context.readConfig().config)), second, 'the committed head remains current');
});

test('revisioned web saves serialize two organizers and expose a structured conflict envelope', () => {
  const context = loadScript();
  const cells = [['entry']];
  const journal = {
    getLastRow: () => cells.length,
    getDataRange: () => ({getValues: () => cells.map(row => [...row])}),
    getRange: row => ({setValue: value => {cells[row - 1] = [value]}}),
  };
  context.tab = name => {assert.equal(name, 'Config Journal'); return journal};
  context.setup = () => {};
  context.projectConfig = config => config;
  context.out = value => value;
  context.LockService = {getScriptLock: () => ({waitLock() {}, releaseLock() {}})};
  let receipt = 0;
  context.Utilities.getUuid = () => 'receipt-' + (++receipt);
  const base = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]};
  const joined = {...base, crew: [...base.crew, {name: 'Maya'}]};
  const post = body => context.doPost({postData: {contents: JSON.stringify(body)}});
  const first = post({protocolVersion: 17, action: 'saveConfig', configCommandId: 'organizer-a', expectedConfigRevision: 0, config: base});
  assert.equal(first.ok, true);
  const second = post({protocolVersion: 17, action: 'saveConfig', configCommandId: 'organizer-b', expectedConfigRevision: 1, config: joined});
  assert.equal(second.configRevision, 2);
  const conflict = post({protocolVersion: 17, action: 'saveConfig', configCommandId: 'organizer-c', expectedConfigRevision: 1, config: {...joined, goal: 700}});
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.code, 'config_conflict');
  assert.deepEqual(JSON.parse(JSON.stringify(conflict.config)), joined);
  assert.equal(conflict.configRevision, 2);
  assert.equal(cells.length, 3, 'the rejected organizer does not append a journal cell');
});

test('profile projection appends one literal participant while the journal remains authoritative', () => {
  const context = loadScript();
  const journalCells = [['entry']];
  const participantRows = [['name'], ['Alex']];
  const journal = {
    getLastRow: () => journalCells.length,
    getDataRange: () => ({getValues: () => journalCells.map(row => [...row])}),
    getRange: row => ({setValue: value => {journalCells[row - 1] = [value]}}),
  };
  const literals = [];
  const participants = {
    getDataRange: () => ({getValues: () => participantRows.map(row => [...row])}),
    getLastRow: () => participantRows.length,
    getRange: () => ({setRichTextValues: rows => {literals.push(...rows.flat().map(value => value.getText())); participantRows.push([literals.at(-1)]);}}),
    clearContents: () => {throw Error('normal profile projection must not clear the roster')},
  };
  const settings = {getDataRange: () => ({getValues: () => [['key', 'value'], ['challengeStart', '2026-07-01'], ['tripDate', '2026-07-31'], ['groupGoal', 500]]})};
  context.tab = name => ({'Config Journal': journal, Participants: participants, Settings: settings})[name];
  context.SpreadsheetApp.newRichTextValue = () => {let text = ''; return {setText: value => {text = value; return {build: () => ({getText: () => text})}}}};
  context.projectConfig = config => config;
  context.Utilities.getUuid = () => 'receipt-id';
  const current = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]};
  context.saveConfigCommand('command-1', current, 0);
  context.projectConfig = () => {throw Error('profile projection must append')};
  const added = context.addParticipant('=Maya');
  assert.equal(added.configRevision, 2);
  assert.deepEqual(participantRows, [['name'], ['Alex'], ['=Maya']]);
  assert.deepEqual(literals, ['=Maya']);
  assert.deepEqual(JSON.parse(JSON.stringify(context.readConfig().config.crew)), [{name: 'Alex'}, {name: '=Maya'}]);
});

test('legacy setup saves remain last-writer-wins when no revision is supplied', () => {
  const context = loadScript();
  const cells = [['entry']];
  const journal = {getLastRow: () => cells.length, getDataRange: () => ({getValues: () => cells.map(row => [...row])}), getRange: row => ({setValue: value => {cells[row - 1] = [value]}})};
  context.tab = name => {assert.equal(name, 'Config Journal'); return journal};
  context.setup = () => {};
  context.projectConfig = config => config;
  context.out = value => value;
  context.LockService = {getScriptLock: () => ({waitLock() {}, releaseLock() {}})};
  const config = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Alex'}]};
  const post = body => context.doPost({postData: {contents: JSON.stringify(body)}});
  const first = post({protocolVersion: 17, configCommandId: 'legacy-first', action: 'saveConfig', config});
  const second = post({protocolVersion: 17, configCommandId: 'legacy-second', action: 'saveConfig', config: {...config, goal: 700}});
  assert.equal(first.ok, true);
  assert.equal(second.ok, true, 'a request without an expected revision keeps legacy behavior');
  assert.equal(second.configRevision, 2);
  for (const protocolVersion of [16, 17]) {
    const missing = post({protocolVersion, action: 'saveConfig', config});
    assert.equal(missing.error.code, 'invalid_command', 'negotiated durable setup cannot silently substitute a random command ID');
  }
  const oldBrowser = post({action: 'saveConfig', config: {...config, goal: 800}});
  assert.equal(oldBrowser.ok, true, 'unnegotiated legacy setup still accepts no command ID or revision');
  assert.equal(oldBrowser.configRevision, 3);
});

test('challenge window remains inclusive', () => {
  const context = loadScript();
  context.readConfig = () => ({config: {startDate: '2026-07-01', tripDate: '2026-07-31'}, errors: []});
  assert.equal(context.validateActivityWindow({date: '2026-07-01'}).date, '2026-07-01');
  assert.equal(context.validateActivityWindow({date: '2026-07-31'}).date, '2026-07-31');
  assert.throws(() => context.validateActivityWindow({date: '2026-08-01'}), error => error.code === 'outside_challenge_window');
});

test('negotiated activity receipts survive interruption and replay without duplication', () => {
  const context = loadScript();
  const receipts = [], projected = [];
  let nextId = 0, projectionFails = true;
  context.Utilities.getUuid = () => 'saved-' + (++nextId);
  context.LockService = {getScriptLock: () => ({waitLock() {}, releaseLock() {}})};
  context.out = value => value;
  context.setup = () => {};
  context.participantRecords = () => [{name: 'Alex'}];
  context.readConfig = () => ({config: {startDate: '2026-07-01', tripDate: '2026-07-31'}, errors: []});
  context.receiptRecords = () => receipts.map(record => JSON.parse(JSON.stringify(record)));
  context.appendReceipt = record => {receipts.push(JSON.parse(JSON.stringify(record))); return record;};
  context.projectActivity = item => {if (projectionFails) throw Error('interrupted projection'); projected.push(JSON.parse(JSON.stringify(item))); return item;};
  const request = {protocolVersion: 15, mutationId: 'mutation-1', name: 'Alex', type: 'climb', date: '2026-07-13', hardestGrade: 'V5', note: 'Steep red problem'};
  const post = body => context.doPost({postData: {contents: JSON.stringify(body)}});

  const interrupted = post(request);
  assert.equal(interrupted.ok, false, 'an interruption after the receipt does not claim success');
  assert.equal(receipts.length, 1, 'the immutable receipt is the single domain commit');
  const original = receipts[0].result;

  projectionFails = false;
  const replay = post(request);
  assert.equal(replay.ok, true);
  assert.equal(replay.id, original.id, 'replay returns the original canonical id');
  assert.equal(replay.createdAt, original.createdAt, 'replay returns the original timestamp');
  assert.equal(receipts.length, 1, 'replay writes no second receipt');
  assert.equal(projected.length, 1, 'replay repairs the missing materialized row once');

  const mismatch = post({...request, note: 'Different climb'});
  assert.equal(mismatch.error.code, 'mutation_mismatch', 'one mutation id cannot name different content');
  const intentionalRepeat = post({...request, mutationId: 'mutation-2'});
  assert.equal(intentionalRepeat.ok, true, 'equal content with a different mutation id is intentional');
  assert.notEqual(intentionalRepeat.id, replay.id);
  assert.equal(receipts.length, 2);

  receipts.push({kind: 'delete', activityId: replay.id, deletedAt: 'later'});
  projected.length = 0;
  const deletedReplay = post(request);
  assert.equal(deletedReplay.id, replay.id, 'a deleted command still returns its original result');
  assert.equal(projected.length, 0, 'replay never resurrects a tombstoned activity');
});

test('v9 setup archives prior activity and benchmark sheets exactly once and rewrites to name-only participants', () => {
  const context = loadScript();
  class Sheet {
    constructor(book, name, values = []) { this.book = book; this.name = name; this.values = values.map(row => [...row]); }
    getName() { return this.name; }
    setName(name) { delete this.book.sheets[this.name]; this.name = name; this.book.sheets[name] = this; }
    getLastRow() { return this.values.length; }
    getLastColumn() { return Math.max(0, ...this.values.map(row => row.length)); }
    appendRow(row) { this.values.push([...row]); }
    getRange(row, col, rows = 1, cols = 1) { return {
      getValues: () => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => this.values[row - 1 + r]?.[col - 1 + c] ?? '')),
      setValue: value => { this.values[row - 1] ||= []; this.values[row - 1][col - 1] = value; },
    }; }
  }
  const book = {sheets: {}, getSheetByName(name) { return this.sheets[name] || null; }, insertSheet(name) { return this.sheets[name] = new Sheet(this, name); }, getSpreadsheetTimeZone: () => 'UTC'};
  book.sheets.Activities = new Sheet(book, 'Activities', [['id'], ['old']]);
  book.sheets.Benchmarks = new Sheet(book, 'Benchmarks', [['id'], ['old-benchmark']]);
  book.sheets.Settings = new Sheet(book, 'Settings', [['key', 'value']]);
  book.sheets.Participants = new Sheet(book, 'Participants', [['name'], ['Alex']]);
  let schema = '8';
  context.SpreadsheetApp.getActive = () => book;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: () => schema, setProperty: (_, value) => { schema = value; }})};
  context.formatSheets = () => {};
  context.setup();
  context.setup();
  assert.equal(schema, '9');
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Activities Archive')).length, 1);
  assert.equal(Object.keys(book.sheets).filter(name => name.startsWith('Benchmarks Archive')).length, 1);
  assert.deepEqual(book.sheets.Activities.values[0], Array.from(vm.runInContext('ACTIVITY_HEADERS', context)));
  assert.deepEqual(book.sheets.Participants.values[0], ['name']);
  assert.equal(book.sheets.Participants.values[1][0], 'Alex');
});

test('formatSheets runs once while provisioning, then every read and write skips it', () => {
  const context = loadScript();
  class Sheet {
    constructor(book, name, values = []) { this.book = book; this.name = name; this.values = values.map(row => [...row]); }
    getName() { return this.name; }
    setName(name) { delete this.book.sheets[this.name]; this.name = name; this.book.sheets[name] = this; }
    getLastRow() { return this.values.length; }
    getLastColumn() { return Math.max(0, ...this.values.map(row => row.length)); }
    appendRow(row) { this.values.push([...row]); }
    getRange(row, col, rows = 1, cols = 1) { return {
      getValues: () => Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => this.values[row - 1 + r]?.[col - 1 + c] ?? '')),
      setValue: value => { this.values[row - 1] ||= []; this.values[row - 1][col - 1] = value; },
    }; }
  }
  const makeBook = () => ({sheets: {}, getSheetByName(name) { return this.sheets[name] || null; }, insertSheet(name) { return this.sheets[name] = new Sheet(this, name); }, getSpreadsheetTimeZone: () => 'UTC'});
  let formats = 0;
  context.formatSheets = () => { formats += 1; };

  // A brand-new doc: the first setup() provisions and formats once; a second identical setup()
  // (schema now stamped) is the steady state every doGet/doPost hits and must not format again.
  const fresh = makeBook();
  const freshStore = {};
  context.SpreadsheetApp.getActive = () => fresh;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: key => key in freshStore ? freshStore[key] : null, setProperty: (key, value) => { freshStore[key] = value; }})};
  context.setup();
  assert.equal(formats, 1, 'the first setup() on an unprovisioned doc formats exactly once');
  context.setup();
  context.setup();
  assert.equal(formats, 1, 'once the schema is stamped, later setup() calls never re-run formatSheets');

  // An already-provisioned doc (the live Sheet after redeploy) never pays for formatSheets at all.
  formats = 0;
  const live = makeBook();
  live.sheets.Activities = new Sheet(live, 'Activities', [Array.from(vm.runInContext('ACTIVITY_HEADERS', context))]);
  live.sheets.Settings = new Sheet(live, 'Settings', [['key', 'value']]);
  live.sheets.Participants = new Sheet(live, 'Participants', [['name'], ['Alex']]);
  context.SpreadsheetApp.getActive = () => live;
  context.PropertiesService = {getDocumentProperties: () => ({getProperty: () => '9', setProperty: () => {}})};
  context.setup();
  assert.equal(formats, 0, 'a doc already stamped at the current schema formats zero times');
  assert.equal(Object.keys(live.sheets).filter(name => name.startsWith('Activities Archive')).length, 0, 'and its live data is never archived');

  // A copied Sheet can retain current tabs while document properties are unavailable in a web-app
  // execution. Complete current headers are sufficient evidence to stamp, never archive, that copy.
  const copied = makeBook();
  copied.sheets.Activities = new Sheet(copied, 'Activities', [Array.from(vm.runInContext('ACTIVITY_HEADERS', context)), ['kept-id']]);
  copied.sheets.Settings = new Sheet(copied, 'Settings', [['key', 'value']]);
  copied.sheets.Participants = new Sheet(copied, 'Participants', [['name'], ['Alex']]);
  const copiedStore = {roadToSendSpreadsheetId: 'copied-id'};
  context.SpreadsheetApp = {getActive: () => null, openById: id => { assert.equal(id, 'copied-id'); return copied; }};
  context.PropertiesService = {getScriptProperties: () => ({getProperty: key => copiedStore[key] || null, setProperty: (key, value) => { copiedStore[key] = value; }}), getDocumentProperties: () => null};
  context.setup();
  assert.equal(copiedStore.roadToSendSchema, '9');
  assert.equal(copied.sheets.Activities.values[1][0], 'kept-id', 'current copied activity rows survive missing document properties');
  assert.equal(Object.keys(copied.sheets).filter(name => name.indexOf(' Archive ') >= 0).length, 0, 'a current copied schema creates no archive tabs');
});

// This read seam supplies raw rows and receipts; it does not simulate Sheet writes.
test('receipt overlays preserve historical rows with blank or repeated IDs', () => {
  const context = loadScript();
  const headers = Array.from(vm.runInContext('ACTIVITY_HEADERS', context));
  const history = [
    {id: '', name: 'Alex', note: 'first blank'},
    {id: '', name: 'Maya', note: 'second blank'},
    {id: 'old-id', name: 'Alex', note: 'first repeated'},
    {id: 'old-id', name: 'Maya', note: 'second repeated'},
    {id: 'committed', name: 'Alex', note: 'projection'},
  ].map(item => Object.assign({type: 'exercise', category: 'exercise', points: 2, date: '2026-07-13'}, item));
  context.tab = () => ({getDataRange: () => ({getValues: () => [headers, ...history.map(item => headers.map(key => item[key] ?? ''))]})});
  context.receiptRecords = () => [];
  const original = JSON.parse(JSON.stringify(context.rows()));
  assert.equal(original.length, 5);
  assert.deepEqual(original.map(item => item.note), history.map(item => item.note));
  const canonical = Object.assign({}, original[4], {note: 'canonical'});
  const unprojected = Object.assign({}, canonical, {id: 'unprojected'});
  context.receiptRecords = () => [
    {kind: 'activity', result: canonical},
    {kind: 'activity', result: unprojected},
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(context.rows())), original.slice(0, 4).concat([canonical, unprojected]));
  context.receiptRecords = () => [{kind: 'activity', result: canonical}, {kind: 'delete', activityId: 'committed'}];
  assert.deepEqual(JSON.parse(JSON.stringify(context.rows())), original.slice(0, 4));
});
