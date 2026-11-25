'use strict';

// Search metadata is rendered on the server from the current *public* catalog.
// It never changes the storefront's client-side cart, variants or navigation.
const { URL } = require('node:url');
const SITE = 'https://versans.com';
const SEARCH_ROUTES = Object.freeze({
  '/': ['VerSans - ורסנס | תכשיטים, שעונים ומתנות', 'תכשיטים, צמידים, שרשראות, טבעות, שעונים ומתנות בחנות VerSans.'],
  '/message-jewelry': ['תכשיטים עם ברכה אישית | VerSans', 'תכשיטים עם ברכה אישית למתנה מיוחדת מבית VerSans.'],
  '/gifts-for-mom': ['מתנות ותכשיטים לאמא | VerSans', 'תכשיטים ומתנות לאמא מבית VerSans.'],
  '/gifts-for-partner': ['תכשיטים ומתנות לבת זוג | VerSans', 'מתנות ותכשיטים לבת זוג מבית VerSans.'],
  '/gifts-for-daughter': ['תכשיטים ומתנות לבת | VerSans', 'מתנות ותכשיטים לבת מבית VerSans.'],
  '/gifts-for-sister': ['תכשיטים ומתנות לאחות | VerSans', 'מתנות ותכשיטים לאחות מבית VerSans.'],
  '/necklaces': ['שרשראות | VerSans', 'קולקציית שרשראות מבית VerSans, במגוון דגמים וצבעים.'],
  '/bracelets': ['צמידים | VerSans', 'קולקציית הצמידים של VerSans לנשים ולגברים.'],
  '/bracelets-men': ['צמידים לגברים | VerSans', 'צמידים לגברים במגוון דגמים מבית VerSans.'],
  '/bracelets-women': ['צמידים לנשים | VerSans', 'צמידים לנשים במגוון דגמים מבית VerSans.'],
  '/bracelets-fashion': ['צמידי אופנה | VerSans', 'מבחר צמידי אופנה מבית VerSans.'],
  '/rings': ['טבעות | VerSans', 'טבעות במגוון עיצובים ומידות מבית VerSans.'],
  '/photo-bracelets': ['תכשיטים עם תמונה | VerSans', 'תכשיטים עם תמונה אישית מבית VerSans.'],
  '/watches': ['שעונים | VerSans', 'מבחר שעונים לנשים ולגברים בחנות VerSans.'],
  '/watches-men': ['שעונים לגברים | VerSans', 'שעונים לגברים מבית VerSans.'],
  '/watches-women': ['שעונים לנשים | VerSans', 'שעונים לנשים מבית VerSans.'],
  '/glasses': ['משקפי שמש | VerSans', 'משקפי שמש במגוון דגמים מבית VerSans.'],
  '/glasses-men': ['משקפי שמש לגברים | VerSans', 'משקפי שמש לגברים מבית VerSans.'],
  '/glasses-women': ['משקפי שמש לנשים | VerSans', 'משקפי שמש לנשים מבית VerSans.'],
  '/glasses-unisex': ['משקפי שמש יוניסקס | VerSans', 'משקפי שמש יוניסקס מבית VerSans.'],
  '/hats': ['כובעים | VerSans', 'מבחר כובעים מבית VerSans.']
});
const PUBLIC_INFO_PATHS = ['/policies', '/warranty', '/bracelet-size-guide', '/ring-size-guide', '/necklace-size-guide'];
function str(v) { return String(v == null ? '' : v).trim(); }
function nameOf(product) { const t = product && product.title; return str(typeof t === 'object' ? (t.he || t.en) : t); }
function escapeHtml(v) { return str(v).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c])); }
function safeJson(data) { return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
function descriptionFor(product) {
  // Do not repeat supplier text or unverified marketing claims in search snippets.
  const title = nameOf(product);
  return (title + ' מבית VerSans. צפו בתמונות, במחיר ובאפשרויות הבחירה של המוצר.').slice(0, 230);
}
function imageUrl(value) {
  const input = str(value).replace(/\\/g, '/');
  if (/^https:\/\/[^\s"'<>]+$/i.test(input)) return input;
  if (!/^(?:\/?(?:images\/|assets\/|api\/catalog\/media\/))[a-z\d_/.?=-]+$/i.test(input) || input.includes('..')) return '';
  return SITE + '/' + input.replace(/^\/+/, '');
}
function productRoute(product, routes) {
  const rel = routes.productPath(product);
  return typeof rel === 'string' && rel.startsWith('/') && !rel.startsWith('//') ? rel : '/';
}
function productFromPath(pathname, search, publicProducts, routes) {
  const param = pathname === '/product.html' ? new URLSearchParams(search || '').get('id') : null;
  const slug = pathname !== '/' ? decodeURIComponent(pathname.slice(1)) : '';
  return publicProducts.find(p => (param && (String(p.slug) === param || String(p.id) === param || String(p.urlSlug) === param)) ||
    (pathname !== '/product.html' && p.urlSlug && String(p.urlSlug) === slug && productRoute(p, routes) === pathname)) || null;
}
function setHeadTag(html, re, value) { return html.replace(re, value); }
function setMeta(html, attr, key, value) {
  const pattern = new RegExp('<meta\\s+' + attr + '="' + key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '"[^>]*>', 'i');
  const tag = `<meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(value)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', tag + '\n</head>');
}
function setCanonical(html, url) {
  const tag = `<link rel="canonical" href="${escapeHtml(url)}">`;
  return /<link\s+rel="canonical"[^>]*>/i.test(html)
    ? html.replace(/<link\s+rel="canonical"[^>]*>/i, tag) : html.replace('</head>', tag + '\n</head>');
}
function updateMetadata(html, { title, description, url, image, type }) {
  let out = setHeadTag(html, /<title>[^<]*<\/title>/i, '<title>' + escapeHtml(title) + '</title>');
  out = setMeta(out, 'name', 'description', description);
  out = setCanonical(out, url);
  for (const [key, value] of Object.entries({ 'og:type':type, 'og:title':title, 'og:description':description, 'og:url':url })) out = setMeta(out, 'property', key, value);
  if (image) out = setMeta(out, 'property', 'og:image', image);
  return out;
}
function renderProductHtml(html, product, routes, {noindex = false} = {}) {
  const title = nameOf(product);
  if (!title) return html;
  const url = SITE + productRoute(product, routes);
  const image = imageUrl((product.images && product.images[0]) || product.cardImage || product.hoverImage);
  const description = descriptionFor(product);
  const price = Number(product.price);
  const validPrice = Number.isFinite(price) && price > 0;
  let out = updateMetadata(html, {title:title + ' | VerSans', description, url, image, type:'product'});
  out = out.replace(/(<h1\s+class="product-info__title"\s+id="productTitle">)[\s\S]*?(<\/h1>)/i, (_,a,b) => a + escapeHtml(title) + b);
  const subtitle = product.subtitle && typeof product.subtitle === 'object' ? str(product.subtitle.he || product.subtitle.en) : '';
  // Match the first-render DOM so crawlers that do not execute JS can read it.
  out = out.replace(/(<p\s+class="product-info__subtitle"\s+id="productSubtitle">)[\s\S]*?(<\/p>)/i, (_,a,b) => a + escapeHtml(subtitle || description) + b);
  if (validPrice) out = out.replace(/(<strong\s+id="productPrice">)[\s\S]*?(<\/strong>)/i, (_,a,b) => a + escapeHtml(price.toFixed(2) + ' ₪') + b);
  if (image) out = out.replace(/(<img\s+id="productMainImage"[^>]*?)\s+src=""\s+alt=""/i, (_,prefix) => prefix + ' src="' + escapeHtml(image) + '" alt="' + escapeHtml(title + ' - VerSans') + '"');
  if (validPrice && !noindex) {
    const ld = {
      '@context':'https://schema.org', '@type':'Product', '@id':url+'#product',
      name:title, description, url, sku:str(product.sku || product.slug || product.id),
      brand:{'@type':'Brand', name:'VerSans'},
      offers:{'@type':'Offer',url,priceCurrency:'ILS',price:price.toFixed(2),availability:'https://schema.org/InStock'}
    };
    if (image) ld.image=[image];
    out = out.replace('</head>', `<script type="application/ld+json" id="productStructuredData">${safeJson(ld)}</script>\n</head>`);
  }
  if (noindex) out = setMeta(out, 'name', 'robots', 'noindex, nofollow');
  return out;
}
function renderCollectionHtml(html, pathname, publicProducts, routes) {
  const known = SEARCH_ROUTES[pathname];
  if (!known) return html;
  // Keep the homepage's richer existing title and description unchanged.
  let out = pathname === '/' ? html : updateMetadata(html, {title:known[0],description:known[1],url:SITE+pathname,type:'website'});
  if (pathname !== '/') {
    const category = routes.categoryFromPath(pathname);
    const matches = publicProducts.filter(p => p.category === category || (Array.isArray(p.categories) && p.categories.includes(category)));
    // Graceful JS-free fallback: JavaScript replaces #grid normally; no cards are duplicated.
    const entries = matches.slice(0, 60).map(p => {
      const name = nameOf(p);
      const img = imageUrl(p.images && p.images[0]);
      return `<li><a href="${escapeHtml(productRoute(p,routes))}">${escapeHtml(name)}</a>${img ? ` <img src="${escapeHtml(img)}" alt="${escapeHtml(name + ' - VerSans')}" loading="lazy" width="70" height="70">` : ''}</li>`;
    });
    if (entries.length) out = out.replace('<div class="grid" id="grid"></div>', '<div class="grid" id="grid"></div>\n<noscript><section aria-label="מוצרי הקטגוריה"><h2>' + escapeHtml(known[0]) + '</h2><ul>' + entries.join('') + '</ul></section></noscript>');
  }
  return out;
}
function renderSeoHtml(html, bootRoute, products, routes, preview) {
  let parsed;
  try { parsed = new URL(bootRoute, SITE); } catch { return html; }
  const pathname = parsed.pathname.replace(/\/$/, '') || '/';
  if (preview) return renderProductHtml(html, preview, routes, {noindex:true});
  const product = productFromPath(pathname, parsed.search, products, routes);
  if (product) return renderProductHtml(html, product, routes);
  if (pathname === '/product.html') return setMeta(html, 'name', 'robots', 'noindex, follow');
  if (Object.prototype.hasOwnProperty.call(SEARCH_ROUTES, pathname)) return renderCollectionHtml(html, pathname, products, routes);
  return html;
}
// The HTTP /sitemap.xml endpoint renders this from the PostgreSQL-backed
// PUBLIC catalog on every request (after catalogManager.refresh()). A checked-in
// sitemap.xml is only a fallback snapshot and cannot replace this function.
const SITEMAP_MAIN_COLLECTIONS = [
  '/', '/necklaces', '/bracelets', '/watches', '/message-jewelry', '/glasses'
];
// These category URLs still resolve for compatibility, but the storefront now
// presents watches and glasses as single collections without subcategories.
const SITEMAP_UNUSED_COLLECTIONS = new Set([
  '/watches-men', '/watches-women',
  '/glasses-men', '/glasses-women', '/glasses-unisex'
]);
const { isProductInHiddenCategory } = require('./storefront-category-visibility.js');

function sitemapImageUrl(product) {
  const candidates = [...(Array.isArray(product.images) ? product.images : []), product.cardImage, product.hoverImage];
  for (const item of candidates) {
    const url = imageUrl(item);
    // Only first-party, public images. External image URLs are intentionally
    // excluded; they may not be verified in Search Console.
    if (url.startsWith(SITE + '/images/') || url.startsWith(SITE + '/api/catalog/media/')) return url;
  }
  return '';
}

function sitemapModifiedDate(product) {
  // Only emit lastmod when the product actually exposes a verifiable content
  // modification date. A build/deploy date is NOT a product modification date.
  const raw = product && product.updatedAt;
  if (!raw || (typeof raw !== 'string' && typeof raw !== 'number')) return '';
  const date = typeof raw === 'number' && raw > 1e11 ? new Date(raw) : new Date(raw);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) return '';
  if (date.getUTCFullYear() < 2020) return '';
  return date.toISOString().slice(0, 10);
}

// This file uses a short, conventional sitemap index. Each child URL is a
// dynamic XML endpoint backed by the public PostgreSQL catalog, not a stale
// checked-in snapshot. No fake lastmod and no unnecessary changefreq/priority.
const SITEMAP_SECTIONS = Object.freeze({
  '/sitemap_products_1.xml': 'products',
  '/sitemap_collections_1.xml': 'collections',
  '/sitemap_pages_1.xml': 'pages'
});
function escapeSitemapXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function sitemapEntries(products, routes, hiddenCategories) {
  const hidden = hiddenCategories && typeof hiddenCategories === 'object' ? hiddenCategories : {};
  const visible = (Array.isArray(products) ? products : []).filter(product =>
    product && product.hidden !== true && !isProductInHiddenCategory(product, hidden));
  const allowedCollection = (path) => {
    if (!Object.prototype.hasOwnProperty.call(SEARCH_ROUTES, path) ||
        SITEMAP_UNUSED_COLLECTIONS.has(path) || path === '/') return false;
    const category = routes.categoryFromPath && routes.categoryFromPath(path);
    if (!category || hidden[category] === true) return false;
    return visible.some(product => product.category === category ||
      (Array.isArray(product.categories) && product.categories.includes(category)));
  };
  const collectionPaths = [
    ...SITEMAP_MAIN_COLLECTIONS.filter(allowedCollection),
    ...Object.keys(SEARCH_ROUTES).filter(path =>
      !SITEMAP_MAIN_COLLECTIONS.includes(path) && allowedCollection(path))
  ];
  const pagePaths = ['/', ...PUBLIC_INFO_PATHS.filter(path =>
    !(path === '/ring-size-guide' && hidden.rings === true))];
  const used = new Set([...collectionPaths, ...pagePaths]);
  const unique = (paths) => [...new Set(paths)];
  const productsEntries = [];
  for (const product of visible) {
    if (!nameOf(product)) continue;
    const path = productRoute(product, routes);
    // Canonical route is the same one used in the product HTML metadata.
    if (!(/^\/product\.html\?id=product-[a-z0-9-]+$/.test(path) ||
          /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path))) continue;
    if (used.has(path) || Object.prototype.hasOwnProperty.call(SEARCH_ROUTES, path) ||
        PUBLIC_INFO_PATHS.includes(path) || SITEMAP_UNUSED_COLLECTIONS.has(path)) continue;
    used.add(path);
    productsEntries.push({ path, image: sitemapImageUrl(product), lastmod: sitemapModifiedDate(product) });
  }
  return {
    products: productsEntries,
    collections: unique(collectionPaths).map(path => ({ path })),
    pages: unique(pagePaths).map(path => ({ path }))
  };
}
function renderSitemapSection(products, routes, hiddenCategories, pathname) {
  const name = SITEMAP_SECTIONS[pathname];
  if (!name) return null;
  const entries = sitemapEntries(products, routes, hiddenCategories)[name];
  const lines = entries.map(({path, image, lastmod}) => {
    let out = '  <url>\n    <loc>' + escapeSitemapXml(SITE + path) + '</loc>';
    if (lastmod) out += '\n    <lastmod>' + escapeSitemapXml(lastmod) + '</lastmod>';
    if (image) out += '\n    <image:image><image:loc>' + escapeSitemapXml(image) + '</image:loc></image:image>';
    return out + '\n  </url>';
  });
  const imageNS = name === 'products' ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' + imageNS + '>\n' +
    lines.join('\n') + (lines.length ? '\n' : '') + '</urlset>\n';
}
function renderSitemap(products, routes, hiddenCategories) {
  const sections = sitemapEntries(products, routes, hiddenCategories);
  const locations = Object.entries(SITEMAP_SECTIONS)
    .filter(([, name]) => sections[name].length > 0)
    .map(([path]) => '  <sitemap>\n    <loc>' + escapeSitemapXml(SITE + path) + '</loc>\n  </sitemap>');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    locations.join('\n') + (locations.length ? '\n' : '') + '</sitemapindex>\n';
}

module.exports = { SITE, SEARCH_ROUTES, renderSeoHtml, renderSitemap, renderSitemapSection, productFromPath, nameOf, imageUrl };
