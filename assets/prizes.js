'use strict';
(function(){
  const labels=['15%','10%','20%','25%','צמיד טניס','שרשרת טניס','2 זוגות משקפי שמש'];
  const wheel=document.getElementById('wheel'),spin=document.getElementById('spinButton'),form=document.getElementById('verifyForm'),vmsg=document.getElementById('accessMessage'),wmsg=document.getElementById('wheelMessage');
  let verified=false,played=false,rotation=0;
  function setMessage(el,message,error){el.textContent=message;el.className=error?'error':'';}
  for(let i=0;i<labels.length;i++){
    // The wheel segments are visual only. Actual odds are clearly disclosed below.
    const el=document.createElement('div');el.className='segment'+([0,2,4,6].includes(i)?' light':'');el.textContent=labels[i];
    const angle=(i+.5)*360/labels.length,rad=(angle-90)*Math.PI/180;
    const radius=112;
    el.style.left=`calc(50% + ${Math.cos(rad)*radius}px)`;
    el.style.top=`calc(50% + ${Math.sin(rad)*radius}px)`;
    el.style.transform=`translate(-50%, -50%) rotate(${angle>90&&angle<270?angle-180:angle}deg)`;
    wheel.appendChild(el);
  }
  async function post(url,payload){
    const r=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.error||'request_failed');return data;
  }
  function payload(){return {orderRef:document.getElementById('orderRef').value.trim(),phone4:document.getElementById('phone4').value.trim()};}
  const errors={order_not_verified:'לא הצלחנו לאמת את הפרטים. ודאו שהמספר הוא מספר ההזמנה הראשי ושהטלפון תואם.',invalid_phone_verification:'יש להזין ארבע ספרות אחרונות של הטלפון.',invalid_order_number:'בדקו שמספר ההזמנה תקין.',rate_limited:'בוצעו יותר מדי ניסיונות. נסו שוב מאוחר יותר.',service_unavailable:'השירות אינו זמין כרגע. נסו שוב מאוחר יותר.'};
  form.addEventListener('submit',async e=>{
    e.preventDefault();verified=false;spin.disabled=true;const button=document.getElementById('verifyButton');button.disabled=true;setMessage(vmsg,'בודקים את ההזמנה...',false);
    try{const data=await post('/api/prizes/check',payload());verified=true;spin.disabled=false;spin.textContent=data.alreadyPlayed?'הצגת הזכייה הקיימת':'סובבו את גלגל המזל';setMessage(vmsg,data.alreadyPlayed?'כבר סובבתם בעבר — נציג את הפרס שכבר הוקצה להזמנה.':'ההזמנה אומתה! אפשר לסובב את הגלגל.',false);}
    catch(err){setMessage(vmsg,errors[err.message]||'הבדיקה נכשלה. נסו שוב.',true);}
    finally{button.disabled=false;}
  });
  spin.addEventListener('click',async()=>{
    if(!verified||played)return;spin.disabled=true;setMessage(wmsg,'מגלים את הפרס שלך...',false);
    try{
      const data=await post('/api/prizes/spin',payload());played=true;
      const index=data.prize.winIndex;
      const onCurrentWheel=Number.isInteger(index)&&index>=0&&index<labels.length;
      if(onCurrentWheel){
        const sector=360/labels.length;
        const target=(360-(index+.5)*sector)%360;
        const previous=((rotation%360)+360)%360;
        rotation+=360*6+((target-previous+360)%360);
        wheel.style.transform=`rotate(${rotation}deg)`;
      }
      window.setTimeout(()=>{
        wmsg.className='result';wmsg.textContent='';
        const headline=document.createElement('strong');headline.textContent='מזל טוב! '+data.prize.label;wmsg.appendChild(headline);
        if(data.prize.couponCode){wmsg.appendChild(document.createElement('br'));const code=document.createElement('span');code.className='code';code.textContent=data.prize.couponCode;wmsg.appendChild(code);}
        const note=document.createElement('p');note.textContent=data.emailSent?'שלחנו גם את פרטי הזכייה למייל ההזמנה.':'הפרס נשמר. אם המייל עדיין לא נשלח, תוכלו לנסות שוב עם אותם פרטים.';wmsg.appendChild(note);
      },onCurrentWheel?5100:0);
      spin.textContent='הזכייה נשמרה — סיבוב אחד להזמנה';
    }catch(err){played=false;spin.disabled=false;setMessage(wmsg,errors[err.message]||'הפעולה נכשלה. אפשר לנסות שוב.',true);}
  });
})();
