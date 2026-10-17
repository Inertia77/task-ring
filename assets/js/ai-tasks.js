/* TaskRing AI launcher v2: AI tasks use native Daily/Weekly task cards, not a parallel panel. */
(function(){
  "use strict";
  const SLOTS_PER_DAY=5;
  function aiTask(id){return blocks.find(t=>t.ai_enabled===true&&t.id===id)}
  function periodKey(t){
    return t.ai_period==="monthly" ? ymd(operationalNow).slice(0,7) : cycleYmd;
  }
  function currentDay(t){return t.ai_period==="monthly"?Number(ymd(operationalNow).slice(8)):today}
  function slotKey(t,day,slot){return GH_PREFIX+"ai_"+periodKey(t)+"_"+t.code+"_d"+day+"_s"+slot}
  function weeklyEntries(t){
    const entries=[],start=t.ai_period==="monthly"?1:0,stop=t.ai_period==="monthly"?32:7;
    for(let day=start;day<stop;day++)for(let slot=1;slot<=SLOTS_PER_DAY;slot++){
      if(localStorage.getItem(slotKey(t,day,slot))==="1")entries.push({day,slot});
    }
    return entries;
  }
  function verifiedCount(t){
    if(taskPlanningMode(t)!=="weekly")return (t.days||[]).filter(day=>isDone(t.id,day,cycleYmd)).length;
    return weeklyEntries(t).length;
  }
  function weeklyStatus(t){
    const done=verifiedCount(t),goal=Math.max(0,Number(t.ai_target)||0);
    const achieved=t.ai_period!=="on_demand"&&goal>0&&done>=goal;
    return {used:0,target:0,pct:goal?Math.min(100,Math.round(done/goal*100)):0,state:achieved?"done":done>0?"active":"idle",over:false,ai_done:done,ai_target:goal};
  }
  function launchButtons(t){
    const id=escapeHtml(t.id),chat=safeUrl(t.ai_chat_url),archive=safeUrl(t.ai_archive_url);
    return [
      '<button type="button" class="aiInlineLaunch" data-ai-action="launch" data-ai-task="',id,'">↗ AI 执行</button>',
      '<button type="button" class="aiInlineSecondary" data-ai-action="show" data-ai-task="',id,'">查看指令</button>',
      chat?'<a class="aiInlineSecondary" target="_blank" rel="noopener noreferrer" href="'+chat+'">原对话 ↗</a>':'',
      archive?'<a class="aiInlineSecondary" target="_blank" rel="noopener noreferrer" href="'+archive+'">Notion ↗</a>':''
    ].join("");
  }
  function weeklyCard(t){
    const st=weeklyStatus(t),goal=st.ai_target,done=st.ai_done;
    const period=t.ai_period==="monthly"?"本月":t.ai_period==="on_demand"?"按需":"本周";
    const description=t.ai_period==="on_demand"?"需要时执行":period+"目标 "+goal+" 次";
    const progress=goal?Math.min(100,Math.round(done/goal*100)):0;
    const id=escapeHtml(t.id),cat=taskTimeCategory(t);
    const category=(timeCategoryDefs[cat]||timeCategoryDefs.life);
    const isDone=st.state==="done",dailyDone=weeklyEntries(t).filter(e=>e.day===currentDay(t)).length;
    return '<article class="weeklyMissionCard aiEmbeddedCard '+(isDone?'done achieved':'')+'" style="--w:'+progress+'%">'+
      '<header class="missionHead"><div class="missionIcon taskCategoryGraphic" data-task-category="'+escapeHtml(cat)+'" aria-hidden="true">'+taskCategoryGlyph(cat)+'</div>'+
      '<div class="missionTitleBlock"><b title="'+escapeHtml(t.title)+'">'+escapeHtml(t.title)+'</b><span>'+escapeHtml(taskDayHint(t))+' · '+escapeHtml(description)+'</span></div>'+
      '<div class="missionScore"><strong>'+done+(goal?' / '+goal:' 次')+'</strong><em>'+(isDone?'本周期已达成':period+(goal?'待完成':'执行记录'))+'</em></div></header>'+
      (goal?'<div class="missionMeter" aria-label="'+period+'执行进度 '+progress+'%"><i></i></div>':'')+
      '<footer class="missionActions aiInlineActions">'+launchButtons(t)+'</footer>'+
      '<div class="missionBadges aiEmbeddedFoot"><span class="statusBadge weeklyPace '+(isDone?'achieved':'idle')+'">'+(isDone?'✓ 已达成':'✦ AI 任务')+'</span>'+
      '<span class="planModeBadge weekly">周计划</span><span class="taskCategoryIconBadge" data-task-category="'+escapeHtml(cat)+'" title="'+escapeHtml(category.name)+'">'+taskCategoryGlyph(cat)+'</span>'+
      '<button type="button" class="aiVerifyInline" data-ai-action="verify-weekly" data-ai-task="'+id+'">✓ 核验并记次</button>'+
      (dailyDone?'<button type="button" class="aiUndoInline" data-ai-action="undo-weekly" data-ai-task="'+id+'">撤销今日一次</button>':'')+
      '</div></article>';
  }
  function dailyCard(o){
    const t=o.t,dayId=o.dayId,cycle=o.cycle||cycleYmd,st=occurrenceState(t,dayId,cycle);
    const done=st.done,title=escapeHtml(t.title),id=escapeHtml(t.id);
    const cat=taskTimeCategory(t),def=timeCategoryDefs[cat]||timeCategoryDefs.life;
    const status=done?"✓ 已核验":st.prev?"上周遗留":st.overdue?"可补执行":"待执行";
    return '<article class="dailyCard aiEmbeddedCard '+(done?'done completed':'')+'" data-daily-task="'+id+'" style="--daily-accent:var(--color-line-strong)">'+
      '<div class="dailyMain"><label class="dailyComplete" title="'+title+'：'+(done?'撤销执行记录':'核验本次执行')+'">'+
      '<input type="checkbox" data-ai-check-task="'+id+'" data-ai-check-day="'+dayId+'" data-ai-check-cycle="'+escapeHtml(cycle)+'" '+(done?'checked':'')+'><span></span></label>'+
      '<div class="dailyCopy"><h3 class="dailyTitle"><span class="taskText">'+title+'</span></h3>'+
      '<div class="dailyMeta"><span class="dailyVisualChip category" data-task-category="'+escapeHtml(cat)+'">'+taskCategoryGlyph(cat)+'</span>'+
      '<span class="dailyVisualChip '+(done?'complete':'pending')+'">'+escapeHtml(status)+'</span><span class="dailyVisualChip optional">✦ AI 执行</span></div>'+
      '<div class="dailyMeta dailyMetaSecondary"><span class="dailyMetaChip calendar">'+taskUiIcon("calendar-days")+escapeHtml(dayName(dayId))+(dayId===today?' · 今日':'')+'</span>'+
      '<span class="dailyMetaChip">'+escapeHtml(def.name||"AI")+'</span></div></div></div>'+
      '<div class="dailyActions aiInlineActions">'+launchButtons(t)+'</div></article>';
  }
  function promptDialog(t){
    let dialog=document.getElementById("taskringAiPromptDialog");
    if(!dialog){
      dialog=document.createElement("dialog");
      dialog.id="taskringAiPromptDialog";
      dialog.className="aiPromptDialog";
      dialog.innerHTML='<div class="aiPromptHeader"><strong id="aiPromptTitle">完整执行指令</strong><button type="button" data-ai-dialog-close aria-label="关闭">×</button></div><p>ChatGPT 仍需你确认并发送。长 Prompt 可能无法通过网页链接预填，可复制全文。</p><textarea readonly spellcheck="false"></textarea><div class="aiPromptFooter"><button type="button" data-ai-dialog-copy>复制完整指令</button><button type="button" data-ai-dialog-close>关闭</button></div>';
      document.body.appendChild(dialog);
      dialog.addEventListener("click",e=>{
        if(e.target.closest("[data-ai-dialog-close]"))dialog.close();
        if(e.target.closest("[data-ai-dialog-copy]"))copyPrompt(dialog.querySelector("textarea").value);
      });
    }
    dialog.querySelector("#aiPromptTitle").textContent=t.title;
    dialog.querySelector("textarea").value=t.note||"";
    if(!dialog.open)dialog.showModal();
  }
  async function copyPrompt(value){
    try{await navigator.clipboard.writeText(value);showToast("Prompt 已复制，可粘贴到 ChatGPT","ok")}
    catch(_){showToast("复制失败：请在指令窗口手动选取文本","warn",3600)}
  }
  function launch(t){
    const prompt=String(t.note||"").trim();
    if(!prompt){showToast("请先在任务编辑器里填写 Prompt 备注","warn");return}
    const url="https://chatgpt.com/?prompt="+encodeURIComponent(prompt);
    const prefill=url.length<=6500;
    window.open(prefill?url:"https://chatgpt.com/","_blank","noopener,noreferrer");
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(prompt).catch(()=>{});
    showToast(prefill?"已尝试预填指令，请检查后发送":"Prompt 较长：已尝试复制，必要时粘贴到 ChatGPT 后发送","ok",4300);
  }
  function verifyDaily(t,day,cycle,checked,el){
    if(checked){
      const ok=window.confirm("请确认「"+t.title+"」已实际执行，并核验相关 Notion 归档／业务结果。\n\n仅打开 ChatGPT 或发送 Prompt 不算完成。\n\n标记 "+dayName(day)+" 的任务已完成？");
      if(!ok){renderAll();return}
    }else if(!window.confirm("撤销「"+t.title+"」的执行完成记录？")){renderAll();return}
    setDone(t.id,day,checked,el,false,cycle);
  }
  function verifyWeekly(t){
    if(weeklyEntries(t).filter(v=>v.day===currentDay(t)).length>=SLOTS_PER_DAY){showToast("每天最多记 5 次，请核对已有记录","warn");return}
    if(!window.confirm("请确认「"+t.title+"」已执行并核验业务结果与 Notion 归档。\n\n只打开 ChatGPT 不计次。是否记录一次成功执行？"))return;
    for(let slot=1;slot<=SLOTS_PER_DAY;slot++){
      const key=slotKey(t,currentDay(t),slot);
      if(localStorage.getItem(key)!=="1"){
        syncSetItem(key,true);
        renderAll();
        showToast("执行已核验并记入周期记录","ok");
        return;
      }
    }
  }
  function undoWeekly(t){
    for(let slot=SLOTS_PER_DAY;slot>=1;slot--){
      const key=slotKey(t,currentDay(t),slot);
      if(localStorage.getItem(key)==="1"){
        if(!window.confirm("撤销「"+t.title+"」今天的最后一次记录？"))return;
        syncSetItem(key,false);renderAll();showToast("已撤销一次执行记录","ok");return;
      }
    }
  }
  window.TaskRingAI={weeklyCard,dailyCard,weeklyStatus,verifiedCount};
  document.addEventListener("change",e=>{
    const input=e.target.closest?.("[data-ai-check-task]");
    if(!input)return;
    e.preventDefault();e.stopImmediatePropagation();
    const t=aiTask(input.dataset.aiCheckTask);
    if(!t)return;
    verifyDaily(t,Number(input.dataset.aiCheckDay),input.dataset.aiCheckCycle||cycleYmd,input.checked,input);
  },true);
  document.addEventListener("click",e=>{
    const btn=e.target.closest?.("[data-ai-action]");
    if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    const t=aiTask(btn.dataset.aiTask);
    if(!t)return;
    if(btn.dataset.aiAction==="launch")launch(t);
    else if(btn.dataset.aiAction==="show")promptDialog(t);
    else if(btn.dataset.aiAction==="verify-weekly")verifyWeekly(t);
    else if(btn.dataset.aiAction==="undo-weekly")undoWeekly(t);
  },true);
  // Preserve the existing JSON file import affordance from the previous release.
  const importBtn=document.getElementById("importTaskFileBtn");
  const importInput=document.getElementById("importTaskFileInput");
  if(importBtn&&importInput){
    importBtn.addEventListener("click",()=>importInput.click());
    importInput.addEventListener("change",async()=>{
      const file=importInput.files?.[0];
      importInput.value="";
      if(!file)return;
      if(file.size>2000000){showToast("JSON 文件超过 2MB，已取消导入","warn");return}
      try{
        const json=JSON.parse(await file.text());
        const config=taskEditorImportConfig(json);
        const before=taskConfig?.tasks?.length||0;
        taskConfig=config;renderTaskEditor(true);
        taskEditorLog("已载入任务 JSON（"+before+" → "+config.tasks.length+" 项），尚未保存；请检查后按「保存配置」同步。");
        showToast("任务 JSON 已载入，请检查后保存配置","ok",4300);
      }catch(err){showToast("导入 JSON 失败："+String(err.message||err),"err",5000)}
    });
  }
})();
