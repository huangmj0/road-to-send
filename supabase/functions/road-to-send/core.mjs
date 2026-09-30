// Core of the Road to Send Supabase function: pure request handling, no Deno, no network.
// A second implementation of the Apps Script wire protocol (src/apps-script.js); the two must
// stay equal, which the conformance and parity suites enforce. The validation helpers below are
// ported one for one from the Apps Script, so their messages and details match it exactly.
//
// handle({method, bodyText}, store, now) -> Promise<object>, the JSON body to send.
//   method    'GET' | 'POST' | ...   bodyText  the raw request body as text ('' for GET)
//   now       () => Date, the injected clock
//   store     the storage seam. Every method is async:
//               getSettings()      -> {startDate, tripDate, goal, timeZone} | null
//               listParticipants() -> [{name}] in roster (position) order
//               listActivities()   -> activity objects in feed (seq) order
//               saveConfig({startDate, tripDate, goal, crew})  crew is [name]; upserts the
//                                     settings (keeping timeZone) and replaces the roster in order
//               addParticipant(name) -> true once appended at the end of the roster, false when
//                                     the name already exists (case-insensitively)
//               appendActivity(activity) appends a validated activity (with id and createdAt)
//               deleteActivity(id) -> true when a row was deleted, false when none matched
//             store.mjs is the PostgREST implementation and tests/supabase/memory-store.mjs the
//             in-memory one.
// The transport that tests and the entry share is send({method, bodyText}) -> json.
import contract from './contract.generated.json' with {type: 'json'};

export const API_VERSION = contract.apiVersion;
export const SCORING = contract.scoring;
export const FEATURES = ['categories-v1', 'balanced-day-bonus', 'daily-bounties-v3', 'bounty-hunter', 'challenge-window', 'self-registration-v1'];

const GRADES = SCORING.grades;
const CATEGORIES = Object.keys(SCORING.categories);
const ACTIVITY_TYPES = ['climb', 'exercise', 'mobility', 'bounty'];
const MONTHS = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12};

export function errorEnvelope(code, message, details = []) {
  return {version: API_VERSION, ok: false, error: {code, message, details}};
}

// A validation failure the client sees, as the Apps Script's apiError throws it. Only these reach
// the wire with their own code; anything else thrown becomes server_error.
class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details || [];
  }
}

function apiError(code, message, details) {
  throw new ApiError(code, message, details);
}

// A date as YYYY-MM-DD in an IANA time zone.
export function calendarDay(date, timeZone) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-US', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function calendarDate(y, m, d) {
  y = Number(y);
  m = Number(m);
  d = Number(d);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1900 || y > 2200) return null;
  const x = new Date(Date.UTC(y, m - 1, d));
  if (x.getUTCFullYear() !== y || x.getUTCMonth() + 1 !== m || x.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// The Apps Script formats a Date cell in the Sheet's time zone; here the configured timeZone
// stands in. A JSON request body never carries a Date, so only direct callers reach that branch.
export function parseDateValue(v, timeZone = 'UTC') {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return {error: 'is not a valid date'};
    return {value: calendarDay(v, timeZone)};
  }
  const text = String(v == null ? '' : v).trim();
  if (!text) return {error: 'is required'};
  const found = value => (value ? {value} : {error: 'must be a real calendar date'});
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return found(calendarDate(m[1], m[2], m[3]));
  m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return found(calendarDate(m[3], m[1], m[2]));
  m = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{4})$/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return found(calendarDate(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2]));
  return {error: 'must use YYYY-MM-DD, MM/DD/YYYY, or a named month'};
}

export function parseGoal(v) {
  const text = String(v == null ? '' : v).trim().replace(/,/g, '');
  if (!text) return {error: 'is required'};
  const value = Number(text);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return {error: 'must be a whole number'};
  if (value < 50 || value > 10000) return {error: 'must be from 50 to 10,000'};
  return {value};
}

function configError(field, value, reason, cell) {
  return {field, cell: cell || 'Settings', value: String(value == null ? '' : value), reason};
}

