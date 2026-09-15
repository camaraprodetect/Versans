'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createDatabase } = require('../lib/database.js');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl) {
  let lastError;
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(baseUrl + '/');
      if (response.status) return;
    } catch (err) { lastError = err; }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError || new Error('server_not_ready');
}

async function makeAdminFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versans-admin-api-'));
  const sqlitePath = path.join(dir, 'test.sqlite');
  const db = createDatabase({ sqlitePath, databaseUrl: '' });
  await db.init();
  const adminId = await db.insertUser('Admin', 'camaraprodetect@gmail.com', 'hash', Date.now());
  const token = 'test-admin-token-0123456789abcdef';
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.insertSession(adminId, tokenHash, Date.now(), Date.now() + 60 * 60 * 1000);
  await db.close();
  return { dir, sqlitePath, token };
}

async function runServer(fixture) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: '', VERSANS_DB_PATH: fixture.sqlitePath, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl);
  } catch (err) {
    child.kill('SIGTERM');
    throw new Error(`server failed to start: ${stderr || err.message}`);
  }
  return { child, baseUrl, getStderr: () => stderr };
}

function adminHeaders(token) {
  return { Cookie: `versans_session=${encodeURIComponent(token)}`, Accept: 'application/json' };
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

test('protected admin shell is served for approved admin routes', async () => {
  const fixture = await makeAdminFixture();
  let running;
  try {
    running = await runServer(fixture);
    for (const route of ['/admin', '/admin/sales', '/admin/traffic', '/admin/reviews']) {
      const response = await fetch(running.baseUrl + route, { headers: adminHeaders(fixture.token), redirect: 'manual' });
      assert.equal(response.status, 200, route);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(await response.text(), /id="adminContent"/);
    }
    const unknown = await fetch(running.baseUrl + '/admin/not-a-page', { headers: adminHeaders(fixture.token), redirect: 'manual' });
    assert.equal(unknown.status, 404);
  } finally {
    if (running) await stopServer(running.child);
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('admin sales API counts paid orders only', async () => {
  const fixture = await makeAdminFixture();
  let running;
  try {
    const db = createDatabase({ sqlitePath: fixture.sqlitePath, databaseUrl: '' });
    await db.init();
    const now = Date.now();
    await db.insertPendingOrder({ orderRef: 'paid-api', userId: null, customerEmail: 'paid@example.com', customerPhone: null, amountAgorot: 25000, currency: 'ILS', itemsJson: JSON.stringify([{ id: 'mom-heart-01', qty: 2, unitPrice: 100, lineTotal: 200 }]), createdAt: now - 1000, updatedAt: now - 1000 });
    await db.markOrderPaid(now, 1);
    await db.insertPendingOrder({ orderRef: 'pending-api', userId: null, customerEmail: 'pending@example.com', customerPhone: null, amountAgorot: 90000, currency: 'ILS', itemsJson: JSON.stringify([{ id: 'mom-heart-01', qty: 10, unitPrice: 100, lineTotal: 1000 }]), createdAt: now, updatedAt: now });
    await db.close();

    running = await runServer(fixture);
    const response = await fetch(running.baseUrl + '/api/admin/sales?range=all', { headers: adminHeaders(fixture.token) });
    assert.equal(response.status, 200, running.getStderr());
    const data = await response.json();
    assert.equal(data.orderCount, 1);
    assert.equal(data.revenueAgorot, 25000);
    assert.equal(data.unitsSold, 2);
  } finally {
    if (running) await stopServer(running.child);
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});
