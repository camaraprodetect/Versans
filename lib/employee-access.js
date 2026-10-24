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
  ['products','מוצרים',[['view','צפייה'],['edit','עריכת מוצרים והקטלוג']]],
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
const PAGE_KEYS = { dashboard:'dashboard.view',visitors:'visitors.view',sales:'sales.view',income:'income.view',expenses:'expenses.view', 'order-work':'orders.view',orders:'orders.view',anomalies:'anomalies.view',products:'products.view',marketing:'marketing.view',creators:'creators.view',customers:'customers.view',tasks:'tasks.view',security:'security.view',reports:'reports.view',reviews:'reviews.view',employees:'employees.view' };
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
    '/api/admin/packaging/lookup': 'orders.view',
    '/api/admin/packaging/order': 'orders.view',
    '/api/admin/packaging/unit': 'orders.edit',
    '/api/admin/packaging/scan': 'orders.edit',
    '/api/admin/shipping/pickup-message':'orders.edit',
    '/api/admin/employees':read?'employees.view':'employees.create',
    '/api/admin/employees/catalog':'employees.view'
  };
  if (Object.hasOwn(specific,path)) return specific[path];
  if (/^\/api\/admin\/report-schedules\/\d+$/.test(path)) return method==='DELETE'?'reports.schedule':null;
  if (/^\/api\/admin\/finance\/expenses\/\d+$/.test(path)) return method==='GET'?'expenses.view':method==='PATCH'?'expenses.edit':method==='DELETE'?'expenses.cancel':null;
  if (/^\/api\/admin\/finance\/recurring\/\d+$/.test(path)) return method==='PATCH'?'expenses.recurring':null;
  if (/^\/api\/admin\/finance\/refunds\/\d+$/.test(path)) return method==='PATCH'?'income.refunds':null;
  if (/^\/api\/admin\/employees\/\d+$/.test(path)) return method==='GET'?'employees.view':method==='PATCH'?'employees.edit':null;
  if (/^\/api\/admin\/internal-tasks\/\d+$/.test(path)) return read?'tasks.view':method==='PATCH'?'tasks.status':method==='DELETE'?'tasks.delete':null;
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
  if (key==='preferences'||key==='push') return true;
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
  async function staffList() {
    await init();const query=`SELECT id,name,email,role,is_blocked,created_at FROM users WHERE role='staff' ORDER BY id DESC`;
    const rows=pg?(await database._query(query)).rows:database.db.prepare(query).all();
    return Promise.all(rows.map(async r=>({id:Number(r.id),name:r.name,email:r.email,role:r.role,blocked:!!Number(r.is_blocked),createdAt:Number(r.created_at||0),permissions:await read(r.id)})));
  }
  return {init,read,write,staffList};
}
module.exports={GROUPS,KEYS,DEFAULT,PAGE_KEYS,validKeys,withPagePermissions,can,allowed,createEmployeeAccess};
