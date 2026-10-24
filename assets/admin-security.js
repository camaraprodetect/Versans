(function(){'use strict';
function node(tag,cls,label){var n=document.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=String(label);return n;}
function btn(text,click,danger){var b=node('button','as-button'+(danger?' as-danger':''),text);b.type='button';b.onclick=click;return b;}
async function api(path,method,body){var options={method:method||'GET',credentials:'same-origin',headers:{Accept:'application/json'}};if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}var res=await fetch(path,options);var json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.error||'הפעולה נכשלה');return json;}
function when(stamp){return stamp?new Date(Number(stamp)).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}):'—';}
function section(title,desc){var card=node('section','as-card');card.append(node('h2','',title));if(desc)card.append(node('p','as-muted',desc));return card;}
function item(left,right,action){var r=node('div','as-item'),p=node('div');p.append(node('strong','',left));p.append(node('small','',right));r.append(p);if(action)r.append(action);return r;}
function list(card,rows,empty,render){if(!rows.length)card.append(node('p','as-muted',empty));else rows.forEach(function(row){card.append(render(row));});}
function badge(text){return node('span','as-badge',text);}
function feedback(root,message,bad){var n=node('div','as-message'+(bad?' as-error':''),message);n.setAttribute('role',bad?'alert':'status');n.setAttribute('aria-live',bad?'assertive':'polite');root.prepend(n);if(!bad)setTimeout(function(){n.remove();},20000);}
function backupError(error){var msg=String(error&&error.message||'');if(msg==='backup_directory_not_configured')return 'לא הוגדרה תיקיית גיבוי בשרת. הגדר VERSANS_BACKUP_DIR ב-Render ובצע Deploy.';
if(msg==='backup_in_progress')return 'גיבוי כבר פועל כרגע. נסה שוב אחרי שיסתיים.';
if(/pg_dump.*ENOENT|spawn pg_dump ENOENT/.test(msg))return 'השרת לא מוצא את pg_dump. יש להתקין PostgreSQL client בכלי הבנייה של Render.';
if(/pg_restore.*ENOENT|spawn pg_restore ENOENT/.test(msg))return 'השרת לא מוצא את pg_restore. יש להתקין PostgreSQL client בכלי הבנייה של Render.';
if(/EACCES|permission denied/i.test(msg))return 'אין הרשאת כתיבה לתיקיית הגיבויים. בדוק את הדיסק ואת VERSANS_BACKUP_DIR ב-Render.';
if(/ENOSPC|no space left/i.test(msg))return 'אין מספיק מקום בדיסק הגיבויים. פנה מקום או הגדל את הדיסק.';
return msg||'יצירת הגיבוי נכשלה. בדוק את יומן השרת ב-Render.';}
async function render(root){root.replaceChildren(node('p','as-muted','טוען נתוני אבטחה...'));
try{
var d=await api('/api/admin/security/overview'),wrap=node('div','as-page');
var intro=node('div','as-intro');intro.append(node('h2','','אבטחה, תחזוקה ומהירות'),node('p','','כל הפעולות מתועדות. ניתוק מכשיר מבטל את ההתחברות שלו בצד השרת.'));wrap.append(intro);
var devices=section('מכשירים מחוברים','התחברויות פעילות לחשבון שלך. כדי לנתק מכשיר אחר לחץ על נתק.');
list(devices,d.devices||[],'לא נמצאו התחברויות פעילות עם פרטי דפדפן. התחבר מחדש כדי לרשום את המכשיר.',function(s){return item((s.current?'המכשיר הזה · ':'')+(s.email?s.email+' · ':'')+s.label,'כניסה: '+when(s.createdAt)+' · פעילות: '+when(s.lastSeen),btn('נתק',async function(){if(!confirm('לנתק את המכשיר?'))return;try{await api('/api/admin/security/devices/revoke','POST',{id:s.id,userId:s.userId});if(s.current){location.href='/login';return;}await render(root);}catch(e){feedback(wrap,e.message,true);}},true));});wrap.append(devices);
if(d.owner){var sheet=section('סנכרון Google Sheets','מוצרים שממתינים לסנכרון והזמנות ששולמו אך עדיין לא סומנו כמסונכרנות.');
var ps=d.sheets?.pendingProducts||[],os=d.sheets?.pendingOrders||[];
sheet.append(item('מוצרים שממתינים לסנכרון',ps.length+(ps.length===50?'+':'')));
sheet.append(item('הזמנות שלא סומנו כמסונכרנות (7 ימים)',os.length+(os.length===30?'+' : '')));
list(sheet,ps.slice(0,10),'אין מוצרים שממתינים לסנכרון',function(x){return item(String(x),'עדכון מוצר ממתין');});
list(sheet,os.slice(0,10),'לא נמצאו הזמנות ממתינות בטווח שבעת הימים',function(x){return item(String(x.ref),'הוזמנה: '+when(x.paidAt));});
list(sheet,d.sheets?.failedEvents||[],'לא תועדו שגיאות סנכרון חדשות',function(x){return item(x.detail,when(x.createdAt));});wrap.append(sheet);
var backups=section('גיבויים אוטומטיים ובדיקת שחזור','גיבוי יומי יפעל רק אם הוגדרה תיקיית גיבוי מתמשכת בשרת. PostgreSQL מצריך pg_dump ו-pg_restore.');
backups.append(item('מצב הגיבוי',d.backups?.configured?'תיקיית גיבוי הוגדרה':'גיבוי אוטומטי עדיין לא הוגדר'));
if(d.backups?.latest){var bk=d.backups.latest;backups.append(item(bk.ok?'גיבוי אחרון תקין':'הגיבוי האחרון נכשל',when(bk.at)+' · '+(bk.verification||backupError({message:bk.error})||'')+(bk.bytes?' · '+(bk.bytes/1048576).toFixed(2)+' MB':'')));
if(bk.ok&&d.owner){var download=node('a','as-button as-download','הורד את הגיבוי האחרון');download.href='/api/admin/security/backup/download';download.setAttribute('download',bk.filename||'versans-backup');download.setAttribute('aria-label','הורדת הגיבוי האחרון למחשב');backups.append(download);}}
if(d.backups?.warning)backups.append(node('p','as-warning',d.backups.warning));
if(d.owner)backups.append(btn('בצע גיבוי ובדיקת תקינות עכשיו',async function(){var button=this;button.disabled=true;button.textContent='יוצר גיבוי ובודק תקינות...';try{var r=await api('/api/admin/security/backup','POST',{});await render(root);feedback(root,'הגיבוי נוצר ונשמר בשרת בהצלחה: '+r.backup.filename+'. כדי לקבל עותק במחשב לחץ על ״הורד את הגיבוי האחרון״.');}catch(e){feedback(root,backupError(e),true);}finally{if(button.isConnected){button.disabled=false;button.textContent='בצע גיבוי ובדיקת תקינות עכשיו';}}}));wrap.append(backups);
var maintenance=section('מצב תחזוקה','במצב תחזוקה הלקוחות רואים הודעה, אבל הבעלים המחובר יכול לראות ולבדוק את החנות. אפשר לכבות בכל רגע.');
maintenance.append(item('סטטוס נוכחי',d.maintenance?'מצב תחזוקה פעיל':'החנות פעילה'));
if(d.owner)maintenance.append(btn(d.maintenance?'כבה מצב תחזוקה':'הפעל מצב תחזוקה',async function(){if(!confirm(d.maintenance?'להחזיר את החנות לפעילות?':'להפעיל מצב תחזוקה ללקוחות?'))return;try{await api('/api/admin/security/maintenance','POST',{active:!d.maintenance});await render(root);}catch(e){feedback(wrap,e.message,true);}},!!d.maintenance));
if(d.owner&&d.maintenance)maintenance.append(btn('פתח את החנות לבדיקה',function(){window.open('/','_blank','noopener');}));
wrap.append(maintenance);
var trash=section('סל מחזור — מוצרים ומשימות','מחיקת מוצר או משימה שומרת עותק לשחזור. משימה ששוחזרה מקבלת מספר חדש. סל המחזור לא מחליף גיבוי מלא.');
list(trash,d.trash||[],'אין כרגע מוצרים בסל המחזור.',function(r){return item((r.kind==='task'?'משימה #':'מוצר ')+r.key,(r.restored?'שוחזר · ':'נמחק · ')+when(r.createdAt),(!r.restored&&d.owner)?btn('שחזר',async function(){if(!confirm('לשחזר את '+r.key+'?'))return;try{await api('/api/admin/security/trash/restore','POST',{id:r.id});await render(root);}catch(e){feedback(wrap,e.message,true);}}):badge('שוחזר'));});wrap.append(trash);
var versions=section('גרסאות קודמות','נשמרת גרסה קודמת בעת שינוי מוצר, שיווק ומבצעים ומצב תחזוקה. שחזור יוצר רשומת גרסה נוספת.');
list(versions,d.versions||[],'אין עדיין גרסאות מתועדות.',function(r){return item((r.kind==='product'?'מוצר: ':r.kind==='maintenance'?'מצב תחזוקה: ':r.kind==='marketing'?'שיווק ומבצעים: ':'')+r.key,when(r.createdAt),d.owner?btn('שחזר גרסה',async function(){if(!confirm('לשחזר את המצב השמור ולדרוס את המצב הנוכחי?'))return;try{await api('/api/admin/security/versions/restore','POST',{id:r.id});await render(root);}catch(e){feedback(wrap,e.message,true);}}):null);});wrap.append(versions);
var events=section('יומן אירועי אבטחה','כניסות מדפדפן חדש, ניתוקים, שגיאות סנכרון ושחזור גרסאות.');
list(events,d.events||[],'עדיין לא נרשמו אירועים.',function(e){return item(e.detail,when(e.createdAt));});wrap.append(events);}
root.replaceChildren(wrap);
}catch(e){root.replaceChildren(node('div','as-warning','שגיאה בטעינת אבטחה: '+e.message));}
}
window.VersansAdminSecurity={render:render};
})();
