#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const SHA=/^[0-9a-f]{40}$/;
const entryRef=(name,n)=>new RegExp(`^(?:codex|claude)/entry-${n}-`).test(name||'');

export function releaseErrors(pr,{entry,base,head,subject}){
  const errors=[];
  if(!Number.isInteger(entry)||entry<1)errors.push('entry must be a positive integer');
  if(!SHA.test(base||''))errors.push('base must be a full SHA');
  if(!SHA.test(head||''))errors.push('head must be a full SHA');
  if(!subject||subject.includes('\n'))errors.push('subject must be one line');
  if(pr.state!=='OPEN')errors.push('PR is not open');
  if(pr.isCrossRepository)errors.push('PR head is from a fork');
  if(pr.isDraft)errors.push('PR is draft');
  if(pr.baseRefName!=='main')errors.push('PR base is not main');
  if(pr.baseRefOid!==base)errors.push('PR base changed');
  if(pr.headRefOid!==head)errors.push('PR head changed');
  if(!entryRef(pr.headRefName,entry))errors.push('PR head does not match the entry');
  if(pr.mergeStateStatus!=='CLEAN')errors.push('PR is not cleanly mergeable');
  if(['CHANGES_REQUESTED','REVIEW_REQUIRED'].includes(pr.reviewDecision))errors.push('PR review requirement is not satisfied');
  if(!Array.isArray(pr.commits)||pr.commits.length!==1)errors.push('PR must contain exactly one commit');
  else{
    if(pr.commits[0].oid!==head)errors.push('PR commit is not the reviewed head');
    if(pr.commits[0].messageHeadline!==subject)errors.push('PR subject changed');
  }
  if(!Array.isArray(pr.statusCheckRollup)||!pr.statusCheckRollup.length)errors.push('PR has no check runs');
  else if(pr.statusCheckRollup.some(check=>check.__typename==='CheckRun'?(check.status!=='COMPLETED'||check.conclusion!=='SUCCESS'):check.state!=='SUCCESS'))errors.push('not every check is green');
  return errors;
}

export function amendErrors(pr,{oldHead,newHead}){
  const errors=[];
  if(!SHA.test(oldHead||''))errors.push('old head must be a full SHA');
  if(!SHA.test(newHead||''))errors.push('new head must be a full SHA');
  if(oldHead===newHead)errors.push('amended head did not change');
  if(pr.state!=='OPEN')errors.push('PR is not open');
  if(pr.isCrossRepository)errors.push('PR head is from a fork');
  if(pr.baseRefName!=='main')errors.push('PR base is not main');
  if(pr.headRefOid!==oldHead)errors.push('PR head changed before amend push');
  if(!/^(?:codex|claude)\/entry-\d+-/.test(pr.headRefName||''))errors.push('PR head is not a controlled entry branch');
  return errors;
}

export function publishErrors({entry,branch,base,head,parent,count,subject,actualSubject,remoteExists}){
  const errors=[];
  if(!Number.isInteger(entry)||entry<1)errors.push('entry must be a positive integer');
  if(!entryRef(branch,entry))errors.push('current branch does not match the entry');
  if(!SHA.test(base||''))errors.push('base must be a full SHA');
  if(!SHA.test(head||''))errors.push('head must be a full SHA');
  if(parent!==base)errors.push('entry head is not the sole child of origin/main');
  if(count!=='1')errors.push('entry range is not exactly one commit');
  if(!subject||subject.includes('\n')||actualSubject!==subject)errors.push('entry subject does not match');
  if(remoteExists)errors.push('remote entry branch already exists');
  return errors;
}

const run=(cmd,args)=>{
  const result=spawnSync(cmd,args,{cwd:root,encoding:'utf8'});
  if(result.status!==0)throw new Error(`${cmd} ${args.join(' ')} failed: ${(result.stderr||result.stdout).trim()}`);
  return result.stdout.trim();
};
const prFields='number,state,isDraft,isCrossRepository,reviewDecision,baseRefName,baseRefOid,headRefName,headRefOid,mergeStateStatus,statusCheckRollup,commits';
const prView=target=>JSON.parse(run('gh',['pr','view',target,'--json',prFields]));
const assertNoErrors=errors=>{if(errors.length)throw new Error(errors.join('; '));};
const rev=ref=>run('git',['rev-parse',ref]);
const fetchEntry=(ref)=>run('git',['fetch','origin','+refs/heads/main:refs/remotes/origin/main',`+refs/heads/${ref}:refs/remotes/origin/${ref}`]);

