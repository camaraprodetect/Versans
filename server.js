'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { createDatabase } = require('./lib/database.js');
const { createPaymentUrl, verifyPayment, priceOrder } = require('./api/_hyp.js');
const { PRODUCTS } = require('./assets/products.js');
const ROUTES = require('./assets/routes.js');
const { normalizeAdminRange, normalizeStoredOrderItems, aggregatePaidOrders } = require('./lib/admin-analytics.js');
const { absoluteUrl, isEmailConfigured, orderConfirmationEmail, productAnnouncementEmail, sendEmail, welcomeEmail } = require('./lib/email.js');
const { buildPaidOrderPayload, sendPaidOrderToGoogleSheet } = require('./lib/google-orders.js');

const ROOT = __dirname;
const DATA_DIR = process.env.VERSANS_DATA_DIR
  ? path.resolve(process.env.VERSANS_DATA_DIR)
  : path.join(ROOT, 'data');
const DB_PATH = process.env.VERSANS_DB_PATH
  ? path.resolve(process.env.VERSANS_DB_PATH)
  : path.join(DATA_DIR, 'versans.sqlite');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_COOKIE = 'versans_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const VISITOR_COOKIE = 'versans_visitor';
const VISITOR_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const PRESENCE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const ONLINE_WINDOW_MS = 75 * 1000;
const ADMIN_EMAIL = 'camaraprodetect@gmail.com';
const USER_PURGE_META_KEY = 'purge_users_except_camaraprodetect_20260922_v1';
const ADMIN_PAGES = new Set(['', 'dashboard', 'visitors', 'sales', 'orders', 'products', 'customers', 'traffic', 'reviews']);
const BODY_LIMIT = 48 * 1024 * 1024;
const REVIEW_IMAGE_LIMIT = 2 * 1024 * 1024;
const REVIEW_VIDEO_LIMIT = 20 * 1024 * 1024;
const REVIEW_MEDIA_TOTAL_LIMIT = 30 * 1024 * 1024;
const REVIEW_MEDIA_MAX_COUNT = 5;
const REVIEW_TEXT_MAX = 1200;
const PUBLIC_REVIEW_NAME = 'לקוח VerSans';
const TERMS_VERSION = '2026-09-22';
const MARKETING_CATALOG_META_KEY = 'marketing_catalog_initialized_v1';
const MARKETING_DELIVERY_STALE_MS = 15 * 60 * 1000;
const WELCOME_COUPON_PERCENT = 3;
const WELCOME_COUPON_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PRODUCT_BY_URL_SLUG = new Map(PRODUCTS.map((product) => [String(product.urlSlug || ''), product]));

const database = createDatabase({ root: ROOT, sqlitePath: DB_PATH });

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function redirect(res, location, status = 301) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', status === 301 ? 'public, max-age=3600' : 'no-store');
  res.end();
}

function productPublicPath(product) {
  return ROUTES.productPath(product);
}

