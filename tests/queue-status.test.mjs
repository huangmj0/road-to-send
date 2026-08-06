// TRAP: This suite may run the read-only queue reporter against temporary log fixtures. Always use
// --no-fetch, never point it at the live log, and assert only its exit code/output — it must not
// mutate refs, the worktree, or IMPROVEMENT_LOG.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const script=join(root,'scripts/queue-status.mjs');
const entry=(n,status)=>`## ${n}. Entry ${n}\n\nStatus: ${status}\nNotes: none\n\n---\n`;

function report(states,{ship=false}={}){
  const dir=mkdtempSync(join(tmpdir(),'road-to-send-queue-'));
  const fixture=join(dir,'queue.md');
  writeFileSync(fixture,states.map((state,index)=>entry(index+1,state)).join('\n'));
  const args=[script,'--no-fetch',...(ship?['--ship']:[]),fixture];
  const run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
  rmSync(dir,{recursive:true,force:true});
  return run;
}

test('a sub-threshold batch leaves the next Todo available',()=>{
  const run=report(['Done — 2026-08-05','Done — 2026-08-05','Todo']);
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/batch: 2\/3 unshipped/);
  assert.match(run.stdout,/next:  3 — Entry 3/);
});

test('BATCH_MIN entries take precedence over Todo work and exit 6',()=>{
  const run=report(['Done — 2026-08-05','Done — 2026-08-05','Done — 2026-08-05','Todo']);
  assert.equal(run.status,6,run.stderr);
  assert.match(run.stdout,/ship the batch — 3 entries waiting/);
  assert.doesNotMatch(run.stdout,/clear to start/);
});

test('--ship forces a non-empty tail but not an empty queue',()=>{
  const tail=report(['Done — 2026-08-05'],{ship:true});
  assert.equal(tail.status,6,tail.stderr);
  assert.match(tail.stdout,/requested with --ship/);
  const empty=report([],{ship:true});
  assert.equal(empty.status,3,empty.stderr);
  assert.match(empty.stdout,/queue empty — no Todo entries/);
});

test('an unforced tail reports how to ship instead of stranding it silently',()=>{
  const run=report(['Done — 2026-08-05']);
  assert.equal(run.status,3,run.stderr);
  assert.match(run.stdout,/run npm run queue -- --ship/);
});
