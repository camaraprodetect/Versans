(function () {
  'use strict';

  function logicalPath(){
    try { return window.VERSANS_URL_STATE && window.VERSANS_URL_STATE.path ? window.VERSANS_URL_STATE.path() : location.pathname; }
    catch (_) { return location.pathname || '/'; }
  }
  function logicalSearch(){
    try { return window.VERSANS_URL_STATE && window.VERSANS_URL_STATE.search ? window.VERSANS_URL_STATE.search() : location.search; }
    catch (_) { return location.search || ''; }
  }

  if (logicalPath() === '/admin' || logicalPath().indexOf('/admin/') === 0) return;

  var HEARTBEAT_MS = 25 * 1000;
  var lastPath = logicalPath() || '/';
  var sending = false;

  function text(value, max) {
    value = String(value == null ? '' : value).trim();
    return value ? value.slice(0, max) : null;
  }

  function detectBrowser() {
    var ua = navigator.userAgent || '';
    var match;
    if ((match = /Edg\/([\d.]+)/.exec(ua))) return 'Edge ' + match[1];
    if ((match = /OPR\/([\d.]+)/.exec(ua))) return 'Opera ' + match[1];
    if ((match = /Chrome\/([\d.]+)/.exec(ua))) return 'Chrome ' + match[1];
    if ((match = /Firefox\/([\d.]+)/.exec(ua))) return 'Firefox ' + match[1];
    if (/Safari\//.test(ua) && (match = /Version\/([\d.]+)/.exec(ua))) return 'Safari ' + match[1];
    return 'Unknown';
  }

  function detectOS() {
    var ua = navigator.userAgent || '';
    if (/Windows NT 10\.0/.test(ua)) return 'Windows 10/11';
    if (/Windows NT/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) {
      var android = /Android\s+([\d.]+)/.exec(ua);
      return 'Android' + (android ? ' ' + android[1] : '');
    }
    if (/iPhone|iPad|iPod/.test(ua)) {
      var ios = /OS\s([\d_]+)/.exec(ua);
      return 'iOS' + (ios ? ' ' + ios[1].replace(/_/g, '.') : '');
    }
    if (/Mac OS X/.test(ua)) {
      var mac = /Mac OS X\s([\d_]+)/.exec(ua);
      return 'macOS' + (mac ? ' ' + mac[1].replace(/_/g, '.') : '');
    }
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function detectDeviceType() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function utm() {
    var params = new URLSearchParams(logicalSearch() || '');
    return {
      utmSource: text(params.get('utm_source'), 120),
      utmMedium: text(params.get('utm_medium'), 120),
      utmCampaign: text(params.get('utm_campaign'), 160),
      utmTerm: text(params.get('utm_term'), 160),
      utmContent: text(params.get('utm_content'), 160)
    };
  }

  function payload(kind) {
    var campaign = utm();
    return {
      kind: kind,
      path: logicalPath() || '/',
      title: text(document.title, 180),
      referrer: text(document.referrer, 500),
      utmSource: campaign.utmSource,
      utmMedium: campaign.utmMedium,
      utmCampaign: campaign.utmCampaign,
      utmTerm: campaign.utmTerm,
      utmContent: campaign.utmContent,
      language: text(navigator.language, 32),
      browser: detectBrowser(),
      os: detectOS(),
      deviceType: detectDeviceType(),
      screenWidth: screen && Number(screen.width) || null,
      screenHeight: screen && Number(screen.height) || null,
      viewportWidth: Number(window.innerWidth) || null,
      viewportHeight: Number(window.innerHeight) || null
    };
  }

  function send(kind) {
    if (sending || document.visibilityState === 'hidden') return;
    sending = true;
    fetch('/api/presence', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(kind))
    }).catch(function () {}).finally(function () { sending = false; });
  }

  function pageChanged() {
    var current = logicalPath() || '/';
    if (current !== lastPath) {
      lastPath = current;
      send('pageview');
      return true;
    }
    return false;
  }

  function heartbeat() {
    if (document.visibilityState !== 'visible') return;
    if (!pageChanged()) send('heartbeat');
  }

  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    if (typeof original !== 'function') return;
    history[name] = function () {
      var result = original.apply(this, arguments);
      setTimeout(pageChanged, 0);
      return result;
    };
  });

  window.addEventListener('popstate', pageChanged);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') heartbeat();
  });

  send('pageview');
  setInterval(heartbeat, HEARTBEAT_MS);
})();
