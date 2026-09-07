// Game Quest view policy: daily and weekly live on separate sub-pages.
// Each sub-page is collapsible; fresh GAME entry starts on expanded Daily.
(() => {
  "use strict";

  let activePage = "daily";
  let dailyCollapsed = false;
  let weeklyCollapsed = false;
  let scheduled = false;
  let pendingTabViewport = null;

  function injectStyles(){
    if(document.getElementById("gameDisclosurePolicyStyles")) return;
    const style = document.createElement("style");
    style.id = "gameDisclosurePolicyStyles";
    style.textContent = `
      .gameQuestWeeklyDisclosureBody[hidden]{display:none!important}
      .gameQuestWeeklyPane.collapsed .gameQuestDailyToggleChevron{transform:rotate(-90deg)}
      .gameQuestWeeklyPane:not(.collapsed) .gameQuestDailyToggleChevron{transform:rotate(0deg)}
      .gameQuestWeeklyCollapseBar{margin-bottom:0}
      .gameQuestPageInactive{display:none!important}

      .gameQuestPageTabs{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
        margin:10px 0 12px;
        padding:6px;
        border:1px solid color-mix(in srgb,var(--color-line-strong,#8d887c) 48%,transparent);
        border-radius:16px;
        background:color-mix(in srgb,var(--color-surface,#f7f4ec) 88%,transparent);
        box-shadow:0 8px 24px rgba(35,31,24,.05);
      }
      .gameQuestPageTab{
        min-width:0;
        min-height:60px;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:10px;
        padding:9px 12px;
        border:1px solid transparent;
        border-radius:12px;
        background:transparent;
        color:inherit;
        text-align:left;
        cursor:pointer;
        transition:background .16s ease,border-color .16s ease,transform .16s ease,box-shadow .16s ease;
      }
      .gameQuestPageTab:hover{transform:translateY(-1px)}
      .gameQuestPageTabCopy{display:grid;gap:2px;min-width:0}
      .gameQuestPageTabCopy small{
        font-size:10px;
        line-height:1;
        letter-spacing:.12em;
        font-weight:800;
        opacity:.58;
      }
      .gameQuestPageTabCopy b{
        font-size:15px;
        line-height:1.2;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .gameQuestPageTabCopy em{
        font-size:11px;
        line-height:1.2;
        font-style:normal;
        opacity:.62;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .gameQuestPageTabPct{
        min-width:46px;
        padding:7px 8px;
        border-radius:999px;
        font-size:12px;
        font-weight:900;
        text-align:center;
        background:rgba(255,255,255,.58);
        border:1px solid rgba(0,0,0,.08);
        font-variant-numeric:tabular-nums;
      }
      .gameQuestPageTab[data-gq-page="daily"].active{
        border-color:rgba(58,132,216,.38);
        background:linear-gradient(135deg,rgba(70,145,231,.15),rgba(255,255,255,.58));
        box-shadow:inset 3px 0 0 rgba(54,133,224,.72);
      }
      .gameQuestPageTab[data-gq-page="weekly"].active{
        border-color:rgba(127,87,205,.38);
        background:linear-gradient(135deg,rgba(132,91,211,.15),rgba(255,255,255,.58));
        box-shadow:inset 3px 0 0 rgba(123,80,201,.72);
      }
      .gameQuestPageTab.active .gameQuestPageTabCopy small{opacity:.86}
      .gameQuestPageTab.active .gameQuestPageTabPct{background:rgba(255,255,255,.82)}

      @media (max-width:640px){
        .gameQuestPageTabs{gap:5px;margin:8px 0 10px;padding:4px;border-radius:13px}
        .gameQuestPageTab{min-height:52px;padding:7px 8px;gap:6px;border-radius:10px}
        .gameQuestPageTabCopy small{font-size:9px}
        .gameQuestPageTabCopy b{font-size:13px}
        .gameQuestPageTabCopy em{display:none}
        .gameQuestPageTabPct{min-width:40px;padding:6px;font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  function pctFrom(selector){
    const text = document.querySelector(selector)?.textContent || "";
    return text.match(/\d+%/)?.[0] || "0%";
  }

  function ensurePageTabs(){
    const shell = document.querySelector(".gameQuestShell");
    const sections = shell?.querySelector(".gameQuestBoardSections");
    if(!shell || !sections) return;

    let tabs = shell.querySelector(":scope > .gameQuestPageTabs");
    if(!tabs){
      tabs = document.createElement("nav");
      tabs.className = "gameQuestPageTabs";
      tabs.setAttribute("aria-label", "游戏作战区每日与每周切换");
      tabs.innerHTML = `
        <button type="button" class="gameQuestPageTab" data-gq-page="daily" aria-pressed="true">
          <span class="gameQuestPageTabCopy"><small>DAILY OPS</small><b>每日清理</b><em>今日与指定日任务</em></span>
          <span class="gameQuestPageTabPct" data-gq-page-pct="daily">0%</span>
        </button>
        <button type="button" class="gameQuestPageTab" data-gq-page="weekly" aria-pressed="false">
          <span class="gameQuestPageTabCopy"><small>WEEKLY OPS</small><b>每周作战</b><em>周常、高难与一次性目标</em></span>
          <span class="gameQuestPageTabPct" data-gq-page-pct="weekly">0%</span>
        </button>`;
      shell.insertBefore(tabs, sections);
    }

    const dailyPct = pctFrom(".gameQuestDailyToggle > strong");
    const weeklyPct = pctFrom(".gameQuestWeeklyToggle > strong") || pctFrom(".gameQuestWeeklyPane .gameQuestMetaStrip em");
    const dailyPctEl = tabs.querySelector('[data-gq-page-pct="daily"]');
    const weeklyPctEl = tabs.querySelector('[data-gq-page-pct="weekly"]');
    if(dailyPctEl) dailyPctEl.textContent = dailyPct;
    if(weeklyPctEl) weeklyPctEl.textContent = weeklyPct;

    tabs.querySelectorAll("[data-gq-page]").forEach(button => {
      const selected = button.dataset.gqPage === activePage;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
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
      bar.innerHTML = `<button type="button" class="gameQuestDailyToggle gameQuestWeeklyToggle" data-gq-weekly-collapsed-toggle aria-expanded="true" aria-controls="gameQuestWeeklyBody"><span class="gameQuestDailyToggleCopy"><b>每周作战</b><em>周常、高难与本周一次性目标</em></span><strong>${pct}</strong><span class="gameQuestDailyToggleChevron" aria-hidden="true">⌄</span></button>`;
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

  function applyPageState(){
    const daily = document.querySelector(".gameQuestDailyPane");
    const weekly = document.querySelector(".gameQuestWeeklyPane");
    const showDaily = activePage === "daily";
    if(daily){
      daily.classList.toggle("gameQuestPageInactive", !showDaily);
      daily.setAttribute("aria-hidden", showDaily ? "false" : "true");
    }
    if(weekly){
      weekly.classList.toggle("gameQuestPageInactive", showDaily);
      weekly.setAttribute("aria-hidden", showDaily ? "true" : "false");
    }

    document.querySelectorAll(".gameQuestPageTab[data-gq-page]").forEach(button => {
      const selected = button.dataset.gqPage === activePage;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });

    const description = document.querySelector(".gameQuestTopTitle .taskAreaDescription");
    if(description) description.textContent = "每日清理与每周作战分屏查看；切换页面时默认展开。";
  }

  function enhance(){
    scheduled = false;
    injectStyles();
    ensureWeeklyDisclosure();
    ensurePageTabs();
    applyDailyState();
    applyWeeklyState();
    applyPageState();
  }

  function scheduleEnhance(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function resetForGameEntry(){
    activePage = "daily";
    dailyCollapsed = false;
    weeklyCollapsed = false;
    scheduleEnhance();
  }

  function switchPage(page){
    activePage = page === "weekly" ? "weekly" : "daily";
    if(activePage === "daily") dailyCollapsed = false;
    else weeklyCollapsed = false;
    applyDailyState();
    applyWeeklyState();
    applyPageState();
  }

  function gameViewIsCurrentlyActive(){
    const dock = document.querySelector('.viewDockBtn[data-view-target="game"]');
    if(dock) return dock.classList.contains("active");
    const panel = document.getElementById("gameQuestPanel");
    return !!panel?.classList.contains("active");
  }

  function captureTabViewport(target){
    const tab = target?.closest?.("[data-gq-game-select],[data-gamequest-day-select],[data-gq-weekly-filter]");
    if(!tab) return;
    pendingTabViewport = {
      x: window.scrollX,
      y: window.scrollY,
      page: activePage,
      selector: tab.hasAttribute("data-gq-game-select")
        ? `[data-gq-game-select="${CSS.escape(tab.dataset.gqGameSelect || "")}"]`
        : tab.hasAttribute("data-gamequest-day-select")
          ? `[data-gamequest-day-select="${CSS.escape(tab.dataset.gamequestDaySelect || "")}"]`
          : `[data-gq-weekly-filter="${CSS.escape(tab.dataset.gqWeeklyFilter || "")}"]`
    };
  }

  function restoreTabViewport(){
    const snapshot = pendingTabViewport;
    pendingTabViewport = null;
    if(!snapshot) return;
    activePage = snapshot.page === "weekly" ? "weekly" : "daily";
    applyPageState();
    requestAnimationFrame(() => {
      window.scrollTo(snapshot.x, snapshot.y);
      const replacement = document.querySelector(snapshot.selector);
      if(replacement && replacement.matches(":focus-visible")) replacement.focus({preventScroll:true});
    });
  }

  // Retire the old persistent daily-collapse state. Collapse is a temporary in-page
  // action only; a real navigation into GAME starts on expanded Daily.
  try{
    if(typeof GH_PREFIX !== "undefined") localStorage.removeItem(`${GH_PREFIX}gamequest_collapsed`);
  }catch(_){ }

  // Product UI and legacy handlers rebuild the game panel for several tab actions.
  // Re-apply the split-page state synchronously so a render cannot briefly expose both
  // panes, reset Weekly back to Daily, or clamp the viewport before the next frame.
  if(typeof window.renderGameQuestPanel === "function"){
    const baseRenderGameQuestPanel = window.renderGameQuestPanel;
    window.renderGameQuestPanel = function(...args){
      const result = baseRenderGameQuestPanel.apply(this, args);
      enhance();
      restoreTabViewport();
      return result;
    };
  }

  document.addEventListener("click", event => {
    const pageButton = event.target.closest?.("[data-gq-page]");
    if(pageButton){
      event.preventDefault();
      event.stopPropagation();
      switchPage(pageButton.dataset.gqPage);
      return;
    }

    captureTabViewport(event.target);

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

  // Only a real transition from another top-level page into GAME resets to Daily.
  // Re-renders that merely re-apply the already-active GAME view must not reset the
  // selected Daily/Weekly sub-page.
  if(typeof setActiveAppView === "function"){
    const baseSetActiveAppView = setActiveAppView;
    setActiveAppView = function(view, ...args){
      const targetIsGame = String(view) === "game";
      const enteringGame = targetIsGame && !gameViewIsCurrentlyActive();
      if(enteringGame) resetForGameEntry();
      const result = baseSetActiveAppView.call(this, view, ...args);
      if(targetIsGame) scheduleEnhance();
      return result;
    };
  }

  const panel = document.getElementById("gameQuestPanel");
  if(panel){
    new MutationObserver(scheduleEnhance).observe(panel, {childList:true, subtree:true});
  }

  scheduleEnhance();
})();
