// DOM-backed harness: a minimal document stub so init()/render() run and rendered output can be
// asserted. Presence-and-order assertions about the markup itself belong in
// tests/static-check.mjs, not here.
//
// TRAP — two of them:
//   * The assertions below live inside a backtick template literal evaluated in a vm context.
//     Added code may contain no backtick and no `${`. Build strings with `+`.
//   * The element stub in harness.js cannot observe attributes set from JS and cannot fire a
//     delegated handler. Read the trap note at the top of tests/harness.js before adding
//     assertions here.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {test} = require('node:test');
const {source, makeElement} = require('./harness.js');

const domElements = new Map();
const documentListeners = new Map();
const domValues = new Map();
const documentStub = {
  visibilityState: 'visible',
  activeElement: null,
  querySelector: selector => {if (!domElements.has(selector)) domElements.set(selector, makeElement()); return domElements.get(selector)},
  querySelectorAll: () => [],
  addEventListener: (type, handler) => documentListeners.set(type, handler),
  removeEventListener: () => {},
  createElement: () => makeElement(),
};
const domContext = {
  assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Intl,
  location: {search: '', href: 'https://example.test/', hash: ''},
  history: {replaceState() {}},
  window: {scrollTo() {}},
  document: documentStub,
  fireDocumentEvent: type => {const handler = documentListeners.get(type); if (handler) handler({})},
  localStorage: {
    getItem: key => domValues.has(key) ? domValues.get(key) : null,
    setItem: (key, value) => domValues.set(key, String(value)),
    removeItem: key => domValues.delete(key),
  },
  setTimeout() {}, clearTimeout() {},
};