function verifyOneCommit(base,head,subject){
  if(rev(`${head}^`)!==base)throw new Error('reviewed head is not the sole child of reviewed base');
  if(run('git',['rev-list','--count',`${base}..${head}`])!=='1')throw new Error('reviewed range is not exactly one commit');
  if(run('git',['show','-s','--format=%s',head])!==subject)throw new Error('reviewed commit subject changed');
}

function publish(entryText,head,subject){
  const entry=Number(entryText);
  run('git',['fetch','origin','+refs/heads/main:refs/remotes/origin/main']);
  const branch=run('git',['branch','--show-current']);
  const base=rev('origin/main');
  const actualHead=rev('HEAD');
  const parent=rev(`${actualHead}^`);
  const count=run('git',['rev-list','--count',`${base}..${actualHead}`]);
  const actualSubject=run('git',['show','-s','--format=%s',actualHead]);
  const remoteExists=Boolean(run('git',['ls-remote','--heads','origin',`refs/heads/${branch}`]));
  assertNoErrors(publishErrors({entry,branch,base,head:actualHead,parent,count,subject,actualSubject,remoteExists}));
  if(actualHead!==head)throw new Error('checked-out head does not match requested head');
  run('git',['push','-u','origin',`${head}:refs/heads/${branch}`]);
  const remote=run('git',['ls-remote','origin',`refs/heads/${branch}`]).split(/\s+/)[0];
  if(remote!==head)throw new Error('remote entry branch did not reach requested head');
  console.log(`published ${branch} at ${head}`);
}

function amend(target,oldHead,newHead){
  const pr=prView(target);
  assertNoErrors(amendErrors(pr,{oldHead,newHead}));
  fetchEntry(pr.headRefName);
  if(rev('HEAD')!==newHead)throw new Error('new head is not checked out');
  if(run('git',['branch','--show-current'])!==pr.headRefName)throw new Error('PR branch is not checked out');
  verifyOneCommit(pr.baseRefOid,newHead,run('git',['show','-s','--format=%s',oldHead]));
  run('git',['push',`--force-with-lease=refs/heads/${pr.headRefName}:${oldHead}`,'origin',`${newHead}:refs/heads/${pr.headRefName}`]);
  const remote=run('git',['ls-remote','origin',`refs/heads/${pr.headRefName}`]).split(/\s+/)[0];
  if(remote!==newHead)throw new Error('remote entry branch did not reach amended head');
  console.log(`amended ${pr.headRefName} to ${newHead}`);
}

function release(target,entryText,base,head,subject){
  const entry=Number(entryText);
  const pr=prView(target);
  assertNoErrors(releaseErrors(pr,{entry,base,head,subject}));
  fetchEntry(pr.headRefName);
  verifyOneCommit(base,head,subject);
  if(rev('origin/main')!==base)throw new Error('origin/main changed after review');
  run('git',['push','origin',`${head}:refs/heads/main`]);
  run('git',['fetch','origin','main']);
  if(rev('origin/main')!==head)throw new Error('origin/main did not reach reviewed head');
  console.log(`released entry ${entry} at ${head}`);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const [command,...args]=process.argv.slice(2);
    if(command==='publish'&&args.length===3)publish(...args);
    else if(command==='amend'&&args.length===3)amend(...args);
    else if(command==='release'&&args.length===5)release(...args);
    else throw new Error('usage: queue-git-guard.mjs publish <entry> <head> <subject> | amend <pr> <old-head> <new-head> | release <pr> <entry> <base> <head> <subject>');
  }catch(error){console.error(`queue git guard: ${error.message}`);process.exit(1);}
}
