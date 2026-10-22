(function(){
  'use strict';
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
  function append(p){for(var i=1;i<arguments.length;i++)if(arguments[i])p.append(arguments[i]);return p;}
  async function call(url,method,body){
    var options={method:method||'GET',credentials:'same-origin',headers:{Accept:'application/json'}};
    if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
    var r=await fetch(url,options),v=await r.json().catch(function(){return {};});
    if(!r.ok)throw Error(({permission_denied:'אין הרשאה לביצוע הפעולה',cannot_edit_yourself:'לא ניתן לערוך את החשבון שלך',cannot_grant_unowned_permissions:'אפשר לתת לעובד רק הרשאות שבידיך',cannot_manage_unowned_permissions:'אי אפשר לשנות הרשאות שאינן בבעלותך',email_exists:'האימייל כבר רשום באתר',account_not_eligible:'החשבון כבר משויך לתפקיד אחר או חסום',password_min_8:'לעובד חדש חייבים להזין סיסמה של 8 תווים לפחות',invalid_employee:'נא לבדוק את פרטי העובד',invalid_permissions:'הרשאות לא תקינות'})[v.error]||v.error||'שגיאה');
    return v;
  }
  function field(title,type,value,required){var label=el('label','emp-field'),input=el('input');input.type=type;input.value=value||'';input.required=!!required;append(label,el('span','',title),input);return {label:label,input:input};}
  function control(label,kind){var b=el('button','emp-button '+(kind||''),label);b.type='button';return b;}
  function has(me,key){return me.role==='admin'||me.permissions.indexOf(key)>=0;}
  function permissionGrid(catalog,allowed,current){
    var area=el('div','emp-permission-grid'),checkboxes=[];
    catalog.forEach(function(group){
      var block=el('section','emp-permission-group');append(block,el('h4','',group.title));
      group.actions.forEach(function(action){
        var line=el('label','emp-check'),input=el('input');input.type='checkbox';input.value=action.key;
        input.checked=current.indexOf(action.key)>=0;
        input.disabled=allowed && allowed.indexOf(action.key)<0;
        append(line,input,el('span','',action.label));block.append(line);checkboxes.push(input);
      });area.append(block);
    });
    return {area:area,values:function(){return checkboxes.filter(function(e){return e.checked;}).map(function(e){return e.value;});}};
  }
  function openDialog(title,render){
    var shade=el('div','emp-overlay'),panel=el('section','emp-modal'),heading=el('div','emp-modal-heading'),close=control('✕','emp-quiet');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);append(heading,el('h2','',title),close);append(panel,heading);shade.append(panel);document.body.append(shade);
    function dismiss(){shade.remove();document.removeEventListener('keydown',onKey);}
    function onKey(e){if(e.key==='Escape')dismiss();}
    close.onclick=dismiss;shade.onclick=function(e){if(e.target===shade)dismiss();};document.addEventListener('keydown',onKey);render(panel,dismiss);
  }
  async function render(root,me){
    root.replaceChildren(el('div','admin-tools-empty','טוען עובדים והרשאות...'));
    try{
      var results=await Promise.all([call('/api/admin/employees'),call('/api/admin/employees/catalog')]);
      var employees=results[0].employees||[],catalog=results[1].groups||[];
      var wrap=el('section','emp-page'),head=el('div','emp-top'),heading=el('div');
      append(heading,el('h2','','עובדים והרשאות'),el('p','','כל עובד מקבל רק את הגישות שסימנת. ניתן לשנות אותן בכל זמן.'));
      head.append(heading);if(has(me,'employees.create')){var add=control('+ הוספת עובד','emp-primary');add.onclick=function(){editor(null);};head.append(add);}
      wrap.append(head);
      var info=el('div','emp-note','עובד חדש יקבל גישה למשימות האישיות ושינוי סטטוס בלבד, אלא אם נבחרו הרשאות נוספות. פעולות ללא הרשאה חסומות גם בשרת.');wrap.append(info);
      if(!employees.length)wrap.append(el('div','admin-tools-empty','עדיין לא נוצרו עובדים.'));
      var grid=el('div','emp-cards');employees.forEach(function(staff){
        var card=el('article','emp-card'),top=el('div','emp-card-head'),name=el('div');append(name,el('h3','',staff.name),el('p','',staff.email));
        append(top,name,el('span','emp-state'+(staff.blocked?' is-blocked':''),staff.blocked?'חסום':'פעיל'));card.append(top);
        var grant=el('p','emp-summary',staff.permissions.length?staff.permissions.length+' הרשאות פעילות':'ללא הרשאות');card.append(grant);
        if(has(me,'employees.edit')||has(me,'employees.permissions')){
          var btn=control('עריכת עובד והרשאות','emp-outline');btn.disabled=me.id===staff.id;btn.onclick=function(){editor(staff);};card.append(btn);
        }
        grid.append(card);
      });wrap.append(grid);root.replaceChildren(wrap);
      function editor(employee){
        var isEdit=!!employee,canEdit=has(me,'employees.edit'),canPermissions=has(me,'employees.permissions');
        openDialog(isEdit?'עריכת עובד':'הוספת עובד',function(panel,close){
          var form=el('form','emp-form'),intro=el('p','emp-description',isEdit?'עדכן את פרטי העובד ובחר את ההרשאות שיופיעו לו.':'אפשר לבחור משתמש שכבר נרשם באתר, או ליצור חשבון חדש עם סיסמה.');
          var name=field('שם העובד','text',employee&&employee.name,true),email=field('כתובת אימייל','email',employee&&employee.email,true),password=field('סיסמה (רק ביצירת חשבון חדש)','password','',false);
          name.input.maxLength=120;email.input.disabled=isEdit;name.input.disabled=isEdit&&!canEdit;
          form.append(intro,name.label,email.label);
          if(!isEdit)form.append(password.label);
          if(!isEdit)form.append(el('p','emp-help','אם החשבון כבר קיים, לא צריך להזין סיסמה. אם הוא חדש, נדרשת סיסמה של לפחות 8 תווים.'));
          var blocked;
          if(isEdit&&canEdit){var row=el('label','emp-check emp-block');blocked=el('input');blocked.type='checkbox';blocked.checked=employee.blocked;append(row,blocked,el('span','','חסום גישה לעובד'));form.append(row);}
          var allowed=me.role==='admin'?null:me.permissions;
          var current=isEdit?employee.permissions:['tasks.view','tasks.status'].filter(function(k){return !allowed||allowed.indexOf(k)>=0;});
          if(canPermissions){append(form,el('h3','emp-section-title','בחירת הרשאות'));var choices=permissionGrid(catalog,allowed,current);form.append(choices.area);}
          else if(isEdit){form.append(el('p','emp-help','אין לך הרשאה לשנות הרשאות. רק פרטי העובד ניתנים לעריכה.'));}
          var error=el('p','emp-error'),actions=el('div','emp-actions'),cancel=control('ביטול','emp-quiet'),submit=control(isEdit?'שמור שינויים':'צור עובד','emp-primary');submit.type='submit';cancel.onclick=close;append(actions,cancel,submit);append(form,error,actions);panel.append(form);
          form.onsubmit=async function(event){event.preventDefault();submit.disabled=true;error.textContent='';
            try{
              var body=isEdit?{}:{email:email.input.value.trim(),name:name.input.value.trim(),password:password.input.value};
              if(isEdit&&canEdit){body.name=name.input.value.trim();body.blocked=blocked.checked;}
              if(canPermissions)body.permissions=choices.values();
              else if(!isEdit)body.permissions=[];
              await call(isEdit?'/api/admin/employees/'+employee.id:'/api/admin/employees',isEdit?'PATCH':'POST',body);
              close();await render(root,me);
            }catch(e){error.textContent=e.message;submit.disabled=false;}
          };
        });
      }
    }catch(e){root.replaceChildren(el('div','admin-tools-error','שגיאה בטעינת העובדים: '+e.message));}
  }
  window.VersansAdminEmployees={render:render};
})();
