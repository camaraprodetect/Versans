(function () {
  'use strict';

  var CART_KEY = 'kw_cart';
  var PRODUCTS = window.PRODUCTS || [];

  function readRaw() {
    try {
      var value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function productById(id) {
    for (var i = 0; i < PRODUCTS.length; i += 1) {
      var product = PRODUCTS[i];
      if (!product) continue;
      if (String(product.id || '') === String(id || '') || String(product.slug || '') === String(id || '') || String(product.urlSlug || '') === String(id || '')) return product;
    }
    return null;
  }

  function optionById(list, id) {
    if (!Array.isArray(list) || !id) return null;
    for (var i = 0; i < list.length; i += 1) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }

  function itemKey(item) {
    item = item || {};
    var pending = Array.isArray(item.quickAddPending) ? item.quickAddPending.slice().sort().join(',') : '';
    return item.key || (
      (item.id || '') + '|' + (item.necklace || '') + '|' + (item.box || '') + '|' + (item.size || '') + '|' + (item.color || '') +
      '|pack:' + (item.packaging || '') + '|name:' + (item.customName || '') +
      '|p:' + (item.customPhoto && item.customPhoto.assetId || '') +
      '|g:' + (item.greeting ? JSON.stringify(item.greeting) : '') + '|pending:' + pending
    );
  }

  function lineFor(item, allItems) {
    if (!item || !item.id) return null;
    var product = productById(item.id);
    if (!product) return null;

    var necklace = optionById(product.necklaces, item.necklace);
    var box = optionById(product.boxes, item.box);
    var size = optionById(product.sizes, item.size);
    var color = optionById(product.colors, item.color);
    var packaging = item.packaging && product.giftPackaging ? optionById(product.giftPackaging.options, item.packaging) : null;
    var invalidPackaging = !!(item.packaging && (!product.giftPackaging || !packaging));
    var needsNecklace = Array.isArray(product.necklaces) && product.necklaces.length;
    var needsBox = Array.isArray(product.boxes) && product.boxes.length;
    var needsSize = Array.isArray(product.sizes) && product.sizes.length;
    var needsColor = Array.isArray(product.colors) && product.colors.length;
    var needsCustomName = !!(product.customName && product.customName.required);
    var needsCustomPhoto = !!(product.customPhoto && product.customPhoto.required);
    var customName = String(item.customName || '').trim();
    var customPhoto = item.customPhoto && typeof item.customPhoto === 'object' ? item.customPhoto : null;
    var pendingRequirements = Array.isArray(item.quickAddPending) ? item.quickAddPending.slice() : [];
    var allowsPendingName = pendingRequirements.indexOf('customName') !== -1;
    var allowsPendingPhoto = pendingRequirements.indexOf('customPhoto') !== -1;
    var allowsPendingCompanion = pendingRequirements.indexOf('companion') !== -1;
    var companionReady = !(product.requiresCompanion && product.requiresCompanion.required && Array.isArray(product.requiresCompanion.productIds) && product.requiresCompanion.productIds.length) || (allItems || []).some(function (candidate) {
      return candidate && product.requiresCompanion.productIds.indexOf(candidate.id) !== -1;
    });

    if ((needsNecklace && !necklace) || (needsBox && !box) || (needsSize && !size) || (needsColor && !color) || invalidPackaging || (!companionReady && !allowsPendingCompanion) || (needsCustomName && !customName && !allowsPendingName) || (needsCustomPhoto && (!customPhoto || !customPhoto.assetId) && !allowsPendingPhoto)) return null;

    var qty = parseInt(item.qty, 10);
    if (!Number.isFinite(qty) || qty <= 0) return null;

    var extra = box ? Number(box.addPrice || 0) : 0;
    var sizeExtra = size ? Number(size.addPrice || 0) : 0;
    var packagingExtra = packaging ? Number(packaging.addPrice || 0) : 0;
    var greetingExtra = item.greeting && typeof item.greeting === 'object' ? 35 : 0;

    return {
      p: product,
      item: item,
      key: itemKey(item),
      qty: qty,
      necklace: necklace,
      box: box,
      size: size,
      color: color,
      packaging: packaging,
      customName: customName,
      customPhoto: customPhoto,
      greeting: item.greeting && typeof item.greeting === 'object' ? item.greeting : null,
      pendingRequirements: pendingRequirements,
      unitPrice: Number(product.price || 0) + extra + sizeExtra + packagingExtra + greetingExtra
    };
  }

  function lines(items) {
    var source = Array.isArray(items) ? items : readRaw();
    return source.map(function (item) { return lineFor(item, source); }).filter(Boolean);
  }

  function count(items) {
    return lines(items).reduce(function (sum, line) { return sum + line.qty; }, 0);
  }

  function notify() {
    try { window.dispatchEvent(new CustomEvent('versans:cart-changed')); } catch (_) {}
    syncBadge();
  }

  function write(items) {
    var safe = Array.isArray(items) ? items : [];
    try { localStorage.setItem(CART_KEY, JSON.stringify(safe)); } catch (_) {}
    notify();
    return safe;
  }

  function syncBadge(root) {
    var n = count();
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll('#cartCount, [data-cart-count]');
    Array.prototype.forEach.call(nodes, function (el) {
      el.textContent = String(n);
      el.hidden = n === 0;
      el.setAttribute('aria-label', n === 1 ? 'פריט אחד בסל' : n + ' פריטים בסל');
    });
    return n;
  }

  function setQty(key, nextQty) {
    var items = readRaw();
    var q = parseInt(nextQty, 10) || 0;
    items = items.filter(function (item) {
      if (itemKey(item) !== key) return true;
      if (q <= 0) return false;
      item.qty = q;
      return true;
    });
    write(items);
    return items;
  }

  window.VERSANS_CART_STATE = {
    key: CART_KEY,
    read: readRaw,
    write: write,
    lines: lines,
    count: count,
    itemKey: itemKey,
    setQty: setQty,
    syncBadge: syncBadge,
    notify: notify
  };

  window.addEventListener('storage', function (event) {
    if (!event || event.key === CART_KEY) syncBadge();
  });
  window.addEventListener('pageshow', function () { syncBadge(); });
  window.addEventListener('focus', function () { syncBadge(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) syncBadge();
  });
  window.addEventListener('versans:cart-changed', function () { syncBadge(); });

  syncBadge();
})();
