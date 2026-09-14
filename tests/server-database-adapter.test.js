'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('server uses shared async database store instead of direct node:sqlite statements', () => {
  assert.match(serverSource, /require\(['"]\.\/lib\/database\.js['"]\)/);
  assert.doesNotMatch(serverSource, /require\(['"]node:sqlite['"]\)/);
  assert.match(serverSource, /await database\.init\(\)/);
  assert.match(serverSource, /await database\.transaction\(/);
});
