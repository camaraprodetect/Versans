const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const p = PRODUCTS.find(x => x.slug === 'product-77');
assert.ok(p, 'product-77 must exist');
assert.strictEqual(p.title.he, 'שעון אייס - צבע כסף');
assert.deepStrictEqual(p.images, [
  'images/products/product-77/product-77-1.png',
  'images/products/product-77/product-77-2.png',
  'images/products/product-77/product-77-3.png'
]);
for (const rel of p.images) {
  const full = path.join(__dirname, '..', rel);
  assert.ok(fs.existsSync(full), `missing asset: ${rel}`);
}
console.log('PASS: product-77 silver ICE watch gallery assets exist');
