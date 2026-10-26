'use strict';
// Server-only sales analytics. Aggregates paid orders without exporting PII to the UI.
const {normalizeAdminRange, normalizeStoredOrderItems, israelDateKey} = require('./admin-analytics');
const {visitorSource} = require('./visitor-analytics');
const MAX_ORDERS=50000, MAX_VISITORS=50000;
const zone='Asia/Jerusalem';
const clockFormatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',hour:'2-digit',hourCycle:'h23'});
const dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short'});
const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HEBREW_DAYS=['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','יום שבת'];
const CATEGORY_NAMES={necklaces:'שרשראות',bracelets:'צמידים',rings:'טבעות',watches:'שעונים',hats:'כובעים',glasses:'משקפיים',greeting:'תכשיט עם ברכה',photo:'תכשיט עם תמונה',jewelry:'תכשיטים',fashion:'תכשיטי אופנה',other:'אחר'};
const safeNumber=x=>Number.isFinite(Number(x))?Number(x):0;
const label=p=>{const t=p&&p.title;return String(typeof t==='string'?t:t&&(t.he||t.en)||p&&p.name||p&&p.id||'').slice(0,180);};
const round=x=>Math.round(x);
function variantText(item,product){
  const parts=[];
  const opts=[['color','צבע','colors'],['size','מידה / רוחב','sizes'],['necklace','דגם','necklaces'],['length','אורך',null],['width','רוחב',null],['box','קופסה','boxes']];
  for(const [field,title,listKey] of opts){
    const value=item[field];if(!value)continue;
    const found=listKey&&Array.isArray(product&&product[listKey])?product[listKey].find(o=>String(o.id)===String(value)):null;
    const raw=found&&found.label;const display=typeof raw==='string'?raw:raw&&raw.he||raw&&raw.en||value;
    parts.push(title+': '+String(display).slice(0,50));
  }
  return parts.join(' · ') || 'ללא בחירת וריאציה';
}
function productCategory(p){
  const categories=Array.isArray(p&&p.categories)?p.categories:[];
  const all=[p&&p.category,...categories].filter(Boolean).map(String);
  for(const key of ['hats','glasses','watches','bracelets','rings','necklaces','photo','greeting','fashion']){
    if(all.some(x=>x===key||x.startsWith(key+'-')))return key;
  }
  return all[0]||'other';
}
function paidTimestamp(order){return safeNumber(order.paid_at)||safeNumber(order.created_at);}
function toRows(map,sortKey='revenueAgorot'){
  return [...map.values()].sort((a,b)=>safeNumber(b[sortKey])-safeNumber(a[sortKey])||String(a.label||'').localeCompare(String(b.label||''),'he'));
}
function userKey(v){return v==null?'':String(v);}
function emptyCategory(key){return {key,label:CATEGORY_NAMES[key]||key,orders:0,units:0,revenueAgorot:0};}
function createSalesAdvanced(database){
  const pg=database.backend==='postgres';let initialized=null;
  async function query(sql,params=[]){
    if(pg){let n=0;return (await database._query(sql.replace(/\?/g,()=>'$'+(++n)),params)).rows||[];}
    return database.db.prepare(sql).all(...params);
  }
  async function exec(sql,params=[]){
    if(pg){let n=0;return database._query(sql.replace(/\?/g,()=>'$'+(++n)),params);}
    return database.db.prepare(sql).run(...params);
  }
  async function init(){
    if(!initialized)initialized=(async()=>{
      await exec(`CREATE TABLE IF NOT EXISTS admin_order_promotion_analytics (
        order_ref TEXT PRIMARY KEY, buy2get1_count INTEGER NOT NULL DEFAULT 0,
        buy2get1_discount_agorot BIGINT NOT NULL DEFAULT 0,
        recorded_at BIGINT NOT NULL
      )`);
    })().catch(e=>{initialized=null;throw e;});
    return initialized;
  }
  async function capture(orderRef,priced){
    await init();
    const ref=String(orderRef||'').slice(0,120);
    if(!ref||!priced)return;
    await exec(`INSERT INTO admin_order_promotion_analytics(order_ref,buy2get1_count,buy2get1_discount_agorot,recorded_at)
      VALUES(?,?,?,?) ON CONFLICT(order_ref) DO NOTHING`,[
      ref,Math.max(0,Math.trunc(safeNumber(priced.buy2Get1Count))),
      Math.max(0,round(safeNumber(priced.buy2Get1Discount)*100)),Date.now()
    ]);
  }
  async function load(range,products,now=Date.now()){
    await init();
    const normalized=normalizeAdminRange(range,now);
    if(!normalized)throw Object.assign(new Error('invalid_range'),{status:400});
    const since=normalized.since||0;
    const orders=await query(`SELECT order_ref,user_id,guest_visitor_id,paid_at,created_at,amount_agorot,items_json,coupon_code
      FROM orders WHERE status='paid' AND order_ref NOT LIKE 'VS-DEMO-%'
      AND COALESCE(paid_at,created_at)>=? ORDER BY COALESCE(paid_at,created_at) DESC LIMIT ?`,[since,MAX_ORDERS+1]);
    if(orders.length>MAX_ORDERS)throw Object.assign(new Error('sales_analytics_too_many_orders_select_shorter_range'),{status:413});
    const catalogue=Array.isArray(products)?products:[];
    const byId=new Map(),bySlug=new Map();
    for(const p of catalogue){if(p&&p.id)byId.set(String(p.id),p);if(p&&p.slug)bySlug.set(String(p.slug),p);}
    const hours=Array.from({length:24},(_,i)=>({hour:i,label:String(i).padStart(2,'0')+':00',orders:0,revenueAgorot:0}));
    const weekdays=HEBREW_DAYS.map((name,i)=>({weekday:i,label:name,orders:0,revenueAgorot:0}));
    const cats=new Map(),variants=new Map(),prodMap=new Map(),pairs=new Map();
    const orderByCode=new Map(),buyerRecords=[];const productDays=new Map();
    let totalUnits=0,paidRevenue=0;
    for(const o of orders){
      const time=paidTimestamp(o),date=new Date(time),hour=Number(clockFormatter.formatToParts(date).find(p=>p.type==='hour')?.value||0);
      const dKey=dayFormatter.format(date),dayIndex=WEEKDAYS.indexOf(dKey);
      const value=Math.max(0,safeNumber(o.amount_agorot));paidRevenue+=value;
      const h=hours[hour];h.orders++;h.revenueAgorot+=value;
      if(dayIndex>=0){weekdays[dayIndex].orders++;weekdays[dayIndex].revenueAgorot+=value;}
      const items=normalizeStoredOrderItems(o.items_json,catalogue).filter(x=>safeNumber(x.qty)>0);
      const weights=items.map(item=>Math.max(0,safeNumber(item.lineTotal)));
      const weightsTotal=weights.reduce((a,b)=>a+b,0);const countTotal=items.reduce((a,b)=>a+b.qty,0);
      let left=value;
      const uniqueProducts=new Set(),uniqueCategories=new Set(),uniqueVariants=new Set();
      items.forEach((item,index)=>{
        const p=byId.get(String(item.id))||bySlug.get(String(item.id));
        const prodId=p?String(p.id):String(item.id);const slug=p?String(p.slug):String(item.id);
        const title=p?label(p):String(item.name||item.id).slice(0,140);
        const category=productCategory(p);const key=prodId+'|'+variantText(item,p);
        const share=index===items.length-1?left:Math.min(left,round(value*(weightsTotal>0?weights[index]/weightsTotal:item.qty/Math.max(1,countTotal))));left-=share;
        totalUnits+=item.qty;uniqueProducts.add(prodId);uniqueCategories.add(category);
        let cat=cats.get(category);if(!cat){cat=emptyCategory(category);cats.set(category,cat);}
        cat.units+=item.qty;cat.revenueAgorot+=share;
        let vr=variants.get(key);if(!vr){vr={key,productId:prodId,product:title,variant:variantText(item,p),label:title+' · '+variantText(item,p),units:0,orders:0,revenueAgorot:0};variants.set(key,vr);}
        vr.units+=item.qty;vr.revenueAgorot+=share;uniqueVariants.add(key);
        let row=prodMap.get(prodId);if(!row){row={id:prodId,slug,label:title,category,units:0,orders:0,revenueAgorot:0};prodMap.set(prodId,row);}
        row.units+=item.qty;row.revenueAgorot+=share;
        const salesDay=israelDateKey(time),dMap=productDays.get(prodId)||new Map();dMap.set(salesDay,(dMap.get(salesDay)||0)+item.qty);productDays.set(prodId,dMap);
      });
      for(const id of uniqueProducts)prodMap.get(id).orders++;
      for(const key of uniqueVariants)variants.get(key).orders++;
      for(const cat of uniqueCategories)cats.get(cat).orders++;
      const sorted=[...uniqueProducts].sort();
      for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
        const k=sorted[i]+'|'+sorted[j],pair=pairs.get(k)||{ids:[sorted[i],sorted[j]],orders:0};pair.orders++;pairs.set(k,pair);
      }
      if(o.coupon_code){const code=String(o.coupon_code).toUpperCase();let row=orderByCode.get(code);if(!row){row={code,orders:0,revenueAgorot:0};orderByCode.set(code,row);}row.orders++;row.revenueAgorot+=value;}
      buyerRecords.push({guestVisitorId:String(o.guest_visitor_id||''),userId:userKey(o.user_id),value});
    }
    // Activity records are per product per day and count events, not unique users.
    const dayFloor=since?israelDateKey(since):'0001-01-01';
    const activity=await query('SELECT product_slug,SUM(views) AS views,SUM(cart_adds) AS cart_adds FROM catalog_product_activity WHERE day>=? GROUP BY product_slug',[dayFloor]);
    const counts=new Map(activity.map(x=>[String(x.product_slug),{views:safeNumber(x.views),adds:safeNumber(x.cart_adds)}]));
    const lowConversion=[];
    for(const p of catalogue){
      const countsFor=counts.get(String(p.slug))||{views:0,adds:0};
      const sales=prodMap.get(String(p.id));
      if(countsFor.views<=0)continue;
      lowConversion.push({id:String(p.id),label:label(p),views:countsFor.views,cartAdds:countsFor.adds,orders:sales?sales.orders:0,
        orderPerView:Math.round((sales?sales.orders:0)/countsFor.views*10000)/100});
    }
    lowConversion.sort((a,b)=>b.views/(b.orders+1)-a.views/(a.orders+1)||b.views-a.views);
    // Attribution uses actual visitor sessions within period, not social platform video views.
    const visitors=await query(`SELECT v.visitor_id,v.user_id,v.traffic_source,v.utm_source,v.referrer FROM visitor_presence v
      WHERE v.first_seen>=? OR EXISTS(SELECT 1 FROM visitor_page_views pv WHERE pv.visitor_id=v.visitor_id AND pv.viewed_at>=?)
      LIMIT ?`,[since,since,MAX_VISITORS+1]);
    if(visitors.length>MAX_VISITORS)throw Object.assign(new Error('sales_analytics_too_many_visitors_select_shorter_range'),{status:413});
    const visitorIds=new Map(),users=new Map(),sourceMap=new Map(),converted=new Set();
    for(const v of visitors){
      const id=String(v.visitor_id);visitorIds.set(id,v);
      if(v.user_id){const user=userKey(v.user_id);const a=users.get(user)||[];a.push(v);users.set(user,a);}
      const source=visitorSource(v);const s=sourceMap.get(source)||{source,visitors:0,buyers:0,orders:0,revenueAgorot:0};s.visitors++;sourceMap.set(source,s);
    }
    let unattributed=0;
    for(const order of buyerRecords){
      let visitor=visitorIds.get(order.guestVisitorId);
      if(!visitor&&order.userId){const matches=users.get(order.userId)||[];if(matches.length===1)visitor=matches[0];}
      if(!visitor){unattributed++;continue;}
      const source=visitorSource(visitor),s=sourceMap.get(source);
      s.orders++;s.revenueAgorot+=order.value;converted.add(String(visitor.visitor_id));
    }
    for(const id of converted){const v=visitorIds.get(id);sourceMap.get(visitorSource(v)).buyers++;}
    const sourceRows=[...sourceMap.values()].map(x=>({...x,conversionPct:x.visitors?Math.round(x.buyers/x.visitors*10000)/100:0})).sort((a,b)=>b.visitors-a.visitors);
    const creatorCodes=await query('SELECT c.code,c.user_id,u.name,u.email FROM creator_codes c JOIN users u ON u.id=c.user_id');
    const creators=new Map();for(const c of creatorCodes){
      const sales=orderByCode.get(String(c.code).toUpperCase());if(!sales)continue;
      const id=String(c.user_id),row=creators.get(id)||{id,label:String(c.name||c.email||'יוצר'),orders:0,revenueAgorot:0};
      row.orders+=sales.orders;row.revenueAgorot+=sales.revenueAgorot;creators.set(id,row);
    }
    const promos=await query(`SELECT a.order_ref,a.buy2get1_count,a.buy2get1_discount_agorot
      FROM admin_order_promotion_analytics a JOIN orders o ON o.order_ref=a.order_ref
      WHERE o.status='paid' AND o.order_ref NOT LIKE 'VS-DEMO-%' AND COALESCE(o.paid_at,o.created_at)>=?`,[since]);
    const promoOrders=promos.filter(x=>safeNumber(x.buy2get1_count)>0);
    const pairRows=[...pairs.values()].map(x=>({ids:x.ids,label:x.ids.map(id=>prodMap.get(id)?.label||id).join(' + '),orders:x.orders})).sort((a,b)=>b.orders-a.orders).slice(0,25);
    const series=[...prodMap.values()].sort((a,b)=>b.units-a.units).map(p=>({id:p.id,label:p.label,days:[...(productDays.get(p.id)||new Map())].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,units])=>({date,units}))}));
    return {
      range,generatedAt:now,paidOrders:orders.length,paidRevenueAgorot:paidRevenue,totalUnits,
      hours,weekdays,categories:toRows(cats),variants:toRows(variants,'units').slice(0,80),
      products:toRows(prodMap,'units').map(x=>({id:x.id,label:x.label,category:x.category,units:x.units,orders:x.orders,revenueAgorot:x.revenueAgorot})),
      comparisons:series,lowConversion:lowConversion.slice(0,30),pairs:pairRows,
      promotion:{trackedOrders:promos.length,orders:promoOrders.length,applications:promoOrders.reduce((a,b)=>a+safeNumber(b.buy2get1_count),0),
        discountAgorot:promoOrders.reduce((a,b)=>a+safeNumber(b.buy2get1_discount_agorot),0),untrackedOrders:orders.length-promos.length},
      creators:toRows(creators),traffic:sourceRows,visitors:visitors.length,buyers:converted.size,
      conversionPct:visitors.length?Math.round(converted.size/visitors.length*10000)/100:0,
      unattributedOrders:unattributed,
      notes:{category:'ההכנסות לפי קטגוריה / מוצר מחולקות באופן יחסי לסכום ההזמנה ששולמה (כולל השפעת הנחות), ולא מהוות רווח או הכנסה נטו לפריט.',
        lowConversion:'צפיות והוספות לסל הן אירועים; רכישות / צפיות אינן שיעור המרה של אנשים ייחודיים.',
        promotion:'הנחת 2+1 מתועדת החל מהתקנת עדכון זה; הזמנות ישנות אינן משוחזרות לפי כללי מבצע שהשתנו.',
        traffic:'מבקרים מזוהים לפי מזהה דפדפן. רכישה משויכת לדפדפן או לחשבון עם מזהה מבקר יחיד בטווח. הזמנות ללא שיוך מוחרגות מההמרה.'}
    };
  }
  return {init,capture,load};
}
module.exports={createSalesAdvanced,variantText,productCategory};
