const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(index.includes('>סינון</p>'), 'Catalog sidebar heading must say סינון instead of קטגוריות');
assert.ok(index.includes('aria-label="סינון מוצרים"'), 'Catalog sidebar filter container must be labelled as product filtering');
assert.ok(store.includes('catalogFilters:'), 'Store state must keep product-filter state separate from collection state');
assert.ok(store.includes('function productColorKeys('), 'Store must derive real color metadata from product data');
assert.ok(store.includes('function matchesCatalogFilters('), 'Store must apply product filters after the active collection filter');
assert.ok(store.includes('data-product-color'), 'Sidebar must render color filter controls');
assert.ok(store.includes('data-price-min') && store.includes('data-price-max'), 'Sidebar must render free min/max price controls');
assert.ok(store.includes('data-clear-product-filters'), 'Sidebar must expose a clear-filters control');
assert.ok(/filter\(function \(p\) \{[\s\S]{0,700}matchesCatalogFilters\(p\)/.test(store), 'Grid rendering must filter products by the selected product filters');
assert.ok(store.includes('resetCatalogFilters();'), 'Changing the collection must reset product filters');
assert.ok(css.includes('.catalog-filter-section'), 'Product filter sections must have dedicated sidebar styling');
assert.ok(css.includes('.catalog-price-input'), 'Price min/max controls must have dedicated styling');
assert.ok(/\.nav__menu a\{[^}]*font-size:clamp\(\.9rem/.test(css), 'Desktop navbar category labels must be larger than before');

console.log('PASS: category-aware color and free min/max price filters are wired');
