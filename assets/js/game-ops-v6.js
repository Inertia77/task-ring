(function(){
  "use strict";

  const VERSION=6;
  const BOARD_ORDER=["daily","weekly","cycle","version"];
  const EDIT_BOARD_ORDER=["daily","weekly"];
  const VIEW_ORDER=["daily","weekly","hub"];
  const BOARD_META={
    daily:{label:"日常",short:"DAILY",sub:"每天或高频重复处理的基础事项。"},
    weekly:{label:"周常",short:"WEEKLY",sub:"按自然周重置或结算的固定事项。"},
    hub:{label:"限时・周期",short:"LIMITED / RECURRING",sub:"限时奖励与周期玩法统一在 TaskRing 查看和操作。"}
  };
  const PRIORITY_ORDER=["zzz","nte","wuwa","hsr","onmyoji","endfield"];
  const PRIORITY=new Map(PRIORITY_ORDER.map(function(id,i){return [id,i+1]}));
  const LEGACY_CYCLE_TITLES=new Set([
    "式舆防卫战·剧变节点","危局强袭战",
    "末日幻影","虚构叙事","混沌回忆","异相仲裁",
    "逆境深塔","冥歌海墟","终焉矩阵",
    "轨外之境","大亨计划激励金","战争回响（轮换周期）"
  ]);
  const LEGACY_VERSION_TITLES=new Set([
    "丽都城募","迷宫诡域赛季进度",
    "先约电台",
    "无名勋礼",
    "协议通行证",
    "影拓丰碑（内容更新时）","蚀像寻遗（内容更新时）"
  ]);
  const LEGACY_DAILY_TITLES=new Set(["环境监测站（每2日）"]);
  const BOARD_STORAGE_KEY="taskring_gamequest_board_v6";
  const LEGACY_BOARD_STORAGE_KEY="taskring_gamequest_board_v5";

  window.TaskRingGameOpsV6={version:VERSION,boards:EDIT_BOARD_ORDER.slice(),views:VIEW_ORDER.slice(),priorityOrder:PRIORITY_ORDER.slice()};

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
    const from=String(obj.active_from||obj.activeFrom||"").trim();
    const until=String(obj.active_until||obj.activeUntil||"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(from))out.active_from=from;
    if(/^\d{4}-\d{2}-\d{2}$/.test(until))out.active_until=until;
    if(board==="cycle"||board==="version"){
      out.dynamic=obj.dynamic!==false;
      if(record(obj.rotation)){
        const type=String(obj.rotation.type||"manifest").trim().toLowerCase()==="interval"?"interval":"manifest";
        out.rotation={type:type};
        if(type==="interval"){
          const anchor=String(obj.rotation.anchor_date||obj.rotation.anchorDate||"").trim();
          const days=Math.max(1,Math.min(365,Math.round(Number(obj.rotation.interval_days||obj.rotation.intervalDays||14)||14)));
          if(/^\d{4}-\d{2}-\d{2}$/.test(anchor))out.rotation.anchor_date=anchor;
          out.rotation.interval_days=days;
        }
      }else{
        out.rotation={type:"manifest"};
      }
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
    if(
      LEGACY_VERSION_TITLES.has(title)||
      /(?:版本|通行证|城募|赏令|勋礼|先约电台|赛季进度|版本启动|版本收尾|版本活动|限时活动|十周年|中秋活动|拾光永恒|月映千灯|贝果计划|噗卡计划)/.test(title)
    )return "version";
    if(
      LEGACY_CYCLE_TITLES.has(title)||
      /(?:剧变节点|危局强袭战|逆境深塔|冥歌海墟|终焉矩阵|末日幻影|虚构叙事|混沌回忆|异相仲裁|战争回响|轮换周期)/.test(title)
    )return "cycle";
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
    const boards=emptyBoards(games);
    if(record(src.boards)){
      EDIT_BOARD_ORDER.forEach(function(board){
        const source=record(src.boards[board])?src.boards[board]:{};
        games.forEach(function(g){boards[board][g.id]=normList(source[g.id]||[],board)});
      });
    }else{
      const migrated=migrateLegacy(src,games);
      EDIT_BOARD_ORDER.forEach(function(board){games.forEach(function(g){boards[board][g.id]=normList(migrated[board][g.id]||[],board)})});
    }
    games.forEach(function(g){boards.cycle[g.id]=[];boards.version[g.id]=[]});
    return {version:VERSION,updatedAt:String(src.updatedAt||""),priorityOrder:PRIORITY_ORDER.slice(),games:games,boards:boards};
  };

  window.TaskRingGameOpsV6.normalizeConfig=function(config){return normalizeGameQuestConfig(config)};
  window.TaskRingGameOpsV5=window.TaskRingGameOpsV6;
  window.TaskRingGameOpsV4=window.TaskRingGameOpsV6;

  gameQuestTaskStoreList=function(value,context){return normList(value,context==="weekly"?"weekly":"daily")};

  function sortedGames(cfg){
    return (cfg&&cfg.games||[]).filter(function(g){return g.enabled!==false}).slice().sort(function(a,b){
      return priorityOf(a,0)-priorityOf(b,0)||a.name.localeCompare(b.name,"zh-CN");
    });
  }
  enabledGameQuestGames=function(cfg){return sortedGames(cfg||gameQuestConfig)};

  function operationalDate(){
    try{return typeof ymd==="function"?ymd(operationalNow):new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}
  }
  function boardTasksAll(board,gid,cfg){
    const source=cfg||gameQuestConfig;
    if(!EDIT_BOARD_ORDER.includes(board))return [];
    return normList(source&&source.boards&&source.boards[board]&&source.boards[board][gid]||[],board);
  }
  function boardTasks(board,gid,cfg){return boardTasksAll(board,gid,cfg)}
  function resetScope(board){return board==="daily"?operationalDate():String(cycleYmd||"week")}
  function taskKey(board,gid,task){
    // Daily/weekly keep the v4 namespace so upgrading to v5 does not wipe today's/week's checks.
    const ns=(board==="daily"||board==="weekly")?"gqv4_":"gqv5_";
    return GH_PREFIX+ns+board+"_"+resetScope(board,task)+"_"+gid+"_"+task.id;
  }
  function taskDone(board,gid,task){return localStorage.getItem(taskKey(board,gid,task))==="1"}
  function setTaskDone(board,gid,task,val,el){
    syncSetItem(taskKey(board,gid,task),val);
    if(val&&el&&typeof playCompletionEffect==="function"){
      playCompletionEffect({level:"micro",category:"gamecreate",anchor:el,title:"游戏项目完成",eventId:"gqv5:"+board+":"+gid+":"+task.id+":"+resetScope(board,task)});
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
    const saved=localStorage.getItem(BOARD_STORAGE_KEY)||localStorage.getItem(LEGACY_BOARD_STORAGE_KEY);
    if(saved==="cycle"||saved==="version"||saved==="interest")return "hub";
    return VIEW_ORDER.includes(saved)?saved:"daily";
  }
  function setCurrentBoard(board){
    if(!VIEW_ORDER.includes(board))board="daily";
    localStorage.setItem(BOARD_STORAGE_KEY,board);
    renderGameQuestPanel();
  }
  setGameQuestBoardMode=function(mode){
    const map={today:"daily",week:"weekly",interest:"hub",cycle:"hub",version:"hub"};
    setCurrentBoard(VIEW_ORDER.includes(mode)?mode:(map[mode]||"daily"));
  };

  function esc(v){return escapeHtml(String(v==null?"":v))}
  function noteHtml(task){
    const note=String(task.note||"").trim();
    return note?'<details class="gameQuestTaskNote"><summary>备注</summary><div class="gameQuestTaskNoteBody">'+esc(note)+'</div></details>':"";
  }
  function taskRows(board,entry){
    if(!entry.tasks.length)return '<div class="gqV6EmptyTask">暂无任务</div>';
    return '<ul class="gameQuestTaskList gameQuestTaskListV2 gqV6TaskList">'+entry.tasks.map(function(t,idx){
      const done=taskDone(board,entry.game.id,t),url=safeUrl(t.url);
      const instance="";
      return '<li class="'+(done?"done":"")+'"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 gqV6TaskBtn '+(done?"done":"")+'" data-gqv5-task="1" data-board="'+esc(board)+'" data-game="'+esc(entry.game.id)+'" data-task="'+esc(t.id)+'" aria-pressed="'+(done?"true":"false")+'"><span class="gameQuestTaskNo">'+String(idx+1).padStart(2,"0")+'</span><span class="gameQuestMiniBox"></span><i>'+esc(t.title)+'</i>'+instance+'</button>'+(url?'<a class="gameQuestTaskOpen" href="'+url+'" target="_blank" rel="noopener noreferrer">打开 ↗</a>':"")+'</div>'+noteHtml(t)+'</li>';
    }).join("")+'</ul>';
  }
  function gameCard(board,entry){
    const g=entry.game,pct=entry.total?Math.round(entry.done/entry.total*100):0;
    const priority=priorityOf(g,0);
    return '<article class="gameQuestCard gameQuestCardV2 gqV6GameCard accent-'+esc(g.accent)+' '+(entry.cardDone?"done":"")+'" style="--gq-p:'+pct+'%"><div class="gameQuestCardTop"><button type="button" class="gameQuestCheck '+(entry.cardDone?"done":"")+'" data-gqv5-card="1" data-board="'+esc(board)+'" data-game="'+esc(g.id)+'" aria-pressed="'+(entry.cardDone?"true":"false")+'" '+(entry.total?"":"disabled")+'><span></span></button><span class="gqV6Priority">0'+priority+'</span><span class="gameQuestIcon">'+esc(String(g.icon||g.name).slice(0,4))+'</span><div class="gameQuestNameWrap"><span class="gameQuestName">'+esc(g.name)+'</span><span class="gameQuestShort">优先度 #'+priority+' · '+entry.total+' 项</span></div><span class="gameQuestCount">'+entry.done+'/'+entry.total+'</span></div><div class="gameQuestProgressRail"><span></span></div><div class="gameQuestCardBody">'+taskRows(board,entry)+'</div></article>';
  }
  function boardTabs(active){
    return '<nav class="gqV6BoardTabs" aria-label="游戏作战区板块">'+VIEW_ORDER.map(function(view){
      if(view==="hub")return '<button type="button" class="gqV6BoardTab gqV6HubTab '+(active==="hub"?"active":"")+'" data-gqv6-board="hub"><span>限时・周期</span><b>◷</b><em>LIMITED / RECURRING</em></button>';
      const s=boardStats(view);
      return '<button type="button" class="gqV6BoardTab '+(active===view?"active":"")+'" data-gqv6-board="'+view+'"><span>'+BOARD_META[view].label+'</span><b>'+s.done+'/'+s.total+'</b><em>'+BOARD_META[view].short+'</em></button>';
    }).join("")+'</nav>';
  }
  function cycleVersionHub(){
    return '<section id="gameOpsCloud" class="gameOpsCloud">'+(window.TaskRingGameOpsCloud?window.TaskRingGameOpsCloud.html():'正在加载任务…')+'</section>';
  }
  renderGameQuestPanel=function(){
    const panel=document.getElementById("gameQuestPanel");if(!panel)return;
    const board=currentBoard(),isHub=board==="hub",stats=isHub?{done:0,total:0,pct:0}:boardStats(board),meta=BOARD_META[board]||BOARD_META.daily,entries=isHub?[]:entriesFor(board);
    const active=readActiveTimer(),gqActive=active&&active.kind==="gamequest";
    const meter=isHub?'<div class="gameQuestTopMeter"><span class="gameCommandIcon">◷</span><span class="gameCommandCopy"><small>LIVE OPS</small><b>限时・周期</b><em>云端任务 · 本机缓存</em></span></div>':'<div class="gameQuestTopMeter"><span class="gameQuestMiniRing" style="--p:'+stats.pct+'%"><i>'+stats.pct+'%</i></span><span class="gameCommandCopy"><small>'+meta.short+'</small><b>'+stats.done+'/'+stats.total+'</b><em>'+meta.label+'完成度</em></span></div>';
    const top='<div class="gameQuestTopBar gqV6Top"><div class="gameQuestTopTitle"><span>GAME QUEST / DAILY OPS</span><strong>游戏作战区</strong><em>TaskRing 统一管理日常、周常与限时・周期任务；版本 / 前瞻 / 卡池排期由 Calendar 独立维护。</em></div><div class="gameQuestHeroSide">'+meter+'<button type="button" class="gameQuestTopTimer '+(gqActive?"active":"")+'" data-timer-start-gamequest="1" data-cycle="'+esc(cycleYmd)+'"><span class="gameCommandIcon">'+(gqActive?(active.paused?"Ⅱ":"◷"):"◷")+'</span><span class="gameCommandCopy"><small>TIMER</small><b '+(gqActive?'data-live-timer="1"':"")+'>'+(gqActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时")+'</b><em>'+(gqActive?(active.paused?"已暂停":"游戏计时中"):"整体计时")+'</em></span></button><button type="button" class="gameCommandBtn gameQuestTopManual" data-manual-time-entry="gamequest"><span class="gameCommandIcon">＋</span><span class="gameCommandCopy"><small>MANUAL</small><b>补记</b><em>游戏时间</em></span></button><button type="button" class="gameCommandBtn gameQuestEditQuick" data-open-game-editor><span class="gameCommandIcon">✎</span><span class="gameCommandCopy"><small>QUEST</small><b>编辑任务</b><em>日常 / 周常</em></span></button></div></div>';
    const dailyAllDone=board==="daily"&&stats.total>0&&stats.done>=stats.total;
    const boardAction=board==="daily"?'<div class="gqV6BoardActions"><strong>'+stats.done+'/'+stats.total+'</strong><button type="button" class="gqV6CompleteAll '+(dailyAllDone?"done":"")+'" data-gqv6-complete-daily="1" '+((stats.total===0||dailyAllDone)?"disabled":"")+'><span aria-hidden="true">✓</span><b>'+(dailyAllDone?"已全部完成":"一键完成全部")+'</b></button></div>':'<strong>'+stats.done+'/'+stats.total+'</strong>';
    const body=isHub?'<div class="gqV6BoardIntro hub"><div><span>LIVE OPS</span><b>限时・周期</b><em>当前任务与领取窗口</em></div><strong>JST</strong></div>'+cycleVersionHub():'<div class="gqV6BoardIntro '+board+'"><div><span>'+meta.short+'</span><b>'+meta.label+'</b><em>'+meta.sub+'</em></div>'+boardAction+'</div><div class="gameQuestGrid gqV6Grid">'+entries.map(function(e){return gameCard(board,e)}).join("")+'</div>';
    panel.innerHTML='<div class="gameQuestShell gameQuestV6">'+top+boardTabs(board)+body+'</div>';
  };

  function setCard(board,gid,val,el){
    const game=sortedGames(gameQuestConfig).find(function(g){return g.id===gid});if(!game)return;
    const entry=entryFor(board,game);
    entry.tasks.forEach(function(t){syncSetItem(taskKey(board,gid,t),val)});
    if(val&&el&&entry.tasks.length&&typeof playCompletionEffect==="function"){
      playCompletionEffect({level:"parent",category:"gamecreate",anchor:el,title:game.name+" · "+BOARD_META[board].label+"完成",eventId:"gqv5-card:"+board+":"+gid+":"+Date.now()});
    }
    renderAll();
  }

  function completeDailyBoard(el){
    let changed=0,total=0;
    entriesFor("daily").forEach(function(entry){
      entry.tasks.forEach(function(task){
        total++;
        if(taskDone("daily",entry.game.id,task))return;
        syncSetItem(taskKey("daily",entry.game.id,task),true);
        changed++;
      });
    });
    if(changed&&el&&typeof playCompletionEffect==="function"){
      playCompletionEffect({level:"parent",category:"gamecreate",anchor:el,title:"今日日常全部完成",eventId:"gqv6-daily-all:"+operationalDate()+":"+Date.now()});
    }
    renderAll();
    return {changed:changed,total:total};
  }

  function editorTaskRow(board,gid,t,idx,total){
    return '<div class="gqV6EditorTask" data-gqv6-editor-task data-task-id="'+esc(t.id||"")+'"><label class="gqV6EditorTitle"><span>任务名</span><input class="gqV6TitleInput" value="'+esc(t.title||"")+'" placeholder="任务名称"></label><label class="gqV6EditorUrl"><span>链接（选填）</span><input class="gqV6UrlInput" value="'+esc(t.url||"")+'" placeholder="https://..."></label><label class="gqV6EditorNote"><span>备注（选填）</span><textarea class="gqV6NoteInput" rows="2">'+esc(t.note||"")+'</textarea></label><div class="gqV6EditorOps"><button type="button" data-gqv6-move="up" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'" '+(idx<=0?"disabled":"")+'>↑</button><button type="button" data-gqv6-move="down" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'" '+(idx>=total-1?"disabled":"")+'>↓</button><button type="button" class="danger" data-gqv6-delete="1" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'">删除</button></div></div>';
  }
  function editorGameCard(board,g,cfg){
    const tasks=boardTasksAll(board,g.id,cfg);
    const rows=tasks.length?tasks.map(function(t,i){return editorTaskRow(board,g.id,t,i,tasks.length)}).join(""):'<div class="gqDailyEmpty">暂无任务。该游戏仍保留在本板块中。</div>';
    return '<section class="gqV6EditorGame accent-'+esc(g.accent)+'" data-gqv5-editor-game="'+esc(g.id)+'"><header><span class="gqV6Priority">0'+priorityOf(g,0)+'</span><span class="gameQuestIcon">'+esc(g.icon)+'</span><div><b>'+esc(g.name)+'</b><em>'+tasks.length+' 项</em></div><button type="button" data-gqv5-add="1" data-board="'+board+'" data-game="'+esc(g.id)+'">＋ 任务</button></header><div class="gqV6EditorRows">'+rows+'</div></section>';
  }
  renderGameQuestEditor=function(){
    const list=document.getElementById("gameQuestEditorList"),tabs=document.getElementById("gameQuestEditorDays");if(!list)return;
    const cfg=normalizeGameQuestConfig(gameQuestDraftConfig||gameQuestConfig||defaultGameQuestConfig);
    gameQuestDraftConfig=deepClone(cfg);
    if(tabs)tabs.innerHTML="";
    const order='<div class="gqV6PriorityRule"><span>PRIORITY</span><b>固定游戏顺序</b><em>01 绝区零 → 02 异环 → 03 鸣潮 → 04 崩铁 → 05 阴阳师 → 06 终末地</em></div>';
    const cloudHint='<div class="gqV6PriorityRule"><span>LIVE OPS</span><em>此处编辑日常与周常；限时・周期请在对应板块点击「补任务」。</em></div>';
    const sections=EDIT_BOARD_ORDER.map(function(board,bi){
      const meta=BOARD_META[board];
      return '<details class="gameQuestEditGroup gqV6EditorBoard" data-gqv5-editor-board="'+board+'" '+(bi===0?"open":"")+'><summary class="gameQuestEditHead"><div><b>'+meta.label+'</b><span>'+meta.sub+'</span></div><em>'+meta.short+'</em></summary><div class="gqV6EditorGames">'+sortedGames(cfg).map(function(g){return editorGameCard(board,g,cfg)}).join("")+'</div></details>';
    }).join("");
    list.innerHTML=order+cloudHint+sections;
    if(typeof syncEditorSectionToggle==="function")syncEditorSectionToggle("game");
    gameQuestEditorLog("游戏编辑器：日常 / 周常；限时・周期在对应板块管理。");
  };

  collectGameQuestEditorState=function(){
    if(!gameQuestDraftConfig)gameQuestDraftConfig=normalizeGameQuestConfig(gameQuestConfig||defaultGameQuestConfig);
    const cfg=normalizeGameQuestConfig(gameQuestDraftConfig),boards=emptyBoards(cfg.games);
    document.querySelectorAll("[data-gqv5-editor-board]").forEach(function(section){
      const board=section.dataset.gqv5EditorBoard;
      section.querySelectorAll("[data-gqv5-editor-game]").forEach(function(card){
        const gid=card.dataset.gqv5EditorGame;
        const raw=[].slice.call(card.querySelectorAll("[data-gqv6-editor-task]")).map(function(row,i){
          const task={
            id:row.dataset.taskId||"",
            title:(row.querySelector(".gqV6TitleInput")&&row.querySelector(".gqV6TitleInput").value||"").trim(),
            url:(row.querySelector(".gqV6UrlInput")&&row.querySelector(".gqV6UrlInput").value||"").trim(),
            note:(row.querySelector(".gqV6NoteInput")&&row.querySelector(".gqV6NoteInput").value||"").trim()
          };
          return task;
        });
        boards[board][gid]=normList(raw,board);
      });
    });
    cfg.games.forEach(function(g){boards.cycle[g.id]=[];boards.version[g.id]=[]});
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
  function newTask(){return {id:"",title:"",url:""}}

  document.addEventListener("click",function(e){
    const refresh=e.target.closest&&e.target.closest("[data-gqv5-refresh]");
    if(refresh){e.preventDefault();e.stopImmediatePropagation();Promise.resolve(null);return}
    const tab=e.target.closest&&e.target.closest("[data-gqv6-board],[data-gqv5-board]");
    if(tab){
      e.preventDefault();e.stopImmediatePropagation();
      setCurrentBoard(tab.dataset.gqv6Board||tab.dataset.gqv5Board);
      return;
    }
    const completeAll=e.target.closest&&e.target.closest("[data-gqv6-complete-daily]");
    if(completeAll){
      e.preventDefault();e.stopImmediatePropagation();
      completeDailyBoard(completeAll);
      return;
    }
    const taskBtn=e.target.closest&&e.target.closest("[data-gqv5-task]");
    if(taskBtn){
      e.preventDefault();e.stopImmediatePropagation();
      const board=taskBtn.dataset.board,gid=taskBtn.dataset.game,id=taskBtn.dataset.task;
      const task=boardTasks(board,gid).find(function(t){return t.id===id});
      if(task)setTaskDone(board,gid,task,taskBtn.getAttribute("aria-pressed")!=="true",taskBtn);
      return;
    }
    const card=e.target.closest&&e.target.closest("[data-gqv5-card]");
    if(card){e.preventDefault();e.stopImmediatePropagation();setCard(card.dataset.board,card.dataset.game,card.getAttribute("aria-pressed")!=="true",card);return}
    const add=e.target.closest&&e.target.closest("[data-gqv5-add]");
    if(add){
      e.preventDefault();e.stopImmediatePropagation();
      editorMutate(add.dataset.board,add.dataset.game,function(list){list.push(newTask(add.dataset.board))});
      const section=document.querySelector('[data-gqv5-editor-board="'+safeCssEscape(add.dataset.board)+'"]');
      if(section)section.open=true;
      return;
    }
    const del=e.target.closest&&e.target.closest("[data-gqv6-delete]");
    if(del){e.preventDefault();e.stopImmediatePropagation();editorMutate(del.dataset.board,del.dataset.game,function(list){list.splice(Number(del.dataset.index),1)});return}
    const move=e.target.closest&&e.target.closest("[data-gqv6-move]");
    if(move){
      e.preventDefault();e.stopImmediatePropagation();
      const offset=move.dataset.gqv6Move==="up"?-1:1;
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
  }catch(err){console.warn("GameQuest v6 rehydrate skipped",err)}
  renderGameQuestPanel();
})();