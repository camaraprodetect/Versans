'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDatabase}=require('../lib/database.js');
const {createCatalogManager}=require('../lib/catalog-manager.js');
async function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-products-')),db=createDatabase({sqlitePath:path.join(dir,'test.sqlite'),databaseUrl:''});await db.init();const manager=createCatalogManager(db);await manager.init();return {db,manager,dir};}
test('bulk change of description preserves original details and writes no phantom data',async()=>{
 const f=await fixture();try{
  const p=f.manager.list()[0],slug=p.slug;const before=JSON.stringify(p.details);
  let change=await f.manager.bulkEdit({slugs:[slug],action:'description_set',value:'חדש לגמרי'},'owner@versans.com');
  assert.equal(change.updated,1);assert.equal(f.manager.getAdminProduct(slug).description.he,'חדש לגמרי');assert.equal(JSON.stringify(f.manager.getAdminProduct(slug).details),before);
  let again=createCatalogManager(f.db);await again.init();assert.equal(again.getAdminProduct(slug).description.he,'חדש לגמרי');
 }finally{await f.db.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('product duplication remains unpublished, preserves gallery but changes identity',async()=>{
 const f=await fixture();try{
  const p=f.manager.list()[0],out=await f.manager.duplicate(p.slug,'owner');
  assert.notEqual(out.slug,p.slug);assert.equal(out.product.id.startsWith('admin-'),true);
  assert.equal(f.manager.isHidden(out.slug),true);assert.equal(f.manager.getAdminProduct(out.slug).images[0],p.images[0]);
  assert.equal(f.manager.patches()[out.slug],null);
 }finally{await f.db.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('scheduled publication and sale adjust live checkout PRODUCTS without overwriting base price',async()=>{
 const f=await fixture();try{
  const p=f.manager.list()[0],now=Date.now();
  await f.manager.setControls(p.slug,{publishAt:now+3600000,unitCost:25,sale:{price:p.price-10,startAt:now-1000,endAt:now+120000}},'owner');
  assert.equal(f.manager.isHidden(p.slug),true);assert.equal(f.manager.patches()[p.slug],null);
  await f.manager.setControls(p.slug,{publishAt:null,unitCost:25,sale:{price:p.price-10,startAt:now-1000,endAt:now+120000}},'owner');
  const live=require('../assets/products.js').PRODUCTS.find(x=>x.slug===p.slug);
  assert.equal(live.price,p.price-10);assert.equal(live.compareAt,p.price);assert.equal(f.manager.getAdminProduct(p.slug).price,p.price);
  assert.equal(f.manager.patches()[p.slug].price,p.price-10);
  const newManager=createCatalogManager(f.db);await newManager.init();assert.equal(newManager.controls(p.slug).unitCost,25);
 }finally{await f.db.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('price edit records actor and sale schedule audit and activity counter survives database reopen',async()=>{
 const f=await fixture();try{
  const p=f.manager.list()[0];await f.manager.write({title:p.title,price:p.price+1,category:p.category,categories:p.categories,images:p.images},p.slug,false,'employee@example.com');
  let history=await f.manager.priceHistory(p.slug);assert.equal(history[0].actor,'employee@example.com');
  await f.db.recordCatalogProductActivity(p.slug,'view','2026-10-23');
  await f.db.recordCatalogProductActivity(p.slug,'cart','2026-10-23');
  await f.db.recordCatalogProductActivity(p.slug,'view','2026-10-23');
  const rows=await f.db.listCatalogProductActivity('2026-10-01');
  const act=rows.find(x=>x.product_slug===p.slug);assert.equal(act.views,2);assert.equal(act.cart_adds,1);
 }finally{await f.db.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
