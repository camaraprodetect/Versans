'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { createPaymentUrl, verifyPayment } = require('./api/_hyp.js');
const { PRODUCTS } = require('./assets/products.js');

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
const BODY_LIMIT = 48 * 1024 * 1024;
const REVIEW_IMAGE_LIMIT = 2 * 1024 * 1024;
const REVIEW_VIDEO_LIMIT = 20 * 1024 * 1024;
const REVIEW_MEDIA_TOTAL_LIMIT = 30 * 1024 * 1024;
const REVIEW_MEDIA_MAX_COUNT = 5;
const REVIEW_TEXT_MAX = 1200;
const PUBLIC_REVIEW_NAME = 'לקוח VerSans';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_verified_customer INTEGER NOT NULL DEFAULT 0 CHECK (is_verified_customer IN (0,1)),
    verified_customer_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref TEXT NOT NULL UNIQUE,
    user_id INTEGER,
    customer_email TEXT,
    customer_phone TEXT,
    amount_agorot INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    items_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
    created_at INTEGER NOT NULL,
    paid_at INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    review_name TEXT,
    contact_phone TEXT,
    verified_purchase INTEGER NOT NULL DEFAULT 0 CHECK (verified_purchase IN (0,1)),
    review_product_id TEXT,
    review_product_variant TEXT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT NOT NULL,
    review_date INTEGER,
    image_blob BLOB,
    image_mime TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS review_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    image_blob BLOB NOT NULL,
    image_mime TEXT NOT NULL,
    media_kind TEXT NOT NULL DEFAULT 'image' CHECK (media_kind IN ('image','video')),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    UNIQUE (review_id, sort_order)
  );

  CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Safe in-place migration for existing SQLite databases.
const userColumns = db.prepare('PRAGMA table_info(users)').all();
if (!userColumns.some((column) => column.name === 'is_verified_customer')) {
  db.exec('ALTER TABLE users ADD COLUMN is_verified_customer INTEGER NOT NULL DEFAULT 0 CHECK (is_verified_customer IN (0,1))');
}
if (!userColumns.some((column) => column.name === 'verified_customer_at')) {
  db.exec('ALTER TABLE users ADD COLUMN verified_customer_at INTEGER');
}

const reviewColumns = db.prepare('PRAGMA table_info(reviews)').all();
if (!reviewColumns.some((column) => column.name === 'review_name')) {
  db.exec('ALTER TABLE reviews ADD COLUMN review_name TEXT');
}
if (!reviewColumns.some((column) => column.name === 'review_date')) {
  db.exec('ALTER TABLE reviews ADD COLUMN review_date INTEGER');
}
if (!reviewColumns.some((column) => column.name === 'contact_phone')) {
  db.exec('ALTER TABLE reviews ADD COLUMN contact_phone TEXT');
}
if (!reviewColumns.some((column) => column.name === 'verified_purchase')) {
  db.exec('ALTER TABLE reviews ADD COLUMN verified_purchase INTEGER NOT NULL DEFAULT 0 CHECK (verified_purchase IN (0,1))');
}
if (!reviewColumns.some((column) => column.name === 'review_product_id')) {
  db.exec('ALTER TABLE reviews ADD COLUMN review_product_id TEXT');
}
if (!reviewColumns.some((column) => column.name === 'review_product_variant')) {
  db.exec('ALTER TABLE reviews ADD COLUMN review_product_variant TEXT');
}