function productByUrlSlug(slug) {
  return PRODUCT_BY_URL_SLUG.get(String(slug || '')) || null;
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function verifyPassword(password, encoded) {
  try {
    const parts = String(encoded || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_) {
    return false;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function normalizePhone(value) {
  let phone = String(value || '').trim().replace(/[\s().-]+/g, '');
  if (!phone) return '';
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^0\d{8,9}$/.test(phone)) phone = '+972' + phone.slice(1);
  else if (/^972\d{8,9}$/.test(phone)) phone = '+' + phone;
  if (!/^\+\d{9,15}$/.test(phone)) return '';
  return phone;
}


function cleanCheckoutText(value, max = 120) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function normalizeShippingCustomer(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const customer = {
    firstName: cleanCheckoutText(source.firstName, 50),
    lastName: cleanCheckoutText(source.lastName, 50),
    email: normalizeEmail(source.email),
    phone: normalizePhone(source.phone),
    country: cleanCheckoutText(source.country, 60),
    city: cleanCheckoutText(source.city, 80),
    street: cleanCheckoutText(source.street, 100),
    houseNumber: cleanCheckoutText(source.houseNumber, 20),
    apartment: cleanCheckoutText(source.apartment, 20),
    entrance: cleanCheckoutText(source.entrance, 20),
    floor: cleanCheckoutText(source.floor, 20),
    zip: cleanCheckoutText(source.zip, 20),
    notes: cleanCheckoutText(source.notes, 500)
  };
  const required = ['firstName','lastName','email','phone','country','city','street','houseNumber','zip'];
  if (required.some((key) => !customer[key]) || !validEmail(customer.email)) {
    const err = new Error('missing_shipping_details');
    err.status = 400;
    throw err;
  }
  return customer;
}

function amountToAgorot(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function checkoutMode() {
  const raw = String(process.env.VERSANS_CHECKOUT_MODE || '')
    .trim()
    .toLowerCase()
    .replace(/^[\"']|[\"']$/g, '');
  return raw === 'live' ? 'live' : 'demo';
}

function newDemoOrderRef() {
  return 'VS-DEMO-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function createDemoPaymentResult(body, options = {}) {
  const lang = body && body.lang === 'en' ? 'en' : 'he';
  const priced = priceOrder(body && Array.isArray(body.items) ? body.items : [], lang, options.coupon || null);
  const orderRef = newDemoOrderRef();
  const params = new URLSearchParams({
    Order: orderRef,
    Amount: priced.total.toFixed(2),
    CCode: '0',
    versans_demo: '1'
  });

  return {
    url: '/thank-you?' + params.toString(),
    order: orderRef,
    total: priced.total,
    couponDiscount: priced.couponDiscount || 0,
    couponCode: priced.couponCode || '',
    currency: 'ILS',
    demo: true
  };
}

function normalizeCouponCode(value) {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 40);
}

function newWelcomeCouponCode() {
  return 'VS3-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

async function createWelcomeCoupon(store, userId, createdAt) {
  const existing = await store.getWelcomeCouponForUser(userId);
  if (existing) return existing;
  const now = Number(createdAt) || Date.now();
  const code = newWelcomeCouponCode();
  const expiresAt = now + WELCOME_COUPON_TTL_MS;
  const id = await store.insertCoupon({
    code,
    userId,
    kind: 'welcome',
    discountPercent: WELCOME_COUPON_PERCENT,
    createdAt: now,
    expiresAt
  });
  return { id, code, user_id: userId, kind: 'welcome', discount_percent: WELCOME_COUPON_PERCENT, active: 1, created_at: now, expires_at: expiresAt, used_at: null, used_order_ref: null };
}

function couponStatus(coupon, now = Date.now()) {
  if (!coupon || Number(coupon.active || 0) !== 1) return 'invalid_coupon';
  if (coupon.used_at) return 'coupon_used';
  if (!coupon.expires_at || Number(coupon.expires_at) <= Number(now)) return 'coupon_expired';
  return 'ok';
}


function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanReviewText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function currentIsraelDateValue() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = {};
  parts.forEach((part) => { if (part.type !== 'literal') values[part.type] = part.value; });
  return `${values.year}-${values.month}-${values.day}`;
}

function parseReviewDate(value, allowFuture = false) {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day, 12, 0, 0);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (!allowFuture && text > currentIsraelDateValue()) return null;
  return timestamp;
}

function parseReviewMediaItem(value) {
  const item = typeof value === 'string' ? { dataUrl: value } : (value || {});
  const dataUrl = String(item.dataUrl || '');
  const match = /^data:(image\/(?:png|jpeg|webp)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    const err = new Error('invalid_media');
    err.status = 400;
    throw err;
  }

  const mime = match[1].toLowerCase();
  const kind = mime.startsWith('video/') ? 'video' : 'image';
  let buffer;
  try { buffer = Buffer.from(match[2], 'base64'); }
  catch (_) { buffer = Buffer.alloc(0); }

  const perItemLimit = kind === 'video' ? REVIEW_VIDEO_LIMIT : REVIEW_IMAGE_LIMIT;
  if (!buffer.length || buffer.length > perItemLimit) {
    const err = new Error(buffer.length > perItemLimit ? (kind === 'video' ? 'video_too_large' : 'image_too_large') : 'invalid_media');
    err.status = 400;
    throw err;
  }

  if (kind === 'image') {
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if ((mime === 'image/png' && !isPng) || (mime === 'image/jpeg' && !isJpeg) || (mime === 'image/webp' && !isWebp)) {
      const err = new Error('invalid_media');
      err.status = 400;
      throw err;
    }
  } else {
    const isMp4 = buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
    const isWebm = buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    if ((mime === 'video/mp4' && !isMp4) || (mime === 'video/webm' && !isWebm)) {
      const err = new Error('invalid_media');
      err.status = 400;
      throw err;
    }
  }

  return { buffer, mime, kind };
}

function parseReviewMedia(value) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  if (items.length > REVIEW_MEDIA_MAX_COUNT) {
    const err = new Error('too_many_media');
    err.status = 400;
    throw err;
  }
  const media = items.filter(Boolean).map(parseReviewMediaItem);
  const total = media.reduce((sum, entry) => sum + (entry.buffer ? entry.buffer.length : 0), 0);
  if (total > REVIEW_MEDIA_TOTAL_LIMIT) {
    const err = new Error('media_too_large');
    err.status = 400;
    throw err;
  }
  return media.filter((entry) => entry.buffer && entry.mime);
}

function productById(id) {
  return PRODUCTS.find((product) => String(product.id) === String(id)) || null;
}

function productTitle(product) {
  if (!product) return 'המוצר שנרכש';
  if (product.id === 'mom-heart-01') return 'שרשרת לאמא עם ברכה והקדשה מרגשת';
  return (product.title && (product.title.he || product.title.en)) || 'המוצר שנרכש';
}

function reviewProductPayload(productId, variant, seed) {
  const product = productById(productId) || productById('mom-heart-01');
  const safeId = product ? product.id : 'mom-heart-01';
  const normalizedVariant = /^necklace-[1-5]$/.test(String(variant || '')) ? String(variant) : null;
  let imageUrl = product && Array.isArray(product.images) && product.images[0] ? '/' + product.images[0] : '/images/review-products/necklace-1.png';
  let variantLabel = '';

  if (safeId === 'mom-heart-01') {
    const fallbackIndex = ((Math.max(1, Number(seed || 1)) - 1) % 5) + 1;
    const index = normalizedVariant ? Number(normalizedVariant.split('-')[1]) : fallbackIndex;
    imageUrl = `/images/review-products/necklace-${index}.png`;
    variantLabel = normalizedVariant ? `דגם ${index}` : '';
  }

  return {
    id: safeId,
    variant: normalizedVariant,
    title: productTitle(product),
    variantLabel,
    imageUrl,
    href: product ? productPublicPath(product) : '/'
  };
}

async function purchasedProductForUser(userId) {
  const order = await database.latestPaidOrderForUser(userId);
  if (!order || !order.items_json) return null;
  let items;
  try { items = JSON.parse(order.items_json); } catch (_) { return null; }
  if (!Array.isArray(items) || !items.length) return null;
  const preferred = items.find((item) => item && item.id === 'mom-heart-01') || items[0];
  if (!preferred || !preferred.id) return null;
  const product = productById(preferred.id);
  if (!product) return null;
  return {
    id: product.id,
    variant: product.id === 'mom-heart-01' && /^necklace-[1-5]$/.test(String(preferred.necklace || ''))
      ? String(preferred.necklace)
      : null
  };
}

async function publicReview(row) {
  const cacheVersion = Number(row.updated_at || row.created_at || 0);
  const meta = (await database.listReviewMediaMeta(row.id)).slice(0, REVIEW_MEDIA_MAX_COUNT);
  const media = meta.map((entry, index) => ({
    kind: entry.media_kind === 'video' || String(entry.image_mime || '').startsWith('video/') ? 'video' : 'image',
    mime: entry.image_mime || null,
    url: `/api/reviews/${row.id}/media/${index}?v=${cacheVersion}`
  }));
  const imageUrls = media.filter((entry) => entry.kind === 'image').map((entry) => entry.url);
  return {
    id: row.id,
    name: PUBLIC_REVIEW_NAME,
    verified: Number(row.verified_purchase || 0) === 1,
    rating: row.rating,
    text: row.body,
    createdAt: row.review_date || row.created_at,
    media,
    mediaCount: media.length,
    imageUrls,
    imageUrl: imageUrls[0] || null,
    product: reviewProductPayload(row.review_product_id, row.review_product_variant, row.id)
  };
}

function sessionCookie(token, req) {
  const secure = process.env.NODE_ENV === 'production' || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(req) {
  const secure = process.env.NODE_ENV === 'production' || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

function getSessionToken(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || '';
}

async function getCurrentUser(req) {
  const token = getSessionToken(req);
  if (!token || token.length < 20) return null;
  return await database.findPublicUserBySession(tokenHash(token), Date.now()) || null;
}

async function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await database.insertSession(userId, tokenHash(token), now, now + SESSION_TTL_MS);
  return sessionCookie(token, req);
}

function safeUser(user) {
  return user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    isVerifiedCustomer: Number(user.is_verified_customer || 0) === 1,
    verifiedCustomerAt: user.verified_customer_at || null,
    marketingOptIn: Number(user.marketing_opt_in || 0) === 1,
    createdAt: user.created_at
  } : null;
}

function marketingUnsubscribeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function productMarketingTitle(product) {
  if (!product) return 'מוצר חדש';
  return String((product.title && product.title.he) || (product.cardTitle && product.cardTitle.he) || product.slug || 'מוצר חדש');
}

function productMarketingImage(product) {
  if (!product) return '';
  const collectionMedia = Array.isArray(product.collectionMedia) ? product.collectionMedia : [];
  const images = Array.isArray(product.images) ? product.images : [];
  return String(product.cardImage || collectionMedia[0] || images[0] || product.hoverImage || '');
}

async function sendWelcomeForUser(user) {
  if (!user || !user.id || !validEmail(user.email) || !isEmailConfigured()) return false;
  const coupon = await createWelcomeCoupon(database, user.id, user.created_at || Date.now());
  const message = welcomeEmail({
    name: user.name,
    couponCode: coupon && coupon.code,
    couponExpiresAt: coupon && coupon.expires_at,
    couponPercent: coupon && coupon.discount_percent
  });
  const result = await sendEmail({
    to: user.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `welcome-user-${user.id}`
  });
  await database.markWelcomeEmailSent(user.id, Date.now());
  return result;
}


async function sendOrderConfirmationForOrder(order) {
  if (!order || !isEmailConfigured()) return false;
  const payload = buildPaidOrderPayload(order);
  const to = normalizeEmail(payload.customerEmail || (payload.customer && payload.customer.email));
  if (!validEmail(to)) return false;
  const message = orderConfirmationEmail(payload);
  return sendEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `order-confirmation-${payload.orderRef}`
  });
}

async function processPendingWelcomeEmails() {
  if (!isEmailConfigured()) return;
  const rows = await database.listUsersNeedingWelcomeEmail(50);
  for (const user of rows) {
    try {
      await sendWelcomeForUser(user);
    } catch (err) {
      console.error(`Welcome email failed for user ${user.id}:`, err && err.message ? err.message : err);
    }
  }
}

function marketingProductSummaries() {
  return PRODUCTS.map((product) => ({ slug: String(product.slug || ''), title: productMarketingTitle(product) })).filter((item) => item.slug);
}

async function sendProductAnnouncementToSubscriber(user, product) {
  const token = String(user.marketing_unsubscribe_token || '').trim();
  if (!token) throw new Error('marketing_unsubscribe_token_missing');
  const productUrl = absoluteUrl(productPublicPath(product));
  const imagePath = productMarketingImage(product);
  const imageUrl = imagePath ? absoluteUrl(imagePath) : '';
  const unsubscribeUrl = absoluteUrl(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
  const message = productAnnouncementEmail({
    name: user.name,
    productTitle: productMarketingTitle(product),
    productUrl,
    imageUrl,
    unsubscribeUrl
  });
  return sendEmail({
    to: user.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `new-product-${product.slug}-user-${user.id}`,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  });
}

async function syncMarketingCatalog() {
  const now = Date.now();
  const summaries = marketingProductSummaries();
  const initialized = await database.getSchemaMeta(MARKETING_CATALOG_META_KEY);
  if (!initialized) {
    await database.baselineMarketingAnnouncements(summaries, now);
    await database.setSchemaMeta(MARKETING_CATALOG_META_KEY, String(now));
    console.log(`Marketing catalog baseline created with ${summaries.length} products.`);
    return;
  }

  for (const product of summaries) await database.ensureMarketingAnnouncement(product, now);
  const pending = await database.listPendingMarketingAnnouncements();
  if (!pending.length) return;
  if (!isEmailConfigured()) {
    console.warn(`Marketing emails pending (${pending.length}) but RESEND_API_KEY/EMAIL_FROM are not configured.`);
    return;
  }

  const productMap = new Map(PRODUCTS.map((product) => [String(product.slug || ''), product]));
  for (const announcement of pending) {
    const product = productMap.get(String(announcement.product_slug || ''));
    if (!product) {
      await database.completeMarketingAnnouncement(announcement.product_slug, Date.now());
      continue;
    }
    const subscribers = await database.listMarketingSubscribers();
    for (const user of subscribers) {
      const claimed = await database.claimMarketingDelivery(announcement.product_slug, user.id, Date.now(), Date.now() - MARKETING_DELIVERY_STALE_MS);
      if (!claimed) continue;
      try {
        const sent = await sendProductAnnouncementToSubscriber(user, product);
        await database.markMarketingDeliverySent(announcement.product_slug, user.id, Date.now(), sent && sent.id ? String(sent.id) : null);
      } catch (err) {
        await database.markMarketingDeliveryFailed(announcement.product_slug, user.id, Date.now(), err && err.message ? err.message : String(err));
        console.error(`Marketing email failed for ${announcement.product_slug} -> user ${user.id}:`, err && err.message ? err.message : err);
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    const failures = await database.marketingDeliveryFailures(announcement.product_slug);
    if (failures === 0) await database.completeMarketingAnnouncement(announcement.product_slug, Date.now());
  }
}

async function marketingUnsubscribePage(req, res, pathname, parsed) {
  if (pathname !== '/email/unsubscribe') return false;
  if (req.method !== 'GET' && req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method_not_allowed' });
    return true;
  }
  const token = String(parsed.searchParams.get('token') || '').trim();
  const validToken = /^[A-Za-z0-9_-]{20,100}$/.test(token);
  const changed = validToken ? await database.unsubscribeMarketingByToken(token, Date.now()) : false;
  const title = changed ? 'הוסרת מרשימת הדיוור' : 'העדפת הדיוור עודכנה';
  const copy = changed ? 'לא תקבלו יותר אימיילים שיווקיים מ-VerSans.' : 'הקישור כבר טופל או שאינו פעיל. לא נשלחו שינויים נוספים.';
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VerSans</title></head><body style="margin:0;background:#f4f2ef;font-family:Arial,Helvetica,sans-serif;color:#142333;"><main style="max-width:560px;margin:10vh auto;padding:20px;"><section style="background:#fff;border:1px solid #e5dfd8;border-radius:18px;padding:42px;text-align:center;box-shadow:0 12px 36px rgba(20,35,51,.08);"><div style="font-size:12px;letter-spacing:2.4px;color:#9a7440;font-weight:700;">VERSANS</div><h1 style="font-size:30px;margin:14px 0 10px;">${title}</h1><p style="color:#5d6870;line-height:1.8;">${copy}</p><a href="https://versans.com/" style="display:inline-block;margin-top:18px;padding:12px 24px;border-radius:9px;background:#142333;color:#fff;text-decoration:none;font-weight:700;">חזרה לחנות</a></section></main></body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  res.end(html);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        const err = new Error('Request body too large');
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        const err = new Error('Invalid JSON');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sameOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const expectedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const u = new URL(origin);
    return u.host === expectedHost;
  } catch (_) {
    return false;
  }
}


function compactText(value, max = 160) {
  const text = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function safePresencePath(value) {
  const text = String(value || '/').trim();
  try {
    const parsed = new URL(text, 'https://versans.local');
    const pathname = parsed.pathname || '/';
    return pathname.startsWith('/') ? pathname.slice(0, 320) : '/';
  } catch (_) {
    return '/';
  }
}

function safePresenceReferrer(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.slice(0, 500);
  } catch (_) {
    return null;
  }
}

function safePresenceDimension(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(10000, Math.round(number)));
}

function getVisitorId(req) {
  const id = parseCookies(req.headers.cookie)[VISITOR_COOKIE] || '';
  return /^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(id) ? id : '';
}

function visitorCookie(visitorId, req) {
  const secure = process.env.NODE_ENV === 'production' || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `${VISITOR_COOKIE}=${encodeURIComponent(visitorId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(VISITOR_TTL_MS / 1000)}${secure ? '; Secure' : ''}`;
}

function timeZoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const out = {};
  for (const part of parts) if (part.type !== 'literal') out[part.type] = Number(part.value);
  return out;
}

function timeZoneOffsetMs(date, timeZone) {
  const p = timeZoneParts(date, timeZone);
  const representedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function israelStartOfDayMs(now) {
  const timeZone = 'Asia/Jerusalem';
  const p = timeZoneParts(new Date(now), timeZone);
  const localMidnightAsUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  let guess = localMidnightAsUtc - timeZoneOffsetMs(new Date(localMidnightAsUtc), timeZone);
  guess = localMidnightAsUtc - timeZoneOffsetMs(new Date(guess), timeZone);
  return guess;
}

function adminRangeStart(range, now) {
  if (range === 'online') return now - ONLINE_WINDOW_MS;
  if (range === 'today') return israelStartOfDayMs(now);
  if (range === '3d') return now - 3 * 24 * 60 * 60 * 1000;
  if (range === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  if (range === '30d') return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

function presencePayload(body, visitorId, userId, now) {
  const kind = body && body.kind === 'pageview' ? 'pageview' : 'heartbeat';
  return {
    visitorId,
    userId: userId == null ? null : Number(userId),
    kind,
    now,
    path: safePresencePath(body && body.path),
    title: compactText(body && body.title, 180),
    referrer: safePresenceReferrer(body && body.referrer),
    utmSource: compactText(body && body.utmSource, 120),
    utmMedium: compactText(body && body.utmMedium, 120),
    utmCampaign: compactText(body && body.utmCampaign, 160),
    utmTerm: compactText(body && body.utmTerm, 160),
    utmContent: compactText(body && body.utmContent, 160),
    language: compactText(body && body.language, 32),
    browser: compactText(body && body.browser, 64),
    os: compactText(body && body.os, 64),
    deviceType: compactText(body && body.deviceType, 24),
    screenWidth: safePresenceDimension(body && body.screenWidth),
    screenHeight: safePresenceDimension(body && body.screenHeight),
    viewportWidth: safePresenceDimension(body && body.viewportWidth),
    viewportHeight: safePresenceDimension(body && body.viewportHeight)
  };
}

function visitorSummary(row, now) {
  const visitorId = String(row.visitor_id || '');
  const guestName = `Guest #${visitorId.replace(/-/g, '').slice(-6).toUpperCase() || 'UNKNOWN'}`;
  return {
    visitorId,
    userId: row.user_id == null ? null : Number(row.user_id),
    name: row.name || guestName,
    email: row.email || null,
    phone: row.known_phone || null,
    isLoggedIn: Number(row.is_authenticated || 0) === 1,
    isVerifiedCustomer: Number(row.is_verified_customer || 0) === 1,
    firstSeen: Number(row.first_seen || 0),
    lastSeen: Number(row.last_seen || 0),
    online: Number(row.last_seen || 0) >= now - ONLINE_WINDOW_MS,
    currentPath: row.current_path || '/',
    entryPath: row.entry_path || '/',
    lastTitle: row.last_title || null,
    referrer: row.referrer || null,
    utm: {
      source: row.utm_source || null,
      medium: row.utm_medium || null,
      campaign: row.utm_campaign || null,
      term: row.utm_term || null,
      content: row.utm_content || null
    },
    language: row.language || null,
    browser: row.browser || null,
    os: row.os || null,
    deviceType: row.device_type || null,
    screen: { width: row.screen_width == null ? null : Number(row.screen_width), height: row.screen_height == null ? null : Number(row.screen_height) },
    viewport: { width: row.viewport_width == null ? null : Number(row.viewport_width), height: row.viewport_height == null ? null : Number(row.viewport_height) },
    pageViewCount: Number(row.page_view_count || 0)
  };
}

async function getAdminUser(req) {
  const user = await getCurrentUser(req);
  return user && normalizeEmail(user.email) === ADMIN_EMAIL ? user : null;
}

async function presenceApi(req, res, pathname) {
  if (pathname !== '/api/presence') return false;
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method_not_allowed' });
    return true;
  }
  if (!sameOriginAllowed(req)) {
    json(res, 403, { ok: false, error: 'forbidden_origin' });
    return true;
  }
  const body = await readJsonBody(req);
  const existingVisitorId = getVisitorId(req);
  const visitorId = existingVisitorId || crypto.randomUUID();
  const currentUser = await getCurrentUser(req);
  const now = Date.now();
  await database.recordPresence(presencePayload(body, visitorId, currentUser ? currentUser.id : null, now));
  const headers = existingVisitorId ? {} : { 'Set-Cookie': visitorCookie(visitorId, req) };
  json(res, 200, { ok: true, onlineWindowMs: ONLINE_WINDOW_MS }, headers);
  return true;
}

function adminPagination(parsed, defaultLimit = 50) {
  const rawLimit = Number(parsed.searchParams.get('limit') || defaultLimit);
  const rawOffset = Number(parsed.searchParams.get('offset') || 0);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0;
  return { limit, offset };
}

function adminProductInfo(id) {
  const product = productById(id);
  return {
    id: String(id || ''),
    name: product ? productTitle(product) : String(id || 'מוצר'),
    image: product && Array.isArray(product.images) && product.images[0] ? '/' + product.images[0] : null,
    href: product ? productPublicPath(product) : null
  };
}

function adminOrderPayload(row) {
  const items = normalizeStoredOrderItems(row.items_json, PRODUCTS);
  return {
    id: Number(row.id),
    orderRef: row.order_ref,
    userId: row.user_id == null ? null : Number(row.user_id),
    customerName: row.user_name || null,
    customerEmail: row.customer_email || row.user_email || null,
    customerPhone: row.customer_phone || null,
    amountAgorot: Number(row.amount_agorot || 0),
    currency: row.currency || 'ILS',
    status: row.status,
    createdAt: Number(row.created_at || 0),
    paidAt: row.paid_at == null ? null : Number(row.paid_at),
    updatedAt: Number(row.updated_at || 0),
    units: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      reconstructed: item.reconstructed
    }))
  };
}

