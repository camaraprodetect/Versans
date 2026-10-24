'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDatabase}=require('../lib/database');
const {mkdtempSync,rmSync,readFileSync}=require('node:fs');
const {spawn}=require('node:child_process');
const crypto=require('node:crypto');
const os=require('node:os');
const path=require('node:path');
const rootDir=path.join(__dirname,'..');
function session(id){let token='arrival-'+crypto.randomBytes(20).toString('hex');return {token,id,hash:crypto.createHash('sha256').update(token).digest('hex')};}
async function waitReady(url,child){for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('server_exited');try{const r=await fetch(url+'/');if(r.status)return;}catch(_){}await new Promise(r=>setTimeout(r,100));}throw Error('not_ready');}
async function stop(child){if(child.exitCode!=null)return;await new Promise(resolve=>{let done=false;const timer=setTimeout(()=>{child.kill('SIGKILL');if(!done){done=true;resolve();}},2000);child.once('exit',()=>{clearTimeout(timer);if(!done){done=true;resolve();}});child.kill('SIGTERM');});}
test('physical arrivals view uses scanned per-unit records, filters and permissions without modifying orders',async()=>{
  const tmp=mkdtempSync(path.join(os.tmpdir(),'vs-arrivals-'));const dbPath=path.join(tmp,'vs.sqlite');
  let proc;let stderr='';
  try{
    const db=createDatabase({sqlitePath:dbPath,databaseUrl:''});await db.init();
    const owner=await db.insertUser('Owner','camaraprodetect@gmail.com','hash',Date.now());
    const staff=await db.insertUser('Read only','arrivals-staff@example.com','hash',Date.now());
    db.db.prepare("UPDATE users SET role='staff' WHERE id=?").run(staff);
    db.db.exec("CREATE TABLE IF NOT EXISTS admin_employee_permissions (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,permissions_json TEXT NOT NULL DEFAULT '[]',updated_at BIGINT NOT NULL DEFAULT 0)");
    db.db.prepare('INSERT INTO admin_employee_permissions(user_id,permissions_json,updated_at) VALUES(?,?,?)').run(staff,JSON.stringify(['orders.view']),Date.now());
    const own=session(owner), readonly=session(staff);
    for(const x of [own,readonly])await db.insertSession(x.id,x.hash,Date.now(),Date.now()+3600000);
    const now=Date.now();
    async function add(ref,qtyList){
      const id=await db.insertPendingOrder({orderRef:ref,userId:null,customerEmail:ref+'@example.org',customerPhone:'0500000000',amountAgorot:20000,currency:'ILS',itemsJson:JSON.stringify(qtyList.map((qty,i)=>({id:i===0?'product-10':'product-18',name:i===0?'שרשרת כסף':'שרשרת זהב',qty,unitPrice:150,lineTotal:150*qty}))),createdAt:now,updatedAt:now});
      await db.markOrderPaid(now,id);return id;
    }
    const waiting=await add('ARR-WAIT',[2]);const partial=await add('ARR-PART',[2,1]);const ready=await add('ARR-READY',[1]);
    await db.markPackagingUnit(partial,0,1,true,null,now);
    await db.markPackagingUnit(partial,0,2,false,null,now);
    await db.markPackagingUnit(ready,0,1,true,null,now);
    await db.close();
    const port=32800+crypto.randomInt(500);const base='http://127.0.0.1:'+port;
    proc=spawn(process.execPath,['server.js'],{cwd:rootDir,env:{...process.env,NODE_ENV:'test',PORT:String(port),HOST:'127.0.0.1',DATABASE_URL:'',VERSANS_DB_PATH:dbPath,RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});proc.stderr.on('data',d=>stderr+=d);
    await waitReady(base,proc);
    async function get(url,s){return fetch(base+url,{headers:s?{Cookie:'versans_session='+s.token}:{}});}
    assert.equal((await get('/api/admin/packaging/overview')).status,403);
    assert.equal((await get('/admin/arrivals',own)).status,200);
    assert.equal((await get('/admin/arrivals',readonly)).status,200);
    const overview=await get('/api/admin/packaging/overview?period=all',own);assert.equal(overview.status,200,stderr);const a=await overview.json();
    assert.equal(a.summary.all,3);assert.equal(a.summary.waiting,1);assert.equal(a.summary.partial,1);assert.equal(a.summary.ready,1);
    const p=a.orders.find(x=>x.orderRef==='ARR-PART');assert.equal(p.receivedUnits,1);assert.equal(p.missingUnits,2);assert.deepEqual(p.items.map(x=>[x.receivedQty,x.missingQty]),[[1,1],[0,1]]);
    for(const [filter,ref] of [['waiting','ARR-WAIT'],['partial','ARR-PART'],['ready','ARR-READY']]){
      const r=await get('/api/admin/packaging/overview?period=all&status='+filter,own);const j=await r.json();assert.equal(j.count,1,filter);assert.equal(j.orders[0].orderRef,ref);
    }
    const specific=await(await get('/api/admin/packaging/overview?period=all&search=ARR-READY',own)).json();assert.equal(specific.summary.all,1);assert.equal(specific.orders[0].orderRef,'ARR-READY');
    const page=await(await get('/api/admin/packaging/overview?period=all&limit=1&offset=1',own)).json();assert.equal(page.count,3);assert.equal(page.orders.length,1);
    const staffRead=await get('/api/admin/packaging/overview?period=all',readonly);assert.equal(staffRead.status,200);
    const deny=await fetch(base+'/api/admin/packaging/unit',{method:'POST',headers:{Cookie:'versans_session='+readonly.token,'Content-Type':'application/json'},body:JSON.stringify({orderRef:'ARR-WAIT',itemIndex:0,unitNumber:1,received:true})});assert.equal(deny.status,403);
    const update=await fetch(base+'/api/admin/packaging/unit',{method:'POST',headers:{Cookie:'versans_session='+own.token,'Content-Type':'application/json'},body:JSON.stringify({orderRef:'ARR-PART',itemIndex:0,unitNumber:2,received:true})});assert.equal(update.status,200,await update.clone().text());
    const changed=await(await get('/api/admin/packaging/overview?period=all&status=partial',own)).json();assert.equal(changed.orders[0].receivedUnits,2);assert.equal(changed.orders[0].missingUnits,1);
    const db2=createDatabase({sqlitePath:dbPath,databaseUrl:''});await db2.init();assert.equal((await db2.getOrderByRef('ARR-WAIT')).status,'paid');assert.equal((await db2.getOrderByRef('ARR-PART')).status,'paid');assert.equal((await db2.getOrderByRef('ARR-READY')).status,'paid');await db2.close();
    const ui=readFileSync(path.join(rootDir,'assets/admin-arrivals.js'),'utf8');assert.match(ui,/vs-arrivals-detail/);assert.match(ui,/api\/admin\/packaging\/order/);assert.match(ui,/api\/admin\/packaging\/unit/);
  }finally{if(proc)await stop(proc);rmSync(tmp,{recursive:true,force:true});}
});
