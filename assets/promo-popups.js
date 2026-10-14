/* VerSans Video Promotions 2026-10-13. Replaces previous popup engine. */
(function () {
  'use strict';
  if (window.__versansVideoPromosReady) return;
  window.__versansVideoPromosReady = true;
  var FIRST_MS = 10000, INTERVAL_MS = 180000, CART_GAP_MS = 45000;
  var STORAGE_KEY = 'versans-video-promos-20261013-v2';
  var DIR = '/assets/promo-videos/';
  var offers = {
    jewelry: {headline:'קנה 2, קבל 1 בחינם',detail:'על כל קולקציית התכשיטים',video:'jewelry-2plus1.mp4',url:'/#shopTitle',action:'לגלות את התכשיטים'},
    jewelryThird: {headline:'חסר לך עוד תכשיט אחד למתנה!',detail:'מוסיפים שלישי ומקבלים את הזול במתנה',video:'jewelry-2plus1.mp4',url:'/#shopTitle',action:'להשלמת המבצע'},
    signup: {headline:'התחבר וקבל קוד קופון 3%',detail:'לנרשמים חדשים נשלח קוד הקופון למייל',video:'signup-3-percent.mp4',url:'/register',action:'להרשמה וקבלת הקופון'},
    hatsTwo: {headline:'2 כובעים ב־239.90 ₪',detail:'על קולקציית הכובעים',video:'hats-two-23990.mp4',url:'/hats#shop',action:'לבחירת כובעים'},
    hatsThree: {headline:'3 כובעים ב־299.90 ₪',detail:'על קולקציית הכובעים',video:'hats-three-29990.mp4',url:'/hats#shop',action:'לגלות את הכובעים'},
    glasses: {headline:'2 דגמי משקפיים ב־249.90 ₪',detail:'על קולקציית המשקפיים',video:'glasses-two-24990.mp4',url:'/glasses#shop',action:'לבחירת משקפיים'}
  };
  var saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) {}
  var firstAt = Number(saved.firstAt) || Date.now();
  var lastAt = Number(saved.lastAt) || 0;
  var lastCartAt = Number(saved.lastCartAt) || 0;
  var history = Array.isArray(saved.history) ? saved.history.slice(-10) : [];
  var auth = 'unknown', modal = null, player = null, timer = null, restoreFocus = null;
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({firstAt:firstAt,lastAt:lastAt,lastCartAt:lastCartAt,history:history.slice(-10)})); } catch (_) {}
  }
  save();
  function refreshAuth() {
    return fetch('/api/auth/me', {credentials:'same-origin',cache:'no-store'})
      .then(function(r){if(!r.ok) throw Error('auth');return r.json();})
      .then(function(d){auth = d && d.user ? 'member' : 'guest';})
      .catch(function(){});
  }
  function getCart() {
    try {
      if (window.VERSANS_CART_STATE && typeof window.VERSANS_CART_STATE.read === 'function') {
        var v = window.VERSANS_CART_STATE.read(); if (Array.isArray(v)) return v;
      }
      var data = JSON.parse(localStorage.getItem('kw_cart') || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) {return [];}
  }
  function productFor(item) {
    var list = window.PRODUCTS;
    if (!Array.isArray(list)) return item || {};
    var id = String(item && (item.id || item.productId || item.product_id) || '');
    for (var i=0;i<list.length;i++) {
      if (String(list[i].id) === id || String(list[i].slug) === id) return list[i];
    }
    return item || {};
  }
  function category(item) {
    var p=productFor(item), cats=(Array.isArray(p.categories)?p.categories:[p.category]).filter(Boolean).join(' ').toLowerCase();
    var t=[p.name,p.title && (p.title.he || p.title),item && item.name,item && item.title].filter(Boolean).join(' ').toLowerCase();
    if (/glasses|sunglasses/.test(cats)||/משקפ/.test(t)) return 'glasses';
    if (/hats|cap/.test(cats)||/כובע|כובעים/.test(t)) return 'hats';
    if (/bracelet|necklace|ring|watch|greeting|photo|jewel|fashion/.test(cats)||/צמיד|שרשרת|טבעת|תכשיט|שעון/.test(t)) return 'jewelry';
    return 'other';
  }
  function counts() {
    var res = {jewelry:0,hats:0,glasses:0};
    getCart().forEach(function(item){
      var k=category(item);
      if (k in res) res[k]+=Math.max(1,Math.min(50,parseInt(item.qty || item.quantity,10)||1));
    });
    return res;
  }
  function candidates() {
    var c=counts(), page=location.pathname.toLowerCase();
    if (c.jewelry===2) return ['jewelryThird','jewelry','glasses','hatsTwo'];
    if (c.hats===2) return ['hatsThree','hatsTwo','jewelry','glasses'];
    if (c.hats===1) return ['hatsTwo','hatsThree','jewelry','glasses'];
    if (c.glasses===1) return ['glasses','jewelry','hatsTwo','hatsThree'];
    if (/hats|cap/.test(page)) return ['hatsTwo','hatsThree','jewelry','glasses'];
    if (/glass/.test(page)) return ['glasses','jewelry','hatsTwo','hatsThree'];
    var result=['jewelry','glasses','hatsTwo','hatsThree'];
    if (auth==='guest') result.splice(1,0,'signup');
    return result;
  }
  function chooseAutomatic() {
    var list=candidates(), previous=history.slice(-2);
    var unshown=list.filter(function(k){return previous.indexOf(k)<0;});
    if (!unshown.length) unshown=list.filter(function(k){return k!==history[history.length-1];});
    if (!unshown.length) unshown=list;
    return unshown[history.length % unshown.length];
  }
  function chooseCart() {
    var c=counts();
    if (auth==='guest') return 'signup';
    if (c.jewelry===2) return 'jewelryThird';
    if (c.hats===2) return 'hatsThree';
    if (c.hats===1) return 'hatsTwo';
    if (c.glasses===1) return 'glasses';
    return 'jewelry';
  }
  function isBlocked(allowCart) {
    if (/\/(checkout|payment|thank-you|admin|login|register|reset-password)(?:\/|$)/i.test(location.pathname)) return true;
    var active=document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
    if (document.querySelector('#coOverlay.is-open, #versansGlobalCheckoutOverlay.is-open')) return true;
    var dialogs=document.querySelectorAll('[aria-modal="true"]');
    for (var i=0;i<dialogs.length;i++) {
      var d=dialogs[i];
      if (modal && (d===modal || modal.contains(d))) continue;
      if (allowCart && (d.id==='cartOverlay' || d.id==='versansGlobalCartOverlay' || d.closest('#cartOverlay, #versansGlobalCartOverlay'))) continue;
      if (d.offsetParent!==null && getComputedStyle(d).display!=='none' && getComputedStyle(d).visibility!=='hidden') return true;
    }
    return false;
  }
  function el(tag,cls,label) {
    var e=document.createElement(tag); if(cls)e.className=cls;if(label!=null)e.textContent=label;return e;
  }
  function onKeydown(e){if(e.key==='Escape'){e.preventDefault();hide();}}
  function hide(skipFocus) {
    if (!modal) return;
    if (player) {try{player.pause();}catch(_){}}
    document.removeEventListener('keydown',onKeydown,true);
    modal.remove();modal=null;player=null;
    if (skipFocus !== true && restoreFocus && restoreFocus.isConnected && restoreFocus.focus) {
      try{restoreFocus.focus({preventScroll:true});}catch(_){}
    }
    restoreFocus=null;
  }
  function present(key,source) {
    var p=offers[key];
    if (!p || modal || document.visibilityState==='hidden') return false;
    restoreFocus=document.activeElement;
    var backdrop=el('div','vs-video-promo-backdrop');
    backdrop.id='versans-video-promo';
    var dialog=el('section','vs-video-promo-dialog');
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label',p.headline);dialog.setAttribute('dir','rtl');dialog.tabIndex=-1;
    var x=el('button','vs-video-promo-close','×');x.type='button';x.setAttribute('aria-label','סגירת הפרסומת');
    var visual=el('div','vs-video-promo-visual');
    var video=el('video','vs-video-promo-player');video.muted=true;video.defaultMuted=true;
    video.loop=!reduceMotion;video.playsInline=true;video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline','');video.preload='metadata';video.controls=false;
    video.poster=DIR+p.video.replace(/\.mp4$/,'.jpg');video.setAttribute('aria-label',p.headline);
    if (!reduceMotion) {var media=el('source');media.src=DIR+p.video;media.type='video/mp4';video.appendChild(media);}
    visual.appendChild(video);
    var actions=el('div','vs-video-promo-actions');
    var action=el('a','vs-video-promo-cta',p.action);action.href=p.url;
    actions.appendChild(action);dialog.append(x,visual,actions);backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);modal=backdrop;player=video;
    x.addEventListener('click',hide);
    action.addEventListener('click',function(e){
      if (e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var destination=action.href;
      hide(true);
      // Navigate after removal: native link navigation can be skipped for a detached anchor.
      window.location.assign(destination);
    });
    backdrop.addEventListener('click',function(e){if(e.target===backdrop)hide();});
    document.addEventListener('keydown',onKeydown,true);
    lastAt=Date.now();history.push(key);history=history.slice(-10);
    if (source==='cart') lastCartAt=lastAt;
    save();x.focus({preventScroll:true});
    if (!reduceMotion) {var result=video.play();if(result && result.catch)result.catch(function(){});}
    return true;
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    var due=lastAt ? lastAt+INTERVAL_MS : firstAt+FIRST_MS;
    timer=setTimeout(autoTick,Math.max(250,due-Date.now()));
  }
  function autoTick() {
    if (modal || document.visibilityState==='hidden' || isBlocked()) {
      timer=setTimeout(autoTick,7000);return;
    }
    present(chooseAutomatic(),'automatic');schedule();
  }
  function cartOpened() {
    if (modal || document.visibilityState==='hidden' || isBlocked(true)) return;
    if (Date.now()-lastAt<CART_GAP_MS || Date.now()-lastCartAt<INTERVAL_MS) return;
    refreshAuth().then(function(){
      if (!modal && document.visibilityState!=='hidden' && !isBlocked(true) && present(chooseCart(),'cart')) schedule();
    });
  }
  function init() {
    document.addEventListener('click',function(e){
      var t=e.target;
      if (!t || !t.closest) return;
      var cart=t.closest('#cartBtn, .cartbtn, [data-site-cart-open], [data-cart-open], [data-open-cart], [data-cart-toggle], [aria-label="פתיחת סל הקניות"]');
      if(cart) setTimeout(cartOpened,250);
    },true);
    refreshAuth();schedule();
    document.addEventListener('visibilitychange',function(){
      if (document.visibilityState==='hidden' && player) player.pause();
      else if (document.visibilityState==='visible' && player && !reduceMotion){
        var result=player.play();if(result && result.catch)result.catch(function(){});
      }
    });
    window.addEventListener('pagehide',hide);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
