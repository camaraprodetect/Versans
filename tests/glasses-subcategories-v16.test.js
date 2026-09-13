const assert = require('assert');
const { PRODUCTS, CATEGORIES } = require('../assets/products.js');

const glassesCategory = CATEGORIES.find(c => c.key === 'glasses');
assert.ok(glassesCategory, 'Glasses category must exist');
assert.deepStrictEqual(glassesCategory.children.map(c => c.key), ['glasses-men', 'glasses-women', 'glasses-unisex']);

const glasses = PRODUCTS.filter(p => Array.isArray(p.categories) && p.categories.includes('glasses'));
assert.strictEqual(glasses.length, 52, 'Expected 52 glasses products after adding 26 women-only models');

const womenOnly = glasses.filter(p => JSON.stringify(p.categories) === JSON.stringify(['glasses','glasses-women']));
assert.strictEqual(womenOnly.length, 26, 'Expected 26 women-only glasses models');

for (const p of womenOnly) {
  assert.ok(!p.categories.includes('glasses-men'), p.slug + ' must not be in men');
  assert.ok(!p.categories.includes('glasses-unisex'), p.slug + ' must not be in unisex');
  assert.ok(p.hoverImage && p.images && p.images[0], p.slug + ' must include main and hover images');
}

const unisex = glasses.filter(p => p.categories.includes('glasses-men') && p.categories.includes('glasses-women') && p.categories.includes('glasses-unisex'));
assert.strictEqual(unisex.length, 26, 'Existing unisex glasses products should remain assigned to all three subcategories');

console.log('PASS: glasses subcategories include 26 women-only models and preserve existing plus 3 new unisex products');
