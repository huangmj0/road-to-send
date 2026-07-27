import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {buildHtml} from '../scripts/build.mjs';
import {parseEntries,queueIndex} from '../scripts/log-model.mjs';

const at=name=>new URL('../'+name,import.meta.url);
const log=readFileSync(at('IMPROVEMENT_LOG.md'),'utf8');
const improvements=readFileSync(at('IMPROVEMENTS.md'),'utf8');
const app=readFileSync(at('src/app.js'),'utf8');
const lines=log.split('\n');

// Every "## N." entry carries a Status: line in one of the four documented states.
// The parser is shared with scripts/queue-status.mjs so the loop reads the queue exactly
// the way this check validates it; the assertion below still lives here.
const entries=parseEntries(log);
for(const entry of entries)assert.ok(entry.valid,`entry ${entry.n} has a Status: line reading Todo, In progress — date, Done — date, or Blocked — reason (saw ${JSON.stringify(entry.status)})`);
assert.ok(entries.length,'IMPROVEMENT_LOG.md still lists numbered entries');

// Shipped work belongs in IMPROVEMENTS.md, so the queue keeps at most the entry finished in this commit.
const done=entries.filter(e=>e.state==='Done');
assert.ok(done.length<=1,`shipped work belongs in IMPROVEMENTS.md: at most the entry completed in the current commit may be Done in IMPROVEMENT_LOG.md, but ${done.length} are (${done.map(e=>e.n).join(', ')}). Move the finished ones, heading through separator and verbatim, to the archive (rule 10)`);

// The queue index at the top names every live entry.
const index=queueIndex(log);
assert.ok(index,'IMPROVEMENT_LOG.md opens with a queue index');
for(const entry of entries)assert.ok(index.includes(`- ${entry.n} — `),`entry ${entry.n} has a line in the queue index`);

// Rule 4 freezes the localStorage keys: every roadToSend… literal in src/app.js must be listed there.
const rule4=lines.find(line=>line.startsWith('4. **localStorage keys are frozen:**'));
assert.ok(rule4,'rule 4 lists the frozen localStorage keys');
const keys=[...new Set(app.match(/roadToSend[A-Za-z0-9_]*/g)||[])].sort();
assert.ok(keys.length>=5,'src/app.js reads the roadToSend localStorage keys');
for(const key of keys)assert.ok(rule4.includes(key),`${key} is used in src/app.js but missing from rule 4's frozen-key list`);

// The archive holds the shipped queue, verbatim.
assert.match(improvements,/^## v11 pass — frontend enhancement queue \(entries 1–14\)$/m,'IMPROVEMENTS.md carries the v11 archive heading');
assert.match(improvements,/^## 1\. Per-category breakdown card \(You tab\)$/m,'IMPROVEMENTS.md carries the archived entry 1');

// CLAUDE.md orients agent sessions and points at the queue rather than restating it.
assert.ok(existsSync(at('CLAUDE.md')),'a repo-root CLAUDE.md orients agent sessions');
assert.match(readFileSync(at('CLAUDE.md'),'utf8'),/IMPROVEMENT_LOG\.md/,'CLAUDE.md points at IMPROVEMENT_LOG.md');

// The loop body lives in exactly one place. docs/loop-prompt.md is the operator guide and used to
// carry a fenced copy of the prompt as well; two copies drift, so the fence may not come back.
const entryCommand=at('.claude/commands/entry.md');
assert.ok(existsSync(entryCommand),'the loop body lives in .claude/commands/entry.md');
assert.match(readFileSync(entryCommand,'utf8'),/npm run queue/,'.claude/commands/entry.md orients on npm run queue before starting an entry');
const loopDoc=readFileSync(at('docs/loop-prompt.md'),'utf8');
assert.ok(!loopDoc.includes('```'),'docs/loop-prompt.md points at .claude/commands/entry.md instead of carrying a second copy of the prompt in a fenced block');
assert.match(loopDoc,/\.claude\/commands\/entry\.md/,'docs/loop-prompt.md names where the prompt actually lives');

// The live site is only published from a green tree, and only the app is published.
const pages=readFileSync(at('.github/workflows/pages.yml'),'utf8');
assert.ok(pages.includes('needs: verify'),'the pages deploy job waits on the verify job (needs: verify)');
assert.match(pages,/^\s*run: npm test$/m,'the pages verify job runs npm test before anything deploys');
assert.ok(!pages.includes('path: .'),'the Pages artifact is a narrowed _site directory, never the repository root (path: .)');

// The generated-artifact check is read-only: a stale index.html must keep failing.
const checkGenerated=readFileSync(at('scripts/check-generated.mjs'),'utf8');
assert.ok(!checkGenerated.includes('execFileSync'),'scripts/check-generated.mjs compares in memory instead of shelling out to build.mjs');
assert.ok(!checkGenerated.includes('writeFileSync'),'scripts/check-generated.mjs never writes index.html');

// buildHtml() is pure and the committed artifact matches it.
const rendered=buildHtml();
assert.equal(typeof rendered,'string','buildHtml() returns the rendered artifact as a string');
assert.equal(rendered,readFileSync(at('index.html'),'utf8'),'index.html matches buildHtml() — run `npm run build` and commit the result');

console.log(`Road to Send documentation checks passed (${entries.length} live entries, ${keys.length} frozen localStorage keys).`);
