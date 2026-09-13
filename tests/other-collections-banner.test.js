const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');

assert.ok(index.includes('id="otherCollectionsBanner"'), 'Index must include a banner for collections that do not already have one');
assert.ok(index.includes('images/other-collections-banner.png'), 'Mobile banner asset must be wired');
assert.ok(index.includes('images/other-collections-banner-medium.png'), 'Medium banner asset must be wired');
assert.ok(index.includes('images/other-collections-banner-wide.png'), 'Wide banner asset must be wired');
assert.ok(index.indexOf('id="otherCollectionsBanner"') < index.indexOf('class="shop__layout"'), 'Other collections banner must appear before the catalog layout');
assert.ok(css.includes('.other-collections-banner'), 'Other collections banner must have responsive styling');
assert.ok(store.includes("var otherCollectionsBanner = $('#otherCollectionsBanner')"), 'Store logic must target the new banner');
for (const key of ['greeting','necklaces','bracelets','photo-bracelets','gift-boxes','custom','sets']) {
  assert.ok(store.includes(`state.filter === '${key}'`) || store.includes(`'${key}'`), `Banner logic must include ${key}`);
}
assert.ok(store.includes("state.filter.indexOf('greeting-') === 0"), 'Greeting subcategories must show the banner');
assert.ok(/showOtherCollectionsBanner\s*=\s*[\s\S]{0,400}state\.filter\s*===\s*'all'/.test(store), 'All collection must show the generic banner');

console.log('PASS: generic collection banner responsive visibility rules');
