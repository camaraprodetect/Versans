'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDatabase}=require('../lib/database');
const {createAdminTools}=require('../lib/admin-tools');
const {createAdminReporting}=require('../lib/admin-reporting');
const {createFinanceLedger}=require('../lib/finance-ledger');
const {createCreatorProgram}=require('../lib/creator-program');
const {createAdminDashboard}=require('../lib/admin-dashboard');
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-recipient-test-'));
 const db=createDatabase({sqlitePath:path.join(dir,'db.sqlite'),databaseUrl:''});
 await db.init();await createFinanceLedger(db).init();const creator=createCreatorProgram(db);await creator.init();await createAdminDashboard(db,creator).init();
 const tools=createAdminTools(db,{list:()=>[]},null);await tools.ensure();
 const report=createAdminReporting(db,tools,'owner@example.test');await report.init();
 const ownerId=await db.insertUser('Owner','owner@example.test','hash',Date.now(),null,{role:'admin'});
 const staffId=await db.insertUser('Helper','worker@example.test','hash',Date.now(),null,{role:'staff'});
 const blockedId=await db.insertUser('Blocked','blocked@example.test','hash',Date.now(),null,{role:'staff'});
 await db.db.prepare('UPDATE users SET is_blocked=1 WHERE id=?').run(blockedId);
 t.after(async()=>{await db.close();fs.rmSync(dir,{force:true,recursive:true});});
 return {db,report,owner:{id:ownerId,role:'admin',email:'owner@example.test',name:'Owner'},staff:{id:staffId,role:'staff',email:'worker@example.test',name:'Helper'},blockedId};
}
test('custom minute slots, multiple recipient IDs, external address and edit survive storage',async t=>{
 const {report,owner,staff,blockedId}=await fixture(t);
 const list=await report.recipientDirectory();assert.equal(list.length,2);
 let schedules=await report.saveSchedule(owner,{type:'sales',format:'xlsx',cadence:'daily',times:['21:05','08:23','13:47','08:23'],recipients:[{kind:'user',id:owner.id},{kind:'user',id:staff.id},{kind:'email',email:'more@example.test'}]},true);
 assert.deepEqual(schedules[0].times,['08:23','13:47','21:05']);assert.equal(schedules[0].recipients.length,3);
 schedules=await report.saveSchedule(owner,{id:schedules[0].id,type:'sales',format:'csv',cadence:'daily',times:['08:23','19:38'],recipients:[{kind:'user',id:staff.id}]},true);
 assert.deepEqual(schedules[0].times,['08:23','19:38']);assert.equal(schedules[0].recipients.length,1);
 await assert.rejects(()=>report.saveSchedule(owner,{type:'sales',format:'csv',cadence:'daily',times:['12:60'],recipients:[{kind:'user',id:owner.id}]},true),/invalid_send_times/);
 await assert.rejects(()=>report.saveSchedule(owner,{type:'sales',format:'csv',cadence:'daily',times:['12:00'],recipients:[{kind:'user',id:blockedId}]},true),/invalid_recipient_account/);
});
test('staff cannot delegate or email external recipients without approval',async t=>{
 const {report,owner,staff}=await fixture(t);
 const args={type:'sales',format:'xlsx',cadence:'daily',times:['08:23']};
 await assert.rejects(()=>report.saveSchedule(staff,{...args,recipients:[{kind:'user',id:owner.id}]},false),/sharing_not_permitted/);
 await assert.rejects(()=>report.saveSchedule(staff,{...args,recipients:[{kind:'email',email:'external@example.test'}]},true),/external_recipient_admin_only/);
 const allowed=await report.saveSchedule(staff,{...args,recipients:[{kind:'user',id:staff.id}]});assert.equal(allowed.length,1);
});
test('delivery sends once per minute slot per approved recipient, and retries do not duplicate sends',async t=>{
 const {db,report,owner,staff}=await fixture(t);
 const previous={api:process.env.RESEND_API_KEY,from:process.env.EMAIL_FROM,fetch:globalThis.fetch};
 process.env.RESEND_API_KEY='fake';process.env.EMAIL_FROM='test@versans.test';
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,payload:JSON.parse(options.body)});return {ok:true,json:async()=>({id:'mock'})};};
 t.after(()=>{if(previous.api===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previous.api;if(previous.from===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=previous.from;globalThis.fetch=previous.fetch;});
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const now=formatter.format(new Date());
 const id=(await report.saveSchedule(owner,{type:'sales',format:'csv',cadence:'daily',times:[now],recipients:[{kind:'user',id:owner.id},{kind:'user',id:staff.id}]},true))[0].id;
 await report.deliverScheduled(async()=>true);
 await report.deliverScheduled(async()=>true);
 assert.equal(calls.length,2);assert.deepEqual(calls.map(x=>x.payload.to[0]).sort(),['owner@example.test','worker@example.test']);
 const deliveries=db.db.prepare('SELECT status FROM admin_report_deliveries WHERE schedule_id=?').all(id);
 assert.equal(deliveries.length,2);assert.ok(deliveries.every(x=>x.status==='sent'));
});
