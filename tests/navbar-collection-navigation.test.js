const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');

const categories = [
  ['all', 'הכל'],
  ['greeting', 'תכשיט עם ברכה'],
  ['necklaces', 'שרשראות'],
  ['bracelets', 'צמידים'],
  ['photo-bracelets', 'צמיד תמונה'],
  ['watches', 'שעונים'],
  ['glasses', 'משקפיים'],
  ['gift-boxes', 'מארזים'],
  ['custom', 'Custom'],
  ['sets', 'סטים']
];

for (const [key, label] of categories) {
  assert.ok(index.includes(`data-nav-cat="${key}"`), `Navbar must expose the ${key} collection`);
  assert.ok(index.includes(`data-cat="${key}"`), `Navbar ${key} item must reuse the existing catalog filter behavior`);
  assert.ok(index.includes(`>${label}</a>`), `Navbar must show the ${label} label`);
}

assert.ok(/\.brand\{[^}]*grid-column:1[^}]*justify-self:start/.test(css), 'Desktop brand must move from the center to the side');
assert.ok(/\.nav__menu\{[^}]*grid-column:2[^}]*justify-self:center/.test(css), 'Desktop collection navigation must occupy the center column');
assert.ok(/@media\(max-width:980px\)[\s\S]*?\.brand\{[^}]*grid-column:2[^}]*justify-self:center/.test(css), 'Mobile should keep the compact centered logo layout');
assert.ok(css.includes('.nav__menu a.is-active'), 'Active collection must be visibly highlighted in the navbar');

assert.ok(store.includes('function renderCollectionNav()'), 'Store must synchronize navbar active state with the current collection');
assert.ok(store.includes("$('[data-nav-cat=\"' + state.filter + '\"]')") || store.includes('[data-nav-cat]'), 'Navbar state must be derived from state.filter');
assert.ok(store.includes("el.closest('.nav__menu')"), 'Selecting a collection in the mobile drawer must close the navbar');

console.log('PASS: collection navigation is integrated into the header');
