// Main runtime extracted from the old single-file index.html.
// Keep business logic here; keep default data in assets/js/data/default-data.js.

/* days moved to assets/js/data/default-data.js */


/* defaultBlocks moved to assets/js/data/default-data.js */


/* defaultStepTasks moved to assets/js/data/default-data.js */

/* === v8.2 Task Config Engine === */
let taskConfig=null;
let blocks=[];
let stepTasks={};
let refGroups=[];
let gameQuestConfig=null;
const CONFIG_FILE="taskring-config.json"; // v8.5 encrypted cloud config
const TASK_CONFIG_LOCAL_KEY="taskring_local_config_v1";
const TASK_CONFIG_BACKUP_KEY="taskring_local_config_backups_v1";
const TASK_CONFIG_BACKUP_LIMIT=10;
const DEMO_CORE_CLEANUP_KEY="taskring_cleanup_accidental_demo_core_v1";
const ACCIDENTAL_DEMO_CORE_IDS=new Set(["demo-morning-start","demo-game-daily"]);

function deepClone(obj){return JSON.parse(JSON.stringify(obj))}
function normalizeBool(v){return v===true||v===1||v==="1"||v==="true"}
function nextCode(prefix, used){
  let max=0;
  used.forEach(c=>{
    const m=String(c||"").match(new RegExp("^"+prefix+"(\\d+)$"));
    if(m)max=Math.max(max,Number(m[1]));
  });
  return prefix+String(max+1).padStart(prefix==="t"?3:2,"0");
}
function stableHashPart(s){
  const raw=String(s||"");
  let h=2166136261;
  for(let i=0;i<raw.length;i++){
    h^=raw.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return (h>>>0).toString(36);
}
function slugifyId(s, fallback="custom"){
  const raw=String(s||"").trim().toLowerCase();
  const ascii=raw.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,42);
  return ascii||`${fallback}-${stableHashPart(raw||fallback)}`;
}


/* === v11.0 Time Budget / Focus Timer helpers === */
const timeCategoryDefs={
  game:{name:"游戏",short:"游戏",icon:"游",budget:720},
  language:{name:"语言",short:"语言",icon:"语",budget:360},
  it_ai:{name:"IT / AI",short:"IT",icon:"IT",budget:360},
  science:{name:"自然科学",short:"科学",icon:"科",budget:180},
  creator:{name:"创作 / 数据库",short:"创作",icon:"创",budget:240},
  body:{name:"身体 / 生活维护",short:"身体",icon:"身",budget:180},
  economy:{name:"经济 / 资产",short:"经济",icon:"经",budget:240},
  life:{name:"生活杂务",short:"生活",icon:"生",budget:180}
};
const timeCategoryOrder=["game","language","it_ai","science","creator","body","economy","life"];
function normalizeTimeCategory(v,fallback="life"){
  const key=String(v||"").trim();
  return timeCategoryDefs[key]?key:fallback;
}
function inferTaskTimeCategory(raw){
  const explicit=raw.time_category||raw.timeCategory;
  if(explicit)return normalizeTimeCategory(explicit,"life");
  const id=String(raw.id||"").toLowerCase();
  const title=String(raw.title||"").toLowerCase();
  const hay=`${id} ${title}`;
  if(/econ|finance|money|asset|budget|portfolio|invest|经济|經濟|资产|資産|理财|財務|财务|家計|记账|账本|预算|消费|收入|支出|储蓄|策略管理/.test(hay))return "economy";
  if(/base-body|体育|睡眠|护肤|姿|体食|body|sport|skincare|sleep/.test(hay))return "body";
  if(/french|française|francaise|english|japanese|spanish|italian|italiano|italiana|italien|italienne|español|espanol|日本語|语言|語言|langue/.test(hay))return "language";
  if(/(^|[^a-z])it([^a-z]|$)|(^|[^a-z])ai([^a-z]|$)|tech|技术|supabase|github|lambda|code|task\(g\/u\)/.test(hay))return "it_ai";
  if(/math|science|数学|自然科学|物理|化学|生物/.test(hay))return "science";
  if(/creator|create|video|创作|资讯整理|analyze|database|数据库|攻略|整理/.test(hay))return "creator";
  if(/game|鸣潮|绝区零|崩铁|星穹|异环|终末地|周常|日常|深塔|式舆|危局|鏖战|模拟宇宙|二游/.test(hay))return "game";
  if(raw.cat==="gamecreate")return "creator";
  if(raw.cat==="language")return "language";
  return "life";
}
function inferEstimatedMinutes(raw){
  const explicit=Number(raw.estimated_minutes??raw.estimatedMinutes??raw.estimateMinutes);
  if(Number.isFinite(explicit)&&explicit>0)return Math.min(480,Math.max(1,Math.round(explicit)));
  const cat=inferTaskTimeCategory(raw);
  const title=String(raw.title||"").toLowerCase();
  if(/日常|daily/.test(title))return 30;
  if(/周常|endgame|深塔|式舆|危局|鏖战|模拟宇宙/.test(title))return 60;
  if(cat==="body")return 20;
  if(cat==="language")return 30;
  if(cat==="it_ai")return 60;
  if(cat==="science")return 30;
  if(cat==="creator")return 60;
  if(cat==="game")return 45;
  if(cat==="economy")return 45;
  return 30;
}
function taskTimeCategory(task){return normalizeTimeCategory(task?.time_category||task?.timeCategory,inferTaskTimeCategory(task||{}))}
function taskEstimatedMinutes(task){return inferEstimatedMinutes(task||{})}
function inferWeeklyMinutes(raw){
  const explicit=Number(raw.weekly_minutes??raw.weeklyMinutes??raw.weeklyTargetMinutes??raw.weekly_budget_minutes);
  if(Number.isFinite(explicit)&&explicit>=0)return Math.min(10080,Math.max(0,Math.round(explicit)));
  const days=Array.isArray(raw.days)?raw.days.length:0;
  const base=taskEstimatedMinutes(raw);
  return Math.min(10080,Math.max(0,Math.round(base*Math.max(1,days||1))));
}
function taskWeeklyMinutes(task){return inferWeeklyMinutes(task||{})}


/* === v16.0 Planning Mode: Daily Ring vs Weekly Pool === */
const taskPlanModeDefs={
  daily:{name:"每日环",short:"每日",hint:"真每日/保底：进入今日执行环，计入今日完成度。"},
  scheduled:{name:"指定日",short:"指定日",hint:"必须安排在某些星期：到日出现，错过后按遗留处理。"},
  weekly:{name:"周计划池",short:"周计划",hint:"不占每日环；按本周目标时间推进，适合语言、IT、科学、创作等弹性任务。"}
};
const taskPlanModeOrder=["daily","scheduled","weekly"];
function normalizeTaskPlanMode(v,fallback="weekly"){
  const key=String(v||"").trim();
  return taskPlanModeDefs[key]?key:fallback;
}
function inferTaskPlanMode(raw){
  const explicit=raw.plan_mode||raw.planMode||raw.planning_mode||raw.planningMode||raw.schedule_mode||raw.scheduleMode;
  if(explicit)return normalizeTaskPlanMode(explicit,"weekly");
  const id=String(raw.id||"").toLowerCase();
  const title=String(raw.title||"").toLowerCase();
  const hay=`${id} ${title}`;
  const days=Array.isArray(raw.days)?raw.days:[];
  if(raw.core||/base-body|game-daily|每日|daily|签到|睡眠|护肤|体食/.test(hay))return "daily";
  if(raw.optional)return "weekly";
  if(raw.cat==="gamecreate"&&!/game-daily/.test(id))return "weekly";
  if(raw.cat==="language")return "weekly";
  if(/语言|french|english|japanese|spanish|it|ai|技术|数学|科学|自然科学|creator|创作|资讯|analyze|database|数据库/.test(hay))return "weekly";
  if(raw.important&&days.length&&days.length<=3)return "scheduled";
  if(days.length===7)return "weekly";
  return "weekly";
}
function taskPlanningMode(task){return normalizeTaskPlanMode(task?.plan_mode||task?.planMode||task?.planning_mode,inferTaskPlanMode(task||{}))}
function isWeeklyPoolTask(task){return taskPlanningMode(task)==="weekly"}
function isRingTask(task){return !isWeeklyPoolTask(task)}
function ringBlocks(){return blocks.filter(t=>isRingTask(t)&&Array.isArray(t.days)&&t.days.length>0)}
function weeklyPoolBlocks(){return blocks.filter(isWeeklyPoolTask)}
function planModeBadgeHtml(t){const mode=taskPlanningMode(t);const def=taskPlanModeDefs[mode]||taskPlanModeDefs.weekly;return `<span class="planModeBadge ${mode}" title="${escapeHtml(def.hint)}">${escapeHtml(def.short)}</span>`}
function taskDayHint(t){
  const daysText=Array.isArray(t.days)&&t.days.length?sortWeekDays(t.days).map(dayName).join("・"):"自由";
  const mode=taskPlanningMode(t);
  if(mode==="weekly")return `建议：${daysText}`;
  if(mode==="daily")return t.days.length>=7?"每天出现":`执行：${daysText}`;
  return `指定：${daysText}`;
}


/* defaultRefGroups moved to assets/js/data/default-data.js */

function normalizeRefGroups(groups){
  const src=Array.isArray(groups)?groups:defaultRefGroups;
  const usedGroupIds=new Set();
  return src.map((raw,idx)=>{
    const title=String(raw.title||`资料分组 ${idx+1}`).trim()||`资料分组 ${idx+1}`;
    let id=String(raw.id||slugifyId(title,"ref-group")).trim();
    if(usedGroupIds.has(id)){
      let base=id,n=2;
      while(usedGroupIds.has(`${base}-${n}`))n++;
      id=`${base}-${n}`;
    }
    usedGroupIds.add(id);
    const usedItemIds=new Set();
    const items=(Array.isArray(raw.items)?raw.items:[]).map((it,iidx)=>{
      const itTitle=String(it.title||`资料 ${iidx+1}`).trim()||`资料 ${iidx+1}`;
      let iid=String(it.id||slugifyId(itTitle,"ref-item")).trim();
      if(usedItemIds.has(iid)){
        let base=iid,n=2;
        while(usedItemIds.has(`${base}-${n}`))n++;
        iid=`${base}-${n}`;
      }
      usedItemIds.add(iid);
      return {id:iid,title:itTitle,url:String(it.url||"").trim(),enabled:it.enabled!==false};
    });
    return {id,title,enabled:raw.enabled!==false,items};
  });
}


