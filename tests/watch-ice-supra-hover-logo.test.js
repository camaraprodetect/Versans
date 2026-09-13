const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

for (const id of [90, 91, 92, 93]) {
  const src = `product-${id}/product-${id}-2.png`;
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const selectorPattern = new RegExp(`\\.prod__img--hover\\[src\\*=["']${escaped}["']\\][\\s\\S]*?object-fit:\\s*contain\\s*!important`);
  assert(selectorPattern.test(css), `product-${id} hover image should use contain so the VerSans logo is not cropped`);

  const transformPattern = new RegExp(`\\.prod__img--hover\\[src\\*=["']${escaped}["']\\][\\s\\S]*?transform:\\s*none\\s*!important`);
  assert(transformPattern.test(css), `product-${id} hover image should disable hover zoom`);
}

console.log('Ice Supra hover-logo test passed');
