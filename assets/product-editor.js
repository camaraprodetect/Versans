/* VerSans in-place product editor. Only becomes active for ?edit=1 and a
   logged-in admin; the backend remains the authority for permissions and data. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  if (params.get('edit') !== '1') return;
  var slug = params.get('id') || document.body.dataset.productSlug || decodeURIComponent(location.pathname.slice(1));
  if (!/^product-[a-z0-9-]+$/i.test(slug)) return;
  var root, draft, original;
  function el(tag, cls, text) { var n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; }
  function copy(obj) {return JSON.parse(JSON.stringify(obj));}
  function localized(v) {return (v && typeof v==='object')?(v.he||v.en||''):String(v||'');}
  function picture(value) {var p=String(value||'');return /^https:\/\//.test(p)?p:'/'+p.replace(/^\/+/, '');}
  function put(parent) {for(var i=1;i<arguments.length;i++)parent.appendChild(arguments[i]);return parent;}
  function note(text, kind) {var s=root.querySelector('[data-edit-status]');s.textContent=text;s.className='versans-editor__status '+(kind||'');}
  function btn(label,onClick,klass){var b=el('button','versans-editor__btn '+(klass||''),label);b.type='button';b.addEventListener('click',onClick);return b;}
  function entry(parent,label,value,onChange,kind) {
    var wrap=el('label','versans-editor__field');var caption=el('span','',label);
    var input=el(kind==='textarea'?'textarea':kind==='select'?'select':'input');
    if(kind!=='textarea'&&kind!=='select')input.type=kind||'text';
    if(kind==='textarea')input.rows=3;
    input.value=value==null?'':String(value);
    input.addEventListener('input',function(){onChange(input.value);preview();});
    put(wrap,caption,input);parent.appendChild(wrap);return input;
  }
  function check(parent,label,value,onChange) {
    var l=el('label','versans-editor__toggle');var c=el('input');c.type='checkbox';c.checked=Boolean(value);
    c.addEventListener('change',function(){onChange(c.checked);preview();});put(l,c,el('span','',label));parent.appendChild(l);return c;
  }
  function localizedField(parent,label,key) {
    var current=draft[key];
    entry(parent,label,localized(current),function(value){
      if(current && typeof current==='object') draft[key]={...current,he:value};
      else draft[key]={he:value,en:value};
    },'textarea');
  }
  function block(label,description) {
    var section=el('section','versans-editor__section');section.appendChild(el('h3','',label));
    if(description)section.appendChild(el('p','versans-editor__hint',description));
    root.querySelector('[data-edit-sections]').appendChild(section);return section;
  }
  function textSection(){
    var sec=block('טקסטים, מחיר וזמינות','השינוי נשמר בדאטהבייס ומתעדכן גם בחישוב התשלום בשרת.');
    entry(sec,'שם מוצר בעברית',localized(draft.title),function(v){draft.title={...(draft.title||{}),he:v};});
    entry(sec,'שם מוצר באנגלית',(draft.title&&draft.title.en)||'',function(v){draft.title={...(draft.title||{}),en:v};});
    localizedField(sec,'תיאור קצר','subtitle');localizedField(sec,'תיאור מלא','description');
    entry(sec,'מחיר בסיס (₪)',draft.price,function(v){draft.price=Number(v);},'number');
    entry(sec,'מחיר לפני הנחה (₪)',draft.compareAt||'',function(v){draft.compareAt=v===''?null:Number(v);},'number');
    check(sec,'המוצר זמין לרכישה',draft.inStock!==false,function(v){draft.inStock=v;});
    entry(sec,'מק״ט',draft.sku||'',function(v){draft.sku=v;});
    entry(sec,'תגית מוצר',localized(draft.badge),function(v){draft.badge={...(draft.badge&&typeof draft.badge==='object'?draft.badge:{}),he:v,en:v};});
    entry(sec,'קטגוריה ראשית',draft.category||(draft.categories&&draft.categories[0])||'',function(v){draft.category=v;});
    entry(sec,'קטגוריות נוספות (מופרדות בפסיק)',(draft.categories||[]).join(', '),function(v){draft.categories=Array.from(new Set([draft.category].concat(v.split(',').map(x=>x.trim()).filter(Boolean))));});
  }
  function photoSection(){
    var sec=block('תמונות המוצר','אפשר להעלות, למחוק ולשנות סדר. התמונה הראשונה היא התמונה הראשית.');
    var grid=el('div','versans-editor__images');sec.appendChild(grid);
    function redraw(){grid.replaceChildren();(draft.images||[]).forEach(function(src,index){
      var card=el('div','versans-editor__image');var image=el('img');image.src=picture(src);image.alt='תמונה '+(index+1);image.loading='lazy';
      var controls=el('div','versans-editor__inline');
      controls.appendChild(btn('↑',function(){if(index<1)return;var a=draft.images;[a[index-1],a[index]]=[a[index],a[index-1]];redraw();preview();}));
      controls.appendChild(btn('↓',function(){var a=draft.images;if(index>=a.length-1)return;[a[index+1],a[index]]=[a[index],a[index+1]];redraw();preview();}));
      controls.appendChild(btn('מחק',function(){if(draft.images.length===1){note('חייבת להישאר לפחות תמונה אחת למוצר','is-error');return;}draft.images.splice(index,1);redraw();preview();},'is-danger'));
      put(card,image,controls);grid.appendChild(card);
    });}
    redraw();
    var upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.multiple=true;
    var uploadField=el('label','versans-editor__upload');put(uploadField,el('span','','העלאת תמונות (PNG / JPG / WebP, עד 2MB לתמונה)'),upload);
    sec.appendChild(uploadField);
    upload.addEventListener('change',async function(){
      upload.disabled=true;
      try{
        for (var file of upload.files){
          if(file.size>2*1024*1024)throw Error('תמונה גדולה מ־2MB: '+file.name);
          if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('פורמט לא נתמך: '+file.name);
          note('מעלה '+file.name+'…');
          var encoded=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result)};reader.onerror=function(){reject(Error('קריאת הקובץ נכשלה'))};reader.readAsDataURL(file);});
          var result=await api('/api/admin/catalog/images','POST',{image:encoded});draft.images.push(result.url);
        }
        redraw();preview();note('התמונות עלו. לחץ על שמירת שינויים כדי לעדכן את המוצר.','is-success');
      }catch(e){note(e.message,'is-error');}finally{upload.value='';upload.disabled=false;}
    });
    entry(sec,'תמונת Hover (כתובת)',draft.hoverImage||'',function(v){draft.hoverImage=v;});
  }
  function optionSection(key,title,list){
    if(!Array.isArray(list))return;
    var sec=block(title,'הסתרה משאירה את האפשרות באדמין אך מסירה אותה מהחנות. ״לא במלאי״ מציג את האפשרות כחסומה לקנייה.');
    var grid=el('div','versans-editor__options');sec.appendChild(grid);
    function render(){
      grid.replaceChildren();list.forEach(function(option,index){
        var card=el('div','versans-editor__option');card.appendChild(el('strong','',title+' '+(index+1)));
        var idField=entry(card,'מזהה אפשרות קבוע (ID)',option.id||'',function(){});idField.readOnly=true;idField.title='מזהה האפשרות קבוע כדי לשמור על הזמנות ועל קישורים בין וריאציות';
        entry(card,'שם האפשרות בעברית',localized(option.label),function(v){
          var old=option.label;
          option.label=(old&&typeof old==='object')?{...old,he:v}:{he:v,en:v};
        });
        entry(card,'תוספת למחיר בסיס (₪)',Number(option.addPrice||0),function(v){option.addPrice=Number(v);if(option.priceLabel)delete option.priceLabel;},'number');
        if('image' in option||key==='colors'||key==='necklaces'||key==='boxes')entry(card,'כתובת תמונת אפשרות',option.image||'',function(v){option.image=v;});
        if(key==='colors'||'swatch' in option)entry(card,'צבע תצוגה (hex)',option.swatch||'',function(v){option.swatch=v;});
        check(card,'גלוי בחנות',option.hidden!==true,function(v){option.hidden=!v;});
        check(card,'במלאי',option.inStock!==false,function(v){option.inStock=v;});
        var actions=el('div','versans-editor__inline');
        actions.appendChild(btn('למעלה',function(){if(index<1)return;[list[index-1],list[index]]=[list[index],list[index-1]];render();}));
        actions.appendChild(btn('למטה',function(){if(index>=list.length-1)return;[list[index+1],list[index]]=[list[index],list[index+1]];render();}));
        actions.appendChild(btn('מחק אפשרות',function(){list.splice(index,1);render();note('האפשרות הוסרה מהטיוטה. לחץ על שמירת כל השינויים כדי לעדכן את האתר.');},'is-danger'));
        card.appendChild(actions);grid.appendChild(card);
      });
    }
    render();sec.appendChild(btn('+ הוסף אפשרות',function(){
      var id='new-'+Date.now().toString(36);
      list.push({id:id,label:{he:'אפשרות חדשה',en:'New option'},addPrice:0,inStock:true});render();
    },'is-primary'));
  }
  function detailsSection(){
    var sec=block('פרטי מוצר','פרטים קצרים שמופיעים מתחת למוצר.');
    var he=(draft.details&&Array.isArray(draft.details.he))?draft.details.he.slice():[];
    var en=(draft.details&&Array.isArray(draft.details.en))?draft.details.en.slice():[];
    var list=el('div','versans-editor__details');sec.appendChild(list);
    function update(){draft.details={...(draft.details||{}),he:he,en:en};}
    function render(){list.replaceChildren();he.forEach(function(t,index){
      var row=el('div','versans-editor__detail');var input=el('input');input.type='text';input.value=t;
      input.addEventListener('input',function(){he[index]=input.value;if(!en[index])en[index]=input.value;update();});
      var del=btn('×',function(){he.splice(index,1);en.splice(index,1);update();render();},'is-danger');put(row,input,del);list.appendChild(row);
    });}
    render();sec.appendChild(btn('+ הוסף פרט',function(){if(he.length>=40)return;he.push('פרט חדש');en.push('New detail');update();render();}));
  }
  function advancedSection(){
    var sec=block('הגדרות מיוחדות לפי סוג מוצר','למוצרים מורכבים בלבד: תכונות, תמונות וריאציות, פרטים נוספים ועוד. לא משנים מזהה מוצר.');
    var keys=['sizeHeading','colorHeading','necklaceHeading','boxHeading','sizeDisplay','colorDisplay','hideSizePrice','variantImages','unavailableCombinations','giftPackaging','customName','customPhoto','requiresCompanion','collectionMedia','cardImage','cardTitle','materials','features'];
    var data={};keys.forEach(function(k){if(draft[k]!==undefined)data[k]=draft[k];});
    var input=entry(sec,'הגדרות JSON מתקדמות',JSON.stringify(data,null,2),function(v){input.dataset.modified='1';},'textarea');
    input.rows=5;
    var details=el('details');var summary=el('summary','','הצג/הסתר אפשרויות מתקדמות');
    input.parentElement.remove();put(details,summary,input);sec.appendChild(details);
    sec._getAdvanced=function(){if(input.dataset.modified!=='1')return;var obj=JSON.parse(input.value);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('JSON חייב להיות אובייקט');keys.forEach(function(k){if(Object.prototype.hasOwnProperty.call(obj,k))draft[k]=obj[k];});};
    return sec;
  }
  function preview(){
    if(!root)return;
    var title=document.getElementById('productTitle');if(title)title.textContent=localized(draft.title);
    var subtitle=document.getElementById('productSubtitle');if(subtitle)subtitle.textContent=localized(draft.subtitle);
    var price=document.getElementById('productPrice');if(price&&Number.isFinite(Number(draft.price)))price.textContent=Number(draft.price).toFixed(2)+' ₪';
    var image=document.getElementById('productMainImage');if(image&&draft.images&&draft.images[0])image.src=picture(draft.images[0]);
  }
  async function api(url,method,body){
    var res=await fetch(url,{method:method||'GET',credentials:'same-origin',headers:{'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    var data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok!==true)throw Error(data.error||'שגיאת תקשורת '+res.status);
    return data;
  }
  async function start(){
    try {var response=await api('/api/admin/catalog/'+encodeURIComponent(slug));draft=copy(response.product);original=copy(response.product);}
    catch(e){return;}// No visible editor and no product mutation for a non-admin.
    root=el('aside','versans-editor');root.dir='rtl';root.setAttribute('aria-label','עריכת מוצר VerSans');
    var head=el('div','versans-editor__head');var title=el('div');put(title,el('span','versans-editor__eyebrow','VERSANS ADMIN'),el('h2','','עריכת עמוד מוצר'));
    var back=el('a','versans-editor__close','חזרה לאדמין');back.href='/admin/products';put(head,title,back);root.appendChild(head);
    var main=el('div','versans-editor__scroll');main.setAttribute('data-edit-sections','');root.appendChild(main);
    var controls=el('div','versans-editor__footer');var status=el('div','versans-editor__status');status.dataset.editStatus='';
    var save=btn('שמירת כל השינויים',async function(){
      save.disabled=true;note('שומר שינויים בדאטהבייס…');
      try{
        advanced._getAdvanced();
        if(!localized(draft.title).trim())throw Error('חסר שם מוצר');
        if(!draft.images||!draft.images.length)throw Error('נדרשת לפחות תמונה אחת');
        if(!Number.isFinite(Number(draft.price))||Number(draft.price)<0)throw Error('מחיר לא תקין');
        if (!draft.category && draft.categories && draft.categories.length) draft.category=draft.categories[0];
        draft.categories=Array.from(new Set([draft.category].concat(draft.categories||[]).filter(Boolean)));
        var response=await api('/api/admin/catalog/'+encodeURIComponent(slug),'PUT',{product:draft});
        note(response.sheetSync&&response.sheetSync.ok===false?'נשמר באתר. הסנכרון לגיליון ממתין.':'המוצר נשמר! טוען את העמוד המעודכן…','is-success');
        var url=new URL(location.href);url.searchParams.set('edit','1');url.searchParams.set('id',slug);url.searchParams.set('admin_preview','1');
        setTimeout(function(){location.href='/product.html?'+url.searchParams.toString();},750);
      }catch(err){note('השמירה נכשלה: '+err.message,'is-error');save.disabled=false;}
    },'is-primary');
    put(controls,status,save);root.appendChild(controls);
    document.body.appendChild(root);document.body.classList.add('versans-editor-open');
    textSection();photoSection();
    optionSection('sizes','מידות / אורכים',draft.sizes||(draft.sizes=[]));
    optionSection('colors','צבעים',draft.colors||(draft.colors=[]));
    optionSection('necklaces','בחירות שרשרת',draft.necklaces||(draft.necklaces=[]));
    optionSection('boxes','בחירות קופסה',draft.boxes||(draft.boxes=[]));
    if(draft.giftPackaging&&Array.isArray(draft.giftPackaging.options))optionSection('giftPackaging','אפשרויות אריזה',draft.giftPackaging.options);
    detailsSection();var advanced=advancedSection();
  }
  start();
})();
