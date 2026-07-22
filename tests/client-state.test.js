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
  assert.equal(scored.totals.get('alex'),6);

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

console.log('Client state and scoring tests passed.');
