const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');

assert.ok(index.includes('id="glassesCollectionBanner"'), 'Index must include the glasses collection banner container');
assert.ok(index.includes('images/glasses-collection-banner.png'), 'Index must use the supplied glasses banner asset');
assert.ok(index.indexOf('id="glassesCollectionBanner"') < index.indexOf('class="shop__layout"'), 'Banner must appear before the category/product layout');
assert.ok(css.includes('.glasses-collection-banner'), 'Banner must have dedicated responsive styling');
assert.ok(css.includes('max-width:1600px'), 'Banner must not upscale beyond the largest supplied responsive asset');
assert.ok(css.includes('height:auto'), 'Banner must preserve its aspect ratio');
assert.ok(store.includes("state.filter === 'glasses'"), 'Banner visibility must depend on the glasses filter');
assert.ok(store.includes("#glassesCollectionBanner"), 'Store logic must target the glasses banner element');

console.log('PASS: glasses collection banner responsive visibility rules');
