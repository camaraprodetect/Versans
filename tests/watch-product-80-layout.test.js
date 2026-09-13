const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');

assert(
  css.includes('body[data-product-slug="product-80"] .product-choice--color .product-choice__image'),
  'product-80 color image boxes need a product-scoped sizing rule'
);
assert(
  css.includes('body[data-product-slug="product-80"] .product-choice--color .product-choice__image img'),
  'product-80 color images need a product-scoped fill rule'
);
assert(
  css.includes('transform:scale(1.95)!important'),
  'product-80 color thumbnails should be zoomed enough to fill the card image area'
);
assert(
  css.includes('padding:0!important'),
  'product-80 color thumbnails should not keep inner padding'
);

console.log('product-80 layout test passed');

const html = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
assert(/assets\/styles\.css\?v=[^\"']+/.test(html), 'product page should use a cache-busted styles.css URL so product-80 thumbnail fixes load immediately');
