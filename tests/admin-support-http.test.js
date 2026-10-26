'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {createDatabase}=require('../lib/database');const root=path.join(__dirname,'..');
async function wait(base,proc){for(let i=0;i<130;i++){if(proc.exitCode!==null)throw Error('server_exited');try{if((await fetch(base+'/')).status)return;}catch(e){}await new Promise(r=>setTimeout(r,110));}throw Error('server_timeout');}
async function stop(proc){if(!proc||proc.exitCode!==null)return;proc.kill('SIGTERM');await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);if(proc.exitCode===null)proc.kill('SIGKILL');}
test('customer-service API and per-action employee permissions',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-support-http-'));const sqlitePath=path.join(dir,'db.sqlite');let proc,stderr='';
 try{const db=createDatabase({sqlitePath,databaseUrl:''});await db.init();
 const owner=await db.insertUser('Owner','camaraprodetect@gmail.com','hash',Date.now(),null,{role:'admin'});
 const viewer=await db.insertUser('Viewer','view-support@test.invalid','hash',Date.now(),null,{role:'staff'});
 const helper=await db.insertUser('Helper','helper-support@test.invalid','hash',Date.now(),null,{role:'staff'});
 const customer=await db.insertUser('Buyer','buyer-support@test.invalid','hash',Date.now(),null,{role:'customer'});
 const now=Date.now();await db.insertPendingOrder({orderRef:'SUP-TEST-1',userId:customer,customerEmail:'buyer-support@test.invalid',customerPhone:'0501234567',customerJson:'{}',amountAgorot:10000,currency:'ILS',itemsJson:'[]',createdAt:now,updatedAt:now});
 db.db.exec('CREATE TABLE IF NOT EXISTS admin_employee_permissions(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,permissions_json TEXT NOT NULL DEFAULT "[]",updated_at BIGINT NOT NULL DEFAULT 0)');
 for(const [id,keys] of [[viewer,['support.view']],[helper,['support.view','support.edit','support.replacement']]])db.db.prepare('INSERT INTO admin_employee_permissions(user_id,permissions_json,updated_at) VALUES(?,?,?)').run(id,JSON.stringify(keys),now);
 const sessions=[];for(const id of [owner,viewer,helper]){const token=crypto.randomBytes(28).toString('hex');sessions.push(token);await db.insertSession(id,crypto.createHash('sha256').update(token).digest('hex'),now,now+3600000);}
 await db.close();const port=38000+crypto.randomInt(500);const base='http://127.0.0.1:'+port;
 proc=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATABASE_URL:'',VERSANS_DB_PATH:sqlitePath,RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});proc.stderr.on('data',b=>stderr+=b);await wait(base,proc);
 async function api(p,who=0,method='GET',body){const r=await fetch(base+'/api/admin/'+p,{method,headers:{...(who==null?{}:{Cookie:'versans_session='+sessions[who]}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json().catch(()=>({}))};}
 assert.equal((await api('support/overview',null)).status,403);
 assert.equal((await api('support/overview',1)).status,200,stderr);
 assert.equal((await api('support/tickets',1,'POST',{subject:'Test'})).status,403);
 const made=await api('support/tickets',0,'POST',{subject:'בעיה בהזמנה',reason:'shipping',customerId:customer,orderRef:'SUP-TEST-1',assigneeId:helper,body:'שליחת הזמנה'});
 assert.equal(made.status,201,JSON.stringify(made.json)+stderr);const id=made.json.ticket.id;
 assert.equal((await api('support/tickets/'+id,1)).status,200);
 assert.equal((await api('support/tickets/'+id+'/replacement',1,'POST',{productName:'שרשרת'})).status,403);
 assert.equal((await api('support/tickets/'+id,2,'PATCH',{assigneeId:viewer})).status,403);
 assert.equal((await api('support/tickets/'+id,2,'PATCH',{status:'waiting'})).status,200);
 assert.equal((await api('support/tickets/'+id+'/messages',2,'POST',{kind:'staff',channel:'email',body:'עניתי במייל'})).status,200);
 const replacement=await api('support/tickets/'+id+'/replacement',2,'POST',{productName:'שרשרת',quantity:1,status:'approved'});assert.equal(replacement.status,200,JSON.stringify(replacement.json));
 assert.equal((await api('support/templates',2,'POST',{title:'Test',channel:'email',body:'Hello'})).status,403);
 assert.equal((await api('support/customer/'+customer,1)).status,200);
 const page=await fetch(base+'/admin/support',{headers:{Cookie:'versans_session='+sessions[0]}});assert.equal(page.status,200);
 }finally{await stop(proc);fs.rmSync(dir,{recursive:true,force:true});}
});
