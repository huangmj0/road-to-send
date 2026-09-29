// In-memory implementation of the store interface documented in
// supabase/functions/road-to-send/core.mjs. Like the database it sorts on read: participants by
// `position`, activities by `seq` (rows without one keep array order, after sorted ones' ties).
// Later tickets extend it with the write methods.
const byKey = (rows, key) => rows.map((row, index) => ({row, index})).sort((a, b) => (a.row[key] ?? a.index) - (b.row[key] ?? b.index) || a.index - b.index).map(x => x.row);

export function createMemoryStore({settings = null, participants = [], activities = []} = {}) {
  return {
    async getSettings() { return settings && {...settings}; },
    async listParticipants() { return byKey(participants.map(p => typeof p === 'string' ? {name: p} : p), 'position').map(p => ({name: p.name})); },
    async listActivities() { return byKey(activities, 'seq').map(({seq, ...activity}) => activity); },
  };
}
