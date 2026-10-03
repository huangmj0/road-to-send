// Input tables shared by scripts/capture-validation-golden.mjs (which records the Apps Script's
// outputs) and tests/supabase-conformance.test.js (which asserts the Supabase core against them).
// Changing a table means regenerating tests/fixtures/supabase-validation.golden.json.

// vm objects come from another realm, so every result is compared through a JSON round trip.
export const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
export function outcome(run) {
  try {
    return {value: plain(run())};
  } catch (error) {
    if (!error.code) throw error;
    return {error: {code: error.code, message: error.message, details: plain(error.details)}};
  }
}

// JSON cannot hold undefined or Infinity, so the fixture spells them out.
export function encode(value) {
  if (value === undefined) return {$undefined: true};
  if (value === Infinity) return {$number: 'Infinity'};
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}
export function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if (value.$undefined === true) return undefined;
    if (value.$number === 'Infinity') return Infinity;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

export const PARITY_DATE_OBJECTS = ['2026-07-13T12:00:00Z', '2026-07-13T00:00:00Z', 'not a date'];
export const PARITY_CALENDAR = [[2026, 2, 29], [2024, 2, 29], [1899, 1, 1], [2200, 12, 31], ['2026', '07', '13'], [2026.5, 1, 1]];
export const PARITY_STATES = {
  empty: {config: null, crew: [], activityIds: []},
  seeded: {config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500}, crew: ['Alex', 'Maya'], activityIds: ['a1']},
};

export const PARITY_DATES = [
  '2026-07-13', '2026-7-3', ' 2026-07-13 ', '2024-02-29', '2025-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '1900-01-01', '1899-12-31', '2200-12-31', '2201-01-01',
  '07/13/2026', '7/3/2026', '07-13-2026', '13/07/2026', '02/29/2025', 'July 13, 2026', 'Jul 13 2026', 'july 3, 2026', 'SEPT 9, 2026', 'Sept 31, 2026', 'Foo 3, 2026', 'July 13th, 2026',
  '2026/07/13', '2026-07-13T00:00:00Z', '20260713', 'tomorrow', '', '   ', null, undefined, 20260713, 0, true,
];
export const PARITY_GOALS = [49, 50, 10000, 10001, '1,000', 12.5, '12.5', '500', ' 500 ', '1e3', '0x1F4', 'abc', '', null, undefined, -100, '10,001', Infinity, '50.0'];
export const PARITY_CREWS = [
  ['Alex', 'Maya'], ['Alex', 'alex', 'ALEX ', 'Maya'], ['', '  ', 'Zed', null, undefined, 0, {name: ''}], [{name: ' Maya '}, {nom: 'x'}, 'Maya'],
  ['x'.repeat(30)], ['x'.repeat(31)], ['Alex', 'y'.repeat(31)], ['', 'z'.repeat(31)], [], 'Alex', null, undefined, {name: 'Alex'}, [42, 'Alex'],
];
export const PARITY_CONFIGS = [
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: ['Alex']},
  {startDate: '7/1/2026', tripDate: 'July 31, 2026', goal: '1,000', crew: ['Alex', 'alex', 'Maya']},
  {startDate: '2026-07-31', tripDate: '2026-07-01', goal: 500, crew: ['Alex']},
  {startDate: '2026-07-31', tripDate: '2026-07-31', goal: 500, crew: ['Alex']},
  {startDate: 'soon', tripDate: '2026-02-30', goal: 12.5, crew: []},
  {startDate: '', tripDate: '', goal: '', crew: ['x'.repeat(31)]},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 10001, crew: ['Alex']},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 49, crew: ['Alex']},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: ['', ' ']},
  {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: ['Alex', 'x'.repeat(31)]},
  {}, null, 'config',
];
export const DAY = '2026-07-13';
export const PARITY_ACTIVITIES = rotation => {
  const catalog = rotation.catalog, offered = rotation.offered;
  const offDay = catalog.find(b => !offered.some(o => o.id === b.id));
  return [
    {name: 'Alex', type: 'climb', date: DAY},
    {name: ' alex ', type: 'climb', date: DAY, hardestGrade: 'V17', note: '  top out  ', points: 99, category: 'mobility'},
    {name: 'Maya', type: 'climb', date: DAY, hardestGrade: 'VB'},
    {name: 'Maya', type: 'climb', date: DAY, hardestGrade: 'v4'},
    {name: 'Maya', type: 'exercise', date: '07/13/2026', hardestGrade: 'V4', bountyId: offered[0].id},
    {name: 'Maya', type: 'mobility', date: 'July 13, 2026'},
    ...offered.map(b => ({name: 'Alex', type: 'bounty', date: DAY, bountyId: b.id, points: 0})),
    {name: 'Alex', type: 'bounty', date: DAY, bountyId: 'no-such-bounty'},
    {name: 'Alex', type: 'bounty', date: DAY},
    {name: 'Alex', type: 'bounty', date: DAY, bountyId: offDay.id},
    {name: 'Alex', type: 'bounty', date: '2026-02-30', bountyId: offered[0].id},
    {name: 'Alex', type: 'run', date: DAY},
    {name: 'Alex', type: 'Climb', date: DAY},
    {name: 'Alex', date: DAY},
    {name: 'Alex', type: 'mobility', date: DAY, note: 'n'.repeat(120)},
    {name: 'Alex', type: 'mobility', date: DAY, note: 'n'.repeat(121)},
    {name: 'Alex', type: 'mobility', date: DAY, note: ` ${'n'.repeat(120)} `},
    {name: 'Alex', type: 'climb', date: 'yesterday', hardestGrade: 'V99', note: 'n'.repeat(121)},
    {name: 'Alex', type: 'mobility'},
    {name: 'Nobody', type: 'run', date: 'never'},
    {name: '', type: 'climb', date: DAY},
    {type: 'climb', date: DAY},
    null,
    {name: 'Alex', type: 'mobility', date: '2026-06-30'},
    {name: 'Alex', type: 'mobility', date: '2026-07-01'},
    {name: 'Alex', type: 'mobility', date: '2026-07-31'},
    {name: 'Alex', type: 'mobility', date: '2026-08-01'},
  ];
};
export const PARITY_SETTINGS = {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500};
export const PARITY_CREW = ['Alex', 'Maya'];

// Raw POST bodies (strings are sent as-is, everything else JSON-encoded).
export const PARITY_REQUESTS = rotation => [
  '', 'not json', '{"a":', 'null', '[]', '5', '"x"', '{}',
  {action: '__smoke__'}, {action: 1}, {action: 'saveConfig'}, {action: 'saveConfig', config: 'x'},
  ...PARITY_CONFIGS.filter(c => c && typeof c === 'object').map(config => ({action: 'saveConfig', config})),
  ...['Zed', ' zed ', 'alex', 'MAYA', '', '  ', null, undefined, 42, 'q'.repeat(30), 'q'.repeat(31)].map(name => ({action: 'addParticipant', name})),
  ...['a1', ' a1 ', 'a2', '', '   ', null, undefined, 0].map(id => ({action: 'delete', id})),
  ...PARITY_ACTIVITIES(rotation).filter(Boolean),
].map(request => (typeof request === 'string' ? request : JSON.stringify(request)));

export const maskReply = reply => (reply.ok && 'createdAt' in reply ? {...reply, id: '<id>', createdAt: '<createdAt>'} : reply);
