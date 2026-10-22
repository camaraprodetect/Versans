'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {SqliteStore}=require('../lib/database.js');
const {createFinanceLedger}=require('../lib/finance-ledger.js');

async function fixture(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vs-finance-'));
  const store=new SqliteStore(path.join(tmp,'ledger.db'));
  await store.init();
  const actorId=Number(store.db.prepare("INSERT INTO users(name,email,password_hash,created_at,role) VALUES('Bookkeeper','books@versans.test','hash',1,'admin') RETURNING id").get().id);
  const actor={id:actorId,name:'Bookkeeper'};
  store.db.exec('CREATE TABLE admin_creator_payments(id INTEGER PRIMARY KEY,request_id TEXT NOT NULL UNIQUE)');
  const finance=createFinanceLedger(store);await finance.init();
  return {store,finance,actor,tmp,close:()=>{try{store.db.close();}catch(_){}fs.rmSync(tmp,{recursive:true,force:true});}};
}
const payload=(date='2026-10-23')=>({description:'אריזות',category:'אריזות',amount:'120.00',maorAmount:'70.00',galAmount:'50.00',date});
test('editing, cancellation and audit exclude voided expenses from totals, preserve old value',async t=>{
  const f=await fixture();t.after(f.close);
  const id=await f.store.createAdminExpense({...{description:'תשלום שליח',category:'משלוחים',amountAgorot:12000,maorAgorot:7000,galAgorot:5000,expenseDate:'2026-10-23',employeeUserId:f.actor.id,employeeName:'Bookkeeper',requestId:'a8888888-0000-0000-0000-000000000001',createdAt:Date.now()}});
  await f.finance.modifyExpense(id,'edit',{...payload(),amount:'150.00',maorAmount:'100.00'},f.actor);
  let r=await f.store.listAdminExpenses();assert.equal(r.totalAgorot,15000);assert.equal(r.maorAgorot,10000);
  await f.finance.modifyExpense(id,'cancel',{reason:'הוצאה כפולה'},f.actor);
  r=await f.store.listAdminExpenses();assert.equal(r.total,1);assert.equal(r.totalAgorot,0);assert.equal(r.rows[0].amount_agorot,15000);assert.ok(r.rows[0].cancelled_at);
  const h=await f.finance.expenseHistory(id);assert.deepEqual(h.map(x=>x.action),['cancel','edit']);
  await assert.rejects(f.finance.modifyExpense(id,'edit',payload(),f.actor),/expense_already_cancelled/);
});
test('recurring expenses generate on due date only once, pause stops further instances',async t=>{
  const f=await fixture();t.after(f.close);
  const id=await f.finance.createRecurring({...payload('2026-01-30'),dayOfMonth:31},f.actor);
  assert.ok(id);
  assert.equal(await f.finance.generateRecurring('2026-03-30'),2); // Jan 31, Feb 28; Mar31 not due
  assert.equal(await f.finance.generateRecurring('2026-03-30'),0);
  assert.equal(await f.finance.generateRecurring('2026-03-31'),1);
  let data=await f.store.listAdminExpenses();assert.equal(data.total,3);assert.equal(data.totalAgorot,36000);
  await f.finance.setRecurringActive(id,false);assert.equal(await f.finance.generateRecurring('2026-04-30'),0);
});
test('refunds never exceed verified order; pending do not reduce net; confirmations are auditable',async t=>{
  const f=await fixture();t.after(f.close);
  f.store.db.prepare("INSERT INTO orders(order_ref,amount_agorot,status,created_at,updated_at,paid_at) VALUES('VS-001',10000,'paid',1,1,2)").run();
  const body={orderRef:'VS-001',amount:'40.00',providerReference:'',note:'מוצר חזר',requestId:'a8888888-0000-0000-0000-000000000002'};
  const id=await f.finance.createRefund(body,f.actor);
  assert.equal(id,await f.finance.createRefund(body,f.actor));
  let summary=await f.finance.refundList();assert.equal(summary.pendingAgorot,4000);assert.equal(summary.confirmedAgorot,0);
  await assert.rejects(f.finance.createRefund({...body,amount:'70',requestId:'a8888888-0000-0000-0000-000000000003'},f.actor),/refund_exceeds_paid_amount/);
  await assert.rejects(f.finance.updateRefund(id,'confirm',{},f.actor),/provider_reference_required/);
  await f.finance.updateRefund(id,'confirm',{providerReference:'HYP-CREDIT-1'},f.actor);
  summary=await f.finance.refundList();assert.equal(summary.confirmedAgorot,4000);
  await f.finance.updateRefund(id,'cancel',{reason:'נרשם בטעות'},f.actor);
  summary=await f.finance.refundList();assert.equal(summary.confirmedAgorot,0);
  assert.equal((await f.finance.exportCsv('refunds')).includes('נרשם בטעות'),true); // cancellation reason is retained for accountant
});
test('category aggregation and safe UTF8 CSV Excel escaping',async t=>{
  const f=await fixture();t.after(f.close);
  await f.store.createAdminExpense({description:'=SUM(1+2)',category:'פרסום ושיווק',amountAgorot:9950,maorAgorot:null,galAgorot:null,expenseDate:'2026-10-15',employeeUserId:f.actor.id,employeeName:f.actor.name,requestId:'a8888888-0000-0000-0000-000000000004',createdAt:2});
  const c=await f.finance.categorySummary('2026-10-01','2026-10-31');assert.equal(c[0].category,'פרסום ושיווק');assert.equal(Number(c[0].amount_agorot),9950);
  const csv=await f.finance.exportCsv('expenses','2026-10-01','2026-10-31');assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/"'=SUM\(1\+2\)"/);
});
