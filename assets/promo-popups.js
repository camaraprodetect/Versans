(function () {
  'use strict';

  if (window.__VERSANS_PROMO_POPUPS_V1) return;
  window.__VERSANS_PROMO_POPUPS_V1 = true;

  var SESSION_COUNT_KEY = 'versans_promo_popup_count_v1';
  var SESSION_CART_KEY = 'versans_promo_cart_offer_v1';
  var SESSION_ROTATION_KEY = 'versans_promo_rotation_v1';
  var MAX_PERIODIC_PER_SESSION = 3;
  var FIRST_PERIODIC_DELAY = 32000;
  var NEXT_PERIODIC_DELAY = 115000;
  var periodicTimer = null;
  var cartTimer = null;
  var activePromo = null;
  var authPromise = null;
  var lastFocused = null;

  function ssGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }

  function ssSet(key, value) {
    try { sessionStorage.setItem(key, String(value)); } catch (_) {}
  }

  function sessionCount() {
    return Math.max(0, parseInt(ssGet(SESSION_COUNT_KEY), 10) || 0);
  }

  function setSessionCount(value) {
    ssSet(SESSION_COUNT_KEY, Math.max(0, value));
  }

  function getAuth() {
    if (authPromise) return authPromise;
    authPromise = fetch('/api/auth/me', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (data) {
      return data && data.user ? { user: data.user, guest: null } : { user: null, guest: data && data.guest ? data.guest : null };
    }).catch(function () {
      return { user: null, guest: null };
    });
    return authPromise;
  }

  function categories(line) {
    if (!line) return [];
    if (Array.isArray(line.categories)) return line.categories;
    if (line.p && Array.isArray(line.p.categories)) return line.p.categories;
    var category = line.category || (line.p && line.p.category);
    return category ? [category] : [];
  }

  function categoryQty(lines, category) {
    return (lines || []).reduce(function (sum, line) {
      return sum + (categories(line).indexOf(category) !== -1 ? Math.max(0, parseInt(line.qty, 10) || 0) : 0);
    }, 0);
  }

  var JEWELRY = ['greeting', 'necklaces', 'bracelets', 'rings', 'photo-bracelets', 'watches'];

  function jewelryQty(lines) {
    return (lines || []).reduce(function (sum, line) {
      var cats = categories(line);
      var match = cats.some(function (cat) { return JEWELRY.indexOf(cat) !== -1; });
      return sum + (match ? Math.max(0, parseInt(line.qty, 10) || 0) : 0);
    }, 0);
  }

  function cartLines() {
    try {
      var cart = window.VERSANS_CART_STATE;
      return cart && typeof cart.lines === 'function' ? cart.lines() : [];
    } catch (_) {
      return [];
    }
  }

  function loginHref() {
    var next = window.location.pathname + window.location.search + window.location.hash;
    return '/login?next=' + encodeURIComponent(next || '/');
  }

  function guestCartPromo() {
    return {
      id: 'guest-coupon',
      eyebrow: 'הטבה לחברי VerSans',
      title: 'עוד לא מחוברים? <strong>יש לכם קופון שמחכה</strong>',
      text: 'התחברו לחשבון, או הירשמו עכשיו. בהרשמה חדשה תקבלו למייל קוד קופון של 3% לקנייה הראשונה.',
      highlight: 'קוד קופון אישי נשלח למייל',
      cta: 'התחברות / הרשמה',
      href: loginHref(),
      fineprint: 'קופון ההצטרפות הוא חד־פעמי ותקף ל־14 יום.'
    };
  }

  function authenticatedCartPromo(lines) {
    var hats = categoryQty(lines, 'hats');
    var glasses = categoryQty(lines, 'glasses');
    var jewelry = jewelryQty(lines);
    var remJewelry = jewelry % 3;

    if (hats % 3 === 2) {
      return {
        id: 'cart-hats-3', eyebrow: 'כמעט בהטבה הבאה',
        title: 'עוד כובע אחד - <strong>3 ב־299.90 ₪</strong>',
        text: 'כבר יש לכם שני כובעים בסל. הוסיפו עוד אחד וקבלו את מחיר החבילה של 3 כובעים.',
        highlight: 'הכובע השלישי מוסיף רק 60 ₪ למחיר של 2',
        cta: 'לבחירת כובע נוסף', href: '/hats'
      };
    }

    if (glasses % 2 === 1) {
      return {
        id: 'cart-glasses-2', eyebrow: 'נשאר רק זוג אחד',
        title: 'הוסיפו עוד משקפיים - <strong>2 ב־249.90 ₪</strong>',
        text: 'אפשר לשלב בין דגמים שונים מקולקציית המשקפיים.',
        highlight: 'במקום 279.80 ₪',
        cta: 'לבחירת זוג נוסף', href: '/glasses'
      };
    }

    if (remJewelry === 2) {
      return {
        id: 'cart-jewelry-3', eyebrow: 'עוד פריט אחד וזה קורה',
        title: 'הוסיפו תכשיט נוסף - <strong>הזול מבין 3 במתנה</strong>',
        text: 'מבצע 2+1 חל על קולקציית התכשיטים המשתתפת, וההנחה מחושבת אוטומטית בסל.',
        highlight: '2+1 על קולקציית התכשיטים',
        cta: 'לבחירת תכשיט נוסף', href: '/'
      };
    }

    if (hats % 3 === 1) {
      return {
        id: 'cart-hats-2', eyebrow: 'חבל לפספס את מחיר הזוג',
        title: 'הוסיפו עוד כובע - <strong>2 ב־239.90 ₪</strong>',
        text: 'אפשר לבחור דגם אחר. ההטבה תחושב אוטומטית בסל.',
        highlight: 'חיסכון של 39.90 ₪ לעומת שני כובעים בודדים',
        cta: 'לבחירת כובע נוסף', href: '/hats'
      };
    }

    if (remJewelry === 1) {
      return {
        id: 'cart-jewelry-2more', eyebrow: 'התחלתם שלישייה',
        title: 'עוד 2 תכשיטים - <strong>והזול מבין ה־3 במתנה</strong>',
        text: 'אפשר לשלב בין התכשיטים המשתתפים במבצע 2+1.',
        highlight: '2+1 על קולקציית התכשיטים',
        cta: 'להמשך לקולקציה', href: '/'
      };
    }

    return {
      id: 'cart-member-jewelry', eyebrow: 'הטבה שכדאי לזכור',
      title: '<strong>2+1</strong> על קולקציית התכשיטים',
      text: 'בחרו 3 פריטים משתתפים והפריט הזול מביניהם יתקבל במתנה. ההנחה מחושבת אוטומטית.',
      highlight: 'אפשר לשלב בין דגמים שונים',
      cta: 'לכל התכשיטים', href: '/'
    };
  }

  var PERIODIC_PROMOS = [
    {
      id: 'periodic-jewelry', eyebrow: 'מבצע VerSans',
      title: '<strong>2+1</strong> על קולקציית התכשיטים',
      text: 'בוחרים 3 תכשיטים משתתפים - והזול מביניהם במתנה. אין צורך בקוד קופון.',
      highlight: 'ההנחה מתעדכנת אוטומטית בסל',
      cta: 'לבחירת תכשיטים', href: '/'
    },
    {
      id: 'periodic-glasses', eyebrow: 'זוג אחד זה רק ההתחלה',
      title: '2 דגמי משקפיים ב־<strong>249.90 ₪</strong>',
      text: 'שלבו בין דגמים שונים מקולקציית משקפי השמש וקבלו את מחיר הזוג.',
      highlight: 'במקום 279.80 ₪',
      cta: 'למשקפי השמש', href: '/glasses'
    },
    {
      id: 'periodic-hats', eyebrow: 'מחיר חבילה',
      title: '3 כובעים ב־<strong>299.90 ₪</strong>',
      text: 'בחרו שלושה כובעים מהקולקציה - אפשר לשלב בין דגמים שונים.',
      highlight: 'ויש גם 2 כובעים ב־239.90 ₪',
      cta: 'לקולקציית הכובעים', href: '/hats'
    }
  ];

  function ensureLayer() {
    var layer = document.getElementById('versansPromoLayer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'versansPromoLayer';
    layer.className = 'vs-promo-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="vs-promo-layer__scrim" data-vs-promo-close></div>' +
      '<section class="vs-promo-card" role="dialog" aria-modal="true" aria-labelledby="versansPromoTitle">' +
        '<button class="vs-promo-card__close" type="button" data-vs-promo-close aria-label="סגירת ההטבה">×</button>' +
        '<div class="vs-promo-card__body" data-vs-promo-content></div>' +
      '</section>';
    document.body.appendChild(layer);
    return layer;
  }

  function isBlockingUiOpen() {
    if (activePromo) return true;
    if (document.querySelector('#checkoutOverlay.is-open, .checkout-overlay.is-open, [data-checkout-modal].is-open')) return true;
    return false;
  }

  function showPromo(promo, options) {
    if (!promo || isBlockingUiOpen()) return false;
    var layer = ensureLayer();
    var content = layer.querySelector('[data-vs-promo-content]');
    var fine = promo.fineprint ? '<p class="vs-promo-card__fineprint">' + promo.fineprint + '</p>' : '';
    content.innerHTML =
      '<p class="vs-promo-card__eyebrow">' + promo.eyebrow + '</p>' +
      '<h2 class="vs-promo-card__title" id="versansPromoTitle">' + promo.title + '</h2>' +
      '<p class="vs-promo-card__text">' + promo.text + '</p>' +
      (promo.highlight ? '<div class="vs-promo-card__highlight">✦ ' + promo.highlight + '</div>' : '') +
      '<div class="vs-promo-card__actions">' +
        '<a class="vs-promo-card__cta" href="' + promo.href + '" data-vs-promo-cta>' + promo.cta + '</a>' +
        '<button class="vs-promo-card__later" type="button" data-vs-promo-close>אולי אחר כך</button>' +
      '</div>' + fine;

    activePromo = promo;
    lastFocused = document.activeElement;
    layer.setAttribute('data-promo-id', promo.id || 'promo');
    layer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () {
      layer.classList.add('is-open');
      var close = layer.querySelector('.vs-promo-card__close');
      if (close) close.focus({ preventScroll: true });
    });

    if (options && options.periodic) {
      setSessionCount(sessionCount() + 1);
    }
    return true;
  }

  function closePromo() {
    var layer = document.getElementById('versansPromoLayer');
    if (!layer || !activePromo) return;
    activePromo = null;
    layer.classList.remove('is-open');
    layer.setAttribute('aria-hidden', 'true');
    window.setTimeout(function () {
      if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus({ preventScroll: true }); } catch (_) {}
      }
      lastFocused = null;
    }, 220);
  }

  function cartIsOpen() {
    return !!document.querySelector('#cartOverlay.is-open, #versansGlobalCartOverlay.is-open');
  }

  function maybeShowCartOffer() {
    if (!cartIsOpen()) return;
    if (ssGet(SESSION_CART_KEY) === '1') return;
    if (activePromo) return;
    ssSet(SESSION_CART_KEY, '1');
    getAuth().then(function (auth) {
      if (!cartIsOpen() || activePromo) return;
      var promo = auth && auth.user ? authenticatedCartPromo(cartLines()) : guestCartPromo();
      showPromo(promo, { cart: true });
    });
  }

  function scheduleCartOffer() {
    if (ssGet(SESSION_CART_KEY) === '1') return;
    if (cartTimer) window.clearTimeout(cartTimer);
    cartTimer = window.setTimeout(maybeShowCartOffer, 420);
  }

  function currentPeriodicPromo() {
    var index = Math.max(0, parseInt(ssGet(SESSION_ROTATION_KEY), 10) || 0) % PERIODIC_PROMOS.length;
    ssSet(SESSION_ROTATION_KEY, index + 1);
    return PERIODIC_PROMOS[index];
  }

  function canShowPeriodic() {
    if (document.hidden || activePromo || cartIsOpen()) return false;
    if (sessionCount() >= MAX_PERIODIC_PER_SESSION) return false;
    if (document.querySelector('input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus')) return false;
    if (document.querySelector('.ov.is-open, [role="dialog"].is-open, .modal.is-open')) return false;
    return true;
  }

  function runPeriodic() {
    periodicTimer = null;
    if (canShowPeriodic()) showPromo(currentPeriodicPromo(), { periodic: true });
    schedulePeriodic(NEXT_PERIODIC_DELAY);
  }

  function schedulePeriodic(delay) {
    if (periodicTimer || sessionCount() >= MAX_PERIODIC_PER_SESSION) return;
    periodicTimer = window.setTimeout(runPeriodic, delay);
  }

  function start() {
    ensureLayer();
    schedulePeriodic(FIRST_PERIODIC_DELAY);

    document.addEventListener('click', function (event) {
      var close = event.target.closest && event.target.closest('[data-vs-promo-close]');
      if (close) {
        event.preventDefault();
        closePromo();
        return;
      }

      var cta = event.target.closest && event.target.closest('[data-vs-promo-cta]');
      if (cta) closePromo();

      var cartButton = event.target.closest && event.target.closest('#cartBtn, [data-cart-open], .product-cart-link, .vs-floating-cart');
      if (cartButton) scheduleCartOffer();
    }, true);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && activePromo) closePromo();
    });

    if (window.MutationObserver && document.body) {
      var observer = new MutationObserver(function () {
        if (cartIsOpen()) scheduleCartOffer();
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !periodicTimer && sessionCount() < MAX_PERIODIC_PER_SESSION) {
        schedulePeriodic(NEXT_PERIODIC_DELAY);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
