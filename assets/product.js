/* ============================================================================
   דף מוצר מלא - בחירת שרשרת + בחירת קופסה + מחיר דינמי
   ============================================================================ */
(function () {
  'use strict';

  var CFG = window.STORE_CONFIG;
  var ROUTES = window.VERSANS_ROUTES || null;
  var LS = { lang: 'kw_lang', cart: 'kw_cart' };
  var PENDING_BUNDLE_KEY = 'kw_pending_love_forever_bundle';
  var lang = 'he';
  var qty = 1;
  var selectedNecklaceId = null;
  var selectedBoxId = null;
  var selectedSizeId = null;
  var selectedColorId = null;
  var unavailableNoticeTimer = null;
  var selectedPackagingId = null;
  var customNameValue = '';
  var customPhotoValue = null;
  var customPhotoUploading = false;
  var customPhotoPreviewUrl = '';
  var activeImageIndex = 0;
  var CUSTOM_GREETING_ADD_PRICE = 35;
  var greetingPreviewObjectUrl = '';

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var pathSlug = '';
  try { pathSlug = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, '')); } catch (e) {}
  var product = findProduct(pathSlug) || findProduct(id) || PRODUCTS[0];
  var initialColorParam = params.get('color');
  if (initialColorParam && findOption(product.colors, initialColorParam)) selectedColorId = initialColorParam;

  function $(s) { return document.querySelector(s); }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function L(obj) { return obj ? (obj.he || '') : ''; }
  function productPath(productValue) {
    if (ROUTES && ROUTES.productPath) return ROUTES.productPath(productValue);
    return productValue && productValue.urlSlug ? '/' + encodeURIComponent(productValue.urlSlug) : '/';
  }
  function setSeoMeta(selector, content) {
    var el = document.querySelector(selector);
    if (el && content) el.setAttribute('content', content);
  }
  function updateProductSeo() {
    var title = L(product.title) + ' - ' + L(CFG.brand.name);
    var description = L(product.title) + ' מבית VerSans. פרטים מלאים, מחיר, תמונות ואפשרויות בחירה בעמוד המוצר.';
    var canonicalUrl = 'https://versans.com' + productPath(product);
    var imagePath = product.cardImage || (Array.isArray(product.images) && product.images[0]) || product.hoverImage || 'images/VerSansLogoBlackJewlery.png';
    var imageUrl = /^https?:\/\//i.test(String(imagePath)) ? String(imagePath) : 'https://versans.com/' + String(imagePath).replace(/^\//, '');
    document.title = title;
    setSeoMeta('meta[name="description"]', description);
    setSeoMeta('meta[property="og:title"]', title);
    setSeoMeta('meta[property="og:description"]', description);
    setSeoMeta('meta[property="og:url"]', canonicalUrl);
    setSeoMeta('meta[property="og:image"]', imageUrl);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', canonicalUrl);
    var ld = document.getElementById('productStructuredData');
    if (!ld) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.id = 'productStructuredData';
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: L(product.title),
      image: [imageUrl],
      description: description,
      sku: product.sku || product.id,
      brand: { '@type': 'Brand', name: 'VerSans' },
      offers: {
        '@type': 'Offer', url: canonicalUrl,
        priceCurrency: (CFG.currency && CFG.currency.code) || 'ILS',
        price: Number(product.price || 0).toFixed(2),
        availability: 'https://schema.org/InStock'
      }
    });
  }
  function money(n) {
    var v = (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(/\.00$/, '');
    return CFG.currency.code === 'ILS' ? v + ' ' + CFG.currency.symbol : CFG.currency.symbol + v;
  }
  function findProduct(productId) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === productId || PRODUCTS[i].slug === productId || PRODUCTS[i].urlSlug === productId) return PRODUCTS[i];
    }
    return null;
  }
  function isGlassesProduct(p) {
    var collections = p && Array.isArray(p.categories) && p.categories.length ? p.categories : [p && p.category];
    return collections.indexOf('glasses') !== -1;
  }
  function glassesPurchaseTotal(unitPriceValue, quantity) {
    if (!isGlassesProduct(product)) return Math.round(Number(unitPriceValue || 0) * Math.max(1, quantity || 1) * 100) / 100;
    if (window.VERSANS_GLASSES_PRICING) return window.VERSANS_GLASSES_PRICING.totalForQty(unitPriceValue, quantity);
    var q = Math.max(1, parseInt(quantity, 10) || 1);
    return Math.round((Math.floor(q / 2) * 249.9 + (q % 2) * Number(unitPriceValue || 0)) * 100) / 100;
  }
  function glassesPriceDisplay(unitPriceValue, quantity) {
    var total = glassesPurchaseTotal(unitPriceValue, quantity);
    if (isGlassesProduct(product) && quantity === 2) {
      return money(total) + (lang === 'he' ? ' (2 משקפיים ב־249.90 ₪)' : ' (2 sunglasses for ₪249.90)');
    }
    return money(total);
  }
  function findOption(list, optionId) {
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === optionId) return list[i];
    return null;
  }
  function cart() {
    try { return JSON.parse(read(LS.cart) || '[]'); } catch (e) { return []; }
  }
  function readPendingBundle() {
    try {
      var value = JSON.parse(read(PENDING_BUNDLE_KEY) || 'null');
      return value && value.item && value.returnTo ? value : null;
    } catch (e) { return null; }
  }
  function savePendingBundle(item, returnTo, packageColor) {
    save(PENDING_BUNDLE_KEY, JSON.stringify({
      returnTo: returnTo,
      packageColor: packageColor || '',
      item: item,
      selectedAt: Date.now()
    }));
  }
  function clearPendingBundle() {
    try { localStorage.removeItem(PENDING_BUNDLE_KEY); } catch (e) {}
  }
  function refreshCompanionSelectionUi() {
    if (!requiresCompanion()) return;
    renderRequiredCompanion();
    updatePriceAndPurchase();
  }
  function cartItemKey(item) {
    return item.key || (item.id + '|' + (item.necklace || '') + '|' + (item.box || '') + '|' + (item.size || '') + '|' + (item.color || '') + '|pack:' + (item.packaging || '') + '|' + (item.customName || '') + '|p:' + (item.customPhoto && item.customPhoto.assetId || '') + '|g:' + (item.greeting ? greetingFingerprint(item.greeting) : ''));
  }
  function cartCount(items) {
    return items.reduce(function (sum, item) { return sum + (parseInt(item.qty, 10) || 0); }, 0);
  }
  function updateCartCount() {
    var el = $('#cartCount');
    if (!el) return;
    var n = cartCount(cart());
    el.textContent = n;
    el.hidden = n === 0;
  }
  function selectedNecklace() { return findOption(product.necklaces, selectedNecklaceId); }
  function selectedBox() { return findOption(product.boxes, selectedBoxId); }
  function hasNecklaceOptions() { return Array.isArray(product.necklaces) && product.necklaces.length; }
  function hasBoxOptions() { return Array.isArray(product.boxes) && product.boxes.length; }
  function selectedSize() { return findOption(product.sizes, selectedSizeId); }
  function selectedColor() { return findOption(product.colors, selectedColorId); }
  function hasSizeOptions() { return Array.isArray(product.sizes) && product.sizes.length; }
  function hasColorOptions() { return Array.isArray(product.colors) && product.colors.length; }
  function unavailableCombination(sizeId, colorId) {
    if (!sizeId || !colorId || !Array.isArray(product.unavailableCombinations)) return null;
    for (var i = 0; i < product.unavailableCombinations.length; i += 1) {
      var combo = product.unavailableCombinations[i] || {};
      if (combo.size === sizeId && combo.color === colorId) return combo;
    }
    return null;
  }
  function showUnavailableCombination(combo) {
    var message = L(combo && combo.message) || (lang === 'he' ? 'השילוב הזה אינו במלאי כרגע.' : 'This combination is currently out of stock.');
    var sizeStatus = $('#sizeStatus');
    var colorStatus = $('#colorStatus');
    [sizeStatus, colorStatus].forEach(function (status) {
      if (!status) return;
      status.textContent = message;
      status.classList.remove('is-done');
      status.style.color = '#b42318';
      status.style.fontWeight = '700';
    });
    if (unavailableNoticeTimer) clearTimeout(unavailableNoticeTimer);
    unavailableNoticeTimer = setTimeout(function () {
      [sizeStatus, colorStatus].forEach(function (status) {
        if (!status) return;
        status.style.color = '';
        status.style.fontWeight = '';
      });
      renderSizeOptions();
      renderColorOptions();
    }, 4200);
  }
  function hasGiftPackaging() { return !!(product.giftPackaging && Array.isArray(product.giftPackaging.options) && product.giftPackaging.options.length); }
  function selectedPackaging() { return hasGiftPackaging() ? findOption(product.giftPackaging.options, selectedPackagingId) : null; }
  function requiresCompanion() { return !!(product.requiresCompanion && product.requiresCompanion.required && Array.isArray(product.requiresCompanion.productIds) && product.requiresCompanion.productIds.length); }
  function pendingCompanion() {
    if (!requiresCompanion()) return null;
    var pending = readPendingBundle();
    if (!pending || pending.returnTo !== product.id || !pending.item) return null;
    if (product.requiresCompanion.productIds.indexOf(pending.item.id) === -1) return null;
    if (product.id === 'love-forever-rose-gift-box-01' && selectedColorId && pending.packageColor && pending.packageColor !== selectedColorId) return null;
    return pending;
  }
  function companionReady() {
    if (!requiresCompanion()) return true;
    return !!pendingCompanion();
  }
  function isCompanionPickerFlow() {
    var returnTo = params.get('returnTo');
    var returnProduct = returnTo ? findProduct(returnTo) : null;
    return !!(returnProduct && returnProduct.requiresCompanion && Array.isArray(returnProduct.requiresCompanion.productIds) && returnProduct.requiresCompanion.productIds.indexOf(product.id) !== -1);
  }
  function companionPackageColor() {
    if (!isCompanionPickerFlow() || !hasGiftPackaging()) return '';
    var packageColor = params.get('packageColor') || '';
    return findOption(product.giftPackaging.options, packageColor) ? packageColor : '';
  }
  function hasCustomName() { return !!(product.customName && product.customName.required); }
  function hasCustomPhoto() { return !!(product.customPhoto && product.customPhoto.required); }
  function customPhotoReady() { return !hasCustomPhoto() || (!!customPhotoValue && !!customPhotoValue.assetId && !customPhotoUploading); }
  function customNameMax() { return Math.max(1, Number(product.customName && product.customName.maxLength) || 20); }
  function cleanCustomName(value) {
    var raw = String(value == null ? '' : value);
    if (product.customName && product.customName.lettersOnly) {
      raw = raw.toUpperCase().replace(/[^A-Z]/g, '');
      return raw.slice(0, customNameMax());
    }
    return raw.replace(/[|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, customNameMax());
  }
  function customNameReady() { return !hasCustomName() || cleanCustomName(customNameValue).length > 0; }
  function isConfigurable() {
    return !!(hasNecklaceOptions() || hasBoxOptions());
  }
  function pendingCompanionUnitPrice() {
    var pending = pendingCompanion();
    if (!pending || !pending.item) return Number(product.price || 0);
    var item = pending.item;
    var necklaceProduct = findProduct(item.id);
    if (!necklaceProduct) return Number(product.price || 0);
    var total = Number(necklaceProduct.price || 0);
    var box = findOption(necklaceProduct.boxes, item.box);
    var size = findOption(necklaceProduct.sizes, item.size);
    var color = findOption(necklaceProduct.colors, item.color);
    var packaging = necklaceProduct.giftPackaging ? findOption(necklaceProduct.giftPackaging.options, selectedColorId || item.packaging) : null;
    if (box) total += Number(box.addPrice || 0);
    if (size) total += Number(size.addPrice || 0);
    if (color) total += Number(color.addPrice || 0);
    if (packaging) total += Number(packaging.addPrice || 0);
    if (item.greeting) total += CUSTOM_GREETING_ADD_PRICE;
    return total;
  }
  function unitPrice() {
    if (requiresCompanion() && companionReady()) return pendingCompanionUnitPrice();
    var box = selectedBox();
    var size = selectedSize();
    var color = selectedColor();
    var packaging = selectedPackaging();
    var greetingExtra = savedGreeting() ? CUSTOM_GREETING_ADD_PRICE : 0;
    return Number(product.price) + (box ? Number(box.addPrice || 0) : 0) + (size ? Number(size.addPrice || 0) : 0) + (color ? Number(color.addPrice || 0) : 0) + (packaging ? Number(packaging.addPrice || 0) : 0) + greetingExtra;
  }
  function variantKey() {
    var greeting = savedGreeting();
    return product.id + '|' + (selectedNecklaceId || '') + '|' + (selectedBoxId || '') + '|' + (selectedSizeId || '') + '|' + (selectedColorId || '') + '|pack:' + (selectedPackagingId || '') + '|' + cleanCustomName(customNameValue) + '|p:' + (customPhotoValue && customPhotoValue.assetId || '') + '|g:' + greetingFingerprint(greeting);
  }
  function isReadyToBuy() {
    var necklaceReady = !hasNecklaceOptions() || !!selectedNecklace();
    var boxReady = !hasBoxOptions() || !!selectedBox();
    var sizeReady = !hasSizeOptions() || !!selectedSize();
    var colorReady = !hasColorOptions() || !!selectedColor();
    var combinationReady = !unavailableCombination(selectedSizeId, selectedColorId);
    return necklaceReady && boxReady && sizeReady && colorReady && combinationReady && customNameReady() && customPhotoReady() && companionReady();
  }
  function galleryImages() {
    var images = Array.isArray(product.images) ? product.images.slice() : [];
    var isGlasses = product.category === 'glasses' || (Array.isArray(product.categories) && product.categories.indexOf('glasses') !== -1);
    if (isGlasses && product.hoverImage && images.indexOf(product.hoverImage) === -1) {
      images.push(product.hoverImage);
    }
    return images;
  }
  function galleryVideos() {
    if (!Array.isArray(product.videos)) return [];
    return product.videos.map(function (entry) {
      if (typeof entry === 'string') return { src: entry, label: { he: 'וידאו מוצר', en: 'Product video' } };
      return entry || {};
    }).filter(function (entry) { return !!entry.src; });
  }
  function hasMessageCard() {
    return !product.hideMessageCard;
  }
  function supportsCustomGreeting() {
    return hasMessageCard() && /^product-[1-9]$/.test(String(product.slug || ''));
  }
  function greetingStorageKey() {
    return 'kw_greeting_' + product.id;
  }
  function greetingOptInKey() {
    return 'kw_greeting_optin_' + product.id;
  }
  function hasGreetingOptIn() {
    return read(greetingOptInKey()) === '1';
  }
  function normalizeGreeting(value) {
    if (!value || typeof value !== 'object') return null;
    var validTemplates = {'template-1':1,'template-2':1,'template-4':1,'template-5':1,'template-6':1,'template-7':1,'template-8':1,'template-9':1,'template-10':1,'template-11':1,'template-12':1,'template-13':1,'template-15':1,'template-17':1};
    var template = validTemplates[value.template] ? value.template : 'template-1';
    var signatureMax = template === 'template-1' ? 30 : 28;
    var title = String(value.title || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 15);
    var message = String(value.message || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 170);
    var signature = String(value.signature || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, signatureMax);
    if (!title || !message || !signature) return null;
    var backgroundColor = /^#[0-9a-fA-F]{6}$/.test(String(value.backgroundColor || '')) ? String(value.backgroundColor).toLowerCase() : '#f7f4ed';
    var textColor = /^#[0-9a-fA-F]{6}$/.test(String(value.textColor || '')) ? String(value.textColor).toLowerCase() : '#111111';
    var allowedFonts = {'noto-serif':1,'frank-ruhl':1,'david':1,'heebo':1,'assistant':1,'rubik':1,'alef':1,'varela':1,'miriam':1,'secular':1};
    var fontKey = allowedFonts[value.fontKey] ? value.fontKey : 'noto-serif';
    return { template: template, title: title, message: message, signature: signature, eyebrow: '', subtitle: '', backgroundColor: backgroundColor, textColor: textColor, fontKey: fontKey, assetId: String(value.assetId || '').slice(0,80), pngUrl: String(value.pngUrl || '').slice(0,600), pngFileName: String(value.pngFileName || '').slice(0,120) };
  }
  function savedGreeting() {
    if (!supportsCustomGreeting() || !hasGreetingOptIn()) return null;
    try { return normalizeGreeting(JSON.parse(read(greetingStorageKey()) || 'null')); } catch (e) { return null; }
  }
  function greetingFingerprint(greeting) {
    if (!greeting) return '';
    var value = [greeting.template, greeting.backgroundColor || '', greeting.textColor || '', greeting.fontKey || '', greeting.eyebrow || '', greeting.title, greeting.subtitle || '', greeting.message, greeting.signature, greeting.assetId || ''].join('\u241f');
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function openGreetingAssetDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var req = indexedDB.open('kw_greeting_assets', 2);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('pngs')) db.createObjectStore('pngs', { keyPath: 'productId' });
        if (!db.objectStoreNames.contains('backgrounds')) db.createObjectStore('backgrounds', { keyPath: 'productId' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('DB open failed')); };
    });
  }
  async function loadGreetingAsset() {
    try {
      var db = await openGreetingAssetDb();
      var row = await new Promise(function (resolve, reject) {
        var req = db.transaction('pngs', 'readonly').objectStore('pngs').get(product.id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
      db.close();
      return row;
    } catch (e) { return null; }
  }
  async function deleteGreetingAsset() {
    try {
      var db = await openGreetingAssetDb();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction('pngs', 'readwrite');
        tx.objectStore('pngs').delete(product.id);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
      db.close();
    } catch (e) {}
  }
  async function renderGreetingPngPreview(greeting) {
    var block = $('#greetingPreviewBlock');
    var img = $('#greetingPreviewImage');
    if (!block || !img) return;
    if (greetingPreviewObjectUrl) { try { URL.revokeObjectURL(greetingPreviewObjectUrl); } catch (e) {} greetingPreviewObjectUrl = ''; }
    if (!greeting) { block.hidden = true; img.removeAttribute('src'); return; }
    block.hidden = false;
    block.classList.add('is-loading');
    var row = await loadGreetingAsset();
    if (!row || !row.blob || (greeting.assetId && row.assetId && greeting.assetId !== row.assetId)) {
      block.hidden = true;
      block.classList.remove('is-loading');
      return;
    }
    greetingPreviewObjectUrl = URL.createObjectURL(row.blob);
    img.onload = function () { block.classList.remove('is-loading'); };
    img.onerror = function () { block.classList.remove('is-loading'); };
    img.src = greetingPreviewObjectUrl;
    img.alt = lang === 'he' ? 'תצוגה של הברכה האישית שנשמרה' : 'Preview of your saved custom greeting';
  }
  async function removeCustomGreeting() {
    try { localStorage.removeItem(greetingStorageKey()); localStorage.removeItem(greetingOptInKey()); } catch (e) {}
    await deleteGreetingAsset();
    renderProduct();
    updatePriceAndPurchase();
    toast(lang === 'he' ? 'חזרנו לברכה המקורית' : 'Original greeting restored');
  }

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12.5l5 5L20 6.5"/></svg><span>' + esc(msg) + '</span>';
    el.classList.add('is-on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  function setMainImage(src, alt) {
    var main = $('#productMainImage');
    var video = $('#productMainVideo');
    if (!main || !src) return;
    if (video) {
      try { video.pause(); } catch (e) {}
      video.hidden = true;
    }
    main.hidden = false;
    main.src = src;
    main.alt = alt || L(product.title);
  }

  function clearGalleryActiveThumbs() {
    Array.prototype.slice.call(document.querySelectorAll('[data-gallery-index],[data-gallery-video-index]')).forEach(function (btn) {
      btn.classList.remove('is-active');
    });
  }

  function showGalleryImage(index) {
    var imgs = galleryImages();
    if (!imgs.length) return;
    activeImageIndex = Math.max(0, Math.min(index, imgs.length - 1));
    setMainImage(imgs[activeImageIndex], L(product.title));
    clearGalleryActiveThumbs();
    var active = document.querySelector('[data-gallery-index="' + activeImageIndex + '"]');
    if (active) active.classList.add('is-active');
  }

  function showGalleryVideo(index) {
    var videos = galleryVideos();
    var entry = videos[index];
    var main = $('#productMainImage');
    var video = $('#productMainVideo');
    if (!entry || !video) return;
    clearGalleryActiveThumbs();
    var active = document.querySelector('[data-gallery-video-index="' + index + '"]');
    if (active) active.classList.add('is-active');
    if (main) main.hidden = true;
    video.hidden = false;
    if (entry.poster) video.setAttribute('poster', entry.poster); else video.removeAttribute('poster');
    if (video.getAttribute('src') !== entry.src) {
      video.src = entry.src;
      video.load();
    }
  }

  function renderStaticGallery() {
    var wrap = $('#productThumbs');
    var hint = $('#galleryHint');
    var imgs = galleryImages();
    var videos = galleryVideos();
    if (!wrap) return;
    if (imgs.length > 1 || videos.length) {
      wrap.hidden = false;
      var imageButtons = imgs.map(function (src, i) {
        return '<button type="button" class="product-thumb' + (i === activeImageIndex ? ' is-active' : '') + '" data-gallery-index="' + i + '" aria-label="' + (lang === 'he' ? 'תמונה ' : 'Image ') + (i + 1) + '">' +
          '<img src="' + esc(src) + '" alt="">' +
        '</button>';
      }).join('');
      var videoButtons = videos.map(function (entry, i) {
        var label = entry.label ? L(entry.label) : (lang === 'he' ? 'וידאו מוצר' : 'Product video');
        var preview = entry.poster
          ? '<img class="product-thumb__video-preview" src="' + esc(entry.poster) + '" alt="">'
          : '';
        return '<button type="button" class="product-thumb product-thumb--video" data-gallery-video-index="' + i + '" aria-label="' + esc(label) + '">' +
          preview +
          '<span class="product-thumb__video-icon" aria-hidden="true">▶</span>' +
        '</button>';
      }).join('');
      wrap.innerHTML = imageButtons + videoButtons;
    } else {
      wrap.hidden = true;
      wrap.innerHTML = '';
    }
    if (hint) {
      hint.textContent = videos.length
        ? (lang === 'he' ? 'תמונות ווידאו של המוצר' : 'Product photos and video')
        : (imgs.length > 1 ? (lang === 'he' ? 'לצפייה בעוד תמונות' : 'View more photos') : (lang === 'he' ? 'תמונת מוצר' : 'Product image'));
    }
  }

  function renderNecklaceOptions() {
    var block = $('#necklaceBlock');
    var wrap = $('#necklaceOptions');
    if (!wrap) return;
    var list = product.necklaces || [];
    if (!list.length) {
      if (block) { block.hidden = true; block.style.display = 'none'; }
      wrap.innerHTML = '';
      return;
    }
    if (block) { block.hidden = false; block.style.display = ''; }
    wrap.innerHTML = list.map(function (option, index) {
      var selected = option.id === selectedNecklaceId;
      return '' +
        '<button type="button" class="product-choice product-choice--necklace' + (selected ? ' is-selected' : '') + '" ' +
          'data-necklace="' + esc(option.id) + '" aria-pressed="' + selected + '">' +
          '<span class="product-choice__image"><img src="' + esc(option.image) + '" alt="' + esc(L(option.label)) + '" loading="lazy"></span>' +
          '<span class="product-choice__footer">' +
            '<strong>' + esc(L(option.label) || ((lang === 'he' ? 'דגם ' : 'Style ') + (index + 1))) + '</strong>' +
            '<span class="product-choice__check" aria-hidden="true">✓</span>' +
          '</span>' +
        '</button>';
    }).join('');
  }

  function renderBoxOptions() {
    var block = $('#boxBlock');
    var wrap = $('#boxOptions');
    if (!wrap) return;
    var list = product.boxes || [];
    if (!list.length) {
      if (block) { block.hidden = true; block.style.display = 'none'; }
      wrap.innerHTML = '';
      return;
    }
    if (block) { block.hidden = false; block.style.display = ''; }
    wrap.innerHTML = list.map(function (option) {
      var selected = option.id === selectedBoxId;
      var add = Number(option.addPrice || 0);
      var priceText = L(option.priceLabel) || (add ? '+' + money(add) : (lang === 'he' ? 'כלולה במחיר' : 'Included'));
      return '' +
        '<button type="button" class="product-choice product-choice--box' + (selected ? ' is-selected' : '') + '" ' +
          'data-box="' + esc(option.id) + '" aria-pressed="' + selected + '">' +
          '<span class="product-choice__image"><img src="' + esc(option.image) + '" alt="' + esc(L(option.label)) + '" loading="lazy"></span>' +
          '<span class="product-choice__footer">' +
            '<span><strong>' + esc(L(option.label)) + '</strong><small>' + esc(priceText) + '</small></span>' +
            '<span class="product-choice__check" aria-hidden="true">✓</span>' +
          '</span>' +
        '</button>';
    }).join('');
  }

  function renderSizeOptions() {
    var block = $('#sizeBlock');
    var wrap = $('#sizeOptions');
    var status = $('#sizeStatus');
    if (!block || !wrap) return;

    if (!hasSizeOptions()) {
      block.hidden = true;
      block.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }

    block.hidden = false;
    block.style.display = '';
    var list = product.sizes || [];
    var sizeSwatches = product.sizeDisplay === 'swatch';
    var sizeColorRows = product.sizeDisplay === 'color-row';
    wrap.classList.toggle('product-swatch-grid', !!sizeSwatches);
    wrap.classList.toggle('product-color-row-grid', !!sizeColorRows);
    wrap.innerHTML = list.map(function (option) {
      var selected = option.id === selectedSizeId;
      var label = L(option.label) || option.id;
      if (sizeSwatches) {
        var swatchClass = 'product-big-swatch' + (option.swatchPattern ? ' product-big-swatch--' + esc(option.swatchPattern) : '');
        var swatchStyle = option.swatch ? ' style="background:' + esc(option.swatch) + '"' : '';
        return '<button type="button" class="product-size-choice product-swatch-choice' + (selected ? ' is-selected' : '') + '" data-size="' + esc(option.id) + '" aria-label="' + esc(label) + '" title="' + esc(label) + '" aria-pressed="' + selected + '">' +
          '<span class="' + swatchClass + '"' + swatchStyle + '></span>' +
          '<span class="product-size-choice__check" aria-hidden="true">✓</span>' +
        '</button>';
      }
      if (sizeColorRows) {
        var rowSwatchClass = 'product-color-swatch' + (option.swatchPattern ? ' product-color-swatch--' + esc(option.swatchPattern) : '');
        var rowSwatchStyle = option.swatch ? ' style="background:' + esc(option.swatch) + '"' : '';
        return '<button type="button" class="product-size-choice product-color-row-choice' + (selected ? ' is-selected' : '') + '" data-size="' + esc(option.id) + '" aria-pressed="' + selected + '">' +
          '<span class="product-size-choice__label product-color-choice__label"><span class="' + rowSwatchClass + '"' + rowSwatchStyle + '></span><strong>' + esc(label) + '</strong></span>' +
          '<span class="product-size-choice__check" aria-hidden="true">✓</span>' +
        '</button>';
      }
      var sizePrice = L(option.priceLabel) || money(Number(product.price) + Number(option.addPrice || 0));
      var priceHtml = product.hideSizePrice ? '' : '<small>' + esc(sizePrice) + '</small>';
      return '<button type="button" class="product-size-choice' + (selected ? ' is-selected' : '') + '" data-size="' + esc(option.id) + '" aria-pressed="' + selected + '">' +
        '<span class="product-size-choice__label">' + esc(label) + priceHtml + '</span>' +
        '<span class="product-size-choice__check" aria-hidden="true">✓</span>' +
      '</button>';
    }).join('');

    if (status) {
      status.textContent = selectedSize() ? (lang === 'he' ? 'נבחר ✓' : 'Selected ✓') : (lang === 'he' ? 'נא לבחור' : 'Choose one');
      status.classList.toggle('is-done', !!selectedSize());
    }
  }

  function renderColorOptions() {
    var block = $('#colorBlock');
    var wrap = $('#colorOptions');
    var status = $('#colorStatus');
    if (!block || !wrap) return;

    if (!hasColorOptions()) {
      block.hidden = true;
      block.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }

    block.hidden = false;
    block.style.display = '';
    var list = product.colors || [];
    var colorSwatches = product.colorDisplay === 'swatch';
    var colorRows = product.colorDisplay === 'color-row';
    var colorImageChoices = product.colorDisplay === 'image-choice';
    wrap.classList.toggle('product-swatch-grid', !!colorSwatches);
    wrap.classList.toggle('product-color-row-grid', !!colorRows);
    wrap.classList.toggle('product-option-grid', !!colorImageChoices);
    wrap.classList.toggle('product-option-grid--colors', !!colorImageChoices);
    wrap.innerHTML = list.map(function (option) {
      var selected = option.id === selectedColorId;
      var label = L(option.label) || option.id;
      if (colorImageChoices) {
        var optionImage = option.image || ((product.images && product.images[0]) || '');
        return '<button type="button" class="product-choice product-choice--color' + (selected ? ' is-selected' : '') + '" data-color="' + esc(option.id) + '" aria-pressed="' + selected + '">' +
          '<span class="product-choice__image product-choice__image--color"><img src="' + esc(optionImage) + '" alt="' + esc(label) + '" loading="lazy"></span>' +
          '<span class="product-choice__footer">' +
            '<span><strong>' + esc(label) + '</strong></span>' +
            '<span class="product-choice__check" aria-hidden="true">✓</span>' +
          '</span>' +
        '</button>';
      }
      if (colorSwatches) {
        var bigSwatchClass = 'product-big-swatch' + (option.swatchPattern ? ' product-big-swatch--' + esc(option.swatchPattern) : '');
        var bigSwatchStyle = option.swatch ? ' style="background:' + esc(option.swatch) + '"' : '';
        return '<button type="button" class="product-size-choice product-color-choice product-swatch-choice' + (selected ? ' is-selected' : '') + '" data-color="' + esc(option.id) + '" aria-label="' + esc(label) + '" title="' + esc(label) + '" aria-pressed="' + selected + '">' +
          '<span class="' + bigSwatchClass + '"' + bigSwatchStyle + '></span>' +
          '<span class="product-size-choice__check" aria-hidden="true">✓</span>' +
        '</button>';
      }
      var swatchClass = 'product-color-swatch' + (option.swatchPattern ? ' product-color-swatch--' + esc(option.swatchPattern) : '');
      var swatchStyle = option.swatch ? ' style="background:' + esc(option.swatch) + '"' : '';
      var swatch = option.swatch ? '<span class="' + swatchClass + '"' + swatchStyle + '></span>' : '';
      var colorPriceText = L(option.priceLabel) || (Number(option.addPrice || 0) ? '+' + money(Number(option.addPrice || 0)) : '');
      var colorPriceHtml = colorPriceText ? '<small>' + esc(colorPriceText) + '</small>' : '';
      return '<button type="button" class="product-size-choice product-color-choice' + (colorRows ? ' product-color-row-choice' : '') + (selected ? ' is-selected' : '') + '" data-color="' + esc(option.id) + '" aria-pressed="' + selected + '">' +
        '<span class="product-size-choice__label product-color-choice__label">' + swatch + '<strong>' + esc(label) + '</strong>' + colorPriceHtml + '</span>' +
        '<span class="product-size-choice__check" aria-hidden="true">✓</span>' +
      '</button>';
    }).join('');

    if (status) {
      status.textContent = selectedColor() ? (lang === 'he' ? 'נבחר ✓' : 'Selected ✓') : (lang === 'he' ? 'נא לבחור' : 'Choose one');
      status.classList.toggle('is-done', !!selectedColor());
    }
  }

  function arrangeProduct10CompactOptions() {
    if (!product || product.slug !== 'product-10') return;

    var sizeBlock = $('#sizeBlock');
    var colorBlock = $('#colorBlock');
    var sizeOptions = $('#sizeOptions');
    var colorOptions = $('#colorOptions');
    if (!sizeBlock || !colorBlock || !sizeOptions || !colorOptions) return;

    sizeBlock.classList.add('product10-combined-options');
    colorBlock.classList.add('product10-width-group');
    sizeOptions.classList.add('product10-length-grid');
    colorOptions.classList.add('product10-width-grid');

    if (colorBlock.parentNode !== sizeBlock) sizeBlock.appendChild(colorBlock);

    if (!document.getElementById('product10CompactOptionsStyle')) {
      var style = document.createElement('style');
      style.id = 'product10CompactOptionsStyle';
      style.textContent = [
        'body[data-product-slug="product-10"] #sizeBlock.product10-combined-options{padding:.85rem!important;gap:.65rem!important;margin-bottom:1rem!important;background:#eef9ff!important;border:1px solid #d7edf8!important;border-radius:18px!important}',
        'body[data-product-slug="product-10"] #sizeBlock.product10-combined-options>.product-option-head{margin:0 0 .15rem!important}',
        'body[data-product-slug="product-10"] #sizeBlock.product10-combined-options .product-option-step{width:26px!important;height:26px!important;border-radius:8px!important;font-size:.75rem!important}',
        'body[data-product-slug="product-10"] #sizeBlock.product10-combined-options .product-option-head h2{font-size:1rem!important;margin:0!important}',
        'body[data-product-slug="product-10"] #sizeBlock.product10-combined-options .product-option-status{font-size:.78rem!important}',
        'body[data-product-slug="product-10"] #sizeOptions.product10-length-grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:.45rem!important}',
        'body[data-product-slug="product-10"] #sizeOptions.product10-length-grid .product-size-choice{min-height:54px!important;padding:.48rem .58rem!important;border-radius:11px!important;gap:.35rem!important}',
        'body[data-product-slug="product-10"] #sizeOptions.product10-length-grid .product-size-choice__label{gap:.12rem!important;font-size:.82rem!important;line-height:1.25!important}',
        'body[data-product-slug="product-10"] #sizeOptions.product10-length-grid .product-size-choice__label small{font-size:.69rem!important}',
        'body[data-product-slug="product-10"] #sizeOptions.product10-length-grid .product-size-choice__check{width:18px!important;height:18px!important;font-size:.65rem!important}',
        'body[data-product-slug="product-10"] #colorBlock.product10-width-group{display:grid!important;gap:.5rem!important;margin:0!important;padding:.7rem 0 0!important;border:0!important;border-top:1px solid #d7edf8!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}',
        'body[data-product-slug="product-10"] #colorBlock.product10-width-group>.product-option-head{margin:0!important}',
        'body[data-product-slug="product-10"] #colorBlock.product10-width-group .product-option-step{background:#d9f2ff!important;color:#236d91!important}',
        'body[data-product-slug="product-10"] #colorOptions.product10-width-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:.45rem!important}',
        'body[data-product-slug="product-10"] #colorOptions.product10-width-grid .product-size-choice{min-height:50px!important;padding:.45rem .65rem!important;border-radius:11px!important}',
        'body[data-product-slug="product-10"] #colorOptions.product10-width-grid .product-size-choice__label{flex-direction:row!important;align-items:center!important;gap:.35rem!important;font-size:.84rem!important}',
        'body[data-product-slug="product-10"] #colorOptions.product10-width-grid .product-size-choice__label small{font-size:.7rem!important;margin-inline-start:auto!important}',
        'body[data-product-slug="product-10"] #colorOptions.product10-width-grid .product-size-choice__check{width:18px!important;height:18px!important;font-size:.65rem!important}',
        '@media(max-width:760px){body[data-product-slug="product-10"] #sizeOptions.product10-length-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}body[data-product-slug="product-10"] #colorOptions.product10-width-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}',
        '@media(max-width:430px){body[data-product-slug="product-10"] #sizeBlock.product10-combined-options{padding:.7rem!important}body[data-product-slug="product-10"] #sizeOptions.product10-length-grid .product-size-choice{min-height:50px!important;padding:.42rem .5rem!important}body[data-product-slug="product-10"] #colorOptions.product10-width-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}body[data-product-slug="product-10"] #colorOptions.product10-width-grid .product-size-choice{padding:.42rem!important}}'
      ].join('');
      document.head.appendChild(style);
    }
  }

  function renderCustomName() {
    var block = $('#customNameBlock');
    var input = $('#customNameInput');
    var label = $('#customNameLabel');
    var status = $('#customNameStatus');
    var help = $('#customNameHelp');
    var count = $('#customNameCount');
    if (!block || !input) return;

    if (!hasCustomName()) {
      block.hidden = true;
      block.style.display = 'none';
      return;
    }

    var max = customNameMax();
    block.hidden = false;
    block.style.display = '';
    input.maxLength = max;
    var lettersOnly = !!product.customName.lettersOnly;
    if (lettersOnly) {
      input.setAttribute('pattern', '[A-Za-z]');
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocapitalize', 'characters');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('dir', 'ltr');
      input.classList.add('is-uppercase-initial');
    } else {
      input.removeAttribute('pattern');
      input.removeAttribute('autocapitalize');
      input.removeAttribute('spellcheck');
      input.setAttribute('dir', 'auto');
      input.classList.remove('is-uppercase-initial');
    }
    customNameValue = cleanCustomName(customNameValue);
    if (input.value !== customNameValue) input.value = customNameValue;
    if (label) label.textContent = L(product.customName.label) || (lang === 'he' ? 'השם שיופיע על השרשרת' : 'Name on the necklace');
    input.placeholder = L(product.customName.placeholder) || (lang === 'he' ? 'לדוגמה: Audrey' : 'Example: Audrey');
    if (help) help.textContent = L(product.customName.help) || (lang === 'he' ? 'השם ייוצר בדיוק כפי שהוקלד. בדקו איות לפני ההוספה לסל.' : 'The name will be made exactly as entered. Check spelling before adding to cart.');
    if (count) count.textContent = String(customNameValue.length) + '/' + max;
    var ready = customNameReady();
    if (status) {
      status.textContent = ready ? (lang === 'he' ? 'מוכן ✓' : 'Ready ✓') : (lang === 'he' ? 'נא למלא' : 'Required');
      status.classList.toggle('is-done', ready);
    }
  }

  function productPhotoStorageKey() {
    return 'kw_product_photo_' + product.id;
  }

  function makePhotoAssetId() {
    return 'photo-' + product.id + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function openProductPhotoDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      var req = indexedDB.open('kw_product_photos', 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'productId' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('DB open failed')); };
    });
  }

  async function saveProductPhotoLocally(blob, meta) {
    try {
      var db = await openProductPhotoDb();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put({ productId: product.id, blob: blob, assetId: meta.assetId, fileName: meta.fileName, savedAt: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error || new Error('DB write failed')); };
      });
      db.close();
    } catch (e) {}
  }

  async function deleteProductPhotoLocally() {
    try {
      var db = await openProductPhotoDb();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').delete(product.id);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
      db.close();
    } catch (e) {}
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error || new Error('File read failed')); };
      reader.readAsDataURL(blob);
    });
  }

  function resizePhotoToPng(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var maxSide = 1400;
          var scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          var w = Math.max(1, Math.round(img.naturalWidth * scale));
          var h = Math.max(1, Math.round(img.naturalHeight * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob); else reject(new Error('Photo conversion failed'));
          }, 'image/png', 0.94);
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Invalid image')); };
      img.src = url;
    });
  }

  async function uploadProductPhoto(blob, meta) {
    var storage = CFG.greetingStorage || {};
    var endpoint = String(storage.appsScriptUrl || '').trim();
    if (!endpoint || !/\/exec(?:$|\?)/.test(endpoint)) throw new Error('Upload endpoint is not configured');
    var dataUrl = await blobToDataUrl(blob);
    var form = new FormData();
    form.append('image', dataUrl);
    form.append('greetingId', meta.assetId);
    form.append('productId', String(product.slug || product.id || 'product'));
    form.append('template', 'projection-photo');
    form.append('fileName', meta.fileName);
    await fetch(endpoint, { method: 'POST', mode: 'no-cors', credentials: 'omit', cache: 'no-store', body: form });
  }

  function renderCustomPhoto() {
    var block = $('#customPhotoBlock');
    var status = $('#customPhotoStatus');
    var label = $('#customPhotoLabel');
    var help = $('#customPhotoHelp');
    var previewWrap = $('#customPhotoPreviewWrap');
    var preview = $('#customPhotoPreview');
    var removeBtn = $('#customPhotoRemove');
    if (!block) return;

    if (!hasCustomPhoto()) {
      block.hidden = true;
      block.style.display = 'none';
      return;
    }

    block.hidden = false;
    block.style.display = '';
    if (label) label.textContent = L(product.customPhoto.label) || (lang === 'he' ? 'בחרו תמונה מהמכשיר' : 'Choose a photo from your device');
    if (help) help.textContent = L(product.customPhoto.help) || (lang === 'he' ? 'התמונה תישמר להזמנה.' : 'The photo is saved with your order.');
    if (status) {
      status.textContent = customPhotoUploading
        ? (lang === 'he' ? 'מעלה…' : 'Uploading…')
        : (customPhotoReady() ? (lang === 'he' ? 'נשמרה ✓' : 'Saved ✓') : (lang === 'he' ? 'נא להעלות' : 'Required'));
      status.classList.toggle('is-done', customPhotoReady());
    }
    if (previewWrap) previewWrap.hidden = !customPhotoValue;
    if (removeBtn) removeBtn.hidden = !customPhotoValue;
    if (preview && customPhotoPreviewUrl) preview.src = customPhotoPreviewUrl;
  }

  async function handleProductPhotoFile(file) {
    if (!file || !hasCustomPhoto()) return;
    if (!/^image\//i.test(file.type || '')) {
      toast(lang === 'he' ? 'יש לבחור קובץ תמונה' : 'Please choose an image file');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast(lang === 'he' ? 'התמונה גדולה מדי. המקסימום הוא 15MB' : 'The image is too large. Maximum 15MB');
      return;
    }

    customPhotoUploading = true;
    customPhotoValue = null;
    renderCustomPhoto();
    updatePriceAndPurchase();
    try {
      var blob = await resizePhotoToPng(file);
      var assetId = makePhotoAssetId();
      var fileName = assetId + '.png';
      var meta = { assetId: assetId, fileName: fileName };
      await saveProductPhotoLocally(blob, meta);
      await uploadProductPhoto(blob, meta);
      if (customPhotoPreviewUrl) { try { URL.revokeObjectURL(customPhotoPreviewUrl); } catch (e) {} }
      customPhotoPreviewUrl = URL.createObjectURL(blob);
      customPhotoValue = { assetId: assetId, fileName: fileName, provider: 'google-drive' };
      try { localStorage.setItem(productPhotoStorageKey(), JSON.stringify(customPhotoValue)); } catch (e) {}
      toast(lang === 'he' ? 'התמונה נשמרה להזמנה ✓' : 'Photo saved with your order ✓');
    } catch (err) {
      customPhotoValue = null;
      toast(lang === 'he' ? 'לא הצלחנו לשמור את התמונה. נסו שוב.' : 'Could not save the photo. Please try again.');
    } finally {
      customPhotoUploading = false;
      renderCustomPhoto();
      updatePriceAndPurchase();
    }
  }

  async function removeProductPhoto() {
    customPhotoValue = null;
    customPhotoUploading = false;
    if (customPhotoPreviewUrl) { try { URL.revokeObjectURL(customPhotoPreviewUrl); } catch (e) {} customPhotoPreviewUrl = ''; }
    try { localStorage.removeItem(productPhotoStorageKey()); } catch (e) {}
    await deleteProductPhotoLocally();
    var input = $('#customPhotoInput'); if (input) input.value = '';
    renderCustomPhoto();
    updatePriceAndPurchase();
  }

  function updateVariantImageFromSelections() {
    if (!product.variantImages) return;

    // Keep the big product image in sync with the choices immediately.
    // If only one of the visual options was chosen, use the first option as a
    // temporary visual fallback without marking it as selected.
    var outerId = selectedSizeId || (product.sizes && product.sizes[0] && product.sizes[0].id) || '';
    var shapeId = selectedNecklaceId || (product.necklaces && product.necklaces[0] && product.necklaces[0].id) || '';
    var centerColorId = selectedColorId || (product.colors && product.colors[0] && product.colors[0].id) || '';

    var keys = [
      outerId + '|' + shapeId + '|' + centerColorId,
      outerId + '|' + shapeId
    ];
    var src = '';
    for (var i = 0; i < keys.length; i++) {
      if (product.variantImages[keys[i]]) { src = product.variantImages[keys[i]]; break; }
    }
    if (!src) return;

    var idx = galleryImages().indexOf(src);
    if (idx >= 0) showGalleryImage(idx);
    else setMainImage(src, L(product.title));
  }

  function updateOptionSteps() {
    var ids = ['necklaceBlock', 'boxBlock', 'sizeBlock', 'colorBlock', 'customNameBlock', 'customPhotoBlock', 'giftPackagingBlock', 'requiredCompanionBlock'];
    var step = 1;
    ids.forEach(function (id) {
      var block = $('#' + id);
      if (!block || block.hidden || block.style.display === 'none') return;
      var badge = block.querySelector('.product-option-step');
      if (badge) badge.textContent = String(step++);
    });
  }

  async function restoreCustomPhoto() {
    if (!hasCustomPhoto() || customPhotoValue) return;
    try {
      var stored = JSON.parse(read(productPhotoStorageKey()) || 'null');
      if (stored && stored.assetId) customPhotoValue = { assetId: String(stored.assetId), fileName: String(stored.fileName || ''), provider: String(stored.provider || 'google-drive') };
    } catch (e) {}
    if (!customPhotoValue) { renderCustomPhoto(); updatePriceAndPurchase(); return; }
    try {
      var db = await openProductPhotoDb();
      var row = await new Promise(function (resolve, reject) {
        var req = db.transaction('photos', 'readonly').objectStore('photos').get(product.id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
      db.close();
      if (row && row.blob && row.assetId === customPhotoValue.assetId) {
        if (customPhotoPreviewUrl) { try { URL.revokeObjectURL(customPhotoPreviewUrl); } catch (e) {} }
        customPhotoPreviewUrl = URL.createObjectURL(row.blob);
      }
    } catch (e) {}
    renderCustomPhoto();
    updatePriceAndPurchase();
  }

  function renderGiftPackaging() {
    var block = $('#giftPackagingBlock');
    var grid = $('#giftPackagingOptions');
    var none = $('#giftPackagingNone');
    var status = $('#giftPackagingStatus');
    var heading = $('#giftPackagingHeading');
    var description = $('#giftPackagingDescription');
    if (!block) return;

    if (!hasGiftPackaging() || isCompanionPickerFlow()) {
      block.hidden = true;
      block.style.display = 'none';
      return;
    }

    block.hidden = false;
    block.style.display = '';
    if (heading) heading.textContent = L(product.giftPackaging.heading) || (lang === 'he' ? 'הוספת אריזה' : 'Add gift packaging');
    if (description) description.textContent = L(product.giftPackaging.description) || '';
    if (none) {
      none.textContent = lang === 'he' ? 'ללא אריזה נוספת' : 'No extra packaging';
      none.classList.toggle('is-selected', !selectedPackagingId);
    }
    if (status) {
      var selected = selectedPackaging();
      status.textContent = selected ? (lang === 'he' ? 'נוסף ✓' : 'Added ✓') : (lang === 'he' ? 'ללא אריזה' : 'No packaging');
      status.classList.toggle('is-done', !!selected);
    }
    if (grid) {
      grid.innerHTML = product.giftPackaging.options.map(function (option) {
        var selected = selectedPackagingId === option.id;
        return '<button class="product-packaging-choice' + (selected ? ' is-selected' : '') + '" type="button" data-packaging="' + esc(option.id) + '">' +
          '<span class="product-packaging-choice__image"><img src="' + esc(option.image || '') + '" alt="' + esc(L(option.label)) + '"></span>' +
          '<span class="product-packaging-choice__body"><strong>' + esc(L(option.label)) + '</strong><small>+' + esc(money(Number(option.addPrice || 0))) + '</small></span>' +
          '<span class="product-choice__check">✓</span>' +
        '</button>';
      }).join('');
    }
  }

  function selectPackaging(optionId) {
    if (!hasGiftPackaging()) return;
    if (!optionId) selectedPackagingId = null;
    else if (findOption(product.giftPackaging.options, optionId)) selectedPackagingId = optionId;
    renderGiftPackaging();
    updatePriceAndPurchase();
  }

  function renderRequiredCompanion() {
    var block = $('#requiredCompanionBlock');
    var status = $('#requiredCompanionStatus');
    var heading = $('#requiredCompanionHeading');
    var description = $('#requiredCompanionDescription');
    var button = $('#requiredCompanionButton');
    var readyNote = $('#requiredCompanionReady');
    if (!block) return;

    if (!requiresCompanion()) {
      block.hidden = true;
      block.style.display = 'none';
      return;
    }

    var colorReady = !hasColorOptions() || !!selectedColor();
    var ready = colorReady && companionReady();
    block.hidden = false;
    block.style.display = '';
    if (heading) heading.textContent = L(product.requiresCompanion.heading) || (lang === 'he' ? 'הוסף שרשרת - חובה' : 'Add a necklace - required');
    if (description) description.textContent = L(product.requiresCompanion.description) || '';
    if (status) {
      status.textContent = ready ? (lang === 'he' ? 'נוספה למארז ✓' : 'Added to packaging ✓') : (colorReady ? (lang === 'he' ? 'חובה' : 'Required') : (lang === 'he' ? 'בחרו צבע קודם' : 'Choose a color first'));
      status.classList.toggle('is-done', ready);
    }
    if (button) {
      var picker = product.requiresCompanion.pickerUrl || '/choose-necklace';
      if (!colorReady) {
        button.href = '#';
        button.setAttribute('aria-disabled', 'true');
        button.style.pointerEvents = 'none';
        button.style.opacity = '.55';
        button.textContent = lang === 'he' ? 'בחרו צבע למארז קודם' : 'Choose packaging color first';
      } else {
        button.removeAttribute('aria-disabled');
        button.style.pointerEvents = '';
        button.style.opacity = '';
        button.href = picker + '?returnTo=' + encodeURIComponent(product.id) + '&packageColor=' + encodeURIComponent(selectedColorId);
        button.textContent = ready ? (lang === 'he' ? 'החלפת שרשרת' : 'Change necklace') : (lang === 'he' ? 'הוסף שרשרת' : 'Add a necklace');
      }
    }
    if (readyNote) {
      readyNote.hidden = !ready;
      readyNote.textContent = lang === 'he' ? 'השרשרת נבחרה למארז ✓ עכשיו אפשר להוסיף לסל' : 'The necklace is selected for this packaging ✓ You can now add it to the cart';
    }
  }

  function renderSelectionSummary() {
    var necklace = selectedNecklace();
    var box = selectedBox();
    var nValue = $('#summaryNecklaceValue');
    var bValue = $('#summaryBoxValue');
    var nRow = $('#summaryNecklaceRow');
    var bRow = $('#summaryBoxRow');
    if (nRow) nRow.hidden = !hasNecklaceOptions();
    if (bRow) bRow.hidden = !hasBoxOptions();
    if (nValue) nValue.textContent = necklace ? L(necklace.label) : (lang === 'he' ? 'טרם נבחרה' : 'Not selected');
    if (bValue) bValue.textContent = box ? L(box.label) : (lang === 'he' ? 'טרם נבחרה' : 'Not selected');

    var nStatus = $('#necklaceStatus');
    var bStatus = $('#boxStatus');
    if (nStatus) {
      nStatus.textContent = necklace ? (lang === 'he' ? 'נבחר ✓' : 'Selected ✓') : (lang === 'he' ? 'נא לבחור' : 'Choose one');
      nStatus.classList.toggle('is-done', !!necklace);
    }
    if (bStatus) {
      bStatus.textContent = box ? (lang === 'he' ? 'נבחר ✓' : 'Selected ✓') : (lang === 'he' ? 'נא לבחור' : 'Choose one');
      bStatus.classList.toggle('is-done', !!box);
    }

    var hint = $('#galleryHint');
    if (hint) {
      if (hasNecklaceOptions() && !necklace) hint.textContent = L(product.necklaceHeading) || (lang === 'he' ? 'בחרו אפשרות' : 'Choose an option');
      else if (hasBoxOptions() && !box) hint.textContent = L(product.boxHeading) || (lang === 'he' ? 'בחרו אפשרות נוספת' : 'Choose another option');
      else if ((hasSizeOptions() && !selectedSize()) || (hasColorOptions() && !selectedColor())) hint.textContent = lang === 'he' ? 'השלימו את אפשרויות המוצר' : 'Complete the product options';
      else hint.textContent = lang === 'he' ? 'הבחירה שלכם מוכנה' : 'Your selection is ready';
    }
  }

  function updatePriceAndPurchase() {
    var box = selectedBox();
    var currentUnitPrice = unitPrice();
    var price = $('#productPrice');
    var compare = $('#productCompare');
    var addBtn = $('#addToCart');
    var minusBtn = $('#qtyMinus');
    var plusBtn = $('#qtyPlus');

    if (price) {
      if (isCompanionPickerFlow()) {
        /* This page is choosing the necklace that will be added to an already
           selected LOVE FOREVER package, so show only the necklace surcharge. */
        if (product.startingPrice || (hasBoxOptions() && !box)) {
          var pickerBasePrice = hasBoxOptions() && !box
            ? Number(product.price) + (savedGreeting() ? CUSTOM_GREETING_ADD_PRICE : 0)
            : currentUnitPrice;
          price.textContent = '+' + (lang === 'he' ? 'החל מ־' : 'From ') + money(pickerBasePrice);
        } else {
          price.textContent = '+' + money(currentUnitPrice);
        }
      } else if (product.startingPrice && !(requiresCompanion() && companionReady())) {
        price.textContent = (lang === 'he' ? 'החל מ־' : 'From ') + money(currentUnitPrice);
      } else if (hasBoxOptions() && !box) {
        price.textContent = (lang === 'he' ? 'החל מ־' : 'From ') + money(Number(product.price) + (savedGreeting() ? CUSTOM_GREETING_ADD_PRICE : 0));
      } else if (isGlassesProduct(product)) {
        price.textContent = glassesPriceDisplay(currentUnitPrice, qty);
      } else {
        price.textContent = money(currentUnitPrice);
      }
    }

    var salePill = $('#productSalePill');
    var saveAmount = $('#productSaveAmount');
    if (compare) {
      if (product.compareAt) {
        compare.hidden = false;
        var packaging = selectedPackaging();
        var selectedSizeOption = selectedSize();
        var selectedColorOption = selectedColor();
        var comparePrice = Number(product.compareAt) + (box ? Number(box.addPrice || 0) : 0) + (selectedSizeOption ? Number(selectedSizeOption.addPrice || 0) : 0) + (selectedColorOption ? Number(selectedColorOption.addPrice || 0) : 0) + (packaging ? Number(packaging.addPrice || 0) : 0) + (savedGreeting() ? CUSTOM_GREETING_ADD_PRICE : 0);
        compare.textContent = money(comparePrice);

        var discountPercent = Math.max(0, Math.round((1 - (Number(product.price) / Number(product.compareAt))) * 100));
        if (salePill) {
          salePill.hidden = discountPercent <= 0;
          salePill.textContent = discountPercent > 0 ? (lang === 'he' ? discountPercent + '% הנחה' : discountPercent + '% off') : '';
        }
        if (saveAmount) {
          var saved = Math.max(0, comparePrice - currentUnitPrice);
          saveAmount.hidden = saved < 1;
          saveAmount.textContent = saved >= 1 ? (lang === 'he' ? 'חיסכון ' + money(saved) : 'Save ' + money(saved)) : '';
        }
      } else {
        compare.hidden = true;
        if (salePill) salePill.hidden = true;
        if (saveAmount) saveAmount.hidden = true;
      }
    }

    var ready = isReadyToBuy();
    if (addBtn) {
      addBtn.disabled = !ready;
      if (hasNecklaceOptions() && !selectedNecklace()) {
        addBtn.textContent = L(product.necklaceRequiredText) || (lang === 'he' ? 'נא לבחור אפשרות' : 'Please choose an option');
      } else if (hasBoxOptions() && !selectedBox()) {
        addBtn.textContent = L(product.boxRequiredText) || (lang === 'he' ? 'נא לבחור אפשרות' : 'Please choose an option');
      } else if (hasSizeOptions() && !selectedSize()) {
        addBtn.textContent = L(product.sizeRequiredText) || (lang === 'he' ? 'נא לבחור אפשרות' : 'Please choose an option');
      } else if (hasColorOptions() && !selectedColor()) {
        addBtn.textContent = L(product.colorRequiredText) || (lang === 'he' ? 'נא לבחור צבע' : 'Please choose a color');
      } else if (hasCustomName() && !customNameReady()) {
        addBtn.textContent = lang === 'he' ? 'נא להקליד שם' : 'Please enter a name';
      } else if (hasCustomPhoto() && !customPhotoReady()) {
        addBtn.textContent = customPhotoUploading ? (lang === 'he' ? 'שומרים את התמונה…' : 'Saving photo…') : (lang === 'he' ? 'נא להעלות תמונה' : 'Please upload a photo');
      } else if (requiresCompanion() && !companionReady()) {
        addBtn.textContent = lang === 'he' ? 'נא להוסיף שרשרת למארז' : 'Please add a necklace to the packaging';
      } else if (requiresCompanion() && companionReady()) {
        addBtn.textContent = (lang === 'he' ? 'הוספה לסל - ' : 'Add to cart - ') + money(currentUnitPrice * qty);
      } else if (isCompanionPickerFlow()) {
        addBtn.textContent = (lang === 'he' ? 'הוסף שרשרת למארז - ' : 'Add necklace to packaging - ') + money(currentUnitPrice * qty);
      } else if (isGlassesProduct(product)) {
        addBtn.textContent = (lang === 'he' ? 'הוספה לסל - ' : 'Add to cart - ') + glassesPriceDisplay(currentUnitPrice, qty);
      } else {
        addBtn.textContent = (lang === 'he' ? 'הוספה לסל - ' : 'Add to cart - ') + money(currentUnitPrice * qty);
      }
    }
    if (minusBtn) minusBtn.disabled = !ready;
    if (plusBtn) plusBtn.disabled = !ready;
  }

  function renderOptions() {
    var optionsSection = $('.product-options');
    var summary = $('#selectionSummary');
    renderSizeOptions();
    renderColorOptions();
    arrangeProduct10CompactOptions();
    renderCustomName();
    renderCustomPhoto();
    renderGiftPackaging();
    renderRequiredCompanion();

    if (!isConfigurable()) {
      if (optionsSection) {
        optionsSection.hidden = true;
        optionsSection.style.display = 'none';
      }
      if (summary) {
        summary.hidden = true;
        summary.style.display = 'none';
      }
      activeImageIndex = Math.max(0, Math.min(activeImageIndex, Math.max(0, galleryImages().length - 1)));
      var img = galleryImages()[activeImageIndex] || (product.images && product.images[0]);
      if (img) setMainImage(img, L(product.title));
      renderStaticGallery();
      updateOptionSteps();
      updatePriceAndPurchase();
      return;
    }

    if (optionsSection) optionsSection.style.display = '';
    if (summary) summary.style.display = '';

    if (optionsSection) optionsSection.hidden = false;
    if (summary) summary.hidden = false;
    renderNecklaceOptions();
    renderBoxOptions();
    if (product.showAllGalleryThumbs) renderStaticGallery();
    renderSelectionSummary();
    updateOptionSteps();
    updatePriceAndPurchase();
  }

  function selectNecklace(optionId) {
    var option = findOption(product.necklaces, optionId);
    if (!option) return;
    selectedNecklaceId = option.id;
    updateVariantImageFromSelections();
    if (!product.variantImages && option.image) setMainImage(option.image, L(option.label));
    renderOptions();
  }

  function selectBox(optionId) {
    var option = findOption(product.boxes, optionId);
    if (!option) return;
    selectedBoxId = option.id;
    setMainImage(option.image, L(option.label));
    renderOptions();
  }

  function selectSize(optionId) {
    var option = findOption(product.sizes, optionId);
    if (!option) return;
    var unavailable = unavailableCombination(option.id, selectedColorId);
    if (unavailable) { showUnavailableCombination(unavailable); return; }
    selectedSizeId = option.id;
    updateVariantImageFromSelections();
    renderSizeOptions();
    renderSelectionSummary();
    updatePriceAndPurchase();
  }

  function selectColor(optionId) {
    var option = findOption(product.colors, optionId);
    if (!option) return;
    var unavailable = unavailableCombination(selectedSizeId, option.id);
    if (unavailable) { showUnavailableCombination(unavailable); return; }
    selectedColorId = option.id;
    if (requiresCompanion()) {
      var pending = readPendingBundle();
      if (pending && pending.returnTo === product.id && pending.item && product.requiresCompanion.productIds.indexOf(pending.item.id) !== -1) {
        pending.packageColor = option.id;
        pending.item.packaging = option.id;
        pending.item.key = '';
        save(PENDING_BUNDLE_KEY, JSON.stringify(pending));
      }
    }
    updateVariantImageFromSelections();
    if (!product.variantImages && option.image) {
      var colorImageIndex = galleryImages().indexOf(option.image);
      if (colorImageIndex >= 0) showGalleryImage(colorImageIndex);
      else setMainImage(option.image, L(option.label));
    }
    renderColorOptions();
    renderRequiredCompanion();
    updatePriceAndPurchase();
  }

  function addToCart() {
    if (hasNecklaceOptions() && !selectedNecklace()) {
      toast(L(product.necklaceRequiredText) || (lang === 'he' ? 'נא לבחור אפשרות' : 'Please choose an option'));
      return;
    }
    if (hasBoxOptions() && !selectedBox()) {
      toast(L(product.boxRequiredText) || (lang === 'he' ? 'נא לבחור אפשרות' : 'Please choose an option'));
      return;
    }
    if (hasSizeOptions() && !selectedSize()) {
      toast(lang === 'he' ? 'נא לבחור אורך' : 'Please choose a length');
      return;
    }
    if (hasColorOptions() && !selectedColor()) {
      toast(lang === 'he' ? 'נא לבחור צבע' : 'Please choose a color');
      return;
    }
    if (requiresCompanion()) {
      var pendingBundle = pendingCompanion();
      if (!pendingBundle || !pendingBundle.item) {
        toast(lang === 'he' ? 'בחרו שרשרת למארז לפני ההוספה לסל.' : 'Choose a necklace for the packaging before adding it to the cart.');
        return;
      }
      var bundleItem = pendingBundle.item;
      bundleItem.qty = qty;
      bundleItem.packaging = selectedColorId || pendingBundle.packageColor || bundleItem.packaging;
      bundleItem.key = '';
      var bundleKey = cartItemKey(bundleItem);
      bundleItem.key = bundleKey;
      var bundleItems = cart();
      var bundleFound = false;
      bundleItems.forEach(function (item) {
        if (cartItemKey(item) === bundleKey) {
          item.qty = (parseInt(item.qty, 10) || 0) + qty;
          item.key = bundleKey;
          bundleFound = true;
        }
      });
      if (!bundleFound) bundleItems.push(bundleItem);
      save(LS.cart, JSON.stringify(bundleItems));

      /* Keep the completed bundle in the cart, but reset the temporary
         necklace selection on the product page immediately after adding. */
      clearPendingBundle();
      qty = 1;
      updateCartCount();
      renderRequiredCompanion();
      updatePriceAndPurchase();
      toast(lang === 'he' ? 'השרשרת והמארז נוספו לסל' : 'Necklace and packaging added to cart');
      return;
    }
    if (hasCustomName() && !customNameReady()) {
      toast(lang === 'he' ? 'נא להקליד את השם שיופיע על השרשרת' : 'Please enter the name for the necklace');
      var input = $('#customNameInput');
      if (input) input.focus();
      return;
    }
    if (hasCustomPhoto() && !customPhotoReady()) {
      toast(customPhotoUploading ? (lang === 'he' ? 'התמונה עדיין נשמרת' : 'The photo is still saving') : (lang === 'he' ? 'נא להעלות תמונה אישית' : 'Please upload a custom photo'));
      return;
    }

    customNameValue = cleanCustomName(customNameValue);

    if (isCompanionPickerFlow()) {
      var returnTo = params.get('returnTo');
      var packageColor = companionPackageColor();
      var pendingItem = {
        id: product.id,
        qty: 1,
        necklace: selectedNecklaceId,
        box: selectedBoxId,
        size: selectedSizeId,
        color: selectedColorId,
        packaging: packageColor,
        customName: hasCustomName() ? customNameValue : null,
        customPhoto: hasCustomPhoto() ? customPhotoValue : null,
        greeting: savedGreeting()
      };
      pendingItem.key = cartItemKey(pendingItem);
      savePendingBundle(pendingItem, returnTo, packageColor);
      toast(lang === 'he' ? 'השרשרת נבחרה למארז' : 'Necklace selected for packaging');
      window.setTimeout(function () {
        var returnProduct = findProduct(returnTo);
        window.location.href = productPath(returnProduct) + '?bundleSelected=1' + (packageColor ? '&color=' + encodeURIComponent(packageColor) : '');
      }, 220);
      return;
    }

    var items = cart();
    var key = variantKey();
    var found = false;

    items.forEach(function (item) {
      var existingKey = item.key || (item.id + '|' + (item.necklace || '') + '|' + (item.box || '') + '|' + (item.size || '') + '|' + (item.color || '') + '|pack:' + (item.packaging || '') + '|' + (item.customName || '') + '|p:' + (item.customPhoto && item.customPhoto.assetId || ''));
      if (existingKey === key) {
        item.qty = (parseInt(item.qty, 10) || 0) + qty;
        item.key = key;
        found = true;
      }
    });

    if (!found) {
      items.push({
        id: product.id,
        qty: qty,
        necklace: selectedNecklaceId,
        box: selectedBoxId,
        size: selectedSizeId,
        color: selectedColorId,
        packaging: selectedPackagingId,
        customName: hasCustomName() ? customNameValue : null,
        customPhoto: hasCustomPhoto() ? customPhotoValue : null,
        greeting: savedGreeting(),
        key: key
      });
    }

    save(LS.cart, JSON.stringify(items));
    updateCartCount();
    toast(lang === 'he' ? 'נוסף לסל' : 'Added to cart');

  }

  function renderProduct() {
    /* In the LOVE FOREVER necklace-picker flow the package is already chosen
       on the package product. Keep it on the pending bundle only; do not mark
       it as this necklace's optional packaging, otherwise the 54.90 ₪ gets
       added to the necklace price a second time on this page. */
    if (isCompanionPickerFlow()) selectedPackagingId = null;
    if (!product) {
      window.location.href = '/#shop';
      return;
    }

    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    document.body.dataset.productSlug = String(product.slug || product.id || '');
    updateProductSeo();

    $('#brandName').textContent = L(CFG.brand.name);
    $('#footBrand').textContent = L(CFG.brand.name);
    $('#footBrandBottom').textContent = L(CFG.brand.name);

    var navShop = $('#navShop');
    var navHow = $('#navHow');
    var navFaq = $('#navFaq');
    var navContact = $('#navContact');
    if (navShop) navShop.textContent = lang === 'he' ? 'החנות' : 'Shop';
    if (navHow) navHow.textContent = lang === 'he' ? 'איך זה עובד' : 'How it works';
    if (navFaq) navFaq.textContent = lang === 'he' ? 'שאלות נפוצות' : 'FAQ';
    if (navContact) navContact.textContent = lang === 'he' ? 'צרו קשר' : 'Contact';

    var crumbCurrent = $('#crumbCurrent');
    if (crumbCurrent) crumbCurrent.textContent = L(product.title);
    $('#productTitle').textContent = L(product.title);
    $('#productSubtitle').textContent = L(product.subtitle);

    var delivery = product.deliveryBusinessDays || { min: 9, max: 25 };
    var deliveryLabel = $('#productDeliveryLabel');
    var deliveryValue = $('#productDeliveryValue');
    if (deliveryLabel) deliveryLabel.textContent = lang === 'he' ? 'זמן אספקה משוער:' : 'Estimated delivery:';
    if (deliveryValue) {
      deliveryValue.textContent = String(delivery.min || 9) + '–' + String(delivery.max || 25) + (lang === 'he' ? ' ימי עסקים' : ' business days');
      deliveryValue.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
    }

    var standalone = !(isConfigurable() || hasSizeOptions() || hasColorOptions() || hasCustomName() || hasCustomPhoto() || hasGiftPackaging() || requiresCompanion());
    document.body.classList.toggle('is-standalone-product', standalone);
    var divider = document.querySelector('.product-info__divider');
    if (divider) divider.hidden = standalone;

    var badge = L(product.badge);
    $('#productBadge').hidden = !badge;
    $('#productBadge').textContent = badge;

    $('#necklaceHeading').textContent = L(product.necklaceHeading) || (lang === 'he' ? 'בחרו שרשרת' : 'Choose a necklace');
    $('#boxHeading').textContent = L(product.boxHeading) || (lang === 'he' ? 'בחרו קופסה' : 'Choose a box');
    $('#summaryNecklaceLabel').textContent = L(product.necklaceSummaryLabel) || (lang === 'he' ? 'שרשרת' : 'Necklace');
    $('#summaryBoxLabel').textContent = L(product.boxSummaryLabel) || (lang === 'he' ? 'קופסה' : 'Box');
    var sizeHeading = $('#sizeHeading'); if (sizeHeading) sizeHeading.textContent = L(product.sizeHeading) || (lang === 'he' ? 'בחרו אורך' : 'Choose a length');
    var colorHeading = $('#colorHeading'); if (colorHeading) colorHeading.textContent = L(product.colorHeading) || (lang === 'he' ? 'בחרו צבע' : 'Choose a color');
    var photoHeading = $('#customPhotoHeading'); if (photoHeading) photoHeading.textContent = (product.customPhoto && L(product.customPhoto.heading)) || (lang === 'he' ? 'העלו תמונה' : 'Upload a photo');
    var customHeading = $('#customNameHeading'); if (customHeading) customHeading.textContent = (product.customName && L(product.customName.heading)) || (lang === 'he' ? 'הקלידו את השם שלכם' : 'Enter your name');

    var messageCard = document.querySelector('.message-card');
    var greetingCustomizer = $('#greetingCustomizer');
    var greeting = savedGreeting();
    if (supportsCustomGreeting()) {
      if (greetingCustomizer) {
        greetingCustomizer.hidden = false;
        $('#greetingDesignBtn').href = '/greeting-editor?id=' + encodeURIComponent(product.slug || product.id);
        $('#greetingDesignBtn').textContent = greeting
          ? (lang === 'he' ? 'עריכת הברכה האישית' : 'Edit custom greeting')
          : (lang === 'he' ? 'עיצוב ברכה אישית' : 'Design a custom greeting');
        $('#greetingCustomizerEyebrow').textContent = lang === 'he' ? 'ברכה אישית' : 'Custom greeting';
        $('#greetingCustomizerTitle').textContent = lang === 'he' ? 'רוצים לכתוב את המילים שלכם?' : 'Want to use your own words?';
        $('#greetingCustomizerStatus').textContent = greeting
          ? (lang === 'he' ? 'הברכה האישית נשמרה ונוספה להזמנה בתוספת 35 ₪ ✓' : 'Your custom greeting is saved and adds ₪35 to this item ✓')
          : (lang === 'he' ? 'הברכה המקורית כלולה במחיר. אפשר ליצור ברכה אישית בעיצוב משלכם.' : 'The original greeting is included. You can create your own custom greeting.');
        var removeBtn = $('#greetingRemoveBtn');
        if (removeBtn) { removeBtn.hidden = !greeting; removeBtn.textContent = lang === 'he' ? 'חזרה לברכה המקורית' : 'Use original greeting'; }
      }
      var previewEyebrow = $('#greetingPreviewEyebrow'); if (previewEyebrow) previewEyebrow.textContent = lang === 'he' ? 'העיצוב שבחרתם' : 'Your selected design';
      var previewTitle = $('#greetingPreviewTitle'); if (previewTitle) previewTitle.textContent = lang === 'he' ? 'הברכה האישית שלכם' : 'Your custom greeting';
      var previewPrice = $('#greetingPreviewPrice'); if (previewPrice) previewPrice.textContent = lang === 'he' ? '+35 ₪' : '+₪35';
      renderGreetingPngPreview(greeting);
    } else if (greetingCustomizer) {
      greetingCustomizer.hidden = true;
      var greetingPreviewBlock = $('#greetingPreviewBlock'); if (greetingPreviewBlock) greetingPreviewBlock.hidden = true;
    }

    if (hasMessageCard() && !greeting) {
      if (messageCard) messageCard.hidden = false;
      $('#messageHeading').textContent = lang === 'he' ? 'המסר שמצורף למתנה' : 'The message included with the gift';
      $('#cardTitle').textContent = L(product.cardTitle);
      $('#cardMessage').textContent = L(product.cardMessage);
      $('#cardSignature').textContent = L(product.signature);
    } else if (messageCard) {
      // When a custom greeting is selected, show its exact saved PNG above
      // instead of a second plain-text approximation of the design.
      messageCard.hidden = true;
    }

    var details = product.details && product.details.he || [];
    $('#productDetails').innerHTML = details.map(function (detail) {
      return '<div class="product-detail-row"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12.5l5 5L20 6.5"/></svg><span>' + esc(detail) + '</span></div>';
    }).join('');

    $('#qtyValue').textContent = qty;
    $('#assureShip').textContent = lang === 'he' ? 'משלוח עד הבית' : 'Door delivery';
    $('#assureSecure').textContent = lang === 'he' ? 'תשלום מאובטח' : 'Secure payment';
    $('#assureReturn').textContent = lang === 'he' ? '30 יום להחזרה' : '30-day returns';
    $('#footAbout').textContent = lang === 'he' ? 'שרשראות מתנה שמגיעות עם המילים שנשארות.' : 'Gift necklaces that arrive with words that stay.';
    $('#footShopTitle').textContent = lang === 'he' ? 'קניות' : 'Shop';
    $('#footShopLink').textContent = lang === 'he' ? 'החנות' : 'Shop';
    $('#footHowLink').textContent = lang === 'he' ? 'איך זה עובד' : 'How it works';
    $('#footFaqLink').textContent = lang === 'he' ? 'שאלות נפוצות' : 'FAQ';
    $('#footInfoTitle').textContent = lang === 'he' ? 'מידע' : 'Information';
    $('#footContactTitle').textContent = lang === 'he' ? 'יצירת קשר' : 'Contact';
    $('#productAfterText').textContent = product.afterText
      ? L(product.afterText)
      : (lang === 'he'
        ? 'השרשרת שתבחרו, הקופסה שתבחרו וכרטיס המסר מגיעים יחד - בלי שתצטרכו להרכיב, להדפיס או לארוז שום דבר.'
        : 'Your chosen necklace, chosen gift box and printed message card arrive together - ready to give.');

    renderFooterContact();

    var initialImage = (product.images && product.images[0]) || (product.boxes && product.boxes[0] && product.boxes[0].image) || (product.necklaces && product.necklaces[0] && product.necklaces[0].image);
    if (initialImage && !selectedNecklaceId && !selectedBoxId) setMainImage(initialImage, L(product.title));
    if (selectedColor() && selectedColor().image) {
      var restoredColorIndex = galleryImages().indexOf(selectedColor().image);
      if (restoredColorIndex >= 0) showGalleryImage(restoredColorIndex);
      else setMainImage(selectedColor().image, L(selectedColor().label));
    }

    renderOptions();
    restoreCustomPhoto();
  }

  function renderFooterContact() {
    var c = CFG.contact;
    var out = [];
    if (c.email) out.push('<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>');
    if (c.phone) out.push('<li><a href="tel:' + esc(c.phone.replace(/\s|-/g, '')) + '">' + esc(c.phone) + '</a></li>');
    if (c.whatsapp) out.push('<li><a href="https://wa.me/' + esc(c.whatsapp) + '" rel="noopener">WhatsApp</a></li>');
    $('#productFootContact').innerHTML = out.join('');
  }

  function changeQty(delta) {
    var ready = isReadyToBuy();
    if (!ready) return;
    qty = Math.max(1, qty + delta);
    $('#qtyValue').textContent = qty;
    updatePriceAndPurchase();
  }

  function resetProductNavMenuScroll(navmenu) {
    if (!navmenu) return;
    navmenu.scrollTop = 0;
    navmenu.scrollLeft = 0;
    if (typeof navmenu.scrollTo === 'function') navmenu.scrollTo(0, 0);
  }

  function setMenu(open) {
    var navmenu = $('#navmenu');
    resetProductNavMenuScroll(navmenu);
    navmenu.classList.toggle('is-open', open);
    $('#navScrim').hidden = !open;
    $('#burger').setAttribute('aria-expanded', String(open));
    if (open) {
      requestAnimationFrame(function () { resetProductNavMenuScroll(navmenu); });
    }
    if (!open) {
      $$('.nav__submenu.is-open').forEach(function (menu) { menu.classList.remove('is-open'); });
      $$('[data-nav-parent-toggle]').forEach(function (link) { link.setAttribute('aria-expanded', 'false'); });
    }
    document.body.classList.toggle('is-locked', open);
  }

  document.addEventListener('click', function (e) {
    var necklaceButton = e.target.closest('[data-necklace]');
    if (necklaceButton) { selectNecklace(necklaceButton.getAttribute('data-necklace')); return; }

    var boxButton = e.target.closest('[data-box]');
    if (boxButton) { selectBox(boxButton.getAttribute('data-box')); return; }

    var packagingButton = e.target.closest('[data-packaging]');
    if (packagingButton) { selectPackaging(packagingButton.getAttribute('data-packaging')); return; }

    var galleryButton = e.target.closest('[data-gallery-index]');
    if (galleryButton) { showGalleryImage(parseInt(galleryButton.getAttribute('data-gallery-index'), 10) || 0); return; }

    var galleryVideoButton = e.target.closest('[data-gallery-video-index]');
    if (galleryVideoButton) { showGalleryVideo(parseInt(galleryVideoButton.getAttribute('data-gallery-video-index'), 10) || 0); return; }

    var sizeButton = e.target.closest('[data-size]');
    if (sizeButton) { selectSize(sizeButton.getAttribute('data-size')); return; }

    var colorButton = e.target.closest('[data-color]');
    if (colorButton) { selectColor(colorButton.getAttribute('data-color')); return; }

    if (e.target.closest('#qtyMinus')) { changeQty(-1); return; }
    if (e.target.closest('#qtyPlus')) { changeQty(1); return; }
    if (e.target.closest('#addToCart')) { addToCart(); return; }
    var greetingDesignTarget = e.target.closest('#greetingDesignBtn');
    if (greetingDesignTarget && supportsCustomGreeting()) {
      /* Price approval happens only when the greeting is saved in the editor. */
    }
    if (e.target.closest('#greetingRemoveBtn')) { removeCustomGreeting(); return; }

    var navParentToggle = e.target.closest('[data-nav-parent-toggle]');
    if (navParentToggle && window.matchMedia('(max-width: 980px)').matches) {
      e.preventDefault();
      var navItem = navParentToggle.closest('.nav__item--has-submenu');
      var navSubmenu = navItem && navItem.querySelector('.nav__submenu');
      if (navSubmenu) {
        var willOpen = !navSubmenu.classList.contains('is-open');
        $$('.nav__submenu.is-open').forEach(function (menu) {
          if (menu !== navSubmenu) menu.classList.remove('is-open');
        });
        $$('[data-nav-parent-toggle][aria-expanded="true"]').forEach(function (link) {
          if (link !== navParentToggle) link.setAttribute('aria-expanded', 'false');
        });
        navSubmenu.classList.toggle('is-open', willOpen);
        navParentToggle.setAttribute('aria-expanded', String(willOpen));
      }
      return;
    }

    if (e.target.closest('#burger')) { setMenu(!$('#navmenu').classList.contains('is-open')); return; }
    if (e.target.closest('#navScrim, [data-nav-close]') || e.target.closest('.nav__menu a')) { setMenu(false); }
  });

  var customPhotoInput = $('#customPhotoInput');
  if (customPhotoInput) {
    customPhotoInput.addEventListener('change', function () {
      var file = customPhotoInput.files && customPhotoInput.files[0];
      if (file) handleProductPhotoFile(file);
    });
  }
  var customPhotoRemove = $('#customPhotoRemove');
  if (customPhotoRemove) customPhotoRemove.addEventListener('click', function () { removeProductPhoto(); });

  var customInput = $('#customNameInput');
  if (customInput) {
    customInput.addEventListener('input', function () {
      customNameValue = cleanCustomName(customInput.value || '');
      customInput.value = customNameValue;
      renderCustomName();
      updatePriceAndPurchase();
    });
    customInput.addEventListener('blur', function () {
      customNameValue = cleanCustomName(customInput.value);
      customInput.value = customNameValue;
      renderCustomName();
      updatePriceAndPurchase();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  window.addEventListener('storage', function (event) {
    if (event && event.key === LS.cart) {
      updateCartCount();
      renderRequiredCompanion();
      updatePriceAndPurchase();
    }
  });

  window.addEventListener('scroll', function () {
    $('#nav').classList.toggle('is-stuck', window.scrollY > 10);
  }, { passive: true });

  /* The selected necklace for a LOVE FOREVER package is temporary.
     If the customer leaves or reloads this package product page, clear that
     selection. Items already added to the cart are stored separately and stay
     untouched. Also refresh bfcache-restored pages so stale UI cannot return. */
  if (requiresCompanion()) {
    window.addEventListener('pagehide', function () {
      clearPendingBundle();
    });
    window.addEventListener('pageshow', function (event) {
      if (!event.persisted) return;
      clearPendingBundle();
      refreshCompanionSelectionUi();
    });
  }

  $('#year').textContent = new Date().getFullYear();
  updateCartCount();
  renderProduct();
})();
