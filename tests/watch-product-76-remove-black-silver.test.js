const assert = require('assert');
const { PRODUCTS } = require('../assets/products.js');

const p = PRODUCTS.find(x => x.slug === 'product-76');
assert(p, 'product-76 should exist');
assert.strictEqual(p.title.he, 'שעון Hannah Martin 40mm עם Gift Box Set');

assert(!p.colors.some(c => c.id === 'black-silver'), 'black-silver purchase option must be removed');
assert(!p.colors.some(c => c.label && c.label.he === 'שחור / כסף'), 'Black / Silver color choice must not be visible');
assert(!p.colors.some(c => c.image === 'images/products/product-76/product-76-6.jpg'), 'removed image must not be selectable as a color');
assert(!p.images.includes('images/products/product-76/product-76-6.jpg'), 'removed image must not appear in product gallery');
assert.strictEqual(p.colors.length, 6, 'product-76 should have 6 purchasable color choices after removal');
assert.strictEqual(p.images.length, 6, 'product-76 gallery should have 6 images after removal');
assert(p.details.he.some(x => /6 צבעים/.test(x)), 'Hebrew details should state 6 color options');
assert(p.details.en.some(x => /6 color/.test(x)), 'English details should state 6 color options');

console.log('product-76 black/silver removal test passed');
