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
  const checkBounty = activity => {
    if (activity.type === 'bounty' && feed.some(a => a.id !== activity.id && a.type === 'bounty' && a.name.toLowerCase() === activity.name.toLowerCase() && a.date === activity.date && a.bountyId === activity.bountyId)) throw Object.assign(new Error('Duplicate bounty'), {code: 'duplicate_bounty'});
  };
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
      const existing = feed.find(a => a.id === activity.id);
      if (existing) { const {seq, ...row} = existing; return {...row}; }
      checkBounty(activity);
      feed.push({...activity, seq: nextSeq++});
      return {...activity};
    },
    async getActivity(id) {
      const existing = feed.find(a => a.id === id);
      if (!existing) return null;
      const {seq, ...row} = existing;
      return {...row};
    },
    async updateActivity(id, fields) {
      const existing = feed.find(a => a.id === id);
      if (!existing) return null;
      const updated = {...existing, ...fields, id, createdAt: existing.createdAt};
      checkBounty(updated);
      Object.assign(existing, updated);
      const {seq, ...row} = updated;
      return row;
    },
    async deleteActivity(id) {
      const index = feed.findIndex(a => a.id === id);
      if (index < 0) return false;
      feed.splice(index, 1);
      return true;
    },
  };
}
