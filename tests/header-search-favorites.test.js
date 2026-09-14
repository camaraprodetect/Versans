const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const product = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const shared = fs.existsSync(path.join(root, 'assets', 'site-header.js'))
  ? fs.readFileSync(path.join(root, 'assets', 'site-header.js'), 'utf8')
  : '';

for (const html of [index, product]) {
  assert.ok(html.includes('data-site-search-open'), 'header must expose a search button');
  assert.ok(html.includes('data-site-favorites-open'), 'header must expose a favorites button');
  assert.ok(html.includes('id="favoritesCount"'), 'header must include a favorites counter');
  assert.ok(html.includes('images/versans-logo-header.png'), 'header must use the supplied no-crown VerSans logo');
  assert.ok(html.includes('assets/site-header.js'), 'pages must load shared search/favorites behavior');
}

assert.ok(product.includes('id="productFavoriteBtn"'), 'product page must include a like/favorite button');
assert.ok(shared.includes("versans_favorites"), 'favorites must persist in localStorage');
assert.ok(shared.includes('window.PRODUCTS || PRODUCTS'), 'search must use the real product catalog');
assert.ok(shared.includes('product.html?id='), 'search/favorite results must link to product pages');
assert.ok(css.includes('/* ===== VerSans header search + favorites 2026-09-13 ===== */'), 'header feature CSS block must exist');
assert.ok(css.includes('grid-template-columns:1fr auto 1fr'), 'mobile header must center the logo between left and right controls');
assert.ok(css.includes('.product-favorite-btn'), 'product favorite control must be styled');

console.log('PASS: shared VerSans header search, favorites, no-crown logo and product like button are wired');
