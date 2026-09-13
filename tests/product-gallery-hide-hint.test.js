const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'styles.css'), 'utf8');

if (!/\.product-page-body\s+\.product-gallery__hint\s*\{[^}]*display\s*:\s*none\s*!important[^}]*\}/s.test(css)) {
  throw new Error('Product page gallery hint must be hidden globally');
}

console.log('product gallery hint hidden');
