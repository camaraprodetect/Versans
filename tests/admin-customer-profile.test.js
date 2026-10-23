'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { createAdminCustomerProfile } = require('../lib/admin-customer-profile');
const { allowed } = require('../lib/employee-access');

function fixtures() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY,name TEXT,email TEXT,phone TEXT,role TEXT,is_blocked INTEGER,blocked_reason TEXT,created_at INTEGER,marketing_email_opt_in INTEGER,marketing_sms_opt_in INTEGER,marketing_whatsapp_opt_in INTEGER,is_verified_customer INTEGER,verified_customer_at INTEGER);
  CREATE TABLE orders (id INTEGER PRIMARY KEY,order_ref TEXT,user_id INTEGER,customer_email TEXT,status TEXT,amount_agorot INTEGER,currency TEXT,items_json TEXT,created_at INTEGER,paid_at INTEGER,updated_at INTEGER);
  CREATE TABLE coupons (id INTEGER PRIMARY KEY,user_id INTEGER,code TEXT,kind TEXT,discount_percent INTEGER,active INTEGER,created_at INTEGER,expires_at INTEGER,used_at INTEGER,used_order_ref TEXT);
  CREATE TABLE reviews (id INTEGER PRIMARY KEY,user_id INTEGER,review_product_id TEXT,rating INTEGER,body TEXT,status TEXT,created_at INTEGER,updated_at INTEGER);
  CREATE TABLE cancellation_requests (id INTEGER PRIMARY KEY,user_id INTEGER,request_ref TEXT,order_ref TEXT,request_type TEXT,status TEXT,created_at INTEGER,updated_at INTEGER);
  CREATE TABLE visitor_presence (visitor_id TEXT PRIMARY KEY,user_id INTEGER,first_seen INTEGER,last_seen INTEGER,traffic_source TEXT,utm_source TEXT,device_type TEXT,visit_count INTEGER,page_view_count INTEGER);
  CREATE TABLE visitor_page_views (id INTEGER PRIMARY KEY,user_id INTEGER,path TEXT,title TEXT,viewed_at INTEGER);
  CREATE TABLE sessions (id INTEGER PRIMARY KEY,user_id INTEGER,created_at INTEGER);`);
  db.exec(`INSERT INTO users VALUES (1,'Example','customer@example.test','0500000000','customer',0,NULL,1000,1,0,0,1,1200),
    (2,'Other','other@example.test','0500000000','customer',0,NULL,1500,0,0,0,0,NULL);
    INSERT INTO orders VALUES (1,'A',1,'customer@example.test','paid',12000,'ILS','[{"name":"צמיד","qty":2}]',2000,2200,2400),
    (2,'B',NULL,'CUSTOMER@example.test','paid',5000,'ILS','[]',3000,3100,3200),
    (3,'C',2,'other@example.test','paid',50000,'ILS','[]',3500,3600,3700),
    (4,'D',1,'customer@example.test','pending',7000,'ILS','[]',4000,NULL,4200),
    (5,'E',2,'customer@example.test','paid',9999,'ILS','[]',4500,4600,4700);
    INSERT INTO coupons VALUES (1,1,'WELCOME','welcome',3,1,2000,100000,3000,'A');
    INSERT INTO reviews VALUES (1,1,'bracelet',5,'Very nice','published',4500,4501);
    INSERT INTO cancellation_requests VALUES (1,1,'REQ-A','A','return','received',5000,5001);
    INSERT INTO visitor_presence VALUES ('vp1',1,1000,6100,'Google',NULL,'mobile',2,6),('vp2',2,1000,6200,'TikTok',NULL,'desktop',1,2);
    INSERT INTO visitor_page_views VALUES (1,1,'/products','Catalog',5500),(2,2,'/account','Account',5400);
    INSERT INTO sessions VALUES (1,1,5700);`);
  return db;
}

test('CRM profile reads paid/pending account orders and matching guest email without leaking other users', async()=>{
  const db=fixtures();
  const profile=createAdminCustomerProfile({db,backend:'sqlite'});
  const data=await profile.profile(1,{orderOffset:0,orderLimit:2,seeOrders:true,seeVisits:true});
  assert.equal(data.summary.orderCount,3);
  assert.equal(data.summary.paidOrderCount,2);
  assert.equal(data.summary.paidSpendAgorot,17000);
  assert.equal(data.orders.items.length,2);
  assert.equal(data.orders.hasMore,true);
  const last=await profile.profile(1,{orderOffset:2,orderLimit:2,seeOrders:true,seeVisits:true});
  assert.deepEqual(last.orders.items.map(o=>o.orderRef),['A']);
  assert.equal(last.orders.items[0].items[0].quantity,2);
  assert.equal(data.coupons[0].code,'WELCOME');
  assert.equal(data.reviews[0].rating,5);
  assert.equal(data.requests[0].orderRef,'A');
  assert.equal(data.visits[0].source,'Google');
  assert.ok(!data.activity.some(a=>a.path==='/account'));
  assert.equal(await profile.profile(123,{seeOrders:true}),null);
  db.close();
});

test('CRM profile masks order and web history without granular permissions',async()=>{
  const db=fixtures();const data=await createAdminCustomerProfile({db,backend:'sqlite'}).profile(1,{seeOrders:false,seeVisits:false});
  assert.equal(data.orders.items.length,0);
  assert.equal(data.summary.paidSpendAgorot,0);
  assert.equal(data.visits.length,0);
  assert.ok(!data.activity.some(a=>a.type==='page_view'||a.type==='paid_order'));
  const staff = {role:'staff',permissions:['customers.view']};
  assert.equal(allowed(staff,'/api/admin/customers/1/profile','GET'),true);
  assert.equal(allowed(staff,'/api/admin/customers/1/profile','POST'),false);
  assert.equal(allowed({role:'staff',permissions:[]},'/api/admin/customers/1/profile','GET'),false);
  db.close();
});
