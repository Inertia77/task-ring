(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.TaskRingGamePlayPolicy=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  // User-specific rankings must come from the authenticated Supabase policy rows
  // or from an explicitly imported gameQuest config, never from public demo data.
  const OPS_KEYS={ZZZ:"zzz",WUWA:"wuwa",NTE:"nte",HSR:"hsr",ONMYOJI:"onmyoji",ENF:"endfield",WWM:"wwm"};
  let owner="",policyRows=new Map(),opsRows=[];
  function validTier(value){const n=Number(value);return [1,2,3].includes(n)?n:null;}
  function gameKey(game){return String(game?.id||game?.game_key||game?.key||"").trim().toLowerCase();}
  function notify(){
    if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"){
      window.dispatchEvent(new window.Event("taskring-game-policy-changed"));
    }
  }
  function setOwner(value){
    const next=String(value||"");
    if(next===owner)return;
    owner=next;policyRows=new Map();opsRows=[];notify();
  }
  function setRows(rows,userId){
    if(!owner||String(userId||"")!==owner)return false;
    const map=new Map();
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      const key=String(row?.game_key||"").trim().toLowerCase();
      if(key&&validTier(row?.play_tier)!==null)map.set(key,row);
    });
    policyRows=map;notify();return true;
  }
  function setOpsTasks(rows,userId){
    if(!owner||String(userId||"")!==owner)return false;
    opsRows=Array.isArray(rows)?rows.slice():[];
    notify();return true;
  }
  function get(game){
    const key=gameKey(game),row=policyRows.get(key);
    const configured=validTier(game?.playTier??game?.tier);
    const sort=Number(row?.sort_order??game?.priority);
    return {
      key,
      tier:validTier(row?.play_tier)??configured,
      storyFocus:typeof row?.story_focus==="boolean"?row.story_focus:game?.storyFocus===true,
      sortOrder:Number.isFinite(sort)?sort:999,
      gameName:String(row?.game_name||game?.name||""),
      gameKind:String(row?.game_kind||""),
      routinePolicy:String(row?.routine_policy||""),
      limitedEventPolicy:String(row?.limited_event_policy||"")
    };
  }
  function tierForCode(code){
    const key=OPS_KEYS[String(code||"").toUpperCase()]||String(code||"").toLowerCase();
    return get({id:key}).tier;
  }
  function forCode(code){return get({id:OPS_KEYS[String(code||"").toUpperCase()]||String(code||"").toLowerCase()});}
  function untrackedGames(games){
    const tracked=new Set((Array.isArray(games)?games:[]).map(gameKey));
    return [...policyRows.values()].filter(row=>!tracked.has(String(row.game_key).toLowerCase()))
      .sort((a,b)=>a.play_tier-b.play_tier||a.sort_order-b.sort_order)
      .map(row=>({id:row.game_key,name:row.game_name,...get({id:row.game_key})}));
  }
  function endMs(task){
    const value=task?.claim_end_at||task?.deadline_at||task?.gameplay_end_at;
    if(value){const n=Date.parse(value);return Number.isFinite(n)?n:NaN;}
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(task?.deadline_date||""))){
      return Date.parse(task.deadline_date+"T23:59:59.999+09:00");
    }
    return NaN;
  }
  function startsLater(task,now){
    if(task?.open_at){const n=Date.parse(task.open_at);return Number.isFinite(n)&&n>now;}
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(task?.open_date||""))){
      return Date.parse(task.open_date+"T00:00:00+09:00")>now;
    }
    return task?.lifecycle_status==="UPCOMING";
  }
  function blockedOpsCount(now=Date.now()){
    return opsRows.filter(function(task){
      const tier=tierForCode(task.game);
      if(tier===null||tier>2)return false;
      if(task.archived_at||task.lifecycle_status==="ARCHIVED"||task.user_action==="DONE"||task.user_action==="SKIP")return false;
      if(task.verification!=="CONFIRMED"||startsLater(task,now))return false;
      const end=endMs(task);
      return Number.isFinite(end)&&end>now;
    }).length;
  }
  return {validTier,get,gameKey,forCode,tierForCode,untrackedGames,blockedOpsCount,setOwner,setRows,setOpsTasks};
});
