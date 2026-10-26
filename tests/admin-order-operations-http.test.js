'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {createDatabase}=require('../lib/database');const root=path.join(__dirname,'..');
async function wait(base,proc){for(let i=0;i<140;i++){if(proc.exitCode!==null)throw Error('server_exited');try{if((await fetch(base+'/')).status)return;}catch(e){}await new Promise(r=>setTimeout(r,100));}throw Error('server_timeout');}
async function stop(proc){if(!proc||proc.exitCode!==null)return;proc.kill('SIGTERM');await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);if(proc.exitCode===null)proc.kill('SIGKILL');}
test('order operations HTTP - separate read/write permission, lock and customer-facing privacy',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-operations-http-'));const sqlitePath=path.join(dir,'db.sqlite');let proc,stderr='';
 try{const db=createDatabase({sqlitePath,databaseUrl:''});await db.init();
 const owner=await db.insertUser('Owner','camaraprodetect@gmail.com','hash',Date.now(),null,{role:'admin'});
 const viewer=await db.insertUser('Viewer','view-order@test.invalid','hash',Date.now(),null,{role:'staff'});
 const editor=await db.insertUser('Packer','edit-order@test.invalid','hash',Date.now(),null,{role:'staff'});
 const now=Date.now();const id=await db.insertPendingOrder({orderRef:'WF-001',userId:null,customerEmail:'buyer-order@test.invalid',customerPhone:'0501111111',customerJson:'{}',itemsJson:JSON.stringify([{id:'p1',name:'מוצר',qty:1,unitPrice:100,lineTotal:100}]),amountAgorot:10000,currency:'ILS',createdAt:now,updatedAt:now});await db.markOrderPaid(now,id);
 db.db.exec('CREATE TABLE IF NOT EXISTS admin_employee_permissions(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,permissions_json TEXT NOT NULL DEFAULT "[]",updated_at BIGINT NOT NULL DEFAULT 0)');
 for(const [id,keys] of [[viewer,['orders.view']],[editor,['orders.view','orders.edit']]])db.db.prepare('INSERT INTO admin_employee_permissions(user_id,permissions_json,updated_at) VALUES(?,?,?)').run(id,JSON.stringify(keys),now);
 const tokens=[];for(const uid of [owner,viewer,editor]){const token=crypto.randomBytes(28).toString('hex');tokens.push(token);await db.insertSession(uid,crypto.createHash('sha256').update(token).digest('hex'),now,now+3600000);}
 await db.close();const port=39000+crypto.randomInt(900);const base='http://127.0.0.1:'+port;
 proc=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATABASE_URL:'',VERSANS_DB_PATH:sqlitePath,RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});proc.stderr.on('data',b=>stderr+=b);await wait(base,proc);
 async function api(p,who=0,method='GET',body){const r=await fetch(base+'/api/admin/'+p,{method,headers:{...(who==null?{}:{Cookie:'versans_session='+tokens[who]}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json().catch(()=>({}))};}
 assert.equal((await api('orders/WF-001/workflow',null)).status,403);
 const read=await api('orders/WF-001/workflow',1);assert.equal(read.status,200,JSON.stringify(read.json)+stderr);assert.equal(read.json.workflow.stage,'waiting');
 assert.equal((await api('orders/WF-001/workflow/lock',1,'POST',{action:'claim'})).status,403);
 assert.equal((await api('orders/WF-001/workflow/stage',2,'POST',{stage:'ordered'})).status,409);
 const claimed=await api('orders/WF-001/workflow/lock',2,'POST',{action:'claim'});assert.equal(claimed.status,200,JSON.stringify(claimed.json));
 assert.equal((await api('orders/WF-001/workflow/stage',2,'POST',{stage:'ordered'})).status,200);
 assert.equal((await api('orders/WF-001/workflow/notes',2,'POST',{body:'אספקה פנימית בלבד'})).status,200);
 assert.equal((await api('orders/WF-001/workflow/notes',1,'POST',{body:'הערה'})).status,403);
 assert.equal((await api('orders/WF-001/workflow/stage',0,'POST',{stage:'ordered'})).status,409);
 const data=await api('orders/WF-001/workflow',1);assert.equal(data.json.workflow.notes[0].body,'אספקה פנימית בלבד');
 assert.equal((await api('orders/WF-001')).status,200);
 const page=await fetch(base+'/admin/order-work',{headers:{Cookie:'versans_session='+tokens[0]}});assert.equal(page.status,200);
 const publicPage=await fetch(base+'/');assert.equal(publicPage.status,200);assert(!(await publicPage.text()).includes('אספקה פנימית בלבד'));
 }finally{await stop(proc);fs.rmSync(dir,{recursive:true,force:true});}
});
