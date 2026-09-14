const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { PRODUCTS } = require('../assets/products.js');

const p = PRODUCTS.find(x => x.slug === 'product-80');
assert(p, 'product-80 should exist');
assert.strictEqual(p.title.he, 'שעון לונה דייט', 'Hebrew title should match');
assert(!p.title.he.includes('-'), 'Hebrew title must not contain an em dash');
assert.strictEqual(p.price, 399.9, 'product-80 price should be 399.90');
assert.strictEqual(p.colorDisplay, 'image-choice', 'color selector should use image choices');
assert.strictEqual(p.colors.length, 6, 'should have 6 image-based color choices');
assert.strictEqual(p.images.length, 6, 'gallery should include the 6 supplied images');
for (const c of p.colors) {
  assert(c.image, `color ${c.id} should have an image`);
  assert(c.image.endsWith('.png'), `color image should remain PNG: ${c.image}`);
  const abs = path.resolve(__dirname, '..', c.image);
  assert(fs.existsSync(abs), `missing color image: ${c.image}`);
}
assert(p.details.he.some(x => x.includes('3Bar')), 'details should include 3Bar water resistance');
assert(p.details.he.some(x => /Stainless Steel|נירוסטה/.test(x)), 'details should mention stainless steel');
assert(p.details.he.some(x => /Hardlex/.test(x)), 'details should mention Hardlex');
assert(p.details.he.some(x => /24/.test(x)), 'details should mention 24mm band width');
console.log('product-80 test passed');
