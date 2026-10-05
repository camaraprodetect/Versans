(function () {
  'use strict';

  if (window.__versansBotLoaded) return;
  window.__versansBotLoaded = true;

  var BOT_VERSION = '20261005-ai-v6';
  var CHAT_STORAGE_KEY = 'versansBotChatV2';
  var activeChatStorageKey = CHAT_STORAGE_KEY + ':guest';
  var chatScopeReady = false;
  var chatRestoreDone = false;
  var AI_ENDPOINT = '/api/versans-bot';
  var CATALOG_SRC = '/assets/products.js?v=20261003-delete-tachymeter-black-v35';
  var MAX_MESSAGE_LENGTH = 500;
  var productCatalogPromise = null;
  var knowledgePromise = null;
  var messageCounter = 0;
  var conversationHistory = [];
  var storedChat = [];

  function sanitizeStoredLinks(links) {
    return Array.isArray(links) ? links.slice(0, 4).map(function (item) {
      if (!item || typeof item !== 'object') return null;
      var label = cleanText(item.label || '').slice(0, 120);
      var url = String(item.url || '').trim();
      if (!label || !url || !/^\/?(?:[^\s]*$)/.test(url)) return null;
      return { label: label, url: url, external: !!item.external };
    }).filter(Boolean) : [];
  }

  function sanitizeStoredImages(images) {
    return Array.isArray(images) ? images.slice(0, 3).map(function (item) {
      if (!item || typeof item !== 'object') return null;
      var url = String(item.url || '').trim();
      var alt = cleanText(item.alt || 'מוצר VerSans').slice(0, 180);
      var linkUrl = String(item.linkUrl || '').trim();
      if (!/^\/images\/[A-Za-z0-9_./%()\-]+$/.test(url) || url.indexOf('..') !== -1) return null;
      if (linkUrl && (!/^\/[^\s]*$/.test(linkUrl) || linkUrl.indexOf('//') === 0)) linkUrl = '';
      return { url: url, alt: alt || 'מוצר VerSans', linkUrl: linkUrl };
    }).filter(Boolean) : [];
  }

  function resolveChatScope() {
    return fetch('/api/auth/me', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (data && data.user && data.user.id != null) activeChatStorageKey = CHAT_STORAGE_KEY + ':user:' + String(data.user.id);
        else activeChatStorageKey = CHAT_STORAGE_KEY + ':guest';
      })
      .catch(function () { activeChatStorageKey = CHAT_STORAGE_KEY + ':guest'; })
      .then(function () { chatScopeReady = true; });
  }

  var chatScopePromise = resolveChatScope();

  function loadStoredChat() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem(activeChatStorageKey) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-30).map(function (item) {
        if (!item || (item.role !== 'user' && item.role !== 'bot')) return null;
        var text = cleanText(item.text || '').slice(0, 2200);
        if (!text) return null;
        return { role: item.role, text: text, links: sanitizeStoredLinks(item.links), images: sanitizeStoredImages(item.images) };
      }).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function saveStoredChat() {
    try {
      sessionStorage.setItem(activeChatStorageKey, JSON.stringify(storedChat.slice(-30)));
    } catch (e) {}
  }

  function rememberChatMessage(role, payload) {
    payload = typeof payload === 'string' ? { text: payload } : (payload || {});
    var text = cleanText(payload.text || '').slice(0, 2200);
    if (!text || (role !== 'user' && role !== 'bot')) return;
    storedChat.push({ role: role, text: text, links: sanitizeStoredLinks(payload.links), images: sanitizeStoredImages(payload.images) });
    storedChat = storedChat.slice(-30);
    saveStoredChat();
  }

  var DOCS = [
    { id: 'policies', title: 'תקנון ומדיניות', url: '/policies' },
    { id: 'warranty', title: 'אחריות לחצי שנה', url: '/warranty' },
    { id: 'bracelet-size', title: 'מדריך מידות לצמידים', url: '/bracelet-size-guide' },
    { id: 'ring-size', title: 'מדריך מידות לטבעות', url: '/ring-size-guide' },
    { id: 'necklace-size', title: 'מדריך מידות לשרשראות', url: '/necklace-size-guide' }
  ];

  var QUICK_LINKS = {
    home: { label: 'כל המוצרים', url: '/' },
    necklaces: { label: 'שרשראות', url: '/necklaces' },
    bracelets: { label: 'צמידים', url: '/bracelets' },
    rings: { label: 'טבעות', url: '/rings' },
    watches: { label: 'שעונים', url: '/watches' },
    glasses: { label: 'משקפיים', url: '/glasses' },
    hats: { label: 'כובעים', url: '/hats' },
    photo: { label: 'תכשיט עם תמונה', url: '/photo-bracelets' },
    greeting: { label: 'תכשיט עם ברכה', url: '/message-jewelry' },
    track: { label: 'מעקב הזמנה', url: '/track' },
    policies: { label: 'תקנון ומדיניות', url: '/policies' },
    warranty: { label: 'אחריות לחצי שנה', url: '/warranty' },
    braceletSize: { label: 'מידות לצמידים', url: '/bracelet-size-guide' },
    ringSize: { label: 'מידות לטבעות', url: '/ring-size-guide' },
    necklaceSize: { label: 'מידות לשרשראות', url: '/necklace-size-guide' },
    login: { label: 'התחברות', url: '/login' },
    register: { label: 'הרשמה', url: '/register' }
  };

  var STOP_WORDS = new Set([
    'אני','את','אתה','אתם','אתן','זה','זאת','זו','של','שלי','שלך','שלו','שלה','עם','בלי','על','אל','אם','גם','מה','מי','איך','כמה','למה','יש','אין','האם','אפשר','יכול','יכולה','יכולים','רוצה','רוצים','תביא','תן','לי','פה','כאן','הזה','הזאת','הזו','בבקשה','או','ו','ה','ב','ל','מ','ש','כ'
  ]);

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/[\u0591-\u05C7]/g, '')
      .toLowerCase()
      .replace(/[״“”"'׳]/g, '')
      .replace(/[^\p{L}\p{N}+.%₪]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(value) {
    return normalize(value)
      .split(' ')
      .map(function (token) { return token.trim(); })
      .filter(function (token) { return token.length > 1 && !STOP_WORDS.has(token); });
  }

  function containsAny(value, terms) {
    var n = normalize(value);
    return terms.some(function (term) { return n.indexOf(normalize(term)) !== -1; });
  }

  function he(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(he).filter(Boolean).join(', ');
    if (typeof value === 'object') return String(value.he || value.en || value.label || '');
    return '';
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  function truncate(value, max) {
    var text = cleanText(value);
    var limit = max || MAX_MESSAGE_LENGTH;
    if (text.length <= limit) return text;
    var cut = text.slice(0, limit);
    var last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (last > limit * 0.55) cut = cut.slice(0, last + 1);
    return cut.replace(/[\s,;:]+$/, '') + '...';
  }

  function formatPrice(value) {
    var num = Number(value);
    if (!Number.isFinite(num)) return '';
    return num.toFixed(2).replace(/\.00$/, '') + ' ₪';
  }

  function getProducts() {
    if (Array.isArray(window.PRODUCTS)) return window.PRODUCTS;
    return [];
  }

  function ensureProducts() {
    if (getProducts().length) return Promise.resolve(getProducts());
    if (productCatalogPromise) return productCatalogPromise;
    productCatalogPromise = new Promise(function (resolve) {
      var existing = document.querySelector('script[data-versans-bot-products]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(getProducts()); }, { once: true });
        existing.addEventListener('error', function () { resolve([]); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = CATALOG_SRC;
      script.async = true;
      script.setAttribute('data-versans-bot-products', '1');
      script.onload = function () { resolve(getProducts()); };
      script.onerror = function () { resolve([]); };
      document.head.appendChild(script);
    });
    return productCatalogPromise;
  }

  function productPath(product) {
    if (!product) return '/';
    try {
      if (window.VERSANS_ROUTES && typeof window.VERSANS_ROUTES.productPath === 'function') {
        return window.VERSANS_ROUTES.productPath(product);
      }
    } catch (e) {}
    var stableSlug = String(product.slug || '');
    if (/^product-(?:9[4-9]|[1-9]\d{2,})$/.test(stableSlug)) {
      return '/product.html?id=' + encodeURIComponent(stableSlug);
    }
    if (product.urlSlug) return '/' + encodeURIComponent(product.urlSlug);
    return '/product.html?id=' + encodeURIComponent(product.slug || product.id || '');
  }

  function productPrimaryImage(product) {
    if (!product || !Array.isArray(product.images) || !product.images[0]) return '';
    var value = String(product.images[0] || '').replace(/\\/g, '/').trim();
    if (!value) return '';
    if (value.charAt(0) !== '/') value = '/' + value.replace(/^\/+/, '');
    if (value.indexOf('/images/') !== 0 || value.indexOf('..') !== -1) return '';
    return value;
  }

  function productImagePayload(product) {
    var url = productPrimaryImage(product);
    if (!url) return null;
    return { url: url, alt: productTitle(product) || 'מוצר VerSans', linkUrl: productPath(product) };
  }

  function currentProductFrom(products) {
    products = products || getProducts();
    if (!products.length) return null;
    var params = new URLSearchParams(window.location.search || '');
    var id = params.get('id');
    var path = decodeURIComponent((window.location.pathname || '/').replace(/^\/+|\/+$/g, ''));
    return products.find(function (product) {
      if (id && (String(product.id) === id || String(product.slug) === id || String(product.urlSlug) === id)) return true;
      return path && (String(product.urlSlug || '') === path || String(product.slug || '') === path);
    }) || null;
  }

  function productTitle(product) {
    return cleanText(he(product && product.title));
  }

  function detailLines(product) {
    if (!product || !product.details) return [];
    var value = product.details.he || product.details.en || product.details;
    return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [cleanText(value)].filter(Boolean);
  }

  function productDescription(product) {
    if (!product) return '';
    return cleanText(he(product.subtitle) || he(product.description) || he(product.afterText));
  }

  function materialLines(product) {
    var keywords = [
      'חומר','עשוי','פליז','כסף','sterling','נירוסטה','stainless','זהב','ציפוי','מצופה','moissanite','מויסנייט','zircon','זירקון','אבן','אבנים','hardlex','מתכת','quartz','קוורץ'
    ];
    var lines = detailLines(product).filter(function (line) { return containsAny(line, keywords); });
    if (!lines.length) {
      var desc = productDescription(product);
      if (containsAny(desc, keywords)) lines.push(desc);
    }
    return lines.slice(0, 5);
  }

  function sizeLines(product) {
    var out = [];
    if (!product) return out;
    if (Array.isArray(product.sizes) && product.sizes.length) {
      var labels = product.sizes.map(function (size) { return cleanText(he(size.label) || size.id); }).filter(Boolean);
      if (labels.length) out.push('מידות / אורכים זמינים: ' + labels.join(', '));
    }
    if (Array.isArray(product.colors) && product.colors.length) {
      var colorLike = product.colors.map(function (color) { return cleanText(he(color.label) || color.id); }).filter(Boolean);
      if (colorLike.some(function (x) { return /מ״מ|mm|ס״מ|cm|מידה|רוחב|אורך/i.test(x); })) {
        out.push('אפשרויות נוספות: ' + colorLike.join(', '));
      }
    }
    var detail = detailLines(product).filter(function (line) {
      return containsAny(line, ['מידה','מידות','אורך','אורכים','רוחב','מ״מ','ס״מ','קוטר','length','width','size']);
    });
    detail.forEach(function (line) { if (out.indexOf(line) === -1) out.push(line); });
    return out.slice(0, 5);
  }

  function sizeGuideFor(product) {
    var categories = (product && product.categories) || [];
    var category = String((product && product.category) || '');
    var title = productTitle(product);
    var joined = [category].concat(categories).join(' ') + ' ' + title;
    if (/ring|rings|טבעת|טבעות/i.test(joined)) return QUICK_LINKS.ringSize;
    if (/bracelet|bracelets|צמיד/i.test(joined)) return QUICK_LINKS.braceletSize;
    if (/necklace|necklaces|שרשרת/i.test(joined)) return QUICK_LINKS.necklaceSize;
    return null;
  }

  function productSummary(product) {
    var title = productTitle(product) || 'המוצר הזה';
    var desc = productDescription(product);
    var price = formatPrice(product.price);
    var text = title;
    if (desc) text += '. ' + desc;
    if (price) text += ' מחיר בסיס: ' + price + '.';
    return truncate(text, 650);
  }

  function findProductMatches(query, products) {
    var qTokens = tokenize(query);
    if (!qTokens.length) return [];
    return products.map(function (product) {
      var title = productTitle(product);
      var hay = normalize([
        title,
        he(product.subtitle),
        he(product.description),
        he(product.cardTitle),
        product.slug,
        product.urlSlug,
        (product.categories || []).join(' ')
      ].join(' '));
      var score = 0;
      qTokens.forEach(function (token) {
        if (hay.indexOf(token) !== -1) score += title && normalize(title).indexOf(token) !== -1 ? 5 : 2;
        else if (token.length >= 4) {
          var stem = token.slice(0, Math.max(3, token.length - 1));
          if (hay.indexOf(stem) !== -1) score += 1;
        }
      });
      if (normalize(query).indexOf(normalize(title)) !== -1 && title) score += 15;
      return { product: product, score: score };
    }).filter(function (item) { return item.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 5);
  }

  function getPageContext() {
    var path = window.location.pathname || '/';
    var title = cleanText(document.title || 'VerSans');
    var h1 = document.querySelector('h1');
    var heading = h1 ? cleanText(h1.textContent) : '';
    var pageType = 'page';
    if (path === '/' || path === '/index.html' || /^\/(necklaces|bracelets|bracelets-men|bracelets-women|bracelets-fashion|rings|watches|watches-men|watches-women|glasses|glasses-men|glasses-women|glasses-unisex|message-jewelry|photo-bracelets)$/.test(path)) pageType = 'catalog';
    if (path === '/product.html' || /^\/[^/]+$/.test(path) && getProducts().some(function (p) { return '/' + p.urlSlug === path; })) pageType = 'product';
    if (path.indexOf('size-guide') !== -1) pageType = 'size-guide';
    if (path.indexOf('policies') !== -1) pageType = 'policies';
    if (path.indexOf('warranty') !== -1) pageType = 'warranty';
    return { path: path, title: title, heading: heading, type: pageType };
  }

  function pageIntro(currentProduct) {
    if (currentProduct) return 'אתם עכשיו בעמוד של ' + productTitle(currentProduct) + '. אפשר לשאול אותי על החומרים, המידות, המחיר, משלוח, אחריות או לבקש קישור לעמוד אחר.';
    var ctx = getPageContext();
    if (ctx.type === 'catalog') return 'אני Versans Bot. אני יודע באיזה עמוד אתם נמצאים ויכול לעזור למצוא מוצר, לבדוק מבצעים, משלוחים, אחריות, החזרות ומדריכי מידות.';
    if (ctx.type === 'size-guide') return 'אני Versans Bot. אני יכול להסביר את מדריך המידות שבעמוד, או לקשר אתכם למוצרים המתאימים.';
    if (ctx.type === 'policies' || ctx.type === 'warranty') return 'אני Versans Bot. אפשר לשאול אותי על מה שכתוב בעמוד הזה, או על מוצר ומדיניות אחרת באתר.';
    return 'אני Versans Bot. אפשר לשאול אותי על מוצרים, מידות, משלוחים, אחריות, החזרות, מבצעים וקישורים באתר.';
  }

  function getQuickQuestions(product) {
    if (product) return ['מה זה המוצר הזה?', 'ממה הוא עשוי?', 'איזו מידה לבחור?', 'כמה זמן משלוח?'];
    var ctx = getPageContext();
    if (ctx.type === 'size-guide') return ['איך מודדים?', 'תביא לי קישור למוצרים', 'מה האחריות?', 'כמה זמן משלוח?'];
    if (ctx.type === 'policies') return ['מה מדיניות ההחזרות?', 'כמה זמן משלוח?', 'מה המבצעים?', 'מה האחריות?'];
    return ['מה המבצעים?', 'כמה זמן משלוח?', 'איך בוחרים מידה?', 'תעזור לי למצוא מוצר'];
  }

  function categoryLinkFromQuery(query) {
    if (containsAny(query, ['שרשרת','שרשראות'])) return QUICK_LINKS.necklaces;
    if (containsAny(query, ['צמיד','צמידים'])) return QUICK_LINKS.bracelets;
    if (containsAny(query, ['טבעת','טבעות'])) return QUICK_LINKS.rings;
    if (containsAny(query, ['שעון','שעונים'])) return QUICK_LINKS.watches;
    if (containsAny(query, ['משקפיים','משקף'])) return QUICK_LINKS.glasses;
    if (containsAny(query, ['כובע','כובעים'])) return QUICK_LINKS.hats;
    if (containsAny(query, ['תמונה מוקרנת','תכשיט עם תמונה','תכשיטי תמונה'])) return QUICK_LINKS.photo;
    if (containsAny(query, ['ברכה','תכשיט עם ברכה'])) return QUICK_LINKS.greeting;
    return null;
  }

  function expandTokens(query) {
    var tokens = tokenize(query);
    var extra = [];
    var n = normalize(query);
    if (/משלוח|אספק|מגיע/.test(n)) extra.push('משלוח','אספקה','ימי','עסקים');
    if (/החזר|החזרה|ביטול|לבטל|החלפ/.test(n)) extra.push('ביטול','החזרה','עסקה');
    if (/אחריות|פגם|נשבר|תקלה/.test(n)) extra.push('אחריות','פגם','ייצור');
    if (/פרטיות|מידע אישי/.test(n)) extra.push('פרטיות','מידע','אישי');
    if (/מידה|מידות|אורך|רוחב|קוטר/.test(n)) extra.push('מידה','מדידה','אורך','רוחב','קוטר');
    if (/מבצע|הנחה|2\+1|כובעים|משקפיים/.test(n)) extra.push('מבצע','מחיר','כובעים','משקפיים','תכשיטים');
    return Array.from(new Set(tokens.concat(extra.map(normalize))));
  }

  function extractBlocks(docMeta, html) {
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script,style,noscript,svg,header,footer,nav').forEach(function (node) { node.remove(); });
    var blocks = [];
    var heading = docMeta.title;
    var nodes = parsed.querySelectorAll('h1,h2,h3,h4,p,li,td,th');
    Array.prototype.forEach.call(nodes, function (node) {
      var text = cleanText(node.textContent || '');
      if (!text || text.length < 8) return;
      if (/^H[1-4]$/.test(node.tagName)) {
        heading = text;
        return;
      }
      if (text.length > 850) text = text.slice(0, 850);
      blocks.push({
        docId: docMeta.id,
        title: docMeta.title,
        heading: heading,
        text: text,
        url: docMeta.url
      });
    });
    return blocks;
  }

  function loadKnowledge() {
    if (knowledgePromise) return knowledgePromise;
    knowledgePromise = Promise.all(DOCS.map(function (doc) {
      return fetch(doc.url, { credentials: 'same-origin', headers: { 'Accept': 'text/html' } })
        .then(function (response) { return response.ok ? response.text() : ''; })
        .then(function (html) { return html ? extractBlocks(doc, html) : []; })
        .catch(function () { return []; });
    })).then(function (groups) {
      return groups.reduce(function (all, group) { return all.concat(group); }, []);
    });
    return knowledgePromise;
  }

  function scoreBlock(query, block) {
    var tokens = expandTokens(query);
    if (!tokens.length) return 0;
    var heading = normalize(block.heading + ' ' + block.title);
    var text = normalize(block.text);
    var score = 0;
    tokens.forEach(function (token) {
      if (heading.indexOf(token) !== -1) score += 7;
      if (text.indexOf(token) !== -1) score += 3;
    });
    var n = normalize(query);
    if (/אחריות/.test(n) && block.docId === 'warranty') score += 12;
    if (/ביטול|החזר|החזרה|פרטיות|משלוח|מבצע|תקנון/.test(n) && block.docId === 'policies') score += 10;
    if (/צמיד/.test(n) && block.docId === 'bracelet-size') score += 10;
    if (/טבעת/.test(n) && block.docId === 'ring-size') score += 10;
    if (/שרשרת/.test(n) && block.docId === 'necklace-size') score += 10;
    return score;
  }

  function searchKnowledge(query, blocks) {
    return blocks.map(function (block) { return { block: block, score: scoreBlock(query, block) }; })
      .filter(function (item) { return item.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 3);
  }

  function policyFallback(query) {
    if (containsAny(query, ['משלוח','אספקה','כמה זמן מגיע'])) {
      return { text: 'לפי התקנון, זמן האספקה המשוער למוצרים רגילים הוא 9-14 ימי עסקים, ולכובעים 9-20 ימי עסקים. מניין הזמן מתחיל לאחר אישור התשלום.', links: [QUICK_LINKS.policies] };
    }
    if (containsAny(query, ['מבצע','הנחה','2+1'])) {
      return { text: 'מבצע 2+1 חל על קולקציית התכשיטים הזכאית, והפריט הזול בשלישייה מתקבל בהטבה לפי חישוב הסל. לכובעים ולמשקפיים יש מבצעי כמות נפרדים.', links: [QUICK_LINKS.policies] };
    }
    if (containsAny(query, ['אחריות','פגם','נשבר','תקלה'])) {
      return { text: 'מוצרי VerSans כוללים 6 חודשי אחריות לפגמי ייצור או הרכבה, בכפוף לתנאים. נזק ממכה, משיכה, שחיקה או חשיפה לא מתאימה אינו נחשב פגם ייצור.', links: [QUICK_LINKS.warranty] };
    }
    if (containsAny(query, ['ביטול','החזר','החזרה','להחזיר'])) {
      return { text: 'אפשר למסור בקשת ביטול או החזרה דרך הטופס באתר, אימייל, טלפון או WhatsApp. הזכויות והחריגים נקבעים לפי התקנון והדין.', links: [QUICK_LINKS.policies] };
    }
    return null;
  }

  function answerCurrentProductIntent(query, product) {
    if (!product) return null;
    var productLink = { label: 'לעמוד המוצר', url: productPath(product) };
    var n = normalize(query);

    if (/(מה.*(מוצר|מוצא|פריט).*זה|מה זה.*(מוצר|מוצא|פריט)|המוצר הזה|הפריט הזה)/.test(n)) {
      return { text: productSummary(product), links: [productLink] };
    }

    if (containsAny(query, ['ממה','חומר','חומרים','עשוי','עשויה','ציפוי','מתכת'])) {
      var materials = materialLines(product);
      if (materials.length) return { text: productTitle(product) + ': ' + materials.join('. '), links: [productLink] };
      return { text: 'לא מצאתי בעמוד המוצר פירוט חומר מפורש שאפשר לצטט בביטחון. אפשר לפתוח את פרטי המוצר המלאים בקישור.', links: [productLink] };
    }

    if (containsAny(query, ['מידה','מידות','אורך','רוחב','קוטר','איזה מידה'])) {
      var sizes = sizeLines(product);
      var guide = sizeGuideFor(product);
      var sizeLinks = [productLink];
      if (guide) sizeLinks.push(guide);
      if (sizes.length) return { text: productTitle(product) + ': ' + sizes.join('. '), links: sizeLinks };
      if (guide) return { text: 'למוצר הזה לא מצאתי רשימת מידות בתוך נתוני המוצר, אבל יש מדריך מדידה מתאים שיכול לעזור לבחור.', links: sizeLinks };
    }

    if (containsAny(query, ['מחיר','כמה עולה','עלות'])) {
      var price = formatPrice(product.price);
      var extra = '';
      if (Array.isArray(product.sizes) && product.sizes.some(function (s) { return Number(s.addPrice) > 0; })) extra = ' המחיר עשוי להשתנות לפי המידה או האפשרות שתבחרו.';
      if (Array.isArray(product.colors) && product.colors.some(function (s) { return Number(s.addPrice) > 0; })) extra = ' המחיר עשוי להשתנות לפי המידה או האפשרות שתבחרו.';
      return { text: 'מחיר הבסיס של ' + productTitle(product) + ' הוא ' + price + '.' + extra, links: [productLink] };
    }

    if (containsAny(query, ['משלוח','אספקה','מתי מגיע','כמה זמן'])) {
      var delivery = product.deliveryBusinessDays || {};
      if (delivery.min && delivery.max) {
        return { text: 'זמן האספקה המשוער שמוגדר ל' + productTitle(product) + ' הוא ' + delivery.min + '-' + delivery.max + ' ימי עסקים, החל מאישור התשלום.', links: [productLink, QUICK_LINKS.policies] };
      }
    }

    if (containsAny(query, ['קישור','לינק','עמוד מוצר'])) {
      return { text: 'בטח. הנה קישור ישיר ל' + productTitle(product) + '.', links: [productLink] };
    }

    return null;
  }

  function answerSizeGuideIntent(query) {
    var n = normalize(query);
    if (/מיד.*טבעת|טבעת.*מיד|קוטר.*טבעת|אצבע/.test(n)) {
      return { text: 'לטבעת: מקיפים את בסיס האצבע בחוט או רצועת נייר, מסמנים את נקודת המפגש ומודדים במילימטרים. אם אתם בדיוק בין שתי מידות, מומלץ לבחור במידה הגדולה יותר.', links: [QUICK_LINKS.ringSize, QUICK_LINKS.rings] };
    }
    if (/מיד.*צמיד|צמיד.*מיד|פרק|שורש כף/.test(n)) {
      return { text: 'לצמיד: מלפפים חוט סביב שורש כף היד בלי להצמיד חזק מדי, מסמנים ומודדים את אורך החוט. אפשר להשאיר מרווח של אצבע לנוחות.', links: [QUICK_LINKS.braceletSize, QUICK_LINKS.bracelets] };
    }
    if (/מיד.*שרשרת|שרשרת.*מיד|אורך.*שרשרת|צוואר/.test(n)) {
      return { text: 'לשרשרת: מניחים חוט סביב הצוואר בגובה הרצוי, מסמנים את נקודת המפגש ואז מודדים את כל האורך עם סרט מדידה או מטר.', links: [QUICK_LINKS.necklaceSize, QUICK_LINKS.necklaces] };
    }
    if (/איך.*מיד|בחירת.*מיד|מדריך.*מיד/.test(n)) {
      return { text: 'יש לנו מדריכי מדידה נפרדים לטבעות, צמידים ושרשראות. בחרו את הסוג הרצוי.', links: [QUICK_LINKS.ringSize, QUICK_LINKS.braceletSize, QUICK_LINKS.necklaceSize] };
    }
    return null;
  }

  function answerNavigationIntent(query) {
    var n = normalize(query);
    if (/מעקב|איפה.*הזמנה|סטטוס.*הזמנה/.test(n)) return { text: 'אפשר לבדוק את מצב ההזמנה בעמוד המעקב.', links: [QUICK_LINKS.track] };
    if (/תקנון|מדיניות/.test(n)) return { text: 'הנה התקנון ומדיניות VerSans.', links: [QUICK_LINKS.policies] };
    if (/אחריות/.test(n)) return { text: 'הנה עמוד האחריות המלא של VerSans.', links: [QUICK_LINKS.warranty] };
    if (/התחבר|התחברות|לוגין/.test(n)) return { text: 'אפשר להתחבר לחשבון VerSans כאן.', links: [QUICK_LINKS.login] };
    if (/הרשמ|פתיחת חשבון/.test(n)) return { text: 'אפשר לפתוח חשבון VerSans כאן.', links: [QUICK_LINKS.register] };
    if (/קישור|תביא.*עמוד|תפתח|לקטגור/.test(n)) {
      var category = categoryLinkFromQuery(query);
      if (category) return { text: 'בטח. הנה הקישור שביקשת.', links: [category] };
    }
    return null;
  }

  function answerPromoIntent(query) {
    var n = normalize(query);
    if (!/מבצע|הנחה|2\+1|כובע|כובעים|משקפיים/.test(n)) return null;
    if (/כובע|כובעים/.test(n)) return { text: 'בכובעים: כובע אחד 139.90 ₪, שני כובעים 239.90 ₪, ושלושה כובעים 299.90 ₪.', links: [QUICK_LINKS.hats] };
    if (/משקפיים|משקף/.test(n)) return { text: 'במשקפיים: דגם אחד 139.90 ₪, ושני דגמים ב-249.90 ₪.', links: [QUICK_LINKS.glasses] };
    return { text: 'בתכשיטים הזכאים יש מבצע 2+1, ובנוסף קיימים מבצעי כמות נפרדים לכובעים ולמשקפיים. החיסכון מחושב ומוצג בסל.', links: [QUICK_LINKS.home, QUICK_LINKS.policies] };
  }

  function answerContactIntent(query) {
    if (!containsAny(query, ['שירות לקוחות','צור קשר','טלפון','וואטסאפ','אימייל','מייל'])) return null;
    return {
      text: 'שירות הלקוחות של VerSans זמין בכל יום בין 08:00-22:00. טלפון / WhatsApp: 055-302-6389. אימייל: versanssupport@gmail.com.',
      links: [{ label: 'WhatsApp שירות לקוחות', url: 'https://wa.me/972553026389', external: true }]
    };
  }

  function answerPageIntent(query) {
    var n = normalize(query);
    if (!/(מה.*עמוד|איפה אני|באיזה עמוד|העמוד הזה)/.test(n)) return null;
    var ctx = getPageContext();
    var label = ctx.heading || ctx.title || 'עמוד VerSans';
    return { text: 'אתם נמצאים עכשיו בעמוד: ' + label + '.', links: [{ label: 'חזרה לחנות', url: '/' }] };
  }

  function answerGreeting(query) {
    if (!containsAny(query, ['היי','הי','שלום','אהלן','בוקר טוב','ערב טוב'])) return null;
    return { text: 'היי, אני Versans Bot. אפשר לשאול אותי על המוצר שאתם רואים עכשיו, חומרים, מידות, משלוחים, אחריות, החזרות, מבצעים או לבקש קישור לעמוד באתר.' };
  }

  function safePageText() {
    if ((window.location.pathname || '').replace(/\/+$/, '') === '/track') return '';
    try {
      var root = document.querySelector('main') || document.querySelector('[data-product-root]') || document.body;
      var clone = root.cloneNode(true);
      clone.querySelectorAll('script,style,noscript,svg,video,form,.vs-bot,.vs-a11y-widget,.vs-floating-cart,header,footer,nav').forEach(function (node) { node.remove(); });
      return cleanText(clone.textContent || '').slice(0, 6500);
    } catch (e) {
      return '';
    }
  }

  function compactProductForAI(product) {
    if (!product) return null;
    return {
      title: productTitle(product),
      url: productPath(product),
      price: Number(product.price) || null,
      subtitle: cleanText(he(product.subtitle)).slice(0, 500),
      description: productDescription(product).slice(0, 1100),
      details: detailLines(product).slice(0, 12),
      sizes: Array.isArray(product.sizes) ? product.sizes.slice(0, 20).map(function (item) {
        return { label: cleanText(he(item.label) || item.id), addPrice: Number(item.addPrice) || 0 };
      }) : [],
      colors: Array.isArray(product.colors) ? product.colors.slice(0, 20).map(function (item) {
        return { label: cleanText(he(item.label) || item.id), addPrice: Number(item.addPrice) || 0 };
      }) : [],
      categories: Array.isArray(product.categories) ? product.categories.slice(0, 12) : [],
      category: String(product.category || '')
    };
  }

  function aiLinkOptions(query, currentProduct, productMatches) {
    var options = [
      QUICK_LINKS.home, QUICK_LINKS.track, QUICK_LINKS.policies, QUICK_LINKS.warranty,
      QUICK_LINKS.braceletSize, QUICK_LINKS.ringSize, QUICK_LINKS.necklaceSize,
      QUICK_LINKS.necklaces, QUICK_LINKS.bracelets, QUICK_LINKS.rings,
      QUICK_LINKS.watches, QUICK_LINKS.glasses, QUICK_LINKS.hats,
      QUICK_LINKS.photo, QUICK_LINKS.greeting, QUICK_LINKS.login, QUICK_LINKS.register
    ];
    if (currentProduct) {
      options.unshift({ label: productTitle(currentProduct), url: productPath(currentProduct) });
      var guide = sizeGuideFor(currentProduct);
      if (guide) options.unshift(guide);
    }
    var category = categoryLinkFromQuery(query);
    if (category) options.unshift(category);
    (productMatches || []).slice(0, 5).forEach(function (item) {
      options.unshift({ label: productTitle(item.product), url: productPath(item.product) });
    });
    var seen = new Set();
    return options.filter(function (item) {
      if (!item || !item.url || !item.label || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    }).slice(0, 22);
  }

  async function buildAIContext(query) {
    var products = await ensureProducts();
    var currentProduct = currentProductFrom(products);
    var productMatches = findProductMatches(query, products).slice(0, 5);
    var knowledge = [];
    try {
      var blocks = await loadKnowledge();
      knowledge = searchKnowledge(query, blocks).slice(0, 7).map(function (item) {
        return {
          title: item.block.title,
          heading: item.block.heading,
          text: truncate(item.block.text, 650),
          url: item.block.url
        };
      });
    } catch (e) {}
    return {
      page: Object.assign({}, getPageContext(), {
        url: window.location.pathname + window.location.search,
        visibleText: safePageText()
      }),
      currentProduct: compactProductForAI(currentProduct),
      relatedProducts: productMatches.map(function (item) { return compactProductForAI(item.product); }),
      relevantSiteInfo: knowledge,
      links: aiLinkOptions(query, currentProduct, productMatches),
      storeFacts: {
        jewelryPromotion: 'בקולקציות התכשיטים המשתתפות: קנה 2 קבל 1 בחינם, הזול מבין שלושת הפריטים הוא החינם.',
        hatsPromotion: 'כובעים: 1 ב-139.90 ₪, 2 ב-239.90 ₪, 3 ב-299.90 ₪.',
        glassesPromotion: 'משקפיים: 1 ב-139.90 ₪, 2 ב-249.90 ₪.',
        welcomeCoupon: 'בהרשמה נשלח למייל קופון 3% חד-פעמי, בתוקף ל-14 ימים.',
        warranty: 'האחריות היא לחצי שנה, לפי תנאי האחריות והתקנון באתר.'
      },
      history: conversationHistory.slice(-8)
    };
  }

  async function answerQuestionAI(query) {
    var context = await buildAIContext(query);
    var response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ question: cleanText(query).slice(0, 700), context: context })
    });
    var data = null;
    try { data = await response.json(); } catch (e) {}
    if (!response.ok || !data || !data.ok || !data.answer) {
      var err = new Error((data && data.error) || 'ai_unavailable');
      err.code = data && data.error;
      throw err;
    }
    return {
      text: cleanText(data.answer),
      links: Array.isArray(data.links) ? data.links.slice(0, 4) : [],
      images: sanitizeStoredImages(data.images)
    };
  }

  async function answerQuestionLocal(query) {
    var trimmed = cleanText(query).slice(0, 500);
    if (!trimmed) return { text: 'כתבו לי שאלה ואנסה לעזור.' };

    var products = await ensureProducts();
    var currentProduct = currentProductFrom(products);

    var direct = answerGreeting(trimmed)
      || answerPageIntent(trimmed)
      || answerCurrentProductIntent(trimmed, currentProduct)
      || answerSizeGuideIntent(trimmed)
      || answerPromoIntent(trimmed)
      || answerContactIntent(trimmed);
    if (direct) return direct;

    var policyAnswer = policyFallback(trimmed);
    if (policyAnswer) return policyAnswer;

    var navigationAnswer = answerNavigationIntent(trimmed);
    if (navigationAnswer) return navigationAnswer;

    var productMatches = findProductMatches(trimmed, products);
    var productWords = containsAny(trimmed, ['מוצר','מוצא','פריט','שרשרת','צמיד','טבעת','שעון','כובע','משקפיים','תכשיט','דגם','קישור']);
    if (productMatches.length && productWords) {
      var best = productMatches[0].product;
      var links = productMatches.slice(0, 3).map(function (item) {
        return { label: productTitle(item.product), url: productPath(item.product) };
      });
      var images = productMatches.slice(0, 3).map(function (item) { return productImagePayload(item.product); }).filter(Boolean);
      if (productMatches[0].score >= 6) {
        return { text: productSummary(best), links: links, images: images.slice(0, 1) };
      }
      return { text: 'מצאתי כמה מוצרים שיכולים להתאים למה שחיפשתם.', links: links, images: images };
    }


    var knowledge = await loadKnowledge();
    var results = searchKnowledge(trimmed, knowledge);
    if (results.length && results[0].score >= 6) {
      var first = results[0].block;
      var text = first.text;
      if (first.heading && normalize(first.heading) !== normalize(first.title)) text = first.heading + ': ' + text;
      var links = [{ label: first.title, url: first.url }];
      results.slice(1).forEach(function (result) {
        if (!links.some(function (link) { return link.url === result.block.url; })) {
          links.push({ label: result.block.title, url: result.block.url });
        }
      });
      return { text: truncate(text, 620), links: links.slice(0, 3) };
    }

    var category = categoryLinkFromQuery(trimmed);
    if (category) return { text: 'מצאתי את הקטגוריה המתאימה. אפשר לפתוח אותה כאן.', links: [category] };

    return {
      text: 'לא מצאתי תשובה מספיק מדויקת במידע של החנות. נסו לשאול אותי על מוצר, חומרים, מידה, משלוח, אחריות, החזרה, מבצע או לבקש קישור לעמוד מסוים.',
      links: [QUICK_LINKS.home, QUICK_LINKS.policies]
    };
  }

  async function answerQuestion(query) {
    var trimmed = cleanText(query).slice(0, 700);
    if (!trimmed) return { text: 'כתבו לי שאלה ואנסה לעזור.' };
    try {
      var aiAnswer = await answerQuestionAI(trimmed);
      conversationHistory.push({ role: 'user', text: trimmed });
      conversationHistory.push({ role: 'assistant', text: aiAnswer.text });
      conversationHistory = conversationHistory.slice(-10);
      return aiAnswer;
    } catch (error) {
      console.warn('Versans Bot AI fallback:', error && (error.code || error.message) || error);
      var fallback = await answerQuestionLocal(trimmed);
      conversationHistory.push({ role: 'user', text: trimmed });
      conversationHistory.push({ role: 'assistant', text: fallback.text });
      conversationHistory = conversationHistory.slice(-10);
      return fallback;
    }
  }

  function createIcon() {
    var span = document.createElement('span');
    span.className = 'vs-bot-trigger__mark';
    span.setAttribute('aria-hidden', 'true');
    var avatar = document.createElement('img');
    avatar.className = 'vs-bot-trigger__avatar';
    avatar.src = '/images/versans-bot-avatar.png';
    avatar.alt = '';
    avatar.width = 96;
    avatar.height = 96;
    span.appendChild(avatar);
    return span;
  }

  var widget = document.createElement('div');
  widget.className = 'vs-bot';
  widget.setAttribute('dir', 'rtl');

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'vs-bot-trigger';
  trigger.setAttribute('aria-label', 'פתיחת Versans Bot');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.appendChild(createIcon());
  var triggerText = document.createElement('span');
  triggerText.className = 'vs-bot-trigger__text';
  triggerText.textContent = 'Versans Bot';
  trigger.appendChild(triggerText);

  var panel = document.createElement('section');
  panel.className = 'vs-bot-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Versans Bot');

  var head = document.createElement('div');
  head.className = 'vs-bot-head';
  var headCopy = document.createElement('div');
  headCopy.className = 'vs-bot-head__copy';
  var logo = document.createElement('img');
  logo.className = 'vs-bot-head__logo';
  logo.src = '/images/VersansLogoWordmarkWhite.png';
  logo.alt = 'VerSans';
  logo.width = 719;
  logo.height = 171;
  headCopy.appendChild(logo);
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'vs-bot-close';
  close.setAttribute('aria-label', 'סגירת הצאט');
  close.textContent = '×';
  head.appendChild(headCopy);
  head.appendChild(close);

  var messages = document.createElement('div');
  messages.className = 'vs-bot-messages';
  messages.setAttribute('aria-live', 'polite');

  var quick = document.createElement('div');
  quick.className = 'vs-bot-quick';

  var form = document.createElement('form');
  form.className = 'vs-bot-form';
  var input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 500;
  input.autocomplete = 'off';
  input.placeholder = 'שאלו אותי על מוצר, מידה, משלוח...';
  input.setAttribute('aria-label', 'שאלה ל-Versans Bot');
  var send = document.createElement('button');
  send.type = 'submit';
  send.className = 'vs-bot-send';
  send.textContent = 'שליחה';
  form.appendChild(input);
  form.appendChild(send);

  var footer = document.createElement('div');
  footer.className = 'vs-bot-footer';
  footer.textContent = 'Versans AI - התשובות מבוססות על המידע בחנות ועל ההקשר של העמוד הנוכחי.';

  panel.appendChild(head);
  panel.appendChild(messages);
  panel.appendChild(quick);
  panel.appendChild(form);
  panel.appendChild(footer);
  widget.appendChild(trigger);
  widget.appendChild(panel);
  document.body.appendChild(widget);

  var restoredChat = false;

  function scrollMessages() {
    window.requestAnimationFrame(function () { messages.scrollTop = messages.scrollHeight; });
  }

  function appendMessage(role, payload, options) {
    options = options || {};
    payload = typeof payload === 'string' ? { text: payload } : (payload || {});
    var row = document.createElement('div');
    row.className = 'vs-bot-message-row vs-bot-message-row--' + role;
    var bubble = document.createElement('div');
    bubble.className = 'vs-bot-message';
    bubble.textContent = cleanText(payload.text || '');
    row.appendChild(bubble);

    if (Array.isArray(payload.images) && payload.images.length) {
      var images = document.createElement('div');
      images.className = 'vs-bot-images';
      sanitizeStoredImages(payload.images).forEach(function (item) {
        var wrapper = item.linkUrl ? document.createElement('a') : document.createElement('div');
        wrapper.className = 'vs-bot-image-card';
        if (item.linkUrl) wrapper.href = item.linkUrl;
        var img = document.createElement('img');
        img.src = item.url;
        img.alt = item.alt || 'מוצר VerSans';
        img.loading = 'lazy';
        img.decoding = 'async';
        wrapper.appendChild(img);
        images.appendChild(wrapper);
      });
      if (images.childElementCount) row.appendChild(images);
    }

    if (Array.isArray(payload.links) && payload.links.length) {
      var links = document.createElement('div');
      links.className = 'vs-bot-links';
      payload.links.slice(0, 4).forEach(function (item) {
        if (!item || !item.url || !item.label) return;
        var a = document.createElement('a');
        a.className = 'vs-bot-link';
        a.href = item.url;
        a.textContent = item.label;
        if (item.external) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        links.appendChild(a);
      });
      row.appendChild(links);
    }

    messages.appendChild(row);
    if (!options.skipPersist) rememberChatMessage(role, payload);
    scrollMessages();
    return row;
  }

  function restoreChat() {
    if (chatRestoreDone) return storedChat.length > 0;
    chatRestoreDone = true;
    storedChat = loadStoredChat();
    if (!storedChat.length) return false;
    storedChat.forEach(function (item) {
      appendMessage(item.role, { text: item.text, links: item.links, images: item.images }, { skipPersist: true });
    });
    conversationHistory = storedChat.slice(-10).map(function (item) {
      return { role: item.role === 'user' ? 'user' : 'assistant', text: item.text };
    });
    if (storedChat.some(function (item) { return item.role === 'user'; })) quick.classList.add('is-collapsed');
    return true;
  }

  function appendTyping() {
    var row = document.createElement('div');
    row.className = 'vs-bot-message-row vs-bot-message-row--bot';
    row.setAttribute('data-typing', '1');
    var bubble = document.createElement('div');
    bubble.className = 'vs-bot-message vs-bot-message--typing';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    row.appendChild(bubble);
    messages.appendChild(row);
    scrollMessages();
    return row;
  }

  function renderQuick(product) {
    quick.innerHTML = '';
    getQuickQuestions(product).forEach(function (question) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'vs-bot-quick__item';
      button.textContent = question;
      button.addEventListener('click', function () { submitQuestion(question); });
      quick.appendChild(button);
    });
  }

  async function submitQuestion(question) {
    if (!chatScopeReady) await chatScopePromise;
    if (!chatRestoreDone) restoredChat = restoreChat();
    var value = cleanText(question);
    if (!value) return;
    appendMessage('user', value);
    input.value = '';
    quick.classList.add('is-collapsed');
    input.disabled = true;
    send.disabled = true;
    var typing = appendTyping();
    try {
      var answer = await answerQuestion(value);
      typing.remove();
      appendMessage('bot', answer);
    } catch (error) {
      typing.remove();
      appendMessage('bot', { text: 'משהו השתבש בזמן שחיפשתי תשובה. נסו שוב בעוד רגע.' });
    } finally {
      input.disabled = false;
      send.disabled = false;
      input.focus({ preventScroll: true });
    }
  }

  async function openBot() {
    panel.hidden = false;
    widget.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    if (!chatScopeReady) await chatScopePromise;
    if (!chatRestoreDone) restoredChat = restoreChat();
    if (!messages.childElementCount) {
      var products = await ensureProducts();
      var product = currentProductFrom(products);
      appendMessage('bot', pageIntro(product));
      renderQuick(product);
    } else if (restoredChat && !storedChat.some(function (item) { return item.role === 'user'; })) {
      var restoredProducts = await ensureProducts();
      renderQuick(currentProductFrom(restoredProducts));
    }
    setTimeout(function () { input.focus({ preventScroll: true }); }, 50);
  }

  function closeBot() {
    panel.hidden = true;
    widget.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({ preventScroll: true });
  }

  trigger.addEventListener('click', function () {
    if (panel.hidden) openBot();
    else closeBot();
  });
  close.addEventListener('click', closeBot);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    submitQuestion(input.value);
  });
  document.addEventListener('keydown', function (event) {
    if ((event.key === 'Escape' || event.key === 'Esc') && !panel.hidden) {
      event.preventDefault();
      closeBot();
    }
  }, true);

  window.VersansBot = {
    open: openBot,
    close: closeBot,
    ask: submitQuestion,
    version: BOT_VERSION
  };
})();
