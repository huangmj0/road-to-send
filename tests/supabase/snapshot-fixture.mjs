// A synthetic Sheet GET snapshot for the import tool (scripts/import-snapshot.mjs). Every name,
// note and id here is made up; never replace it with a real snapshot, which holds crew data.
// It is shaped like the payload the function serves, so the real-stack suite can import it and
// deep-equal the function's GET against it (ignoring fetchedAt and serverDate). What it stresses:
// quotes, backslashes, emoji and newlines in names and notes; a roster not in alphabetical order;
// activities not in createdAt order (feed order is array order); an activity by someone who is
// not on the roster; a createdAt string the Sheet stores verbatim; a non-UTC time zone.
// Points are integers: the column is int, and a fractional value would round on import. Every
// value must satisfy src/schema.json, because the real-stack suite's smoke check validates the
// imported board against it; tests/import-snapshot.test.js holds the fixture to that.
export function snapshotFixture({version, features}) {
  const activity = fields => ({
    category: '', points: 0, hardestGrade: '', bountyId: '', bountyTitle: '', note: '', ...fields,
  });
  return {
    version,
    features,
    activities: [
      activity({id: 'fx-3', name: 'Zoë 🧗', type: 'climb', category: 'climb', points: 3, date: '2026-07-02', createdAt: '2026-07-02T03:04:05.678Z', hardestGrade: 'V4', note: "it's a \\ back\\slash\nline two 🧗 café'; drop table activities;--"}),
      activity({id: 'fx-1', name: "O'Neil", type: 'exercise', category: 'exercise', points: 1, date: '2026-07-01', createdAt: '2026-07-01T20:00:00.000Z', note: '100'}),
      activity({id: "fx-'2'", name: 'Former Member', type: 'mobility', category: 'mobility', points: 1, date: '2026-07-01', createdAt: 'Wed Jul 01 2026 09:00:00 GMT-0700', note: '\\n is not a newline'}),
      activity({id: 'fx-4', name: 'back\\slash', type: 'climb', category: 'climb', points: 3, date: '2026-07-03', createdAt: '2026-07-03T00:00:00.000Z', hardestGrade: 'V6', bountyId: 'b-1', bountyTitle: 'Bounty "one"', note: '\ttabbed\nline'}),
    ],
    config: {startDate: '2026-07-01', tripDate: '2026-07-31', goal: 500, crew: [{name: 'Zoë 🧗'}, {name: "O'Neil"}, {name: 'back\\slash'}, {name: 'Alex'}]},
    configErrors: [],
    serverDate: '2026-07-02',
    timeZone: 'Pacific/Auckland',
    fetchedAt: '2026-07-02T03:05:00.000Z',
  };
}
