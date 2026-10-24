'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');const {spawn}=require('node:child_process');const {createDatabase}=require('../lib/database');
async function ready(url,proc){for(let i=0;i<120;i++){if(proc.exitCode!==null)throw Error('server_exited');try{if((await fetch(url+'/')).status)return;}catch(e){}await new Promise(r=>setTimeout(r,120));}throw Error('timeout');}
async function stop(proc){if(!proc||proc.exitCode!==null)return;proc.kill('SIGTERM');await new Promise(r=>{proc.once('exit',r);setTimeout(()=>{proc.kill('SIGKILL');r();},3000).unref();});}
test('task extension HTTP access, creation, file download, recurrence and staff isolation',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'vs-task-api-')),dbpath=path.join(folder,'db.sqlite');let proc,stderr='';
 try{
 const db=createDatabase({sqlitePath:dbpath,databaseUrl:''});await db.init();const ownerId=await db.insertUser('Owner','camaraprodetect@gmail.com','hash',Date.now(),null,{role:'admin'});const staffId=await db.insertUser('Staff','staff@example.com','hash',Date.now(),null,{role:'staff'});
 db.db.exec('CREATE TABLE IF NOT EXISTS admin_employee_permissions (user_id INTEGER PRIMARY KEY,permissions_json TEXT NOT NULL DEFAULT "[]",updated_at BIGINT NOT NULL DEFAULT 0)');db.db.prepare('INSERT INTO admin_employee_permissions(user_id,permissions_json,updated_at) VALUES (?,?,?)').run(staffId,JSON.stringify(['tasks.view','tasks.status']),Date.now());
 const ownersession='own-'+crypto.randomBytes(24).toString('hex'),staffsession='staff-'+crypto.randomBytes(24).toString('hex');for(const [id,token] of [[ownerId,ownersession],[staffId,staffsession]])await db.insertSession(id,crypto.createHash('sha256').update(token).digest('hex'),Date.now(),Date.now()+3600000);await db.close();
 const port=35000+crypto.randomInt(500),url='http://127.0.0.1:'+port;proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATABASE_URL:'',VERSANS_DB_PATH:dbpath,RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});proc.stderr.on('data',b=>{stderr+=b;});await ready(url,proc);
 async function req(p,session,method='GET',body){const r=await fetch(url+'/api/admin/'+p,{method,headers:{...(session?{'Cookie':'versans_session='+session}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {code:r.status,data:await r.json().catch(()=>null),resp:r};}
 assert.equal((await req('internal-tasks',null)).code,403);
 const ownerTask=await req('internal-tasks',ownersession,'POST',{title:'First',dueDate:'2026-12-30',assignees:['staff@example.com'],remindDays:2,repeatRule:'weekly',linkType:'product',linkRef:'product-10'});
 assert.equal(ownerTask.code,201,JSON.stringify(ownerTask.data)+stderr);const taskId=ownerTask.data.task.id;
 let listed=await req('internal-tasks',staffsession);assert.equal(listed.code,200,JSON.stringify(listed.data));assert.equal(listed.data.tasks.find(x=>x.id===taskId).repeatRule,'weekly');
 const noUpload=await req('internal-tasks/'+taskId+'/files',staffsession,'POST',{mime:'application/pdf',name:'test.pdf',data:Buffer.from('%PDF-hello').toString('base64')});assert.equal(noUpload.code,403);
 const upload=await req('internal-tasks/'+taskId+'/files',ownersession,'POST',{mime:'application/pdf',name:'test.pdf',data:Buffer.from('%PDF-hello').toString('base64')});assert.equal(upload.code,201,JSON.stringify(upload.data)+stderr);
 const download=await fetch(url+'/api/admin/internal-tasks/files/'+upload.data.id,{headers:{Cookie:'versans_session='+staffsession}});assert.equal(download.status,200,await download.clone().text());assert.equal(Buffer.from(await download.arrayBuffer()).toString(),'%PDF-hello');
 const bad=await req('internal-tasks/'+taskId,staffsession,'PATCH',{updatedAt:ownerTask.data.task.updatedAt,status:'done',assignees:[]});assert.equal(bad.code,403);
 const finished=await req('internal-tasks/'+taskId,staffsession,'PATCH',{updatedAt:ownerTask.data.task.updatedAt,status:'done'});assert.equal(finished.code,200,JSON.stringify(finished.data)+stderr);
 const audit=await req('internal-tasks/'+taskId+'/history',ownersession);assert.equal(audit.code,200);assert(audit.data.history.some(e=>e.action==='updated'&&e.changes.status.to==='done'));
 const tCreate=await req('task-templates',ownersession,'POST',{title:'Shipping',dueOffsetDays:1,repeatRule:'daily'});assert.equal(tCreate.code,201,JSON.stringify(tCreate.data));const tSpawn=await req('task-templates/'+tCreate.data.id,ownersession,'POST',{});assert.equal(tSpawn.code,201,JSON.stringify(tSpawn.data));
 }finally{await stop(proc);fs.rmSync(folder,{recursive:true,force:true});}
});