function adminReviewPayload(row) {
  const info = adminProductInfo(row.review_product_id);
  return {
    id: Number(row.id),
    userId: row.user_id == null ? null : Number(row.user_id),
    name: row.review_name || row.user_name || PUBLIC_REVIEW_NAME,
    email: row.user_email || null,
    productId: row.review_product_id || null,
    productName: info.name,
    productImage: info.image,
    productHref: info.href,
    variant: row.review_product_variant || null,
    rating: Number(row.rating || 0),
    body: row.body || '',
    verifiedPurchase: Number(row.verified_purchase || 0) === 1,
    reviewDate: Number(row.review_date || row.created_at || 0)
  };
}

function visitorRange(range, now) {
  if (range === 'all') return { range, since: null };
  const since = adminRangeStart(range, now);
  return since == null ? null : { range, since };
}

async function adminSalesData(range, now = Date.now()) {
  const normalized = normalizeAdminRange(range, now);
  if (!normalized) return null;
  const rows = await database.listOrdersForAnalytics('paid', normalized.since);
  return aggregatePaidOrders(rows, PRODUCTS, now, normalized.range);
}

async function adminApi(req, res, pathname, parsed) {
  if (!pathname.startsWith('/api/admin/')) return false;
  const admin = await getAdminUser(req);
  if (!admin) {
    json(res, 403, { ok: false, error: 'admin_required' });
    return true;
  }
  if (req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'method_not_allowed' });
    return true;
  }

  if (pathname === '/api/admin/overview') {
    const now = Date.now();
    const range = String(parsed.searchParams.get('range') || '30d');
    const sales = await adminSalesData(range, now);
    if (!sales) { json(res, 400, { ok: false, error: 'invalid_range' }); return true; }
    const [onlineVisitors, todayVisitors, lifetimeVisitors, userCounts, recentRows] = await Promise.all([
      database.countPresenceVisitors(now - ONLINE_WINDOW_MS),
      database.countPresenceVisitors(israelStartOfDayMs(now)),
      database.countPresenceVisitors(null),
      database.adminUserCounts(),
      database.listAdminOrders({ status: 'paid', since: null, limit: 8, offset: 0 })
    ]);
    json(res, 200, {
      ok: true,
      ...sales,
      visitors: { online: onlineVisitors, today: todayVisitors, lifetime: lifetimeVisitors },
      users: userCounts,
      topProducts: sales.products.slice(0, 5),
      recentOrders: recentRows.map(adminOrderPayload)
    });
    return true;
  }

  if (pathname === '/api/admin/sales') {
    const range = String(parsed.searchParams.get('range') || '30d');
    const sales = await adminSalesData(range);
    if (!sales) { json(res, 400, { ok: false, error: 'invalid_range' }); return true; }
    const normalized = normalizeAdminRange(range);
    const recentRows = await database.listAdminOrders({ status: 'paid', since: normalized.since, limit: 12, offset: 0 });
    json(res, 200, { ok: true, ...sales, topProducts: sales.products.slice(0, 50), recentOrders: recentRows.map(adminOrderPayload) });
    return true;
  }

  if (pathname === '/api/admin/orders') {
    const status = String(parsed.searchParams.get('status') || 'paid');
    if (!['paid', 'pending', 'failed', 'all'].includes(status)) { json(res, 400, { ok: false, error: 'invalid_status' }); return true; }
    const range = String(parsed.searchParams.get('range') || '30d');
    const normalized = normalizeAdminRange(range);
    if (!normalized) { json(res, 400, { ok: false, error: 'invalid_range' }); return true; }
    const { limit, offset } = adminPagination(parsed, 50);
    const [count, rows] = await Promise.all([
      database.countAdminOrders({ status, since: normalized.since }),
      database.listAdminOrders({ status, since: normalized.since, limit, offset })
    ]);
    json(res, 200, { ok: true, status, range, count, limit, offset, hasMore: offset + rows.length < count, orders: rows.map(adminOrderPayload) });
    return true;
  }

  if (pathname === '/api/admin/products') {
    const range = String(parsed.searchParams.get('range') || '30d');
    const sales = await adminSalesData(range);
    if (!sales) { json(res, 400, { ok: false, error: 'invalid_range' }); return true; }
    const { limit, offset } = adminPagination(parsed, 50);
    const products = sales.products.slice(offset, offset + limit);
    json(res, 200, { ok: true, range, count: sales.products.length, limit, offset, hasMore: offset + products.length < sales.products.length, products });
    return true;
  }

  if (pathname === '/api/admin/customers') {
    const { limit, offset } = adminPagination(parsed, 50);
    const [count, rows] = await Promise.all([database.countAdminCustomers(), database.listAdminCustomers(limit, offset)]);
    const customers = rows.map((row) => ({
      id: Number(row.id), name: row.name, email: row.email, phone: row.known_phone || null,
      marketingOptIn: Number(row.marketing_opt_in || 0) === 1,
      verifiedCustomer: Number(row.is_verified_customer || 0) === 1,
      verifiedCustomerAt: row.verified_customer_at == null ? null : Number(row.verified_customer_at),
      createdAt: Number(row.created_at || 0), paidOrderCount: Number(row.paid_order_count || 0),
      paidSpendAgorot: Number(row.paid_spend_agorot || 0), lastPaidAt: row.last_paid_at == null ? null : Number(row.last_paid_at)
    }));
    json(res, 200, { ok: true, count, limit, offset, hasMore: offset + customers.length < count, customers });
    return true;
  }

  if (pathname === '/api/admin/traffic') {
    const range = String(parsed.searchParams.get('range') || '30d');
    const normalized = normalizeAdminRange(range);
    if (!normalized) { json(res, 400, { ok: false, error: 'invalid_range' }); return true; }
    const data = await database.adminTrafficSummary(normalized.since);
    json(res, 200, { ok: true, range, ...data });
    return true;
  }

  if (pathname === '/api/admin/reviews') {
    const range = String(parsed.searchParams.get('range') || '30d');
    const normalized = normalizeAdminRange(range);
    if (!normalized) { json(res, 400, { ok: false, error: 'invalid_range' }); return true; }
    const { limit } = adminPagination(parsed, 20);
    const data = await database.adminReviewSummary(normalized.since, limit);
    const summary = data.summary || {};
    const topProducts = data.topProducts.map((row) => ({ ...adminProductInfo(row.product_id), count: Number(row.count || 0), average: Number(row.average || 0) }));
    json(res, 200, {
      ok: true, range,
      summary: {
        count: Number(summary.count || 0), average: Number(summary.average || 0),
        rating5: Number(summary.rating_5 || 0), rating4: Number(summary.rating_4 || 0), rating3: Number(summary.rating_3 || 0),
        rating2: Number(summary.rating_2 || 0), rating1: Number(summary.rating_1 || 0)
      },
      topProducts,
      recent: data.recent.map(adminReviewPayload)
    });
    return true;
  }

  if (pathname === '/api/admin/visitors') {
    const range = String(parsed.searchParams.get('range') || 'online');
    const now = Date.now();
    const normalized = visitorRange(range, now);
    if (!normalized) { json(res, 400, { ok: false, error: 'invalid_range' }); return true; }
    const { limit, offset } = adminPagination(parsed, 50);
    const [count, rows, lifetimeCount] = await Promise.all([
      database.countPresenceVisitors(normalized.since),
      database.listPresenceVisitors(normalized.since, limit, offset),
      database.countPresenceVisitors(null)
    ]);
    json(res, 200, {
      ok: true, range, count, lifetimeCount, limit, offset, hasMore: offset + rows.length < count,
      onlineWindowMs: ONLINE_WINDOW_MS, visitors: rows.map((row) => visitorSummary(row, now))
    });
    return true;
  }

  const detailMatch = /^\/api\/admin\/visitors\/([0-9a-f-]{8,64})$/i.exec(pathname);
  if (detailMatch) {
    const result = await database.getPresenceVisitor(detailMatch[1], 250);
    if (!result) { json(res, 404, { ok: false, error: 'visitor_not_found' }); return true; }
    const visitor = visitorSummary(result.visitor, Date.now());
    visitor.account = result.visitor.user_id == null ? null : {
      id: Number(result.visitor.user_id), name: result.visitor.name || null, email: result.visitor.email || null,
      phone: result.visitor.known_phone || null, createdAt: result.visitor.user_created_at == null ? null : Number(result.visitor.user_created_at),
      verifiedCustomer: Number(result.visitor.is_verified_customer || 0) === 1,
      verifiedCustomerAt: result.visitor.verified_customer_at == null ? null : Number(result.visitor.verified_customer_at),
      orderCount: Number(result.visitor.order_count || 0), paidOrderCount: Number(result.visitor.paid_order_count || 0),
      reviewCount: Number(result.visitor.review_count || 0), lastOrderAt: result.visitor.last_order_at == null ? null : Number(result.visitor.last_order_at),
      sessionCreatedAt: result.visitor.session_created_at == null ? null : Number(result.visitor.session_created_at),
      sessionExpiresAt: result.visitor.session_expires_at == null ? null : Number(result.visitor.session_expires_at)
    };
    const pageViews = result.pageViews.map((view) => ({
      id: Number(view.id), userId: view.user_id == null ? null : Number(view.user_id), path: view.path, title: view.title || null,
      referrer: view.referrer || null,
      utm: { source: view.utm_source || null, medium: view.utm_medium || null, campaign: view.utm_campaign || null, term: view.utm_term || null, content: view.utm_content || null },
      viewedAt: Number(view.viewed_at)
    }));
    json(res, 200, { ok: true, visitor, pageViews });
    return true;
  }

  json(res, 404, { ok: false, error: 'admin_route_not_found' });
  return true;
}

