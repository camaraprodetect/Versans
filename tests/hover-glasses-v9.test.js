const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');
for (const pid of [38,39]) {
  const p = PRODUCTS.find(x => x.slug === `product-${pid}`);
  assert.ok(p, `product-${pid} missing`);
  assert.strictEqual(p.hoverImage, `images/products/product-${pid}/product-${pid}-2.png`);
  assert.ok(fs.existsSync(path.join(__dirname, '..', p.hoverImage)), `${p.hoverImage} missing`);
}
console.log('PASS: hover images mapped for product-38 and product-39');
