const fs = require('fs');
const path = require('path');
const assert = require('assert');

const store = fs.readFileSync(path.join(__dirname, '..', 'assets', 'store.js'), 'utf8');

const minInput = store.match(/<input class="catalog-price-input"[^>]*data-price-min[^>]*>/);
const maxInput = store.match(/<input class="catalog-price-input"[^>]*data-price-max[^>]*>/);

assert.ok(minInput, 'Minimum price input must exist');
assert.ok(maxInput, 'Maximum price input must exist');
assert.ok(/step="1"/.test(minInput[0]), 'Minimum price arrows must change by exactly 1 shekel');
assert.ok(/step="1"/.test(maxInput[0]), 'Maximum price arrows must change by exactly 1 shekel');
assert.ok(!/step="0\.01"/.test(minInput[0]), 'Minimum price must not increment by cents');
assert.ok(!/step="0\.01"/.test(maxInput[0]), 'Maximum price must not increment by cents');

console.log('PASS: min/max price spinner increments by 1 shekel');
