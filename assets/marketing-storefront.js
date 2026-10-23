(function(){
 'use strict';
 if (/^\/admin(?:\/|$)/.test(location.pathname))return;
 var activeModal=null, lastFocus=null, lastBannerSignature='', lastRulesSignature='', lastPopupSignature='', popupKey='';
 function el(tag,cls,text){var node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
 function deviceOk(item){return item.display==='all'||!item.display||(item.display==='mobile'?innerWidth<=700:innerWidth>700);}
 function popupEligible(item){
   if(!deviceOk(item))return false;
   var home=location.pathname==='/'||location.pathname==='/index.html';
   if(item.page==='home'&&!home)return false;
   if(item.page==='product'&&!document.querySelector('[data-product-page],.product-page,#productMain')&&!/\/product(?:\.html|\/)/.test(location.pathname))return false;
   if(Number(item.minCartItems)>0){var items=[];try{items=window.VERSANS_CART_STATE&&window.VERSANS_CART_STATE.read?window.VERSANS_CART_STATE.read():JSON.parse(localStorage.getItem('kw_cart')||'[]');}catch(_){}
     var qty=(Array.isArray(items)?items:[]).reduce(function(total,i){return total+(Math.max(1,Number(i.qty||i.quantity)||1));},0);if(qty<Number(item.minCartItems))return false;}
   return true;
 }
 function blockPopup(){return activeModal || /(?:\/checkout|\/payment|\/thank-you|\/login|\/register|\/admin)/.test(location.pathname)||!!document.querySelector('#coOverlay.is-open, [aria-modal="true"]:not(.vs-managed-popup)');}
 function media(item){var element=el(item.mediaType==='video'?'video':'img','vs-managed-media');
   if(item.mediaType==='video'){element.src=item.mediaUrl;element.muted=true;element.loop=true;element.autoplay=true;element.playsInline=true;element.controls=true;element.preload='metadata';}
   else{element.src=item.mediaUrl;element.alt=item.title||'קידום VerSans';element.loading='lazy';element.decoding='async';}
   return element;}
 function body(item){var content=el('div','vs-managed-copy');if(item.title)content.appendChild(el('h2','',item.title));if(item.text)content.appendChild(el('p','',item.text));
   if(item.buttonText){var a=el('a','vs-managed-cta',item.buttonText);a.href=item.url||'/#shopTitle';content.appendChild(a);}return content;}
 function renderBanners(banners){
   document.querySelectorAll('.vs-managed-banner,.vs-managed-hero').forEach(function(node){node.remove();});
   var oldHero=document.querySelector('.hero.hero--full [data-hero-slider]');if(oldHero)oldHero.hidden=false;
   var oldMobile=document.querySelector('.mobile-entry-banner');if(oldMobile)oldMobile.hidden=false;
   var candidates=banners.filter(deviceOk),heroItem=candidates.filter(x=>x.location==='hero').sort((a,b)=>b.updatedAt-a.updatedAt)[0];
   if(heroItem){
     var hero=document.querySelector('.home-page .hero.hero--full')||document.querySelector('.hero.hero--full');
     if(hero){var existing=hero.querySelector('[data-hero-slider]');if(existing)existing.hidden=true;
       var surface=el('div','vs-managed-hero');surface.append(media(heroItem),body(heroItem));hero.appendChild(surface);
       var mobile=document.querySelector('.mobile-entry-banner');if(mobile)mobile.hidden=true;
     }
   }
   var home=document.querySelector('.home-page .section.shop')||document.querySelector('.section.shop');
   if(!home)return;
   candidates.filter(x=>x.location!=='hero').slice(0,6).forEach(function(item){var banner=el('aside','vs-managed-banner'),link=el('a','vs-managed-banner__link');link.href=item.url||'/#shopTitle';
     link.appendChild(media(item));if(item.mediaType==='video')link.querySelector('video').controls=false;
     var description=el('div','vs-managed-banner__text');if(item.title)description.appendChild(el('strong','',item.title));if(item.text)description.appendChild(el('span','',item.text));link.appendChild(description);banner.appendChild(link);home.parentNode.insertBefore(banner,home);
   });
 }
 function popup(item){
   if(blockPopup()||!popupEligible(item)||document.visibilityState==='hidden')return;
   var key='vs-managed-popup-seen-'+item.id;
   try{if(item.showOnce && sessionStorage.getItem(key))return;}catch(_){}
   var backdrop=el('div','vs-managed-backdrop'),dialog=el('section','vs-managed-popup');
   dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',item.title||'מבצע');dialog.setAttribute('dir','rtl');
   lastFocus=document.activeElement;
   var close=el('button','vs-managed-close','×');close.type='button';close.setAttribute('aria-label','סגור');
   function hide(){backdrop.remove();activeModal=null;document.removeEventListener('keydown',keys);if(lastFocus&&lastFocus.focus)lastFocus.focus();}
   function keys(e){if(e.key==='Escape')hide();if(e.key==='Tab'){var nodes=[close].concat(Array.from(dialog.querySelectorAll('a')));if(!nodes.length)return;if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}}}
   close.onclick=hide;backdrop.onclick=function(e){if(e.target===backdrop)hide();};
   dialog.append(close,media(item),body(item));backdrop.appendChild(dialog);document.body.appendChild(backdrop);activeModal=backdrop;
   document.addEventListener('keydown',keys);close.focus({preventScroll:true});
   try{sessionStorage.setItem(key,'1');}catch(_){}
 }
 function renderPopups(popups){var items=popups.filter(popupEligible).sort((a,b)=>b.updatedAt-a.updatedAt);
   window.__versansManagedPopupActive=items.length>0;
   if(!items.length){popupKey='';return;}
   var item=items[0],trigger=item.trigger||'delay';popupKey=item.id;
   if(trigger==='delay')setTimeout(function(){if(popupKey===item.id)popup(item);},Math.max(0,Number(item.delaySeconds)||0)*1000);
   if(trigger==='scroll'){
     var onScroll=function(){if(scrollY>Math.max(200,document.documentElement.scrollHeight*.25)){removeEventListener('scroll',onScroll);if(popupKey===item.id)popup(item);}};
     addEventListener('scroll',onScroll,{passive:true});
   }
   if(trigger==='exit'){var onExit=function(e){if(e.clientY<=5){document.removeEventListener('mouseout',onExit);if(popupKey===item.id)popup(item);}};document.addEventListener('mouseout',onExit);}
 }
 function refresh(){fetch('/api/marketing/public',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw Error('config');return r.json();}).then(function(data){
   var rules=JSON.stringify(data.bundles||[]),banners=JSON.stringify(data.banners||[]),popups=JSON.stringify(data.popups||[]);
   var standardOffers=[['standard-jewelry','buy2get1','jewelry',3,0],['standard-glasses','fixed','glasses',2,249.9],['standard-hats-2','fixed','hats',2,239.9],['standard-hats-3','fixed','hats',3,299.9]];
   window.__versansLegacyPromosDisabled=!standardOffers.every(function(required){return (data.bundles||[]).some(function(offer){return offer.id===required[0]&&offer.kind===required[1]&&offer.category===required[2]&&(offer.kind==='buy2get1'||(Number(offer.quantity)===required[3]&&Math.abs(Number(offer.price)-required[4])<0.001));});});
   if(rules!==lastRulesSignature){lastRulesSignature=rules;
     if(window.VERSANS_PRICING&&window.VERSANS_PRICING.setBundleRules){window.VERSANS_PRICING.setBundleRules(data.bundles||[]);window.dispatchEvent(new Event('versans:cart-changed'));}}
   if(banners!==lastBannerSignature){lastBannerSignature=banners;renderBanners(data.banners||[]);}
   if(popups!==lastPopupSignature){lastPopupSignature=popups;renderPopups(data.popups||[]);}
 }).catch(function(e){console.warn('Marketing settings unavailable; keeping existing offers.',e.message);});}
 function boot(){refresh();setInterval(function(){if(!document.hidden)refresh();},30000);document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
