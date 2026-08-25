// TaskRing efficiency layer: reduce repeated navigation, preserve UI context and compact low-frequency actions.
(function(){
  "use strict";

  const WEEKLY_CATEGORY_KEY="taskring_ui_weekly_category_v1";
  const DISCLOSURE_KEY="taskring_ui_disclosure_v1";
  let scheduled=false;
  let restoringWeekly=false;

  function readJson(key,fallback={}){
    try{const value=JSON.parse(localStorage.getItem(key)||"");return value&&typeof value==="object"?value:fallback}catch(_){return fallback}
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

  function addNavigationShortcuts(){
    document.querySelectorAll(".viewDockBtn[data-view-target]").forEach((btn,index)=>{
      if(index<6&&!btn.title)btn.title=`Alt+${index+1} · ${btn.textContent.trim().replace(/\s+/g," ")}`;
    });
  }

  function enhance(){
    scheduled=false;
    compactTaskActions();
    restoreWeeklyCategory();
    collapseRedundantOrbitByDefault();
    addNavigationShortcuts();
  }

  function scheduleEnhance(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(enhance);
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
    if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||""))return;
    const index=Number(event.key)-1;
    if(index<0||index>5)return;
    const button=document.querySelectorAll(".viewDockBtn[data-view-target]")[index];
    if(!button)return;
    event.preventDefault();
    button.click();
  });

  const observer=new MutationObserver(scheduleEnhance);
  if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scheduleEnhance,{once:true});
  else scheduleEnhance();
})();
