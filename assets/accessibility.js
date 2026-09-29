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
      '<span class="vs-a11y-trigger__icon" aria-hidden="true">♿</span>',
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

  var trigger = widget.querySelector('.vs-a11y-trigger');
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
      if (hasNewVideo) syncMotionMedia();
    });
    motionObserver.observe(document.body, {childList:true, subtree:true});
  }

  applyState();
})();
