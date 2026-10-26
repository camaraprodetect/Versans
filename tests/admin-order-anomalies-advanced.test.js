'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const path=require('node:path');const os=require('node:os');
const {createDatabase}=require('../lib/database');
const anomalies=require('../lib/admin-order-anomalies');
const time=Date.UTC(2026,9,26,10);
function order(ref,{minute=0,status='paid',phone='0501234567',address=null,unitPrice=120,qty=1,amount=12000}={}){
  return {id:minute+1,order_ref:ref,created_at:time+minute*60000,paid_at:time+minute*60000,status,
    customer_phone:phone,customer_email:phone+'@test.invalid',
    customer_json:address?JSON.stringify(address):'{}',
    amount_agorot:amount,items_json:JSON.stringify([{id:'product-10',qty,unitPrice,lineTotal:unitPrice*qty}])};
}
const address={city:'רמת גן',street:'הרצל',houseNumber:'13',apartment:'2',country:'ישראל'};
test('same address three orders with multiple identities flags case, other apartment does not',()=>{
  const flags=anomalies.computeSignals([order('A',{address}),order('B',{minute:1,address,phone:'0522222222'}),order('C',{minute:3,address,phone:'0533333333'}),order('D',{minute:5,address:{...address,apartment:'6'}})]);
  assert.deepEqual(flags.filter(x=>x.reasons.some(r=>r.code==='shared_shipping_address')).map(x=>x.orderRef),['C']);
});
test('failure streak resets after a successful payment',()=>{
  const rows=[0,1,2].map(i=>order('F'+i,{minute:i,status:'failed'}));
  rows.push(order('P',{minute:3}));
  rows.push(...[4,5,6].map(i=>order('G'+i,{minute:i,status:'failed'})));
  assert.equal(anomalies.computeSignals(rows).some(x=>x.reasons.some(r=>r.code==='repeated_failed_payments')),false);
});
test('custom high order and suspicious unit price are optional, free gifts skipped',()=>{
  const rows=[order('PRICE',{amount:150000,unitPrice:3}),order('GIFT',{minute:1,phone:'0531234567',unitPrice:0,amount:100000})];
  const normal=anomalies.computeSignals(rows);
  assert(!normal.some(x=>x.reasons.some(r=>r.code==='custom_low_unit_price')));
  const alerts=anomalies.computeSignals(rows,[],{rules:{highOrderEnabled:true,highOrderAgorot:100000,minUnitPriceEnabled:true,minUnitPriceAgorot:1000}});
  const price=alerts.find(x=>x.orderRef==='PRICE');
  assert(price.reasons.some(x=>x.code==='custom_high_order'));
  assert(price.reasons.some(x=>x.code==='custom_low_unit_price'));
  assert(!alerts.some(x=>x.orderRef==='GIFT'&&x.reasons.some(r=>r.code==='custom_low_unit_price')));
});
test('verified gateway amount difference emits alert only with verified evidence',()=>{
  const row=order('GATEWAY',{amount:20000});
  assert(!anomalies.computeSignals([row]).some(x=>x.reasons.some(r=>r.code==='gateway_amount_mismatch')));
  const evid=new Map([['GATEWAY',{verified_amount_agorot:19000}]]);
  const flags=anomalies.computeSignals([row],[],{gatewayEvidence:evid});
  assert(flags[0].reasons.some(r=>r.code==='gateway_amount_mismatch'));
});
test('permanent settings/case assignee/history/gateway across SQLite restart',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'vs-anomaly-advanced-')),f=path.join(dir,'test.sqlite');
  try{
    let db=createDatabase({sqlitePath:f,databaseUrl:''});await db.init();
    await anomalies.saveRules(db,{highOrderEnabled:true,highOrderAgorot:100000},'owner');
    await anomalies.saveReview(db,'A','dismissed','legacy','owner');
    await anomalies.saveCase(db,'A','confirmed','מקרה אמיתי',23,'owner');
    await anomalies.saveCase(db,'A','false_positive','התברר כתקין',23,'worker');
    await anomalies.recordGatewayMismatch(db,'A',10100,9900);
    await anomalies.recordGatewayMismatch(db,'B',9900,9900);
    assert.equal((await anomalies.getGatewayEvidence(db)).size,1);
    await db.close();db=createDatabase({sqlitePath:f,databaseUrl:''});await db.init();
    assert.equal((await anomalies.getRules(db)).highOrderEnabled,true);
    assert.equal((await anomalies.getCases(db)).get('A').state,'false_positive');
    assert.equal((await anomalies.getReviews(db)).get('A').state,'dismissed','legacy data must remain untouched');
    const h=await anomalies.caseHistory(db,'A');assert.equal(h.length,2);assert.equal(h[0].actor,'worker');
    assert.equal((await anomalies.getGatewayEvidence(db)).get('A').verified_amount_agorot,10100);
    await db.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid rules are rejected',()=>{assert.equal(anomalies.validateRules({addressOrders:0}),null);assert.equal(anomalies.validateRules({highOrderEnabled:'yes'}),null);});