// Trims, drops blanks and case-insensitive repeats (first spelling wins), rejects names over 30.
export function normalizeCrew(value) {
  const seen = {};
  return (Array.isArray(value) ? value : [])
    .map(x => ({name: String((typeof x === 'string' ? x : x && x.name) || '').trim()}))
    .filter(x => x.name && !seen[x.name.toLowerCase()] && (seen[x.name.toLowerCase()] = true))
    .map(x => {
      if (x.name.length > 30) apiError('invalid_config', 'Participant names must be 30 characters or fewer', [{field: 'crew', reason: 'name is too long'}]);
      return x;
    });
}

// The validation half of the Apps Script's writeConfig: returns the config it would write.
export function validateConfig(c) {
  const start = parseDateValue(c && c.startDate), trip = parseDateValue(c && c.tripDate), goal = parseGoal(c && c.goal), errors = [];
  if (start.error) errors.push(configError('challengeStart', c && c.startDate, start.error));
  if (trip.error) errors.push(configError('tripDate', c && c.tripDate, trip.error));
  if (start.value && trip.value && start.value > trip.value) errors.push(configError('challengeStart', start.value, 'must be on or before the challenge end'));
  if (goal.error) errors.push(configError('groupGoal', c && c.goal, goal.error));
  if (errors.length) apiError('invalid_config', 'Invalid challenge settings', errors);
  const crew = normalizeCrew(c && c.crew);
  if (!crew.length) apiError('invalid_config', 'Add at least one participant', [{field: 'crew', reason: 'is required'}]);
  return {startDate: start.value, tripDate: trip.value, goal: goal.value, crew};
}

