/* VerSans Admin - advisory order anomaly review. */
(function(){
  'use strict';
  var filters={range:'30d',severity:'all',kind:'all',reviewState:'open',q:'',offset:0};
  var PAGE_SIZE=25;
  var refreshId=0;
  var currency=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'});
  var intlNumber=new Intl.NumberFormat('he-IL');
  function node(tag,cls,value){var e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=String(value);return e;}
  function button(label,cls,onClick){var e=node('button','vs-anomaly-button '+(cls||''),label);e.type='button';if(onClick)e.addEventListener('click',onClick);return e;}
  function picker(options,value,onChange){var el=node('select','vs-anomaly-select');options.forEach(function(item){var option=node('option','',item[1]);option.value=item[0];el.appendChild(option);});el.value=value;el.addEventListener('change',function(){onChange(el.value);});return el;}
  function field(label,control){var el=node('label','vs-anomaly-field');el.append(node('span','',label),control);return el;}
  function toText(ms){return ms?new Date(Number(ms)).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'-';}
  function money(agorot){return currency.format(Number(agorot||0)/100);}
  function summaryLabel(key){return {all:'סומנו בתקופה',open:'ממתינות לבדיקה',reviewed:'נבדקו',dismissed:'לא רלוונטיות',high:'חומרה גבוהה',medium:'חומרה בינונית',low:'חומרה נמוכה'}[key]||key;}
  function severityLabel(value){return {high:'גבוהה',medium:'בינונית',low:'נמוכה'}[value]||value;}
  function reviewLabel(value){return {open:'ממתינה לבדיקה',reviewed:'נבדקה',dismissed:'לא רלוונטית'}[value]||value;}
  async function jsonRequest(url,options){var response=await fetch(url,Object.assign({credentials:'same-origin',headers:{Accept:'application/json'}},options||{}));var data=await response.json().catch(function(){return {};});if(!response.ok)throw new Error(data.error==='permission_denied'||data.error==='admin_required'?'אין הרשאה למערכת':'לא הצלחנו לקבל נתונים מהשרת');return data;}
  async function changeReview(order,state,note,root,notice){
    var payload={orderRef:order.orderRef,state:state,note:note||''};
    try{
      notice.textContent='שומר…';
      await jsonRequest('/api/admin/order-anomalies/review',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
      await render(root);
    }catch(error){notice.textContent=error.message;}
  }
  function makeCard(order,root){
    var card=node('article','vs-anomaly-card');
    var header=node('div','vs-anomaly-card-head');
    var main=node('div','vs-anomaly-card-main');
    var risk=node('span','vs-anomaly-chip vs-anomaly-risk--'+order.severity,'חומרה '+severityLabel(order.severity));
    var ref=node('strong','vs-anomaly-order-ref',order.orderRef);
    var review=node('span','vs-anomaly-chip vs-anomaly-state--'+order.review.state,reviewLabel(order.review.state));
    main.append(risk,ref,review);
    var amount=node('strong','vs-anomaly-amount',money(order.amountAgorot));
    header.append(main,amount);card.appendChild(header);
    var info=node('div','vs-anomaly-info');
    info.append(node('span','','לקוח: '+order.customerName),node('span','','תאריך: '+toText(order.createdAt)),node('span','','סטטוס תשלום: '+({paid:'שולם',pending:'ממתין',failed:'נכשל'}[order.status]||order.status)));
    card.appendChild(info);
    var reasons=node('ul','vs-anomaly-reasons');
    (order.reasons||[]).forEach(function(reason){reasons.appendChild(node('li','',reason.text));});
    card.appendChild(reasons);
    if(order.review.state!=='open'&&order.review.updatedAt){
      card.appendChild(node('p','vs-anomaly-review-meta',reviewLabel(order.review.state)+' · '+toText(order.review.updatedAt)+' · '+order.review.updatedBy+(order.review.note?' · '+order.review.note:'')));
    }
    var actions=node('div','vs-anomaly-actions');
    var link=node('a','vs-anomaly-button vs-anomaly-button--link','פרטים מלאים ←');link.href='/admin/order-work?order='+encodeURIComponent(order.orderRef);actions.appendChild(link);
    var notice=node('span','vs-anomaly-status');notice.setAttribute('role','status');
    if(order.review.state==='open'){
      actions.append(button('סמן כנבדקה','vs-anomaly-button--primary',function(){
        changeReview(order,'reviewed','',root,notice);
      }));
      actions.append(button('לא רלוונטית','',function(){
        var note=window.prompt('הערה לסגירת ההתראה (לא חובה):','');
        if(note===null)return;
        if(note.length>300){notice.textContent='עד 300 תווים בהערה';return;}
        changeReview(order,'dismissed',note,root,notice);
      }));
    }else{
      actions.append(button('החזר לבדיקה','',function(){changeReview(order,'open','',root,notice);}));
    }
    actions.appendChild(notice);card.appendChild(actions);return card;
  }
  async function render(root){
    var serial=++refreshId;
    var view=node('div','vs-anomalies');
    var intro=node('div','vs-anomaly-intro');intro.append(node('h2','','זיהוי הזמנות חריגות'),node('p','','בדיקה אוטומטית לפי כללים: כפילויות, סכומים חריגים וניסיונות תשלום חוזרים. אלה סימנים לבדיקה בלבד - לא הוכחה לתרמית. המערכת לא חוסמת תשלום או הזמנה.'));
    view.appendChild(intro);
    var stats=node('div','vs-anomaly-stats');
    ['all','open','high','reviewed'].forEach(function(key){var card=node('div','vs-anomaly-stat');card.append(node('span','',summaryLabel(key)),node('strong','','…'));card.dataset.stat=key;stats.appendChild(card);});
    view.appendChild(stats);
    var controls=node('div','vs-anomaly-controls');
    function setFilter(key,value){filters[key]=value;filters.offset=0;render(root);}
    controls.append(
      field('תקופה',picker([['7d','7 ימים'],['30d','30 ימים'],['90d','90 ימים'],['all','כל הזמנים']],filters.range,function(v){setFilter('range',v);})),
      field('מצב טיפול',picker([['open','ממתינות'],['all','הכול'],['reviewed','נבדקו'],['dismissed','לא רלוונטיות']],filters.reviewState,function(v){setFilter('reviewState',v);})),
      field('חומרה',picker([['all','כל רמות החומרה'],['high','גבוהה'],['medium','בינונית'],['low','נמוכה']],filters.severity,function(v){setFilter('severity',v);})),
      field('סוג חריגה',picker([['all','כל הסוגים'],['duplicate','הזמנות דומות'],['price','סכומים ומחירים'],['payment','ניסיונות תשלום']],filters.kind,function(v){setFilter('kind',v);}))
    );
    var search=node('input','vs-anomaly-search');search.type='search';search.placeholder='מספר הזמנה או שם לקוח';search.maxLength=120;search.value=filters.q;
    search.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();setFilter('q',search.value.trim());}});
    var searchButton=button('חיפוש','vs-anomaly-button--primary',function(){setFilter('q',search.value.trim());});
    controls.append(field('חיפוש',search),searchButton);view.appendChild(controls);
    var hint=node('p','vs-anomaly-hint','הכללים כוללים התאמות זהירות כדי לצמצם התראות שווא. המערכת בודקת עד 5,000 הזמנות בכל טעינה; התוצאות משתנות כשמגיעות הזמנות חדשות.');view.appendChild(hint);
    var results=node('div','vs-anomaly-results','טוען נתונים…');results.setAttribute('aria-live','polite');view.appendChild(results);
    root.replaceChildren(view);
    try{
      var params=new URLSearchParams({range:filters.range,severity:filters.severity,kind:filters.kind,reviewState:filters.reviewState,q:filters.q,limit:String(PAGE_SIZE),offset:String(filters.offset)});
      var data=await jsonRequest('/api/admin/order-anomalies?'+params.toString());
      if(serial!==refreshId||!root.contains(view))return;
      stats.querySelectorAll('[data-stat]').forEach(function(el){el.querySelector('strong').textContent=intlNumber.format(Number(data.summary[el.dataset.stat]||0));});
      results.replaceChildren();
      var head=node('div','vs-anomaly-results-head');head.append(node('strong','',intlNumber.format(data.count)+' תוצאות לפי הסינון'));
      if(data.truncated)head.append(node('span','vs-anomaly-warning','נסרקו 5,000 ההזמנות האחרונות בלבד - ייתכנו תוצאות נוספות.'));
      results.appendChild(head);
      if(!data.orders.length){results.appendChild(node('div','vs-anomaly-empty','אין הזמנות חריגות המתאימות לסינון.'));}
      else data.orders.forEach(function(order){results.appendChild(makeCard(order,root));});
      var nav=node('div','vs-anomaly-pagination');
      var prev=button('הקודם','',function(){filters.offset=Math.max(0,filters.offset-PAGE_SIZE);render(root);});prev.disabled=filters.offset===0;
      var next=button('הבא','',function(){filters.offset+=PAGE_SIZE;render(root);});next.disabled=!data.hasMore;
      nav.append(prev,node('span','',intlNumber.format(data.count?filters.offset+1:0)+'–'+intlNumber.format(Math.min(filters.offset+PAGE_SIZE,data.count))+' מתוך '+intlNumber.format(data.count)),next);
      results.appendChild(nav);
    }catch(error){if(serial===refreshId&&root.contains(view))results.replaceChildren(node('p','vs-anomaly-error',error.message));}
  }
  window.VersansAnomalies={render:render};
})();
