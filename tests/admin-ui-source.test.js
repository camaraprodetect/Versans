'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'admin.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets', 'admin.js'), 'utf8');

test('admin shell contains navigation and application mount points', () => {
  for (const page of ['dashboard','visitors','sales','orders','products','customers','traffic','reviews']) {
    assert.match(html, new RegExp(`href="/admin/${page}"`));
    assert.match(html, new RegExp(`data-admin-page="${page}"`));
  }
  assert.match(html, /id="adminPageTitle"/);
  assert.match(html, /id="adminPageSubtitle"/);
  assert.match(html, /id="adminContent"/);
  assert.match(html, /id="adminMobileNav"/);
  assert.match(html, /id="adminToast"/);
});

test('admin stylesheet defines modern responsive dashboard primitives', () => {
  assert.match(css, /--admin-navy:\s*#142333/);
  assert.match(css, /\.admin-sidebar/);
  assert.match(css, /\.admin-kpi-grid/);
  assert.match(css, /\.admin-table-wrap/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
});

test('admin script contains every page renderer and protected endpoint', () => {
  for (const renderer of ['renderDashboardPage','renderVisitorsPage','renderSalesPage','renderOrdersPage','renderProductsPage','renderCustomersPage','renderTrafficPage','renderReviewsPage']) {
    assert.match(js, new RegExp(`function\\s+${renderer}\\b`));
  }
  for (const endpoint of ['/api/admin/overview','/api/admin/visitors','/api/admin/sales','/api/admin/orders','/api/admin/products','/api/admin/customers','/api/admin/traffic','/api/admin/reviews']) {
    assert.ok(js.includes(endpoint), endpoint);
  }
  for (const utility of ['moneyAgorot','renderKpis','renderTable','renderRangeFilter','renderPagination','renderSalesChart']) {
    assert.match(js, new RegExp(`function\\s+${utility}\\b`));
  }
});


test('admin assets use a fresh deployment version and are never cached by the server', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(html, /admin\.css\?v=20260916-admin-v3/);
  assert.match(html, /admin\.js\?v=20260916-admin-v3/);
  assert.match(server, /pathname === ['"]\/assets\/admin\.js['"]/);
  assert.match(server, /pathname === ['"]\/assets\/admin\.css['"]/);
  assert.match(server, /Cache-Control['"], ['"]no-store['"]/);
});
