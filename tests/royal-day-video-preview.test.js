const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PRODUCTS } = require('../assets/products.js');

const root = path.resolve(__dirname, '..');
for (const slug of ['product-81', 'product-82', 'product-83', 'product-84']) {
  const p = PRODUCTS.find(x => x.slug === slug);
  assert(p, `${slug} should exist`);
  assert(Array.isArray(p.videos) && p.videos.length === 1, `${slug} should have the Royal Day video`);
  const v = p.videos[0];
  assert(v && typeof v === 'object', `${slug} video should be an object`);
  assert(v.src && v.src.endsWith('.mp4'), `${slug} video should be MP4`);
  assert(v.poster && v.poster.endsWith('.png'), `${slug} should have a PNG video preview poster`);
  assert(fs.existsSync(path.join(root, v.src)), `${slug} missing video file: ${v.src}`);
  assert(fs.existsSync(path.join(root, v.poster)), `${slug} missing poster file: ${v.poster}`);
}

const js = fs.readFileSync(path.join(root, 'assets/product.js'), 'utf8');
assert(js.includes('entry.poster'), 'video thumbnail renderer should use the poster frame');
assert(js.includes('product-thumb__video-preview'), 'video thumbnail should render a preview image');
assert(!js.includes("product-thumb__video-label') + esc(lang === 'he' ? 'וידאו' : 'Video')"), 'video thumbnail should not render the plain Video label');

const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');
assert(css.includes('.product-thumb__video-preview'), 'video preview thumbnail should be styled');
console.log('royal day video preview test passed');
const html = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
assert(/assets\/products\.js\?v=[^"']+/.test(html), 'product data should keep a cache-busted URL after later catalog updates');
assert(/assets\/product\.js\?v=[^\"']*royal-day-video-preview-v12/.test(html), 'product gallery JS cache key should refresh');
assert(html.includes('assets/styles.css?v=20260913-royal-day-video-preview-v12'), 'product gallery CSS cache key should refresh');
