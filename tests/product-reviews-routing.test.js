'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'product-reviews.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'product.html'), 'utf8');

test('product reviews resolve pretty URL slug before query id', () => {
  assert.match(source, /window\.location\.pathname/);
  assert.match(source, /findProduct\(pathSlug\) \|\| findProduct\(requestedId\)/);
  assert.doesNotMatch(source, /findProduct\(requestedId\) \|\| PRODUCTS\[0\]/);
});

test('unknown product keeps product review area hidden', () => {
  assert.match(source, /if \(!product\) \{\s*root\.hidden = true;\s*return;\s*\}/);
});

test('empty review result hides the entire product review section', () => {
  assert.match(source, /if \(!reviews\.length\) \{\s*root\.hidden = true;/);
});

test('product html busts cached review script', () => {
  assert.match(html, /product-reviews\.js\?v=20260916-product-reviews-routing-v6/);
});
