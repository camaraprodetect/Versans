const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PRODUCTS } = require('../assets/products.js');
const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('every product has a unique clean root-level urlSlug', () => {
  const slugs = PRODUCTS.map((product) => product.urlSlug);
  assert.equal(slugs.length, 93);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.doesNotMatch(slug, /(?:^|-)product(?:-|$)|(?:^|-)caterside(?:-|$)|(?:^|-)versans(?:-|$)/);
    assert.doesNotMatch(slug, /(?:^|-)0?1$/);
  }
  assert.equal(PRODUCTS.find((p) => p.id === 'mom-heart-01').urlSlug, 'mom-heart-necklace');
});

test('shared routes expose clean collection paths', () => {
  const routes = require('../assets/routes.js');
  assert.equal(routes.collectionPath('watches'), '/watches');
  assert.equal(routes.collectionPath('glasses'), '/glasses');
  assert.equal(routes.collectionPath('gift-boxes'), '/gift-sets');
  assert.equal(routes.collectionPath('custom'), '/personal-design');
  assert.equal(routes.categoryFromPath('/glasses-women'), 'glasses-women');
});


test('product slugs do not collide with collection or page routes', () => {
  const routes = require('../assets/routes.js');
  const reserved = new Set([
    ...Object.values(routes.COLLECTION_PATHS),
    ...Object.keys(routes.PAGE_FILES)
  ].map((value) => value.replace(/^\//, '')).filter(Boolean));
  for (const product of PRODUCTS) {
    assert.equal(reserved.has(product.urlSlug), false, `reserved route collision: ${product.urlSlug}`);
  }
});

test('server contains clean product routing and permanent legacy redirects', () => {
  const server = read('server.js');
  assert.match(server, /urlSlug/);
  assert.match(server, /redirect\(res, [^\n]+, 301\)/);
  assert.match(server, /product\.html/);
  assert.match(server, /categoryFromPath/);
});

test('browser product links use clean route helpers instead of product.html?id', () => {
  for (const file of ['assets/store.js', 'assets/site-header.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /product\.html\?id=/, file);
  }
});

test('sitemap uses clean canonical URLs only', () => {
  const sitemap = read('sitemap.xml');
  assert.doesNotMatch(sitemap, /product\.html\?id=/);
  assert.doesNotMatch(sitemap, /\?cat=/);
  assert.match(sitemap, /<loc>https:\/\/versans\.com\/mom-heart-necklace<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/versans\.com\/watches<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/versans\.com\/glasses<\/loc>/);
});
