// The PostgREST implementation of the store interface described in core.mjs. Plain fetch
// against the auto-injected SUPABASE_URL with the service-role key; no supabase-js.
// A failed request throws, which the handler turns into the server_error envelope; the one
// failure with a wire meaning is a unique violation on a participant name (Postgres 23505,
// which PostgREST answers with 409), reported as addParticipant() -> false.
const PAGE = 1000; // Supabase caps a PostgREST response at 1000 rows by default; page past it.
const ACTIVITY_COLUMNS = 'id,name,type,category,points,date,created_at,hardest_grade,bounty_id,bounty_title,note';

export function createPostgrestStore({url, serviceKey, fetch: fetchImpl = fetch}) {
  const base = `${String(url).replace(/\/+$/, '')}/rest/v1`;
  const headers = {apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json'};

  const failure = (path, response) => new Error(`PostgREST ${path.split('?')[0]} failed with ${response.status}`);

  async function getRows(path) {
    const response = await fetchImpl(`${base}/${path}`, {method: 'GET', headers});
    if (!response.ok) throw failure(path, response);
    return response.json();
  }

  // A write with a JSON body; returns the raw response so callers can read an expected failure.
  function send(method, path, body, prefer) {
    return fetchImpl(`${base}/${path}`, {method, headers: {...headers, 'Content-Type': 'application/json', Prefer: prefer}, body: body === undefined ? undefined : JSON.stringify(body)});
  }

  async function errorCode(response) {
    try { return (await response.json())?.code; } catch { return undefined; }
  }

  async function getAll(path) {
    const rows = [];
    for (;;) {
      const page = await getRows(`${path}&limit=${PAGE}&offset=${rows.length}`);
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }

  return {
    async getSettings() {
      const [row] = await getRows('settings?select=start_date,trip_date,goal,time_zone&id=eq.1');
      return row ? {startDate: row.start_date, tripDate: row.trip_date, goal: row.goal, timeZone: row.time_zone} : null;
    },
    async listParticipants() {
      return (await getAll('participants?select=name&order=position.asc')).map(row => ({name: row.name}));
    },
    async listActivities() {
      return (await getAll(`activities?select=${ACTIVITY_COLUMNS}&order=seq.asc`)).map(row => ({
        id: row.id, name: row.name, type: row.type, category: row.category, points: row.points, date: row.date,
        createdAt: row.created_at, hardestGrade: row.hardest_grade, bountyId: row.bounty_id, bountyTitle: row.bounty_title, note: row.note,
      }));
    },
    async saveConfig({startDate, tripDate, goal, crew}) {
      const response = await send('POST', 'rpc/save_config', {p_start: startDate, p_trip: tripDate, p_goal: goal, p_crew: crew}, 'return=minimal');
      if (!response.ok) throw failure('rpc/save_config', response);
    },
    async addParticipant(name) {
      // Appends at max(position)+1. Two registrations racing may share a position; the unique
      // name index still rejects a duplicate, and roster order stays stable either way.
      const [last] = await getRows('participants?select=position&order=position.desc&limit=1');
      const response = await send('POST', 'participants', {name, position: last ? last.position + 1 : 0}, 'return=minimal');
      if (response.ok) return true;
      if (response.status === 409 && (await errorCode(response)) === '23505') return false;
      throw failure('participants', response);
    },
    async appendActivity(activity) {
      const row = {
        id: activity.id, name: activity.name, type: activity.type, category: activity.category, points: activity.points, date: activity.date,
        created_at: activity.createdAt, hardest_grade: activity.hardestGrade, bounty_id: activity.bountyId, bounty_title: activity.bountyTitle, note: activity.note,
      };
      const response = await send('POST', 'activities', row, 'return=minimal');
      if (!response.ok) throw failure('activities', response);
    },
    async deleteActivity(id) {
      const path = `activities?id=eq.${encodeURIComponent(id)}&select=id`;
      const response = await send('DELETE', path, undefined, 'return=representation');
      if (!response.ok) throw failure(path, response);
      return (await response.json()).length > 0;
    },
  };
}
