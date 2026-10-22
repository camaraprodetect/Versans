'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SqliteStore, POSTGRES_SCHEMA_SQL } = require('../lib/database');
const { classifyTrafficSource, visitorSource, buildAudienceSummary } = require('../lib/visitor-analytics');

test('traffic attribution prefers first-visit UTM, understands referrals, and does not trust lookalike hosts', () => {
  assert.equal(classifyTrafficSource({utmSource:'TikTok',referrer:'https://www.google.com/'}), 'TikTok');
  assert.equal(classifyTrafficSource({referrer:'https://l.instagram.com/?u=...'}), 'Instagram');
  assert.equal(classifyTrafficSource({referrer:'https://www.google.co.il/search?q=jewelry'}), 'Google');
  assert.equal(classifyTrafficSource({referrer:'https://versans.com/product/something'}), 'קישור ישיר');
  assert.equal(classifyTrafficSource({referrer:'https://instagram.com.evil.example/page'}), 'אתרים אחרים');
  assert.equal(classifyTrafficSource({utmSource:'summer_campaign'}), 'קמפיין אחר');
  assert.equal(classifyTrafficSource({}), 'קישור ישיר');
});

test('analytics groups unique browsers and shows both new and returning visitors', () => {
  const result = buildAudienceSummary([
    {visit_count: 1, traffic_source:'Google'},
    {visit_count: 4, traffic_source:'Google'},
    {visit_count: 2, traffic_source:'Instagram'},
    {visit_count: 1, utm_source:'tiktok'},
  ]);
  assert.equal(result.total, 4);
  assert.equal(result.newVisitors, 2);
  assert.equal(result.returningVisitors, 2);
  assert.deepEqual(result.sources.map(s => [s.name,s.count]), [['Google',2],['Instagram',1],['TikTok',1]]);
  assert.equal(visitorSource({traffic_source:'TikTok',referrer:'https://google.com/'}), 'TikTok');
});

test('visitor tracking is stable across page refresh, increments only after inactivity, and persists first source', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-visitor-analytics-'));
  const filename = path.join(dir, 'db.sqlite');
  let db = new SqliteStore(filename);
  try {
    await db.init();
    const visitorId = '99999999-9999-4999-8999-999999999999';
    const origin = 1_750_000_000_000;
    function record(now, kind, trafficSource) {
      return db.recordPresence({visitorId,userId:null,kind,now,path:'/product',title:'Product',referrer:'https://www.google.com/',utmSource:null,utmMedium:null,utmCampaign:null,utmTerm:null,utmContent:null,trafficSource,language:'he',browser:'Chrome',os:'Windows',deviceType:'desktop',screenWidth:1200,screenHeight:800,viewportWidth:1180,viewportHeight:700});
    }
    await record(origin,'pageview','Google');
    await record(origin+500,'pageview','Instagram');
    await record(origin+25_000,'heartbeat','TikTok');
    let row = (await db.getPresenceVisitor(visitorId)).visitor;
    assert.equal(Number(row.visit_count),1);
    assert.equal(row.traffic_source,'Google');
    await record(origin+1_850_000,'heartbeat','Instagram');
    row = (await db.getPresenceVisitor(visitorId)).visitor;
    assert.equal(Number(row.visit_count),2);
    assert.equal(row.traffic_source,'Google');
    const breakdown = buildAudienceSummary(await db.listPresenceAudience(origin+1_000_000));
    assert.deepEqual([breakdown.total,breakdown.newVisitors,breakdown.returningVisitors,breakdown.sources[0].name],[1,0,1,'Google']);
    assert.equal((await db.listPresenceAudience(origin+2_000_000)).length,0);
    await db.close();
    db = new SqliteStore(filename);
    await db.init();
    row = (await db.getPresenceVisitor(visitorId)).visitor;
    assert.equal(Number(row.visit_count),2);
    assert.equal(row.traffic_source,'Google');
    assert.match(POSTGRES_SCHEMA_SQL, /ALTER TABLE visitor_presence ADD COLUMN IF NOT EXISTS traffic_source TEXT/);
    assert.match(POSTGRES_SCHEMA_SQL, /ALTER TABLE visitor_presence ADD COLUMN IF NOT EXISTS visit_count INTEGER/);
  } finally {
    await db.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('SQLite upgrade adds columns to existing visitor records without resetting visitors', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-visitor-upgrade-'));
  const filename=path.join(dir,'db.sqlite');
  let db=new SqliteStore(filename);
  try {
    await db.init();
    db.db.exec('ALTER TABLE visitor_presence DROP COLUMN traffic_source; ALTER TABLE visitor_presence DROP COLUMN visit_count;');
    db.db.prepare("INSERT INTO visitor_presence(visitor_id,first_seen,last_seen) VALUES(?,?,?)")
      .run('33333333-3333-4333-8333-333333333333',100,200);
    await db.close();
    db=new SqliteStore(filename);
    await db.init();
    const records=await db.listPresenceAudience(null);
    assert.equal(records.length,1);
    assert.equal(Number(records[0].visit_count),1);
  } finally {await db.close(); fs.rmSync(dir,{recursive:true,force:true});}
});
