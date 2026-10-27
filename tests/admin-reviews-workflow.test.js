'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {createDatabase}=require('../lib/database');
const {createReviewWorkflow}=require('../lib/admin-review-workflow');
const {createAdminOrderOperations}=require('../lib/admin-order-operations');
async function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-review-workflow-'));const db=createDatabase({sqlitePath:path.join(dir,'shop.db'),databaseUrl:''});
 try{await db.init();const workflow=createReviewWorkflow(db,[{id:'bracelet-1',slug:'bracelet-1',title:'צמיד טניס',category:'צמידים'}]);await workflow.init();return await fn({db,workflow});}
 finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}}
async function makePaid(db,ref,userId,createdAt=Date.now()){const orderId=await db.insertPendingOrder({orderRef:ref,userId,customerEmail:'review@test.invalid',customerPhone:'0501234567',customerJson:'{"firstName":"דנה"}',amountAgorot:20000,currency:'ILS',itemsJson:JSON.stringify([{id:'bracelet-1',qty:1}]),createdAt,updatedAt:createdAt});await db.markOrderPaid(createdAt,orderId);return orderId;}
test('reviews remain publicly published with official replies, orders and audit; hide is reversible',async()=>fixture(async({db,workflow})=>{
 const user=await db.insertUser('דנה','review@test.invalid','pw',Date.now());const orderId=await makePaid(db,'VS-001',user);
 const id=await db.insertReview({userId:user,reviewName:'דנה',contactPhone:'0501234567',reviewProductId:'bracelet-1',reviewProductVariant:'כסף',rating:2,body:'משלוח הגיע מאוחר',reviewDate:Date.now(),createdAt:Date.now(),updatedAt:Date.now()});
 const actor={id:user,name:'מנהל'};
 assert.equal(await workflow.autoLink(id,user,'bracelet-1'),'VS-001');assert.equal((await workflow.metadata([id]))[id].orderRef,'VS-001');
 await workflow.patch(id,actor,{action:'reply',text:'נשמח לעזור לך'});
 await workflow.patch(id,actor,{action:'service',required:true});
 assert.equal((await workflow.metadata([id]))[id].reply,'נשמח לעזור לך');assert.equal((await workflow.metadata([id]))[id].needsService,true);
 assert.equal((await workflow.stats()).categories[0].average,2);
 assert.equal((await workflow.stats()).rate,100);
 await assert.rejects(()=>workflow.patch(id,actor,{action:'hide',reason:'לא'}),/deletion_reason_required/);
 await workflow.patch(id,actor,{action:'hide',reason:'ממתינה לבירור כפילות חשבונות'});
 assert.equal((await db.listReviews(50,0)).length,0);assert.equal((await workflow.hidden()).length,1);
 assert((await workflow.history(id)).some(e=>e.action==='hidden'&&e.actor==='מנהל'));
 await workflow.patch(id,actor,{action:'restore'});
 assert.equal((await db.listReviews(50,0)).length,1);
 assert.equal((await workflow.hidden()).length,0);
 assert((await workflow.history(id)).some(e=>e.action==='restored'));
}));
test('manual review request is due only after 48h of explicitly confirmed customer receipt',async()=>fixture(async({db,workflow})=>{
 const user=await db.insertUser('דנה','review@test.invalid','pw',Date.now());const orderId=await makePaid(db,'VS-002',user);
 await db.createShipment({orderId,trackingNumber:'WH-TEST',status:'delivered',provider:'17track',createdAt:Date.now(),updatedAt:Date.now()});
 const operations=createAdminOrderOperations(db,{products:[],shipmentsForOrder:()=>[],isEmailConfigured:()=>false});await operations.init();
 assert.equal((await workflow.requests()).length,0,'supplier delivery must not trigger a review request');
 const at=await workflow.receipt(await db.getOrderByRef('VS-002'));assert(at>0);
 let list=await workflow.requests();assert.equal(list.length,1);assert.equal(list[0].status,'pending');assert(!list[0].isDue);
 assert(list[0].whatsappUrl.startsWith('https://web.whatsapp.com/send?phone=972501234567&text='));
 // Use the preserved due date; no automatic outbound WhatsApp message.
 db.db.prepare('UPDATE admin_review_requests SET confirmed_at=?,due_at=? WHERE order_id=?').run(at-3*86400000,at-86400000,orderId);
 list=await workflow.requests();assert(list[0].isDue);
 await workflow.updateRequest(orderId,{id:user,name:'מנהל'},'sent');
 list=await workflow.requests();assert.equal(list[0].status,'sent');
 assert.equal((await workflow.updateRequest(orderId,{id:user,name:'מנהל'},'sent')).already,true);
}));
test('review linked to another user order is denied, and silent pending status is not sent',async()=>fixture(async({db,workflow})=>{
 const a=await db.insertUser('א','first@test.invalid','pw',Date.now()),b=await db.insertUser('ב','second@test.invalid','pw',Date.now());
 await makePaid(db,'VS-OTHER',b);
 const id=await db.insertReview({userId:a,reviewName:'א',contactPhone:'0504444444',reviewProductId:'bracelet-1',reviewProductVariant:null,rating:5,body:'מעולה',reviewDate:Date.now(),createdAt:Date.now(),updatedAt:Date.now()});
 await assert.rejects(()=>workflow.patch(id,{id:a,name:'מנהל'},{action:'link',orderRef:'VS-OTHER'}),/order_not_verified_for_review/);
 const stats=await workflow.stats();assert.equal(stats.reviewingCustomers,0);
}));
