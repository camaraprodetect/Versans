/* VerSans: deterministic, catalog-driven styling recommendations. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  var section = document.getElementById('completeLook');
  var grid = document.getElementById('completeLookGrid');
  if (!section || !grid) return;
  var current = null, purchased = null, request = 0, lastKey = '', timer;
  function cartIds() {
    try {
      // Reading raw storage avoids triggering the cart-repair notification cycle.
      var items = JSON.parse(localStorage.getItem('kw_cart') || '[]');
      return Array.isArray(items) ? items.flatMap(function (item) { return api.identities(item); }) : [];
    } catch (_) { return []; }
  }
  function draw() {
    if (!current || current.companionPicker || purchased === null) { section.hidden = true; return; }
    var products = api.recommend(current.product, current.title, window.PRODUCTS || [], cartIds().concat(purchased), window.__VERSANS_HIDDEN_CATEGORIES__ || {}, 4);
    var key = products.map(function(p){return api.identities(p)[0];}).join('|');
    if (key !== lastKey) {
      lastKey = key;
      grid.replaceChildren();
      products.forEach(function (p) {
        var link = document.createElement('a');
        link.className = 'complete-look__card';
        link.href = window.VERSANS_ROUTES.productPath(p);
        var picture = document.createElement('div'); picture.className = 'complete-look__media';
        var image = document.createElement('img'); image.src = api.image(p); image.alt = api.title(p); image.loading = 'lazy'; image.decoding = 'async';
        image.addEventListener('error', function(){ picture.hidden = true; }, {once:true});
        picture.appendChild(image); link.appendChild(picture);
        var name = document.createElement('span'); name.className = 'complete-look__name'; name.textContent = api.title(p); link.appendChild(name);
        var prices = document.createElement('span'); prices.className = 'complete-look__prices';
        var amount = document.createElement('strong'); amount.textContent = (p.startingPrice || (p.boxes || []).length ? 'החל מ־' : '') + money(p.price); prices.appendChild(amount);
        if (Number(p.compareAt) > Number(p.price)) { var old = document.createElement('del'); old.textContent = money(p.compareAt); prices.appendChild(old); }
        link.appendChild(prices);
        var cta = document.createElement('span'); cta.className = 'complete-look__cta'; cta.textContent = 'לצפייה במוצר'; link.appendChild(cta);
        grid.appendChild(link);
      });
    }
    section.hidden = products.length === 0;
  }
  function money(n) { return new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)); }
  function refreshHistory() {
    var token = ++request;
    purchased = null; section.hidden = true;
    // Fail closed: never recommend a previously purchased item merely because the API failed.
    fetch('/api/account/purchased-product-ids', {credentials:'same-origin',cache:'no-store'})
      .then(function(r){ if (!r.ok) throw new Error('history'); return r.json(); })
      .then(function(data){ if(token !== request) return; if(!data.ok || !Array.isArray(data.ids)) throw new Error('history'); purchased = data.ids; draw(); })
      .catch(function(){ if(token === request) { purchased = null; section.hidden = true; } });
  }
  root.addEventListener('versans:complete-look-product',function(e){current=e.detail;draw();});
  root.addEventListener('versans:cart-changed',draw);
  root.addEventListener('storage',function(e){if(e.key === 'kw_cart' || e.key === null) draw();});
  root.addEventListener('pageshow',function(e){if(e.persisted)refreshHistory();});
  root.addEventListener('focus',function(){clearTimeout(timer);timer=setTimeout(refreshHistory,150);});
  refreshHistory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function title(p) { return String(p && p.title && (p.title.he || p.title.en || p.title) || ''); }
  function identities(p) { return p ? [p.id,p.slug,p.urlSlug,p.productId,p.productSlug].filter(Boolean).map(String) : []; }
  function image(p) { return p.cardImage || (p.images || [])[0] || p.hoverImage || ''; }
  function categories(p) { return [p.category].concat(p.categories || []).filter(Boolean); }
  function kind(p) { var cats=categories(p);return ['necklaces','bracelets','watches','glasses','rings','hats','greeting','photo-bracelets'].find(function(c){return cats.includes(c);}) || ''; }
  function hidden(p, flags) {
    var cats=categories(p), audiences=['glasses-men','glasses-women','glasses-unisex'];
    if(cats.includes('glasses') || cats.some(function(c){return audiences.includes(c);})) {
      var assigned=cats.filter(function(c){return audiences.includes(c);});
      if(flags.glasses || (assigned.length && assigned.every(function(c){return flags[c]===true;}))) return true;
      return cats.some(function(c){return !audiences.includes(c) && flags[c]===true;});
    }
    return cats.some(function(c){return flags[c]===true;});
  }
  function family(t) {
    t=String(t).toLowerCase();
    var specific=[['clover',/תלתן|clover/],['titan',/טיטאן|titan/],['infinity',/אינפיניטי|infinity/],['emerald',/אמרלד|emerald/],['noya',/נויה|noya/],['flora',/פלורה|flora/],['drops',/טיפות|drop/],['curb',/גורמט|קיובן|קובני|קובנית|מיאמי|cuban|curb|miami/],['tennis',/טניס|tennis/],['ice',/אייס|\bice\b/],['royal',/רויאל|royal/],['hermes',/hermes|הרמס/],['flower',/פרחי|פרחוני|flower/],['star',/כוכב|star/],['halo',/היילו|halo/]];
    for(var i=0;i<specific.length;i++) if(specific[i][1].test(t))return specific[i][0];
    return '';
  }
  function color(t) {
    t=String(t).toLowerCase().replace(/זהב\s+לבן|white[ -]gold/g,' כסף ');
    var end=t.match(/(?:צבע\s+|color\s+)([^\n]+)$/); if(end) t=end[1];
    var parts=[];
    if(/רוז\s*גולד|rose[ -]gold/.test(t)){parts.push('rose');t=t.replace(/רוז\s*גולד|rose[ -]gold/g,'');}
    [['silver',/כסף|silver/],['gold',/זהב|gold/],['black',/שחור|שחורה|black/],['white',/לבן|לבנה|white/],['green',/ירוק|ירוקה|green/],['blue',/כחול|כחולה|blue/],['pink',/ורוד|ורודה|pink/],['red',/אדום|אדומה|red/],['brown',/חום|brown/]].forEach(function(x){if(x[1].test(t))parts.push(x[0]);});
    return parts;
  }
  function productColor(p, t) {
    var result=color(t); if(result.length) return result;
    var details=p.details && p.details.he;
    if(Array.isArray(details)) {
      var field=details.find(function(x){return /^(?:גוון|צבע)(?: התכשיט)?\s*:/.test(String(x));});
      if(field) { result=color(field); if(result.length)return result; }
    }
    return color(p.subtitle && (p.subtitle.he || p.subtitle.en) || '');
  }
  function audience(p) { var c=categories(p), t=title(p); var men=c.some(function(x){return /-men$/.test(x);}),women=c.some(function(x){return /-women$/.test(x);}); if(/לנשים/.test(t))return 'women'; if(/לגברים/.test(t))return 'men'; return men===women || c.includes('glasses-unisex')?'':(men?'men':'women'); }
  var complements={necklaces:['bracelets','rings','watches','glasses','necklaces'],bracelets:['necklaces','rings','watches','glasses','bracelets'],watches:['bracelets','necklaces','glasses','rings'],glasses:['necklaces','bracelets','watches','hats'],rings:['bracelets','necklaces','watches','glasses'],hats:['glasses','watches','necklaces'],greeting:['bracelets','necklaces','watches','glasses'], 'photo-bracelets':['necklaces','bracelets','watches']};
  var jewelry=['necklaces','bracelets','rings'];
  function style(p,t) {
    var k=kind(p), f=family(t), name=String(t).toLowerCase();
    var sub=String(p.subtitle && (p.subtitle.he || p.subtitle.en) || '').toLowerCase();
    var sparkle=/משובצ|משובץ|מואסנייט|moissanite|iced|זירקונ|zircon|מנצנ|glitter|pav[eé]/i;
    var motif=/תלתן|clover|פרח|flora|flower|טיפות|drop|כוכב|star|מגן דוד|heart|לב|halo|היילו/;
    if(k==='glasses') {
      if(/punk|polygon|oversized|cat eye/.test(name))return 'bold';
      if(/oval|round|retro/.test(name))return 'soft';
      return 'clean';
    }
    if(k==='watches') {
      if(/אייס|\bice\b|iced/.test(name) || sparkle.test(sub))return 'sparkle';
      if(/כרונו|chrono|sport/.test(name))return 'sport';
      return 'clean';
    }
    if(motif.test(name))return 'soft';
    if(/טיטאן|titan|כבדה|כבד|heavy|\bice\b|אייס|24\s*(?:מ|mm)/i.test(name))return 'bold';
    if(f==='tennis'&&/קלאס|classic/i.test(name))return 'refined';
    if(sparkle.test(name) || f==='tennis' || f==='emerald' || f==='noya' || sparkle.test(sub))return 'sparkle';
    if(f==='curb' || f==='hermes' || /קלאס|classic|חוליות|link/.test(name))return 'clean';
    return 'neutral';
  }
  function styleAffinity(a,b) {
    if(a===b && a!=='neutral')return 30;
    if(a==='neutral'||b==='neutral')return 7;
    if((a==='bold'&&b==='sparkle')||(a==='sparkle'&&b==='bold'))return 17;
    if((a==='soft'&&b==='sparkle')||(a==='sparkle'&&b==='soft'))return 15;
    if(a==='refined'||b==='refined'){var other=a==='refined'?b:a;return other==='clean'?25:other==='soft'?19:other==='sparkle'?17:other==='bold'?2:8;}
    if(b==='clean'||a==='clean')return 14;
    if(a==='sport'||b==='sport')return 4;
    return -8;
  }
  function modelKey(p,t,f) {
    if(f && kind(p)!=='glasses')return f;
    return String(t).toLowerCase().replace(/\s*[-–]\s*(?:צבע\s+|color\s+)?.*$/,'').replace(/\b(?:black|white|silver|gold|blue|green|pink|red|brown|smoke|crystal|champagne|amber|olive|tortoise|graphite|fade|lens|jet|electric|honey)\b/g,'').replace(/\s+/g,' ').trim();
  }
  function hash(t){var n=2166136261;for(var i=0;i<t.length;i++){n^=t.charCodeAt(i);n=Math.imul(n,16777619);}n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;return n>>>0;}
  function metal(colors){return colors.filter(function(x){return ['silver','gold','rose'].includes(x);});}
  function recommend(current, displayTitle, list, excluded, flags, max) {
    if(!current)return [];
    var currentKind=kind(current), targets=complements[currentKind]||[], t=displayTitle||title(current), f=family(t), c=productColor(current,t), gender=audience(current), mood=style(current,t), cm=metal(c);
    var denied=new Set((excluded||[]).map(String).concat(identities(current))), seen=new Set(), chosen=[], counts=Object.create(null), limit=max==null?4:Math.max(0,max);
    var currentModel=modelKey(current,t,f), seed=identities(current)[0]||t;
    var scored=(list||[]).filter(function(p){return p&&identities(p).length&&!identities(p).some(function(id){return denied.has(id);})&&p.hidden!==true&&p.inStock!==false&&!hidden(p,flags||{})&&image(p)&&Number(p.price)>0&&targets.includes(kind(p))&&!(gender&&audience(p)&&gender!==audience(p));}).map(function(p){
      var pt=title(p), k=kind(p), pf=family(pt), pc=productColor(p,pt), pm=metal(pc), ps=style(p,pt), model=modelKey(p,pt,pf), layering=k===currentKind, pair=(currentKind==='necklaces'&&k==='bracelets')||(currentKind==='bracelets'&&k==='necklaces');
      var match=pair&&!!f&&pf===f, sameColors=c.filter(function(x){return pc.includes(x);}).length, exactColor=c.length&&c.length===pc.length&&sameColors===c.length;
      var conflictingMetal=cm.length&&pm.length&&!cm.some(function(x){return pm.includes(x);});
      var conflictingAccent=c.length&&pc.length&&!sameColors;
      var neutralGlasses=k==='glasses'&&(!pc.length||pc.includes('black')||/smoke|graphite|clear/.test(pt.toLowerCase()));
      // Cross-category set before any generic color or watch match. Layer only distinct models.
      if(layering&&(model===currentModel||!sameColors||conflictingMetal||styleAffinity(mood,ps)<14||(mood==='bold'&&ps==='bold')||(mood==='soft'&&ps==='soft')))return null;
      if(conflictingMetal&&!match&&k!=='glasses')return null;
      var colorPoints=k==='glasses'?(sameColors?10:0):(exactColor?34:sameColors*17);
      var colorPenalty=k==='glasses'&&neutralGlasses?0:conflictingMetal?55:conflictingAccent?24:0;
      var score=(pair?45:jewelry.includes(k)?30:k==='watches'?13:12)+styleAffinity(mood,ps)+colorPoints-colorPenalty+(neutralGlasses?18:0)+(match?110:0)-(layering?14:0);
      if(match&&conflictingAccent)score-=55;
      if(match&&f==='curb'&&/משובצ|משובץ|iced|pav[eé]/i.test(t)!==/משובצ|משובץ|iced|pav[eé]/i.test(pt))score-=45;
      if(match&&/קלאס|classic/i.test(t)&&/קלאס|classic/i.test(pt))score+=25;
      if(match&&/משובצ|משובץ|iced|pav[eé]/i.test(t)===/משובצ|משובץ|iced|pav[eé]/i.test(pt))score+=10;
      // A stable per-product tiebreak avoids identical recommendations for every silver item.
      // It is deliberately too small to override a meaningful style or color advantage.
      score+=(hash(seed+'|'+identities(p)[0])%1000)/1000*(k==='glasses'?16:10);
      return {p:p,k:k,score:score,group:k+'|'+model,mood:ps,match:match,layering:layering};
    }).filter(Boolean).sort(function(a,b){return b.score-a.score;});
    function allowed(e){return !seen.has(e.group)&&!e.picked&&e.score>=32&&(counts[e.k]||0)<(['watches','glasses','hats'].includes(e.k)?1:2)&&(!e.layering||!chosen.some(function(x){return x.layering;}));}
    function pick(e){e.picked=true;seen.add(e.group);chosen.push(e);counts[e.k]=(counts[e.k]||0)+1;}
    while(chosen.length<limit){
      var eligible=scored.filter(allowed);if(!eligible.length)break;
      // Preserve the strongest true set in slot one. Subsequent slots reward a new type/style,
      // but never fill a slot with a duplicate watch or an irrelevant accessory.
      function rank(e){var same=counts[e.k]||0;var styles=chosen.filter(function(x){return x.mood===e.mood;}).length;return e.score-(same?38:0)-styles*8+(chosen.length&&!same?12:0);}
      eligible.sort(function(a,b){return rank(b)-rank(a);});pick(eligible[0]);
    }
    return chosen.map(function(e){return e.p;});
  }
  return {recommend:recommend,identities:identities,title:title,image:image};
});
