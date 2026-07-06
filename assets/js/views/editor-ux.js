// v20 Editor UX
// 独立管理任务编辑器：停用任务收纳、搜索/筛选、折叠卡片、周目标确认弹窗。
(function(){
  const EDITOR_FILTER_KEY="taskring_editor_filter_v20";
  let editorUiState={scope:"active",query:""};
  function loadEditorState(){try{editorUiState=Object.assign(editorUiState,JSON.parse(localStorage.getItem(EDITOR_FILTER_KEY)||"{}")||{})}catch(e){}}
  function saveEditorState(){try{localStorage.setItem(EDITOR_FILTER_KEY,JSON.stringify(editorUiState))}catch(e){}}
  function editorMatches(t){
    const q=String(editorUiState.query||"").trim().toLowerCase();
    if(!q)return true;
    const hay=[t.title,t.id,t.code,t.cat,taskPlanningMode(t),taskTimeCategory(t),(t.steps||[]).map(s=>s.title).join(" ")].join(" ").toLowerCase();
    return hay.includes(q);
  }
  function dayBoxesHtml(t){return [1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" class="cfgDay" value="${d}" ${t.days?.includes(d)?"checked":""}>${dayName(d)}</label>`).join("")}
  function rowStatus(t){
    const mode=taskPlanningMode(t);
    const cat=timeCategoryDefs[taskTimeCategory(t)]||timeCategoryDefs.life;
    return `<span class="editorBadge ${mode}">${taskPlanModeDefs[mode]?.short||mode}</span><span class="editorBadge">${cat.icon} ${escapeHtml(cat.short)}</span>${t.enabled===false?`<span class="editorBadge off">停用</span>`:""}${t.important?`<span class="editorBadge hot">重</span>`:""}`;
  }
  window.taskEditorRowHtml=function(t){
    const stepCodes=(t.steps||[]).map(s=>s.code||"");
    const stepTitles=(t.steps||[]).filter(s=>s.enabled!==false).map(s=>s.title).join("\n");
    const mode=taskPlanningMode(t);
    const c=timeCategoryDefs[taskTimeCategory(t)]||timeCategoryDefs.life;
    const matches=editorMatches(t);
    return `<details class="cfgTask cfgTaskV20 ${t.enabled===false?"disabled":""} ${matches?"":"filteredOut"}" data-id="${cfgEsc(t.id)}" data-code="${cfgEsc(t.code)}" data-stepcodes="${cfgEsc(JSON.stringify(stepCodes))}" data-enabled="${t.enabled!==false?"1":"0"}">
      <summary class="cfgSummaryV20">
        <div class="cfgSummaryIcon">${c.icon}</div>
        <div class="cfgSummaryMain"><b>${cfgEsc(t.title)}</b><span>${taskPlanModeDefs[mode]?.name||mode} · ${taskDayHint(t)} · 周目标 ${fmtMinutes(taskWeeklyMinutes(t))}</span></div>
        <div class="cfgSummaryBadges">${rowStatus(t)}</div>
        <div class="cfgOps cfgSummaryOps"><button type="button" data-op="up">↑</button><button type="button" data-op="down">↓</button><button type="button" data-op="copy">复制</button><button type="button" data-op="remove" class="ghDangerBtn">删除</button></div>
      </summary>
      <div class="cfgBodyV20">
        <div class="cfgGrid">
          <div class="cfgField wide"><label>任务名</label><input class="cfgTitle" value="${cfgEsc(t.title)}"></div>
          <div class="cfgField"><label>分类</label><select class="cfgCat"><option value="life" ${t.cat==="life"?"selected":""}>生活&经济</option><option value="gamecreate" ${t.cat==="gamecreate"?"selected":""}>游戏&创作</option><option value="language" ${t.cat==="language"?"selected":""}>语言&学习</option></select></div>
          <div class="cfgField"><label>任务模式</label><select class="cfgPlanMode" title="决定任务是否进入今日执行环，还是只在周计划池按时间推进">${taskPlanModeOrder.map(k=>`<option value="${k}" ${taskPlanningMode(t)===k?"selected":""}>${taskPlanModeDefs[k].name}</option>`).join("")}</select></div>
          <div class="cfgField"><label>时间分类</label><select class="cfgTimeCategory">${timeCategoryOrder.map(k=>`<option value="${k}" ${taskTimeCategory(t)===k?"selected":""}>${timeCategoryDefs[k].icon} ${timeCategoryDefs[k].name}</option>`).join("")}</select></div>
          <div class="cfgField"><label>预计分钟/次</label><input class="cfgEstimatedMinutes" type="number" min="1" max="480" step="5" value="${taskEstimatedMinutes(t)}"></div>
          <div class="cfgField"><label>每周目标分钟</label><input class="cfgWeeklyMinutes" type="number" min="0" max="10080" step="5" value="${taskWeeklyMinutes(t)}" title="用于任务行显示 本周已用 / 每周目标；填 0 表示不设目标"></div>
          <div class="cfgField wide"><label>链接 URL</label><input class="cfgUrl" value="${cfgEsc(t.url||"")}" placeholder="https://..."></div>
          <div><div class="cfgDaysLabel">执行星期</div><div class="cfgDays">${dayBoxesHtml(t)}</div></div>
          <div><div class="cfgDaysLabel">标记</div><div class="cfgFlags"><label><input type="checkbox" class="cfgEnabled" ${t.enabled!==false?"checked":""}>启用</label><label><input type="checkbox" class="cfgCore" ${t.core?"checked":""}>保底</label><label><input type="checkbox" class="cfgOptional" ${t.optional?"checked":""}>可选</label><label><input type="checkbox" class="cfgImportant" ${t.important?"checked":""}>重要</label></div></div>
          <div class="cfgField wide"><label>子任务（一行一个）</label><textarea class="cfgSteps" placeholder="APP签到&#10;鸣潮&#10;绝区零">${cfgEsc(stepTitles)}</textarea></div>
        </div>
        <details class="cfgAdvanced"><summary>高级：ID / Code（一般不要改）</summary><div class="cfgAdvancedGrid"><div class="cfgField"><label>任务 ID：改了会影响旧状态</label><input class="cfgId" value="${cfgEsc(t.id)}"></div><div class="cfgField"><label>隐私 Code：Gist 状态用这个</label><input class="cfgCode" value="${cfgEsc(t.code)}"></div></div></details>
      </div>
    </details>`;
  };
  function editorToolbarHtml(counts){
    const active=editorUiState.scope||"active";
    return `<div class="taskEditorCommandDeck"><div class="editorSearchBox"><span>🔎</span><input id="taskEditorSearchInput" value="${cfgEsc(editorUiState.query||"")}" placeholder="搜索任务名 / ID / 分类 / 子任务"></div><div class="editorScopeTabs"><button type="button" class="${active==="active"?"active":""}" data-editor-scope="active">启用 ${counts.active}</button><button type="button" class="${active==="weekly"?"active":""}" data-editor-scope="weekly">周计划 ${counts.weekly}</button><button type="button" class="${active==="daily"?"active":""}" data-editor-scope="daily">今日环 ${counts.daily}</button><button type="button" class="${active==="disabled"?"active":""}" data-editor-scope="disabled">停用 ${counts.disabled}</button><button type="button" class="${active==="all"?"active":""}" data-editor-scope="all">全部 ${counts.all}</button></div><div class="editorTip">默认收起详情；停用任务进库房，不删档。</div></div>`;
  }
  function scopePass(t){
    const s=editorUiState.scope||"active";
    if(s==="all")return true;
    if(s==="disabled")return t.enabled===false;
    if(s==="weekly")return t.enabled!==false&&taskPlanningMode(t)==="weekly";
    if(s==="daily")return t.enabled!==false&&taskPlanningMode(t)!=="weekly";
    return t.enabled!==false;
  }
  window.renderTaskEditor=function(){
    loadEditorState();
    const list=document.getElementById("taskEditorList");
    if(!list)return;
    const cfg=normalizeTaskConfig(taskConfig||buildDefaultConfig());
    const counts={all:cfg.tasks.length,active:cfg.tasks.filter(t=>t.enabled!==false).length,disabled:cfg.tasks.filter(t=>t.enabled===false).length,weekly:cfg.tasks.filter(t=>t.enabled!==false&&taskPlanningMode(t)==="weekly").length,daily:cfg.tasks.filter(t=>t.enabled!==false&&taskPlanningMode(t)!=="weekly").length};
    const activeTasks=cfg.tasks.filter(t=>scopePass(t));
    const disabledTasks=cfg.tasks.filter(t=>t.enabled===false&&!scopePass(t));
    const renderedTasks=[...activeTasks,...disabledTasks];
    const activeRows=activeTasks.map(taskEditorRowHtml).join("");
    const disabledRows=disabledTasks.map(taskEditorRowHtml).join("");
    const empty=`<div class="editorEmptyState"><b>没有匹配任务</b><span>换个筛选或清空搜索。别让编辑器变成迷宫。</span></div>`;
    list.innerHTML=`${editorToolbarHtml(counts)}<div class="taskEditorActiveList">${activeRows||empty}</div>${disabledRows?`<details class="disabledTaskVault"><summary><span>🗄️ 停用任务库</span><b>${counts.disabled} 项</b><em>已停用但保留配置，保存时不会丢。</em></summary><div class="disabledTaskVaultBody">${disabledRows}</div></details>`:""}`;
    list.dataset.fullRender=renderedTasks.length===cfg.tasks.length?"1":"0";
    taskEditorLog(`已加载 ${cfg.tasks.length} 个任务。启用 ${counts.active}，停用 ${counts.disabled}。`);
  };
  window.addEditorTask=function(){
    const host=document.querySelector("#taskEditorList .taskEditorActiveList")||document.getElementById("taskEditorList");
    const t={id:makeTaskId(),code:makeTaskCode(),cat:"life",title:"新任务",days:[today],url:"",time_category:"life",estimated_minutes:30,weekly_minutes:120,plan_mode:"weekly",enabled:true,core:false,optional:false,important:false,steps:[]};
    host.insertAdjacentHTML("afterbegin",taskEditorRowHtml(t));
    const row=host.querySelector(".cfgTask");
    if(row){row.open=true;row.classList.add("newFocus");row.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>row.querySelector(".cfgTitle")?.focus(),260)}
    taskEditorLog("已新增任务，并跳转到编辑位置。");
    showToast("已新增任务，直接编辑即可","ok");
  };
  function closeTargetModal(){document.getElementById("weeklyTargetModal")?.remove()}
  window.openWeeklyTargetEditor=function(taskId){
    const task=taskById(taskId);
    if(!task){showToast("找不到任务","err");return}
    const cur=taskWeeklyMinutes(task);
    const used=taskWeekMinutesUsed(taskId);
    const presets=[0,30,60,120,180,240,360,420,600,720].map(m=>`<button type="button" class="targetPreset ${m===cur?"active":""}" data-target-preset="${m}">${m?fmtMinutes(m):"不设"}</button>`).join("");
    closeTargetModal();
    const modal=document.createElement("div");
    modal.id="weeklyTargetModal";
    modal.className="weeklyTargetModal";
    modal.innerHTML=`<div class="weeklyTargetCard"><button type="button" class="weeklyTargetClose" data-target-close>×</button><div class="weeklyTargetHead"><span>WEEK TARGET</span><b>${escapeHtml(task.title)}</b><em>本周已投入 ${fmtMinutes(used)}。这里要点「保存目标」才会改配置。</em></div><div class="targetPresetGrid">${presets}</div><label class="targetCustomInput"><span>自定义分钟</span><input type="number" min="0" max="10080" step="5" value="${cur}" data-target-value></label><div class="weeklyTargetActions"><button type="button" data-target-close>取消</button><button type="button" class="primary" data-target-save="${escapeHtml(taskId)}">保存目标</button></div></div>`;
    document.body.appendChild(modal);
    setTimeout(()=>modal.querySelector("[data-target-value]")?.focus(),60);
  };
  document.body.addEventListener("click",e=>{
    if(e.target.closest("#addTaskBtn")){e.preventDefault();e.stopPropagation();window.addEditorTask();return}
    const summaryBtn=e.target.closest(".cfgSummaryOps button");
    if(summaryBtn)e.preventDefault();
    const scope=e.target.closest("[data-editor-scope]");
    if(scope){e.preventDefault();editorUiState.scope=scope.dataset.editorScope;saveEditorState();renderTaskEditor();return}
    const editTarget=e.target.closest("[data-edit-weekly-target]");
    if(editTarget){e.preventDefault();e.stopPropagation();openWeeklyTargetEditor(editTarget.dataset.editWeeklyTarget);return}
    if(e.target.closest("[data-target-close]")||e.target.id==="weeklyTargetModal"){e.preventDefault();closeTargetModal();return}
    const preset=e.target.closest("[data-target-preset]");
    if(preset){e.preventDefault();const input=document.querySelector("#weeklyTargetModal [data-target-value]");if(input)input.value=preset.dataset.targetPreset;document.querySelectorAll(".targetPreset").forEach(b=>b.classList.toggle("active",b===preset));return}
    const save=e.target.closest("[data-target-save]");
    if(save){e.preventDefault();const input=document.querySelector("#weeklyTargetModal [data-target-value]");const val=input?input.value:0;updateTaskWeeklyTarget(save.dataset.targetSave,val);closeTargetModal();return}
  },true);
  function applyEditorSearchFilter(){
    const q=String(editorUiState.query||"").trim().toLowerCase();
    document.querySelectorAll("#taskEditorList .cfgTask").forEach(row=>{
      const hay=(row.innerText||"").toLowerCase();
      row.classList.toggle("filteredOut",!!q&&!hay.includes(q));
    });
  }
  document.body.addEventListener("input",e=>{
    if(e.target?.id==="taskEditorSearchInput"){editorUiState.query=e.target.value;saveEditorState();applyEditorSearchFilter();}
  });
})();
