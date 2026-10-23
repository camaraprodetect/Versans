'use strict';
// Marketing content and offer settings are persisted in schema_meta: never edited in deploy files.
const crypto = require('node:crypto');
const KEY = 'admin_marketing_v1';
const DEFAULTS = {
  coupons: [],
  bundles: [
    {id:'standard-jewelry', name:'2+1 תכשיטים', kind:'buy2get1', category:'jewelry', active:true, system:true},
    {id:'standard-glasses', name:'2 משקפיים ב-249.90', kind:'fixed', category:'glasses', quantity:2, price:249.9, active:true, system:true},
    {id:'standard-hats-2', name:'2 כובעים ב-239.90', kind:'fixed', category:'hats', quantity:2, price:239.9, active:true, system:true},
    {id:'standard-hats-3', name:'3 כובעים ב-299.90', kind:'fixed', category:'hats', quantity:3, price:299.9, active:true, system:true}
  ],
  popups: [], banners: [], campaigns: []
};
const MAX = {coupons:300,bundles:60,popups:30,banners:30,campaigns:100};
function err(message) { const error = new Error(message);error.status=400;return error; }
function clip(value,max=160){return String(value||'').trim().slice(0,max);}
function validateUrl(value) {
  const v=clip(value,1200);if(!v)return '';
  if (/^(?:\/\/(?!\/)|javascript:|data:)/i.test(v)) throw err('unsafe_url');
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  try { const parsed=new URL(v);if(['https:','http:'].includes(parsed.protocol))return parsed.href; } catch (_) {}
  throw err('invalid_url');
}
function time(value) {if(!value)return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw err('invalid_date');return n;}
function period(row,now=Date.now()) {return (!row.startsAt||row.startsAt<=now)&&(!row.endsAt||row.endsAt>now);}
function normalize(section, item, existing){
  const id=existing?existing.id:crypto.randomUUID();
  const base={id,createdAt:existing?existing.createdAt:Date.now(),updatedAt:Date.now(), active:item.active===true};
  const startsAt=time(item.startsAt),endsAt=time(item.endsAt);
  if(startsAt&&endsAt&&endsAt<=startsAt)throw err('invalid_period');
  if(section==='coupons'){
    const code=clip(item.code,32).toUpperCase(); if(!/^[A-Z0-9_-]{4,32}$/.test(code))throw err('invalid_coupon_code');
    const type=item.type==='fixed'?'fixed':'percent',value=Number(item.value);
    if(!Number.isFinite(value)||value<=0||(type==='percent'?value>90:value>50000))throw err('invalid_discount');
    const maxUses=item.maxUses===''||item.maxUses==null?0:Number(item.maxUses);
    if(!Number.isInteger(maxUses)||maxUses<0||maxUses>1000000)throw err('invalid_max_uses');
    const allowedEmails=clip(item.allowedEmails,3000).split(/[\s,;]+/).map(x=>x.toLowerCase()).filter(Boolean);
    if(allowedEmails.length>100||allowedEmails.some(email=>!/^\S+@\S+\.\S+$/.test(email)))throw err('invalid_customer_emails');
    return {...base,code,type,value,maxUses,allowedEmails:[...new Set(allowedEmails)],startsAt,endsAt};
  }
  if(section==='bundles'){
    const kind=item.kind==='buy2get1'?'buy2get1':'fixed';
    const category=['jewelry','hats','glasses'].includes(item.category)?item.category:null;
    if(!category)throw err('invalid_category');
    const quantity=kind==='fixed'?Number(item.quantity):3,price=kind==='fixed'?Number(item.price):0;
    if(kind==='fixed'&&(!Number.isInteger(quantity)||quantity<2||quantity>20||!Number.isFinite(price)||price<=0||price>50000))throw err('invalid_bundle');
    return {...base,name:clip(item.name,110)||'מבצע כמות',kind,category,quantity,price,startsAt,endsAt,system:!!(existing&&existing.system)};
  }
  if(section==='popups'||section==='banners'){
    const mediaType=item.mediaType==='video'?'video':'image';const mediaUrl=validateUrl(item.mediaUrl);
    if(!mediaUrl)throw err('missing_media');
    return {...base,title:clip(item.title,150),text:clip(item.text,500),buttonText:clip(item.buttonText,70),url:validateUrl(item.url)||'/#shopTitle',mediaType,mediaUrl,display:item.display==='mobile'?'mobile':item.display==='desktop'?'desktop':'all',
      trigger:section==='popups'&&['delay','scroll','exit'].includes(item.trigger)?item.trigger:'delay',
      delaySeconds:section==='popups'?Math.min(120,Math.max(0,Number(item.delaySeconds)||0)):0,
      showOnce:section==='popups'?item.showOnce!==false:false,
      page:section==='popups'&&['home','product'].includes(item.page)?item.page:'all',
      minCartItems:section==='popups'?Math.max(0,Math.min(50,Math.floor(Number(item.minCartItems)||0))):0,
      location:section==='banners'&&item.location==='hero'?'hero':'home',startsAt,endsAt};
  }
  if(section==='campaigns'){
    const budget=Number(item.budget),goal=Number(item.goal),spent=Number(item.spent||0);
    if(![budget,goal,spent].every(n=>Number.isFinite(n)&&n>=0&&n<1e9))throw err('invalid_campaign_amount');
    return {...base,name:clip(item.name,140)||'קמפיין',source:clip(item.source,70),utmCampaign:clip(item.utmCampaign,100),budget,goal,spent,startsAt,endsAt};
  }
  throw err('invalid_section');
}
function createMarketingManager(database) {
  let cache=null,cacheAt=0;
  async function read(force=false) {
    if(!force&&cache&&Date.now()-cacheAt<1500)return structuredClone(cache);
    const raw=await database.getSchemaMeta(KEY);
    let stored={};try {stored=raw?JSON.parse(raw):{};}catch(_){}
    cache=Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,Array.isArray(stored[k])?stored[k]:structuredClone(DEFAULTS[k])]));cacheAt=Date.now();
    return structuredClone(cache);
  }
  let queue=Promise.resolve();
  function edit(section,action,item){
    const task=queue.then(async()=>{
      if(!MAX[section])throw err('invalid_section');
      const settings=await read(true),list=settings[section];
      const index=list.findIndex(v=>v.id===String(item.id||''));
      if(action==='delete'){
        if(index<0)throw err('not_found');
        if(list[index].system)throw err('system_offer_cannot_delete');
        list.splice(index,1);
      }else{
        if(action==='update'&&index<0)throw err('not_found');
        if(action==='create'&&list.length>=MAX[section])throw err('section_limit');
        const row=normalize(section,item,action==='update'?list[index]:null);
        if(section==='coupons'&&list.some(v=>v.code===row.code&&v.id!==row.id))throw err('duplicate_coupon');
        if(section==='coupons'){
          // Legacy welcome / creator coupon codes are checked by the API when saving.
        }
        if(action==='create')list.push(row);else list[index]=row;
      }
      await database.setSchemaMeta(KEY,JSON.stringify(settings));cache=settings;cacheAt=Date.now();
      return settings;
    });queue=task.catch(()=>{});return task;
  }
  async function getCoupon(code,user,customerEmail,now=Date.now()){
    const state=await read();const row=state.coupons.find(x=>x.code===String(code||'').toUpperCase());
    if(!row||!row.active||!period(row,now))return null;
    if(row.allowedEmails.length){
      // Targeted coupon only for a signed-in account with the matching email.
      if(!user||!row.allowedEmails.includes(String(user.email||'').toLowerCase()))return null;
    }
    const used=await usage(row.id);
    const reserved=await reservations(row.id,now);
    if(row.maxUses&&used+reserved>=row.maxUses)return null;
    return {...row,used};
  }
  let initPromise;
  function init(){if(!initPromise)initPromise=(async()=>{
    const sql=`CREATE TABLE IF NOT EXISTS admin_marketing_coupon_uses (order_ref TEXT PRIMARY KEY, coupon_id TEXT NOT NULL, redeemed_at BIGINT NOT NULL)`;
    const reserve=`CREATE TABLE IF NOT EXISTS admin_marketing_coupon_reservations (order_ref TEXT PRIMARY KEY,coupon_id TEXT NOT NULL,created_at BIGINT NOT NULL)`;
    if(database.backend==='postgres'){await database._query(sql);await database._query(reserve);}else{database.db.exec(sql);database.db.exec(reserve);}
  })().catch(e=>{initPromise=null;throw e;});return initPromise;}
  async function usage(id){await init();if(database.backend==='postgres'){const r=await database._query('SELECT COUNT(*) AS n FROM admin_marketing_coupon_uses WHERE coupon_id=$1',[id]);return Number(r.rows[0].n);}return Number(database.db.prepare('SELECT COUNT(*) AS n FROM admin_marketing_coupon_uses WHERE coupon_id=?').get(id).n);}
  async function reservations(id,now=Date.now(),tx=database){
    await init();const cutoff=now-60*60*1000;
    if(tx.backend==='postgres'){const r=await tx._query('SELECT COUNT(*) AS n FROM admin_marketing_coupon_reservations WHERE coupon_id=$1 AND created_at>$2',[id,cutoff]);return Number(r.rows[0].n);}
    return Number(tx.db.prepare('SELECT COUNT(*) AS n FROM admin_marketing_coupon_reservations WHERE coupon_id=? AND created_at>?').get(id,cutoff).n);
  }
  async function reserve(tx,coupon,orderRef,now=Date.now()){
    if(!coupon)return;
    await init();
    // Transaction-scoped PG advisory lock serializes reservations for this coupon across Render instances.
    if(tx.backend==='postgres')await tx._query('SELECT pg_advisory_xact_lock(hashtext($1))',[coupon.id]);
    const already=tx.backend==='postgres'?(await tx._query('SELECT order_ref FROM admin_marketing_coupon_reservations WHERE order_ref=$1',[orderRef])).rows[0]:tx.db.prepare('SELECT order_ref FROM admin_marketing_coupon_reservations WHERE order_ref=?').get(orderRef);
    if(already)return;
    if(coupon.maxUses && (await usageTx(tx,coupon.id))+await reservations(coupon.id,now,tx)>=coupon.maxUses)throw err('coupon_limit_reached');
    if(tx.backend==='postgres')await tx._query('INSERT INTO admin_marketing_coupon_reservations (order_ref,coupon_id,created_at) VALUES ($1,$2,$3)',[orderRef,coupon.id,now]);
    else tx.db.prepare('INSERT INTO admin_marketing_coupon_reservations (order_ref,coupon_id,created_at) VALUES (?,?,?)').run(orderRef,coupon.id,now);
  }
  async function usageTx(tx,id){
    if(tx.backend==='postgres'){const r=await tx._query('SELECT COUNT(*) AS n FROM admin_marketing_coupon_uses WHERE coupon_id=$1',[id]);return Number(r.rows[0].n);}
    return Number(tx.db.prepare('SELECT COUNT(*) AS n FROM admin_marketing_coupon_uses WHERE coupon_id=?').get(id).n);
  }
  async function redeem(tx,code,orderRef,now){
    const settings=await read();const row=settings.coupons.find(x=>x.code===code);
    if(!row)return;
    await init();
    if(tx.backend==='postgres')await tx._query('INSERT INTO admin_marketing_coupon_uses (order_ref,coupon_id,redeemed_at) VALUES ($1,$2,$3) ON CONFLICT(order_ref) DO NOTHING',[orderRef,row.id,now]);
    else tx.db.prepare('INSERT OR IGNORE INTO admin_marketing_coupon_uses (order_ref,coupon_id,redeemed_at) VALUES (?,?,?)').run(orderRef,row.id,now);
    if(tx.backend==='postgres')await tx._query('DELETE FROM admin_marketing_coupon_reservations WHERE order_ref=$1',[orderRef]);
    else tx.db.prepare('DELETE FROM admin_marketing_coupon_reservations WHERE order_ref=?').run(orderRef);
  }
  async function publicConfig(now=Date.now()){
    const state=await read();return {
      bundles:state.bundles.filter(x=>x.active&&period(x,now)).map(x=>({id:x.id,kind:x.kind,category:x.category,quantity:x.quantity,price:x.price,name:x.name})),
      popups:state.popups.filter(x=>x.active&&period(x,now)),banners:state.banners.filter(x=>x.active&&period(x,now))
    };
  }
  async function dashboard(){const state=await read();return {...state,coupons:await Promise.all(state.coupons.map(async x=>({...x,used:await usage(x.id)})))};}
  return {edit,read,publicConfig,dashboard,getCoupon,redeem,reserve,usage,period};
}
module.exports={createMarketingManager};
