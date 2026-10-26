'use strict';

// Server-side, opt-in authorization. Unknown routes are always denied to employees.
const GROUPS = [
  ['dashboard','דאשבורד',[['view','צפייה']]],
  ['visitors','מבקרים',[['view','צפייה']]],
  ['sales','מכירות',[['view','צפייה']]],
  ['income','הכנסות',[['view','צפייה'],['refunds','תיעוד ואימות ידני של זיכויים והחזרים']]],
  ['expenses','הוצאות',[['view','צפייה'],['create','הוספת הוצאה'],['edit','עריכת הוצאות קיימות'],['cancel','ביטול הוצאות עם תיעוד'],['recurring','ניהול הוצאות קבועות']]],
  ['orders','טיפול בהזמנות',[['view','צפייה'],['edit','עדכון הזמנות, Tracking וקליטת משלוחים']]],
  ['anomalies','הזמנות חריגות',[['view','צפייה'],['edit','סימון ובדיקת חריגות']]],
  ['products','מוצרים',[['view','צפייה'],['edit','עריכת מוצרים והקטלוג (כולל מחירים)'],['description','עריכת תיאור, כותרות ומאפייני טקסט בלבד'],['price','עריכת מחירים ומבצעים בלבד']]],
  ['marketing','שיווק ומבצעים',[['view','צפייה במבצעים וקמפיינים'],['edit','יצירת ועריכת קופונים, מבצעים ותוכן שיווקי']]],
  ['creators','יוצרי תוכן',[['view','צפייה'],['edit','הוספה, עריכה, ביטול ופעולות בסרטונים']]],
  ['customers','לקוחות',[['view','צפייה'],['edit','חסימת לקוחות ושינויים']]],
  ['tasks','משימות פנימיות',[['view','צפייה במשימות משויכות'],['status','שינוי סטטוס במשימות שלי'],['create','יצירת משימות'],['edit','עריכת תוכן כל המשימות'],['assign','חלוקת משימות ושינוי אחראי'],['delete','מחיקת משימות']]],
  ['security','אבטחה ותחזוקה',[['view','צפייה במכשירים האישיים ובסטטוס התחזוקה']]],
  ['reports','דוחות וייצוא',[['view','צפייה בדוחות'],['export','הורדת דוחות (PDF / CSV / Excel)'],['sensitive','ייצוא מידע אישי של לקוחות ומבקרים'],['schedule','תזמון משלוח דוחות למייל'],['share','שליחת דוחות לעובדים ונמענים אחרים']]],
  ['reviews','ביקורות',[['view','צפייה'],['edit','ניהול ומחיקה']]],
  ['employees','עובדים והרשאות',[['view','צפייה בעובדים'],['create','יצירת עובדים'],['edit','עריכת עובדים אחרים'],['permissions','שינוי הרשאות לעובדים אחרים']]]
];
const KEYS = new Set(GROUPS.flatMap(([section,,actions]) => actions.map(([action]) => section+'.'+action)));
const DEFAULT = ['tasks.view','tasks.status'];
const PRESETS = Object.freeze({
  service:{label:'שירות לקוחות',permissions:['customers.view','orders.view','orders.edit','tasks.view','tasks.status']},
  warehouse:{label:'מחסן',permissions:['orders.view','orders.edit','tasks.view','tasks.status','products.view']},
  marketing:{label:'שיווק',permissions:['marketing.view','marketing.edit','products.view','products.description','visitors.view','tasks.view','tasks.status']},
  finance:{label:'כספים',permissions:['income.view','expenses.view','expenses.create','expenses.edit','expenses.cancel','expenses.recurring','reports.view','reports.export','sales.view','tasks.view','tasks.status']},
  manager:{label:'מנהל',permissions:['dashboard.view','visitors.view','sales.view','income.view','expenses.view','expenses.create','expenses.edit','orders.view','orders.edit','anomalies.view','anomalies.edit','products.view','products.edit','marketing.view','marketing.edit','creators.view','customers.view','tasks.view','tasks.status','tasks.create','tasks.edit','tasks.assign','reports.view','reports.export','reviews.view','reviews.edit','employees.view']}
});
const PAGE_KEYS = { dashboard:'dashboard.view',visitors:'visitors.view',sales:'sales.view',income:'income.view',expenses:'expenses.view', 'order-work':'orders.view',arrivals:'orders.view',orders:'orders.view',anomalies:'anomalies.view',products:'products.view',marketing:'marketing.view',creators:'creators.view',customers:'customers.view',tasks:'tasks.view',security:'security.view',reports:'reports.view',reviews:'reviews.view',employees:'employees.view' };
function validKeys(keys) {
  if (!Array.isArray(keys) || keys.length>KEYS.size) return null;
  if (keys.some(k => typeof k !== 'string' || !KEYS.has(k))) return null;
  return [...new Set(keys)];
}
function withPagePermissions(input) {
  const keys=validKeys(input);if(!keys)return null;
  for(const [group,,actions] of GROUPS){
    if(actions.some(([action])=>action!=='view' && keys.includes(group+'.'+action)) && KEYS.has(group+'.view') && !keys.includes(group+'.view'))keys.push(group+'.view');
  }
  return keys;
}
function can(user,key) { return !!user && (user.role==='admin' || (user.permissions||[]).includes(key)); }
function permissionFor(path,method) {
  const read=method==='GET'||method==='HEAD';
  const specific={
    '/api/admin/dashboard/insights':'dashboard.view','/api/admin/dashboard/goal':'dashboard.view',
    '/api/admin/dashboard/creator-payment':'creators.edit',
    '/api/admin/security/overview':'security.view',
    '/api/admin/security/devices/revoke':'security.view',
    '/api/admin/security/backup':'security.view',
    '/api/admin/security/backup/download':'security.view',
    '/api/admin/security/maintenance':'security.view',
    '/api/admin/security/trash/restore':'security.view',
    '/api/admin/security/versions/restore':'security.view',
    '/api/admin/overview':'dashboard.view','/api/admin/command-center':'dashboard.view',
    '/api/admin/visitors':'visitors.view','/api/admin/traffic':'visitors.view',
    '/api/admin/sales':'sales.view','/api/admin/products':'products.view',
    '/api/admin/marketing':read?'marketing.view':'marketing.edit',
    '/api/admin/marketing/media':'marketing.edit',
    '/api/admin/finance/income':'income.view',
    '/api/admin/finance/expenses':read?'expenses.view':method==='POST'?'expenses.create':null,
    '/api/admin/finance/recurring':read?'expenses.view':method==='POST'?'expenses.recurring':null,
    '/api/admin/finance/refunds':read?'income.view':method==='POST'?'income.refunds':null,
    '/api/admin/finance/export':'reports.export',
    '/api/admin/orders':'orders.view','/api/admin/order-work':'orders.view',
    '/api/admin/order-work-sheet-status':'orders.view',
    '/api/admin/order-work-sheet-snapshots':method==='POST'?'orders.view':null, // read-only sync
    '/api/admin/cancellation-requests':'orders.view',
    '/api/admin/order-anomalies': 'anomalies.view',
    '/api/admin/order-anomalies/review': method==='POST'?'anomalies.edit':null,
    '/api/admin/order-anomalies/settings': method==='GET'?'anomalies.view':method==='PUT'?'anomalies.edit':null,
    '/api/admin/order-anomalies/history': 'anomalies.view',
    '/api/admin/catalog': read?'products.view':'products.edit',
    '/api/admin/catalog/undo':read?'products.view':'products.edit',
    '/api/admin/catalog/bulk':'products.edit',
    '/api/admin/catalog/sync':'products.edit',
    '/api/admin/catalog/images':'products.edit',
    '/api/admin/catalog/categories/visibility':'products.edit',
    '/api/admin/creators':read?'creators.view':'creators.edit',
    '/api/admin/customers':'customers.view',
    '/api/admin/reviews': 'reviews.view',
    '/api/admin/internal-tasks':read?'tasks.view':'tasks.create',
    '/api/admin/internal-tasks/assignees':'tasks.assign',
    '/api/admin/access/me':'employees.view',
    '/api/admin/display-preferences':'preferences',
    '/api/admin/notification-center':'notifications',
    '/api/admin/notification-center/read':'notifications',
    '/api/admin/search':'search',
    '/api/admin/export-data':'reports.export',
    '/api/admin/report-download':'reports.export',
    '/api/admin/report-schedules':read?'reports.view':'reports.schedule',
    '/api/admin/report-recipients':'reports.view',
    '/api/admin/report-send':'reports.share',
    '/api/admin/reports/work-session':'orders.edit',
    '/api/admin/push/config':'push','/api/admin/push/subscribe':'push',
    '/api/admin/push/unsubscribe':'push',
    '/api/admin/packaging/overview': 'orders.view',
    '/api/admin/packaging/lookup': 'orders.view',
    '/api/admin/packaging/order': 'orders.view',
    '/api/admin/packaging/unit': 'orders.edit',
    '/api/admin/packaging/scan': 'orders.edit',
    '/api/admin/shipping/pickup-message':'orders.edit',
    '/api/admin/employees':read?'employees.view':'employees.create',
    '/api/admin/employees/catalog':'employees.view',
    '/api/admin/employees/audit':'employees.view',
    '/api/admin/employees/overview':'employees.view',
    '/api/admin/employees/reauth':'reauth'
  };
  if (Object.hasOwn(specific,path)) return specific[path];
  if (/^\/api\/admin\/report-schedules\/\d+$/.test(path)) return method==='DELETE'?'reports.schedule':null;
  if (/^\/api\/admin\/finance\/expenses\/\d+$/.test(path)) return method==='GET'?'expenses.view':method==='PATCH'?'expenses.edit':method==='DELETE'?'expenses.cancel':null;
  if (/^\/api\/admin\/finance\/recurring\/\d+$/.test(path)) return method==='PATCH'?'expenses.recurring':null;
  if (/^\/api\/admin\/finance\/refunds\/\d+$/.test(path)) return method==='PATCH'?'income.refunds':null;
  if (/^\/api\/admin\/employees\/\d+$/.test(path)) return method==='GET'?'employees.view':method==='PATCH'?'employees.edit':null;
  if(path==='/api/admin/task-templates')return read?'tasks.view':'tasks.create';
  if(/^\/api\/admin\/task-templates\/\d+$/.test(path))return method==='DELETE'?'tasks.edit':'tasks.create';
  if(/^\/api\/admin\/internal-tasks\/\d+\/(history|files)$/.test(path))return method==='GET'?'tasks.view':method==='POST'?'tasks.edit':null;
  if(/^\/api\/admin\/internal-tasks\/files\/\d+$/.test(path))return method==='GET'?'tasks.view':'tasks.edit';
  if (/^\/api\/admin\/internal-tasks\/\d+$/.test(path)) return read?'tasks.view':method==='PATCH'?'tasks.status':method==='DELETE'?'tasks.delete':null;
  if(path==='/api/admin/creators/profiles')return read?'creators.view':'creators.edit';
  if(/^\/api\/admin\/creators\/profiles\/\d+(?:\/(?:contacts|documents|costs|history|payments)(?:\/\d+)?)?$/.test(path))return read?'creators.view':'creators.edit';
  if (/^\/api\/admin\/creators\/\d+\/revoke$/.test(path) || path.startsWith('/api/admin/creator-videos/')) return 'creators.edit';
  if (/^\/api\/admin\/customers\/\d+\/profile$/.test(path)) return read ? 'customers.view' : null;
  if (/^\/api\/admin\/customers\/\d+\/access$/.test(path)) return 'customers.edit';
  if (path.startsWith('/api/admin/order-work/') || path.startsWith('/api/admin/orders/') || path.startsWith('/api/admin/shipping/') || path.startsWith('/api/admin/packaging/')) return read?'orders.view':'orders.edit';
  if (path.startsWith('/api/admin/catalog/')) return read?'products.view':'products.edit';
  if (path.startsWith('/api/admin/reviews/')) return read?'reviews.view':'reviews.edit';
  return null;
}
function allowed(user,path,method) {
  if(!user) return false;
  if(user.role==='admin') return true;
  if (/^\/api\/admin\/internal-tasks\/\d+$/.test(path) && method==='PATCH') return can(user,'tasks.status') || can(user,'tasks.edit') || can(user,'tasks.assign');
  const key=permissionFor(path,method);
  if (key==='preferences'||key==='push'||key==='reauth') return true;
  if (key==='notifications') return false; // Mixed order and internal notifications can disclose ungranted data
  if (key==='search') return false; // cross-section search can disclose ungranted data
  return !!key && can(user,key);
}
function createEmployeeAccess(database) {
  const pg=database.backend==='postgres';
  let initPromise=null;
  function init() {
    if(!initPromise) initPromise=(async()=>{
      const sql=`CREATE TABLE IF NOT EXISTS admin_employee_permissions (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        permissions_json TEXT NOT NULL DEFAULT '[]', updated_at BIGINT NOT NULL DEFAULT 0)`;
      if(pg) await database._query(sql);else database.db.exec(sql);
    })().catch(e=>{initPromise=null;throw e;});
    return initPromise;
  }
  async function read(userId) {
    await init();const row=pg?(await database._query('SELECT permissions_json FROM admin_employee_permissions WHERE user_id=$1',[userId])).rows[0]:database.db.prepare('SELECT permissions_json FROM admin_employee_permissions WHERE user_id=?').get(userId);
    if(!row)return DEFAULT.slice();
    try{return validKeys(JSON.parse(row.permissions_json))||[];}catch(_){return [];}
  }
  async function write(userId,permissions) {
    const keys=withPagePermissions(permissions);if(!keys)throw Object.assign(new Error('invalid_permissions'),{status:400});
    await init();const json=JSON.stringify(keys),now=Date.now();
    if(pg) await database._query(`INSERT INTO admin_employee_permissions (user_id,permissions_json,updated_at) VALUES ($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET permissions_json=EXCLUDED.permissions_json,updated_at=EXCLUDED.updated_at`,[userId,json,now]);
    else database.db.prepare(`INSERT INTO admin_employee_permissions (user_id,permissions_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET permissions_json=excluded.permissions_json,updated_at=excluded.updated_at`).run(userId,json,now);
    return keys;
  }
  let profileReady=null;
  async function initializeProfiles() {
    if(profileReady)return profileReady;
    profileReady=(async()=>{await init();
    const id=pg?'BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY':'INTEGER PRIMARY KEY AUTOINCREMENT';
    const stmts=[
      `CREATE TABLE IF NOT EXISTS admin_employee_profiles (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, preset TEXT NOT NULL DEFAULT '', expires_at BIGINT, updated_at BIGINT NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS admin_employee_audit (id ${id}, actor_id INTEGER, actor_name TEXT NOT NULL, target_id INTEGER, area TEXT NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL, created_at BIGINT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS idx_employee_audit_time ON admin_employee_audit(created_at DESC,id DESC)`,
      `CREATE TABLE IF NOT EXISTS admin_employee_reauth (session_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, verified_until BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS admin_employee_reauth_failures (session_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, attempts INTEGER NOT NULL, window_start BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS admin_employee_task_events (id ${id}, task_id BIGINT NOT NULL, completed_by INTEGER NOT NULL, completed_at BIGINT NOT NULL)` ,
      `CREATE INDEX IF NOT EXISTS idx_employee_completed_by ON admin_employee_task_events(completed_by,completed_at DESC)`
    ];
    for(const statement of stmts){if(pg)await database._query(statement);else database.db.exec(statement);}
    })().catch(e=>{profileReady=null;throw e;});
    return profileReady;
  }
  async function q(statement,args=[]) {
    if(pg){let n=0;return (await database._query(statement.replace(/\?/g,()=>'$'+(++n)),args)).rows||[];}
    const stmt=database.db.prepare(statement);
    return /^\s*SELECT/i.test(statement)?stmt.all(...args):stmt.run(...args);
  }
  async function profile(userId){
    await initializeProfiles();const rows=await q('SELECT preset,expires_at FROM admin_employee_profiles WHERE user_id=?',[userId]);
    return {preset:String(rows[0]?.preset||''),expiresAt:rows[0]?.expires_at==null?null:Number(rows[0].expires_at)};
  }
  async function setProfile(userId,{preset='',expiresAt=null}={}){
    if(preset && !Object.hasOwn(PRESETS,preset))throw Object.assign(new Error('invalid_preset'),{status:400});
    if(expiresAt!==null && (!Number.isSafeInteger(expiresAt)||expiresAt<=Date.now()||expiresAt>Date.now()+366*86400000))throw Object.assign(new Error('invalid_expiry'),{status:400});
    await initializeProfiles();await q(`INSERT INTO admin_employee_profiles (user_id,preset,expires_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET preset=excluded.preset,expires_at=excluded.expires_at,updated_at=excluded.updated_at`,[userId,preset,expiresAt,Date.now()]);
    return {preset,expiresAt};
  }
  async function isExpired(userId){const p=await profile(userId);return p.expiresAt!==null && p.expiresAt<=Date.now();}
  async function readEffective(userId){if(await isExpired(userId))return [];return read(userId);}
  async function audit(actor,area,action,summary,targetId=null){
    await initializeProfiles();
    await q('INSERT INTO admin_employee_audit(actor_id,actor_name,target_id,area,action,summary,created_at) VALUES(?,?,?,?,?,?,?)',[
      Number(actor.id),String(actor.name||actor.email||'עובד').slice(0,120),targetId==null?null:Number(targetId),String(area).slice(0,60),String(action).slice(0,60),String(summary).slice(0,200),Date.now()]);
  }
  async function auditList({limit=60,offset=0,actorId=null}={}){
    await initializeProfiles();limit=Math.min(100,Math.max(1,Number(limit)||60));offset=Math.max(0,Number(offset)||0);
    const filter=actorId?'WHERE actor_id=?':'';const args=actorId?[actorId]:[];
    const rows=await q(`SELECT id,actor_id,actor_name,target_id,area,action,summary,created_at FROM admin_employee_audit ${filter} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,[...args,limit,offset]);
    return rows.map(r=>({id:Number(r.id),actorId:Number(r.actor_id),actor:r.actor_name,targetId:r.target_id==null?null:Number(r.target_id),area:r.area,action:r.action,summary:r.summary,at:Number(r.created_at)}));
  }
  async function reauthLimited(sessionHash,userId){
    await initializeProfiles();const rows=await q('SELECT attempts,window_start FROM admin_employee_reauth_failures WHERE session_hash=? AND user_id=?',[sessionHash,userId]);
    return rows.length>0 && Number(rows[0].window_start)>Date.now()-10*60000 && Number(rows[0].attempts)>=5;
  }
  async function reauthFailure(sessionHash,userId){
    await initializeProfiles();
    await q(`INSERT INTO admin_employee_reauth_failures(session_hash,user_id,attempts,window_start) VALUES(?,?,1,?)
      ON CONFLICT(session_hash) DO UPDATE SET user_id=excluded.user_id,
        attempts=CASE WHEN admin_employee_reauth_failures.window_start<? THEN 1 ELSE admin_employee_reauth_failures.attempts+1 END,
        window_start=CASE WHEN admin_employee_reauth_failures.window_start<? THEN excluded.window_start ELSE admin_employee_reauth_failures.window_start END`,
      [sessionHash,userId,Date.now(),Date.now()-10*60000,Date.now()-10*60000]);
  }
  async function grantReauth(sessionHash,userId){
    await initializeProfiles();
    await q('INSERT INTO admin_employee_reauth(session_hash,user_id,verified_until) VALUES(?,?,?) ON CONFLICT(session_hash) DO UPDATE SET user_id=excluded.user_id,verified_until=excluded.verified_until',[sessionHash,userId,Date.now()+5*60000]);
    await q('DELETE FROM admin_employee_reauth_failures WHERE session_hash=?',[sessionHash]);
  }
  async function hasReauth(sessionHash,userId){await initializeProfiles();const rows=await q('SELECT verified_until FROM admin_employee_reauth WHERE session_hash=? AND user_id=?',[sessionHash,userId]);return !!rows[0] && Number(rows[0].verified_until)>Date.now();}
  async function taskCompleted(actor,taskId){
    await initializeProfiles();await q('INSERT INTO admin_employee_task_events(task_id,completed_by,completed_at) VALUES(?,?,?)',[taskId,Number(actor.id),Date.now()]);
  }
  async function completedByCounts(){
    await initializeProfiles();const rows=await q('SELECT completed_by,COUNT(DISTINCT task_id) AS completed FROM admin_employee_task_events GROUP BY completed_by');
    return new Map(rows.map(r=>[Number(r.completed_by),Number(r.completed)||0]));
  }
  async function staffList() {
    await init();const query=`SELECT id,name,email,role,is_blocked,created_at FROM users WHERE role='staff' ORDER BY id DESC`;
    const rows=pg?(await database._query(query)).rows:database.db.prepare(query).all();
    return Promise.all(rows.map(async r=>({id:Number(r.id),name:r.name,email:r.email,role:r.role,blocked:!!Number(r.is_blocked),createdAt:Number(r.created_at||0),permissions:await read(r.id),...(await profile(r.id))})));
  }
  return {init,read,readEffective,write,staffList,profile,setProfile,isExpired,audit,auditList,grantReauth,hasReauth,taskCompleted,completedByCounts,reauthLimited,reauthFailure};
}
module.exports={GROUPS,KEYS,DEFAULT,PAGE_KEYS,PRESETS,validKeys,withPagePermissions,can,allowed,createEmployeeAccess};
