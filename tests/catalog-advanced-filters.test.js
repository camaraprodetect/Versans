const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(store.includes('catalogFilterSections:'), 'Filter UI must remember expanded color/price sections');
assert.ok(store.includes('data-filter-section-toggle'), 'Filter sections must remain collapsible');
assert.ok(/\.shop__sidebar\{[^}]*max-height:calc\(100vh - 150px\)[^}]*overflow-y:auto/.test(css), 'Desktop filter sidebar must scroll inside the viewport');
assert.ok(/\.catalog-filter-options--colors\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(css), 'Color choices must render two per row');
assert.ok(css.includes('.catalog-price-inputs'), 'Price controls must use a compact min/max layout');
assert.ok(css.includes('.catalog-filter-title--toggle'), 'Collapsible filter headings need dedicated styling');
assert.ok(css.includes('.catalog-filter-options[hidden]'), 'Collapsed filter bodies must be hidden');
assert.ok(/@media\(max-width:980px\)[\s\S]*\.shop__sidebar\{[^}]*max-height:none[^}]*overflow:visible/.test(css), 'Mobile/tablet sidebar must return to normal page scrolling');

['data-product-type', 'data-product-material', 'data-product-feature', 'data-delivery-range', 'data-sale-filter'].forEach((token) => {
  assert.ok(!store.includes(token), `Removed advanced filter must not render: ${token}`);
});

console.log('PASS: compact scrollable catalog filters contain only color and min/max price');