const gameQuestPlanModeDefs={
  daily:{name:"每日任务",short:"每日",hint:"每天/多数天会出现，进入游戏作战区的今日清理。"},
  scheduled:{name:"指定日任务",short:"指定",hint:"只在配置的星期出现，例如某天检查卡池/活动。"},
  weekly:{name:"本周任务",short:"周",hint:"不绑某一天，只在游戏作战区的本周池推进。"}
};
function normalizeGameQuestPlanMode(v,fallback="scheduled"){
  const raw=String(v||"").trim().toLowerCase();
  if(["daily","day","everyday","每日","日课","日常"].includes(raw))return "daily";
  if(["weekly","week","本周","周","周常","week_pool"].includes(raw))return "weekly";
  if(["scheduled","schedule","指定","指定日","定时"].includes(raw))return "scheduled";
  return fallback;
}
function stripGameQuestModePrefix(value){
  let title=String(value||"").trim();
  let mode="";
  const patterns=[
    [/^(?:\[周\]|【周】|周[:：]|week[:：]|weekly[:：]|#weekly\s+)/i,"weekly"],
    [/^(?:\[日\]|【日】|每日[:：]|日常[:：]|daily[:：]|#daily\s+)/i,"daily"],
    [/^(?:\[定\]|【定】|指定[:：]|指定日[:：]|scheduled[:：]|#scheduled\s+)/i,"scheduled"]
  ];
  for(const [re,m] of patterns){
    if(re.test(title)){title=title.replace(re,"").trim();mode=m;break}
  }
  return {title,mode};
}
function inferGameQuestPlanMode(raw,fallback="scheduled"){
  if(raw&&typeof raw==="object"){
    const explicit=raw.plan_mode||raw.planMode||raw.mode||raw.type;
    if(explicit)return normalizeGameQuestPlanMode(explicit,fallback);
    raw=raw.title||raw.name||"";
  }
  const stripped=stripGameQuestModePrefix(raw);
  if(stripped.mode)return stripped.mode;
  const title=String(stripped.title||raw||"").toLowerCase();
  if(/周常|weekly|week|深塔|海墟|全息|式舆|危局|鏖战|模拟宇宙|末日|虚构|混沌|深渊|endgame|本周|周本|周任务/.test(title))return "weekly";
  if(/日常|daily|体力|咖啡|刮刮乐|委托|签到|每日/.test(title))return "daily";
  return fallback;
}
function normalizeGameQuestTaskList(value,context="scheduled"){
  const rawList=Array.isArray(value)?value:(typeof value==="string"?value.split(/\n+/):[]);
  const used=new Set();
  return rawList.map((item,idx)=>{
    const obj=item&&typeof item==="object"?item:null;
    const stripped=stripGameQuestModePrefix(obj?(obj.title||obj.name||""):item);
    const title=String(stripped.title||`游戏任务 ${idx+1}`).trim();
    if(!title)return null;
    const mode=normalizeGameQuestPlanMode(obj?.plan_mode||obj?.planMode||obj?.mode||stripped.mode,inferGameQuestPlanMode(title,context));
    let id=String(obj?.id||slugifyId(`${mode}-${title}`,`gq-item-${idx+1}`)).trim();
    if(used.has(id)){let base=id,n=2;while(used.has(`${base}-${n}`))n++;id=`${base}-${n}`}
    used.add(id);
    const task={id,title,plan_mode:mode,enabled:obj?.enabled!==false};
    const weekly=Number(obj?.weekly_minutes??obj?.weeklyMinutes??obj?.weeklyTargetMinutes);
    if(Number.isFinite(weekly)&&weekly>=0)task.weekly_minutes=Math.min(10080,Math.round(weekly));
    const estimated=Number(obj?.estimated_minutes??obj?.estimatedMinutes);
    if(Number.isFinite(estimated)&&estimated>0)task.estimated_minutes=Math.min(480,Math.round(estimated));
    return task;
  }).filter(t=>t&&t.enabled!==false).slice(0,20);
}
function normalizeGameQuestTextList(value){return normalizeGameQuestTaskList(value).map(t=>t.title)}
function gameQuestTaskStoreList(value,context="scheduled"){
  return normalizeGameQuestTaskList(value,context).map(t=>{
    const out={id:t.id,title:t.title,plan_mode:t.plan_mode};
    if(Number.isFinite(Number(t.weekly_minutes)))out.weekly_minutes=Number(t.weekly_minutes);
    if(Number.isFinite(Number(t.estimated_minutes)))out.estimated_minutes=Number(t.estimated_minutes);
    return out;
  });
}
function gameQuestTaskLines(value,context="scheduled"){return normalizeGameQuestTaskList(value,context).map(t=>t.title)}
function normalizeGameQuestConfig(config){
  const fallback=deepClone(typeof defaultGameQuestConfig!=="undefined"?defaultGameQuestConfig:{version:1,games:[],schedule:{},weekly:{}});
  const src=config&&typeof config==="object"?config:fallback;
  const used=new Set();
  const games=(Array.isArray(src.games)?src.games:fallback.games||[]).map((g,idx)=>{
    const name=String(g.name||g.short||`游戏 ${idx+1}`).trim()||`游戏 ${idx+1}`;
    let id=String(g.id||slugifyId(name,"game")).trim();
    if(used.has(id)){
      let base=id,n=2;
      while(used.has(`${base}-${n}`))n++;
      id=`${base}-${n}`;
    }
    used.add(id);
    return {
      id,
      name,
      short:String(g.short||name).trim()||name,
      icon:String(g.icon||"GQ").trim()||"GQ",
      accent:String(g.accent||["cyan","amber","violet","blue","rose","gold"][idx%6]).trim()||"cyan",
      enabled:g.enabled!==false
    };
  });
  const schedule={};
  const weekly={};
  const addWeekly=(gameId,t)=>{
    if(!t||!t.title)return;
    if(!weekly[gameId])weekly[gameId]=[];
    const sig=String(t.id||t.title).toLowerCase();
    if(weekly[gameId].some(x=>String(x.id||x.title).toLowerCase()===sig||String(x.title).trim()===String(t.title).trim()))return;
    weekly[gameId].push({...t,plan_mode:"weekly"});
  };
  games.forEach(g=>{
    const srcWeekly=src.weekly&&src.weekly[g.id];
    const fallbackWeekly=fallback.weekly&&fallback.weekly[g.id];
    normalizeGameQuestTaskList(srcWeekly||fallbackWeekly||[],"weekly").forEach(t=>addWeekly(g.id,{...t,plan_mode:"weekly"}));
  });
  [1,2,3,4,5,6,0].forEach(day=>{
    const rawDay=(src.schedule&&src.schedule[String(day)])||(fallback.schedule&&fallback.schedule[String(day)])||{};
    const dayObj={};
    games.forEach(g=>{
      const dailyList=[];
      normalizeGameQuestTaskList(rawDay[g.id],"scheduled").forEach(t=>{
        if(t.plan_mode==="weekly")addWeekly(g.id,t);
        else dailyList.push(t);
      });
      if(dailyList.length)dayObj[g.id]=dailyList;
    });
    schedule[String(day)]=dayObj;
  });
  Object.keys(weekly).forEach(gameId=>{weekly[gameId]=weekly[gameId].slice(0,30)});
  return {version:2,updatedAt:String(src.updatedAt||""),games,schedule,weekly};
}

function buildDefaultConfig(){
  const usedTaskCodes=new Set();
  const tasks=defaultBlocks.map((t,idx)=>{
    const code="t"+String(idx+1).padStart(3,"0");
    usedTaskCodes.add(code);
    const steps=(defaultStepTasks[t.id]||[]).map((s,sidx)=>({
      id:s.id,
      code:"s"+String(sidx+1).padStart(2,"0"),
      title:s.title,
      enabled:s.enabled!==false
    }));
    return {
      id:t.id,
      code,
      cat:t.cat,
      title:t.title,
      days:Array.isArray(t.days)?[...t.days]:[],
      url:t.url||"",
      core:!!t.core,
      optional:!!t.optional,
      important:!!t.important,
      enabled:t.enabled!==false,
      time_category:inferTaskTimeCategory(t),
      estimated_minutes:inferEstimatedMinutes(t),
      weekly_minutes:inferWeeklyMinutes({...t,estimated_minutes:inferEstimatedMinutes(t)}),
      plan_mode:inferTaskPlanMode(t),
      steps
    }
  });
  return {version:4, privacy:"coded-state-keys", updatedAt:new Date().toISOString(), tasks, refs:deepClone(defaultRefGroups), gameQuest:deepClone(defaultGameQuestConfig)};
}
function normalizeTaskConfig(config){
  const fallback=buildDefaultConfig();
  const src=config&&Array.isArray(config.tasks)?config:fallback;
  // 已有配置必须按原样规范化，不能把默认 Demo 任务重新塞回用户配置。
  // 默认数据只在没有任何本机/云端配置时由 buildDefaultConfig() 使用。
  const rawTasks=Array.isArray(src.tasks)?src.tasks.slice():fallback.tasks.slice();
  const hasPersonalTasks=rawTasks.some(t=>!String(t?.id||"").startsWith("demo-"));
  const srcTasks=hasPersonalTasks?rawTasks.filter(t=>!ACCIDENTAL_DEMO_CORE_IDS.has(String(t?.id||""))):rawTasks;
  const usedIds=new Set();
  const usedCodes=new Set();
  const validCats=new Set(["life","gamecreate","language"]);
  const tasks=srcTasks.map((raw,idx)=>{
    const title=String(raw.title||`任务 ${idx+1}`).trim()||`任务 ${idx+1}`;
    let id=String(raw.id||slugifyId(title,"task")).trim();
    if(usedIds.has(id)){
      let base=id, n=2;
      while(usedIds.has(`${base}-${n}`))n++;
      id=`${base}-${n}`;
    }
    usedIds.add(id);
    let code=String(raw.code||"").trim();
    if(!/^t\d{3,}$/.test(code)||usedCodes.has(code)) code=nextCode("t",usedCodes);
    usedCodes.add(code);
    const cat=validCats.has(raw.cat)?raw.cat:"life";
    const rawDays=Array.isArray(raw.days)?raw.days:[];
    const daySet=new Set(rawDays.map(Number).filter(d=>[0,1,2,3,4,5,6].includes(d)));
    const days=[1,2,3,4,5,6,0].filter(d=>daySet.has(d));
    const usedStepIds=new Set();
    const usedStepCodes=new Set();
    const steps=(Array.isArray(raw.steps)?raw.steps:[]).map((st,sidx)=>{
      const stTitle=String(st.title||`子任务 ${sidx+1}`).trim()||`子任务 ${sidx+1}`;
      let sid=String(st.id||slugifyId(stTitle,"step")).trim();
      if(usedStepIds.has(sid)){
        let base=sid,n=2;
        while(usedStepIds.has(`${base}-${n}`))n++;
        sid=`${base}-${n}`;
      }
      usedStepIds.add(sid);
      let scode=String(st.code||"").trim();
      if(!/^s\d{2,}$/.test(scode)||usedStepCodes.has(scode)) scode=nextCode("s",usedStepCodes);
      usedStepCodes.add(scode);
      return {id:sid, code:scode, title:stTitle, enabled:st.enabled!==false};
    });
    return {
      id, code, cat, title, days,
      url:String(raw.url||"").trim(),
      core:normalizeBool(raw.core),
      optional:normalizeBool(raw.optional),
      important:normalizeBool(raw.important),
      enabled:raw.enabled!==false,
      time_category:inferTaskTimeCategory(raw),
      estimated_minutes:inferEstimatedMinutes(raw),
      weekly_minutes:inferWeeklyMinutes(raw),
      plan_mode:inferTaskPlanMode(raw),
      steps
    };
  });
  return {version:4, privacy:"coded-state-keys", updatedAt:String(src.updatedAt||new Date().toISOString()), tasks, refs:normalizeRefGroups(src.refs||fallback.refs), gameQuest:normalizeGameQuestConfig(src.gameQuest||fallback.gameQuest)};
}
function applyTaskConfig(config, shouldRender=false){
  taskConfig=normalizeTaskConfig(config);
  refGroups=taskConfig.refs||normalizeRefGroups(defaultRefGroups);
  gameQuestConfig=taskConfig.gameQuest||normalizeGameQuestConfig(defaultGameQuestConfig);
  blocks=taskConfig.tasks.filter(t=>t.enabled!==false).map(t=>({
    id:t.id, code:t.code, cat:t.cat, title:t.title, days:t.days, url:t.url||"",
    core:t.core?1:0, optional:t.optional?1:0, important:t.important?1:0, enabled:t.enabled!==false,
    time_category:t.time_category||inferTaskTimeCategory(t), estimated_minutes:t.estimated_minutes||inferEstimatedMinutes(t), weekly_minutes:taskWeeklyMinutes(t), plan_mode:taskPlanningMode(t)
  }));
  stepTasks={};
  taskConfig.tasks.forEach(t=>{
    const enabledSteps=(t.steps||[]).filter(s=>s.enabled!==false).map(s=>({id:s.id, code:s.code, title:s.title}));
    if(enabledSteps.length) stepTasks[t.id]=enabledSteps;
  });
  if(shouldRender && typeof renderAll==="function") renderAll();
}
function taskById(taskId){return taskConfig?.tasks?.find(t=>t.id===taskId)||blocks.find(t=>t.id===taskId)}
function taskCode(taskId){return taskById(taskId)?.code||String(taskId)}
function taskIdFromCode(code){return taskConfig?.tasks?.find(t=>t.code===code)?.id||null}
function stepById(taskId,stepId){return (taskConfig?.tasks?.find(t=>t.id===taskId)?.steps||[]).find(s=>s.id===stepId)||(stepTasks[taskId]||[]).find(s=>s.id===stepId)}
function stepCode(taskId,stepId){return stepById(taskId,stepId)?.code||String(stepId)}
function stepIdFromCode(taskId,code){return (taskConfig?.tasks?.find(t=>t.id===taskId)?.steps||[]).find(s=>s.code===code)?.id||null}

function cleanupAccidentallyInjectedDemoTasks(rawConfig){
  if(!rawConfig||!Array.isArray(rawConfig.tasks))return rawConfig;
  if(localStorage.getItem(DEMO_CORE_CLEANUP_KEY)==="1")return rawConfig;
  const hasPersonalTasks=rawConfig.tasks.some(t=>!String(t?.id||"").startsWith("demo-"));
  if(!hasPersonalTasks)return rawConfig;
  const cleanedTasks=rawConfig.tasks.filter(t=>!ACCIDENTAL_DEMO_CORE_IDS.has(String(t?.id||"")));
  const cleaned={...rawConfig,tasks:cleanedTasks};
  if(cleanedTasks.length!==rawConfig.tasks.length){
    try{localStorage.setItem(TASK_CONFIG_LOCAL_KEY,JSON.stringify(cleaned))}catch(e){console.warn("demo task cleanup save failed",e)}
  }
  try{localStorage.setItem(DEMO_CORE_CLEANUP_KEY,"1")}catch(_){ }
  return cleaned;
}

function loadLocalTaskConfig(){
  try{
    const raw=localStorage.getItem(TASK_CONFIG_LOCAL_KEY);
    if(!raw)return null;
    return normalizeTaskConfig(cleanupAccidentallyInjectedDemoTasks(JSON.parse(raw)));
  }catch(e){
    console.warn("local task config load failed",e);
    return null;
  }
}
function readLocalConfigBackups(){
  try{
    const list=JSON.parse(localStorage.getItem(TASK_CONFIG_BACKUP_KEY)||"[]");
    return Array.isArray(list)?list:[];
  }catch(e){
    console.warn("local task config backups load failed",e);
    return [];
  }
}
function writeLocalConfigBackups(list){
  localStorage.setItem(TASK_CONFIG_BACKUP_KEY,JSON.stringify(list.slice(0,TASK_CONFIG_BACKUP_LIMIT)));
}
function configCounts(config){
  const cfg=normalizeTaskConfig(config||buildDefaultConfig());
  const tasks=cfg.tasks||[];
  return {
    total:tasks.length,
    enabled:tasks.filter(t=>t.enabled!==false).length,
    disabled:tasks.filter(t=>t.enabled===false).length,
    weekly:tasks.filter(t=>t.enabled!==false&&taskPlanningMode(t)==="weekly").length,
    daily:tasks.filter(t=>t.enabled!==false&&taskPlanningMode(t)!=="weekly").length
  };
}
function configCountsText(config){
  const c=configCounts(config);
  return `${c.total} 个任务，启用 ${c.enabled}，停用 ${c.disabled}`;
}
function pushLocalConfigBackup(config,reason="自动备份"){
  try{
    const cfg=normalizeTaskConfig(config);
    const counts=configCounts(cfg);
    const entry={id:`bk-${Date.now().toString(36)}`,createdAt:new Date().toISOString(),reason,counts,config:cfg};
    const list=readLocalConfigBackups();
    const sig=JSON.stringify(cfg.tasks||[]);
    const dedup=list.filter(item=>JSON.stringify(item?.config?.tasks||[])!==sig);
    dedup.unshift(entry);
    writeLocalConfigBackups(dedup);
    return entry;
  }catch(e){
    console.warn("local task config backup failed",e);
    return null;
  }
}
function saveLocalTaskConfig(config,reason="覆盖本机配置前自动备份"){
  const cfg=normalizeTaskConfig(config);
  try{
    const prevRaw=localStorage.getItem(TASK_CONFIG_LOCAL_KEY);
    if(prevRaw){
      const prev=normalizeTaskConfig(JSON.parse(prevRaw));
      if(JSON.stringify(prev)!==JSON.stringify(cfg))pushLocalConfigBackup(prev,reason);
    }
  }catch(e){
    console.warn("previous task config backup skipped",e);
  }
  localStorage.setItem(TASK_CONFIG_LOCAL_KEY, JSON.stringify(cfg));
  return cfg;
}
function clearLocalTaskConfig(){
  localStorage.removeItem(TASK_CONFIG_LOCAL_KEY);
}
applyTaskConfig(loadLocalTaskConfig()||buildDefaultConfig(),false);
const cats={life:{name:"生活&经济",color:"var(--life)",cls:"life",icon:"◇"},gamecreate:{name:"游戏&创作",color:"var(--gamecreate)",cls:"gamecreate",icon:"✦"},language:{name:"语言&学习",color:"var(--language)",cls:"language",icon:"§"}};
const mobileCatNames={life:"生活",gamecreate:"创作",language:"学习"};
function catMobileName(catKey,c){return mobileCatNames[catKey]||c?.name||catKey||"任务"}
const ROLLOVER_HOUR=4;
function getOperationalDate(date){const d=new Date(date);if(d.getHours()<ROLLOVER_HOUR){d.setDate(d.getDate()-1)}return d}
function getUrlDateOverride(){
  try{
    const raw=new URLSearchParams(location.search).get("date");
    if(!raw||!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
    const d=new Date(`${raw}T12:00:00`);
    if(Number.isNaN(d.getTime())||`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`!==raw)return null;
    return d;
  }catch(_){return null}
}
const realNow=new Date();
const urlDateOverride=getUrlDateOverride();
const operationalNow=getOperationalDate(urlDateOverride||realNow);
const today=operationalNow.getDay();
const UI_VIEW_MODE_KEY="taskring_view_mode_v1";const UI_MOBILE_DAY_KEY="taskring_mobile_day_v1";const SAVED_VIEW_MODE=localStorage.getItem(UI_VIEW_MODE_KEY);let viewMode=["undone","today","all"].includes(SAVED_VIEW_MODE)?SAVED_VIEW_MODE:"undone";const SAVED_MOBILE_DAY=Number(localStorage.getItem(UI_MOBILE_DAY_KEY));let mobileDay=[0,1,2,3,4,5,6].includes(SAVED_MOBILE_DAY)?SAVED_MOBILE_DAY:today;
function pad(n){return String(n).padStart(2,"0")}
function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function dayName(id){return days.find(d=>d.id===id)?.name||""}
function dayNamesFor(t){return t.days.map(dayName).join("・")}
function getCycleStart(date){const ref=new Date(date);const d=new Date(ref.getFullYear(),ref.getMonth(),ref.getDate(),4,0,0,0);const day=ref.getDay();const daysSinceMonday=(day+6)%7;d.setDate(d.getDate()-daysSinceMonday);if(ref<d)d.setDate(d.getDate()-7);return d}
const cycleStart=getCycleStart(urlDateOverride||realNow);
const cycleEnd=new Date(cycleStart);cycleEnd.setDate(cycleStart.getDate()+7);
const cycleYmd=ymd(cycleStart);
const prevCycleStart=new Date(cycleStart);prevCycleStart.setDate(cycleStart.getDate()-7);
const prevCycleYmd=ymd(prevCycleStart);
/* === v8.1 GitHub Gist Sync + Soft Lock === */
const GITHUB_GIST_ID="d9abf0fb69a47f7c4114be3930894c65";
const CONFIG_CRYPTO_KEY="INERTIA_TASK_RING_CONFIG_SYNC_KEY_v1_20260616";
const GITHUB_STATE_FILE="taskring-state.json";
const LEGACY_GH_PREFIX="taskring_github_v1_";
const GH_TOKEN_KEY="taskring_gist_token_v1";
const GH_PREFIX="taskring_github_v2_";
const APP_VIEW_KEY=`${GH_PREFIX}active_view_v1`;
const GQ_BOARD_MODE_KEY=`${GH_PREFIX}gamequest_board_mode_v1`;
const GQ_WEEKLY_FILTER_KEY=`${GH_PREFIX}gamequest_weekly_filter_v1`;
const UI_SCROLL_STATE_KEY="taskring_ui_scroll_state_v1";
const ORBIT_DRAWER_OPEN_KEY="taskring_orbit_drawer_open_v1";
const APP_VIEWS=new Set(["tasks","weekly","game","time","library"]);
const LOCAL_PREVIEW_UNLOCK=["localhost","127.0.0.1","::1"].includes(location.hostname)&&new URLSearchParams(location.search).has("preview");
let activeAppView=APP_VIEWS.has(localStorage.getItem(APP_VIEW_KEY))?localStorage.getItem(APP_VIEW_KEY):"tasks";
let gameQuestBoardMode="today";
let gameQuestWeeklyFilter=localStorage.getItem(GQ_WEEKLY_FILTER_KEY)||"all";
let ghSaveTimer=null;
let ghSaving=false;
let ghPromptedThisLoad=false;
const SOFT_LOCK_HASH="bead83688f2ba2f37b42341f55c53c97e50ae7c0d521f6b67cdd7da0befda9ed"; // sha256(解锁码)。不要在此写明文；改密码见 README「修改软锁密码」。
const SOFT_LOCK_TRUST_KEY="taskring_softlock_trusted_v1";
const SOFT_LOCK_TRUST_UNTIL_KEY="taskring_softlock_trusted_until_v1";
const SOFT_LOCK_SESSION_KEY="taskring_softlock_session_v1";
const SOFT_LOCK_MANUAL_KEY="taskring_softlock_manual_v1";
const SOFT_LOCK_REMEMBER_DAYS=365;
function lockApp(msg="输入本机解锁码进入任务环。GitHub Token 只用于云同步。"){document.body.classList.add("locked");const sub=document.querySelector(".lockSub");if(sub)sub.textContent=msg;setLockError("");setTimeout(()=>document.getElementById("lockCodeInput")?.focus(),60)}
function unlockApp(){document.body.classList.remove("locked")}
function setLockError(msg=""){const el=document.getElementById("lockError");if(el)el.textContent=msg}
function hexFromBytes(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function sha256Fallback(text){
  const rightRotate=(v,a)=>(v>>>a)|(v<<(32-a));
  let ascii=unescape(encodeURIComponent(String(text||"")));
  const maxWord=Math.pow(2,32), words=[];
  const bitLength=ascii.length*8;
  let hash=sha256Fallback.h=sha256Fallback.h||[], k=sha256Fallback.k=sha256Fallback.k||[], primeCounter=k.length;
  const isComposite={};
  for(let candidate=2;primeCounter<64;candidate++){
    if(!isComposite[candidate]){
      for(let i=0;i<313;i+=candidate)isComposite[i]=candidate;
      hash[primeCounter]=(Math.pow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(Math.pow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80';
  while(ascii.length%64!==56)ascii+='\x00';
  for(let i=0;i<ascii.length;i++)words[i>>2]|=ascii.charCodeAt(i)<<((3-i)%4)*8;
  words[words.length]=(bitLength/maxWord)|0;
  words[words.length]=bitLength;
  for(let j=0;j<words.length;){
    const w=words.slice(j,j+=16), oldHash=hash.slice(0);
    hash=hash.slice(0,8);
    for(let i=0;i<64;i++){
      const w15=w[i-15], w2=w[i-2], a=hash[0], e=hash[4];
      const temp1=hash[7]+(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:((w[i-16]+(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))+w[i-7]+(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)))|0));
      const temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0,a,hash[1],hash[2],(hash[3]+temp1)|0,e,hash[5],hash[6]];
    }
    for(let i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0;
  }
  let result='';
  for(let i=0;i<8;i++)for(let j=3;j+1;j--){const b=(hash[i]>>(j*8))&255;result+=(b<16?'0':'')+b.toString(16)}
  return result;
}
async function sha256Hex(text){
  const value=String(text||"");
  if(globalThis.crypto?.subtle&&globalThis.TextEncoder){
    try{
      const data=new TextEncoder().encode(value);
      return hexFromBytes(await globalThis.crypto.subtle.digest("SHA-256",data));
    }catch(err){
      console.warn("Web Crypto SHA-256 unavailable; using local fallback.",err);
    }
  }
  return sha256Fallback(value);
}
function isManualSoftLocked(){return localStorage.getItem(SOFT_LOCK_MANUAL_KEY)==="1"}
function forceSoftLock(){localStorage.setItem(SOFT_LOCK_MANUAL_KEY,"1");clearSoftLockTrust()}
function releaseSoftLock(){localStorage.removeItem(SOFT_LOCK_MANUAL_KEY)}
function isSoftLockTrusted(){
  if(isManualSoftLocked())return false;
  if(sessionStorage.getItem(SOFT_LOCK_SESSION_KEY)==="1")return true;
  if(localStorage.getItem(SOFT_LOCK_TRUST_KEY)!=="1")return false;
  const until=Number(localStorage.getItem(SOFT_LOCK_TRUST_UNTIL_KEY)||"0");
  if(until&&Date.now()>until){clearSoftLockTrust();return false}
  return true;
}
function trustSoftLock(remember=true){
  releaseSoftLock();
  sessionStorage.setItem(SOFT_LOCK_SESSION_KEY,"1");
  if(remember){
    localStorage.setItem(SOFT_LOCK_TRUST_KEY,"1");
    localStorage.setItem(SOFT_LOCK_TRUST_UNTIL_KEY,String(Date.now()+SOFT_LOCK_REMEMBER_DAYS*24*60*60*1000));
  }
}
function clearSoftLockTrust(){localStorage.removeItem(SOFT_LOCK_TRUST_KEY);localStorage.removeItem(SOFT_LOCK_TRUST_UNTIL_KEY);sessionStorage.removeItem(SOFT_LOCK_SESSION_KEY)}
function applyLocalConfigIfAny(){const localCfg=loadLocalTaskConfig();if(localCfg)applyTaskConfig(localCfg,false);return !!localCfg}
function enterLocalMode(promptToken=false,msg="本机已解锁；当前使用本机/内置数据。需要云同步时请设置 Gist Token。"){
  unlockApp();
  applyLocalConfigIfAny();
  renderAll();
  if(!ghToken()){setGhStatus(LOCAL_PREVIEW_UNLOCK?"GitHub：本地预览":"GitHub：未设置","off");}
  ghLog(msg);
  if(promptToken&&!ghPromptedThisLoad){
    ghPromptedThisLoad=true;
    showToast("本机已解锁；需要云同步时可点 GitHub 同步设置 Token。","warn",3000);
  }
}
async function handleSoftUnlock(){
  const input=document.getElementById("lockCodeInput");
  const btn=document.getElementById("lockUnlockBtn");
  const code=String(input?.value||"").trim();
  if(!code){setLockError("请输入解锁码。默认初始码是 README 里说明的那一个。");input?.focus();return}
  try{
    setBtnBusy(btn,true,"校验中…");
    const ok=(await sha256Hex(code))===SOFT_LOCK_HASH;
    if(!ok){setLockError("解锁码不对。别急，任务环还在，只是门卫不认识你。");input?.select?.();return}
    trustSoftLock(document.getElementById("lockRememberDevice")?.checked!==false);
    setLockError("");
    unlockApp();
    applyLocalConfigIfAny();
    renderAll();
    showToast("已解锁，本机已记住。","ok",1800);
    if(ghToken())ghPull();else enterLocalMode(true,"软锁已解锁；未设置 Gist Token，当前使用本机/内置数据。")
  }catch(err){
    console.error(err);
    setLockError(String(err.message||err));
  }finally{
    setBtnBusy(btn,false);
  }
}
function softLockNow(msg="已手动上锁。输入本机解锁码才能重新进入。"){forceSoftLock();closeGhModal();closeControlCenter();const input=document.getElementById("lockCodeInput");if(input)input.value="";setGhStatus("GitHub：已手动上锁","off");lockApp(msg);showToast("TASK RING 已上锁，下次需密码","ok",2200)}
function ghLog(msg){const el=document.getElementById("ghLog");if(el)el.textContent=`[${new Date().toLocaleTimeString()}] ${msg}\n`+el.textContent.slice(0,2500)}
function setGhStatus(text,cls=""){const el=document.getElementById("githubStatus");if(!el)return;const short=String(text||"").replace(/^GitHub：?/,"")||"未设置";el.className=`githubInlineState ${cls||"off"}`;el.setAttribute("title",String(text||"GitHub：未设置"));const label=el.querySelector(".ghInlineText");if(label)label.textContent=short;else el.textContent=short;}
function ghToken(){return localStorage.getItem(GH_TOKEN_KEY)||""}
function setGhToken(v){if(v)localStorage.setItem(GH_TOKEN_KEY,v.trim());else localStorage.removeItem(GH_TOKEN_KEY)}
function ghHeaders(){const h={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};const t=ghToken();if(t)h.Authorization=`Bearer ${t}`;return h}
function collectGhLocalStates(){const states={};Object.keys(localStorage).forEach(k=>{if(k.startsWith(GH_PREFIX)&&localStorage.getItem(k)==="1")states[k]="1"});return states}
function clearGhLocalStates(){Object.keys(localStorage).forEach(k=>{if(k.startsWith(GH_PREFIX))localStorage.removeItem(k)})}
function clearGhLocalCycle(cycle=cycleYmd){Object.keys(localStorage).forEach(k=>{if(k.startsWith(`${GH_PREFIX}${cycle}_`))localStorage.removeItem(k)})}
function migrateLegacyLocalStates(){
  const legacyKeys=Object.keys(localStorage).filter(k=>k.startsWith(LEGACY_GH_PREFIX)&&localStorage.getItem(k)==="1");
  let migrated=0;
  legacyKeys.forEach(k=>{
    const nk=migrateLegacyKey(k);
    if(nk&&!localStorage.getItem(nk)){localStorage.setItem(nk,"1");migrated++}
  });
  if(migrated)ghLog(`本机旧状态已转为隐私Key：${migrated} 项`);
}



function configCryptoSecret(){return CONFIG_CRYPTO_KEY}
function showToast(msg,type="ok",ms=2200){
  let el=document.getElementById("toastBox");
  if(!el){
    el=document.createElement("div");
    el.id="toastBox";
    el.className="toastBox";
    document.body.appendChild(el);
  }
  const dockAware=!!readActiveTimer();
  el.textContent=msg;
  el.className=`toastBox ${type} ${dockAware?"dockAware":""} show`;
  clearTimeout(el._timer);
  el._timer=setTimeout(()=>el.classList.remove("show"),ms);
}
function setBtnBusy(btn,busy,label){
  if(!btn)return;
  if(busy){
    btn.dataset.oldText=btn.textContent;
    if(label)btn.textContent=label;
    btn.classList.add("busy");
  }else{
    if(btn.dataset.oldText)btn.textContent=btn.dataset.oldText;
    btn.classList.remove("busy");
  }
}
function bytesToB64(bytes){let bin="";new Uint8Array(bytes).forEach(b=>bin+=String.fromCharCode(b));return btoa(bin)}
function b64ToBytes(b64){const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return arr}
async function deriveConfigKey(secret,saltB64,iterations=160000){
  if(!secret)throw new Error("缺少 GitHub Token");
  const enc=new TextEncoder();
  const base=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"PBKDF2"},false,["deriveKey"]);
  return await crypto.subtle.deriveKey(
    {name:"PBKDF2",salt:b64ToBytes(saltB64),iterations,hash:"SHA-256"},
    base,
    {name:"AES-GCM",length:256},
    false,
    ["encrypt","decrypt"]
  );
}
async function encryptConfigObject(config){
  const secret=configCryptoSecret();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const iterations=160000;
  const saltB64=bytesToB64(salt);
  const key=await deriveConfigKey(secret,saltB64,iterations);
  const plain=new TextEncoder().encode(JSON.stringify(config));
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain);
  return {
    version:3,
    encrypted:true,
    alg:"AES-GCM",
    kdf:"PBKDF2-SHA256",
    iterations,
    salt:saltB64,
    iv:bytesToB64(iv),
    data:bytesToB64(cipher),
    updatedAt:new Date().toISOString()
  };
}
async function decryptConfigObject(payload){
  const secret=configCryptoSecret();
  const key=await deriveConfigKey(secret,payload.salt,payload.iterations||160000);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64ToBytes(payload.iv)},key,b64ToBytes(payload.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function ghFetchGist(){const res=await fetch(`https://api.github.com/gists/${GITHUB_GIST_ID}`,{headers:ghHeaders(),cache:"no-store"});if(!res.ok)throw new Error(`GET gist failed ${res.status}: ${await res.text()}`);return await res.json()}
function ghParseState(gist){const file=gist.files&&gist.files[GITHUB_STATE_FILE];if(!file||!file.content)return {version:2,updatedAt:"",states:{}};try{const obj=JSON.parse(file.content);if(!obj.states)obj.states={};return obj}catch(e){throw new Error("taskring-state.json 不是合法 JSON")}}
async function ghParseConfig(gist){
  const file=gist.files&&gist.files[CONFIG_FILE];
  if(!file||!file.content)return {config:null, mode:"missing"};
  try{
    const raw=JSON.parse(file.content);
    if(raw&&raw.encrypted===true){
      const decrypted=await decryptConfigObject(raw);
      return {config:normalizeTaskConfig(decrypted), mode:"encrypted"};
    }
    return {config:normalizeTaskConfig(raw), mode:"plaintext"};
  }catch(e){
    ghLog("任务配置读取失败，已使用内置默认配置："+e.message);
    return {config:null, mode:"error", error:e};
  }
}
async function ghPatchFiles(files){if(!ghToken())throw new Error("未设置 GitHub Token");const body={files:{}};Object.keys(files).forEach(name=>{body.files[name]={content:files[name]}});const res=await fetch(`https://api.github.com/gists/${GITHUB_GIST_ID}`,{method:"PATCH",headers:{...ghHeaders(),"Content-Type":"application/json"},body:JSON.stringify(body)});if(!res.ok)throw new Error(`PATCH gist failed ${res.status}: ${await res.text()}`);return await res.json()}
async function ghPatchState(data){return await ghPatchFiles({[GITHUB_STATE_FILE]:JSON.stringify(data,null,2)})}
async function ghPatchConfig(config){
  const encrypted=await encryptConfigObject(config);
  return await ghPatchFiles({[CONFIG_FILE]:JSON.stringify(encrypted,null,2)});
}
function migrateLegacyKey(key){
  if(!String(key).startsWith(LEGACY_GH_PREFIX))return null;
  const rest=String(key).slice(LEGACY_GH_PREFIX.length);
  const cycle=rest.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(cycle))return null;
  let body=rest.slice(11);
  if(!body)return null;
  if(body.endsWith("_ignored")){
    body=body.slice(0,-8);
    const parts=body.split("_");
    const day=Number(parts.pop());
    const taskId=parts.join("_");
    if(![0,1,2,3,4,5,6].includes(day))return null;
    if(!taskById(taskId))return null;
    return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_x${day}`;
  }
  const parts=body.split("_");
  const day=Number(parts.pop());
  if(![0,1,2,3,4,5,6].includes(day))return null;
  const stepIdx=parts.indexOf("step");
  if(stepIdx>=0){
    const taskId=parts.slice(0,stepIdx).join("_");
    const stepId=parts.slice(stepIdx+1).join("_");
    if(!taskById(taskId)||!stepById(taskId,stepId))return null;
    return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_${stepCode(taskId,stepId)}_d${day}`;
  }
  const taskId=parts.join("_");
  if(!taskById(taskId))return null;
  return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_d${day}`;
}
function applyGhStates(states){
  clearGhLocalStates();
  let migrated=0, applied=0;
  Object.keys(states||{}).forEach(k=>{
    if(states[k]!=="1")return;
    if(k.startsWith(GH_PREFIX)){localStorage.setItem(k,"1");applied++;return}
    const nk=migrateLegacyKey(k);
    if(nk){localStorage.setItem(nk,"1");migrated++;applied++}
  });
  return {applied,migrated};
}
async function ghPull(){
  if(!ghToken()){
    enterLocalMode(true,LOCAL_PREVIEW_UNLOCK?"本地预览模式：未连接云端，只使用内置/本机缓存数据。":"未设置 Gist Token，当前使用本机/内置数据；需要跨设备同步时请填写 Token。");
    return;
  }
  try{
    unlockApp();
    setGhStatus("GitHub：读取中","sync");
    migrateLegacyLocalStates();
    const gist=await ghFetchGist();
    const cfgResult=await ghParseConfig(gist);
    const localCfg=loadLocalTaskConfig();
    const cfgToUse=cfgResult.config||localCfg||buildDefaultConfig();
    applyTaskConfig(cfgToUse,false);
    if(cfgResult.config){saveLocalTaskConfig(cfgResult.config);ghLog("任务配置已从云端加密配置读取。")}
    if(cfgResult.mode==="plaintext"){
      ghLog("检测到旧版明文配置，正在自动转为加密配置…");
      try{await ghPatchConfig(cfgResult.config)}catch(e){ghLog("自动加密配置失败："+e.message)}
    }
    if(cfgResult.mode==="error"&&localCfg){
      ghLog("云端配置无法解密，已使用本机缓存配置；请在保存了正确配置的设备上点「保存配置并同步」修复云端配置。");
    }
    const state=ghParseState(gist);
    const localStates=collectGhLocalStates();
    const localCount=Object.keys(localStates).length;
    const result=applyGhStates(state.states||{});
    const deletedResult=mergeGhTimeLogDeletes(state.time_logs_deleted||state.deleted_time_logs||{});
    const timeResult=mergeGhTimeLogs(state.time_logs||[]);
    if(result.applied===0&&localCount>0){ghLog(`云端为空，本机有 ${localCount} 项，先上传本机状态`);await ghPush(true);unlockApp();return}
    setGhStatus("GitHub：已同步","on");
    ghLog(`读取成功：${result.applied} 项${result.migrated?`；已迁移旧Key ${result.migrated} 项`:""}；时间记录 ${timeResult.count} 条${deletedResult.count?`；删除记录 ${deletedResult.count} 条`:""}`);
    unlockApp();
    renderAll();
    if(result.migrated>0||timeResult.changed||deletedResult.changed)setTimeout(()=>ghPush(true),1200)
  }catch(err){
    console.error(err);
    setGhStatus("GitHub：读取失败","err");
    ghLog(String(err.message||err));
    enterLocalMode(false,"Gist 同步失败，已继续使用本机/内置数据。Token 可能失效、权限不足，或网络读取失败。");
    showToast("Gist 同步失败；需要时请更新 Token","warn",3000);
    setTimeout(openGhModal,360);
  }
}
async function ghPush(silent=false){if(!ghToken()){setGhStatus("GitHub：未设置","off");if(!silent)openGhModal();return}try{ghSaving=true;setGhStatus("GitHub：保存中","sync");const deletedLogs=collectGhDeletedTimeLogs();const data={version:3,privacy:"coded-state-keys + time-logs + weekly-plan",updatedAt:new Date().toISOString(),states:collectGhLocalStates(),time_logs:collectGhTimeLogs(),time_logs_deleted:deletedLogs,time_logs_meta:{limit:TIME_GH_LOG_LIMIT,deleted_limit:TIME_GH_DELETED_LIMIT,active_timer:"local-only"}};await ghPatchState(data);ghSaving=false;setGhStatus("GitHub：已同步","on");ghLog(`保存成功：${Object.keys(data.states).length} 项；时间记录 ${data.time_logs.length} 条；删除记录 ${Object.keys(deletedLogs).length} 条`);unlockApp();renderAll()}catch(err){console.error(err);ghSaving=false;setGhStatus("GitHub：保存失败","err");ghLog(String(err.message||err))}}
function scheduleGhSave(){if(!ghToken()){setGhStatus(LOCAL_PREVIEW_UNLOCK?"GitHub：本地预览":"GitHub：未设置","off");return}setGhStatus("GitHub：等待保存","sync");clearTimeout(ghSaveTimer);ghSaveTimer=setTimeout(()=>ghPush(true),900)}
function syncSetItem(key,val){if(val)localStorage.setItem(key,"1");else localStorage.removeItem(key);scheduleGhSave()}
function syncRemoveCycle(cycle=cycleYmd){clearGhLocalCycle(cycle);scheduleGhSave()}
function updateGistPrivacyPanel(){const panel=document.getElementById("ghGistMasked");if(!panel)return;panel.textContent=ghToken()?"已内置到同步引擎；为避免误传截图，这里不显示原始 Gist ID。":"未输入 Token 时不显示 Gist ID。"}
function openGhModal(){const m=document.getElementById("ghModal");if(!m)return;closeControlCenter();document.getElementById("ghTokenInput").value=ghToken();updateGistPrivacyPanel();m.classList.remove("hidden");m.setAttribute("aria-hidden","false")}
function closeGhModal(){const m=document.getElementById("ghModal");if(!m)return;m.classList.add("hidden");m.setAttribute("aria-hidden","true")}
function controlMenu(){return document.getElementById("controlCenterMenu")}
function ensureControlCenterPortal(){
  const m=controlMenu();
  if(!m)return null;
  if(m.parentElement!==document.body)document.body.appendChild(m);
  return m;
}
function controlBackdrop(){
  let b=document.getElementById("controlCenterBackdrop");
  if(!b){
    b=document.createElement("div");
    b.id="controlCenterBackdrop";
    b.className="controlCenterBackdrop hidden";
    document.body.appendChild(b);
    b.addEventListener("click",closeControlCenter);
  }
  return b;
}
function positionControlCenter(){
  const m=controlMenu();
  const trigger=document.getElementById("controlCenterBtn");
  if(!m||!trigger||m.classList.contains("hidden"))return;
  const compact=window.matchMedia("(max-width: 700px)").matches;
  m.classList.toggle("controlCenterSheet",compact);
  m.style.removeProperty("left");
  m.style.removeProperty("right");
  m.style.removeProperty("top");
  m.style.removeProperty("bottom");
  m.style.removeProperty("max-height");
  if(compact)return;
  const edge=12;
  const rect=trigger.getBoundingClientRect();
  const width=m.offsetWidth;
  const height=m.offsetHeight;
  const left=Math.min(window.innerWidth-width-edge,Math.max(edge,rect.right-width));
  const below=rect.bottom+8;
  const top=below+height<=window.innerHeight-edge?below:Math.max(edge,rect.top-height-8);
  m.style.left=`${Math.round(left)}px`;
  m.style.top=`${Math.round(top)}px`;
  m.style.maxHeight=`${Math.max(220,window.innerHeight-top-edge)}px`;
}
function openControlCenter(){
  const m=ensureControlCenterPortal();
  if(!m)return;
  controlBackdrop().classList.remove("hidden");
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden","false");
  document.getElementById("controlCenterBtn")?.setAttribute("aria-expanded","true");
  document.body.classList.add("controlCenterOpen");
  positionControlCenter();
}
function closeControlCenter(){
  const m=controlMenu();
  if(m){
    m.classList.add("hidden");
    m.setAttribute("aria-hidden","true");
  }
  document.getElementById("controlCenterBtn")?.setAttribute("aria-expanded","false");
  controlBackdrop()?.classList.add("hidden");
  document.body.classList.remove("controlCenterOpen");
}
function toggleControlCenter(){const m=ensureControlCenterPortal();if(!m)return;m.classList.contains("hidden")?openControlCenter():closeControlCenter()}
window.addEventListener("resize",positionControlCenter,{passive:true});
window.addEventListener("scroll",positionControlCenter,{passive:true});
function initGithubSyncUI(){
  document.getElementById("lockUnlockBtn")?.addEventListener("click",handleSoftUnlock);
  document.getElementById("lockCodeInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();handleSoftUnlock()}});
  document.getElementById("githubSetupBtn")?.addEventListener("click",openGhModal);
  document.getElementById("githubStatus")?.addEventListener("click",openGhModal);
  document.getElementById("controlGithubBtn")?.addEventListener("click",()=>{closeControlCenter();openGhModal()});
  document.getElementById("controlPullBtn")?.addEventListener("click",()=>{closeControlCenter();ghPull()});
  document.getElementById("controlPushBtn")?.addEventListener("click",()=>{closeControlCenter();ghPush(false)});
  document.getElementById("controlLockBtn")?.addEventListener("click",()=>softLockNow());
  document.getElementById("controlClearExpiredBtn")?.addEventListener("click",()=>{closeControlCenter();completeCarryoverTasks()});
  document.getElementById("controlCenterBtn")?.addEventListener("click",e=>{e.stopPropagation();toggleControlCenter()});
  document.getElementById("ghCloseBtn")?.addEventListener("click",closeGhModal);
  document.getElementById("ghSaveTokenBtn")?.addEventListener("click",()=>{const v=document.getElementById("ghTokenInput").value.trim();setGhToken(v);ghLog("Token 已保存到本机，开始同步");showToast("Token 已保存，开始同步","ok");closeGhModal();ghPull()});
  document.getElementById("ghPullBtn")?.addEventListener("click",ghPull);
  document.getElementById("ghPushBtn")?.addEventListener("click",()=>ghPush(false));
  document.getElementById("ghClearTokenBtn")?.addEventListener("click",()=>{
    if(confirm("确认清除本机保存的 GitHub Token？页面不会上锁，只会切回本机模式。")){
      setGhToken("");
      setGhStatus("GitHub：未设置","off");
      ghLog("Token 已清除，已切回本机模式");
      enterLocalMode(true,"Token 已清除；当前使用本机/内置数据。需要云同步时请重新填写 Gist Token。");
    }
  });
  if(isSoftLockTrusted()){
    unlockApp();
    if(ghToken())ghPull();
    else enterLocalMode(true,LOCAL_PREVIEW_UNLOCK?"本地预览模式：未连接云端，只使用内置/本机缓存数据。":"本机已记住解锁；未设置 Gist Token，当前使用本机/内置数据。");
  }else{
    setGhStatus(isManualSoftLocked()?"GitHub：已手动上锁":"GitHub：等待解锁","off");
    lockApp(isManualSoftLocked()?"已手动上锁。输入本机解锁码才能重新进入。":"输入本机解锁码进入任务环。GitHub Token 只用于云同步，不再用于开门。");
  }
}


/* === v8.2 Hidden Task Editor === */
let editorCounter=0;
function taskEditorLog(msg){const el=document.getElementById("taskEditorLog");if(el)el.textContent=`[${new Date().toLocaleTimeString()}] ${msg}\n`+el.textContent.slice(0,2500)}

function openTaskEditor(){closeControlCenter();closeGhModal();renderTaskEditor();document.getElementById("taskEditorModal")?.classList.remove("hidden");document.getElementById("taskEditorModal")?.setAttribute("aria-hidden","false")}
function closeTaskEditor(){document.getElementById("taskEditorModal")?.classList.add("hidden");document.getElementById("taskEditorModal")?.setAttribute("aria-hidden","true")}
function cfgEsc(v){return escapeHtml(String(v??""))}
function makeTaskId(){editorCounter++;return `custom-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(editorCounter).padStart(3,"0")}`}
function currentEditorCodes(){return [...document.querySelectorAll(".cfgTask")].map(row=>row.dataset.code).filter(Boolean)}
function makeTaskCode(){return nextCode("t",new Set(currentEditorCodes()))}
function makeStepCode(existing){return nextCode("s",new Set(existing||[]))}
function taskEditorRowHtml(t){
  const stepCodes=(t.steps||[]).map(s=>s.code||"");
  const stepTitles=(t.steps||[]).filter(s=>s.enabled!==false).map(s=>s.title).join("\n");
  const dayBoxes=[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" class="cfgDay" value="${d}" ${t.days?.includes(d)?"checked":""}>${dayName(d)}</label>`).join("");
  return `<div class="cfgTask ${t.enabled===false?"disabled":""}" data-id="${cfgEsc(t.id)}" data-code="${cfgEsc(t.code)}" data-stepcodes="${cfgEsc(JSON.stringify(stepCodes))}">
    <div class="cfgTop">
      <div><span class="cfgMini">${cfgEsc(t.code||"")}</span><span class="cfgMini">${cfgEsc(t.id||"")}</span></div>
      <div class="cfgOps">
        <button data-op="up">上移</button><button data-op="down">下移</button><button data-op="copy">复制</button><button data-op="remove" class="ghDangerBtn">删除</button>
      </div>
    </div>
    <div class="cfgGrid">
      <div class="cfgField"><label>任务名</label><input class="cfgTitle" value="${cfgEsc(t.title)}"></div>
      <div class="cfgField"><label>分类</label><select class="cfgCat">
        <option value="life" ${t.cat==="life"?"selected":""}>生活&经济</option>
        <option value="gamecreate" ${t.cat==="gamecreate"?"selected":""}>游戏&创作</option>
        <option value="language" ${t.cat==="language"?"selected":""}>语言&学习</option>
      </select></div>
      <div class="cfgField"><label>任务模式</label><select class="cfgPlanMode" title="决定任务是否进入今日执行环，还是只在周计划池按时间推进">
        ${taskPlanModeOrder.map(k=>`<option value="${k}" ${taskPlanningMode(t)===k?"selected":""}>${taskPlanModeDefs[k].name}</option>`).join("")}
      </select></div>
      <div class="cfgField"><label>时间分类</label><select class="cfgTimeCategory">
        ${timeCategoryOrder.map(k=>`<option value="${k}" ${taskTimeCategory(t)===k?"selected":""}>${timeCategoryDefs[k].icon} ${timeCategoryDefs[k].name}</option>`).join("")}
      </select></div>
      <div class="cfgField"><label>预计分钟/次</label><input class="cfgEstimatedMinutes" type="number" min="1" max="480" step="5" value="${taskEstimatedMinutes(t)}"></div>
      <div class="cfgField"><label>每周目标分钟</label><input class="cfgWeeklyMinutes" type="number" min="0" max="10080" step="5" value="${taskWeeklyMinutes(t)}" title="用于任务行显示 本周已用 / 每周目标；填 0 表示不设目标"></div>
      <div class="cfgField"><label>链接 URL</label><input class="cfgUrl" value="${cfgEsc(t.url||"")}" placeholder="https://..."></div>
      <div><div class="cfgDaysLabel">执行星期</div><div class="cfgDays">${dayBoxes}</div></div>
      <div><div class="cfgDaysLabel">标记</div><div class="cfgFlags">
        <label><input type="checkbox" class="cfgEnabled" ${t.enabled!==false?"checked":""}>启用</label>
        <label><input type="checkbox" class="cfgCore" ${t.core?"checked":""}>保底</label>
        <label><input type="checkbox" class="cfgOptional" ${t.optional?"checked":""}>可选</label>
        <label><input type="checkbox" class="cfgImportant" ${t.important?"checked":""}>重要</label>
      </div></div>
      <div class="cfgField"><label>子任务（一行一个）</label><textarea class="cfgSteps" placeholder="APP签到&#10;鸣潮&#10;绝区零">${cfgEsc(stepTitles)}</textarea></div>
    </div>
    <details class="cfgAdvanced"><summary>高级：ID / Code（一般不要改）</summary>
      <div class="cfgAdvancedGrid">
        <div class="cfgField"><label>任务 ID：改了会影响旧状态</label><input class="cfgId" value="${cfgEsc(t.id)}"></div>
        <div class="cfgField"><label>隐私 Code：Gist 状态用这个</label><input class="cfgCode" value="${cfgEsc(t.code)}"></div>
      </div>
    </details>
  </div>`
}
function renderTaskEditor(){
  const list=document.getElementById("taskEditorList");
  if(!list)return;
  const cfg=normalizeTaskConfig(taskConfig||buildDefaultConfig());
  list.innerHTML=cfg.tasks.map(taskEditorRowHtml).join("");
  list.dataset.fullRender="1";
  taskEditorLog(`已加载 ${cfg.tasks.length} 个任务。`)
}
function editorRowToTask(row,idx){
  const oldCodes=(()=>{try{return JSON.parse(row.dataset.stepcodes||"[]")}catch(e){return []}})();
  const rawStepLines=(row.querySelector(".cfgSteps").value||"").split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const stepUsed=new Set();
  const steps=rawStepLines.map((title,sidx)=>{
    let code=oldCodes[sidx]||makeStepCode(stepUsed);
    if(stepUsed.has(code)||!/^s\d{2,}$/.test(code))code=makeStepCode(stepUsed);
    stepUsed.add(code);
    return {id:slugifyId(title,`step-${sidx+1}`),code,title,enabled:true}
  });
  const days=[...row.querySelectorAll(".cfgDay:checked")].map(i=>Number(i.value));
  return {
    id:row.querySelector(".cfgId").value.trim()||row.dataset.id||makeTaskId(),
    code:row.querySelector(".cfgCode").value.trim()||row.dataset.code||makeTaskCode(),
    cat:row.querySelector(".cfgCat").value,
    title:row.querySelector(".cfgTitle").value.trim()||`任务 ${idx+1}`,
    days,
    url:row.querySelector(".cfgUrl").value.trim(),
    plan_mode:normalizeTaskPlanMode(row.querySelector(".cfgPlanMode")?.value,inferTaskPlanMode({cat:row.querySelector(".cfgCat").value,title:row.querySelector(".cfgTitle").value,days})),
    time_category:normalizeTimeCategory(row.querySelector(".cfgTimeCategory")?.value,inferTaskTimeCategory({cat:row.querySelector(".cfgCat").value,title:row.querySelector(".cfgTitle").value})),
    estimated_minutes:Math.min(480,Math.max(1,Math.round(Number(row.querySelector(".cfgEstimatedMinutes")?.value)||30))),
    weekly_minutes:Math.min(10080,Math.max(0,Math.round(Number(row.querySelector(".cfgWeeklyMinutes")?.value)||0))),
    core:row.querySelector(".cfgCore").checked,
    optional:row.querySelector(".cfgOptional").checked,
    important:row.querySelector(".cfgImportant").checked,
    enabled:row.querySelector(".cfgEnabled").checked,
    steps
  };
}
function collectEditorConfig(){
  const rows=[...document.querySelectorAll(".cfgTask")];
  const list=document.getElementById("taskEditorList");
  const base=normalizeTaskConfig(taskConfig||loadLocalTaskConfig()||buildDefaultConfig());
  const edited=rows.map(editorRowToTask);
  const fullRender=list?.dataset.fullRender==="1"||(!list?.dataset.fullRender&&rows.length>=base.tasks.length);
  const tasks=fullRender
    ? edited
    : base.tasks.map(t=>edited.find(x=>x.id===t.id||x.code===t.code)||t).concat(edited.filter(t=>!base.tasks.some(x=>x.id===t.id||x.code===t.code)));
  if(!fullRender&&edited.length<base.tasks.length){
    taskEditorLog(`当前筛选只渲染 ${edited.length}/${base.tasks.length} 个任务；未显示的 ${base.tasks.length-edited.filter(t=>base.tasks.some(x=>x.id===t.id||x.code===t.code)).length} 个已保留。`);
  }
  return normalizeTaskConfig({version:4,privacy:"coded-state-keys",updatedAt:new Date().toISOString(),tasks,refs:refGroups,gameQuest:gameQuestConfig});
}
async function saveEditorConfig(){
  const btn=document.getElementById("saveConfigBtn");
  try{
    const shouldSync=!!ghToken();
    setBtnBusy(btn,true,shouldSync?"同步中…":"保存中…");
    showToast(shouldSync?"配置加密同步中…":"配置保存到本机中…","warn",1600);
    const before=normalizeTaskConfig(taskConfig||loadLocalTaskConfig()||buildDefaultConfig());
    const cfg=collectEditorConfig();
    const beforeCounts=configCounts(before);
    const nextCounts=configCounts(cfg);
    if(nextCounts.total<beforeCounts.total||nextCounts.enabled<beforeCounts.enabled-1){
      const ok=confirm(`这次保存会明显减少配置：\n\n当前：${configCountsText(before)}\n将保存：${configCountsText(cfg)}\n\n如果你不是故意清理任务，请取消。`);
      if(!ok){taskEditorLog("已取消可疑保存，配置没有覆盖。");showToast("已取消保存，配置未覆盖","warn",2200);return}
    }
    saveLocalTaskConfig(cfg,"任务编辑器保存前");
    applyTaskConfig(cfg,true);
    if(shouldSync){
      setGhStatus("GitHub：保存配置中","sync");
      await ghPatchConfig(cfg);
      setGhStatus("GitHub：已同步","on");
      taskEditorLog(`配置已保存到本机并加密同步：${cfg.tasks.length} 个任务。`);
      ghLog("任务配置已加密保存到 taskring-config.json");
      showToast("配置已保存并同步到 GitHub","ok");
    }else{
      setGhStatus("GitHub：本机模式","off");
      taskEditorLog(`配置已保存到本机：${cfg.tasks.length} 个任务。设置 Token 后可跨设备同步。`);
      showToast("配置已保存到本机","ok");
    }
  }catch(err){
    console.error(err);
    setGhStatus("GitHub：配置保存失败","err");
    taskEditorLog(String(err.message||err));
    showToast("配置保存失败，请看日志","err",3000);
  }finally{
    setBtnBusy(btn,false);
  }
}
function addEditorTask(){
  const list=document.getElementById("taskEditorList");
  const t={id:makeTaskId(),code:makeTaskCode(),cat:"life",title:"新任务",days:[today],url:"",time_category:"life",estimated_minutes:30,weekly_minutes:120,plan_mode:"weekly",enabled:true,core:false,optional:false,important:false,steps:[]};
  list.insertAdjacentHTML("afterbegin",taskEditorRowHtml(t));
  const row=list.firstElementChild;
  row?.classList.add("newFocus");
  row?.scrollIntoView({behavior:"smooth",block:"center"});
  setTimeout(()=>row?.querySelector(".cfgTitle")?.focus(),260);
  taskEditorLog("已新增任务，并跳转到编辑位置。");
  showToast("已新增任务，直接编辑即可","ok");
}
function exportEditorConfig(){
  const cfg=collectEditorConfig();
  navigator.clipboard?.writeText(JSON.stringify(cfg,null,2)).then(()=>{taskEditorLog("配置 JSON 已复制到剪贴板。");showToast("配置 JSON 已复制","ok")}).catch(()=>{taskEditorLog(JSON.stringify(cfg,null,2));showToast("复制失败，已输出到日志","warn")});
}
function importEditorConfig(){
  const raw=prompt("粘贴 taskring-config.json 内容：");
  if(!raw)return;
  try{
    const cfg=normalizeTaskConfig(JSON.parse(raw));
    taskConfig=cfg;
    renderTaskEditor();
    taskEditorLog("导入成功。确认无误后请点「保存配置并同步」。");showToast("导入成功，记得保存配置","ok");
  }catch(err){taskEditorLog("导入失败："+String(err.message||err));showToast("导入失败，请看日志","err")}
}
async function reloadSavedEditorConfig(){
  if(!confirm("确认放弃当前编辑器里尚未保存的修改，并重新载入已保存配置？"))return;
  const btn=document.getElementById("reloadSavedConfigBtn");
  try{
    setBtnBusy(btn,true,"重载中…");
    showToast("正在重载已保存配置…","warn",1300);
    if(ghToken()){
      setGhStatus("GitHub：读取配置中","sync");
      const gist=await ghFetchGist();
      const cfgResult=await ghParseConfig(gist);
      if(cfgResult.config){
        saveLocalTaskConfig(cfgResult.config);
        applyTaskConfig(cfgResult.config,true);
        renderTaskEditor();
        setGhStatus("GitHub：已同步","on");
        taskEditorLog("已从云端重载已保存配置。");
        showToast("已重载云端配置","ok");
        return;
      }
      taskEditorLog("云端没有可用配置，改用本机缓存配置。");
    }
    const localCfg=loadLocalTaskConfig();
    if(localCfg){
      applyTaskConfig(localCfg,true);
      renderTaskEditor();
      taskEditorLog("已从本机缓存重载配置。");
      showToast("已重载本机配置","ok");
      return;
    }
    const cfg=buildDefaultConfig();
    applyTaskConfig(cfg,true);
    renderTaskEditor();
    taskEditorLog("没有云端/本机配置，已回到 HTML 内置初始配置。");
    showToast("已载入内置初始配置","warn");
  }catch(err){
    console.error(err);
    taskEditorLog("重载失败："+String(err.message||err));
    showToast("重载失败，请看日志","err",3000);
  }finally{
    setBtnBusy(btn,false);
  }
}
function pickUsefulBackup(backups,current){
  const cur=configCounts(current);
  return backups.find(b=>b?.config&&((b.counts?.total||0)>cur.total||(b.counts?.enabled||0)>cur.enabled))||backups.find(b=>b?.config);
}
async function restoreLocalBackupConfig(){
  const btn=document.getElementById("restoreLocalBackupBtn");
  const backups=readLocalConfigBackups();
  if(!backups.length){taskEditorLog("本机还没有可恢复的配置备份。");showToast("本机没有配置备份","warn",2200);return}
  const current=normalizeTaskConfig(taskConfig||loadLocalTaskConfig()||buildDefaultConfig());
  const picked=pickUsefulBackup(backups,current);
  if(!picked?.config){showToast("没有可用备份","warn");return}
  const when=picked.createdAt?new Date(picked.createdAt).toLocaleString():"未知时间";
  const ok=confirm(`恢复本机备份？\n\n备份：${configCountsText(picked.config)}\n时间：${when}\n原因：${picked.reason||"自动备份"}\n\n当前配置会先进入备份池。恢复后请检查任务编辑器。`);
  if(!ok)return;
  try{
    setBtnBusy(btn,true,"恢复中…");
    const cfg=saveLocalTaskConfig(picked.config,"恢复本机备份前");
    applyTaskConfig(cfg,true);
    renderTaskEditor();
    taskEditorLog(`已恢复本机备份：${configCountsText(cfg)}。检查无误后可保存同步。`);
    showToast("已恢复本机备份，检查后再同步","ok",2600);
  }finally{
    setBtnBusy(btn,false);
  }
}
async function ghFetchGistCommits(){
  const res=await fetch(`https://api.github.com/gists/${GITHUB_GIST_ID}/commits`,{headers:ghHeaders(),cache:"no-store"});
  if(!res.ok)throw new Error(`GET gist commits failed ${res.status}: ${await res.text()}`);
  return await res.json();
}
async function ghFetchGistRevision(version){
  const res=await fetch(`https://api.github.com/gists/${GITHUB_GIST_ID}/${version}`,{headers:ghHeaders(),cache:"no-store"});
  if(!res.ok)throw new Error(`GET gist revision failed ${res.status}: ${await res.text()}`);
  return await res.json();
}
async function restorePreviousCloudConfig(){
  const btn=document.getElementById("restoreCloudPreviousBtn");
  if(!ghToken()){openGhModal();taskEditorLog("请先设置 GitHub Token，才能读取 Gist 历史版本。");showToast("请先设置 GitHub Token","warn");return}
  try{
    setBtnBusy(btn,true,"查找中…");
    setGhStatus("GitHub：查找历史版本","sync");
    const current=normalizeTaskConfig(taskConfig||loadLocalTaskConfig()||buildDefaultConfig());
    const cur=configCounts(current);
    const commits=await ghFetchGistCommits();
    let picked=null;
    let fallback=null;
    for(const item of commits.slice(1,16)){
      const version=item.version||item.sha;
      if(!version)continue;
      try{
        const gist=await ghFetchGistRevision(version);
        const parsed=await ghParseConfig(gist);
        if(!parsed.config)continue;
        const counts=configCounts(parsed.config);
        const candidate={version,committedAt:item.committed_at||item.committedAt||"",config:parsed.config,counts};
        if(!fallback)fallback=candidate;
        if(counts.total>cur.total||counts.enabled>cur.enabled){picked=candidate;break}
      }catch(err){
        console.warn("skip gist revision",version,err);
      }
    }
    picked=picked||fallback;
    if(!picked){throw new Error("没有找到可读取的上一版 taskring-config.json")}
    const when=picked.committedAt?new Date(picked.committedAt).toLocaleString():"未知时间";
    const ok=confirm(`找到云端历史配置：\n\n历史版：${configCountsText(picked.config)}\n时间：${when}\n当前：${configCountsText(current)}\n\n确认恢复并同步回云端？`);
    if(!ok){taskEditorLog("已取消云端历史恢复。");showToast("已取消恢复","warn");return}
    setBtnBusy(btn,true,"恢复中…");
    const cfg=saveLocalTaskConfig(picked.config,"恢复云端上一版前");
    applyTaskConfig(cfg,true);
    renderTaskEditor();
    await ghPatchConfig(cfg);
    setGhStatus("GitHub：已同步","on");
    ghLog(`已从 Gist 历史版本恢复配置：${picked.version}`);
    taskEditorLog(`已恢复云端上一版并同步：${configCountsText(cfg)}。`);
    showToast("已恢复云端上一版并同步","ok",3000);
  }catch(err){
    console.error(err);
    setGhStatus("GitHub：恢复失败","err");
    taskEditorLog("恢复云端上一版失败："+String(err.message||err));
    showToast("恢复失败，请看日志","err",3200);
  }finally{
    setBtnBusy(btn,false);
  }
}
function initTaskEditorUI(){
  document.getElementById("taskEditorBtn")?.addEventListener("click",()=>{closeGhModal();openTaskEditor()});
  document.getElementById("taskEditorCloseBtn")?.addEventListener("click",closeTaskEditor);
  document.getElementById("taskEditorBottomCloseBtn")?.addEventListener("click",closeTaskEditor);
  document.getElementById("saveConfigBtn")?.addEventListener("click",saveEditorConfig);
  document.getElementById("taskEditorBottomSaveBtn")?.addEventListener("click",saveEditorConfig);
  document.getElementById("exportConfigBtn")?.addEventListener("click",exportEditorConfig);
  document.getElementById("importConfigBtn")?.addEventListener("click",importEditorConfig);
  document.getElementById("reloadSavedConfigBtn")?.addEventListener("click",reloadSavedEditorConfig);
  document.getElementById("restoreLocalBackupBtn")?.addEventListener("click",restoreLocalBackupConfig);
  document.getElementById("restoreCloudPreviousBtn")?.addEventListener("click",restorePreviousCloudConfig);
  document.getElementById("taskEditorList")?.addEventListener("click",e=>{
    const btn=e.target.closest("button[data-op]");
    if(!btn)return;
    const row=btn.closest(".cfgTask");
    if(!row)return;
    const op=btn.dataset.op;
    if(op==="up"){if(row.previousElementSibling){row.parentNode.insertBefore(row,row.previousElementSibling);showToast("已上移","ok",1200)}else{row.parentNode.appendChild(row);showToast("已移动到最下面","ok",1200)}}
    if(op==="down"){if(row.nextElementSibling){row.parentNode.insertBefore(row.nextElementSibling,row);showToast("已下移","ok",1200)}else{row.parentNode.insertBefore(row,row.parentNode.firstElementChild);showToast("已移动到最上面","ok",1200)}}
    if(op==="remove"){if(confirm("确认从配置中删除这个任务？更推荐只是取消「启用」。")){row.remove();taskEditorLog("任务已从编辑器移除，保存后生效。");showToast("已移除，保存后生效","warn")}}
    if(op==="copy"){
      const cfg=collectOneEditorRow(row);
      cfg.id=makeTaskId();cfg.code=makeTaskCode();cfg.title=cfg.title+" copy";
      row.insertAdjacentHTML("afterend",taskEditorRowHtml(cfg));const nr=row.nextElementSibling;nr?.classList.add("newFocus");nr?.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>nr?.querySelector(".cfgTitle")?.focus(),260);showToast("已复制任务，直接编辑副本","ok");
    }
  });
}
function collectOneEditorRow(row){
  const tmp=[...document.querySelectorAll(".cfgTask")];
  const idx=tmp.indexOf(row);
  const oldCodes=(()=>{try{return JSON.parse(row.dataset.stepcodes||"[]")}catch(e){return []}})();
  const stepLines=(row.querySelector(".cfgSteps").value||"").split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const used=new Set();
  const steps=stepLines.map((title,i)=>{let code=oldCodes[i]||makeStepCode(used);if(used.has(code))code=makeStepCode(used);used.add(code);return{id:slugifyId(title,`step-${i+1}`),code,title,enabled:true}});
  return {
    id:row.querySelector(".cfgId").value.trim()||row.dataset.id||makeTaskId(),
    code:row.querySelector(".cfgCode").value.trim()||row.dataset.code||makeTaskCode(),
    cat:row.querySelector(".cfgCat").value,
    title:row.querySelector(".cfgTitle").value.trim()||`任务 ${idx+1}`,
    days:[...row.querySelectorAll(".cfgDay:checked")].map(i=>Number(i.value)),
    url:row.querySelector(".cfgUrl").value.trim(),
    plan_mode:normalizeTaskPlanMode(row.querySelector(".cfgPlanMode")?.value,inferTaskPlanMode({cat:row.querySelector(".cfgCat").value,title:row.querySelector(".cfgTitle").value})),
    time_category:normalizeTimeCategory(row.querySelector(".cfgTimeCategory")?.value,inferTaskTimeCategory({cat:row.querySelector(".cfgCat").value,title:row.querySelector(".cfgTitle").value})),
    estimated_minutes:Math.min(480,Math.max(1,Math.round(Number(row.querySelector(".cfgEstimatedMinutes")?.value)||30))),
    weekly_minutes:Math.min(10080,Math.max(0,Math.round(Number(row.querySelector(".cfgWeeklyMinutes")?.value)||0))),
    core:row.querySelector(".cfgCore").checked,
    optional:row.querySelector(".cfgOptional").checked,
    important:row.querySelector(".cfgImportant").checked,
    enabled:row.querySelector(".cfgEnabled").checked,
    steps
  }
}


/* === v9.0 Reference Library Editor === */
const EDITOR_SECTION_MAP={
  ref:{buttonId:"refEditorSectionToggleBtn",selector:"#refEditorList > .refCfgGroup",openText:"全部收起",closedText:"全部展开",label:"资料分组"},
  game:{buttonId:"gameQuestEditorSectionToggleBtn",selector:"#gameQuestEditorList details.gqDailyCard, #gameQuestEditorList details.gameQuestWeeklyGroup, #gameQuestEditorList details.gameQuestMetaDetails",openText:"全部收起",closedText:"全部展开",label:"游戏编辑区"}
};
function editorSectionState(kind){
  const cfg=EDITOR_SECTION_MAP[kind];
  if(!cfg)return {cfg:null,button:null,details:[]};
  return {cfg,button:document.getElementById(cfg.buttonId),details:[...document.querySelectorAll(cfg.selector)]};
}
function syncEditorSectionToggle(kind){
  const {cfg,button,details}=editorSectionState(kind);
  if(!cfg||!button)return;
  const anyOpen=details.some(detail=>detail.open);
  button.textContent=anyOpen?cfg.openText:cfg.closedText;
  button.setAttribute("aria-expanded",String(anyOpen));
  button.disabled=!details.length;
}
function toggleEditorSections(kind){
  const {cfg,details}=editorSectionState(kind);
  if(!cfg||!details.length)return;
  const shouldOpen=!details.some(detail=>detail.open);
  details.forEach(detail=>{
    detail.open=shouldOpen;
    detail.querySelector(":scope > summary")?.setAttribute("aria-expanded",String(shouldOpen));
  });
  syncEditorSectionToggle(kind);
  showToast(shouldOpen?`已展开全部${cfg.label}`:`已收起全部${cfg.label}`,"ok",1100);
}

let refEditorCounter=0;
function refEditorLog(msg){const el=document.getElementById("refEditorLog");if(el)el.textContent=`[${new Date().toLocaleTimeString()}] ${msg}\n`+el.textContent.slice(0,2500)}
function makeRefGroupId(){refEditorCounter++;return `ref-group-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(refEditorCounter).padStart(3,"0")}`}
function makeRefItemId(title,idx){return slugifyId(title,`ref-item-${idx+1}`)}
function openRefEditor(){closeControlCenter();closeGhModal();renderRefEditor();document.getElementById("refEditorModal")?.classList.remove("hidden");document.getElementById("refEditorModal")?.setAttribute("aria-hidden","false")}
function closeRefEditor(){document.getElementById("refEditorModal")?.classList.add("hidden");document.getElementById("refEditorModal")?.setAttribute("aria-hidden","true")}

function refItemEditHtml(item,idx=0){
  return `<div class="refItemEdit" data-id="${cfgEsc(item.id||makeRefItemId(item.title,idx))}">
    <div class="refMiniField">
      <label>标题</label>
      <input class="refItemTitleInput" value="${cfgEsc(item.title||"")}" placeholder="例如：生活雑務管理">
    </div>
    <div class="refMiniField">
      <label>链接</label>
      <input class="refItemUrlInput" value="${cfgEsc(item.url||"")}" placeholder="https://...（没有就留空）">
    </div>
    <div class="refMiniOps">
      <button data-refitemop="up" title="上移">↑</button>
      <button data-refitemop="down" title="下移">↓</button>
      <button data-refitemop="remove" class="ghDangerBtn" title="删除">删</button>
    </div>
  </div>`;
}
function refItemsEditorHtml(items){
  const enabled=(items||[]).filter(i=>i.enabled!==false);
  const rows=enabled.map((item,idx)=>refItemEditHtml(item,idx)).join("");
  return `<div class="refItemsBox">${rows||`<div class="refItemsEmpty">暂无条目，点下面「新增资料」添加。</div>`}</div>
    <button type="button" class="addRefItemBtn" data-refitemop="add">新增资料</button>`;
}
function collectRefItemsFromGroup(row){
  const itemRows=[...row.querySelectorAll(".refItemEdit")];
  return itemRows.map((ir,idx)=>{
    const title=ir.querySelector(".refItemTitleInput")?.value.trim()||`资料 ${idx+1}`;
    const url=ir.querySelector(".refItemUrlInput")?.value.trim()||"";
    return {id:ir.dataset.id||makeRefItemId(title,idx),title,url,enabled:true};
  });
}
function refEditorGroupHtml(g){
  return `<details class="refCfgGroup ${g.enabled===false?"disabled":""}" data-id="${cfgEsc(g.id)}" open>
    <summary class="cfgTop refCfgSummary">
      <div class="refCfgSummaryMain"><span class="cfgMini">${cfgEsc(g.id||"")}</span><b>${cfgEsc(g.title||"资料分组")}</b></div>
      <div class="cfgOps">
        <button data-refop="up">上移</button><button data-refop="down">下移</button><button data-refop="copy">复制</button><button data-refop="remove" class="ghDangerBtn">删除</button>
      </div>
    </summary>
    <div class="refCfgBody">
      <div class="refCfgGrid">
        <div>
          <div class="refCfgField"><label>分组名</label><input class="refGroupTitle" value="${cfgEsc(g.title)}"></div>
          <div class="refCfgFlags"><label><input type="checkbox" class="refGroupEnabled" ${g.enabled!==false?"checked":""}>启用</label></div>
          <details class="cfgAdvanced"><summary>高级：ID（一般不要改）</summary>
            <div class="refCfgField"><label>分组 ID</label><input class="refGroupId" value="${cfgEsc(g.id)}"></div>
          </details>
        </div>
        <div class="refCfgField"><label>资料条目</label>${refItemsEditorHtml(g.items)}<div class="refEditHint">标题和链接分开填；没有 URL 的条目会显示为普通文字，带 URL 的会显示为链接按钮。</div></div>
      </div>
    </div>
  </details>`;
}
function renderRefEditor(){
  const list=document.getElementById("refEditorList");
  if(!list)return;
  const groups=normalizeRefGroups(refGroups&&refGroups.length?refGroups:defaultRefGroups);
  list.innerHTML=groups.map(refEditorGroupHtml).join("");
  syncEditorSectionToggle("ref");
  refEditorLog(`已加载 ${groups.length} 个资料分组。`);
}
function collectRefEditorConfig(){
  const rows=[...document.querySelectorAll(".refCfgGroup")];
  return normalizeRefGroups(rows.map((row,idx)=>({
    id:row.querySelector(".refGroupId").value.trim()||row.dataset.id||makeRefGroupId(),
    title:row.querySelector(".refGroupTitle").value.trim()||`资料分组 ${idx+1}`,
    enabled:row.querySelector(".refGroupEnabled").checked,
    items:collectRefItemsFromGroup(row)
  })));
}
async function saveRefConfig(){
  const btn=document.getElementById("saveRefConfigBtn");
  try{
    const shouldSync=!!ghToken();
    setBtnBusy(btn,true,shouldSync?"同步中…":"保存中…");
    showToast(shouldSync?"资料库加密同步中…":"资料库保存到本机中…","warn",1500);
    const refs=collectRefEditorConfig();
    const base=normalizeTaskConfig(taskConfig||buildDefaultConfig());
    const cfg=normalizeTaskConfig({...base,refs,updatedAt:new Date().toISOString()});
    saveLocalTaskConfig(cfg);
    applyTaskConfig(cfg,true);
    if(shouldSync){
      setGhStatus("GitHub：保存配置中","sync");
      await ghPatchConfig(cfg);
      setGhStatus("GitHub：已同步","on");
      refEditorLog(`资料库已保存到本机并加密同步：${refs.length} 个分组。`);
      ghLog("资料库配置已合并进 taskring-config.json 并加密同步");
      showToast("资料库已保存并同步到 GitHub","ok");
    }else{
      setGhStatus("GitHub：本机模式","off");
      refEditorLog(`资料库已保存到本机：${refs.length} 个分组。`);
      showToast("资料库已保存到本机","ok");
    }
  }catch(err){
    console.error(err);
    setGhStatus("GitHub：配置保存失败","err");
    refEditorLog(String(err.message||err));
    showToast("资料库保存失败，请看日志","err",3000);
  }finally{
    setBtnBusy(btn,false);
  }
}
function addRefGroup(){
  const list=document.getElementById("refEditorList");
  const g={id:makeRefGroupId(),title:"新资料分组",enabled:true,items:[{id:"new-item",title:"新资料",url:"",enabled:true}]};
  list.insertAdjacentHTML("afterbegin",refEditorGroupHtml(g));
  const row=list.firstElementChild;
  row?.classList.add("newFocus");
  row?.scrollIntoView({behavior:"smooth",block:"center"});
  setTimeout(()=>row?.querySelector(".refGroupTitle")?.focus(),260);
  refEditorLog("已新增资料分组，并跳转到编辑位置。");
  showToast("已新增资料分组","ok");
}
function exportRefConfig(){
  const refs=collectRefEditorConfig();
  navigator.clipboard?.writeText(JSON.stringify({version:1,refs},null,2)).then(()=>{refEditorLog("资料库 JSON 已复制到剪贴板。");showToast("资料库 JSON 已复制","ok")}).catch(()=>{refEditorLog(JSON.stringify({version:1,refs},null,2));showToast("复制失败，已输出到日志","warn")});
}
function importRefConfig(){
  const raw=prompt("粘贴资料库 JSON 内容：可为 {refs:[...]} 或直接数组：");
  if(!raw)return;
  try{
    const obj=JSON.parse(raw);
    refGroups=normalizeRefGroups(Array.isArray(obj)?obj:obj.refs);
    renderRefEditor();
    refEditorLog("资料库导入成功。确认无误后请点「保存资料库并同步」。");
    showToast("资料库导入成功，记得保存","ok");
  }catch(err){
    refEditorLog("导入失败："+String(err.message||err));
    showToast("资料库导入失败","err");
  }
}
async function reloadRefConfig(){
  if(!confirm("确认放弃当前资料库编辑器里尚未保存的修改，并重新载入已保存配置？"))return;
  await reloadSavedEditorConfig();
  renderRefEditor();
}
function initRefEditorUI(){
  document.getElementById("refEditorBtn")?.addEventListener("click",()=>{closeGhModal();openRefEditor()});
  document.getElementById("refEditorCloseBtn")?.addEventListener("click",closeRefEditor);
  document.getElementById("refEditorBottomCloseBtn")?.addEventListener("click",closeRefEditor);
  document.getElementById("addRefGroupBtn")?.addEventListener("click",addRefGroup);
  document.getElementById("saveRefConfigBtn")?.addEventListener("click",saveRefConfig);
  document.getElementById("refEditorBottomSaveBtn")?.addEventListener("click",saveRefConfig);
  document.getElementById("exportRefConfigBtn")?.addEventListener("click",exportRefConfig);
  document.getElementById("importRefConfigBtn")?.addEventListener("click",importRefConfig);
  document.getElementById("reloadRefConfigBtn")?.addEventListener("click",reloadRefConfig);
  document.getElementById("refEditorSectionToggleBtn")?.addEventListener("click",()=>toggleEditorSections("ref"));
  document.getElementById("refEditorList")?.addEventListener("toggle",()=>syncEditorSectionToggle("ref"),true);
  document.getElementById("refEditorList")?.addEventListener("click",e=>{
    const itemBtn=e.target.closest("button[data-refitemop]");
    if(itemBtn){
      e.preventDefault();
      e.stopPropagation();
      const group=itemBtn.closest(".refCfgGroup");
      const box=group?.querySelector(".refItemsBox");
      const itemRow=itemBtn.closest(".refItemEdit");
      const op=itemBtn.dataset.refitemop;
      if(op==="add"){
        box?.querySelector(".refItemsEmpty")?.remove();
        const title="新资料";
        box?.insertAdjacentHTML("beforeend",refItemEditHtml({id:makeRefItemId(title,Date.now()),title,url:""},999));
        const nr=box?.lastElementChild;
        nr?.classList.add("newFocus");
        nr?.scrollIntoView({behavior:"smooth",block:"center"});
        setTimeout(()=>nr?.querySelector(".refItemTitleInput")?.focus(),220);
        refEditorLog("已新增资料条目。");
        showToast("已新增资料条目","ok");
      }
      if(op==="remove"&&itemRow){
        itemRow.remove();
        if(box && !box.querySelector(".refItemEdit"))box.innerHTML=`<div class="refItemsEmpty">暂无条目，点下面「新增资料」添加。</div>`;
        refEditorLog("资料条目已删除，保存后生效。");
        showToast("已删除资料条目，保存后生效","warn");
      }
      if(op==="up"&&itemRow){
        const prev=itemRow.previousElementSibling;
        if(prev&&prev.classList.contains("refItemEdit"))box.insertBefore(itemRow,prev);
        else box.appendChild(itemRow);
        showToast("资料条目已上移","ok",1200);
      }
      if(op==="down"&&itemRow){
        const next=itemRow.nextElementSibling;
        if(next&&next.classList.contains("refItemEdit"))box.insertBefore(next,itemRow);
        else box.insertBefore(itemRow,box.querySelector(".refItemEdit"));
        showToast("资料条目已下移","ok",1200);
      }
      return;
    }
    const btn=e.target.closest("button[data-refop]");
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    const row=btn.closest(".refCfgGroup");
    if(!row)return;
    const op=btn.dataset.refop;
    if(op==="up"){if(row.previousElementSibling){row.parentNode.insertBefore(row,row.previousElementSibling);showToast("已上移","ok",1200)}else{row.parentNode.appendChild(row);showToast("已移动到最下面","ok",1200)}}
    if(op==="down"){if(row.nextElementSibling){row.parentNode.insertBefore(row.nextElementSibling,row);showToast("已下移","ok",1200)}else{row.parentNode.insertBefore(row,row.parentNode.firstElementChild);showToast("已移动到最上面","ok",1200)}}
    if(op==="remove"){if(confirm("确认删除这个资料分组？保存后生效。")){row.remove();refEditorLog("资料分组已从编辑器移除，保存后生效。");showToast("已移除，保存后生效","warn")}}
    if(op==="copy"){
      const cfg=collectOneRefGroup(row);
      cfg.id=makeRefGroupId();
      cfg.title=cfg.title+" copy";
      row.insertAdjacentHTML("afterend",refEditorGroupHtml(cfg));
      const nr=row.nextElementSibling;
      nr?.classList.add("newFocus");
      nr?.scrollIntoView({behavior:"smooth",block:"center"});
      setTimeout(()=>nr?.querySelector(".refGroupTitle")?.focus(),260);
      showToast("已复制资料分组","ok");
    }
  });
}
function collectOneRefGroup(row){
  return {
    id:row.querySelector(".refGroupId").value.trim()||row.dataset.id||makeRefGroupId(),
    title:row.querySelector(".refGroupTitle").value.trim()||"资料分组",
    enabled:row.querySelector(".refGroupEnabled").checked,
    items:collectRefItemsFromGroup(row)
  };
}

function weekPos(dayId){return dayId===0?6:dayId-1}
function sortWeekDays(arr){return [...arr].sort((a,b)=>weekPos(a)-weekPos(b))}
function lastScheduledDay(t){const s=sortWeekDays(t.days);return s[s.length-1]}
function isLastScheduled(t,dayId){return dayId===lastScheduledDay(t)}
function previousScheduledBeforeToday(t){const p=sortWeekDays(t.days).filter(d=>weekPos(d)<weekPos(today));return p.length?p[p.length-1]:null}

function storageKey(taskId,dayId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_d${dayId}`}
function stepStorageKey(taskId,stepId,dayId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_${stepCode(taskId,stepId)}_d${dayId}`}
function hasSteps(taskId){return Array.isArray(stepTasks[taskId])&&stepTasks[taskId].length>0}
function isStepDone(taskId,stepId,dayId,cycle=cycleYmd){return localStorage.getItem(stepStorageKey(taskId,stepId,dayId,cycle))==="1"}
function setStepDoneRaw(taskId,stepId,dayId,val,cycle=cycleYmd){const k=stepStorageKey(taskId,stepId,dayId,cycle);syncSetItem(k,val)}
function areAllStepsDone(taskId,dayId,cycle=cycleYmd){if(!hasSteps(taskId))return false;return stepTasks[taskId].every(s=>isStepDone(taskId,s.id,dayId,cycle))}
function isDone(taskId,dayId,cycle=cycleYmd){return localStorage.getItem(storageKey(taskId,dayId,cycle))==="1"}
function ignoreStorageKey(taskId,dayId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_${taskCode(taskId)}_x${dayId}`}
function isIgnoredOccurrence(t,dayId,cycle=cycleYmd){return localStorage.getItem(ignoreStorageKey(t.id,dayId,cycle))==="1"}
function setIgnoredOccurrence(t,dayId,cycle=cycleYmd,val=true){const k=ignoreStorageKey(t.id,dayId,cycle);syncSetItem(k,val)}
function isRawExpiredDaily(t,dayId,cycle=cycleYmd){if(cycle!==cycleYmd)return false;if(isDone(t.id,dayId,cycle))return false;if(isIgnoredOccurrence(t,dayId,cycle))return false;if(weekPos(dayId)>=weekPos(today))return false;if(t.days.length<=1)return false;return !isLastScheduled(t,dayId)}
function isFailedOccurrence(t,dayId,cycle=cycleYmd){return isRawExpiredDaily(t,dayId,cycle)}
function isOverdueOccurrence(t,dayId,cycle=cycleYmd){if(isIgnoredOccurrence(t,dayId,cycle))return false;if(isDone(t.id,dayId,cycle))return false;if(cycle!==cycleYmd)return true;if(weekPos(dayId)>=weekPos(today))return false;if(t.days.length<=1)return true;return isLastScheduled(t,dayId)}
function isWarnOccurrence(t,dayId,cycle=cycleYmd){if(cycle!==cycleYmd||dayId!==today||!t.days.includes(today))return false;const prev=previousScheduledBeforeToday(t);if(prev==null)return false;return !isIgnoredOccurrence(t,prev,cycleYmd)&&!isDone(t.id,prev,cycleYmd)&&isFailedOccurrence(t,prev,cycleYmd)}
function occurrenceState(t,dayId,cycle=cycleYmd){return{done:isDone(t.id,dayId,cycle),ignored:isIgnoredOccurrence(t,dayId,cycle),failed:isFailedOccurrence(t,dayId,cycle),overdue:isOverdueOccurrence(t,dayId,cycle),warn:isWarnOccurrence(t,dayId,cycle),prev:cycle!==cycleYmd}}
function statusBadges(st){
  let out="";
  if(st.ignored)out+=`<span class="statusBadge ignored" title="已忽略">忽</span>`;
  if(st.prev)out+=`<span class="statusBadge prev" title="上周遗留">旧</span>`;
  if(st.overdue)out+=`<span class="statusBadge overdue" title="原定日已过，可延后完成">延</span>`;
  if(st.failed)out+=`<span class="statusBadge failed" title="已自动打差，无法补签">锁</span>`;
  if(st.warn)out+=`<span class="statusBadge warn" title="上次未完成，今天注意补节奏">补</span>`;
  return out;
}
function occurrenceMeta(t,dayId,cycle=cycleYmd){
  const st=occurrenceState(t,dayId,cycle);
  if(st.warn)return `<span class='missNote' title="上次未完成，今天注意补节奏">前次未完</span>`;
  if(st.failed||st.overdue||st.prev||st.ignored){
    const originText=st.prev?`上周${dayName(dayId)}`:dayName(dayId);
    const action=st.failed?"锁定":st.overdue?"可补":st.ignored?"忽略":"遗留";
    return `<span class="originDay">原 ${originText}</span><span class="metaSep">·</span><span class='missNote'>${action}</span>`;
  }
  return "";
}


/* === v11.0 Time Budget Ring runtime === */
function applyActiveAppView(){
  if(!APP_VIEWS.has(activeAppView))activeAppView="tasks";
  document.body.dataset.appView=activeAppView;
  document.querySelectorAll("[data-view-panel]").forEach(panel=>{
    const isActive=panel.dataset.viewPanel===activeAppView;
    panel.classList.toggle("active",isActive);
    panel.setAttribute("aria-hidden",isActive?"false":"true");
  });
  document.querySelectorAll("[data-view-target]").forEach(btn=>{
    const isActive=btn.dataset.viewTarget===activeAppView;
    btn.classList.toggle("active",isActive);
    btn.setAttribute("aria-pressed",isActive?"true":"false");
    if(btn.matches(".viewDockBtn"))btn.setAttribute("aria-current",isActive?"page":"false");
  });
}
function setActiveAppView(view){
  const next=APP_VIEWS.has(view)?view:"tasks";
  activeAppView=next;
  localStorage.setItem(APP_VIEW_KEY,next);
  applyActiveAppView();
  if(next==="time")renderTimePanel();
  if(next==="weekly")renderWeeklyPlanPanel();
  if(next==="game")renderGameQuestPanel();
}
const UI_SCROLL_SELECTORS=[".viewDock",".weeklyCategoryTabs",".gameQuestModeTabs",".gameQuestFilterTabs",".gameQuestGameTabs",".gameQuestDays",".timeSubTabs",".dayTabs",".taskEditorList",".refEditorList",".gameQuestEditorList"];
let restoreUiScrollFromStorage=true;
let uiScrollSaveTimer=null;
function readUiScrollState(){try{return JSON.parse(localStorage.getItem(UI_SCROLL_STATE_KEY)||"{}")||{}}catch(e){return {}}}
function collectUiScrollState(){
  const state={window:{x:window.scrollX||0,y:window.scrollY||0},activeAppView,viewMode,mobileDay,lists:{}};
  UI_SCROLL_SELECTORS.forEach(selector=>{
    document.querySelectorAll(selector).forEach((el,idx)=>{
      if(!el)return;
      state.lists[`${selector}|${idx}`]={left:el.scrollLeft||0,top:el.scrollTop||0};
    });
  });
  return state;
}
function restoreUiScrollState(state){
  if(!state||typeof state!=="object")return;
  const apply=()=>{
    Object.entries(state.lists||{}).forEach(([key,pos])=>{
      const [selector,idxText]=key.split("|");
      const el=document.querySelectorAll(selector)[Number(idxText)||0];
      if(el&&pos){el.scrollLeft=Number(pos.left)||0;el.scrollTop=Number(pos.top)||0}
    });
    if(state.window){
      window.scrollTo(Number(state.window.x)||0,Number(state.window.y)||0);
    }
  };
  requestAnimationFrame(()=>requestAnimationFrame(apply));
}
function saveUiScrollStateNow(){localStorage.setItem(UI_SCROLL_STATE_KEY,JSON.stringify(collectUiScrollState()))}
function scheduleUiScrollSave(){clearTimeout(uiScrollSaveTimer);uiScrollSaveTimer=setTimeout(saveUiScrollStateNow,120)}
window.addEventListener("scroll",scheduleUiScrollSave,{passive:true});
window.addEventListener("pagehide",saveUiScrollStateNow);
window.addEventListener("beforeunload",saveUiScrollStateNow);
document.addEventListener("scroll",e=>{
  const el=e.target;
  if(!(el instanceof Element))return;
  if(UI_SCROLL_SELECTORS.some(selector=>el.matches(selector)))scheduleUiScrollSave();
},true);
function persistDailyViewState(){localStorage.setItem(UI_VIEW_MODE_KEY,viewMode);localStorage.setItem(UI_MOBILE_DAY_KEY,String(mobileDay))}
function setDailyViewMode(mode){
  viewMode=["undone","today","all"].includes(mode)?mode:"undone";
  if(viewMode!=="all")mobileDay=today;
  persistDailyViewState();
  renderAll();
}

const TIME_ACTIVE_KEY="taskring_time_active_v1";
const TIME_LOGS_KEY="taskring_time_logs_v1";
const TIME_LOG_LIMIT=800;
const TIME_GH_LOG_LIMIT=600;
const TIME_LOG_DELETED_KEY="taskring_time_log_deleted_v1";
const TIME_GH_DELETED_LIMIT=1200;
const TIME_LEDGER_VIEW_KEY="taskring_time_ledger_view_v1";
const TIME_LEDGER_VIEWS=new Set(["overview","tasks","logs"]);
let timeLedgerView=TIME_LEDGER_VIEWS.has(localStorage.getItem(TIME_LEDGER_VIEW_KEY))?localStorage.getItem(TIME_LEDGER_VIEW_KEY):"overview";
function readJsonLocal(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(e){console.warn("local json parse failed",key,e);return fallback}}
function writeJsonLocal(key,value){localStorage.setItem(key,JSON.stringify(value))}
function trimDeletedTimeLogMap(map,limit=TIME_GH_DELETED_LIMIT){
  return Object.fromEntries(Object.entries(map||{}).filter(([id])=>id).sort((a,b)=>String(b[1]||"").localeCompare(String(a[1]||""))).slice(0,limit));
}
function normalizeDeletedTimeLogMap(value){
  const raw=Array.isArray(value)?Object.fromEntries(value.map(id=>[id,""])):(value&&typeof value==="object"?value:{});
  const fallbackTs=new Date(0).toISOString();
  const out={};
  Object.entries(raw).forEach(([id,ts])=>{if(id)out[String(id)]=String(ts||fallbackTs)});
  return trimDeletedTimeLogMap(out);
}
function readDeletedTimeLogMap(){return normalizeDeletedTimeLogMap(readJsonLocal(TIME_LOG_DELETED_KEY,{}))}
function writeDeletedTimeLogMap(map,shouldSync=true){writeJsonLocal(TIME_LOG_DELETED_KEY,trimDeletedTimeLogMap(map));if(shouldSync)scheduleGhSave()}
function markTimeLogDeleted(logId,shouldSync=true){const deleted=readDeletedTimeLogMap();deleted[String(logId)]=new Date().toISOString();writeDeletedTimeLogMap(deleted,shouldSync)}
function collectGhDeletedTimeLogs(){return readDeletedTimeLogMap()}
function mergeGhTimeLogDeletes(cloudDeleted={}){
  const before=readDeletedTimeLogMap();
  const cloud=normalizeDeletedTimeLogMap(cloudDeleted);
  const merged={...before};
  Object.entries(cloud).forEach(([id,ts])=>{if(!merged[id]||String(ts)>String(merged[id]))merged[id]=ts});
  const trimmed=trimDeletedTimeLogMap(merged);
  const changed=JSON.stringify(trimmed)!==JSON.stringify(before);
  if(changed)writeDeletedTimeLogMap(trimmed,false);
  return {changed,count:Object.keys(trimmed).length};
}
function readActiveTimer(){const t=readJsonLocal(TIME_ACTIVE_KEY,null);return t&&t.kind?normalizeActiveTimer(t):null}
function normalizeActiveTimer(t){return {...t,accumulated_seconds:Number(t.accumulated_seconds||0),paused:!!t.paused}}
function writeActiveTimer(t){writeJsonLocal(TIME_ACTIVE_KEY,t)}
function clearActiveTimer(){localStorage.removeItem(TIME_ACTIVE_KEY)}
function normalizeTimeLog(log){
  if(!log||!log.id)return null;
  const duration=Math.round(Number(log.duration_minutes||0));
  if(!duration)return null;
  const taskId=log.task_id||taskIdFromCode?.(log.task_code)||"";
  const task=taskId?taskById(taskId):null;
  const title=String(log.title||task?.title||"计时记录");
  return {
    id:String(log.id),
    kind:log.kind||"task",
    task_id:taskId||String(log.task_id||""),
    task_code:log.task_code||taskCode(taskId||log.task_id||""),
    title,
    category:normalizeTimeCategory(log.category||task?.time_category||task?.timeCategory||task?.cat),
    cycle:String(log.cycle||cycleYmd),
    day_id:Number(log.day_id??today),
    started_at:log.started_at||log.created_at||log.ended_at||new Date().toISOString(),
    ended_at:log.ended_at||log.created_at||new Date().toISOString(),
    duration_minutes:duration,
    duration_seconds:Math.max(0,Math.round(Number(log.duration_seconds||duration*60))),
    source:log.source||"timer",
    status:log.status||"completed"
  };
}
function readTimeLogs(){const deleted=readDeletedTimeLogMap();return readJsonLocal(TIME_LOGS_KEY,[]).map(normalizeTimeLog).filter(Boolean).filter(log=>!deleted[log.id])}
function writeTimeLogs(logs,shouldSync=true){
  const deleted=readDeletedTimeLogMap();
  const normalized=(logs||[]).map(normalizeTimeLog).filter(Boolean).filter(log=>!deleted[log.id]).slice(-TIME_LOG_LIMIT);
  writeJsonLocal(TIME_LOGS_KEY,normalized);
  if(shouldSync)scheduleGhSave();
}
function collectGhTimeLogs(){return readTimeLogs().slice(-TIME_GH_LOG_LIMIT)}
function mergeGhTimeLogs(cloudLogs=[]){
  const before=readTimeLogs();
  const deleted=readDeletedTimeLogMap();
  const map=new Map();
  before.forEach(log=>map.set(log.id,log));
  (Array.isArray(cloudLogs)?cloudLogs:[]).map(normalizeTimeLog).filter(Boolean).forEach(log=>{
    if(deleted[log.id])return;
    const old=map.get(log.id);
    if(!old||String(log.ended_at||"")>String(old.ended_at||""))map.set(log.id,log);
  });
  const merged=[...map.values()].sort((a,b)=>String(a.ended_at||"").localeCompare(String(b.ended_at||""))).slice(-TIME_LOG_LIMIT);
  const changed=merged.length!==before.length||merged.some((log,i)=>log.id!==before[i]?.id||log.duration_minutes!==before[i]?.duration_minutes);
  if(changed)writeTimeLogs(merged,false);
  return {changed,count:merged.length,added:Math.max(0,merged.length-before.length)};
}
function activeTimerKey(t){return t?`${t.kind}:${t.task_id}:${t.cycle}:d${t.day_id}`:""}
function occurrenceTimerKey(taskId,dayId,cycle=cycleYmd){return `task:${taskId}:${cycle}:d${dayId}`}
function secondsSince(iso){if(!iso)return 0;const d=new Date(iso);if(Number.isNaN(d.getTime()))return 0;return Math.max(0,Math.floor((Date.now()-d.getTime())/1000))}
function activeTimerElapsedSeconds(timer=readActiveTimer()){if(!timer)return 0;return Math.max(0,Math.floor(Number(timer.accumulated_seconds||0)+(timer.paused?0:secondsSince(timer.started_at))))}
function fmtTimer(seconds){seconds=Math.max(0,Math.floor(seconds||0));const h=Math.floor(seconds/3600);const m=Math.floor((seconds%3600)/60);const s=seconds%60;return h?`${h}:${pad(m)}:${pad(s)}`:`${pad(m)}:${pad(s)}`}
function fmtMinutes(mins){mins=Math.round(Number(mins)||0);const h=Math.floor(mins/60);const m=mins%60;return h&&m?`${h}h ${m}m`:h?`${h}h`:`${m}m`}
function timeCategoryLabel(cat){const c=timeCategoryDefs[normalizeTimeCategory(cat)]||timeCategoryDefs.life;return c.short}
function timeLogOperationalDate(log){const d=new Date(log.ended_at||log.created_at||Date.now());return getOperationalDate(d)}
function isLogInCurrentCycle(log){const end=new Date(log.ended_at||log.created_at||0);return end>=cycleStart&&end<cycleEnd}
function isLogToday(log){return ymd(timeLogOperationalDate(log))===ymd(operationalNow)}
function logsByCategory(filterFn=()=>true){const totals={};readTimeLogs().filter(filterFn).forEach(log=>{const cat=normalizeTimeCategory(log.category);totals[cat]=(totals[cat]||0)+Number(log.duration_minutes||0)});return totals}
function weekTimeTotals(){return logsByCategory(isLogInCurrentCycle)}
function todayTimeTotals(){return logsByCategory(isLogToday)}
function taskLogKey(log){return `${log.kind||"task"}:${log.task_id||log.task_code||log.title||"unknown"}`}
function taskLogMatches(log,taskId){
  const code=taskCode(taskId);
  return String(log.task_id||"")===String(taskId)||String(log.task_code||"")===String(code);
}
function taskMinutesFor(taskId,filterFn=()=>true){
  return readTimeLogs().filter(log=>taskLogMatches(log,taskId)&&filterFn(log)).reduce((sum,log)=>sum+Number(log.duration_minutes||0),0);
}
function taskWeekMinutesUsed(taskId){return taskMinutesFor(taskId,isLogInCurrentCycle)}
function taskTodayMinutesUsed(taskId){return taskMinutesFor(taskId,isLogToday)}
function taskWeekTargetLabel(task){
  const used=taskWeekMinutesUsed(task.id);
  const target=taskWeeklyMinutes(task);
  return target?`${fmtMinutes(used)} / ${fmtMinutes(target)}`:fmtMinutes(used);
}
function weekTaskTotals(){
  const map=new Map();
  readTimeLogs().filter(isLogInCurrentCycle).forEach(log=>{
    const key=taskLogKey(log);
    const old=map.get(key)||{key,kind:log.kind||"task",task_id:log.task_id||"",title:log.title||"计时记录",category:normalizeTimeCategory(log.category),minutes:0};
    old.minutes+=Number(log.duration_minutes||0);
    old.title=log.title||old.title;
    old.category=normalizeTimeCategory(log.category||old.category);
    map.set(key,old);
  });
  return [...map.values()].sort((a,b)=>b.minutes-a.minutes);
}
function timeLogSortDesc(a,b){return String(b.ended_at||"").localeCompare(String(a.ended_at||""))}
function fmtLogWhen(log){
  const d=new Date(log.ended_at||log.created_at||Date.now());
  if(Number.isNaN(d.getTime()))return "--/-- --:--";
  return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function timeLogSourceLabel(log){return log?.source==="manual"?" · 手动补记":""}
function localDateTimeInputValue(date=new Date()){
  const d=new Date(date);
  if(Number.isNaN(d.getTime()))return "";
  return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function manualTimeEntryTarget(kind,taskId=""){
  if(kind==="gamequest")return {kind:"gamequest",task_id:"gamequest-board",task_code:"gq-board",title:"游戏作战区",category:"game",estimated_minutes:60};
  const task=taskById(taskId);
  if(!task)return null;
  return {kind:"task",task_id:task.id,task_code:taskCode(task.id),title:task.title,category:taskTimeCategory(task),estimated_minutes:taskEstimatedMinutes(task)};
}
function openManualTimeEntry(kind,taskId=""){
  const target=manualTimeEntryTarget(kind,taskId);
  if(!target){showToast("找不到要补记的任务","err");return}
  const nowValue=localDateTimeInputValue();
  const defaultMinutes=Math.max(1,Math.round(Number(target.estimated_minutes)||30));
  const body=`<form class="manualTimeForm" data-manual-time-form>
    <input type="hidden" name="kind" value="${escapeHtml(target.kind)}">
    <input type="hidden" name="taskId" value="${escapeHtml(target.task_id)}">
    <div class="manualTimeIntro"><span aria-hidden="true">+◷</span><div><b>补上忘记开始的时间</b><em>会与正常计时一样进入今日、本周和同步统计。</em></div></div>
    <label class="manualTimeField"><span>投入时长（分钟）</span><input name="minutes" type="number" min="1" max="10080" step="1" value="${defaultMinutes}" inputmode="numeric" required></label>
    <div class="manualTimePresets" aria-label="快速选择时长">${[15,30,60,90].map(minutes=>`<button type="button" data-manual-minutes-preset="${minutes}">${minutes}m</button>`).join("")}</div>
    <label class="manualTimeField"><span>完成时间</span><input name="endedAt" type="datetime-local" value="${nowValue}" max="${nowValue}" required><em>深夜 04:00 前按前一天计入，与现有计时规则一致。</em></label>
    <div class="manualTimeActions"><button type="button" data-time-modal-close>取消</button><button type="submit" class="manualTimeSubmit">保存补记</button></div>
  </form>`;
  openTimeDetailModal(`手动补记 · ${target.title}`,body);
  requestAnimationFrame(()=>document.querySelector("[data-manual-time-form] input[name='minutes']")?.select());
}
function saveManualTimeEntry(form){
  const data=new FormData(form);
  const target=manualTimeEntryTarget(String(data.get("kind")||"task"),String(data.get("taskId")||""));
  if(!target){showToast("找不到要补记的任务","err");return}
  const minutes=Math.round(Number(data.get("minutes")));
  if(!Number.isFinite(minutes)||minutes<1||minutes>10080){showToast("请输入 1–10080 分钟","err");return}
  const endedAt=new Date(String(data.get("endedAt")||""));
  if(Number.isNaN(endedAt.getTime())){showToast("请选择正确的完成时间","err");return}
  if(endedAt.getTime()>Date.now()+60000){showToast("完成时间不能在未来","err");return}
  const operationalEnded=getOperationalDate(endedAt);
  const log={
    id:`time_manual_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    kind:target.kind,
    task_id:target.task_id,
    task_code:target.task_code,
    title:target.title,
    category:normalizeTimeCategory(target.category),
    cycle:ymd(getCycleStart(endedAt)),
    day_id:operationalEnded.getDay(),
    started_at:new Date(endedAt.getTime()-minutes*60000).toISOString(),
    ended_at:endedAt.toISOString(),
    duration_minutes:minutes,
    duration_seconds:minutes*60,
    source:"manual",
    status:"completed"
  };
  const logs=readTimeLogs();
  logs.push(log);
  writeTimeLogs(logs);
  closeTimeDetailModal();
  showToast(`已补记 ${fmtMinutes(minutes)}：${target.title}`,"ok",1800);
  renderAll();
}
function ensureTimeDetailModal(){
  let m=document.getElementById("timeDetailModal");
  if(m)return m;
  m=document.createElement("div");
  m.id="timeDetailModal";
  m.className="timeDetailModal hidden";
  m.setAttribute("aria-hidden","true");
  m.innerHTML=`<div class="timeDetailCard" role="dialog" aria-modal="true"><div class="timeDetailHead"><div><span>TIME LEDGER / DETAIL</span><b id="timeDetailTitle" class="timeDetailTitle">时间明细</b><em>投入、目标与最近记录</em></div><button type="button" class="timeDetailClose" data-time-modal-close title="关闭" aria-label="关闭">×</button></div><div class="timeDetailBody" id="timeDetailBody"></div></div>`;
  document.body.appendChild(m);
  return m;
}
function openTimeDetailModal(title,bodyHtml){
  const m=ensureTimeDetailModal();
  const titleEl=m.querySelector("#timeDetailTitle");
  const bodyEl=m.querySelector("#timeDetailBody");
  if(titleEl)titleEl.textContent=title||"时间明细";
  if(bodyEl)bodyEl.innerHTML=bodyHtml||"";
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden","false");
}
function closeTimeDetailModal(){const m=document.getElementById("timeDetailModal");if(!m)return;m.classList.add("hidden");m.setAttribute("aria-hidden","true")}
function deleteTimeLog(logId){
  const logs=readTimeLogs();
  const target=logs.find(log=>log.id===logId);
  if(!target){showToast("找不到这条记录","err");return}
  if(!confirm(`删除这条时间记录？\n${target.title} · ${fmtMinutes(target.duration_minutes)} · ${fmtLogWhen(target)}`))return;
  markTimeLogDeleted(logId,false);
  writeTimeLogs(logs.filter(log=>log.id!==logId));
  showToast("已删除时间记录","warn",1400);
  closeTimeDetailModal();
  renderAll();
}
function openTaskTimeDetail(taskId){
  const task=taskById(taskId);
  if(!task){showToast("找不到任务时间明细","err");return}
  const all=readTimeLogs().filter(log=>taskLogMatches(log,taskId)).sort(timeLogSortDesc);
  const week=all.filter(isLogInCurrentCycle);
  const todayLogs=all.filter(isLogToday);
  const used=week.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0);
  const todayUsed=todayLogs.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0);
  const allUsed=all.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0);
  const target=taskWeeklyMinutes(task);
  const pct=target?Math.min(160,Math.round(used/target*100)):0;
  const lines=week.slice(0,14).map(log=>`<li><span>${fmtLogWhen(log)}${timeLogSourceLabel(log)}</span><b>${fmtMinutes(log.duration_minutes)}</b><button type="button" data-time-log-delete="${escapeHtml(log.id)}">删除</button></li>`).join("")||`<li class="empty"><span>本周还没有计时记录</span><b>0m</b></li>`;
  const body=`<button type="button" class="timeDetailAddButton" data-manual-time-entry="task" data-manual-task-id="${escapeHtml(task.id)}">+手动补记时间</button><div class="timeDetailStats"><div><span>今日</span><b>${fmtMinutes(todayUsed)}</b></div><div><span>本周</span><b>${fmtMinutes(used)}</b></div><div><span>累计</span><b>${fmtMinutes(allUsed)}</b></div></div><div class="timeDetailProgress ${target&&used>target?"over":""}" style="--w:${target?Math.min(100,pct):0}%"><div><span>本周目标</span><b>${target?`${fmtMinutes(used)} / ${fmtMinutes(target)}`:"未设置目标"}</b></div><i></i></div><ul class="timeDetailLogs">${lines}</ul>`;
  openTimeDetailModal(task.title,body);
}
function openGameQuestTimeDetail(){
  const all=readTimeLogs().filter(log=>(log.kind==="gamequest"||log.task_id==="gamequest-board")).sort(timeLogSortDesc);
  const week=all.filter(isLogInCurrentCycle);
  const todayLogs=all.filter(isLogToday);
  const active=readActiveTimer();
  const activeMinutes=active&&active.kind==="gamequest"?Math.max(1,Math.round(activeTimerElapsedSeconds(active)/60)):0;
  const used=week.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeMinutes;
  const todayUsed=todayLogs.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeMinutes;
  const allUsed=all.reduce((sum,log)=>sum+Number(log.duration_minutes||0),0)+activeMinutes;
  const lines=week.slice(0,20).map(log=>`<li><span>${fmtLogWhen(log)} · ${escapeHtml(log.title)}${timeLogSourceLabel(log)}</span><b>${fmtMinutes(log.duration_minutes)}</b><button type="button" data-time-log-delete="${escapeHtml(log.id)}">删除</button></li>`).join("")||`<li class="empty"><span>本周还没有游戏作战区记录</span><b>0m</b></li>`;
  const body=`<button type="button" class="timeDetailAddButton" data-manual-time-entry="gamequest">+手动补记时间</button><div class="timeDetailStats"><div><span>今日</span><b>${fmtMinutes(todayUsed)}</b></div><div><span>本周</span><b>${fmtMinutes(used)}</b></div><div><span>累计</span><b>${fmtMinutes(allUsed)}</b></div></div><div class="timeDetailProgress" style="--w:${used?100:0}%"><div><span>统计方式</span><b>游戏作战区整体计时${activeMinutes?` · 当前 ${fmtMinutes(activeMinutes)}`:""}</b></div><i></i></div><ul class="timeDetailLogs">${lines}</ul>`;
  openTimeDetailModal("游戏作战区",body);
}
function setTimeLedgerView(view){
  timeLedgerView=TIME_LEDGER_VIEWS.has(view)?view:"overview";
  localStorage.setItem(TIME_LEDGER_VIEW_KEY,timeLedgerView);
  renderTimePanel();
}
async function updateTaskWeeklyTarget(taskId,minutes){
  const cfg=normalizeTaskConfig(taskConfig||buildDefaultConfig());
  const task=cfg.tasks.find(t=>t.id===taskId);
  if(!task){showToast("找不到任务目标","err");return}
  task.weekly_minutes=Math.min(10080,Math.max(0,Math.round(Number(minutes)||0)));
  const next=saveLocalTaskConfig(cfg);
  applyTaskConfig(next,true);
  showToast(`已更新每周目标：${task.title} → ${fmtMinutes(task.weekly_minutes)}`,"ok",1600);
  if(ghToken()){
    try{setGhStatus("GitHub：保存配置中","sync");await ghPatchConfig(next);setGhStatus("GitHub：已同步","on");ghLog("时间目标已保存到 taskring-config.json")}
    catch(err){console.error(err);setGhStatus("GitHub：配置保存失败","err");ghLog(String(err.message||err));showToast("目标已本地保存，云端同步失败","warn",2600)}
  }
}
function currentActiveTask(){const timer=readActiveTimer();if(!timer)return null;return blocks.find(t=>t.id===timer.task_id)||taskById(timer.task_id)}
function startTaskTimer(taskId,dayId,cycle=cycleYmd){
  const task=blocks.find(t=>t.id===taskId)||taskById(taskId);
  if(!task){showToast("找不到这个任务","err");return}
  const normalizedDay=Number.isFinite(Number(dayId))?Number(dayId):today;
  if(!isWeeklyPoolTask(task)){
    const st=occurrenceState(task,normalizedDay,cycle);
    if(st.failed||st.ignored){showToast("这个任务已锁定/忽略，不能计时","warn");return}
  }
  const active=readActiveTimer();
  if(active){
    if(activeTimerKey(active)===occurrenceTimerKey(taskId,normalizedDay,cycle)){showToast(active.paused?"计时已暂停，可点继续":"已经在计时中","warn");return}
    const ok=confirm(`当前正在计时：${active.title}（${fmtTimer(activeTimerElapsedSeconds(active))}）。\n\n要先完成并记录它，然后开始「${task.title}」吗？`);
    if(!ok)return;
    completeActiveTimer(true);
  }
  const now=new Date().toISOString();
  writeActiveTimer({
    kind:"task",
    task_id:task.id,
    day_id:normalizedDay,
    cycle,
    title:task.title,
    category:taskTimeCategory(task),
    estimated_minutes:taskEstimatedMinutes(task),
    first_started_at:now,
    started_at:now,
    accumulated_seconds:0,
    paused:false,
    paused_at:null
  });
  showToast(`开始计时：${task.title}`,"ok",1300);
  renderAll();
}
function startGameQuestTimer(dayId=gameQuestSelectedDay,cycle=cycleYmd){
  const normalizedDay=Number.isFinite(Number(dayId))?Number(dayId):today;
  const active=readActiveTimer();
  const key=`gamequest:gamequest-board:${cycle}:d${normalizedDay}`;
  if(active){
    if(activeTimerKey(active)===key){showToast(active.paused?"游戏作战区计时已暂停，可点继续":"游戏作战区正在计时","warn");return}
    const ok=confirm(`当前正在计时：${active.title}（${fmtTimer(activeTimerElapsedSeconds(active))}）。\n\n要先完成并记录它，然后开始「游戏作战区」吗？`);
    if(!ok)return;
    completeActiveTimer(true);
  }
  const now=new Date().toISOString();
  writeActiveTimer({
    kind:"gamequest",
    task_id:"gamequest-board",
    task_code:"gq-board",
    day_id:normalizedDay,
    cycle,
    title:`游戏作战区｜${gameQuestBoardMode==="week"?"本周池":dayName(normalizedDay)}`,
    category:"game",
    estimated_minutes:60,
    first_started_at:now,
    started_at:now,
    accumulated_seconds:0,
    paused:false,
    paused_at:null
  });
  showToast("开始计时：游戏作战区","ok",1300);
  renderAll();
}
function pauseActiveTimer(){const timer=readActiveTimer();if(!timer||timer.paused)return;timer.accumulated_seconds=activeTimerElapsedSeconds(timer);timer.paused=true;timer.paused_at=new Date().toISOString();timer.started_at=null;writeActiveTimer(timer);showToast("已暂停计时","warn",1200);renderAll()}
function resumeActiveTimer(){const timer=readActiveTimer();if(!timer||!timer.paused)return;timer.paused=false;timer.paused_at=null;timer.started_at=new Date().toISOString();writeActiveTimer(timer);showToast("继续计时","ok",1200);renderAll()}
function completeActiveTimer(markDone=true){
  const timer=readActiveTimer();
  if(!timer){showToast("没有正在计时的任务","warn");return}
  const totalSec=activeTimerElapsedSeconds(timer);
  const durationMinutes=Math.max(1,Math.round(totalSec/60));
  const log={
    id:`time_${Date.now()}`,
    kind:timer.kind||"task",
    task_id:timer.task_id,
    task_code:timer.task_code||taskCode(timer.task_id),
    title:timer.title,
    category:normalizeTimeCategory(timer.category),
    cycle:timer.cycle||cycleYmd,
    day_id:Number(timer.day_id??today),
    started_at:timer.first_started_at||timer.started_at||new Date().toISOString(),
    ended_at:new Date().toISOString(),
    duration_minutes:durationMinutes,
    duration_seconds:totalSec,
    source:"timer",
    status:"completed"
  };
  const logs=readTimeLogs();
  logs.push(log);
  writeTimeLogs(logs);
  const completionAnchor=document.querySelector("[data-timer-complete]");
  clearActiveTimer();
  if(markDone&&timer.kind==="task"){
    const task=blocks.find(t=>t.id===timer.task_id)||taskById(timer.task_id);
    if(task&&!isWeeklyPoolTask(task)&&!isDone(task.id,Number(timer.day_id),timer.cycle||cycleYmd))setDone(task.id,Number(timer.day_id),true,completionAnchor,true,timer.cycle||cycleYmd);
  }
  showToast(`已记录 ${fmtMinutes(durationMinutes)}：${timer.title}`,"ok",1800);
  renderAll();
}
function abandonActiveTimer(){const timer=readActiveTimer();if(!timer)return;if(!confirm(`放弃当前计时「${timer.title}」？这次不会写入统计。`))return;clearActiveTimer();showToast("已放弃当前计时","warn",1400);renderAll()}
function timerControlsHtml(t,dayId,cycle=cycleYmd){
  const active=readActiveTimer();
  const key=occurrenceTimerKey(t.id,dayId,cycle);
  const same=active&&activeTimerKey(active)===key;
  const used=taskWeekMinutesUsed(t.id);
  const target=taskWeeklyMinutes(t);
  const over=target>0&&used>target;
  const label=`${timeCategoryLabel(taskTimeCategory(t))} · 单次预计 ${taskEstimatedMinutes(t)}m · 本周 ${target?`${fmtMinutes(used)} / ${fmtMinutes(target)}`:fmtMinutes(used)}`;
  const weekText=target?`${fmtMinutes(used)}/${fmtMinutes(target)}`:fmtMinutes(used);
  const weekChip=`<button type="button" class="timerWeekChip ${over?"over":""}" title="${escapeHtml(label)}｜点击查看本周明细" data-time-task-detail="${escapeHtml(t.id)}"><span>周</span><b>${weekText}</b></button>`;
  if(same){
    const time=fmtTimer(activeTimerElapsedSeconds(active));
    return `<span class="timerControls timerCompact activeMini ${active.paused?"paused":"running"} ${over?"overTarget":""}" title="${escapeHtml(label)}">${weekChip}<span class="timerNowChip"><i>${active.paused?"Ⅱ":"◷"}</i><b data-live-timer>${time}</b></span></span>`;
  }
  return `<span class="timerControls timerCompact startMini ${over?"overTarget":""}" title="${escapeHtml(label)}"><button type="button" class="timerStartTiny" data-timer-start-task="${escapeHtml(t.id)}" data-timer-day="${dayId}" data-timer-cycle="${escapeHtml(cycle)}">◷ ${taskEstimatedMinutes(t)}m</button>${weekChip}</span>`;
}


