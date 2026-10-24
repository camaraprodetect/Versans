'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');const crypto=require('node:crypto');const os=require('node:os');const path=require('node:path');const {createDatabase}=require('../lib/database');
const hostname='127.0.0.1';
function hashPassword(p){const salt=crypto.randomBytes(16);const derived=crypto.scryptSync(p,salt,64,{N:16384,r:8,p:1});return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;}
async function ready(port,child){for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('server_exited');try{const r=await fetch('http://'+hostname+':'+port+'/');if(r.status===200)return;}catch(_){}await new Promise(r=>setTimeout(r,100));}throw Error('server_not_ready');}
async function request(port,url,method='GET',body,cookie){const opts={method,headers:{Accept:'application/json',...(cookie?{Cookie:cookie}:{})}};if(body!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}return fetch('http://'+hostname+':'+port+url,opts);}
test('admin security API, login cookies, maintenance owner preview and backup are end-to-end safe',async()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'vs-sec-http-'));const port=30000+crypto.randomInt(3000);
 const db=createDatabase({root,sqlitePath:path.join(root,'versans.sqlite')});await db.init();
 db.db.prepare("INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)").run('Owner','camaraprodetect@gmail.com',hashPassword('security-123-AB'),'admin',Date.now());
 db.db.prepare("INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)").run('Employee','staff@example.com',hashPassword('staff-sec-123'),'staff',Date.now());
 const staff=db.db.prepare("SELECT id FROM users WHERE email='staff@example.com'").get();
 db.db.exec("CREATE TABLE IF NOT EXISTS admin_employee_permissions (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,permissions_json TEXT NOT NULL DEFAULT '[]',updated_at BIGINT NOT NULL DEFAULT 0)");
 db.db.prepare('INSERT INTO admin_employee_permissions(user_id,permissions_json,updated_at) VALUES (?,?,?)').run(staff.id,JSON.stringify(['security.view']),Date.now());
 await db.close();
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'test',PORT:String(port),HOST:hostname,VERSANS_DATA_DIR:root,VERSANS_BACKUP_DIR:path.join(root,'persistent-backups'),RESEND_API_KEY:'',EMAIL_FROM:''},stdio:['ignore','pipe','pipe']});
 let logs='';child.stderr.on('data',x=>logs+=x.toString());
 try{
  await ready(port,child);
  let r=await request(port,'/api/admin/security/overview');assert.equal(r.status,403);
  r=await request(port,'/api/auth/login','POST',{email:'camaraprodetect@gmail.com',password:'security-123-AB'});
  assert.equal(r.status,200,await r.text());
  const cookies=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  assert.match(cookies,/versans_session=/);assert.match(cookies,/versans_security_device=/);
  r=await request(port,'/api/admin/security/overview','GET',undefined,cookies);let overview=await r.json();assert.equal(r.status,200,JSON.stringify(overview));assert.equal(overview.owner,true);assert.equal(overview.devices.length,1);
  // Archive and restore an existing catalog product without changing its slug.
  r=await request(port,'/api/admin/catalog/product-10','GET',undefined,cookies);assert.equal(r.status,200);
  r=await request(port,'/api/admin/catalog/product-10','DELETE',{},cookies);assert.equal(r.status,200,await r.text());
  r=await request(port,'/api/admin/security/overview','GET',undefined,cookies);let sec=await r.json();
  const deleted=sec.trash.find(x=>x.kind==='product'&&x.key==='product-10');assert(deleted);
  r=await request(port,'/api/admin/security/trash/restore','POST',{id:deleted.id},cookies);assert.equal(r.status,200,await r.text());
  r=await request(port,'/api/admin/catalog/product-10','GET',undefined,cookies);assert.equal(r.status,200);
  // Internal task deletion is archived and restored with a fresh task ID.
  r=await request(port,'/api/admin/internal-tasks','POST',{title:'Security test task',description:'restore trial',type:'other',status:'open',priority:'normal',dueDate:''},cookies);
  const createPayload=await r.json();assert.equal(r.status,201,JSON.stringify(createPayload));const created=createPayload.task;
  r=await request(port,'/api/admin/internal-tasks/'+created.id,'DELETE',{updatedAt:created.updatedAt},cookies);
  assert.equal(r.status,200,await r.text());
  r=await request(port,'/api/admin/security/overview','GET',undefined,cookies);sec=await r.json();
  const taskBin=sec.trash.find(x=>x.kind==='task'&&x.key===String(created.id));assert(taskBin);
  r=await request(port,'/api/admin/security/trash/restore','POST',{id:taskBin.id},cookies);assert.equal(r.status,200,await r.text());
  // Marketing modifications create restorable version snapshots.
  r=await request(port,'/api/admin/marketing','POST',{section:'campaigns',action:'create',item:{name:'Integration Test Campaign',budget:250,goal:500,spent:0,source:'TikTok',active:true}},cookies);
  assert.equal(r.status,200,await r.text());
  r=await request(port,'/api/admin/security/overview','GET',undefined,cookies);sec=await r.json();
  const previousMarketing=sec.versions.find(x=>x.kind==='marketing');assert(previousMarketing);
  r=await request(port,'/api/admin/security/versions/restore','POST',{id:previousMarketing.id},cookies);assert.equal(r.status,200,await r.text());
  r=await request(port,'/api/admin/marketing','GET',undefined,cookies);const marketing=await r.json();assert.equal(marketing.campaigns.length,0);
  // Server-side customer search without loading the full database.
  r=await request(port,'/api/admin/customers?limit=10&offset=0&q=no-matching-client','GET',undefined,cookies);const customers=await r.json();assert.equal(customers.count,0);
  // Read-only staff sees only their own sessions, not shop backups or other accounts.
  r=await request(port,'/api/auth/login','POST',{email:'staff@example.com',password:'staff-sec-123'});
  assert.equal(r.status,200);const staffCookie=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  r=await request(port,'/api/admin/security/overview','GET',undefined,staffCookie);const staffOverview=await r.json();
  assert.equal(r.status,200);assert.equal(staffOverview.owner,false);assert.equal(staffOverview.trash.length,0);
  assert.equal(staffOverview.devices.length,1);assert.equal(staffOverview.devices[0].email,undefined);
  r=await request(port,'/api/admin/security/maintenance','POST',{active:true},staffCookie);assert.equal(r.status,403);
  r=await request(port,'/api/admin/security/maintenance','POST',{active:true},cookies);assert.equal(r.status,200,await r.text());
  assert.equal((await request(port,'/')).status,503);
  assert.equal((await request(port,'/login')).status,200);
  assert.equal((await request(port,'/','GET',undefined,cookies)).status,200);
  assert.notEqual((await request(port,'/api/verify-payment')).status,503);
  // Automatic startup backup may already be available here.
  r=await request(port,'/api/admin/security/backup','POST',{},cookies);const backupResponseText=await r.text();assert.equal(r.status,200,backupResponseText);
  const backupCreated=JSON.parse(backupResponseText);assert.equal(backupCreated.backup.ok,true);
  r=await request(port,'/api/admin/security/backup/download','GET',undefined,staffCookie);assert.equal(r.status,403,'staff must not download owner database backup');
  r=await request(port,'/api/admin/security/backup/download','GET',undefined,cookies);assert.equal(r.status,200);
  assert.match(r.headers.get('content-disposition')||'',/attachment; filename="versans-.*\.sqlite"/);
  assert.equal(r.headers.get('cache-control'),'no-store, private');
  const backupBytes=Buffer.from(await r.arrayBuffer());assert.equal(backupBytes.subarray(0,16).toString('utf8'),'SQLite format 3\0');
  assert.equal(backupBytes.length,backupCreated.backup.bytes);

  r=await request(port,'/api/admin/security/maintenance','POST',{active:false},cookies);assert.equal(r.status,200,await r.text());
  assert.equal((await request(port,'/')).status,200);
  r=await request(port,'/api/admin/security/overview','GET',undefined,cookies);overview=await r.json();
  const session=overview.devices.find(s=>s.current);assert(session);
  r=await request(port,'/api/admin/security/devices/revoke','POST',{id:session.id,userId:session.userId},cookies);assert.equal(r.status,200,await r.text());
  assert.equal((await request(port,'/api/admin/security/overview','GET',undefined,cookies)).status,403);
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));rmSync(root,{recursive:true,force:true});}
});
