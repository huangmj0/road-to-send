// Scoring, totals, pace and share-text behaviour, asserted against the built script with no
// DOM at all. New behavioural coverage for a pure helper belongs here.
//
// TRAP — the assertions below live inside a backtick template literal that is evaluated in a
// vm context. Added code may contain no backtick and no `${`, or it terminates the literal
// early and fails with an unhelpful syntax error. Build strings with `+`.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {test} = require('node:test');
const {source} = require('./harness.js');

const values = new Map();
const context = {
  assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Intl,
  location: {search: '', href: 'https://example.test/'},
  localStorage: {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  },
  setTimeout() {}, clearTimeout() {},
};

const checks = `(()=>{
  assert.equal(activityPoints({type:'climb'}),3);
  assert.equal(activityPoints({type:'exercise'}),2);
  assert.equal(activityPoints({type:'mobility'}),1);
  assert.equal(activityPoints({type:'bounty',bountyId:'send-it'}),3);
  assert.equal(activityPoints({type:'bounty',bountyId:'not-real'}),0,'unknown bounty scores zero');
  const rawNames=sanitizeActivities([{name:' Alex',type:'climb'},{name:7,type:'exercise'}]);
  assert.equal(rawNames[0].name,' Alex','activity sanitation preserves a leading space in the stored name');
  assert.equal(rawNames[1].name,7,'activity sanitation preserves a numeric stored name');
  const normalized=sanitizeActivities([{id:7,name:'Alex',type:'climb',date:'2026-07-13T07:30:00.000Z',createdAt:9,points:99,category:'nope',hardestGrade:'v5',bountyId:'x'.repeat(60),note:'n'.repeat(200),sheetRow:12}]);
  assert.equal(normalized[0].id,'7','a numeric sheet id becomes a string so creditKey stops mixing string and number keys');
  assert.equal(normalized[0].date,'2026-07-13','a date carrying a time component is reduced to the calendar day');
  assert.equal(normalized[0].createdAt,'9','createdAt is coerced to the string the sort comparator already assumes');
  assert.equal(normalized[0].points,3,'a stored point value above the schema maximum is clamped');
  assert.equal(normalized[0].category,'','a category outside the scoring set is dropped');
  assert.equal(normalized[0].hardestGrade,'V5','a lowercase grade is upcased to a known grade');
  assert.equal(normalized[0].bountyId.length,40,'bountyId is clamped to the schema maximum');
  assert.equal(normalized[0].note.length,120,'note is clamped to the schema maximum');
  assert.equal(normalized[0].sheetRow,12,'an unknown Sheet column survives normalization untouched');
  const badDate=sanitizeActivities([{id:'x1',name:'Alex',type:'climb',date:'next tuesday'}]);
  assert.equal(badDate.length,1,'an entry the backend could not date is kept, not dropped');
  assert.equal(badDate[0].date,'','a date the backend could not parse normalizes to blank rather than junk');
  assert.equal(sanitizeActivities([{name:'Alex',type:'nope'}]).length,0,'an unknown type is still rejected outright');

  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  assert.equal(computeCredits(sanitizeActivities([{id:'t1',name:'Alex',type:'climb',date:'2026-07-13T07:30:00.000Z',createdAt:'1'}])).info.get('t1').credit,3,'a date with a time component earns credit instead of reading as outside the challenge');

  assert.equal(windowStart('2026-07-13'),'2026-07-07','seven days are inclusive');
  assert.equal(windowStart('2026-07-13',1),'2026-07-13','one-day windows begin today');
  assert.equal(windowStart(''),'','a blank day has no window');
  assert.equal(windowStart('not-a-date'),'','an invalid day has no window');
  assert.equal(windowStart('2026-08-02'),'2026-07-27','window arithmetic crosses month boundaries');

  // Each category scores once per day; a full mix earns the +2 balanced-day bonus.
  const day=[
    {id:'c1',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-13',createdAt:'1'},
    {id:'c2',name:'Alex',type:'climb',hardestGrade:'V6',date:'2026-07-13',createdAt:'2'},
    {id:'e1',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'3'},
    {id:'m1',name:'Alex',type:'mobility',date:'2026-07-13',createdAt:'4'},
  ];
  let scored=computeCredits(day);
  assert.equal(scored.info.get('c1').credit,3,'first climb scores');
  assert.equal(scored.info.get('c2').credit,0,'second same-category same-day earns nothing');
  assert.equal(scored.info.get('c2').reason,'already logged');
  assert.equal(scored.info.get('e1').credit,2);
  assert.equal(scored.info.get('m1').credit,1);
  assert.equal(scored.dayMeter.get('alex|2026-07-13'),8,'balanced day tops the daily meter at 8');
  assert.equal(scored.totals.get('alex'),8);
  assert.equal(scored.weeks.get('alex|2026-07-13'),8);

  const fullDay=day.concat([{id:'b1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'5'},{id:'e2',name:'Alex',type:'exercise',date:'2026-07-14',createdAt:'1'}]);
  scored=computeCredits(fullDay);
  assert.equal(scored.dayTotal.get('alex|2026-07-13'),11,'dayTotal includes categories, the balanced-day bonus, and bounty credit');
  assert.ok(scored.dayTotal.get('alex|2026-07-13')>scored.dayMeter.get('alex|2026-07-13'),'dayTotal does not omit or clamp bounty credit');
  assert.equal([...scored.dayTotal.entries()].filter(x=>x[0].startsWith('alex|')&&weekKey(x[0].slice(5))==='2026-07-13').reduce((sum,x)=>sum+x[1],0),scored.weeks.get('alex|2026-07-13'),'a week of day totals matches its existing weekly total');

  // No balanced-day bonus without all three categories.
  scored=computeCredits(day.filter(x=>x.type!=='mobility'));
  assert.equal(scored.dayMeter.get('alex|2026-07-13'),5,'two categories = 3 + 2, no bonus');

  // Weekly bounty cap: first 6 points count; the rest are bragging rights only.
  const bounties=[
    {id:'b1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'b2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-14',createdAt:'1'},
    {id:'b3',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-15',createdAt:'1'},
  ];
  scored=computeCredits(bounties);
  assert.equal(scored.info.get('b1').credit,3);
  assert.equal(scored.info.get('b2').credit,3,'cap of 6 reached exactly');
  assert.equal(scored.info.get('b3').credit,0,'over-cap bounty earns nothing');
  assert.equal(scored.info.get('b3').reason,'weekly cap');
  assert.equal(scored.bountyWeekCount.get('alex|2026-07-13'),3,'every completion counts toward Bounty Hunter');
  assert.equal(scored.bountyTotal.get('alex'),3,'every completion counts toward the all-time bounty tally, even past the weekly cap');
  assert.equal(scored.totals.get('alex'),6);
  assert.equal(scored.dayTotal.get('alex|2026-07-15'),0,'a weekly-capped bounty contributes zero to dayTotal');

  // totalsModel exposes an all-time bounty count per climber, spanning weeks, for the Bounties leaderboard view.
  const savedLogs=logs;
  logs=[
    {id:'t1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'t2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-20',createdAt:'2'},
    {id:'t3',name:'Bob',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
  ];
  const tm=totalsModel(),tmAlex=tm.sorted.find(r=>r.name==='Alex'),tmBob=tm.sorted.find(r=>r.name==='Bob');
  assert.equal(tmAlex.bountiesTotal,2,'all-time bounty tally spans weeks');
  assert.equal(tmBob.bountiesTotal,1,'each climber gets their own all-time bounty count');
  logs=savedLogs;

  // Entry 68: Bounty Hunter is a trailing seven-day title, while its existing consumers retain
  // their calendar-week counts. Capped claims still compete for the title.
  const savedToday=challengeToday;
  challengeToday=()=> '2026-07-13';
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'},{name:'Bob'},{name:'Cara'}]};
  logs=[
    {id:'r0',name:'Cara',type:'bounty',bountyId:'send-it',date:'2026-07-06',createdAt:'1'},
    {id:'a1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-07',createdAt:'1'},
    {id:'a2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-07',createdAt:'2'},
    {id:'a3',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-07',createdAt:'3'},
    {id:'a4',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'4'},
    {id:'b1',name:'Bob',type:'bounty',bountyId:'send-it',date:'2026-07-07',createdAt:'1'},
    {id:'b2',name:'Bob',type:'bounty',bountyId:'outdoor-send',date:'2026-07-07',createdAt:'2'},
    {id:'b3',name:'Bob',type:'bounty',bountyId:'century-club',date:'2026-07-07',createdAt:'3'},
    {id:'b4',name:'Bob',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'4'},
  ];
  const recentModel=totalsModel(),recentAlex=recentModel.sorted.find(r=>r.name==='Alex'),recentBob=recentModel.sorted.find(r=>r.name==='Bob'),recentCara=recentModel.sorted.find(r=>r.name==='Cara');
  assert.equal(recentAlex.recentBounties,4,'the six-day-old first window day counts');
  assert.equal(recentBob.recentBounties,4,'ties retain every holder');
  assert.equal(recentCara.recentBounties,0,'the seven-day-old claim is outside the inclusive window');
  assert.equal(computeCredits(logs).info.get('a3').credit,0,'a capped claim still enters the rolling title count');
  assert.deepEqual(recentModel.hunters,['Alex','Bob'],'rolling leaders share Bounty Hunter');
  assert.equal(recentModel.huntCount,4,'the title count is the rolling claim count');
  assert.equal(recentAlex.bounties,1,'the existing bounty field remains a calendar-week count');
  logs=[];
  const emptyRecent=totalsModel();
  assert.equal(emptyRecent.huntCount,0,'nobody holds the title without a rolling claim');
  assert.deepEqual(emptyRecent.hunters,[],'the empty rolling title has no holders');
  logs=[
    {id:'c1',name:'Alex',type:'climb',date:'2026-07-07',createdAt:'1'},
    {id:'c2',name:'Alex',type:'climb',date:'2026-07-10',createdAt:'2'},
    {id:'c3',name:'Alex',type:'climb',date:'2026-07-11',createdAt:'3'},
    {id:'c4',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'4'},
    {id:'c5',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'5'},
    {id:'c6',name:'Bob',type:'climb',date:'2026-07-12',createdAt:'1'},
    {id:'c7',name:'Alex',type:'climb',date:'2026-07-06',createdAt:'1'},
    {id:'m1',name:'Cara',type:'mobility',date:'2026-07-13',createdAt:'1'},
  ];
  assert.equal(categoryDays('alex','climb','2026-07-13'),4,'credited days include the first window day and ignore a duplicate same-day log');
  assert.equal(categoryDays('bob','climb','2026-07-13'),1,'another person is excluded from a climber title count');
  assert.equal(categoryDays('nobody','climb','2026-07-13'),0,'unknown names have no credited category days');
  const titleRows=crewTitles('2026-07-13'),crusher=titleRows.find(row=>row.id==='crusher'),yogi=titleRows.find(row=>row.id==='yogi');
  assert.equal(titleRows.length,3,'crewTitles returns exactly the three category titles');
  assert.ok(titleRows.every(row=>!('glyph' in row)),'title rows carry no glyph');
  assert.deepEqual(crusher.holders,['Alex'],'the top category-day holder alone receives Crusher');
  assert.deepEqual(yogi.holders,['Cara'],'one credited mobility day wins Yogi without a minimum');
  logs=[{id:'tie1',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'1'},{id:'tie2',name:'Bob',type:'exercise',date:'2026-07-13',createdAt:'1'}];
  assert.deepEqual(crewTitles('2026-07-13').find(row=>row.id==='gym-rat').holders,['Alex','Bob'],'tied category leaders share a title');
  logs=[];
  assert.ok(crewTitles('2026-07-13').every(row=>row.holders.length===0),'an empty roster leaves every category title unheld');
  const titlesConfig=config;
  config=Object.assign({},config,{crew:[]});
  assert.ok(crewTitles('2026-07-13').every(row=>row.holders.length===0),'an empty configured roster leaves every category title unheld');
  config=titlesConfig;
  logs=[
    {id:'old1',name:'Alex',type:'climb',date:'2026-07-02',createdAt:'1'},
    {id:'old2',name:'Alex',type:'climb',date:'2026-07-03',createdAt:'1'},
    {id:'fire1',name:'Bob',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'fire2',name:'Cara',type:'climb',date:'2026-07-13',createdAt:'1'},
  ];
  const standingModel=totalsModel();
  assert.equal(standingModel.sorted.find(row=>row.name==='Bob').recent,3,'a bounty in the window is included in the rolling points field');
  challengeToday=savedToday;
  logs=savedLogs;

  assert.equal(computeCredits([{id:'before',name:'Alex',type:'climb',date:'2026-06-30'}]).info.get('before').reason,'outside challenge');

  // categoryBreakdown sums CREDITED points per type from computeCredits().info, with the balanced-day bonus as its own row.
  logs=[
    {id:'k1',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'},
    {id:'k2',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'2'},
    {id:'k3',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'3'},
    {id:'k4',name:'Alex',type:'mobility',date:'2026-07-13',createdAt:'4'},
  ];
  let bd=categoryBreakdown('alex');
  const bdRow=t=>bd.rows.find(r=>r.type===t).points;
  assert.equal(bdRow('climb'),3,'duplicate same-day climb credits once, not twice');
  assert.equal(bdRow('exercise'),2);
  assert.equal(bdRow('mobility'),1);
  assert.equal(bdRow('bounty'),0);
  assert.equal(bd.bonus,2,'the balanced-day bonus surfaces as its own row');
  assert.equal(bd.total,8);
  assert.equal(bd.rows.reduce((sum,r)=>sum+r.points,0),bd.total,'rows plus balanced bonus sum to the total');

  // Bounties over the weekly cap contribute at most weeklyBountyCap to the bounty row.
  logs=[
    {id:'q1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'q2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-14',createdAt:'1'},
    {id:'q3',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-15',createdAt:'1'},
  ];
  bd=categoryBreakdown('alex');
  assert.equal(bdRow('bounty'),6,'bounty row is capped at the weekly bounty cap');
  assert.equal(bd.bonus,0,'no balanced day means no bonus');
  assert.equal(bd.total,6);
  assert.equal(bd.rows.reduce((sum,r)=>sum+r.points,0),bd.total,'capped rows still sum to the total');

  // No credited points means an empty breakdown (the render layer shows a single empty state, not zero rows).
  logs=[];
  bd=categoryBreakdown('alex');
  assert.equal(bd.total,0);
  assert.equal(bd.bonus,0);

  // bountyWeekProgress sums CREDITED bounty points for the week of the day passed in.
  logs=[{id:'w1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'}];
  assert.equal(bountyWeekProgress('alex','2026-07-15'),3,'under the cap reports the credited sum');
  logs=[
    {id:'w1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'w2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-14',createdAt:'1'},
  ];
  assert.equal(bountyWeekProgress('alex','2026-07-15'),6,'exactly at the cap reports the full cap');
  logs=[
    {id:'w1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'w2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-14',createdAt:'1'},
    {id:'w3',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-15',createdAt:'1'},
  ];
  assert.equal(bountyWeekProgress('alex','2026-07-15'),6,'over-cap claims add nothing to the credited sum');
  assert.equal(bountyWeekProgress('alex','2026-07-20'),0,'a new week starts back at zero');
  logs.push({id:'w4',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'},{id:'w5',name:'Maya',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'});
  assert.equal(bountyWeekProgress('alex','2026-07-15'),6,'non-bounty entries and other people are ignored');
  logs=[];

  // Entry 46: claimedBounties lists one person's bounty claims, newest-first, resolving the title
  // through the same bountyTitle -> bountyById -> 'Bounty' chain activityMarkup() uses.
  logs=[
    {id:'c1',name:'Alex',type:'bounty',bountyId:'send-it',bountyTitle:'Send It',date:'2026-07-13',createdAt:'1'},
    {id:'c2',name:'Alex',type:'bounty',bountyId:'outdoor-send',bountyTitle:'Outdoor Send',note:'cold rock',date:'2026-07-15',createdAt:'1'},
    {id:'c3',name:'Alex',type:'climb',hardestGrade:'V4',date:'2026-07-16',createdAt:'1'},
    {id:'c4',name:'Maya',type:'bounty',bountyId:'send-it',bountyTitle:'Send It',date:'2026-07-17',createdAt:'1'},
  ];
  let claims=claimedBounties('alex');
  assert.equal(claims.length,2,'only the named person’s bounty entries are listed');
  assert.equal(claims[0].label,'Outdoor Send','newest claim comes first');
  assert.equal(claims[1].label,'Send It','older claim follows it');
  assert.equal(claims[0].note,'cold rock','the note written on the claim is carried through');
  assert.equal(claims[1].note,'','a claim with no note reports an empty string, never undefined');
  assert.equal(claims[0].date,fmtDay('2026-07-15'),'the day is labelled with fmtDay()');
  assert.equal(claims[0].date.indexOf('2026'),-1,'and is the formatted label, not the raw ISO date');
  assert.equal(claims.filter(r=>r.label==='V4').length,0,'climb entries never appear among the claims');

  // Same-day claims fall back to createdAt, the tiebreak activityMarkup() uses.
  logs=[
    {id:'t1',name:'Alex',type:'bounty',bountyId:'send-it',bountyTitle:'Earlier',date:'2026-07-15',createdAt:'1'},
    {id:'t2',name:'Alex',type:'bounty',bountyId:'send-it',bountyTitle:'Later',date:'2026-07-15',createdAt:'2'},
  ];
  assert.equal(claimedBounties('alex')[0].label,'Later','a later createdAt sorts first within one day');

  // The title resolves from bountyId when bountyTitle is absent, and falls back for an unknown id.
  logs=[{id:'c5',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'}];
  assert.equal(claimedBounties('alex')[0].label,bountyById('send-it').title,'a missing bountyTitle resolves through bountyById');
  logs=[{id:'c6',name:'Alex',type:'bounty',bountyId:'not-a-real-bounty',date:'2026-07-13',createdAt:'1'}];
  assert.equal(claimedBounties('alex')[0].label,'Bounty','an unknown bountyId falls back to a plain label rather than throwing');
  logs=[{id:'c7',name:'Alex',type:'bounty',date:'2026-07-13',createdAt:'1'}];
  assert.equal(claimedBounties('alex')[0].label,'Bounty','a claim with no id at all still lists');

  // Entry 50: claimedBounties also reports what each claim scored, read out of computeCredits()
  // rather than re-derived, so a claim past the weekly cap shows its reduced or zero credit.
  logs=[
    {id:'p1',name:'Alex',type:'bounty',bountyId:'send-it',bountyTitle:'Send It',date:'2026-07-13',createdAt:'1'},
    {id:'p2',name:'Alex',type:'bounty',bountyId:'outdoor-send',bountyTitle:'Outdoor Send',date:'2026-07-14',createdAt:'1'},
    {id:'p3',name:'Alex',type:'bounty',bountyId:'century-club',bountyTitle:'Century Club',date:'2026-07-15',createdAt:'1'},
  ];
  let capped=claimedBounties('alex'),byLabel=name=>capped.find(r=>r.label===name);
  assert.equal(capped.length,3);
  assert.equal(byLabel('Send It').base,3,"base is the bounty's face value");
  assert.equal(byLabel('Send It').credit,3,'the first claim of the week is fully credited');
  assert.equal(byLabel('Outdoor Send').credit,3,'the second claim fills the rest of the weekly cap');
  assert.equal(byLabel('Century Club').base,3,'base stays the face value even once the week is capped');
  assert.equal(byLabel('Century Club').credit,0,'a claim past the weekly cap credits nothing');

  // A claim outside the challenge window credits zero; base is still the bounty's face value.
  logs=[{id:'p4',name:'Alex',type:'bounty',bountyId:'send-it',bountyTitle:'Send It',date:'2026-06-01',createdAt:'1'}];
  let outside=claimedBounties('alex')[0];
  assert.equal(outside.base,3,'base is unaffected by being outside the window');
  assert.equal(outside.credit,0,'a claim outside the challenge window credits nothing');

  // Nobody, and no claims, both come back empty rather than undefined.
  logs=[{id:'c8',name:'Maya',type:'bounty',bountyId:'send-it',bountyTitle:'Send It',date:'2026-07-13',createdAt:'1'}];
  // deepEqual against a literal is avoided here on purpose: length is enough and cannot trip the
  // cross-realm array comparison this vm harness is prone to.
  assert.equal(claimedBounties('alex').length,0,'a person with no claims of their own gets an empty list');
  assert.equal(claimedBounties('').length,0,'a blank name matches nobody, not the crew');
  logs=[];
  assert.equal(claimedBounties('alex').length,0,'an empty log yields no claims');

  // Entry 61: today's claim state names only bounties this person actually logged today.
  logs=[
    {id:'today1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'},
    {id:'today2',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'2'},
    {id:'other',name:'Maya',type:'bounty',bountyId:'outdoor-send',date:'2026-07-13',createdAt:'1'},
    {id:'before',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-12',createdAt:'1'},
  ];
  let todayClaims=claimedTodayIds('alex','2026-07-13');
  assert.equal(claimedTodayIds('nobody','2026-07-13').size,0,'an unknown name has no claimed bounties');
  assert.equal(todayClaims.has('send-it'),true,'the person’s bounty claim is included');
  assert.equal(todayClaims.has('outdoor-send'),false,'another person’s claim is excluded');
  assert.equal(todayClaims.has('century-club'),false,'the person’s claim on another day is excluded');
  assert.equal(todayClaims.size,1,'two claims of one bounty on the same day stay one id');
  logs=[];

  // Entry 58: the claimed-list caption counts claims and sums credited points, not face value.
  assert.equal(claimedCaption([]),'','an empty claimed list has no caption');
  assert.equal(claimedCaption([{credit:3},{credit:2}]),'2 claims · 5 points counted','multiple claims total their credited points and pluralise claims');
  assert.equal(claimedCaption([{credit:1}]),'1 claim · 1 point counted','one claim and one point are singular');
  assert.equal(claimedCaption([{base:3,credit:1}]),'1 claim · 1 point counted','a capped claim contributes credit rather than base');

  // Entry 54: personRecent lists one person's most recent log entries across every type, newest
  // first with the same date/createdAt tiebreak claimedBounties() uses, resolving a bounty title
  // through the same bountyTitle -> bountyById -> 'Bounty' chain.
  logs=[
    {id:'r1',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-10',createdAt:'1'},
    {id:'r2',name:'Alex',type:'exercise',date:'2026-07-11',createdAt:'1'},
    {id:'r3',name:'Alex',type:'mobility',date:'2026-07-12',createdAt:'1'},
    {id:'r4',name:'Alex',type:'bounty',bountyId:'send-it',bountyTitle:'Send It',date:'2026-07-13',createdAt:'1'},
    {id:'r5',name:'Alex',type:'climb',date:'2026-07-14',createdAt:'1'},
    {id:'r6',name:'Maya',type:'climb',hardestGrade:'V9',date:'2026-07-15',createdAt:'1'},
  ];
  let recent=personRecent('alex');
  assert.equal(recent.length,5,'Maya is excluded, leaving all 5 of Alex rows within the default limit');
  assert.deepEqual(recent.map(r=>r.label),['Climbing','Send It','Mobility','Exercise','Climbing · V5'],'newest first, an ungraded climb has no grade suffix, and a graded one does');
  assert.equal(recent[0].value,fmtDay('2026-07-14'),'the day is labelled with fmtDay(), not the raw ISO date');
  assert.equal(recent.filter(r=>r.label.indexOf('V9')>=0).length,0,'a crewmate entry never appears among the rows');
  let limited=personRecent('alex',2);
  assert.equal(limited.length,2,'limit caps the row count');
  assert.deepEqual(limited.map(r=>r.label),['Climbing','Send It'],'limit keeps only the newest rows');

  // The title resolves from bountyId when bountyTitle is absent, and falls back for a missing id.
  logs=[{id:'r7',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'}];
  assert.equal(personRecent('alex')[0].label,bountyById('send-it').title,'a missing bountyTitle resolves through bountyById');
  logs=[{id:'r8',name:'Alex',type:'bounty',date:'2026-07-13',createdAt:'1'}];
  assert.equal(personRecent('alex')[0].label,'Bounty','a claim with no id at all still lists');

  // Same-day entries fall back to createdAt, newest first, exactly as claimedBounties() does.
  logs=[
    {id:'r9',name:'Alex',type:'climb',hardestGrade:'V1',date:'2026-07-13',createdAt:'1'},
    {id:'r10',name:'Alex',type:'climb',hardestGrade:'V2',date:'2026-07-13',createdAt:'2'},
  ];
  assert.equal(personRecent('alex')[0].label,'Climbing · V2','a later createdAt sorts first within one day');

  // Nobody, a blank name, and an empty log all come back empty rather than undefined.
  logs=[{id:'r11',name:'Maya',type:'climb',hardestGrade:'V9',date:'2026-07-13',createdAt:'1'}];
  assert.equal(personRecent('alex').length,0,'a person with no entries of their own gets an empty list');
  assert.equal(personRecent('').length,0,'a blank name matches nobody, not the crew');
  logs=[];
  assert.equal(personRecent('alex').length,0,'an empty log yields no rows');

  // gradePyramid counts ALL of the person's graded climb logs, hardest-first by GRADES index.
  logs=[
    {id:'g1',name:'Alex',type:'climb',hardestGrade:'V9',date:'2026-07-13',createdAt:'1'},
    {id:'g2',name:'Alex',type:'climb',hardestGrade:'V10',date:'2026-07-14',createdAt:'1'},
    {id:'g3',name:'Alex',type:'climb',hardestGrade:'V2',date:'2026-07-14',createdAt:'2'},
  ];
  let pyramid=gradePyramid('alex');
  assert.deepEqual(pyramid.map(r=>r.grade),['V10','V9','V2'],'V10 sorts above V9 by GRADES index, not string comparison');
  logs=[
    {id:'g1',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-13',createdAt:'1'},
    {id:'g2',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-13',createdAt:'2'},
    {id:'g3',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-06-01',createdAt:'1'},
    {id:'g4',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'3'},
    {id:'g5',name:'Alex',type:'climb',hardestGrade:'',date:'2026-07-14',createdAt:'1'},
    {id:'g6',name:'Alex',type:'climb',hardestGrade:'5.12a',date:'2026-07-14',createdAt:'2'},
    {id:'g7',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'4'},
    {id:'g8',name:'Maya',type:'climb',hardestGrade:'V4',date:'2026-07-13',createdAt:'1'},
    {id:'g9',name:'Alex',type:'climb',hardestGrade:'V4',date:'2026-07-15',createdAt:'1'},
  ];
  pyramid=gradePyramid('alex');
  assert.deepEqual(pyramid,[{grade:'V5',count:3},{grade:'V4',count:1}],'zero-credit same-day duplicates and outside-window sends count; blank or unknown grades, other types, and other people are ignored');
  logs=[];
  assert.deepEqual(gradePyramid('alex'),[],'no graded climbs yields an empty pyramid');

  // personalRecords: hardest grade compares by GRADES INDEX (never string), hardest this week filters by weekKey(today),
  // best day/week come from computeCredits maxima; today is an ARGUMENT, never the clock.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[
    {id:'pr1',name:'Alex',type:'climb',hardestGrade:'V2',date:'2026-07-06',createdAt:'1'},
    {id:'pr2',name:'Alex',type:'climb',hardestGrade:'V10',date:'2026-07-13',createdAt:'2'},
    {id:'pr3',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'3'},
    {id:'pr4',name:'Alex',type:'mobility',date:'2026-07-13',createdAt:'4'},
  ];
  let rec=personalRecords('alex','2026-07-15');
  assert.equal(rec.hasLog,true,'a person with logs shows the card');
  assert.equal(rec.graded,true,'a graded climb enables the grade rows');
  assert.equal(rec.hardest,'V10','V10 beats V2 by GRADES index, not lexicographically');
  assert.equal(rec.hardestWeek,'V10','the week of 2026-07-15 (Mon 07-13) holds the V10 send');
  assert.equal(rec.bestDay,8,'best single day is the dayTotal max — this balanced day totals 8');
  assert.equal(rec.bestWeek,8,'best week is the weeks-map max');
  rec=personalRecords('alex','2026-07-08');
  assert.equal(rec.hardest,'V10','hardest ever ignores the week filter');
  assert.equal(rec.hardestWeek,'V2','hardest this week follows weekKey(today) — the week of 07-08 (Mon 07-06) holds only V2');
  logs=[{id:'ng1',name:'Maya',type:'exercise',date:'2026-07-13',createdAt:'1'}];
  rec=personalRecords('maya','2026-07-15');
  assert.equal(rec.hasLog,true);
  assert.equal(rec.graded,false,'no graded climbs suppresses the grade rows');
  assert.equal(rec.hardest,'','no hardest grade without a graded climb');
  assert.equal(rec.hardestWeek,'');
  assert.equal(rec.bestDay,2,'best day still reports once the person has any log');
  assert.equal(rec.bestWeek,2,'best week still reports once the person has any log');
  logs=[{id:'u1',name:'Uno',type:'climb',hardestGrade:'5.12a',date:'2026-07-13',createdAt:'1'}];
  rec=personalRecords('uno','2026-07-15');
  assert.equal(rec.graded,false,'an unknown grade string is not a graded climb');
  assert.equal(rec.hardest,'','blank or unknown grades never surface as a record');
  assert.equal(rec.bestDay,3,'the climb still credits points without a valid grade');
  logs=[];
  rec=personalRecords('alex','2026-07-15');
  assert.equal(rec.hasLog,false,'no logs hides the whole card');
  assert.equal(rec.graded,false);
  assert.equal(rec.bestDay,0);
  assert.equal(rec.bestWeek,0);

  // streakInfo counts consecutive days with >=1 credited point in dayTotal; today is an ARGUMENT, never the clock.
  logs=[{id:'s1',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'}];
  assert.deepEqual(streakInfo('alex','2026-07-13'),{current:1,best:1},'a single active day is a one-day streak');
  logs=[
    {id:'s1',name:'Alex',type:'climb',date:'2026-07-10',createdAt:'1'},
    {id:'s2',name:'Alex',type:'climb',date:'2026-07-11',createdAt:'1'},
    {id:'s3',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'},
  ];
  assert.deepEqual(streakInfo('alex','2026-07-13'),{current:1,best:2},'a gap resets the current streak while best remembers the longer run');
  logs=[
    {id:'s1',name:'Alex',type:'climb',date:'2026-07-12',createdAt:'1'},
    {id:'s2',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'},
  ];
  assert.deepEqual(streakInfo('alex','2026-07-14'),{current:2,best:2},'a zero-point today keeps yesterday-anchored streaks alive until the day ends');
  logs=[{id:'s1',name:'Alex',type:'climb',date:'2026-07-10',createdAt:'1'}];
  assert.deepEqual(streakInfo('alex','2026-07-13'),{current:0,best:1},'empty today AND yesterday means no current streak');
  logs=[
    {id:'s1',name:'Alex',type:'climb',date:'2026-07-05',createdAt:'1'},
    {id:'s2',name:'Alex',type:'exercise',date:'2026-07-06',createdAt:'1'},
    {id:'s3',name:'Alex',type:'mobility',date:'2026-07-07',createdAt:'1'},
    {id:'s4',name:'Alex',type:'climb',date:'2026-07-12',createdAt:'1'},
    {id:'s5',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'},
  ];
  assert.deepEqual(streakInfo('alex','2026-07-13'),{current:2,best:3},'best streak takes the longer of two separate runs');
  logs=[
    {id:'s1',name:'Alex',type:'climb',date:'2026-06-30',createdAt:'1'},
    {id:'s2',name:'Alex',type:'climb',date:'2026-07-01',createdAt:'1'},
    {id:'s3',name:'Maya',type:'climb',date:'2026-06-29',createdAt:'1'},
  ];
  assert.deepEqual(streakInfo('alex','2026-07-01'),{current:1,best:1},'days before the challenge start and other people never count');
  logs=[];
  assert.deepEqual(streakInfo('alex','2026-07-13'),{current:0,best:0},'no activity means no streaks');

  // heatLevel buckets intensity relative to DAILY_MAX: 0 / 1-2 / 3-5 / 6-7 / max.
  assert.equal(heatLevel(0),0,'zero points is the coldest bucket');
  assert.equal(heatLevel(1),1);
  assert.equal(heatLevel(2),1);
  assert.equal(heatLevel(3),2);
  assert.equal(heatLevel(5),2);
  assert.equal(heatLevel(6),3);
  assert.equal(heatLevel(7),3);
  assert.equal(heatLevel(8),4,'a full balanced day hits the hottest bucket');

  // heatmapDays enumerates config.startDate through min(tripDate, today); today is an ARGUMENT, never the clock.
  config={startDate:'2026-07-13',tripDate:'2026-07-13',goal:500,crew:[]};
  logs=[{id:'h1',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'}];
  assert.deepEqual(heatmapDays('alex','2026-07-13'),[{date:'2026-07-13',points:3}],'a one-day window yields exactly one cell');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[
    {id:'h1',name:'Alex',type:'climb',date:'2026-07-02',createdAt:'1'},
    {id:'h2',name:'Alex',type:'exercise',date:'2026-07-10',createdAt:'1'},
    {id:'h3',name:'Maya',type:'climb',date:'2026-07-03',createdAt:'1'},
  ];
  let heat=heatmapDays('alex','2026-07-15');
  assert.equal(heat.length,15,'a multi-week span is capped at today, not the trip date');
  assert.equal(heat[0].date,'2026-07-01','the span starts at the challenge start');
  assert.equal(heat[14].date,'2026-07-15','the span ends at today');
  assert.equal(heat[1].points,3,'points come from dayTotal');
  assert.equal(heat[9].points,2);
  assert.equal(heat[2].points,0,'other people never color your cells');
  assert.equal(heatmapDays('alex','2026-08-15').length,31,'after the trip the span caps at the trip date');
  assert.deepEqual(heatmapDays('alex','2026-06-30'),[],'before the start there is nothing to draw');
  assert.deepEqual(heatmapDays('alex','garbage'),[],'an unparseable today yields no cells');
  config={startDate:'',tripDate:'2026-07-31',goal:500,crew:[]};
  assert.deepEqual(heatmapDays('alex','2026-07-15'),[],'a missing start date yields no cells');
  config={startDate:'2026-07-31',tripDate:'2026-07-01',goal:500,crew:[]};
  assert.deepEqual(heatmapDays('alex','2026-07-15'),[],'an inverted window yields no cells');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[];

  // Entry 86: bounty credit belongs in daily totals but deliberately leaves the category meter empty.
  logs=[
    {id:'b1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-12',createdAt:'1'},
    {id:'b2',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-12',createdAt:'2'},
    {id:'b3',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'3'},
  ];
  const bountyCredits=computeCredits(logs),bountyDay=bountyCredits.dayTotal.get('alex|2026-07-12')||0,bountyHeat=heatmapDays('alex','2026-07-13').find(x=>x.date==='2026-07-12');
  assert.equal(bountyCredits.dayMeter.get('alex|2026-07-12')||0,0,'bounties do not fill the category meter');
  assert.equal(bountyDay,6,'the bounty-only day retains its credited points');
  assert.equal(bountyHeat.points,bountyDay,'the heatmap reads the uncapped daily total');
  assert.ok(heatLevel(bountyHeat.points)>0,'a bounty-only day has a visible heat level');
  assert.ok(heatmapCaption([bountyHeat]).indexOf('1 active day')>=0,'the bounty-only day counts as active in the caption');
  assert.deepEqual(streakInfo('alex','2026-07-13'),{current:2,best:2},'a bounty-only day continues the streak');
  assert.equal(personalRecords('alex','2026-07-13').bestDay,bountyDay,'best day includes bounty-only credit');
  me='Alex';
  assert.equal(weekReviewModel('2026-07-15').mine.activeDays,1,'Week in Review counts the previous week bounty-only day as active');
  me='';

  // Entry 74: every challenge day gets a rolling seven-day point, including quiet days.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  const curveBounty=SCORING.bounties[0];
  logs=[
    {id:'m1',name:'Alex',type:'climb',date:'2026-07-01',createdAt:'1'},
    {id:'m2',name:'Alex',type:'exercise',date:'2026-07-03',createdAt:'2'},
    {id:'m3',name:'Alex',type:'bounty',bountyId:curveBounty.id,date:'2026-07-05',createdAt:'3'},
    {id:'m4',name:'Maya',type:'climb',date:'2026-07-05',createdAt:'4'},
  ];
  let curve=momentumCurve('alex','2026-07-05');
  assert.equal(curve.length,5,'the curve has one point per challenge day through today');
  assert.equal(Object.keys(curve[0]).sort().join('|'),'date|label|points','each curve point names its date, label, and total');
  assert.deepEqual(curve.map(r=>r.date),['2026-07-01','2026-07-02','2026-07-03','2026-07-04','2026-07-05'],'the curve neither skips a challenge day nor reaches beyond today');
  assert.deepEqual(curve.map(r=>r.points),[3,3,5,5,8],'each point sums that person dayTotal over the trailing truncated window, including bounty credit');
  curve=momentumCurve('alex','2026-07-10');
  assert.equal(curve[curve.length-1].points,3,'the seventh prior day is excluded once a full window has moved past it');
  assert.equal(momentumCurve('nobody','2026-07-05').length,5,'a person with no logs still gets an all-zero curve');
  assert.equal(momentumCurve('nobody','2026-07-05').every(r=>r.points===0),true,'the all-zero curve is not an empty chart');
  assert.equal(momentumCurve('alex','2026-08-05').length,31,'the curve stops at tripDate when today has passed it');
  assert.deepEqual(momentumCurve('alex','2026-06-30'),[],'before the challenge there is no curve');
  assert.deepEqual(momentumCurve('alex','garbage'),[],'an invalid date yields no curve');
  assert.equal(weeklyTrend('2026-07-05')[4].points,11,'the crew chart uses the same helper and includes every person');
  assert.equal(personalWeeklyTrend('alex','2026-07-05')[4].points,8,'the personal wrapper stays scoped to that climber');
  // Entry 96: a one-pass bucket and sliding window preserve the former per-day map scan exactly,
  // including the partial first week, a day-one crew point, and a person with only one logged day.
  logs=[
    {id:'full-a1',name:'Alex',type:'climb',date:'2026-07-01',createdAt:'1'},
    {id:'full-a2',name:'Alex',type:'exercise',date:'2026-07-03',createdAt:'2'},
    {id:'full-a3',name:'Alex',type:'mobility',date:'2026-07-08',createdAt:'3'},
    {id:'full-a4',name:'Alex',type:'bounty',bountyId:curveBounty.id,date:'2026-07-15',createdAt:'4'},
    {id:'full-a5',name:'Alex',type:'climb',date:'2026-07-31',createdAt:'5'},
    {id:'full-m1',name:'Maya',type:'climb',date:'2026-07-01',createdAt:'6'},
  ];
  const previousCurve=(name,today)=>{const key=String(name||'').toLowerCase(),model=computeCredits(logs),last=today<config.tripDate?today:config.tripDate,rows=[];let day=config.startDate;while(day<=last){let points=0,start=windowStart(day);model.dayTotal.forEach((value,dayKey)=>{const cut=dayKey.lastIndexOf('|'),rowName=dayKey.slice(0,cut),date=dayKey.slice(cut+1);if(date>=start&&date<=day&&(!key||rowName===key))points+=value});rows.push({date:day,label:fmtDay(day),points});const next=parseDateOnly(day);next.setDate(next.getDate()+1);day=localDate(next)}return rows};
  assert.deepEqual(momentumCurve('alex','2026-07-31'),previousCurve('alex','2026-07-31'),'the full personal challenge curve matches the former map scan');
  assert.deepEqual(momentumCurve('','2026-07-31'),previousCurve('','2026-07-31'),'the full crew curve keeps the day-one and single-log crew points');
  logs=[{id:'pipe1',name:'Alex|Jr',type:'climb',date:'2026-07-01',createdAt:'1'}];
  assert.equal(weeklyTrend('2026-07-01')[0].points,3,'a crew name containing a pipe still aggregates into its curve');
  assert.equal(personalWeeklyTrend('alex|jr','2026-07-01')[0].points,3,'a personal curve keeps credited points for a name containing a pipe');
  config={startDate:'',tripDate:'2026-07-31',goal:500,crew:[]};
  assert.deepEqual(momentumCurve('alex','2026-07-15'),[],'a missing start date yields no curve');
  config={startDate:'2026-07-31',tripDate:'2026-07-01',goal:500,crew:[]};
  assert.deepEqual(momentumCurve('alex','2026-07-15'),[],'an inverted challenge yields no curve');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[];

  // Entry 36: the captions state the per-datum facts that only ever lived in a title= attribute --
  // invisible on touch. They are additive: both graphics keep their own container aria-label.
  assert.equal(heatmapCaption([]),'','no days means no caption');
  assert.equal(heatmapCaption([{date:'2026-07-01',points:0},{date:'2026-07-02',points:0}]),'','days with no points means no caption');
  const oneDayCap=heatmapCaption([{date:'2026-07-01',points:1}]);
  assert.ok(oneDayCap.indexOf('1 point ')>=0,'a single point is singular');
  assert.ok(oneDayCap.indexOf('1 active day')>=0&&oneDayCap.indexOf('1 active days')<0,'and a single active day has no stray plural');
  const capDays=heatmapCaption([{date:'2026-07-01',points:3},{date:'2026-07-02',points:0},{date:'2026-07-03',points:8}]);
  assert.ok(capDays.indexOf(fmtDay('2026-07-03'))>=0,'the caption names the best day');
  assert.ok(capDays.indexOf('8 points')>=0,'and what that day scored');
  assert.ok(capDays.indexOf('2 active days')>=0,'and how many days were active');
  assert.equal(trendCaption([]),'','no days means no curve caption');
  const capDaysCurve=trendCaption([{date:'2026-07-01',label:'Jul 1',points:12},{date:'2026-07-02',label:'Jul 2',points:31},{date:'2026-07-03',label:'Jul 3',points:5}]);
  assert.ok(capDaysCurve.indexOf('Peak Jul 2')===0&&capDaysCurve.indexOf('31 points')>=0,'the trend caption names the peak day and value');
  assert.ok(capDaysCurve.indexOf('current 5 points')>=0,'and reports the current value without weekly wording');
  assert.ok(trendCaption([{date:'2026-07-01',label:'Jul 1',points:1}]).indexOf('1 point ')>=0,'a single point is singular here too');

  // Entry 51: the grade pyramid gets the same plain-text caption treatment as the heatmap and
  // trend charts, naming the total graded sends and the hardest grade.
  assert.equal(pyramidCaption([]),'','no rows means no caption');
  const oneSendCap=pyramidCaption([{grade:'V4',count:1}]);
  assert.ok(oneSendCap.indexOf('1 graded send ')>=0,'a single send is singular');
  assert.ok(oneSendCap.indexOf('sends')<0,'and has no stray plural');
  assert.ok(oneSendCap.indexOf('V4')>=0,'and names the hardest grade');
  const multiCap=pyramidCaption([{grade:'V5',count:2},{grade:'V3',count:3},{grade:'V1',count:1}]);
  assert.ok(multiCap.indexOf('6 graded sends')>=0,'the caption totals sends across every grade');
  assert.ok(multiCap.indexOf('V5')>=0,'and names rows[0].grade as the hardest, not the most frequent');

  // Entry 60: both pyramid containers use one label helper, including the person-card empty state.
  assert.equal(pyramidLabel([]),'Grade pyramid: no graded climbs yet','an empty pyramid still has a useful text alternative');
  assert.equal(pyramidLabel([{grade:'V5',count:1},{grade:'V3',count:2}]),'Grade pyramid: 1 send at V5, 2 sends at V3','the label preserves order and singular/plural sends');

  // Entry 83: live regions leave unchanged text nodes alone.
  let textValue='before',textWrites=0;
  const textNode={get textContent(){return textValue},set textContent(value){textWrites++;textValue=value}};
  setText(textNode,'before');
  assert.equal(textWrites,0,'the text guard skips an identical value');
  setText(textNode,'after');
  assert.equal(textWrites,1,'the text guard writes a changed value');
  assert.equal(textValue,'after','the text guard preserves the changed text');

  // Entry 41: dailyBounties() hashes the date, so every future day's picks are already computable.
  // Someone planning a Thursday session can now see what Thursday offers.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  const week=upcomingBounties('2026-07-10');
  assert.equal(week.length,7,'a mid-challenge day previews the next seven days');
  assert.equal(week[0].date,'2026-07-11','starting with tomorrow, not today');
  assert.equal(week[6].date,'2026-07-17','through the seventh day out');
  assert.ok(week.every(d=>d.bounties.length===CATEGORIES.length),'each day offers one bounty per category');
  assert.equal(week[0].label,fmtDay('2026-07-11'),'each day is labelled the way the rest of the app labels dates');
  assert.equal(week[0].bounties.map(b=>b.id).join(','),dailyBounties('2026-07-11').map(b=>b.id).join(','),'the picks are exactly what that day will actually offer');
  assert.equal(upcomingBounties('2026-07-10')[3].bounties.map(b=>b.id).join(','),week[3].bounties.map(b=>b.id).join(','),'and the same date always yields the same picks');
  // The walk stops at the trip date rather than running past the end of the challenge.
  assert.equal(upcomingBounties('2026-07-28').length,3,'a day near the end previews only the days that remain');
  assert.equal(upcomingBounties('2026-07-31').length,0,'and the last day previews nothing');
  assert.equal(upcomingBounties('2026-08-04').length,0,'nor does a day past the end');
  assert.equal(upcomingBounties('').length,0,'an unparseable day previews nothing');

  // Rotating bounties are deterministic and offer one per category.
  const today=dailyBounties('2026-07-16');
  assert.equal(today.length,3);
  assert.equal(today.map(b=>b.category).join(','),'climb,exercise,mobility');
  assert.equal(dailyBounties('2026-07-16').map(b=>b.id).join(','),today.map(b=>b.id).join(','),'same date yields the same bounties');
  assert.notEqual(dailyBounties('2026-07-17').map(b=>b.id).join(','),today.map(b=>b.id).join(','),'a different day rotates the set');

  // dailyBounties is a pure function of the date string across a two-week span.
  const spanSets=[];
  for(let i=0;i<14;i++){
    const key=localDate(new Date(2026,6,1+i)),ids=dailyBounties(key).map(b=>b.id).join(',');
    assert.equal(dailyBounties(key).map(b=>b.id).join(','),ids,'repeated calls agree for '+key);
    assert.equal(dailyBounties(key).map(b=>b.category).join(','),'climb,exercise,mobility','exactly one bounty per category on '+key);
    spanSets.push(ids);
  }
  assert.ok(new Set(spanSets).size>=2,'at least two distinct daily sets appear over 14 days');

  // A crafted roster where Weekly and Overall orderings differ yields different row order.
  const roster=[{name:'A',week:1,total:30},{name:'B',week:2,total:20},{name:'C',week:9,total:5},{name:'D',week:0,total:40}];
  const weekRanked=rankLeaders(roster,'week'),totalRanked=rankLeaders(roster,'total');
  assert.equal(weekRanked[0].name,'C','weekly ranking leads with the highest week');
  assert.equal(totalRanked[0].name,'D','overall ranking leads with the highest total');
  assert.notEqual(weekRanked.map(x=>x.name).join(','),totalRanked.map(x=>x.name).join(','),'the weekly and overall row orders are different');

  // Leaderboard week-trend arrows: prevWeekKey steps back one Monday-aligned week; today is an ARGUMENT.
  assert.equal(prevWeekKey('2026-07-13'),'2026-07-06','a Monday resolves to the prior week key');
  assert.equal(prevWeekKey('2026-07-19'),'2026-07-06','a Sunday shares its week, so the prior week matches the Monday');
  assert.equal(prevWeekKey('2026-07-20'),'2026-07-13','crossing the Monday boundary advances the previous week too');
  assert.equal(prevWeekKey('garbage'),'','an unparseable today yields no previous week');

  // weekTrend compares adjacent seven-day dayTotal windows, including bounty credit, and stays quiet
  // until the earlier window reaches the challenge.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  const trendBounty=SCORING.bounties[0];
  logs=[
    {id:'a1',name:'Alex',type:'climb',date:'2026-07-02',createdAt:'1'},
    {id:'a2',name:'Alex',type:'climb',date:'2026-07-15',createdAt:'2'},
    {id:'u1',name:'Up',type:'climb',date:'2026-07-02',createdAt:'3'},
    {id:'u2',name:'Up',type:'climb',date:'2026-07-15',createdAt:'4'},
    {id:'u3',name:'Up',type:'exercise',date:'2026-07-15',createdAt:'5'},
    {id:'d1',name:'Down',type:'climb',date:'2026-07-02',createdAt:'6'},
    {id:'d2',name:'Down',type:'exercise',date:'2026-07-02',createdAt:'7'},
    {id:'d3',name:'Down',type:'climb',date:'2026-07-15',createdAt:'8'},
    {id:'b1',name:'Bounty',type:'bounty',bountyId:trendBounty.id,date:'2026-07-15',createdAt:'9'},
    {id:'o1',name:'Outside',type:'climb',date:'2026-07-01',createdAt:'10'},
  ];
  assert.equal(weekTrend('alex','2026-07-15'),'even','a day 13 days old falls in the earlier window, making equal totals even');
  assert.equal(weekTrend('up','2026-07-15'),'up','more points in the recent window is up');
  assert.equal(weekTrend('down','2026-07-15'),'down','fewer points in the recent window is down');
  assert.equal(weekTrend('bounty','2026-07-15'),'up','a recent bounty moves the arrow through dayTotal');
  assert.equal(weekTrend('outside','2026-07-15'),'even','a day 14 days old falls outside both windows');
  assert.equal(weekTrend('alex','2026-07-07'),null,'the first challenge week is suppressed while the earlier window is before the start');

  // weeksUntilDone counts inclusive days from today through tripDate, rounded up to whole weeks; today is an ARGUMENT.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  assert.deepEqual(weeksUntilDone('2026-07-15'),{days:17,weeks:3},'mid-challenge counts inclusive days and rounds up');
  assert.deepEqual(weeksUntilDone('2026-07-28'),{days:4,weeks:1},'the closing days collapse to a single final week');
  assert.deepEqual(weeksUntilDone('2026-07-31'),{days:1,weeks:1},'the final day still reads as one week left');
  assert.deepEqual(weeksUntilDone('2026-08-05'),{done:true},'a date past the end marks the challenge complete');
  assert.equal(weeksUntilDone('garbage'),null,'an unparseable today yields no countdown');

  // weekReviewModel summarizes the PREVIOUS week: crew top-3 by points, bounty hunter by bounty count, and the viewer's own recap.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'},{name:'Bob'},{name:'Cara'}]};
  logs=[
    {id:'x1',name:'Alex',type:'climb',hardestGrade:'V3',date:'2026-07-07',createdAt:'1'}, // prev wk
    {id:'x2',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-08',createdAt:'2'},
    {id:'x3',name:'Alex',type:'climb',hardestGrade:'V4',date:'2026-07-09',createdAt:'3'}, // Alex prev wk: 9 pts, 3 days, hardest V5
    {id:'x4',name:'Alex',type:'climb',hardestGrade:'V6',date:'2026-07-15',createdAt:'4'}, // THIS week — must be ignored
    {id:'y1',name:'Bob',type:'climb',date:'2026-07-07',createdAt:'5'},
    {id:'y2',name:'Bob',type:'exercise',date:'2026-07-07',createdAt:'6'},
    {id:'y3',name:'Bob',type:'bounty',bountyId:'send-it',date:'2026-07-07',createdAt:'7'},
    {id:'y4',name:'Bob',type:'bounty',bountyId:'send-it',date:'2026-07-08',createdAt:'8'}, // Bob prev wk: 5 + 6 (cap) = 11, 2 bounties
    {id:'z1',name:'Cara',type:'mobility',date:'2026-07-07',createdAt:'9'},
    {id:'z2',name:'Cara',type:'bounty',bountyId:'send-it',date:'2026-07-07',createdAt:'10'}, // Cara prev wk: 4, 1 bounty
  ];
  me='Alex';
  const wr=weekReviewModel('2026-07-15');
  assert.equal(wr.prevWk,'2026-07-06','the review targets the Monday-aligned previous week');
  assert.deepEqual(wr.leaders.map(x=>x.name+':'+x.points),['Bob:11','Alex:9','Cara:4'],'top-3 point earners are ranked by previous-week points');
  assert.deepEqual(wr.hunters,['Bob'],'the bounty hunter is whoever claimed the most bounties last week');
  assert.equal(wr.huntCount,2,'the hunter count reflects bounty claims, not capped points');
  assert.equal(wr.mine.points,9,'the viewer recap excludes this-week activity');
  assert.equal(wr.mine.activeDays,3,'active days count distinct scoring days last week');
  assert.equal(wr.mine.hardest,'V5','the hardest grade compares by GRADES index, not string');
  assert.deepEqual(wr.weeksLeft,{days:17,weeks:3},'the review carries the countdown');

  // A brand-new viewer with no history still gets the crew highlights and a zeroed personal recap.
  me='Ghost';
  const wrNew=weekReviewModel('2026-07-15');
  assert.equal(wrNew.mine.points,0,'a viewer with no previous-week activity recaps zero points');
  assert.equal(wrNew.mine.hardest,'','no climbs means no hardest grade');
  assert.deepEqual(wrNew.leaders.map(x=>x.name),['Bob','Alex','Cara'],'crew highlights still appear for a brand-new viewer');

  // The challenge's opening week has no prior week of data — highlights fall back to empty, not error.
  const wrFirst=weekReviewModel('2026-07-02');
  assert.deepEqual(wrFirst.leaders,[],'the first week shows no previous leaders');
  assert.deepEqual(wrFirst.hunters,[],'the first week shows no previous bounty hunter');
  me='';

  assert.equal(weekKey('2026-07-13'),'2026-07-13');
  assert.equal(weekKey('2026-07-19'),'2026-07-13');
  assert.equal(dateInTimeZone(new Date('2026-03-08T07:30:00Z'),'America/Los_Angeles'),'2026-03-07');

  const parsed=parseRemoteConfig({startDate:'2026-07-01',tripDate:'2026-07-31',goal:750,crew:[{name:'Alex'},'alex',{name:'Maya'}]},[]);
  assert.equal(parsed.value.crew.length,2,'crew names are canonicalized case-insensitively');
  assert.equal(parsed.value.crew.map(x=>x.name).join(','),'Alex,Maya');
  assert.equal(parsed.value.crew[0].pullMode,undefined,'participants are name-only');
  assert.throws(()=>unpackRemote({version:8,features:[],activities:[],config:null}),/version/,'v8 requires redeployment');
  assert.throws(()=>unpackRemote({version:9,features:[],activities:[],config:null}),/version/,'v9 requires redeployment');
  assert.throws(()=>unpackRemote({version:10,features:[],activities:[],config:null}),/version/,'v10 requires redeployment: its catalog predates the current bounty rotation');
  assert.equal(unpackRemote({version:11,features:['categories-v1'],activities:[null,{type:'exercise'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,1,'v11 is accepted through the v12 rollout: its wire format is identical, so a not-yet-redeployed backend keeps working');
  assert.equal(unpackRemote({version:12,features:['categories-v1'],activities:[null,{type:'exercise'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,1);

  // Local upgrade: v8 config migrates (pull mode dropped); logs start fresh; identity persists.
  localStorage.setItem('roadToSendConfigV8',JSON.stringify({startDate:'2026-07-01',tripDate:'2026-07-31',goal:600,crew:[{name:'Alex',pullMode:'super-hard'}]}));
  localStorage.setItem('roadToSendMe','Alex');
  endpoint='';logs=[];config=defaultConfig();me='';recordingFor='';
  loadInitialState();
  assert.equal(config.goal,600,'v8 local config migrates to v9');
  assert.equal(config.crew[0].name,'Alex');
  assert.equal(config.crew[0].pullMode,undefined,'pull mode is stripped on migration');
  assert.equal(me,'Alex','remembered identity is restored');
  recordingFor='Maya';
  assert.equal(me,'Alex','temporary proxy target does not replace device owner');

  // Entry 27: writeStore is the one place storage is written, and it reports rather than throws.
  assert.equal(writeStore('roadToSendMe','Alex'),true,'a normal write reports success');
  assert.equal(localStorage.getItem('roadToSendMe'),'Alex','and the value really landed');
  const realStore=localStorage;
  localStorage={getItem:key=>realStore.getItem(key),removeItem:key=>realStore.removeItem(key),setItem:()=>{throw Error('QuotaExceededError')}};
  assert.equal(writeStore('roadToSendMe','Bo'),false,'a throwing setItem is reported, not raised');
  assert.equal(persistLocal(),false,'and the failure is propagated by the callers that need it');
  localStorage={getItem:key=>realStore.getItem(key),removeItem:key=>realStore.removeItem(key)};
  assert.equal(writeStore('roadToSendMe','Bo'),false,'storage with no setItem at all is reported too');
  localStorage=realStore;
  assert.equal(localStorage.getItem('roadToSendMe'),'Alex','none of that disturbed the real store');
  assert.equal(persistLocal(),true,'and a working store still reports success');

  // Pace toward the group goal: expected points scale linearly across the window.
  const paceSettings={startDate:'2026-07-01',tripDate:'2026-07-10',goal:100};
  assert.deepEqual(paceInfo(50,paceSettings,'2026-07-05'),{state:'on',diff:0,perDay:9},'exactly expected is on pace');
  assert.deepEqual(paceInfo(52,paceSettings,'2026-07-05'),{state:'on',diff:2,perDay:8},'a small lead still reads as on pace');
  assert.equal(paceInfo(53,paceSettings,'2026-07-05').state,'ahead');
  assert.equal(paceInfo(53,paceSettings,'2026-07-05').diff,3);
  assert.deepEqual(paceInfo(40,paceSettings,'2026-07-05'),{state:'behind',diff:-10,perDay:10},'behind reports the catch-up rate');
  assert.deepEqual(paceInfo(100,paceSettings,'2026-07-05'),{state:'met'},'reaching the goal wins regardless of date');
  assert.deepEqual(paceInfo(0,paceSettings,'2026-06-30'),{state:'before'},'before the window there is no pace yet');
  assert.deepEqual(paceInfo(80,paceSettings,'2026-07-11'),{state:'ended',short:20},'after the window the shortfall is reported');
  assert.equal(paceInfo(10,{tripDate:'2026-07-10',goal:100},'2026-07-05'),null,'missing start date hides the indicator');
  assert.equal(paceInfo(10,{startDate:'2026-07-01',tripDate:'2026-07-10',goal:0},'2026-07-05'),null,'a zero goal hides the indicator');
  assert.equal(paceInfo(10,{startDate:'2026-07-10',tripDate:'2026-07-01',goal:100},'2026-07-05'),null,'an inverted window hides the indicator');
  assert.equal(paceInfo(10,paceSettings,'garbage'),null,'an unparseable today hides the indicator');

  // projectedTotal extrapolates the elapsed-days average rate to an end-of-challenge total; today is an ARGUMENT, never the clock.
  const projSettings={startDate:'2026-07-01',tripDate:'2026-07-10',goal:100};
  assert.equal(projectedTotal(0,projSettings,'2026-06-30'),null,'before the start there is no projection');
  assert.equal(projectedTotal(10,projSettings,'2026-07-01'),null,'one elapsed day is too noisy to project');
  assert.equal(projectedTotal(10,projSettings,'2026-07-02'),null,'two elapsed days are too noisy to project');
  assert.deepEqual(projectedTotal(6,projSettings,'2026-07-03'),{projected:20},'day three is the first day with a projection');
  assert.deepEqual(projectedTotal(15,projSettings,'2026-07-05'),{projected:30},'mid-challenge the elapsed average extends to the window end');
  assert.deepEqual(projectedTotal(0,projSettings,'2026-07-05'),{projected:0},'a zero rate projects zero with no goal date');
  assert.deepEqual(projectedTotal(60,projSettings,'2026-07-05'),{projected:120,goalDate:'2026-07-09'},'a rate that clears the goal early names the day it lands');
  assert.deepEqual(projectedTotal(50,projSettings,'2026-07-05'),{projected:100,goalDate:'2026-07-10'},'an exactly on-goal rate lands on the final day');
  assert.equal(projectedTotal(50,projSettings,'2026-07-11'),null,'after the end there is nothing left to project');
  assert.equal(projectedTotal(50,{tripDate:'2026-07-10',goal:100},'2026-07-05'),null,'missing start date hides the projection');
  assert.equal(projectedTotal(50,{startDate:'2026-07-01',tripDate:'2026-07-10',goal:0},'2026-07-05'),null,'a zero goal hides the projection');
  assert.equal(projectedTotal(50,{startDate:'2026-07-10',tripDate:'2026-07-01',goal:100},'2026-07-05'),null,'an inverted window hides the projection');
  assert.equal(projectedTotal(50,projSettings,'garbage'),null,'an unparseable today hides the projection');

  // earnedThrough sums group points dated on or before today, so future-dated entries never inflate the pace/projection rate.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[
    {id:'e1',name:'Alex',type:'climb',date:'2026-07-05',createdAt:'1'},
    {id:'e2',name:'Alex',type:'exercise',date:'2026-07-20',createdAt:'1'},
  ];
  assert.equal(earnedThrough('2026-07-10'),3,'a future-dated entry is excluded from the through-today total');
  assert.equal(earnedThrough('2026-07-25'),5,'once its date has arrived the entry counts toward the rate');
  logs=[
    {id:'cap1',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-06',createdAt:'1'},
    {id:'cap2',name:'Alex',type:'bounty',bountyId:'outdoor-send',date:'2026-07-07',createdAt:'2'},
    {id:'cap3',name:'Alex',type:'bounty',bountyId:'century-club',date:'2026-07-08',createdAt:'3'},
    {id:'dup1',name:'Maya',type:'climb',date:'2026-07-09',createdAt:'4'},
    {id:'dup2',name:'Maya',type:'climb',date:'2026-07-09',createdAt:'5'},
  ];
  const cappedModel=totalsModel(),sumThrough=cut=>{let sum=0;cappedModel.dayTotal.forEach((value,key)=>{if(key.slice(key.lastIndexOf('|')+1)<=cut)sum+=value});return sum};
  ['2026-07-06','2026-07-08','2026-07-09','2026-07-31'].forEach(cut=>assert.equal(earnedThrough(cut,cappedModel),sumThrough(cut),'earnedThrough reads the credited day map through '+cut));

  // Entry 25: computeCredits memoizes the live (logs, config) pair only. Every way that pair can
  // change is checked here with a case whose stale answer would be a DIFFERENT number, so a
  // broken invalidation fails loudly instead of merely being slow.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[{id:'m1',name:'Mem',type:'climb',date:'2026-07-02',createdAt:'1'}];
  assert.equal(computeCredits(logs).totals.get('mem'),3,'the first scan scores the live log');
  assert.equal(computeCredits(logs).totals.get('mem'),3,'a repeat call with nothing changed agrees with itself');
  logs=logs.concat([{id:'m2',name:'Mem',type:'exercise',date:'2026-07-02',createdAt:'2'}]);
  assert.equal(computeCredits(logs).totals.get('mem'),5,'a replaced logs reference rescans');
  logs.push({id:'m3',name:'Mem',type:'mobility',date:'2026-07-02',createdAt:'3'});
  assert.equal(computeCredits(logs).totals.get('mem'),8,'an in-place push changes the length, so the len guard rescans');
  logs.splice(2,1);
  assert.equal(computeCredits(logs).totals.get('mem'),5,'an in-place splice changes the length, so the len guard rescans');
  config={startDate:'2026-08-01',tripDate:'2026-08-31',goal:500,crew:[]};
  assert.equal(computeCredits(logs).totals.get('mem'),undefined,'a replaced config rescans, so an out-of-window log scores nothing');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  assert.equal(computeCredits(logs).totals.get('mem'),5,'putting the window back rescans again');
  // A derived array never touches the memo: it neither reads a wrong answer nor evicts the live one.
  const memoLive=computeCredits(logs);
  assert.equal(computeCredits([...logs,{id:'m4',name:'Mem',type:'mobility',date:'2026-07-02',createdAt:'4'}]).totals.get('mem'),8,'a derived array is scored on its own terms');
  assert.equal(computeCredits(logs),memoLive,'and leaves the live memo in place');
  assert.equal(computeCredits(logs,{startDate:'2026-08-01',tripDate:'2026-08-31',goal:500,crew:[]}).totals.get('mem'),undefined,'explicit settings bypass the memo');
  assert.equal(computeCredits(logs),memoLive,'and leave the live memo in place too');
  logs=[
    {id:'e1',name:'Alex',type:'climb',date:'2026-07-05',createdAt:'1'},
    {id:'e2',name:'Alex',type:'exercise',date:'2026-07-20',createdAt:'1'},
  ];

  // challengeToday only trusts serverDate while the sync that produced it is from the current local day.
  endpoint='https://sheet.example.test/exec';challengeTimeZone='Not/AZone';serverDate='2000-01-01';
  lastSyncedAt=Date.now();
  assert.equal(challengeToday(),'2000-01-01','a same-day sync may fall back to serverDate');
  lastSyncedAt=Date.now()-2*86400000;
  assert.equal(challengeToday(),localDate(),'a stale serverDate is ignored');
  lastSyncedAt=0;
  assert.equal(challengeToday(),localDate(),'never synced falls back to the local date');
  challengeTimeZone='America/Los_Angeles';
  assert.equal(challengeToday(),dateInTimeZone(new Date(),'America/Los_Angeles'),'a valid challenge timezone always wins');
  endpoint='';challengeTimeZone='';serverDate='';lastSyncedAt=0;

  // Entry 17: todayProgress reports which categories are already logged and whether the balanced-day bonus is still live.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
  const climb17={id:'p1',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'};
  const climbAgain17={id:'p2',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'2'};
  const exercise17={id:'p3',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'3'};
  const mobility17={id:'p4',name:'Alex',type:'mobility',date:'2026-07-13',createdAt:'4'};
  logs=[];
  let prog=todayProgress('alex','2026-07-13');
  assert.equal(prog.inWindow,true,'a day inside the challenge window is in play');
  assert.equal(prog.loggedCount,0,'nothing is logged on a clean day');
  assert.equal(prog.points,0,'a clean day has scored nothing');
  assert.equal(prog.max,DAILY_MAX,'the day is measured against the derived daily max');
  assert.equal(prog.rows.length,CATEGORIES.length,'one row per scoring category');
  assert.equal(prog.rows.every(r=>r.logged===false),true,'no category is logged yet');
  assert.equal(prog.remainingPoints,DAILY_MAX-SCORING.balancedDayBonus,'every category is still open');
  assert.equal(prog.bonusPoints,SCORING.balancedDayBonus,'the bonus comes from the scoring config');
  assert.equal(prog.bonusEarned,false);
  assert.equal(prog.bonusReachable,true,'a clean day can still earn the balanced-day bonus');
  assert.equal(prog.potential,DAILY_MAX,'a clean day can still reach the daily max');

  // Two of three categories, with a duplicate climb that must not double-count.
  logs=[climb17,climbAgain17,exercise17];
  prog=todayProgress('alex','2026-07-13');
  assert.equal(prog.points,SCORING.categories.climb+SCORING.categories.exercise,'a duplicate same-day climb adds nothing');
  assert.equal(prog.loggedCount,2,'the duplicate still reads as a single logged category');
  assert.equal(prog.rows.find(r=>r.type==='climb').logged,true,'the duplicated category counts as logged');
  assert.equal(prog.rows.filter(r=>r.logged===false).length,1,'exactly one category is still open');
  assert.equal(prog.rows.find(r=>r.type==='mobility').logged,false,'the untouched category is the open one');
  assert.equal(prog.remainingPoints,SCORING.categories.mobility,'the open category names the points left');
  assert.equal(prog.bonusEarned,false);
  assert.equal(prog.bonusReachable,true,'one category short still leaves the bonus reachable');
  assert.equal(prog.potential,DAILY_MAX,'the daily max is still on the table');

  // All three categories: the day is complete and the bonus is banked, not reachable.
  logs=[climb17,climbAgain17,exercise17,mobility17];
  prog=todayProgress('alex','2026-07-13');
  assert.equal(prog.points,DAILY_MAX,'all three categories plus the bonus top the day out');
  assert.equal(prog.loggedCount,CATEGORIES.length);
  assert.equal(prog.bonusEarned,true,'a balanced day earns the bonus');
  assert.equal(prog.bonusReachable,false,'an earned bonus is no longer reachable');
  assert.equal(prog.remainingPoints,0,'nothing is left to log');
  assert.equal(prog.potential,DAILY_MAX);

  // Bounties never touch the daily meter, so a bounty-only day leaves every category open.
  logs=[{id:'pb',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-13',createdAt:'1'}];
  prog=todayProgress('alex','2026-07-13');
  assert.equal(prog.points,0,'a bounty adds no daily-meter points');
  assert.equal(prog.loggedCount,0,'a bounty logs no category');
  assert.equal(prog.rows.every(r=>r.logged===false),true,'all three category rows stay open on a bounty-only day');

  // Outside the challenge window nothing is in play.
  logs=[climb17,exercise17,mobility17];
  prog=todayProgress('alex','2026-08-15');
  assert.equal(prog.inWindow,false,'a day past the window is out of play');
  assert.equal(prog.points,0,'an out-of-window day scores nothing');
  assert.equal(prog.loggedCount,0,'out-of-window entries never read as logged');
  assert.equal(prog.bonusReachable,false,'the bonus is unreachable outside the window');

  // The segmented meter always has one pip per daily point, and its filled pips equal the points earned.
  for(const set of [[],[climb17],[climb17,exercise17],[mobility17],[climb17,exercise17,mobility17],[climb17,climbAgain17]]){
    logs=set;
    const p=todayProgress('alex','2026-07-13'),segs=meterSegments(p);
    assert.equal(segs.length,DAILY_MAX,'the segmented meter carries DAILY_MAX pips');
    assert.equal(segs.filter(s=>s.cls.indexOf('filled')>=0).length,p.points,'filled pips always equal the points earned');
  }
  const segments17=meterSegments(todayProgress('alex','2026-07-13'));
  assert.equal(segments17.filter(s=>s.cls.indexOf('seg-climb')>=0).length,SCORING.categories.climb,'climb owns its share of the pips');
  assert.equal(segments17.filter(s=>s.cls.indexOf('seg-bonus')>=0).length,SCORING.balancedDayBonus,'the bonus owns the last pips');

  // todayPillState replaces the binary Ready/Balanced day pill with five honest states.
  logs=[];
  assert.equal(todayPillState(todayProgress('alex','2026-07-13')).text,'Ready','an untouched day inside the window reads Ready');
  assert.equal(todayPillState(todayProgress('alex','2026-07-13')).cls,'','an untouched day carries no max class');
  logs=[climb17];
  assert.equal(todayPillState(todayProgress('alex','2026-07-13')).text,'2 more for +'+SCORING.balancedDayBonus,'one category logged counts down two');
  logs=[climb17,exercise17];
  assert.equal(todayPillState(todayProgress('alex','2026-07-13')).text,'1 more for +'+SCORING.balancedDayBonus,'two categories logged counts down one');
  logs=[climb17,exercise17,mobility17];
  const balanced17=todayPillState(todayProgress('alex','2026-07-13'));
  assert.equal(balanced17.text,'Balanced day','a balanced day still reads Balanced day');
  assert.equal(balanced17.cls,'max','a day at the daily max keeps the max pill class');
  logs=[];
  assert.equal(todayPillState(todayProgress('alex','2026-06-15')).text,'Not started','before the window the pill reads Not started');
  assert.equal(todayPillState(todayProgress('alex','2026-08-15')).text,'Complete','after the window the pill reads Complete');
  logs=[];

  // Entry 18: challengeProgress gives the You tab its date context and never re-derives what weeksUntilDone already knows.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  let cp=challengeProgress('2026-07-01');
  assert.equal(cp.state,'active','a day inside the window is active');
  assert.equal(cp.day,1,'the first day of the window is day 1');
  assert.equal(cp.totalDays,31,'an inclusive window counts both endpoints');
  assert.equal(cp.daysLeft,31,'day one still has the whole window left');
  cp=challengeProgress('2026-07-15');
  assert.equal(cp.day,15,'the day number counts from the start date');
  assert.equal(cp.daysLeft,17,'the days left include today');
  assert.equal(cp.weeksLeft,weeksUntilDone('2026-07-15').weeks,'weeksLeft comes straight from weeksUntilDone');
  cp=challengeProgress('2026-07-31');
  assert.equal(cp.day,31,'the last day of the window is the last day');
  assert.equal(cp.daysLeft,1,'the final day still counts itself');
  assert.equal(cp.pct,100,'the final day is the whole window');
  assert.equal(challengeProgress('2026-08-05').state,'ended','a day past the trip date has ended');
  assert.equal(challengeProgress('2026-08-05').daysLeft,0,'a finished window has no days left');
  assert.equal(challengeProgress('2026-06-30').state,'before','a day before the start has not begun');
  assert.equal(challengeProgress('2026-06-30').day,0,'the window has not started counting yet');
  assert.equal(challengeProgress('garbage'),null,'an unparseable day has no progress');
  assert.equal(challengeProgress('2026-07-15',{startDate:'2026-07-31',tripDate:'2026-07-01',goal:500}),null,'an inverted window has no progress');
  for(const d of ['2026-07-01','2026-07-09','2026-07-20','2026-07-31','2026-06-30'])assert.equal(challengeProgress(d).daysLeft,weeksUntilDone(d).days,'daysLeft never drifts from weeksUntilDone on '+d);

  // Entry 18: personalPaceInfo splits the crew goal into a personal share and reuses paceInfo unchanged.
  logs=[];
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:100,crew:[{name:'Alex'}]};
  assert.equal(personalPaceInfo('alex','2026-07-15').share,100,'a solo crew owns the whole goal');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:100,crew:[{name:'Alex'},{name:'Bo'},{name:'Cy'}]};
  assert.equal(personalPaceInfo('alex','2026-07-15').share,34,'a three-person crew rounds the share up');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:100,crew:[{name:'Alex'},{name:'Bo'},{name:'Cy'},{name:'Di'}]};
  assert.equal(personalPaceInfo('alex','2026-07-15').share,25,'a four-person crew splits the goal evenly');
  logs=[{id:'pp1',name:'Alex',type:'climb',date:'2026-07-02',createdAt:'1'}];
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:8,crew:[{name:'Alex'},{name:'Bo'},{name:'Cy'},{name:'Di'}]};
  let pp=personalPaceInfo('alex','2026-07-15');
  assert.equal(pp.share,2,'the share is the crew goal split and rounded up');
  assert.equal(pp.total,SCORING.categories.climb,'the total is the person credited score');
  assert.equal(pp.pace.state,'met','passing your share of the goal reads as met');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:0,crew:[{name:'Alex'}]};
  assert.equal(personalPaceInfo('alex','2026-07-15').pace,null,'a zero goal has no pace');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:100,crew:[{name:'Alex'}]};
  assert.equal(personalPaceInfo('alex','2026-07-15',{startDate:'2026-07-31',tripDate:'2026-07-01',goal:100}).pace,null,'an inverted window has no pace');
  assert.equal(personalPaceInfo('alex','2026-06-15').pace.state,'before','today is honoured as an argument: a pre-window day reads before');
  assert.equal(personalPaceInfo('alex','2026-08-15').pace.state,'ended','today is honoured as an argument: a post-window day reads ended');

  // Entry 19: after a delete, focus lands on the row that took the deleted row's place.
  assert.equal(nextFocusIndex(0,0),-1,'an emptied feed has no row left to focus');
  assert.equal(nextFocusIndex(0,3),0,'deleting the first row focuses the new first row');
  assert.equal(nextFocusIndex(2,2),1,'a deleted last row hands focus to the new last row');
  assert.equal(nextFocusIndex(5,3),2,'a position past the end clamps to the last row');

  // Entry 92: only a chip row that held focus asks renderFeedChips() to restore it.
  assert.equal(feedFocusType(true,'climb'),'climb','a focused chip row restores the newly selected chip');
  assert.equal(feedFocusType(false,'climb'),null,'an unfocused chip row leaves focus alone');

  // Entry 20: the per-person card composes the existing per-person helpers and adds no scoring math.
  const monday=weekKey(challengeToday()),onDay=n=>{const d=parseDateOnly(monday);d.setDate(d.getDate()+n);return localDate(d)};
  config={startDate:onDay(-14),tripDate:onDay(14),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  const firstBounty=SCORING.bounties[0],bp=firstBounty.points;
  logs=[
    {id:'ps1',name:'Alex',type:'climb',hardestGrade:'V5',date:onDay(0),createdAt:'1'},
    {id:'ps2',name:'Alex',type:'exercise',date:onDay(0),createdAt:'2'},
    {id:'ps3',name:'Alex',type:'mobility',date:onDay(0),createdAt:'3'},
    {id:'ps4',name:'Alex',type:'climb',hardestGrade:'V3',date:onDay(1),createdAt:'4'},
    {id:'ps5',name:'Alex',type:'climb',hardestGrade:'V7',date:onDay(-7),createdAt:'5'},
    {id:'ps6',name:'Alex',type:'bounty',bountyId:firstBounty.id,date:onDay(1),createdAt:'6'},
    {id:'ps7',name:'Bo',type:'climb',hardestGrade:'V2',date:onDay(0),createdAt:'7'},
  ];
  const card=personSummary('Alex',onDay(0));
  assert.equal(card.name,'Alex','the card keeps the roster spelling of the name');
  assert.equal(card.rank,1,'the card ranks by all-time points, matching the You-tab rank');
  assert.equal(card.field,2,'the card exposes the ranked roster size');
  assert.equal(card.week,11+bp,'the week figure is the leaderboard row week figure');
  assert.equal(card.total,14+bp,'the all-time figure is the leaderboard row total');
  assert.equal(card.bounties,1,'the weekly bounty count comes from the same model row');
  assert.equal(card.bountiesTotal,1,'the all-time bounty count comes from the same model row');
  assert.deepEqual(card.streak,streakInfo('alex',onDay(0)),'the card streak is streakInfo, not a second implementation');
  assert.equal(card.trend,weekTrend('alex',onDay(0)),'the card trend is weekTrend');
  assert.equal(card.trend,'up','a bigger week than the one before reads as up');
  assert.deepEqual(card.weeks,personalWeeklyTrend('alex',onDay(0)),'the card weekly trend is personalWeeklyTrend, not a second implementation');
  assert.equal(card.breakdown.rows.reduce((sum,r)=>sum+r.points,0),card.total,'the breakdown rows plus the bonus row sum to the total');
  assert.equal(card.breakdown.bonus,SCORING.balancedDayBonus,'a balanced day shows up as the bonus row');
  assert.deepEqual(card.pyramid.map(r=>r.grade),['V7','V5','V3'],'the pyramid is ordered hardest first');
  assert.equal(card.records.hardest,'V7','the records come straight from personalRecords');
  assert.equal(personSummary('ALEX',onDay(0)).name,'Alex','a differently cased name resolves to the same person');
  assert.equal(personSummary('bo',onDay(0)).rank,2,'the runner-up ranks second');
  assert.equal(personSummary('Nobody',onDay(0)),null,'an unknown name has no card');
  assert.equal(personSummary('   ',onDay(0)),null,'a blank name has no card');

  // Entry 64: rank labels include the complete ranked field, never just participation.
  assert.equal(rankLabel(3,12),'#3 of 12');
  assert.equal(rankLabel(1,1),'#1 of 1');
  assert.equal(rankLabel(0,5),'—');
  assert.equal(rankLabel(-1,5),'—');
  assert.equal(rankLabel(3,2),'—');

  // Entry 21: the Record-tab preview copy is a pure ladder over a plain draft summary — no DOM.
  assert.equal(creditPreviewCopy({type:'climb',hasTarget:true,inWindow:true,base:3,credit:3,reason:''}),'Counts in full · +3 today','full credit keeps its wording');
  assert.equal(creditPreviewCopy({type:'climb',hasTarget:true,inWindow:true,base:3,credit:0,reason:'already logged'}),CAT_LABELS.climb+' already logged today · earns 0 more','a repeat category keeps its wording');
  assert.equal(creditPreviewCopy({type:'bounty',hasTarget:true,inWindow:true,bountyId:'',base:0,credit:0,reason:''}),'Choose one of today’s bounties.','an unchosen bounty keeps its wording');
  assert.equal(creditPreviewCopy({type:'bounty',hasTarget:true,inWindow:true,bountyId:'century-club',base:3,credit:0,reason:'weekly cap'}),'Weekly bounty cap reached · bragging rights only','an over-cap bounty keeps its wording');
  assert.equal(creditPreviewCopy({type:'bounty',hasTarget:true,inWindow:true,bountyId:'send-it',base:3,credit:3,reason:''}),'Bounty! +3 toward your week','a credited bounty keeps its wording');
  assert.equal(creditPreviewCopy({type:'climb',hasTarget:false,inWindow:true,base:3,credit:3,reason:''}),'Choose who you are to save this.','no target explains why Save is dead');
  const outCopy=creditPreviewCopy({type:'climb',hasTarget:true,inWindow:false,base:3,credit:3,reason:'',startDate:'2026-07-01',tripDate:'2026-07-31'});
  assert.equal(outCopy.indexOf('Outside the challenge window'),0,'an out-of-window date explains why Save is dead');
  assert.ok(outCopy.indexOf(fmtDay('2026-07-01'))>=0,'the out-of-window copy names the window start');
  assert.ok(outCopy.indexOf(fmtDay('2026-07-31'))>=0,'the out-of-window copy names the window end');

  // Entry 32: an in-flight save wins the ladder outright, so the line stops asserting what the entry
  // WILL score while the request is still in the air. Every case above is called without a saving
  // flag and is unaffected.
  assert.equal(creditPreviewCopy({saving:true,type:'climb',hasTarget:true,inWindow:true,base:3,credit:3,reason:''}),'Saving…','a save in flight replaces the full-credit line');
  assert.equal(creditPreviewCopy({saving:true,type:'climb',hasTarget:false,inWindow:false,base:3,credit:0,reason:'already logged',startDate:'2026-07-01',tripDate:'2026-07-31'}),'Saving…','and it wins over every other branch, however bad the draft looks');
  assert.equal(creditPreviewCopy({saving:false,type:'climb',hasTarget:true,inWindow:true,base:3,credit:3,reason:''}),'Counts in full · +3 today','an explicit false is the same as absent');

  // Entry 22: the shared summary composes existing helpers and never leaks the crew's Sheet endpoint.
  location.href='https://example.test/app/?sheet=https%3A%2F%2Fsheet.example.test%2Fexec#you';
  assert.equal(publicUrl(),'https://example.test/app/','publicUrl drops both the hash and the sheet query param');
  endpoint='https://sheet.example.test/exec';
  const shareMonday=weekKey(challengeToday()),shareDay=n=>{const d=parseDateOnly(shareMonday);d.setDate(d.getDate()+n);return localDate(d)};
  config={startDate:shareDay(-7),tripDate:shareDay(7),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[
    {id:'sh1',name:'Alex',type:'climb',hardestGrade:'V6',date:shareDay(0),createdAt:'1'},
    {id:'sh2',name:'Alex',type:'exercise',date:shareDay(0),createdAt:'2'},
    {id:'sh3',name:'Alex',type:'mobility',date:shareDay(0),createdAt:'3'},
  ];
  const shareRow=totalsModel().sorted.find(x=>x.name==='Alex'),shareProg=challengeProgress(shareDay(0)),shareStreak=streakInfo('alex',shareDay(0)),shareText=shareSummary('alex',shareDay(0));
  assert.ok(shareText.indexOf('Alex')>=0,'the summary names the person');
  assert.ok(shareText.indexOf('Day '+shareProg.day)>=0,'the day line comes from challengeProgress');
  assert.ok(shareText.indexOf(String(shareRow.total)+' pts')>=0,'the total comes from the totalsModel row');
  assert.ok(shareText.indexOf('#1')>=0,'the rank comes from the totalsModel ordering');
  assert.ok(shareText.indexOf(String(shareStreak.current)+' day streak')>=0,'the streak comes from streakInfo');
  assert.ok(shareText.indexOf('V6')>=0,'a graded climber shares their hardest send from personalRecords');
  assert.ok(shareText.indexOf(publicUrl())>=0,'the summary ends on the public app link');
  assert.equal(shareText.indexOf('sheet='),-1,'the shared text never carries the sheet query param');
  assert.equal(shareText.indexOf('sheet.example.test'),-1,'the shared text never names the Apps Script endpoint host');
  const shareStarter=shareSummary('bo',shareDay(0));
  assert.ok(shareStarter.indexOf('Just getting started')>=0,'a climber with no credited points gets the short variant');
  assert.ok(shareStarter.length<shareText.length,'the short variant really is shorter');
  assert.equal(shareStarter.indexOf('sheet.example.test'),-1,'the short variant is just as private');
  assert.equal(shareSummary('',shareDay(0)),'','a blank name shares nothing');
  assert.equal(shareSummary('   ',shareDay(0)),'','a whitespace name shares nothing');
  assert.equal(shareSummary('Nobody',shareDay(0)),'','an unknown name shares nothing');

  // Entry 42: activityMarkup() branches three ways on type. The bounty and fall-through branches
  // appended x.note; the climb branch rendered the grade and dropped it, so a note written against
  // a climb was stored, synced and exported but never shown back.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
  const climbRow=(extra)=>{
    const base={id:'c1',name:'Alex',type:'climb',date:'2026-07-05',createdAt:'1'};
    for(const k in extra)base[k]=extra[k];
    logs=[base];
    return activityMarkup(logs,10,false);
  };
  const noted=climbRow({hardestGrade:'V4',note:'crimpy'});
  assert.ok(noted.indexOf('crimpy')>=0,'a note written on a climb reaches the feed row');
  assert.ok(noted.indexOf('V4 · crimpy')>=0,'the grade comes first and the note follows it');
  const noteOnly=climbRow({note:'long session'});
  assert.ok(noteOnly.indexOf(CAT_LABELS.climb+' · long session')>=0,'a climb with no grade still shows its note');
  const bare=climbRow({hardestGrade:'V4'});
  assert.ok(bare.indexOf('V4')>=0,'a climb with no note still shows its grade');
  assert.equal(bare.indexOf('V4 · ·'),-1,'a climb with no note gains no stray separator');
  const nasty=climbRow({hardestGrade:'V4',note:'<img src=x>'});
  assert.equal(nasty.indexOf('<img src=x>'),-1,'a note is escaped, never injected as markup');
  assert.ok(nasty.indexOf('&lt;img src=x&gt;')>=0,'the escaped note is still readable');

  // Entry 43: filterByType() is the whole of the You feed's category filter. It narrows and
  // nothing else — ordering and limiting stay activityMarkup()'s job, so a filter that quietly
  // sorted would double up on work already done and change what the feed shows.
  const feedItems=[{id:'a',type:'climb',date:'2026-01-01'},{id:'b',type:'exercise',date:'2026-01-05'},{id:'c',type:'mobility',date:'2026-01-02'},{id:'d',type:'climb',date:'2026-01-04'},{id:'e',type:'bounty',date:'2026-01-03'}];
  const idsOf=list=>list.map(x=>x.id).join(',');
  assert.equal(idsOf(filterByType(feedItems,'all')),'a,b,c,d,e','the All filter returns every item');
  assert.equal(idsOf(filterByType(feedItems,'')),'a,b,c,d,e','an empty type returns every item');
  assert.equal(idsOf(filterByType(feedItems)),'a,b,c,d,e','a missing type returns every item');
  assert.equal(idsOf(filterByType(feedItems,'climb')),'a,d','a category returns only its own items');
  assert.equal(idsOf(filterByType(feedItems,'exercise')),'b','each category narrows to itself');
  assert.equal(idsOf(filterByType(feedItems,'mobility')),'c','including mobility');
  assert.equal(idsOf(filterByType(feedItems,'bounty')),'e','and a bounty row is reachable by its own type');
  assert.equal(filterByType([{id:'a',type:'climb'}],'mobility').length,0,'a type nobody logged returns an empty list');
  assert.equal(filterByType([],'climb').length,0,'and an empty feed stays empty');
  // The unfiltered items arrive newest-last here on purpose: if filterByType() sorted, the ids
  // below would come back reordered rather than in the order they were handed over.
  assert.equal(idsOf(filterByType(feedItems,'all')),idsOf(feedItems),'the All filter never reorders what it is given');
  assert.equal(idsOf(filterByType([feedItems[3],feedItems[0]],'climb')),'d,a','and a narrowed list keeps its incoming order');
  // The chip faces come from the shared scoring config, never from a hard-coded label list.
  const chips=feedChips();
  assert.equal(chips.length,CATEGORIES.length+1,'there is one chip per category plus All');
  assert.equal(chips[0].type,'all','All leads the row');
  assert.equal(idsOf(chips.slice(1).map(c=>({id:c.type}))),CATEGORIES.join(','),'the rest are the configured categories, in config order');
  assert.ok(chips.slice(1).every(c=>c.label===CAT_LABELS[c.type]&&c.icon===TYPE_ICONS[c.type]),'each chip face is read from the scoring config');

  // Entry 47: the last grade a person logged, ordered the way the feed orders everything else.
  logs=[
    {id:'lg1',name:'Alex',type:'climb',hardestGrade:'V2',date:'2026-07-10',createdAt:'1'},
    {id:'lg2',name:'Alex',type:'climb',hardestGrade:'V5',date:'2026-07-12',createdAt:'1'},
    {id:'lg3',name:'Alex',type:'climb',hardestGrade:'V4',date:'2026-07-12',createdAt:'2'},
    {id:'lg4',name:'Maya',type:'climb',hardestGrade:'V9',date:'2026-07-20',createdAt:'1'},
  ];
  assert.equal(lastLoggedGrade('alex'),'V4','the most recent climb wins, and createdAt breaks a same-day tie');
  assert.notEqual(lastLoggedGrade('alex'),'V2','the oldest climb is never the answer');
  assert.equal(lastLoggedGrade('maya'),'V9','each climber reads their own last climb');
  assert.equal(lastLoggedGrade('nobody'),'','a person with no climbs has no default');
  // A later non-climb entry must neither become the answer nor blank it out.
  logs=logs.concat([
    {id:'lg5',name:'Alex',type:'exercise',date:'2026-07-25',createdAt:'1'},
    {id:'lg6',name:'Alex',type:'mobility',date:'2026-07-26',createdAt:'1'},
    {id:'lg7',name:'Alex',type:'bounty',bountyId:'send-it',date:'2026-07-27',createdAt:'1'},
  ]);
  assert.equal(lastLoggedGrade('alex'),'V4','exercise, mobility and bounty entries are ignored');
  // Another person climbing later changes nothing about this one.
  logs=logs.concat([{id:'lg8',name:'Maya',type:'climb',hardestGrade:'V11',date:'2026-07-30',createdAt:'1'}]);
  assert.equal(lastLoggedGrade('alex'),'V4','another climber, however recent, never leaks into this default');
  assert.equal(lastLoggedGrade('maya'),'V11','while their own default does move');
  // Only a grade the scoring config offers can be preselected.
  logs=[{id:'lg9',name:'Alex',type:'climb',hardestGrade:'5.12a',date:'2026-07-13',createdAt:'1'}];
  assert.equal(lastLoggedGrade('alex'),'','a grade absent from SCORING.grades yields no default');
  logs=[{id:'lg10',name:'Alex',type:'climb',date:'2026-07-13',createdAt:'1'}];
  assert.equal(lastLoggedGrade('alex'),'','a climb logged without a grade yields no default');
  // The name is matched the way nameKey() matches it everywhere else, and a blank name matches nobody.
  logs=[{id:'lg11',name:'  Alex  ',type:'climb',hardestGrade:'V3',date:'2026-07-13',createdAt:'1'},{id:'lg12',name:'',type:'climb',hardestGrade:'V7',date:'2026-07-14',createdAt:'1'}];
  assert.equal(lastLoggedGrade('alex'),'V3','a padded stored name still resolves through nameKey()');
  assert.equal(lastLoggedGrade(''),'','a blank name matches nobody, not the nameless entry');
  // Reading the log must not reorder it: the helper sorts a copy.
  logs=[
    {id:'lg13',name:'Alex',type:'climb',hardestGrade:'V1',date:'2026-07-10',createdAt:'1'},
    {id:'lg14',name:'Alex',type:'climb',hardestGrade:'V6',date:'2026-07-11',createdAt:'1'},
  ];
  assert.equal(lastLoggedGrade('alex'),'V6','the newer of two climbs is the default');
  assert.equal(logs.map(x=>x.id).join(','),'lg13,lg14','and logs is left in the order it arrived');
  logs=[];
  assert.equal(lastLoggedGrade('alex'),'','an empty log has no default either');

  // Entry 49: feedEmptyCopy() names the filter that emptied a feed instead of always claiming
  // there is no activity at all.
  assert.equal(feedEmptyCopy('all'),'No activity yet.','the All filter keeps the plain sentence');
  assert.equal(feedEmptyCopy(''),'No activity yet.','a blank type keeps the plain sentence');
  assert.equal(feedEmptyCopy(undefined),'No activity yet.','a missing type keeps the plain sentence');
  assert.equal(feedEmptyCopy('parkour'),'No activity yet.','a type outside CATEGORIES keeps the plain sentence');
  assert.equal(feedEmptyCopy('bounty'),'No activity yet.','bounty is not a feed chip and keeps the plain sentence');
  for(const t of CATEGORIES){
    assert.equal(feedEmptyCopy(t),'No '+CAT_LABELS[t]+' entries in this view.','the '+t+' filter names its own label');
    assert.notEqual(feedEmptyCopy(t),'No '+t+' entries in this view.','the label comes from CAT_LABELS, not the raw type spelled out');
  }
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[{name:'Alex'}]};
  logs=[];
  const stillEmpty=activityMarkup([],5,false);
  assert.equal(stillEmpty,'<p class="hint">No activity yet.</p>','activityMarkup([],5,false) still opens and closes the hint paragraph');

  endpoint='';
  logs=[];
})()`;

test('scoring, totals, pace and share text behave as the app expects', () => {
  vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});
});
