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

test('visitor retention cleanup removes old page views but preserves lifetime visitor rows', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-retention-'));
  const sqlitePath = path.join(dir, 'test.sqlite');
  const db = createDatabase({ sqlitePath, databaseUrl: '' });
  try {
    await db.init();
    const old = Date.now() - 120 * 24 * 60 * 60 * 1000;
    await db.recordPresence({
      visitorId: '11111111-1111-4111-8111-111111111111', userId: null, kind: 'pageview', now: old,
      path: '/old', title: 'Old', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null,
      utmTerm: null, utmContent: null, language: 'he', browser: 'Test', os: 'Test', deviceType: 'desktop',
      screenWidth: 1000, screenHeight: 800, viewportWidth: 900, viewportHeight: 700
    });
    const removed = await db.cleanupPresencePageViews(Date.now() - 90 * 24 * 60 * 60 * 1000);
    assert.equal(removed, 1);
    assert.equal(await db.countPresenceVisitors(null), 1);
    const detail = await db.getPresenceVisitor('11111111-1111-4111-8111-111111111111', 20);
    assert.equal(detail.pageViews.length, 0);
  } finally {
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('visitor listing supports all-time pagination', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-visitors-'));
  const sqlitePath = path.join(dir, 'test.sqlite');
  const db = createDatabase({ sqlitePath, databaseUrl: '' });
  try {
    await db.init();
    for (let index = 0; index < 3; index += 1) {
      await db.recordPresence({
        visitorId: `22222222-2222-4222-8222-22222222222${index}`, userId: null, kind: 'heartbeat', now: 1000 + index,
        path: '/', title: 'Home', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null,
        utmTerm: null, utmContent: null, language: 'he', browser: 'Test', os: 'Test', deviceType: 'mobile',
        screenWidth: 390, screenHeight: 844, viewportWidth: 390, viewportHeight: 700
      });
    }
    assert.equal(await db.countPresenceVisitors(null), 3);
    const page = await db.listPresenceVisitors(null, 2, 1);
    assert.equal(page.length, 2);
    assert.ok(Number(page[0].last_seen) >= Number(page[1].last_seen));
  } finally {
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('admin analytics queries use paid orders for customer totals and expose no password hashes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-admin-db-'));
  const sqlitePath = path.join(dir, 'test.sqlite');
  const db = createDatabase({ sqlitePath, databaseUrl: '' });
  try {
    await db.init();
    const user1 = await db.insertUser('Buyer', 'buyer@example.com', 'secret-hash', 1000);
    const user2 = await db.insertUser('Viewer', 'viewer@example.com', 'other-hash', 1100);
    await db.insertPendingOrder({ orderRef: 'paid-1', userId: user1, customerEmail: 'buyer@example.com', customerPhone: '+972500000001', amountAgorot: 19990, currency: 'ILS', itemsJson: JSON.stringify([{ id: 'p1', qty: 2, unitPrice: 50, lineTotal: 100 }]), createdAt: 2000, updatedAt: 2000 });
    await db.markOrderPaid(2100, 1);
    await db.insertPendingOrder({ orderRef: 'pending-1', userId: user1, customerEmail: 'buyer@example.com', customerPhone: '+972500000001', amountAgorot: 9990, currency: 'ILS', itemsJson: '[]', createdAt: 2200, updatedAt: 2200 });
    await db.insertPendingOrder({ orderRef: 'failed-1', userId: user2, customerEmail: 'viewer@example.com', customerPhone: '+972500000002', amountAgorot: 5000, currency: 'ILS', itemsJson: '[]', createdAt: 2300, updatedAt: 2300 });
    await db.markOrderFailed(2400, 3);

    const paid = await db.listOrdersForAnalytics('paid', null);
    assert.equal(paid.length, 1);
    assert.equal(paid[0].order_ref, 'paid-1');

    const counts = await db.adminUserCounts();
    assert.equal(counts.registeredUsers, 2);
    assert.equal(counts.payingCustomers, 1);

    assert.equal(await db.countAdminOrders({ status: 'all', since: null }), 3);
    assert.equal((await db.listAdminOrders({ status: 'paid', since: null, limit: 10, offset: 0 })).length, 1);

    const customers = await db.listAdminCustomers(10, 0);
    const buyer = customers.find((row) => row.email === 'buyer@example.com');
    assert.equal(Number(buyer.paid_order_count), 1);
    assert.equal(Number(buyer.paid_spend_agorot), 19990);
    assert.equal(Number(buyer.last_paid_at), 2100);
    assert.equal(buyer.known_phone, '+972500000001');
    assert.equal(Object.prototype.hasOwnProperty.call(buyer, 'password_hash'), false);
    assert.equal(await db.countAdminCustomers(), 2);
  } finally {
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('admin traffic and review summaries return grouped read-only analytics', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-admin-summary-'));
  const sqlitePath = path.join(dir, 'test.sqlite');
  const db = createDatabase({ sqlitePath, databaseUrl: '' });
  try {
    await db.init();
    const userId = await db.insertUser('Reviewer', 'reviewer@example.com', 'hash', 1000);
    await db.recordPresence({
      visitorId: '33333333-3333-4333-8333-333333333333', userId, kind: 'pageview', now: 2000,
      path: '/product-a', title: 'A', referrer: 'https://google.com/search', utmSource: 'google', utmMedium: 'cpc', utmCampaign: null,
      utmTerm: null, utmContent: null, language: 'he', browser: 'Chrome', os: 'Windows', deviceType: 'desktop',
      screenWidth: 1920, screenHeight: 1080, viewportWidth: 1200, viewportHeight: 800
    });
    await db.recordPresence({
      visitorId: '33333333-3333-4333-8333-333333333333', userId, kind: 'pageview', now: 3000,
      path: '/product-a', title: 'A2', referrer: null, utmSource: 'google', utmMedium: 'cpc', utmCampaign: null,
      utmTerm: null, utmContent: null, language: 'he', browser: 'Chrome', os: 'Windows', deviceType: 'desktop',
      screenWidth: 1920, screenHeight: 1080, viewportWidth: 1200, viewportHeight: 800
    });
    await db.insertReview({ userId, reviewName: 'לקוח VerSans', contactPhone: '+972500000003', reviewProductId: 'p1', reviewProductVariant: null, rating: 5, body: 'מצוין', reviewDate: 4000, createdAt: 4000, updatedAt: 4000 });
    await db.insertReview({ userId, reviewName: 'לקוח VerSans', contactPhone: '+972500000003', reviewProductId: 'p1', reviewProductVariant: null, rating: 4, body: 'טוב', reviewDate: 5000, createdAt: 5000, updatedAt: 5000 });

    const traffic = await db.adminTrafficSummary(null);
    assert.equal(traffic.pageViews, 2);
    assert.equal(traffic.topPages[0].label, '/product-a');
    assert.equal(Number(traffic.topPages[0].count), 2);
    assert.equal(traffic.devices[0].label, 'desktop');

    const reviews = await db.adminReviewSummary(null, 10);
    assert.equal(Number(reviews.summary.count), 2);
    assert.equal(Number(reviews.summary.rating_5), 1);
    assert.equal(Number(reviews.summary.rating_4), 1);
    assert.equal(Number(reviews.topProducts[0].count), 2);
    assert.equal(reviews.recent.length, 2);
  } finally {
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
