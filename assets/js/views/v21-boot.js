// v21 Clarity Boot + Weekly Pool override
// 重点：高对比、低噪声、周计划池分任务不再被吞、修复 Italiano 被 IT 正则误伤。
(function(){
  const WEEKLY_STEP_SUFFIX="_w";
  const WEEKLY_CATEGORY_TAB_KEY=`${GH_PREFIX}weekly_category_tab_v1`;
  function weeklyStepKey(taskId,stepId,cycle=cycleYmd){
    return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_${stepCode(taskId,stepId)}${WEEKLY_STEP_SUFFIX}`;
  }
  function weeklyStepDone(taskId,stepId,cycle=cycleYmd){
    return localStorage.getItem(weeklyStepKey(taskId,stepId,cycle))==="1";
  }
  function setWeeklyStepDone(taskId,stepId,val,cycle=cycleYmd){
    syncSetItem(weeklyStepKey(taskId,stepId,cycle),val);
  }
  function weeklyStepProgress(task){
    const steps=(stepTasks[task.id]||[]).filter(s=>s.enabled!==false);
    const done=steps.filter(s=>weeklyStepDone(task.id,s.id,cycleYmd)).length;
    return {steps,done,total:steps.length,pct:steps.length?Math.round(done/steps.length*100):0};
  }
  function weeklySubtasksHtml(task){
    const p=weeklyStepProgress(task);
    if(!p.total)return "";
    const rows=p.steps.map(s=>{
      const done=weeklyStepDone(task.id,s.id,cycleYmd);
      return `<label class="weeklyStepItem ${done?"done":""}"><input type="checkbox" data-weekly-step="1" data-weekly-step-task="${escapeHtml(task.id)}" data-weekly-step-id="${escapeHtml(s.id)}" ${done?"checked":""}><span>${escapeHtml(s.title)}</span></label>`;
    }).join("");
    return `<details class="weeklySubtasks" open><summary><b>分任务</b><span>${p.done}/${p.total}</span></summary><div class="weeklyStepList">${rows}</div></details>`;
  }
  function weeklyCategoryRows(){
    return weeklyCategorySummary().filter(row=>row.count);
  }
  function selectedWeeklyCategory(rows){
    const saved=localStorage.getItem(WEEKLY_CATEGORY_TAB_KEY)||"";
    if(saved==="all"&&rows.length)return "all";
    if(rows.some(row=>row.cat===saved))return saved;
    return rows[0]?.cat||"all";
  }
  function weeklyCategoryTabsHtml(rows,active,total){
    if(rows.length<=1)return "";
    const allActive=active==="all";
    const allDone=rows.reduce((sum,row)=>sum+row.done,0);
    const allTarget=rows.reduce((sum,row)=>sum+row.target,0);
    const allUsed=rows.reduce((sum,row)=>sum+row.used,0);
    const allLabel=allTarget?`${fmtMinutes(allUsed)} / ${fmtMinutes(allTarget)}`:fmtMinutes(allUsed);
    const allBtn=`<button type="button" class="weeklyCategoryTab ${allActive?"active":""}" data-weekly-category-tab="all"><span>全部</span><b>${total} 条</b><em>${allLabel} · 达成 ${allDone}</em></button>`;
    const catBtns=rows.map(row=>{
      const def=timeCategoryDefs[row.cat]||timeCategoryDefs.life;
      const activeCls=active===row.cat?"active":"";
      const label=row.target?`${fmtMinutes(row.used)} / ${fmtMinutes(row.target)}`:fmtMinutes(row.used);
      return `<button type="button" class="weeklyCategoryTab ${activeCls}" data-weekly-category-tab="${escapeHtml(row.cat)}"><span>${def.icon} ${escapeHtml(def.short)}</span><b>${row.count} 条</b><em>${label} · 达成 ${row.done}</em></button>`;
    }).join("");
    return `<nav class="weeklyCategoryTabs" aria-label="周计划池类别筛选">${allBtn}${catBtns}</nav>`;
  }
  function weeklyCardV21(t){
    const st=weeklyTaskStatus(t);
    const pct=st.target?Math.min(100,st.pct):0;
    const c=timeCategoryDefs[taskTimeCategory(t)]||timeCategoryDefs.life;
    const url=safeUrl(t.url);
    const active=readActiveTimer();
    const isActive=active&&active.kind==="task"&&String(active.task_id)===String(t.id);
    const score=st.target?`${fmtMinutes(st.used)} / ${fmtMinutes(st.target)}`:fmtMinutes(st.used);
    const left=st.target?Math.max(0,st.target-st.used):0;
    const stateText=st.target?(st.used>=st.target?"本周达成":`还差 ${fmtMinutes(left)}`):"未设周目标";
    const stepInfo=weeklyStepProgress(t);
    const stepText=stepInfo.total?` · 分任务 ${stepInfo.done}/${stepInfo.total}`:"";
    return `<article class="weeklyMissionCard ${st.state} ${st.over?"over":""} ${isActive?"running":""}" style="--w:${pct}%">
      <header class="missionHead">
        <div class="missionIcon">${c.icon}</div>
        <div class="missionTitleBlock"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(taskDayHint(t))} · 单次 ${taskEstimatedMinutes(t)}m${stepText}</span></div>
        <div class="missionScore"><strong>${score}</strong><em>${stateText}</em></div>
      </header>
      <div class="missionMeter" aria-hidden="true"><i></i></div>
      <footer class="missionActions">
        <button type="button" class="missionPrimary ${isActive?"active":""}" data-timer-start-task="${escapeHtml(t.id)}" data-timer-day="${today}" data-timer-cycle="${escapeHtml(cycleYmd)}">${isActive?`计时中 ${fmtTimer(activeTimerElapsedSeconds(active))}`:"开始计时"}</button>
        <button type="button" class="missionGhost" data-time-task-detail="${escapeHtml(t.id)}">查看账本</button>
        <button type="button" class="missionGhost safeTargetEdit" data-edit-weekly-target="${escapeHtml(t.id)}"><span>周目标</span><b>${st.target?fmtMinutes(st.target):"未设"}</b></button>
        ${url?`<a class="missionLink" href="${url}" target="_blank" rel="noopener noreferrer">打开↗</a>`:""}
      </footer>
      ${weeklySubtasksHtml(t)}
      <div class="missionBadges">${planModeBadgeHtml(t)}<span>${escapeHtml(c.short)}</span>${t.important?`<span class="hot">重</span>`:""}</div>
    </article>`;
  }
  function renderWeeklyPlanPanelV21(){
    const el=document.getElementById("weeklyPlanPanel");
    if(!el)return;
    const tasks=weeklyPoolBlocks().slice().sort(weeklyPlanSort);
    const totalUsed=tasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).used,0);
    const totalTarget=tasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).target,0);
    const doneCount=tasks.filter(t=>{const st=weeklyTaskStatus(t);return st.target&&st.used>=st.target}).length;
    const categoryRows=weeklyCategoryRows();
    const activeCategory=selectedWeeklyCategory(categoryRows);
    const categoryTabs=weeklyCategoryTabsHtml(categoryRows,activeCategory,tasks.length);
    const active=readActiveTimer();
    const activeHint=active?`<div class="weeklyActiveHint v20"><span>${active.paused?"PAUSED":"FOCUS"}</span><b>${escapeHtml(active.title)}</b><em data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</em></div>`:"";
    const summaries=weeklyCategorySummary().filter(row=>row.target||row.used).map(row=>{
      const def=timeCategoryDefs[row.cat]||timeCategoryDefs.life;
      const pct=row.target?Math.min(100,Math.round(row.used/row.target*100)):0;
      return `<div class="allocationChip" style="--w:${pct}%"><div><span>${def.icon}</span><b>${escapeHtml(def.short)}</b></div><em>${fmtMinutes(row.used)}${row.target?` / ${fmtMinutes(row.target)}`:""}</em><i></i></div>`;
    }).join("");
    const visibleCategoryOrder=activeCategory==="all"?timeCategoryOrder:[activeCategory];
    const grouped=visibleCategoryOrder.map(cat=>{
      const def=timeCategoryDefs[cat]||timeCategoryDefs.life;
      const catTasks=tasks.filter(t=>taskTimeCategory(t)===cat);
      if(!catTasks.length)return "";
      const used=catTasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).used,0);
      const target=catTasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).target,0);
      const pct=target?Math.min(100,Math.round(used/target*100)):0;
      return `<section class="weeklyMissionGroup" style="--w:${pct}%"><header><div><span class="groupIcon">${def.icon}</span><b>${escapeHtml(def.name)}</b><small>${catTasks.length} 条主线</small></div><strong>${fmtMinutes(used)}${target?` / ${fmtMinutes(target)}`:""}</strong></header><div class="groupMeter"><i></i></div><div class="weeklyMissionGrid">${catTasks.map(weeklyCardV21).join("")}</div></section>`;
    }).join("");
    const cards=grouped||`<div class="weeklyEmpty"><b>周计划池为空</b><span>在任务编辑器里把任务模式设为「周计划池」，它就会出现在这里。</span></div>`;
    el.innerHTML=`<div class="weeklyShell v20 v21"><div class="weeklyCommandHero"><div><span>WEEKLY ALLOCATION</span><b>周计划池</b><em>这里看本周时间投向；用类别 tab 切换，不再把所有主线铺成一整面墙。</em></div><div class="weeklyHeroStats"><div><span>本周投入</span><b>${fmtMinutes(totalUsed)}</b></div><div><span>周目标</span><b>${fmtMinutes(totalTarget)}</b></div><div><span>达成任务</span><b>${doneCount}/${tasks.length}</b></div></div></div>${activeHint}${categoryTabs}${summaries?`<div class="allocationRibbon">${summaries}</div>`:""}<div class="weeklyTaskGroups">${cards}</div></div>`;
  }
  window.renderWeeklyPlanPanel=renderWeeklyPlanPanelV21;
  document.body.addEventListener("click",e=>{
    const tab=e.target?.closest?.("[data-weekly-category-tab]");
    if(!tab)return;
    e.preventDefault();
    localStorage.setItem(WEEKLY_CATEGORY_TAB_KEY,tab.dataset.weeklyCategoryTab||"all");
    renderAll();
  },true);
  document.body.addEventListener("change",e=>{
    const box=e.target?.closest?.("[data-weekly-step]");
    if(!box)return;
    e.preventDefault();
    const taskId=box.dataset.weeklyStepTask;
    const stepId=box.dataset.weeklyStepId;
    setWeeklyStepDone(taskId,stepId,box.checked,cycleYmd);
    showToast(box.checked?"分任务已完成":"已取消分任务","ok",1100);
    renderAll();
  },true);
  window.TaskRingV21={version:"v21",boot(){
    // Repaint with the v21 weekly renderer installed above.
    // Title/version text is owned by index.html — do not override it here.
    try{
      renderAll();
    }catch(err){console.warn("TaskRing v21 boot warning",err)}
  }};
  window.TaskRingV21.boot();
})();
