// v20 Weekly Plan View
// 独立管理「周计划池」渲染：只展示投入、目标和启动入口；目标修改改为确认式弹窗。
(function(){
  function weeklyCard(t){
    const st=weeklyTaskStatus(t);
    const pct=st.target?Math.min(100,st.pct):0;
    const c=timeCategoryDefs[taskTimeCategory(t)]||timeCategoryDefs.life;
    const url=safeUrl(t.url);
    const active=readActiveTimer();
    const isActive=active&&active.kind==="task"&&String(active.task_id)===String(t.id);
    const score=st.target?`${fmtMinutes(st.used)} / ${fmtMinutes(st.target)}`:fmtMinutes(st.used);
    const left=st.target?Math.max(0,st.target-st.used):0;
    const stateText=st.target?(st.used>=st.target?"本周达成":`还差 ${fmtMinutes(left)}`):"未设周目标";
    return `<article class="weeklyMissionCard ${st.state} ${st.over?"over":""} ${isActive?"running":""}" style="--w:${pct}%">
      <div class="missionGlow" aria-hidden="true"></div>
      <header class="missionHead">
        <div class="missionIcon">${c.icon}</div>
        <div class="missionTitleBlock"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(taskDayHint(t))} · 单次 ${taskEstimatedMinutes(t)}m</span></div>
        <div class="missionScore"><strong>${score}</strong><em>${stateText}</em></div>
      </header>
      <div class="missionMeter"><i></i></div>
      <footer class="missionActions">
        <button type="button" class="missionPrimary ${isActive?"active":""}" data-timer-start-task="${escapeHtml(t.id)}" data-timer-day="${today}" data-timer-cycle="${escapeHtml(cycleYmd)}">${isActive?`计时中 ${fmtTimer(activeTimerElapsedSeconds(active))}`:"开始计时"}</button>
        <button type="button" class="missionGhost" data-time-task-detail="${escapeHtml(t.id)}">查看账本</button>
        <button type="button" class="missionGhost safeTargetEdit" data-edit-weekly-target="${escapeHtml(t.id)}"><span>周目标</span><b>${st.target?fmtMinutes(st.target):"未设"}</b></button>
        ${url?`<a class="missionLink" href="${url}" target="_blank" rel="noopener noreferrer">打开↗</a>`:""}
      </footer>
      <div class="missionBadges">${planModeBadgeHtml(t)}<span>${escapeHtml(c.short)}</span>${t.important?`<span class="hot">重</span>`:""}</div>
    </article>`;
  }

  window.renderWeeklyPlanPanel=function(){
    const el=document.getElementById("weeklyPlanPanel");
    if(!el)return;
    const tasks=weeklyPoolBlocks().slice().sort(weeklyPlanSort);
    const totalUsed=tasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).used,0);
    const totalTarget=tasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).target,0);
    const doneCount=tasks.filter(t=>{const st=weeklyTaskStatus(t);return st.target&&st.used>=st.target}).length;
    const active=readActiveTimer();
    const activeHint=active?`<div class="weeklyActiveHint v20"><span>${active.paused?"PAUSED":"FOCUS"}</span><b>${escapeHtml(active.title)}</b><em data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</em></div>`:"";
    const summaries=weeklyCategorySummary().map(row=>{
      const def=timeCategoryDefs[row.cat]||timeCategoryDefs.life;
      const pct=row.target?Math.min(100,Math.round(row.used/row.target*100)):0;
      return `<div class="allocationChip" style="--w:${pct}%"><div><span>${def.icon}</span><b>${escapeHtml(def.short)}</b></div><em>${fmtMinutes(row.used)}${row.target?` / ${fmtMinutes(row.target)}`:""}</em><i></i></div>`;
    }).join("");
    const grouped=timeCategoryOrder.map(cat=>{
      const def=timeCategoryDefs[cat]||timeCategoryDefs.life;
      const catTasks=tasks.filter(t=>taskTimeCategory(t)===cat);
      if(!catTasks.length)return "";
      const used=catTasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).used,0);
      const target=catTasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).target,0);
      const pct=target?Math.min(100,Math.round(used/target*100)):0;
      return `<section class="weeklyMissionGroup" style="--w:${pct}%"><header><div><span class="groupIcon">${def.icon}</span><b>${escapeHtml(def.name)}</b><small>${catTasks.length} 条主线</small></div><strong>${fmtMinutes(used)}${target?` / ${fmtMinutes(target)}`:""}</strong></header><div class="groupMeter"><i></i></div><div class="weeklyMissionGrid">${catTasks.map(weeklyCard).join("")}</div></section>`;
    }).join("");
    const cards=grouped||`<div class="weeklyEmpty"><b>周计划池为空</b><span>在任务编辑器里把任务模式设为「周计划池」，它就会出现在这里。</span></div>`;
    el.innerHTML=`<div class="weeklyShell v20"><div class="weeklyCommandHero"><div><span>WEEKLY ALLOCATION</span><b>周计划池</b><em>这里不是每日打卡表，是本周时间投资组合。</em></div><div class="weeklyHeroStats"><div><span>本周投入</span><b>${fmtMinutes(totalUsed)}</b></div><div><span>周目标</span><b>${fmtMinutes(totalTarget)}</b></div><div><span>达成任务</span><b>${doneCount}/${tasks.length}</b></div></div></div>${activeHint}<div class="allocationRibbon">${summaries}</div><div class="weeklyTaskGroups">${cards}</div></div>`;
  };
})();
