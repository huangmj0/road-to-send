// Presence, source order and accessibility assertions against the built index.html. This is
// where aria-* coverage belongs — the element stub in tests/harness.js cannot see an attribute
// set from JS, so the client-state suites cannot assert it.
//
// TRAP — ADD assertions here; never relax, retarget or delete one:
//   * Several assertions pin DOM *source order*, so moving an element in
//     src/index.template.html breaks a check that names neither element helpfully.
//   * Several match exact compact CSS text — `.trend-scroll{overflow-x:auto}`,
//     `@media(prefers-color-scheme:dark)` with no space. Reformatting src/styles.css breaks
//     them, again with an unhelpful message.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)?.[1];
const scoring=JSON.parse(readFileSync(new URL('../src/scoring.json',import.meta.url),'utf8'));
assert.ok(script,'index.html contains an inline application script');
assert.doesNotThrow(()=>new Function(script),'application JavaScript parses');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'HTML ids are unique');
for(const id of ['hardestGrade','bountySelect','activityNote','activityDate','identityMember','newParticipantName','proxyMember','endpoint','challengeStart','tripDate','groupGoalInput'])assert.match(html,new RegExp(`<label[^>]+for="${id}"`),`${id} has an associated label`);
for(const tab of ['you','record','crew']){
  assert.match(html,new RegExp(`data-panel="${tab}"`),`${tab} panel exists`);
  assert.match(html,new RegExp(`data-tab="${tab}"`),`${tab} navigation exists`);
}
assert.match(html,/class="bottom-nav"[^>]+aria-label="Primary"/,'bottom navigation is named');
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
assert.match(script,/function requestDelete\(/,'deleting an entry goes through the confirm request helper');
assert.match(html,/aria-label="Close person details"/);
assert.match(script,/function closeIfScrim\(/,'clicking the backdrop closes the dialog it belongs to');
assert.match(script,/data-person="/,'leaderboard rows expose the climber name as a per-person hook');
assert.match(script,/function openPersonCard\(/,'tapping a climber opens the per-person card');
assert.match(script,/<button class="climber" type="button"[^>]*data-person=/,'the climber name is a real button, not a clickable row');
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
const sharedConfig=(script.match(/const GRADES=SCORING\.grades,CATEGORIES=Object\.keys\(SCORING\.categories\)/g)||[]).length;
assert.ok(sharedConfig>=2,'browser and Apps Script both read the shared scoring config');
assert.doesNotMatch(html,/Hard mode|Super hard mode|pull-up mode|Record send pyramid|Balanced week bonus/i,'removed pull-up-mode and legacy features are absent from the UI');
// Saving… was already the label on two buttons (#saveActivityBtn and #saveSetupBtn) before this
// entry, so the preview branch is the third occurrence — a >=2 guard could never have failed.
assert.ok((script.match(/Saving…/g)||[]).length>=3,'the preview reports an in-flight save, on top of the two button labels');
assert.match(html,/id="heatmapSummary"/,'the heatmap carries a visible caption');
assert.match(html,/id="trendSummary"/,'the trend chart carries a visible caption');
assert.match(html,/id="youHeatmap"[\s\S]*id="heatmapSummary"/,'the heatmap caption follows the graphic');
assert.match(html,/class="trend-scroll"[\s\S]*id="trendSummary"/,'the trend caption follows the scroll wrapper');
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
assert.match(script,/<button class="cat-chip" type="button" data-feed-type="[^"]*" aria-pressed=/,'each feed filter chip is a real button carrying aria-pressed');
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
assert.match(script,/crewFeedType=next;else feedType=next;resetFeedLimits\(\)/,'the two feeds filter independently and either change resets the show-more count');
assert.match(script,/filterByType\(logs,crewFeedType\)/,'the Crew feed reuses filterByType() rather than a second narrowing helper');
assert.equal((script.match(/function filterByType\(/g)||[]).length,1,'filterByType() is defined exactly once');
assert.match(html,/id="personalShowMore"[^>]*type="button"/,'the You feed can show more');
assert.match(html,/id="crewShowMore"[^>]*type="button"/,'the crew feed can show more');
assert.match(script,/function showMoreFeed\(/,'one pager serves both feeds');
// The clamp lives in showMoreFeed(), never inline at the call site, so the read-only assertion
// below keeps matching a plain `,false)` argument rather than a nested Math.min(...).
assert.match(script,/#activityList'\)\.innerHTML=activityMarkup\([^)]*,false\)/,'the crew feed is read-only');
// Entry 48: the Crew feed's names open the same per-person card the leaderboard rows open. app.js
// is one top-level function per line, so the feed-row assertions below are scoped to
// activityMarkup's own line — a `data-person=` anywhere else in the script must not satisfy them.
const feedRowSource=script.split('\n').find(line=>line.startsWith('function activityMarkup('))||'';
assert.ok(feedRowSource,'the activity feed markup helper is a top-level function');
assert.match(feedRowSource,/data-person="/,'the crew feed rows expose the climber name as the same per-person hook the leaderboard uses');
assert.match(feedRowSource,/<button class="climber" type="button" data-person=/,'the crew feed name reuses the leaderboard climber button rather than a second control');
assert.match(feedRowSource,/<strong>\$\{nm\}<\/strong>/,'the You feed keeps a plain name, so only the crew feed becomes tappable');
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
assert.match(html,/#bountyWeekToggle,#claimedToggle\{min-height:44px\}/,'the claimed toggle reuses the 44px touch target');
assert.match(script,/function claimedBounties\(/,'a pure helper lists the claims');
assert.match(script,/function claimedCaption\(/,'a pure helper builds the claimed-list caption');
assert.match(script,/function claimedRow\(/,'a pure helper owns claimed-bounty row markup');
assert.equal((script.match(/class="bounty-peek"/g)||[]).length,2,'renderBountyWeek and claimedRow are the two owners of bounty-peek markup');
assert.match(script,/function renderClaimed\(/,'a render function owns the claimed list');
assert.match(script,/function shareProgress\(/,'the Share button goes through the system share sheet first');
assert.match(script,/function writeStore\(/,'the shared storage helper exists');
assert.equal((script.match(/localStorage\.setItem/g)||[]).length,1,'storage writes funnel through one helper');
assert.ok((script.match(/pendingDelete=null/g)||[]).length>=3,'a dismissed confirm clears the pending delete, on top of the declaration and the confirmed path');
assert.match(script,/function computeCreditsRaw\(/,'the raw scorer is separable from the memo that fronts it');
assert.doesNotMatch(script,/\blogs\.(push|splice|unshift|shift|pop|sort|reverse|fill|copyWithin)\(/,'logs is replaced, never mutated in place');
assert.match(script,/Saved to the Sheet, but refresh failed\. Do not retry/,'confirmed saves are distinguished from refresh failures');
assert.match(html,/Climbing[\s\S]*Exercise[\s\S]*Mobility/,'the three categories appear in the record picker');
assert.match(html,/Today's bounties/,'the rotating bounty card is present');
assert.match(html,/id="bountyHint"/,'the Record tab has a slot for the chosen bounty description');
assert.match(html,/id="bountySelect"[^>]*aria-describedby="bountyHint"/,'the bounty select is described by its hint as well as labelled');
assert.match(html,/data-panel="you"[\s\S]*id="bountyCapHint"[\s\S]*id="todayBounties"/,'the weekly bounty-cap progress hint sits in the bounty card head on the You panel');
assert.match(html,/data-panel="you"[\s\S]*today-card[\s\S]*id="bountyCapHint"[\s\S]*id="todayBounties"[\s\S]*class="stat-grid"/,'the bounty card sits directly under the today card, above the stat grid, on the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="todayBounties"[\s\S]*id="personalActivity"[\s\S]*class="stat-grid"/,'the recent activity feed sits above the analytics stat grid on the You panel');
assert.match(script,/function claimBounty\(/,'a claim handler exists so bounty rows are actionable');
assert.match(script,/<button class="bounty" type="button"[^>]*data-claim-bounty=[^>]*aria-label="Claim /,'bounty rows render as labelled one-tap claim buttons');
assert.match(script,/function claimedTodayIds\(/,'a pure helper identifies bounties claimed today');
assert.match(html,/id="bountyHunter"/,'the Bounty Hunter slot is present');
assert.match(html,/id="goalPace"[^>]*role="status"[^>]*aria-live="polite"/,'the goal pace indicator is announced');
assert.match(html,/data-panel="crew"[\s\S]*id="goalPace"[\s\S]*?id="goalProjection"[^>]*role="status"[^>]*aria-live="polite"/,'the goal projection line follows the pace line in the crew panel and is announced');
assert.match(html,/id="youDailyMax"/,'the daily max is rendered from the scoring config');
assert.match(html,/data-panel="you"[\s\S]*id="todayCategories"[^>]*role="list"/,'the per-category chip row is a list inside the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="todayRemaining"[^>]*role="status"[^>]*aria-live="polite"/,'the what-is-left-today line lives in the You panel and is announced');
assert.match(html,/id="youMeter"[^>]*role="img"[^>]*aria-label=/,'the today meter stays a labelled graphic');
assert.match(html,/data-panel="you"[\s\S]*id="youMeter"[\s\S]*id="todayCategories"[\s\S]*id="todayRemaining"[\s\S]*data-tab="record"[\s\S]*id="bountyCapHint"/,'the category chips and remaining line sit between the today meter and the Record button, above the bounty card');
assert.match(script,/function todayProgress\(/,'the today-progress helper backs the category chips');
assert.match(html,/data-panel="you"[\s\S]*id="youCountdown"/,'the personal countdown lives in the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="youPace"[^>]*class="[^"]*pace[^"]*"/,'the personal pace line reuses the crew pace classes inside the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="todayCategories"[\s\S]*id="youCountdown"[\s\S]*id="youPace"[\s\S]*data-tab="record"[\s\S]*id="bountyCapHint"/,'the countdown and personal pace sit between the category chips and the Record button, above the bounty card');
assert.match(script,/function challengeProgress\(/,'the challenge-progress helper backs the personal countdown');
assert.match(script,/function personalPaceInfo\(/,'the personal pace helper backs the personal share line');
assert.match(script,/function setSegmentedMeter\(/,'the You meter renders identifiable per-category segments');
assert.match(html,/data-panel="you"[\s\S]*id="youBreakdown"[\s\S]*data-panel="record"/,'the per-category breakdown card lives inside the You panel');
assert.match(html,/data-panel="you"[\s\S]*class="stat-grid"[\s\S]*id="youTotal"[\s\S]*id="youRank"[\s\S]*id="youStreak"[\s\S]*id="youBestStreak"[\s\S]*data-panel="record"/,'the current and best streak stat cards join the stat grid on the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="youBreakdown"[\s\S]*id="gradePyramid"[\s\S]*id="recordsCard"/,'the grade pyramid card sits between the category breakdown and the personal records card on the You panel');
assert.match(html,/id="gradePyramid"[^>]*role="img"[^>]*aria-label=/,'the grade pyramid is announced as a graphic');
assert.match(html,/id="gradePyramid" class="pyramid"[^>]*><\/div><p id="pyramidSummary" class="hint"><\/p><\/article>/,'the pyramid caption sits between the graphic and the close of the card');
assert.match(html,/data-panel="you"[\s\S]*id="gradePyramidCard"[\s\S]*id="heatmapCard"[\s\S]*id="youHeatmap"/,'the daily activity heatmap card sits after the grade pyramid on the You panel');
assert.match(html,/data-panel="you"[\s\S]*id="gradePyramidCard"[\s\S]*id="recordsCard"[\s\S]*id="heatmapCard"/,'the personal records card sits between the grade pyramid and the heatmap on the You panel');
assert.match(html,/id="youHeatmap"[^>]*role="img"[^>]*aria-label=/,'the daily activity heatmap is announced as a graphic');
assert.match(html,/data-panel="crew"[\s\S]*class="card group-card"[\s\S]*id="weeklyTrendCard"[\s\S]*class="card hunter-card"/,'the weekly trend card sits between the group goal card and the Bounty Hunter card on the crew panel');
assert.match(html,/id="weeklyTrend"[^>]*role="img"[^>]*aria-label=/,'the weekly trend chart is announced as a graphic');
assert.match(html,/class="trend-scroll"[^>]*>\s*<div id="weeklyTrend"/,'the weekly trend chart sits inside a horizontally scrollable wrapper');
assert.match(html,/\.trend-scroll\{overflow-x:auto\}/,'the trend wrapper scrolls horizontally instead of squeezing');
// Entry 45: the same chart, restricted to the signed-in climber, on the You panel after the heatmap.
assert.match(html,/data-panel="you"[\s\S]*id="heatmapCard"[\s\S]*id="youTrendCard"/,'the personal weekly trend card sits after the daily activity heatmap on the You panel');
assert.match(html,/id="youTrend"[^>]*role="img"[^>]*aria-label="[^"]+"/,'the personal weekly trend chart is announced as a graphic with a non-empty label');
assert.match(html,/id="youTrendCard"[\s\S]*class="trend-scroll"[^>]*>\s*<div id="youTrend"/,'the personal trend chart reuses the horizontally scrollable trend wrapper');
assert.match(html,/id="youTrend"[\s\S]*id="youTrendSummary"/,'the personal trend caption follows its chart');
assert.match(script,/function personalWeeklyTrend\(/,'a pure helper restricts the weekly rows to one climber');
assert.match(script,/function trendColumns\(/,'both trend charts draw their bars from one markup helper');
// Entry 53: the person card gets the same weekly trend chart, sitting between the personal
// records and the grade pyramid.
assert.match(html,/id="personBreakdown"[\s\S]*id="personClaimed"[\s\S]*id="personClaimedSummary"[\s\S]*id="personRecords"/,'the person card claimed-bounty section sits between the breakdown and records');
assert.match(html,/id="personRecords"[\s\S]*id="personTrend"[\s\S]*id="personPyramid"/,'the person card weekly trend chart falls between personal records and the grade pyramid');
assert.match(html,/id="personTrend"[^>]*role="img"[^>]*aria-label="[^"]+"/,'the person card weekly trend chart is announced as a graphic with a non-empty label');
assert.match(html,/class="trend-scroll"[^>]*>\s*<div id="personTrend"/,'the person card trend chart sits inside the scrollable trend wrapper');
assert.match(html,/id="personPyramid"[^>]*role="img"[^>]*aria-label="[^"]+"/,'the person card grade pyramid is announced as a graphic with a non-empty label');
assert.match(script,/function pyramidLabel\(/,'a pure helper owns the pyramid text alternative');
assert.equal((script.match(/Grade pyramid: /g)||[]).length,1,'the pyramid label text has one owner');
// Entry 54: the person card lists that climber's most recent entries as the final section.
assert.match(html,/id="personPyramid"[^>]*><\/div><h3 class="person-head">Recent activity<\/h3><div id="personRecent" class="records"><\/div><\/div><\/div>/,'the person card recent-activity section is the last one in the dialog, right after the grade pyramid');
const personCardSource=script.split('\n').find(line=>line.startsWith('function renderPersonCard('))||'';
assert.equal(personCardSource.indexOf('activityMarkup('),-1,'renderPersonCard renders recent activity without reusing the dead-button activityMarkup() helper');
assert.match(html,/id="leaderWeekBtn"[^>]*type="button"[^>]*aria-pressed=/,'the Weekly toggle is a real button with aria-pressed');
assert.match(html,/id="leaderOverallBtn"[^>]*type="button"[^>]*aria-pressed=/,'the Overall toggle is a real button with aria-pressed');
assert.match(html,/id="leaderPointsBtn"[^>]*type="button"[^>]*aria-pressed=/,'the Points toggle is a real button with aria-pressed');
assert.match(html,/id="leaderBountyBtn"[^>]*type="button"[^>]*aria-pressed=/,'the Bounties toggle is a real button with aria-pressed');
assert.match(html,/id="leaderMetricToggle"[^>]*aria-label=/,'the points/bounties metric toggle is a labelled group');
assert.match(html,/id="leaderScopeToggle"[^>]*aria-label=/,'the weekly/overall scope toggle is a labelled group');
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
assert.match(html,/<meta[^>]+name="theme-color"[^>]+content="#f5eee3"/,'a theme-color meta tints the browser chrome to the brand background');
assert.match(html,/<link[^>]+rel="icon"[^>]+href="data:image\/svg\+xml,/,'an inline SVG data-URI favicon is present');
assert.match(html,/<meta[^>]+name="color-scheme"[^>]+content="[^"]*dark[^"]*"/,'a color-scheme meta opts the page into dark rendering');
assert.match(html,/@media\(prefers-color-scheme:dark\)/,'a dark-mode media query overrides the theme variables');
assert.match(html,/env\(safe-area-inset-bottom\)/,'mobile navigation respects safe areas');
console.log('Road to Send static accessibility and UX checks passed.');
