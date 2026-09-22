(function(){
  'use strict';

  var CLOSED_KEY = 'versans_support_closed_at';
  var RETURN_AFTER_MS = 10 * 60 * 1000;
  var DEFAULT_WHATSAPP = '972546296037';

  function config(){
    return (window.STORE_CONFIG && window.STORE_CONFIG.contact) || {};
  }

  function cleanWhatsapp(value){
    var digits = String(value || '').replace(/\D/g, '');
    if (!digits) return DEFAULT_WHATSAPP;
    if (digits.indexOf('972') === 0) return digits;
    if (digits.charAt(0) === '0') return '972' + digits.slice(1);
    return digits;
  }

  function whatsappNumber(){
    return cleanWhatsapp(config().whatsapp || DEFAULT_WHATSAPP);
  }

  function whatsappUrl(){
    return 'https://wa.me/' + whatsappNumber();
  }

  function whatsappIcon(cls){
    return '<span class="' + cls + '" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32" role="img"><path d="M16.01 3.2A12.73 12.73 0 0 0 5.12 22.5L3.2 28.8l6.47-1.85a12.78 12.78 0 1 0 6.34-23.75Zm0 23.25a10.48 10.48 0 0 1-5.34-1.46l-.38-.23-3.84 1.1 1.03-3.74-.25-.39a10.52 10.52 0 1 1 8.78 4.72Zm5.77-7.87c-.32-.16-1.87-.92-2.16-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.18.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.58-.94-.84-1.58-1.88-1.76-2.19-.18-.32-.02-.49.14-.65.14-.14.32-.37.47-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.71-1.72-.97-2.35-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.55.08-.84.4-.29.32-1.11 1.08-1.11 2.64s1.14 3.07 1.29 3.28c.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.87-.76 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.13-.29-.21-.61-.37Z"/></svg>' +
    '</span>';
  }

  function supportLink(className, iconClass){
    return '<a class="' + className + '" href="' + whatsappUrl() + '" target="_blank" rel="noopener noreferrer" aria-label="שירות לקוחות ב-WhatsApp">' +
      whatsappIcon(iconClass) + '<span>שירות לקוחות</span></a>';
  }

  function injectMobileMenu(){
    document.querySelectorAll('#navmenu').forEach(function(menu){
      if (menu.querySelector('.nav__support-link')) return;
      var wrap = document.createElement('div');
      wrap.innerHTML = supportLink('nav__support-link', 'versans-support-icon');
      var link = wrap.firstElementChild;
      var close = menu.querySelector('[data-nav-close]');
      if (close && close.nextSibling) menu.insertBefore(link, close.nextSibling);
      else menu.insertBefore(link, menu.firstChild);
    });
  }

  function injectFooterLink(){
    var lists = document.querySelectorAll('#footContact, #productFootContact');
    if (lists.length) {
      lists.forEach(function(list){
        if (list.querySelector('.versans-support-footer-link')) return;
        var li = document.createElement('li');
        li.className = 'versans-support-footer-item';
        li.innerHTML = supportLink('versans-support-footer-link', 'versans-support-footer-link__icon');
        list.appendChild(li);
      });
      return;
    }

    document.querySelectorAll('footer.foot').forEach(function(footer){
      if (footer.querySelector('.versans-support-footer-standalone')) return;
      var host = footer.querySelector('.container') || footer;
      var block = document.createElement('div');
      block.className = 'versans-support-footer-standalone';
      block.innerHTML = supportLink('versans-support-footer-link', 'versans-support-footer-link__icon');
      host.insertBefore(block, host.firstChild);
    });
  }

  function createFloatingBubble(){
    if (document.getElementById('versansSupportFloat')) return document.getElementById('versansSupportFloat');
    var bubble = document.createElement('aside');
    bubble.id = 'versansSupportFloat';
    bubble.className = 'versans-support-float';
    bubble.setAttribute('aria-label', 'שירות לקוחות');
    bubble.innerHTML = supportLink('versans-support-float__link', 'versans-support-float__icon') +
      '<button class="versans-support-float__close" type="button" aria-label="סגירת בועת שירות הלקוחות">×</button>';
    document.body.appendChild(bubble);

    var closeButton = bubble.querySelector('.versans-support-float__close');
    closeButton.addEventListener('click', function(){
      bubble.hidden = true;
      try { sessionStorage.setItem(CLOSED_KEY, String(Date.now())); } catch (err) {}
      window.setTimeout(function(){
        bubble.hidden = false;
        try { sessionStorage.removeItem(CLOSED_KEY); } catch (err) {}
      }, RETURN_AFTER_MS);
    });
    return bubble;
  }

  function applyBubbleVisibility(){
    var bubble = createFloatingBubble();
    var closedAt = 0;
    try { closedAt = Number(sessionStorage.getItem(CLOSED_KEY) || 0); } catch (err) {}
    var remaining = closedAt ? RETURN_AFTER_MS - (Date.now() - closedAt) : 0;
    if (remaining > 0) {
      bubble.hidden = true;
      window.setTimeout(function(){
        bubble.hidden = false;
        try { sessionStorage.removeItem(CLOSED_KEY); } catch (err) {}
      }, remaining);
    } else {
      bubble.hidden = false;
      try { sessionStorage.removeItem(CLOSED_KEY); } catch (err) {}
    }
  }

  function updateExistingLinks(){
    document.querySelectorAll('.versans-support-float__link,.versans-support-footer-link,.nav__support-link').forEach(function(link){
      link.href = whatsappUrl();
    });
  }

  function init(){
    injectMobileMenu();
    injectFooterLink();
    applyBubbleVisibility();
    updateExistingLinks();

    /* Footer contact rows can be rendered after this script by page-specific JS. */
    var footerObserver = new MutationObserver(function(){ injectFooterLink(); updateExistingLinks(); });
    document.querySelectorAll('#footContact,#productFootContact').forEach(function(list){
      footerObserver.observe(list, { childList:true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