function weeklyTaskStatus(task){
  const used=taskWeekMinutesUsed(task.id);
  const target=taskWeeklyMinutes(task);
  const pct=target?Math.round(used/target*100):used?100:0;
  const state=target&&used>=target?"done":used>0?"active":"idle";
  return {used,target,pct,state,over:target>0&&used>target};
}
function weeklyPlanSort(a,b){
  const sa=weeklyTaskStatus(a), sb=weeklyTaskStatus(b);
  const active=readActiveTimer();
  const ar=active?.kind==="task"&&String(active.task_id)===String(a.id);
  const br=active?.kind==="task"&&String(active.task_id)===String(b.id);
  const pa=sa.target?sa.used/sa.target:(sa.used?1:0);
  const pb=sb.target?sb.used/sb.target:(sb.used?1:0);
  if(ar!==br)return ar?-1:1;
  if((sa.state==="done")!==(sb.state==="done"))return sa.state==="done"?1:-1;
  const an=sa.target&&pa>=.7&&pa<1,bn=sb.target&&pb>=.7&&pb<1;
  if(an!==bn)return an?-1:1;
  if(a.important!==b.important)return a.important?-1:1;
  return pa-pb || String(a.title).localeCompare(String(b.title),'zh-Hans-CN');
}
function weeklyCategorySummary(){
  const rows={};
  weeklyPoolBlocks().forEach(t=>{
    const cat=taskTimeCategory(t);
    const st=weeklyTaskStatus(t);
    const old=rows[cat]||{cat,used:0,target:0,count:0,done:0};
    old.used+=st.used;
    old.target+=st.target;
    old.count++;
    if(st.target&&st.used>=st.target)old.done++;
    rows[cat]=old;
  });
  return timeCategoryOrder.filter(k=>rows[k]).map(k=>rows[k]);
}
function weeklyTaskCardHtml(t){
  const st=weeklyTaskStatus(t);
  const pct=st.target?Math.min(100,st.pct):0;
  const mode=taskPlanningMode(t);
  const c=timeCategoryDefs[taskTimeCategory(t)]||timeCategoryDefs.life;
  const url=safeUrl(t.url);
  const statusText=st.target?`${fmtMinutes(st.used)} / ${fmtMinutes(st.target)}`:fmtMinutes(st.used);
  const active=readActiveTimer();
  const isActive=active&&active.kind==="task"&&String(active.task_id)===String(t.id);
  return `<article class="weeklyTaskCard ${st.state} ${st.over?"over":""} ${isActive?"running":""}" style="--w:${pct}%">
    <div class="weeklyTaskTop">
      <div class="weeklyTaskTitle"><span>${c.icon}</span><b>${escapeHtml(t.title)}</b></div>
      <div class="weeklyTaskBadges">${planModeBadgeHtml(t)}<span>${escapeHtml(c.short)}</span>${t.important?`<span class="hot">重</span>`:""}</div>
    </div>
    <div class="weeklyTaskMeta"><span>${escapeHtml(taskDayHint(t))}</span><span>单次 ${taskEstimatedMinutes(t)}m</span></div>
    <div class="weeklyTaskMeter"><i></i></div>
    <div class="weeklyTaskFooter">
      <button type="button" class="weeklyStartBtn ${isActive?"active":""}" data-timer-start-task="${escapeHtml(t.id)}" data-timer-day="${today}" data-timer-cycle="${escapeHtml(cycleYmd)}">${isActive?`计时中 ${fmtTimer(activeTimerElapsedSeconds(active))}`:"开始计时"}</button>
      <button type="button" class="weeklyDetailBtn" data-time-task-detail="${escapeHtml(t.id)}">${statusText}</button>
      <label class="weeklyTargetInline" title="直接调整本周目标分钟"><span>目标</span><input type="number" min="0" max="10080" step="5" value="${st.target}" data-time-target-task="${escapeHtml(t.id)}"></label>
      ${url?`<a class="weeklyOpenLink" href="${url}" target="_blank" rel="noopener noreferrer">打开↗</a>`:""}
    </div>
  </article>`;
}
function renderWeeklyPlanPanel(){
  const el=document.getElementById("weeklyPlanPanel");
  if(!el)return;
  const tasks=weeklyPoolBlocks().slice().sort(weeklyPlanSort);
  const totalUsed=tasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).used,0);
  const totalTarget=tasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).target,0);
  const doneCount=tasks.filter(t=>{const st=weeklyTaskStatus(t);return st.target&&st.used>=st.target}).length;
  const active=readActiveTimer();
  const activeHint=active?`<div class="weeklyActiveHint v19"><span>${active.paused?"PAUSED":"FOCUS"}</span><b>${escapeHtml(active.title)}</b><em data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</em></div>`:"";
  const summaries=weeklyCategorySummary().map(row=>{
    const def=timeCategoryDefs[row.cat]||timeCategoryDefs.life;
    const pct=row.target?Math.min(100,Math.round(row.used/row.target*100)):0;
    return `<div class="weeklySummaryItem" style="--w:${pct}%"><div><span>${def.icon} ${escapeHtml(def.short)}</span><b>${fmtMinutes(row.used)}${row.target?` / ${fmtMinutes(row.target)}`:""}</b></div><i></i></div>`;
  }).join("");
  const grouped=timeCategoryOrder.map(cat=>{
    const def=timeCategoryDefs[cat]||timeCategoryDefs.life;
    const catTasks=tasks.filter(t=>taskTimeCategory(t)===cat);
    if(!catTasks.length)return "";
    const used=catTasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).used,0);
    const target=catTasks.reduce((sum,t)=>sum+weeklyTaskStatus(t).target,0);
    return `<section class="weeklyTaskGroup"><div class="weeklyTaskGroupHead"><div><span>${def.icon}</span><b>${escapeHtml(def.name)}</b></div><em>${fmtMinutes(used)}${target?` / ${fmtMinutes(target)}`:""}</em></div><div class="weeklyTaskGrid">${catTasks.map(weeklyTaskCardHtml).join("")}</div></section>`;
  }).join("");
  const cards=grouped||`<div class="weeklyEmpty"><b>周计划池为空</b><span>在任务编辑器里把任务模式设为「周计划池」，它就会出现在这里。</span></div>`;
  el.innerHTML=`<div class="weeklyShell v19"><div class="weeklyHero"><div><span>WEEKLY ALLOCATION</span><b>周计划池</b><em>不用每天打卡的主线，按本周投入推进。</em></div><div class="weeklyHeroStats"><div><span>投入</span><b>${fmtMinutes(totalUsed)}</b></div><div><span>目标</span><b>${fmtMinutes(totalTarget)}</b></div><div><span>达成</span><b>${doneCount}/${tasks.length}</b></div></div></div>${activeHint}<div class="weeklySummaryGrid">${summaries}</div><div class="weeklyTaskGroups">${cards}</div></div>`;
}


