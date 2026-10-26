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
function addressKey(row) {
  let customer={};
  try { customer=JSON.parse(row.customer_json || '{}') || {}; } catch (_) {}
  const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[.,\-]/g,' ').replace(/\s+/g,' ').trim();
  const city=norm(customer.city),street=norm(customer.street),number=norm(customer.houseNumber);
  if (!city || !street || !number) return '';
  // Apartment is relevant: different apartments in one building are not the same delivery address.
  return [norm(customer.country||'ישראל'),city,street,number,norm(customer.apartment)].join('|');
}
const DEFAULT_RULES=Object.freeze({
  highOrderEnabled:false,highOrderAgorot:100000,
  minUnitPriceEnabled:false,minUnitPriceAgorot:1000,
  maxUnitPriceEnabled:false,maxUnitPriceAgorot:150000,
  addressOrders:3,failedAttempts:4
});
function validateRules(raw) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) return null;
  const out={...DEFAULT_RULES};
  for(const key of ['highOrderEnabled','minUnitPriceEnabled','maxUnitPriceEnabled']){
    if(Object.hasOwn(raw,key)){if(typeof raw[key]!=='boolean')return null;out[key]=raw[key];}
  }
  for(const [key,min,max] of [['highOrderAgorot',100,100000000],['minUnitPriceAgorot',1,1000000],['maxUnitPriceAgorot',100,100000000],['addressOrders',2,10],['failedAttempts',2,20]]){
    if(Object.hasOwn(raw,key)){
      const num=Number(raw[key]);if(!Number.isSafeInteger(num)||num<min||num>max)return null;out[key]=num;
    }
  }
  return out;
}
function safeTime(row) { return Number(row.created_at || 0); }
function computeSignals(rows, products = [], options = {}) {
  const rules=validateRules(options.rules||{}) || {...DEFAULT_RULES};
  const gateway=options.gatewayEvidence instanceof Map ? options.gatewayEvidence : new Map();
  const ascending = (Array.isArray(rows) ? rows : []).slice().sort((a,b) => safeTime(a) - safeTime(b) || Number(a.id) - Number(b.id));
  const lastMatching = new Map();
  const recentFailedByContact = new Map();
  const addressOrders=new Map();
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

    if (rules.highOrderEnabled && status==='paid' && amount > rules.highOrderAgorot)
      add('custom_high_order','medium',`הזמנה מעל הסף שהוגדר: ${(rules.highOrderAgorot/100).toFixed(2)} ₪`);
    const mismatch=gateway.get(ref);
    if(mismatch && Number.isSafeInteger(Number(mismatch.verified_amount_agorot)) &&
       Number(mismatch.verified_amount_agorot)!==amount){
      const diff=Math.abs(Number(mismatch.verified_amount_agorot)-amount);
      add('gateway_amount_mismatch','high',`פער בין סכום ההזמנה לסכום שאומת מול הסליקה: ${(diff/100).toFixed(2)} ₪ (סכום מאומת: ${(Number(mismatch.verified_amount_agorot)/100).toFixed(2)} ₪). נדרש בירור מול הספק`);
    }
    if (status === 'paid') {
      const items = normalizeStoredOrderItems(row.items_json, products);
      if (!items.length) add('empty_paid_order', 'high', 'התשלום אושר אך אין פריטים בהזמנה');
      else {
        for(const item of items){
          if(item.reconstructed)continue;
          const unit=Number(item.unitPrice);
          if(!Number.isFinite(unit) || unit<=0)continue; // zero-cost bundle gifts are normal
          if(rules.minUnitPriceEnabled && Math.round(unit*100)<rules.minUnitPriceAgorot)
            add('custom_low_unit_price','medium',`מחיר יחידה נמוך מהסף שנקבע: ${String(item.name||item.id).slice(0,75)} (${unit.toFixed(2)} ₪)`);
          if(rules.maxUnitPriceEnabled && Math.round(unit*100)>rules.maxUnitPriceAgorot)
            add('custom_high_unit_price','medium',`מחיר יחידה גבוה מהסף שנקבע: ${String(item.name||item.id).slice(0,75)} (${unit.toFixed(2)} ₪)`);
        }
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

    // Flag only multiple paid orders at the exact same normalized delivery address,
    // involving distinct customer identities within 72h. Family orders are possible.
    const location=addressKey(row);
    if(location && customer && status==='paid' && created>0){
      const prior=(addressOrders.get(location)||[]).filter(x=>created>=x.at && created-x.at<=72*60*MINUTE);
      const contacts=new Set([...prior.map(x=>x.customer),customer]);
      if(prior.length+1>=rules.addressOrders && contacts.size>=2){
        add('shared_shipping_address','medium',`${prior.length+1} הזמנות ששולמו לאותה כתובת בתוך 72 שעות, עם ${contacts.size} פרטי קשר שונים. נדרשת בדיקה ידנית`);
      }
      prior.push({at:created,customer});addressOrders.set(location,prior);
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
        if (recent.length >= rules.failedAttempts) add('repeated_failed_payments', 'medium', `${recent.length} ניסיונות תשלום רצופים שנכשלו בתוך 30 דקות`);
        recentFailedByContact.set(customer,recent);
      } else if (status === 'paid') {
        if (recent.length >= rules.failedAttempts) add('paid_after_failures','low',`התשלום הושלם אחרי ${recent.length} ניסיונות שנכשלו`);
        recentFailedByContact.delete(customer); // success breaks the consecutive failure streak
      } else {
        recentFailedByContact.set(customer,recent);
      }
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
// Separate review state from the legacy constrained table to preserve historical reviews.
// All sensitive changes use prepared parameters and never rewrite original orders.
const extraReady=new WeakMap();
async function ensureExtras(db){
  if(!extraReady.has(db)){
    const id=db.backend==='postgres'?'BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY':'INTEGER PRIMARY KEY AUTOINCREMENT';
    const queries=[
      `CREATE TABLE IF NOT EXISTS admin_order_anomaly_cases (order_ref TEXT PRIMARY KEY,state TEXT NOT NULL,assigned_user_id BIGINT,note TEXT NOT NULL DEFAULT '',updated_at BIGINT NOT NULL,updated_by TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS admin_order_anomaly_rules (id INTEGER PRIMARY KEY,settings_json TEXT NOT NULL,updated_at BIGINT NOT NULL,updated_by TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS admin_anomaly_gateway_evidence (order_ref TEXT PRIMARY KEY,verified_amount_agorot BIGINT NOT NULL,expected_amount_agorot BIGINT NOT NULL,observed_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS admin_anomaly_case_events (id ${id},order_ref TEXT NOT NULL,state TEXT NOT NULL,assigned_user_id BIGINT,note TEXT NOT NULL,actor TEXT NOT NULL,at BIGINT NOT NULL)`,
      'CREATE INDEX IF NOT EXISTS idx_anomaly_case_events_ref ON admin_anomaly_case_events(order_ref,at DESC)'
    ];
    const promise=(async()=>{for(const sql of queries){if(db.backend==='postgres')await db._query(sql);else db.db.exec(sql);}})();
    extraReady.set(db,promise);promise.catch(()=>extraReady.delete(db));
  }
  return extraReady.get(db);
}
async function query(db,sql,args=[]){
  if(db.backend==='postgres'){
    let i=0;const converted=sql.replace(/\?/g,()=>'$'+(++i));return (await db._query(converted,args)).rows||[];
  }
  const statement=db.db.prepare(sql);
  return /^\s*SELECT/i.test(sql)?statement.all(...args):statement.run(...args);
}
async function getRules(db){
  await ensureExtras(db);const rows=await query(db,'SELECT settings_json FROM admin_order_anomaly_rules WHERE id=1');
  if(!rows.length)return {...DEFAULT_RULES};
  try{return validateRules(JSON.parse(rows[0].settings_json))||{...DEFAULT_RULES};}catch(_){return {...DEFAULT_RULES};}
}
async function saveRules(db,input,actor){
  const rules=validateRules(input);if(!rules)throw new Error('invalid_anomaly_rules');
  await ensureExtras(db);
  await query(db,`INSERT INTO admin_order_anomaly_rules(id,settings_json,updated_at,updated_by) VALUES(1,?,?,?)
    ON CONFLICT(id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,[JSON.stringify(rules),Date.now(),actor]);
  return rules;
}
async function getCases(db){
  await ensureExtras(db);const rows=await query(db,'SELECT order_ref,state,assigned_user_id,note,updated_at,updated_by FROM admin_order_anomaly_cases');
  return new Map(rows.map(row=>[String(row.order_ref),{state:row.state,note:row.note||'',assignedUserId:row.assigned_user_id==null?null:Number(row.assigned_user_id),updatedAt:Number(row.updated_at),updatedBy:row.updated_by||''}]));
}
async function saveCase(db,ref,state,note,assignedUserId,actor){
  if(!['open','reviewed','dismissed','confirmed','false_positive'].includes(state))throw new Error('invalid_anomaly_review');
  await ensureExtras(db);const at=Date.now();
  // Explicit open state shadows any old legacy review rather than destroying it.
  await query(db,`INSERT INTO admin_order_anomaly_cases(order_ref,state,assigned_user_id,note,updated_at,updated_by) VALUES(?,?,?,?,?,?)
    ON CONFLICT(order_ref) DO UPDATE SET state=excluded.state,assigned_user_id=excluded.assigned_user_id,note=excluded.note,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,[ref,state,assignedUserId,note,at,actor]);
  await query(db,'INSERT INTO admin_anomaly_case_events(order_ref,state,assigned_user_id,note,actor,at) VALUES(?,?,?,?,?,?)',[ref,state,assignedUserId,note,actor,at]);
}
async function caseHistory(db,ref){await ensureExtras(db);const rows=await query(db,'SELECT state,assigned_user_id,note,actor,at FROM admin_anomaly_case_events WHERE order_ref=? ORDER BY at DESC,id DESC LIMIT 50',[ref]);return rows.map(r=>({state:r.state,assignedUserId:r.assigned_user_id,actor:r.actor,at:Number(r.at),note:r.note}));}
async function getGatewayEvidence(db){await ensureExtras(db);const rows=await query(db,'SELECT order_ref,verified_amount_agorot,expected_amount_agorot,observed_at FROM admin_anomaly_gateway_evidence');return new Map(rows.map(r=>[String(r.order_ref),r]));}
async function recordGatewayMismatch(db,orderRef,verified,expected){
  if(!Number.isSafeInteger(verified)||verified<0||!Number.isSafeInteger(expected)||verified===expected)return;
  await ensureExtras(db);
  await query(db,`INSERT INTO admin_anomaly_gateway_evidence(order_ref,verified_amount_agorot,expected_amount_agorot,observed_at) VALUES(?,?,?,?)
    ON CONFLICT(order_ref) DO UPDATE SET verified_amount_agorot=excluded.verified_amount_agorot,expected_amount_agorot=excluded.expected_amount_agorot,observed_at=excluded.observed_at`,[orderRef,verified,expected,Date.now()]);
}
module.exports = {computeSignals,getReviews,saveReview,contactKey,signature,addressKey,DEFAULT_RULES,validateRules,getRules,saveRules,getCases,saveCase,caseHistory,getGatewayEvidence,recordGatewayMismatch};
