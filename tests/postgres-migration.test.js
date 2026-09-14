'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const {
  TABLES,
  snapshotSqlite,
  snapshotDigests,
  normalizeDigestValue
} = require('../scripts/migrate-sqlite-to-postgres.js');

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-migrate-'));
  const file = path.join(dir, 'fixture.sqlite');
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password_hash TEXT, is_verified_customer INTEGER, verified_customer_at INTEGER, created_at INTEGER);
    CREATE TABLE sessions (id INTEGER PRIMARY KEY, user_id INTEGER, token_hash TEXT, created_at INTEGER, expires_at INTEGER);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, order_ref TEXT, user_id INTEGER, customer_email TEXT, customer_phone TEXT, amount_agorot INTEGER, currency TEXT, items_json TEXT, status TEXT, created_at INTEGER, paid_at INTEGER, updated_at INTEGER);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, user_id INTEGER, review_name TEXT, contact_phone TEXT, verified_purchase INTEGER, review_product_id TEXT, review_product_variant TEXT, rating INTEGER, body TEXT, review_date INTEGER, image_blob BLOB, image_mime TEXT, status TEXT, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE review_images (id INTEGER PRIMARY KEY, review_id INTEGER, sort_order INTEGER, image_blob BLOB, image_mime TEXT, media_kind TEXT, created_at INTEGER);
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT);
  `);
  db.prepare('INSERT INTO users VALUES (1,?,?,?,?,?,?)').run('User','user@example.com','hash',1,1234,1000);
  db.prepare('INSERT INTO sessions VALUES (1,1,?,?,?)').run('token',1001,999999);
  db.prepare('INSERT INTO orders VALUES (1,?,?,?,?,?,?,?,?,?,?,?)').run('ord-1',1,'user@example.com','0500000000',1234,'ILS','[]','paid',1100,1200,1200);
  db.prepare('INSERT INTO reviews VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(1,'לקוח VerSans','0500000000',1,'mom-heart-01',null,5,'מעולה',1300,null,null,'published',1300,1300);
  db.prepare('INSERT INTO review_images VALUES (1,1,0,?,?,?,?)').run(Buffer.from([0,1,255]),'image/png','image',1300);
  db.prepare("INSERT INTO schema_meta VALUES ('schema_version','8')").run();
  db.close();
  return { dir, file };
}

test('SQLite snapshot includes every persisted table and binary review media', () => {
  const fixture = makeFixture();
  try {
    const snapshot = snapshotSqlite(fixture.file);
    assert.deepEqual(Object.keys(snapshot), TABLES.map((t) => t.name));
    for (const table of ['users','sessions','orders','reviews','review_images','schema_meta']) assert.equal(snapshot[table].length, 1);
    assert.deepEqual(Buffer.from(snapshot.review_images[0].image_blob), Buffer.from([0,1,255]));
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('snapshot digest is deterministic and includes binary bytes exactly', () => {
  const one = {
    users: [], sessions: [], orders: [], reviews: [],
    review_images: [{ id: 1, review_id: 2, sort_order: 0, image_blob: Buffer.from([0, 1, 255]), image_mime: 'image/png', media_kind: 'image', created_at: 123 }],
    schema_meta: []
  };
  const two = structuredClone(one);
  two.review_images[0].image_blob = Buffer.from([0, 1, 254]);
  const d1 = snapshotDigests(one);
  const d2 = snapshotDigests(two);
  assert.notEqual(d1.review_images, d2.review_images);
  assert.equal(normalizeDigestValue(Buffer.from([0, 1, 255])), 'buffer:0001ff');
  assert.equal(normalizeDigestValue(Uint8Array.from([0, 1, 255])), 'buffer:0001ff');
  assert.match(d1.review_images, /^[a-f0-9]{64}$/);
  assert.equal(d1.review_images.length, crypto.createHash('sha256').digest('hex').length);
});
