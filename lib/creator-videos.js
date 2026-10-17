'use strict';
const {normalizeTikTokHandle} = require('./creator-program.js');

// TikTok video rewards are deliberately separate from coupon commissions.
// Only server-side Apify reads can create view checkpoints or earnings.
const JERUSALEM = 'Asia/Jerusalem';
const fmt = new Intl.DateTimeFormat('en-CA', {timeZone:JERUSALEM,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(stamp=Date.now()) {
  const p={}; for(const x of fmt.formatToParts(new Date(stamp))) if(x.type!=='literal') p[x.type]=Number(x.value);
  return p;
}
function localDay(stamp=Date.now()) { const p=parts(stamp); return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`; }
function parseTikTokUrl(value) {
  const input=String(value||'').trim(); if(input.length>350) return null;
  let url;try { url=new URL(input); } catch {return null;}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||!(host==='tiktok.com'||host.endsWith('.tiktok.com'))||url.username||url.password||url.port) return null;
  const match=/^\/@([\w.]{2,40})\/(?:video|photo)\/(\d{15,22})(?:\/)?$/.exec(url.pathname);
  if (!match) return null;
  return {id:match[2],url:`https://www.tiktok.com/@${match[1]}/video/${match[2]}`,handle:match[1].toLowerCase()};
}
const fail = (message,status=400) => Object.assign(new Error(message),{status});
async function resolveTikTokUrl(value) {
  const direct=parseTikTokUrl(value);
  if(direct)return direct;
  let url;try{url=new URL(String(value||'').trim());}catch{return null;}
  if(url.protocol!=='https:' || url.username || url.password || url.port)return null;
  if(!['vt.tiktok.com','vm.tiktok.com','www.tiktok.com','tiktok.com'].includes(url.hostname.toLowerCase()))return null;
  if(!/^\/(?:t\/|[A-Za-z0-9]+\/?$)/.test(url.pathname))return null;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try {
    for(let i=0;i<6;i++) {
      const result=parseTikTokUrl(url.toString());if(result)return result;
      const response=await fetch(url.toString(),{method:'HEAD',redirect:'manual',signal:controller.signal});
      if(![301,302,303,307,308].includes(response.status))break;
      const location=response.headers.get('location');if(!location)break;
      url=new URL(location,url);
      const host=url.hostname.toLowerCase();
      if(url.protocol!=='https:'||url.username||url.password||url.port||!(host==='tiktok.com'||host.endsWith('.tiktok.com')))break;
    }
  }catch(_){/* The full TikTok link remains a safe fallback. */}
  finally{clearTimeout(timeout);}
  return null;
}

// Trust actual author metadata returned by Apify, never the username in a
// submitted URL (which can be forged while keeping the same video ID).
function getApifyAuthor(item) {
  const a=(item.authorMeta && typeof item.authorMeta==='object' ? item.authorMeta : null) || (item.author && typeof item.author==='object'?item.author:null) || {};
  const name=a.name||a.uniqueId||a.username||a.unique_id||item['authorMeta.name']||item['authorMeta.uniqueId']||item.authorUsername;
  return normalizeTikTokHandle(name);
}
function extractApify(result,expectedId) {
  if(!Array.isArray(result)) throw fail('apify_invalid_result',502);
  for (const item of result) {
    if(!item || typeof item!=='object') continue;
    const videoUrl=item.webVideoUrl||item.postUrl||item.videoUrl||item.url||'';
    const id=String(videoUrl).match(/\/(?:video|photo)\/(\d{15,22})/)?.[1] || String(item.id || item.videoId || item.postId || '').match(/^\d{15,22}$/)?.[0];
    if(id!==expectedId) continue;
    const raw=item.playCount ?? item.stats?.playCount ?? item.statsV2?.playCount ?? item.viewCount;
    const views=Number(raw);
    if(!Number.isSafeInteger(views)||views<0) throw fail('apify_views_missing',502);
    const author=getApifyAuthor(item);
    if(!author) throw fail('apify_author_missing',502);
    return {views,videoId:id,url:String(videoUrl||'').slice(0,300),author,observedAt:Date.now()};
  }
  throw fail('apify_video_not_found',502);
}
async function apifyReadVideos(videos) {
  if(!process.env.APIFY_API_TOKEN) throw fail('apify_not_configured',503);
  const result=new Map();
  for (let offset=0;offset<videos.length;offset+=10) {
    const group=videos.slice(offset,offset+10);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),115000);
    try {
      const actor=String(process.env.APIFY_TIKTOK_ACTOR||'clockworks~tiktok-video-scraper');
      if(!/^[\w-]+~[\w-]+$/.test(actor)) throw fail('invalid_apify_actor',503);
      const response=await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=120`,{
        method:'POST',signal:controller.signal,
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.APIFY_API_TOKEN},
        body:JSON.stringify({postURLs:group.map(v=>v.video_url),scrapeRelatedVideos:false,shouldDownloadCovers:false,shouldDownloadVideos:false,shouldDownloadSlideshowImages:false,downloadSubtitlesOptions:'NEVER_DOWNLOAD_SUBTITLES'})
      });
      if(!response.ok) throw fail('apify_http_'+response.status,502);
      let items;
      try {items=await response.json();}
      catch {throw fail('apify_invalid_result',502);}
      if(!Array.isArray(items))throw fail('apify_invalid_result',502);
      for (const video of group) {
        try {result.set(video.video_id,extractApify(items,video.video_id));}
        catch(err) {result.set(video.video_id,{error:err.message});}
      }
    } catch(err) {
      const code=err.name==='AbortError'?'apify_timeout':err.message||'apify_failed';
      for(const video of group) result.set(video.video_id,{error:code});
    } finally {clearTimeout(timeout);}
  }
  return result;
}
function createCreatorVideos(database,creatorProgram,{fetchVideos=apifyReadVideos,clock=()=>Date.now()}={}) {
  const pg=database.backend==='postgres';
  async function query(db,sql,params=[]) {
    if (pg) {
      let n=0;const r=await db._query(sql.replace(/\?/g,()=>'$'+(++n)),params);
      return {rows:r.rows||[],changed:Number(r.rowCount||0)};
    }
    const stmt=db.db.prepare(sql);
    if(/^\s*SELECT\b/i.test(sql)) return {rows:stmt.all(...params),changed:0};
    const r=stmt.run(...params);return {rows:[],changed:r.changes||0};
  }
  async function exec(sql) {if(pg) await database._query(sql);else database.db.exec(sql);}
  async function init() {
    const id=pg?'INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY':'INTEGER PRIMARY KEY AUTOINCREMENT';
    await exec(`CREATE TABLE IF NOT EXISTS creator_videos (
      id ${id}, user_id INTEGER NOT NULL REFERENCES users(id), video_id TEXT NOT NULL UNIQUE,
      video_url TEXT NOT NULL, submitted_at BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', approved_at BIGINT,
      starting_views BIGINT, last_views BIGINT, last_checked_at BIGINT,
      verified_username TEXT, verified_at BIGINT,
      rate_per_1000_agorot INTEGER NOT NULL DEFAULT 300, last_error TEXT,
      CHECK(status IN ('pending','active','paused','rejected')),
      CHECK(rate_per_1000_agorot BETWEEN 0 AND 100000),
      CHECK(starting_views IS NULL OR starting_views>=0)
    )`);
    if(pg){
      await exec('ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS verified_username TEXT');
      await exec('ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS verified_at BIGINT');
    }else{
      const columns=database.db.prepare('PRAGMA table_info(creator_videos)').all();
      for(const [name,type] of [['verified_username','TEXT'],['verified_at','BIGINT']])
        if(!columns.some(c=>c.name===name)) await exec(`ALTER TABLE creator_videos ADD COLUMN ${name} ${type}`);
    }
    await exec('CREATE INDEX IF NOT EXISTS idx_creator_videos_owner ON creator_videos(user_id,status)');
    await exec(`CREATE TABLE IF NOT EXISTS creator_video_checks (
      id ${id}, video_ref INTEGER NOT NULL REFERENCES creator_videos(id) ON DELETE CASCADE,
      scheduled_day TEXT NOT NULL, scheduled_at BIGINT NOT NULL,
      observed_at BIGINT NOT NULL, views BIGINT NOT NULL,
      added_views BIGINT NOT NULL DEFAULT 0,
      earned_agorot BIGINT NOT NULL DEFAULT 0,
      rate_per_1000_agorot INTEGER NOT NULL,
      UNIQUE(video_ref,scheduled_day)
    )`);
    await exec('CREATE INDEX IF NOT EXISTS idx_creator_video_checks_period ON creator_video_checks(scheduled_at,video_ref)');
    await exec(`CREATE TABLE IF NOT EXISTS creator_video_daily_runs (
      scheduled_day TEXT PRIMARY KEY, status TEXT NOT NULL,
      started_at BIGINT NOT NULL, finished_at BIGINT, details TEXT
    )`);
  }
  async function submit(userId, input) {
    const link=await resolveTikTokUrl(input);
    if(!link) throw fail('invalid_tiktok_video_url');
    const eligible=await creatorProgram.getCreatorByUser(userId);
    if(!eligible) throw fail('contentcreator_required',403);
    const registered=normalizeTikTokHandle(eligible.tiktok_username);
    const rate=Number(eligible.rate_per_1000_agorot);
    if(!registered||!Number.isInteger(rate))throw fail('creator_tiktok_profile_required',403);
    if(!process.env.APIFY_API_TOKEN)throw fail('apify_not_configured',503);
    // Fast early rejection, then the actual author is checked against the
    // scraped metadata. The URL username is NOT considered proof of ownership.
    if(link.handle!==registered)throw fail('video_not_owned_by_creator',403);
    const limited=(await query(database,`SELECT COUNT(*) AS n FROM creator_videos WHERE user_id=? AND status IN ('pending','active','paused')`,[userId])).rows[0];
    if(Number(limited.n)>=40)throw fail('video_limit_reached');
    const submittedRecently=(await query(database,`SELECT COUNT(*) AS n FROM creator_videos WHERE user_id=? AND submitted_at>=?`,[userId,clock()-24*3600000])).rows[0];
    if(Number(submittedRecently.n)>=8)throw fail('daily_submission_limit');
    const found=(await query(database,'SELECT id FROM creator_videos WHERE video_id=?',[link.id])).rows[0];
    if(found) throw fail('video_already_registered',409);
    const scraped=(await fetchVideos([{video_id:link.id,video_url:link.url}])).get(link.id);
    if(!scraped||scraped.error)throw fail(scraped?.error||'apify_unavailable',502);
    if(!scraped.author||scraped.author!==registered)throw fail('video_not_owned_by_creator',403);
    try {
      await query(database,`INSERT INTO creator_videos(user_id,video_id,video_url,submitted_at,rate_per_1000_agorot,verified_username,verified_at)
        VALUES(?,?,?,?,?,?,?)`,[userId,link.id,link.url,clock(),rate,registered,clock()]);
    }catch(err){if(/unique|duplicate/i.test(err.message))throw fail('video_already_registered',409);throw err;}
    return {videoId:link.id,status:'pending'};
  }

  async function listForCreator(userId,range='payment') {
    const period=creatorProgram.reportPeriod(range,clock());if(!period)throw fail('invalid_range');
    const videos=(await query(database,`SELECT id,video_id,video_url,submitted_at,status,approved_at,starting_views,last_views,last_checked_at,rate_per_1000_agorot,last_error FROM creator_videos WHERE user_id=? ORDER BY submitted_at DESC`,[userId])).rows;
    const items=[];
    for (const row of videos) {
      let sql='SELECT COALESCE(SUM(added_views),0) AS gained,COALESCE(SUM(earned_agorot),0) AS earned,COUNT(*) AS checks FROM creator_video_checks WHERE video_ref=?';
      const params=[row.id];
      if(period.since!=null){sql+=' AND scheduled_at>=?';params.push(period.since);}
      if(period.before!=null){sql+=' AND scheduled_at<?';params.push(period.before);}
      const r=(await query(database,sql,params)).rows[0]||{};
      items.push({id:Number(row.id),url:row.video_url,status:row.status,submittedAt:Number(row.submitted_at),approvedAt:row.approved_at==null?null:Number(row.approved_at),startingViews:row.starting_views==null?null:Number(row.starting_views),views:row.last_views==null?null:Number(row.last_views),checkedAt:row.last_checked_at==null?null:Number(row.last_checked_at),ratePer1000Agorot:Number(row.rate_per_1000_agorot),gainedViews:Number(r.gained||0),earnedAgorot:Number(r.earned||0),checks:Number(r.checks||0),error:row.last_error||null});
    }
    const creator=await creatorProgram.getCreatorByUser(userId);
    return {range,tiktokUsername:creator?.tiktok_username||null,viewRatePer1000Agorot:creator?.rate_per_1000_agorot==null?null:Number(creator.rate_per_1000_agorot),periodStartAt:period.since,periodEndExclusive:period.before,items,totalEarnedAgorot:items.reduce((s,v)=>s+v.earnedAgorot,0),totalGainedViews:items.reduce((s,v)=>s+v.gainedViews,0),configured:Boolean(process.env.APIFY_API_TOKEN)};
  }
  async function latestRun(){
    const r=await query(database,'SELECT scheduled_day,status,started_at,finished_at,details FROM creator_video_daily_runs ORDER BY scheduled_day DESC LIMIT 1');
    return r.rows[0]||null;
  }
  async function listAdmin(){
    const r=await query(database,`SELECT v.*,u.name,u.email,t.tiktok_username,t.rate_per_1000_agorot AS creator_view_rate FROM creator_videos v JOIN users u ON u.id=v.user_id LEFT JOIN creator_tiktok_settings t ON t.user_id=v.user_id ORDER BY CASE v.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,v.submitted_at DESC LIMIT 300`);
    return r.rows.map(x=>({id:Number(x.id),userId:Number(x.user_id),creator:x.name,email:x.email,tiktokUsername:x.tiktok_username||'',url:x.video_url,status:x.status,views:x.last_views==null?null:Number(x.last_views),startingViews:x.starting_views==null?null:Number(x.starting_views),lastCheckedAt:x.last_checked_at==null?null:Number(x.last_checked_at),ratePer1000Agorot:Number(x.rate_per_1000_agorot),error:x.last_error||null}));
  }
  async function changeVideo(id,action,rate) {
    const row=(await query(database,'SELECT * FROM creator_videos WHERE id=?',[id])).rows[0];
    if(!row)throw fail('video_not_found',404);
    const creator=await creatorProgram.getCreatorByUser(row.user_id);
    if(!creator)throw fail('creator_not_active',403);
    const registered=normalizeTikTokHandle(creator.tiktok_username);
    const rateAgorot=Number(creator.rate_per_1000_agorot);
    if(!registered||!Number.isInteger(rateAgorot))throw fail('creator_tiktok_profile_required',403);
    // Validate the author again at approval time (not just upon submission).

    if(action==='approve') {
      if(!['pending','paused'].includes(row.status))throw fail('invalid_video_status');
      if(!process.env.APIFY_API_TOKEN)throw fail('apify_not_configured',503);
      // First approval verifies the video, then credits its first sampled cumulative views.
      if(row.starting_views==null || row.status==='paused') {
        const scraped=(await fetchVideos([row])).get(row.video_id);
        if(!scraped || scraped.error)throw fail(scraped?.error||'apify_unavailable',502);
        if(scraped.author!==registered)throw fail('video_not_owned_by_creator',403);
        // Admin explicitly verifies the creator posted this video FOR the campaign.
        // On first approval its lifetime TikTok views are eligible, including
        // views gained while awaiting approval. Old unrelated videos must not
        // be approved.  A resume excludes views earned while paused.
        const baseline=row.starting_views==null?0:Number(row.starting_views);
        const previous=row.last_views==null?0:Number(row.last_views);
        const newLast=row.status==='paused'?Math.max(previous,scraped.views):previous;
        await query(database,`UPDATE creator_videos SET status='active',approved_at=COALESCE(approved_at,?),starting_views=COALESCE(starting_views,?),last_views=?,last_checked_at=?,rate_per_1000_agorot=?,verified_username=?,verified_at=?,last_error=NULL WHERE id=?`,[clock(),baseline,newLast,clock(),rateAgorot,registered,clock(),id]);
      } else {
        // Even on a re-approval, never activate a video without rechecking its actual author.
        const scraped=(await fetchVideos([row])).get(row.video_id);
        if(!scraped || scraped.error)throw fail(scraped?.error||'apify_unavailable',502);
        if(scraped.author!==registered)throw fail('video_not_owned_by_creator',403);
        await query(database,`UPDATE creator_videos SET status='active',rate_per_1000_agorot=?,verified_username=?,verified_at=?,last_error=NULL WHERE id=?`,[rateAgorot,registered,clock(),id]);
      }
    } else if(action==='pause' && row.status==='active') {
      await query(database,"UPDATE creator_videos SET status='paused' WHERE id=?",[id]);
    } else if(action==='reject' && row.status==='pending') {
      await query(database,"UPDATE creator_videos SET status='rejected' WHERE id=?",[id]);
    } else if(action==='rate') {
      throw fail('rate_managed_per_creator',400);
    } else throw fail('invalid_video_action');
    return {ok:true};
  }
  async function claimDaily(day,now) {
    const old=(await query(database,'SELECT status,started_at FROM creator_video_daily_runs WHERE scheduled_day=?',[day])).rows[0];
    if(old?.status==='done'||old?.status==='partial'||old?.status==='failed')return false;
    if(old?.status==='running' && now-Number(old.started_at)<10*60*1000)return false;
    if(old){
      const r=await query(database,"UPDATE creator_video_daily_runs SET status='running',started_at=?,finished_at=NULL,details=NULL WHERE scheduled_day=? AND (status<>'running' OR started_at<?)",[now,day,now-10*60*1000]);
      return r.changed>0;
    }
    try{await query(database,"INSERT INTO creator_video_daily_runs(scheduled_day,status,started_at) VALUES(?,'running',?)",[day,now]);return true;}
    catch(err){if(/unique|duplicate/i.test(err.message))return false;throw err;}
  }
  async function dailyCheck(scheduledAt=clock()) {
    if(!process.env.APIFY_API_TOKEN)return {status:'unconfigured'};
    const day=localDay(scheduledAt);
    if(!await claimDaily(day,clock()))return {status:'already_started',day};
    const target=(await query(database,`SELECT v.id,v.video_id,v.video_url,v.last_views,v.starting_views,
      t.tiktok_username,t.rate_per_1000_agorot,v.verified_username
      FROM creator_videos v
      JOIN creator_tiktok_settings t ON t.user_id=v.user_id
      JOIN users u ON u.id=v.user_id
      WHERE v.status='active' AND u.role='contentcreator' AND u.is_blocked=0 ORDER BY v.id ASC`)).rows;
    let checked=0,failed=0,earnedAgorot=0;
    try {
      const scraped=await fetchVideos(target);
      for(const row of target){
        const item=scraped.get(row.video_id);
        if(!item || item.error || item.author!==row.tiktok_username || (row.verified_username && row.verified_username!==row.tiktok_username) || !Number.isSafeInteger(item.views) || item.views<Number(row.last_views)){
          failed++;
          const reason=item?.error || (item?.author!==row.tiktok_username||(row.verified_username && row.verified_username!==row.tiktok_username)?'video_not_owned_by_creator':'views_decreased_or_missing');
          await query(database,'UPDATE creator_videos SET last_error=? WHERE id=?',[String(reason).slice(0,100),row.id]);
          continue;
        }
        const prev=Number(row.last_views),base=Number(row.starting_views),views=item.views;
        const gained=views-prev;
        // Whole thousand-view milestones are paid exactly once across periods.
        // A rate change never recalculates historical checkpoints.
        const milestones=Math.max(0,Math.floor((views-base)/1000)-Math.floor((prev-base)/1000));
        const earnings=milestones*Number(row.rate_per_1000_agorot);
        await database.transaction(async tx=>{
          // Insert first: a retry must never award views or money twice.
          const inserted=await query(tx,`INSERT INTO creator_video_checks(video_ref,scheduled_day,scheduled_at,observed_at,views,added_views,earned_agorot,rate_per_1000_agorot)
          SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM creator_video_checks WHERE video_ref=? AND scheduled_day=?)`,[row.id,day,scheduledAt,item.observedAt||clock(),views,gained,earnings,row.rate_per_1000_agorot,row.id,day]);
          if(inserted.changed>0) {
            await query(tx,'UPDATE creator_videos SET last_views=?,last_checked_at=?,verified_username=?,verified_at=COALESCE(verified_at,?),last_error=NULL WHERE id=? AND last_views<=?',[views,item.observedAt||clock(),row.tiktok_username,item.observedAt||clock(),row.id,views]);
            checked++;earnedAgorot+=earnings;
          }
        });
      }
      await query(database,'UPDATE creator_video_daily_runs SET status=?,finished_at=?,details=? WHERE scheduled_day=?',[failed?'partial':'done',clock(),`${checked} checked, ${failed} failures`,day]);
      return {status:failed?'partial':'done',day,checked,failed,earnedAgorot};
    } catch(err) {
      await query(database,'UPDATE creator_video_daily_runs SET status=?,finished_at=?,details=? WHERE scheduled_day=?',['failed',clock(),String(err.message).slice(0,200),day]);
      throw err;
    }
  }
  function startScheduler(logger=console) {
    if(!process.env.APIFY_API_TOKEN){logger.log('[Creator videos] APIFY_API_TOKEN absent - daily checks disabled');return ()=>{};}
    let busy=false;
    async function tick(){
      if(busy)return;
      const now=clock(),p=parts(now);
      // Run as near as possible to 23:59 Israel time, regardless of server TZ.
      // The DB day lock prevents multiple instances from running the same day.
      if(p.hour!==23 || p.minute!==59)return;
      busy=true;
      try {logger.log('[Creator videos] daily check',await dailyCheck(now));}
      catch(err){logger.error('[Creator videos] daily check failed',err.message);}
      finally{busy=false;}
    }
    const timer=setInterval(()=>void tick(),15000);if(timer.unref)timer.unref();
    void tick();return ()=>clearInterval(timer);
  }
  return {init,submit,listForCreator,listAdmin,latestRun,changeVideo,dailyCheck,startScheduler,parseTikTokUrl};
}
module.exports={createCreatorVideos,parseTikTokUrl,extractApify,parts,localDay};
