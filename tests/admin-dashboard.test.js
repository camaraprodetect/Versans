'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createDatabase}=require('../lib/database');
const {createCreatorProgram}=require('../lib/creator-program');
const {createAdminDashboard,dayKey}=require('../lib/admin-dashboard');
const {createCreatorVideos}=require('../lib/creator-videos');

async function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-dashboard-'));
  const database=createDatabase({root:dir,sqlitePath:path.join(dir,'store.sqlite')});
  t.after(async()=>{await database.close();fs.rmSync(dir,{recursive:true,force:true});});
  await database.init();const creators=createCreatorProgram(database);await creators.init();
  const creatorVideos=createCreatorVideos(database,creators);await creatorVideos.init();
  const dashboard=createAdminDashboard(database,creators);await dashboard.init();
  const ownerId=await database.insertUser('Admin','owner@versans.test','hash',Date.now(),null,{role:'admin'});
  const creatorId=await database.insertUser('Creator','creator@versans.test','hash',Date.now(),null,{role:'customer'});
  const admin={id:ownerId,name:'בעל החנות',role:'admin'};
  return {database,dashboard,creators,creatorId,admin};
}

test('monthly targets persist, and activity is filtered by permission',async(t)=>{
  const {dashboard,admin}=await fixture(t);
  const month=dayKey(Date.now()).slice(0,7);
  await dashboard.setGoal(month,500000,admin);
  await dashboard.log(admin,'products','עריכת מוצר','product-101');
  await dashboard.log(admin,'orders','טיפול בהזמנה','VS-44');
  const data=await dashboard.insights({permissions:['products']});
  assert.equal(data.goalAgorot,500000);
  assert.equal(data.monthlyRevenueAgorot,0);
  assert.equal(data.forecast.predictedAgorot,0);
  assert.equal(data.activities.some(r=>r.area==='orders'),false);
  assert.equal(data.activities.some(r=>r.area==='products'),true);
});

test('compare arbitrary inclusive ranges with no sales and validate dates',async(t)=>{
  const {dashboard}=await fixture(t);
  const result=await dashboard.insights({aFrom:'2026-09-01',aTo:'2026-09-03',bFrom:'2026-09-05',bTo:'2026-09-06'});
  assert.equal(result.comparison.a.days,3);
  assert.equal(result.comparison.b.days,2);
  assert.equal(result.comparison.a.revenueAgorot,0);
  await assert.rejects(()=>dashboard.insights({aFrom:'2026-99-44',aTo:'2026-09-03',bFrom:'2026-09-05',bTo:'2026-09-06'}),/invalid_comparison_dates/);
});

test('creator ledger pays commission once, records manual payment once, and prevents overpayment',async(t)=>{
  const {database,dashboard,creators,creatorId,admin}=await fixture(t);
  await creators.grantByEmail('creator@versans.test','TEST-NEWM',0,10,'creator.test',300);
  const creator=await database.findUserById(creatorId);
  assert.equal(creator.role,'contentcreator');
  // Commission belongs to the rate in effect when each order was paid.
  const codeRow=database.db.prepare("SELECT code FROM creator_codes WHERE user_id=?").get(creatorId);
  const row=database.db.prepare('SELECT commission_percent FROM creator_codes WHERE user_id=?').get(creatorId);
  assert.equal(row.commission_percent,10);
  const orderRef='VSDASH-'+crypto.randomUUID().slice(0,8);
  const now=Date.now();
  database.db.prepare("INSERT INTO orders(order_ref,amount_agorot,currency,items_json,status,created_at,updated_at,paid_at,coupon_code) VALUES(?,?,'ILS','[]','paid',?,?,?,?)")
    .run(orderRef,100000,now,now,now,codeRow.code);
  const first=await dashboard.creatorLiabilities();
  assert.equal(first.totalDueAgorot,10000);
  assert.equal(first.videoRewardsAvailable,true);
  const request=crypto.randomUUID();
  await dashboard.payCreator(creatorId,4000,request,'העברה בנקאית',admin);
  const expenses=await database.listAdminExpenses({});
  assert.equal(expenses.total,1);
  assert.equal(expenses.totalAgorot,4000);
  assert.equal(expenses.rows[0].category,'יוצרי תוכן');
  assert.match(expenses.rows[0].description,/תשלום ליוצר תוכן - Creator - העברה בנקאית/);
  assert.equal(expenses.rows[0].employee_name,'בעל החנות');
  assert.equal(expenses.rows[0].expense_date,dayKey(Date.now()));
  assert.equal(expenses.rows[0].maor_agorot,null);
  assert.equal(expenses.rows[0].gal_agorot,null);
  const retry=await dashboard.payCreator(creatorId,4000,request,'העברה בנקאית',admin);
  assert.equal(retry.duplicate,true);
  assert.equal((await database.listAdminExpenses({})).total,1,'idempotent retry must not double-count expense');
  const second=await dashboard.creatorLiabilities();
  assert.equal(second.totalDueAgorot,6000);
  await assert.rejects(()=>dashboard.payCreator(creatorId,6001,crypto.randomUUID(),'',admin),/payment_exceeds_balance/);
  assert.equal((await database.listAdminExpenses({})).total,1,'overpayment must not create an expense');
  const originalCreate=database.createAdminExpense;
  database.createAdminExpense=async()=>{throw new Error('expense_insert_failed');};
  try{
    await assert.rejects(()=>dashboard.payCreator(creatorId,1000,crypto.randomUUID(),'',admin),/expense_insert_failed/);
  }finally{database.createAdminExpense=originalCreate;}
  assert.equal((await database.listAdminExpenses({})).total,1);
  assert.equal((await dashboard.creatorLiabilities()).totalDueAgorot,6000,'failed expense save rolls payout back');
  assert.equal(database.db.prepare('SELECT COUNT(*) AS count FROM admin_creator_payments').get().count,1);

});
