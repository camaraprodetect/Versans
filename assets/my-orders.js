(function () {
  'use strict';

  function qs(sel) { return document.querySelector(sel); }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
    });
  }

  function api(url) {
    return fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { response: response, data: data };
      });
    });
  }

  function statusLabel(status) {
    var key = String(status || '').toLowerCase();
    return ({
      paid: 'שולם',
      pending: 'ממתין לתשלום',
      created: 'נוצרה',
      processing: 'בטיפול',
      shipped: 'נשלחה',
      delivered: 'נמסרה',
      cancelled: 'בוטלה',
      canceled: 'בוטלה',
      refunded: 'הוחזרה'
    })[key] || String(status || '');
  }

  function formatDate(value) {
    var date = new Date(value || Date.now());
    try {
      return new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' }).format(date);
    } catch (e) {
      return date.toLocaleDateString('he-IL');
    }
  }

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: currency || 'ILS'
      }).format(Number(amount || 0));
    } catch (e) {
      return Number(amount || 0).toFixed(2) + ' ₪';
    }
  }

  function renderOrders(orders) {
    var root = qs('#myOrdersList');
    var count = qs('#ordersCount');
    if (!root || !count) return;

    orders = Array.isArray(orders) ? orders : [];
    count.textContent = orders.length === 1 ? 'הזמנה אחת' : orders.length + ' הזמנות';

    if (!orders.length) {
      root.innerHTML =
        '<div class="orders-empty">' +
          '<strong>עדיין אין הזמנות שמקושרות לחשבון הזה.</strong>' +
          '<p class="account-muted" style="margin:.45rem 0 0">אחרי שתבצעו הזמנה היא תופיע כאן.</p>' +
        '</div>';
      return;
    }

    root.innerHTML = orders.map(function (order) {
      var items = (order.items || []).map(function (item) {
        return '<li>' + escapeHtml(item.name || item.id || 'מוצר') + ' × ' + Number(item.qty || 1) + '</li>';
      }).join('');

      var cancellation = order.cancellation
        ? '<span class="account-order__request">בקשת ביטול: ' +
          escapeHtml(order.cancellation.requestRef) + ' · ' +
          escapeHtml(order.cancellation.status || 'received') + '</span>'
        : '<a class="account-inline-link" href="/cancel-order?order=' +
          encodeURIComponent(order.orderRef || '') + '">בקשת ביטול / החזרה</a>';

      return (
        '<article class="account-order">' +
          '<div class="account-order__top">' +
            '<strong>' + escapeHtml(order.orderRef || '') + '</strong>' +
            '<span>' + escapeHtml(formatDate(order.paidAt || order.createdAt)) + '</span>' +
          '</div>' +
          '<div class="account-order__meta">' +
            '<span>' + escapeHtml(formatMoney(order.amount, order.currency)) + '</span>' +
            '<span class="orders-status">' + escapeHtml(statusLabel(order.status)) + '</span>' +
          '</div>' +
          '<ul>' + items + '</ul>' +
          '<div class="orders-actions">' +
            cancellation +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function load() {
    Promise.all([
      api('/api/auth/me'),
      api('/api/account/orders')
    ]).then(function (results) {
      var me = results[0];
      var orders = results[1];

      var user = me && me.data && me.data.user ? me.data.user : null;
      var guest = !user && me && me.data && me.data.guest ? me.data.guest : null;

      if (!orders.response.ok || !orders.data || !orders.data.ok) {
        /* A visitor with no account and no Guest orders still needs login. */
        if (!user && !(guest && guest.hasOrders)) {
          location.replace('/login?next=%2Fmy-orders');
          return;
        }
        throw new Error('orders_failed');
      }

      var name = qs('#ordersCustomerName');
      if (name) {
        name.textContent =
          (user && user.name) ||
          orders.data.ownerName ||
          (guest && guest.name) ||
          '';
      }

      renderOrders(orders.data.orders || []);
    }).catch(function () {
      var root = qs('#myOrdersList');
      var count = qs('#ordersCount');
      if (count) count.textContent = 'ההזמנות שלי';
      if (root) root.innerHTML = '<p class="account-muted">לא הצלחנו לטעון את ההזמנות כרגע. נסו שוב.</p>';
    });
  }

  load();
})();
