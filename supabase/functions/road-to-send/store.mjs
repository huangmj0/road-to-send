// The PostgREST implementation of the store interface described in core.mjs. Plain fetch
// against the auto-injected SUPABASE_URL with the service-role key; no supabase-js.
// Only the read methods exist so far. A failed request throws, which the handler turns into
// the server_error envelope.
const PAGE = 1000; // Supabase caps a PostgREST response at 1000 rows by default; page past it.
const ACTIVITY_COLUMNS = 'id,name,type,category,points,date,created_at,hardest_grade,bounty_id,bounty_title,note';

export function createPostgrestStore({url, serviceKey, fetch: fetchImpl = fetch}) {
  const base = `${String(url).replace(/\/+$/, '')}/rest/v1`;
  const headers = {apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json'};

  async function getRows(path) {
    const response = await fetchImpl(`${base}/${path}`, {method: 'GET', headers});
    if (!response.ok) throw new Error(`PostgREST ${path.split('?')[0]} failed with ${response.status}`);
    return response.json();
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
  };
}
