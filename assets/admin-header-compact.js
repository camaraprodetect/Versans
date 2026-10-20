(function(){
  'use strict';
  function init(){
    const bar=document.querySelector('.admin-header__actions');
    if(!bar||document.getElementById('adminHeaderMore'))return;
    const wrapper=document.createElement('div');wrapper.className='admin-header-more';
    const trigger=document.createElement('button');trigger.type='button';trigger.id='adminHeaderMore';
    trigger.className='admin-header-more__trigger';trigger.setAttribute('aria-haspopup','true');
    trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','adminHeaderMorePanel');
    trigger.innerHTML='<span aria-hidden="true">⋯</span><span class="admin-header-more__label">עוד כלים</span>';
    const panel=document.createElement('div');panel.className='admin-header-more__panel';panel.id='adminHeaderMorePanel';panel.hidden=true;
    const items=[
      ['adminThemeToggle','עיצוב כהה / בהיר'],['adminDisplaySettings','התאמה אישית'],
      ['adminUndoLast','ביטול פעולה אחרונה'],['adminPushToggle','התראות Push'],
      ['adminRefresh','רענון נתונים'],[null,'מעבר לחנות'],[null,'סטטוס החנות']
    ];
    for(const [id,label] of items){
      const node=id?document.getElementById(id):label==='מעבר לחנות'?bar.querySelector('.admin-site-link'):bar.querySelector('.admin-live');
      if(!node)continue;
      const row=document.createElement('div');row.className='admin-header-more__item';
      if(id)node.title=node.title||label;
      if(node.classList.contains('admin-live'))row.classList.add('is-status');
      if(id==='adminRefresh'){const tag=document.createElement('span');tag.textContent='רענן נתונים';node.appendChild(tag);}
      if(id==='adminPushToggle'){row.hidden=Boolean(node.hidden);const observer=new MutationObserver(()=>{row.hidden=Boolean(node.hidden)});observer.observe(node,{attributes:true,attributeFilter:['hidden']});}
      row.appendChild(node);panel.appendChild(row);
    }
    wrapper.append(trigger,panel);bar.appendChild(wrapper);
    function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');wrapper.classList.remove('is-open');}
    trigger.addEventListener('click',function(){const willOpen=panel.hidden;panel.hidden=!willOpen;trigger.setAttribute('aria-expanded',String(willOpen));wrapper.classList.toggle('is-open',willOpen);});
    document.addEventListener('pointerdown',e=>{if(!wrapper.contains(e.target))close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();trigger.focus();}});
    panel.addEventListener('click',e=>{if(e.target.closest('button,a'))close();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
