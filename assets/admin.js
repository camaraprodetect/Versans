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

  var pageMeta = {
    dashboard: ['Dashboard', 'תמונה מהירה של המכירות, המבקרים והלקוחות של VerSans'],
    visitors: ['מבקרים', 'מי נמצא באתר, מי ביקר בעבר ואיך הוא השתמש באתר'],
    sales: ['מכירות', 'נתוני הכנסות ומוצרים על בסיס הזמנות ששולמו בלבד'],
    orders: ['הזמנות', 'הזמנות, חבילות ומספרי מעקב של VerSans'],
    products: ['מוצרים', 'ביצועי המוצרים לפי מכירות ששולמו'],
    customers: ['לקוחות', 'משתמשים רשומים, רכישות והוצאות מצטברות'],
    traffic: ['תנועה לאתר', 'עמודים, מקורות הגעה, מכשירים ודפדפנים'],
    reviews: ['ביקורות', 'דירוגים, מוצרים מובילים וביקורות אחרונות']
  };

  var rangeOptions = [
    { value: 'today', label: 'היום' },
    { value: '7d', label: '7 ימים' },
    { value: '30d', label: '30 ימים' },
    { value: 'all', label: 'כל הזמנים' }
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
    ranges: { dashboard: '30d', sales: '30d', orders: '30d', products: '30d', traffic: '30d', reviews: '30d', visitors: 'online' },
    ordersStatus: 'paid',
    offsets: { visitors: 0, orders: 0, products: 0, customers: 0 },
    selectedVisitorId: null,
    requestVersion: 0
  };

  function currentPage() {
    var path = window.location.pathname.replace(/\/+$/, '');
    if (path === '/admin' || path === '/admin.html' || path === '/admin/dashboard') return 'dashboard';
    var match = /^\/admin\/(visitors|sales|orders|products|customers|traffic|reviews)$/.exec(path);
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
      window.location.href = '/login';
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
      window.location.href = '/login';
      throw new Error('admin_required');
    }
    var payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    if (!response.ok) {
      var err = new Error(payload && (payload.message || payload.error) ? (payload.message || payload.error) : 'request_failed_' + response.status);
      err.code = payload && payload.error;
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

  function renderSalesChart(dailySales) {
    var wrap = make('div');
    var rows = Array.isArray(dailySales) ? dailySales : [];
    if (!rows.length) {
      wrap.appendChild(make('div', 'admin-chart-empty', 'אין מכירות ששולמו בטווח שנבחר.'));
      return wrap;
    }
    var max = Math.max.apply(null, rows.map(function (row) { return Number(row.revenueAgorot || 0); }).concat([1]));
    var chart = make('div', 'admin-chart');
    rows.forEach(function (row) {
      var bar = make('div', 'admin-chart__bar');
      var ratio = Number(row.revenueAgorot || 0) / max;
      bar.style.height = Math.max(3, Math.round(ratio * 100)) + '%';
      bar.title = row.date + ' · ' + moneyAgorot(row.revenueAgorot) + ' · ' + numberFmt(row.orders) + ' הזמנות';
      bar.appendChild(make('span', '', moneyAgorot(row.revenueAgorot)));
      chart.appendChild(bar);
    });
    wrap.appendChild(chart);
    var axis = make('div', 'admin-chart-axis');
    axis.appendChild(make('span', '', rows[0].date));
    if (rows.length > 2) axis.appendChild(make('span', '', rows[Math.floor(rows.length / 2)].date));
    axis.appendChild(make('span', '', rows[rows.length - 1].date));
    wrap.appendChild(axis);
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
      tracking_registration_failed: '17TRACK לא קיבל את מספר המעקב. בדוק את המספר או את קוד חברת השילוח.'
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
      main.appendChild(make('strong', '', text(event.description, text(event.stage, 'עדכון מחברת השילוח'))));
      var meta = [];
      if (event.location) meta.push(event.location);
      if (event.provider) meta.push(event.provider);
      if (event.subStatus) meta.push(event.subStatus);
      if (meta.length) main.appendChild(make('small', 'admin-table__muted', meta.join(' · ')));
      row.appendChild(main);
      row.appendChild(make('time', 'admin-tracking-history__time', event.time ? dateTime(event.time) : 'ללא זמן'));
      return row;
    }

    async function load() {
      try {
        var data = await api('/api/admin/orders/' + encodeURIComponent(order.orderRef) + '/shipments');
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
        customerPreview.appendChild(make('small', 'admin-table__muted', 'לכל מוצר בהזמנה יש מספר VerSans נפרד. את ה-Tracking ID מ-AliExpress מחברים ישירות למוצר המתאים.'));
        panel.appendChild(customerPreview);

        var config = make('div', 'admin-shipping-config');
        config.append(configPill(data.trackingConfigured, '17TRACK'), configPill(data.customerWhatsAppConfigured, 'WhatsApp לקוח'), configPill(data.adminWhatsAppConfigured, 'WhatsApp מנהל'));
        panel.appendChild(config);
        if (!data.trackingConfigured || !data.customerWhatsAppConfigured || !data.adminWhatsAppConfigured) {
          var note = make('div', 'admin-shipping-note');
          note.textContent = '17TRACK יכול לעבוד כבר עכשיו. WhatsApp יופעל אוטומטית אחרי שנוסיף את מספר VerSans והמשתנים של Meta ב-Render.';
          panel.appendChild(note);
        }

        var productsSection = make('div', 'admin-shipping-section');
        productsSection.appendChild(make('h3', '', 'מעקב לפי מוצר'));
        productsSection.appendChild(make('p', 'admin-order-shipping-help', 'לכל מוצר נוצר מספר הזמנה נפרד של VerSans. כשהספק נותן Tracking ID / מספר מעקב, מדביקים אותו בכרטיס של אותו מוצר בלבד.'));

        var productTrackingList = make('div', 'admin-product-tracking-list');
        (data.items || []).forEach(function (item) {
          var shipment = item.shipment || null;
          var card = make('section', 'admin-product-tracking-card' + (shipment ? ' has-tracking' : ''));

          var itemHead = make('div', 'admin-product-tracking-card__head');
          var productMeta = make('div', 'admin-product-tracking-card__product');
          if (item.productImage) {
            var img = document.createElement('img');
            img.src = item.productImage; img.alt = ''; img.loading = 'lazy';
            productMeta.appendChild(img);
          }
          var productCopy = make('div');
          productCopy.appendChild(make('strong', '', text(item.productName, item.productId)));
          productCopy.appendChild(make('small', 'admin-table__muted', 'כמות ' + numberFmt(item.qty || 1)));
          productMeta.appendChild(productCopy);
          var itemRef = make('div', 'admin-product-order-ref');
          itemRef.appendChild(make('span', '', 'מספר הזמנה VerSans'));
          itemRef.appendChild(make('strong', 'admin-table__mono', item.itemOrderRef));
          itemHead.append(productMeta, itemRef); card.appendChild(itemHead);

          if (shipment) {
            var row = make('div', 'admin-product-tracking-live');
            var top = make('div', 'admin-tracking-row__top');
            var meta = make('div', 'admin-tracking-row__meta');
            meta.appendChild(make('small', 'admin-table__muted', 'Tracking ID / מספר מעקב מהספק'));
            meta.appendChild(make('strong', 'admin-table__strong admin-table__mono', shipment.trackingNumber));
            meta.appendChild(make('span', 'admin-tracking-row__carrier', text(shipment.carrierName, 'זיהוי אוטומטי')));

            var actions = make('div', 'admin-shipment-actions');
            var refresh = make('button', 'admin-small-button', 'רענון מעקב'); refresh.type = 'button'; refresh.disabled = !data.trackingConfigured;
            refresh.addEventListener('click', async function () {
              refresh.disabled = true;
              try { await apiAction('/api/admin/shipments/' + shipment.id + '/refresh', 'POST'); showToast('המעקב עודכן'); await load(); }
              catch (e) { showToast(shippingErrorMessage(e)); refresh.disabled = false; }
            });
            var remove = make('button', 'admin-small-button admin-small-button--danger', 'ניתוק'); remove.type = 'button';
            remove.addEventListener('click', async function () {
              if (!window.confirm('לנתק את ה-Tracking ID מהמוצר ' + text(item.productName, '') + '?')) return;
              remove.disabled = true;
              try { await apiAction('/api/admin/orders/' + encodeURIComponent(order.orderRef) + '/shipment-items/' + item.itemIndex, 'DELETE'); showToast('ה-Tracking ID נותק מהמוצר'); await load(); }
              catch (e) { showToast(shippingErrorMessage(e)); remove.disabled = false; }
            });
            actions.append(refresh, remove); top.append(meta, actions); row.appendChild(top);

            var statusLine = make('div', 'admin-tracking-status-line');
            statusLine.appendChild(make('strong', '', shipment.statusLabel));
            statusLine.appendChild(make('span', '', shipment.latestLocation ? 'מיקום אחרון: ' + shipment.latestLocation : 'מיקום אחרון טרם התקבל'));
            row.appendChild(statusLine);

            var progress = make('div', 'admin-tracking-progress');
            var progressFill = make('span'); progressFill.style.width = shipmentProgressValue(shipment.status) + '%'; progress.appendChild(progressFill); row.appendChild(progress);

            var details = make('div', 'admin-tracking-details');
            var sourceLabel = text(shipment.trackingSourceLabel, '17TRACK');
            var providerBox = make('div'); providerBox.appendChild(make('span', '', 'סטטוס ' + sourceLabel)); providerBox.appendChild(make('strong', '', text(shipment.providerStatus, shipment.statusLabel)));
            if (shipment.subStatus) providerBox.appendChild(make('small', 'admin-table__muted admin-table__mono', shipment.subStatus));
            var locationBox = make('div'); locationBox.appendChild(make('span', '', 'אירוע אחרון')); locationBox.appendChild(make('strong', '', text(shipment.latestEvent, sourceLabel + ' עדיין לא החזיר אירוע מפורט')));
            var updatedBox = make('div'); updatedBox.appendChild(make('span', '', 'עדכון אחרון')); updatedBox.appendChild(make('strong', '', shipment.latestEventAt ? dateTime(shipment.latestEventAt) : 'ממתין לעדכון'));
            var etaBox = make('div'); etaBox.appendChild(make('span', '', 'הערכת מסירה')); etaBox.appendChild(make('strong', '', shipmentEtaLabel(shipment.estimatedDeliveryFrom, shipment.estimatedDeliveryTo)));
            var syncBox = make('div'); syncBox.appendChild(make('span', '', 'סנכרון')); syncBox.appendChild(make('strong', '', text(shipment.syncStatus, shipment.registeredAt ? 'מחובר ל-17TRACK' : 'ממתין לרישום')));
            details.append(providerBox, locationBox, updatedBox, etaBox, syncBox); row.appendChild(details);

            if (Array.isArray(shipment.providerTips) && shipment.providerTips.length) {
              var tips = make('div', 'admin-shipping-note');
              tips.appendChild(make('strong', '', 'הודעת חברת השילוח'));
              shipment.providerTips.forEach(function (tip) { tips.appendChild(make('div', '', text(tip))); });
              row.appendChild(tips);
            }

            var history = Array.isArray(shipment.history) ? shipment.history : [];
            var historyWrap = make('div', 'admin-tracking-history');
            historyWrap.appendChild(make('strong', 'admin-tracking-history__title', 'היסטוריית Tracking אמיתית · ' + sourceLabel));
            if (!history.length) historyWrap.appendChild(make('span', 'admin-table__muted', 'עדיין לא התקבלו אירועים ממקור המעקב.'));
            else history.slice(0, 20).forEach(function (event) { historyWrap.appendChild(eventLine(event)); });
            row.appendChild(historyWrap);
            card.appendChild(row);
          } else {
            var waiting = make('div', 'admin-product-tracking-waiting');
            waiting.appendChild(make('strong', '', 'ההזמנה בהכנה'));
            waiting.appendChild(make('span', 'admin-table__muted', 'עדיין לא הוזן Tracking ID עבור המוצר הזה.'));
            card.appendChild(waiting);
          }

          var form = make('form', 'admin-product-tracking-form');
          var trackingLabel = make('label');
          trackingLabel.appendChild(make('span', '', 'Tracking ID / מספר מעקב מ-AliExpress'));
          var tracking = document.createElement('input');
          tracking.name = 'tracking'; tracking.placeholder = 'הדביקו כאן את מספר המעקב'; tracking.autocomplete = 'off'; tracking.required = true;
          if (shipment && shipment.trackingNumber) tracking.value = shipment.trackingNumber;
          trackingLabel.appendChild(tracking);
          var submit = make('button', 'admin-shipment-submit', shipment ? 'שמור / החלף Tracking ID' : 'חבר Tracking ID למוצר'); submit.type = 'submit';
          var formError = make('div', 'admin-shipment-form-error'); formError.hidden = true;
          form.append(trackingLabel, submit, formError);
          form.addEventListener('submit', async function (event) {
            event.preventDefault(); formError.hidden = true; submit.disabled = true; var oldText = submit.textContent; submit.textContent = 'שומר…';
            try {
              var created = await apiAction('/api/admin/orders/' + encodeURIComponent(order.orderRef) + '/shipments', 'POST', {
                itemIndex: item.itemIndex,
                trackingNumber: tracking.value.trim()
              });
              if (created.warning && created.warning.error === 'tracking_registration_failed') showToast('ה-Tracking ID נשמר למוצר. 17TRACK עדיין לא הצליח לזהות אותו וינסה שוב.');
              else if (created.reused && created.shared) showToast('ה-Tracking ID כבר היה בהזמנה וחובר גם ל-' + text(item.productName, 'המוצר'));
              else if (created.reused) showToast('ה-Tracking ID הקיים שויך ל-' + text(item.productName, 'המוצר'));
              else showToast('ה-Tracking ID חובר ל-' + text(item.productName, 'המוצר'));
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
        { label: 'הזמנות Paid', render: function (row) { return numberFmt(row.paidOrderCount); } },
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
      ['/admin/orders', 'הזמנות', 'כל הסטטוסים'],
      ['/admin/products', 'מוצרים', 'דירוג מכירות'],
      ['/admin/customers', 'לקוחות', 'הוצאות והזמנות'],
      ['/admin/traffic', 'תנועה', 'מקורות ועמודים'],
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
    grid.appendChild(card('מגמת מכירות', 'הכנסה יומית מהזמנות Paid', renderSalesChart(data.dailySales)));
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
      panel.appendChild(detailSection('זהות', [
        ['Visitor ID', v.visitorId], ['User ID', v.userId], ['שם', v.name], ['אימייל', v.email], ['טלפון', v.phone], ['מחובר לחשבון', v.isLoggedIn ? 'כן' : 'לא']
      ]));
      panel.appendChild(detailSection('פעילות', [
        ['Online', v.online ? 'כן' : 'לא'], ['נראה לאחרונה', dateTime(v.lastSeen)], ['כניסה ראשונה', dateTime(v.firstSeen)], ['עמוד נוכחי', v.currentPath], ['עמוד כניסה', v.entryPath], ['סה״כ צפיות', numberFmt(v.pageViewCount)]
      ]));
      panel.appendChild(detailSection('מכשיר', [
        ['סוג מכשיר', v.deviceType], ['דפדפן', v.browser], ['מערכת הפעלה', v.os], ['שפה', v.language], ['מסך', v.screen && v.screen.width ? v.screen.width + '×' + v.screen.height : null], ['Viewport', v.viewport && v.viewport.width ? v.viewport.width + '×' + v.viewport.height : null]
      ]));
      panel.appendChild(detailSection('מקור הגעה', [
        ['Referrer', v.referrer], ['UTM Source', v.utm && v.utm.source], ['UTM Medium', v.utm && v.utm.medium], ['UTM Campaign', v.utm && v.utm.campaign], ['UTM Term', v.utm && v.utm.term], ['UTM Content', v.utm && v.utm.content]
      ]));
      if (v.account) {
        panel.appendChild(detailSection('חשבון VerSans', [
          ['Account ID', v.account.id], ['נוצר', dateTime(v.account.createdAt)], ['לקוח מאומת', v.account.verifiedCustomer ? 'כן' : 'לא'], ['הזמנות', numberFmt(v.account.orderCount)], ['Paid', numberFmt(v.account.paidOrderCount)], ['ביקורות', numberFmt(v.account.reviewCount)], ['הזמנה אחרונה', dateTime(v.account.lastOrderAt)], ['Session בתוקף עד', dateTime(v.account.sessionExpiresAt)]
        ]));
      }
      var historySection = make('section', 'detail-section');
      historySection.appendChild(make('h3', '', 'היסטוריית עמודים'));
      var history = make('div', 'history');
      if (!data.pageViews || !data.pageViews.length) history.appendChild(make('p', 'detail-note', 'אין צפיות שמורות.'));
      (data.pageViews || []).forEach(function (view) {
        var item = make('div', 'history-item');
        item.appendChild(make('strong', '', view.path));
        item.appendChild(make('span', '', (view.title ? view.title + ' · ' : '') + dateTime(view.viewedAt)));
        history.appendChild(item);
      });
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
    frag.appendChild(card('גרף מכירות', 'הכנסות יומיות מהזמנות Paid בלבד', renderSalesChart(data.dailySales)));
    frag.appendChild(topProductsTable(data.topProducts || [], 'המוצרים הנמכרים ביותר', 'מדורג לפי מספר יחידות שנמכרו'));
    frag.appendChild(ordersTable(data.recentOrders || [], 'הזמנות אחרונות', 'Paid בטווח שנבחר'));
    content.replaceChildren(frag);
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
    toolbar.appendChild(make('span', 'admin-toolbar-note', 'סטטוס תשלום לקריאה בלבד · מספרי מעקב מנוהלים מכאן'));
    frag.appendChild(toolbar);
    frag.appendChild(renderKpis([
      { label: 'הזמנות בתצוגה', value: numberFmt(data.count), hint: status === 'all' ? 'כל הסטטוסים' : status, primary: status === 'paid', tone: status === 'paid' ? 'green' : 'amber' },
      { label: 'עמוד', value: numberFmt(Math.floor(data.offset / data.limit) + 1), hint: numberFmt(data.limit) + ' רשומות בעמוד' }
    ]));
    var table = ordersTable(data.orders || [], 'כל ההזמנות', numberFmt(data.count) + ' תוצאות');
    table.appendChild(renderPagination({ count: data.count, limit: data.limit, offset: data.offset, onChange: function (next) { state.offsets.orders = next; renderCurrentPage(); } }));
    frag.appendChild(table);
    content.replaceChildren(frag);
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
    var table = topProductsTable(data.products || [], 'ביצועי מוצרים', 'כמות, מספר הזמנות והכנסה ברוטו לכל מוצר');
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

  function statList(rows) {
    var list = make('div', 'admin-stat-list');
    var values = Array.isArray(rows) ? rows : [];
    if (!values.length) {
      list.appendChild(make('div', 'admin-empty', 'אין נתונים בטווח שנבחר.'));
      return list;
    }
    var max = Math.max.apply(null, values.map(function (row) { return Number(row.count || 0); }).concat([1]));
    values.forEach(function (row) {
      var item = make('div', 'admin-stat-row');
      var label = make('div', 'admin-stat-row__label');
      label.appendChild(make('strong', '', text(row.label, '(לא ידוע)')));
      var progress = make('div', 'admin-progress');
      var fill = make('i');
      fill.style.width = Math.max(2, Math.round(Number(row.count || 0) / max * 100)) + '%';
      progress.appendChild(fill);
      label.appendChild(progress);
      item.append(label, make('div', 'admin-stat-row__value', numberFmt(row.count)));
      list.appendChild(item);
    });
    return list;
  }

  async function renderTrafficPage() {
    var range = state.ranges.traffic;
    var data = await api('/api/admin/traffic?range=' + encodeURIComponent(range));
    var frag = document.createDocumentFragment();
    var toolbar = make('div', 'admin-toolbar');
    toolbar.appendChild(renderRangeFilter(range, rangeOptions, function (next) { state.ranges.traffic = next; renderCurrentPage(); }));
    toolbar.appendChild(make('span', 'admin-toolbar-note', 'ללא כתובות IP'));
    frag.appendChild(toolbar);
    frag.appendChild(renderKpis([
      { label: 'צפיות בעמודים', value: numberFmt(data.pageViews), hint: 'Page views בטווח', primary: true },
      { label: 'עמודים מובילים', value: numberFmt((data.topPages || []).length), hint: 'עד 12 תוצאות' },
      { label: 'מקורות Referrer', value: numberFmt((data.referrers || []).length), hint: 'מקורות מזוהים' },
      { label: 'מקורות UTM', value: numberFmt((data.utmSources || []).length), hint: 'utm_source מזוהה' }
    ]));
    var grids = [
      ['עמודים נצפים', 'Top Pages', data.topPages],
      ['עמודי כניסה', 'Entry Pages', data.entryPages],
      ['Referrers', 'מקורות הפניה', data.referrers],
      ['UTM Source', 'קמפיינים ומקורות', data.utmSources],
      ['מכשירים', 'Device Type', data.devices],
      ['דפדפנים', 'Browsers', data.browsers],
      ['מערכות הפעלה', 'Operating Systems', data.operatingSystems]
    ];
    for (var i = 0; i < grids.length; i += 2) {
      var row = make('div', 'admin-grid-even');
      var first = grids[i];
      row.appendChild(card(first[0], first[1], statList(first[2])));
      if (grids[i + 1]) {
        var second = grids[i + 1];
        row.appendChild(card(second[0], second[1], statList(second[2])));
      }
      frag.appendChild(row);
    }
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
      else if (state.page === 'orders') await renderOrdersPage();
      else if (state.page === 'products') await renderProductsPage();
      else if (state.page === 'customers') await renderCustomersPage();
      else if (state.page === 'traffic') await renderTrafficPage();
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

  renderCurrentPage();
})();
