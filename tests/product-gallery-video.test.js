const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/product.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');

assert(html.includes('id="productMainVideo"'), 'product page should include a video player in the gallery stage');
assert(js.includes('product.videos'), 'product gallery should read product videos');
assert(js.includes('data-gallery-video-index'), 'product gallery should render clickable video thumbnails');
assert(js.includes('productMainVideo'), 'product gallery should switch the main stage to the video player');
assert(css.includes('.product-gallery__stage>video'), 'video should be styled to fit the gallery stage');
console.log('product gallery video test passed');
