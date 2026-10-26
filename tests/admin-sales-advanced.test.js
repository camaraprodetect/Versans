'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createDatabase}=require('../lib/database.js');const {createSalesAdvanced}=require('../lib/admin-sales-advanced.js');const {createCreatorProgram}=require('../lib/creator-program.js');
const sample=[{id:'A',slug:'product-a',title:{he:'שרשרת א'},category:'necklaces',colors:[{id:'gold',label:{he:'זהב'}}]},
{id:'B',slug:'product-b',title:{he:'צמיד ב'},category:'bracelets',colors:[{id:'silver',label:{he:'כסף'}}]}];
async function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-sales-'));const db=createDatabase({sqlitePath:path.join(dir,'test.sqlite'),databaseUrl:''});await db.init();await createCreatorProgram(db).init();
 t.after(async()=>{await db.close();fs.rmSync(dir,{recursive:true,force:true});});const service=createSalesAdvanced(db);await service.init();return {db,service};}
function addOrder(db,ref,time,items,amount,coupon=''){db.db.prepare(`INSERT INTO orders(order_ref,amount_agorot,currency,items_json,status,created_at,paid_at,updated_at,coupon_code) VALUES(?,?, 'ILS', ?, 'paid', ?, ?, ?, ?)`).run(ref,amount,JSON.stringify(items),time,time,time,coupon);}
const item=(id,qty,price,color='')=>({id,qty,unitPrice:price,lineTotal:qty*price,color});
test('aggregates hours, categories, variants, pairs, and comparisons without demo/failed orders',async t=>{
 const {db,service}=await fixture(t),now=Date.now();
 addOrder(db,'order-1',now,[item('A',2,120,'gold'),item('B',1,100,'silver')],30000);
 addOrder(db,'order-2',now-3600000,[item('A',1,120,'gold')],12000);
 addOrder(db,'VS-DEMO-8',now,[item('B',1,100,'silver')],10000);
 db.db.prepare("INSERT INTO orders(order_ref,amount_agorot,currency,items_json,status,created_at,updated_at) VALUES('failed',10000,'ILS','[]','failed',?,?)").run(now,now);
 const report=await service.load('7d',sample,now);
 assert.equal(report.paidOrders,2);assert.equal(report.paidRevenueAgorot,42000);assert.equal(report.totalUnits,4);
 assert.equal(report.categories.find(x=>x.key==='necklaces').units,3);
 assert.equal(report.variants.find(x=>x.productId==='A').units,3);
 assert.equal(report.pairs.length,1);assert.equal(report.pairs[0].orders,1);
 assert.equal(report.comparisons.find(x=>x.id==='A').days.reduce((s,d)=>s+d.units,0),3);
 assert.equal(report.hours.reduce((s,d)=>s+d.orders,0),2);
 assert.equal(report.weekdays.reduce((s,d)=>s+d.orders,0),2);
 assert.equal(report.promotion.untrackedOrders,2);
});
test('tracks 2+1 from immutable checkout snapshot, and no duplicate records',async t=>{
 const {db,service}=await fixture(t);const now=Date.now();addOrder(db,'order-3',now,[item('A',3,120)],24000);
 await service.capture('order-3',{buy2Get1Count:1,buy2Get1Discount:120});await service.capture('order-3',{buy2Get1Count:2,buy2Get1Discount:500});
 const r=await service.load('30d',sample,now);assert.equal(r.promotion.orders,1);assert.equal(r.promotion.applications,1);assert.equal(r.promotion.discountAgorot,12000);assert.equal(r.promotion.untrackedOrders,0);
});
test('source conversion attributes guest browser and refuses uncertain logged-in attribution',async t=>{
 const {db,service}=await fixture(t);const now=Date.now();const u=await db.insertUser('Buyer','buyer@example.com','hash',now-10000);
 const record=(vid,user,source)=>db.db.prepare('INSERT INTO visitor_presence(visitor_id,user_id,first_seen,last_seen,current_path,entry_path,traffic_source) VALUES(?,?,?, ?, ?, ?, ?)').run(vid,user,now-20000,now,'/','/',source);
 record('v1',null,'TikTok');record('v2',u,'Google');record('v3',u,'Instagram');
 db.db.prepare('INSERT INTO visitor_page_views(visitor_id,path,viewed_at) VALUES(?,?,?)').run('v1','/',now-1000);
 addOrder(db,'paid-guest',now,[item('A',1,120)],12000);
 db.db.prepare("UPDATE orders SET guest_visitor_id='v1' WHERE order_ref='paid-guest'").run();
 addOrder(db,'paid-registered',now,[item('B',1,100)],10000);
 db.db.prepare("UPDATE orders SET user_id=? WHERE order_ref='paid-registered'").run(u);
 const r=await service.load('30d',sample,now);
 assert.equal(r.visitors,3);assert.equal(r.buyers,1);assert.equal(r.traffic.find(x=>x.source==='TikTok').buyers,1);assert.equal(r.unattributedOrders,1);
});
test('no customer personal data appears in aggregate results',async t=>{
 const {db,service}=await fixture(t);const now=Date.now();addOrder(db,'unique-test-ref',now,[item('A',1,120)],12000);
 const result=JSON.stringify(await service.load('today',sample,now));assert.equal(result.includes('unique-test-ref'),false);
});
