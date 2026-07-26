const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
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

  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};

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
  assert.equal(rec.bestDay,8,'best single day is the dayMeter max — a balanced day tops out at 8');
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

  // streakInfo counts consecutive days with >=1 credited point in dayMeter; today is an ARGUMENT, never the clock.
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
  assert.equal(heat[1].points,3,'points come from dayMeter');
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

  // weeklyTrend aggregates crew-wide weekly totals from weekKey(startDate) through weekKey(today); today is an ARGUMENT, never the clock.
  logs=[
    {id:'v1',name:'Alex',type:'climb',date:'2026-07-12',createdAt:'1'},
    {id:'v2',name:'Alex',type:'exercise',date:'2026-07-13',createdAt:'1'},
    {id:'v3',name:'Maya',type:'climb',date:'2026-07-08',createdAt:'1'},
  ];
  let trend=weeklyTrend('2026-07-15');
  assert.deepEqual(trend.map(r=>r.week),['2026-06-29','2026-07-06','2026-07-13'],'weeks run consecutively from weekKey(startDate) through weekKey(today)');
  assert.deepEqual(trend.map(r=>r.label),['W1','W2','W3'],'weeks are labeled W1 through Wn in order');
  assert.equal(trend[1].points,6,'a Sunday entry lands in its Monday-start week and multi-person weeks sum together');
  assert.equal(trend[2].points,2,'a Monday entry opens the next week, matching weekKey bucketing');
  assert.equal(trend[0].points,0,'a week with no entries appears with zero points');
  logs=[{id:'p1',name:'Alex|Jr',type:'climb',date:'2026-07-01',createdAt:'1'}];
  assert.equal(weeklyTrend('2026-07-01')[0].points,3,'a crew name containing a pipe still aggregates into its week (the week key is the final key segment)');
  logs=[
    {id:'v1',name:'Alex',type:'climb',date:'2026-07-02',createdAt:'1'},
    {id:'v2',name:'Alex',type:'mobility',date:'2026-07-20',createdAt:'1'},
  ];
  trend=weeklyTrend('2026-07-21');
  assert.deepEqual(trend.map(r=>r.points),[3,0,0,1],'empty middle weeks appear as zero bars between active weeks');
  assert.equal(weeklyTrend('2026-07-07').length,2,'the window is capped at the week of today, not the trip date');
  assert.deepEqual(weeklyTrend('2026-06-30'),[],'before the start there is nothing to chart');
  assert.deepEqual(weeklyTrend('garbage'),[],'an unparseable today yields no bars');
  config={startDate:'',tripDate:'2026-07-31',goal:500,crew:[]};
  assert.deepEqual(weeklyTrend('2026-07-15'),[],'a missing start date yields no bars');
  config={startDate:'2026-07-31',tripDate:'2026-07-01',goal:500,crew:[]};
  assert.deepEqual(weeklyTrend('2026-07-15'),[],'an inverted window yields no bars');
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[];

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

  // podiumMedals: dense rank over DISTINCT positive values; ties share a medal; a 0 earns nothing.
  const threeWay=podiumMedals([{name:'A',week:9,total:20},{name:'B',week:7,total:15},{name:'C',week:4,total:9}],'week');
  assert.equal(threeWay.get('A'),'🥇');
  assert.equal(threeWay.get('B'),'🥈');
  assert.equal(threeWay.get('C'),'🥉');
  const tied=podiumMedals([{name:'A',week:8},{name:'B',week:8},{name:'C',week:5},{name:'D',week:3}],'week');
  assert.equal(tied.get('A'),'🥇','a tie for first shares gold');
  assert.equal(tied.get('B'),'🥇','both eights are gold');
  assert.equal(tied.get('C'),'🥈','the next distinct value takes silver');
  assert.equal(tied.get('D'),'🥉','the third distinct value takes bronze');
  const fewer=podiumMedals([{name:'A',total:5},{name:'B',total:2}],'total');
  assert.equal(fewer.size,2,'fewer than three climbers only award the medals earned');
  assert.equal(fewer.get('A'),'🥇');
  assert.equal(fewer.get('B'),'🥈');
  assert.equal(podiumMedals([{name:'A',week:0},{name:'B',week:0}],'week').size,0,'all-zero scores yield an empty map');
  // A crafted roster where Weekly and Overall orderings differ yields different top-3 sets.
  const roster=[{name:'A',week:1,total:30},{name:'B',week:2,total:20},{name:'C',week:9,total:5},{name:'D',week:0,total:40}];
  const weekRanked=rankLeaders(roster,'week'),totalRanked=rankLeaders(roster,'total');
  assert.equal(weekRanked[0].name,'C','weekly ranking leads with the highest week');
  assert.equal(totalRanked[0].name,'D','overall ranking leads with the highest total');
  const weekMedals=podiumMedals(weekRanked,'week'),totalMedals=podiumMedals(totalRanked,'total');
  assert.equal(weekMedals.get('C'),'🥇','C is first this week');
  assert.equal(totalMedals.get('D'),'🥇','D is first overall');
  assert.notEqual([...weekMedals.keys()].sort().join(','),[...totalMedals.keys()].sort().join(','),'the weekly and overall podiums are different sets');

  // Leaderboard week-trend arrows: prevWeekKey steps back one Monday-aligned week; today is an ARGUMENT.
  assert.equal(prevWeekKey('2026-07-13'),'2026-07-06','a Monday resolves to the prior week key');
  assert.equal(prevWeekKey('2026-07-19'),'2026-07-06','a Sunday shares its week, so the prior week matches the Monday');
  assert.equal(prevWeekKey('2026-07-20'),'2026-07-13','crossing the Monday boundary advances the previous week too');
  assert.equal(prevWeekKey('garbage'),'','an unparseable today yields no previous week');

  // weekTrend classifies this week vs the previous week from computeCredits().weeks → up/down/even, null in the first week.
  config={startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]};
  logs=[
    {id:'a1',name:'Alex',type:'climb',date:'2026-07-08',createdAt:'1'}, // prev week: 3
    {id:'a2',name:'Alex',type:'climb',date:'2026-07-14',createdAt:'2'}, // this week: 3
    {id:'a3',name:'Alex',type:'exercise',date:'2026-07-15',createdAt:'3'}, // this week: +2 => 5
    {id:'d1',name:'Dana',type:'climb',date:'2026-07-08',createdAt:'4'}, // prev week: 3, this week: 0
    {id:'e1',name:'Even',type:'climb',date:'2026-07-08',createdAt:'5'}, // prev week: 3
    {id:'e2',name:'Even',type:'climb',date:'2026-07-15',createdAt:'6'}, // this week: 3
    {id:'n1',name:'Newbie',type:'climb',date:'2026-07-14',createdAt:'7'}, // this week only: 3
  ];
  assert.equal(weekTrend('alex','2026-07-15'),'up','more points this week than last is up');
  assert.equal(weekTrend('dana','2026-07-15'),'down','fewer points this week than last is down');
  assert.equal(weekTrend('even','2026-07-15'),'even','matching the previous week is even');
  assert.equal(weekTrend('newbie','2026-07-15'),'up','zero previous week with points this week is up');
  assert.equal(weekTrend('ghost','2026-07-15'),'even','both weeks at zero is even');
  assert.equal(weekTrend('alex','2026-07-03'),null,'the first challenge week is suppressed — no previous week to compare');
  assert.equal(weekTrend('alex','2026-07-13'),'up','the second week compares against the first');

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
  assert.equal(unpackRemote({version:11,features:['categories-v1'],activities:[null,{type:'exercise'}],config:{startDate:'2026-07-01',tripDate:'2026-07-31',goal:500,crew:[]}}).activities.length,1);

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
  assert.equal(card.week,11+bp,'the week figure is the leaderboard row week figure');
  assert.equal(card.total,14+bp,'the all-time figure is the leaderboard row total');
  assert.equal(card.bounties,1,'the weekly bounty count comes from the same model row');
  assert.equal(card.bountiesTotal,1,'the all-time bounty count comes from the same model row');
  assert.deepEqual(card.streak,streakInfo('alex',onDay(0)),'the card streak is streakInfo, not a second implementation');
  assert.equal(card.trend,weekTrend('alex',onDay(0)),'the card trend is weekTrend');
  assert.equal(card.trend,'up','a bigger week than the one before reads as up');
  assert.equal(card.breakdown.rows.reduce((sum,r)=>sum+r.points,0),card.total,'the breakdown rows plus the bonus row sum to the total');
  assert.equal(card.breakdown.bonus,SCORING.balancedDayBonus,'a balanced day shows up as the bonus row');
  assert.deepEqual(card.pyramid.map(r=>r.grade),['V7','V5','V3'],'the pyramid is ordered hardest first');
  assert.equal(card.records.hardest,'V7','the records come straight from personalRecords');
  assert.equal(personSummary('ALEX',onDay(0)).name,'Alex','a differently cased name resolves to the same person');
  assert.equal(personSummary('bo',onDay(0)).rank,2,'the runner-up ranks second');
  assert.equal(personSummary('Nobody',onDay(0)),null,'an unknown name has no card');
  assert.equal(personSummary('   ',onDay(0)),null,'a blank name has no card');

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
  endpoint='';
  logs=[];
})()`;

vm.runInNewContext(`${source}\n${checks}`, context, {filename: 'index.html'});

// DOM-backed harness: a minimal document stub so init()/render() run and the
// Record tab's date/bounty behavior can be asserted alongside the You tab.
function makeElement() {
  const classes = new Set();
  return {
    value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      contains: c => classes.has(c),
      toggle: (c, force) => {const on = force === undefined ? !classes.has(c) : Boolean(force); on ? classes.add(c) : classes.delete(c); return on},
    },
    setAttribute() {}, removeAttribute() {}, getAttribute() {return null},
    addEventListener() {}, removeEventListener() {}, focus() {},
    querySelectorAll() {return []},
  };
}
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
  const bountyRadio=document.querySelector('input[name="activityType"][value="bounty"]');
  const claimSelect=document.querySelector('#bountySelect'),claimDateBox=document.querySelector('#dateFields');
  bountyRadio.checked=false;claimSelect.value='';claimDateBox.classList.remove('hide');
  claimBounty(claimId);
  assert.equal(bountyRadio.checked,true,'claiming a bounty selects the Bounty activity type');
  assert.equal(claimSelect.value,claimId,'claiming a bounty preselects it in the Record dropdown');
  assert.equal(claimDateBox.classList.contains('hide'),true,'claiming a bounty snaps to today and closes the date picker');

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
  assert.ok(crewFeed.innerHTML.indexOf('data-del=')>=0,'the Crew feed keeps its delete buttons');
  assert.ok(crewFeed.innerHTML.indexOf('aria-label="Delete ')>=0,'the Crew feed keeps its delete labels');
  const confirmDialog=document.querySelector('#confirmModal'),confirmBody=document.querySelector('#confirmBody');
  requestDelete(0,'d1','personal');
  assert.equal(confirmDialog.classList.contains('open'),true,'requesting a delete opens the in-app dialog instead of a native prompt');
  assert.ok(confirmBody.textContent.indexOf(CAT_LABELS.climb)>=0,'the confirm copy names the activity');
  assert.ok(confirmBody.textContent.indexOf('V5')>=0,'the confirm copy names the grade the way the old prompt did');
  assert.ok(confirmBody.textContent.indexOf('Alex')>=0,'the confirm copy names the person');
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

  // The shared branch posts action:'delete' through fetchShared; harness 2 has no fetch stub,
  // so it stays with the fetch-stubbed harness pattern below.

  // Entry 20: tapping a leaderboard row opens the per-person card. Element listeners are
  // no-ops in this stub and elements have no closest(), so call openPersonCard directly.
  me='Alex';recordingFor='Alex';endpoint='';
  config={startDate:shift(-5),tripDate:shift(5),goal:500,crew:[{name:'Alex'},{name:'Bo'}]};
  logs=[{id:'q1',name:'Alex',type:'climb',hardestGrade:'V5',date:shift(-1),createdAt:'1'},{id:'q2',name:'Alex',type:'exercise',date:shift(-1),createdAt:'2'},{id:'q3',name:'Bo',type:'climb',hardestGrade:'V2',date:shift(-1),createdAt:'3'}];
  render();
  const leaderRows=document.querySelector('#leaderRows');
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

  endpoint='';logs=[];me='';recordingFor='';
})()`;

