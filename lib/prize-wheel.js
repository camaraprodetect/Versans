'use strict';
// One draw per paid order; weights are disclosed to participants on /prizes.
const crypto = require('node:crypto');
const DAY = 86400000;
const PRIZES = Object.freeze([
  {key:'OFF15',label:'15% הנחה בקנייה הבאה',percent:15,weight:7000},
  {key:'OFF10',label:'10% הנחה בקנייה הבאה',percent:10,weight:2500},
  {key:'OFF20',label:'20% הנחה בקנייה הבאה',percent:20,weight:300},
  {key:'OFF25',label:'25% הנחה בקנייה הבאה',percent:25,weight:100},
  {key:'TENNIS',label:'צמיד טניס במתנה',weight:60},
  {key:'NECKLACE',label:'שרשרת טניס במתנה',weight:30},
  {key:'SUNGLASSES_2',label:'2 זוגות משקפי שמש במתנה',weight:10}
]);
if(PRIZES.reduce((n,p)=>n+p.weight,0)!==10000)throw new Error('invalid_prize_weights');
// Honor any prize that was already drawn before this prize-list update.
// Legacy awards are never part of a new draw or the publicly advertised wheel.
const LEGACY_PRIZES = Object.freeze({ RING:{key:'RING',label:'טבעת במתנה'} });
function recordedPrize(key){return PRIZES.find(p=>p.key===key)||LEGACY_PRIZES[key]||null;}
const ERROR=(message,status=400)=>Object.assign(new Error(message),{status});
function orderRef(raw){const ref=String(raw||'').trim().toUpperCase().replace(/\s+/g,'');if(!/^[A-Z0-9-]{4,90}$/.test(ref))throw ERROR('invalid_order_number');return ref.replace(/-P\d{2,3}$/,'');}
function phoneDigits(value){let p=String(value||'').replace(/\D/g,'');if(p.startsWith('972'))p='0'+p.slice(3);return p;}
function tail4(value){const p=String(value||'').trim();if(!/^\d{4}$/.test(p))throw ERROR('invalid_phone_verification');return p;}
function safeEqual4(a,b){if(!/^\d{4}$/.test(a)||!/^\d{4}$/.test(b))return false;return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function choosePrize(){const roll=crypto.randomInt(10000);let offset=0;for(const prize of PRIZES){offset+=prize.weight;if(roll<offset)return prize;}throw new Error('invalid_prize_roll');}
function makeCode(){return 'VSW-'+crypto.randomBytes(9).toString('hex').toUpperCase();}
function createPrizeWheel(db,{sendEmail,isEmailConfigured,ownerEmail}={}){
  const pg=db.backend==='postgres';
  // Convert parameters only in internally-authored constant queries, not arbitrary customer text.
  async function query(conn,sql,params=[]){
    if(pg){let i=0;return (await conn._query(sql.replace(/\?/g,()=>'$'+(++i)),params)).rows;}
    return conn.db.prepare(sql).all(...params);
  }
  async function execute(conn,sql,params=[]){
    if(pg){let i=0;return conn._query(sql.replace(/\?/g,()=>'$'+(++i)),params);}
    return conn.db.prepare(sql).run(...params);
  }
  let ready;
  function init(){if(!ready)ready=(async()=>{
    const ddl=`CREATE TABLE IF NOT EXISTS prize_wheel_claims (
      order_ref TEXT PRIMARY KEY,prize_key TEXT NOT NULL,coupon_code TEXT UNIQUE,
      email TEXT NOT NULL,created_at BIGINT NOT NULL,expires_at BIGINT,
      reserved_order_ref TEXT,reserved_at BIGINT,used_order_ref TEXT,used_at BIGINT,
      email_sent_at BIGINT,email_error TEXT)`;
    if(pg)await db._query(ddl);else db.db.exec(ddl);
    if(pg)await db._query('CREATE INDEX IF NOT EXISTS idx_prize_wheel_coupon ON prize_wheel_claims(coupon_code)');
  })().catch(e=>{ready=null;throw e;});return ready;}
  // Older paid orders may have their phone only in the original checkout JSON.
  // Still require the user to know the final four digits; never expose the phone.
  function savedOrderPhone(order){
    if(order && order.customer_phone)return phoneDigits(order.customer_phone);
    if(!order || !order.customer_json)return '';
    try {
      const customer=typeof order.customer_json==='string'?JSON.parse(order.customer_json):order.customer_json;
      return phoneDigits(customer && (customer.phone || customer.customerPhone || customer.telephone || (customer.customer && customer.customer.phone)));
    }catch{return '';}
  }
  async function verified(rawRef,last4,{allowDemoPreview=false}={}){
    const ref=orderRef(rawRef),phone=tail4(last4);
    const order=await db.getOrderByRef(ref);
    const savedDigits=savedOrderPhone(order);
    if(!order||order.status!=='paid'||!order.customer_email||!safeEqual4(savedDigits.slice(-4),phone))throw ERROR('order_not_verified',404);
    const demo=/^VS-DEMO-/i.test(String(order.order_ref));
    // VS-DEMO orders are simulated 'paid' purchases and must NEVER grant real prizes.
    // Only an authenticated store owner may exercise a non-persistent preview.
    if(demo&&!allowDemoPreview)throw ERROR('demo_order_test_only',403);
    return {order,preview:demo};
  }
  async function status(ref,phone,options={}){
    await init();const {order,preview}=await verified(ref,phone,options);
    if(preview)return {eligible:true,alreadyPlayed:false,preview:true};
    const result=(await query(db,'SELECT prize_key,coupon_code,expires_at FROM prize_wheel_claims WHERE order_ref=?',[order.order_ref]))[0];
    return {eligible:true,alreadyPlayed:!!result,preview:false};
  }
  function publicResult(row){
    const p=recordedPrize(row.prize_key);
    if(!p)throw new Error('unknown_recorded_prize');
    const winIndex=PRIZES.findIndex(v=>v.key===p.key);
    return {key:p.key,label:p.label,percent:p.percent||null,couponCode:row.coupon_code||null,expiresAt:row.expires_at?Number(row.expires_at):null,winIndex:winIndex>=0?winIndex:null};
  }
  async function draw(ref,phone,options={}){
    await init();const {order,preview}=await verified(ref,phone,options),now=Date.now();
    if(preview){
      const prize=choosePrize();
      // Demo previews never save claims, issue coupons or trigger email deliveries.
      return {key:prize.key,label:prize.label,percent:prize.percent||null,couponCode:null,
        expiresAt:null,winIndex:PRIZES.findIndex(p=>p.key===prize.key),
        emailSent:false,emailConfigured:false,preview:true};
    }
    const row=await db.transaction(async tx=>{
      const existing=(await query(tx,'SELECT * FROM prize_wheel_claims WHERE order_ref=?',[order.order_ref]))[0];
      if(existing)return existing;
      const prize=choosePrize();const coupon=prize.percent?makeCode():null;
      await execute(tx,pg
        ?'INSERT INTO prize_wheel_claims(order_ref,prize_key,coupon_code,email,created_at,expires_at) VALUES(?,?,?,?,?,?) ON CONFLICT(order_ref) DO NOTHING'
        :'INSERT OR IGNORE INTO prize_wheel_claims(order_ref,prize_key,coupon_code,email,created_at,expires_at) VALUES(?,?,?,?,?,?)',[
          order.order_ref,prize.key,coupon,String(order.customer_email).trim().toLowerCase(),now,prize.percent?now+30*DAY:null
      ]);
      return (await query(tx,'SELECT * FROM prize_wheel_claims WHERE order_ref=?',[order.order_ref]))[0];
    });
    // Delivery is best-effort; failure never redraws a prize. An eligible caller can retry.
    let emailSent=!!row.email_sent_at;
    if(!emailSent&&isEmailConfigured&&isEmailConfigured()&&typeof sendEmail==='function'){
      const prize=recordedPrize(row.prize_key);
      if(!prize)throw new Error('unknown_recorded_prize');
      try{
        const message=prize.percent
          ?`זכית ב-${prize.percent}% הנחה! הקוד האישי שלך: ${row.coupon_code}\nהקוד לשימוש חד-פעמי, תקף ל-30 יום וניתן למימוש עם כתובת המייל של ההזמנה המקורית. לא ניתן לשלב עם קופון נוסף.`
          :`זכית ב${prize.label}! צוות VerSans יתאם איתך את קבלת המתנה לפי פרטי ההזמנה המקורית. אין צורך בקנייה נוספת.`;
        await sendEmail({to:row.email,subject:'VerSans | הפרס שלך מגלגל המזל',text:`שלום!\n\n${message}\n\nVerSans`,idempotencyKey:'prizes-customer-'+crypto.createHash('sha256').update(row.order_ref).digest('hex')});
        await execute(db,'UPDATE prize_wheel_claims SET email_sent_at=?,email_error=NULL WHERE order_ref=? AND email_sent_at IS NULL',[Date.now(),row.order_ref]);
        emailSent=true;
        if(!prize.percent&&ownerEmail){
          try{await sendEmail({to:ownerEmail,subject:'VerSans | פרס פיזי למימוש',text:`יש לתאם מסירת ${prize.label} עבור ההזמנה ${row.order_ref}. כתובת הלקוח נמצאת במערכת ההזמנות.`,idempotencyKey:'prizes-owner-'+crypto.createHash('sha256').update(row.order_ref).digest('hex')});}
          catch(err){console.error('Prize owner email failed:',err.message);}
        }
      }catch(err){
        console.error('Prize customer email failed:',err.message);
        await execute(db,'UPDATE prize_wheel_claims SET email_error=? WHERE order_ref=?',[String(err.message).slice(0,180),row.order_ref]);
      }
    }
    return {...publicResult(row),emailSent,emailConfigured:!!(isEmailConfigured&&isEmailConfigured()),preview:false};
  }
  async function coupon(code,email,now=Date.now(),allowUnboundEmail=false){
    if(!/^VSW-[A-F0-9]{18}$/.test(String(code||'')))return null;
    await init();const r=(await query(db,'SELECT * FROM prize_wheel_claims WHERE coupon_code=?',[code]))[0];
    const p=r&&PRIZES.find(x=>x.key===r.prize_key);
    if(!r||!p||!p.percent||Number(r.expires_at)<=now||r.used_order_ref||(!allowUnboundEmail||String(email||'').trim())&&String(email||'').trim().toLowerCase()!==r.email)return null;
    if(r.reserved_order_ref&&Number(r.reserved_at)>now-60*60*1000)return null;
    return {code:r.coupon_code,percent:p.percent,expiresAt:Number(r.expires_at)};
  }
  async function reserve(tx,code,email,newRef,now=Date.now()){
    const norm=String(email||'').trim().toLowerCase();
    const out=await execute(tx,`UPDATE prize_wheel_claims SET reserved_order_ref=?,reserved_at=? WHERE coupon_code=? AND email=? AND used_order_ref IS NULL AND expires_at>? AND (reserved_order_ref IS NULL OR reserved_order_ref=? OR reserved_at<?)`,[newRef,now,code,norm,now,newRef,now-60*60*1000]);
    if(Number(pg?out.rowCount:out.changes)!==1)throw ERROR('prize_coupon_unavailable',409);
  }
  async function redeem(tx,code,orderRef,now=Date.now()){
    await execute(tx,'UPDATE prize_wheel_claims SET used_order_ref=?,used_at=? WHERE coupon_code=? AND reserved_order_ref=? AND (used_order_ref IS NULL OR used_order_ref=?)',[orderRef,now,code,orderRef,orderRef]);
  }
  return {init,status,draw,coupon,reserve,redeem,PRIZES};
}
module.exports={createPrizeWheel,PRIZES,orderRef,phoneDigits,choosePrize};
