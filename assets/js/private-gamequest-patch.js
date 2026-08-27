(() => {
  "use strict";

  const PARAM = "gameQuestPatch";
  const PENDING_KEY = "taskring_private_gamequest_patch_v1";
  const CONFIRM_KEY = "taskring_private_gamequest_patch_confirm_v1";
  let applying = false;

  function toast(message, type = "ok", duration = 5200){
    if(typeof window.showToast === "function") window.showToast(message, type, duration);
    else console.info(message);
  }
  function report(status, message = ""){
    try{if(window.parent&&window.parent!==window)window.parent.postMessage({type:"taskring-gamequest-patch",status,message},location.origin)}catch(_){ }
  }
  function decodePayload(raw){
    const normalized=String(raw||"").trim().replace(/-/g,"+").replace(/_/g,"/");
    if(!normalized)throw new Error("empty payload");
    const padded=normalized+"=".repeat((4-normalized.length%4)%4);
    const bytes=Uint8Array.from(atob(padded),ch=>ch.charCodeAt(0));
    const parsed=JSON.parse(new TextDecoder().decode(bytes));
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("invalid payload");
    return parsed;
  }
  function readPending(){try{const raw=sessionStorage.getItem(PENDING_KEY);return raw?JSON.parse(raw):null}catch(_){return null}}

  function cleanItem(item,fallbackMode){
    const raw=typeof item==="string"?{title:item}:(item&&typeof item==="object"?item:null);
    if(!raw)return null;
    const title=String(raw.title||"").trim();if(!title)return null;
    const mode=raw.plan_mode==="weekly"?"weekly":(raw.plan_mode==="daily"?"daily":fallbackMode);
    const out={id:String(raw.id||title).trim(),title,url:String(raw.url||"").trim(),plan_mode:mode,enabled:raw.enabled!==false};
    const note=String(raw.note||raw.detail||"").trim();if(note)out.note=note;
    if(mode==="weekly"||raw.cadence){
      out.cadence=String(raw.cadence||"weekly");
      if(raw.cycle_key)out.cycle_key=String(raw.cycle_key);
      if(raw.due_at)out.due_at=String(raw.due_at);
      if(raw.auto_managed===true)out.auto_managed=true;
    }
    return out;
  }
  function ensureUniqueItems(items,mode){
    const used=new Set();
    return (Array.isArray(items)?items:[]).map(item=>cleanItem(item,mode)).filter(Boolean).map((item,index)=>{
      let id=String(item.id||`item-${index+1}`).trim()||`item-${index+1}`;const base=id;let n=2;while(used.has(id))id=`${base}-${n++}`;used.add(id);return {...item,id};
    });
  }

  function validateFullConfig(config,expect={}){
    const games=(config.games||[]).filter(g=>g.enabled!==false);
    const ids=new Set(games.map(g=>String(g.id)));
    if(expect.game_count!=null&&games.length!==Number(expect.game_count))throw new Error(`game_count ${games.length} != ${expect.game_count}`);
    for(const required of (Array.isArray(expect.game_ids)?expect.game_ids:[]))if(!ids.has(String(required)))throw new Error(`missing game ${required}`);
    if(expect.daily_counts&&typeof expect.daily_counts==="object"){
      for(const [gameId,want] of Object.entries(expect.daily_counts)){
        const day="1";const actual=(config.schedule?.[day]?.[gameId]||[]).length;
        if(actual!==Number(want))throw new Error(`daily ${gameId} ${actual} != ${want}`);
      }
    }
    if(expect.cadence_counts&&typeof expect.cadence_counts==="object"){
      const counts={};
      Object.values(config.weekly||{}).flat().forEach(task=>{const c=String(task.cadence||"weekly");counts[c]=(counts[c]||0)+1});
      for(const [cadence,want] of Object.entries(expect.cadence_counts))if((counts[cadence]||0)!==Number(want))throw new Error(`cadence ${cadence} ${counts[cadence]||0} != ${want}`);
    }
  }

  function applyFullConfig(base,payload){
    const nextGameQuest=normalizeGameQuestConfig(payload.config);
    validateFullConfig(nextGameQuest,payload.expect||{});
    return normalizeTaskConfig({...base,gameQuest:nextGameQuest,updatedAt:new Date().toISOString()});
  }

  function applySingleGame(base,payload){
    const gameQuest=normalizeGameQuestConfig(base.gameQuest||{});
    const games=(gameQuest.games||[]).map(game=>({...game}));
    const schedule={};
    [1,2,3,4,5,6,0].forEach(day=>{const key=String(day);schedule[key]={};Object.entries(gameQuest.schedule?.[key]||{}).forEach(([gameId,items])=>{schedule[key][gameId]=ensureUniqueItems(items,"daily")})});
    const weekly={};Object.entries(gameQuest.weekly||{}).forEach(([gameId,items])=>{weekly[gameId]=ensureUniqueItems(items,"weekly")});
    const game=payload.game;if(!game||typeof game!=="object")throw new Error("game metadata missing");
    const gameId=String(game.id||"").trim();if(!gameId||!/^[a-z0-9_-]{2,40}$/i.test(gameId))throw new Error("invalid game id");
    const normalizedGame={id:gameId,name:String(game.name||gameId).trim().slice(0,40),short:String(game.short||game.name||gameId).trim().slice(0,20),icon:String(game.icon||"G").trim().slice(0,8),accent:String(game.accent||"amber").trim().slice(0,16),enabled:game.enabled!==false};
    const index=games.findIndex(entry=>entry.id===gameId);if(index>=0)games[index]={...games[index],...normalizedGame};else games.push(normalizedGame);
    const daily=ensureUniqueItems(payload.daily||[],"daily");const days=Array.isArray(payload.days)?payload.days.map(Number).filter(day=>[0,1,2,3,4,5,6].includes(day)):[1,2,3,4,5,6,0];
    days.forEach(day=>{schedule[String(day)][gameId]=daily.map(item=>({...item}))});weekly[gameId]=ensureUniqueItems(payload.weekly||[],"weekly");
    const nextGameQuest=normalizeGameQuestConfig({version:3,updatedAt:new Date().toISOString(),games,schedule,weekly,focus:gameQuest.focus});
    if(!nextGameQuest.games.some(entry=>entry.id===gameId))throw new Error("game was not retained after normalization");
    return normalizeTaskConfig({...base,gameQuest:nextGameQuest,updatedAt:new Date().toISOString()});
  }

  function applyPatchToConfig(baseConfig,payload){
    if(Number(payload.version||1)!==1)throw new Error("unsupported patch version");
    const base=normalizeTaskConfig(baseConfig);
    return payload.config&&typeof payload.config==="object"?applyFullConfig(base,payload):applySingleGame(base,payload);
  }

  async function applyPending(configHint=null){
    if(applying)return false;
    const payload=readPending();if(!payload)return false;
    const localConfig=typeof loadLocalTaskConfig==="function"?loadLocalTaskConfig():null;
    const hasCloud=typeof ghToken==="function"&&!!ghToken();
    if(!localConfig&&hasCloud&&!configHint)return false;
    const patchId=String(payload.id||"gamequest-patch");
    if(sessionStorage.getItem(CONFIRM_KEY)!==patchId){
      const prompt=String(payload.confirm_message||"将更新 TaskRing 游戏作战区配置。修改前会自动备份，确认继续？");
      if(!window.confirm(prompt)){sessionStorage.removeItem(PENDING_KEY);toast("已取消游戏任务更新；没有修改配置。","warn",4200);report("cancelled","用户取消");return false}
      sessionStorage.setItem(CONFIRM_KEY,patchId);
    }
    applying=true;report("applying","正在备份并重构游戏配置");
    try{
      const source=localConfig||configHint||taskConfig||buildDefaultConfig();
      const next=applyPatchToConfig(source,payload);
      const saved=saveLocalTaskConfig(next,String(payload.backup_reason||"更新游戏作战区前自动备份"));
      applyTaskConfig(saved,true);if(typeof setActiveAppView==="function")setActiveAppView("game");if(typeof renderGameQuestPanel==="function")renderGameQuestPanel();
      if(hasCloud&&typeof ghPatchConfig==="function"){report("syncing","本机已更新，正在同步加密配置");await ghPatchConfig(saved);if(typeof setGhStatus==="function")setGhStatus("GitHub：已同步","on")}
      sessionStorage.removeItem(PENDING_KEY);sessionStorage.removeItem(CONFIRM_KEY);
      const message=String(payload.message||"游戏作战区已更新并同步。");toast(message,"ok",6200);report("success",message);return true;
    }catch(error){
      console.error("private game quest patch failed",error);const message=`${String(error.message||error)}；原配置已保留。`;toast(`游戏任务更新失败：${message}`,"err",7600);report("error",message);return false;
    }finally{applying=false}
  }

  function capture(){
    const rawHash=location.hash.startsWith("#")?location.hash.slice(1):"";if(!rawHash)return;
    const params=new URLSearchParams(rawHash);const raw=params.get(PARAM);if(!raw)return;
    try{const payload=decodePayload(raw);sessionStorage.setItem(PENDING_KEY,JSON.stringify(payload));params.delete(PARAM);const remaining=params.toString();history.replaceState(null,"",`${location.pathname}${location.search}${remaining?`#${remaining}`:""}`);report("ready","更新内容已读取")}
    catch(error){console.error("invalid private game quest patch",error);toast("游戏任务更新链接无效；没有修改配置。","err",5200);report("error","更新链接无效")}
  }

  const baseApply=typeof applyTaskConfig==="function"?applyTaskConfig:null;
  if(baseApply)applyTaskConfig=function(config,shouldRender=false){const result=baseApply(config,shouldRender);if(!applying)queueMicrotask(()=>applyPending(config));return result};
  capture();applyPending();
})();
