const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const p = PRODUCTS.find(x => x.slug === 'product-84');
assert(p, 'product-84 should exist');
assert.strictEqual(p.title.he, 'שעון רויאל דיי', 'Hebrew title should match');
assert.strictEqual(p.price, 449.9, 'product-84 price should be 449.90');
assert.strictEqual(p.category, 'watches', 'product-84 should be a watch');
assert.strictEqual(p.colorDisplay, 'image-choice', 'color selector should use image choices');
assert.strictEqual(p.images.length, 4, 'gallery should include the 4 supplied images');
assert.strictEqual(p.colors.length, 4, 'should have 4 image-based color choices');
assert(Array.isArray(p.videos) && p.videos.length === 1, 'product-84 should include the supplied product video');

for (const src of p.images) {
  assert(src.endsWith('.png'), `image should stay PNG: ${src}`);
  assert(fs.existsSync(path.resolve(__dirname, '..', src)), `missing product image: ${src}`);
}
for (const c of p.colors) {
  assert(c.image && p.images.includes(c.image), `color ${c.id} should use one of the supplied images`);
}
const videoSrc = typeof p.videos[0] === 'string' ? p.videos[0] : p.videos[0].src;
assert(videoSrc.endsWith('.mp4'), 'video should be MP4');
assert(fs.existsSync(path.resolve(__dirname, '..', videoSrc)), `missing product video: ${videoSrc}`);

const p81 = PRODUCTS.find(x => x.slug === 'product-81');
assert(p81, 'product-81 should exist');
assert.deepStrictEqual(
  p.details.he.filter(x => !/שילובי צבעים|אפשרויות צבע/.test(x)),
  p81.details.he.filter(x => !/שילובי צבעים|אפשרויות צבע/.test(x)),
  'technical Hebrew details should match product-81'
);

const idx84 = PRODUCTS.findIndex(x => x.slug === 'product-84');
const idx81 = PRODUCTS.findIndex(x => x.slug === 'product-81');
const idx82 = PRODUCTS.findIndex(x => x.slug === 'product-82');
const idx83 = PRODUCTS.findIndex(x => x.slug === 'product-83');
assert(idx84 >= 0 && idx84 < idx81 && idx84 < idx82 && idx84 < idx83, 'product-84 should appear before the black/silver/gold Royal Day products');
console.log('product-84 test passed');