export function hashText(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyBounties(date) {
  const day = String(date || '').slice(0, 10), out = [];
  CATEGORIES.forEach(cat => {
    const pool = SCORING.bounties.filter(b => b.category === cat);
    if (pool.length) out.push(pool[hashText(`${day}|${cat}`) % pool.length]);
  });
  return out;
}

function bountyById(id) {
  const key = String(id || '');
  return SCORING.bounties.find(b => b.id === key) || null;
}

function canonicalParticipant(name, participants) {
  const text = String(name == null ? '' : name).trim(), match = participants.find(x => x.name.toLowerCase() === text.toLowerCase());
  if (!text || !match) apiError('invalid_activity', 'Choose a participant from the Participants tab', [{field: 'name', reason: 'must match a participant'}]);
  return match;
}

// Category and points are derived here from the type or bounty, never taken from the request.
export function validateActivity(d, participants, timeZone = 'UTC') {
  const participant = canonicalParticipant(d && d.name, participants);
  const type = String((d && d.type) || ''), date = parseDateValue(d && d.date, timeZone), hardestGrade = String((d && d.hardestGrade) || '');
  const note = String((d && d.note) || '').trim(), bountyId = String((d && d.bountyId) || ''), errors = [];
  if (!ACTIVITY_TYPES.includes(type)) errors.push({field: 'type', reason: 'must be climb, exercise, mobility, or bounty'});
  if (date.error) errors.push({field: 'date', reason: date.error});
  if (type === 'climb' && hardestGrade && !GRADES.includes(hardestGrade)) errors.push({field: 'hardestGrade', reason: 'must be V0 through V17'});
  if (note.length > 120) errors.push({field: 'note', reason: 'must be 120 characters or fewer'});
  let bounty = null;
  if (type === 'bounty') {
    bounty = bountyById(bountyId);
    if (!bounty) errors.push({field: 'bountyId', reason: 'must be one of today’s bounties'});
    else if (date.value && !dailyBounties(date.value).some(b => b.id === bounty.id)) errors.push({field: 'bountyId', reason: 'is not available on that date'});
  }
  if (errors.length) apiError('invalid_activity', 'Invalid activity', errors);
  return {
    name: participant.name, type,
    category: type === 'bounty' ? bounty.category : type,
    points: type === 'bounty' ? bounty.points : SCORING.categories[type],
    date: date.value,
    hardestGrade: type === 'climb' ? hardestGrade : '',
    bountyId: type === 'bounty' ? bounty.id : '',
    bountyTitle: type === 'bounty' ? bounty.title : '',
    note,
  };
}

// Inclusive on both ends; with no config there is no window to check.
export function checkWindow(activity, config) {
  if (config && (activity.date < config.startDate || activity.date > config.tripDate)) {
    apiError('outside_challenge_window', `Activity date must be from ${config.startDate} through ${config.tripDate} (inclusive)`, [{field: 'date', reason: 'is outside the challenge window'}]);
  }
  return activity;
}

async function readBoard(store, now) {
  const [settings, participants, activities] = await Promise.all([store.getSettings(), store.listParticipants(), store.listActivities()]);
  const timeZone = settings?.timeZone || 'UTC', at = now();
  return {
    version: API_VERSION,
    features: FEATURES,
    activities,
    config: settings ? {startDate: settings.startDate, tripDate: settings.tripDate, goal: settings.goal, crew: participants.map(person => ({name: person.name}))} : null,
    configErrors: [],
    serverDate: calendarDay(at, timeZone),
    timeZone,
    fetchedAt: at.toISOString(),
  };
}

async function saveConfig(c, store) {
  const config = validateConfig(c);
  await store.saveConfig({startDate: config.startDate, tripDate: config.tripDate, goal: config.goal, crew: config.crew.map(x => x.name)});
  return {version: API_VERSION, features: FEATURES, ok: true, config, configErrors: []};
}

async function addParticipant(name, store) {
  const [settings, participants] = await Promise.all([store.getSettings(), store.listParticipants()]);
  if (!settings) apiError('setup_required', 'Challenge setup must be completed before profiles can be created');
  const person = normalizeCrew([{name}])[0];
  if (!person) apiError('invalid_participant', 'Enter a name', [{field: 'name', reason: 'is required'}]);
  const duplicate = () => apiError('duplicate_participant', 'That name already exists', [{field: 'name', reason: 'must be unique'}]);
  if (participants.some(x => x.name.toLowerCase() === person.name.toLowerCase())) duplicate();
  // The unique index still decides a race between two registrations of the same name.
  if (!(await store.addParticipant(person.name))) duplicate();
  const crew = participants.map(x => ({name: x.name})).concat([person]);
  return {version: API_VERSION, features: FEATURES, ok: true, participant: person, config: {startDate: settings.startDate, tripDate: settings.tripDate, goal: settings.goal, crew}, configErrors: []};
}

async function deleteActivity(rawId, store) {
  const id = String(rawId == null ? '' : rawId).trim();
  if (!id) apiError('invalid_delete', 'An activity id is required', [{field: 'id', reason: 'is required'}]);
  if (await store.deleteActivity(id)) return {version: API_VERSION, ok: true, deleted: id};
  // The Apps Script sends this envelope without a details array; parity keeps it that way.
  return {version: API_VERSION, ok: false, error: {code: 'not_found', message: 'Activity not found'}};
}

async function appendActivity(d, store, now) {
  const [settings, participants] = await Promise.all([store.getSettings(), store.listParticipants()]);
  const activity = checkWindow(validateActivity(d, participants, settings?.timeZone || 'UTC'), settings);
  const item = {id: crypto.randomUUID(), createdAt: now().toISOString(), ...activity};
  await store.appendActivity(item);
  return {version: API_VERSION, features: FEATURES, ok: true, ...item};
}

async function write(bodyText, store, now) {
  let d;
  try {
    d = JSON.parse(bodyText || '');
  } catch {
    apiError('invalid_json', 'Request body must be valid JSON');
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) apiError('invalid_request', 'Request body must be a JSON object');
  if (d.action === 'saveConfig') return saveConfig(d.config || {}, store);
  if (d.action === 'addParticipant') return addParticipant(d.name, store);
  if (d.action === 'delete') return deleteActivity(d.id, store);
  if (d.action) apiError('unknown_action', `Unsupported action: ${String(d.action)}`);
  return appendActivity(d, store, now);
}

export async function handle({method, bodyText}, store, now) {
  try {
    if (method === 'GET') return await readBoard(store, now);
    if (method === 'POST') return await write(bodyText, store, now);
    return errorEnvelope('invalid_request', 'Unsupported request method');
  } catch (error) {
    if (error instanceof ApiError) return errorEnvelope(error.code, error.message, error.details);
    return errorEnvelope('server_error', 'The request could not be completed');
  }
}
