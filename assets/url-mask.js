(function () {
  'use strict';

  var state = window.VERSANS_URL_STATE;
  if (!state || location.pathname.startsWith('/admin')) return;

  function addShareButton() {
    if (!document.body.classList.contains('product-page-body')) return;
    if (document.getElementById('productShareBtn')) return;

    var favorite = document.getElementById('productFavoriteBtn');
    var host = favorite && favorite.parentElement;
    if (!host) return;

    var button = document.createElement('button');
    button.className = 'product-share-btn';
    button.id = 'productShareBtn';
    button.type = 'button';
    button.setAttribute('aria-label', 'שיתוף המוצר');
    button.innerHTML = '' +
      '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' +
        '<circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle>' +
        '<path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"></path>' +
      '</svg><span>שיתוף</span>';
    host.appendChild(button);

    if (!document.getElementById('versansShareButtonStyle')) {
      var style = document.createElement('style');
      style.id = 'versansShareButtonStyle';
      style.textContent = '' +
        '.product-share-btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:38px;padding:.45rem .72rem;border:1px solid #dfe4e9;border-radius:999px;background:#fff;color:#253649;font:700 .78rem/1 var(--sans);cursor:pointer;white-space:nowrap;transition:border-color .18s ease,background .18s ease,color .18s ease,transform .18s ease}' +
        '.product-share-btn:hover{background:#f8fafb;border-color:#bfc9d2;transform:translateY(-1px)}' +
        '.product-share-btn:focus-visible{outline:2px solid #142333;outline-offset:2px}' +
        '@media(max-width:700px){.product-share-btn{min-height:36px;padding:.4rem .62rem;font-size:.73rem}}';
      document.head.appendChild(style);
    }

    button.addEventListener('click', async function () {
      var canonical = document.querySelector('link[rel="canonical"]');
      var url = canonical && /^https?:\/\//i.test(canonical.href) && canonical.pathname !== '/'
        ? canonical.href
        : state.actualUrl();
      var title = document.title || 'VerSans';
      try {
        if (navigator.share) {
          await navigator.share({ title: title, url: url });
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          var span = button.querySelector('span');
          if (span) {
            var old = span.textContent;
            span.textContent = 'הקישור הועתק';
            setTimeout(function () { span.textContent = old; }, 1600);
          }
          return;
        }
        window.prompt('העתיקו את הקישור למוצר:', url);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        try { window.prompt('העתיקו את הקישור למוצר:', url); } catch (_) {}
      }
    });
  }

  addShareButton();
  state.mask();
})();
