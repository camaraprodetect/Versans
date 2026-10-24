'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createDatabase}=require('../lib/database');
const {createCreatorProgram}=require('../lib/creator-program');
const {createCreatorVideos}=require('../lib/creator-videos');
const {createAdminDashboard}=require('../lib/admin-dashboard');
const {createAdminCreatorCrm}=require('../lib/admin-creator-crm');
async function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-crm-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const db=createDatabase({root:dir,sqlitePath:path.join(dir,'store.db')});t.after(()=>db.close());await db.init();const cp=createCreatorProgram(db);await cp.init();await createCreatorVideos(db,cp).init();const dashboard=createAdminDashboard(db,cp);await dashboard.init();const owner=await db.insertUser('Admin','owner@versans.test','hash',Date.now(),null,{role:'admin'});const creatorId=await db.insertUser('Tester','influencer@example.test','hash',Date.now(),null,{role:'customer'});const crm=createAdminCreatorCrm(db);await crm.init();const actor={id:owner,name:'Admin'};return {db,cp,crm,actor,creatorId,dashboard};}
test('candidate created with contact reply and documents, no fake sales',async t=>{const f=await fixture(t);const c=await f.crm.createProfile({name:'Creator Potential',email:'candidate@test.com'},f.actor);await f.crm.contact(c.id,{channel:'tiktok',contactedAt:'2026-10-24',repliedAt:'2026-10-24',replyStatus:'agreed',note:'סוכם על פוסט'},f.actor);const bytes=Buffer.from('%PDF-example-creator-agreement');const d=await f.crm.addDocument(c.id,{name:'הסכם.pdf',mime:'application/pdf',base64:bytes.toString('base64')},f.actor);assert.equal((await f.crm.document(c.id,d.id)).buffer.toString(),bytes.toString());const result=await f.crm.detail(c.id);assert.equal(result.profile.status,'candidate');assert.equal(result.profile.orders,0);assert.equal(result.profile.roiPercent,null);assert.equal(result.contacts[0].reply_status,'agreed');assert.equal(result.documents.length,1);assert.equal(result.history.length,3);await assert.rejects(f.crm.updateProfile(c.id,{status:'active'},f.actor),/creator_account_required/);});
test('existing creators auto-migrate and revenue/commission and payments counted once',async t=>{const f=await fixture(t);await f.cp.grantByEmail('influencer@example.test','INFLUENCER',0,10,'influencer.tiktok',300);const all=await f.crm.list();assert.equal(all.length,1);let p=all[0];assert.equal(p.status,'active');const now=Date.now();f.db.db.prepare("INSERT INTO orders(order_ref,amount_agorot,status,created_at,updated_at,paid_at,coupon_code) VALUES('VS-CRM-01',100000,'paid',?,?,?,?)").run(now,now,now,'INFLUENCER');p=(await f.crm.list())[0];assert.equal(p.revenueAgorot,100000);assert.equal(p.commissionAgorot,10000);assert.equal(p.dueAgorot,10000);await f.crm.addCost(p.id,{label:'קמפיין סרטון',amountAgorot:2000,spentOn:'2026-10-24'},f.actor);p=(await f.crm.list())[0];assert.equal(p.attributionMarginAgorot,88000);assert.equal(p.roiPercent,733.33);const request=crypto.randomUUID();await f.dashboard.payCreator(f.creatorId,3000,request,'Bit',f.actor,'BIT-XYZ-01');p=(await f.crm.list())[0];assert.equal(p.dueAgorot,7000);assert.equal(p.attributionMarginAgorot,88000,'payout is not double counted');const detail=await f.crm.detail(p.id);assert.equal(detail.payments[0].reference,'BIT-XYZ-01');assert.equal((await f.db.listAdminExpenses({})).totalAgorot,3000);await f.dashboard.payCreator(f.creatorId,3000,request,'Bit',f.actor,'BIT-XYZ-01');assert.equal((await f.db.listAdminExpenses({})).total,1);});
test('pausing stops codes without deleting earnings; resume restores latest only',async t=>{const f=await fixture(t);await f.cp.grantByEmail('influencer@example.test','FIRSTCREATOR',0,10,'tiktok.user',300);await f.cp.grantByEmail('influencer@example.test','SECOND-CREATOR',0,10,'tiktok.user',300);const p=(await f.crm.list())[0];await f.crm.updateProfile(p.id,{status:'paused'},f.actor);assert.equal(f.db.db.prepare('SELECT COUNT(*) as n FROM creator_codes WHERE user_id=? AND active=1').get(f.creatorId).n,0);await f.crm.updateProfile(p.id,{status:'active'},f.actor);const active=f.db.db.prepare('SELECT code FROM creator_codes WHERE user_id=? AND active=1').all(f.creatorId);assert.deepEqual(active.map(x=>x.code),['SECOND-CREATOR']);});
test('reject invalid upload, invalid contact, and unknown campaign expense',async t=>{const f=await fixture(t);const c=await f.crm.createProfile({name:'Candidate Name'},f.actor);await assert.rejects(f.crm.addDocument(c.id,{name:'bad.pdf',mime:'application/pdf',base64:Buffer.from('not a PDF').toString('base64')},f.actor),/document_format_mismatch/);await assert.rejects(f.crm.contact(c.id,{contactedAt:'2026-17-10'},f.actor),/invalid_contact_dates|Invalid time value/);await assert.rejects(f.crm.deleteCost(c.id,1234,f.actor),/campaign_cost_not_found/);});
test('prospect linked by email to registered creator, without creating duplicate CRM rows',async t=>{
 const f=await fixture(t);
 const p=await f.crm.createProfile({name:'Prospect via TikTok',email:'influencer@example.test'},f.actor);
 await f.cp.grantByEmail('influencer@example.test','REGISTER-CODE',0,10,'tt.username',300);
 const linked=await f.crm.touchUser(f.creatorId,'active');
 assert.equal(linked,p.id);
 const all=await f.crm.list();assert.equal(all.length,1);assert.equal(all[0].userId,f.creatorId);assert.equal(all[0].status,'active');
});
test('30-day conversion ranks only attributable UTM sessions and matching paid visitors',async t=>{
 const f=await fixture(t);await f.cp.grantByEmail('influencer@example.test','CAMPAIGN-CODE',0,10,'tt.username',300);
 const now=Date.now();
 for(const id of ['tracked-1','tracked-2']){
  f.db.db.prepare('INSERT INTO visitor_presence(visitor_id,first_seen,last_seen,current_path,entry_path) VALUES(?,?,?,?,?)').run(id,now,now,'/','/');
  f.db.db.prepare('INSERT INTO visitor_page_views(visitor_id,path,utm_campaign,viewed_at) VALUES(?,?,?,?)').run(id,'/','CAMPAIGN-CODE',now);
 }
 f.db.db.prepare("INSERT INTO orders(order_ref,guest_visitor_id,amount_agorot,status,created_at,updated_at,paid_at,coupon_code) VALUES('VS-ATTR',?,10000,'paid',?,?,?,?)").run('tracked-1',now,now,now,'CAMPAIGN-CODE');
 const x=(await f.crm.list())[0];assert.equal(x.conversionVisitors,2);assert.equal(x.conversionBuyers,1);assert.equal(x.conversionPercent,50);
});
test('confirmed finance refunds reduce creator ROI but pending and cancelled refunds do not',async t=>{
 const f=await fixture(t),{createFinanceLedger}=require('../lib/finance-ledger');const finance=createFinanceLedger(f.db);await finance.init();
 await f.cp.grantByEmail('influencer@example.test','CREATOR-REF',0,10,'tt.username',300);const now=Date.now();
 f.db.db.prepare("INSERT INTO orders(order_ref,amount_agorot,status,created_at,updated_at,paid_at,coupon_code) VALUES('VS-REF',100000,'paid',?,?,?,?)").run(now,now,now,'CREATOR-REF');
 const p=(await f.crm.list())[0];await f.crm.addCost(p.id,{label:'קמפיין',amountAgorot:10000,spentOn:'2026-10-24'},f.actor);
 f.db.db.prepare("INSERT INTO admin_order_refunds(order_ref,amount_agorot,status,actor_name,created_at,request_id) VALUES('VS-REF',20000,'pending','admin',?,?)").run(now,crypto.randomUUID());
 assert.equal((await f.crm.list())[0].attributionMarginAgorot,80000);
 f.db.db.prepare("UPDATE admin_order_refunds SET status='confirmed',confirmed_at=? WHERE order_ref='VS-REF'").run(now);
 assert.equal((await f.crm.list())[0].attributionMarginAgorot,60000);
 f.db.db.prepare('UPDATE admin_order_refunds SET cancelled_at=? WHERE order_ref=?').run(now,'VS-REF');
 assert.equal((await f.crm.list())[0].attributionMarginAgorot,80000);
});
