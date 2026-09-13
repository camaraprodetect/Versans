const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const expected = [
  ['product-85', 'שעון OLEVS Gift Box Set - צבע לבן'],
  ['product-86', 'שעון OLEVS Gift Box Set - צבע ורוד'],
  ['product-87', 'שעון OLEVS Gift Box Set - צבע תכלת'],
  ['product-88', 'שעון OLEVS Gift Box Set - צבע סגול'],
];

for (const [slug, title] of expected) {
  const p = PRODUCTS.find(x => x.slug === slug);
  assert(p, `${slug} should exist`);
  assert.strictEqual(p.title.he, title, `${slug} Hebrew title should match`);
  assert.strictEqual(p.price, 489.9, `${slug} price should be 489.90`);
  assert(Array.isArray(p.categories), `${slug} should have categories`);
  assert(p.categories.includes('watches'), `${slug} should be in watches`);
  assert(p.categories.includes('gift-boxes'), `${slug} should be in gift-boxes`);
  assert.strictEqual(p.images.length, 2, `${slug} product page should include main + hover images`);
  assert.strictEqual(p.hoverImage, p.images[1], `${slug} hover image should be second gallery image`);
  for (const src of p.images) {
    assert(src.endsWith('.png'), `${slug} images should remain PNG: ${src}`);
    assert(fs.existsSync(path.resolve(__dirname, '..', src)), `${slug} missing image: ${src}`);
  }
}

const hannah = PRODUCTS.find(x => x.slug === 'product-76');
assert(hannah, 'product-76 Hannah Martin should exist');
assert(Array.isArray(hannah.categories) && hannah.categories.includes('watches'), 'Hannah should remain in watches');
assert(hannah.categories.includes('gift-boxes'), 'Hannah should also be in gift-boxes');


const order = PRODUCTS.map(x => x.slug);
const royalDayOrder = ['product-84', 'product-81', 'product-82', 'product-83'];
const giftSetOrder = ['product-85', 'product-86', 'product-87', 'product-88'];
for (let i = 0; i < royalDayOrder.length - 1; i++) {
  assert(order.indexOf(royalDayOrder[i]) < order.indexOf(royalDayOrder[i + 1]), 'Royal Day products should stay grouped in order');
}
assert(order.indexOf('product-83') < order.indexOf('product-85'), 'New gift-set products should come after all Royal Day watches');
for (let i = 0; i < giftSetOrder.length - 1; i++) {
  assert(order.indexOf(giftSetOrder[i]) < order.indexOf(giftSetOrder[i + 1]), 'Gift-set products 85-88 should keep their order');
}

console.log('watch gift-set products 85-88 test passed');
