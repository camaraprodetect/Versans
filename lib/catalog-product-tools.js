'use strict';
// Protected catalog metadata: publication windows, temporary prices, audit & COGS.
const crypto=require('node:crypto');
const META='catalog_product_controls_v1';
const HISTORY='catalog_product_prices_v1_';
const validSlug=s=>/^product-[a-z0-9-]{1,60}$/.test(String(s||''));
const cleanAmount=x=>{ if(x===null||x===undefined||x==='')return null;const n=Number(x);if(!Number.isFinite(n)||n<0||n>100000)return NaN;return Math.round(n*100)/100; };
const epoch=x=>{if(x===null||x===undefined||x==='')return null;const v=Number(x);return Number.isSafeInteger(v)&&v>946684800000&&v<4102444800000?v:NaN;};
const parse=x=>{try{const a=JSON.parse(x||'{}');return a&&typeof a==='object'&&!Array.isArray(a)?a:{}}catch{return {}}};
function createCatalogProductTools(db){
 let controls={},lastRaw=null,queue=Promise.resolve();
 function lock(task){let next=queue.then(task);queue=next.catch(()=>{});return next;}
 async function refresh(){const raw=await db.getSchemaMeta(META);if(raw!==lastRaw){controls=parse(raw);lastRaw=raw;return true;}return false;}
 async function init(){await refresh();}
 function get(slug){return controls[slug]||{};}
 function all(){return controls;}
 function isFuture(slug,now=Date.now()){const p=get(slug);return !!(p.publishAt&&p.publishAt>now);}
 function sale(slug,now=Date.now()){
  const s=get(slug).sale;
  return s&&s.startAt<=now&&s.endAt>now?s:null;
 }
 function nextTransition(now=Date.now()){
  let min=Infinity;
  for(const c of Object.values(controls))for(const n of [c.publishAt,c.sale&&c.sale.startAt,c.sale&&c.sale.endAt])if(Number(n)>now)min=Math.min(min,n);
  return min;
 }
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('invalid_product_controls'),{status:400});
  const publishAt=epoch(input.publishAt);
  if(Number.isNaN(publishAt))throw Object.assign(Error('invalid_publish_at'),{status:400});
  const unitCost=cleanAmount(input.unitCost);
  if(Number.isNaN(unitCost))throw Object.assign(Error('invalid_unit_cost'),{status:400});
  let sale=null;
  if(input.sale){
   if(typeof input.sale!=='object'||Array.isArray(input.sale))throw Object.assign(Error('invalid_sale'),{status:400});
   const price=cleanAmount(input.sale.price),startAt=epoch(input.sale.startAt),endAt=epoch(input.sale.endAt);
   if(!(price>0)||!startAt||!endAt||!Number.isFinite(startAt)||!Number.isFinite(endAt)||endAt<=startAt)
     throw Object.assign(Error('invalid_sale'),{status:400});
   sale={price,startAt,endAt};
  }
  return {publishAt,unitCost,sale};
 }
 async function set(slug,raw,actor,onUpdate){return lock(async()=>{
  if(!validSlug(slug))throw Object.assign(Error('invalid_product'),{status:400});
  await refresh();
  const saved=validate(raw);
  const next={...controls,[slug]:saved};const str=JSON.stringify(next);
  if(str.length>60000)throw Object.assign(Error('catalog_controls_too_large'),{status:400});
  await db.setSchemaMeta(META,str);controls=next;lastRaw=str;
  if(onUpdate)onUpdate();
  return saved;
 });}
 async function recordPrice(slug,previous,next,actor,action){
  if(!validSlug(slug))return;
  if(action && String(action).startsWith('תזמון מבצע')){} else if(previous&&next&&Number(previous.price)===Number(next.price)&&Number(previous.compareAt||0)===Number(next.compareAt||0))return;
  const key=HISTORY+slug;
  return lock(async()=>{
   let list=[];
   try{list=JSON.parse(await db.getSchemaMeta(key)||'[]');if(!Array.isArray(list))list=[];}catch{}
   list.unshift({at:Date.now(),actor:String(actor||'admin').slice(0,160),action:String(action||'edit').slice(0,80),previous:previous?{price:Number(previous.price),compareAt:previous.compareAt??null}:null,next:next?{price:Number(next.price),compareAt:next.compareAt??null}:null});
   await db.setSchemaMeta(key,JSON.stringify(list.slice(0,80)));
  });
 }
 async function history(slug){if(!validSlug(slug))return [];try{let v=JSON.parse(await db.getSchemaMeta(HISTORY+slug)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
 return {init,refresh,get,all,isFuture,sale,nextTransition,set,history,recordPrice,validate};
}
module.exports={createCatalogProductTools};
