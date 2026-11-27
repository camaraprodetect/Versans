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
    var specific=[['clover',/תלתן|clover/],['titan',/טיטאן|titan/],['infinity',/אינפיניטי|infinity/],['emerald',/אמרלד|emerald/],['noya',/נויה|noya/],['flora',/פלורה|flora/],['drops',/טיפות|drop/],['curb',/גורמט|קיובן|קובני|קובנית|מיאמי|cuban|curb|miami/],['tennis',/טניס|tennis/],['ice',/אייס|\bice\b/],['royal',/רויאל|royal/]];
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
  var complements={necklaces:['bracelets','watches','rings','glasses'],bracelets:['necklaces','watches','rings','glasses'],watches:['bracelets','necklaces','glasses','rings'],glasses:['watches','necklaces','bracelets','hats'],rings:['bracelets','necklaces','watches'],hats:['glasses','watches','necklaces'],greeting:['bracelets','necklaces','watches'], 'photo-bracelets':['necklaces','bracelets','watches']};
  function recommend(current, displayTitle, list, excluded, flags, max) {
    if (!current) return [];
    var currentKind=kind(current), targets=complements[currentKind] || [], t=displayTitle || title(current), f=family(t), c=productColor(current,t), gender=audience(current);
    var denied=new Set((excluded || []).map(String).concat(identities(current))), seen=new Set(), out=[];
    var scored=(list || []).filter(function(p){return p && identities(p).length && !identities(p).some(function(id){return denied.has(id);}) && p.hidden!==true && p.inStock!==false && !hidden(p,flags||{}) && image(p) && Number(p.price)>0 && targets.includes(kind(p)) && !(gender && audience(p) && gender!==audience(p));}).map(function(p){
      var pt=title(p), pf=family(pt), pc=productColor(p,pt), match=f && pf===f, sameColors=c.filter(function(x){return pc.includes(x);}).length;
      var differentColors=c.length && pc.length && !sameColors;
      var exactColor=c.length && c.length===pc.length && sameColors===c.length;
      var score=30-targets.indexOf(kind(p))*5 + (match?100:0) + (exactColor?35:sameColors*15) - (differentColors?30:0);
      // Favor the corresponding classic set over other members of the broad curb/tennis family.
      if(match && /קלאס|classic/i.test(t) && /קלאס|classic/i.test(pt))score+=20;
      if (match && /משובצ|משובץ|iced|pav[eé]/i.test(t) === /משובצ|משובץ|iced|pav[eé]/i.test(pt))score+=10;
      return {p:p,score:score,group:kind(p)+'|'+(pf || pt.replace(/\s*[-–].*$/,''))};
    }).sort(function(a,b){return b.score-a.score;});
    var counts=Object.create(null);
    function pick(entry){seen.add(entry.group);out.push(entry.p);var k=kind(entry.p);counts[k]=(counts[k]||0)+1;}
    // Keep the strongest match first, then leave room for another accessory type.
    scored.forEach(function(entry){if(out.length >= (max||4) || seen.has(entry.group) || (counts[kind(entry.p)]||0)>=2 || entry.score<=0)return;pick(entry);});
    scored.forEach(function(entry){if(out.length >= (max||4) || seen.has(entry.group) || entry.score<=0)return;pick(entry);});
    return out;
  }
  return {recommend:recommend,identities:identities,title:title,image:image};
});
