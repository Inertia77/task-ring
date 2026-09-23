(() => {
"use strict";
const TIERS={
  1:{name:"全勤・全清",short:"T1"},
  2:{name:"全勤・非全清",short:"T2"},
  3:{name:"兴趣制",short:"T3"}
};
const LEGACY={zzz:1,hsr:1,wuwa:2,nte:2,onmyoji:3,endfield:3};
const POLICY={defaultTier:3,coreCompletion:"required_only",t3CreatesDebt:false,tiers:{
  "1":{name:"全勤・全清",attendanceRequired:true,allConfiguredRewardsRequired:true},
  "2":{name:"全勤・非全清",attendanceRequired:true,allConfiguredRewardsRequired:false},
  "3":{name:"兴趣制",attendanceRequired:false,allConfiguredRewardsRequired:false}
}};
window.TaskRingGameTierSystem={version:3,TIERS};

function tier(v,f=3){const n=Number(v);return [1,2,3].includes(n)?n:f}
function gameTier(g){return tier(g?.tier,LEGACY[String(g?.id||"")]||3)}
function rawList(v){return Array.isArray(v)?v:(typeof v==="string"?v.split(/\n+/):[])}
function stripPrefix(v){
  let title=String(v||"").trim(),required=null;
  if(/^(?:必|必做|MUST)\s*[｜|:：]\s*/i.test(title)){required=true;title=title.replace(/^(?:必|必做|MUST)\s*[｜|:：]\s*/i,"").trim()}
  else if(/^(?:选|选做|OPTIONAL)\s*[｜|:：]\s*/i.test(title)){required=false;title=title.replace(/^(?:选|选做|OPTIONAL)\s*[｜|:：]\s*/i,"").trim()}
  return {title,required};
}
function sourceFor(items,t,i){
  const id=String(t?.id||"").trim();
  if(id){const hit=items.find(x=>x&&typeof x==="object"&&String(x.id||"").trim()===id);if(hit)return hit}
  const title=stripPrefix(t?.title||"").title;
  return items.find(x=>x&&typeof x==="object"&&stripPrefix(x.title||x.name||"").title===title)||(items[i]&&typeof items[i]==="object"?items[i]:null);
}
function requiredFor(t,g,pool){
  const gt=gameTier(g);
  // 周/周期义务由游戏梯度固定：T1 全清，T2 只做收益，T3 不形成义务。
  if(pool==="weekly")return gt===1;
  if(pool==="interest")return false;
  // 日常层仍允许单任务区分核心/选做，例如信赖、邀约等不必强行计入。
  if(typeof t?.required==="boolean")return t.required;
  const p=stripPrefix(t?.title||"").required;if(p!==null)return p;
  return gt<=2;
}
function cadenceFor(t,f=""){return String(t?.cadence||"").trim()||(t?.plan_mode==="daily"?"daily":t?.plan_mode==="weekly"?"weekly":f)}
function pushUnique(list,t){
  if(!t?.title)return;
  const sig=`${t.cadence||""}|${t.id||""}|${t.title}`.toLowerCase();
  if(!list.some(x=>`${x.cadence||""}|${x.id||""}|${x.title}`.toLowerCase()===sig))list.push(t);
}

const baseNormalizeTaskList=normalizeGameQuestTaskList;
normalizeGameQuestTaskList=function(v,context="scheduled"){
  const items=rawList(v);
  return baseNormalizeTaskList(v,context).map((t,i)=>{
    const src=sourceFor(items,t,i),p=stripPrefix(t.title),out={...t,title:p.title};
    const req=typeof src?.required==="boolean"?src.required:p.required;
    if(req!==null)out.required=req;
    if(src?.cadence)out.cadence=String(src.cadence);
    return out;
  });
};
gameQuestTaskStoreList=function(v,context="scheduled"){
  return normalizeGameQuestTaskList(v,context).map(t=>{
    const o={id:t.id,title:t.title,url:t.url||"",plan_mode:t.plan_mode};
    if(t.note)o.note=String(t.note).trim();
    if(typeof t.required==="boolean")o.required=t.required;
    if(t.cadence)o.cadence=String(t.cadence);
    if(Number.isFinite(Number(t.weekly_minutes)))o.weekly_minutes=Number(t.weekly_minutes);
    if(Number.isFinite(Number(t.estimated_minutes)))o.estimated_minutes=Number(t.estimated_minutes);
    return o;
  });
};

const baseNormalizeConfig=normalizeGameQuestConfig;
normalizeGameQuestConfig=function(config){
  const src=config&&typeof config==="object"?config:{},base=baseNormalizeConfig(config);
  const srcGames=new Map((Array.isArray(src.games)?src.games:[]).map(g=>[String(g.id),g]));
  const games=(base.games||[]).map(g=>({...g,tier:tier(srcGames.get(String(g.id))?.tier,LEGACY[String(g.id)]||3)}));
  const interest={};
  games.filter(g=>gameTier(g)===3).forEach(g=>interest[g.id]=[]);
  Object.entries(src.interest||{}).forEach(([gid,list])=>{
    if(!interest[gid])interest[gid]=[];
    normalizeGameQuestTaskList(list,"scheduled").forEach(t=>pushUnique(interest[gid],{...t,plan_mode:"interest",required:false,cadence:cadenceFor(t,"interest")}));
  });
  [1,2,3,4,5,6,0].forEach(d=>{
    const k=String(d),rawDay=src.schedule?.[k]||{};
    games.forEach(g=>{
      if(gameTier(g)===3){
        normalizeGameQuestTaskList(rawDay[g.id],"scheduled").forEach(t=>pushUnique(interest[g.id],{...t,plan_mode:"interest",required:false,cadence:cadenceFor(t,"daily")}));
        if(base.schedule?.[k])delete base.schedule[k][g.id];
      }else{
        (base.schedule?.[k]?.[g.id]||[]).forEach(t=>{
          if(typeof t.required!=="boolean")t.required=requiredFor(t,g,"daily");
          if(!t.cadence)t.cadence=cadenceFor(t,"daily");
        });
      }
    });
  });
  games.forEach(g=>{
    if(gameTier(g)===3){
      normalizeGameQuestTaskList(src.weekly?.[g.id]||[],"weekly").forEach(t=>pushUnique(interest[g.id],{...t,plan_mode:"interest",required:false,cadence:cadenceFor(t,"weekly")}));
      base.weekly[g.id]=[];
    }else{
      (base.weekly[g.id]||[]).forEach(t=>{
        t.required=requiredFor(t,g,"weekly");
        if(!t.cadence)t.cadence=cadenceFor(t,"weekly");
      });
    }
  });
  Object.keys(interest).forEach(gid=>interest[gid]=interest[gid].slice(0,40));
  return {version:3,updatedAt:String(src.updatedAt||base.updatedAt||""),tierPolicy:{...POLICY,...(src.tierPolicy||{})},games,schedule:base.schedule||{},weekly:base.weekly||{},interest};
};

const baseCreateDraftGame=createGameQuestDraftGame;
createGameQuestDraftGame=function(){return {...baseCreateDraftGame(),tier:3}};

buildGameQuestDailyByGame=function(cfg){
  const map={};(cfg?.games||[]).forEach(g=>map[g.id]=[]);
  [1,2,3,4,5,6,0].forEach(d=>{
    const day=cfg?.schedule?.[String(d)]||{};
    (cfg?.games||[]).forEach(g=>{
      if(gameTier(g)===3)return;
      normalizeGameQuestTaskList(day[g.id],"scheduled").forEach(t=>{
        if(t.plan_mode==="weekly")return;
        const sig=`${t.id||""}|${t.title}`.toLowerCase();
        let x=map[g.id].find(a=>`${a.id||""}|${a.title}`.toLowerCase()===sig);
        if(!x){x={id:t.id,title:t.title,url:t.url||"",note:t.note||"",required:requiredFor(t,g,"daily"),cadence:cadenceFor(t,"daily"),days:[]};map[g.id].push(x)}
        if(!x.days.includes(d))x.days.push(d);
      });
    });
  });
  Object.values(map).forEach(list=>list.forEach(t=>t.days.sort((a,b)=>gameQuestDaySortValue(a)-gameQuestDaySortValue(b))));
  return map;
};
applyDailyByGameToSchedule=function(cfg){
  const schedule={};[1,2,3,4,5,6,0].forEach(d=>schedule[String(d)]={});
  (cfg.games||[]).forEach(g=>{
    if(gameTier(g)===3)return;
    (cfg.dailyByGame?.[g.id]||[]).forEach(t=>{
      const title=String(t.title||"").trim(),days=Array.isArray(t.days)?[...new Set(t.days.map(Number))].filter(d=>[0,1,2,3,4,5,6].includes(d)):[];
      if(!title||!days.length)return;
      const mode=days.length>=7?"daily":"scheduled";
      days.forEach(d=>{
        const k=String(d);if(!schedule[k][g.id])schedule[k][g.id]=[];
        const o={id:t.id,title,url:normalizeFitnessUrl(t.url||""),plan_mode:mode,required:t.required!==false,cadence:String(t.cadence||mode)};
        if(t.note)o.note=String(t.note).trim();
        schedule[k][g.id].push(o);
      });
    });
  });
  cfg.schedule=schedule;
};

const baseWeeklyEditorTasksFor=gameQuestWeeklyEditorTasksFor;
gameQuestWeeklyEditorTasksFor=function(gid,cfg=gameQuestDraftConfig){
  const g=cfg?.games?.find(x=>String(x.id)===String(gid));
  return baseWeeklyEditorTasksFor(gid,cfg).map((t,i)=>{
    const raw=cfg?.weekly?.[gid]?.[i];
    return {...t,required:requiredFor(t,g,"weekly"),cadence:String(raw?.cadence||"weekly")};
  });
};
const baseDailyRow=gameQuestDailyRowHtml,baseWeeklyRow=gameQuestWeeklyRowHtml;
gameQuestDailyRowHtml=function(gid,t,i,n){
  return baseDailyRow(gid,t,i,n).replace('<div class="gqDailyRowOps">',`<label class="gqObligationToggle"><input class="gqTaskRequired" type="checkbox" ${t.required!==false?"checked":""}><span>计入核心完成率</span></label><div class="gqDailyRowOps">`);
};
gameQuestWeeklyRowHtml=function(gid,t,i,n){
  const g=gameQuestDraftConfig?.games?.find(x=>String(x.id)===String(gid));
  const core=gameTier(g)===1;
  return baseWeeklyRow(gid,t,i,n).replace('<div class="gqDailyRowOps">',`<label class="gqObligationToggle fixed"><input class="gqTaskRequired" type="checkbox" ${core?"checked":""} disabled><span>${core?"T1｜计入核心":"T2｜可做收益"}</span></label><div class="gqDailyRowOps">`);
};

function interestRows(cfg){
  return (cfg.games||[]).filter(g=>g.enabled!==false&&gameTier(g)===3).map(g=>{
    const items=cfg.interest?.[g.id]||[];
    const rows=items.length?items.map((t,i)=>`<div class="gqInterestEditRow" data-gq-interest-row="${i}" data-gq-task-id="${escapeHtml(t.id||"")}"><div class="gqTaskFields"><label><span>兴趣项目</span><input class="gqInterestTaskTitle" value="${escapeHtml(t.title||"")}" placeholder="例如：斗技 / 活动剧情 / 清图"></label><label><span>链接（选填）</span><input class="gqInterestTaskUrl" type="url" value="${escapeHtml(t.url||"")}"></label><label class="gqTaskNoteField"><span>备注（选填）</span><textarea class="gqInterestTaskNote" rows="2">${escapeHtml(t.note||"")}</textarea></label><label><span>原始频率</span><select class="gqInterestCadence"><option value="interest" ${t.cadence==="interest"?"selected":""}>随兴趣</option><option value="daily" ${t.cadence==="daily"?"selected":""}>原日常</option><option value="weekly" ${t.cadence==="weekly"?"selected":""}>原周常/周期</option></select></label></div><button type="button" class="gqDailyMiniBtn danger" data-gq-interest-delete="${i}" data-gq-game="${escapeHtml(g.id)}">✕</button></div>`).join(""):`<div class="gqDailyEmpty">还没有兴趣项目。</div>`;
    return `<div class="gameQuestEditRow gameQuestEditRowV2 gqInterestEditGame" data-gq-interest-game="${escapeHtml(g.id)}"><div class="gameQuestEditGame"><span>${escapeHtml(g.icon)}</span><b>${escapeHtml(g.name)}</b><em>T3 兴趣池 · ${items.length} 项</em><button type="button" class="gqDailyAddBtn" data-gq-interest-add="${escapeHtml(g.id)}">＋ 项目</button></div><div class="gqInterestRows">${rows}</div></div>`;
  }).join("")||`<div class="gqDailyEmpty">当前没有 T3 游戏。</div>`;
}
function enhanceEditor(){
  const cfg=gameQuestDraftConfig,root=document.getElementById("gameQuestEditorList");if(!cfg||!root)return;
  (cfg.games||[]).forEach(g=>{
    const row=root.querySelector(`[data-gq-game-row="${safeCssEscape(g.id)}"]`);
    if(row&&!row.querySelector(".gqMetaTier")){
      const x=document.createElement("div");x.className="gqMetaField tier";x.innerHTML=`<label>梯度</label><select class="gqMetaTier"><option value="1" ${gameTier(g)===1?"selected":""}>T1｜全勤・全清</option><option value="2" ${gameTier(g)===2?"selected":""}>T2｜全勤・非全清</option><option value="3" ${gameTier(g)===3?"selected":""}>T3｜兴趣制</option></select>`;
      row.querySelector(".gqMetaField.accent")?.insertAdjacentElement("afterend",x);
    }
    if(gameTier(g)===3){
      root.querySelector(`[data-gq-daily-game="${safeCssEscape(g.id)}"]`)?.remove();
      root.querySelector(`[data-gq-weekly-edit-game="${safeCssEscape(g.id)}"]`)?.remove();
    }
  });
  if(!root.querySelector(".gameQuestInterestGroup")){
    const s=document.createElement("section");s.className="gameQuestEditGroup gameQuestInterestGroup";s.innerHTML=`<div class="gameQuestEditHead"><div><b>T3 兴趣池</b><span>不进今日清理，不产生逾期/遗留，不影响核心完成率；以后新增游戏默认 T3。</span></div></div><div class="gameQuestInterestBody">${interestRows(cfg)}</div>`;
    root.querySelector(".gameQuestMetaDetails")?.insertAdjacentElement("beforebegin",s);
  }
}
const baseRenderEditor=renderGameQuestEditor;
renderGameQuestEditor=function(){const r=baseRenderEditor();enhanceEditor();return r};

const baseCollect=collectGameQuestEditorState;
collectGameQuestEditorState=function(){
  if(!gameQuestDraftConfig)return;
  const root=document.getElementById("gameQuestEditorList"),tiers={},dreq={},wreq={},interest={};
  root?.querySelectorAll("[data-gq-game-row]").forEach(row=>tiers[row.dataset.gqGameRow]=tier(row.querySelector(".gqMetaTier")?.value,3));
  root?.querySelectorAll("[data-gq-daily-game]").forEach(card=>dreq[card.dataset.gqDailyGame]=[...card.querySelectorAll("[data-gq-daily-row]")].map(r=>r.querySelector(".gqTaskRequired")?.checked!==false));
  root?.querySelectorAll("[data-gq-weekly-edit-game]").forEach(card=>wreq[card.dataset.gqWeeklyEditGame]=[...card.querySelectorAll("[data-gq-weekly-row]")].map(r=>r.querySelector(".gqTaskRequired")?.checked===true));
  root?.querySelectorAll("[data-gq-interest-game]").forEach(card=>interest[card.dataset.gqInterestGame]=[...card.querySelectorAll("[data-gq-interest-row]")].map(r=>({id:r.dataset.gqTaskId||"",title:r.querySelector(".gqInterestTaskTitle")?.value.trim()||"",url:r.querySelector(".gqInterestTaskUrl")?.value.trim()||"",note:r.querySelector(".gqInterestTaskNote")?.value.trim()||"",cadence:r.querySelector(".gqInterestCadence")?.value||"interest",plan_mode:"interest",required:false})).filter(t=>t.title));
  baseCollect();
  (gameQuestDraftConfig.games||[]).forEach(g=>g.tier=tiers[g.id]||gameTier(g));
  Object.entries(dreq).forEach(([gid,a])=>(gameQuestDraftConfig.dailyByGame?.[gid]||[]).forEach((t,i)=>t.required=a[i]!==false));
  Object.entries(wreq).forEach(([gid])=>{
    const g=gameQuestDraftConfig.games?.find(x=>String(x.id)===String(gid));
    (gameQuestDraftConfig.weekly?.[gid]||[]).forEach(t=>{t.required=gameTier(g)===1;t.cadence=t.cadence||"weekly"});
  });
  if(!gameQuestDraftConfig.interest)gameQuestDraftConfig.interest={};
  Object.entries(interest).forEach(([gid,a])=>gameQuestDraftConfig.interest[gid]=a);
  (gameQuestDraftConfig.games||[]).filter(g=>gameTier(g)===3).forEach(g=>{if(gameQuestDraftConfig.dailyByGame)gameQuestDraftConfig.dailyByGame[g.id]=[];if(gameQuestDraftConfig.weekly)gameQuestDraftConfig.weekly[g.id]=[];gameQuestDraftConfig.interest[g.id]??=[]});
  applyDailyByGameToSchedule(gameQuestDraftConfig);
};
const baseRemoveGame=removeGameQuestGame;
removeGameQuestGame=function(id){baseRemoveGame(id);if(gameQuestDraftConfig?.interest)delete gameQuestDraftConfig.interest[id]};

document.addEventListener("click",e=>{
  const add=e.target.closest?.("[data-gq-interest-add]");
  if(add){e.preventDefault();e.stopPropagation();collectGameQuestEditorState();const gid=add.dataset.gqInterestAdd;gameQuestDraftConfig.interest??={};gameQuestDraftConfig.interest[gid]??=[];gameQuestDraftConfig.interest[gid].push({id:"",title:"",url:"",note:"",cadence:"interest",plan_mode:"interest",required:false});renderGameQuestEditor();return}
  const del=e.target.closest?.("[data-gq-interest-delete]");
  if(del){e.preventDefault();e.stopPropagation();collectGameQuestEditorState();gameQuestDraftConfig.interest?.[del.dataset.gqGame]?.splice(Number(del.dataset.gqInterestDelete),1);renderGameQuestEditor()}
},true);

isGameQuestItemDone=(gid,did,iid,cycle=cycleYmd)=>localStorage.getItem(gameQuestItemKey(gid,did,iid,cycle))==="1";
isGameQuestWeeklyItemDone=(gid,iid,cycle=cycleYmd)=>localStorage.getItem(gameQuestWeeklyItemKey(gid,iid,cycle))==="1";
const interestKey=(gid,iid,cycle=cycleYmd)=>`${GH_PREFIX}${cycle}_gqii_${gid}_${iid}`;
const interestDone=(gid,iid,cycle=cycleYmd)=>localStorage.getItem(interestKey(gid,iid,cycle))==="1";
function setInterest(gid,iid,val,el,cycle=cycleYmd){syncSetItem(interestKey(gid,iid,cycle),val);if(val&&el)playCompletionEffect({level:"micro",category:"gamecreate",anchor:el,title:"兴趣项目完成",eventId:`gqi:${cycle}:${gid}:${iid}`});renderAll()}

function dailyState(gid,did,cfg=gameQuestConfig,cycle=cycleYmd){
  const g=cfg?.games?.find(x=>String(x.id)===String(gid)),tasks=gameQuestTaskObjectsFor(gid,did,cfg),req=tasks.filter(t=>requiredFor(t,g,"daily")),opt=tasks.filter(t=>!requiredFor(t,g,"daily"));
  const rd=req.filter(t=>isGameQuestItemDone(gid,did,t.id,cycle)).length,od=opt.filter(t=>isGameQuestItemDone(gid,did,t.id,cycle)).length;
  return {tasks,required:req,optional:opt,requiredDone:rd,requiredTotal:req.length,optionalDone:od,optionalTotal:opt.length,done:rd,total:req.length,cardDone:req.length===0||rd>=req.length};
}
function weeklyState(gid,cfg=gameQuestConfig,cycle=cycleYmd){
  const g=cfg?.games?.find(x=>String(x.id)===String(gid)),tasks=gameQuestWeeklyTasksFor(gid,cfg),req=tasks.filter(t=>requiredFor(t,g,"weekly")),opt=tasks.filter(t=>!requiredFor(t,g,"weekly"));
  const rd=req.filter(t=>isGameQuestWeeklyItemDone(gid,t.id,cycle)).length,od=opt.filter(t=>isGameQuestWeeklyItemDone(gid,t.id,cycle)).length;
  return {tasks,required:req,optional:opt,requiredDone:rd,requiredTotal:req.length,optionalDone:od,optionalTotal:opt.length,done:rd,total:req.length,cardDone:req.length===0||rd>=req.length};
}
gameQuestEntryState=dailyState;gameQuestWeeklyEntryState=weeklyState;
gameQuestEntriesForDay=function(d,cfg=gameQuestConfig){return enabledGameQuestGames(cfg).filter(g=>gameTier(g)<=2).map(g=>({game:g,...dailyState(g.id,d,cfg)})).filter(e=>e.tasks.length)};
gameQuestWeeklyEntries=function(cfg=gameQuestConfig){return enabledGameQuestGames(cfg).filter(g=>gameTier(g)<=2).map(g=>({game:g,...weeklyState(g.id,cfg)})).filter(e=>e.tasks.length)};
function interestEntries(cfg=gameQuestConfig){return enabledGameQuestGames(cfg).filter(g=>gameTier(g)===3).map(g=>{const tasks=normalizeGameQuestTaskList(cfg?.interest?.[g.id]||[],"scheduled").map(t=>({...t,plan_mode:"interest",required:false}));return {game:g,tasks,done:tasks.filter(t=>interestDone(g.id,t.id)).length,total:tasks.length}}).filter(e=>e.tasks.length)}
gameQuestStats=function(d){const e=gameQuestEntriesForDay(d),total=e.reduce((s,x)=>s+x.requiredTotal,0),done=e.reduce((s,x)=>s+x.requiredDone,0),ot=e.reduce((s,x)=>s+x.optionalTotal,0),od=e.reduce((s,x)=>s+x.optionalDone,0);return {total,done,pct:total?Math.round(done/total*100):100,cards:e.filter(x=>x.requiredTotal).length,cardsDone:e.filter(x=>x.requiredTotal&&x.cardDone).length,optionalTotal:ot,optionalDone:od}};
gameQuestWeeklyStats=function(){const e=gameQuestWeeklyEntries(),total=e.reduce((s,x)=>s+x.requiredTotal,0),done=e.reduce((s,x)=>s+x.requiredDone,0),ot=e.reduce((s,x)=>s+x.optionalTotal,0),od=e.reduce((s,x)=>s+x.optionalDone,0);return {total,done,pct:total?Math.round(done/total*100):100,cards:e.filter(x=>x.requiredTotal).length,cardsDone:e.filter(x=>x.requiredTotal&&x.cardDone).length,optionalTotal:ot,optionalDone:od}};
gameQuestWeekStats=function(){let total=0,done=0;days.forEach(d=>{const s=gameQuestStats(d.id);total+=s.total;done+=s.done});return {total,done,pct:total?Math.round(done/total*100):100}};

setGameQuestItemDone=function(gid,did,iid,val,el,cycle=cycleYmd){syncSetItem(gameQuestItemKey(gid,did,iid,cycle),val);if(val&&el){const g=gameQuestConfig.games.find(x=>String(x.id)===String(gid)),s=dailyState(gid,did,gameQuestConfig,cycle);playCompletionEffect({level:s.cardDone?"parent":"micro",category:"gamecreate",anchor:el,title:s.cardDone?`${g?.name||"游戏"} 今日核心完成`:"游戏项目完成",eventId:`gq:${cycle}:${gid}:d${did}:${iid}`})}renderAll()};
setGameQuestWeeklyItemDone=function(gid,iid,val,el,cycle=cycleYmd){syncSetItem(gameQuestWeeklyItemKey(gid,iid,cycle),val);if(val&&el){const g=gameQuestConfig.games.find(x=>String(x.id)===String(gid)),s=weeklyState(gid,gameQuestConfig,cycle);playCompletionEffect({level:s.cardDone&&s.requiredTotal?"parent":"micro",category:"gamecreate",anchor:el,title:s.cardDone&&s.requiredTotal?`${g?.name||"游戏"} 周期核心完成`:"游戏周期项目完成",eventId:`gqw:${cycle}:${gid}:${iid}`})}renderAll()};
setGameQuestDone=function(gid,did,val,el,cycle=cycleYmd){const g=gameQuestConfig.games.find(x=>String(x.id)===String(gid)),s=dailyState(gid,did,gameQuestConfig,cycle);s.required.forEach(t=>syncSetItem(gameQuestItemKey(gid,did,t.id,cycle),val));syncSetItem(gameQuestDoneKey(gid,did,cycle),false);if(val&&el)playCompletionEffect({level:"parent",category:"gamecreate",anchor:el,title:`${g?.name||"游戏"} 今日核心完成`,eventId:`gq-card:${cycle}:${gid}:d${did}`});renderAll()};
completeGameQuestDay=function(d,el,cycle=cycleYmd){const entries=gameQuestEntriesForDay(Number(d),gameQuestConfig),rem=entries.reduce((s,e)=>s+(e.requiredTotal-e.requiredDone),0);if(!rem){showToast("这一天的核心游戏任务已经完成","ok");return}entries.forEach(e=>e.required.forEach(t=>syncSetItem(gameQuestItemKey(e.game.id,Number(d),t.id,cycle),true)));showToast(`已完成 ${rem} 项核心任务；选做项不会被自动勾选。`,"ok");renderAll()};
setGameQuestWeeklyDone=function(gid,val,el,cycle=cycleYmd){const g=gameQuestConfig.games.find(x=>String(x.id)===String(gid)),s=weeklyState(gid,gameQuestConfig,cycle);s.required.forEach(t=>syncSetItem(gameQuestWeeklyItemKey(gid,t.id,cycle),val));syncSetItem(gameQuestWeeklyDoneKey(gid,cycle),false);if(val&&el&&s.requiredTotal)playCompletionEffect({level:"parent",category:"gamecreate",anchor:el,title:`${g?.name||"游戏"} 周期核心完成`,eventId:`gqw-card:${cycle}:${gid}`});renderAll()};

function tBadge(g){return `<span class="gqTierBadge t${gameTier(g)}">${TIERS[gameTier(g)].short}｜${TIERS[gameTier(g)].name}</span>`}
function note(t){const n=String(t.note||"").trim();return n?`<details class="gameQuestTaskNote"><summary>备注</summary><div class="gameQuestTaskNoteBody">${escapeHtml(n)}</div></details>`:""}
function interestCadence(t){
  const c=String(t?.cadence||"interest").trim().toLowerCase();
  return c==="daily"?"daily":c==="weekly"?"weekly":"interest";
}
function interestCadenceMeta(c){
  if(c==="daily")return {code:"D",label:"每日类",sub:"按日频率整理，但不形成日课债务",badge:"日"};
  if(c==="weekly")return {code:"W",label:"每周 / 周期类",sub:"按周或周期整理，但不形成周债务",badge:"周"};
  return {code:"★",label:"随兴趣",sub:"没有固定频率，想玩时再做",badge:"随"};
}
function taskList(g,tasks,pool,did){
  return `<ul class="gameQuestTaskList gameQuestTaskListV2 ${pool}">${tasks.map((t,i)=>{
    const isInterest=pool==="interest",cadence=isInterest?interestCadence(t):"",done=isInterest?interestDone(g.id,t.id):pool==="daily"?isGameQuestItemDone(g.id,did,t.id):isGameQuestWeeklyItemDone(g.id,t.id),url=safeUrl(t.url),req=!isInterest&&requiredFor(t,g,pool);
    const attrs=isInterest?`data-gq-interest-item="1" data-gq-interest-game="${escapeHtml(g.id)}" data-gq-interest-id="${escapeHtml(t.id)}"`:pool==="daily"?`data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(g.id)}" data-gamequest-item-day="${did}" data-gamequest-item="${escapeHtml(t.id)}"`:`data-gq-weekly-item-btn="1" data-gamequest-weekly-game="${escapeHtml(g.id)}" data-gamequest-weekly-item="${escapeHtml(t.id)}"`;
    const meta=isInterest?interestCadenceMeta(cadence):null,badge=isInterest?meta.badge:(req?"必":"选");
    const cadenceClass=isInterest?` interest cadence-${cadence}`:"";
    const cadenceTitle=isInterest?` title="${escapeHtml(meta.label)}｜${escapeHtml(meta.sub)}"`:"";
    return `<li class="${done?"done ":""}${isInterest?`interestTask cadence-${cadence}`:""}"><div class="gameQuestTaskRow"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""} ${req?"required":"optional"}${cadenceClass}" ${attrs} data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(i+1).padStart(2,"0")}</span><span class="gameQuestMiniBox"></span><i>${escapeHtml(t.title)}</i><span class="gameQuestTaskBadge ${req?"required":"optional"}${cadenceClass}"${cadenceTitle}>${badge}</span></button>${url?`<a class="gameQuestTaskOpen" href="${url}" target="_blank" rel="noopener noreferrer">打开 ↗</a>`:""}</div>${note(t)}</li>`;
  }).join("")}</ul>`;
}
function interestCadenceGroup(g,tasks,cadence){
  if(!tasks.length)return "";
  const meta=interestCadenceMeta(cadence),done=tasks.filter(t=>interestDone(g.id,t.id)).length;
  return `<section class="gqInterestCadenceGroup ${cadence}"><header class="gqInterestCadenceHead"><span class="gqInterestCadenceGlyph" aria-hidden="true">${meta.code}</span><div><b>${meta.label}</b><em>${meta.sub}</em></div><strong>${done}/${tasks.length}</strong></header>${taskList(g,tasks,"interest",null)}</section>`;
}
function interestCard(e){
  const g=e.game,pct=e.total?Math.round(e.done/e.total*100):0;
  const daily=e.tasks.filter(t=>interestCadence(t)==="daily"),weekly=e.tasks.filter(t=>interestCadence(t)==="weekly"),free=e.tasks.filter(t=>interestCadence(t)==="interest");
  const dDone=daily.filter(t=>interestDone(g.id,t.id)).length,wDone=weekly.filter(t=>interestDone(g.id,t.id)).length,fDone=free.filter(t=>interestDone(g.id,t.id)).length;
  const split=[daily.length?`日 ${dDone}/${daily.length}`:"",weekly.length?`周 ${wDone}/${weekly.length}`:"",free.length?`随 ${fDone}/${free.length}`:""].filter(Boolean).join(" · ");
  return `<article class="gameQuestCard tier-3 gqInterestCard" style="--gq-p:${pct}%"><div class="gameQuestCardTop"><span class="gameQuestCheck passive interestMark"><span>★</span></span><span class="gameQuestIcon">${escapeHtml(String(g.short||g.name).slice(0,1))}</span><div class="gameQuestNameWrap"><span class="gameQuestName">${escapeHtml(g.name)} ${tBadge(g)}</span><span class="gameQuestShort">${split||"暂无分类"}｜全部不影响完成率</span></div><span class="gameQuestCount">${e.done}/${e.total}</span></div><div class="gameQuestProgressRail"><span></span></div><div class="gqInterestCadenceStack">${interestCadenceGroup(g,daily,"daily")}${interestCadenceGroup(g,weekly,"weekly")}${interestCadenceGroup(g,free,"interest")}</div></article>`;
}
function coreCard(e,did,pool){
  const g=e.game,pct=e.requiredTotal?Math.round(e.requiredDone/e.requiredTotal*100):100,done=e.requiredTotal===0||e.requiredDone>=e.requiredTotal;
  const bulk=e.requiredTotal?`<button type="button" class="gameQuestCheck ${done?"done":""}" ${pool==="daily"?`data-gq-card-btn="1" data-gamequest-game="${escapeHtml(g.id)}" data-gamequest-day="${did}"`:`data-gq-weekly-card-btn="1" data-gamequest-weekly-game="${escapeHtml(g.id)}"`} data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span></span></button>`:`<span class="gameQuestCheck passive"><span></span></span>`;
  return `<article class="gameQuestCard gameQuestCardV2 tier-${gameTier(g)} ${done&&e.requiredTotal?"done":""}" style="--gq-p:${pct}%"><div class="gameQuestCardTop">${bulk}<span class="gameQuestIcon">${escapeHtml(String(g.short||g.name).slice(0,1))}</span><div class="gameQuestNameWrap"><span class="gameQuestName">${escapeHtml(g.name)} ${tBadge(g)}</span><span class="gameQuestShort">${e.requiredTotal?"核心看必做项；选做不拉低完成率":"本区全部为可做收益"}</span></div><span class="gameQuestCount">${e.requiredDone}/${e.requiredTotal}${e.optionalTotal?` · 选 ${e.optionalDone}/${e.optionalTotal}`:""}</span></div><div class="gameQuestProgressRail"><span></span></div>${taskList(g,e.tasks,pool,did)}</article>`;
}
function lane(title,sub,entries,renderer,cls){return entries.length?`<section class="gqTierLane ${cls}"><header><div><b>${title}</b><span>${sub}</span></div><em>${entries.length} GAME${entries.length>1?"S":""}</em></header><div class="gameQuestGrid">${entries.map(renderer).join("")}</div></section>`:""}

setGameQuestBoardMode=function(m){gameQuestBoardMode=["today","week","interest"].includes(m)?m:"today";localStorage.setItem(GQ_BOARD_MODE_KEY,gameQuestBoardMode);renderGameQuestPanel()};
renderGameQuestPanel=function(){
  const panel=document.getElementById("gameQuestPanel");if(!panel)return;
  const ds=gameQuestStats(gameQuestSelectedDay),ws=gameQuestWeeklyStats(),ints=interestEntries(),idone=ints.reduce((s,e)=>s+e.done,0),itotal=ints.reduce((s,e)=>s+e.total,0);
  const display=gameQuestBoardMode==="week"?ws:gameQuestBoardMode==="interest"?{done:idone,total:itotal,pct:itotal?Math.round(idone/itotal*100):0}:ds;
  const mode=`<div class="gameQuestModeTabs tiered"><button class="gameQuestModeBtn ${gameQuestBoardMode==="today"?"active":""}" data-gamequest-board-mode="today"><span>今日作战</span><b>${gameQuestStats(today).done}/${gameQuestStats(today).total}</b></button><button class="gameQuestModeBtn ${gameQuestBoardMode==="week"?"active":""}" data-gamequest-board-mode="week"><span>周期作战</span><b>${ws.done}/${ws.total}</b></button><button class="gameQuestModeBtn ${gameQuestBoardMode==="interest"?"active":""}" data-gamequest-board-mode="interest"><span>兴趣池</span><b>${idone}/${itotal}</b></button></div>`;
  const gqWeekMinutes=taskWeekMinutesUsed("gamequest-board");
  const active=readActiveTimer();
  const gqActive=active&&active.kind==="gamequest";
  const gqTimerLabel=gqActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时";
  const gqTimerSub=gqActive?(active.paused?"已暂停":"游戏计时中"):`本周 ${fmtMinutes(gqWeekMinutes)}`;
  const top=`<div class="gameQuestTopBar"><div class="gameQuestTopTitle"><span>GAME QUEST / TIER OPS</span><strong>游戏作战区</strong><em>T1 全勤全清 · T2 全勤非全清 · T3 兴趣制。核心完成率只计算“必”。</em></div><div class="gameQuestHeroSide"><div class="gameQuestTopMeter"><span class="gameQuestMiniRing" style="--p:${display.pct}%"><i>${display.pct}%</i></span><span class="gameCommandCopy"><small>CORE</small><b>${display.done}/${display.total}</b><em>${gameQuestBoardMode==="interest"?"仅记录兴趣":"核心完成率"}</em></span></div><button class="gameCommandBtn gameQuestTodayQuick" id="gameQuestTodayBtn"><span class="gameCommandIcon">◎</span><span class="gameCommandCopy"><small>TODAY</small><b>今日</b><em>回到今天</em></span></button><button type="button" class="gameQuestTopTimer ${gqActive?"active":""}" data-timer-start-gamequest="1" data-gamequest-day="${gameQuestSelectedDay}" data-cycle="${escapeHtml(cycleYmd)}" title="把整个游戏作战区作为一个整体记录时间"><span class="gameCommandIcon">${gqActive?(active.paused?"Ⅱ":"◷"):"◷"}</span><span class="gameCommandCopy"><small>TIMER</small><b ${gqActive?"data-live-timer":""}>${gqTimerLabel}</b><em>${gqTimerSub}</em></span></button><button type="button" class="gameCommandBtn gameQuestTopManual" data-manual-time-entry="gamequest"><span class="gameCommandIcon">＋</span><span class="gameCommandCopy"><small>MANUAL</small><b>补记</b><em>游戏时间</em></span></button><button class="gameCommandBtn gameQuestEditQuick" data-open-game-editor><span class="gameCommandIcon">✎</span><span class="gameCommandCopy"><small>QUEST</small><b>编辑任务</b><em>梯度 / 日常 / 周期 / 兴趣</em></span></button></div></div>`;
  let body="";
  if(gameQuestBoardMode==="today"){
    const e=gameQuestEntriesForDay(gameQuestSelectedDay),t1=e.filter(x=>gameTier(x.game)===1),t2=e.filter(x=>gameTier(x.game)===2);
    body=`<div class="gameQuestDailyPane tiered"><div class="gameQuestMetaStrip"><span>今日只出现 T1 + T2；T3 永不形成日课债务。</span><em>${ds.pct}% CORE DAILY</em></div><div class="gameQuestDays">${gameQuestDayTabsHtml()}</div><div class="gameQuestSubHead"><span>${escapeHtml(dayName(gameQuestSelectedDay))}${gameQuestSelectedDay===today?"｜今日":""}</span>${gameQuestCompleteDayButtonHtml(gameQuestSelectedDay,ds)}<div class="gameQuestMetricSet"><span class="gameQuestMetric"><strong>${ds.done}/${ds.total}</strong><em>核心</em></span><span class="gameQuestMetric"><strong>${ds.optionalDone}/${ds.optionalTotal}</strong><em>选做</em></span></div></div>${lane("T1｜全勤・全清","每日必须完成。",t1,x=>coreCard(x,gameQuestSelectedDay,"daily"),"tier1")}${lane("T2｜全勤・非全清","只保全勤/基础日课，额外收益不形成债务。",t2,x=>coreCard(x,gameQuestSelectedDay,"daily"),"tier2")}</div>`;
  }else if(gameQuestBoardMode==="week"){
    const e=gameQuestWeeklyEntries(),t1=e.filter(x=>gameTier(x.game)===1),t2=e.filter(x=>gameTier(x.game)===2);
    body=`<div class="gameQuestWeeklyPane tiered"><div class="gameQuestMetaStrip"><span>T1 必须清完；T2 全部作为可做收益，不拉低核心完成率。</span><em>${ws.pct}% CORE CYCLE</em></div>${lane("T1｜必须清完","周常 / 高难 / 赛季奖励入口。",t1,x=>coreCard(x,null,"weekly"),"tier1")}${lane("T2｜可做收益","看时间和收益决定做多少。",t2,x=>coreCard(x,null,"weekly"),"tier2")}</div>`;
  }else{
    body=`<div class="gameQuestInterestPane"><div class="gameQuestMetaStrip"><span>T3｜兴趣制：无全勤、无逾期、无 carryover。每日类与每周/周期类只做视觉分类，不产生债务。</span><em>NO DEBT</em></div><div class="gameQuestGrid">${ints.map(e=>interestCard(e)).join("")||`<div class="gameQuestEmpty"><b>兴趣池为空。</b></div>`}</div></div>`;
  }
  panel.innerHTML=`<div class="gameQuestShell gameQuestTierV3">${top}${mode}${body}</div>`;
};
document.addEventListener("click",e=>{const b=e.target.closest?.("[data-gq-interest-item]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();setInterest(b.dataset.gqInterestGame,b.dataset.gqInterestId,b.getAttribute("aria-pressed")!=="true",b,b.dataset.cycle||cycleYmd)},true);

try{
  const current=typeof loadLocalTaskConfig==="function"?(loadLocalTaskConfig()||taskConfig):taskConfig;
  if(current){const upgraded=normalizeTaskConfig({...current,gameQuest:normalizeGameQuestConfig(current.gameQuest||gameQuestConfig||defaultGameQuestConfig)});applyTaskConfig(upgraded,false)}
  else if(gameQuestConfig)gameQuestConfig=normalizeGameQuestConfig(gameQuestConfig);
}catch(err){console.warn("GameQuest tier v3 rehydrate skipped",err)}
renderGameQuestPanel();
})();