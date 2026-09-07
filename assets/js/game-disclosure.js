// Game Quest disclosure policy: daily + weekly are collapsible, but every entry starts open.
(() => {
  "use strict";

  let dailyCollapsed = false;
  let weeklyCollapsed = false;
  let scheduled = false;

  function injectStyles(){
    if(document.getElementById("gameDisclosurePolicyStyles")) return;
    const style = document.createElement("style");
    style.id = "gameDisclosurePolicyStyles";
    style.textContent = `
      .gameQuestWeeklyDisclosureBody[hidden]{display:none!important}
      .gameQuestWeeklyPane.collapsed .gameQuestDailyToggleChevron{transform:rotate(-90deg)}
      .gameQuestWeeklyPane:not(.collapsed) .gameQuestDailyToggleChevron{transform:rotate(0deg)}
      .gameQuestWeeklyCollapseBar{margin-bottom:0}
    `;
    document.head.appendChild(style);
  }

  function applyDailyState(){
    const pane = document.querySelector(".gameQuestDailyPane");
    if(!pane) return;
    const body = pane.querySelector("#gameQuestDailyBody");
    const toggle = pane.querySelector("[data-gq-collapsed-toggle]");
    pane.classList.toggle("collapsed", dailyCollapsed);
    if(body) body.hidden = dailyCollapsed;
    if(toggle) toggle.setAttribute("aria-expanded", dailyCollapsed ? "false" : "true");
  }

  function ensureWeeklyDisclosure(){
    const pane = document.querySelector(".gameQuestWeeklyPane");
    if(!pane) return;

    let body = pane.querySelector(":scope > .gameQuestWeeklyDisclosureBody");
    if(!body){
      const children = [...pane.children];
      const metaStrip = children.find(node => node.matches?.(".gameQuestMetaStrip"));
      const pct = metaStrip?.querySelector("em")?.textContent?.match(/\d+%/)?.[0] || "";

      body = document.createElement("div");
      body.className = "gameQuestWeeklyDisclosureBody";
      children.forEach(node => body.appendChild(node));
      metaStrip?.remove();

      const bar = document.createElement("div");
      bar.className = "gameQuestDailyCollapseBar gameQuestWeeklyCollapseBar";
      bar.innerHTML = `<button type="button" class="gameQuestDailyToggle gameQuestWeeklyToggle" data-gq-weekly-collapsed-toggle aria-expanded="true" aria-controls="gameQuestWeeklyBody"><span class="gameQuestDailyToggleCopy"><b>本周作战池</b><em>周常、深境与本周一次性目标</em></span><strong>${pct}</strong><span class="gameQuestDailyToggleChevron" aria-hidden="true">⌄</span></button>`;
      body.id = "gameQuestWeeklyBody";
      pane.append(bar, body);
    }
  }

  function applyWeeklyState(){
    const pane = document.querySelector(".gameQuestWeeklyPane");
    if(!pane) return;
    const body = pane.querySelector(":scope > .gameQuestWeeklyDisclosureBody");
    const toggle = pane.querySelector("[data-gq-weekly-collapsed-toggle]");
    pane.classList.toggle("collapsed", weeklyCollapsed);
    if(body) body.hidden = weeklyCollapsed;
    if(toggle) toggle.setAttribute("aria-expanded", weeklyCollapsed ? "false" : "true");
  }

  function enhance(){
    scheduled = false;
    injectStyles();
    ensureWeeklyDisclosure();
    applyDailyState();
    applyWeeklyState();
  }

  function scheduleEnhance(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function resetForGameEntry(){
    dailyCollapsed = false;
    weeklyCollapsed = false;
    scheduleEnhance();
  }

  // The old implementation persisted the daily collapse flag. It is intentionally
  // retired: each fresh visit to GAME should start with both sections visible.
  try{
    if(typeof GH_PREFIX !== "undefined") localStorage.removeItem(`${GH_PREFIX}gamequest_collapsed`);
  }catch(_){ }

  document.addEventListener("click", event => {
    const dailyToggle = event.target.closest?.("[data-gq-collapsed-toggle]");
    if(dailyToggle){
      event.preventDefault();
      event.stopPropagation();
      dailyCollapsed = !dailyCollapsed;
      applyDailyState();
      return;
    }

    const weeklyToggle = event.target.closest?.("[data-gq-weekly-collapsed-toggle]");
    if(weeklyToggle){
      event.preventDefault();
      event.stopPropagation();
      weeklyCollapsed = !weeklyCollapsed;
      applyWeeklyState();
    }
  }, true);

  // Reset disclosure state whenever GAME is entered, regardless of whether navigation
  // came from the dock, keyboard shortcuts, or another internal control.
  if(typeof setActiveAppView === "function"){
    const baseSetActiveAppView = setActiveAppView;
    setActiveAppView = function(view, ...args){
      if(String(view) === "game") resetForGameEntry();
      const result = baseSetActiveAppView.call(this, view, ...args);
      if(String(view) === "game") scheduleEnhance();
      return result;
    };
  }

  const panel = document.getElementById("gameQuestPanel");
  if(panel){
    new MutationObserver(scheduleEnhance).observe(panel, {childList:true, subtree:true});
  }

  scheduleEnhance();
})();
