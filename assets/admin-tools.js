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
  function fileSize(bytes){return (bytes/1024/1024).toFixed(1)+' MB';}
  function taskLink(task){if(!task.linkType||!task.linkRef)return null;
    var labels={order:'הזמנה',product:'מוצר',customer:'לקוח'};
    var href=task.linkType==='order'?'/admin/order-work?order='+encodeURIComponent(task.linkRef):
      task.linkType==='product'?'/admin/products?search='+encodeURIComponent(task.linkRef):'/admin/customers?search='+encodeURIComponent(task.linkRef);
    var link=el('a','admin-task-link',labels[task.linkType]+' · '+task.linkRef+' ↗');link.href=href;link.target='_blank';link.rel='noopener';return link;
  }
  async function uploadTaskFiles(id,input){var files=Array.from(input.files||[]);if(files.length>8)throw Error('אפשר לצרף עד 8 קבצים לכל משימה');
    for(var f of files){if(f.size>2*1024*1024)throw Error('הקובץ '+f.name+' גדול מ־2MB');
      if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type))throw Error('מותר להעלות תמונות או PDF בלבד');
      var raw=await new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result||'').split(',')[1]||'');};r.onerror=function(){reject(Error('לא ניתן לקרוא קובץ'));};r.readAsDataURL(f);});
      await save('internal-tasks/'+id+'/files','POST',{name:f.name,mime:f.type,data:raw});
    }
  }
  function taskEditor(current,onSaved,canAssign){
    openModal(current?'עריכת משימה':'משימה חדשה',function(panel,close){
      var title=field('שם המשימה *','text',current&&current.title,'מה צריך לעשות?');title.input.maxLength=180;
      var desc=field('תיאור ופרטים','textarea',current&&current.description,'מה צריך לעשות?');desc.input.rows=4;
      var kind=pick('סוג',TYPES,current&&current.type),priority=pick('עדיפות',PRIORITIES,current&&current.priority),status=pick('סטטוס',STATUSES,current&&current.status);
      var due=field('תאריך יעד','date',current&&current.dueDate);
      var recurrence=pick('משימה חוזרת',[['none','לא חוזרת'],['daily','כל יום'],['weekly','כל שבוע'],['monthly','כל חודש']],current&&current.repeatRule);
      var reminder=pick('תזכורת לפני היעד',[['1','יום אחד'],['2','יומיים'],['3','3 ימים'],['7','שבוע'],['0','ללא תזכורת']],String(current ? (current.remindDays??1) : 1));
      var linkType=pick('קישור לישות',[['','ללא קישור'],['order','הזמנה'],['product','מוצר'],['customer','לקוח']],current&&current.linkType);
      var linkRef=field('מספר הזמנה / מזהה מוצר / מספר לקוח','text',current&&current.linkRef,'לדוגמה: product-10');linkRef.input.maxLength=120;
      var assignees=el('div','admin-task-assignees'),chosen=new Set(current?(current.assignees|| (current.assignedTo?[current.assignedTo]:[])):[]);
      var assigneesBlock=el('div','admin-task-assignees-panel');add(assigneesBlock,el('strong','','אחראים למשימה'),assignees);
      if(canAssign){assignees.append(el('small','','טוען עובדים…'));loadAssignees().then(function(list){
        assignees.replaceChildren();list.forEach(function(person){var email=String(person.email).toLowerCase(),label=el('label','admin-task-assignee-chip');var box=el('input');box.type='checkbox';box.value=email;box.checked=chosen.has(email);label.append(box,el('span','',person.name+' · '+person.email));box.addEventListener('change',function(){if(box.checked)chosen.add(email);else chosen.delete(email);});assignees.append(label);});
        if(!list.length)assignees.append(el('small','','אין עובדים פעילים'));}).catch(function(e){assignees.replaceChildren(el('small','','שגיאה בטעינת עובדים: '+e.message));});
      }else{assigneesBlock.hidden=true;}
      var uploads=field('צירוף תמונות או PDF (עד 2MB לקובץ)','file','');uploads.input.multiple=true;uploads.input.accept='image/png,image/jpeg,image/webp,application/pdf';
      var grid=el('div','admin-tools-form-grid');add(grid,kind.wrap,priority.wrap,status.wrap,due.wrap,recurrence.wrap,reminder.wrap,linkType.wrap,linkRef.wrap);
      var form=el('form','admin-tools-form');add(form,title.wrap,desc.wrap,grid,assigneesBlock,uploads.wrap);
      var error=el('p','admin-tools-inline-error'),foot=el('div','admin-tools-modal-actions');var submit=button(current?'שמור שינויים':'הוסף משימה','is-primary');submit.type='submit';add(foot,button('ביטול','is-secondary',close),submit);add(form,error,foot);panel.append(form);
      form.addEventListener('submit',async function(e){e.preventDefault();error.textContent='';if(!title.input.value.trim()){error.textContent='חובה להזין שם משימה';return;}
        if(recurrence.input.value!=='none'&&!due.input.value){error.textContent='למשימה חוזרת חובה להגדיר תאריך יעד ראשון';return;}
        var selected=Array.from(chosen);
        var payload={title:title.input.value.trim(),description:desc.input.value.trim(),type:kind.input.value,status:status.input.value,priority:priority.input.value,dueDate:due.input.value,
          repeatRule:recurrence.input.value,remindDays:Number(reminder.input.value),linkType:linkType.input.value,linkRef:linkType.input.value?linkRef.input.value.trim():''};
        if(canAssign){payload.assignees=selected;payload.assignedTo=selected[0]||'';}if(current)payload.updatedAt=current.updatedAt;
        submit.disabled=true;submit.textContent='שומר…';
        try{var response=await save('internal-tasks'+(current?'/'+current.id:''),current?'PATCH':'POST',payload);
          var taskId=current?current.id:response.task.id;
          if(uploads.input.files.length)await uploadTaskFiles(taskId,uploads.input);
          close();await onSaved();
        }catch(err){error.textContent='לא ניתן להשלים: '+err.message+(current?'':' — אם המשימה נשמרה, היא תופיע לאחר רענון');submit.disabled=false;submit.textContent=current?'שמור שינויים':'הוסף משימה';}
      });
    });
  }
  function taskAssignEditor(task,onSaved){openModal('שיוך אחראים למשימה',function(panel,close){
    var chosen=new Set(task.assignees||[]),wrap=el('div','admin-task-assignees');panel.append(wrap);
    loadAssignees().then(function(list){list.forEach(function(user){var email=user.email.toLowerCase(),label=el('label','admin-task-assignee-chip'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=chosen.has(email);label.append(checkbox,el('span','',user.name+' · '+email));checkbox.addEventListener('change',function(){if(checkbox.checked)chosen.add(email);else chosen.delete(email);});wrap.append(label);});}).catch(function(e){showMessage(panel,e.message);});
    var submit=button('שמור אחראים','is-primary',async function(){try{submit.disabled=true;var emails=Array.from(chosen);await save('internal-tasks/'+task.id,'PATCH',{updatedAt:task.updatedAt,status:task.status,assignedTo:emails[0]||'',assignees:emails});close();await onSaved();}catch(e){submit.disabled=false;showMessage(panel,e.message);}});
    panel.append(submit);
  });}
  function taskDetails(task,onSaved,canEdit){openModal('פעילות וקבצים · '+task.title,async function(panel,close){
    var files=el('section','admin-task-details-area'),history=el('section','admin-task-details-area');add(panel,files,history);
    async function load(){files.replaceChildren(el('h4','','קבצים וצילומי מסך'));history.replaceChildren(el('h4','','היסטוריית שינויים'));
      try{var pair=await Promise.all([get('internal-tasks/'+task.id+'/files'),get('internal-tasks/'+task.id+'/history')]);
        if(!pair[0].files.length)files.append(el('p','','אין קבצים מצורפים'));
        pair[0].files.forEach(function(f){var row=el('div','admin-task-file-row');var a=el('a','',f.name+' · '+fileSize(f.bytes));a.href=apiBase+'internal-tasks/files/'+f.id;a.download=f.name;a.target='_blank';add(row,a);
          if(canEdit)row.append(button('הסר','is-danger',async function(){if(!confirm('להסיר את הקובץ?'))return;try{var r=await fetch(apiBase+'internal-tasks/files/'+f.id,{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw Error('delete_failed');await load();}catch(e){showMessage(panel,'מחיקת הקובץ נכשלה: '+e.message);}}));files.append(row);});
        var events=pair[1].history||[];if(!events.length)history.append(el('p','','אין שינויים מתועדים עדיין'));
        events.forEach(function(h){var line=el('div','admin-task-history-entry');var label={created:'נוצרה',updated:'עודכנה',deleted:'נמחקה',file_added:'נוסף קובץ',file_removed:'הוסר קובץ',recurring_created:'נוצרה אוטומטית'}[h.action]||h.action;add(line,el('strong','',label+' · '+h.actor),el('small','',new Date(h.at).toLocaleString('he-IL')));
          Object.entries(h.changes||{}).forEach(function(pair){var value=pair[1],v=typeof value==='object'&&value!==null&&Object.hasOwn(value,'to')?String(value.from||'')+' ← '+String(value.to||''):String(typeof value==='object'?JSON.stringify(value):value);line.append(el('span','',pair[0]+': '+v));});history.append(line);});
      }catch(e){showMessage(panel,'טעינת המידע נכשלה: '+e.message);}}
    if(canEdit){var file=field('העלה קבצים נוספים','file','');file.input.multiple=true;file.input.accept='image/png,image/jpeg,image/webp,application/pdf';var upload=button('העלה','is-secondary',async function(){try{upload.disabled=true;await uploadTaskFiles(task.id,file.input);file.input.value='';await load();}catch(e){showMessage(panel,e.message);}finally{upload.disabled=false;}});panel.insertBefore(file.wrap,history);panel.insertBefore(upload,history);}
    await load();
  });}
  function taskTemplateManager(onSaved,canCreate,canEdit){openModal('תבניות משימות',async function(panel,close){
    var list=el('div','admin-task-template-list');panel.append(list);
    async function refresh(){list.replaceChildren();try{var data=await get('task-templates');if(!data.templates.length)list.append(el('p','','עדיין אין תבניות'));
      data.templates.forEach(function(t){var row=el('div','admin-task-template-row');add(row,el('strong','',t.title),el('small','',(t.repeatRule!=='none'?'חוזרת · ':'')+'יעד: בעוד '+t.dueOffsetDays+' ימים'));
        if(canCreate)row.append(button('צור משימה','is-primary',async function(){try{await save('task-templates/'+t.id,'POST',{});close();await onSaved();}catch(e){showMessage(panel,e.message);}}));
        if(canEdit)row.append(button('מחק תבנית','is-danger',async function(){if(!confirm('למחוק את התבנית בלבד?'))return;try{var r=await fetch(apiBase+'task-templates/'+t.id,{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw Error('delete_failed');await refresh();}catch(e){showMessage(panel,e.message);}}));list.append(row);});
    }catch(e){showMessage(panel,e.message);}}
    if(canCreate){var name=field('שם התבנית','text',''),desc=field('תיאור','textarea',''),offset=field('תאריך יעד: בעוד כמה ימים','number','0');offset.input.min='0';offset.input.max='365';var repeat=pick('תדירות',[['none','ללא חזרה'],['daily','כל יום'],['weekly','כל שבוע'],['monthly','כל חודש']],'none');
      var submit=button('שמור תבנית','is-primary',async function(){try{await save('task-templates','POST',{title:name.input.value,description:desc.input.value,dueOffsetDays:Number(offset.input.value),repeatRule:repeat.input.value});name.input.value='';desc.input.value='';await refresh();}catch(e){showMessage(panel,e.message);}});
      var form=el('div','admin-task-template-form');add(form,name.wrap,desc.wrap,offset.wrap,repeat.wrap,submit);panel.prepend(form);}
    await refresh();
  });}
  var selectedTaskTab='open',calendarMode=false,calendarMonth=new Date().toISOString().slice(0,7);
  async function renderTasks(root){
    var data;
    try{data=await get('internal-tasks');}catch(e){root.replaceChildren(el('div','admin-tools-error','לא ניתן לטעון משימות: '+e.message));return;}
    var tasks=data.tasks||[],canCreate=data.canCreate===true,canEdit=data.canEdit===true,canAssign=data.canAssign===true,canDelete=data.canDelete===true,canStatus=data.canChangeStatus===true;
    var view=el('div','admin-tools-page'),top=el('div','admin-tools-title-row');add(top,add(el('div'),el('h2','','משימות פנימיות'),el('p','','מעקב משימות, תאריכי יעד וקבצים מצורפים')));
    var topButtons=el('div','admin-task-toolbar');if(canCreate)topButtons.append(button('+ משימה חדשה','is-primary',function(){taskEditor(null,function(){return renderTasks(root);},canAssign);}));
    topButtons.append(button('לוח שנה','is-secondary',function(){calendarMode=!calendarMode;draw();}));
    topButtons.append(button('תבניות משימות','is-secondary',function(){taskTemplateManager(function(){return renderTasks(root);},canCreate,canEdit);}));top.append(topButtons);view.append(top);
    var now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    var overdue=tasks.filter(function(t){return t.status!=='done'&&t.dueDate&&t.dueDate<now;}).length;
    if(overdue)view.append(el('div','admin-task-overdue-alert','⚠ '+overdue+' משימות עברו את תאריך היעד שלהן'));
    var tabs=el('div','admin-tools-status-tabs');tabs.setAttribute('role','tablist');var search=field('חיפוש','search','','כותרת, תיאור או אחראי');var type=pick('סוג',[['all','כל הסוגים']].concat(TYPES),'all'),priority=pick('עדיפות',[['all','כל העדיפויות']].concat(PRIORITIES),'all');
    var controls=el('div','admin-tools-controls');add(controls,search.wrap,type.wrap,priority.wrap);view.append(tabs,controls);
    var summary=el('div','admin-tools-summary'),list=el('div','admin-tools-task-list');view.append(summary,list);
    function drawCalendar(){var month=calendarMonth;var first=new Date(month+'-01T12:00:00Z'),start=first.getUTCDay(),days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
      var container=el('div','admin-task-calendar');var header=el('div','admin-task-calendar-nav');var previous=button('→','is-secondary',function(){first.setUTCMonth(first.getUTCMonth()-1);calendarMonth=first.toISOString().slice(0,7);draw();});var next=button('←','is-secondary',function(){first.setUTCMonth(first.getUTCMonth()+1);calendarMonth=first.toISOString().slice(0,7);draw();});add(header,previous,el('strong','',first.toLocaleDateString('he-IL',{month:'long',year:'numeric',timeZone:'UTC'})),next);container.append(header);
      var grid=el('div','admin-task-calendar-grid');['א','ב','ג','ד','ה','ו','ש'].forEach(function(n){grid.append(el('strong','admin-task-day-head',n));});for(var i=0;i<start;i++)grid.append(el('div','admin-task-day-blank'));
      for(var day=1;day<=days;day++){var date=month+'-'+String(day).padStart(2,'0'),related=tasks.filter(function(t){return t.dueDate===date;}),cell=button(String(day)+(related.length?' · '+related.length:''),'admin-task-day'+(date===now?' is-today':''),function(selected,items){return function(){Array.from(list.children).forEach(function(node){if(!node.classList.contains('admin-task-calendar'))node.remove();});summary.textContent='משימות ל־'+selected;items.forEach(renderCard);if(!items.length)list.append(el('p','','אין משימות ליום הזה'));};}(date,related));grid.append(cell);}container.append(grid);list.append(container);}
    function renderCard(task){var card=el('article','admin-tools-task '+(task.status==='done'?'is-done':''));var head=el('div','admin-tools-task-heading'),label=el('div','admin-tools-task-title');label.append(el('h3','',task.title));var badges=el('div','admin-tools-task-badges');add(badges,pill(labelOf(PRIORITIES,task.priority),'priority-'+task.priority),pill(labelOf(TYPES,task.type)),pill(labelOf(STATUSES,task.status),'status-'+task.status));head.append(label,badges);card.append(head);
      if(task.description)card.append(el('p','admin-tools-task-description',task.description));
      if(task.dueDate&&task.dueDate<now&&task.status!=='done')card.append(el('span','admin-task-overdue-label','באיחור · יעד '+task.dueDate));
      var line=el('div','admin-tools-task-meta');line.textContent='נוצר: '+shortDate(task.createdAt)+(task.dueDate?' · יעד: '+task.dueDate:'')+(task.repeatRule!=='none'?' · חוזרת '+({'daily':'יומית','weekly':'שבועית','monthly':'חודשית'}[task.repeatRule]||''):'');
      card.append(line);if(task.assignees?.length)card.append(el('div','admin-task-people','אחראים: '+task.assignees.join(' · ')));else if(task.assignedTo)card.append(el('div','admin-task-people','אחראי: '+task.assignedTo));
      var link=taskLink(task);if(link)card.append(link);
      var actions=el('div','admin-tools-task-actions');actions.append(button('פעילות וקבצים','is-secondary',function(){taskDetails(task,function(){return renderTasks(root);},canEdit);}));
      if(canEdit)actions.append(button('ערוך','is-secondary',function(){taskEditor(task,function(){return renderTasks(root);},canAssign);}));
      if(canStatus||canEdit){var change=pick('שנה סטטוס',STATUSES,task.status);change.wrap.classList.add('admin-tools-task-status');change.input.addEventListener('change',async function(){change.input.disabled=true;try{await save('internal-tasks/'+task.id,'PATCH',{updatedAt:task.updatedAt,status:change.input.value});selectedTaskTab=change.input.value;await renderTasks(root);}catch(e){change.input.value=task.status;change.input.disabled=false;showMessage(root,'עדכון נכשל: '+e.message);}});actions.append(change.wrap);}
      if(canAssign)actions.append(button('אחראים','is-secondary',function(){taskEditor(task,function(){return renderTasks(root);},canAssign);}));
      if(canDelete)actions.append(button('מחק','is-danger',async function(){if(!confirm('למחוק את המשימה?'))return;try{await save('internal-tasks/'+task.id,'DELETE',{updatedAt:task.updatedAt});await renderTasks(root);}catch(e){showMessage(root,e.message);}}));
      card.append(actions);list.append(card);
    }
    function draw(){tabs.replaceChildren();STATUSES.forEach(function(st){var count=tasks.filter(function(t){return t.status===st[0];}).length;var buttonTab=button(st[1]+' ('+count+')',selectedTaskTab===st[0]?'is-active':'',function(){selectedTaskTab=st[0];draw();});buttonTab.setAttribute('role','tab');buttonTab.setAttribute('aria-selected',String(selectedTaskTab===st[0]));tabs.append(buttonTab);});tabs.hidden=calendarMode;controls.hidden=calendarMode;
      list.replaceChildren();if(calendarMode){summary.textContent='לוח משימות לפי תאריך יעד';drawCalendar();return;}
      var q=search.input.value.trim().toLowerCase();var filtered=tasks.filter(function(t){return t.status===selectedTaskTab&&(type.input.value==='all'||t.type===type.input.value)&&(priority.input.value==='all'||t.priority===priority.input.value)&&(!q||[t.title,t.description,t.assignedTo,...(t.assignees||[])].join(' ').toLowerCase().includes(q));});
      summary.textContent='סה״כ '+tasks.length+' משימות · '+filtered.length+' בתצוגה';if(!filtered.length)list.append(el('div','admin-tools-empty','אין משימות התואמות לסינון.'));filtered.forEach(renderCard);
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
    var mayExport=has('reports.export'),maySchedule=has('reports.schedule')&&mayExport,mayShare=has('reports.share')&&mayExport;
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
    async function loadSchedules(){
      scheduleBox.replaceChildren();scheduleBox.append(el('h3','',maySchedule?'דוחות מתוזמנים למייל':'שליחת דוחות למייל'));
      if(!maySchedule&&!mayShare){scheduleBox.append(el('p','admin-tools-export-note','יצירת תזמונים דורשת הרשאת תזמון וייצוא נפרדות.'));return;}
      var data,directory;
      try{[data,directory]=await Promise.all([get('report-schedules'),get('report-recipients')]);}
      catch(e){scheduleBox.append(el('p','admin-tools-export-note','לא ניתן לטעון תזמונים או נמענים: '+e.message));return;}
      if(!data.configured){scheduleBox.append(el('p','admin-tools-message','שירות המייל עדיין לא מוגדר בשרת (RESEND_API_KEY ו-EMAIL_FROM).'));return;}
      scheduleBox.append(el('p','admin-tools-export-note','ניתן לבחור מספר נמענים ושעות מדויקות לפי שעון ישראל. דוח יומי מסכם את אתמול, שבועי את השבוע שהסתיים וחודשי את החודש שהסתיים. הרשאות הנמענים אינן מגבילות קבלת דוח ששותף במפורש על ידי בעל הרשאה.'));
      var row=el('div','admin-report-schedule-form');
      var cadence=pick('תדירות',[['daily','מדי יום'],['weekly','מדי יום שני'],['monthly','ביום הראשון בכל חודש']],'daily');
      var fmt=pick('פורמט',[['xlsx','Excel'],['csv','CSV']],'xlsx');
      var timesBox=el('div','admin-report-times'),timeTitle=el('strong','','שעות שליחה (ישראל)');
      var timeRows=el('div','admin-report-times-list');
      function addTime(value){
        var line=el('div','admin-report-time-row'),inp=el('input');inp.type='time';inp.step=60;inp.value=value||'08:00';inp.setAttribute('aria-label','שעת שליחה');
        var del=button('הסר','is-secondary',function(){line.remove();});del.setAttribute('aria-label','הסרת שעת שליחה');line.append(inp,del);timeRows.append(line);
      }
      addTime('08:00');timesBox.append(timeTitle,timeRows,button('+ הוסף שעת שליחה','is-secondary',function(){if(timeRows.children.length>=24){showMessage(view,'ניתן לקבוע עד 24 שעות בתזמון.');return;}addTime('12:00');}));
      var recipientsWrap=el('div','admin-report-recipient-panel');recipientsWrap.append(el('strong','','למי לשלוח את הדוח?'));
      var recipActions=el('div','admin-report-recipient-actions'),recipientsList=el('div','admin-report-recipient-list');
      if(directory.canShare)recipActions.append(button('בחר את כל העובדים והאדמינים','is-secondary',function(){recipientsList.querySelectorAll('input[type="checkbox"]').forEach(function(i){i.checked=true;});}),button('נקה בחירה','is-secondary',function(){recipientsList.querySelectorAll('input[type="checkbox"]').forEach(function(i){i.checked=false;});}));
      recipientsWrap.append(recipActions);
      (directory.recipients||[]).forEach(function(u){var label=el('label','admin-report-recipient'),check=el('input');check.type='checkbox';check.value=String(u.id);check.checked=Number(u.id)===Number(me.id);
        label.append(check,el('span','',u.name+' · '+u.email+(u.role==='admin'?' (אדמין)':' (עובד)')));recipientsList.append(label);
      });
      recipientsWrap.append(recipientsList);
      var extra=null;
      if(directory.canExternal){extra=field('כתובות מייל נוספות (לא חובה, להפריד בפסיק)','text','','name@example.com');extra.wrap.classList.add('admin-report-email-extra');recipientsWrap.append(extra.wrap);}
      function recipients(){
        var result=Array.from(recipientsList.querySelectorAll('input:checked')).map(function(ch){return {kind:'user',id:Number(ch.value)};});
        if(extra&&extra.input.value.trim())extra.input.value.split(/[,;\n]/).forEach(function(addr){if(addr.trim())result.push({kind:'email',email:addr.trim()});});
        if(!result.length)throw Error('צריך לבחור לפחות נמען אחד.');
        if(result.length>25)throw Error('ניתן לבחור עד 25 נמענים בתזמון.');
        return result;
      }
      function times(){var values=Array.from(timeRows.querySelectorAll('input[type="time"]')).map(function(i){return i.value;});if(!values.length||values.some(function(x){return !/^([01]\d|2[0-3]):[0-5]\d$/.test(x);}))throw Error('יש לבחור לפחות שעה אחת בפורמט תקין.');return Array.from(new Set(values)).sort();}
      function applyRecipients(items){
        recipientsList.querySelectorAll('input[type="checkbox"]').forEach(function(i){i.checked=false;});
        var mails=[];
        (items||[]).forEach(function(r){if(r.kind==='user'){var checkbox=Array.from(recipientsList.querySelectorAll('input')).find(function(i){return i.value===String(r.id);});if(checkbox)checkbox.checked=true;}else if(r.kind==='email')mails.push(r.email);});
        if(extra)extra.input.value=mails.join(', ');
      }
      var editingId=null,editingLabel=el('p','admin-tools-export-note','');editingLabel.hidden=true;
      var submit=button('הוסף תזמון לדוח הנבחר','is-primary',async function(){
        try{var body={type:type.input.value,format:fmt.input.value,cadence:cadence.input.value,times:times(),recipients:recipients()};if(editingId)body.id=editingId;
          await save('report-schedules','POST',body);showMessage(view,editingId?'התזמון עודכן.':'התזמון נשמר.',true);await loadSchedules();
        }catch(e){showMessage(view,'שמירת התזמון נכשלה: '+e.message);}
      });
      var controls=el('div','admin-report-schedule-controls');if(maySchedule)controls.append(submit);
      if(mayShare&&directory.canShare){controls.append(button('שלח את הדוח עכשיו במייל','is-secondary',async function(){
        try{
          var selectedRecipients=recipients();
          if(!confirm('לשלוח עכשיו דוח '+labelOf(REPORT_TYPES,type.input.value)+' ל-'+selectedRecipients.length+' נמענים?'))return;
          var result=await save('report-send','POST',{type:type.input.value,format:fmt.input.value,from:from.input.value,to:to.input.value,recipients:selectedRecipients});
          showMessage(view,'נשלח ל-'+result.sent+' נמענים.'+(result.failed?' השליחה נכשלה ל-'+result.failed+' נמענים.':''),result.failed===0);
        }catch(e){showMessage(view,'שליחת הדוח נכשלה: '+e.message);}
      }));}
      var resetEdit=button('ביטול עריכה','is-secondary',function(){loadSchedules();});resetEdit.hidden=true;controls.append(resetEdit);
      add(row,cadence.wrap,fmt.wrap);if(!maySchedule){cadence.wrap.hidden=true;timesBox.hidden=true;}scheduleBox.append(row,timesBox,recipientsWrap,editingLabel,controls);
      var list=el('div','admin-report-schedule-list');scheduleBox.append(el('h3','','תזמונים קיימים'),list);
      (data.schedules||[]).forEach(function(s){var item=el('div','admin-report-schedule-item'),name=REPORT_TYPES.find(function(r){return r[0]===s.type;});
        var details=el('div','admin-report-schedule-description');details.append(el('strong','',(name?name[1]:s.type)+' · '+s.format.toUpperCase()));
        var addresses=(s.recipients||[]).map(function(r){if(r.kind==='email')return r.email;var u=(directory.recipients||[]).find(function(p){return Number(p.id)===Number(r.id);});return u?u.name:(r.id===Number(me.id)?me.name||me.email:'משתמש '+r.id);});
        details.append(el('span','',' '+({daily:'יומי',weekly:'שבועי',monthly:'חודשי'}[s.cadence]||s.cadence)+' · '+(s.times||[String(s.hour).padStart(2,'0')+':00']).join(', ')+' · '+(s.active?'פעיל':'מושהה')));
        details.append(el('small','','נמענים: '+(addresses.join(', ')||s.recipient||'לא הוגדרו')));item.append(details);
        var actions=el('div','admin-report-schedule-item-actions');
        if(maySchedule)actions.append(button('ערוך','is-secondary',function(){editingId=s.id;editingLabel.hidden=false;editingLabel.textContent='עריכת תזמון #'+s.id;submit.textContent='שמור שינויים בתזמון';resetEdit.hidden=false;
          type.input.value=s.type;type.input.dispatchEvent(new Event('change'));fmt.input.value=s.format;cadence.input.value=s.cadence;
          timeRows.replaceChildren();(s.times||[String(s.hour).padStart(2,'0')+':00']).forEach(addTime);applyRecipients(s.recipients||[{kind:'user',id:me.id}]);scheduleBox.scrollIntoView({behavior:'smooth',block:'start'});
        }));
        if(maySchedule)actions.append(button(s.active?'השהה':'הפעל','is-secondary',async function(){try{await save('report-schedules','POST',{id:s.id,type:s.type,format:s.format,cadence:s.cadence,times:s.times||[String(s.hour).padStart(2,'0')+':00'],recipients:s.recipients||[{kind:'user',id:me.id}],active:!s.active});await loadSchedules();}catch(e){showMessage(view,e.message);}}));
        if(maySchedule)actions.append(button('מחק','is-danger',async function(){if(!confirm('למחוק את התזמון?'))return;try{var r=await fetch(apiBase+'report-schedules/'+s.id,{method:'DELETE',credentials:'same-origin'});if(!r.ok)throw Error('delete_failed');await loadSchedules();}catch(e){showMessage(view,e.message);}}));
        item.append(actions);list.append(item);
      });
      if(!data.schedules||!data.schedules.length)list.append(el('p','admin-tools-export-note','אין דוחות מתוזמנים כרגע.'));
    }
    loadSchedules();root.replaceChildren(view);
  }
  window.VersansAdminTools={renderTasks:renderTasks,renderReports:renderReports};
})();
