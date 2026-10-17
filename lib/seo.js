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
function renderSitemap(products, routes) {
  const paths = new Set([...Object.keys(SEARCH_ROUTES),...PUBLIC_INFO_PATHS]);
  for (const p of products) {
    const publicPath = productRoute(p,routes);
    if (publicPath !== '/' && (/^\/product\.html\?id=product-\d+$/.test(publicPath) || /^\/[a-z\d][a-z\d-]*$/.test(publicPath))) paths.add(publicPath);
  }
  const escXml = s => str(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...paths].map(p => '  <url><loc>' + escXml(SITE+p) + '</loc></url>').join('\n') + '\n</urlset>\n';
}
module.exports = { SITE, SEARCH_ROUTES, renderSeoHtml, renderSitemap, productFromPath, nameOf, imageUrl };
