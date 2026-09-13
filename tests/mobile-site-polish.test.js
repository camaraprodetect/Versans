const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(html.includes('aria-label="קטגוריות החנות"'), 'index keeps the category navbar as the mobile category source');
assert.ok(css.includes('/* ===== Mobile storefront polish 2026-09-13 ===== */'), 'mobile polish block should exist');
assert.ok(css.includes('.home-page .hero.hero--full{display:none!important}'), 'mobile index hero should be removed');
assert.ok(css.includes('.home-page .prod__mobile-arrow{') && css.includes('background:transparent!important') && css.includes('border:0!important'), 'mobile product arrows should be visible, transparent and borderless');
assert.ok(css.includes('grid-template-rows:2.45rem 2.2rem 1.45rem 2.7rem 72px'), 'mobile product cards should reserve consistent content rows so cards align');
assert.ok(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'), 'mobile category navbar should show five categories per row');
assert.ok(css.includes('.home-page .nav__burger{display:none!important}'), 'home mobile categories should be visible without opening the burger');
assert.ok(/\.product-page-body \.product-gallery\{[\s\S]*?grid-template-columns:1fr!important/.test(css), 'mobile product gallery should be a single main column');
assert.ok(css.includes('.product-page-body .product-gallery__thumbs{') && css.includes('overflow-x:auto!important'), 'mobile gallery thumbnails should scroll horizontally instead of consuming a side rail');
assert.ok(/\.product-page-body \.product-size-grid\.product-option-grid--colors\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/.test(css), 'mobile image color choices should fit in a three-column grid');
assert.ok(css.includes('overflow-x:hidden'), 'mobile layout should guard against accidental horizontal page overflow');

console.log('PASS: mobile storefront and product pages use the compact responsive layout');
