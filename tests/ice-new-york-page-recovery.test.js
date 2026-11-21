'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const routes = require('../assets/routes.js');
const necklace = require('../lib/catalog-seeds/ice-new-york-product.json');
const root = path.resolve(__dirname, '..');

test('admin and product page HTML templates are present and nonempty', () => {
  for (const name of ['admin.html', 'product.html', 'index.html']) {
    const file = path.join(root, name);
    assert.ok(fs.statSync(file).size > 1000, `Missing or empty ${name}`);
  }
});

test('canonical ICE NEW YORK URL uses the shared product page', () => {
  assert.equal(routes.productPath(necklace), '/ice-new-york-cz-necklace');
  assert.equal(routes.productPath({slug:'product-291',urlSlug:'other-necklace'}), '/product.html?id=product-291');
  assert.equal(necklace.slug, 'product-294');
  assert.equal(necklace.category, 'necklaces');
});

test('server resolves product by id, slug, and urlSlug', () => {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const match = /function productById\(id\) \{[\s\S]*?\n\}/.exec(source);
  assert.ok(match, 'Product lookup missing');
  const productById = new Function('PRODUCTS', `${match[0]}; return productById;`)([necklace]);
  assert.equal(productById('product-294'), necklace);
  assert.equal(productById(necklace.id), necklace);
  assert.equal(productById('ice-new-york-cz-necklace'), necklace);
  assert.equal(productById('unknown'), null);
});

test('ICE NEW YORK prices, lengths, widths and four photographs are intact', () => {
  assert.equal(necklace.price, 389);
  assert.equal(necklace.compareAt, 499);
  assert.deepEqual(necklace.sizes.map(x => x.label.he), ['45 ס״מ','50 ס״מ','55 ס״מ','60 ס״מ']);
  assert.deepEqual(necklace.colors.map(x => x.label.he), ['8 מ״מ','14 מ״מ']);
  assert.equal(necklace.images.length, 4);
  for (const image of necklace.images) {
    const file=path.join(root,image);
    assert.ok(fs.existsSync(file), `Image missing: ${image}`);
    assert.ok(fs.statSync(file).size > 100000);
  }
});

test('production template and scripts for product selection exist', () => {
  const html=fs.readFileSync(path.join(root, 'product.html'), 'utf8');
  const script=fs.readFileSync(path.join(root, 'assets/product.js'), 'utf8');
  assert.match(html, /assets\/products\.js/);
  assert.match(html, /assets\/product\.js/);
  assert.match(script, /PRODUCTS\[i\]\.slug === productId/);
});
