'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase, importOpeningExpenseLedger, OPENING_EXPENSE_ROWS } = require('../lib/database.js');


test('opening spreadsheet expenses import once, preserve joint payers and calculate exact balances', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-splits-'));
  let db;
  try {
    db=createDatabase({sqlitePath:path.join(dir,'ledger.sqlite'),databaseUrl:''});
    await db.init();
    await importOpeningExpenseLedger(db);
    await importOpeningExpenseLedger(db);
    let ledger=await db.listAdminExpenses();
    assert.equal(OPENING_EXPENSE_ROWS.length,4);
    assert.equal(ledger.total,4,'deploy/restart does not duplicate imported expense rows');
    assert.equal(ledger.totalAgorot,135844);
    assert.equal(ledger.maorAgorot,73054);
    assert.equal(ledger.galAgorot,62790);
    assert.equal(ledger.galAgorot-ledger.maorAgorot,-10264);
    assert.equal(ledger.unallocatedAgorot,0);
    const joint=ledger.rows.find(row=>row.amount_agorot===102454);
    assert.equal(joint.maor_agorot,50054);assert.equal(joint.gal_agorot,52400);
    const september=await db.listAdminExpenses({from:'2026-09-22',to:'2026-09-30'});
    assert.equal(september.total,3);
    assert.equal(september.maorAgorot,23000);
    assert.equal(september.galAgorot,10390);
    await db.createAdminExpense({description:'משלוח',category:'משלוחים',amountAgorot:2500,maorAgorot:2000,galAgorot:500,expenseDate:'2026-10-21',employeeUserId:null,employeeName:'עובד',requestId:'b00c0000-0000-4000-8000-000000000001',createdAt:Date.now()});
    ledger=await db.listAdminExpenses();
    assert.equal(ledger.total,5);
    assert.equal(ledger.maorAgorot,75054);
    assert.equal(ledger.galAgorot,63290);
  } finally { if(db)await db.close();fs.rmSync(dir,{recursive:true,force:true}); }
});

