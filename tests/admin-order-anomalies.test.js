'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {computeSignals,getReviews,saveReview}=require('../lib/admin-order-anomalies');
const {createDatabase}=require('../lib/database');
const base=Date.UTC(2026,9,22,12);
function order(ref,options={}) {
  return {
    id:Number(options.id||1),order_ref:ref,created_at:base+(options.minutes||0)*60000,
    paid_at:base+(options.minutes||0)*60000,status:options.status||'paid',
    customer_phone: options.phone===undefined?'0501234567':options.phone,
    customer_email:options.email===undefined?'buyer@example.com':options.email,
    amount_agorot:options.amount===undefined?15000:options.amount,
    items_json:JSON.stringify(options.items===undefined?[{id:'product-1',qty:1,unitPrice:150,lineTotal:150,color:'black'}]:options.items),
    ...options.extra
  };
}
test('same customer + same cart + amount within 30 mins detects potential double-paid checkout',()=>{
  const rows=[order('VS-A'),order('VS-B',{minutes:8,id:2})];
  const signals=computeSignals(rows);
  assert.equal(signals.length,1);
  assert.equal(signals[0].orderRef,'VS-B');
  assert.equal(signals[0].severity,'high');
  assert.ok(signals[0].reasons.some(r=>r.code==='duplicate_paid'));
});
test('different cart, customer, or longer gap does not create duplicate alert',()=>{
  const variants=[order('VS-1'),order('VS-2',{id:2,minutes:1,phone:'0521234567',email:'other@example.com'}),
    order('VS-3',{id:3,minutes:3,items:[{id:'product-1',qty:2,unitPrice:150,lineTotal:300,color:'black'}],amount:30000}),
    order('VS-4',{id:4,minutes:33})];
  assert.equal(computeSignals(variants).length,0);
});
test('normal discount below catalog gross does not trigger price warnings',()=>{
  const rows=[order('VS-DISCOUNT',{amount:10000,items:[{id:'product-1',qty:1,unitPrice:150,lineTotal:150}]})];
  assert.equal(computeSignals(rows).length,0);
});
test('extreme mismatch and zero-paid amount are flagged',()=>{
  const rows=[order('VS-HIGH',{amount:45000}),order('VS-ZERO',{id:2,phone:'0539999999',email:'zero@example.com',amount:0})];
  const flags=computeSignals(rows);
  assert.ok(flags.some(f=>f.reasons.some(r=>r.code==='high_price_mismatch')));
  assert.ok(flags.some(f=>f.reasons.some(r=>r.code==='invalid_total')));
});
test('four failed attempts in thirty minutes signal review, 3 do not',()=>{
  const rows=[0,5,11,18].map((minute,i)=>order('VS-F-'+i,{minutes:minute,id:i+1,status:'failed'}));
  const flags=computeSignals(rows);
  assert.equal(flags.length,1);
  assert.equal(flags[0].orderRef,'VS-F-3');
  assert.equal(flags[0].reasons[0].code,'repeated_failed_payments');
});
test('missing identity does not join anonymous guests; unknown item totals are not compared',()=>{
  const rows=[order('VS-G1',{phone:'',email:'',extra:{user_id:null},items:[{id:'product-1',qty:1}],amount:10000}),order('VS-G2',{id:2,minutes:5,phone:'',email:'',extra:{user_id:null},items:[{id:'product-1',qty:1}],amount:10000})];
  assert.equal(computeSignals(rows).length,0);
});
test('review state saved in SQLite persists and supports clearing a review',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-anomaly-'));
  const db=createDatabase({sqlitePath:path.join(dir,'local.sqlite'),databaseUrl:''});
  try {
    await db.init();
    assert.equal((await getReviews(db)).size,0);
    await saveReview(db,'VS-1','reviewed','נבדק','Admin');
    assert.deepEqual((await getReviews(db)).get('VS-1').state,'reviewed');
    await saveReview(db,'VS-1','dismissed','רכישה חוזרת תקינה','Admin');
    assert.equal((await getReviews(db)).get('VS-1').note,'רכישה חוזרת תקינה');
    await saveReview(db,'VS-1','open','','Admin');
    assert.equal((await getReviews(db)).has('VS-1'),false);
  } finally {await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('server and UI integrate anomaly page through authenticated admin surface',()=>{
  const root=path.join(__dirname,'..');
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const page=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  const client=fs.readFileSync(path.join(root,'assets/admin.js'),'utf8');
  assert.match(server,/getAdminUser\(req\)/);
  assert.match(server,/\/api\/admin\/order-anomalies/);
  assert.match(server,/ADMIN_PAGES.*anomalies/);
  assert.match(page,/\/admin\/anomalies/);
  assert.match(page,/admin-anomalies\.js/);
  assert.match(client,/VersansAnomalies\.render/);
});
