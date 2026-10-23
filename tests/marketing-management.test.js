'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createDatabase}=require('../lib/database');const {createMarketingManager}=require('../lib/marketing-manager');const {createMarketingMedia}=require('../lib/marketing-media');
const pricing=require('../assets/pricing');const policy=require('../lib/employee-access');
async function fixture(run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-marketing-test-'));const db=createDatabase({sqlitePath:path.join(dir,'app.sqlite'),databaseUrl:''});await db.init();try{return await run(db);}finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}}
const row=(category,qty=1,price=139.9)=>({categories:[category],qty,price});
test('legacy promotions preserve 2+1, glasses and hats totals',()=>{
 assert.equal(pricing.calculate([row('bracelets',3,130)]).total,260);
 assert.equal(pricing.calculate([row('hats',2)]).total,239.9);
 assert.equal(pricing.calculate([row('hats',3)]).total,299.9);
 assert.equal(pricing.calculate([row('glasses',2)]).total,249.9);
});
test('custom bundle rules can disable or override original offers',()=>{
 assert.equal(pricing.calculate([row('hats',3)],{bundleRules:[]}).total,419.7);
 assert.equal(pricing.calculate([row('hats',2)],{bundleRules:[{kind:'fixed',category:'hats',quantity:2,price:200}]}).total,200);
 assert.equal(pricing.calculate([row('bracelets',3,130)],{bundleRules:[{kind:'fixed',category:'hats',quantity:3,price:300}]}).total,390);
});
test('fixed and percentage coupons apply after quantity discounts',()=>{
 assert.equal(pricing.calculate([row('hats',2)],{couponAmount:30}).total,209.9);
 assert.equal(pricing.calculate([row('hats',2)],{couponPercent:10}).total,215.91);
 assert.equal(pricing.calculate([row('hats',2)],{couponAmount:1000}).total,0);
});
test('management creates and edits a coupon without affecting the original catalog',async()=>fixture(async db=>{
 const manager=createMarketingManager(db);assert.equal((await manager.read()).bundles.length,4);
 let state=await manager.edit('coupons','create',{code:'HOLIDAY15',type:'percent',value:15,active:true,maxUses:3});
 const id=state.coupons[0].id;assert.ok(await manager.getCoupon('HOLIDAY15',null));
 await manager.edit('coupons','update',{...state.coupons[0],id,value:20});
 assert.equal((await manager.getCoupon('HOLIDAY15',null)).value,20);
 assert.equal((await createMarketingManager(db).read()).coupons[0].value,20);
}));
test('coupons respect date, active status, and specific customer emails',async()=>fixture(async db=>{
 const m=createMarketingManager(db),today=Date.now();
 await m.edit('coupons','create',{code:'CLIENT40',type:'fixed',value:40,active:true,startsAt:today-500,endsAt:today+86400000,allowedEmails:'client@example.com'});
 assert.equal(await m.getCoupon('CLIENT40',null),null);
 assert.equal(await m.getCoupon('CLIENT40',{email:'else@example.com'}),null);
 assert.ok(await m.getCoupon('CLIENT40',{email:'CLIENT@example.com'}));
 const c=(await m.read()).coupons[0];await m.edit('coupons','update',{...c,active:false});
 assert.equal(await m.getCoupon('CLIENT40',{email:'client@example.com'}),null);
}));
test('coupon cap counts both reserved and paid orders and is idempotent',async()=>fixture(async db=>{
 const m=createMarketingManager(db);
 await m.edit('coupons','create',{code:'LIMITONE',value:5,maxUses:1,active:true});
 let coupon=await m.getCoupon('LIMITONE',null);assert.ok(coupon);
 await db.transaction(tx=>m.reserve(tx,coupon,'order-one'));
 assert.equal(await m.getCoupon('LIMITONE',null),null);
 await db.transaction(tx=>m.reserve(tx,coupon,'order-one'));
 await assert.rejects(db.transaction(tx=>m.reserve(tx,coupon,'order-two')),/coupon_limit_reached/);
 await db.transaction(tx=>m.redeem(tx,'LIMITONE','order-one',Date.now()));
 await db.transaction(tx=>m.redeem(tx,'LIMITONE','order-one',Date.now()));
 assert.equal(await m.usage(coupon.id),1);
 assert.equal(await m.getCoupon('LIMITONE',null),null);
}));
test('content is scheduled and invisible to public visitors until active',async()=>fixture(async db=>{
 const m=createMarketingManager(db),now=Date.now();
 await m.edit('banners','create',{title:'Future hero',mediaType:'image',mediaUrl:'/assets/promo-videos/jewelry-2plus1.jpg',location:'hero',active:true,startsAt:now+100000});
 await m.edit('popups','create',{title:'Now',mediaType:'video',mediaUrl:'/assets/promo-videos/jewelry-2plus1.mp4',active:true});
 assert.equal((await m.publicConfig(now)).banners.length,0);assert.equal((await m.publicConfig(now)).popups.length,1);
 assert.equal((await m.publicConfig(now+100001)).banners.length,1);
}));
test('media uploads reject unsupported file and persist PNG',async()=>fixture(async db=>{
 const mm=createMarketingMedia(db);
 await assert.rejects(mm.upload('image/svg+xml',Buffer.from('<svg/>').toString('base64')),/unsupported_media_type/);
 await assert.rejects(mm.upload('image/png',Buffer.from('not a png').toString('base64')),/invalid_media/);
 const png=Buffer.from('89504e470d0a1a0a0000000049454e44ae426082','hex');
 const saved=await mm.upload('image/png',png.toString('base64'));
 assert.match(saved.url,/^\/api\/marketing\/media\//);
 assert.deepEqual((await createMarketingMedia(db).get(saved.url.split('/').pop())).buffer,png);
}));
test('staff marketing permission separates read and write access',()=>{
 const staff={role:'staff',permissions:['marketing.view']};
 assert.ok(policy.allowed(staff,'/api/admin/marketing','GET'));
 assert.equal(policy.allowed(staff,'/api/admin/marketing','POST'),false);
 assert.equal(policy.allowed(staff,'/api/admin/marketing/media','POST'),false);
 assert.ok(policy.allowed({...staff,permissions:['marketing.view','marketing.edit']},'/api/admin/marketing/media','POST'));
});
