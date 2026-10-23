'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {spawn}=require('node:child_process');const {createDatabase}=require('../lib/database.js');
async function port(){return new Promise(r=>{let s=net.createServer();s.listen(0,'127.0.0.1',()=>{let p=s.address().port;s.close(()=>r(p));});});}
async function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-productapi-')),sqlitePath=path.join(dir,'test.sqlite'),db=createDatabase({sqlitePath,databaseUrl:''});await db.init();let id=await db.insertUser('Owner','camaraprodetect@gmail.com','hash',Date.now()),token=crypto.randomUUID();await db.insertSession(id,crypto.createHash('sha256').update(token).digest('hex'),Date.now(),Date.now()+3600000);await db.close();return {dir,sqlitePath,token};}
test('catalog APIs integrate view/cart counters, sale controls and cloning; deny anonymous access',async()=>{
 const f=await fixture(),p=await port(),base=`http://127.0.0.1:${p}`;
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(p),HOST:'127.0.0.1',DATABASE_URL:'',VERSANS_DB_PATH:f.sqlitePath,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
 let err='';child.stderr.on('data',b=>err+=b);
 const fetchJson=async(url,method='GET',body,auth=true)=>{const res=await fetch(base+url,{method,headers:{Origin:base,Accept:'application/json',...(auth?{Cookie:'versans_session='+encodeURIComponent(f.token)}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};};
 try{
  let alive=false;for(let i=0;i<80;i++){try{let h=await fetch(base+'/');if(h.status){alive=true;break}}catch{}await new Promise(r=>setTimeout(r,60));}assert(alive,'server startup: '+err);
  const catalog=await fetchJson('/api/admin/catalog');assert.equal(catalog.status,200,JSON.stringify(catalog.body));const slug=catalog.body.products[0].slug;
  let denied=await fetchJson('/api/admin/catalog/'+slug+'/controls','POST',{publishAt:null},false);assert.equal(denied.status,403);
  let event=await fetchJson('/api/catalog/activity','POST',{slug,kind:'view'},false);assert.equal(event.status,200,JSON.stringify(event.body));
  let stats=await fetchJson('/api/admin/catalog/insights');assert.equal(stats.status,200,JSON.stringify(stats.body));assert(stats.body.insights[slug].views>=1);
  let controls=await fetchJson('/api/admin/catalog/'+slug+'/controls','POST',{publishAt:Date.now()+7200000,unitCost:20,sale:null});assert.equal(controls.status,200,JSON.stringify(controls.body));
  let publicCatalog=await fetch(base+'/api/catalog/overrides.js');let script=await publicCatalog.text();assert(script.includes('"'+slug+'":null'),'future product must be hidden in storefront overrides');
  const clone=await fetchJson('/api/admin/catalog/'+slug+'/duplicate','POST',{});assert.equal(clone.status,201,JSON.stringify(clone.body));
  let list=await fetchJson('/api/admin/catalog');assert(list.body.products.some(x=>x.slug===clone.body.slug&&x.hidden));
  let edit=await fetchJson('/api/admin/catalog/bulk','POST',{slugs:[slug],action:'description_set',value:'מתועד'});assert.equal(edit.status,200,JSON.stringify(edit.body));
  const history=await fetchJson('/api/admin/catalog/'+slug+'/controls');assert.equal(history.status,200);
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));fs.rmSync(f.dir,{recursive:true,force:true});}
});
