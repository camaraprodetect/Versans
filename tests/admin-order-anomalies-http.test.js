'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');const {spawn}=require('node:child_process');const {createDatabase}=require('../lib/database');
const root=path.join(__dirname,'..');
async function wait(base,child){for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('server_exited');try{if((await fetch(base+'/')).status)return;}catch(_){}await new Promise(r=>setTimeout(r,110));}throw Error('server_start_timeout');}
async function stop(child){if(child.exitCode!=null)return;child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);if(child.exitCode===null)child.kill('SIGKILL');}
test('anomaly API rules, classification, assignment, audit and staff restrictions',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-anomalies-api-')),sqlitePath=path.join(dir,'db.sqlite');let child,logs='';
 try{
  const db=createDatabase({sqlitePath,databaseUrl:''});await db.init();
  const owner=await db.insertUser('Owner','camaraprodetect@gmail.com','pw',Date.now(),null,{role:'admin'});
  const staff=await db.insertUser('Worker','anomalies-worker@testing.invalid','pw',Date.now(),null,{role:'staff'});
  db.db.exec('CREATE TABLE IF NOT EXISTS admin_employee_permissions(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,permissions_json TEXT NOT NULL DEFAULT "[]",updated_at BIGINT NOT NULL DEFAULT 0)');
  db.db.prepare('INSERT INTO admin_employee_permissions(user_id,permissions_json,updated_at) VALUES(?,?,?)').run(staff,JSON.stringify(['anomalies.view','anomalies.edit']),Date.now());
  const sessions=[];for(const id of [owner,staff]){const token=crypto.randomBytes(25).toString('hex');sessions.push(token);await db.insertSession(id,crypto.createHash('sha256').update(token).digest('hex'),Date.now(),Date.now()+7200000);}
  const now=Date.now();
  await db.insertPendingOrder({orderRef:'ANOM-ORDER-1',userId:null,customerEmail:'order@testing.invalid',customerPhone:'0501234567',customerJson:JSON.stringify({country:'ישראל',city:'תל אביב',street:'רוטשילד',houseNumber:'10'}),amountAgorot:150000,currency:'ILS',itemsJson:JSON.stringify([{id:'product-10',qty:1,unitPrice:1500,lineTotal:1500}]),createdAt:now,updatedAt:now});
  await db.markOrderPaid(now,(await db.getOrderByRef('ANOM-ORDER-1')).id);
  await db.close();
  const port=39000+crypto.randomInt(1000),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',PORT:String(port),HOST:'127.0.0.1',DATABASE_URL:'',VERSANS_DB_PATH:sqlitePath,RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});child.stderr.on('data',b=>logs+=b);
  await wait(base,child);
  async function api(endpoint,who,method='GET',data){const response=await fetch(base+'/api/admin/'+endpoint,{method,headers:{...(who==null?{}:{Cookie:'versans_session='+sessions[who]}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json().catch(()=>({}))};}
  assert.equal((await api('order-anomalies/settings',null)).status,403);
  const read=await api('order-anomalies/settings',0);assert.equal(read.status,200,JSON.stringify(read.body)+logs);assert.equal(read.body.canEditRules,true);assert(read.body.staff.some(x=>x.id===staff));
  assert.equal((await api('order-anomalies/settings',1,'PUT',{highOrderEnabled:true,highOrderAgorot:100000})).status,403);
  assert.equal((await api('order-anomalies/settings',0,'PUT',{highOrderEnabled:true,highOrderAgorot:100000})).status,200);
  const listing=await api('order-anomalies?range=all',0);assert.equal(listing.status,200,JSON.stringify(listing.body)+logs);assert(listing.body.orders.some(x=>x.orderRef==='ANOM-ORDER-1'));
  const original=listing.body.orders.find(x=>x.orderRef==='ANOM-ORDER-1');assert(original.reasons.some(x=>x.code==='custom_high_order'));
  assert.equal((await api('order-anomalies/review',0,'POST',{orderRef:'ANOM-ORDER-1',state:'confirmed',assignedUserId:staff,note:'בדיקה אמיתית'})).status,200);
  const confirmed=await api('order-anomalies?range=all&reviewState=confirmed',1);assert.equal(confirmed.body.summary.confirmed,1);assert.equal(confirmed.body.orders[0].review.assignedUserId,staff);
  assert.equal((await api('order-anomalies/review',0,'POST',{orderRef:'ANOM-ORDER-1',state:'false_positive',assignedUserId:999999})).status,400);
  assert.equal((await api('order-anomalies/review',1,'POST',{orderRef:'ANOM-ORDER-1',state:'false_positive',assignedUserId:staff,note:'הכול תקין'})).status,200);
  const dismissed=await api('order-anomalies?range=all&reviewState=false_positive',0);assert.equal(dismissed.body.summary.false_positive,1);assert.equal(dismissed.body.summary.falsePositiveRate,100);
  const events=await api('order-anomalies/history?orderRef=ANOM-ORDER-1',0);assert.equal(events.body.history.length,2);
  const reopen=await api('order-anomalies/review',0,'POST',{orderRef:'ANOM-ORDER-1',state:'open'});assert.equal(reopen.status,200);const post=await api('order-anomalies?range=all',0);assert.equal(post.body.summary.open,1);
 }finally{if(child)await stop(child);fs.rmSync(dir,{recursive:true,force:true});}
});
