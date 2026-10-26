(function(){
'use strict';
const STATUS={open:'פתוחה',in_progress:'בטיפול',waiting:'ממתינה',closed:'נסגרה'};
const REASON={shipping:'משלוח',damaged:'מוצר פגום',size:'מידה',cancellation:'ביטול / החזרה',warranty:'אחריות',billing:'תשלום',other:'אחר'};
const REPLACE={requested:'בקשה נפתחה',approved:'אושרה',preparing:'בהכנה',shipped:'נשלחה',delivered:'נמסרה',rejected:'נדחתה'};
const el=(name,cls,text)=>{const n=document.createElement(name);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const append=(p,...children)=>{children.filter(Boolean).forEach(x=>p.append(x));return p;};
const stamp=x=>x?new Date(Number(x)).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}):'—';
const num=x=>Number(x||0).toLocaleString('he-IL');
const request=async(url,method='GET',body)=>{const r=await fetch(url,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'הבקשה נכשלה ('+r.status+')');return d;};
const base='/api/admin/support';
const opts=(select,values,selected)=>{values.forEach(([v,t])=>{const o=el('option','',t);o.value=v;o.selected=String(v)===String(selected);select.append(o);});return select;};
const field=(label,node)=>append(el('label','support-field'),el('span','',label),node);
const textInput=(value='',type='text',placeholder='')=>{const input=el('input');input.type=type;input.value=value==null?'':String(value);input.placeholder=placeholder;return input;};
const area=(value='',placeholder='')=>{const a=el('textarea');a.rows=3;a.value=value;a.placeholder=placeholder;return a;};
const button=(label,fn,css='support-btn')=>{const b=el('button',css,label);b.type='button';b.addEventListener('click',fn);return b;};
const panel=(title,sub)=>{const p=el('section','support-panel');p.append(el('h2','',title));if(sub)p.append(el('p','support-muted',sub));return p;};
const alert=(message,kind='info')=>{flashNotice={message,kind};const n=document.getElementById('support-flash');if(n){n.textContent=message;n.dataset.kind=kind;n.hidden=false;}};
let flashNotice=null;
const state={status:'all',reason:'all',q:'',offset:0,selected:0,ticket:null,staff:[],templates:[],can:{},container:null};
async function save(url,method,body,success){try{await request(url,method,body);alert(success||'השינויים נשמרו','success');await refresh();}catch(e){alert('לא ניתן לשמור: '+e.message,'error');}}
function statCards(data){const grid=el('div','support-stats');[
  ['פתוחות',data.statuses.open],['בטיפול',data.statuses.in_progress],['ממתינות',data.statuses.waiting],['סגורות',data.statuses.closed],['לא נענו בזמן',data.overdue],['זמן תגובה ראשון ממוצע',data.averageFirstResponseMinutes==null?'אין מדידה':num(data.averageFirstResponseMinutes)+' דקות']
].forEach(([title,value])=>{const c=el('div','support-stat');c.append(el('small','',title),el('strong','',typeof value==='number'?num(value):value));grid.append(c);});return grid;}
function summary(data){const p=panel('סיבות פנייה','חלוקה לפי סיבה על סמך פניות שנרשמו במערכת');const grid=el('div','support-reasons');(data.reasons||[]).forEach(r=>{const d=el('div','support-reason');d.append(el('span','',REASON[r.reason]||r.reason),el('strong','',num(r.count)));grid.append(d);});p.append(grid);return p;}
function createForm(){const det=el('details','support-form');const sum=el('summary','','+ פנייה חדשה');det.append(sum);const f=el('form','support-form-grid');const subject=textInput('', 'text','למשל: לקוח קיבל מוצר פגום');subject.required=true;
 const reason=opts(el('select'),Object.entries(REASON),'shipping');const customerId=textInput('','number','מספר לקוח (רשות)');customerId.min='1';const orderRef=textInput('','text','מספר הזמנה (רשות)');
 const name=textInput('','text','שם הלקוח');const email=textInput('','email','מייל');const phone=textInput('','tel','טלפון');const responsible=assigneeSelect(null);
 const description=area('','תיאור הבעיה או פרטי הפנייה');const reminder=textInput('24','number');reminder.min=1;reminder.max=720;
 f.append(field('נושא',subject),field('סיבת פנייה',reason),field('מספר הזמנה',orderRef),field('מזהה לקוח רשום',customerId),field('שם לקוח',name),field('מייל',email),field('טלפון',phone));
 if(state.can.assign)f.append(field('עובד אחראי',responsible));f.append(field('תזכורת לאחר כמה שעות ללא מענה',reminder),field('פנייה ראשונית',description));
 const submit=el('button','support-btn support-primary','פתח פנייה');submit.type='submit';f.append(submit);f.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const payload={subject:subject.value,reason:reason.value,customerId:customerId.value||null,orderRef:orderRef.value,customerName:name.value,customerEmail:email.value,customerPhone:phone.value,reminderHours:Number(reminder.value),body:description.value};if(state.can.assign)payload.assigneeId=responsible.value||null;
  const d=await request(base+'/tickets','POST',payload);state.selected=d.ticket.id;det.open=false;alert('הפנייה נוצרה','success');await refresh();}catch(err){alert(err.message,'error');}finally{submit.disabled=false;}});
 det.append(f);return det;}
