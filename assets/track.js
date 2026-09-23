(function(){
  'use strict';
  var form=document.getElementById('trackingForm');
  var orderInput=document.getElementById('orderRef');
  var contactInput=document.getElementById('contact');
  var submit=document.getElementById('trackSubmit');
  var errorBox=document.getElementById('trackError');
  var result=document.getElementById('trackingResult');
  var supportLink=document.getElementById('trackSupportLink');

  function supportConfig(){
    var contact=(window.STORE_CONFIG&&window.STORE_CONFIG.contact)||{};
    var whatsapp=String(contact.whatsapp||'').replace(/\D/g,'');
    if(whatsapp&&whatsapp.indexOf('972')!==0&&whatsapp.charAt(0)==='0')whatsapp='972'+whatsapp.slice(1);
    if(whatsapp){supportLink.href='https://wa.me/'+whatsapp;supportLink.target='_blank';supportLink.rel='noopener';supportLink.textContent='שירות לקוחות ב-WhatsApp';return}
    var email=String(contact.email||'versanssupport@gmail.com').trim();
    supportLink.href='mailto:'+email;supportLink.removeAttribute('target');supportLink.textContent='שירות לקוחות באימייל';
  }
  if(supportLink)supportConfig();

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

    var orderCard=el('article','track-order');
    var orderHead=el('div','track-order__head');
    var title=el('div');title.appendChild(el('span','track-package__number','הזמנה אחת'));title.appendChild(el('h3','',data.overallStatusLabel));
    orderHead.appendChild(title);orderHead.appendChild(el('span','track-badge'+((data.overallStatus==='attention')?' is-attention':''),data.overallStatusLabel));orderCard.appendChild(orderHead);

    var items=el('div','track-items track-order__items');items.appendChild(el('span','','המוצרים בהזמנה'));var ul=el('ul');(data.items||[]).forEach(function(item){ul.appendChild(el('li','',item.productName+' ×'+item.qty))});items.appendChild(ul);orderCard.appendChild(items);

    var timeline=el('div','track-order__timeline');
    shipments.forEach(function(shipment,index){
      var row=el('section','track-shipment-row');
      var rowHead=el('div','track-shipment-row__head');
      var rowTitle=el('div');rowTitle.appendChild(el('span','track-package__number','מספר מעקב '+(index+1)));rowTitle.appendChild(el('strong','track-shipment-row__number',shipment.trackingNumber));
      rowHead.appendChild(rowTitle);rowHead.appendChild(el('span','track-badge'+((shipment.status==='exception'||shipment.status==='delivery_failed')?' is-attention':''),shipment.statusLabel));row.appendChild(rowHead);

      var current=el('div','track-shipment-current');
      current.appendChild(detail('מיקום אחרון',shipment.latestLocation||'המיקום האחרון טרם התקבל'));
      current.appendChild(detail('אירוע אחרון',shipment.latestEvent||'ממתינים לעדכון מפורט מחברת השילוח'));
      row.appendChild(current);

      var grid=el('div','track-package__grid');grid.appendChild(detail('חברת שילוח',shipment.localProvider||shipment.carrierName||'זיהוי אוטומטי'));grid.appendChild(detail('עדכון אחרון',fmtDate(shipment.latestEventAt||shipment.deliveredAt)));grid.appendChild(detail('הערכת מסירה',etaText(shipment.estimatedDeliveryFrom,shipment.estimatedDeliveryTo)));row.appendChild(grid);
      if(shipment.localTrackingNumber&&shipment.localTrackingNumber!==shipment.trackingNumber){var local=el('p','track-local-number','מספר מעקב מקומי: '+shipment.localTrackingNumber);row.appendChild(local)}
      timeline.appendChild(row);
    });
    orderCard.appendChild(timeline);result.appendChild(orderCard);
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
