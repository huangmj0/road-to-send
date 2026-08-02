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
// The loop orchestrator delegates implementation and release judgment by name rather than
// restating them, which is
// the only reason the loop body still lives in one place. If it stopped naming them it would have
// started carrying its own copy.
const drainCommand=at('.claude/commands/drain.md');
assert.ok(existsSync(drainCommand),'the loop tick lives in .claude/commands/drain.md');
const drain=readFileSync(drainCommand,'utf8');
for(const skill of ['entry','review'])assert.match(drain,new RegExp('`'+skill+'` skill'),`.claude/commands/drain.md delegates to the ${skill} skill by name instead of restating it`);
assert.match(drain,/npm run queue/,'.claude/commands/drain.md branches on npm run queue');

// The four workflows are not equally hard, so each declares the model and reasoning effort it runs
// at: refill designs binding specs a later run executes literally, entry executes one a human
// already merged and npm test checks, drain reads an exit code and delegates. Claude Code reads
// that tier from a different file depending on how the workflow was entered — the agent definition
// for the subagents /drain spawns, the command frontmatter for a direct /entry — so the two have to
// agree. Change one and not the other and that path silently falls back to the session model, which
// is the failure this pairing exists to catch. docs/loop-prompt.md explains the split.
const frontmatter=path=>{
  assert.ok(existsSync(at(path)),`${path} exists`);
  const block=/^---\n([\s\S]*?)\n---\n/.exec(readFileSync(at(path),'utf8'));
  assert.ok(block,`${path} opens with a YAML frontmatter block`);
  return Object.fromEntries([...block[1].matchAll(/^([\w-]+):[ \t]*(.*?)[ \t]*$/gm)].map(m=>[m[1],m[2]]));
};
// The tiers this repo routes between, cheapest first. Adding another means ranking it here too.
const ranked=['haiku','sonnet','opus'];
const efforts=['low','medium','high','xhigh','max'];
const tier=Object.fromEntries(['drain','entry','review','refill'].map(name=>{
  const fm=frontmatter(`.claude/commands/${name}.md`);
  assert.ok(ranked.includes(fm.model),`.claude/commands/${name}.md pins the model it runs on, one of ${ranked.join('/')} — inherit or an unranked alias puts it back on whatever the session happened to be using (saw ${JSON.stringify(fm.model)})`);
  assert.ok(efforts.includes(fm.effort),`.claude/commands/${name}.md pins its reasoning effort, one of ${efforts.join('/')} (saw ${JSON.stringify(fm.effort)})`);
  return [name,fm];
}));
for(const [name,agent] of [['entry','queue-entry'],['review','queue-review']]){
  const fm=frontmatter(`.claude/agents/${agent}.md`);
  assert.equal(fm.name,agent,`.claude/agents/${agent}.md declares name: ${agent}, which is the subagent type /drain spawns`);
  assert.match(drain,new RegExp('subagent_type: "'+agent+'"'),`.claude/commands/drain.md spawns the ${agent} agent for the ${name} step rather than general-purpose, which would inherit the orchestrator's model instead of pinning its own`);
  for(const field of ['model','effort'])assert.equal(fm[field],tier[name][field],`.claude/agents/${agent}.md and .claude/commands/${name}.md declare the same ${field} — /drain enters the ${name} step through the first and a human running /${name} enters through the second, so both have to say ${JSON.stringify(tier[name][field])} (agent says ${JSON.stringify(fm[field])})`);
}
const refillAgent=frontmatter('.claude/agents/queue-refill.md');
assert.equal(refillAgent.name,'queue-refill','.claude/agents/queue-refill.md keeps the explicit-only refill worker available');
for(const field of ['model','effort'])assert.equal(refillAgent[field],tier.refill[field],`.claude/agents/queue-refill.md and .claude/commands/refill.md declare the same ${field}, even though finite drain no longer invokes refill automatically`);
// Refill designs what entry implements, and it runs once per drained queue against six to twelve
// entries where entry runs per commit. If it ever stops outranking entry, the reasoning in
// docs/loop-prompt.md and in both agent files is no longer describing what the loop does.
assert.ok(ranked.indexOf(tier.refill.model)>ranked.indexOf(tier.entry.model),`refill writes the binding specs entry executes literally, so it runs on a more capable model than entry — change this only together with the rationale in docs/loop-prompt.md, AGENTS.md and both .claude/agents files (saw refill on ${tier.refill.model}, entry on ${tier.entry.model})`);
assert.ok(ranked.indexOf(tier.review.model)>=ranked.indexOf(tier.entry.model),`review is the independent release judgment, so it may not run below entry (saw review on ${tier.review.model}, entry on ${tier.entry.model})`);

