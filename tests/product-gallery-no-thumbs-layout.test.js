const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');

assert(
  css.includes('.product-page-body .product-gallery:has(.product-gallery__thumbs[hidden]){\n  grid-template-columns:1fr!important;\n}'),
  'a product with hidden thumbnails must force the gallery back to one full-width column'
);
assert(
  css.includes('.product-page-body .product-gallery:has(.product-gallery__thumbs[hidden]) .product-gallery__stage{\n  grid-column:1!important;\n}'),
  'the main product stage must occupy the full-width column when thumbnails are hidden'
);

const html = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
assert(
  /assets\/styles\.css\?v=[^\"']+/.test(html),
  'product page should use a cache-busted stylesheet URL so gallery fixes load immediately'
);

console.log('no-thumbnails product gallery layout test passed');
