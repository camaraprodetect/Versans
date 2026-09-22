'use strict';

const { PRODUCTS } = require('../assets/products.js');
const { priceOrder } = require('../api/_hyp.js');
const { absoluteUrl } = require('./email.js');
const { orderProductLink } = require('./order-product-links.js');

function googleOrdersConfig() {
  return {
    url: String(process.env.GOOGLE_ORDERS_WEBHOOK_URL || '').trim(),
    secret: String(process.env.GOOGLE_ORDERS_WEBHOOK_SECRET || '').trim()
  };
}

function isGoogleOrdersConfigured() {
  const cfg = googleOrdersConfig();
  return !!(cfg.url && cfg.secret);
}

function parseItems(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}


function parseObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function cleanCustomer(order) {
  const raw = parseObject(order && order.customer_json);
  const firstName = String(raw.firstName || '').trim();
  const lastName = String(raw.lastName || '').trim();
  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    email: String(raw.email || (order && order.customer_email) || '').trim(),
    phone: String(raw.phone || (order && order.customer_phone) || '').trim(),
    country: String(raw.country || '').trim(),
    city: String(raw.city || '').trim(),
    street: String(raw.street || '').trim(),
    houseNumber: String(raw.houseNumber || '').trim(),
    apartment: String(raw.apartment || '').trim(),
    entrance: String(raw.entrance || '').trim(),
    floor: String(raw.floor || '').trim(),
    zip: String(raw.zip || '').trim(),
    notes: String(raw.notes || '').trim()
  };
}

function localTitle(product) {
  if (!product) return '';
  const title = product.title;
  if (title && typeof title === 'object') return String(title.he || title.en || product.id || '');
  return String(title || product.id || '');
}

function buildPaidOrderPayload(order) {
  if (!order) throw new Error('google_orders_missing_order');

  const rawItems = parseItems(order.items_json);
  let pricedLines = [];
  try {
    pricedLines = rawItems.length ? priceOrder(rawItems, 'he').lines : [];
  } catch (err) {
    console.error('Google orders pricing fallback:', err && err.message ? err.message : err);
  }

  const items = rawItems.map((item, index) => {
    const product = PRODUCTS.find((candidate) => candidate.id === item.id) || null;
    const priced = pricedLines[index] || null;
    const qty = Math.min(20, Math.max(1, parseInt(item && item.qty, 10) || 1));
    const unitPrice = Number(priced && priced.price != null ? priced.price : (product && product.price) || 0);
    const imagePath = product && Array.isArray(product.images) && product.images.length ? product.images[0] : '';

    return {
      productId: product ? String(product.id || '') : String(item && item.id || ''),
      productSlug: product ? String(product.slug || '') : '',
      productName: String((priced && priced.name) || localTitle(product) || (item && item.id) || ''),
      imageUrl: imagePath ? absoluteUrl(imagePath) : '',
      unitPrice: Number.isFinite(unitPrice) ? Number(unitPrice.toFixed(2)) : 0,
      quantity: qty,
      lineTotal: Number.isFinite(unitPrice) ? Number((unitPrice * qty).toFixed(2)) : 0,
      productLink: orderProductLink(product)
    };
  }).filter((item) => item.productId || item.productName);

  const customer = cleanCustomer(order);

  return {
    event: 'paid_order',
    orderRef: String(order.order_ref || ''),
    createdAt: order.created_at ? new Date(Number(order.created_at)).toISOString() : null,
    paidAt: order.paid_at ? new Date(Number(order.paid_at)).toISOString() : null,
    currency: String(order.currency || 'ILS'),
    orderTotal: Number((Number(order.amount_agorot || 0) / 100).toFixed(2)),
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customer,
    items
  };
}

async function sendPaidOrderToGoogleSheet(order) {
  const cfg = googleOrdersConfig();
  if (!cfg.url || !cfg.secret) {
    return { ok: false, skipped: true, reason: 'google_orders_not_configured' };
  }

  const payload = buildPaidOrderPayload(order);
  payload.secret = cfg.secret;

  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: AbortSignal.timeout(6000)
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }

  if (!response.ok || data.ok === false) {
    const err = new Error(data && data.error ? String(data.error) : `google_orders_webhook_${response.status}`);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return { ok: true, data };
}

module.exports = {
  googleOrdersConfig,
  isGoogleOrdersConfigured,
  buildPaidOrderPayload,
  sendPaidOrderToGoogleSheet
};
