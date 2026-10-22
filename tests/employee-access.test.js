'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createDatabase}=require('../lib/database');
const policy=require('../lib/employee-access');

test('employee requests deny unlisted admin APIs and sensitive writes unless granted',()=>{
  const staff={role:'staff',permissions:['tasks.view','tasks.status']};
  assert.equal(policy.allowed(staff,'/api/admin/internal-tasks','GET'),true);
  assert.equal(policy.allowed(staff,'/api/admin/internal-tasks/11','PATCH'),true);
  assert.equal(policy.allowed(staff,'/api/admin/internal-tasks','POST'),false);
  assert.equal(policy.allowed(staff,'/api/admin/internal-tasks/11','DELETE'),false);
  assert.equal(policy.allowed(staff,'/api/admin/creators','POST'),false);
  assert.equal(policy.allowed(staff,'/api/admin/catalog','POST'),false);
  assert.equal(policy.allowed(staff,'/api/admin/customers','GET'),false);
  assert.equal(policy.allowed(staff,'/api/admin/search','GET'),false);
  assert.equal(policy.allowed(staff,'/api/admin/notification-center','GET'),false);
  assert.equal(policy.allowed(staff,'/api/admin/unexpected-new-endpoint','GET'),false);
  assert.equal(policy.allowed({role:'admin',permissions:[]},'/api/admin/creators','POST'),true);
});

test('new permissions grant access only to the explicitly allowed module/actions',()=>{
  const staff={role:'staff',permissions:['creators.view','tasks.view','tasks.assign']};
  assert.equal(policy.allowed(staff,'/api/admin/creators','GET'),true);
  assert.equal(policy.allowed(staff,'/api/admin/creators','POST'),false);
  assert.equal(policy.allowed(staff,'/api/admin/internal-tasks/11','PATCH'),true);
  assert.equal(policy.allowed(staff,'/api/admin/internal-tasks/11','DELETE'),false);
  assert.deepEqual(policy.withPagePermissions(['creators.edit']),['creators.edit','creators.view']);
  assert.equal(policy.withPagePermissions(['__proto__']),null);
});

test('employee permissions persist in the SQLite database between access manager instances',async(t)=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'versans-employee-test-'));
  const db=createDatabase({root:temp,sqlitePath:path.join(temp,'staff.sqlite')});
  t.after(async()=>{await db.close();fs.rmSync(temp,{recursive:true,force:true});});
  await db.init();
  const id=await db.insertUser('Worker','worker@test.invalid','hash',Date.now(),null,{role:'staff'});
  const first=policy.createEmployeeAccess(db);
  assert.deepEqual(await first.read(id),['tasks.view','tasks.status']);
  await first.write(id,['creators.edit','employees.permissions']);
  const second=policy.createEmployeeAccess(db);
  const keys=await second.read(id);
  assert.deepEqual(keys,['creators.edit','employees.permissions','creators.view','employees.view']);
  const employees=await second.staffList();
  assert.equal(employees.length,1);
  assert.deepEqual(employees[0].permissions,keys);
});
