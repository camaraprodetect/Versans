'use strict';
// Existing promotions were implemented before /admin/marketing. Expose them as
// read-only inventory: never silently copy, enable, disable or overwrite them.
const fs = require('node:fs');
const path = require('node:path');

function extractAttr(markup, attr) {
  const match = new RegExp('(?:\\s|^)'+attr+'="([^"]*)"', 'i').exec(markup || '');
  return match ? match[1] : '';
}
function assetUrl(src) {
  const value = String(src || '').trim();
  if (!value || /^\/\//.test(value) || /^(?:data|javascript):/i.test(value)) return '';
  return value.startsWith('/') ? value : '/' + value.replace(/^\.\//, '');
}
function mediaInventory(root = path.join(__dirname, '..')) {
  const script = fs.readFileSync(path.join(root, 'assets/promo-popups.js'), 'utf8');
  const popups = [];
  // The legacy video engine keeps this declaration in its `offers` map.
  const offerMatch = /var offers\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(script);
  if (offerMatch) {
    const re = /\b([A-Za-z][A-Za-z0-9]*):\s*\{headline:'([^']*)',detail:'([^']*)',video:'([^']*)',url:'([^']*)',action:'([^']*)'\}/g;
    for (const match of offerMatch[1].matchAll(re)) {
      popups.push({id:'legacy-popup-'+match[1],title:match[2],text:match[3],
        mediaType:'video',mediaUrl:assetUrl('assets/promo-videos/'+match[4]),url:match[5],
        buttonText:match[6],origin:'legacy',mode:'rotating',description:'פופ־אפ וידאו קיים · מוצג לפי מצב סל / הרשמה / זמן'});
    }
  }
  const banners = [], seen = new Set();
  for (const filename of ['index.html', 'hats-index.html']) {
    const html = fs.readFileSync(path.join(root, filename), 'utf8');
    if (filename === 'index.html') {
      for (const [id, title, start] of [
        ['desktop-hero','Hero ראשי — מחשב', '<video class="hero__image'],
        ['mobile-hero','Hero ראשי — מובייל', '<video class="mobile-entry-banner__video']
      ]) {
        const startAt = html.indexOf(start);
        if (startAt < 0) continue;
        const endAt = html.indexOf('</video>', startAt);
        const piece = html.slice(startAt, endAt > startAt ? endAt + 8 : startAt + 1500);
        const source = /<source\b([^>]*)>/i.exec(piece);
        if (!source) continue;
        banners.push({id:'legacy-banner-'+id,title,mediaType:'video',mediaUrl:assetUrl(extractAttr(source[1],'data-src') || extractAttr(source[1],'src')),
          origin:'legacy',mode:'static',description:'סרטון Hero קיים · מוצג לפי סוג המכשיר'});
      }
    }
    const sectionRe = /<div\s+class="([^"]*\b[a-z-]+-collection-banner\b[^"]*)"\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/picture>/g;
    for (const match of html.matchAll(sectionRe)) {
      if (seen.has(match[2])) continue;
      seen.add(match[2]);
      const img = /<img\b([^>]*)>/i.exec(match[3]);
      if (!img) continue;
      const label = extractAttr(img[1], 'alt') || match[2];
      banners.push({id:'legacy-banner-'+match[2],title:label,mediaType:'image',
        mediaUrl:assetUrl(extractAttr(img[1], 'data-src') || extractAttr(img[1], 'src')),
        origin:'legacy',mode:'conditional',description:'באנר קולקציה קיים · מוצג כאשר הקולקציה נבחרת'});
    }
    if (filename === 'hats-index.html') {
      const hatHero = /<div\s+class="hero__visual"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
      if (hatHero) {
        let i = 0;
        for (const img of hatHero[1].matchAll(/<img\b([^>]*)data-hero-slide[^>]*>/gi)) {
          i++;
          banners.push({id:'legacy-banner-hats-hero-'+i,title:'Hero כובעים — שקופית '+i,
            mediaType:'image',mediaUrl:assetUrl(extractAttr(img[1], 'src')),
            origin:'legacy',mode:'rotating',description:'שקופית בעמוד הכובעים'});
        }
      }
    }
  }
  return {popups,banners};
}

async function sql(database, query, args=[]) {
  if (database.backend==='postgres') {
    let n=0;
    const translated=query.replace(/\?/g,()=>'$'+(++n));
    return (await database._query(translated,args)).rows;
  }
  return database.db.prepare(query).all(...args);
}
function boundedInt(value, min, max, fallback) {
  const n=Number(value);return Number.isSafeInteger(n)?Math.max(min,Math.min(max,n)):fallback;
}
async function couponInventory(database, {page=1,creatorPage=1,query='',showCustomers=false,showCreators=false,now=Date.now()}={}) {
  const p=boundedInt(page,1,1000000,1);
  const cp=boundedInt(creatorPage,1,1000000,1);
  const search=String(query||'').trim().slice(0,120);
  const condition=search?"WHERE (UPPER(c.code) LIKE UPPER(?) OR LOWER(u.email) LIKE LOWER(?) OR LOWER(u.name) LIKE LOWER(?))":'';
  const args=search?Array(3).fill('%'+search+'%'):[];
  const summaryRows=await sql(database,`SELECT COUNT(*) AS total,
    SUM(CASE WHEN c.used_at IS NOT NULL THEN 1 ELSE 0 END) AS used,
    SUM(CASE WHEN c.used_at IS NULL AND c.active=1 AND c.expires_at>? THEN 1 ELSE 0 END) AS usable
    FROM coupons c`,[now]);
  const summary=summaryRows[0]||{};
  const personal={total:Number(summary.total||0),used:Number(summary.used||0),usable:Number(summary.usable||0),page:p,pageSize:50,items:[],restricted:!showCustomers};
  if (showCustomers) {
    const matching=search ? await sql(database,`SELECT COUNT(*) AS total FROM coupons c JOIN users u ON u.id=c.user_id ${condition}`,args):summaryRows;
    personal.matched=Number(matching[0]?.total||0);
    const rows=await sql(database,`SELECT c.id,c.code,c.kind,c.discount_percent,c.active,c.created_at,c.expires_at,c.used_at,c.used_order_ref,
      u.name AS customer_name,u.email AS customer_email
      FROM coupons c JOIN users u ON u.id=c.user_id ${condition}
      ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?`,[...args,50,(p-1)*50]);
    personal.items=rows.map(row=>({id:'personal-'+row.id,code:row.code,kind:row.kind,discountPercent:Number(row.discount_percent),
      active:Number(row.active)===1,createdAt:Number(row.created_at||0),expiresAt:Number(row.expires_at||0),
      usedAt:row.used_at==null?null:Number(row.used_at),usedOrderRef:row.used_order_ref||'',
      customerName:row.customer_name||'',customerEmail:row.customer_email||'',
      status:row.used_at!=null?'used':Number(row.active)!==1?'disabled':Number(row.expires_at)<=now?'expired':'available'}));
  }
  const creatorSummary=await sql(database, 'SELECT COUNT(*) AS total FROM creator_codes');
  const creators={total:Number(creatorSummary[0]?.total||0),items:[],restricted:!showCreators,page:cp,pageSize:50};
  if (showCreators) {
    const rows=await sql(database, `SELECT c.code,c.discount_percent,c.active,c.created_at,u.name,u.email,u.role,u.is_blocked
      FROM creator_codes c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC,c.code ASC LIMIT ? OFFSET ?`,[50,(cp-1)*50]);
    creators.items=rows.map(row=>({code:row.code,discountPercent:Number(row.discount_percent||0),
      active:Number(row.active)===1&&row.role==='contentcreator'&&Number(row.is_blocked)!==1,
      createdAt:Number(row.created_at||0),name:row.name||'',email:row.email||''}));

  }
  return {personal,creators};
}
module.exports={mediaInventory,couponInventory};