function renderTimePanel(){
  const el=document.getElementById("timePanel");
  if(!el)return;
  const active=readActiveTimer();
  const week=weekTimeTotals();
  const todayTotals=todayTimeTotals();
  const activeCat=active?normalizeTimeCategory(active.category):null;
  if(active){week[activeCat]=(week[activeCat]||0)+Math.round(activeTimerElapsedSeconds(active)/60);todayTotals[activeCat]=(todayTotals[activeCat]||0)+Math.round(activeTimerElapsedSeconds(active)/60)}
  const totalWeek=Object.values(week).reduce((a,b)=>a+b,0);
  const totalToday=Object.values(todayTotals).reduce((a,b)=>a+b,0);
  const activeWarn=active&&active.estimated_minutes&&activeTimerElapsedSeconds(active)>active.estimated_minutes*120;
  const activeTarget=active?.kind==="task"?taskWeeklyMinutes(taskById(active.task_id)||{}):0;
  const activeUsed=active?.kind==="task"?taskWeekMinutesUsed(active.task_id)+Math.round(activeTimerElapsedSeconds(active)/60):0;
  const activeWeekText=active?.kind==="task"&&activeTarget?` · 本周 ${fmtMinutes(activeUsed)} / ${fmtMinutes(activeTarget)}`:"";
  const activeHtml=active?`<div class="activeTimerCard ${active.paused?"paused":"running"} ${activeWarn?"warn":""}"><div class="activeTimerMain"><div class="activeTimerKicker">${active.paused?"PAUSED":"FOCUS TIMER"}</div><div class="activeTimerTitle">${escapeHtml(active.title)}</div><div class="activeTimerSub">${timeCategoryLabel(active.category)} · 预计 ${active.estimated_minutes||"?"}m${activeWeekText}${activeWarn?" · 已超过预计 2 倍，确认是否忘关":""}</div></div><div class="activeTimerRight"><div class="activeTimerClock" data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</div><div class="activeTimerActions">${active.paused?`<button type="button" data-timer-resume>继续</button>`:`<button type="button" data-timer-pause>暂停</button>`}<button type="button" data-timer-complete>完成并记录</button><button type="button" class="timerGhost" data-timer-abandon>放弃</button></div></div></div>`:`<div class="timeLedgerIdle"><span>◷</span><b>当前没有计时中</b><em>从任务、周计划池或游戏作战区开始计时。</em></div>`;
  const overviewRows=timeCategoryOrder.map(k=>{
    const def=timeCategoryDefs[k];
    const used=week[k]||0;
    const sharePct=totalWeek?used/totalWeek*100:0;
    const over=used>def.budget;
    return `<div class="timeBudgetRow ${over?"over":""}" title="${escapeHtml(def.name)}：${fmtMinutes(used)} · 占本周 ${Math.round(sharePct)}%"><div class="timeBudgetLabel"><b>${escapeHtml(def.short)}</b></div><div class="timeBudgetBar" style="--w:${sharePct.toFixed(2)}%"><span></span></div><div class="timeBudgetValue">${fmtMinutes(used)}</div></div>`;
  }).join("");
  const taskRows=(taskConfig?.tasks||[]).filter(t=>t.enabled!==false).slice().sort((a,b)=>{
    const au=taskWeekMinutesUsed(a.id),bu=taskWeekMinutesUsed(b.id);
    const at=taskWeeklyMinutes(a),bt=taskWeeklyMinutes(b);
    return (bu+bt)-(au+at)||String(a.title).localeCompare(String(b.title),"zh-Hans-CN");
  }).map(t=>{
    const used=taskWeekMinutesUsed(t.id);
    const target=taskWeeklyMinutes(t);
    const pct=target?Math.min(160,Math.round(used/target*100)):0;
    const over=target>0&&used>target;
    return `<div class="timeTaskRow ${over?"over":""}"><button type="button" class="timeTaskName" data-time-task-detail="${escapeHtml(t.id)}"><span>${timeCategoryLabel(taskTimeCategory(t))}</span>${planModeBadgeHtml(t)}<b>${escapeHtml(t.title)}</b></button><div class="timeTaskMeter" style="--w:${target?Math.min(100,pct):0}%"><i></i></div><div class="timeTaskValue"><b>${fmtMinutes(used)}</b><span>${target?`/ ${fmtMinutes(target)}`:"未设目标"}</span></div><label class="timeTargetEdit"><span>周目标</span><input type="number" min="0" max="10080" step="5" value="${target}" data-time-target-task="${escapeHtml(t.id)}"></label></div>`;
  }).join("");
  const logRows=readTimeLogs().slice().sort(timeLogSortDesc).slice(0,60).map(log=>`<li class="timeLogItem"><div><b>${escapeHtml(log.title)}</b><span>${fmtLogWhen(log)} · ${timeCategoryLabel(log.category)}</span></div><strong>${fmtMinutes(log.duration_minutes)}</strong><button type="button" data-time-log-delete="${escapeHtml(log.id)}">删除</button></li>`).join("")||`<li class="timeLogItem empty"><div><b>暂无时间记录</b><span>点任务或游戏作战区开始计时</span></div><strong>0m</strong></li>`;
  const todayChips=timeCategoryOrder.filter(k=>todayTotals[k]).map(k=>`<span>${timeCategoryDefs[k].short} ${fmtMinutes(todayTotals[k])}</span>`).join("")||`<span>今天暂无计时</span>`;
  const taskRanks=weekTaskTotals().slice(0,6).map(row=>{
    const task=taskById(row.task_id);
    const target=task?taskWeeklyMinutes(task):0;
    const over=target>0&&row.minutes>target;
    const value=target?`${fmtMinutes(row.minutes)} / ${fmtMinutes(target)}`:fmtMinutes(row.minutes);
    return `<li class="${over?"over":""}"><b>${escapeHtml(row.title)}</b><span>${timeCategoryLabel(row.category)} · ${value}</span></li>`;
  }).join("")||`<li><b>暂无本周任务记录</b><span>完成一次计时后出现</span></li>`;
  const body=timeLedgerView==="tasks"?`<div class="timeTaskList">${taskRows}</div>`:timeLedgerView==="logs"?`<ul class="timeLogList">${logRows}</ul>`:`<div class="timeBudgetList">${overviewRows}</div><div class="timeLogGrid"><div class="timeRecentLine"><span>今日分布</span><div class="timeTodayChips">${todayChips}</div></div><div class="timeRecentLine timeTaskRank"><span>本周任务排行</span><ul>${taskRanks}</ul></div></div>`;
  el.innerHTML=`<div class="timePanelShell v19"><div class="timePanelHeader"><div><span>TIME LEDGER</span><b>时间账本</b><em>总览看方向；任务页查每个任务投入；明细页删错账。</em></div><div class="timeStatCards"><div><span>今日</span><b>${fmtMinutes(totalToday)}</b></div><div><span>本周</span><b>${fmtMinutes(totalWeek)}</b></div></div></div><div class="timePanelTop">${activeHtml}</div><nav class="timeSubTabs" aria-label="时间账本切换"><button type="button" class="${timeLedgerView==="overview"?"active":""}" data-time-tab="overview">总览</button><button type="button" class="${timeLedgerView==="tasks"?"active":""}" data-time-tab="tasks">任务账</button><button type="button" class="${timeLedgerView==="logs"?"active":""}" data-time-tab="logs">明细</button></nav>${body}</div>`;
}


