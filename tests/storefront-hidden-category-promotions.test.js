'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {PRODUCTS} = require('../assets/products.js');
const {createDatabase} = require('../lib/database.js');
const {createCatalogManager} = require('../lib/catalog-manager.js');
const {filterPublicPolicyHtml, filterPublicMarketingConfig, isProductInHiddenCategory} = require('../lib/storefront-category-visibility.js');
const routes = require('../assets/routes.js');
const seo = require('../lib/seo.js');

const hidden={hats:true,rings:true,'photo-bracelets':true};
function hasHiddenCategory(p){return isProductInHiddenCategory(p,hidden);}

test('category checks rely on product metadata, never a product name guess',()=>{
  assert.equal(hasHiddenCategory({category:'bracelets',title:{he:'טבעת בחוליה'} }),false);
  assert.equal(hasHiddenCategory({category:'necklaces',categories:['photo-bracelets','custom']}),true);
  assert.equal(hasHiddenCategory({category:'rings'}),true);
  assert.equal(hasHiddenCategory({categories:['hats']}),true);
  assert.equal(hasHiddenCategory({category:'bracelets'}),false);
});

test('existing stock has products in all three hidden categories, plus visible categories',()=>{
  for(const key of ['hats','rings','photo-bracelets'])assert.ok(PRODUCTS.some(p=>[p.category,...(p.categories||[])].includes(key)),key);
  assert.ok(PRODUCTS.some(p=>p.category==='necklaces'));
});

test('public marketing config strips hats, rings and projection content but retains unrelated offers',()=>{
  const original={
    bundles:[{id:'standard-hats-2',category:'hats',name:'2 כובעים'}, {id:'standard-jewelry',category:'jewelry',name:'2+1 תכשיטים'}, {id:'standard-glasses',category:'glasses',name:'2 משקפיים'}],
    banners:[{title:'כובעים',url:'/hats'},{title:'הקרנת תמונה',url:'/photo-projection-bracelet'},{title:'מבצע טבעות',url:'/rings'},{title:'הטבה מיוחדת לשרשראות',url:'/necklaces'}],
    popups:[{title:'כובעים עם מתנה',url:'/hats'},{title:'תכשיט עם תמונה מוצפנת',url:'/photo-bracelets'},{title:'טבעת טניס',url:'/rings'},{title:'קופון ברוכים הבאים',url:'/register'}]
  };
  const result=filterPublicMarketingConfig(original,hidden);
  assert.deepEqual(result.bundles.map(x=>x.id),['standard-jewelry','standard-glasses']);
  assert.deepEqual(result.banners.map(x=>x.url),['/necklaces']);
  assert.deepEqual(result.popups.map(x=>x.url),['/register']);
  assert.equal(original.popups.length,4,'admin state unchanged');
  assert.deepEqual(filterPublicMarketingConfig(original,{}),original,'restores when flags are cleared');
});

test('admin hide/show removes and restores public products without touching admin products or metadata',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-hide-cat-'));
  const db=createDatabase({sqlitePath:path.join(dir,'db.sqlite'),databaseUrl:''});
  await db.init();
  const manager=createCatalogManager(db);
  try {
    await manager.init();
    const initial=PRODUCTS.length;
    const adminProducts=manager.list();
    const target=adminProducts.find(p=>p.categories.includes('hats'));
    const originalTitle=target.title.he;
    for(const key of ['hats','rings','photo-bracelets'])await manager.setCategoryHidden(key,true,'owner');
    assert.deepEqual(manager.hiddenCategories(),hidden);
    assert.equal(PRODUCTS.some(hasHiddenCategory),false,'public PRODUCTS do not expose disabled categories');
    assert.ok(PRODUCTS.some(p=>p.category==='necklaces'),'unrelated products remain public');
    assert.equal(manager.list().length,adminProducts.length,'admin products remain');
    assert.equal(manager.getAdminProduct(target.slug).title.he,originalTitle);
    assert.equal(manager.patches()[target.slug],null,'legacy catalog override cannot re-add a hidden product');
    const xml=seo.renderSitemap(PRODUCTS,routes,manager.hiddenCategories());
    assert.equal(xml.includes('https://versans.com/hats<'),false);
    assert.equal(xml.includes('https://versans.com/rings<'),false);
    assert.equal(xml.includes('https://versans.com/photo-bracelets<'),false);
    assert.equal(xml.includes('https://versans.com/ring-size-guide<'),false);
    const rebuilt=createCatalogManager(db);
    await rebuilt.init();
    assert.equal(PRODUCTS.some(hasHiddenCategory),false,'flags remain active after DB reload');
    for(const key of ['hats','rings','photo-bracelets'])await rebuilt.setCategoryHidden(key,false,'owner');
    assert.equal(PRODUCTS.length,initial,'public products restored');
    assert.equal(PRODUCTS.some(p=>p.slug===target.slug),true,'product restored');
  } finally {
    await db.close();fs.rmSync(dir,{recursive:true,force:true});
  }
});


test('public policy text omits promotions for categories hidden by admin while source is untouched',()=>{
  const file=fs.readFileSync(path.join(__dirname,'../policies.html'),'utf8');
  const visible=filterPublicPolicyHtml(file,hidden);
  assert.ok(!visible.includes('מחיר כובע:'));
  assert.ok(!visible.includes('כובעים: זמן אספקה'));
  assert.ok(!visible.includes('טבעות, תכשיטי תמונה'));
  assert.ok(!visible.includes('כובעים, משקפיים'));
  assert.ok(visible.includes('משקפיים'));
  assert.equal(filterPublicPolicyHtml(file,{}),file);
});
