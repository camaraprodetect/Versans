/* ============================================================================
   לוגיקת החנות
   אין צורך לגעת בקובץ הזה כדי להוסיף מוצרים - רק ב-products.js
   ============================================================================ */
(function () {
  'use strict';

  var CFG = window.STORE_CONFIG;
  var ROUTES = window.VERSANS_ROUTES || null;
  var LS = { lang: 'kw_lang', cart: 'kw_cart', pending: 'kw_pending' };

  var state = {
    lang: 'he',
    cart: JSON.parse(read(LS.cart) || '[]'),
    filter: 'all',
    openFilterGroup: null,
    catalogFilters: { colors: [], priceMin: '', priceMax: '' },
    catalogFilterSections: { colors: true, price: true },
    pdp: null,
    qty: 1
  };


  /* Clean collection routes such as /watches and /glasses select the catalog filter. */
  (function applyInitialCatalogCategoryFromUrl() {
    try {
      var requestedCategory = ROUTES && ROUTES.categoryFromPath
        ? ROUTES.categoryFromPath(window.location.pathname)
        : null;
      if (!requestedCategory) requestedCategory = new URLSearchParams(window.location.search).get('cat');
      var validCategories = [
        'all', 'greeting', 'greeting-mom', 'greeting-partner', 'greeting-daughter', 'greeting-sister',
        'necklaces', 'bracelets', 'photo-bracelets', 'watches',
        'glasses', 'glasses-men', 'glasses-women', 'glasses-unisex',
        'hats'
      ];
      if (requestedCategory && validCategories.indexOf(requestedCategory) !== -1) {
        state.filter = requestedCategory;
      }
    } catch (e) {}
  })();


  var catalogBatchesShown = 1;
  var catalogPagingKey = '';
  var catalogResizeTimer = null;
  var hatCarouselTimers = [];

  /* TESTABLE: catalog paging helpers */
  function catalogRowsPerBatch() {
    return 10;
  }
  function catalogColumnCount(grid) {
    var template = (getComputedStyle(grid).gridTemplateColumns || '').trim();
    if (!template || template === 'none') return window.matchMedia('(max-width: 700px)').matches ? 2 : 3;
    var columns = template.split(/\s+/).filter(Boolean).length;
    return Math.max(1, columns || 1);
  }
  function catalogPageSize(grid) {
    return catalogRowsPerBatch() * catalogColumnCount(grid);
  }
  function catalogVisibleCount(grid, batches) {
    return catalogPageSize(grid) * Math.max(1, Number(batches) || 1);
  }
  function catalogHasMore(total, visible) {
    return Number(visible) < Number(total);
  }
  /* END TESTABLE: catalog paging helpers */

  function catalogPagingContextKey(grid) {
    return [
      state.filter,
      JSON.stringify(state.catalogFilters || {}),
      window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop',
      catalogColumnCount(grid)
    ].join('|');
  }

  function ensureCatalogLoadMore(grid) {
    var wrap = $('#catalogLoadMoreWrap');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'catalogLoadMoreWrap';
    wrap.className = 'catalog-load-more';
    wrap.hidden = true;
    wrap.innerHTML = '<button class="catalog-load-more__btn" type="button" data-catalog-load-less hidden>' +
      '<span>פחות מוצרים</span>' +
      '</button>' +
      '<button class="catalog-load-more__btn" type="button" data-catalog-load-more>' +
      '<span>עוד מוצרים</span>' +
      '</button>';
    grid.insertAdjacentElement('afterend', wrap);
    return wrap;
  }

  function renderCatalogLoadMore(grid, total, visible) {
    var wrap = ensureCatalogLoadMore(grid);
    var hasMore = catalogHasMore(total, visible);
    var hasLess = catalogBatchesShown > 1 && Number(total) > 0;
    wrap.hidden = !hasMore && !hasLess;
    wrap.classList.toggle('catalog-load-more--both', hasMore && hasLess);

    var moreButton = $('[data-catalog-load-more]', wrap);
    if (moreButton) {
      moreButton.hidden = !hasMore;
      moreButton.setAttribute('aria-hidden', hasMore ? 'false' : 'true');
      moreButton.disabled = !hasMore;
    }

    var lessButton = $('[data-catalog-load-less]', wrap);
    if (lessButton) {
      lessButton.hidden = !hasLess;
      lessButton.setAttribute('aria-hidden', hasLess ? 'false' : 'true');
      lessButton.disabled = !hasLess;
    }
  }

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
  function productPath(productOrId) {
    var product = typeof productOrId === 'string' ? byId(productOrId) : productOrId;
    if (ROUTES && ROUTES.productPath) return ROUTES.productPath(product);
    return product && product.urlSlug ? '/' + encodeURIComponent(product.urlSlug) : '/';
  }
  function collectionPath(category) {
    if (ROUTES && ROUTES.collectionPath) return ROUTES.collectionPath(category);
    return category === 'all' ? '/' : '/?cat=' + encodeURIComponent(category);
  }
  function isGlassesProduct(p) {
    var collections = p && Array.isArray(p.categories) && p.categories.length ? p.categories : [p && p.category];
    return collections.indexOf('glasses') !== -1;
  }
  function isCurrentGlassesCollectionProduct(p) {
    if (!isGlassesProduct(p)) return false;
    var match = /^product-(\d+)$/.exec(String((p && p.slug) || ''));
    return !match || Number(match[1]) >= 31;
  }


  var COLOR_DEFS = [
    { key: 'black', label: 'שחור', swatch: '#111111', terms: ['שחור', 'black'] },
    { key: 'white', label: 'לבן', swatch: '#ffffff', terms: ['לבן', 'white'] },
    { key: 'silver', label: 'כסף', swatch: '#c7ccd1', terms: ['כסף', 'silver', 'steel'] },
    { key: 'gold', label: 'זהב', swatch: '#d8ae45', terms: ['זהב', 'gold'] },
    { key: 'rose-gold', label: 'רוז גולד', swatch: '#d8a08e', terms: ['רוז גולד', 'rose gold', 'rosegold'] },
    { key: 'blue', label: 'כחול', swatch: '#245d96', terms: ['כחול', 'blue'] },
    { key: 'light-blue', label: 'תכלת', swatch: '#83d8ed', terms: ['תכלת', 'light blue', 'sky blue'] },
    { key: 'green', label: 'ירוק', swatch: '#2d714d', terms: ['ירוק', 'green'] },
    { key: 'turquoise', label: 'טורקיז', swatch: '#2aa7a3', terms: ['טורקיז', 'turquoise', 'teal'] },
    { key: 'pink', label: 'ורוד', swatch: '#e8a2b8', terms: ['ורוד', 'pink'] },
    { key: 'purple', label: 'סגול', swatch: '#9a74ba', terms: ['סגול', 'purple', 'lavender'] },
    { key: 'gray', label: 'אפור', swatch: '#777c82', terms: ['אפור', 'gray', 'grey'] },
    { key: 'brown', label: 'חום', swatch: '#7a513d', terms: ['חום', 'brown'] },
    { key: 'red', label: 'אדום', swatch: '#a93434', terms: ['אדום', 'red'] },
    { key: 'beige', label: 'בז׳', swatch: '#d8c6a6', terms: ['בז', 'beige'] },
    { key: 'transparent', label: 'שקוף', swatch: 'linear-gradient(135deg,#fff 0 45%,#d9e1e7 45% 55%,#fff 55% 100%)', terms: ['שקוף', 'transparent', 'clear'] }
  ];

  var PRICE_RANGES = [
    { key: 'under-200', label: 'עד 199.90 ₪', min: 0, max: 199.99 },
    { key: '200-299', label: '200–299.90 ₪', min: 200, max: 299.99 },
    { key: '300-399', label: '300–399.90 ₪', min: 300, max: 399.99 },
    { key: '400-499', label: '400–499.90 ₪', min: 400, max: 499.99 },
    { key: '500-plus', label: '500 ₪ ומעלה', min: 500, max: Infinity }
  ];


  var TYPE_DEFS = [
    { key: 'greeting', label: 'תכשיט עם ברכה' },
    { key: 'necklaces', label: 'שרשראות' },
    { key: 'bracelets', label: 'צמידים' },
    { key: 'photo-bracelets', label: 'תכשיטי תמונה' },
    { key: 'watches', label: 'שעונים' },
    { key: 'glasses', label: 'משקפיים' },
    { key: 'hats', label: 'כובעים' }
  ];

  var DELIVERY_RANGES = [
    { key: 'fast', label: 'עד 14 ימי עסקים', min: 0, max: 14 },
    { key: 'standard', label: '15–18 ימי עסקים', min: 15, max: 18 },
    { key: 'extended', label: '19–25 ימי עסקים', min: 19, max: 25 }
  ];

  var MATERIAL_DEFS = [
    { key: 'sterling-925', label: 'Sterling Silver 925', terms: ['925 sterling silver', 'sterling silver 925', 'כסף סטרלינג', 'ציפוי sterling silver 925'] },
    { key: 'stainless-steel', label: 'Stainless Steel', terms: ['stainless steel', 'נירוסטה', 'פלדת אל חלד'] },
    { key: 'zinc-alloy', label: 'Zinc Alloy', terms: ['zinc alloy', 'סגסוגת אבץ'] },
    { key: 'acetate', label: 'אצטט', terms: ['acetate', 'אצטט'] }
  ];

  var FEATURE_DEFS = [
    { key: 'color-choice', label: 'בחירת צבע' },
    { key: 'size-choice', label: 'בחירת מידה / אורך' },
    { key: 'personalized', label: 'התאמה אישית' },
    { key: 'gift-box', label: 'כולל / בחירת מארז' },
    { key: 'model-choice', label: 'בחירת דגם' }
  ];

  function textValue(v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') return [v.he, v.en, v.label, v.name, v.id].filter(Boolean).join(' ');
    return '';
  }

  function productColorKeys(p) {
    if (!p) return [];
    var parts = [p.id, p.slug, textValue(p.title), textValue(p.subtitle), textValue(p.badge)];
    if (Array.isArray(p.colors)) {
      p.colors.forEach(function (color) {
        parts.push(textValue(color));
        if (color && color.label) parts.push(textValue(color.label));
      });
    }
    var text = parts.join(' ').toLowerCase();
    var keys = [];
    COLOR_DEFS.forEach(function (def) {
      if (def.terms.some(function (term) { return text.indexOf(term.toLowerCase()) !== -1; })) keys.push(def.key);
    });
    return keys;
  }

  function colorDefByKey(key) {
    for (var i = 0; i < COLOR_DEFS.length; i++) if (COLOR_DEFS[i].key === key) return COLOR_DEFS[i];
    return null;
  }

  function currentCollectionProducts() {
    return PRODUCTS.filter(function (p) {
      if (state.filter === 'all') return true;
      if (state.filter.indexOf('glasses') === 0 && !isCurrentGlassesCollectionProduct(p)) return false;
      var collections = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
      return collections.indexOf(state.filter) !== -1;
    });
  }

  function availableColorOptions(list) {
    return COLOR_DEFS.map(function (def) {
      var count = list.reduce(function (total, p) {
        return total + (productColorKeys(p).indexOf(def.key) !== -1 ? 1 : 0);
      }, 0);
      return { key: def.key, label: def.label, swatch: def.swatch, count: count };
    }).filter(function (option) { return option.count > 0; });
  }

  function availablePriceRanges(list) {
    return PRICE_RANGES.map(function (range) {
      var count = list.reduce(function (total, p) {
        var price = Number(p && p.price);
        return total + (isFinite(price) && price >= range.min && price <= range.max ? 1 : 0);
      }, 0);
      return { key: range.key, label: range.label, min: range.min, max: range.max, count: count };
    }).filter(function (range) { return range.count > 0; });
  }

  function productSearchText(p) {
    if (!p) return '';
    var parts = [p.id, p.slug, textValue(p.title), textValue(p.subtitle), textValue(p.badge), textValue(p.afterText)];
    if (p.details) {
      ['he', 'en'].forEach(function (lang) {
        if (Array.isArray(p.details[lang])) p.details[lang].forEach(function (item) { parts.push(textValue(item)); });
      });
    }
    return parts.join(' ').toLowerCase();
  }

  function productTypeKeys(p) {
    var collections = p && Array.isArray(p.categories) && p.categories.length ? p.categories : [p && p.category];
    return TYPE_DEFS.filter(function (def) { return collections.indexOf(def.key) !== -1; }).map(function (def) { return def.key; });
  }

  function productMaterialKeys(p) {
    var text = productSearchText(p);
    return MATERIAL_DEFS.filter(function (def) {
      return def.terms.some(function (term) { return text.indexOf(term.toLowerCase()) !== -1; });
    }).map(function (def) { return def.key; });
  }

  function productFeatureKeys(p) {
    if (!p) return [];
    var keys = [];
    if (Array.isArray(p.colors) && p.colors.length) keys.push('color-choice');
    if (Array.isArray(p.sizes) && p.sizes.length) keys.push('size-choice');
    if (p.customName) keys.push('personalized');
    var collections = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
    if ((Array.isArray(p.boxes) && p.boxes.length) || collections.indexOf('gift-boxes') !== -1) keys.push('gift-box');
    if (Array.isArray(p.necklaces) && p.necklaces.length > 1) keys.push('model-choice');
    return keys;
  }

  function availableDefinitionOptions(list, defs, getter) {
    return defs.map(function (def) {
      var count = list.reduce(function (total, p) {
        return total + (getter(p).indexOf(def.key) !== -1 ? 1 : 0);
      }, 0);
      return { key: def.key, label: def.label, count: count };
    }).filter(function (option) { return option.count > 0; });
  }

  function availableDeliveryRanges(list) {
    return DELIVERY_RANGES.map(function (range) {
      var count = list.reduce(function (total, p) {
        var max = Number(p && p.deliveryBusinessDays && p.deliveryBusinessDays.max);
        return total + (isFinite(max) && max >= range.min && max <= range.max ? 1 : 0);
      }, 0);
      return { key: range.key, label: range.label, min: range.min, max: range.max, count: count };
    }).filter(function (range) { return range.count > 0; });
  }

  function availableSaleOptions(list) {
    var sale = 0;
    var regular = 0;
    list.forEach(function (p) {
      var price = Number(p && p.price);
      var compareAt = Number(p && p.compareAt);
      if (isFinite(compareAt) && isFinite(price) && compareAt > price) sale += 1;
      else regular += 1;
    });
    return [
      { key: 'sale', label: 'במבצע', count: sale },
      { key: 'regular', label: 'ללא מחיר קודם', count: regular }
    ].filter(function (option) { return option.count > 0; });
  }

  function resetCatalogFilters() {
    state.catalogFilters = { colors: [], priceMin: '', priceMax: '' };
  }

  function matchesAnySelected(selected, productKeys) {
    if (!selected || !selected.length) return true;
    return selected.some(function (key) { return productKeys.indexOf(key) !== -1; });
  }

  function matchesCatalogFilters(p) {
    var filters = state.catalogFilters || { colors: [], priceMin: '', priceMax: '' };
    if (!matchesAnySelected(filters.colors, productColorKeys(p))) return false;

    var price = Number(p && p.price);
    var hasMin = filters.priceMin !== '' && filters.priceMin != null;
    var hasMax = filters.priceMax !== '' && filters.priceMax != null;
    var minPrice = hasMin ? Number(filters.priceMin) : null;
    var maxPrice = hasMax ? Number(filters.priceMax) : null;

    if (hasMin && isFinite(minPrice) && (!isFinite(price) || price < minPrice)) return false;
    if (hasMax && isFinite(maxPrice) && (!isFinite(price) || price > maxPrice)) return false;
    return true;
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

  /* Stable shuffle for the "all" collection. It deliberately uses a fixed
     seed so loading more products, resizing, or re-rendering filters does not
     make cards jump to new positions while the shopper is browsing. */
  var ALL_CATALOG_SHUFFLE_SEED = 20260914;
  function allCatalogShuffleKey(p) {
    var text = String(ALL_CATALOG_SHUFFLE_SEED) + ':' + String((p && (p.id || p.slug)) || '');
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function shuffleAllProductsStable(list) {
    return list.slice().sort(function (a, b) {
      var d = allCatalogShuffleKey(a) - allCatalogShuffleKey(b);
      if (d) return d;
      return String(a.id || a.slug || '').localeCompare(String(b.id || b.slug || ''));
    });
  }

  /* ---------- שפה -------------------------------------------------------- */
  function applyLang() {
    var html = document.documentElement;
    html.lang = 'he';
    html.dir = 'rtl';

    document.title = 'VerSans';
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

    var hatsBanner = $('#hatsCollectionBanner');
    if (hatsBanner) {
      hatsBanner.hidden = !(state.filter === 'hats');
    }

    var greetingCustomCollectionBanner = $('#greetingCustomCollectionBanner');
    if (greetingCustomCollectionBanner) {
      greetingCustomCollectionBanner.hidden = !(
        state.filter === 'greeting' || state.filter.indexOf('greeting-') === 0
      );
    }

    var otherCollectionsBanner = $('#otherCollectionsBanner');
    if (otherCollectionsBanner) {
      var showOtherCollectionsBanner =
        state.filter === 'all' ||
        state.filter === 'necklaces' ||
        state.filter === 'bracelets' ||
        state.filter === 'photo-bracelets';
      otherCollectionsBanner.hidden = !showOtherCollectionsBanner;
    }

    var hatsAllButtonWrap = document.querySelector('[data-hats-all-button-wrap]');
    if (hatsAllButtonWrap) {
      hatsAllButtonWrap.hidden = state.filter !== 'hats';
    }
  }

  function renderCollectionNav() {
    var activeKey = state.filter;
    if (activeKey.indexOf('greeting-') === 0) activeKey = 'greeting';
    else if (activeKey.indexOf('watches-') === 0) activeKey = 'watches';
    else if (activeKey.indexOf('glasses-') === 0) activeKey = 'glasses';

    $$('[data-nav-cat]').forEach(function (link) {
      var active = link.getAttribute('data-nav-cat') === activeKey;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $$('[data-nav-subcat]').forEach(function (link) {
      var active = link.getAttribute('data-nav-subcat') === state.filter;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function filterSectionHTML(key, title, bodyHtml, extraOptionsClass) {
    var open = !state.catalogFilterSections || state.catalogFilterSections[key] !== false;
    var bodyId = 'catalogFilterBody-' + key;
    return '<section class="catalog-filter-section" data-filter-section="' + esc(key) + '">' +
      '<button type="button" class="catalog-filter-title catalog-filter-title--toggle" data-filter-section-toggle="' + esc(key) + '" aria-expanded="' + open + '" aria-controls="' + bodyId + '">' +
        '<span>' + esc(title) + '</span><span class="catalog-filter-title__icon" aria-hidden="true">' + (open ? '−' : '+') + '</span>' +
      '</button>' +
      '<div class="catalog-filter-options' + (extraOptionsClass ? ' ' + extraOptionsClass : '') + '" id="' + bodyId + '"' + (open ? '' : ' hidden') + '>' + bodyHtml + '</div>' +
    '</section>';
  }

  function basicFilterOptionHTML(option, dataAttr, active, extraClass) {
    return '<button type="button" class="catalog-filter-option' + (extraClass ? ' ' + extraClass : '') + (active ? ' is-active' : '') + '" ' + dataAttr + '="' + esc(option.key) + '" aria-pressed="' + active + '">' +
      '<span class="catalog-filter-option__label">' + esc(option.label) + '</span>' +
      '<span class="catalog-filter-option__count">' + option.count + '</span>' +
    '</button>';
  }

  function renderFilters() {
    var wrap = $('#filters');
    if (!wrap) return;

    var collectionProducts = currentCollectionProducts();
    var colors = availableColorOptions(collectionProducts);
    var filters = state.catalogFilters || { colors: [], priceMin: '', priceMax: '' };
    var selectedColors = filters.colors || [];
    var selectedMin = filters.priceMin == null ? '' : String(filters.priceMin);
    var selectedMax = filters.priceMax == null ? '' : String(filters.priceMax);
    var hasActiveFilters = selectedColors.length > 0 || selectedMin !== '' || selectedMax !== '';
    var sections = [];

    if (colors.length) {
      sections.push(filterSectionHTML('colors', 'צבע', colors.map(function (option) {
        var active = selectedColors.indexOf(option.key) !== -1;
        return '<button type="button" class="catalog-filter-option catalog-filter-option--color' + (active ? ' is-active' : '') + '" data-product-color="' + esc(option.key) + '" aria-pressed="' + active + '">' +
          '<span class="catalog-filter-swatch" style="--filter-swatch:' + esc(option.swatch) + '" aria-hidden="true"></span>' +
          '<span class="catalog-filter-option__label">' + esc(option.label) + '</span>' +
          '<span class="catalog-filter-option__count">' + option.count + '</span>' +
        '</button>';
      }).join(''), 'catalog-filter-options--colors'));
    }

    if (collectionProducts.length) {
      var priceHtml =
        '<label class="catalog-price-field">' +
          '<span class="catalog-price-label">מינימום ₪</span>' +
          '<input class="catalog-price-input" type="number" inputmode="decimal" min="0" step="1" dir="ltr" data-price-min value="' + esc(selectedMin) + '" placeholder="Min">' +
        '</label>' +
        '<label class="catalog-price-field">' +
          '<span class="catalog-price-label">מקסימום ₪</span>' +
          '<input class="catalog-price-input" type="number" inputmode="decimal" min="0" step="1" dir="ltr" data-price-max value="' + esc(selectedMax) + '" placeholder="Max">' +
        '</label>';
      sections.push(filterSectionHTML('price', 'מחיר', priceHtml, 'catalog-price-inputs'));
    }

    var clearHtml = '<button type="button" class="catalog-filter-clear" data-clear-product-filters' + (hasActiveFilters ? '' : ' hidden') + '>נקה סינון</button>';
    wrap.innerHTML = sections.length ? (clearHtml + sections.join('')) : '<p class="catalog-filter-empty">אין סינונים נוספים בקטגוריה הזו.</p>';
    renderCollectionNav();
    renderGlassesCollectionBanner();
  }

  function scrollCatalogTop() {
    var shop = window.matchMedia('(max-width: 700px)').matches ? $('#shopTitle') : $('#shop');
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
      var isMobileCatalogViewport = !big && window.matchMedia('(max-width: 700px)').matches;
      var mobileImages = !big ? mobileImagesForProduct(p, img, hoverImg) : [];
      var mobileData = mobileImages.length > 1 ? ' data-mobile-images="' + esc(encodeURIComponent(JSON.stringify(mobileImages))) + '" data-mobile-index="0"' : '';
      var html = '<img class="prod__img prod__img--main" src="' + esc(img) + '" alt="' + esc(L(p.title)) + '" loading="lazy"' + mobileData + '>';
      /* Desktop keeps the existing hover image exactly as before. On mobile,
         secondary product images stay as URL strings in data-mobile-images and
         are not requested until the shopper presses an image arrow. */
      if (!isMobileCatalogViewport && hoverImg && hoverImg !== img) {
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

  function renderProductCardHTML(p) {
    var badge = L(p.badge);
    var cardCollections = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
    var isHat = cardCollections.indexOf('hats') !== -1;
    if (isHat) badge = state.lang === 'he' ? '1 ב־139.90 ₪ | 2 ב־239.90 ₪ | 3 ב־299.90 ₪' : '1 for ₪139.90 | 2 for ₪239.90 | 3 for ₪299.90';
    var isGlasses = isGlassesProduct(p);
    return '' +
    '<article class="prod">' +
      (badge ? '<span class="prod__badge"' +
        (((Array.isArray(p.categories) ? p.categories : [p.category]).indexOf('hats') !== -1)
          ? ' style="inset-inline-start:auto!important;inset-inline-end:auto!important;right:auto!important;left:16px!important;"'
          : '') +
        '>' + esc(badge) + '</span>' : '') +
      '<a class="prod__media prod__link" href="' + productPath(p) + '" aria-label="' + esc(L(p.title)) + '">' + mediaHTML(p) + '</a>' +
      '<div class="prod__body">' +
        '<h3 class="prod__name"><a class="prod__titlelink" href="' + productPath(p) + '">' + esc(L(p.title)) + '</a></h3>' +
        (isGlasses ? '' : '<p class="prod__sub">' + esc(L(p.subtitle)) + '</p>') +
        productColorMetaHTML(p) +
        '<p class="prod__price">' + (p.startingPrice ? (state.lang === 'he' ? 'החל מ־' : 'From ') : '') + money(p.price) +
          (p.compareAt ? '<span class="prod__was">' + money(p.compareAt) + '</span>' : '') +
        '</p>' +
        '<div class="prod__actions">' +
          ((p.necklaces && p.necklaces.length && p.boxes && p.boxes.length)
            ? '<a class="btn btn--primary" href="' + productPath(p) + '">' + esc(state.lang === 'he' ? 'לבחירת אפשרויות' : 'Choose options') + '</a>'
            : (p.customName && p.customName.required
              ? '<a class="btn btn--primary" href="' + productPath(p) + '">' + esc(state.lang === 'he' ? 'לעיצוב אישי' : 'Customize') + '</a>'
              : ((p.sizes && p.sizes.length)
                ? '<a class="btn btn--primary" href="' + productPath(p) + '">' + esc(state.lang === 'he' ? 'לבחירת אורך' : 'Choose length') + '</a>'
                : ((p.colors && p.colors.length)
                  ? '<a class="btn btn--primary" href="' + productPath(p) + '">' + esc(state.lang === 'he' ? 'לבחירת צבע' : 'Choose color') + '</a>'
                  : (p.cardMode === 'view'
                  ? '<a class="btn btn--primary" href="' + productPath(p) + '">' + esc(state.lang === 'he' ? 'לצפייה במוצר' : 'View product') + '</a>'
                  : '<button class="btn btn--primary" data-add="' + esc(p.id) + '">' + esc(t('card.add')) + '</button>'))))) +
          (isGlasses ? '' : '<a class="btn btn--ghost" href="#" data-card-add="' + esc(p.id) + '">' + esc(state.lang === 'he' ? 'הוסף לסל' : 'Add to cart') + '</a>') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  var ALL_COLLECTION_GROUPS = [
    { key: 'greeting', title: 'תכשיט עם ברכה', allLabel: 'לכל מוצרי תכשיט עם ברכה' },
    { key: 'necklaces', title: 'שרשראות', allLabel: 'לכל השרשראות' },
    { key: 'bracelets', title: 'צמידים', allLabel: 'לכל הצמידים' },
    { key: 'photo-bracelets', title: 'תכשיטי תמונה', allLabel: 'לכל תכשיטי התמונה' },
    { key: 'watches', title: 'שעונים', allLabel: 'לכל השעונים' },
    { key: 'glasses', title: 'משקפיים', allLabel: 'לכל המשקפיים' },
    { key: 'hats', title: 'כובעים', allLabel: 'לכל הכובעים' }
  ];


  /* TESTABLE: hats category grouping */
  var HAT_COLLECTION_GROUPS = [
    { key: 'los-angeles-dodgers', title: 'New Era X Los Angeles Dodgers', slugs: ['product-100', 'product-101', 'product-102', 'product-108', 'product-109', 'product-110', 'product-111'] },
    { key: 'jon-stan', title: 'New Era X Jon Stan', slugs: ['product-103', 'product-104', 'product-105', 'product-106', 'product-107'] },
    { key: 'new-york-yankees', title: 'New Era X New York Yankees', slugs: ['product-112', 'product-113', 'product-114', 'product-115', 'product-116', 'product-117', 'product-118', 'product-119', 'product-120', 'product-121', 'product-122', 'product-123', 'product-124', 'product-125', 'product-126', 'product-127', 'product-128'] },
    { key: 'anaheim-angels', title: 'New Era X Anaheim Angels', slugs: ['product-129', 'product-130', 'product-131', 'product-132', 'product-133'] },
    { key: 'atlanta-braves', title: 'New Era X Atlanta Braves', slugs: ['product-134', 'product-139', 'product-140', 'product-141'] },
    { key: 'milwaukee-bucks', title: 'New Era X Milwaukee Bucks', slugs: ['product-135', 'product-136', 'product-137', 'product-138'] },
    { key: 'oakland-athletics', title: 'New Era X Oakland Athletics', slugs: ['product-142', 'product-143', 'product-144', 'product-145', 'product-146', 'product-147'] }
  ];

  function hatGroupBrowseHref(key) {
    return '/hats?group=' + encodeURIComponent(key) + '#shop';
  }

  function selectedHatGroupKey(search) {
    var params = new URLSearchParams(search || '');
    var requested = params.get('group') || '';
    var exists = HAT_COLLECTION_GROUPS.some(function (group) { return group.key === requested; });
    return exists ? requested : '';
  }

  function isAllHatsView(search) {
    var params = new URLSearchParams(search || '');
    return params.get('view') === 'all';
  }

  function hatCollectionSections(filteredList, selectedKey) {
    return HAT_COLLECTION_GROUPS.filter(function (group) {
      return !selectedKey || group.key === selectedKey;
    }).map(function (group) {
      var products = filteredList.filter(function (p) {
        return p && group.slugs.indexOf(p.slug) !== -1;
      });
      return { group: group, products: products };
    }).filter(function (section) {
      return section.products.length > 0;
    });
  }

  function nextHatCarouselStart(currentStart) {
    return Math.max(0, Number(currentStart) || 0) + 1;
  }

  function hatCarouselLoopItems(items) {
    var list = Array.prototype.slice.call(items || []);
    /* Repeat short groups so even a two-product collection can keep sliding
       on desktop where three/four cards are visible at once. */
    return list.length <= 1 ? list : list.concat(list, list, list, list);
  }

  function normalizeHatCarouselLoopIndex(index, originalCount) {
    index = Number(index) || 0;
    originalCount = Math.max(0, Number(originalCount) || 0);
    if (!originalCount) return 0;
    if (index >= originalCount * 2) return index - originalCount;
    if (index < originalCount) return index + originalCount;
    return index;
  }
  /* END TESTABLE: hats category grouping */

  function allCollectionGroupLimit() {
    /* Mobile: 2 columns × 2 rows = 4 products.
       Desktop / narrow desktop: exactly 1 row. */
    if (window.matchMedia('(max-width: 700px)').matches) return 4;
    if (window.matchMedia('(min-width: 1600px)').matches) return 4;
    return 3;
  }

  function productBelongsToCollection(p, key) {
    if (!p) return false;
    if (key === 'glasses' && !isCurrentGlassesCollectionProduct(p)) return false;
    var collections = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
    return collections.indexOf(key) !== -1;
  }

  function renderAllCollectionGroups(grid, filteredList) {
    var limit = allCollectionGroupLimit();
    var sections = ALL_COLLECTION_GROUPS.map(function (group) {
      var groupProducts = filteredList.filter(function (p) {
        return productBelongsToCollection(p, group.key);
      });
      if (!groupProducts.length) return '';

      groupProducts = shuffleAllProductsStable(groupProducts).slice(0, limit);
      return '' +
        '<section class="all-collection-group" data-all-collection-group="' + esc(group.key) + '">' +
          '<div class="all-collection-group__head">' +
            '<h3 class="all-collection-group__title">' + esc(group.title) + '</h3>' +
          '</div>' +
          '<div class="all-collection-group__products">' + groupProducts.map(renderProductCardHTML).join('') + '</div>' +
          '<div class="all-collection-group__footer">' +
            '<a class="all-collection-group__link" href="' + collectionPath(group.key) + '#shop" data-cat="' + esc(group.key) + '">' + esc(group.allLabel) +
              '<span class="all-collection-group__arrow" aria-hidden="true">←</span>' +
            '</a>' +
          '</div>' +
        '</section>';
    }).filter(Boolean);

    grid.classList.add('grid--collection-groups');
    grid.innerHTML = sections.join('');
    renderCatalogLoadMore(grid, 0, 0);
  }


  function clearHatCarouselTimers() {
    hatCarouselTimers.forEach(function (timer) { window.clearInterval(timer); });
    hatCarouselTimers = [];
  }

  function hatCarouselVisibleCount(track) {
    if (!track) return 1;
    var cards = track.children;
    if (!cards.length) return 1;
    var cardWidth = cards[0].getBoundingClientRect().width || cards[0].offsetWidth || 1;
    var gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '0') || 0;
    return Math.max(1, Math.floor((track.clientWidth + gap) / (cardWidth + gap)));
  }

  function hatCarouselCurrentStart(track) {
    var cards = Array.prototype.slice.call(track.children || []);
    if (!cards.length) return 0;
    var left = Math.abs(track.scrollLeft || 0);
    var bestIndex = 0;
    var bestDistance = Infinity;
    cards.forEach(function (card, index) {
      var distance = Math.abs((card.offsetLeft || 0) - left);
      if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
    });
    return bestIndex;
  }

  function jumpHatCarouselToIndex(track, index, behavior) {
    if (!track) return;
    var cards = Array.prototype.slice.call(track.children || []);
    if (!cards.length) return;
    index = Math.max(0, Math.min(cards.length - 1, Number(index) || 0));
    var target = cards[index];
    if (!target) return;
    track._hatCarouselIndex = index;
    var left = target.offsetLeft || 0;
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left: left, behavior: behavior || 'auto' });
    } else {
      track.scrollLeft = left;
    }
  }

  function normalizeHatCarouselLoop(track) {
    if (!track) return;
    var originalCount = Number(track.getAttribute('data-hat-carousel-original-count')) || 0;
    if (!originalCount) return;
    var currentStart = Number.isFinite(track._hatCarouselIndex) ? track._hatCarouselIndex : hatCarouselCurrentStart(track);
    var normalized = currentStart;
    /* With five copies, keep the cursor around the middle copy. This avoids
       reaching the browser's scroll boundary in very short collections. */
    if (currentStart >= originalCount * 4) normalized = currentStart - (originalCount * 2);
    if (currentStart < originalCount) normalized = currentStart + (originalCount * 2);
    if (normalized !== currentStart) jumpHatCarouselToIndex(track, normalized, 'auto');
  }

  function scrollHatCarousel(track, direction) {
    if (!track) return;
    var cards = Array.prototype.slice.call(track.children || []);
    if (!cards.length) return;
    var currentStart = Number.isFinite(track._hatCarouselIndex) ? track._hatCarouselIndex : hatCarouselCurrentStart(track);
    var nextStart = currentStart + (direction < 0 ? -1 : 1);
    nextStart = Math.max(0, Math.min(cards.length - 1, nextStart));
    jumpHatCarouselToIndex(track, nextStart, 'smooth');
    window.clearTimeout(track._hatLoopResetTimer);
    track._hatLoopResetTimer = window.setTimeout(function () {
      normalizeHatCarouselLoop(track);
    }, 520);
  }

  function syncHatCarouselArrowCenter(carousel) {
    if (!carousel) return;
    var media = carousel.querySelector('.prod__media');
    if (!media) return;
    var carouselRect = carousel.getBoundingClientRect();
    var mediaRect = media.getBoundingClientRect();
    var arrowTop = (mediaRect.top - carouselRect.top) + (mediaRect.height / 2);
    if (Number.isFinite(arrowTop) && arrowTop > 0) {
      carousel.style.setProperty('--hat-arrow-top', arrowTop + 'px');
    }
  }

  function syncAllHatCarouselArrowCenters() {
    $$('.hat-carousel').forEach(syncHatCarouselArrowCenter);
  }

  function initHatCarousels() {
    clearHatCarouselTimers();
    $$('[data-hat-carousel-track]').forEach(function (track) {
      var carousel = track.closest('.hat-carousel');
      syncHatCarouselArrowCenter(carousel);
      window.requestAnimationFrame(function () { syncHatCarouselArrowCenter(carousel); });
      $$('img', track).forEach(function (img) {
        if (!img.complete) img.addEventListener('load', function () { syncHatCarouselArrowCenter(carousel); }, { once: true });
      });
      var originalCount = Number(track.getAttribute('data-hat-carousel-original-count')) || 0;
      if (originalCount > 0) {
        /* Start in the center copy so prev/next works immediately in both directions. */
        jumpHatCarouselToIndex(track, originalCount * 2, 'auto');
        window.requestAnimationFrame(function () { normalizeHatCarouselLoop(track); });
      }
      if (originalCount <= 1) return;
      var timer = window.setInterval(function () {
        if (!document.hidden && document.documentElement.contains(track)) scrollHatCarousel(track, 1);
      }, 3000);
      hatCarouselTimers.push(timer);
    });
  }

  window.addEventListener('resize', function () {
    window.requestAnimationFrame(syncAllHatCarouselArrowCenters);
  });

  function renderAllHatsGrid(grid, filteredList) {
    clearHatCarouselTimers();
    grid.classList.remove('grid--collection-groups');
    grid.classList.remove('grid--hat-groups');
    grid.classList.remove('grid--hat-group-only');
    grid.classList.add('grid--hats-all');
    grid.innerHTML = filteredList.map(renderProductCardHTML).join('');
    renderCatalogLoadMore(grid, 0, 0);

    var allHatsButton = document.querySelector('[data-hats-all-button]');
    if (allHatsButton) {
      allHatsButton.textContent = 'חזרה לקטגוריות';
      allHatsButton.setAttribute('href', '/hats#shop');
      allHatsButton.removeAttribute('aria-current');
    }
  }

  function renderHatCollectionGroups(grid, filteredList) {
    grid.classList.remove('grid--hats-all');
    var allHatsButton = document.querySelector('[data-hats-all-button]');
    if (allHatsButton) {
      allHatsButton.textContent = 'לכל הכובעים';
      allHatsButton.setAttribute('href', '/hats?view=all#shop');
      allHatsButton.removeAttribute('aria-current');
    }
    var sections = hatCollectionSections(filteredList).map(function (section) {
      var groupKey = section.group.key;
      return '' +
        '<section class="all-collection-group hat-collection-group" data-hat-collection-group="' + esc(groupKey) + '">' +
          '<div class="all-collection-group__head hat-collection-group__head">' +
            '<h3 class="all-collection-group__title" dir="ltr">' + esc(section.group.title) + '</h3>' +
          '</div>' +
          '<div class="hat-carousel">' +
            (section.products.length > 1 ? '<button class="hat-carousel__arrow hat-carousel__arrow--prev" type="button" data-hat-carousel-prev aria-label="כובע קודם">‹</button>' : '') +
            '<div class="hat-carousel__track" data-hat-carousel-track data-hat-carousel-original-count="' + section.products.length + '" dir="ltr">' + hatCarouselLoopItems(section.products).map(renderProductCardHTML).join('') + '</div>' +
            (section.products.length > 1 ? '<button class="hat-carousel__arrow hat-carousel__arrow--next" type="button" data-hat-carousel-next aria-label="כובע הבא">›</button>' : '') +
          '</div>' +
          '<div class="hat-collection-group__footer">' +
            '<a class="hat-collection-group__all" href="' + esc(hatGroupBrowseHref(groupKey)) + '">' +
              '<span>לכל הכובעים של <bdi dir="ltr">' + esc(section.group.title) + '</bdi></span><span aria-hidden="true">←</span>' +
            '</a>' +
          '</div>' +
        '</section>';
    });

    grid.classList.add('grid--collection-groups');
    grid.classList.add('grid--hat-groups');
    grid.classList.remove('grid--hat-group-only');
    grid.innerHTML = sections.join('');
    renderCatalogLoadMore(grid, 0, 0);
    initHatCarousels();
  }

  function renderHatGroupOnly(grid, filteredList, groupKey) {
    grid.classList.remove('grid--hats-all');
    var allHatsButton = document.querySelector('[data-hats-all-button]');
    if (allHatsButton) allHatsButton.removeAttribute('aria-current');
    var section = hatCollectionSections(filteredList, groupKey)[0];
    if (!section) { renderHatCollectionGroups(grid, filteredList); return; }
    grid.classList.add('grid--collection-groups');
    grid.classList.add('grid--hat-groups');
    grid.classList.add('grid--hat-group-only');
    grid.innerHTML = '' +
      '<section class="hat-group-page" data-hat-group-page="' + esc(section.group.key) + '">' +
        '<div class="hat-group-page__head">' +
          '<div><p class="eyebrow">כובעים</p><h3 dir="ltr">' + esc(section.group.title) + '</h3></div>' +
          '<a class="hat-group-page__back" href="/hats#shop">חזרה לכל הכובעים</a>' +
        '</div>' +
        '<div class="hat-group-page__products">' + section.products.map(renderProductCardHTML).join('') + '</div>' +
      '</section>';
    renderCatalogLoadMore(grid, 0, 0);
  }

  function renderGrid() {
    var grid = $('#grid');
    if (!grid) return;
    clearHatCarouselTimers();
    var list = currentCollectionProducts().filter(function (p) {
      return matchesCatalogFilters(p);
    });

    if (state.filter === 'all') {
      grid.classList.remove('grid--hat-groups');
      if (!list.length) {
        grid.classList.remove('grid--collection-groups');
        grid.innerHTML = '<p class="empty">' + esc(t('shop.empty')) + '</p>';
        renderCatalogLoadMore(grid, 0, 0);
        return;
      }
      renderAllCollectionGroups(grid, list);
      return;
    }

    if (state.filter === 'hats') {
      if (!list.length) {
        grid.classList.remove('grid--collection-groups');
        grid.classList.remove('grid--hat-groups');
        grid.innerHTML = '<p class="empty">' + esc(t('shop.empty')) + '</p>';
        renderCatalogLoadMore(grid, 0, 0);
        return;
      }
      if (isAllHatsView(window.location.search)) {
        renderAllHatsGrid(grid, list);
        return;
      }
      var requestedHatGroup = selectedHatGroupKey(window.location.search);
      if (requestedHatGroup) renderHatGroupOnly(grid, list, requestedHatGroup);
      else renderHatCollectionGroups(grid, list);
      return;
    }

    grid.classList.remove('grid--collection-groups');
    grid.classList.remove('grid--hat-groups');
    grid.classList.remove('grid--hats-all');
    list = shuffleGlassesWithinList(list);

    var pagingKey = catalogPagingContextKey(grid);
    if (pagingKey !== catalogPagingKey) {
      catalogPagingKey = pagingKey;
      catalogBatchesShown = 1;
    }

    if (!list.length) {
      grid.innerHTML = '<p class="empty">' + esc(t('shop.empty')) + '</p>';
      renderCatalogLoadMore(grid, 0, 0);
      return;
    }

    var visibleCount = catalogVisibleCount(grid, catalogBatchesShown);
    var visibleList = list.slice(0, visibleCount);
    grid.innerHTML = visibleList.map(renderProductCardHTML).join('');

    renderCatalogLoadMore(grid, list.length, visibleList.length);
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
    var pending = Array.isArray(it && it.quickAddPending) ? it.quickAddPending.slice().sort().join(',') : '';
    return it.key || (it.id + '|' + (it.necklace || '') + '|' + (it.box || '') + '|' + (it.size || '') + '|' + (it.color || '') + '|pack:' + (it.packaging || '') + '|' + (it.customName || '') + '|p:' + (it.customPhoto && it.customPhoto.assetId || '') + '|g:' + (it.greeting ? JSON.stringify(it.greeting) : '') + '|pending:' + pending);
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
      var pendingRequirements = Array.isArray(it.quickAddPending) ? it.quickAddPending.slice() : [];
      var allowsPendingName = pendingRequirements.indexOf('customName') !== -1;
      var allowsPendingPhoto = pendingRequirements.indexOf('customPhoto') !== -1;
      var allowsPendingCompanion = pendingRequirements.indexOf('companion') !== -1;
      if ((needsNecklace && !necklace) || (needsBox && !box) || (needsSize && !size) || (needsColor && !color) || invalidPackaging || (!companionReady && !allowsPendingCompanion) || (needsCustomName && !customName && !allowsPendingName) || (needsCustomPhoto && (!customPhoto || !customPhoto.assetId) && !allowsPendingPhoto)) return null;
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
        pendingRequirements: pendingRequirements,
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
    var hatsUnits = 0;
    var hatsSubtotal = 0;

    lines.forEach(function (l) {
      for (var i = 0; i < l.qty; i++) unitPrices.push(Number(l.unitPrice) || 0);
      var collections = Array.isArray(l.p.categories) && l.p.categories.length ? l.p.categories : [l.p.category];
      if (collections.indexOf('glasses') !== -1) glassesUnits += l.qty;
      if (collections.indexOf('hats') !== -1) {
        hatsUnits += l.qty;
        hatsSubtotal += (Number(l.unitPrice) || 0) * l.qty;
      }
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

    /* מבצע הכובעים: 1 ב־139.90 ₪, 2 ב־239.90 ₪, 3 ב־299.90 ₪.
       בכמויות גדולות יותר המבצע ממשיך בקבוצות של 3, ואז 2/1 לשארית. */
    var hatsTriples = Math.floor(hatsUnits / 3);
    var hatsRemainder = hatsUnits % 3;
    var hatsPromoTotal = hatsTriples * 299.9 + (hatsRemainder === 2 ? 239.9 : (hatsRemainder === 1 ? 139.9 : 0));
    var hatsBundle = hatsUnits > 0 ? Math.max(0, Math.round((hatsSubtotal - hatsPromoTotal) * 100) / 100) : 0;
    var hatsPromoActive = hatsUnits >= 2 || hatsBundle > 0;

    if (glassesPairs > 0 || hatsPromoActive) {
      var bundleLabels = [];
      if (glassesPairs > 0) {
        bundleLabels.push(state.lang === 'he' ? 'מבצע משקפיים - 2 ב־249.90 ₪' : 'Sunglasses offer - 2 for ₪249.90');
      }
      if (hatsPromoActive) {
        bundleLabels.push(state.lang === 'he'
          ? 'מבצע כובעים - 1 ב־139.90 ₪ | 2 ב־239.90 ₪ | 3 ב־299.90 ₪'
          : 'Hats offer - 1 for ₪139.90 | 2 for ₪239.90 | 3 for ₪299.90');
      }
      return {
        amount: Math.round((glassesBundle + hatsBundle) * 100) / 100,
        label: bundleLabels.join(' + '),
        type: glassesPairs > 0 && hatsPromoActive ? 'multi-bundle' : (glassesPairs > 0 ? 'glasses-bundle' : 'hats-bundle')
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

  function cardDefaultOptionId(list, preferredId) {
    if (!Array.isArray(list) || !list.length) return '';
    if (preferredId && optionById(list, preferredId)) return preferredId;
    return list[0] && list[0].id ? list[0].id : '';
  }

  function productNeedsQuickAddCustomization(product) {
    if (!product) return false;

    /* Any product that requires a shopper choice must be completed on the PDP.
       The index quick-add is reserved only for products with no selectable options. */
    if (Array.isArray(product.necklaces) && product.necklaces.length) return true;
    if (Array.isArray(product.boxes) && product.boxes.length) return true;
    if (Array.isArray(product.sizes) && product.sizes.length) return true;
    if (Array.isArray(product.colors) && product.colors.length) return true;
    if (product.customName && product.customName.required) return true;
    if (product.customPhoto && product.customPhoto.required) return true;
    if (product.giftPackaging) return true;
    if (product.requiresCompanion && product.requiresCompanion.required && Array.isArray(product.requiresCompanion.productIds) && product.requiresCompanion.productIds.length) return true;
    return false;
  }

  function showQuickAddCustomizationPrompt(product) {
    var existing = document.getElementById('quickAddCustomizeModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'quickAddCustomizeModal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'quickAddCustomizeTitle');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:20px;';

    var panel = document.createElement('div');
    panel.style.cssText = 'width:min(430px,100%);background:#fff;border-radius:14px;padding:26px 24px 22px;box-shadow:0 18px 60px rgba(0,0,0,.25);text-align:center;direction:rtl;font-family:inherit;';

    var title = document.createElement('h3');
    title.id = 'quickAddCustomizeTitle';
    title.textContent = state.lang === 'he' ? 'התאם אישית' : 'Customize';
    title.style.cssText = 'margin:0 0 10px;font-size:24px;line-height:1.25;';

    var copy = document.createElement('p');
    copy.textContent = state.lang === 'he'
      ? 'המוצר הזה דורש התאמה אישית לפני הוספה לסל.'
      : 'This product needs to be customized before it can be added to the cart.';
    copy.style.cssText = 'margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5563;';

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;justify-content:center;';

    var customize = document.createElement('button');
    customize.type = 'button';
    customize.textContent = state.lang === 'he' ? 'התאם אישית' : 'Customize';
    customize.style.cssText = 'min-width:150px;border:1px solid #111827;background:#111827;color:#fff;border-radius:8px;padding:12px 18px;font:inherit;font-weight:700;cursor:pointer;';

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = state.lang === 'he' ? 'ביטול' : 'Cancel';
    cancel.style.cssText = 'min-width:110px;border:1px solid #cbd5e1;background:#fff;color:#111827;border-radius:8px;padding:12px 18px;font:inherit;font-weight:600;cursor:pointer;';

    function close() {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    customize.addEventListener('click', function () {
      close();
      window.location.href = productPath(product.id);
    });
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    actions.appendChild(customize);
    actions.appendChild(cancel);
    panel.appendChild(title);
    panel.appendChild(copy);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    customize.focus();
  }

  function addCardToCart(id, qty) {
    qty = qty || 1;
    var product = byId(id);
    if (!product) return;

    if (productNeedsQuickAddCustomization(product)) {
      showQuickAddCustomizationPrompt(product);
      return;
    }

    /* Index quick-add never navigates away for ordinary products: use the product's default/first
       available options and add the cart line in place. */

    var necklaceId = cardDefaultOptionId(product.necklaces, product.defaultNecklaceId);
    var boxId = cardDefaultOptionId(product.boxes, product.defaultBoxId);
    var sizeId = cardDefaultOptionId(product.sizes, product.defaultSizeId);
    var colorId = cardDefaultOptionId(product.colors, product.defaultColorId);

    /* If the first size/color pair is unavailable, select the first valid pair. */
    if (sizeId && colorId && Array.isArray(product.unavailableCombinations)) {
      var blocked = function (s, c) {
        return product.unavailableCombinations.some(function (combo) {
          return combo && combo.size === s && combo.color === c;
        });
      };
      if (blocked(sizeId, colorId)) {
        var sizes = Array.isArray(product.sizes) ? product.sizes : [];
        var colors = Array.isArray(product.colors) ? product.colors : [];
        outer:
        for (var si = 0; si < sizes.length; si++) {
          for (var ci = 0; ci < colors.length; ci++) {
            if (!blocked(sizes[si].id, colors[ci].id)) {
              sizeId = sizes[si].id;
              colorId = colors[ci].id;
              break outer;
            }
          }
        }
      }
    }

    var pendingRequirements = [];
    if (product.customName && product.customName.required) pendingRequirements.push('customName');
    if (product.customPhoto && product.customPhoto.required) pendingRequirements.push('customPhoto');
    if (product.requiresCompanion && product.requiresCompanion.required && Array.isArray(product.requiresCompanion.productIds) && product.requiresCompanion.productIds.length) pendingRequirements.push('companion');

    var item = {
      id: product.id,
      qty: qty,
      necklace: necklaceId || '',
      box: boxId || '',
      size: sizeId || '',
      color: colorId || '',
      packaging: '',
      customName: '',
      customPhoto: null,
      greeting: null,
      quickAddPending: pendingRequirements
    };
    item.key = cartItemKey(item);

    var found = false;
    state.cart.forEach(function (existing) {
      if (cartItemKey(existing) === item.key) {
        existing.qty = (parseInt(existing.qty, 10) || 0) + qty;
        existing.key = item.key;
        found = true;
      }
    });
    if (!found) state.cart.push(item);
    persist();
    toast(t('card.added'));
  }

  function addToCart(id, qty) {
    qty = qty || 1;
    var product = byId(id);
    if (product && ((product.necklaces && product.necklaces.length) || (product.boxes && product.boxes.length) || (product.sizes && product.sizes.length) || (product.colors && product.colors.length) || (product.customName && product.customName.required) || (product.customPhoto && product.customPhoto.required) || product.giftPackaging || product.requiresCompanion)) {
      window.location.href = productPath(id);
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
      return Array.isArray(item.quickAddPending) && item.quickAddPending.indexOf('companion') !== -1;
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
      if (l.pendingRequirements && l.pendingRequirements.length) meta.push(state.lang === 'he' ? 'נדרשת השלמת פרטים לפני התשלום' : 'Details must be completed before checkout');
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
      if (l.pendingRequirements && l.pendingRequirements.length) meta.push(state.lang === 'he' ? 'נדרשת השלמת פרטים לפני התשלום' : 'Details must be completed before checkout');
      if (l.greeting) meta.push(state.lang === 'he' ? 'ברכה אישית (+35 ₪)' : 'Custom greeting (+₪35)');
      var combinedTitle = L(l.p.title) + (l.packaging ? (state.lang === 'he' ? ' + מארז LOVE FOREVER' : ' + LOVE FOREVER packaging') : '');
      return '<div class="sum"><span>' + esc(combinedTitle + (meta.length ? ' - ' + meta.join(' · ') : '')) + ' × ' + l.qty + '</span><span>' + money(l.unitPrice * l.qty) + '</span></div>';
    }).join('') +
    '<div class="sum" style="margin-top:.6rem"><span>' + esc(t('cart.subtotal')) + '</span><span>' + money(s) + '</span></div>' +
    (discount > 0 ? '<div class="sum sum--discount"><span>' + esc(promo.label) + '</span><span>−' + money(discount) + '</span></div>' : '') +
    '<div class="sum"><span>' + esc(t('cart.shipping')) + '</span><span>' + (sh ? money(sh) : esc(t('cart.free'))) + '</span></div>' +
    '<div class="sum sum--total"><span>' + esc(t('cart.total')) + '</span><span>' + money(total) + '</span></div>';
  }

  function openCheckout() {
    var lines = cartLines();
    if (!lines.length) return;
    var pendingLine = lines.find(function (line) { return line.pendingRequirements && line.pendingRequirements.length; });
    if (pendingLine) {
      toast(state.lang === 'he' ? 'יש להשלים את פרטי המוצר לפני התשלום' : 'Complete the product details before checkout');
      window.setTimeout(function () { window.location.href = productPath(pendingLine.p) + '?completeCart=1'; }, 220);
      return;
    }
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

  /* Secondary catalog images on mobile are deliberately arrow-only.
     Keeping swipe navigation disabled prevents a touch gesture from starting
     an image request before the shopper explicitly presses an arrow. */

  function toggleCatalogArrayFilter(field, key) {
    var values = Array.isArray(state.catalogFilters[field]) ? state.catalogFilters[field].slice() : [];
    var index = values.indexOf(key);
    if (index === -1) values.push(key);
    else values.splice(index, 1);
    state.catalogFilters[field] = values;
  }

  document.addEventListener('input', function (e) {
    if (!e.target.matches('[data-price-min], [data-price-max]')) return;
    if (e.target.matches('[data-price-min]')) state.catalogFilters.priceMin = e.target.value.trim();
    if (e.target.matches('[data-price-max]')) state.catalogFilters.priceMax = e.target.value.trim();

    var clear = $('[data-clear-product-filters]');
    if (clear) {
      clear.hidden = !((state.catalogFilters.colors || []).length || state.catalogFilters.priceMin !== '' || state.catalogFilters.priceMax !== '');
    }
    renderGrid();
  });

  /* ---------- אירועים ---------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var el;

    if ((el = e.target.closest('[data-catalog-load-more]'))) {
      e.preventDefault();
      catalogBatchesShown += 1;
      renderGrid();
      return;
    }

    if ((el = e.target.closest('[data-catalog-load-less]'))) {
      e.preventDefault();
      catalogBatchesShown = Math.max(1, catalogBatchesShown - 1);
      renderGrid();
      return;
    }

    if ((el = e.target.closest('[data-hat-carousel-next]'))) {
      e.preventDefault();
      scrollHatCarousel(el.closest('.hat-carousel').querySelector('[data-hat-carousel-track]'), 1);
      return;
    }
    if ((el = e.target.closest('[data-hat-carousel-prev]'))) {
      e.preventDefault();
      scrollHatCarousel(el.closest('.hat-carousel').querySelector('[data-hat-carousel-track]'), -1);
      return;
    }

    if ((el = e.target.closest('[data-mobile-slide]'))) {
      e.preventDefault();
      stepMobileMedia(el.closest('.prod__media'), el.getAttribute('data-mobile-slide') === 'next' ? 1 : -1);
      return;
    }
    if ((el = e.target.closest('.prod__media[data-mobile-swipe-block="1"]'))) {
      e.preventDefault();
      return;
    }
    if ((el = e.target.closest('[data-catalog-filter-toggle]'))) {
      var filtersPanel = $('#filters');
      if (filtersPanel) {
        var willOpen = filtersPanel.hidden;
        filtersPanel.hidden = !willOpen;
        el.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        var panelIcon = $('[data-catalog-filter-toggle-icon]', el);
        if (panelIcon) panelIcon.textContent = willOpen ? '−' : '+';
      }
      return;
    }
    if ((el = e.target.closest('[data-filter-section-toggle]'))) {
      var sectionKey = el.getAttribute('data-filter-section-toggle');
      state.catalogFilterSections[sectionKey] = !(state.catalogFilterSections[sectionKey] !== false);
      renderFilters();
      return;
    }
    if ((el = e.target.closest('[data-product-color]'))) {
      toggleCatalogArrayFilter('colors', el.getAttribute('data-product-color'));
      renderFilters();
      renderGrid();
      return;
    }
    if ((el = e.target.closest('[data-clear-product-filters]'))) {
      resetCatalogFilters();
      renderFilters();
      renderGrid();
      return;
    }
    if ((el = e.target.closest('[data-nav-parent-toggle]')) && window.matchMedia('(max-width: 980px)').matches) {
      e.preventDefault();
      var item = el.closest('.nav__item--has-submenu');
      var submenu = item && item.querySelector('.nav__submenu');
      if (submenu) {
        var willOpen = !submenu.classList.contains('is-open');
        $$('.nav__submenu.is-open').forEach(function (menu) {
          if (menu !== submenu) menu.classList.remove('is-open');
        });
        $$('[data-nav-parent-toggle][aria-expanded="true"]').forEach(function (parentLink) {
          if (parentLink !== el) parentLink.setAttribute('aria-expanded', 'false');
        });
        submenu.classList.toggle('is-open', willOpen);
        el.setAttribute('aria-expanded', String(willOpen));
      }
      return;
    }
    if ((el = e.target.closest('[data-cat]'))) {
      e.preventDefault();
      var nextFilter = el.getAttribute('data-cat');
      var collectionChanged = state.filter !== nextFilter;
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

      if (collectionChanged) resetCatalogFilters();
      try {
        var targetPath = collectionPath(state.filter);
        if (window.location.pathname !== targetPath || window.location.search) {
          window.history.pushState({ versansCategory: state.filter }, '', targetPath + '#shop');
        }
      } catch (e) {}
      renderFilters();
      renderGrid();
      if (el.closest('.nav__menu')) setMenu(false);
      window.requestAnimationFrame(scrollCatalogTop);
      return;
    }
    if ((el = e.target.closest('[data-card-add]'))) { e.preventDefault(); addCardToCart(el.getAttribute('data-card-add'), 1); return; }
    if ((el = e.target.closest('[data-add]'))) { addToCart(el.getAttribute('data-add'), 1); return; }
    if ((el = e.target.closest('[data-view]'))) { window.location.href = productPath(el.getAttribute('data-view')); return; }
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

  function resetNavMenuScroll(navmenu) {
    if (!navmenu) return;
    navmenu.scrollTop = 0;
    navmenu.scrollLeft = 0;
    if (typeof navmenu.scrollTo === 'function') navmenu.scrollTo(0, 0);
  }

  function setMenu(open) {
    var navmenu = $('#navmenu');

    // Reset before changing visibility too. Mobile browsers can otherwise restore
    // the drawer's previous internal scroll position when it becomes visible.
    resetNavMenuScroll(navmenu);

    navmenu.classList.toggle('is-open', open);
    $('#navScrim').hidden = !open;
    $('#burger').setAttribute('aria-expanded', String(open));

    if (open) {
      resetNavMenuScroll(navmenu);
      requestAnimationFrame(function () {
        resetNavMenuScroll(navmenu);
        requestAnimationFrame(function () { resetNavMenuScroll(navmenu); });
      });
      // Safari/Chrome on mobile may restore the old scroll after the drawer
      // transition/layout settles, so reset again after those points.
      [40, 140, 320].forEach(function (delay) {
        window.setTimeout(function () {
          if (navmenu.classList.contains('is-open')) resetNavMenuScroll(navmenu);
        }, delay);
      });
    }

    if (!open) {
      resetNavMenuScroll(navmenu);
      $$('.nav__submenu.is-open').forEach(function (menu) { menu.classList.remove('is-open'); });
      $$('[data-nav-parent-toggle]').forEach(function (link) { link.setAttribute('aria-expanded', 'false'); });
    }
    if (open) { document.body.classList.add('is-locked'); }
    else if (!$('.ov.is-open')) { document.body.classList.remove('is-locked'); }
  }

  (function keepMobileDrawerAtTopAfterOpen() {
    var navmenu = $('#navmenu');
    if (!navmenu) return;
    navmenu.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'transform' && navmenu.classList.contains('is-open')) {
        resetNavMenuScroll(navmenu);
      }
    });
  })();

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

  window.addEventListener('popstate', function () {
    try {
      var category = ROUTES && ROUTES.categoryFromPath ? ROUTES.categoryFromPath(window.location.pathname) : null;
      state.filter = category || 'all';
      state.openFilterGroup = null;
      resetCatalogFilters();
      renderFilters();
      renderGrid();
    } catch (e) {}
  });

  window.addEventListener('scroll', function () {
    $('#nav').classList.toggle('is-stuck', window.scrollY > 10);
  }, { passive: true });

  window.addEventListener('resize', function () {
    window.clearTimeout(catalogResizeTimer);
    catalogResizeTimer = window.setTimeout(function () {
      if ($('#grid')) renderGrid();
    }, 140);
  }, { passive: true });


  /* ---------- אתחול ------------------------------------------------------ */
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  applyLang();
  persist();
})();