const domChecks = `(()=>{
  const todayStart=parseDateOnly(challengeToday());
  const shift=n=>{const d=new Date(todayStart);d.setDate(d.getDate()+n);return localDate(d)};
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  const dateField=document.querySelector('#activityDate'),dateBox=document.querySelector('#dateFields'),label=document.querySelector('#bountySelectLabel');

  // Closed picker: render() re-syncs the record date to the current challenge day,
  // so the Record dropdown and the You card draw the same bounty set after a rollover.
  dateBox.classList.add('hide');
  dateField.value=shift(-1);
  render();
  assert.equal(recordDate(),challengeToday(),'closed picker snaps the record date back to today');
  const paceEl=document.querySelector('#goalPace');
  assert.equal(paceEl.classList.contains('hide'),false,'pace indicator shows inside the challenge window');
  assert.ok(paceEl.textContent.startsWith('Behind pace'),'zero points partway through the window reads behind');
  const projEl=document.querySelector('#goalProjection');
  assert.equal(projEl.classList.contains('hide'),false,'projection shows once three days have elapsed');
  assert.ok(projEl.textContent.startsWith('On pace for'),'projection extends the current rate to the window end');
  assert.equal(dailyBounties(recordDate()).map(b=>b.id).join(','),dailyBounties(challengeToday()).map(b=>b.id).join(','),'Record dropdown and You card agree on the bounty set');
  populateBountySelect();
  assert.equal(label.textContent,"Today's bounties",'label reads as today when the bounty day is today');

  // Open picker: render() must not fight a manually chosen date, and the label is honest.
  dateBox.classList.remove('hide');
  dateField.value=shift(-1);
  render();
  assert.equal(recordDate(),shift(-1),'open picker keeps the manual date');
  populateBountySelect();
  assert.equal(label.textContent,'Bounties for Yesterday','label names the non-today bounty day');

  // Day rollover: becoming visible re-renders when the rendered day is stale.
  dateBox.classList.add('hide');
  assert.equal(renderedDay,challengeToday(),'render records the day it drew');
  renderedDay='2000-01-01';
  dateField.value=shift(-1);
  fireDocumentEvent('visibilitychange');
  assert.equal(renderedDay,challengeToday(),'visibilitychange re-renders after a day rollover');
  assert.equal(recordDate(),challengeToday(),'the record date follows the rollover');

  // Outside the challenge window the record date clamps and the label says so.
  config={startDate:shift(-20),tripDate:shift(-10),goal:500,crew:[{name:'Alex'}]};
  render();
  assert.equal(recordDate(),shift(-10),'record date clamps to the window end');
  assert.ok(paceEl.textContent.startsWith('Challenge complete'),'a finished window reports the outcome');
  assert.equal(projEl.classList.contains('hide'),true,'a finished window hides the projection');
  populateBountySelect();
  assert.equal(label.textContent,'Bounties for '+fmtDay(shift(-10)),'label names the clamped bounty day');

  // Entry 9: the You onboarding empty state shows only when the person has no logs, and the Crew local hint tracks the endpoint.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  render();
  const youEmpty=document.querySelector('#youEmptyState'),youEmptyCopy=document.querySelector('#youEmptyCopy'),personalFeed=document.querySelector('#personalActivity');
  assert.equal(youEmpty.classList.contains('hide'),false,'the empty state is visible when the person has no logs');
  assert.ok(youEmptyCopy.textContent.includes('+'+SCORING.categories.climb)&&youEmptyCopy.textContent.includes('+'+SCORING.balancedDayBonus),'the empty-state copy derives its numbers from SCORING, not hard-coded literals');
  assert.equal(personalFeed.classList.contains('hide'),true,'the personal feed is hidden while the empty state shows');
  const crewHint=document.querySelector('#crewLocalHint');
  assert.equal(crewHint.classList.contains('hide'),false,'the crew local hint shows in local mode');
  logs=[{id:'first',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'}];
  render();
  assert.equal(youEmpty.classList.contains('hide'),true,'the empty state hides once the person has a log');
  assert.equal(personalFeed.classList.contains('hide'),false,'the personal feed shows once the person has a log');
  endpoint='https://sheet.example.test/exec';
  render();
  assert.equal(crewHint.classList.contains('hide'),true,'the crew local hint hides when an endpoint is connected');

  // Entry 25: one render() runs the raw scorer a FIXED number of times. Before the memo it was
  // about one scan per helper plus one per leaderboard row; now every computeCredits(logs) call
  // inside a render collapses onto a single scan. The remainder is the callers that deliberately
  // pass a DERIVED array and so bypass the memo by design: earnedThrough() passes a date-filtered
  // copy and updateRecordPreview() passes [...logs,draft]. If this delta moves, a new derived-array
  // caller appeared inside render() — find it rather than editing the number.
  endpoint='';me='Alex';recordingFor='Alex';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'r1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'}];
  render();
  const runsBefore=creditRuns;
  render();
  assert.equal(creditRuns-runsBefore,2,'one render scores the live log exactly twice');
  const liveMemo=computeCredits(logs);
  assert.equal(creditRuns-runsBefore,2,'reading the live pair again after a render costs no scan at all');
  // The point of the memo is that this number is now a constant. Before it, weekTrend() ran inside
  // leaders.map(), so the count grew with the crew; here a six-person crew costs exactly what a
  // one-person crew costs.
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'},{name:'Cass'},{name:'Dee'},{name:'Eli'},{name:'Fay'}]};
  logs=[{id:'r1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'r2',name:'Bo',type:'exercise',date:shift(-1),createdAt:'2'},{id:'r3',name:'Cass',type:'mobility',date:shift(-2),createdAt:'3'}];
  render();
  const runsCrewBefore=creditRuns;
  render();
  assert.equal(creditRuns-runsCrewBefore,2,'a six-person crew costs the same two scans as a one-person crew');
  // updateRecordPreview() is the one render-path caller that passes a DERIVED array ([...logs,draft]),
  // so it always pays its own scan and must never disturb the live memo.
  const runsAfterRender=creditRuns;
  updateRecordPreview();
  assert.equal(creditRuns-runsAfterRender,1,'the preview array is scored on its own terms, never from the memo');
  assert.equal(computeCredits(logs),computeCredits(logs),'the live pair still answers from one memoized object');
  assert.notEqual(computeCredits(logs),liveMemo,'and that object is the current one, not the pre-crew answer');

  // Entry 10: the Personal records card hides until the person logs something, and its grade rows track graded climbs.
  endpoint='';me='Alex';recordingFor='Alex';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  render();
  const recordsCard=document.querySelector('#recordsCard'),recordsList=document.querySelector('#recordsList');
  assert.equal(recordsCard.classList.contains('hide'),true,'the records card hides when the person has no logs');
  logs=[{id:'r1',name:'Alex',type:'climb',hardestGrade:'V4',date:shift(-1),createdAt:'1'}];
  render();
  assert.equal(recordsCard.classList.contains('hide'),false,'the records card shows once the person has a log');
  assert.ok(recordsList.innerHTML.includes('Hardest')&&recordsList.innerHTML.includes('V4'),'a graded climb surfaces the hardest-grade rows');
  logs=[{id:'r2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'1'}];
  render();
  assert.equal(recordsCard.classList.contains('hide'),false,'a non-climb log still reveals the card');
  assert.equal(recordsList.innerHTML.includes('Hardest'),false,'grade rows are suppressed without a graded climb');
  assert.ok(recordsList.innerHTML.includes('Best single day'),'best day/week still render without graded climbs');

  // Entry 11: tapping a bounty on the You card preselects it on the Record form for a one-tap claim.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  render();
  const claimId=dailyBounties(challengeToday())[0].id;
  const todayBounties=document.querySelector('#todayBounties');
  assert.equal(todayBounties.innerHTML.includes('claimed today'),false,'unclaimed bounty rows have no claimed-today suffix');
  logs=[{id:'claimed',name:'Alex',type:'bounty',bountyId:claimId,date:challengeToday(),createdAt:'1'}];
  render();
  assert.ok(todayBounties.innerHTML.includes('data-claim-bounty="'+claimId+'"')&&todayBounties.innerHTML.includes('claimed today'),'the claimed row carries its claim state');
  assert.equal((todayBounties.innerHTML.match(/claimed today/g)||[]).length,2,'only the claimed row names the state in its text and label');
  assert.ok(todayBounties.innerHTML.includes('data-claim-bounty')&&todayBounties.innerHTML.includes('aria-label="Claim '),'claimed rows remain labelled claim buttons');
  const bountyRadio=document.querySelector('input[name="activityType"][value="bounty"]');
  const claimSelect=document.querySelector('#bountySelect'),claimDateBox=document.querySelector('#dateFields');
  bountyRadio.checked=false;claimSelect.value='';claimDateBox.classList.remove('hide');
  claimBounty(claimId);
  assert.equal(bountyRadio.checked,true,'claiming a bounty selects the Bounty activity type');
  assert.equal(claimSelect.value,claimId,'claiming a bounty preselects it in the Record dropdown');
  assert.equal(claimDateBox.classList.contains('hide'),true,'claiming a bounty snaps to today and closes the date picker');

  // Entry 41: the preview is closed by default and renders nothing until it is opened.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(20),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  render();
  const weekBox=document.querySelector('#bountyWeek'),weekToggle=document.querySelector('#bountyWeekToggle');
  // setAttribute is a no-op in this stub, so the open state is asserted where it actually lives.
  assert.equal(bountyWeekOpen,false,'the preview starts closed');
  assert.equal(weekBox.innerHTML,'','and renders nothing at all until it is opened');
  assert.equal(weekBox.classList.contains('hide'),true,'the container stays hidden');
  toggleBountyWeek();
  assert.equal(bountyWeekOpen,true,'tapping the toggle opens it');
  assert.equal(weekBox.classList.contains('hide'),false,'and reveals the container');
  assert.ok(weekBox.innerHTML.indexOf('bounty-day')>=0,'which now lists the coming days');
  assert.equal(weekBox.innerHTML.indexOf('data-claim-bounty'),-1,'future days are plain rows, never claim buttons');
  render();
  assert.ok(weekBox.innerHTML.indexOf('bounty-day')>=0,'a repaint keeps an open preview open');
  toggleBountyWeek();
  assert.equal(bountyWeekOpen,false,'tapping again closes it');
  assert.equal(weekBox.innerHTML,'','and it renders nothing again');

  // Entry 46: the claimed list follows the same closed-by-default contract, and lists only claims.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(20),goal:500,crew:[{name:'Alex'},{name:'Maya'}]};
  const claimedId=dailyBounties(challengeToday())[0].id,claimedTitle=bountyById(claimedId).title;
  logs=[
    {id:'k1',name:'Alex',type:'bounty',bountyId:claimedId,bountyTitle:claimedTitle,note:'felt good',date:shift(-1),createdAt:'1'},
    {id:'k2',name:'Alex',type:'climb',hardestGrade:'V4',date:shift(-1),createdAt:'2'},
    {id:'k3',name:'Maya',type:'bounty',bountyId:claimedId,bountyTitle:'Maya only',date:shift(-1),createdAt:'3'},
  ];
  render();
  const claimedBox=document.querySelector('#claimedList'),claimedCap=document.querySelector('#claimedSummary');
  // setAttribute is a no-op in this stub, so the open state is asserted where it actually lives.
  assert.equal(claimedOpen,false,'the claimed list starts closed');
  assert.equal(claimedBox.innerHTML,'','and renders nothing at all until it is opened');
  assert.equal(claimedCap.textContent,'','and its caption is empty while closed');
  assert.equal(claimedBox.classList.contains('hide'),true,'the container stays hidden');
  toggleClaimed();
  assert.equal(claimedOpen,true,'tapping the toggle opens it');
  assert.equal(claimedBox.classList.contains('hide'),false,'and reveals the container');
  assert.ok(claimedBox.innerHTML.indexOf(claimedTitle)>=0,'which now names the bounty that was claimed');
  assert.ok(claimedBox.innerHTML.indexOf('felt good')>=0,'and the note written on the claim');
  assert.ok(claimedBox.innerHTML.indexOf('bounty-peek')>=0,'reusing the existing bounty row markup');
  assert.equal(claimedBox.innerHTML.indexOf('Maya only'),-1,'another person’s claims never appear here');
  assert.equal(claimedBox.innerHTML.indexOf('data-claim-bounty'),-1,'claimed rows are plain rows, never claim buttons');
  assert.equal(claimedBox.innerHTML.indexOf('data-del'),-1,'and carry no delete affordance');
  assert.ok(claimedCap.textContent.indexOf('1 claim')>=0,'the open caption names the claim count');
  render();
  assert.ok(claimedBox.innerHTML.indexOf(claimedTitle)>=0,'a repaint keeps an open list open');
  assert.equal(claimedBox.innerHTML.split('bounty-peek').length-1,1,'and redraws one row rather than appending a second');
  assert.ok(claimedCap.textContent.indexOf('1 claim')>=0,'and keeps the caption on repaint');
  toggleClaimed();
  assert.equal(claimedOpen,false,'tapping again closes it');
  assert.equal(claimedBox.innerHTML,'','and it empties again');
  assert.equal(claimedCap.textContent,'','and clears the caption again');
  // Someone with nothing claimed opens to a plain empty state, not a zero-of-total figure.
  logs=[{id:'k4',name:'Alex',type:'climb',hardestGrade:'V4',date:shift(-1),createdAt:'1'}];
  toggleClaimed();
  assert.equal(claimedOpen,true,'it still opens for a climber with no claims');
  assert.equal(claimedBox.innerHTML.indexOf('bounty-peek'),-1,'listing no rows');
  toggleClaimed();
  assert.equal(claimedBox.innerHTML,'','and closes back to nothing');

  // Entry 50: the claimed list also shows what each claim scored, calling out a capped one.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
  logs=[
    {id:'s1',name:'Alex',type:'bounty',bountyId:'send-it',bountyTitle:'Send It',date:'2026-07-13',createdAt:'1'},
    {id:'s2',name:'Alex',type:'bounty',bountyId:'outdoor-send',bountyTitle:'Outdoor Send',date:'2026-07-14',createdAt:'1'},
    {id:'s3',name:'Alex',type:'bounty',bountyId:'century-club',bountyTitle:'Century Club',date:'2026-07-15',createdAt:'1'},
  ];
  toggleClaimed();
  assert.equal(claimedOpen,true,'opens for the scored-claims case');
  assert.ok(claimedBox.innerHTML.indexOf('bounty-pts">+3</span>')>=0,'the first two, uncapped claims show their full credit');
  assert.ok(claimedBox.innerHTML.indexOf('bounty-pts">+0</span>')>=0,'the claim past the weekly cap shows its reduced credit');
  assert.ok(claimedBox.innerHTML.indexOf('weekly bounty cap')>=0,'and names the weekly bounty cap as the reason');
  assert.equal(claimedBox.innerHTML.split('weekly bounty cap').length-1,1,'only the capped row carries the cap wording');
  toggleClaimed();
  assert.equal(claimedOpen,false,'closes again');

  // Entry 34: a note written on a bounty claim round-trips to the Sheet and back, and until now was
  // rendered to nobody — the bounty branch showed the title and stopped.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  const notedId=dailyBounties(challengeToday())[0].id,notedTitle=bountyById(notedId).title;
  logs=[{id:'n1',name:'Alex',type:'bounty',bountyId:notedId,bountyTitle:notedTitle,note:'felt strong today',date:shift(-1),createdAt:'1'}];
  render();
  const notedFeed=document.querySelector('#personalActivity');
  assert.ok(notedFeed.innerHTML.indexOf(notedTitle)>=0,'the bounty still names itself');
  assert.ok(notedFeed.innerHTML.indexOf('felt strong today')>=0,'and now shows the note that was written on it');
  // The row already joins detail to date with the same separator, so assert the whole detail.
  assert.ok(notedFeed.innerHTML.indexOf(notedTitle+' · felt strong today · '+fmtDay(shift(-1)))>=0,'the note joins the title the way the exercise and mobility rows join theirs');
  logs=[{id:'n2',name:'Alex',type:'bounty',bountyId:notedId,bountyTitle:notedTitle,date:shift(-1),createdAt:'2'}];
  render();
  assert.equal(notedFeed.innerHTML.indexOf('felt strong today'),-1,'a bounty with no note carries no note');
  assert.ok(notedFeed.innerHTML.indexOf(notedTitle+' · '+fmtDay(shift(-1)))>=0,'and renders exactly as it did before, title straight to date');
  // The note is user-entered text arriving from a shared Sheet, so it stays escaped.
  logs=[{id:'n3',name:'Alex',type:'bounty',bountyId:notedId,bountyTitle:notedTitle,note:'<img src=x onerror=alert(1)>',date:shift(-1),createdAt:'3'}];
  render();
  assert.equal(notedFeed.innerHTML.indexOf('<img'),-1,'a note carrying markup is escaped, never injected');
  assert.ok(notedFeed.innerHTML.indexOf('&lt;img')>=0,'and is shown as the text it is');

  // Entry 17: the today card names which categories are done and whether the balanced-day bonus is still live.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  render();
  const statusPill=document.querySelector('#todayStatus'),catRow=document.querySelector('#todayCategories'),remaining=document.querySelector('#todayRemaining');
  assert.equal(statusPill.textContent,'Ready','an untouched day still reads Ready');
  assert.equal(catRow.innerHTML.split('cat-chip').length-1,CATEGORIES.length,'one chip per scoring category');
  assert.equal(catRow.innerHTML.indexOf('cat-chip done')>=0,false,'no chip is done before anything is logged');
  assert.equal(catRow.innerHTML.indexOf('aria-hidden="true"')>=0,true,'the chip emoji are hidden from assistive tech');
  assert.ok(remaining.textContent.indexOf(CAT_LABELS.climb)>=0&&remaining.textContent.indexOf(CAT_LABELS.exercise)>=0&&remaining.textContent.indexOf(CAT_LABELS.mobility)>=0,'the remaining line names every open category');
  assert.ok(remaining.textContent.indexOf('+'+SCORING.balancedDayBonus)>=0,'the remaining line names the balanced-day bonus');
  assert.ok(remaining.textContent.indexOf('+'+(DAILY_MAX-SCORING.balancedDayBonus)+' more')>=0,'the remaining line names the points still on the table');

  logs=[{id:'tc1',name:'Alex',type:'climb',date:challengeToday(),createdAt:'1'},{id:'tc2',name:'Alex',type:'exercise',date:challengeToday(),createdAt:'2'}];
  render();
  assert.equal(statusPill.textContent,'1 more for +'+SCORING.balancedDayBonus,'two of three categories counts down to the bonus');
  assert.equal(catRow.innerHTML.split('cat-chip done').length-1,2,'the two logged categories read as done');
  assert.equal(catRow.innerHTML.split('cat-chip todo').length-1,1,'the missing category still reads as to-do');
  assert.ok(remaining.textContent.indexOf(CAT_LABELS.mobility)>=0,'the remaining line names the missing category');
  assert.equal(remaining.textContent.indexOf(CAT_LABELS.climb)>=0,false,'a logged category drops out of the remaining line');

  logs=logs.concat([{id:'tc3',name:'Alex',type:'mobility',date:challengeToday(),createdAt:'3'}]);
  render();
  assert.equal(statusPill.textContent,'Balanced day','all three categories complete the day');
  assert.equal(statusPill.classList.contains('max'),true,'a complete day keeps the max pill styling');
  assert.equal(catRow.innerHTML.split('cat-chip todo').length-1,0,'no category is left to do');
  assert.equal(remaining.textContent,'Balanced day complete — '+DAILY_MAX+' of '+DAILY_MAX+' points.','the remaining line reports the finished day');
  const meterHtml=document.querySelector('#youMeter').innerHTML;
  assert.equal(meterHtml.split('<i ').length-1,DAILY_MAX,'the You meter draws one pip per daily point');
  assert.equal(meterHtml.split('filled').length-1,DAILY_MAX,'a balanced day fills every pip');
  assert.ok(meterHtml.indexOf('seg-bonus')>=0,'the bonus pips are identifiable');

  // Entry 33: the chips are the one place the today card shows a missing category without offering
  // the action that fixes it. Each chip is now a real button inside its listitem wrapper, and the
  // chip counts above still hold because the wrapper class is chip-item, not a cat-chip variant.
  assert.ok(catRow.innerHTML.indexOf('<button class="cat-chip')>=0,'each chip is a real button');
  assert.ok(catRow.innerHTML.indexOf('role="listitem"')>=0,'and it sits inside its list item rather than replacing it');
  assert.equal(catRow.innerHTML.indexOf('role="listitem"><button'),catRow.innerHTML.indexOf('role="listitem"'),'the button is nested, so the listitem keeps its semantics and the button keeps its own');
  const chipRadio=document.querySelector('input[name="activityType"][value="exercise"]'),chipDateBox=document.querySelector('#dateFields');
  chipRadio.checked=false;chipDateBox.classList.remove('hide');
  // showTab() moves panels through querySelectorAll, which this stub returns empty from, so the
  // active panel is not observable here. lastDeleted is: showTab() clears it (entry 28), so a
  // cleared undo offer is the proof that the jump to the Record tab actually happened.
  lastDeleted={entry:logs[0],index:0,label:'a climb'};
  prefillCategory('exercise');
  assert.equal(chipRadio.checked,true,'tapping a chip preselects that category on the Record form');
  assert.equal(lastDeleted,null,'and it goes to the Record tab, the same jump claimBounty makes');
  assert.equal(chipDateBox.classList.contains('hide'),true,'the date fields are reset the way a bounty claim resets them');
  assert.equal(prefillCategory('not-a-category'),undefined,'an unknown category does nothing at all');
  // An already-logged category stays tappable: logging it twice is legal and simply scores 0, so
  // the affordance must not imply an error.
  assert.equal(catRow.innerHTML.split('cat-chip done').length-1,CATEGORIES.length,'every category is done in this state');
  assert.ok(catRow.innerHTML.indexOf('disabled')<0,'and none of the done chips is disabled');
  showTab('you');

  // Entry 36: the captions track their cards -- filled when the card is drawn, empty when hidden.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'h1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'h2',name:'Alex',type:'exercise',date:shift(-3),createdAt:'2'}];
  render();
  const heatCard=document.querySelector('#heatmapCard'),heatCap=document.querySelector('#heatmapSummary');
  assert.equal(heatCard.classList.contains('hide'),false,'the heatmap card is showing');
  assert.ok(heatCap.textContent.length>0,'so its caption says something');
  assert.ok(heatCap.textContent.indexOf('active day')>=0,'and reports the active-day count');
  const trendCard=document.querySelector('#weeklyTrendCard'),trendCap=document.querySelector('#trendSummary');
  assert.equal(trendCard.classList.contains('hide'),false,'the trend card is showing');
  assert.ok(trendCap.textContent.indexOf('Peak ')===0,'so its caption names the curve peak');
  logs=[];
  render();
  assert.equal(heatCap.textContent,'','a hidden heatmap card carries no caption');
  assert.equal(trendCap.textContent,'','and neither does a hidden trend card');

  // Entry 74: each trend card renders the same accessible daily momentum SVG.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Maya'}]};
  logs=[];
  render();
  const youTrendCard=document.querySelector('#youTrendCard'),youTrendEl=document.querySelector('#youTrend'),youTrendCap=document.querySelector('#youTrendSummary');
  assert.equal(youTrendCard.classList.contains('hide'),false,'a climber with nothing logged still gets the all-zero curve');
  assert.ok(youTrendEl.innerHTML.indexOf('<svg')>=0,'the personal chart is an inline SVG');
  assert.ok(youTrendEl.innerHTML.indexOf('role="img"')>=0&&youTrendEl.innerHTML.indexOf('aria-label=')>=0,'the SVG has one accessible name');
  assert.ok(youTrendEl.innerHTML.indexOf('Peak 0')>=0&&youTrendEl.innerHTML.indexOf('Current 0')>=0,'the peak and current values are visible without a hover');
  logs=[{id:'pt1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'pt2',name:'Maya',type:'climb',date:shift(-1),createdAt:'2'}];
  render();
  assert.equal(youTrendCard.classList.contains('hide'),false,'logging something leaves the card open');
  const youCurve=youTrendEl.innerHTML;
  assert.ok(youCurve.indexOf('trend-line')>=0&&youCurve.indexOf('<title>')>=0,'the SVG keeps a line and per-point hover affordance');
  const curveSvg=youCurve.slice(0,youCurve.indexOf('</svg>')+6);
  assert.ok(youCurve.indexOf('<div class="trend-labels">')>curveSvg.length-1,'the value labels sit outside the stretched SVG');
  assert.equal(curveSvg.indexOf('<text'),-1,'the SVG contains no distortable text marks');
  assert.equal((curveSvg.match(/<title>/g)||[]).length,personalWeeklyTrend('alex',challengeToday()).length,'each curve day keeps one hover title');
  assert.ok(youTrendCap.textContent.indexOf('Peak ')===0,'and trendCaption writes the caption underneath it');
  render();
  assert.equal(youTrendEl.innerHTML,youCurve,'a repaint redraws the same curve instead of appending marks');
  assert.equal(youTrendCard.classList.contains('hide'),false,'and leaves the card open');

  // Entry 78: a one-day curve has a real horizontal stroke and a rectangular fill.
  config={startDate:challengeToday(),tripDate:shift(5),goal:1000,crew:[{name:'Alex'}]};
  logs=[{id:'day-one',name:'Alex',type:'climb',date:challengeToday(),createdAt:'1'}];
  render();
  const dayOneSvg=youTrendEl.innerHTML.slice(0,youTrendEl.innerHTML.indexOf('</svg>')+6);
  const dayOneLine=dayOneSvg.match(/<path class="trend-line" d="([^"]+)"/)[1],dayOneArea=dayOneSvg.match(/<path class="trend-area" d="([^"]+)"/)[1];
  assert.match(dayOneLine,/^M0,[^ ]+ L100,[^ ]+$/,'a day-one curve strokes all the way across the chart');
  assert.match(dayOneArea,/^M0,[^ ]+ L100,[^ ]+ L100,88 L0,88 Z$/,'a day-one curve fills a rectangle instead of the old triangle');
  const tinyBreakdown=breakdownRow('','Tiny',1,0),zeroBreakdown=breakdownRow('','Zero',0,0);
  assert.match(tinyBreakdown,/class="nonzero" style="width:0%"/,'a nonzero breakdown row keeps its visible floor when rounding yields zero percent');
  assert.doesNotMatch(zeroBreakdown,/class="nonzero"/,'a zero-point breakdown row still has no rendered floor');
  const tinyPyramid=pyramidRow('V0',1,0),zeroPyramid=pyramidRow('V0',0,0),groupProgress=document.querySelector('#groupProgress');
  assert.match(tinyPyramid,/class="nonzero" style="width:0%"/,'a nonzero pyramid row keeps the same visible floor');
  assert.doesNotMatch(zeroPyramid,/class="nonzero"/,'a zero-send pyramid row still has no rendered floor');
  assert.equal(groupProgress.style.width,'0%','a tiny crew total can round to zero percent');
  assert.equal(groupProgress.classList.contains('nonzero'),true,'but a positive crew total keeps the progress floor');
  logs=[];
  render();
  assert.equal(groupProgress.classList.contains('nonzero'),false,'a true zero crew total removes the progress floor');

  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Maya'}]};
  logs=[{id:'pt1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'pt2',name:'Maya',type:'climb',date:shift(-1),createdAt:'2'}];
  render();
  assert.equal(personalWeeklyTrend('alex',challengeToday()).slice(-1)[0].points,3,'the personal curve counts only this climber points in its current window');
  assert.equal(weeklyTrend(challengeToday()).slice(-1)[0].points,6,'while the crew curve includes both climbers in its current window');
  me='Maya';recordingFor='Maya';
  logs=[{id:'pt1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'}];
  render();
  assert.equal(youTrendCard.classList.contains('hide'),false,'switching to a climber with nothing logged keeps the zero curve available');
  assert.ok(youTrendEl.innerHTML.indexOf('Current 0')>=0,'and the visible current label reads zero');
  // Entry 18: the today card carries the personal countdown and the person share of the crew pace.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  render();
  const countdown=document.querySelector('#youCountdown'),youPace=document.querySelector('#youPace');
  assert.ok(countdown.textContent.indexOf('Day 6 of 11')>=0,'the countdown names the day and the window length');
  assert.ok(countdown.textContent.indexOf('6 days left')>=0,'the countdown names the days remaining');
  assert.equal(youPace.classList.contains('hide'),false,'the personal pace line shows inside the window');
  assert.equal(youPace.textContent.indexOf('0 / 500 pts'),0,'the pace line opens with the person total over their share');
  assert.ok(youPace.textContent.indexOf('behind')>=0,'zero points partway through the window reads behind your share');
  assert.equal(youPace.classList.contains('behind'),true,'the pace line reuses the crew pace colour classes');
  config={startDate:shift(-20),tripDate:shift(-10),goal:500,crew:[{name:'Alex'}]};
  render();
  assert.equal(youPace.classList.contains('hide'),true,'a finished window hides the personal pace line');
  assert.equal(countdown.textContent.indexOf('Challenge complete'),0,'a finished window reads as complete');
  assert.ok(countdown.textContent.indexOf(fmtDay(shift(-10)))>=0,'the finished countdown names the end date');

  // Entry 19: the You feed deletes your own entries behind the in-app confirm dialog.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'d1',name:'Alex',type:'climb',hardestGrade:'V5',date:shift(-1),createdAt:'1'},{id:'d2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'},{id:'d3',name:'Alex',type:'mobility',date:shift(-1),createdAt:'3'}];
  render();
  const ownFeed=document.querySelector('#personalActivity'),crewFeed=document.querySelector('#activityList');
  assert.ok(ownFeed.innerHTML.indexOf('data-del=')>=0,'the You feed offers delete buttons for your own entries');
  assert.ok(ownFeed.innerHTML.indexOf('aria-label="Delete ')>=0,'each You-feed delete button names the entry it removes');
  // Entry 29 inverted these two: the Crew feed used to render a delete button on every other
  // person's entry, which is the affordance that entry removes. Asserted the other way round now,
  // against the same rendered feed, so the old behaviour cannot come back unnoticed.
  assert.equal(crewFeed.innerHTML.indexOf('data-del='),-1,'the Crew feed offers no delete buttons');
  assert.equal(crewFeed.innerHTML.indexOf('aria-label="Delete '),-1,'and no delete labels either');
  const confirmDialog=document.querySelector('#confirmModal'),confirmBody=document.querySelector('#confirmBody'),confirmNote=document.querySelector('#confirmNote');
  requestDelete(0,'d1','personal');
  assert.equal(confirmDialog.classList.contains('open'),true,'requesting a delete opens the in-app dialog instead of a native prompt');
  assert.ok(confirmBody.textContent.indexOf(CAT_LABELS.climb)>=0,'the confirm copy names the activity');
  assert.ok(confirmBody.textContent.indexOf('V5')>=0,'the confirm copy names the grade the way the old prompt did');
  assert.ok(confirmBody.textContent.indexOf('Alex')>=0,'the confirm copy names the person');
  assert.equal(confirmNote.textContent,'You can undo this from the bar that appears.','a local delete confirmation names the undo bar');
  assert.equal(confirmNote.classList.contains('hide'),false,'the local undo note is shown');
  const beforeCount=logs.length;
  performDelete();
  assert.equal(logs.length,beforeCount-1,'confirming removes exactly one entry in local mode');
  assert.equal(logs.some(x=>x.id==='d1'),false,'the confirmed entry is the one that goes');
  assert.equal(confirmDialog.classList.contains('open'),false,'confirming closes the dialog');
  performDelete();
  assert.equal(logs.length,beforeCount-1,'a second confirm with nothing pending deletes nothing');
  // Entry 26: a dismissed confirm leaves no intent behind, and a confirmed one acts on the row it
  // described rather than on a position that may since have come to mean something else.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'c1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'c2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'},{id:'c3',name:'Alex',type:'mobility',date:shift(-1),createdAt:'3'}];
  render();
  requestDelete(1,'c2','personal');
  assert.equal(confirmDialog.classList.contains('open'),true,'requesting a delete opens the dialog');
  closeModal('confirmModal');
  assert.equal(logs.length,3,'cancelling deletes nothing');
  performDelete();
  assert.equal(logs.length,3,'and a confirm that arrives after the cancel is a no-op, not a delayed delete');
  // The middle of three rows, by identity: the other two survive in their original order.
  requestDelete(1,'c2','personal');
  performDelete();
  assert.equal(logs.length,2,'confirming removes exactly one row');
  assert.deepEqual(logs.map(x=>x.id),['c1','c3'],'the row that goes is the one the dialog described, and the rest keep their order');
  // A row that has left logs between the request and the confirm is not replaced by a positional guess.
  requestDelete(0,'c1','personal');
  logs=logs.filter(x=>x.id!=='c1');
  performDelete();
  assert.deepEqual(logs.map(x=>x.id),['c3'],'a captured row that is already gone takes nothing with it');
  assert.equal(confirmDialog.classList.contains('open'),false,'and the dialog still closes');
  endpoint='https://sheet.example.test/exec';
  requestDelete(0,'c3','personal');
  assert.equal(confirmNote.textContent,'This cannot be undone.','a shared delete keeps the irreversible warning');
  assert.equal(confirmNote.classList.contains('hide'),false,'the shared delete warning is shown');
  closeModal('confirmModal');
  disconnect();
  assert.equal(confirmNote.classList.contains('hide'),true,'disconnecting hides the irreversible warning');
  closeModal('confirmModal');
  endpoint='';

  // Entry 28: a local delete offers itself back. performDelete()'s local branch contains no await,
  // so its effects land synchronously and the bar can be inspected straight after the call.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'u1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'u2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'},{id:'u3',name:'Alex',type:'mobility',date:shift(-1),createdAt:'3'}];
  render();
  const undoBar=document.querySelector('#undoBar'),undoTextEl=document.querySelector('#undoText');
  assert.equal(undoBar.classList.contains('hide'),true,'nothing has been deleted, so the bar stays away');
  requestDelete(1,'u2','personal');
  performDelete();
  assert.equal(undoBar.classList.contains('hide'),false,'a local delete offers an undo');
  assert.ok(undoTextEl.textContent.indexOf('Deleted ')===0,'and the bar names what it is offering back');
  assert.deepEqual(logs.map(x=>x.id),['u1','u3'],'the row is gone while the offer stands');
  undoDelete();
  assert.equal(logs.length,3,'undo restores the row');
  assert.deepEqual(logs.map(x=>x.id),['u1','u2','u3'],'and puts it back at the index it came from, not on the end');
  render();
  assert.equal(undoBar.classList.contains('hide'),true,'the offer is spent once it is taken');
  // Switching tabs puts the bar away, so it never outlives the action it describes.
  requestDelete(0,'u1','personal');
  performDelete();
  assert.equal(undoBar.classList.contains('hide'),false,'a second delete offers again');
  showTab('crew');
  render();
  assert.equal(undoBar.classList.contains('hide'),true,'moving to another tab puts the offer away');
  showTab('you');
  // Shared mode never offers undo at all: re-POSTing a deleted row would mint a new id.
  logs=[{id:'u1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'u2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'}];
  render();
  requestDelete(1,'u2','personal');
  performDelete();
  assert.equal(undoBar.classList.contains('hide'),false,'still offered in local mode');
  endpoint='https://sheet.example.test/exec';
  renderUndo();
  assert.equal(undoBar.classList.contains('hide'),true,'an endpoint appearing takes the offer away');
  undoDelete();
  assert.equal(logs.length,1,'and undo does nothing in shared mode even if it is called directly');
  endpoint='';

  // Entry 38: the feed caps were hard. Across a ten-week challenge the personal feed showed the
  // last five entries and the crew feed the last twenty, with no way to see anything older.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;resetFeedLimits();
  config={startDate:shift(-20),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  for(let i=0;i<8;i++)logs=logs.concat([{id:'p'+i,name:'Alex',type:'mobility',date:shift(-1),createdAt:String(i)}]);
  render();
  const pagedFeed=document.querySelector('#personalActivity'),moreBtn=document.querySelector('#personalShowMore');
  assert.equal(pagedFeed.innerHTML.split('class="activity').length-1,5,'the personal feed opens at its default five');
  assert.equal(moreBtn.classList.contains('hide'),false,'and offers the rest');
  showMoreFeed('personal');
  assert.equal(pagedFeed.innerHTML.split('class="activity').length-1,8,'showing more renders more');
  assert.equal(moreBtn.classList.contains('hide'),true,'and the offer goes away once everything is shown');
  // Growth is bounded by the data: paging past the end renders no phantom rows.
  showMoreFeed('personal');
  assert.equal(pagedFeed.innerHTML.split('class="activity').length-1,8,'paging past the end changes nothing');
  assert.equal(personalFeedLimit,8,'and the limit never runs beyond the log');
  // A feed that already fits never offers the button at all.
  resetFeedLimits();
  logs=[{id:'one',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'}];
  render();
  assert.equal(moreBtn.classList.contains('hide'),true,'a feed that already shows everything makes no offer');
  assert.equal(document.querySelector('#crewShowMore').classList.contains('hide'),true,'and neither does the crew feed');

  // Entry 43: the You feed narrows to one category. Element listeners are no-ops in this stub
  // and elements have no closest(), so the chip handler setFeedType() is called directly.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;feedType='all';resetFeedLimits();
  config={startDate:shift(-20),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'f1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'f2',name:'Alex',type:'exercise',date:shift(-2),createdAt:'2'},{id:'f3',name:'Alex',type:'mobility',date:shift(-3),createdAt:'3'},{id:'f4',name:'Alex',type:'climb',date:shift(-4),createdAt:'4'}];
  render();
  const filterFeed=document.querySelector('#personalActivity'),filterChips=document.querySelector('#feedFilter');
  assert.equal(filterFeed.innerHTML.split('class="activity').length-1,4,'the You feed opens showing every category');
  assert.equal(filterChips.innerHTML.indexOf('data-feed-type="all" aria-pressed="true"')>=0,true,'All is the pressed chip by default');
  setFeedType('climb');
  assert.equal(feedType,'climb','the choice lives in module state, not read back out of the DOM');
  assert.equal(filterFeed.innerHTML.split('class="activity').length-1,2,'selecting a category narrows the feed to that category');
  assert.equal(filterFeed.innerHTML.indexOf(CAT_LABELS.exercise)>=0,false,'and the other categories drop out');
  assert.equal(filterChips.innerHTML.indexOf('data-feed-type="climb" aria-pressed="true"')>=0,true,'the chosen chip is the pressed one');
  assert.equal(filterChips.innerHTML.indexOf('data-feed-type="all" aria-pressed="false"')>=0,true,'and All un-presses');
  setFeedType('mobility');
  assert.equal(filterFeed.innerHTML.split('class="activity').length-1,1,'switching to another category shows that one');
  setFeedType('all');
  assert.equal(filterFeed.innerHTML.split('class="activity').length-1,4,'selecting All restores every row');
  // Entry 38's show-more count is per-filter: carried across, it would open a narrow filter
  // already expanded, or hide rows the new filter has plenty of.
  logs=[];
  for(let i=0;i<8;i++)logs=logs.concat([{id:'h'+i,name:'Alex',type:'climb',date:shift(-1),createdAt:String(i)}]);
  render();
  showMoreFeed('personal');
  assert.equal(personalFeedLimit,8,'the show-more count grows under the current filter');
  setFeedType('mobility');
  assert.equal(personalFeedLimit,5,'switching filters resets the show-more limit');
  assert.equal(filterFeed.innerHTML.split('class="activity').length-1,0,'and a category with nothing logged shows no rows');
  setFeedType('all');
  assert.equal(personalFeedLimit,5,'returning to All resets it again');
  assert.equal(filterFeed.innerHTML.split('class="activity').length-1,5,'and reopens at the default five');
  // The filter is deliberately not remembered: it is module state, so a reload starts at All.
  assert.equal(feedType,'all','the filter ends where it started, with nothing persisted');

  // Entry 44: the Crew feed carries the same chips over its own module-level filter. The two feeds
  // must not share one variable, so every assertion below checks the other feed is untouched.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;feedType='all';crewFeedType='all';resetFeedLimits();
  config={startDate:shift(-20),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[{id:'c1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'c2',name:'Bo',type:'exercise',date:shift(-2),createdAt:'2'},{id:'c3',name:'Alex',type:'mobility',date:shift(-3),createdAt:'3'},{id:'c4',name:'Bo',type:'climb',date:shift(-4),createdAt:'4'}];
  render();
  const bothCrewFeed=document.querySelector('#activityList'),bothCrewChips=document.querySelector('#crewFeedFilter'),bothYouFeed=document.querySelector('#personalActivity');
  const bothRows=el=>el.innerHTML.split('class="activity').length-1;
  assert.equal(bothRows(bothCrewFeed),4,'the Crew feed opens showing every category');
  assert.equal(bothCrewChips.innerHTML.indexOf('data-feed-type="all" aria-pressed="true"')>=0,true,'All is the pressed Crew chip by default');
  assert.equal(bothCrewChips.innerHTML.indexOf('data-feed-type="climb"')>=0,true,'and the Crew row offers a chip per category');
  // Narrow the You feed first, so the Crew filter has something to leave alone.
  setFeedType('mobility');
  assert.equal(bothRows(bothYouFeed),1,'the You feed narrows to its own category');
  setFeedType('climb',true);
  assert.equal(crewFeedType,'climb','the Crew choice lives in its own module state');
  assert.equal(feedType,'mobility','and setting it leaves the You feed filter alone');
  assert.equal(bothRows(bothCrewFeed),2,'the Crew feed narrows to that category across every climber');
  assert.equal(bothRows(bothYouFeed),1,'while the You feed keeps the rows its own filter selected');
  assert.equal(bothCrewChips.innerHTML.indexOf('data-feed-type="climb" aria-pressed="true"')>=0,true,'the chosen Crew chip is the pressed one');
  assert.equal(bothCrewChips.innerHTML.indexOf('data-feed-type="all" aria-pressed="false"')>=0,true,'and All un-presses on the Crew row');
  assert.equal(document.querySelector('#feedFilter').innerHTML.indexOf('data-feed-type="mobility" aria-pressed="true"')>=0,true,'the You chip row still shows its own selection');
  setFeedType('exercise',true);
  assert.equal(bothRows(bothCrewFeed),1,'switching the Crew filter shows the next category');
  assert.equal(bothRows(bothYouFeed),1,'still without disturbing the You feed');
  setFeedType('all',true);
  assert.equal(crewFeedType,'all','the Crew filter returns to All');
  assert.equal(bothRows(bothCrewFeed),4,'restoring every Crew row');
  assert.equal(feedType,'mobility','and the You feed filter survives the round trip untouched');
  // Symmetry: changing the You filter must not reach back into the Crew feed either.
  setFeedType('climb');
  assert.equal(crewFeedType,'all','the You filter never writes the Crew feed variable');
  assert.equal(bothRows(bothCrewFeed),4,'so the Crew feed still shows everything');
  assert.equal(bothRows(bothYouFeed),1,'and the You feed shows its own narrowed rows');
  setFeedType('all');

  // Entry 49: a filter that empties a feed says so by name, in that feed alone, rather than
  // falling back to the same "no activity" sentence a truly empty feed shows.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;feedType='all';crewFeedType='all';resetFeedLimits();
  config={startDate:shift(-20),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[{id:'n1',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'n2',name:'Bo',type:'climb',date:shift(-2),createdAt:'2'}];
  render();
  const namedYouFeed=document.querySelector('#personalActivity'),namedCrewFeed=document.querySelector('#activityList');
  setFeedType('mobility');
  assert.ok(namedYouFeed.innerHTML.indexOf('No '+CAT_LABELS.mobility+' entries in this view.')>=0,'the You feed names the category that emptied it');
  assert.equal(namedYouFeed.innerHTML.indexOf('No activity yet.'),-1,'and drops the generic sentence while a filter is active');
  assert.equal(namedCrewFeed.innerHTML.indexOf('No '+CAT_LABELS.mobility+' entries in this view.'),-1,'the Crew feed keeps its own rows and reads no filter sentence');
  setFeedType('exercise',true);
  assert.ok(namedCrewFeed.innerHTML.indexOf('No '+CAT_LABELS.exercise+' entries in this view.')>=0,'the Crew feed also names its own filter when it empties');
  assert.ok(namedYouFeed.innerHTML.indexOf('No '+CAT_LABELS.mobility+' entries in this view.')>=0,'while the You feed still names its own, unrelated filter');
  setFeedType('all');
  assert.equal(namedYouFeed.innerHTML.indexOf('entries in this view.'),-1,'clearing the You filter drops the category sentence now that Alex has a climb logged');
  setFeedType('all',true);
  assert.equal(namedCrewFeed.innerHTML.indexOf('entries in this view.'),-1,'clearing the Crew filter drops the category sentence too');

  // With nothing logged at all, the unfiltered feed keeps the original, plain sentence.
  logs=[];
  render();
  assert.ok(namedYouFeed.innerHTML.indexOf('No activity yet.')>=0,'a genuinely empty You feed still reads the plain sentence');
  assert.ok(namedCrewFeed.innerHTML.indexOf('No activity yet.')>=0,'a genuinely empty Crew feed still reads the plain sentence');

  // The shared branch posts action:'delete' through fetchShared; harness 2 has no fetch stub,
  // so it stays with the fetch-stubbed harness pattern below.

  // Entry 20: tapping a leaderboard row opens the per-person card. Element listeners are
  // no-ops in this stub and elements have no closest(), so call openPersonCard directly.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[{id:'q1',name:'Alex',type:'climb',hardestGrade:'V5',date:shift(-1),createdAt:'1'},{id:'q2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'},{id:'q3',name:'Bo',type:'climb',hardestGrade:'V2',date:shift(-1),createdAt:'3'}];
  render();
  const leaderRows=document.querySelector('#leaderRows');
  assert.equal(document.querySelector('#youRank').textContent,'#1 of 2','the You rank names the roster field');
  assert.ok(leaderRows.innerHTML.indexOf('data-person="Alex"')>=0,'every leaderboard row carries a per-person hook');
  assert.ok(leaderRows.innerHTML.indexOf('<button class="climber"')>=0,'the climber name is a real button, not a clickable row');
  assert.equal(leaderRows.innerHTML.indexOf('tabindex'),-1,'the row itself gets no fake tab stop');
  const personModal=document.querySelector('#personModal'),personTitle=document.querySelector('#personTitle'),personBreakdown=document.querySelector('#personBreakdown'),personSummaryEl=document.querySelector('#personSummary');
  openPersonCard('Alex');
  assert.equal(personModal.classList.contains('open'),true,'opening the card opens the shared dialog');
  assert.ok(personTitle.textContent.indexOf('Alex')>=0,'the dialog is titled with the person tapped');
  assert.ok(personBreakdown.innerHTML.length>0,'the card renders a category breakdown');
  assert.ok(personBreakdown.innerHTML.indexOf(CAT_LABELS.climb)>=0,'the breakdown names a category');
  assert.ok(personSummaryEl.innerHTML.indexOf('#1')>=0,'the summary names the rank');
  assert.ok(personSummaryEl.innerHTML.indexOf('of 2')>=0,'the summary names the roster field');
  assert.ok(document.querySelector('#personPyramid').innerHTML.indexOf('V5')>=0,'the pyramid lists the hardest send');
  assert.ok(document.querySelector('#personRecords').innerHTML.length>0,'the card renders the personal records rows');
  const summaryBefore=personSummaryEl.innerHTML;
  logs=logs.concat([{id:'q4',name:'Alex',type:'mobility',date:shift(-1),createdAt:'4'}]);
  render();
  assert.notEqual(personSummaryEl.innerHTML,summaryBefore,'an open card refreshes when a sync re-renders');
  openPersonCard('Nobody');
  assert.ok(personTitle.textContent.indexOf('Alex')>=0,'an unknown name leaves the open card untouched');
  closeModal('personModal');
  assert.equal(personModal.classList.contains('open'),false,'closing the dialog clears the open class');
  me='Bo';recordingFor='Bo';render();
  assert.equal(document.querySelector('#youRank').textContent,'#2 of 2','a roster member without logs remains in the ranked field');

  // Entry 68: Bounty Hunter reads its rolling claim count without repointing the cap, leaderboard,
  // or person-card fields that remain calendar-week views.
  const savedChallengeToday=challengeToday;
  challengeToday=()=> '2026-07-13';
  me='Alex';recordingFor='Alex';endpoint='';leaderMetric='bounty';leaderScope='week';
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[
    {id:'h1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-07',createdAt:'1'},
    {id:'h2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-07',createdAt:'2'},
    {id:'h3',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-07',createdAt:'3'},
    {id:'h4',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'4'},
    {id:'h5',name:'Bo',type:'bounty',bountyId:'send-it',date:'2026-07-07',createdAt:'1'},
  ];
  render();
  const capHint=document.querySelector('#bountyCapHint'),rollingRows=document.querySelector('#leaderRows');
  assert.ok(capHint.textContent.indexOf('3 / '+SCORING.weeklyBountyCap+' bounty points this week')>=0,'the cap hint keeps its calendar-week credit');
  const alexRow=rollingRows.innerHTML.slice(rollingRows.innerHTML.indexOf('data-person="Alex"'));
  assert.ok(alexRow.indexOf('<strong>4</strong>')>=0,'the recent Bounties leaderboard reads its rolling field');
  openPersonCard('Alex');
  assert.ok(personSummaryEl.innerHTML.indexOf('1 this week')>=0,'the person card bounty figure remains weekly');
  closeModal('personModal');
  logs=[
    {id:'recent-old',name:'Alex',type:'climb',date:'2026-07-05',createdAt:'1'},
    {id:'recent-new',name:'Bo',type:'climb',date:'2026-07-13',createdAt:'2'},
  ];
  leaderMetric='points';leaderScope='week';render();
  const recentRows=leaderRows.innerHTML;
  assert.ok(recentRows.indexOf('data-person="Bo"')<recentRows.indexOf('data-person="Alex"'),'the recent scope ranks points inside the last seven days above points eight days old');

  // Entry 73: both trend consumers name the same adjacent seven-day comparison, and neither
  // renders an arrow while the earlier window still falls before the challenge.
  challengeToday=()=> '2026-07-15';
  logs=[
    {id:'trend-old',name:'Alex',type:'climb',date:'2026-07-02',createdAt:'1'},
    {id:'trend-new',name:'Alex',type:'climb',date:'2026-07-15',createdAt:'2'},
    {id:'trend-more',name:'Alex',type:'exercise',date:'2026-07-15',createdAt:'3'},
  ];
  leaderMetric='points';leaderScope='week';render();
  assert.ok(leaderRows.innerHTML.indexOf('aria-label="up vs last 7 days"')>=0,'the leaderboard arrow names its rolling window');
  openPersonCard('Alex');
  assert.ok(personSummaryEl.innerHTML.indexOf('Up vs last 7 days')>=0,'the person-card trend names its rolling window');
  closeModal('personModal');
  challengeToday=()=> '2026-07-07';render();
  assert.equal(leaderRows.innerHTML.indexOf('week-trend'),-1,'the leaderboard suppresses the arrow during the first challenge week');
  openPersonCard('Alex');
  assert.equal(personSummaryEl.innerHTML.indexOf('week-trend'),-1,'the person card suppresses the arrow during the first challenge week');
  closeModal('personModal');
  challengeToday=()=> '2026-07-13';

  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'},{name:'Bo'},{name:'Cy'}]};
  logs=[
    {id:'title1',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'},
    {id:'title2',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'2'},
    {id:'title3',name:'Bo',type:'mobility',date:'2026-07-13',createdAt:'3'},
  ];
  render();
  const rowFor=name=>{const start=leaderRows.innerHTML.indexOf('data-person="'+name+'"');return leaderRows.innerHTML.slice(start,leaderRows.innerHTML.indexOf('</tr>',start))},
        alexTitleRow=rowFor('Alex'),boTitleRow=rowFor('Bo'),cyTitleRow=rowFor('Cy');
  assert.ok(alexTitleRow.indexOf('class="title-tag"')>=0&&alexTitleRow.indexOf('Crusher · Gym Rat')>=0,'a multi-title holder lists its titles in category order');
  assert.ok(boTitleRow.indexOf('class="title-tag"')>=0&&boTitleRow.indexOf('Yogi')>=0,'a single-title holder carries its own tag');
  assert.equal(cyTitleRow.indexOf('class="title-tag"'),-1,'a person holding no title gets no tag and no placeholder');
  assert.ok(leaderRows.innerHTML.indexOf('data-person="Alex"')>=0&&leaderRows.innerHTML.indexOf('data-person="Bo"')>=0,'the leaderboard rows remain intact beside the folded-in titles');
  const beforeRepaint=leaderRows.innerHTML;
  render();
  assert.equal(leaderRows.innerHTML,beforeRepaint,'repainting the leaderboard with titles is idempotent');

  // Entry 71: the rank column and Bounty Hunter mark carry the leaderboard without podium medals.
  leaderMetric='points';leaderScope='week';
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'},{name:'Bo'},{name:'Cy'}]};
  logs=[
    {id:'m1',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'},
    {id:'m2',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'2'},
    {id:'m3',name:'Bo',type:'exercise',date:'2026-07-13',createdAt:'3'},
    {id:'m4',name:'Cy',type:'mobility',date:'2026-07-13',createdAt:'4'},
  ];
  render();
  const weeklyMedalFree=leaderRows.innerHTML;
  assert.equal(weeklyMedalFree.indexOf('🥇'),-1,'the weekly rows contain no gold medal');
  assert.equal(weeklyMedalFree.indexOf('🥈'),-1,'the weekly rows contain no silver medal');
  assert.equal(weeklyMedalFree.indexOf('🥉'),-1,'the weekly rows contain no bronze medal');
  assert.equal(weeklyMedalFree.indexOf('class="medal"'),-1,'the weekly rows emit no medal span');
  assert.ok(weeklyMedalFree.indexOf('>#1</td>')<weeklyMedalFree.indexOf('>#2</td>')&&weeklyMedalFree.indexOf('>#2</td>')<weeklyMedalFree.indexOf('>#3</td>'),'the weekly rank column remains in order');
  assert.ok(weeklyMedalFree.indexOf('class="me"')>=0,'the signed-in climber remains highlighted');
  assert.ok(weeklyMedalFree.indexOf('class="hunter"')>=0,'the Bounty Hunter glyph remains beside its holder');
  leaderScope='overall';render();
  const overallMedalFree=leaderRows.innerHTML;
  assert.equal(overallMedalFree.indexOf('🥇'),-1,'the overall rows contain no gold medal');
  assert.equal(overallMedalFree.indexOf('🥈'),-1,'the overall rows contain no silver medal');
  assert.equal(overallMedalFree.indexOf('🥉'),-1,'the overall rows contain no bronze medal');
  assert.equal(overallMedalFree.indexOf('class="medal"'),-1,'the overall rows emit no medal span');
  assert.ok(overallMedalFree.indexOf('>#1</td>')<overallMedalFree.indexOf('>#2</td>')&&overallMedalFree.indexOf('>#2</td>')<overallMedalFree.indexOf('>#3</td>'),'the overall rank column remains in order');
  challengeToday=savedChallengeToday;leaderMetric='points';leaderScope='week';

  // Entry 48: the Crew feed names a person on every row, and those names open the same card the
  // leaderboard rows open. The You feed lists only your own entries, so its names stay plain text.
  // The delegated handler cannot be fired here (harness.js trap), so this asserts the emitted hook
  // and then feeds the value it emitted straight into openPersonCard.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[{id:'f1',name:'Alex',type:'climb',hardestGrade:'V5',date:shift(-2),createdAt:'1'},{id:'f2',name:'Bo',type:'exercise',date:shift(-1),createdAt:'2'}];
  render();
  const feedCrew=document.querySelector('#activityList'),feedYou=document.querySelector('#personalActivity');
  assert.ok(feedCrew.innerHTML.indexOf('data-person="Bo"')>=0,'a Crew row carries the climber it names as a per-person hook');
  assert.ok(feedCrew.innerHTML.indexOf('data-person="Alex"')>=0,'every Crew row carries one, not just the newest');
  assert.ok(feedCrew.innerHTML.indexOf('<button class="climber" type="button" data-person=')>=0,'the Crew name reuses the leaderboard climber button rather than a new control');
  assert.ok(feedCrew.innerHTML.indexOf('aria-haspopup="dialog"')>=0,'and announces that it opens a dialog');
  assert.ok(feedYou.innerHTML.length>0,'the You feed has rows of its own to compare against');
  assert.equal(feedYou.innerHTML.indexOf('data-person='),-1,'the You feed lists your own entries, so its names get no per-person hook');
  assert.ok(feedYou.innerHTML.indexOf('<strong>Alex</strong>')>=0,'the You feed keeps the plain name it always rendered');
  assert.equal(feedCrew.innerHTML.indexOf('data-del='),-1,'and the Crew feed is still read-only');
  const hookMark='data-person="',hookAt=feedCrew.innerHTML.indexOf(hookMark),hooked=feedCrew.innerHTML.slice(hookAt+hookMark.length,feedCrew.innerHTML.indexOf('"',hookAt+hookMark.length));
  assert.equal(hooked,'Bo','the newest Crew row hooks the person who logged it');
  personTitle.textContent='';
  openPersonCard(hooked);
  assert.equal(personTitle.textContent,hooked,'the value a Crew row carries opens that climber card');
  assert.equal(personModal.classList.contains('open'),true,'and opens the shared person dialog');
  closeModal('personModal');

  // Entry 30: the You panel and the person card render the SAME row shape for the same person, and
  // the You-panel bars are no longer silent decoration — they announce themselves like the card's.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'s1',name:'Alex',type:'climb',hardestGrade:'V4',date:shift(-1),createdAt:'1'},{id:'s2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'}];
  render();
  openPersonCard('Alex');
  const youBd=document.querySelector('#youBreakdown'),personBd=document.querySelector('#personBreakdown');
  assert.ok(youBd.innerHTML.length>0,'the You breakdown has rows to compare');
  assert.equal(youBd.innerHTML,personBd.innerHTML,'the same data renders the same row markup in both places');
  assert.ok(youBd.innerHTML.indexOf('role="img"')>=0,'the You-panel bars are announced as graphics');
  assert.ok(youBd.innerHTML.indexOf('aria-label="')>=0,'and each one carries its own text alternative');
  assert.ok(youBd.innerHTML.indexOf('<i style="width:')>=0&&youBd.innerHTML.indexOf('aria-hidden="true"></i>')>=0,'while the decorative fill stays hidden');
  const youPy=document.querySelector('#gradePyramid'),personPy=document.querySelector('#personPyramid');
  assert.ok(youPy.innerHTML.length>0,'the You pyramid has rows to compare');
  assert.equal(youPy.innerHTML,personPy.innerHTML,'the pyramid rows match too');

  // Entry 59: a card lists only the bounty claims belonging to the climber the viewer opened.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;claimedOpen=false;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'},{name:'Maya'}]};
  const alexBounty=dailyBounties(challengeToday())[0],boBounty=dailyBounties(challengeToday())[1];
  logs=[{id:'b1',name:'Alex',type:'bounty',bountyId:alexBounty.id,bountyTitle:alexBounty.title,date:shift(-1),createdAt:'1'},{id:'b2',name:'Bo',type:'bounty',bountyId:boBounty.id,bountyTitle:boBounty.title,date:shift(-1),createdAt:'2'}];
  render();
  openPersonCard('Bo');
  const personClaimed=document.querySelector('#personClaimed'),personClaimedCap=document.querySelector('#personClaimedSummary');
  assert.ok(personClaimed.innerHTML.indexOf(boBounty.title)>=0,'the card lists that climber’s bounty title');
  assert.equal(personClaimed.innerHTML.indexOf(alexBounty.title),-1,'another climber’s bounty title is absent');
  assert.ok(personClaimedCap.textContent.indexOf('1 claim')>=0,'the card caption names the claim count');
  assert.ok(personClaimed.innerHTML.indexOf('bounty-peek')>=0,'the card reuses the bounty row shape');
  assert.equal(personClaimed.innerHTML.indexOf('data-claim-bounty'),-1,'the card rows cannot claim bounties');
  assert.equal(personClaimed.innerHTML.indexOf('data-del'),-1,'the card rows cannot delete claims');
  openPersonCard('Maya');
  assert.ok(personClaimed.innerHTML.indexOf('No bounty claims yet.')>=0,'a climber with no claims gets the plain empty state');
  assert.equal(personClaimedCap.textContent,'','and the empty state has no caption');
  openPersonCard('Alex');
  claimedOpen=true;
  renderClaimed();
  assert.equal(document.querySelector('#claimedList').innerHTML,personClaimed.innerHTML,'the You panel and the person card share the same claimed row markup');
  claimedOpen=false;
  renderClaimed();
  closeModal('personModal');
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[{id:'s1',name:'Alex',type:'climb',hardestGrade:'V4',date:shift(-1),createdAt:'1'},{id:'s2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'}];
  render();
  openPersonCard('Alex');

  // Entry 51: the pyramid gets the same plain-text caption treatment as the heatmap and trend
  // charts, tracking the card so it clears when the card hides.
  const pyramidCard=document.querySelector('#gradePyramidCard'),pyramidCap=document.querySelector('#pyramidSummary');
  assert.equal(pyramidCard.classList.contains('hide'),false,'the pyramid card is showing');
  assert.ok(pyramidCap.textContent.indexOf('V4')>=0,'and its caption names the hardest grade');
  assert.equal(youPy.innerHTML,personPy.innerHTML,'the caption addition leaves the pyramid rows themselves unchanged');
  logs=[];
  render();
  assert.equal(pyramidCard.classList.contains('hide'),true,'no graded climbs hides the pyramid card');
  assert.equal(pyramidCap.textContent,'','and clears its caption');
  logs=[{id:'s1',name:'Alex',type:'climb',hardestGrade:'V4',date:shift(-1),createdAt:'1'},{id:'s2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'}];
  render();

  const youRec=document.querySelector('#recordsList'),personRec=document.querySelector('#personRecords');
  assert.ok(youRec.innerHTML.indexOf('records-row')>=0&&personRec.innerHTML.indexOf('records-row')>=0,'both records lists render through the shared row');
  closeModal('personModal');

  // Entry 21: a dead Save button explains itself, the in-flight flag survives a mid-save input
  // change, and the bounty hint carries the chosen bounty's description.
  me='Alex';recordingFor='Alex';endpoint='';logs=[];
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  const typeRadio=document.querySelector('input[name="activityType"]:checked'),saveBtn=document.querySelector('#saveActivityBtn'),creditEl=document.querySelector('#creditPreview'),hintEl=document.querySelector('#bountyHint'),bountyEl=document.querySelector('#bountySelect');
  typeRadio.value='climb';
  dateBox.classList.remove('hide');
  dateField.value=shift(-20);
  updateRecordPreview();
  assert.equal(creditEl.textContent.indexOf('Outside the challenge window'),0,'an out-of-window date explains the dead Save button');
  assert.equal(saveBtn.disabled,true,'an out-of-window date disables Save');
  dateField.value=shift(-1);
  updateRecordPreview();
  assert.equal(saveBtn.disabled,false,'a date back inside the window re-enables Save');
  saving=true;
  updateRecordPreview();
  assert.equal(saveBtn.disabled,true,'a save in flight keeps Save disabled even with a valid draft');
  saving=false;
  updateRecordPreview();
  assert.equal(saveBtn.disabled,false,'clearing the in-flight flag re-enables Save');
  typeRadio.value='bounty';
  dateBox.classList.add('hide');
  dateField.value=challengeToday();
  populateBountySelect();
  const pickedBounty=dailyBounties(challengeToday())[0];
  bountyEl.value=pickedBounty.id;
  updateRecordPreview();
  assert.equal(hintEl.textContent,pickedBounty.description,'the hint shows the chosen bounty description');
  bountyEl.value='';
  updateRecordPreview();
  assert.equal(hintEl.textContent,'','clearing the choice empties the hint');
  typeRadio.value='climb';

  // Entry 22: Share only offers itself once a profile is chosen.
  const shareBtnEl=document.querySelector('#shareBtn');
  me='Alex';recordingFor='Alex';render();
  assert.equal(shareBtnEl.classList.contains('hide'),false,'a chosen profile can share its progress');
  assert.equal(shareBtnEl.disabled,false,'a chosen profile leaves Share enabled');
  me='';recordingFor='';render();
  assert.equal(shareBtnEl.classList.contains('hide'),true,'no profile hides the Share button');
  assert.equal(shareBtnEl.disabled,true,'no profile disables the Share button');

  // Entry 47: the grade select starts where this climber left it, and never argues with a choice
  // already made in the open form.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Maya'}]};
  logs=[
    {id:'gd1',name:'Alex',type:'climb',hardestGrade:'V3',date:shift(-3),createdAt:'1'},
    {id:'gd2',name:'Alex',type:'climb',hardestGrade:'V6',date:shift(-1),createdAt:'1'},
    {id:'gd3',name:'Maya',type:'climb',hardestGrade:'V10',date:shift(-1),createdAt:'2'},
  ];
  const gradeField=document.querySelector('#hardestGrade');
  gradeField.value='';
  updateRecordPreview();
  assert.equal(gradeField.value,'V6','populating the climb form preselects the grade this person logged last');
  gradeField.value='V9';
  render();
  assert.equal(gradeField.value,'V9','a grade already chosen in the open form survives a repaint');
  updateRecordPreview();
  assert.equal(gradeField.value,'V9','and survives being populated again');
  // The default is derived per populate, so it follows whoever the form is recording for.
  recordingFor='Maya';
  gradeField.value='';
  updateRecordPreview();
  assert.equal(gradeField.value,'V10','recording for someone else defaults to that person, not to the last default shown');
  recordingFor='Alex';
  gradeField.value='';
  render();
  assert.equal(gradeField.value,'V6','and switching back reads the first person again');
  // A default the form filled in on its own is not a choice, so switching targets while it is
  // still showing re-derives it instead of saving the previous person's grade for the new one.
  recordingFor='Maya';
  render();
  assert.equal(gradeField.value,'V10','switching targets replaces a still-untouched default with the new person grade');
  assert.equal(draftActivity().hardestGrade,'V10','and the entry that would be saved carries the new person grade');
  recordingFor='Alex';
  render();
  assert.equal(gradeField.value,'V6','switching back replaces it again');
  gradeField.value='V9';
  recordingFor='Maya';
  render();
  assert.equal(gradeField.value,'V9','a hand-picked grade still outranks the default across a target switch');
  recordingFor='Alex';
  // No climb history means no guess: the select is left on its placeholder.
  logs=[{id:'gd4',name:'Alex',type:'exercise',date:shift(-1),createdAt:'1'}];
  gradeField.value='';
  render();
  assert.equal(gradeField.value,'','a climber with no climbs is left on the placeholder');
  // A stored grade the scoring config does not offer is not selectable, so it is not applied.
  logs=[{id:'gd5',name:'Alex',type:'climb',hardestGrade:'5.12a',date:shift(-1),createdAt:'1'}];
  gradeField.value='';
  render();
  assert.equal(gradeField.value,'','an unlistable stored grade never reaches the select');
  gradeField.value='';

  // Entry 52: a climb can carry a note too, so updateRecordPreview() stops hiding #noteFields for
  // climb and draftActivity() carries the typed note through on that branch.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'}]};
  logs=[];
  const climbFieldsEl=document.querySelector('#climbFields'),noteFieldsEl=document.querySelector('#noteFields'),noteInput=document.querySelector('#activityNote');
  typeRadio.value='climb';
  noteInput.value='V4, first try on the slab';
  updateRecordPreview();
  assert.equal(noteFieldsEl.classList.contains('hide'),false,'the note field stays visible for a climb');
  assert.equal(climbFieldsEl.classList.contains('hide'),false,'the grade field still shows for a climb');
  assert.equal(draftActivity().note,'V4, first try on the slab','and the entry that would be saved carries the typed note');
  typeRadio.value='exercise';
  updateRecordPreview();
  assert.equal(noteFieldsEl.classList.contains('hide'),false,'the note field stays visible for a non-climb type too');
  assert.equal(climbFieldsEl.classList.contains('hide'),true,'the grade field hides for a non-climb type');
  typeRadio.value='climb';
  updateRecordPreview();
  assert.equal(noteFieldsEl.classList.contains('hide'),false,'switching back to climb keeps the note field visible');
  noteInput.value='';

  // Entry 74: the person card uses exactly the same curve markup as the You card.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-10),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[{id:'pt3',name:'Alex',type:'climb',date:shift(-1),createdAt:'1'},{id:'pt4',name:'Alex',type:'climb',date:shift(-9),createdAt:'2'}];
  render();
  openPersonCard('Alex');
  const personTrendEl=document.querySelector('#personTrend');
  assert.equal(personTrendEl.innerHTML,youTrendEl.innerHTML,'the card charts the same daily curve the You card shows for that same climber');
  assert.ok(personTrendEl.innerHTML.indexOf('<svg')>=0,'and draws the inline SVG curve');
  logs=[];
  render();
  openPersonCard('Bo');
  assert.ok(document.querySelector('#personTrend').innerHTML.indexOf('Current 0')>=0,'a climber with nothing logged gets an all-zero curve');
  closeModal('personModal');

  // Entry 54: the person card lists that climber's most recent entries as its final section, and
  // falls back to the hint used elsewhere in the card when they have logged nothing.
  me='Alex';recordingFor='Alex';endpoint='';lastDeleted=null;
  config={startDate:shift(-10),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[{id:'pr1',name:'Alex',type:'climb',hardestGrade:'V4',date:shift(-2),createdAt:'1'},{id:'pr2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'},{id:'pr3',name:'Bo',type:'climb',hardestGrade:'V9',date:shift(-1),createdAt:'3'}];
  render();
  openPersonCard('Alex');
  const personRecentEl=document.querySelector('#personRecent');
  assert.ok(personRecentEl.innerHTML.indexOf('records-row')>=0,'the section renders with the shared records-row markup');
  assert.ok(personRecentEl.innerHTML.indexOf(CAT_LABELS.exercise)>=0,'names that climber newest entry');
  assert.equal(personRecentEl.innerHTML.indexOf('V9'),-1,'and not a crewmate entry');
  logs=[];
  render();
  openPersonCard('Bo');
  assert.ok(document.querySelector('#personRecent').innerHTML.indexOf('class="hint"')>=0,'a climber with no entries gets the hint fallback instead of an empty list');
  closeModal('personModal');

  endpoint='';logs=[];me='';recordingFor='';
})()`;

test('the rendered page reflects the state the app is in', () => {
  vm.runInNewContext(`${source}\n${domChecks}`, domContext, {filename: 'index.html'});
});
