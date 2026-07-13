(function(){
  "use strict";

  let selectedDay=today;
  let draftConfig=null;
  let initialized=false;

  function dayConfig(dayId,cfg=fitnessConfig){
    const normalized=normalizeFitnessConfig(cfg||defaultFitnessConfig);
    return normalized.days[String(Number(dayId))]||{training:[],nutrition:[]};
  }
  function doneKey(dayId,kind,itemId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_fitness_d${Number(dayId)}_${kind}_${itemId}`}
  function isItemDone(dayId,kind,itemId,cycle=cycleYmd){return localStorage.getItem(doneKey(dayId,kind,itemId,cycle))==="1"}
  function itemsForDay(dayId,cfg=fitnessConfig){
    const data=dayConfig(dayId,cfg);
    return [
      ...data.training.map(item=>({...item,kind:"training"})),
      ...data.nutrition.map(item=>({...item,kind:"nutrition"}))
    ];
  }
  function dayStats(dayId,cfg=fitnessConfig){
    const items=itemsForDay(dayId,cfg);
    const done=items.filter(item=>isItemDone(dayId,item.kind,item.id)).length;
    return {done,total:items.length,pct:items.length?Math.round(done/items.length*100):0};
  }
  function setItemDone(dayId,kind,itemId,value,sourceEl){
    syncSetItem(doneKey(dayId,kind,itemId),value);
    if(value&&sourceEl&&typeof playCompletionEffect==="function"){
      const stats=dayStats(dayId);
      playCompletionEffect({level:stats.total&&stats.done===stats.total?"parent":"micro",category:"life",anchor:sourceEl,title:stats.total&&stats.done===stats.total?"训练饮食计划完成":"健康项目完成",eventId:`fitness:${cycleYmd}:${dayId}:${kind}:${itemId}`});
    }
    renderAll();
  }
  function fitnessTimerKey(dayId,cycle=cycleYmd){return `fitness:fitness-training:${cycle}:d${Number(dayId)}`}
  function fitnessLogs(){return readTimeLogs().filter(log=>log.kind==="fitness"||log.task_id==="fitness-training")}
  function fitnessWeekMinutes(){return fitnessLogs().filter(isLogInCurrentCycle).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)}
  function startFitnessTimer(dayId=selectedDay,cycle=cycleYmd){
    const normalizedDay=Number.isFinite(Number(dayId))?Number(dayId):today;
    const active=readActiveTimer();
    const key=fitnessTimerKey(normalizedDay,cycle);
    if(active){
      if(activeTimerKey(active)===key){showToast(active.paused?"训练计时已暂停，可点继续":"训练区正在计时","warn");return}
      const ok=confirm(`当前正在计时：${active.title}（${fmtTimer(activeTimerElapsedSeconds(active))}）。\n\n要先完成并记录它，然后开始「训练区」吗？`);
      if(!ok)return;
      completeActiveTimer(true);
    }
    const now=new Date().toISOString();
    writeActiveTimer({
      kind:"fitness",
      task_id:"fitness-training",
      task_code:"fitness-board",
      day_id:normalizedDay,
      cycle,
      title:`训练区｜${dayName(normalizedDay)}`,
      category:"body",
      estimated_minutes:60,
      first_started_at:now,
      started_at:now,
      accumulated_seconds:0,
      paused:false,
      paused_at:null
    });
    showToast("开始计时：训练区","ok",1300);
    renderAll();
  }
  function openFitnessTimeDetail(){
    const all=fitnessLogs().sort(timeLogSortDesc);
    const week=all.filter(isLogInCurrentCycle);
    const todayLogs=all.filter(isLogToday);
    const active=readActiveTimer();
    const activeMinutes=active?.kind==="fitness"?Math.max(1,Math.round(activeTimerElapsedSeconds(active)/60)):0;
    const used=week.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeMinutes;
    const todayUsed=todayLogs.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeMinutes;
    const allUsed=all.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeMinutes;
    const lines=week.slice(0,20).map(log=>`<li><span>${fmtLogWhen(log)} · ${escapeHtml(log.title)}${timeLogSourceLabel(log)}</span><b>${fmtMinutes(log.duration_minutes)}</b><button type="button" data-time-log-delete="${escapeHtml(log.id)}">删除</button></li>`).join("")||`<li class="empty"><span>本周还没有训练区记录</span><b>0m</b></li>`;
    const body=`<button type="button" class="timeDetailAddButton" data-manual-time-entry="fitness">+手动补记训练时间</button><div class="timeDetailStats"><div><span>今日</span><b>${fmtMinutes(todayUsed)}</b></div><div><span>本周</span><b>${fmtMinutes(used)}</b></div><div><span>累计</span><b>${fmtMinutes(allUsed)}</b></div></div><div class="timeDetailProgress" style="--w:${used?100:0}%"><div><span>统计方式</span><b>训练区整体计时${activeMinutes?` · 当前 ${fmtMinutes(activeMinutes)}`:""}</b></div><i></i></div><ul class="timeDetailLogs">${lines}</ul>`;
    openTimeDetailModal("训练区",body);
  }
  function itemHtml(item,dayId){
    const done=isItemDone(dayId,item.kind,item.id);
    const kindName=item.kind==="training"?"训练":"饮食";
    return `<button type="button" class="fitnessItem ${done?"done":""}" data-fitness-item="${escapeHtml(item.id)}" data-fitness-kind="${item.kind}" data-fitness-item-day="${dayId}" aria-pressed="${done?"true":"false"}"><span class="fitnessCheck">${done?"✓":""}</span><span><strong>${escapeHtml(item.title)}</strong>${item.note?`<small>${escapeHtml(item.note)}</small>`:""}</span><em>${kindName}</em></button>`;
  }
  function laneHtml(kind,title,items,dayId){
    const done=items.filter(item=>isItemDone(dayId,kind,item.id)).length;
    return `<section class="fitnessLane fitnessLane-${kind}"><header class="fitnessLaneHead"><div><span>${kind==="training"?"TRAINING":"NUTRITION"}</span><b>${title}</b></div><em>${done}/${items.length}</em></header><div class="fitnessItems">${items.length?items.map(item=>itemHtml({...item,kind},dayId)).join(""):`<div class="fitnessEmpty">${kind==="training"?"当天没有安排训练项目":"当天没有安排饮食项目"}</div>`}</div></section>`;
  }
  function renderFitnessPanel(){
    const panel=document.getElementById("fitnessPanel");
    if(!panel)return;
    const data=dayConfig(selectedDay);
    const stats=dayStats(selectedDay);
    const active=readActiveTimer();
    const fitnessActive=active?.kind==="fitness";
    const timerLabel=fitnessActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时";
    const timerSub=fitnessActive?(active.paused?"已暂停":"训练计时中"):`本周 ${fmtMinutes(fitnessWeekMinutes())}`;
    const tabs=[1,2,3,4,5,6,0].map(day=>{
      const s=dayStats(day);
      return `<button type="button" class="fitnessDayTab ${day===selectedDay?"active":""} ${day===today?"today":""}" data-fitness-day="${day}" aria-pressed="${day===selectedDay?"true":"false"}">${escapeHtml(dayName(day))}<span>${s.done}/${s.total}</span></button>`;
    }).join("");
    panel.innerHTML=`<header class="fitnessHero"><div><span class="fitnessEyebrow">BODY / DAILY PLAN</span><h2>训练与饮食</h2><p>${escapeHtml(dayName(selectedDay))}${selectedDay===today?" · 今日":""}｜按既定计划执行，训练和饮食分别确认。</p></div><div class="fitnessHeroSide"><div class="fitnessProgressRing" style="--fitness-progress:${stats.pct}%"><b>${stats.pct}%</b></div><button type="button" class="fitnessTimerBtn ${fitnessActive?"active":""}" data-fitness-timer title="把训练区作为一个整体记录时间"><span>${fitnessActive?(active.paused?"Ⅱ":"◷"):"◷"}</span><b ${fitnessActive?"data-live-timer":""}>${timerLabel}</b><em>${timerSub}</em></button><button type="button" class="fitnessManualBtn" data-manual-time-entry="fitness" title="补记忘记开始的训练时间">+补记</button><button type="button" class="fitnessTodayBtn ${selectedDay===today?"active":""}" data-fitness-today>今日</button><button type="button" class="fitnessEditBtn" data-open-fitness-editor>编辑计划</button></div></header><nav class="fitnessDayTabs" aria-label="训练饮食星期切换">${tabs}</nav><div class="fitnessBoard">${laneHtml("training","训练计划",data.training,selectedDay)}${laneHtml("nutrition","饮食计划",data.nutrition,selectedDay)}</div>`;
  }

  function editorLog(message){
    const el=document.getElementById("fitnessEditorLog");
    if(el)el.textContent=`[${new Date().toLocaleTimeString()}] ${message}\n`+el.textContent.slice(0,2500);
  }
  function itemsToText(items){return (items||[]).map(item=>`${item.title}${item.note?` | ${item.note}`:""}`).join("\n")}
  function parseEditorText(value,kind){
    const entries=String(value||"").split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const split=line.split(/\s*\|\s*/,2);
      return {title:split[0]||"",note:split[1]||""};
    });
    return normalizeFitnessItemList(entries,kind);
  }
  function renderFitnessEditor(){
    const list=document.getElementById("fitnessEditorList");
    if(!list)return;
    const cfg=normalizeFitnessConfig(draftConfig||fitnessConfig||defaultFitnessConfig);
    list.innerHTML=`<div class="fitnessEditorGrid">${[1,2,3,4,5,6,0].map(day=>{
      const data=cfg.days[String(day)]||{training:[],nutrition:[]};
      return `<section class="fitnessDayEditor ${day===today?"today":""}" data-fitness-editor-day="${day}"><header class="fitnessDayEditorHead"><b>${escapeHtml(dayName(day))}</b><span>${data.training.length} 训练 · ${data.nutrition.length} 饮食</span></header><div class="fitnessEditorFields"><div class="fitnessEditorField"><label>训练项目（一行一个）</label><textarea data-fitness-training placeholder="示例：全身基础训练 30 分钟\n项目 | 可选备注">${escapeHtml(itemsToText(data.training))}</textarea></div><div class="fitnessEditorField"><label>饮食项目（一行一个）</label><textarea data-fitness-nutrition placeholder="示例：准备均衡三餐\n项目 | 可选备注">${escapeHtml(itemsToText(data.nutrition))}</textarea></div></div></section>`;
    }).join("")}</div>`;
    editorLog("已加载训练饮食计划。每行一个项目，可用“项目 | 备注”。");
  }
  function collectFitnessEditor(){
    if(!draftConfig)draftConfig=normalizeFitnessConfig(fitnessConfig||defaultFitnessConfig);
    const days={};
    document.querySelectorAll("[data-fitness-editor-day]").forEach(card=>{
      const day=String(Number(card.dataset.fitnessEditorDay));
      days[day]={
        training:parseEditorText(card.querySelector("[data-fitness-training]")?.value,"training"),
        nutrition:parseEditorText(card.querySelector("[data-fitness-nutrition]")?.value,"nutrition")
      };
    });
    draftConfig=normalizeFitnessConfig({...draftConfig,days,updatedAt:new Date().toISOString()});
    return draftConfig;
  }
  function openFitnessEditor(){
    closeControlCenter();
    closeGhModal();
    draftConfig=deepClone(fitnessConfig||normalizeFitnessConfig(defaultFitnessConfig));
    renderFitnessEditor();
    const modal=document.getElementById("fitnessEditorModal");
    modal?.classList.remove("hidden");
    modal?.setAttribute("aria-hidden","false");
  }
  function closeFitnessEditor(){
    const modal=document.getElementById("fitnessEditorModal");
    modal?.classList.add("hidden");
    modal?.setAttribute("aria-hidden","true");
    document.body.classList.remove("modalOpen");
    window.dispatchEvent(new CustomEvent("taskring:modal-closed"));
  }
  async function saveFitnessConfig(){
    const btn=document.getElementById("saveFitnessBtn");
    try{
      const shouldSync=!!ghToken();
      setBtnBusy(btn,true,shouldSync?"同步中…":"保存中…");
      const fitness=normalizeFitnessConfig({...collectFitnessEditor(),updatedAt:new Date().toISOString()});
      const base=normalizeTaskConfig(taskConfig||buildDefaultConfig());
      const cfg=normalizeTaskConfig({...base,fitness,updatedAt:new Date().toISOString()});
      saveLocalTaskConfig(cfg,"训练饮食编辑器保存前");
      applyTaskConfig(cfg,true);
      draftConfig=deepClone(fitnessConfig);
      renderFitnessEditor();
      if(shouldSync){
        setGhStatus("GitHub：保存配置中","sync");
        await ghPatchConfig(cfg);
        setGhStatus("GitHub：已同步","on");
        editorLog("训练饮食配置已保存并加密同步。");
        showToast("训练饮食已保存并同步","ok");
      }else{
        editorLog("训练饮食配置已保存到本机。");
        showToast("训练饮食已保存到本机","ok");
      }
    }catch(error){
      console.error(error);
      editorLog("保存失败："+String(error.message||error));
      showToast("训练饮食保存失败","err");
    }finally{setBtnBusy(btn,false)}
  }
  function reloadFitnessConfig(){
    if(!confirm("确认放弃尚未保存的训练饮食修改，并重载当前已保存配置？"))return;
    draftConfig=deepClone(fitnessConfig||normalizeFitnessConfig(defaultFitnessConfig));
    renderFitnessEditor();
    editorLog("已重载当前保存的训练饮食配置。");
  }
  function fitnessImportConfig(value){
    const imported=value&&typeof value==="object"&&!Array.isArray(value)&&Object.prototype.hasOwnProperty.call(value,"fitness")?value.fitness:value;
    if(!imported||typeof imported!=="object"||Array.isArray(imported)||!imported.days||typeof imported.days!=="object"||Array.isArray(imported.days)){
      throw new Error("训练饮食 JSON 必须包含 days 对象");
    }
    return normalizeFitnessConfig(imported);
  }
  function exportFitnessConfig(){
    const cfg=collectFitnessEditor();
    const payload={...cfg,section:"fitness"};
    navigator.clipboard?.writeText(JSON.stringify(payload,null,2)).then(()=>{editorLog("训练饮食 JSON 已复制，不包含其他配置分区。");showToast("训练饮食 JSON 已复制","ok")}).catch(()=>{editorLog(JSON.stringify(payload,null,2));showToast("复制失败，已输出到日志","warn")});
  }
  function importFitnessConfig(){
    const raw=prompt("粘贴训练饮食 JSON：支持独立 fitness JSON 或旧版完整 taskring-config.json；只会导入训练饮食配置。");
    if(!raw)return;
    try{
      draftConfig=fitnessImportConfig(JSON.parse(raw));
      renderFitnessEditor();
      editorLog("训练饮食导入成功；其他配置分区未改动，保存后生效。");
      showToast("训练饮食已导入，记得保存","ok");
    }catch(error){editorLog("导入失败："+String(error.message||error));showToast("训练饮食 JSON 不合法","err")}
  }
  function initFitnessUI(){
    if(initialized)return;
    initialized=true;
    document.getElementById("fitnessEditorCloseBtn")?.addEventListener("click",closeFitnessEditor);
    document.getElementById("fitnessEditorBottomCloseBtn")?.addEventListener("click",closeFitnessEditor);
    document.getElementById("saveFitnessBtn")?.addEventListener("click",saveFitnessConfig);
    document.getElementById("fitnessEditorBottomSaveBtn")?.addEventListener("click",saveFitnessConfig);
    document.getElementById("reloadFitnessBtn")?.addEventListener("click",reloadFitnessConfig);
    document.getElementById("exportFitnessBtn")?.addEventListener("click",exportFitnessConfig);
    document.getElementById("importFitnessBtn")?.addEventListener("click",importFitnessConfig);
    document.body.addEventListener("click",event=>{
      const open=event.target.closest("#controlFitnessEditorBtn,[data-open-fitness-editor]");
      if(open){event.preventDefault();event.stopPropagation();openFitnessEditor();return}
      const dayBtn=event.target.closest("[data-fitness-day]");
      if(dayBtn){event.preventDefault();selectedDay=Number(dayBtn.dataset.fitnessDay);renderFitnessPanel();return}
      const todayBtn=event.target.closest("[data-fitness-today]");
      if(todayBtn){event.preventDefault();selectedDay=today;renderFitnessPanel();return}
      const timerBtn=event.target.closest("[data-fitness-timer]");
      if(timerBtn){event.preventDefault();const active=readActiveTimer();if(active?.kind==="fitness"&&active.paused)resumeActiveTimer();else if(active?.kind==="fitness")showToast("训练区正在计时","warn");else startFitnessTimer(selectedDay);return}
      const detailBtn=event.target.closest("[data-time-fitness-detail]");
      if(detailBtn){event.preventDefault();event.stopPropagation();openFitnessTimeDetail();return}
      const itemBtn=event.target.closest("[data-fitness-item]");
      if(itemBtn){event.preventDefault();const next=itemBtn.getAttribute("aria-pressed")!=="true";setItemDone(Number(itemBtn.dataset.fitnessItemDay),itemBtn.dataset.fitnessKind,itemBtn.dataset.fitnessItem,next,itemBtn);return}
      if(event.target.id==="fitnessEditorModal")closeFitnessEditor();
    });
    document.addEventListener("keydown",event=>{
      if(event.key!=="Escape"||document.getElementById("fitnessEditorModal")?.classList.contains("hidden"))return;
      event.preventDefault();event.stopImmediatePropagation();closeFitnessEditor();
    },true);
  }

  const coreRenderAll=window.renderAll;
  window.renderAll=function(){const result=coreRenderAll.apply(this,arguments);renderFitnessPanel();return result};
  const coreBoot=window.TaskRingCoreBoot;
  window.TaskRingCoreBoot=function(){const result=coreBoot.apply(this,arguments);initFitnessUI();renderFitnessPanel();return result};
  window.renderFitnessPanel=renderFitnessPanel;
})();