vm.runInNewContext(`${source}\n${domChecks}`, domContext, {filename: 'index.html'});

// Shared-mode harness with a stubbed fetch: a background sync (loadRemote) must
// never overwrite a date the user picked in the open "Different day" field.
test('background sync respects the open date picker and refreshes stale caches', async () => {
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  store.set('roadToSendEndpoint', 'https://sheet.example.test/exec');
  store.set('roadToSendMe', 'Alex');
  const dayShift = n => {const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`};
  const payload = {version: 11, features: [], activities: [], config: {startDate: dayShift(-5), tripDate: dayShift(5), goal: 500, crew: [{name: 'Alex'}]}, configErrors: [], serverDate: '', timeZone: ''};
  let gets = 0;
  const syncContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    fireDocumentEvent: type => {const handler = listeners.get(type); if (handler) handler({})},
    countGets: () => gets,
    fetch: async (url, options = {}) => {if (!options.method) gets++; return {ok: true, json: async () => JSON.parse(JSON.stringify(payload))}},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const syncChecks = `(async()=>{
    await loadRemote();
    const dateBox=document.querySelector('#dateFields'),dateField=document.querySelector('#activityDate');

    // Closed picker: a sync still re-syncs the record date to today.
    dateBox.classList.add('hide');
    dateField.value='${dayShift(-1)}';
    await loadRemote();
    assert.equal(recordDate(),challengeToday(),'closed picker re-syncs to today after a sync');

    // Open picker with a manually chosen day: the sync must not touch it.
    dateBox.classList.remove('hide');
    dateField.value='${dayShift(-1)}';
    await loadRemote();
    assert.equal(recordDate(),'${dayShift(-1)}','a background sync leaves the chosen date alone');

    // Returning to the tab only refetches once the cache is older than five minutes.
    const before=countGets();
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before,'a fresh cache is not refetched on tab return');
    lastSyncedAt=Date.now()-6*60*1000;
    fireDocumentEvent('visibilitychange');
    assert.equal(countGets(),before+1,'a stale cache refreshes on tab return');
  })()`;
  await vm.runInNewContext(`${source}\n${syncChecks}`, syncContext, {filename: 'index.html'});
});

// Entry 22 regression lock: saveSetup() awaits copyCrewLink() inside its try, so a rejected
// clipboard write used to land in the catch and paint #setupErrors as if setup had failed —
// even though the config was already on the Sheet and the endpoint had persisted.
test('a denied clipboard copy never reports shared setup as failed', async () => {
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  const posted = [];
  const dayShift = n => {const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`};
  const crewConfig = {startDate: dayShift(-5), tripDate: dayShift(5), goal: 500, crew: [{name: 'Alex'}]};
  const payload = {version: 11, features: [], activities: [], config: crewConfig, configErrors: [], serverDate: '', timeZone: ''};
  const participantRow = {querySelector: () => ({value: 'Alex'})};
  const setupContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    navigator: {clipboard: {writeText: () => Promise.reject(Error('denied'))}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: selector => selector === '.participant-row' ? [participantRow] : [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    postedActions: () => posted.join(','),
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {posted.push(JSON.parse(options.body).action); return {ok: true, json: async () => ({ok: true, config: JSON.parse(JSON.stringify(crewConfig))})}}
      return {ok: true, json: async () => JSON.parse(JSON.stringify(payload))};
    },
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const setupChecks = `(async()=>{
    document.querySelector('#endpoint').value='https://sheet.example.test/exec';
    document.querySelector('#challengeStart').value='${crewConfig.startDate}';
    document.querySelector('#tripDate').value='${crewConfig.tripDate}';
    document.querySelector('#groupGoalInput').value='500';
    await saveSetup();
    assert.equal(endpoint,'https://sheet.example.test/exec','the endpoint persisted even though the clipboard refused');
    assert.equal(localStorage.getItem('roadToSendEndpoint'),'https://sheet.example.test/exec','the endpoint reached localStorage');
    assert.equal(postedActions(),'saveConfig','the config was saved to the Sheet exactly once');
    assert.equal(document.querySelector('#setupErrors').classList.contains('hide'),true,'a denied copy never paints the setup error box');
    assert.equal(document.querySelector('#toast').textContent,'Shared setup saved. Copy the crew link from setup.','the toast reports a saved setup with an uncopied link');
    assert.equal(document.querySelector('#saveSetupBtn').disabled,false,'the Save button is released either way');
  })()`;
  await vm.runInNewContext(`${source}\n${setupChecks}`, setupContext, {filename: 'index.html'});
});