async function adminPage(req, res, pathname) {
  const isLegacy = pathname === '/admin.html';
  const slug = pathname === '/admin' ? '' : (pathname.startsWith('/admin/') ? pathname.slice('/admin/'.length) : null);
  if (!isLegacy && slug === null) return false;
  if (!isLegacy && !ADMIN_PAGES.has(slug)) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    redirect(res, '/login', 302);
    return true;
  }
  if (normalizeEmail(currentUser.email) !== ADMIN_EMAIL) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.end('403 - Admin access required');
    return true;
  }
  const filePath = path.join(ROOT, 'admin.html');
  let stat;
  try { stat = fs.statSync(filePath); } catch (_) {
    json(res, 500, { ok: false, error: 'admin_page_missing' });
    return true;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Length', stat.size);
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(filePath).pipe(res);
  return true;
}

const attempts = new Map();
function rateLimited(req, bucket, max = 10, windowMs = 10 * 60 * 1000) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket.remoteAddress || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const item = attempts.get(key);
  if (!item || item.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  item.count += 1;
  return item.count > max;
}

async function authApi(req, res, pathname) {
  if (!sameOriginAllowed(req)) {
    json(res, 403, { ok: false, error: 'origin_not_allowed' });
    return true;
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    json(res, 200, { ok: true, user: safeUser(await getCurrentUser(req)) });
    return true;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    if (rateLimited(req, 'register', 8)) {
      json(res, 429, { ok: false, error: 'too_many_attempts' });
      return true;
    }
    const body = await readJsonBody(req);
    const name = cleanName(body.name);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const password = String(body.password || '');
    const termsAccepted = body.termsAccepted === true;
    const marketingOptIn = body.marketingOptIn === true;

    if (name.length < 2 || name.length > 70) {
      json(res, 400, { ok: false, error: 'invalid_name' });
      return true;
    }
    if (!validEmail(email)) {
      json(res, 400, { ok: false, error: 'invalid_email' });
      return true;
    }
    if (!phone) {
      json(res, 400, { ok: false, error: 'invalid_phone' });
      return true;
    }
    if (!termsAccepted) {
      json(res, 400, { ok: false, error: 'terms_required' });
      return true;
    }
    if (password.length < 8 || password.length > 128) {
      json(res, 400, { ok: false, error: 'invalid_password' });
      return true;
    }
    if (await database.findUserByEmail(email)) {
      json(res, 409, { ok: false, error: 'email_exists' });
      return true;
    }

    const createdAt = Date.now();
    let userId;
    try {
      userId = await database.transaction(async (tx) => {
        const insertedUserId = await tx.insertUser(name, email, hashPassword(password), createdAt, phone, {
          termsAcceptedAt: createdAt,
          termsVersion: TERMS_VERSION,
          marketingOptIn,
          marketingOptInAt: marketingOptIn ? createdAt : null,
          marketingUnsubscribeToken: marketingUnsubscribeToken()
        });
        await createWelcomeCoupon(tx, insertedUserId, createdAt);
        return insertedUserId;
      });
    } catch (err) {
      if (err && (err.code === '23505' || String(err.message || '').toUpperCase().includes('UNIQUE'))) {
        json(res, 409, { ok: false, error: 'email_exists' });
        return true;
      }
      throw err;
    }

    const cookie = await createSession(userId, req);
    const user = await database.findUserByEmail(email);
    json(res, 201, { ok: true, user: safeUser(user) }, { 'Set-Cookie': cookie });
    setImmediate(() => {
      sendWelcomeForUser(user).catch((err) => console.error(`Welcome email failed for user ${userId}:`, err && err.message ? err.message : err));
    });
    return true;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    if (rateLimited(req, 'login', 12)) {
      json(res, 429, { ok: false, error: 'too_many_attempts' });
      return true;
    }
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const user = validEmail(email) ? await database.findUserByEmail(email) : null;

    if (!user || !verifyPassword(password, user.password_hash)) {
      json(res, 401, { ok: false, error: 'invalid_credentials' });
      return true;
    }

    const oldToken = getSessionToken(req);
    if (oldToken) await database.deleteSession(tokenHash(oldToken));
    const cookie = await createSession(user.id, req);
    json(res, 200, { ok: true, user: safeUser(user) }, { 'Set-Cookie': cookie });
    return true;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = getSessionToken(req);
    if (token) await database.deleteSession(tokenHash(token));
    json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
    return true;
  }

  if (pathname.startsWith('/api/auth/')) {
    json(res, 405, { ok: false, error: 'method_not_allowed' });
    return true;
  }

  return false;
}


