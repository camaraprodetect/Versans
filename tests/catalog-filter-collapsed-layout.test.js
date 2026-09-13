const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(css.includes('.shop__layout:has(.filters[hidden])'), 'Collapsed filters should collapse the sidebar column so products use the full width');
assert.ok(css.includes('.shop__layout:has(.filters[hidden]) .shop__sidebar'), 'Collapsed filter sidebar needs its own compact layout');
assert.ok(css.includes('.shop__layout:has(.filters[hidden]) .shop__filter-toggle'), 'Collapsed filter toggle should be compact instead of stretching an empty sidebar');
assert.ok(/@media\(max-width:980px\)[\s\S]*\.shop__layout:has\(\.filters\[hidden\]\) \.shop__sidebar/.test(css), 'Mobile/tablet collapsed filter bar should also be compact');

console.log('PASS: collapsed filter panel no longer reserves a large empty sidebar area');
