// TaskRing product UI: one renderer layer for disclosure, responsive cards and persistence.
(function(){
  "use strict";

  const DISCLOSURE_KEY="taskring_ui_disclosure_v1";
  const WEEKLY_CATEGORY_KEY=`${GH_PREFIX}weekly_category_tab_v2`;
  const GAME_SELECTED_DAY_KEY=`${GH_PREFIX}gamequest_selected_day_v1`;
  const GAME_SELECTED_GAME_KEY=`${GH_PREFIX}gamequest_selected_game_v1`;
  const LIBRARY_LAST_GROUP_KEY="taskring_library_last_group_v1";
  const LIBRARY_SEARCH_KEY="taskring_library_search_v1";
  let disclosureState=readJson(DISCLOSURE_KEY,{});
  let selectedGameId=localStorage.getItem(GAME_SELECTED_GAME_KEY)||"";
  let libraryQuery=localStorage.getItem(LIBRARY_SEARCH_KEY)||"";
  let lastModalTrigger=null;

  function readJson(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch(_){return fallback}
  }
  function saveDisclosure(){
    try{localStorage.setItem(DISCLOSURE_KEY,JSON.stringify(disclosureState))}catch(_){}
  }
  function hasDisclosure(key){return Object.prototype.hasOwnProperty.call(disclosureState,key)}
  function disclosureOpen(key,fallback=false){return hasDisclosure(key)?disclosureState[key]===true:!!fallback}
  function openAttr(key,fallback=false){return disclosureOpen(key,fallback)?" open":""}
  function detailKey(kind,id,extra=""){return `${kind}:${id}${extra?`:${extra}`:""}`}
  function groupBy(items,keyFn){
    return items.reduce((map,item)=>{const key=keyFn(item);if(!map.has(key))map.set(key,[]);map.get(key).push(item);return map},new Map());
  }
  function isActiveTaskOccurrence(t,dayId,cycle){
    const active=readActiveTimer();
    return !!(active&&active.kind==="task"&&String(active.task_id)===String(t.id)&&Number(active.day_id)===Number(dayId)&&String(active.cycle||cycleYmd)===String(cycle||cycleYmd));
  }
  function occurrenceAttention(o){
    const st=occurrenceState(o.t,o.dayId,o.cycle||cycleYmd);
    if(st.done)return false;
    return st.overdue||st.warn||st.failed||o.t.important||isActiveTaskOccurrence(o.t,o.dayId,o.cycle||cycleYmd);
  }
  function occurrenceDone(o){return isDone(o.t.id,o.dayId,o.cycle||cycleYmd)}
  function dailyPriority(a,b){
    const score=o=>{const st=occurrenceState(o.t,o.dayId,o.cycle||cycleYmd);return (isActiveTaskOccurrence(o.t,o.dayId,o.cycle||cycleYmd)?100:0)+(st.failed||st.overdue?80:0)+(st.warn||st.prev?65:0)+(o.t.important?50:0)+(o.t.core?30:0)+(st.done?-100:0)};
    return score(b)-score(a)||String(a.t.title).localeCompare(String(b.t.title),"zh-Hans-CN");
  }

  function dailyOccurrencesForView(){
    if(viewMode!=="all")return todayOccurrences(viewMode==="today");
    const out=[];
    ringBlocks().forEach(t=>sortWeekDays(t.days).forEach(dayId=>out.push({t,dayId,cycle:cycleYmd,current:dayId===today})));
    return out;
  }
  function dailyGroupStats(list){
    const stats={total:list.length,done:0,running:0,overdue:0,important:0,minutes:0};
    list.forEach(o=>{
      const st=occurrenceState(o.t,o.dayId,o.cycle||cycleYmd);
      if(st.done)stats.done++;
      if(st.overdue||st.warn||st.failed)stats.overdue++;
      if(o.t.important)stats.important++;
      if(isActiveTaskOccurrence(o.t,o.dayId,o.cycle||cycleYmd))stats.running++;
      stats.minutes+=taskEstimatedMinutes(o.t);
    });
    return stats;
  }
  function dailyStatusBadges(t,st,running,paused){
    const bits=[];
    bits.push(`<span class="dailyMetaChip">${escapeHtml((cats[t.cat]||{}).name||t.cat)}</span>`);
    if(t.important)bits.push('<span class="dailyMetaChip importantFlag">! 高优先级</span>');
    else if(t.core)bits.push('<span class="dailyMetaChip">◆ 核心</span>');
    else if(t.optional)bits.push('<span class="dailyMetaChip">可选</span>');
    if(st.done)bits.push('<span class="statusBadge completed">✓ 已完成</span>');
    else if(st.failed)bits.push('<span class="statusBadge overdue">× 已过期锁定</span>');
    else if(st.overdue)bits.push('<span class="statusBadge overdue">! 已逾期</span>');
    else if(st.warn)bits.push('<span class="statusBadge overdue">! 前次未完成</span>');
    else bits.push('<span class="statusBadge">待执行</span>');
    if(running)bits.push(`<span class="statusBadge ${paused?"paused":"running"}">${paused?"Ⅱ 已暂停":"◷ 计时中"}</span>`);
    bits.push(`<span class="dailyMetaChip">预计 ${taskEstimatedMinutes(t)}m</span>`);
    if(hasSteps(t.id)){const p=stepProgress(t,st.dayId||today,st.cycle||cycleYmd);bits.push(`<span class="dailyMetaChip">子任务 ${p.done}/${p.total}</span>`)}
    return bits.join("");
  }
  function dailySubtasks(t,dayId,cycle){
    if(!hasSteps(t.id))return "";
    const progress=stepProgress(t,dayId,cycle);
    const key=detailKey("daily-subtasks",t.id,`${cycle}-d${dayId}`);
    const fallback=progress.done>0&&progress.done<progress.total;
    return `<details class="subtaskInline" data-ui-details-key="${escapeHtml(key)}"${openAttr(key,fallback)}>
      <summary><span>子任务清单</span><strong>${progress.done}/${progress.total}</strong><span class="summaryChevron" aria-hidden="true">⌄</span></summary>
      <div class="subtaskInlineList">${subtaskPopoverRows(t,dayId,cycle)}</div>
    </details>`;
  }
  function dailyCard(o){
    const t=o.t,dayId=o.dayId,cycle=o.cycle||cycleYmd;
    const st={...occurrenceState(t,dayId,cycle),dayId,cycle};
    const active=readActiveTimer();
    const running=isActiveTaskOccurrence(t,dayId,cycle);
    const c=cats[t.cat]||cats.life;
    const title=escapeHtml(t.title);
    const url=safeUrl(t.url);
    const status=st.failed?"已过期":st.overdue?"已逾期":st.done?"已完成":dayId===today?"今日":"计划日";
    const completeDisabled=(st.failed||st.ignored)?" disabled data-locked=\"1\"":"";
    return `<article class="dailyCard ${st.done?"done completed":""} ${st.overdue||st.failed?"overdue":""} ${st.warn?"carryover":""} ${t.important?"highPriority":""} ${running?"running":""}" style="--daily-accent:${c.color||"var(--color-line-strong)"}" data-daily-task="${escapeHtml(t.id)}">
      <div class="dailyMain">
        <label class="dailyComplete" title="${title}：${st.done?"取消完成":"标记完成"}" aria-label="${title}：${st.done?"取消完成":"标记完成"}"><input type="checkbox" data-task="${escapeHtml(t.id)}" data-day="${dayId}" data-cycle="${escapeHtml(cycle)}" ${st.done?"checked":""}${completeDisabled}><span></span></label>
        <div class="dailyCopy">
          <h3 class="dailyTitle" title="${title}">${url?`<a class="taskLink" href="${url}" target="_blank" rel="noopener noreferrer"><span class="taskText">${title}</span><span aria-hidden="true">↗</span></a>`:`<span class="taskText">${title}</span>`}</h3>
          <div class="dailyMeta">${dailyStatusBadges(t,st,running,active?.paused)}</div>
          <div class="dailyMeta"><span class="dailyMetaChip">${escapeHtml(dayName(dayId))}${dayId===today?" · 今日":""}</span><span class="dailyMetaChip">${escapeHtml(status)}</span><span class="dailyMetaChip">本周 ${fmtMinutes(taskWeekMinutesUsed(t.id))}</span></div>
        </div>
      </div>
      <div class="dailyActions">
        ${running?`<button type="button" class="timerNowChip" data-view-target="time">${active?.paused?"已暂停":"计时中"} <span data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</span></button>`:`<button type="button" class="timerStartTiny" data-timer-start-task="${escapeHtml(t.id)}" data-timer-day="${dayId}" data-timer-cycle="${escapeHtml(cycle)}">◷ 开始计时</button>`}
        <button type="button" data-time-task-detail="${escapeHtml(t.id)}">时间账本</button>
        ${url?`<a href="${url}" target="_blank" rel="noopener noreferrer">快速打开 ↗</a>`:`<button type="button" data-open-task-editor="${escapeHtml(t.id)}">更多操作</button>`}
        <button type="button" data-edit-weekly-target="${escapeHtml(t.id)}">周目标 ${fmtMinutes(taskWeeklyMinutes(t))}</button>
      </div>
      ${dailySubtasks(t,dayId,cycle)}
    </article>`;
  }
  function weekMatrixCell(t,day){
    if(!t.days.includes(day.id))return `<td class="weekMatrixBlank" aria-label="${escapeHtml(t.title)} · ${escapeHtml(day.name)}无排程"><span>—</span></td>`;
    const st=occurrenceState(t,day.id,cycleYmd);
    const locked=st.failed||st.ignored;
    const state=st.failed?"锁定":st.overdue?"逾期":st.warn?"遗留":st.done?"完成":day.id===today?"今日":"待办";
    const stateClass=st.failed?"failed":st.overdue||st.warn?"attention":st.done?"done":day.id===today?"today":"pending";
    return `<td class="weekMatrixDay ${day.id===today?"isToday":""}"><label class="weekMatrixCheck ${stateClass}" aria-label="${escapeHtml(t.title)} · ${escapeHtml(day.name)} · ${state}"><input type="checkbox" data-task="${escapeHtml(t.id)}" data-day="${day.id}" data-cycle="${escapeHtml(cycleYmd)}" ${st.done?"checked":""} ${locked?'disabled data-locked="1"':""}><span aria-hidden="true">${st.done?"✓":st.failed?"×":st.overdue||st.warn?"!":""}</span><em>${state}</em></label></td>`;
  }
  function renderWeekMatrix(){
    const tasks=ringBlocks();
    const occurrences=tasks.flatMap(t=>t.days.map(dayId=>({t,dayId,cycle:cycleYmd})));
    const done=occurrences.filter(occurrenceDone).length;
    const attention=occurrences.filter(occurrenceAttention).length;
    const rows=tasks.map(t=>{
      const c=cats[t.cat]||cats.life;
      const progress=hasSteps(t.id)?stepProgress(t,stepContextDay(t),cycleYmd):null;
      return `<tr style="--matrix-accent:${c.color||"var(--color-line-strong)"}"><th scope="row" class="weekMatrixTask"><span>${escapeHtml(c.name||t.cat)}</span><b title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</b><em>预计 ${taskEstimatedMinutes(t)}m${progress?` · 子任务 ${progress.done}/${progress.total}`:""}</em></th>${days.map(day=>weekMatrixCell(t,day)).join("")}</tr>`;
    }).join("");
    return `<section class="weekMatrixPanel" aria-label="全周任务矩阵"><header class="weekMatrixHeader"><div><span>WEEK MATRIX</span><b>任务 × 星期面板</b><em>纵向看任务，横向看一周排程；单元格可直接完成或取消完成。</em></div><div class="weekMatrixSummary"><span><b>${tasks.length}</b> 个任务</span><span><b>${done}/${occurrences.length}</b> 已完成</span><span class="${attention?"attention":""}"><b>${attention}</b> 需关注</span></div></header><div class="weekMatrixScroll" tabindex="0" aria-label="可横向滚动查看完整星期"><table class="weekMatrixTable"><thead><tr><th scope="col">任务 / 分类</th>${days.map(day=>`<th scope="col" class="${day.id===today?"isToday":""}"><span>${escapeHtml(day.name)}</span>${day.id===today?"<em>今日</em>":""}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div><div class="weekMatrixLegend"><span>✓ 已完成</span><span>! 逾期 / 遗留</span><span>× 已锁定</span><span>— 当日无排程</span></div></section>`;
  }
  function renderDailyGroups(){
    const box=document.getElementById("mobileCards");
    if(!box)return;
    if(viewMode==="all"){
      box.innerHTML=renderWeekMatrix();
      return;
    }
    const occurrences=dailyOccurrencesForView();
    if(!occurrences.length){
      box.innerHTML='<div class="emptyState"><strong>今日执行环已经清空</strong><span>今天的硬任务已完成；可以休息，或切到周计划池推进长期主线。</span><button type="button" data-view-target="weekly">打开周计划池</button></div>';
      return;
    }
    const grouped=groupBy(occurrences,o=>o.t.cat||"life");
    const order=["life","gamecreate","language",...grouped.keys()].filter((v,i,a)=>a.indexOf(v)===i&&grouped.has(v));
    const html=order.map((cat,index)=>{
      const list=(grouped.get(cat)||[]).slice().sort(dailyPriority);
      const def=cats[cat]||{name:cat,icon:"•"};
      const stats=dailyGroupStats(list);
      const allDone=stats.total>0&&stats.done===stats.total;
      const hasAttention=list.some(occurrenceAttention);
      const key=detailKey("daily-group",cat,viewMode);
      const fallback=hasAttention||(!allDone&&index===0);
      return `<details class="dailyGroup ${hasAttention?"hasAttention":""} ${allDone?"completed":""}" data-ui-details-key="${escapeHtml(key)}"${openAttr(key,fallback)}>
        <summary><div class="sectionSummary"><div class="sectionSummaryMain"><b>${escapeHtml(def.name)}</b><span>${stats.total} 项 · 预计 ${fmtMinutes(stats.minutes)}${stats.running?` · ${stats.running} 项计时中`:""}</span></div><div class="sectionSummaryMetrics"><span class="dailyMetaChip">完成 ${stats.done}/${stats.total}</span>${stats.overdue?`<span class="statusBadge overdue">! 关注 ${stats.overdue}</span>`:""}${stats.important?`<span class="dailyMetaChip importantFlag">高优先 ${stats.important}</span>`:""}</div><span class="summaryChevron" aria-hidden="true">⌄</span></div></summary>
        <div class="dailyGroupBody">${list.map(dailyCard).join("")}</div>
      </details>`;
    }).join("");
    box.innerHTML=`<div class="dailyGroups">${html}</div>`;
  }
  function renderDailyStatus(){
    const host=document.getElementById("dayTabs");
    if(!host)return;
    const all=todayOccurrences(true);
    const done=all.filter(occurrenceDone).length;
    const urgent=all.filter(occurrenceAttention).length;
    const active=readActiveTimer();
    const running=active&&active.kind==="task";
    if(viewMode==="all"){
      const weekTasks=ringBlocks();
      const weekOccurrences=weekTasks.flatMap(t=>t.days.map(dayId=>({t,dayId,cycle:cycleYmd})));
      const weekDone=weekOccurrences.filter(occurrenceDone).length;
      host.innerHTML=`<div class="dailyStatusStrip"><div class="dailyStatusItem"><span>全周排程</span><b>${weekTasks.length} 个任务</b></div><div class="dailyStatusItem"><span>周节点完成</span><b>${weekDone}/${weekOccurrences.length}</b></div><div class="dailyStatusItem ${running?"running":""}"><span>${running?(active.paused?"计时已暂停":"正在计时"):"今日进度"}</span><b>${running?escapeHtml(active.title):`${done}/${all.length} 完成`}</b></div></div>`;
      return;
    }
    host.innerHTML=`<div class="dailyStatusStrip"><div class="dailyStatusItem"><span>今日完成</span><b>${done}/${all.length}</b></div><div class="dailyStatusItem"><span>尚待执行</span><b>${Math.max(0,all.length-done)} 项</b></div><div class="dailyStatusItem ${urgent?"attention":""}"><span>重点关注</span><b>${urgent?`${urgent} 项`:"状态正常"}</b></div><div class="dailyStatusItem ${running?"running":""}"><span>${running?(active.paused?"计时暂停":"正在计时"):"焦点计时"}</span><b>${running?escapeHtml(active.title):"未开始"}</b></div></div>`;
  }
  window.renderTable=function(){const table=document.getElementById("taskTable");if(table)table.innerHTML=""};
  window.renderMobileTabs=renderDailyStatus;
  window.renderMobileCards=renderDailyGroups;

  function weeklyStepKey(taskId,stepId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_${stepCode(taskId,stepId)}_w`}
  function weeklyStepDone(taskId,stepId,cycle=cycleYmd){return localStorage.getItem(weeklyStepKey(taskId,stepId,cycle))==="1"}
  function weeklyStepProgress(task){
    const steps=(stepTasks[task.id]||[]).filter(s=>s.enabled!==false);
    const done=steps.filter(s=>weeklyStepDone(task.id,s.id,cycleYmd)).length;
    return {steps,done,total:steps.length};
  }
  function weeklySubtasks(task){
    const progress=weeklyStepProgress(task);
    if(!progress.total)return "";
    const key=detailKey("weekly-subtasks",task.id);
    const rows=progress.steps.map(s=>{const done=weeklyStepDone(task.id,s.id);return `<label class="weeklyStepItem ${done?"done":""}"><input type="checkbox" data-weekly-step="1" data-weekly-step-task="${escapeHtml(task.id)}" data-weekly-step-id="${escapeHtml(s.id)}" ${done?"checked":""}><span>${escapeHtml(s.title)}</span></label>`}).join("");
    return `<details class="weeklySubtasks" data-ui-details-key="${escapeHtml(key)}"${openAttr(key,progress.done>0&&progress.done<progress.total)}><summary><b>子任务</b><span>${progress.done}/${progress.total}</span><span class="summaryChevron" aria-hidden="true">⌄</span></summary><div class="weeklyStepList">${rows}</div></details>`;
  }
  function weeklyCategoryRows(){return weeklyCategorySummary().filter(row=>row.count)}
  function selectedWeeklyCategory(rows,tasks){
    const saved=localStorage.getItem(WEEKLY_CATEGORY_KEY);
    if(saved==="all"||rows.some(r=>r.cat===saved))return saved;
    const active=readActiveTimer();
    if(active?.kind==="task"){
      const task=tasks.find(t=>String(t.id)===String(active.task_id));
      if(task)return taskTimeCategory(task);
    }
    const near=tasks.find(t=>{const st=weeklyTaskStatus(t);return st.target>0&&st.used<st.target&&st.used/st.target>=.7});
    if(near)return taskTimeCategory(near);
    return rows[0]?.cat||"all";
  }
  function weeklyCategoryTabs(rows,active,tasks){
    const totalDone=tasks.filter(t=>weeklyTaskStatus(t).state==="done").length;
    const buttons=[`<button type="button" class="weeklyCategoryTab ${active==="all"?"active":""}" data-weekly-category-tab="all"><span>全部</span><b>${tasks.length} 项</b><em>完成 ${totalDone}</em></button>`];
    rows.forEach(row=>{const def=timeCategoryDefs[row.cat]||timeCategoryDefs.life;buttons.push(`<button type="button" class="weeklyCategoryTab ${active===row.cat?"active":""}" data-weekly-category-tab="${escapeHtml(row.cat)}"><span>${escapeHtml(def.short)}</span><b>${row.count} 项</b><em>${fmtMinutes(row.used)} / ${fmtMinutes(row.target)}</em></button>`)});
    return `<nav class="weeklyCategoryTabs" aria-label="周计划分类">${buttons.join("")}</nav>`;
  }
  function weeklyCard(t){
    const st=weeklyTaskStatus(t);
    const pct=st.target?Math.min(100,st.pct):0;
    const def=timeCategoryDefs[taskTimeCategory(t)]||timeCategoryDefs.life;
    const active=readActiveTimer();
    const running=active&&active.kind==="task"&&String(active.task_id)===String(t.id);
    const pace=running?"running":st.state==="done"?"achieved":st.target&&st.used/st.target>=.7?"near":st.target&&st.used/st.target<.35&&weekPos(today)>=3?"behind":st.used?"active":"idle";
    const paceLabel={running:"◷ 正在计时",achieved:"✓ 已达成",near:"↗ 接近目标",behind:"! 明显落后",active:"推进中",idle:"尚未开始"}[pace];
    const remaining=st.target?Math.max(0,st.target-st.used):0;
    const url=safeUrl(t.url);
    return `<article class="weeklyMissionCard ${st.state} ${st.over?"over overdue":""} ${pace}" style="--w:${pct}%">
      <header class="missionHead"><div class="missionIcon" aria-hidden="true">${escapeHtml(def.icon)}</div><div class="missionTitleBlock"><b title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</b><span>${escapeHtml(taskDayHint(t))} · 预计 ${taskEstimatedMinutes(t)}m</span></div><div class="missionScore"><strong>${fmtMinutes(st.used)}${st.target?` / ${fmtMinutes(st.target)}`:""}</strong><em>${st.target?(st.state==="done"?"本周已达成":`剩余 ${fmtMinutes(remaining)}`):"未设周目标"}</em></div></header>
      <div class="missionMeter" aria-label="周目标进度 ${pct}%"><i></i></div>
      <footer class="missionActions"><button type="button" class="missionPrimary ${running?"active":""}" data-timer-start-task="${escapeHtml(t.id)}" data-timer-day="${today}" data-timer-cycle="${escapeHtml(cycleYmd)}">${running?`${active.paused?"继续计时":"计时中"} ${fmtTimer(activeTimerElapsedSeconds(active))}`:"开始计时"}</button><button type="button" class="missionGhost" data-time-task-detail="${escapeHtml(t.id)}">查看账本</button><button type="button" class="missionGhost safeTargetEdit" data-edit-weekly-target="${escapeHtml(t.id)}"><span>周目标</span><b>${st.target?fmtMinutes(st.target):"未设"}</b></button>${url?`<a class="missionLink" href="${url}" target="_blank" rel="noopener noreferrer">打开 ↗</a>`:""}</footer>
      ${weeklySubtasks(t)}
      <div class="missionBadges"><span class="statusBadge weeklyPace ${pace}">${paceLabel}</span>${planModeBadgeHtml(t)}<span>${escapeHtml(def.short)}</span>${t.important?'<span class="hot">! 高优先级</span>':""}${running?`<span class="statusBadge ${active.paused?"paused":"running"}">${active.paused?"已暂停":"计时中"}</span>`:""}</div>
    </article>`;
  }
  window.renderWeeklyPlanPanel=function(){
    const el=document.getElementById("weeklyPlanPanel");if(!el)return;
    const tasks=weeklyPoolBlocks().slice().sort(weeklyPlanSort);
    const rows=weeklyCategoryRows();
    const activeCategory=selectedWeeklyCategory(rows,tasks);
    const totalUsed=tasks.reduce((n,t)=>n+weeklyTaskStatus(t).used,0);
    const totalTarget=tasks.reduce((n,t)=>n+weeklyTaskStatus(t).target,0);
    const doneCount=tasks.filter(t=>weeklyTaskStatus(t).state==="done").length;
    const active=readActiveTimer();
    const activeHint=active?.kind==="task"?`<div class="weeklyActiveHint"><span>${active.paused?"PAUSED":"FOCUS"}</span><b>${escapeHtml(active.title)}</b><em data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</em></div>`:"";
    const summaries=rows.map(row=>{const def=timeCategoryDefs[row.cat]||timeCategoryDefs.life;const pct=row.target?Math.min(100,Math.round(row.used/row.target*100)):0;return `<div class="allocationChip" style="--w:${pct}%"><div><span>${escapeHtml(def.icon)}</span><b>${escapeHtml(def.short)}</b></div><em>${fmtMinutes(row.used)}${row.target?` / ${fmtMinutes(row.target)}`:""} · 完成 ${row.done}/${row.count}</em><i></i></div>`}).join("");
    const overviewKey=detailKey("weekly-overview",cycleYmd);
    const overview=summaries?`<details class="weeklyOverview" data-ui-details-key="${escapeHtml(overviewKey)}"${openAttr(overviewKey,false)}><summary><div class="sectionSummary"><div class="sectionSummaryMain weeklyOverviewTitle"><b>每周池总统计</b><span>${rows.length} 个分类 · 投入 ${fmtMinutes(totalUsed)}${totalTarget?` / ${fmtMinutes(totalTarget)}`:""} · 完成 ${doneCount}/${tasks.length}</span></div><div class="weeklyOverviewToggle" aria-hidden="true"><span class="weeklyOverviewClosedLabel">展开</span><span class="weeklyOverviewOpenLabel">收起</span><span class="summaryChevron">⌄</span></div></div></summary><div class="weeklyOverviewBody"><div class="allocationRibbon">${summaries}</div></div></details>`:"";
    const groupCats=activeCategory==="all"?timeCategoryOrder:[activeCategory];
    const groups=groupCats.map((cat,index)=>{
      const list=tasks.filter(t=>taskTimeCategory(t)===cat);if(!list.length)return "";
      const def=timeCategoryDefs[cat]||timeCategoryDefs.life;
      const used=list.reduce((n,t)=>n+weeklyTaskStatus(t).used,0), target=list.reduce((n,t)=>n+weeklyTaskStatus(t).target,0), done=list.filter(t=>weeklyTaskStatus(t).state==="done").length;
      const running=list.some(t=>active?.kind==="task"&&String(active.task_id)===String(t.id));
      const near=list.some(t=>{const st=weeklyTaskStatus(t);return st.target&&st.used<st.target&&st.used/st.target>=.7});
      const key=detailKey("weekly-group",cat);
      return `<details class="weeklyMissionGroup ${running?"running":""}" data-ui-details-key="${escapeHtml(key)}" style="--w:${target?Math.min(100,Math.round(used/target*100)):0}%"${openAttr(key,running||near||index===0)}><summary><div class="sectionSummary"><div class="sectionSummaryMain"><b>${escapeHtml(def.name)}</b><span>${list.length} 项 · 投入 ${fmtMinutes(used)} · 周目标 ${fmtMinutes(target)}</span></div><div class="sectionSummaryMetrics"><span class="dailyMetaChip">完成 ${done}/${list.length}</span>${running?'<span class="statusBadge running">◷ 计时中</span>':""}</div><span class="summaryChevron" aria-hidden="true">⌄</span></div></summary><div class="groupMeter"><i></i></div><div class="weeklyMissionGrid">${list.map(weeklyCard).join("")}</div></details>`;
    }).join("");
    el.innerHTML=`<div class="weeklyShell"><div class="weeklyCommandHero"><div><span>WEEKLY ALLOCATION</span><b>本周行动池</b><em>按分类收纳长期主线，优先展示正在计时和接近目标的任务。</em></div><div class="weeklyHeroStats"><div><span>本周投入</span><b>${fmtMinutes(totalUsed)}</b></div><div><span>周目标</span><b>${fmtMinutes(totalTarget)}</b></div><div><span>达成任务</span><b>${doneCount}/${tasks.length}</b></div></div></div>${activeHint}${weeklyCategoryTabs(rows,activeCategory,tasks)}${overview}<div class="weeklyTaskGroups">${groups||'<div class="weeklyEmpty"><b>周计划池为空</b><span>从任务编辑器把任务模式设为「周计划池」。</span><button type="button" data-open-task-editor>打开任务编辑器</button></div>'}</div></div>`;
  };

  function validGameDay(value){const n=Number(value);return [0,1,2,3,4,5,6].includes(n)?n:today}
  const savedGameDay=localStorage.getItem(GAME_SELECTED_DAY_KEY);
  gameQuestSelectedDay=savedGameDay==null?today:validGameDay(savedGameDay);
  gameQuestBoardMode=["today","week"].includes(localStorage.getItem(GQ_BOARD_MODE_KEY))?localStorage.getItem(GQ_BOARD_MODE_KEY):"today";
  function selectedEntry(entries){
    let entry=entries.find(e=>String(e.game.id)===String(selectedGameId));
    if(!entry)entry=entries[0]||null;
    return entry;
  }
  function gameTabs(entries,activeId,attr="data-gq-game-select"){
    if(entries.length<2)return "";
    return `<nav class="gameQuestGameTabs" aria-label="游戏选择">${entries.map(e=>`<button type="button" class="gameQuestGameTab ${String(e.game.id)===String(activeId)?"active":""}" ${attr}="${escapeHtml(e.game.id)}"><span>${escapeHtml(e.game.short||e.game.name)}</span><b>${e.done}/${e.total}</b></button>`).join("")}</nav>`;
  }
  function gameMetrics(todayStats,weeklyStats,visibleStats){
    const current=visibleStats||todayStats;
    return `<div class="gameQuestMetricSet"><span class="gameQuestMetric"><strong>${current.done}/${current.total}</strong><em>ITEMS</em></span><span class="gameQuestMetric"><strong>${current.cardsDone}/${current.cards}</strong><em>大任务</em></span><span class="gameQuestMetric"><strong>${Math.max(0,current.total-current.done)}</strong><em>剩余</em></span><span class="gameQuestMetric"><strong>${weeklyStats.done}/${weeklyStats.total}</strong><em>本周指标</em></span></div>`;
  }
  const GAME_STRIP_SELECTORS=[".gameQuestDays",".gameQuestFilterTabs",".gameQuestGameTabs"];
  function captureGameStripScroll(panel){
    return GAME_STRIP_SELECTORS.reduce((state,selector)=>{const strip=panel.querySelector(selector);if(strip)state[selector]=strip.scrollLeft;return state},{});
  }
  function restoreGameStripScroll(panel,state){
    requestAnimationFrame(()=>GAME_STRIP_SELECTORS.forEach(selector=>{
      const strip=panel.querySelector(selector);if(!strip)return;
      const saved=state[selector];
      if(Number.isFinite(saved)){strip.scrollLeft=Math.min(saved,Math.max(0,strip.scrollWidth-strip.clientWidth));return}
      const active=strip.querySelector(".active");if(!active||strip.scrollWidth<=strip.clientWidth+2)return;
      strip.scrollLeft=Math.max(0,active.offsetLeft-(strip.clientWidth-active.offsetWidth)/2);
    }));
  }
  window.renderGameQuestPanel=function(){
    const panel=document.getElementById("gameQuestPanel");if(!panel)return;
    const stripScroll=captureGameStripScroll(panel);
    const todayStats=gameQuestStats(gameQuestSelectedDay);
    const actualTodayStats=gameQuestStats(today);
    const weeklyStats=gameQuestWeeklyStats();
    const weekStats=gameQuestWeekStats();
    const active=readActiveTimer();
    const gqActive=active?.kind==="gamequest";
    const top=`<div class="gameQuestTopBar"><div class="gameQuestTopTitle"><span>GAME QUEST</span><strong>游戏作战区</strong><em>今日清理与本周作战池分区推进；指标、日期和游戏选择均可恢复。</em></div><div class="gameQuestTopMeter"><span class="gameQuestMiniRing" style="--p:${gameQuestBoardMode==="week"?weeklyStats.pct:todayStats.pct}%"><i>${gameQuestBoardMode==="week"?weeklyStats.pct:todayStats.pct}%</i></span></div><button type="button" class="gameQuestTopTimer ${gqActive?"active":""}" data-timer-start-gamequest="1" data-gamequest-day="${gameQuestSelectedDay}" data-cycle="${escapeHtml(cycleYmd)}"><span>${gqActive?(active.paused?"Ⅱ":"◷"):"◷"}</span><b ${gqActive?'data-live-timer':''}>${gqActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时"}</b><em>${gqActive?(active.paused?"已暂停":"游戏计时中"):`本周 ${fmtMinutes(taskWeekMinutesUsed("gamequest-board"))}`}</em></button><button type="button" class="gameQuestTodayQuick" id="gameQuestTodayBtn">今日</button></div>`;
    const modes=`<div class="gameQuestModeTabs" role="tablist" aria-label="游戏作战区模式"><button type="button" class="gameQuestModeBtn ${gameQuestBoardMode==="today"?"active":""}" data-gamequest-board-mode="today" role="tab" aria-selected="${gameQuestBoardMode==="today"}"><span>今日清理</span><b>${actualTodayStats.done}/${actualTodayStats.total}</b></button><button type="button" class="gameQuestModeBtn ${gameQuestBoardMode==="week"?"active":""}" data-gamequest-board-mode="week" role="tab" aria-selected="${gameQuestBoardMode==="week"}"><span>本周作战池</span><b>${weeklyStats.done}/${weeklyStats.total}</b></button></div>`;
    let body="";
    if(gameQuestBoardMode==="today"){
      const entries=gameQuestEntriesForDay(gameQuestSelectedDay);
      const selected=selectedEntry(entries);
      const activeId=selected?.game?.id||"";
      body=`<div class="gameQuestDailyPane"><div class="gameQuestMetaStrip"><span>今日指标 ${actualTodayStats.done}/${actualTodayStats.total} · 全周日清 ${weekStats.done}/${weekStats.total}</span><em>${todayStats.pct}% DAILY</em></div><div class="gameQuestDays">${gameQuestDayTabsHtml()}</div>${gameTabs(entries,activeId)}<div class="gameQuestSubHead"><span>${escapeHtml(dayName(gameQuestSelectedDay))}${gameQuestSelectedDay===today?"｜今日":""}</span>${gameMetrics(todayStats,weeklyStats,todayStats)}</div><div class="gameQuestGrid focused">${selected?gameQuestCardHtml(selected,gameQuestSelectedDay):'<div class="gameQuestEmpty"><b>这一天没有清理任务</b><span>可以返回今日，或在游戏任务编辑器添加指定日任务。</span><button type="button" id="gameQuestTodayBtn">返回今日</button></div>'}</div></div>`;
    }else{
      const entries=gameQuestWeeklyEntries();
      if(gameQuestWeeklyFilter!=="all"&&!entries.some(e=>String(e.game.id)===String(gameQuestWeeklyFilter)))gameQuestWeeklyFilter="all";
      const visible=gameQuestWeeklyFilter==="all"?entries:entries.filter(e=>String(e.game.id)===String(gameQuestWeeklyFilter));
      const visibleStats={done:visible.reduce((n,e)=>n+e.done,0),total:visible.reduce((n,e)=>n+e.total,0),cards:visible.length,cardsDone:visible.filter(e=>e.cardDone).length};
      const filters=`<nav class="gameQuestFilterTabs" aria-label="本周游戏筛选"><button type="button" class="${gameQuestWeeklyFilter==="all"?"active":""}" data-gq-weekly-filter="all"><span>全部</span><b>${weeklyStats.done}/${weeklyStats.total}</b></button>${entries.map(e=>`<button type="button" class="${gameQuestWeeklyFilter===String(e.game.id)?"active":""}" data-gq-weekly-filter="${escapeHtml(e.game.id)}"><span>${escapeHtml(e.game.short||e.game.name)}</span><b>${e.done}/${e.total}</b></button>`).join("")}</nav>`;
      const cards=visible.map((entry,index)=>{const key=detailKey("game-weekly",entry.game.id);return `<details class="gameWeeklyGroup" data-ui-details-key="${escapeHtml(key)}"${openAttr(key,gameQuestWeeklyFilter!=="all"||index===0)}><summary><div class="sectionSummary"><div class="sectionSummaryMain"><b>${escapeHtml(entry.game.name)}</b><span>${entry.total} 项 · 完成 ${entry.done} · 剩余 ${Math.max(0,entry.total-entry.done)}</span></div><span class="dailyMetaChip">${entry.done}/${entry.total}</span><span class="summaryChevron" aria-hidden="true">⌄</span></div></summary><div class="gameWeeklyGroupBody">${gameQuestWeeklyCardHtml(entry)}</div></details>`}).join("");
      body=`<div class="gameQuestWeeklyPane"><div class="gameQuestMetaStrip"><span>周常、深境与本周一次性目标</span><em>${weeklyStats.pct}% WEEK POOL</em></div>${filters}<div class="gameQuestSubHead"><span>${gameQuestWeeklyFilter==="all"?"全部游戏":"当前游戏"}</span>${gameMetrics(actualTodayStats,weeklyStats,visibleStats)}</div><div class="gameQuestGrid focused">${cards||'<div class="gameQuestEmpty"><b>本周作战池为空</b><span>从游戏任务编辑器添加周任务。</span><button type="button" data-open-game-editor>打开编辑器</button></div>'}</div></div>`;
    }
    panel.innerHTML=`<div class="gameQuestShell">${top}${modes}${body}</div>`;
    restoreGameStripScroll(panel,stripScroll);
  };

  function libraryItem(item,index,group,updatedAt){
    const url=safeUrl(item.url),title=escapeHtml(item.title||"未命名资料"),host=url?new URL(url).hostname.replace(/^www\./,""):"本机备注";
    const meta=`${host} · ${url?"LINK":"NOTE"} · ${updatedAt||"本机"}`;
    return `<article class="refItem refItemCard ${url?"":"refPlain"}" data-library-card data-library-text="${escapeHtml(`${group.title} ${item.title} ${host}`.toLowerCase())}"><span class="refItemNo">${String(index+1).padStart(2,"0")}</span><span class="refItemCopy"><strong title="${title}">${title}</strong><span title="${escapeHtml(meta)}">${escapeHtml(meta)}</span></span><span class="refItemActions">${url?`<a class="refItemAction refItemOpen" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="快速打开：${title}" title="快速打开：${title}">↗</a>`:`<span class="refItemAction refItemOpen disabled" aria-label="未设置链接" title="未设置链接">—</span>`}</span></article>`;
  }
  window.renderReferenceLibrary=function(){
    const grid=document.getElementById("refGrid");if(!grid)return;
    const groups=(refGroups||[]).filter(g=>g.enabled!==false);
    const last=localStorage.getItem(LIBRARY_LAST_GROUP_KEY)||groups[0]?.id||"";
    const updated=taskConfig?.updatedAt?new Date(taskConfig.updatedAt).toLocaleDateString("zh-CN",{month:"2-digit",day:"2-digit"}):"";
    const toolbar=`<div class="libraryToolbar"><label for="librarySearchInput">搜索资料</label><input id="librarySearchInput" type="search" value="${escapeHtml(libraryQuery)}" placeholder="搜索标题、分组或来源"><button type="button" data-open-ref-editor="1">管理资料库</button></div>`;
    const html=groups.map((group,index)=>{
      const items=(group.items||[]).filter(i=>i.enabled!==false);
      const links=items.filter(i=>safeUrl(i.url)).length;
      const key=detailKey("library-group",group.id);
      return `<details class="refGroup" data-ui-details-key="${escapeHtml(key)}" data-library-group="${escapeHtml(group.id)}"${openAttr(key,group.id===last)}><summary><span class="refGroupNo">${String(index+1).padStart(2,"0")}</span><span class="refGroupTitle">${escapeHtml(group.title)}</span><span class="refGroupCount">${items.length} 项 · ${links} 链接 · ${items.length-links} 备注</span><span class="refGroupCaret" aria-hidden="true">⌄</span></summary><div class="refGroupBody">${items.length?items.map((item,i)=>libraryItem(item,i,group,updated)).join(""):'<div class="refEmpty"><strong>这个分组还没有资料</strong><span>从资料库编辑器添加入口或备注。</span><button type="button" data-open-ref-editor="1">新增资料</button></div>'}</div></details>`;
    }).join("");
    grid.innerHTML=toolbar+(html||'<div class="refEmpty"><strong>资料库暂无启用分组</strong><span>打开资料库编辑器新增第一个分组。</span><button type="button" data-open-ref-editor="1">新增资料</button></div>');
    filterLibrary(libraryQuery);
  };
  function filterLibrary(query){
    const q=String(query||"").trim().toLowerCase();
    document.querySelectorAll("[data-library-card]").forEach(card=>{card.hidden=!!q&&!String(card.dataset.libraryText||"").includes(q)});
    document.querySelectorAll("[data-library-group]").forEach(group=>{const visible=[...group.querySelectorAll("[data-library-card]")].some(card=>!card.hidden);group.hidden=!!q&&!visible;if(q&&visible)group.open=true});
  }

  function enhanceDetails(root=document){
    root.querySelectorAll("details").forEach(details=>{const summary=details.querySelector(":scope > summary");if(summary)summary.setAttribute("aria-expanded",String(details.open))});
  }
  function visibleModal(){return [...document.querySelectorAll(".ghModal,.taskEditorModal,.refEditorModal,.gameQuestEditorModal,.timeDetailModal,.weeklyTargetModal")].find(m=>!m.classList.contains("hidden")&&getComputedStyle(m).display!=="none")}
  function focusableIn(modal){return [...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null)}
  function enhanceFormLabels(root=document){
    root.querySelectorAll("input,select,textarea").forEach(control=>{
      if(control.labels?.length||control.hasAttribute("aria-label")||control.hasAttribute("aria-labelledby"))return;
      const field=control.closest(".cfgField,.refCfgField,.refMiniField,.gqMetaField,.gqIconEditorBody,.targetCustomInput,.editorSearchBox");
      const label=field?.querySelector("label,.cfgDaysLabel")?.textContent?.trim()||control.getAttribute("placeholder")||control.name||control.className||"表单字段";
      control.setAttribute("aria-label",String(label).replace(/\s+/g," ").slice(0,120));
    });
  }
  function openModalFocus(modal){
    if(!modal)return;
    modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
    document.body.classList.add("modalOpen");
    const title=modal.querySelector(".ghModalTitle,.taskEditorTitle,.timeDetailTitle");
    if(title){if(!title.id)title.id=`${modal.id||"modal"}Title`;modal.setAttribute("aria-labelledby",title.id)}
    enhanceFormLabels(modal);
    requestAnimationFrame(()=>{const close=modal.querySelector('.ghCloseBtn,[data-time-modal-close],.weeklyTargetClose');(close||focusableIn(modal)[0])?.focus()});
  }
  function closeModalFocus(){document.body.classList.remove("modalOpen");requestAnimationFrame(()=>{if(lastModalTrigger?.isConnected)lastModalTrigger.focus();lastModalTrigger=null})}
  function enhanceUi(){enhanceDetails();enhanceFormLabels();document.querySelectorAll(".viewDockBtn").forEach(btn=>btn.setAttribute("aria-current",btn.classList.contains("active")?"page":"false"))}

  document.addEventListener("toggle",event=>{
    const details=event.target;
    if(!(details instanceof HTMLDetailsElement))return;
    const summary=details.querySelector(":scope > summary");if(summary)summary.setAttribute("aria-expanded",String(details.open));
    const key=details.dataset.uiDetailsKey;
    if(key){disclosureState[key]=details.open;saveDisclosure()}
    if(details.matches("[data-library-group]")&&details.open)localStorage.setItem(LIBRARY_LAST_GROUP_KEY,details.dataset.libraryGroup||"");
  },true);
  document.body.addEventListener("click",event=>{
    const weeklyTab=event.target.closest("[data-weekly-category-tab]");
    if(weeklyTab){event.preventDefault();event.stopPropagation();localStorage.setItem(WEEKLY_CATEGORY_KEY,weeklyTab.dataset.weeklyCategoryTab||"all");renderAll();return}
    const game=event.target.closest("[data-gq-game-select]");
    if(game){event.preventDefault();event.stopPropagation();selectedGameId=game.dataset.gqGameSelect||"";localStorage.setItem(GAME_SELECTED_GAME_KEY,selectedGameId);renderAll();return}
    const day=event.target.closest("[data-gamequest-day-select]");
    if(day)localStorage.setItem(GAME_SELECTED_DAY_KEY,String(validGameDay(day.dataset.gamequestDaySelect)));
    if(event.target.closest("#gameQuestTodayBtn"))localStorage.setItem(GAME_SELECTED_DAY_KEY,String(today));
    const modalTrigger=event.target.closest("#githubSetupBtn,#githubStatus,#controlGithubBtn,#controlTaskEditorBtn,#controlRefEditorBtn,#controlGameQuestEditorBtn,[data-open-task-editor],[data-open-ref-editor],[data-open-game-editor],[data-edit-weekly-target],[data-time-task-detail],[data-time-gamequest-detail]");
    if(modalTrigger){lastModalTrigger=modalTrigger;setTimeout(()=>openModalFocus(visibleModal()),0)}
    const modalClose=event.target.closest(".ghCloseBtn,.editorBottomBar button:first-child,[data-time-modal-close],[data-target-close]");
    if(modalClose)setTimeout(closeModalFocus,0);
    if(event.target.closest("[data-open-task-editor]")){event.preventDefault();openTaskEditor();return}
    if(event.target.closest("[data-open-game-editor]")){event.preventDefault();openGameQuestEditor();return}
  });
  document.addEventListener("input",event=>{
    if(event.target?.id!=="librarySearchInput")return;
    libraryQuery=event.target.value;localStorage.setItem(LIBRARY_SEARCH_KEY,libraryQuery);filterLibrary(libraryQuery);
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"){setTimeout(()=>{if(!visibleModal())closeModalFocus()},0);return}
    if(event.key!=="Tab")return;
    const modal=visibleModal();if(!modal)return;
    const focusable=focusableIn(modal);if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });

  document.body.addEventListener("change",event=>{
    const box=event.target.closest?.("[data-weekly-step]");if(!box)return;
    event.preventDefault();event.stopPropagation();
    syncSetItem(weeklyStepKey(box.dataset.weeklyStepTask,box.dataset.weeklyStepId),box.checked);
    if(box.checked)window.TaskRingEffects?.play({level:"micro",category:"",anchor:box,title:"子任务完成",eventId:`weekly-step:${cycleYmd}:${box.dataset.weeklyStepTask}:${box.dataset.weeklyStepId}`});
    showToast(box.checked?"子任务已完成":"已取消子任务","ok",1100);renderAll();
  },true);

  const coreRenderAll=window.renderAll;
  window.renderAll=function(){const result=coreRenderAll.apply(this,arguments);enhanceUi();return result};
  window.TaskRingProductUi={version:"1.0.0",enhance:enhanceUi,openAttribute:openAttr,isOpen:disclosureOpen};
  enhanceUi();
  if(typeof window.TaskRingCoreBoot==="function")window.TaskRingCoreBoot();
  else renderAll();
})();
