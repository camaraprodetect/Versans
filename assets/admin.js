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
  var shippingWorkMode = 'packed'; // Default: in-house VerSans packing.
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
    products: ['ניהול מוצרים', 'הוספה, עריכה, מחיקה וסנכרון קטלוג עם Google Sheets'],
    creators: ['יוצרי תוכן', 'ניהול הרשאות, קודי יוצרים ומכירות'],
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

    var match = /^\/admin\/(visitors|sales|order-work|products|customers|reviews|creators)$/.exec(path);
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
    if (value === null || value === undefined || value === '') return fallback === undefined ? '-' : fallback;
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
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short'
      }).format(new Date(Number(value)));
    } catch (_) {
      return '-';
    }
  }

  function dateOnly(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short' }).format(new Date(Number(value)));
    } catch (_) {
      return '-';
    }
  }

  function relative(value) {
    if (!value) return '-';
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

  function adminConfirm(options) {
    options = options || {};
    return new Promise(function (resolve) {
      var previousFocus = document.activeElement;
      var overlay = make('div', 'admin-confirm-overlay');
      if (options.catalogVisibility) overlay.classList.add('admin-catalog-visibility-confirm');
      if (options.creatorVideo) overlay.classList.add('admin-creator-video-confirm');
      overlay.setAttribute('role', 'presentation');

      var modal = make('div', 'admin-confirm-modal');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'adminConfirmTitle');
      modal.setAttribute('aria-describedby', 'adminConfirmMessage');

      var icon = make('div', 'admin-confirm-modal__icon', options.icon || '!');
      icon.setAttribute('aria-hidden', 'true');
      var copy = make('div', 'admin-confirm-modal__copy');
      var eyebrow = make('span', 'admin-confirm-modal__eyebrow', options.eyebrow || 'VERSANS ADMIN');
      var title = make('h2', 'admin-confirm-modal__title', options.title || 'אישור פעולה');
      title.id = 'adminConfirmTitle';
      var message = make('p', 'admin-confirm-modal__message', options.message || 'האם להמשיך?');
      message.id = 'adminConfirmMessage';
      copy.append(eyebrow, title, message);

      var actions = make('div', 'admin-confirm-modal__actions');
      var cancelButton = make('button', 'admin-confirm-modal__button admin-confirm-modal__button--cancel', options.cancelText || 'ביטול');
      cancelButton.type = 'button';
      var confirmButton = make('button', 'admin-confirm-modal__button admin-confirm-modal__button--confirm', options.confirmText || 'אישור');
      confirmButton.type = 'button';
      if (options.danger) confirmButton.classList.add('admin-confirm-modal__button--danger');
      actions.append(cancelButton, confirmButton);
      modal.append(icon, copy, actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeyDown, true);
        overlay.classList.remove('is-open');
        window.setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (previousFocus && typeof previousFocus.focus === 'function') {
            try { previousFocus.focus(); } catch (_) {}
          }
          resolve(value);
        }, 160);
      }
      function onKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }

      cancelButton.addEventListener('click', function () { finish(false); });
      confirmButton.addEventListener('click', function () { finish(true); });
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) finish(false);
      });
      document.addEventListener('keydown', onKeyDown, true);
      window.requestAnimationFrame(function () {
        overlay.classList.add('is-open');
        confirmButton.focus();
      });
    });
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
      if (version === '20261004-push-v65') return registration;

      // An older VerSans Admin worker is still actually receiving pushes.
      // Remove its subscription and registration so iOS cannot keep using it.
      await removeOldAdminWorkerRegistration(registration);
    }

    var fresh = await navigator.serviceWorker.register('/admin-sw.js?v=20261004-push-v65', {
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

  function applicationServerKeyBase64Url(subscription) {
    try {
      var key = subscription && subscription.options && subscription.options.applicationServerKey;
      if (!key) return '';
      var bytes = new Uint8Array(key);
      var binary = '';
      for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch (_) { return ''; }
  }

  async function syncAdminPushSubscription(registration, config, allowCreate) {
    if (!registration || !config || !config.publicKey) return null;
    var subscription = await registration.pushManager.getSubscription();
    var currentKey = subscription ? applicationServerKeyBase64Url(subscription) : '';
    var expectedKey = String(config.publicKey || '').replace(/=+$/g, '');

    if (subscription && currentKey && expectedKey && currentKey !== expectedKey) {
      var oldEndpoint = String(subscription.endpoint || '');
      if (oldEndpoint) {
        try { await apiAction('/api/admin/push/unsubscribe', 'POST', { endpoint: oldEndpoint }); } catch (_) {}
      }
      try { await subscription.unsubscribe(); } catch (_) {}
      subscription = null;
    }

    if (!subscription && allowCreate && Notification.permission === 'granted') {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey)
      });
    }

    if (subscription) {
      /* Always re-register on app load. The local PushSubscription can survive a
         deploy even when the server-side subscription table/key state did not. */
      await apiAction('/api/admin/push/subscribe', 'POST', {
        subscription: subscription.toJSON ? subscription.toJSON() : JSON.parse(JSON.stringify(subscription))
      });
    }
    return subscription;
  }

  var adminPushFallbackTimer = null;
  async function checkAdminPushPending(registration) {
    if (!registration) return;
    var worker = registration.active || registration.waiting || registration.installing;
    if (worker) worker.postMessage({ type: 'CHECK_PENDING' });
  }

  function startAdminPushFallback(registration) {
    if (adminPushFallbackTimer) window.clearInterval(adminPushFallbackTimer);
    checkAdminPushPending(registration).catch(function () {});
    adminPushFallbackTimer = window.setInterval(function () {
      if (document.visibilityState === 'visible') checkAdminPushPending(registration).catch(function () {});
    }, 15000);
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

      var config = pushConfigPromise ? await promiseWithTimeout(pushConfigPromise, 10000, 'push_config_timeout') : null;
      if (!config || !config.publicKey) {
        config = await promiseWithTimeout(api('/api/admin/push/config'), 10000, 'push_config_timeout');
        pushConfigPromise = Promise.resolve(config);
      }

      var subscription = Notification.permission === 'granted'
        ? await syncAdminPushSubscription(registration, config, true)
        : await registration.pushManager.getSubscription();

      var active = Notification.permission === 'granted' && !!subscription;
      pushButton.disabled = false;
      pushButton.dataset.active = active ? '1' : '0';
      pushButton.classList.toggle('is-active', active);
      pushButton.textContent = active ? '🔔 התראות פעילות' : '🔔 הפעל התראות';
      pushButton.title = active ? 'התראות על הזמנות חדשות פעילות ומסונכרנות במכשיר הזה' : 'קבל התראה בכל פעם שנכנסת הזמנה חדשה';
      if (active) startAdminPushFallback(registration);
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

      var subscription = await promiseWithTimeout(
        syncAdminPushSubscription(registration, config, true),
        15000,
        'push_subscription_timeout'
      );
      if (!subscription) throw new Error('push_subscription_unavailable');

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

    await refreshAdminPushButton();

    window.addEventListener('focus', function () {
      if (pushButton && pushButton.dataset.active === '1' && pushRegistrationPromise) {
        pushRegistrationPromise.then(checkAdminPushPending).catch(function () {});
      }
    });
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
      windowText.textContent = 'תצוגה: ' + formatSalesDate(rows[startIndex].date) + ' - ' + formatSalesDate(rows[endIndex].date) + ' · שיא בטווח: ' + moneyAgorot(maxRevenue);

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
      ['/admin/creators', 'יוצרי תוכן', 'קודים ומכירות'],
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
    body.appendChild(detailItem('Checkout', String(system.checkoutMode || '-').toUpperCase()));
    body.appendChild(detailItem('Database', system.databaseBackend || '-'));
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
    if (code === 'tracking_not_found') return 'המערכת בדקה אוטומטית את הקשרים שסופקו בשירות המעקב, אך עדיין לא התקבלה התאמה מאומתת למספר החדש. לא נשלחה הודעה ללקוח שגוי.';
    if (code === 'tracking_auto_match_ambiguous') return 'שירות המעקב החזיר יותר מהתאמה אחת למספר החדש. מטעמי בטיחות ההודעה לא נשלחה.';
    if (code === 'pickup_candidate_no_longer_valid') return 'ההזמנה שנבחרה כבר לא מתאימה לתנאי החיפוש. בדקו שוב את מספר המעקב והסטטוס.';
    if (code === 'tracking_auto_match_failed') return 'לא הצלחנו לבדוק את נתוני המעקב כרגע. נסו שוב מאוחר יותר.';
    if (code === 'previous_tracking_not_found') return 'מספר המעקב הקודם לא נמצא במערכת. בדקו את מספר המעקב כפי שהוא מופיע בהזמנה.';
    if (code === 'tracking_alias_conflict') return 'מספר המעקב הזה כבר מחובר להזמנה אחרת. ההודעה לא נשלחה. בדקו את פרטי החבילה.';
    if (code === 'tracking_alias_failed' || code === 'invalid_tracking_number') return 'לא ניתן לקשר את מספרי המעקב. בדקו את המספרים ונסו שוב.';
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

    var linkPanel = make('div', 'admin-pickup-link-panel');
    linkPanel.hidden = true;
    linkPanel.appendChild(make('strong', '', 'מספר המעקב השתנה? חברו אותו להזמנה המקורית'));
    linkPanel.appendChild(make('p', '', 'הזינו את מספר המעקב הראשון שמופיע במשלוח ב-VerSans (למשל ALS...). לפני השליחה נציג את ההזמנה שנמצאה לאישור.'));
    var previousLabel = make('label');
    previousLabel.appendChild(make('span', '', 'מספר מעקב קודם'));
    var previousInput = document.createElement('input');
    previousInput.type = 'text';
    previousInput.maxLength = 80;
    previousInput.placeholder = 'ALS...';
    previousInput.autocomplete = 'off';
    previousInput.dir = 'ltr';
    previousLabel.appendChild(previousInput);
    linkPanel.appendChild(previousLabel);
    var linkButtons = make('div', 'admin-pickup-link-panel__actions');
    var checkLink = make('button', 'admin-shipment-submit', 'בדוק התאמה להזמנה');
    checkLink.type = 'button';
    var confirmLink = make('button', 'admin-shipment-submit admin-pickup-link-confirm', 'אשר קשר ושלח ללקוח');
    confirmLink.type = 'button';
    confirmLink.hidden = true;
    linkButtons.appendChild(checkLink);
    linkButtons.appendChild(confirmLink);
    linkPanel.appendChild(linkButtons);
    var linkMatch = make('div', 'admin-pickup-link-match');
    linkMatch.hidden = true;
    linkPanel.appendChild(linkMatch);
    form.appendChild(linkPanel);


    // A nearby ready-to-pick-up shipment is only a candidate; never send
    // until the admin selects and confirms exactly one shipment.
    var candidatesPanel = make('section', 'admin-pickup-candidates');
    candidatesPanel.hidden = true;
    var candidateSelection = null;
    var candidateConfirm = make('button', 'admin-shipment-submit admin-pickup-candidates__confirm', 'אשר התאמה ושלח הודעת איסוף');
    candidateConfirm.type = 'button';
    candidateConfirm.hidden = true;
    form.appendChild(candidatesPanel);

    function clearCandidates() {
      candidateSelection = null;
      candidatesPanel.hidden = true;
      candidatesPanel.replaceChildren();
      candidateConfirm.hidden = true;
    }
    function renderPickupCandidates(data) {
      clearCandidates();
      linkPanel.hidden = true;
      candidatesPanel.hidden = false;
      candidatesPanel.appendChild(make('h3', '', 'נמצאו משלוחים שממתינים לאיסוף באזור'));
      var summary = 'מספר לא מוכר: ' + (data.trackingId || '-') + ' · ' +
        (data.totalMatches || 0) + ' הזמנות אפשריות';
      if (data.pickupCity) summary += ' · אזור האיסוף: ' + data.pickupCity;
      candidatesPanel.appendChild(make('p', 'admin-pickup-candidates__summary', summary));
      if (data.searchTruncated || Number(data.totalMatches || 0) > (data.candidates || []).length) candidatesPanel.appendChild(make('p', 'admin-pickup-candidates__warning', 'נמצאו התאמות נוספות שלא מוצגות ברשימה; אפשר לצמצם לאחר התעדכנות המעקב.'));
      candidatesPanel.appendChild(make('p', 'admin-pickup-candidates__warning', 'המרחקים מחושבים בקירוב בין מרכזי יישובים (עד כ-10 ק״מ), לא בין כתובות מדויקות. זה אינו אישור ששני המספרים שייכים לאותה חבילה. בחרו רק לאחר בדיקה.'));
      var list = make('div', 'admin-pickup-candidates__list');
      (data.candidates || []).forEach(function (item) {
        var card = make('div', 'admin-pickup-candidate');
        var main = make('div', 'admin-pickup-candidate__main');
        main.appendChild(make('strong', '', 'הזמנה ' + item.orderRef + ' · ' + (item.customerName || 'לקוח/ה')));
        main.appendChild(make('div', '', 'מספר מעקב קיים: ' + item.trackingId));
        main.appendChild(make('div', '', 'עיר בהזמנה: ' + (item.orderCity || 'לא צוינה')));
        if (item.approximateDistanceKm != null) {
          main.appendChild(make('div', '', 'מרחק משוער בין היישובים: ' + item.approximateDistanceKm.toFixed(1) + ' ק״מ'));
        } else {
          main.appendChild(make('div', '', 'התאמה לפי שם יישוב · מרחק מדויק לא ידוע'));
        }
        main.appendChild(make('div', '', 'סטטוס: ממתין לאיסוף' + (item.alreadySent ? ' · הודעת איסוף כבר נשלחה' : '')));
        if (item.latestEvent) main.appendChild(make('small', '', item.latestEvent));
        var choose = make('button', 'admin-pickup-candidate__choose', 'בחר בהזמנה זו');
        choose.type = 'button';
        choose.addEventListener('click', function () {
          Array.prototype.forEach.call(list.children, function(node) {node.classList.remove('is-selected');});
          card.classList.add('is-selected');
          candidateSelection = {message:textarea.value.trim(),shipmentId:item.shipmentId,orderRef:item.orderRef};
          candidateConfirm.hidden = false;
          candidateConfirm.textContent = 'אשר התאמה להזמנה ' + item.orderRef + ' ושלח';
        });
        card.appendChild(main);
        card.appendChild(choose);
        list.appendChild(card);
      });
      candidatesPanel.appendChild(list);
      candidatesPanel.appendChild(candidateConfirm);
      candidatesPanel.appendChild(make('p', 'admin-pickup-candidates__warning', 'בחירה וקישור יישמרו גם להודעות הבאות. אם אינכם בטוחים, אל תאשרו.'));
    }
    candidateConfirm.addEventListener('click', async function () {
      if (!candidateSelection || candidateSelection.message !== textarea.value.trim()) {
        clearCandidates();showToast('ההודעה השתנתה - חפשו שוב לפני אישור');return;
      }
      var old = candidateConfirm.textContent;
      candidateConfirm.disabled = true;
      candidateConfirm.textContent = 'מקשר ושולח…';
      try {
        var data = await apiAction('/api/admin/shipping/pickup-message', 'POST', {
          message:candidateSelection.message,selectedShipmentId:candidateSelection.shipmentId,
          confirmSelection:true,forceResend:resend.checked===true
        });
        showPickupSuccess(data);
      } catch(error) {showPickupError(error);} finally {
        candidateConfirm.disabled = false;
        candidateConfirm.textContent = old;
      }
    });

    var result = make('div', 'admin-pickup-message-result');
    result.hidden = true;
    form.appendChild(result);

    var checkedMatch = null;
    function clearCheckedMatch() {
      checkedMatch = null;
      confirmLink.hidden = true;
      linkMatch.hidden = true;
      linkMatch.replaceChildren();
    }
    previousInput.addEventListener('input', clearCheckedMatch);
    textarea.addEventListener('input', function () {clearCheckedMatch();clearCandidates();});

    function showPickupSuccess(data) {
      clearCandidates();
      linkPanel.hidden = true;
      clearCheckedMatch();
      result.className = 'admin-pickup-message-result is-success';
      result.replaceChildren();
      result.appendChild(make('strong', '', data.alreadySent ? 'הודעת האיסוף כבר נשלחה ללקוח.' : 'הפרטים נקלטו וההודעה הועברה לשליחה ✅'));
      var meta = [];
      if (data.orderRef) meta.push('הזמנה: ' + data.orderRef);
      if (data.trackingId) meta.push('משלוח: ' + data.trackingId);
      if (data.customerName) meta.push('לקוח: ' + data.customerName);
      if (meta.length) result.appendChild(make('div', 'admin-pickup-message-result__meta', meta.join(' · ')));
      if (data.customerPickupDetails) result.appendChild(make('pre', 'admin-pickup-message-result__details', data.customerPickupDetails));
      textarea.value = '';
      previousInput.value = '';
      resend.checked = false;
      showToast(data.forceResend ? 'הודעת האיסוף הועברה שוב לבדיקה' : (data.alreadySent ? 'ההודעה כבר סומנה כנשלחה' : 'הודעת האיסוף הועברה לשליחה'));
      result.hidden = false;
    }
    function showPickupError(error) {
      result.className = 'admin-pickup-message-result is-error';
      result.replaceChildren();
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
      if (error && error.code === 'tracking_not_found' && payload && payload.canLinkPreviousTracking) {
        linkPanel.hidden = false;
        clearCheckedMatch();
        if (payload.searchSummary) {
          var details = payload.searchSummary;
          result.appendChild(make('p', '', 'נבדקו ' + details.checkedShipments + ' משלוחים ונמצאו ' + details.pickupReadyShipments + ' משלוחים עם סטטוס איסוף, אבל לא נמצאה התאמה גיאוגרפית. אפשר לנסות בהמשך כשהמעקב יתעדכן.'));
        }
      }
      result.hidden = false;
    }
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
        var data = await apiAction('/api/admin/shipping/pickup-message', 'POST', {message:message,forceResend:resend.checked===true});
        if (data.needsSelection) {
          result.hidden = true;
          renderPickupCandidates(data);
        } else {
          showPickupSuccess(data);
        }
      } catch (error) {
        showPickupError(error);
      } finally {
        if (!candidatesPanel.hidden) result.hidden = true;
        else result.hidden = false;
        submit.disabled = false;
        submit.textContent = old;
      }
    });
    checkLink.addEventListener('click', async function () {
      var previous = previousInput.value.trim();
      var message = textarea.value.trim();
      if (!message || !previous) {showToast('יש להזין הודעת איסוף ומספר מעקב קודם');return;}
      var old = checkLink.textContent;
      checkLink.disabled = true;
      checkLink.textContent = 'בודק התאמה…';
      clearCheckedMatch();
      result.hidden = true;
      try {
        var data = await apiAction('/api/admin/shipping/pickup-message', 'POST', {
          message:message,previousTrackingNumber:previous,previewOnly:true
        });
        if (!data.orderRef || !data.shipmentId) throw new Error('order_match_missing');
        checkedMatch = {message:message,previousTrackingNumber:previous,orderRef:data.orderRef};
        linkMatch.replaceChildren();
        linkMatch.appendChild(make('strong', '', 'נמצאה הזמנה - בדקו לפני שליחה'));
        linkMatch.appendChild(make('div', '', 'הזמנה: ' + data.orderRef + ' · לקוח: ' + (data.customerName || 'לא צוין')));
        linkMatch.appendChild(make('div', '', 'מספר ישן: ' + previous + ' · מספר חדש: ' + data.trackingId));
        linkMatch.appendChild(make('small', '', 'לחיצה על אישור תקשר את המספר החדש למשלוח ותפעיל את הודעת האיסוף.'));
        linkMatch.hidden = false;
        confirmLink.hidden = false;
      } catch(error) {showPickupError(error);} finally {
        checkLink.disabled=false;
        checkLink.textContent=old;
      }
    });
    confirmLink.addEventListener('click', async function () {
      if (!checkedMatch || checkedMatch.message!==textarea.value.trim() || checkedMatch.previousTrackingNumber!==previousInput.value.trim()) {
        clearCheckedMatch();
        showToast('יש לבדוק שוב את ההתאמה לפני שליחה');
        return;
      }
      var old=confirmLink.textContent;
      confirmLink.disabled=true;
      confirmLink.textContent='מקשר ושולח…';
      try {
        var data=await apiAction('/api/admin/shipping/pickup-message','POST',{
          message:checkedMatch.message,previousTrackingNumber:checkedMatch.previousTrackingNumber,
          confirmLink:true,forceResend:resend.checked===true
        });
        showPickupSuccess(data);
      } catch(error) {showPickupError(error);} finally {
        confirmLink.disabled=false;
        confirmLink.textContent=old;
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
    frag.appendChild(shippingProcessingPanel());
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
    if (!url) return make('span', 'admin-order-work-value admin-order-work-value--empty', '-');
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
    else field.appendChild(make('strong', 'admin-order-work-field__value', value == null || value === '' ? '-' : String(value)));
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
    if (!preview && !linkUrl) links.appendChild(make('span', 'admin-order-work-value--empty', '-'));
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

  function packedShippingPanel() {
    var wrap=make('div','vs-pack-work');
    var intro=make('div','vs-pack-intro');
    intro.appendChild(make('strong','','קליטת חבילות למרכז האריזה של VerSans'));
    intro.appendChild(make('p','','צלמו חבילה, העלו תמונה או הדביקו צילום: אם זוהה משלוח יחיד, הפריטים המשויכים אליו יסומנו כהגיעו אוטומטית. בחיפוש ידני אפשר לבדוק את ההזמנה לפני אישור קליטה.'));
    wrap.appendChild(intro);

    var form=make('form','vs-pack-search');
    var trackingInput=make('input','vs-pack-tracking');
    trackingInput.name='trackingNumber';trackingInput.type='text';trackingInput.autocomplete='off';
    trackingInput.dir='ltr';trackingInput.placeholder='מספר מעקב (ALS / PH / כל מספר אחר)';
    trackingInput.setAttribute('aria-label','מספר מעקב');
    var find=make('button','vs-pack-primary','חפש משלוח');find.type='submit';
    form.append(trackingInput,find);wrap.appendChild(form);
    var actions=make('div','vs-pack-actions');
    var photo=make('input');photo.type='file';photo.accept='image/*';photo.hidden=true;
    var camera=make('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.hidden=true;
    var cameraButton=make('button','vs-pack-secondary','📷 סריקה במצלמה');cameraButton.type='button';cameraButton.onclick=function(){camera.click();};
    var uploadButton=make('button','vs-pack-secondary','⬆ העלאת תמונה');uploadButton.type='button';uploadButton.onclick=function(){photo.click();};
    var pasteZone=make('div','vs-pack-paste','להדבקת תמונה: לחץ כאן ואז Ctrl+V');pasteZone.tabIndex=0;
    pasteZone.setAttribute('role','button');pasteZone.setAttribute('aria-label','הדבקת תמונת חבילה מהלוח');
    actions.append(cameraButton,uploadButton,pasteZone,photo,camera);wrap.appendChild(actions);
    var info=make('div','vs-pack-feedback');info.setAttribute('role','status');info.hidden=true;wrap.appendChild(info);
    var candidates=make('div','vs-pack-candidates');wrap.appendChild(candidates);
    var result=make('section','vs-pack-result');result.hidden=true;wrap.appendChild(result);
    var currentTracking='';
    var lastOrder='';
    function feedback(message,isError){info.hidden=!message;info.className='vs-pack-feedback'+(isError?' is-error':'');info.textContent=message||'';}
    function message(error){
      var code=(error && (error.code || (error.payload && error.payload.error))) || '';
      return ({tracking_not_found:'מספר המעקב לא נמצא בהזמנות. בדוק שהוא חובר תחילה דרך ניהול Tracking.',paid_order_not_found:'לא נמצאה הזמנה ששולמה למספר הזה.',shipment_has_no_assigned_items:'המשלוח קיים, אבל לא שויכו אליו פריטים. קודם שייכו את המשלוח למוצרים בניהול Tracking.',invalid_tracking_number:'מספר המעקב אינו תקין.',admin_required:'יש להתחבר לחשבון אדמין.',permission_denied:'אין הרשאה לפעולה זו.',invalid_packaging_unit:'מספר היחידה אינו תקין.'})[code] || (error && error.message ? error.message : 'לא הצלחנו להשלים את הפעולה. נסו שוב.');
    }
    function customerLine(customer){
      var raw=[customer.street,customer.houseNumber,customer.apartment?'דירה '+customer.apartment:'',customer.city,customer.zip].filter(Boolean);
      return raw.join(', ') || 'כתובת לא צוינה';
    }
    function addDetail(container,label,value){if(!value)return;var div=make('div','vs-pack-detail');div.appendChild(make('small','',label));div.appendChild(make('strong','',value));container.appendChild(div);}
    function showOrder(data) {
      currentTracking=data.shipments && data.shipments.find(function(x){return Number(x.id)===Number(data.focusShipmentId);});
      currentTracking=currentTracking && currentTracking.trackingNumber || trackingInput.value.trim();
      lastOrder=data.orderRef;
      result.replaceChildren();result.hidden=false;
      var summary=make('header','vs-pack-result-header'+(data.readyToPack?' is-ready':''));
      summary.appendChild(make('div','', 'הזמנה ' + data.orderRef));
      summary.appendChild(make('strong','', data.readyToPack?'✅ כל פריטי ההזמנה הגיעו — מוכנה לאריזה ולשליחה':'התקבלו '+data.receivedUnits+' מתוך '+data.totalUnits+' פריטים · חסרים '+data.missingUnits));
      if(data.readyToPack)summary.appendChild(make('p','','יש לארוז את המוצרים בקופסת VerSans ולשלוח ללקוח. לא נשלחה הודעה אוטומטית.'));
      result.appendChild(summary);
      var customer=data.customer||{};
      var customerInfo=make('div','vs-pack-details');
      addDetail(customerInfo,'לקוח',customer.fullName||'לא צוין');
      addDetail(customerInfo,'טלפון',customer.phone||data.customerPhone);
      addDetail(customerInfo,'כתובת למשלוח',customerLine(customer));
      addDetail(customerInfo,'הערות',customer.notes);
      addDetail(customerInfo,'מייל',customer.email||data.customerEmail);
      result.appendChild(customerInfo);
      var shipments=make('div','vs-pack-shipment-chips');
      (data.shipments||[]).forEach(function(shipment){
        var chip=make('span','vs-pack-shipment-chip'+(Number(shipment.id)===Number(data.focusShipmentId)?' is-current':''),shipment.trackingNumber);
        shipments.appendChild(chip);
      });result.appendChild(shipments);
      var list=make('div','vs-pack-item-list');
      (data.items||[]).forEach(function(item){
        var card=make('article','vs-pack-item'+(item.receivedQty===item.qty?' is-complete':''));
        if(item.image){var img=document.createElement('img');img.src=item.image;img.alt=item.name;img.loading='lazy';card.appendChild(img);}
        var main=make('div','vs-pack-item-main');
        main.appendChild(make('strong','',item.name));
        main.appendChild(make('small','',item.receivedQty+' / '+item.qty+' הגיעו'));
        if(data.focusShipmentId && (item.units||[]).some(function(unit){return Number(unit.shipmentId)===Number(data.focusShipmentId);})){
          main.appendChild(make('small','vs-pack-linked-label','משויך לחבילה שזוהתה'));
        }
        var units=make('div','vs-pack-units');
        (item.units||[]).forEach(function(unit){
          var label=make('label','vs-pack-unit'+(unit.arrived?' is-arrived':''));
          var box=make('input');box.type='checkbox';box.checked=Boolean(unit.arrived);
          label.append(box,make('span','',item.qty>1?'יחידה '+unit.unitNumber:'הגיע'));
          if(unit.trackingNumber) label.title='משלוח: '+unit.trackingNumber;
          box.addEventListener('change',async function(){
            var wanted=box.checked;box.disabled=true;
            try{
              var updated=await apiAction('/api/admin/packaging/unit','POST',{
                orderRef:data.orderRef,itemIndex:item.itemIndex,unitNumber:unit.unitNumber,received:wanted
              });
              showOrder(updated);feedback('סימון הפריט נשמר בדאטהבייס.');
            } catch(error){box.checked=!wanted;box.disabled=false;feedback(message(error),true);}
          });
          units.appendChild(label);
        });main.appendChild(units);card.appendChild(main);list.appendChild(card);
      });result.appendChild(list);
      if(data.focusShipmentId&&!data.scanned){
        var confirm=make('button','vs-pack-primary vs-pack-confirm','✓ קלוט משלוח וסמן את הפריטים כהגיעו');confirm.type='button';
        confirm.addEventListener('click',async function(){
          confirm.disabled=true;confirm.textContent='שומר קליטה…';
          try{
            var updated=await apiAction('/api/admin/packaging/scan','POST',{trackingNumber:currentTracking});
            showOrder(updated);
            feedback(updated.newlyReceived?'החבילה נקלטה. '+updated.newlyReceived+' יחידות סומנו כהגיעו.':'המשלוח כבר נקלט. סימונים ידניים נשמרו.');
          }catch(error){confirm.disabled=false;confirm.textContent='✓ קלוט משלוח וסמן את הפריטים כהגיעו';feedback(message(error),true);}
        });result.appendChild(confirm);
      }
    }
    async function lookup(tracking, receiveOnScan){
      var input=String(tracking||'').trim().replace(/\s+/g,'').toUpperCase();
      if(!input){feedback('יש להזין מספר מעקב.',true);return;}
      trackingInput.value=input;find.disabled=true;result.hidden=true;
      candidates.replaceChildren();
      feedback(receiveOnScan?'משלוח זוהה. קולט את הפריטים המשויכים…':'בודק לאיזו הזמנה שייך המשלוח…');
      try{
        var found=receiveOnScan
          ? await apiAction('/api/admin/packaging/scan','POST',{trackingNumber:input})
          : await api('/api/admin/packaging/lookup?trackingNumber='+encodeURIComponent(input));
        showOrder(found);
        if(receiveOnScan){
          if(found.newlyReceived>0){
            feedback('✓ החבילה נקלטה אוטומטית! '+found.newlyReceived+' יחידות סומנו כהגיעו.');
          } else {
            feedback('המשלוח זוהה, אבל לא סומנו יחידות חדשות. ייתכן שכבר נקלט או שסומנו פריטים ידנית כלא הגיעו. אפשר לתקן את הסימונים ברשימה.');
          }
        } else {
          feedback('נמצאה הזמנה. לבדיקה ידנית, בדקו את הפריטים ולחצו על קליטת משלוח.');
        }
      }catch(error){feedback(message(error),true);}
      finally{find.disabled=false;}
    }
    form.addEventListener('submit',function(event){event.preventDefault();lookup(trackingInput.value);});
    function tokensFromText(text){
      var all=String(text||'').toUpperCase().match(/[A-Z0-9][A-Z0-9._-]{6,50}/g)||[];
      return Array.from(new Set(all.filter(function(t){return (t.match(/[0-9]/g)||[]).length>=5 && !/^\d{4}-\d{2}-\d{2}$/.test(t);}).map(function(t){return t.replace(/[.,;:]+$/,'');}))).slice(0,12);
    }
    async function analyzeImage(file){
      if(!file)return;
      feedback('מזהה מספר מעקב מהתמונה…');candidates.replaceChildren();
      var extracted=[];
      if('BarcodeDetector' in window && 'createImageBitmap' in window){
        try{
          var bmp=await createImageBitmap(file);
          var formats=await BarcodeDetector.getSupportedFormats();
          var detector=new BarcodeDetector({formats:formats});
          var found=await detector.detect(bmp);
          bmp.close();
          found.forEach(function(x){extracted.push(x.rawValue);});
        }catch(_){/* Browser OCR fallback below */}
      }
      // Optical character recognition runs in the browser; no image is sent to VerSans.
      try{
        if(!window.Tesseract){
          await new Promise(function(resolve,reject){
            var script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
            script.onload=resolve;script.onerror=function(){reject(new Error('ocr_unavailable'));};document.head.appendChild(script);
          });
        }
        if(window.Tesseract){var ocr=await window.Tesseract.recognize(file,'eng');extracted.push(ocr.data && ocr.data.text || '');}
      }catch(_){if(!extracted.length){feedback('הסריקה האוטומטית אינה זמינה בדפדפן. אפשר להקליד את מספר המעקב ידנית.',true);return;}}
      var matches=tokensFromText(extracted.join(' '));
      if(!matches.length){feedback('לא זוהה מספר מעקב ברור. צלמו את המדבקה מקרוב או הקלידו את המספר.',true);return;}
      var valid=[];
      var seenShipments=Object.create(null);
      for(var index=0;index<matches.length;index++){
        try{
          var r=await api('/api/admin/packaging/lookup?trackingNumber='+encodeURIComponent(matches[index]));
          if(r.orderRef){
            // A label may contain the original tracking number and its alias.
            // Both point to the same physical parcel and must count as one match.
            var shipmentKey=String(r.focusShipmentId||matches[index]);
            if(!seenShipments[shipmentKey]){
              seenShipments[shipmentKey]=true;
              valid.push(matches[index]);
            }
          }
        }catch(_){/* a barcode can be a packaging-only barcode */}
      }
      if(valid.length===1){lookup(valid[0],true);return;}
      if(!valid.length){
        feedback('זוהו מספרים בתמונה, אבל אף אחד מהם לא משויך למשלוח במערכת. בחרו מספר לבדיקה ידנית.',true);
      } else feedback('נמצאו כמה משלוחים. בחרו את המספר שמתאים לחבילה.');
      (valid.length?valid:matches).forEach(function(candidate){
        var button=make('button','vs-pack-candidate',candidate);button.type='button';
        button.onclick=function(){lookup(candidate,valid.length>0);};candidates.appendChild(button);
      });
    }
    camera.addEventListener('change',function(){analyzeImage(camera.files&&camera.files[0]);camera.value='';});
    photo.addEventListener('change',function(){analyzeImage(photo.files&&photo.files[0]);photo.value='';});
    pasteZone.addEventListener('paste',function(event){
      var items=event.clipboardData&&event.clipboardData.items||[];
      for(var i=0;i<items.length;i++)if(items[i].type.indexOf('image/')===0){event.preventDefault();analyzeImage(items[i].getAsFile());return;}
      var text=event.clipboardData&&event.clipboardData.getData('text')||'';
      if(text){event.preventDefault();lookup(text);}
    });
    var orderSearch=make('details','vs-pack-manual-order');
    orderSearch.appendChild(make('summary','','חיפוש הזמנה ידני ועדכון פריטים ללא סריקה'));
    var orderForm=make('form','vs-pack-search');
    var orderInput=make('input');orderInput.placeholder='מספר הזמנה';orderInput.setAttribute('aria-label','מספר הזמנה');orderInput.dir='ltr';
    var orderButton=make('button','vs-pack-secondary','פתח הזמנה');orderButton.type='submit';
    orderForm.append(orderInput,orderButton);orderSearch.appendChild(orderForm);wrap.appendChild(orderSearch);
    orderForm.addEventListener('submit',async function(event){
      event.preventDefault();if(!orderInput.value.trim())return;
      try{feedback('טוען הזמנה…');var data=await api('/api/admin/packaging/order?orderRef='+encodeURIComponent(orderInput.value.trim()));showOrder(data);feedback('ניתן לערוך ידנית את סימוני ההגעה של כל מוצר.');}
      catch(error){feedback(message(error),true);}
    });
    return wrap;
  }

  function shippingProcessingPanel() {
    var section=make('section','admin-order-work-message-panel vs-shipping-modes');
    var tabs=make('div','vs-shipping-tabs');
    var packed=make('button','vs-shipping-tab'+(shippingWorkMode==='packed'?' is-active':''),'📦 משלוחים ארוזים');
    var dropshipping=make('button','vs-shipping-tab'+(shippingWorkMode==='dropshipping'?' is-active':''),'משלוחי דרופשיפינג');
    packed.type=dropshipping.type='button';tabs.append(packed,dropshipping);section.appendChild(tabs);
    var body=make('div','admin-order-work-message-panel__body');
    section.appendChild(body);
    function change(mode){
      shippingWorkMode=mode;
      packed.classList.toggle('is-active',mode==='packed');dropshipping.classList.toggle('is-active',mode==='dropshipping');
      body.replaceChildren();
      if(mode==='packed')body.appendChild(packedShippingPanel());
      else body.appendChild(manualPickupMessageCard());
    }
    packed.onclick=function(){change('packed');};dropshipping.onclick=function(){change('dropshipping');};
    change(shippingWorkMode);
    return section;
  }

  function orderWorkMessagePanel() {
    return shippingProcessingPanel();
  }

  function renderOrderWorkCard(order) {
    var cardEl = make('article', 'admin-order-work-card admin-order-work-card--organized admin-order-work-card--full-connected');
    cardEl.dataset.workState = order.workState || (order.completed ? 'green' : 'red');
    cardEl.setAttribute('data-order-work-ref', String(order.orderRef || ''));
    cardEl.setAttribute('data-fulfillment-state', orderWorkFulfillmentState(order));

    var items = Array.isArray(order.items) ? order.items : [];
    var snapshot = order.sheetSnapshot || null;

    /* Header: treatment + Track state together, but clearly separate. */
    var head = make('div', 'admin-order-work-card__head admin-order-work-card__head--organized admin-order-work-card__head--full');

    var orderCheckWrap = make('label', 'admin-order-work-order-check');
    var orderCheck = document.createElement('input');
    orderCheck.type = 'checkbox';
    orderCheck.checked = !!order.completed;
    orderCheckWrap.appendChild(orderCheck);
    orderCheckWrap.appendChild(make('span', '', 'כל ההזמנה בוצעה'));

    var title = make('div', 'admin-order-work-card__title');
    title.appendChild(make('strong', '', order.orderRef || 'הזמנה'));
    title.appendChild(make('small', '', (order.paidAt ? dateTime(order.paidAt) : dateTime(order.createdAt)) + ' · ' + moneyValue(order.orderTotal, order.currency)));

    var statusLabel = order.workState === 'green' ? 'הושלמה' : (order.workState === 'partial' ? 'חלקית' : 'ממתינה');
    var statusChip = make('span', 'admin-order-work-status-chip admin-order-work-status-chip--' + (order.workState || 'red'), statusLabel);

    var fulfillmentState = orderWorkFulfillmentState(order);
    var trackTone = fulfillmentState === 'complete' ? 'green' : (fulfillmentState === 'partial' ? 'yellow' : 'red');
    var trackStatus = make(
      'span',
      'admin-order-work-track-status admin-order-work-track-status--' + trackTone,
      orderWorkTrackStatusText(order)
    );
    trackStatus.setAttribute('data-order-track-status', '1');

    var progress = make('div', 'admin-order-work-progress');
    var progressText = make('strong', '', '');
    var progressSub = make('span', '', '');
    progress.append(progressText, progressSub);

    var detailsToggle = orderWorkActionButton('פרטים', 'admin-order-work-action--details-toggle', function () {
      var willOpen = detailsBody.hidden;
      detailsBody.hidden = !willOpen;
      detailsToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      detailsToggle.textContent = willOpen ? 'סגור פרטים' : 'פרטים';
      cardEl.classList.toggle('is-details-open', willOpen);
    });
    detailsToggle.setAttribute('aria-expanded', 'false');

    head.append(orderCheckWrap, title, statusChip, trackStatus, progress, detailsToggle);
    cardEl.appendChild(head);

    /* Everything inside the order stays exactly the same, but is collapsed by default. */
    var detailsBody = make('div', 'admin-order-work-card__details-body');
    detailsBody.hidden = true;

    var actions = make('div', 'admin-order-work-card__actions admin-order-work-card__actions--full');
    actions.appendChild(orderWorkActionButton('ניהול Tracking', 'admin-order-work-action--primary', function () {
      openShipmentManager(order);
    }));
    actions.appendChild(orderWorkTrackLink(order));
    actions.appendChild(orderWorkActionButton('פרטי הזמנה', '', function () {
      openOrderDetailsByRef(order.orderRef);
    }));
    actions.appendChild(orderWorkActionButton('העתק מס׳ הזמנה', '', function () {
      var value = String(order.orderRef || '');
      if (!value) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value)
          .then(function () { showToast('מספר ההזמנה הועתק'); })
          .catch(function () {});
      }
    }));
    detailsBody.appendChild(actions);

    /* Full customer/shipping data - visible, same information as the Sheet block. */
    var customer = order.customer || {};
    var customerSection = make('section', 'admin-order-work-section admin-order-work-section--customer');
    customerSection.appendChild(make('h3', 'admin-order-work-section__title', 'פרטי לקוח ומשלוח'));

    var customerGrid = make('div', 'admin-order-work-customer admin-order-work-customer--organized admin-order-work-customer--dense');
    [
      ['שם מלא', order.customerName || customer.fullName || 'אורח'],
      ['טלפון', order.customerPhone || customer.phone || '-'],
      ['אימייל', order.customerEmail || customer.email || '-'],
      ['כתובת מלאה', orderShippingAddress(customer) || '-'],
      ['מיקוד', customer.zip || '-'],
      ['כניסה', customer.entrance || '-'],
      ['קומה', customer.floor || '-'],
      ['הערות', customer.notes || '-']
    ].forEach(function (entry) {
      customerGrid.appendChild(orderWorkField(entry[0], entry[1]));
    });
    customerSection.appendChild(customerGrid);
    detailsBody.appendChild(customerSection);

    /* Product rows mirror the useful columns from Google Sheet. */
    var listSection = make('section', 'admin-order-work-section admin-order-work-section--items admin-order-work-section--items-full');
    var sectionHead = make('div', 'admin-order-work-section__head');
    sectionHead.appendChild(make('h3', 'admin-order-work-section__title', 'מוצרים בהזמנה'));
    sectionHead.appendChild(make('span', 'admin-order-work-section__count', items.length + ' מוצרים'));
    listSection.appendChild(sectionHead);

    var list = make('div', 'admin-order-work-items admin-order-work-items--organized admin-order-work-items--full');
    var itemChecks = [];

    items.forEach(function (item) {
      var sheetItem = item.sheet || {};
      var row = make('article', 'admin-order-work-item admin-order-work-item--organized admin-order-work-item--sheetlike');

      var top = make('div', 'admin-order-work-item__top admin-order-work-item__top--organized admin-order-work-item__top--sheetlike');

      var checkWrap = make('label', 'admin-order-work-item__check');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!item.completed;
      checkWrap.appendChild(input);
      checkWrap.appendChild(make('span', '', 'בוצע'));

      var productImageUrl = sheetItem.productImageUrl || item.imageUrl || '';
      var thumb = orderWorkImage(productImageUrl, item.productName || 'מוצר', 'admin-order-work-item__main-image');

      var itemTitle = make('div', 'admin-order-work-item__title');
      itemTitle.appendChild(make('strong', '', sheetItem.productName || item.productName || item.productId || 'מוצר'));

      var selection = sheetItem.selectionsText || item.selectionsText || '';
      if (selection) itemTitle.appendChild(make('small', '', selection));

      var itemOrderRef = sheetItem.itemOrderRef || item.itemOrderRef || '';
      if (itemOrderRef) itemTitle.appendChild(make('small', 'admin-order-work-item__ref', itemOrderRef));

      var productLinkTop = orderWorkLink(sheetItem.productLink || item.productLink || '', 'קישור מוצר ↗');
      top.append(checkWrap, thumb, itemTitle, productLinkTop);
      row.appendChild(top);

      /* Core sheet columns always shown. */
      var details = make('div', 'admin-order-work-item__details admin-order-work-item__details--sheetlike');
      details.appendChild(orderWorkField('שם מוצר', sheetItem.productName || item.productName || item.productId || '-'));
      details.appendChild(orderWorkField('בחירה / דגם', sheetItem.selectionsText || item.selectionsText || '-'));
      details.appendChild(orderWorkField('כמות', sheetItem.quantity || item.quantity || 1));
      details.appendChild(orderWorkField('מחיר מוצר', moneyValue(sheetItem.unitPrice != null ? sheetItem.unitPrice : item.unitPrice, order.currency)));
      details.appendChild(orderWorkField('סה״כ שורה', moneyValue(sheetItem.lineTotal != null ? sheetItem.lineTotal : item.lineTotal, order.currency)));
      details.appendChild(orderWorkField('תאריך הזמנה', sheetItem.orderDate || (order.paidAt ? dateTime(order.paidAt) : dateTime(order.createdAt))));
      details.appendChild(orderWorkField('מספר הזמנה למוצר', sheetItem.itemOrderRef || item.itemOrderRef || '-'));
      details.appendChild(orderWorkField('קישור מוצר', orderWorkLink(sheetItem.productLink || item.productLink || '', 'פתיחת מוצר ↗')));
      row.appendChild(details);

      /* Only product-specific fields that actually belong to this product. */
      var selectionImageUrl = sheetItem.selectionImageUrl || item.selectionImageUrl || '';
      var personalization = sheetItem.personalizationText || orderWorkPersonalization(item) || '';

      if (selectionImageUrl || personalization || item.needsGreeting || item.needsCustomPhoto) {
        var relevant = make('div', 'admin-order-work-relevant admin-order-work-relevant--sheetlike');

        if (selectionImageUrl) {
          relevant.appendChild(orderWorkAssetFull(
            'תמונת בחירה',
            selectionImageUrl,
            selectionImageUrl,
            item.selectionImageUrl || ''
          ));
        }

        if (personalization) {
          relevant.appendChild(orderWorkField('פרטי התאמה אישית', personalization));
        }

        if (item.needsGreeting) {
          var greetingFallback = item.greeting && item.greeting.dataUrl || '';
          relevant.appendChild(orderWorkAssetFull(
            'תמונת ברכה',
            sheetItem.greetingImageUrl || '',
            sheetItem.greetingDriveUrl || '',
            greetingFallback
          ));
          relevant.appendChild(orderWorkField(
            'קישור ברכה',
            orderWorkLink(
              sheetItem.greetingDriveUrl || greetingFallback,
              sheetItem.greetingDriveUrl ? 'פתיחת קובץ Drive ↗' : (greetingFallback ? 'פתיחת תמונה ↗' : '-')
            )
          ));
        }

        if (item.needsCustomPhoto) {
          var photoFallback = item.customPhoto && item.customPhoto.dataUrl || '';
          relevant.appendChild(orderWorkAssetFull(
            'תמונת לקוח',
            sheetItem.customPhotoImageUrl || '',
            sheetItem.customPhotoDriveUrl || '',
            photoFallback
          ));
          relevant.appendChild(orderWorkField(
            'קישור תמונת לקוח',
            orderWorkLink(
              sheetItem.customPhotoDriveUrl || photoFallback,
              sheetItem.customPhotoDriveUrl ? 'פתיחת קובץ Drive ↗' : (photoFallback ? 'פתיחת תמונה ↗' : '-')
            )
          ));
        }

        row.appendChild(relevant);
      }

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
    detailsBody.appendChild(listSection);

    /* Exact raw Sheet lines stay connected/visible when Sheet data has loaded. */
    if (snapshot) {
      var raw = make('section', 'admin-order-work-sheet-raw admin-order-work-sheet-raw--organized admin-order-work-sheet-raw--visible');
      raw.appendChild(make('h3', 'admin-order-work-section__title', 'נתוני Google Sheet'));

      var rawGrid = make('div', 'admin-order-work-sheet-raw__grid admin-order-work-sheet-raw__grid--visible');
      rawGrid.appendChild(orderWorkField('כותרת הזמנה', snapshot.titleText || '-'));
      rawGrid.appendChild(orderWorkField('פרטי קשר', snapshot.contactText || '-'));
      rawGrid.appendChild(orderWorkField('כתובת', snapshot.addressText || '-'));
      rawGrid.appendChild(orderWorkField('כניסה / קומה / הערות', snapshot.extraText || '-'));
      raw.appendChild(rawGrid);
      detailsBody.appendChild(raw);
    }

    cardEl.appendChild(detailsBody);

    function updateProgress() {
      var done = itemChecks.filter(function (entry) { return entry.input.checked; }).length;
      var total = itemChecks.length;
      var allDone = total > 0 && done === total;
      var partial = done > 0 && done < total;
      var workState = allDone ? 'green' : (partial ? 'partial' : 'red');

      orderCheck.checked = allDone;
      orderCheck.indeterminate = partial;
      progressText.textContent = done + ' / ' + total;
      progressSub.textContent = allDone ? 'הושלמה' : (partial ? 'חלקית' : 'ממתינה');
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
            productLink: item.productLink || '',
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

    frag.appendChild(orderWorkMessagePanel());

    var topTools = make('div', 'admin-order-work-top-tools');

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

  var catalogSearchText = '';
  var catalogPageNumber = 0;
  var catalogItemsCache = [];
  var catalogPendingIds = [];
  var catalogPageSize = 36;
  var catalogSelectedCategory = 'all';
  var catalogShowHiddenOnly = false;
  var catalogCategoryOrders = {};
  var catalogHiddenCategories = {};
  var catalogHiddenCategoryFlags = {};
  var catalogCategoryManagerOpen = false;
  var catalogCategories = [
    ['greeting','תכשיט עם ברכה'],['greeting-mom','לאמא'],['greeting-partner','לאישה'],['greeting-daughter','לבת'],['greeting-sister','לאחות'],
    ['necklaces','שרשראות'],['bracelets','צמידים'],['bracelets-men','צמידים לגברים'],['bracelets-women','צמידים לנשים'],['bracelets-fashion','צמידי אופנה'],
    ['rings','טבעות'],['photo-bracelets','תכשיט עם תמונה'],['watches','שעונים'],['watches-men','שעוני גברים'],['watches-women','שעוני נשים'],
    ['glasses','משקפיים'],['glasses-men','משקפי גברים'],['glasses-women','משקפי נשים'],['glasses-unisex','משקפי יוניסקס'],['hats','כובעים'],
    ['custom','עיצוב אישי'],['women','נשים'],['men','גברים'],['unisex','יוניסקס']
  ];
  function catalogTitle(product) { return String((product.title && (product.title.he || product.title.en)) || product.name || product.id || ''); }
  function catalogPicture(value) {
    var s = String(value || '');
    return /^https:\/\//i.test(s) ? s : '/' + s.replace(/^\/+/, '');
  }
  function catalogButton(label, css, action) {
    var b = make('button', 'admin-catalog-btn ' + (css || ''), label); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function catalogTextField(label, initial, kind) {
    var wrapper = make('label','admin-catalog-field');
    wrapper.appendChild(make('span','',label));
    var el = make(kind === 'textarea' ? 'textarea' : 'input');
    if (kind !== 'textarea') el.type = kind || 'text';
    el.value = initial == null ? '' : String(initial);
    if (kind === 'textarea') el.rows = 3;
    wrapper.appendChild(el);
    return {wrapper:wrapper,input:el};
  }
  function catalogObjectString(value) { return value ? JSON.stringify(value,null,2) : ''; }
  // "פרטי המוצר" is a localized list of visible bullet points on product pages.
  // It is intentionally separate from the advanced JSON options: merchants can
  // manage each line without touching structured product configuration.
  function catalogDetailsEditor(product) {
    var local = product && product.details && typeof product.details === 'object' ? product.details : {};
    var hebrew = Array.isArray(local.he) ? local.he : [];
    var english = Array.isArray(local.en) ? local.en : [];
    var section = make('section','admin-catalog-details admin-catalog-full');
    section.setAttribute('aria-label','פרטי המוצר');
    var header = make('div','admin-catalog-details-header');
    var title = make('div');
    title.appendChild(make('h3','','פרטי המוצר'));
    title.appendChild(make('p','','הפרטים שמופיעים עם סימון ✓ בעמוד המוצר. אפשר לשנות, להוסיף, למחוק ולסדר אותם.'));
    var add = catalogButton('+ הוסף פרט','admin-catalog-primary',function(){appendDetail('', '', true)});
    add.setAttribute('aria-label','הוסף פרט למוצר');
    header.append(title, add);
    section.appendChild(header);
    var list = make('div','admin-catalog-details-list');
    section.appendChild(list);
    var hint = make('p','admin-catalog-details-empty','אין עדיין פרטים למוצר. לחץ על "הוסף פרט" כדי להוסיף.');
    section.appendChild(hint);
    var counter = make('span','admin-catalog-details-counter');
    counter.setAttribute('aria-live','polite');
    section.appendChild(counter);
    function updateRows() {
      var rows = Array.from(list.children);
      rows.forEach(function(row,index) {
        row._number.textContent = String(index + 1);
        row._up.disabled = index === 0;
        row._down.disabled = index === rows.length - 1;
      });
      hint.hidden = rows.length > 0;
      counter.textContent = rows.length + ' / 40 פרטים';
      add.disabled = rows.length >= 40;
    }
    function appendDetail(he, en, focus) {
      if(list.children.length >= 40) return;
      var row = make('div','admin-catalog-detail-row');
      var position = make('span','admin-catalog-detail-number');
      position.setAttribute('aria-hidden','true');
      var heField = catalogTextField('פרט בעברית',he);
      heField.input.maxLength=500;
      heField.input.placeholder='לדוגמה: מצופה 5 שכבות זהב לבן 18 קראט';
      var enField = catalogTextField('באנגלית (אפשר לערוך בנפרד)',en);
      enField.input.maxLength=500;
      enField.input.placeholder='Optional English translation';
      enField.input.dir='ltr';
      var fields = make('div','admin-catalog-detail-fields');
      fields.append(heField.wrapper,enField.wrapper);
      var actions=make('div','admin-catalog-detail-actions');
      var up=catalogButton('↑','admin-catalog-move',function(){if(row.previousElementSibling){list.insertBefore(row,row.previousElementSibling);updateRows()}});
      var down=catalogButton('↓','admin-catalog-move',function(){if(row.nextElementSibling){list.insertBefore(row.nextElementSibling,row);updateRows()}});
      var remove=catalogButton('מחק','admin-catalog-danger',function(){row.remove();updateRows()});
      up.setAttribute('aria-label','העבר פרט למעלה');
      down.setAttribute('aria-label','העבר פרט למטה');
      remove.setAttribute('aria-label','מחק את הפרט הזה');
      actions.append(up,down,remove);
      row._number=position;
      row._he=heField.input;
      row._en=enField.input;
      row._up=up;
      row._down=down;
      row.append(position,fields,actions);
      list.appendChild(row);
      updateRows();
      if(focus) heField.input.focus();
    }
    hebrew.forEach(function(line,index){appendDetail(line,english[index] || '',false)});
    updateRows();
    function getValue() {
      var he=[],en=[];
      Array.from(list.children).forEach(function(row){
        var heText=row._he.value.trim();
        var enText=row._en.value.trim();
        // An entirely empty new row is ignored; a row with only English is an error.
        if(!heText && !enText) return;
        if(!heText) {row._he.focus();throw Error('יש להזין טקסט בעברית לכל פרט, או למחוק את השורה.');}
        if(heText.length>500 || enText.length>500) {row._he.focus();throw Error('כל פרט יכול להכיל עד 500 תווים.');}
        he.push(heText);
        en.push(enText || heText);
      });
      return {he:he,en:en};
    }
    return {section:section,getValue:getValue};
  }
  async function catalogUploadImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw Error('יש להעלות תמונת JPG, PNG או WebP בלבד');
    if (file.size > 2 * 1024 * 1024) throw Error('התמונה גדולה מדי. יש להעלות תמונה עד 2MB');
    var url = await new Promise(function(resolve,reject){ var reader=new FileReader();reader.onload=function(){resolve(reader.result)};reader.onerror=function(){reject(Error('לא ניתן לקרוא את התמונה'))};reader.readAsDataURL(file); });
    var result = await apiAction('/api/admin/catalog/images','POST',{image:url});
    return result.url;
  }
  function openCatalogEditor(product) {
    var editing = Boolean(product);
    var previous = product ? JSON.parse(JSON.stringify(product)) : {};
    var backdrop = make('div','admin-catalog-modal-backdrop');
    var dialog = make('div','admin-catalog-modal');
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label',editing?'עריכת מוצר':'הוספת מוצר');
    var top = make('div','admin-catalog-modal-head');
    top.appendChild(make('h2','',editing?'עריכת מוצר: '+catalogTitle(product):'הוספת מוצר חדש'));
    var close = catalogButton('×','admin-catalog-icon',function(){backdrop.remove()});
    close.setAttribute('aria-label','סגירה');top.appendChild(close);dialog.appendChild(top);
    var form=make('form','admin-catalog-form');
    var name=catalogTextField('שם מוצר *',catalogTitle(product||{}));
    var english=catalogTextField('שם באנגלית',product && product.title && product.title.en);
    var price=catalogTextField('מחיר (₪) *',product && product.price,'number');price.input.step='.01';price.input.min=product&&Number(product.price)===0?'0':'.01';price.input.required=true;
    var compareAt=catalogTextField('מחיר לפני הנחה (₪), אם יש',product && product.compareAt,'number');compareAt.input.step='.01';compareAt.input.min='0';
    var category=catalogTextField('קטגוריה *','');
    var categorySelect=make('select');
    catalogCategories.forEach(function(pair){var o=make('option','',pair[1]);o.value=pair[0];categorySelect.appendChild(o)});
    categorySelect.value=(product && (product.category || (product.categories && product.categories[0])))||'necklaces';category.wrapper.replaceChild(categorySelect,category.input);category.input=categorySelect;
    var categories=catalogTextField('קטגוריות נוספות (מופרדות בפסיקים)',(product && product.categories||[]).join(', '));
    var subtitle=catalogTextField('תיאור קצר',product && product.subtitle && (product.subtitle.he||product.subtitle),'textarea');
    var description=catalogTextField('תיאור מוצר',product && product.description && (product.description.he||product.description),'textarea');
    var sku=catalogTextField('מק"ט',product && product.sku);
    var hover=catalogTextField('תמונת Hover (כתובת)',product && product.hoverImage);
    var gallery=catalogTextField('תמונות מוצר - כל שורה כתובת של תמונה *',product && product.images && product.images.join('\n'),'textarea');
    gallery.input.rows=4;gallery.wrapper.classList.add('admin-catalog-full');
    var upload = make('label','admin-catalog-field admin-catalog-full');upload.appendChild(make('span','','העלאת תמונות מהמחשב (עד 2MB לתמונה)'));
    var fileInput=make('input');fileInput.type='file';fileInput.accept='image/png,image/jpeg,image/webp';fileInput.multiple=true;
    upload.appendChild(fileInput);
    var progress=make('div','admin-catalog-hint','הקובץ יישמר במסד הנתונים, לא בתיקיית התמונות המקומית.');upload.appendChild(progress);
    var preview=make('div','admin-catalog-preview');gallery.wrapper.appendChild(preview);
    function updatePreview(){preview.replaceChildren();gallery.input.value.split(/\r?\n/).map(function(x){return x.trim()}).filter(Boolean).slice(0,12).forEach(function(src){var img=make('img');img.src=catalogPicture(src);img.alt='תמונת מוצר';img.loading='lazy';preview.appendChild(img)})}
    gallery.input.addEventListener('input',updatePreview);updatePreview();
    fileInput.addEventListener('change',async function(){
      if(!fileInput.files.length)return;
      var files=Array.from(fileInput.files);fileInput.disabled=true;
      for(var i=0;i<files.length;i++){
        try {progress.textContent='מעלה תמונה '+(i+1)+' מתוך '+files.length+'...';var url=await catalogUploadImage(files[i]);gallery.input.value+=(gallery.input.value.trim()?'\n':'')+url;updatePreview();}
        catch(e){progress.textContent=e.message||'שגיאה בהעלאת תמונה';break}
      }
      if(i===files.length)progress.textContent='התמונות נשמרו. לחץ שמירת מוצר כדי להציג אותן באתר.';
      fileInput.disabled=false;fileInput.value='';
    });
    var detailsEditor=catalogDetailsEditor(product);
    var advanced=catalogTextField('אפשרויות מוצר מתקדמות (JSON): צבעים, מידות, אריזות, דגמים ותמונות וריאציה',catalogObjectString(product ? {
      colors:product.colors, sizes:product.sizes, boxes:product.boxes, necklaces:product.necklaces,
      giftPackaging:product.giftPackaging, variantImages:product.variantImages,
      badge:product.badge, materials:product.materials, features:product.features
    }:{}),'textarea');advanced.wrapper.classList.add('admin-catalog-full');advanced.input.rows=8;
    var advancedToggle=catalogButton('אפשרויות מתקדמות ▾','admin-catalog-quiet',function(){advanced.wrapper.hidden=!advanced.wrapper.hidden});advanced.wrapper.hidden=true;
    var fields=make('div','admin-catalog-form-grid');
    [name,english,price,compareAt,category,categories,subtitle,description,sku,hover,gallery].forEach(function(x){fields.appendChild(x.wrapper)});
    fields.appendChild(upload);fields.appendChild(detailsEditor.section);fields.appendChild(advanced.wrapper);
    form.appendChild(fields);form.appendChild(advancedToggle);
    var message=make('div','admin-catalog-status');message.setAttribute('role','status');form.appendChild(message);
    var actions=make('div','admin-catalog-actions');var submit=make('button','admin-catalog-btn admin-catalog-primary',editing?'שמור שינויים':'צור מוצר');submit.type='submit';
    actions.appendChild(catalogButton('ביטול','',function(){backdrop.remove()}));actions.appendChild(submit);form.appendChild(actions);
    form.addEventListener('submit',async function(e){
      e.preventDefault();submit.disabled=true;message.textContent='שומר את המוצר...';
      try{
        var record={title:{he:name.input.value.trim(),en:english.input.value.trim()||name.input.value.trim()},price:Number(price.input.value),compareAt:compareAt.input.value.trim()?Number(compareAt.input.value):null,category:category.input.value,
          categories:Array.from(new Set([category.input.value].concat(categories.input.value.split(',').map(function(x){return x.trim()}).filter(Boolean)))),
          subtitle:{he:subtitle.input.value.trim(),en:(previous.subtitle && previous.subtitle.en)||''},
          description:{he:description.input.value.trim(),en:(previous.description && previous.description.en)||''},sku:sku.input.value.trim(),
          images:gallery.input.value.split(/\r?\n/).map(function(s){return s.trim()}).filter(Boolean),hoverImage:hover.input.value.trim(),details:detailsEditor.getValue()};
        var extra=advanced.input.value.trim()?JSON.parse(advanced.input.value):{};
        if(extra && typeof extra==='object')Object.keys(extra).forEach(function(k){if(k!=='details' && extra[k]!==undefined)record[k]=extra[k]});
        var endpoint=editing?('/api/admin/catalog/'+encodeURIComponent(product.slug)):'/api/admin/catalog';
        var out=await apiAction(endpoint,editing?'PUT':'POST',{product:record});
        backdrop.remove();
        await renderProductsPage();
        if(out.sheetSync && !out.sheetSync.ok) {
          alert('המוצר נשמר בחנות, אבל הסנכרון ל-Google Sheets ממתין: '+out.sheetSync.error+'\nאפשר ללחוץ על "סנכרן לגיליון" לנסות שוב.');
        }
      }catch(err){message.textContent='לא ניתן לשמור: '+(err.message||'שגיאה');}
      finally{submit.disabled=false}
    });
    dialog.appendChild(form);backdrop.appendChild(dialog);document.body.appendChild(backdrop);
    backdrop.addEventListener('click',function(e){if(e.target===backdrop)backdrop.remove()});
    var onKey=function(e){if(e.key==='Escape'){backdrop.remove();document.removeEventListener('keydown',onKey)}};
    document.addEventListener('keydown',onKey);name.input.focus();
  }
  function renderCatalogGrid(parent) {
    var normalized=catalogSearchText.trim().toLowerCase();
    var list=catalogItemsCache.filter(function(p){
      var categories=Array.isArray(p.categories)?p.categories:[p.category];
      if(catalogSelectedCategory!=='all' && categories.indexOf(catalogSelectedCategory)<0)return false;
      if(catalogShowHiddenOnly && !p.hidden)return false;
      return !normalized || [catalogTitle(p),p.id,p.slug,p.sku,p.category].some(function(s){return String(s||'').toLowerCase().indexOf(normalized)>=0});
    });
    if(catalogSelectedCategory!=='all'){
      var ranks=catalogCategoryOrders[catalogSelectedCategory]||[];
      list.sort(function(a,b){
        var ai=ranks.indexOf(a.slug),bi=ranks.indexOf(b.slug);
        if(ai<0)ai=100000+catalogItemsCache.indexOf(a);
        if(bi<0)bi=100000+catalogItemsCache.indexOf(b);
        return ai-bi;
      });
    }
    var totalPages=Math.max(1,Math.ceil(list.length/catalogPageSize));catalogPageNumber=Math.min(catalogPageNumber,totalPages-1);
    var grid=make('div','admin-catalog-grid');
    list.slice(catalogPageNumber*catalogPageSize,(catalogPageNumber+1)*catalogPageSize).forEach(function(p){
      var card=make('article','admin-catalog-product' + (p.hidden?' is-hidden':''));
      var picture=make('img');picture.src=catalogPicture(p.image);picture.alt='';picture.loading='lazy';picture.onerror=function(){picture.style.visibility='hidden'};
      var meta=make('div','admin-catalog-product__text');meta.appendChild(make('strong','',catalogTitle(p)));
      meta.appendChild(make('small','',String(p.slug)+' · '+Number(p.price).toFixed(2)+' ₪'));
      if(p.hidden)meta.appendChild(make('span','admin-catalog-hidden-label','מוסתר מהחנות'));
      if(catalogPendingIds.indexOf(p.slug)>=0)meta.appendChild(make('span','admin-catalog-pending','ממתין לסנכרון גיליון'));
      var tools=make('div','admin-catalog-product__actions');
      tools.appendChild(catalogButton('עריכה בעמוד המוצר','admin-catalog-primary',function(){window.location.href='/product.html?id='+encodeURIComponent(p.slug)+'&edit=1&admin_preview=1';}));
      var site=make('a','admin-catalog-btn', p.hidden?'תצוגת אדמין':'צפייה');
      site.href=p.hidden?('/product.html?id='+encodeURIComponent(p.slug)+'&admin_preview=1'):p.href;
      site.target='_blank';site.rel='noopener';tools.appendChild(site);
      tools.appendChild(catalogButton(p.hidden?'הצג בחנות':'הסתר',p.hidden?'admin-catalog-unhide':'admin-catalog-quiet',async function(){
        var wasHidden=Boolean(p.hidden);
        var approved=await adminConfirm({
          catalogVisibility:true,
          danger:!wasHidden,
          icon:wasHidden?'↺':'!',
          title:wasHidden?'להחזיר את המוצר לחנות?':'להסתיר את המוצר מהחנות?',
          message:wasHidden
            ? 'המוצר "'+catalogTitle(p)+'" יחזור להופיע בקטגוריות ויהיה זמין ללקוחות.'
            : 'המוצר "'+catalogTitle(p)+'" יוסר מהתצוגה ללקוחות. הוא יישמר באדמין ותוכל להציג אותו שוב בכל עת.',
          cancelText:'ביטול',
          confirmText:wasHidden?'כן, הצג בחנות':'כן, הסתר מוצר'
        });
        if(!approved)return;
        try{
          await apiAction('/api/admin/catalog/'+encodeURIComponent(p.slug)+'/visibility','POST',{hidden:!wasHidden});
          showToast(wasHidden?'המוצר הוחזר לחנות':'המוצר הוסתר מהחנות');await renderProductsPage();
        }catch(e){showToast('הפעולה נכשלה: '+e.message)}
      }));
      tools.appendChild(catalogButton('מחיקה','admin-catalog-danger',async function(){
        if(!window.confirm('למחוק את '+catalogTitle(p)+' מהחנות?\nהזמנות קיימות לא יימחקו.'))return;
        try{var result=await apiAction('/api/admin/catalog/'+encodeURIComponent(p.slug),'DELETE');await renderProductsPage();if(result.sheetSync&&!result.sheetSync.ok)alert('המוצר הוסר מהחנות, אבל מחיקתו מהגיליון ממתינה לסנכרון.');}
        catch(e){alert('לא ניתן למחוק: '+e.message)}
      }));
      card.append(picture,meta,tools);
      if(catalogSelectedCategory!=='all'){
        var reposition=make('div','admin-catalog-reposition');
        var ranks=catalogCategoryOrders[catalogSelectedCategory]||[];
        var matching=catalogItemsCache.filter(function(item){return (item.categories||[item.category]).indexOf(catalogSelectedCategory)>=0});
        var full=ranks.filter(function(slug){return matching.some(function(item){return item.slug===slug})}).concat(matching.map(function(item){return item.slug}).filter(function(slug){return ranks.indexOf(slug)<0}));
        var position=make('input');position.type='number';position.min='1';position.max=String(full.length);position.value=String(full.indexOf(p.slug)+1);position.setAttribute('aria-label','מיקום בקטגוריה');
        var move=catalogButton('העבר למיקום','',async function(){
          var wanted=Number(position.value);
          if(!Number.isInteger(wanted)||wanted<1||wanted>full.length){showToast('יש לבחור מיקום בין 1 ל-'+full.length);return}
          move.disabled=true;
          try{await apiAction('/api/admin/catalog/'+encodeURIComponent(p.slug)+'/position','POST',{category:catalogSelectedCategory,position:wanted});showToast('סדר המוצרים עודכן');await renderProductsPage()}
          catch(e){move.disabled=false;showToast('לא ניתן לשנות סדר: '+e.message)}
        });
        reposition.appendChild(make('span','','מיקום בקטגוריה'));reposition.appendChild(position);reposition.appendChild(move);card.appendChild(reposition);
      }
      grid.appendChild(card);
    });
    parent.appendChild(grid);
    if(!list.length) parent.appendChild(make('p','admin-catalog-empty','לא נמצאו מוצרים מתאימים.'));
    var pager=make('div','admin-catalog-pager');
    pager.appendChild(catalogButton('הקודם','',function(){catalogPageNumber=Math.max(0,catalogPageNumber-1);parent.replaceChildren();renderCatalogGrid(parent)}));
    pager.appendChild(make('span','',(catalogPageNumber+1)+' / '+totalPages+' - '+list.length+' מוצרים'));
    pager.appendChild(catalogButton('הבא','',function(){catalogPageNumber=Math.min(totalPages-1,catalogPageNumber+1);parent.replaceChildren();renderCatalogGrid(parent)}));
    parent.appendChild(pager);
  }
  function renderCategoryVisibilitySection() {
    var section = make('details','admin-category-visibility');
    section.open = catalogCategoryManagerOpen;
    section.addEventListener('toggle', function(){catalogCategoryManagerOpen=section.open;});
    var heading=make('summary','admin-category-visibility__head');
    heading.appendChild(make('strong','','הצגה והסתרה של קטגוריות'));
    var hiddenCount=Object.keys(catalogHiddenCategories).filter(function(k){return catalogHiddenCategories[k] && !/^greeting-(mom|partner|daughter|sister)$/.test(k)}).length;
    heading.appendChild(make('span','admin-category-visibility__count',hiddenCount ? hiddenCount+' קטגוריות מוסתרות' : 'כל הקטגוריות מוצגות'));
    section.appendChild(heading);
    section.appendChild(make('p','admin-category-visibility__hint','אפשר להסתיר קטגוריה או תת־קטגוריה, בלי למחוק אף מוצר. לחיצה חוזרת על הצג תחזיר אותה לחנות.'));
    var grid=make('div','admin-category-visibility__grid');
    var parentLabels={greeting:'תכשיט עם ברכה',bracelets:'צמידים',watches:'שעונים',glasses:'משקפיים'};
    catalogCategories.filter(function(row){return [
      'greeting','greeting-mom','greeting-partner','greeting-daughter','greeting-sister',
      'necklaces','bracelets','bracelets-men','bracelets-women','bracelets-fashion',
      'rings','photo-bracelets','watches','watches-men','watches-women',
      'glasses','glasses-men','glasses-women','glasses-unisex','hats'
    ].indexOf(row[0])>=0;}).forEach(function(row){
      var key=row[0], parent=key.startsWith('bracelets-')?'bracelets':key.startsWith('watches-')?'watches':key.startsWith('glasses-')?'glasses':null;
      var isHidden=!!catalogHiddenCategories[key];
      var hiddenByParent=!!(parent && catalogHiddenCategories[parent]);
      var directlyHidden=!!catalogHiddenCategoryFlags[key];
      var label=parent?parentLabels[parent]+' / '+row[1]:row[1];
      var item=make('div','admin-category-visibility__item'+(isHidden?' is-hidden':''));
      var description=make('div','admin-category-visibility__details');
      description.appendChild(make('strong','',label));
      description.appendChild(make('span','admin-category-visibility__status',hiddenByParent?'מוסתר בגלל קטגוריית האב':isHidden?'מוסתר מהחנות':'מוצג בחנות'));
      var button=catalogButton(directlyHidden?'הצג':'הסתר',directlyHidden?'admin-catalog-unhide':'admin-catalog-quiet',async function(){
        if(hiddenByParent){showToast('יש להציג קודם את הקטגוריה הראשית: '+parentLabels[parent]);return;}
        var result=await adminConfirm({
          catalogVisibility:true,danger:!directlyHidden,icon:directlyHidden?'↺':'!',
          title:directlyHidden?'להחזיר את הקטגוריה לחנות?':'להסתיר את הקטגוריה מהחנות?',
          message:directlyHidden?'הקטגוריה "'+label+'" תוצג שוב בתפריטי החנות ובדף הקטגוריה.':'הקטגוריה "'+label+'" תוסתר מהחנות ומהתפריטים. המוצרים שלה יישמרו בקטלוג.',
          cancelText:'ביטול',confirmText:directlyHidden?'כן, הצג קטגוריה':'כן, הסתר קטגוריה'
        });
        if(!result)return;
        button.disabled=true;
        try{
          await apiAction('/api/admin/catalog/categories/visibility','POST',{category:key,hidden:!directlyHidden});
          showToast(directlyHidden?'הקטגוריה הוצגה בחנות':'הקטגוריה הוסתרה מהחנות');
          await renderProductsPage();
        }catch(e){button.disabled=false;showToast('לא ניתן לעדכן קטגוריה: '+(e.message||'שגיאה'));}
      });
      button.disabled=hiddenByParent;
      item.append(description,button);grid.appendChild(item);
    });
    section.appendChild(grid);
    return section;
  }
  async function renderCatalogSection() {
    var result = await api('/api/admin/catalog');
    catalogItemsCache=result.products||[];catalogPendingIds=result.pendingSheetIds||[];
    catalogCategoryOrders=result.categoryOrders||{};
    catalogHiddenCategories=result.categoryHidden||{};
    catalogHiddenCategoryFlags=result.categoryHiddenFlags||{};
    var wrap=make('section','admin-catalog-section');
    var head=make('div','admin-catalog-heading');
    var title=make('div');title.appendChild(make('h2','','ניהול קטלוג'));title.appendChild(make('p','',catalogItemsCache.length+' מוצרים בחנות · עריכה, הוספה ומחיקה עם עדכון מיידי באתר'));
    var buttons=make('div','admin-catalog-heading-actions');buttons.appendChild(catalogButton('+ הוסף מוצר','admin-catalog-primary',function(){openCatalogEditor(null)}));
    var sync=catalogButton('סנכרן לגיליון','',async function(){sync.disabled=true;try{var res=await apiAction('/api/admin/catalog/sync','POST',{});await renderProductsPage();if((res.pendingSheetIds||[]).length)alert('יש עדיין '+res.pendingSheetIds.length+' מוצרים הממתינים לסנכרון. יש לבדוק את הגדרת Webhook.');}catch(err){alert(err.message)}finally{sync.disabled=false}});
    buttons.appendChild(sync);head.append(title,buttons);wrap.appendChild(head);
    wrap.appendChild(renderCategoryVisibilitySection());
    var info=make('p','admin-catalog-hint', result.sheetConfigured?'שינויים נשמרים במסד הנתונים ונשלחים לגיליון "קישורי מוצרים".':'שינויים בחנות נשמרים. כדי לעדכן גם את Google Sheets, יש להגדיר GOOGLE_PRODUCTS_WEBHOOK_URL ו-GOOGLE_PRODUCTS_WEBHOOK_SECRET ב-Render.');wrap.appendChild(info);
    var search=make('input','admin-catalog-search');search.type='search';search.placeholder='חיפוש לפי שם מוצר, מזהה, מק"ט או קטגוריה';search.value=catalogSearchText;search.setAttribute('aria-label','חיפוש מוצרים');
    var gridHolder=make('div');
    var filters=make('div','admin-catalog-filter-row');
    var categoryFilter=make('select');categoryFilter.setAttribute('aria-label','סינון לפי קטגוריה');
    [['all','כל הקטגוריות']].concat(catalogCategories).forEach(function(row){var option=make('option','',row[1]);option.value=row[0];categoryFilter.appendChild(option)});
    categoryFilter.value=catalogSelectedCategory;
    var hiddenFilter=make('label','admin-catalog-hidden-filter');
    var hiddenBox=make('input');hiddenBox.type='checkbox';hiddenBox.checked=catalogShowHiddenOnly;hiddenFilter.appendChild(hiddenBox);hiddenFilter.appendChild(make('span','','רק מוסתרים'));
    var hint=make('p','admin-catalog-hint','בחר קטגוריה כדי לשנות את מיקום המוצרים בתוכה. מיקום 1 הוא הראשון בקטגוריה.');
    filters.append(categoryFilter,hiddenFilter);
    categoryFilter.addEventListener('change',function(){catalogSelectedCategory=categoryFilter.value;catalogPageNumber=0;gridHolder.replaceChildren();renderCatalogGrid(gridHolder)});
    hiddenBox.addEventListener('change',function(){catalogShowHiddenOnly=hiddenBox.checked;catalogPageNumber=0;gridHolder.replaceChildren();renderCatalogGrid(gridHolder)});
    search.addEventListener('input',function(){catalogSearchText=search.value;catalogPageNumber=0;gridHolder.replaceChildren();renderCatalogGrid(gridHolder)});
    wrap.appendChild(search);wrap.appendChild(filters);wrap.appendChild(hint);wrap.appendChild(gridHolder);renderCatalogGrid(gridHolder);
    return wrap;
  }

  async function renderProductsPage() {
    var range = state.ranges.products;
    var offset = state.offsets.products;
    var data = await api('/api/admin/products?range=' + encodeURIComponent(range) + '&limit=50&offset=' + offset);
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, rangeOptions, function (next) { state.ranges.products = next; state.offsets.products = 0; renderCurrentPage(); }));
    toolbar.appendChild(make('span', 'admin-toolbar-note', 'טבלת המכירות למטה מציגה רק מוצרים שנמכרו בטווח'));
    frag.appendChild(await renderCatalogSection());
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

  async function renderCreatorsPage() {
    var data=await api('/api/admin/creators');
    var frag=document.createDocumentFragment();
    var box=make('section','admin-card');
    var head=make('div','admin-card__head');
    var heading=make('div');heading.appendChild(make('h2','','יוצרי תוכן'));heading.appendChild(make('p','','בחר חשבון רשום והענק לו הרשאת contentcreator וקוד ייחודי. ניתן להגדיר גם קוד ללא הנחה (0%).'));
    head.appendChild(heading);box.appendChild(head);
    var body=make('div','admin-card__body');
    var form=make('form','admin-creators-form');
    function input(label,type,name,placeholder){var field=make('label','admin-creator-field'),caption=make('span','',label),control=make('input','');control.type=type;control.name=name;control.required=true;control.placeholder=placeholder;field.append(caption,control);form.appendChild(field);return control;}
    var email=input('כתובת אימייל של משתמש רשום','email','email','creator@example.com');
    var code=input('קוד יוצר (באנגלית)','text','code','VERSANS-AB');code.maxLength=20;code.pattern='[A-Za-z0-9][A-Za-z0-9-]{3,19}';code.autocapitalize='characters';
    var percent=input('הנחה ללקוח באחוזים (0-30)','number','percent','0');percent.min='0';percent.max='30';percent.step='1';percent.value='0';
    var commission=input('עמלת יוצר באחוזים מכל רכישה (0-100)','number','commissionPercent','0');commission.min='0';commission.max='100';commission.step='1';commission.value='0';
    var username=input('שם משתמש TikTok (חובה)','text','tiktokUsername','@username');username.maxLength=25;username.dir='ltr';username.autocapitalize='off';username.autocomplete='off';
    var viewRate=input('תשלום בשקלים לכל 1,000 צפיות (חובה)','number','viewRate','3.00');viewRate.min='0';viewRate.max='1000';viewRate.step='0.01';viewRate.value='3.00';
    var save=make('button','admin-small-button','שמירת יוצר תוכן');save.type='submit';form.appendChild(save);
    var hint=make('p','admin-table__muted','שם המשתמש בטיקטוק חייב להיות החשבון שמפרסם בפועל את הסרטונים. אימות מתבצע דרך Apify לפני שסרטון מתקבל לתשלום. התעריף לצפיות נשמר לכל יוצר, ושינוי שלו חל רק על בדיקות עתידיות. אחוז ההנחה הוא מה שהלקוח מקבל; אחוז העמלה הוא מה שהיוצר מרוויח מסכום רכישה ששולמה. שינוי עמלה משפיע על רכישות חדשות בלבד, ולא משנה עמלה מרכישות קודמות. ניתן לעדכן את האחוזים והקוד בכל זמן.');
    form.addEventListener('submit',async function(e){e.preventDefault();save.disabled=true;try{await apiAction('/api/admin/creators','POST',{email:email.value.trim(),code:code.value.trim().toUpperCase(),discountPercent:Number(percent.value),commissionPercent:Number(commission.value),tiktokUsername:username.value.trim(),viewRatePer1000Agorot:Math.round(Number(viewRate.value)*100)});showToast('קוד היוצר נשמר');await renderCurrentPage();}catch(err){var messages={user_not_found:'המשתמש לא רשום באתר. יש לבקש ממנו להירשם קודם.',creator_code_taken:'קוד היוצר הזה כבר תפוס.',coupon_code_taken:'הקוד הזה כבר משמש קופון.',invalid_creator_code:'הקוד חייב להכיל 4-20 תווים באנגלית, ספרות או מקף.',protected_role:'לא ניתן להמיר חשבון אדמין או צוות ליוצר תוכן.',invalid_commission_percent:'יש להגדיר אחוז עמלה שלם בין 0 ל-100.',invalid_tiktok_username:'יש לרשום שם משתמש TikTok תקין (ללא רווחים).',tiktok_username_taken:'שם המשתמש TikTok הזה משויך כבר ליוצר אחר.',invalid_view_rate:'יש להגדיר מחיר בין 0 ל־1,000 ₪ לכל 1,000 צפיות.',owner_only:'רק בעל החנות יכול לשנות הגדרות יוצר.'};alert(messages[err.code]||err.message||'השמירה נכשלה');save.disabled=false;}});
    body.append(form,hint);box.appendChild(body);frag.appendChild(box);
    var users=(data.creators||[]).filter(function(item){return item.role==='contentcreator'&&item.active});
    var table=renderTable({title:'יוצרי תוכן פעילים',subtitle:'מספר הרכישות מבוסס על הזמנות ששולמו בלבד',rows:users,emptyText:'עדיין לא נוצרו קודי יוצר.',columns:[
      {label:'יוצר',render:function(row){return cellPrimary(row.name,row.email)}},
      {label:'קוד יוצר',render:function(row){return make('strong','admin-table__mono',row.code)}},
      {label:'הנחה ללקוח',render:function(row){return Number(row.discountPercent)+'%'}},
      {label:'עמלת יוצר',render:function(row){return Number(row.commissionPercent||0)+'%'}},
      {label:'TikTok',render:function(row){return row.tiktokUsername?'@'+row.tiktokUsername:'חסר - יש להגדיר'}},
      {label:'₪ / 1,000 צפיות',render:function(row){return row.viewRatePer1000Agorot==null?'לא הוגדר':(Number(row.viewRatePer1000Agorot)/100).toFixed(2)+' ₪'}},
      {label:'עמלות שנצברו',render:function(row){return moneyAgorot(Number(row.commissionAgorot||0))}},
      {label:'רכישות',render:function(row){return numberFmt(row.sales)}},
      {label:'פעולות',render:function(row){var wrap=make('div','admin-creators-actions');var edit=make('button','admin-small-button','ערוך');edit.type='button';edit.addEventListener('click',function(){email.value=row.email;code.value=row.code;percent.value=Number(row.discountPercent);commission.value=Number(row.commissionPercent||0);username.value=row.tiktokUsername?'@'+row.tiktokUsername:'';viewRate.value=row.viewRatePer1000Agorot==null?'3.00':(Number(row.viewRatePer1000Agorot)/100).toFixed(2);email.scrollIntoView({behavior:'smooth',block:'center'});code.focus();});var revoke=make('button','admin-small-button admin-small-button--danger','בטל הרשאה');revoke.type='button';revoke.addEventListener('click',async function(){if(!window.confirm('לבטל את הרשאת יוצר התוכן של '+row.name+'? קוד היוצר יפסיק לפעול, אך המכירות ההיסטוריות יישמרו.'))return;revoke.disabled=true;try{await apiAction('/api/admin/creators/'+row.id+'/revoke','POST',{});showToast('ההרשאה בוטלה');await renderCurrentPage();}catch(err){alert('לא ניתן לבטל הרשאה');revoke.disabled=false;}});wrap.append(edit,revoke);return wrap;}}
    ]});frag.appendChild(table);
    await renderCreatorVideosAdmin(frag);
    content.replaceChildren(frag);
  }

  // TikTok moderation must preserve 403 validation errors rather than treating
  // every 403 as a logout. This endpoint is owner-only, but a valid owner can
  // also receive video_not_owned_by_creator or an Apify validation error.
  async function creatorVideoActionRequest(id, action) {
    var response = await fetch('/api/admin/creator-videos/' + encodeURIComponent(id) + '/action', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({action: action})
    });
    var payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    if (response.status === 401 || (response.status === 403 && payload && ['owner_only','admin_required','permission_denied'].includes(payload.error))) {
      window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
    }
    if (!response.ok || !payload || payload.ok !== true) {
      var errorCode = payload && (payload.error || payload.message) || 'request_failed_' + response.status;
      var error = new Error(errorCode);
      error.code = errorCode;
      throw error;
    }
    return payload;
  }
  function creatorVideoActionError(error) {
    var code = String(error && (error.code || error.message) || 'unknown');
    var errors = {
      video_not_owned_by_creator: 'אי אפשר לאשר: הסרטון לא שייך לחשבון TikTok שהוגדר ליוצר.',
      creator_tiktok_profile_required: 'יש להגדיר שם משתמש TikTok ותעריף צפיות ליוצר לפני האישור.',
      video_not_found: 'הסרטון לא נמצא. רענן את הדף ונסה שוב.',
      invalid_video_status: 'מצב הסרטון השתנה. רענן את הדף ונסה שוב.',
      invalid_video_action: 'הפעולה המבוקשת אינה זמינה למצב הסרטון.',
      creator_not_active: 'חשבון היוצר אינו פעיל.',
      apify_not_configured: 'חסר APIFY_API_TOKEN בשרת. יש להגדיר אותו ב־Render.',
      apify_unavailable: 'Apify אינו זמין כרגע. נסה שוב מאוחר יותר.',
      apify_timeout: 'הבדיקה מול Apify נמשכה יותר מדי זמן. נסה שוב מאוחר יותר.',
      apify_video_not_found: 'Apify לא מצא את הסרטון. ודא שהוא ציבורי.',
      apify_author_missing: 'Apify לא החזיר את שם מפרסם הסרטון.',
      apify_views_missing: 'Apify לא החזיר מספר צפיות תקין.',
      origin_not_allowed: 'בקשת האישור נחסמה. נסה לרענן את הדף.',
      owner_only: 'רק בעל החנות יכול לאשר סרטוני יוצרים.',
      admin_required: 'צריך להתחבר מחדש לחשבון האדמין.'
    };
    if (errors[code]) return errors[code];
    if (code.indexOf('apify_http_') === 0) return 'Apify החזיר שגיאה (' + code.slice(11) + '). נסה שוב או בדוק את החשבון.';
    if (code.indexOf('request_failed_') === 0) return 'בקשת האישור נכשלה (HTTP ' + code.slice(15) + '). נסה שוב.';
    return 'האישור לא נשמר: ' + code;
  }

  async function renderCreatorVideosAdmin(frag){
    var response;
    try {response=await api('/api/admin/creator-videos');}catch(_){return;}
    var section=make('section','admin-card');
    var head=make('div','admin-card__head');var h=make('div');h.appendChild(make('h2','','סרטוני TikTok - תגמול צפיות'));
    h.appendChild(make('p','','היוצר שולח קישור, והמערכת מוודאת מול Apify שהסרטון שייך לחשבון TikTok שהוגדר ליוצר. התעריף נקבע ביצירת היוצר. מעקב יומי ב־23:59 שעון ישראל.'));
    head.appendChild(h);section.appendChild(head);
    var area=make('div','admin-card__body');
    if(!response.configured)area.appendChild(make('p','admin-table__muted','כדי להפעיל מדידות הוסף APIFY_API_TOKEN ב־Render.'));
    if(response.latestRun){var run=response.latestRun;area.appendChild(make('p','admin-table__muted','בדיקה אחרונה: '+run.scheduled_day+' | '+({done:'הושלמה',partial:'חלקית',failed:'נכשלה',running:'בתהליך'})[run.status]+' | '+(run.details||'')));}
    if(!(response.videos||[]).length){area.appendChild(make('p','admin-table__muted','עדיין לא נשלחו סרטונים.'));section.appendChild(area);frag.appendChild(section);return;}
    var tableWrap=make('div','admin-video-wrap'),table=make('table','admin-video-table');
    var thead=make('thead'),heading=make('tr');['יוצר','סרטון','צפיות אחרונות','מצב','₪ / 1000 צפיות','פעולות'].forEach(function(x){heading.appendChild(make('th','',x));});thead.appendChild(heading);table.appendChild(thead);
    var tbody=make('tbody');
    (response.videos||[]).forEach(function(v){
      var tr=make('tr', v.status === 'active' ? 'admin-video-row--approved' : '');tr.appendChild(make('td','',v.creator+' ('+v.email+')'+(v.tiktokUsername?' · @'+v.tiktokUsername:' · TikTok לא הוגדר')));
      var linktd=make('td'),a=make('a','', 'פתיחת סרטון ↗');a.href=v.url;a.target='_blank';a.rel='noopener noreferrer';linktd.appendChild(a);tr.appendChild(linktd);
      tr.appendChild(make('td','',v.views==null?'—':numberFmt(v.views)));
      tr.appendChild(make('td','',({pending:'ממתין לאישור',active:'פעיל',paused:'מושהה',rejected:'נדחה'})[v.status]||v.status));
      tr.appendChild(make('td','',(Number(v.ratePer1000Agorot)/100).toFixed(2)+' ₪'));
      var actions=make('td'),buttons=make('div','admin-creators-actions');
      async function run(action){
        if(buttons.dataset.busy === '1') return;
        var isApproval = action === 'approve';
        var labels = {
          approve: {title: v.status === 'paused' ? 'חידוש מדידת צפיות' : 'אישור סרטון TikTok',
            message: v.status === 'paused' ? 'לחדש את מדידת הסרטון והתגמול על צפיות חדשות? צפיות שנצברו בזמן ההשהיה לא יזוכו.' : 'יש לאשר רק סרטון שהיוצר פרסם עבור קמפיין Versans. הצפיות מהפרסום ועד המדידה הראשונה יהיו זכאיות לתגמול לאחר אימות בעלות.',
            confirmText: v.status === 'paused' ? 'חדש מדידה' : 'אשר והפעל'},
          reject: {title:'דחיית סרטון TikTok',message:'לדחות את הסרטון? לא יצטבר עליו תגמול צפיות.',confirmText:'דחה סרטון'},
          pause: {title:'השהיית מדידת צפיות',message:'להשהות את המעקב והתשלום על צפיות חדשות בסרטון הזה?',confirmText:'השהה מדידה'}
        };
        var copy = labels[action];
        if(!copy) return;
        var confirmed = await adminConfirm({
          creatorVideo:true, icon:isApproval?'✓':'!', eyebrow:'VERSANS CREATORS',
          title:copy.title, message:copy.message,
          cancelText:'ביטול', confirmText:copy.confirmText, danger:action==='reject'
        });
        if(!confirmed) return;
        buttons.dataset.busy='1';
        var actionButtons=Array.from(buttons.querySelectorAll('button'));
        actionButtons.forEach(function(button){button.disabled=true;});
        var feedback=make('div','admin-creator-video-feedback is-loading',isApproval?'מאמת את הסרטון ושומר אישור…':'שומר את השינוי…');
        feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
        actions.appendChild(feedback);
        try {
          await creatorVideoActionRequest(v.id,action);
          feedback.className='admin-creator-video-feedback is-success';
          feedback.textContent=isApproval?'הסרטון אושר והמעקב הופעל בהצלחה.':'הפעולה נשמרה בהצלחה.';
          showToast(feedback.textContent);
          // Approval has been persisted: a refresh failure must not be reported as a failed approval.
          await renderCurrentPage();
        } catch(err) {
          feedback.className='admin-creator-video-feedback is-error';
          feedback.textContent=creatorVideoActionError(err);
          actionButtons.forEach(function(button){button.disabled=false;});
        } finally {
          delete buttons.dataset.busy;
        }
      }
      function btn(label,action){var b=make('button','admin-small-button',label);b.type='button';b.addEventListener('click',function(){run(action)});buttons.appendChild(b);}
      if(v.status==='pending'){btn('אשר והפעל','approve');btn('דחה','reject');}
      if(v.status==='active')btn('השהה','pause');
      if(v.status==='paused')btn('חדש מדידה','approve');
      actions.appendChild(buttons);tr.appendChild(actions);tbody.appendChild(tr);
    });table.appendChild(tbody);tableWrap.appendChild(table);area.appendChild(tableWrap);section.appendChild(area);frag.appendChild(section);
  }

  function adminRoleManager() {
    var section=make('section','admin-catalog-section admin-role-section');
    section.appendChild(make('h2','','ניהול הרשאות אדמין'));
    section.appendChild(make('p','admin-catalog-hint','אפשר להעניק או לבטל אדמין למשתמש רשום לפי המייל שלו. רק בעל החנות יכול לשנות הרשאות.'));
    var form=make('form','admin-role-form');
    var email=make('input');email.type='email';email.required=true;email.placeholder='מייל המשתמש הרשום';email.setAttribute('aria-label','כתובת המייל של המשתמש');
    var grant=make('button','admin-catalog-btn admin-catalog-primary','הענק אדמין');grant.type='submit';
    var revoke=make('button','admin-catalog-btn','בטל אדמין');revoke.type='button';
    var status=make('p','admin-catalog-status');status.setAttribute('role','status');
    async function updateRole(role){
      if(!email.reportValidity())return;
      var action=role==='admin'?'לתת':'לבטל';
      if(!window.confirm(action+' הרשאת אדמין ל-'+email.value.trim()+'?'))return;
      grant.disabled=true;revoke.disabled=true;
      try{
        var updated=await apiAction('/api/admin/access/role','POST',{email:email.value.trim(),role:role});
        status.textContent='ההרשאה עודכנה בהצלחה עבור '+updated.user.email;
        showToast('הרשאות המשתמש עודכנו');
      }catch(e){status.textContent=e.code==='registered_user_not_found'?'המשתמש עדיין לא רשום באתר':'עדכון הרשאה נכשל: '+e.message}
      finally{grant.disabled=false;revoke.disabled=false}
    }
    form.addEventListener('submit',function(e){e.preventDefault();updateRole('admin')});
    revoke.addEventListener('click',function(){updateRole('customer')});
    form.append(email,grant,revoke);section.append(form,status);return section;
  }
  async function renderCustomersPage() {
    var access=await api('/api/admin/access/me');
    var isOwner=access.isOwner===true;
    var offset = state.offsets.customers;
    var data = await api('/api/admin/customers?limit=50&offset=' + offset);
    var paying = (data.customers || []).filter(function (customer) { return customer.paidOrderCount > 0; }).length;
    var spendOnPage = (data.customers || []).reduce(function (sum, customer) { return sum + Number(customer.paidSpendAgorot || 0); }, 0);
    var frag = document.createDocumentFragment();
    if(isOwner)frag.appendChild(adminRoleManager());
    frag.appendChild(renderKpis([
      { label: 'משתמשים רשומים', value: numberFmt(data.count), hint: 'סה״כ חשבונות', primary: true },
      { label: 'לקוחות משלמים בעמוד', value: numberFmt(paying), hint: 'לפחות הזמנת Paid אחת' },
      { label: 'Paid spend בעמוד', value: moneyAgorot(spendOnPage), hint: 'סכום הוצאות המשתמשים המוצגים' }
    ]));
    var table = renderTable({
      title: 'לקוחות ומשתמשים',
      subtitle: 'ממוינים לפי סכום הוצאות Paid · ניתן לחסום או לבטל חסימה ישירות מהאדמין',
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
        { label: 'לקוח מאומת', render: function (row) { return row.verifiedCustomer ? badge('מאומת', 'verified') : badge('לא', 'neutral'); } },
        { label: 'גישה', render: function (row) { var wrap=make('div');wrap.appendChild(row.blocked ? badge('חסום','failed'):badge('פעיל','verified'));if(row.role==='admin')wrap.appendChild(badge('אדמין','verified'));return wrap; } },
        { label: 'פעולות', render: function (row) {
          var wrap = make('div');
          wrap.style.display = 'flex';
          wrap.style.gap = '6px';
          wrap.style.alignItems = 'center';
          var button = make('button', 'admin-small-button' + (row.blocked ? '' : ' admin-small-button--danger'), row.blocked ? 'בטל חסימה' : 'חסום');
          button.type = 'button';
          button.addEventListener('click', async function () {
            var nextBlocked = !row.blocked;
            var reason = row.blocked ? '' : window.prompt('סיבת חסימה (אופציונלי):', '');
            if (!row.blocked && reason === null) return;
            var question = nextBlocked
              ? 'לחסום את ' + (row.name || row.email || 'המשתמש') + '? המשתמש ינותק ולא יוכל להתחבר עד ביטול החסימה.'
              : 'לבטל את החסימה של ' + (row.name || row.email || 'המשתמש') + '?';
            if (!window.confirm(question)) return;
            button.disabled = true;
            try {
              await apiAction('/api/admin/customers/' + encodeURIComponent(row.id) + '/access', 'POST', {
                role: row.role || 'customer',
                blocked: nextBlocked,
                reason: reason || ''
              });
              showToast(nextBlocked ? 'המשתמש נחסם' : 'החסימה בוטלה');
              await renderCurrentPage();
            } catch (error) {
              button.disabled = false;
              showToast(error && error.code === 'cannot_block_self' ? 'אי אפשר לחסום את חשבון האדמין שמחובר כרגע' : 'לא ניתן לעדכן את הגישה למשתמש');
            }
          });
          wrap.appendChild(button);
          if(isOwner && row.email){
            var accessBtn=make('button','admin-small-button',row.role==='admin'?'הסר אדמין':'תן אדמין');
            accessBtn.type='button';
            accessBtn.addEventListener('click',async function(){
              var role=row.role==='admin'?'customer':'admin';
              if(!window.confirm('לשנות הרשאה עבור '+row.email+'?'))return;
              accessBtn.disabled=true;
              try{await apiAction('/api/admin/access/role','POST',{email:row.email,role:role});showToast('ההרשאה עודכנה');await renderCurrentPage()}
              catch(e){accessBtn.disabled=false;showToast('לא ניתן לשנות הרשאה: '+e.message)}
            });
            wrap.appendChild(accessBtn);
          }
          return wrap;
        } }
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
    var reviews = data.recent || [];
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, rangeOptions, function (next) { state.ranges.reviews = next; renderCurrentPage(); }));
    frag.appendChild(toolbar);
    frag.appendChild(renderKpis([
      { label: 'ביקורות', value: numberFmt(summary.count), hint: 'Published בטווח', primary: true },
      { label: 'דירוג ממוצע', value: Number(summary.average || 0).toFixed(2), hint: 'מתוך 5' },
      { label: '5 כוכבים', value: numberFmt(summary.rating5), hint: 'ביקורות מצוינות', tone: 'green' },
      { label: '1-2 כוכבים', value: numberFmt(Number(summary.rating1 || 0) + Number(summary.rating2 || 0)), hint: 'דורש תשומת לב', tone: 'amber' }
    ]));
    var grid = make('div', 'admin-grid-even');
    grid.appendChild(card('חלוקת דירוגים', '1-5 כוכבים', ratingDistribution(summary)));
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

    var selected = new Set();
    var checkboxEntries = [];
    var actions = make('div');
    actions.style.display = 'flex';
    actions.style.gap = '7px';
    actions.style.alignItems = 'center';
    actions.style.flexWrap = 'wrap';
    var selectAllButton = make('button', 'admin-small-button', 'בחר הכל');
    selectAllButton.type = 'button';
    var deleteSelectedButton = make('button', 'admin-small-button admin-small-button--danger', 'מחק מסומנות');
    deleteSelectedButton.type = 'button';
    deleteSelectedButton.disabled = true;
    actions.append(selectAllButton, deleteSelectedButton);

    function syncSelectionUi() {
      deleteSelectedButton.disabled = selected.size === 0;
      deleteSelectedButton.textContent = selected.size ? 'מחק מסומנות (' + numberFmt(selected.size) + ')' : 'מחק מסומנות';
      selectAllButton.textContent = reviews.length && selected.size === reviews.length ? 'בטל בחירה' : 'בחר הכל';
    }

    selectAllButton.addEventListener('click', function () {
      var shouldSelect = selected.size !== reviews.length;
      selected.clear();
      checkboxEntries.forEach(function (entry) {
        entry.input.checked = shouldSelect;
        if (shouldSelect) selected.add(entry.id);
      });
      syncSelectionUi();
    });

    deleteSelectedButton.addEventListener('click', async function () {
      var ids = Array.from(selected);
      if (!ids.length) return;
      var approved = await adminConfirm({
        title: ids.length === 1 ? 'מחיקת ביקורת' : 'מחיקת ביקורות',
        message: ids.length === 1
          ? 'הביקורת שסימנת תימחק לצמיתות ולא יהיה ניתן לשחזר אותה.'
          : numberFmt(ids.length) + ' הביקורות שסימנת יימחקו לצמיתות ולא יהיה ניתן לשחזר אותן.',
        confirmText: ids.length === 1 ? 'מחק ביקורת' : 'מחק ' + numberFmt(ids.length) + ' ביקורות',
        cancelText: 'ביטול',
        danger: true
      });
      if (!approved) return;
      deleteSelectedButton.disabled = true;
      selectAllButton.disabled = true;
      try {
        for (var i = 0; i < ids.length; i += 1) {
          await apiAction('/api/admin/reviews/' + encodeURIComponent(ids[i]), 'DELETE');
        }
        showToast(ids.length === 1 ? 'הביקורת נמחקה' : numberFmt(ids.length) + ' ביקורות נמחקו');
        await renderCurrentPage();
      } catch (error) {
        deleteSelectedButton.disabled = false;
        selectAllButton.disabled = false;
        showToast('לא ניתן למחוק את כל הביקורות שסומנו');
      }
    });

    var reviewsTable = renderTable({
      title: 'ביקורות אחרונות',
      subtitle: 'עד 20 ביקורות אחרונות בטווח · אפשר למחוק ביקורת אחת או כמה ביקורות יחד',
      action: actions,
      rows: reviews,
      emptyText: 'אין ביקורות בטווח שנבחר.',
      columns: [
        { label: 'סימון', render: function (row) {
          var input = document.createElement('input');
          input.type = 'checkbox';
          input.setAttribute('aria-label', 'סימון ביקורת #' + row.id);
          input.addEventListener('change', function () {
            if (input.checked) selected.add(Number(row.id));
            else selected.delete(Number(row.id));
            syncSelectionUi();
          });
          checkboxEntries.push({ id: Number(row.id), input: input });
          return input;
        } },
        { label: 'לקוח', render: function (row) { return cellPrimary(row.name, row.email || ''); } },
        { label: 'מוצר', render: function (row) { return productCell({ id: row.productId, name: row.productName, image: row.productImage, href: row.productHref }); } },
        { label: 'דירוג', render: function (row) { return stars(row.rating); } },
        { label: 'ביקורת', render: function (row) { return make('span', 'admin-review-body', text(row.body)); } },
        { label: 'רכישה', render: function (row) { return row.verifiedPurchase ? badge('מאומתת', 'verified') : badge('לא מאומתת', 'neutral'); } },
        { label: 'תאריך', render: function (row) { return dateTime(row.reviewDate); } },
        { label: 'פעולות', render: function (row) {
          var button = make('button', 'admin-small-button admin-small-button--danger', 'מחק');
          button.type = 'button';
          button.addEventListener('click', async function () {
            var approved = await adminConfirm({
              title: 'מחיקת ביקורת',
              message: 'למחוק את הביקורת של ' + (row.name || 'לקוח') + '? הביקורת תימחק לצמיתות.',
              confirmText: 'מחק ביקורת',
              cancelText: 'ביטול',
              danger: true
            });
            if (!approved) return;
            button.disabled = true;
            try {
              await apiAction('/api/admin/reviews/' + encodeURIComponent(row.id), 'DELETE');
              showToast('הביקורת נמחקה');
              await renderCurrentPage();
            } catch (error) {
              button.disabled = false;
              showToast('לא ניתן למחוק את הביקורת');
            }
          });
          return button;
        } }
      ]
    });
    frag.appendChild(reviewsTable);
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
      else if (state.page === 'creators') await renderCreatorsPage();
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
