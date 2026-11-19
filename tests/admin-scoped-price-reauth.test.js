'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/admin.js'),'utf8');
const first=source.indexOf('  async function renderScopedProductSection(){');
const last=source.indexOf('  async function renderProductsPage()',first);
assert(first>=0&&last>first);
const body=source.slice(first,last)+'\nthis.renderScopedProductSection=renderScopedProductSection;';
function response(status, data){return {status,ok:status>=200&&status<300,json:async()=>data};}
function makeNode(tag,klass='',content=''){
 return {tag,className:klass,textContent:content,children:[],handlers:{},attributes:{},style:{},hidden:false,disabled:false,value:'',
  append(...nodes){this.children.push(...nodes);if(this.tag==='select'&&nodes.length&&!this.value&&nodes[0].value)this.value=nodes[0].value;},
  appendChild(n){this.append(n);},addEventListener(evt,callback){this.handlers[evt]=callback;},
  setAttribute(key,value){this.attributes[key]=value;},focus(){this.focused=true;},
  all(predicate){return [...(predicate(this)?[this]:[]),...this.children.flatMap(node=>node.all?.(predicate)||[])];}
 };
}
const sample={slug:'product-243',title:{he:'צמיד'},price:300,compareAt:489,description:{he:'תיאור קודם'},subtitle:{he:'משנה'}};
async function setup(fetchImpl,perms=['products.price']){
 const calls=[];
 const mockFetch=async(url,opts)=>{calls.push({url,opts});return fetchImpl(url,opts,calls);};
 const ctx={fetch:mockFetch,console,Promise,JSON,Number,encodeURIComponent,
   hasCapability:(permission)=>perms.includes(permission),
   api:async(url)=>url==='/api/admin/catalog'?{products:[sample]}:{product:sample},
   make:makeNode,
   catalogTitle:(p)=>p.title.he,
   catalogButton:(label,cls,fn)=>{const b=makeNode('button',cls,label);b.handlers.click=fn;return b;}
 };
 vm.runInNewContext(body,ctx);
 const root=await ctx.renderScopedProductSection();
 const find=(klass)=>root.all(n=>n.className?.split(' ').includes(klass))[0];
 const inputs=root.all(n=>n.tag==='input'||n.tag==='textarea');
 const save=find('admin-catalog-primary');
 const panel=find('admin-catalog-inline-reauth');
 return {root,save,panel,inputs,find,calls};
}
async function click(b){await b.handlers.click();}
async function submit(form){await form.handlers.submit({preventDefault(){}});}
test('employee price edit: 428 reveals an inline password form, verifies and retries unchanged body',async()=>{
 let puts=0;
 const o=await setup((url)=>{
  if(url==='/api/admin/employees/reauth')return response(200,{ok:true});
  return ++puts===1?response(428,{error:'reauth_required'}):response(200,{ok:true});
 });
 assert.equal(o.panel.hidden,true);
 await click(o.save);
 assert.equal(o.panel.hidden,false);
 assert.equal(o.inputs.find(n=>n.type==='password').focused,true);
 assert.match(o.root.all(n=>n.attributes.role==='status')[0].textContent,/סיסמ/);
 const password=o.inputs.find(n=>n.type==='password');password.value='not-a-real-password';
 await submit(o.panel);
 assert.equal(o.panel.hidden,true);
 assert.equal(puts,2);
 assert.deepEqual(o.calls.map(c=>c.url),['/api/admin/catalog/product-243','/api/admin/employees/reauth','/api/admin/catalog/product-243']);
 assert.equal(o.calls[0].opts.headers['X-Versans-Admin-Reauth'],'managed');
 assert.equal(o.calls[0].opts.body,o.calls[2].opts.body);
 assert.equal(JSON.parse(o.calls[1].opts.body).password,'not-a-real-password');
 assert.equal(password.value,'');
});
test('wrong password stays inline, does not retry product, and clears input',async()=>{
 let puts=0;
 const o=await setup(url=>url.includes('/reauth')?response(401,{error:'reauth_failed'}):(puts++,response(428,{error:'reauth_required'})));
 await click(o.save);
 const pwd=o.inputs.find(n=>n.type==='password');pwd.value='bad-password';
 await submit(o.panel);
 assert.equal(puts,1);assert.equal(o.panel.hidden,false);assert.equal(pwd.value,'');
 assert.match(o.root.all(n=>n.attributes.role==='status')[0].textContent,/שגויה/);
});
test('cancelling and switching products clears pending challenge without a retry',async()=>{
 const o=await setup(()=>response(428,{error:'reauth_required'}));
 await click(o.save);
 const cancel=o.panel.all(n=>n.textContent==='ביטול אימות')[0];await click(cancel);
 assert.equal(o.panel.hidden,true);assert.equal(o.calls.length,1);
 await click(o.save);
 const selector=o.root.all(n=>n.tag==='select')[0];await selector.onchange();
 assert.equal(o.panel.hidden,true);
});
test('non-428 permission error leaves the password panel hidden',async()=>{
 const o=await setup(()=>response(403,{error:'permission_denied'}));
 await click(o.save);assert.equal(o.panel.hidden,true);
 assert.match(o.root.all(n=>n.attributes.role==='status')[0].textContent,/אין לעובד הרשאה/);
});
test('repeated 428 after password stops; no infinite retries',async()=>{
 let puts=0;
 const o=await setup(url=>url.includes('/reauth')?response(200,{ok:true}):(puts++,response(428,{error:'reauth_required'})));
 await click(o.save);o.inputs.find(n=>n.type==='password').value='example';await submit(o.panel);
 assert.equal(puts,2);assert.equal(o.panel.hidden,false);
 assert.match(o.root.all(n=>n.attributes.role==='status')[0].textContent,/עדיין דורש אימות/);
});
test('description-only editor does not require reauthentication when server saves',async()=>{
 const o=await setup(()=>response(200,{ok:true}),['products.description']);
 await click(o.save);assert.equal(o.panel.hidden,true);
 assert.match(o.root.all(n=>n.attributes.role==='status')[0].textContent,/עודכן בהצלחה/);
});
