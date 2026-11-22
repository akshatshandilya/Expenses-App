import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney,parseQty,mul,fmt,rs} from '../../src/core/money.js';
import {addMonths,monthDate,validDate,validMonth,pad} from '../../src/core/dates.js';
import {S,replaceState,blank,migrateState,tenantProfiles,paymentDueLabel} from '../../src/data/state.js';
import {spent,catSpent,priceOn,setPrice,sum,travelCostPerKm} from '../../src/core/rules.js';
import {buildCsv,csvCell,csvMonths,csvCount} from '../../src/core/csv.js';
import {addDays,monthlyReminderError,reminderError,reminderNotificationTime,reminderOccurrencesForDueDate,validReminderTime} from '../../src/core/reminders.js';

test('money parsing is exact and strict',()=>{
  assert.equal(parseMoney('60'),6000);assert.equal(parseMoney('62.5'),6250);assert.equal(parseMoney('1,050'),105000);
  assert.equal(parseMoney('0.1')+parseMoney('0.2'),parseMoney('0.3'));
  for(const bad of ['','abc','-5','1.234','1e3','₹5','  '])assert.equal(parseMoney(bad),null,bad);
});
test('quantity x unit price (water: 3 x ₹60 = ₹180)',()=>{
  assert.equal(mul(parseQty('3'),parseMoney('60')),18000);
  assert.equal(fmt(mul(parseQty('3'),parseMoney('60'))),'₹180');
  assert.equal(mul(parseQty('10'),parseMoney('105')),105000);            // fuel 10 L x ₹105
  assert.equal(mul(parseQty('5'),parseMoney('60')),30000);               // groceries 5 kg x ₹60
  assert.equal(mul(parseQty('0.333'),parseMoney('10')),333);             // 3.33 -> rounds half-up to the paisa
  assert.equal(mul(parseQty('0.5'),parseMoney('0.01')),1);               // 0.005 -> 0.01 (half-up)
  assert.equal(rs(18000),'180');assert.equal(rs(6250),'62.50');
});
test('dates: month and year transitions, leap years',()=>{
  assert.equal(addMonths('2026-12',1),'2027-01');assert.equal(addMonths('2026-01',-1),'2025-12');assert.equal(addMonths('2026-10',-22),'2024-12');
  assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2100-02-29'),false);assert.equal(validDate('2000-02-29'),true);
  assert.equal(validDate('2026-04-31'),false);assert.equal(validMonth('2026-13'),false);assert.equal(validMonth('2026-12'),true);
  assert.equal(monthDate('2026-02',31),'2026-02-28');assert.equal(monthDate('2028-02',31),'2028-02-29');
});
test('bill reminders validate custom dates and calculate lead and overdue dates',()=>{
  assert.equal(reminderError('2026-03-19','custom','20'),'Set reminder before due date.');
  assert.equal(reminderError('2026-03-19','custom','18'),'');
  assert.equal(reminderError('','1day',''),'Choose a due date for the reminder.');
  assert.equal(reminderError('2026-02-28','custom','30'),'Set reminder before due date.');
  assert.equal(monthlyReminderError(19,'custom','20'),'Set reminder before due date.');
  assert.equal(monthlyReminderError(19,'custom','18'),'');
  assert.equal(reminderError('2026-03-19',['3days','due','custom'],'18'),'');
  assert.equal(reminderError('2026-03-19',['3days','custom'],'20'),'Set reminder before due date.');
  assert.equal(reminderError('2026-03-19','due','',''),'Choose a reminder time.');
  assert.equal(reminderError('2026-03-19','due','','18:45'),'');
  assert.equal(monthlyReminderError(19,'due','','25:90'),'Choose a reminder time.');
  assert.equal(validReminderTime('00:00'),true);assert.equal(validReminderTime('23:59'),true);
  assert.equal(validReminderTime('24:00'),false);assert.equal(validReminderTime('9:00'),false);
  assert.equal(reminderError('2026-03-19',['due','due'],''),'Choose a reminder timing.');
  assert.deepEqual(reminderOccurrencesForDueDate('2026-03-19',['3days','due','overdue'],''),[
    {mode:'3days',date:'2026-03-16',repeatDaily:false},
    {mode:'due',date:'2026-03-19',repeatDaily:false},
    {mode:'overdue',date:'2026-03-20',repeatDaily:true}
  ]);
  assert.deepEqual(reminderOccurrencesForDueDate('2026-03-19',['1day','custom'],'18'),[
    {mode:'1day',date:'2026-03-18',repeatDaily:false}
  ]);
  assert.deepEqual(reminderOccurrencesForDueDate('2026-03-19',[],'18'),[]);
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
});
test('reminder schedules honor local time and never send a missed one-off reminder late',()=>{
  assert.deepEqual(reminderNotificationTime('2026-03-19',undefined,false,new Date(2026,2,19,9,59)),new Date(2026,2,19,10,0));
  assert.deepEqual(reminderNotificationTime('2026-03-19','18:45',false,new Date(2026,2,19,18,44)),new Date(2026,2,19,18,45));
  assert.equal(reminderNotificationTime('2026-03-19','18:45',false,new Date(2026,2,19,18,46)),null);
  assert.deepEqual(reminderNotificationTime('2026-03-19','18:45',true,new Date(2026,2,19,18,46)),new Date(2026,2,20,18,45));
  assert.equal(reminderNotificationTime('2026-03-18','18:45',true,new Date(2026,2,19,18,46)),null);
});
const rec=(o)=>Object.assign({id:Math.random()+'',notes:'',ts:1},o);
test('monthly totals: only real money in the selected month, rent received and unpaid bills excluded, distance never counted',()=>{
  replaceState(blank());
  S.records=[
    rec({cat:'water',date:'2026-10-01',amountP:12000}),rec({cat:'water',date:'2026-10-05',amountP:18000}),rec({cat:'water',date:'2026-10-12',amountP:6000}),
    rec({cat:'travel',date:'2026-10-10',amountP:105000,sub:'fuel'}),rec({cat:'travel',date:'2026-10-10',amountP:18000,sub:'toll'}),
    rec({cat:'water',date:'2026-09-30',amountP:99900}),rec({cat:'water',date:'2026-11-01',amountP:99900}),
    rec({cat:'rent',date:'2026-10-02',dir:'received',amountP:1400000}),
    rec({cat:'electricity',date:'2026-10-20',period:'2026-10',status:'due',amountP:250000}),
    rec({cat:'electricity',date:'2026-10-21',period:'2026-09',amountP:70000}) // billing month rule: counts in September
  ];
  S.dist=[{id:'d1',date:'2026-10-10',km:42000}];
  assert.equal(catSpent('2026-10','water'),36000);                       // 120 + 180 + 60 = ₹360
  assert.equal(catSpent('2026-10','travel'),123000);                     // fuel + toll only
  assert.equal(spent('2026-10'),159000);
  assert.equal(spent('2026-09'),99900+70000);
  assert.equal(sum([]),0);
});
test('paid mobile bills count in their billing month while advance unpaid bills do not',()=>{
  replaceState(blank());
  S.records=[
    rec({cat:'mobilebill',date:'2026-10-15',period:'2026-10',amountP:79900,status:'paid'}),
    rec({cat:'mobilebill',date:'2026-11-20',period:'2026-11',amountP:79900,status:'due'})
  ];
  assert.equal(catSpent('2026-10','mobilebill'),79900);
  assert.equal(catSpent('2026-11','mobilebill'),0);
});
test('changing the default price never rewrites saved records',()=>{
  replaceState(blank());
  setPrice('water',6000,'all');
  S.records=[rec({cat:'water',date:'2026-10-01',qty:2000,unitP:6000,amountP:12000})];
  setPrice('water',6500,'dated');
  assert.equal(S.records[0].unitP,6000);assert.equal(S.records[0].amountP,12000);
  assert.equal(S.prices.water.cur,6500);
  assert.equal(priceOn('water','2026-01-01'),6000);                       // before the change: old price
  assert.equal(priceOn('water','2099-01-01'),6500);                       // after: new price
});
test('travel cost per km uses linked expenses and distance only',()=>{
  replaceState(blank());
  S.dist=[
    {id:'trip1',date:'2026-10-01',kmM:10000},
    {id:'trip2',date:'2026-10-02',kmM:20000},
    {id:'trip3',date:'2026-10-03',kmM:40000},
    {id:'trip4',date:'2026-09-30',kmM:10000}
  ];
  S.records=[
    rec({cat:'travel',sub:'fuel',journeyId:'trip1',date:'2026-10-01',amountP:100000}),
    rec({cat:'travel',sub:'toll',journeyId:'trip1',date:'2026-10-01',amountP:20000}),
    rec({cat:'travel',sub:'fuel',journeyId:'trip2',date:'2026-10-02',amountP:300000}),
    rec({cat:'travel',sub:'toll',journeyId:'trip2',date:'2026-10-02',amountP:50000,status:'due'}),
    rec({cat:'travel',sub:'fuel',journeyId:'trip4',date:'2026-09-30',amountP:90000}),
    rec({cat:'travel',sub:'fuel',date:'2026-10-02',amountP:999999})
  ];
  assert.equal(travelCostPerKm('2026-10'),14000);
  assert.equal(travelCostPerKm('2026-09'),9000);
  assert.equal(travelCostPerKm('2026-08'),null);
});
test('legacy state gains Auto and Cabs routes once without undoing a later deletion',()=>{
  const old=blank();old.features={};delete old.routes;old.cats=old.cats.filter(c=>c.id!=='cab');
  assert.equal(migrateState(old),true);
  assert.deepEqual(old.routes.map(r=>r.name),['Home to Office','Office to Home','Others']);
  assert.equal(old.cats.findIndex(c=>c.id==='cab'),old.cats.findIndex(c=>c.id==='other')-1);
  assert.equal(old.features.autoCabs,1);
  old.cats=old.cats.filter(c=>c.id!=='cab');
  assert.equal(migrateState(old),false);
  assert.equal(old.cats.some(c=>c.id==='cab'),false);
});
test('legacy state gains Mobile Bill once and does not restore it after deletion',()=>{
  const old=blank();old.features={};old.cats=old.cats.filter(c=>c.id!=='mobilebill');delete old.mobileBills;
  assert.equal(migrateState(old),true);
  assert.equal(old.cats.some(c=>c.id==='mobilebill'),true);
  assert.deepEqual(old.mobileBills,[]);
  assert.equal(old.features.mobileBillCategory,1);
  old.cats=old.cats.filter(c=>c.id!=='mobilebill');
  assert.equal(migrateState(old),false);
  assert.equal(old.cats.some(c=>c.id==='mobilebill'),false);
});
test('tenant profiles normalize legacy names and retain agreement data',()=>{
  assert.deepEqual(tenantProfiles({tenants:['Asha Rao',{name:'Ben Singh',agStart:'2026-01-01',rentAmountP:700000,reminder:'due'}]}),[
    {name:'Asha Rao',agStart:'',agEnd:'',rentAmountP:null,dueBy:'first',dueDay:null,reminder:[],reminderDay:null,reminderTime:'10:00'},
    {name:'Ben Singh',agStart:'2026-01-01',agEnd:'',rentAmountP:700000,dueBy:'first',dueDay:null,reminder:['due'],reminderDay:null,reminderTime:'10:00'}
  ]);
  assert.equal(paymentDueLabel({dueBy:'first'}),'1st of every month');
  assert.equal(paymentDueLabel({dueBy:'seventh'}),'7th of every month');
  assert.equal(paymentDueLabel({dueBy:'custom',dueDay:12}),'12th of every month');
});
test('CSV export can be limited to one month or a range, and the month list starts at the first data',()=>{
  replaceState(blank());S.records=[rec({cat:'water',date:'2026-07-05',amountP:100}),rec({cat:'water',date:'2026-08-10',amountP:200}),rec({cat:'rent',dir:'paid',date:'2026-10-01',period:'2026-09',amountP:300}),rec({cat:'water',date:'2026-10-20',amountP:400})];S.dist=[{id:'d1',date:'2026-08-15',kmM:1000,ts:1}];
  const ms=csvMonths();assert.equal(ms[0],'2026-07');assert.ok(ms.includes('2026-08')&&ms.includes('2026-09')&&ms.includes('2026-10'));assert.ok(ms.every((m,i)=>!i||m>ms[i-1]));
  const lines=o=>buildCsv(o).split('\n').length-1;
  assert.equal(lines(),5);assert.equal(lines({from:'2026-08',to:'2026-08'}),2);
  assert.equal(lines({from:'2026-09',to:'2026-09'}),1);/* rent paid in October for September counts as September */
  assert.equal(lines({from:'2026-07',to:'2026-09'}),4);assert.equal(csvCount({from:'2026-07',to:'2026-09'}),4);assert.equal(csvCount({from:'2020-01',to:'2020-02'}),0);
});
test('CSV export neutralises spreadsheet formulas and quotes properly',()=>{
  assert.match(csvCell('=SUM(A1)'),/^"?'=/);assert.match(csvCell('+1'),/^"?'\+/);assert.match(csvCell('@x'),/^"?'@/);
  assert.equal(csvCell('a,b'),'"a,b"');assert.equal(csvCell('say "hi"'),'"say ""hi"""');
  replaceState(blank());S.houses=[{id:'h1',name:'Maple Court'}];S.records=[rec({cat:'water',date:'2026-10-01',amountP:12000,notes:'=1+1'}),rec({cat:'rent',dir:'received',houseId:'h1',party:'Maple Court',tenant:'Asha Rao',date:'2026-10-01',period:'2026-10',amountP:12000})];
  const out=buildCsv();assert.ok(out.split('\n').length>=3);assert.ok(!/(^|,)=1\+1/.test(out));assert.match(out.split('\n')[0],/tenant/);assert.ok(out.includes('Asha Rao'));
});
