(function(){
  'use strict';
  var form=document.getElementById('trackingForm');
  var orderInput=document.getElementById('orderRef');
  var submit=document.getElementById('trackSubmit');
  var errorBox=document.getElementById('trackError');
  var result=document.getElementById('trackingResult');

  var query=new URLSearchParams(window.location.search);
  if(query.get('order')) orderInput.value=query.get('order');

  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
  function fmtDate(value){if(!value)return '';try{return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'medium',timeStyle:'short'}).format(new Date(Number(value)))}catch(_){return ''}}

  var STEPS=[
    {key:'preparing',label:'ההזמנה בהכנה',short:'בהכנה'},
    {key:'carrier',label:'ההזמנה בחברת השילוח',short:'בחברת השילוח'},
    {key:'delivered',label:'ההזמנה הגיעה',short:'הגיעה'}
  ];

  function stageIndex(key){var idx=STEPS.findIndex(function(step){return step.key===key});return idx<0?0:idx}

  function render(data){
    result.replaceChildren();result.hidden=false;
    var current=stageIndex(data.status);

    var summary=el('article','track-status-card is-'+data.status);
    var top=el('div','track-status-card__top');
    var title=el('div');
    title.appendChild(el('span','track-status-card__eyebrow','סטטוס ההזמנה'));
    title.appendChild(el('h2','',data.statusLabel||'ההזמנה בהכנה'));
    top.appendChild(title);
    top.appendChild(el('span','track-status-card__order',data.orderRef||orderInput.value.trim()));
    summary.appendChild(top);
    summary.appendChild(el('p','track-status-card__description',data.description||''));

    if(data.detail||data.location||data.updatedAt){
      var live=el('div','track-live-update');
      if(data.detail){var a=el('div');a.appendChild(el('span','','עדכון נוכחי'));a.appendChild(el('strong','',data.detail));live.appendChild(a)}
      if(data.location){var b=el('div');b.appendChild(el('span','','מיקום אחרון'));b.appendChild(el('strong','',data.location));live.appendChild(b)}
      if(data.updatedAt){var c=el('div');c.appendChild(el('span','','עודכן'));c.appendChild(el('strong','',fmtDate(data.updatedAt)));live.appendChild(c)}
      summary.appendChild(live);
    }

    var progress=el('div','track-progress');
    STEPS.forEach(function(step,index){
      var item=el('div','track-progress__step'+(index<current?' is-done':'')+(index===current?' is-current':''));
      var dot=el('span','track-progress__dot',index<current?'✓':String(index+1));
      item.appendChild(dot);
      var copy=el('div');copy.appendChild(el('strong','',step.short));copy.appendChild(el('small','',step.label));item.appendChild(copy);
      progress.appendChild(item);
    });
    summary.appendChild(progress);
    result.appendChild(summary);

    var shipments=Array.isArray(data.shipments)?data.shipments:[];
    if(shipments.length){
      var parcels=el('section','track-parcels');
      var parcelsHead=el('div','track-parcels__head');
      var parcelsTitle=el('div');
      parcelsTitle.appendChild(el('span','track-status-card__eyebrow','מעקב לפי מוצר'));
      parcelsTitle.appendChild(el('h3','',shipments.length===1?'מוצר אחד':'סה״כ '+shipments.length+' מוצרים'));
      parcelsHead.appendChild(parcelsTitle);
      parcelsHead.appendChild(el('p','',data.itemSpecific?'זהו המעקב של המוצר שבחרת.':'לכל מוצר יש מספר הזמנה נפרד של VerSans ומעקב נפרד.'));
      parcels.appendChild(parcelsHead);

      var list=el('div','track-parcels__list');
      shipments.forEach(function(shipment,index){
        var card=el('article','track-parcel is-'+(shipment.status||'preparing')+(shipment.pickupReady?' is-pickup':''));
        var topRow=el('div','track-parcel__top');
        var name=el('div');
        name.appendChild(el('span','track-parcel__number','מוצר '+(shipment.packageNumber||index+1)));
        name.appendChild(el('strong','',shipment.productName||'מוצר'));
        if(shipment.qty>1)name.appendChild(el('small','track-parcel__qty','כמות '+shipment.qty));
        topRow.appendChild(name);
        var orderWrap=el('div','track-parcel__tracking');
        orderWrap.appendChild(el('span','','מספר הזמנה VerSans'));
        orderWrap.appendChild(el('strong','',shipment.itemOrderRef||''));
        topRow.appendChild(orderWrap);
        card.appendChild(topRow);
        var statusBox=el('div','track-parcel__status');
        statusBox.appendChild(el('span','','סטטוס'));
        statusBox.appendChild(el('strong','',shipment.statusLabel||'ההזמנה בהכנה'));
        card.appendChild(statusBox);
        if(shipment.description)card.appendChild(el('p','track-parcel__description',shipment.description));
        if(shipment.pickupReady){
          var alert=el('div','track-pickup-alert');
          alert.appendChild(el('strong','','החבילה מחכה לך לאיסוף'));
          alert.appendChild(el('span','','מומלץ לאסוף אותה בהקדם בהתאם להנחיות חברת השילוח, כדי למנוע החזרה לשולח.'));
          card.appendChild(alert);
        }
        if(shipment.location||shipment.updatedAt){
          var meta=el('div','track-parcel__meta');
          if(shipment.location){var loc=el('span','');loc.textContent='מיקום: '+shipment.location;meta.appendChild(loc)}
          if(shipment.updatedAt){var upd=el('span','');upd.textContent='עודכן: '+fmtDate(shipment.updatedAt);meta.appendChild(upd)}
          card.appendChild(meta);
        }
        list.appendChild(card);
      });
      parcels.appendChild(list);
      result.appendChild(parcels);
    }
  }

  function itemRefParts(value){
    var match=/^(.*)-P(\d{2,3})$/i.exec(String(value||'').trim());
    if(!match||!match[1])return null;
    var oneBased=Number(match[2]);
    if(!Number.isInteger(oneBased)||oneBased<1)return null;
    return {parent:match[1],index:oneBased-1};
  }

  async function fetchTracking(order){
    var response=await fetch('/api/tracking?order='+encodeURIComponent(order),{headers:{Accept:'application/json'},credentials:'same-origin'});
    var body=null;try{body=await response.json()}catch(_){}
    return {response:response,body:body};
  }

  // Compatibility fallback: if an older backend deployment does not yet resolve
  // product order numbers (…-P01), retry the parent order and isolate the exact
  // product in the browser. This keeps the number the customer received usable.
  function isolateRequestedProduct(body,requested,parts){
    if(!body||!parts||!Array.isArray(body.shipments))return body;
    var shipment=body.shipments[parts.index];
    if(!shipment)return null;
    return Object.assign({},body,{
      orderRef:requested,
      parentOrderRef:body.parentOrderRef||parts.parent,
      itemSpecific:true,
      status:shipment.status||body.status,
      statusLabel:shipment.statusLabel||body.statusLabel,
      description:shipment.description||body.description,
      detail:null,
      location:shipment.location||null,
      updatedAt:shipment.updatedAt||null,
      shipments:[shipment]
    });
  }

  form.addEventListener('submit',async function(event){
    event.preventDefault();errorBox.hidden=true;result.hidden=true;submit.disabled=true;submit.textContent='בודק…';
    var order=orderInput.value.trim();
    try{
      var attempt=await fetchTracking(order);
      var response=attempt.response,body=attempt.body;
      if(!response.ok&&response.status===404){
        var parts=itemRefParts(order);
        if(parts){
          var parentAttempt=await fetchTracking(parts.parent);
          if(parentAttempt.response.ok){
            var isolated=isolateRequestedProduct(parentAttempt.body,order,parts);
            if(isolated){response=parentAttempt.response;body=isolated}
          }
        }
      }
      if(!response.ok)throw new Error(response.status===404?'לא מצאנו הזמנה עם המספר הזה. בדקו שהמספר הוזן בדיוק כפי שקיבלתם אותו.':'לא ניתן לבדוק את ההזמנה כרגע. נסו שוב בעוד רגע.');
      render(body);history.replaceState(null,'','/track?order='+encodeURIComponent(order));
    }catch(err){errorBox.textContent=err.message||'אירעה שגיאה';errorBox.hidden=false}
    finally{submit.disabled=false;submit.textContent='בדיקת סטטוס'}
  });
})();
