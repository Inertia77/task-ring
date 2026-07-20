(function(){
  "use strict";

  let selectedDay=today;
  let draftConfig=null;
  let initialized=false;
  let editorItemCounter=0;

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
  function setLaneDone(dayId,kind,value,sourceEl){
    const items=dayConfig(dayId)?.[kind]||[];
    items.forEach(item=>syncSetItem(doneKey(dayId,kind,item.id),value));
    if(value&&sourceEl&&items.length&&typeof playCompletionEffect==="function"){
      const stats=dayStats(dayId);
      playCompletionEffect({level:stats.total&&stats.done===stats.total?"parent":"task",category:"life",anchor:sourceEl,title:kind==="training"?"训练计划全部完成":"饮食计划全部完成",eventId:`fitness-lane:${cycleYmd}:${dayId}:${kind}`});
    }
    showToast(value?(kind==="training"?"训练项目已全部完成":"饮食项目已全部完成"):(kind==="training"?"已取消全部训练完成状态":"已取消全部饮食完成状态"),value?"ok":"warn",1300);
    renderAll();
  }
  function openFitnessItemUrl(value){
    const url=normalizeFitnessUrl(value);
    if(!url){showToast("链接格式不正确，请检查网址","err");return}
    try{
      const opened=window.open("about:blank","_blank");
      if(opened){opened.opener=null;opened.location.replace(url);return}
    }catch(error){console.warn("训练饮食链接新窗口打开失败",error)}
    showToast("新窗口被拦截，已在当前页面打开","warn",1800);
    window.location.assign(url);
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
    const note=String(item.note||"").trim();
    const url=normalizeFitnessUrl(item.url,item.note);
    const actions=note||url?`<div class="fitnessItemActions">${note?`<button type="button" class="fitnessItemMetaBtn" data-fitness-toggle-note aria-expanded="false" aria-label="查看备注：${escapeHtml(item.title)}"><span>备注</span><b>i</b></button>`:""}${url?`<button type="button" class="fitnessItemLink" data-fitness-open-url="${escapeHtml(url)}" aria-label="打开链接：${escapeHtml(item.title)}" title="打开链接：${escapeHtml(item.title)}"><span>打开</span> ↗</button>`:""}</div>`:"";
    const notePanel=note?`<div class="fitnessItemNote" data-fitness-note-panel hidden><span>NOTE / 备注</span><p>${escapeHtml(note)}</p></div>`:"";
    return `<article class="fitnessItem ${done?"done":""}"><button type="button" class="fitnessItemToggle" data-fitness-item="${escapeHtml(item.id)}" data-fitness-kind="${item.kind}" data-fitness-item-day="${dayId}" aria-pressed="${done?"true":"false"}"><span class="fitnessCheck">${done?"✓":""}</span><span class="fitnessItemCopy"><strong>${escapeHtml(item.title)}</strong></span><em>${kindName}</em></button>${actions}${notePanel}</article>`;
  }
  function laneHtml(kind,title,items,dayId){
    const done=items.filter(item=>isItemDone(dayId,kind,item.id)).length;
    const allDone=items.length>0&&done===items.length;
    return `<section class="fitnessLane fitnessLane-${kind}"><header class="fitnessLaneHead"><div><span>${kind==="training"?"TRAINING":"NUTRITION"}</span><b>${title}</b></div><div class="fitnessLaneActions"><em>${done}/${items.length}</em><button type="button" class="fitnessLaneAllBtn ${allDone?"done":""}" data-fitness-lane-all="${kind}" data-fitness-lane-day="${dayId}" aria-pressed="${allDone?"true":"false"}" ${items.length?"":"disabled"}><span>${allDone?"✓":""}</span><b>${allDone?"全部已完成":"全部完成"}</b></button></div></header><div class="fitnessItems">${items.length?items.map(item=>itemHtml({...item,kind},dayId)).join(""):`<div class="fitnessEmpty">${kind==="training"?"当天没有安排训练项目":"当天没有安排饮食项目"}</div>`}</div></section>`;
  }
  function revealSelectedDay(tabsEl,smooth=false){
    const activeTab=tabsEl?.querySelector(".fitnessDayTab.active");
    if(!tabsEl||!activeTab)return;
    const padding=8;
    const left=activeTab.offsetLeft;
    const right=left+activeTab.offsetWidth;
    const visibleLeft=tabsEl.scrollLeft;
    const visibleRight=visibleLeft+tabsEl.clientWidth;
    let target=visibleLeft;
    if(left<visibleLeft+padding)target=Math.max(0,left-padding);
    else if(right>visibleRight-padding)target=Math.max(0,right-tabsEl.clientWidth+padding);
    if(Math.abs(target-visibleLeft)>1){
      if(typeof tabsEl.scrollTo==="function")tabsEl.scrollTo({left:target,behavior:smooth?"smooth":"auto"});
      else tabsEl.scrollLeft=target;
    }
  }
  function renderFitnessPanel(options={}){
    const panel=document.getElementById("fitnessPanel");
    if(!panel)return;
    const previousTabs=panel.querySelector(".fitnessDayTabs");
    const previousScrollLeft=Number.isFinite(options.scrollLeft)?options.scrollLeft:(previousTabs?.scrollLeft||0);
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
    panel.innerHTML=`<header class="fitnessHero taskAreaHeader">
      <div class="fitnessHeroCopy taskAreaHeaderCopy"><span class="fitnessEyebrow taskAreaEyebrow">BODY / DAILY PLAN</span><h2 class="taskAreaTitle">训练与饮食</h2><p class="taskAreaDescription">${escapeHtml(dayName(selectedDay))}${selectedDay===today?" · 今日":""}｜按既定计划执行，训练和饮食分别确认。</p></div>
      <div class="fitnessHeroSide taskAreaHeaderSide">
        <div class="fitnessProgressCard"><div class="fitnessProgressRing" style="--fitness-progress:${stats.pct}%"><b>${stats.pct}%</b></div><span><small>PROGRESS</small><b>${stats.done}/${stats.total}</b><em>所选日期</em></span></div>
        <button type="button" class="fitnessCommandBtn fitnessTodayBtn ${selectedDay===today?"active":""}" data-fitness-today><span class="fitnessCommandIcon">◎</span><span class="fitnessCommandCopy"><small>TODAY</small><b>今日</b><em>${selectedDay===today?"当前日期":"回到今天"}</em></span></button>
        <button type="button" class="fitnessTimerBtn ${fitnessActive?"active":""}" data-fitness-timer title="把训练区作为一个整体记录时间"><span>${fitnessActive?(active.paused?"Ⅱ":"◷"):"◷"}</span><span class="fitnessCommandCopy"><small>TIMER</small><b ${fitnessActive?"data-live-timer":""}>${timerLabel}</b><em>${timerSub}</em></span></button>
        <button type="button" class="fitnessCommandBtn fitnessManualBtn" data-manual-time-entry="fitness" title="补记忘记开始的训练时间"><span class="fitnessCommandIcon">＋</span><span class="fitnessCommandCopy"><small>MANUAL</small><b>补记</b><em>训练时间</em></span></button>
        <button type="button" class="fitnessCommandBtn fitnessEditBtn" data-open-fitness-editor><span class="fitnessCommandIcon">✎</span><span class="fitnessCommandCopy"><small>PLAN</small><b>编辑计划</b><em>训练与饮食</em></span></button>
      </div>
    </header><nav class="fitnessDayTabs" aria-label="训练饮食星期切换">${tabs}</nav><div class="fitnessBoard">${laneHtml("training","训练计划",data.training,selectedDay)}${laneHtml("nutrition","饮食计划",data.nutrition,selectedDay)}</div>`;
    const nextTabs=panel.querySelector(".fitnessDayTabs");
    if(nextTabs){
      nextTabs.scrollLeft=previousScrollLeft;
      requestAnimationFrame(()=>{
        nextTabs.scrollLeft=previousScrollLeft;
        if(options.revealSelected===true)revealSelectedDay(nextTabs,true);
      });
    }
  }

  function editorLog(message){
    const el=document.getElementById("fitnessEditorLog");
    if(el)el.textContent=`[${new Date().toLocaleTimeString()}] ${message}\n`+el.textContent.slice(0,2500);
  }
  function fitnessEditorItemRowHtml(item={},kind="training"){
    const id=String(item.id||`fitness-${kind}-${Date.now().toString(36)}-${++editorItemCounter}`);
    const kindName=kind==="training"?"训练":"饮食";
    return `<div class="fitnessEditorItemRow" data-fitness-editor-item="${kind}" data-fitness-item-id="${escapeHtml(id)}"><label class="fitnessEditorItemTitle"><span>项目名称</span><input type="text" data-fitness-item-title value="${escapeHtml(item.title||"")}" placeholder="${kindName}项目名称"></label><label class="fitnessEditorItemUrl"><span>链接（选填）</span><input type="text" inputmode="url" data-fitness-item-url value="${escapeHtml(item.url||"")}" placeholder="https://..."></label><button type="button" class="fitnessEditorItemDelete" data-fitness-remove-item aria-label="删除${kindName}项目">删除</button><label class="fitnessEditorItemNote"><span>备注 / 说明（选填）</span><textarea rows="2" data-fitness-item-note placeholder="动作要求、份量、阶段提示等">${escapeHtml(item.note||"")}</textarea></label></div>`;
  }
  function fitnessEditorGroupHtml(kind,title,items){
    const kindName=kind==="training"?"TRAINING":"NUTRITION";
    return `<section class="fitnessEditorGroup" data-fitness-editor-group="${kind}"><header><div><span>${kindName}</span><b>${title}</b></div><button type="button" data-fitness-add-item="${kind}">＋ 新增项目</button></header><div class="fitnessEditorItemList" data-fitness-editor-list="${kind}">${items.length?items.map(item=>fitnessEditorItemRowHtml(item,kind)).join(""):`<div class="fitnessEditorGroupEmpty" data-fitness-editor-empty>暂无项目，点击右上角新增。</div>`}</div></section>`;
  }
  function updateFitnessEditorDayCount(card){
    if(!card)return;
    const training=card.querySelectorAll('[data-fitness-editor-item="training"]').length;
    const nutrition=card.querySelectorAll('[data-fitness-editor-item="nutrition"]').length;
    const count=card.querySelector("[data-fitness-editor-day-count]");
    if(count)count.textContent=`${training} 训练 · ${nutrition} 饮食`;
  }
  function collectFitnessEditorItems(card,kind){
    const entries=[...card.querySelectorAll(`[data-fitness-editor-item="${kind}"]`)].map(row=>({
      id:row.dataset.fitnessItemId||"",
      title:row.querySelector("[data-fitness-item-title]")?.value||"",
      note:row.querySelector("[data-fitness-item-note]")?.value||"",
      url:row.querySelector("[data-fitness-item-url]")?.value||"",
      enabled:true
    }));
    return normalizeFitnessItemList(entries,kind);
  }
  function renderFitnessEditor(){
    const list=document.getElementById("fitnessEditorList");
    if(!list)return;
    const cfg=normalizeFitnessConfig(draftConfig||fitnessConfig||defaultFitnessConfig);
    list.innerHTML=`<div class="fitnessEditorGrid">${[1,2,3,4,5,6,0].map(day=>{
      const data=cfg.days[String(day)]||{training:[],nutrition:[]};
      return `<details class="fitnessDayEditor ${day===today?"today":""}" data-fitness-editor-day="${day}" ${day===today?"open":""}><summary class="fitnessDayEditorHead"><b>${escapeHtml(dayName(day))}</b><span data-fitness-editor-day-count>${data.training.length} 训练 · ${data.nutrition.length} 饮食</span></summary><div class="fitnessEditorFields">${fitnessEditorGroupHtml("training","训练项目",data.training)}${fitnessEditorGroupHtml("nutrition","饮食项目",data.nutrition)}</div></details>`;
    }).join("")}</div>`;
    editorLog("已加载结构化训练饮食计划。名称、备注和链接可分别维护；只有真实链接才会显示打开按钮。");
  }
  function collectFitnessEditor(){
    if(!draftConfig)draftConfig=normalizeFitnessConfig(fitnessConfig||defaultFitnessConfig);
    const days={};
    document.querySelectorAll("[data-fitness-editor-day]").forEach(card=>{
      const day=String(Number(card.dataset.fitnessEditorDay));
      days[day]={
        training:collectFitnessEditorItems(card,"training"),
        nutrition:collectFitnessEditorItems(card,"nutrition")
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
      const editorAdd=event.target.closest("[data-fitness-add-item]");
      if(editorAdd){
        event.preventDefault();event.stopPropagation();
        const group=editorAdd.closest("[data-fitness-editor-group]");
        const kind=editorAdd.dataset.fitnessAddItem;
        const itemList=group?.querySelector(`[data-fitness-editor-list="${kind}"]`);
        itemList?.querySelector("[data-fitness-editor-empty]")?.remove();
        itemList?.insertAdjacentHTML("beforeend",fitnessEditorItemRowHtml({},kind));
        updateFitnessEditorDayCount(editorAdd.closest("[data-fitness-editor-day]"));
        itemList?.lastElementChild?.querySelector("[data-fitness-item-title]")?.focus();
        return;
      }
      const editorRemove=event.target.closest("[data-fitness-remove-item]");
      if(editorRemove){
        event.preventDefault();event.stopPropagation();
        const group=editorRemove.closest("[data-fitness-editor-group]");
        const list=editorRemove.closest("[data-fitness-editor-list]");
        editorRemove.closest("[data-fitness-editor-item]")?.remove();
        if(list&&!list.querySelector("[data-fitness-editor-item]"))list.insertAdjacentHTML("beforeend",`<div class="fitnessEditorGroupEmpty" data-fitness-editor-empty>暂无项目，点击右上角新增。</div>`);
        updateFitnessEditorDayCount(group?.closest("[data-fitness-editor-day]"));
        return;
      }
      const open=event.target.closest("#controlFitnessEditorBtn,[data-open-fitness-editor]");
      if(open){event.preventDefault();event.stopPropagation();openFitnessEditor();return}
      const dayBtn=event.target.closest("[data-fitness-day]");
      if(dayBtn){event.preventDefault();const tabs=dayBtn.closest(".fitnessDayTabs");selectedDay=Number(dayBtn.dataset.fitnessDay);renderFitnessPanel({scrollLeft:tabs?.scrollLeft||0,revealSelected:false});return}
      const todayBtn=event.target.closest("[data-fitness-today]");
      if(todayBtn){event.preventDefault();const tabs=document.querySelector("#fitnessPanel .fitnessDayTabs");selectedDay=today;renderFitnessPanel({scrollLeft:tabs?.scrollLeft||0,revealSelected:true});return}
      const timerBtn=event.target.closest("[data-fitness-timer]");
      if(timerBtn){event.preventDefault();const active=readActiveTimer();if(active?.kind==="fitness"&&active.paused)resumeActiveTimer();else if(active?.kind==="fitness")showToast("训练区正在计时","warn");else startFitnessTimer(selectedDay);return}
      const detailBtn=event.target.closest("[data-time-fitness-detail]");
      if(detailBtn){event.preventDefault();event.stopPropagation();openFitnessTimeDetail();return}
      const noteBtn=event.target.closest("[data-fitness-toggle-note]");
      if(noteBtn){event.preventDefault();event.stopPropagation();const panel=noteBtn.closest(".fitnessItem")?.querySelector("[data-fitness-note-panel]");const expanded=noteBtn.getAttribute("aria-expanded")==="true";noteBtn.setAttribute("aria-expanded",expanded?"false":"true");noteBtn.classList.toggle("active",!expanded);if(panel)panel.hidden=expanded;return}
      const linkBtn=event.target.closest("[data-fitness-open-url]");
      if(linkBtn){event.preventDefault();event.stopPropagation();openFitnessItemUrl(linkBtn.dataset.fitnessOpenUrl);return}
      const laneBtn=event.target.closest("[data-fitness-lane-all]");
      if(laneBtn){event.preventDefault();event.stopPropagation();const next=laneBtn.getAttribute("aria-pressed")!=="true";setLaneDone(Number(laneBtn.dataset.fitnessLaneDay),laneBtn.dataset.fitnessLaneAll,next,laneBtn);return}
      const itemBtn=event.target.closest("[data-fitness-item]");
      if(itemBtn){event.preventDefault();const next=itemBtn.getAttribute("aria-pressed")!=="true";setItemDone(Number(itemBtn.dataset.fitnessItemDay),itemBtn.dataset.fitnessKind,itemBtn.dataset.fitnessItem,next,itemBtn);return}
      if(event.target.id==="fitnessEditorModal")closeFitnessEditor();
    });
    document.body.addEventListener("input",event=>{
      if(!event.target.closest("[data-fitness-editor-item]"))return;
      updateFitnessEditorDayCount(event.target.closest("[data-fitness-editor-day]"));
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
