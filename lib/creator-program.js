'use strict';

// Creator codes are reusable identifiers (optionally a discount). Revenue is
// counted from real paid orders only; historical codes remain attached to their
// owner even if that owner's current code changes.
const normalize = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0,40);

function createCreatorProgram(database) {
  const pg = database.backend === 'postgres';
  async function query(db, statement, values=[]) {
    if (pg) {
      let i = 0;
      const stmt = statement.replace(/\?/g, () => '$'+(++i));
      const result = await db._query(stmt, values);
      return { rows: result.rows || [], changed: Number(result.rowCount || 0) };
    }
    const stmt = db.db.prepare(statement);
    if (/^\s*SELECT\b/i.test(statement)) return { rows: stmt.all(...values), changed: 0 };
    const r = stmt.run(...values);
    return {rows: [], changed: Number(r.changes || 0)};
  }
  async function init() {
    const table = `CREATE TABLE IF NOT EXISTS creator_codes (
      code TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 30),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at BIGINT NOT NULL
    )`;
    if(pg) await database._query(table);
    else database.db.exec(table);
    const idx = `CREATE INDEX IF NOT EXISTS idx_creator_codes_owner ON creator_codes(user_id, active)`;
    if(pg) await database._query(idx); else database.db.exec(idx);
  }
  async function getActiveCode(code) {
    const value=normalize(code);
    if(!value) return null;
    const result = await query(database, `SELECT c.code,c.user_id,c.discount_percent,u.name FROM creator_codes c JOIN users u ON u.id=c.user_id WHERE c.code=? AND c.active=1 AND u.role='contentcreator' AND u.is_blocked=0 LIMIT 1`,[value]);
    return result.rows[0] || null;
  }
  async function listCreators() {
    const r = await query(database, `SELECT u.id,u.name,u.email,u.role,u.is_blocked,c.code,c.discount_percent,c.active,
      COUNT(o.id) AS sales,COALESCE(SUM(o.amount_agorot),0) AS revenue_agorot
      FROM users u JOIN creator_codes c ON c.user_id=u.id
      LEFT JOIN orders o ON o.coupon_code=c.code AND o.status='paid'
      GROUP BY u.id,u.name,u.email,u.role,u.is_blocked,c.code,c.discount_percent,c.active
      ORDER BY u.name ASC,c.created_at DESC`);
    const map = new Map();
    for (const row of r.rows) {
      let item=map.get(Number(row.id));
      if(!item){item={id:Number(row.id),name:row.name,email:row.email,role:row.role,blocked:Number(row.is_blocked)===1,code:'',discountPercent:0,active:false,sales:0,revenueAgorot:0};map.set(item.id,item);}
      item.sales+=Number(row.sales||0);item.revenueAgorot+=Number(row.revenue_agorot||0);
      if(Number(row.active)===1 && !item.code){item.code=row.code;item.discountPercent=Number(row.discount_percent||0);item.active=item.role==='contentcreator'&&!item.blocked;}
    }
    return [...map.values()];
  }
  async function getCreatorByUser(userId){
    const r=await query(database, `SELECT c.code,c.discount_percent,c.user_id,u.name,u.role,u.is_blocked FROM creator_codes c JOIN users u ON u.id=c.user_id WHERE c.user_id=? AND c.active=1 ORDER BY c.created_at DESC LIMIT 1`,[userId]);
    const row=r.rows[0];return row && row.role==='contentcreator'&&Number(row.is_blocked)===0?row:null;
  }
  async function grantByEmail(email,code,percent){
    const normalizedEmail=String(email||'').trim().toLowerCase();
    const normalizedCode=normalize(code);
    const rate=Number(percent);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw Object.assign(new Error('invalid_email'),{status:400});
    if(!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(normalizedCode)) throw Object.assign(new Error('invalid_creator_code'),{status:400});
    if(!Number.isInteger(rate)||rate<0||rate>30) throw Object.assign(new Error('invalid_discount_percent'),{status:400});
    return database.transaction(async tx=>{
      const user=(await query(tx,'SELECT id,name,email,role,is_blocked FROM users WHERE LOWER(email)=? LIMIT 1',[normalizedEmail])).rows[0];
      if(!user) throw Object.assign(new Error('user_not_found'),{status:404});
      if(Number(user.is_blocked)===1) throw Object.assign(new Error('blocked_user'),{status:400});
      if(['admin','staff'].includes(user.role)) throw Object.assign(new Error('protected_role'),{status:403});
      const existing=(await query(tx,'SELECT code,user_id FROM creator_codes WHERE code=? LIMIT 1',[normalizedCode])).rows[0];
      if(existing && Number(existing.user_id)!==Number(user.id)) throw Object.assign(new Error('creator_code_taken'),{status:409});
      const welcome=(await query(tx,'SELECT code FROM coupons WHERE code=? LIMIT 1',[normalizedCode])).rows[0];
      if(welcome) throw Object.assign(new Error('coupon_code_taken'),{status:409});
      // Preserve old inactive codes for accurate lifetime history.
      await query(tx,'UPDATE creator_codes SET active=0 WHERE user_id=?',[user.id]);
      if(existing) await query(tx,'UPDATE creator_codes SET active=1,discount_percent=? WHERE code=?',[rate,normalizedCode]);
      else await query(tx,'INSERT INTO creator_codes(code,user_id,discount_percent,active,created_at) VALUES(?,?,?,1,?)',[normalizedCode,user.id,rate,Date.now()]);
      await query(tx,"UPDATE users SET role='contentcreator' WHERE id=?",[user.id]);
      return {id:Number(user.id),name:user.name,code:normalizedCode,discountPercent:rate};
    });
  }
  async function revoke(userId){
    const id=Number(userId);
    return database.transaction(async tx=>{
      const r=await query(tx,"UPDATE users SET role='customer' WHERE id=? AND role='contentcreator'",[id]);
      await query(tx,'UPDATE creator_codes SET active=0 WHERE user_id=?',[id]);
      return r.changed>0;
    });
  }
  async function dashboard(userId){
    const creator=await getCreatorByUser(userId);
    if(!creator) return null;
    const now=Date.now(), since=now-30*86400000;
    const r=await query(database,`SELECT COUNT(o.id) AS sales, COALESCE(SUM(o.amount_agorot),0) AS revenue_agorot,
      COALESCE(SUM(CASE WHEN o.paid_at>=? THEN 1 ELSE 0 END),0) AS sales30,
      COALESCE(SUM(CASE WHEN o.paid_at>=? THEN o.amount_agorot ELSE 0 END),0) AS revenue30,
      MAX(o.paid_at) AS last_paid_at
      FROM creator_codes c LEFT JOIN orders o ON o.coupon_code=c.code AND o.status='paid'
      WHERE c.user_id=?`,[since,since,userId]);
    const a=r.rows[0]||{};
    return {name:creator.name,code:creator.code,discountPercent:Number(creator.discount_percent||0),sales:Number(a.sales||0),revenueAgorot:Number(a.revenue_agorot||0),sales30:Number(a.sales30||0),revenue30Agorot:Number(a.revenue30||0),lastPaidAt:a.last_paid_at?Number(a.last_paid_at):null};
  }
  async function leaderboard(){
    const r=await query(database,`SELECT u.id,u.name,COUNT(o.id) AS sales
      FROM users u JOIN creator_codes c ON c.user_id=u.id
      LEFT JOIN orders o ON o.coupon_code=c.code AND o.status='paid'
      WHERE u.role='contentcreator' AND u.is_blocked=0
      GROUP BY u.id,u.name ORDER BY sales DESC,u.name ASC`);
    const entries=[];
    for(const row of r.rows){
      const active=await getCreatorByUser(row.id);
      if(active) entries.push({name:row.name,code:active.code,sales:Number(row.sales||0)});
    }
    return entries;
  }
  return {init,getActiveCode,grantByEmail,revoke,listCreators,dashboard,leaderboard,getCreatorByUser,normalize};
}
module.exports={createCreatorProgram};
