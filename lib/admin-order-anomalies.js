'use strict';

// Heuristic review signals only. No payment blocks or automatic order changes.
const { normalizeStoredOrderItems } = require('./admin-analytics');
const MINUTE = 60 * 1000;
const WINDOW_DUPLICATE = 30 * MINUTE;
const WINDOW_FAILURES = 30 * MINUTE;

function normalizeContact(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}
function normalizePhone(value) {
  let number = String(value || '').replace(/\D/g, '');
  if (number.startsWith('972') && number.length >= 11) number = '0' + number.slice(3);
  return number.length >= 9 && number.length <= 12 ? number : '';
}
function contactKey(row) {
  let stored = {};
  try { stored = JSON.parse(row.customer_json || '{}') || {}; } catch (_) {}
  const email = normalizeContact(row.customer_email || stored.email);
  const phone = normalizePhone(row.customer_phone || stored.phone);
  if (phone) return 'phone:' + phone;
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'email:' + email;
  if (Number(row.user_id) > 0) return 'user:' + Number(row.user_id);
  return '';
}
function signature(row) {
  let items = [];
  try { items = JSON.parse(row.items_json || '[]'); } catch (_) {}
  if (!Array.isArray(items) || !items.length) return '';
  const tokens = items.map(item => {
    if (!item || typeof item !== 'object' || !item.id) return '';
    // Variants and customizations matter: two different gift messages are not duplicates.
    const canonical = {};
    for (const key of Object.keys(item).sort()) {
      if (['image','selectedImage','name','selectedName','lineTotal','unitPrice','price','imageUrl'].includes(key)) continue;
      canonical[key] = item[key];
    }
    return JSON.stringify(canonical);
  }).filter(Boolean).sort();
  return tokens.length ? tokens.join('||') : '';
}
function safeTime(row) { return Number(row.created_at || 0); }
function computeSignals(rows, products = []) {
  const ascending = (Array.isArray(rows) ? rows : []).slice().sort((a,b) => safeTime(a) - safeTime(b) || Number(a.id) - Number(b.id));
  const lastMatching = new Map();
  const recentFailedByContact = new Map();
  const results = [];
  for (const row of ascending) {
    if (!row || !row.order_ref) continue;
    const status = String(row.status || '');
    const ref = String(row.order_ref);
    const created = safeTime(row);
    const amount = Number(row.amount_agorot);
    const customer = contactKey(row);
    const reasons = [];
    const add = (code, severity, text) => reasons.push({code, severity, text});

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      add('invalid_total', 'high', 'סכום ההזמנה אינו תקין (אפס או שלילי)');
    } else if (amount > 1_000_000) {
      add('unusually_high_total', 'medium', 'סכום גבוה במיוחד: מעל 10,000 ₪. יש לאמת את פרטי העסקה');
    }

    if (status === 'paid') {
      const items = normalizeStoredOrderItems(row.items_json, products);
      if (!items.length) add('empty_paid_order', 'high', 'התשלום אושר אך אין פריטים בהזמנה');
      else {
        const valid = items.every(i => !i.reconstructed && Number.isFinite(Number(i.lineTotal)) && Number(i.lineTotal) > 0);
        if (valid) {
          const listed = Math.round(items.reduce((sum,i) => sum + Number(i.lineTotal), 0) * 100);
          // Bundle promotions, free items, coupons, and historical pricing are legitimate.
          // Only compare when the discrepancy is far beyond normal promotions or rounding.
          if (listed >= 1000 && amount > listed * 1.5 && amount - listed > 10000)
            add('high_price_mismatch', 'high', 'סכום החיוב גבוה ביותר מ־50% מסכום הפריטים השמורים');
          if (listed >= 1000 && amount < listed * 0.45 && listed - amount > 10000)
            add('low_price_mismatch', 'high', 'סכום החיוב נמוך ביותר מ־55% מסכום הפריטים השמורים');
        }
      }
    }

    const fingerprint = signature(row);
    if (customer && fingerprint && Number.isSafeInteger(amount) && created > 0 && ['paid', 'pending'].includes(status)) {
      const key = customer + '|' + fingerprint + '|' + amount;
      const previous = lastMatching.get(key);
      if (previous && created >= previous.created && created - previous.created <= WINDOW_DUPLICATE && previous.ref !== ref) {
        if (status === 'paid' && previous.status === 'paid')
          add('duplicate_paid', 'high', `שתי הזמנות ששולמו עם אותם פריטים וסכום בתוך 30 דקות (הזמנה קודמת: ${previous.ref})`);
        else
          add('duplicate_checkout', 'medium', `הזמנה דומה של אותו לקוח בתוך 30 דקות (${previous.ref})`);
      }
      // Preserve the latest paid match when intervening checkout is pending.
      if (!previous || status === 'paid' || previous.status !== 'paid') lastMatching.set(key, {ref,status,created});
    }

    if (customer && created > 0) {
      const recent = (recentFailedByContact.get(customer) || []).filter(t => created >= t && created - t <= WINDOW_FAILURES);
      if (status === 'failed') {
        recent.push(created);
        if (recent.length >= 4) add('repeated_failed_payments', 'medium', `${recent.length} ניסיונות תשלום שנכשלו בתוך 30 דקות`);
      } else if (status === 'paid' && recent.length >= 4) {
        add('paid_after_failures', 'low', `תשלום הושלם אחרי ${recent.length} ניסיונות שנכשלו בתוך 30 דקות`);
      }
      recentFailedByContact.set(customer, recent);
    }

    if (!reasons.length) continue;
    const priority = {high:3,medium:2,low:1};
    const severity = reasons.reduce((best,r) => priority[r.severity] > priority[best] ? r.severity : best, 'low');
    results.push({
      orderRef:ref,
      createdAt:created,
      paidAt:row.paid_at == null ? null : Number(row.paid_at),
      status,
      amountAgorot:amount,
      customerName:String(row.user_name || row.guest_username || row.customer_email || 'לקוח').slice(0,120),
      severity,
      reasons
    });
  }
  return results.sort((a,b) => b.createdAt - a.createdAt);
}

