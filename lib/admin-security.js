'use strict';
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

function createAdminSecurity(database, { sqlitePath, root }) {
  const pg=database.backend==='postgres';
  let initPromise,maintenanceCache={at:0,active:false};
  const hex = (value) => crypto.createHash('sha256').update(String(value||'')).digest('hex');
  const run = async (sql,params=[]) => {
    if(pg){let idx=0;const text=sql.replace(/\?/g,()=>'$'+(++idx));return (await database._query(text,params)).rows;}
    const statement=database.db.prepare(sql);return /^\s*SELECT\b/i.test(sql)?statement.all(...params):statement.run(...params);
  };
  const one=async(sql,params=[]) => (await run(sql,params))[0]||null;
  function init(){if(!initPromise)initPromise=(async()=>{
    const statements=[
      `CREATE TABLE IF NOT EXISTS admin_known_devices (user_id BIGINT NOT NULL,device_hash TEXT NOT NULL,label TEXT NOT NULL,first_seen BIGINT NOT NULL,last_seen BIGINT NOT NULL,PRIMARY KEY(user_id,device_hash))`,
      `CREATE TABLE IF NOT EXISTS admin_login_sessions (session_hash TEXT PRIMARY KEY,user_id BIGINT NOT NULL,device_hash TEXT NOT NULL,label TEXT NOT NULL,created_at BIGINT NOT NULL,last_seen BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS admin_security_events (id TEXT PRIMARY KEY,kind TEXT NOT NULL,actor_id BIGINT,detail TEXT NOT NULL,created_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS admin_recycle_bin (id TEXT PRIMARY KEY,kind TEXT NOT NULL,object_key TEXT NOT NULL,payload TEXT NOT NULL,actor_id BIGINT,created_at BIGINT NOT NULL,restored_at BIGINT,restored_by BIGINT)`,
      `CREATE TABLE IF NOT EXISTS admin_change_versions (id TEXT PRIMARY KEY,kind TEXT NOT NULL,object_key TEXT NOT NULL,payload TEXT NOT NULL,actor_id BIGINT,created_at BIGINT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS idx_versans_secure_session_user ON admin_login_sessions(user_id,last_seen)`,
      `CREATE INDEX IF NOT EXISTS idx_versans_secure_events_at ON admin_security_events(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_versans_secure_trash_at ON admin_recycle_bin(created_at)`
    ];
    for(const statement of statements) await run(statement);
  })().catch(e=>{initPromise=null;throw e;});return initPromise;}
  async function event(kind,actorId,detail){await init();await run('INSERT INTO admin_security_events(id,kind,actor_id,detail,created_at) VALUES(?,?,?,?,?)',[crypto.randomUUID(),String(kind).slice(0,80),actorId||null,String(detail||'').slice(0,350),Date.now()]);}
  async function registerSession({user,token,deviceToken,userAgent}){
    await init();if(!['admin','staff'].includes(String(user.role||'')))return false;
    const now=Date.now(),id=hex(token),device=hex(deviceToken),label=String(userAgent||'דפדפן לא ידוע').replace(/[<>]/g,'').slice(0,120);
    const existing=await one('SELECT first_seen FROM admin_known_devices WHERE user_id=? AND device_hash=?',[user.id,device]);
    const count=await one('SELECT COUNT(*) AS amount FROM admin_known_devices WHERE user_id=?',[user.id]);
    await run('INSERT INTO admin_known_devices(user_id,device_hash,label,first_seen,last_seen) VALUES(?,?,?,?,?) ON CONFLICT(user_id,device_hash) DO UPDATE SET label=excluded.label,last_seen=excluded.last_seen',[user.id,device,label,now,now]);
    await run('INSERT INTO admin_login_sessions(session_hash,user_id,device_hash,label,created_at,last_seen) VALUES(?,?,?,?,?,?) ON CONFLICT(session_hash) DO UPDATE SET last_seen=excluded.last_seen',[id,user.id,device,label,now,now]);
    if(!existing){await event('new_device',user.id,`התחברות מדפדפן חדש: ${label}`);}
    return !existing && Number(count?.amount||0)>0;
  }
  const sessionThrottle=new Map();
  async function seenSession(user,token,deviceToken,userAgent){
    if(!user||!token||!['admin','staff'].includes(user.role))return;
    const hash=hex(token),now=Date.now();if((sessionThrottle.get(hash)||0)>now-3*60*1000)return;
    sessionThrottle.set(hash,now);if(sessionThrottle.size>3000)sessionThrottle.clear();
    await init();const rec=await one('SELECT session_hash FROM admin_login_sessions WHERE session_hash=?',[hash]);
    if(rec) await run('UPDATE admin_login_sessions SET last_seen=? WHERE session_hash=?',[now,hash]);
    else await registerSession({user,token,deviceToken:deviceToken||hex(token),userAgent});
  }
  async function sessions(userId,currentHash){
    await init();const now=Date.now();const rows=await run('SELECT d.session_hash,d.label,d.created_at,d.last_seen,s.expires_at FROM admin_login_sessions d JOIN sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id WHERE d.user_id=? AND s.expires_at>? ORDER BY d.last_seen DESC LIMIT 100',[userId,now]);
    return rows.map(r=>({id:r.session_hash.slice(0,18),label:r.label,createdAt:Number(r.created_at),lastSeen:Number(r.last_seen),expiresAt:Number(r.expires_at),current:r.session_hash===currentHash}));
  }
  async function allAdminSessions(currentHash){
    await init();const now=Date.now();
    const rows=await run("SELECT d.session_hash,d.user_id,u.email,d.label,d.created_at,d.last_seen,s.expires_at FROM admin_login_sessions d JOIN sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id JOIN users u ON u.id=d.user_id WHERE s.expires_at>? AND (u.role IN ('admin','staff') OR LOWER(u.email)='camaraprodetect@gmail.com') ORDER BY d.last_seen DESC LIMIT 150",[now]);
    return rows.map(r=>({id:r.session_hash.slice(0,18),userId:Number(r.user_id),email:r.email,label:r.label,createdAt:Number(r.created_at),lastSeen:Number(r.last_seen),expiresAt:Number(r.expires_at),current:r.session_hash===currentHash}));
  }
  async function revoke(userId,sessionId,currentHash){
    await init();if(!/^[a-f0-9]{18}$/.test(String(sessionId)))return false;
    const rows=await run('SELECT session_hash FROM admin_login_sessions WHERE user_id=?',[userId]);
    const matched=rows.filter(r=>r.session_hash.startsWith(sessionId));if(matched.length!==1) return false;
    await database.deleteSession(matched[0].session_hash);
    await run('DELETE FROM admin_login_sessions WHERE session_hash=?',[matched[0].session_hash]);
    await event('revoke_device',userId,matched[0].session_hash===currentHash?'ניתוק מכשיר נוכחי':'ניתוק מכשיר אחר');
    return {current:matched[0].session_hash===currentHash};
  }
  async function setMaintenance(active,actorId){
    await init();const previous=await database.getSchemaMeta('admin_maintenance_enabled_v1');
    await version('maintenance','store',{active:previous==='1'},actorId);
    await database.setSchemaMeta('admin_maintenance_enabled_v1',active?'1':'0');maintenanceCache={at:Date.now(),active:!!active};
    await event('maintenance',actorId,active?'מצב תחזוקה הופעל':'מצב תחזוקה בוטל');
  }
  async function maintenance(){if(Date.now()-maintenanceCache.at>4000){const v=await database.getSchemaMeta('admin_maintenance_enabled_v1');maintenanceCache={at:Date.now(),active:v==='1'};}return maintenanceCache.active;}
  async function recycle(kind,key,payload,actorId){
    await init();const id=crypto.randomUUID();
    await run('INSERT INTO admin_recycle_bin(id,kind,object_key,payload,actor_id,created_at) VALUES(?,?,?,?,?,?)',[id,kind,key,JSON.stringify(payload),actorId,Date.now()]);return id;
  }
  async function removeRecycle(id){await init();await run('DELETE FROM admin_recycle_bin WHERE id=?',[id]);}
  async function recycleList(){await init();const rows=await run('SELECT id,kind,object_key,actor_id,created_at,restored_at FROM admin_recycle_bin ORDER BY created_at DESC LIMIT 150');return rows.map(x=>({id:x.id,kind:x.kind,key:x.object_key,actorId:Number(x.actor_id||0),createdAt:Number(x.created_at),restored:!!x.restored_at}));}
  async function readRecycle(id){await init();return one('SELECT * FROM admin_recycle_bin WHERE id=? AND restored_at IS NULL',[id]);}
  async function markRestored(id,actorId){await init();await run('UPDATE admin_recycle_bin SET restored_at=?,restored_by=? WHERE id=? AND restored_at IS NULL',[Date.now(),actorId,id]);}
  async function version(kind,key,payload,actorId){
    await init();const id=crypto.randomUUID();await run('INSERT INTO admin_change_versions(id,kind,object_key,payload,actor_id,created_at) VALUES(?,?,?,?,?,?)',[id,kind,key,JSON.stringify(payload),actorId||null,Date.now()]);return id;
  }
  async function versions(){await init();return (await run('SELECT id,kind,object_key,actor_id,created_at FROM admin_change_versions ORDER BY created_at DESC LIMIT 150')).map(x=>({id:x.id,kind:x.kind,key:x.object_key,actorId:Number(x.actor_id||0),createdAt:Number(x.created_at)}));}
  async function readVersion(id){await init();return one('SELECT * FROM admin_change_versions WHERE id=?',[id]);}
  async function sheetHealth(pendingProductIds=[]){
    await init();const cutoff=Date.now()-7*86400000;
    const failed=await run("SELECT order_ref,paid_at FROM orders WHERE status='paid' AND google_sheet_synced_at IS NULL AND paid_at>? AND order_ref NOT LIKE 'VS-DEMO-%' ORDER BY paid_at DESC LIMIT 30",[cutoff]);
    return {pendingProducts:pendingProductIds.slice(0,50),pendingOrders:failed.map(x=>({ref:x.order_ref,paidAt:Number(x.paid_at)})),failedEvents:(await run("SELECT detail,created_at FROM admin_security_events WHERE kind='sheet_failure' ORDER BY created_at DESC LIMIT 20")).map(x=>({detail:x.detail,createdAt:Number(x.created_at)}))};
  }
  async function events(){await init();return (await run('SELECT kind,detail,created_at FROM admin_security_events ORDER BY created_at DESC LIMIT 35')).map(x=>({kind:x.kind,detail:x.detail,createdAt:Number(x.created_at)}));}
  function backupDirectory(){return String(process.env.VERSANS_BACKUP_DIR||'').trim()?path.resolve(process.env.VERSANS_BACKUP_DIR):null;}
  function processCommand(binary,args,env){return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{env:{...process.env,...env},stdio:['ignore','ignore','pipe']});let err='';
    child.stderr.on('data',buf=>err=(err+buf.toString()).slice(-2000));child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(binary+'_failed: '+err.replace(/postgres(?:ql)?:\/\/[^\s]+/ig,'[redacted]').slice(-180))));
  });}
  const backupStateKey='admin_backup_state_v1';let backupBusy=false;
  async function backup(){
    if(backupBusy)throw Object.assign(new Error('backup_in_progress'),{status:409});
    const dir=backupDirectory();if(!dir)throw Object.assign(new Error('backup_directory_not_configured'),{status:409});
    backupBusy=true;
    const now=Date.now();const stamp=new Date(now).toISOString().replace(/[:.]/g,'-');
    let file='',verification='failed';
    try{
      fs.mkdirSync(dir,{recursive:true,mode:0o700});
      if(pg){
        const raw=process.env.DATABASE_URL;
        if(!raw)throw new Error('DATABASE_URL_missing');
        const url=new URL(raw),password=decodeURIComponent(url.password);url.password='';
        file=path.join(dir,`versans-${stamp}.dump`);
        await processCommand('pg_dump',['-Fc','--no-owner','--no-privileges','--file',file,'--dbname',url.toString()],{PGPASSWORD:password});
        await processCommand('pg_restore',['--list',file],{});verification='archive_structure_checked';
        // A separate, expendable test DB can be configured for a full restore test.
        if(process.env.VERSANS_BACKUP_TEST_DATABASE_URL){
          const test=new URL(process.env.VERSANS_BACKUP_TEST_DATABASE_URL);
          if(!/^versans_backup_test_[a-z\d_]+$/.test(test.pathname.slice(1)))throw new Error('unsafe_backup_test_db_name');
          if(test.toString()===raw)throw new Error('backup_test_db_must_be_separate');
          const pass=decodeURIComponent(test.password);test.password='';
          await processCommand('pg_restore',['--exit-on-error','--clean','--if-exists','--no-owner','--dbname',test.toString(),file],{PGPASSWORD:pass});
          verification='full_restore_test_passed';
        }
      }else{
        file=path.join(dir,`versans-${stamp}.sqlite`);const src=database.db;
        if(!src)throw new Error('sqlite_not_available');
        src.exec(`VACUUM INTO '${file.replace(/'/g,"''")}'`);
        const test=new DatabaseSync(file,{readOnly:true});
        try{const result=test.prepare('PRAGMA quick_check').all();if(result.length!==1||result[0].quick_check!=='ok')throw new Error('sqlite_integrity_failure');const tables=test.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'").get().c;if(tables<5)throw new Error('sqlite_restore_test_empty');verification='sqlite_reopen_integrity_checked';}finally{test.close();}
      }
      const detail={ok:true,at:now,filename:path.basename(file),bytes:fs.statSync(file).size,verification};
      await database.setSchemaMeta(backupStateKey,JSON.stringify(detail));
      // Retain the latest 14 backups in configured persistent storage.
      const files=fs.readdirSync(dir).filter(f=>/^versans-\d{4}-.*\.(?:sqlite|dump)$/.test(f)).sort().reverse();
      for(const old of files.slice(14))fs.unlinkSync(path.join(dir,old));
      await event('backup',null,`גיבוי ${detail.filename} (${verification})`);return detail;
    }catch(error){if(file && fs.existsSync(file))try{fs.unlinkSync(file);}catch(_){}
      const detail={ok:false,at:now,error:String(error.message).slice(0,250)};await database.setSchemaMeta(backupStateKey,JSON.stringify(detail));throw error;
    }finally{backupBusy=false;}
  }
  async function backupStatus(){let latest=null;try{latest=JSON.parse(await database.getSchemaMeta(backupStateKey)||'null');}catch(_){}
    const dir=backupDirectory();const unsafe=!!dir && (dir===root || dir.startsWith(root+path.sep));
    return {configured:!!dir,backend:database.backend,latest,warning:!dir?'הגדר VERSANS_BACKUP_DIR על אחסון מתמשך/חיצוני; בלי זה גיבוי אינו מופעל.':unsafe?'אזהרה: תיקיית הגיבוי נמצאת בתוך קוד הפרויקט ועלולה להימחק ב-Deploy. מומלץ דיסק מתמשך וגיבוי נוסף מחוץ לשרת.':null};}
  async function dailyBackup(){if(!backupDirectory())return;const state=await backupStatus();if(state.latest?.ok && Date.now()-state.latest.at<23*3600*1000)return;try{await backup();}catch(e){console.error('VerSans backup failed:',e.message);}}
  return {init,event,registerSession,seenSession,sessions,allAdminSessions,revoke,setMaintenance,maintenance,recycle,removeRecycle,recycleList,readRecycle,markRestored,version,versions,readVersion,sheetHealth,events,backup,backupStatus,dailyBackup};
}
module.exports={createAdminSecurity};
