(() => {
  "use strict";
  if(window.__TASKRING_GAMEQUEST_V3__) return;
  window.__TASKRING_GAMEQUEST_V3__ = true;

  const CADENCE_DEFS = {
    weekly:{label:"周", name:"本周收益", hint:"随 TaskRing 周周期重置。"},
    cycle:{label:"周期", name:"周期任务", hint:"只有 cycle_key 改变时重新开启，不跟周一重置。"},
    once:{label:"一次", name:"常驻推进", hint:"一次性/常驻首通；完成后保持完成，新增内容时换 cycle_key。"},
    limited:{label:"限时", name:"限时任务", hint:"按活动期限存在；完成状态由 cycle_key 区分。"}
  };
  let renderBucket = "";

  function cleanCadence(value, fallback="weekly"){
    const key=String(value||"").trim().toLowerCase();
    if(key==="periodic") return "cycle";
    if(key==="permanent") return "once";
    return CADENCE_DEFS[key]?key:fallback;
  }
  function rawList(value){return Array.isArray(value)?value:(typeof value==="string"?value.split(/\n+/):[])}
  function rawMetaFor(task, source){
    const list=rawList(source);
    const tid=String(task?.id||"");
    const title=String(task?.title||"").trim().toLowerCase();
    let raw=list.find(item=>item&&typeof item==="object"&&tid&&String(item.id||"")===tid);
    if(!raw) raw=list.find(item=>{
      if(!item||typeof item!=="object") return false;
      return String(item.title||item.name||"").trim().toLowerCase()===title;
    });
    return raw&&typeof raw==="object"?raw:{};
  }
  function copyTaskMeta(task, raw, context){
    const out={...task};
    const note=String(raw.note||raw.detail||raw.tip||"").trim();
    if(note) out.note=note.slice(0,900);
    if(context==="weekly" || raw.cadence || raw.reset_scope || raw.resetScope){
      out.cadence=cleanCadence(raw.cadence||raw.reset_scope||raw.resetScope,"weekly");
      const cycleKey=String(raw.cycle_key||raw.cycleKey||"").trim();
      if(cycleKey) out.cycle_key=cycleKey.slice(0,120);
      const dueAt=String(raw.due_at||raw.dueAt||"").trim();
      if(dueAt) out.due_at=dueAt.slice(0,64);
      if(raw.auto_managed===true||raw.autoManaged===true) out.auto_managed=true;
    }
    return out;
  }
  function activeByDate(task){
    if(cleanCadence(task?.cadence,"weekly")!=="limited" || !task?.due_at) return true;
    const ts=Date.parse(task.due_at);
    return !Number.isFinite(ts) || Date.now()<=ts;
  }
  function taskScopeCycle(task, weeklyCycle=cycleYmd){
    const cadence=cleanCadence(task?.cadence,"weekly");
    if(cadence==="weekly") return weeklyCycle;
    const identity=String(task?.cycle_key||task?.id||task?.title||"current");
    return `gqv3-${cadence}-${stableHashPart(identity)}`;
  }
  function cadenceBadge(task){
    const cadence=cleanCadence(task?.cadence,"weekly");
    const def=CADENCE_DEFS[cadence];
    return `<span class="gameQuestTaskBadge gqCadence ${escapeHtml(cadence)}" title="${escapeHtml(def.hint)}">${escapeHtml(def.label)}</span>`;
  }
  function noteHtml(task){
    const note=String(task?.note||"").trim();
    return note?`<small class="gameQuestTaskNote">${escapeHtml(note)}</small>`:"";
  }

  const baseNormalizeTaskList=normalizeGameQuestTaskList;
  normalizeGameQuestTaskList=function(value, context="scheduled"){
    return baseNormalizeTaskList(value,context).map(task=>copyTaskMeta(task,rawMetaFor(task,value),context));
  };

  gameQuestTaskStoreList=function(value,context="scheduled"){
    return normalizeGameQuestTaskList(value,context).map(t=>{
      const out={id:t.id,title:t.title,url:t.url||"",plan_mode:t.plan_mode};
      if(t.note) out.note=t.note;
      if(context==="weekly"||t.cadence){
        out.cadence=cleanCadence(t.cadence,"weekly");
        if(t.cycle_key) out.cycle_key=t.cycle_key;
        if(t.due_at) out.due_at=t.due_at;
        if(t.auto_managed===true) out.auto_managed=true;
      }
      if(Number.isFinite(Number(t.weekly_minutes))) out.weekly_minutes=Number(t.weekly_minutes);
      if(Number.isFinite(Number(t.estimated_minutes))) out.estimated_minutes=Number(t.estimated_minutes);
      return out;
    });
  };

  const baseNormalizeConfig=normalizeGameQuestConfig;
  normalizeGameQuestConfig=function(config){
    const normalized=baseNormalizeConfig(config);
    const focusRaw=config&&typeof config==="object"&&!Array.isArray(config)?config.focus:null;
    const focus=focusRaw&&typeof focusRaw==="object"?{
      id:String(focusRaw.id||"weekly-focus"),
      title:String(focusRaw.title||"自由推进｜本周最多选 1～2 项").trim(),
      note:String(focusRaw.note||"").trim().slice(0,900),
      enabled:focusRaw.enabled!==false
    }:null;
    return {...normalized,version:3,...(focus?{focus}: {})};
  };

  const baseBuildDaily=buildGameQuestDailyByGame;
  buildGameQuestDailyByGame=function(cfg){
    const map=baseBuildDaily(cfg);
    [1,2,3,4,5,6,0].forEach(day=>{
      const dayObj=cfg?.schedule?.[String(day)]||{};
      Object.entries(dayObj).forEach(([gameId,items])=>{
        normalizeGameQuestTaskList(items,"scheduled").forEach(task=>{
          const target=(map[gameId]||[]).find(entry=>String(entry.id||"")===String(task.id||"")||String(entry.title||"").trim()===String(task.title||"").trim());
          if(target&&task.note&&!target.note) target.note=task.note;
        });
      });
    });
    return map;
  };

  applyDailyByGameToSchedule=function(cfg){
    const schedule={};
    [1,2,3,4,5,6,0].forEach(day=>{schedule[String(day)]={}});
    (cfg.games||[]).forEach(g=>{
      const list=(cfg.dailyByGame&&cfg.dailyByGame[g.id])||[];
      const seen=new Set();
      list.forEach(t=>{
        const title=String(t.title||"").trim();
        const url=normalizeFitnessUrl(t.url||t.link||"");
        const note=String(t.note||"").trim();
        const days=Array.isArray(t.days)?[...new Set(t.days.map(Number))].filter(d=>[0,1,2,3,4,5,6].includes(d)):[];
        if(!title||!days.length)return;
        const sig=title.toLowerCase();
        if(seen.has(sig))return;
        seen.add(sig);
        const plan_mode=days.length>=7?"daily":"scheduled";
        days.forEach(day=>{
          const key=String(day);
          if(!schedule[key][g.id])schedule[key][g.id]=[];
          const item={id:t.id,title,url,plan_mode};
          if(note)item.note=note;
          schedule[key][g.id].push(item);
        });
      });
    });
    cfg.schedule=schedule;
  };

  const baseWeeklyEditorTasksFor=gameQuestWeeklyEditorTasksFor;
  gameQuestWeeklyEditorTasksFor=function(gameId,cfg=gameQuestDraftConfig){
    const base=baseWeeklyEditorTasksFor(gameId,cfg);
    const raw=cfg?.weekly?.[gameId]||[];
    return base.map(task=>copyTaskMeta(task,rawMetaFor(task,raw),"weekly"));
  };

  const baseDailyRowHtml=gameQuestDailyRowHtml;
  gameQuestDailyRowHtml=function(gameId,t,idx,total){
    const html=baseDailyRowHtml(gameId,t,idx,total);
    const field=`<label class="gqV3NoteField"><span>备注 / 高效做法</span><textarea class="gqDailyTaskNote" rows="2" placeholder="例如：先领咖啡再刷对应材料；低收益项可跳过">${escapeHtml(t.note||"")}</textarea></label>`;
    return html.replace('</div>\n    <div class="gqDayPicker"',`${field}</div>\n    <div class="gqDayPicker"`);
  };

  const baseWeeklyRowHtml=gameQuestWeeklyRowHtml;
  gameQuestWeeklyRowHtml=function(gameId,t,idx,total){
    const cadence=cleanCadence(t.cadence,"weekly");
    const html=baseWeeklyRowHtml(gameId,t,idx,total);
    const cadenceOptions=Object.entries(CADENCE_DEFS).map(([key,def])=>`<option value="${key}" ${cadence===key?"selected":""}>${escapeHtml(def.name)}</option>`).join("");
    const extras=`<div class="gqV3MetaFields"><label><span>刷新方式</span><select class="gqWeeklyCadence">${cadenceOptions}</select></label><label><span>周期标识（周期/一次/限时时填写）</span><input class="gqWeeklyCycleKey" value="${escapeHtml(t.cycle_key||"")}" placeholder="例如：ww-matrix-s2-stage2"></label><label class="gqV3NoteField"><span>备注 / 高效做法</span><textarea class="gqWeeklyTaskNote" rows="2" placeholder="把最省时间的做法写在这里">${escapeHtml(t.note||"")}</textarea></label></div>`;
    return html.replace('</div>\n    <div class="gqDailyRowOps"',`</div>${extras}\n    <div class="gqDailyRowOps"`);
  };

  collectGameQuestEditorState=function(){
    if(!gameQuestDraftConfig)return;
    if(!gameQuestDraftConfig.weekly)gameQuestDraftConfig.weekly={};
    if(!gameQuestDraftConfig.dailyByGame)gameQuestDraftConfig.dailyByGame={};
    const games=[...document.querySelectorAll("[data-gq-game-row]")].map((row,idx)=>({
      id:row.dataset.gqGameRow||`gq-${idx+1}`,
      name:row.querySelector('.gqMetaName')?.value.trim()||`游戏 ${idx+1}`,
      short:row.querySelector('.gqMetaShort')?.value.trim()||row.querySelector('.gqMetaName')?.value.trim()||`游戏 ${idx+1}`,
      icon:row.querySelector('.gqMetaIcon')?.value.trim()||'GQ',
      accent:row.querySelector('.gqMetaAccent')?.value||'cyan',
      enabled:row.querySelector('.gqMetaEnabled')?.checked!==false
    }));
    if(games.length)gameQuestDraftConfig.games=games;
    document.querySelectorAll("[data-gq-daily-game]").forEach(card=>{
      const gid=card.dataset.gqDailyGame;
      const rows=[...card.querySelectorAll("[data-gq-daily-row]")];
      gameQuestDraftConfig.dailyByGame[gid]=rows.map(row=>({
        id:row.dataset.gqTaskId||"",
        title:row.querySelector(".gqDailyTaskTitle")?.value.trim()||"",
        url:row.querySelector(".gqDailyTaskUrl")?.value.trim()||"",
        note:row.querySelector(".gqDailyTaskNote")?.value.trim()||"",
        days:[...row.querySelectorAll(".gqDayBox:checked")].map(b=>Number(b.value))
      }));
    });
    document.querySelectorAll("[data-gq-weekly-edit-game]").forEach(card=>{
      const id=card.dataset.gqWeeklyEditGame;
      const rows=[...card.querySelectorAll("[data-gq-weekly-row]")];
      gameQuestDraftConfig.weekly[id]=gameQuestTaskStoreList(rows.map(row=>({
        id:row.dataset.gqTaskId||"",
        title:row.querySelector(".gqWeeklyTaskTitle")?.value.trim()||"",
        url:row.querySelector(".gqWeeklyTaskUrl")?.value.trim()||"",
        note:row.querySelector(".gqWeeklyTaskNote")?.value.trim()||"",
        cadence:row.querySelector(".gqWeeklyCadence")?.value||"weekly",
        cycle_key:row.querySelector(".gqWeeklyCycleKey")?.value.trim()||"",
        plan_mode:"weekly"
      })),"weekly");
    });
    applyDailyByGameToSchedule(gameQuestDraftConfig);
  };

  const baseRenderEditor=renderGameQuestEditor;
  renderGameQuestEditor=function(){
    baseRenderEditor();
    const head=[...document.querySelectorAll('.gameQuestWeeklyGroup .gameQuestEditHead b')][0];
    const desc=head?.parentElement?.querySelector('span');
    if(head)head.textContent='本周 / 周期 / 限时任务';
    if(desc)desc.textContent='刷新方式决定完成状态何时重置；周期和一次性任务不会再被周一复活。';
  };

  const baseWeeklyTasksFor=gameQuestWeeklyTasksFor;
  function allWeeklyTasksFor(gameId,cfg=gameQuestConfig){return baseWeeklyTasksFor(gameId,cfg).filter(activeByDate)}
  gameQuestWeeklyTasksFor=function(gameId,cfg=gameQuestConfig){
    const all=allWeeklyTasksFor(gameId,cfg);
    const bucket=renderBucket||(gameQuestBoardMode==="cycle"?"cycle":"weekly");
    return all.filter(task=>bucket==="cycle"?cleanCadence(task.cadence,"weekly")!=="weekly":cleanCadence(task.cadence,"weekly")==="weekly");
  };

  const baseIsWeeklyItemDone=isGameQuestWeeklyItemDone;
  isGameQuestWeeklyItemDone=function(gameId,itemId,cycle=cycleYmd){
    const task=allWeeklyTasksFor(gameId,gameQuestConfig).find(t=>String(t.id)===String(itemId));
    return baseIsWeeklyItemDone(gameId,itemId,task?taskScopeCycle(task,cycle):cycle);
  };
  gameQuestWeeklyEntryState=function(gameId,cfg=gameQuestConfig,cycle=cycleYmd){
    const tasks=gameQuestWeeklyTasksFor(gameId,cfg);
    const done=tasks.filter(t=>isGameQuestWeeklyItemDone(gameId,t.id,cycle)).length;
    return {tasks,done,total:tasks.length,cardDone:tasks.length>0&&done>=tasks.length};
  };

  setGameQuestWeeklyItemDone=function(gameId,itemId,val,sourceEl=null,cycle=cycleYmd){
    const tasks=gameQuestWeeklyTasksFor(gameId,gameQuestConfig);
    const task=allWeeklyTasksFor(gameId,gameQuestConfig).find(t=>String(t.id)===String(itemId));
    const effective=task?taskScopeCycle(task,cycle):cycle;
    const cardWasDone=gameQuestWeeklyEntryState(gameId,gameQuestConfig,cycle).cardDone;
    syncSetItem(gameQuestWeeklyItemKey(gameId,itemId,effective),val);
    const allDone=tasks.length?tasks.every(t=>isGameQuestWeeklyItemDone(gameId,t.id,cycle)):false;
    if(tasks.every(t=>cleanCadence(t.cadence,"weekly")==="weekly")) syncSetItem(gameQuestWeeklyDoneKey(gameId,cycle),allDone);
    if(val&&sourceEl){
      const game=gameQuestConfig.games.find(g=>String(g.id)===String(gameId));
      playCompletionEffect({level:allDone&&!cardWasDone?"parent":"micro",category:"gamecreate",anchor:sourceEl,title:allDone?`${game?.name||"游戏"} 当前区完成`:"游戏项目完成",eventId:`gqv3:${effective}:${gameId}:${itemId}`});
    }
    renderAll();
  };
  setGameQuestWeeklyDone=function(gameId,val,sourceEl=null,cycle=cycleYmd){
    const tasks=gameQuestWeeklyTasksFor(gameId,gameQuestConfig);
    tasks.forEach(t=>syncSetItem(gameQuestWeeklyItemKey(gameId,t.id,taskScopeCycle(t,cycle)),val));
    if(tasks.every(t=>cleanCadence(t.cadence,"weekly")==="weekly")) syncSetItem(gameQuestWeeklyDoneKey(gameId,cycle),val);
    if(val&&sourceEl)playCompletionEffect({level:"parent",category:"gamecreate",anchor:sourceEl,title:"当前游戏任务完成",eventId:`gqv3-card:${cycle}:${gameId}:${gameQuestBoardMode}`});
    renderAll();
  };

  gameQuestTaskListHtml=function(gameId,dayId,tasks){
    return `<ul class="gameQuestTaskList gameQuestTaskListV2">${tasks.map((t,idx)=>{const done=isGameQuestItemDone(gameId,dayId,t.id,cycleYmd),url=safeUrl(t.url);return `<li class="${done?"done":""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(gameId)}" data-gamequest-item-day="${dayId}" data-gamequest-item="${escapeHtml(t.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><span class="gqV3TaskCopy"><i>${escapeHtml(t.title)}</i>${noteHtml(t)}</span>${gameQuestTaskBadge(t)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer">打开 ↗</a>`:""}</div></li>`}).join("")}</ul>`;
  };
  gameQuestWeeklyTaskListHtml=function(gameId,tasks){
    return `<ul class="gameQuestTaskList gameQuestTaskListV2 weekly">${tasks.map((t,idx)=>{const effective=taskScopeCycle(t,cycleYmd),done=isGameQuestWeeklyItemDone(gameId,t.id,cycleYmd),url=safeUrl(t.url);return `<li class="${done?"done":""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-weekly-item-btn="1" data-gamequest-weekly-game="${escapeHtml(gameId)}" data-gamequest-weekly-item="${escapeHtml(t.id)}" data-cycle="${escapeHtml(effective)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><span class="gqV3TaskCopy"><i>${escapeHtml(t.title)}</i>${noteHtml(t)}</span>${cadenceBadge(t)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer">打开 ↗</a>`:""}</div></li>`}).join("")}</ul>`;
  };

  function bucketEntries(bucket){
    return enabledGameQuestGames(gameQuestConfig).map(game=>{
      const tasks=allWeeklyTasksFor(game.id,gameQuestConfig).filter(t=>bucket==="cycle"?cleanCadence(t.cadence,"weekly")!=="weekly":cleanCadence(t.cadence,"weekly")==="weekly");
      const done=tasks.filter(t=>isGameQuestWeeklyItemDone(game.id,t.id,cycleYmd)).length;
      return {game,tasks,done,total:tasks.length,cardDone:tasks.length>0&&done>=tasks.length};
    }).filter(e=>e.tasks.length);
  }
  function bucketStats(bucket){
    const entries=bucketEntries(bucket);const total=entries.reduce((s,e)=>s+e.total,0),done=entries.reduce((s,e)=>s+e.done,0);
    return {entries,total,done,pct:total?Math.round(done/total*100):100};
  }
  function focusKey(){const f=gameQuestConfig?.focus;return `${GH_PREFIX}${cycleYmd}_gqfocus_${f?.id||"weekly-focus"}`}
  function renderFocusCard(){
    const f=gameQuestConfig?.focus;
    if(!f||f.enabled===false||!String(f.title||"").trim())return "";
    const done=localStorage.getItem(focusKey())==="1";
    return `<article class="gameQuestCard gqV3Focus ${done?"done":""}"><div class="gameQuestCardHead"><div class="gameQuestCardIdentity"><span class="gameQuestCardIcon">◎</span><div><b>自由推进</b><em>本周只选最高价值的 1～2 项</em></div></div></div><div class="gameQuestCardBody"><ul class="gameQuestTaskList gameQuestTaskListV2 weekly"><li class="${done?"done":""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-focus-btn aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">01</span><span class="gameQuestMiniBox"></span><span class="gqV3TaskCopy"><i>${escapeHtml(f.title)}</i>${noteHtml(f)}</span><span class="gameQuestTaskBadge gqCadence focus">聚焦</span></button></div></li></ul></div></article>`;
  }

  const baseRenderPanel=renderGameQuestPanel;
  renderGameQuestPanel=function(){
    const requested=gameQuestBoardMode;
    if(requested==="cycle"){
      renderBucket="cycle";
      gameQuestBoardMode="week";
      baseRenderPanel();
      gameQuestBoardMode="cycle";
      renderBucket="";
    }else{
      renderBucket=requested==="week"?"weekly":"";
      baseRenderPanel();
      renderBucket="";
    }
    const panel=document.getElementById("gameQuestPanel");if(!panel)return;
    const tabs=panel.querySelector('.gameQuestModeTabs');
    const weekBtn=tabs?.querySelector('[data-gamequest-board-mode="week"]');
    if(weekBtn){weekBtn.querySelector('span').textContent='本周收益';const s=bucketStats('weekly');weekBtn.querySelector('b').textContent=`${s.done}/${s.total}`;weekBtn.classList.toggle('active',requested==='week');}
    const cyc=bucketStats('cycle');
    if(tabs&&!tabs.querySelector('[data-gamequest-board-mode="cycle"]')){
      const btn=document.createElement('button');btn.type='button';btn.className=`gameQuestModeBtn ${requested==='cycle'?'active':''}`;btn.dataset.gamequestBoardMode='cycle';btn.innerHTML=`<span>周期 / 限时</span><b>${cyc.done}/${cyc.total}</b>`;tabs.appendChild(btn);
    }
    if(requested==='cycle'){
      panel.querySelectorAll('[data-gamequest-board-mode]').forEach(b=>b.classList.toggle('active',b.dataset.gamequestBoardMode==='cycle'));
      const meta=panel.querySelector('.gameQuestMetaStrip span');if(meta)meta.textContent='周期高难 / 常驻推进 / 限时：不跟周一重置，只有新周期或新增内容才重新出现';
      const sub=panel.querySelector('.gameQuestSubHead > span');if(sub&&String(gameQuestWeeklyFilter||'all')==='all')sub.textContent='周期 / 限时';
      const pane=panel.querySelector('.gameQuestWeeklyPane .gameQuestGrid');if(pane){pane.insertAdjacentHTML('beforeend',renderFocusCard());}
      const meter=panel.querySelector('.gameQuestTopMeter .gameCommandCopy em');if(meter)meter.textContent='周期 / 限时';
    }else if(requested==='week'){
      const meta=panel.querySelector('.gameQuestMetaStrip span');if(meta)meta.textContent='真正按周刷新、错过会损失当周资源的任务';
      const sub=panel.querySelector('.gameQuestSubHead > span');if(sub&&String(gameQuestWeeklyFilter||'all')==='all')sub.textContent='本周收益';
    }
  };

  setGameQuestBoardMode=function(mode){
    gameQuestBoardMode=mode==="week"?"week":mode==="cycle"?"cycle":"today";
    localStorage.setItem(GQ_BOARD_MODE_KEY,gameQuestBoardMode);
    renderGameQuestPanel();
  };

  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-gq-focus-btn]');if(!btn)return;
    event.preventDefault();event.stopPropagation();
    const next=btn.getAttribute('aria-pressed')!=="true";
    syncSetItem(focusKey(),next);renderAll();
  },true);

  const style=document.createElement('style');
  style.textContent=`
    .gqV3TaskCopy{display:flex;min-width:0;flex:1;flex-direction:column;align-items:flex-start;gap:3px;text-align:left}.gqV3TaskCopy i{font-style:normal}.gameQuestTaskNote{display:block;color:var(--muted,#746f66);font-size:12px;font-weight:500;line-height:1.45;text-decoration:none;white-space:normal}.done .gameQuestTaskNote{opacity:.68}.gqCadence.cycle{background:#e8f3ff}.gqCadence.once{background:#efeafb}.gqCadence.limited{background:#fff0dc}.gqCadence.focus{background:#fff4b8}.gqV3NoteField{grid-column:1/-1}.gqV3NoteField textarea,.gqV3MetaFields textarea{width:100%;resize:vertical;min-height:56px}.gqV3MetaFields{display:grid;grid-template-columns:minmax(140px,.55fr) minmax(180px,1fr);gap:10px;margin-top:10px}.gqV3MetaFields .gqV3NoteField{grid-column:1/-1}.gqV3MetaFields label{display:flex;flex-direction:column;gap:5px;font-size:12px}.gqV3MetaFields input,.gqV3MetaFields select,.gqV3MetaFields textarea{border:1px solid var(--line,#d9d4c8);border-radius:10px;padding:9px 10px;background:var(--paper,#fff)}.gqV3Focus{border-style:dashed}@media(max-width:680px){.gqV3MetaFields{grid-template-columns:1fr}.gqV3MetaFields .gqV3NoteField{grid-column:auto}.gameQuestTaskNote{font-size:11px}}
  `;
  document.head.appendChild(style);

  // Re-normalize once so metadata imported before this module loaded becomes visible immediately.
  try{
    if(gameQuestConfig){gameQuestConfig=normalizeGameQuestConfig(gameQuestConfig);if(taskConfig)taskConfig.gameQuest=gameQuestConfig;}
    renderGameQuestPanel();
  }catch(error){console.warn('GameQuest v3 enhancement skipped',error)}
})();
