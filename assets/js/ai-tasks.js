/* AI task launcher: generic UI only. Private prompts live exclusively in encrypted user config. */
(function(){
  "use strict";
  const originalWeeklyPoolBlocks=weeklyPoolBlocks;
  weeklyPoolBlocks=function(){return originalWeeklyPoolBlocks().filter(t=>t.ai_enabled!==true)};
  const originalRenderWeekly=window.renderWeeklyPlanPanel;
  const SLOTS_PER_DAY=5, COLLAPSE_KEY="taskring_ai_section_collapsed_v1";
  function aiTasks(){return blocks.filter(t=>t.ai_enabled===true)}
  function periodKey(t){
    return t.ai_period==="monthly" ? ymd(operationalNow).slice(0,7) : cycleYmd;
  }
  function periodDays(t){return t.ai_period==="monthly"?31:7}
  function currentDay(t){return t.ai_period==="monthly"?Number(ymd(operationalNow).slice(8)):today}
  function slotKey(t,day,slot){
    return GH_PREFIX+"ai_"+periodKey(t)+"_"+t.code+"_d"+day+"_s"+slot;
  }
  function successfulSlots(t){
    const list=[];
    for(let day=(t.ai_period==="monthly"?1:0);day<(t.ai_period==="monthly"?32:7);day++){
      for(let slot=1;slot<=SLOTS_PER_DAY;slot++){
        if(localStorage.getItem(slotKey(t,day,slot))==="1")list.push({day,slot});
      }
    }
    return list;
  }
  function verifiedCount(t){return successfulSlots(t).length}
  function verifiedToday(t){
    const day=currentDay(t);
    return successfulSlots(t).filter(o=>o.day===day).length;
  }
  function getTask(id){return aiTasks().find(t=>t.id===id)}
  function aiCard(t){
    const done=verifiedCount(t),target=Math.max(0,Number(t.ai_target)||0);
    const hasGoal=t.ai_period!=="on_demand" && target>0;
    const goalReached=hasGoal && done>=target;
    const period=t.ai_period==="monthly"?"本月":t.ai_period==="on_demand"?"按需":"本周";
    const text=hasGoal?(period+" "+done+"/"+target+" 次"):(period+"已执行 "+done+" 次");
    const chat=safeUrl(t.ai_chat_url),archive=safeUrl(t.ai_archive_url);
    const suggested=Array.isArray(t.days)&&t.days.length?("建议 "+t.days.map(dayName).join("・")):"随时执行";
    return [
      '<article class="aiMissionCard',goalReached?' achieved':'','">',
      '<div class="aiMissionCardHead"><span class="aiMissionGlyph" aria-hidden="true">✦</span>',
      '<div class="aiMissionTitle"><b>',escapeHtml(t.title),'</b><span>',escapeHtml(suggested),'</span></div>',
      '<span class="aiMissionCount',goalReached?' achieved':'','">',escapeHtml(text),'</span></div>',
      hasGoal?'<div class="aiMissionMeter"><i style="width:'+Math.min(100,Math.round(done/target*100))+'%"></i></div>':'',
      '<div class="aiMissionActions">',
      '<button type="button" class="aiMissionPrimary" data-ai-action="launch" data-ai-task="',escapeHtml(t.id),'">↗ AI 执行</button>',
      '<button type="button" data-ai-action="show" data-ai-task="',escapeHtml(t.id),'">查看指令</button>',
      chat?'<a target="_blank" rel="noopener noreferrer" href="'+chat+'">原对话 ↗</a>':'',
      archive?'<a target="_blank" rel="noopener noreferrer" href="'+archive+'">Notion ↗</a>':'',
      '</div>',
      '<div class="aiMissionVerify"><button type="button" data-ai-action="verify" data-ai-task="',escapeHtml(t.id),'">✓ 核验后记一次</button>',
      verifiedToday(t)?'<button type="button" class="aiMissionUndo" data-ai-action="undo" data-ai-task="'+escapeHtml(t.id)+'">撤销本日最后一次</button>':'',
      '</div></article>'
    ].join("");
  }
  window.renderWeeklyPlanPanel=function(){
    originalRenderWeekly();
    const host=document.getElementById("weeklyPlanPanel");
    const shell=host&&host.querySelector(".weeklyShell");
    if(!shell)return;
    const tasks=aiTasks();
    if(!tasks.length)return;
    const total=tasks.reduce((n,t)=>n+verifiedCount(t),0);
    const section=document.createElement("section");
    section.className="aiMissionSection";
    const collapsed=localStorage.getItem(COLLAPSE_KEY)==="1";
    section.innerHTML=[
      '<details class="aiMissionGroup"',collapsed?'':' open','>',
      '<summary><span class="aiMissionGroupTitle"><span class="aiMissionGroupIcon">✦</span><span><b>AI 助理</b><small>在 TaskRing 选择任务 → ChatGPT 发送 → Notion 归档 → 返回核验</small></span></span>',
      '<span class="aiMissionGroupStats">',tasks.length,' 项 · 已执行 ',total,' 次　⌄</span></summary>',
      '<div class="aiMissionGrid">',tasks.map(aiCard).join(""),'</div>',
      '</details>'
    ].join("");
    const target=shell.querySelector(".weeklyTaskGroups");
    if(target)target.before(section);else shell.appendChild(section);
    section.querySelector("details").addEventListener("toggle",e=>{
      if(e.target===section.querySelector("details"))localStorage.setItem(COLLAPSE_KEY,e.target.open?"0":"1");
    });
  };
  function makePromptDialog(t){
    let dialog=document.getElementById("taskringAiPromptDialog");
    if(!dialog){
      dialog=document.createElement("dialog");
      dialog.id="taskringAiPromptDialog";
      dialog.className="aiPromptDialog";
      dialog.innerHTML='<div class="aiPromptHeader"><strong id="aiPromptTitle">AI 执行指令</strong><button type="button" data-ai-dialog-close aria-label="关闭">×</button></div><p>这里是当前任务的完整指令；AI 执行打开的新聊天仍需手动发送。</p><textarea readonly spellcheck="false"></textarea><div class="aiPromptFooter"><button type="button" data-ai-dialog-copy>复制完整指令</button><button type="button" data-ai-dialog-close>关闭</button></div>';
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
    try{
      await navigator.clipboard.writeText(value);
      showToast("Prompt 已复制，可以粘贴到 ChatGPT","ok");
    }catch(err){
      showToast("无法自动复制，请从「查看指令」手动复制","warn",3600);
    }
  }
  function launch(t){
    const prompt=String(t.note||"").trim();
    if(!prompt){showToast("请先在任务编辑器的备注中填写完整 Prompt","warn",3600);return}
    const prepared="https://chatgpt.com/?prompt="+encodeURIComponent(prompt);
    const prefill=prepared.length<=6500;
    // Open synchronously inside the click event; clipboard is only a fallback.
    window.open(prefill?prepared:"https://chatgpt.com/","_blank","noopener,noreferrer");
    if(navigator.clipboard && navigator.clipboard.writeText)navigator.clipboard.writeText(prompt).catch(()=>{});
    showToast(prefill?"已打开预填 ChatGPT；核对后点击发送":"Prompt 较长：已打开 ChatGPT 并尝试复制全文，请粘贴发送","ok",4400);
  }
  function verify(t){
    const per=t.ai_period==="monthly"?"本月":t.ai_period==="on_demand"?"本周期":"本周";
    if(verifiedToday(t)>=SLOTS_PER_DAY){showToast("同一天最多记录 5 次，请检查记录","warn");return}
    if(!window.confirm("请确认「"+t.title+"」已实际执行，并核验必要的写入与 Notion 归档。\n\n仅打开 ChatGPT 或发送 Prompt 不算完成。\n\n确认记入"+per+"执行次数？"))return;
    const day=currentDay(t);
    for(let slot=1;slot<=SLOTS_PER_DAY;slot++){
      const key=slotKey(t,day,slot);
      if(localStorage.getItem(key)!=="1"){
        syncSetItem(key,true);
        window.renderWeeklyPlanPanel();
        showToast("已记录一次核验成功的 AI 执行","ok");
        return;
      }
    }
  }
  function undo(t){
    const day=currentDay(t);
    for(let slot=SLOTS_PER_DAY;slot>=1;slot--){
      const key=slotKey(t,day,slot);
      if(localStorage.getItem(key)==="1"){
        if(!window.confirm("撤销「"+t.title+"」今天最后一次执行记录？"))return;
        syncSetItem(key,false);
        window.renderWeeklyPlanPanel();
        showToast("已撤销一次执行记录","ok");
        return;
      }
    }
  }
  document.addEventListener("click",e=>{
    const btn=e.target.closest("[data-ai-action]");
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const t=getTask(btn.dataset.aiTask);
    if(!t)return;
    const action=btn.dataset.aiAction;
    if(action==="launch")launch(t);
    else if(action==="show")makePromptDialog(t);
    else if(action==="verify")verify(t);
    else if(action==="undo")undo(t);
  },true);
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
        const oldCount=taskConfig?.tasks?.length||0;
        taskConfig=config;
        renderTaskEditor(true);
        taskEditorLog("已载入本地任务 JSON（"+oldCount+" → "+config.tasks.length+" 项），未保存；请核对后按「保存配置」完成同步。");
        showToast("AI 任务 JSON 已载入，核对后点击保存配置","ok",4500);
      }catch(err){showToast("导入 JSON 失败："+String(err.message||err),"err",5000)}
    });
  }
  if(document.readyState!=="loading")window.renderWeeklyPlanPanel();
  else document.addEventListener("DOMContentLoaded",()=>window.renderWeeklyPlanPanel(),{once:true});
})();
