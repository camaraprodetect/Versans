const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const root = path.resolve(__dirname, '..');

assert(
  !PRODUCTS.some(x => x.slug === 'product-89' || x.id === 'watch-tachymeter-pro-black-01' || x.urlSlug === 'tachymeter-pro-black-watch'),
  'deleted Tachymeter Pro product must not exist in catalog'
);

const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
assert(!css.includes('product-89/product-89-2.png'), 'deleted product-specific CSS must be removed');

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
assert(!sitemap.includes('tachymeter-pro-black-watch'), 'deleted product URL must be removed from sitemap');

console.log('product-89 deletion test passed');
