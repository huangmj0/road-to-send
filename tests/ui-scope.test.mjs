// TRAP: This suite feeds literal diff text to a pure classifier. It must never invoke git — a
// test that diffs the real working tree passes or fails depending on what happens to be
// uncommitted, which is the opposite of a test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DIFF_PATHS,classify,parseDiff} from '../scripts/ui-scope.mjs';

const diff=(file,body)=>`diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1,3 +1,3 @@\n${body}\n`;

test('a diff that touches no UI surface is none',()=>{
  assert.equal(classify(diff('scripts/build.mjs','+const x=1;')).level,'none');
  assert.equal(classify('').level,'none');
});

test('value-only style tweaks inside the existing structure are minor',()=>{
  for(const line of ['+  color: #222;','+  font-size: 1.1rem;','+  border-radius: 8px;','+  padding: 12px;','+  background: var(--card);']){
    const {level}=classify(diff('src/styles.css',line));
    assert.equal(level,'minor',`${line.trim()} is a value tweak`);
  }
});

test('any style change that can reflow the page is major',()=>{
  for(const line of ['+  display: grid;','+  grid-template-columns: 1fr 1fr;','+  position: sticky;','+  width: 50%;','+  max-height: 40vh;','+  flex-direction: column;','+  gap: 8px;','+  overflow-x: auto;','+  transform: translateY(2px);']){
    const {level,reasons}=classify(diff('src/styles.css',line));
    assert.equal(level,'major',`${line.trim()} reflows`);
    assert.match(reasons[0],/layout property/);
  }
});

test('adding or removing an element in the template is major, in either direction',()=>{
  assert.equal(classify(diff('src/index.template.html','+  <section class="week"></section>')).level,'major');
  assert.equal(classify(diff('src/index.template.html','-  <button type="button">Log</button>')).level,'major');
});

test('a new DOM id in the template is major even without a new element',()=>{
  const {level,reasons}=classify(diff('src/index.template.html','+  <span id="paceNote"></span>'));
  assert.equal(level,'major');
  assert.ok(reasons.some(reason=>/element|DOM id/.test(reason)));
});

test('rewording text inside the existing template is minor, not major',()=>{
  const body='-  Send it\n+  Send it this week';
  assert.equal(classify(diff('src/index.template.html',body)).level,'minor');
});

test('app.js that renders different markup is major, and app.js logic alone is none',()=>{
  assert.equal(classify(diff('src/app.js','+  wrap.innerHTML = `<li>${name}</li>`;')).level,'major');
  assert.equal(classify(diff('src/app.js','+  const row = document.createElement("tr");')).level,'major');
  assert.equal(classify(diff('src/app.js','+  const total = computeCredits(logs);')).level,'none');
});

test('the worst class in a multi-file diff wins',()=>{
  const combined=diff('src/styles.css','+  color: #333;')+diff('src/index.template.html','+  <div class="pace"></div>');
  assert.equal(classify(combined).level,'major');
});

test('parseDiff splits added and removed lines per file and ignores hunk headers',()=>{
  const files=parseDiff(diff('src/styles.css','+  color: red;\n-  color: blue;'));
  assert.deepEqual(files.get('src/styles.css').added,['  color: red;']);
  assert.deepEqual(files.get('src/styles.css').removed,['  color: blue;']);
});

test('the generated artifact is never diffed, so a template change is not counted twice',()=>{
  assert.ok(!DIFF_PATHS.includes('index.html'));
  assert.deepEqual(DIFF_PATHS,['--','src/app.js','src/styles.css','src/index.template.html']);
});
