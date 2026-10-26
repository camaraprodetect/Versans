(function(){'use strict';
 const labels={waiting:'ממתינה',ordered:'בהזמנה',inbound:'בדרך למחסן',received:'נקלטה',packing:'באריזה',shipped:'נשלחה',delivered:'נמסרה'};
 const steps=['waiting','ordered','inbound','received','packing','shipped','delivered'];
 const el=(tag,css,text)=>{const n=document.createElement(tag);if(css)n.className=css;if(text!=null)n.textContent=String(text);return n;};
 const button=(name,fn,css='vsop-button')=>{const n=el('button',css,name);n.type='button';n.addEventListener('click',fn);return n;};
 const box=(title,sub)=>{const n=el('section','vsop-section');n.append(el('h3','',title));if(sub)n.append(el('p','vsop-muted',sub));return n;};
 const fmt=v=>v?new Date(Number(v)).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}):'—';
 const ago=ms=>{const hours=Math.floor(Number(ms||0)/3600000);return hours<1?Math.floor(ms/60000)+' דקות':hours<48?hours+' שעות':Math.floor(hours/24)+' ימים ו־'+hours%24+' שעות';};
 const request=async(path,method='GET',body)=>{const resp=await fetch(path,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await resp.json().catch(()=>({}));if(!resp.ok)throw Error(data.error||'שגיאה '+resp.status);return data;};
 const base=ref=>'/api/admin/orders/'+encodeURIComponent(ref)+'/workflow';
 let active=null;
 function open(orderRef,canEdit){
   close();const overlay=el('div','vsop-overlay'),panel=el('section','vsop-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','ניהול תפעולי להזמנה');panel.dir='rtl';
   const state={ref:orderRef,canEdit:!!canEdit,overlay,panel,loading:false,owned:false,claiming:false};active=state;
   overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
   overlay.append(panel);document.body.append(overlay);load(state);
 }
 async function close(){const old=active;active=null;if(!old)return;old.overlay.remove();if(old.owned)request(base(old.ref)+'/lock','POST',{action:'release'}).catch(()=>{});}
 function flash(state,msg,bad=false){let x=state.panel.querySelector('.vsop-alert');if(!x){x=el('div','vsop-alert');state.panel.prepend(x);}x.textContent=String(msg);x.dataset.bad=bad?'true':'false';}
 async function apply(state,path,payload){if(state.loading)return;state.loading=true;try{await request(base(state.ref)+path,'POST',payload);await load(state);}catch(e){flash(state,e.message,true);}finally{state.loading=false;}}
 async function load(state){try{const data=await request(base(state.ref));if(active!==state)return;render(state,data.workflow);}catch(e){state.panel.replaceChildren(el('h2','',state.ref),button('× סגור',close),el('p','vsop-error','שגיאה בטעינה: '+e.message));}}
 function render(state,w){const p=state.panel;p.replaceChildren();
   const head=el('header','vsop-head');const title=el('div');title.append(el('small','','טיפול בהזמנה'),el('h2','',w.orderRef));head.append(title,button('× סגור',close,'vsop-close'));p.append(head);
   const top=el('div','vsop-badges');top.append(el('strong','vsop-current','סטטוס תפעולי: '+w.stageLabel),el('span','','בשלב הזה: '+ago(w.elapsedMs)));
   if(w.overdue)top.append(el('strong','vsop-warning','⚠ ההזמנה לא התקדמה יותר מ־24 שעות'));p.append(top);
   if(w.lock){const locked=el('p','vsop-lock','בטיפול: '+w.lock.actor+' · עד '+fmt(w.lock.expiresAt));p.append(locked);}
   if(state.canEdit){const lockBar=el('div','vsop-actions');lockBar.append(button('🔒 תפוס טיפול / הארך נעילה',async()=>{try{await request(base(state.ref)+'/lock','POST',{action:'claim'});state.owned=true;await load(state);}catch(e){flash(state,e.message,true);}}));lockBar.append(button('שחרר טיפול',async()=>{try{await request(base(state.ref)+'/lock','POST',{action:'release'});state.owned=false;await load(state);}catch(e){flash(state,e.message,true);}}));p.append(lockBar);}
   if(w.duplicates&&w.duplicates.length){const d=box('ייתכן שיש הזמנה כפולה','התראה לבדיקה בלבד — לא בוטלה ולא נחסמה הזמנה.');w.duplicates.forEach(x=>{const a=el('a','','הזמנה '+x.orderRef+' · '+fmt(x.createdAt));a.href='/admin/order-work?order='+encodeURIComponent(x.orderRef);d.append(a);});p.append(d);}
   const stages=box('ציר זמן ושלבים','נתוני הגעה למחסן נגזרים מסריקות; שליחת מוצר ללקוח ומסירה דורשות אסמכתה ידנית.');
   const path=el('ol','vsop-stages');steps.forEach((step,i)=>{const li=el('li','vsop-step'+(steps.indexOf(w.stage)>=i?' is-reached':''),labels[step]);const related=(w.timeline||[]).filter(x=>x.stage===step);if(related.length){li.append(el('small','',related.map(x=>fmt(x.at)).join(' · ')));const durations=(w.stageDurations||[]).filter(x=>x.stage===step);if(durations.length)li.append(el('small','','משך מתועד: '+ago(durations.reduce((n,x)=>n+x.durationMs,0))));}path.append(li);});stages.append(path);p.append(stages);
   if(state.canEdit){const stageBar=el('div','vsop-actions');
    if(['waiting','ordered'].includes(w.stage))stageBar.append(button('סמן: בהזמנה',()=>apply(state,'/stage',{stage:'ordered'})));
    if(w.received===w.total&&w.total>0&&['received','packing'].includes(w.stage))stageBar.append(button('סמן: באריזה',()=>apply(state,'/stage',{stage:'packing'})));
    if(w.verifiedAt&&!['shipped','delivered'].includes(w.stage))stageBar.append(button('אישור יציאה ללקוח',()=>{const proof=prompt('מספר מעקב ללקוח / אסמכתה ליציאת החבילה:');if(proof)apply(state,'/stage',{stage:'shipped',proof});}));
    if(w.stage==='shipped')stageBar.append(button('אישור מסירה ללקוח',()=>{const proof=prompt('אסמכתת מסירה ללקוח (מינימום 4 תווים):');if(proof)apply(state,'/stage',{stage:'delivered',proof});}));
    if(stageBar.children.length)stages.append(stageBar);
   }
   const packing=box('התאמה בין הזמנה לאריזה',w.received+' מתוך '+w.total+' יחידות נקלטו במחסן · '+w.packed+' נבדקו באריזה.');
   const list=el('div','vsop-pack-list');const checked=new Set((w.packedUnits||[]).map(x=>x.itemIndex+':'+x.unitNumber));
   (w.items||[]).forEach(item=>{const line=el('div','vsop-pack-line');line.append(el('strong','',item.name+' · '+item.qty+' יחידות'),el('small','','נקלטו '+item.received+' · נבדקו '+item.packed));
     if(state.canEdit){const units=el('div','vsop-unit-buttons');for(let unit=1;unit<=item.qty;unit++){const key=item.itemIndex+':'+unit,yes=checked.has(key);units.append(button('יחידה '+unit+(yes?' ✓':''),()=>apply(state,'/units',{itemIndex:item.itemIndex,unitNumber:unit,checked:!yes}),'vsop-unit'+(yes?' is-checked':'')));}line.append(units);}list.append(line);});packing.append(list);
   if(w.verifiedAt)packing.append(el('p','vsop-ok','✓ אריזה אומתה על ידי '+w.verifiedBy+' · '+fmt(w.verifiedAt)));
   else if(state.canEdit){const btn=button('אמת שכל היחידות נארזו',()=>apply(state,'/verify',{}),'vsop-button vsop-primary');btn.disabled=!w.canVerify;btn.title=w.canVerify?'':'יש לקלוט ולבדוק כל יחידה לפני אישור';packing.append(btn);}
   p.append(packing);
   const notes=box('הערות פנימיות','הערות אלו מיועדות לצוות בלבד — הן לא יופיעו ללקוח.');
   if(state.canEdit){const area=el('textarea');area.rows=3;area.placeholder='כתוב הערה פנימית להזמנה';notes.append(area,button('שמור הערה',()=>{const value=area.value.trim();if(value)apply(state,'/notes',{body:value});}));}
   (w.notes||[]).forEach(n=>{const div=el('p','vsop-note');div.append(el('strong','',n.actor+' · '+fmt(n.createdAt)+' '),document.createTextNode(n.body));notes.append(div);});p.append(notes);
   const service=box('ביטול, החזרה או זיכוי','מעבר למסכי הטיפול הקיימים, עם מספר ההזמנה. זיכוי בפועל אינו מתבצע דרך מסך זה.');
   if(state.canEdit){
     const reqGroup=el('div','vsop-service-create');const type=el('select');[['cancellation','ביטול או החזרה'],['damaged','מוצר פגום'],['shipping','בעיית משלוח'],['size','שינוי מידה']].forEach(([v,l])=>{const o=el('option','',l);o.value=v;type.append(o);});const details=el('textarea');details.rows=2;details.placeholder='תיאור פניית הלקוח כפי שנמסרה';
     reqGroup.append(type,details,button('פתח פנייה מקושרת להזמנה',async()=>{if(!details.value.trim())return flash(state,'יש להזין פירוט פנייה',true);try{const data=await request('/api/admin/support/tickets','POST',{subject:'טיפול בהזמנה '+state.ref,reason:type.value,orderRef:state.ref,body:details.value.trim()});flash(state,'פנייה #'+data.ticket.id+' נפתחה בהצלחה. אפשר להמשיך במרכז שירות לקוחות.');}catch(e){flash(state,'יצירת פנייה: '+e.message,true);}}));
     service.append(reqGroup);
     const refund=el('div','vsop-refund');const amount=el('input');amount.type='number';amount.step='0.01';amount.min='0.01';amount.max=(w.amountAgorot/100).toFixed(2);amount.placeholder='סכום ₪';const ref=el('input');ref.type='text';ref.placeholder='אסמכתת סליקה (אם קיימת)';const note=el('input');note.placeholder='סיבת הזיכוי';
     refund.append(el('strong','','תיעוד בקשת זיכוי — לא מעביר כסף'),amount,ref,note,button('צור רישום זיכוי ממתין',async()=>{const val=Number(amount.value);if(!Number.isFinite(val)||val<=0||val>w.amountAgorot/100)return flash(state,'סכום לא תקין',true);try{const id=state.refundRequestId||(state.refundRequestId=crypto.randomUUID());const result=await request('/api/admin/finance/refunds','POST',{orderRef:state.ref,amount:val.toFixed(2),providerReference:ref.value.trim(),note:note.value.trim(),requestId:id});flash(state,'בקשת זיכוי #'+result.id+' נרשמה כממתינה. בדוק את המצב והאישור מול HYP במערכת הכנסות.');}catch(e){flash(state,'יצירת זיכוי: '+e.message,true);}}));service.append(refund);
   }
   const a=el('a','','פתח פנייה / החזרה בשירות לקוחות');a.href='/admin/support?order='+encodeURIComponent(state.ref);service.append(a);
   const b=el('a','','פתח רישום החזרים וזיכויים');b.href='/admin/income?order='+encodeURIComponent(state.ref);service.append(b);p.append(service);
   const hist=box('היסטוריית שינויים','הפעולות החדשות מתחילות להירשם מהתקנת העדכון; לא נוצרת היסטוריה בדיעבד.');(w.audit||[]).forEach(x=>hist.append(el('p','vsop-history',fmt(x.createdAt)+' · '+x.actor+' · '+x.action+' · '+x.details)));p.append(hist);
 }
 window.VersansOrderWorkflow={open,close};
})();
