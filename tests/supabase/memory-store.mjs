// In-memory implementation of the store interface documented in
// supabase/functions/road-to-send/core.mjs. Tests seed it directly; later tickets extend it
// with the write methods.
export function createMemoryStore({settings = null, participants = [], activities = []} = {}) {
  return {
    async getSettings() { return settings && {...settings}; },
    async listParticipants() { return participants.map(name => ({name: typeof name === 'string' ? name : name.name})); },
    async listActivities() { return activities.map(activity => ({...activity})); },
  };
}
