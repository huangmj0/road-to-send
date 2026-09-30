// One-shot cutover tool (spec #175, "Import tool"): turns a saved Sheet GET snapshot into
// idempotent SQL for the Supabase schema in supabase/migrations/.
//
//   curl -L "<sheet-url>" > ../snapshot.json          # write OUTSIDE the repo
//   node scripts/import-snapshot.mjs < ../snapshot.json > ../import.sql
//
// Snapshots and the SQL they produce hold crew data: never commit either. The transform is pure
// and exported; it throws ImportError before producing any output, so the SQL is never partial.
// renderSnapshot also returns the rows it rendered so tests can compare them with the snapshot.
import { fileURLToPath } from 'node:url';

export class ImportError extends Error {}

const ACCEPTED_VERSIONS = [12, 13];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Standard-conforming string literal: only the single quote needs escaping. Backslashes,
// newlines and unicode are literal. Postgres text cannot hold NUL.
// The Sheet's GET passes raw cells through, so a note "100" or a numeric id can arrive as a
// number or boolean; those are kept verbatim as their string form. Only null/undefined are empty.
function text(value, what) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new ImportError(`${what} must be a string, number or boolean.`);
}

function lit(value) {
  if (value.includes('\0')) throw new ImportError('A value contains a NUL character, which Postgres cannot store.');
  return `'${value.replaceAll("'", "''")}'`;
}

// The goal, date and name checks below mirror the migration's check constraints, so they fail
// here, before any SQL is produced, rather than inside Postgres.
export function snapshotToSql(payload) {
  return renderSnapshot(payload).sql;
}

export function renderSnapshot(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ImportError('The snapshot must be a JSON object (the Sheet GET response).');
  }
  if (!ACCEPTED_VERSIONS.includes(payload.version)) {
    throw new ImportError(`Unsupported snapshot version ${JSON.stringify(payload.version)}; expected ${ACCEPTED_VERSIONS.join(' or ')}.`);
  }
  if (!Array.isArray(payload.activities)) throw new ImportError('The snapshot has no activities array.');
  const config = payload.config;
  if (!config || typeof config !== 'object') {
    throw new ImportError('The snapshot has config: null; set up the challenge on the Sheet before importing.');
  }
  for (const key of ['startDate', 'tripDate']) {
    if (typeof config[key] !== 'string' || !DATE.test(config[key])) {
      throw new ImportError(`config.${key} must be a YYYY-MM-DD date.`);
    }
  }
  if (config.startDate > config.tripDate) throw new ImportError('config.startDate must not be after config.tripDate.');
  if (!Number.isInteger(config.goal) || config.goal < 50 || config.goal > 10000) {
    throw new ImportError('config.goal must be an integer from 50 to 10000.');
  }
  if (!Array.isArray(config.crew)) throw new ImportError('config.crew must be an array.');
  if (typeof payload.timeZone !== 'string' || !payload.timeZone) {
    throw new ImportError('The snapshot has no timeZone; importing without it would shift challenge days.');
  }

  const rows = {
    settings: { startDate: config.startDate, tripDate: config.tripDate, goal: config.goal, timeZone: payload.timeZone },
    participants: [],
    activities: [],
  };
  const lines = ['begin;', 'set local standard_conforming_strings = on;', ''];
  lines.push(
    'insert into settings (id, start_date, trip_date, goal, time_zone)',
    `values (1, ${lit(config.startDate)}, ${lit(config.tripDate)}, ${config.goal}, ${lit(payload.timeZone)})`,
    'on conflict (id) do update set start_date = excluded.start_date, trip_date = excluded.trip_date,',
    '  goal = excluded.goal, time_zone = excluded.time_zone;',
    '',
  );

  config.crew.forEach((person, index) => {
    const name = person && person.name;
    // code points, to match Postgres char_length
    if (typeof name !== 'string' || [...name].length < 1 || [...name].length > 30) {
      throw new ImportError(`config.crew[${index}].name must be a string of 1 to 30 characters.`);
    }
    rows.participants.push({ name, position: index });
    lines.push(`insert into participants (name, position) values (${lit(name)}, ${index}) on conflict ((lower(name))) do nothing;`);
  });
  lines.push('');

  payload.activities.forEach((a, index) => {
    const at = `activities[${index}]`;
    if (!a || typeof a !== 'object') throw new ImportError(`${at} must be an object.`);
    const row = {};
    for (const key of ['id', 'name', 'type', 'category', 'points', 'date', 'createdAt', 'hardestGrade', 'bountyId', 'bountyTitle', 'note']) {
      if (key === 'points') {
        // The Sheet sends Number(points)||0, so a hand-edited 1.5 is legitimate. The column is
        // int, so Postgres rounds it on insert (half away from zero); nothing is rejected.
        const n = typeof a.points === 'string' && a.points.trim() ? Number(a.points) : a.points;
        if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 2147483647) {
          throw new ImportError(`${at}.points must be a number within the int range.`);
        }
        row.points = n;
      } else {
        row[key] = text(a[key], `${at}.${key}`);
      }
    }
    if (!row.id) throw new ImportError(`${at}.id must not be empty.`);
    rows.activities.push(row);
    lines.push(
      'insert into activities (id, name, type, category, points, date, created_at, hardest_grade, bounty_id, bounty_title, note)',
      `values (${lit(row.id)}, ${lit(row.name)}, ${lit(row.type)}, ${lit(row.category)}, ${row.points}, ${lit(row.date)}, ${lit(row.createdAt)}, ${lit(row.hardestGrade)}, ${lit(row.bountyId)}, ${lit(row.bountyTitle)}, ${lit(row.note)})`,
      'on conflict (id) do nothing;',
    );
  });

  // The primary key would make `on conflict (id) do nothing` silently drop a copied row's points.
  const seen = new Set(), duplicates = new Set();
  for (const { id } of rows.activities) (seen.has(id) ? duplicates : seen).add(id);
  if (duplicates.size) {
    throw new ImportError(`The snapshot has duplicate activity ids ${JSON.stringify([...duplicates])}; give each Sheet row its own id before importing.`);
  }

  lines.push('', 'commit;', '');
  return { sql: lines.join('\n'), rows };
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ImportError('stdin is not valid JSON. Pipe in the Sheet GET response (curl -L <sheet-url>).');
  }
  process.stdout.write(snapshotToSql(payload));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof ImportError ? `import-snapshot: ${error.message}` : error);
    process.exit(1);
  });
}
