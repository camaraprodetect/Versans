'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createDatabase}=require('../lib/database');
const {createAdminTools}=require('../lib/admin-tools');

test('PDF report data includes income, expenses and combined reports with precise date, summaries and demo exclusion',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-finance-export-'));
  let db;
  try {
    db=createDatabase({sqlitePath:path.join(dir,'report.sqlite'),databaseUrl:''});await db.init();
    const manager={list:()=>[]};const reports=createAdminTools(db,manager);
    const userId=await db.insertUser('עובד','report@example.com','hash',Date.now());
    for(const [ref,amount,date,paid] of [
      ['VS-REPORT-1',20000,'2026-10-20T21:30:00Z',true],
      ['VS-REPORT-2',15000,'2026-10-21T21:30:00Z',true],
      ['VS-DEMO-REPORT',90000,'2026-10-20T21:30:00Z',true],
      ['VS-PENDING-REPORT',30000,'2026-10-20T21:30:00Z',false]]){
      const time=Date.parse(date);
      const id=await db.insertPendingOrder({orderRef:ref,userId,customerEmail:'report@example.com',customerPhone:null,amountAgorot:amount,currency:'ILS',itemsJson:'[]',createdAt:time,updatedAt:time});
      if(paid)await db.markOrderPaid(time,id);
    }
    const expense={category:'אריזות',expenseDate:'2026-10-21',employeeUserId:userId,employeeName:'עובד',createdAt:Date.now()};
    await db.createAdminExpense({...expense,description:'קופסה',amountAgorot:6000,maorAgorot:4000,galAgorot:2000,requestId:'b0000000-0000-4000-8000-000000000001'});
    await db.createAdminExpense({...expense,description:'קופסה נוספת',amountAgorot:4500,maorAgorot:1000,galAgorot:3500,requestId:'b0000000-0000-4000-8000-000000000002'});
    let data=await reports.report({type:'income',from:'2026-10-21',to:'2026-10-21'});
    assert.equal(data.type,'income');assert.equal(data.rows.length,1);
    assert.equal(data.rows[0].order,'VS-REPORT-1','Israel local date is used, not UTC date');
    assert.equal(data.summary.length,1);assert.match(data.summary[0].value,/200/);
    assert.equal(data.rows.some(x=>String(x.order).includes('DEMO')),false);
    data=await reports.report({type:'expenses',from:'2026-10-21',to:'2026-10-21'});
    assert.equal(data.rows.length,2);assert.equal(data.totalCount,2);
    assert.ok(data.columns.some(x=>x.key==='maor'));
    assert.ok(data.columns.some(x=>x.key==='employee'));
    assert.ok(data.summary.some(x=>x.label.includes('מאזן')));
    data=await reports.report({type:'finance',from:'2026-10-21',to:'2026-10-21'});
    assert.equal(data.rows.length,3);assert.equal(data.totalCount,3);
    assert.equal(data.rows.filter(x=>x.kind==='הכנסה').length,1);
    assert.equal(data.rows.filter(x=>x.kind==='הוצאה').length,2);
    assert.ok(data.summary.some(x=>x.label.includes('יתרה')));
    data=await reports.report({type:'finance',from:'2026-10-21',to:'2026-10-21',limit:'2'});
    assert.equal(data.rows.length,2);assert.equal(data.truncated,true);
    assert.equal(data.totalCount,3);
    await assert.rejects(reports.report({type:'finance',from:'2026-10-22',to:'2026-10-21'}),/invalid_date_range/);
  } finally{if(db)await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
