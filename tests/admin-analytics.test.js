'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeAdminRange,
  normalizeStoredOrderItems,
  aggregatePaidOrders
} = require('../lib/admin-analytics.js');

test('normalizeAdminRange supports today, 7d, 30d and all', () => {
  const now = Date.UTC(2026, 8, 16, 12, 0, 0);
  assert.equal(normalizeAdminRange('all', now).since, null);
  const today = normalizeAdminRange('today', now);
  assert.ok(today.since < now);
  assert.ok(today.since >= now - 24 * 60 * 60 * 1000);
  assert.equal(normalizeAdminRange('7d', now).since, now - 7 * 86400000);
  assert.equal(normalizeAdminRange('30d', now).since, now - 30 * 86400000);
  assert.equal(normalizeAdminRange('nope', now), null);
});

test('normalizeStoredOrderItems preserves line price snapshots', () => {
  const items = normalizeStoredOrderItems(JSON.stringify([
    { id: 'p1', qty: 2, name: 'Snapshot name', unitPrice: 80, lineTotal: 160, color: 'black' }
  ]), [{ id: 'p1', price: 90, title: { he: 'Current name' } }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'p1');
  assert.equal(items[0].qty, 2);
  assert.equal(items[0].unitPrice, 80);
  assert.equal(items[0].lineTotal, 160);
  assert.equal(items[0].name, 'Snapshot name');
  assert.equal(items[0].reconstructed, false);
});

test('normalizeStoredOrderItems reconstructs legacy catalog prices', () => {
  const items = normalizeStoredOrderItems(JSON.stringify([
    { id: 'p1', qty: 3 }
  ]), [{ id: 'p1', price: 42.5, title: { he: 'מוצר 1' } }]);
  assert.equal(items[0].unitPrice, 42.5);
  assert.equal(items[0].lineTotal, 127.5);
  assert.equal(items[0].reconstructed, true);
});

test('aggregatePaidOrders counts revenue, orders and units from paid rows passed by the caller', () => {
  const rows = [
    { id: 1, amount_agorot: 20000, paid_at: 1000, created_at: 900, items_json: JSON.stringify([{ id: 'p1', qty: 2, unitPrice: 80, lineTotal: 160 }]) },
    { id: 2, amount_agorot: 10000, paid_at: 2000, created_at: 1900, items_json: JSON.stringify([{ id: 'p2', qty: 1, unitPrice: 100, lineTotal: 100 }]) }
  ];
  const products = [
    { id: 'p1', price: 80, title: { he: 'מוצר 1' }, images: ['p1.png'] },
    { id: 'p2', price: 100, title: { he: 'מוצר 2' }, images: ['p2.png'] }
  ];
  const result = aggregatePaidOrders(rows, products, 3000, 'all');
  assert.equal(result.revenueAgorot, 30000);
  assert.equal(result.orderCount, 2);
  assert.equal(result.averageOrderAgorot, 15000);
  assert.equal(result.unitsSold, 3);
  assert.equal(result.products[0].id, 'p1');
  assert.equal(result.products[0].unitsSold, 2);
  assert.equal(result.products[0].paidOrderCount, 1);
  assert.equal(result.products[0].grossSalesAgorot, 16000);
});
