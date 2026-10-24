/* Owner/staff reauthentication for critical admin mutations. Nothing is stored client-side. */
(function(){
  'use strict';
  var nativeFetch=window.fetch.bind(window),dialogPending=null;
  function askPassword(){
    if(dialogPending)return dialogPending;
    dialogPending=new Promise(function(resolve){
      var cover=document.createElement('div');cover.className='vs-reauth-overlay';
      var box=document.createElement('form');box.className='vs-reauth-modal';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
      var title=document.createElement('h2');title.textContent='אימות נוסף לפעולה רגישה';
      var help=document.createElement('p');help.textContent='כדי לשנות הרשאות או לבצע פעולה כספית, הזן מחדש את סיסמת החשבון שלך. האימות תקף ל־5 דקות.';
      var pwd=document.createElement('input');pwd.type='password';pwd.autocomplete='current-password';pwd.required=true;pwd.setAttribute('aria-label','סיסמת החשבון');
      var err=document.createElement('p');err.className='vs-reauth-error';
      var row=document.createElement('div');row.className='vs-reauth-actions';
      var cancel=document.createElement('button');cancel.type='button';cancel.textContent='ביטול';
      var ok=document.createElement('button');ok.type='submit';ok.textContent='אמת והמשך';
      function done(value){cover.remove();pwd.value='';dialogPending=null;resolve(value);}
      cancel.onclick=function(){done(false);};
      box.onsubmit=async function(e){e.preventDefault();ok.disabled=true;err.textContent='';try{
        var response=await nativeFetch('/api/admin/employees/reauth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({password:pwd.value})});
        if(!response.ok)throw Error(response.status===429?'נרשמו ניסיונות אימות רבים מדי. נסה שוב בעוד 10 דקות.':'סיסמה שגויה או שההתחברות פגה.');
        done(true);
      }catch(error){err.textContent=error.message;pwd.value='';pwd.focus();ok.disabled=false;}};
      box.append(title,help,pwd,err);row.append(cancel,ok);box.append(row);cover.append(box);document.body.append(cover);pwd.focus();
      cover.addEventListener('keydown',function(e){if(e.key==='Escape')done(false);});
    });return dialogPending;
  }
  window.fetch=async function(input,init){
    var request;
    try{request=new Request(input,init);}catch(_){return nativeFetch(input,init);}
    var url=new URL(request.url,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/admin/'))return nativeFetch(request);
    var response=await nativeFetch(request.clone());
    if(response.status!==428||['GET','HEAD'].includes(request.method)||url.pathname==='/api/admin/employees/reauth')return response;
    var payload=await response.clone().json().catch(function(){return {};});
    if(payload.error!=='reauth_required')return response;
    if(!await askPassword())return response;
    return nativeFetch(request.clone());
  };
})();
