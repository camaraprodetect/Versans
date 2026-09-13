const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

for (const n of [65, 66]) {
  const p = PRODUCTS.find(x => x.slug === `product-${n}`);
  assert.ok(p, `product-${n} must exist`);
  assert.deepStrictEqual(p.categories, ['glasses', 'glasses-women'], `product-${n} must be women-only glasses`);
  assert.strictEqual(p.price, 139.9, `product-${n} price must be 139.90`);
  assert.strictEqual(p.badge.he, '2 ב־249.90 ₪');
  assert.ok(/UV400/i.test(JSON.stringify(p.details)), `product-${n} must mention UV400`);
  assert.ok(/plastic|פלסטיק/i.test(JSON.stringify(p.details)), `product-${n} must mention plastic frame material`);
  assert.ok(fs.existsSync(path.join(__dirname, '..', p.images[0])), `product-${n} main image must exist`);
  assert.ok(fs.existsSync(path.join(__dirname, '..', p.hoverImage)), `product-${n} hover image must exist`);
}

console.log('PASS: products 65-66 exist as women narrow cat-eye sunglasses with main + hover images');
