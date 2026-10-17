(function(){
  'use strict';
  var app=document.getElementById('app');
  var error=document.getElementById('error');
  var rangeOptions=document.getElementById('rangeOptions');
  var options={payment:'תקופת תשלום',today:'היום',week:'השבוע',all:'כל הזמנים'};
  var requested=new URLSearchParams(location.search).get('range');
  var range=Object.prototype.hasOwnProperty.call(options,requested)?requested:'payment';
  var renderCounter=0;
  var purchaseObserver=null;
  var viewedPeriodEnd=null;
  var countdownParts=null;
  var lastBoundaryRefreshAttempt=0;
  function el(tag,cls,value){var node=document.createElement(tag);if(cls)node.className=cls;if(value!=null)node.textContent=String(value);return node;}
  function money(agorot){return new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:2}).format(Number(agorot||0)/100);}
  function integer(value){return new Intl.NumberFormat('he-IL').format(Number(value||0));}
  function date(value){return value?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'long',year:'numeric'}).format(new Date(Number(value))):'אין רכישות בתקופה';}
  function periodText(start,endExclusive){return start!=null&&endExclusive!=null?date(start)+' - '+date(endExclusive-1):'';}
  function kpi(label,value,description,primary){var box=el('article','cc-card'+(primary?' cc-card-primary':''));box.appendChild(el('div','cc-kpi-label',label));box.appendChild(el('div','cc-kpi-number',value));box.appendChild(el('div','cc-kpi-description',description));return box;}
  function fact(label,value){var row=el('div','cc-fact');row.appendChild(el('span','',label));row.appendChild(el('strong','',value));return row;}
  async function get(url){var res=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(res.status===401){location.href='/login';throw new Error('login_required');}if(res.status===403)throw new Error('אין לך הרשאה לצפות בנתונים האלה.');if(!res.ok)throw new Error('לא הצלחנו לטעון את הנתונים. נסו שוב.');return res.json();}
  function dashboard(c){
    countdown(c.paymentPeriodEndExclusive,false);
    var sales=Number(c.sales||0), revenue=Number(c.revenueAgorot||0);
    var kpis=el('section','cc-kpis');
    kpis.appendChild(kpi('הכנסות דרך קוד היוצר',money(revenue),'סכום ההזמנות ששולמו, לא עמלת יוצר',true));
    kpis.appendChild(kpi('רכישות שהושלמו',integer(sales),'רכישות ששולמו בתקופה הנבחרת'));
    kpis.appendChild(kpi('ממוצע להזמנה',sales?money(Math.round(revenue/sales)):'₪0','מחיר רכישה ממוצע בתקופה'));
    kpis.appendChild(kpi('עמלה שהרווחת',money(c.commissionAgorot),'לפי אחוז העמלה שנקבע באדמין בעת כל רכישה'));
    app.appendChild(kpis);
    var sec=el('section','cc-section'),code=el('article','cc-card'),facts=el('article','cc-card');
    code.appendChild(el('h2','','קוד היוצר שלך'));
    var codeBox=el('div','cc-code-display');
    codeBox.appendChild(el('span','cc-code-value',c.code));
    var copy=el('button','cc-copy','העתקת קוד');copy.type='button';
    copy.addEventListener('click',async function(){try{await navigator.clipboard.writeText(c.code);copy.textContent='הועתק ✓';}catch(_){copy.textContent=c.code;}});
    codeBox.appendChild(copy);code.appendChild(codeBox);
    code.appendChild(el('p','cc-footnote',c.discountPercent>0?'הלקוחות שלך מקבלים '+c.discountPercent+'% הנחה כשהם משתמשים בקוד. המכירות נספרות רק אחרי אישור תשלום.':'הקוד משמש לשיוך רכישות אליך. לא ניתנת הנחה אוטומטית אלא אם האדמין הגדיר אחת.'));
    facts.appendChild(el('h2','','פרטי החשבון והדוח'));
    facts.appendChild(fact('שם היוצר',c.name));
    facts.appendChild(fact('התקופה המוצגת',options[range]));
    if(range==='payment')facts.appendChild(fact('תאריכי תקופת התשלום',periodText(c.periodStartAt,c.periodEndExclusive)));
    facts.appendChild(fact('הנחה ללקוחות',integer(c.discountPercent)+'%'));
    facts.appendChild(fact('עמלה נוכחית',integer(c.commissionPercent)+'%'));
    facts.appendChild(fact('סטטוס הקוד','פעיל'));
    sec.append(code,facts);app.appendChild(sec);
    purchases();
  }

  function creatorVideosSection(){
    var section=el('section','cc-leaderboard cc-video-section');
    var top=el('div','cc-leader-top');top.appendChild(el('h2','','סרטוני TikTok ותשלום לפי צפיות'));
    top.appendChild(el('span','','בדיקה יומית ב־23:59 · שעון ישראל'));section.appendChild(top);
    var inner=el('div','cc-video-inner');
    inner.appendChild(el('p','cc-video-info','הדבק קישור לסרטון מחשבון ה־TikTok שהוגדר לך באדמין. המערכת תאמת את שם המשתמש דרך Apify לפני קבלת הסרטון. התשלום מחושב לפי התעריף שסוכם איתך ורק לאחר אישור.'));
    var form=el('form','cc-video-form');
    var url=el('input');url.type='url';url.required=true;url.placeholder='https://www.tiktok.com/@username/video/...';url.dir='ltr';url.maxLength=350;url.setAttribute('aria-label','קישור לסרטון TikTok');
    var submit=el('button','cc-video-button','הוספת סרטון');submit.type='submit';form.append(url,submit);
    var message=el('div','cc-video-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    form.addEventListener('submit',async function(event){
      event.preventDefault();submit.disabled=true;message.classList.remove('is-error');message.textContent='בודקים דרך Apify שהסרטון שייך לחשבון שלך...';
      try {
        var response=await fetch('/api/creators/videos',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.value})});
        var data=await response.json().catch(function(){return {error:'invalid_server_response'};});
        if(!response.ok){
          var code=String(data.error||'unknown');
          var errors={
            invalid_tiktok_video_url:'יש להדביק קישור מלא של סרטון TikTok, לא קישור מקוצר.',
            video_already_registered:'הסרטון הזה כבר רשום במערכת.',
            daily_submission_limit:'ניתן לשלוח עד 8 סרטונים ביום.',
            video_limit_reached:'הגעת למגבלת הסרטונים הפעילים.',
            creator_tiktok_profile_required:'צריך להגדיר באדמין שם משתמש TikTok ותעריף לפני העלאת סרטון.',
            video_not_owned_by_creator:'החשבון שפרסם את הסרטון אינו תואם לשם המשתמש שהוגדר לך באדמין.',
            apify_not_configured:'חיבור Apify טרם הוגדר בשרת. יש להגדיר APIFY_API_TOKEN ב־Render.',
            apify_video_not_found:'Apify לא הצליח למצוא את הסרטון. ודא שהוא ציבורי וזמין בטיקטוק.',
            apify_author_missing:'Apify החזיר את הסרטון בלי שם משתמש מאומת של המפרסם. נסה שוב מאוחר יותר.',
            apify_views_missing:'Apify לא החזיר נתון צפיות תקין לסרטון.',
            apify_invalid_result:'Apify החזיר מידע בפורמט לא צפוי. יש לבדוק את ה־Actor.',
            apify_timeout:'בדיקת הסרטון דרך Apify ארכה זמן רב מדי. נסה שוב.',
            apify_unavailable:'Apify אינו זמין כרגע. בדוק שה־Actor פועל ונסה שוב.',
            apify_failed:'חלה שגיאה בבדיקת Apify. נסה שוב מאוחר יותר.',
            apify_http_401:'טוקן Apify אינו תקין. מנהל החנות צריך לבדוק את החיבור.',
            apify_http_402:'נגמר הקרדיט או נדרש תשלום ב־Apify.',
            apify_http_403:'אין הרשאה להריץ את ה־Actor דרך הטוקן שהוגדר.',
            apify_http_404:'ה־Actor של Apify לא נמצא. יש לבדוק את שם ה־Actor.',
            apify_http_429:'Apify הגביל זמנית את כמות הבדיקות. נסה שוב מאוחר יותר.',
            apify_http_408:'Apify לא סיים את הבדיקה בזמן. נסה שוב.',
            invalid_server_response:'השרת החזיר תשובה לא תקינה. נסה שוב מאוחר יותר.',
            video_submission_failed:'אירעה תקלה בשרת בזמן הוספת הסרטון. מנהל האתר יכול לבדוק את השגיאה בלוגים.',
            origin_not_allowed:'הבקשה נחסמה מטעמי אבטחה. רענן את העמוד ונסה שוב.',
            login_required:'צריך להתחבר מחדש לפני הוספת סרטון.',
            contentcreator_required:'למשתמש אין כרגע הרשאת יוצר פעילה.'
          };
          var text=errors[code] || (code.indexOf('apify_http_')===0?'הבדיקה מול Apify נכשלה (HTTP '+code.slice(11)+'). נסה שוב או פנה למנהל.':
            'לא ניתן להוסיף את הסרטון (שגיאה: '+code.replace(/[^a-z0-9_]/gi,'').slice(0,55)+', HTTP '+response.status+').');
          if(data.reference)text+=' · מזהה תקלה: '+String(data.reference).slice(0,12);
          throw new Error(text);
        }
        url.value='';message.textContent='הסרטון נשלח לאישור מנהל ✓';loadCreatorVideos(list,stats);
      }catch(err){message.classList.add('is-error');message.textContent=err.message||'בדיקת הסרטון נכשלה. נסה שוב.';}finally{submit.disabled=false;}
    });
    var stats=el('div','cc-video-stats');var list=el('div','cc-video-list');
    inner.append(form,message,stats,list);section.appendChild(inner);app.appendChild(section);
    loadCreatorVideos(list,stats);
  }
  async function loadCreatorVideos(list,stats){
    var activeTurn=renderCounter;list.textContent='טוענים נתוני סרטונים...';
    try {
      var data=await get('/api/creators/videos?range='+encodeURIComponent(range));
      if(activeTurn!==renderCounter || !list.isConnected)return;
      // Use the SAME server-provided payout boundary as dashboard and leaderboard,
      // not the end of the selected video report range (today/week/all).
      var paymentEnd=Number(data.paymentPeriodEndExclusive);
      if(Number.isFinite(paymentEnd)&&paymentEnd>0){
        viewedPeriodEnd=paymentEnd;
        if(!countdownParts || countdownParts.target!==paymentEnd || !countdownParts.section.isConnected){
          countdown(paymentEnd,false);
          if(countdownParts && countdownParts.section.isConnected){
            app.insertBefore(countdownParts.section,app.firstChild);
          }
        }
      }
      if(data.tiktokUsername){var title=el('p','cc-video-info','חשבון TikTok מאושר: @'+data.tiktokUsername+' · תעריף: '+money(data.viewRatePer1000Agorot)+' ל־1,000 צפיות');stats.replaceChildren(title);}else{stats.replaceChildren(el('p','cc-video-error','מנהל החנות צריך להגדיר לך שם משתמש ותעריף TikTok.'));}
      var totals=el('div','cc-video-totals');
      totals.appendChild(el('span','','צפיות חדשות בתקופה: '+integer(data.totalGainedViews)));
      totals.appendChild(el('strong','','תגמול צפיות בתקופה: '+money(data.totalEarnedAgorot)));
      stats.appendChild(totals);list.replaceChildren();
      if(!data.items.length){list.appendChild(el('p','cc-video-info','עדיין לא נוספו סרטונים.'));return;}
      var labels={pending:'ממתין לאישור',active:'פעיל',paused:'מושהה',rejected:'נדחה'};
      data.items.forEach(function(v){
        var card=el('article','cc-video-item');
        var title=el('a','cc-video-url','צפייה בסרטון TikTok ↗');title.href=v.url;title.target='_blank';title.rel='noopener noreferrer';
        var badge=el('span','cc-video-status cc-video-'+v.status,labels[v.status]||v.status);
        var head=el('div','cc-video-head');head.append(title,badge);card.appendChild(head);
        var vals=el('div','cc-video-facts');
        vals.appendChild(el('span','','סה״כ צפיות במדידה: '+(v.views==null?'ממתין למדידה':integer(v.views))));
        vals.appendChild(el('span','','צפיות חדשות בתקופה: '+integer(v.gainedViews)));
        vals.appendChild(el('span','','תשלום בתקופה: '+money(v.earnedAgorot)));
        vals.appendChild(el('span','','תעריף: '+money(v.ratePer1000Agorot)+' ל־1,000 צפיות'));
        card.appendChild(vals);
        if(v.checkedAt)card.appendChild(el('p','cc-video-timestamp','בדיקה אחרונה: '+new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}).format(new Date(v.checkedAt))));
        if(v.error)card.appendChild(el('p','cc-video-error','הבדיקה האחרונה נכשלה; נתוני התשלום הקיימים נשמרו.'));
        list.appendChild(card);
      });
    }catch(err){if(activeTurn===renderCounter && list.isConnected)list.textContent='לא הצלחנו לטעון את נתוני הסרטונים.';}
  }

  function purchases(){
    var box=el('section','cc-purchases cc-leaderboard'),head=el('div','cc-leader-top');
    var title=el('h2','','הרכישות שהגיעו מהקוד שלך');
    var sub=el('span','','רכישות ששולמו · '+options[range]);
    head.append(title,sub);box.appendChild(head);
    var scroll=el('div','cc-table-scroll'),table=el('table','cc-table cc-orders-table');
    var thead=el('thead'),tr=el('tr');
    ['תאריך רכישה','מספר הזמנה','קוד יוצר','סכום רכישה','העמלה שלך'].forEach(function(label){tr.appendChild(el('th','',label));});
    thead.appendChild(tr);table.appendChild(thead);
    var tbody=el('tbody');table.appendChild(tbody);scroll.appendChild(table);box.appendChild(scroll);
    var state=el('div','cc-purchases-state'), sentinel=el('div','cc-purchases-sentinel');
    var button=el('button','cc-load-more','טעינת רכישות נוספות');button.type='button';button.hidden=true;
    box.append(state,button,sentinel);app.appendChild(box);
    var cursor='',hasMore=true,pending=false,failed=false,turn=renderCounter,reportRange=range;
    function stop(){if(purchaseObserver){purchaseObserver.disconnect();purchaseObserver=null;}}
    async function load(){
      if(pending||!hasMore||turn!==renderCounter)return;
      pending=true;failed=false;button.hidden=true;state.textContent='טוענים רכישות...';
      try{
        var url='/api/creators/purchases?range='+encodeURIComponent(reportRange)+'&limit=15';
        if(cursor)url+='&cursor='+encodeURIComponent(cursor);
        var data=await get(url);
        if(turn!==renderCounter)return;
        (data.orders||[]).forEach(function(item){
          var row=el('tr');
          row.appendChild(el('td','',date(item.paidAt)));
          row.appendChild(el('td','cc-order-ref',item.orderRef));
          var code=el('td');code.appendChild(el('span','cc-code-chip',item.code));row.appendChild(code);
          row.appendChild(el('td','',money(item.amountAgorot)));
          row.appendChild(el('td','cc-order-commission',money(item.commissionAgorot)));
          tbody.appendChild(row);
        });
        hasMore=Boolean(data.hasMore&&data.nextCursor&&data.nextCursor!==cursor);
        cursor=data.nextCursor||'';
        if(!tbody.children.length){scroll.hidden=true;state.textContent='אין רכישות ששולמו בתקופה שבחרת.';}
        else if(!hasMore){state.textContent='הצגת כל '+integer(tbody.children.length)+' הרכישות בתקופה.';}
        else{state.textContent='';}
        if(!hasMore)stop();
      }catch(e){
        if(turn!==renderCounter)return;
        failed=true;stop();state.textContent='לא הצלחנו לטעון רכישות נוספות.';
        button.hidden=false;
      }finally{pending=false;}
    }
    button.addEventListener('click',function(){if(failed){failed=false;if('IntersectionObserver' in window)observe();}load();});
    function observe(){
      if(!('IntersectionObserver' in window)) {button.hidden=false;return;}
      purchaseObserver=new IntersectionObserver(function(entries){
        if(entries.some(function(entry){return entry.isIntersecting;})) load();
      },{rootMargin:'280px 0px'});
      purchaseObserver.observe(sentinel);
    }
    observe();load();
  }
  // The leaderboard receives the next Israel-local payment boundary from the server.
  // Count down to that exact timestamp; no client timezone math is necessary.
  function countdown(periodEndExclusive,isBoard){
    var target=Number(periodEndExclusive);
    if(!Number.isFinite(target)||target<=0){countdownParts=null;return;}
    var section=el('section','cc-countdown');
    section.setAttribute('aria-label',isBoard?'ספירה לאחור לאיפוס הלידרבורד':'ספירה לאחור לסיום תקופת התשלום');
    var title=el('div','cc-countdown-heading');
    title.appendChild(el('span','cc-countdown-eyebrow','תקופת התשלום הנוכחית'));
    title.appendChild(el('h2','',isBoard?'הלידרבורד מתאפס בעוד':'תקופת התשלום מסתיימת בעוד'));
    section.appendChild(title);
    var grid=el('div','cc-countdown-grid');
    var cells=[];
    [['ימים','days'],['שעות','hours'],['דקות','minutes'],['שניות','seconds']].forEach(function(item){
      var cell=el('div','cc-countdown-unit'),number=el('span','cc-countdown-number','00');
      number.setAttribute('aria-hidden','true');
      cell.append(number,el('span','cc-countdown-label',item[0]));
      grid.appendChild(cell);
      cells.push(number);
    });
    section.appendChild(grid);
    var resetDate=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(target));
    section.appendChild(el('p','cc-countdown-footnote',(isBoard?'האיפוס הבא: ':'סיום תקופת התשלום: ')+resetDate+' (שעון ישראל)'));
    app.appendChild(section);
    countdownParts={target:target,cells:cells,section:section};
    updateCountdown();
  }
  function updateCountdown(){
    if(!countdownParts||!countdownParts.section.isConnected)return;
    var seconds=Math.max(0,Math.ceil((countdownParts.target-Date.now())/1000));
    var values=[Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60];
    values.forEach(function(value,index){
      var displayed=String(value).padStart(2,'0');
      if(countdownParts.cells[index].textContent!==displayed)countdownParts.cells[index].textContent=displayed;
    });
    if(seconds===0)refreshAtPeriodBoundary();
  }
  function leaderboard(rows,periodStartAt,periodEndExclusive){
    countdown(periodEndExclusive,true);
    var section=el('section','cc-leaderboard'),heading=el('div','cc-leader-top');
    heading.appendChild(el('h2','','דירוג יוצרי התוכן'));
    heading.appendChild(el('span','','תקופת תשלום · '+periodText(periodStartAt,periodEndExclusive)));section.appendChild(heading);
    section.appendChild(el('p','cc-leader-note','הדירוג מתחיל מחדש בסיום כל תקופת תשלום, אחרי ה־14 וה־28 בחודש. נתוני העבר נשמרים באפשרות ״כל הזמנים״ בדאשבורד.'));
    if(!rows.length){section.appendChild(el('div','cc-empty','אין עדיין יוצרים בדירוג.'));app.appendChild(section);return;}
    var scroll=el('div','cc-table-scroll'),table=el('table','cc-table'),thead=el('thead'),tr=el('tr');
    ['מקום','יוצר תוכן','קוד יוצר','רכישות'].forEach(function(label){tr.appendChild(el('th','',label));});thead.appendChild(tr);table.appendChild(thead);
    var tbody=el('tbody');rows.forEach(function(item,i){
      var row=el('tr');var rankCell=el('td'),rank=el('span','cc-rank'+(i<3?' is-top':''),i+1);rankCell.appendChild(rank);row.appendChild(rankCell);
      row.appendChild(el('td','cc-leader-name',item.name));var cell=el('td');cell.appendChild(el('span','cc-code-chip',item.code));row.appendChild(cell);
      row.appendChild(el('td','cc-sales',integer(item.sales)));tbody.appendChild(row);
    });table.appendChild(tbody);scroll.appendChild(table);section.appendChild(scroll);app.appendChild(section);
  }
  function isLeaderboard(){return location.pathname.replace(/\/$/,'')==='/creators/leaderboard';}
  function isTikTokPage(){return location.pathname.replace(/\/$/,'')==='/creators/tiktok';}
  function updateControls(){
    rangeOptions.querySelectorAll('button[data-range]').forEach(function(button){
      var selected=button.dataset.range===range;
      button.classList.toggle('is-active',selected);
      button.setAttribute('aria-pressed',selected?'true':'false');
    });
    var board=isLeaderboard(),videos=isTikTokPage();
    document.getElementById('tabLeaderboard').classList.toggle('is-active',board);
    document.getElementById('tabTikTok').classList.toggle('is-active',videos);
    document.getElementById('tabDashboard').classList.toggle('is-active',!board&&!videos);
    document.getElementById('tabDashboard').href='/creators/dashboard?range='+encodeURIComponent(range);
    document.getElementById('tabTikTok').href='/creators/tiktok?range='+encodeURIComponent(range);
    document.getElementById('tabLeaderboard').href='/creators/leaderboard';
    document.querySelector('.cc-range').hidden=board;
    document.getElementById('pageSubtitle').textContent=board?'דירוג הרכישות ששולמו בתקופת התשלום הנוכחית. מתחיל מחדש ב־15 וב־29 לחודש (או ב־1 במרץ).':videos?'מעקב צפיות ותגמול לסרטוני TikTok שאושרו על ידי VerSans.':'נתוני המכירות שהגיעו דרך קוד היוצר שלך, לפי התקופה שתבחר.';
  }
  async function render(){
    if(purchaseObserver){purchaseObserver.disconnect();purchaseObserver=null;}
    countdownParts=null;
    updateControls();error.hidden=true;app.replaceChildren(el('div','cc-loading','טוענים נתונים...'));
    var myTurn=++renderCounter,board=isLeaderboard(),videos=isTikTokPage();
    try{
      if(videos){
        // The TikTok tab loads only its creator video API, including the
        // authoritative current payout boundary for the shared countdown.
        if(myTurn!==renderCounter)return;
        viewedPeriodEnd=null;
        app.replaceChildren();creatorVideosSection();return;
      }
      var data=await get(board?'/api/creators/leaderboard':'/api/creators/me?range='+encodeURIComponent(range));
      if(myTurn!==renderCounter)return;
      // The dashboard may show "today", "week" or "all" while its countdown
      // always uses the current payout period. Refresh on whichever boundary
      // occurs first, so the countdown resets without reloading the tab.
      var boundaries=board?[data.periodEndExclusive]:[data.creator.periodEndExclusive,data.creator.paymentPeriodEndExclusive];
      var futureBoundaries=boundaries.map(Number).filter(function(value){return Number.isFinite(value)&&value>0;});
      viewedPeriodEnd=futureBoundaries.length?Math.min.apply(null,futureBoundaries):null;
      app.replaceChildren();if(board)leaderboard(data.leaderboard||[],data.periodStartAt,data.periodEndExclusive);else dashboard(data.creator);
    }catch(e){if(myTurn!==renderCounter)return;if(e.message!=='login_required'){error.textContent=e.message||'שגיאה בטעינת הנתונים';error.hidden=false;}app.replaceChildren();}
  }
  rangeOptions.addEventListener('click',function(event){
    var button=event.target.closest('button[data-range]');
    if(!button||!Object.prototype.hasOwnProperty.call(options,button.dataset.range)||range===button.dataset.range)return;
    range=button.dataset.range;
    var url=new URL(location.href);url.searchParams.set('range',range);
    history.replaceState({},'',url.pathname+url.search+url.hash);
    render();
  });
  // Keep an open tab accurate when a payout period (or day/week) rolls over.
  // Avoid continuous network requests; re-fetch only after the known boundary.
  function refreshAtPeriodBoundary(){
    if(document.visibilityState==='hidden'||viewedPeriodEnd==null)return;
    var now=Date.now();
    // At the reset boundary, re-fetch the new rankings; throttle retries on API failure.
    if(now>=Number(viewedPeriodEnd)&&now-lastBoundaryRefreshAttempt>=15000){
      lastBoundaryRefreshAttempt=now;
      render();
    }
  }
  window.setInterval(function(){updateCountdown();refreshAtPeriodBoundary();},1000);
  document.addEventListener('visibilitychange',function(){updateCountdown();refreshAtPeriodBoundary();});
  window.addEventListener('pageshow',function(){updateCountdown();refreshAtPeriodBoundary();});
  render();
})();
