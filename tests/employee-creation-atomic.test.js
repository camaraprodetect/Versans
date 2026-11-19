'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createDatabase} = require('../lib/database');
const {createEmployeeAccess} = require('../lib/employee-access');

test('employee insert, permissions, profile and audit commit together',async(t)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-employee-atomic-'));
  const db=createDatabase({root:dir,sqlitePath:path.join(dir,'test.sqlite')});
  t.after(async()=>{await db.close();fs.rmSync(dir,{recursive:true,force:true});});
  await db.init();
  const access=createEmployeeAccess(db);
  await access.init();
  await access.profile(99999); // Ensures profile and audit tables exist before the transaction.
  const actor={id:1,name:'Owner'};
  const email='atomic-success@example.test';
  await db.transaction(async(tx)=>{
    const accountId=await tx.insertUser('Worker',email,'test-hash',Date.now(),null,{role:'staff'});
    const scopedAccess=createEmployeeAccess(tx);
    await scopedAccess.write(accountId,['products.edit']);
    await scopedAccess.setProfile(accountId,{preset:'',expiresAt:null});
    await scopedAccess.audit(actor,'employees','create','New employee',accountId);
  });
  const saved=await db.findUserByEmail(email);
  assert.ok(saved);
  assert.equal(saved.role,'staff');
  assert.deepEqual(await access.read(saved.id),['products.edit','products.view']);
  assert.equal((await access.auditList({limit:10})).length,1);
});

test('failed employee setup rolls back the new account and permission writes',async(t)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'versans-employee-rollback-'));
  const db=createDatabase({root:dir,sqlitePath:path.join(dir,'test.sqlite')});
  t.after(async()=>{await db.close();fs.rmSync(dir,{recursive:true,force:true});});
  await db.init();
  const access=createEmployeeAccess(db);
  await access.init();
  await access.profile(99999);
  const email='atomic-fail@example.test';
  await assert.rejects(db.transaction(async(tx)=>{
    const accountId=await tx.insertUser('Worker',email,'test-hash',Date.now(),null,{role:'staff'});
    const scopedAccess=createEmployeeAccess(tx);
    await scopedAccess.write(accountId,['products.edit']);
    throw new Error('Simulated failure saving employee profile');
  }),/Simulated failure/);
  assert.equal(await db.findUserByEmail(email),null);
  assert.equal((await access.staffList()).length,0);
});
