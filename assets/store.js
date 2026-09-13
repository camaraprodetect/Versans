/* ============================================================================
   לוגיקת החנות
   אין צורך לגעת בקובץ הזה כדי להוסיף מוצרים — רק ב-products.js
   ============================================================================ */
(function () {
  'use strict';

  var CFG = window.STORE_CONFIG;
  var LS = { lang: 'kw_lang', cart: 'kw_cart', pending: 'kw_pending' };

  var state = {
    lang: 'he',
    cart: JSON.parse(read(LS.cart) || '[]'),
    filter: 'all',
    openFilterGroup: null,
    pdp: null,
    qty: 1
  };

  /* ---------- עזרים ------------------------------------------------------ */
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(key) {
    var d = I18N.he;
    return d[key] != null ? d[key] : key;
  }
  function L(obj) { return obj ? (obj.he || '') : ''; }
  function money(n) {
    var v = (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
    return CFG.currency.code === 'ILS' ? v + ' ' + CFG.currency.symbol : CFG.currency.symbol + v;
  }
  function byId(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function isGlassesProduct(p) {
    var collections = p && Array.isArray(p.categories) && p.categories.length ? p.categories : [p && p.category];
    return collections.indexOf('glasses') !== -1;
  }
  function isCurrentGlassesCollectionProduct(p) {
    if (!isGlassesProduct(p)) return false;
    var match = /^product-(\d+)$/.exec(String((p && p.slug) || ''));
    return !match || Number(match[1]) >= 31;
  }

  /* Keep the sunglasses visually mixed in every catalog view without making
     the order jump around on each render. Non-glasses keep their exact slots. */
  var GLASSES_SHUFFLE_SEED = 20260912;
  function glassesShuffleKey(p) {
    var text = String(GLASSES_SHUFFLE_SEED) + ':' + String((p && (p.id || p.slug)) || '');
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function shuffleGlassesWithinList(list) {
    var glasses = list.filter(function (p) { return isGlassesProduct(p); });
    if (glasses.length < 2) return list.slice();

    glasses.sort(function (a, b) {
      var d = glassesShuffleKey(a) - glassesShuffleKey(b);
      if (d) return d;
      return String(a.id || a.slug || '').localeCompare(String(b.id || b.slug || ''));
    });

    var nextGlass = 0;
    return list.map(function (p) {
      if (!isGlassesProduct(p)) return p;
      return glasses[nextGlass++];
    });
  }

  /* ---------- שפה -------------------------------------------------------- */
  function applyLang() {
    var html = document.documentElement;
    html.lang = 'he';
    html.dir = 'rtl';

    document.title = t('meta.title');
    var ogTitle = $('meta[property="og:title"]'); if (ogTitle) ogTitle.setAttribute('content', t('meta.title'));
    var md = $('meta[name="description"]'); if (md) md.setAttribute('content', t('meta.desc'));

    $$('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });
    $$('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    $$('[data-brand]').forEach(function (el) { el.textContent = L(CFG.brand.name); });

    var bn = $('#brandName'); if (bn) bn.textContent = L(CFG.brand.name);
    var lb = $('#langBtn'); if (lb) lb.textContent = t('nav.lang');

    var ph = $('#f_notes'); if (ph) ph.placeholder = t('co.notes.ph');

    renderHeroCard();
    renderFilters();
    renderGrid();
    renderFooterContact();
    renderCart();
    if (state.pdp) renderPdp(state.pdp);
    save(LS.lang, state.lang);
  }

  /* ---------- הירו ------------------------------------------------------- */
  function renderHeroCard() {
    var p = PRODUCTS[0];
    if (!p) return;
    var a = $('#heroCardTitle'), b = $('#heroCardBody'), c = $('#heroCardSign');
    if (a) a.textContent = L(p.cardTitle);
    if (b) b.textContent = L(p.cardMessage);
    if (c) c.textContent = L(p.signature);
  }

  /* ---------- קטלוג ------------------------------------------------------ */
  function renderGlassesCollectionBanner() {
    var glassesBanner = $('#glassesCollectionBanner');
    if (glassesBanner) {
      glassesBanner.hidden = !(state.filter === 'glasses' || state.filter.indexOf('glasses-') === 0);
    }

    var watchesBanner = $('#watchesCollectionBanner');
    if (watchesBanner) {
      watchesBanner.hidden = !(state.filter === 'watches' || state.filter.indexOf('watches-') === 0);
    }

    var otherCollectionsBanner = $('#otherCollectionsBanner');
    if (otherCollectionsBanner) {
      var showOtherCollectionsBanner =
        state.filter === 'all' ||
        state.filter === 'greeting' || state.filter.indexOf('greeting-') === 0 ||
        state.filter === 'necklaces' ||
        state.filter === 'bracelets' ||
        state.filter === 'photo-bracelets' ||
        state.filter === 'gift-boxes' ||
        state.filter === 'custom' ||
        state.filter === 'sets';
      otherCollectionsBanner.hidden = !showOtherCollectionsBanner;
    }
  }

  function renderFilters() {
    var wrap = $('#filters');
    if (!wrap) return;
    wrap.innerHTML = CATEGORIES.map(function (c) {
      var active = state.filter === c.key;
      var children = Array.isArray(c.children) ? c.children : [];
      if (!children.length) {
        return '<button class="chip' + (active ? ' is-on' : '') + '" data-cat="' + esc(c.key) + '" aria-pressed="' + active + '">' +
               '<span>' + esc(L(c.label)) + '</span></button>';
      }

      var expanded = state.openFilterGroup === c.key;
      var childSelected = children.some(function (child) { return state.filter === child.key; });
      var groupActive = active || childSelected;
      var childHtml = children.map(function (child) {
        var childActive = state.filter === child.key;
        return '<button class="chip chip--sub' + (childActive ? ' is-on' : '') + '" data-cat="' + esc(child.key) + '" data-parent-group="' + esc(c.key) + '" aria-pressed="' + childActive + '">' +
               '<span>' + esc(L(child.label)) + '</span><span class="chip__sub-arrow" aria-hidden="true">↳</span></button>';
      }).join('');

      return '<div class="filter-group' + (expanded ? ' is-open' : '') + '">' +
        '<button class="chip chip--group' + (groupActive ? ' is-on' : '') + (expanded ? ' is-expanded' : '') + '" data-cat="' + esc(c.key) + '" data-group="' + esc(c.key) + '" aria-pressed="' + active + '" aria-expanded="' + expanded + '">' +
          '<span>' + esc(L(c.label)) + '</span><span class="chip__group-icon" aria-hidden="true">' + (expanded ? '−' : '+') + '</span>' +
        '</button>' +
        '<div class="filter-group__children"' + (expanded ? '' : ' hidden') + '>' + childHtml + '</div>' +
      '</div>';
    }).join('');
    renderGlassesCollectionBanner();
  }

  function scrollCatalogTop() {
    var shop = $('#shop');
    if (!shop) return;
    var nav = $('#nav');
    var navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height) : 0;
    var top = window.pageYOffset + shop.getBoundingClientRect().top - navHeight - 8;
    window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'auto' });
  }

  function mobileImagesForProduct(p, firstImg, firstHoverImg) {
    var out = [];
    function add(src) {
      if (src && out.indexOf(src) === -1) out.push(src);
    }
    function addList(list) {
      if (!Array.isArray(list)) return;
      list.forEach(function (item) {
        if (typeof item === 'string') add(item);
        else if (item && item.image) add(item.image);
      });
    }

    /* Start with the exact image pair used by the current collection card,
       then continue through every image/variant the product owns. */
    add(firstImg);
    add(firstHoverImg);
    addList(p.images);
    add(p.hoverImage);
    addList(p.necklaces);
    addList(p.boxes);
    addList(p.colors);
    return out;
  }

  function productColorMetaHTML(p) {
    if (!(p && Array.isArray(p.colors) && p.colors.length)) return '';
    var max = 6;
    var items = p.colors.slice(0, max).map(function (option) {
      var style = option.swatch ? ' style="background:' + esc(option.swatch) + '"' : '';
      return '<span class="prod__variant-swatch"' + style + ' aria-hidden="true"></span>';
    }).join('');
    var extra = p.colors.length > max ? '<span class="prod__variant-more">+' + (p.colors.length - max) + '</span>' : '';
    var text = state.lang === 'he'
      ? p.colors.length + ' צבעים לבחירה'
      : p.colors.length + ' colors available';
    return '<div class="prod__variant-hint"><div class="prod__variant-swatches" aria-hidden="true">' + items + extra + '</div><span class="prod__variant-text">' + esc(text) + '</span></div>';
  }

  function mediaHTML(p, big) {
    var img = p.cardImage || ((p.images && p.images.length) ? p.images[0] : '');
    var hoverImg = p.hoverImage || '';

    /* בכרטיסי קולקציות נשים בלבד: יוניסקס מוצג קודם על אישה,
       וב-hover עוברים לצילום נקי של התכשיט. בעמוד "הכל" ובדף המוצר
       נשמר סדר התמונות המקורי. */
    var isWomenCollection = !big && (state.filter === 'mom' || state.filter === 'wife' || state.filter === 'daughter' || state.filter === 'sister');
    if (isWomenCollection && p.collectionMedia && p.collectionMedia.women) {
      img = p.collectionMedia.women.image || img;
      hoverImg = p.collectionMedia.women.hoverImage || '';
    }

    /* בקולקציית גברים: מוצרי יוניסקס מוצגים קודם על גבר,
       וב-hover עוברים לצילום נקי של התכשיט בלבד. */
    var isMenCollection = !big && state.filter === 'men';
    if (isMenCollection && p.collectionMedia && p.collectionMedia.men) {
      img = p.collectionMedia.men.image || img;
      hoverImg = p.collectionMedia.men.hoverImage || '';
    }
    if (img) {
      var mobileImages = !big ? mobileImagesForProduct(p, img, hoverImg) : [];
      var mobileData = mobileImages.length > 1 ? ' data-mobile-images="' + esc(encodeURIComponent(JSON.stringify(mobileImages))) + '" data-mobile-index="0"' : '';
      var html = '<img class="prod__img prod__img--main" src="' + esc(img) + '" alt="' + esc(L(p.title)) + '" loading="lazy"' + mobileData + '>';
      if (hoverImg && hoverImg !== img) {
        html += '<img class="prod__img prod__img--hover" src="' + esc(hoverImg) + '" alt="" loading="lazy" aria-hidden="true">';
      }
      if (!big && mobileImages.length > 1) {
        var prevLabel = state.lang === 'he' ? 'לתמונה הקודמת' : 'Previous image';
        var nextLabel = state.lang === 'he' ? 'לתמונה הבאה' : 'Next image';
        html += '<span class="prod__mobile-arrow prod__mobile-arrow--prev" role="button" tabindex="0" data-mobile-slide="prev" aria-label="' + esc(prevLabel) + '">‹</span>' +
                '<span class="prod__mobile-arrow prod__mobile-arrow--next" role="button" tabindex="0" data-mobile-slide="next" aria-label="' + esc(nextLabel) + '">›</span>';
      }
      return html;
    }
    var msg = L(p.cardMessage);
    if (!big && msg.length > 110) msg = msg.slice(0, 110).replace(/\s\S*$/, '') + '…';
    return '<div class="prod__ph"><span class="prod__ph-title">' + esc(L(p.cardTitle)) +
           '</span><span class="prod__ph-text">' + esc(msg) + '</span></div>';
  }

  function renderGrid() {
    var grid = $('#grid');
    if (!grid) return;
    var list = PRODUCTS.filter(function (p) {
      if (state.filter === 'all') return true;
      if (state.filter.indexOf('glasses') === 0 && !isCurrentGlassesCollectionProduct(p)) return false;
      var collections = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
      return collections.indexOf(state.filter) !== -1;
    });
    list = shuffleGlassesWithinList(list);

    if (!list.length) { grid.innerHTML = '<p class="empty">' + esc(t('shop.empty')) + '</p>'; return; }

    grid.innerHTML = list.map(function (p) {
      var badge = L(p.badge);
      var isGlasses = isGlassesProduct(p);
      return '' +
      '<article class="prod">' +
        (badge ? '<span class="prod__badge">' + esc(badge) + '</span>' : '') +
        '<a class="prod__media prod__link" href="product.html?id=' + encodeURIComponent(p.id) + '" aria-label="' + esc(L(p.title)) + '">' + mediaHTML(p) + '</a>' +
        '<div class="prod__body">' +
          '<h3 class="prod__name"><a class="prod__titlelink" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(L(p.title)) + '</a></h3>' +
          (isGlasses ? '' : '<p class="prod__sub">' + esc(L(p.subtitle)) + '</p>') +
          productColorMetaHTML(p) +
          '<p class="prod__price">' + (p.startingPrice ? (state.lang === 'he' ? 'החל מ־' : 'From ') : '') + money(p.price) +
            (p.compareAt ? '<span class="prod__was">' + money(p.compareAt) + '</span>' : '') +
          '</p>' +
          '<div class="prod__actions">' +
            ((p.necklaces && p.necklaces.length && p.boxes && p.boxes.length)
              ? '<a class="btn btn--primary" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(state.lang === 'he' ? 'לבחירת אפשרויות' : 'Choose options') + '</a>'
              : (p.customName && p.customName.required
                ? '<a class="btn btn--primary" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(state.lang === 'he' ? 'לעיצוב אישי' : 'Customize') + '</a>'
                : ((p.sizes && p.sizes.length)
                  ? '<a class="btn btn--primary" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(state.lang === 'he' ? 'לבחירת אורך' : 'Choose length') + '</a>'
                  : ((p.colors && p.colors.length)
                    ? '<a class="btn btn--primary" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(state.lang === 'he' ? 'לבחירת צבע' : 'Choose color') + '</a>'
                    : (p.cardMode === 'view'
                    ? '<a class="btn btn--primary" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(state.lang === 'he' ? 'לצפייה במוצר' : 'View product') + '</a>'
                    : '<button class="btn btn--primary" data-add="' + esc(p.id) + '">' + esc(t('card.add')) + '</button>'))))) +
            (isGlasses ? '' : '<a class="btn btn--ghost" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc((p.cardMode === 'view') ? (state.lang === 'he' ? 'עוד תמונות' : 'More photos') : t('card.read')) + '</a>') +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  /* ---------- מודאל מוצר ------------------------------------------------- */
  function renderPdp(p) {
    state.pdp = p;
    var imgs = p.images || [];
    var details = (p.details && p.details.he) || [];
    var check = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12.5l5 5L20 6.5"/></svg>';

    $('#pdp').innerHTML = '' +
    '<div class="pdp">' +
      '<div class="pdp__media" id="pdpMedia">' + mediaHTML(p, true) +
        (imgs.length > 1 ? '<div class="pdp__thumbs">' + imgs.map(function (src, i) {
          return '<button data-img="' + esc(src) + '" class="' + (i === 0 ? 'is-on' : '') + '" aria-label="' + (i + 1) + '"><img src="' + esc(src) + '" alt=""></button>';
        }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="pdp__body">' +
        '<h3 class="pdp__name" id="pdpName">' + esc(L(p.title)) + '</h3>' +
        '<p class="pdp__sub">' + esc(L(p.subtitle)) + '</p>' +
        '<p class="pdp__price">' + money(p.price) + (p.compareAt ? '<span class="prod__was">' + money(p.compareAt) + '</span>' : '') + '</p>' +
        '<div class="pdp__quote"><h4>' + esc(t('modal.message')) + '</h4><p>' + esc(L(p.cardMessage)) +
          '</p><p style="margin-top:.6rem;font-weight:700">' + esc(L(p.signature)) + '</p></div>' +
        '<ul class="pdp__list">' + details.map(function (d) {
          return '<li>' + check + '<span>' + esc(d) + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="pdp__buy">' +
          '<div class="qty" role="group" aria-label="' + esc(t('modal.qty')) + '">' +
            '<button type="button" data-q="-1" aria-label="-">−</button>' +
            '<span id="pdpQty">' + state.qty + '</span>' +
            '<button type="button" data-q="1" aria-label="+">+</button>' +
          '</div>' +
          '<button class="btn btn--primary" style="flex:1" data-add-modal="' + esc(p.id) + '">' + esc(t('card.add')) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function openPdp(id) {
    var p = byId(id);
    if (!p) return;
    state.qty = 1;
    renderPdp(p);
    openOv('#pdpOverlay');
  }

  /* ---------- סל --------------------------------------------------------- */
  function optionById(list, id) {
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function cartItemKey(it) {
    return it.key || (it.id + '|' + (it.necklace || '') + '|' + (it.box || '') + '|' + (it.size || '') + '|' + (it.color || '') + '|pack:' + (it.packaging || '') + '|' + (it.customName || '') + '|p:' + (it.customPhoto && it.customPhoto.assetId || '') + '|g:' + (it.greeting ? JSON.stringify(it.greeting) : ''));
  }
  function cartLines() {
    return state.cart.map(function (it) {
      var p = byId(it.id);
      if (!p) return null;
      var necklace = optionById(p.necklaces, it.necklace);
      var box = optionById(p.boxes, it.box);
      var size = optionById(p.sizes, it.size);
      var color = optionById(p.colors, it.color);
      var packaging = it.packaging && p.giftPackaging ? optionById(p.giftPackaging.options, it.packaging) : null;
      var invalidPackaging = !!(it.packaging && (!p.giftPackaging || !packaging));
      var needsNecklace = Array.isArray(p.necklaces) && p.necklaces.length;
      var needsBox = Array.isArray(p.boxes) && p.boxes.length;
      var needsSize = Array.isArray(p.sizes) && p.sizes.length;
      var needsColor = Array.isArray(p.colors) && p.colors.length;
      var needsCustomName = !!(p.customName && p.customName.required);
      var needsCustomPhoto = !!(p.customPhoto && p.customPhoto.required);
      var customName = String(it.customName || '').trim();
      var customPhoto = it.customPhoto && typeof it.customPhoto === 'object' ? it.customPhoto : null;
      var companionReady = !(p.requiresCompanion && p.requiresCompanion.required && Array.isArray(p.requiresCompanion.productIds) && p.requiresCompanion.productIds.length) || state.cart.some(function (candidate) {
        return candidate && p.requiresCompanion.productIds.indexOf(candidate.id) !== -1;
      });
      if ((needsNecklace && !necklace) || (needsBox && !box) || (needsSize && !size) || (needsColor && !color) || invalidPackaging || !companionReady || (needsCustomName && !customName) || (needsCustomPhoto && (!customPhoto || !customPhoto.assetId))) return null;
      var extra = box ? Number(box.addPrice || 0) : 0;
      var sizeExtra = size ? Number(size.addPrice || 0) : 0;
      var packagingExtra = packaging ? Number(packaging.addPrice || 0) : 0;
      var greetingExtra = (it.greeting && typeof it.greeting === 'object') ? 35 : 0;
      return {
        p: p,
        item: it,
        key: cartItemKey(it),
        qty: parseInt(it.qty, 10) || 1,
        necklace: necklace,
        box: box,
        size: size,
        color: color,
        packaging: packaging,
        customName: customName,
        customPhoto: customPhoto,
        greeting: it.greeting && typeof it.greeting === 'object' ? it.greeting : null,
        unitPrice: Number(p.price) + extra + sizeExtra + packagingExtra + greetingExtra
      };
    }).filter(Boolean);
  }
  function subtotal() {
    return cartLines().reduce(function (s, l) { return s + l.unitPrice * l.qty; }, 0);
  }
  function promotionDiscount() {
    var lines = cartLines();
    var unitPrices = [];
    var glassesUnits = 0;

    lines.forEach(function (l) {
      for (var i = 0; i < l.qty; i++) unitPrices.push(Number(l.unitPrice) || 0);
      var collections = Array.isArray(l.p.categories) && l.p.categories.length ? l.p.categories : [l.p.category];
      if (collections.indexOf('glasses') !== -1) glassesUnits += l.qty;
    });

    var secondItem = 0;
    if (unitPrices.length >= 2) {
      var cheapest = Math.min.apply(Math, unitPrices);
      secondItem = Math.round(cheapest * 25) / 100;
    }

    /* מבצע המשקפיים גובר על מבצע המוצר השני: 139.90 ₪ ליחידה, 2 ב־249.90 ₪. */
    var glassesPairs = Math.floor(glassesUnits / 2);
    var glassesBundle = window.VERSANS_GLASSES_PRICING
      ? window.VERSANS_GLASSES_PRICING.discountForUnits(glassesUnits, 139.9)
      : Math.round(glassesPairs * 29.9 * 100) / 100;

    if (glassesPairs > 0) {
      return {
        amount: glassesBundle,
        label: state.lang === 'he' ? 'מבצע משקפיים — 2 ב־249.90 ₪' : 'Sunglasses offer — 2 for ₪249.90',
        type: 'glasses-bundle'
      };
    }
    return {
      amount: secondItem,
      label: state.lang === 'he' ? '25% הנחה על המוצר השני' : '25% off the second item',
      type: secondItem > 0 ? 'second-item' : ''
    };
  }
  function secondItemDiscount() {
    return promotionDiscount().amount;
  }
  function shippingCost() {
    var s = subtotal();
    if (!s) return 0;
    return (CFG.shipping.freeOver && s >= CFG.shipping.freeOver) ? 0 : CFG.shipping.flat;
  }
  function orderTotal() {
    return Math.max(0, subtotal() - secondItemDiscount() + shippingCost());
  }
  function count() { return cartLines().reduce(function (s, l) { return s + l.qty; }, 0); }

  function addToCart(id, qty) {
    qty = qty || 1;
    var product = byId(id);
    if (product && ((product.necklaces && product.necklaces.length) || (product.boxes && product.boxes.length) || (product.sizes && product.sizes.length) || (product.colors && product.colors.length) || (product.customName && product.customName.required) || (product.customPhoto && product.customPhoto.required) || product.giftPackaging || product.requiresCompanion)) {
      window.location.href = 'product.html?id=' + encodeURIComponent(id);
      return;
    }
    var key = id + '|||';
    var found = false;
    state.cart.forEach(function (i) {
      if (cartItemKey(i) === key) { i.qty += qty; i.key = key; found = true; }
    });
    if (!found) state.cart.push({ id: id, qty: qty, key: key });
    persist();
    toast(t('card.added'));
  }
  function setQty(key, q) {
    if (q <= 0) {
      state.cart = state.cart.filter(function (i) { return cartItemKey(i) !== key; });
    } else {
      state.cart.forEach(function (i) { if (cartItemKey(i) === key) i.qty = q; });
    }
    persist();
  }
  function cleanupDependentItems() {
    /* Migrate carts created by the previous flow: LOVE FOREVER must be stored on the necklace line, never as a separate item. */
    var standalonePackages = state.cart.filter(function (item) { return item && item.id === 'love-forever-rose-gift-box-01'; });
    standalonePackages.forEach(function (packageItem) {
      var packageProduct = byId(packageItem.id);
      if (!packageProduct || !packageProduct.requiresCompanion || !Array.isArray(packageProduct.requiresCompanion.productIds)) return;
      var colorId = packageItem.color || 'pink';
      var necklace = state.cart.find(function (candidate) {
        return candidate && packageProduct.requiresCompanion.productIds.indexOf(candidate.id) !== -1 && !candidate.packaging;
      });
      if (necklace) {
        necklace.packaging = colorId;
        delete necklace.key;
      }
    });
    state.cart = state.cart.filter(function (item) { return item && item.id !== 'love-forever-rose-gift-box-01'; });

    state.cart = state.cart.filter(function (item) {
      var p = byId(item.id);
      if (!p || !(p.requiresCompanion && p.requiresCompanion.required && Array.isArray(p.requiresCompanion.productIds) && p.requiresCompanion.productIds.length)) return true;
      return false;
    });
  }
  function persist() {
    cleanupDependentItems();
    save(LS.cart, JSON.stringify(state.cart));
    renderCart();
    var n = count(), el = $('#cartCount');
    if (el) { el.textContent = n; el.hidden = n === 0; }
  }

  function renderCart() {
    var body = $('#cartBody'), foot = $('#cartFoot');
    if (!body) return;
    var lines = cartLines();

    if (!lines.length) {
      body.innerHTML = '<div class="empty">' +
        '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 7h12l1.2 12.2a1.5 1.5 0 0 1-1.5 1.8H6.3a1.5 1.5 0 0 1-1.5-1.8L6 7z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>' +
        '<p>' + esc(t('cart.empty')) + '</p>' +
        '<a class="btn btn--ghost" href="#shop" data-close style="margin-top:1.2rem">' + esc(t('cart.empty.cta')) + '</a></div>';
      if (foot) foot.hidden = true;
      return;
    }

    body.innerHTML = lines.map(function (l) {
      var variantImg = l.p.variantImages && l.size && l.necklace ? l.p.variantImages[l.size.id + '|' + l.necklace.id] : '';
      var img = variantImg || (l.necklace ? l.necklace.image : ((l.p.images && l.p.images.length) ? l.p.images[0] : ''));
      var meta = [];
      if (l.necklace) meta.push(L(l.necklace.label));
      if (l.box) meta.push(L(l.box.label));
      if (l.size) meta.push(L(l.size.label));
      if (l.color) meta.push(L(l.color.label));
      if (l.packaging) meta.push((state.lang === 'he' ? 'אריזה: ' : 'Packaging: ') + L(l.packaging.label));
      if (l.customName) { var customLabel = l.p.customName && L(l.p.customName.cartLabel); meta.push((customLabel || (state.lang === 'he' ? 'שם' : 'Name')) + ': ' + l.customName); }
      if (l.customPhoto) { var photoLabel = l.p.customPhoto && L(l.p.customPhoto.cartLabel); meta.push((photoLabel || (state.lang === 'he' ? 'תמונה אישית' : 'Custom photo')) + ' ✓'); }
      if (l.greeting) meta.push(state.lang === 'he' ? 'ברכה אישית (+35 ₪)' : 'Custom greeting (+₪35)');
      return '<div class="line">' +
        '<div class="line__thumb">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<span>' + esc(L(l.p.cardTitle)) + '</span>') + '</div>' +
        '<div class="line__main">' +
          '<p class="line__name">' + esc(L(l.p.title) + (l.packaging ? (state.lang === 'he' ? ' + מארז LOVE FOREVER' : ' + LOVE FOREVER packaging') : '')) + '</p>' +
          (meta.length ? '<p class="line__meta">' + esc(meta.join(' · ')) + '</p>' : '') +
          '<p class="line__meta">' + money(l.unitPrice) + '</p>' +
          '<div class="line__row">' +
            '<div class="qty qty--sm">' +
              '<button type="button" data-line="' + esc(l.key) + '" data-delta="-1" aria-label="-">−</button>' +
              '<span>' + l.qty + '</span>' +
              '<button type="button" data-line="' + esc(l.key) + '" data-delta="1" aria-label="+">+</button>' +
            '</div>' +
            '<button class="line__rm" data-remove="' + esc(l.key) + '">' + esc(t('cart.remove')) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var promo = promotionDiscount();
    var s = subtotal(), discount = promo.amount, sh = shippingCost(), total = orderTotal();
    foot.hidden = false;
    foot.innerHTML =
      '<div class="sum"><span>' + esc(t('cart.subtotal')) + '</span><span>' + money(s) + '</span></div>' +
      (discount > 0 ? '<div class="sum sum--discount"><span>' + esc(promo.label) + '</span><span>−' + money(discount) + '</span></div>' : '') +
      '<div class="sum"><span>' + esc(t('cart.shipping')) + '</span><span>' + (sh ? money(sh) : esc(t('cart.free'))) + '</span></div>' +
      '<p class="cart-split-note">' + esc(state.lang === 'he'
        ? 'בהזמנה הכוללת מספר פריטים, המוצרים עשויים להגיע בנפרד כדי לא לעכב את האספקה. ללא עלות נוספת.'
        : 'Orders containing multiple items may arrive separately so delivery is not delayed. There is no additional charge.') + '</p>' +
      '<div class="sum sum--total"><span>' + esc(t('cart.total')) + '</span><span>' + money(total) + '</span></div>' +
      '<button class="btn btn--primary btn--block" id="goCheckout" style="margin-top:1rem">' + esc(t('cart.checkout')) + '</button>';
  }

  /* ---------- קופה ------------------------------------------------------- */
  function renderSummary() {
    var promo = promotionDiscount();
    var s = subtotal(), discount = promo.amount, sh = shippingCost(), total = orderTotal();
    $('#coSummary').innerHTML = cartLines().map(function (l) {
      var meta = [];
      if (l.necklace) meta.push(L(l.necklace.label));
      if (l.box) meta.push(L(l.box.label));
      if (l.size) meta.push(L(l.size.label));
      if (l.color) meta.push(L(l.color.label));
      if (l.packaging) meta.push((state.lang === 'he' ? 'אריזה: ' : 'Packaging: ') + L(l.packaging.label));
      if (l.customName) { var customLabel = l.p.customName && L(l.p.customName.cartLabel); meta.push((customLabel || (state.lang === 'he' ? 'שם' : 'Name')) + ': ' + l.customName); }
      if (l.customPhoto) { var photoLabel = l.p.customPhoto && L(l.p.customPhoto.cartLabel); meta.push((photoLabel || (state.lang === 'he' ? 'תמונה אישית' : 'Custom photo')) + ' ✓'); }
      if (l.greeting) meta.push(state.lang === 'he' ? 'ברכה אישית (+35 ₪)' : 'Custom greeting (+₪35)');
      var combinedTitle = L(l.p.title) + (l.packaging ? (state.lang === 'he' ? ' + מארז LOVE FOREVER' : ' + LOVE FOREVER packaging') : '');
      return '<div class="sum"><span>' + esc(combinedTitle + (meta.length ? ' — ' + meta.join(' · ') : '')) + ' × ' + l.qty + '</span><span>' + money(l.unitPrice * l.qty) + '</span></div>';
    }).join('') +
    '<div class="sum" style="margin-top:.6rem"><span>' + esc(t('cart.subtotal')) + '</span><span>' + money(s) + '</span></div>' +
    (discount > 0 ? '<div class="sum sum--discount"><span>' + esc(promo.label) + '</span><span>−' + money(discount) + '</span></div>' : '') +
    '<div class="sum"><span>' + esc(t('cart.shipping')) + '</span><span>' + (sh ? money(sh) : esc(t('cart.free'))) + '</span></div>' +
    '<div class="sum sum--total"><span>' + esc(t('cart.total')) + '</span><span>' + money(total) + '</span></div>';
  }

  function openCheckout() {
    if (!cartLines().length) return;
    renderSummary();
    closeOv('#cartOverlay');
    openOv('#coOverlay');
  }

  function fieldError(input, msg) {
    var f = input.closest('.field');
    f.classList.toggle('is-bad', !!msg);
    $('.field__err', f).textContent = msg || '';
    return !msg;
  }

  function validate(form) {
    var ok = true;
    $$('input, textarea', form).forEach(function (el) {
      if (el.required && !el.value.trim()) ok = fieldError(el, t('co.err.required')) && ok;
      else if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim())) ok = fieldError(el, t('co.err.email')) && ok;
      else if (el.type === 'tel' && el.value.replace(/\D/g, '').length < 9) ok = fieldError(el, t('co.err.phone')) && ok;
      else fieldError(el, '');
    });
    return ok;
  }

  function submitCheckout(e) {
    e.preventDefault();
    var form = $('#coForm'), btn = $('#payBtn'), errBox = $('#coError');
    errBox.hidden = true;
    if (!validate(form)) return;

    var fd = new FormData(form), customer = {};
    fd.forEach(function (v, k) { customer[k] = String(v).trim(); });

    btn.disabled = true;
    btn.textContent = t('co.paying');

    fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.cart.map(function (i) {
          return { id: i.id, qty: i.qty, necklace: i.necklace || null, box: i.box || null, size: i.size || null, color: i.color || null, packaging: i.packaging || null, customName: i.customName || null, customPhoto: i.customPhoto || null, greeting: i.greeting || null };
        }),
        customer: customer,
        lang: state.lang
      })
    })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (data) {
      if (data && data.url) {
        save(LS.pending, JSON.stringify({
          order: data.order, total: data.total, currency: CFG.currency.code,
          items: state.cart, at: Date.now()
        }));
        window.location.href = data.url;
      } else {
        throw new Error((data && data.error) || 'no url');
      }
    })
    .catch(function () {
      btn.disabled = false;
      btn.textContent = t('co.pay');
      errBox.textContent = t('co.err.server');
      errBox.hidden = false;
    });
  }

  /* ---------- שכבות ------------------------------------------------------ */
  var lastFocus = null;

  function openOv(sel) {
    var ov = $(sel);
    lastFocus = document.activeElement;
    ov.classList.add('is-open');
    document.body.classList.add('is-locked');
    var f = ov.querySelector('button, [href], input, select, textarea');
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeOv(sel) {
    var ov = typeof sel === 'string' ? $(sel) : sel;
    if (!ov) return;
    ov.classList.remove('is-open');
    if (!$('.ov.is-open')) document.body.classList.remove('is-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function closeAll() { $$('.ov.is-open').forEach(closeOv); }

  function trap(e) {
    var ov = $('.ov.is-open');
    if (!ov || e.key !== 'Tab') return;
    var f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', ov)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- טוסט ------------------------------------------------------- */
  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12.5l5 5L20 6.5"/></svg><span>' + esc(msg) + '</span>';
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  /* ---------- פוטר ------------------------------------------------------- */
  function renderFooterContact() {
    var ul = $('#footContact');
    if (!ul) return;
    var c = CFG.contact, out = [];
    if (c.email) out.push('<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>');
    if (c.phone) out.push('<li><a href="tel:' + esc(c.phone.replace(/\s|-/g, '')) + '">' + esc(c.phone) + '</a></li>');
    if (c.whatsapp) out.push('<li><a href="https://wa.me/' + esc(c.whatsapp) + '" rel="noopener">WhatsApp</a></li>');
    if (c.instagram) out.push('<li><a href="' + esc(c.instagram) + '" rel="noopener">Instagram</a></li>');
    if (c.tiktok) out.push('<li><a href="' + esc(c.tiktok) + '" rel="noopener">TikTok</a></li>');
    ul.innerHTML = out.join('');
  }

  /* ---------- סליידר כל תמונות המוצר במובייל ------------------------------- */
  function getMobileImages(media) {
    if (!media) return [];
    var main = media.querySelector('.prod__img--main[data-mobile-images]');
    if (!main) return [];
    try {
      var list = JSON.parse(decodeURIComponent(main.getAttribute('data-mobile-images') || ''));
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function stepMobileMedia(media, direction) {
    if (!media) return;
    var main = media.querySelector('.prod__img--main[data-mobile-images]');
    var list = getMobileImages(media);
    if (!main || list.length < 2) return;
    var index = parseInt(main.getAttribute('data-mobile-index') || '0', 10);
    if (!isFinite(index)) index = 0;
    index = (index + direction + list.length) % list.length;
    main.setAttribute('data-mobile-index', String(index));
    main.src = list[index];
  }

  var mobileSwipe = null;
  document.addEventListener('touchstart', function (e) {
    var media = e.target.closest && e.target.closest('.prod__media');
    if (!media || getMobileImages(media).length < 2 || !e.touches || !e.touches.length) return;
    var t0 = e.touches[0];
    mobileSwipe = { media: media, x: t0.clientX, y: t0.clientY };
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!mobileSwipe || !e.changedTouches || !e.changedTouches.length) { mobileSwipe = null; return; }
    var t1 = e.changedTouches[0];
    var dx = t1.clientX - mobileSwipe.x;
    var dy = t1.clientY - mobileSwipe.y;
    var media = mobileSwipe.media;
    mobileSwipe = null;
    if (Math.abs(dx) >= 34 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      e.preventDefault();
      /* Drag left = next image, drag right = previous image. */
      stepMobileMedia(media, dx < 0 ? 1 : -1);
      media.setAttribute('data-mobile-swipe-block', '1');
      setTimeout(function () { media.removeAttribute('data-mobile-swipe-block'); }, 380);
    }
  }, { passive: false });

  /* ---------- אירועים ---------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var el;

    if ((el = e.target.closest('[data-mobile-slide]'))) {
      e.preventDefault();
      stepMobileMedia(el.closest('.prod__media'), el.getAttribute('data-mobile-slide') === 'next' ? 1 : -1);
      return;
    }
    if ((el = e.target.closest('.prod__media[data-mobile-swipe-block="1"]'))) {
      e.preventDefault();
      return;
    }
    if ((el = e.target.closest('[data-cat]'))) {
      var nextFilter = el.getAttribute('data-cat');
      var groupKey = el.getAttribute('data-group');
      var parentGroup = el.getAttribute('data-parent-group');

      if (groupKey) {
        if (state.filter === nextFilter && state.openFilterGroup === groupKey) {
          state.openFilterGroup = null;
        } else {
          state.filter = nextFilter;
          state.openFilterGroup = groupKey;
        }
      } else {
        state.filter = nextFilter;
        state.openFilterGroup = parentGroup || null;
      }

      renderFilters();
      renderGrid();
      window.requestAnimationFrame(scrollCatalogTop);
      return;
    }
    if ((el = e.target.closest('[data-add]'))) { addToCart(el.getAttribute('data-add'), 1); return; }
    if ((el = e.target.closest('[data-view]'))) { window.location.href = 'product.html?id=' + encodeURIComponent(el.getAttribute('data-view')); return; }
    if ((el = e.target.closest('[data-add-modal]'))) { addToCart(el.getAttribute('data-add-modal'), state.qty); closeOv('#pdpOverlay'); return; }

    if ((el = e.target.closest('[data-q]'))) {
      state.qty = Math.max(1, state.qty + parseInt(el.getAttribute('data-q'), 10));
      $('#pdpQty').textContent = state.qty;
      return;
    }
    if ((el = e.target.closest('[data-img]'))) {
      var src = el.getAttribute('data-img');
      var img = $('#pdpMedia img');
      if (img) img.src = src;
      $$('.pdp__thumbs button').forEach(function (b) { b.classList.toggle('is-on', b === el); });
      return;
    }
    if ((el = e.target.closest('[data-line]'))) {
      var key = el.getAttribute('data-line'), d = parseInt(el.getAttribute('data-delta'), 10);
      var cur = 0;
      state.cart.forEach(function (i) { if (cartItemKey(i) === key) cur = i.qty; });
      setQty(key, cur + d);
      return;
    }
    if ((el = e.target.closest('[data-remove]'))) { setQty(el.getAttribute('data-remove'), 0); return; }

    if (e.target.closest('#cartBtn')) { renderCart(); openOv('#cartOverlay'); return; }
    if (e.target.closest('#goCheckout')) { openCheckout(); return; }
    if (e.target.closest('[data-close]')) { closeAll(); return; }
    if (e.target.closest('#burger')) { setMenu(!$('#navmenu').classList.contains('is-open')); return; }
    if (e.target.closest('#navScrim, [data-nav-close]')) { setMenu(false); return; }
    if (e.target.closest('.nav__menu a')) { setMenu(false); }
  });

  function setMenu(open) {
    $('#navmenu').classList.toggle('is-open', open);
    $('#navScrim').hidden = !open;
    $('#burger').setAttribute('aria-expanded', String(open));
    if (open) { document.body.classList.add('is-locked'); }
    else if (!$('.ov.is-open')) { document.body.classList.remove('is-locked'); }
  }

  document.addEventListener('keydown', function (e) {
    var mobileArrow = e.target.closest && e.target.closest('[data-mobile-slide]');
    if (mobileArrow && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      stepMobileMedia(mobileArrow.closest('.prod__media'), mobileArrow.getAttribute('data-mobile-slide') === 'next' ? 1 : -1);
      return;
    }
    if (e.key === 'Escape') { closeAll(); setMenu(false); }
    trap(e);
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id === 'coForm') submitCheckout(e);
  });

  window.addEventListener('scroll', function () {
    $('#nav').classList.toggle('is-stuck', window.scrollY > 10);
  }, { passive: true });

  /* ---------- אתחול ------------------------------------------------------ */
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  applyLang();
  persist();
})();
