(function(){
  'use strict';
  var form=document.getElementById('trackingForm');
  var orderInput=document.getElementById('orderRef');
  var contactInput=document.getElementById('contact');
  var submit=document.getElementById('trackSubmit');
  var errorBox=document.getElementById('trackError');
  var result=document.getElementById('trackingResult');

  var query=new URLSearchParams(window.location.search);
  if(query.get('order')) orderInput.value=query.get('order');

  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function fmtDate(value){if(!value)return '—';try{return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'medium',timeStyle:'short'}).format(new Date(Number(value)))}catch(_){return '—'}}
  function etaText(from,to){if(!from&&!to)return 'עדיין אין הערכת מסירה';if(from&&to){try{var f=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit'}).format(new Date(Number(from)));var t=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit'}).format(new Date(Number(to)));return f===t?f:f+' - '+t}catch(_){}}return fmtDate(from||to)}
  function detail(label,value){var box=el('div','track-detail');box.appendChild(el('span','',label));box.appendChild(el('strong','',value||'—'));return box}

  function render(data){
    result.replaceChildren(); result.hidden=false;
    var summary=el('section','track-summary');
    var left=el('div');left.appendChild(el('span','track-summary__label','סטטוס ההזמנה'));left.appendChild(el('h2','',data.overallStatusLabel));
    summary.appendChild(left);summary.appendChild(el('span','track-summary__order',data.orderRef));result.appendChild(summary);
    var shipments=Array.isArray(data.shipments)?data.shipments:[];
    if(!shipments.length){var empty=el('section','track-empty');empty.appendChild(el('h3','','אנחנו מכינים את ההזמנה שלכם'));empty.appendChild(el('p','','ברגע שמספר המעקב ייקלט במערכת VerSans הוא יופיע כאן אוטומטית.'));result.appendChild(empty);return}
    shipments.forEach(function(shipment){
      var card=el('article','track-package');var head=el('div','track-package__head');var title=el('div');title.appendChild(el('span','track-package__number','חבילה '+shipment.packageNumber));title.appendChild(el('h3','',shipment.statusLabel));head.appendChild(title);
      var badge=el('span','track-badge'+((shipment.status==='exception'||shipment.status==='delivery_failed')?' is-attention':''),shipment.statusLabel);head.appendChild(badge);card.appendChild(head);
      var grid=el('div','track-package__grid');grid.appendChild(detail('מספר מעקב',shipment.trackingNumber));grid.appendChild(detail('עדכון אחרון',fmtDate(shipment.latestEventAt||shipment.deliveredAt)));grid.appendChild(detail('הערכת מסירה',etaText(shipment.estimatedDeliveryFrom,shipment.estimatedDeliveryTo)));card.appendChild(grid);
      var items=el('div','track-items');items.appendChild(el('span','','מה נמצא בחבילה'));var ul=el('ul');(shipment.items||[]).forEach(function(item){ul.appendChild(el('li','',item.productName+' ×'+item.qty))});items.appendChild(ul);card.appendChild(items);result.appendChild(card);
    });
  }

  form.addEventListener('submit',async function(event){
    event.preventDefault();errorBox.hidden=true;result.hidden=true;submit.disabled=true;submit.textContent='בודק…';
    var order=orderInput.value.trim(),contact=contactInput.value.trim();
    try{
      var response=await fetch('/api/tracking?order='+encodeURIComponent(order)+'&contact='+encodeURIComponent(contact),{headers:{Accept:'application/json'},credentials:'same-origin'});
      var body=null;try{body=await response.json()}catch(_){}
      if(!response.ok)throw new Error(response.status===404?'לא מצאנו הזמנה עם הפרטים האלה. בדקו את מספר ההזמנה והאימייל/טלפון.':'לא ניתן לבדוק את המשלוח כרגע. נסו שוב בעוד רגע.');
      render(body);history.replaceState(null,'','/track?order='+encodeURIComponent(order));
    }catch(err){errorBox.textContent=err.message||'אירעה שגיאה';errorBox.hidden=false}
    finally{submit.disabled=false;submit.textContent='בדיקת סטטוס'}
  });
})();
