const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { PRODUCTS } = require('../assets/products.js');

const p = PRODUCTS.find(x => x.slug === 'product-79');
assert(p, 'product-79 should exist');
assert.strictEqual(p.title.he, 'שעון כרונו רויאל', 'Hebrew title should match');
assert(!p.title.he.includes('—'), 'Hebrew title must not contain an em dash');
assert.strictEqual(p.colorDisplay, 'image-choice', 'color selector should use image choices');
assert.strictEqual(p.colors.length, 5, 'should have 5 image-based color choices');
for (const c of p.colors) {
  assert(c.image, `color ${c.id} should have an image`);
  const abs = path.resolve(__dirname, '..', c.image);
  assert(fs.existsSync(abs), `missing color image: ${c.image}`);
}
assert(p.details.he.some(x => x.includes('3Bar')), 'details should include 3Bar water resistance');
assert(p.details.he.some(x => /Stainless Steel|נירוסטה/.test(x)), 'details should mention stainless steel');
console.log('product-79 test passed');
