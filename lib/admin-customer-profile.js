'use strict';

// Read-only CRM profile over existing records. Never infer identity from phone numbers.
function createAdminCustomerProfile(database) {
  const pg = database.backend === 'postgres';
  const q = (n) => pg ? '$' + n : '?';
  async function rows(sql, params = []) {
    if (pg) return (await database._query(sql, params)).rows;
    return database.db.prepare(sql).all(...params);
  }
  const one = async (sql, params = []) => (await rows(sql, params))[0] || null;
  const n = (v) => Number(v || 0);
  const stamp = (v) => v == null ? null : n(v);

  async function profile(userId, { orderOffset = 0, orderLimit = 30, seeOrders = false, seeVisits = false } = {}) {
    if (!Number.isSafeInteger(userId) || userId < 1) return null;
    const user = await one(`SELECT id,name,email,phone,role,is_blocked,blocked_reason,created_at,
      marketing_email_opt_in,marketing_sms_opt_in,marketing_whatsapp_opt_in,is_verified_customer,verified_customer_at
      FROM users WHERE id=${q(1)} LIMIT 1`, [userId]);
    if (!user) return null;
    const ownEmail = String(user.email || '').trim().toLowerCase();
    // Existing checkout supports both account orders and guest orders linked by the same email.
    // A guest order is shown as "linked by email" so the relationship is never overstated.
    const orderWhere = `(o.user_id=${q(1)} OR (o.user_id IS NULL AND LOWER(TRIM(o.customer_email))=${q(2)}))`;
    let orders = [], orderCount = 0, paidOrderCount = 0, paidSpendAgorot = 0, lastPaidAt = null;
    if (seeOrders) {
      const stats = await one(`SELECT COUNT(*) AS order_count,
        COALESCE(SUM(CASE WHEN o.status='paid' THEN 1 ELSE 0 END),0) AS paid_count,
        COALESCE(SUM(CASE WHEN o.status='paid' THEN o.amount_agorot ELSE 0 END),0) AS paid_sum,
        MAX(CASE WHEN o.status='paid' THEN COALESCE(o.paid_at,o.created_at) END) AS last_paid
        FROM orders o WHERE ${orderWhere}`, [userId, ownEmail]);
      orderCount = n(stats && stats.order_count);
      paidOrderCount = n(stats && stats.paid_count);
      paidSpendAgorot = n(stats && stats.paid_sum);
      lastPaidAt = stamp(stats && stats.last_paid);
      const paged = await rows(`SELECT o.order_ref,o.user_id,o.status,o.amount_agorot,o.currency,o.items_json,o.created_at,o.paid_at,o.updated_at
        FROM orders o WHERE ${orderWhere}
        ORDER BY COALESCE(o.paid_at,o.created_at) DESC,o.id DESC LIMIT ${q(3)} OFFSET ${q(4)}`,
        [userId, ownEmail, Math.min(50,Math.max(1,orderLimit)), Math.max(0,orderOffset)]);
      orders = paged.map(o => {
        let items = [];
        try { const parsed = JSON.parse(o.items_json || '[]'); if (Array.isArray(parsed)) items = parsed.slice(0,60).map(x => ({ title: String(x.title || x.name || x.productName || 'מוצר').slice(0,140), quantity: n(x.quantity || x.qty || 1) })); } catch (_) { /* malformed historical order */ }
        return { orderRef:o.order_ref, status:o.status, amountAgorot:n(o.amount_agorot), currency:o.currency,
          createdAt:stamp(o.created_at), paidAt:stamp(o.paid_at), updatedAt:stamp(o.updated_at),
          linkType: n(o.user_id) === userId ? 'account' : 'email', items };
      });
    }
    const [coupons, reviews, requests, visits, recentViews, login] = await Promise.all([
      rows(`SELECT code,kind,discount_percent,active,created_at,expires_at,used_at,used_order_ref
        FROM coupons WHERE user_id=${q(1)} ORDER BY created_at DESC,id DESC LIMIT 75`,[userId]),
      rows(`SELECT id,review_product_id,rating,body,status,created_at,updated_at
        FROM reviews WHERE user_id=${q(1)} ORDER BY created_at DESC,id DESC LIMIT 75`,[userId]),
      rows(`SELECT request_ref,order_ref,request_type,status,created_at,updated_at
        FROM cancellation_requests WHERE user_id=${q(1)} ORDER BY created_at DESC,id DESC LIMIT 75`,[userId]),
      seeVisits ? rows(`SELECT visitor_id,first_seen,last_seen,traffic_source,utm_source,device_type,visit_count,page_view_count
        FROM visitor_presence WHERE user_id=${q(1)} ORDER BY last_seen DESC LIMIT 30`,[userId]) : Promise.resolve([]),
      seeVisits ? rows(`SELECT path,title,viewed_at FROM visitor_page_views WHERE user_id=${q(1)}
        ORDER BY viewed_at DESC,id DESC LIMIT 100`,[userId]) : Promise.resolve([]),
      one(`SELECT MAX(created_at) AS last_login FROM sessions WHERE user_id=${q(1)}`,[userId])
    ]);
    // This activity feed represents recorded events, not every action on the site.
    const activity = [{type:'registration', at:n(user.created_at)}];
    if (login && login.last_login) activity.push({type:'login',at:n(login.last_login)});
    for (const c of coupons) {
      activity.push({type:'coupon_created',at:n(c.created_at),label:String(c.code||'').slice(0,55)});
      if(c.used_at)activity.push({type:'coupon_used',at:n(c.used_at),label:String(c.code||'').slice(0,55),orderRef:c.used_order_ref||null});
    }
    for(const r of reviews)activity.push({type:'review',at:n(r.created_at),label:String(r.review_product_id||'').slice(0,110),rating:n(r.rating)});
    for(const r of requests)activity.push({type:'request',at:n(r.created_at),label:r.request_type,orderRef:r.order_ref||null});
    for(const v of recentViews)activity.push({type:'page_view',at:n(v.viewed_at),label:String(v.title||v.path||'').slice(0,200),path:String(v.path||'').slice(0,200)});
    if (seeOrders) for(const o of orders)activity.push({type:o.status==='paid'?'paid_order':'order',at:n(o.paidAt||o.createdAt),label:o.status,orderRef:o.orderRef});
    activity.sort((a,b)=>b.at-a.at);
    return {
      customer:{id:n(user.id),name:user.name||null,email:user.email||null,phone:user.phone||null,
        role:user.role||'customer',blocked:n(user.is_blocked)===1,blockedReason:user.blocked_reason||null,
        registeredAt:stamp(user.created_at),verified:n(user.is_verified_customer)===1,verifiedAt:stamp(user.verified_customer_at),
        marketing:{email:n(user.marketing_email_opt_in)===1,sms:n(user.marketing_sms_opt_in)===1,whatsapp:n(user.marketing_whatsapp_opt_in)===1}},
      permissions:{orders:!!seeOrders,visits:!!seeVisits},
      summary:{orderCount,paidOrderCount,paidSpendAgorot,lastPaidAt,couponCount:coupons.length,reviewCount:reviews.length,
        visitorCount:visits.length,lastSeenAt:visits.length?n(visits[0].last_seen):null},
      orders:{items:orders,offset:orderOffset,limit:orderLimit,count:orderCount,hasMore:orderOffset+orders.length<orderCount},
      coupons:coupons.map(c=>({code:c.code,kind:c.kind,percent:n(c.discount_percent),active:n(c.active)===1,createdAt:stamp(c.created_at),expiresAt:stamp(c.expires_at),usedAt:stamp(c.used_at),orderRef:c.used_order_ref||null})),
      reviews:reviews.map(r=>({id:n(r.id),product:r.review_product_id||null,rating:n(r.rating),body:String(r.body||'').slice(0,500),status:r.status,createdAt:stamp(r.created_at)})),
      requests:requests.map(r=>({requestRef:r.request_ref,orderRef:r.order_ref,type:r.request_type,status:r.status,createdAt:stamp(r.created_at)})),
      visits:visits.map(v=>({visitorId:v.visitor_id,firstSeenAt:stamp(v.first_seen),lastSeenAt:stamp(v.last_seen),source:v.traffic_source||v.utm_source||null,device:v.device_type||null,visitCount:n(v.visit_count),pageViews:n(v.page_view_count)})),
      activity:activity.slice(0,150),activityIsSample:true
    };
  }
  return { profile };
}

module.exports = { createAdminCustomerProfile };
