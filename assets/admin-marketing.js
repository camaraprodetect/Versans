(function(){
  'use strict';
  var TABS=[['coupons','קופונים'],['bundles','מבצעי כמות'],['popups','פופ־אפים'],['banners','באנרים ו-Hero'],['campaigns','קמפיינים']];
  var current='coupons',editing=null,store=null;
  function el(tag,cls,text){var a=document.createElement(tag);if(cls)a.className=cls;if(text!=null)a.textContent=text;return a;}
  function money(n){return (Number(n)||0).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₪';}
  function datetime(ms){return ms?new Date(ms).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}):'ללא הגבלה';}
  function dt(ms){if(!ms)return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms)).replace(' ','T');}
  function israelMillis(value){
    if(!value)return null;
    var wall=new Date(value+':00Z').getTime(),guess=wall;
    var fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
    for(var i=0;i<3;i++){
      var parts={};fmt.formatToParts(new Date(guess)).forEach(function(p){if(p.type!=='literal')parts[p.type]=p.value;});
      var actual=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour)%24,Number(parts.minute));
      guess+=wall-actual;
    }
    return guess;
  }
  var SCHEMAS={
    coupons:[['code','קוד קופון','text'],['type','סוג הנחה','select',[['percent','הנחה באחוזים'],['fixed','הנחה בשקלים']]],['value','אחוז / סכום הנחה','number'],['maxUses','מקסימום מימושים (0 = ללא הגבלה)','number'],['allowedEmails','מיילים מורשים, מופרדים בפסיק (ריק = כולם)','textarea'],['startsAt','תחילת תוקף','datetime-local'],['endsAt','סיום תוקף','datetime-local'],['active','פעיל','checkbox']],
    bundles:[['name','שם המבצע','text'],['kind','סוג מבצע','select',[['fixed','מחיר קבוע לכמות'],['buy2get1','קנה 2 קבל 1']]],['category','קטגוריה','select',[['jewelry','תכשיטים'],['glasses','משקפיים'],['hats','כובעים']]],['quantity','מספר פריטים','number'],['price','מחיר לכל הכמות (₪)','number'],['startsAt','תחילת מבצע','datetime-local'],['endsAt','סיום מבצע','datetime-local'],['active','פעיל','checkbox']],
    popups:[['title','כותרת','text'],['text','טקסט משני','textarea'],['mediaType','סוג מדיה','select',[['image','תמונה'],['video','סרטון']]],['mediaUrl','קישור לתמונה / סרטון','url'],['upload','או העלאת תמונה/סרטון מהמחשב','file'],['url','קישור הכפתור','text'],['buttonText','טקסט כפתור','text'],['page','באילו עמודים','select',[['all','כל העמודים'],['home','עמוד הבית בלבד'],['product','עמודי מוצר בלבד']]],['minCartItems','מינימום פריטים בסל (0 = ללא דרישה)','number'],['trigger','מתי להציג','select',[['delay','אחרי השהיה'],['scroll','בגלילה'],['exit','כוונת יציאה (מחשב)']]],['delaySeconds','השהיה בשניות','number'],['display','מכשירים','select',[['all','כולם'],['mobile','מובייל'],['desktop','מחשב']]],['showOnce','הצגה אחת לכל גולש בסשן','checkbox'],['startsAt','תחילת פרסום','datetime-local'],['endsAt','סיום פרסום','datetime-local'],['active','פעיל','checkbox']],
    banners:[['title','כותרת','text'],['text','טקסט משני','textarea'],['location','מיקום','select',[['home','באנר בעמוד הבית'],['hero','החלפת Hero ראשי']]],['mediaType','סוג מדיה','select',[['image','תמונה'],['video','סרטון']]],['mediaUrl','קישור לתמונה / סרטון','url'],['upload','או העלאת תמונה/סרטון מהמחשב','file'],['url','קישור הכפתור','text'],['buttonText','טקסט כפתור','text'],['display','מכשירים','select',[['all','כולם'],['mobile','מובייל'],['desktop','מחשב']]],['startsAt','תחילת הצגה','datetime-local'],['endsAt','סיום הצגה','datetime-local'],['active','פעיל','checkbox']],
    campaigns:[['name','שם קמפיין','text'],['source','מקור תנועה (Google, TikTok וכו׳)','text'],['utmCampaign','ערך UTM campaign לשיוך רכישות','text'],['budget','תקציב (₪)','number'],['spent','הוצאה בפועל עד כה (₪)','number'],['goal','יעד הכנסות (₪)','number'],['startsAt','תאריך תחילה','datetime-local'],['endsAt','תאריך סיום','datetime-local'],['active','פעיל','checkbox']]
  };
  function createInput(key,label,type,choices,obj){
    var wrap=el('label','vs-mkt-field'),txt=el('span','',label);wrap.append(txt);
    var input=el(type==='textarea'?'textarea':type==='select'?'select':'input');input.name=key;
    if(type==='select')(choices||[]).forEach(function(pair){var opt=el('option','',pair[1]);opt.value=pair[0];input.appendChild(opt);});
    else if(type==='file'){input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm';}
    else if(type==='checkbox'){input.type='checkbox';input.checked=obj?obj[key]!==false:true;}
    else if(type==='textarea'){input.rows=2;input.value=obj?((Array.isArray(obj[key])?obj[key].join(', '):obj[key])||''):'';}
    else {input.type=type==='url'?'text':type;if(type==='number'){input.step='any';input.min='0';}input.value=obj?(type==='datetime-local'?dt(obj[key]):obj[key]==null?'':obj[key]):'';}
    if(type!=='file'&&type!=='checkbox'&&type!=='textarea'&&type!=='select'&&obj&&obj[key]!=null&&type!=='datetime-local')input.value=obj[key];
    if(type==='select'&&obj&&obj[key]!=null)input.value=obj[key];
    if(key==='code')input.autocapitalize='characters';
    wrap.appendChild(input);return wrap;
  }
  function info(item,section){
    if(section==='coupons')return (item.type==='fixed'?money(item.value):item.value+'%')+' · שימושים '+(item.used||0)+(item.maxUses?'/'+item.maxUses:'')+(item.allowedEmails&&item.allowedEmails.length?' · מוגבל ללקוחות':'');
    if(section==='bundles')return (item.kind==='buy2get1'?'2+1':item.quantity+' יחידות ב-'+money(item.price))+' · '+({hats:'כובעים',glasses:'משקפיים',jewelry:'תכשיטים'}[item.category]||item.category);
    if(section==='popups')return (item.mediaType==='video'?'סרטון':'תמונה')+' · '+({delay:'אחרי השהיה',scroll:'בגלילה',exit:'כוונת יציאה'}[item.trigger]||'');
    if(section==='banners')return (item.location==='hero'?'Hero ראשי':'באנר עמוד הבית')+' · '+(item.mediaType==='video'?'סרטון':'תמונה');
    return 'תקציב '+money(item.budget)+' · הוצאה '+money(item.spent)+' · יעד '+money(item.goal);
  }
  function nameOf(item,section){return section==='coupons'?item.code:item.name||item.title||'פרסום חדש';}
  function row(item,section,canEdit,rerender){
    var card=el('article','vs-mkt-row'),main=el('div','vs-mkt-row__main');
    var top=el('div','vs-mkt-row__top'),head=el('strong','',nameOf(item,section));
    var badge=el('span','vs-mkt-pill '+(item.active?'is-on':''),item.active?'פעיל':'מושהה');
    top.append(head,badge);main.append(top,el('small','',info(item,section)));
    main.appendChild(el('small','', 'מ־'+datetime(item.startsAt)+' · עד '+datetime(item.endsAt)));
    if(section==='campaigns'){
      var attribution=store.attribution[item.utmCampaign]||{orders:0,revenue:0};
      main.appendChild(el('small','vs-mkt-attrib','הכנסות משויכות: '+money(attribution.revenue)+' · '+attribution.orders+' הזמנות · עמידה ביעד: '+(item.goal?Math.round(attribution.revenue/item.goal*100):0)+'%'));
    }
    var actions=el('div','vs-mkt-actions');
    if(canEdit){
      var editBtn=el('button','vs-mkt-btn','עריכה');editBtn.type='button';editBtn.onclick=function(){editing=item;rerender();};
      var toggle=el('button','vs-mkt-btn',item.active?'השהה':'הפעל');toggle.type='button';toggle.onclick=function(){saveAction(section,'update',Object.assign({},item,{active:!item.active}));};
      actions.append(editBtn,toggle);
      if(!item.system){var del=el('button','vs-mkt-btn vs-mkt-danger','מחיקה');del.type='button';del.onclick=function(){if(confirm('למחוק את '+nameOf(item,section)+'?'))saveAction(section,'delete',{id:item.id});};actions.appendChild(del);}
    }
    card.append(main,actions);return card;
  }
  var host=null,editable=false;
  async function saveAction(section,action,item){
    try{
      var r=await fetch('/api/admin/marketing',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({section:section,action:action,item:item})});
      var body=await r.json();if(!r.ok)throw Error(body.error||'save_failed');editing=null;
      await refresh();
    }catch(e){alert('השמירה נכשלה: '+e.message);}
  }
  async function refresh(){var r=await fetch('/api/admin/marketing',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('loading_failed');store=await r.json();paint();}
  function paint(){
    if(!host)return;
    var page=el('div','vs-mkt-page'),tabs=el('nav','vs-mkt-tabs');tabs.setAttribute('aria-label','ניהול שיווק');
    TABS.forEach(function(t){var button=el('button','vs-mkt-tab'+(current===t[0]?' is-active':''),t[1]);button.type='button';button.onclick=function(){current=t[0];editing=null;paint();};tabs.appendChild(button);});
    var box=el('section','vs-mkt-panel'),bar=el('div','vs-mkt-panel__head'),labels=el('div');
    labels.append(el('h2','',TABS.find(x=>x[0]===current)[1]),el('p','',String((store[current]||[]).length)+' רשומות · מתעדכן אוטומטית לפי תאריכי התחלה וסיום'));
    bar.appendChild(labels);
    if(editable){var create=el('button','vs-mkt-primary','+ הוסף חדש');create.type='button';create.onclick=function(){editing={active:true};paint();};bar.appendChild(create);}
    box.appendChild(bar);
    if(editable&&editing){
      var form=el('form','vs-mkt-form'),title=el('h3','',editing.id?'עריכת רשומה':'יצירת רשומה');form.appendChild(title);
      var grid=el('div','vs-mkt-fields');
      SCHEMAS[current].forEach(function(f){grid.appendChild(createInput(f[0],f[1],f[2],f[3],editing));});form.appendChild(grid);
      var foot=el('div','vs-mkt-form__foot'),save=el('button','vs-mkt-primary','שמור');save.type='submit';
      var cancel=el('button','vs-mkt-btn','ביטול');cancel.type='button';cancel.onclick=function(){editing=null;paint();};foot.append(save,cancel);form.appendChild(foot);
      form.onsubmit=async function(event){
        event.preventDefault();var data={id:editing.id};
        SCHEMAS[current].forEach(function(f){var v=form.elements[f[0]],type=f[2];if(type==='file')return;data[f[0]]=type==='checkbox'?v.checked:type==='datetime-local'?israelMillis(v.value):type==='number'?(v.value===''?'':Number(v.value)):v.value;});
        save.disabled=true;save.textContent='שומר…';
        try{
          var input=form.elements.upload;
          if(input&&input.files&&input.files[0]){
            var file=input.files[0];if(file.size>20*1024*1024)throw Error('הקובץ גדול מ־20MB');
            var base64=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result).split(',')[1]);};reader.onerror=reject;reader.readAsDataURL(file);});
            var response=await fetch('/api/admin/marketing/media',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime:file.type,base64:base64})});
            var mediaResult=await response.json();if(!response.ok)throw Error(mediaResult.error||'upload_failed');
            data.mediaUrl=mediaResult.url;data.mediaType=file.type.startsWith('video/')?'video':'image';
          }
          await saveAction(current,editing.id?'update':'create',data);
        }catch(e){alert('ההעלאה נכשלה: '+e.message);}
        finally{save.disabled=false;save.textContent='שמור';}
      };
      box.appendChild(form);
    }
    var items=store[current]||[];
    if(!items.length)box.appendChild(el('div','vs-mkt-empty','אין רשומות עדיין. אפשר להוסיף רשומה חדשה.'));
    else {var list=el('div','vs-mkt-list');items.forEach(function(item){list.appendChild(row(item,current,editable,paint));});box.appendChild(list);}
    if(current==='coupons')box.appendChild(el('p','vs-mkt-note','קופון של לקוחות מסוימים מחייב התחברות לחשבון המשויך למייל. שימוש נספר עם אישור התשלום.'));
    if(current==='campaigns')box.appendChild(el('p','vs-mkt-note','הכנסות משויכות ל-UTM Campaign של מבקר מזוהה, על בסיס הזמנות ששולמו ב-365 הימים האחרונים. ללא שיוך אמין ההכנסה לא תיחשב לקמפיין. הוצאות בפועל מוזנות ידנית.'));
    if(current==='popups'||current==='banners')box.appendChild(el('p','vs-mkt-note','הזינו כתובת HTTPS או נתיב קובץ קיים באתר (למשל /assets/promo-videos/video.mp4). יש להעלות את הקובץ מראש לאחסון ציבורי.'));
    page.append(tabs,box);host.replaceChildren(page);
  }
  async function render(content,canEdit){host=content;editable=!!canEdit;host.replaceChildren(el('div','vs-mkt-loading','טוען נתוני שיווק…'));await refresh();}
  window.VersansAdminMarketing={render:render};
})();
