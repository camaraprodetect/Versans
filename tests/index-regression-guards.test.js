const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = ['index.html', 'hats-index.html', path.join('hats', 'index.html')];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function shopHead(html) {
  const start = html.indexOf('<div class="shop__head">');
  assert.notEqual(start, -1, 'shop__head section missing');
  const nextSection = html.indexOf('\n    <div class=', start + 1);
  return html.slice(start, nextSection === -1 ? start + 1200 : nextSection);
}

test('collection heading keeps only the requested title on storefront pages', () => {
  for (const rel of pages) {
    const block = shopHead(read(rel));
    assert.match(block, /<h2 id="shopTitle"[^>]*>הקולקציה שלנו<\/h2>/, rel);
    assert.doesNotMatch(block, /shop\.eyebrow|למי שחשוב לכם/, rel);
    assert.doesNotMatch(block, /shop\.sub|תכשיטים ליום־יום, ומתנות עם מילים שנשארות/, rel);
  }
});

test('FAQ section removed from main index stays removed', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /כל מה שחשוב לדעת/);
  assert.doesNotMatch(html, /id="faq"/);
});
