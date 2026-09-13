const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const root = path.resolve(__dirname, '..');
const expected = [
  ['product-90', 'שעון אייס סופרה - צבע כסף'],
  ['product-91', 'שעון אייס סופרה - צבע כסף וזהב'],
  ['product-92', 'שעון אייס סופרה - צבע שחור'],
  ['product-93', 'שעון אייס סופרה - צבע זהב'],
];

for (const [slug, title] of expected) {
  const p = PRODUCTS.find(x => x.slug === slug);
  assert(p, `${slug} should exist`);
  assert.strictEqual(p.title.he, title, `${slug} Hebrew title should match`);
  assert(!p.title.he.includes('—'), `${slug} title must not contain an em dash`);
  assert.strictEqual(p.price, 549.9, `${slug} price should be 549.90`);
  assert.strictEqual(p.category, 'watches', `${slug} should be in watches`);
  assert(Array.isArray(p.categories) && p.categories.includes('watches'), `${slug} should include watches category`);
  assert.strictEqual(p.images.length, 3, `${slug} should include all 3 supplied images`);
  assert.strictEqual(p.cardImage, `images/products/${slug}/${slug}-1.png`, `${slug} card image`);
  assert.strictEqual(p.hoverImage, `images/products/${slug}/${slug}-2.png`, `${slug} hover image`);
  assert.strictEqual(p.images[0], p.cardImage, `${slug} main image should be first gallery image`);
  assert.strictEqual(p.images[1], p.hoverImage, `${slug} hover image should be second gallery image`);
  for (const src of p.images) {
    assert(src.endsWith('.png'), `${slug} images should stay PNG: ${src}`);
    assert(fs.existsSync(path.join(root, src)), `missing image: ${src}`);
  }
  assert(p.details.he.some(x => /Quartz/i.test(x)), `${slug} details should include Quartz`);
  assert(p.details.he.some(x => /יום/.test(x) && /תאריך/.test(x)), `${slug} details should mention day/date`);
  assert(p.details.he.some(x => /Waterproof|עמיד/.test(x)), `${slug} details should mention supplier waterproof claim`);
  assert(p.details.he.some(x => /קריסטל|אבנים/.test(x)), `${slug} details should describe iced-out stones without claiming real diamonds`);
}

const slugs = PRODUCTS.map(p => p.slug);
const positions = expected.map(([slug]) => slugs.indexOf(slug));
assert(positions.every(x => x >= 0), 'all Ice Supra products should be present in the product order');
assert.deepStrictEqual(positions, [...positions].sort((a,b) => a-b), 'Ice Supra products should appear in silver, silver-gold, black, gold order');

const html = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
assert(html.includes('assets/products.js?v=20260913-ice-supra-93-v14'), 'product page should cache-bust Ice Supra product data');

console.log('Ice Supra products 90-93 test passed');