const initialized = new WeakMap();
async function ensureTable(db) {
  if (!initialized.has(db)) {
    const promise = db.backend === 'postgres'
      ? db._query(`CREATE TABLE IF NOT EXISTS admin_order_anomaly_reviews (
          order_ref TEXT PRIMARY KEY, state TEXT NOT NULL CHECK (state IN ('reviewed','dismissed')),
          note TEXT NOT NULL DEFAULT '', updated_at BIGINT NOT NULL, updated_by TEXT NOT NULL)`)
      : Promise.resolve(db.db.exec(`CREATE TABLE IF NOT EXISTS admin_order_anomaly_reviews (
          order_ref TEXT PRIMARY KEY, state TEXT NOT NULL CHECK (state IN ('reviewed','dismissed')),
          note TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL)`));
    initialized.set(db, promise);
    promise.catch(() => initialized.delete(db));
  }
  await initialized.get(db);
}
async function getReviews(db) {
  await ensureTable(db);
  const sql = 'SELECT order_ref,state,note,updated_at,updated_by FROM admin_order_anomaly_reviews';
  const rows = db.backend === 'postgres' ? (await db._query(sql)).rows : db.db.prepare(sql).all();
  return new Map(rows.map(r=>[String(r.order_ref),{
    state:r.state,note:r.note||'',updatedAt:Number(r.updated_at||0),updatedBy:r.updated_by||''
  }]));
}
async function saveReview(db, ref, state, note, actor) {
  await ensureTable(db);
  if (state === 'open') {
    if (db.backend === 'postgres') await db._query('DELETE FROM admin_order_anomaly_reviews WHERE order_ref=$1',[ref]);
    else db.db.prepare('DELETE FROM admin_order_anomaly_reviews WHERE order_ref=?').run(ref);
    return;
  }
  const now=Date.now();
  if (db.backend === 'postgres') {
    await db._query(`INSERT INTO admin_order_anomaly_reviews(order_ref,state,note,updated_at,updated_by)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_ref) DO UPDATE SET
      state=EXCLUDED.state,note=EXCLUDED.note,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by`,[ref,state,note,now,actor]);
  } else {
    db.db.prepare(`INSERT INTO admin_order_anomaly_reviews(order_ref,state,note,updated_at,updated_by)
      VALUES(?,?,?,?,?) ON CONFLICT(order_ref) DO UPDATE SET
      state=excluded.state,note=excluded.note,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).run(ref,state,note,now,actor);
  }
}
module.exports = { computeSignals, getReviews, saveReview, contactKey, signature };
