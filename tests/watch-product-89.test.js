const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const root = path.resolve(__dirname, '..');
const p = PRODUCTS.find(x => x.slug === 'product-89');
assert(p, 'product-89 should exist');
assert.strictEqual(p.title.he, 'שעון טכימטר פרו - צבע שחור', 'Hebrew title should match');
assert(!p.title.he.includes('—'), 'Hebrew title must not contain an em dash');
assert.strictEqual(p.price, 419.9, 'product-89 price should be 419.90');
assert.strictEqual(p.category, 'watches', 'product-89 should be in watches');
assert(Array.isArray(p.categories) && p.categories.includes('watches'), 'product-89 should include watches category');
assert.strictEqual(p.images.length, 2, 'product page should include the two supplied images');
assert.strictEqual(p.cardImage, 'images/products/product-89/product-89-1.png');
assert.strictEqual(p.hoverImage, 'images/products/product-89/product-89-2.png');
assert.strictEqual(p.images[0], p.cardImage, 'main card image should be first gallery image');
assert.strictEqual(p.images[1], p.hoverImage, 'hover image should be second gallery image');
for (const src of p.images) {
  assert(src.endsWith('.png'), `image should remain PNG: ${src}`);
  assert(fs.existsSync(path.join(root, src)), `missing image: ${src}`);
}
assert(p.details.he.some(x => /FW-5016/.test(x)), 'details should include model FW-5016');
assert(p.details.he.some(x => /Quartz/.test(x)), 'details should include Quartz movement');
assert(p.details.he.some(x => /Stainless Steel|נירוסטה/.test(x)), 'details should mention stainless steel band');
assert(p.details.he.some(x => /זוהר|Luminous/i.test(x)), 'details should mention luminous display');
assert(p.details.he.some(x => /טכימטר|Tachymeter/i.test(x)), 'details should mention tachymeter scale');
assert(p.details.he.some(x => /תאריך/.test(x)), 'details should mention date window');

const html = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
assert(/assets\/products\.js\?v=20260913-/.test(html), 'product page should cache-bust product data');

console.log('product-89 test passed');

const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
assert(
  /\.prod__img--hover\[src\*=["']product-89\/product-89-2\.png["']\][\s\S]*?object-fit:\s*contain\s*!important/.test(css),
  'product-89 hover image should use contain so the VerSans logo is not cropped'
);
assert(
  /\.prod__img--hover\[src\*=["']product-89\/product-89-2\.png["']\][\s\S]*?transform:\s*none\s*!important/.test(css),
  'product-89 hover image should disable hover zoom'
);
