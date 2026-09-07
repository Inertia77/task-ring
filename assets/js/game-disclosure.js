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

  try{
    if(typeof GH_PREFIX !== "undefined") localStorage.removeItem(`${GH_PREFIX}gamequest_collapsed`);
  }catch(_){ }

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

// Game Quest task notes: keep board titles compact while preserving optional detail.
// Notes are config data, do not affect task counts/completion, and render collapsed by default.
(() => {
  "use strict";

  const NOTE_ALIASES = ["note", "notes", "detail", "description"];

  function rawList(value){
    if(Array.isArray(value)) return value;
    if(typeof value === "string") return value.split(/\n+/);
    return [];
  }

  function noteFrom(item){
    if(!item || typeof item !== "object" || Array.isArray(item)) return "";
    for(const key of NOTE_ALIASES){
      const value = String(item[key] ?? "").trim();
      if(value) return value;
    }
    return "";
  }

  function matchRawItem(items, task, fallbackIndex){
    const id = String(task?.id || "").trim();
    const title = String(task?.title || "").trim();
    if(id){
      const byId = items.find(item => item && typeof item === "object" && String(item.id || "").trim() === id);
      if(byId) return byId;
    }
    if(title){
      const byTitle = items.find(item => {
        if(!item || typeof item !== "object") return false;
        return String(item.title || item.name || "").trim() === title;
      });
      if(byTitle) return byTitle;
    }
    return items[fallbackIndex];
  }

  function injectNoteStyles(){
    if(document.getElementById("gameQuestNotesStyles")) return;
    const style = document.createElement("style");
    style.id = "gameQuestNotesStyles";
    style.textContent = `
      .gqTaskNoteField{grid-column:1/-1;min-width:0}
      .gqDailyTaskNote,.gqWeeklyTaskNote{width:100%;min-height:62px;padding:8px 9px;border:1px solid var(--color-line);border-radius:var(--radius-sm);background:white;color:var(--color-ink);font:inherit;line-height:1.45;resize:vertical}
      .gameQuestTaskNote{margin:4px 0 0 59px;border:1px dashed color-mix(in srgb,var(--color-line-strong) 70%,transparent);border-radius:6px;background:color-mix(in srgb,var(--color-panel-soft) 88%,white);overflow:hidden}
      .gameQuestTaskNote>summary{min-height:32px;display:flex;align-items:center;gap:6px;padding:5px 9px;color:var(--color-muted);font-size:11px;font-weight:800;cursor:pointer;list-style:none;user-select:none}
      .gameQuestTaskNote>summary::-webkit-details-marker{display:none}
      .gameQuestTaskNote>summary::before{content:"＋";width:14px;color:var(--color-warning);font-weight:900}
      .gameQuestTaskNote[open]>summary::before{content:"−"}
      .gameQuestTaskNoteBody{padding:8px 10px;border-top:1px solid var(--color-line);color:var(--color-muted);font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
      @media(max-width:700px){.gameQuestTaskNote{margin-left:0}.gqDailyTaskNote,.gqWeeklyTaskNote{min-height:72px}}
    `;
    document.head.appendChild(style);
  }

  if(typeof normalizeGameQuestTaskList !== "function") return;

  const baseNormalizeGameQuestTaskList = normalizeGameQuestTaskList;
  normalizeGameQuestTaskList = function(value, context = "scheduled"){
    const items = rawList(value);
    return baseNormalizeGameQuestTaskList(value, context).map((task, index) => {
      const source = matchRawItem(items, task, index);
      const note = noteFrom(source);
      return note ? {...task, note} : task;
    });
  };

  gameQuestTaskStoreList = function(value, context = "scheduled"){
    return normalizeGameQuestTaskList(value, context).map(task => {
      const out = {id:task.id, title:task.title, url:task.url || "", plan_mode:task.plan_mode};
      if(task.note) out.note = String(task.note).trim();
      if(Number.isFinite(Number(task.weekly_minutes))) out.weekly_minutes = Number(task.weekly_minutes);
      if(Number.isFinite(Number(task.estimated_minutes))) out.estimated_minutes = Number(task.estimated_minutes);
      return out;
    });
  };

  buildGameQuestDailyByGame = function(cfg){
    const map = {};
    (cfg?.games || []).forEach(game => { map[game.id] = []; });
    [1,2,3,4,5,6,0].forEach(day => {
      const dayObj = (cfg?.schedule || {})[String(day)] || {};
      (cfg?.games || []).forEach(game => {
        if(!map[game.id]) map[game.id] = [];
        normalizeGameQuestTaskList(dayObj[game.id], "scheduled").forEach(task => {
          if(task.plan_mode === "weekly") return;
          const sig = task.title.trim().toLowerCase();
          let existing = map[game.id].find(item => item.title.trim().toLowerCase() === sig);
          if(!existing){
            existing = {id:task.id, title:task.title, url:task.url || "", note:task.note || "", days:[]};
            map[game.id].push(existing);
          }else{
            if(!existing.url && task.url) existing.url = task.url;
            if(!existing.note && task.note) existing.note = task.note;
          }
          if(!existing.days.includes(day)) existing.days.push(day);
        });
      });
    });
    Object.values(map).forEach(list => list.forEach(task => task.days.sort((a,b) => gameQuestDaySortValue(a) - gameQuestDaySortValue(b))));
    return map;
  };

  applyDailyByGameToSchedule = function(cfg){
    const schedule = {};
    [1,2,3,4,5,6,0].forEach(day => { schedule[String(day)] = {}; });
    (cfg.games || []).forEach(game => {
      const list = (cfg.dailyByGame && cfg.dailyByGame[game.id]) || [];
      const seen = new Set();
      list.forEach(task => {
        const title = String(task.title || "").trim();
        const url = normalizeFitnessUrl(task.url || task.link || "");
        const note = noteFrom(task);
        const days = Array.isArray(task.days) ? [...new Set(task.days.map(Number))].filter(day => [0,1,2,3,4,5,6].includes(day)) : [];
        if(!title || !days.length) return;
        const sig = title.toLowerCase();
        if(seen.has(sig)) return;
        seen.add(sig);
        const plan_mode = days.length >= 7 ? "daily" : "scheduled";
        days.forEach(day => {
          const key = String(day);
          if(!schedule[key][game.id]) schedule[key][game.id] = [];
          const stored = {id:task.id, title, url, plan_mode};
          if(note) stored.note = note;
          schedule[key][game.id].push(stored);
        });
      });
    });
    cfg.schedule = schedule;
  };

  collectGameQuestEditorState = function(){
    if(!gameQuestDraftConfig) return;
    if(!gameQuestDraftConfig.weekly) gameQuestDraftConfig.weekly = {};
    if(!gameQuestDraftConfig.dailyByGame) gameQuestDraftConfig.dailyByGame = {};

    const games = [...document.querySelectorAll("[data-gq-game-row]")].map((row, idx) => ({
      id:row.dataset.gqGameRow || `gq-${idx+1}`,
      name:row.querySelector(".gqMetaName")?.value.trim() || `游戏 ${idx+1}`,
      short:row.querySelector(".gqMetaShort")?.value.trim() || row.querySelector(".gqMetaName")?.value.trim() || `游戏 ${idx+1}`,
      icon:row.querySelector(".gqMetaIcon")?.value.trim() || "GQ",
      accent:row.querySelector(".gqMetaAccent")?.value || "cyan",
      enabled:row.querySelector(".gqMetaEnabled")?.checked !== false
    }));
    if(games.length) gameQuestDraftConfig.games = games;

    document.querySelectorAll("[data-gq-daily-game]").forEach(card => {
      const gameId = card.dataset.gqDailyGame;
      const rows = [...card.querySelectorAll("[data-gq-daily-row]")];
      gameQuestDraftConfig.dailyByGame[gameId] = rows.map(row => ({
        id:row.dataset.gqTaskId || "",
        title:row.querySelector(".gqDailyTaskTitle")?.value.trim() || "",
        url:row.querySelector(".gqDailyTaskUrl")?.value.trim() || "",
        note:row.querySelector(".gqDailyTaskNote")?.value.trim() || "",
        days:[...row.querySelectorAll(".gqDayBox:checked")].map(box => Number(box.value))
      }));
    });

    document.querySelectorAll("[data-gq-weekly-edit-game]").forEach(card => {
      const gameId = card.dataset.gqWeeklyEditGame;
      const rows = [...card.querySelectorAll("[data-gq-weekly-row]")];
      gameQuestDraftConfig.weekly[gameId] = gameQuestTaskStoreList(rows.map(row => ({
        id:row.dataset.gqTaskId || "",
        title:row.querySelector(".gqWeeklyTaskTitle")?.value.trim() || "",
        url:row.querySelector(".gqWeeklyTaskUrl")?.value.trim() || "",
        note:row.querySelector(".gqWeeklyTaskNote")?.value.trim() || "",
        plan_mode:"weekly"
      })), "weekly");
    });

    applyDailyByGameToSchedule(gameQuestDraftConfig);
  };

  gameQuestWeeklyEditorTasksFor = function(gameId, cfg = gameQuestDraftConfig){
    const raw = cfg?.weekly?.[gameId];
    if(!Array.isArray(raw)) return [];
    return raw.map(item => {
      if(item && typeof item === "object") return {id:String(item.id || ""), title:String(item.title || item.name || ""), url:String(item.url || item.link || ""), note:noteFrom(item), plan_mode:"weekly"};
      return {id:"", title:String(item || ""), url:"", note:"", plan_mode:"weekly"};
    }).slice(0,30);
  };

  function noteEditorField(task, kind){
    const cls = kind === "weekly" ? "gqWeeklyTaskNote" : "gqDailyTaskNote";
    return `<label class="gqTaskNoteField"><span>备注（选填，执行页默认收起）</span><textarea class="${cls}" rows="2" placeholder="写清这项到底包含什么、什么时候做；不需要时留空。">${escapeHtml(task.note || "")}</textarea></label>`;
  }

  gameQuestDailyRowHtml = function(gameId, task, idx, total){
    const dayNums = Array.isArray(task.days) ? task.days.map(Number) : [];
    const dayChips = [1,2,3,4,5,6,0].map(day => `<label class="gqDayChip"><input type="checkbox" class="gqDayBox" value="${day}" ${dayNums.includes(day)?"checked":""}><span>${escapeHtml(dayName(day))}</span></label>`).join("");
    const last = (Number(total) || 1) - 1;
    return `<div class="gqDailyRow" data-gq-daily-row="${idx}" data-gq-task-id="${escapeHtml(task.id || "")}"><div class="gqTaskFields"><label><span>任务名</span><input class="gqDailyTaskTitle" value="${escapeHtml(task.title || "")}" placeholder="例如：每日基础"></label><label><span>链接（选填）</span><input class="gqDailyTaskUrl" type="url" inputmode="url" value="${escapeHtml(task.url || "")}" placeholder="https://..."></label>${noteEditorField(task,"daily")}</div><div class="gqDayPicker" role="group" aria-label="出现的星期">${dayChips}</div><div class="gqDailyRowOps"><button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-daily-move="up" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx<=0?"disabled":""} title="上移" aria-label="上移">↑</button><button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-daily-move="down" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx>=last?"disabled":""} title="下移" aria-label="下移">↓</button><button type="button" class="gqDailyMiniBtn" data-gq-daily-fill data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="一键设为每天出现">每天</button><button type="button" class="gqDailyMiniBtn danger" data-gq-del-daily data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="删除这条任务" aria-label="删除">✕</button></div></div>`;
  };

  gameQuestWeeklyRowHtml = function(gameId, task, idx, total){
    const last = (Number(total) || 1) - 1;
    return `<div class="gqWeeklyRow" data-gq-weekly-row="${idx}" data-gq-task-id="${escapeHtml(task.id || "")}"><div class="gqTaskFields"><label><span>任务名</span><input class="gqWeeklyTaskTitle" value="${escapeHtml(task.title || "")}" placeholder="例如：每周基础"></label><label><span>链接（选填）</span><input class="gqWeeklyTaskUrl" type="url" inputmode="url" value="${escapeHtml(task.url || "")}" placeholder="https://..."></label>${noteEditorField(task,"weekly")}</div><div class="gqDailyRowOps"><button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-weekly-move="up" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx<=0?"disabled":""} title="上移" aria-label="上移">↑</button><button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-weekly-move="down" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx>=last?"disabled":""} title="下移" aria-label="下移">↓</button><button type="button" class="gqDailyMiniBtn danger" data-gq-del-weekly data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="删除这条任务" aria-label="删除">✕</button></div></div>`;
  };

  function taskNoteHtml(task){
    const note = String(task?.note || "").trim();
    return note ? `<details class="gameQuestTaskNote"><summary>备注</summary><div class="gameQuestTaskNoteBody">${escapeHtml(note)}</div></details>` : "";
  }

  gameQuestTaskListHtml = function(gameId, dayId, tasks){
    return `<ul class="gameQuestTaskList gameQuestTaskListV2">${tasks.map((task, idx) => {const done=isGameQuestItemDone(gameId,dayId,task.id,cycleYmd),url=safeUrl(task.url);return `<li class="${done?"done":""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(gameId)}" data-gamequest-item-day="${dayId}" data-gamequest-item="${escapeHtml(task.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><i>${escapeHtml(task.title)}</i>${gameQuestTaskBadge(task)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="打开链接：${escapeHtml(task.title)}" title="打开链接：${escapeHtml(task.title)}">打开 ↗</a>`:""}</div>${taskNoteHtml(task)}</li>`;}).join("")}</ul>`;
  };

  gameQuestWeeklyTaskListHtml = function(gameId, tasks){
    return `<ul class="gameQuestTaskList gameQuestTaskListV2 weekly">${tasks.map((task, idx) => {const done=isGameQuestWeeklyItemDone(gameId,task.id,cycleYmd),url=safeUrl(task.url);return `<li class="${done?"done":""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-weekly-item-btn="1" data-gamequest-weekly-game="${escapeHtml(gameId)}" data-gamequest-weekly-item="${escapeHtml(task.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><i>${escapeHtml(task.title)}</i>${gameQuestTaskBadge(task)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="打开链接：${escapeHtml(task.title)}" title="打开链接：${escapeHtml(task.title)}">打开 ↗</a>`:""}</div>${taskNoteHtml(task)}</li>`;}).join("")}</ul>`;
  };

  injectNoteStyles();

  try{
    const raw = localStorage.getItem(TASK_CONFIG_LOCAL_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(JSON.stringify(parsed?.gameQuest || {}).includes('"note"')) applyTaskConfig(parsed, false);
    }
  }catch(error){
    console.warn("game quest note rehydrate skipped", error);
  }

  if(typeof renderGameQuestPanel === "function") renderGameQuestPanel();
})();