test('sqlite migration preserves pre-existing unassigned expenses without guessing who paid',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-legacy-ledger-'));
  let db;
  try{
    db=createDatabase({sqlitePath:path.join(dir,'legacy.sqlite'),databaseUrl:''});await db.init();
    await db.createAdminExpense({description:'old expense',category:'אחר',amountAgorot:900,expenseDate:'2026-10-22',employeeUserId:null,employeeName:'מערכת',requestId:'a00c0000-0000-4000-8000-000000000001',createdAt:Date.now()});
    await db.close();db=createDatabase({sqlitePath:path.join(dir,'legacy.sqlite'),databaseUrl:''});await db.init();
    const data=await db.listAdminExpenses();
    assert.equal(data.unallocatedAgorot,900);assert.equal(data.maorAgorot,0);assert.equal(data.galAgorot,0);
    assert.equal(data.rows[0].maor_agorot,null);assert.equal(data.rows[0].gal_agorot,null);
  }finally{if(db)await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('finance ledger: persists employee snapshots and avoids duplicate expenses while reflecting paid orders once', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-finance-'));
  const sqlitePath=path.join(dir,'finance.sqlite');
  let db;
  try {
    db=createDatabase({sqlitePath,databaseUrl:''});await db.init();
    const userId=await db.insertUser('רוני עובד','finance@example.com','hash',1000);
    const create={description:'קניית אריזות',category:'אריזות',amountAgorot:3990,expenseDate:'2026-10-21',employeeUserId:userId,employeeName:'רוני עובד',requestId:'11111111-1111-4111-8111-111111111111',createdAt:1700000000000};
    const first=await db.createAdminExpense(create);
    assert.equal(await db.createAdminExpense(create),first,'retry must return the original expense, not insert another');
    await assert.rejects(db.createAdminExpense({...create,employeeUserId:userId+1}),/expense_request_conflict/);
    await db.createAdminExpense({...create,description:'פרסום בפייסבוק',category:'פרסום ושיווק',amountAgorot:2100,expenseDate:'2026-10-22',requestId:'22222222-2222-4222-8222-222222222222'});
    let expenses=await db.listAdminExpenses({limit:50,offset:0});
    assert.equal(expenses.total,2);
    assert.equal(expenses.totalAgorot,6090);
    assert.equal(expenses.rows[1].employee_name,'רוני עובד');
    expenses=await db.listAdminExpenses({from:'2026-10-22',to:'2026-10-22',limit:50,offset:0});
    assert.equal(expenses.total,1);assert.equal(expenses.totalAgorot,2100);
    await db.insertPendingOrder({orderRef:'VS-PAID-1',userId,customerEmail:'finance@example.com',customerPhone:null,amountAgorot:19990,currency:'ILS',itemsJson:'[]',createdAt:1700000000000,updatedAt:1700000000000});
    await db.insertPendingOrder({orderRef:'VS-PENDING-2',userId,customerEmail:'finance@example.com',customerPhone:null,amountAgorot:5990,currency:'ILS',itemsJson:'[]',createdAt:1700000000000,updatedAt:1700000000000});
    assert.equal((await db.listAdminIncome()).total,0,'pending order should not count as income');
    const order=await db.getOrderByRef('VS-PAID-1');
    await db.markOrderPaid(1700000001000,order.id);
    await db.markOrderPaid(1700000002000,order.id);
    let income=await db.listAdminIncome();
    assert.equal(income.total,1,'payment verification retries are not extra income');
    assert.equal(income.totalAgorot,19990);
    assert.equal(income.rows[0].order_ref,'VS-PAID-1');
    assert.equal(income.rows[0].paid_at,1700000001000,'first paid time persists');
    const demoId=await db.insertPendingOrder({orderRef:'VS-DEMO-EXAMPLE',userId,customerEmail:'finance@example.com',customerPhone:null,amountAgorot:50000,currency:'ILS',itemsJson:'[]',createdAt:1700000000000,updatedAt:1700000000000});
    await db.markOrderPaid(1700000001000,demoId);
    income=await db.listAdminIncome();
    assert.equal(income.total,1,'demo payments never count as actual cash receipts');
    income=await db.listAdminIncome({since:1700000003000,limit:50,offset:0});
    assert.equal(income.total,0,'date filtering uses paid_at');
  } finally {if(db)await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('finance schema and queries are defined for PostgreSQL as well as SQLite', async () => {
  const pgCalls=[];
  const fakePool={query:async (sql,args)=>{
    pgCalls.push({sql,args});
    if(/RETURNING id/.test(sql))return {rows:[{id:42}]};
    if(/COUNT\(\*\)/.test(sql))return {rows:[{count:1,amount:1550,maor:1000,gal:550,unallocated:0}]};
    if(/SELECT .* FROM (admin_expenses|orders)/.test(sql))return {rows:[{}]};
    return {rows:[]};
  },end:async()=>{}};
  const db=createDatabase({databaseUrl:'postgres://localhost/nonexistent',pgPool:fakePool});
  const id=await db.createAdminExpense({description:'אריזה',category:'אריזות',amountAgorot:1550,expenseDate:'2026-10-21',employeeUserId:1,employeeName:'יעל',requestId:'12345678-1234-4234-8234-123456789012',createdAt:123});
  assert.equal(id,42);
  assert.equal((await db.listAdminExpenses({limit:10,offset:0})).totalAgorot,1550);
  assert.ok(pgCalls.some(x=>x.sql.includes('maor_agorot')));
  assert.equal((await db.listAdminIncome({since:1,before:2,limit:10,offset:0})).total,1);
  assert.ok(pgCalls.some(x=>x.sql.includes('status=\'paid\'')));
  await db.close();
});

test('finance HTTP API enforces roles, stamps staff identity, validates input and provides income order links', async () => {
  const crypto=require('node:crypto');
  const {spawn}=require('node:child_process');
  const net=require('node:net');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-finance-api-'));
  const sqlitePath=path.join(dir,'api.sqlite');
  let child;
  try {
    const db=createDatabase({sqlitePath,databaseUrl:''});await db.init();
    const adminId=await db.insertUser('מנהלת','camaraprodetect@gmail.com','hash',Date.now());
    const staffId=await db.insertUser('יעל','staff-finance@example.com','hash',Date.now(),null,{role:'staff'});
    const tokens={admin:'finance-test-admin-token-123456789',staff:'finance-test-staff-token-123456789'};
    for(const [name,id] of [['admin',adminId],['staff',staffId]])await db.insertSession(id,crypto.createHash('sha256').update(tokens[name]).digest('hex'),Date.now(),Date.now()+3600000);
    const orderId=await db.insertPendingOrder({orderRef:'VS-PAY-456',userId:adminId,customerEmail:'admin@example.com',customerPhone:null,amountAgorot:7590,currency:'ILS',itemsJson:'[]',createdAt:Date.now(),updatedAt:Date.now()});
    await db.markOrderPaid(Date.now(),orderId);
    await db.close();
    const port=await new Promise(resolve=>{const srv=net.createServer();srv.listen(0,'127.0.0.1',()=>{const p=srv.address().port;srv.close(()=>resolve(p));});});
    const base='http://127.0.0.1:'+port;
    child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',VERSANS_DB_PATH:sqlitePath,VERSANS_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
    let ready=false;
    for(let i=0;i<80;i++){
      try{const x=await fetch(base+'/');if(x.status){ready=true;break;}}catch(_){/* boot */}
      await new Promise(r=>setTimeout(r,40));
    }
    assert.equal(ready,true,'local server starts');
    const head=(role)=>({Cookie:'versans_session='+tokens[role],Accept:'application/json'});
    let response=await fetch(base+'/admin/expenses',{headers:head('staff'),redirect:'manual'});
    assert.equal(response.status,200,'staff can load expenses page');
    response=await fetch(base+'/admin/income',{headers:head('staff'),redirect:'manual'});
    assert.equal(response.status,403,'staff cannot load income page');
    response=await fetch(base+'/api/admin/finance/income',{headers:head('staff')});
    assert.equal(response.status,403,'staff cannot read business income');
    const requestId='44444444-4444-4444-8444-444444444444';
    const payload={description:'דוגמה הוצאה',category:'מוצרים ומלאי',date:'2026-10-21',amount:'42.50',requestId};
    for(let i=0;i<2;i++){
      response=await fetch(base+'/api/admin/finance/expenses',{method:'POST',headers:{...head('staff'),'Content-Type':'application/json',Origin:base},body:JSON.stringify(payload)});
      assert.equal(response.status,200,'staff can add expense idempotently');
    }
    response=await fetch(base+'/api/admin/finance/expenses',{headers:head('staff')});
    const expenses=await response.json();
    assert.equal(expenses.total,1);assert.equal(expenses.totalAgorot,4250);
    assert.equal(expenses.rows[0].employee_name,'יעל','actor is based on session, not client payload');
    assert.equal(expenses.unallocatedAgorot,4250,'legacy API rows have no fake payer assignments');
    response=await fetch(base+'/api/admin/finance/expenses',{method:'POST',headers:{...head('staff'),'Content-Type':'application/json',Origin:base},body:JSON.stringify({...payload,amount:'72.25',maorAmount:'22.25',galAmount:'50.00',requestId:'44444444-4444-4444-8444-444444444445'})});
    assert.equal(response.status,200,'joint payer amounts accepted');
    response=await fetch(base+'/api/admin/finance/expenses',{headers:head('staff')});
    const splitResult=await response.json();
    assert.equal(splitResult.total,2);
    assert.equal(splitResult.totalAgorot,11475);
    assert.equal(splitResult.maorAgorot,2225);assert.equal(splitResult.galAgorot,5000);
    response=await fetch(base+'/api/admin/finance/expenses',{method:'POST',headers:{...head('staff'),'Content-Type':'application/json',Origin:base},body:JSON.stringify({...payload,amount:'72.25',maorAmount:'23.00',galAmount:'50.00',requestId:'44444444-4444-4444-8444-444444444446'})});
    assert.equal(response.status,400,'split mismatch rejected');
    response=await fetch(base+'/api/admin/finance/expenses',{method:'POST',headers:{...head('staff'),'Content-Type':'application/json',Origin:'https://attacker.invalid'},body:JSON.stringify({...payload,requestId:'55555555-5555-4555-8555-555555555555'})});
    assert.equal(response.status,403,'cross-origin submission denied');
    response=await fetch(base+'/api/admin/finance/expenses',{method:'POST',headers:{...head('staff'),'Content-Type':'application/json'},body:JSON.stringify({...payload,date:'2026-13-92',requestId:'66666666-6666-4666-8666-666666666666'})});
    assert.equal(response.status,400,'invalid date is rejected');
    response=await fetch(base+'/api/admin/finance/income',{headers:head('admin')});
    const income=await response.json();
    assert.equal(income.total,1);assert.equal(income.rows[0].order_ref,'VS-PAY-456');
    response=await fetch(base+'/api/admin/finance/income?from=2050-01-01',{headers:head('admin')});
    assert.equal((await response.json()).total,0,'income time filter excludes old payment');
  } finally {
    if(child && child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,2000).unref();});}
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
