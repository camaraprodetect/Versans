const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(index.includes('<picture class="glasses-collection-banner__picture">'), 'Banner must use a responsive <picture> element');
assert.ok(index.includes('media="(min-width: 1440px)"'), 'Wide desktop source must start at 1440px');
assert.ok(index.includes('images/glasses-collection-banner-wide.png'), 'Wide desktop banner asset must be configured');
assert.ok(index.includes('media="(min-width: 768px)"'), 'Medium source must start at 768px');
assert.ok(index.includes('images/glasses-collection-banner-medium.png'), 'Medium banner asset must be configured');
assert.ok(index.includes('images/glasses-collection-banner.png'), 'Mobile/default banner asset must remain configured');
assert.ok(css.includes('.glasses-collection-banner__picture'), 'Responsive picture wrapper must be styled');
assert.ok(css.includes('max-width:1600px'), 'Banner must not upscale beyond the largest supplied asset');
assert.ok(css.includes('height:auto'), 'Banner must preserve each source image aspect ratio');

for (const filename of [
  'glasses-collection-banner.png',
  'glasses-collection-banner-medium.png',
  'glasses-collection-banner-wide.png'
]) {
  assert.ok(fs.existsSync(path.join(root, 'images', filename)), `${filename} must exist`);
}

console.log('PASS: responsive glasses banner source selection');
