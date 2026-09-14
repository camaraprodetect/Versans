const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const product = fs.readFileSync(path.join(root, 'product.html'), 'utf8');

assert.ok(css.includes('/* ===== Header logo placement fix 2026-09-14 ===== */'), 'header placement fix CSS must exist');
assert.ok(css.includes('left:50%!important'), 'mobile logo must be physically centered');
assert.ok(css.includes('right:.65rem!important'), 'mobile search/menu controls must be on the physical right');
assert.ok(css.includes('left:.65rem!important'), 'mobile cart/favorites controls must be on the physical left');
assert.ok(css.includes('transform:translate(-50%,-50%)!important'), 'mobile logo must stay centered inside the nav row');
assert.ok(css.includes('overflow:hidden!important'), 'header row must contain the logo and prevent promo overlap');
for (const html of [index, product]) {
  assert.ok(html.includes('header-logo-placement-v2'), 'pages must cache-bust the corrected header CSS');
}

console.log('PASS: header logo remains inside the header and mobile controls match the requested sides');
