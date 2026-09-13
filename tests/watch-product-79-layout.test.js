const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const root = path.resolve(__dirname, '..');
const p = PRODUCTS.find(x => x.slug === 'product-79');
assert(p, 'product-79 should exist');
assert.strictEqual(p.price, 399.9, 'product-79 price should be 399.90');

const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');
assert(css.includes('body[data-product-slug="product-79"] .product-size-grid.product-option-grid--colors'), 'product-79 needs a robust body-scoped color grid override');
assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))!important'), 'product-79 color choices should use the full row in five equal columns');
assert(css.includes('body[data-product-slug="product-79"] .product-choice--color'), 'product-79 color cards should have their own size override');
assert(css.includes('max-width:none!important'), 'product-79 color cards should not be capped at the old 86px width');
assert(css.includes('body[data-product-slug="product-79"] .product-gallery'), 'product-79 gallery should have a wider thumbnail rail');
assert(css.includes('grid-template-columns:86px minmax(0,1fr)!important'), 'product-79 gallery rail should be 86px wide');
assert(css.includes('width:78px!important'), 'product-79 gallery thumbnails should be 78px wide');
assert(css.includes('height:78px!important'), 'product-79 gallery thumbnails should be 78px tall');

const js = fs.readFileSync(path.join(root, 'assets/product.js'), 'utf8');
assert(js.includes("document.body.dataset.productSlug = String(product.slug || product.id || '')"), 'product page should expose product slug for scoped styling');

console.log('product-79 layout test passed');
