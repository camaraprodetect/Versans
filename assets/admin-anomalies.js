/* VerSans Admin — advisory anomaly management (2026-10-26). */
(function(){
  'use strict';
  var filters={range:'30d',severity:'all',kind:'all',reviewState:'open',q:'',offset:0};
  var PAGE_SIZE=25,refreshId=0;
  var currency=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'});
  var digits=new Intl.NumberFormat('he-IL');
  var settings=null;
  function el(tag,cls,value){var n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=String(value);return n;}
  function btn(label,cls,callback){var n=el('button','vs-anomaly-button '+(cls||''),label);n.type='button';if(callback)n.onclick=callback;return n;}
  function select(options,value,callback){var n=el('select','vs-anomaly-select');options.forEach(function(x){var o=el('option','',x[1]);o.value=x[0];n.append(o);});n.value=value;n.onchange=function(){callback(n.value);};return n;}
  function field(label,control){var n=el('label','vs-anomaly-field');n.append(el('span','',label),control);return n;}
  function asTime(time){return time?new Date(Number(time)).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}):'—';}
  function money(agorot){return currency.format(Number(agorot||0)/100);}
  function stateName(value){return {open:'ממתינה לבדיקה',reviewed:'נבדקה — טרם סווגה',dismissed:'התראת שווא (ישן)',confirmed:'חריגה אמיתית',false_positive:'התראת שווא'}[value]||value;}
  function errorMessage(error){return ({permission_denied:'אין הרשאה לפעולה זו',admin_only:'רק מנהל יכול לערוך כללים',invalid_anomaly_rules:'יש לבדוק את ערכי הכללים',invalid_anomaly_assignee:'לא ניתן לשייך לעובד שנבחר',invalid_anomaly_review:'הנתונים אינם תקינים',origin_not_allowed:'יש לפתוח את האדמין מהאתר הרשמי'})[error]||'הפעולה נכשלה. נסה שוב.';}
  async function api(url,opts){var response=await fetch(url,Object.assign({credentials:'same-origin',headers:{Accept:'application/json'}},opts||{}));var data=await response.json().catch(function(){return {};});if(!response.ok)throw Error(errorMessage(data.error));return data;}
  function changeFilter(key,value,root){filters[key]=value;filters.offset=0;render(root);}
  function createRules(root,container){
    var details=el('details','vs-anomaly-rules');var title=el('summary','','כללים בהתאמה אישית · ספי זיהוי והגדרות');details.append(title);
    var note=el('p','vs-anomaly-hint','כל הכללים הם התראות לבדיקה, ללא חסימת הזמנות. כללי מחיר יחידה משתמשים במחיר שהיה שמור בהזמנה ולא במחיר הקטלוג הנוכחי.');details.append(note);
    var grid=el('div','vs-anomaly-rules-grid');var values={};var rules=settings.rules;
    function numeric(key,label,suffix,min,max){var input=el('input','vs-anomaly-search');input.type='number';input.min=String(min);input.max=String(max);input.step=suffix==='₪'?'0.01':'1';input.value=String(suffix==='₪'?(Number(rules[key])/100):rules[key]);values[key]=input;var f=field(label+(suffix?' ('+suffix+')':''),input);grid.append(f);}
    function flag(key,label){var n=el('label','vs-anomaly-rule-toggle');var input=el('input');input.type='checkbox';input.checked=Boolean(rules[key]);values[key]=input;n.append(input,el('span','',label));grid.append(n);}
    flag('highOrderEnabled','התראה להזמנה מעל הסף');numeric('highOrderAgorot','סף סכום הזמנה','₪',1,1000000);
    flag('minUnitPriceEnabled','התראה על מחיר יחידה נמוך');numeric('minUnitPriceAgorot','מחיר יחידה מינימלי','₪',0.01,10000);
    flag('maxUnitPriceEnabled','התראה על מחיר יחידה גבוה');numeric('maxUnitPriceAgorot','מחיר יחידה מקסימלי','₪',1,1000000);
    numeric('addressOrders','כמות הזמנות לאותה כתובת','ב־72 שעות',2,10);
    numeric('failedAttempts','מספר ניסיונות כושלים רצופים','ב־30 דקות',2,20);
    details.append(grid);
    var actions=el('div','vs-anomaly-actions'),msg=el('span','vs-anomaly-status');msg.setAttribute('role','status');
    if(settings.canEditRules){actions.append(btn('שמירת הכללים','vs-anomaly-button--primary',async function(){
      var next={};Object.keys(values).forEach(function(key){next[key]=values[key].type==='checkbox'?values[key].checked:(key.endsWith('Agorot')?Math.round(Number(values[key].value)*100):Number(values[key].value));});
      try{msg.textContent='שומר…';await api('/api/admin/order-anomalies/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});msg.textContent='הכללים נשמרו';settings.rules=next;await refreshData(root);}catch(e){msg.textContent=e.message;}
    }));}else msg.textContent='עריכת כללים זמינה למנהל בלבד';
    actions.append(msg);details.append(actions);container.append(details);
  }
  function renderCard(order,root){
    var card=el('article','vs-anomaly-card'),head=el('div','vs-anomaly-card-head'),main=el('div','vs-anomaly-card-main');
    main.append(el('span','vs-anomaly-chip vs-anomaly-risk--'+order.severity,'חומרה '+({high:'גבוהה',medium:'בינונית',low:'נמוכה'}[order.severity]||'')),el('strong','vs-anomaly-order-ref',order.orderRef),el('span','vs-anomaly-chip vs-anomaly-state--'+order.review.state,stateName(order.review.state)));
    head.append(main,el('strong','vs-anomaly-amount',money(order.amountAgorot)));card.append(head);
    var info=el('div','vs-anomaly-info');info.append(el('span','','לקוח: '+order.customerName),el('span','','נוצרה: '+asTime(order.createdAt)),el('span','','סטטוס: '+({paid:'שולם',pending:'ממתין',failed:'נכשל'}[order.status]||order.status)));card.append(info);
    var reasons=el('ul','vs-anomaly-reasons');(order.reasons||[]).forEach(function(reason){reasons.append(el('li','',reason.text));});card.append(reasons);
    var review=order.review||{state:'open'};
    if(review.updatedAt)card.append(el('p','vs-anomaly-review-meta','עודכן: '+asTime(review.updatedAt)+' · '+review.updatedBy+(review.note?' · '+review.note:'')));
    var actions=el('div','vs-anomaly-actions');var link=el('a','vs-anomaly-button vs-anomaly-button--link','פתח הזמנה');link.href='/admin/order-work?order='+encodeURIComponent(order.orderRef);actions.append(link);
    var assigned=review.assignedUserId==null?'':String(review.assignedUserId);
    var assign=select([['','ללא אחראי']].concat((settings.staff||[]).map(function(staff){return [String(staff.id),staff.name+' · '+staff.email];})),assigned,function(){});
    assign.setAttribute('aria-label','עובד אחראי לבדיקה');assign.disabled=!settings.canReview;actions.append(field('משויך לבדיקה',assign));
    var note=el('input','vs-anomaly-search');note.type='text';note.maxLength=300;note.value=review.note||'';note.placeholder='הערה / ממצאי בדיקה';note.disabled=!settings.canReview;actions.append(field('הערה',note));
    var next=select([['open','ממתינה לבדיקה'],['reviewed','נבדקה (ללא הכרעה)'],['confirmed','חריגה אמיתית'],['false_positive','התראת שווא']],review.state==='dismissed'?'false_positive':review.state,function(){});
    next.setAttribute('aria-label','תוצאת בדיקה');next.disabled=!settings.canReview;actions.append(field('תוצאה',next));
    var notice=el('span','vs-anomaly-status');notice.setAttribute('role','status');
    if(settings.canReview)actions.append(btn('שמור טיפול','vs-anomaly-button--primary',async function(){
      try{notice.textContent='שומר…';await api('/api/admin/order-anomalies/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderRef:order.orderRef,state:next.value,note:note.value.trim(),assignedUserId:assign.value?Number(assign.value):null})});await render(root);}catch(e){notice.textContent=e.message;}
    }));
    actions.append(btn('יומן בדיקה','',async function(){
      try{notice.textContent='טוען…';var result=await api('/api/admin/order-anomalies/history?orderRef='+encodeURIComponent(order.orderRef));
        var prior=card.querySelector('.vs-anomaly-history');if(prior)prior.remove();var history=el('div','vs-anomaly-history');history.append(el('strong','','היסטוריית טיפול'));
        if(!result.history.length)history.append(el('p','','טרם בוצעו פעולות'));
        else result.history.forEach(function(x){history.append(el('p','',asTime(x.at)+' · '+x.actor+' · '+stateName(x.state)+(x.note?' · '+x.note:'')));});
        card.append(history);notice.textContent='';
      }catch(e){notice.textContent=e.message;}
    }));
    actions.append(notice);card.append(actions);return card;
  }
  async function refreshData(root){
    var serial=++refreshId;var results=root.querySelector('.vs-anomaly-results');if(!results)return;results.textContent='טוען חריגות…';
    try{
      var params=new URLSearchParams({range:filters.range,severity:filters.severity,kind:filters.kind,reviewState:filters.reviewState,q:filters.q,limit:String(PAGE_SIZE),offset:String(filters.offset)});
      var data=await api('/api/admin/order-anomalies?'+params);
      if(serial!==refreshId||!root.querySelector('.vs-anomalies'))return;
      var label={all:'סה״כ התראות',open:'ממתינות לבדיקה',confirmed:'חריגות מאומתות',falseTotal:'התראות שווא',falsePositiveRate:'אחוז שווא מסיווגים'};
      Object.keys(label).forEach(function(key){var node=root.querySelector('[data-anomaly-stat="'+key+'"] strong');if(!node)return;var v=key==='falseTotal'?Number(data.summary.false_positive||0)+Number(data.summary.dismissed||0):data.summary[key];node.textContent=key==='falsePositiveRate'?(v==null?'אין נתונים':v+'%'):digits.format(v||0);});
      results.replaceChildren();var head=el('div','vs-anomaly-results-head');head.append(el('strong','',digits.format(data.count)+' תוצאות'));if(data.truncated)head.append(el('span','vs-anomaly-warning','הסריקה מוגבלת ל־5,000 הזמנות. נסה טווח תאריכים קצר יותר.'));results.append(head);
      if(!data.orders.length)results.append(el('p','vs-anomaly-empty','אין הזמנות חריגות המתאימות לסינון.'));
      else data.orders.forEach(function(order){results.append(renderCard(order,root));});
      var nav=el('div','vs-anomaly-pagination');var back=btn('הקודם','',function(){filters.offset=Math.max(0,filters.offset-PAGE_SIZE);refreshData(root);});back.disabled=!filters.offset;
      var next=btn('הבא','',function(){filters.offset+=PAGE_SIZE;refreshData(root);});next.disabled=!data.hasMore;
      nav.append(back,el('span','',(data.count?filters.offset+1:0)+'–'+Math.min(filters.offset+PAGE_SIZE,data.count)+' מתוך '+data.count),next);results.append(nav);
    }catch(error){if(serial===refreshId)results.replaceChildren(el('p','vs-anomaly-error',error.message));}
  }
  async function render(root){
    var id=++refreshId;var view=el('div','vs-anomalies'),intro=el('div','vs-anomaly-intro');intro.append(el('h2','','הזמנות חריגות'),el('p','','איתור אירועים שמצריכים בדיקה ידנית. התאמה לכלל אינה הוכחה להונאה, והמערכת אינה חוסמת הזמנות או תשלומים.'));view.append(intro);
    view.append(el('p','vs-anomaly-hint','טוען הגדרות והרשאות…'));root.replaceChildren(view);
    try{settings=await api('/api/admin/order-anomalies/settings');if(refreshId!==id)return;
      view.replaceChildren(intro);var stats=el('div','vs-anomaly-stats');
      [['all','סה״כ התראות'],['open','ממתינות לבדיקה'],['confirmed','חריגות מאומתות'],['falseTotal','התראות שווא'],['falsePositiveRate','אחוז שווא מסיווגים']].forEach(function(entry){var n=el('div','vs-anomaly-stat');n.dataset.anomalyStat=entry[0];n.append(el('span','',entry[1]),el('strong','','…'));stats.append(n);});view.append(stats);
      var controls=el('div','vs-anomaly-controls');controls.append(
        field('תקופה',select([['7d','7 ימים'],['30d','30 ימים'],['90d','90 ימים'],['all','הכול']],filters.range,function(x){changeFilter('range',x,root);})),
        field('מצב טיפול',select([['open','ממתינות'],['all','הכול'],['reviewed','נבדקו'],['confirmed','חריגות אמיתיות'],['false_positive','התראות שווא'],['dismissed','שווא (סיווג ישן)']],filters.reviewState,function(x){changeFilter('reviewState',x,root);})),
        field('חומרה',select([['all','כל הרמות'],['high','גבוהה'],['medium','בינונית'],['low','נמוכה']],filters.severity,function(x){changeFilter('severity',x,root);})),
        field('סוג חריגה',select([['all','כל הסוגים'],['duplicate','הזמנה כפולה'],['address','אותה כתובת'],['payment','תשלום נכשל'],['price','מחירי מוצר והזמנה'],['gateway','פער מול הסליקה'],['custom','כלל אישי']],filters.kind,function(x){changeFilter('kind',x,root);})));var search=el('input','vs-anomaly-search');search.type='search';search.maxLength=120;search.placeholder='מספר הזמנה / שם';search.value=filters.q;search.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();changeFilter('q',search.value.trim(),root);}};
      controls.append(field('חיפוש',search),btn('חפש','vs-anomaly-button--primary',function(){changeFilter('q',search.value.trim(),root);}));view.append(controls);
      createRules(root,view);
      view.append(el('p','vs-anomaly-hint','התאמות כתובת מבוססות על עיר, רחוב, מספר בית ודירה; אותן כתובות עלולות להיות תקינות. פערי סליקה מופיעים רק כאשר שרת החנות קיבל סכום מאומת שונה מהסכום השמור. המדדים משקפים רק חריגות שהתגלו בסריקה.'));
      view.append(el('div','vs-anomaly-results','טוען נתונים…'));await refreshData(root);
    }catch(error){if(refreshId===id)view.replaceChildren(intro,el('p','vs-anomaly-error',error.message));}
  }
  window.VersansAnomalies={render:render};
})();
