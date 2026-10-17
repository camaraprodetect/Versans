'use strict';

// IndexNow key is PUBLIC ownership proof, served at the site root.
// Notifications are best-effort and must never delay customer/admin requests.
const KEY = '6c51fa6e0664957af55406168079da160824064b';
const HOST = 'versans.com';
const KEY_PATH = '/' + KEY + '.txt';
const API = 'https://api.indexnow.org/indexnow';
function enabled() {
  return process.env.INDEXNOW_ENABLED !== 'false' &&
    (process.env.INDEXNOW_ENABLED === 'true' || process.env.RENDER === 'true' || process.env.NODE_ENV === 'production');
}
async function publish(paths) {
  if (!enabled() || typeof fetch !== 'function') return false;
  const urls = [...new Set((paths || []).filter(x => typeof x === 'string' && x.startsWith('/') && !x.startsWith('//') && x.length < 500))]
    .map(p => 'https://' + HOST + p).slice(0, 10000);
  if (!urls.length) return false;
  for (let i = 0; i < urls.length; i += 1000) {
    const body = {host:HOST, key:KEY, keyLocation:'https://' + HOST + KEY_PATH, urlList:urls.slice(i,i+1000)};
    try {
      const r = await fetch(API, {method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
      if (![200,202].includes(r.status)) console.warn('IndexNow response:', r.status);
    } catch (error) {
      console.warn('IndexNow best-effort notification failed:', error && error.message);
    }
  }
  return true;
}
module.exports = {KEY, KEY_PATH, publish};
