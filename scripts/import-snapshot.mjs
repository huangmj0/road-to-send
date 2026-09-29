// One-shot cutover tool (spec #175, "Import tool"): turns a saved Sheet GET snapshot into
// idempotent SQL for the Supabase schema in supabase/migrations/.
//
//   curl -L "<sheet-url>" > ../snapshot.json          # write OUTSIDE the repo
//   node scripts/import-snapshot.mjs < ../snapshot.json > ../import.sql
//
// Snapshots and the SQL they produce hold crew data: never commit either. The transform is pure
// and exported; it throws ImportError before producing any output, so the SQL is never partial.
import { fileURLToPath } from 'node:url';

export class ImportError extends Error {}

const ACCEPTED_VERSIONS = [12, 13];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Standard-conforming string literal: only the single quote needs escaping. Backslashes,
// newlines and unicode are literal. Postgres text cannot hold NUL.
function lit(value, what) {
  if (typeof value !== 'string') throw new ImportError(`${what} must be a string.`);
  if (value.includes('\0')) throw new ImportError(`${what} contains a NUL character, which Postgres cannot store.`);
  return `'${value.replaceAll("'", "''")}'`;
}

function optional(value, what) {
  return lit(value === undefined || value === null ? '' : value, what);
}

export function snapshotToSql(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ImportError('The snapshot must be a JSON object (the Sheet GET response).');
  }
  if (!ACCEPTED_VERSIONS.includes(payload.version)) {
    throw new ImportError(`Unsupported snapshot version ${JSON.stringify(payload.version)}; expected 12 or 13.`);
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
  if (!Number.isInteger(config.goal) || config.goal < 50 || config.goal > 10000) {
    throw new ImportError('config.goal must be an integer from 50 to 10000.');
  }
  if (!Array.isArray(config.crew)) throw new ImportError('config.crew must be an array.');
  if (typeof payload.timeZone !== 'string' || !payload.timeZone) {
    throw new ImportError('The snapshot has no timeZone; importing without it would shift challenge days.');
  }

  const lines = ['begin;', ''];
  lines.push(
    'insert into settings (id, start_date, trip_date, goal, time_zone)',
    `values (1, ${lit(config.startDate, 'startDate')}, ${lit(config.tripDate, 'tripDate')}, ${config.goal}, ${lit(payload.timeZone, 'timeZone')})`,
    'on conflict (id) do update set start_date = excluded.start_date, trip_date = excluded.trip_date,',
    '  goal = excluded.goal, time_zone = excluded.time_zone;',
    '',
  );

  config.crew.forEach((person, index) => {
    const name = person && person.name;
    if (typeof name !== 'string' || name.length < 1 || name.length > 30) {
      throw new ImportError(`config.crew[${index}].name must be a string of 1 to 30 characters.`);
    }
    lines.push(`insert into participants (name, position) values (${lit(name, 'crew name')}, ${index}) on conflict ((lower(name))) do nothing;`);
  });
  lines.push('');

  payload.activities.forEach((a, index) => {
    const at = `activities[${index}]`;
    if (!a || typeof a !== 'object') throw new ImportError(`${at} must be an object.`);
    if (typeof a.id !== 'string' || !a.id) throw new ImportError(`${at}.id must be a non-empty string.`);
    if (!Number.isInteger(a.points)) throw new ImportError(`${at}.points must be an integer.`);
    lines.push(
      'insert into activities (id, name, type, category, points, date, created_at, hardest_grade, bounty_id, bounty_title, note)',
      `values (${lit(a.id, `${at}.id`)}, ${lit(a.name, `${at}.name`)}, ${lit(a.type, `${at}.type`)}, ${optional(a.category, `${at}.category`)}, ${a.points}, ${lit(a.date, `${at}.date`)}, ${lit(a.createdAt, `${at}.createdAt`)}, ${optional(a.hardestGrade, `${at}.hardestGrade`)}, ${optional(a.bountyId, `${at}.bountyId`)}, ${optional(a.bountyTitle, `${at}.bountyTitle`)}, ${optional(a.note, `${at}.note`)})`,
      'on conflict (id) do nothing;',
    );
  });

  lines.push('', 'commit;', '');
  return lines.join('\n');
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