test('copyText reports a successful clipboard write and keeps the crew link deliberate', async () => {
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  const written = [];
  const copyContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/?sheet=https%3A%2F%2Fsheet.example.test%2Fexec#you', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    navigator: {clipboard: {writeText: value => {written.push(String(value)); return Promise.resolve()}}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    lastWritten: () => written[written.length - 1],
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const copyChecks = `(async()=>{
    const ok=await copyText('hello','Progress copied — paste it anywhere.');
    assert.equal(ok,true,'a resolved clipboard write reports true');
    assert.equal(lastWritten(),'hello','the text reaches the clipboard');
    assert.equal(document.querySelector('#toast').textContent,'Progress copied — paste it anywhere.','a successful copy toasts the caller message');
    endpoint='https://sheet.example.test/exec';
    assert.equal(await copyCrewLink(),true,'the crew link copy hands back the helper result');
    assert.ok(lastWritten().indexOf('sheet=')>=0,'the crew link deliberately still carries the sheet param');
    assert.equal(lastWritten().indexOf('#you'),-1,'the crew link still drops the tab hash');
    assert.equal(document.querySelector('#toast').textContent,'Crew link copied.','a copied crew link keeps its own toast');
    endpoint='';
  })()`;
  await vm.runInNewContext(`${source}\n${copyChecks}`, copyContext, {filename: 'index.html'});
});

