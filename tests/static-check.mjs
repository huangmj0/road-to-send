// Presence, source order and accessibility assertions against the built index.html. This is where
// aria-* coverage of the SHIPPED MARKUP belongs — the client-state suites never parse index.html,
// so an attribute that is only ever authored in the template can only be checked here. An aria-*
// attribute a handler writes at runtime is now readable from the element stub in tests/harness.js
// and is better asserted there, next to the behaviour that writes it.
//
// TRAP — ADD assertions here; never relax, retarget or delete one:
//   * Several assertions pin DOM *source order*, so moving an element in
//     src/index.template.html breaks a check that names neither element helpfully.
//   * One assertion pair still slices a single LINE out of the script — populateBountySelectSource.
//     A line-based slice answers '' when the shape it assumes stops holding, and a NEGATIVE
//     assertion against '' passes while proving nothing, so each such slice keeps an `assert.ok`
//     immediately after it. Add the guard with the slice, in the same edit, or use the rendered
//     surface in tests/client-state.dom.test.js instead — which is the better home either way.
//   * Several match exact compact CSS text — `.trend-scroll{overflow-x:auto}`,
//     `@media(prefers-color-scheme:dark)` with no space. Reformatting src/styles.css breaks
//     them, again with an unhelpful message.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const artifactScript=html.match(/<script>([\s\S]*)<\/script>/)?.[1];
const script=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const scoring=JSON.parse(readFileSync(new URL('../src/scoring.json',import.meta.url),'utf8'));
assert.ok(artifactScript,'index.html contains an inline application script');
assert.doesNotThrow(()=>new Function(artifactScript),'application JavaScript parses');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'HTML ids are unique');
for(const id of ['hardestGrade','bountySelect','activityNote','activityDate','identityMember','newParticipantName','proxyMember','endpoint','challengeStart','tripDate','groupGoalInput'])assert.match(html,new RegExp(`<label[^>]+for="${id}"`),`${id} has an associated label`);
for(const tab of ['you','record','crew']){
  assert.match(html,new RegExp(`data-panel="${tab}"`),`${tab} panel exists`);
  assert.match(html,new RegExp(`data-tab="${tab}"`),`${tab} navigation exists`);
}
assert.match(html,/class="bottom-nav"[^>]+aria-label="Primary"/,'bottom navigation is named');
assert.match(html,/id="navYou" class="active"[^>]*>\s*<span aria-hidden="true"><svg class="glyph"><use href="#g-you"\/><\/svg><\/span>You<\/button>/,'the You navigation button retains its live active class and hides its glyph');
assert.match(html,/id="navRecord"[^>]*>\s*<span aria-hidden="true"><svg class="glyph"><use href="#g-plus"\/><\/svg><\/span>Record<\/button>/,'the Record navigation button keeps its visible label and hides its glyph');
assert.match(html,/id="navCrew"[^>]*>\s*<span aria-hidden="true"><svg class="glyph"><use href="#g-crew"\/><\/svg><\/span>Crew<\/button>/,'the Crew navigation button keeps its visible label and hides its glyph');
for(const tab of ['you','record','crew'])assert.match(html,new RegExp(`data-panel="${tab}"[^>]*aria-labelledby="nav${tab[0].toUpperCase()+tab.slice(1)}"`),`the ${tab} section remains labelled by its navigation button`);
assert.doesNotMatch(html,/id="leaderPointsBtn"[^>]*class="[^"]*\bactive\b/,'the Points toggle carries no dead active class');
assert.doesNotMatch(html,/id="leaderWeekBtn"[^>]*class="[^"]*\bactive\b/,'the Recent toggle carries no dead active class');
assert.match(html,/id="leaderPointsBtn"[^>]*aria-pressed=/,'the Points toggle keeps its pressed state');
assert.match(html,/id="leaderWeekBtn"[^>]*aria-pressed=/,'the Recent toggle keeps its pressed state');
assert.doesNotMatch(html,/review-dialog|trend-hover/,'the three dead class hooks are absent from the built page');
assert.match(html,/id="recordMeter"[^>]+aria-label=/,'record preview meter is accessible');
assert.match(html,/id="syncDiagnostics"[^>]+role="status"[^>]+aria-live="polite"/,'persistent sync diagnostics are announced');
assert.match(html,/id="toast"[^>]+role="status"[^>]+aria-live="polite"/,'toast is announced');
for(const title of ['identityTitle','proxyTitle','setupTitle','confirmTitle','personTitle','weekReviewTitle'])assert.match(html,new RegExp(`role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="${title}"`),`${title} dialog is named`);
assert.match(html,/aria-label="Close identity picker"/);
assert.match(html,/aria-label="Close person picker"/);
assert.match(html,/aria-label="Close shared setup"/);
assert.match(html,/aria-label="Close delete confirmation"/);
assert.match(html,/id="confirmOk"[^>]*type="button"/,'the confirm dialog confirms with a real button');
assert.match(html,/id="confirmCancel"[^>]*type="button"/,'the confirm dialog cancels with a real button');
assert.match(html,/id="confirmBody"[\s\S]*id="confirmNote"[\s\S]*id="confirmCancel"/,'the confirmation note sits between its body and actions');
assert.match(script,/This cannot be undone\./,'the shared delete warning is selected in the script');
assert.match(script,/function requestDelete\(/,'deleting an entry goes through the confirm request helper');
assert.match(html,/aria-label="Close person details"/);
assert.match(script,/function closeIfScrim\(/,'clicking the backdrop closes the dialog it belongs to');
assert.match(script,/function openPersonCard\(/,'tapping a climber opens the per-person card');
assert.doesNotMatch(script,/<tr[^>]*tabindex=/,'leaderboard rows stay plain rows without a fake tab stop');
assert.doesNotMatch(script,/[^.\w]confirm\(/,'destructive actions use the in-app dialog, never a native window.confirm');
assert.doesNotMatch(script,/deploy v11/,'the outdated-script message derives its version from SUPPORTED_API_VERSIONS instead of a hard-coded literal');
assert.deepEqual(Object.keys(scoring.categories),['climb','exercise','mobility'],'three categories are configured');
assert.equal(scoring.balancedDayBonus,2,'balanced-day bonus is configured');
assert.equal(scoring.weeklyBountyCap,6,'weekly bounty cap is configured');
assert.ok(Array.isArray(scoring.bounties)&&scoring.bounties.length>=6,'a bounty catalog is present');
assert.ok(scoring.bounties.every(b=>typeof b.id==='string'&&b.id&&typeof b.title==='string'&&b.title&&typeof b.description==='string'&&b.description&&Number.isInteger(b.points)&&b.points>=1&&b.points<=3&&['climb','exercise','mobility'].includes(b.category)),'each bounty has a name, description, integer 1-3 points, and a category');
assert.equal(new Set(scoring.bounties.map(b=>b.id)).size,scoring.bounties.length,'bounty ids are unique across the catalog');
for(const cat of Object.keys(scoring.categories))assert.ok(scoring.bounties.some(b=>b.category===cat),`the ${cat} bounty pool is not empty`);
assert.deepEqual(scoring.grades,['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']);
assert.match(script,/const GRADES=SCORING\.grades,CATEGORIES=Object\.keys\(SCORING\.categories\)/,'browser reads the shared scoring config');
assert.match(artifactScript,/const SCRIPT=`const SCORING=/,'Apps Script reads the shared scoring config');
assert.doesNotMatch(html,/Hard mode|Super hard mode|pull-up mode|Record send pyramid|Balanced week bonus/i,'removed pull-up-mode and legacy features are absent from the UI');
// Saving… was already the label on two buttons (#saveActivityBtn and #saveSetupBtn) before this
// entry, so the preview branch is the third occurrence — a >=2 guard could never have failed.
assert.ok((script.match(/Saving…/g)||[]).length>=3,'the preview reports an in-flight save, on top of the two button labels');
assert.match(html,/id="heatmapSummary"/,'the heatmap carries a visible caption');
assert.match(html,/id="trendSummary"/,'the trend chart carries a visible caption');
assert.match(html,/\.page-head\{flex-wrap:wrap\}\.page-head>div\{min-width:0\}\.page-head h1\{overflow-wrap:anywhere\}/,'the page head wraps long names while keeping its actions reachable');
const stylesheet=html.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
assert.match(stylesheet,/:focus-visible\{outline:3px solid var\(--green\);outline-offset:2px\}/,'the global focus ring uses the shared high-contrast green treatment');
assert.equal((stylesheet.match(/:focus-visible\{outline:3px solid var\(--green\);outline-offset:2px\}/g)||[]).length,1,'the shared focus ring is declared once globally');
// Gold is too low-contrast to ring focus on the cream page, and sage is invisible against the sage
// hero — so the page keeps its sage ring and the hero, and only the hero, swaps to gold.
assert.doesNotMatch(stylesheet.replace(/\.today-card :focus-visible\{[^}]*\}/,''),/:focus-visible[^}]*var\(--gold\)/,'no focus ring on the cream page uses the low-contrast gold accent');
assert.match(stylesheet,/\.today-card :focus-visible\{outline-color:var\(--gold\)\}/,'the sage hero swaps its focus ring to gold, which a sage ring on a sage card would not show');
assert.match(stylesheet,/button\.bounty:focus-visible\{outline:3px solid var\(--green\);outline-offset:-2px;border-radius:10px\}/,'the bounty row keeps its inset focus ring geometry');
assert.match(stylesheet,/\.progress i\{[^}]*background:var\(--orange-ink\)/,'the progress fill uses the contrast-safe orange ink token');
assert.match(stylesheet,/td\.sorted strong\{color:var\(--orange-ink\)\}/,'the sorted leaderboard value uses the contrast-safe orange ink token');
assert.match(stylesheet,/\.point-meter i\.seg-exercise\.filled\{background:var\(--orange-ink\);border-color:var\(--orange-ink\)\}/,'the exercise meter fill uses orange ink');
assert.match(stylesheet,/\.point-meter i\.seg-mobility\.filled\{background:var\(--danger\);border-color:var\(--danger\)\}/,'the mobility meter fill uses the visible danger token');
assert.match(stylesheet,/\.point-meter i\.seg-bonus\{border-color:var\(--orange-ink\);border-style:dashed\}/,'the bonus meter segment keeps a visible dashed border');
assert.match(stylesheet,/\.heat1\{background:color-mix\(in srgb,var\(--orange\) 24%,var\(--sand\)\)\}\.heat2\{background:color-mix\(in srgb,var\(--orange\) 48%,var\(--sand\)\)\}\.heat3\{background:color-mix\(in srgb,var\(--orange\) 73%,var\(--sand\)\)\}/,'the heatmap ramp evenly separates adjacent levels');
assert.doesNotMatch(stylesheet,/\.progress i\{[^}]*background:var\(--orange\)/,'the progress fill no longer uses low-contrast orange');
assert.doesNotMatch(stylesheet,/td\.sorted strong\{color:var\(--orange\)\}/,'the sorted leaderboard value no longer uses low-contrast orange');
const nonRootStyles=stylesheet.replace(/:root\{[^}]*\}/g,'');
assert.doesNotMatch(nonRootStyles,/(?:^|[;{])color:var\(--orange\)/,'no non-root text rule paints with low-contrast orange');
assert.match(stylesheet,/:root\{--font:'Inter',system-ui,sans-serif;--head:'Barlow Condensed',Arial Narrow,system-ui,sans-serif;/,'the shared body and display font stacks include fallbacks');
for(const declaration of ['\\.icon-btn\\{[^}]*font:700 25px\\/1 var\\(--font\\)','\\.btn\\{[^}]*font:800 15px var\\(--font\\)','\\.text-btn\\{[^}]*font:800 14px var\\(--font\\)','\\.sync\\{[^}]*font:800 12px var\\(--font\\)','\\.bottom-nav button\\{[^}]*font:800 12px var\\(--font\\)','\\.seg-btn\\{[^}]*font:800 13px var\\(--font\\)','\\.review-section h3,\\.person-head\\{font:800 14px var\\(--font\\)'])assert.match(stylesheet,new RegExp(declaration),'each repaired control shorthand keeps its intended body stack');
assert.doesNotMatch(stylesheet,/font:[^;}]*\s+inherit(?=[;}])/,'no multi-component font shorthand ends in invalid inherit');
const displayUses=stylesheet.replace(/@import[^;]+;/,'').replace(/--head:'Barlow Condensed',Arial Narrow,system-ui,sans-serif/,'');
assert.doesNotMatch(displayUses,/'Barlow Condensed'/,'display font uses share the fallback token');
assert.match(html,/id="youHeatmap"[\s\S]*id="heatmapSummary"/,'the heatmap caption follows the graphic');
const heatmapCard=html.match(/<article id="heatmapCard"[\s\S]*?<\/article>/)?.[0]||'';
const heatmapLegend=heatmapCard.match(/<div id="heatmapLegend"[\s\S]*?<\/div>/)?.[0]||'';
const heatmapWeekdays=heatmapCard.match(/<div class="heatmap-weekdays"[\s\S]*?<\/div>/)?.[0]||'';
assert.match(heatmapCard,/<div class="heatmap-weekdays" aria-hidden="true"><span>M<\/span><span>T<\/span><span>W<\/span><span>T<\/span><span>F<\/span><span>S<\/span><span>S<\/span><\/div><div id="youHeatmap"/,'the weekday axis sits immediately before the heatmap and stays out of its accessible name');
assert.equal((heatmapWeekdays.match(/<span>/g)||[]).length,7,'the weekday axis has exactly seven cells');
assert.match(stylesheet,/\.heatmap-weekdays\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\);gap:5px;max-width:400px;/,'the weekday axis shares the heatmap grid geometry');
assert.match(heatmapLegend,/role="img"[^>]*aria-label="[^"]+"/,'the heatmap shade key has one text alternative');
assert.match(html,/id="youHeatmap"[\s\S]*id="heatmapLegend"[\s\S]*id="heatmapSummary"/,'the heatmap shade key sits between the graphic and caption');
for(const shade of [0,1,2,3,4])assert.match(heatmapLegend,new RegExp(`class="heat-cell heat${shade}" aria-hidden="true"`),`the heatmap shade key includes heat${shade}`);
assert.match(html,/id="weeklyTrend"[\s\S]*id="trendSummary"/,'the trend caption follows the crew curve');
assert.match(script,/function heatmapCaption\(/,'a pure helper builds the heatmap caption');
assert.match(script,/function trendCaption\(/,'a pure helper builds the trend caption');
assert.match(script,/Challenge day: /,'the diagnostics say which day the app is scoring against');
assert.match(script,/Export downloaded\./,'a finished export says so out loud');
assert.match(script,/<button class="cat-chip/,'each category chip is a real button');
assert.match(script,/function prefillCategory\(/,'tapping a chip starts a recording for that category');
assert.match(script,/function breakdownRow\(/,'one breakdown row shape serves the You panel and the person card');
assert.match(script,/function pyramidRow\(/,'one pyramid row shape serves both');
assert.match(script,/function recordsRow\(/,'one records row shape serves both');
assert.equal((script.match(/class="breakdown-row"/g)||[]).length,1,'the breakdown row markup is written once');
assert.equal((script.match(/class="pyramid-row"/g)||[]).length,1,'the pyramid row markup is written once');
// records-row is also the Week in Review leader list's class, and that renderer is another entry's
// surface, so the count here is the two owners of the shape: recordsRow() and renderWeekReview().
assert.equal((script.match(/class="records-row"/g)||[]).length,2,'the You panel and the person card share one records row');
assert.match(html,/id="feedFilter"[^>]*role="group"[^>]*aria-label=/,'the You feed category filter is a named group');
assert.match(html,/data-panel="you"[\s\S]*id="youEmptyState"[\s\S]*id="feedFilter"[\s\S]*id="personalActivity"/,'the filter chips sit between the You empty state and the feed they filter');
assert.match(script,/function filterByType\(/,'a pure helper narrows the feed by category');
assert.match(script,/function setFeedType\(/,'a named handler changes the filter so the delegated chip listener has something to call');
assert.match(script,/feedType=next;resetFeedLimits\(\)/,'changing the filter resets the show-more count');
assert.match(html,/\.feed-filter \.cat-chip\[aria-pressed="true"\]\{/,'the pressed chip is styled in CSS, not by a JS-driven animation');
// Entry 44: the Crew feed carries the same chip row. One container per feed, one module-level
// filter per feed, and the chips themselves come from the one renderer asserted above.
assert.match(html,/id="crewFeedFilter"[^>]*role="group"[^>]*aria-label="[^"]+"/,'the Crew feed category filter is a named group');
assert.match(html,/id="crewFeedFilter"[^>]*class="[^"]*feed-filter/,'the Crew chip row reuses the You feed chip styling rather than a second visual language');
assert.match(html,/id="crewLocalHint"[\s\S]*id="crewFeedFilter"[\s\S]*id="activityList"/,'the Crew filter chips sit between the local-mode hint and the feed they filter');
assert.match(script,/renderFeedChips\('#crewFeedFilter',crewFeedType\)/,'the Crew chip row is painted from the Crew feed\'s own filter');
assert.match(script,/renderFeedChips\('#feedFilter',feedType\)/,'and the You chip row from the You feed\'s own filter');
assert.match(script,/state\.crewFeedType=next;else state\.feedType=next;resetFeedLimits\(\)/,'the two feeds filter independently and either change resets the show-more count');
assert.match(script,/filterByType\(state\.logs,crewFeedType\)/,'the Crew feed reuses filterByType() rather than a second narrowing helper');
assert.equal((script.match(/function filterByType\(/g)||[]).length,1,'filterByType() is defined exactly once');
assert.match(html,/id="personalShowMore"[^>]*type="button"/,'the You feed can show more');
assert.match(html,/id="crewShowMore"[^>]*type="button"/,'the crew feed can show more');
assert.match(script,/function showMoreFeed\(/,'one pager serves both feeds');
// Entry 48: the Crew feed's read-only shape and its per-person name hooks are asserted against the
// RENDERED feeds in tests/client-state.dom.test.js — the innerHTML of #activityList and
// #personalActivity after render(), which proves the markup the app emits rather than the line of
// app.js that emits it. What stays here is the delegated handler, which no element stub can fire.
assert.match(script,/querySelector\('#crew'\)\.addEventListener\('click',event=>\{const button=event\.target\.closest\('\[data-person\]'\)/,'a single delegated handler on the Crew panel covers both the leaderboard and the feed');
assert.equal((script.match(/closest\('\[data-person\]'\)/g)||[]).length,1,'and there is exactly one such handler, not a second one added for the feed');
assert.match(html,/id="undoBar"[^>]*role="status"[^>]*aria-live="polite"/,'the undo bar announces itself politely');
assert.match(html,/id="undoDelete"[^>]*type="button"/,'undo is a real button');
assert.match(html,/id="undoDismiss"[^>]*type="button"/,'dismissing the undo bar is a real button');
assert.match(html,/id="undoBar"[\s\S]*id="toast"/,'the undo bar sits above the toast in document order');
assert.match(script,/function undoDelete\(/,'a named undo handler restores the row');
assert.match(html,/\.undo-bar:not\(\.hide\)~\.toast\{bottom:160px\}/,'the toast lifts out of the undo bar rather than overlapping it');
assert.match(html,/id="bountyWeekToggle"[^>]*type="button"[^>]*aria-expanded="false"/,'the week preview opens from a real button and starts closed');
assert.match(html,/id="bountyWeek"/,'the week preview has a container');
assert.match(html,/id="todayBounties"[\s\S]*id="bountyWeekToggle"[\s\S]*id="bountyWeek"/,'the preview sits under today bounties');
assert.match(script,/function upcomingBounties\(/,'a pure helper computes the coming days');
assert.match(html,/id="claimedToggle"[^>]*type="button"[^>]*aria-expanded="false"/,'the claimed list opens from a real button and starts closed');
assert.match(html,/id="claimedToggle"[^>]*aria-controls="claimedList"/,'the claimed toggle points at the container it controls');
assert.match(html,/id="claimedList"/,'the claimed list has a container');
assert.match(html,/id="claimedList"[\s\S]*id="claimedSummary"[\s\S]*id="youEmptyState"/,'the claimed caption follows the list and precedes the You empty state');
assert.match(html,/id="bountyWeek"[\s\S]*id="claimedToggle"[\s\S]*id="claimedList"[\s\S]*id="youEmptyState"/,'the claimed list sits under the week preview and above the You empty state');
assert.match(html,/id="bountyWeekToggle"[^>]*class="text-btn"/,'the week preview toggle reuses the text-button touch target');
assert.match(html,/id="claimedToggle"[^>]*class="text-btn"/,'the claimed-list toggle reuses the text-button touch target');
assert.match(script,/function claimedBounties\(/,'a pure helper lists the claims');
assert.match(script,/function claimedCaption\(/,'a pure helper builds the claimed-list caption');
assert.match(script,/function claimedRow\(/,'a pure helper owns claimed-bounty row markup');
assert.equal((script.match(/class="bounty-peek"/g)||[]).length,2,'renderBountyWeek and claimedRow are the two owners of bounty-peek markup');
assert.match(script,/function renderClaimed\(/,'a render function owns the claimed list');
assert.match(script,/function shareProgress\(/,'the Share button goes through the system share sheet first');
assert.match(script,/function writeStore\(/,'the shared storage helper exists');
assert.equal((script.match(/localStorage\.setItem/g)||[]).length,1,'storage writes funnel through one helper');
assert.ok((script.match(/state\.pendingDelete=null/g)||[]).length>=2,'a dismissed confirm clears the pending delete on the confirmed and dismissed paths');
assert.match(script,/function computeCreditsRaw\(/,'the raw scorer is separable from the memo that fronts it');
assert.doesNotMatch(script,/\blogs\.(push|splice|unshift|shift|pop|sort|reverse|fill|copyWithin)\(/,'logs is replaced, never mutated in place');
// Retired with Lever 1 (optimistic write): the "Saved to the Sheet, but refresh failed. Do not
// retry" outcome no longer exists. A shared save is confirmed by the write response and the returned
// record is added to the feed at once, with loadRemote() reconciling in the background — so there is
// no blocking reload left to fail on the success path. This asserts that replacement invariant.
assert.match(script,/state\.logs=state\.logs\.concat\(\[\{id:saved\.id/,'a shared save adds the record the write returned straight to the feed');
assert.match(html,/Climbing[\s\S]*Exercise[\s\S]*Mobility/,'the three categories appear in the record picker');
assert.match(html,/Today's bounties/,'the rotating bounty card is present');
assert.match(html,/id="bountyHint"/,'the Record tab has a slot for the chosen bounty description');
assert.match(html,/id="bountySelect"[^>]*aria-describedby="bountyHint"/,'the bounty select is described by its hint as well as labelled');
assert.match(html,/data-panel="you"[\s\S]*id="bountyCapHint"[\s\S]*id="todayBounties"/,'the weekly bounty-cap progress hint sits in the bounty card head on the You panel');
assert.match(html,/data-panel="you"[\s\S]*today-card[\s\S]*id="bountyCapHint"[\s\S]*id="todayBounties"[\s\S]*class="stat-grid"/,'the bounty card sits directly under the today card, above the stat grid, on the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="todayBounties"[\s\S]*id="personalActivity"[\s\S]*class="stat-grid"/,'the recent activity feed sits above the analytics stat grid on the You panel');
assert.match(script,/function claimBounty\(/,'a claim handler exists so bounty rows are actionable');
assert.match(script,/function claimedTodayIds\(/,'a pure helper identifies bounties claimed today');
const populateBountySelectSource=script.split('\n').find(line=>line.startsWith('function populateBountySelect('))||'';
assert.ok(populateBountySelectSource,'the Record bounty picker has its own named population helper');
assert.doesNotMatch(populateBountySelectSource,/title=/,'claimed bounty markers use option text, not a title tooltip');
assert.doesNotMatch(html,/id="bountyHunter"|id="crewTitles"|class="card hunter-card"/,'the retired Titles card has no remaining slot in the template');
assert.doesNotMatch(html,/\.title-grid\{|\.title-tile\{/,'the retired title tile styles are gone');
assert.match(script,/function categoryDays\(/,'credited category-day counting is a pure helper');
assert.match(script,/function crewTitles\(/,'the title rows are derived by a pure helper');
const titlesConstant=script.match(/const TITLE_CATEGORIES=\[.*?\];/)?.[0]||'';
assert.ok(titlesConstant,'the title catalogue is a single-line constant, so the negative assertion below has something to read');
assert.doesNotMatch(titlesConstant,/🧗|💪|🧘|glyph/,'category titles carry no glyph and do not reuse the activity icons');
assert.match(titlesConstant,/id:'crusher'/,'the climbing title is named Crusher');
assert.doesNotMatch(html,/id="leaderChampions"/,'the redundant champions panel is gone from the template');
assert.doesNotMatch(html,/\.champions\{|\.champ-line\{|\.champ-scope\{/,'the retired champions and title-tile scope labels have no CSS rules');
assert.match(html,/\.title-tag\{/,'the folded-in leaderboard title tag is styled');
assert.match(script,/model\.hunters\.forEach\(name=>titleMap\.set\(name,\(titleMap\.get\(name\)\|\|\[\]\)\.concat\('Bounty Hunter'\)\)\)/,'Bounty Hunter joins the runtime title map without becoming a category');
assert.doesNotMatch(script,/title="Bounty Hunter/,'the hunter no longer relies on a title tooltip');
assert.match(stylesheet,/\.text-btn\{display:inline-flex;align-items:center;min-height:44px\}/,'text buttons meet the minimum touch target from their base class');
assert.match(stylesheet,/\.sync\{display:inline-flex;align-items:center;justify-content:flex-end;min-height:44px\}/,'the sync control meets the minimum touch target from its base class');
assert.match(stylesheet,/\.brand\{min-height:44px\}/,'the brand link meets the minimum touch target from its base class');
assert.match(script,/recent:recentTotals\.get\(lower\)\|\|0/,'totals rows expose rolling points from day totals');
assert.match(html,/id="goalPace"[^>]*role="status"[^>]*aria-live="polite"/,'the goal pace indicator is announced');
assert.match(html,/data-panel="crew"[\s\S]*id="goalPace"[\s\S]*?id="goalProjection"[^>]*role="status"[^>]*aria-live="polite"/,'the goal projection line follows the pace line in the crew panel and is announced');
assert.match(html,/id="youDailyMax"/,'the daily max is rendered from the scoring config');
assert.match(html,/data-panel="you"[\s\S]*id="todayCategories"[^>]*role="list"/,'the per-category chip row is a list inside the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="todayRemaining"[^>]*role="status"[^>]*aria-live="polite"/,'the what-is-left-today line lives in the You panel and is announced');
assert.match(html,/id="youMeter"[^>]*role="img"[^>]*aria-label=/,'the today meter stays a labelled graphic');
assert.match(html,/class="dial-center"[^>]*aria-hidden="true"/,'the ring centre reading is hidden from assistive tech, which gets the host aria-label instead');
// The reduced-motion kill switch is `*{animation:none!important}`, so the ring must already be
// drawn at rest and use its animation only to ink in. A non-zero base offset would leave anyone
// with reduced motion looking at an empty dial.
assert.match(stylesheet,/\.goal-ring path\{[^}]*stroke-dashoffset:0\}/,'the goal ring rests fully drawn so reduced motion keeps a readable dial');
assert.match(stylesheet,/\.goal-ring path\.filled\{animation:ring-ink/,'the goal ring inks in with a CSS animation rather than a JS tween');
// The Crag skin leans on CSS motion and a paper-grain texture. Both have to survive the two
// switches this app cannot negotiate with: the reduced-motion kill switch, and the no-new-network
// -requests rule. A reveal that animates *to* its resting state, and a grain that is a data URI,
// are what make that true.
assert.match(stylesheet,/@keyframes rise\{from\{opacity:0;transform:translateY\(12px\)\}\}/,'the panel reveal animates up from hidden to the element own resting state, so reduced motion shows it settled');
assert.match(stylesheet,/--grain:url\("data:image\/svg\+xml/,'the paper grain is an inline data URI, not a fetched image');
assert.doesNotMatch(stylesheet.replace(/@import[^;]+;/,''),/url\((?:'|")?https?:/,'no style rule outside the font import reaches the network');
assert.match(stylesheet,/\.today-card\{[^}]*color:var\(--hero-ink\)/,'the today hero states its own foreground so the inverted card never inherits page ink');
assert.match(html,/data-panel="you"[\s\S]*id="youMeter"[\s\S]*id="todayCategories"[\s\S]*id="todayRemaining"[\s\S]*data-tab="record"[\s\S]*id="bountyCapHint"/,'the category chips and remaining line sit between the today meter and the Record button, above the bounty card');
assert.match(script,/function todayProgress\(/,'the today-progress helper backs the category chips');
assert.match(html,/data-panel="you"[\s\S]*id="youCountdown"/,'the personal countdown lives in the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="youPace"[^>]*class="[^"]*pace[^"]*"/,'the personal pace line reuses the crew pace classes inside the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="todayCategories"[\s\S]*id="youCountdown"[\s\S]*id="youPace"[\s\S]*data-tab="record"[\s\S]*id="bountyCapHint"/,'the countdown and personal pace sit between the category chips and the Record button, above the bounty card');
assert.match(script,/function challengeProgress\(/,'the challenge-progress helper backs the personal countdown');
assert.match(script,/function personalPaceInfo\(/,'the personal pace helper backs the personal share line');
assert.match(script,/function setGoalRing\([^\n]*segments\.map\(\(s,i\)=>[^\n]*<path class="\$\{s\.cls\}"[^\n]*<title>\$\{esc\(s\.label\)\}/,'the You meter renders identifiable per-category segments');
assert.match(html,/data-panel="you"[\s\S]*id="youBreakdown"[\s\S]*data-panel="record"/,'the per-category breakdown card lives inside the You panel');
assert.match(html,/data-panel="you"[\s\S]*class="stat-grid"[\s\S]*id="youTotal"[\s\S]*id="youRank"[\s\S]*id="youStreak"[\s\S]*id="youBestStreak"[\s\S]*data-panel="record"/,'the current and best streak stat cards join the stat grid on the You panel');
assert.match(html,/<article class="card stat"><span>All-time rank<\/span><strong id="youRank">/,'the You rank stat names its all-time scope');
assert.match(html,/<th>Rank<\/th>/,'the leaderboard keeps its rank column header');
assert.match(html,/data-panel="you"[\s\S]*id="youBreakdown"[\s\S]*id="gradePyramid"[\s\S]*id="recordsCard"/,'the grade pyramid card sits between the category breakdown and the personal records card on the You panel');
assert.match(html,/id="gradePyramid"[^>]*role="img"[^>]*aria-label=/,'the grade pyramid is announced as a graphic');
assert.match(html,/id="gradePyramid" class="pyramid"[^>]*><\/div><p id="pyramidSummary" class="hint"><\/p><\/article>/,'the pyramid caption sits between the graphic and the close of the card');
assert.match(html,/data-panel="you"[\s\S]*id="gradePyramidCard"[\s\S]*id="heatmapCard"[\s\S]*id="youHeatmap"/,'the daily activity heatmap card sits after the grade pyramid on the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="gradePyramidCard"[\s\S]*id="recordsCard"[\s\S]*id="heatmapCard"/,'the personal records card sits between the grade pyramid and the heatmap on the You panel');
assert.match(html,/id="youHeatmap"[^>]*role="img"[^>]*aria-label=/,'the daily activity heatmap is announced as a graphic');
assert.match(html,/data-panel="crew"[\s\S]*class="card group-card"[\s\S]*id="weeklyTrendCard"[\s\S]*class="card table-card"/,'the weekly trend card sits between the group goal card and the Leaderboard card on the crew panel');
assert.match(script,/<svg class="trend-svg"[^>]*role="img"[^>]*aria-label=/,'the daily momentum curve is announced as one graphic');
assert.doesNotMatch(html,/trend-scroll/,'the curve has no horizontal scroll wrapper');
assert.doesNotMatch(html,/\.trend-col\{/,'the removed bar columns are not styled');
// Entry 45: the same chart, restricted to the signed-in climber, on the You panel after the heatmap.
assert.match(html,/data-panel="you"[\s\S]*id="heatmapCard"[\s\S]*id="youTrendCard"/,'the personal weekly trend card sits after the daily activity heatmap on the You panel');
assert.match(html,/id="youTrendCard"[\s\S]*id="youTrend" class="trend"/,'the personal daily curve has its own card container');
assert.match(html,/id="youTrend"[\s\S]*id="youTrendSummary"/,'the personal trend caption follows its chart');
assert.match(script,/function personalWeeklyTrend\(/,'a pure helper restricts the weekly rows to one climber');
assert.match(script,/function momentumCurve\(/,'one helper produces every chart series');
assert.match(script,/function trendSvg\(/,'one helper renders every chart SVG');
assert.doesNotMatch(stylesheet,/\.trend-value\{|\.trend-point\{/,'the stretched SVG text and point styles are retired');
assert.match(stylesheet,/\.bounty-peek\{grid-template-columns:auto minmax\(0,1fr\) auto\}\.bounty-peek>span:nth-child\(2\)\{min-width:0;overflow-wrap:anywhere\}/,'claimed bounty rows can break a long note without pushing out their points');
assert.match(stylesheet,/\.trend-labels\{display:flex;justify-content:space-between;gap:12px;padding:8px 2px 0;font-size:12px;font-weight:800\}\.trend-label\.peak\{color:var\(--ink\)\}\.trend-label\.current\{color:var\(--muted\)\}/,'the curve value labels use HTML text styling');
assert.match(stylesheet,/\.trend-baseline\{stroke:var\(--line-strong\);vector-effect:non-scaling-stroke\}/,'the curve baseline stays crisp and separates from the fill');
assert.equal((stylesheet.match(/\.del\{[^}]*min-width:44px;min-height:44px;border-radius:10px\}/g)||[]).length,1,'the delete control has one 44px rule');
assert.equal((stylesheet.match(/\.progress i\{background:var\(--orange-ink\);transition:width \.4s cubic-bezier\(\.4,0,\.2,1\)\}/g)||[]).length,1,'the progress fill has one surviving colour and transition rule');
assert.equal((stylesheet.match(/\.trend-baseline\{stroke-width:1\}/g)||[]).length,1,'the baseline keeps its one-pixel width once');
assert.equal((stylesheet.match(/\.trend-baseline\{stroke:var\(--line-strong\);vector-effect:non-scaling-stroke\}/g)||[]).length,1,'the baseline keeps its crisp stroke once');
assert.match(stylesheet,/\.breakdown-bar i\.nonzero\{min-width:3px\}\.pyramid-bar i\.nonzero\{min-width:3px\}\.progress i\.nonzero\{min-width:3px\}/,'each nonzero bar fill has a visible minimum width');
// Entry 53: the person card gets the same weekly trend chart, sitting between the personal
// records and the grade pyramid.
assert.match(html,/id="personBreakdown"[\s\S]*id="personClaimed"[\s\S]*id="personClaimedSummary"[\s\S]*id="personRecords"/,'the person card claimed-bounty section sits between the breakdown and records');
assert.match(html,/id="personRecords"[\s\S]*id="personTrend"[\s\S]*id="personPyramid"/,'the person card weekly trend chart falls between personal records and the grade pyramid');
assert.match(html,/id="personTrend" class="trend"/,'the person card has the daily curve container');
assert.match(html,/id="personPyramid"[^>]*role="img"[^>]*aria-label="[^"]+"/,'the person card grade pyramid is announced as a graphic with a non-empty label');
assert.match(script,/function pyramidLabel\(/,'a pure helper owns the pyramid text alternative');
assert.equal((script.match(/Grade pyramid: /g)||[]).length,1,'the pyramid label text has one owner');
// Entry 54: the person card lists that climber's most recent entries as the final section.
assert.match(html,/id="personPyramid"[^>]*><\/div><h3 class="person-head">Recent activity<\/h3><div id="personRecent" class="records"><\/div><\/div><\/div>/,'the person card recent-activity section is the last one in the dialog, right after the grade pyramid');
assert.match(html,/id="leaderWeekBtn"[^>]*type="button"[^>]*aria-pressed=[^>]*>Recent<\/button>/,'the Recent toggle keeps its id and is a real button with aria-pressed');
assert.doesNotMatch(html,/>Weekly</,'the leaderboard template no longer labels its recent scope Weekly');
assert.match(html,/id="leaderOverallBtn"[^>]*type="button"[^>]*aria-pressed=/,'the Overall toggle is a real button with aria-pressed');
assert.match(html,/id="leaderPointsBtn"[^>]*type="button"[^>]*aria-pressed=/,'the Points toggle is a real button with aria-pressed');
assert.match(html,/id="leaderBountyBtn"[^>]*type="button"[^>]*aria-pressed=/,'the Bounties toggle is a real button with aria-pressed');
assert.match(html,/id="leaderMetricToggle"[^>]*aria-label=/,'the points/bounties metric toggle is a labelled group');
assert.match(html,/id="leaderScopeToggle"[^>]*aria-label=/,'the weekly/overall scope toggle is a labelled group');
assert.match(html,/\.leader-toggles\{display:flex;flex-wrap:nowrap/,'the four leaderboard buttons stay on one row');
assert.match(stylesheet,/\.card\.table-card\{padding:18px 0\}/,'the leaderboard card keeps zero horizontal padding on phones');
assert.match(stylesheet,/#leaderTable td:nth-child\(2\)\{white-space:normal;overflow-wrap:anywhere\}/,'the climber column can wrap an unbroken name at its min-content width');
assert.equal(script.indexOf('podiumMedals'),-1,'the leaderboard no longer builds podium medals');
assert.equal(html.indexOf('.medal{'),-1,'podium medals no longer have CSS');
assert.match(html,/data-panel="you"[\s\S]*id="youEmptyState"[\s\S]*id="personalActivity"[\s\S]*data-panel="record"/,'the You onboarding empty state sits in the recent-activity area of the You panel');
assert.match(html,/id="youEmptyState"[\s\S]*data-tab="record"/,'the empty state offers a button that jumps to the Record tab');
assert.match(html,/data-panel="crew"[\s\S]*id="crewLocalHint"/,'the crew local-mode hint lives in the Crew panel');
assert.match(html,/data-panel="you"[\s\S]*id="shareBtn"[^>]*type="button"/,'the You panel offers a real Share button');
assert.match(html,/data-panel="you"[\s\S]*id="shareBtn"[\s\S]*today-card/,'the Share button sits in the You page head, above the today card');
assert.equal((script.match(/navigator\.clipboard\.writeText/g)||[]).length,1,'clipboard writes funnel through one helper');
assert.match(script,/function copyText\(/,'the shared clipboard helper exists');
assert.match(script,/function publicUrl\(/,'shared text is built from the endpoint-free public URL');
assert.match(script,/function shareSummary\(/,'the share summary helper backs the Share button');
assert.equal((html.match(/<table[\s>]/g)||[]).length,1,'all crew share one leaderboard');
assert.match(html,/<meta[^>]+name="theme-color"[^>]+content="#e8dfca"/,'a theme-color meta tints the browser chrome to the brand background');
assert.match(html,/<link[^>]+rel="icon"[^>]+href="data:image\/svg\+xml,/,'an inline SVG data-URI favicon is present');
assert.match(html,/<meta[^>]+name="color-scheme"[^>]+content="[^"]*dark[^"]*"/,'a color-scheme meta opts the page into dark rendering');
assert.match(html,/@media\(prefers-color-scheme:dark\)/,'a dark-mode media query overrides the theme variables');
assert.match(html,/env\(safe-area-inset-bottom\)/,'mobile navigation respects safe areas');
// Entry 82: every narrow surface can shrink and wrap within its card.
assert.match(stylesheet,/\.activity\{grid-template-columns:40px minmax\(0,1fr\) auto auto\}/,'base feed rows allow the note track to shrink');
assert.match(stylesheet,/\.activity>div\{min-width:0;overflow-wrap:anywhere\}/,'feed copy shrinks and wraps an unbroken note without clipping it');
assert.match(stylesheet,/@media\(max-width:430px\)\{\.activity\{grid-template-columns:38px minmax\(0,1fr\) auto auto\}\}/,'phone feed rows retain the shrinkable note track');
assert.match(stylesheet,/\.dialog h2\{min-width:0;overflow-wrap:anywhere\}/,'dialog headings can shrink and break long names');
assert.match(stylesheet,/\.setup-copy pre\{overflow-wrap:anywhere\}/,'setup code breaks an unspaced run without losing its scroll container');
// Entry 83: polite status regions keep their semantics but only receive changed text. The
// companion claim — that the person-card trend wrapper does not duplicate the chart SVG's
// accessible name — is asserted on the rendered #personTrend element in
// tests/client-state.dom.test.js, which reads the attribute itself rather than the line of app.js
// that would have written it.
assert.match(html,/class="preview"[^>]+role="status"[^>]+aria-live="polite"/,'record preview remains a polite live region');
assert.match(html,/id="syncDiagnostics"[^>]+role="status"[^>]+aria-live="polite"/,'sync diagnostics remain a polite live region');
// Entry 84: updating numeric figures does not shift their width, and the stat grid owns its row gap.
assert.match(stylesheet,/\.stat strong,\.pts,#leaderTable td:nth-child\(3\),#leaderTable td:nth-child\(4\)\{font-variant-numeric:tabular-nums\}/,'stat, feed and leaderboard values use tabular figures');
assert.match(stylesheet,/\.stat-grid \.card\{margin-bottom:0\}/,'stat-grid cards do not add a second vertical gap');
assert.match(html,/id="groupPercent" class="group-percent"/,'the crew percentage has a headline class');
assert.match(stylesheet,/\.group-percent\{color:var\(--green\);font:800 31px var\(--head\);font-variant-numeric:tabular-nums\}/,'the crew percentage is a tabular headline figure');
// The Crag numeral grammar: a figure you have already banked is sage, a figure still on offer is
// clay, and both are set in the condensed display face. The two halves are asserted together
// because the whole point is the contrast — recolouring one without the other erases the signal.
assert.match(stylesheet,/\.pts,#leaderTable td:nth-child\(3\),#leaderTable td:nth-child\(4\)\{color:var\(--green\);font:800 19px var\(--head\)\}/,'earned figures are sage and condensed');
assert.match(stylesheet,/button\.bounty \.pts,\.bounty-pts,\.activity-picker small\{color:var\(--orange-ink\)/,'figures still on offer stay clay, even where they reuse the feed point class');
// The timeline rail runs behind the avatars, so each avatar needs a ring in its own card colour to
// punch a hole in the line. A ring in any other colour would read as a second border.
assert.match(stylesheet,/\.activity-list:before\{content:"";position:absolute/,'the field log draws one rail down its gutter');
assert.match(stylesheet,/\.avatar\{position:relative;box-shadow:0 0 0 3px var\(--card\)\}/,'each avatar rings itself in the card colour so the rail passes behind it');
// Three one-shot reveals were added with the Crag skin. Reduced motion removes animations outright
// rather than shortening them, so each has to rest at its finished state: the sheen parks outside
// the card it sweeps, the bars sit at their real width, and the trend line sits closed. Assert the
// resting declaration, not the keyframe — the keyframe is the part the kill switch throws away.
assert.match(stylesheet,/\.today-card:before\{[^}]*transform:translateX\(120%\)/,'the hero sheen rests off-canvas, so a motion-free page never shows it mid-sweep');
assert.match(stylesheet,/@keyframes sheen\{from\{transform:translateX\(-120%\)\}\}/,'the sheen animates up to that resting position rather than away from it');
assert.match(stylesheet,/@keyframes grow\{from\{width:0\}\}/,'bars grow up to the width their own inline style already sets');
assert.match(stylesheet,/\.trend-line\{stroke-dasharray:1;animation:ring-ink/,'the trend line rests fully drawn and reuses the ring stroke keyframe');
// White on the low-light clay measures 4.43:1 — under the 4.5:1 text floor — so the raised Record
// pill is the one control that changes fill in the dark, taking the lighter clay and dark ink.
assert.match(stylesheet,/@media\(prefers-color-scheme:dark\)\{#navRecord\{background:var\(--orange\);color:#211d12\}\}/,'the night Record pill swaps to a fill its label can sit on');
assert.match(stylesheet,/#navRecord\{margin:-13px 12px 7px;[^}]*background:var\(--accent-solid\);color:#fff/,'the day Record pill rides above the bar in clay');
console.log('Road to Send static accessibility and UX checks passed.');
