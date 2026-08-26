// TaskRing efficiency layer: reduce repeated navigation, preserve UI context and compact low-frequency actions.
(function(){
  "use strict";

  const WEEKLY_CATEGORY_KEY="taskring_ui_weekly_category_v1";
  const DISCLOSURE_KEY="taskring_ui_disclosure_v1";
  const MODULE_LABEL_SYNC_KEY="taskring_module_labels_synced_v1";
  const DYNAMIC_UX_SELECTOR=".dailyActions,.missionActions,.weeklyCategoryTabs,.orbitDrawer[data-ui-details-key]";
  const IDLE_EDITOR_LOGS=new Set(["等待编辑。","等待编辑.","等待编辑","等待设置。","等待设置.","等待设置"]);
  let scheduled=false;
  let restoringWeekly=false;
  let unifiedModuleLabelsApplied=false;

  function readJson(key,fallback={}){
    try{const value=JSON.parse(localStorage.getItem(key)||"");return value&&typeof value==="object"?value:fallback}catch(_){return fallback}
  }

  function sanitizeTimeCategoryLabels(raw){
    const out={};
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return out;
    Object.entries(raw).forEach(([key,value])=>{
      if(typeof timeCategoryDefs!=="object"||!timeCategoryDefs[key]||!value||typeof value!=="object")return;
      const patch={};
      ["name","short","icon"].forEach(field=>{
        const text=String(value[field]||"").trim();
        if(text)patch[field]=text.slice(0,24);
      });
      if(Object.keys(patch).length)out[key]=patch;
    });
    return out;
  }

  function applyTimeCategoryLabels(raw){
    const labels=sanitizeTimeCategoryLabels(raw);
    let changed=false;
    Object.entries(labels).forEach(([key,patch])=>{
      const def=timeCategoryDefs[key];
      if(!def)return;
      Object.entries(patch).forEach(([field,value])=>{
        if(def[field]!==value){def[field]=value;changed=true}
      });
    });
    document.querySelectorAll('select option[value="language"]').forEach(option=>{option.textContent=timeCategoryDefs.language?.name||"学习"});
    document.querySelectorAll('select option[value="creator"]').forEach(option=>{option.textContent=timeCategoryDefs.creator?.name||"经营"});
    document.querySelectorAll('select option[value="body"]').forEach(option=>{option.textContent=timeCategoryDefs.body?.name||"身体"});
    return changed;
  }

  // v4 task configs predate custom time-category labels. Preserve this optional metadata
  // through normal local/Gist normalization without changing the core task schema.
  const baseNormalizeTaskConfig=typeof normalizeTaskConfig==="function"?normalizeTaskConfig:null;
  if(baseNormalizeTaskConfig){
    normalizeTaskConfig=function(config){
      const normalized=baseNormalizeTaskConfig(config);
      const labels=sanitizeTimeCategoryLabels(config?.time_category_labels||config?.timeCategoryLabels);
      if(Object.keys(labels).length)normalized.time_category_labels=labels;
      return normalized;
    };
  }

  const baseApplyTaskConfig=typeof applyTaskConfig==="function"?applyTaskConfig:null;
  if(baseApplyTaskConfig){
    applyTaskConfig=function(config,shouldRender=false){
      applyTimeCategoryLabels(config?.time_category_labels||config?.timeCategoryLabels);
      return baseApplyTaskConfig(config,shouldRender);
    };
  }

  function consolidatedModuleSignature(){
    if(typeof taskConfig==="undefined"||!Array.isArray(taskConfig?.tasks)||typeof taskPlanningMode!=="function")return null;
    const weekly=taskConfig.tasks.filter(task=>task.enabled!==false&&taskPlanningMode(task)==="weekly");
    const counts={};
    weekly.forEach(task=>{
      const category=String(task.time_category||task.timeCategory||"");
      counts[category]=(counts[category]||0)+1;
    });
    const expected=weekly.length===9&&counts.language===5&&counts.creator===3&&counts.body===1;
    const unexpected=Object.entries(counts).some(([key,count])=>count&&!["language","creator","body"].includes(key));
    return expected&&!unexpected?{weekly,counts}:null;
  }

  function persistUnifiedModuleLabels(labels){
    if(typeof taskConfig==="undefined"||!taskConfig||localStorage.getItem(MODULE_LABEL_SYNC_KEY)==="1")return;
    try{
      const current=sanitizeTimeCategoryLabels(taskConfig.time_category_labels);
      const same=JSON.stringify(current)===JSON.stringify(labels);
      const next=same?taskConfig:normalizeTaskConfig({...taskConfig,time_category_labels:labels,updatedAt:new Date().toISOString()});
      const saved=same?taskConfig:saveLocalTaskConfig(next,"同步周计划模块显示名之前自动备份");
      if(!same&&baseApplyTaskConfig)applyTaskConfig(saved,false);
      if(typeof ghToken==="function"&&ghToken()&&typeof ghPatchConfig==="function"){
        localStorage.setItem(MODULE_LABEL_SYNC_KEY,"pending");
        Promise.resolve(ghPatchConfig(saved)).then(()=>{
          localStorage.setItem(MODULE_LABEL_SYNC_KEY,"1");
          if(typeof setGhStatus==="function")setGhStatus("GitHub：已同步","on");
        }).catch(error=>{
          console.warn("module label sync failed",error);
          localStorage.removeItem(MODULE_LABEL_SYNC_KEY);
        });
      }else if(same){
        localStorage.setItem(MODULE_LABEL_SYNC_KEY,"1");
      }
    }catch(error){
      console.warn("module label persistence skipped",error);
    }
  }

  function applyUnifiedModuleLabels(){
    const synced=typeof taskConfig!=="undefined"?sanitizeTimeCategoryLabels(taskConfig?.time_category_labels):{};
    if(Object.keys(synced).length){
      const changed=applyTimeCategoryLabels(synced);
      unifiedModuleLabelsApplied=true;
      if(changed&&typeof window.renderWeeklyPlanPanel==="function")requestAnimationFrame(()=>window.renderWeeklyPlanPanel());
      return;
    }
    if(unifiedModuleLabelsApplied)return;
    if(!consolidatedModuleSignature())return;

    const labels={
      language:{name:"学习",short:"学习",icon:"学"},
      creator:{name:"经营",short:"经营",icon:"营"},
      body:{name:"身体",short:"身体",icon:"身"}
    };
    const changed=applyTimeCategoryLabels(labels);
    unifiedModuleLabelsApplied=true;
    persistUnifiedModuleLabels(labels);
    if(changed&&typeof window.renderWeeklyPlanPanel==="function")requestAnimationFrame(()=>window.renderWeeklyPlanPanel());
  }

  function simplifyStaticChrome(){
    const heading=document.querySelector(".controlCenterHeading");
    if(heading&&heading.dataset.uxSimplified!=="1"){
      heading.dataset.uxSimplified="1";
      const eyebrow=heading.querySelector("span");
      const title=heading.querySelector("strong");
      const copy=heading.querySelector("p");
      if(eyebrow)eyebrow.textContent="CONTROL / SETTINGS";
      if(title)title.textContent="编辑与维护";
      if(copy)copy.textContent="页面切换交给主导航；这里集中放配置编辑、同步、备份和低频维护。";
    }

    const areaTitle=document.getElementById("controlAreaTitle");
    if(areaTitle){
      areaTitle.textContent="编辑配置";
      const meta=areaTitle.parentElement?.querySelector("span");
      if(meta)meta.textContent="4 EDITORS";
    }

    document.querySelectorAll('.controlAreaCard[data-control-area="weekly"],.controlAreaCard[data-control-area="time"]').forEach(card=>card.remove());

    const cardCopy={
      controlTaskEditorBtn:["TASKS","任务与周计划","编辑每日任务、指定日和周计划池"],
      controlFitnessEditorBtn:["BODY","训练与饮食","维护每周训练与饮食安排"],
      controlGameQuestEditorBtn:["GAME","游戏作战区","维护游戏、日常与周常任务"],
      controlRefEditorBtn:["LIBRARY","资料库","维护长期入口、链接与备注"]
    };
    Object.entries(cardCopy).forEach(([id,[eyebrow,title,desc]])=>{
      const card=document.getElementById(id);if(!card)return;
      const small=card.querySelector(".controlAreaCopy small");
      const strong=card.querySelector(".controlAreaCopy b");
      const em=card.querySelector(".controlAreaCopy em");
      if(small)small.textContent=eyebrow;
      if(strong)strong.textContent=title;
      if(em)em.textContent=desc;
    });

    const reset=document.getElementById("resetCurrentWeek");
    const safety=document.querySelector(".controlSafetyGrid");
    if(reset&&safety&&!reset.closest(".controlSafetyGrid")){
      reset.className="controlSafetyBtn controlDangerBtn";
      reset.innerHTML='<span aria-hidden="true">↺</span><span><b>重置本周完成状态</b><em>低频危险操作 · 执行前仍会确认</em></span>';
      safety.appendChild(reset);
    }

    const undone=document.getElementById("showUndone");
    const todayBtn=document.getElementById("showToday");
    const all=document.getElementById("showAll");
    if(undone)undone.textContent="待执行";
    if(todayBtn)todayBtn.textContent="今日全部";
    if(all)all.textContent="本周矩阵";
  }

  function compactActions(container,kind){
    if(!container||container.dataset.uxCompacted==="1")return;
    const children=[...container.children];
    if(children.length<4){container.dataset.uxCompacted="1";return}

    const isDaily=kind==="daily";
    const keep=children.filter(el=>{
      if(el.tagName==="A")return true;
      return isDaily
        ? el.matches(".timerStartTiny,.timerNowChip")
        : el.matches(".missionPrimary,.missionLink");
    });
    const secondary=children.filter(el=>!keep.includes(el));
    if(secondary.length<2){container.dataset.uxCompacted="1";return}

    const details=document.createElement("details");
    details.className="uxActionMore";
    details.innerHTML='<summary aria-label="展开低频操作"><span aria-hidden="true">•••</span><b>更多</b></summary><div class="uxActionMenu"></div>';
    const menu=details.querySelector(".uxActionMenu");
    secondary.forEach(el=>{
      if(el.matches("[data-open-task-editor]"))el.textContent="编辑任务";
      if(el.matches("[data-time-task-detail]"))el.textContent="时间账本";
      if(el.matches("[data-edit-weekly-target]")){
        const label=el.querySelector("span")?.textContent||"周目标";
        const value=el.querySelector("b")?.textContent||el.textContent.trim();
        el.textContent=`${label} · ${value}`;
      }
      menu.appendChild(el);
    });
    container.appendChild(details);
    container.dataset.uxCompacted="1";
    container.classList.add("uxCompacted");
  }

  function compactTaskActions(root=document){
    root.querySelectorAll(".dailyActions").forEach(el=>compactActions(el,"daily"));
    root.querySelectorAll(".missionActions").forEach(el=>compactActions(el,"weekly"));
  }

  function restoreWeeklyCategory(){
    if(restoringWeekly)return;
    const tabs=document.querySelector(".weeklyCategoryTabs");
    if(!tabs||tabs.dataset.uxRestored==="1")return;
    const stored=localStorage.getItem(WEEKLY_CATEGORY_KEY)||"all";
    const active=tabs.querySelector(".weeklyCategoryTab.active")?.dataset.weeklyCategoryTab||"all";
    const target=[...tabs.querySelectorAll("[data-weekly-category-tab]")].find(btn=>btn.dataset.weeklyCategoryTab===stored);
    tabs.dataset.uxRestored="1";
    if(!target||active===stored)return;
    restoringWeekly=true;
    requestAnimationFrame(()=>{
      target.click();
      restoringWeekly=false;
    });
  }

  function collapseRedundantOrbitByDefault(){
    const state=readJson(DISCLOSURE_KEY,{});
    document.querySelectorAll(".orbitDrawer[data-ui-details-key]").forEach(drawer=>{
      if(drawer.dataset.uxDefaultHandled==="1")return;
      drawer.dataset.uxDefaultHandled="1";
      const key=drawer.dataset.uiDetailsKey;
      if(Object.prototype.hasOwnProperty.call(state,key))return;
      drawer.open=false;
      drawer.querySelector(":scope > summary")?.setAttribute("aria-expanded","false");
    });
  }

  function compactIdleEditorLogs(){
    document.querySelectorAll(".taskEditorModal .ghLog,.refEditorModal .ghLog,.gameQuestEditorModal .ghLog,.fitnessEditorModal .ghLog").forEach(log=>{
      const text=String(log.textContent||"").trim();
      log.classList.toggle("uxIdleLog",IDLE_EDITOR_LOGS.has(text));
    });
  }

  function addNavigationShortcuts(){
    const buttons=[...document.querySelectorAll(".viewDockBtn[data-view-target]")].slice(0,6);
    buttons.forEach((btn,index)=>{
      const shortcut=`Alt+${index+1}`;
      const label=btn.getAttribute("aria-label")||btn.textContent.trim().replace(/\s+/g," ");
      btn.setAttribute("aria-keyshortcuts",shortcut);
      if(!String(btn.title||"").includes(shortcut))btn.title=`${shortcut} · ${label}`;
    });

    const toolbar=document.querySelector(".inertiaToolbar");
    if(toolbar&&!toolbar.querySelector(".uxShortcutHint")){
      const hint=document.createElement("span");
      hint.className="uxShortcutHint";
      hint.setAttribute("aria-hidden","true");
      hint.title="桌面快捷键：Alt+1 到 Alt+6 快速切换六个一级页面";
      hint.innerHTML='<span class="uxShortcutGlyph">⌨</span><kbd>Alt</kbd><span>1–6 快速切换</span>';
      toolbar.appendChild(hint);
    }
  }

  function enhance(){
    scheduled=false;
    applyUnifiedModuleLabels();
    simplifyStaticChrome();
    compactTaskActions();
    restoreWeeklyCategory();
    collapseRedundantOrbitByDefault();
    compactIdleEditorLogs();
    addNavigationShortcuts();
  }

  function scheduleEnhance(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(enhance);
  }

  function nodeContainsDynamicUx(node){
    if(!(node instanceof Element))return false;
    return node.matches(DYNAMIC_UX_SELECTOR)||!!node.querySelector(DYNAMIC_UX_SELECTOR);
  }

  function mutationNeedsEnhance(mutation){
    if(mutation.type==="characterData")return !!mutation.target.parentElement?.closest(".ghLog");
    const target=mutation.target instanceof Element?mutation.target:mutation.target.parentElement;
    if(target?.closest(".ghLog"))return true;
    return [...mutation.addedNodes].some(node=>nodeContainsDynamicUx(node));
  }

  document.addEventListener("click",event=>{
    const path=event.composedPath?.()||[];
    const weeklyTab=path.find(node=>node instanceof Element&&node.matches?.("[data-weekly-category-tab]"));
    if(weeklyTab)localStorage.setItem(WEEKLY_CATEGORY_KEY,weeklyTab.dataset.weeklyCategoryTab||"all");

    const menuAction=path.find(node=>node instanceof Element&&node.matches?.(".uxActionMenu button,.uxActionMenu a"));
    if(menuAction){
      const details=menuAction.closest(".uxActionMore");
      setTimeout(()=>{if(details)details.open=false},0);
    }

    if(!path.some(node=>node instanceof Element&&node.matches?.(".uxActionMore"))){
      document.querySelectorAll(".uxActionMore[open]").forEach(details=>{details.open=false});
    }
  },true);

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"){
      const openMenus=[...document.querySelectorAll(".uxActionMore[open]")];
      if(openMenus.length){
        event.preventDefault();
        const last=openMenus[openMenus.length-1];
        openMenus.forEach(details=>{details.open=false});
        last.querySelector(":scope > summary")?.focus();
        return;
      }
    }

    if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if(document.body.classList.contains("modalOpen")||document.querySelector(".controlCenterMenu:not(.hidden)"))return;
    const activeTag=document.activeElement?.tagName||"";
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(activeTag)||document.activeElement?.isContentEditable)return;
    const index=Number(event.key)-1;
    if(index<0||index>5)return;
    const button=document.querySelectorAll(".viewDockBtn[data-view-target]")[index];
    if(!button)return;
    event.preventDefault();
    button.click();
  });

  const observer=new MutationObserver(mutations=>{
    if(mutations.some(mutationNeedsEnhance))scheduleEnhance();
  });
  if(document.body)observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scheduleEnhance,{once:true});
  else scheduleEnhance();

  if(!document.querySelector('script[data-taskring-private-restructure]')){
    const script=document.createElement("script");
    script.src="assets/js/private-restructure.js?v=20260826.1";
    script.dataset.taskringPrivateRestructure="1";
    document.body.appendChild(script);
  }
})();
