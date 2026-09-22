(function () {
  'use strict';

  var Cart = window.VERSANS_CART_STATE;
  if (!Cart) return;

  /* Home / hats already have the full cart + checkout handled by store.js. */
  if (document.getElementById('cartOverlay')) return;

  var CFG = window.STORE_CONFIG || { currency: { code: 'ILS', symbol: '₪' }, shipping: { flat: 0, freeOver: 0 } };
  var lang = 'he';
  try { lang = localStorage.getItem('kw_lang') || 'he'; } catch (_) {}

  function L(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return value[lang] || value.he || value.en || '';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function money(value) {
    var n = Math.round(Number(value || 0) * 100) / 100;
    var text = n.toFixed(2).replace(/\.00$/, '');
    return CFG.currency && CFG.currency.code === 'ILS' ? text + ' ' + (CFG.currency.symbol || '₪') : (CFG.currency && CFG.currency.symbol || '₪') + text;
  }

  function productImage(line) {
    var p = line.p || {};
    var variantImg = p.variantImages && line.size && line.necklace ? p.variantImages[line.size.id + '|' + line.necklace.id] : '';
    return variantImg || (line.necklace ? line.necklace.image : ((p.images && p.images.length) ? p.images[0] : (p.cardImage || '')));
  }

  function pricingSummary(lines) {
    var subtotal = lines.reduce(function (sum, line) { return sum + line.unitPrice * line.qty; }, 0);
    var shipping = subtotal && CFG.shipping ? ((CFG.shipping.freeOver && subtotal >= CFG.shipping.freeOver) ? 0 : Number(CFG.shipping.flat || 0)) : 0;
    var pricing = window.VERSANS_PRICING;
    if (!pricing || !pricing.calculate) {
      return { subtotal: subtotal, discount: 0, discountRows: [], couponDiscount: 0, shipping: shipping, total: subtotal + shipping, totalSavings: 0 };
    }
    return pricing.calculate(lines, { lang: lang, shipping: shipping });
  }

  function secondItemDetailsHtml(row) {
    if (!row || row.type !== 'second-item' || !Array.isArray(row.details) || !row.details.length) return '';
    return '<div class="cart-discount-items">' + row.details.map(function (detail) {
      return '<div class="cart-discount-item">' +
        '<span class="cart-discount-item__name">' + esc(detail.label) + '</span>' +
        '<span class="cart-discount-item__saved">−' + money(detail.amount) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function discountRowsHtml(summary) {
    return (summary.discountRows || []).map(function (row) {
      var labelHtml = esc(row.label);
      if (row.type === 'second-item' && lang === 'he') {
        labelHtml = labelHtml.replace('כל', '<strong>כל</strong>');
      }
      return '<div class="cart-discount-group">' +
        '<div class="sum sum--discount"><span>' + labelHtml + '</span><span>−' + money(row.amount) + '</span></div>' +
        secondItemDetailsHtml(row) +
      '</div>';
    }).join('');
  }

  function savingsHtml(summary) {
    if (!(summary.totalSavings > 0)) return '';
    return '<div class="cart-savings-total"><span>' + (lang === 'he' ? 'סה״כ חסכתם' : 'Total savings') + '</span><strong>' + money(summary.totalSavings) + '</strong></div>';
  }

  function savingsBreakdownHtml(summary) {
    if (!(summary.totalSavings > 0)) return '';
    return '<div class="cart-savings-breakdown" data-cart-savings-breakdown>' +
      discountRowsHtml(summary) +
      savingsHtml(summary) +
    '</div>';
  }

  function pricingCardHtml(summary) {
    return '<div class="cart-pricing-card cart-pricing-card--compact">' +
      '<div class="sum cart-summary-subtotal"><span>' + (lang === 'he' ? 'סכום ביניים' : 'Subtotal') + '</span><span>' + money(summary.subtotal) + '</span></div>' +
      savingsBreakdownHtml(summary) +
      '<div class="sum cart-summary-shipping"><span>' + (lang === 'he' ? 'משלוח' : 'Shipping') + '</span><span>' + (summary.shipping ? money(summary.shipping) : (lang === 'he' ? 'חינם' : 'Free')) + '</span></div>' +
      '<div class="sum sum--payable"><span>' + (lang === 'he' ? 'לתשלום' : 'To pay') + '</span><strong>' + money(summary.total) + '</strong></div>' +
    '</div>';
  }

  function ensureDrawer() {
    var existing = document.getElementById('versansGlobalCartOverlay');
    if (existing) return existing;
    var overlay = document.createElement('div');
    overlay.className = 'ov ov--side';
    overlay.id = 'versansGlobalCartOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'versansGlobalCartTitle');
    overlay.innerHTML = '' +
      '<div class="ov__scrim" data-global-cart-close></div>' +
      '<div class="ov__panel">' +
        '<div class="drawer__head">' +
          '<h3 id="versansGlobalCartTitle">' + (lang === 'he' ? 'סל הקניות' : 'Shopping cart') + '</h3>' +
          '<button class="ov__close" type="button" data-global-cart-close aria-label="סגירת הסל" style="position:static">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="drawer__body" id="versansGlobalCartBody"></div>' +
        '<div class="drawer__foot" id="versansGlobalCartFoot" hidden></div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function render() {
    var overlay = ensureDrawer();
    var body = overlay.querySelector('#versansGlobalCartBody');
    var foot = overlay.querySelector('#versansGlobalCartFoot');
    var lines = Cart.lines();

    Cart.syncBadge();

    if (!lines.length) {
      body.innerHTML = '<div class="empty">' +
        '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M6 7h12l1.2 12.2a1.5 1.5 0 0 1-1.5 1.8H6.3a1.5 1.5 0 0 1-1.5-1.8L6 7z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>' +
        '<p>' + (lang === 'he' ? 'הסל עדיין ריק' : 'Your cart is empty') + '</p>' +
        '<button class="btn btn--ghost" type="button" data-global-cart-close style="margin-top:1.2rem">' + (lang === 'he' ? 'המשך בקניות' : 'Continue shopping') + '</button>' +
      '</div>';
      foot.hidden = true;
      return;
    }

    body.innerHTML = lines.map(function (line) {
      var meta = [];
      if (line.necklace) meta.push(L(line.necklace.label));
      if (line.box) meta.push(L(line.box.label));
      if (line.size) meta.push(L(line.size.label));
      if (line.color) meta.push(L(line.color.label));
      if (line.packaging) meta.push((lang === 'he' ? 'אריזה: ' : 'Packaging: ') + L(line.packaging.label));
      if (line.customName) meta.push((lang === 'he' ? 'שם: ' : 'Name: ') + line.customName);
      if (line.customPhoto) meta.push(lang === 'he' ? 'תמונה אישית ✓' : 'Custom photo ✓');
      if (line.pendingRequirements && line.pendingRequirements.length) meta.push(lang === 'he' ? 'נדרשת השלמת פרטים לפני התשלום' : 'Details must be completed before checkout');
      if (line.greeting) meta.push(lang === 'he' ? 'ברכה אישית (+35 ₪)' : 'Custom greeting (+₪35)');
      var image = productImage(line);
      return '<div class="line">' +
        '<div class="line__thumb">' + (image ? '<img src="' + esc(image) + '" alt="">' : '<span>V</span>') + '</div>' +
        '<div class="line__main">' +
          '<p class="line__name">' + esc(L(line.p.title) + (line.packaging ? (lang === 'he' ? ' + מארז LOVE FOREVER' : ' + LOVE FOREVER packaging') : '')) + '</p>' +
          (meta.length ? '<p class="line__meta">' + esc(meta.join(' · ')) + '</p>' : '') +
          '<p class="line__meta">' + money(line.unitPrice) + '</p>' +
          '<div class="line__row">' +
            '<div class="qty qty--sm">' +
              '<button type="button" data-global-cart-key="' + esc(line.key) + '" data-global-cart-delta="-1" aria-label="הפחתת כמות">−</button>' +
              '<span>' + line.qty + '</span>' +
              '<button type="button" data-global-cart-key="' + esc(line.key) + '" data-global-cart-delta="1" aria-label="הגדלת כמות">+</button>' +
            '</div>' +
            '<button class="line__rm" type="button" data-global-cart-remove="' + esc(line.key) + '">' + (lang === 'he' ? 'הסרה' : 'Remove') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var sum = pricingSummary(lines);
    foot.hidden = false;
    foot.innerHTML = '' +
      pricingCardHtml(sum) +
      '<button class="btn btn--primary btn--block cart-checkout-cta" type="button" data-global-cart-checkout>' + (lang === 'he' ? 'לתשלום מאובטח' : 'Secure checkout') + '</button>';
  }

  function open() {
    var overlay = ensureDrawer();
    render();
    overlay.classList.add('is-open');
    document.body.classList.add('is-locked');
  }

  function close() {
    var overlay = document.getElementById('versansGlobalCartOverlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    if (!document.querySelector('.ov.is-open')) document.body.classList.remove('is-locked');
  }

  document.addEventListener('click', function (event) {
    var cartButton = event.target.closest && event.target.closest('[data-cart-open], .product-cart-link');
    if (cartButton) {
      event.preventDefault();
      event.stopPropagation();
      open();
      return;
    }

    var closeButton = event.target.closest && event.target.closest('[data-global-cart-close]');
    if (closeButton) { event.preventDefault(); close(); return; }

    var qtyButton = event.target.closest && event.target.closest('[data-global-cart-key][data-global-cart-delta]');
    if (qtyButton) {
      var key = qtyButton.getAttribute('data-global-cart-key');
      var delta = parseInt(qtyButton.getAttribute('data-global-cart-delta'), 10) || 0;
      var line = Cart.lines().find(function (entry) { return entry.key === key; });
      if (line) Cart.setQty(key, line.qty + delta);
      render();
      return;
    }

    var removeButton = event.target.closest && event.target.closest('[data-global-cart-remove]');
    if (removeButton) {
      Cart.setQty(removeButton.getAttribute('data-global-cart-remove'), 0);
      render();
      return;
    }

    var checkout = event.target.closest && event.target.closest('[data-global-cart-checkout]');
    if (checkout) {
      try { sessionStorage.setItem('versans_open_checkout_v1', '1'); } catch (_) {}
      var target = '/shop#shop';
      if (window.VERSANS_URL_STATE && window.VERSANS_URL_STATE.navigate) window.VERSANS_URL_STATE.navigate(target);
      else window.location.href = target;
    }
  }, false);

  window.addEventListener('versans:cart-changed', function () {
    var overlay = document.getElementById('versansGlobalCartOverlay');
    if (overlay && overlay.classList.contains('is-open')) render();
  });
  window.addEventListener('pageshow', function () {
    Cart.syncBadge();
    var overlay = document.getElementById('versansGlobalCartOverlay');
    if (overlay && overlay.classList.contains('is-open')) render();
  });

  Cart.syncBadge();
})();
