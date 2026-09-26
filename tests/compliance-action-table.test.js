'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createDatabase } = require('../lib/database.js');
const pricing = require('../assets/pricing.js');
const { PRODUCTS } = require('../assets/products.js');
const { priceOrder } = require('../api/_hyp.js');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const files = {
  index: read('index.html'),
  product: read('product.html'),
  policies: read('policies.html'),
  register: read('register.html'),
  account: read('account.html'),
  server: read('server.js'),
  db: read('lib/database.js'),
  products: read('assets/products.js'),
  store: read('assets/store.js'),
  productJs: read('assets/product.js'),
  reviews: read('assets/reviews.js'),
  tracking: read('assets/track.js'),
  shipping: read('lib/shipping.js'),
  config: read('assets/config.js'),
  cancel: read('cancel-order.html'),
  privacy: read('privacy-request.html'),
};

function customerFacingText() {
  return [files.index, files.product, read('hats-index.html'), read('hats/index.html'), read('thank-you.html'), files.register, files.account].join('\n');
}

test('A3/D3/D4/D21: service phone, WhatsApp and hours are current', () => {
  const text = [files.config, files.policies, files.cancel, customerFacingText()].join('\n');
  assert.match(text, /055-302-6389/);
  assert.match(text, /972553026389/);
  assert.match(text, /08:00[–-]22:00/);
  assert.match(files.policies, /versanssupport@gmail\.com/);
  assert.doesNotMatch(text, /054[- ]?629[- ]?6037|972546296037/);
});

test('A4/A5/C29: checkout requires login, Israel only, and shows legal links', () => {
  assert.match(files.store, /\/api\/auth\/me/);
  assert.match(files.server, /pathname === '\/api\/create-payment'[\s\S]{0,500}?login_required/);
  assert.match(files.server, /israel_only/);
  assert.match(files.index, /name="country"[^>]*readonly[^>]*value="ישראל"|value="ישראל"[^>]*readonly/);
  assert.match(files.index, /href="\/policies#purchase"/);
  assert.match(files.index, /href="\/cancel-order"/);
  assert.match(files.index, /href="\/policies#privacy"/);
});

test('A7/A8/A9: real cancellation route and multiple cancellation channels exist', () => {
  assert.match(files.cancel, /<form[^>]+id="cancelOrderForm"/);
  assert.match(read('assets/request-forms.js'), /\/api\/cancel-order/);
  assert.match(files.server, /pathname === '\/api\/cancel-order'/);
  assert.match(files.index, /href="\/cancel-order"/);
  assert.match(files.cancel, /mailto:versanssupport@gmail\.com/);
  assert.match(files.cancel, /tel:\+972553026389/);
  assert.match(files.cancel, /wa\.me\/972553026389/);
});

test('A11/A12/A13/D7/A14/A20/A21/A22/D6/D8/D9/D11/D17: policy language matches required legal/business rules', () => {
  const p = files.policies;
  assert.match(p, /א[׳']–ה[׳']/);
  assert.match(p, /9–14/);
  assert.match(p, /9–20/);
  assert.match(p, /אישור התשלום/);
  assert.match(p, /אין באתר התחייבות מסחרית כללית ל־30 ימי החזרה/);
  assert.match(p, /דמי ביטול.*מוותרת|מוותרת.*דמי ביטול/);
  assert.match(p, /אישי|מותאם/);
  assert.match(p, /נכנסה לעיבוד, ייצור או משלוח/);
  assert.match(p, /בלאי|שימוש בניגוד/);
  assert.match(p, /קטין|הורה|אפוטרופוס/);
  assert.match(p, /דין מדינת ישראל/);
});

