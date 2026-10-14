'use strict';

// Storefront product management. Edits are stored in the existing durable database
// (schema_meta) and applied to the shared PRODUCTS array used by checkout and bot.
const crypto = require('node:crypto');
const { PRODUCTS } = require('../assets/products.js');
const { productPath } = require('../assets/routes.js');
const CATALOG_KEY = 'catalog_admin_overrides_v1';
const IMAGE_PREFIX = 'catalog_admin_image_v1_';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const originals = PRODUCTS.map(p => JSON.parse(JSON.stringify(p)));
const originalsBySlug = new Map(originals.map(p => [String(p.slug), p]));
const allowedCategories = new Set(['greeting','greeting-mom','greeting-partner','greeting-daughter','greeting-sister','necklaces','bracelets','bracelets-men','bracelets-women','bracelets-fashion','rings','photo-bracelets','watches','watches-men','watches-women','glasses','glasses-men','glasses-women','glasses-unisex','hats','custom','women','men','unisex']);
const fields = ['title','subtitle','description','price','compareAt','category','categories','images','hoverImage','badge','colors','sizes','boxes','necklaces','giftPackaging','variantImages','materials','details','features','gender','sku'];
const isRecord = x => x && typeof x === 'object' && !Array.isArray(x);
const clone = x => JSON.parse(JSON.stringify(x));
const clean = x => String(x == null ? '' : x).trim();
const safeImage = x => { const s = clean(x); return (s.length <= 600 && (/^https:\/\/[^\s"'<>]+$/i.test(s) || /^(?:\/)?(?:images\/|assets\/|api\/catalog\/media\/)[\w.\/-]+(?:\?v=[\w.-]+)?$/i.test(s))) ? s : ''; };
function validateDraft(raw, previous, current, changes) {
  if (!isRecord(raw)) throw Object.assign(new Error('invalid_product'),{status:400});
  const draft = previous ? clone(previous) : { id: 'admin-' + crypto.randomUUID(), slug: 'product-' + nextNumber(current, changes), title: {}, subtitle: {} };
  // Deny edits to public identity, references, arbitrary runtime fields.
  for (const k of fields) if (Object.prototype.hasOwnProperty.call(raw,k)) draft[k] = clone(raw[k]);
  const title = isRecord(draft.title) ? clean(draft.title.he) : clean(draft.title);
  if (!title || title.length > 180) throw Object.assign(new Error('invalid_title'),{status:400});
  draft.title = { ...(isRecord(draft.title) ? draft.title : {}), he: title, en: clean(isRecord(draft.title) && draft.title.en || title).slice(0,180) };
  const price = Number(draft.price);
  if (!Number.isFinite(price) || price > 100000 || (price < 0.01 && (!previous || Number(previous.price) !== 0 || price !== 0))) throw Object.assign(new Error('invalid_price'),{status:400});
  draft.price = Math.round(price * 100) / 100;
  if (previous && previous.catalogPrice != null && Number(previous.price) !== draft.price) draft.catalogPrice = draft.price;
  if (draft.compareAt != null && draft.compareAt !== '') {
    const cmp = Number(draft.compareAt);
    if (!Number.isFinite(cmp) || cmp < 0 || cmp > 100000) throw Object.assign(new Error('invalid_compare_price'),{status:400});
    draft.compareAt = cmp;
  }
  if (!allowedCategories.has(clean(draft.category))) throw Object.assign(new Error('invalid_category'),{status:400});
  draft.categories = Array.from(new Set((Array.isArray(draft.categories) ? draft.categories : [draft.category]).map(clean).filter(x=>allowedCategories.has(x))));
  if (!draft.categories.includes(draft.category)) draft.categories.unshift(draft.category);
  if (!Array.isArray(draft.images) || draft.images.length > 24 || draft.images.some(x=>!safeImage(x))) throw Object.assign(new Error('invalid_images'),{status:400});
  if (!draft.images.length) throw Object.assign(new Error('image_required'),{status:400});
  draft.images = draft.images.map(safeImage);
  // Preserve VerSans card metadata while making a newly uploaded main photo
  // actually replace the old photo in collection cards as well.
  if (previous && Array.isArray(previous.images) && previous.images[0] !== draft.images[0] && previous.cardImage) {
    draft.cardImage = draft.images[0];
  }
  if (previous && getTitle(previous) !== title && previous.cardTitle) {
    draft.cardTitle = { he: title, en: draft.title.en };
  }
  if (draft.hoverImage && !safeImage(draft.hoverImage)) throw Object.assign(new Error('invalid_hover_image'),{status:400});
  if (JSON.stringify(draft).length > 60000) throw Object.assign(new Error('product_too_large'),{status:400});
  return draft;
}
function nextNumber(current, changes) {
  const nums = current.map(p => /^product-(\d+)$/.exec(String(p.slug||''))).filter(Boolean).map(m=>+m[1]);
  for (const key of Object.keys(changes || {})) { const m = /^product-(\d+)$/.exec(key); if (m) nums.push(+m[1]); }
  return Math.max(999, ...nums)+1;
}
function mediaFilename(url) { return /^\/?api\/catalog\/media\/([a-f0-9-]{36})$/.exec(clean(url)); }
function getTitle(p) { return clean(p.title && (p.title.he || p.title.en) || p.id); }
function toPublicRow(p) { return { ...p, name: getTitle(p), href: productPath(p), image: p.images && p.images[0] || '' }; }
function createCatalogManager(database, onUpdate) {
  let changes = {};
  let pending = {};
  let chain = Promise.resolve();
  function apply() {
    const active = originals.filter(p=>!Object.prototype.hasOwnProperty.call(changes,p.slug) || changes[p.slug] !== null).map(p=>changes[p.slug] ? clone(changes[p.slug]) : clone(p));
    for (const [slug,p] of Object.entries(changes)) if (p && !originalsBySlug.has(slug)) active.push(clone(p));
    PRODUCTS.splice(0, PRODUCTS.length, ...active);
    if (onUpdate) onUpdate();
  }
  async function init() {
    const saved = await database.getSchemaMeta(CATALOG_KEY);
    try { const p = saved ? JSON.parse(saved) : {}; changes = isRecord(p) ? p : {}; } catch { changes = {}; }
    const outbox = await database.getSchemaMeta(CATALOG_KEY+'_pending');
    try { const p = outbox ? JSON.parse(outbox) : {}; pending = isRecord(p) ? p : {}; } catch { pending = {}; }
    apply();
  }
  function enqueue(op) {
    const result = chain.then(op);
    chain = result.catch(()=>{});
    return result;
  }
  async function write(raw, slug, deleting=false) { return enqueue(async()=>{
    const previous = slug ? PRODUCTS.find(p=>p.slug===slug) : null;
    if (slug && !previous) throw Object.assign(new Error('product_not_found'),{status:404});
    let saved = deleting ? null : validateDraft(raw, previous, PRODUCTS, changes);
    const key = previous ? previous.slug : saved.slug;
    const next = { ...changes, [key]: saved };
    const nextPending = { ...pending, [key]: { action: deleting ? 'delete' : 'upsert', updatedAt: Date.now() } };
    await database.setSchemaMeta(CATALOG_KEY, JSON.stringify(next));
    await database.setSchemaMeta(CATALOG_KEY+'_pending', JSON.stringify(nextPending));
    changes=next; pending=nextPending; apply();
    return { product: saved ? toPublicRow(saved) : null, slug:key };
  }); }
  function list() { return PRODUCTS.map(toPublicRow); }
  function patches() { return changes; }
  function pendingSlugs() { return Object.keys(pending); }
  function sheetPayload(slug) {
    if (!pending[slug]) return null;
    const product = PRODUCTS.find(p=>p.slug===slug);
    const url = String(process.env.PUBLIC_SITE_URL || 'https://versans.com').replace(/\/$/,'');
    return { action: product ? 'product_upsert' : 'product_delete', productId: slug,
      name: product ? getTitle(product) : '', link: product ? url + productPath(product) : '',
      image: product && product.images && product.images[0] ? (String(product.images[0]).startsWith('https://') ? product.images[0] : url + '/' + String(product.images[0]).replace(/^\//,'')) : '' };
  }
  async function syncOne(slug) {
    const p = sheetPayload(slug); if (!p) return { ok:true, alreadySynced:true };
    const endpoint = clean(process.env.GOOGLE_PRODUCTS_WEBHOOK_URL);
    const secret = clean(process.env.GOOGLE_PRODUCTS_WEBHOOK_SECRET);
    if (!endpoint || !secret) return {ok:false,error:'google_products_webhook_not_configured'};
    let result;
    try {
      const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...p,secret}),signal:AbortSignal.timeout(14000),redirect:'follow'});
      const body = await response.text();
      try {result=JSON.parse(body);}catch {result={ok:false,error:'invalid_webhook_response'};}
      if (!response.ok || !result || result.ok!==true || result.action!==p.action || result.productId!==p.productId) throw new Error(clean(result && result.error) || 'sheet_webhook_failed');
    } catch(e) {return {ok:false,error:clean(e.message).slice(0,130)};}
    await enqueue(async()=>{ if (pending[slug] && sheetPayload(slug) && sheetPayload(slug).action===p.action && sheetPayload(slug).name===p.name && sheetPayload(slug).image===p.image) {
      const updated={...pending};delete updated[slug];
      await database.setSchemaMeta(CATALOG_KEY+'_pending', JSON.stringify(updated));pending=updated;
    }});
    return {ok:true};
  }
  async function syncPending(max=8) { const out={};for(const slug of pendingSlugs().slice(0,max)) out[slug]=await syncOne(slug);return out; }
  async function uploadImage(dataUrl) {
    const match=/^data:image\/(png|jpeg|webp);base64,([a-z\d+/=]+)$/i.exec(clean(dataUrl));
    if(!match) throw Object.assign(new Error('invalid_image_format'),{status:400});
    const binary=Buffer.from(match[2],'base64');
    if(!binary.length||binary.length>MAX_IMAGE_BYTES)throw Object.assign(new Error('image_too_large'),{status:413});
    const sig=binary.subarray(0,12);
    const valid=(match[1]==='png'&&sig.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (match[1]==='jpeg'&&sig[0]===255&&sig[1]===216&&sig[2]===255) || (match[1]==='webp'&&sig.subarray(0,4).toString()==='RIFF'&&sig.subarray(8,12).toString()==='WEBP');
    if(!valid)throw Object.assign(new Error('invalid_image_bytes'),{status:400});
    const id=crypto.randomUUID();
    await database.setSchemaMeta(IMAGE_PREFIX+id,JSON.stringify({type:'image/'+match[1],base64:binary.toString('base64')}));
    return '/api/catalog/media/'+id;
  }
  async function getImage(id) {
    if(!/^[a-f0-9-]{36}$/.test(id))return null;
    const data=await database.getSchemaMeta(IMAGE_PREFIX+id);
    if(!data)return null;
    try {const p=JSON.parse(data);return {type:p.type,buffer:Buffer.from(p.base64,'base64')};}catch{return null;}
  }
  return {init,write,list,patches,pendingSlugs,syncOne,syncPending,uploadImage,getImage,mediaFilename};
}
module.exports={createCatalogManager};
