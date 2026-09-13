const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const productsSource = fs.readFileSync(path.join(root, 'assets', 'products.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${productsSource}\nthis.__PRODUCTS = PRODUCTS;`, sandbox);
const products = sandbox.__PRODUCTS;

const expected = new Map([
  ['product-40', 'images/products/product-40/product-40-2.png'],
  ['product-41', 'images/products/product-41/product-41-2.png'],
  ['product-42', 'images/products/product-42/product-42-2.png'],
  ['product-43', 'images/products/product-43/product-43-2.png'],
  ['product-44', 'images/products/product-44/product-44-2.png'],
]);

for (const [slug, expectedHover] of expected) {
  const product = products.find((p) => p.slug === slug);
  assert(product, `Missing ${slug}`);
  assert.strictEqual(product.hoverImage, expectedHover, `${slug} should use the new hover image`);
  assert(fs.existsSync(path.join(root, expectedHover)), `${slug} hover file should exist`);
}

for (const htmlFile of ['index.html', 'product.html', 'necklaces.html', 'greeting-editor.html']) {
  const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
  assert(
    html.includes('assets/products.js?v=20260912-glasses-v15'),
    `${htmlFile} should cache-bust products.js to glasses-v15`
  );
}

console.log('PASS: product-40..44 have ordered hover images and v13 cache busting.');
