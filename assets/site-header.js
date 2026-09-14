(function(){
  'use strict';

  var FAVORITES_KEY = 'versans_favorites';
  var ROUTES = window.VERSANS_ROUTES || null;
  var catalog = window.PRODUCTS || PRODUCTS || [];

  function text(value){
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return value.he || value.en || '';
  }

  function normalize(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function productImage(product){
    if (!product) return '';
    if (Array.isArray(product.images) && product.images.length) return product.images[0];
    if (product.hoverImage) return product.hoverImage;
    if (Array.isArray(product.necklaces) && product.necklaces.length) return product.necklaces[0].image || '';
    return '';
  }

  function productUrl(product){
    if (ROUTES && ROUTES.productPath) return ROUTES.productPath(product);
    return product && product.urlSlug ? '/' + encodeURIComponent(product.urlSlug) : '/';
  }

  function readFavorites(){
    try {
      var value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      return Array.isArray(value) ? value.filter(Boolean) : [];
    } catch (err) {
      return [];
    }
  }

  function writeFavorites(ids){
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids)); } catch (err) {}
    updateFavoriteUi();
  }

  function isFavorite(id){
    return readFavorites().indexOf(id) !== -1;
  }

  function toggleFavorite(id){
    if (!id) return;
    var ids = readFavorites();
    var index = ids.indexOf(id);
    if (index === -1) ids.push(id); else ids.splice(index, 1);
    writeFavorites(ids);
  }

  function currentProductId(){
    try { return new URLSearchParams(location.search).get('id') || ''; } catch (err) { return ''; }
  }

  function updateFavoriteUi(){
    var ids = readFavorites();
    document.querySelectorAll('#favoritesCount, [data-favorites-count]').forEach(function(counter){
      counter.textContent = String(ids.length);
      counter.hidden = false;
    });

    var productButton = document.getElementById('productFavoriteBtn');
    if (productButton) {
      var active = isFavorite(currentProductId());
      productButton.classList.toggle('is-active', active);
      productButton.setAttribute('aria-pressed', String(active));
      var label = productButton.querySelector('[data-product-favorite-label]');
      if (label) label.textContent = active ? 'נשמר במועדפים' : 'שמירה למועדפים';
    }

    if (document.getElementById('siteFavoritesOverlay') && !document.getElementById('siteFavoritesOverlay').hidden) {
      renderFavorites();
    }
  }

  function ensureOverlays(){
    if (!document.getElementById('siteSearchOverlay')) {
      var search = document.createElement('div');
      search.id = 'siteSearchOverlay';
      search.className = 'site-overlay';
      search.hidden = true;
      search.innerHTML = '' +
        '<button class="site-overlay__backdrop" type="button" data-site-overlay-close aria-label="סגירה"></button>' +
        '<section class="site-overlay__panel site-search-panel" role="dialog" aria-modal="true" aria-labelledby="siteSearchTitle">' +
          '<div class="site-overlay__head"><h2 id="siteSearchTitle">חיפוש באתר</h2><button class="site-overlay__close" type="button" data-site-overlay-close aria-label="סגירה">×</button></div>' +
          '<label class="site-search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg><input id="siteSearchInput" type="search" autocomplete="off" placeholder="חפשו שעון, משקפיים, שרשרת..." aria-label="חיפוש מוצרים"></label>' +
          '<div class="site-search-results" id="siteSearchResults"></div>' +
        '</section>';
      document.body.appendChild(search);
    }

    if (!document.getElementById('siteFavoritesOverlay')) {
      var favorites = document.createElement('div');
      favorites.id = 'siteFavoritesOverlay';
      favorites.className = 'site-overlay';
      favorites.hidden = true;
      favorites.innerHTML = '' +
        '<button class="site-overlay__backdrop" type="button" data-site-overlay-close aria-label="סגירה"></button>' +
        '<section class="site-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="siteFavoritesTitle">' +
          '<div class="site-overlay__head"><h2 id="siteFavoritesTitle">המועדפים שלי</h2><button class="site-overlay__close" type="button" data-site-overlay-close aria-label="סגירה">×</button></div>' +
          '<div class="site-favorites-results" id="siteFavoritesResults"></div>' +
        '</section>';
      document.body.appendChild(favorites);
    }
  }

  function resultCard(product, withRemove){
    var image = productImage(product);
    var title = text(product.title) || 'מוצר VerSans';
    var price = Number(product.price);
    return '' +
      '<article class="site-result-card">' +
        '<a class="site-result-card__link" href="' + productUrl(product) + '">' +
          (image ? '<img src="' + image + '" alt="" loading="lazy">' : '<span class="site-result-card__placeholder" aria-hidden="true">V</span>') +
          '<span class="site-result-card__copy"><strong>' + escapeHtml(title) + '</strong>' +
          (Number.isFinite(price) ? '<span>₪' + price.toFixed(2) + '</span>' : '') + '</span>' +
        '</a>' +
        (withRemove ? '<button class="site-result-card__remove" type="button" data-remove-favorite="' + escapeHtml(product.id) + '" aria-label="הסרה מהמועדפים">×</button>' : '') +
      '</article>';
  }

  function escapeHtml(value){
    return String(value || '').replace(/[&<>"]/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch];
    });
  }

  function renderSearch(query){
    var box = document.getElementById('siteSearchResults');
    if (!box) return;
    var q = normalize(query);
    if (!q) {
      box.innerHTML = '<p class="site-overlay__empty">התחילו להקליד כדי למצוא מוצר.</p>';
      return;
    }
    var terms = q.split(' ').filter(Boolean);
    var matches = catalog.filter(function(product){
      var haystack = normalize([
        text(product.title), text(product.subtitle), product.category,
        Array.isArray(product.categories) ? product.categories.join(' ') : ''
      ].join(' '));
      return terms.every(function(term){ return haystack.indexOf(term) !== -1; });
    }).slice(0, 18);

    box.innerHTML = matches.length
      ? matches.map(function(product){ return resultCard(product, false); }).join('')
      : '<p class="site-overlay__empty">לא מצאנו מוצר שמתאים לחיפוש הזה.</p>';
  }

  function renderFavorites(){
    var box = document.getElementById('siteFavoritesResults');
    if (!box) return;
    var ids = readFavorites();
    var products = ids.map(function(id){
      return catalog.find(function(product){ return product.id === id; });
    }).filter(Boolean);
    box.innerHTML = products.length
      ? products.map(function(product){ return resultCard(product, true); }).join('')
      : '<div class="site-overlay__empty site-overlay__empty--large"><span aria-hidden="true">♡</span><strong>עדיין אין מוצרים במועדפים</strong><p>לחצו על הלב בעמוד מוצר כדי לשמור אותו כאן.</p></div>';
  }

  function closeOverlay(overlay){
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove('site-overlay-open');
  }

  function openSearch(){
    ensureOverlays();
    var overlay = document.getElementById('siteSearchOverlay');
    overlay.hidden = false;
    document.body.classList.add('site-overlay-open');
    var input = document.getElementById('siteSearchInput');
    renderSearch(input.value);
    window.setTimeout(function(){ input.focus(); }, 40);
  }

  function openFavorites(){
    ensureOverlays();
    renderFavorites();
    document.getElementById('siteFavoritesOverlay').hidden = false;
    document.body.classList.add('site-overlay-open');
  }

  document.addEventListener('click', function(event){
    var searchButton = event.target.closest('[data-site-search-open]');
    if (searchButton) { event.preventDefault(); openSearch(); return; }

    var favoritesButton = event.target.closest('[data-site-favorites-open]');
    if (favoritesButton) { event.preventDefault(); openFavorites(); return; }

    var close = event.target.closest('[data-site-overlay-close]');
    if (close) { closeOverlay(close.closest('.site-overlay')); return; }

    var remove = event.target.closest('[data-remove-favorite]');
    if (remove) { toggleFavorite(remove.getAttribute('data-remove-favorite')); return; }

    var productFavorite = event.target.closest('#productFavoriteBtn');
    if (productFavorite) { toggleFavorite(currentProductId()); return; }
  });

  document.addEventListener('input', function(event){
    if (event.target && event.target.id === 'siteSearchInput') renderSearch(event.target.value);
  });

  document.addEventListener('keydown', function(event){
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.site-overlay:not([hidden])').forEach(closeOverlay);
  });

  window.addEventListener('storage', function(event){
    if (event.key === FAVORITES_KEY) updateFavoriteUi();
  });

  ensureOverlays();
  updateFavoriteUi();
})();
