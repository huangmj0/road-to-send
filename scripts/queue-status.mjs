// Where does the loop stand? One command, a handful of lines, and an exit code the loop
// branches on — so an iteration does not spend its opening context re-reading the whole log
// and querying GitHub just to work out whether it may start.
//
//   0  clear to start — a Todo entry is next
//   3  queue empty — no Todo entries (refill, or stop)
//   4  the previous entry is not on origin/main yet — stop, do not stack a second entry
//   5  an entry is stuck In progress — a previous iteration died mid-entry; needs a human
//
// Exit 4 replaces the branch-prefix guard that docs/loop-prompt.md used to carry. That guard
// looked for an open PR from a branch named `claude/entry-<N>-<slug>`; no branch in this
// repository's history has ever used that prefix, so it matched nothing and the loop was free
// to stack entries on unmerged work — which it did. Asking git whether the previous entry's
// commit is on origin/main cannot drift, because it depends on no naming convention at all.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEntries } from './log-model.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const noFetch = args.includes('--no-fetch');

// Defaults to the real queue; a path argument points it at a fixture so every exit code can
// be exercised without editing the live log.
const logPath = args.find(arg => !arg.startsWith('--')) ?? fileURLToPath(new URL('../IMPROVEMENT_LOG.md', import.meta.url));

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

// A stale local view of origin/main is how the guard gets the wrong answer, so refresh it
// before asking. `--no-fetch` is for offline runs and for the tests.
if (!noFetch) {
  const fetched = git('fetch', 'origin', 'main');
  if (fetched.status !== 0) console.log('note:  git fetch origin main failed — reporting against the local ref');
}

const log = readFileSync(logPath, 'utf8');
const entries = parseEntries(log);

const malformed = entries.filter(e => !e.valid);
const byState = state => entries.filter(e => e.state === state);
const todo = byState('Todo');
const inProgress = byState('In progress');
const done = byState('Done');
const blocked = byState('Blocked');

console.log(
  `queue: ${todo.length} Todo · ${inProgress.length} In progress · ` +
  `${done.length} Done (unarchived) · ${blocked.length} Blocked`,
);

for (const entry of malformed) {
  console.log(`bad:   ${entry.n} — ${entry.title} — unreadable Status: line (run npm test for the exact rule)`);
}

// Rule 10: any Done entry still here must be archived before the next entry starts.
for (const entry of done) console.log(`archive-due: ${entry.n} — ${entry.title}`);
for (const entry of inProgress) console.log(`stale: ${entry.n} — ${entry.title} — left In progress by an earlier run`);

// The newest Done entry is the one whose commit should already be on origin/main.
const previous = done.length ? done.reduce((a, b) => (b.n > a.n ? b : a)) : null;
let unmerged = null;

if (previous) {
  if (!previous.commitSubject) {
    unmerged = `entry ${previous.n} records no commit subject in Notes: — cannot verify it landed`;
  } else {
    const subjects = git('log', 'origin/main', '--format=%s', '-500');
    if (subjects.status !== 0) {
      unmerged = 'origin/main is unavailable — cannot verify the previous entry landed';
    } else if (!subjects.stdout.split('\n').includes(previous.commitSubject)) {
      unmerged = `entry ${previous.n} ("${previous.commitSubject}") is not on origin/main yet`;
    }
  }
}

// The check above reads the log in the working tree, so it only sees an in-flight entry while the
// tree is still on that entry's branch. A loop running for hours does not get to assume that — a
// container restart, a resumed session or a subagent worktree all put the tree back on main, where
// the in-flight entry still reads Todo and would be worked a second time.
//
// So ask the remote as well: any branch not yet merged into origin/main whose log marks an entry
// Done that main still shows as Todo is an entry someone is already holding. This is content-based
// like the check above, so it depends on no branch-naming convention.
if (!unmerged) {
  const held = heldOnRemote(new Set(todo.map(entry => entry.n)));
  if (held) unmerged = `entry ${held.n} ("${held.title}") is already Done on ${held.ref}, which is not merged into origin/main`;
}

function heldOnRemote(todoNumbers) {
  if (!todoNumbers.size) return null;
  const refs = git('for-each-ref', '--format=%(refname)', 'refs/remotes/origin');
  if (refs.status !== 0) return null;
  for (const ref of refs.stdout.split('\n').map(line => line.trim()).filter(Boolean)) {
    if (ref === 'refs/remotes/origin/HEAD' || ref === 'refs/remotes/origin/main') continue;
    // Already merged: whatever it holds is on main, so it is nobody's in-flight work.
    if (git('merge-base', '--is-ancestor', ref, 'origin/main').status === 0) continue;
    // A branch with no log, or one that predates the file, is simply not an entry branch.
    const log = git('show', `${ref}:IMPROVEMENT_LOG.md`);
    if (log.status !== 0) continue;
    for (const entry of parseEntries(log.stdout)) {
      if (entry.state === 'Done' && todoNumbers.has(entry.n)) return {n: entry.n, title: entry.title, ref: ref.replace('refs/remotes/', '')};
    }
  }
  return null;
}

if (unmerged) {
  console.log(`head:  ${unmerged}`);
  console.log('\nSTOP — wait for the previous entry to merge. Do not start a second entry on top of it.');
  process.exit(4);
}

if (previous) console.log(`head:  origin/main contains entry ${previous.n}'s commit`);

if (inProgress.length) {
  console.log('\nSTOP — an entry is stuck In progress. Finish it or reset its Status by hand before looping again.');
  process.exit(5);
}

if (!todo.length) {
  console.log('\nqueue empty — no Todo entries.');
  process.exit(3);
}

const next = todo[0];
console.log(`next:  ${next.n} — ${next.title}`);
console.log('\nclear to start.');
