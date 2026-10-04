(function () {
  'use strict';

  var content = document.getElementById('adminContent');
  var pageTitle = document.getElementById('adminPageTitle');
  var pageSubtitle = document.getElementById('adminPageSubtitle');
  var refreshButton = document.getElementById('adminRefresh');
  var sidebar = document.getElementById('adminSidebar');
  var sidebarClose = document.getElementById('adminSidebarClose');
  var sidebarBackdrop = document.getElementById('adminSidebarBackdrop');
  var mobileNav = document.getElementById('adminMobileNav');
  var toast = document.getElementById('adminToast');
  var pushButton = document.getElementById('adminPushToggle');
  var requestedOrderRef = new URLSearchParams(window.location.search).get('order') || '';
  var requestedOrderOpened = false;
  var pushConfigPromise = null;
  var pushRegistrationPromise = null;

  var pageMeta = {
    dashboard: ['Dashboard', 'תמונה מהירה של המכירות, המבקרים והלקוחות של VerSans'],
    visitors: ['מבקרים', 'מי נמצא באתר, מי ביקר בעבר ואיך הוא השתמש באתר'],
    sales: ['מכירות', 'נתוני הכנסות ומוצרים על בסיס הזמנות ששולמו בלבד'],
    orders: ['טיפול בהזמנות', 'טיפול, Tracking, Google Sheets ופרטי הזמנה במקום אחד'],
    'order-work': ['טיפול בהזמנות', 'טיפול, Tracking, Google Sheets ופרטי הזמנה במקום אחד'],
    products: ['מוצרים', 'ביצועי המוצרים לפי מכירות ששולמו'],
    customers: ['לקוחות', 'משתמשים רשומים, רכישות והוצאות מצטברות'],
    reviews: ['ביקורות', 'דירוגים, מוצרים מובילים וביקורות אחרונות']
  };

  var rangeOptions = [
    { value: 'today', label: 'היום' },
    { value: '7d', label: '7 ימים' },
    { value: '30d', label: '30 ימים' },
    { value: 'all', label: 'כל הזמנים' }
  ];

  var orderWorkRangeOptions = [
    { value: 'today', label: 'היום' },
    { value: '3d', label: '3 ימים אחרונים' },
    { value: '7d', label: 'שבוע אחרון' },
    { value: '30d', label: 'חודש אחרון' },
    { value: 'all', label: 'כל הזמנים' }
  ];

  var orderWorkStatusOptions = [
    { value: 'all', label: 'הכול', tone: 'all' },
    { value: 'red', label: 'אדומות', tone: 'red' },
    { value: 'partial', label: 'חלקיות', tone: 'partial' },
    { value: 'green', label: 'ירוקות', tone: 'green' }
  ];

  var visitorRangeOptions = [
    { value: 'online', label: 'Online עכשיו' },
    { value: 'today', label: 'היום' },
    { value: '3d', label: '3 ימים' },
    { value: '7d', label: '7 ימים' },
    { value: '30d', label: '30 ימים' },
    { value: 'all', label: 'כל הזמנים' }
  ];

  var state = {
    page: currentPage(),
    ranges: { dashboard: '30d', sales: '30d', orders: '30d', orderWork: '30d', products: '30d', reviews: '30d', visitors: 'online' },
    ordersStatus: 'paid',
    orderWorkStatus: 'all',
    offsets: { visitors: 0, orders: 0, orderWork: 0, products: 0, customers: 0 },
    selectedVisitorId: null,
    requestVersion: 0
  };

  function currentPage() {
    var path = window.location.pathname.replace(/\/+$/, '');
    if (path === '/admin' || path === '/admin.html' || path === '/admin/dashboard') return 'dashboard';

    /* /admin/orders is now permanently merged into the order workbench. */
    if (path === '/admin/orders') {
      var target = '/admin/order-work' + (window.location.search || '') + (window.location.hash || '');
      window.history.replaceState(null, '', target);
      return 'order-work';
    }

    var match = /^\/admin\/(visitors|sales|order-work|products|customers|reviews)$/.exec(path);
    return match ? match[1] : 'dashboard';
  }

  function make(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i += 1) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return parent;
  }

  function text(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback === undefined ? '—' : fallback;
    return String(value);
  }

  function numberFmt(value) {
    var n = Number(value || 0);
    return new Intl.NumberFormat('he-IL').format(Number.isFinite(n) ? n : 0);
  }

  function moneyAgorot(value) {
    var n = Number(value || 0) / 100;
    if (!Number.isFinite(n)) n = 0;
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function dateTime(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short'
      }).format(new Date(Number(value)));
    } catch (_) {
      return '—';
    }
  }

  function dateOnly(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short' }).format(new Date(Number(value)));
    } catch (_) {
      return '—';
    }
  }

  function relative(value) {
    if (!value) return '—';
    var delta = Math.max(0, Date.now() - Number(value));
    var seconds = Math.round(delta / 1000);
    if (seconds < 60) return 'לפני ' + Math.max(1, seconds) + ' שנ׳';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return 'לפני ' + minutes + ' דק׳';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return 'לפני ' + hours + ' שעות';
    var days = Math.round(hours / 24);
    if (days < 7) return 'לפני ' + days + ' ימים';
    return dateTime(value);
  }

  async function api(url) {
    var response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (response.status === 401 || response.status === 403) {
      window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      throw new Error('admin_required');
    }
    if (!response.ok) {
      var errorBody = null;
      try { errorBody = await response.json(); } catch (_) { errorBody = null; }
      throw new Error(errorBody && errorBody.error ? errorBody.error : 'request_failed_' + response.status);
    }
    return response.json();
  }

  async function apiAction(url, method, body) {
    var options = { method: method || 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    var response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
      window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      throw new Error('admin_required');
    }
    var payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    if (!response.ok) {
      var err = new Error(payload && (payload.message || payload.error) ? (payload.message || payload.error) : 'request_failed_' + response.status);
      err.code = payload && payload.error;
      err.payload = payload || null;
      throw err;
    }
    return payload || {};
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { toast.hidden = true; }, 2600);
  }

  function urlBase64ToUint8Array(value) {
    var padding = '='.repeat((4 - String(value || '').length % 4) % 4);
    var base64 = (String(value || '') + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = window.atob(base64);
    var output = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
  }

  function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
  }

  function promiseWithTimeout(promise, timeoutMs, code) {
    var timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise(function (_, reject) {
        timer = window.setTimeout(function () {
          var error = new Error(code || 'timeout');
          error.code = code || 'timeout';
          reject(error);
        }, timeoutMs);
      })
    ]).finally(function () {
      if (timer) window.clearTimeout(timer);
    });
  }

  function waitForWorkerActivation(worker, timeoutMs) {
    if (!worker || worker.state === 'activated') return Promise.resolve();
    return promiseWithTimeout(new Promise(function (resolve) {
      function onStateChange() {
        if (worker.state === 'activated' || worker.state === 'redundant') {
          worker.removeEventListener('statechange', onStateChange);
          resolve();
        }
      }
      worker.addEventListener('statechange', onStateChange);
    }), timeoutMs || 12000, 'service_worker_update_timeout');
  }

  async function readAdminWorkerVersion(worker) {
    if (!worker) return '';
    try {
      return await promiseWithTimeout(new Promise(function (resolve) {
        var channel = new MessageChannel();
        channel.port1.onmessage = function (event) {
          resolve(String(event && event.data && event.data.version || ''));
        };
        worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      }), 2500, 'worker_version_timeout');
    } catch (_) {
      return '';
    }
  }

  async function removeOldAdminWorkerRegistration(registration) {
    if (!registration) return;

    try {
      var oldSubscription = await registration.pushManager.getSubscription();
      if (oldSubscription) {
        var endpoint = String(oldSubscription.endpoint || '');
        if (endpoint) {
          try {
            await apiAction('/api/admin/push/unsubscribe', 'POST', { endpoint: endpoint });
          } catch (_) {}
        }
        try { await oldSubscription.unsubscribe(); } catch (_) {}
      }
    } catch (_) {}

    try { await registration.unregister(); } catch (_) {}
  }

  async function forceCurrentEnglishAdminWorker() {
    var registrations = await navigator.serviceWorker.getRegistrations();

    for (var i = 0; i < registrations.length; i += 1) {
      var registration = registrations[i];
      var worker = registration.active || registration.waiting || registration.installing;
      var scriptUrl = String(worker && worker.scriptURL || '');

      if (scriptUrl.indexOf('/admin-sw.js') === -1) continue;

      var version = await readAdminWorkerVersion(registration.active);
      if (version === '20260930-bilingual-v9') return registration;

      // An older VerSans Admin worker is still actually receiving pushes.
      // Remove its subscription and registration so iOS cannot keep using it.
      await removeOldAdminWorkerRegistration(registration);
    }

    var fresh = await navigator.serviceWorker.register('/admin-sw.js?v=20260930-bilingual-v9', {
      scope: '/',
      updateViaCache: 'none'
    });

    try { await fresh.update(); } catch (_) {}

    if (fresh.waiting) {
      fresh.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    return fresh;
  }

  async function ensureAdminPushRegistration() {
    if (!pushSupported()) throw new Error('push_not_supported');

    var registration = await forceCurrentEnglishAdminWorker();

    if (registration.installing) {
      try { await waitForWorkerActivation(registration.installing, 12000); } catch (_) {}
    }

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Wait briefly for the new worker to become the live registration.
    try {
      await promiseWithTimeout(navigator.serviceWorker.ready, 12000, 'service_worker_timeout');
    } catch (_) {}

    var latest = await navigator.serviceWorker.getRegistration('/');
    return latest || registration;
  }

  async function refreshAdminPushButton() {
    if (!pushButton) return;
    if (!pushSupported()) {
      pushButton.hidden = false;
      pushButton.disabled = true;
      pushButton.textContent = '🔕 לא נתמך';
      pushButton.title = 'הדפדפן הזה לא תומך בהתראות Web Push';
      return;
    }

    pushButton.hidden = false;
    if (Notification.permission === 'denied') {
      pushButton.disabled = false;
      pushButton.dataset.active = '0';
      pushButton.classList.remove('is-active');
      pushButton.textContent = '🔕 התראות חסומות';
      pushButton.title = 'יש לאפשר התראות ל-VerSans Admin בהגדרות המכשיר';
      return;
    }

    try {
      var registration = await promiseWithTimeout(
        pushRegistrationPromise || ensureAdminPushRegistration(),
        15000,
        'service_worker_timeout'
      );
      pushRegistrationPromise = Promise.resolve(registration);
      var subscription = await registration.pushManager.getSubscription();
      var active = Notification.permission === 'granted' && !!subscription;
      pushButton.disabled = false;
      pushButton.dataset.active = active ? '1' : '0';
      pushButton.classList.toggle('is-active', active);
      pushButton.textContent = active ? '🔔 התראות פעילות' : '🔔 הפעל התראות';
      pushButton.title = active ? 'התראות על הזמנות חדשות פעילות במכשיר הזה' : 'קבל התראה בכל פעם שנכנסת הזמנה חדשה';
    } catch (_) {
      pushButton.disabled = false;
      pushButton.dataset.active = '0';
      pushButton.classList.remove('is-active');
      pushButton.textContent = '🔔 הפעל התראות';
      pushButton.title = 'לחץ כדי לנסות שוב להפעיל התראות';
    }
  }

  async function enableAdminPush() {
    if (!pushSupported()) {
      showToast('המכשיר או הדפדפן הזה לא תומך בהתראות Push.');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('ההתראות חסומות. יש לאפשר אותן בהגדרות ההתראות של VerSans Admin.');
      return;
    }
    if (pushButton && pushButton.dataset.active === '1') {
      showToast('ההתראות כבר פעילות במכשיר הזה ✓');
      return;
    }

    // On iPhone the permission request must happen directly from the user's tap.
    var permission = Notification.permission;
    if (permission !== 'granted') permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      await refreshAdminPushButton();
      showToast('לא ניתנה הרשאה להתראות.');
      return;
    }

    if (pushButton) {
      pushButton.disabled = true;
      pushButton.textContent = 'מפעיל התראות…';
    }

    try {
      var registration = await promiseWithTimeout(
        pushRegistrationPromise || ensureAdminPushRegistration(),
        15000,
        'service_worker_timeout'
      );
      pushRegistrationPromise = Promise.resolve(registration);

      var config = pushConfigPromise ? await promiseWithTimeout(pushConfigPromise, 10000, 'push_config_timeout') : null;
      if (!config || !config.publicKey) {
        config = await promiseWithTimeout(api('/api/admin/push/config'), 10000, 'push_config_timeout');
      }
      if (!config || !config.publicKey) throw new Error('push_config_unavailable');

      var subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await promiseWithTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey)
          }),
          15000,
          'push_subscription_timeout'
        );
      }

      await promiseWithTimeout(
        apiAction('/api/admin/push/subscribe', 'POST', {
          subscription: subscription.toJSON ? subscription.toJSON() : JSON.parse(JSON.stringify(subscription))
        }),
        10000,
        'push_server_timeout'
      );

      await refreshAdminPushButton();
      showToast('התראות על הזמנות חדשות הופעלו ✓');
    } catch (error) {
      if (pushButton) {
        pushButton.disabled = false;
        pushButton.dataset.active = '0';
        pushButton.classList.remove('is-active');
        pushButton.textContent = '🔔 הפעל התראות';
      }

      var code = String(error && (error.code || error.message) || '');
      if (code.indexOf('service_worker') !== -1) {
        showToast('שירות ההתראות לא נטען. רענן את האפליקציה ונסה שוב.');
      } else if (code.indexOf('push_config') !== -1 || code.indexOf('push_server') !== -1) {
        showToast('השרת לא הצליח להפעיל התראות כרגע. נסה שוב.');
      } else {
        showToast('לא ניתן להפעיל התראות כרגע. נסה שוב.');
      }
    }
  }

  async function initAdminPush() {
    if (!pushButton) return;

    if (pushSupported()) {
      pushRegistrationPromise = ensureAdminPushRegistration();
      pushRegistrationPromise.catch(function () {});
      pushConfigPromise = api('/api/admin/push/config').catch(function () { return null; });
    }

    pushButton.addEventListener('click', function () {
      enableAdminPush().catch(function () {
        if (pushButton) {
          pushButton.disabled = false;
          pushButton.textContent = '🔔 הפעל התראות';
        }
        showToast('לא ניתן להפעיל התראות כרגע. נסה שוב.');
      });
    });

    // If iOS permission was already granted, automatically recreate the
    // subscription after replacing an old worker. No second permission prompt.
    if (pushSupported() && Notification.permission === 'granted') {
      try {
        var registration = await pushRegistrationPromise;
        var existing = await registration.pushManager.getSubscription();
        if (!existing) {
          var config = pushConfigPromise ? await pushConfigPromise : null;
          if (!config || !config.publicKey) {
            config = await api('/api/admin/push/config');
          }
          var subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey)
          });
          await apiAction('/api/admin/push/subscribe', 'POST', {
            subscription: subscription.toJSON ? subscription.toJSON() : JSON.parse(JSON.stringify(subscription))
          });
        }
      } catch (_) {}
    }

    await refreshAdminPushButton();
  }

  function setPageMeta(title, subtitle) {
    pageTitle.textContent = title;
    pageSubtitle.textContent = subtitle;
  }

  function setLoading() {
    var box = make('div', 'admin-page-loading');
    box.appendChild(make('span'));
    box.appendChild(make('p', '', 'טוען נתונים…'));
    content.replaceChildren(box);
  }

  function setError(error) {
    var card = make('div', 'admin-card');
    var body = make('div', 'admin-error');
    body.appendChild(make('strong', '', 'לא ניתן לטעון את הנתונים כרגע.'));
    body.appendChild(make('div', 'admin-table__muted', text(error && error.message, 'שגיאה לא ידועה')));
    card.appendChild(body);
    content.replaceChildren(card);
  }

  function card(title, subtitle, body, action) {
    var node = make('section', 'admin-card');
    var head = make('div', 'admin-card__head');
    var titleBox = make('div');
    titleBox.appendChild(make('h2', '', title));
    if (subtitle) titleBox.appendChild(make('p', '', subtitle));
    head.appendChild(titleBox);
    if (action) head.appendChild(action);
    node.appendChild(head);
    var cardBody = make('div', 'admin-card__body');
    if (body) cardBody.appendChild(body);
    node.appendChild(cardBody);
    return node;
  }

  function renderKpis(items) {
    var grid = make('div', 'admin-kpi-grid');
    items.forEach(function (item) {
      var node = make('article', 'admin-kpi' + (item.primary ? ' admin-kpi--primary' : ''));
      var label = make('div', 'admin-kpi__label');
      label.appendChild(make('span', '', item.label));
      label.appendChild(make('i', 'admin-kpi__dot' + (item.tone ? ' admin-kpi__dot--' + item.tone : '')));
      node.appendChild(label);
      node.appendChild(make('strong', 'admin-kpi__value', item.value));
      if (item.hint) node.appendChild(make('span', 'admin-kpi__hint', item.hint));
      grid.appendChild(node);
    });
    return grid;
  }

  function renderRangeFilter(current, options, onChange) {
    var group = make('div', 'admin-filter-group');
    (options || rangeOptions).forEach(function (option) {
      var button = make('button', option.value === current ? 'is-active' : '', option.label);
      button.type = 'button';
      button.dataset.range = option.value;
      button.addEventListener('click', function () {
        if (option.value === current) return;
        onChange(option.value);
      });
      group.appendChild(button);
    });
    return group;
  }

  function renderOrderWorkStatusFilter(current, counts, onChange) {
    var wrap = make('div', 'admin-order-work-filter-group admin-order-work-filter-group--status');
    orderWorkStatusOptions.forEach(function (option) {
      var count = counts && counts[option.value] != null ? Number(counts[option.value]) : 0;
      var button = make(
        'button',
        'admin-order-work-filter admin-order-work-filter--' + option.tone + (current === option.value ? ' is-active' : ''),
        option.label + ' · ' + numberFmt(count)
      );
      button.type = 'button';
      button.addEventListener('click', function () { onChange(option.value); });
      wrap.appendChild(button);
    });
    return wrap;
  }

  function renderStatusFilter(current, onChange) {
    var options = [
      { value: 'paid', label: 'Paid' },
      { value: 'pending', label: 'Pending' },
      { value: 'failed', label: 'Failed' },
      { value: 'all', label: 'הכל' }
    ];
    var group = make('div', 'admin-filter-group');
    options.forEach(function (option) {
      var button = make('button', option.value === current ? 'is-active' : '', option.label);
      button.type = 'button';
      button.addEventListener('click', function () { if (option.value !== current) onChange(option.value); });
      group.appendChild(button);
    });
    return group;
  }

  function cellPrimary(primary, secondary, mono) {
    var box = make('div');
    box.appendChild(make('span', mono ? 'admin-table__strong admin-table__mono' : 'admin-table__strong', text(primary)));
    if (secondary) box.appendChild(make('small', 'admin-table__muted', secondary));
    return box;
  }

  function badge(label, type) {
    return make('span', 'admin-badge admin-badge--' + (type || 'neutral'), label);
  }

  function statusBadge(status) {
    var value = String(status || 'unknown');
    if (value === 'paid') return badge('Paid', 'paid');
    if (value === 'pending') return badge('Pending', 'pending');
    if (value === 'failed') return badge('Failed', 'failed');
    return badge(value, 'neutral');
  }

  function renderTable(options) {
    var wrapper = make('section', 'admin-table-card');
    var head = make('div', 'admin-table-head');
    var titles = make('div');
    titles.appendChild(make('h2', '', options.title || 'טבלה'));
    if (options.subtitle) titles.appendChild(make('p', '', options.subtitle));
    head.appendChild(titles);
    if (options.action) head.appendChild(options.action);
    wrapper.appendChild(head);

    if (!options.rows || !options.rows.length) {
      wrapper.appendChild(make('div', 'admin-empty', options.emptyText || 'אין נתונים להצגה.'));
      return wrapper;
    }

    var scroll = make('div', 'admin-table-wrap');
    var table = make('table', 'admin-table');
    var thead = make('thead');
    var trHead = make('tr');
    options.columns.forEach(function (column) { trHead.appendChild(make('th', '', column.label)); });
    thead.appendChild(trHead);
    table.appendChild(thead);

    var tbody = make('tbody');
    options.rows.forEach(function (row) {
      var tr = make('tr', options.rowClass ? options.rowClass(row) : '');
      if (options.onRowClick) {
        tr.tabIndex = 0;
        tr.addEventListener('click', function () { options.onRowClick(row, tr); });
        tr.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            options.onRowClick(row, tr);
          }
        });
      }
      options.columns.forEach(function (column) {
        var td = make('td');
        var rendered = column.render ? column.render(row) : row[column.key];
        if (rendered instanceof Node) td.appendChild(rendered);
        else td.textContent = text(rendered);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    wrapper.appendChild(scroll);
    return wrapper;
  }

  function renderPagination(options) {
    var count = Number(options.count || 0);
    var limit = Number(options.limit || 50);
    var offset = Number(options.offset || 0);
    var pagination = make('div', 'admin-pagination');
    var prev = make('button', '', 'הקודם');
    var next = make('button', '', 'הבא');
    prev.type = next.type = 'button';
    prev.disabled = offset <= 0;
    next.disabled = offset + limit >= count;
    prev.addEventListener('click', function () { options.onChange(Math.max(0, offset - limit)); });
    next.addEventListener('click', function () { options.onChange(offset + limit); });
    var first = count ? offset + 1 : 0;
    var last = Math.min(count, offset + limit);
    pagination.append(prev, make('span', '', numberFmt(first) + '–' + numberFmt(last) + ' מתוך ' + numberFmt(count)), next);
    return pagination;
  }

  function israelTodayKey() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date());
      var values = {};
      parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
      return values.year + '-' + values.month + '-' + values.day;
    } catch (_) {
      var now = new Date();
      return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }
  }

  function salesDateUtcMs(dateKey) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
    if (!match) return NaN;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function salesDateKeyFromUtc(ms) {
    var date = new Date(ms);
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function formatSalesDate(dateKey) {
    var ms = salesDateUtcMs(dateKey);
    if (!Number.isFinite(ms)) return text(dateKey);
    try {
      return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms + 12 * 60 * 60 * 1000));
    } catch (_) {
      return text(dateKey);
    }
  }

  function fillDailySales(dailySales, range) {
    var original = Array.isArray(dailySales) ? dailySales.slice() : [];
    if (!original.length) return [];
    original.sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    var byDate = {};
    original.forEach(function (row) { byDate[String(row.date)] = row; });

    var firstMs = salesDateUtcMs(original[0].date);
    var lastMs = salesDateUtcMs(original[original.length - 1].date);
    var todayMs = salesDateUtcMs(israelTodayKey());
    if (!Number.isFinite(firstMs) || !Number.isFinite(lastMs)) return original;

    var startMs = firstMs;
    var endMs = Math.max(lastMs, Number.isFinite(todayMs) ? todayMs : lastMs);
    if (range === 'today' && Number.isFinite(todayMs)) startMs = endMs = todayMs;
    else if (range === '7d' && Number.isFinite(todayMs)) startMs = todayMs - 7 * 24 * 60 * 60 * 1000;
    else if (range === '30d' && Number.isFinite(todayMs)) startMs = todayMs - 30 * 24 * 60 * 60 * 1000;

    var rows = [];
    for (var cursor = startMs; cursor <= endMs; cursor += 24 * 60 * 60 * 1000) {
      var key = salesDateKeyFromUtc(cursor);
      rows.push(byDate[key] || { date: key, revenueAgorot: 0, orders: 0, unitsSold: 0 });
    }
    return rows;
  }

  function renderSalesChart(dailySales, range) {
    var wrap = make('div', 'admin-sales-chart');
    var rows = fillDailySales(dailySales, range);
    if (!rows.length) {
      wrap.appendChild(make('div', 'admin-chart-empty', 'אין מכירות ששולמו בטווח שנבחר.'));
      return wrap;
    }

    var startIndex = 0;
    var endIndex = rows.length - 1;
    var selectedIndex = null;
    var geometry = [];
    var selectedLine = null;
    var selectedDot = null;

    var toolbar = make('div', 'admin-sales-chart__toolbar');
    var help = make('span', 'admin-sales-chart__help', 'נוגעים/לוחצים על התרשים כדי לראות הכנסה של יום. בוחרים יום ואז עושים זום.');
    var controls = make('div', 'admin-sales-chart__controls');
    var zoomOut = make('button', 'admin-sales-chart__button', '−');
    var zoomIn = make('button', 'admin-sales-chart__button', '+');
    var focusDay = make('button', 'admin-sales-chart__button admin-sales-chart__button--wide', 'התמקד ביום');
    var reset = make('button', 'admin-sales-chart__button admin-sales-chart__button--wide', 'איפוס');
    [zoomOut, zoomIn, focusDay, reset].forEach(function (button) { button.type = 'button'; });
    zoomOut.setAttribute('aria-label', 'התרחק מהתרשים');
    zoomIn.setAttribute('aria-label', 'התקרב לתרשים');
    focusDay.setAttribute('aria-label', 'הצג רק את היום שנבחר');
    reset.setAttribute('aria-label', 'איפוס הזום');
    focusDay.disabled = true;
    controls.append(zoomOut, zoomIn, focusDay, reset);
    toolbar.append(help, controls);
    wrap.appendChild(toolbar);

    var shell = make('div', 'admin-sales-chart__shell');
    shell.tabIndex = 0;
    shell.setAttribute('role', 'application');
    shell.setAttribute('aria-label', 'תרשים הכנסות יומי אינטראקטיבי');

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'admin-sales-chart__svg');
    svg.setAttribute('viewBox', '0 0 1000 300');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    shell.appendChild(svg);

    var tooltip = make('div', 'admin-sales-chart__tooltip');
    tooltip.hidden = true;
    shell.appendChild(tooltip);
    wrap.appendChild(shell);

    var axis = make('div', 'admin-sales-chart__axis');
    var axisStart = make('span');
    var axisMiddle = make('span');
    var axisEnd = make('span');
    axis.append(axisStart, axisMiddle, axisEnd);
    wrap.appendChild(axis);

    var windowText = make('div', 'admin-sales-chart__window');
    wrap.appendChild(windowText);

    function svgNode(name, attrs) {
      var node = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      return node;
    }

    function visibleCount() {
      return Math.max(1, endIndex - startIndex + 1);
    }

    function pointAt(index) {
      return geometry[index - startIndex] || null;
    }

    function renderSelection() {
      if (!selectedLine || !selectedDot || selectedIndex === null || selectedIndex < startIndex || selectedIndex > endIndex) {
        if (selectedLine) selectedLine.setAttribute('visibility', 'hidden');
        if (selectedDot) selectedDot.setAttribute('visibility', 'hidden');
        return;
      }
      var point = pointAt(selectedIndex);
      if (!point) return;
      selectedLine.setAttribute('x1', point.x);
      selectedLine.setAttribute('x2', point.x);
      selectedLine.setAttribute('visibility', 'visible');
      selectedDot.setAttribute('cx', point.x);
      selectedDot.setAttribute('cy', point.y);
      selectedDot.setAttribute('visibility', 'visible');
    }

    function updateTooltip() {
      if (selectedIndex === null || selectedIndex < startIndex || selectedIndex > endIndex) {
        tooltip.hidden = true;
        return;
      }
      var row = rows[selectedIndex];
      var point = pointAt(selectedIndex);
      if (!row || !point) return;
      tooltip.replaceChildren();
      tooltip.appendChild(make('strong', '', formatSalesDate(row.date)));
      tooltip.appendChild(make('span', 'admin-sales-chart__tooltip-value', moneyAgorot(row.revenueAgorot)));
      tooltip.appendChild(make('small', '', numberFmt(row.orders) + ' הזמנות · ' + numberFmt(row.unitsSold) + ' יחידות'));
      tooltip.style.left = Math.max(10, Math.min(90, point.x / 10)) + '%';
      tooltip.hidden = false;
    }

    function render() {
      svg.replaceChildren();
      geometry = [];
      var visibleRows = rows.slice(startIndex, endIndex + 1);
      var maxRevenue = Math.max.apply(null, visibleRows.map(function (row) { return Number(row.revenueAgorot || 0); }).concat([1]));
      var yMax = Math.max(1, Math.ceil(maxRevenue * 1.12));

      [0, 0.25, 0.5, 0.75, 1].forEach(function (ratio) {
        var y = 270 - ratio * 240;
        svg.appendChild(svgNode('line', { x1: 0, y1: y, x2: 1000, y2: y, 'class': 'admin-sales-chart__grid' }));
      });

      visibleRows.forEach(function (row, localIndex) {
        var x = visibleRows.length === 1 ? 500 : (localIndex / (visibleRows.length - 1)) * 1000;
        var y = 270 - (Number(row.revenueAgorot || 0) / yMax) * 240;
        geometry.push({ x: x, y: y });
      });

      var path = geometry.map(function (point, index) {
        return (index === 0 ? 'M' : 'L') + point.x.toFixed(2) + ',' + point.y.toFixed(2);
      }).join(' ');
      if (geometry.length === 1) path = 'M' + geometry[0].x + ',' + geometry[0].y + ' L' + geometry[0].x + ',' + geometry[0].y;
      var areaPath = path;
      if (geometry.length) {
        areaPath += ' L' + geometry[geometry.length - 1].x.toFixed(2) + ',270 L' + geometry[0].x.toFixed(2) + ',270 Z';
      }
      svg.appendChild(svgNode('path', { d: areaPath, 'class': 'admin-sales-chart__area' }));
      svg.appendChild(svgNode('path', { d: path, 'class': 'admin-sales-chart__line' }));

      geometry.forEach(function (point) {
        svg.appendChild(svgNode('circle', { cx: point.x, cy: point.y, r: 4.5, 'class': 'admin-sales-chart__point' }));
      });

      selectedLine = svgNode('line', { x1: 0, y1: 20, x2: 0, y2: 270, 'class': 'admin-sales-chart__focus-line', visibility: 'hidden' });
      selectedDot = svgNode('circle', { cx: 0, cy: 0, r: 8, 'class': 'admin-sales-chart__focus-point', visibility: 'hidden' });
      svg.append(selectedLine, selectedDot);

      var middleIndex = Math.floor((startIndex + endIndex) / 2);
      axisStart.textContent = formatSalesDate(rows[startIndex].date);
      axisMiddle.textContent = formatSalesDate(rows[middleIndex].date);
      axisEnd.textContent = formatSalesDate(rows[endIndex].date);
      windowText.textContent = 'תצוגה: ' + formatSalesDate(rows[startIndex].date) + ' — ' + formatSalesDate(rows[endIndex].date) + ' · שיא בטווח: ' + moneyAgorot(maxRevenue);

      zoomIn.disabled = visibleCount() <= 1;
      zoomOut.disabled = visibleCount() >= rows.length;
      reset.disabled = startIndex === 0 && endIndex === rows.length - 1;
      focusDay.disabled = selectedIndex === null;
      renderSelection();
      updateTooltip();
    }

    function setWindow(centerIndex, count) {
      var size = Math.max(1, Math.min(rows.length, count));
      var start = Math.round(centerIndex - (size - 1) / 2);
      start = Math.max(0, Math.min(rows.length - size, start));
      startIndex = start;
      endIndex = start + size - 1;
      render();
    }

    function zoom(factor) {
      var count = visibleCount();
      var nextCount = factor < 1 ? Math.max(1, Math.ceil(count * factor)) : Math.min(rows.length, Math.ceil(count * factor));
      if (nextCount === count && factor < 1 && count > 1) nextCount = count - 1;
      var center = selectedIndex !== null ? selectedIndex : Math.round((startIndex + endIndex) / 2);
      setWindow(center, nextCount);
    }

    function selectFromClientX(clientX) {
      var rect = shell.getBoundingClientRect();
      if (!rect.width) return;
      var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var local = visibleCount() === 1 ? 0 : Math.round(ratio * (visibleCount() - 1));
      selectedIndex = Math.max(startIndex, Math.min(endIndex, startIndex + local));
      focusDay.disabled = false;
      renderSelection();
      updateTooltip();
    }

    zoomIn.addEventListener('click', function () { zoom(0.5); });
    zoomOut.addEventListener('click', function () { zoom(2); });
    focusDay.addEventListener('click', function () {
      if (selectedIndex !== null) setWindow(selectedIndex, 1);
    });
    reset.addEventListener('click', function () {
      startIndex = 0;
      endIndex = rows.length - 1;
      render();
    });

    shell.addEventListener('pointerdown', function (event) {
      selectFromClientX(event.clientX);
      try { shell.setPointerCapture(event.pointerId); } catch (_) {}
    });
    shell.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'mouse' || shell.hasPointerCapture && shell.hasPointerCapture(event.pointerId)) selectFromClientX(event.clientX);
    });
    shell.addEventListener('pointerleave', function (event) {
      if (event.pointerType === 'mouse') tooltip.hidden = true;
    });
    shell.addEventListener('pointerenter', function () {
      if (selectedIndex !== null) updateTooltip();
    });
    shell.addEventListener('dblclick', function (event) {
      selectFromClientX(event.clientX);
      if (selectedIndex !== null) setWindow(selectedIndex, 1);
    });
    shell.addEventListener('wheel', function (event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      selectFromClientX(event.clientX);
      zoom(event.deltaY < 0 ? 0.5 : 2);
    }, { passive: false });
    shell.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        var direction = event.key === 'ArrowLeft' ? -1 : 1;
        if (selectedIndex === null) selectedIndex = Math.round((startIndex + endIndex) / 2);
        else selectedIndex = Math.max(startIndex, Math.min(endIndex, selectedIndex + direction));
        renderSelection();
        updateTooltip();
        focusDay.disabled = false;
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault(); zoom(0.5);
      } else if (event.key === '-') {
        event.preventDefault(); zoom(2);
      } else if (event.key === 'Escape') {
        tooltip.hidden = true;
      }
    });

    render();
    return wrap;
  }

  function productCell(product) {
    var box = make('div', 'admin-product-cell');
    if (product.image) {
      var img = document.createElement('img');
      img.className = 'admin-product-thumb';
      img.src = product.image.charAt(0) === '/' ? product.image : '/' + product.image;
      img.alt = '';
      img.loading = 'lazy';
      box.appendChild(img);
    } else {
      box.appendChild(make('div', 'admin-product-thumb'));
    }
    var nameBox = make('div');
    if (product.href) {
      var link = make('a', 'admin-card__link', text(product.name, product.id));
      link.href = product.href;
      link.target = '_blank';
      link.rel = 'noopener';
      nameBox.appendChild(link);
    } else {
      nameBox.appendChild(make('strong', 'admin-table__strong', text(product.name, product.id)));
    }
    nameBox.appendChild(make('small', 'admin-table__muted admin-table__mono', text(product.id)));
    box.appendChild(nameBox);
    return box;
  }

  function orderItemsSummary(order) {
    var items = Array.isArray(order.items) ? order.items : [];
    var box = make('div');
    if (!items.length) return make('span', 'admin-table__muted', 'אין פירוט מוצרים');
    box.appendChild(make('span', 'admin-table__strong', numberFmt(order.units || 0) + ' יחידות'));
    var preview = items.slice(0, 2).map(function (item) { return item.name + ' ×' + item.qty; }).join(' · ');
    if (items.length > 2) preview += ' +' + (items.length - 2);
    box.appendChild(make('small', 'admin-table__muted', preview));
    return box;
  }

  function shippingErrorMessage(error) {
    var code = error && (error.code || error.message);
    var map = {
      invalid_tracking_number: 'מספר המעקב לא תקין.',
      invalid_order_item: 'לא ניתן לזהות את המוצר בהזמנה.',
      tracking_already_exists: 'מספר המעקב כבר מחובר להזמנה אחרת במערכת.',
      order_not_paid: 'אפשר להוסיף משלוח רק להזמנה ששולמה.',
      '17track_not_configured': 'חסר VERSANS_17TRACK_API_KEY ב-Render.',
      tracking_registration_failed: '17TRACK לא קיבל את מספר המעקב. בדוק את המספר או את קוד חברת השילוח.',
      invalid_shipment_qty: 'הכמות במשלוח חייבת להיות מספר שלם של לפחות 1.',
      order_item_fully_assigned: 'כל היחידות של המוצר כבר מחוברות למשלוחים. כדי לשנות, נתק קודם את המשלוח המתאים.',
      shipment_qty_exceeds_order_item: 'הכמות שבחרת גדולה מהכמות שנשארה לשיוך במוצר הזה.',
      invalid_shipment_unit: 'לא ניתן לזהות את היחידה שנבחרה.',
      shipment_unit_already_assigned: 'ליחידה הזאת כבר מחובר Tracking ID. נתק אותו קודם כדי להחליף.',
      shipment_unit_mismatch: 'היחידה כבר לא מחוברת למשלוח הזה. רענן את החלון ונסה שוב.'
    };
    return map[code] || text(error && error.message, 'לא ניתן לבצע את הפעולה כרגע.');
  }

  function closeShippingModal() {
    var node = document.querySelector('.admin-shipping-modal');
    if (node) node.remove();
  }

  function configPill(ok, label) {
    return badge((ok ? '✓ ' : '⚠ ') + label, ok ? 'verified' : 'pending');
  }

  function shippingItemLabel(item) {
    return text(item.productName, item.productId) + ' ×' + numberFmt(item.qty || 1);
  }

  function shipmentEtaLabel(from, to) {
    if (!from && !to) return 'אין עדיין הערכת מסירה';
    if (from && to) return dateOnly(from) === dateOnly(to) ? dateOnly(from) : dateOnly(from) + ' - ' + dateOnly(to);
    return dateOnly(from || to);
  }

  function shipmentProgressValue(status) {
    var steps = { registered: 8, info_received: 18, in_transit: 45, arrived_country: 65, ready_for_pickup: 82, out_for_delivery: 90, delivered: 100, delivery_failed: 72, exception: 72 };
    return steps[String(status || '')] || 8;
  }

  function translateTrackingText(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';

    var exact = {
      NotFound: 'עדיין לא נמצא מידע אצל חברת השילוח',
      NotFound_Other: 'עדיין לא נמצא מידע אצל חברת השילוח',
      InfoReceived: 'פרטי המשלוח התקבלו',
      InTransit: 'החבילה בדרך',
      OutForDelivery: 'החבילה יצאה למסירה',
      AvailableForPickup: 'החבילה מוכנה לאיסוף',
      Delivered: 'החבילה נמסרה',
      Exception: 'יש חריגה או עיכוב במשלוח',
      InTransit_Arrival: 'החבילה הגיעה למדינת היעד',
      InTransit_CustomsProcessing: 'החבילה נמצאת בתהליך שחרור מהמכס',
      InTransit_CustomsReleased: 'החבילה שוחררה מהמכס',
      InTransit_Departure: 'החבילה יצאה מתחנת מעבר',
      InTransit_Other: 'החבילה בתנועה',
      Delivered_Other: 'החבילה נמסרה'
    };
    if (exact[raw]) return exact[raw];

    var rules = [
      [/package handed over to customs for clearance/i, 'החבילה נמסרה למכס לצורך שחרור'],
      [/handed over to customs/i, 'החבילה נמסרה למכס'],
      [/(arrived|arrival) (at|to) customs/i, 'החבילה הגיעה למכס'],
      [/import customs clearance (started|start|processing)/i, 'תהליך השחרור מהמכס ביבוא התחיל'],
      [/import customs clearance (completed|complete|success|finished)/i, 'השחרור מהמכס ביבוא הושלם'],
      [/export customs clearance (started|start|processing)/i, 'תהליך המכס ביצוא התחיל'],
      [/export customs clearance (completed|complete|success|finished)/i, 'תהליך המכס ביצוא הושלם'],
      [/customs clearance (started|start|processing)/i, 'תהליך השחרור מהמכס התחיל'],
      [/customs clearance (completed|complete|success|finished)/i, 'השחרור מהמכס הושלם'],
      [/customs clearance failed/i, 'השחרור מהמכס נכשל'],
      [/(held|detained) (at|by) customs/i, 'החבילה מעוכבת במכס'],
      [/(released|release) from customs/i, 'החבילה שוחררה מהמכס'],
      [/customs inspection/i, 'החבילה בבדיקת מכס'],
      [/shipment accepted by the carrier/i, 'המשלוח התקבל אצל חברת השילוח'],
      [/package accepted by (the )?carrier/i, 'החבילה התקבלה אצל חברת השילוח'],
      [/received by (the )?carrier/i, 'החבילה התקבלה אצל חברת השילוח'],
      [/received by (the )?local delivery (company|carrier)/i, 'החבילה התקבלה אצל חברת השילוח המקומית'],
      [/handed over to (the )?local (delivery )?(company|carrier)/i, 'החבילה הועברה לחברת השילוח המקומית'],
      [/arrived (in|at) (the )?destination country/i, 'החבילה הגיעה למדינת היעד'],
      [/destination country.*arriv/i, 'החבילה הגיעה למדינת היעד'],
      [/departed from (the )?origin country/i, 'החבילה יצאה מארץ המקור'],
      [/arrived at (the )?(sorting|distribution) (center|centre)/i, 'החבילה הגיעה למרכז המיון'],
      [/departed from (the )?(sorting|distribution) (center|centre)/i, 'החבילה יצאה ממרכז המיון'],
      [/arrived at linehaul office/i, 'החבילה הגיעה למרכז ההפצה הבינלאומי'],
      [/leaving from departure country/i, 'החבילה יוצאת מארץ המקור'],
      [/flight.*depart/i, 'הטיסה עם המשלוח יצאה'],
      [/flight.*arriv/i, 'הטיסה עם המשלוח הגיעה'],
      [/handed over to airline/i, 'החבילה הועברה לחברת התעופה'],
      [/ready for (pickup|collection)/i, 'החבילה מוכנה לאיסוף'],
      [/available for (pickup|collection)/i, 'החבילה זמינה לאיסוף'],
      [/out for delivery/i, 'החבילה יצאה למסירה'],
      [/delivery attempt/i, 'בוצע ניסיון מסירה'],
      [/delivered/i, 'החבילה נמסרה'],
      [/in transit/i, 'החבילה בדרך']
    ];
    for (var i = 0; i < rules.length; i += 1) {
      if (rules[i][0].test(raw)) return rules[i][1];
    }
    return raw;
  }

  function orderFulfillmentRowClass(order) {
    var stateValue = order && order.fulfillment && order.fulfillment.state;
    var stateClass = '';
    if (stateValue === 'complete') stateClass = 'admin-order-row--connected';
    else if (stateValue === 'partial') stateClass = 'admin-order-row--partial';
    else if (stateValue === 'none') stateClass = 'admin-order-row--unconnected';
    if (!stateClass) return '';
    return stateClass + ' admin-order-row-id-' + Number(order.id || 0);
  }

  function updateOrderFulfillmentColor(order, data) {
    var items = Array.isArray(data && data.items) ? data.items : [];
    var totalItems = items.reduce(function (sum, item) { return sum + Math.max(0, Number(item && item.qty || 0)); }, 0);
    var linkedItems = items.reduce(function (sum, item) { return sum + Math.min(Math.max(0, Number(item && item.qty || 0)), Math.max(0, Number(item && item.assignedQty || 0))); }, 0);
    var fulfillmentState = totalItems > 0 && linkedItems >= totalItems ? 'complete' : (linkedItems > 0 ? 'partial' : 'none');
    order.fulfillment = { state: fulfillmentState, linkedItems: linkedItems, totalItems: totalItems, linkedUnits: linkedItems, totalUnits: totalItems };

    var selector = '.admin-order-row-id-' + Number(order.id || 0);
    document.querySelectorAll(selector).forEach(function (row) {
      row.classList.remove('admin-order-row--connected', 'admin-order-row--partial', 'admin-order-row--unconnected');
      row.classList.add(fulfillmentState === 'complete' ? 'admin-order-row--connected' : (fulfillmentState === 'partial' ? 'admin-order-row--partial' : 'admin-order-row--unconnected'));
    });

    document.querySelectorAll('[data-order-work-ref]').forEach(function (card) {
      if (card.getAttribute('data-order-work-ref') !== String(order.orderRef || '')) return;
      card.setAttribute('data-fulfillment-state', fulfillmentState);

      var track = card.querySelector('[data-order-track-action]');
      if (track) {
        track.classList.remove(
          'admin-order-work-action--track-red',
          'admin-order-work-action--track-yellow',
          'admin-order-work-action--track-green'
        );
        track.classList.add(
          fulfillmentState === 'complete'
            ? 'admin-order-work-action--track-green'
            : (fulfillmentState === 'partial'
              ? 'admin-order-work-action--track-yellow'
              : 'admin-order-work-action--track-red')
        );
        track.textContent = orderWorkTrackLabel(order);
      }

      var trackStatus = card.querySelector('[data-order-track-status]');
      if (trackStatus) {
        trackStatus.className = 'admin-order-work-track-status admin-order-work-track-status--' +
          (fulfillmentState === 'complete' ? 'green' : (fulfillmentState === 'partial' ? 'yellow' : 'red'));
        trackStatus.textContent = orderWorkTrackStatusText(order);
      }
    });
  }

  function orderShippingAddress(shipping) {
    shipping = shipping || {};
    var first = [shipping.street, shipping.houseNumber].filter(Boolean).join(' ');
    var extra = [];
    if (shipping.apartment) extra.push('דירה ' + shipping.apartment);
    if (shipping.entrance) extra.push('כניסה ' + shipping.entrance);
    if (shipping.floor) extra.push('קומה ' + shipping.floor);
    var location = [shipping.city, shipping.zip ? 'מיקוד ' + shipping.zip : ''].filter(Boolean).join(' · ');
    return [first, extra.join(' · '), location].filter(Boolean).join(', ');
  }

  async function openOrderDetailsByRef(orderRef) {
    closeShippingModal();
    var modal = make('div', 'admin-shipping-modal admin-order-details-modal');
    var backdrop = make('button', 'admin-shipping-backdrop');
    backdrop.type = 'button'; backdrop.setAttribute('aria-label', 'סגירה');
    var panel = make('section', 'admin-shipping-panel admin-order-details-panel');
    var loading = make('div', 'admin-page-loading'); loading.appendChild(make('span')); loading.appendChild(make('p', '', 'טוען פרטי הזמנה…'));
    panel.appendChild(loading); modal.append(backdrop, panel); document.body.appendChild(modal);
    backdrop.addEventListener('click', closeShippingModal);

    try {
      var data = await api('/api/admin/orders/' + encodeURIComponent(orderRef));
      var order = data.order || {};
      panel.replaceChildren();

      var head = make('div', 'admin-shipping-head');
      var headText = make('div');
      headText.appendChild(make('small', '', 'פרטי הזמנה'));
      headText.appendChild(make('h2', '', order.orderRef || orderRef));
      var close = make('button', 'admin-shipping-close', '×'); close.type = 'button'; close.addEventListener('click', closeShippingModal);
      head.append(headText, close); panel.appendChild(head);

      var hero = make('section', 'admin-order-detail-hero');
      var customerCopy = make('div');
      customerCopy.appendChild(make('span', '', 'לקוח'));
      customerCopy.appendChild(make('strong', '', text(order.customerName, 'אורח')));
      if (order.customerEmail) customerCopy.appendChild(make('small', '', order.customerEmail));
      if (order.customerPhone) customerCopy.appendChild(make('small', '', order.customerPhone));
      var totalCopy = make('div', 'admin-order-detail-total');
      totalCopy.appendChild(make('span', '', 'סה״כ הזמנה'));
      totalCopy.appendChild(make('strong', '', moneyAgorot(order.amountAgorot)));
      totalCopy.appendChild(make('small', '', order.paidAt ? 'שולם · ' + dateTime(order.paidAt) : dateTime(order.createdAt)));
      hero.append(customerCopy, totalCopy); panel.appendChild(hero);

      var overview = make('div', 'admin-order-detail-grid');
      [
        ['מספר הזמנה', order.orderRef || orderRef],
        ['סטטוס', order.status === 'paid' ? 'שולם' : text(order.status)],
        ['כמות יחידות', numberFmt(order.units || 0)],
        ['משלוחים', order.fulfillment && order.fulfillment.state === 'complete' ? 'הכול מחובר' : (order.fulfillment && order.fulfillment.state === 'partial' ? 'מחובר חלקית' : 'טרם חובר')]
      ].forEach(function (entry) {
        var box = make('div'); box.appendChild(make('span', '', entry[0])); box.appendChild(make('strong', '', entry[1])); overview.appendChild(box);
      });
      panel.appendChild(overview);

      var itemsSection = make('section', 'admin-shipping-section admin-order-detail-items');
      itemsSection.appendChild(make('h3', '', 'המוצרים בהזמנה'));
      (order.items || []).forEach(function (item) {
        var row = make('div', 'admin-order-detail-item');
        var copy = make('div'); copy.appendChild(make('strong', '', text(item.name, item.id))); copy.appendChild(make('small', '', 'כמות: ' + numberFmt(item.qty || 1) + (item.itemOrderRef ? ' · ' + item.itemOrderRef : '')));
        var line = item.lineTotal != null ? Number(item.lineTotal) : (Number(item.unitPrice || 0) * Number(item.qty || 1));
        row.append(copy, make('strong', '', new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 }).format(Number(line || 0))));
        itemsSection.appendChild(row);
      });
      panel.appendChild(itemsSection);

      var address = orderShippingAddress(order.shipping);
      if (address || (order.shipping && order.shipping.notes)) {
        var shippingSection = make('section', 'admin-shipping-section admin-order-detail-address');
        shippingSection.appendChild(make('h3', '', 'פרטי משלוח'));
        if (address) shippingSection.appendChild(make('p', '', address));
        if (order.shipping && order.shipping.notes) {
          var notes = make('div', 'admin-order-detail-notes'); notes.appendChild(make('span', '', 'הערות לקוח')); notes.appendChild(make('strong', '', order.shipping.notes)); shippingSection.appendChild(notes);
        }
        panel.appendChild(shippingSection);
      }

      var actions = make('div', 'admin-order-detail-actions');
      var shippingButton = make('button', 'admin-shipment-submit', 'ניהול משלוחים'); shippingButton.type = 'button'; shippingButton.disabled = order.status !== 'paid';
      shippingButton.addEventListener('click', function () { closeShippingModal(); openShipmentManager(order); });
      var done = make('button', 'admin-order-detail-close-button', 'סגור'); done.type = 'button'; done.addEventListener('click', closeShippingModal);
      actions.append(shippingButton, done); panel.appendChild(actions);
    } catch (error) {
      panel.replaceChildren();
      var err = make('div', 'admin-error'); err.appendChild(make('strong', '', 'לא ניתן לטעון את פרטי ההזמנה.')); err.appendChild(make('div', 'admin-table__muted', text(error && error.message))); panel.appendChild(err);
    }
  }

  async function maybeOpenRequestedOrder() {
    if (state.page !== 'order-work' || requestedOrderOpened || !requestedOrderRef) return;
    requestedOrderOpened = true;
    var orderRef = requestedOrderRef;
    var cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('order');
    window.history.replaceState(null, '', cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : '') + cleanUrl.hash);
    await openOrderDetailsByRef(orderRef);
  }

  async function openShipmentManager(order) {
    closeShippingModal();
    var modal = make('div', 'admin-shipping-modal');
    var backdrop = make('button', 'admin-shipping-backdrop'); backdrop.type = 'button'; backdrop.setAttribute('aria-label', 'סגירה');
    var panel = make('section', 'admin-shipping-panel');
    var loading = make('div', 'admin-page-loading'); loading.appendChild(make('span')); loading.appendChild(make('p', '', 'טוען מעקב…'));
    panel.appendChild(loading); modal.append(backdrop, panel); document.body.appendChild(modal);
    backdrop.addEventListener('click', closeShippingModal);

    function eventLine(event) {
      var row = make('div', 'admin-tracking-history__event');
      var main = make('div', 'admin-tracking-history__main');
      main.appendChild(make('strong', '', translateTrackingText(text(event.description, text(event.stage, 'עדכון מחברת השילוח')))));
      var meta = [];
      if (event.location) meta.push(event.location);
      if (event.provider) meta.push(event.provider);
      if (event.subStatus) meta.push(translateTrackingText(event.subStatus));
      if (meta.length) main.appendChild(make('small', 'admin-table__muted', meta.join(' · ')));
      row.appendChild(main);
      row.appendChild(make('time', 'admin-tracking-history__time', event.time ? dateTime(event.time) : 'ללא זמן'));
      return row;
    }

    async function load() {
      try {
        var data = await api('/api/admin/orders/' + encodeURIComponent(order.orderRef) + '/shipments');
        updateOrderFulfillmentColor(order, data);
        panel.replaceChildren();

        var head = make('div', 'admin-shipping-head');
        var headText = make('div');
        headText.appendChild(make('small', '', 'מעקב אמיתי מהספק דרך 17TRACK'));
        headText.appendChild(make('h2', '', order.orderRef));
        var close = make('button', 'admin-shipping-close', '×'); close.type = 'button'; close.addEventListener('click', closeShippingModal);
        head.append(headText, close); panel.appendChild(head);

        var customerState = data.customerTracking || { label: 'ההזמנה בהכנה' };
        var customerPreview = make('div', 'admin-shipping-customer-preview');
        customerPreview.appendChild(make('span', '', 'מה הלקוח רואה עכשיו'));
        customerPreview.appendChild(make('strong', '', customerState.label || 'ההזמנה בהכנה'));
        customerPreview.appendChild(make('small', 'admin-table__muted', 'כל יחידה בהזמנה מופיעה בנפרד ומקבלת Tracking ID משלה. הודעת האיסוף תכלול רק את היחידות שמחוברות לאותו משלוח.'));
        panel.appendChild(customerPreview);

        var productsSection = make('div', 'admin-shipping-section');
        productsSection.appendChild(make('h3', '', 'מעקב לפי מוצר'));
        productsSection.appendChild(make('p', 'admin-order-shipping-help', 'כל יחידה מוצגת כמוצר נפרד. אם הוזמנו 2 כובעים זהים, יופיעו שני כרטיסים נפרדים ולכל אחד מזינים Tracking ID משלו.'));

        var productTrackingList = make('div', 'admin-product-tracking-list');
        var unitItems = [];
        (data.items || []).forEach(function (sourceItem) {
          var orderedQty = Math.max(1, Number(sourceItem.qty || 1));
          var units = Array.isArray(sourceItem.units) && sourceItem.units.length
            ? sourceItem.units
            : Array.from({ length: orderedQty }, function (_, index) {
                var fallbackShipments = Array.isArray(sourceItem.shipments) ? sourceItem.shipments : (sourceItem.shipment ? [sourceItem.shipment] : []);
                return { unitNumber: index + 1, shipment: fallbackShipments[index] || null };
              });
          units.forEach(function (unit, index) {
            var unitShipment = unit && unit.shipment ? unit.shipment : null;
            unitItems.push(Object.assign({}, sourceItem, {
              qty: 1,
              originalQty: orderedQty,
              unitNumber: Number(unit && unit.unitNumber || index + 1),
              shipment: unitShipment,
              shipments: unitShipment ? [unitShipment] : [],
              assignedQty: unitShipment ? 1 : 0,
              unassignedQty: unitShipment ? 0 : 1
            }));
          });
        });
        unitItems.forEach(function (item) {
          var shipments = Array.isArray(item.shipments) ? item.shipments : (item.shipment ? [item.shipment] : []);
          var shipment = shipments[0] || null;
          var card = make('section', 'admin-product-tracking-card' + (shipments.length ? ' has-tracking' : ''));

          var itemHead = make('div', 'admin-product-tracking-card__head');
          var productMeta = make('div', 'admin-product-tracking-card__product');
          if (item.productImage) {
            var img = document.createElement('img');
            img.src = item.productImage; img.alt = ''; img.loading = 'lazy';
            productMeta.appendChild(img);
          }
          var productCopy = make('div');
          productCopy.appendChild(make('strong', '', text(item.productName, item.productId)));
          productCopy.appendChild(make('small', 'admin-table__muted', Number(item.originalQty || 1) > 1 ? ('יחידה ' + numberFmt(item.unitNumber || 1) + ' מתוך ' + numberFmt(item.originalQty || 1)) : 'יחידה אחת'));
          productMeta.appendChild(productCopy);
          var itemRef = make('div', 'admin-product-order-ref');
          itemRef.appendChild(make('span', '', 'מספר הזמנה VerSans'));
          itemRef.appendChild(make('strong', 'admin-table__mono', item.itemOrderRef));
          itemHead.append(productMeta, itemRef); card.appendChild(itemHead);

          if (shipments.length) {
            shipments.forEach(function (shipment) {
            var row = make('div', 'admin-product-tracking-live');
            var top = make('div', 'admin-tracking-row__top');
            var meta = make('div', 'admin-tracking-row__meta');
            meta.appendChild(make('small', 'admin-table__muted', 'Tracking ID / מספר מעקב מהספק'));
            meta.appendChild(make('strong', 'admin-table__strong admin-table__mono', shipment.trackingNumber));
            meta.appendChild(make('span', 'admin-tracking-row__carrier', text(shipment.carrierName, 'זיהוי אוטומטי')));

            var actions = make('div', 'admin-shipment-actions');
            var detailsToggle = make('button', 'admin-small-button admin-small-button--details', 'פרטים'); detailsToggle.type = 'button';
            var refresh = make('button', 'admin-small-button', 'רענון מעקב'); refresh.type = 'button'; refresh.disabled = !data.trackingConfigured;
            refresh.addEventListener('click', async function () {
              refresh.disabled = true;
              try { await apiAction('/api/admin/shipments/' + shipment.id + '/refresh', 'POST'); showToast('המעקב עודכן'); await load(); }
              catch (e) { showToast(shippingErrorMessage(e)); refresh.disabled = false; }
            });
            var remove = make('button', 'admin-small-button admin-small-button--danger', 'ניתוק'); remove.type = 'button';
            remove.addEventListener('click', async function () {
              if (!window.confirm('לנתק את ה-Tracking ID מהיחידה הזאת של ' + text(item.productName, '') + '?')) return;
              remove.disabled = true;
              try { await apiAction('/api/admin/orders/' + encodeURIComponent(order.orderRef) + '/shipment-items/' + item.itemIndex + '?shipmentId=' + encodeURIComponent(shipment.id) + '&unitNumber=' + encodeURIComponent(item.unitNumber || 1), 'DELETE'); showToast('המשלוח נותק מהיחידה'); await load(); }
              catch (e) { showToast(shippingErrorMessage(e)); remove.disabled = false; }
            });
            actions.append(detailsToggle, refresh, remove); top.append(meta, actions); row.appendChild(top);

            var detailsPanel = make('div', 'admin-shipment-details-panel');
            detailsPanel.hidden = true;
            detailsToggle.setAttribute('aria-expanded', 'false');
            detailsToggle.addEventListener('click', function () {
              var willOpen = detailsPanel.hidden;
              detailsPanel.hidden = !willOpen;
              detailsToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
              detailsToggle.textContent = willOpen ? 'סגור פרטים' : 'פרטים';
              row.classList.toggle('is-details-open', willOpen);
            });

            var statusLine = make('div', 'admin-tracking-status-line');
            statusLine.appendChild(make('strong', '', shipment.statusLabel));
            statusLine.appendChild(make('span', '', shipment.latestLocation ? 'מיקום אחרון: ' + shipment.latestLocation : 'מיקום אחרון טרם התקבל'));
            detailsPanel.appendChild(statusLine);

            if (shipment.pickupNotification && shipment.pickupNotification.state === 'sent') {
              var notice = make('div', 'admin-shipping-note admin-shipping-note--sent');
              notice.appendChild(make('strong', '', 'הודעת איסוף נשלחה ✓'));
              notice.appendChild(make('span', '', shipment.pickupNotification.sentAt ? dateTime(shipment.pickupNotification.sentAt) : 'נשלחה ללקוח'));
              detailsPanel.appendChild(notice);
            }

            var progress = make('div', 'admin-tracking-progress');
            var progressFill = make('span'); progressFill.style.width = shipmentProgressValue(shipment.status) + '%'; progress.appendChild(progressFill); detailsPanel.appendChild(progress);

            var details = make('div', 'admin-tracking-details');
            var sourceLabel = text(shipment.trackingSourceLabel, '17TRACK');
            var providerBox = make('div'); providerBox.appendChild(make('span', '', 'סטטוס ' + sourceLabel)); providerBox.appendChild(make('strong', '', translateTrackingText(text(shipment.providerStatus, shipment.statusLabel))));
            if (shipment.subStatus) providerBox.appendChild(make('small', 'admin-table__muted', translateTrackingText(shipment.subStatus)));
            var locationBox = make('div'); locationBox.appendChild(make('span', '', 'אירוע אחרון')); locationBox.appendChild(make('strong', '', translateTrackingText(text(shipment.latestEvent, sourceLabel + ' עדיין לא החזיר אירוע מפורט'))));
            var updatedBox = make('div'); updatedBox.appendChild(make('span', '', 'עדכון אחרון')); updatedBox.appendChild(make('strong', '', shipment.latestEventAt ? dateTime(shipment.latestEventAt) : 'ממתין לעדכון'));
            var etaBox = make('div'); etaBox.appendChild(make('span', '', 'הערכת מסירה')); etaBox.appendChild(make('strong', '', shipmentEtaLabel(shipment.estimatedDeliveryFrom, shipment.estimatedDeliveryTo)));
            var syncBox = make('div'); syncBox.appendChild(make('span', '', 'סנכרון')); syncBox.appendChild(make('strong', '', text(shipment.syncStatus, shipment.registeredAt ? 'מחובר ל-17TRACK' : 'ממתין לרישום')));
            details.append(providerBox, locationBox, updatedBox, etaBox, syncBox); detailsPanel.appendChild(details);

            if (Array.isArray(shipment.providerTips) && shipment.providerTips.length) {
              var tips = make('div', 'admin-shipping-note');
              tips.appendChild(make('strong', '', 'הודעת חברת השילוח'));
              shipment.providerTips.forEach(function (tip) { tips.appendChild(make('div', '', translateTrackingText(text(tip)))); });
              detailsPanel.appendChild(tips);
            }

            var history = Array.isArray(shipment.history) ? shipment.history : [];
            var historyWrap = make('div', 'admin-tracking-history');
            historyWrap.appendChild(make('strong', 'admin-tracking-history__title', 'היסטוריית Tracking אמיתית · ' + sourceLabel));
            if (!history.length) historyWrap.appendChild(make('span', 'admin-table__muted', 'עדיין לא התקבלו אירועים ממקור המעקב.'));
            else history.slice(0, 20).forEach(function (event) { historyWrap.appendChild(eventLine(event)); });
            detailsPanel.appendChild(historyWrap);
            row.appendChild(detailsPanel);
            card.appendChild(row);
            });
          } else {
            var waiting = make('div', 'admin-product-tracking-waiting');
            waiting.appendChild(make('strong', '', 'ההזמנה בהכנה'));
            waiting.appendChild(make('span', 'admin-table__muted', 'עדיין לא הוזן Tracking ID עבור היחידה הזאת.'));
            card.appendChild(waiting);
          }

          if (Number(item.unassignedQty || 0) === 0 && shipments.length) {
            var completeAssignment = make('div', 'admin-product-tracking-complete');
            completeAssignment.appendChild(make('strong', '', 'ליחידה הזאת מחובר Tracking ID ✓'));
            completeAssignment.appendChild(make('span', 'admin-table__muted', 'כדי להחליף אותו, לחץ על ניתוק ואז הזן Tracking ID חדש.'));
            card.appendChild(completeAssignment);
          }

          var form = make('form', 'admin-product-tracking-form');
          var trackingLabel = make('label');
          trackingLabel.appendChild(make('span', '', 'Tracking ID / מספר מעקב'));
          var tracking = document.createElement('input');
          tracking.name = 'tracking'; tracking.placeholder = 'הדביקו כאן את מספר המעקב'; tracking.autocomplete = 'off'; tracking.required = true;
          trackingLabel.appendChild(tracking);

          var remainingQty = Math.max(0, Number(item.unassignedQty != null ? item.unassignedQty : 1));
          var submit = make('button', 'admin-shipment-submit', 'חבר Tracking ID ליחידה'); submit.type = 'submit';
          var formError = make('div', 'admin-shipment-form-error'); formError.hidden = true;
          form.append(trackingLabel, submit, formError);
          if (remainingQty <= 0) {
            form.hidden = true;
          }
          form.addEventListener('submit', async function (event) {
            event.preventDefault(); formError.hidden = true; submit.disabled = true; var oldText = submit.textContent; submit.textContent = 'שומר…';
            try {
              var created = await apiAction('/api/admin/orders/' + encodeURIComponent(order.orderRef) + '/shipments', 'POST', {
                itemIndex: item.itemIndex,
                unitNumber: item.unitNumber || 1,
                trackingNumber: tracking.value.trim()
              });
              if (created.warning && created.warning.error === 'tracking_registration_failed') showToast('ה-Tracking ID נשמר למוצר. 17TRACK עדיין לא הצליח לזהות אותו וינסה שוב.');
              else if (created.reused && created.shared) showToast('ה-Tracking ID כבר היה בהזמנה וחובר גם ליחידה הזאת');
              else if (created.reused) showToast('ה-Tracking ID הקיים שויך ליחידה הזאת');
              else showToast('המשלוח חובר ליחידה הזאת');
              await load();
            } catch (e) {
              formError.textContent = shippingErrorMessage(e); formError.hidden = false; submit.disabled = false; submit.textContent = oldText;
            }
          });
          card.appendChild(form);
          productTrackingList.appendChild(card);
        });
        productsSection.appendChild(productTrackingList);
        panel.appendChild(productsSection);

        if (Array.isArray(data.unassignedShipments) && data.unassignedShipments.length) {
          var legacy = make('div', 'admin-shipping-section admin-shipping-section--legacy');
          legacy.appendChild(make('h3', '', 'מעקבים ישנים ללא מוצר'));
          legacy.appendChild(make('p', 'admin-order-shipping-help', 'אלה Tracking IDs שנוספו לפני שעברנו למעקב לפי מוצר. נתקו אותם והדביקו כל מספר בכרטיס המוצר המתאים למעלה.'));
          data.unassignedShipments.forEach(function (shipment) {
            var legacyRow = make('div', 'admin-legacy-tracking');
            var copy = make('div'); copy.appendChild(make('strong', 'admin-table__mono', shipment.trackingNumber)); copy.appendChild(make('small', 'admin-table__muted', text(shipment.carrierName, 'ללא שיוך'))); legacyRow.appendChild(copy);
            var remove = make('button', 'admin-small-button admin-small-button--danger', 'נתק'); remove.type = 'button';
            remove.addEventListener('click', async function () {
              remove.disabled = true;
              try { await apiAction('/api/admin/shipments/' + shipment.id, 'DELETE'); showToast('המעקב הישן נותק'); await load(); }
              catch (e) { showToast(shippingErrorMessage(e)); remove.disabled = false; }
            });
            legacyRow.appendChild(remove); legacy.appendChild(legacyRow);
          });
          panel.appendChild(legacy);
        }
      } catch (error) {
        panel.replaceChildren();
        var err = make('div', 'admin-error'); err.appendChild(make('strong', '', 'לא ניתן לטעון את המעקב.')); err.appendChild(make('div', 'admin-table__muted', shippingErrorMessage(error))); panel.appendChild(err);
      }
    }
    await load();
  }

  function shippingButton(order) {
    var button = make('button', 'admin-shipping-button', 'ניהול משלוחים');
    button.type = 'button';
    button.disabled = order.status !== 'paid';
    button.addEventListener('click', function (event) { event.stopPropagation(); openShipmentManager(order); });
    return button;
  }

  function ordersTable(rows, title, subtitle) {
    return renderTable({
      title: title || 'הזמנות',
      subtitle: subtitle || '',
      rows: rows || [],
      emptyText: 'אין הזמנות בטווח הזה.',
      rowClass: orderFulfillmentRowClass,
      columns: [
        { label: 'הזמנה', render: function (row) { return cellPrimary(row.orderRef, '#' + row.id, true); } },
        { label: 'לקוח', render: function (row) { return cellPrimary(row.customerName || row.customerEmail || 'אורח', row.customerEmail || ''); } },
        { label: 'טלפון', render: function (row) { return text(row.customerPhone); } },
        { label: 'מוצרים', render: orderItemsSummary },
        { label: 'סכום', render: function (row) { return make('strong', 'admin-table__strong', moneyAgorot(row.amountAgorot)); } },
        { label: 'תאריך', render: function (row) { return cellPrimary(dateTime(row.paidAt || row.createdAt), row.paidAt ? 'שולם' : 'נוצר'); } },
        { label: 'משלוח', render: shippingButton },
        { label: 'סטטוס', render: function (row) { return statusBadge(row.status); } }
      ]
    });
  }

  function topProductsTable(rows, title, subtitle) {
    return renderTable({
      title: title || 'המוצרים הנמכרים ביותר',
      subtitle: subtitle || 'לפי כמות יחידות בהזמנות Paid',
      rows: rows || [],
      emptyText: 'אין עדיין מוצרים שנמכרו בטווח הזה.',
      columns: [
        { label: '#', render: function (row) { return make('span', 'admin-rank', row.rank); } },
        { label: 'מוצר', render: productCell },
        { label: 'יחידות', render: function (row) { return numberFmt(row.unitsSold); } },
        { label: 'פעמים שנקנה', render: function (row) { return numberFmt(row.purchaseCount != null ? row.purchaseCount : row.paidOrderCount); } },
        { label: 'מכירות ברוטו', render: function (row) { return make('strong', 'admin-table__strong', moneyAgorot(row.grossSalesAgorot)); } },
        { label: 'נתוני מחיר', render: function (row) { return row.reconstructedRows ? badge(numberFmt(row.reconstructedRows) + ' משוחזר', 'pending') : badge('Snapshot', 'verified'); } }
      ]
    });
  }

  function quickLinks() {
    var body = make('div', 'admin-quick-links');
    [
      ['/admin/visitors', 'מבקרים', 'Online + Lifetime'],
      ['/admin/sales', 'מכירות', 'Paid בלבד'],
      ['/admin/order-work', 'טיפול בהזמנות', 'Tracking + Google Sheets'],
      ['/admin/products', 'מוצרים', 'דירוג מכירות'],
      ['/admin/customers', 'לקוחות', 'הוצאות והזמנות'],
      ['/admin/reviews', 'ביקורות', 'דירוגים']
    ].forEach(function (item) {
      var link = make('a', 'admin-quick-link');
      link.href = item[0];
      var labels = make('span');
      labels.appendChild(make('strong', '', item[1]));
      labels.appendChild(make('small', 'admin-table__muted', item[2]));
      link.append(labels, make('span', '', '‹'));
      body.appendChild(link);
    });
    return body;
  }

  function systemHealthCard(system) {
    system = system || {};
    var body = make('div', 'detail-grid');
    body.appendChild(detailItem('Checkout', String(system.checkoutMode || '—').toUpperCase()));
    body.appendChild(detailItem('Database', system.databaseBackend || '—'));
    body.appendChild(detailItem('הזמנות היום', numberFmt(system.todayAllOrders)));
    body.appendChild(detailItem('Paid היום', numberFmt(system.todayPaidOrders)));
    body.appendChild(detailItem('כל ההזמנות', numberFmt(system.lifetimeOrders)));
    body.appendChild(detailItem('17TRACK', system.trackingConfigured ? 'מחובר' : 'לא מוגדר'));
    var subtitle = system.persistentStorage
      ? 'מסד הנתונים מוגדר כאחסון מתמשך.'
      : 'אזהרה: מסד הנתונים מקומי ל־Deploy ועלול להימחק בכל Deploy/Restart ב־Render.';
    return card('בדיקת מערכת', subtitle, body, system.persistentStorage ? badge('Persistent', 'verified') : badge('לא מתמשך', 'failed'));
  }

  async function renderDashboardPage() {
    var range = state.ranges.dashboard;
    var data = await api('/api/admin/overview?range=' + encodeURIComponent(range));
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, rangeOptions, function (next) {
      state.ranges.dashboard = next;
      renderCurrentPage();
    }));
    toolbar.appendChild(make('span', 'admin-toolbar-note', 'מכירות והכנסות מחושבות מ־Paid בלבד'));
    frag.appendChild(toolbar);
    frag.appendChild(systemHealthCard(data.system));
    frag.appendChild(renderKpis([
      { label: 'הכנסות Paid', value: moneyAgorot(data.revenueAgorot), hint: 'בטווח שנבחר', primary: true, tone: 'green' },
      { label: 'הזמנות Paid', value: numberFmt(data.orderCount), hint: 'הזמנות ששולמו' },
      { label: 'ממוצע להזמנה', value: moneyAgorot(data.averageOrderAgorot), hint: 'AOV' },
      { label: 'יחידות שנמכרו', value: numberFmt(data.unitsSold), hint: 'מכל המוצרים' },
      { label: 'Online עכשיו', value: numberFmt(data.visitors && data.visitors.online), hint: 'מבקרים פעילים', tone: 'green' },
      { label: 'מבקרים היום', value: numberFmt(data.visitors && data.visitors.today), hint: 'Visitor IDs ייחודיים' },
      { label: 'מבקרים Lifetime', value: numberFmt(data.visitors && data.visitors.lifetime), hint: 'מהרגע שהשמירה הופעלה' },
      { label: 'משתמשים רשומים', value: numberFmt(data.users && data.users.registeredUsers), hint: numberFmt(data.users && data.users.payingCustomers) + ' לקוחות שילמו' }
    ]));

    var grid = make('div', 'admin-grid-2');
    grid.appendChild(card('מגמת מכירות', 'הכנסה יומית מהזמנות Paid', renderSalesChart(data.dailySales, range)));
    grid.appendChild(card('קיצורי דרך', 'גישה מהירה לכל נתוני החנות', quickLinks()));
    frag.appendChild(grid);
    frag.appendChild(topProductsTable((data.topProducts || []).slice(0, 5), 'Top Products', 'המוצרים המובילים בטווח שנבחר'));
    frag.appendChild(ordersTable(data.recentOrders || [], 'הזמנות Paid אחרונות', 'הזמנות אחרונות בכל הזמנים'));
    content.replaceChildren(frag);
  }

  function visitorsTable(data, onSelect) {
    var table = renderTable({
      title: 'רשימת מבקרים',
      subtitle: numberFmt(data.count) + ' מבקרים בטווח שנבחר',
      rows: data.visitors || [],
      emptyText: 'אין מבקרים בטווח הזה עדיין.',
      rowClass: function (row) { return 'admin-visitor-row' + (state.selectedVisitorId === row.visitorId ? ' is-selected' : ''); },
      onRowClick: onSelect,
      columns: [
        { label: 'מבקר', render: function (row) {
          var box = cellPrimary(row.name, row.email || (row.isLoggedIn ? 'משתמש מחובר' : 'אורח'));
          if (row.online) box.appendChild(badge('Online', 'online'));
          return box;
        } },
        { label: 'טלפון', render: function (row) { return text(row.phone); } },
        { label: 'עמוד נוכחי', render: function (row) { return cellPrimary(row.currentPath || '/', row.lastTitle || ''); } },
        { label: 'מכשיר', render: function (row) { return cellPrimary([row.browser, row.os].filter(Boolean).join(' · ') || 'לא ידוע', row.deviceType || ''); } },
        { label: 'נראה לאחרונה', render: function (row) { return cellPrimary(relative(row.lastSeen), numberFmt(row.pageViewCount) + ' צפיות'); } }
      ]
    });
    table.appendChild(renderPagination({
      count: data.count, limit: data.limit, offset: data.offset,
      onChange: function (offset) { state.offsets.visitors = offset; state.selectedVisitorId = null; renderCurrentPage(); }
    }));
    return table;
  }

  function detailItem(label, value) {
    var item = make('div', 'detail-item');
    item.appendChild(make('span', '', label));
    item.appendChild(make('strong', '', text(value)));
    return item;
  }

  function detailSection(title, pairs) {
    var section = make('section', 'detail-section');
    section.appendChild(make('h3', '', title));
    var grid = make('div', 'detail-grid');
    pairs.forEach(function (pair) { grid.appendChild(detailItem(pair[0], pair[1])); });
    section.appendChild(grid);
    return section;
  }

  function emptyVisitorDetails() {
    var panel = make('aside', 'admin-card visitor-details');
    var body = make('div', 'admin-empty', 'לחץ על מבקר בטבלה כדי לראות את כל הפרטים שנשמרו עליו.');
    panel.appendChild(body);
    return panel;
  }

  async function loadVisitorDetail(panel, visitorId) {
    panel.replaceChildren(make('div', 'admin-page-loading', 'טוען פרטי מבקר…'));
    try {
      var data = await api('/api/admin/visitors/' + encodeURIComponent(visitorId));
      var v = data.visitor;
      var head = make('div', 'visitor-details__head');
      var heading = make('div');
      heading.appendChild(make('span', 'visitor-details__kicker', 'VISITOR DETAILS'));
      heading.appendChild(make('h2', '', v.name));
      var close = make('button', '', '×');
      close.type = 'button';
      close.addEventListener('click', function () {
        state.selectedVisitorId = null;
        panel.replaceChildren(make('div', 'admin-empty', 'לחץ על מבקר בטבלה כדי לראות פרטים.'));
        Array.prototype.forEach.call(document.querySelectorAll('.admin-visitor-row'), function (row) { row.classList.remove('is-selected'); });
      });
      head.append(heading, close);
      panel.replaceChildren(head);
      panel.appendChild(detailSection('פרטים חשובים', [
        ['שם', v.name], ['אימייל', v.email], ['טלפון', v.phone], ['סטטוס', v.isLoggedIn ? 'משתמש מחובר' : 'אורח']
      ]));
      panel.appendChild(detailSection('פעילות באתר', [
        ['Online', v.online ? 'כן' : 'לא'], ['נראה לאחרונה', dateTime(v.lastSeen)], ['עמוד נוכחי', v.currentPath], ['עמוד כניסה', v.entryPath], ['כניסה ראשונה', dateTime(v.firstSeen)], ['סה״כ צפיות', numberFmt(v.pageViewCount)]
      ]));
      panel.appendChild(detailSection('מכשיר', [
        ['סוג מכשיר', v.deviceType], ['דפדפן', v.browser], ['מערכת הפעלה', v.os]
      ]));
      if (v.referrer || (v.utm && (v.utm.source || v.utm.medium || v.utm.campaign))) {
        panel.appendChild(detailSection('איך הגיע לאתר', [
          ['Referrer', v.referrer], ['UTM Source', v.utm && v.utm.source], ['UTM Medium', v.utm && v.utm.medium], ['UTM Campaign', v.utm && v.utm.campaign]
        ]));
      }
      if (v.account) {
        panel.appendChild(detailSection('רכישות', [
          ['הזמנות', numberFmt(v.account.orderCount)], ['הזמנות ששולמו', numberFmt(v.account.paidOrderCount)], ['הזמנה אחרונה', dateTime(v.account.lastOrderAt)], ['לקוח מאומת', v.account.verifiedCustomer ? 'כן' : 'לא']
        ]));
      }
      var historySection = make('section', 'detail-section');
      historySection.appendChild(make('h3', '', 'עמודים אחרונים'));
      var history = make('div', 'history');
      var pageViews = (data.pageViews || []).slice(0, 20);
      if (!pageViews.length) history.appendChild(make('p', 'detail-note', 'אין צפיות שמורות.'));
      pageViews.forEach(function (view) {
        var item = make('div', 'history-item');
        item.appendChild(make('strong', '', view.path));
        item.appendChild(make('span', '', (view.title ? view.title + ' · ' : '') + dateTime(view.viewedAt)));
        history.appendChild(item);
      });
      if ((data.pageViews || []).length > pageViews.length) {
        history.appendChild(make('p', 'detail-note', 'מוצגות 20 הצפיות האחרונות מתוך ' + numberFmt((data.pageViews || []).length) + '.'));
      }
      historySection.appendChild(history);
      panel.appendChild(historySection);
    } catch (error) {
      panel.replaceChildren(make('div', 'admin-error', 'לא ניתן לטעון את פרטי המבקר.'));
    }
  }

  async function renderVisitorsPage() {
    var range = state.ranges.visitors;
    var offset = state.offsets.visitors;
    var mainPromise = api('/api/admin/visitors?range=' + encodeURIComponent(range) + '&limit=50&offset=' + offset);
    var onlinePromise = range === 'online' && offset === 0 ? mainPromise : api('/api/admin/visitors?range=online&limit=1&offset=0');
    var todayPromise = range === 'today' && offset === 0 ? mainPromise : api('/api/admin/visitors?range=today&limit=1&offset=0');
    var result = await Promise.all([mainPromise, onlinePromise, todayPromise]);
    var data = result[0];
    var online = result[1];
    var today = result[2];

    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, visitorRangeOptions, function (next) {
      state.ranges.visitors = next;
      state.offsets.visitors = 0;
      state.selectedVisitorId = null;
      renderCurrentPage();
    }));
    var more = make('button', 'admin-more-link', range === 'all' ? 'מציג את כל המבקרים' : 'הצג את כל המבקרים ›');
    more.type = 'button';
    more.disabled = range === 'all';
    more.addEventListener('click', function () {
      state.ranges.visitors = 'all';
      state.offsets.visitors = 0;
      renderCurrentPage();
    });
    toolbar.appendChild(more);
    frag.appendChild(toolbar);
    frag.appendChild(renderKpis([
      { label: 'Online עכשיו', value: numberFmt(online.count), hint: 'מבקרים פעילים', primary: true, tone: 'green' },
      { label: 'מבקרים היום', value: numberFmt(today.count), hint: 'Visitor IDs ייחודיים' },
      { label: 'בטווח שנבחר', value: numberFmt(data.count), hint: visitorRangeOptions.filter(function (item) { return item.value === range; })[0].label },
      { label: 'כל הזמנים', value: numberFmt(data.lifetimeCount), hint: 'Lifetime מרגע הפעלת השמירה' }
    ]));
    frag.appendChild(make('div', 'admin-privacy-note', 'פרטיות: מערכת המבקרים אינה שומרת כתובות IP. נשמרים רק Visitor ID ונתוני שימוש בסיסיים הדרושים לניתוח האתר.'));

    var grid = make('div', 'admin-visitor-grid');
    var detailPanel = emptyVisitorDetails();
    var table = visitorsTable(data, function (visitor, row) {
      state.selectedVisitorId = visitor.visitorId;
      Array.prototype.forEach.call(document.querySelectorAll('.admin-visitor-row'), function (item) { item.classList.remove('is-selected'); });
      row.classList.add('is-selected');
      loadVisitorDetail(detailPanel, visitor.visitorId);
    });
    grid.append(table, detailPanel);
    frag.appendChild(grid);
    content.replaceChildren(frag);
    if (state.selectedVisitorId) loadVisitorDetail(detailPanel, state.selectedVisitorId);
  }

  async function renderSalesPage() {
    var range = state.ranges.sales;
    var data = await api('/api/admin/sales?range=' + encodeURIComponent(range));
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, rangeOptions, function (next) { state.ranges.sales = next; renderCurrentPage(); }));
    toolbar.appendChild(make('span', 'admin-toolbar-note', 'Pending ו־Failed אינם נכללים בנתוני המכירות'));
    frag.appendChild(toolbar);
    frag.appendChild(renderKpis([
      { label: 'הכנסות Paid', value: moneyAgorot(data.revenueAgorot), hint: 'סכום הזמנות ששולמו', primary: true, tone: 'green' },
      { label: 'הזמנות Paid', value: numberFmt(data.orderCount), hint: 'מספר עסקאות' },
      { label: 'ממוצע להזמנה', value: moneyAgorot(data.averageOrderAgorot), hint: 'Average Order Value' },
      { label: 'יחידות שנמכרו', value: numberFmt(data.unitsSold), hint: 'סה״כ פריטים' }
    ]));
    frag.appendChild(card('תרשים מכירות', 'הכנסה יומית. גע/לחץ על יום כדי לראות סכום מדויק ולהתמקד בו.', renderSalesChart(data.dailySales, range)));
    frag.appendChild(topProductsTable(data.topProducts || [], 'המוצרים הנמכרים ביותר', 'מדורג לפי מספר יחידות שנמכרו'));
    frag.appendChild(ordersTable(data.recentOrders || [], 'הזמנות אחרונות', 'Paid בטווח שנבחר'));
    content.replaceChildren(frag);
  }

  function manualPickupErrorMessage(error) {
    var code = error && error.code;
    if (code === 'tracking_number_not_found') return 'לא נמצא מספר משלוח בהודעה. ודאו שמספר המשלוח מופיע ליד המילה "משלוח".';
    if (code === 'pickup_details_not_found') return 'נמצא מספר משלוח, אבל לא נמצאו בהודעה פרטי איסוף שימושיים.';
    if (code === 'tracking_not_found') return 'מספר המשלוח נמצא בהודעה, אבל הוא לא מחובר כרגע להזמנה ב-VerSans.';
    if (code === 'paid_order_not_found') return 'המשלוח נמצא, אבל לא נמצאה עבורו הזמנת Paid תקינה.';
    if (code === 'missing_whatsapp_number') return 'להזמנה אין מספר WhatsApp תקין.';
    if (code === 'pickup_notification_already_queued') return 'הודעת האיסוף כבר נמצאת בתהליך שליחה. נסו שוב בעוד כמה דקות רק אם לא נשלחה.';
    if (code === 'pickup_webhook_failed') return 'הפרטים נשמרו, אבל לא הצלחנו להעביר את ההודעה ל-Order Notifications.';
    return text(error && error.message, 'לא הצלחנו לעבד את הודעת האיסוף.');
  }

  function manualPickupMessageCard() {
    var wrap = make('section', 'admin-card admin-pickup-message-card');
    var head = make('div', 'admin-card__head');
    var titleWrap = make('div');
    titleWrap.appendChild(make('h2', '', 'הודעת איסוף מחברת המשלוחים'));
    titleWrap.appendChild(make('p', '', 'מדביקים את ההודעה שקיבלתם. VerSans מזהה את מספר המשלוח, מוצא את ההזמנה ושולח ללקוח הודעת איסוף מסודרת.'));
    head.appendChild(titleWrap);
    head.appendChild(make('span', 'admin-pickup-message-card__badge', 'חברות משלוחים'));
    wrap.appendChild(head);

    var body = make('div', 'admin-card__body');
    var form = make('form', 'admin-pickup-message-form');
    var label = make('label');
    label.appendChild(make('span', '', 'הדביקו כאן את ההודעה המלאה'));
    var textarea = document.createElement('textarea');
    textarea.name = 'pickupMessage';
    textarea.rows = 10;
    textarea.required = true;
    textarea.placeholder = 'הדביקו כאן את הודעת האיסוף המלאה כפי שהתקבלה מחברת המשלוחים או מדואר ישראל.';
    label.appendChild(textarea);
    form.appendChild(label);

    var resendLabel = make('label', 'admin-pickup-message-resend');
    var resend = document.createElement('input');
    resend.type = 'checkbox';
    resend.name = 'forceResend';
    resendLabel.appendChild(resend);
    resendLabel.appendChild(make('span', '', 'שלח שוב לבדיקה גם אם ההודעה כבר נשלחה'));
    form.appendChild(resendLabel);

    var actions = make('div', 'admin-pickup-message-form__actions');
    var submit = make('button', 'admin-shipment-submit', 'זהה משלוח ושלח ללקוח');
    submit.type = 'submit';
    actions.appendChild(submit);
    actions.appendChild(make('small', 'admin-table__muted', 'אין צורך לפתוח AliExpress או Cainiao. ההודעה נשלחת דרך Order Notifications הקיים.'));
    form.appendChild(actions);

    var result = make('div', 'admin-pickup-message-result');
    result.hidden = true;
    form.appendChild(result);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var message = textarea.value.trim();
      if (!message) return;
      var old = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'מעבד ושולח…';
      result.hidden = true;
      result.className = 'admin-pickup-message-result';
      result.replaceChildren();
      try {
        var data = await apiAction('/api/admin/shipping/pickup-message', 'POST', { message: message, forceResend: resend.checked === true });
        result.classList.add('is-success');
        result.appendChild(make('strong', '', data.alreadySent ? 'הודעת האיסוף כבר נשלחה ללקוח.' : 'הפרטים נקלטו וההודעה הועברה לשליחה ✅'));
        var meta = [];
        if (data.orderRef) meta.push('הזמנה: ' + data.orderRef);
        if (data.trackingId) meta.push('משלוח: ' + data.trackingId);
        if (data.customerName) meta.push('לקוח: ' + data.customerName);
        if (meta.length) result.appendChild(make('div', 'admin-pickup-message-result__meta', meta.join(' · ')));
        if (data.customerPickupDetails) {
          var details = make('pre', 'admin-pickup-message-result__details', data.customerPickupDetails);
          result.appendChild(details);
        }
        textarea.value = '';
        resend.checked = false;
        showToast(data.forceResend ? 'הודעת האיסוף הועברה שוב לבדיקה' : (data.alreadySent ? 'ההודעה כבר סומנה כנשלחה' : 'הודעת האיסוף הועברה לשליחה'));
      } catch (error) {
        result.classList.add('is-error');
        result.appendChild(make('strong', '', manualPickupErrorMessage(error)));
        var payload = error && error.payload;
        if (payload && payload.orderRef) result.appendChild(make('div', 'admin-pickup-message-result__meta', 'הזמנה: ' + payload.orderRef + (payload.trackingId ? ' · משלוח: ' + payload.trackingId : '')));
        if (payload && payload.whatsappWebUrl) {
          var fallback = document.createElement('a');
          fallback.className = 'admin-pickup-message-result__fallback';
          fallback.href = payload.whatsappWebUrl;
          fallback.target = '_blank';
          fallback.rel = 'noopener';
          fallback.textContent = 'פתח WhatsApp ידנית עם ההודעה המוכנה';
          result.appendChild(fallback);
        }
      } finally {
        result.hidden = false;
        submit.disabled = false;
        submit.textContent = old;
      }
    });

    body.appendChild(form);
    wrap.appendChild(body);
    return wrap;
  }

  async function renderOrdersPage() {
    var range = state.ranges.orders;
    var status = state.ordersStatus;
    var offset = state.offsets.orders;
    var url = '/api/admin/orders?status=' + encodeURIComponent(status) + '&range=' + encodeURIComponent(range) + '&limit=50&offset=' + offset;
    var data = await api(url);
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    var filters = make('div');
    filters.appendChild(renderStatusFilter(status, function (next) { state.ordersStatus = next; state.offsets.orders = 0; renderCurrentPage(); }));
    filters.appendChild(renderRangeFilter(range, rangeOptions, function (next) { state.ranges.orders = next; state.offsets.orders = 0; renderCurrentPage(); }));
    toolbar.appendChild(filters);
    toolbar.appendChild(make('span', 'admin-toolbar-note', 'אדום = לא חובר מעקב · צהוב = חובר רק חלק מההזמנה · ירוק = כל המוצרים מחוברים'));
    frag.appendChild(toolbar);
    frag.appendChild(manualPickupMessageCard());
    frag.appendChild(renderKpis([
      { label: 'הזמנות בתצוגה', value: numberFmt(data.count), hint: status === 'all' ? 'כל הסטטוסים' : status, primary: status === 'paid', tone: status === 'paid' ? 'green' : 'amber' },
      { label: 'עמוד', value: numberFmt(Math.floor(data.offset / data.limit) + 1), hint: numberFmt(data.limit) + ' רשומות בעמוד' }
    ]));
    var table = ordersTable(data.orders || [], 'כל ההזמנות', numberFmt(data.count) + ' תוצאות');
    table.appendChild(renderPagination({ count: data.count, limit: data.limit, offset: data.offset, onChange: function (next) { state.offsets.orders = next; renderCurrentPage(); } }));
    frag.appendChild(table);
    content.replaceChildren(frag);
    await maybeOpenRequestedOrder();
  }

  function moneyValue(value, currency) {
    var n = Number(value || 0);
    if (!Number.isFinite(n)) n = 0;
    try {
      return new Intl.NumberFormat('he-IL', { style: 'currency', currency: currency || 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    } catch (_) {
      return n.toFixed(2) + ' ₪';
    }
  }

  function orderWorkImage(url, alt, className) {
    var wrap = make('div', className || 'admin-order-work-image');
    if (!url) {
      wrap.appendChild(make('span', 'admin-order-work-image__empty', 'אין תמונה'));
      return wrap;
    }
    var img = document.createElement('img');
    img.src = String(url);
    img.alt = alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    wrap.appendChild(img);
    return wrap;
  }

  function orderWorkPersonalization(item) {
    if (item && item.personalizationText) return String(item.personalizationText);
    var parts = [];
    if (item && item.customName) parts.push('שם/טקסט: ' + item.customName);
    if (item && item.greeting && item.greeting.textSummary) parts.push('ברכה אישית: ' + item.greeting.textSummary);
    if (item && item.customPhoto && item.customPhoto.assetId) parts.push('הועלתה תמונת לקוח ✓');
    return parts.join(' | ');
  }

  function orderWorkAsset(item, kind) {
    var asset = kind === 'greeting' ? item.greeting : item.customPhoto;
    if (!asset) return null;
    var dataUrl = asset.dataUrl || '';
    var title = kind === 'greeting' ? 'ברכה אישית' : 'תמונת לקוח';
    var card = make('div', 'admin-order-work-asset');
    card.appendChild(make('span', '', title));
    if (dataUrl) card.appendChild(orderWorkImage(dataUrl, title, 'admin-order-work-asset__image'));
    else card.appendChild(make('strong', '', asset.fileName || asset.assetId || 'קיים קובץ'));
    return card;
  }

  function orderWorkLink(url, label) {
    if (!url) return make('span', 'admin-order-work-value admin-order-work-value--empty', '—');
    var link = document.createElement('a');
    link.className = 'admin-order-work-data-link';
    link.href = String(url);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = label || 'פתיחה ↗';
    return link;
  }

  function orderWorkField(label, value, className) {
    var field = make('div', 'admin-order-work-field' + (className ? ' ' + className : ''));
    field.appendChild(make('span', 'admin-order-work-field__label', label));
    if (value && value.nodeType) field.appendChild(value);
    else field.appendChild(make('strong', 'admin-order-work-field__value', value == null || value === '' ? '—' : String(value)));
    return field;
  }

  function orderWorkAssetFull(label, previewUrl, linkUrl, fallbackDataUrl) {
    var wrap = make('div', 'admin-order-work-full-asset');
    wrap.appendChild(make('span', 'admin-order-work-field__label', label));

    var preview = previewUrl || fallbackDataUrl || '';
    wrap.appendChild(orderWorkImage(preview, label, 'admin-order-work-full-asset__image'));

    var links = make('div', 'admin-order-work-full-asset__links');
    if (preview) links.appendChild(orderWorkLink(preview, 'פתיחת תמונה'));
    if (linkUrl && linkUrl !== preview) links.appendChild(orderWorkLink(linkUrl, 'קישור Drive'));
    if (!preview && !linkUrl) links.appendChild(make('span', 'admin-order-work-value--empty', '—'));
    wrap.appendChild(links);
    return wrap;
  }

  function sheetSyncLabel(sync) {
    if (sync && sync.pending) return 'Google Sheets נטען ברקע';
    if (sync && sync.ok && sync.version) return 'Google Sheets ' + String(sync.version) + ' מחובר';
    if (sync && sync.ok) return 'Google Sheets מחובר';
    var error = sync && sync.error || '';
    if (error === 'apps_script_outdated' || error === 'invalid_payload') return 'צריך לפרוס את Apps Script V9';
    if (error === 'google_orders_not_configured') return 'Google Sheets לא מוגדר בשרת';
    if (error === 'google_sheet_secret_mismatch' || error === 'unauthorized') return 'Secret של Google Sheets לא תואם';
    return 'Google Sheets לא מסונכרן';
  }

  function orderWorkActionButton(label, className, onClick) {
    var button = make('button', 'admin-order-work-action' + (className ? ' ' + className : ''), label);
    button.type = 'button';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function orderWorkFulfillmentState(order) {
    var stateValue = order && order.fulfillment && order.fulfillment.state;
    return stateValue === 'complete' || stateValue === 'partial' ? stateValue : 'none';
  }

  function orderWorkTrackLabel(order) {
    var fulfillment = order && order.fulfillment || {};
    var linked = Math.max(0, Number(fulfillment.linkedUnits != null ? fulfillment.linkedUnits : fulfillment.linkedItems || 0));
    var total = Math.max(0, Number(fulfillment.totalUnits != null ? fulfillment.totalUnits : fulfillment.totalItems || 0));
    if (!total || !linked) return 'Track · לא חובר';
    return 'Track · ' + linked + '/' + total;
  }

  function orderWorkTrackStatusText(order) {
    var stateValue = orderWorkFulfillmentState(order);
    if (stateValue === 'complete') return 'כל המוצרים מחוברים למעקב';
    if (stateValue === 'partial') return 'חלק מהמוצרים מחוברים למעקב';
    return 'עדיין לא חובר Tracking';
  }

  function orderWorkTrackLink(order) {
    var stateValue = orderWorkFulfillmentState(order);
    var tone = stateValue === 'complete' ? 'green' : (stateValue === 'partial' ? 'yellow' : 'red');
    var link = document.createElement('a');
    link.className = 'admin-order-work-action admin-order-work-action--track admin-order-work-action--track-' + tone;
    link.setAttribute('data-order-track-action', '1');
    link.href = '/track?order=' + encodeURIComponent(String(order && order.orderRef || ''));
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = orderWorkTrackLabel(order);
    return link;
  }

  function openPickupMessageTool() {
    var details = document.getElementById('adminPickupMessageTool');
    if (!details) return;
    details.open = true;
    try { details.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    window.setTimeout(function () {
      var textarea = details.querySelector('textarea');
      if (textarea) textarea.focus();
    }, 250);
  }

  function compactPickupTool() {
    var details = make('details', 'admin-order-work-pickup-tool');
    details.id = 'adminPickupMessageTool';

    var summary = document.createElement('summary');
    summary.textContent = '💬 שליחת הודעת איסוף ללקוח';
    details.appendChild(summary);

    var body = make('div', 'admin-order-work-pickup-tool__body');
    body.appendChild(manualPickupMessageCard());
    details.appendChild(body);
    return details;
  }

  function renderOrderWorkCard(order) {
    var cardEl = make('article', 'admin-order-work-card admin-order-work-card--organized admin-order-work-card--compact');
    cardEl.dataset.workState = order.workState || (order.completed ? 'green' : 'red');
    cardEl.setAttribute('data-order-work-ref', String(order.orderRef || ''));
    cardEl.setAttribute('data-fulfillment-state', orderWorkFulfillmentState(order));

    var items = Array.isArray(order.items) ? order.items : [];
    var snapshot = order.sheetSnapshot || null;

    var head = make('div', 'admin-order-work-card__head admin-order-work-card__head--organized admin-order-work-card__head--compact');

    var orderCheckWrap = make('label', 'admin-order-work-order-check');
    var orderCheck = document.createElement('input');
    orderCheck.type = 'checkbox';
    orderCheck.checked = !!order.completed;
    orderCheckWrap.appendChild(orderCheck);
    orderCheckWrap.appendChild(make('span', '', 'בוצעה'));

    var title = make('button', 'admin-order-work-card__title admin-order-work-card__title--button');
    title.type = 'button';
    title.appendChild(make('strong', '', order.orderRef || 'הזמנה'));
    title.appendChild(make('small', '', (order.paidAt ? dateTime(order.paidAt) : dateTime(order.createdAt)) + ' · ' + moneyValue(order.orderTotal, order.currency)));
    title.addEventListener('click', function () { openOrderDetailsByRef(order.orderRef); });

    var statusLabel = order.workState === 'green' ? 'הושלמה' : (order.workState === 'partial' ? 'חלקית' : 'ממתינה');
    var statusChip = make('span', 'admin-order-work-status-chip admin-order-work-status-chip--' + (order.workState || 'red'), statusLabel);

    var progress = make('div', 'admin-order-work-progress admin-order-work-progress--compact');
    var progressText = make('strong', '', '');
    var progressSub = make('span', '', '');
    progress.append(progressText, progressSub);

    var fulfillmentState = orderWorkFulfillmentState(order);
    var trackTone = fulfillmentState === 'complete' ? 'green' : (fulfillmentState === 'partial' ? 'yellow' : 'red');
    var trackStatus = make(
      'span',
      'admin-order-work-track-status admin-order-work-track-status--' + trackTone,
      orderWorkTrackStatusText(order)
    );
    trackStatus.setAttribute('data-order-track-status', '1');

    head.append(orderCheckWrap, title, statusChip, trackStatus, progress);
    cardEl.appendChild(head);

    var actions = make('div', 'admin-order-work-card__actions');
    actions.appendChild(orderWorkActionButton('ניהול Tracking', 'admin-order-work-action--primary', function () {
      openShipmentManager(order);
    }));
    actions.appendChild(orderWorkTrackLink(order));
    actions.appendChild(orderWorkActionButton('שליחת הודעה', 'admin-order-work-action--message', function () {
      openPickupMessageTool();
    }));
    actions.appendChild(orderWorkActionButton('פרטי הזמנה', '', function () {
      openOrderDetailsByRef(order.orderRef);
    }));
    actions.appendChild(orderWorkActionButton('העתק מס׳ הזמנה', '', function () {
      var value = String(order.orderRef || '');
      if (!value) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () { showToast('מספר ההזמנה הועתק'); }).catch(function () {});
      }
    }));
    cardEl.appendChild(actions);

    var customer = order.customer || {};
    var customerSummary = make('div', 'admin-order-work-customer-summary');
    [
      order.customerName || customer.fullName || 'אורח',
      order.customerPhone || customer.phone || '',
      orderShippingAddress(customer) || ''
    ].filter(Boolean).forEach(function (value) {
      customerSummary.appendChild(make('span', '', value));
    });
    cardEl.appendChild(customerSummary);

    var customerDetails = make('details', 'admin-order-work-collapsible');
    var customerSummaryTitle = document.createElement('summary');
    customerSummaryTitle.textContent = 'כל פרטי הלקוח והמשלוח';
    customerDetails.appendChild(customerSummaryTitle);

    var customerGrid = make('div', 'admin-order-work-customer admin-order-work-customer--organized admin-order-work-customer--compact');
    [
      ['שם מלא', order.customerName || customer.fullName || 'אורח'],
      ['טלפון', order.customerPhone || customer.phone || '—'],
      ['אימייל', order.customerEmail || customer.email || '—'],
      ['כתובת מלאה', orderShippingAddress(customer) || '—'],
      ['מיקוד', customer.zip || '—'],
      ['כניסה', customer.entrance || '—'],
      ['קומה', customer.floor || '—'],
      ['הערות', customer.notes || '—']
    ].forEach(function (entry) {
      customerGrid.appendChild(orderWorkField(entry[0], entry[1]));
    });
    customerDetails.appendChild(customerGrid);
    cardEl.appendChild(customerDetails);

    var listSection = make('section', 'admin-order-work-section admin-order-work-section--items admin-order-work-section--items-compact');
    var list = make('div', 'admin-order-work-items admin-order-work-items--organized admin-order-work-items--compact');
    var itemChecks = [];

    items.forEach(function (item) {
      var sheetItem = item.sheet || {};
      var row = make('article', 'admin-order-work-item admin-order-work-item--organized admin-order-work-item--compact');

      var top = make('div', 'admin-order-work-item__top admin-order-work-item__top--organized admin-order-work-item__top--compact');

      var checkWrap = make('label', 'admin-order-work-item__check');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!item.completed;
      checkWrap.appendChild(input);

      var productImageUrl = sheetItem.productImageUrl || item.imageUrl || '';
      var thumb = orderWorkImage(productImageUrl, item.productName || 'מוצר', 'admin-order-work-item__main-image');

      var itemTitle = make('div', 'admin-order-work-item__title admin-order-work-item__title--compact');
      itemTitle.appendChild(make('strong', '', sheetItem.productName || item.productName || item.productId || 'מוצר'));

      var selection = sheetItem.selectionsText || item.selectionsText || '';
      if (selection) itemTitle.appendChild(make('small', '', selection));

      var itemMeta = make('div', 'admin-order-work-item__meta admin-order-work-item__meta--compact');
      itemMeta.appendChild(make('span', '', 'כמות ' + (sheetItem.quantity || item.quantity || 1)));
      itemMeta.appendChild(make('span', '', moneyValue(sheetItem.lineTotal != null ? sheetItem.lineTotal : item.lineTotal, order.currency)));
      itemTitle.appendChild(itemMeta);

      var productLink = orderWorkLink(sheetItem.productLink || item.productLink || '', 'מוצר ↗');
      top.append(checkWrap, thumb, itemTitle, productLink);
      row.appendChild(top);

      var selectionImageUrl = sheetItem.selectionImageUrl || item.selectionImageUrl || '';
      var personalization = sheetItem.personalizationText || orderWorkPersonalization(item) || '';
      if (selectionImageUrl || personalization || item.needsGreeting || item.needsCustomPhoto) {
        var relevant = make('div', 'admin-order-work-relevant admin-order-work-relevant--compact');
        if (selectionImageUrl) relevant.appendChild(orderWorkAssetFull('תמונת בחירה', selectionImageUrl, selectionImageUrl, item.selectionImageUrl || ''));
        if (personalization) relevant.appendChild(orderWorkField('התאמה אישית', personalization));

        if (item.needsGreeting) {
          var greetingFallback = item.greeting && item.greeting.dataUrl || '';
          relevant.appendChild(orderWorkAssetFull('תמונת ברכה', sheetItem.greetingImageUrl || '', sheetItem.greetingDriveUrl || '', greetingFallback));
          relevant.appendChild(orderWorkField('קישור ברכה', orderWorkLink(
            sheetItem.greetingDriveUrl || greetingFallback,
            sheetItem.greetingDriveUrl ? 'Drive ↗' : (greetingFallback ? 'תמונה ↗' : '—')
          )));
        }

        if (item.needsCustomPhoto) {
          var photoFallback = item.customPhoto && item.customPhoto.dataUrl || '';
          relevant.appendChild(orderWorkAssetFull('תמונת לקוח', sheetItem.customPhotoImageUrl || '', sheetItem.customPhotoDriveUrl || '', photoFallback));
          relevant.appendChild(orderWorkField('קישור תמונת לקוח', orderWorkLink(
            sheetItem.customPhotoDriveUrl || photoFallback,
            sheetItem.customPhotoDriveUrl ? 'Drive ↗' : (photoFallback ? 'תמונה ↗' : '—')
          )));
        }
        row.appendChild(relevant);
      }

      var fullDetails = make('details', 'admin-order-work-item-more');
      var fullSummary = document.createElement('summary');
      fullSummary.textContent = 'פרטים מלאים';
      fullDetails.appendChild(fullSummary);

      var details = make('div', 'admin-order-work-item__details admin-order-work-item__details--compact');
      details.appendChild(orderWorkField('שם מוצר', sheetItem.productName || item.productName || item.productId || '—'));
      details.appendChild(orderWorkField('בחירה / דגם', sheetItem.selectionsText || item.selectionsText || '—'));
      details.appendChild(orderWorkField('כמות', sheetItem.quantity || item.quantity || 1));
      details.appendChild(orderWorkField('מחיר מוצר', moneyValue(sheetItem.unitPrice != null ? sheetItem.unitPrice : item.unitPrice, order.currency)));
      details.appendChild(orderWorkField('סה״כ שורה', moneyValue(sheetItem.lineTotal != null ? sheetItem.lineTotal : item.lineTotal, order.currency)));
      details.appendChild(orderWorkField('תאריך הזמנה', sheetItem.orderDate || (order.paidAt ? dateTime(order.paidAt) : dateTime(order.createdAt))));
      details.appendChild(orderWorkField('מספר הזמנה למוצר', sheetItem.itemOrderRef || item.itemOrderRef || '—'));
      details.appendChild(orderWorkField('קישור מוצר', orderWorkLink(sheetItem.productLink || item.productLink || '', 'פתיחת מוצר ↗')));
      fullDetails.appendChild(details);
      row.appendChild(fullDetails);

      itemChecks.push({ input: input, item: item, row: row });
      list.appendChild(row);

      input.addEventListener('change', async function () {
        var next = input.checked;
        input.disabled = true;
        row.classList.toggle('is-completed', next);

        try {
          var result = await apiAction(
            '/api/admin/order-work/' + encodeURIComponent(order.orderRef) + '/items/' + encodeURIComponent(item.itemIndex),
            'POST',
            { completed: next }
          );
          item.completed = next;
          if (typeof result.orderCompleted === 'boolean') orderCheck.checked = result.orderCompleted;

          if (result.sheetSynced === false) {
            showToast(
              result.sheetError === 'apps_script_outdated'
                ? 'נשמר באדמין. צריך לפרוס את Apps Script V9 כדי שהווי יעבור ל-Google Sheet'
                : 'נשמר באדמין, אבל הסנכרון ל-Google Sheet נכשל'
            );
          } else {
            showToast('עודכן באדמין וב-Google Sheet');
          }
        } catch (error) {
          input.checked = !next;
          item.completed = !next;
          row.classList.toggle('is-completed', !next);
          showToast('לא הצלחנו לשמור את העדכון');
        } finally {
          input.disabled = false;
          updateProgress();
        }
      });
    });

    listSection.appendChild(list);
    cardEl.appendChild(listSection);

    if (snapshot) {
      var raw = make('details', 'admin-order-work-sheet-raw admin-order-work-sheet-raw--organized admin-order-work-sheet-raw--compact');
      var summary = document.createElement('summary');
      summary.textContent = 'מידע Google Sheet';
      raw.appendChild(summary);

      var rawGrid = make('div', 'admin-order-work-sheet-raw__grid');
      rawGrid.appendChild(orderWorkField('כותרת הזמנה', snapshot.titleText || '—'));
      rawGrid.appendChild(orderWorkField('פרטי קשר', snapshot.contactText || '—'));
      rawGrid.appendChild(orderWorkField('כתובת', snapshot.addressText || '—'));
      rawGrid.appendChild(orderWorkField('כניסה / קומה / הערות', snapshot.extraText || '—'));
      raw.appendChild(rawGrid);
      cardEl.appendChild(raw);
    }

    function updateProgress() {
      var done = itemChecks.filter(function (entry) { return entry.input.checked; }).length;
      var total = itemChecks.length;
      var allDone = total > 0 && done === total;
      var partial = done > 0 && done < total;
      var workState = allDone ? 'green' : (partial ? 'partial' : 'red');

      orderCheck.checked = allDone;
      orderCheck.indeterminate = partial;
      progressText.textContent = done + '/' + total;
      progressSub.textContent = allDone ? 'בוצע' : (partial ? 'חלקי' : 'ממתין');
      cardEl.dataset.workState = workState;
      cardEl.classList.toggle('is-completed', allDone);
      statusChip.className = 'admin-order-work-status-chip admin-order-work-status-chip--' + workState;
      statusChip.textContent = allDone ? 'הושלמה' : (partial ? 'חלקית' : 'ממתינה');

      itemChecks.forEach(function (entry) {
        entry.row.classList.toggle('is-completed', entry.input.checked);
      });
    }

    orderCheck.addEventListener('change', async function () {
      var next = orderCheck.checked;
      orderCheck.disabled = true;

      itemChecks.forEach(function (entry) {
        entry.input.disabled = true;
        entry.input.checked = next;
        entry.row.classList.toggle('is-completed', next);
      });
      updateProgress();

      try {
        var result = await apiAction(
          '/api/admin/order-work/' + encodeURIComponent(order.orderRef),
          'POST',
          { completed: next }
        );
        items.forEach(function (item) { item.completed = next; });

        if (result.sheetSynced === false) {
          showToast(
            result.sheetError === 'apps_script_outdated'
              ? 'נשמר באדמין. צריך לפרוס את Apps Script V9 כדי שהווי יעבור ל-Google Sheet'
              : 'נשמר באדמין, אבל הסנכרון ל-Google Sheet נכשל'
          );
        } else {
          showToast('כל ההזמנה עודכנה גם ב-Google Sheet');
        }
      } catch (error) {
        itemChecks.forEach(function (entry) {
          entry.input.checked = !next;
          entry.item.completed = !next;
        });
        showToast('לא הצלחנו לשמור את העדכון');
      } finally {
        orderCheck.disabled = false;
        itemChecks.forEach(function (entry) { entry.input.disabled = false; });
        updateProgress();
      }
    });

    updateProgress();
    return cardEl;
  }

  function mergeOrderWorkSheetSnapshot(order, snapshot) {
    if (!order || !snapshot) return order;
    order.sheetSnapshot = snapshot;

    if (Array.isArray(snapshot.items)) {
      var byIndex = {};
      snapshot.items.forEach(function (item) {
        byIndex[Number(item.itemIndex)] = item;
      });

      order.items = (order.items || []).map(function (item) {
        var copy = Object.assign({}, item);
        copy.sheet = byIndex[Number(item.itemIndex)] || null;
        return copy;
      });
    }

    return order;
  }

  function loadOrderWorkSheetSnapshotsInBackground(orders, viewKey, syncNode) {
    if (!Array.isArray(orders) || !orders.length) {
      if (syncNode) {
        syncNode.className = 'admin-order-work-sync-state is-ok';
        syncNode.textContent = 'אין הזמנות לטעינה';
      }
      return;
    }

    var descriptors = orders.map(function (order) {
      return {
        orderRef: order.orderRef,
        items: (order.items || []).map(function (item) {
          return {
            itemIndex: item.itemIndex,
            productId: item.productId,
            productSlug: item.productSlug,
            productName: item.productName,
            needsGreeting: item.needsGreeting === true,
            needsCustomPhoto: item.needsCustomPhoto === true,
            needsPersonalization: item.needsPersonalization === true
          };
        })
      };
    });

    apiAction('/api/admin/order-work-sheet-snapshots', 'POST', { orders: descriptors })
      .then(function (result) {
        var currentKey = [
          state.ranges.orderWork || '30d',
          state.orderWorkStatus || 'all',
          state.offsets.orderWork || 0
        ].join('|');
        if (currentKey !== viewKey) return;

        var snapshots = result && result.snapshots || {};

        orders.forEach(function (order) {
          var snapshot = snapshots[order.orderRef];
          if (!snapshot) return;

          mergeOrderWorkSheetSnapshot(order, snapshot);

          var cards = document.querySelectorAll('[data-order-work-ref]');
          for (var i = 0; i < cards.length; i += 1) {
            if (cards[i].getAttribute('data-order-work-ref') === String(order.orderRef || '')) {
              cards[i].replaceWith(renderOrderWorkCard(order));
              break;
            }
          }
        });

        if (syncNode) {
          var sync = result && result.sheetSync || {};
          syncNode.className = 'admin-order-work-sync-state' + (sync.ok ? ' is-ok' : ' is-error');
          syncNode.textContent = sheetSyncLabel(sync);
        }
      })
      .catch(function () {
        if (syncNode) {
          syncNode.className = 'admin-order-work-sync-state is-error';
          syncNode.textContent = 'Google Sheets לא נטען';
        }
      });
  }

  async function renderOrderWorkPage() {
    var offset = state.offsets.orderWork || 0;
    var range = state.ranges.orderWork || '30d';
    var workStatus = state.orderWorkStatus || 'all';
    var data = await api('/api/admin/order-work?range=' + encodeURIComponent(range) + '&workStatus=' + encodeURIComponent(workStatus) + '&limit=20&offset=' + offset);
    var frag = document.createDocumentFragment();

    var filtersCard = make('section', 'admin-order-work-filters-card admin-order-work-filters-card--compact');

    var filters = make('div', 'admin-order-work-filters admin-order-work-filters--compact');
    var statusGroup = make('div', 'admin-order-work-filter-block admin-order-work-filter-block--compact');
    statusGroup.appendChild(renderOrderWorkStatusFilter(workStatus, data.statusCounts || {}, function (next) {
      state.orderWorkStatus = next; state.offsets.orderWork = 0; renderCurrentPage();
    }));

    var rangeGroup = make('div', 'admin-order-work-filter-block admin-order-work-filter-block--compact');
    rangeGroup.appendChild(renderRangeFilter(range, orderWorkRangeOptions, function (next) {
      state.ranges.orderWork = next; state.offsets.orderWork = 0; renderCurrentPage();
    }));

    filters.append(statusGroup, rangeGroup);
    filtersCard.appendChild(filters);
    frag.appendChild(filtersCard);

    var topTools = make('div', 'admin-order-work-top-tools');
    topTools.appendChild(compactPickupTool());

    var toolbar = make('div', 'admin-toolbar admin-order-work-syncbar admin-order-work-syncbar--compact');
    var sync = data.sheetSync || {};
    var syncNode = make('span', 'admin-order-work-sync-state' + (sync.pending ? '' : (sync.ok ? ' is-ok' : ' is-error')), sheetSyncLabel(sync));
    toolbar.appendChild(syncNode);
    toolbar.appendChild(make(
      'span',
      'admin-toolbar-note',
      'טיפול: אדום = ממתינה · צהוב = חלקית · ירוק = הושלמה | Track: אדום = לא חובר · צהוב = חובר חלקית · ירוק = הכול מחובר'
    ));
    topTools.appendChild(toolbar);
    frag.appendChild(topTools);

    var ordersWrap = make('div', 'admin-order-work-list admin-order-work-list--organized admin-order-work-list--compact');
    if (!(data.orders || []).length) {
      var empty = make('div', 'admin-empty');
      empty.appendChild(make('strong', '', 'אין הזמנות שתואמות לפילטרים שבחרת.'));
      ordersWrap.appendChild(empty);
    } else {
      (data.orders || []).forEach(function (order) { ordersWrap.appendChild(renderOrderWorkCard(order)); });
    }
    frag.appendChild(ordersWrap);
    frag.appendChild(renderPagination({ count: data.count, limit: data.limit, offset: data.offset, onChange: function (next) { state.offsets.orderWork = next; renderCurrentPage(); } }));
    content.replaceChildren(frag);

    var viewKey = [range, workStatus, offset].join('|');
    loadOrderWorkSheetSnapshotsInBackground(data.orders || [], viewKey, syncNode);
    await maybeOpenRequestedOrder();
  }

  async function renderProductsPage() {
    var range = state.ranges.products;
    var offset = state.offsets.products;
    var data = await api('/api/admin/products?range=' + encodeURIComponent(range) + '&limit=50&offset=' + offset);
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, rangeOptions, function (next) { state.ranges.products = next; state.offsets.products = 0; renderCurrentPage(); }));
    toolbar.appendChild(make('span', 'admin-toolbar-note', 'מוצרים ללא מכירת Paid בטווח לא יוצגו'));
    frag.appendChild(toolbar);
    frag.appendChild(renderKpis([
      { label: 'מוצרים שנמכרו', value: numberFmt(data.count), hint: 'מוצרים ייחודיים עם Paid', primary: true },
      { label: 'עמוד', value: numberFmt(Math.floor(data.offset / data.limit) + 1), hint: 'דירוג לפי יחידות' }
    ]));
    var table = topProductsTable(data.products || [], 'ביצועי מוצרים', 'יחידות שנמכרו, כמה פעמים קנו כל מוצר והכנסה ברוטו');
    table.appendChild(renderPagination({ count: data.count, limit: data.limit, offset: data.offset, onChange: function (next) { state.offsets.products = next; renderCurrentPage(); } }));
    frag.appendChild(table);
    content.replaceChildren(frag);
  }

  async function renderCustomersPage() {
    var offset = state.offsets.customers;
    var data = await api('/api/admin/customers?limit=50&offset=' + offset);
    var paying = (data.customers || []).filter(function (customer) { return customer.paidOrderCount > 0; }).length;
    var spendOnPage = (data.customers || []).reduce(function (sum, customer) { return sum + Number(customer.paidSpendAgorot || 0); }, 0);
    var frag = document.createDocumentFragment();
    frag.appendChild(renderKpis([
      { label: 'משתמשים רשומים', value: numberFmt(data.count), hint: 'סה״כ חשבונות', primary: true },
      { label: 'לקוחות משלמים בעמוד', value: numberFmt(paying), hint: 'לפחות הזמנת Paid אחת' },
      { label: 'Paid spend בעמוד', value: moneyAgorot(spendOnPage), hint: 'סכום הוצאות המשתמשים המוצגים' }
    ]));
    var table = renderTable({
      title: 'לקוחות ומשתמשים',
      subtitle: 'ממוינים לפי סכום הוצאות Paid',
      rows: data.customers || [],
      emptyText: 'אין עדיין משתמשים רשומים.',
      columns: [
        { label: 'לקוח', render: function (row) { return cellPrimary(row.name || row.email, row.email); } },
        { label: 'User ID', render: function (row) { return make('span', 'admin-table__mono', '#' + row.id); } },
        { label: 'טלפון', render: function (row) { return text(row.phone); } },
        { label: 'דיוור', render: function (row) { return row.marketingOptIn ? badge('מאושר', 'verified') : badge('לא', 'neutral'); } },
        { label: 'הזמנות Paid', render: function (row) { return numberFmt(row.paidOrderCount); } },
        { label: 'סה״כ הוצאות', render: function (row) { return make('strong', 'admin-table__strong', moneyAgorot(row.paidSpendAgorot)); } },
        { label: 'Paid אחרון', render: function (row) { return dateTime(row.lastPaidAt); } },
        { label: 'נרשם', render: function (row) { return dateOnly(row.createdAt); } },
        { label: 'לקוח מאומת', render: function (row) { return row.verifiedCustomer ? badge('מאומת', 'verified') : badge('לא', 'neutral'); } }
      ]
    });
    table.appendChild(renderPagination({ count: data.count, limit: data.limit, offset: data.offset, onChange: function (next) { state.offsets.customers = next; renderCurrentPage(); } }));
    frag.appendChild(table);
    content.replaceChildren(frag);
  }


  function stars(rating) {
    var node = make('span', 'admin-stars');
    var rounded = Math.round(Number(rating || 0));
    node.textContent = '★'.repeat(Math.max(0, Math.min(5, rounded))) + '☆'.repeat(Math.max(0, 5 - rounded));
    return node;
  }

  function ratingDistribution(summary) {
    var rows = [];
    var total = Number(summary.count || 0);
    for (var rating = 5; rating >= 1; rating -= 1) {
      var count = Number(summary['rating' + rating] || 0);
      rows.push({ label: rating + ' ★', count: count, percent: total ? Math.round(count / total * 100) : 0 });
    }
    var body = make('div', 'admin-stat-list');
    rows.forEach(function (row) {
      var item = make('div', 'admin-stat-row');
      var label = make('div', 'admin-stat-row__label');
      label.appendChild(make('strong', '', row.label));
      var progress = make('div', 'admin-progress');
      var fill = make('i');
      fill.style.width = row.percent + '%';
      progress.appendChild(fill);
      label.appendChild(progress);
      item.append(label, make('div', 'admin-stat-row__value', numberFmt(row.count) + ' · ' + row.percent + '%'));
      body.appendChild(item);
    });
    return body;
  }

  async function renderReviewsPage() {
    var range = state.ranges.reviews;
    var data = await api('/api/admin/reviews?range=' + encodeURIComponent(range) + '&limit=20');
    var summary = data.summary || {};
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, rangeOptions, function (next) { state.ranges.reviews = next; renderCurrentPage(); }));
    frag.appendChild(toolbar);
    frag.appendChild(renderKpis([
      { label: 'ביקורות', value: numberFmt(summary.count), hint: 'Published בטווח', primary: true },
      { label: 'דירוג ממוצע', value: Number(summary.average || 0).toFixed(2), hint: 'מתוך 5' },
      { label: '5 כוכבים', value: numberFmt(summary.rating5), hint: 'ביקורות מצוינות', tone: 'green' },
      { label: '1–2 כוכבים', value: numberFmt(Number(summary.rating1 || 0) + Number(summary.rating2 || 0)), hint: 'דורש תשומת לב', tone: 'amber' }
    ]));
    var grid = make('div', 'admin-grid-even');
    grid.appendChild(card('חלוקת דירוגים', '1–5 כוכבים', ratingDistribution(summary)));
    var topBody = make('div', 'admin-stat-list');
    if (!(data.topProducts || []).length) topBody.appendChild(make('div', 'admin-empty', 'אין נתונים.'));
    (data.topProducts || []).forEach(function (product) {
      var row = make('div', 'admin-stat-row');
      var label = make('div', 'admin-stat-row__label');
      label.appendChild(make('strong', '', product.name));
      label.appendChild(make('small', '', Number(product.average || 0).toFixed(2) + ' ★'));
      row.append(label, make('div', 'admin-stat-row__value', numberFmt(product.count)));
      topBody.appendChild(row);
    });
    grid.appendChild(card('מוצרים עם הכי הרבה ביקורות', 'Published בטווח', topBody));
    frag.appendChild(grid);
    frag.appendChild(renderTable({
      title: 'ביקורות אחרונות',
      subtitle: 'עד 20 ביקורות אחרונות בטווח',
      rows: data.recent || [],
      emptyText: 'אין ביקורות בטווח שנבחר.',
      columns: [
        { label: 'לקוח', render: function (row) { return cellPrimary(row.name, row.email || ''); } },
        { label: 'מוצר', render: function (row) { return productCell({ id: row.productId, name: row.productName, image: row.productImage, href: row.productHref }); } },
        { label: 'דירוג', render: function (row) { return stars(row.rating); } },
        { label: 'ביקורת', render: function (row) { return make('span', 'admin-review-body', text(row.body)); } },
        { label: 'רכישה', render: function (row) { return row.verifiedPurchase ? badge('מאומתת', 'verified') : badge('לא מאומתת', 'neutral'); } },
        { label: 'תאריך', render: function (row) { return dateTime(row.reviewDate); } }
      ]
    }));
    content.replaceChildren(frag);
  }

  async function renderCurrentPage(options) {
    options = options || {};
    state.page = currentPage();
    var meta = pageMeta[state.page] || pageMeta.dashboard;
    setPageMeta(meta[0], meta[1]);
    Array.prototype.forEach.call(document.querySelectorAll('[data-admin-page]'), function (link) {
      link.classList.toggle('is-active', link.dataset.adminPage === state.page);
    });
    if (!options.keepContent) setLoading();
    var version = ++state.requestVersion;
    refreshButton.disabled = true;
    try {
      if (state.page === 'dashboard') await renderDashboardPage();
      else if (state.page === 'visitors') await renderVisitorsPage();
      else if (state.page === 'sales') await renderSalesPage();
      else if (state.page === 'order-work') await renderOrderWorkPage();
      else if (state.page === 'products') await renderProductsPage();
      else if (state.page === 'customers') await renderCustomersPage();
      else if (state.page === 'reviews') await renderReviewsPage();
      if (version !== state.requestVersion) return;
    } catch (error) {
      if (version === state.requestVersion && error.message !== 'admin_required') setError(error);
    } finally {
      if (version === state.requestVersion) refreshButton.disabled = false;
    }
  }

  function openSidebar() {
    sidebar.classList.add('is-open');
    sidebarBackdrop.hidden = false;
    mobileNav.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    sidebarBackdrop.hidden = true;
    mobileNav.setAttribute('aria-expanded', 'false');
  }

  if (mobileNav) mobileNav.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
  Array.prototype.forEach.call(document.querySelectorAll('.admin-nav a'), function (link) {
    link.addEventListener('click', closeSidebar);
  });
  refreshButton.addEventListener('click', function () {
    renderCurrentPage({ keepContent: true }).then(function () { showToast('הנתונים עודכנו'); });
  });

  initAdminPush().catch(function () {});
  renderCurrentPage();
})();
