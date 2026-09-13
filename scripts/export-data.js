'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.VERSANS_DATA_DIR
  ? path.resolve(process.env.VERSANS_DATA_DIR)
  : path.join(ROOT, 'data');
const DB_PATH = process.env.VERSANS_DB_PATH
  ? path.resolve(process.env.VERSANS_DB_PATH)
  : path.join(DATA_DIR, 'versans.sqlite');

if (!fs.existsSync(DB_PATH)) {
  console.error(`SQLite database was not found: ${DB_PATH}`);
  process.exit(1);
}

function hasTable(db, name) {
  return !!db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(name);
}

function columns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
try {
  const userCols = columns(db, 'users');
  const reviewCols = columns(db, 'reviews');

  const users = db.prepare(`
    SELECT id, name, email, password_hash,
           ${userCols.has('is_verified_customer') ? 'is_verified_customer' : '0 AS is_verified_customer'},
           ${userCols.has('verified_customer_at') ? 'verified_customer_at' : 'NULL AS verified_customer_at'},
           created_at
    FROM users ORDER BY id
  `).all();

  const hasReviewImages = hasTable(db, 'review_images');
  const reviewImageCols = hasReviewImages ? columns(db, 'review_images') : new Set();
  const imageRows = hasReviewImages
    ? db.prepare(`
        SELECT review_id, sort_order, image_blob, image_mime,
               ${reviewImageCols.has('media_kind') ? 'media_kind' : "CASE WHEN instr(image_mime, 'video/') = 1 THEN 'video' ELSE 'image' END AS media_kind"}
        FROM review_images
        ORDER BY review_id, sort_order
      `).all()
    : [];

  const mediaByReview = new Map();
  imageRows.forEach((row) => {
    const reviewId = Number(row.review_id);
    if (!mediaByReview.has(reviewId)) mediaByReview.set(reviewId, []);
    mediaByReview.get(reviewId).push({
      sortOrder: Number(row.sort_order),
      mime: row.image_mime,
      kind: row.media_kind || (String(row.image_mime || '').startsWith('video/') ? 'video' : 'image'),
      base64: Buffer.from(row.image_blob).toString('base64')
    });
  });

  const reviews = db.prepare(`
    SELECT id, user_id, review_name,
           ${reviewCols.has('contact_phone') ? 'contact_phone' : 'NULL AS contact_phone'},
           ${reviewCols.has('verified_purchase') ? 'verified_purchase' : '0 AS verified_purchase'},
           ${reviewCols.has('review_product_id') ? 'review_product_id' : 'NULL AS review_product_id'},
           ${reviewCols.has('review_product_variant') ? 'review_product_variant' : 'NULL AS review_product_variant'},
           rating, body, review_date, image_blob, image_mime, status, created_at, updated_at
    FROM reviews
    ORDER BY id
  `).all().map((row) => {
    let media = mediaByReview.get(Number(row.id)) || [];
    if (!media.length && row.image_blob && row.image_mime) {
      media = [{
        sortOrder: 0,
        mime: row.image_mime,
        kind: 'image',
        base64: Buffer.from(row.image_blob).toString('base64')
      }];
    }
    return {
      id: row.id,
      userId: row.user_id,
      reviewName: row.review_name || null,
      contactPhone: row.contact_phone || null,
      verifiedPurchase: Number(row.verified_purchase || 0) === 1,
      reviewProductId: row.review_product_id || null,
      reviewProductVariant: row.review_product_variant || null,
      rating: row.rating,
      body: row.body,
      media,
      status: row.status,
      reviewDate: row.review_date || row.created_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });

  const orders = hasTable(db, 'orders') ? db.prepare(`
    SELECT id, order_ref, user_id, customer_email, customer_phone, amount_agorot,
           currency, items_json, status, created_at, paid_at, updated_at
    FROM orders
    ORDER BY id
  `).all().map((row) => ({
    id: row.id,
    orderRef: row.order_ref,
    userId: row.user_id,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    amountAgorot: row.amount_agorot,
    currency: row.currency,
    items: (() => { try { return row.items_json ? JSON.parse(row.items_json) : []; } catch (_) { return []; } })(),
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    updatedAt: row.updated_at
  })) : [];

  const schema = hasTable(db, 'schema_meta')
    ? db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version' LIMIT 1").get()
    : null;

  const payload = {
    format: 'versans-portable-export',
    formatVersion: 6,
    source: 'sqlite',
    schemaVersion: schema ? Number(schema.value) : null,
    exportedAt: new Date().toISOString(),
    note: 'Private migration export. Contains password hashes, customer phone numbers, order data and review media (images/videos); do not publish this file.',
    users: users.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      isVerifiedCustomer: Number(row.is_verified_customer || 0) === 1,
      verifiedCustomerAt: row.verified_customer_at || null,
      createdAt: row.created_at
    })),
    orders,
    reviews
  };

  const exportDir = path.join(DATA_DIR, 'exports');
  fs.mkdirSync(exportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = path.join(exportDir, `versans-export-${stamp}.json`);
  fs.writeFileSync(output, JSON.stringify(payload, null, 2), { mode: 0o600 });
  const mediaCount = reviews.reduce((sum, review) => sum + review.media.length, 0);
  console.log(`Exported ${users.length} user(s), ${orders.length} order(s), ${reviews.length} review(s) and ${mediaCount} review media item(s).`);
  console.log(`Private migration file: ${output}`);
} finally {
  db.close();
}
