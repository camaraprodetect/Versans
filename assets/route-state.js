(function () {
  'use strict';

  var STORAGE_KEY = 'versans_hidden_route_v1';
  var BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot/i;
  var isBot = BOT_RE.test(String(navigator.userAgent || ''));
  var nativePushState = history.pushState.bind(history);
  var nativeReplaceState = history.replaceState.bind(history);

  function normalizeRoute(value) {
    try {
      var url = new URL(String(value || '/'), location.origin);
      if (url.origin !== location.origin) return '/';
      return (url.pathname || '/') + (url.search || '') + (url.hash || '');
    } catch (_) {
      return '/';
    }
  }

  function routeUrl(value) {
    try { return new URL(normalizeRoute(value), location.origin); }
    catch (_) { return new URL('/', location.origin); }
  }

  function navigationType() {
    try {
      var entry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      return entry && entry.type ? entry.type : '';
    } catch (_) { return ''; }
  }

  var visibleRoute = normalizeRoute(location.pathname + location.search + location.hash);
  var stateRoute = history.state && history.state.__versansRoute
    ? normalizeRoute(history.state.__versansRoute)
    : '';
  var savedRoute = '';
  try { savedRoute = normalizeRoute(sessionStorage.getItem(STORAGE_KEY) || '/'); } catch (_) {}

  /* A masked product/category refresh requests `/`. Restore the real route before
     the storefront scripts initialize, then the late mask hides it again. */
  if (!isBot && visibleRoute === '/' && navigationType() === 'reload') {
    var reloadRoute = stateRoute && stateRoute !== '/' ? stateRoute : savedRoute;
    if (reloadRoute && reloadRoute !== '/') {
      location.replace(reloadRoute);
      return;
    }
  }

  var bootRoute = normalizeRoute(window.__VERSANS_BOOT_ROUTE__ || visibleRoute);
  /* URL fragments are never sent to the server, so the injected boot route can
     miss anchors such as #reviews even though the browser still has them. Keep
     the browser fragment attached to the logical route before masking the URL. */
  try {
    var visibleHash = routeUrl(visibleRoute).hash || '';
    if (visibleHash && !routeUrl(bootRoute).hash) bootRoute = normalizeRoute(bootRoute + visibleHash);
  } catch (_) {}
  var currentRoute = (visibleRoute === '/' && stateRoute && stateRoute !== '/') ? stateRoute : bootRoute;

  function save(route) {
    currentRoute = normalizeRoute(route);
    try { sessionStorage.setItem(STORAGE_KEY, currentRoute); } catch (_) {}
  }
  save(currentRoute);

  function decorateState(state, route) {
    var out = {};
    if (state && typeof state === 'object') {
      Object.keys(state).forEach(function (key) { out[key] = state[key]; });
    }
    out.__versansRoute = normalizeRoute(route);
    return out;
  }

  function path() { return routeUrl(currentRoute).pathname || '/'; }
  function search() { return routeUrl(currentRoute).search || ''; }
  function hash() { return routeUrl(currentRoute).hash || ''; }
  function full() { return currentRoute; }
  function actualUrl(route) { return location.origin + normalizeRoute(route || currentRoute); }

  function setRoute(route) {
    save(route);
    return currentRoute;
  }

  function mask() {
    if (isBot || location.pathname.startsWith('/admin')) return;
    nativeReplaceState(decorateState(history.state, currentRoute), '', '/');
  }

  function navigate(route, replace) {
    var next = setRoute(route);
    if (replace) location.replace(next);
    else location.href = next;
  }

  history.pushState = function (state, title, url) {
    if (url == null) return nativePushState(state, title, url);
    var next;
    try {
      var parsed = new URL(String(url), location.origin + currentRoute);
      if (parsed.origin !== location.origin) return nativePushState(state, title, url);
      next = normalizeRoute(parsed.pathname + parsed.search + parsed.hash);
    } catch (_) {
      return nativePushState(state, title, url);
    }
    save(next);
    return nativePushState(decorateState(state, next), title, isBot ? next : '/');
  };

  history.replaceState = function (state, title, url) {
    if (url == null) return nativeReplaceState(state, title, url);
    var next;
    try {
      var parsed = new URL(String(url), location.origin + currentRoute);
      if (parsed.origin !== location.origin) return nativeReplaceState(state, title, url);
      next = normalizeRoute(parsed.pathname + parsed.search + parsed.hash);
    } catch (_) {
      return nativeReplaceState(state, title, url);
    }
    save(next);
    return nativeReplaceState(decorateState(state, next), title, isBot ? next : '/');
  };

  window.addEventListener('popstate', function (event) {
    var next = event && event.state && event.state.__versansRoute;
    if (next) save(next);
    else save(location.pathname + location.search + location.hash);
  }, true);

  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download')) return;
    var target = String(anchor.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return;
    if (event.button && event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try {
      var rawHref = anchor.getAttribute('href') || anchor.href;

      /* Every non-home document is visually masked to `/`. Home-section links such
         as /#shop would otherwise become same-document hash jumps and leave the
         current DOM (account/product/policies/etc.) on screen. Force a real load
         through /shop, which the server maps to index.html, then url-mask.js hides
         the route again after the storefront has initialized. */
      var previewUrl = new URL(rawHref, location.origin + currentRoute);
      /* Category routes such as /rings use the same home-page DOM and are switched
         client-side by store.js. Treat that DOM as the home document even when the
         logical route is a category, otherwise clicking "עמוד בית" is intercepted
         here and causes a full reload through /shop. */
      var isHomeDocument = !!(document.body && document.body.classList.contains('home-page'));
      var homeFragments = { '#shop':1, '#shopTitle':1, '#reviews':1, '#top':1, '#how':1, '#faq':1, '#contact':1 };
      if (!isHomeDocument && previewUrl.origin === location.origin && previewUrl.pathname === '/' &&
          (!previewUrl.hash || homeFragments[previewUrl.hash])) {
        var documentRoute = '/shop' + (previewUrl.search || '') + (previewUrl.hash || '');
        event.preventDefault();
        save(documentRoute);
        location.assign(documentRoute);
        return;
      }

      var url = previewUrl;
      if (url.origin !== location.origin) return;
      save(url.pathname + url.search + url.hash);
    } catch (_) {}
  }, true);

  window.VERSANS_URL_STATE = {
    full: full,
    path: path,
    search: search,
    hash: hash,
    setRoute: setRoute,
    mask: mask,
    navigate: navigate,
    actualUrl: actualUrl,
    isBot: isBot
  };
})();
