const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(/catalogFilters:\s*\{\s*colors:\s*\[\],\s*priceMin:\s*['\"]['\"],\s*priceMax:\s*['\"]['\"]\s*\}/.test(store), 'Catalog filter state must contain only colors, priceMin and priceMax');
assert.ok(store.includes('data-price-min'), 'Price filter must render a minimum-price input');
assert.ok(store.includes('data-price-max'), 'Price filter must render a maximum-price input');
assert.ok(store.includes('type="number"'), 'Price fields must use numeric inputs');
assert.ok(store.includes("filters.priceMin"), 'Minimum price must participate in matching');
assert.ok(store.includes("filters.priceMax"), 'Maximum price must participate in matching');
assert.ok(/price\s*<\s*minPrice/.test(store), 'Products below the minimum price must be excluded');
assert.ok(/price\s*>\s*maxPrice/.test(store), 'Products above the maximum price must be excluded');
assert.ok(store.includes("e.target.matches('[data-price-min], [data-price-max]')") || store.includes("closest('[data-price-min], [data-price-max]')"), 'Typing in either price field must update filtering');

['data-product-type', 'data-product-material', 'data-product-feature', 'data-delivery-range', 'data-sale-filter', 'data-price-range'].forEach((token) => {
  assert.ok(!store.includes(token), `Removed filter control must not remain: ${token}`);
});

assert.ok(css.includes('.catalog-price-inputs'), 'Min/max price inputs need dedicated layout styling');
assert.ok(css.includes('.catalog-price-input'), 'Price inputs need dedicated input styling');

console.log('PASS: catalog uses only color plus free min/max price filters');
