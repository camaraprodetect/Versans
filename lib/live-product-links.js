'use strict';
const crypto = require('node:crypto');
const SHEET_ID = '1R027x8Di2X7Rbf-3NnZz_tbESlgx9o0pzl1kgvCpKoQ';
const SHEET_GID = 1810220923;
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}#gid=${SHEET_GID}`;
const TTL = 15000;
let cache, pending, token, tokenPending;
function httpsUrl(value) {
  try { const u = new URL(String(value || '').trim()); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; }
}
function text(cell) { return String(cell?.formattedValue ?? cell?.userEnteredValue?.stringValue ?? '').trim(); }
function formulaUrl(cell, name) {
  const f = String(cell?.userEnteredValue?.formulaValue || '');
  const match = new RegExp('^=\\s*' + name + '\\s*\\(\\s*"((?:[^"]|"")*)"', 'i').exec(f);
  return match ? httpsUrl(match[1].replace(/""/g, '"')) : '';
}
function cellLink(cell) {
  const runs = (cell?.textFormatRuns || []).map(r=>httpsUrl(r.format?.link?.uri)).filter(Boolean);
  return httpsUrl(cell?.hyperlink) || httpsUrl(cell?.userEnteredFormat?.textFormat?.link?.uri) || (new Set(runs).size === 1 ? runs[0] : '') || formulaUrl(cell,'HYPERLINK') || httpsUrl(text(cell));
}
function parseSheet(data) {
  const sheet = data?.sheets?.find(s=>s.properties?.sheetId === SHEET_GID);
  if (!sheet || !Array.isArray(sheet.data)) throw new Error('product_sheet_invalid_response');
  const rows = [];
  for (const grid of sheet.data) (grid.rowData || []).forEach((row,i)=>{
    const number = (grid.startRow || 0)+i+1;
    if (number === 1) return;
    const c = row.values || [];
    const id = text(c[0]), name = text(c[1]), link = cellLink(c[2]), image = formulaUrl(c[3],'IMAGE');
    if (id || name || link || image || text(c[2])) rows.push({row:number,id,name,link,linkLabel:text(c[2]),image});
  });
  return rows;
}
function scriptConfig() {
  return {url:String(process.env.GOOGLE_PRODUCTS_WEBHOOK_URL || '').trim(),secret:String(process.env.GOOGLE_PRODUCTS_WEBHOOK_SECRET || '').trim()};
}
function configured() { const config=scriptConfig(); return Boolean((config.url && config.secret) || String(process.env.GOOGLE_PRODUCT_LINKS_SERVICE_ACCOUNT_JSON || '').trim()); }
async function readFromScript(config) {
  let url; try { url=new URL(config.url); } catch (_) { throw new Error('product_sheet_invalid_webhook_url'); }
  if (url.origin !== 'https://script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) || url.username || url.password || url.search || url.hash) throw new Error('product_sheet_invalid_webhook_url');
  const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'product_links_read',secret:config.secret}),signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new Error('product_sheet_read_failed_'+response.status);
  const data=await response.json();
  if(data?.ok!==true || data.action!=='product_links_read' || !Array.isArray(data.rows)) throw new Error('product_sheet_invalid_response');
  return data.rows.map(r=>({row:Number(r.row),id:String(r.id??''),name:String(r.name??''),link:httpsUrl(r.link),linkLabel:String(r.linkLabel??''),image:httpsUrl(r.image)})).filter(r=>Number.isSafeInteger(r.row)&&r.row>=2);
}
async function accessToken() {
  if (token && token.until > Date.now()) return token.value;
  if (tokenPending) return tokenPending;
  tokenPending = (async()=>{
    const raw = process.env.GOOGLE_PRODUCT_LINKS_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('product_sheet_not_configured');
    let cred; try { cred=JSON.parse(raw); } catch (_) { throw new Error('product_sheet_invalid_credentials'); }
    if (!cred.client_email || !cred.private_key) throw new Error('product_sheet_invalid_credentials');
    const now=Math.floor(Date.now()/1000);
    const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const body=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:cred.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
    const jwt=body+'.'+crypto.sign('RSA-SHA256',Buffer.from(body),cred.private_key).toString('base64url');
    const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(10000)});
    const json=await res.json();
    if (!res.ok || !json.access_token) throw new Error('product_sheet_auth_failed');
    token={value:json.access_token,until:Date.now()+Math.max(0,Number(json.expires_in||3600)-60)*1000};
    return token.value;
  })();
  try { return await tokenPending; } finally { tokenPending=null; }
}
async function loadProductLinks() {
  if (!configured()) throw new Error('product_sheet_not_configured');
  if (cache && Date.now()-cache.fetchedAt < TTL) return cache;
  if (pending) return pending;
  pending=(async()=>{
    const config=scriptConfig();
    if(config.url && config.secret) {
      const rows=await readFromScript(config);
      cache={rows,fetchedAt:Date.now()};
      return cache;
    }
    const auth=await accessToken();
    const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`);
    url.searchParams.set('ranges',"'קישורי מוצרים'!A1:D");
    url.searchParams.set('includeGridData','true');
    url.searchParams.set('fields','sheets(properties(sheetId),data(startRow,rowData(values(formattedValue,userEnteredValue,hyperlink,textFormatRuns(format(link),startIndex),userEnteredFormat(textFormat(link)))))');
    const res=await fetch(url,{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(12000)});
    if (!res.ok) { if(res.status===401)token=null; throw new Error('product_sheet_read_failed_'+res.status); }
    const rows=parseSheet(await res.json());
    cache={rows,fetchedAt:Date.now()};
    return cache;
  })();
  try { return await pending; } finally { pending=null; }
}
// A successful live read is authoritative, including deliberately cleared links.
// On a connection failure, do not interrupt order processing.
async function applyLiveProductLinks(items) {
  if (!configured() || !Array.isArray(items) || !items.length) return items;
  let live; try { live=await loadProductLinks(); } catch (_) { return items; }
  const byId=new Map();
  for (const row of live.rows) if(row.id && !byId.has(row.id))byId.set(row.id,row.link);
  for (const item of items) {
    const key=[item.productSlug,item.productId].find(id=>id && byId.has(id));
    if(key){item.productLink=byId.get(key);item.productLinkLive=true;}
  }
  return items;
}
module.exports={SHEET_URL,configured,loadProductLinks,applyLiveProductLinks,parseSheet,cellLink};
