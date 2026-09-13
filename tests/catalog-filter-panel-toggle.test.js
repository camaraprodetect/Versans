const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const store = fs.readFileSync(path.join(root, 'assets', 'store.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(html.includes('data-catalog-filter-toggle'), 'Catalog filters need a whole-panel toggle control');
assert.ok(/data-catalog-filter-toggle[^>]*aria-expanded="false"/.test(html), 'Filter panel toggle should start collapsed');
assert.ok(/id="filters"[^>]*hidden/.test(html), 'Filter controls should be hidden on first load');
assert.ok(store.includes("[data-catalog-filter-toggle]"), 'Store logic must handle the filter panel toggle');
assert.ok(store.includes('aria-expanded'), 'Store logic must update toggle accessibility state');
assert.ok(css.includes('.shop__filter-toggle'), 'Filter panel toggle needs styling on desktop and mobile');

console.log('PASS: catalog filters start collapsed and expand only after pressing the toggle');
