(function(){
  'use strict';
  function el(tag,cls,text){var node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=String(text);return node;}
  function money(n){return '₪'+(Number(n||0)/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function number(n){return Number(n||0).toLocaleString('he-IL');}
  function pct(n){return Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:2})+'%';}
  function caption(text){return el('p','sales-advanced-note',text);}
  function heading(text,sub){var div=el('div','sales-advanced-heading');div.append(el('h3','',text));if(sub)div.append(caption(sub));return div;}
  function details(title,help,open){var d=el('details','sales-advanced-section');if(open)d.open=true;var summary=el('summary');summary.append(el('span','',title),el('small','', 'לחץ לפתיחה / סגירה'));d.append(summary);var body=el('div','sales-advanced-body');if(help)body.append(caption(help));d.append(body);return {root:d,body:body};}
  function bars(data,valueKey,maxRows,labelKey){var max=Math.max(1,...data.map(row=>Number(row[valueKey]||0)));var box=el('div','sales-advanced-bars');(maxRows?data.slice(0,maxRows):data).forEach(function(row){
    var r=el('div','sales-advanced-bar');var top=el('div','sales-advanced-bar-line');top.append(el('span','',row[labelKey||'label']||'-'),el('strong','',money(row[valueKey])));
    var rail=el('div','sales-advanced-bar-rail'),fill=el('div','sales-advanced-bar-fill');fill.style.width=Math.min(100,Number(row[valueKey]||0)/max*100)+'%';rail.append(fill);r.append(top,rail);box.append(r);
  });if(!data.length)box.append(el('p','sales-advanced-empty','אין נתונים בטווח שנבחר.'));return box;}
  function table(headers,rows,formatter,empty){var shell=el('div','sales-advanced-table-scroll');var table=el('table','sales-advanced-table');var thead=el('thead'),head=el('tr');headers.forEach(function(label){head.append(el('th','',label));});thead.append(head);table.append(thead);var tbody=el('tbody');rows.forEach(function(row){var tr=el('tr');formatter(row).forEach(function(value){tr.append(el('td','',value));});tbody.append(tr);});table.append(tbody);shell.append(table);if(!rows.length)shell.append(el('div','sales-advanced-empty',empty||'אין נתונים להצגה בטווח שנבחר.'));return shell;}
  function stat(label,value,help){var item=el('div','sales-advanced-stat');item.append(el('span','',label),el('b','',value));if(help)item.append(el('small','',help));return item;}
  function stats(items){var grid=el('div','sales-advanced-stats');items.forEach(function(item){grid.append(stat.apply(null,item));});return grid;}
  function renderHours(data){var peak=data.hours.reduce(function(best,r){return r.orders>best.orders?r:best;},data.hours[0]||{label:'—',orders:0});var h=details('מכירות לפי שעה ביום','מספר הזמנות והכנסות לפי שעת אישור התשלום (שעון ישראל). נתוני המכירות אינם מודדים לבדם יעילות של פרסום.',true);
    h.body.append(stats([['השעה עם הכי הרבה הזמנות',peak.orders?peak.label:'אין נתונים'],['הזמנות בשעה המובילה',number(peak.orders)]]));
    var chart=el('div','sales-advanced-hour-chart');var max=Math.max(1,...data.hours.map(x=>x.orders));data.hours.forEach(function(x){var item=el('div','sales-advanced-hour');var bar=el('div','sales-advanced-hour-bar');bar.style.height=Math.max(1,x.orders/max*100)+'%';bar.title=x.label+' · '+number(x.orders)+' הזמנות · '+money(x.revenueAgorot);item.append(bar,el('span','',x.hour%6===0?String(x.hour).padStart(2,'0'):''));chart.append(item);});h.body.append(chart,caption('רחף עם העכבר מעל העמודות כדי לראות מספר הזמנות והכנסות.'));return h.root;}
  function renderDays(data){var h=details('מכירות לפי יום בשבוע','ימי השבוע לפי זמן אישור התשלום, לא לפי מועד פתיחת האתר.',true);
    var max=Math.max(1,...data.weekdays.map(x=>x.orders));var box=el('div','sales-advanced-bars');data.weekdays.forEach(function(r){var cell=el('div','sales-advanced-bar');var row=el('div','sales-advanced-bar-line');row.append(el('span','',r.label),el('strong','',number(r.orders)+' הזמנות · '+money(r.revenueAgorot)));var track=el('div','sales-advanced-bar-rail'),bar=el('div','sales-advanced-bar-fill');bar.style.width=(r.orders/max*100)+'%';track.append(bar);cell.append(row,track);box.append(cell);});h.body.append(box);return h.root;}
  function renderCategories(data){var h=details('מכירות לפי קטגוריה','כמה יחידות נמכרו ומה חלקן היחסי בהכנסות ששולמו.',false);h.body.append(table(['קטגוריה','הזמנות','יחידות','הכנסות מיוחסות'],data.categories,r=>[r.label,number(r.orders),number(r.units),money(r.revenueAgorot)]));h.body.append(caption(data.notes.category));return h.root;}
  function renderVariants(data){var h=details('מכירות לפי וריאציה','צבע, מידה, רוחב או אורך שנשמרו בהזמנה. מוצגים עד 80 שילובים מובילים.',false);
    h.body.append(table(['מוצר','אפשרויות שנבחרו','יחידות','הזמנות'],data.variants,r=>[r.product,r.variant,number(r.units),number(r.orders)]));return h.root;}
  function renderLow(data){var h=details('הרבה צפיות ומעט רכישות','אבחון מוצרים שעשויים להזדקק לשיפור. ניתן להתחיל במוצרים עם צפיות רבות ורכישות מעטות.',false);
    h.body.append(table(['מוצר','צפיות','הוספות לסל','הזמנות','הזמנות / צפיות'],data.lowConversion,r=>[r.label,number(r.views),number(r.cartAdds),number(r.orders),pct(r.orderPerView)]));h.body.append(caption(data.notes.lowConversion));return h.root;}
  function renderPairs(data){var h=details('מוצרים שנרכשים יחד','צמדי מוצרים שונים שנרכשו באותה הזמנה ששולמה; כל צמד נספר פעם אחת להזמנה.',false);
    h.body.append(table(['מוצרים שנקנו ביחד','הזמנות משותפות'],data.pairs,r=>[r.label,number(r.orders)]));return h.root;}
  function renderPromotion(data){var p=data.promotion,h=details('השפעת מבצע 2+1','מכסה רק הזמנות שנשמר להן פירוט מבצע בזמן התשלום.',false);
    h.body.append(stats([['הזמנות שהשתמשו ב־2+1',number(p.orders)],['מימושים של 2+1',number(p.applications)],['הנחה כוללת שניתנה',money(p.discountAgorot)]]));
    if(p.untrackedOrders)h.body.append(caption(number(p.untrackedOrders)+' הזמנות ששולמו בטווח ללא צילום נתוני המבצע; הן לא נספרות כלא-מימשו. '+data.notes.promotion));
    else h.body.append(caption('נסרקו '+number(p.trackedOrders)+' הזמנות עם תיעוד מבצע.'));return h.root;}
  function renderCreators(data){var h=details('מכירות לפי יוצר תוכן','שיוך לפי קוד היוצר שנשמר בהזמנה ששולמה. הזמנות ללא קוד יוצר אינן מיוחסות.',false);
    h.body.append(table(['יוצר','הזמנות','הכנסות מיוחסות'],data.creators,r=>[r.label,number(r.orders),money(r.revenueAgorot)]));return h.root;}
  function renderTraffic(data){var h=details('המרת מבקרים לרוכשים לפי מקור','זיהוי לפי מבקרים באתר ורכישות ששויכו בביטחון סביר למבקר.',false);
    h.body.append(stats([['מבקרים מזוהים בתקופה',number(data.visitors)],['מבקרים שהפכו לרוכשים',number(data.buyers)],['שיעור המרה מזוהה',pct(data.conversionPct)]]));
    h.body.append(table(['מקור','מבקרים','רוכשים','המרה','הזמנות','הכנסות מיוחסות'],data.traffic,r=>[r.source,number(r.visitors),number(r.buyers),pct(r.conversionPct),number(r.orders),money(r.revenueAgorot)]));
    h.body.append(caption(number(data.unattributedOrders)+' הזמנות שלא ניתן לשייך למקור תנועה. '+data.notes.traffic));return h.root;}
  function chartLine(data,selection){
    var host=el('div','sales-advanced-plot-host');if(!selection.length){host.append(el('p','sales-advanced-empty','בחר עד 5 מוצרים להשוואה.'));return host;}
    var series=data.comparisons.filter(x=>selection.includes(x.id));var keys=new Set();series.forEach(s=>s.days.forEach(d=>keys.add(d.date)));
    var days=[...keys].sort();
    // Explicitly include zero-sale days, otherwise the chart misleadingly
    // connects dates with missing days as adjacent daily observations.
    if(['today','7d','30d'].includes(data.range)){
      var count=data.range==='today'?1:data.range==='7d'?8:31;
      var localDay=new Date(data.generatedAt||Date.now()).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});var start=new Date(localDay+'T12:00:00Z');
      var calendar=[];for(var i=count-1;i>=0;i--){var d=new Date(start.getTime()-i*86400000);calendar.push(d.toISOString().slice(0,10));}
      days=[...new Set([...days,...calendar])].sort();
    }
    if(!days.length){host.append(el('p','sales-advanced-empty','אין רכישות של המוצרים שנבחרו בתקופה.'));return host;}
    var values=series.map(s=>({label:s.label,values:days.map(d=>{var item=s.days.find(v=>v.date===d);return item?item.units:0;})}));
    var max=Math.max(1,...values.flatMap(s=>s.values)),step=days.length>1?720/(days.length-1):0;
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 800 280');svg.setAttribute('role','img');svg.setAttribute('aria-label','השוואת מספר יחידות שנמכרו לפי תאריך ומוצר');
    [0,0.25,0.5,0.75,1].forEach(function(frac){var y=240-frac*200;var line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',45);line.setAttribute('x2',765);line.setAttribute('y1',y);line.setAttribute('y2',y);line.setAttribute('stroke','currentColor');line.setAttribute('opacity','.14');svg.append(line);var txt=document.createElementNS('http://www.w3.org/2000/svg','text');txt.setAttribute('x',38);txt.setAttribute('y',y+5);txt.setAttribute('text-anchor','end');txt.setAttribute('fill','currentColor');txt.setAttribute('font-size','13');txt.textContent=String(Math.round(max*frac));svg.append(txt);});
    var palette=['#3569b4','#1d9a7c','#b07a21','#9261bc','#d05b72'];
    values.forEach(function(s,index){var p=document.createElementNS('http://www.w3.org/2000/svg','polyline');p.setAttribute('fill','none');p.setAttribute('stroke',palette[index]);p.setAttribute('stroke-width',3);p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');p.setAttribute('points',s.values.map((n,i)=>(45+i*step)+','+(240-n/max*200)).join(' '));svg.append(p);});
    host.append(svg);var axis=el('div','sales-advanced-plot-axis');axis.append(el('span','',days[0]),el('span','',days[days.length-1]));host.append(axis);
    var legend=el('div','sales-advanced-legend');values.forEach(function(s,index){var row=el('span','');var dot=el('i');dot.style.backgroundColor=palette[index];row.append(dot,el('span','',s.label));legend.append(row);});host.append(legend);return host;
  }
  function renderCompare(data){var h=details('השוואת עד חמישה מוצרים','השוואת יחידות שנמכרו לפי יום; כל מוצר נמדד באותו טווח זמן.',false);
    var products=data.products||[];var selected=products.slice(0,Math.min(3,products.length)).map(p=>p.id);
    var actions=el('div','sales-advanced-compare-controls'),select=el('select','sales-advanced-select');select.setAttribute('aria-label','בחר מוצר להשוואה');
    select.append(el('option','','בחר מוצר נוסף…'));products.forEach(function(p){var op=el('option','',p.label);op.value=p.id;select.append(op);});
    var add=el('button','sales-advanced-button','הוסף להשוואה');add.type='button';actions.append(select,add);
    var chips=el('div','sales-advanced-chips');var chart=el('div','sales-advanced-chart-holder');
    function redraw(){chips.replaceChildren();selected.forEach(function(id){var p=products.find(p=>p.id===id);if(!p)return;var button=el('button','sales-advanced-chip',p.label+' ×');button.type='button';button.setAttribute('aria-label','הסר '+p.label);button.onclick=function(){selected=selected.filter(x=>x!==id);redraw();};chips.append(button);});
      chart.replaceChildren(chartLine(data,selected));add.disabled=selected.length>=5;}
    add.onclick=function(){var id=select.value;if(!id||selected.includes(id))return;if(selected.length>=5)return;selected.push(id);select.value='';redraw();};
    h.body.append(actions,chips,chart);redraw();return h.root;}
  async function render(host,ctx){host.replaceChildren(el('p','sales-advanced-loading','טוען ניתוח מכירות מתקדם…'));
    try{var data=await ctx.api('/api/admin/sales/advanced?range='+encodeURIComponent(ctx.range));
      if(!host.isConnected)return;
      host.replaceChildren();var head=el('div','sales-advanced-title');head.append(el('h2','','ניתוח מכירות מתקדם'),caption('הנתונים כוללים הזמנות ששולמו בלבד, ללא הזמנות הדגמה. סינון לפי התקופה שנבחרה בראש העמוד.'));host.append(head);
      var layout=el('div','sales-advanced-grid');
      [renderHours,renderDays,renderCategories,renderVariants,renderCompare,renderLow,renderPairs,renderPromotion,renderCreators,renderTraffic].forEach(function(fn){layout.append(fn(data));});
      host.append(layout);
    }catch(err){host.replaceChildren();var d=el('div','sales-advanced-error');d.append(el('strong','','הניתוח המתקדם לא נטען. דוח המכירות הרגיל עדיין זמין.'),el('p','',String(err&&err.message||'שגיאה בשרת')));host.append(d);}
  }
  window.VersansSalesAdvanced={render:render};
})();
