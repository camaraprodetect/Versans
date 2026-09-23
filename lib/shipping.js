'use strict';

const crypto = require('node:crypto');

const TRACK_API_BASE = 'https://api.17track.net/track/v2.4';
const NOTIFY_STATUSES = new Set([
  'in_transit', 'arrived_country', 'ready_for_pickup', 'out_for_delivery',
  'delivery_failed', 'delivered', 'exception'
]);

function env(name, fallback = '') {
  const value = String(process.env[name] == null ? fallback : process.env[name]).trim();
  return value.replace(/^["']|["']$/g, '');
}

function normalizeTrackingNumber(value) {
  return String(value || '').trim().replace(/\s+/g, '').slice(0, 80);
}

function normalizeCarrierCode(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function inferCarrierCode(trackingNumber) {
  const number = normalizeTrackingNumber(trackingNumber).toUpperCase();
  // DSVPH numbers used by AliExpress/Cainiao in Israel are handled by
  // 17TRACK's dedicated "DSV e-Commerce IL" carrier.
  if (number.startsWith('DSVPH')) return 100298;
  return null;
}

function is17TrackConfigured() {
  return Boolean(env('VERSANS_17TRACK_API_KEY'));
}

async function trackRequest(endpoint, items, timeoutMs = 15000) {
  const key = env('VERSANS_17TRACK_API_KEY');
  if (!key) {
    const error = new Error('17track_not_configured');
    error.code = '17track_not_configured';
    throw error;
  }
  const response = await fetch(`${TRACK_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', '17token': key },
    body: JSON.stringify(items),
    signal: AbortSignal.timeout(timeoutMs)
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok) {
    const error = new Error(`17track_http_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload || {};
}

function registrationRejected(payload, trackingNumber) {
  const rejected = payload && payload.data && Array.isArray(payload.data.rejected) ? payload.data.rejected : [];
  return rejected.find((item) => normalizeTrackingNumber(item && item.number) === trackingNumber) || null;
}

async function register17Track(trackingNumber, carrierCode = null, options = {}) {
  const number = normalizeTrackingNumber(trackingNumber);
  const carrier = normalizeCarrierCode(carrierCode) || inferCarrierCode(number);
  const item = { number };
  if (carrier) item.carrier = carrier;
  const extra = options && typeof options === 'object' ? options : {};
  if (extra.destinationCountry) item.destination_country = String(extra.destinationCountry).trim().toUpperCase().slice(0, 2);
  if (extra.destinationPostalCode) item.destination_postal_code = String(extra.destinationPostalCode).trim().slice(0, 24);
  const payload = await trackRequest('register', [item]);
  const rejected = registrationRejected(payload, number);
  // Already registered / duplicate should not block local shipment creation.
  if (rejected && Number(rejected.error && rejected.error.code) !== -18019901) {
    const error = new Error((rejected.error && rejected.error.message) || '17track_registration_rejected');
    error.code = Number(rejected.error && rejected.error.code) || '17track_registration_rejected';
    error.payload = payload;
    throw error;
  }
  const accepted = payload && payload.data && Array.isArray(payload.data.accepted)
    ? payload.data.accepted.find((entry) => normalizeTrackingNumber(entry && entry.number) === number)
    : null;
  return { payload, carrierCode: normalizeCarrierCode(accepted && accepted.carrier) || carrier };
}

async function stop17Track(trackingNumber, carrierCode = null) {
  const item = { number: normalizeTrackingNumber(trackingNumber) };
  const carrier = normalizeCarrierCode(carrierCode) || inferCarrierCode(item.number);
  if (carrier) item.carrier = carrier;
  return trackRequest('stoptrack', [item]);
}

function trackingQueryItem(trackingNumber, carrierCode = null, options = {}) {
  const item = { number: normalizeTrackingNumber(trackingNumber) };
  const carrier = normalizeCarrierCode(carrierCode) || inferCarrierCode(item.number);
  if (carrier) item.carrier = carrier;
  const extra = options && typeof options === 'object' ? options : {};
  if (extra.destinationCountry) item.destination_country = String(extra.destinationCountry).trim().toUpperCase().slice(0, 2);
  if (extra.destinationPostalCode) item.destination_postal_code = String(extra.destinationPostalCode).trim().slice(0, 24);
  if (extra.cacheLevel === 0 || extra.cacheLevel === 1) item.cacheLevel = extra.cacheLevel;
  return item;
}

function acceptedTrackingEntry(payload, trackingNumber) {
  const number = normalizeTrackingNumber(trackingNumber);
  const accepted = payload && payload.data && Array.isArray(payload.data.accepted) ? payload.data.accepted : [];
  return accepted.find((entry) => normalizeTrackingNumber(entry && entry.number) === number) || null;
}

async function get17TrackInfo(trackingNumber, carrierCode = null) {
  const item = trackingQueryItem(trackingNumber, carrierCode);
  const payload = await trackRequest('gettrackinfo', [item]);
  return acceptedTrackingEntry(payload, item.number);
}

async function get17TrackRealTimeInfo(trackingNumber, carrierCode = null, options = {}) {
  // cacheLevel=0 is 17TRACK's Standard real-time refresh. It requests a fresh
  // carrier snapshot (up to ~3h cache) and costs 1 tracking quota, versus 10
  // quotas for cacheLevel=1/Instant. Use it only when adding a number or when
  // the admin explicitly presses Refresh.
  const extra = options && typeof options === 'object' ? options : {};
  const item = trackingQueryItem(trackingNumber, carrierCode, {
    ...extra,
    cacheLevel: extra.instant ? 1 : 0
  });
  const payload = await trackRequest('getRealTimeTrackInfo', [item], 35000);
  return acceptedTrackingEntry(payload, item.number);
}

function verify17TrackSignature(rawBody, signature) {
  const key = env('VERSANS_17TRACK_API_KEY');
  const sign = String(signature || '').trim().toLowerCase();
  if (!key || !sign || !/^[a-f0-9]{64}$/.test(sign)) return false;
  const expected = crypto.createHash('sha256').update(String(rawBody) + '/' + key, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sign, 'hex'));
  } catch (_) {
    return false;
  }
}

function canonicalShipmentStatus(mainStatus, subStatus) {
  const main = String(mainStatus || '').trim();
  const sub = String(subStatus || '').trim();
  if (main === 'Delivered') return 'delivered';
  if (main === 'OutForDelivery') return 'out_for_delivery';
  if (main === 'AvailableForPickup') return 'ready_for_pickup';
  if (main === 'DeliveryFailure') return 'delivery_failed';
  if (main === 'Exception' || main === 'Expired') return 'exception';
  if (main === 'InfoReceived') return 'info_received';
  if (main === 'InTransit') {
    if (['InTransit_Arrival', 'InTransit_CustomsProcessing', 'InTransit_CustomsReleased', 'InTransit_CustomsRequiringInformation'].includes(sub)) {
      return 'arrived_country';
    }
    return 'in_transit';
  }
  if (main === 'NotFound' || !main) return 'registered';
  return 'in_transit';
}

const STATUS_LABELS_HE = {
  registered: 'מספר המעקב נקלט',
  info_received: 'פרטי המשלוח התקבלו',
  in_transit: 'החבילה בדרך אליכם',
  arrived_country: 'החבילה הגיעה לישראל',
  ready_for_pickup: 'החבילה מוכנה לאיסוף',
  out_for_delivery: 'החבילה יצאה למסירה',
  delivery_failed: 'ניסיון המסירה לא הושלם',
  delivered: 'החבילה נמסרה',
  exception: 'נדרש טיפול במשלוח'
};

function shipmentStatusLabel(status) {
  return STATUS_LABELS_HE[String(status || '')] || 'עדכון במשלוח';
}

function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? Math.trunc(value) : Math.trunc(value * 1000);
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

function compact(value, max = 500) {
  const text = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function newestProviderEvent(trackInfo) {
  const tracking = trackInfo && trackInfo.tracking && typeof trackInfo.tracking === 'object' ? trackInfo.tracking : {};
  const providers = Array.isArray(tracking.providers) ? tracking.providers : [];
  const events = [];
  for (const provider of providers) {
    for (const event of Array.isArray(provider && provider.events) ? provider.events : []) {
      if (event && typeof event === 'object') events.push(event);
    }
  }
  events.sort((a, b) => (parseTimestamp(b.time_utc || b.time_iso) || 0) - (parseTimestamp(a.time_utc || a.time_iso) || 0));
  return events[0] || null;
}

function extractTrackingUpdate(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const trackInfo = entry.track_info && typeof entry.track_info === 'object' ? entry.track_info : {};
  const latestStatus = trackInfo.latest_status && typeof trackInfo.latest_status === 'object' ? trackInfo.latest_status : {};
  const directLatestEvent = trackInfo.latest_event && typeof trackInfo.latest_event === 'object' ? trackInfo.latest_event : null;
  const latestEvent = directLatestEvent || newestProviderEvent(trackInfo) || {};
  const metrics = trackInfo.time_metrics && typeof trackInfo.time_metrics === 'object' ? trackInfo.time_metrics : {};
  const eta = metrics.estimated_delivery_date && typeof metrics.estimated_delivery_date === 'object' ? metrics.estimated_delivery_date : {};
  const providerMainStatus = compact(latestStatus.status, 80);
  const providerSubStatus = compact(latestStatus.sub_status, 120);
  const mainStatus = compact((providerMainStatus && providerMainStatus !== 'NotFound') ? providerMainStatus : latestEvent.stage || providerMainStatus, 80);
  const subStatus = compact((providerMainStatus && providerMainStatus !== 'NotFound') ? providerSubStatus : latestEvent.sub_status || providerSubStatus, 120);
  const description = compact(
    latestEvent.description_translation && latestEvent.description_translation.description
      ? latestEvent.description_translation.description
      : latestEvent.description,
    700
  );
  const address = latestEvent.address && typeof latestEvent.address === 'object' ? latestEvent.address : {};
  const location = compact(latestEvent.location || [address.city, address.state, address.country].filter(Boolean).join(', '), 300);
  const status = canonicalShipmentStatus(mainStatus, subStatus);
  return {
    trackingNumber: normalizeTrackingNumber(entry.number),
    carrierCode: normalizeCarrierCode(entry.carrier),
    status,
    providerStatus: mainStatus,
    subStatus,
    latestEvent: description,
    latestLocation: location,
    latestEventAt: parseTimestamp(latestEvent.time_utc || latestEvent.time_iso),
    estimatedDeliveryFrom: parseTimestamp(eta.from),
    estimatedDeliveryTo: parseTimestamp(eta.to),
    deliveredAt: status === 'delivered' ? (parseTimestamp(latestEvent.time_utc || latestEvent.time_iso) || Date.now()) : null,
    rawJson: JSON.stringify(entry).slice(0, 250000)
  };
}

function extract17TrackUpdates(payload) {
  if (!payload || payload.event !== 'TRACKING_UPDATED') return [];
  const data = payload.data;
  const entries = Array.isArray(data)
    ? data
    : data && Array.isArray(data.accepted)
      ? data.accepted
      : data && typeof data === 'object'
        ? [data]
        : [];
  return entries.map(extractTrackingUpdate).filter((item) => item && item.trackingNumber);
}

function shouldNotifyStatus(status) {
  return NOTIFY_STATUSES.has(String(status || ''));
}

function normalizeWhatsAppPhone(value) {
  let phone = String(value || '').trim().replace(/[^\d+]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^0\d{8,9}$/.test(phone)) phone = '+972' + phone.slice(1);
  if (/^972\d{8,9}$/.test(phone)) phone = '+' + phone;
  if (!/^\+\d{9,15}$/.test(phone)) return '';
  return phone.slice(1);
}

function isWhatsAppConfigured(audience = 'customer') {
  const token = env('VERSANS_WHATSAPP_ACCESS_TOKEN');
  const phoneId = env('VERSANS_WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) return false;
  if (audience === 'admin') return Boolean(normalizeWhatsAppPhone(env('VERSANS_ADMIN_WHATSAPP')) && env('VERSANS_WHATSAPP_ADMIN_TEMPLATE'));
  return Boolean(env('VERSANS_WHATSAPP_SHIPPING_TEMPLATE'));
}

function whatsappConfig() {
  return {
    token: env('VERSANS_WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: env('VERSANS_WHATSAPP_PHONE_NUMBER_ID'),
    apiVersion: env('VERSANS_WHATSAPP_API_VERSION', 'v26.0'),
    customerTemplate: env('VERSANS_WHATSAPP_SHIPPING_TEMPLATE'),
    adminTemplate: env('VERSANS_WHATSAPP_ADMIN_TEMPLATE'),
    language: env('VERSANS_WHATSAPP_TEMPLATE_LANG', 'he'),
    adminPhone: normalizeWhatsAppPhone(env('VERSANS_ADMIN_WHATSAPP'))
  };
}

async function metaSend(payload) {
  const cfg = whatsappConfig();
  if (!cfg.token || !cfg.phoneNumberId) {
    const error = new Error('whatsapp_not_configured');
    error.code = 'whatsapp_not_configured';
    throw error;
  }
  const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(cfg.apiVersion)}/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  let body = null;
  try { body = await response.json(); } catch (_) { body = null; }
  if (!response.ok) {
    const error = new Error((body && body.error && body.error.message) || `whatsapp_http_${response.status}`);
    error.status = response.status;
    error.payload = body;
    throw error;
  }
  return { id: body && body.messages && body.messages[0] ? body.messages[0].id : null, body };
}

function templatePayload(to, templateName, language, parameters) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [{
        type: 'body',
        parameters: parameters.map((value) => ({ type: 'text', text: String(value == null ? '' : value).slice(0, 1000) }))
      }]
    }
  };
}

async function sendCustomerShippingWhatsApp({ phone, firstName, orderRef, statusLabel, trackingUrl }) {
  const cfg = whatsappConfig();
  const to = normalizeWhatsAppPhone(phone);
  if (!to || !cfg.customerTemplate) {
    const error = new Error(!to ? 'invalid_whatsapp_phone' : 'whatsapp_shipping_template_not_configured');
    error.code = error.message;
    throw error;
  }
  return metaSend(templatePayload(to, cfg.customerTemplate, cfg.language, [firstName || 'לקוח/ה', orderRef, statusLabel, trackingUrl]));
}

async function sendAdminShippingWhatsApp({ orderRef, statusLabel, trackingNumber, itemSummary }) {
  const cfg = whatsappConfig();
  if (!cfg.adminPhone || !cfg.adminTemplate) {
    const error = new Error(!cfg.adminPhone ? 'admin_whatsapp_not_configured' : 'whatsapp_admin_template_not_configured');
    error.code = error.message;
    throw error;
  }
  return metaSend(templatePayload(cfg.adminPhone, cfg.adminTemplate, cfg.language, [orderRef, statusLabel, trackingNumber, itemSummary || 'חבילה']));
}

module.exports = {
  normalizeTrackingNumber,
  normalizeCarrierCode,
  is17TrackConfigured,
  register17Track,
  stop17Track,
  get17TrackInfo,
  get17TrackRealTimeInfo,
  verify17TrackSignature,
  canonicalShipmentStatus,
  shipmentStatusLabel,
  extractTrackingUpdate,
  extract17TrackUpdates,
  shouldNotifyStatus,
  normalizeWhatsAppPhone,
  isWhatsAppConfigured,
  sendCustomerShippingWhatsApp,
  sendAdminShippingWhatsApp
};
