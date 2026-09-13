const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');

assert.ok(!css.includes("content:'⌄'"), 'Navbar submenu parents must not render a down-arrow glyph');
assert.ok(!css.includes('.nav__item--has-submenu>a::before'), 'Navbar submenu parents must not use an arrow pseudo-element');

const menuRule = css.match(/\.nav__menu\{[^}]*gap:clamp\(([^)]*)\)/);
assert.ok(menuRule, 'Desktop navbar must keep a responsive gap');
const gapValues = menuRule[1];
assert.ok(gapValues.includes('1rem'), 'Desktop navbar minimum spacing should be increased to at least 1rem');
assert.ok(gapValues.includes('1.8rem'), 'Desktop navbar maximum spacing should be increased to 1.8rem');

assert.ok(css.includes('@media(max-width:1200px){\n .nav__inner{gap:.7rem}.nav__menu{gap:.75rem}'), 'Medium desktop navbar spacing should remain roomier than before');

console.log('PASS: navbar has no submenu arrows and uses roomier category spacing');
