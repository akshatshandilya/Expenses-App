import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney,parseQty,mul,fmt,rs} from '../../src/core/money.js';
import {addMonths,validDate,validMonth,pad} from '../../src/core/dates.js';
import {S,replaceState,blank} from '../../src/data/state.js';
import {spent,catSpent,priceOn,setPrice,sum} from '../../src/core/rules.js';
import {buildCsv,csvCell} from '../../src/core/csv.js';

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
test('CSV export neutralises spreadsheet formulas and quotes properly',()=>{
  assert.match(csvCell('=SUM(A1)'),/^"?'=/);assert.match(csvCell('+1'),/^"?'\+/);assert.match(csvCell('@x'),/^"?'@/);
  assert.equal(csvCell('a,b'),'"a,b"');assert.equal(csvCell('say "hi"'),'"say ""hi"""');
  replaceState(blank());S.records=[rec({cat:'water',date:'2026-10-01',amountP:12000,notes:'=1+1'})];
  const out=buildCsv();assert.ok(out.split('\n').length>=2);assert.ok(!/(^|,)=1\+1/.test(out));
});
