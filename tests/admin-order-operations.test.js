'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDatabase}=require('../lib/database');const {createAdminOrderOperations}=require('../lib/admin-order-operations');
test('workflow persistence, locking, notes, packing and verified customer delivery',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-order-operations-'));
 const db=createDatabase({sqlitePath:path.join(dir,'main.db'),databaseUrl:''});try{
 await db.init();const user=await db.insertUser('Admin','orders@testing.invalid','pw',Date.now(),null,{role:'admin'});
 const now=Date.now();const id=await db.insertPendingOrder({orderRef:'WO-101',userId:user,customerEmail:'orders@testing.invalid',customerPhone:'0501111111',customerJson:'{}',itemsJson:JSON.stringify([{id:'test-1',qty:2,name:'שרשרת',unitPrice:120,lineTotal:240}]),amountAgorot:24000,currency:'ILS',createdAt:now,updatedAt:now});await db.markOrderPaid(now,id);
 const actor={id:user,name:'Admin'},worker={id:user+1,name:'Other'};
 const op=createAdminOrderOperations(db,{shipmentsForOrder:async()=>[],products:[],isEmailConfigured:()=>false});await op.init();const order=await op.readOrder('WO-101');
 assert.equal((await op.inspect(order)).stage,'waiting');await assert.rejects(()=>op.addNote(order,actor,'token-a','שלום'),/claim_order_first/);
 await op.lock(order,actor,'token-a','claim');await assert.rejects(()=>op.lock(order,worker,'token-b','claim'),/order_locked/);await assert.rejects(()=>op.addNote(order,worker,'token-b','שלום'),/order_locked/);
 await op.addNote(order,actor,'token-a','הערה פנימית');assert.equal((await op.notes(order))[0].body,'הערה פנימית');
 await op.setStage(order,actor,'token-a','ordered');assert.equal((await op.inspect(order)).stage,'ordered');
 await assert.rejects(()=>op.setStage(order,actor,'token-a','packing'),/products_not_all_received/);
 await assert.rejects(()=>op.checkUnit(order,actor,'token-a',{itemIndex:0,unitNumber:1,checked:true}),/unit_not_received/);
 await db.markPackagingUnit(id,0,1,true,null,now);await db.markPackagingUnit(id,0,2,true,null,now);
 await op.setStage(order,actor,'token-a','packing');await op.checkUnit(order,actor,'token-a',{itemIndex:0,unitNumber:1,checked:true});await op.checkUnit(order,actor,'token-a',{itemIndex:0,unitNumber:2,checked:true});
 const ready=await op.inspect(order);assert.equal(ready.canVerify,true);assert.equal(ready.packed,2);
 await op.verifyPacking(order,actor,'token-a');await assert.rejects(()=>op.setStage(order,actor,'token-a','delivered','receipt'),/must_ship_before_delivering/);
 await op.setStage(order,actor,'token-a','shipped','customer-tracking-123');await op.setStage(order,actor,'token-a','delivered','signed-by-recipient');const done=await op.inspect(order);
 assert.equal(done.stage,'delivered');assert(done.verifiedAt);assert(done.audit.some(x=>x.action==='stage_delivered'));
 await op.lock(order,actor,'token-a','release');await op.lock(order,worker,'token-b','claim');assert.equal((await op.notes(order)).length,1);
 }finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('incoming provider delivered is not customer delivered; suspicious duplicates are advisory',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-order-check-'));const db=createDatabase({sqlitePath:path.join(dir,'db.sqlite'),databaseUrl:''});try{await db.init();const now=Date.now();const orderId=await db.insertPendingOrder({orderRef:'WO-200',userId:null,customerEmail:'same@example.invalid',customerPhone:'0502222222',customerJson:'{}',itemsJson:JSON.stringify([{id:'p1',qty:1,name:'צמיד',unitPrice:100,lineTotal:100}]),amountAgorot:10000,currency:'ILS',createdAt:now,updatedAt:now});await db.markOrderPaid(now,orderId);
 const op=createAdminOrderOperations(db,{shipmentsForOrder:async()=>[{status:'delivered',deliveredAt:now,registeredAt:now,trackingNumber:'WH-DELIVERED'}],products:[]});
 const order=await op.readOrder('WO-200');const report=await op.inspect(order,{nearbyOrders:[{id:orderId+1,order_ref:'WO-201',customer_email:'same@example.invalid',amount_agorot:10000,created_at:now,status:'paid'}]});assert.notEqual(report.stage,'delivered');assert.equal(report.duplicates.length,1);}
 finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
