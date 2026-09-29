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

  function greetingAddPrice(greeting) {
    if (!greeting || typeof greeting !== 'object') return 0;
    var hasUpgrade = greeting.template !== 'template-1' || (greeting.template === 'template-1' && greeting.hasCustomBackground === true);
    return 20 + (hasUpgrade ? 15 : 0);
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

    var necklaceExtra = necklace ? Number(necklace.addPrice || 0) : 0;
    var boxExtra = box ? Number(box.addPrice || 0) : 0;
    var sizeExtra = size ? Number(size.addPrice || 0) : 0;
    var colorExtra = color ? Number(color.addPrice || 0) : 0;
    var packagingExtra = packaging ? Number(packaging.addPrice || 0) : 0;
    var greetingExtra = greetingAddPrice(item.greeting);

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
      unitPrice: Number(product.price || 0) + necklaceExtra + boxExtra + sizeExtra + colorExtra + packagingExtra + greetingExtra
    };
  }

  function canonicalize(items) {
    var source = Array.isArray(items) ? items : [];
    var candidates = source.map(function (item) {
      if (!item || typeof item !== 'object' || !item.id) return null;
      var qty = parseInt(item.qty, 10);
      if (!Number.isFinite(qty) || qty <= 0) return null;
      var copy = Object.assign({}, item);
      copy.qty = qty;
      return copy;
    }).filter(Boolean);

    /* If product data is unavailable, preserve positive rows rather than
       risking a destructive cleanup. Every storefront page loads products.js
       before this file, but this makes the state layer fail-safe. */
    if (!PRODUCTS.length) return candidates;

    /* Remove stale/invalid rows. Run a few passes so dependent products are
       also removed if the companion line they depended on was invalid. */
    for (var pass = 0; pass < 3; pass += 1) {
      var filtered = candidates.filter(function (item) { return !!lineFor(item, candidates); });
      if (filtered.length === candidates.length) {
        candidates = filtered;
        break;
      }
      candidates = filtered;
    }

    /* The same configured product must exist as one cart line only. Old
       versions of the site could leave duplicate rows behind. */
    var merged = [];
    var byKey = Object.create(null);
    candidates.forEach(function (item) {
      var key = itemKey(item);
      if (!key) return;
      if (byKey[key]) {
        byKey[key].qty += item.qty;
        return;
      }
      item.key = key;
      byKey[key] = item;
      merged.push(item);
    });
    return merged;
  }

  function repairStorage() {
    var raw = readRaw();
    var safe = canonicalize(raw);
    try {
      if (JSON.stringify(raw) !== JSON.stringify(safe)) {
        localStorage.setItem(CART_KEY, JSON.stringify(safe));
      }
    } catch (_) {}
    return safe;
  }

  function lines(items) {
    var source = Array.isArray(items) ? canonicalize(items) : repairStorage();
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
    var safe = canonicalize(Array.isArray(items) ? items : []);
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
    var items = repairStorage();
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
    read: repairStorage,
    write: write,
    canonicalize: canonicalize,
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

  repairStorage();
  syncBadge();
})();