test('A18/A19: external tracking ID is absent from customer tracking payload/UI and customer WhatsApp template', () => {
  assert.doesNotMatch(files.tracking, /trackingNumber|trackingId|tracking_id/);
  assert.match(files.server, /function customerShipmentPayload[\s\S]*?itemOrderRef/);
  const payloadBody = files.server.match(/function customerShipmentPayload[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(payloadBody, /trackingNumber|trackingId|tracking_number/);
  const whatsappFn = files.shipping.match(/async function sendCustomerShippingWhatsApp[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(whatsappFn, /trackingNumber|trackingId|tracking_number/);
});

test('B1/B2/B15/B16: unsupported comparison/discount/UV/material claims are absent', () => {
  assert.doesNotMatch(files.products, /compareAt/);
  assert.doesNotMatch(customerFacingText(), /עד\s*40%/);
  assert.doesNotMatch(files.products, /UV\s*400|UV400|הגנת\s*UV/i);
  assert.doesNotMatch(files.products, /היפואלרג|hypoallergenic|ללא\s*ניקל|nickel[- ]?free/i);
});

test('B4/B5/B6/B8: promotions calculate in documented order and include item-level second-item details', () => {
  const hats = pricing.calculate([{ qty: 3, price: 139.9, categories: ['hats'], title: { he: 'כובע' } }], { lang: 'he' });
  assert.equal(hats.hatsTriples, 1);
  assert.equal(hats.bundleDiscount, 119.8);
  assert.equal(hats.secondItemCount, 1);
  assert.ok(hats.discountRows.find((r) => r.type === 'second-item')?.details?.length === 1);

  const glasses = pricing.calculate([{ qty: 2, price: 139.9, categories: ['glasses'], title: { he: 'משקפיים' } }], { lang: 'he' });
  assert.equal(glasses.glassesPairs, 1);
  assert.equal(glasses.bundleDiscount, 29.9);
  assert.equal(glasses.secondItemCount, 1);
  assert.match(files.policies, /2 משקפיים ב־249\.90/);
  assert.match(files.policies, /3 כובעים ב־299\.90/);
  assert.match(files.policies, /10%/);
});

test('B7/C23/C24/C25/C26/C27/C28: marketing consent is channel-specific and welcome coupon is email-consent gated', () => {
  assert.match(files.register, /marketingEmailOptIn/);
  assert.match(files.register, /marketingSmsOptIn/);
  assert.match(files.register, /marketingWhatsappOptIn/);
  for (const id of ['marketingEmailOptIn','marketingSmsOptIn','marketingWhatsappOptIn']) {
    const tag = files.register.match(new RegExp(`<input[^>]+id="${id}"[^>]*>`, 'i'))?.[0] || '';
    assert.ok(tag, `missing ${id}`);
    assert.doesNotMatch(tag, /\bchecked\b/i);
  }
  assert.match(files.register, /termsAccepted/);
  assert.match(files.server, /if \(marketingEmailOptIn\) await createWelcomeCoupon/);
  assert.match(files.server, /emailMarketingAllowed \? await createWelcomeCoupon/);
  assert.match(files.account, /accountMarketingEmail/);
  assert.match(files.account, /accountMarketingSms/);
  assert.match(files.account, /accountMarketingWhatsapp/);
  assert.match(files.policies, /הודעות שירות.*WhatsApp|WhatsApp.*הודעות שירות/);
});

test('B11/B18/B19/B20/B24/B25: product source-of-truth, imagery disclosure and IP/reporting are documented', () => {
  assert.match(files.policies, /עמוד המוצר.*מקור|המפרט.*עמוד המוצר/);
  assert.match(files.product, /להמחשה/);
  assert.match(files.product, /הבדלי גוון/);
  assert.match(files.product, /המפרט והמידות.*מקור/);
  assert.match(files.policies, /קניין רוחני/);
  assert.match(files.policies, /שימוש מסחרי|להעתיק/);
  assert.match(files.policies, /הפרת זכויות|זכויות יוצרים/);
  assert.match(files.policies, /versanssupport@gmail\.com/);
});

test('C1/C2/C6/E1/E2: account editing, deletion, order history and cancellation handoff are present', () => {
  assert.match(files.account, /accountProfileForm/);
  assert.match(files.account, /deleteAccountForm/);
  assert.match(files.account, /orderHistory|accountOrders|היסטוריית הזמנות/);
  assert.match(read('assets/auth.js'), /\/api\/account\/orders/);
  assert.match(read('assets/auth.js'), /api\('\/api\/auth\/account', 'PATCH'/);
  assert.match(read('assets/auth.js'), /api\('\/api\/auth\/account', 'DELETE'/);
  assert.match(files.account, /\/cancel-order/);
  assert.match(files.server, /reauth_failed/);
});

test('C4/C5/C15: deleting account preserves anonymized review; deleting review cascades its media', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-compliance-db-'));
  const db = createDatabase({ root: ROOT, sqlitePath: path.join(dir, 'test.sqlite') });
  await db.init();
  try {
    const uid = await db.insertUser('Reviewer','reviewer-compliance@example.com','hash',Date.now(),'+972501234567',{termsAcceptedAt:Date.now(),termsVersion:'2026-09-26'});
    const reviewId = await db.insertReview({userId:uid,reviewName:'לקוח',contactPhone:'+972501234567',verifiedPurchase:true,reviewProductId:PRODUCTS[0].id,reviewProductVariant:null,rating:4,body:'ביקורת בדיקה',reviewDate:Date.now(),mediaAdConsent:false,mediaRightsConfirmed:true,mediaTermsVersion:'2026-09-26',createdAt:Date.now(),updatedAt:Date.now()});
    await db.insertReviewMedia(reviewId,0,Buffer.from([1,2,3]),'image/png','image',Date.now());
    assert.equal((await db.listReviewMediaMeta(reviewId)).length, 1);
    await db.deleteUserPreservingReviews(uid);
    const rows = await db.listReviews(20, 0);
    const kept = rows.find((r) => Number(r.id) === Number(reviewId));
    assert.ok(kept);
    assert.equal(kept.user_id, null);
    await db.deleteReviewsByProductIds([PRODUCTS[0].id]);
    assert.equal((await db.listReviewMediaMeta(reviewId)).length, 0);
  } finally {
    await db.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('C10/C11/C12/C18/C19/C20/C21/C30/D5: privacy/analytics/processing/request/update disclosures exist', () => {
  const p = files.policies;
  assert.match(p, /Analytics|אנליט/);
  assert.match(p, /לאחר התחברות|משתמש מחובר/);
  assert.match(p, /Cookies|localStorage/);
  assert.match(p, /מחוצה לה/);
  assert.match(p, /קטגוריות ספקים|ספקי תשתית/);
  assert.match(p, /עיון|תיקון/);
  assert.match(files.privacy, /privacyRequestForm/);
  assert.match(read('assets/request-forms.js'), /\/api\/privacy-request/);
  assert.match(p, /שינוי מהותי/);
  assert.match(files.server, /sendTermsUpdateNoticeForUser/);
  assert.match(p, /אין.*חנות פיזית|אונליין בלבד/);
});

test('C9/C17/C8/D14: IP is not persisted as user field, roles/blocking exist, admin session is shorter', () => {
  assert.doesNotMatch(files.db, /users[\s\S]{0,800}\bip_address\b/i);
  assert.match(files.db, /\brole\b/);
  assert.match(files.db, /is_blocked/);
  assert.match(files.server, /ADMIN_SESSION_TTL_MS\s*=\s*8\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(files.server, /account_blocked/);
  assert.match(files.policies, /הזמנות ששולמו|זכויות.*הזמנה/);
});

test('C32/C33/C34/C35/C36/C37: review media consents, content rules and verified-review privacy are separated', () => {
  assert.match(files.reviews, /mediaRightsConfirmed/);
  assert.match(files.reviews, /mediaAdConsent/);
  assert.match(files.server, /media\.length && !mediaRightsConfirmed/);
  assert.match(files.policies, /אופציונלית.*נפרדת|נפרדת.*אופציונלית/);
  assert.match(files.policies, /קטין.*הורה|אפוטרופוס/);
  assert.match(files.policies, /בלתי חוקי|פוגעני/);
  assert.match(files.policies, /ביקורת שלילית אינה נמחקת/);
  assert.match(files.policies, /לקוח מאומת/);
  assert.doesNotMatch(files.reviews, /reviewer.*email|reviewer.*phone/i);
});

test('C33/C34/C35: personalized-photo products require rights confirmation in UI and server pricing', () => {
  assert.match(files.product, /customPhotoRightsConsent/);
  assert.match(files.productJs, /customPhotoRightsConfirmed/);
  assert.match(read('api/_hyp.js'), /custom_photo_rights_required/);
  const product = PRODUCTS.find((p) => p.customPhoto && p.customPhoto.required && p.necklaces?.length && p.sizes?.length && p.colors?.length);
  assert.ok(product);
  const base = { id: product.id, qty: 1, necklace: product.necklaces[0].id, size: product.sizes[0].id, color: product.colors[0].id, customPhoto: { assetId: 'asset-test', fileName: 'photo.jpg' } };
  assert.throws(() => priceOrder([base], 'he'), (err) => err && err.code === 'custom_photo_rights_required');
  assert.doesNotThrow(() => priceOrder([{...base, customPhotoRightsConfirmed:true}], 'he'));
});

test('D1: rebuilt policy contains all required major sections', () => {
  for (const id of ['purchase','shipping','cancel','defects','privacy','reviews','ip','law','service']) {
    assert.match(files.policies, new RegExp(`id="${id}"`));
  }
  assert.match(files.policies, /Cookies|עוגיות/);
  assert.match(files.policies, /מוצר.*אישי|מותאם אישית/);
});

test('D15/D16/C31: account security, service-first dispute process and non-retroactivity are documented', () => {
  assert.match(files.policies, /סיסמה|פרטי החשבון/);
  assert.match(files.policies, /חשד.*שימוש לא מורשה|גישה לא מורשית/);
  assert.match(files.policies, /לפנות.*שירות|שירות הלקוחות.*מחלוקת/);
  assert.match(files.policies, /אינם מוחלים רטרואקטיבית/);
});

test('D18: technical accessibility audit file exists and main interactive controls have labels', () => {
  const auditPath = path.join(ROOT,'docs','accessibility-audit-2026-09-26.md');
  assert.ok(fs.existsSync(auditPath));
  assert.match(read('docs/accessibility-audit-2026-09-26.md'), /alt|aria|keyboard|מקלדת/i);
  assert.match(files.index, /aria-label=/);
  assert.match(files.product, /aria-label=/);
});

test('D22/D23: regression guard rejects old phone, FAQ, 30-day marketing, tracking IDs, placeholders and compareAt', () => {
  const customer = customerFacingText();
  assert.doesNotMatch(customer, /054[- ]?629[- ]?6037|972546296037/);
  assert.doesNotMatch(files.index, /id=["']faq|\/#faq|שאלות נפוצות/);
  assert.doesNotMatch(customer, /30 יום להחזרה|אחריות 30 יום|30-day returns/i);
  assert.doesNotMatch(files.tracking, /trackingNumber|trackingId|tracking_id/);
  assert.doesNotMatch([files.index,files.product,files.register,files.account].join('\n'), /שם העסק בע["״']?מ|000000000/);
  assert.doesNotMatch(files.products, /compareAt/);
});

test('C7: password reset deletes active sessions', () => {
  assert.match(files.db, /resetPasswordWithToken[\s\S]*?DELETE FROM sessions WHERE user_id/);
});

test('E5: admin security has current hardening and a documented 2FA roadmap', () => {
  const roadmapPath = path.join(ROOT,'docs','admin-security-roadmap-2026-09-26.md');
  assert.ok(fs.existsSync(roadmapPath));
  const roadmap = read('docs/admin-security-roadmap-2026-09-26.md');
  assert.match(roadmap, /2FA|Two-factor/i);
  assert.match(roadmap, /future|עתיד|not enabled/i);
  assert.match(files.server, /ADMIN_SESSION_TTL_MS\s*=\s*8\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(files.server, /\['admin','staff'\]/);
});
