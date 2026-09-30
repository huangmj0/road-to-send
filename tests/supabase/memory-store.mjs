// In-memory implementation of the store interface documented in
// supabase/functions/road-to-send/core.mjs. Like the database it sorts on read: participants by
// `position` then name, activities by `seq` (rows without one keep array order, after sorted ones' ties).
// Writes follow the migration: saveConfig keeps timeZone (UTC for a new row) and rewrites the
// roster with position = index; participant names are unique case-insensitively; deleting a
// participant never touches activities.
const byKey = (rows, key) => rows.map((row, index) => ({row, index})).sort((a, b) => (a.row[key] ?? a.index) - (b.row[key] ?? b.index) || a.index - b.index).map(x => x.row);

export function createMemoryStore({settings = null, participants = [], activities = []} = {}) {
  let roster = participants.map(p => typeof p === 'string' ? {name: p} : {...p});
  const feed = activities.map(a => ({...a}));
  let nextSeq = Math.max(0, ...feed.map(a => a.seq ?? 0)) + 1;
  return {
    async getSettings() { return settings && {...settings}; },
    async listParticipants() { return byKey([...roster].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)), 'position').map(p => ({name: p.name})); },
    async listActivities() { return byKey(feed, 'seq').map(({seq, ...activity}) => ({...activity})); },
    async saveConfig({startDate, tripDate, goal, crew}) {
      settings = {startDate, tripDate, goal, timeZone: settings?.timeZone || 'UTC'};
      roster = crew.map((name, position) => ({name, position}));
    },
    async addParticipant(name) {
      if (roster.some(p => p.name.toLowerCase() === name.toLowerCase())) return false;
      roster.push({name, position: Math.max(-1, ...roster.map(p => p.position ?? -1)) + 1});
      return true;
    },
    async appendActivity(activity) {
      feed.push({...activity, seq: nextSeq++});
    },
    async deleteActivity(id) {
      const index = feed.findIndex(a => a.id === id);
      if (index < 0) return false;
      feed.splice(index, 1);
      return true;
    },
  };
}
