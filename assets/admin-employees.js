(function(){
 'use strict';
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
 function button(label,kind){var n=el('button','emp-button '+(kind||''),label);n.type='button';return n;}
 function field(label,type,value){var w=el('label','emp-field');w.append(el('span','',label));var n=el('input');n.type=type;n.value=value==null?'':String(value);w.append(n);return {wrap:w,input:n};}
 function help(s){return el('p','emp-help',s);}
 function pdate(ms){return ms?new Date(ms).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'ללא הגבלה';}
 function has(me,key){return me.role==='admin'||(me.permissions||[]).includes(key);}
 async function api(url,method,body){var opt={method:method||'GET',credentials:'same-origin',headers:{Accept:'application/json'}};if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}var r=await fetch(url,opt);var v=await r.json().catch(function(){return {};});if(!r.ok)throw Error(({permission_denied:'אין הרשאה',reauth_required:'האימות בוטל. נסה שנית',invalid_expiry:'יש לבחור תאריך תפוגה עתידי (עד שנה)',invalid_preset:'תפקיד לא מוכר',cannot_edit_yourself:'אין אפשרות לערוך את החשבון של עצמך',cannot_grant_unowned_permissions:'אין אפשרות לתת הרשאות שאין לך',cannot_manage_unowned_permissions:'אי אפשר לערוך הרשאות שאין לך',invalid_employee:'יש לבדוק את שם העובד והמייל',invalid_permissions:'בחירת הרשאות לא תקינה',account_not_eligible:'חשבון זה אינו מתאים',email_exists:'המייל כבר קיים במערכת',password_min_8:'סיסמה חייבת להכיל לפחות 8 תווים'})[v.error]||v.error||'הבקשה נכשלה');return v;}
 function dialog(title,render){var cover=el('div','emp-overlay'),panel=el('section','emp-modal'),h=el('div','emp-modal-heading'),x=button('✕','emp-quiet');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);h.append(el('h2','',title),x);panel.append(h);cover.append(panel);document.body.append(cover);function close(){document.removeEventListener('keydown',key);cover.remove();}function key(e){if(e.key==='Escape')close();}x.onclick=close;cover.onclick=function(e){if(e.target===cover)close();};document.addEventListener('keydown',key);render(panel,close);}
 function section(title){var b=el('section','emp-permission-group');b.append(el('h4','',title));return b;}
 async function render(root,me){
  root.replaceChildren(el('p','emp-note','טוען נתוני עובדים...'));
  try{
   var data=await Promise.all([api('/api/admin/employees/overview'),api('/api/admin/employees/catalog')]);
   var employees=data[0].employees||[],catalog=data[1].groups||[],presets=data[1].presets||{};
   var main=el('div','emp-page'),heading=el('div','emp-top'),copy=el('div');copy.append(el('h2','','עובדים והרשאות'),el('p','','תפקידים מוכנים, הרשאות זמניות ובקרה מדויקת על כל עובד.'));
   heading.append(copy);if(has(me,'employees.create')){var create=button('+ עובד חדש','emp-primary');create.onclick=function(){editor(null);};heading.append(create);}main.append(heading);
   var tools=el('div','emp-tabbar'),cards=el('div','emp-cards'),matrix=el('div','emp-matrix'),logs=el('div','emp-log');
   var views=[['employees','עובדים',cards],['matrix','ביקורת הרשאות',matrix],['audit','יומן פעולות',logs]];
   views.forEach(function(v){var b=button(v[1],'emp-tab');b.onclick=function(){views.forEach(function(z){z[2].hidden=z!==v;});tools.querySelectorAll('button').forEach(function(x){x.classList.toggle('is-current',x===b);});if(v[0]==='audit')showAudit(1);};tools.append(b);v[2].hidden=v!==views[0];if(v===views[0])b.classList.add('is-current');});main.append(tools,cards,matrix,logs);
   main.append(help('מדדי משימות שהושלמו משקפים את המשימות המשויכות כיום לעובד ומסומנות כהושלמו. היומן מתעד פעולות חדשות החל מהתקנת העדכון.'));
   root.replaceChildren(main);
   if(!employees.length)cards.append(el('p','emp-note','לא נוצרו עדיין עובדים.'));
   employees.forEach(function(staff){
     var card=el('article','emp-card'),head=el('div','emp-card-head'),txt=el('div');txt.append(el('h3','',staff.name),el('p','',staff.email));
     var expired=staff.expiresAt&&staff.expiresAt<=Date.now(),state=el('span','emp-state'+(staff.blocked||expired?' is-blocked':''),staff.blocked?'חסום':expired?'פג תוקף':'פעיל');head.append(txt,state);card.append(head);
     card.append(el('p','emp-summary',(presets[staff.preset]&&presets[staff.preset].label||'הרשאות מותאמות')+' · '+staff.permissions.length+' הרשאות'));
     card.append(el('p','emp-summary','תוקף: '+pdate(staff.expiresAt)));
     card.append(el('p','emp-summary','משימות משויכות שהושלמו: '+Number(staff.completedTasks||0)));
     card.append(el('p','emp-summary','משימות שסגר בפועל מאז העדכון: '+Number(staff.completedBy||0)));
     if(has(me,'employees.edit')||has(me,'employees.permissions')){var edit=button('עריכת עובד והרשאות','emp-outline');edit.disabled=Number(me.id)===staff.id;edit.onclick=function(){editor(staff);};card.append(edit);}
     cards.append(card);
   });
   function showMatrix(){
     matrix.replaceChildren(el('h3','','מי יכול לעשות מה?'));
     var scroll=el('div','emp-matrix-scroll'),table=el('table','emp-matrix-table'),head=el('tr');head.append(el('th','','הרשאה'));
     employees.forEach(function(e){head.append(el('th','',e.name));});table.append(head);
     catalog.forEach(function(group){group.actions.forEach(function(action){var row=el('tr');row.append(el('td','',group.title+' · '+action.label));employees.forEach(function(e){var active=!e.blocked&&(!e.expiresAt||e.expiresAt>Date.now());var yes=active&&e.permissions.includes(action.key);row.append(el('td',yes?'emp-yes':'emp-no',yes?'✓':'—'));});table.append(row);});});scroll.append(table);matrix.append(scroll);
   }
   showMatrix();
   async function showAudit(page){logs.replaceChildren(el('p','emp-note','טוען יומן...'));try{var result=await api('/api/admin/employees/audit?page='+page);logs.replaceChildren(el('h3','','יומן פעולות עובדים'));var records=result.items||[];if(!records.length){logs.append(help('אין עדיין פעולות מתועדות בטווח זה.'));return;}var list=el('div','emp-audit-list');records.forEach(function(a){var line=el('div','emp-audit-item'),meta=el('span','',pdate(a.at));line.append(el('strong','',a.actor+' · '+a.area),el('span','',a.action+' · '+a.summary),meta);list.append(line);});logs.append(list);var bar=el('div','emp-actions');if(page>1){var prev=button('הקודם');prev.onclick=function(){showAudit(page-1);};bar.append(prev);}if(records.length===50){var next=button('הבא');next.onclick=function(){showAudit(page+1);};bar.append(next);}logs.append(bar);}catch(e){logs.replaceChildren(el('p','emp-error',e.message));}}
   function editor(employee){
     var isEdit=!!employee,canDetails=has(me,'employees.edit'),canPermissions=has(me,'employees.permissions');
     dialog(isEdit?'עריכת עובד':'יצירת עובד',function(panel,close){
       var form=el('form','emp-form'),intro=el('p','emp-description',isEdit?'אפשר לשנות תפקיד, הרשאות, תוקף ולחסום או להחזיר עובד.':'בחר תפקיד מוכן או הרשאות ידניות.');form.append(intro);
       var name=field('שם','text',employee?.name||''),email=field('אימייל','email',employee?.email||'');name.input.required=true;email.input.required=true;name.input.maxLength=120;
       name.input.disabled=isEdit&&!canDetails;email.input.disabled=isEdit;
       form.append(name.wrap,email.wrap);
       var pw=field('סיסמה ליצירת חשבון חדש','password','');if(!isEdit){form.append(pw.wrap);form.append(help('אם משתמש עם המייל הזה כבר נרשם לאתר, אין צורך בסיסמה חדשה.'));}
       var status;if(isEdit&&canDetails){status=el('label','emp-check emp-block');var isBlocked=el('input');isBlocked.type='checkbox';isBlocked.checked=!!employee.blocked;status.append(isBlocked,el('span','',employee.blocked?'העובד חסום — בטל את הסימון כדי להפעילו מחדש':'חסום עובד ונתק את כל המכשירים שלו'));form.append(status);}
       var options=el('select');options.className='emp-select';options.append(new Option('התאמה אישית',''));
       Object.keys(presets).forEach(function(id){options.append(new Option(presets[id].label,id));});options.value=employee?.preset||'';
       var selWrap=el('label','emp-field');selWrap.append(el('span','','תפקיד מוכן מראש'),options);
       var expiry=field('גישה זמנית עד (אופציונלי)','datetime-local',employee?.expiresAt?new Date(employee.expiresAt-new Date(employee.expiresAt).getTimezoneOffset()*60000).toISOString().slice(0,16):'');
       if(canPermissions){form.append(selWrap,expiry.wrap);form.append(help('ללא תאריך — גישה ללא תפוגה. אם התאריך חלף, הגישה לאדמין פוקעת אוטומטית גם אם העובד עדיין מחובר.'));}
       var cloneSelect=el('select','emp-select');cloneSelect.append(new Option('ללא שכפול',''));
       employees.filter(function(e){return !employee||e.id!==employee.id;}).forEach(function(e){cloneSelect.append(new Option(e.name+' · '+e.email,String(e.id)));});
       var cloneWrap=el('label','emp-field');cloneWrap.append(el('span','','העתק הרשאות מעובד אחר'),cloneSelect);
       var current=employee?.permissions||['tasks.view','tasks.status'];
       var allowed=me.role==='admin'?null:me.permissions;
       var checkboxes=[];
       if(canPermissions){form.append(cloneWrap,el('h3','emp-section-title','הרשאות לפי פעולה'));var grid=el('div','emp-permission-grid');catalog.forEach(function(group){var sec=section(group.title);group.actions.forEach(function(action){var label=el('label','emp-check'),check=el('input');check.type='checkbox';check.value=action.key;check.checked=current.includes(action.key);check.disabled=!!allowed&&!allowed.includes(action.key);label.append(check,el('span','',action.label));sec.append(label);checkboxes.push(check);});grid.append(sec);});form.append(grid);
        function select(keys){checkboxes.forEach(function(cb){if(!cb.disabled)cb.checked=keys.includes(cb.value);});}
        options.onchange=function(){if(options.value)select(presets[options.value].permissions);};cloneSelect.onchange=function(){var other=employees.find(function(e){return String(e.id)===cloneSelect.value;});if(other){options.value='';select(other.permissions);expiry.input.value=other.expiresAt?new Date(other.expiresAt-new Date(other.expiresAt).getTimezoneOffset()*60000).toISOString().slice(0,16):'';}};
       }
       var error=el('p','emp-error'),actions=el('div','emp-actions'),cancel=button('ביטול','emp-quiet'),save=button(isEdit?'שמור שינויים':'צור עובד','emp-primary');save.type='submit';cancel.onclick=close;actions.append(cancel,save);form.append(error,actions);panel.append(form);
       form.onsubmit=async function(ev){ev.preventDefault();error.textContent='';save.disabled=true;try{
         var body=isEdit?{}:{name:name.input.value.trim(),email:email.input.value.trim(),password:pw.input.value};
         if(isEdit&&canDetails){body.name=name.input.value.trim();body.blocked=isBlocked.checked;}
         if(canPermissions){body.permissions=checkboxes.filter(function(cb){return cb.checked;}).map(function(cb){return cb.value;});body.preset=options.value;body.expiresAt=expiry.input.value?new Date(expiry.input.value).getTime():null;}
         if(!isEdit&&!canPermissions)body.permissions=[];
         await api(isEdit?'/api/admin/employees/'+employee.id:'/api/admin/employees',isEdit?'PATCH':'POST',body);
         close();await render(root,me);
       }catch(e){error.textContent=e.message;save.disabled=false;}};
     });
   }
  }catch(e){root.replaceChildren(el('div','admin-tools-error','לא הצלחנו לטעון עובדים: '+e.message));}
 }
 window.VersansAdminEmployees={render:render};
})();
