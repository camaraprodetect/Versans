'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');const {spawn}=require('node:child_process');
const {createDatabase}=require('../lib/database');const policy=require('../lib/employee-access');
function hashPassword(p){const salt=crypto.randomBytes(16);const hash=crypto.scryptSync(p,salt,64,{N:16384,r:8,p:1});return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;}
function eq(a,b){assert.deepEqual(a,b);}
async function ready(port,child){for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('server_exited');try{if((await fetch('http://127.0.0.1:'+port+'/login')).status===200)return;}catch(_){}await new Promise(r=>setTimeout(r,100));}throw Error('server_not_ready');}
async function request(port,url,method='GET',body,cookies=''){const headers={Accept:'application/json'};if(cookies)headers.Cookie=cookies;const o={method,headers};if(body!==undefined){headers['Content-Type']='application/json';o.body=JSON.stringify(body);}const r=await fetch('http://127.0.0.1:'+port+url,o);return {status:r.status,data:await r.json().catch(()=>({})),r};}
function cookie(res){return res.r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');}
test('role presets, expiry and auditing survive DB recreation',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-team-'));
 const db=createDatabase({root:dir,sqlitePath:path.join(dir,'vs.sqlite')});try{
  await db.init();const id=await db.insertUser('Test','test@testing.invalid','hash',Date.now(),null,{role:'staff'});
  const access=policy.createEmployeeAccess(db);
  assert(policy.PRESETS.finance.permissions.includes('expenses.create'));
  await access.write(id,policy.PRESETS.marketing.permissions);
  await access.setProfile(id,{preset:'marketing',expiresAt:Date.now()+86400000});
  eq((await access.profile(id)).preset,'marketing');
  assert((await access.readEffective(id)).includes('products.description'));
  await access.audit({id,name:'admin'},'employees','update','updated',id);
  assert.equal((await access.auditList()).length,1);
  await access.grantReauth('abcdef',id);assert(await access.hasReauth('abcdef',id));
  const access2=policy.createEmployeeAccess(db);assert.equal((await access2.profile(id)).preset,'marketing');
  const e=await access2.staffList();assert.equal(e.length,1);assert.equal(e[0].expiresAt>0,true);
  await access.setProfile(id,{preset:'',expiresAt:Date.now()+800});
  await new Promise(r=>setTimeout(r,900));eq(await access.readEffective(id),[]);
 }finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('employee management HTTP: password step-up, role templates, scoped edits, blocking and audit',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vs-team-http-'));const port=33000+crypto.randomInt(4000);
 const db=createDatabase({root,sqlitePath:path.join(root,'versans.sqlite')});await db.init();
 db.db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run('Owner','camaraprodetect@gmail.com',hashPassword('Owner-pass-2026'),'admin',Date.now());
 db.db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run('Worker','team@example.invalid',hashPassword('Worker-pass-2026'),'staff',Date.now());
 const staff=db.db.prepare('SELECT id FROM users WHERE email=?').get('team@example.invalid');await db.close();
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'test',PORT:String(port),HOST:'127.0.0.1',VERSANS_DATA_DIR:root,RESEND_API_KEY:'',EMAIL_FROM:''},stdio:['ignore','pipe','pipe']});let logs='';child.stderr.on('data',b=>logs+=b.toString());
 try{
  await ready(port,child);
  const l=await request(port,'/api/auth/login','POST',{email:'camaraprodetect@gmail.com',password:'Owner-pass-2026'});assert.equal(l.status,200,logs);const owner=cookie(l);
  let r=await request(port,'/api/admin/employees/catalog','GET',undefined,owner);assert.equal(r.status,200);assert(r.data.presets.marketing);assert(r.data.groups.some(x=>x.actions.some(a=>a.key==='products.description')));
  r=await request(port,'/api/admin/employees/'+staff.id,'PATCH',{permissions:['products.description','products.view'],preset:'marketing'},owner);assert.equal(r.status,428,'must require password reauth for permission changes');
  r=await request(port,'/api/admin/employees/reauth','POST',{password:'WRONG'},owner);assert.equal(r.status,401);
  r=await request(port,'/api/admin/employees/reauth','POST',{password:'Owner-pass-2026'},owner);assert.equal(r.status,200);
  r=await request(port,'/api/admin/employees/'+staff.id,'PATCH',{permissions:['products.description','products.view'],preset:'marketing',expiresAt:Date.now()+86400000},owner);assert.equal(r.status,200,JSON.stringify(r.data));
  r=await request(port,'/api/admin/employees/overview','GET',undefined,owner);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.employees[0].preset,'marketing');
  const login=await request(port,'/api/auth/login','POST',{email:'team@example.invalid',password:'Worker-pass-2026'});assert.equal(login.status,200);const worker=cookie(login);
  r=await request(port,'/api/admin/catalog/product-10','GET',undefined,worker);assert.equal(r.status,200,JSON.stringify(r.data));
  r=await request(port,'/api/admin/catalog/product-10','PUT',{product:{price:1}},worker);assert.equal(r.status,403,'descriptions cannot modify price');
  r=await request(port,'/api/admin/catalog/product-10','PUT',{product:{description:{he:'תיאור חדש לבדיקת צוות'}}},worker);assert.equal(r.status,200,JSON.stringify(r.data));
  r=await request(port,'/api/admin/catalog/product-10','GET',undefined,worker);assert.equal(r.data.product.description.he,'תיאור חדש לבדיקת צוות');
  r=await request(port,'/api/admin/employees/'+staff.id,'PATCH',{blocked:true},owner);assert.equal(r.status,200);
  r=await request(port,'/api/admin/catalog/product-10','GET',undefined,worker);assert.equal(r.status,403,'blocking must revoke sessions');
  r=await request(port,'/api/admin/employees/'+staff.id,'PATCH',{blocked:false},owner);assert.equal(r.status,200);
  r=await request(port,'/api/admin/employees/overview','GET',undefined,owner);assert.equal(r.data.employees[0].permissions.includes('products.description'),true,'saved permissions remain');
  r=await request(port,'/api/admin/employees/audit','GET',undefined,owner);assert.equal(r.status,200);assert(r.data.items.some(x=>x.action==='update'));
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));fs.rmSync(root,{recursive:true,force:true});}
});
