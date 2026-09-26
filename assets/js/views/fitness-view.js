(function(){
  "use strict";

  let selectedDay=today;
  let draftConfig=null;
  let initialized=false;
  let editorItemCounter=0;

  function normalizedFitness(cfg=fitnessConfig){return normalizeFitnessConfig(cfg||defaultFitnessConfig)}
  function activeSections(cfg=fitnessConfig){return normalizedFitness(cfg).sections.filter(section=>section.enabled!==false)}
  function sectionFor(kind,cfg=fitnessConfig){return normalizedFitness(cfg).sections.find(section=>section.id===String(kind))||{id:String(kind||"life"),name:String(kind||"生活"),short:String(kind||"LIFE").toUpperCase(),icon:"＋",accent:"blue",enabled:true}}
  function dayConfig(dayId,cfg=fitnessConfig){
    const normalized=normalizedFitness(cfg);
    return normalized.days[String(Number(dayId))]||{};
  }
  function doneKey(dayId,kind,itemId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_fitness_d${Number(dayId)}_${kind}_${itemId}`}
  function isItemDone(dayId,kind,itemId,cycle=cycleYmd){return localStorage.getItem(doneKey(dayId,kind,itemId,cycle))==="1"}
  function itemsForDay(dayId,cfg=fitnessConfig){
    const data=dayConfig(dayId,cfg);
    return activeSections(cfg).flatMap(section=>(data[section.id]||[]).map(item=>({...item,kind:section.id,section})));
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
      const section=sectionFor(kind);
      playCompletionEffect({level:stats.total&&stats.done===stats.total?"parent":"micro",category:"life",anchor:sourceEl,title:stats.total&&stats.done===stats.total?"今日生活改善完成":`${section.name}项目完成`,eventId:`fitness:${cycleYmd}:${dayId}:${kind}:${itemId}`});
    }
    renderAll();
  }
  function setLaneDone(dayId,kind,value,sourceEl){
    const items=dayConfig(dayId)?.[kind]||[];
    const section=sectionFor(kind);
    items.forEach(item=>syncSetItem(doneKey(dayId,kind,item.id),value));
    if(value&&sourceEl&&items.length&&typeof playCompletionEffect==="function"){
      const stats=dayStats(dayId);
      playCompletionEffect({level:stats.total&&stats.done===stats.total?"parent":"task",category:"life",anchor:sourceEl,title:`${section.name}计划全部完成`,eventId:`fitness-lane:${cycleYmd}:${dayId}:${kind}`});
    }
    showToast(value?`${section.name}项目已全部完成`:`已取消全部${section.name}完成状态`,value?"ok":"warn",1300);
    renderAll();
  }
  function openFitnessItemUrl(value){
    const url=normalizeFitnessUrl(value);
    if(!url){showToast("链接格式不正确，请检查网址","err");return}
    try{
      const opened=window.open("about:blank","_blank");
      if(opened){opened.opener=null;opened.location.replace(url);return}
    }catch(error){console.warn("生活改善链接新窗口打开失败",error)}
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
      if(activeTimerKey(active)===key){showToast(active.paused?"生活改善计时已暂停，可点继续":"生活改善正在计时","warn");return}
      const ok=confirm(`当前正在计时：${active.title}（${fmtTimer(activeTimerElapsedSeconds(active))}）。\n\n要先完成并记录它，然后开始「生活改善」吗？`);
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
      title:`生活改善｜${dayName(normalizedDay)}`,
      category:"body",
      estimated_minutes:60,
      first_started_at:now,
      started_at:now,
      accumulated_seconds:0,
      paused:false,
      paused_at:null
    });
    showToast("开始计时：生活改善","ok",1300);
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
    const lines=week.slice(0,20).map(log=>`<li><span>${fmtLogWhen(log)} · ${escapeHtml(log.title)}${timeLogSourceLabel(log)}</span><b>${fmtMinutes(log.duration_minutes)}</b><button type="button" data-time-log-delete="${escapeHtml(log.id)}">删除</button></li>`).join("")||`<li class="empty"><span>本周还没有生活改善记录</span><b>0m</b></li>`;
    const body=`<button type="button" class="timeDetailAddButton" data-manual-time-entry="fitness">+ 手动补记生活改善时间</button><div class="timeDetailStats"><div><span>今日</span><b>${fmtMinutes(todayUsed)}</b></div><div><span>本周</span><b>${fmtMinutes(used)}</b></div><div><span>累计</span><b>${fmtMinutes(allUsed)}</b></div></div><div class="timeDetailProgress" style="--w:${used?100:0}%"><div><span>统计方式</span><b>生活改善整体计时${activeMinutes?` · 当前 ${fmtMinutes(activeMinutes)}`:""}</b></div><i></i></div><ul class="timeDetailLogs">${lines}</ul>`;
    openTimeDetailModal("生活改善",body);
  }
  function itemHtml(item,section,dayId){
    const done=isItemDone(dayId,section.id,item.id);
    const note=String(item.note||"").trim();
    const url=normalizeFitnessUrl(item.url,item.note);
    const actions=note||url?`<div class="fitnessItemActions">${note?`<button type="button" class="fitnessItemMetaBtn" data-fitness-toggle-note aria-expanded="false" aria-label="查看备注：${escapeHtml(item.title)}"><span>备注</span><b>i</b></button>`:""}${url?`<button type="button" class="fitnessItemLink" data-fitness-open-url="${escapeHtml(url)}" aria-label="打开链接：${escapeHtml(item.title)}" title="打开链接：${escapeHtml(item.title)}"><span>打开</span> ↗</button>`:""}</div>`:"";
    const notePanel=note?`<div class="fitnessItemNote" data-fitness-note-panel hidden><span>NOTE / 备注</span><p>${escapeHtml(note)}</p></div>`:"";
    return `<article class="fitnessItem ${done?"done":""}"><button type="button" class="fitnessItemToggle" data-fitness-item="${escapeHtml(item.id)}" data-fitness-kind="${escapeHtml(section.id)}" data-fitness-item-day="${dayId}" aria-pressed="${done?"true":"false"}"><span class="fitnessCheck">${done?"✓":""}</span><span class="fitnessItemCopy"><strong>${escapeHtml(item.title)}</strong></span><em>${escapeHtml(section.name)}</em></button>${actions}${notePanel}</article>`;
  }
  function laneHtml(section,items,dayId){
    const done=items.filter(item=>isItemDone(dayId,section.id,item.id)).length;
    const allDone=items.length>0&&done===items.length;
    return `<section class="fitnessLane lifeLane" data-life-accent="${escapeHtml(section.accent||"blue")}"><header class="fitnessLaneHead"><div class="fitnessLaneIdentity"><span class="fitnessLaneIcon" aria-hidden="true">${escapeHtml(section.icon||"＋")}</span><div><span>${escapeHtml(section.short||section.name)}</span><b>${escapeHtml(section.name)}</b></div></div><div class="fitnessLaneActions"><em>${done}/${items.length}</em><button type="button" class="fitnessLaneAllBtn ${allDone?"done":""}" data-fitness-lane-all="${escapeHtml(section.id)}" data-fitness-lane-day="${dayId}" aria-pressed="${allDone?"true":"false"}" ${items.length?"":"disabled"}><span>${allDone?"✓":""}</span><b>${allDone?"全部已完成":"全部完成"}</b></button></div></header><div class="fitnessItems">${items.length?items.map(item=>itemHtml(item,section,dayId)).join(""):`<div class="fitnessEmpty">当天没有安排${escapeHtml(section.name)}项目</div>`}</div></section>`;
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
    const cfg=normalizedFitness();
    const sections=cfg.sections.filter(section=>section.enabled!==false);
    const data=dayConfig(selectedDay,cfg);
    const stats=dayStats(selectedDay,cfg);
    const active=readActiveTimer();
    const fitnessActive=active?.kind==="fitness";
    const timerLabel=fitnessActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时";
    const timerSub=fitnessActive?(active.paused?"已暂停":"生活改善计时中"):`本周 ${fmtMinutes(fitnessWeekMinutes())}`;
    const tabs=[1,2,3,4,5,6,0].map(day=>{
      const s=dayStats(day,cfg);
      return `<button type="button" class="fitnessDayTab ${day===selectedDay?"active":""} ${day===today?"today":""}" data-fitness-day="${day}" aria-pressed="${day===selectedDay?"true":"false"}">${escapeHtml(dayName(day))}<span>${s.done}/${s.total}</span></button>`;
    }).join("");
    const lanes=sections.map(section=>laneHtml(section,data[section.id]||[],selectedDay)).join("");
    panel.innerHTML=`<header class="fitnessHero taskAreaHeader lifeHero">
      <div class="fitnessHeroCopy taskAreaHeaderCopy"><span class="fitnessEyebrow taskAreaEyebrow">LIFE / IMPROVEMENT</span><h2 class="taskAreaTitle">生活改善</h2><p class="taskAreaDescription">${escapeHtml(dayName(selectedDay))}${selectedDay===today?" · 今日":""}｜训练、饮食和其他生活改善项目统一在这里维护；分区可以继续扩展。</p></div>
      <div class="fitnessHeroSide taskAreaHeaderSide">
        <div class="fitnessProgressCard"><div class="fitnessProgressRing" style="--fitness-progress:${stats.pct}%"><b>${stats.pct}%</b></div><span><small>PROGRESS</small><b>${stats.done}/${stats.total}</b><em>所选日期</em></span></div>
        <button type="button" class="fitnessCommandBtn fitnessTodayBtn ${selectedDay===today?"active":""}" data-fitness-today><span class="fitnessCommandIcon">◎</span><span class="fitnessCommandCopy"><small>TODAY</small><b>今日</b><em>${selectedDay===today?"当前日期":"回到今天"}</em></span></button>
        <button type="button" class="fitnessTimerBtn ${fitnessActive?"active":""}" data-fitness-timer title="把生活改善区作为一个整体记录时间"><span>${fitnessActive?(active.paused?"Ⅱ":"◷"):"◷"}</span><span class="fitnessCommandCopy"><small>TIMER</small><b ${fitnessActive?"data-live-timer":""}>${timerLabel}</b><em>${timerSub}</em></span></button>
        <button type="button" class="fitnessCommandBtn fitnessManualBtn" data-manual-time-entry="fitness" title="补记忘记开始的生活改善时间"><span class="fitnessCommandIcon">＋</span><span class="fitnessCommandCopy"><small>MANUAL</small><b>补记</b><em>改善时间</em></span></button>
        <button type="button" class="fitnessCommandBtn fitnessEditBtn" data-open-fitness-editor><span class="fitnessCommandIcon">✎</span><span class="fitnessCommandCopy"><small>PLAN</small><b>编辑改善</b><em>${sections.length} 个分区</em></span></button>
      </div>
    </header><nav class="fitnessDayTabs" aria-label="生活改善星期切换">${tabs}</nav><div class="fitnessBoard lifeBoard">${lanes||`<div class="fitnessEmpty lifeEmpty"><b>还没有生活改善分区。</b><span>打开编辑器新增一个分区即可开始。</span></div>`}</div>`;
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
  function fitnessAccentOptions(selected="blue"){
    const options=[["green","绿"],["amber","金"],["blue","蓝"],["violet","紫"],["rose","粉"],["cyan","青"],["slate","灰"]];
    return options.map(([value,label])=>`<option value="${value}" ${selected===value?"selected":""}>${label}</option>`).join("");
  }
  function lifeSectionMetaRowHtml(section,idx,total){
    const locked=section.locked===true;
    return `<div class="lifeSectionMetaRow" data-life-section-row data-life-section-id="${escapeHtml(section.id)}">
      <span class="lifeSectionMetaIcon" aria-hidden="true">${escapeHtml(section.icon||"＋")}</span>
      <label><span>分区名称</span><input class="lifeSectionName" value="${escapeHtml(section.name||"")}" placeholder="例如：睡眠"></label>
      <label><span>英文短标</span><input class="lifeSectionShort" value="${escapeHtml(section.short||"")}" maxlength="18" placeholder="SLEEP"></label>
      <label><span>图标</span><input class="lifeSectionIcon" value="${escapeHtml(section.icon||"")}" maxlength="4" placeholder="眠"></label>
      <label><span>强调色</span><select class="lifeSectionAccent">${fitnessAccentOptions(section.accent)}</select></label>
      <div class="lifeSectionMetaOps">
        <button type="button" data-life-section-move="up" data-life-section-id="${escapeHtml(section.id)}" ${idx<=0?"disabled":""} aria-label="上移">↑</button>
        <button type="button" data-life-section-move="down" data-life-section-id="${escapeHtml(section.id)}" ${idx>=total-1?"disabled":""} aria-label="下移">↓</button>
        ${locked?`<span class="lifeSectionLocked">基础</span>`:`<button type="button" class="danger" data-life-section-delete="${escapeHtml(section.id)}">删除</button>`}
      </div>
    </div>`;
  }
  function fitnessEditorItemRowHtml(item={},section){
    const kind=section.id;
    const id=String(item.id||`fitness-${kind}-${Date.now().toString(36)}-${++editorItemCounter}`);
    return `<div class="fitnessEditorItemRow" data-fitness-editor-item="${escapeHtml(kind)}" data-fitness-item-id="${escapeHtml(id)}"><label class="fitnessEditorItemTitle"><span>项目名称</span><input type="text" data-fitness-item-title value="${escapeHtml(item.title||"")}" placeholder="${escapeHtml(section.name)}项目名称"></label><label class="fitnessEditorItemUrl"><span>链接（选填）</span><input type="text" inputmode="url" data-fitness-item-url value="${escapeHtml(item.url||"")}" placeholder="https://..."></label><button type="button" class="fitnessEditorItemDelete" data-fitness-remove-item aria-label="删除${escapeHtml(section.name)}项目">删除</button><label class="fitnessEditorItemNote"><span>备注 / 说明（选填）</span><textarea rows="2" data-fitness-item-note placeholder="具体要求、份量、步骤或阶段提示等">${escapeHtml(item.note||"")}</textarea></label></div>`;
  }
  function fitnessEditorGroupHtml(section,items){
    return `<section class="fitnessEditorGroup lifeEditorGroup" data-fitness-editor-group="${escapeHtml(section.id)}" data-life-accent="${escapeHtml(section.accent||"blue")}"><header><div class="lifeEditorGroupTitle"><span class="lifeEditorGroupIcon">${escapeHtml(section.icon||"＋")}</span><div><span>${escapeHtml(section.short||section.name)}</span><b>${escapeHtml(section.name)}</b></div></div><button type="button" data-fitness-add-item="${escapeHtml(section.id)}">＋ 新增项目</button></header><div class="fitnessEditorItemList" data-fitness-editor-list="${escapeHtml(section.id)}">${items.length?items.map(item=>fitnessEditorItemRowHtml(item,section)).join(""):`<div class="fitnessEditorGroupEmpty" data-fitness-editor-empty>暂无项目，点击右上角新增。</div>`}</div></section>`;
  }
  function updateFitnessEditorDayCount(card){
    if(!card)return;
    const parts=[...card.querySelectorAll("[data-fitness-editor-group]")].map(group=>{
      const id=group.dataset.fitnessEditorGroup;
      const section=(draftConfig?.sections||[]).find(s=>s.id===id);
      const count=group.querySelectorAll(`[data-fitness-editor-item="${safeCssEscape(id)}"]`).length;
      return count?`${count} ${section?.name||id}`:"";
    }).filter(Boolean);
    const count=card.querySelector("[data-fitness-editor-day-count]");
    if(count)count.textContent=parts.join(" · ")||"暂无项目";
  }
  function collectFitnessEditorItems(card,kind){
    const entries=[...card.querySelectorAll(`[data-fitness-editor-item="${safeCssEscape(kind)}"]`)].map(row=>({
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
    draftConfig=deepClone(cfg);
    const sections=cfg.sections.filter(section=>section.enabled!==false);
    const sectionManager=`<section class="lifeSectionManager"><header><div><span>LIFE AREAS</span><b>改善分区管理</b><em>训练和饮食是基础分区；以后可继续添加睡眠、护肤、姿势、恢复、环境等。</em></div><button type="button" data-life-section-add>＋ 新增改善分区</button></header><div class="lifeSectionMetaList">${sections.map((section,idx)=>lifeSectionMetaRowHtml(section,idx,sections.length)).join("")}</div></section>`;
    const dayEditors=[1,2,3,4,5,6,0].map(day=>{
      const data=cfg.days[String(day)]||{};
      const summary=sections.map(section=>{const n=(data[section.id]||[]).length;return n?`${n} ${section.name}`:""}).filter(Boolean).join(" · ")||"暂无项目";
      return `<details class="fitnessDayEditor ${day===today?"today":""}" data-fitness-editor-day="${day}" ${day===today?"open":""}><summary class="fitnessDayEditorHead"><b>${escapeHtml(dayName(day))}</b><span data-fitness-editor-day-count>${escapeHtml(summary)}</span></summary><div class="fitnessEditorFields lifeEditorFields">${sections.map(section=>fitnessEditorGroupHtml(section,data[section.id]||[])).join("")}</div></details>`;
    }).join("");
    list.innerHTML=`${sectionManager}<div class="fitnessEditorGrid">${dayEditors}</div>`;
    editorLog("已加载生活改善计划。训练与饮食原样保留；可在顶部新增改善分区，再按星期安排具体项目。");
  }
  function collectFitnessEditor(){
    if(!draftConfig)draftConfig=normalizeFitnessConfig(fitnessConfig||defaultFitnessConfig);
    const previous=new Map((draftConfig.sections||[]).map(section=>[section.id,section]));
    const sections=[...document.querySelectorAll("[data-life-section-row]")].map((row,idx)=>{
      const id=row.dataset.lifeSectionId;
      const old=previous.get(id)||{};
      return {
        id,
        name:row.querySelector(".lifeSectionName")?.value.trim()||old.name||`改善分区 ${idx+1}`,
        short:row.querySelector(".lifeSectionShort")?.value.trim()||old.short||"LIFE",
        icon:row.querySelector(".lifeSectionIcon")?.value.trim()||old.icon||"＋",
        accent:row.querySelector(".lifeSectionAccent")?.value||old.accent||"blue",
        locked:old.locked===true,
        enabled:true
      };
    });
    const days={};
    document.querySelectorAll("[data-fitness-editor-day]").forEach(card=>{
      const day=String(Number(card.dataset.fitnessEditorDay));
      const dayData={};
      sections.forEach(section=>{dayData[section.id]=collectFitnessEditorItems(card,section.id)});
      days[day]=dayData;
    });
    draftConfig=normalizeFitnessConfig({...draftConfig,sections,days,updatedAt:new Date().toISOString()});
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
      saveLocalTaskConfig(cfg,"生活改善编辑器保存前");
      applyTaskConfig(cfg,true);
      draftConfig=deepClone(fitnessConfig);
      renderFitnessEditor();
      if(shouldSync){
        setGhStatus("GitHub：保存配置中","sync");
        await ghPatchConfig(cfg);
        setGhStatus("GitHub：已同步","on");
        editorLog("生活改善配置已保存并加密同步。");
        showToast("生活改善已保存并同步","ok");
      }else{
        editorLog("生活改善配置已保存到本机。");
        showToast("生活改善已保存到本机","ok");
      }
    }catch(error){
      console.error(error);
      editorLog("保存失败："+String(error.message||error));
      showToast("生活改善保存失败","err");
    }finally{setBtnBusy(btn,false)}
  }
  function reloadFitnessConfig(){
    if(!confirm("确认放弃尚未保存的生活改善修改，并重载当前已保存配置？"))return;
    draftConfig=deepClone(fitnessConfig||normalizeFitnessConfig(defaultFitnessConfig));
    renderFitnessEditor();
    editorLog("已重载当前保存的生活改善配置。");
  }
  function fitnessImportConfig(value){
    const imported=value&&typeof value==="object"&&!Array.isArray(value)&&Object.prototype.hasOwnProperty.call(value,"fitness")?value.fitness:value;
    if(!imported||typeof imported!=="object"||Array.isArray(imported)||!imported.days||typeof imported.days!=="object"||Array.isArray(imported.days)){
      throw new Error("生活改善 JSON 必须包含 days 对象");
    }
    return normalizeFitnessConfig(imported);
  }
  function exportFitnessConfig(){
    const cfg=collectFitnessEditor();
    const payload={...cfg,section:"fitness",module:"life-improvement"};
    navigator.clipboard?.writeText(JSON.stringify(payload,null,2)).then(()=>{editorLog("生活改善 JSON 已复制，不包含其他配置分区。");showToast("生活改善 JSON 已复制","ok")}).catch(()=>{editorLog(JSON.stringify(payload,null,2));showToast("复制失败，已输出到日志","warn")});
  }
  function importFitnessConfig(){
    const raw=prompt("粘贴生活改善 JSON：支持新版生活改善 JSON、旧版 fitness JSON 或完整 taskring-config.json；只会导入生活改善配置。");
    if(!raw)return;
    try{
      draftConfig=fitnessImportConfig(JSON.parse(raw));
      renderFitnessEditor();
      editorLog("生活改善导入成功；旧版训练/饮食会自动迁移，其他配置分区不变。保存后生效。");
      showToast("生活改善已导入，记得保存","ok");
    }catch(error){editorLog("导入失败："+String(error.message||error));showToast("生活改善 JSON 不合法","err")}
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
      const addSection=event.target.closest("[data-life-section-add]");
      if(addSection){
        event.preventDefault();event.stopPropagation();
        collectFitnessEditor();
        const id=normalizeFitnessSectionId(`life-${Date.now().toString(36)}`,"life");
        const accents=["blue","violet","rose","cyan","slate","green","amber"];
        draftConfig.sections.push({id,name:"新改善分区",short:"LIFE",icon:"＋",accent:accents[draftConfig.sections.length%accents.length],locked:false,enabled:true});
        Object.values(draftConfig.days||{}).forEach(day=>{day[id]=[]});
        renderFitnessEditor();
        document.querySelector(`[data-life-section-id="${safeCssEscape(id)}"] .lifeSectionName`)?.select();
        return;
      }
      const deleteSection=event.target.closest("[data-life-section-delete]");
      if(deleteSection){
        event.preventDefault();event.stopPropagation();
        collectFitnessEditor();
        const id=deleteSection.dataset.lifeSectionDelete;
        const section=draftConfig.sections.find(x=>x.id===id);
        if(!section||section.locked)return;
        if(!confirm(`删除改善分区「${section.name}」？该分区在一周内的项目也会从配置中删除。`))return;
        draftConfig.sections=draftConfig.sections.filter(x=>x.id!==id);
        Object.values(draftConfig.days||{}).forEach(day=>{delete day[id]});
        renderFitnessEditor();
        editorLog(`已删除改善分区：${section.name}`);
        return;
      }
      const moveSection=event.target.closest("[data-life-section-move]");
      if(moveSection){
        event.preventDefault();event.stopPropagation();
        collectFitnessEditor();
        const id=moveSection.dataset.lifeSectionId;
        const index=draftConfig.sections.findIndex(x=>x.id===id);
        const next=index+(moveSection.dataset.lifeSectionMove==="up"?-1:1);
        if(index>=0&&next>=0&&next<draftConfig.sections.length){
          [draftConfig.sections[index],draftConfig.sections[next]]=[draftConfig.sections[next],draftConfig.sections[index]];
          renderFitnessEditor();
        }
        return;
      }
      const editorAdd=event.target.closest("[data-fitness-add-item]");
      if(editorAdd){
        event.preventDefault();event.stopPropagation();
        const group=editorAdd.closest("[data-fitness-editor-group]");
        const kind=editorAdd.dataset.fitnessAddItem;
        const section=(draftConfig?.sections||[]).find(x=>x.id===kind)||sectionFor(kind,draftConfig);
        const itemList=group?.querySelector(`[data-fitness-editor-list="${safeCssEscape(kind)}"]`);
        itemList?.querySelector("[data-fitness-editor-empty]")?.remove();
        itemList?.insertAdjacentHTML("beforeend",fitnessEditorItemRowHtml({},section));
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
      if(timerBtn){event.preventDefault();const active=readActiveTimer();if(active?.kind==="fitness"&&active.paused)resumeActiveTimer();else if(active?.kind==="fitness")showToast("生活改善正在计时","warn");else startFitnessTimer(selectedDay);return}
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
