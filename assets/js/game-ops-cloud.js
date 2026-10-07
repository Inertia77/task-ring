(function(){
  'use strict';
  const C=window.TaskRingOpsCore,config=window.TaskRingOpsConfig;
  const client=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'taskring-gameops-auth-v1'}});
  const PAGE=25,PREFIX='taskring-gameops-cache-v1:';
  let user=null,rows=[],archive=[],filter='',reason='',history=false,page=0,hasMore=false;
  let status='同步中',error='',busy=false,authReady=false,manualOpen=false,mutationId=null,loaded=false,request=0,lastSync=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={UPCOMING:'即将开放',ACTIVE:'进行中',ENDING_SOON:'即将结束',EXPIRED:'已截止 · 待归档',DONE:'已完成',SKIP:'不做',EXPIRED_REASON:'已过期',REPLACED:'已替代',INVALID:'无效',TO_VERIFY:'待核验',ESTIMATED:'估算时间',CONFIRMED:'已确认'};
  const date=v=>v?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v))+' JST':'待核验';
  const precise=(value,day)=>value?date(value):day?esc(day)+'（时刻待核验）':'待核验';
  const archiveKey=()=>PREFIX+user.id+':archive:'+filter+':'+reason+':'+page;
  function cacheGet(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
  function cachePut(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{error='本机存储已满，离线缓存未更新';}}
  function restore(){
    if(!user)return;
    const active=cacheGet(PREFIX+user.id+':active');rows=active?.rows||[];lastSync=active?.at||null;
    const old=cacheGet(archiveKey());archive=old?.rows||[];hasMore=!!old?.hasMore;
  }
  function render(){const el=document.getElementById('gameOpsCloud');if(el)el.innerHTML=html();}
  function selected(k,v){return k===v?' selected':'';}
  function options(){return Object.entries(C.games).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('');}
  function card(t){
    const s=history?'ARCHIVED':C.state(t),end=C.deadline(t),pending=mutationId===t.id,disabled=!user||!navigator.onLine||pending;
    const verify=t.verification!=='CONFIRMED'?'<span class="opsTag uncertain">'+esc(labels[t.verification])+'</span>':'';
    const source=/^https?:\/\//i.test(t.source_url||'')?'<a href="'+esc(t.source_url)+'" target="_blank" rel="noopener noreferrer">查看来源 ↗</a>':'来源尚未确认';
    return '<article class="opsCard '+(s==='ENDING_SOON'||s==='EXPIRED'?'urgent':'')+'" data-ops-card="'+esc(t.id)+'"><div class="opsCardHead"><span class="opsGame">'+esc(C.games[t.game])+'</span>'+verify+(t.priority==='HIGH'?'<span class="opsTag">优先</span>':'')+'</div><h3>'+esc(t.task_name)+'</h3><div class="opsMeta"><b>'+esc(history?(t.archive_reason==='EXPIRED'?'已过期':labels[t.archive_reason]):labels[s])+'</b><span>'+ (t.task_type==='RECURRING'?'周期':'限时')+' · '+(t.server==='GLOBAL'?'国际服':'国服')+(t.period?' · '+esc(t.period):'')+'</span></div><p class="opsDeadline">'+(history?'归档 '+date(t.archived_at):'截止 '+precise(end,t.deadline_date))+'</p>'+(t.open_at||t.open_date?'<p class="opsWindow">开始 '+precise(t.open_at,t.open_date)+'</p>':'')+'<details class="opsDetails"><summary>详情 / 来源</summary><div>'+source+'<p>核验：'+esc(labels[t.verification])+' · 来源：'+esc(t.source_level||'未标注')+'</p>'+(t.gameplay_end_at?'<p>游玩截止 '+date(t.gameplay_end_at)+'</p>':'')+(t.claim_end_at?'<p>领取截止 '+date(t.claim_end_at)+'</p>':'')+'<p class="opsNotes">'+esc(t.notes||'暂无备注')+'</p><small>最近核验 '+precise(t.last_verified_at,t.last_verified_date)+'</small><label class="opsPriority">优先级 <select aria-label="'+esc(t.task_name)+'优先级" data-ops-priority="'+esc(t.id)+'" '+(disabled?'disabled':'')+'>'+['HIGH','NORMAL','LOW'].map(v=>'<option value="'+v+'"'+selected(t.priority,v)+'>'+({HIGH:'High',NORMAL:'Normal',LOW:'Low'}[v])+'</option>').join('')+'</select></label></div></details>'+(!history?'<div class="opsActions"><button type="button" data-ops-action="DONE" data-id="'+esc(t.id)+'" '+(disabled?'disabled':'')+'>✓ 完成</button><button type="button" data-ops-action="SKIP" data-id="'+esc(t.id)+'" '+(disabled?'disabled':'')+'>不做</button>'+(pending?'<small>同步中</small>':!navigator.onLine?'<small>联网后可操作</small>':'')+'</div>':'')+'</article>';
  }
  function manualForm(){return '<form class="opsForm" data-ops-manual><h3>补一条任务</h3><label>游戏<select name="game">'+options()+'</select></label><label>任务名<input name="task_name" maxlength="240" required></label><label>类型<select name="task_type"><option value="LIMITED_TIME">限时</option><option value="RECURRING">周期</option></select></label><label>Period<input name="period" maxlength="160" placeholder="版本 / 期次"></label><label>开始（JST）<input name="open_at" type="datetime-local"></label><label>截止（JST）<input name="deadline_at" type="datetime-local"></label><label class="opsFormWide">备注<textarea name="notes" rows="2" maxlength="10000"></textarea></label><div class="opsFormWide opsActions"><button '+(busy?'disabled':'')+'>保存任务</button><button type="button" data-ops-toggle-manual>取消</button></div><small class="opsFormWide">手动补充默认标记为待核验，可由每日维护补充官方来源。</small></form>';}
  function html(){
    if(!authReady)return '<div class="opsEmpty" role="status">正在恢复登录会话…</div>';
    if(!user)return '<div class="opsLogin"><div><span class="opsEyebrow">LIMITED / RECURRING</span><h3>登录后查看限时・周期任务</h3><p>使用已有 Supabase 账号。登录会话会保存在这台设备。</p></div><form data-ops-login><label>邮箱<input name="email" type="email" autocomplete="username" required></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><button '+(busy?'disabled':'')+'>登录</button></form>'+(error?'<p class="opsError" role="alert">'+esc(error)+'</p>':'')+'</div>';
    const chips='<nav class="opsFilters" aria-label="限时周期游戏筛选">'+[['','全部'],...Object.entries(C.games)].map(([id,name])=>'<button type="button" data-ops-filter="'+id+'" aria-pressed="'+(filter===id)+'" class="'+(filter===id?'active':'')+'">'+name+'</button>').join('')+'</nav>';
    let content='';
    if(history){content='<div class="opsArchiveFilter"><label>归档原因 <select data-ops-reason><option value="">全部</option>'+['DONE','SKIP','EXPIRED','REPLACED','INVALID'].map(v=>'<option value="'+v+'"'+selected(reason,v)+'>'+({DONE:'Done · 完成',SKIP:'Skip · 不做',EXPIRED:'Expired · 过期',REPLACED:'Replaced · 替代',INVALID:'Invalid · 无效'}[v])+'</option>').join('')+'</select></label><span>最近归档 · 第 '+(page+1)+' 页</span></div><div class="opsGrid">'+archive.map(card).join('')+'</div><div class="opsPagination"><button type="button" data-ops-page="-1" '+(page===0||busy?'disabled':'')+'>上一页</button><button type="button" data-ops-page="1" '+(!hasMore||busy?'disabled':'')+'>下一页</button></div>';}
    else {const visible=rows.filter(t=>!filter||t.game===filter);const g=C.groups(visible);content=Object.entries(g).filter(([,list])=>list.length).map(([s,list])=>'<section class="opsGroup"><h2>'+labels[s]+' <small>'+list.length+'</small></h2><div class="opsGrid">'+list.map(card).join('')+'</div></section>').join('');}
    if(!(history?archive.length:rows.filter(t=>!filter||t.game===filter).length))content='<div class="opsEmpty">'+(busy?'正在同步任务…':history?'这一页没有归档记录。':loaded?'当前没有待办任务。':'尚无任务缓存，联网后刷新。')+'</div>'+(history?content:'');
    return '<div class="opsToolbar"><div class="opsSync" role="status"><i class="'+(status==='已同步'?'ok':status==='同步失败'?'fail':'')+'"></i>'+status+(lastSync?'<small>最近 '+date(lastSync)+'</small>':'')+'</div><div class="opsTools"><button type="button" data-ops-refresh '+(busy?'disabled':'')+'>刷新</button><button type="button" data-ops-history>'+ (history?'当前任务':'历史')+'</button><button type="button" data-ops-toggle-manual '+(!navigator.onLine?'disabled':'')+'>＋ 补任务</button><button type="button" data-ops-logout aria-label="退出 Supabase 登录">退出</button></div></div>'+chips+(error?'<p class="opsError" role="alert">'+esc(error)+'</p>':'')+(manualOpen?manualForm():'')+content;
  }
  async function fetchTasks(){
    if(!user||busy||!navigator.onLine){if(!navigator.onLine){status='离线缓存';render();}return;}
    busy=true;status='同步中';error='';const token=++request,uid=user.id;render();
    try{
      let fetched=[],offset=0;
      if(history){let q=client.from('game_ops_tasks').select('*').eq('user_id',uid).not('archived_at','is',null).order('archived_at',{ascending:false}).order('id',{ascending:false});if(filter)q=q.eq('game',filter);if(reason)q=q.eq('archive_reason',reason);const {data,error:e}=await q.range(page*PAGE,page*PAGE+PAGE);if(e)throw e;fetched=data;}
      else {do{const {data,error:e}=await client.from('game_ops_tasks').select('*').eq('user_id',uid).is('archived_at',null).order('deadline_at',{ascending:true,nullsFirst:false}).order('id',{ascending:true}).range(offset,offset+199);if(e)throw e;fetched.push(...data);if(data.length<200)break;offset+=200;}while(true);}
      if(token!==request||user?.id!==uid)return;
      lastSync=new Date().toISOString();
      if(history){hasMore=fetched.length>PAGE;archive=fetched.slice(0,PAGE);cachePut(archiveKey(),{rows:archive,hasMore,at:lastSync});}
      else{rows=fetched;loaded=true;cachePut(PREFIX+uid+':active',{rows,at:lastSync});}
      status='已同步';
    }catch(e){if(token===request){status=navigator.onLine?'同步失败':'离线缓存';error=navigator.onLine?'同步失败：'+(e.message||e)+ '。保留最近缓存，可点击刷新重试。':'';}}
    finally{if(token===request){busy=false;render();}}
  }
  async function mutate(id,patch){
    if(!navigator.onLine){status='离线缓存';error='当前离线，操作未提交；联网后请重试。';render();return;}
    if(mutationId)return;
    mutationId=id;error='';let confirmed=false;render();
    try{
      const {data,error:e}=await client.from('game_ops_tasks').update(patch).eq('id',id).eq('user_id',user.id).select('*').single();if(e)throw e;
      if(patch.user_action&&data.user_action!==patch.user_action)throw new Error('服务器状态回读不一致');
      rows=rows.filter(t=>t.id!==id);if(!data.archived_at)rows.push(data);archive=archive.map(t=>t.id===id?data:t);
      cachePut(PREFIX+user.id+':active',{rows,at:new Date().toISOString()});
      // Invalidate paginated history caches after a confirmed mutation.
      for(const key of Object.keys(localStorage))if(key.startsWith(PREFIX+user.id+':archive:'))localStorage.removeItem(key);
      status='已同步';confirmed=true;
    }catch(e){status='同步失败';error='操作未确认：'+(e.message||e)+'。任务保留，请联网刷新后重试。';}
    finally{mutationId=null;render();}
    if(confirmed)await fetchTasks();
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-ops-action],[data-ops-filter],[data-ops-history],[data-ops-page],[data-ops-refresh],[data-ops-toggle-manual],[data-ops-logout]');if(!b)return;
    e.preventDefault();
    if(b.hasAttribute('data-ops-action')){await mutate(b.dataset.id,{user_action:b.dataset.opsAction,archive_reason:b.dataset.opsAction,lifecycle_status:'ARCHIVED'});return;}
    if(b.hasAttribute('data-ops-toggle-manual')){manualOpen=!manualOpen;render();return;}
    if(b.hasAttribute('data-ops-logout')){const uid=user?.id;const {error:e}=await client.auth.signOut({scope:'local'});if(e){error=e.message;render();return;}for(const key of Object.keys(localStorage))if(key.startsWith(PREFIX+uid+':'))localStorage.removeItem(key);return;}
    if(b.hasAttribute('data-ops-filter')){filter=b.dataset.opsFilter;page=0;}
    if(b.hasAttribute('data-ops-history')){history=!history;page=0;manualOpen=false;}
    if(b.hasAttribute('data-ops-page'))page+=Number(b.dataset.opsPage);
    request++;busy=false;restore();render();await fetchTasks();
  });
  document.addEventListener('change',async e=>{
    if(e.target.matches('[data-ops-priority]'))await mutate(e.target.dataset.opsPriority,{priority:e.target.value});
    if(e.target.matches('[data-ops-reason]')){reason=e.target.value;page=0;request++;busy=false;restore();render();await fetchTasks();}
  });
  document.addEventListener('submit',async e=>{
    const f=e.target;if(!f.matches('[data-ops-login],[data-ops-manual]'))return;e.preventDefault();if(busy)return;
    const values=Object.fromEntries(new FormData(f));busy=true;error='';f.querySelector('button').disabled=true;
    try{
      if(f.matches('[data-ops-login]')){const {error:e}=await client.auth.signInWithPassword({email:values.email,password:values.password});if(e)throw e;f.reset();}
      else{if(!navigator.onLine)throw new Error('离线时无法提交任务');const payload=C.manual(values,user.id,crypto.randomUUID());const {data,error:e}=await client.from('game_ops_tasks').insert(payload).select('*').single();if(e)throw e;if(data.task_key!==payload.task_key)throw new Error('服务器回读不一致');manualOpen=false;rows.push(data);cachePut(PREFIX+user.id+':active',{rows,at:new Date().toISOString()});}
    }catch(e){error=e.message||String(e);status='同步失败';}
    finally{busy=false;if(error){f.querySelector('button').disabled=false;let err=f.parentElement.querySelector('.opsError');if(!err){err=document.createElement('p');err.className='opsError';err.setAttribute('role','alert');f.after(err);}err.textContent=error;}else{render();await fetchTasks();}}
  });
  client.auth.onAuthStateChange((_event,session)=>{
    const next=session?.user||null,changed=next?.id!==user?.id;
    user=next;authReady=true;
    if(changed){request++;busy=false;rows=[];archive=[];loaded=false;page=0;lastSync=null;if(user)restore();}
    status=navigator.onLine?'同步中':'离线缓存';render();
    // Supabase recommends leaving the auth callback before issuing queries.
    if(user)setTimeout(fetchTasks,0);
  });
  client.auth.getSession().then(({data,error:e})=>{authReady=true;if(e)error=e.message;user=data.session?.user||null;if(user)restore();render();return fetchTasks();}).catch(e=>{authReady=true;error=e.message;render();});
  addEventListener('offline',()=>{request++;busy=false;status='离线缓存';error='';render();});
  addEventListener('online',fetchTasks);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)fetchTasks();});
  setInterval(()=>{if(!document.hidden&&!manualOpen&&!mutationId)fetchTasks();},60000);
  window.TaskRingGameOpsCloud={html,refresh:fetchTasks};
})();
