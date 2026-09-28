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

/* VerSans smart cart incentive meter — uses only existing VerSans promotions. */
(function () {
  'use strict';
  if (window.__VERSANS_CART_INCENTIVE_V3) return;
  window.__VERSANS_CART_INCENTIVE_V3 = true;

  var styleId = 'versans-cart-incentive-styles-v3';
  if (!document.getElementById(styleId)) {
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.vs-cart-incentive{margin:0 0 14px;padding:14px 15px 13px;border:1px solid #e0e6eb;border-radius:17px;background:#fff;box-shadow:0 7px 24px rgba(20,35,51,.065);direction:rtl;color:#142333}',
      '.vs-cart-incentive__head{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:8px}',
      '.vs-cart-incentive__badge{display:inline-flex;align-items:center;gap:6px;color:#137a44;background:#eaf8f0;border-radius:999px;padding:4px 9px;white-space:nowrap;font-size:.76rem;font-weight:800}',
      '.vs-cart-incentive__badge::before{content:"";width:7px;height:7px;border-radius:50%;background:#159455;box-shadow:0 0 0 3px rgba(21,148,85,.10)}',
      '.vs-cart-incentive__title{margin:0;font-size:1rem;font-weight:850;line-height:1.5;color:#101820}',
      '.vs-cart-incentive__title strong{color:#b61e24}',
      '.vs-cart-incentive__sub{margin:4px 0 0;font-size:.8rem;line-height:1.45;color:#657481;font-weight:650}',
      '.vs-cart-incentive__meter{position:relative;margin:13px 3px 1px;padding-top:2px}',
      '.vs-cart-incentive__track{position:relative;height:36px}',
      '.vs-cart-incentive__rail{position:absolute;right:0;left:0;top:15px;height:6px;border-radius:999px;background:#e4e8ec;overflow:hidden}',
      '.vs-cart-incentive__fill{position:absolute;right:0;top:0;bottom:0;border-radius:inherit;background:#142333;transition:width .25s ease}',
      '.vs-cart-incentive__dot{position:absolute;top:3px;width:30px;height:30px;border:3px solid #142333;border-radius:50%;background:#fff;color:#142333;display:grid;place-items:center;font-size:.76rem;font-weight:900;z-index:2}',
      '.vs-cart-incentive__dot--current{right:var(--vs-progress);transform:translateX(50%);background:#142333;color:#fff}',
      '.vs-cart-incentive__dot--target{left:0;transform:translateX(-50%)}',
      '.vs-cart-incentive__meter-labels{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:2px;font-size:.72rem;line-height:1.35;color:#6a7884;font-weight:700}',
      '.vs-cart-incentive__meter-labels span:first-child{text-align:right}',
      '.vs-cart-incentive__meter-labels span:last-child{text-align:left}',
      '.vs-cart-incentive__hint{display:flex;align-items:center;gap:7px;margin-top:10px;padding:8px 10px;border-radius:11px;background:#f6f8fa;color:#394a57;font-size:.77rem;line-height:1.4;font-weight:700}',
      '.vs-cart-incentive__hint-icon{width:24px;height:24px;flex:0 0 24px;border-radius:50%;display:grid;place-items:center;background:#142333;color:#fff;font-size:.72rem}',
      '#cartBody>.vs-cart-incentive,#versansGlobalCartBody>.vs-cart-incentive{position:relative}',
      '@media(max-width:700px){.vs-cart-incentive{margin:0 0 12px;padding:12px;border-radius:14px}.vs-cart-incentive__title{font-size:.94rem}.vs-cart-incentive__sub{font-size:.76rem}.vs-cart-incentive__meter{margin-top:11px}.vs-cart-incentive__meter-labels{font-size:.68rem}.vs-cart-incentive__hint{font-size:.73rem;padding:7px 9px}}'
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

  function pluralHat(n) { return n === 1 ? 'כובע' : 'כובעים'; }
  function pluralItem(n) { return n === 1 ? 'פריט' : 'פריטים'; }

  function hatSuggestion(lines, hats) {
    if (!hats) return null;
    var rem = hats % 3;
    var unitPrice = representativeUnitPrice(lines, 'hats') || 139.90;
    var needed, current, target, saving, title, sub, targetText;

    if (rem === 1) {
      needed = 1; current = 1; target = 2;
      saving = Math.max(0, (unitPrice * 2) - 239.90);
      title = 'הוסף עוד כובע וחסוך <strong>' + money(saving) + '</strong>';
      sub = '2 כובעים ב־239.90 ₪ במקום ' + money(unitPrice * 2);
      targetText = '2 כובעים ב־239.90 ₪';
    } else if (rem === 2) {
      needed = 1; current = 2; target = 3;
      saving = Math.max(0, (239.90 + unitPrice) - 299.90);
      title = 'הוסף עוד כובע וחסוך עוד <strong>' + money(saving) + '</strong>';
      sub = '3 כובעים ב־299.90 ₪ — הכובע הנוסף עולה בפועל ' + money(299.90 - 239.90);
      targetText = '3 כובעים ב־299.90 ₪';
    } else {
      needed = 2; current = 0; target = 2;
      saving = Math.max(0, (unitPrice * 2) - 239.90);
      title = 'הוסף עוד 2 כובעים וחסוך <strong>' + money(saving) + '</strong>';
      sub = 'זוג הכובעים הבא יקבל אוטומטית מחיר של 239.90 ₪';
      targetText = '2 כובעים נוספים ב־239.90 ₪';
    }

    return {
      score:(needed === 1 ? 3000 : 2200) + saving,
      icon:'🧢', title:title, sub:sub,
      current:current, target:target,
      currentLabel: current + ' ' + pluralHat(current) + (current ? ' בסל' : ' בקבוצה הבאה'),
      targetLabel:targetText,
      hint: needed === 1 ? 'חסר רק כובע אחד כדי לקבל את המחיר המוזל' : 'שני כובעים נוספים יפתחו זוג נוסף במחיר המבצע'
    };
  }

  function glassesSuggestion(lines, glasses) {
    if (!glasses) return null;
    var rem = glasses % 2;
    var unitPrice = representativeUnitPrice(lines, 'glasses') || 139.90;
    var needed = rem === 1 ? 1 : 2;
    var current = rem === 1 ? 1 : 0;
    var target = 2;
    var saving = Math.max(0, (unitPrice * 2) - 249.90);
    return {
      score:(needed === 1 ? 2800 : 2000) + saving,
      icon:'◉',
      title:(needed === 1 ? 'הוסף עוד זוג משקפיים' : 'הוסף עוד 2 זוגות משקפיים') + ' וחסוך <strong>' + money(saving) + '</strong>',
      sub:'2 משקפיים ב־249.90 ₪ במקום ' + money(unitPrice * 2),
      current:current,
      target:target,
      currentLabel: current === 1 ? 'זוג אחד בסל' : '0 מתוך 2 לזוג הבא',
      targetLabel:'2 משקפיים ב־249.90 ₪',
      hint: needed === 1 ? 'חסר עוד זוג אחד כדי לקבל את מחיר המבצע' : 'שני זוגות נוספים יקבלו אוטומטית את מחיר המבצע'
    };
  }

  function bundledHatUnits(hats) {
    var rem = hats % 3;
    return hats - (rem === 1 ? 1 : 0);
  }

  function bundledGlassesUnits(glasses) {
    return glasses - (glasses % 2);
  }

  function secondItemSuggestion(lines, hats, glasses) {
    var total = qty(lines);
    if (!total) return null;
    var bundled = bundledHatUnits(hats) + bundledGlassesUnits(glasses);
    var eligible = Math.max(0, total - bundled);
    var current = eligible % 2;
    var needed = current === 1 ? 1 : 2;
    return {
      score: needed === 1 ? 900 : 450,
      icon:'%',
      title: needed === 1
        ? 'הוסף עוד פריט וקבל <strong>10% הנחה</strong> על הפריט הזול מבין השניים'
        : 'הוסף עוד 2 פריטים וקבל <strong>10% הנחה</strong> על פריט נוסף',
      sub:'10% הנחה על כל פריט שני מחושבת אוטומטית בסל',
      current:current,
      target:2,
      currentLabel: current === 1 ? 'פריט אחד מתוך זוג' : '0 מתוך 2 לזוג הבא',
      targetLabel:'2 פריטים = 10% על השני',
      hint: needed === 1 ? 'חסר עוד פריט אחד כדי להפעיל הנחה נוספת' : 'כל זוג פריטים נוסף מפעיל עוד הנחת 10%'
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
      secondItemSuggestion(lines, hats, glasses)
    ].filter(Boolean).sort(function (a, b) { return b.score - a.score; });
    var model = suggestions[0] || null;
    if (!model) return null;
    model.progress = Math.max(0, Math.min(100, Math.round((model.current / model.target) * 100)));
    return model;
  }

  function htmlFor(model) {
    var progressCss = model.progress + '%';
    return '<section class="vs-cart-incentive" data-versans-cart-incentive aria-label="הטבה זמינה בסל">' +
      '<div class="vs-cart-incentive__head"><span class="vs-cart-incentive__badge">הטבות אוטומטיות</span></div>' +
      '<p class="vs-cart-incentive__title">' + model.title + '</p>' +
      '<p class="vs-cart-incentive__sub">' + escapeHtml(model.sub) + '</p>' +
      '<div class="vs-cart-incentive__meter" style="--vs-progress:' + progressCss + '">' +
        '<div class="vs-cart-incentive__track" aria-hidden="true">' +
          '<div class="vs-cart-incentive__rail"><span class="vs-cart-incentive__fill" style="width:' + progressCss + '"></span></div>' +
          '<span class="vs-cart-incentive__dot vs-cart-incentive__dot--current">' + escapeHtml(model.current) + '</span>' +
          '<span class="vs-cart-incentive__dot vs-cart-incentive__dot--target">' + escapeHtml(model.target) + '</span>' +
        '</div>' +
        '<div class="vs-cart-incentive__meter-labels"><span>' + escapeHtml(model.currentLabel) + '</span><span>' + escapeHtml(model.targetLabel) + '</span></div>' +
      '</div>' +
      '<div class="vs-cart-incentive__hint"><span class="vs-cart-incentive__hint-icon" aria-hidden="true">' + escapeHtml(model.icon) + '</span><span>' + escapeHtml(model.hint) + '</span></div>' +
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
      title:model.title, sub:model.sub, current:model.current, target:model.target,
      currentLabel:model.currentLabel, targetLabel:model.targetLabel, hint:model.hint
    });
    if (old && old.getAttribute('data-signature') === signature) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = htmlFor(model);
    var node = wrap.firstElementChild;
    node.setAttribute('data-signature', signature);
    if (old) old.replaceWith(node);
    else body.insertBefore(node, body.firstChild);
  }

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
