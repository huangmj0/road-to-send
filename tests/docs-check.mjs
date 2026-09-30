import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {buildHtml} from '../scripts/build.mjs';

// TRAP: this suite asserts documented invariants, not behaviour. Everything here holds a
// statement in a markdown file against the code it describes, so a check only earns its
// place if drift between the two would actually mislead someone. Assertions about which
// agent workflow runs on which model used to live here; they went out with the loop.

const at=name=>new URL('../'+name,import.meta.url);
const agentsDoc=readFileSync(at('AGENTS.md'),'utf8');
// Every browser source the build bundles, not just src/app.js: the split moved keys into
// src/app-core.js, and a check that reads one file would stop seeing them. Derived from the
// directory so a further split cannot narrow this again. src/apps-script.js is excluded --
// it is the backend, and its roadToSendSchema is a Script Property, not a localStorage key.
const browserSources=readdirSync(at('src'))
  .filter(name=>name.endsWith('.js')&&name!=='apps-script.js')
  .sort();
const app=browserSources.map(name=>readFileSync(at('src/'+name),'utf8')).join('\n');

// The localStorage keys are frozen: every roadToSend… literal in the bundled browser sources must
// be listed in the frozen-key constraint in AGENTS.md, so a new key cannot land without the doc
// saying so.
// The list is prose and wraps across lines, so match the whole numbered item rather than one
// line of it — a wrap must not be able to hide a key that was never actually listed.
const frozen=/^\d+\. \*\*localStorage keys are frozen:\*\*[\s\S]*?(?=\n\d+\. \*\*|\n\n)/m.exec(agentsDoc)?.[0];
assert.ok(frozen,'AGENTS.md carries a numbered constraint listing the frozen localStorage keys');
const keys=[...new Set(app.match(/roadToSend[A-Za-z0-9_]*/g)||[])].sort();
assert.ok(browserSources.length>=1,'src/ holds the bundled browser sources');
assert.ok(keys.length>=7,'the browser sources read the roadToSend localStorage keys');
for(const key of keys)assert.ok(frozen.includes(key),`${key} is used in the browser sources but missing from the frozen-key list in AGENTS.md`);

