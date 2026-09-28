(function(){
  "use strict";

  const VERSION=4;
  const BOARD_ORDER=["daily","weekly","cycle","version"];
  const BOARD_META={
    daily:{label:"日常",short:"DAILY",sub:"每天或高频重复处理的基础事项。"},
    weekly:{label:"周常",short:"WEEKLY",sub:"按自然周重置或结算的固定事项。"},
    cycle:{label:"周期",short:"CYCLE",sub:"按玩法轮换周期刷新的挑战任务。"},
    version:{label:"版本",short:"VERSION",sub:"随版本、赛季或内容更新推进的任务。"}
  };
  const PRIORITY_ORDER=["zzz","nte","wuwa","hsr","onmyoji","endfield"];
  const PRIORITY=new Map(PRIORITY_ORDER.map(function(id,i){return [id,i+1]}));
  const LEGACY_CYCLE_TITLES=new Set([
    "式舆防卫战·剧变节点","危局强袭战",
    "末日幻影","虚构叙事","混沌回忆","异相仲裁",
    "逆境深塔","冥歌海墟","终焉矩阵",
    "轨外之境","战争回响（轮换周期）"
  ]);
  const LEGACY_VERSION_TITLES=new Set([
    "迷宫诡域赛季进度","影拓丰碑（内容更新时）","蚀像寻遗（内容更新时）"
  ]);
  const LEGACY_DAILY_TITLES=new Set(["环境监测站（每2日）"]);
  const BOARD_STORAGE_KEY="taskring_gamequest_board_v4";

  window.TaskRingGameOpsV4={version:VERSION,boards:BOARD_ORDER.slice(),priorityOrder:PRIORITY_ORDER.slice()};

  function record(v){return !!v&&typeof v==="object"&&!Array.isArray(v)}
  function cleanTitle(v){return String(v||"").replace(/^(?:必|必做|选|选做|MUST|OPTIONAL)\s*[｜|:：]\s*/i,"").trim()}
  function normUrl(v){return typeof normalizeFitnessUrl==="function"?normalizeFitnessUrl(v||""):String(v||"").trim()}
  function normTask(raw,idx,board,used){
    const obj=record(raw)?raw:{title:raw};
    const title=cleanTitle(obj.title||obj.name||"");
    if(!title)return null;
    let id=String(obj.id||slugifyId(board+"-"+title,board+"-"+(idx+1))).trim();
    if(used.has(id)){let base=id,n=2;while(used.has(base+"-"+n))n++;id=base+"-"+n}
    used.add(id);
    const out={id:id,title:title,url:normUrl(obj.url||obj.link||""),enabled:obj.enabled!==false};
    const note=String(obj.note||obj.detail||"").trim();
    if(note)out.note=note;
    if((board==="cycle"||board==="version")&&String(obj.reset_key||obj.period_key||obj.version_key||"").trim()){
      out.reset_key=String(obj.reset_key||obj.period_key||obj.version_key).trim();
    }
    return out;
  }
  function normList(value,board){
    const list=Array.isArray(value)?value:(typeof value==="string"?value.split(/\n+/):[]);
    const used=new Set();
    return list.map(function(x,i){return normTask(x,i,board,used)}).filter(function(x){return x&&x.enabled!==false}).slice(0,40);
  }
  function dedupePush(target,task,board){
    if(!task||!task.title)return;
    const sig=(String(task.id||"")+"|"+task.title).toLowerCase();
    if(target.some(function(x){return (String(x.id||"")+"|"+x.title).toLowerCase()===sig||x.title===task.title}))return;
    const used=new Set(target.map(function(x){return x.id}));
    const normalized=normTask(task,target.length,board,used);
    if(normalized)target.push(normalized);
  }
  function legacyBucket(task,source){
    const title=cleanTitle(task&&task.title||task);
    if(LEGACY_VERSION_TITLES.has(title))return "version";
    if(LEGACY_CYCLE_TITLES.has(title))return "cycle";
    if(LEGACY_DAILY_TITLES.has(title))return "daily";
    return source==="daily"?"daily":"weekly";
  }
  function priorityOf(game,idx){
    const fixed=PRIORITY.get(String(game&&game.id||""));
    if(fixed)return fixed;
    const n=Number(game&&game.priority);
    return Number.isFinite(n)&&n>0?n:100+idx;
  }
  function normalizeGames(srcGames,fallbackGames){
    const raw=Array.isArray(srcGames)&&srcGames.length?srcGames:(Array.isArray(fallbackGames)?fallbackGames:[]);
    const seen=new Set();
    return raw.map(function(g,idx){
      const name=String(g&&g.name||g&&g.short||("游戏 "+(idx+1))).trim()||("游戏 "+(idx+1));
      let id=String(g&&g.id||slugifyId(name,"game")).trim();
      if(seen.has(id)){let base=id,n=2;while(seen.has(base+"-"+n))n++;id=base+"-"+n}
      seen.add(id);
      return {
        id:id,
        name:name,
        short:String(g&&g.short||name).trim()||name,
        icon:String(g&&g.icon||"GQ").trim()||"GQ",
        accent:String(g&&g.accent||["gold","rose","cyan","violet","amber","blue"][idx%6]).trim()||"cyan",
        enabled:g&&g.enabled===false?false:true,
        priority:priorityOf(g,idx)
      };
    }).sort(function(a,b){return a.priority-b.priority||a.name.localeCompare(b.name,"zh-CN")});
  }
  function emptyBoards(games){
    const boards={};
    BOARD_ORDER.forEach(function(board){
      boards[board]={};
      games.forEach(function(g){boards[board][g.id]=[]});
    });
    return boards;
  }
  function migrateLegacy(src,games){
    const boards=emptyBoards(games);
    const ids=new Set(games.map(function(g){return g.id}));
    [0,1,2,3,4,5,6].forEach(function(day){
      const dayObj=record(src.schedule&&src.schedule[String(day)])?src.schedule[String(day)]:{};
      Object.keys(dayObj).forEach(function(gid){
        if(!ids.has(gid))return;
        (Array.isArray(dayObj[gid])?dayObj[gid]:[]).forEach(function(t){
          dedupePush(boards.daily[gid],t,"daily");
        });
      });
    });
    Object.keys(record(src.weekly)?src.weekly:{}).forEach(function(gid){
      if(!ids.has(gid))return;
      (Array.isArray(src.weekly[gid])?src.weekly[gid]:[]).forEach(function(t){
        const board=legacyBucket(t,"weekly");
        dedupePush(boards[board][gid],t,board);
      });
    });
    Object.keys(record(src.interest)?src.interest:{}).forEach(function(gid){
      if(!ids.has(gid))return;
      (Array.isArray(src.interest[gid])?src.interest[gid]:[]).forEach(function(t){
        let source=String(t&&t.cadence||"").toLowerCase()==="daily"?"daily":"weekly";
        const board=legacyBucket(t,source);
        dedupePush(boards[board][gid],t,board);
      });
    });
    return boards;
  }

  const baseNormalizeGameQuestConfig=normalizeGameQuestConfig;
  normalizeGameQuestConfig=function(config){
    const fallback=deepClone(typeof defaultGameQuestConfig!=="undefined"?defaultGameQuestConfig:{version:VERSION,games:[],boards:{}});
    const src=record(config)?config:fallback;
    let fallbackBase;
    try{fallbackBase=baseNormalizeGameQuestConfig(fallback)}catch(_){fallbackBase={games:fallback.games||[]}}
    const games=normalizeGames(src.games,fallbackBase.games||fallback.games||[]);
    let boards;
    if(record(src.boards)){
      boards=emptyBoards(games);
      BOARD_ORDER.forEach(function(board){
        const source=record(src.boards[board])?src.boards[board]:{};
        games.forEach(function(g){boards[board][g.id]=normList(source[g.id]||[],board)});
      });
    }else{
      boards=migrateLegacy(src,games);
    }
    return {
      version:VERSION,
      updatedAt:String(src.updatedAt||""),
      priorityOrder:PRIORITY_ORDER.slice(),
      games:games,
      boards:boards
    };
  };

  gameQuestTaskStoreList=function(value,context){
    const board=BOARD_ORDER.includes(context)?context:(context==="weekly"?"weekly":"daily");
    return normList(value,board);
  };

  function sortedGames(cfg){
    return (cfg&&cfg.games||[]).filter(function(g){return g.enabled!==false}).slice().sort(function(a,b){
      return priorityOf(a,0)-priorityOf(b,0)||a.name.localeCompare(b.name,"zh-CN");
    });
  }
  enabledGameQuestGames=function(cfg){return sortedGames(cfg||gameQuestConfig)};

  function boardTasks(board,gid,cfg){
    const source=cfg||gameQuestConfig;
    return normList(source&&source.boards&&source.boards[board]&&source.boards[board][gid]||[],board);
  }
  function resetScope(board,task){
    if(board==="daily")return typeof ymd==="function"?ymd(operationalNow):new Date().toISOString().slice(0,10);
    if(board==="weekly")return String(cycleYmd||"week");
    return String(task&&task.reset_key||"current");
  }
  function taskKey(board,gid,task){
    return GH_PREFIX+"gqv4_"+board+"_"+resetScope(board,task)+"_"+gid+"_"+task.id;
  }
  function taskDone(board,gid,task){return localStorage.getItem(taskKey(board,gid,task))==="1"}
  function setTaskDone(board,gid,task,val,el){
    syncSetItem(taskKey(board,gid,task),val);
    if(val&&el&&typeof playCompletionEffect==="function"){
      playCompletionEffect({level:"micro",category:"gamecreate",anchor:el,title:"游戏项目完成",eventId:"gqv4:"+board+":"+gid+":"+task.id+":"+resetScope(board,task)});
    }
    renderAll();
  }
  function entryFor(board,g,cfg){
    const tasks=boardTasks(board,g.id,cfg);
    const done=tasks.filter(function(t){return taskDone(board,g.id,t)}).length;
    return {game:g,tasks:tasks,done:done,total:tasks.length,cardDone:tasks.length>0&&done>=tasks.length};
  }
  function entriesFor(board,cfg){
    return sortedGames(cfg||gameQuestConfig).map(function(g){return entryFor(board,g,cfg||gameQuestConfig)});
  }
  function boardStats(board,cfg){
    const entries=entriesFor(board,cfg);
    const total=entries.reduce(function(s,e){return s+e.total},0);
    const done=entries.reduce(function(s,e){return s+e.done},0);
    return {done:done,total:total,pct:total?Math.round(done/total*100):0,cards:entries.length,cardsDone:entries.filter(function(e){return e.cardDone}).length};
  }

  gameQuestStats=function(){return boardStats("daily")};
  gameQuestWeeklyStats=function(){return boardStats("weekly")};
  gameQuestWeekStats=function(){return boardStats("daily")};
  gameQuestEntriesForDay=function(_d,cfg){return entriesFor("daily",cfg||gameQuestConfig)};
  gameQuestWeeklyEntries=function(cfg){return entriesFor("weekly",cfg||gameQuestConfig)};
  gameQuestTaskObjectsFor=function(gid,_d,cfg){return boardTasks("daily",gid,cfg||gameQuestConfig)};
  gameQuestWeeklyTasksFor=function(gid,cfg){return boardTasks("weekly",gid,cfg||gameQuestConfig)};

  function currentBoard(){
    const saved=localStorage.getItem(BOARD_STORAGE_KEY);
    return BOARD_ORDER.includes(saved)?saved:"daily";
  }
  function setCurrentBoard(board){
    if(!BOARD_ORDER.includes(board))board="daily";
    localStorage.setItem(BOARD_STORAGE_KEY,board);
    renderGameQuestPanel();
  }
  setGameQuestBoardMode=function(mode){
    const map={today:"daily",week:"weekly",interest:"version"};
    setCurrentBoard(BOARD_ORDER.includes(mode)?mode:(map[mode]||"daily"));
  };

  function esc(v){return escapeHtml(String(v==null?"":v))}
  function noteHtml(task){
    const note=String(task.note||"").trim();
    return note?'<details class="gameQuestTaskNote"><summary>备注</summary><div class="gameQuestTaskNoteBody">'+esc(note)+'</div></details>':"";
  }
  function taskRows(board,entry){
    if(!entry.tasks.length)return '<div class="gqV4EmptyTask">暂无任务</div>';
    return '<ul class="gameQuestTaskList gameQuestTaskListV2 gqV4TaskList">'+entry.tasks.map(function(t,idx){
      const done=taskDone(board,entry.game.id,t),url=safeUrl(t.url);
      const reset=(board==="cycle"||board==="version")&&t.reset_key?'<span class="gqV4ResetTag">'+esc(t.reset_key)+'</span>':"";
      return '<li class="'+(done?"done":"")+'"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 gqV4TaskBtn '+(done?"done":"")+'" data-gqv4-task="1" data-board="'+esc(board)+'" data-game="'+esc(entry.game.id)+'" data-task="'+esc(t.id)+'" aria-pressed="'+(done?"true":"false")+'"><span class="gameQuestTaskNo">'+String(idx+1).padStart(2,"0")+'</span><span class="gameQuestMiniBox"></span><i>'+esc(t.title)+'</i>'+reset+'</button>'+(url?'<a class="gameQuestTaskOpen" href="'+url+'" target="_blank" rel="noopener noreferrer">打开 ↗</a>':"")+'</div>'+noteHtml(t)+'</li>';
    }).join("")+'</ul>';
  }
  function gameCard(board,entry){
    const g=entry.game,pct=entry.total?Math.round(entry.done/entry.total*100):0;
    const priority=priorityOf(g,0);
    return '<article class="gameQuestCard gameQuestCardV2 gqV4GameCard accent-'+esc(g.accent)+' '+(entry.cardDone?"done":"")+'" style="--gq-p:'+pct+'%"><div class="gameQuestCardTop"><button type="button" class="gameQuestCheck '+(entry.cardDone?"done":"")+'" data-gqv4-card="1" data-board="'+esc(board)+'" data-game="'+esc(g.id)+'" aria-pressed="'+(entry.cardDone?"true":"false")+'" '+(entry.total?"":"disabled")+'><span></span></button><span class="gqV4Priority">0'+priority+'</span><span class="gameQuestIcon">'+esc(String(g.icon||g.name).slice(0,4))+'</span><div class="gameQuestNameWrap"><span class="gameQuestName">'+esc(g.name)+'</span><span class="gameQuestShort">优先度 #'+priority+' · '+entry.total+' 项</span></div><span class="gameQuestCount">'+entry.done+'/'+entry.total+'</span></div><div class="gameQuestProgressRail"><span></span></div><div class="gameQuestCardBody">'+taskRows(board,entry)+'</div></article>';
  }
  function boardTabs(active){
    return '<nav class="gqV4BoardTabs" aria-label="游戏作战区板块">'+BOARD_ORDER.map(function(board){
      const s=boardStats(board);
      return '<button type="button" class="gqV4BoardTab '+(active===board?"active":"")+'" data-gqv4-board="'+board+'"><span>'+BOARD_META[board].label+'</span><b>'+s.done+'/'+s.total+'</b><em>'+BOARD_META[board].short+'</em></button>';
    }).join("")+'</nav>';
  }
  renderGameQuestPanel=function(){
    const panel=document.getElementById("gameQuestPanel");if(!panel)return;
    const board=currentBoard(),meta=BOARD_META[board],stats=boardStats(board),entries=entriesFor(board);
    const active=readActiveTimer(),gqActive=active&&active.kind==="gamequest";
    const top='<div class="gameQuestTopBar gqV4Top"><div class="gameQuestTopTitle"><span>GAME QUEST / FOUR-LANE OPS</span><strong>游戏作战区</strong><em>日常 · 周常 · 周期 · 版本｜固定优先度：绝区零 &gt; 异环 &gt; 鸣潮 &gt; 崩铁 &gt; 阴阳师 &gt; 终末地。</em></div><div class="gameQuestHeroSide"><div class="gameQuestTopMeter"><span class="gameQuestMiniRing" style="--p:'+stats.pct+'%"><i>'+stats.pct+'%</i></span><span class="gameCommandCopy"><small>'+meta.short+'</small><b>'+stats.done+'/'+stats.total+'</b><em>'+meta.label+'完成度</em></span></div><button type="button" class="gameQuestTopTimer '+(gqActive?"active":"")+'" data-timer-start-gamequest="1" data-cycle="'+esc(cycleYmd)+'"><span class="gameCommandIcon">'+(gqActive?(active.paused?"Ⅱ":"◷"):"◷")+'</span><span class="gameCommandCopy"><small>TIMER</small><b '+(gqActive?'data-live-timer="1"':"")+'>'+(gqActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时")+'</b><em>'+(gqActive?(active.paused?"已暂停":"游戏计时中"):"整体计时")+'</em></span></button><button type="button" class="gameCommandBtn gameQuestTopManual" data-manual-time-entry="gamequest"><span class="gameCommandIcon">＋</span><span class="gameCommandCopy"><small>MANUAL</small><b>补记</b><em>游戏时间</em></span></button><button type="button" class="gameCommandBtn gameQuestEditQuick" data-open-game-editor><span class="gameCommandIcon">✎</span><span class="gameCommandCopy"><small>QUEST</small><b>编辑任务</b><em>四板块</em></span></button></div></div>';
    const info='<div class="gqV4BoardIntro '+board+'"><div><span>'+meta.short+'</span><b>'+meta.label+'</b><em>'+meta.sub+'</em></div><strong>'+stats.done+'/'+stats.total+'</strong></div>';
    const cards='<div class="gameQuestGrid gqV4Grid">'+entries.map(function(e){return gameCard(board,e)}).join("")+'</div>';
    panel.innerHTML='<div class="gameQuestShell gameQuestV4">'+top+boardTabs(board)+info+cards+'</div>';
  };

  function setCard(board,gid,val,el){
    const game=sortedGames(gameQuestConfig).find(function(g){return g.id===gid});if(!game)return;
    const entry=entryFor(board,game);
    entry.tasks.forEach(function(t){syncSetItem(taskKey(board,gid,t),val)});
    if(val&&el&&entry.tasks.length&&typeof playCompletionEffect==="function"){
      playCompletionEffect({level:"parent",category:"gamecreate",anchor:el,title:game.name+" · "+BOARD_META[board].label+"完成",eventId:"gqv4-card:"+board+":"+gid+":"+Date.now()});
    }
    renderAll();
  }

  function editorTaskRow(board,gid,t,idx,total){
    const resetField=(board==="cycle"||board==="version")?'<label class="gqV4EditorReset"><span>'+(board==="cycle"?"本期标识":"版本标识")+'</span><input class="gqV4ResetInput" value="'+esc(t.reset_key||"")+'" placeholder="如 2026-09-A / 4.2"></label>':"";
    return '<div class="gqV4EditorTask" data-gqv4-editor-task data-task-id="'+esc(t.id||"")+'"><label class="gqV4EditorTitle"><span>任务名</span><input class="gqV4TitleInput" value="'+esc(t.title||"")+'" placeholder="任务名称"></label><label class="gqV4EditorUrl"><span>链接（选填）</span><input class="gqV4UrlInput" value="'+esc(t.url||"")+'" placeholder="https://..."></label>'+resetField+'<label class="gqV4EditorNote"><span>备注（选填）</span><textarea class="gqV4NoteInput" rows="2">'+esc(t.note||"")+'</textarea></label><div class="gqV4EditorOps"><button type="button" data-gqv4-move="up" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'" '+(idx<=0?"disabled":"")+'>↑</button><button type="button" data-gqv4-move="down" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'" '+(idx>=total-1?"disabled":"")+'>↓</button><button type="button" class="danger" data-gqv4-delete="1" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'">删除</button></div></div>';
  }
  function editorGameCard(board,g,cfg){
    const tasks=boardTasks(board,g.id,cfg);
    const rows=tasks.length?tasks.map(function(t,i){return editorTaskRow(board,g.id,t,i,tasks.length)}).join(""):'<div class="gqDailyEmpty">暂无任务。该游戏仍保留在本板块中。</div>';
    return '<section class="gqV4EditorGame accent-'+esc(g.accent)+'" data-gqv4-editor-game="'+esc(g.id)+'"><header><span class="gqV4Priority">0'+priorityOf(g,0)+'</span><span class="gameQuestIcon">'+esc(g.icon)+'</span><div><b>'+esc(g.name)+'</b><em>'+tasks.length+' 项</em></div><button type="button" data-gqv4-add="1" data-board="'+board+'" data-game="'+esc(g.id)+'">＋ 任务</button></header><div class="gqV4EditorRows">'+rows+'</div></section>';
  }
  renderGameQuestEditor=function(){
    const list=document.getElementById("gameQuestEditorList"),tabs=document.getElementById("gameQuestEditorDays");if(!list)return;
    const cfg=normalizeGameQuestConfig(gameQuestDraftConfig||gameQuestConfig||defaultGameQuestConfig);
    gameQuestDraftConfig=deepClone(cfg);
    if(tabs)tabs.innerHTML="";
    const order='<div class="gqV4PriorityRule"><span>PRIORITY</span><b>固定游戏顺序</b><em>01 绝区零 → 02 异环 → 03 鸣潮 → 04 崩铁 → 05 阴阳师 → 06 终末地</em></div>';
    const sections=BOARD_ORDER.map(function(board,bi){
      const meta=BOARD_META[board];
      return '<details class="gameQuestEditGroup gqV4EditorBoard" data-gqv4-editor-board="'+board+'" '+(bi===0?"open":"")+'><summary class="gameQuestEditHead"><div><b>'+meta.label+'</b><span>'+meta.sub+'</span></div><em>'+meta.short+'</em></summary><div class="gqV4EditorGames">'+sortedGames(cfg).map(function(g){return editorGameCard(board,g,cfg)}).join("")+'</div></details>';
    }).join("");
    list.innerHTML=order+sections;
    if(typeof syncEditorSectionToggle==="function")syncEditorSectionToggle("game");
    gameQuestEditorLog("GameQuest v4：日常 / 周常 / 周期 / 版本四板块。任务不区分必做和选做；六游戏固定按优先度排序。");
  };

  collectGameQuestEditorState=function(){
    if(!gameQuestDraftConfig)gameQuestDraftConfig=normalizeGameQuestConfig(gameQuestConfig||defaultGameQuestConfig);
    const cfg=normalizeGameQuestConfig(gameQuestDraftConfig),boards=emptyBoards(cfg.games);
    document.querySelectorAll("[data-gqv4-editor-board]").forEach(function(section){
      const board=section.dataset.gqv4EditorBoard;
      section.querySelectorAll("[data-gqv4-editor-game]").forEach(function(card){
        const gid=card.dataset.gqv4EditorGame;
        const raw=[].slice.call(card.querySelectorAll("[data-gqv4-editor-task]")).map(function(row,i){
          const task={
            id:row.dataset.taskId||"",
            title:(row.querySelector(".gqV4TitleInput")&&row.querySelector(".gqV4TitleInput").value||"").trim(),
            url:(row.querySelector(".gqV4UrlInput")&&row.querySelector(".gqV4UrlInput").value||"").trim(),
            note:(row.querySelector(".gqV4NoteInput")&&row.querySelector(".gqV4NoteInput").value||"").trim()
          };
          const reset=row.querySelector(".gqV4ResetInput");
          if(reset&&reset.value.trim())task.reset_key=reset.value.trim();
          return task;
        });
        boards[board][gid]=normList(raw,board);
      });
    });
    gameQuestDraftConfig={version:VERSION,updatedAt:new Date().toISOString(),priorityOrder:PRIORITY_ORDER.slice(),games:cfg.games,boards:boards};
  };

  gameQuestEditorImportConfig=function(value){
    const imported=record(value)&&Object.prototype.hasOwnProperty.call(value,"gameQuest")?value.gameQuest:value;
    if(!record(imported)||!Array.isArray(imported.games))throw new Error("游戏 JSON 必须包含 games 数组");
    if(!record(imported.boards)&&!record(imported.schedule)&&!record(imported.weekly)&&!record(imported.interest))throw new Error("游戏 JSON 缺少 boards，且也不是可迁移的旧版结构");
    return normalizeGameQuestConfig(imported);
  };

  function editorMutate(board,gid,fn){
    collectGameQuestEditorState();
    const list=gameQuestDraftConfig.boards[board][gid]||[];
    fn(list);
    gameQuestDraftConfig.boards[board][gid]=list;
    renderGameQuestEditor();
  }
  function newTask(board){
    const task={id:"",title:"",url:""};
    if(board==="cycle"||board==="version")task.reset_key="";
    return task;
  }

  document.addEventListener("click",function(e){
    const tab=e.target.closest&&e.target.closest("[data-gqv4-board]");
    if(tab){e.preventDefault();e.stopImmediatePropagation();setCurrentBoard(tab.dataset.gqv4Board);return}
    const taskBtn=e.target.closest&&e.target.closest("[data-gqv4-task]");
    if(taskBtn){
      e.preventDefault();e.stopImmediatePropagation();
      const board=taskBtn.dataset.board,gid=taskBtn.dataset.game,id=taskBtn.dataset.task;
      const task=boardTasks(board,gid).find(function(t){return t.id===id});
      if(task)setTaskDone(board,gid,task,taskBtn.getAttribute("aria-pressed")!=="true",taskBtn);
      return;
    }
    const card=e.target.closest&&e.target.closest("[data-gqv4-card]");
    if(card){e.preventDefault();e.stopImmediatePropagation();setCard(card.dataset.board,card.dataset.game,card.getAttribute("aria-pressed")!=="true",card);return}
    const add=e.target.closest&&e.target.closest("[data-gqv4-add]");
    if(add){
      e.preventDefault();e.stopImmediatePropagation();
      editorMutate(add.dataset.board,add.dataset.game,function(list){list.push(newTask(add.dataset.board))});
      const section=document.querySelector('[data-gqv4-editor-board="'+safeCssEscape(add.dataset.board)+'"]');
      if(section)section.open=true;
      return;
    }
    const del=e.target.closest&&e.target.closest("[data-gqv4-delete]");
    if(del){e.preventDefault();e.stopImmediatePropagation();editorMutate(del.dataset.board,del.dataset.game,function(list){list.splice(Number(del.dataset.index),1)});return}
    const move=e.target.closest&&e.target.closest("[data-gqv4-move]");
    if(move){
      e.preventDefault();e.stopImmediatePropagation();
      const offset=move.dataset.gqv4Move==="up"?-1:1;
      editorMutate(move.dataset.board,move.dataset.game,function(list){
        const i=Number(move.dataset.index),n=i+offset;
        if(i>=0&&n>=0&&n<list.length){const tmp=list[i];list[i]=list[n];list[n]=tmp}
      });
      return;
    }
  },true);

  try{
    const current=typeof loadLocalTaskConfig==="function"?(loadLocalTaskConfig()||taskConfig):taskConfig;
    if(current){
      const upgraded=normalizeTaskConfig(Object.assign({},current,{gameQuest:normalizeGameQuestConfig(current.gameQuest||gameQuestConfig||defaultGameQuestConfig)}));
      applyTaskConfig(upgraded,false);
    }else if(gameQuestConfig){
      gameQuestConfig=normalizeGameQuestConfig(gameQuestConfig);
    }
  }catch(err){console.warn("GameQuest v4 rehydrate skipped",err)}
  renderGameQuestPanel();
})();