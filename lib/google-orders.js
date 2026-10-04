'use strict';

const { PRODUCTS } = require('../assets/products.js');
const { priceOrder } = require('../api/_hyp.js');
const { absoluteUrl } = require('./email.js');
const { orderProductLink } = require('./order-product-links.js');
const { orderItemRef } = require('./order-item-refs.js');
const { selectedColorProductName, selectedColorProductImage } = require('./product-variant-identity.js');

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


function localLabel(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return String(value.he || value.en || value.id || '').trim();
  return String(value || '').trim();
}

function optionById(list, id) {
  if (!Array.isArray(list) || !id) return null;
  return list.find((entry) => String(entry && entry.id || '') === String(id || '')) || null;
}

function absoluteImage(path) {
  return path ? absoluteUrl(path) : '';
}

function normalizeSelectionEntry(type, option, prefix) {
  if (!option) return null;
  const label = localLabel(option.label || option.title || option.name || option.id);
  return {
    type,
    id: String(option.id || ''),
    label,
    text: (prefix ? prefix + ': ' : '') + label,
    imageUrl: absoluteImage(option.image || '')
  };
}

function sanitizeAssetDataUrl(dataUrl) {
  const text = String(dataUrl || '').trim();
  if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(text)) return '';
  return text;
}

function buildItemSelections(product, item) {
  const selections = [];
  const necklace = normalizeSelectionEntry('necklace', optionById(product && product.necklaces, item && item.necklace), 'דגם');
  const box = normalizeSelectionEntry('box', optionById(product && product.boxes, item && item.box), 'קופסה');
  const size = normalizeSelectionEntry('size', optionById(product && product.sizes, item && item.size), 'מידה');
  const color = normalizeSelectionEntry('color', optionById(product && product.colors, item && item.color), 'צבע');
  const packaging = normalizeSelectionEntry('packaging', optionById(product && product.giftPackaging && product.giftPackaging.options, item && item.packaging), 'אריזה');
  [necklace, box, size, color, packaging].forEach((entry) => { if (entry) selections.push(entry); });

  let selectionImageUrl = '';
  const optionImage = selections.find((entry) => entry && entry.imageUrl);
  if (optionImage) selectionImageUrl = optionImage.imageUrl;
  if (!selectionImageUrl && product && product.variantImages) {
    const keys = [
      [item && item.size, item && item.necklace, item && item.color].filter(Boolean).join('|'),
      [item && item.size, item && item.necklace].filter(Boolean).join('|'),
      [item && item.necklace, item && item.color].filter(Boolean).join('|')
    ].filter(Boolean);
    for (const key of keys) {
      if (product.variantImages[key]) {
        selectionImageUrl = absoluteImage(product.variantImages[key]);
        break;
      }
    }
  }

  return {
    selections,
    selectionsText: selections.map((entry) => entry.text).join(' | '),
    selectionImageUrl
  };
}

function buildGreetingSummary(greeting) {
  if (!greeting || typeof greeting !== 'object') return null;
  const parts = [
    greeting.eyebrow ? 'שורת עליונה: ' + String(greeting.eyebrow).trim() : '',
    greeting.title ? 'כותרת: ' + String(greeting.title).trim() : '',
    greeting.subtitle ? 'כותרת משנה: ' + String(greeting.subtitle).trim() : '',
    greeting.message ? 'טקסט: ' + String(greeting.message).trim() : '',
    greeting.signature ? 'חתימה: ' + String(greeting.signature).trim() : ''
  ].filter(Boolean);
  return {
    assetId: String(greeting.assetId || ''),
    fileName: String(greeting.imageFileName || greeting.pngFileName || greeting.fileName || ''),
    dataUrl: sanitizeAssetDataUrl(greeting.imageDataUrl),
    textSummary: parts.join(' | '),
    title: String(greeting.title || '').trim(),
    signature: String(greeting.signature || '').trim(),
    template: String(greeting.template || ''),
    fontKey: String(greeting.fontKey || '')
  };
}

function buildCustomPhotoSummary(customPhoto) {
  if (!customPhoto || typeof customPhoto !== 'object') return null;
  return {
    assetId: String(customPhoto.assetId || ''),
    fileName: String(customPhoto.imageFileName || customPhoto.fileName || ''),
    dataUrl: sanitizeAssetDataUrl(customPhoto.imageDataUrl)
  };
}

function buildPersonalizationText(item, greeting, customPhoto) {
  const parts = [];
  const customName = String(item && item.customName || '').trim();
  if (customName) parts.push('שם/טקסט: ' + customName);
  if (greeting && greeting.textSummary) parts.push('ברכה אישית: ' + String(greeting.textSummary));
  if (customPhoto && customPhoto.assetId) parts.push('הועלתה תמונת לקוח ✓');
  return parts.join(' | ');
}

function productCategoryKeys(product) {
  if (!product) return [];
  const values = [];
  if (product.category) values.push(String(product.category));
  if (Array.isArray(product.categories)) {
    product.categories.forEach((value) => values.push(String(value || '')));
  }
  return values.filter(Boolean);
}

