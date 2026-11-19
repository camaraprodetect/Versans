'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const js = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
const start = js.indexOf('  // Product-price edits and other sensitive changes must be reauthenticated');
const end = js.indexOf('  function showToast(message)', start);
assert(start >= 0 && end > start, 'product reauthentication and apiAction must exist');
const testModule = js.slice(start, end) + '\nthis.testApiAction = apiAction;';

function response(status, payload) {
  return {
    status, ok: status >= 200 && status < 300,
    json: async () => payload,
    clone() { return response(status, payload); }
  };
}

function node(tag) {
  return {
    tag, children: [], listeners: {}, attributes: {}, textContent: '', value: '', disabled: false,
    append(...items) { this.children.push(...items); },
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
    find(t) { if (this.tag === t) return this; for (const c of this.children) {const match = c.find?.(t); if (match) return match;} return null; },
    findAll(t) { return [ ...(this.tag === t ? [this] : []), ...this.children.flatMap(c => c.findAll?.(t) || []) ]; }
  };
}

function setup(fetchImpl) {
  const body = node('body');
  const document = { body, createElement: node };
  const win = { location: { pathname: '/admin', search: '', href: '' } };
  const context = { fetch: fetchImpl, document, window: win, Error, JSON, Promise, console, refreshCatalogUndo: async () => {} };
  vm.runInNewContext(testModule, context);
  return { apiAction: context.testApiAction, body, window: win };
}

const productUrl = '/api/admin/catalog/product-243';
const item = {product: {price: 489, compareAt: 600}};

async function tick() { await new Promise(r => setImmediate(r)); }

async function submitPassword(form, value) {
  const password = form.find('input');
  password.value = value;
  await form.listeners.submit({preventDefault() {}});
}

test('product price save: 428 opens masked-password dialog, reauths, and retries unchanged request once', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    if (url === productUrl && calls.filter(x => x.url === productUrl).length === 1) return response(428, {error:'reauth_required'});
    if (url === '/api/admin/employees/reauth') return response(200, {ok:true});
    return response(200, {ok:true, slug:'product-243'});
  };
  const { apiAction, body } = setup(fetchImpl);
  const savePromise = apiAction(productUrl, 'PUT', item);
  await tick();
  const modal = body.children[0];
  assert.equal(modal.className, 'vs-reauth-overlay');
  const form = modal.find('form');
  assert.equal(form.find('input').type, 'password');
  await submitPassword(form, 'example-password');
  const result = await savePromise;
  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(c => c.url), [productUrl, '/api/admin/employees/reauth', productUrl]);
  assert.equal(calls[0].options.headers['X-Versans-Admin-Reauth'], 'managed');
  assert.equal(calls[0].options.body, calls[2].options.body);
  assert.equal(JSON.parse(calls[1].options.body).password, 'example-password');
  assert.equal(modal.removed, true);
  assert.equal(form.find('input').value, '');
});

test('cancelling the challenge leaves the product untouched (no retry)', async () => {
  let requests = 0;
  const {apiAction, body} = setup(async () => {requests++; return response(428, {error:'reauth_required'});});
  const pending = apiAction(productUrl,'PUT',item);
  await tick();
  body.children[0].findAll('button')[0].listeners.click();
  await assert.rejects(pending, /האימות בוטל/);
  assert.equal(requests, 1);
});

test('wrong password shows a Hebrew error and allows another attempt', async () => {
  let checks = 0, edits = 0;
  const {apiAction, body} = setup(async (url) => {
    if (url === '/api/admin/employees/reauth') return response(++checks === 1 ? 401 : 200, {error:'reauth_failed'});
    edits++;
    return edits === 1 ? response(428, {error:'reauth_required'}) : response(200, {ok:true});
  });
  const save = apiAction(productUrl,'PUT',item);
  await tick();
  const form = body.children[0].find('form');
  await submitPassword(form, 'wrong');
  assert.match(form.findAll('p').at(-1).textContent, /הסיסמה שגויה/);
  assert.equal(edits, 1);
  await submitPassword(form, 'correct');
  assert.equal((await save).ok, true);
  assert.equal(edits, 2);
});

test('a second 428 is not retried forever', async () => {
  let edits = 0;
  const {apiAction, body} = setup(async (url) => {
    if (url === '/api/admin/employees/reauth') return response(200,{ok:true});
    edits++;
    return response(428,{error:'reauth_required'});
  });
  const save = apiAction(productUrl,'PUT',item);
  await tick();
  await submitPassword(body.children[0].find('form'), 'a');
  await assert.rejects(save, /reauth_required/);
  assert.equal(edits, 2);
});

test('non-challenge errors do not open a dialog', async () => {
  const {apiAction, body} = setup(async () => response(403,{error:'permission_denied'}));
  await assert.rejects(apiAction(productUrl,'PUT',item), /permission_denied/);
  assert.equal(body.children.length, 0);
});

test('managed admin calls bypass global stepup wrapper and retain the API response', async () => {
  const script = fs.readFileSync(path.join(__dirname, '../assets/admin-stepup.js'),'utf8');
  const RequestClass = globalThis.Request;
  let num = 0;
  const win = {
    fetch: async () => {num++; return response(428,{error:'reauth_required'});}
  };
  const context = {window:win,Request:RequestClass,URL,location:{href:'https://versans.com/admin',origin:'https://versans.com'},document:{},console};
  vm.runInNewContext(script,context);
  const r = await win.fetch('https://versans.com/api/admin/catalog/product-243',{method:'PUT',headers:{'X-Versans-Admin-Reauth':'managed'}});
  assert.equal(r.status,428);
  assert.equal(num,1);
});
