(function(){
  'use strict';
  var apiBase='/api/admin/';
  function el(tag,klass,value){var x=document.createElement(tag);if(klass)x.className=klass;if(value!==undefined)x.textContent=String(value);return x;}
  function add(parent){for(var i=1;i<arguments.length;i++){if(arguments[i]!==null&&arguments[i]!==undefined)parent.append(arguments[i]);}return parent;}
  function get(path){return fetch(apiBase+path,{credentials:'same-origin',headers:{Accept:'application/json'}}).then(async function(r){var d=await r.json().catch(function(){return {};});if(!r.ok)throw Error(d.error||'request_failed');return d;});}
  async function save(path,method,body){var r=await fetch(apiBase+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body||{})});var d=await r.json().catch(function(){return {};});if(!r.ok)throw Error(d.error||'request_failed');return d;}
  function button(label,klass,fn){var b=el('button','admin-tools-btn '+(klass||''),label);b.type='button';if(fn)b.addEventListener('click',fn);return b;}
  function field(labelText,type,value,placeholder){var wrap=el('label','admin-tools-field');add(wrap,el('span','',labelText));var inp=el(type==='textarea'?'textarea':'input');if(type!=='textarea')inp.type=type||'text';inp.value=value||'';if(placeholder)inp.placeholder=placeholder;wrap.append(inp);return {wrap,input:inp};}
  function pick(label,options,value){var wrap=el('label','admin-tools-field');wrap.appendChild(el('span','',label));var sel=el('select');options.forEach(function(o){var opt=el('option','',o[1]);opt.value=o[0];sel.append(opt);});sel.value=value||options[0][0];wrap.append(sel);return {wrap,input:sel};}
  function pill(label,cls){return el('span','admin-tools-pill '+(cls||''),label);}
  var TYPES=[['bug','תקלה'],['feature','משהו שצריך להוסיף'],['improvement','שיפור'],['other','אחר']];
  var STATUSES=[['open','פתוחה'],['in_progress','בטיפול'],['blocked','ממתינה'],['done','הושלמה']];
  var PRIORITIES=[['low','נמוכה'],['normal','רגילה'],['high','גבוהה'],['urgent','דחופה']];
  function labelOf(options,value){var found=options.find(function(x){return x[0]===value;});return found?found[1]:value;}
  function shortDate(value){if(!value)return '-';var n=Number(value);try{return new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeZone:'Asia/Jerusalem'}).format(new Date(n));}catch(_){return '-';}}
  function showMessage(root,text,good){var n=root.querySelector('.admin-tools-message');if(!n){n=el('p','admin-tools-message');root.prepend(n);}n.className='admin-tools-message '+(good?'is-ok':'is-error');n.textContent=text;}
  function openModal(title,fill){
    var shade=el('div','admin-tools-backdrop');var dialog=el('section','admin-tools-modal');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
    var heading=el('div','admin-tools-modal-heading');add(heading,el('h3','',title));
    var close=button('×','is-icon',dismiss);close.setAttribute('aria-label','סגור');heading.append(close);dialog.append(heading);
    shade.append(dialog);document.body.append(shade);document.body.style.overflow='hidden';
    function dismiss(){shade.remove();document.body.style.overflow='';document.removeEventListener('keydown',onKey);}
    function onKey(e){if(e.key==='Escape'){dismiss();}else if(e.key==='Tab'){var all=Array.from(dialog.querySelectorAll('button,input,select,textarea')).filter(function(x){return !x.disabled;});if(!all.length)return;var i=all.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();all[all.length-1].focus();}else if(!e.shiftKey&&i===all.length-1){e.preventDefault();all[0].focus();}}}
    shade.addEventListener('click',function(e){if(e.target===shade)dismiss();});document.addEventListener('keydown',onKey);
    fill(dialog,dismiss);close.focus();
  }
  var cachedAssignees=null;
  async function loadAssignees() {
    if(cachedAssignees)return cachedAssignees;
    var result=await get('internal-tasks/assignees');
    cachedAssignees=Array.isArray(result.assignees)?result.assignees:[];
    return cachedAssignees;
  }
  function taskEditor(current,onSaved,canAssign){
    openModal(current?'עריכת משימה':'משימה חדשה',function(panel,close){
      var title=field('שם המשימה *','text',current&&current.title,'מה צריך לעשות?');title.input.maxLength=180;
      var desc=field('תיאור ופרטים','textarea',current&&current.description,'מה הבעיה, איך לשחזר ומה צריך להוסיף?');desc.input.rows=5;
      var kind=pick('סוג',TYPES,current&&current.type),priority=pick('עדיפות',PRIORITIES,current&&current.priority),status=pick('סטטוס',STATUSES,current&&current.status);
      var assign=pick('שיוך לעובד (התראות Push)',[['','ללא אחראי']],'');
      assign.input.disabled=true;
      var existing=String(current&&current.assignedTo||'').trim().toLowerCase();
      if(canAssign)loadAssignees().then(function(list){
        list.forEach(function(a){var opt=el('option','',a.name+' ('+a.email+')');opt.value=a.email.toLowerCase();assign.input.append(opt);});
        if(existing && !list.some(function(a){return a.email.toLowerCase()===existing;})){
          var legacy=el('option','',existing+' (לא חשבון עובד פעיל)');legacy.value=existing;assign.input.append(legacy);
        }
        assign.input.value=existing;
        assign.input.disabled=false;
      }).catch(function(err){assign.wrap.append(el('small','admin-tools-inline-error','לא ניתן לטעון עובדים: '+err.message));});
      else {assign.input.disabled=true;assign.input.value=existing;assign.wrap.hidden=true;}
      var due=field('תאריך יעד','date',current&&current.dueDate);var grid=el('div','admin-tools-form-grid');add(grid,kind.wrap,priority.wrap,status.wrap,assign.wrap,due.wrap);
      var form=el('form','admin-tools-form');add(form,title.wrap,desc.wrap,grid);var error=el('p','admin-tools-inline-error');var foot=el('div','admin-tools-modal-actions');var cancel=button('ביטול','is-secondary',close),submit=button(current?'שמור שינויים':'הוסף משימה','is-primary');submit.type='submit';foot.append(cancel,submit);add(form,error,foot);panel.append(form);
      form.addEventListener('submit',async function(e){e.preventDefault();if(!title.input.value.trim()){error.textContent='חובה להזין שם משימה';title.input.focus();return;}
        var payload={title:title.input.value.trim(),description:desc.input.value.trim(),type:kind.input.value,status:status.input.value,priority:priority.input.value,assignedTo:assign.input.value.trim(),dueDate:due.input.value};
        if(canAssign && assign.input.disabled){error.textContent='יש להמתין לטעינת רשימת העובדים';return;}if(current)payload.updatedAt=current.updatedAt;submit.disabled=true;submit.textContent='שומר…';
        try{await save('internal-tasks'+(current?'/'+current.id:''),current?'PATCH':'POST',payload);close();await onSaved();}
        catch(err){error.textContent=err.message==='task_changed'?'המשימה שונתה בינתיים על ידי משתמש אחר. רענן את הרשימה ונסה שוב.':'לא ניתן לשמור את המשימה: '+err.message;submit.disabled=false;submit.textContent=current?'שמור שינויים':'הוסף משימה';}
      });
    });
  }
  var selectedTaskTab='open';
  async function renderTasks(root){
    var tasks=[],canManage=false,canCreate=false,canEdit=false,canAssign=false,canDelete=false,canChangeStatus=false;
    try{
      var data=await get('internal-tasks');tasks=data.tasks||[];
      canManage=data.canManage===true;canCreate=data.canCreate===true;canEdit=data.canEdit===true;
      canAssign=data.canAssign===true;canDelete=data.canDelete===true;canChangeStatus=data.canChangeStatus===true;
    }catch(err){root.replaceChildren(el('div','admin-tools-error','לא ניתן לטעון משימות: '+err.message));return;}
    var view=el('div','admin-tools-page');var top=el('div','admin-tools-title-row');
    add(top,add(el('div'),el('h2','','ניהול משימות פנימי'),el('p','','המשימות מחולקות לפי סטטוס. בחר את הלשונית הרצויה.')));
    if(canCreate)top.append(button('+ משימה חדשה','is-primary',function(){taskEditor(null,function(){return renderTasks(root);},canAssign);}));
    view.append(top);
    var tabs=el('div','admin-tools-status-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','סינון משימות לפי סטטוס');
    var search=field('חיפוש משימות','search','','חיפוש לפי כותרת, תיאור או אחראי');
    var controls=el('div','admin-tools-controls');var type=pick('סוג',[['all','כל הסוגים']].concat(TYPES),'all');var priority=pick('עדיפות',[['all','כל העדיפויות']].concat(PRIORITIES),'all');
    add(controls,search.wrap,type.wrap,priority.wrap);view.append(tabs,controls);
    var summary=el('div','admin-tools-summary');view.append(summary);var list=el('div','admin-tools-task-list');view.append(list);
    function changeTab(next){selectedTaskTab=next;draw();}
    function draw(){
      tabs.replaceChildren();
      STATUSES.forEach(function(pair){var count=tasks.filter(function(t){return t.status===pair[0];}).length;var tab=button(pair[1]+' ('+count+')',selectedTaskTab===pair[0]?'is-active':'',function(){changeTab(pair[0]);});tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(selectedTaskTab===pair[0]));tabs.append(tab);});
      list.replaceChildren();var q=search.input.value.trim().toLowerCase();
      var filtered=tasks.filter(function(t){return t.status===selectedTaskTab&&(type.input.value==='all'||t.type===type.input.value)&&(priority.input.value==='all'||t.priority===priority.input.value)&&(!q||[t.title,t.description,t.assignedTo].join(' ').toLowerCase().includes(q));});
      summary.textContent='סה״כ '+tasks.length+' משימות · '+filtered.length+' בתצוגה';
      if(!filtered.length){list.append(el('div','admin-tools-empty','אין משימות בסטטוס הזה המתאימות לסינון.'));return;}
      filtered.forEach(function(task){
        var card=el('article','admin-tools-task '+(task.status==='done'?'is-done':''));var head=el('div','admin-tools-task-heading');var label=el('div','admin-tools-task-title');add(label,el('h3','',task.title));
        var badges=el('div','admin-tools-task-badges');add(badges,pill(labelOf(PRIORITIES,task.priority),'priority-'+task.priority),pill(labelOf(TYPES,task.type)));
        head.append(label,badges);card.append(head);
        if(task.description)card.append(el('p','admin-tools-task-description',task.description));
        card.append(el('p','admin-tools-task-meta',('נוצר: '+shortDate(task.createdAt))+(task.dueDate?' · יעד: '+task.dueDate:'')+(task.assignedTo?' · אחראי: '+task.assignedTo:'')));
        var actions=el('div','admin-tools-task-actions');
        if(canEdit){actions.append(button('ערוך','is-secondary',function(){taskEditor(task,function(){return renderTasks(root);},canAssign);}));}
        if(canChangeStatus||canEdit){
          var change=pick('שנה סטטוס',STATUSES,task.status);change.wrap.classList.add('admin-tools-task-status');
          change.input.addEventListener('change',async function(){change.input.disabled=true;try{await save('internal-tasks/'+task.id,'PATCH',{updatedAt:task.updatedAt,status:change.input.value});selectedTaskTab=change.input.value;await renderTasks(root);}catch(err){change.input.value=task.status;change.input.disabled=false;showMessage(root,'לא ניתן לשנות סטטוס: '+err.message);}});
          actions.append(change.wrap);
        }
        if(canAssign)actions.append(button('שייך לעובד','is-secondary',function(){
          openModal('שיוך משימה',function(modal,close){
            var assign=pick('אחראי חדש',[['','ללא אחראי']],'');assign.input.disabled=true;
            loadAssignees().then(function(list){list.forEach(function(a){var option=el('option','',a.name+' ('+a.email+')');option.value=a.email;assign.input.append(option);});assign.input.value=task.assignedTo||'';assign.input.disabled=false;}).catch(function(){showMessage(modal,'לא ניתן לטעון עובדים');});
            var foot=el('div','admin-tools-modal-actions'),submit=button('עדכן שיוך','is-primary',async function(){
              submit.disabled=true;try{await save('internal-tasks/'+task.id,'PATCH',{status:task.status,assignedTo:assign.input.value,updatedAt:task.updatedAt});close();await renderTasks(root);}catch(e){showMessage(modal,'לא ניתן לשייך: '+e.message);submit.disabled=false;}
            });foot.append(button('ביטול','is-secondary',close),submit);modal.append(assign.wrap,foot);
          });
        }));
        if(canDelete)actions.append(button('מחק','is-danger',function(){openModal('מחיקת משימה',function(modal,close){add(modal,el('p','admin-tools-confirm','למחוק את המשימה „'+task.title+'”? פעולה זו לא ניתנת לביטול.'));var footer=el('div','admin-tools-modal-actions');add(footer,button('ביטול','is-secondary',close),button('מחק משימה','is-danger',async function(){try{await save('internal-tasks/'+task.id,'DELETE',{updatedAt:task.updatedAt});close();await renderTasks(root);}catch(err){showMessage(modal,'מחיקה נכשלה: '+err.message);}}));modal.append(footer);});}));
        if(actions.children.length)card.append(actions);list.append(card);
      });
    }
    [search.input,type.input,priority.input].forEach(function(input){input.addEventListener('input',draw);input.addEventListener('change',draw);});draw();root.replaceChildren(view);
  }
  var REPORT_TYPES=[['finance','הכנסות והוצאות (משולב)'],['income','הכנסות'],['expenses','הוצאות'],['orders','הזמנות'],['sales','מכירות יומיות'],['products','מוצרים'],['customers','לקוחות'],['shipments','משלוחים'],['reviews','ביקורות'],['visitors','מבקרים'],['creators','יוצרי תוכן'],['tiktok','סרטוני TikTok'],['tasks','משימות פנימיות'],['handling_hours','שעות טיפול בהזמנות'],['employee_performance','ביצועי עובדים'],['traffic_conversion','המרות לפי מקור תנועה'],['period_comparison','השוואת חודשים ושנים']];
  var FIELD_OPTIONS={
    income:[['date','תאריך תשלום'],['order','מספר הזמנה'],['amount','סכום']],
    expenses:[['date','תאריך'],['description','תיאור ההוצאה'],['category','קטגוריה'],['maor','מאור'],['gal','גל'],['amount','סה״כ'],['employee','עובד מדווח']],
    finance:[['date','תאריך'],['kind','סוג'],['details','תיאור / מספר הזמנה'],['income','הכנסה'],['expense','הוצאה'],['maor','מאור'],['gal','גל']],
    orders:[['ref','מספר הזמנה'],['customer','לקוח'],['email','אימייל'],['phone','טלפון'],['status','סטטוס'],['amount','סכום'],['date','תאריך'],['items','מוצרים']],
    sales:[['date','תאריך'],['orders','הזמנות'],['revenue','הכנסות']],
    products:[['id','מזהה'],['title','שם'],['price','מחיר'],['category','קטגוריות'],['hidden','מוסתר'],['availability','מלאי']],
    customers:[['name','שם'],['email','אימייל'],['phone','טלפון'],['role','תפקיד'],['joined','תאריך הרשמה'],['orders','הזמנות'],['spend','רכישות']],
    shipments:[['tracking','מעקב'],['ref','הזמנה'],['status','סטטוס'],['location','מיקום'],['event','אירוע'],['date','תאריך']],
    reviews:[['name','שם'],['product','מוצר'],['rating','דירוג'],['status','סטטוס'],['comment','ביקורת'],['date','תאריך']],
    visitors:[['visitor','מזהה מבקר'],['path','עמוד'],['device','מכשיר'],['browser','דפדפן'],['views','צפיות'],['date','תאריך']],
    creators:[['name','שם'],['email','אימייל'],['code','קוד אישי'],['discount','הנחה'],['commission','עמלה'],['username','טיקטוק'],['rate','₪ לאלף צפיות'],['active','פעיל']],
    tiktok:[['creator','יוצר'],['username','טיקטוק'],['url','קישור'],['status','סטטוס'],['views','צפיות'],['rate','₪ לאלף צפיות'],['date','בדיקה אחרונה']],
    handling_hours:[['order','הזמנה'],['employee','עובד'],['date','תאריך'],['hours','שעות'],['minutes','דקות']],
    employee_performance:[['employee','עובד'],['actions','פעולות'],['orders','הזמנות שטופלו'],['completed','סיום טיפול'],['tasks','משימות שהושלמו'],['minutes','דקות מדודות'],['sessions','מקטעי עבודה']],
    traffic_conversion:[['source','מקור'],['visitors','מבקרים'],['buyers','רוכשים'],['orders','הזמנות'],['conversion','המרה'],['revenue','הכנסות משויכות']],
    period_comparison:[['period','תקופה'],['orders','הזמנות'],['gross','ברוטו'],['refunds','החזרים'],['expenses','הוצאות'],['net','יתרה']],
    tasks:[['title','כותרת'],['description','תיאור'],['type','סוג'],['status','סטטוס'],['priority','עדיפות'],['assignedTo','אחראי'],['dueDate','יעד'],['updatedAt','עדכון אחרון']]
  };
  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function reportPage(data,selected,params){
    var colMap=new Map(data.columns.map(function(c){return [c.key,c.label];}));
    var names=selected.filter(function(k){return colMap.has(k);});
    var range=(params.from||params.to)?'טווח: '+(params.from||'התחלה')+' עד '+(params.to||'היום'):'כל התאריכים';
    var note=data.truncated?'הדוח מציג עד '+data.limit+' רשומות. לסינון נוסף השתמש בטווח תאריכים.':'';
    var isCards=names.length>4;
    var summary=Array.isArray(data.summary)?data.summary:[];
    var summaryHtml=summary.length?'<div class="report-summary">'+summary.map(function(item){return '<div><span>'+escapeHtml(item.label)+'</span><strong>'+escapeHtml(item.value)+'</strong></div>';}).join('')+'</div>':'';
    var contents='';
    if(isCards){
      contents=data.rows.map(function(row,i){
        var cells=names.map(function(k){return '<div class="entry-field"><span class="entry-label">'+escapeHtml(colMap.get(k))+'</span><span class="entry-value">'+escapeHtml(row[k])+'</span></div>';}).join('');
        return '<section class="entry"><div class="entry-title">רשומה '+(i+1)+'</div><div class="entry-fields">'+cells+'</div></section>';
      }).join('');
    }else{
      var head=names.map(function(k){return '<th>'+escapeHtml(colMap.get(k))+'</th>';}).join('');
      var body=data.rows.map(function(row){return '<tr>'+names.map(function(k){return '<td>'+escapeHtml(row[k])+'</td>';}).join('')+'</tr>';}).join('');
      contents='<table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table>';
    }
    if(!data.rows.length)contents='<p class="empty">אין נתונים בטווח שנבחר.</p>';
    return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>VerSans · '+escapeHtml(data.title)+'</title><style>'+ 
      '@page{size:A4 portrait;margin:12mm}*,*:before,*:after{box-sizing:border-box}html{direction:rtl}'+
      'body{max-width:186mm;margin:12px auto;padding:0;font:12px/1.55 Arial,system-ui,sans-serif;color:#142333;background:#fff}'+
      'header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #142333;padding-bottom:10px;gap:12px}'+
      'header strong{font:700 26px Georgia,serif;letter-spacing:1px}header small{font-size:10px;color:#667789}'+
      'h1{font-size:21px;margin:15px 0 8px}.meta{color:#586579;margin:0 0 16px;font-size:11px}.warn{color:#9b501c;font-weight:700}'+
      'table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}'+
      'th,td{border:1px solid #d5dfe6;padding:7px 6px;text-align:right;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}'+
      'th{background:#e7edf2}tr:nth-child(even){background:#f8fafb}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}'+
      '.entry{border:1px solid #d5dfe6;border-radius:7px;margin-bottom:10px;break-inside:avoid;page-break-inside:avoid;overflow:hidden}'+
      '.entry-title{padding:6px 12px;background:#e7edf2;font-weight:700}.entry-fields{display:grid;grid-template-columns:1fr 1fr}'+
      '.entry-field{padding:7px 10px;border-top:1px solid #e2e9ed;min-width:0;display:grid;gap:2px;overflow-wrap:anywhere}'+
      '.entry-label{font-size:10px;color:#657483;font-weight:700}.entry-value{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}'+
      '.report-summary{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}.report-summary>div{display:grid;gap:3px;border:1px solid #d5dfe6;border-radius:7px;padding:7px 10px;min-width:125px;background:#f8fafb}.report-summary span{font-size:10px;color:#657483}.report-summary strong{font-size:12px}'+
      '.empty{border:1px dashed #d6dde4;padding:18px;color:#657483;text-align:center}'+
      '.print-toolbar{position:sticky;top:0;text-align:left;background:#fff;padding:10px 0;border-bottom:1px solid #e4e9ed;margin-bottom:12px}'+
      '.print-toolbar button{background:#142333;color:#fff;padding:10px 16px;border:0;border-radius:8px;font-size:14px;cursor:pointer}'+
      '@media print{body{max-width:initial;margin:0}.print-toolbar{display:none}thead{display:table-header-group}'+
      'th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact}.entry{break-inside:avoid}}'+
      '</style></head><body><div class="print-toolbar"><button type="button" onclick="window.print()">הדפס</button></div>'+ 
      '<header><strong>VERSANS</strong><small>דוח ניהול פנימי · לעיון מורשים בלבד</small></header>'+ 
      '<h1>'+escapeHtml(data.title)+'</h1><p class="meta">'+escapeHtml(range)+' · '+data.rows.length+' רשומות · הופק: '+
      escapeHtml(new Date(data.generatedAt).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}))+'</p>'+ 
      (note?'<p class="warn">'+escapeHtml(note)+'</p>':'')+summaryHtml+contents+
      '</body></html>';
  }
  async function renderReports(root){
    var me;
    try{me=await get('employees/me');}catch(err){root.replaceChildren(el('div','admin-tools-error','לא ניתן לטעון הרשאות לדוחות.'));return;}
    var permissions=me.role==='staff'?me.permissions:[];
    var has=function(key){return me.role!=='staff'||permissions.indexOf(key)>=0;};
    var sourcePermissions={finance:['income.view','expenses.view'],income:['income.view'],expenses:['expenses.view'],orders:['orders.view'],sales:['sales.view'],products:['products.view'],customers:['customers.view'],shipments:['orders.view'],reviews:['reviews.view'],visitors:['visitors.view'],creators:['creators.view'],tiktok:['creators.view'],tasks:['tasks.view'],handling_hours:['orders.view'],employee_performance:['employees.view'],traffic_conversion:['visitors.view','sales.view'],period_comparison:['sales.view','expenses.view']};
    var sensitive=['orders','customers','shipments','visitors','creators'];
    var allowedReports=REPORT_TYPES.filter(function(pair){return (sourcePermissions[pair[0]]||[]).every(has)&&(!sensitive.includes(pair[0])||has('reports.sensitive'));});
    var mayExport=has('reports.export'),maySchedule=has('reports.schedule')&&mayExport;
    if(!allowedReports.length){root.replaceChildren(el('div','admin-tools-empty','אין לך הרשאה להפקת סוגי הדוחות האלה.'));return;}
    var view=el('div','admin-tools-page');add(view,el('h2','','דוחות וייצוא'),el('p','admin-tools-lead','בחירת דוח, טווח תאריכים ועמודות; הורדה כ-PDF, CSV או Excel. הנתונים הרגישים מוגנים בהרשאה נוספת.'));
    if(!mayExport)view.append(el('p','admin-tools-message','יש לך הרשאת צפייה במסך הדוחות, אבל אין לך הרשאה להוריד נתונים. יש לפנות למנהל.'));
    var form=el('div','admin-tools-export-form'),type=pick('סוג הדוח',allowedReports,allowedReports[0][0]),from=field('מתאריך (כולל)','date'),to=field('עד תאריך (כולל)','date'),limit=pick('מספר רשומות מרבי',[['100','100'],['300','300'],['500','500'],['1000','1,000'],['2000','2,000']],'500');
    add(form,type.wrap,from.wrap,to.wrap,limit.wrap);view.append(form);
    var groups=pick('השוואה לפי',[['month','חודשים'],['year','שנים']],'month');groups.wrap.classList.add('admin-tools-comparison');view.append(groups.wrap);
    var fields=el('div','admin-tools-export-fields');view.append(el('h3','','עמודות הדוח'),fields);
    var dateNote=el('p','admin-tools-export-note','לדוח מוצרים אין תאריך היסטורי, ולכן בחירת טווח אינה זמינה.');view.append(dateNote);
    function showFields(){fields.replaceChildren();(FIELD_OPTIONS[type.input.value]||[]).forEach(function(c){var lbl=el('label','admin-tools-field-chip'),check=el('input');check.type='checkbox';check.value=c[0];check.checked=true;add(lbl,check,el('span','',c[1]));fields.append(lbl);});}
    function updateInputs(){var noDate=type.input.value==='products';from.wrap.hidden=to.wrap.hidden=noDate;dateNote.hidden=!noDate;groups.wrap.hidden=type.input.value!=='period_comparison';if(noDate){from.input.value='';to.input.value='';}}
    type.input.addEventListener('change',function(){showFields();updateInputs();});showFields();updateInputs();
    view.append(el('p','admin-tools-export-note','דוח שעות טיפול מודד רק זמן שנפתח ונסגר במפורש במסך טיפול בהזמנות. דוח המרות מבוסס על מזהי מבקרים המקושרים להזמנות, ולכן עלול להיות חלקי.'));
    var buttons=el('div','admin-tools-report-actions');var pdf=button('שמור PDF','is-primary',function(){execute('pdf');}),csv=button('הורד CSV','is-secondary',function(){execute('csv');}),xlsx=button('הורד Excel','is-secondary',function(){execute('xlsx');}),print=button('הדפס','is-secondary',function(){execute('print');});
    add(buttons,pdf,csv,xlsx,print);view.append(buttons);[pdf,csv,xlsx,print].forEach(function(b){b.disabled=!mayExport;});
    function selected(){return Array.from(fields.querySelectorAll('input:checked')).map(function(x){return x.value;});}
    function params(){return {type:type.input.value,from:from.input.value,to:to.input.value,limit:limit.input.value,groupBy:groups.input.value};}
    async function execute(mode){if(!mayExport)return;
      if(from.input.value&&to.input.value&&from.input.value>to.input.value){showMessage(view,'טווח תאריכים לא תקין.');return;}
      var cols=selected();if(!cols.length){showMessage(view,'בחר לפחות עמודה אחת.');return;}
      var popup=null;if(mode==='print'){popup=window.open('','_blank');if(!popup){showMessage(view,'הדפדפן חסם פתיחת חלון הדפסה.');return;}}
      [pdf,csv,xlsx,print].forEach(function(b){b.disabled=true;});
      try{
        var options=params();
        if(mode==='csv'||mode==='xlsx'){
          options.format=mode;options.fields=cols.join(',');
          var response=await fetch(apiBase+'report-download?'+new URLSearchParams(options),{credentials:'same-origin'});
          if(!response.ok){var err=await response.json().catch(function(){return {};});throw Error(err.error||'download_failed');}
          var blob=await response.blob(),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='versans-'+options.type+'-'+Date.now()+'.'+mode;document.body.append(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);
          showMessage(view,'קובץ '+mode.toUpperCase()+' ירד למכשיר.',true);
        }else{
          var result=await get('export-data?'+new URLSearchParams(options));
          if(mode==='print'){
            popup.document.open();popup.document.write(reportPage(result,cols,options));popup.document.close();setTimeout(function(){if(!popup.closed){popup.focus();popup.print();}},350);
            showMessage(view,'הדוח נפתח להדפסה.',true);
          }else{
            if(!window.VersansReportPDF||typeof window.VersansReportPDF.download!=='function')throw Error('מנוע ה-PDF אינו זמין.');
            var info=await window.VersansReportPDF.download(result,cols,options);showMessage(view,'ה-PDF נשמר ('+info.pages+' עמודים).',true);
          }
        }
      }catch(err){if(popup&&!popup.closed)popup.close();showMessage(view,'יצירת הדוח נכשלה: '+err.message);}
      finally{[pdf,csv,xlsx,print].forEach(function(b){b.disabled=!mayExport;});}
    }
    var scheduleBox=el('section','admin-report-schedules');view.append(scheduleBox);
    async function loadSchedules(){scheduleBox.replaceChildren();scheduleBox.append(el('h3','','דוחות מתוזמנים למייל'));
      if(!maySchedule){scheduleBox.append(el('p','admin-tools-export-note','יצירת תזמונים דורשת הרשאת תזמון וייצוא נפרדות.'));return;}
      var data;try{data=await get('report-schedules');}catch(e){scheduleBox.append(el('p','admin-tools-export-note','לא ניתן לטעון תזמונים: '+e.message));return;}
      if(!data.configured){scheduleBox.append(el('p','admin-tools-message','שירות המייל עדיין לא מוגדר בשרת (RESEND_API_KEY ו-EMAIL_FROM).'));return;}
      scheduleBox.append(el('p','admin-tools-export-note','הדוח יישלח לכתובת המייל של החשבון שלך בלבד. זמני שליחה לפי שעון ישראל; יומי - אתמול, שבועי - השבוע שהסתיים, חודשי - החודש שהסתיים.'));
      var row=el('div','admin-report-schedule-form');var cadence=pick('תדירות',[['daily','מדי יום'],['weekly','מדי יום שני'],['monthly','ביום הראשון בכל חודש']],'weekly');var hour=pick('שעת שליחה (ישראל)',Array.from({length:24},function(_,i){return [String(i),String(i).padStart(2,'0')+':00'];}),'8');var fmt=pick('פורמט',[['xlsx','Excel'],['csv','CSV']],'xlsx');
      add(row,cadence.wrap,hour.wrap,fmt.wrap);
      row.append(button('הוסף תזמון לדוח הנבחר','is-primary',async function(){
        try{await save('report-schedules','POST',{type:type.input.value,format:fmt.input.value,cadence:cadence.input.value,hour:Number(hour.input.value)});showMessage(view,'התזמון נשמר.',true);await loadSchedules();}
        catch(e){showMessage(view,'שמירת התזמון נכשלה: '+e.message);}
      }));scheduleBox.append(row);
      var list=el('div','admin-report-schedule-list');scheduleBox.append(list);
      (data.schedules||[]).forEach(function(s){var item=el('div','admin-report-schedule-item');var name=REPORT_TYPES.find(function(r){return r[0]===s.type;});
        item.append(el('strong','',(name?name[1]:s.type)+' · '+s.format.toUpperCase()),el('span','',' · '+({daily:'יומי',weekly:'שבועי',monthly:'חודשי'}[s.cadence]||s.cadence)+' '+String(s.hour).padStart(2,'0')+':00 · '+(s.active?'פעיל':'מושהה')));
        var toggle=button(s.active?'השהה':'הפעל','is-secondary',async function(){try{await save('report-schedules','POST',{id:s.id,type:s.type,format:s.format,cadence:s.cadence,hour:s.hour,active:!s.active});await loadSchedules();}catch(e){showMessage(view,e.message);}});
        var remove=button('מחק','is-danger',async function(){if(!confirm('למחוק את התזמון?'))return;try{var r=await fetch(apiBase+'report-schedules/'+s.id,{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw Error('delete_failed');await loadSchedules();}catch(e){showMessage(view,e.message);}});
        item.append(toggle,remove);list.append(item);
      });
      if(!data.schedules||!data.schedules.length)list.append(el('p','admin-tools-export-note','אין דוחות מתוזמנים כרגע.'));
    }
    loadSchedules();root.replaceChildren(view);
  }
  window.VersansAdminTools={renderTasks:renderTasks,renderReports:renderReports};
})();
