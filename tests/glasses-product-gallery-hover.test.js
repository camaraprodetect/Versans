const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const root = path.resolve(__dirname, '..');
const productJs = fs.readFileSync(path.join(root, 'assets/product.js'), 'utf8');

const glasses = PRODUCTS.filter(p => p.category === 'glasses' || (Array.isArray(p.categories) && p.categories.includes('glasses')));
assert(glasses.length > 0, 'expected glasses products in catalog');
assert(glasses.every(p => p.hoverImage), 'every glasses product should have a hover image available for the product gallery');

assert(
  productJs.includes('isGlassesProduct(product)'),
  'product gallery should identify glasses products'
);
assert(
  productJs.includes('product.hoverImage') && productJs.includes('isGlassesProduct(product)'),
  'product gallery should use the hover image for glasses'
);
assert(
  /images\.indexOf\(product\.hoverImage\)\s*===\s*-1/.test(productJs),
  'product gallery should avoid duplicating a hover image already present in images'
);
assert(
  /images\.push\(product\.hoverImage\)/.test(productJs),
  'glasses product gallery should append the hover image' 
);

const html = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
assert(
  html.includes('assets/product.js?v=20261121-gallery-orphan-fix-v1'),
  'product page should bust the product.js cache for the glasses hover-gallery change'
);

console.log('glasses product gallery hover-image test passed');
