'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');const {spawn}=require('node:child_process');
const {createDatabase}=require('../lib/database'),{createEmployeeAccess}=require('../lib/employee-access');
async function freePort(){return new Promise(res=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});}
async function serverFixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-reports-api-')),sql=path.join(dir,'db.sqlite'),db=createDatabase({sqlitePath:sql,databaseUrl:''});await db.init();const owner=await db.insertUser('Owner','camaraprodetect@gmail.com','hash',Date.now()),staff=await db.insertUser('Staff','staff@example.test','hash',Date.now(),null,{role:'staff'});
const access=createEmployeeAccess(db);await access.write(staff,['reports.view','customers.view','orders.view']);const tokens={};for(const [key,id] of Object.entries({owner,staff})){const token=key+'-'+crypto.randomUUID(),hash=crypto.createHash('sha256').update(token).digest('hex');await db.insertSession(id,hash,Date.now(),Date.now()+3600000);tokens[key]=token;}
const now=Date.now();db.db.prepare("INSERT INTO orders(order_ref,amount_agorot,status,created_at,updated_at,paid_at) VALUES (?,?, 'paid',?,?,?)").run('VS-PAID-API',33000,now,now,now);
await db.close();const port=await freePort(),child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,DATABASE_URL:'',VERSANS_DB_PATH:sql,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'test',RESEND_API_KEY:'',EMAIL_FROM:''},stdio:['ignore','pipe','pipe']});let log='';child.stderr.on('data',d=>log+=d.toString());const base=`http://127.0.0.1:${port}`;
for(let i=0;i<100;i++){try{const r=await fetch(base+'/');if(r.status)break;}catch(_){await new Promise(r=>setTimeout(r,40));}}
t.after(async()=>{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));fs.rmSync(dir,{recursive:true,force:true});});
return {base,tokens,access,sql,log:()=>log};}
function hdr(token){return {Cookie:'versans_session='+encodeURIComponent(token),Accept:'application/json'};}
test('owner can download XLSX, CSV and PDF source and staff cannot export without permission',async t=>{const f=await serverFixture(t);const get=(p,who='owner')=>fetch(f.base+p,{headers:hdr(f.tokens[who])});
  const url='/api/admin/report-download?type=period_comparison&groupBy=month&format=xlsx';const excel=await get(url);assert.equal(excel.status,200);const workbook=Buffer.from(await excel.arrayBuffer());assert.equal(workbook.subarray(0,4).toString('hex'),'504b0304');
  const csv=await get('/api/admin/report-download?type=period_comparison&format=csv');assert.equal(csv.status,200);assert.match(await csv.text(),/תקופה/);
  const pdfSource=await get('/api/admin/export-data?type=handling_hours');assert.equal(pdfSource.status,200);const payload=await pdfSource.json();assert.equal(payload.type,'handling_hours');
  assert.equal((await get('/api/admin/export-data?type=customers','staff')).status,403);
  const noPermission=await get('/api/admin/report-download?type=customers&format=csv','staff');assert.equal(noPermission.status,403);
  assert.equal((await get('/api/admin/finance/export?kind=expenses','staff')).status,403);
  assert.equal((await get('/api/admin/report-schedules')).status,200);
  const denyEmail=await fetch(f.base+'/api/admin/report-schedules',{method:'POST',headers:{...hdr(f.tokens.owner),'Content-Type':'application/json'},body:JSON.stringify({type:'sales',cadence:'daily',format:'csv',hour:8})});assert.equal(denyEmail.status,409);
});
test('staff with general export permission is still blocked from customer data without sensitive grant',async t=>{const f=await serverFixture(t),db=createDatabase({sqlitePath:f.sql,databaseUrl:''});await db.init();const person=await db.findUserByEmail('staff@example.test'),access=createEmployeeAccess(db);await access.write(person.id,['reports.view','reports.export','customers.view','orders.view']);await db.close();
  const call=p=>fetch(f.base+p,{headers:hdr(f.tokens.staff)});
  assert.equal((await call('/api/admin/report-download?type=customers&format=csv')).status,403);
  assert.equal((await call('/api/admin/report-download?type=orders&format=xlsx')).status,403);
  assert.equal((await call('/api/admin/report-download?type=handling_hours&format=csv')).status,200);
});
test('recipient directory is redacted for staff without sharing, while owner may choose every admin account',async t=>{
 const f=await serverFixture(t);
 const owner=await fetch(f.base+'/api/admin/report-recipients',{headers:hdr(f.tokens.owner)});
 assert.equal(owner.status,200);
 const ownerData=await owner.json();assert.equal(ownerData.canShare,true);
 assert.ok(ownerData.recipients.some(u=>u.email==='staff@example.test'));
 const staff=await fetch(f.base+'/api/admin/report-recipients',{headers:hdr(f.tokens.staff)});
 assert.equal(staff.status,200);
 const staffData=await staff.json();assert.equal(staffData.canShare,false);
 assert.deepEqual(staffData.recipients.map(u=>u.email),['staff@example.test']);
 const attempt=await fetch(f.base+'/api/admin/report-send',{method:'POST',headers:{...hdr(f.tokens.staff),'Content-Type':'application/json'},body:JSON.stringify({type:'customers',format:'xlsx',recipients:[{kind:'user',id:ownerData.recipients[0].id}]})});
 assert.equal(attempt.status,403);
 const notConfigured=await fetch(f.base+'/api/admin/report-send',{method:'POST',headers:{...hdr(f.tokens.owner),'Content-Type':'application/json'},body:JSON.stringify({type:'sales',format:'csv',recipients:[{kind:'email',email:'example@test.com'}]})});
 assert.equal(notConfigured.status,409);
});