const reviewImageColumns = db.prepare('PRAGMA table_info(review_images)').all();
if (!reviewImageColumns.some((column) => column.name === 'media_kind')) {
  db.exec("ALTER TABLE review_images ADD COLUMN media_kind TEXT NOT NULL DEFAULT 'image' CHECK (media_kind IN ('image','video'))");
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(order_ref);
  CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_reviews_status_created_at ON reviews(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_review_images_review_order ON review_images(review_id, sort_order);

  UPDATE reviews
  SET review_name = 'לקוח VerSans';

  UPDATE reviews
  SET review_date = created_at
  WHERE review_date IS NULL;

  UPDATE reviews
  SET review_product_id = 'mom-heart-01'
  WHERE review_product_id IS NULL OR review_product_id = '';

  INSERT INTO review_images (review_id, sort_order, image_blob, image_mime, media_kind, created_at)
  SELECT r.id, 0, r.image_blob, r.image_mime, 'image', r.created_at
  FROM reviews r
  WHERE r.image_blob IS NOT NULL
    AND r.image_mime IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM review_images ri WHERE ri.review_id = r.id);

  INSERT INTO schema_meta (key, value) VALUES ('schema_version', '8')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`);

db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());

const stmt = {
  findUserByEmail: db.prepare(`
    SELECT id, name, email, password_hash, is_verified_customer, verified_customer_at, created_at
    FROM users WHERE email = ? COLLATE NOCASE LIMIT 1
  `),
  findPublicUserBySession: db.prepare(`
    SELECT u.id, u.name, u.email, u.is_verified_customer, u.verified_customer_at, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
    LIMIT 1
  `),
  insertUser: db.prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  listReviews: db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, r.updated_at,
           COALESCE(r.review_date, r.created_at) AS review_date,
           r.verified_purchase, r.review_product_id, r.review_product_variant,
           (SELECT COUNT(*) FROM review_images ri WHERE ri.review_id = r.id) AS media_count
    FROM reviews r
    WHERE r.status = 'published'
    ORDER BY COALESCE(r.review_date, r.created_at) DESC, r.id DESC
    LIMIT ? OFFSET ?
  `),
  listReviewsByRating: db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, r.updated_at,
           COALESCE(r.review_date, r.created_at) AS review_date,
           r.verified_purchase, r.review_product_id, r.review_product_variant,
           (SELECT COUNT(*) FROM review_images ri WHERE ri.review_id = r.id) AS media_count
    FROM reviews r
    WHERE r.status = 'published' AND r.rating = ?
    ORDER BY COALESCE(r.review_date, r.created_at) DESC, r.id DESC
    LIMIT ? OFFSET ?
  `),
  listReviewsByProduct: db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, r.updated_at,
           COALESCE(r.review_date, r.created_at) AS review_date,
           r.verified_purchase, r.review_product_id, r.review_product_variant,
           (SELECT COUNT(*) FROM review_images ri WHERE ri.review_id = r.id) AS media_count
    FROM reviews r
    WHERE r.status = 'published' AND r.review_product_id = ?
    ORDER BY COALESCE(r.review_date, r.created_at) DESC, r.id DESC
    LIMIT ? OFFSET ?
  `),
  listReviewsByProductAndRating: db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, r.updated_at,
           COALESCE(r.review_date, r.created_at) AS review_date,
           r.verified_purchase, r.review_product_id, r.review_product_variant,
           (SELECT COUNT(*) FROM review_images ri WHERE ri.review_id = r.id) AS media_count
    FROM reviews r
    WHERE r.status = 'published' AND r.review_product_id = ? AND r.rating = ?
    ORDER BY COALESCE(r.review_date, r.created_at) DESC, r.id DESC
    LIMIT ? OFFSET ?
  `),
  reviewCountByRating: db.prepare(`
    SELECT COUNT(*) AS count
    FROM reviews
    WHERE status = 'published' AND rating = ?
  `),
  reviewSummary: db.prepare(`
    SELECT COUNT(*) AS count,
           COALESCE(AVG(rating), 0) AS average,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS rating_5,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS rating_4,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS rating_3,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS rating_2,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS rating_1
    FROM reviews
    WHERE status = 'published'
  `),
  reviewSummaryByProduct: db.prepare(`
    SELECT COUNT(*) AS count,
           COALESCE(AVG(rating), 0) AS average,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS rating_5,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS rating_4,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS rating_3,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS rating_2,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS rating_1
    FROM reviews
    WHERE status = 'published' AND review_product_id = ?
  `),
  reviewCountByProductAndRating: db.prepare(`
    SELECT COUNT(*) AS count
    FROM reviews
    WHERE status = 'published' AND review_product_id = ? AND rating = ?
  `),
  insertReview: db.prepare(`
    INSERT INTO reviews (user_id, review_name, contact_phone, verified_purchase, review_product_id, review_product_variant, rating, body, review_date, status, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'published', ?, ?)
  `),
  insertReviewMedia: db.prepare(`
    INSERT INTO review_images (review_id, sort_order, image_blob, image_mime, media_kind, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getReviewMedia: db.prepare(`
    SELECT ri.image_blob, ri.image_mime, ri.media_kind
    FROM review_images ri
    JOIN reviews r ON r.id = ri.review_id
    WHERE ri.review_id = ? AND ri.sort_order = ? AND r.status = 'published'
    LIMIT 1
  `),
  listReviewMediaMeta: db.prepare(`
    SELECT sort_order, image_mime, media_kind
    FROM review_images
    WHERE review_id = ?
    ORDER BY sort_order
  `),
  insertPendingOrder: db.prepare(`
    INSERT INTO orders (order_ref, user_id, customer_email, customer_phone, amount_agorot, currency, items_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `),
  getOrderByRef: db.prepare(`
    SELECT id, order_ref, user_id, amount_agorot, status FROM orders WHERE order_ref = ? LIMIT 1
  `),
  latestPaidOrderForUser: db.prepare(`
    SELECT id, items_json
    FROM orders
    WHERE user_id = ? AND status = 'paid'
    ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
    LIMIT 1
  `),
  markOrderPaid: db.prepare(`
    UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE id = ?
  `),
  markOrderFailed: db.prepare(`
    UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'
  `),
  markUserVerified: db.prepare(`
    UPDATE users
    SET is_verified_customer = 1, verified_customer_at = COALESCE(verified_customer_at, ?)
    WHERE id = ?
  `)
};

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

