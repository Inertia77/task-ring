// GameQuest v3 tier policy. Loaded after game-disclosure.js so it can preserve its note support.
(function(){
  'use strict';
  var DEF={
    1:{id:'t1',short:'T1',name:'全勤・全清'},
    2:{id:'t2',short:'T2',name:'全勤・非全清'},
    3:{id:'t3',short:'T3',name:'兴趣制'}
  };
  window.TaskRingGameTierDefs=DEF;

  function tier(v,fallback){
    var n=Number(v);
    if(n===1||n===2||n===3)return n;
    var s=String(v==null?'':v).toLowerCase();
    if(['t1','full','core','all_rewards'].includes(s))return 1;
    if(['t2','attendance','regular'].includes(s))return 2;
    if(['t3','interest','casual','optional'].includes(s))return 3;
    return fallback==null?3:fallback;
  }
  function gameTier(g){return tier(g&&g.tier,1);}
  function gameById(id,cfg){return ((cfg||gameQuestConfig).games||[]).find(function(g){return String(g.id)===String(id);})||null;}
  function requirementFromTitle(title){
    var t=String(title||'').trim(),r=null;
    if(/^(必|必做|MUST)\s*[｜|:：]\s*/i.test(t)){r=true;t=t.replace(/^(必|必做|MUST)\s*[｜|:：]\s*/i,'').trim();}
    else if(/^(选|选做|OPTIONAL)\s*[｜|:：]\s*/i.test(t)){r=false;t=t.replace(/^(选|选做|OPTIONAL)\s*[｜|:：]\s*/i,'').trim();}
    return {title:t,required:r};
  }
  function rawItems(value){return Array.isArray(value)?value:(typeof value==='string'?value.split(/\n+/):[]);}
  function rawMatch(list,task,index){
    var id=String(task&&task.id||''),title=String(task&&task.title||'');
    return list.find(function(x){return x&&typeof x==='object'&&id&&String(x.id||'')===id;})||
      list.find(function(x){return x&&typeof x==='object'&&title&&requirementFromTitle(x.title||x.name).title===title;})||list[index]||null;
  }

  var baseNormalize=normalizeGameQuestTaskList;
  normalizeGameQuestTaskList=function(value,context){
    context=context||'scheduled';
    var list=rawItems(value);
    return baseNormalize(value,context).map(function(task,index){
      var src=rawMatch(list,task,index),pref=requirementFromTitle(task.title),out=Object.assign({},task,{title:pref.title});
      if(src&&typeof src.required==='boolean')out.required=src.required;
      else if(pref.required!==null)out.required=pref.required;
      if(src&&src.cadence)out.cadence=String(src.cadence);
      if(context==='interest'||String(src&&src.plan_mode||'')==='interest'){
        out.plan_mode='interest';out.required=false;
      }
      return out;
    });
  };
  gameQuestTaskStoreList=function(value,context){
    return normalizeGameQuestTaskList(value,context||'scheduled').map(function(t){
      var o={id:t.id,title:t.title,url:t.url||'',plan_mode:t.plan_mode};
      if(typeof t.required==='boolean')o.required=t.required;
      if(t.note)o.note=t.note;
      if(t.cadence)o.cadence=t.cadence;
      if(Number.isFinite(Number(t.weekly_minutes)))o.weekly_minutes=Number(t.weekly_minutes);
      if(Number.isFinite(Number(t.estimated_minutes)))o.estimated_minutes=Number(t.estimated_minutes);
      return o;
    });
  };
  if(typeof gameQuestPlanModeDefs==='object')gameQuestPlanModeDefs.interest={name:'兴趣任务',short:'兴趣',hint:'T3 兴趣池，不计核心完成率。'};

  var baseNormalizeConfig=normalizeGameQuestConfig;
  normalizeGameQuestConfig=function(config){
    var source=config&&typeof config==='object'?deepClone(config):{};
    var legacy=Number(source.version||1)<3;
    var normalized=baseNormalizeConfig(source);
    normalized.version=3;
    normalized.tierPolicy={defaultTier:tier(source.tierPolicy&&source.tierPolicy.defaultTier,3),coreCompletion:'required_only',t3CreatesDebt:false};
    normalized.games=(normalized.games||[]).map(function(g,i){
      var raw=(source.games||[]).find(function(x){return String(x.id)===String(g.id);})||{};
      return Object.assign({},g,{tier:tier(raw.tier,legacy?1:normalized.tierPolicy.defaultTier)});
    });
    normalized.interest={};
    normalized.games.forEach(function(g){
      var rawInterest=source.interest&&source.interest[g.id];
      normalized.interest[g.id]=normalizeGameQuestTaskList(rawInterest||[],'interest').map(function(t){return Object.assign({},t,{plan_mode:'interest',required:false});});
    });
    Object.keys(normalized.schedule||{}).forEach(function(day){
      Object.keys(normalized.schedule[day]||{}).forEach(function(gid){
        normalized.schedule[day][gid]=normalizeGameQuestTaskList((source.schedule&&source.schedule[day]&&source.schedule[day][gid])||normalized.schedule[day][gid],'scheduled');
      });
    });
    Object.keys(normalized.weekly||{}).forEach(function(gid){
      normalized.weekly[gid]=normalizeGameQuestTaskList((source.weekly&&source.weekly[gid])||normalized.weekly[gid],'weekly');
    });
    return normalized;
  };

  function required(task,g,scope){
    if(typeof task.required==='boolean')return task.required;
    var t=gameTier(g);
    if(t===1)return scope!=='interest';
    if(t===2)return scope==='daily';
    return false;
  }
  function state(tasks,g,doneFn,scope){
    var done=tasks.filter(doneFn).length,req=tasks.filter(function(t){return required(t,g,scope);});
    var rd=req.filter(doneFn).length;
    return {tasks:tasks,done:done,total:tasks.length,requiredDone:rd,requiredTotal:req.length,cardDone:req.length?rd>=req.length:false};
  }
  gameQuestEntryState=function(gameId,dayId,cfg,cycle){
    cfg=cfg||gameQuestConfig;cycle=cycle||cycleYmd;
    var g=gameById(gameId,cfg),tasks=gameQuestTaskObjectsFor(gameId,dayId,cfg);
    return state(tasks,g,function(t){return isGameQuestItemDone(gameId,dayId,t.id,cycle);},'daily');
  };
  gameQuestWeeklyEntryState=function(gameId,cfg,cycle){
    cfg=cfg||gameQuestConfig;cycle=cycle||cycleYmd;
    var g=gameById(gameId,cfg),tasks=gameQuestWeeklyTasksFor(gameId,cfg);
    return state(tasks,g,function(t){return isGameQuestWeeklyItemDone(gameId,t.id,cycle);},'weekly');
  };
  gameQuestEntriesForDay=function(dayId,cfg){
    cfg=cfg||gameQuestConfig;
    return enabledGameQuestGames(cfg).filter(function(g){return gameTier(g)<3;}).map(function(g){return Object.assign({game:g},gameQuestEntryState(g.id,dayId,cfg));}).filter(function(e){return e.tasks.length;});
  };
  gameQuestWeeklyEntries=function(cfg){
    cfg=cfg||gameQuestConfig;
    return enabledGameQuestGames(cfg).filter(function(g){return gameTier(g)<3;}).map(function(g){return Object.assign({game:g},gameQuestWeeklyEntryState(g.id,cfg));}).filter(function(e){return e.tasks.length;});
  };
  function stats(entries){
    var total=entries.reduce(function(s,e){return s+e.requiredTotal;},0),done=entries.reduce(function(s,e){return s+e.requiredDone;},0);
    var core=entries.filter(function(e){return e.requiredTotal>0;});
    return {total:total,done:done,pct:total?Math.round(done/total*100):100,cards:core.length,cardsDone:core.filter(function(e){return e.cardDone;}).length};
  }
  gameQuestStats=function(dayId){return stats(gameQuestEntriesForDay(dayId));};
  gameQuestWeeklyStats=function(){return stats(gameQuestWeeklyEntries());};
  gameQuestWeekStats=function(){var total=0,done=0;days.forEach(function(d){var s=gameQuestStats(d.id);total+=s.total;done+=s.done;});return {total:total,done:done,pct:total?Math.round(done/total*100):100};};

  function interestTasks(gameId){return normalizeGameQuestTaskList((gameQuestConfig.interest||{})[gameId]||[],'interest');}
  function interestKey(gameId,itemId){return GH_PREFIX+cycleYmd+'_gqint_'+gameId+'_'+itemId;}
  function interestDone(gameId,itemId){return localStorage.getItem(interestKey(gameId,itemId))==='1';}
  function interestEntries(){
    return enabledGameQuestGames(gameQuestConfig).filter(function(g){return gameTier(g)===3;}).map(function(g){
      var tasks=interestTasks(g.id),done=tasks.filter(function(t){return interestDone(g.id,t.id);}).length;
      return {game:g,tasks:tasks,done:done,total:tasks.length};
    }).filter(function(e){return e.tasks.length;});
  }
  function interestStats(){var es=interestEntries();return {games:es.length,total:es.reduce(function(s,e){return s+e.total;},0),done:es.reduce(function(s,e){return s+e.done;},0)};}

  var oldBadge=gameQuestTaskBadge;
  gameQuestTaskBadge=function(t){
    var base=oldBadge(t),label=t.plan_mode==='interest'?'兴趣':(t.required===false?'选做':'必做'),cls=t.plan_mode==='interest'?'interest':(t.required===false?'optional':'required');
    return base+'<span class="gameQuestReqBadge '+cls+'">'+label+'</span>';
  };
  function tierBadge(g){var d=DEF[gameTier(g)];return '<em class="gameQuestTierBadge '+d.id+'">'+d.short+' '+d.name+'</em>';}
  function entryProgress(e){return e.requiredTotal?{done:e.requiredDone,total:e.requiredTotal,pct:Math.round(e.requiredDone/e.requiredTotal*100)}:{done:e.done,total:e.total,pct:e.total?Math.round(e.done/e.total*100):0};}
  function card(entry,dayId,weekly){
    var g=entry.game,p=entryProgress(entry),isDone=p.total&&p.done>=p.total;
    var title=escapeHtml(g.name),count=p.done+'/'+p.total,body=weekly?gameQuestWeeklyTaskListHtml(g.id,entry.tasks):gameQuestTaskListHtml(g.id,dayId,entry.tasks);
    var btn=weekly?'<button type="button" class="gameQuestCheck '+(isDone?'done':'')+'" data-gq-weekly-card-btn="1" data-gamequest-weekly-game="'+escapeHtml(g.id)+'" data-cycle="'+escapeHtml(cycleYmd)+'"><span></span></button>':'<button type="button" class="gameQuestCheck '+(isDone?'done':'')+'" data-gq-card-btn="1" data-gamequest-game="'+escapeHtml(g.id)+'" data-gamequest-day="'+dayId+'" data-cycle="'+escapeHtml(cycleYmd)+'"><span></span></button>';
    return '<article class="gameQuestCard gameQuestCardV2 tier-'+DEF[gameTier(g)].id+' accent-'+escapeHtml(g.accent)+' '+(isDone?'done':'')+'" style="--gq-p:'+p.pct+'%"><div class="gameQuestCardTop">'+btn+'<span class="gameQuestIcon gameQuestIconOrb">'+escapeHtml(String(g.short||g.name).slice(0,1))+'</span><div class="gameQuestNameWrap"><span class="gameQuestName">'+title+' '+tierBadge(g)+'</span><span class="gameQuestShort">'+(gameTier(g)===1?'核心奖励追踪':'今日只保全勤 / 周奖励可选')+'</span></div><span class="gameQuestCount">'+count+'</span></div><div class="gameQuestProgressRail"><span></span></div><div class="gameQuestCardBody">'+body+'</div></article>';
  }
  gameQuestCardHtml=function(e,d){return card(e,d,false);};
  gameQuestWeeklyCardHtml=function(e){return card(e,gameQuestSelectedDay,true);};

  function interestList(gid,tasks){
    return '<ul class="gameQuestTaskList gameQuestTaskListV2 interest">'+tasks.map(function(t,i){
      var done=interestDone(gid,t.id),note=t.note?'<details class="gameQuestTaskNote"><summary>备注</summary><div class="gameQuestTaskNoteBody">'+escapeHtml(t.note)+'</div></details>':'';
      return '<li class="'+(done?'done':'')+'"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 '+(done?'done':'')+'" data-gq-interest-item="1" data-gq-interest-game="'+escapeHtml(gid)+'" data-gq-interest-id="'+escapeHtml(t.id)+'" aria-pressed="'+(done?'true':'false')+'"><span class="gameQuestTaskNo">'+String(i+1).padStart(2,'0')+'</span><span class="gameQuestMiniBox"></span><i>'+escapeHtml(t.title)+'</i><span class="gameQuestReqBadge interest">兴趣</span>'+(t.cadence?'<span class="gameQuestCadenceBadge">'+escapeHtml(t.cadence)+'</span>':'')+'</button></div>'+note+'</li>';
    }).join('')+'</ul>';
  }
  function interestCard(e){
    var g=e.game,p=e.total?Math.round(e.done/e.total*100):0;
    return '<article class="gameQuestCard gameQuestCardV2 gameQuestInterestCard tier-t3 accent-'+escapeHtml(g.accent)+'" style="--gq-p:'+p+'%"><div class="gameQuestCardTop"><span class="gameQuestCheck passive"><span></span></span><span class="gameQuestIcon gameQuestIconOrb">'+escapeHtml(String(g.short||g.name).slice(0,1))+'</span><div class="gameQuestNameWrap"><span class="gameQuestName">'+escapeHtml(g.name)+' '+tierBadge(g)+'</span><span class="gameQuestShort">想玩就玩，不形成欠账。</span></div><span class="gameQuestCount">'+e.done+'/'+e.total+'</span></div><div class="gameQuestProgressRail"><span></span></div><div class="gameQuestCardBody">'+interestList(g.id,e.tasks)+'</div></article>';
  }
  function group(title,desc,cls,entries,render){
    var s=stats(entries),cards=entries.length?entries.map(render).join(''):'<div class="gameQuestEmpty compact"><b>没有配置项目。</b></div>';
    return '<section class="gameQuestTierGroup '+cls+'"><header class="gameQuestTierGroupHead"><div><b>'+title+'</b><span>'+desc+'</span></div><em>'+(s.total?s.done+'/'+s.total:'不计核心')+'</em></header><div class="gameQuestGrid">'+cards+'</div></section>';
  }

  setGameQuestBoardMode=function(mode){gameQuestBoardMode=['today','week','interest'].includes(mode)?mode:'today';localStorage.setItem(GQ_BOARD_MODE_KEY,gameQuestBoardMode);renderGameQuestPanel();};
  renderGameQuestPanel=function(){
    var panel=document.getElementById('gameQuestPanel');if(!panel)return;
    var daily=gameQuestStats(gameQuestSelectedDay),weekly=gameQuestWeeklyStats(),ints=interestStats();
    var tabs='<div class="gameQuestModeTabs" role="tablist"><button type="button" class="gameQuestModeBtn '+(gameQuestBoardMode==='today'?'active':'')+'" data-gamequest-board-mode="today"><span>今日全勤</span><b>'+daily.done+'/'+daily.total+'</b></button><button type="button" class="gameQuestModeBtn '+(gameQuestBoardMode==='week'?'active':'')+'" data-gamequest-board-mode="week"><span>本周奖励</span><b>'+weekly.done+'/'+weekly.total+'</b></button><button type="button" class="gameQuestModeBtn '+(gameQuestBoardMode==='interest'?'active':'')+'" data-gamequest-board-mode="interest"><span>兴趣池</span><b>'+ints.games+' GAME</b></button></div>';
    var top='<div class="gameQuestTopBar gameQuestTopBarStandalone"><div class="gameQuestTopTitle"><span>GAME QUEST</span><strong>游戏作战区</strong><em>T1 全勤全清 / T2 只保全勤 / T3 兴趣制。完成率只算真正的义务。</em></div><div class="gameQuestHeroSide"><button type="button" class="gameCommandBtn gameQuestTodayQuick" id="gameQuestTodayBtn"><span class="gameCommandIcon">◎</span><span class="gameCommandCopy"><small>TODAY</small><b>今日</b><em>回到今天</em></span></button><button type="button" class="gameCommandBtn gameQuestEditQuick" data-open-game-editor><span class="gameCommandIcon">✎</span><span class="gameCommandCopy"><small>QUEST</small><b>编辑任务</b><em>梯度 / 日常 / 周常</em></span></button></div></div>';
    var body='';
    if(gameQuestBoardMode==='interest'){
      var ie=interestEntries();body='<div class="gameQuestInterestPane"><div class="gameQuestMetaStrip"><span>T3｜不要求全勤，不产生逾期；感兴趣的时候再玩。</span><em>NO DEBT</em></div><div class="gameQuestGrid gameQuestInterestGrid">'+(ie.length?ie.map(interestCard).join(''):'<div class="gameQuestEmpty"><b>兴趣池为空。</b></div>')+'</div></div>';
    }else if(gameQuestBoardMode==='week'){
      var we=gameQuestWeeklyEntries(),w1=we.filter(function(e){return gameTier(e.game)===1;}),w2=we.filter(function(e){return gameTier(e.game)===2;});
      body='<div class="gameQuestWeeklyPane"><div class="gameQuestMetaStrip"><span>T1 奖励必须清完；T2 周常 / 高难只作为可做收益。</span><em>'+weekly.pct+'% CORE</em></div>'+group('T1｜本周必须清完','绝区零 / 崩铁：配置中的奖励追到领取完成。','t1',w1,function(e){return gameQuestWeeklyCardHtml(e);})+group('T2｜本周可做收益','鸣潮 / 异环：不影响核心完成率。','t2',w2,function(e){return gameQuestWeeklyCardHtml(e);})+'</div>';
    }else{
      var de=gameQuestEntriesForDay(gameQuestSelectedDay),d1=de.filter(function(e){return gameTier(e.game)===1;}),d2=de.filter(function(e){return gameTier(e.game)===2;});
      body='<div class="gameQuestDailyPane"><div class="gameQuestMetaStrip"><span>今日只出现 T1 + T2；T3 不进入日清。</span><em>'+daily.pct+'% CORE</em></div><div class="gameQuestDays">'+gameQuestDayTabsHtml()+'</div><div class="gameQuestSubHead"><span>'+escapeHtml(dayName(gameQuestSelectedDay))+(gameQuestSelectedDay===today?'｜今日':'')+'</span></div>'+group('T1｜全勤 + 全清','每天完成核心日常；奖励链在本周页继续追踪。','t1',d1,function(e){return gameQuestCardHtml(e,gameQuestSelectedDay);})+group('T2｜只保全勤','每天完成基础日课即可。','t2',d2,function(e){return gameQuestCardHtml(e,gameQuestSelectedDay);})+'</div>';
    }
    panel.innerHTML='<div class="gameQuestShell gameQuestStandalone">'+top+tabs+body+'</div>';
  };

  var baseCreate=createGameQuestDraftGame;
  createGameQuestDraftGame=function(){var g=baseCreate();g.tier=3;return g;};
  var baseRenderEditor=renderGameQuestEditor;
  renderGameQuestEditor=function(){
    baseRenderEditor();var cfg=gameQuestDraftConfig||gameQuestConfig;
    document.querySelectorAll('[data-gq-game-row]').forEach(function(row){
      if(row.querySelector('.gqMetaTier'))return;var g=gameById(row.dataset.gqGameRow,cfg);if(!g)return;
      var host=row.querySelector('.gqMetaField.accent');if(!host)return;
      var html='<div class="gqMetaField tier"><label>游戏梯度</label><select class="gqMetaTier"><option value="1" '+(gameTier(g)===1?'selected':'')+'>T1｜全勤・全清</option><option value="2" '+(gameTier(g)===2?'selected':'')+'>T2｜全勤・非全清</option><option value="3" '+(gameTier(g)===3?'selected':'')+'>T3｜兴趣制</option></select></div>';
      host.insertAdjacentHTML('afterend',html);
    });
  };
  var baseCollect=collectGameQuestEditorState;
  collectGameQuestEditorState=function(){
    baseCollect();if(!gameQuestDraftConfig)return;
    document.querySelectorAll('[data-gq-game-row]').forEach(function(row){var g=(gameQuestDraftConfig.games||[]).find(function(x){return x.id===row.dataset.gqGameRow;});if(g)g.tier=tier(row.querySelector('.gqMetaTier')&&row.querySelector('.gqMetaTier').value,g.tier||3);});
  };

  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('[data-gq-interest-item]');if(!b)return;
    ev.preventDefault();ev.stopPropagation();syncSetItem(interestKey(b.dataset.gqInterestGame,b.dataset.gqInterestId),b.getAttribute('aria-pressed')!=='true');renderAll();
  },true);

  try{
    var raw=localStorage.getItem(TASK_CONFIG_LOCAL_KEY),saved=raw?JSON.parse(raw):null;
    gameQuestConfig=normalizeGameQuestConfig((saved&&saved.gameQuest)||(taskConfig&&taskConfig.gameQuest)||gameQuestConfig);
    if(taskConfig)taskConfig.gameQuest=gameQuestConfig;
  }catch(_){gameQuestConfig=normalizeGameQuestConfig(gameQuestConfig);}
  if(typeof applyTaskConfig==='function'){
    var baseApply=applyTaskConfig;
    applyTaskConfig=function(config,shouldRender){
      var c=config&&typeof config==='object'?deepClone(config):config;
      if(c&&c.gameQuest)c.gameQuest=normalizeGameQuestConfig(c.gameQuest);
      var result=baseApply(c,shouldRender);
      gameQuestConfig=normalizeGameQuestConfig((taskConfig&&taskConfig.gameQuest)||gameQuestConfig);
      if(taskConfig)taskConfig.gameQuest=gameQuestConfig;
      if(shouldRender)renderGameQuestPanel();
      return result;
    };
  }
  renderGameQuestPanel();
})();