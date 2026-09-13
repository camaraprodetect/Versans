const assert = require('assert');
const { PRODUCTS } = require('../assets/products.js');

const slugs = ['product-71', 'product-72', 'product-73'];
for (const slug of slugs) {
  const p = PRODUCTS.find(x => x.slug === slug);
  assert.ok(p, `${slug} must exist`);
  assert.deepStrictEqual(p.categories, ['glasses','glasses-men','glasses-women','glasses-unisex'], `${slug} must be men/women/unisex`);
  assert.strictEqual(p.price, 139.9, `${slug} price must be 139.90`);
  assert.strictEqual(p.images.length, 1, `${slug} must have one primary image`);
  assert.ok(p.hoverImage, `${slug} must have hover image`);
}
console.log('PASS: products 71-73 are unisex glasses with main/hover images and standard pricing');
