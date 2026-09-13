(function () {
  'use strict';
  var CFG = window.STORE_CONFIG;
  var PRODUCTS = window.PRODUCTS || [];
  var allowedIds = [
    'wife-necklace-only-01',
    'gold-clover-set-01',
    'silver-clover-set-01',
    'tennis-necklace-2mm-01',
    'custom-name-necklace-925-01',
    'four-leaf-silver-necklace-01',
    'custom-heart-initial-necklace-01'
  ];
  var params = new URLSearchParams(window.location.search);
  var returnTo = params.get('returnTo') || 'love-forever-rose-gift-box-01';
  var packageColor = params.get('packageColor') || '';
  var lang = 'he';
  var PENDING_BUNDLE_KEY = 'kw_pending_love_forever_bundle';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function L(value) { return value ? (value.he || '') : ''; }
  function money(n) {
    var v = (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(/\.00$/, '');
    return CFG.currency.code === 'ILS' ? v + ' ' + CFG.currency.symbol : CFG.currency.symbol + v;
  }
  function getCart() {
    try { return JSON.parse(localStorage.getItem('kw_cart') || '[]'); } catch (_) { return []; }
  }
  function saveCart(items) {
    try { localStorage.setItem('kw_cart', JSON.stringify(items)); } catch (_) {}
  }
  function cartCount() {
    return getCart().reduce(function (sum, item) { return sum + (parseInt(item.qty, 10) || 0); }, 0);
  }
  function updateCartCount() {
    var el = document.getElementById('cartCount');
    if (!el) return;
    var count = cartCount();
    el.textContent = count;
    el.hidden = !count;
  }
  function packageOption(product) {
    if (!product || !product.giftPackaging || !Array.isArray(product.giftPackaging.options)) return null;
    return product.giftPackaging.options.find(function (option) { return option.id === packageColor; }) || null;
  }
  function needsConfiguration(product) {
    return !!(
      (product.necklaces && product.necklaces.length) ||
      (product.boxes && product.boxes.length) ||
      (product.sizes && product.sizes.length) ||
      (product.colors && product.colors.length) ||
      (product.customName && product.customName.required) ||
      (product.customPhoto && product.customPhoto.required)
    );
  }
  function productHref(product) {
    return 'product.html?id=' + encodeURIComponent(product.id) +
      '&returnTo=' + encodeURIComponent(returnTo) +
      (packageColor ? '&packageColor=' + encodeURIComponent(packageColor) : '');
  }
  function combinedKey(productId) {
    return productId + '|||||pack:' + packageColor + '||p:|g:';
  }
  function savePendingBundle(item) {
    try {
      localStorage.setItem(PENDING_BUNDLE_KEY, JSON.stringify({
        returnTo: returnTo,
        packageColor: packageColor,
        item: item,
        selectedAt: Date.now()
      }));
    } catch (_) {}
  }
  function selectSimpleNecklace(product, button) {
    var packaging = packageOption(product);
    if (!packaging) {
      window.location.href = 'product.html?id=' + encodeURIComponent(returnTo);
      return;
    }
    var item = {
      id: product.id,
      qty: 1,
      necklace: null,
      box: null,
      size: null,
      color: null,
      packaging: packageColor,
      customName: null,
      customPhoto: null,
      greeting: null
    };
    item.key = product.id + '|||||pack:' + packageColor + '||p:|g:';
    savePendingBundle(item);
    if (button) {
      button.textContent = lang === 'he' ? 'נבחר למארז ✓' : 'Selected for packaging ✓';
      button.classList.add('is-added');
      button.disabled = true;
    }
    window.setTimeout(function () {
      window.location.href = 'product.html?id=' + encodeURIComponent(returnTo) + '&bundleSelected=1&color=' + encodeURIComponent(packageColor);
    }, 220);
  }

  function render() {
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    var back = document.getElementById('backToPackage');
    if (back) back.href = 'product.html?id=' + encodeURIComponent(returnTo) + (packageColor ? '&color=' + encodeURIComponent(packageColor) : '');

    var packageNote = document.getElementById('necklacePickerPackageNote');
    if (packageNote) {
      var packageProduct = PRODUCTS.find(function (product) { return product.id === 'love-forever-rose-gift-box-01'; });
      var color = packageProduct && Array.isArray(packageProduct.colors)
        ? packageProduct.colors.find(function (option) { return option.id === packageColor; })
        : null;
      packageNote.textContent = color
        ? (lang === 'he' ? 'המארז שנבחר: ' + L(color.label) + '. בחרו שרשרת, ורק לאחר מכן הוסיפו את המארז והשרשרת יחד לסל.' : 'Selected packaging: ' + L(color.label) + '. Choose a necklace, then add the necklace and packaging to the cart together.')
        : (lang === 'he' ? 'בחרו קודם צבע למארז כדי לחבר אליו שרשרת.' : 'Choose a packaging color first to attach a necklace.');
    }

    var list = allowedIds.map(function (id) {
      return PRODUCTS.find(function (product) { return product.id === id; });
    }).filter(Boolean);
    var count = document.getElementById('necklacePickerCount');
    if (count) count.textContent = list.length + (lang === 'he' ? ' אפשרויות' : ' options');
    var grid = document.getElementById('necklacePickerGrid');
    if (!grid) return;
    grid.innerHTML = list.map(function (p) {
      var image = (p.images && p.images[0]) || '';
      var hover = p.hoverImage && p.hoverImage !== image ? p.hoverImage : '';
      var href = productHref(p);
      var direct = !needsConfiguration(p) && !!packageOption(p);
      return '<article class="prod">' +
        (L(p.badge) ? '<span class="prod__badge">' + esc(L(p.badge)) + '</span>' : '') +
        '<a class="prod__media prod__link" href="' + esc(href) + '">' +
          (image ? '<img class="prod__img prod__img--main" src="' + esc(image) + '" alt="' + esc(L(p.title)) + '" loading="lazy">' : '') +
          (hover ? '<img class="prod__img prod__img--hover" src="' + esc(hover) + '" alt="" loading="lazy" aria-hidden="true">' : '') +
        '</a>' +
        '<div class="prod__body">' +
          '<h3 class="prod__name"><a class="prod__titlelink" href="' + esc(href) + '">' + esc(L(p.title)) + '</a></h3>' +
          '<p class="prod__sub">' + esc(L(p.subtitle)) + '</p>' +
          '<p class="prod__price">+' + (p.startingPrice ? (lang === 'he' ? 'החל מ־' : 'From ') : '') + esc(money(Number(p.price || 0))) + '</p>' +
          '<div class="prod__actions">' +
            (direct
              ? '<button class="btn btn--primary" type="button" data-direct-necklace="' + esc(p.id) + '">' + (lang === 'he' ? 'הוסף שרשרת' : 'Add necklace') + '</button>'
              : '<a class="btn btn--primary" href="' + esc(href) + '">' + (lang === 'he' ? 'הוסף שרשרת' : 'Add necklace') + '</a>') +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    grid.addEventListener('click', function (event) {
      var button = event.target.closest('[data-direct-necklace]');
      if (!button) return;
      event.preventDefault();
      var selected = PRODUCTS.find(function (p) { return p.id === button.getAttribute('data-direct-necklace'); });
      if (selected) selectSimpleNecklace(selected, button);
    }, { once: false });
  }

  document.getElementById('year').textContent = new Date().getFullYear();
  updateCartCount();
  render();
})();