/* VerSans smart cart incentive meter - uses only existing VerSans promotions. */
(function () {
  'use strict';
  if (window.__VERSANS_CART_INCENTIVE_V4) return;
  window.__VERSANS_CART_INCENTIVE_V4 = true;

  var styleId = 'versans-cart-incentive-styles-v4';
  if (!document.getElementById(styleId)) {
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.vs-cart-incentive{margin:0 0 11px;padding:11px 12px 10px;border:1px solid #e2e6ea;border-radius:14px;background:#fff;direction:rtl;color:#142333}',
      '.vs-cart-incentive__title{margin:0;text-align:center;font-size:.9rem;font-weight:900;line-height:1.35;color:#17212b}',
      '.vs-cart-incentive__title strong{color:#c91824}',
      '.vs-cart-incentive__sub{margin:3px 0 0;text-align:center;font-size:.72rem;line-height:1.3;color:#687783;font-weight:700}',
      '.vs-cart-incentive__meter{position:relative;margin:11px 3px 0;padding:0 1px}',
      '.vs-cart-incentive__track{position:relative;min-height:70px;padding:0 16px}',
      '.vs-cart-incentive__rail{position:absolute;right:16px;left:16px;top:17px;height:6px;border-radius:999px;background:#e1e4e7;overflow:hidden}',
      '.vs-cart-incentive__fill{position:absolute;right:0;top:0;bottom:0;width:var(--vs-progress);border-radius:inherit;background:#142333;transition:width .25s ease}',
      '.vs-cart-incentive__steps{position:relative;display:flex;justify-content:space-between;align-items:flex-start;direction:rtl}',
      '.vs-cart-incentive__step{width:33.333%;min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;color:#66747f;font-size:.62rem;line-height:1.18;font-weight:750}',
      '.vs-cart-incentive__step:first-child{align-items:flex-start;text-align:right}',
      '.vs-cart-incentive__step:last-child{align-items:flex-end;text-align:left}',
      '.vs-cart-incentive__dot{position:relative;z-index:2;width:36px;height:36px;border:2.5px solid #142333;border-radius:50%;background:#fff;color:#142333;display:grid;place-items:center;font-size:.76rem;font-weight:950;box-sizing:border-box;transition:background .2s ease,color .2s ease,transform .2s ease}',
      '.vs-cart-incentive__step.is-done .vs-cart-incentive__dot{background:#142333;color:#fff}',
      '.vs-cart-incentive__step.is-current .vs-cart-incentive__dot{transform:scale(1.08);box-shadow:0 0 0 4px rgba(20,35,51,.08)}',
      '.vs-cart-incentive__step-label{display:block;max-width:94px;margin-top:5px;min-height:26px;white-space:pre-line}',
      '.vs-cart-incentive__step.is-done .vs-cart-incentive__step-label{color:#142333;font-weight:850}',
      '.vs-cart-incentive__tag{width:16px;height:16px;display:block}',
      '.vs-cart-incentive__tag path,.vs-cart-incentive__tag circle{stroke:currentColor}',
      '#cartBody>.vs-cart-incentive,#versansGlobalCartBody>.vs-cart-incentive{position:relative}',
      '@media(max-width:700px){.vs-cart-incentive{margin:0 0 9px;padding:9px 10px 8px;border-radius:12px}.vs-cart-incentive__title{font-size:.84rem}.vs-cart-incentive__sub{font-size:.67rem}.vs-cart-incentive__meter{margin-top:9px}.vs-cart-incentive__track{min-height:64px;padding:0 13px}.vs-cart-incentive__rail{right:13px;left:13px;top:15px;height:5px}.vs-cart-incentive__dot{width:32px;height:32px;border-width:2px;font-size:.7rem}.vs-cart-incentive__step{font-size:.57rem;line-height:1.15}.vs-cart-incentive__step-label{max-width:82px;margin-top:4px;min-height:23px}.vs-cart-incentive__tag{width:14px;height:14px}.vs-cart-incentive__step.is-current .vs-cart-incentive__dot{box-shadow:0 0 0 3px rgba(20,35,51,.08)}}'
    ].join('');
    document.head.appendChild(style);
  }

  var scheduled = false;
  var rendering = false;

  function qty(lines) {
    return (lines || []).reduce(function (sum, line) {
      return sum + Math.max(0, parseInt(line && line.qty, 10) || 0);
    }, 0);
  }

  function categories(line) {
    if (!line) return [];
    if (Array.isArray(line.categories)) return line.categories;
    if (line.p && Array.isArray(line.p.categories)) return line.p.categories;
    var c = line.category || (line.p && line.p.category);
    return c ? [c] : [];
  }

  var BUY2_GET1_CATEGORIES = ['greeting', 'necklaces', 'bracelets', 'rings', 'photo-bracelets', 'watches'];

  function isBuy2Get1Line(line) {
    var cats = categories(line);
    return cats.some(function (category) {
      return BUY2_GET1_CATEGORIES.indexOf(category) !== -1;
    });
  }

  function buy2Get1Qty(lines) {
    return (lines || []).reduce(function (sum, line) {
      if (!isBuy2Get1Line(line)) return sum;
      return sum + Math.max(0, parseInt(line && line.qty, 10) || 0);
    }, 0);
  }

  function buy2Get1PotentialSaving(lines) {
    var prices = [];
    (lines || []).forEach(function (line) {
      if (!isBuy2Get1Line(line)) return;
      var n = Math.max(0, parseInt(line && line.qty, 10) || 0);
      var price = Number(line && (line.unitPrice != null ? line.unitPrice : (line.price != null ? line.price : (line.p && line.p.price)))) || 0;
      for (var i = 0; i < n; i += 1) prices.push(price);
    });
    if (!prices.length) return 0;
    prices.sort(function (a, b) { return b - a; });

    // Only value an unfinished 2+1 group. The next product is unknown, so use
    // the cheapest jewelry item already waiting in that group as the maximum
    // discount potential. This is used only to rank the meter suggestion; the
    // real checkout discount is still calculated by pricing.js.
    var remainder = prices.length % 3;
    if (!remainder) return 0;
    var pending = prices.slice(prices.length - remainder);
    return pending.length ? Math.min.apply(Math, pending) : 0;
  }

  function categoryLines(lines, category) {
    return (lines || []).filter(function (line) {
      return categories(line).indexOf(category) !== -1;
    });
  }

  function categoryQty(lines, category) {
    return categoryLines(lines, category).reduce(function (sum, line) {
      return sum + Math.max(0, parseInt(line.qty, 10) || 0);
    }, 0);
  }

  function representativeUnitPrice(lines, category) {
    var matches = categoryLines(lines, category);
    if (!matches.length) return 0;
    var prices = [];
    matches.forEach(function (line) {
      var n = Math.max(0, parseInt(line.qty, 10) || 0);
      var price = Number(line.unitPrice != null ? line.unitPrice : (line.price != null ? line.price : (line.p && line.p.price))) || 0;
      for (var i = 0; i < n; i += 1) prices.push(price);
    });
    prices.sort(function (a, b) { return b - a; });
    return prices.length ? prices[0] : 0;
  }

  function money(value) {
    var n = Math.max(0, Number(value) || 0);
    return n.toFixed(2).replace(/\.00$/, '') + ' ₪';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
    });
  }

  function numberStep(value, label) {
    return { threshold:value, kind:'number', value:String(value), label:label };
  }

  function promoStep(value, label, kind) {
    return { threshold:value, kind:kind || 'tag', label:label };
  }

  function hatSuggestion(lines, hats) {
    if (!hats) return null;
    var rem = hats % 3;
    var unitPrice = representativeUnitPrice(lines, 'hats') || 139.90;
    var needed, current, target, saving, title, sub, steps;

    if (rem === 1) {
      needed = 1;
      current = 1;
      target = 2;
      saving = Math.max(0, (unitPrice * 2) - 239.90);
      title = 'הוסף עוד כובע וחסוך <strong>' + money(saving) + '</strong>';
      sub = '2 כובעים ב-239.90 ₪ במקום ' + money(unitPrice * 2);
      steps = [
        numberStep(1, 'כובע אחד'),
        promoStep(2, '2 כובעים\nב-239.90 ₪'),
        promoStep(3, '3 כובעים\nב-299.90 ₪')
      ];
    } else if (rem === 2) {
      needed = 1;
      current = 2;
      target = 3;
      saving = Math.max(0, (239.90 + unitPrice) - 299.90);
      title = 'הוסף עוד כובע וחסוך עוד <strong>' + money(saving) + '</strong>';
      sub = '3 כובעים ב-299.90 ₪';
      steps = [
        numberStep(1, 'כובע אחד'),
        promoStep(2, '2 כובעים\nב-239.90 ₪'),
        promoStep(3, '3 כובעים\nב-299.90 ₪')
      ];
    } else {
      needed = 2;
      current = hats;
      target = hats + 2;
      saving = Math.max(0, (unitPrice * 2) - 239.90);
      title = 'הוסף עוד 2 כובעים וחסוך <strong>' + money(saving) + '</strong>';
      sub = 'ההטבה הבאה: 2 כובעים נוספים ב-239.90 ₪';
      steps = [
        promoStep(hats, '3 כובעים\nב-299.90 ₪'),
        numberStep(hats + 1, 'כובע נוסף'),
        promoStep(hats + 2, '2 כובעים נוספים\nב-239.90 ₪')
      ];
    }

    return {
      type:'hats', priority:30, needed:needed, saving:saving,
      title:title, sub:sub, current:current, target:target, steps:steps
    };
  }

  function glassesSuggestion(lines, glasses) {
    if (!glasses) return null;
    var rem = glasses % 2;
    var unitPrice = representativeUnitPrice(lines, 'glasses') || 139.90;
    var saving = Math.max(0, (unitPrice * 2) - 249.90);
    var needed = rem === 1 ? 1 : 2;
    var current = rem === 1 ? 1 : 0;
    return {
      type:'glasses', priority:20, needed:needed, saving:saving,
      title:(needed === 1 ? 'הוסף עוד זוג משקפיים' : 'הוסף עוד 2 זוגות משקפיים') + ' וחסוך <strong>' + money(saving) + '</strong>',
      sub:'2 משקפיים ב-249.90 ₪ במקום ' + money(unitPrice * 2),
      current:current,
      target:2,
      steps:[
        numberStep(0, 'זוג חדש'),
        numberStep(1, 'זוג אחד'),
        promoStep(2, '2 משקפיים ב-249.90 ₪')
      ]
    };
  }

  function buy2Get1Suggestion(lines) {
    var eligible = buy2Get1Qty(lines);
    if (!eligible) return null;

    var current = eligible % 3;
    var needed = current === 0 ? 3 : (3 - current);
    var completedGroups = Math.floor(eligible / 3);
    var title;

    if (current === 2) {
      title = 'הוסף עוד תכשיט וקבל <strong>2+1</strong>';
    } else if (current === 1) {
      title = 'הוסף עוד 2 תכשיטים וקבל <strong>2+1</strong>';
    } else if (completedGroups > 0) {
      title = 'מבצע <strong>2+1</strong> הופעל - הוסף עוד 3 תכשיטים לקבלת מתנה נוספת';
    } else {
      title = 'הוסף 3 תכשיטים וקבל <strong>2+1</strong>';
    }

    return {
      type:'buy-2-get-1', priority:10, needed:needed, saving:buy2Get1PotentialSaving(lines),
      title:title,
      sub:'מבצע 2+1 על תכשיטים',
      current:current,
      target:3,
      steps:[
        numberStep(1, 'תכשיט 1'),
        numberStep(2, 'תכשיט 2'),
        promoStep(3, '2+1')
      ]
    };
  }

  function buildModel(lines) {
    var total = qty(lines);
    if (!total) return null;
    var hats = categoryQty(lines, 'hats');
    var glasses = categoryQty(lines, 'glasses');
    var suggestions = [
      hatSuggestion(lines, hats),
      glassesSuggestion(lines, glasses),
      buy2Get1Suggestion(lines)
    ].filter(Boolean);

    suggestions.sort(function (a, b) {
      // The meter should lead with the promotion that can save the customer
      // the most money. If two offers have the same value, prefer the one
      // requiring fewer additional items.
      if (a.saving !== b.saving) return b.saving - a.saving;
      if (a.needed !== b.needed) return a.needed - b.needed;
      return b.priority - a.priority;
    });

    var model = suggestions[0] || null;
    if (!model) return null;
    var first = model.steps[0].threshold;
    var last = model.steps[model.steps.length - 1].threshold;
    var span = Math.max(1, last - first);
    model.progress = Math.max(0, Math.min(100, Math.round(((model.current - first) / span) * 100)));
    return model;
  }

  function tagIcon() {
    return '<svg class="vs-cart-incentive__tag" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M20.3 13.7 12.8 21.2a2 2 0 0 1-2.8 0L2.8 14a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h7.6a2 2 0 0 1 1.4.6l7.1 7.1a2.1 2.1 0 0 1 0 3Z" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="8" cy="9" r="1.5" stroke-width="2"/>' +
    '</svg>';
  }

  function stepIcon(step) {
    if (step.kind === 'tag') return tagIcon();
    if (step.kind === 'percent') return '<span aria-hidden="true">%</span>';
    return escapeHtml(step.value);
  }

  function htmlFor(model) {
    var progressCss = model.progress + '%';
    var stepsHtml = model.steps.map(function (step) {
      var done = model.current >= step.threshold;
      var current = model.current === step.threshold;
      var cls = 'vs-cart-incentive__step' + (done ? ' is-done' : '') + (current ? ' is-current' : '');
      return '<div class="' + cls + '">' +
        '<span class="vs-cart-incentive__dot">' + stepIcon(step) + '</span>' +
        '<span class="vs-cart-incentive__step-label">' + escapeHtml(step.label) + '</span>' +
      '</div>';
    }).join('');

    return '<section class="vs-cart-incentive" data-versans-cart-incentive aria-label="הטבה זמינה בסל">' +
      '<p class="vs-cart-incentive__title">' + model.title + '</p>' +
      '<p class="vs-cart-incentive__sub">' + escapeHtml(model.sub) + '</p>' +
      '<div class="vs-cart-incentive__meter" style="--vs-progress:' + progressCss + '">' +
        '<div class="vs-cart-incentive__track" aria-hidden="true">' +
          '<div class="vs-cart-incentive__rail"><span class="vs-cart-incentive__fill"></span></div>' +
          '<div class="vs-cart-incentive__steps">' + stepsHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function renderInto(body, lines) {
    if (!body) return;
    var old = body.querySelector(':scope > [data-versans-cart-incentive]');
    var model = buildModel(lines);
    if (!model) {
      if (old) old.remove();
      return;
    }
    var signature = JSON.stringify({
      type:model.type, title:model.title, sub:model.sub, current:model.current, target:model.target,
      progress:model.progress, steps:model.steps
    });
    if (old && old.getAttribute('data-signature') === signature) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = htmlFor(model);
    var node = wrap.firstElementChild;
    node.setAttribute('data-signature', signature);
    if (old) old.replaceWith(node);
    else body.insertBefore(node, body.firstChild);
  }

  function initCartFootResizer() {
    if (window.__versansCartFootResizerReady) return;
    window.__versansCartFootResizerReady = true;

    var drag = null;

    function endDrag(event) {
      if (!drag) return;
      if (event && drag.handle.releasePointerCapture) {
        try { drag.handle.releasePointerCapture(event.pointerId); } catch (_) {}
      }
      drag.handle.classList.remove('is-dragging');
      document.documentElement.classList.remove('is-resizing-cart-foot');
      drag = null;
    }

    document.addEventListener('pointerdown', function (event) {
      var handle = event.target.closest && event.target.closest('[data-cart-savings-resizer]');
      if (!handle) return;
      var box = handle.closest('[data-cart-savings-resizable]');
      var content = box && box.querySelector('[data-cart-savings-resizable-content]');
      var panel = handle.closest('.ov__panel');
      if (!box || !content || !panel) return;

      event.preventDefault();
      var contentRect = content.getBoundingClientRect();
      var panelRect = panel.getBoundingClientRect();
      var foot = handle.closest('.drawer__foot');
      var checkout = foot && foot.querySelector('.cart-checkout-cta');
      var checkoutHeight = checkout ? checkout.getBoundingClientRect().height : 50;
      var fixedReserve = checkoutHeight + 215;
      var minHeight = Math.min(82, Math.max(58, content.scrollHeight > 0 ? Math.min(content.scrollHeight, 82) : 58));
      var maxHeight = Math.max(minHeight, Math.min(360, panelRect.height - fixedReserve));

      drag = {
        handle: handle,
        box: box,
        content: content,
        startY: event.clientY,
        startHeight: contentRect.height,
        minHeight: minHeight,
        maxHeight: maxHeight
      };

      content.style.height = Math.round(contentRect.height) + 'px';
      content.style.maxHeight = 'none';
      box.setAttribute('data-cart-savings-resized', 'true');
      handle.classList.add('is-dragging');
      document.documentElement.classList.add('is-resizing-cart-foot');
      if (handle.setPointerCapture) {
        try { handle.setPointerCapture(event.pointerId); } catch (_) {}
      }
    });

    document.addEventListener('pointermove', function (event) {
      if (!drag) return;
      event.preventDefault();
      var nextHeight = drag.startHeight + (drag.startY - event.clientY);
      nextHeight = Math.max(drag.minHeight, Math.min(drag.maxHeight, nextHeight));
      drag.content.style.height = Math.round(nextHeight) + 'px';
    }, { passive:false });

    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);

    // Touch fallback for iOS/in-app browsers where pointer capture can be unreliable.
    var touchDrag = null;
    document.addEventListener('touchstart', function (event) {
      if (!event.touches || event.touches.length !== 1) return;
      var handle = event.target.closest && event.target.closest('[data-cart-savings-resizer]');
      if (!handle) return;
      var box = handle.closest('[data-cart-savings-resizable]');
      var content = box && box.querySelector('[data-cart-savings-resizable-content]');
      var panel = handle.closest('.ov__panel');
      if (!box || !content || !panel) return;

      var touch = event.touches[0];
      var contentRect = content.getBoundingClientRect();
      var panelRect = panel.getBoundingClientRect();
      var foot = handle.closest('.drawer__foot');
      var checkout = foot && foot.querySelector('.cart-checkout-cta');
      var checkoutHeight = checkout ? checkout.getBoundingClientRect().height : 50;
      var fixedReserve = checkoutHeight + 215;
      var minHeight = Math.min(82, Math.max(58, content.scrollHeight > 0 ? Math.min(content.scrollHeight, 82) : 58));
      var maxHeight = Math.max(minHeight, Math.min(360, panelRect.height - fixedReserve));

      touchDrag = {
        handle:handle, box:box, content:content,
        startY:touch.clientY, startHeight:contentRect.height,
        minHeight:minHeight, maxHeight:maxHeight
      };
      content.style.height = Math.round(contentRect.height) + 'px';
      content.style.maxHeight = 'none';
      box.setAttribute('data-cart-savings-resized', 'true');
      handle.classList.add('is-dragging');
      document.documentElement.classList.add('is-resizing-cart-foot');
      event.preventDefault();
    }, { passive:false });

    document.addEventListener('touchmove', function (event) {
      if (!touchDrag || !event.touches || !event.touches.length) return;
      var nextHeight = touchDrag.startHeight + (touchDrag.startY - event.touches[0].clientY);
      nextHeight = Math.max(touchDrag.minHeight, Math.min(touchDrag.maxHeight, nextHeight));
      touchDrag.content.style.height = Math.round(nextHeight) + 'px';
      event.preventDefault();
    }, { passive:false });

    function endTouchDrag() {
      if (!touchDrag) return;
      touchDrag.handle.classList.remove('is-dragging');
      document.documentElement.classList.remove('is-resizing-cart-foot');
      touchDrag = null;
    }
    document.addEventListener('touchend', endTouchDrag, { passive:true });
    document.addEventListener('touchcancel', endTouchDrag, { passive:true });

    document.addEventListener('dblclick', function (event) {
      var handle = event.target.closest && event.target.closest('[data-cart-savings-resizer]');
      if (!handle) return;
      var box = handle.closest('[data-cart-savings-resizable]');
      var content = box && box.querySelector('[data-cart-savings-resizable-content]');
      if (!box || !content) return;
      content.style.height = '';
      content.style.maxHeight = '';
      box.removeAttribute('data-cart-savings-resized');
    });
  }

  initCartFootResizer();

  function renderAll() {
    scheduled = false;
    if (rendering) return;
    rendering = true;
    try {
      var cart = window.VERSANS_CART_STATE;
      if (!cart || typeof cart.lines !== 'function') return;
      var lines = cart.lines();
      renderInto(document.getElementById('cartBody'), lines);
      renderInto(document.getElementById('versansGlobalCartBody'), lines);
    } catch (_) {
      /* Incentive UI must never block the cart. */
    } finally {
      rendering = false;
    }
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame ? window.requestAnimationFrame(renderAll) : setTimeout(renderAll, 0);
  }

  window.addEventListener('versans:cart-changed', scheduleRender);
  window.addEventListener('pageshow', scheduleRender);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) scheduleRender(); });

  function startObserver() {
    scheduleRender();
    if (!document.body || !window.MutationObserver) return;
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var target = mutations[i].target;
        if (target && (target.id === 'cartBody' || target.id === 'versansGlobalCartBody' || (target.closest && target.closest('#cartBody,#versansGlobalCartBody')))) {
          scheduleRender();
          return;
        }
      }
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once:true });
  else startObserver();
})();
