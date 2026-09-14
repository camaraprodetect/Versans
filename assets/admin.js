(function () {
  'use strict';

  var state = { range: 'online', selectedVisitorId: null, loading: false };
  var rangeLabels = { online: 'Online עכשיו', today: 'היום', '3d': '3 ימים אחרונים', '7d': '7 ימים אחרונים', '30d': '30 ימים אחרונים' };
  var visitorCount = document.getElementById('visitorCount');
  var onlineCount = document.getElementById('onlineCount');
  var selectedRangeLabel = document.getElementById('selectedRangeLabel');
  var visitorList = document.getElementById('visitorList');
  var listStatus = document.getElementById('listStatus');
  var visitorDetails = document.getElementById('visitorDetails');
  var detailsName = document.getElementById('detailsName');
  var detailsBody = document.getElementById('detailsBody');

  function dateTime(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)); }
    catch (_) { return '—'; }
  }

  function relative(value) {
    if (!value) return '—';
    var seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
    if (seconds < 60) return 'לפני ' + seconds + ' שנ׳';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return 'לפני ' + minutes + ' דק׳';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return 'לפני ' + hours + ' שעות';
    return dateTime(value);
  }

  function text(value) { return value == null || value === '' ? '—' : String(value); }

  function make(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }

  async function api(url) {
    var response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (response.status === 403) {
      location.href = '/login';
      throw new Error('admin_required');
    }
    if (!response.ok) throw new Error('request_failed_' + response.status);
    return response.json();
  }

  function renderVisitors(items) {
    visitorList.replaceChildren();
    if (!items.length) {
      visitorList.appendChild(make('div', 'visitor-empty', 'אין מבקרים בטווח הזה עדיין.'));
      return;
    }
    items.forEach(function (visitor) {
      var row = make('button', 'visitor-row' + (state.selectedVisitorId === visitor.visitorId ? ' is-selected' : ''));
      row.type = 'button';
      row.dataset.visitorId = visitor.visitorId;

      var main = make('div', 'visitor-main');
      var nameLine = make('div', 'visitor-name-line');
      nameLine.appendChild(make('span', 'visitor-name', visitor.name));
      if (visitor.online) nameLine.appendChild(make('span', 'online-badge', 'Online'));
      main.appendChild(nameLine);
      main.appendChild(make('span', 'visitor-sub', visitor.email || (visitor.isLoggedIn ? 'משתמש מחובר' : 'אורח')));

      var page = make('div', 'visitor-cell visitor-page');
      page.appendChild(make('strong', '', visitor.currentPath || '/'));
      page.appendChild(make('small', '', visitor.lastTitle || 'עמוד נוכחי'));

      var device = make('div', 'visitor-cell visitor-device');
      device.appendChild(make('strong', '', [visitor.browser, visitor.os].filter(Boolean).join(' · ') || 'לא ידוע'));
      device.appendChild(make('small', '', visitor.deviceType || 'מכשיר'));

      var seen = make('div', 'visitor-cell');
      seen.appendChild(make('strong', '', relative(visitor.lastSeen)));
      seen.appendChild(make('small', '', visitor.pageViewCount + ' צפיות'));

      row.append(main, page, device, seen, make('span', 'visitor-chevron', '‹'));
      row.addEventListener('click', function () { openVisitor(visitor.visitorId); });
      visitorList.appendChild(row);
    });
  }

  function detailItem(label, value) {
    var item = make('div', 'detail-item');
    item.appendChild(make('span', '', label));
    item.appendChild(make('strong', '', text(value)));
    return item;
  }

  function section(title, items) {
    var node = make('section', 'detail-section');
    node.appendChild(make('h3', '', title));
    var grid = make('div', 'detail-grid');
    items.forEach(function (pair) { grid.appendChild(detailItem(pair[0], pair[1])); });
    node.appendChild(grid);
    return node;
  }

  function renderDetails(data) {
    var v = data.visitor;
    detailsName.textContent = v.name;
    detailsBody.replaceChildren();
    detailsBody.appendChild(section('זהות', [
      ['Visitor ID', v.visitorId], ['User ID', v.userId], ['שם', v.name], ['אימייל', v.email], ['טלפון', v.phone], ['מחובר לחשבון', v.isLoggedIn ? 'כן' : 'לא']
    ]));
    detailsBody.appendChild(section('פעילות', [
      ['Online', v.online ? 'כן' : 'לא'], ['נראה לאחרונה', dateTime(v.lastSeen)], ['כניסה ראשונה', dateTime(v.firstSeen)], ['עמוד נוכחי', v.currentPath], ['עמוד כניסה', v.entryPath], ['סה״כ צפיות', v.pageViewCount]
    ]));
    detailsBody.appendChild(section('מכשיר', [
      ['סוג מכשיר', v.deviceType], ['דפדפן', v.browser], ['מערכת הפעלה', v.os], ['שפה', v.language], ['מסך', v.screen && v.screen.width ? v.screen.width + '×' + v.screen.height : null], ['Viewport', v.viewport && v.viewport.width ? v.viewport.width + '×' + v.viewport.height : null]
    ]));
    detailsBody.appendChild(section('מקור הגעה', [
      ['Referrer', v.referrer], ['UTM Source', v.utm && v.utm.source], ['UTM Medium', v.utm && v.utm.medium], ['UTM Campaign', v.utm && v.utm.campaign], ['UTM Term', v.utm && v.utm.term], ['UTM Content', v.utm && v.utm.content]
    ]));

    if (v.account) {
      detailsBody.appendChild(section('חשבון VerSans', [
        ['Account ID', v.account.id], ['נוצר', dateTime(v.account.createdAt)], ['לקוח מאומת', v.account.verifiedCustomer ? 'כן' : 'לא'], ['הזמנות', v.account.orderCount], ['הזמנות ששולמו', v.account.paidOrderCount], ['ביקורות', v.account.reviewCount], ['הזמנה אחרונה', dateTime(v.account.lastOrderAt)], ['Session נוצר', dateTime(v.account.sessionCreatedAt)], ['Session בתוקף עד', dateTime(v.account.sessionExpiresAt)]
      ]));
    }

    var historySection = make('section', 'detail-section');
    historySection.appendChild(make('h3', '', 'היסטוריית עמודים'));
    var history = make('div', 'history');
    if (!data.pageViews.length) history.appendChild(make('p', 'detail-note', 'אין צפיות שמורות.'));
    data.pageViews.forEach(function (view) {
      var item = make('div', 'history-item');
      item.appendChild(make('strong', '', view.path));
      item.appendChild(make('span', '', (view.title ? view.title + ' · ' : '') + dateTime(view.viewedAt)));
      history.appendChild(item);
    });
    historySection.appendChild(history);
    detailsBody.appendChild(historySection);
    visitorDetails.hidden = false;
  }

  async function openVisitor(visitorId) {
    state.selectedVisitorId = visitorId;
    Array.prototype.forEach.call(visitorList.querySelectorAll('.visitor-row'), function (row) {
      row.classList.toggle('is-selected', row.dataset.visitorId === visitorId);
    });
    visitorDetails.hidden = false;
    detailsName.textContent = 'טוען…';
    detailsBody.replaceChildren(make('div', 'admin-loading', 'טוען את כל הפרטים…'));
    try {
      var data = await api('/api/admin/visitors/' + encodeURIComponent(visitorId));
      renderDetails(data);
    } catch (err) {
      detailsBody.replaceChildren(make('div', 'admin-error', 'לא ניתן לטעון את פרטי המבקר.'));
    }
  }

  async function loadVisitors() {
    if (state.loading) return;
    state.loading = true;
    listStatus.textContent = 'מרענן…';
    try {
      var mainPromise = api('/api/admin/visitors?range=' + encodeURIComponent(state.range));
      var onlinePromise = state.range === 'online' ? mainPromise : api('/api/admin/visitors?range=online&limit=1');
      var results = await Promise.all([mainPromise, onlinePromise]);
      var data = results[0];
      var onlineData = results[1];
      visitorCount.textContent = String(data.count);
      onlineCount.textContent = String(onlineData.count);
      selectedRangeLabel.textContent = rangeLabels[state.range];
      listStatus.textContent = data.count + ' מבקרים · עודכן ' + new Intl.DateTimeFormat('he-IL', { timeStyle: 'short' }).format(new Date());
      renderVisitors(data.visitors);
    } catch (err) {
      visitorList.replaceChildren(make('div', 'admin-error', 'לא ניתן לטעון נתוני מבקרים כרגע.'));
      listStatus.textContent = 'שגיאה בטעינת הנתונים';
    } finally {
      state.loading = false;
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function (button) {
    button.addEventListener('click', function () {
      state.range = button.dataset.range;
      state.selectedVisitorId = null;
      visitorDetails.hidden = true;
      Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function (item) { item.classList.toggle('is-active', item === button); });
      loadVisitors();
    });
  });

  document.getElementById('refreshVisitors').addEventListener('click', loadVisitors);
  document.getElementById('closeDetails').addEventListener('click', function () { visitorDetails.hidden = true; state.selectedVisitorId = null; });

  loadVisitors();
  setInterval(loadVisitors, 15 * 1000);
})();