async function reviewsApi(req, res, pathname) {
  if (pathname === '/api/reviews' && req.method === 'GET') {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const requestedLimit = Number(parsed.searchParams.get('limit') || 12);
    const requestedOffset = Number(parsed.searchParams.get('offset') || 0);
    const requestedRating = Number(parsed.searchParams.get('rating') || 0);
    const requestedProductId = String(parsed.searchParams.get('productId') || '').trim();
    const productFilter = requestedProductId && productById(requestedProductId) ? requestedProductId : '';
    const invalidProductFilter = !!requestedProductId && !productFilter;
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(24, requestedLimit)) : 12;
    const offset = Number.isInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0;
    const rating = Number.isInteger(requestedRating) && requestedRating >= 1 && requestedRating <= 5 ? requestedRating : 0;

    let rows = [];
    let summaryRow = { count: 0, average: 0, rating_5: 0, rating_4: 0, rating_3: 0, rating_2: 0, rating_1: 0 };
    if (!invalidProductFilter) {
      if (productFilter && rating) rows = await database.listReviewsByProductAndRating(productFilter, rating, limit, offset);
      else if (productFilter) rows = await database.listReviewsByProduct(productFilter, limit, offset);
      else if (rating) rows = await database.listReviewsByRating(rating, limit, offset);
      else rows = await database.listReviews(limit, offset);
      summaryRow = productFilter ? ((await database.reviewSummaryByProduct(productFilter)) || summaryRow) : ((await database.reviewSummary()) || summaryRow);
    }

    const reviews = await Promise.all(rows.map((row) => publicReview(row)));
    const count = Number(summaryRow.count || 0);
    const average = Number(summaryRow.average || 0);
    const resultCount = invalidProductFilter
      ? 0
      : (rating
        ? Number((productFilter
          ? ((await database.reviewCountByProductAndRating(productFilter, rating)) || { count: 0 })
          : ((await database.reviewCountByRating(rating)) || { count: 0 })).count || 0)
        : count);
    const ratingCounts = {
      5: Number(summaryRow.rating_5 || 0),
      4: Number(summaryRow.rating_4 || 0),
      3: Number(summaryRow.rating_3 || 0),
      2: Number(summaryRow.rating_2 || 0),
      1: Number(summaryRow.rating_1 || 0)
    };
    json(res, 200, {
      ok: true,
      reviews,
      summary: { count, average: Number(average.toFixed(2)), ratingCounts },
      filter: { rating: rating || null, productId: productFilter || (requestedProductId || null) },
      pagination: {
        limit,
        offset,
        total: resultCount,
        nextOffset: offset + reviews.length,
        hasMore: offset + reviews.length < resultCount
      }
    });
    return true;
  }

  const mediaMatch = /^\/api\/reviews\/(\d+)\/media\/(\d+)$/.exec(pathname);
  const multiImageMatch = /^\/api\/reviews\/(\d+)\/images\/(\d+)$/.exec(pathname);
  const legacyImageMatch = /^\/api\/reviews\/(\d+)\/image$/.exec(pathname);
  const assetMatch = mediaMatch || multiImageMatch || legacyImageMatch;
  if (assetMatch && req.method === 'GET') {
    const reviewId = Number(assetMatch[1]);
    const sortOrder = legacyImageMatch ? 0 : Number(assetMatch[2]);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder >= REVIEW_MEDIA_MAX_COUNT) {
      json(res, 404, { ok: false, error: 'media_not_found' });
      return true;
    }
    const row = await database.getReviewMedia(reviewId, sortOrder);
    if (!row || !row.image_blob) {
      json(res, 404, { ok: false, error: 'media_not_found' });
      return true;
    }
    const buffer = Buffer.from(row.image_blob);
    const mime = row.image_mime || 'application/octet-stream';
    const isVideo = row.media_kind === 'video' || String(mime).startsWith('video/');

    if (isVideo && req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range).trim());
      if (range) {
        let start;
        let end;
        if (!range[1] && range[2]) {
          const suffixLength = Math.max(0, Number(range[2]));
          start = Math.max(0, buffer.length - suffixLength);
          end = buffer.length - 1;
        } else {
          start = range[1] ? Number(range[1]) : 0;
          const requestedEnd = range[2] ? Number(range[2]) : buffer.length - 1;
          end = Math.min(requestedEnd, buffer.length - 1);
        }
        if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start <= end && start < buffer.length) {
          const chunk = buffer.subarray(start, end + 1);
          res.writeHead(206, {
            'Content-Type': mime,
            'Content-Length': chunk.length,
            'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff'
          });
          res.end(chunk);
          return true;
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': buffer.length,
      ...(isVideo ? { 'Accept-Ranges': 'bytes' } : {}),
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(buffer);
    return true;
  }

  if (pathname === '/api/reviews' && req.method === 'POST') {
    if (!sameOriginAllowed(req)) {
      json(res, 403, { ok: false, error: 'origin_not_allowed' });
      return true;
    }
    const user = await getCurrentUser(req);
    if (!user) {
      json(res, 401, { ok: false, error: 'login_required' });
      return true;
    }
    if (Number(user.is_verified_customer || 0) !== 1) {
      json(res, 403, { ok: false, error: 'verified_customer_required' });
      return true;
    }
    if (rateLimited(req, 'review-create', 8, 60 * 60 * 1000)) {
      json(res, 429, { ok: false, error: 'too_many_attempts' });
      return true;
    }

    const body = await readJsonBody(req);
    const reviewDate = parseReviewDate(body.date);
    const phone = normalizePhone(body.phone);
    const rating = Number(body.rating);
    const text = cleanReviewText(body.text);
    if (!phone) {
      json(res, 400, { ok: false, error: 'invalid_phone' });
      return true;
    }
    if (reviewDate === null) {
      json(res, 400, { ok: false, error: 'invalid_review_date' });
      return true;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      json(res, 400, { ok: false, error: 'invalid_rating' });
      return true;
    }
    if (text.length < 3 || text.length > REVIEW_TEXT_MAX) {
      json(res, 400, { ok: false, error: 'invalid_text' });
      return true;
    }

    let media;
    try {
      const incoming = Array.isArray(body.media)
        ? body.media
        : (Array.isArray(body.images) ? body.images : (body.imageDataUrl ? [body.imageDataUrl] : []));
      media = parseReviewMedia(incoming);
    } catch (err) {
      json(res, err.status || 400, { ok: false, error: err.message || 'invalid_media' });
      return true;
    }

    const now = Date.now();
    let id;
    const purchasedProduct = (await purchasedProductForUser(user.id)) || { id: 'mom-heart-01', variant: null };
    await database.transaction(async (tx) => {
      id = await tx.insertReview({
        userId: user.id,
        reviewName: PUBLIC_REVIEW_NAME,
        contactPhone: phone,
        reviewProductId: purchasedProduct.id,
        reviewProductVariant: purchasedProduct.variant,
        rating,
        body: text,
        reviewDate,
        createdAt: now,
        updatedAt: now
      });
      for (const [index, entry] of media.entries()) {
        await tx.insertReviewMedia(id, index, entry.buffer, entry.mime, entry.kind, now);
      }
    });

    const mediaPayload = media.map((entry, index) => ({
      kind: entry.kind,
      mime: entry.mime,
      url: `/api/reviews/${id}/media/${index}`
    }));
    const imageUrls = mediaPayload.filter((entry) => entry.kind === 'image').map((entry) => entry.url);
    json(res, 201, {
      ok: true,
      review: {
        id,
        name: PUBLIC_REVIEW_NAME,
        verified: true,
        rating,
        text,
        createdAt: reviewDate,
        media: mediaPayload,
        mediaCount: mediaPayload.length,
        imageUrls,
        imageUrl: imageUrls[0] || null,
        product: reviewProductPayload(purchasedProduct.id, purchasedProduct.variant, id)
      }
    });
    return true;
  }

  if (pathname.startsWith('/api/reviews')) {
    json(res, 405, { ok: false, error: 'method_not_allowed' });
    return true;
  }

  return false;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  })[ext] || 'application/octet-stream';
}

