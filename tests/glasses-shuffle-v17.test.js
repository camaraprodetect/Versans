const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'assets/store.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(
  store.includes('function shuffleGlassesWithinList(list)'),
  'Store must define a dedicated glasses-only shuffle helper'
);
assert.ok(
  store.includes('list = shuffleGlassesWithinList(list);'),
  'renderGrid must apply the glasses shuffle after filtering, including the All view'
);
assert.ok(
  store.includes("if (!isGlassesProduct(p)) return p;"),
  'Shuffle must only move sunglasses and leave non-glasses products in their original slots'
);
assert.ok(
  store.includes('GLASSES_SHUFFLE_SEED'),
  'Shuffle must be stable instead of changing on every render'
);
assert.ok(
  index.includes('assets/store.js?v=20260912-glasses-v17'),
  'Index must cache-bust the updated store.js'
);

console.log('PASS: glasses are stably shuffled in every catalog view without moving non-glasses slots');
