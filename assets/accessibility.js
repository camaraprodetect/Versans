(function(){
  if (window.__versansAccessibilityLoaded) return;
  window.__versansAccessibilityLoaded = true;

  var STORAGE_KEY = 'versansAccessibilityStateV1';
  var root = document.documentElement;
  root.classList.add('vs-a11y-root');
  var defaultState = {
    monochrome:false,
    stopMotion:false,
    blackYellow:false,
    highContrast:false,
    sepia:false,
    highlightLinks:false,
    highlightHeadings:false,
    invert:false,
    readableFont:false,
    fixedDesc:false,
    fontScale:1,
    pageZoom:1
  };
  var state = loadState();

  function loadState(){
    try{
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return Object.assign({}, defaultState, saved || {});
    }catch(e){
      return Object.assign({}, defaultState);
    }
  }
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  }
  function clamp(num, min, max){ return Math.max(min, Math.min(max, num)); }

  var widget = document.createElement('div');
  widget.className = 'vs-a11y-widget';
  widget.innerHTML = [
    '<button type="button" class="vs-a11y-trigger" aria-expanded="false" aria-controls="vs-a11y-panel" aria-label="פתח תפריט נגישות">',
      '<img class="vs-a11y-trigger__image" src="/images/accessibility-button.png" alt="" aria-hidden="true">',
    '</button>',
    '<div class="vs-a11y-panel" id="vs-a11y-panel" role="dialog" aria-modal="false" aria-label="הגדרות נגישות">',
      '<div class="vs-a11y-panel__head">',
        '<div>',
          '<h3 class="vs-a11y-panel__title">אפשרויות נגישות</h3>',
          '<p class="vs-a11y-panel__sub">התאמות למובייל ולדסקטופ</p>',
        '</div>',
      '</div>',
      '<div class="vs-a11y-grid">',
        card('monochrome','◐','מונוכרום'),
        card('stopMotion','↯','ביטול אנימציות'),
        '<button type="button" class="vs-a11y-card vs-a11y-card--close" data-action="close"><span class="vs-a11y-card__icon">✕</span><span class="vs-a11y-card__label">סגירה</span></button>',
        card('blackYellow','◩','שחור צהוב'),
        card('highContrast','◪','ניגודיות גבוהה'),
        card('sepia','◫','ספיה'),
        card('highlightLinks','🔗','הדגשת קישורים'),
        card('highlightHeadings','A','הדגשת כותרות'),
        card('invert','◑','היפוך צבעים'),
        '<button type="button" class="vs-a11y-card" data-action="fontInc"><span class="vs-a11y-card__icon">A+</span><span class="vs-a11y-card__label">הגדלת גופן</span></button>',
        card('readableFont','Aa','גופן קריא'),
        card('fixedDesc','═','תיאור קבוע'),
        '<button type="button" class="vs-a11y-card" data-action="pageDec"><span class="vs-a11y-card__icon">－</span><span class="vs-a11y-card__label">הקטנת מסך</span></button>',
        '<button type="button" class="vs-a11y-card" data-action="pageInc"><span class="vs-a11y-card__icon">＋</span><span class="vs-a11y-card__label">הגדלת מסך</span></button>',
        '<button type="button" class="vs-a11y-card" data-action="fontDec"><span class="vs-a11y-card__icon">A−</span><span class="vs-a11y-card__label">הקטנת גופן</span></button>',
      '</div>',
      '<div class="vs-a11y-footer">',
        '<a href="mailto:versanssupport@gmail.com?subject=%D7%A4%D7%A0%D7%99%D7%99%D7%94%20%D7%91%D7%A0%D7%95%D7%A9%D7%90%20%D7%A0%D7%92%D7%99%D7%A9%D7%95%D7%AA">דיווח הפרה</a>',
        '<a href="/policies.html#accessibility">הצהרת נגישות</a>',
        '<button type="button" data-action="reset">איפוס הגדרות</button>',
      '</div>',
      '<div class="vs-a11y-status" aria-live="polite"></div>',
    '</div>'
  ].join('');

  var guide = document.createElement('div');
  guide.className = 'vs-a11y-reading-guide';
  guide.setAttribute('aria-hidden', 'true');
  var mask = document.createElement('div');
  mask.className = 'vs-a11y-screen-mask';
  mask.setAttribute('aria-hidden', 'true');

  document.body.appendChild(widget);
  document.body.appendChild(guide);
  document.body.appendChild(mask);

  // Keep accessibility on the left and use its former bottom-right position for a floating cart button.
  var floatingUiStyle = document.createElement('style');
  floatingUiStyle.id = 'vs-floating-ui-v1';
  floatingUiStyle.textContent = [
    '.vs-a11y-widget{left:max(166px,calc(env(safe-area-inset-left) + 166px))!important;right:auto!important;bottom:max(14px,env(safe-area-inset-bottom))!important}',
    '.vs-a11y-widget .vs-a11y-panel{position:fixed!important;left:max(14px,env(safe-area-inset-left))!important;right:auto!important;bottom:max(82px,calc(env(safe-area-inset-bottom) + 82px))!important;transform-origin:bottom left!important}',
    '.vs-a11y-trigger{padding:0!important;overflow:hidden!important;background:transparent!important;border:0!important;box-shadow:none!important}',
    '.vs-a11y-trigger__image{display:block;width:100%;height:100%;object-fit:contain;border-radius:50%;pointer-events:none}',
    '.vs-floating-cart{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));z-index:2147482000;display:grid;place-items:center;padding:0;cursor:pointer;box-sizing:border-box;-webkit-tap-highlight-color:transparent;transition:transform .18s ease,box-shadow .18s ease}',
    'body:not(.home-page) .vs-floating-cart{display:none!important}',
    '.vs-floating-cart:hover{transform:translateY(-1px)}',
    '.vs-floating-cart:active{transform:scale(.96)}',
    '.vs-floating-cart svg{width:53%;height:53%;display:block;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}',
    '.vs-floating-cart__count{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:#c91824;color:#fff;border:2px solid #fff;font:800 10px/1 Arial,sans-serif;box-sizing:border-box;box-shadow:0 2px 6px rgba(0,0,0,.18)}',
    '.vs-floating-cart__count[hidden]{display:none!important}',
    '@media(max-width:700px){.vs-a11y-widget{left:max(130px,calc(env(safe-area-inset-left) + 130px))!important;right:auto!important;bottom:max(10px,env(safe-area-inset-bottom))!important}.vs-a11y-widget .vs-a11y-panel{left:max(8px,env(safe-area-inset-left))!important;bottom:max(64px,calc(env(safe-area-inset-bottom) + 64px))!important}.vs-floating-cart{right:max(11px,env(safe-area-inset-right));bottom:max(11px,env(safe-area-inset-bottom))}}'
  ].join('');
  document.head.appendChild(floatingUiStyle);

  var trigger = widget.querySelector('.vs-a11y-trigger');

  var floatingCart = document.createElement('button');
  floatingCart.type = 'button';
  floatingCart.className = 'vs-floating-cart';
  floatingCart.setAttribute('aria-label', 'פתיחת סל הקניות');
  floatingCart.innerHTML = [
    '<svg viewBox="0 0 24 24" aria-hidden="true">',
      '<path d="M6 8h12l1 13H5L6 8Z"></path>',
      '<path d="M9 9V6.5a3 3 0 0 1 6 0V9"></path>',
    '</svg>',
    '<span class="vs-floating-cart__count" data-cart-count hidden>0</span>'
  ].join('');
  document.body.appendChild(floatingCart);

  function syncFloatingCartLook(){
    if (!trigger || !floatingCart) return;
    var rect = trigger.getBoundingClientRect();
    if (rect.width) floatingCart.style.width = rect.width + 'px';
    if (rect.height) floatingCart.style.height = rect.height + 'px';
    floatingCart.style.borderRadius = '50%';
    floatingCart.style.background = '#0b0b0b';
    floatingCart.style.border = '0';
    floatingCart.style.boxShadow = '0 8px 22px rgba(0,0,0,.28)';
    floatingCart.style.color = '#ffffff';
  }

  function syncFloatingCartCount(){
    if (window.VERSANS_CART_STATE && typeof window.VERSANS_CART_STATE.syncBadge === 'function') {
      window.VERSANS_CART_STATE.syncBadge(floatingCart);
      return;
    }
    var count = 0;
    try {
      var rows = JSON.parse(localStorage.getItem('kw_cart') || '[]');
      if (Array.isArray(rows)) rows.forEach(function(row){ count += Math.max(0, parseInt(row && row.qty, 10) || 0); });
    } catch(e) {}
    var badge = floatingCart.querySelector('[data-cart-count]');
    if (!badge) return;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function findExistingCartOpener(){
    var selectors = ['#cartBtn','[data-cart-open]','.product-cart-link','.cartbtn'];
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        if (nodes[j] !== floatingCart && !nodes[j].classList.contains('vs-floating-cart')) return nodes[j];
      }
    }
    return null;
  }

  function isCartOverlayOpen(){
    var overlay = document.getElementById('cartOverlay');
    if (!overlay) return false;
    if (overlay.classList.contains('is-open') || overlay.classList.contains('open') || overlay.classList.contains('on') || overlay.classList.contains('active')) return true;
    if (overlay.getAttribute('aria-hidden') === 'false') return true;
    var cs = window.getComputedStyle(overlay);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && parseFloat(cs.opacity || '1') > 0.01;
  }

  function closeExistingCart(){
    var overlay = document.getElementById('cartOverlay');
    if (!overlay) return false;
    var closeBtn = overlay.querySelector('.ov__close,[data-close]');
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    return false;
  }

  floatingCart.addEventListener('click', function(){
    if (isCartOverlayOpen() && closeExistingCart()) return;
    var opener = findExistingCartOpener();
    if (opener) {
      opener.click();
      return;
    }
    window.location.href = '/#shop';
  });

  syncFloatingCartLook();
  syncFloatingCartCount();
  window.addEventListener('resize', syncFloatingCartLook, {passive:true});
  window.addEventListener('versans:cart-changed', syncFloatingCartCount);
  window.addEventListener('storage', function(e){ if (!e || e.key === 'kw_cart') syncFloatingCartCount(); });
  window.addEventListener('pageshow', syncFloatingCartCount);
  var panel = widget.querySelector('.vs-a11y-panel');
  var statusEl = widget.querySelector('.vs-a11y-status');
  var lastGuideY = Math.round(window.innerHeight * 0.38);
  updateGuide(lastGuideY);

  trigger.addEventListener('click', function(){
    togglePanel();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closePanel();
  });
  document.addEventListener('click', function(e){
    if (!widget.contains(e.target)) closePanel();
  });
  panel.addEventListener('click', function(e){ e.stopPropagation(); });

  widget.querySelectorAll('[data-setting],[data-action]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var setting = btn.getAttribute('data-setting');
      var action = btn.getAttribute('data-action');
      if (setting) toggleSetting(setting);
      if (action) runAction(action);
    });
  });

  document.addEventListener('mousemove', function(e){
    if (!state.fixedDesc) return;
    updateGuide(e.clientY);
  }, {passive:true});
  document.addEventListener('touchstart', function(e){
    if (!state.fixedDesc || !e.touches || !e.touches[0]) return;
    updateGuide(e.touches[0].clientY);
  }, {passive:true});
  document.addEventListener('touchmove', function(e){
    if (!state.fixedDesc || !e.touches || !e.touches[0]) return;
    updateGuide(e.touches[0].clientY);
  }, {passive:true});

  function card(setting, icon, label){
    return '<button type="button" class="vs-a11y-card" data-setting="'+setting+'"><span class="vs-a11y-card__icon">'+icon+'</span><span class="vs-a11y-card__label">'+label+'</span></button>';
  }
  function togglePanel(force){
    var open = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  }
  function closePanel(){ togglePanel(false); }
  function announce(text){ statusEl.textContent = text; }
  function toggleSetting(setting){
    if (!(setting in state)) return;
    if (setting === 'blackYellow' && !state.blackYellow) state.highContrast = false;
    if (setting === 'highContrast' && !state.highContrast) state.blackYellow = false;
    state[setting] = !state[setting];
    applyState();
    saveState();
    announce('עודכן: ' + labelFor(setting));
  }
  function runAction(action){
    if (action === 'close') return closePanel();
    if (action === 'fontInc') state.fontScale = clamp((state.fontScale || 1) + 0.1, 0.9, 1.6);
    if (action === 'fontDec') state.fontScale = clamp((state.fontScale || 1) - 0.1, 0.9, 1.6);
    if (action === 'pageInc') state.pageZoom = clamp((state.pageZoom || 1) + 0.05, 0.9, 1.2);
    if (action === 'pageDec') state.pageZoom = clamp((state.pageZoom || 1) - 0.05, 0.9, 1.2);
    if (action === 'reset') state = Object.assign({}, defaultState);
    applyState();
    saveState();
    var messages = {fontInc:'הוגדל הגופן', fontDec:'הוקטן הגופן', pageInc:'הוגדל המסך', pageDec:'הוקטן המסך', reset:'ההגדרות אופסו'};
    announce(messages[action] || 'עודכן');
  }
  function labelFor(setting){
    var labels = {
      monochrome:'מונוכרום', stopMotion:'ביטול אנימציות', blackYellow:'שחור צהוב',
      highContrast:'ניגודיות גבוהה', sepia:'ספיה', highlightLinks:'הדגשת קישורים',
      highlightHeadings:'הדגשת כותרות', invert:'היפוך צבעים', readableFont:'גופן קריא',
      fixedDesc:'תיאור קבוע'
    };
    return labels[setting] || setting;
  }
  function isManagedHeroVideo(video){
    return !!(video && video.matches && video.matches('video[data-versans-hero-video]'));
  }

  function heroVideoMatchesViewport(video){
    if (!isManagedHeroVideo(video)) return true;
    if (video.classList.contains('mobile-entry-banner__video')) {
      return window.matchMedia('(max-width: 767px)').matches;
    }
    if (video.classList.contains('hero__video')) {
      return window.matchMedia('(min-width: 768px)').matches;
    }
    return true;
  }

  function prepareAutoplayVideo(video){
    if (!video) return;
    try { video.controls = false; } catch(e) {}
    try { video.muted = true; } catch(e) {}
    try { video.defaultMuted = true; } catch(e) {}
    try { video.autoplay = true; } catch(e) {}
    try { video.loop = true; } catch(e) {}
    try { video.playsInline = true; } catch(e) {}
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    video.setAttribute('x-webkit-airplay', 'deny');
    video.removeAttribute('controls');
  }

  function playManagedHeroVideo(video){
    if (!isManagedHeroVideo(video)) return;
    prepareAutoplayVideo(video);
    if (state.stopMotion || document.hidden || !heroVideoMatchesViewport(video)) return;

    if (video.ended) {
      try { video.currentTime = 0; } catch(e) {}
    }

    var promise;
    try { promise = video.play(); } catch(e) {}
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function(){});
    }
  }

  function resumeManagedHeroVideos(){
    if (state.stopMotion || document.hidden) return;
    document.querySelectorAll('video[data-versans-hero-video]').forEach(function(video){
      playManagedHeroVideo(video);
    });
  }

  function queueHeroResume(){
    resumeManagedHeroVideos();
    window.setTimeout(resumeManagedHeroVideos, 80);
    window.setTimeout(resumeManagedHeroVideos, 320);
    window.setTimeout(resumeManagedHeroVideos, 900);
  }

  function bindManagedHeroVideo(video){
    if (!isManagedHeroVideo(video) || video.__vsHeroLoopBound) return;
    video.__vsHeroLoopBound = true;
    prepareAutoplayVideo(video);

    video.addEventListener('ended', function(){
      if (state.stopMotion || document.hidden || !heroVideoMatchesViewport(video)) return;
      try { video.currentTime = 0; } catch(e) {}
      playManagedHeroVideo(video);
    });

    video.addEventListener('pause', function(){
      if (state.stopMotion || document.hidden || !heroVideoMatchesViewport(video)) return;
      window.setTimeout(function(){
        if (!state.stopMotion && !document.hidden && video.paused) playManagedHeroVideo(video);
      }, 70);
    });
  }

  document.querySelectorAll('video[data-versans-hero-video]').forEach(bindManagedHeroVideo);

  window.addEventListener('pageshow', function(){
    queueHeroResume();
  });

  window.addEventListener('focus', function(){
    queueHeroResume();
  });

  window.addEventListener('popstate', function(){
    queueHeroResume();
  });

  window.addEventListener('resize', function(){
    queueHeroResume();
  }, {passive:true});

  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) queueHeroResume();
  });

  /* iOS may defer autoplay after restoring a page from memory.
     Any normal user interaction retries playback, without ever showing controls. */
  ['touchstart','pointerdown','keydown'].forEach(function(eventName){
    document.addEventListener(eventName, function(){
      if (!state.stopMotion) resumeManagedHeroVideos();
    }, {passive:true, capture:true});
  });

  function syncMotionMedia(){
    var shouldPause = !!state.stopMotion;
    document.querySelectorAll('video').forEach(function(video){
      if (!video.__vsA11yMotionBound) {
        video.__vsA11yMotionBound = true;
        video.addEventListener('play', function(){
          if (state.stopMotion && !video.paused) {
            video.setAttribute('data-vs-a11y-paused', '1');
            video.pause();
          }
        });
      }

      if (shouldPause) {
        if (!video.paused) video.setAttribute('data-vs-a11y-paused', '1');
        video.pause();
      } else if (video.getAttribute('data-vs-a11y-paused') === '1') {
        video.removeAttribute('data-vs-a11y-paused');
        var playPromise;
        try { playPromise = video.play(); } catch(e) {}
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(function(){});
      }
    });
  }

  function applyState(){
    root.classList.toggle('vs-a11y-stop-motion', !!state.stopMotion);
    syncMotionMedia();
    root.classList.toggle('vs-a11y-links', !!state.highlightLinks);
    root.classList.toggle('vs-a11y-headings', !!state.highlightHeadings);
    root.classList.toggle('vs-a11y-readable-font', !!state.readableFont);
    root.classList.toggle('vs-a11y-high-contrast', !!state.highContrast);
    root.classList.toggle('vs-a11y-black-yellow', !!state.blackYellow);
    root.classList.toggle('vs-a11y-fixed-desc', !!state.fixedDesc);
    root.classList.toggle('vs-a11y-page-smaller', (state.pageZoom || 1) < 1);
    root.classList.toggle('vs-a11y-page-larger', (state.pageZoom || 1) > 1);
    root.style.setProperty('--vs-a11y-font-scale', String(state.fontScale || 1));
    root.style.setProperty('--vs-a11y-page-zoom', String(state.pageZoom || 1));
    var filters = [];
    if (state.monochrome) filters.push('grayscale(1)');
    if (state.sepia) filters.push('sepia(1)');
    if (state.invert) filters.push('invert(1) hue-rotate(180deg)');
    root.classList.toggle('vs-a11y-filter-active', filters.length > 0);
    root.style.setProperty('--vs-a11y-filter', filters.join(' ') || 'none');
    guide.style.opacity = state.fixedDesc ? '1' : '0';
    updateCardState();
  }
  function updateCardState(){
    widget.querySelectorAll('[data-setting]').forEach(function(btn){
      var active = !!state[btn.getAttribute('data-setting')];
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }
  function updateGuide(y){
    lastGuideY = clamp(Math.round(y || lastGuideY || 0), 40, Math.max(40, window.innerHeight - 40));
    guide.style.top = lastGuideY + 'px';
  }

  if (window.MutationObserver) {
    var motionObserver = new MutationObserver(function(mutations){
      if (!state.stopMotion) return;
      var hasNewVideo = mutations.some(function(mutation){
        return Array.prototype.some.call(mutation.addedNodes || [], function(node){
          return node && node.nodeType === 1 && (node.tagName === 'VIDEO' || (node.querySelector && node.querySelector('video')));
        });
      });
      if (hasNewVideo) {
        document.querySelectorAll('video[data-versans-hero-video]').forEach(bindManagedHeroVideo);
        syncMotionMedia();
        if (!state.stopMotion) queueHeroResume();
      }
    });
    motionObserver.observe(document.body, {childList:true, subtree:true});
  }

  applyState();
  if (!state.stopMotion) queueHeroResume();
})();


/* VerSans Bot loader - shared across customer pages. */
(function(){
  if (window.__versansBotLoaderAdded) return;
  window.__versansBotLoaderAdded = true;

  function loadVersansBot(){
    if (!document.querySelector('link[data-versans-bot-style]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/versans-bot.css?v=20261005-guardrails-v8';
      link.setAttribute('data-versans-bot-style', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-versans-bot-script]')) {
      var script = document.createElement('script');
      script.src = '/assets/versans-bot.js?v=20261005-ai-v6';
      script.async = true;
      script.setAttribute('data-versans-bot-script', '1');
      document.body.appendChild(script);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadVersansBot, { once:true });
  else loadVersansBot();
})();
