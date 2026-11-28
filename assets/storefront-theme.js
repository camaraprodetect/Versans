(function(){
  'use strict';
  var key='versans-storefront-theme',root=document.documentElement,theme='light';
  try{if(localStorage.getItem(key)==='dark')theme='dark';}catch(_){}
  root.setAttribute('data-versans-theme',theme);
  var sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
  var moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 14.3A8.9 8.9 0 0 1 9.7 3.2 9 9 0 1 0 20.8 14.3Z"/></svg>';
  function sync(){root.setAttribute('data-versans-theme',theme);document.querySelectorAll('[data-versans-theme-toggle]').forEach(function(b){b.setAttribute('aria-checked',String(theme==='dark'));b.title=theme==='dark'?'מעבר למצב בהיר':'מעבר למצב כהה';});document.querySelectorAll('[data-versans-theme-status]').forEach(function(e){e.textContent=theme==='dark'?'מצב כהה':'מצב בהיר';});}
  function setTheme(value,persist){theme=value==='dark'?'dark':'light';if(persist){try{localStorage.setItem(key,theme);}catch(_){}}sync();}
  function toggle(){var b=document.createElement('button');b.type='button';b.className='vs-theme-toggle';b.setAttribute('data-versans-theme-toggle','');b.setAttribute('role','switch');b.setAttribute('aria-label','מצב כהה');b.innerHTML='<span class="vs-theme-toggle__thumb" aria-hidden="true"></span><span class="vs-theme-toggle__sun">'+sun+'</span><span class="vs-theme-toggle__moon">'+moon+'</span>';b.addEventListener('click',function(){setTheme(theme==='dark'?'light':'dark',true);});return b;}
  function addDesktop(host,extra){if(!host||host.querySelector('[data-versans-theme-toggle]'))return;var w=document.createElement('div');w.className='vs-theme-desktop '+(extra||'');w.appendChild(toggle());host.insertBefore(w,host.firstChild);}
  function addMobile(host,extra){if(!host||host.querySelector('[data-versans-theme-toggle]'))return;var row=document.createElement('div'),label=document.createElement('div');row.className='vs-theme-mobile '+(extra||'');label.className='vs-theme-mobile__copy';label.innerHTML='<span class="vs-theme-mobile__title">תצוגת האתר</span><span class="vs-theme-mobile__status" data-versans-theme-status></span>';row.appendChild(label);row.appendChild(toggle());var close=host.querySelector('.nav__close,.hot-menu__close');host.insertBefore(row,close&&close.parentNode===host?close.nextSibling:host.firstChild);}
  function mount(){var nav=document.querySelector('.nav'),menu=document.querySelector('#navmenu');if(nav&&menu){addDesktop(nav.querySelector('.nav__actions'));addMobile(menu);}else if(document.querySelector('.hot-header')){addDesktop(document.querySelector('.hot-header__inner'),'vs-theme-desktop--hot');addMobile(document.querySelector('#hotMobileMenu'),'vs-theme-mobile--hot');}sync();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  window.addEventListener('storage',function(e){if(e.key===key||e.key===null)setTheme(e.newValue,false);});
  window.addEventListener('pageshow',function(){try{setTheme(localStorage.getItem(key),false);}catch(_){sync();}});
})();
