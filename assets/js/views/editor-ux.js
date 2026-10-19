// v21 Editor UX
// 独立管理任务编辑器：停用任务收纳、搜索/筛选、折叠卡片、周目标确认弹窗。
(function(){

  const sessions=new Map();
  function formSnapshot(id){
    const modal=document.getElementById(id);
    return JSON.stringify([...modal.querySelectorAll("input,select,textarea")].filter(el=>el.id!=="taskEditorSearchInput").map(el=>[el.className,el.closest("[data-id]")?.dataset.id,el.type==="checkbox"?el.checked:el.value]));
  }
  window.TaskRingEditorSessions={
    resume(id){const session=sessions.get(id);return !!(session&&session.baseline!==formSnapshot(id))},
    begin(id){sessions.set(id,{baseline:formSnapshot(id)});},
    saved(id){this.begin(id)},
    dirty(){return [...sessions].some(([id,s])=>s.baseline!==formSnapshot(id))}
  };
  window.addEventListener("beforeunload",event=>{if(window.TaskRingEditorSessions.dirty()){event.preventDefault();event.returnValue=""}});

  const EDITOR_FILTER_KEY="taskring_editor_filter_v20";
  let editorUiState={scope:"active",query:""};
  function loadEditorState(){try{editorUiState=Object.assign(editorUiState,JSON.parse(localStorage.getItem(EDITOR_FILTER_KEY)||"{}")||{})}catch(e){}}
  function saveEditorState(){try{localStorage.setItem(EDITOR_FILTER_KEY,JSON.stringify(editorUiState))}catch(e){}}
  // The legacy language category also contains music study. Keep its stable key (language)
  // while showing the new editorial name even when a saved weekly alias says 学习.
  function editorCategoryName(key){return key==="language"?"语言和音乐":timeCategoryDefs[key]?.name||key}
  function editorCategoryShort(key){return key==="language"?"语乐":timeCategoryDefs[key]?.short||key}
  function editorMatches(t){
    const q=String(editorUiState.query||"").trim().toLowerCase();
    if(!q)return true;
    const category=taskTimeCategory(t);
    const categoryDef=timeCategoryDefs[category]||timeCategoryDefs.life;
    const hay=[t.title,t.id,t.code,category,categoryDef.name,categoryDef.short,editorCategoryName(category),editorCategoryShort(category),taskPlanningMode(t),(t.steps||[]).map(s=>s.title).join(" ")].join(" ").toLowerCase();
    return hay.includes(q);
  }
  function dayBoxesHtml(t){return [1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" class="cfgDay" value="${d}" ${t.days?.includes(d)?"checked":""}>${dayName(d)}</label>`).join("")}
  function rowStatus(t){
    const mode=taskPlanningMode(t);
    const key=taskTimeCategory(t);
    const categoryName=escapeHtml(editorCategoryName(key));
    return `<span class="editorBadge ${mode}">${taskPlanModeDefs[mode]?.short||mode}</span><span class="editorBadge taskCategoryIconBadge" data-task-category="${escapeHtml(key)}" role="img" title="分类：${categoryName}" aria-label="分类：${categoryName}">${taskCategoryGlyph(key)}</span>${t.enabled===false?`<span class="editorBadge off">停用</span>`:""}${t.important?`<span class="editorBadge hot">重</span>`:""}`;
  }
  window.taskEditorRowHtml=function(t){
    const stepCodes=(t.steps||[]).filter(s=>s.enabled!==false).map(s=>s.code||"");
    const stepTitles=(t.steps||[]).filter(s=>s.enabled!==false).map(s=>s.title).join("\n");
    const mode=taskPlanningMode(t);
    const c=timeCategoryDefs[taskTimeCategory(t)]||timeCategoryDefs.life;
    const matches=editorMatches(t);
    return `<details class="cfgTask cfgTaskV20 ${t.enabled===false?"disabled":""} ${matches?"":"filteredOut"}" data-id="${cfgEsc(t.id)}" data-code="${cfgEsc(t.code)}" data-stepcodes="${cfgEsc(JSON.stringify(stepCodes))}" data-enabled="${t.enabled!==false?"1":"0"}">
      <summary class="cfgSummaryV20">
        <div class="cfgSummaryIcon taskCategoryGraphic" data-task-category="${escapeHtml(taskTimeCategory(t))}" aria-hidden="true">${taskCategoryGlyph(taskTimeCategory(t))}</div>
        <div class="cfgSummaryMain"><b>${cfgEsc(t.title)}</b><span>${taskPlanModeDefs[mode]?.name||mode} · ${taskDayHint(t)} · 周目标 ${fmtMinutes(taskWeeklyMinutes(t))}</span></div>
        <div class="cfgSummaryBadges">${rowStatus(t)}</div>
        <div class="cfgOps cfgSummaryOps"><button type="button" data-op="up">↑</button><button type="button" data-op="down">↓</button><button type="button" data-op="copy">复制</button><button type="button" data-op="remove" class="ghDangerBtn">删除</button></div>
      </summary>
      <div class="cfgBodyV20">
        <div class="cfgGrid">
          <div class="cfgField wide"><label>任务名</label><input class="cfgTitle" value="${cfgEsc(t.title)}"></div>
          <div class="cfgField"><label>分类</label><select class="cfgCat cfgTimeCategory">${timeCategoryOrder.map(k=>`<option value="${k}" ${taskTimeCategory(t)===k?"selected":""}>${timeCategoryDefs[k].icon} ${editorCategoryName(k)}</option>`).join("")}</select></div>
          <div class="cfgField"><label>任务模式</label><select class="cfgPlanMode" title="决定任务是否进入今日执行环，还是只在周计划池按时间推进">${taskPlanModeOrder.map(k=>`<option value="${k}" ${taskPlanningMode(t)===k?"selected":""}>${taskPlanModeDefs[k].name}</option>`).join("")}</select></div>
          <div class="cfgField"><label>预计分钟/次</label><input class="cfgEstimatedMinutes" type="number" min="1" max="480" step="5" value="${taskEstimatedMinutes(t)}"></div>
          <div class="cfgField"><label>每周目标分钟</label><input class="cfgWeeklyMinutes" type="number" min="0" max="10080" step="5" value="${taskWeeklyMinutes(t)}" title="用于任务行显示 本周已用 / 每周目标；填 0 表示不设目标"></div>
          <div class="cfgField wide"><label>链接 URL</label><input class="cfgUrl" value="${cfgEsc(t.url||"")}" placeholder="https://..."></div>
          <details class="cfgAiSettings cfgField wide" ${t.ai_enabled?"open":""}>
            <summary>🤖 AI 执行 / 备注 ${t.ai_enabled?"｜已启用":""}</summary>
            <div class="cfgAiSettingsBody">
              <label class="cfgAiToggle"><input type="checkbox" class="cfgAiEnabled" ${t.ai_enabled?"checked":""}>此任务使用 ChatGPT Prompt 执行</label>
              <div class="cfgField"><label>备注 / 完整执行 Prompt（仅保存在私有配置）</label><textarea class="cfgNote" rows="7" placeholder="填写完整执行指令；点击「AI 执行」会将这里的文字传入 ChatGPT。">${cfgEsc(t.note||"")}</textarea></div>
              <div class="cfgAiSettingsGrid">
                <div class="cfgField"><label>频率模式</label><select class="cfgAiPeriod"><option value="weekly" ${t.ai_period==="weekly"?"selected":""}>每周</option><option value="monthly" ${t.ai_period==="monthly"?"selected":""}>每月</option><option value="on_demand" ${t.ai_period==="on_demand"?"selected":""}>按需（不设目标）</option></select></div>
                <div class="cfgField"><label>周期执行目标次数</label><input type="number" class="cfgAiTarget" min="0" max="7" value="${Number(t.ai_target)||0}"></div>
              </div>
              <div class="cfgField"><label>原有 Chat 对话链接（查看历史用）</label><input class="cfgAiChatUrl" value="${cfgEsc(t.ai_chat_url||"")}" placeholder="https://chatgpt.com/c/..."></div>
              <div class="cfgField"><label>Notion 归档入口</label><input class="cfgAiArchiveUrl" value="${cfgEsc(t.ai_archive_url||"")}" placeholder="https://www.notion.so/..."></div>
              <p class="cfgAiHint">AI 执行仅打开预填指令的新 ChatGPT 页面，仍须点击发送；执行成功后手动核验记次。</p>
            </div>
          </details>
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
  window.renderTaskEditor=function(resetDeleted=false){
    loadEditorState();
    const list=document.getElementById("taskEditorList");
    if(!list)return;
    if(resetDeleted)resetEditorDeletedTasks();
    const cfg=normalizeTaskConfig(taskConfig||buildDefaultConfig());
    const deletedIds=editorDeletedTaskIds(list);
    const tasks=cfg.tasks.filter(t=>!deletedIds.has(t.id));
    const counts={
      all:tasks.length,
      active:tasks.filter(t=>t.enabled!==false).length,
      disabled:tasks.filter(t=>t.enabled===false).length,
      weekly:tasks.filter(t=>t.enabled!==false&&taskPlanningMode(t)==='weekly').length,
      daily:tasks.filter(t=>t.enabled!==false&&taskPlanningMode(t)!=='weekly').length
    };
    // Keep every task in the same DOM draft. Filtering changes visibility only;
    // hidden tasks, additions, order and uncommitted field values stay intact.
    list.innerHTML=`${editorToolbarHtml(counts)}<div class="taskEditorActiveList">${tasks.map(taskEditorRowHtml).join("")}</div><div class="editorEmptyState" hidden>没有匹配任务，试试其他筛选。</div>`;
    list.dataset.fullRender="1";
    applyEditorSearchFilter();
    taskEditorLog(`已加载 ${tasks.length} 个任务。启用 ${counts.active}，停用 ${counts.disabled}${deletedIds.size?`，待删除 ${deletedIds.size}`:""}。`);
  };
  window.addEditorTask=function(){
    const host=document.querySelector("#taskEditorList .taskEditorActiveList")||document.getElementById("taskEditorList");
    const planMode=editorUiState.scope==="daily"?"daily":"weekly";
    const t={id:makeTaskId(),code:makeTaskCode(),title:"新任务",days:[today],url:"",time_category:"life",estimated_minutes:30,weekly_minutes:120,plan_mode:planMode,enabled:true,core:false,optional:false,important:false,steps:[]};
    host.insertAdjacentHTML("afterbegin",taskEditorRowHtml(t));
    const row=host.querySelector(".cfgTask");
    if(row){row.hidden=false;row.classList.remove("filteredOut");row.dataset.editorNew="1";row.open=true;row.classList.add("newFocus");row.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>row.querySelector(".cfgTitle")?.focus(),260)}
    taskEditorLog("已新增任务，并跳转到编辑位置。");
    showToast("已新增任务，直接编辑即可","ok");
  };
  function closeTargetModal(){document.getElementById("weeklyTargetModal")?.remove();window.dispatchEvent(new CustomEvent("taskring:modal-closed"))}
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
    modal.innerHTML=`<div class="weeklyTargetCard"><button type="button" class="weeklyTargetClose" data-target-close aria-label="关闭">×</button><div class="weeklyTargetHead"><span>WEEK TARGET</span><b>${escapeHtml(task.title)}</b><em>本周已投入 ${fmtMinutes(used)}。这里要点「保存目标」才会改配置。</em></div><div class="targetPresetGrid">${presets}</div><label class="targetCustomInput"><span>自定义分钟</span><input type="number" min="0" max="10080" step="5" value="${cur}" data-target-value></label><div class="weeklyTargetActions"><button type="button" data-target-close>取消</button><button type="button" class="primary" data-target-save="${escapeHtml(taskId)}">保存目标</button></div></div>`;
    document.body.appendChild(modal);
    setTimeout(()=>modal.querySelector("[data-target-value]")?.focus(),60);
  };
  document.body.addEventListener("click",e=>{
    if(e.target.closest("#addTaskBtn")){e.preventDefault();e.stopPropagation();window.addEditorTask();return}
    const summaryBtn=e.target.closest(".cfgSummaryOps button");
    if(summaryBtn)e.preventDefault();
    const scope=e.target.closest("[data-editor-scope]");
    if(scope){e.preventDefault();editorUiState.scope=scope.dataset.editorScope;saveEditorState();applyEditorSearchFilter();return}
    const editTarget=e.target.closest("[data-edit-weekly-target]");
    if(editTarget){e.preventDefault();e.stopPropagation();openWeeklyTargetEditor(editTarget.dataset.editWeeklyTarget);return}
    if(e.target.closest("[data-target-close]")||e.target.id==="weeklyTargetModal"){e.preventDefault();closeTargetModal();return}
    const preset=e.target.closest("[data-target-preset]");
    if(preset){e.preventDefault();const input=document.querySelector("#weeklyTargetModal [data-target-value]");if(input)input.value=preset.dataset.targetPreset;document.querySelectorAll(".targetPreset").forEach(b=>b.classList.toggle("active",b===preset));return}
    const save=e.target.closest("[data-target-save]");
    if(save){e.preventDefault();const input=document.querySelector("#weeklyTargetModal [data-target-value]");const val=input?input.value:0;updateTaskWeeklyTarget(save.dataset.targetSave,val);closeTargetModal();return}
  },true);
  function applyEditorSearchFilter(){
    document.querySelectorAll("[data-editor-scope]").forEach(button=>button.classList.toggle("active",button.dataset.editorScope===editorUiState.scope));
    let visible=0;
    document.querySelectorAll("#taskEditorList .cfgTask").forEach(row=>{
      const task=editorRowToTask(row,0);
      const matches=scopePass(task)&&editorMatches(task);
      row.hidden=!matches;
      row.classList.toggle("filteredOut",!matches);
      if(matches)visible++;
    });
    const empty=document.querySelector("#taskEditorList .editorEmptyState");
    if(empty)empty.hidden=visible>0;
  }

  document.body.addEventListener("input",e=>{
    if(e.target?.id==="taskEditorSearchInput"){editorUiState.query=e.target.value;saveEditorState();applyEditorSearchFilter();}
  });
})();
