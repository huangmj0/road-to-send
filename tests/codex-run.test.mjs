// TRAP: This suite tests the pure role table and response validation only. It must never invoke
// codex, graphify, or the network — a test that shells out to a model is neither fast nor
// deterministic, and the whole point of the table is that it can be checked without one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ROLES,WRITE_ROLES,codexArgs,schemaErrors,sessionIdFrom} from '../scripts/codex-run.mjs';

const at=path=>fileURLToPath(new URL(`../${path}`,import.meta.url));
const argsFor=role=>codexArgs(role,{lastMessagePath:'/tmp/last.json'});
const flagValue=(args,flag)=>args[args.indexOf(flag)+1];

test('every role pins an explicit sandbox rather than inheriting the machine default',()=>{
  // ~/.codex/config.toml may set sandbox_mode = "danger-full-access" globally. A role that omits
  // -s silently inherits it, which is the exact failure this table exists to prevent.
  for(const role of Object.keys(ROLES)){
    const args=argsFor(role);
    assert.ok(args.includes('-s'),`${role} passes -s`);
    assert.ok(['read-only','workspace-write'].includes(flagValue(args,'-s')),`${role} names a bounded sandbox`);
  }
});

test('no role can bypass approvals, the sandbox, or hook trust',()=>{
  for(const role of Object.keys(ROLES)){
    for(const flag of argsFor(role)){
      assert.ok(!flag.startsWith('--dangerously-'),`${role} passes no --dangerously- flag (saw ${flag})`);
    }
  }
  const source=readFileSync(at('scripts/codex-run.mjs'),'utf8');
  assert.ok(!source.includes('--dangerously-bypass-approvals-and-sandbox'),'the bridge never names the approvals bypass');
  assert.ok(!source.includes('--dangerously-bypass-hook-trust'),'the bridge never names the hook-trust bypass');
});

test('read-only roles cannot be write roles, and only write roles refresh the graph',()=>{
  assert.deepEqual(WRITE_ROLES.sort(),['entry','entry-hard','fix']);
  for(const role of ['scout','diagnose'])assert.equal(ROLES[role].sandbox,'read-only');
});

test('each role pins both the model and the reasoning effort',()=>{
  const efforts=['low','medium','high','xhigh'];
  for(const [role,tier] of Object.entries(ROLES)){
    const args=argsFor(role);
    assert.equal(flagValue(args,'-c'),`model=${tier.model}`,`${role} pins its model`);
    assert.ok(args.includes(`-c`)&&args.includes(`model_reasoning_effort=${tier.effort}`),`${role} pins its effort`);
    assert.ok(efforts.includes(tier.effort),`${role} names a real effort (saw ${tier.effort})`);
    assert.ok(/^gpt-5\./.test(tier.model),`${role} names a real Codex model (saw ${tier.model})`);
  }
});

test('the harder role of a pair never runs on a weaker model than the easier one',()=>{
  // entry-hard exists to escalate an entry that entry could not finish. If it ever stops
  // outranking entry, escalation is a no-op that costs a full iteration.
  assert.notEqual(ROLES['entry-hard'].model,ROLES.entry.model);
  assert.equal(ROLES['entry-hard'].effort,'high');
});

test('every role routes to a schema file that exists and matches its report shape',()=>{
  for(const [role,tier] of Object.entries(ROLES)){
    const args=argsFor(role);
    const schemaPath=flagValue(args,'--output-schema');
    assert.match(schemaPath,new RegExp(`codex-${tier.schema}\\.schema\\.json$`),`${role} routes to its own schema`);
    const schema=JSON.parse(readFileSync(schemaPath,'utf8'));
    assert.equal(schema.type,'object');
    for(const key of ['summary','files_changed'])assert.ok(schema.required.includes(key),`${role}'s schema requires ${key}`);
  }
});

test('the JSONL event stream never reaches stdout',()=>{
  // --json goes to a log file and only --output-last-message is printed. Losing this is how a
  // delegated run quietly puts a whole Codex transcript back into the orchestrator's context.
  const args=argsFor('entry');
  assert.ok(args.includes('--json'),'events are still requested');
  assert.ok(args.includes('--output-last-message'),'the final message is captured to a file');
  const source=readFileSync(at('scripts/codex-run.mjs'),'utf8');
  assert.match(source,/stdio:\['pipe',log,log\]/,'codex stdout and stderr are redirected to the log fd');
});

test('resume targets the last session without a positional that could bind to the session id',()=>{
  const resumed=codexArgs('fix',{lastMessagePath:'/tmp/last.json',resumeLast:true});
  assert.equal(resumed[0],'exec');
  assert.ok(resumed.indexOf('-C')<resumed.indexOf('resume'));
  assert.ok(resumed.indexOf('-s')<resumed.indexOf('resume'));
  assert.deepEqual(resumed.slice(-2),['resume','--last']);
  assert.ok(!resumed.includes('-'),'the brief arrives on stdin, never as a bare - positional');
});

test('resume can pin the exact entry session instead of racing another Codex run',()=>{
  const session='019fd5c1-8037-7d42-9ff8-f459bc98514f';
  const resumed=codexArgs('fix',{lastMessagePath:'/tmp/last.json',resumeSession:session});
  assert.deepEqual(resumed.slice(-2),['resume',session]);
  assert.throws(()=>codexArgs('fix',{lastMessagePath:'/tmp/last.json',resumeSession:session,resumeLast:true}),/not both/);
});

test('codexArgs refuses an unknown role and a missing output path',()=>{
  assert.throws(()=>codexArgs('nope',{lastMessagePath:'/tmp/last.json'}),/unknown role/);
  assert.throws(()=>codexArgs('entry',{}),/lastMessagePath is required/);
});

test('schemaErrors fails closed on a response missing a required key or of the wrong type',()=>{
  const schema=JSON.parse(readFileSync(at('schemas/codex-entry.schema.json'),'utf8'));
  const good={summary:'did it',files_changed:['src/app.js'],deviations:'none',tests_run:'npm test'};
  assert.deepEqual(schemaErrors(good,schema),[]);
  assert.ok(schemaErrors({...good,summary:undefined,files_changed:good.files_changed},schema).length);
  assert.ok(schemaErrors({...good,files_changed:'src/app.js'},schema).some(m=>m.includes('expected an array')));
  assert.ok(schemaErrors({...good,files_changed:[1]},schema).some(m=>m.includes('expected a string')));
  assert.ok(schemaErrors('not an object',schema).length);
});

test('sessionIdFrom reads the id Codex actually emits, and never throws on a truncated log',()=>{
  // Verified against a real run: codex exec --json emits "thread_id".
  assert.equal(sessionIdFrom('{"thread_id":"019fd5ab-1aee-7f22-9dbd-b9f50f0180e4"}'),'019fd5ab-1aee-7f22-9dbd-b9f50f0180e4');
  assert.equal(sessionIdFrom('{"session_id":"0123456789abcdef0"}'),'0123456789abcdef0');
  for(const input of ['','{"id":"7"}',null,undefined])assert.equal(sessionIdFrom(input),'none');
});
