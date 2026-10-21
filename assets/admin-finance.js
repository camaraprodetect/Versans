/* VerSans finances: backed by server-side expenses and paid-order income, not localStorage. */
(function () {
  'use strict';
  var pageState = {
    expenses: {from:'',to:'',offset:0},
    income: {from:'',to:'',offset:0}
  };
  var PAGE_SIZE = 40;
  var MAX_PDF_ROWS = 8000;
  var currency = new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:2});
  var number = new Intl.NumberFormat('he-IL');
  function make(tag, cls, value) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value != null) el.textContent = String(value);
    return el;
  }
  function money(agorot){return currency.format(Number(agorot || 0) / 100);}
  function nowIsraelDate(){
    var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    var p={};parts.forEach(function(v){p[v.type]=v.value;});return p.year+'-'+p.month+'-'+p.day;
  }
  function prettyDate(date){if(!date)return '-';var a=String(date).split('-');return a.length===3?a[2]+'/'+a[1]+'/'+a[0]:date;}
  function prettyTime(timestamp){
    return timestamp ? new Date(Number(timestamp)).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';
  }
  function wrapField(title,input){var wrap=make('label','vs-finance-field');wrap.append(make('span','',title),input);return wrap;}
  function input(type,attrs){var i=make('input');i.type=type;Object.keys(attrs||{}).forEach(function(k){i[k]=attrs[k];});return i;}
  function button(label,cls,handler){var b=make('button','vs-finance-button '+(cls||''),label);b.type='button';if(handler)b.addEventListener('click',handler);return b;}
  async function request(type,filters,limit,offset){
    var params=new URLSearchParams({limit:String(limit),offset:String(offset)});
    if(filters.from)params.set('from',filters.from);
    if(filters.to)params.set('to',filters.to);
    var res=await fetch('/api/admin/finance/'+type+'?'+params.toString(),{credentials:'same-origin',headers:{Accept:'application/json'}});
    var data=await res.json().catch(function(){return {};});
    if(!res.ok)throw new Error(data.error==='permission_denied'?'אין הרשאה להצגת נתונים אלו':'טעינת הנתונים נכשלה');
    return data;
  }
  function setStatus(node,message,isError){node.textContent=message||'';node.classList.toggle('is-error',!!isError);}
  async function render(root,type){
    var expenseMode=type==='expenses';
    var state=pageState[type];
    var view=make('div','vs-finance');
    var title=make('div','vs-finance-intro');
    title.append(make('h2','',expenseMode?'יומן הוצאות':'יומן הכנסות'),make('p','',expenseMode?
      'כל הוצאה על העסק, בכל תחום. העובד שרשם את ההוצאה נשמר אוטומטית.':
      'כל תשלום אמיתי שאומת מופיע פעם אחת, גם אם האישור נשלח שוב. הזמנות הדגמה אינן הכנסה.'));
    view.appendChild(title);

    var stats=make('div','vs-finance-stats');
    var sumCard=make('div','vs-finance-stat');sumCard.append(make('span','',expenseMode?'סך הוצאות בתקופה':'סך הכנסות בתקופה'));
    var sum=make('strong','','—');sumCard.appendChild(sum);
    var countCard=make('div','vs-finance-stat');countCard.append(make('span','',expenseMode?'מספר הוצאות':'הזמנות ששולמו'));
    var count=make('strong','','—');countCard.appendChild(count);stats.append(sumCard,countCard);view.appendChild(stats);

    if(expenseMode){
      var form=make('form','vs-finance-panel vs-finance-entry');
      form.appendChild(make('h3','','רישום הוצאה חדשה'));
      var fields=make('div','vs-finance-entry-grid');
      var description=input('text',{placeholder:'לדוגמה: קניית קופסאות תכשיטים',maxLength:300,required:true});
      var amount=input('number',{placeholder:'0.00',min:'0.01',max:'99999999',step:'0.01',required:true});
      var category=make('select');
      ['מוצרים ומלאי','אריזות','משלוחים','פרסום ושיווק','ציוד','שכר','שירותים','אחר'].forEach(function(v){var o=make('option','',v);o.value=v;category.appendChild(o);});
      var expenseDate=input('date',{value:nowIsraelDate(),required:true});
      fields.append(wrapField('על מה ההוצאה?',description),wrapField('סכום (₪)',amount),wrapField('קטגוריה',category),wrapField('תאריך ההוצאה',expenseDate));
      form.appendChild(fields);
      var formFoot=make('div','vs-finance-form-foot');
      var formNote=make('small','','שם העובד ותאריך הרישום נשמרים מתוך החשבון המחובר.');
      var formStatus=make('p','vs-finance-status');formStatus.setAttribute('role','status');
      var submit=button('שמור הוצאה','vs-finance-primary');submit.type='submit';
      formFoot.append(formNote,submit);form.append(formFoot,formStatus);view.appendChild(form);
      var pendingId=null;
      form.addEventListener('submit',async function(event){
        event.preventDefault();if(!form.reportValidity())return;
        if(!pendingId)pendingId=window.crypto.randomUUID();
        submit.disabled=true;submit.textContent='שומר…';setStatus(formStatus,'');
        try{
          var res=await fetch('/api/admin/finance/expenses',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({description:description.value.trim(),amount:amount.value,category:category.value,date:expenseDate.value,requestId:pendingId})});
          var data=await res.json().catch(function(){return {};});
          if(!res.ok)throw new Error(data.error==='invalid_expense'?'בדוק את סכום ההוצאה, התאריך והתיאור':'לא ניתן לשמור את ההוצאה');
          pendingId=null;description.value='';amount.value='';category.selectedIndex=0;expenseDate.value=nowIsraelDate();
          state.offset=0;setStatus(formStatus,'ההוצאה נשמרה בהצלחה');await loadRows();
        }catch(err){setStatus(formStatus,err.message,true);}finally{submit.disabled=false;submit.textContent='שמור הוצאה';}
      });
    }

    var panel=make('section','vs-finance-panel');
    var toolbar=make('div','vs-finance-toolbar');
    var heading=make('h3','',expenseMode?'רשימת הוצאות':'רשימת הכנסות');
    var filterWrap=make('form','vs-finance-filters');
    var from=input('date',{value:state.from});
    var to=input('date',{value:state.to});
    var fromField=wrapField('מתאריך',from),toField=wrapField('עד תאריך',to);
    var filterButton=button('סנן','vs-finance-neutral');filterButton.type='submit';
    var clearButton=button('נקה','vs-finance-neutral',function(){from.value='';to.value='';state.from='';state.to='';state.offset=0;loadRows();});
    var pdf=button('ייצוא PDF','vs-finance-primary');
    filterWrap.append(fromField,toField,filterButton,clearButton,pdf);
    toolbar.append(heading,filterWrap);panel.appendChild(toolbar);
    var status=make('p','vs-finance-status');status.setAttribute('role','status');panel.appendChild(status);
    var scroll=make('div','vs-finance-scroll');
    var table=make('table','vs-finance-table');
    var thead=make('thead'),headRow=make('tr');
    (expenseMode?['תאריך','הוצאה','קטגוריה','סכום','עובד']:['תאריך תשלום','מספר הזמנה','הכנסה','פרטי הזמנה']).forEach(function(v){headRow.appendChild(make('th','',v));});
    thead.appendChild(headRow);var tbody=make('tbody');table.append(thead,tbody);scroll.appendChild(table);panel.appendChild(scroll);
    var pagination=make('div','vs-finance-pagination');
    var previous=button('הקודם','vs-finance-neutral',function(){state.offset=Math.max(0,state.offset-PAGE_SIZE);loadRows();});
    var pageLabel=make('span','','');
    var next=button('הבא','vs-finance-neutral',function(){state.offset+=PAGE_SIZE;loadRows();});
    pagination.append(previous,pageLabel,next);panel.appendChild(pagination);
    view.appendChild(panel);root.replaceChildren(view);

    filterWrap.addEventListener('submit',function(event){event.preventDefault();if(from.value&&to.value&&from.value>to.value){setStatus(status,'תאריך התחלה חייב להיות לפני תאריך הסיום',true);return;}state.from=from.value;state.to=to.value;state.offset=0;loadRows();});
    pdf.addEventListener('click',async function(){
      pdf.disabled=true;pdf.textContent='מכין PDF…';setStatus(status,'מכין דוח עם כל הרשומות בטווח הנבחר…');
      try{
        if(!window.VersansReportPDF || typeof window.VersansReportPDF.download!=='function')throw new Error('מנגנון ה-PDF אינו זמין');
        var items=[],result,offset=0,total=0;
        do {
          result=await request(type,state,500,offset);
          total=result.total;
          if(total>MAX_PDF_ROWS)throw new Error('יש יותר מ-'+number.format(MAX_PDF_ROWS)+' רשומות. בחר טווח תאריכים קצר יותר לייצוא PDF.');
          items=items.concat(result.rows||[]);offset=items.length;
        }while(offset<total);
        var columns=expenseMode?[
          {key:'date',label:'תאריך'},{key:'description',label:'הוצאה'},{key:'category',label:'קטגוריה'},
          {key:'amount',label:'סכום (₪)'},{key:'employee',label:'עובד'}
        ]:[{key:'date',label:'תאריך תשלום'},{key:'order',label:'מספר הזמנה'},{key:'amount',label:'סכום (₪)'}];
        var rows=items.map(function(item){return expenseMode?{
          date:prettyDate(item.expense_date),description:item.description,category:item.category,
          amount:money(item.amount_agorot),employee:item.employee_name
        }:{date:prettyTime(item.paid_at),order:item.order_ref,amount:money(item.amount_agorot)};});
        await window.VersansReportPDF.download({title:expenseMode?'דו״ח הוצאות':'דו״ח הכנסות',columns:columns,rows:rows,generatedAt:Date.now()},columns.map(function(c){return c.key;}),{type:expenseMode?'expenses':'income',from:state.from,to:state.to,forceTable:true});
        setStatus(status,'הדוח הופק עם '+number.format(rows.length)+' רשומות.');
      }catch(err){setStatus(status,err.message||'לא ניתן להפיק PDF',true);}finally{pdf.disabled=false;pdf.textContent='ייצוא PDF';}
    });

    async function loadRows(){
      setStatus(status,'טוען רשומות…');
      try{
        var data=await request(type,state,PAGE_SIZE,state.offset);
        sum.textContent=money(data.totalAgorot);count.textContent=number.format(data.total);
        tbody.replaceChildren();
        (data.rows||[]).forEach(function(item){
          var row=make('tr');
          if(expenseMode){
            [prettyDate(item.expense_date),item.description,item.category,money(item.amount_agorot),item.employee_name].forEach(function(v,index){row.appendChild(make('td',index===3?'vs-finance-money':'',v));});
          }else{
            row.appendChild(make('td','',prettyTime(item.paid_at)));
            row.appendChild(make('td','vs-finance-ref',item.order_ref));
            row.appendChild(make('td','vs-finance-money',money(item.amount_agorot)));
            var cell=make('td');var link=make('a','vs-finance-order-link','פרטים מלאים ←');link.href='/admin/order-work?order='+encodeURIComponent(item.order_ref);cell.appendChild(link);row.appendChild(cell);
          }
          tbody.appendChild(row);
        });
        if(!data.rows.length){var row=make('tr'),td=make('td','vs-finance-empty','אין רשומות בטווח שנבחר');td.colSpan=expenseMode?5:4;row.appendChild(td);tbody.appendChild(row);}
        var start=data.total?state.offset+1:0;
        pageLabel.textContent=number.format(start)+'–'+number.format(Math.min(state.offset+data.rows.length,data.total))+' מתוך '+number.format(data.total);
        previous.disabled=state.offset===0;next.disabled=state.offset+data.rows.length>=data.total;
        setStatus(status,'');
      }catch(err){setStatus(status,err.message||'טעינת הנתונים נכשלה',true);}
    }
    await loadRows();
  }
  window.VersansFinance={render:render};
})();
