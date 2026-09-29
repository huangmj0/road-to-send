// Core of the Road to Send Supabase function: pure request handling, no Deno, no network.
// A second implementation of the Apps Script wire protocol (src/apps-script.js); the two must
// stay equal, which the conformance and parity suites enforce.
//
// handle({method, bodyText}, store, now) -> Promise<object>, the JSON body to send.
//   method    'GET' | 'POST' | ...   bodyText  the raw request body as text ('' for GET)
//   now       () => Date, the injected clock
//   store     the storage seam. Every method is async:
//               getSettings()      -> {startDate, tripDate, goal, timeZone} | null
//               listParticipants() -> [{name}] in roster (position) order
//               listActivities()   -> activity objects in feed (seq) order
//             Tickets that add writes extend this interface; store.mjs is the PostgREST
//             implementation and tests/supabase/memory-store.mjs the in-memory one.
// The transport that tests and the entry share is send({method, bodyText}) -> json.
import contract from './contract.generated.json' with {type: 'json'};

export const API_VERSION = contract.apiVersion;
export const SCORING = contract.scoring;
export const FEATURES = ['categories-v1', 'balanced-day-bonus', 'daily-bounties-v3', 'bounty-hunter', 'challenge-window', 'self-registration-v1'];

export function errorEnvelope(code, message, details = []) {
  return {version: API_VERSION, ok: false, error: {code, message, details}};
}

// A date as YYYY-MM-DD in an IANA time zone.
export function calendarDay(date, timeZone) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-US', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
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

function unsupportedAction(bodyText) {
  let action;
  try { action = JSON.parse(bodyText)?.action; } catch { /* the message below still applies */ }
  return errorEnvelope('unknown_action', `Unsupported action: ${String(action)}`);
}

export async function handle({method, bodyText}, store, now) {
  try {
    if (method === 'GET') return await readBoard(store, now);
    if (method === 'POST') return unsupportedAction(bodyText); // ticket 3 replaces this with the write actions
    return errorEnvelope('invalid_request', 'Unsupported request method');
  } catch {
    return errorEnvelope('server_error', 'The request could not be completed');
  }
}
