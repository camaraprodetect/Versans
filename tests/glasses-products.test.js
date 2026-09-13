const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'products.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.__products = PRODUCTS; this.__categories = CATEGORIES;', sandbox);
const products = sandbox.__products;
const categories = sandbox.__categories;

const glasses = products.filter(p => Array.isArray(p.categories) && p.categories.includes('glasses'));
assert.strictEqual(glasses.length, 52, `Expected 52 separate glasses products, got ${glasses.length}`);

for (const p of glasses) {
  assert.strictEqual(p.price, 139.9, `${p.slug} price must be 139.90`);
  assert.strictEqual(p.images.length, 1, `${p.slug} must be a separate product with exactly one image`);
  const customerText = JSON.stringify({title:p.title, subtitle:p.subtitle, details:p.details, afterText:p.afterText});
  assert.ok(!/AliExpress|אליאקספרס|הספק|supplier/i.test(customerText), `${p.slug} exposes supplier/AliExpress language`);
}

assert.ok(categories.some(c => c.key === 'glasses'), 'Glasses category must exist');

const slugs = new Set(glasses.map(p => p.slug));
assert.strictEqual(slugs.size, 52, 'Glasses products must have unique slugs');

const womenSquare = glasses.filter(p => /^product-(4[5-9]|5[0-3])$/.test(p.slug));
assert.strictEqual(womenSquare.length, 9, 'Expected 9 women square sunglasses products (45-53)');
for (const p of womenSquare) {
  const customerText = JSON.stringify({title:p.title, cardTitle:p.cardTitle, subtitle:p.subtitle, details:p.details, afterText:p.afterText});
  assert.ok(/Oversized Square/i.test(customerText), `${p.slug} should use the Oversized Square product naming`);
  assert.ok(/UV400/i.test(customerText), `${p.slug} should include UV400 information from the product listing`);
  assert.ok(!/CATERSIDE|QVQV|AliExpress|אליאקספרס|supplier|הספק/i.test(customerText), `${p.slug} exposes marketplace/supplier branding`);
}

const womenPilot = glasses.filter(p => /^product-(5[4-7])$/.test(p.slug));
assert.strictEqual(womenPilot.length, 4, 'Expected 4 women pilot sunglasses products (54-57)');
for (const p of womenPilot) {
  const customerText = JSON.stringify({title:p.title, cardTitle:p.cardTitle, subtitle:p.subtitle, details:p.details, afterText:p.afterText});
  assert.ok(/Oversized Pilot/i.test(customerText), `${p.slug} should use the Oversized Pilot product naming`);
  assert.ok(!/QVQV|AliExpress|אליאקספרס|supplier|הספק/i.test(customerText), `${p.slug} exposes marketplace/supplier branding`);
}

const womenPearl = glasses.filter(p => /^product-(5[8-9]|60)$/.test(p.slug));
assert.strictEqual(womenPearl.length, 3, 'Expected 3 women pearl oval sunglasses products (58-60)');
for (const p of womenPearl) {
  const customerText = JSON.stringify({title:p.title, cardTitle:p.cardTitle, subtitle:p.subtitle, details:p.details, afterText:p.afterText});
  assert.ok(/Pearl Oval/i.test(customerText), `${p.slug} should use the Pearl Oval product naming`);
  assert.ok(/UV400/i.test(customerText), `${p.slug} should include UV400 information from the product listing`);
  assert.ok(!/QVQV|AliExpress|אליאקספרס|supplier|הספק/i.test(customerText), `${p.slug} exposes marketplace/supplier branding`);
}

const womenKoreanOval = glasses.filter(p => /^product-(6[1-4])$/.test(p.slug));
assert.strictEqual(womenKoreanOval.length, 4, 'Expected 4 women Korean oval sunglasses products (61-64)');
for (const p of womenKoreanOval) {
  const customerText = JSON.stringify({title:p.title, cardTitle:p.cardTitle, subtitle:p.subtitle, details:p.details, afterText:p.afterText});
  assert.ok(/Oval/i.test(customerText), `${p.slug} should use oval product naming`);
  assert.ok(/UV400/i.test(customerText), `${p.slug} should include UV400 information from the product listing`);
  assert.ok(/metal|מתכת/i.test(customerText), `${p.slug} should include the metal-frame material information from the listing`);
  assert.ok(!/QVQV|AliExpress|אליאקספרס|supplier|הספק/i.test(customerText), `${p.slug} exposes marketplace/supplier branding`);
}


const womenMetalOval = glasses.filter(p => /^product-(6[7-9]|70)$/.test(p.slug));
assert.strictEqual(womenMetalOval.length, 4, 'Expected 4 women metal oval sunglasses products (67-70)');
for (const p of womenMetalOval) {
  const customerText = JSON.stringify({title:p.title, cardTitle:p.cardTitle, subtitle:p.subtitle, details:p.details, afterText:p.afterText});
  assert.ok(/Metal Oval/i.test(customerText), `${p.slug} should use Metal Oval product naming`);
  assert.ok(/UV400/i.test(customerText), `${p.slug} should include UV400 information from the listing`);
  assert.ok(/metal|מתכת/i.test(customerText), `${p.slug} should include metal-frame information from the listing`);
  assert.ok(!/QVQV|AliExpress|אליאקספרס|supplier|הספק/i.test(customerText), `${p.slug} exposes marketplace/supplier branding`);
}

console.log('PASS: 52 separate glasses products with clean customer-facing copy; products 67-70 use verified Metal Oval details without supplier branding.');