function prettyRouteFile(pathname) {
  if (pathname === '/') return 'index.html';
  // Internal document route used when leaving a masked product page for the
  // homepage/catalog. It is immediately hidden back to `/` by url-mask.js.
  if (pathname === '/shop' || pathname === '/shop/') return 'index.html';
  if (ROUTES.PAGE_FILES[pathname]) return ROUTES.PAGE_FILES[pathname];

  // Collection URLs are SPA routes. On direct load/refresh the Node server
  // must serve the root index.html and let the browser select the collection.
  // The URL hash (#shop) is never sent to the server, so /hats#shop arrives here as /hats.
  if (pathname === '/hats' || pathname === '/hats/') return 'index.html';

  if (ROUTES.categoryFromPath(pathname)) return 'index.html';
  const slug = pathname.charAt(0) === '/' ? pathname.slice(1) : pathname;
  if (slug && productByUrlSlug(slug)) return 'product.html';
  return null;
}

function isPublicPath(pathname) {
  if (prettyRouteFile(pathname) || pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/favicon.ico' || /^\/[A-Za-z0-9_-]+\.html$/.test(pathname)) return true;
  return pathname.startsWith('/assets/') || pathname.startsWith('/images/');
}

function htmlBootRoute(req, fallbackPathname) {
  try {
    const parsed = new URL(String(req.url || fallbackPathname || '/'), `http://${req.headers.host || 'localhost'}`);
    return (parsed.pathname || '/') + (parsed.search || '');
  } catch (_) {
    return String(fallbackPathname || '/');
  }
}

function safeInlineJson(value) {
  return JSON.stringify(String(value || '/'))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function injectStorefrontRouting(html, bootRoute) {
  const early = `<script>window.__VERSANS_BOOT_ROUTE__=${safeInlineJson(bootRoute)};</script><script src="/assets/route-state.js?v=20260922-global-home-nav-v5"></script>`;
  const late = '<script src="/assets/url-mask.js?v=20260922-urlmask-v3"></script>';
  let out = String(html || '');
  out = out
    .replace(/(\/?assets\/store\.js)(?:\?v=[^"'\s>]+)?/g, '$1?v=20260922-yankees-batch-v4')
    .replace(/(\/?assets\/products\.js)(?:\?v=[^"'\s>]+)?/g, '$1?v=20260922-yankees-batch-v4')
    .replace(/(\/?assets\/site-header\.js)(?:\?v=[^"'\s>]+)?/g, '$1?v=20260922-favorites-sync-v1')
    .replace(/(\/?assets\/presence\.js)(?:\?v=[^"'\s>]+)?/g, '$1?v=20260922-urlmask-v2');
  if (out.includes('</head>')) out = out.replace('</head>', `${early}\n</head>`);
  else out = early + out;
  if (out.includes('</body>')) out = out.replace('</body>', `${late}\n</body>`);
  else out += late;
  return out;
}

function serveStorefrontHtml(req, res, filePath, bootRoute) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf8'); } catch (_) { return false; }
  const body = injectStorefrontRouting(source, bootRoute || htmlBootRoute(req, '/'));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  if (req.method === 'HEAD') res.end();
  else res.end(body);
  return true;
}

function wantsHtmlDocument(req) {
  const dest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  const accept = String(req.headers.accept || '').toLowerCase();
  return dest === 'document' || accept.includes('text/html') || accept === '*/*' || !accept;
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  // Hard fallback for the hats collection on localhost/Render refresh.
  // /hats#shop is received by Node as /hats.
  if (pathname === '/hats' || pathname === '/hats/') {
    pathname = '/';
  }

  if (!isPublicPath(pathname)) return false;

  const rel = prettyRouteFile(pathname) || pathname.replace(/^\//, '');
  const filePath = path.resolve(ROOT, rel);
  if (!filePath.startsWith(ROOT + path.sep)) return false;

  let stat;
  try { stat = fs.statSync(filePath); } catch (_) { return false; }
  if (!stat.isFile()) return false;

  if (path.extname(filePath).toLowerCase() === '.html') {
    return serveStorefrontHtml(req, res, filePath, htmlBootRoute(req, pathname));
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', mimeType(filePath));
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Length', stat.size);
  if (req.method === 'HEAD') return void res.end();
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);

  let parsed;
  try {
    parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (_) {
    json(res, 400, { error: 'Bad request' });
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); }
  catch (_) { json(res, 400, { error: 'Bad request' }); return; }

  try {
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/product.html' && parsed.searchParams.has('id')) {
      const product = productById(parsed.searchParams.get('id'));
      if (product && product.urlSlug) {
        const publicPath = productPublicPath(product);
        if (!publicPath.startsWith('/product.html?')) {
          const targetParams = new URLSearchParams(parsed.searchParams);
          targetParams.delete('id');
          const query = targetParams.toString();
          redirect(res, publicPath + (query ? '?' + query : ''), 301);
          return;
        }
      }
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/index.html') && parsed.searchParams.has('cat')) {
      const category = parsed.searchParams.get('cat');
      const target = ROUTES.COLLECTION_PATHS[category];
      if (target) {
        const targetParams = new URLSearchParams(parsed.searchParams);
        targetParams.delete('cat');
        const query = targetParams.toString();
        redirect(res, target + (query ? '?' + query : ''), 301);
        return;
      }
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && ROUTES.LEGACY_PAGE_PATHS[pathname]) {
      const query = parsed.searchParams.toString();
      redirect(res, ROUTES.LEGACY_PAGE_PATHS[pathname] + (query ? '?' + query : ''), 301);
      return;
    }
    if (await adminPage(req, res, pathname)) return;
    if (await marketingUnsubscribePage(req, res, pathname, parsed)) return;
    if (await presenceApi(req, res, pathname)) return;
    if (await adminApi(req, res, pathname, parsed)) return;
    if (await authApi(req, res, pathname)) return;
    if (await reviewsApi(req, res, pathname)) return;

    if (pathname === '/api/coupons/validate' && req.method === 'POST') {
      if (!sameOriginAllowed(req)) {
        json(res, 403, { ok: false, error: 'origin_not_allowed' });
        return;
      }
      const currentUser = await getCurrentUser(req);
      if (!currentUser) {
        json(res, 401, { ok: false, error: 'login_required' });
        return;
      }
      const body = await readJsonBody(req);
      const code = normalizeCouponCode(body && body.code);
      if (!code) {
        json(res, 400, { ok: false, error: 'invalid_coupon' });
        return;
      }
      const coupon = await database.getCouponForUserByCode(currentUser.id, code);
      const status = couponStatus(coupon);
      if (status !== 'ok') {
        json(res, 400, { ok: false, error: status });
        return;
      }
      const priced = priceOrder(Array.isArray(body.items) ? body.items : [], body.lang === 'en' ? 'en' : 'he', {
        code: coupon.code,
        percent: Number(coupon.discount_percent || WELCOME_COUPON_PERCENT)
      });
      json(res, 200, {
        ok: true,
        coupon: {
          code: coupon.code,
          percent: Number(coupon.discount_percent || WELCOME_COUPON_PERCENT),
          expiresAt: Number(coupon.expires_at),
          discount: priced.couponDiscount,
          total: priced.total
        }
      });
      return;
    }

    if (pathname === '/api/create-payment' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const mode = checkoutMode();
      const requestedCouponCode = normalizeCouponCode(body && body.couponCode);
      const customer = normalizeShippingCustomer(body && body.customer);
      const paymentBody = { ...body, customer };

      // Demo checkout must never wait for HYP or the orders database. Its purpose is
      // to exercise the real storefront -> thank-you -> Google Sheet flow without a
      // real charge. A slow/locked database previously left the checkout button
      // waiting forever even though demo mode itself did not need the write.
      if (mode === 'demo') {
        const demoCoupon = requestedCouponCode
          ? { code: requestedCouponCode, percent: WELCOME_COUPON_PERCENT }
          : null;
        const result = createDemoPaymentResult(paymentBody, { coupon: demoCoupon });
        const amountAgorot = amountToAgorot(result.total);
        if (amountAgorot === null) throw new Error('invalid_order_total');
        const now = Date.now();
        const demoOrder = {
          order_ref: String(result.order || ''),
          customer_email: customer.email,
          customer_phone: customer.phone || null,
          customer_json: JSON.stringify(customer),
          amount_agorot: amountAgorot,
          currency: String(result.currency || 'ILS'),
          items_json: JSON.stringify(Array.isArray(body.items) ? body.items : []),
          status: 'paid',
          created_at: now,
          paid_at: now,
          updated_at: now
        };

        json(res, 200, result);
        setImmediate(() => {
          sendPaidOrderToGoogleSheet(demoOrder).catch((sheetErr) => {
            console.error(`Google demo order sync failed for ${demoOrder.order_ref}:`, sheetErr);
          });
          sendOrderConfirmationForOrder(demoOrder).catch((emailErr) => {
            console.error(`Demo order confirmation email failed for ${demoOrder.order_ref}:`, emailErr && emailErr.message ? emailErr.message : emailErr);
          });
        });
        return;
      }

      const currentUser = await getCurrentUser(req);
      let coupon = null;
      if (requestedCouponCode) {
        if (!currentUser) {
          json(res, 401, { ok: false, error: 'login_required' });
          return;
        }
        coupon = await database.getCouponForUserByCode(currentUser.id, requestedCouponCode);
        const status = couponStatus(coupon);
        if (status !== 'ok') {
          json(res, 400, { ok: false, error: status });
          return;
        }
      }
      const paymentOptions = {
        coupon: coupon ? { code: coupon.code, percent: Number(coupon.discount_percent || WELCOME_COUPON_PERCENT) } : null
      };
      const result = await createPaymentUrl(paymentBody, paymentOptions);
      const customerEmail = customer.email;
      const customerPhone = customer.phone || null;
      const amountAgorot = amountToAgorot(result.total);
      if (amountAgorot === null) throw new Error('invalid_order_total');

      let linkedUserId = currentUser ? Number(currentUser.id) : null;
      if (!linkedUserId && validEmail(customerEmail)) {
        const existingUser = await database.findUserByEmail(customerEmail);
        if (existingUser) linkedUserId = Number(existingUser.id);
      }

      const now = Date.now();
      await database.insertPendingOrder({
        orderRef: String(result.order || ''),
        userId: linkedUserId,
        customerEmail: validEmail(customerEmail) ? customerEmail : null,
        customerPhone,
        customerJson: JSON.stringify(customer),
        amountAgorot,
        currency: String(result.currency || 'ILS'),
        itemsJson: JSON.stringify(Array.isArray(body.items) ? body.items : []),
        couponId: coupon ? Number(coupon.id) : null,
        couponCode: coupon ? String(coupon.code) : null,
        couponDiscountAgorot: amountToAgorot(result.couponDiscount || 0) || 0,
        createdAt: now,
        updatedAt: now
      });
      json(res, 200, result);
      return;
    }

    if (pathname === '/api/verify-payment' && req.method === 'GET') {
      const query = Object.fromEntries(parsed.searchParams.entries());
      const mode = checkoutMode();
      let result;
      let orderRef;
      let order;

      if (mode === 'demo') {
        orderRef = String(query.Order || '').trim();
        const amount = Number(query.Amount);
        const validDemoReturn = query.versans_demo === '1'
          && query.CCode === '0'
          && /^VS-DEMO-[A-Z0-9-]+$/.test(orderRef)
          && Number.isFinite(amount)
          && amount >= 0;
        result = {
          ok: validDemoReturn,
          ccode: validDemoReturn ? '0' : '1',
          order: orderRef || null,
          amount: Number.isFinite(amount) ? amount.toFixed(2) : null,
          raw: 'demo',
          demo: true
        };
        json(res, 200, { ...result, verifiedCustomer: false });
        return;
      } else {
        result = await verifyPayment(query);
        orderRef = String(result.order || query.Order || '').trim();
        order = orderRef ? await database.getOrderByRef(orderRef) : null;
      }

      let verifiedCustomer = false;

      if (order) {
        if (result.ok) {
          const returnedAmount = result.amount == null || result.amount === '' ? null : amountToAgorot(result.amount);
          const amountMatches = returnedAmount === null || returnedAmount === Number(order.amount_agorot);
          if (amountMatches) {
            const now = Date.now();
            await database.transaction(async (tx) => {
              await tx.markOrderPaid(now, order.id);
              if (order.coupon_id && order.user_id) {
                const redeemed = await tx.markCouponUsed(order.coupon_id, order.user_id, order.order_ref, now);
                if (!redeemed) console.error(`Coupon redemption warning for order ${order.order_ref}`);
              }
              if (order.user_id) {
                await tx.markUserVerified(now, order.user_id);
                verifiedCustomer = true;
              }
            });

            // Google Sheet sync is deliberately best-effort: a Sheets outage must never
            // turn a successful customer payment into a failed checkout response.
            // The Apps Script endpoint de-duplicates by orderRef, so refreshing the
            // thank-you page safely retries a failed sync without creating duplicates.
            const paidOrder = {
              ...order,
              status: 'paid',
              paid_at: order.paid_at || now,
              updated_at: now
            };
            try {
              await sendPaidOrderToGoogleSheet(paidOrder);
            } catch (sheetErr) {
              console.error(`Google order sync failed for ${order.order_ref}:`, sheetErr);
            }
            try {
              await sendOrderConfirmationForOrder(paidOrder);
            } catch (emailErr) {
              console.error(`Order confirmation email failed for ${order.order_ref}:`, emailErr && emailErr.message ? emailErr.message : emailErr);
            }
          }
        } else {
          await database.markOrderFailed(Date.now(), order.id);
        }
      }

      json(res, 200, { ...result, verifiedCustomer });
      return;
    }

    if (pathname.startsWith('/api/')) {
      json(res, 404, { error: 'API route not found' });
      return;
    }

if (serveStatic(req, res, pathname)) return;

// אם serveStatic כבר שלח headers/response, לא שולחים תשובה נוספת
if (res.headersSent) return;

    // Storefront navigation safety net: unknown extensionless browser routes
    // fall back to the storefront instead of producing a user-facing 404.
    if ((req.method === 'GET' || req.method === 'HEAD') &&
        !pathname.startsWith('/api/') &&
        !pathname.startsWith('/admin') &&
        !path.extname(pathname) &&
        wantsHtmlDocument(req)) {
      const indexPath = path.resolve(ROOT, 'index.html');
      if (serveStorefrontHtml(req, res, indexPath, htmlBootRoute(req, pathname))) return;
    }

res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
res.end('404 - Not found');
  } catch (err) {
    console.error(`${req.method} ${pathname} failed:`, err);
    if (!res.headersSent) json(res, err.status || 500, { ok: false, error: err.status ? err.message : 'internal_error' });
    else res.end();
  }
});

setInterval(async () => {
  try { await database.deleteExpiredSessions(Date.now()); } catch (err) { console.error('Session cleanup failed:', err); }
}, 60 * 60 * 1000).unref();

setInterval(async () => {
  try { await database.cleanupPresencePageViews(Date.now() - PRESENCE_RETENTION_MS); } catch (err) { console.error('Presence cleanup failed:', err); }
}, 6 * 60 * 60 * 1000).unref();

async function purgeNonAdminUsersOnce() {
  const alreadyDone = await database.getSchemaMeta(USER_PURGE_META_KEY);
  if (alreadyDone) return;

  const adminUser = await database.findUserByEmail(ADMIN_EMAIL);
  if (!adminUser) {
    console.error(`User purge skipped: protected account ${ADMIN_EMAIL} was not found.`);
    return;
  }

  const result = await database.deleteUsersExceptEmail(ADMIN_EMAIL);
  await database.setSchemaMeta(USER_PURGE_META_KEY, JSON.stringify({
    completedAt: Date.now(),
    protectedEmail: ADMIN_EMAIL,
    deletedUsers: Number(result && result.deletedUsers ? result.deletedUsers : 0)
  }));
  console.log(`One-time user purge complete: deleted ${Number(result && result.deletedUsers ? result.deletedUsers : 0)} users; kept ${ADMIN_EMAIL}.`);
}

async function start() {
  await database.init();
  await purgeNonAdminUsersOnce();
  await database.cleanupPresencePageViews(Date.now() - PRESENCE_RETENTION_MS);
  server.listen(PORT, HOST, () => {
    console.log(`VerSans running on http://${HOST}:${PORT}`);
    console.log(`Database backend: ${database.backend}`);
    if (database.backend === 'sqlite') console.log(`SQLite: ${DB_PATH}`);
    const emailStartupTimer = setTimeout(() => {
      processPendingWelcomeEmails().catch((err) => console.error('Pending welcome email processing failed:', err));
      syncMarketingCatalog().catch((err) => console.error('Marketing catalog sync failed:', err));
    }, 1500);
    if (emailStartupTimer && typeof emailStartupTimer.unref === 'function') emailStartupTimer.unref();
  });
}

async function shutdown() {
  server.close(async () => {
    try { await database.close(); } catch (_) {}
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to initialize VerSans database:', err);
  process.exit(1);
});
