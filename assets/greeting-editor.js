(function(){
  'use strict';
  var CFG=window.STORE_CONFIG||{};
  var params=new URLSearchParams(window.location.search);
  var id=params.get('id');
  var product=(window.PRODUCTS||[]).find(function(p){return p.id===id||p.slug===id;});
  if(!product||!/^product-[1-9]$/.test(String(product.slug||''))){window.location.href='index.html#shop';return;}

  var lang='he';
  function L(v){return v?(v.he||''):'';}
  var UI={
    he:{
      back:'‹ חזרה למוצר',topnote:'עיצוב ברכה אישית',langBtn:'English',introEyebrow:'ברכה אישית',introTitle:'הטקסט שלכם. העיצוב נשאר מדויק.',introText:'אפשר לערוך את הטקסט בכל תבנית. ב־Default אפשר גם לבחור צבע רקע, להעלות תמונת רקע לתוך המסגרת הפנימית עם חיתוך מותאם, לבחור גופן, צבע טקסט ואפקטים כמו Bold, צל וקונטור; בשאר התבניות העיצוב נשאר נעול כדי לשמור על תוצאה נקייה להדפסה.',preview:'תצוגה מקדימה',pngReady:'בשמירה נוצר קובץ PNG מוכן לייצור ונשמר אצלנו.',pngExists:'קיים PNG שמור עבור הברכה הזאת.',templateTitle:'תבנית',templateDesc:'בחרו את סגנון הכרטיס. בכל תבנית נפתחים רק השדות שבאמת קיימים בה.',more:'עוד תבניות',less:'הצג פחות תבניות',bgTitle:'צבע רקע',bgDesc:'זמין בתבנית Default בלבד.',chooseBg:'בחרו צבע רקע',reset:'איפוס',styleTitle:'סגנון טקסט',styleDesc:'זמין ב־Default בלבד. בחרו גופן, צבע ואפקטים שיעזרו לטקסט לבלוט.',font:'גופן',textColor:'צבע הטקסט',chooseTextColor:'בחרו צבע טקסט',eyebrowTitle:'שורה עליונה',eyebrowDesc:'מופיעה רק בתבניות שיש בהן אזור כזה.',eyebrowLabel:'לדוגמה: באהבה גדולה',titleTitle:'כותרת',titleDesc:'האזור העליון קבוע.',titleLabel:'מה יהיה רשום בכותרת?',subtitleTitle:'שורת משנה',subtitleDesc:'מופיעה רק בתבניות שיש בהן אזור נוסף מתחת לכותרת.',subtitleLabel:'לדוגמה: שלי',messageTitle:'הברכה',messageDesc:'אזור הברכה והמיקום שלו קבועים.',messageLabel:'הברכה שלכם',signatureTitle:'ממי הברכה',signatureDesc:'השורה התחתונה קבועה, ואפשר לכתוב רווחים כרגיל.',signatureLabel:'לדוגמה: אוהבת אחותך',save:'שמור ברכה וחזור למוצר',resetGreeting:'איפוס לברכה המקורית',required:'יש למלא כותרת, ברכה וממי הברכה לפני השמירה.',requiredEyebrow:'יש למלא גם את השורה העליונה בתבנית שבחרתם.',requiredSubtitle:'יש למלא גם את שורת המשנה בתבנית שבחרתם.',saving:'שומר ברכה ויוצר PNG…',creating:'יוצר קובץ PNG…',uploadOk:'הברכה נשמרה ונשלחה לייצור ✓',uploadFail:'לא הצלחנו לשמור את קובץ ה־PNG אצלנו. נסו שוב.',pngFail:'יצירת ה־PNG נכשלה',pngCreateError:'לא הצלחנו ליצור את קובץ ה־PNG. נסו שוב.',max:function(n){return 'מקסימום '+n+' תווים';},titlePlaceholder:'כותרת הברכה',messagePlaceholder:'כאן תופיע הברכה האישית שלכם.',signaturePlaceholder:'ממי הברכה',lockDefault:'ב־Default אפשר לבחור צבע או תמונת רקע, גופן, צבע ואפקטים לטקסט · המיקום והגדלים נשארים נעולים',lockOther:'המיקומים, הגופן והצבע קבועים בתבנית הזאת כדי לשמור על העיצוב',fontSample:'לאמא באהבה',bgImageLabel:'או העלו תמונה לרקע',bgImageChoose:'בחרו תמונה',bgImageRemove:'הסר תמונה',bgImageNote:'התמונה תופיע רק בתוך המסגרת הפנימית. אחרי בחירת הקובץ תוכלו להזיז ולקרב אותה לפני האישור.',bgImageReady:'תמונת הרקע מוכנה ✓',bgImageError:'לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.',effects:'הבלטת טקסט',presetNone:'ללא',presetSoft:'צל עדין',presetStrong:'צל חזק',presetOutline:'קונטור',presetSticker:'בולט מאוד',boldLabel:'טקסט מודגש (Bold)',shadowStrength:'עוצמת צל',shadowColor:'צבע הצל',outlineWidth:'עובי קונטור',outlineColor:'צבע הקונטור',cropTitle:'התאמת תמונת רקע',cropDesc:'גררו את התמונה ובחרו את החיתוך שמתאים לכם. הריבוע הזה הוא האזור שיופיע בתוך המסגרת הפנימית.',cropZoom:'זום',cropCancel:'ביטול',cropApply:'אישור ושימוש בתמונה',cropTip:'טיפ: גררו את התמונה בתוך הריבוע עד שהיא נראית בדיוק כמו שאתם רוצים.'
    },
    en:{
      back:'‹ Back to product',topnote:'Personal greeting design',langBtn:'עברית',introEyebrow:'Personal greeting',introTitle:'Your words. A polished design.',introText:'Edit the wording on any template. In Default you can also choose a background colour, upload a background image inside the inner frame with a custom crop, and control the font, text colour and emphasis effects like bold, shadow and outline; the other templates keep their design locked for a clean print-ready result.',preview:'Preview',pngReady:'When you save, a production-ready PNG is created and stored with us.',pngExists:'A PNG is already saved for this greeting.',templateTitle:'Template',templateDesc:'Choose a card style. Each template only shows the fields that belong to that design.',more:'More templates',less:'Show fewer templates',bgTitle:'Background colour',bgDesc:'Available in Default only.',chooseBg:'Choose background colour',reset:'Reset',styleTitle:'Text style',styleDesc:'Available in Default only. Choose a font, colour and emphasis effects that help the text stand out.',font:'Font',textColor:'Text colour',chooseTextColor:'Choose text colour',eyebrowTitle:'Top line',eyebrowDesc:'Shown only on templates that include this area.',eyebrowLabel:'Example: With lots of love',titleTitle:'Title',titleDesc:'The top area stays fixed.',titleLabel:'What should the title say?',subtitleTitle:'Subtitle',subtitleDesc:'Shown only on templates with an extra line under the title.',subtitleLabel:'Example: My',messageTitle:'Message',messageDesc:'The message area and its position are fixed.',messageLabel:'Your message',signatureTitle:'From',signatureDesc:'The bottom line stays fixed; spaces are allowed.',signatureLabel:'Example: With love, your son',save:'Save greeting and return to product',resetGreeting:'Reset to original greeting',required:'Please fill in the title, message and signature before saving.',requiredEyebrow:'Please fill in the top line for this template.',requiredSubtitle:'Please fill in the subtitle for this template.',saving:'Saving greeting and creating PNG…',creating:'Creating PNG…',uploadOk:'Your greeting was saved for production ✓',uploadFail:'We could not store the PNG. Please try again.',pngFail:'PNG creation failed',pngCreateError:'We could not create the PNG. Please try again.',max:function(n){return 'Maximum '+n+' characters';},titlePlaceholder:'Greeting title',messagePlaceholder:'Your personal message will appear here.',signaturePlaceholder:'From',lockDefault:'In Default you can choose a background colour or image, font, text colour and emphasis effects · positions and sizes stay locked',lockOther:'Positions, font and colour are locked in this template to preserve the design',fontSample:'For Mom with love',bgImageLabel:'Or upload a background image',bgImageChoose:'Choose image',bgImageRemove:'Remove image',bgImageNote:'The image appears only inside the inner frame. After choosing a file you can move and zoom it before applying.',bgImageReady:'Background image ready ✓',bgImageError:'We could not read that image. Please try another file.',effects:'Text emphasis',presetNone:'None',presetSoft:'Soft shadow',presetStrong:'Strong shadow',presetOutline:'Outline',presetSticker:'High contrast',boldLabel:'Bold text',shadowStrength:'Shadow strength',shadowColor:'Shadow colour',outlineWidth:'Outline width',outlineColor:'Outline colour',cropTitle:'Adjust background image',cropDesc:'Drag the image and choose the crop you want. This square is the area that will appear inside the inner frame.',cropZoom:'Zoom',cropCancel:'Cancel',cropApply:'Use this image',cropTip:'Tip: drag the image inside the square until it looks exactly the way you want.'
    }
  };
  function tr(key){var d=UI[lang]||UI.he;var v=d[key];return typeof v==='function'?v.apply(null,Array.prototype.slice.call(arguments,1)):v;}
  function $(s){return document.querySelector(s);}
  function $$(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
  function storageKey(){return 'kw_greeting_'+product.id;}
  function greetingOptInKey(){return 'kw_greeting_optin_'+product.id;}
  function hasGreetingOptIn(){try{return localStorage.getItem(greetingOptInKey())==='1';}catch(e){return false;}}
  function saveGreetingOptIn(){try{localStorage.setItem(greetingOptInKey(),'1');}catch(e){}}

  var TEMPLATES={
    'template-1':{title:'Template 1',titleMax:15,messageMax:170,messageCharsPerLine:34,signatureMax:30,eyebrow:false,subtitle:false,featured:true},
    'template-2':{title:'Template 2',titleMax:15,messageMax:170,messageCharsPerLine:31,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-4':{title:'Template 4',titleMax:15,messageMax:170,messageCharsPerLine:34,signatureMax:28,eyebrow:false,subtitle:false,featured:false},
    'template-5':{title:'Template 5',titleMax:15,messageMax:170,messageCharsPerLine:34,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-6':{title:'Template 6',titleMax:15,messageMax:170,messageCharsPerLine:33,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-7':{title:'Template 7',titleMax:15,messageMax:170,messageCharsPerLine:34,signatureMax:28,eyebrow:false,subtitle:false,featured:false},
    'template-8':{title:'Template 8',titleMax:15,messageMax:170,messageCharsPerLine:35,signatureMax:28,eyebrow:false,subtitle:false,featured:false},
    'template-9':{title:'Template 9',titleMax:15,messageMax:170,messageCharsPerLine:35,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-10':{title:'Template 10',titleMax:15,messageMax:170,messageCharsPerLine:35,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-11':{title:'Template 11',titleMax:15,messageMax:170,messageCharsPerLine:35,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-12':{title:'Template 12',titleMax:15,messageMax:170,messageCharsPerLine:35,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-13':{title:'Template 13',titleMax:15,messageMax:170,messageCharsPerLine:35,signatureMax:28,eyebrow:false,subtitle:false,featured:false},
    'template-15':{title:'Template 15',titleMax:15,messageMax:170,messageCharsPerLine:35,signatureMax:28,eyebrow:false,subtitle:false,featured:true},
    'template-17':{title:'Template 17',titleMax:15,messageMax:170,messageCharsPerLine:34,signatureMax:28,eyebrow:false,subtitle:false,featured:true}
  };

  function liveText(value,max){
    var s=String(value==null?'':value);
    s=s.replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ');
    return s.slice(0,max);
  }
  function finalText(value,max){return liveText(value,max).trim();}
  function wrapTextByRowLimit(value,maxCharsPerLine){
    var text=String(value==null?'':value).replace(/\r\n?/g,'\n').replace(/\t+/g,' ').replace(/ {2,}/g,' ').trim();
    if(!text||!maxCharsPerLine)return text;
    var paragraphs=text.split(/\n+/);
    var lines=[];
    paragraphs.forEach(function(paragraph){
      var words=paragraph.split(/\s+/).filter(Boolean);
      if(!words.length){return;}
      var line='';
      words.forEach(function(word){
        while(word.length>maxCharsPerLine){
          if(line){lines.push(line);line='';}
          lines.push(word.slice(0,maxCharsPerLine));
          word=word.slice(maxCharsPerLine);
        }
        var candidate=line?line+' '+word:word;
        if(candidate.length>maxCharsPerLine){
          if(line)lines.push(line);
          line=word;
        }else{
          line=candidate;
        }
      });
      if(line)lines.push(line);
    });
    return lines.join('\n');
  }
  function templateDef(id){return TEMPLATES[id]||TEMPLATES['template-1'];}
  var DEFAULT_BACKGROUND_COLOR='#f7f4ed';
  function normalizeColor(value){var c=String(value||'').trim();return /^#[0-9a-fA-F]{6}$/.test(c)?c.toLowerCase():DEFAULT_BACKGROUND_COLOR;}
  var DEFAULT_TEXT_COLOR='#111111';
  var DEFAULT_FONT_KEY='noto-serif';
  var FONT_MAP={
    'noto-serif':'\"Noto Serif Hebrew\", Georgia, serif',
    'frank-ruhl':'\"Frank Ruhl Libre\", Georgia, serif',
    'david':'\"David Libre\", Georgia, serif',
    'heebo':'\"Heebo\", Arial, sans-serif',
    'assistant':'\"Assistant\", Arial, sans-serif',
    'rubik':'\"Rubik\", Arial, sans-serif',
    'alef':'\"Alef\", Arial, sans-serif',
    'varela':'\"Varela Round\", Arial, sans-serif',
    'miriam':'\"Miriam Libre\", Arial, sans-serif',
    'secular':'\"Secular One\", Arial, sans-serif'
  };
  function normalizeTextColor(value){var c=String(value||'').trim();return /^#[0-9a-fA-F]{6}$/.test(c)?c.toLowerCase():DEFAULT_TEXT_COLOR;}
  function normalizeFontKey(value){var key=String(value||'');return FONT_MAP[key]?key:DEFAULT_FONT_KEY;}
  var DEFAULT_SHADOW_COLOR='#000000';
  var DEFAULT_OUTLINE_COLOR='#000000';
  function normalizeInt(value,min,max,fallback){var n=parseInt(value,10);if(!Number.isFinite(n))n=fallback;return Math.max(min,Math.min(max,n));}
  function normalizeBool(value){return value===true||value==='true'||value===1||value==='1';}
  function normalizeEffectState(v){return {isBold:normalizeBool(v&&v.isBold),shadowStrength:normalizeInt(v&&v.shadowStrength,0,24,0),shadowColor:normalizeTextColor(v&&v.shadowColor||DEFAULT_SHADOW_COLOR),outlineWidth:normalizeInt(v&&v.outlineWidth,0,6,0),outlineColor:normalizeTextColor(v&&v.outlineColor||DEFAULT_OUTLINE_COLOR)};}
  function effectPresetFromState(v){var fx=normalizeEffectState(v);if(!fx.isBold&&fx.shadowStrength===0&&fx.outlineWidth===0)return 'none';if(fx.isBold&&fx.shadowStrength===6&&fx.outlineWidth===0&&fx.shadowColor===DEFAULT_SHADOW_COLOR)return 'soft';if(fx.isBold&&fx.shadowStrength===12&&fx.outlineWidth===0&&fx.shadowColor===DEFAULT_SHADOW_COLOR)return 'strong';if(fx.isBold&&fx.shadowStrength===4&&fx.outlineWidth===2&&fx.outlineColor===DEFAULT_OUTLINE_COLOR)return 'outline';if(fx.isBold&&fx.shadowStrength===10&&fx.outlineWidth===3&&fx.outlineColor===DEFAULT_OUTLINE_COLOR)return 'sticker';return ''; }
  function applyEffectPreset(name){
    switch(String(name||'')){
      case 'soft':return {isBold:true,shadowStrength:6,shadowColor:DEFAULT_SHADOW_COLOR,outlineWidth:0,outlineColor:DEFAULT_OUTLINE_COLOR};
      case 'strong':return {isBold:true,shadowStrength:12,shadowColor:DEFAULT_SHADOW_COLOR,outlineWidth:0,outlineColor:DEFAULT_OUTLINE_COLOR};
      case 'outline':return {isBold:true,shadowStrength:4,shadowColor:DEFAULT_SHADOW_COLOR,outlineWidth:2,outlineColor:DEFAULT_OUTLINE_COLOR};
      case 'sticker':return {isBold:true,shadowStrength:10,shadowColor:DEFAULT_SHADOW_COLOR,outlineWidth:3,outlineColor:DEFAULT_OUTLINE_COLOR};
      default:return {isBold:false,shadowStrength:0,shadowColor:DEFAULT_SHADOW_COLOR,outlineWidth:0,outlineColor:DEFAULT_OUTLINE_COLOR};
    }
  }
  function buildTextShadow(effect){
    var parts=[];var fx=normalizeEffectState(effect);
    if(fx.outlineWidth>0){var w=fx.outlineWidth,c=fx.outlineColor;[-w,0,w].forEach(function(x){[-w,0,w].forEach(function(y){if(x===0&&y===0)return;parts.push(x+'px '+y+'px 0 '+c);});});}
    if(fx.shadowStrength>0){var blur=Math.max(1,Math.round(fx.shadowStrength*1.2));var y=Math.max(1,Math.round(fx.shadowStrength*0.6));parts.push('0 '+y+'px '+blur+'px '+fx.shadowColor);} 
    return parts.join(', ');
  }
  function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
  function hexToRgb(hex){var c=String(hex||'').replace('#','');if(c.length!==6)return null;return {r:parseInt(c.slice(0,2),16),g:parseInt(c.slice(2,4),16),b:parseInt(c.slice(4,6),16)};}
  function toHex(v){var s=clamp(Math.round(v),0,255).toString(16);return s.length===1?'0'+s:s;}
  function rgbToHex(r,g,b){return '#'+toHex(r)+toHex(g)+toHex(b);}
  function rgbaFromHex(hex,alpha){var rgb=hexToRgb(hex);return rgb?'rgba('+rgb.r+','+rgb.g+','+rgb.b+','+alpha+')':'rgba(170,145,105,'+alpha+')';}
  function deriveDefaultFrameColor(hex){
    var rgb=hexToRgb(hex);if(!rgb)return '#aa9169';
    var lightness=(rgb.r*0.299+rgb.g*0.587+rgb.b*0.114)/255;
    if(lightness>0.72)return rgbToHex(rgb.r*0.72,rgb.g*0.72,rgb.b*0.72);
    return rgbToHex(rgb.r*1.18+18,rgb.g*1.18+18,rgb.b*1.18+18);
  }

  function defaults(templateId){
    var t=templateDef(templateId||'template-1');
    return {
      template:templateId||'template-1',
      title:finalText(L(product.cardTitle),t.titleMax),
      message:finalText(L(product.cardMessage),t.messageMax),
      signature:finalText(L(product.signature),t.signatureMax),
      eyebrow:t.eyebrow?finalText(t.eyebrowDefault||'',t.eyebrowMax||18):'',
      subtitle:t.subtitle?finalText(t.subtitleDefault||'',t.subtitleMax||8):'',
      backgroundColor:DEFAULT_BACKGROUND_COLOR,
      textColor:DEFAULT_TEXT_COLOR,
      fontKey:DEFAULT_FONT_KEY,
      isBold:false,
      shadowStrength:0,
      shadowColor:DEFAULT_SHADOW_COLOR,
      outlineWidth:0,
      outlineColor:DEFAULT_OUTLINE_COLOR,
      hasCustomBackground:false,
      assetId:'',pngUrl:'',pngFileName:''
    };
  }

  function normalizeSaved(v){
    if(!v||typeof v!=='object')return null;
    var tid=TEMPLATES[v.template]?v.template:'template-1';
    var t=templateDef(tid);
    var out={
      template:tid,
      title:finalText(v.title,t.titleMax),
      message:finalText(v.message,t.messageMax),
      signature:finalText(v.signature,t.signatureMax),
      eyebrow:t.eyebrow?finalText(v.eyebrow||t.eyebrowDefault||'',t.eyebrowMax||18):'',
      subtitle:t.subtitle?finalText(v.subtitle||t.subtitleDefault||'',t.subtitleMax||8):'',
      backgroundColor:normalizeColor(v.backgroundColor),
      textColor:normalizeTextColor(v.textColor),
      fontKey:normalizeFontKey(v.fontKey),
      isBold:normalizeBool(v.isBold),
      shadowStrength:normalizeInt(v.shadowStrength,0,24,0),
      shadowColor:normalizeTextColor(v.shadowColor||DEFAULT_SHADOW_COLOR),
      outlineWidth:normalizeInt(v.outlineWidth,0,6,0),
      outlineColor:normalizeTextColor(v.outlineColor||DEFAULT_OUTLINE_COLOR),
      hasCustomBackground:!!v.hasCustomBackground,
      assetId:String(v.assetId||'').slice(0,80),
      pngUrl:String(v.pngUrl||'').slice(0,600),
      pngFileName:String(v.pngFileName||'').slice(0,120)
    };
    if(!out.title||!out.message||!out.signature)return null;
    return out;
  }
  function readSaved(){
    try{return normalizeSaved(JSON.parse(localStorage.getItem(storageKey())||'null'));}catch(e){return null;}
  }

  var state=readSaved()||defaults('template-1');
  var title=$('#titleInput'),message=$('#messageInput'),signature=$('#signatureInput');
  var eyebrow=$('#eyebrowInput'),subtitle=$('#subtitleInput');
  var previewTitle=$('#previewTitle'),previewMessage=$('#previewMessage'),previewSignature=$('#previewSignature');
  var previewEyebrow=$('#previewEyebrow'),previewSubtitle=$('#previewSubtitle');
  var card=$('#cardPreview');
  var pngStatus=$('#pngStatus');
  var moreTemplatesBtn=$('#toggleMoreTemplates');
  var backgroundColorFieldset=$('#backgroundColorFieldset');
  var backgroundColorInput=$('#backgroundColorInput');
  var backgroundColorValue=$('#backgroundColorValue');
  var resetBackgroundColor=$('#resetBackgroundColor');
  var backgroundImageInput=$('#backgroundImageInput');
  var removeBackgroundImage=$('#removeBackgroundImage');
  var backgroundImageStatus=$('#backgroundImageStatus');
  var backgroundObjectUrl='';
  var defaultBackgroundLayer=$('#defaultBackgroundLayer');
  var cropModal=$('#backgroundCropModal');
  var cropStage=$('#cropStage');
  var cropImagePreview=$('#cropImagePreview');
  var cropZoomInput=$('#cropZoomInput');
  var cropZoomValue=$('#cropZoomValue');
  var cropCancelBtn=$('#cropCancelBtn');
  var cropApplyBtn=$('#cropApplyBtn');
  var defaultTextStyleFieldset=$('#defaultTextStyleFieldset');
  var textColorInput=$('#textColorInput');
  var textColorValue=$('#textColorValue');
  var resetTextColor=$('#resetTextColor');
  var textEffectsLabel=$('#textEffectsLabel');
  var boldTextToggle=$('#boldTextToggle');
  var shadowStrengthInput=$('#shadowStrengthInput');
  var shadowStrengthValue=$('#shadowStrengthValue');
  var shadowColorInput=$('#shadowColorInput');
  var shadowColorValue=$('#shadowColorValue');
  var resetShadowColor=$('#resetShadowColor');
  var outlineWidthInput=$('#outlineWidthInput');
  var outlineWidthValue=$('#outlineWidthValue');
  var outlineColorInput=$('#outlineColorInput');
  var outlineColorValue=$('#outlineColorValue');
  var resetOutlineColor=$('#resetOutlineColor');
  var lockNote=$('#lockNote');
  var extraTemplatesExpanded=false;
  var priceConfirmModal=$('#greetingPriceConfirm');
  var priceConfirmApprove=$('#greetingPriceConfirmApprove');
  var priceConfirmCancel=$('#greetingPriceConfirmCancel');
  var priceConfirmResolver=null;
  var priceConfirmLastFocus=null;

  function closeGreetingPriceConfirm(approved){
    if(!priceConfirmModal||priceConfirmModal.hidden)return;
    priceConfirmModal.hidden=true;document.body.classList.remove('ge-price-confirm-open');
    var resolve=priceConfirmResolver;priceConfirmResolver=null;
    if(priceConfirmLastFocus&&priceConfirmLastFocus.focus){try{priceConfirmLastFocus.focus();}catch(e){}}
    if(resolve)resolve(!!approved);
  }
  function confirmGreetingPrice(){
    if(hasGreetingOptIn())return Promise.resolve(true);
    if(!priceConfirmModal)return Promise.resolve(false);
    priceConfirmLastFocus=document.activeElement;priceConfirmModal.hidden=false;document.body.classList.add('ge-price-confirm-open');
    return new Promise(function(resolve){priceConfirmResolver=resolve;setTimeout(function(){try{priceConfirmApprove.focus();}catch(e){}},10);});
  }
  var cropSession={active:false,resolve:null,reject:null,url:'',stageSize:0,naturalWidth:0,naturalHeight:0,baseScale:1,zoom:1,offsetX:0,offsetY:0,renderWidth:0,renderHeight:0,dragging:false,pointerId:null,startX:0,startY:0,startOffsetX:0,startOffsetY:0};

  var TEMPLATE_EN={
    'template-1':['Default','Clean and minimal'],
    'template-2':['Cream & Gold','Delicate classic florals'],
    'template-4':['Warm Botanical','Terracotta and leaves'],
    'template-5':['Classic Green','White, green and gold'],
    'template-6':['Lavender','Ribbon and delicate florals'],
    'template-7':['Elegant Blue','Smoky blue and gold'],
    'template-8':['Natural Cream','Green leaves and gold'],
    'template-9':['Luxury Sage','Sage ribbon and white florals'],
    'template-10':['Floral Pink','Pink ribbon and florals'],
    'template-11':['Floral Blue','Blue ribbon and florals'],
    'template-12':['Champagne','Champagne-toned ribbon'],
    'template-13':['Sage Green','White florals on a green background'],
    'template-15':['Pink Lace','Romantic flowers and lace'],
    'template-17':['Gold & Pearls','Classic luxury design']
  };
  var FONT_NAMES_EN={'noto-serif':'Classic','frank-ruhl':'Elegant','david':'David','heebo':'Modern','assistant':'Clean','rubik':'Rubik','alef':'Alef','varela':'Soft','miriam':'Miriam','secular':'Bold'};
  function setSectionText(fieldset,titleText,descText){
    if(!fieldset)return;var strong=fieldset.querySelector('.ge-section-title strong'),small=fieldset.querySelector('.ge-section-title small');
    if(strong)strong.textContent=titleText;if(small)small.textContent=descText;
  }
  function applyUiLanguage(){
    document.documentElement.lang='he';document.documentElement.dir='rtl';
    document.title='עיצוב ברכה - '+(L(CFG.brand&&CFG.brand.name)||'VerSans');
    var e=$('#geLangBtn');if(e)e.textContent=tr('langBtn');
    e=$('#geTopNote');if(e)e.textContent=tr('topnote');
    e=$('#geIntroEyebrow');if(e)e.textContent=tr('introEyebrow');
    e=$('#geIntroTitle');if(e)e.textContent=tr('introTitle');
    e=$('#geIntroText');if(e)e.textContent=tr('introText');
    e=$('#gePreviewTitle');if(e)e.textContent=tr('preview');
    if(pngStatus)pngStatus.textContent=pngStatus.classList.contains('is-ok')?tr('pngExists'):tr('pngReady');
    if($('#backLink'))$('#backLink').textContent=tr('back');
    setSectionText($('#templateOptions')&&$('#templateOptions').closest('.ge-fieldset'),tr('templateTitle'),tr('templateDesc'));
    var titleMaxSpan=title.closest('.ge-fieldset').querySelector('.ge-counter span');if(titleMaxSpan)titleMaxSpan.textContent=tr('max',15);
    var messageMaxSpan=message.closest('.ge-fieldset').querySelector('.ge-counter span');if(messageMaxSpan)messageMaxSpan.textContent=tr('max',170);
    setSectionText(backgroundColorFieldset,tr('bgTitle'),tr('bgDesc'));
    setSectionText(defaultTextStyleFieldset,tr('styleTitle'),tr('styleDesc'));
    setSectionText($('#eyebrowFieldset'),tr('eyebrowTitle'),tr('eyebrowDesc'));
    setSectionText(title.closest('.ge-fieldset'),tr('titleTitle'),tr('titleDesc'));
    setSectionText($('#subtitleFieldset'),tr('subtitleTitle'),tr('subtitleDesc'));
    setSectionText(message.closest('.ge-fieldset'),tr('messageTitle'),tr('messageDesc'));
    setSectionText(signature.closest('.ge-fieldset'),tr('signatureTitle'),tr('signatureDesc'));
    var label;
    label=document.querySelector('label[for=backgroundColorInput] span');if(label)label.textContent=tr('chooseBg');
    e=$('#backgroundImageLabel');if(e)e.textContent=tr('bgImageLabel');
    e=$('#backgroundImageChooseText');if(e)e.textContent=tr('bgImageChoose');
    e=$('#backgroundImageNote');if(e)e.textContent=tr('bgImageNote');
    if(removeBackgroundImage)removeBackgroundImage.textContent=tr('bgImageRemove');
    e=$('#cropModalTitle');if(e)e.textContent=tr('cropTitle');
    e=$('#cropModalDesc');if(e)e.textContent=tr('cropDesc');
    e=$('#cropZoomLabel');if(e)e.textContent=tr('cropZoom');
    e=$('#cropTip');if(e)e.textContent=tr('cropTip');
    if(cropCancelBtn)cropCancelBtn.textContent=tr('cropCancel');
    if(cropApplyBtn)cropApplyBtn.textContent=tr('cropApply');
    label=document.querySelector('label[for=textColorInput] span');if(label)label.textContent=tr('chooseTextColor');
    label=document.querySelector('label[for=eyebrowInput]');if(label)label.textContent=tr('eyebrowLabel');
    label=document.querySelector('label[for=titleInput]');if(label)label.textContent=tr('titleLabel');
    label=document.querySelector('label[for=subtitleInput]');if(label)label.textContent=tr('subtitleLabel');
    label=document.querySelector('label[for=messageInput]');if(label)label.textContent=tr('messageLabel');
    label=document.querySelector('label[for=signatureInput]');if(label)label.textContent=tr('signatureLabel');
    e=$('#fontStyleLabel');if(e)e.textContent=tr('font');e=$('#textColorLabel');if(e)e.textContent=tr('textColor');if(textEffectsLabel)textEffectsLabel.textContent=tr('effects');
    if(resetBackgroundColor)resetBackgroundColor.textContent=tr('reset');if(resetTextColor)resetTextColor.textContent=tr('reset');if(resetShadowColor)resetShadowColor.textContent=tr('reset');if(resetOutlineColor)resetOutlineColor.textContent=tr('reset');
    e=$('#boldTextLabel');if(e)e.textContent=tr('boldLabel');
    e=$('#shadowStrengthLabel');if(e)e.textContent=tr('shadowStrength');
    e=$('#shadowColorText');if(e)e.textContent=tr('shadowColor');
    e=$('#outlineWidthLabel');if(e)e.textContent=tr('outlineWidth');
    e=$('#outlineColorText');if(e)e.textContent=tr('outlineColor');
    $$('#textEffectPresets .ge-effect-preset').forEach(function(btn){var key=btn.getAttribute('data-preset');if(key==='none')btn.textContent=tr('presetNone');if(key==='soft')btn.textContent=tr('presetSoft');if(key==='strong')btn.textContent=tr('presetStrong');if(key==='outline')btn.textContent=tr('presetOutline');if(key==='sticker')btn.textContent=tr('presetSticker');});
    if($('#saveGreeting'))$('#saveGreeting').textContent=tr('save');if($('#resetGreeting'))$('#resetGreeting').textContent=tr('resetGreeting');
    $$('.ge-template-option').forEach(function(opt){if(lang!=='en')return;var d=TEMPLATE_EN[opt.getAttribute('data-template')];if(!d)return;var strong=opt.querySelector('span:nth-of-type(2) strong'),small=opt.querySelector('span:nth-of-type(2) small');if(strong)strong.textContent=d[0];if(small)small.textContent=d[1];});
    if(lang==='he'){
      var heNames={'template-1':['Default','נקי ומינימליסטי'],'template-2':['שמנת וזהב','פרחים עדינים וקלאסיים'],'template-4':['בוטני חם','טרקוטה ועלים'],'template-5':['ירוק קלאסי','לבן, ירוק וזהב'],'template-6':['לבנדר','סרט ופרחים עדינים'],'template-7':['כחול אלגנטי','כחול מעושן וזהב'],'template-8':['שמנת טבעית','עלים ירוקים וזהב'],'template-9':['סייג׳ יוקרתי','סרט ירוק ופרחים לבנים'],'template-10':['ורוד פרחוני','סרט ורוד ופרחים'],'template-11':['תכלת פרחוני','סרט תכלת ופרחים'],'template-12':['שמפניה','סרט בגוון שמפניה'],'template-13':['ירוק מרווה','פרחים לבנים ורקע ירקרק'],'template-15':['ורוד תחרה','פרחים ותחרה רומנטית'],'template-17':['זהב ופנינים','עיצוב יוקרתי קלאסי']};
      $$('.ge-template-option').forEach(function(opt){var d=heNames[opt.getAttribute('data-template')];if(!d)return;var strong=opt.querySelector('span:nth-of-type(2) strong'),small=opt.querySelector('span:nth-of-type(2) small');if(strong)strong.textContent=d[0];if(small)small.textContent=d[1];});
    }
    var FONT_NAMES_HE={'noto-serif':'קלאסי','frank-ruhl':'אלגנטי','david':'דוד','heebo':'מודרני','assistant':'נקי','rubik':'רוביק','alef':'אלף','varela':'רך','miriam':'מרים','secular':'בולט'};
    $$('.ge-font-option').forEach(function(btn){var strong=btn.querySelector('strong'),sample=btn.querySelector('span');if(strong)strong.textContent=FONT_NAMES_HE[btn.getAttribute('data-font')]||btn.getAttribute('data-font');if(sample)sample.textContent=tr('fontSample');});
    updateFieldLimits();syncExtraTemplates();render();
  }

  function syncExtraTemplates(){
    $$('.ge-template-option--extra').forEach(function(opt){
      opt.hidden=!extraTemplatesExpanded && !opt.classList.contains('is-selected');
    });
    if(moreTemplatesBtn){
      moreTemplatesBtn.setAttribute('aria-expanded',extraTemplatesExpanded?'true':'false');
      moreTemplatesBtn.textContent=extraTemplatesExpanded?tr('less'):tr('more');
    }
  }

  function updateFieldLimits(){
    var t=templateDef(state.template);
    title.maxLength=t.titleMax;
    message.maxLength=t.messageMax;
    signature.maxLength=t.signatureMax;
    $('#signatureMaxText').textContent=tr('max',t.signatureMax);
    if(t.eyebrow){eyebrow.maxLength=t.eyebrowMax;$('#eyebrowMaxText').textContent=tr('max',t.eyebrowMax);}
    if(t.subtitle){subtitle.maxLength=t.subtitleMax;$('#subtitleMaxText').textContent=tr('max',t.subtitleMax);}
  }

  function readInputsIntoState(){
    var t=templateDef(state.template);
    state.title=liveText(title.value,t.titleMax);
    state.message=liveText(message.value,t.messageMax);
    state.signature=liveText(signature.value,t.signatureMax);
    state.eyebrow=t.eyebrow?liveText(eyebrow.value,t.eyebrowMax):'';
    state.subtitle=t.subtitle?liveText(subtitle.value,t.subtitleMax):'';
  }

  function render(){
    var t=templateDef(state.template);
    updateFieldLimits();
    title.value=liveText(title.value,t.titleMax);
    message.value=liveText(message.value,t.messageMax);
    signature.value=liveText(signature.value,t.signatureMax);
    if(t.eyebrow)eyebrow.value=liveText(eyebrow.value,t.eyebrowMax);
    if(t.subtitle)subtitle.value=liveText(subtitle.value,t.subtitleMax);

    previewTitle.textContent=title.value||tr('titlePlaceholder');
    var wrappedMessage=wrapTextByRowLimit(message.value||tr('messagePlaceholder'),t.messageCharsPerLine||30);
    previewMessage.textContent=wrappedMessage;
    var messageLines=wrappedMessage?wrappedMessage.split('\n').length:1;
    previewMessage.classList.toggle('ge-message-dense',messageLines>=7);
    previewMessage.classList.toggle('ge-message-very-dense',messageLines>=8);
    previewSignature.textContent=signature.value||tr('signaturePlaceholder');

    $('#eyebrowFieldset').hidden=!t.eyebrow;
    previewEyebrow.hidden=!t.eyebrow;
    if(t.eyebrow){previewEyebrow.textContent=eyebrow.value||t.eyebrowDefault||'';$('#eyebrowCount').textContent=eyebrow.value.length+'/'+t.eyebrowMax;}

    $('#subtitleFieldset').hidden=!t.subtitle;
    previewSubtitle.hidden=!t.subtitle;
    if(t.subtitle){previewSubtitle.textContent=subtitle.value||t.subtitleDefault||'';$('#subtitleCount').textContent=subtitle.value.length+'/'+t.subtitleMax;}

    $('#titleCount').textContent=title.value.length+'/'+t.titleMax;
    $('#messageCount').textContent=message.value.length+'/'+t.messageMax;
    $('#signatureCount').textContent=signature.value.length+'/'+t.signatureMax;

    state.backgroundColor=normalizeColor(state.backgroundColor);
    state.textColor=normalizeTextColor(state.textColor);
    state.fontKey=normalizeFontKey(state.fontKey);
    state.isBold=normalizeBool(state.isBold);
    state.shadowStrength=normalizeInt(state.shadowStrength,0,24,0);
    state.shadowColor=normalizeTextColor(state.shadowColor||DEFAULT_SHADOW_COLOR);
    state.outlineWidth=normalizeInt(state.outlineWidth,0,6,0);
    state.outlineColor=normalizeTextColor(state.outlineColor||DEFAULT_OUTLINE_COLOR);
    if(backgroundColorInput)backgroundColorInput.value=state.backgroundColor;
    if(backgroundColorValue)backgroundColorValue.textContent=state.backgroundColor.toUpperCase();
    if(backgroundColorFieldset)backgroundColorFieldset.hidden=state.template!=='template-1';
    if(defaultTextStyleFieldset)defaultTextStyleFieldset.hidden=state.template!=='template-1';
    if(textColorInput)textColorInput.value=state.textColor;
    if(textColorValue)textColorValue.textContent=state.textColor.toUpperCase();
    if(boldTextToggle)boldTextToggle.checked=!!state.isBold;
    if(shadowStrengthInput)shadowStrengthInput.value=String(state.shadowStrength);
    if(shadowStrengthValue)shadowStrengthValue.textContent=String(state.shadowStrength);
    if(shadowColorInput)shadowColorInput.value=state.shadowColor;
    if(shadowColorValue)shadowColorValue.textContent=state.shadowColor.toUpperCase();
    if(outlineWidthInput)outlineWidthInput.value=String(state.outlineWidth);
    if(outlineWidthValue)outlineWidthValue.textContent=String(state.outlineWidth);
    if(outlineColorInput)outlineColorInput.value=state.outlineColor;
    if(outlineColorValue)outlineColorValue.textContent=state.outlineColor.toUpperCase();
    card.style.setProperty('--greeting-bg',state.backgroundColor);
    var defaultFrameColor=deriveDefaultFrameColor(state.backgroundColor);
    card.style.setProperty('--default-frame-color',defaultFrameColor);
    card.style.setProperty('--default-frame-soft',rgbaFromHex(defaultFrameColor,.48));
    card.style.setProperty('--greeting-text',state.template==='template-1'?state.textColor:'#111111');
    card.style.setProperty('--greeting-font',state.template==='template-1'?FONT_MAP[state.fontKey]:FONT_MAP[DEFAULT_FONT_KEY]);
    var effectShadow=state.template==='template-1'?buildTextShadow(state):'';
    [previewTitle,previewMessage,previewSignature,previewEyebrow,previewSubtitle].forEach(function(el){if(!el)return;el.style.fontWeight=state.template==='template-1'?(state.isBold?'800':''):'';el.style.textShadow=effectShadow;});
    $$('.ge-font-option').forEach(function(btn){btn.classList.toggle('is-selected',btn.getAttribute('data-font')===state.fontKey);});
    $$('#textColorSwatches button').forEach(function(btn){btn.classList.toggle('is-selected',String(btn.getAttribute('data-color')||'').toLowerCase()===state.textColor);});
    var activePreset=effectPresetFromState(state);
    $$('#textEffectPresets .ge-effect-preset').forEach(function(btn){btn.classList.toggle('is-selected',btn.getAttribute('data-preset')===activePreset);});
    if(lockNote){
      var isDefault=state.template==='template-1';
      lockNote.classList.toggle('is-default',isDefault);lockNote.classList.toggle('is-locked',!isDefault);
      lockNote.textContent=isDefault?tr('lockDefault'):tr('lockOther');
    }
    card.className='ge-card ge-card--'+state.template;
    var showCustomBg=state.template==='template-1'&&!!backgroundObjectUrl;
    card.classList.toggle('has-custom-bg',showCustomBg);
    card.style.setProperty('--custom-bg-image',showCustomBg?'url(\"'+backgroundObjectUrl.replace(/\"/g,'')+'\")':'none');
    if(defaultBackgroundLayer){defaultBackgroundLayer.style.backgroundImage=showCustomBg?'url(\"'+backgroundObjectUrl.replace(/\"/g,'')+'\")':'none';defaultBackgroundLayer.hidden=!showCustomBg;}
    if(removeBackgroundImage)removeBackgroundImage.hidden=!showCustomBg;
    $$('.ge-template-option').forEach(function(opt){
      var selected=opt.getAttribute('data-template')===state.template;
      opt.classList.toggle('is-selected',selected);
      var radio=opt.querySelector('input[type=radio]');
      if(radio)radio.checked=selected;
    });
    syncExtraTemplates();
  }

  function apply(v){
    state=Object.assign({},v);
    var t=templateDef(state.template);
    title.value=liveText(state.title,t.titleMax);
    message.value=liveText(state.message,t.messageMax);
    signature.value=liveText(state.signature,t.signatureMax);
    eyebrow.value=t.eyebrow?liveText(state.eyebrow||t.eyebrowDefault||'',t.eyebrowMax):'';
    subtitle.value=t.subtitle?liveText(state.subtitle||t.subtitleDefault||'',t.subtitleMax):'';
    state.backgroundColor=normalizeColor(state.backgroundColor);
    state.textColor=normalizeTextColor(state.textColor);
    state.fontKey=normalizeFontKey(state.fontKey);
    state.isBold=normalizeBool(state.isBold);
    state.shadowStrength=normalizeInt(state.shadowStrength,0,24,0);
    state.shadowColor=normalizeTextColor(state.shadowColor||DEFAULT_SHADOW_COLOR);
    state.outlineWidth=normalizeInt(state.outlineWidth,0,6,0);
    state.outlineColor=normalizeTextColor(state.outlineColor||DEFAULT_OUTLINE_COLOR);
    render();
  }

  function setCropDragging(isDragging){if(cropStage)cropStage.classList.toggle('is-dragging',!!isDragging);cropSession.dragging=!!isDragging;}
  function updateCropImage(){
    if(!cropSession.active||!cropImagePreview||!cropStage)return;
    cropSession.zoom=clamp(parseFloat(cropZoomInput&&cropZoomInput.value||'100')/100,1,3);
    cropSession.renderWidth=cropSession.naturalWidth*cropSession.baseScale*cropSession.zoom;
    cropSession.renderHeight=cropSession.naturalHeight*cropSession.baseScale*cropSession.zoom;
    var maxX=Math.max(0,(cropSession.renderWidth-cropSession.stageSize)/2);
    var maxY=Math.max(0,(cropSession.renderHeight-cropSession.stageSize)/2);
    cropSession.offsetX=clamp(cropSession.offsetX,-maxX,maxX);
    cropSession.offsetY=clamp(cropSession.offsetY,-maxY,maxY);
    cropImagePreview.style.width=cropSession.renderWidth+'px';
    cropImagePreview.style.height=cropSession.renderHeight+'px';
    cropImagePreview.style.left=(cropSession.stageSize/2+cropSession.offsetX-cropSession.renderWidth/2)+'px';
    cropImagePreview.style.top=(cropSession.stageSize/2+cropSession.offsetY-cropSession.renderHeight/2)+'px';
    if(cropZoomValue)cropZoomValue.textContent=Math.round(cropSession.zoom*100)+'%';
  }
  function initCropSession(){
    if(!cropStage||!cropImagePreview)return;
    cropSession.stageSize=Math.max(220,Math.round(cropStage.clientWidth||360));
    cropSession.naturalWidth=cropImagePreview.naturalWidth||cropImagePreview.width||1;
    cropSession.naturalHeight=cropImagePreview.naturalHeight||cropImagePreview.height||1;
    cropSession.baseScale=Math.max(cropSession.stageSize/cropSession.naturalWidth,cropSession.stageSize/cropSession.naturalHeight);
    cropSession.zoom=1;cropSession.offsetX=0;cropSession.offsetY=0;
    if(cropZoomInput)cropZoomInput.value='100';
    updateCropImage();
  }
  function closeCropModal(){
    if(cropModal)cropModal.hidden=true;
    document.body.classList.remove('ge-modal-open');
    setCropDragging(false);
    if(cropSession.url){try{URL.revokeObjectURL(cropSession.url);}catch(e){}}
    cropSession={active:false,resolve:null,reject:null,url:'',stageSize:0,naturalWidth:0,naturalHeight:0,baseScale:1,zoom:1,offsetX:0,offsetY:0,renderWidth:0,renderHeight:0,dragging:false,pointerId:null,startX:0,startY:0,startOffsetX:0,startOffsetY:0};
    if(cropImagePreview){cropImagePreview.removeAttribute('src');cropImagePreview.style.cssText='';}
  }
  function abortCropModal(){var reject=cropSession.reject;closeCropModal();if(reject)reject(new Error('Crop cancelled'));}
  function confirmCropModal(){
    if(!cropSession.active)return;
    var canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;
    var ctx=canvas.getContext('2d');
    var ratio=1200/Math.max(1,cropSession.stageSize);
    var dx=(cropSession.stageSize/2+cropSession.offsetX-cropSession.renderWidth/2)*ratio;
    var dy=(cropSession.stageSize/2+cropSession.offsetY-cropSession.renderHeight/2)*ratio;
    ctx.drawImage(cropImagePreview,dx,dy,cropSession.renderWidth*ratio,cropSession.renderHeight*ratio);
    canvasToPngBlob(canvas).then(function(blob){var resolve=cropSession.resolve;closeCropModal();if(resolve)resolve(blob);}).catch(function(err){var reject=cropSession.reject;closeCropModal();if(reject)reject(err);});
  }
  function openBackgroundCropper(file){
    return new Promise(function(resolve,reject){
      if(!cropModal||!cropStage||!cropImagePreview){reject(new Error('Crop UI unavailable'));return;}
      if(cropSession.active){abortCropModal();}
      cropSession.active=true;cropSession.resolve=resolve;cropSession.reject=reject;cropSession.url=URL.createObjectURL(file);
      cropModal.hidden=false;document.body.classList.add('ge-modal-open');
      cropImagePreview.onload=function(){requestAnimationFrame(initCropSession);};
      cropImagePreview.onerror=function(){var rej=cropSession.reject;closeCropModal();if(rej)rej(new Error('Image load failed'));};
      cropImagePreview.src=cropSession.url;
    });
  }
  function newAssetId(){
    return 'GR-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
  }
  function safeProductSlug(){return String(product.slug||product.id||'product').replace(/[^a-zA-Z0-9_-]/g,'-');}
  function pngName(assetId){return safeProductSlug()+'-'+assetId+'.png';}

  function openAssetDb(){
    return new Promise(function(resolve,reject){
      if(!window.indexedDB){reject(new Error('IndexedDB unavailable'));return;}
      var req=indexedDB.open('kw_greeting_assets',2);
      req.onupgradeneeded=function(){var db=req.result;if(!db.objectStoreNames.contains('pngs'))db.createObjectStore('pngs',{keyPath:'productId'});if(!db.objectStoreNames.contains('backgrounds'))db.createObjectStore('backgrounds',{keyPath:'productId'});};
      req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error||new Error('DB open failed'));};
    });
  }
  async function storeBackgroundLocally(blob){
    var db=await openAssetDb();
    await new Promise(function(resolve,reject){
      var tx=db.transaction('backgrounds','readwrite');
      tx.objectStore('backgrounds').put({productId:product.id,blob:blob,savedAt:Date.now()});
      tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error||new Error('Background write failed'));};
    });
    db.close();
  }
  async function loadBackgroundLocally(){
    try{
      var db=await openAssetDb();
      var row=await new Promise(function(resolve,reject){var req=db.transaction('backgrounds','readonly').objectStore('backgrounds').get(product.id);req.onsuccess=function(){resolve(req.result||null);};req.onerror=function(){reject(req.error);};});
      db.close();return row&&row.blob?row.blob:null;
    }catch(e){return null;}
  }
  async function deleteBackgroundLocally(){
    try{var db=await openAssetDb();await new Promise(function(resolve,reject){var tx=db.transaction('backgrounds','readwrite');tx.objectStore('backgrounds').delete(product.id);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};});db.close();}catch(e){}
  }
  function setBackgroundObjectUrl(blob){
    if(backgroundObjectUrl){try{URL.revokeObjectURL(backgroundObjectUrl);}catch(e){}}
    backgroundObjectUrl=blob?URL.createObjectURL(blob):'';
    state.hasCustomBackground=!!blob;
    render();
  }
  function canvasToPngBlob(canvas){return new Promise(function(resolve,reject){canvas.toBlob(function(blob){blob?resolve(blob):reject(new Error('Image conversion failed'));},'image/png');});}
  async function prepareBackgroundBlob(file){
    if(!file||!/^image\/(png|jpeg|webp)$/i.test(file.type||''))throw new Error('Unsupported image');
    return openBackgroundCropper(file);
  }
  async function storePngLocally(blob,meta){
    var db=await openAssetDb();
    await new Promise(function(resolve,reject){
      var tx=db.transaction('pngs','readwrite');
      tx.objectStore('pngs').put({productId:product.id,assetId:meta.assetId,fileName:meta.fileName,blob:blob,savedAt:Date.now()});
      tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error||new Error('DB write failed'));};
    });
    db.close();
  }
  async function loadLocalPng(){
    try{
      var db=await openAssetDb();
      var row=await new Promise(function(resolve,reject){var req=db.transaction('pngs','readonly').objectStore('pngs').get(product.id);req.onsuccess=function(){resolve(req.result||null);};req.onerror=function(){reject(req.error);};});
      db.close();
      if(row&&row.blob){return row;}
    }catch(e){}
    return null;
  }
  function blobToDataUrl(blob){
    return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result||''));};r.onerror=function(){reject(r.error);};r.readAsDataURL(blob);});
  }
  function canvasBlob(canvas){
    return new Promise(function(resolve,reject){canvas.toBlob(function(blob){if(blob)resolve(blob);else reject(new Error('PNG generation failed'));},'image/png');});
  }
  async function generatePng(){
    if(typeof window.html2canvas!=='function')throw new Error('PNG renderer unavailable');
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    var width=Math.max(1,card.getBoundingClientRect().width);
    var scale=Math.max(1,Math.min(3,1200/width));
    var canvas=await window.html2canvas(card,{backgroundColor:null,scale:scale,useCORS:true,logging:false,imageTimeout:10000});
    if(canvas.width!==canvas.height){
      var side=Math.min(canvas.width,canvas.height),square=document.createElement('canvas');square.width=1200;square.height=1200;
      var ctx=square.getContext('2d');ctx.drawImage(canvas,(canvas.width-side)/2,(canvas.height-side)/2,side,side,0,0,1200,1200);canvas=square;
    }
    return canvasBlob(canvas);
  }
  async function uploadPng(blob,meta,value){
    var storage=CFG.greetingStorage||{};
    var endpoint=String(storage.appsScriptUrl||'').trim();
    if(!endpoint||!/\/exec(?:$|\?)/.test(endpoint))throw new Error('Google Drive endpoint is not configured');

    var controller=window.AbortController?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort();},30000):null;
    try{
      var dataUrl=await blobToDataUrl(blob);
      var form=new FormData();
      form.append('image',dataUrl);
      form.append('greetingId',meta.assetId);
      form.append('productId',String(product.slug||product.id||'product'));
      form.append('template',String(value.template||''));
      form.append('fileName',String(meta.fileName||''));

      /*
       * Google Apps Script Web Apps do not reliably expose CORS response
       * headers after their redirect to googleusercontent.com. no-cors lets
       * the browser send the PNG directly to Drive without needing a paid
       * proxy/server. A resolved fetch means the request was handed off.
       */
      await fetch(endpoint,{
        method:'POST',
        mode:'no-cors',
        credentials:'omit',
        cache:'no-store',
        body:form,
        signal:controller?controller.signal:undefined
      });

      return {ok:true,provider:'google-drive',assetId:meta.assetId,fileName:meta.fileName};
    }finally{if(timer)clearTimeout(timer);}
  }
  function saveTextValue(value){try{localStorage.setItem(storageKey(),JSON.stringify(value));}catch(e){}}

  apply(state);
  $('#brandName').textContent=L(CFG.brand&&CFG.brand.name)||'VerSans';
  $('#backLink').href='product.html?id='+encodeURIComponent(product.slug||product.id);
  applyUiLanguage();
  loadLocalPng().then(function(row){if(row&&state.assetId&&row.assetId===state.assetId){pngStatus.textContent=tr('pngExists');pngStatus.className='ge-png-status is-ok';}});
  if(state.hasCustomBackground){loadBackgroundLocally().then(function(blob){if(blob){setBackgroundObjectUrl(blob);if(backgroundImageStatus){backgroundImageStatus.textContent=tr('bgImageReady');backgroundImageStatus.className='ge-bg-upload-status is-ok';}}else{state.hasCustomBackground=false;render();}});}

  [title,message,signature,eyebrow,subtitle].forEach(function(el){el.addEventListener('input',function(){readInputsIntoState();render();});});

  if(backgroundColorInput){backgroundColorInput.addEventListener('input',function(){state.backgroundColor=normalizeColor(backgroundColorInput.value);render();});}
  if(resetBackgroundColor){resetBackgroundColor.addEventListener('click',function(){state.backgroundColor=DEFAULT_BACKGROUND_COLOR;render();});}
  if(cropZoomInput){cropZoomInput.addEventListener('input',updateCropImage);}  
  if(cropCancelBtn){cropCancelBtn.addEventListener('click',abortCropModal);}  
  if(cropApplyBtn){cropApplyBtn.addEventListener('click',confirmCropModal);}  
  if(cropModal){cropModal.addEventListener('click',function(e){if(e.target&&e.target.hasAttribute('data-close-crop'))abortCropModal();});}
  if(cropStage){
    cropStage.addEventListener('pointerdown',function(e){
      if(!cropSession.active)return;
      e.preventDefault();
      cropSession.pointerId=e.pointerId;cropSession.startX=e.clientX;cropSession.startY=e.clientY;cropSession.startOffsetX=cropSession.offsetX;cropSession.startOffsetY=cropSession.offsetY;setCropDragging(true);
      try{cropStage.setPointerCapture(e.pointerId);}catch(err){}
    });
    cropStage.addEventListener('pointermove',function(e){
      if(!cropSession.dragging||cropSession.pointerId!==e.pointerId)return;
      cropSession.offsetX=cropSession.startOffsetX+(e.clientX-cropSession.startX);
      cropSession.offsetY=cropSession.startOffsetY+(e.clientY-cropSession.startY);
      updateCropImage();
    });
    function endDrag(e){if(!cropSession.dragging)return;if(e&&cropSession.pointerId!=null&&e.pointerId!==cropSession.pointerId)return;setCropDragging(false);cropSession.pointerId=null;}
    cropStage.addEventListener('pointerup',endDrag);cropStage.addEventListener('pointercancel',endDrag);cropStage.addEventListener('lostpointercapture',endDrag);
  }
  window.addEventListener('resize',function(){if(cropSession.active)requestAnimationFrame(initCropSession);});
  window.addEventListener('keydown',function(e){if(cropSession.active&&e.key==='Escape')abortCropModal();});

  if(backgroundImageInput){backgroundImageInput.addEventListener('change',async function(){
    var file=backgroundImageInput.files&&backgroundImageInput.files[0];if(!file)return;
    if(backgroundImageStatus){backgroundImageStatus.textContent='';backgroundImageStatus.className='ge-bg-upload-status';}
    try{var blob=await prepareBackgroundBlob(file);await storeBackgroundLocally(blob);setBackgroundObjectUrl(blob);if(backgroundImageStatus){backgroundImageStatus.textContent=tr('bgImageReady');backgroundImageStatus.className='ge-bg-upload-status is-ok';}}
    catch(e){if(e&&e.message==='Crop cancelled'){}else if(backgroundImageStatus){backgroundImageStatus.textContent=tr('bgImageError');backgroundImageStatus.className='ge-bg-upload-status is-error';}}
    backgroundImageInput.value='';
  });}
  if(removeBackgroundImage){removeBackgroundImage.addEventListener('click',async function(){await deleteBackgroundLocally();setBackgroundObjectUrl(null);if(backgroundImageStatus){backgroundImageStatus.textContent='';backgroundImageStatus.className='ge-bg-upload-status';}});}

  if(textColorInput){textColorInput.addEventListener('input',function(){state.textColor=normalizeTextColor(textColorInput.value);render();});}
  if(resetTextColor){resetTextColor.addEventListener('click',function(){state.textColor=DEFAULT_TEXT_COLOR;render();});}
  $$('.ge-font-option').forEach(function(btn){btn.addEventListener('click',function(){state.fontKey=normalizeFontKey(btn.getAttribute('data-font'));render();});});
  $$('#textColorSwatches button').forEach(function(btn){btn.addEventListener('click',function(){state.textColor=normalizeTextColor(btn.getAttribute('data-color'));render();});});
  if(boldTextToggle){boldTextToggle.addEventListener('change',function(){state.isBold=!!boldTextToggle.checked;render();});}
  if(shadowStrengthInput){shadowStrengthInput.addEventListener('input',function(){state.shadowStrength=normalizeInt(shadowStrengthInput.value,0,24,0);render();});}
  if(shadowColorInput){shadowColorInput.addEventListener('input',function(){state.shadowColor=normalizeTextColor(shadowColorInput.value);render();});}
  if(resetShadowColor){resetShadowColor.addEventListener('click',function(){state.shadowColor=DEFAULT_SHADOW_COLOR;render();});}
  if(outlineWidthInput){outlineWidthInput.addEventListener('input',function(){state.outlineWidth=normalizeInt(outlineWidthInput.value,0,6,0);render();});}
  if(outlineColorInput){outlineColorInput.addEventListener('input',function(){state.outlineColor=normalizeTextColor(outlineColorInput.value);render();});}
  if(resetOutlineColor){resetOutlineColor.addEventListener('click',function(){state.outlineColor=DEFAULT_OUTLINE_COLOR;render();});}
  $$('#textEffectPresets .ge-effect-preset').forEach(function(btn){btn.addEventListener('click',function(){var fx=applyEffectPreset(btn.getAttribute('data-preset'));state.isBold=fx.isBold;state.shadowStrength=fx.shadowStrength;state.shadowColor=fx.shadowColor;state.outlineWidth=fx.outlineWidth;state.outlineColor=fx.outlineColor;render();});});

  if(moreTemplatesBtn){
    moreTemplatesBtn.addEventListener('click',function(){
      extraTemplatesExpanded=!extraTemplatesExpanded;
      syncExtraTemplates();
    });
  }

  $$('input[name=template]').forEach(function(radio){
    radio.addEventListener('change',function(){
      if(!radio.checked)return;
      readInputsIntoState();
      var next=radio.value;if(!TEMPLATES[next])return;
      state.template=next;var t=templateDef(next);
      if(t.eyebrow&&!state.eyebrow)state.eyebrow=t.eyebrowDefault||'';
      if(t.subtitle&&!state.subtitle)state.subtitle=t.subtitleDefault||'';
      apply(state);$('#formError').hidden=true;
    });
  });

  if(priceConfirmApprove)priceConfirmApprove.addEventListener('click',function(){closeGreetingPriceConfirm(true);});
  if(priceConfirmCancel)priceConfirmCancel.addEventListener('click',function(){closeGreetingPriceConfirm(false);});
  if(priceConfirmModal)priceConfirmModal.addEventListener('click',function(e){if(e.target&&e.target.hasAttribute('data-price-confirm-close'))closeGreetingPriceConfirm(false);});
  document.addEventListener('keydown',function(e){if(priceConfirmModal&&!priceConfirmModal.hidden&&e.key==='Escape'){e.preventDefault();closeGreetingPriceConfirm(false);}});

  $('#saveGreeting').addEventListener('click',async function(){
    readInputsIntoState();
    var t=templateDef(state.template);
    var value={template:state.template,title:finalText(state.title,t.titleMax),message:finalText(state.message,t.messageMax),signature:finalText(state.signature,t.signatureMax),backgroundColor:normalizeColor(state.backgroundColor),textColor:normalizeTextColor(state.textColor),fontKey:normalizeFontKey(state.fontKey),isBold:normalizeBool(state.isBold),shadowStrength:normalizeInt(state.shadowStrength,0,24,0),shadowColor:normalizeTextColor(state.shadowColor||DEFAULT_SHADOW_COLOR),outlineWidth:normalizeInt(state.outlineWidth,0,6,0),outlineColor:normalizeTextColor(state.outlineColor||DEFAULT_OUTLINE_COLOR),hasCustomBackground:state.template==='template-1'&&!!backgroundObjectUrl};
    if(t.eyebrow)value.eyebrow=finalText(state.eyebrow,t.eyebrowMax);
    if(t.subtitle)value.subtitle=finalText(state.subtitle,t.subtitleMax);

    var err=$('#formError');
    if(!value.title||!value.message||!value.signature){err.hidden=false;err.textContent=tr('required');return;}
    if(t.eyebrow&&!value.eyebrow){err.hidden=false;err.textContent=tr('requiredEyebrow');return;}
    if(t.subtitle&&!value.subtitle){err.hidden=false;err.textContent=tr('requiredSubtitle');return;}

    var priceAccepted=await confirmGreetingPrice();
    if(!priceAccepted)return;

    err.hidden=true;
    var btn=this,oldText=btn.textContent;btn.disabled=true;btn.textContent=tr('saving');
    pngStatus.textContent=tr('creating');pngStatus.className='ge-png-status';
    try{
      var assetId=newAssetId(),fileName=pngName(assetId);
      var blob=await generatePng();
      value.assetId=assetId;value.pngFileName=fileName;value.pngUrl='';
      try{await storePngLocally(blob,{assetId:assetId,fileName:fileName});}catch(localErr){}
      try{
        await uploadPng(blob,{assetId:assetId,fileName:fileName},value);
        saveTextValue(value);
        saveGreetingOptIn();
        pngStatus.textContent=tr('uploadOk');pngStatus.className='ge-png-status is-ok';
        setTimeout(function(){window.location.href='product.html?id='+encodeURIComponent(product.slug||product.id);},350);
      }catch(uploadErr){
        pngStatus.textContent=tr('uploadFail');pngStatus.className='ge-png-status is-warn';
        btn.disabled=false;btn.textContent=tr('save');
      }
    }catch(e){
      err.hidden=false;err.textContent=tr('pngCreateError');
      pngStatus.textContent=tr('pngFail');pngStatus.className='ge-png-status is-warn';
      btn.disabled=false;btn.textContent=oldText;
    }
  });

  $('#resetGreeting').addEventListener('click',async function(){try{localStorage.removeItem(storageKey());}catch(e){}await deleteBackgroundLocally();setBackgroundObjectUrl(null);apply(defaults(state.template));if(backgroundImageStatus){backgroundImageStatus.textContent='';backgroundImageStatus.className='ge-bg-upload-status';}$('#formError').hidden=true;});
})();
