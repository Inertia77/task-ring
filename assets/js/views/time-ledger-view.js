// v20.1 Time Ledger View
// 独立管理时间账本：任务目标不再内联输入，改为显式按钮 + 确认弹窗。
(function(){
  const TIME_TASK_SEARCH_KEY=`${GH_PREFIX}time_task_search_v1`;
  const TIME_LOG_WEEK_KEY="taskring_time_log_week_v1";
  let timeTaskSearch=localStorage.getItem(TIME_TASK_SEARCH_KEY)||"";
  let timeLogWeek=localStorage.getItem(TIME_LOG_WEEK_KEY)||"all";

  function timeLogWeekKey(log){
    const date=timeLogOperationalDate(log);
    const start=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    start.setDate(start.getDate()-((start.getDay()+6)%7));
    return ymd(start);
  }
  function timeLogWeekLabel(key){
    const start=new Date(`${key}T12:00:00`);
    if(Number.isNaN(start.getTime()))return key;
    const end=new Date(start);
    end.setDate(end.getDate()+6);
    const range=`${start.getMonth()+1}/${start.getDate()}—${end.getMonth()+1}/${end.getDate()}`;
    return key===ymd(cycleStart)?`本周 · ${range}`:range;
  }
  function exportTimeHistory(){
    const payload={version:1,section:"time_logs",exportedAt:new Date().toISOString(),count:readTimeLogs().length,time_logs:readTimeLogs()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=`taskring-time-history-${ymd(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
    showToast(`已导出 ${payload.count} 条时间记录`,"ok",1800);
  }

  function targetButton(taskId,target){
    return `<div class="timeTaskActions"><button type="button" class="timeManualAddBtn" data-manual-time-entry="task" data-manual-task-id="${escapeHtml(taskId)}"><span>+补记</span><b>实际时间</b></button><button type="button" class="timeTargetSafeBtn" data-edit-weekly-target="${escapeHtml(taskId)}"><span>周目标</span><b>${target?fmtMinutes(target):"未设"}</b></button></div>`;
  }
  function taskSearchText(task){
    return [task.title,taskTimeCategory(task),timeCategoryLabel(taskTimeCategory(task)),(timeCategoryDefs[taskTimeCategory(task)]||{}).short,taskPlanningMode(task),((taskPlanModeDefs||{})[taskPlanningMode(task)]||{}).name].join(" ").toLowerCase();
  }
  function gameQuestSearchMatched(query){
    const q=String(query||"").trim().toLowerCase();
    if(!q)return true;
    return "game quest 游戏 作战区 游戏作战区 整体计时".includes(q);
  }
  function fitnessSearchMatched(query){
    const q=String(query||"").trim().toLowerCase();
    if(!q)return true;
    return "body fitness 训练 健身 体育 训练区 整体计时".includes(q);
  }
  function taskSearchBox(total,visible){
    return `<div class="timeTaskSearchWrap"><label for="timeTaskSearchInput">搜索任务账</label><div class="timeTaskSearchRow"><input id="timeTaskSearchInput" type="search" value="${escapeHtml(timeTaskSearch)}" placeholder="搜索任务名、分类或模式"><span class="timeTaskSearchMeta">${visible}/${total}</span></div></div>`;
  }
  function taskEmptyHtml(query){
    return `<div class="timeTaskEmpty"><b>没有匹配的任务</b><span>${query?`当前搜索：${escapeHtml(query)}`:"可以在上面输入任务名或分类搜索。"}</span></div>`;
  }

  document.addEventListener("input",event=>{
    if(event.target?.id!=="timeTaskSearchInput")return;
    timeTaskSearch=event.target.value||"";
    localStorage.setItem(TIME_TASK_SEARCH_KEY,timeTaskSearch);
    if(timeLedgerView==="tasks")renderTimePanel();
  });
  document.addEventListener("change",event=>{
    if(event.target?.id!=="timeLogWeekSelect")return;
    timeLogWeek=event.target.value||"all";
    localStorage.setItem(TIME_LOG_WEEK_KEY,timeLogWeek);
    if(timeLedgerView==="logs")renderTimePanel();
  });
  document.addEventListener("click",event=>{
    const exportBtn=event.target.closest?.("[data-export-time-history]");
    if(!exportBtn)return;
    event.preventDefault();
    event.stopPropagation();
    exportTimeHistory();
  });

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
    const activeHtml=active?`<div class="activeTimerCard ${active.paused?"paused":"running"} ${activeWarn?"warn":""}"><div class="activeTimerMain"><div class="activeTimerKicker">${active.paused?"PAUSED":"FOCUS TIMER"}</div><div class="activeTimerTitle">${escapeHtml(active.title)}</div><div class="activeTimerSub">${timeCategoryLabel(active.category)} · 预计 ${active.estimated_minutes||"?"}m${activeWeekText}${activeWarn?" · 已超过预计 2 倍，确认是否忘关":""}</div></div><div class="activeTimerRight"><div class="activeTimerClock" data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</div><div class="activeTimerActions">${active.paused?`<button type="button" data-timer-resume>继续</button>`:`<button type="button" data-timer-pause>暂停</button>`}<button type="button" data-timer-complete>完成并记录</button><button type="button" class="timerGhost" data-timer-abandon>放弃</button></div></div></div>`:`<div class="timeLedgerIdle v20"><span>◷</span><b>当前没有计时中</b><em>从任务、周计划池、训练区或游戏作战区开始计时。</em></div>`;
    const overviewRows=timeCategoryOrder.map(k=>{
      const def=timeCategoryDefs[k];
      const used=week[k]||0;
      const sharePct=totalWeek?used/totalWeek*100:0;
      const over=used>def.budget;
      return `<div class="timeBudgetRow ${over?"over":""}" title="${escapeHtml(def.name)}：${fmtMinutes(used)} · 占本周 ${Math.round(sharePct)}%"><div class="timeBudgetLabel"><b>${escapeHtml(def.short)}</b></div><div class="timeBudgetBar" style="--w:${sharePct.toFixed(2)}%"><span></span></div><div class="timeBudgetValue">${fmtMinutes(used)}</div></div>`;
    }).join("");
    const activeGameMinutes=active&&active.kind==="gamequest"?Math.max(1,Math.round(activeTimerElapsedSeconds(active)/60)):0;
    const gameWeek=readTimeLogs().filter(log=>(log.kind==="gamequest"||log.task_id==="gamequest-board")&&isLogInCurrentCycle(log)).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeGameMinutes;
    const gameToday=readTimeLogs().filter(log=>(log.kind==="gamequest"||log.task_id==="gamequest-board")&&isLogToday(log)).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeGameMinutes;
    const gameRow=`<div class="timeTaskRow timeGameQuestRow"><button type="button" class="timeTaskName" data-time-gamequest-detail="1"><span>GAME QUEST</span><b>游戏作战区</b></button><div class="timeTaskMeter" style="--w:${gameWeek?100:0}%"><i></i></div><div class="timeTaskValue"><b>${fmtMinutes(gameWeek)}</b><span>今日 ${fmtMinutes(gameToday)}</span></div><div class="timeTaskActions"><button type="button" class="timeManualAddBtn" data-manual-time-entry="gamequest"><span>+补记</span><b>实际时间</b></button><div class="timeTargetSafeBtn timeTargetReadOnly"><span>统计方式</span><b>整体计时</b></div></div></div>`;
    const activeFitnessMinutes=active&&active.kind==="fitness"?Math.max(1,Math.round(activeTimerElapsedSeconds(active)/60)):0;
    const fitnessWeek=readTimeLogs().filter(log=>(log.kind==="fitness"||log.task_id==="fitness-training")&&isLogInCurrentCycle(log)).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeFitnessMinutes;
    const fitnessToday=readTimeLogs().filter(log=>(log.kind==="fitness"||log.task_id==="fitness-training")&&isLogToday(log)).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeFitnessMinutes;
    const fitnessRow=`<div class="timeTaskRow timeFitnessRow"><button type="button" class="timeTaskName" data-time-fitness-detail="1"><span>BODY / TRAINING</span><b>训练区</b></button><div class="timeTaskMeter" style="--w:${fitnessWeek?100:0}%"><i></i></div><div class="timeTaskValue"><b>${fmtMinutes(fitnessWeek)}</b><span>今日 ${fmtMinutes(fitnessToday)}</span></div><div class="timeTaskActions"><button type="button" class="timeManualAddBtn" data-manual-time-entry="fitness"><span>+补记</span><b>训练时间</b></button><div class="timeTargetSafeBtn timeTargetReadOnly"><span>统计方式</span><b>整体计时</b></div></div></div>`;

    const allTasks=(taskConfig?.tasks||[]).filter(t=>t.enabled!==false).slice().sort((a,b)=>{
      const au=taskWeekMinutesUsed(a.id),bu=taskWeekMinutesUsed(b.id);
      const at=taskWeeklyMinutes(a),bt=taskWeeklyMinutes(b);
      return (bu+bt)-(au+at)||String(a.title).localeCompare(String(b.title),"zh-Hans-CN");
    });
    const q=String(timeTaskSearch||"").trim().toLowerCase();
    const visibleTasks=q?allTasks.filter(t=>taskSearchText(t).includes(q)):allTasks;
    const taskRows=visibleTasks.map(t=>{
      const used=taskWeekMinutesUsed(t.id);
      const target=taskWeeklyMinutes(t);
      const pct=target?Math.min(160,Math.round(used/target*100)):0;
      const over=target>0&&used>target;
      return `<div class="timeTaskRow ${over?"over":""}"><button type="button" class="timeTaskName" data-time-task-detail="${escapeHtml(t.id)}"><span>${timeCategoryLabel(taskTimeCategory(t))}</span>${planModeBadgeHtml(t)}<b>${escapeHtml(t.title)}</b></button><div class="timeTaskMeter" style="--w:${target?Math.min(100,pct):0}%"><i></i></div><div class="timeTaskValue"><b>${fmtMinutes(used)}</b><span>${target?`/ ${fmtMinutes(target)}`:"未设目标"}</span></div>${targetButton(t.id,target)}</div>`;
    }).join("");
    const showGameRow=gameQuestSearchMatched(q);
    const showFitnessRow=fitnessSearchMatched(q);
    const specialRows=(showFitnessRow?1:0)+(showGameRow?1:0);
    const taskBody=`${taskSearchBox(allTasks.length+2,specialRows+visibleTasks.length)}<div class="timeTaskList">${showFitnessRow?fitnessRow:""}${showGameRow?gameRow:""}${taskRows||(!specialRows?taskEmptyHtml(timeTaskSearch):"")}</div>`;

    const allLogs=readTimeLogs().slice().sort(timeLogSortDesc);
    const availableWeeks=[...new Set(allLogs.map(timeLogWeekKey))].sort((a,b)=>b.localeCompare(a));
    if(timeLogWeek!=="all"&&!availableWeeks.includes(timeLogWeek))timeLogWeek="all";
    const scopedLogs=timeLogWeek==="all"?allLogs:allLogs.filter(log=>timeLogWeekKey(log)===timeLogWeek);
    const visibleLogs=scopedLogs.slice(0,120);
    const logRows=visibleLogs.map(log=>`<li class="timeLogItem"><div><b>${escapeHtml(log.title)}</b><span>${fmtLogWhen(log)} · ${timeCategoryLabel(log.category)}${timeLogSourceLabel(log)}</span></div><strong>${fmtMinutes(log.duration_minutes)}</strong><button type="button" data-time-log-delete="${escapeHtml(log.id)}">删除</button></li>`).join("")||`<li class="timeLogItem empty"><div><b>这个周次暂无时间记录</b><span>可以切换到其他周次，或手动补记时间</span></div><strong>0m</strong></li>`;
    const historyOptions=`<option value="all"${timeLogWeek==="all"?" selected":""}>全部历史</option>${availableWeeks.map(key=>`<option value="${key}"${timeLogWeek===key?" selected":""}>${timeLogWeekLabel(key)}</option>`).join("")}`;
    const historyToolbar=`<div class="timeHistoryToolbar"><div class="timeHistorySummary"><span>HISTORY / ARCHIVE</span><b>${allLogs.length} 条 · ${availableWeeks.length} 周</b><em>本机最多保留 ${TIME_LOG_LIMIT} 条；云端同步最近 ${TIME_GH_LOG_LIMIT} 条。</em></div><label class="timeHistoryWeekPicker"><span>查看周次</span><select id="timeLogWeekSelect">${historyOptions}</select></label><button type="button" class="timeHistoryExportBtn" data-export-time-history><span>↓</span><b>导出备份</b></button></div>`;
    const historyFoot=scopedLogs.length>visibleLogs.length?`<div class="timeHistoryFoot">当前周次共 ${scopedLogs.length} 条，这里显示最近 ${visibleLogs.length} 条；完整内容可导出备份。</div>`:`<div class="timeHistoryFoot">当前显示 ${visibleLogs.length} 条记录。删除操作会同步到其他设备。</div>`;
    const historyBody=`${historyToolbar}<ul class="timeLogList">${logRows}</ul>${historyFoot}`;
    const todayChips=timeCategoryOrder.filter(k=>todayTotals[k]).map(k=>`<span>${timeCategoryDefs[k].short} ${fmtMinutes(todayTotals[k])}</span>`).join("")||`<span>今天暂无计时</span>`;
    const taskRanks=weekTaskTotals().slice(0,6).map(row=>{
      const task=taskById(row.task_id);
      const target=task?taskWeeklyMinutes(task):0;
      const over=target>0&&row.minutes>target;
      const value=target?`${fmtMinutes(row.minutes)} / ${fmtMinutes(target)}`:fmtMinutes(row.minutes);
      return `<li class="${over?"over":""}"><b>${escapeHtml(row.title)}</b><span>${timeCategoryLabel(row.category)} · ${value}</span></li>`;
    }).join("")||`<li><b>暂无本周任务记录</b><span>完成一次计时后出现</span></li>`;
    const body=timeLedgerView==="tasks"?taskBody:timeLedgerView==="logs"?historyBody:`<div class="timeBudgetList">${overviewRows}</div><div class="timeLogGrid"><div class="timeRecentLine"><span>今日分布</span><div class="timeTodayChips">${todayChips}</div></div><div class="timeRecentLine timeTaskRank"><span>本周任务排行</span><ol>${taskRanks}</ol></div></div>`;
    el.innerHTML=`<div class="timePanelShell v20"><div class="timePanelTop">${activeHtml}</div><div class="timePanelHeader"><div><span>TIME LEDGER</span><b>时间账本</b><em>总览看方向，任务账可随时补记，明细页删错账。</em></div><div class="timeStatCards"><div><span>今日</span><b>${fmtMinutes(totalToday)}</b></div><div><span>本周</span><b>${fmtMinutes(totalWeek)}</b></div></div></div><nav class="timeSubTabs" aria-label="时间账本切换"><button type="button" class="${timeLedgerView==="overview"?"active":""}" data-time-tab="overview">总览</button><button type="button" class="${timeLedgerView==="tasks"?"active":""}" data-time-tab="tasks">任务账</button><button type="button" class="${timeLedgerView==="logs"?"active":""}" data-time-tab="logs">明细</button></nav>${body}</div>`;
  };
})();
