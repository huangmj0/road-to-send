import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)?.[1];
const scoring=JSON.parse(readFileSync(new URL('../src/scoring.json',import.meta.url),'utf8'));
assert.ok(script,'index.html contains an inline application script');
assert.doesNotThrow(()=>new Function(script),'application JavaScript parses');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'HTML ids are unique');
for(const id of ['hardestGrade','pullUps','activityDate','identityMember','newParticipantName','proxyMember','endpoint','challengeStart','tripDate','groupGoalInput'])assert.match(html,new RegExp(`<label[^>]+for="${id}"`),`${id} has an associated label`);
for(const tab of ['you','record','crew']){
  assert.match(html,new RegExp(`data-panel="${tab}"`),`${tab} panel exists`);
  assert.match(html,new RegExp(`data-tab="${tab}"`),`${tab} navigation exists`);
}
assert.match(html,/class="bottom-nav"[^>]+aria-label="Primary"/,'bottom navigation is named');
assert.match(html,/id="recordMeter"[^>]+aria-label=/,'record preview meter is accessible');
assert.match(html,/id="syncDiagnostics"[^>]+role="status"[^>]+aria-live="polite"/,'persistent sync diagnostics are announced');
assert.match(html,/id="toast"[^>]+role="status"[^>]+aria-live="polite"/,'toast is announced');
for(const title of ['identityTitle','proxyTitle','setupTitle'])assert.match(html,new RegExp(`role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="${title}"`),`${title} dialog is named`);
assert.match(html,/aria-label="Close identity picker"/);
assert.match(html,/aria-label="Close person picker"/);
assert.match(html,/aria-label="Close shared setup"/);
assert.deepEqual([scoring.dailyCap,scoring.climbPoints],[5,5]);
assert.deepEqual(scoring.grades,['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']);
assert.match(script,/const DAILY_CAP=SCORING\.dailyCap,GRADES=SCORING\.grades/,'browser uses shared scoring config');
assert.match(script,/const DAILY_CAP=SCORING\.dailyCap,GRADES=SCORING\.grades/,'Apps Script uses shared scoring config');
assert.doesNotMatch(html,/Daily bounties|Balanced week bonus|Record send pyramid|Core session|Mobility \(10\+ min\)/i,'removed features are absent from the UI');
assert.match(script,/Saved to the Sheet, but refresh failed\. Do not retry/,'confirmed saves are distinguished from refresh failures');
assert.match(html,/Hard mode[\s\S]*10 pull-ups = 3 pts/,'hard mode requirements are shown');
assert.match(html,/Super hard mode[\s\S]*20 pull-ups = 3 pts/,'super hard mode requirements are shown');
assert.equal((html.match(/<table>/g)||[]).length,1,'all modes share one leaderboard');
assert.match(html,/env\(safe-area-inset-bottom\)/,'mobile navigation respects safe areas');
console.log('Road to Send static accessibility and UX checks passed.');
