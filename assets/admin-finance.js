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
  async function mutate(url,method,body){
    var res=await fetch(url,{method:method,credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body||{})});
    var data=await res.json().catch(function(){return {};});
    var labels={permission_denied:'אין הרשאה לביצוע פעולה זו',invalid_expense:'נתוני ההוצאה אינם תקינים',invalid_amount:'סכום לא תקין',invalid_split:'החלוקה למאור ולגל אינה תואמת לסכום הכולל',cancel_reason_required:'נדרשת סיבה לביטול (לפחות 3 תווים)',creator_payout_locked:'תשלום ליוצר תוכן נעול לעריכה או ביטול כדי לשמור על התאמה ליומן היוצרים',expense_already_cancelled:'ההוצאה כבר בוטלה',paid_order_not_found:'לא נמצאה הזמנה ששולמה עם המספר הזה',refund_exceeds_paid_amount:'סך ההחזרים אינו יכול לעלות על סכום ההזמנה',provider_reference_required:'יש להזין אסמכתה של הזיכוי מחברת הסליקה',request_conflict:'בקשה זו כבר נשמרה',finance_operation_failed:'הפעולה נכשלה. נסה שוב.'};
    if(!res.ok)throw new Error(labels[data.error]||'הפעולה נכשלה ('+(data.error||res.status)+')');
    return data;
  }
  function selectCategory(){
    var el=make('select');
    ['מוצרים ומלאי','פרסום ושיווק','אריזות','משלוחים','עמלות סליקה','יוצרי תוכן','ציוד','שכר','תוכנה ושירותים','שירותים','אחר'].forEach(function(v){var o=make('option','',v);o.value=v;el.appendChild(o);});
    return el;
  }
  function dialogReason(message){var result=window.prompt(message);return result===null?null:result.trim();}

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
    var countCard=make('div','vs-finance-stat');countCard.append(make('span','',expenseMode?'רשומות הוצאה (כולל מבוטלות)':'הזמנות ששולמו'));
    var count=make('strong','','—');countCard.appendChild(count);stats.append(sumCard,countCard);view.appendChild(stats);
    var incomeRefunds=null,incomeNet=null;
    if(!expenseMode){var refundCard=make('div','vs-finance-stat');refundCard.appendChild(make('span','','החזרים מאומתים בתקופה'));incomeRefunds=make('strong','','—');refundCard.appendChild(incomeRefunds);var netCard=make('div','vs-finance-stat');netCard.appendChild(make('span','','הכנסות נטו לאחר החזרים'));incomeNet=make('strong','','—');netCard.appendChild(incomeNet);stats.append(refundCard,netCard);}

    // Grouped split totals are computed on the server across the full date-filtered ledger.
    // The visibility toggle affects only the display, never the saved accounting data.
    var maorTotal=null,galTotal=null,balanceTotal=null,unallocatedInfo=null;
    if(expenseMode){
      var balancePanel=make('section','vs-finance-balance');
      var balanceHeading=make('div','vs-finance-balance-heading');
      var balanceTitle=make('div');balanceTitle.append(
        make('h3','','מאזן הוצאות - מאור וגל'),
        make('p','','ההפרש הוא גל פחות מאור; אינו מייצג חוב אוטומטי.'));
      var balanceCards=make('div','vs-finance-balance-cards');
      function balanceCard(label){var card=make('div','vs-finance-stat');card.appendChild(make('span','',label));var amount=make('strong','','—');card.appendChild(amount);balanceCards.appendChild(card);return amount;}
      maorTotal=balanceCard('הוצאות מאור');
      galTotal=balanceCard('הוצאות גל');
      balanceTotal=balanceCard('מאזן (גל - מאור)');
      var balanceBody=make('div','vs-finance-balance-body');balanceBody.appendChild(balanceCards);
      unallocatedInfo=make('p','vs-finance-balance-legacy');balanceBody.appendChild(unallocatedInfo);
      var hidden=false;
      try{hidden=localStorage.getItem('versans-finance-balance-hidden')==='1';}catch(_){/* privacy mode */}
      var balanceToggle=button('הסתר מאזן','vs-finance-neutral vs-finance-toggle');
      function applyBalanceVisibility(){balanceBody.hidden=hidden;balanceToggle.textContent=hidden?'הצג מאזן':'הסתר מאזן';balanceToggle.setAttribute('aria-expanded',String(!hidden));}
      balanceToggle.addEventListener('click',function(){hidden=!hidden;applyBalanceVisibility();try{localStorage.setItem('versans-finance-balance-hidden',hidden?'1':'0');}catch(_){/* privacy mode */}});
      balanceHeading.append(balanceTitle,balanceToggle);balancePanel.append(balanceHeading,balanceBody);view.appendChild(balancePanel);
      applyBalanceVisibility();
    }

    if(expenseMode){
      var form=make('form','vs-finance-panel vs-finance-entry');
      var formTitle=make('h3','','רישום הוצאה חדשה');form.appendChild(formTitle);
      var fields=make('div','vs-finance-entry-grid');
      var description=input('text',{placeholder:'לדוגמה: קניית קופסאות תכשיטים',maxLength:300,required:true});
      var amount=input('number',{placeholder:'0.00',min:'0.01',max:'99999999',step:'0.01',required:true,readOnly:true});
      var maorInput=input('number',{placeholder:'0.00',min:'0',max:'99999999',step:'0.01'});
      var galInput=input('number',{placeholder:'0.00',min:'0',max:'99999999',step:'0.01'});
      var category=selectCategory();
      var expenseDate=input('date',{value:nowIsraelDate(),required:true});
      fields.append(wrapField('על מה ההוצאה?',description),wrapField('קטגוריה',category),
        wrapField('שולם ע״י מאור (₪)',maorInput),wrapField('שולם ע״י גל (₪)',galInput),
        wrapField('סה״כ הוצאה (₪)',amount),wrapField('תאריך ההוצאה',expenseDate));
      var updateAmount=function(){
        var maor=maorInput.value?Number(maorInput.value):0,gal=galInput.value?Number(galInput.value):0;
        if(!Number.isFinite(maor)||!Number.isFinite(gal)||maor<0||gal<0){amount.value='';return;}
        var total=Math.round(maor*100)+Math.round(gal*100);
        amount.value=total>0?(total/100).toFixed(2):'';
      }
      maorInput.addEventListener('input',function(){amount.readOnly=true;updateAmount();});galInput.addEventListener('input',function(){amount.readOnly=true;updateAmount();});
      form.appendChild(fields);
      var formFoot=make('div','vs-finance-form-foot');
      var formNote=make('small','','אפשר לרשום תשלום של אחד מהם או פיצול ביניהם. סה״כ מחושב אוטומטית; שם העובד המדווח נשמר מתוך החשבון המחובר.');
      var formStatus=make('p','vs-finance-status');formStatus.setAttribute('role','status');
      var submit=button('שמור הוצאה','vs-finance-primary');submit.type='submit';
      var editCancel=button('בטל עריכה','vs-finance-neutral');editCancel.hidden=true;
      var editingId=null,canCreateExpense=false;
      function resetExpenseForm(){amount.readOnly=true;editingId=null;form.hidden=!canCreateExpense;formTitle.textContent='רישום הוצאה חדשה';description.value='';maorInput.value='';galInput.value='';amount.value='';category.selectedIndex=0;expenseDate.value=nowIsraelDate();submit.textContent='שמור הוצאה';editCancel.hidden=true;pendingId=null;}
      editCancel.addEventListener('click',resetExpenseForm);
      formFoot.append(formNote,editCancel,submit);form.append(formFoot,formStatus);view.appendChild(form);
      var pendingId=null;
      form.addEventListener('submit',async function(event){
        event.preventDefault();if(editingId&&amount.readOnly===false){if(!form.reportValidity())return;}else{updateAmount();if(!form.reportValidity())return;}
        if(!editingId&&!pendingId)pendingId=window.crypto.randomUUID();
        submit.disabled=true;submit.textContent='שומר…';setStatus(formStatus,'');
        try{
          await mutate(editingId?'/api/admin/finance/expenses/'+editingId:'/api/admin/finance/expenses',editingId?'PATCH':'POST',{
            description:description.value.trim(),amount:amount.value,maorAmount:amount.readOnly?maorInput.value||'0':null,galAmount:amount.readOnly?galInput.value||'0':null,category:category.value,date:expenseDate.value,requestId:pendingId});
          resetExpenseForm();
          state.offset=0;setStatus(formStatus,'ההוצאה נשמרה בהצלחה');await loadRows();
        }catch(err){setStatus(formStatus,err.message,true);}finally{submit.disabled=false;submit.textContent=editingId?'שמור שינויים':'שמור הוצאה';}
      });
    }

    // Recurring expenses are recognized once for each due month. Historical changes remain auditable.
    var categoryList=null,recurringList=null,recurringStatus=null,refundList=null,refundStatus=null,refundTotals=null;
    var recurringCanManage=false,refundCanManage=false;
    if(expenseMode){
      var categoriesSection=make('section','vs-finance-panel vs-finance-breakdown');
      categoriesSection.appendChild(make('h3','','הוצאות לפי קטגוריה'));
      categoryList=make('div','vs-finance-categories');categoriesSection.appendChild(categoryList);view.appendChild(categoriesSection);
      var recurringSection=make('details','vs-finance-panel vs-finance-details');
      var recurringSummary=make('summary','','הוצאות קבועות בכל חודש');recurringSection.appendChild(recurringSummary);
      recurringSection.appendChild(make('p','vs-finance-help','המערכת רושמת הוצאה אוטומטית בתאריך שנבחר בכל חודש, ללא כפל רישום. זהו רישום חשבונאי ולא העברה כספית בפועל.'));
      var recurringForm=make('form','vs-finance-entry');
      var recurringFields=make('div','vs-finance-entry-grid');
      var recurringDesc=input('text',{placeholder:'למשל: מנוי תוכנה',required:true,maxLength:300});
      var recurringCat=selectCategory();
      var recurringMaor=input('number',{min:'0',step:'0.01',placeholder:'0.00'});
      var recurringGal=input('number',{min:'0',step:'0.01',placeholder:'0.00'});
      var recurringTotal=input('number',{min:'0.01',step:'0.01',placeholder:'0.00',readOnly:true,required:true});
      var recurringDate=input('date',{value:nowIsraelDate(),required:true});
      var recurringDay=input('number',{value:1,min:1,max:31,step:1,required:true});
      function recalc(){var x=Math.round(Number(recurringMaor.value||0)*100)+Math.round(Number(recurringGal.value||0)*100);recurringTotal.value=x>0?(x/100).toFixed(2):'';}
      recurringMaor.addEventListener('input',recalc);recurringGal.addEventListener('input',recalc);
      recurringFields.append(wrapField('תיאור',recurringDesc),wrapField('קטגוריה',recurringCat),wrapField('מאור (₪)',recurringMaor),wrapField('גל (₪)',recurringGal),wrapField('סה״כ (₪)',recurringTotal),wrapField('מתחיל מתאריך',recurringDate),wrapField('יום חיוב בחודש (1–31)',recurringDay));
      recurringForm.appendChild(recurringFields);
      var recurringSubmit=button('הוסף הוצאה חודשית','vs-finance-primary');recurringSubmit.type='submit';recurringForm.appendChild(recurringSubmit);
      recurringStatus=make('p','vs-finance-status');recurringForm.appendChild(recurringStatus);
      recurringList=make('div','vs-finance-recurring-list');
      recurringSection.append(recurringForm,recurringList);view.appendChild(recurringSection);
      recurringForm.addEventListener('submit',async function(e){e.preventDefault();recalc();if(!recurringForm.reportValidity())return;recurringSubmit.disabled=true;try{
        await mutate('/api/admin/finance/recurring','POST',{description:recurringDesc.value,category:recurringCat.value,amount:recurringTotal.value,maorAmount:recurringMaor.value||'0',galAmount:recurringGal.value||'0',date:recurringDate.value,dayOfMonth:recurringDay.value});
        recurringDesc.value='';recurringMaor.value='';recurringGal.value='';recurringTotal.value='';setStatus(recurringStatus,'ההוצאה החודשית נוספה');await loadRecurring();await loadRows();
      }catch(err){setStatus(recurringStatus,err.message,true);}finally{recurringSubmit.disabled=false;}});
    }else{
      var refundsSection=make('details','vs-finance-panel vs-finance-details');refundsSection.open=true;
      refundsSection.appendChild(make('summary','','זיכויים והחזרים'));
      refundsSection.appendChild(make('p','vs-finance-help','רישום ההחזר אינו מבצע זיכוי בכרטיס. אימות האסמכתה נעשה ידנית אחרי בדיקה במערכת הסליקה HYP. רק החזר שאומת ידנית מופחת מההכנסה נטו.'));
      refundTotals=make('p','vs-finance-refund-totals');refundsSection.appendChild(refundTotals);
      var refundForm=make('form','vs-finance-entry');var refundFields=make('div','vs-finance-entry-grid');
      var refundOrder=input('text',{placeholder:'מספר הזמנה',required:true,maxLength:90});
      var refundAmount=input('number',{min:'0.01',max:'99999999',step:'0.01',placeholder:'0.00',required:true});
      var refundReference=input('text',{placeholder:'מזהה פעולה / אסמכתה',maxLength:140});
      var refundNote=input('text',{placeholder:'סיבת ההחזר',maxLength:400});
      refundFields.append(wrapField('מספר הזמנה ששולמה',refundOrder),wrapField('סכום זיכוי (₪)',refundAmount),wrapField('אסמכתת סליקה (אפשר להשלים בעת האימות)',refundReference),wrapField('הערה',refundNote));
      refundForm.appendChild(refundFields);var refundSubmit=button('רשום החזר ממתין','vs-finance-primary');refundSubmit.type='submit';refundForm.appendChild(refundSubmit);
      refundStatus=make('p','vs-finance-status');refundForm.appendChild(refundStatus);
      refundList=make('div','vs-finance-refund-list');refundsSection.append(refundForm,refundList);view.appendChild(refundsSection);
      var refundPendingKey=null;
      refundForm.addEventListener('submit',async function(e){e.preventDefault();if(!refundForm.reportValidity())return;
        refundPendingKey=refundPendingKey||window.crypto.randomUUID();refundSubmit.disabled=true;
        try{await mutate('/api/admin/finance/refunds','POST',{orderRef:refundOrder.value.trim(),amount:refundAmount.value,providerReference:refundReference.value.trim(),note:refundNote.value.trim(),requestId:refundPendingKey});refundPendingKey=null;refundForm.reset();setStatus(refundStatus,'ההחזר נרשם וממתין לאימות מול חברת הסליקה');await loadRefunds();await loadRows();}
        catch(err){setStatus(refundStatus,err.message,true);}finally{refundSubmit.disabled=false;}
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
    var clearButton=button('נקה','vs-finance-neutral',function(){from.value='';to.value='';state.from='';state.to='';state.offset=0;loadRows().then(function(){if(!expenseMode)loadRefunds();});});
    var pdf=button('ייצוא PDF','vs-finance-primary');
    var csv=button('ייצוא CSV / Excel','vs-finance-neutral',function(){
      var kind=expenseMode?'expenses':'income';
      var params=new URLSearchParams({kind:kind});if(state.from)params.set('from',state.from);if(state.to)params.set('to',state.to);
      window.location.assign('/api/admin/finance/export?'+params.toString());
    });
    var combinedCsv=button('CSV כולל הכנסות והוצאות','vs-finance-neutral',function(){
      var params=new URLSearchParams({kind:'combined'});if(state.from)params.set('from',state.from);if(state.to)params.set('to',state.to);
      window.location.assign('/api/admin/finance/export?'+params.toString());
    });
    filterWrap.append(fromField,toField,filterButton,clearButton,pdf,csv,combinedCsv);
    toolbar.append(heading,filterWrap);panel.appendChild(toolbar);
    var status=make('p','vs-finance-status');status.setAttribute('role','status');panel.appendChild(status);
    var scroll=make('div','vs-finance-scroll');
    var table=make('table','vs-finance-table');
    var thead=make('thead'),headRow=make('tr');
    (expenseMode?['תאריך','תיאור ההוצאה','קטגוריה','מאור','גל','סה״כ','עובד מדווח','מצב / פעולות']:['תאריך תשלום','מספר הזמנה','הכנסה','פרטי הזמנה']).forEach(function(v){headRow.appendChild(make('th','',v));});
    thead.appendChild(headRow);var tbody=make('tbody');table.append(thead,tbody);scroll.appendChild(table);panel.appendChild(scroll);
    var pagination=make('div','vs-finance-pagination');
    var previous=button('הקודם','vs-finance-neutral',function(){state.offset=Math.max(0,state.offset-PAGE_SIZE);loadRows();});
    var pageLabel=make('span','','');
    var next=button('הבא','vs-finance-neutral',function(){state.offset+=PAGE_SIZE;loadRows();});
    pagination.append(previous,pageLabel,next);panel.appendChild(pagination);
    view.appendChild(panel);root.replaceChildren(view);

    filterWrap.addEventListener('submit',function(event){event.preventDefault();if(from.value&&to.value&&from.value>to.value){setStatus(status,'תאריך התחלה חייב להיות לפני תאריך הסיום',true);return;}state.from=from.value;state.to=to.value;state.offset=0;loadRows().then(function(){if(!expenseMode)loadRefunds();});});
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
          {key:'maor',label:'מאור (₪)'},{key:'gal',label:'גל (₪)'},
          {key:'amount',label:'סה״כ (₪)'},{key:'employee',label:'עובד מדווח'}
        ]:[{key:'date',label:'תאריך תשלום'},{key:'order',label:'מספר הזמנה'},{key:'amount',label:'סכום (₪)'}];
        var rows=items.map(function(item){return expenseMode?{
          date:prettyDate(item.expense_date),description:item.description,category:item.category,
          maor:item.maor_agorot==null?'לא משויך':money(item.maor_agorot),
          gal:item.gal_agorot==null?'לא משויך':money(item.gal_agorot),
          amount:money(item.amount_agorot),employee:item.employee_name
        }:{date:prettyTime(item.paid_at),order:item.order_ref,amount:money(item.amount_agorot)};});
        if(expenseMode && result){
          rows.push({date:'',description:'סה״כ בתקופה',category:'',maor:money(result.maorAgorot),gal:money(result.galAgorot),amount:money(result.totalAgorot),employee:''});
          rows.push({date:'',description:'מאזן (גל - מאור)',category:'',maor:'',gal:'',amount:money(Number(result.galAgorot||0)-Number(result.maorAgorot||0)),employee:''});
        }
        await window.VersansReportPDF.download({title:expenseMode?'דו״ח הוצאות':'דו״ח הכנסות',columns:columns,rows:rows,generatedAt:Date.now()},columns.map(function(c){return c.key;}),{type:expenseMode?'expenses':'income',from:state.from,to:state.to,forceTable:true});
        setStatus(status,'הדוח הופק עם '+number.format(rows.length)+' רשומות.');
      }catch(err){setStatus(status,err.message||'לא ניתן להפיק PDF',true);}finally{pdf.disabled=false;pdf.textContent='ייצוא PDF';}
    });

    async function loadRows(){
      setStatus(status,'טוען רשומות…');
      try{
        var data=await request(type,state,PAGE_SIZE,state.offset);
        sum.textContent=money(data.totalAgorot);count.textContent=number.format(data.total);
        pdf.hidden=!data.canExport;csv.hidden=!data.canExport;combinedCsv.hidden=!data.canCombinedExport;
        if(!expenseMode){incomeRefunds.textContent=money(data.confirmedRefundAgorot);incomeNet.textContent=money(data.netIncomeAgorot);refundCanManage=!!data.canRefund;refundForm.hidden=!refundCanManage;}
        if(expenseMode){
          maorTotal.textContent=money(data.maorAgorot);
          galTotal.textContent=money(data.galAgorot);
          balanceTotal.textContent=money(Number(data.galAgorot||0)-Number(data.maorAgorot||0));
          var notAllocated=Number(data.unallocatedAgorot||0);
          recurringCanManage=!!data.canRecurring;recurringForm.hidden=!recurringCanManage;
          canCreateExpense=!!data.canCreate;form.hidden=!canCreateExpense&&!editingId;
          if(categoryList){categoryList.replaceChildren();(data.categories||[]).forEach(function(c){var el=make('div','vs-finance-category');el.append(make('span','',c.category+' · '+number.format(c.count)+' רשומות'),make('strong','',money(c.amount_agorot)));categoryList.appendChild(el);});}
          unallocatedInfo.textContent=notAllocated?'הוצאות ללא שיוך למאור/גל (כולל תשלומים אוטומטיים ליוצרים): '+money(notAllocated)+'. אינן נספרות במאזן האישי.':'';
        }
        tbody.replaceChildren();
        (data.rows||[]).forEach(function(item){
          var row=make('tr');
          if(expenseMode){
            if(item.cancelled_at)row.classList.add('vs-finance-is-cancelled');
            [prettyDate(item.expense_date),item.description,item.category,
              item.maor_agorot==null?'—':money(item.maor_agorot),
              item.gal_agorot==null?'—':money(item.gal_agorot),
              money(item.amount_agorot),item.employee_name].forEach(function(v,index){row.appendChild(make('td',[3,4,5].includes(index)?'vs-finance-money':'',v));});
            var actions=make('td','vs-finance-row-actions');
            actions.appendChild(make('span','vs-finance-state '+(item.cancelled_at?'is-cancelled':''),item.cancelled_at?'בוטל · '+(item.cancel_reason||''):'פעיל'));
            if(!item.cancelled_at){
              if(data.canEdit){actions.appendChild(button('ערוך','vs-finance-neutral vs-finance-small',function(){
                editingId=item.id;form.hidden=false;formTitle.textContent='עריכת הוצאה #'+item.id;description.value=item.description;
                if(!Array.from(category.options).some(function(o){return o.value===item.category;})){var extra=make('option','',item.category);extra.value=item.category;category.appendChild(extra);}
                category.value=item.category;maorInput.value=item.maor_agorot==null?'':(item.maor_agorot/100).toFixed(2);
                galInput.value=item.gal_agorot==null?'':(item.gal_agorot/100).toFixed(2);
                if(item.maor_agorot==null&&item.gal_agorot==null){maorInput.value='';galInput.value='';amount.readOnly=false;amount.value=(item.amount_agorot/100).toFixed(2);}
                else{amount.readOnly=true;updateAmount();}
                expenseDate.value=item.expense_date;editCancel.hidden=false;submit.textContent='שמור שינויים';form.scrollIntoView({behavior:'smooth',block:'center'});
              }));}
              if(data.canCancel){actions.appendChild(button('בטל הוצאה','vs-finance-neutral vs-finance-small',async function(){
                var reason=dialogReason('מדוע לבטל את ההוצאה? הסיבה תישמר לצמיתות ביומן.');if(reason===null)return;
                try{await mutate('/api/admin/finance/expenses/'+item.id,'DELETE',{reason:reason});await loadRows();setStatus(status,'ההוצאה בוטלה ונותרה ביומן לתיעוד');}catch(err){setStatus(status,err.message,true);}
              }));}
            }
            actions.appendChild(button('היסטוריה','vs-finance-neutral vs-finance-small',async function(){
              try{var response=await fetch('/api/admin/finance/expenses/'+item.id,{credentials:'same-origin'});var body=await response.json();if(!response.ok)throw new Error('לא ניתן לטעון היסטוריה');
                var history=(body.history||[]).map(function(h){return prettyTime(h.created_at)+' · '+h.actor_name+' · '+(h.action==='edit'?'עריכה':'ביטול')+(h.reason?' · '+h.reason:'');});
                window.alert(history.length?history.join('\n'):'אין שינויים מתועדים להוצאה זו');
              }catch(err){setStatus(status,err.message,true);}
            }));row.appendChild(actions);
          }else{
            row.appendChild(make('td','',prettyTime(item.paid_at)));
            row.appendChild(make('td','vs-finance-ref',item.order_ref));
            row.appendChild(make('td','vs-finance-money',money(item.amount_agorot)));
            var cell=make('td');var link=make('a','vs-finance-order-link','פרטים מלאים ←');link.href='/admin/order-work?order='+encodeURIComponent(item.order_ref);cell.appendChild(link);row.appendChild(cell);
          }
          tbody.appendChild(row);
        });
        if(!data.rows.length){var row=make('tr'),td=make('td','vs-finance-empty','אין רשומות בטווח שנבחר');td.colSpan=expenseMode?8:4;row.appendChild(td);tbody.appendChild(row);}
        var start=data.total?state.offset+1:0;
        pageLabel.textContent=number.format(start)+'–'+number.format(Math.min(state.offset+data.rows.length,data.total))+' מתוך '+number.format(data.total);
        previous.disabled=state.offset===0;next.disabled=state.offset+data.rows.length>=data.total;
        setStatus(status,'');
      }catch(err){setStatus(status,err.message||'טעינת הנתונים נכשלה',true);}
    }
    async function loadRecurring(){
      if(!recurringList)return;
      try{var response=await fetch('/api/admin/finance/recurring',{credentials:'same-origin'}),data=await response.json();
        if(!response.ok)throw new Error('לא ניתן לטעון הוצאות קבועות');recurringList.replaceChildren();
        if(!data.items.length)recurringList.appendChild(make('p','vs-finance-help','לא הוגדרו עדיין הוצאות קבועות.'));
        data.items.forEach(function(r){var row=make('div','vs-finance-recurring-item');
          row.append(make('strong','',r.description+' · '+money(r.amount_agorot)),make('span','',r.category+' · בכל חודש ביום '+r.day_of_month+' · החל מ-'+prettyDate(r.start_date)));
          var toggle=button(r.active?'השהה':'חדש','vs-finance-neutral vs-finance-small',async function(){
            toggle.disabled=true;try{await mutate('/api/admin/finance/recurring/'+r.id,'PATCH',{active:!r.active});await loadRecurring();await loadRows();}catch(err){setStatus(recurringStatus,err.message,true);}finally{toggle.disabled=false;}
          });if(recurringCanManage)row.appendChild(toggle);recurringList.appendChild(row);
        });
      }catch(err){setStatus(recurringStatus,err.message,true);}
    }
    async function loadRefunds(){
      if(!refundList)return;
      try{var data=await request('refunds',state,150,0);refundList.replaceChildren();
        refundTotals.textContent='זיכויים מאומתים: '+money(data.confirmedAgorot)+' · ממתינים לאימות: '+money(data.pendingAgorot);
        if(!data.rows.length){refundList.appendChild(make('p','vs-finance-help','אין החזרים בתקופה שנבחרה.'));return;}
        if(data.total>150)refundList.appendChild(make('p','vs-finance-help','מוצגים 150 ההחזרים האחרונים; ניתן לייצא את כל ההחזרים לקובץ CSV.'));
        var table=make('table','vs-finance-table vs-finance-refund-table');var tr=make('tr');['תאריך','הזמנה','סכום','אסמכתה','מצב','פעולות'].forEach(function(t){tr.appendChild(make('th','',t));});var th=make('thead');th.appendChild(tr);table.appendChild(th);var tbody=make('tbody');
        data.rows.forEach(function(item){var tr=make('tr');[prettyTime(item.status==='confirmed'&&item.confirmed_at?item.confirmed_at:item.created_at),item.order_ref,money(item.amount_agorot),item.provider_reference||'—',item.cancelled_at?'בוטל':item.status==='confirmed'?'אומת ידנית':'ממתין לאימות'].forEach(function(t){tr.appendChild(make('td','',t));});
          var actions=make('td','vs-finance-row-actions');if(!item.cancelled_at&&refundCanManage){
            if(item.status==='pending'){actions.appendChild(button('אמת לפי אסמכתה','vs-finance-neutral vs-finance-small',async function(){
              var ref=window.prompt('הכנס אסמכתת זיכוי שאימתת ידנית במערכת HYP:',item.provider_reference||'');if(ref===null)return;
              if(!window.confirm('האם בדקת שחברת הסליקה ביצעה בפועל את הזיכוי?'))return;
              try{await mutate('/api/admin/finance/refunds/'+item.id,'PATCH',{action:'confirm',providerReference:ref.trim()});await loadRefunds();await loadRows();}catch(err){setStatus(refundStatus,err.message,true);}
            }));}
            actions.appendChild(button('בטל רישום','vs-finance-neutral vs-finance-small',async function(){var reason=dialogReason('סיבת ביטול רישום ההחזר (אינו מבטל פעולה בחברת הסליקה):');if(reason===null)return;try{await mutate('/api/admin/finance/refunds/'+item.id,'PATCH',{action:'cancel',reason:reason});await loadRefunds();await loadRows();}catch(err){setStatus(refundStatus,err.message,true);}}));
          }tr.appendChild(actions);tbody.appendChild(tr);
        });table.appendChild(tbody);var scroll=make('div','vs-finance-scroll');scroll.appendChild(table);refundList.appendChild(scroll);
      }catch(err){setStatus(refundStatus,err.message,true);}
    }
    await loadRows();
    if(expenseMode)await loadRecurring();else await loadRefunds();
  }
  window.VersansFinance={render:render};
})();