function renderTimerDock(){
  const dock=document.getElementById("timerFloatDock");
  if(!dock)return;
  const active=readActiveTimer();
  if(!active){
    dock.classList.add("hidden");
    dock.innerHTML="";
    return;
  }
  const warn=active.estimated_minutes&&activeTimerElapsedSeconds(active)>active.estimated_minutes*120;
  const targetBtn=active.kind==="gamequest"?"game":"time";
  dock.className=`timerFloatDock timerFloatCompact ${active.paused?"paused":"running"} ${warn?"warn":""}`;
  dock.innerHTML=`<button type="button" class="timerFloatMain" data-view-target="${targetBtn}" title="打开${active.kind==="gamequest"?"游戏作战区":"时间账本"}"><span class="timerFloatBadge">${active.paused?"PAUSE":"FOCUS"}</span><b>${escapeHtml(active.title)}</b><em>${timeCategoryLabel(active.category)}${warn?" · 可能忘关":""}</em></button><div class="timerFloatClock" data-live-timer>${fmtTimer(activeTimerElapsedSeconds(active))}</div><div class="timerFloatActions">${active.paused?`<button type="button" data-timer-resume>继续</button>`:`<button type="button" data-timer-pause>暂停</button>`}<button type="button" data-timer-complete>完成</button><button type="button" class="timerGhost" data-timer-abandon>放弃</button></div>`;
}

function renderTimerLive(){
  const active=readActiveTimer();
  document.querySelectorAll("[data-live-timer]").forEach(el=>{el.textContent=active?fmtTimer(activeTimerElapsedSeconds(active)):"00:00"});
  const panel=document.getElementById("timePanel");
  if(active&&panel){const warn=active.estimated_minutes&&activeTimerElapsedSeconds(active)>active.estimated_minutes*120;if(warn!==panel.querySelector(".activeTimerCard")?.classList.contains("warn")||warn!==document.getElementById("timerFloatDock")?.classList.contains("warn")){renderTimePanel();renderTimerDock();}}
}
function collectCarryoverToCheckOccurrences(){return carryoverOccurrences().filter(o=>{const st=occurrenceState(o.t,o.dayId,o.cycle);return st.overdue&&!st.done&&!st.failed&&!st.ignored})}
function mobileGroupSummary(list,dayId){const stats={total:list.length,done:0,failed:0,overdue:0,warn:0,ignored:0,pending:0};for(const o of list){const st=occurrenceState(o.t,o.dayId,o.cycle||cycleYmd);if(st.done)stats.done++;if(st.failed)stats.failed++;if(st.overdue)stats.overdue++;if(st.warn)stats.warn++;if(st.ignored)stats.ignored++;if(dayId===today&&!st.done&&!st.failed&&!st.ignored)stats.pending++;}return stats}
function mobileSummaryBadges(stats){const parts=[];if(stats.failed)parts.push(`<span class="mWeekPill fail">× ${stats.failed}</span>`);if(stats.overdue+stats.warn)parts.push(`<span class="mWeekPill warn">! ${stats.overdue+stats.warn}</span>`);if(stats.pending)parts.push(`<span class="mWeekPill pending">• ${stats.pending}</span>`);return parts.join("")}