function amountToAgorot(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
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
    href: `/product.html?id=${encodeURIComponent(safeId)}`
  };
}

function purchasedProductForUser(userId) {
  const order = stmt.latestPaidOrderForUser.get(userId);
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

function publicReview(row) {
  const cacheVersion = Number(row.updated_at || row.created_at || 0);
  const meta = stmt.listReviewMediaMeta.all(row.id).slice(0, REVIEW_MEDIA_MAX_COUNT);
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

function getCurrentUser(req) {
  const token = getSessionToken(req);
  if (!token || token.length < 20) return null;
  return stmt.findPublicUserBySession.get(tokenHash(token), Date.now()) || null;
}

function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  stmt.insertSession.run(userId, tokenHash(token), now, now + SESSION_TTL_MS);
  return sessionCookie(token, req);
}

function safeUser(user) {
  return user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    isVerifiedCustomer: Number(user.is_verified_customer || 0) === 1,
    verifiedCustomerAt: user.verified_customer_at || null,
    createdAt: user.created_at
  } : null;
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
    json(res, 200, { ok: true, user: safeUser(getCurrentUser(req)) });
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
    const password = String(body.password || '');

    if (name.length < 2 || name.length > 70) {
      json(res, 400, { ok: false, error: 'invalid_name' });
      return true;
    }
    if (!validEmail(email)) {
      json(res, 400, { ok: false, error: 'invalid_email' });
      return true;
    }
    if (password.length < 8 || password.length > 128) {
      json(res, 400, { ok: false, error: 'invalid_password' });
      return true;
    }
    if (stmt.findUserByEmail.get(email)) {
      json(res, 409, { ok: false, error: 'email_exists' });
      return true;
    }

    let userId;
    try {
      const result = stmt.insertUser.run(name, email, hashPassword(password), Date.now());
      userId = Number(result.lastInsertRowid);
    } catch (err) {
      if (String(err && err.message).includes('UNIQUE')) {
        json(res, 409, { ok: false, error: 'email_exists' });
        return true;
      }
      throw err;
    }

    const cookie = createSession(userId, req);
    const user = stmt.findUserByEmail.get(email);
    json(res, 201, { ok: true, user: safeUser(user) }, { 'Set-Cookie': cookie });
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
    const user = validEmail(email) ? stmt.findUserByEmail.get(email) : null;

    if (!user || !verifyPassword(password, user.password_hash)) {
      json(res, 401, { ok: false, error: 'invalid_credentials' });
      return true;
    }

    const oldToken = getSessionToken(req);
    if (oldToken) stmt.deleteSession.run(tokenHash(oldToken));
    const cookie = createSession(user.id, req);
    json(res, 200, { ok: true, user: safeUser(user) }, { 'Set-Cookie': cookie });
    return true;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = getSessionToken(req);
    if (token) stmt.deleteSession.run(tokenHash(token));
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
      if (productFilter && rating) rows = stmt.listReviewsByProductAndRating.all(productFilter, rating, limit, offset);
      else if (productFilter) rows = stmt.listReviewsByProduct.all(productFilter, limit, offset);
      else if (rating) rows = stmt.listReviewsByRating.all(rating, limit, offset);
      else rows = stmt.listReviews.all(limit, offset);
      summaryRow = productFilter ? (stmt.reviewSummaryByProduct.get(productFilter) || summaryRow) : (stmt.reviewSummary.get() || summaryRow);
    }

    const reviews = rows.map((row) => publicReview(row));
    const count = Number(summaryRow.count || 0);
    const average = Number(summaryRow.average || 0);
    const resultCount = invalidProductFilter
      ? 0
      : (rating
        ? Number((productFilter
          ? (stmt.reviewCountByProductAndRating.get(productFilter, rating) || { count: 0 })
          : (stmt.reviewCountByRating.get(rating) || { count: 0 })).count || 0)
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
    const row = stmt.getReviewMedia.get(reviewId, sortOrder);
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
    const user = getCurrentUser(req);
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
    const purchasedProduct = purchasedProductForUser(user.id) || { id: 'mom-heart-01', variant: null };
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = stmt.insertReview.run(
        user.id, PUBLIC_REVIEW_NAME, phone, purchasedProduct.id, purchasedProduct.variant,
        rating, text, reviewDate, now, now
      );
      id = Number(result.lastInsertRowid);
      media.forEach((entry, index) => {
        stmt.insertReviewMedia.run(id, index, entry.buffer, entry.mime, entry.kind, now);
      });
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw err;
    }

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
    '.woff2': 'font/woff2'
  })[ext] || 'application/octet-stream';
}

