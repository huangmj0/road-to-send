#!/usr/bin/env node
// Decides whether a diff is a major UI change, and therefore whether it earns a design review.
//
// This is deliberately derived from the diff rather than declared by whoever wrote it. A
// self-declared flag is a gate an agent can walk past by forgetting to set it; a classifier that
// reads the actual hunks cannot be talked out of its answer. It errs toward `major`: a needless
// design review costs one review, a missed one ships a layout nobody looked at.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

export const UI_FILES=['src/styles.css','src/index.template.html'];

// Properties that move things. Colour, type and spacing tweaks inside an existing layout are
// minor; anything that can reflow the page is not.
const LAYOUT=/^\s*(display|position|float|clear|overflow(-[xy])?|z-index|grid[a-z-]*|flex[a-z-]*|gap|row-gap|column-gap|width|height|(min|max)-(width|height)|inset|top|right|bottom|left|transform|aspect-ratio)\s*:/;
const ELEMENT=/<\/?(div|section|article|header|footer|nav|main|aside|table|thead|tbody|tr|td|th|ul|ol|li|button|form|input|select|textarea|label|dialog|details|summary|canvas|svg|img|p|h[1-6])\b/i;
const DOM_ID=/\bid\s*=\s*["'][^"']+["']/;
const CREATES_DOM=/document\.createElement|\.innerHTML\s*=|\.insertAdjacentHTML|\.appendChild\(/;

export function parseDiff(text){
  const files=new Map();
  let current=null;
  for(const line of String(text||'').split('\n')){
    const header=/^\+\+\+ b\/(.+)$/.exec(line);
    if(header){current={added:[],removed:[]};files.set(header[1],current);continue;}
    if(!current)continue;
    if(line.startsWith('+++')||line.startsWith('---'))continue;
    if(line.startsWith('+'))current.added.push(line.slice(1));
    else if(line.startsWith('-'))current.removed.push(line.slice(1));
  }
  return files;
}

export function classify(diffText){
  const files=parseDiff(diffText);
  const reasons=[];
  let touched=false;

  const css=files.get('src/styles.css');
  if(css){
    touched=true;
    for(const line of [...css.added,...css.removed]){
      if(LAYOUT.test(line)){reasons.push(`src/styles.css changes a layout property: ${line.trim()}`);break;}
    }
  }

  const template=files.get('src/index.template.html');
  if(template){
    touched=true;
    for(const line of [...template.added,...template.removed]){
      if(ELEMENT.test(line)){reasons.push(`src/index.template.html adds or removes an element: ${line.trim().slice(0,80)}`);break;}
    }
    for(const line of template.added){
      if(DOM_ID.test(line)&&!template.removed.some(other=>other.trim()===line.trim())){
        reasons.push(`src/index.template.html introduces a DOM id: ${line.trim().slice(0,80)}`);break;
      }
    }
  }

  const app=files.get('src/app.js');
  if(app){
    for(const line of [...app.added,...app.removed]){
      if(ELEMENT.test(line)||CREATES_DOM.test(line)){
        touched=true;
        reasons.push(`src/app.js renders different markup: ${line.trim().slice(0,80)}`);
        break;
      }
    }
  }

  if(reasons.length)return {level:'major',reasons};
  if(touched)return {level:'minor',reasons:['UI files changed, but only values inside the existing structure']};
  return {level:'none',reasons:[]};
}

// index.html is generated, so it is excluded: it would double-count every template and style
// change and make every UI diff look major.
export const DIFF_PATHS=['--','src/app.js','src/styles.css','src/index.template.html'];

function workingTreeDiff(){
  // Approved earlier entries are staged as the open batch. The unstaged diff is the current entry,
  // so classifying against HEAD would charge later entries for an earlier entry's design gate.
  const run=spawnSync('git',['diff',...DIFF_PATHS],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
  if(run.status!==0)throw new Error(`git diff failed: ${(run.stderr||'').trim()}`);
  return run.stdout;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const stdinDiff=process.argv.includes('--stdin');
    const {level,reasons}=classify(stdinDiff?await new Response(process.stdin).text():workingTreeDiff());
    console.log(`UI: ${level}`);
    for(const reason of reasons)console.log(`  ${reason}`);
    process.exit(0);
  }catch(error){console.error(`ui scope: ${error.message}`);process.exit(1);}
}