function completeCarryoverTasks(){
  const targets=collectCarryoverToCheckOccurrences();
  if(!targets.length){alert("现在没有跑到今天的过期遗留任务。");return}
  const names=targets.slice(0,8).map(o=>`・${o.t.title}（原定：${o.prev?"上周":""}${dayName(o.dayId)}）`).join("\n");
  const more=targets.length>8?`\n……等 ${targets.length} 项`:"";
  const msg=`危险动作：将一键勾掉 ${targets.length} 个「延后到今天的过期任务」。\n\n这只会处理：单次任务 / 多次任务的最后一次 / 上周日遗留。\n不会处理「未完成×锁定」的无法补签任务。\n\n${names}${more}\n\n确认执行？`;
  if(!confirm(msg))return;
  const anchor=document.getElementById("controlClearExpiredBtn");
  targets.forEach(o=>{syncSetItem(storageKey(o.t.id,o.dayId,o.cycle),true);if(hasSteps(o.t.id)){stepTasks[o.t.id].forEach(s=>setStepDoneRaw(o.t.id,s.id,o.dayId,true,o.cycle))}});
  playCompletionEffect({level:dailyRingComplete()?"daily":"summary",category:"life",anchor,title:`遗留任务已汇总完成（${targets.length} 项）`,eventId:`carryover:${cycleYmd}:${Date.now()}`,date:ymd(operationalNow)});
  renderAll();
}
function dailyRingComplete(){
  const occurrences=todayOccurrences(true);
  return occurrences.length>0&&occurrences.every(o=>isDone(o.t.id,o.dayId,o.cycle));
}
function setDone(taskId,dayId,val,sourceEl=null,syncSteps=true,cycle=cycleYmd){
  const task=blocks.find(t=>t.id===taskId);
  if(task&&isFailedOccurrence(task,dayId,cycle)){renderAll();return}
  const wasDone=isDone(taskId,dayId,cycle);
  const wasDailyClear=dailyRingComplete();
  syncSetItem(storageKey(taskId,dayId,cycle),val);
  if(syncSteps&&hasSteps(taskId))stepTasks[taskId].forEach(s=>setStepDoneRaw(taskId,s.id,dayId,val,cycle));
  if(val&&!wasDone&&sourceEl){
    const dailyClear=!wasDailyClear&&dailyRingComplete();
    playCompletionEffect({level:dailyClear?"daily":"task",category:task?.cat||"",anchor:sourceEl,title:dailyClear?"DAILY RING CLEAR":task?.title||"任务完成",eventId:`task:${cycle}:${taskId}:d${dayId}`,date:ymd(operationalNow)});
  }
  renderAll();
}
function setStepDone(taskId,stepId,dayId,val,sourceEl=null,cycle=cycleYmd){
  const task=blocks.find(t=>t.id===taskId);
  if(task&&isFailedOccurrence(task,dayId,cycle)){renderAll();refreshSubtaskPopover(taskId,dayId,cycle);return}
  const wasDailyClear=dailyRingComplete();
  const parentWasDone=isDone(taskId,dayId,cycle);
  setStepDoneRaw(taskId,stepId,dayId,val,cycle);
  const allDone=areAllStepsDone(taskId,dayId,cycle);
  syncSetItem(storageKey(taskId,dayId,cycle),allDone);
  if(val&&sourceEl){
    const parentCompleted=allDone&&!parentWasDone;
    const dailyClear=parentCompleted&&!wasDailyClear&&dailyRingComplete();
    playCompletionEffect({level:dailyClear?"daily":parentCompleted?"parent":"micro",category:task?.cat||"",anchor:sourceEl,title:dailyClear?"DAILY RING CLEAR":parentCompleted?task?.title:"子任务完成",eventId:`step:${cycle}:${taskId}:${stepId}:d${dayId}`,date:ymd(operationalNow)});
  }
  renderAll();refreshSubtaskPopover(taskId,dayId,cycle);
}
function carryoverOccurrences(){const out=[];const todayP=weekPos(today);for(const t of ringBlocks()){if(t.days.length===1){const d=t.days[0];if(weekPos(d)<todayP&&!isDone(t.id,d,cycleYmd))out.push({t,dayId:d,cycle:cycleYmd,carry:true})}else{const last=lastScheduledDay(t);if(weekPos(last)<todayP&&!isDone(t.id,last,cycleYmd))out.push({t,dayId:last,cycle:cycleYmd,carry:true})}if(t.days.includes(0)&&isLastScheduled(t,0)&&!isDone(t.id,0,prevCycleYmd)){out.push({t,dayId:0,cycle:prevCycleYmd,carry:true,prev:true})}}return out}
function todayOccurrences(includeDone=true){const carry=carryoverOccurrences();const carryMap=new Map(carry.map(o=>[o.t.id,o]));let arr=[];for(const t of ringBlocks()){if(t.days.includes(today))arr.push({t,dayId:today,cycle:cycleYmd,current:true});const c=carryMap.get(t.id);if(c)arr.push(c)}const seen=new Set();arr=arr.filter(o=>{const k=`${o.cycle}_${o.t.id}_${o.dayId}`;if(seen.has(k))return false;seen.add(k);return true});if(!includeDone)arr=arr.filter(o=>!isDone(o.t.id,o.dayId,o.cycle));return arr}
function escapeHtml(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function safeUrl(url){if(!url)return "";try{const u=new URL(url,window.location.href);if(u.protocol==="http:"||u.protocol==="https:")return u.href}catch(e){}return ""}
function refItemHtml(item,index=0,groupTitle="资料"){
  const title=escapeHtml(item?.title||"未命名");
  const url=safeUrl(item?.url);
  const no=String(index+1).padStart(2,"0");
  const host=url?(()=>{try{return new URL(url).hostname.replace(/^www\./,"")}catch(_){return "外部链接"}})():"本机条目";
  const body=`<span class="refItemNo">${no}</span><span class="refItemCopy"><strong>${title}</strong><span>${escapeHtml(groupTitle)} · ${escapeHtml(host)}</span></span><span class="refItemMeta"><span>${url?"LINK":"NOTE"}</span><span>${url?"快速入口":"未设置链接"}</span></span>${url?`<span class="refItemAction">打开 ↗</span>`:`<span class="refItemAction disabled">待补充</span>`}`;
  return url?`<a class="refItem refItemCard" href="${url}" target="_blank" rel="noopener noreferrer">${body}</a>`:`<div class="refItem refItemCard refPlain">${body}</div>`;
}
function renderReferenceLibrary(){
  const grid=document.getElementById("refGrid");
  if(!grid)return;
  const groups=(refGroups||[]).filter(g=>g.enabled!==false);
  grid.innerHTML=groups.map((g,groupIndex)=>{
    const items=(g.items||[]).filter(i=>i.enabled!==false);
    const code=String(groupIndex+1).padStart(2,"0");
    return `<details class="refGroup" open style="--ref-index:${groupIndex}"><summary><span class="refGroupNo">${code}</span><span class="refGroupTitle">${escapeHtml(g.title)}</span><span class="refGroupCount">${items.length} 项</span><span class="refGroupCaret">▾</span></summary><div class="refGroupBody">${items.length?items.map((item,i)=>refItemHtml(item,i,g.title)).join(""):`<div class="refEmpty"><strong>这个分组还没有资料</strong><span>从资料库编辑器添加入口或备注。</span><button type="button" data-open-ref-editor="1">新增资料</button></div>`}</div></details>`;
  }).join("")||`<div class="refEmpty"><strong>资料库暂无启用分组</strong><span>可以从总控进入资料库编辑器新增。</span><button type="button" data-open-ref-editor="1">新增资料</button></div>`;
}

function titleHtml(t){const title=escapeHtml(t.title);const url=safeUrl(t.url);return url?`<a class="taskLink" href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"><span class="taskText">${title}</span><span class="linkIcon" aria-hidden="true">↗</span></a>`:`<span class="taskText">${title}</span>`}function tagHtml(t){
  const flags=[];
  if(t.core)flags.push(`<span class="taskFlag coreFlag" title="核心保底任务"><span class="flagDot"></span>保</span>`);
  if(t.important)flags.push(`<span class="taskFlag importantFlag" title="重要任务"><span class="flagDot"></span>重</span>`);
  if(t.optional)flags.push(`<span class="taskFlag optionalFlag" title="可选任务"><span class="flagDot"></span>选</span>`);
  if(!flags.length)return "";
  return `<div class="taskFlagBar">${flags.join("")}</div>`;
}
function stepContextDay(t){if(t.days.includes(today))return today;const before=sortWeekDays(t.days).filter(d=>weekPos(d)<=weekPos(today));return before.length?before[before.length-1]:sortWeekDays(t.days)[0]}
function stepProgress(t,dayId,cycle=cycleYmd){const total=hasSteps(t.id)?stepTasks[t.id].length:1;if(hasSteps(t.id)){const done=stepTasks[t.id].filter(s=>isStepDone(t.id,s.id,dayId,cycle)).length;return{done,total,pct:total?Math.round(done/total*100):100}}const done=isDone(t.id,dayId,cycle)?1:0;return{done,total,pct:done?100:0}}
function taskMiniRingHtml(t,dayId,cycle=cycleYmd){const p=stepProgress(t,dayId,cycle);const cls=p.pct>=100?"done":p.pct>0?"partial":"";return `<span class="taskMiniRing ${cls}" title="任务小环：${p.done}/${p.total}" style="--p:${p.pct}%"><span></span></span>`}
function frontCheckHtml(t,dayId,cycle=cycleYmd){const st=occurrenceState(t,dayId,cycle);const checked=st.done?"checked":"";const disabled=(st.failed||st.ignored)?"disabled data-locked='1'":"";return `<label class="frontCheck ${st.done?"done":""} ${st.failed?"failed":""}" title="${dayName(dayId)} 勾选"><input type="checkbox" data-task="${escapeHtml(t.id)}" data-day="${dayId}" data-cycle="${cycle}" ${checked} ${disabled}><span></span></label>`}
function stepPanelHtml(t,dayId,catCls,cycle=cycleYmd){
  if(!hasSteps(t.id))return "";
  const prog=stepProgress(t,dayId,cycle);
  return `<details class="subtaskInline ${catCls||""}" open data-subtask-inline="${escapeHtml(t.id)}"><summary><span>子任务</span><strong>${prog.done}/${prog.total}</strong><em>${prog.done===prog.total?"已完成":"可收起"}</em></summary><div class="subtaskInlineList">${subtaskPopoverRows(t,dayId,cycle)}</div></details>`;
}
function visibleDaysForMode(){if(viewMode==="all")return days;return [days.find(d=>d.id===today)]}
function visibleBlocksForMode(){if(viewMode==="all")return ringBlocks();return todayOccurrences(viewMode==="today").map(o=>o.t)}
function cellHtml(t,dayId,cycle=cycleYmd,extraClass=""){const st=occurrenceState(t,dayId,cycle);const checked=st.done?"checked":"";const disabled=st.failed?"disabled data-locked='1'":"";const cls=`${st.done?"done":""} ${st.failed?"failed":""} ${st.overdue?"overdue":""} ${st.warn?"warnMiss":""}`;const label=st.failed?"✕":dayName(dayId);return `<td class="dayCell ${extraClass} ${st.failed?"failedCell":""} ${st.overdue?"overdueCell":""} ${st.warn?"warnCell":""}"><label class="dayCheck ${cls}"><input type="checkbox" data-task="${escapeHtml(t.id)}" data-day="${dayId}" data-cycle="${cycle}" ${checked} ${disabled}><span>${label}</span></label></td>`}
function compactTaskMeta(t,st=null,meta=""){
  const bits=[];
  const tags=tagHtml(t);
  const badges=st?statusBadges(st):"";
  bits.push(planModeBadgeHtml(t));
  if(tags)bits.push(tags);
  if(badges)bits.push(badges);
  if(meta)bits.push(`<span class="compactMetaText">${meta}</span>`);
  return bits.join("")||`<span class="metaSpacer">&nbsp;</span>`;
}
function taskRowHtml(t,c,metaHtml,stepHtml="",frontCheck="",dayId=stepContextDay(t),cycle=cycleYmd){
  return `<div class="taskRowInner"><div class="taskMainLine">${frontCheck}${taskMiniRingHtml(t,dayId,cycle)}<span class="taskIndexBar" aria-hidden="true"></span><span class="taskIcon">${escapeHtml(c.icon||"•")}</span>${titleHtml(t)}</div><div class="taskMetaLine">${metaHtml}${timerControlsHtml(t,dayId,cycle)}</div>${stepHtml||""}</div>`;
}
function catCellHtml(c){return `<div class="catInner">${escapeHtml(c.name)}</div>`}
function renderTable(){const table=document.getElementById("taskTable");const isAll=viewMode==="all";const vDays=visibleDaysForMode();let html=`<thead><tr><th class="catHead">区分</th><th class="taskHead">任务</th>${isAll?vDays.map(d=>`<th class="dayHead ${d.id===today?"todayHead":""}">${d.name}${d.id===today?"｜今日":""}</th>`).join(""):""}</tr></thead><tbody>`;if(isAll){for(const t of ringBlocks()){const c=cats[t.cat]||{name:t.cat,color:"#eef2f7",cls:"",icon:"•"};const ctxDay=stepContextDay(t);html+=`<tr><td class="category ${c.cls}" style="background:${c.color}">${catCellHtml(c)}</td><td class="taskName ${c.cls}Task" style="border-left:5px solid ${c.color}">${taskRowHtml(t,c,compactTaskMeta(t),stepPanelHtml(t,ctxDay,c.cls,cycleYmd),"",ctxDay,cycleYmd)}</td>`;for(const d of vDays){if(t.days.includes(d.id)){html+=cellHtml(t,d.id,cycleYmd,d.id===today?"activeTodayCell":"")}else{html+=`<td class="dayCell blank"></td>`}}html+=`</tr>`}}else{const occs=todayOccurrences(viewMode==="today");if(!occs.length){html+=`<tr><td class="category" style="background:#f4f7fb"><div class="catInner">完成</div></td><td class="taskName"><div class="taskRowInner emptyRow"><div class="taskMainLine">今日执行环已经清空。长期主线请切到「周计划池」继续推进。</div><div class="taskMetaLine"><span class="metaSpacer">&nbsp;</span></div></div></td></tr>`}else{for(const o of occs){const t=o.t;const c=cats[t.cat]||{name:t.cat,color:"#eef2f7",cls:"",icon:"•"};const st=occurrenceState(t,o.dayId,o.cycle);const meta=occurrenceMeta(t,o.dayId,o.cycle);html+=`<tr><td class="category ${c.cls}" style="background:${c.color}">${catCellHtml(c)}</td><td class="taskName ${c.cls}Task" style="border-left:5px solid ${c.color}">${taskRowHtml(t,c,compactTaskMeta(t,st,meta),stepPanelHtml(t,o.dayId,c.cls,o.cycle),frontCheckHtml(t,o.dayId,o.cycle),o.dayId,o.cycle)}</td></tr>`}}}table.innerHTML=html+`</tbody>`}
function renderMobileTabs(){const tabs=document.getElementById("dayTabs");if(viewMode==="all"){tabs.innerHTML=`<div class="mobileModeHint">全周一览：现在改为按天折叠；默认展开。若有未完成提醒或被强制打差，会在当天标题上高亮显示。</div>`;return}if(viewMode==="undone"){tabs.innerHTML=`<div class="mobileModeHint">今日未完成：包含今天任务 + 单次任务/最后一次任务的遗留项。</div>`;mobileDay=today;return}mobileDay=today;tabs.innerHTML=`<button class="dayTab active" data-mobile-day="${today}">${dayName(today)}｜今日</button>`}
function renderMobileCards(){
  const box=document.getElementById("mobileCards");
  const renderOne=(o,opts={})=>{
    const t=o.t,dayId=o.dayId,cycle=o.cycle||cycleYmd;
    const st=occurrenceState(t,dayId,cycle);
    const done=st.done;
    const c=cats[t.cat]||{name:t.cat,color:"#eef2f7",cls:"",icon:"•"};
    const steps=stepPanelHtml(t,dayId,c.cls,cycle);
    const disabled=(st.failed||st.ignored)?"disabled data-locked='1'":"";
    const meta=occurrenceMeta(t,dayId,cycle);
    const metaMain=meta?`<span class="mobileMetaText">${meta}</span>`:`<span class="mobileMetaText metaSpacer">&nbsp;</span>`;
    const stepSlot=steps?`<span class="mobileStepSlot">${steps}</span>`:"";
    const topLine=`<div class="mTagLine"><span class="badge" style="background:${c.color}">${escapeHtml(catMobileName(t.cat,c))}</span>${taskMiniRingHtml(t,dayId,cycle)}${tagHtml(t)}${statusBadges(st)}</div>`;
    return `<div class="mTask ${dayId===today&&cycle===cycleYmd?"today":""} ${done?"done":""} ${st.ignored?"ignored":""} ${st.overdue?"overdue":""} ${st.failed?"failed":""} ${st.warn?"warnMiss":""}"><input type="checkbox" data-task="${escapeHtml(t.id)}" data-day="${dayId}" data-cycle="${cycle}" ${done?"checked":""} ${disabled}><div class="mTaskBody">${topLine}<div class="mTitle mTaskTitleLine ${c.cls}Task"><span class="taskIndexBar" aria-hidden="true"></span><span class="taskIcon">${escapeHtml(c.icon||"•")}</span>${titleHtml(t)}</div><div class="mMeta">${metaMain}${timerControlsHtml(t,dayId,cycle)}</div>${stepSlot}</div></div>`;
  };
  const renderGroup=(label,list,extraCls="",dayId=null)=>{
    const stats=mobileGroupSummary(list,dayId);
    const badgeHtml=mobileSummaryBadges(stats);
    const stateCls=`${stats.failed?"hasFail":""} ${stats.overdue||stats.warn?"hasAttention":""} ${stats.pending?"hasPending":""}`;
    const cards=list.map(o=>renderOne(o)).join("")||`<div class="mWeekEmpty">这一天没有任务。</div>`;
    return `<details class="mWeekGroup ${extraCls} ${stateCls}" open><summary class="mWeekHeader ${dayId===today?"today":""}"><span class="mWeekHeaderMain"><span class="mWeekDay">${label}</span>${badgeHtml?`<span class="mWeekFlags">${badgeHtml}</span>`:""}</span><span class="mWeekHeaderSide"><span class="mWeekStats">${stats.done}/${stats.total} 完成</span><span class="mWeekCaret">▾</span></span></summary><div class="mWeekBody">${cards}</div></details>`;
  };
  if(viewMode==="all"){
    const carry=carryoverOccurrences();
    const carryHtml=carry.length?renderGroup("遗留｜需要处理",carry,"carryoverGroup",today):"";
    box.innerHTML=carryHtml+days.map(d=>{
      const list=ringBlocks().filter(t=>t.days.includes(d.id)).map(t=>({t,dayId:d.id,cycle:cycleYmd}));
      return renderGroup(`${d.name}${d.id===today?"｜今日":""}`,list,"",d.id);
    }).join("");
    return;
  }
  const occs=todayOccurrences(viewMode==="today");
  box.innerHTML=occs.map(o=>renderOne(o)).join("")||`<div class="mTask emptyMobileTask"><div></div><div class="mTaskBody"><div class="mTitle">今天剩余任务已经清空</div><div class="mMeta">可以休息，或者切到「周计划池」推进长期主线。</div></div></div>`;
}
function updateProgress(){const occs=todayOccurrences(true);const done=occs.filter(o=>isDone(o.t.id,o.dayId,o.cycle)).length;const total=occs.length;const pct=total?Math.round(done/total*100):0;const carry=carryoverOccurrences().length;const progressEl=document.getElementById("progressText");if(progressEl)progressEl.textContent=`今日完成度 ${done}/${total}（${pct}%）${carry?`｜遗留 ${carry} 项`:""}`;const barEl=document.getElementById("bar");if(barEl)barEl.style.width=pct+"%";const modeEl=document.getElementById("modeText");if(modeEl)modeEl.textContent=viewMode==="today"?"今日 + 遗留":viewMode==="undone"?"今日未完成 + 遗留":"今日执行环全周视图";document.getElementById("showToday")?.classList.toggle("active",viewMode==="today");document.getElementById("showAll")?.classList.toggle("active",viewMode==="all");document.getElementById("showUndone")?.classList.toggle("active",viewMode==="undone")}


/* === v10.9 Game Quest Board === */
let gameQuestSelectedDay=today;
let gameQuestEditorDay=today;
let gameQuestDraftConfig=null;
const GAMEQUEST_COLLAPSE_KEY=`${GH_PREFIX}gamequest_collapsed`;
function isGameQuestCollapsed(){return false}
function setGameQuestCollapsed(v){localStorage.removeItem(GAMEQUEST_COLLAPSE_KEY)}
function toggleGameQuestCollapsed(){renderGameQuestPanel()}
function setGameQuestBoardMode(mode){
  gameQuestBoardMode=mode==="week"?"week":"today";
  localStorage.setItem(GQ_BOARD_MODE_KEY,gameQuestBoardMode);
  renderGameQuestPanel();
}
function setGameQuestWeeklyFilter(filter){
  gameQuestWeeklyFilter=String(filter||"all");
  localStorage.setItem(GQ_WEEKLY_FILTER_KEY,gameQuestWeeklyFilter);
  renderGameQuestPanel();
}
function safeCssEscape(v){
  const raw=String(v??"");
  if(typeof CSS!=="undefined"&&CSS.escape)return CSS.escape(raw);
  return raw.replace(/[^a-zA-Z0-9_-]/g,ch=>`\\${ch.charCodeAt(0).toString(16)} `);
}
function gameQuestDayKey(dayId){return String(Number(dayId))}
function gameQuestDoneKey(gameId,dayId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_gq_${gameId}_d${dayId}`}
function gameQuestItemKey(gameId,dayId,itemId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_gqi_${gameId}_d${dayId}_${itemId}`}
function gameQuestWeeklyDoneKey(gameId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_gqw_${gameId}`}
function gameQuestWeeklyItemKey(gameId,itemId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_gqwi_${gameId}_${itemId}`}
function enabledGameQuestGames(cfg=gameQuestConfig){return (cfg?.games||[]).filter(g=>g.enabled!==false)}
function gameQuestTasksFor(gameId,dayId,cfg=gameQuestConfig){
  const day=(cfg?.schedule||{})[gameQuestDayKey(dayId)]||{};
  return normalizeGameQuestTaskList(day[gameId],"scheduled").filter(t=>t.plan_mode!=="weekly");
}
function gameQuestTaskObjectsFor(gameId,dayId,cfg=gameQuestConfig){
  const used=new Set();
  return gameQuestTasksFor(gameId,dayId,cfg).map((raw,idx)=>{
    const title=String(raw.title||`游戏任务 ${idx+1}`).trim();
    let id=String(raw.id||slugifyId(`${gameId}-${dayId}-${idx+1}-${title}`,`item-${idx+1}`));
    if(used.has(id)){let base=id,n=2;while(used.has(`${base}-${n}`))n++;id=`${base}-${n}`}
    used.add(id);
    return {...raw,id,title,plan_mode:raw.plan_mode||inferGameQuestPlanMode(raw,"scheduled")};
  });
}
function gameQuestWeeklyTasksFor(gameId,cfg=gameQuestConfig){
  const used=new Set();
  return normalizeGameQuestTaskList((cfg?.weekly||{})[gameId],"weekly").map((raw,idx)=>{
    const title=String(raw.title||`本周游戏任务 ${idx+1}`).trim();
    let id=String(raw.id||slugifyId(`${gameId}-weekly-${idx+1}-${title}`,`weekly-${idx+1}`));
    if(used.has(id)){let base=id,n=2;while(used.has(`${base}-${n}`))n++;id=`${base}-${n}`}
    used.add(id);
    return {...raw,id,title,plan_mode:"weekly"};
  });
}
function isGameQuestItemDone(gameId,dayId,itemId,cycle=cycleYmd){
  return localStorage.getItem(gameQuestItemKey(gameId,dayId,itemId,cycle))==="1" || localStorage.getItem(gameQuestDoneKey(gameId,dayId,cycle))==="1";
}
function isGameQuestWeeklyItemDone(gameId,itemId,cycle=cycleYmd){
  return localStorage.getItem(gameQuestWeeklyItemKey(gameId,itemId,cycle))==="1" || localStorage.getItem(gameQuestWeeklyDoneKey(gameId,cycle))==="1";
}
function gameQuestEntryState(gameId,dayId,cfg=gameQuestConfig,cycle=cycleYmd){
  const tasks=gameQuestTaskObjectsFor(gameId,dayId,cfg);
  const done=tasks.filter(t=>isGameQuestItemDone(gameId,dayId,t.id,cycle)).length;
  return {tasks,done,total:tasks.length,cardDone:tasks.length>0&&done>=tasks.length};
}
function gameQuestWeeklyEntryState(gameId,cfg=gameQuestConfig,cycle=cycleYmd){
  const tasks=gameQuestWeeklyTasksFor(gameId,cfg);
  const done=tasks.filter(t=>isGameQuestWeeklyItemDone(gameId,t.id,cycle)).length;
  return {tasks,done,total:tasks.length,cardDone:tasks.length>0&&done>=tasks.length};
}
function isGameQuestDone(gameId,dayId,cycle=cycleYmd){return gameQuestEntryState(gameId,dayId,gameQuestConfig,cycle).cardDone}
function setGameQuestItemDone(gameId,dayId,itemId,val,sourceEl=null,cycle=cycleYmd){
  const cardWasDone=isGameQuestDone(gameId,dayId,cycle);
  syncSetItem(gameQuestItemKey(gameId,dayId,itemId,cycle),val);
  const tasks=gameQuestTaskObjectsFor(gameId,dayId,gameQuestConfig);
  const allDone=tasks.length?tasks.every(t=>t.id===itemId?val:isGameQuestItemDone(gameId,dayId,t.id,cycle)):false;
  syncSetItem(gameQuestDoneKey(gameId,dayId,cycle),allDone);
  if(val&&sourceEl){const game=gameQuestConfig.games.find(g=>String(g.id)===String(gameId));playCompletionEffect({level:allDone&&!cardWasDone?"parent":"micro",category:"gamecreate",anchor:sourceEl,title:allDone?`${game?.name||"游戏"} 今日清理完成`:"游戏项目完成",eventId:`gq:${cycle}:${gameId}:d${dayId}:${itemId}`})}
  renderAll();
}
function setGameQuestWeeklyItemDone(gameId,itemId,val,sourceEl=null,cycle=cycleYmd){
  const cardWasDone=gameQuestWeeklyEntryState(gameId,gameQuestConfig,cycle).cardDone;
  syncSetItem(gameQuestWeeklyItemKey(gameId,itemId,cycle),val);
  const tasks=gameQuestWeeklyTasksFor(gameId,gameQuestConfig);
  const allDone=tasks.length?tasks.every(t=>t.id===itemId?val:isGameQuestWeeklyItemDone(gameId,t.id,cycle)):false;
  syncSetItem(gameQuestWeeklyDoneKey(gameId,cycle),allDone);
  if(val&&sourceEl){const game=gameQuestConfig.games.find(g=>String(g.id)===String(gameId));playCompletionEffect({level:allDone&&!cardWasDone?"parent":"micro",category:"gamecreate",anchor:sourceEl,title:allDone?`${game?.name||"游戏"} 本周任务完成`:"游戏周项目完成",eventId:`gqw:${cycle}:${gameId}:${itemId}`})}
  renderAll();
}
function setGameQuestDone(gameId,dayId,val,sourceEl=null,cycle=cycleYmd){
  const wasDone=isGameQuestDone(gameId,dayId,cycle);
  const tasks=gameQuestTaskObjectsFor(gameId,dayId,gameQuestConfig);
  tasks.forEach(t=>syncSetItem(gameQuestItemKey(gameId,dayId,t.id,cycle),val));
  syncSetItem(gameQuestDoneKey(gameId,dayId,cycle),val&&tasks.length>0);
  if(val&&!wasDone&&sourceEl){const game=gameQuestConfig.games.find(g=>String(g.id)===String(gameId));playCompletionEffect({level:"parent",category:"gamecreate",anchor:sourceEl,title:`${game?.name||"游戏"} 今日清理完成`,eventId:`gq-card:${cycle}:${gameId}:d${dayId}`})}
  renderAll();
}
function setGameQuestWeeklyDone(gameId,val,sourceEl=null,cycle=cycleYmd){
  const wasDone=gameQuestWeeklyEntryState(gameId,gameQuestConfig,cycle).cardDone;
  const tasks=gameQuestWeeklyTasksFor(gameId,gameQuestConfig);
  tasks.forEach(t=>syncSetItem(gameQuestWeeklyItemKey(gameId,t.id,cycle),val));
  syncSetItem(gameQuestWeeklyDoneKey(gameId,cycle),val&&tasks.length>0);
  if(val&&!wasDone&&sourceEl){const game=gameQuestConfig.games.find(g=>String(g.id)===String(gameId));playCompletionEffect({level:"parent",category:"gamecreate",anchor:sourceEl,title:`${game?.name||"游戏"} 本周作战完成`,eventId:`gqw-card:${cycle}:${gameId}`})}
  renderAll();
}
function gameQuestEntriesForDay(dayId,cfg=gameQuestConfig){
  return enabledGameQuestGames(cfg).map(g=>{const state=gameQuestEntryState(g.id,dayId,cfg);return {game:g,tasks:state.tasks,done:state.done,total:state.total,cardDone:state.cardDone}}).filter(e=>e.tasks.length>0);
}
function gameQuestWeeklyEntries(cfg=gameQuestConfig){
  return enabledGameQuestGames(cfg).map(g=>{const state=gameQuestWeeklyEntryState(g.id,cfg);return {game:g,tasks:state.tasks,done:state.done,total:state.total,cardDone:state.cardDone}}).filter(e=>e.tasks.length>0);
}
function gameQuestStats(dayId){
  const entries=gameQuestEntriesForDay(dayId);
  const total=entries.reduce((sum,e)=>sum+e.total,0);
  const done=entries.reduce((sum,e)=>sum+e.done,0);
  const cards=entries.length;
  const cardsDone=entries.filter(e=>e.cardDone).length;
  return {total,done,pct:total?Math.round(done/total*100):100,cards,cardsDone};
}
function gameQuestWeeklyStats(){
  const entries=gameQuestWeeklyEntries();
  const total=entries.reduce((sum,e)=>sum+e.total,0);
  const done=entries.reduce((sum,e)=>sum+e.done,0);
  const cards=entries.length;
  const cardsDone=entries.filter(e=>e.cardDone).length;
  return {total,done,pct:total?Math.round(done/total*100):100,cards,cardsDone};
}
function gameQuestWeekStats(){
  let total=0,done=0;
  days.forEach(d=>{const s=gameQuestStats(d.id);total+=s.total;done+=s.done});
  return {total,done,pct:total?Math.round(done/total*100):100};
}
function gameQuestDayTabsHtml(){
  return days.map(d=>{const s=gameQuestStats(d.id);const cls=[d.id===gameQuestSelectedDay?"active":"",d.id===today?"today":"",s.total&&s.done>=s.total?"clear":""].join(" ");return `<button type="button" class="gameQuestDay ${cls}" data-gamequest-day-select="${d.id}" title="${escapeHtml(d.name)}：${s.done}/${s.total}"><span>${escapeHtml(d.name)}${d.id===today?"｜今日":""}</span><b>${s.done}/${s.total}</b></button>`}).join("");
}
function gameQuestTaskBadge(t){
  const def=gameQuestPlanModeDefs[t.plan_mode]||gameQuestPlanModeDefs.scheduled;
  return `<span class="gameQuestTaskBadge ${escapeHtml(t.plan_mode||"scheduled")}" title="${escapeHtml(def.hint)}">${escapeHtml(def.short)}</span>`;
}
function gameQuestTaskListHtml(gameId,dayId,tasks){
  return `<ul class="gameQuestTaskList gameQuestTaskListV2">${tasks.map((t,idx)=>{const done=isGameQuestItemDone(gameId,dayId,t.id,cycleYmd);return `<li class="${done?"done":""}"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(gameId)}" data-gamequest-item-day="${dayId}" data-gamequest-item="${escapeHtml(t.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><i>${escapeHtml(t.title)}</i>${gameQuestTaskBadge(t)}</button></li>`}).join("")}</ul>`;
}
function gameQuestWeeklyTaskListHtml(gameId,tasks){
  return `<ul class="gameQuestTaskList gameQuestTaskListV2 weekly">${tasks.map((t,idx)=>{const done=isGameQuestWeeklyItemDone(gameId,t.id,cycleYmd);return `<li class="${done?"done":""}"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-weekly-item-btn="1" data-gamequest-weekly-game="${escapeHtml(gameId)}" data-gamequest-weekly-item="${escapeHtml(t.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><i>${escapeHtml(t.title)}</i>${gameQuestTaskBadge(t)}</button></li>`}).join("")}</ul>`;
}
function gameQuestCardHtml(entry,dayId){
  const g=entry.game;
  const done=entry.cardDone;
  const pct=entry.total?Math.round(entry.done/entry.total*100):0;
  const next=entry.tasks.find(t=>!isGameQuestItemDone(g.id,dayId,t.id,cycleYmd));
  return `<article class="gameQuestCard gameQuestCardV2 accent-${escapeHtml(g.accent)} ${done?"done":""}" style="--gq-p:${pct}%">
    <div class="gameQuestCardAura" aria-hidden="true"></div>
    <div class="gameQuestCardTop">
      <button type="button" class="gameQuestCheck ${done?"done":""}" title="${escapeHtml(g.name)} 今日清理完成" data-gq-card-btn="1" data-gamequest-game="${escapeHtml(g.id)}" data-gamequest-day="${dayId}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span></span></button>
      <span class="gameQuestIcon gameQuestIconOrb" aria-hidden="true">${escapeHtml(String(g.short||g.name).slice(0,1))}</span>
      <div class="gameQuestNameWrap"><span class="gameQuestName">${escapeHtml(g.name)}</span><span class="gameQuestShort">${next?`下一步：${escapeHtml(next.title)}`:"✓ 今日项目已完成"}</span></div>
      <span class="gameQuestCount">${entry.done}/${entry.total}</span>
    </div>
    <div class="gameQuestProgressRail"><span></span></div>
    <div class="gameQuestCardBody">
      ${gameQuestTaskListHtml(g.id,dayId,entry.tasks)}
    </div>
  </article>`;
}
function gameQuestWeeklyCardHtml(entry){
  const g=entry.game;
  const done=entry.cardDone;
  const pct=entry.total?Math.round(entry.done/entry.total*100):0;
  const next=entry.tasks.find(t=>!isGameQuestWeeklyItemDone(g.id,t.id,cycleYmd));
  return `<article class="gameQuestCard gameQuestCardV2 gameQuestWeeklyCard accent-${escapeHtml(g.accent)} ${done?"done":""}" style="--gq-p:${pct}%">
    <div class="gameQuestCardAura" aria-hidden="true"></div>
    <div class="gameQuestCardTop">
      <button type="button" class="gameQuestCheck ${done?"done":""}" title="${escapeHtml(g.name)} 本周任务完成" data-gq-weekly-card-btn="1" data-gamequest-weekly-game="${escapeHtml(g.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span></span></button>
      <span class="gameQuestIcon gameQuestIconOrb" aria-hidden="true">${escapeHtml(String(g.short||g.name).slice(0,1))}</span>
      <div class="gameQuestNameWrap"><span class="gameQuestName">${escapeHtml(g.name)}</span><span class="gameQuestShort">${next?`下一步：${escapeHtml(next.title)}`:"✓ 本周项目已完成"}</span></div>
      <span class="gameQuestCount">${entry.done}/${entry.total}</span>
    </div>
    <div class="gameQuestProgressRail"><span></span></div>
    <div class="gameQuestCardBody">
      ${gameQuestWeeklyTaskListHtml(g.id,entry.tasks)}
    </div>
  </article>`;
}
function renderGameQuestPanel(){
  const panel=document.getElementById("gameQuestPanel");
  if(!panel)return;
  const week=gameQuestWeekStats();
  const weekly=gameQuestWeeklyStats();
  const gqWeekMinutes=taskWeekMinutesUsed("gamequest-board");
  const active=readActiveTimer();
  const gqActive=active&&active.kind==="gamequest";
  const gqTimerLabel=gqActive?fmtTimer(activeTimerElapsedSeconds(active)):"开始计时";
  const gqTimerSub=gqActive?(active.paused?"已暂停":"游戏计时中"):`本周 ${fmtMinutes(gqWeekMinutes)}`;
  const modeTabs=`<div class="gameQuestModeTabs" role="tablist" aria-label="游戏作战区模式">
    <button type="button" class="gameQuestModeBtn ${gameQuestBoardMode==="today"?"active":""}" data-gamequest-board-mode="today"><span>今日清理</span><b>${gameQuestStats(today).done}/${gameQuestStats(today).total}</b></button>
    <button type="button" class="gameQuestModeBtn ${gameQuestBoardMode==="week"?"active":""}" data-gamequest-board-mode="week"><span>本周作战池</span><b>${weekly.done}/${weekly.total}</b></button>
  </div>`;
  const topBar=`<div class="gameQuestTopBar gameQuestTopBarStandalone">
    <div class="gameQuestTopTitle"><span>GAME QUEST</span><strong>游戏作战区</strong><em>游戏内部也分「今日清理」和「本周池」，但仍然只留在游戏作战区里。</em></div>
    <div class="gameQuestTopMeter" title="今日/指定日清理：${week.done}/${week.total}；本周池：${weekly.done}/${weekly.total}">
      <span class="gameQuestMiniRing" style="--p:${gameQuestBoardMode==="week"?weekly.pct:week.pct}%"><i>${gameQuestBoardMode==="week"?weekly.pct:week.pct}%</i></span>
      <b class="gameQuestTopProgress">${gameQuestBoardMode==="week"?`${weekly.done}/${weekly.total}`:`${week.done}/${week.total}`}</b>
    </div>
    <button type="button" class="gameQuestTopTimer ${gqActive?"active":""}" data-timer-start-gamequest="1" data-gamequest-day="${gameQuestSelectedDay}" data-cycle="${escapeHtml(cycleYmd)}" title="把整个游戏作战区作为一个整体记录时间"><span>${gqActive?(active.paused?"Ⅱ":"◷"):"◷"}</span><b ${gqActive?"data-live-timer":""}>${gqTimerLabel}</b><em>${gqTimerSub}</em></button>
    <button type="button" class="gameQuestTodayQuick" id="gameQuestTodayBtn">今日</button>
  </div>`;
  let body="";
  if(gameQuestBoardMode==="week"){
    const weeklyEntries=gameQuestWeeklyEntries();
    let activeWeeklyFilter=gameQuestWeeklyFilter||"all";
    if(activeWeeklyFilter!=="all"&&!weeklyEntries.some(e=>String(e.game.id)===activeWeeklyFilter)){
      activeWeeklyFilter="all";
      gameQuestWeeklyFilter="all";
      localStorage.setItem(GQ_WEEKLY_FILTER_KEY,gameQuestWeeklyFilter);
    }
    const visibleWeeklyEntries=activeWeeklyFilter==="all"?weeklyEntries:weeklyEntries.filter(e=>String(e.game.id)===activeWeeklyFilter);
    const visibleWeeklyStats={
      done:visibleWeeklyEntries.reduce((sum,e)=>sum+e.done,0),
      total:visibleWeeklyEntries.reduce((sum,e)=>sum+e.total,0),
      cards:visibleWeeklyEntries.length,
      cardsDone:visibleWeeklyEntries.filter(e=>e.cardDone).length
    };
    const activeWeeklyTitle=activeWeeklyFilter==="all"?"本周作战池":(visibleWeeklyEntries[0]?.game?.name||"本周作战池");
    const weeklyFilterTabs=weeklyEntries.length>1?`<nav class="gameQuestFilterTabs" aria-label="本周作战池游戏筛选"><button type="button" class="${activeWeeklyFilter==="all"?"active":""}" data-gq-weekly-filter="all"><span>全部</span><b>${weekly.done}/${weekly.total}</b></button>${weeklyEntries.map(e=>`<button type="button" class="${activeWeeklyFilter===String(e.game.id)?"active":""}" data-gq-weekly-filter="${escapeHtml(e.game.id)}"><span>${escapeHtml(e.game.short||e.game.name)}</span><b>${e.done}/${e.total}</b></button>`).join("")}</nav>`:"";
    const weeklyCards=visibleWeeklyEntries.length?visibleWeeklyEntries.map(e=>gameQuestWeeklyCardHtml(e)).join(""):`<div class="gameQuestEmpty"><b>本周游戏池还没有任务。</b><span>去总控里的「游戏任务编辑器」把周常/深渊/危局放进本周池。</span></div>`;
    body=`<div class="gameQuestWeeklyPane">
      <div class="gameQuestMetaStrip"><span>周常 / 深渊危局 / 本周只需完成一次的游戏任务</span><em>${weekly.pct}% WEEK POOL</em></div>
      ${weeklyFilterTabs}
      <div class="gameQuestSubHead"><span>${escapeHtml(activeWeeklyTitle)}</span><div class="gameQuestMetricSet"><span class="gameQuestMetric"><strong>${visibleWeeklyStats.done}/${visibleWeeklyStats.total}</strong><em>ITEMS</em></span><span class="gameQuestMetric"><strong>${visibleWeeklyStats.cardsDone}/${visibleWeeklyStats.cards}</strong><em>大任务</em></span><span class="gameQuestMetric remaining"><strong>${Math.max(0,visibleWeeklyStats.total-visibleWeeklyStats.done)}</strong><em>剩余</em></span></div></div>
      <div class="gameQuestGrid gameQuestWeeklyGrid">${weeklyCards}</div>
    </div>`;
  }else{
    const selectedStats=gameQuestStats(gameQuestSelectedDay);
    const entries=gameQuestEntriesForDay(gameQuestSelectedDay);
    const cards=entries.length?entries.map(e=>gameQuestCardHtml(e,gameQuestSelectedDay)).join(""):`<div class="gameQuestEmpty"><b>这一天没有日清理任务。</b><span>周常/深渊类任务已经放到「本周作战池」；这里保持今天该清的东西。</span></div>`;
    body=`<div class="gameQuestDailyPane">
      <div class="gameQuestMetaStrip"><span>每天/指定日清理：刷体力、签到、资料确认</span><em>${week.pct}% DAILY BOARD</em></div>
      <div class="gameQuestDays">${gameQuestDayTabsHtml()}</div>
      <div class="gameQuestSubHead"><span>${escapeHtml(dayName(gameQuestSelectedDay))}${gameQuestSelectedDay===today?"｜今日":""}</span><div class="gameQuestMetricSet"><span class="gameQuestMetric"><strong>${selectedStats.done}/${selectedStats.total}</strong><em>ITEMS</em></span><span class="gameQuestMetric"><strong>${selectedStats.cardsDone}/${selectedStats.cards}</strong><em>大任务</em></span><span class="gameQuestMetric remaining"><strong>${Math.max(0,selectedStats.total-selectedStats.done)}</strong><em>剩余</em></span></div></div>
      <div class="gameQuestGrid">${cards}</div>
    </div>`;
  }
  panel.innerHTML=`<div class="gameQuestShell gameQuestStandalone">
    ${topBar}
    ${modeTabs}
    ${body}
  </div>`;
  // 重渲染会重建可横向滚动的 tab 条，默认回到最左，导致点了靠右的「异环」后视图跳回开头。
  // 渲染后同步把选中的 tab 居中滚入视野（只动 tab 条自身横向滚动，不影响页面滚动）。
  [".gameQuestFilterTabs",".gameQuestDays"].forEach(sc=>{
    const strip=panel.querySelector(sc);const act=strip&&strip.querySelector(".active");
    if(!strip||!act||strip.scrollWidth<=strip.clientWidth+2)return;
    const sr=strip.getBoundingClientRect(),ar=act.getBoundingClientRect();
    strip.scrollLeft+=(ar.left-sr.left)-(strip.clientWidth-ar.width)/2;
  });
}

function openGameQuestEditor(){
  closeControlCenter();
  closeGhModal();
  const modal=document.getElementById("gameQuestEditorModal");
  try{
    gameQuestDraftConfig=deepClone(gameQuestConfig||normalizeGameQuestConfig(defaultGameQuestConfig));
    gameQuestDraftConfig.dailyByGame=buildGameQuestDailyByGame(gameQuestDraftConfig);
    gameQuestEditorDay=Number.isInteger(gameQuestSelectedDay)?gameQuestSelectedDay:today;
    if(modal){modal.classList.remove("hidden");modal.setAttribute("aria-hidden","false");}
    renderGameQuestEditor();
  }catch(err){
    console.error("openGameQuestEditor failed",err);
    if(modal){modal.classList.remove("hidden");modal.setAttribute("aria-hidden","false");}
    gameQuestEditorLog("编辑器打开失败："+String(err.message||err));
    showToast("游戏任务编辑器打开失败，请看控制台/日志","err",3500);
  }
}
function closeGameQuestEditor(){
  document.getElementById("gameQuestEditorModal")?.classList.add("hidden");
  document.getElementById("gameQuestEditorModal")?.setAttribute("aria-hidden","true");
}
function gameQuestEditorLog(msg){const el=document.getElementById("gameQuestEditorLog");if(el)el.textContent=`[${new Date().toLocaleTimeString()}] ${msg}\n`+el.textContent.slice(0,2500)}
const GAMEQUEST_ICON_PRESETS=["GQ","ACT","RPG","SIM","AVG","SR","TD","ARPG","MOBA","FPS","RTS","RHY","PUZ","CARD","COOP","LIVE"];
function gameQuestIconPickerHtml(current="GQ"){
  return `<div class="gqIconPicker">${GAMEQUEST_ICON_PRESETS.map(icon=>`<button type="button" class="gqIconPick ${icon===current?"active":""}" data-gq-icon="${escapeHtml(icon)}">${escapeHtml(icon)}</button>`).join("")}</div>`;
}
function gameQuestAccentOptions(selected="cyan"){
  const options=[["cyan","青"],["amber","金"],["violet","紫"],["blue","蓝"],["rose","粉"],["gold","黄"]];
  return options.map(([value,label])=>`<option value="${value}" ${selected===value?"selected":""}>${label}</option>`).join("");
}
function createGameQuestDraftGame(){
  const idx=(gameQuestDraftConfig?.games?.length||0)+1;
  const accents=["cyan","amber","violet","blue","rose","gold"];
  return {id:`gq-${Date.now().toString(36)}-${idx}`,name:`新游戏 ${idx}`,short:`游戏 ${idx}`,icon:"GQ",accent:accents[(idx-1)%accents.length],enabled:true};
}
function addGameQuestGame(){
  collectGameQuestEditorState();
  if(!gameQuestDraftConfig)gameQuestDraftConfig=normalizeGameQuestConfig(gameQuestConfig||defaultGameQuestConfig);
  gameQuestDraftConfig.games.push(createGameQuestDraftGame());
  renderGameQuestEditor();
  gameQuestEditorLog("已新增游戏卡。先占坑，再改名，老办法很稳。");
}
function moveGameQuestGame(id,offset){
  collectGameQuestEditorState();
  const arr=gameQuestDraftConfig?.games||[];
  const idx=arr.findIndex(g=>g.id===id);
  const next=idx+offset;
  if(idx<0||next<0||next>=arr.length)return;
  [arr[idx],arr[next]]=[arr[next],arr[idx]];
  renderGameQuestEditor();
}
function removeGameQuestGame(id){
  collectGameQuestEditorState();
  const arr=gameQuestDraftConfig?.games||[];
  const target=arr.find(g=>g.id===id);
  if(!target)return;
  if(!confirm(`确认删除「${target.name}」？对应每天清单也会一起删掉。`))return;
  gameQuestDraftConfig.games=arr.filter(g=>g.id!==id);
  Object.keys(gameQuestDraftConfig.schedule||{}).forEach(day=>{if(gameQuestDraftConfig.schedule[day])delete gameQuestDraftConfig.schedule[day][id]});
  if(gameQuestDraftConfig.dailyByGame)delete gameQuestDraftConfig.dailyByGame[id];
  renderGameQuestEditor();
  gameQuestEditorLog(`已删除：${target.name}`);
}
// v23: 游戏「今日/指定日」改为按游戏排任务，每条任务勾选星期几出现（和普通任务编辑器同款体验）。
// 存储格式仍是 schedule[星期][游戏]=[任务]，只是编辑时用 dailyByGame 这个中间模型：
//   dailyByGame[游戏id] = [{title, days:[1,2,3,4,5,6,0]}]
function gameQuestDaySortValue(d){return Number(d)===0?7:Number(d)}
function buildGameQuestDailyByGame(cfg){
  const map={};
  (cfg?.games||[]).forEach(g=>{map[g.id]=[]});
  [1,2,3,4,5,6,0].forEach(day=>{
    const dayObj=(cfg?.schedule||{})[String(day)]||{};
    (cfg?.games||[]).forEach(g=>{
      if(!map[g.id])map[g.id]=[];
      normalizeGameQuestTaskList(dayObj[g.id],"scheduled").forEach(t=>{
        if(t.plan_mode==="weekly")return;
        const sig=t.title.trim().toLowerCase();
        let ex=map[g.id].find(x=>x.title.trim().toLowerCase()===sig);
        if(!ex){ex={title:t.title,days:[]};map[g.id].push(ex)}
        if(!ex.days.includes(day))ex.days.push(day);
      });
    });
  });
  Object.values(map).forEach(list=>list.forEach(t=>t.days.sort((a,b)=>gameQuestDaySortValue(a)-gameQuestDaySortValue(b))));
  return map;
}
function ensureGameQuestDailyByGame(cfg){
  if(!cfg.dailyByGame||typeof cfg.dailyByGame!=="object")cfg.dailyByGame=buildGameQuestDailyByGame(cfg);
  (cfg.games||[]).forEach(g=>{if(!Array.isArray(cfg.dailyByGame[g.id]))cfg.dailyByGame[g.id]=[]});
  return cfg.dailyByGame;
}
function applyDailyByGameToSchedule(cfg){
  const schedule={};
  [1,2,3,4,5,6,0].forEach(day=>{schedule[String(day)]={}});
  (cfg.games||[]).forEach(g=>{
    const list=(cfg.dailyByGame&&cfg.dailyByGame[g.id])||[];
    const seen=new Set();
    list.forEach(t=>{
      const title=String(t.title||"").trim();
      const days=Array.isArray(t.days)?[...new Set(t.days.map(Number))].filter(d=>[0,1,2,3,4,5,6].includes(d)):[];
      if(!title||!days.length)return;
      const sig=title.toLowerCase();
      if(seen.has(sig))return;
      seen.add(sig);
      const plan_mode=days.length>=7?"daily":"scheduled";
      days.forEach(day=>{
        const key=String(day);
        if(!schedule[key][g.id])schedule[key][g.id]=[];
        schedule[key][g.id].push({title,plan_mode});
      });
    });
  });
  cfg.schedule=schedule;
}
function collectGameQuestEditorState(){
  if(!gameQuestDraftConfig)return;
  if(!gameQuestDraftConfig.weekly)gameQuestDraftConfig.weekly={};
  if(!gameQuestDraftConfig.dailyByGame)gameQuestDraftConfig.dailyByGame={};
  // 1) 游戏大卡元数据（放前面，保证下面按 id 收集时 id 稳定）
  const games=[...document.querySelectorAll("[data-gq-game-row]")].map((row,idx)=>({
    id:row.dataset.gqGameRow||`gq-${idx+1}`,
    name:row.querySelector('.gqMetaName')?.value.trim()||`游戏 ${idx+1}`,
    short:row.querySelector('.gqMetaShort')?.value.trim()||row.querySelector('.gqMetaName')?.value.trim()||`游戏 ${idx+1}`,
    icon:row.querySelector('.gqMetaIcon')?.value.trim()||'GQ',
    accent:row.querySelector('.gqMetaAccent')?.value||'cyan',
    enabled:row.querySelector('.gqMetaEnabled')?.checked!==false
  }));
  if(games.length)gameQuestDraftConfig.games=games;
  // 2) 每天/指定日：按游戏卡收集，每条任务读它勾选的星期（空标题也先留在内存里，重渲染不丢）
  document.querySelectorAll("[data-gq-daily-game]").forEach(card=>{
    const gid=card.dataset.gqDailyGame;
    const rows=[...card.querySelectorAll("[data-gq-daily-row]")];
    gameQuestDraftConfig.dailyByGame[gid]=rows.map(row=>({
      title:row.querySelector(".gqDailyTaskTitle")?.value.trim()||"",
      days:[...row.querySelectorAll(".gqDayBox:checked")].map(b=>Number(b.value))
    }));
  });
  // 3) 本周池：保留原来的一行一条文本框
  document.querySelectorAll("[data-gq-weekly-edit-game]").forEach(area=>{
    const id=area.dataset.gqWeeklyEditGame;
    gameQuestDraftConfig.weekly[id]=gameQuestTaskStoreList(normalizeGameQuestTaskList(area.value,"weekly").map(t=>({...t,plan_mode:"weekly"})),"weekly");
  });
  // 4) 把 dailyByGame 展开回 schedule[星期][游戏] 存储格式
  applyDailyByGameToSchedule(gameQuestDraftConfig);
}
function addGameQuestDailyTask(gameId){
  collectGameQuestEditorState();
  if(!gameQuestDraftConfig.dailyByGame)gameQuestDraftConfig.dailyByGame={};
  if(!Array.isArray(gameQuestDraftConfig.dailyByGame[gameId]))gameQuestDraftConfig.dailyByGame[gameId]=[];
  gameQuestDraftConfig.dailyByGame[gameId].push({title:"",days:[1,2,3,4,5,6,0]});
  renderGameQuestEditor();
  const card=document.querySelector(`[data-gq-daily-game="${safeCssEscape(gameId)}"]`);
  const inputs=card?.querySelectorAll(".gqDailyTaskTitle");
  const last=inputs&&inputs[inputs.length-1];
  if(last){last.focus();last.scrollIntoView({behavior:"smooth",block:"nearest"})}
}
function removeGameQuestDailyTask(gameId,index){
  collectGameQuestEditorState();
  const list=gameQuestDraftConfig.dailyByGame&&gameQuestDraftConfig.dailyByGame[gameId];
  if(!Array.isArray(list))return;
  list.splice(index,1);
  renderGameQuestEditor();
}
function moveGameQuestDailyTask(gameId,index,offset){
  collectGameQuestEditorState();
  const list=gameQuestDraftConfig.dailyByGame&&gameQuestDraftConfig.dailyByGame[gameId];
  if(!Array.isArray(list))return;
  const next=index+offset;
  if(next<0||next>=list.length)return;
  [list[index],list[next]]=[list[next],list[index]];
  renderGameQuestEditor();
}
function gameQuestDailyRowHtml(gameId,t,idx,total){
  const dayNums=Array.isArray(t.days)?t.days.map(Number):[];
  const dayChips=[1,2,3,4,5,6,0].map(d=>{
    const on=dayNums.includes(d);
    return `<label class="gqDayChip"><input type="checkbox" class="gqDayBox" value="${d}" ${on?"checked":""}><span>${escapeHtml(dayName(d))}</span></label>`;
  }).join("");
  const last=(Number(total)||1)-1;
  return `<div class="gqDailyRow" data-gq-daily-row="${idx}">
    <input class="gqDailyTaskTitle" value="${escapeHtml(t.title||"")}" placeholder="任务名，例如：日常体力 / App签到 / 清体力">
    <div class="gqDayPicker" role="group" aria-label="出现的星期">${dayChips}</div>
    <div class="gqDailyRowOps">
      <button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-daily-move="up" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx<=0?"disabled":""} title="上移" aria-label="上移">↑</button>
      <button type="button" class="gqDailyMiniBtn gqMoveBtn" data-gq-daily-move="down" data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" ${idx>=last?"disabled":""} title="下移" aria-label="下移">↓</button>
      <button type="button" class="gqDailyMiniBtn" data-gq-daily-fill data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="一键设为每天出现">每天</button>
      <button type="button" class="gqDailyMiniBtn danger" data-gq-del-daily data-gq-game="${escapeHtml(gameId)}" data-gq-index="${idx}" title="删除这条任务" aria-label="删除">✕</button>
    </div>
  </div>`;
}
function renderGameQuestEditor(){
  const list=document.getElementById("gameQuestEditorList");
  const tabs=document.getElementById("gameQuestEditorDays");
  if(!list)return;
  const cfg=gameQuestDraftConfig||normalizeGameQuestConfig(gameQuestConfig||defaultGameQuestConfig);
  ensureGameQuestDailyByGame(cfg);
  if(tabs)tabs.innerHTML="";// v23：不再按天切换编辑，星期改到每条任务上勾选
  const metaRows=(cfg.games||[]).map((g,idx)=>`<div class="gqMetaRow gqMetaRowV2" data-gq-game-row="${escapeHtml(g.id)}">
    <div class="gqMetaIconEditor">
      <div class="gqIconPreview" aria-hidden="true">${escapeHtml(g.icon||'GQ')}</div>
      <div class="gqIconEditorBody">
        <label>图标</label>
        <input class="gqMetaIcon" value="${escapeHtml(g.icon||'GQ')}" maxlength="4" placeholder="GQ">
        ${gameQuestIconPickerHtml(g.icon||'GQ')}
      </div>
    </div>
    <div class="gqMetaField name"><label>大任务名</label><input class="gqMetaName" value="${escapeHtml(g.name||'')}" placeholder="例如：鸣潮"></div>
    <div class="gqMetaField short"><label>简称</label><input class="gqMetaShort" value="${escapeHtml(g.short||g.name||'')}" placeholder="卡片副标题"></div>
    <div class="gqMetaField accent"><label>强调色</label><select class="gqMetaAccent">${gameQuestAccentOptions(g.accent)}</select></div>
    <label class="gqMetaEnabledWrap"><input type="checkbox" class="gqMetaEnabled" ${g.enabled!==false?'checked':''}>启用</label>
    <div class="gqMetaActions"><button type="button" class="gqMetaBtn" data-gq-move="up" data-gq-row-id="${escapeHtml(g.id)}" ${idx===0?'disabled':''}>↑</button><button type="button" class="gqMetaBtn" data-gq-move="down" data-gq-row-id="${escapeHtml(g.id)}" ${idx===cfg.games.length-1?'disabled':''}>↓</button><button type="button" class="gqMetaBtn danger" data-gq-delete="${escapeHtml(g.id)}">删除</button></div>
  </div>`).join('');
  const enabledGames=(cfg.games||[]).filter(g=>g.enabled!==false);
  const dayLegend=`<div class="gqDayLegend" aria-hidden="true"><span class="gqDayLegendLead">星期</span>${[1,2,3,4,5,6,0].map(d=>`<span class="${d===today?"today":""}">${escapeHtml(dayName(d))}</span>`).join("")}</div>`;
  const dailyCards=enabledGames.map(g=>{
    const items=cfg.dailyByGame[g.id]||[];
    const rows=items.length?items.map((t,idx)=>gameQuestDailyRowHtml(g.id,t,idx,items.length)).join("")
      :`<div class="gqDailyEmpty">还没有任务。点右上角「＋ 任务」加一条，然后勾选它要在星期几出现。</div>`;
    const uiKey=`game-editor-daily:${g.id}`;
    const uiOpen=window.TaskRingProductUi?.openAttribute?.(uiKey,g.id===enabledGames[0]?.id)||"";
    return `<details class="gqDailyCard accent-${escapeHtml(g.accent)}" data-gq-daily-game="${escapeHtml(g.id)}" data-ui-details-key="${escapeHtml(uiKey)}"${uiOpen}>
      <summary class="gqDailyCardHead">
        <span class="gqDailyIcon">${escapeHtml(g.icon)}</span>
        <div class="gqDailyTitleWrap"><b>${escapeHtml(g.name)}</b><em>今日 / 指定日 · ${items.length} 项</em></div>
        <button type="button" class="gqDailyAddBtn" data-gq-add-daily="${escapeHtml(g.id)}">＋ 任务</button>
      </summary>
      <div class="gqDailyRows">${rows}</div>
    </details>`;
  }).join("")||`<div class="gameQuestEmpty compact"><b>还没有启用中的游戏卡。</b><span>先在下面「游戏大卡设置」里新增或启用一张卡，再回来排任务。</span></div>`;
  const weeklyRows=enabledGames.map(g=>{
    const value=gameQuestTaskLines((cfg.weekly||{})[g.id],"weekly").join("\n");
    return `<div class="gameQuestEditRow gameQuestEditRowV2 gameQuestWeeklyEditRow accent-${escapeHtml(g.accent)}"><div class="gameQuestEditGame"><span>${escapeHtml(g.icon)}</span><b>${escapeHtml(g.name)}</b><em>本周池</em></div><textarea data-gq-weekly-edit-game="${escapeHtml(g.id)}" placeholder="本周做一次即可的任务，一行一条。\n例如：周常清理\n深塔/海墟/全息\n式舆/危局/鏖战\n模拟宇宙/末日/虚构检查">${escapeHtml(value)}</textarea></div>`;
  }).join("");
  const weeklyKey="game-editor-weekly";
  const weeklyOpen=window.TaskRingProductUi?.openAttribute?.(weeklyKey,false)||"";
  list.innerHTML=`<section class="gameQuestEditGroup gameQuestScheduleGroup gameQuestDailyGroupV3"><div class="gameQuestEditHead"><div><b>每天 / 指定日清单</b><span>每个游戏一张卡：先写任务名，再勾它要出现的星期。勾满一整周＝每日任务，只勾几天＝指定日任务；周常/深渊类请放到下面的本周池。</span></div></div>${enabledGames.length?dayLegend:""}<div class="gqDailyDeck">${dailyCards}</div></section><details class="gameQuestEditGroup gameQuestWeeklyGroup" data-ui-details-key="${weeklyKey}"${weeklyOpen}><summary class="gameQuestEditHead"><div><b>本周游戏作战池</b><span>${enabledGames.length} 个游戏 · 周常、深境与一次性目标</span></div><span>展开</span></summary><div class="gameQuestWeeklyBody">${weeklyRows}</div></details><details class="gameQuestMetaDetails" data-ui-details-key="game-editor-meta"><summary><span><b>游戏大卡设置</b><em>${(cfg.games||[]).length} 张卡｜改名、图标、排序时再打开</em></span></summary><div class="gameQuestMetaBody"><button type="button" class="gameQuestPrimaryBtn slim" id="addGameQuestCardBtn">+ 新增游戏卡</button><div class="gqMetaGrid">${metaRows}</div></div></details>`;
  syncEditorSectionToggle("game");
  gameQuestEditorLog("按游戏排任务：写任务名 + 勾星期即可，不用再一天天复制。本周池维持一行一条。");
}

async function saveGameQuestConfig(){
  const btn=document.getElementById("saveGameQuestBtn");
  try{
    setBtnBusy(btn,true,"保存中…");
    collectGameQuestEditorState();
    const gameQuest=normalizeGameQuestConfig({...gameQuestDraftConfig,updatedAt:new Date().toISOString()});
    const base=normalizeTaskConfig(taskConfig||buildDefaultConfig());
    const cfg=normalizeTaskConfig({...base,gameQuest,updatedAt:new Date().toISOString()});
    gameQuestSelectedDay=gameQuestEditorDay;
    saveLocalTaskConfig(cfg);
    applyTaskConfig(cfg,true);
    if(ghToken()){
      setGhStatus("GitHub：保存配置中","sync");
      await ghPatchConfig(cfg);
      setGhStatus("GitHub：已同步","on");
      ghLog("游戏任务配置已合并进 taskring-config.json 并加密同步");
      showToast("游戏作战区已保存并同步","ok");
    }else{
      showToast("游戏作战区已保存到本机","ok");
    }
    gameQuestEditorLog("保存完成。旧兵法：先稳住阵地，再谈花活。");
  }catch(err){
    console.error(err);
    setGhStatus("GitHub：配置保存失败","err");
    gameQuestEditorLog(String(err.message||err));
    showToast("游戏任务保存失败，请看日志","err",3000);
  }finally{
    setBtnBusy(btn,false);
  }
}
function resetGameQuestDraft(){
  if(!confirm("确认重载当前已保存的游戏配置？编辑器里的未保存修改会丢失。"))return;
  gameQuestDraftConfig=deepClone(gameQuestConfig||taskConfig?.gameQuest||normalizeGameQuestConfig(defaultGameQuestConfig));
  gameQuestDraftConfig.dailyByGame=buildGameQuestDailyByGame(gameQuestDraftConfig);
  renderGameQuestEditor();
  gameQuestEditorLog("已重载当前已保存配置。未保存的编辑已丢弃。");
}
function exportGameQuestConfig(){
  collectGameQuestEditorState();
  const cfg=normalizeGameQuestConfig(gameQuestDraftConfig||gameQuestConfig||defaultGameQuestConfig);
  navigator.clipboard?.writeText(JSON.stringify(cfg,null,2)).then(()=>{gameQuestEditorLog("游戏配置 JSON 已复制到剪贴板。")}).catch(()=>{gameQuestEditorLog(JSON.stringify(cfg,null,2))});
}
function importGameQuestConfig(){
  const raw=prompt("粘贴 gameQuest JSON 内容：");
  if(!raw)return;
  try{
    gameQuestDraftConfig=normalizeGameQuestConfig(JSON.parse(raw));
    gameQuestDraftConfig.dailyByGame=buildGameQuestDailyByGame(gameQuestDraftConfig);
    renderGameQuestEditor();
    gameQuestEditorLog("已导入游戏配置，保存后生效。");
  }catch(err){
    gameQuestEditorLog("导入失败："+String(err.message||err));
    showToast("游戏配置 JSON 不合法","err");
  }
}
function initGameQuestUI(){
  document.getElementById("gameQuestEditorCloseBtn")?.addEventListener("click",closeGameQuestEditor);
  document.getElementById("gameQuestEditorBottomCloseBtn")?.addEventListener("click",closeGameQuestEditor);
  document.getElementById("saveGameQuestBtn")?.addEventListener("click",saveGameQuestConfig);
  document.getElementById("gameQuestEditorBottomSaveBtn")?.addEventListener("click",saveGameQuestConfig);
  document.getElementById("resetGameQuestBtn")?.addEventListener("click",resetGameQuestDraft);
  document.getElementById("exportGameQuestBtn")?.addEventListener("click",exportGameQuestConfig);
  document.getElementById("importGameQuestBtn")?.addEventListener("click",importGameQuestConfig);
  document.getElementById("gameQuestEditorSectionToggleBtn")?.addEventListener("click",()=>toggleEditorSections("game"));
  document.getElementById("gameQuestEditorList")?.addEventListener("toggle",()=>syncEditorSectionToggle("game"),true);
  document.getElementById("gameQuestEditorList")?.addEventListener("click",e=>{
    const addBtn=e.target.closest("#addGameQuestCardBtn");
    if(addBtn){e.preventDefault();addGameQuestGame();return}
    const addDaily=e.target.closest("[data-gq-add-daily]");
    if(addDaily){e.preventDefault();addGameQuestDailyTask(addDaily.dataset.gqAddDaily);return}
    const delDaily=e.target.closest("[data-gq-del-daily]");
    if(delDaily){e.preventDefault();removeGameQuestDailyTask(delDaily.dataset.gqGame,Number(delDaily.dataset.gqIndex));return}
    const moveDaily=e.target.closest("[data-gq-daily-move]");
    if(moveDaily){e.preventDefault();moveGameQuestDailyTask(moveDaily.dataset.gqGame,Number(moveDaily.dataset.gqIndex),moveDaily.dataset.gqDailyMove==="up"?-1:1);return}
    const fillDaily=e.target.closest("[data-gq-daily-fill]");
    if(fillDaily){e.preventDefault();const row=fillDaily.closest("[data-gq-daily-row]");row?.querySelectorAll(".gqDayBox").forEach(b=>{b.checked=true});return}
    const moveBtn=e.target.closest("[data-gq-move][data-gq-row-id]");
    if(moveBtn){e.preventDefault();moveGameQuestGame(moveBtn.dataset.gqRowId,moveBtn.dataset.gqMove==='up'?-1:1);return}
    const iconBtn=e.target.closest("[data-gq-icon]");
    if(iconBtn){
      e.preventDefault();
      const row=iconBtn.closest("[data-gq-game-row]");
      const input=row?.querySelector(".gqMetaIcon");
      if(input){input.value=iconBtn.dataset.gqIcon;const preview=row?.querySelector(".gqIconPreview");if(preview)preview.textContent=iconBtn.dataset.gqIcon;row.querySelectorAll(".gqIconPick").forEach(b=>b.classList.toggle("active",b===iconBtn));}
      return;
    }
    const delBtn=e.target.closest("[data-gq-delete]");
    if(delBtn){e.preventDefault();removeGameQuestGame(delBtn.dataset.gqDelete);return}
  });
}



/* RANDOM_CUTIN_CHARACTERS moved to assets/js/data/default-data.js */

function playCompletionEffect({level="task",category="",anchor=null,title="",eventId="",date=""}={}){
  return window.TaskRingEffects?.play({level,category,anchor,title,eventId,date})||false;
}

function orbitDayStats(dayId){
  const list=ringBlocks().filter(t=>t.days.includes(dayId)).map(t=>({t,dayId,cycle:cycleYmd}));
  let done=0,failed=0,overdue=0,warn=0,ignored=0;
  for(const o of list){const st=occurrenceState(o.t,o.dayId,o.cycle);if(st.done)done++;if(st.failed)failed++;if(st.overdue)overdue++;if(st.warn)warn++;if(st.ignored)ignored++;}
  return {total:list.length,done,failed,overdue,warn,ignored,attention:failed+overdue+warn};
}
function isOrbitDrawerOpen(){
  const saved=localStorage.getItem(ORBIT_DRAWER_OPEN_KEY);
  if(saved==="1")return true;
  if(saved==="0")return false;
  return false;
}
function renderOrbitPanel(){
  const el=document.getElementById("orbitPanel");
  if(!el)return;
  const occs=todayOccurrences(true);
  const total=occs.length;
  const done=occs.filter(o=>isDone(o.t.id,o.dayId,o.cycle)).length;
  const pct=total?Math.round(done/total*100):100;
  const carry=carryoverOccurrences().length;
  const nodes=days.map(d=>{const s=orbitDayStats(d.id);const p=s.total?Math.round(s.done/s.total*100):100;const cls=[d.id===today?"today":"",s.failed?"failed":"",s.attention&&!s.failed?"attention":""].join(" ");const alert=s.failed?`<span class="orbitAlert orbitFail"><b>×${s.failed}</b><em>锁定</em></span>`:s.attention?`<span class="orbitAlert orbitWarn"><b>!${s.attention}</b><em>关注</em></span>`:"";return `<div class="orbitDay ${cls}" title="${escapeHtml(d.name)}：完成 ${s.done}/${s.total}${s.attention?`，需关注 ${s.attention}`:""}"><div class="orbitDayName">${escapeHtml(d.name)}${d.id===today?"｜今日":""}</div><div class="orbitDayMeta"><span class="orbitDone"><b>${s.done}/${s.total}</b><em>完成</em></span>${alert}</div><div class="orbitMeter" style="--w:${p}%"><span></span></div></div>`}).join("");
  const summary=`完成 ${done}/${total}${carry?` · 遗留 ${carry} 项`:""}`;
  el.innerHTML=`<details class="orbitDrawer" ${isOrbitDrawerOpen()?"open":""}><summary><span class="orbitDrawerMini" style="--pct:${pct}%"><b>${pct}%</b></span><span class="orbitDrawerText"><strong>今日执行环</strong><em>${summary}</em></span><span class="orbitDrawerToggle">展开</span></summary><div class="orbitDrawerBody"><div class="orbitLayout"><div class="orbitCore" style="--pct:${pct}%"><div class="orbitCenter"><span class="orbitPct">${pct}%</span><span class="orbitLabel">今日完成率</span><span class="orbitTiny">${summary}</span></div></div><div class="orbitSide"><div class="orbitTop"><div><div class="orbitTitle">一周执行分布</div><div class="orbitSub">每格依次显示完成数与需关注数。</div></div></div><div class="orbitDays">${nodes}</div></div></div></div></details>`;
}
document.addEventListener("toggle",e=>{if(e.target?.matches?.(".orbitDrawer"))localStorage.setItem(ORBIT_DRAWER_OPEN_KEY,e.target.open?"1":"0")},true);

function closeSubtaskPopover(){
  document.getElementById("subtaskPopover")?.remove();
  document.querySelectorAll(".subtaskBtn.active").forEach(b=>b.classList.remove("active"));
}
function subtaskPopoverRows(t,dayId,cycle){
  const c=cats[t.cat]||{cls:""};
  return stepTasks[t.id].map(s=>{
    const done=isStepDone(t.id,s.id,dayId,cycle);
    return `<label class="stepChip ${c.cls||""}Step ${done?"done":""}"><input type="checkbox" data-parent="${escapeHtml(t.id)}" data-step="${escapeHtml(s.id)}" data-day="${dayId}" data-cycle="${escapeHtml(cycle)}" ${done?"checked":""}><span>${escapeHtml(s.title)}</span></label>`;
  }).join("");
}
function refreshSubtaskPopover(taskId,dayId,cycle){
  const panel=document.getElementById("subtaskPopover");
  if(!panel)return;
  const t=blocks.find(x=>x.id===taskId);
  if(!t||!hasSteps(t.id)){closeSubtaskPopover();return;}
  const prog=stepProgress(t,dayId,cycle);
  panel.innerHTML=`<div class="stepPopoverHead"><div><strong>${escapeHtml(dayName(dayId))} 的分任务</strong><span>${escapeHtml(t.title)} · ${prog.done}/${prog.total}</span></div><button type="button" class="stepPopoverClose" aria-label="关闭">×</button></div><div class="stepPopoverBody stepPanel">${subtaskPopoverRows(t,dayId,cycle)}</div>`;
  document.querySelectorAll(".subtaskBtn.active").forEach(b=>b.classList.remove("active"));
  const btn=Array.from(document.querySelectorAll(".subtaskBtn")).find(b=>b.dataset.subtaskTask===taskId&&Number(b.dataset.subtaskDay)===Number(dayId)&&(b.dataset.subtaskCycle||cycleYmd)===cycle);
  if(btn)btn.classList.add("active");
}
function openSubtaskPopover(btn){
  const taskId=btn.dataset.subtaskTask;
  const dayId=Number(btn.dataset.subtaskDay);
  const cycle=btn.dataset.subtaskCycle||cycleYmd;
  const t=blocks.find(x=>x.id===taskId);
  if(!t||!hasSteps(t.id))return;
  const wasActive=btn.classList.contains("active");
  closeSubtaskPopover();
  if(wasActive)return;
  btn.classList.add("active");
  const prog=stepProgress(t,dayId,cycle);
  const panel=document.createElement("div");
  panel.id="subtaskPopover";
  panel.className="stepPopover";
  panel.innerHTML=`<div class="stepPopoverHead"><div><strong>${escapeHtml(dayName(dayId))} 的分任务</strong><span>${escapeHtml(t.title)} · ${prog.done}/${prog.total}</span></div><button type="button" class="stepPopoverClose" aria-label="关闭">×</button></div><div class="stepPopoverBody stepPanel">${subtaskPopoverRows(t,dayId,cycle)}</div>`;
  document.body.appendChild(panel);
  const r=btn.getBoundingClientRect();
  const vw=window.innerWidth;
  const vh=window.innerHeight;
  const mobile=vw<=700;
  if(mobile){
    panel.style.left="12px";
    panel.style.right="12px";
    panel.style.top=Math.max(12,Math.min(vh-panel.offsetHeight-12,r.bottom+8))+"px";
  }else{
    const width=Math.min(420,Math.max(320,Math.round(vw*0.28)));
    panel.style.width=width+"px";
    let left=Math.max(12,Math.min(vw-width-12,r.left));
    let top=r.bottom+8;
    if(top+panel.offsetHeight>vh-12)top=Math.max(12,r.top-panel.offsetHeight-8);
    panel.style.left=left+"px";
    panel.style.top=top+"px";
  }
}
function visibleRefGroups(){return [...document.querySelectorAll("#refGrid .refGroup")].filter(group=>!group.hidden)}
function syncRefGroupToggleButton(){
  const btn=document.getElementById("refExpandAllBtn");if(!btn)return;
  const groups=visibleRefGroups();
  const hasOpen=groups.some(group=>group.open);
  btn.textContent=hasOpen?"收起项目":"展开项目";
  btn.setAttribute("aria-expanded",String(hasOpen));
  btn.title=hasOpen?"收起所有资料分组，只显示分组标题":"展开所有资料分组，显示其中的资料条目";
}
function toggleAllRefGroups(){
  const groups=visibleRefGroups();if(!groups.length)return;
  const shouldOpen=!groups.some(group=>group.open);
  groups.forEach(group=>{group.open=shouldOpen});
  requestAnimationFrame(syncRefGroupToggleButton);
}
function renderAll(){const uiState=restoreUiScrollFromStorage?readUiScrollState():collectUiScrollState();renderGameQuestPanel();renderWeeklyPlanPanel();renderTimePanel();renderTable();renderMobileTabs();renderMobileCards();renderReferenceLibrary();renderOrbitPanel();updateProgress();renderTimerDock();applyActiveAppView();restoreUiScrollState(uiState);restoreUiScrollFromStorage=false}
function closeEditorsByBackdrop(target){
  if(target.id==="taskEditorModal")closeTaskEditor();
  if(target.id==="refEditorModal")closeRefEditor();
  if(target.id==="gameQuestEditorModal")closeGameQuestEditor();
  if(target.id==="ghModal")closeGhModal();
}
document.body.addEventListener("click",e=>{
  const gqWeeklyFilterBtn=e.target.closest("[data-gq-weekly-filter]");
  if(!gqWeeklyFilterBtn)return;
  e.preventDefault();
  e.stopPropagation();
  setGameQuestWeeklyFilter(gqWeeklyFilterBtn.dataset.gqWeeklyFilter||"all");
},true);
document.body.addEventListener("click",e=>{const viewBtn=e.target.closest("[data-view-target]");if(viewBtn){e.preventDefault();e.stopPropagation();setActiveAppView(viewBtn.dataset.viewTarget);return}const timeTab=e.target.closest("[data-time-tab]");if(timeTab){e.preventDefault();e.stopPropagation();setTimeLedgerView(timeTab.dataset.timeTab);return}if(e.target.closest("[data-time-modal-close]")){e.preventDefault();e.stopPropagation();closeTimeDetailModal();return}if(e.target.id==="timeDetailModal"){closeTimeDetailModal();return}const minutesPreset=e.target.closest("[data-manual-minutes-preset]");if(minutesPreset){e.preventDefault();const input=minutesPreset.closest("form")?.elements?.minutes;if(input){input.value=minutesPreset.dataset.manualMinutesPreset;input.focus()}return}const manualTimeEntry=e.target.closest("[data-manual-time-entry]");if(manualTimeEntry){e.preventDefault();e.stopPropagation();openManualTimeEntry(manualTimeEntry.dataset.manualTimeEntry,manualTimeEntry.dataset.manualTaskId||"");return}const timeDelete=e.target.closest("[data-time-log-delete]");if(timeDelete){e.preventDefault();e.stopPropagation();deleteTimeLog(timeDelete.dataset.timeLogDelete);return}const taskTimeDetail=e.target.closest("[data-time-task-detail]");if(taskTimeDetail){e.preventDefault();e.stopPropagation();openTaskTimeDetail(taskTimeDetail.dataset.timeTaskDetail);return}const gameTimeDetail=e.target.closest("[data-time-gamequest-detail]");if(gameTimeDetail){e.preventDefault();e.stopPropagation();openGameQuestTimeDetail();return}const gqTimerStart=e.target.closest("[data-timer-start-gamequest]");if(gqTimerStart){e.preventDefault();e.stopPropagation();startGameQuestTimer(Number(gqTimerStart.dataset.gamequestDay),gqTimerStart.dataset.cycle||cycleYmd);return}const timerStart=e.target.closest("[data-timer-start-task]");if(timerStart){e.preventDefault();e.stopPropagation();startTaskTimer(timerStart.dataset.timerStartTask,Number(timerStart.dataset.timerDay),timerStart.dataset.timerCycle||cycleYmd);return}if(e.target.closest("[data-timer-pause]")){e.preventDefault();e.stopPropagation();pauseActiveTimer();return}if(e.target.closest("[data-timer-resume]")){e.preventDefault();e.stopPropagation();resumeActiveTimer();return}if(e.target.closest("[data-timer-complete]")){e.preventDefault();e.stopPropagation();completeActiveTimer(true);return}if(e.target.closest("[data-timer-abandon]")){e.preventDefault();e.stopPropagation();abandonActiveTimer();return}const controlGameEditor=e.target.closest("#controlGameQuestEditorBtn");if(controlGameEditor){e.preventDefault();e.stopPropagation();openGameQuestEditor();return}const controlTaskEditor=e.target.closest("#controlTaskEditorBtn");if(controlTaskEditor){e.preventDefault();e.stopPropagation();openTaskEditor();return}const controlRefEditor=e.target.closest("#controlRefEditorBtn");if(controlRefEditor){e.preventDefault();e.stopPropagation();openRefEditor();return}const gqModeBtn=e.target.closest("[data-gamequest-board-mode]");if(gqModeBtn){e.preventDefault();e.stopPropagation();setGameQuestBoardMode(gqModeBtn.dataset.gamequestBoardMode);return}const gqWeeklyItemBtn=e.target.closest("[data-gq-weekly-item-btn]");if(gqWeeklyItemBtn){e.preventDefault();e.stopPropagation();closeSubtaskPopover();const cyc=gqWeeklyItemBtn.dataset.cycle||cycleYmd;const next=gqWeeklyItemBtn.getAttribute("aria-pressed")!=="true";setGameQuestWeeklyItemDone(gqWeeklyItemBtn.dataset.gamequestWeeklyGame,gqWeeklyItemBtn.dataset.gamequestWeeklyItem,next,gqWeeklyItemBtn,cyc);return}const gqWeeklyCardBtn=e.target.closest("[data-gq-weekly-card-btn]");if(gqWeeklyCardBtn){e.preventDefault();e.stopPropagation();closeSubtaskPopover();const cyc=gqWeeklyCardBtn.dataset.cycle||cycleYmd;const next=gqWeeklyCardBtn.getAttribute("aria-pressed")!=="true";setGameQuestWeeklyDone(gqWeeklyCardBtn.dataset.gamequestWeeklyGame,next,gqWeeklyCardBtn,cyc);return}const gqItemBtn=e.target.closest("[data-gq-item-btn]");if(gqItemBtn){e.preventDefault();e.stopPropagation();closeSubtaskPopover();const cyc=gqItemBtn.dataset.cycle||cycleYmd;const next=gqItemBtn.getAttribute("aria-pressed")!=="true";setGameQuestItemDone(gqItemBtn.dataset.gamequestItemGame,Number(gqItemBtn.dataset.gamequestItemDay),gqItemBtn.dataset.gamequestItem,next,gqItemBtn,cyc);return}const gqCardBtn=e.target.closest("[data-gq-card-btn]");if(gqCardBtn){e.preventDefault();e.stopPropagation();closeSubtaskPopover();const cyc=gqCardBtn.dataset.cycle||cycleYmd;const next=gqCardBtn.getAttribute("aria-pressed")!=="true";setGameQuestDone(gqCardBtn.dataset.gamequestGame,Number(gqCardBtn.dataset.gamequestDay),next,gqCardBtn,cyc);return}if(e.target.closest("#controlCenterBtn")||e.target.closest("#controlCenterMenu")){}else closeControlCenter();const gqDay=e.target.closest("[data-gamequest-day-select]");if(gqDay){e.preventDefault();gameQuestSelectedDay=Number(gqDay.dataset.gamequestDaySelect);setGameQuestBoardMode("today");return}const gqToggle=e.target.closest("#gameQuestToggleBtn");if(gqToggle){e.preventDefault();toggleGameQuestCollapsed();return}const gqCollapsedBar=e.target.closest("[data-gq-collapsed-toggle]");if(gqCollapsedBar){e.preventDefault();toggleGameQuestCollapsed();return}const gqToday=e.target.closest("#gameQuestTodayBtn");if(gqToday){e.preventDefault();gameQuestSelectedDay=today;setGameQuestBoardMode("today");return}const refEditorQuick=e.target.closest("[data-open-ref-editor]");if(refEditorQuick){e.preventDefault();e.stopPropagation();openRefEditor();return}const refBtn=e.target.closest("#refExpandAllBtn");if(refBtn){e.preventDefault();e.stopPropagation();toggleAllRefGroups();return}const btn=e.target.closest(".subtaskBtn");if(btn){e.preventDefault();e.stopPropagation();openSubtaskPopover(btn);return}if(e.target.closest(".stepPopoverClose")){e.preventDefault();closeSubtaskPopover();return}if(["taskEditorModal","refEditorModal","gameQuestEditorModal","ghModal"].includes(e.target.id)){closeEditorsByBackdrop(e.target);return}if(!e.target.closest("#subtaskPopover"))closeSubtaskPopover();});document.body.addEventListener("submit",e=>{const form=e.target.closest?.("[data-manual-time-form]");if(!form)return;e.preventDefault();saveManualTimeEntry(form)});document.body.addEventListener("change",e=>{const target=e.target;if(target?.matches?.("[data-time-target-task]")){updateTaskWeeklyTarget(target.dataset.timeTargetTask,target.value);return}const cb=target;if(!cb||!cb.matches('input[type="checkbox"]'))return;if(cb.dataset.locked==="1"||cb.disabled){e.preventDefault();renderAll();return}const cyc=cb.dataset.cycle||cycleYmd;if(cb.matches("[data-gamequest-item-game][data-gamequest-item-day][data-gamequest-item]")){setGameQuestItemDone(cb.dataset.gamequestItemGame,Number(cb.dataset.gamequestItemDay),cb.dataset.gamequestItem,cb.checked,cb,cyc);return}if(cb.matches("[data-gamequest-game][data-gamequest-day]")){setGameQuestDone(cb.dataset.gamequestGame,Number(cb.dataset.gamequestDay),cb.checked,cb,cyc);return}if(cb.matches("[data-parent][data-step][data-day]")){setStepDone(cb.dataset.parent,cb.dataset.step,Number(cb.dataset.day),cb.checked,cb,cyc);return}if(cb.matches("[data-task][data-day]")){setDone(cb.dataset.task,Number(cb.dataset.day),cb.checked,cb,true,cyc)}});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!document.getElementById("gameQuestEditorModal")?.classList.contains("hidden"))closeGameQuestEditor();else if(!document.getElementById("taskEditorModal")?.classList.contains("hidden"))closeTaskEditor();else if(!document.getElementById("refEditorModal")?.classList.contains("hidden"))closeRefEditor();else if(!document.getElementById("ghModal")?.classList.contains("hidden"))closeGhModal();else if(!document.getElementById("timeDetailModal")?.classList.contains("hidden"))closeTimeDetailModal();else closeSubtaskPopover();});
function resetCurrentWeek(){if(!confirm("确认重置本周全部勾选？"))return;syncRemoveCycle(cycleYmd);renderAll()}
const todayLabel=document.getElementById("todayLabel");
if(todayLabel){
  const fullToday=urlDateOverride?`查看：${ymd(operationalNow)} ${dayName(today)}`:`今天：${dayName(today)}`;
  const compactToday=urlDateOverride?`${operationalNow.getMonth()+1}/${operationalNow.getDate()}·${dayName(today)}`:`今·${dayName(today)}`;
  todayLabel.innerHTML=`<span class="headerLabelDesktop">${fullToday}</span><span class="headerLabelMobile">${compactToday}</span>`;
}
const cycleLabel=document.getElementById("cycleLabel");
if(cycleLabel){
  const compactCycle=`${cycleStart.getMonth()+1}/${cycleStart.getDate()}–${cycleEnd.getMonth()+1}/${cycleEnd.getDate()}`;
  cycleLabel.innerHTML=`<span class="headerLabelDesktop">周期：${ymd(cycleStart)} ～ ${ymd(cycleEnd)}</span><span class="headerLabelMobile">${compactCycle}</span>`;
}
const returnTodayBtn=document.getElementById("returnTodayBtn");
if(returnTodayBtn){
  returnTodayBtn.hidden=!urlDateOverride;
  returnTodayBtn.addEventListener("click",()=>{const u=new URL(location.href);u.searchParams.delete("date");location.href=u.toString()});
}
document.getElementById("controlLockQuickBtn")?.addEventListener("click",()=>softLockNow());
document.getElementById("showToday")?.addEventListener("click",()=>setDailyViewMode("today"));
document.getElementById("showAll")?.addEventListener("click",()=>setDailyViewMode("all"));
document.getElementById("showUndone")?.addEventListener("click",()=>setDailyViewMode("undone"));
document.getElementById("resetCurrentWeek")?.addEventListener("click",resetCurrentWeek);
document.getElementById("clearExpired")?.addEventListener("click",completeCarryoverTasks);
let taskRingCoreBooted=false;
window.TaskRingCoreBoot=function(){
  if(taskRingCoreBooted)return;
  taskRingCoreBooted=true;
  renderAll();
  initGithubSyncUI();
  initTaskEditorUI();
  initRefEditorUI();
  initGameQuestUI();
  setInterval(renderTimerLive,1000);
  setInterval(()=>{
    const refreshedRealNow=new Date();
    const refreshedOperationalNow=getOperationalDate(refreshedRealNow);
    const refreshedCycleStart=getCycleStart(refreshedRealNow);
    const dayChanged=refreshedOperationalNow.getDay()!==today;
    const cycleChanged=ymd(refreshedCycleStart)!==ymd(cycleStart);
    if(dayChanged||cycleChanged)location.reload();
  },60*1000);
};
