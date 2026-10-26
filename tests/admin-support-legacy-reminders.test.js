'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {createDatabase}=require('../lib/database');const {createSupportCenter}=require('../lib/admin-support-center');
test('legacy cancellation requests import idempotently without changing originals; email reminders once per unanswered customer message',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-support-legacy-')),db=createDatabase({sqlitePath:path.join(dir,'db.sqlite'),databaseUrl:''});
 try{await db.init();const admin=await db.insertUser('Manager','manager@test.invalid','hash',Date.now(),null,{role:'admin'}),customer=await db.insertUser('Buyer','buyer@test.invalid','hash',Date.now(),null,{role:'customer'});
 const now=Date.now();await db.insertPendingOrder({orderRef:'LEG-ORDER',userId:customer,customerEmail:'buyer@test.invalid',customerPhone:'0500000000',customerJson:'{}',amountAgorot:10000,currency:'ILS',itemsJson:'[]',createdAt:now,updatedAt:now});
 const order=await db.getOrderByRef('LEG-ORDER');await db.insertCancellationRequest({requestRef:'LEG-REQ-1',orderId:order.id,orderRef:'LEG-ORDER',userId:customer,requestType:'return',name:'Buyer',email:'buyer@test.invalid',phone:'0500000000',reason:'פגום',createdAt:now-5*86400000,updatedAt:now-5*86400000});
 let sendCount=0;const center=createSupportCenter(db,{sendEmail:async()=>{sendCount++},isEmailConfigured:()=>true,ownerEmail:'manager@test.invalid'});
 let list=await center.list();assert.equal(list.count,1);assert.equal(list.tickets[0].orderRef,'LEG-ORDER');assert.equal(list.tickets[0].reason,'damaged');const importedId=list.tickets[0].id;
 assert.equal((await center.list()).count,1);assert.equal((await center.customerHistory(customer)).length,1);assert.equal((await center.detail(importedId)).messages.length,1);
 assert.equal(await center.reminders(),0,'Imported historical requests must not spam workers');
 const created=await center.create({subject:'מתי מגיע?',reason:'shipping',customerId:customer,customerEmail:'buyer@test.invalid',reminderHours:1},{id:admin,name:'Manager'});const id=created.ticket.id;
 db.db.prepare('UPDATE support_tickets SET last_customer_at=?,reminded_for_at=NULL WHERE id=?').run(now-2*3600000,id);
 assert.equal(await center.reminders(),1);assert.equal(sendCount,1);assert.equal(await center.reminders(),0);assert.equal(sendCount,1);
 await center.message(id,{kind:'customer',body:'עדיין לא ענו לי'}, {id:admin,name:'Manager'});
 db.db.prepare('UPDATE support_tickets SET last_customer_at=?,reminded_for_at=NULL WHERE id=?').run(now-2*3600000,id);
 assert.equal(await center.reminders(),1);assert.equal(sendCount,2);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM cancellation_requests').get().n,1);
 }finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
