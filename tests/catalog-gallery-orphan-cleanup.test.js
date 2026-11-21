'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {createDatabase} = require('../lib/database.js');
const {createCatalogManager} = require('../lib/catalog-manager.js');

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-gallery-orphan-'));
  const db = createDatabase({sqlitePath: path.join(dir, 'test.sqlite'), databaseUrl: ''});
  await db.init();
  const manager = createCatalogManager(db);
  await manager.init();
  return {dir, db, manager};
}
async function cleanup(f) { await f.db.close(); fs.rmSync(f.dir, {recursive:true, force:true}); }

// Run the actual gallery-image helper with a tiny fake DOM, not a rewritten
// implementation: this catches the old hoverImage auto-add regression.
function browserGalleryContext(product, mainSrc) {
  const script = fs.readFileSync(path.join(__dirname, '../assets/product.js'), 'utf8');
  const from = script.indexOf('  // For jewelry, only admin-saved gallery images belong');
  const until = script.indexOf('  function galleryVideos()', from);
  assert(from > 0 && until > from, 'gallery helpers must be present');
  const main = {
    src:mainSrc, hidden:false,
    getAttribute(k){return k === 'src' ? this.src : null;},
    removeAttribute(k){if(k === 'src')this.src = '';}
  };
  const calls = [];
  const scope = {
    product, main, URL, document:{baseURI:'https://versans.com/product.html'},
    $:id=>id === '#productMainImage' ? main : null,
    activeImageIndex:1,
    isGlassesProduct:p=>p.category === 'glasses',
    L:value=>value && value.he || 'Product',
    setMainImage(src){main.src=src;main.hidden=false;calls.push(['fallback',src]);},
    renderStaticGallery(){calls.push(['rerender']);}
  };
  vm.createContext(scope);
  vm.runInContext(script.slice(from, until), scope);
  return {scope, main, calls};
}

test('hover-only image is never silently appended to the product gallery', () => {
  const {scope} = browserGalleryContext({images:['images/one.png','images/two.png'],hoverImage:'images/deleted.png'},'images/one.png');
  assert.deepEqual(Array.from(scope.galleryImages()), ['images/one.png','images/two.png']);
});

test('glasses keep their intentional hover image in the gallery', () => {
  const {scope}=browserGalleryContext({category:'glasses',images:['images/front.png'],hoverImage:'images/side.png'},'images/front.png');
  assert.deepEqual(Array.from(scope.galleryImages()),['images/front.png','images/side.png']);
});

test('a broken gallery image is hidden, leaving a valid image selected', () => {
  const broken='images/missing.png', valid='images/ok.png';
  const {scope,main,calls}=browserGalleryContext({images:[valid,broken],hoverImage:'images/ghost.png'},broken);
  scope.skipUnavailableGalleryImage(broken);
  assert.deepEqual(Array.from(scope.galleryImages()),[valid]);
  assert.equal(main.src,valid);
  assert.deepEqual(calls, [['fallback',valid],['rerender']]);
  scope.skipUnavailableGalleryImage(broken);
  assert.equal(calls.length,2,'repeated failures do not create a render loop');
});

test('main broken image hides cleanly when no alternative is available', () => {
  const {scope,main}=browserGalleryContext({images:['images/missing.png']},'images/missing.png');
  scope.skipUnavailableGalleryImage('images/missing.png');
  assert.equal(main.hidden,true);
  assert.equal(main.src,'');
  assert.deepEqual(Array.from(scope.galleryImages()),[]);
});

test('removing an image also cleans the identical hover image and persists',async () => {
  const f=await fixture();
  try {
    const p=f.manager.getAdminProduct('product-15');
    assert(p.images.includes(p.hoverImage),'the fixture needs an image also used for hover');
    const images=p.images.filter(src=>src!==p.hoverImage);
    const out=await f.manager.write({images},p.slug,false,'owner');
    assert.equal(out.product.hoverImage,'');
    assert.deepEqual(out.product.images,images);
    const reload=createCatalogManager(f.db);await reload.init();
    assert.equal(reload.getAdminProduct(p.slug).hoverImage,'');
  } finally {await cleanup(f);}
});

test('a separate intentional hover image is preserved if other gallery images are removed',async () => {
  const f=await fixture();
  try {
    const p=f.manager.getAdminProduct('product-15');
    const distinct='images/products/product-15/hover-custom.png';
    await f.manager.write({hoverImage:distinct},p.slug,false,'owner');
    const edited=await f.manager.write({images:p.images.slice(1)},p.slug,false,'owner');
    assert.equal(edited.product.hoverImage,distinct);
  }finally{await cleanup(f);}
});

test('reordering the photo gallery does not clear a still-used hover image',async () => {
  const f=await fixture();
  try {
    const p=f.manager.getAdminProduct('product-15');
    const result=await f.manager.write({images:p.images.slice().reverse()},p.slug,false,'owner');
    assert.equal(result.product.hoverImage,p.hoverImage);
  }finally{await cleanup(f);}
});