const codexSkill=name=>at(`.agents/skills/${name}/SKILL.md`);
const codexMetadata=name=>readFileSync(at(`.agents/skills/${name}/agents/openai.yaml`),'utf8');
const codexEntry=readFileSync(codexSkill('road-to-send-entry'),'utf8');
assert.match(codexEntry,/name: road-to-send-entry/,'the Codex entry skill has discoverable metadata');
assert.match(codexEntry,/npm run queue/,'the Codex entry skill orients on npm run queue before starting an entry');
const codexRefill=readFileSync(codexSkill('road-to-send-refill'),'utf8');
assert.match(codexRefill,/IMPROVEMENT_LOG\.md` and nothing else/,'the Codex refill skill keeps proposal and implementation in separate runs');
const codexReview=readFileSync(codexSkill('road-to-send-review'),'utf8');
assert.match(codexReview,/name: road-to-send-review/,'the Codex review skill has discoverable metadata');
assert.match(codexReview,/Never merge/,'the independent Codex reviewer cannot release its own verdict');
const codexDrain=readFileSync(codexSkill('road-to-send-drain'),'utf8');
for(const skill of ['road-to-send-entry','road-to-send-review'])assert.match(codexDrain,new RegExp('\\$'+skill),`the Codex drain skill delegates to $${skill} instead of restating it`);
assert.match(codexDrain,/Spawn exactly one/,'the Codex drain skill serializes write-heavy subagents');
assert.match(codexDrain,/npm run queue/,'the Codex drain skill branches on npm run queue');
for(const skill of ['road-to-send-entry','road-to-send-review','road-to-send-refill','road-to-send-drain']){
  assert.match(codexMetadata(skill),/allow_implicit_invocation: false/,`${skill} requires explicit invocation because it can create branches and pull requests`);
}

// Entry and refill stop at ready-for-review. Entry release authority belongs only to drain after a
// fresh reviewer approves the exact head; neither implementation nor review may self-release.
for(const workflow of ['.claude/commands/entry.md','.claude/commands/refill.md','.agents/skills/road-to-send-entry/SKILL.md','.agents/skills/road-to-send-refill/SKILL.md']){
  const text=readFileSync(at(workflow),'utf8');
  assert.match(text,/ready for review/i,`${workflow} marks its pull request ready for review once the checks pass, so a draft still means unfinished`);
  assert.match(text,/[Nn]ever merge it/,`${workflow} stops at ready for review and cannot self-release`);
}
assert.match(readFileSync(at('.claude/commands/review.md'),'utf8'),/Never merge/,'.claude/commands/review.md cannot merge the head it judges');
for(const review of [readFileSync(at('.claude/commands/review.md'),'utf8'),codexReview]){
  assert.match(review,/BASE: <40-character SHA or none>/,`review binds its verdict to the base as well as the head`);
  assert.match(review,/git add -- <paths>/,`review stages explicit permitted fix paths before amending`);
  assert.ok(review.indexOf('git add -- <paths>')<review.indexOf('git commit --amend --no-edit'),`review stages its fix before amending the entry commit`);
  assert.match(review,/draft is\s+recoverable|draft.*becomes fully green/is,`review can recover a transient draft instead of stalling forever`);
  assert.match(review,/parent is that base|parent is `BASE`/i,`review approves only a one-commit integration on the reviewed base`);
}
for(const text of [drain,codexDrain]){
  assert.match(text,/node scripts\/queue-git-guard\.mjs release <PR> <ENTRY> <BASE> <HEAD> <SUBJECT>/,`drain releases only through the deterministic base/head guard`);
  assert.match(text,/sole (child|parent)|commit.*parent is `BASE`/s,`drain requires one entry commit directly atop the reviewed base`);
  assert.doesNotMatch(text,/Run `gh pr merge/,`drain does not use a head-only merge API that can race an unreviewed base`);
  assert.match(text,/queue complete — no Todo entries/,`drain stops when the finite queue is complete instead of refilling forever`);
  assert.match(text,/codex\/entry-<N>-/i,`drain recovers an open Codex entry PR after a clean reset instead of duplicating it`);
  assert.match(text,/claude\/entry-<N>-/i,`drain recovers an open Claude entry PR after a clean reset instead of duplicating it`);
  assert.match(text,/never create a\s+duplicate PR/i,`drain treats ambiguous open entry PRs as a stop condition`);
  assert.match(text,/machine-readable `hold:`|JSON object on `hold:`/i,`exit 4 consumes the queue command's structured hold record`);
  assert.match(text,/Strip the single leading `origin\/`/i,`exit 4 normalizes the remote-tracking ref before comparing GitHub headRefName`);
  assert.match(text,/never `archive-due:`|never `archive-due:` or title text/i,`exit 4 never mistakes the older archive-due entry for the held entry`);
  assert.match(text,/whether ready or draft|draft.*proceeds to independent review/is,`drain sends a recovered draft to review instead of stalling permanently`);
  assert.match(text,/discard every prior head and base SHA/i,`a reviewer fix invalidates both prior reviewed SHAs`);
}
assert.match(drain,/ENTRY: <replace with actual entry number and title>/,`Claude drain forwards the concrete entry target to its fresh reviewer`);
assert.match(drain,/PR: <replace with actual PR URL>/,`Claude drain forwards the concrete PR target to its fresh reviewer`);
const claudeSettings=readFileSync(at('.claude/settings.json'),'utf8');
assert.ok(!claudeSettings.includes('gh pr merge:*'),'Claude does not grant every subagent unrestricted PR merge permission');
assert.ok(!claudeSettings.includes('git push --force-with-lease:*'),'Claude does not grant every subagent unrestricted force-push permission');
assert.ok(!claudeSettings.includes('git push -u origin:*'),'Claude does not grant every subagent unrestricted initial-push permission');
assert.ok(claudeSettings.includes('node scripts/queue-git-guard.mjs:*'),'Claude permits only the deterministic guarded amend/release script for sensitive pushes');
assert.ok(claudeSettings.includes('git rebase:*'),'Claude review may rebase a stale entry before sending its changed head to a fresh reviewer');
assert.ok(claudeSettings.includes('gh pr create:*'),'Claude can open a new entry PR without human approval');
for(const workflow of ['.claude/commands/entry.md','.agents/skills/road-to-send-entry/SKILL.md']){
  const text=readFileSync(at(workflow),'utf8');
  assert.match(text,/queue-git-guard\.mjs publish <N> <HEAD> <SUBJECT>/,`${workflow} publishes a new entry branch through the deterministic guard`);
  assert.doesNotMatch(text,/`git push -u origin/,`${workflow} cannot bypass guarded initial publication`);
}

const loopDoc=readFileSync(at('docs/loop-prompt.md'),'utf8');
assert.ok(!loopDoc.includes('```'),'docs/loop-prompt.md points at tool-specific workflows instead of carrying another fenced prompt');
assert.match(loopDoc,/\.claude\/commands\/entry\.md/,'docs/loop-prompt.md names where the prompt actually lives');
assert.match(loopDoc,/\.claude\/commands\/review\.md/,'docs/loop-prompt.md names the independent review workflow');
assert.match(loopDoc,/\.agents\/skills\/road-to-send-entry\//,'docs/loop-prompt.md names where the Codex entry skill lives');
assert.match(loopDoc,/road-to-send-review\//,'docs/loop-prompt.md names where the Codex review skill lives');
assert.match(loopDoc,/fresh agent context/,'docs/loop-prompt.md states the actual independence boundary');
assert.match(loopDoc,/same account/,'docs/loop-prompt.md does not overstate identity-level GitHub independence');
assert.match(loopDoc,/stops on multiple matching remote branches/,'docs/loop-prompt.md makes duplicate recovery candidates fail closed');
assert.match(loopDoc,/prunes deleted remote refs/,'docs/loop-prompt.md explains stale recovery refs are removed');

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
