'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createDatabase} = require('../lib/database');
const {createAdminTools} = require('../lib/admin-tools');

async function withTasks(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-task-status-'));
  const db = createDatabase({sqlitePath: path.join(dir, 'tasks.sqlite'), databaseUrl: ''});
  t.after(async () => { await db.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  await db.init();
  const actorId = await db.insertUser('Manager', 'manager@example.invalid', 'hash', Date.now(), null, {role: 'admin'});
  const tasks = createAdminTools(db, {list: () => []});
  return {tasks, actorId, db};
}

test('changing only a task status persists and keeps all other task fields unchanged', async (t) => {
  const {tasks, actorId} = await withTasks(t);
  const created = await tasks.addTask({
    title: 'Fix product page', description: 'Keep details intact', type: 'bug',
    status: 'open', priority: 'urgent', dueDate: '2026-10-30'
  }, actorId);
  const done = await tasks.updateTask(created.id, {updatedAt: created.updatedAt, status: 'done'}, actorId);
  assert.equal(done.status, 'done');
  assert.ok(done.completedAt);
  assert.ok(done.updatedAt > created.updatedAt);
  assert.deepEqual([done.title, done.description, done.type, done.priority, done.dueDate],
    ['Fix product page', 'Keep details intact', 'bug', 'urgent', '2026-10-30']);
  assert.equal((await tasks.listTasks())[0].status, 'done');
  const reopened = await tasks.updateTask(created.id, {updatedAt: done.updatedAt, status: 'in_progress'}, actorId);
  assert.equal(reopened.status, 'in_progress');
  assert.equal(reopened.completedAt, null);
  assert.equal((await tasks.listTasks())[0].status, 'in_progress');
});

test('partial edits preserve unspecified fields; old timestamps cannot overwrite newer task status', async (t) => {
  const {tasks, actorId} = await withTasks(t);
  const created = await tasks.addTask({title: 'Task', description: 'Old description', status: 'open'}, actorId);
  const changed = await tasks.updateTask(created.id, {updatedAt: created.updatedAt, title: 'Updated task'}, actorId);
  assert.equal(changed.title, 'Updated task');
  assert.equal(changed.description, 'Old description');
  assert.equal(changed.status, 'open');
  await assert.rejects(
    tasks.updateTask(created.id, {updatedAt: created.updatedAt, status: 'done'}, actorId),
    err => err.message === 'task_changed' && err.code === 409
  );
  assert.equal((await tasks.listTasks())[0].status, 'open');
  await assert.rejects(
    tasks.updateTask(created.id, {updatedAt: changed.updatedAt, status: 'bad_status'}, actorId),
    err => err.message === 'invalid_task' && err.code === 400
  );
  assert.equal((await tasks.listTasks())[0].status, 'open');
});

test('full task edits remain supported', async (t) => {
  const {tasks, actorId} = await withTasks(t);
  const created = await tasks.addTask({title: 'Original', status: 'open'}, actorId);
  const edited = await tasks.updateTask(created.id, {
    updatedAt: created.updatedAt, title: 'Renamed', description: 'More info',
    type: 'feature', status: 'done', priority: 'high', assignedTo: '', dueDate: ''
  }, actorId);
  assert.equal(edited.title, 'Renamed');
  assert.equal(edited.status, 'done');
  assert.equal(edited.priority, 'high');
});

test('completing an assigned task works even after the employee account is disabled', async (t) => {
  const {tasks, actorId, db} = await withTasks(t);
  const employeeId = await db.insertUser('Worker', 'worker@example.invalid', 'hash', Date.now(), null, {role: 'staff'});
  const created = await tasks.addTask({title: 'Employee task', assignedTo: 'worker@example.invalid'}, actorId);
  db.db.prepare('UPDATE users SET is_blocked=1 WHERE id=?').run(employeeId);
  const done = await tasks.updateTask(created.id, {updatedAt: created.updatedAt, status: 'done'}, actorId);
  assert.equal(done.status, 'done');
  assert.equal((await tasks.listTasks()).find(task => task.id === created.id).status, 'done');
});
