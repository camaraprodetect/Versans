'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {mkdtempSync,existsSync,readdirSync,rmSync}=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
const {createDatabase}=require('../lib/database');
const {createAdminSecurity}=require('../lib/admin-security');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function fixture(){const root=mkdtempSync(path.join(os.tmpdir(),'vs-security-'));const db=createDatabase({root,sqlitePath:path.join(root,'store.sqlite')});await db.init();
const sql="INSERT INTO users(name,email,password_hash,role,created_at) VALUES('Owner','owner@example.com','test','admin',?)";
db.db.prepare(sql).run(Date.now());const user=await db.findUserByEmail('owner@example.com');const sec=createAdminSecurity(db,{sqlitePath:path.join(root,'store.sqlite'),root});await sec.init();return {root,db,user,sec};}
test('sessions are revocable and newly observed devices are flagged only after first-known device',async()=>{
 const x=await fixture();try{
  const now=Date.now();await x.db.insertSession(x.user.id,sha('token-1'),now,now+3600000);
  assert.equal(await x.sec.registerSession({user:x.user,token:'token-1',deviceToken:'device-a',userAgent:'Chrome A'}),false);
  await x.db.insertSession(x.user.id,sha('token-2'),now,now+3600000);
  assert.equal(await x.sec.registerSession({user:x.user,token:'token-2',deviceToken:'device-b',userAgent:'Firefox B'}),true);
  const list=await x.sec.sessions(x.user.id,sha('token-1'));assert.equal(list.length,2);
  const toRevoke=list.find(x=>!x.current);const result=await x.sec.revoke(x.user.id,toRevoke.id,sha('token-1'));
  assert.deepEqual(result,{current:false});assert.equal((await x.sec.sessions(x.user.id,sha('token-1'))).length,1);
  assert.equal(await x.db.findPublicUserBySession(sha('token-2'),Date.now()),null);
 }finally{await x.db.close();rmSync(x.root,{recursive:true,force:true});}
});
test('maintenance switch, recycle bin, revisions and sheet status survive reinitialization',async()=>{
 const x=await fixture();try{
   await x.sec.setMaintenance(true,x.user.id);assert.equal(await x.sec.maintenance(),true);
   const entry=await x.sec.recycle('product','product-101',{slug:'product-101',price:100},x.user.id);
   assert.equal(JSON.parse((await x.sec.readRecycle(entry)).payload).price,100);
   await x.sec.markRestored(entry,x.user.id);assert.equal(await x.sec.readRecycle(entry),null);
   const v=await x.sec.version('product','product-101',{price:80},x.user.id);
   assert.equal(JSON.parse((await x.sec.readVersion(v)).payload).price,80);
   assert.equal((await x.sec.sheetHealth(['product-1'])).pendingProducts.length,1);
   const next=createAdminSecurity(x.db,{root:x.root,sqlitePath:path.join(x.root,'store.sqlite')});
   assert.equal(await next.maintenance(),true);assert.equal((await next.recycleList()).length,1);
 }finally{await x.db.close();rmSync(x.root,{recursive:true,force:true});}
});
test('SQLite daily backup creates a reopenable independently checked snapshot',async()=>{
 const x=await fixture();const previous=process.env.VERSANS_BACKUP_DIR;process.env.VERSANS_BACKUP_DIR=path.join(x.root,'persistent-backups');
 try{
  const result=await x.sec.backup();assert.equal(result.ok,true);assert.equal(result.verification,'sqlite_reopen_integrity_checked');
  assert(existsSync(path.join(process.env.VERSANS_BACKUP_DIR,result.filename)));
  assert.equal(readdirSync(process.env.VERSANS_BACKUP_DIR).length,1);
  const status=await x.sec.backupStatus();assert.equal(status.latest.ok,true);
 }finally{if(previous===undefined)delete process.env.VERSANS_BACKUP_DIR;else process.env.VERSANS_BACKUP_DIR=previous;await x.db.close();rmSync(x.root,{recursive:true,force:true});}
});
