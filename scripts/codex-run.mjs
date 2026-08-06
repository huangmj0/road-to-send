#!/usr/bin/env node
// The only place Codex flags are written. Every loop step that hands work to Codex goes through
// here, so the model tier, the reasoning effort and — most importantly — the sandbox are pinned
// per role in one table instead of being restated in prose across four agent surfaces.
//
// Two things this file exists to guarantee:
//   1. The sandbox is always explicit. ~/.codex/config.toml on a developer machine may well say
//      sandbox_mode = "danger-full-access" and approval_policy = "never"; a run that inherits that
//      can write anywhere. Every role below names its own -s, so the global default never applies.
//   2. Codex's reasoning stream never reaches the caller's context. --json events go to a log file
//      on disk and only the schema-validated final message is printed. That is the whole point of
//      delegating: the orchestrator pays for a fixed-size report, not for a transcript.
import {spawnSync} from 'node:child_process';
import {closeSync,mkdirSync,openSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

// The tiers this repo delegates across. Read-only roles cannot write the workspace even if the
// prompt asks them to; that is enforced by Codex, not by the prompt.
export const ROLES={
  scout:{model:'gpt-5.4-mini',effort:'low',sandbox:'read-only',schema:'report'},
  entry:{model:'gpt-5.6-terra',effort:'medium',sandbox:'workspace-write',schema:'entry'},
  'entry-hard':{model:'gpt-5.6-sol',effort:'high',sandbox:'workspace-write',schema:'entry'},
  fix:{model:'gpt-5.6-terra',effort:'medium',sandbox:'workspace-write',schema:'fix'},
  diagnose:{model:'gpt-5.6-sol',effort:'high',sandbox:'read-only',schema:'report'}
};
export const WRITE_ROLES=Object.keys(ROLES).filter(role=>ROLES[role].sandbox==='workspace-write');

export function codexArgs(role,{lastMessagePath,resumeSession='',resumeLast=false,cwd=root}={}){
  const tier=ROLES[role];
  if(!tier)throw new Error(`unknown role ${role} — expected one of ${Object.keys(ROLES).join('/')}`);
  if(!lastMessagePath)throw new Error('lastMessagePath is required');
  // `codex exec resume` takes an optional positional SESSION_ID before the prompt, so a bare `-`
  // would bind to the id rather than the prompt. Both forms therefore read the brief from piped
  // stdin and pass no positional at all.
  if(resumeSession&&resumeLast)throw new Error('choose --resume <session-id> or --resume-last, not both');
  // -C and -s belong to `codex exec`, not the `resume` subcommand. Keep all parent options before
  // `resume`; putting them after `--last` looks plausible but the installed CLI rejects them.
  return [
    'exec',
    '-C',cwd,
    '-s',tier.sandbox,
    '-c',`model=${tier.model}`,
    '-c',`model_reasoning_effort=${tier.effort}`,
    '--output-schema',join(root,'schemas',`codex-${tier.schema}.schema.json`),
    '--output-last-message',lastMessagePath,
    '--json',
    ...(resumeSession?['resume',resumeSession]:resumeLast?['resume','--last']:[])
  ];
}

// A deliberately small validator for the subset of JSON Schema these files use. Adding a real
// validator would mean a dependency, and rule 8 forbids one. Codex is already given the schema via
// --output-schema; this is the fail-closed second check on what actually came back.
export function schemaErrors(value,schema){
  const errors=[];
  if(schema.type==='object'){
    if(value===null||typeof value!=='object'||Array.isArray(value))return ['expected an object'];
    for(const key of schema.required||[])if(!(key in value))errors.push(`missing required key ${key}`);
    for(const [key,spec] of Object.entries(schema.properties||{})){
      if(!(key in value))continue;
      errors.push(...schemaErrors(value[key],spec).map(message=>`${key}: ${message}`));
    }
    return errors;
  }
  if(schema.type==='array'){
    if(!Array.isArray(value))return ['expected an array'];
    value.forEach((item,index)=>errors.push(...schemaErrors(item,schema.items||{}).map(message=>`[${index}] ${message}`)));
    return errors;
  }
  if(schema.type==='string'&&typeof value!=='string')return ['expected a string'];
  if(schema.type==='boolean'&&typeof value!=='boolean')return ['expected a boolean'];
  return errors;
}

// The session id lets a fix round resume the run that produced the diff. Codex reports it in an
// early --json event; the key has moved between versions, so accept any of the known spellings and
// treat "not found" as ordinary rather than fatal — a fresh run with the findings as brief works.
export function sessionIdFrom(jsonl){
  const match=/"(?:session_id|thread_id|conversation_id)"\s*:\s*"([0-9a-fA-F-]{16,})"/.exec(jsonl||'');
  return match?match[1]:'none';
}

const oneLine=text=>String(text??'').replace(/\s+/g,' ').trim()||'none';

function report(role,{status,session,result,logPath}){
  const tier=ROLES[role];
  const files=Array.isArray(result?.files_changed)&&result.files_changed.length?result.files_changed.join(','):'none';
  return [
    `ROLE: ${role}`,
    `MODEL: ${tier.model} ${tier.effort} ${tier.sandbox}`,
    `SESSION: ${session}`,
    `STATUS: ${status}`,
    `FILES: ${files}`,
    `SUMMARY: ${oneLine(result?.summary)}`,
    `DEVIATIONS: ${oneLine(result?.deviations)}`,
    `LOG: ${logPath}`
  ].join('\n');
}

function parseArgv(argv){
  const options={role:'',brief:'',resumeSession:'',resumeLast:false,printCommand:false};
  for(let index=0;index<argv.length;index+=1){
    const token=argv[index];
    if(token==='--role')options.role=argv[++index];
    else if(token==='--brief')options.brief=argv[++index];
    else if(token==='--resume'){
      const session=argv[++index];
      if(!session||session.startsWith('--'))throw new Error('--resume <session-id> is required');
      options.resumeSession=session;
    }
    else if(token==='--resume-last')options.resumeLast=true;
    else if(token==='--print-command')options.printCommand=true;
    else throw new Error(`unexpected argument ${token}`);
  }
  if(!options.role)throw new Error('--role is required');
  if(!ROLES[options.role])throw new Error(`unknown role ${options.role} — expected one of ${Object.keys(ROLES).join('/')}`);
  if(options.resumeLast&&options.resumeSession)throw new Error('choose --resume <session-id> or --resume-last, not both');
  if(!options.brief&&!options.printCommand)throw new Error('--brief <file> is required');
  return options;
}

function run(options){
  const stamp=`${process.pid}-${Date.now()}`;
  const logDir=join(tmpdir(),'road-to-send-codex');
  mkdirSync(logDir,{recursive:true});
  const logPath=join(logDir,`${options.role}-${stamp}.jsonl`);
  const lastMessagePath=join(logDir,`${options.role}-${stamp}.json`);
  const args=codexArgs(options.role,{lastMessagePath,resumeSession:options.resumeSession,resumeLast:options.resumeLast});

  if(options.printCommand){console.log(['codex',...args].join(' '));return 0;}

  const brief=readFileSync(options.brief,'utf8');
  const log=openSync(logPath,'w');
  let result=null;
  try{
    // stdout is the JSONL event stream and goes straight to the log fd, never to this process.
    const codex=spawnSync('codex',args,{cwd:root,input:brief,stdio:['pipe',log,log]});
    if(codex.error)throw new Error(`codex could not be invoked: ${codex.error.message}`);
    if(codex.status!==0)throw new Error(`codex exited ${codex.status} — see ${logPath}`);
    const schema=JSON.parse(readFileSync(join(root,'schemas',`codex-${ROLES[options.role].schema}.schema.json`),'utf8'));
    result=JSON.parse(readFileSync(lastMessagePath,'utf8'));
    const errors=schemaErrors(result,schema);
    if(errors.length)throw new Error(`codex response did not match its schema: ${errors.join('; ')}`);
  }catch(error){
    closeSync(log);
    console.log(report(options.role,{status:'failed',session:sessionIdFrom(safeRead(logPath)),result:{summary:error.message},logPath}));
    return 1;
  }
  closeSync(log);

  // AST-only, no API cost. A stale graph makes the next brief wrong, but a graph that failed to
  // rebuild is not a reason to throw away a good diff, so this never changes the exit status.
  let graph='skipped';
  if(WRITE_ROLES.includes(options.role)){
    const updated=spawnSync('graphify',['update',root],{cwd:root,encoding:'utf8'});
    graph=updated.error||updated.status!==0?'stale':'updated';
  }
  console.log(report(options.role,{status:'ok',session:sessionIdFrom(safeRead(logPath)),result,logPath}));
  console.log(`GRAPH: ${graph}`);
  return 0;
}

const safeRead=path=>{try{return readFileSync(path,'utf8');}catch{return '';}};

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{process.exit(run(parseArgv(process.argv.slice(2))));}
  catch(error){console.error(`codex run: ${error.message}`);process.exit(1);}
}
