// GameQuest v3 interest-pool editor. Loaded after game-tier-system.js.
(function(){
  'use strict';
  function t3(g){return Number(g&&g.tier)===3;}
  function items(gameId){return normalizeGameQuestTaskList((gameQuestDraftConfig&&gameQuestDraftConfig.interest&&gameQuestDraftConfig.interest[gameId])||[],'interest');}
  function row(gameId,t,i,total){
    var cadence=String(t.cadence||'when_interested'),last=total-1;
    return '<div class="gqWeeklyRow gqInterestRow" data-gq-interest-row="'+i+'" data-gq-task-id="'+escapeHtml(t.id||'')+'"><div class="gqTaskFields"><label><span>兴趣项目</span><input class="gqInterestTaskTitle" value="'+escapeHtml(t.title||'')+'" placeholder="例如：斗技 / 活动 / 清图"></label><label><span>节奏</span><select class="gqInterestCadence"><option value="when_interested" '+(cadence==='when_interested'?'selected':'')+'>有兴趣时</option><option value="daily" '+(cadence==='daily'?'selected':'')+'>原每日</option><option value="weekly" '+(cadence==='weekly'?'selected':'')+'>原每周</option><option value="cycle" '+(cadence==='cycle'?'selected':'')+'>周期</option></select></label><label class="gqTaskNoteField"><span>备注</span><textarea class="gqInterestTaskNote" rows="2">'+escapeHtml(t.note||'')+'</textarea></label></div><div class="gqDailyRowOps"><button type="button" class="gqDailyMiniBtn" data-tier-interest-move="up" data-tier-game="'+escapeHtml(gameId)+'" data-tier-index="'+i+'" '+(i<=0?'disabled':'')+'>↑</button><button type="button" class="gqDailyMiniBtn" data-tier-interest-move="down" data-tier-game="'+escapeHtml(gameId)+'" data-tier-index="'+i+'" '+(i>=last?'disabled':'')+'>↓</button><button type="button" class="gqDailyMiniBtn danger" data-tier-interest-del="1" data-tier-game="'+escapeHtml(gameId)+'" data-tier-index="'+i+'">✕</button></div></div>';
  }
  function section(){
    if(!gameQuestDraftConfig)return '';
    var games=(gameQuestDraftConfig.games||[]).filter(function(g){return g.enabled!==false&&t3(g);});
    var content=games.map(function(g){
      var list=items(g.id),body=list.length?list.map(function(x,i){return row(g.id,x,i,list.length);}).join(''):'<div class="gqDailyEmpty">还没有兴趣项目。这里不会产生欠账。</div>';
      return '<div class="gameQuestEditRow gameQuestEditRowV2 gameQuestInterestEditRow accent-'+escapeHtml(g.accent)+'" data-tier-interest-game="'+escapeHtml(g.id)+'"><div class="gameQuestEditGame"><span>'+escapeHtml(g.icon)+'</span><b>'+escapeHtml(g.name)+'</b><em>T3 兴趣池 · '+list.length+' 项</em><button type="button" class="gqDailyAddBtn" data-tier-interest-add="'+escapeHtml(g.id)+'">＋ 项目</button></div><div class="gqWeeklyRows">'+body+'</div></div>';
    }).join('');
    return '<section class="gameQuestEditGroup gameQuestInterestEditorGroup"><div class="gameQuestEditHead"><div><b>T3 兴趣池</b><span>不要求全勤、不产生逾期。这里只保存想玩时可以做什么。</span></div></div>'+(content||'<div class="gameQuestEmpty compact"><b>目前没有 T3 游戏。</b></div>')+'</section>';
  }
  var baseRender=renderGameQuestEditor;
  renderGameQuestEditor=function(){
    baseRender();var list=document.getElementById('gameQuestEditorList');if(!list)return;
    (gameQuestDraftConfig.games||[]).filter(t3).forEach(function(g){
      var daily=list.querySelector('[data-gq-daily-game="'+safeCssEscape(g.id)+'"]');if(daily)daily.remove();
      var weekly=list.querySelector('[data-gq-weekly-edit-game="'+safeCssEscape(g.id)+'"]');if(weekly)weekly.remove();
    });
    if(!list.querySelector('.gameQuestInterestEditorGroup')){
      var meta=list.querySelector('.gameQuestMetaDetails');if(meta)meta.insertAdjacentHTML('beforebegin',section());
    }
  };
  var baseCollect=collectGameQuestEditorState;
  collectGameQuestEditorState=function(){
    baseCollect();if(!gameQuestDraftConfig)return;
    if(!gameQuestDraftConfig.interest)gameQuestDraftConfig.interest={};
    document.querySelectorAll('[data-tier-interest-game]').forEach(function(card){
      var gameId=card.dataset.tierInterestGame;
      gameQuestDraftConfig.interest[gameId]=gameQuestTaskStoreList(Array.from(card.querySelectorAll('[data-gq-interest-row]')).map(function(r){return {id:r.dataset.gqTaskId||'',title:(r.querySelector('.gqInterestTaskTitle')||{}).value||'',note:(r.querySelector('.gqInterestTaskNote')||{}).value||'',cadence:(r.querySelector('.gqInterestCadence')||{}).value||'when_interested',plan_mode:'interest',required:false};}),'interest');
    });
  };
  function ensure(gameId){if(!gameQuestDraftConfig.interest)gameQuestDraftConfig.interest={};if(!Array.isArray(gameQuestDraftConfig.interest[gameId]))gameQuestDraftConfig.interest[gameId]=[];return gameQuestDraftConfig.interest[gameId];}
  document.addEventListener('click',function(ev){
    var add=ev.target.closest&&ev.target.closest('[data-tier-interest-add]');
    if(add){ev.preventDefault();ev.stopPropagation();collectGameQuestEditorState();ensure(add.dataset.tierInterestAdd).push({id:'',title:'',note:'',cadence:'when_interested',plan_mode:'interest',required:false});renderGameQuestEditor();return;}
    var del=ev.target.closest&&ev.target.closest('[data-tier-interest-del]');
    if(del){ev.preventDefault();ev.stopPropagation();collectGameQuestEditorState();ensure(del.dataset.tierGame).splice(Number(del.dataset.tierIndex),1);renderGameQuestEditor();return;}
    var mv=ev.target.closest&&ev.target.closest('[data-tier-interest-move]');
    if(mv){ev.preventDefault();ev.stopPropagation();collectGameQuestEditorState();var a=ensure(mv.dataset.tierGame),i=Number(mv.dataset.tierIndex),j=i+(mv.dataset.tierInterestMove==='up'?-1:1);if(j>=0&&j<a.length){var x=a[i];a[i]=a[j];a[j]=x;}renderGameQuestEditor();}
  },true);
})();