'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createDatabase}=require('../lib/database');const {createSupportCenter}=require('../lib/admin-support-center');
test('support center persists linked tickets, responses, templates and replacement, with accurate analytics',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-support-'));const db=createDatabase({sqlitePath:path.join(dir,'app.sqlite'),databaseUrl:''});
 try{await db.init();const ownerId=await db.insertUser('Admin','owner@testing.invalid','pw',Date.now(),null,{role:'admin'});const customerId=await db.insertUser('Customer','buyer@testing.invalid','pw',Date.now(),null,{role:'customer'});
 const staffId=await db.insertUser('Worker','staff@testing.invalid','pw',Date.now(),null,{role:'staff'});const time=Date.now();await db.insertPendingOrder({orderRef:'SUP-ORDER-1',userId:customerId,customerEmail:'buyer@testing.invalid',customerPhone:'0501234567',customerJson:'{}',amountAgorot:16000,currency:'ILS',itemsJson:'[]',createdAt:time,updatedAt:time});
 const support=createSupportCenter(db,{sendEmail:async()=>{},isEmailConfigured:()=>false,ownerEmail:'owner@testing.invalid'});await support.init();const actor={id:ownerId,name:'Admin'};
 const made=await support.create({subject:'מוצר פגום',reason:'damaged',customerId,orderRef:'SUP-ORDER-1',assigneeId:staffId,body:'הצמיד הגיע שבור'},actor);
 assert.equal(made.ticket.status,'open');assert.equal(made.ticket.customerId,customerId);assert.equal(made.messages.length,1);const id=made.ticket.id;
 const changed=await support.update(id,{status:'in_progress',assigneeId:staffId},actor,{mayAssign:true});assert.equal(changed.ticket.status,'in_progress');
 await assert.rejects(()=>support.update(id,{assigneeId:9999},actor,{mayAssign:true}),/assignee_not_active/);
 await assert.rejects(()=>support.update(id,{assigneeId:staffId},actor,{mayAssign:false}),/unsupported_field/);
 await assert.rejects(()=>support.create({subject:'הזמנה לא שלי',reason:'shipping',customerId,orderRef:'NONE'},actor),/order_not_found/);
 let reply=await support.message(id,{kind:'staff',body:'שלחנו הודעה ללקוח',channel:'whatsapp'},actor);assert(reply.ticket.firstResponseAt);assert.equal(reply.ticket.overdue,false);
 const replacement=await support.replacement(id,{productName:'צמיד',quantity:1,status:'approved',trackingNumber:'TRACK-1'},actor);assert.equal(replacement.replacement.status,'approved');
 await support.saveTemplate({title:'תגובה מותאמת',channel:'email',body:'שלום {name}'},actor);assert((await support.templates()).some(x=>x.title==='תגובה מותאמת'));
 const listing=await support.list({search:'buyer@testing.invalid'});assert.equal(listing.count,1);
 const metrics=await support.overview();assert.equal(metrics.statuses.in_progress,1);assert.equal(metrics.reasons[0].reason,'damaged');assert.equal(metrics.respondedTickets,1);
 assert.equal((await support.customerHistory(customerId))[0].id,id);assert.equal((await support.reminders()),0);
 await db.close();const reopen=createDatabase({sqlitePath:path.join(dir,'app.sqlite'),databaseUrl:''});await reopen.init();const s2=createSupportCenter(reopen,{sendEmail:async()=>{},isEmailConfigured:()=>false,ownerEmail:''});assert.equal((await s2.detail(id)).replacement.tracking_number,'TRACK-1');await reopen.close();
 }finally{try{await db.close();}catch(e){}fs.rmSync(dir,{recursive:true,force:true});}
});
