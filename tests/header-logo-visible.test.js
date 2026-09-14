const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const product = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

for (const html of [index, product]) {
  assert.ok(html.includes('<span class="brand__logo"><img src="images/versans-logo-header.png'), 'header must render the VerSans logo image');
}

assert.ok(css.includes('object-fit:contain!important'), 'header logo must use contain so the full logo is visible');
assert.ok(css.includes('.nav .brand__logo{display:block'), 'header logo wrapper must be displayed');
assert.ok(!css.includes('.nav .brand__logo{display:block;width:180px;height:58px;overflow:hidden}'), 'header logo wrapper must not clip the logo');

console.log('PASS: header logo is configured to remain fully visible on desktop and mobile');
