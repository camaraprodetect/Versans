'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createDatabase}=require('../lib/database');
const {createPrizeWheel,PRIZES,orderRef}=require('../lib/prize-wheel');
async function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-prize-'));const db=createDatabase({sqlitePath:path.join(dir,'data.sqlite'),databaseUrl:''});await db.init();try{return await fn(db);}finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}}
async function paidOrder(db,ref='KW-TEST-123'){const now=Date.now();return db.upsertPaidOrder({orderRef:ref,userId:null,customerEmail:'buyer@example.test',customerPhone:'+972501234567',amountAgorot:25990,currency:'ILS',itemsJson:'[]',createdAt:now,paidAt:now,updatedAt:now});}
test('seven advertised probabilities sum to 100%',()=>{assert.equal(PRIZES.reduce((n,x)=>n+x.weight,0),10000);assert.equal(PRIZES.find(x=>x.key==='OFF15').weight,7000);assert.ok(PRIZES.filter(x=>!x.percent).every(x=>x.weight>0));});
test('gift awards exactly match published prizes and their odds',()=>{
  assert.deepEqual(PRIZES.filter(x=>!x.percent).map(({key,label,weight})=>({key,label,weight})),[
    {key:'TENNIS',label:'צמיד טניס במתנה',weight:60},
    {key:'NECKLACE',label:'שרשרת טניס במתנה',weight:30},
    {key:'SUNGLASSES_2',label:'2 זוגות משקפי שמש במתנה',weight:10}
  ]);
  assert.equal(PRIZES.some(x=>x.key==='RING'||x.label.includes('טבעת')),false);
  const html=fs.readFileSync(path.join(__dirname,'../prizes.html'),'utf8');
  const client=fs.readFileSync(path.join(__dirname,'../assets/prizes.js'),'utf8');
  assert.match(html,/שרשרת טניס במתנה<\/span><b>0\.3%/);
  assert.match(html,/צמיד טניס במתנה<\/span><b>0\.6%/);
  assert.match(html,/2 זוגות משקפי שמש במתנה<\/span><b>0\.1%/);
  assert.match(client,/2 זוגות משקפי שמש/);
  assert.doesNotMatch(html+client,/טבעת/);
});
test('a historic ring award remains readable but can never be drawn again',async()=>fixture(async db=>{
  await paidOrder(db);const w=createPrizeWheel(db);await w.init();
  db.db.prepare(`INSERT INTO prize_wheel_claims(order_ref,prize_key,email,created_at,email_sent_at) VALUES(?,?,?,?,?)`).run('KW-TEST-123','RING','buyer@example.test',Date.now(),Date.now());
  const prize=await w.draw('KW-TEST-123','4567');
  assert.equal(prize.key,'RING');assert.equal(prize.label,'טבעת במתנה');assert.equal(prize.winIndex,null);
  assert.equal(PRIZES.some(p=>p.key==='RING'),false);
}));
test('suffix from parcel ref is stripped, normal order number unchanged',()=>{assert.equal(orderRef(' kw-test-123-p01 '),'KW-TEST-123');assert.equal(orderRef('KW-TEST-123-P02'),'KW-TEST-123');assert.equal(orderRef('KW-TEST-123'),'KW-TEST-123');});
test('paid orders including historic VS-DEMO orders require matching phone',async()=>fixture(async db=>{
  const w=createPrizeWheel(db);await paidOrder(db);
  await assert.rejects(w.status('KW-TEST-123','9999'),/order_not_verified/);
  await assert.rejects(w.status('KW-OTHER','4567'),/order_not_verified/);
  assert.equal((await w.status('KW-TEST-123-P01','4567')).eligible,true);
  await paidOrder(db,'VS-DEMO-123');
  await assert.rejects(w.status('VS-DEMO-123','9999'),/order_not_verified/);
  assert.deepEqual(await w.status('VS-DEMO-123-P01','4567'),{eligible:true,alreadyPlayed:false,preview:false});
}));
test('a historic VS-DEMO order draws a real, persistent prize and emails its order address',async()=>fixture(async db=>{
  await paidOrder(db,'VS-DEMO-123');const deliveries=[];
  const w=createPrizeWheel(db,{isEmailConfigured:()=>true,sendEmail:async info=>{deliveries.push(info);return {id:'sent'};}});
  const first=await w.draw('VS-DEMO-123-P02','4567');
  assert.equal(first.preview,false);
  assert.equal(first.emailSent,true);
  assert.equal(deliveries.length,1);
  assert.equal(deliveries[0].to,'buyer@example.test');
  assert.equal(deliveries[0].subject,'VerSans | הפרס שלך מגלגל המזל');
  const stored=db.db.prepare('SELECT * FROM prize_wheel_claims WHERE order_ref=?').get('VS-DEMO-123');
  assert.ok(stored && stored.email_sent_at);
  assert.equal(stored.prize_key,first.key);
  if(first.percent){
    assert.match(first.couponCode,/^VSW-[A-F0-9]{18}$/);
    assert.equal(stored.coupon_code,first.couponCode);
    assert.ok(await w.coupon(first.couponCode,'buyer@example.test'));
    assert.match(deliveries[0].text,new RegExp(first.couponCode));
  }else{
    assert.equal(first.couponCode,null);
    assert.match(deliveries[0].text,/תיאום/);
  }
  const second=await w.draw('VS-DEMO-123','4567');
  assert.equal(second.key,first.key);
  assert.equal(second.couponCode,first.couponCode);
  assert.equal(deliveries.length,1);
  assert.equal((await w.status('VS-DEMO-123','4567')).alreadyPlayed,true);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM prize_wheel_claims').get().n,1);
}));
test('old paid orders with phone inside customer_json are eligible',async()=>fixture(async db=>{
  await paidOrder(db,'KW-OLD-123');
  db.db.prepare('UPDATE orders SET customer_phone=NULL,customer_json=? WHERE order_ref=?').run(JSON.stringify({phone:'+972501234567'}),'KW-OLD-123');
  const w=createPrizeWheel(db);
  assert.equal((await w.status('KW-OLD-123','4567')).eligible,true);
  assert.equal((await w.status('KW-OLD-123','4567')).preview,false);
}));
test('one stable draw and personal prize email to purchase address',async()=>fixture(async db=>{await paidOrder(db);const sent=[];const w=createPrizeWheel(db,{sendEmail:async obj=>{sent.push(obj);return {id:'test'};},isEmailConfigured:()=>true,ownerEmail:null});const first=await w.draw('KW-TEST-123','4567');const second=await w.draw('KW-TEST-123-P02','4567');assert.equal(first.key,second.key);assert.equal((await w.status('KW-TEST-123','4567')).alreadyPlayed,true);assert.equal(sent[0].to,'buyer@example.test');assert.equal(sent.length,1);if(first.percent){assert.match(first.couponCode,/^VSW-[A-F0-9]{18}$/);assert.ok(await w.coupon(first.couponCode,'buyer@example.test'));assert.equal(await w.coupon(first.couponCode,'other@example.test'),null);}else{assert.equal(first.couponCode,null);}}));
test('a coupon is for the original email, one use only, with atomic reservation',async()=>fixture(async db=>{await paidOrder(db);const w=createPrizeWheel(db);let result;for(let i=0;i<10;i++){await paidOrder(db,'KW-TEST-'+i);result=await w.draw('KW-TEST-'+i,'4567');if(result.couponCode)break;}assert.ok(result.couponCode);const code=result.couponCode;assert.equal(await w.coupon(code,'different@example.test'),null);await db.transaction(tx=>w.reserve(tx,code,'buyer@example.test','NEW-ORDER',Date.now()));assert.equal(await w.coupon(code,'buyer@example.test'),null);await assert.rejects(db.transaction(tx=>w.reserve(tx,code,'buyer@example.test','OTHER-ORDER',Date.now())),/prize_coupon_unavailable/);await db.transaction(tx=>w.redeem(tx,code,'NEW-ORDER',Date.now()));assert.equal(await w.coupon(code,'buyer@example.test'),null);}));
test('email delivery failure leaves the prize intact and retry is idempotent',async()=>fixture(async db=>{await paidOrder(db);let calls=0;const w=createPrizeWheel(db,{isEmailConfigured:()=>true,sendEmail:async()=>{calls++;if(calls===1)throw new Error('simulated failure');return {id:'ok'};}});const a=await w.draw('KW-TEST-123','4567');assert.equal(a.emailSent,false);const b=await w.draw('KW-TEST-123','4567');assert.equal(b.emailSent,true);assert.equal(a.key,b.key);assert.equal(calls,2);}));
