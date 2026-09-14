const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(css.includes('justify-content:flex-start!important;'), 'Mobile drawer categories should start at the top instead of being vertically centered');
assert.ok(css.includes('font-size:1.16rem!important;'), 'Mobile drawer category text should be slightly larger');
console.log('PASS: mobile drawer starts at top and uses slightly larger category text');
