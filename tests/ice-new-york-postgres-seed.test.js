'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {ensureIceNewYorkPostgres} = require('../lib/catalog-seeds/ensure-ice-new-york-postgres.js');
const product = require('../lib/catalog-seeds/ice-new-york-product.json');

function fakePostgres(initial = {}, shouldFail = false) {
  let overrides = JSON.parse(JSON.stringify(initial));
  let pending = null; const operations = [];
  const client = {
    async query(sql, args = []) {
      operations.push(sql);
      if (sql === 'BEGIN') {pending = JSON.parse(JSON.stringify(overrides));return {rows:[]};}
      if (sql === 'COMMIT') {overrides=pending;pending=null;return {rows:[]};}
      if (sql === 'ROLLBACK') {pending=null;return {rows:[]};}
      if (sql.startsWith('SELECT pg_advisory_xact_lock')) return {rows:[]};
      if (sql.startsWith('SELECT value FROM schema_meta')) return {rows:[{value:JSON.stringify(pending)}]};
      if (sql.startsWith('INSERT INTO schema_meta')) {
        if (shouldFail) throw new Error('database_write_failed');
        pending=JSON.parse(args[1]);return {rows:[]};
      }
      throw new Error(`unexpected SQL ${sql}`);
    },
    release() {operations.push('release');}
  };
  return { database:{backend:'postgres',_ensurePool(){},pool:{connect:async()=>client}}, getOverrides:()=>overrides,operations };
}

test('imports ICE NEW YORK into PG exactly once with supplied options',async()=>{
  const f=fakePostgres({'product-291':{title:{he:'existing product'}}});
  const a=await ensureIceNewYorkPostgres(f.database);
  assert.equal(a.inserted,true);
  assert.deepEqual(Object.keys(f.getOverrides()).sort(),['product-291','product-294']);
  assert.equal(f.getOverrides()['product-294'].price,389);
  assert.equal(f.getOverrides()['product-294'].compareAt,499);
  assert.deepEqual(f.getOverrides()['product-294'].sizes.map(s=>s.label.he),['45 ס״מ','50 ס״מ','55 ס״מ','60 ס״מ']);
  assert.deepEqual(f.getOverrides()['product-294'].colors.map(s=>s.label.he),['8 מ״מ','14 מ״מ']);
  const b=await ensureIceNewYorkPostgres(f.database);
  assert.deepEqual(b,{inserted:false,reason:'already_recorded',slug:'product-294'});
  assert.deepEqual(Object.keys(f.getOverrides()).sort(),['product-291','product-294']);
});

test('does not restore a product intentionally deleted by admin',async()=>{
  const f=fakePostgres({'product-294':null});
  assert.equal((await ensureIceNewYorkPostgres(f.database)).inserted,false);
  assert.equal(f.getOverrides()['product-294'],null);
});

test('does not write anything when backend is SQLite',async()=>{
  const f=fakePostgres();f.database.backend='sqlite';
  assert.deepEqual(await ensureIceNewYorkPostgres(f.database),{inserted:false,reason:'not_postgres'});
  assert.equal(f.operations.length,0);
});

test('rolls back on PG write error without losing existing products',async()=>{
  const f=fakePostgres({'product-291':{sku:'X'}},true);
  await assert.rejects(()=>ensureIceNewYorkPostgres(f.database),/database_write_failed/);
  assert.deepEqual(f.getOverrides(),{'product-291':{sku:'X'}});
  assert.ok(f.operations.includes('ROLLBACK'));
});

test('refuses collision with another product using the same SKU',async()=>{
  const f=fakePostgres({'product-1000':{sku:product.sku}});
  const r=await ensureIceNewYorkPostgres(f.database);
  assert.equal(r.inserted,false);
  assert.equal(r.reason,'already_exists_other_slug');
  assert.equal(f.getOverrides()['product-294'],undefined);
});

test('all supplied photos exist and are within upload limit',()=>{
  for (const image of product.images) {
    const filepath=path.join(__dirname,'..',image);
    const head=fs.readFileSync(filepath).subarray(0,8);
    assert.equal(head.toString('hex'),'89504e470d0a1a0a');
    assert.ok(fs.statSync(filepath).size<=6*1024*1024);
  }
});
