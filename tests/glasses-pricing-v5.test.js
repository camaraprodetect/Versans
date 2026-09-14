const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');
const pricing = require('../assets/glasses-pricing.js');
const { priceOrder } = require('../api/_hyp.js');

const glasses = PRODUCTS.filter(p => Array.isArray(p.categories) && p.categories.includes('glasses'));
assert.strictEqual(glasses.length, 52, 'Expected 52 glasses products');
for (const p of glasses) {
  assert.strictEqual(p.price, 139.9, `${p.slug} must cost 139.90`);
  assert.strictEqual(p.badge.he, '2 ב־249.90 ₪', `${p.slug} Hebrew badge mismatch`);
  assert.strictEqual(p.badge.en, '2 for ₪249.90', `${p.slug} English badge mismatch`);
}

assert.strictEqual(pricing.totalForQty(139.9, 1), 139.9);
assert.strictEqual(pricing.totalForQty(139.9, 2), 249.9);
assert.strictEqual(pricing.totalForQty(139.9, 3), 389.8);
assert.strictEqual(pricing.totalForQty(139.9, 4), 499.8);
assert.strictEqual(pricing.discountForUnits(2), 29.9);
assert.strictEqual(pricing.discountForUnits(4), 59.8);

const id = glasses[0].id;
let order = priceOrder([{ id, qty: 2 }], 'he');
assert.strictEqual(order.subtotal, 279.8);
assert.strictEqual(order.discount, 29.9);
assert.strictEqual(order.total, 249.9);
assert.strictEqual(order.discountLabel, 'מבצע משקפיים - 2 ב־249.90 ₪');

order = priceOrder([{ id, qty: 3 }], 'he');
assert.strictEqual(order.total, 389.8);
order = priceOrder([{ id, qty: 4 }], 'he');
assert.strictEqual(order.total, 499.8);

const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'store.js'), 'utf8');
assert.ok(storeSrc.includes("(isGlasses ? '' : '<p class=\"prod__sub\">'"), 'Index must hide glasses subtitles');
assert.ok(/\(isGlasses \? '' : '<a class="btn btn--ghost"/.test(storeSrc), 'Index must hide the secondary More photos button for glasses');

const productSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'product.js'), 'utf8');
assert.ok(productSrc.includes('2 משקפיים ב־249.90 ₪'), 'Product page must show the 2-glasses bundle label');
assert.ok(productSrc.includes('glassesPurchaseTotal'), 'Product page must use bundle-aware quantity total');

console.log('PASS: glasses v6 pricing and UI rules');
