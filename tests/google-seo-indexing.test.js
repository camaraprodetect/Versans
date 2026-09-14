const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PRODUCTS } = require('../assets/products.js');
const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('robots.txt exposes sitemap and allows storefront crawling', () => {
  const robots = read('robots.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/versans\.com\/sitemap\.xml/);
});

test('sitemap contains home, collections, policies, and every product', () => {
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, /<loc>https:\/\/versans\.com\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/versans\.com\/\?cat=watches<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/versans\.com\/policies\.html<\/loc>/);
  for (const product of PRODUCTS) {
    assert.ok(sitemap.includes(`https://versans.com/product.html?id=${encodeURIComponent(product.id)}`), `missing ${product.id}`);
  }
});

test('server serves robots and sitemap', () => {
  const server = read('server.js');
  assert.match(server, /pathname === '\/robots\.txt'/);
  assert.match(server, /pathname === '\/sitemap\.xml'/);
  assert.match(server, /'\.xml': 'application\/xml; charset=utf-8'/);
});

test('transactional pages are noindex', () => {
  for (const file of ['account.html','login.html','register.html','thank-you.html','greeting-editor.html','necklaces.html']) {
    assert.match(read(file), /name="robots" content="noindex, follow"/, file);
  }
});

test('public pages and products expose canonical metadata', () => {
  assert.match(read('index.html'), /<link rel="canonical" href="https:\/\/versans\.com\/">/);
  assert.match(read('policies.html'), /<link rel="canonical" href="https:\/\/versans\.com\/policies\.html">/);
  assert.match(read('product.html'), /<meta name="robots" content="index, follow">/);
  const productJs = read('assets/product.js');
  assert.match(productJs, /function updateProductSeo\(\)/);
  assert.match(productJs, /application\/ld\+json/);
  assert.match(productJs, /https:\/\/versans\.com\/product\.html\?id=/);
});
