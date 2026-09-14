const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { PRODUCTS } = require('../assets/products.js');

const p = PRODUCTS.find(x => x.slug === 'product-82');
assert(p, 'product-82 should exist');
assert.strictEqual(p.title.he, 'שעון רויאל דיי - צבע כסף', 'Hebrew title should match');
assert(!p.title.he.includes('-'), 'Hebrew title must not contain an em dash');
assert.strictEqual(p.price, 449.9, 'product-82 price should be 449.90');
assert.strictEqual(p.category, 'watches', 'product-82 should be a watch');
assert.strictEqual(p.colorDisplay, 'image-choice', 'color selector should use image choices');
assert.strictEqual(p.colors.length, 2, 'should have 2 image-based silver color choices');
assert.strictEqual(p.images.length, 2, 'gallery should include the 2 supplied images');
assert.strictEqual(p.cardImage, 'images/products/product-82/product-82-1.png');
assert.strictEqual(p.hoverImage, 'images/products/product-82/product-82-2.png');
for (const c of p.colors) {
  assert(c.image, `color ${c.id} should have an image`);
  assert(c.image.endsWith('.png'), `color image should remain PNG: ${c.image}`);
  const abs = path.resolve(__dirname, '..', c.image);
  assert(fs.existsSync(abs), `missing color image: ${c.image}`);
}
const p81 = PRODUCTS.find(x => x.slug === 'product-81');
assert(p81, 'product-81 should exist for spec comparison');
assert.deepStrictEqual(
  p.details.he.filter(x => !/שילובי צבעים|אפשרויות צבע/.test(x)),
  p81.details.he.filter(x => !/שילובי צבעים|אפשרויות צבע/.test(x)),
  'technical Hebrew details should match product-81'
);
assert(p.details.he.some(x => x.includes('3Bar')), 'details should include 3Bar water resistance');
assert(p.details.he.some(x => /Stainless Steel|נירוסטה/.test(x)), 'details should mention stainless steel');
assert(p.details.he.some(x => /Hardlex/.test(x)), 'details should mention Hardlex');
assert(p.details.he.some(x => /35/.test(x) && /39/.test(x)), 'details should mention 35-39mm dial diameter');
assert(p.details.he.some(x => /9/.test(x)), 'details should mention 9mm case thickness');
assert(p.details.he.some(x => /יום/.test(x) && /תאריך/.test(x)), 'details should mention day and date display');
console.log('product-82 test passed');
