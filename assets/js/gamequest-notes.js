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

  function injectStyles(){
    if(document.getElementById("gameQuestNotesStyles")) return;
    const style = document.createElement("style");
    style.id = "gameQuestNotesStyles";
    style.textContent = `
      .gqTaskNoteField{grid-column:1/-1;min-width:0}
      .gqDailyTaskNote,.gqWeeklyTaskNote{
        width:100%;min-height:62px;padding:8px 9px;border:1px solid var(--color-line);
        border-radius:var(--radius-sm);background:white;color:var(--color-ink);font:inherit;
        line-height:1.45;resize:vertical
      }
      .gameQuestTaskNote{
        margin:4px 0 0 59px;border:1px dashed color-mix(in srgb,var(--color-line-strong) 70%,transparent);
        border-radius:6px;background:color-mix(in srgb,var(--color-panel-soft) 88%,white);overflow:hidden
      }
      .gameQuestTaskNote>summary{
        min-height:32px;display:flex;align-items:center;gap:6px;padding:5px 9px;color:var(--color-muted);
        font-size:11px;font-weight:800;cursor:pointer;list-style:none;user-select:none
      }
      .gameQuestTaskNote>summary::-webkit-details-marker{display:none}
      .gameQuestTaskNote>summary::before{content:"＋";width:14px;color:var(--color-warning);font-weight:900}
      .gameQuestTaskNote[open]>summary::before{content:"−"}
      .gameQuestTaskNoteBody{
        padding:8px 10px;border-top:1px solid var(--color-line);color:var(--color-muted);font-size:12px;
        line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere
      }
      .gameQuestTaskNoteTitle{color:var(--color-ink);font-weight:800}
      @media(max-width:700px){
        .gameQuestTaskNote{margin-left:0}
        .gqDailyTaskNote,.gqWeeklyTaskNote{min-height:72px}
      }
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
        const days = Array.isArray(task.days)
          ? [...new Set(task.days.map(Number))].filter(day => [0,1,2,3,4,5,6].includes(day))
          : [];
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
      if(item && typeof item === "object"){
        return {
          id:String(item.id || ""),
          title:String(item.title || item.name || ""),
          url:String(item.url || item.link || ""),
          note:noteFrom(item),
          plan_mode:"weekly"
        };
      }
      return {id:"", title:String(item || ""), url:"", note:"", plan_mode:"weekly"};
    }).slice(0,30);
  };

  function noteEditorField(task, kind){
    const cls = kind === "weekly" ? "gqWeeklyTaskNote" : "gqDailyTaskNote";
    return `<label class="gqTaskNoteField"><span>备注（选填，执行页默认收起）</span><textarea class="${cls}" rows="2" placeholder="写清这项到底包含什么、什么时候做；不需要时留空。">${escapeHtml(task.note || "")}</textarea></label>`;
  }

  gameQuestDailyRowHtml = function(gameId, task, idx, total){
    const dayNums = Array.isArray(task.days) ? task.days.map(Number) : [];
    const dayChips = [1,2,3,4,5,6,0].map(day => {
      const on = dayNums.includes(day);
      return `<label class="gqDayChip"><input type="checkbox" class="gqDayBox" value="${day}" ${on?"checked":""}><span>${escapeHtml(dayName(day))}</span></label>`;
    }).join("");
    const last = (Number(total) || 1) - 1;
    return `<div class="gqDailyRow" data-gq-daily-row="${idx}" data-gq-task-id="${escapeHtml(task.id || "")}">
      <div class="gqTaskFields"><label><span>任务名</span><input class="gqDailyTaskTitle" value="${escapeHtml(task.title || "")}" placeholder="例如：每日基础"></label><label><span>链接（选填）</span><input class="gqDailyTaskUrl" type="url" inputmode="url" value="${escapeHtml(task.url || "")}" placeholder="https://..."></label>${noteEditorField(task,"daily")}</div>
      <div class="gqDayPicker" role="group" aria-label="出现的星期">${dayChips}</div>
      <div class="gqDailyRowOps">
        <button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-daily-move="up" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx<=0?"disabled":""} title="上移" aria-label="上移">↑</button>
        <button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-daily-move="down" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx>=last?"disabled":""} title="下移" aria-label="下移">↓</button>
        <button type="button" class="gqDailyMiniBtn" data-gq-daily-fill data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="一键设为每天出现">每天</button>
        <button type="button" class="gqDailyMiniBtn danger" data-gq-del-daily data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="删除这条任务" aria-label="删除">✕</button>
      </div>
    </div>`;
  };

  gameQuestWeeklyRowHtml = function(gameId, task, idx, total){
    const last = (Number(total) || 1) - 1;
    return `<div class="gqWeeklyRow" data-gq-weekly-row="${idx}" data-gq-task-id="${escapeHtml(task.id || "")}">
      <div class="gqTaskFields"><label><span>任务名</span><input class="gqWeeklyTaskTitle" value="${escapeHtml(task.title || "")}" placeholder="例如：每周基础"></label><label><span>链接（选填）</span><input class="gqWeeklyTaskUrl" type="url" inputmode="url" value="${escapeHtml(task.url || "")}" placeholder="https://..."></label>${noteEditorField(task,"weekly")}</div>
      <div class="gqDailyRowOps">
        <button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-weekly-move="up" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx<=0?"disabled":""} title="上移" aria-label="上移">↑</button>
        <button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-weekly-move="down" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx>=last?"disabled":""} title="下移" aria-label="下移">↓</button>
        <button type="button" class="gqDailyMiniBtn danger" data-gq-del-weekly data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="删除这条任务" aria-label="删除">✕</button>
      </div>
    </div>`;
  };

  function taskNoteHtml(task){
    const note = String(task?.note || "").trim();
    if(!note) return "";
    return `<details class="gameQuestTaskNote"><summary>备注</summary><div class="gameQuestTaskNoteBody">${escapeHtml(note)}</div></details>`;
  }

  gameQuestTaskListHtml = function(gameId, dayId, tasks){
    return `<ul class="gameQuestTaskList gameQuestTaskListV2">${tasks.map((task, idx) => {
      const done = isGameQuestItemDone(gameId, dayId, task.id, cycleYmd);
      const url = safeUrl(task.url);
      return `<li class="${done?"done":""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(gameId)}" data-gamequest-item-day="${dayId}" data-gamequest-item="${escapeHtml(task.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><i>${escapeHtml(task.title)}</i>${gameQuestTaskBadge(task)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="打开链接：${escapeHtml(task.title)}" title="打开链接：${escapeHtml(task.title)}">打开 ↗</a>`:""}</div>${taskNoteHtml(task)}</li>`;
    }).join("")}</ul>`;
  };

  gameQuestWeeklyTaskListHtml = function(gameId, tasks){
    return `<ul class="gameQuestTaskList gameQuestTaskListV2 weekly">${tasks.map((task, idx) => {
      const done = isGameQuestWeeklyItemDone(gameId, task.id, cycleYmd);
      const url = safeUrl(task.url);
      return `<li class="${done?"done":""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-weekly-item-btn="1" data-gamequest-weekly-game="${escapeHtml(gameId)}" data-gamequest-weekly-item="${escapeHtml(task.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><i>${escapeHtml(task.title)}</i>${gameQuestTaskBadge(task)}</button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="打开链接：${escapeHtml(task.title)}" title="打开链接：${escapeHtml(task.title)}">打开 ↗</a>`:""}</div>${taskNoteHtml(task)}</li>`;
    }).join("")}</ul>`;
  };

  injectStyles();

  // app.js normalizes the local config before this compatibility layer loads. The raw
  // local JSON still contains notes, so re-apply it once with the note-aware normalizer.
  try{
    const raw = localStorage.getItem(TASK_CONFIG_LOCAL_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      const gameQuest = parsed?.gameQuest;
      const hasNotes = JSON.stringify(gameQuest || {}).includes('"note"');
      if(hasNotes) applyTaskConfig(parsed, false);
    }
  }catch(error){
    console.warn("game quest note rehydrate skipped", error);
  }

  // Re-render any already-mounted board/editor so notes appear immediately.
  if(typeof renderGameQuestPanel === "function") renderGameQuestPanel();
})();