function orderItemRequirements(product, item, greeting, customPhoto) {
  const categories = productCategoryKeys(product);
  const needsGreeting = Boolean(
    greeting
    || (item && item.greeting)
    || (product && product.greetingEditorEntry)
    || categories.includes('greeting')
  );
  const needsCustomPhoto = Boolean(
    customPhoto
    || (item && item.customPhoto)
    || (product && product.customPhoto)
    || categories.includes('photo-bracelets')
  );

  return {
    needsGreeting,
    needsCustomPhoto,
    needsPersonalization: Boolean(
      (item && String(item.customName || '').trim())
      || greeting
      || customPhoto
    )
  };
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
  const selectedProductName = selectedColorProductName(product, item, 'he') || String(item && (item.selectedName || item.name) || '') || localTitle(product);
  const selectedImagePath = selectedColorProductImage(product, item);
  const imagePath = selectedImagePath || (product && Array.isArray(product.images) && product.images.length ? product.images[0] : '');
  const selectionMeta = buildItemSelections(product, item);
  const customName = String(item && item.customName || '').trim();
  const greeting = buildGreetingSummary(item && item.greeting);
  const customPhoto = buildCustomPhotoSummary(item && item.customPhoto);
  const requirements = orderItemRequirements(product, item, greeting, customPhoto);

  return {
    itemOrderRef: orderItemRef(order.order_ref, index),
    productId: product ? String(product.id || '') : String(item && item.id || ''),
    productSlug: product ? String(product.slug || '') : '',
    productName: String(selectedProductName || (priced && priced.name) || localTitle(product) || (item && item.id) || ''),
    imageUrl: imagePath ? absoluteUrl(imagePath) : '',
    selectionImageUrl: (selectedImagePath ? absoluteUrl(selectedImagePath) : '') || selectionMeta.selectionImageUrl || '',
    selectionsText: selectionMeta.selectionsText || '',
    selections: selectionMeta.selections,
    customName,
    greeting,
    customPhoto,
    needsGreeting: requirements.needsGreeting,
    needsCustomPhoto: requirements.needsCustomPhoto,
    needsPersonalization: requirements.needsPersonalization,
    personalizationText: buildPersonalizationText(item, greeting, customPhoto),
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
    signal: AbortSignal.timeout(30000)
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

async function postGoogleOrdersEvent(payload, timeoutMs = 15000) {
  const cfg = googleOrdersConfig();
  if (!cfg.url || !cfg.secret) {
    return { ok: false, skipped: true, reason: 'google_orders_not_configured' };
  }

  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, secret: cfg.secret }),
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }

  if (!response.ok || data.ok === false) {
    const err = new Error(data && data.error ? String(data.error) : `google_orders_event_${response.status}`);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return { ok: true, data };
}

async function postGoogleOrdersStatus(payload) {
  return postGoogleOrdersEvent(payload, 15000);
}

async function fetchGoogleOrderSnapshots(orderDescriptors) {
  const source = Array.isArray(orderDescriptors) ? orderDescriptors.slice(0, 50) : [];

  const orders = source.map((entry) => {
    if (typeof entry === 'string') {
      return { orderRef: String(entry || '').trim(), items: [] };
    }

    const orderRef = String(entry && entry.orderRef || '').trim();
    const items = Array.isArray(entry && entry.items)
      ? entry.items.map((item) => ({
          itemIndex: Number(item && item.itemIndex || 0),
          productId: String(item && item.productId || ''),
          productSlug: String(item && item.productSlug || ''),
          productName: String(item && item.productName || ''),
          needsGreeting: item && item.needsGreeting === true,
          needsCustomPhoto: item && item.needsCustomPhoto === true,
          needsPersonalization: item && item.needsPersonalization === true
        }))
      : [];

    return { orderRef, items };
  }).filter((entry) => entry.orderRef);

  if (!orders.length) return { ok: true, data: { version: null, snapshots: {} } };

  return postGoogleOrdersEvent({
    event: 'get_order_snapshots',
    orders,
    orderRefs: orders.map((order) => order.orderRef)
  }, 20000);
}

async function pingGoogleOrdersSheet() {
  return postGoogleOrdersEvent({ event: 'ping' }, 10000);
}

async function sendGoogleOrderItemStatusToSheet(orderRef, itemIndex, completed) {
  return postGoogleOrdersStatus({
    event: 'item_status_update',
    orderRef: String(orderRef || '').trim(),
    itemIndex: Math.max(0, Number(itemIndex || 0)),
    completed: completed === true
  });
}

async function sendGoogleOrderStatusToSheet(orderRef, completed) {
  return postGoogleOrdersStatus({
    event: 'order_status_update',
    orderRef: String(orderRef || '').trim(),
    completed: completed === true
  });
}

module.exports = {
  googleOrdersConfig,
  isGoogleOrdersConfigured,
  buildPaidOrderPayload,
  sendPaidOrderToGoogleSheet,
  sendGoogleOrderItemStatusToSheet,
  sendGoogleOrderStatusToSheet,
  fetchGoogleOrderSnapshots,
  pingGoogleOrdersSheet
};
