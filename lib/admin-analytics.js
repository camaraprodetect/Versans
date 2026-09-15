'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'Asia/Jerusalem';

function timeZoneParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const out = {};
  for (const part of parts) if (part.type !== 'literal') out[part.type] = Number(part.value);
  return out;
}

function timeZoneOffsetMs(date, timeZone = TIME_ZONE) {
  const p = timeZoneParts(date, timeZone);
  const representedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function israelStartOfDayMs(now) {
  const p = timeZoneParts(new Date(now), TIME_ZONE);
  const localMidnightAsUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  let guess = localMidnightAsUtc - timeZoneOffsetMs(new Date(localMidnightAsUtc), TIME_ZONE);
  guess = localMidnightAsUtc - timeZoneOffsetMs(new Date(guess), TIME_ZONE);
  return guess;
}

function normalizeAdminRange(range, now = Date.now()) {
  const value = String(range || '30d');
  if (value === 'all') return { range: value, since: null };
  if (value === 'today') return { range: value, since: israelStartOfDayMs(now) };
  if (value === '7d') return { range: value, since: now - 7 * DAY_MS };
  if (value === '30d') return { range: value, since: now - 30 * DAY_MS };
  return null;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function productTitle(product) {
  if (!product) return '';
  if (typeof product.title === 'string') return product.title;
  return (product.title && (product.title.he || product.title.en)) || product.name || product.id || '';
}

function productImage(product) {
  if (!product) return null;
  if (Array.isArray(product.images) && product.images.length) return product.images[0];
  if (product.image) return product.image;
  return null;
}

function normalizeStoredOrderItems(itemsJson, products = []) {
  let raw = [];
  try {
    const parsed = typeof itemsJson === 'string' ? JSON.parse(itemsJson || '[]') : itemsJson;
    raw = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    raw = [];
  }
  const productMap = new Map((Array.isArray(products) ? products : []).map((product) => [String(product.id), product]));
  return raw.map((item) => {
    const source = item && typeof item === 'object' ? item : {};
    const id = String(source.id || source.productId || '');
    const product = productMap.get(id) || null;
    const qty = Math.max(1, Math.min(999, Math.trunc(safeNumber(source.qty, 1)) || 1));
    const hasSnapshotPrice = Number.isFinite(Number(source.unitPrice));
    const catalogPrice = safeNumber(product && product.price, 0);
    const unitPrice = hasSnapshotPrice ? safeNumber(source.unitPrice, 0) : catalogPrice;
    const hasSnapshotLine = Number.isFinite(Number(source.lineTotal));
    const lineTotal = hasSnapshotLine ? safeNumber(source.lineTotal, unitPrice * qty) : unitPrice * qty;
    return {
      ...source,
      id,
      qty,
      name: String(source.name || productTitle(product) || id || 'מוצר'),
      image: source.image || productImage(product),
      unitPrice,
      lineTotal,
      reconstructed: !(hasSnapshotPrice && hasSnapshotLine)
    };
  }).filter((item) => item.id);
}

function israelDateKey(timestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(timestamp));
  const values = {};
  for (const part of parts) if (part.type !== 'literal') values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

function aggregatePaidOrders(rows, products = [], now = Date.now(), range = '30d') {
  const orders = Array.isArray(rows) ? rows : [];
  let revenueAgorot = 0;
  let unitsSold = 0;
  const productMap = new Map();
  const dayMap = new Map();

  for (const row of orders) {
    const amountAgorot = Math.round(safeNumber(row.amount_agorot, 0));
    revenueAgorot += amountAgorot;
    const timestamp = safeNumber(row.paid_at, 0) || safeNumber(row.created_at, now);
    const dayKey = israelDateKey(timestamp);
    const day = dayMap.get(dayKey) || { date: dayKey, revenueAgorot: 0, orders: 0, unitsSold: 0 };
    day.revenueAgorot += amountAgorot;
    day.orders += 1;

    const seenInOrder = new Set();
    const items = normalizeStoredOrderItems(row.items_json, products);
    for (const item of items) {
      unitsSold += item.qty;
      day.unitsSold += item.qty;
      const current = productMap.get(item.id) || {
        id: item.id,
        name: item.name,
        image: item.image || null,
        unitsSold: 0,
        paidOrderCount: 0,
        grossSalesAgorot: 0,
        reconstructedRows: 0
      };
      current.unitsSold += item.qty;
      current.grossSalesAgorot += Math.round(item.lineTotal * 100);
      if (item.reconstructed) current.reconstructedRows += 1;
      if (!seenInOrder.has(item.id)) {
        current.paidOrderCount += 1;
        seenInOrder.add(item.id);
      }
      productMap.set(item.id, current);
    }
    dayMap.set(dayKey, day);
  }

  const productRows = Array.from(productMap.values()).sort((a, b) =>
    b.unitsSold - a.unitsSold || b.paidOrderCount - a.paidOrderCount || b.grossSalesAgorot - a.grossSalesAgorot || a.name.localeCompare(b.name, 'he')
  ).map((product, index) => ({ ...product, rank: index + 1 }));
  const dailySales = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    range,
    revenueAgorot,
    orderCount: orders.length,
    averageOrderAgorot: orders.length ? Math.round(revenueAgorot / orders.length) : 0,
    unitsSold,
    dailySales,
    products: productRows
  };
}

module.exports = {
  normalizeAdminRange,
  normalizeStoredOrderItems,
  aggregatePaidOrders,
  israelStartOfDayMs,
  israelDateKey
};
