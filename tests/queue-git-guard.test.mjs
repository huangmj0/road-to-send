// TRAP: This suite tests pure guard decisions only. It must never invoke git, gh, or mutate a ref.
import test from 'node:test';
import assert from 'node:assert/strict';
import {amendErrors,publishErrors,releaseErrors} from '../scripts/queue-git-guard.mjs';
import {formatHold} from '../scripts/log-model.mjs';

const base='a'.repeat(40),head='b'.repeat(40),next='c'.repeat(40),subject='Ship one entry';
const green=()=>({
  state:'OPEN',isDraft:false,isCrossRepository:false,reviewDecision:'',baseRefName:'main',baseRefOid:base,
  headRefName:'codex/entry-89-ship-one-entry',headRefOid:head,mergeStateStatus:'CLEAN',
  commits:[{oid:head,messageHeadline:subject}],
  statusCheckRollup:[{__typename:'CheckRun',status:'COMPLETED',conclusion:'SUCCESS'}],
});

test('release guard accepts one green entry commit at the reviewed base and head',()=>{
  assert.deepEqual(releaseErrors(green(),{entry:89,base,head,subject}),[]);
});

test('release guard rejects a moving base, changed head, draft, red check, or extra commit',()=>{
  for(const mutate of [
    pr=>{pr.baseRefOid=next},pr=>{pr.headRefOid=next},pr=>{pr.isDraft=true},
    pr=>{pr.statusCheckRollup[0].conclusion='FAILURE'},pr=>{pr.commits.push({oid:next,messageHeadline:'extra'})},
  ]){
    const pr=green();mutate(pr);
    assert.ok(releaseErrors(pr,{entry:89,base,head,subject}).length);
  }
});

test('release guard rejects fork heads and unsatisfied review protection',()=>{
  const fork=green();fork.isCrossRepository=true;
  assert.ok(releaseErrors(fork,{entry:89,base,head,subject}).includes('PR head is from a fork'));
  for(const decision of ['CHANGES_REQUESTED','REVIEW_REQUIRED']){
    const pr=green();pr.reviewDecision=decision;
    assert.ok(releaseErrors(pr,{entry:89,base,head,subject}).includes('PR review requirement is not satisfied'));
  }
});

test('release guard binds the entry branch and exact recorded subject',()=>{
  const wrongBranch=green();wrongBranch.headRefName='codex/entry-90-other';
  assert.ok(releaseErrors(wrongBranch,{entry:89,base,head,subject}).includes('PR head does not match the entry'));
  assert.ok(releaseErrors(green(),{entry:89,base,head,subject:'different'}).includes('PR subject changed'));
});

test('amend guard permits only a changed head on an open controlled entry branch',()=>{
  assert.deepEqual(amendErrors(green(),{oldHead:head,newHead:next}),[]);
  const main=green();main.headRefName='main';
  assert.ok(amendErrors(main,{oldHead:head,newHead:next}).includes('PR head is not a controlled entry branch'));
  assert.ok(amendErrors(green(),{oldHead:head,newHead:head}).includes('amended head did not change'));
  const fork=green();fork.isCrossRepository=true;
  assert.ok(amendErrors(fork,{oldHead:head,newHead:next}).includes('PR head is from a fork'));
});

test('initial publish requires a new controlled one-commit branch on origin main',()=>{
  const input={entry:89,branch:'codex/entry-89-ship-one-entry',base,parent:base,head,count:'1',subject,actualSubject:subject,remoteExists:false};
  assert.deepEqual(publishErrors(input),[]);
  for(const change of [
    {branch:'main'},{parent:next},{count:'2'},{actualSubject:'changed'},{remoteExists:true},
  ])assert.ok(publishErrors({...input,...change}).length);
});

test('exit-4 hold record separates the commit subject from the entry title',()=>{
  const line=formatHold({n:89,title:'A much longer queue title',commitSubject:'Collapse CSS'},'origin/codex/entry-89-css');
  assert.deepEqual(JSON.parse(line.slice('hold:  '.length)),{
    entry:89,ref:'origin/codex/entry-89-css',subject:'Collapse CSS',
  });
  assert.ok(!line.includes('A much longer queue title'));
});