function assigneeSelect(id){const select=el('select');opts(select,[['','לא משויך'],...state.staff.map(s=>[String(s.id),s.name+' · '+s.email])],id||'');return select;}
function table(data){const block=panel('פניות לקוחות',num(data.count)+' פניות מתאימות לסינון');const scroll=el('div','support-table-scroll');const tbl=el('table','support-table');const h=el('tr');['מס׳','נושא','לקוח','סיבה','סטטוס','אחראי','מענה','עודכן'].forEach(x=>h.append(el('th','',x)));tbl.append(append(el('thead'),h));const body=el('tbody');
 (data.tickets||[]).forEach(t=>{const tr=el('tr',t.id===state.selected?'selected':'');const subject=button(t.subject,()=>openTicket(t.id),'support-link');
 const overdue=t.overdue?'באיחור':t.lastStaffAt&&t.lastStaffAt>=t.lastCustomerAt?'נענה':'ממתין';
 [t.id,subject,t.customerName||t.customerEmail||'—',REASON[t.reason]||t.reason,STATUS[t.status]||t.status,t.assigneeName||'לא משויך',overdue,stamp(t.updatedAt)].forEach(v=>{const cell=el('td');if(v instanceof Node)cell.append(v);else cell.textContent=String(v);tr.append(cell);});body.append(tr);});tbl.append(body);scroll.append(tbl);block.append(scroll);
 if(!data.tickets.length)block.append(el('p','support-muted','אין פניות התואמות לסינון.'));
 const paging=el('div','support-pagination');paging.append(el('span','',num(data.offset+1)+'–'+num(Math.min(data.count,data.offset+data.limit))+' מתוך '+num(data.count)));
 paging.append(button('הקודם',()=>{state.offset=Math.max(0,state.offset-30);refresh();}),button('הבא',()=>{state.offset+=30;refresh();}));paging.children[1].disabled=state.offset===0;paging.children[2].disabled=state.offset+data.limit>=data.count;block.append(paging);return block;}
function templateSection(){const d=el('details','support-panel support-fold');d.append(el('summary','','תבניות תשובה ל־WhatsApp ולמייל'));const body=el('div','support-template-grid');state.templates.forEach(t=>{const c=el('div','support-template');c.append(el('strong','',t.title+' · '+(t.channel==='email'?'מייל':'WhatsApp')),el('p','',t.body));
 c.append(button('השתמש בטיוטה',()=>{if(!state.ticket){alert('בחר קודם פנייה');return;}openExternalReply(t);}),button('העתק טקסט',()=>navigator.clipboard&&navigator.clipboard.writeText(expand(t.body,state.ticket?.ticket||{})).then(()=>alert('הטקסט הועתק'))));
 if(state.can.templates)c.append(button('ערוך',()=>templateEditor(t),'support-textbtn'));body.append(c);});
 if(state.can.templates)body.append(button('+ תבנית חדשה',()=>templateEditor(null),'support-btn support-primary'));d.append(body);return d;}
