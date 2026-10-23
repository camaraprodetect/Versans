'use strict';
const crypto=require('node:crypto');
const TYPES={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','video/mp4':'.mp4','video/webm':'.webm'};
const MAX_BYTES=20*1024*1024;
function mediaError(code){const e=new Error(code);e.status=400;return e;}
function sniff(buffer,mime){
  if(mime==='image/png')return buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  if(mime==='image/jpeg')return buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
  if(mime==='image/gif')return ['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString());
  if(mime==='image/webp')return buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
  if(mime==='video/mp4')return buffer.toString('ascii',4,8)==='ftyp';
  if(mime==='video/webm')return buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  return false;
}
function createMarketingMedia(database){
 let initialized=null;
 function init(){if(!initialized)initialized=(async()=>{let sql='CREATE TABLE IF NOT EXISTS admin_marketing_media (id TEXT PRIMARY KEY, mime TEXT NOT NULL, payload '+(database.backend==='postgres'?'BYTEA':'BLOB')+' NOT NULL, created_at BIGINT NOT NULL)';
   if(database.backend==='postgres')await database._query(sql);else database.db.exec(sql);
 })().catch(e=>{initialized=null;throw e;});return initialized;}
 async function upload(mime,input){
   if(!TYPES[mime])throw mediaError('unsupported_media_type');
   if(typeof input!=='string'||input.length>Math.ceil(MAX_BYTES*4/3)+50||!/^[A-Za-z0-9+/]+={0,2}$/.test(input))throw mediaError('invalid_media');
   const data=Buffer.from(input,'base64');if(!data.length||data.length>MAX_BYTES||!sniff(data,mime))throw mediaError('invalid_media');
   const id=crypto.randomUUID();await init();
   if(database.backend==='postgres')await database._query('INSERT INTO admin_marketing_media (id,mime,payload,created_at) VALUES ($1,$2,$3,$4)',[id,mime,data,Date.now()]);
   else database.db.prepare('INSERT INTO admin_marketing_media (id,mime,payload,created_at) VALUES (?,?,?,?)').run(id,mime,data,Date.now());
   return {url:'/api/marketing/media/'+id,mime,size:data.length};
 }
 async function get(id){
   if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id))return null;
   await init();const row=database.backend==='postgres'?(await database._query('SELECT mime,payload FROM admin_marketing_media WHERE id=$1',[id])).rows[0]:database.db.prepare('SELECT mime,payload FROM admin_marketing_media WHERE id=?').get(id);
   return row?{mime:row.mime,buffer:Buffer.from(row.payload)}:null;
 }
 return {upload,get};
}
module.exports={createMarketingMedia};
