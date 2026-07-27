// One parser for IMPROVEMENT_LOG.md, shared by tests/docs-check.mjs (which enforces the
// log's shape) and scripts/queue-status.mjs (which reports where the loop stands). Two
// parsers of the same file would be a second thing to drift, which is the failure mode
// CLAUDE.md already warns about for the prose rules.

// The four documented states. Kept as one regex so the vocabulary has a single home.
export const STATUS = /^Status: (Todo|In progress — \d{4}-\d{2}-\d{2}|Done — \d{4}-\d{2}-\d{2}|Blocked — \S.*)$/;
export const HEADING = /^## (\d+)\. (.+)$/;

// Rule 10 records the shipped commit in Notes: as ``Commit `subject`.`` — that subject is
// how queue-status.mjs asks git whether the previous entry actually landed on origin/main.
const COMMIT_SUBJECT = /Commit\s+`([^`]+)`/;

// A Status: line is the first non-blank line within three lines of the heading. Entries are
// returned even when that line is missing or malformed (status: undefined), so docs-check.mjs
// keeps ownership of the assertion and its message rather than this module throwing.
export function parseEntries(log) {
  const lines = log.split('\n');
  const entries = [];
  lines.forEach((line, i) => {
    const head = HEADING.exec(line);
    if (!head) return;
    const status = lines.slice(i + 1, i + 4).find(x => x.trim());
    const valid = Boolean(status && STATUS.test(status));
    entries.push({
      n: Number(head[1]),
      title: head[2],
      status,
      valid,
      state: valid ? status.replace(/^Status: /, '').split(' — ')[0] : null,
      commitSubject: valid ? commitSubjectFor(lines, i) : null,
      line: i,
    });
  });
  return entries;
}

// Notes: runs from its own line to the entry's first ### section, so a wrapped multi-line
// Notes: block is searched whole — entry 41's subject sits on the line it starts on, but
// nothing guarantees that for the next one.
function commitSubjectFor(lines, headingIndex) {
  const notes = [];
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (HEADING.test(line) || line.startsWith('### ') || line.startsWith('---')) break;
    if (notes.length || line.startsWith('Notes:')) notes.push(line);
  }
  const found = COMMIT_SUBJECT.exec(notes.join(' '));
  return found ? found[1] : null;
}

// The "## Queue index" block, sliced out for the completeness check in docs-check.mjs.
export function queueIndex(log) {
  return log.slice(log.indexOf('## Queue index'), log.indexOf('## Rules for implementers'));
}
