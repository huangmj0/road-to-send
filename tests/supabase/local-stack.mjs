// The HTTP side of the real-Supabase conformance target (npm run test:supabase): where the local
// stack is, the transport that sends scenarios to the served function, and direct PostgREST access
// for resetting the database and probing RLS. Test tooling only; nothing here ships.
//
// Only a stack on loopback is accepted: resetDatabase() deletes every row, and the target must
// never reach a hosted project. The keys are the local stack's printed dev keys.
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const FUNCTION = 'road-to-send';

// `supabase status -o env` prints NAME="value" lines.
export function parseStatusEnv(text) {
  const vars = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/);
    if (m) vars[m[1]] = m[2] ?? m[3];
  }
  return vars;
}

// Throws unless every URL is on loopback. localStack() applies it, and the real-stack suite applies
// it again to the stack it is handed, before its first reset.
export function assertLoopback(...urls) {
  for (const url of urls) {
    if (!LOOPBACK.has(new URL(url).hostname)) throw new Error(`${url} is not a local stack; the real-stack target only runs against loopback`);
  }
}

export function localStack(statusText) {
  const vars = parseStatusEnv(statusText);
  for (const name of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
    if (!vars[name]) throw new Error(`\`supabase status -o env\` printed no ${name}; is the local stack running (supabase start)?`);
  }
  const apiUrl = vars.API_URL.replace(/\/+$/, '');
  const functionsUrl = (vars.FUNCTIONS_URL || `${apiUrl}/functions/v1`).replace(/\/+$/, '');
  assertLoopback(apiUrl, functionsUrl);
  return {apiUrl, functionUrl: `${functionsUrl}/${FUNCTION}`, anonKey: vars.ANON_KEY, serviceKey: vars.SERVICE_ROLE_KEY};
}

// The scenarios' transport over HTTP: send({method, bodyText}) -> parsed JSON. POSTs go as the
// browser sends them, text/plain;charset=utf-8. Anything but a 200 JSON reply throws with the
// status and the start of the body, so a gateway or runtime failure reads as one.
export function createHttpTransport(functionUrl, fetchImpl = fetch) {
  return async function send({method, bodyText}) {
    const init = method === 'POST' ? {method, headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: bodyText} : {method};
    const response = await fetchImpl(functionUrl, init);
    const text = await response.text();
    const type = response.headers.get('content-type') || '';
    if (response.status !== 200 || !/^application\/json\b/i.test(type)) {
      throw new Error(`${method} ${functionUrl} answered ${response.status} (${type || 'no content-type'}): ${text.slice(0, 500)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${method} ${functionUrl} answered 200 but the body is not JSON: ${text.slice(0, 500)}`);
    }
  };
}

// PostgREST through the local gateway with one key: the service-role key for resets and checks,
// the anon key for the RLS probes. Returns raw Responses; callers decide what a status means.
export function createRest({apiUrl, key, fetch: fetchImpl = fetch}) {
  const base = `${apiUrl.replace(/\/+$/, '')}/rest/v1`;
  const headers = {apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json'};
  return {
    select: table => fetchImpl(`${base}/${table}?select=*`, {headers}),
    insert: (table, row) => fetchImpl(`${base}/${table}`, {method: 'POST', headers: {...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal'}, body: JSON.stringify(row)}),
    // PostgREST (with pg-safeupdate) refuses an unfiltered DELETE, so each carries a match-all filter.
    removeAll: (table, column) => fetchImpl(`${base}/${table}?${column}=not.is.null`, {method: 'DELETE', headers: {...headers, Prefer: 'return=minimal'}}),
  };
}

// Empties every table, so each scenario starts from the empty backend it assumes. Faster than
// `supabase db reset`, and the schema itself is exactly what `supabase start` migrated.
export async function resetDatabase(serviceRest) {
  for (const [table, column] of [['activities', 'id'], ['participants', 'name'], ['settings', 'id']]) {
    const response = await serviceRest.removeAll(table, column);
    if (!response.ok) throw new Error(`reset: DELETE ${table} answered ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
}
