const assert = require('assert');
const { PRODUCTS } = require('../assets/products.js');

const p = PRODUCTS.find(x => x.slug === 'product-78');
assert.ok(p, 'product-78 must exist');
assert.strictEqual(p.id, 'watch-ice-gold-01');
assert.strictEqual(p.category, 'watches');
assert.deepStrictEqual(p.categories, ['watches']);
assert.strictEqual(p.price, 429.9);
assert.strictEqual(p.title.he, 'שעון אייס - צבע זהב');
assert.strictEqual(p.cardImage, 'images/products/product-78/product-78-1.png');
assert.strictEqual(p.hoverImage, 'images/products/product-78/product-78-2.png');
assert.deepStrictEqual(p.images, [
  'images/products/product-78/product-78-1.png',
  'images/products/product-78/product-78-2.png',
  'images/products/product-78/product-78-3.png'
]);
assert.strictEqual(p.hideMessageCard, true);
console.log('PASS: product-78 is the gold ICE watch with correct price and gallery');
