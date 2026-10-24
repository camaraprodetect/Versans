(function () {
  'use strict';
  var status = 'all', period = '90d', search = '', offset = 0, expandedRef = '';
  var requestSerial = 0;
  var statusNames = {all:'כל ההזמנות',waiting:'לא הגיעו',partial:'הגיעו חלקית',ready:'הכול הגיע'};
  function el(tag, cls, txt) {
    var node = document.createElement(tag);
    if(cls) node.className=cls;
    if(txt != null) node.textContent=String(txt);
    return node;
  }
  async function request(url, options) {
    var res=await fetch(url,Object.assign({credentials:'same-origin',headers:{'Accept':'application/json'}},options||{}));
    var body=await res.json().catch(function(){return {};});
    if(!res.ok||body.ok===false)throw new Error(body.error==='permission_denied'?'אין הרשאה לפעולה זו':(body.error||'לא ניתן לטעון נתונים'));
    return body;
  }
  function statusChip(kind) { return el('span','vs-arrivals-badge vs-arrivals-badge--'+kind,statusNames[kind]); }
  function qtyText(available, total) {return available+' מתוך '+total+' הגיעו';}
  function smallDate(timestamp){return timestamp ? new Date(Number(timestamp)).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}) : 'לא ידוע';}
  function makeButton(txt, cls, callback) {
    var b=el('button',cls,txt);b.type='button';b.addEventListener('click',callback);return b;
  }
  async function render(content, opts) {
    var canEdit=!!(opts&&opts.canEdit);
    var wrap=el('section','vs-arrivals');
    var head=el('div','vs-arrivals-intro');
    head.append(el('h2','', 'הגעת פריטים להזמנות'),el('p','', 'נתונים מסריקת החבילות ומסימוני הקליטה באדמין. סטטוס משלוח של חברת השילוח אינו נחשב הגעה בפועל.'));
    var jump=el('a','vs-arrivals-link','לסריקת חבילות ←');jump.href='/admin/order-work';head.appendChild(jump);wrap.appendChild(head);
    var summary=el('div','vs-arrivals-summary');wrap.appendChild(summary);
    var toolbar=el('div','vs-arrivals-tools');
    var tabs=el('div','vs-arrivals-tabs');tabs.setAttribute('aria-label','סינון לפי מצב הגעה');
    Object.keys(statusNames).forEach(function(key){
      var btn=makeButton(statusNames[key],'vs-arrivals-tab'+(key===status?' is-active':''),function(){status=key;offset=0;expandedRef='';updateTabs();load();});
      btn.dataset.status=key;btn.setAttribute('aria-pressed',String(key===status));tabs.appendChild(btn);
    });
    var searchBox=el('input','vs-arrivals-search');searchBox.type='search';searchBox.placeholder='חיפוש מספר הזמנה, לקוח, מייל או טלפון';searchBox.value=search;searchBox.setAttribute('aria-label','חיפוש הזמנה לפי שם, מספר או טלפון');
    var periodBox=el('select','vs-arrivals-period');periodBox.setAttribute('aria-label','תקופת הזמנות');
    [['90d','90 ימים אחרונים'],['all','כל הזמנים']].forEach(function(pair){var opt=el('option','',pair[1]);opt.value=pair[0];periodBox.appendChild(opt);});periodBox.value=period;
    var searchForm=el('form','vs-arrivals-search-form');var searchButton=el('button','vs-arrivals-search-submit','חפש');searchButton.type='submit';
    searchForm.append(searchBox,searchButton);
    searchForm.addEventListener('submit',function(e){e.preventDefault();search=searchBox.value.trim();offset=0;expandedRef='';load();});
    periodBox.addEventListener('change',function(){period=periodBox.value;offset=0;expandedRef='';load();});
    toolbar.append(tabs,periodBox,searchForm);wrap.appendChild(toolbar);
    var message=el('div','vs-arrivals-message');message.setAttribute('role','status');wrap.appendChild(message);
    var list=el('div','vs-arrivals-list');wrap.appendChild(list);
    var pagination=el('div','vs-arrivals-pagination');wrap.appendChild(pagination);
    content.replaceChildren(wrap);
    function updateTabs(){Array.from(tabs.children).forEach(function(b){var active=b.dataset.status===status;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});}
    function fillSummary(data) {
      summary.replaceChildren();
      [['all','סה״כ הזמנות'],['waiting','לא הגיעו'],['partial','הגיעו חלקית'],['ready','הכול הגיע']].forEach(function(pair){
        var block=el('div','vs-arrivals-stat vs-arrivals-stat--'+pair[0]);block.append(el('span','',pair[1]),el('strong','',Number(data.summary[pair[0]]||0).toLocaleString('he-IL')));summary.appendChild(block);
      });
    }
    async function addDetail(panel,order) {
      panel.replaceChildren(el('p','vs-arrivals-loading','טוען את סימוני היחידות…'));
      try {
        var data=await request('/api/admin/packaging/order?orderRef='+encodeURIComponent(order.orderRef));
        // Ignore a response after the user has closed this card or switched pages.
        if(!panel.isConnected)return;
        panel.replaceChildren();
        var totals=el('div','vs-arrivals-detail-total',data.receivedUnits+' הגיעו · '+data.missingUnits+' חסרות · '+data.totalUnits+' יחידות בהזמנה');panel.appendChild(totals);
        (data.items||[]).forEach(function(item){
          var product=el('div','vs-arrivals-product');
          var productTop=el('div','vs-arrivals-product-top');
          var title=el('strong','',item.name||'מוצר');
          var counts=el('span','vs-arrivals-product-count',qtyText(item.receivedQty,item.qty));
          if(item.image&&(/^https?:\/\//.test(item.image)||item.image[0]==='/')){
            var img=el('img','vs-arrivals-product-image');img.src=item.image;img.alt='';img.loading='lazy';productTop.appendChild(img);
          }
          productTop.append(title,counts);product.appendChild(productTop);
          var units=el('div','vs-arrivals-units');
          (item.units||[]).forEach(function(unit){
            var label=el('label','vs-arrivals-unit'+(unit.arrived?' is-received':' is-missing'));
            var cb=el('input');cb.type='checkbox';cb.checked=!!unit.arrived;cb.disabled=!canEdit;
            var t=el('span','',item.qty>1?'יחידה '+unit.unitNumber:'יחידה');
            var stateLabel=el('small','',unit.arrived?'הגיעה':'חסרה');
            label.append(cb,t,stateLabel);
            if(unit.trackingNumber)label.title='מספר מעקב: '+unit.trackingNumber;
            if(canEdit){cb.addEventListener('change',async function(){
              var checked=cb.checked;cb.disabled=true;
              try {
                await request('/api/admin/packaging/unit',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({orderRef:data.orderRef,itemIndex:item.itemIndex,unitNumber:unit.unitNumber,received:checked})});
                expandedRef=order.orderRef;await load();
              }catch(err){cb.checked=!checked;cb.disabled=false;message.textContent='שמירת הסימון נכשלה: '+err.message;}
            });}
            units.appendChild(label);
          });
          product.appendChild(units);panel.appendChild(product);
        });
        if(!canEdit)panel.appendChild(el('p','vs-arrivals-hint','צפייה בלבד: שינוי סימוני קליטה דורש הרשאת עריכת הזמנות.'));
        var link=el('a','vs-arrivals-link','פרטי הזמנה ומעקב ←');link.href='/admin/order-work?order='+encodeURIComponent(data.orderRef);panel.appendChild(link);
      }catch(err){if(panel.isConnected)panel.replaceChildren(el('p','vs-arrivals-error','לא ניתן לטעון את פרטי הקליטה: '+err.message));}
    }
    function fillList(data) {
      list.replaceChildren();pagination.replaceChildren();
      if(!data.orders.length) {list.appendChild(el('p','vs-arrivals-empty','אין הזמנות שמתאימות לסינון שבחרת.'));return;}
      data.orders.forEach(function(order){
        var card=el('article','vs-arrivals-order');
        var top=el('div','vs-arrivals-order-head');
        var first=el('div','vs-arrivals-order-title');first.append(el('strong','',order.orderRef),el('small','',order.customerName+' · '+smallDate(order.paidAt)));
        var progress=el('div','vs-arrivals-order-progress');progress.append(statusChip(order.status),el('span','',qtyText(order.receivedUnits,order.totalUnits)),el('b','',order.missingUnits ? 'חסרות '+order.missingUnits+' יחידות':'אין פריטים חסרים'));
        top.append(first,progress);card.appendChild(top);
        // Always-visible per-product summary: you can identify missing items without opening any accordion.
        var preview=el('div','vs-arrivals-preview');
        (order.items||[]).forEach(function(item){var row=el('div','vs-arrivals-preview-row');row.append(el('span','',item.name),el('span','',item.receivedQty+'/'+item.qty+' הגיעו'),el('strong',item.missingQty?'is-missing':'is-complete',item.missingQty?'חסר '+item.missingQty:'הכול הגיע'));preview.appendChild(row);});
        card.appendChild(preview);
        var details=el('details','vs-arrivals-disclosure');
        var disclose=el('summary','vs-arrivals-disclose','פירוט לפי יחידה, מספרי מעקב ועדכון קליטה ⌄');
        var panel=el('div','vs-arrivals-detail');details.append(disclose,panel);card.appendChild(details);
        var loaded=false;
        details.addEventListener('toggle',function(){if(details.open&&!loaded){loaded=true;expandedRef=order.orderRef;addDetail(panel,order);}else if(!details.open&&expandedRef===order.orderRef)expandedRef='';});
        if(expandedRef===order.orderRef){details.open=true;loaded=true;addDetail(panel,order);}
        list.appendChild(card);
      });
      var start=Number(data.offset)||0, count=Number(data.count)||0, size=Number(data.limit)||20;
      var prev=makeButton('הקודם','vs-arrivals-page-button',function(){offset=Math.max(0,offset-size);expandedRef='';load();});prev.disabled=start===0;
      var next=makeButton('הבא','vs-arrivals-page-button',function(){offset=start+size;expandedRef='';load();});next.disabled=start+size>=count;
      pagination.append(prev,el('span','', 'מציג '+(start+1)+'–'+Math.min(start+size,count)+' מתוך '+count),next);
    }
    async function load(){
      var ticket=++requestSerial;
      message.textContent='טוען נתוני קליטת הזמנות…';
      try {
        var params=new URLSearchParams({status,period,search,offset:String(offset),limit:'20'});
        var data=await request('/api/admin/packaging/overview?'+params.toString());
        if(ticket!==requestSerial||!wrap.isConnected)return;
        fillSummary(data);fillList(data);
        message.textContent=data.truncated?'המערכת בודקת עד 20,000 הזמנות ששולמו בטווח הנבחר. להזמנות ותיקות מעבר למגבלה ניתן לעבור לטיפול בהזמנות.':'';
      }catch(err){if(ticket!==requestSerial||!wrap.isConnected)return;list.replaceChildren();pagination.replaceChildren();message.textContent='לא ניתן להציג את מצב ההזמנות: '+err.message;}
    }
    await load();
  }
  window.VersansAdminArrivals={render:render};
})();
