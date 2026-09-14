'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createDatabase } = require('../lib/database.js');

test('SQLite store exposes async app-level operations and preserves blobs', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-db-'));
  const sqlitePath = path.join(dir, 'test.sqlite');
  const db = createDatabase({ sqlitePath, databaseUrl: '' });
  try {
    assert.equal(db.backend, 'sqlite');
    await db.init();
    const userId = await db.insertUser('Test User', 'Test@Example.com', 'hash', 1000);
    assert.equal(userId, 1);
    const user = await db.findUserByEmail('test@example.com');
    assert.equal(user.email, 'Test@Example.com');

    await db.insertSession(userId, 'token-hash', 1000, 5000);
    const sessionUser = await db.findPublicUserBySession('token-hash', 2000);
    assert.equal(sessionUser.id, userId);

    const reviewId = await db.insertReview({
      userId,
      reviewName: 'לקוח VerSans',
      contactPhone: '0500000000',
      reviewProductId: 'mom-heart-01',
      reviewProductVariant: null,
      rating: 5,
      body: 'מעולה',
      reviewDate: 1500,
      createdAt: 1600,
      updatedAt: 1600
    });
    await db.insertReviewMedia(reviewId, 0, Buffer.from([0, 1, 2, 255]), 'image/png', 'image', 1600);
    const media = await db.getReviewMedia(reviewId, 0);
    assert.deepEqual(Buffer.from(media.image_blob), Buffer.from([0, 1, 2, 255]));

    await db.insertPendingOrder({
      orderRef: 'order-1', userId, customerEmail: 'test@example.com', customerPhone: '0500000000',
      amountAgorot: 1234, currency: 'ILS', itemsJson: '[]', createdAt: 1700, updatedAt: 1700
    });
    const order = await db.getOrderByRef('order-1');
    assert.equal(order.amount_agorot, 1234);
  } finally {
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('createDatabase selects postgres whenever DATABASE_URL is provided', async () => {
  const fakePool = { query: async () => ({ rows: [] }), end: async () => {} };
  const db = createDatabase({ databaseUrl: 'postgresql://example/db', pgPool: fakePool });
  assert.equal(db.backend, 'postgres');
  await db.close();
});
