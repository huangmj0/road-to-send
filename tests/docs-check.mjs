import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
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

// The archive holds the shipped queue, verbatim, split across docs/archive/ so that looking one
// entry up is a bounded read. IMPROVEMENTS.md is the index over those files and holds no entries
// itself — a single file that grows by an entry per iteration is the thing this replaced.
// Raising ARCHIVE_CAP is the wrong fix when a pass file fills up: start the next pass file. A cap
// that only ratchets upward stops being a guard (the same rule tests/size-check.mjs states).
const ARCHIVE_CAP=90000;
const archiveDir=at('docs/archive/');
const archives=readdirSync(archiveDir).filter(name=>name.endsWith('.md')).sort();
assert.ok(archives.length,'the shipped entries live in docs/archive/');
for(const name of archives){
  assert.ok(improvements.includes(`docs/archive/${name}`),`docs/archive/${name} has a section in the IMPROVEMENTS.md index`);
  const bytes=readFileSync(new URL(name,archiveDir)).length;
  assert.ok(bytes<=ARCHIVE_CAP,`docs/archive/${name} is ${bytes} bytes, over the ${ARCHIVE_CAP}-byte cap: start the next pass file and point the index at it — do not raise the cap`);
}
assert.ok(!/^## \d+\. /m.test(improvements),'IMPROVEMENTS.md is the index over docs/archive/, not a place entries are pasted back into');

// Spot-check that the split moved the entries rather than dropping them.
assert.match(readFileSync(at('docs/archive/entries-1-14.md'),'utf8'),/^## 1\. Per-category breakdown card \(You tab\)$/m,'docs/archive/entries-1-14.md carries the archived entry 1');
assert.match(readFileSync(at('docs/archive/entries-25-40.md'),'utf8'),/^## 40\. Share through the system share sheet$/m,'docs/archive/entries-25-40.md carries the archived entry 40');

// Both agent surfaces orient sessions and point at the queue rather than restating it.
assert.ok(existsSync(at('CLAUDE.md')),'a repo-root CLAUDE.md orients agent sessions');
assert.match(readFileSync(at('CLAUDE.md'),'utf8'),/IMPROVEMENT_LOG\.md/,'CLAUDE.md points at IMPROVEMENT_LOG.md');
assert.ok(existsSync(at('AGENTS.md')),'a repo-root AGENTS.md orients Codex sessions');
const agents=readFileSync(at('AGENTS.md'),'utf8');
assert.match(agents,/https:\/\/huangmj0\.github\.io\/road-to-send\//,'AGENTS.md warns that the app is live');
assert.match(agents,/Start with `npm run queue`/,'AGENTS.md puts the queue guard before log-driven work');
assert.match(agents,/\.agents\/skills\//,'AGENTS.md points Codex at the repository skills');

// Each agent surface owns one executable copy of its workflows. docs/loop-prompt.md is only the
// shared operator guide; it used to carry another fenced prompt, so the fence may not come back.
const entryCommand=at('.claude/commands/entry.md');
assert.ok(existsSync(entryCommand),'the loop body lives in .claude/commands/entry.md');
assert.match(readFileSync(entryCommand,'utf8'),/npm run queue/,'.claude/commands/entry.md orients on npm run queue before starting an entry');
const refillCommand=at('.claude/commands/refill.md');
assert.ok(existsSync(refillCommand),'refuelling the queue lives in .claude/commands/refill.md, separate from the run that implements entries');
assert.match(readFileSync(refillCommand,'utf8'),/IMPROVEMENT_LOG\.md.*nothing else/,'.claude/commands/refill.md keeps a refill PR to IMPROVEMENT_LOG.md alone, so proposing work and shipping it stay separate runs');
// The loop orchestrator delegates to the two commands by name rather than restating them, which is
// the only reason the loop body still lives in one place. If it stopped naming them it would have
// started carrying its own copy.
const drainCommand=at('.claude/commands/drain.md');
assert.ok(existsSync(drainCommand),'the loop tick lives in .claude/commands/drain.md');
const drain=readFileSync(drainCommand,'utf8');
for(const skill of ['entry','refill'])assert.match(drain,new RegExp('`'+skill+'` skill'),`.claude/commands/drain.md delegates to the ${skill} skill by name instead of restating it`);
assert.match(drain,/npm run queue/,'.claude/commands/drain.md branches on npm run queue');

const codexSkill=name=>at(`.agents/skills/${name}/SKILL.md`);
const codexMetadata=name=>readFileSync(at(`.agents/skills/${name}/agents/openai.yaml`),'utf8');
const codexEntry=readFileSync(codexSkill('road-to-send-entry'),'utf8');
assert.match(codexEntry,/name: road-to-send-entry/,'the Codex entry skill has discoverable metadata');
assert.match(codexEntry,/npm run queue/,'the Codex entry skill orients on npm run queue before starting an entry');
const codexRefill=readFileSync(codexSkill('road-to-send-refill'),'utf8');
assert.match(codexRefill,/IMPROVEMENT_LOG\.md` and nothing else/,'the Codex refill skill keeps proposal and implementation in separate runs');
const codexDrain=readFileSync(codexSkill('road-to-send-drain'),'utf8');
for(const skill of ['road-to-send-entry','road-to-send-refill'])assert.match(codexDrain,new RegExp('\\$'+skill),`the Codex drain skill delegates to $${skill} instead of restating it`);
assert.match(codexDrain,/Spawn exactly one/,'the Codex drain skill serializes write-heavy subagents');
assert.match(codexDrain,/npm run queue/,'the Codex drain skill branches on npm run queue');
for(const skill of ['road-to-send-entry','road-to-send-refill','road-to-send-drain']){
  assert.match(codexMetadata(skill),/allow_implicit_invocation: false/,`${skill} requires explicit invocation because it can create branches and pull requests`);
}

const loopDoc=readFileSync(at('docs/loop-prompt.md'),'utf8');
assert.ok(!loopDoc.includes('```'),'docs/loop-prompt.md points at tool-specific workflows instead of carrying another fenced prompt');
assert.match(loopDoc,/\.claude\/commands\/entry\.md/,'docs/loop-prompt.md names where the prompt actually lives');
assert.match(loopDoc,/\.agents\/skills\/road-to-send-entry\//,'docs/loop-prompt.md names where the Codex entry skill lives');

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
