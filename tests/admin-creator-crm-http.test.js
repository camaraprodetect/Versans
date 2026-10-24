'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {createDatabase}=require('../lib/database');
const {createCreatorProgram}=require('../lib/creator-program');
const {createCreatorVideos}=require('../lib/creator-videos');
const root=path.join(__dirname,'..');
async function wait(url,proc){for(let i=0;i<110;i++){if(proc.exitCode!==null)throw Error('server_exited');try{if((await fetch(url+'/')).status)return;}catch(_){}await new Promise(r=>setTimeout(r,130));}throw Error('server_timeout');}
async function stop(proc){if(!proc||proc.exitCode!==null)return;proc.kill('SIGTERM');await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);if(proc.exitCode===null)proc.kill('SIGKILL');}
const makeSession=()=>('test-'+crypto.randomBytes(25).toString('hex'));
test('creator CRM HTTP permissions, candidate, documents, payout and references',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-creator-http-')),dbpath=path.join(dir,'db.sqlite');let proc,stderr='';
 try{
  const db=createDatabase({sqlitePath:dbpath,databaseUrl:''});await db.init();
  const owner=await db.insertUser('Owner','camaraprodetect@gmail.com','hash',Date.now(),null,{role:'admin'});
  const staff=await db.insertUser('Read only','creator-reader@test.net','hash',Date.now(),null,{role:'staff'});
  await db.insertUser('Influencer','influencer@creator.test','hash',Date.now(),null,{role:'customer'});
  const cr=createCreatorProgram(db);await cr.init();await createCreatorVideos(db,cr).init();await cr.grantByEmail('influencer@creator.test','INFLUENCER',0,10,'influencer.tiktok',300);
  const now=Date.now();db.db.prepare("INSERT INTO orders(order_ref,amount_agorot,status,created_at,updated_at,paid_at,coupon_code) VALUES('VS-CRM-HTTP',100000,'paid',?,?,?,?)").run(now,now,now,'INFLUENCER');
  db.db.exec('CREATE TABLE IF NOT EXISTS admin_employee_permissions(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,permissions_json TEXT NOT NULL DEFAULT "[]",updated_at BIGINT NOT NULL DEFAULT 0)');
  db.db.prepare('INSERT INTO admin_employee_permissions(user_id,permissions_json,updated_at) VALUES(?,?,?)').run(staff,JSON.stringify(['creators.view']),now);
  const tokens=[makeSession(),makeSession()];for(const [id,token] of [[owner,tokens[0]],[staff,tokens[1]]])await db.insertSession(id,crypto.createHash('sha256').update(token).digest('hex'),now,now+3600000);
  await db.close();const port=35500+crypto.randomInt(450);const base='http://127.0.0.1:'+port;
  proc=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATABASE_URL:'',VERSANS_DB_PATH:dbpath,RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});proc.stderr.on('data',b=>stderr+=b);
  await wait(base,proc);
  async function api(p,who=0,method='GET',body){const r=await fetch(base+'/api/admin/'+p,{method,headers:{...(who===null?{}:{Cookie:'versans_session='+tokens[who]}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>null);return {status:r.status,json:j};}
  assert.equal((await api('creators/profiles',null)).status,403);
  let listed=await api('creators/profiles');assert.equal(listed.status,200,JSON.stringify(listed.json)+stderr);assert.equal(listed.json.creators.length,1);const id=listed.json.creators[0].id;
  assert.equal((await api('creators/profiles',1)).status,200);
  assert.equal((await api('creators/profiles',1,'POST',{name:'Candidate X'})).status,403);
  const create=await api('creators/profiles',0,'POST',{name:'Candidate X',email:'candidate@test.org'});assert.equal(create.status,201,JSON.stringify(create.json)+stderr);
  const con=await api('creators/profiles/'+id+'/contacts',0,'POST',{contactedAt:'2026-10-24',channel:'email',replyStatus:'pending'});assert.equal(con.status,201,JSON.stringify(con.json)+stderr);
  const pdf=Buffer.from('%PDF-test document');const put=await api('creators/profiles/'+id+'/documents',0,'POST',{name:'deal.pdf',mime:'application/pdf',base64:pdf.toString('base64')});assert.equal(put.status,201,JSON.stringify(put.json)+stderr);
  const download=await fetch(base+'/api/admin/creators/profiles/'+id+'/documents/'+put.json.id,{headers:{Cookie:'versans_session='+tokens[1]}});assert.equal(download.status,200);assert.equal(Buffer.from(await download.arrayBuffer()).toString(),pdf.toString());
  const denied=await api('creators/profiles/'+id+'/contacts',1,'POST',{contactedAt:'2026-10-24'});assert.equal(denied.status,403);
  const current=await api('creators/profiles/'+id);assert.equal(current.json.profile.commissionAgorot,10000,JSON.stringify(current.json)+stderr);
  const pay=await api('dashboard/creator-payment',0,'POST',{creatorId:current.json.profile.userId,amountAgorot:2500,requestId:crypto.randomUUID(),note:'Bit',reference:'BIT-TEST-51'});
  assert.equal(pay.status,428,'owner payment must require password reauth');
  assert.equal((await api('creators/profiles/'+id+'/payments/123',0,'PATCH',{reference:'PAY-777'})).status,428,'reference edit also needs step-up');
  assert.equal((await api('creators/profiles/'+id+'/payments/123',1,'PATCH',{reference:'PAY-777'})).status,403,'view-only staff cannot edit financial references');
 }finally{await stop(proc);fs.rmSync(dir,{recursive:true,force:true});}
});
