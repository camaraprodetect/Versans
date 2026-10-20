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
  function taskEditor(current,onSaved){
    openModal(current?'עריכת משימה':'משימה חדשה',function(panel,close){
      var title=field('שם המשימה *','text',current&&current.title,'מה צריך לעשות?');title.input.maxLength=180;
      var desc=field('תיאור ופרטים','textarea',current&&current.description,'מה הבעיה, איך לשחזר ומה צריך להוסיף?');desc.input.rows=5;
      var kind=pick('סוג',TYPES,current&&current.type),priority=pick('עדיפות',PRIORITIES,current&&current.priority),status=pick('סטטוס',STATUSES,current&&current.status);
      var assign=pick('שיוך לעובד (התראות Push)',[['','ללא אחראי']],'');
      assign.input.disabled=true;
      var existing=String(current&&current.assignedTo||'').trim().toLowerCase();
      loadAssignees().then(function(list){
        list.forEach(function(a){var opt=el('option','',a.name+' ('+a.email+')');opt.value=a.email.toLowerCase();assign.input.append(opt);});
        if(existing && !list.some(function(a){return a.email.toLowerCase()===existing;})){
          var legacy=el('option','',existing+' (לא חשבון עובד פעיל)');legacy.value=existing;assign.input.append(legacy);
        }
        assign.input.value=existing;
        assign.input.disabled=false;
      }).catch(function(err){assign.wrap.append(el('small','admin-tools-inline-error','לא ניתן לטעון עובדים: '+err.message));});
      var due=field('תאריך יעד','date',current&&current.dueDate);var grid=el('div','admin-tools-form-grid');add(grid,kind.wrap,priority.wrap,status.wrap,assign.wrap,due.wrap);
      var form=el('form','admin-tools-form');add(form,title.wrap,desc.wrap,grid);var error=el('p','admin-tools-inline-error');var foot=el('div','admin-tools-modal-actions');var cancel=button('ביטול','is-secondary',close),submit=button(current?'שמור שינויים':'הוסף משימה','is-primary');submit.type='submit';foot.append(cancel,submit);add(form,error,foot);panel.append(form);
      form.addEventListener('submit',async function(e){e.preventDefault();if(!title.input.value.trim()){error.textContent='חובה להזין שם משימה';title.input.focus();return;}
        var payload={title:title.input.value.trim(),description:desc.input.value.trim(),type:kind.input.value,status:status.input.value,priority:priority.input.value,assignedTo:assign.input.value.trim(),dueDate:due.input.value};
        if(assign.input.disabled){error.textContent='יש להמתין לטעינת רשימת העובדים';return;}if(current)payload.updatedAt=current.updatedAt;submit.disabled=true;submit.textContent='שומר…';
        try{await save('internal-tasks'+(current?'/'+current.id:''),current?'PATCH':'POST',payload);close();await onSaved();}
        catch(err){error.textContent=err.message==='task_changed'?'המשימה שונתה בינתיים על ידי משתמש אחר. רענן את הרשימה ונסה שוב.':'לא ניתן לשמור את המשימה: '+err.message;submit.disabled=false;submit.textContent=current?'שמור שינויים':'הוסף משימה';}
      });
    });
  }
  async function renderTasks(root){
    var tasks=[],canManage=true;try{var data=await get('internal-tasks');tasks=data.tasks;canManage=data.canManage!==false;}catch(err){root.replaceChildren(el('div','admin-tools-error','לא ניתן לטעון משימות: '+err.message));return;}
    var view=el('div','admin-tools-page');var top=el('div','admin-tools-title-row');
    add(top,add(el('div'),el('h2','','ניהול משימות פנימי'),el('p','', 'רושמים תקלות, רעיונות ותוספות — ומתקדמים עד להשלמה.')));if(canManage)top.append(button('+ משימה חדשה','is-primary',function(){taskEditor(null,function(){return renderTasks(root);});}));
    view.append(top);
    var controls=el('div','admin-tools-controls');var search=field('חיפוש משימות','search','','חיפוש לפי כותרת, תיאור או אחראי');var stat=pick('סטטוס',[['all','כל הסטטוסים']].concat(STATUSES),'all');var type=pick('סוג',[['all','כל הסוגים']].concat(TYPES),'all');var priority=pick('עדיפות',[['all','כל העדיפויות']].concat(PRIORITIES),'all');add(controls,search.wrap,stat.wrap,type.wrap,priority.wrap);view.append(controls);
    var summary=el('div','admin-tools-summary');view.append(summary);var list=el('div','admin-tools-task-list');view.append(list);
    function draw(){list.replaceChildren();var q=search.input.value.trim().toLowerCase();var filtered=tasks.filter(function(t){return (stat.input.value==='all'||t.status===stat.input.value)&&(type.input.value==='all'||t.type===type.input.value)&&(priority.input.value==='all'||t.priority===priority.input.value)&&(!q||[t.title,t.description,t.assignedTo].join(' ').toLowerCase().includes(q));});summary.textContent='סה״כ '+tasks.length+' משימות · '+tasks.filter(function(t){return t.status!=='done';}).length+' פתוחות · '+filtered.length+' בתצוגה';
      if(!filtered.length){list.append(el('div','admin-tools-empty','אין משימות שמתאימות לסינון.'));return;}
      filtered.forEach(function(task){var card=el('article','admin-tools-task '+(task.status==='done'?'is-done':''));var head=el('div','admin-tools-task-heading');var label=el('div','admin-tools-task-title');add(label,el('h3','',task.title));var badges=el('div','admin-tools-task-badges');add(badges,pill(labelOf(STATUSES,task.status),'status-'+task.status),pill(labelOf(PRIORITIES,task.priority),'priority-'+task.priority),pill(labelOf(TYPES,task.type)));head.append(label,badges);card.append(head);
        if(task.description)card.append(el('p','admin-tools-task-description',task.description));
        var meta=el('p','admin-tools-task-meta',('נוצר: '+shortDate(task.createdAt))+(task.dueDate?' · יעד: '+task.dueDate:'')+(task.assignedTo?' · אחראי: '+task.assignedTo:''));card.append(meta);
        var actions=el('div','admin-tools-task-actions');if(canManage){var edit=button('ערוך','is-secondary',function(){taskEditor(task,function(){return renderTasks(root);});});actions.append(edit);}
        if(task.status!=='done'){actions.append(button('סמן כהושלמה','is-complete',async function(){try{await save('internal-tasks/'+task.id,'PATCH',Object.assign({},task,{status:'done'}));await renderTasks(root);}catch(err){showMessage(root,'לא ניתן להשלים: '+err.message);}}));}
        else if(canManage) actions.append(button('פתח מחדש','is-secondary',async function(){try{await save('internal-tasks/'+task.id,'PATCH',Object.assign({},task,{status:'open'}));await renderTasks(root);}catch(err){showMessage(root,'לא ניתן לפתוח: '+err.message);}}));
        if(canManage) actions.append(button('מחק','is-danger',function(){openModal('מחיקת משימה',function(modal,close){add(modal,el('p','admin-tools-confirm','למחוק את המשימה „'+task.title+'”? פעולה זו לא ניתנת לביטול.'));var footer=el('div','admin-tools-modal-actions');add(footer,button('ביטול','is-secondary',close),button('מחק משימה','is-danger',async function(){try{await save('internal-tasks/'+task.id,'DELETE',{updatedAt:task.updatedAt});close();await renderTasks(root);}catch(err){showMessage(modal,'מחיקה נכשלה: '+err.message);}}));modal.append(footer);});}));
        card.append(actions);list.append(card);
      });
    }
    [search.input,stat.input,type.input,priority.input].forEach(function(input){input.addEventListener('input',draw);input.addEventListener('change',draw);});draw();root.replaceChildren(view);
  }
  var REPORT_TYPES=[['orders','הזמנות'],['sales','מכירות יומיות'],['products','מוצרים'],['customers','לקוחות'],['shipments','משלוחים'],['reviews','ביקורות'],['visitors','מבקרים'],['creators','יוצרי תוכן'],['tiktok','סרטוני TikTok'],['tasks','משימות פנימיות']];
  var FIELD_OPTIONS={
    orders:[['ref','מספר הזמנה'],['customer','לקוח'],['email','אימייל'],['phone','טלפון'],['status','סטטוס'],['amount','סכום'],['date','תאריך'],['items','מוצרים']],
    sales:[['date','תאריך'],['orders','הזמנות'],['revenue','הכנסות']],
    products:[['id','מזהה'],['title','שם'],['price','מחיר'],['category','קטגוריות'],['hidden','מוסתר'],['availability','מלאי']],
    customers:[['name','שם'],['email','אימייל'],['phone','טלפון'],['role','תפקיד'],['joined','תאריך הרשמה'],['orders','הזמנות'],['spend','רכישות']],
    shipments:[['tracking','מעקב'],['ref','הזמנה'],['status','סטטוס'],['location','מיקום'],['event','אירוע'],['date','תאריך']],
    reviews:[['name','שם'],['product','מוצר'],['rating','דירוג'],['status','סטטוס'],['comment','ביקורת'],['date','תאריך']],
    visitors:[['visitor','מזהה מבקר'],['path','עמוד'],['device','מכשיר'],['browser','דפדפן'],['views','צפיות'],['date','תאריך']],
    creators:[['name','שם'],['email','אימייל'],['code','קוד אישי'],['discount','הנחה'],['commission','עמלה'],['username','טיקטוק'],['rate','₪ לאלף צפיות'],['active','פעיל']],
    tiktok:[['creator','יוצר'],['username','טיקטוק'],['url','קישור'],['status','סטטוס'],['views','צפיות'],['rate','₪ לאלף צפיות'],['date','בדיקה אחרונה']],
    tasks:[['title','כותרת'],['description','תיאור'],['type','סוג'],['status','סטטוס'],['priority','עדיפות'],['assignedTo','אחראי'],['dueDate','יעד'],['updatedAt','עדכון אחרון']]
  };
  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function reportPage(data,selected,params){
    var colMap=new Map(data.columns.map(function(c){return [c.key,c.label];}));var names=selected.filter(function(k){return colMap.has(k);});
    var head=names.map(function(k){return '<th>'+escapeHtml(colMap.get(k))+'</th>';}).join('');
    var body=data.rows.map(function(row){return '<tr>'+names.map(function(k){return '<td>'+escapeHtml(row[k])+'</td>';}).join('')+'</tr>';}).join('');
    var range=(params.from||params.to)?'טווח: '+(params.from||'התחלה')+' עד '+(params.to||'היום'):'כל התאריכים';
    var note=data.truncated?'שימו לב: הדוח מציג את '+data.limit+' הרשומות הראשונות בלבד; ניתן לסנן כדי לצמצם תוצאות.':'';
    return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VerSans · '+escapeHtml(data.title)+'</title><style>@page{size:A4 landscape;margin:14mm}body{font-family:Arial,system-ui,sans-serif;color:#142333;margin:25px;direction:rtl}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #142333;padding-bottom:12px}h1{margin:12px 0;font-size:22px}p{color:#586579}table{width:100%;border-collapse:collapse;font-size:11px;table-layout:auto}th,td{border:1px solid #d5dfe6;padding:6px;text-align:right;vertical-align:top;overflow-wrap:anywhere}th{background:#e7edf2}tr:nth-child(even){background:#f8fafb}tr{break-inside:avoid}thead{display:table-header-group}.print-toolbar{text-align:left;padding:14px 0}.print-toolbar button{font-size:15px;border:0;background:#142333;color:white;padding:10px 16px;border-radius:8px;cursor:pointer}.warn{color:#923416}@media print{.print-toolbar{display:none}body{margin:0}table{font-size:10px}}</style></head><body><div class="print-toolbar"><button onclick="window.print()">הדפס / שמור כ־PDF</button></div><header><strong style="font-size:24px">VERSANS</strong><small>דוח ניהול פנימי · לעיון מורשים בלבד</small></header><h1>'+escapeHtml(data.title)+'</h1><p>'+escapeHtml(range)+' · '+data.rows.length+' רשומות · הופק: '+escapeHtml(new Date(data.generatedAt).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}))+'</p>'+(note?'<p class="warn">'+escapeHtml(note)+'</p>':'')+'<table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></body></html>';
  }
  async function renderReports(root){
    var view=el('div','admin-tools-page');add(view,el('h2','','ייצוא נתונים ל־PDF'),el('p','admin-tools-lead','בחר דוח, סנן תאריכים ושדות והפק PDF מסודר בעברית. המידע זמין למנהלי האתר בלבד.'));
    var form=el('div','admin-tools-export-form');var type=pick('סוג הנתונים',REPORT_TYPES,'orders');var from=field('מתאריך (כולל)','date'),to=field('עד תאריך (כולל)','date'),limit=pick('מספר שורות מרבי',[['100','100'],['300','300'],['500','500'],['1000','1,000'],['2000','2,000']],'500');add(form,type.wrap,from.wrap,to.wrap,limit.wrap);view.append(form);
    var fields=el('div','admin-tools-export-fields');view.append(el('h3','','אילו פרטים יופיעו בדוח?'),fields);
    function showFields(){fields.replaceChildren();(FIELD_OPTIONS[type.input.value]||[]).forEach(function(c){var label=el('label','admin-tools-field-chip');var check=el('input');check.type='checkbox';check.value=c[0];check.checked=true;add(label,check,el('span','',c[1]));fields.append(label);});}
    function syncDateFields(){var noDate=type.input.value==='products';from.wrap.hidden=noDate;to.wrap.hidden=noDate;if(noDate){from.input.value='';to.input.value='';}dateNote.hidden=!noDate;}
    var dateNote=el('p','admin-tools-export-note','למוצרים אין תאריך יצירה/עדכון מובנה במאגר, ולכן מסנן התאריכים לא חל על דוח מוצרים.');view.append(dateNote);
    type.input.addEventListener('change',function(){showFields();syncDateFields();});showFields();syncDateFields();
    var info=el('p','admin-tools-export-note','הייצוא נפתח בתצוגת הדפסה. בחר במדפסת „Save as PDF / שמירה כ־PDF” כדי לשמור את הקובץ. הנתונים לא מועלים לשירות חיצוני.');view.append(info);
    var exportButton=button('הפק דוח PDF','is-primary',async function(){
      if(from.input.value&&to.input.value&&from.input.value>to.input.value){showMessage(view,'תאריך ההתחלה חייב להיות לפני תאריך הסיום.');return;}
      var selected=Array.from(fields.querySelectorAll('input:checked')).map(function(x){return x.value;});if(!selected.length){showMessage(view,'בחר לפחות עמודה אחת.');return;}
      var popup=window.open('','_blank');if(!popup){showMessage(view,'הדפדפן חסם חלון חדש. אפשר חלונות קופצים לאדמין ונסה שוב.');return;}
      popup.document.write('<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8"><title>מכין דוח</title><body>מכין דוח PDF…</body></html>');popup.document.close();
      exportButton.disabled=true;exportButton.textContent='מפיק דוח…';
      try{var params={type:type.input.value,from:from.input.value,to:to.input.value,limit:limit.input.value};var qs=new URLSearchParams(params);var result=await get('export-data?'+qs);
        var html=reportPage(result,selected,params);popup.document.open();popup.document.write(html);popup.document.close();showMessage(view,'הדוח נפתח בחלון חדש. בחר „הדפס / שמור כ־PDF”.',true);
      }catch(e){popup.close();showMessage(view,'לא ניתן להפיק דוח: '+e.message);}
      finally{exportButton.disabled=false;exportButton.textContent='הפק דוח PDF';}
    });view.append(exportButton);root.replaceChildren(view);
  }
  window.VersansAdminTools={renderTasks:renderTasks,renderReports:renderReports};
})();
