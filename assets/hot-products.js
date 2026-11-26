(function () {
  'use strict';
  var menu = document.getElementById('hotMobileMenu');
  var openButton = document.getElementById('hotMenuButton');
  var closeButton = document.getElementById('hotMenuClose');
  var scrim = document.getElementById('hotMenuScrim');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    openButton.setAttribute('aria-expanded', String(open));
    scrim.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  openButton.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  closeButton.addEventListener('click', function () { setMenu(false); });
  scrim.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') setMenu(false); });

  // Keep the exact same hidden categories and subcategories as the main menu.
  var hidden = window.__VERSANS_HIDDEN_CATEGORIES__ || {};
  Array.prototype.forEach.call(menu.querySelectorAll('[data-nav-cat], [data-nav-subcat], [data-nav-group]'), function (el) {
    var key = el.getAttribute('data-nav-group') || el.getAttribute('data-nav-subcat') || el.getAttribute('data-nav-cat');
    if (hidden[key] === true) el.style.setProperty('display', 'none', 'important');
  });
  var braceletsParent = document.getElementById('hotBraceletsParent');
  var braceletsSubmenu = document.getElementById('hotBraceletsSubmenu');
  if (braceletsParent && braceletsSubmenu) {
    braceletsParent.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      var expanded = braceletsParent.getAttribute('aria-expanded') === 'true';
      braceletsParent.setAttribute('aria-expanded', String(!expanded));
      braceletsSubmenu.hidden = expanded;
    });
  }
  var catalog = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  var routes = window.VERSANS_ROUTES;
  // Curated product slugs, never guessed from a product's array position.
  // The fallback for the green clover necklace checks PostgreSQL-backed catalog titles.
  var sections = [
    { title: 'שרשראות', category: 'necklaces', products: [
      { slug: 'product-10', label: 'שרשרת טניס קלאסית' },
      { slug: 'product-18', label: 'שרשרת טניס קלאסית – זהב' },
      { slug: 'product-296', label: 'שרשרת גורמט קלאסית', titleMatches: [/שרשרת.*גורמט.*קלאסי/] },
      { slug: 'product-294', label: 'שרשרת ICE NEW YORK' },
      { slug: 'product-278', label: 'שרשרת טניס תלתן – שחור' },
      { label: 'שרשרת טניס תלתן – ירוק', titleMatches: [/שרשרת.*טניס.*תלתן.*ירוק/, /שרשרת.*תלתן.*ירוק/] },
      { slug: 'product-279', label: 'שרשרת טניס תלתן – לבן' }
    ]},
    { title: 'צמידים', category: 'bracelets', products: [
      { slug: 'product-237', label: 'צמיד טניס קלאסי' },
      { slug: 'product-292', label: 'צמיד גורמט קלאסי – כסף' },
      { slug: 'product-293', label: 'צמיד גורמט קלאסי – זהב' },
      { slug: 'product-98', label: 'צמיד טניס תלתן – שחור' },
      { slug: 'product-97', label: 'צמיד טניס תלתן – ירוק' },
      { slug: 'product-99', label: 'צמיד טניס תלתן – לבן' }
    ]}
  ];

  function text(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    return String(value.he || value.en || '');
  }
  function normalize(value) { return String(value || '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function findProduct(item, category) {
    var bySlug = item.slug && catalog.find(function (product) {
      return product && (product.slug === item.slug || product.id === item.slug);
    });
    if (bySlug && (bySlug.category === category || (bySlug.categories || []).includes(category))) return bySlug;
    if (!item.titleMatches) return null;
    return catalog.find(function (product) {
      if (!product || !(product.category === category || (product.categories || []).includes(category))) return false;
      var title = normalize(text(product.title));
      return item.titleMatches.some(function (pattern) { return pattern.test(title); });
    }) || null;
  }
  function imageCandidates(product) {
    var images = [].concat(product.images || [], product.cardImage || [], product.hoverImage || []);
    return images.map(function (item) { return typeof item === 'string' ? item : item && (item.url || item.src) || ''; })
      .filter(function (item, index, all) { return typeof item === 'string' && item.trim() && all.indexOf(item) === index; })
      .map(function (item) {
        if (/^https?:\/\//i.test(item)) return item;
        return '/' + item.replace(/^\/+/, '');
      });
  }
  function price(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return '';
    return new Intl.NumberFormat('he-IL', { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(amount) + ' ₪';
  }
  function productLink(product) {
    if (routes && routes.productPath) return routes.productPath(product);
    return product.slug ? '/product.html?id=' + encodeURIComponent(product.slug) : '/';
  }
  function card(item, product) {
    var a = document.createElement('a');
    a.className = 'hot-card';
    a.href = productLink(product);
    a.setAttribute('aria-label', item.label);
    var imageWrap = document.createElement('div');
    imageWrap.className = 'hot-card__image-wrap';
    var img = document.createElement('img');
    img.className = 'hot-card__image';
    img.alt = text(product.title) || item.label;
    img.loading = 'lazy';
    img.decoding = 'async';
    var options = imageCandidates(product);
    var i = 0;
    img.onerror = function () {
      i += 1;
      if (i < options.length) img.src = options[i];
      else { img.remove(); imageWrap.textContent = 'VerSans'; imageWrap.style.display = 'grid'; imageWrap.style.placeItems = 'center'; }
    };
    if (options.length) img.src = options[0];
    else { img.alt = ''; imageWrap.textContent = 'VerSans'; imageWrap.style.display = 'grid'; imageWrap.style.placeItems = 'center'; }
    if (options.length) imageWrap.appendChild(img);
    a.appendChild(imageWrap);
    var details = document.createElement('div');
    details.className = 'hot-card__details';
    var h = document.createElement('h3');
    h.className = 'hot-card__title';
    h.textContent = item.label;
    details.appendChild(h);
    var current = Number(product.catalogPrice != null ? product.catalogPrice : product.price);
    var before = Number(product.compareAt);
    if (Number.isFinite(current) && current >= 0) {
      var prices = document.createElement('div');
      prices.className = 'hot-card__prices';
      var active = document.createElement('span');
      active.className = 'hot-card__price';
      active.textContent = price(current);
      prices.appendChild(active);
      if (Number.isFinite(before) && before > current) {
        var compare = document.createElement('span');
        compare.className = 'hot-card__compare';
        compare.textContent = price(before);
        prices.appendChild(compare);
      }
      details.appendChild(prices);
    }
    a.appendChild(details);
    return a;
  }
  var host = document.getElementById('hotContents');
  host.textContent = '';
  sections.forEach(function (section) {
    if (hidden[section.category]) return;
    var entries = section.products.map(function (item) {
      var product = findProduct(item, section.category);
      // Never show a hidden, deleted or unpublished catalog entry.
      return product ? { item: item, product: product } : null;
    }).filter(Boolean);
    if (!entries.length) return;
    var block = document.createElement('section');
    block.className = 'hot-section';
    var head = document.createElement('div');
    head.className = 'hot-section__head';
    var heading = document.createElement('h2');
    heading.textContent = section.title;
    head.appendChild(heading);
    var subtitle = document.createElement('span');
    subtitle.className = 'hot-section__subtitle';
    subtitle.textContent = 'הבחירות שלנו';
    head.appendChild(subtitle);
    block.appendChild(head);
    var grid = document.createElement('div');
    grid.className = 'hot-grid';
    entries.forEach(function (entry) { grid.appendChild(card(entry.item, entry.product)); });
    block.appendChild(grid);
    host.appendChild(block);
  });
  if (!host.children.length) {
    var empty = document.createElement('p');
    empty.className = 'hot-empty';
    empty.textContent = 'המוצרים הנבחרים אינם זמינים כרגע. אפשר לעיין בכל הקולקציה שלנו.';
    host.appendChild(empty);
  }
})();