function expand(str,t){return String(str||'').replace(/\{name\}/g,t.customerName||'לקוח').replace(/\{order\}/g,t.orderRef||'');}
function openExternalReply(t){const ticket=state.ticket?.ticket;if(!ticket){alert('פתח פנייה קודם');return;}const msg=expand(t.body,ticket);let href='';
 if(t.channel==='email'){if(!ticket.customerEmail){alert('לא הוגדר מייל ללקוח','error');return;}href='mailto:'+encodeURIComponent(ticket.customerEmail)+'?subject='+encodeURIComponent(ticket.subject)+'&body='+encodeURIComponent(msg);}
 else{const phone=String(ticket.customerPhone||'').replace(/\D/g,'');const normalized=phone.startsWith('0')?'972'+phone.slice(1):phone;if(!normalized){alert('לא הוגדר טלפון ללקוח','error');return;}href='https://wa.me/'+normalized+'?text='+encodeURIComponent(msg);}
 // External composer is not proof of delivery; a separate action logs the reply.
 window.open(href,'_blank','noopener,noreferrer');alert('נפתחה טיוטה. לאחר השליחה בפועל, רשום תגובה בפנייה כדי לעדכן את זמן המענה.');}
function templateEditor(existing){const title=prompt('שם התבנית',existing?.title||'');if(title===null||!title.trim())return;const channel=prompt('ערוץ: whatsapp או email',existing?.channel||'whatsapp');if(!['whatsapp','email'].includes(channel))return alert('ערוץ לא תקין','error');const body=prompt('תוכן התבנית. ניתן להשתמש ב-{name}, {order}',existing?.body||'שלום {name},');if(!body)return;save(base+'/templates'+(existing?'/'+existing.id:''),existing?'PUT':'POST',{title,channel,body},'התבנית נשמרה');}
async function openTicket(id){state.selected=Number(id);try{state.ticket=await request(base+'/tickets/'+id);await renderDetail();history.replaceState(null,'',window.location.pathname+'?ticket='+id);}catch(e){alert(e.message,'error');}}
function linkedRow(t){const box=el('div','support-links');if(t.customerId){const a=el('a','', 'פרופיל לקוח #'+t.customerId);a.href='/admin/customers?customer='+t.customerId;box.append(a);}if(t.orderRef){const a=el('a','','הזמנה '+t.orderRef);a.href='/admin/order-work?order='+encodeURIComponent(t.orderRef);box.append(a);}return box;}
async function renderDetail(){const existing=state.container.querySelector('#support-detail');if(existing)existing.remove();const data=state.ticket;if(!data)return;const t=data.ticket;const p=panel('פנייה #'+t.id+' · '+t.subject,'נפתחה '+stamp(t.openedAt)+' · עודכנה '+stamp(t.updatedAt));p.id='support-detail';p.append(linkedRow(t));
 const info=el('div','support-info');[['לקוח',t.customerName||'—'],['מייל',t.customerEmail||'—'],['טלפון',t.customerPhone||'—'],['סיבה',REASON[t.reason]],['זמן תגובה ראשונה',t.firstResponseAt?num(Math.round((t.firstResponseAt-t.openedAt)/60000))+' דקות':'אין מענה מתועד']].forEach(([l,v])=>{const b=el('div');b.append(el('small','',l),el('strong','',v));info.append(b);});p.append(info);
 const form=el('div','support-detail-controls');const status=opts(el('select'),Object.entries(STATUS),t.status),reminder=textInput(t.reminderHours,'number');reminder.min=1;reminder.max=720;
 if(state.can.edit){form.append(field('סטטוס',status),field('תזכורת אחרי שעות',reminder),button('עדכן סטטוס ותזכורת',()=>save(base+'/tickets/'+t.id,'PATCH',{status:status.value,reminderHours:Number(reminder.value)},'הפנייה עודכנה'),'support-btn support-primary'));}
 if(state.can.assign){const assignee=assigneeSelect(t.assigneeId);form.append(field('שיוך לעובד',assignee),button('שמור אחראי',()=>save(base+'/tickets/'+t.id,'PATCH',{assigneeId:assignee.value||null},'האחראי עודכן')));}
 p.append(form);
 const communication=el('div','support-columns');const conversations=el('div');conversations.append(el('h3','','תיעוד שיחות ותגובות'));
 const feed=el('div','support-feed');(data.messages||[]).forEach(m=>{const b=el('div','support-message support-message-'+m.kind);b.append(el('strong','',m.kind==='customer'?'הודעת לקוח':m.kind==='staff'?'תגובת עובד שנרשמה':'הערה פנימית'),el('small','',m.actor+' · '+m.channel+' · '+stamp(m.createdAt)),el('p','',m.body));feed.append(b);});if(!data.messages.length)feed.append(el('p','support-muted','עדיין אין הודעות מתועדות.'));conversations.append(feed);
 if(state.can.edit){const body=area('','תוכן ההודעה או הערה');const kind=opts(el('select'),[['customer','לקוח פנה'],['staff','תגובה שכבר נשלחה'],['note','הערה פנימית']],'note');const channel=opts(el('select'),[['internal','פנימי / אחר'],['email','מייל'],['whatsapp','WhatsApp'],['phone','טלפון']],'internal');const messageForm=el('div','support-compose');messageForm.append(field('סוג תיעוד',kind),field('ערוץ',channel),field('תוכן',body));messageForm.append(button('שמור תיעוד',()=>save(base+'/tickets/'+t.id+'/messages','POST',{kind:kind.value,channel:channel.value,body:body.value},'התגובה נשמרה'),'support-btn support-primary'));conversations.append(messageForm);}
 const other=el('div');other.append(el('h3','','החלפת מוצר פגום / אחריות'));const r=data.replacement;
 if(state.can.replacement){const pname=textInput(r?.product_name||'');const qty=textInput(r?.quantity||1,'number');qty.min=1;const st=opts(el('select'),Object.entries(REPLACE),r?.status||'requested');const tracking=textInput(r?.tracking_number||'');const notes=area(r?.notes||'');
 const replaceForm=el('div','support-compose');replaceForm.append(field('מוצר להחלפה',pname),field('כמות',qty),field('מצב ההחלפה',st),field('מספר מעקב חדש',tracking),field('הערות',notes));replaceForm.append(button('שמור טיפול בהחלפה',()=>save(base+'/tickets/'+t.id+'/replacement','POST',{productName:pname.value,quantity:Number(qty.value),status:st.value,trackingNumber:tracking.value,notes:notes.value},'מצב ההחלפה נשמר'),'support-btn support-primary'));other.append(replaceForm);
 }else other.append(el('p','support-muted',r?'מצב: '+(REPLACE[r.status]||r.status)+' · '+r.product_name:'אין החלפת מוצר מתועדת'));
 other.append(el('h3','','היסטוריית פעולות'));const hist=el('div','support-history');(data.history||[]).forEach(h=>{const line=el('p');line.append(el('strong','',h.actor+' · '+h.action+' '),el('span','',h.detail+' · '+stamp(h.createdAt)));hist.append(line);});other.append(hist);communication.append(conversations,other);p.append(communication);
 // Replace existing detail and keep scroll anchored on the ticket.
 state.container.append(p);p.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function refresh(){const root=state.container;if(!root)return;const earlier=state.selected;
 try{const [overview,list,templates,staff]=await Promise.all([request(base+'/overview'),request(base+'/tickets?status='+encodeURIComponent(state.status)+'&reason='+encodeURIComponent(state.reason)+'&q='+encodeURIComponent(state.q)+'&offset='+state.offset+'&limit=30'),request(base+'/templates'),request(base+'/assignees')]);
  state.templates=templates.templates||[];state.staff=staff.assignees||[];
  const flash=el('div','support-flash');flash.id='support-flash';flash.hidden=!flashNotice;if(flashNotice){flash.textContent=flashNotice.message;flash.dataset.kind=flashNotice.kind;flashNotice=null;}
  root.replaceChildren(flash,el('h1','support-heading','שירות לקוחות ואחריות'),statCards(overview.overview));
  const toolbar=el('div','support-toolbar');const status=opts(el('select'),[['all','כל הפניות'],...Object.entries(STATUS)],state.status);status.onchange=()=>{state.status=status.value;state.offset=0;refresh();};
  const reason=opts(el('select'),[['all','כל הסיבות'],...Object.entries(REASON)],state.reason);reason.onchange=()=>{state.reason=reason.value;state.offset=0;refresh();};
  const input=textInput(state.q,'search','חיפוש פנייה, מייל, הזמנה');const submit=button('חפש',()=>{state.q=input.value.trim();state.offset=0;refresh();});input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit.click();}};
  toolbar.append(field('סטטוס',status),field('סיבה',reason),field('חיפוש',input),submit);root.append(toolbar);
  if(state.can.edit)root.append(createForm());root.append(table(list),summary(overview.overview),templateSection());
  if(earlier){try{state.ticket=await request(base+'/tickets/'+earlier);await renderDetail();}catch(e){state.ticket=null;}}
 }catch(e){root.replaceChildren(el('div','support-error','לא ניתן לטעון פניות: '+e.message));}}
async function render(container,permissions){state.container=container;state.can=permissions||{};state.selected=Number(new URLSearchParams(location.search).get('ticket'))||0;await refresh();}
window.VersansSupport={render};
})();