test('a full disk never reports a saved entry as failed, and never traps the identity dialog', async () => {
  const elements = new Map();
  const listeners = new Map();
  const store = new Map();
  const today = new Date().toISOString().slice(0, 10);
  const storageContext = {
    assert, console, URL, URLSearchParams, Map, Set, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Intl, Promise,
    location: {search: '', href: 'https://example.test/app/', hash: ''},
    history: {replaceState() {}},
    window: {scrollTo() {}},
    document: {
      visibilityState: 'visible', activeElement: null,
      querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector)},
      querySelectorAll: () => [],
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener() {}, createElement: () => makeElement(),
    },
    // Safari private mode and an exhausted quota both throw here. Reads still work, which is why
    // safeJson() was never the problem — every write in the app was the unguarded half.
    fetch: async () => {throw Error('this harness makes no network calls')},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: () => {throw Error('QuotaExceededError')}, removeItem: key => store.delete(key)},
    setTimeout() {}, clearTimeout() {},
  };
  const storageChecks = `(async()=>{
    endpoint='';
    config={startDate:'${today}',tripDate:'${today}',goal:500,crew:[{name:'Alex'}]};
    logs=[];me='';recordingFor='';
    document.querySelector('#identityMember').value='Alex';
    document.querySelector('#identityModal').classList.add('open');
    saveIdentity();
    assert.equal(me,'Alex','a failed write still records the identity in memory');
    assert.equal(document.querySelector('#identityModal').classList.contains('open'),false,'and the dialog closes instead of trapping the user behind an uncaught throw');
    document.querySelector('#activityDate').value='${today}';
    document.querySelector('#recordFor').value='Alex';
    await submitActivity({preventDefault(){}});
    assert.equal(logs.length,1,'the entry is in the log either way, so it must not be reported as lost');
    assert.equal(document.querySelector('#toast').textContent,'Saved on this device only — storage is full.','the toast names the real failure instead of claiming the save failed');
    assert.equal(document.querySelector('#saveActivityBtn').textContent,'Save activity','and the button is handed back');
  })()`;
  await vm.runInNewContext(`${source}\n${storageChecks}`, storageContext, {filename: 'index.html'});
});

console.log('Client state and scoring tests passed.');
