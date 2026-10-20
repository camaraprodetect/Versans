(function(){
  'use strict';
  var launch=document.getElementById('adminAIOpen');
  if(!launch)return;
  var open=false,busy=false,history=[],pendingToken=null,backdrop=null,panel=null,messages=null,textarea=null,submit=null,proposalArea=null;
  var errors={ai_not_configured:'חסר OPENAI_API_KEY בשרת.',ai_timeout:'זמן ההמתנה למודל הסתיים. נסה שוב.',ai_rate_limited:'שירות ה-AI עמוס. נסה שוב בעוד רגע.',ai_provider_error:'תקלה בחיבור ל-AI. נסה שוב.',ai_invalid_response:'התשובה מהמודל אינה תקינה.',
    ambiguous_product_use_id:'נמצאו כמה מוצרים בעלי שם דומה. ציין מזהה מוצר מדויק (product-N).',product_not_found:'המוצר לא נמצא. צריך לציין מזהה מוצר מדויק.',task_not_found:'המשימה לא נמצאה.',owner_only:'רק בעל החשבון הראשי יכול לשנות הרשאות אדמין.',data_changed_retry_preview:'הנתונים השתנו מאז יצירת ההצעה. בקש הצעה חדשה לפני אישור.',confirmation_expired:'האישור פג או כבר נוצל. בקש הצעה חדשה.',unsupported_action:'פעולה זו עדיין לא נתמכת דרך הבוט.',unsupported_product_field:'עריכת השדה הזה עדיין לא נתמכת דרך הבוט.',permission_denied:'אין לך הרשאה לבצע פעולה זו.',admin_required:'נדרשת התחברות כאדמין.'};
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
  function button(label,cls,handler){var n=el('button',cls,label);n.type='button';n.addEventListener('click',handler);return n;}
  function fmt(v){if(v===null)return 'ללא ערך';if(v===undefined)return '—';if(typeof v==='object'){try{return JSON.stringify(v,null,2);}catch(e){return '[נתונים מורכבים]';}}return String(v);}
  async function request(url,data){var response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)});
    var result={};try{result=await response.json();}catch(e){}if(!response.ok||!result.ok){var err=new Error(errors[result.error]||result.error||('HTTP '+response.status));err.code=result.error;throw err;}return result;
  }
  function append(who,text){var wrap=el('div','vs-admin-ai-message '+who),body=el('div','vs-admin-ai-bubble',text);wrap.appendChild(body);messages.appendChild(wrap);messages.scrollTop=messages.scrollHeight;return wrap;}
  function proposalCard(proposal){
    pendingToken=proposal.token;proposalArea.replaceChildren();
    var card=el('section','vs-admin-ai-proposal'),head=el('div','vs-admin-ai-proposal-title',proposal.irreversible?'פעולה משמעותית — אישור נדרש':'הצעת שינוי — עדיין לא בוצעה');
    card.append(head,el('p','vs-admin-ai-summary',proposal.summary));
    if(proposal.changes&&Object.keys(proposal.changes).length){
      var list=el('div','vs-admin-ai-change-list');Object.keys(proposal.changes).forEach(function(k){
        var row=el('div','vs-admin-ai-change'),b=proposal.changes[k];row.append(el('strong','',k),el('span','',fmt(b.before)),el('span','vs-admin-ai-arrow','←'),el('span','',fmt(b.after)));list.appendChild(row);
      });card.appendChild(list);
    } else if(proposal.before!==undefined||proposal.after!==undefined){
      var details=el('details','vs-admin-ai-details');details.appendChild(el('summary','','הצג נתונים לפני ואחרי'));
      var pre=el('pre','',JSON.stringify({before:proposal.before,after:proposal.after},null,2));details.appendChild(pre);card.appendChild(details);
    }
    var foot=el('div','vs-admin-ai-proposal-actions');var confirm=button('אשר פעולה','vs-admin-ai-confirm',async function(){
      if(!pendingToken||busy)return;var token=pendingToken;pendingToken=null;setBusy(true);confirm.textContent='מבצע…';
      try {var done=await request('/api/admin/ai/confirm',{token:token});proposalArea.replaceChildren();append('assistant',done.answer||'הפעולה בוצעה.');}
      catch(e){proposalArea.replaceChildren();append('error','הפעולה לא בוצעה: '+e.message);}
      finally{setBusy(false);}
    });var cancel=button('ביטול','vs-admin-ai-cancel',function(){pendingToken=null;proposalArea.replaceChildren();append('assistant','ההצעה בוטלה. לא בוצע שינוי.');});
    foot.append(cancel,confirm);card.appendChild(foot);proposalArea.appendChild(card);messages.scrollTop=messages.scrollHeight;
  }
  function setBusy(v){busy=v;if(textarea)textarea.disabled=v;if(submit){submit.disabled=v;submit.textContent=v?'בודק נתונים…':'שלח';}}
  async function send(){var text=textarea.value.trim();if(!text||busy)return;if(pendingToken){append('error','יש לאשר או לבטל את הצעת השינוי הקודמת לפני בקשה חדשה.');return;}
    textarea.value='';append('user',text);var context=history.slice(-6);setBusy(true);var loading=append('assistant','מחפש בנתוני האדמין…');
    try {var result=await request('/api/admin/ai/chat',{message:text,history:context});loading.remove();append('assistant',result.answer||'אין תשובה זמינה.');
      history.push({role:'user',text:text},{role:'assistant',text:result.answer||''});history=history.slice(-12);
      if(result.proposal)proposalCard(result.proposal);
      if(result.partial)append('assistant','שים לב: אלו נתונים חלקיים מהתוצאות שהוחזרו.');
    }catch(e){loading.remove();append('error','לא הצלחתי להשלים את הבקשה: '+e.message);}
    finally{setBusy(false);if(open)textarea.focus();}
  }
  function close(){if(!open)return;open=false;document.removeEventListener('keydown',onKey);document.body.classList.remove('vs-admin-ai-open');if(backdrop)backdrop.remove();backdrop=null;launch.focus();}
  function onKey(e){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'&&panel){var controls=Array.from(panel.querySelectorAll('button:not([disabled]),textarea:not([disabled])'));var active=document.activeElement;if(!controls.length)return;if(e.shiftKey&&active===controls[0]){e.preventDefault();controls[controls.length-1].focus();}else if(!e.shiftKey&&active===controls[controls.length-1]){e.preventDefault();controls[0].focus();}}}
  function show(){if(open)return;open=true;document.body.classList.add('vs-admin-ai-open');var previousFocus=document.activeElement;
    backdrop=el('div','vs-admin-ai-backdrop');panel=el('section','vs-admin-ai-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','VerSans AI לאדמין');
    var header=el('header','vs-admin-ai-head'),heading=el('div');heading.append(el('strong','','✦ VerSans AI'),el('small','','עוזר לניהול החנות — כל פעולה דורשת אישור'));header.append(heading,button('×','vs-admin-ai-close',close));
    messages=el('div','vs-admin-ai-messages');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');
    proposalArea=el('div','vs-admin-ai-proposal-holder');
    var footer=el('div','vs-admin-ai-footer');textarea=el('textarea','vs-admin-ai-input');textarea.placeholder='שאל על מוצר, הזמנה, נתונים — או בקש להכין שינוי…';textarea.rows=3;textarea.maxLength=1800;
    textarea.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    submit=button('שלח','vs-admin-ai-send',send);
    var row=el('div','vs-admin-ai-compose');row.append(textarea,submit);
    footer.append(row,el('p','vs-admin-ai-disclaimer','הבוט קורא נתוני אדמין לצורך מענה. פעולות אינן מתבצעות ללא אישור מפורש. אל תזין סיסמאות או מפתחות API.'));
    panel.append(header,messages,proposalArea,footer);backdrop.appendChild(panel);document.body.appendChild(backdrop);
    backdrop.addEventListener('click',function(e){if(e.target===backdrop)close();});document.addEventListener('keydown',onKey);
    if(!history.length)append('assistant','שלום! אפשר לשאול אותי על נתוני החנות, לחפש הזמנות ומוצרים או לבקש שאכין שינוי. לפני כל שינוי אציג לך מה בדיוק עומד להשתנות ואבקש אישור.');
    else history.slice(-8).forEach(function(item){append(item.role==='user'?'user':'assistant',item.text);});
    if(pendingToken)append('assistant','הצעת שינוי קודמת נסגרה. בקש הצעה חדשה אם תרצה לבצע פעולה.');pendingToken=null;
    textarea.focus();
  }
  launch.addEventListener('click',show);
})();