function isPublicPath(pathname) {
  if (pathname === '/' || pathname === '/robots.txt' || pathname === '/sitemap.xml' || /^\/[A-Za-z0-9_-]+\.html$/.test(pathname)) return true;
  return pathname.startsWith('/assets/') || pathname.startsWith('/images/');
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!isPublicPath(pathname)) return false;

  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const filePath = path.resolve(ROOT, rel);
  if (!filePath.startsWith(ROOT + path.sep)) return false;

  let stat;
  try { stat = fs.statSync(filePath); } catch (_) { return false; }
  if (!stat.isFile()) return false;

  res.statusCode = 200;
  res.setHeader('Content-Type', mimeType(filePath));
  if (path.extname(filePath).toLowerCase() === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
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
    if (await authApi(req, res, pathname)) return;
    if (await reviewsApi(req, res, pathname)) return;

    if (pathname === '/api/create-payment' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await createPaymentUrl(body);
      const currentUser = getCurrentUser(req);
      const customer = body && body.customer ? body.customer : {};
      const customerEmail = normalizeEmail(customer.email);
      const customerPhone = normalizePhone(customer.phone) || null;
      const amountAgorot = amountToAgorot(result.total);
      if (amountAgorot === null) throw new Error('invalid_order_total');

      let linkedUserId = currentUser ? Number(currentUser.id) : null;
      if (!linkedUserId && validEmail(customerEmail)) {
        const existingUser = stmt.findUserByEmail.get(customerEmail);
        if (existingUser) linkedUserId = Number(existingUser.id);
      }

      const now = Date.now();
      stmt.insertPendingOrder.run(
        String(result.order || ''),
        linkedUserId,
        validEmail(customerEmail) ? customerEmail : null,
        customerPhone,
        amountAgorot,
        String(result.currency || 'ILS'),
        JSON.stringify(Array.isArray(body.items) ? body.items : []),
        now,
        now
      );
      json(res, 200, result);
      return;
    }

    if (pathname === '/api/verify-payment' && req.method === 'GET') {
      const query = Object.fromEntries(parsed.searchParams.entries());
      const result = await verifyPayment(query);
      let verifiedCustomer = false;
      const orderRef = String(result.order || query.Order || '').trim();
      const order = orderRef ? stmt.getOrderByRef.get(orderRef) : null;

      if (order) {
        if (result.ok) {
          const returnedAmount = result.amount == null || result.amount === '' ? null : amountToAgorot(result.amount);
          const amountMatches = returnedAmount === null || returnedAmount === Number(order.amount_agorot);
          if (amountMatches) {
            const now = Date.now();
            db.exec('BEGIN IMMEDIATE');
            try {
              stmt.markOrderPaid.run(now, now, order.id);
              if (order.user_id) {
                stmt.markUserVerified.run(now, order.user_id);
                verifiedCustomer = true;
              }
              db.exec('COMMIT');
            } catch (err) {
              try { db.exec('ROLLBACK'); } catch (_) {}
              throw err;
            }
          }
        } else {
          stmt.markOrderFailed.run(Date.now(), order.id);
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

res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
res.end('404 - Not found');
  } catch (err) {
    console.error(`${req.method} ${pathname} failed:`, err);
    if (!res.headersSent) json(res, err.status || 500, { ok: false, error: err.status ? err.message : 'internal_error' });
    else res.end();
  }
});

setInterval(() => {
  try { stmt.deleteExpiredSessions.run(Date.now()); } catch (err) { console.error('Session cleanup failed:', err); }
}, 60 * 60 * 1000).unref();

server.listen(PORT, HOST, () => {
  console.log(`VerSans running on http://${HOST}:${PORT}`);
  console.log(`SQLite: ${DB_PATH}`);
});

function shutdown() {
  server.close(() => {
    try { db.close(); } catch (_) {}
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
