/* VerSans in-place product editor. Only becomes active for ?edit=1 and a
   logged-in admin; the backend remains the authority for permissions and data. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  if (params.get('edit') !== '1') return;
  var slug = params.get('id') || document.body.dataset.productSlug || decodeURIComponent(location.pathname.slice(1));
  if (!/^product-[a-z0-9-]+$/i.test(slug)) return;
  var root, draft, original, saving=false, saved=false, advanced, activeTab='general';
  var tabs={general:'כללי',images:'תמונות',options:'אפשרויות',details:'פרטים נוספים'};
  function isDirty(){return !!draft && !!original && JSON.stringify(draft)!==JSON.stringify(original) || !!(advanced && advanced._isModified && advanced._isModified());}
  function touch(){
    if(!root)return;
    root.classList.toggle('has-changes',isDirty());
    var flag=root.querySelector('[data-edit-dirty]');
    if(flag)flag.textContent=isDirty()?'● שינויים שלא נשמרו':'✓ הכול שמור';
    var discard=root.querySelector('[data-edit-discard]');if(discard)discard.disabled=!isDirty()||saving;
  }
  function tab(name){
    activeTab=name;
    Object.keys(tabs).forEach(function(key){
      var pane=root.querySelector('[data-edit-pane="'+key+'"]');if(pane)pane.hidden=key!==name;
      var button=root.querySelector('[data-edit-nav="'+key+'"]');if(button){button.classList.toggle('is-current',key===name);button.setAttribute('aria-selected',String(key===name));button.tabIndex=key===name?0:-1;}
    });
    var scroll=root.querySelector('[data-edit-sections]');if(scroll)scroll.scrollTop=0;
  }
  function confirmLeave(onYes){
    if(!isDirty()){onYes();return;}
    var mask=el('div','versans-editor__modal-cover');
    var dialog=el('div','versans-editor__modal');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    put(dialog,el('h3','','לצאת בלי לשמור?'),el('p','','יש שינויים במוצר שעדיין לא נשמרו. ביציאה הם יאבדו.'));
    var buttons=el('div','versans-editor__modal-actions');
    var cancel=btn('המשך עריכה',function(){mask.remove();});
    var leave=btn('צא ללא שמירה',function(){mask.remove();onYes();},'is-danger');
    put(buttons,cancel,leave);dialog.appendChild(buttons);mask.appendChild(dialog);root.appendChild(mask);cancel.focus();
    mask.addEventListener('click',function(e){if(e.target===mask)mask.remove();});
    mask.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();mask.remove();}});
  }
  window.addEventListener('beforeunload',function(event){if(root && !saved && !saving && isDirty()){event.preventDefault();event.returnValue='';}});
  function el(tag, cls, text) { var n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; }
  function copy(obj) {return JSON.parse(JSON.stringify(obj));}
  function localized(v) {return (v && typeof v==='object')?(v.he||v.en||''):String(v||'');}
  function picture(value) {var p=String(value||'');return /^https:\/\//.test(p)?p:'/'+p.replace(/^\/+/, '');}
  function put(parent) {for(var i=1;i<arguments.length;i++)parent.appendChild(arguments[i]);return parent;}
  function note(text, kind) {var s=root.querySelector('[data-edit-status]');if(!s)return;s.textContent=text;s.className='versans-editor__status '+(kind||'');}
  function btn(label,onClick,klass){var b=el('button','versans-editor__btn '+(klass||''),label);b.type='button';b.addEventListener('click',onClick);return b;}
  function entry(parent,label,value,onChange,kind) {
    var wrap=el('label','versans-editor__field');var caption=el('span','',label);
    var input=el(kind==='textarea'?'textarea':kind==='select'?'select':'input');
    if(kind!=='textarea'&&kind!=='select')input.type=kind||'text';
    if(kind==='textarea')input.rows=3;
    input.value=value==null?'':String(value);
    input.addEventListener('input',function(){onChange(input.value);preview();touch();});
    put(wrap,caption,input);parent.appendChild(wrap);return input;
  }
  function check(parent,label,value,onChange) {
    var l=el('label','versans-editor__toggle');var c=el('input');c.type='checkbox';c.checked=Boolean(value);
    c.addEventListener('change',function(){onChange(c.checked);preview();touch();});put(l,c,el('span','',label));parent.appendChild(l);return c;
  }
  function localizedField(parent,label,key) {
    var current=draft[key];
    entry(parent,label,localized(current),function(value){
      if(current && typeof current==='object') draft[key]={...current,he:value};
      else draft[key]={he:value,en:value};
    },'textarea');
  }
  function block(label,description,sectionName){
    var section=el('section','versans-editor__section');section.appendChild(el('h3','',label));
    if(description)section.appendChild(el('p','versans-editor__hint',description));
    root.querySelector('[data-edit-pane="'+(sectionName||activeTab)+'"]').appendChild(section);return section;
  }
  function textSection(){
    var basics=block('פרטי המוצר','השם והתיאור שמוצגים ללקוחות.','general');
    entry(basics,'שם המוצר בעברית',localized(draft.title),function(v){draft.title={...(draft.title||{}),he:v};});
    entry(basics,'שם באנגלית',(draft.title&&draft.title.en)||'',function(v){draft.title={...(draft.title||{}),en:v};});
    localizedField(basics,'תיאור קצר','subtitle');
    localizedField(basics,'תיאור מלא','description');
    var pricing=block('מחיר וזמינות','המחירים מתעדכנים גם בחישוב ההזמנה בשרת.','general');
    var prices=el('div','versans-editor__two-col');pricing.appendChild(prices);
    entry(prices,'מחיר בסיס (₪)',draft.price,function(v){draft.price=v===''?null:Number(v);},'number');
    entry(prices,'מחיר לפני הנחה (₪)',draft.compareAt||'',function(v){draft.compareAt=v===''?null:Number(v);},'number');
    check(pricing,'המוצר זמין לרכישה',draft.inStock!==false,function(v){draft.inStock=v;});
    var more=block('הגדרות נוספות','מק״ט, תגית וסיווג המוצר.','general');
    var fold=el('details','versans-editor__fold');fold.appendChild(el('summary','','פתיחת הגדרות נוספות'));more.appendChild(fold);
    entry(fold,'מק״ט',draft.sku||'',function(v){draft.sku=v;});
    entry(fold,'תגית מוצר',localized(draft.badge),function(v){draft.badge={...(draft.badge&&typeof draft.badge==='object'?draft.badge:{}),he:v,en:v};});
    entry(fold,'קטגוריה ראשית',draft.category||(draft.categories&&draft.categories[0])||'',function(v){draft.category=v;});
    entry(fold,'קטגוריות נוספות (מופרדות בפסיק)',(draft.categories||[]).join(', '),function(v){draft.categories=Array.from(new Set([draft.category].concat(v.split(',').map(x=>x.trim()).filter(Boolean))));});
  }
  function photoSection(){
    var sec=block('גלריית תמונות','התמונה הראשונה היא הראשית. ניתן לשנות סדר, להוסיף או להסיר.','images');
    var grid=el('div','versans-editor__images');sec.appendChild(grid);
    function redraw(){grid.replaceChildren();(draft.images||[]).forEach(function(src,index){
      var card=el('div','versans-editor__image');
      var image=el('img');image.src=picture(src);image.alt='תמונת מוצר '+(index+1);image.loading='lazy';
      if(index===0)card.appendChild(el('span','versans-editor__primary-label','ראשית'));
      put(card,image,el('span','versans-editor__image-index','תמונה '+(index+1)));
      var controls=el('div','versans-editor__image-actions');
      var up=btn('→',function(){if(index<1)return;var a=draft.images;[a[index-1],a[index]]=[a[index],a[index-1]];redraw();preview();touch();});up.title='העבר תמונה אחורה';up.disabled=index===0;
      var down=btn('←',function(){var a=draft.images;if(index>=a.length-1)return;[a[index+1],a[index]]=[a[index],a[index+1]];redraw();preview();touch();});down.title='העבר תמונה קדימה';down.disabled=index===draft.images.length-1;
      var remove=btn('מחק',function(){if(draft.images.length===1){note('חייבת להישאר לפחות תמונה אחת למוצר','is-error');return;}draft.images.splice(index,1);redraw();preview();touch();},'is-danger');
      put(controls,up,down,remove);card.appendChild(controls);grid.appendChild(card);
    });}
    redraw();
    var upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.multiple=true;
    var uploadField=el('label','versans-editor__upload');put(uploadField,el('span','versans-editor__upload-icon','＋'),el('strong','','הוספת תמונות'),el('small','','PNG, JPG, WebP · עד 2MB לכל תמונה'),upload);
    sec.appendChild(uploadField);
    upload.addEventListener('change',async function(){
      upload.disabled=true;
      try{
        for(var file of upload.files){
          if(file.size>2*1024*1024)throw Error('תמונה גדולה מ־2MB: '+file.name);
          if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('פורמט לא נתמך: '+file.name);
          note('מעלה '+file.name+'…');
          var encoded=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(Error('קריאת הקובץ נכשלה'));};reader.readAsDataURL(file);});
          var result=await api('/api/admin/catalog/images','POST',{image:encoded});draft.images.push(result.url);
        }
        redraw();preview();touch();note('התמונות עלו. לחץ על שמירת שינויים כדי לעדכן את המוצר.','is-success');
      }catch(e){note(e.message,'is-error');}finally{upload.value='';upload.disabled=false;}
    });
    var hover=block('תמונת מעבר עכבר','אפשר להזין כתובת של תמונת Hover.','images');
    entry(hover,'כתובת תמונת Hover',draft.hoverImage||'',function(v){draft.hoverImage=v;});
  }
  function optionSection(key,title,list){
    if(!Array.isArray(list))return;
    var host=root.querySelector('[data-edit-pane="options"]');
    var group=el('details','versans-editor__group');
    var summary=el('summary','versans-editor__group-summary');
    var header=el('span','versans-editor__group-title',title);
    var count=el('span','versans-editor__count');
    put(summary,header,count,el('span','versans-editor__chevron','⌄'));
    group.appendChild(summary);
    if(list.length && !host.querySelector('.versans-editor__group[open]'))group.open=true;
    var content=el('div','versans-editor__group-content');group.appendChild(content);host.appendChild(group);
    var hint=el('p','versans-editor__hint','לחץ על אפשרות לעריכה. אפשר להסתיר אפשרות או לסמן אותה כלא במלאי.');content.appendChild(hint);
    var grid=el('div','versans-editor__options');content.appendChild(grid);
    function labelFor(option,index){return localized(option.label)||option.name||'אפשרות '+(index+1);}
    function decorate(item,option,index){
      var title=item.querySelector('[data-option-title]');if(title)title.textContent=labelFor(option,index);
      var price=item.querySelector('[data-option-price]');if(price)price.textContent=(Number(option.addPrice)||0)?'+'+Number(option.addPrice).toFixed(2)+' ₪':'ללא תוספת';
      var indicators=item.querySelector('[data-option-flags]');if(indicators){indicators.replaceChildren();if(option.hidden)indicators.appendChild(el('span','versans-editor__flag is-hidden','מוסתר'));if(option.inStock===false)indicators.appendChild(el('span','versans-editor__flag is-out','אזל מהמלאי'));}
    }
    function render(openIndex){
      grid.replaceChildren();count.textContent=list.length+' אפשרויות';
      list.forEach(function(option,index){
        if(!option || typeof option!=='object')return;
        var card=el('details','versans-editor__option');
        if(openIndex===index)card.open=true;
        var row=el('summary','versans-editor__option-summary');
        var data=el('span','versans-editor__option-info');
        var name=el('strong','');name.dataset.optionTitle='';
        var extra=el('span','versans-editor__option-sub');extra.dataset.optionPrice='';
        var flags=el('span','versans-editor__flags');flags.dataset.optionFlags='';
        put(data,name,extra,flags);put(row,el('span','versans-editor__option-number',String(index+1)),data,el('span','versans-editor__chevron','⌄'));card.appendChild(row);
        var controls=el('div','versans-editor__option-controls');
        var idField=entry(controls,'מזהה אפשרות קבוע (ID)',option.id||'',function(){});idField.readOnly=true;idField.title='מזהה קבוע לשמירה על הזמנות וקישורים';
        entry(controls,'שם האפשרות',localized(option.label),function(v){
          var old=option.label;option.label=(old&&typeof old==='object')?{...old,he:v}:{he:v,en:v};decorate(card,option,index);
        });
        entry(controls,'תוספת למחיר (₪)',Number(option.addPrice||0),function(v){option.addPrice=Number(v);if(option.priceLabel)delete option.priceLabel;decorate(card,option,index);},'number');
        if('image' in option || key==='colors'||key==='necklaces'||key==='boxes')entry(controls,'כתובת תמונת אפשרות',option.image||'',function(v){option.image=v;});
        if(key==='colors'||'swatch' in option)entry(controls,'צבע תצוגה (hex)',option.swatch||'',function(v){option.swatch=v;});
        check(controls,'גלוי בחנות',option.hidden!==true,function(v){option.hidden=!v;decorate(card,option,index);});
        check(controls,'במלאי',option.inStock!==false,function(v){option.inStock=v;decorate(card,option,index);});
        var actions=el('div','versans-editor__inline');
        var up=btn('העבר למעלה ↑',function(){if(index<1)return;[list[index-1],list[index]]=[list[index],list[index-1]];render(index-1);touch();});up.disabled=index===0;
        var down=btn('העבר למטה ↓',function(){if(index>=list.length-1)return;[list[index+1],list[index]]=[list[index],list[index+1]];render(index+1);touch();});down.disabled=index===list.length-1;
        var remove=btn('מחק אפשרות',function(){list.splice(index,1);render();touch();note('האפשרות הוסרה מהטיוטה. יש לשמור כדי לעדכן את החנות.');},'is-danger');
        put(actions,up,down,remove);controls.appendChild(actions);card.appendChild(controls);
        decorate(card,option,index);grid.appendChild(card);
      });
    }
    render();
    content.appendChild(btn('＋ הוסף אפשרות',function(){
      var id='new-'+Date.now().toString(36);
      if(draft[key]!==list)draft[key]=list;
      list.push({id:id,label:{he:'אפשרות חדשה',en:'New option'},addPrice:0,inStock:true});render(list.length-1);group.open=true;touch();
      var first=grid.lastElementChild;if(first)first.scrollIntoView({block:'nearest',behavior:'smooth'});
    },'is-add'));
  }
  function detailsSection(){
    var sec=block('פרטי מוצר','פרטים קצרים שמופיעים מתחת למוצר.','details');
    var he=(draft.details&&Array.isArray(draft.details.he))?draft.details.he.slice():[];
    var en=(draft.details&&Array.isArray(draft.details.en))?draft.details.en.slice():[];
    var list=el('div','versans-editor__details');sec.appendChild(list);
    function update(){draft.details={...(draft.details||{}),he:he,en:en};}
    function render(){list.replaceChildren();he.forEach(function(t,index){
      var row=el('div','versans-editor__detail');var input=el('input');input.type='text';input.value=t;
      input.addEventListener('input',function(){he[index]=input.value;if(!en[index])en[index]=input.value;update();touch();});
      var del=btn('×',function(){he.splice(index,1);en.splice(index,1);update();render();touch();},'is-danger');put(row,input,del);list.appendChild(row);
    });}
    render();sec.appendChild(btn('+ הוסף פרט',function(){if(he.length>=40)return;he.push('פרט חדש');en.push('New detail');update();render();touch();}));
  }
  function advancedSection(){
    var sec=block('הגדרות מתקדמות','למוצרים מורכבים בלבד. אין לשנות מזהה מוצר.','details');
    var keys=['sizeHeading','colorHeading','necklaceHeading','boxHeading','sizeDisplay','colorDisplay','hideSizePrice','variantImages','unavailableCombinations','giftPackaging','customName','customPhoto','requiresCompanion','collectionMedia','cardImage','cardTitle','materials','features'];
    var data={};keys.forEach(function(k){if(draft[k]!==undefined)data[k]=draft[k];});
    var input=entry(sec,'הגדרות JSON מתקדמות',JSON.stringify(data,null,2),function(v){input.dataset.modified='1';touch();},'textarea');
    input.rows=5;
    var details=el('details');var summary=el('summary','','הצג/הסתר אפשרויות מתקדמות');
    input.parentElement.remove();put(details,summary,input);sec.appendChild(details);
    sec._isModified=function(){return input.dataset.modified==='1';};sec._getAdvanced=function(){if(input.dataset.modified!=='1')return;var obj=JSON.parse(input.value);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('JSON חייב להיות אובייקט');keys.forEach(function(k){if(Object.prototype.hasOwnProperty.call(obj,k))draft[k]=obj[k];});};
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
    catch(e){return;} // Hide editor if the visitor is not an admin.
    root=el('aside','versans-editor');root.dir='rtl';root.setAttribute('aria-label','עריכת מוצר VerSans');
    var head=el('div','versans-editor__head');
    var headcopy=el('div','versans-editor__heading');put(headcopy,el('span','versans-editor__eyebrow','VERSANS ADMIN'),el('h2','','עריכת מוצר'),el('span','versans-editor__ref',slug));
    var exit=btn('יציאה ✕',function(){confirmLeave(function(){saved=true;location.href='/admin/products';});},'versans-editor__close');
    put(head,headcopy,exit);root.appendChild(head);
    var navigation=el('div','versans-editor__nav');navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','אזורים לעריכת מוצר');
    Object.keys(tabs).forEach(function(k){
      var b=btn(tabs[k],function(){tab(k);},'versans-editor__nav-item');b.dataset.editNav=k;b.setAttribute('role','tab');b.setAttribute('aria-controls','edit-'+k);navigation.appendChild(b);
    });
    root.appendChild(navigation);
    var main=el('div','versans-editor__scroll');main.dataset.editSections='';
    Object.keys(tabs).forEach(function(k){var pane=el('div','versans-editor__pane');pane.dataset.editPane=k;pane.id='edit-'+k;pane.setAttribute('role','tabpanel');main.appendChild(pane);});
    root.appendChild(main);
    var foot=el('div','versans-editor__footer');
    var meta=el('div','versans-editor__footer-meta');var flag=el('span','versans-editor__dirty','✓ הכול שמור');flag.dataset.editDirty='';var status=el('span','versans-editor__status','השינויים יתעדכנו באתר לאחר שמירה');status.dataset.editStatus='';put(meta,flag,status);
    var actionbar=el('div','versans-editor__footer-actions');
    var discard=btn('בטל שינויים',function(){confirmLeave(function(){saved=true;location.reload();});},'is-secondary');discard.dataset.editDiscard='';discard.disabled=true;
    var save=btn('שמור שינויים',async function(){
      if(saving)return;
      saving=true;save.disabled=true;discard.disabled=true;note('שומר שינויים בדאטהבייס…');
      try{
        advanced._getAdvanced();
        if(!localized(draft.title).trim())throw Error('חסר שם מוצר');
        if(!draft.images||!draft.images.length)throw Error('נדרשת לפחות תמונה אחת');
        if(!Number.isFinite(Number(draft.price))||draft.price==null||Number(draft.price)<0)throw Error('מחיר לא תקין');
        if(!draft.category && draft.categories && draft.categories.length)draft.category=draft.categories[0];
        draft.categories=Array.from(new Set([draft.category].concat(draft.categories||[]).filter(Boolean)));
        var response=await api('/api/admin/catalog/'+encodeURIComponent(slug),'PUT',{product:draft});
        note(response.sheetSync&&response.sheetSync.ok===false?'נשמר באתר. הסנכרון לגיליון ממתין.':'נשמר בהצלחה! טוען את המוצר המעודכן…','is-success');
        saved=true;
        var url=new URL(location.href);url.searchParams.set('edit','1');url.searchParams.set('id',slug);url.searchParams.set('admin_preview','1');
        setTimeout(function(){location.href='/product.html?'+url.searchParams.toString();},650);
      }catch(err){note('השמירה נכשלה: '+err.message,'is-error');saving=false;save.disabled=false;touch();}
    },'is-primary');
    put(actionbar,discard,save);put(foot,meta,actionbar);root.appendChild(foot);
    document.body.appendChild(root);document.body.classList.add('versans-editor-open');
    textSection();photoSection();
    optionSection('sizes','מידות ואורכים',draft.sizes||[]);
    optionSection('colors','צבעים',draft.colors||[]);
    optionSection('necklaces','בחירות שרשרת',draft.necklaces||[]);
    optionSection('boxes','בחירות קופסה',draft.boxes||[]);
    if(draft.giftPackaging&&Array.isArray(draft.giftPackaging.options))optionSection('giftPackaging','אפשרויות אריזה',draft.giftPackaging.options);
    detailsSection();advanced=advancedSection();tab('general');touch();
  }
  
  start();
})();
