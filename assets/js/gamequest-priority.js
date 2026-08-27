(() => {
  "use strict";
  if(window.__TASKRING_GAMEQUEST_PRIORITY__) return;
  window.__TASKRING_GAMEQUEST_PRIORITY__ = true;
  if(!window.__TASKRING_GAMEQUEST_V3__){
    console.warn("GameQuest priority layer requires gamequest-v3.js");
    return;
  }

  const PRIORITY_DEFS = {
    must:{rank:0,label:"保底",name:"保底｜忙也建议做",hint:"高价值、低耗时、错过会损失当日/当周收益；累的时候只做这一层。"},
    good:{rank:1,label:"推荐",name:"推荐｜有余力再做",hint:"收益不错，但允许跳过几次；不要为了全勤制造负担。"},
    skip:{rank:2,label:"可摆烂",name:"可摆烂｜安全跳过",hint:"常驻、低边际收益、冲榜或社交类；不做通常没有明显资源损失。"}
  };
  const FILTER_KEY="taskring_gamequest_priority_filter_v1";
  let priorityFilter=["must","good","all"].includes(localStorage.getItem(FILTER_KEY))?localStorage.getItem(FILTER_KEY):"good";

  function cleanPriority(value,fallback="good"){
    const raw=String(value||"").trim().toLowerCase();
    if(["p0","s","core","floor","required","must","保底","必做"].includes(raw))return "must";
    if(["p1","a","recommended","good","推荐","建議","建议"].includes(raw))return "good";
    if(["p2","p3","b","c","optional","skip","casual","可选","可選","摆烂","擺爛","有空"].includes(raw))return "skip";
    return PRIORITY_DEFS[raw]?raw:fallback;
  }
  function priorityRank(task){return PRIORITY_DEFS[cleanPriority(task?.priority,"good")]?.rank??1}
  function priorityVisible(task){
    const rank=priorityRank(task);
    if(priorityFilter==="must")return rank===0;
    if(priorityFilter==="good")return rank<=1;
    return true;
  }
  function sortPriority(tasks){return [...(tasks||[])].sort((a,b)=>priorityRank(a)-priorityRank(b))}
  function rawList(value){return Array.isArray(value)?value:(typeof value==="string"?value.split(/\n+/):[])}
  function rawFor(task,source){
    const list=rawList(source), id=String(task?.id||""), title=String(task?.title||"").trim().toLowerCase();
    return list.find(item=>item&&typeof item==="object"&&id&&String(item.id||"")===id)
      ||list.find(item=>item&&typeof item==="object"&&String(item.title||item.name||"").trim().toLowerCase()===title)
      ||{};
  }
  function copyPriority(task,raw,fallback="good"){
    const out={...task};
    out.priority=cleanPriority(raw?.priority||raw?.tier||raw?.importance||task?.priority,fallback);
    const estimated=Number(raw?.estimated_minutes??raw?.estimatedMinutes??task?.estimated_minutes);
    if(Number.isFinite(estimated)&&estimated>0)out.estimated_minutes=Math.min(480,Math.round(estimated));
    return out;
  }
  function priorityBadge(task){
    const key=cleanPriority(task?.priority,"good"), def=PRIORITY_DEFS[key];
    return `<span class="gameQuestTaskBadge gqPriority ${key}" title="${escapeHtml(def.hint)}">${escapeHtml(def.label)}</span>`;
  }
  function timeBadge(task){
    const mins=Number(task?.estimated_minutes);
    return Number.isFinite(mins)&&mins>0?`<span class="gameQuestTaskBadge gqEffort" title="按最低完成线估算">≈${Math.round(mins)}m</span>`:"";
  }
  function noteHtml(task){
    const note=String(task?.note||"").trim();
    return note?`<small class="gameQuestTaskNote">${escapeHtml(note)}</small>`:"";
  }
  function cleanCadence(value,fallback="weekly"){
    const key=String(value||"").trim().toLowerCase();
    if(key==="periodic")return "cycle";
    if(key==="permanent")return "once";
    return ["weekly","cycle","once","limited"].includes(key)?key:fallback;
  }
  function cadenceBadge(task){
    const cadence=cleanCadence(task?.cadence,"weekly");
    const defs={weekly:["周","随周周期重置"],cycle:["周期","只在新周期重置"],once:["一次","完成后长期保持"],limited:["限时","按活动期限存在"]};
    const [label,hint]=defs[cadence];
    return `<span class="gameQuestTaskBadge gqCadence ${cadence}" title="${escapeHtml(hint)}">${escapeHtml(label)}</span>`;
  }
  function taskScopeCycle(task,weeklyCycle=cycleYmd){
    const cadence=cleanCadence(task?.cadence,"weekly");
    if(cadence==="weekly")return weeklyCycle;
    const identity=String(task?.cycle_key||task?.id||task?.title||"current");
    return `gqv3-${cadence}-${stableHashPart(identity)}`;
  }

  // ----- Preserve priority + minimum-effort metadata through normalization -----
  const baseNormalizeTaskList=normalizeGameQuestTaskList;
  normalizeGameQuestTaskList=function(value,context="scheduled"){
    const fallback=context==="weekly"?"good":"must";
    return baseNormalizeTaskList(value,context).map(task=>copyPriority(task,rawFor(task,value),fallback));
  };

  const baseTaskStore=gameQuestTaskStoreList;
  gameQuestTaskStoreList=function(value,context="scheduled"){
    const stored=baseTaskStore(value,context), normalized=normalizeGameQuestTaskList(value,context);
    return stored.map((item,index)=>{
      const task=normalized.find(t=>String(t.id)===String(item.id))||normalized[index]||{};
      return {...item,priority:cleanPriority(task.priority,context==="weekly"?"good":"must"),...(Number.isFinite(Number(task.estimated_minutes))?{estimated_minutes:Number(task.estimated_minutes)}:{})};
    });
  };

  const baseNormalizeConfig=normalizeGameQuestConfig;
  normalizeGameQuestConfig=function(config){
    const normalized=baseNormalizeConfig(config);
    const rawFocus=config&&typeof config==="object"?config.focus:null;
    if(normalized.focus&&rawFocus&&typeof rawFocus==="object"){
      normalized.focus={...normalized.focus,priority:cleanPriority(rawFocus.priority||"skip","skip")};
      const mins=Number(rawFocus.estimated_minutes??rawFocus.estimatedMinutes);
      if(Number.isFinite(mins)&&mins>0)normalized.focus.estimated_minutes=Math.round(mins);
    }
    return {...normalized,version:4};
  };

  const baseBuildDaily=buildGameQuestDailyByGame;
  buildGameQuestDailyByGame=function(cfg){
    const map=baseBuildDaily(cfg);
    [1,2,3,4,5,6,0].forEach(day=>{
      const dayObj=cfg?.schedule?.[String(day)]||{};
      Object.entries(dayObj).forEach(([gameId,items])=>{
        normalizeGameQuestTaskList(items,"scheduled").forEach(task=>{
          const target=(map[gameId]||[]).find(entry=>String(entry.id||"")===String(task.id||"")||String(entry.title||"").trim()===String(task.title||"").trim());
          if(!target)return;
          target.priority=cleanPriority(task.priority,"must");
          if(Number.isFinite(Number(task.estimated_minutes)))target.estimated_minutes=Number(task.estimated_minutes);
        });
      });
    });
    return map;
  };

  applyDailyByGameToSchedule=function(cfg){
    const schedule={};
    [1,2,3,4,5,6,0].forEach(day=>{schedule[String(day)]={}});
    (cfg.games||[]).forEach(game=>{
      const list=(cfg.dailyByGame&&cfg.dailyByGame[game.id])||[], seen=new Set();
      list.forEach(task=>{
        const title=String(task.title||"").trim(),url=normalizeFitnessUrl(task.url||task.link||""),note=String(task.note||"").trim();
        const days=Array.isArray(task.days)?[...new Set(task.days.map(Number))].filter(d=>[0,1,2,3,4,5,6].includes(d)):[];
        if(!title||!days.length)return;
        const sig=title.toLowerCase();if(seen.has(sig))return;seen.add(sig);
        const plan_mode=days.length>=7?"daily":"scheduled";
        days.forEach(day=>{
          const key=String(day);if(!schedule[key][game.id])schedule[key][game.id]=[];
          const item={id:task.id,title,url,plan_mode,priority:cleanPriority(task.priority,"must")};
          if(note)item.note=note;
          if(Number.isFinite(Number(task.estimated_minutes))&&Number(task.estimated_minutes)>0)item.estimated_minutes=Math.round(Number(task.estimated_minutes));
          schedule[key][game.id].push(item);
        });
      });
    });
    cfg.schedule=schedule;
  };

  const baseWeeklyEditorTasksFor=gameQuestWeeklyEditorTasksFor;
  gameQuestWeeklyEditorTasksFor=function(gameId,cfg=gameQuestDraftConfig){
    const base=baseWeeklyEditorTasksFor(gameId,cfg),raw=cfg?.weekly?.[gameId]||[];
    return base.map(task=>copyPriority(task,rawFor(task,raw),"good"));
  };

  // ----- Editor: priority and minimum-time fields -----
  function priorityOptions(current){
    const selected=cleanPriority(current,"good");
    return Object.entries(PRIORITY_DEFS).map(([key,def])=>`<option value="${key}" ${selected===key?"selected":""}>${escapeHtml(def.name)}</option>`).join("");
  }
  const baseDailyRowHtml=gameQuestDailyRowHtml;
  gameQuestDailyRowHtml=function(gameId,t,idx,total){
    let html=baseDailyRowHtml(gameId,t,idx,total);
    const fields=`<label class="gqPriorityEditor"><span>层级</span><select class="gqTaskPriority">${priorityOptions(t.priority||"must")}</select></label><label class="gqPriorityEditor"><span>最低预计分钟</span><input class="gqTaskEstimated" type="number" min="1" max="480" step="1" value="${Number.isFinite(Number(t.estimated_minutes))?Math.round(Number(t.estimated_minutes)):""}" placeholder="例如 5"></label>`;
    if(html.includes('<label class="gqV3NoteField"'))return html.replace('<label class="gqV3NoteField"',`${fields}<label class="gqV3NoteField"`);
    return html.replace('</div>\n    <div class="gqDayPicker"',`${fields}</div>\n    <div class="gqDayPicker"`);
  };
  const baseWeeklyRowHtml=gameQuestWeeklyRowHtml;
  gameQuestWeeklyRowHtml=function(gameId,t,idx,total){
    let html=baseWeeklyRowHtml(gameId,t,idx,total);
    const fields=`<label class="gqPriorityEditor"><span>层级</span><select class="gqTaskPriority">${priorityOptions(t.priority||"good")}</select></label><label class="gqPriorityEditor"><span>最低预计分钟</span><input class="gqTaskEstimated" type="number" min="1" max="480" step="1" value="${Number.isFinite(Number(t.estimated_minutes))?Math.round(Number(t.estimated_minutes)):""}" placeholder="例如 20"></label>`;
    if(html.includes('<div class="gqV3MetaFields">'))return html.replace('<div class="gqV3MetaFields">',`<div class="gqV3MetaFields">${fields}`);
    return html;
  };

  const baseCollect=collectGameQuestEditorState;
  collectGameQuestEditorState=function(){
    baseCollect();
    document.querySelectorAll("[data-gq-daily-game]").forEach(card=>{
      const gid=card.dataset.gqDailyGame,rows=[...card.querySelectorAll("[data-gq-daily-row]")],items=gameQuestDraftConfig?.dailyByGame?.[gid]||[];
      rows.forEach((row,index)=>{
        const item=items[index];if(!item)return;
        item.priority=cleanPriority(row.querySelector('.gqTaskPriority')?.value||item.priority||"must","must");
        const mins=Number(row.querySelector('.gqTaskEstimated')?.value);if(Number.isFinite(mins)&&mins>0)item.estimated_minutes=Math.round(mins);else delete item.estimated_minutes;
      });
    });
    document.querySelectorAll("[data-gq-weekly-edit-game]").forEach(card=>{
      const gid=card.dataset.gqWeeklyEditGame,rows=[...card.querySelectorAll("[data-gq-weekly-row]")],items=gameQuestDraftConfig?.weekly?.[gid]||[];
      rows.forEach((row,index)=>{
        const item=items[index];if(!item)return;
        item.priority=cleanPriority(row.querySelector('.gqTaskPriority')?.value||item.priority||"good","good");
        const mins=Number(row.querySelector('.gqTaskEstimated')?.value);if(Number.isFinite(mins)&&mins>0)item.estimated_minutes=Math.round(mins);else delete item.estimated_minutes;
      });
    });
    applyDailyByGameToSchedule(gameQuestDraftConfig);
  };

  // ----- Filter the execution board by energy level -----
  const baseDailyObjectsFor=gameQuestTaskObjectsFor;
  gameQuestTaskObjectsFor=function(gameId,dayId,cfg=gameQuestConfig){
    return sortPriority(baseDailyObjectsFor(gameId,dayId,cfg)).filter(priorityVisible);
  };
  const baseWeeklyVisibleFor=gameQuestWeeklyTasksFor;
  gameQuestWeeklyTasksFor=function(gameId,cfg=gameQuestConfig){
    return sortPriority(baseWeeklyVisibleFor(gameId,cfg)).filter(priorityVisible);
  };

  gameQuestTaskListHtml=function(gameId,dayId,tasks){
    const sorted=sortPriority(tasks);
    return `<ul class="gameQuestTaskList gameQuestTaskListV2">${sorted.map((t,idx)=>{const done=isGameQuestItemDone(gameId,dayId,t.id,cycleYmd),url=safeUrl(t.url);return `<li class="${done?"done":""}" data-gq-priority="${cleanPriority(t.priority,"must")}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(gameId)}" data-gamequest-item-day="${dayId}" data-gamequest-item="${escapeHtml(t.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><span class="gqV3TaskCopy"><span class="gqPriorityTitle"><i>${escapeHtml(t.title)}</i>${priorityBadge(t)}${timeBadge(t)}</span>${noteHtml(t)}</span>${gameQuestTaskBadge(t)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer">打开 ↗</a>`:""}</div></li>`}).join("")}</ul>`;
  };
  gameQuestWeeklyTaskListHtml=function(gameId,tasks){
    const sorted=sortPriority(tasks);
    return `<ul class="gameQuestTaskList gameQuestTaskListV2 weekly">${sorted.map((t,idx)=>{const effective=taskScopeCycle(t,cycleYmd),done=isGameQuestWeeklyItemDone(gameId,t.id,cycleYmd),url=safeUrl(t.url);return `<li class="${done?"done":""}" data-gq-priority="${cleanPriority(t.priority,"good")}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-weekly-item-btn="1" data-gamequest-weekly-game="${escapeHtml(gameId)}" data-gamequest-weekly-item="${escapeHtml(t.id)}" data-cycle="${escapeHtml(effective)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><span class="gqV3TaskCopy"><span class="gqPriorityTitle"><i>${escapeHtml(t.title)}</i>${priorityBadge(t)}${timeBadge(t)}</span>${noteHtml(t)}</span>${cadenceBadge(t)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer">打开 ↗</a>`:""}</div></li>`}).join("")}</ul>`;
  };

  function allTasksForCurrentBoard(){
    const games=enabledGameQuestGames(gameQuestConfig),rows=[];
    if(gameQuestBoardMode==="today"){
      games.forEach(game=>baseDailyObjectsFor(game.id,gameQuestSelectedDay,gameQuestConfig).forEach(task=>rows.push({game,task,done:isGameQuestItemDone(game.id,gameQuestSelectedDay,task.id,cycleYmd)})));
    }else{
      games.forEach(game=>baseWeeklyVisibleFor(game.id,gameQuestConfig).forEach(task=>rows.push({game,task,done:isGameQuestWeeklyItemDone(game.id,task.id,cycleYmd)})));
    }
    return rows;
  }
  function prioritySummary(){
    const rows=allTasksForCurrentBoard();
    const stats={must:{done:0,total:0},good:{done:0,total:0},skip:{done:0,total:0}};
    rows.forEach(row=>{const key=cleanPriority(row.task.priority,gameQuestBoardMode==="today"?"must":"good");stats[key].total++;if(row.done)stats[key].done++;});
    return stats;
  }
  function priorityToolbarHtml(){
    const s=prioritySummary(),mustDone=s.must.total>0&&s.must.done>=s.must.total;
    const label=gameQuestBoardMode==="today"?"今日":"当前区";
    const status=mustDone?`${label}保底已完成，可以收工 😌`:`${label}保底 ${s.must.done}/${s.must.total}`;
    return `<div class="gqPriorityCommand"><div class="gqPriorityStatus"><strong>${escapeHtml(status)}</strong><span>推荐 ${s.good.done}/${s.good.total} · 可摆烂 ${s.skip.total} 项${priorityFilter==="all"?"":"（默认隐藏）"}</span></div><div class="gqPriorityFilters" role="group" aria-label="游戏任务层级筛选"><button type="button" class="${priorityFilter==="must"?"active":""}" data-gq-priority-filter="must">只做保底</button><button type="button" class="${priorityFilter==="good"?"active":""}" data-gq-priority-filter="good">推荐模式</button><button type="button" class="${priorityFilter==="all"?"active":""}" data-gq-priority-filter="all">全部任务</button></div></div>`;
  }

  const baseRenderPanel=renderGameQuestPanel;
  renderGameQuestPanel=function(){
    baseRenderPanel();
    const panel=document.getElementById('gameQuestPanel');if(!panel)return;
    const tabs=panel.querySelector('.gameQuestModeTabs');
    if(tabs&&!panel.querySelector('.gqPriorityCommand'))tabs.insertAdjacentHTML('afterend',priorityToolbarHtml());
    const completeDay=panel.querySelector('[data-gq-complete-day]');
    if(completeDay&&priorityFilter!=="all")completeDay.hidden=true;
    const meta=panel.querySelector('.gameQuestMetaStrip span');
    if(meta&&gameQuestBoardMode==="today")meta.textContent=priorityFilter==="must"?'低能量模式：今天只显示真正的保底线':'按层级排序：先保底，再推荐；“可摆烂”默认不占你的注意力';
  };

  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-gq-priority-filter]');if(!btn)return;
    event.preventDefault();event.stopPropagation();
    priorityFilter=["must","good","all"].includes(btn.dataset.gqPriorityFilter)?btn.dataset.gqPriorityFilter:"good";
    localStorage.setItem(FILTER_KEY,priorityFilter);
    renderGameQuestPanel();
  },true);

  const style=document.createElement('style');
  style.textContent=`
    .gqPriorityTitle{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.gqPriorityTitle i{min-width:0}.gqPriority.must{background:#fff0c7;border-color:#e3bd4d;color:#6d5100}.gqPriority.good{background:#eaf4ff;border-color:#a9cce9;color:#234f72}.gqPriority.skip{background:#f1f0ed;border-color:#d8d4cb;color:#716d66}.gqEffort{background:#f8f7f2;color:#6f6a60}.gqPriorityCommand{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:10px 0 14px;padding:11px 13px;border:1px solid var(--line,#d9d4c8);border-radius:14px;background:color-mix(in srgb,var(--paper,#fff) 92%,#ffe56b 8%)}.gqPriorityStatus{display:flex;flex-direction:column;gap:2px}.gqPriorityStatus strong{font-size:14px}.gqPriorityStatus span{font-size:12px;color:var(--muted,#746f66)}.gqPriorityFilters{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.gqPriorityFilters button{border:1px solid var(--line,#d9d4c8);background:var(--paper,#fff);border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer}.gqPriorityFilters button.active{background:#171714;color:#fff;border-color:#171714}.gqPriorityEditor{display:flex;flex-direction:column;gap:5px;font-size:12px}.gqPriorityEditor select,.gqPriorityEditor input{border:1px solid var(--line,#d9d4c8);border-radius:10px;padding:9px 10px;background:var(--paper,#fff)}@media(max-width:680px){.gqPriorityCommand{align-items:stretch;flex-direction:column}.gqPriorityFilters{justify-content:stretch}.gqPriorityFilters button{flex:1;white-space:nowrap}.gqPriorityTitle{gap:4px}.gqPriorityTitle .gameQuestTaskBadge{font-size:10px}}
  `;
  document.head.appendChild(style);

  try{
    if(gameQuestConfig){gameQuestConfig=normalizeGameQuestConfig(gameQuestConfig);if(taskConfig)taskConfig.gameQuest=gameQuestConfig;}
    renderGameQuestPanel();
  }catch(error){console.warn('GameQuest priority enhancement skipped',error)}
})();