// Both agent surfaces orient a session and point at the authoritative guide rather than
// restating it — two full copies of the rules is how they drift apart.
assert.ok(existsSync(at('CLAUDE.md')),'a repo-root CLAUDE.md orients agent sessions');
const claudeDoc=readFileSync(at('CLAUDE.md'),'utf8');
assert.match(claudeDoc,/AGENTS\.md/,'CLAUDE.md points at AGENTS.md as the authoritative guide');
for(const [name,doc] of [['CLAUDE.md',claudeDoc],['AGENTS.md',agentsDoc]]){
  assert.match(doc,/https:\/\/huangmj0\.github\.io\/road-to-send\//,`${name} warns that the app is live`);
  assert.match(doc,/never edit `index\.html`|Never\*\* edit\s+`index\.html`/i,`${name} says index.html is generated, never hand-edited`);
}

// The vendored skills are pinned, and the per-repo config the engineering skills read exists.
assert.ok(existsSync(at('skills-lock.json')),'skills-lock.json pins the vendored skills');
const lock=JSON.parse(readFileSync(at('skills-lock.json'),'utf8'));
assert.ok(Object.keys(lock.skills||{}).length,'skills-lock.json records the installed skills');
for(const doc of ['issue-tracker','triage-labels','domain'])assert.ok(existsSync(at(`docs/agents/${doc}.md`)),`docs/agents/${doc}.md configures the skills for this repo`);
assert.match(claudeDoc,/docs\/agents\/issue-tracker\.md/,'CLAUDE.md points the skills at the issue-tracker config');

// The live site is only published from a green tree, and only the app is published.
const pages=readFileSync(at('.github/workflows/pages.yml'),'utf8');
assert.ok(pages.includes('needs: verify'),'the pages deploy job waits on the verify job (needs: verify)');
assert.match(pages,/^\s*run: npm test$/m,'the pages verify job runs npm test before anything deploys');
assert.ok(!pages.includes('path: .'),'the Pages artifact is a narrowed _site directory, never the repository root (path: .)');

// The real-Supabase job AGENTS.md describes: its own npm script, outside npm test, a pinned CLI
// action, and no secrets.
const supabaseJob=readFileSync(at('.github/workflows/supabase.yml'),'utf8');
const pkg=JSON.parse(readFileSync(at('package.json'),'utf8'));
assert.equal(pkg.scripts['test:supabase'],'node scripts/test-supabase.mjs','package.json exposes the real-stack suite as npm run test:supabase');
assert.match(supabaseJob,/^\s*run: npm run test:supabase$/m,'supabase.yml runs npm run test:supabase');
assert.match(supabaseJob,/uses: supabase\/setup-cli@v\d+\.\d+\.\d+\n\s*with:\n\s*version: \d+\.\d+\.\d+\n/,'supabase.yml pins the setup-cli action and the CLI to exact versions');
assert.ok(!/secrets\./.test(supabaseJob),'supabase.yml uses only the local stack\'s printed dev keys, never repository secrets');
assert.ok(!readFileSync(at('scripts/run-tests.mjs'),'utf8').includes('supabase-stack'),'npm test never runs the Docker-only real-stack suite');

// The organizer's cutover runbook (spec #175, "Cutover order"): the six steps in order, every
// script and npm command it tells the organizer to run exists, the smoke check it verifies with is
// the one the real-stack job runs, crew data goes to a temp dir outside the repo, and no live
// backend URL is written down -- every https URL in it is a placeholder or a docs link.
const readme=readFileSync(at('README.md'),'utf8');
const runbook=/^## Moving the shared backend to Supabase\n[\s\S]*?(?=\n## |(?![\s\S]))/m.exec(readme)?.[0];
assert.ok(runbook,'README.md has a "Moving the shared backend to Supabase" section');
for(const heading of ['Prerequisites','Create the project and apply the migration','Deploy the function','Cutover','Rollback is fix-forward','Why the Sheet stays up'])
  assert.ok(runbook.includes(`\n### ${heading}\n`),`the runbook has a "${heading}" subsection`);
const steps=[...runbook.matchAll(/^\*\*(\d)\. /gm)].map(m=>Number(m[1]));
assert.deepEqual(steps,[1,2,3,4,5,6],'the runbook walks the six cutover steps in order');
const scriptsRun=[...new Set([...runbook.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)].map(m=>m[1]))];
assert.deepEqual(scriptsRun.sort(),['scripts/import-snapshot.mjs','scripts/smoke-check.mjs'],'the runbook runs the import tool and the smoke check');
for(const script of scriptsRun)assert.ok(existsSync(at(script)),`${script}, which the runbook runs, exists`);
for(const [,name] of runbook.matchAll(/npm run ([\w:-]+)/g))assert.ok(pkg.scripts[name],`npm run ${name}, which the runbook runs, exists`);
assert.match(runbook,/mktemp -d/,'the runbook writes snapshots and SQL to a temp dir outside the repo');
assert.ok(runbook.includes('verify_jwt = false')&&/^verify_jwt = false$/m.test(readFileSync(at('supabase/config.toml'),'utf8')),'the runbook\'s verify_jwt = false note matches supabase/config.toml');
assert.match(runbook,/don't move back/,'the runbook says moved browsers don\'t move back');
for(const [url] of runbook.matchAll(/https:\/\/[^\s)'"`]+/g))
  assert.ok(url.includes('<')||url.startsWith('https://supabase.com/docs/'),`the runbook names no live endpoint: ${url}`);
assert.match(readFileSync(at('tests/supabase-stack.test.mjs'),'utf8'),/runSmokeCheck\(stack\.functionUrl\)/,'the real-stack job runs the smoke check against the local function');

// The generated-artifact check is read-only: a stale index.html must keep failing.
const checkGenerated=readFileSync(at('scripts/check-generated.mjs'),'utf8');
assert.ok(!checkGenerated.includes('execFileSync'),'scripts/check-generated.mjs compares in memory instead of shelling out to build.mjs');
assert.ok(!checkGenerated.includes('writeFileSync'),'scripts/check-generated.mjs never writes index.html');

// buildHtml() is pure and the committed artifact matches it.
const rendered=buildHtml();
assert.equal(typeof rendered,'string','buildHtml() returns the rendered artifact as a string');
assert.equal(rendered,readFileSync(at('index.html'),'utf8'),'index.html matches buildHtml() — run `npm run build` and commit the result');

console.log(`Road to Send documentation checks passed (${keys.length} frozen localStorage keys, ${Object.keys(lock.skills).length} vendored skills).`);
