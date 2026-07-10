// v20 Time Ledger View
// 独立管理时间账本：任务目标不再内联输入，改为显式按钮 + 确认弹窗。
(function(){
  function targetButton(taskId,target){
    return `<button type="button" class="timeTargetSafeBtn" data-edit-weekly-target="${escapeHtml(taskId)}"><span>周目标</span><b>${target?fmtMinutes(target):"未设"}</b></button>`;
  }
  window.renderTimePanel=function(){
    const el=document.getElementById("timePanel");
    if(!el)return;
    const active=readActiveTimer();
    const week=weekTimeTotals();
    const todayTotals=todayTimeTotals();
    const activeCat=active?normalizeTimeCategory(active.category):null;
    if(active){week[activeCat]=(week[activeCat]||0)+Math.round(activeTimerElapsedSeconds(active)/60);todayTotals[activeCat]=(todayTotals[activeCat]||0)+Math.round(activeTimerElapsedSeconds(active)/60)}
    const totalWeek=Object.values(week).reduce((a,b)=>a+b,0);
    const totalToday=Object.values(todayTotals).reduce((a,b)=>a+b,0);
    const activeWarn=active&&active.estimated_minutes&&activeTimerElapsedSeconds(active)>active.estimated_minutes*120;
    const activeTarget=active?.kind==="task"?taskWeeklyMinutes(taskById(active.task_id)||{}):0;
    const activeUsed=active?.kind==="task"?taskWeekMinutesUsed(active.task_id)+Math.round(activeTimerElapsedSeconds(active)/60):0;
    const activeWeekText=active?.kind==="task"&&activeTarget?` · 本周 ${fmtMinutes(activeUsed)} / ${fmtMinutes(activeTarget)}`:"";
    const activeHtml=active?`<div class="activeTimerCard ${active.paused?"paused":"running"} ${activeWarn?"warn":""}"><div class="activeTimerMain"><div class="activeTimerKicker">${active.paused?"PAUSED":"FOCUS TIMER"}</div><div class="activeTimerTitle">${escapeHtml(active.title)}</div><div class="activeTimerSub">${timeCategoryLabel(active.category)} · 预计 ${active.estimated_minutes||"?"}m${activeWeekText}${activeWarn?" · 已超过预计 2 倍，确认是否忘关":""}</div></div><div class="activeTimerRight"><div class="activeTimerClock" data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</div><div class="activeTimerActions">${active.paused?`<button type="button" data-timer-resume>继续</button>`:`<button type="button" data-timer-pause>暂停</button>`}<button type="button" data-timer-complete>完成并记录</button><button type="button" class="timerGhost" data-timer-abandon>放弃</button></div></div></div>`:`<div class="timeLedgerIdle v20"><span>◷</span><b>当前没有计时中</b><em>从任务、周计划池或游戏作战区开始计时。</em></div>`;
    const overviewRows=timeCategoryOrder.map(k=>{
      const def=timeCategoryDefs[k];
      const used=week[k]||0;
      const pct=Math.min(160,Math.round(used/def.budget*100));
      const over=used>def.budget;
      return `<div class="timeBudgetRow ${over?"over":""}" title="${escapeHtml(def.name)}：${fmtMinutes(used)} / ${fmtMinutes(def.budget)}"><div class="timeBudgetLabel"><span>${def.icon}</span><b>${escapeHtml(def.short)}</b></div><div class="timeBudgetBar" style="--w:${Math.min(100,pct)}%"><span></span></div><div class="timeBudgetValue">${fmtMinutes(used)}</div></div>`;
    }).join("");
    const activeGameMinutes=active&&active.kind==="gamequest"?Math.max(1,Math.round(activeTimerElapsedSeconds(active)/60)):0;
    const gameWeek=readTimeLogs().filter(log=>(log.kind==="gamequest"||log.task_id==="gamequest-board")&&isLogInCurrentCycle(log)).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeGameMinutes;
    const gameToday=readTimeLogs().filter(log=>(log.kind==="gamequest"||log.task_id==="gamequest-board")&&isLogToday(log)).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeGameMinutes;
    const gameRow=`<div class="timeTaskRow timeGameQuestRow"><button type="button" class="timeTaskName" data-time-gamequest-detail="1"><span>GAME QUEST</span><b>游戏作战区</b></button><div class="timeTaskMeter" style="--w:${gameWeek?100:0}%"><i></i></div><div class="timeTaskValue"><b>${fmtMinutes(gameWeek)}</b><span>今日 ${fmtMinutes(gameToday)}</span></div><div class="timeTargetSafeBtn timeTargetReadOnly"><span>统计方式</span><b>整体计时</b></div></div>`;
    const taskRows=(taskConfig?.tasks||[]).filter(t=>t.enabled!==false).slice().sort((a,b)=>{
      const au=taskWeekMinutesUsed(a.id),bu=taskWeekMinutesUsed(b.id);
      const at=taskWeeklyMinutes(a),bt=taskWeeklyMinutes(b);
      return (bu+bt)-(au+at)||String(a.title).localeCompare(String(b.title),"zh-Hans-CN");
    }).map(t=>{
      const used=taskWeekMinutesUsed(t.id);
      const target=taskWeeklyMinutes(t);
      const pct=target?Math.min(160,Math.round(used/target*100)):0;
      const over=target>0&&used>target;
      return `<div class="timeTaskRow ${over?"over":""}"><button type="button" class="timeTaskName" data-time-task-detail="${escapeHtml(t.id)}"><span>${timeCategoryLabel(taskTimeCategory(t))}</span>${planModeBadgeHtml(t)}<b>${escapeHtml(t.title)}</b></button><div class="timeTaskMeter" style="--w:${target?Math.min(100,pct):0}%"><i></i></div><div class="timeTaskValue"><b>${fmtMinutes(used)}</b><span>${target?`/ ${fmtMinutes(target)}`:"未设目标"}</span></div>${targetButton(t.id,target)}</div>`;
    }).join("");
    const logRows=readTimeLogs().slice().sort(timeLogSortDesc).slice(0,60).map(log=>`<li class="timeLogItem"><div><b>${escapeHtml(log.title)}</b><span>${fmtLogWhen(log)} · ${timeCategoryLabel(log.category)}</span></div><strong>${fmtMinutes(log.duration_minutes)}</strong><button type="button" data-time-log-delete="${escapeHtml(log.id)}">删除</button></li>`).join("")||`<li class="timeLogItem empty"><div><b>暂无时间记录</b><span>点任务或游戏作战区开始计时</span></div><strong>0m</strong></li>`;
    const todayChips=timeCategoryOrder.filter(k=>todayTotals[k]).map(k=>`<span>${timeCategoryDefs[k].icon} ${timeCategoryDefs[k].short} ${fmtMinutes(todayTotals[k])}</span>`).join("")||`<span>今天暂无计时</span>`;
    const taskRanks=weekTaskTotals().slice(0,6).map(row=>{
      const task=taskById(row.task_id);
      const target=task?taskWeeklyMinutes(task):0;
      const over=target>0&&row.minutes>target;
      const value=target?`${fmtMinutes(row.minutes)} / ${fmtMinutes(target)}`:fmtMinutes(row.minutes);
      return `<li class="${over?"over":""}"><b>${escapeHtml(row.title)}</b><span>${timeCategoryLabel(row.category)} · ${value}</span></li>`;
    }).join("")||`<li><b>暂无本周任务记录</b><span>完成一次计时后出现</span></li>`;
    const body=timeLedgerView==="tasks"?`<div class="timeTaskList">${gameRow}${taskRows}</div>`:timeLedgerView==="logs"?`<ul class="timeLogList">${logRows}</ul>`:`<div class="timeBudgetList">${overviewRows}</div><div class="timeLogGrid"><div class="timeRecentLine"><span>今日分布</span><div class="timeTodayChips">${todayChips}</div></div><div class="timeRecentLine timeTaskRank"><span>本周任务排行</span><ol>${taskRanks}</ol></div></div>`;
    el.innerHTML=`<div class="timePanelShell v20"><div class="timePanelHeader"><div><span>TIME LEDGER</span><b>时间账本</b><em>总览看方向，任务页查账，明细页删错账。</em></div><div class="timeStatCards"><div><span>今日</span><b>${fmtMinutes(totalToday)}</b></div><div><span>本周</span><b>${fmtMinutes(totalWeek)}</b></div></div></div><div class="timePanelTop">${activeHtml}</div><nav class="timeSubTabs" aria-label="时间账本切换"><button type="button" class="${timeLedgerView==="overview"?"active":""}" data-time-tab="overview">总览</button><button type="button" class="${timeLedgerView==="tasks"?"active":""}" data-time-tab="tasks">任务账</button><button type="button" class="${timeLedgerView==="logs"?"active":""}" data-time-tab="logs">明细</button></nav>${body}</div>`;
  };
})();
