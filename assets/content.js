(function(){
  'use strict';
  var app=document.getElementById('app'),error=document.getElementById('error');
  var currentUser=null;
  function el(tag,cls,value){var node=document.createElement(tag);if(cls)node.className=cls;if(value!=null)node.textContent=String(value);return node;}
  function money(agorot){return new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:2}).format(Number(agorot||0)/100);}
  function integer(value){return new Intl.NumberFormat('he-IL').format(Number(value||0));}
  function date(value){return value?new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'long',year:'numeric'}).format(new Date(Number(value))):'אין עדיין רכישה';}
  function kpi(label,value,description,primary){var box=el('article','cc-card'+(primary?' cc-card-primary':''));box.appendChild(el('div','cc-kpi-label',label));box.appendChild(el('div','cc-kpi-number',value));box.appendChild(el('div','cc-kpi-description',description));return box;}
  function fact(label,value){var row=el('div','cc-fact');row.appendChild(el('span','',label));row.appendChild(el('strong','',value));return row;}
  async function get(url){var res=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(res.status===401){location.href='/login';throw new Error('login_required');}if(res.status===403)throw new Error('אין לך הרשאה לצפות בנתונים האלה.');if(!res.ok)throw new Error('לא הצלחנו לטעון את הנתונים. נסו שוב.');return res.json();}
  function dashboard(c){var kpis=el('section','cc-kpis');kpis.appendChild(kpi('סך הכנסות מהקוד',money(c.revenueAgorot),'סכום הזמנות ששולמו, לא עמלת יוצר',true));kpis.appendChild(kpi('רכישות שבוצעו',integer(c.sales),'הזמנות ששולמו בלבד'));kpis.appendChild(kpi('הכנסות ב־30 ימים',money(c.revenue30Agorot),'הזמנות ששולמו בחודש האחרון'));kpis.appendChild(kpi('רכישות ב־30 ימים',integer(c.sales30),'הזמנות ששולמו בחודש האחרון'));app.appendChild(kpis);
    var sec=el('section','cc-section'),code=el('article','cc-card'),facts=el('article','cc-card');code.appendChild(el('h2','','קוד היוצר שלך'));
    var codeBox=el('div','cc-code-display');codeBox.appendChild(el('span','cc-code-value',c.code));var copy=el('button','cc-copy','העתקת קוד');copy.type='button';copy.addEventListener('click',async function(){try{await navigator.clipboard.writeText(c.code);copy.textContent='הועתק ✓';}catch(_){copy.textContent=c.code;}});codeBox.appendChild(copy);code.appendChild(codeBox);code.appendChild(el('p','cc-footnote',c.discountPercent>0?'לקוחות שמכניסים את הקוד מקבלים '+c.discountPercent+'% הנחה. כל רכישה ששולמה נזקפת לזכותך.':'הקוד משמש למעקב אחר רכישות. אין הנחה אוטומטית ללקוחות אלא אם האדמין הגדיר אחת.'));
    facts.appendChild(el('h2','','נתונים נוספים'));facts.appendChild(fact('ממוצע רכישה',c.sales?money(Math.round(c.revenueAgorot/c.sales)):'-'));facts.appendChild(fact('רכישה אחרונה',date(c.lastPaidAt)));facts.appendChild(fact('הנחת הקוד',integer(c.discountPercent)+'%'));facts.appendChild(fact('שם היוצר',c.name));sec.append(code,facts);app.appendChild(sec);
  }
  function leaderboard(rows){var section=el('section','cc-leaderboard'),heading=el('div','cc-leader-top');heading.appendChild(el('h2','','דירוג יוצרי התוכן'));heading.appendChild(el('span','','דירוג לפי מספר רכישות ששולמו'));section.appendChild(heading);
    if(!rows.length){section.appendChild(el('div','cc-empty','אין עדיין יוצרים בדירוג.'));app.appendChild(section);return;}
    var scroll=el('div','cc-table-scroll'),table=el('table','cc-table'),thead=el('thead'),tr=el('tr');['מקום','יוצר תוכן','קוד יוצר','רכישות'].forEach(function(label){tr.appendChild(el('th','',label));});thead.appendChild(tr);table.appendChild(thead);
    var tbody=el('tbody');rows.forEach(function(item,i){var row=el('tr');var rankCell=el('td'),rank=el('span','cc-rank'+(i<3?' is-top':''),i+1);rankCell.appendChild(rank);row.appendChild(rankCell);row.appendChild(el('td','cc-leader-name',item.name));var cell=el('td');cell.appendChild(el('span','cc-code-chip',item.code));row.appendChild(cell);row.appendChild(el('td','cc-sales',integer(item.sales)));tbody.appendChild(row);});table.appendChild(tbody);scroll.appendChild(table);section.appendChild(scroll);app.appendChild(section);
  }
  async function render(){
    var isBoard=location.pathname.replace(/\/$/,'')==='/content/leaderboard';document.getElementById('tabLeaderboard').classList.toggle('is-active',isBoard);document.getElementById('tabDashboard').classList.toggle('is-active',!isBoard);
    document.getElementById('pageTitle').textContent=isBoard?'היוצרים המובילים.':'ההצלחה שלך במספרים.';
    document.getElementById('pageSubtitle').textContent=isBoard?'רכישות, קודי יוצרים ודירוג מעודכן - ללא סכומי הכנסות אישיים.':'כל הנתונים מהקוד שלך, במקום אחד.';
    try{var data=await get(isBoard?'/api/content/leaderboard':'/api/content/me');app.replaceChildren();if(isBoard)leaderboard(data.leaderboard||[]);else dashboard(data.creator);}catch(e){error.textContent=e.message||'שגיאה בטעינת הנתונים';error.hidden=false;app.replaceChildren();}
  }
  render();
})();
