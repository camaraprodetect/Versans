const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS, CATEGORIES } = require('../assets/products.js');

const glassesCategory = CATEGORIES.find(c => c.key === 'glasses');
assert.ok(glassesCategory, 'Glasses category must exist');
assert.ok(Array.isArray(glassesCategory.children), 'Glasses category must expose subcategories');
assert.deepStrictEqual(
  glassesCategory.children.map(c => c.key),
  ['glasses-men', 'glasses-women', 'glasses-unisex'],
  'Glasses subcategories must be men, women, unisex in that order'
);
assert.deepStrictEqual(
  glassesCategory.children.map(c => c.label.he),
  ['גברים', 'נשים', 'יוניסקס'],
  'Glasses subcategory Hebrew labels must be correct'
);

const glasses = PRODUCTS.filter(p => Array.isArray(p.categories) && p.categories.includes('glasses'));
assert.strictEqual(glasses.length, 52, 'Expected 52 glasses products');

const womenOnly = glasses.filter(p => JSON.stringify(p.categories) === JSON.stringify(['glasses', 'glasses-women']));
assert.strictEqual(womenOnly.length, 26, 'Expected 26 women-only glasses products');

const unisex = glasses.filter(p => ['glasses-men', 'glasses-women', 'glasses-unisex'].every(key => p.categories.includes(key)));
assert.strictEqual(unisex.length, 26, 'Expected 26 unisex glasses products to remain in all three subcategories');

const store = fs.readFileSync(path.join(__dirname, '../assets/store.js'), 'utf8');
assert.ok(
  store.includes("state.filter === 'glasses' || state.filter.indexOf('glasses-') === 0"),
  'Glasses banner must remain visible for glasses subcategories'
);

console.log('PASS: glasses men/women/unisex subcategories with 26 women-only models');
