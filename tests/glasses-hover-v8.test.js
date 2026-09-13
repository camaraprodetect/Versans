const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PRODUCTS } = require('../assets/products.js');

const corrected = {
  25: { path: 'images/products/product-25/product-25-2.png?v=12', sha256: '008235a29e14c301354b795d13747384082f128bdca1206e7ecdc2bbca9cc4d4' },
  27: { path: 'images/products/product-27/product-27-2.png?v=12', sha256: '2d955f1aa7e7e2a84e37982ec75abdf99f3c326e59e6811c7915d86debf7deed' },
  28: { path: 'images/products/product-28/product-28-2.png?v=12', sha256: '2bf26209ced1dccff17f02a10b6155591e0df51d5b374ff13988bdafb8a58cd4' },
  30: { path: 'images/products/product-30/product-30-2.png?v=12', sha256: 'de87f059b9f9611cc243037b56ae296320705b9eff890cbe14882c7b27e35e63' }
};

for (let pid = 22; pid <= 37; pid++) {
  const p = PRODUCTS.find(x => x.slug === `product-${pid}`);
  assert.ok(p, `product-${pid} missing`);
  const expectedPath = corrected[pid] ? corrected[pid].path : `images/products/product-${pid}/product-${pid}-2.png`;
  assert.strictEqual(p.hoverImage, expectedPath, `product-${pid} hover mapping mismatch`);
  const diskPath = p.hoverImage.split('?')[0];
  const asset = path.join(__dirname, '..', diskPath);
  assert.ok(fs.existsSync(asset), `hover asset missing for product-${pid}`);
  if (corrected[pid]) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex');
    assert.strictEqual(hash, corrected[pid].sha256, `product-${pid} hover content is mapped to the wrong RTL card`);
  }
}

const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'store.js'), 'utf8');
assert.ok(storeSrc.includes('prod__img--hover'), 'store.js must render hover image');
console.log('PASS: glasses hover images are mapped to the correct RTL cards, including rows 2 and 3.');
