'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createDatabase}=require('../lib/database');
const {createCreatorProgram}=require('../lib/creator-program');
const {mediaInventory,couponInventory}=require('../lib/marketing-legacy-inventory');
async function fixture(fn){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'versans-old-marketing-'));const database=createDatabase({sqlitePath:path.join(folder,'db.sqlite'),databaseUrl:''});await database.init();await createCreatorProgram(database).init();try{await fn(database);}finally{await database.close();fs.rmSync(folder,{recursive:true,force:true});}}
test('all legacy popup offers and homepage collection banners appear without being imported',()=>{
  const items=mediaInventory();
  assert.equal(items.popups.length,6);
  assert.ok(items.popups.find(x=>x.id==='legacy-popup-signup'&&x.mediaUrl.endsWith('signup-3-percent.mp4')));
  assert.ok(items.popups.find(x=>x.id==='legacy-popup-jewelry'));
  assert.ok(items.banners.find(x=>x.id==='legacy-banner-desktop-hero'));
  assert.ok(items.banners.find(x=>x.id==='legacy-banner-mobile-hero'));
  assert.ok(items.banners.find(x=>x.id==='legacy-banner-hatsCollectionBanner'));
  assert.ok(items.banners.find(x=>x.id==='legacy-banner-hats-hero-3'));
  assert.equal(new Set(items.banners.map(x=>x.id)).size,items.banners.length);
});
test('personal welcome coupons include all statuses, usage and linked customer, without changing them',()=>fixture(async db=>{
  const now=Date.now();
  const id=await db.insertUser('Test client','client@example.com','hash',now);
  const id2=await db.insertUser('Other client','other@example.com','hash',now);
  await db.insertCoupon({code:'WELCOMEACTIVE',userId:id,kind:'welcome',discountPercent:3,createdAt:now-1000,expiresAt:now+86400000});
  await db.insertCoupon({code:'WELCOMEEXPIRED',userId:id2,kind:'welcome',discountPercent:3,createdAt:now-2000,expiresAt:now-1000});
  const usedId=await db.insertCoupon({code:'WELCOMEUSED',userId:id,kind:'welcome',discountPercent:3,createdAt:now-3000,expiresAt:now+86400000});
  await db.markCouponUsed(usedId,id,'VS-PAID-123',now-100);
  const result=await couponInventory(db,{showCustomers:true,showCreators:true,now});
  assert.equal(result.personal.total,3);assert.equal(result.personal.usable,1);assert.equal(result.personal.used,1);
  assert.equal(result.personal.items.find(x=>x.code==='WELCOMEACTIVE').status,'available');
  assert.equal(result.personal.items.find(x=>x.code==='WELCOMEEXPIRED').status,'expired');
  assert.equal(result.personal.items.find(x=>x.code==='WELCOMEUSED').status,'used');
  assert.equal(result.personal.items.find(x=>x.code==='WELCOMEUSED').usedOrderRef,'VS-PAID-123');
  const search=await couponInventory(db,{showCustomers:true,showCreators:true,query:'other@example.com'});
  assert.equal(search.personal.matched,1);assert.equal(search.personal.items[0].code,'WELCOMEEXPIRED');
  assert.equal((await db.getWelcomeCouponForUser(id)).code,'WELCOMEUSED');
}));
test('staff without customer and creator access gets aggregate counts but never personal codes/emails',()=>fixture(async db=>{
  const id=await db.insertUser('Secret client','secret@example.com','hash',Date.now());
  await db.insertCoupon({code:'SECRET123',userId:id,kind:'welcome',discountPercent:3,createdAt:Date.now(),expiresAt:Date.now()+100000});
  const creatorId=await db.insertUser('Creator','creator@example.com','hash',Date.now(),null,{role:'contentcreator'});
  db.db.prepare('INSERT INTO creator_codes(code,user_id,discount_percent,commission_percent,active,created_at) VALUES (?,?,?,?,?,?)').run('CREATOR15',creatorId,15,10,1,Date.now());
  const limited=await couponInventory(db,{showCustomers:false,showCreators:false});
  assert.equal(limited.personal.total,1);assert.equal(limited.personal.restricted,true);assert.deepEqual(limited.personal.items,[]);
  assert.equal(limited.creators.total,1);assert.deepEqual(limited.creators.items,[]);
  assert.ok(!JSON.stringify(limited).includes('secret@example.com'));
  assert.ok(!JSON.stringify(limited).includes('CREATOR15'));
  const full=await couponInventory(db,{showCustomers:true,showCreators:true});
  assert.equal(full.creators.items[0].code,'CREATOR15');
}));
