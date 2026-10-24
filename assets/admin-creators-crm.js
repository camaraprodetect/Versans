/* VerSans admin creator relationship manager. All text nodes use textContent. */
(function(){
'use strict';
var selectedId=null,sorting='revenueAgorot',filter='',statusFilter='all';
var statuses={candidate:'מועמד',active:'פעיל',paused:'מושהה',ended:'הסתיים'};
var replyLabels={pending:'ממתין לתשובה',responded:'התקבלה תשובה',no_response:'ללא מענה',declined:'סירב',agreed:'סוכם שיתוף פעולה'};
function el(tag,cls,value){var x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x;}
function add(parent){Array.prototype.slice.call(arguments,1).forEach(function(x){if(x!==undefined&&x!==null)parent.appendChild(x instanceof Node?x:document.createTextNode(String(x)));});return parent;}
function button(text,action,css){var x=el('button','creator-btn '+(css||''),text);x.type='button';x.onclick=action;return x;}
function input(label,type,value,required){var w=el('label','creator-field');w.append(el('span','',label));var x=el('input');x.type=type;x.value=value==null?'':String(value);x.required=!!required;w.append(x);return {wrap:w,input:x};}
function choose(label,values,value){var w=el('label','creator-field'),x=el('select');w.append(el('span','',label));Object.keys(values).forEach(function(k){var opt=el('option','',values[k]);opt.value=k;x.append(opt);});x.value=value||Object.keys(values)[0];w.append(x);return {wrap:w,input:x};}
function area(label,value){var w=el('label','creator-field'),x=el('textarea');w.append(el('span','',label));x.rows=3;x.value=value||'';w.append(x);return {wrap:w,input:x};}
function fmtMoney(v){return new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format(Number(v||0)/100);}
function num(v){return new Intl.NumberFormat('he-IL').format(Number(v)||0);}
function day(v){return v?new Date(Number(v)).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}):'—';}
function sourceCard(title,subtitle){var section=el('section','admin-card creator-crm-card'),head=el('div','admin-card__head');var h=el('div');h.append(el('h2','',title));if(subtitle)h.append(el('p','',subtitle));section.append(head);head.append(h);var body=el('div','admin-card__body');section.append(body);return {section,head,body};}
function grid(items){var g=el('div','creator-crm-kpis');items.forEach(function(x){var d=el('div','creator-crm-kpi');d.append(el('span','',x[0]),el('strong','',x[1]));g.append(d);});return g;}
function table(headers,rows){var wrap=el('div','creator-crm-table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','טבלה');var tab=el('table','creator-crm-table'),thead=el('thead'),tr=el('tr');headers.forEach(function(h){tr.append(el('th','',h));});thead.append(tr);tab.append(thead);var body=el('tbody');rows.forEach(function(row){var r=el('tr');row.forEach(function(v){var c=el('td');if(v instanceof Node)c.append(v);else c.textContent=v===null||v===undefined?'—':String(v);r.append(c);});body.append(r);});if(!rows.length){var empty=el('tr');var cell=el('td','creator-crm-empty','אין רשומות');cell.colSpan=headers.length;empty.append(cell);body.append(empty);}tab.append(body);wrap.append(tab);return wrap;}
async function operation(fn,toast){try{await fn();if(toast)toast('השינוי נשמר');return true;}catch(e){alert('הפעולה נכשלה: '+(e.message||'שגיאה לא ידועה'));return false;}}
function submitForm(name,children,onSubmit){var f=el('form','creator-crm-form'),title=el('h3','',name);f.append(title);children.forEach(function(c){f.append(c.wrap||c);});var submit=el('button','creator-btn creator-btn-primary','שמור');submit.type='submit';f.append(submit);f.onsubmit=async function(e){e.preventDefault();submit.disabled=true;try{await onSubmit();}catch(err){alert('לא ניתן לשמור: '+(err.message||'שגיאה'));}finally{submit.disabled=false;}};return f;}
function moneyField(label,value){var v=input(label,'number',value||'0',true);v.input.min='0.01';v.input.step='0.01';return v;}
async function renderOverview(section,list,ctx){
  var body=section.body,writable=ctx.canEdit();
  var active=list.filter(x=>x.status==='active').length,due=list.reduce((s,x)=>s+Number(x.dueAgorot||0),0),revenue=list.reduce((s,x)=>s+Number(x.revenueAgorot||0),0);
  body.append(grid([['כל היוצרים',num(list.length)],['יוצרים פעילים',num(active)],['מכירות מיוחסות',fmtMoney(revenue)],['יתרות לתשלום',fmtMoney(due)]]));
  var toolbar=el('div','creator-crm-toolbar'),search=input('חיפוש יוצר / מייל / קוד','search',filter),status=choose('סטטוס',Object.assign({all:'כל הסטטוסים'},statuses),statusFilter),sort=choose('דירוג לפי',{revenueAgorot:'מכירות',views:'צפיות מתוגמלות',orders:'מספר הזמנות',roiPercent:'ROI',conversionPercent:'יחס המרה מזוהה'},sorting);
  search.input.oninput=function(){filter=search.input.value;draw();};status.input.onchange=function(){statusFilter=status.input.value;draw();};sort.input.onchange=function(){sorting=sort.input.value;draw();};
  toolbar.append(search.wrap,status.wrap,sort.wrap);body.append(toolbar);
  var slot=el('div');body.append(slot);
  function draw(){var match=list.filter(function(x){return(statusFilter==='all'||x.status===statusFilter)&&[x.name,x.email].join(' ').toLowerCase().includes(filter.trim().toLowerCase());});
    match.sort(function(a,b){var v=sorting;return (b[v]==null?-Infinity:Number(b[v]))-(a[v]==null?-Infinity:Number(a[v]))||a.name.localeCompare(b.name,'he');});
    var rows=match.map(function(p){return [button(p.name,function(){selectedId=p.id;ctx.refresh();},'creator-crm-open'),statuses[p.status]||p.status,num(p.orders),fmtMoney(p.revenueAgorot),num(p.views),p.conversionPercent==null?'לא זמין':p.conversionPercent+'%',fmtMoney(p.attributionMarginAgorot),p.roiPercent==null?'—':p.roiPercent+'%',button('פרופיל',function(){selectedId=p.id;ctx.refresh();})];});
    slot.replaceChildren(table(['יוצר','סטטוס','הזמנות','מכירות מיוחסות','צפיות מתוגמלות','המרה מזוהה','יתרה אחרי תגמול וקמפיין','ROI משוער','ניהול'],rows));
  }draw();
  body.append(el('p','creator-crm-explainer','ה־ROI מחושב: (מכירות ששולמו − החזרים שאומתו ידנית − עמלות שנצברו − תגמולי צפיות − עלויות קמפיין שהוזנו) ÷ אותן עלויות. הוא אינו רווח נקי: לא נוכו עלויות מוצרים, משלוחים, מסים או החזרים שטרם אומתו. המרה נמדדת רק ב־30 הימים האחרונים מתוך ביקורים עם תג UTM של קוד היוצר ורכישות ששולמו המקושרות לאותו מבקר או לחשבונו.'));
  if(writable){var togg=button('＋ הוסף מועמד חדש',function(){form.hidden=!form.hidden;});body.append(togg);
    var name=input('שם היוצר','text','',true),mail=input('מייל (אופציונלי)','email'),notes=area('הערות פנימיות');name.input.maxLength=120;mail.input.maxLength=254;
    var form=submitForm('מועמד חדש',[name,mail,notes],async function(){await ctx.act('/api/admin/creators/profiles','POST',{name:name.input.value,email:mail.input.value,notes:notes.input.value});ctx.toast('המועמד נוסף');ctx.refresh();});form.hidden=true;body.append(form);
  }
}
async function renderDetail(section,id,ctx){var detail=await ctx.api('/api/admin/creators/profiles/'+id),p=detail.profile,write=ctx.canEdit(),body=section.body;
  section.head.append(button('← חזרה לכל היוצרים',function(){selectedId=null;ctx.refresh();}));
  body.append(el('h2','creator-crm-profile-title',p.name+' · '+(statuses[p.status]||p.status)));
  body.append(grid([['מכירות מיוחסות',fmtMoney(p.revenueAgorot)],['החזרים מאומתים',fmtMoney(p.refundsAgorot)],['הזמנות ששולמו',num(p.orders)],['צפיות מתוגמלות',num(p.views)],['עמלות מכירה',fmtMoney(p.commissionAgorot)],['תגמול צפיות',fmtMoney(p.videoRewardsAgorot)],['עלויות קמפיין',fmtMoney(p.campaignCostsAgorot)],['סכום ששולם',fmtMoney(p.paidAgorot)],['יתרה לתשלום',fmtMoney(p.dueAgorot)],['יתרה אחרי תגמול וקמפיין',fmtMoney(p.attributionMarginAgorot)],['ROI משוער',p.roiPercent==null?'לא מחושב':p.roiPercent+'%']]));
  var blocks=el('div','creator-crm-blocks');body.append(blocks);
  function panel(title){var d=el('details','creator-crm-panel');d.open=true;d.append(el('summary','',title));var inner=el('div','creator-crm-panel-body');d.append(inner);blocks.append(d);return inner;}
  var settings=panel('פרופיל וסטטוס היוצר');
  if(write){var name=input('שם', 'text',p.name,true),email=input('כתובת מייל','email',p.email),status=choose('סטטוס',statuses,p.status),notes=area('הערות ניהול',p.notes);
    settings.append(submitForm('עריכת פרופיל',[name,email,status,notes],async function(){await ctx.act('/api/admin/creators/profiles/'+id,'PATCH',{name:name.input.value,email:email.input.value,status:status.input.value,notes:notes.input.value});ctx.toast('פרופיל היוצר עודכן');ctx.refresh();}));
  }else{settings.append(el('p','',p.email||'ללא מייל'),el('p','',p.notes||'ללא הערות'));}
  if(detail.codes.length)settings.append(table(['קוד','מצב','הנחה ללקוח','עמלה','נוצר'],detail.codes.map(function(c){return[c.code,c.active?'פעיל':'לא פעיל',c.discount_percent+'%',c.commission_percent+'%',day(c.created_at)];})));
  var contacts=panel('פניות ותשובות');
  if(write){var channel=choose('ערוץ פנייה',{tiktok:'TikTok',instagram:'Instagram',email:'מייל',whatsapp:'WhatsApp',phone:'טלפון',other:'אחר'}),contactDate=input('תאריך פנייה','date',new Date().toISOString().slice(0,10),true),replyDate=input('תאריך תגובה (אם יש)','date',''),replyStatus=choose('מצב תגובה',replyLabels),note=area('סיכום הפנייה');
    contacts.append(submitForm('תיעוד פנייה',[channel,contactDate,replyDate,replyStatus,note],async function(){await ctx.act('/api/admin/creators/profiles/'+id+'/contacts','POST',{channel:channel.input.value,contactedAt:contactDate.input.value,repliedAt:replyDate.input.value,replyStatus:replyStatus.input.value,note:note.input.value});ctx.toast('הפנייה נרשמה');ctx.refresh();}));}
  var editContactArea=el('div');contacts.append(editContactArea);
  contacts.append(table(['תאריך פנייה','ערוץ','תגובת היוצר','תאריך תשובה','הערות','פעולות'],detail.contacts.map(function(c){
    var action=write?button('עדכן תגובה',function(){
      var replyStatus=choose('מצב תגובה',replyLabels,c.reply_status),replyDate=input('תאריך תשובה','date',c.replied_at?new Date(Number(c.replied_at)).toISOString().slice(0,10):''),note=area('סיכום התשובה',c.note);
      var form=submitForm('עדכון פנייה מ־'+day(c.contacted_at),[replyStatus,replyDate,note],async function(){await ctx.act('/api/admin/creators/profiles/'+id+'/contacts/'+c.id,'PATCH',{replyStatus:replyStatus.input.value,repliedAt:replyDate.input.value,note:note.input.value});ctx.toast('התגובה עודכנה');ctx.refresh();});
      editContactArea.replaceChildren(form);form.scrollIntoView({block:'nearest',behavior:'smooth'});
    }):'—';
    return[day(c.contacted_at),c.channel,replyLabels[c.reply_status]||c.reply_status,day(c.replied_at),c.note,action];}))); 
  var docs=panel('הסכמים ומסמכים');
  if(write){var docForm=el('form','creator-crm-form'),upload=el('input');upload.type='file';upload.accept='.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*';var ulabel=el('label','creator-field');ulabel.append(el('span','','העלאת חוזה, צילום מסך או מסמך (עד 2MB)'));ulabel.append(upload);docForm.append(ulabel);var saveDoc=el('button','creator-btn creator-btn-primary','העלה מסמך');saveDoc.type='submit';docForm.append(saveDoc);
    docForm.onsubmit=async function(e){e.preventDefault();var file=upload.files&&upload.files[0];if(!file)return;if(file.size>2*1024*1024){alert('מגבלת הקובץ היא 2MB');return;}saveDoc.disabled=true;
      try{var base64=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result).split(',')[1]);};reader.onerror=reject;reader.readAsDataURL(file);});await ctx.act('/api/admin/creators/profiles/'+id+'/documents','POST',{name:file.name,mime:file.type||(/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':/\.(jpe?g)$/i.test(file.name)?'image/jpeg':''),base64:base64});ctx.toast('המסמך נשמר');ctx.refresh();}catch(error){alert('העלאה נכשלה: '+error.message);}finally{saveDoc.disabled=false;}};docs.append(docForm);}
  docs.append(table(['מסמך','גודל','תאריך','הורדה'],detail.documents.map(function(d){var a=el('a','','הורד קובץ');a.href='/api/admin/creators/profiles/'+id+'/documents/'+d.id;a.rel='noopener';return[d.name,Math.round(d.byte_size/1024)+'KB',day(d.created_at),a];})));
  var costs=panel('עלויות קמפיין מיוחסות ליוצר');
  costs.append(el('p','creator-crm-explainer','כאן נרשמת עלות שיוחסה ליוצר לצורך ROI בלבד. היא לא יוצרת הוצאה נוספת ביומן הכספים. אם התשלום כבר נרשם בהוצאות, אל תספור אותו כאן שוב כעמלת יוצר.'));
  if(write){var costLabel=input('מהות העלות','text','פרסום ממומן',true),costValue=moneyField('סכום (₪)'),costDate=input('תאריך','date',new Date().toISOString().slice(0,10),true);
    costs.append(submitForm('הוספת עלות',[costLabel,costValue,costDate],async function(){await ctx.act('/api/admin/creators/profiles/'+id+'/costs','POST',{label:costLabel.input.value,amountAgorot:Math.round(Number(costValue.input.value)*100),spentOn:costDate.input.value});ctx.toast('העלות נרשמה לדוח');ctx.refresh();}));}
  costs.append(table(['תיאור','סכום','תאריך','פעולות'],detail.campaignCosts.map(function(c){return[c.label,fmtMoney(c.amount_agorot),c.spent_on,write?button('הסר',async function(){if(!confirm('להסיר את העלות מהדוח?'))return;if(await operation(function(){return ctx.act('/api/admin/creators/profiles/'+id+'/costs/'+c.id,'DELETE');},ctx.toast))ctx.refresh();}):'—'];})));
  var payment=panel('עמלות ותשלומים מתועדים');
  if(ctx.isOwner && p.userId && p.dueAgorot>0){var amount=moneyField('סכום לתשלום (₪)',(p.dueAgorot/100).toFixed(2)),reference=input('אסמכתת תשלום','text','',true),paymentNote=input('הערה / אמצעי תשלום','text','');amount.input.max=(p.dueAgorot/100).toFixed(2);
    payment.append(submitForm('רישום תשלום שבוצע בפועל',[amount,reference,paymentNote],async function(){var cents=Math.round(Number(amount.input.value)*100);if(cents<=0||cents>p.dueAgorot)throw Error('סכום חורג מהיתרה');if(!confirm('לאשר שרשמת תשלום שבוצע בפועל? הפעולה תיצור גם הוצאה במערכת הכספים.'))return;await ctx.act('/api/admin/dashboard/creator-payment','POST',{creatorId:p.userId,amountAgorot:cents,requestId:crypto.randomUUID(),reference:reference.input.value,note:paymentNote.input.value});ctx.toast('התשלום והאסמכתה נשמרו בהוצאות');ctx.refresh();}));}
  payment.append(table(['תאריך','סכום','הערה','אסמכתה','פעולות'],detail.payments.map(function(r){var b='—';if(ctx.isOwner)b=button('ערוך אסמכתה',async function(){var value=prompt('מספר אסמכתה לתשלום',r.reference||'');if(value===null||!value.trim())return;if(await operation(function(){return ctx.act('/api/admin/creators/profiles/'+id+'/payments/'+r.id,'PATCH',{reference:value.trim()});},ctx.toast))ctx.refresh();});return[day(r.paid_at),fmtMoney(r.amount_agorot),r.note,r.reference||'לא הוזנה',b];})));
  var orders=panel('הזמנות ששולמו עם קוד היוצר (100 אחרונות)');orders.append(table(['מספר הזמנה','קוד יוצר','תאריך תשלום','סכום'],(detail.orders||[]).map(function(o){return[o.order_ref,o.coupon_code,day(o.paid_at),fmtMoney(o.amount_agorot)];})));
  var videos=panel('סרטוני היוצר');videos.append(table(['סרטון','סטטוס','צפיות אחרונות'],detail.videos.map(function(v){var a=el('a','','צפייה');a.href=v.video_url;a.target='_blank';a.rel='noopener noreferrer';return[a,v.status,num(v.last_views)];})));
  var hist=panel('יומן פעילות בניהול היוצר');hist.append(table(['תאריך','פעולה','מי ביצע','מידע'],detail.history.map(function(h){return[day(h.created_at),h.action,h.actor_name,h.details];})));
  body.append(el('p','creator-crm-explainer','דירוג והחישובים מתבססים על הזמנות ששולמו בלבד ועל בדיקות צפיות שנרשמו במערכת. תשלום שבוצע אינו מוריד שוב את הרווחיות: העלות כבר נספרת כאשר העמלה נצברת.'));
}
window.VersansCreatorsCRM={render:async function(frag,ctx){var sec=sourceCard('ניהול יוצרי תוכן · CRM','מועמדים, שיתופי פעולה, מסמכים, תשלומים ומדדי ROI. נתוני המכירות והעמלות נלקחים מהמערכת הקיימת.');frag.append(sec.section);if(selectedId){await renderDetail(sec,selectedId,ctx);}else{var result=await ctx.api('/api/admin/creators/profiles');await renderOverview(sec,result.creators||[],ctx);}}};
})();
