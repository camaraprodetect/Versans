const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');

for (const parent of ['greeting', 'glasses']) {
  assert.ok(index.includes(`data-nav-parent-toggle="${parent}"`), `${parent} parent must expose a mobile submenu toggle target`);
}

for (const child of ['greeting-mom', 'greeting-partner', 'greeting-daughter', 'greeting-sister', 'glasses-men', 'glasses-women', 'glasses-unisex']) {
  assert.ok(index.includes(`data-nav-subcat="${child}"`), `Navbar submenu must expose ${child}`);
  assert.ok(index.includes(`data-cat="${child}"`), `Navbar submenu ${child} must reuse catalog filtering`);
}

assert.ok(index.includes('nav__submenu'), 'Navbar must contain submenu markup');
assert.ok(css.includes('.nav__item--has-submenu:hover .nav__submenu'), 'Desktop hover must reveal subcategories');
assert.ok(css.includes('.nav__submenu.is-open'), 'Mobile submenu must have an explicit open state');
assert.ok(store.includes('data-nav-parent-toggle'), 'Store must handle mobile parent-category submenu taps');
assert.ok(store.includes('window.matchMedia'), 'Mobile submenu behavior must be responsive rather than desktop-only');
assert.ok(store.includes('[data-nav-subcat]'), 'Active child category state must be synchronized');

const desktopFont = css.match(/\.nav__menu a\{[^}]*font-size:clamp\(([^)]*)\)/);
assert.ok(desktopFont, 'Navbar should keep a responsive desktop font size');
assert.ok(desktopFont[1].includes('1.1'), 'Navbar desktop labels should be visibly larger than before');

console.log('PASS: navbar subcategory dropdowns and larger labels are wired');
