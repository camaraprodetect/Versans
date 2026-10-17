'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {createCreatorVideos,parseTikTokUrl,extractApify,parts,localDay}=require('../lib/creator-videos');
const {normalizeTikTokHandle}=require('../lib/creator-program');
function mockEnv(){
  const db=new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT,role TEXT DEFAULT 'contentcreator',is_blocked INTEGER DEFAULT 0);
    CREATE TABLE creator_tiktok_settings(user_id INTEGER PRIMARY KEY,tiktok_username TEXT NOT NULL UNIQUE,rate_per_1000_agorot INTEGER NOT NULL);
    INSERT INTO users(id,name,email) VALUES(1,'Creator 1','test@versans.com');
    INSERT INTO users(id,name,email) VALUES(2,'Creator 2','two@versans.com');
    INSERT INTO creator_tiktok_settings(user_id,tiktok_username,rate_per_1000_agorot) VALUES(1,'tester',300);
    INSERT INTO creator_tiktok_settings(user_id,tiktok_username,rate_per_1000_agorot) VALUES(2,'other',300);`);
  return {backend:'sqlite',db,transaction:async fn=>{db.exec('BEGIN');try{const r=await fn({db});db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
const url='https://www.tiktok.com/@tester/video/7200360993149553925';
const id='7200360993149553925';
test('TikTok link cannot forge scraped video ownership',()=>{
 assert.equal(parseTikTokUrl(url)?.id,id);
 assert.equal(parseTikTokUrl('https://tiktok.com.evil.com/@a/video/'+id),null);
 assert.equal(parseTikTokUrl('http://www.tiktok.com/@tester/video/'+id),null);
 assert.equal(normalizeTikTokHandle('@Tester'),'tester');
 const item=extractApify([{webVideoUrl:url,playCount:123456,authorMeta:{name:'tester',nickName:'Display Name'}}],id);
 assert.equal(item.views,123456);
 assert.equal(item.author,'tester');
 assert.throws(()=>extractApify([{webVideoUrl:url,playCount:999}],id),/apify_author_missing/);
 assert.throws(()=>extractApify([{webVideoUrl:url,playCount:999,authorMeta:{name:'tester'}}],'8200360993149553925'));
});
test('submission, approval and daily payouts verify author identity and preserve previous-period earnings',async()=>{
 const db=mockEnv();
 const clock={now:Date.parse('2026-10-14T19:00:00Z')};
 const observations=[1000,34000,74000];
 let author='tester';let curr=0;
 const creatorProgram={getCreatorByUser:async userId=>userId===1?{code:'TEST',tiktok_username:'tester',rate_per_1000_agorot:300}:{code:'OTHER',tiktok_username:'other',rate_per_1000_agorot:300},reportPeriod:(range,now)=>{
  if(range==='all')return{since:null,before:null};
  const boundary=Date.parse('2026-10-14T21:00:00Z');
  return now<boundary?{since:Date.parse('2026-09-28T21:00:00Z'),before:boundary}:{since:boundary,before:Date.parse('2026-10-28T21:00:00Z')};
 }};
 const v=createCreatorVideos(db,creatorProgram,{clock:()=>clock.now,fetchVideos:async rows=>new Map(rows.map(x=>[x.video_id,{views:observations[curr]||0,author,observedAt:clock.now}]))});
 await v.init();
 process.env.APIFY_API_TOKEN='test-token';
 try{
  await assert.rejects(()=>v.submit(2,url),/video_not_owned_by_creator/);
  author='wrong';await assert.rejects(()=>v.submit(1,url),/video_not_owned_by_creator/);
  author='tester';await v.submit(1,url);
  await assert.rejects(()=>v.submit(1,url),/video_already_registered/);
  author='wrong';await assert.rejects(()=>v.changeVideo(1,'approve'),/video_not_owned_by_creator/);
  author='tester';await v.changeVideo(1,'approve');
  curr=1;const before=Date.parse('2026-10-14T20:59:00Z');clock.now=before;
  let result=await v.dailyCheck(before);assert.equal(result.earnedAgorot,10200);assert.equal(result.checked,1);
  result=await v.dailyCheck(before);assert.equal(result.status,'already_started');
  curr=2;clock.now=Date.parse('2026-10-15T20:59:00Z');result=await v.dailyCheck(clock.now);
  assert.equal(result.earnedAgorot,12000);assert.equal(result.checked,1);
  const all=await v.listForCreator(1,'all');assert.equal(all.totalGainedViews,74000);assert.equal(all.totalEarnedAgorot,22200);
  const period=await v.listForCreator(1,'payment');assert.equal(period.totalGainedViews,40000);assert.equal(period.totalEarnedAgorot,12000);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM creator_video_checks').get().n,2);
 }finally{db.db.close();delete process.env.APIFY_API_TOKEN;}
});
test('daily payout does not reward a video after its verified author changes',async()=>{
 const db=mockEnv();let time=Date.parse('2026-10-17T20:59:00Z'),author='tester';
 const program={getCreatorByUser:async()=>({tiktok_username:'tester',rate_per_1000_agorot:300}),reportPeriod:()=>({since:null,before:null})};
 const v=createCreatorVideos(db,program,{clock:()=>time,fetchVideos:async rows=>new Map(rows.map(x=>[x.video_id,{views:55000,author,observedAt:time}]))});
 await v.init();process.env.APIFY_API_TOKEN='test-token';
 try {await v.submit(1,url);await v.changeVideo(1,'approve');author='someoneelse';const result=await v.dailyCheck(time);assert.equal(result.checked,0);assert.equal(result.earnedAgorot,0);assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM creator_video_checks').get().n,0);}
 finally{db.db.close();delete process.env.APIFY_API_TOKEN;}
});
test('29-day and February local dates derive independently of process timezone',()=>{
 assert.equal(localDay(Date.parse('2026-10-17T20:59:59Z')),'2026-10-17');
 assert.deepEqual({h:parts(Date.parse('2026-10-17T20:59:00Z')).hour,m:parts(Date.parse('2026-10-17T20:59:00Z')).minute},{h:23,m:59});
});
