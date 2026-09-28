(function(){
  "use strict";

  const VERSION=5;
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
  const BOARD_STORAGE_KEY="taskring_gamequest_board_v5";
  const MANIFEST_CACHE_KEY="taskring_game_ops_manifest_v1";
  const MANIFEST_FETCH_KEY="taskring_game_ops_manifest_fetch_v1";
  const DEFAULT_MANIFEST_URL="assets/data/game-ops-manifest.json";
  let gameOpsManifest=readManifestCache();
  let manifestState={status:gameOpsManifest?"cached":"empty",updatedAt:String(gameOpsManifest?.updatedAt||""),error:""};

  window.TaskRingGameOpsV5={version:VERSION,boards:BOARD_ORDER.slice(),priorityOrder:PRIORITY_ORDER.slice()};

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
    const manifestSrc=record(src.manifest)?src.manifest:{};
    const manifest={
      url:String(manifestSrc.url||DEFAULT_MANIFEST_URL).trim()||DEFAULT_MANIFEST_URL,
      refresh_minutes:Math.max(15,Math.min(1440,Math.round(Number(manifestSrc.refresh_minutes||manifestSrc.refreshMinutes||60)||60)))
    };
    return {
      version:VERSION,
      updatedAt:String(src.updatedAt||""),
      priorityOrder:PRIORITY_ORDER.slice(),
      manifest:manifest,
      games:games,
      boards:boards
    };
  };

  window.TaskRingGameOpsV5.normalizeConfig=function(config){return normalizeGameQuestConfig(config)};
  // Compatibility alias for the core importer while older cached shells are retiring.
  window.TaskRingGameOpsV4=window.TaskRingGameOpsV5;

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

  function readManifestCache(){
    try{
      const raw=localStorage.getItem(MANIFEST_CACHE_KEY);
      const parsed=raw?JSON.parse(raw):null;
      return record(parsed)&&record(parsed.games)?parsed:null;
    }catch(_){return null}
  }
  function manifestConfig(cfg=gameQuestConfig){
    const raw=record(cfg?.manifest)?cfg.manifest:{};
    return {
      url:String(raw.url||DEFAULT_MANIFEST_URL).trim()||DEFAULT_MANIFEST_URL,
      refreshMinutes:Math.max(15,Math.min(1440,Math.round(Number(raw.refresh_minutes||raw.refreshMinutes||60)||60)))
    };
  }
  function manifestValid(value){return record(value)&&Number(value.schemaVersion)>=1&&record(value.games)}
  async function loadGameOpsManifest(force=false){
    const cfg=manifestConfig();
    const last=Number(localStorage.getItem(MANIFEST_FETCH_KEY)||0);
    if(!force&&gameOpsManifest&&Date.now()-last<cfg.refreshMinutes*60000)return gameOpsManifest;
    manifestState={status:"loading",updatedAt:String(gameOpsManifest?.updatedAt||""),error:""};
    try{
      const join=cfg.url.includes("?")?"&":"?";
      const response=await fetch(cfg.url+join+"ts="+Date.now(),{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const next=await response.json();
      if(!manifestValid(next))throw new Error("manifest schema invalid");
      gameOpsManifest=next;
      localStorage.setItem(MANIFEST_CACHE_KEY,JSON.stringify(next));
      localStorage.setItem(MANIFEST_FETCH_KEY,String(Date.now()));
      manifestState={status:"fresh",updatedAt:String(next.updatedAt||""),error:""};
      renderGameQuestPanel();
      return next;
    }catch(error){
      manifestState={status:gameOpsManifest?"cached":"error",updatedAt:String(gameOpsManifest?.updatedAt||""),error:String(error?.message||error)};
      console.warn("GameQuest manifest refresh failed",error);
      renderGameQuestPanel();
      return gameOpsManifest;
    }
  }
  window.TaskRingGameOpsV5.refreshManifest=function(){return loadGameOpsManifest(true)};

  function operationalDate(){
    try{return typeof ymd==="function"?ymd(operationalNow):new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}
  }
  function taskIsActive(task,date=operationalDate()){
    if(task?.active===false)return false;
    if(task?.active_from&&date<task.active_from)return false;
    if(task?.active_until&&date>task.active_until)return false;
    return true;
  }
  function boardTasksAll(board,gid,cfg){
    const source=cfg||gameQuestConfig;
    return normList(source&&source.boards&&source.boards[board]&&source.boards[board][gid]||[],board);
  }
  function manifestGame(gid){return record(gameOpsManifest?.games?.[gid])?gameOpsManifest.games[gid]:{}}
  function manifestInstance(board,gid,task){
    const game=manifestGame(gid);
    const instances=record(game.instances?.[board])?game.instances[board]:{};
    return record(instances[task.id])?instances[task.id]:null;
  }
  function dateMs(value){
    const ms=Date.parse(String(value||"")+"T00:00:00Z");
    return Number.isFinite(ms)?ms:NaN;
  }
  function ymdUtc(ms){return new Date(ms).toISOString().slice(0,10)}
  function intervalFallback(task,date=operationalDate()){
    const r=record(task.rotation)?task.rotation:{};
    if(String(r.type||"")!=="interval")return null;
    const anchor=dateMs(r.anchor_date),now=dateMs(date),days=Math.max(1,Math.round(Number(r.interval_days)||14));
    if(!Number.isFinite(anchor)||!Number.isFinite(now)||now<anchor)return {active:false};
    const span=days*86400000;
    const start=anchor+Math.floor((now-anchor)/span)*span;
    const end=start+(days-1)*86400000;
    return {instanceKey:ymdUtc(start),suffix:ymdUtc(start)+"～"+ymdUtc(end),active:true,activeFrom:ymdUtc(start),activeUntil:ymdUtc(end)};
  }
  function resolveTask(board,gid,task){
    if(board!=="cycle"&&board!=="version")return taskIsActive(task)?task:null;
    const base={...task};
    const manifest=task.dynamic===false?null:manifestInstance(board,gid,task);
    const interval=board==="cycle"?intervalFallback(task):null;
    let instance=manifest;
    // Fixed-interval rules own the reset key/date window even if the manifest is late.
    // Manifest data may still supply the human-readable route name and notes.
    if(interval&&interval.active!==false){
      instance={...interval,...(manifest||{}),instanceKey:interval.instanceKey,activeFrom:interval.activeFrom,activeUntil:interval.activeUntil};
    }else if(interval&&interval.active===false&&!manifest){
      instance=interval;
    }
    if(!instance&&board==="version"){
      const vi=manifestGame(gid).versionInfo;
      if(record(vi))instance={instanceKey:String(vi.id||vi.label||"current"),suffix:String(vi.label||vi.id||""),active:vi.active!==false,activeFrom:vi.activeFrom,activeUntil:vi.activeUntil};
    }
    if(instance){
      if(instance.active===false)return null;
      if(instance.title)base.title=String(instance.title);
      else if(instance.suffix)base.title=base.title+"｜"+String(instance.suffix);
      if(instance.note)base.note=String(instance.note);
      if(instance.sourceUrl&&!base.url)base.url=String(instance.sourceUrl);
      base.active=instance.active!==false;
      base.active_from=String(instance.activeFrom||instance.active_from||base.active_from||"");
      base.active_until=String(instance.activeUntil||instance.active_until||base.active_until||"");
      base._instanceKey=String(instance.instanceKey||instance.key||base.reset_key||"current");
      base._instanceLabel=String(instance.suffix||instance.label||instance.instanceKey||"");
      base._dynamicSource="manifest";
    }else{
      base._instanceKey=String(base.reset_key||"current");
      base._instanceLabel="";
      base._dynamicSource=task.dynamic===false?"static":"fallback";
    }
    return taskIsActive(base)?base:null;
  }
  function boardTasks(board,gid,cfg){
    return boardTasksAll(board,gid,cfg).map(function(task){return resolveTask(board,gid,task)}).filter(Boolean);
  }
  function resetScope(board,task){
    if(board==="daily")return typeof ymd==="function"?ymd(operationalNow):new Date().toISOString().slice(0,10);
    if(board==="weekly")return String(cycleYmd||"week");
    return String(task&&task._instanceKey||task&&task.reset_key||"current");
  }
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
    if(!entry.tasks.length)return '<div class="gqV5EmptyTask">暂无任务</div>';
    return '<ul class="gameQuestTaskList gameQuestTaskListV2 gqV5TaskList">'+entry.tasks.map(function(t,idx){
      const done=taskDone(board,entry.game.id,t),url=safeUrl(t.url);
      const instance=(board==="cycle"||board==="version")&&t._instanceLabel?'<span class="gqV5ResetTag" title="当前自动实例">'+esc(t._instanceLabel)+'</span>':"";
      return '<li class="'+(done?"done":"")+'"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 gqV5TaskBtn '+(done?"done":"")+'" data-gqv5-task="1" data-board="'+esc(board)+'" data-game="'+esc(entry.game.id)+'" data-task="'+esc(t.id)+'" aria-pressed="'+(done?"true":"false")+'"><span class="gameQuestTaskNo">'+String(idx+1).padStart(2,"0")+'</span><span class="gameQuestMiniBox"></span><i>'+esc(t.title)+'</i>'+instance+'</button>'+(url?'<a class="gameQuestTaskOpen" href="'+url+'" target="_blank" rel="noopener noreferrer">打开 ↗</a>':"")+'</div>'+noteHtml(t)+'</li>';
    }).join("")+'</ul>';
  }
  function gameCard(board,entry){
    const g=entry.game,pct=entry.total?Math.round(entry.done/entry.total*100):0;
    const priority=priorityOf(g,0);
    return '<article class="gameQuestCard gameQuestCardV2 gqV5GameCard accent-'+esc(g.accent)+' '+(entry.cardDone?"done":"")+'" style="--gq-p:'+pct+'%"><div class="gameQuestCardTop"><button type="button" class="gameQuestCheck '+(entry.cardDone?"done":"")+'" data-gqv5-card="1" data-board="'+esc(board)+'" data-game="'+esc(g.id)+'" aria-pressed="'+(entry.cardDone?"true":"false")+'" '+(entry.total?"":"disabled")+'><span></span></button><span class="gqV5Priority">0'+priority+'</span><span class="gameQuestIcon">'+esc(String(g.icon||g.name).slice(0,4))+'</span><div class="gameQuestNameWrap"><span class="gameQuestName">'+esc(g.name)+'</span><span class="gameQuestShort">优先度 #'+priority+' · '+entry.total+' 项</span></div><span class="gameQuestCount">'+entry.done+'/'+entry.total+'</span></div><div class="gameQuestProgressRail"><span></span></div><div class="gameQuestCardBody">'+taskRows(board,entry)+'</div></article>';
  }
  function boardTabs(active){
    return '<nav class="gqV5BoardTabs" aria-label="游戏作战区板块">'+BOARD_ORDER.map(function(board){
      const s=boardStats(board);
      return '<button type="button" class="gqV5BoardTab '+(active===board?"active":"")+'" data-gqv5-board="'+board+'"><span>'+BOARD_META[board].label+'</span><b>'+s.done+'/'+s.total+'</b><em>'+BOARD_META[board].short+'</em></button>';
    }).join("")+'</nav>';
  }
  function manifestStatusHtml(){
    const label=manifestState.status==="fresh"?"已同步":manifestState.status==="cached"?"缓存":"待同步";
    const cls=manifestState.status==="fresh"?"fresh":manifestState.status==="error"?"error":"cached";
    const when=manifestState.updatedAt?String(manifestState.updatedAt).replace("T"," ").slice(0,16):"尚无情报";
    return '<div class="gqV5ManifestState '+cls+'"><span>AUTO DATA</span><b>'+esc(label)+'</b><em>'+esc(when)+'</em><button type="button" data-gqv5-refresh title="立即刷新动态游戏情报">↻</button></div>';
  }
  renderGameQuestPanel=function(){
    const panel=document.getElementById("gameQuestPanel");if(!panel)return;
    const board=currentBoard(),meta=BOARD_META[board],stats=boardStats(board),entries=entriesFor(board);
    const active=readActiveTimer(),gqActive=active&&active.kind==="gamequest";
    const top='<div class="gameQuestTopBar gqV5Top"><div class="gameQuestTopTitle"><span>GAME QUEST / AUTO OPS</span><strong>游戏作战区</strong><em>日常 · 周常 · 周期 · 版本｜周期与版本实例自动更新；你只维护长期模板。</em></div><div class="gameQuestHeroSide"><div class="gameQuestTopMeter"><span class="gameQuestMiniRing" style="--p:'+stats.pct+'%"><i>'+stats.pct+'%</i></span><span class="gameCommandCopy"><small>'+meta.short+'</small><b>'+stats.done+'/'+stats.total+'</b><em>'+meta.label+'完成度</em></span></div><button type="button" class="gameQuestTopTimer '+(gqActive?"active":"")+'" data-timer-start-gamequest="1" data-cycle="'+esc(cycleYmd)+'"><span class="gameCommandIcon">'+(gqActive?(active.paused?"Ⅱ":"◷"):"◷")+'</span><span class="gameCommandCopy"><small>TIMER</small><b '+(gqActive?'data-live-timer="1"':"")+'>'+(gqActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时")+'</b><em>'+(gqActive?(active.paused?"已暂停":"游戏计时中"):"整体计时")+'</em></span></button><button type="button" class="gameCommandBtn gameQuestTopManual" data-manual-time-entry="gamequest"><span class="gameCommandIcon">＋</span><span class="gameCommandCopy"><small>MANUAL</small><b>补记</b><em>游戏时间</em></span></button><button type="button" class="gameCommandBtn gameQuestEditQuick" data-open-game-editor><span class="gameCommandIcon">✎</span><span class="gameCommandCopy"><small>QUEST</small><b>编辑任务</b><em>四板块</em></span></button></div></div>';
    const info='<div class="gqV5BoardIntro '+board+'"><div><span>'+meta.short+'</span><b>'+meta.label+'</b><em>'+meta.sub+'</em></div><div class="gqV5BoardSide">'+manifestStatusHtml()+'<strong>'+stats.done+'/'+stats.total+'</strong></div></div>';
    const cards='<div class="gameQuestGrid gqV5Grid">'+entries.map(function(e){return gameCard(board,e)}).join("")+'</div>';
    panel.innerHTML='<div class="gameQuestShell gameQuestV5">'+top+boardTabs(board)+info+cards+'</div>';
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

  function editorTaskRow(board,gid,t,idx,total){
    let dynamicField="";
    if(board==="cycle"){
      const rotation=record(t.rotation)?t.rotation:{type:"manifest"};
      const type=String(rotation.type||"manifest")==="interval"?"interval":"manifest";
      dynamicField='<div class="gqV5DynamicRule"><label><span>自动刷新方式</span><select class="gqV5RotationType"><option value="manifest" '+(type==="manifest"?"selected":"")+'>官方情报自动更新</option><option value="interval" '+(type==="interval"?"selected":"")+'>固定间隔自动计算</option></select></label><label><span>锚点（固定间隔时）</span><input type="date" class="gqV5AnchorDate" value="'+esc(rotation.anchor_date||"")+'"></label><label><span>间隔天数</span><input type="number" min="1" max="365" class="gqV5IntervalDays" value="'+esc(rotation.interval_days||14)+'"></label></div>';
    }else if(board==="version"){
      dynamicField='<div class="gqV5DynamicRule readonly"><span>AUTO VERSION</span><b>版本 / 活动实例由动态情报自动更新</b><em>无需手填版本号、开始日或截止日</em></div>';
    }
    return '<div class="gqV5EditorTask" data-gqv5-editor-task data-task-id="'+esc(t.id||"")+'"><label class="gqV5EditorTitle"><span>长期任务模板</span><input class="gqV5TitleInput" value="'+esc(t.title||"")+'" placeholder="任务名称"></label><label class="gqV5EditorUrl"><span>链接（选填）</span><input class="gqV5UrlInput" value="'+esc(t.url||"")+'" placeholder="https://..."></label>'+dynamicField+'<label class="gqV5EditorNote"><span>长期备注（选填）</span><textarea class="gqV5NoteInput" rows="2">'+esc(t.note||"")+'</textarea></label><div class="gqV5EditorOps"><button type="button" data-gqv5-move="up" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'" '+(idx<=0?"disabled":"")+'>↑</button><button type="button" data-gqv5-move="down" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'" '+(idx>=total-1?"disabled":"")+'>↓</button><button type="button" class="danger" data-gqv5-delete="1" data-board="'+board+'" data-game="'+esc(gid)+'" data-index="'+idx+'">删除</button></div></div>';
  }
  function editorGameCard(board,g,cfg){
    const tasks=boardTasksAll(board,g.id,cfg);
    const rows=tasks.length?tasks.map(function(t,i){return editorTaskRow(board,g.id,t,i,tasks.length)}).join(""):'<div class="gqDailyEmpty">暂无任务。该游戏仍保留在本板块中。</div>';
    return '<section class="gqV5EditorGame accent-'+esc(g.accent)+'" data-gqv5-editor-game="'+esc(g.id)+'"><header><span class="gqV5Priority">0'+priorityOf(g,0)+'</span><span class="gameQuestIcon">'+esc(g.icon)+'</span><div><b>'+esc(g.name)+'</b><em>'+tasks.length+' 项</em></div><button type="button" data-gqv5-add="1" data-board="'+board+'" data-game="'+esc(g.id)+'">＋ 任务</button></header><div class="gqV5EditorRows">'+rows+'</div></section>';
  }
  renderGameQuestEditor=function(){
    const list=document.getElementById("gameQuestEditorList"),tabs=document.getElementById("gameQuestEditorDays");if(!list)return;
    const cfg=normalizeGameQuestConfig(gameQuestDraftConfig||gameQuestConfig||defaultGameQuestConfig);
    gameQuestDraftConfig=deepClone(cfg);
    if(tabs)tabs.innerHTML="";
    const order='<div class="gqV5PriorityRule"><span>PRIORITY</span><b>固定游戏顺序</b><em>01 绝区零 → 02 异环 → 03 鸣潮 → 04 崩铁 → 05 阴阳师 → 06 终末地</em></div>';
    const sections=BOARD_ORDER.map(function(board,bi){
      const meta=BOARD_META[board];
      return '<details class="gameQuestEditGroup gqV5EditorBoard" data-gqv5-editor-board="'+board+'" '+(bi===0?"open":"")+'><summary class="gameQuestEditHead"><div><b>'+meta.label+'</b><span>'+meta.sub+'</span></div><em>'+meta.short+'</em></summary><div class="gqV5EditorGames">'+sortedGames(cfg).map(function(g){return editorGameCard(board,g,cfg)}).join("")+'</div></details>';
    }).join("");
    list.innerHTML=order+sections;
    if(typeof syncEditorSectionToggle==="function")syncEditorSectionToggle("game");
    gameQuestEditorLog("GameQuest v5：日常 / 周常保存长期模板；周期 / 版本自动解析当前实例。六游戏固定按优先度排序。");
  };

  collectGameQuestEditorState=function(){
    if(!gameQuestDraftConfig)gameQuestDraftConfig=normalizeGameQuestConfig(gameQuestConfig||defaultGameQuestConfig);
    const cfg=normalizeGameQuestConfig(gameQuestDraftConfig),boards=emptyBoards(cfg.games);
    document.querySelectorAll("[data-gqv5-editor-board]").forEach(function(section){
      const board=section.dataset.gqv5EditorBoard;
      section.querySelectorAll("[data-gqv5-editor-game]").forEach(function(card){
        const gid=card.dataset.gqv5EditorGame;
        const raw=[].slice.call(card.querySelectorAll("[data-gqv5-editor-task]")).map(function(row,i){
          const task={
            id:row.dataset.taskId||"",
            title:(row.querySelector(".gqV5TitleInput")&&row.querySelector(".gqV5TitleInput").value||"").trim(),
            url:(row.querySelector(".gqV5UrlInput")&&row.querySelector(".gqV5UrlInput").value||"").trim(),
            note:(row.querySelector(".gqV5NoteInput")&&row.querySelector(".gqV5NoteInput").value||"").trim()
          };
          if(board==="cycle"){
            task.dynamic=true;
            const type=row.querySelector(".gqV5RotationType")?.value==="interval"?"interval":"manifest";
            task.rotation={type:type};
            if(type==="interval"){
              const anchor=row.querySelector(".gqV5AnchorDate")?.value||"";
              const days=Math.max(1,Math.min(365,Math.round(Number(row.querySelector(".gqV5IntervalDays")?.value)||14)));
              if(anchor)task.rotation.anchor_date=anchor;
              task.rotation.interval_days=days;
            }
          }else if(board==="version"){
            task.dynamic=true;
            task.rotation={type:"manifest"};
          }
          return task;
        });
        boards[board][gid]=normList(raw,board);
      });
    });
    gameQuestDraftConfig={version:VERSION,updatedAt:new Date().toISOString(),priorityOrder:PRIORITY_ORDER.slice(),manifest:cfg.manifest||manifestConfig(cfg),games:cfg.games,boards:boards};
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
    if(board==="cycle"||board==="version"){task.dynamic=true;task.rotation={type:"manifest"}}
    return task;
  }

  document.addEventListener("click",function(e){
    const refresh=e.target.closest&&e.target.closest("[data-gqv5-refresh]");
    if(refresh){e.preventDefault();e.stopImmediatePropagation();loadGameOpsManifest(true);return}
    const tab=e.target.closest&&e.target.closest("[data-gqv5-board]");
    if(tab){e.preventDefault();e.stopImmediatePropagation();setCurrentBoard(tab.dataset.gqv5Board);return}
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
    const del=e.target.closest&&e.target.closest("[data-gqv5-delete]");
    if(del){e.preventDefault();e.stopImmediatePropagation();editorMutate(del.dataset.board,del.dataset.game,function(list){list.splice(Number(del.dataset.index),1)});return}
    const move=e.target.closest&&e.target.closest("[data-gqv5-move]");
    if(move){
      e.preventDefault();e.stopImmediatePropagation();
      const offset=move.dataset.gqv5Move==="up"?-1:1;
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
  }catch(err){console.warn("GameQuest v5 rehydrate skipped",err)}
  renderGameQuestPanel();
  loadGameOpsManifest(false);
  document.addEventListener("click",function(e){
    if(e.target.closest&&e.target.closest('[data-view-target="game"]'))loadGameOpsManifest(false);
  },true);
})();