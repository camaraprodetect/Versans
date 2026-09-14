const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const product = fs.readFileSync(path.join(root, 'product.html'), 'utf8');

for (const html of [index, product]) {
  assert.ok(html.includes('<span class="brand__logo"><img src="images/versans-logo-header.png'), 'header must contain one logo image');
  assert.ok(!html.includes("this.src='data:image/png;base64"), 'logo must not add an embedded image fallback');
  const headerMatch = html.match(/<header class="nav"[\s\S]*?<\/header>/);
  assert.ok(headerMatch, 'page must have a nav header');
  const count = (headerMatch[0].match(/class="brand__logo"/g) || []).length;
  assert.strictEqual(count, 1, 'header must contain exactly one logo wrapper');
}

assert.ok(css.includes('/* ===== Single-logo safe header layout 2026-09-14 ===== */'), 'final single-logo header layout must exist');
assert.ok(css.includes('background-image:none!important'), 'logo wrapper must not render a second background logo');
assert.ok(css.includes('@media(min-width:981px)'), 'desktop layout must have its own non-overlapping rule');
assert.ok(css.includes('position:static!important'), 'desktop brand must participate in layout instead of floating over categories');
assert.ok(css.includes('flex:0 0 190px!important'), 'desktop must reserve width for the logo');
assert.ok(css.includes('@media(max-width:980px)'), 'tablet/mobile logo layout must be explicitly handled');
assert.ok(css.includes('left:50%!important'), 'mobile logo must remain centered');

console.log('PASS: one logo only, centered on mobile and reserved beside desktop categories');
