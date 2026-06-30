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


function normalizeGameQuestTextList(value){
  if(Array.isArray(value))return value.map(v=>String(v||"").trim()).filter(Boolean).slice(0,10);
  if(typeof value==="string")return value.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,10);
  return [];
}
function normalizeGameQuestConfig(config){
  const fallback=deepClone(typeof defaultGameQuestConfig!=="undefined"?defaultGameQuestConfig:{version:1,games:[],schedule:{}});
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
      icon:String(g.icon||"🎮").trim()||"🎮",
      accent:String(g.accent||["cyan","amber","violet","blue","rose","gold"][idx%6]).trim()||"cyan",
      enabled:g.enabled!==false
    };
  });
  const schedule={};
  [1,2,3,4,5,6,0].forEach(day=>{
    const rawDay=(src.schedule&&src.schedule[String(day)])||(fallback.schedule&&fallback.schedule[String(day)])||{};
    const dayObj={};
    games.forEach(g=>{
      const list=normalizeGameQuestTextList(rawDay[g.id]);
      if(list.length)dayObj[g.id]=list;
    });
    schedule[String(day)]=dayObj;
  });
  return {version:1,updatedAt:String(src.updatedAt||""),games,schedule};
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
      steps
    }
  });
  return {version:3, privacy:"coded-state-keys", updatedAt:new Date().toISOString(), tasks, refs:deepClone(defaultRefGroups), gameQuest:deepClone(defaultGameQuestConfig)};
}
function normalizeTaskConfig(config){
  const fallback=buildDefaultConfig();
  const src=config&&Array.isArray(config.tasks)?config:fallback;
  const usedIds=new Set();
  const usedCodes=new Set();
  const validCats=new Set(["life","gamecreate","language"]);
  const tasks=src.tasks.map((raw,idx)=>{
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
      steps
    };
  });
  return {version:3, privacy:"coded-state-keys", updatedAt:String(src.updatedAt||new Date().toISOString()), tasks, refs:normalizeRefGroups(src.refs||fallback.refs), gameQuest:normalizeGameQuestConfig(src.gameQuest||fallback.gameQuest)};
}
function applyTaskConfig(config, shouldRender=false){
  taskConfig=normalizeTaskConfig(config);
  refGroups=taskConfig.refs||normalizeRefGroups(defaultRefGroups);
  gameQuestConfig=taskConfig.gameQuest||normalizeGameQuestConfig(defaultGameQuestConfig);
  blocks=taskConfig.tasks.filter(t=>t.enabled!==false).map(t=>({
    id:t.id, code:t.code, cat:t.cat, title:t.title, days:t.days, url:t.url||"",
    core:t.core?1:0, optional:t.optional?1:0, important:t.important?1:0, enabled:t.enabled!==false
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

function loadLocalTaskConfig(){
  try{
    const raw=localStorage.getItem(TASK_CONFIG_LOCAL_KEY);
    if(!raw)return null;
    return normalizeTaskConfig(JSON.parse(raw));
  }catch(e){
    console.warn("local task config load failed",e);
    return null;
  }
}
function saveLocalTaskConfig(config){
  const cfg=normalizeTaskConfig(config);
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
const ROLLOVER_HOUR=4;function getOperationalDate(date){const d=new Date(date);if(d.getHours()<ROLLOVER_HOUR){d.setDate(d.getDate()-1)}return d}const realNow=new Date();const operationalNow=getOperationalDate(realNow);const today=operationalNow.getDay();let viewMode="undone";let mobileDay=today;
function pad(n){return String(n).padStart(2,"0")}
function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function dayName(id){return days.find(d=>d.id===id)?.name||""}
function dayNamesFor(t){return t.days.map(dayName).join("・")}
function getCycleStart(date){const ref=new Date(date);const d=new Date(ref.getFullYear(),ref.getMonth(),ref.getDate(),4,0,0,0);const day=ref.getDay();const daysSinceMonday=(day+6)%7;d.setDate(d.getDate()-daysSinceMonday);if(ref<d)d.setDate(d.getDate()-7);return d}
const cycleStart=getCycleStart(realNow);
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
let ghSaveTimer=null;
let ghSaving=false;
function lockApp(msg="需要 Token 解锁"){document.body.classList.add("locked");const sub=document.querySelector(".lockSub");if(sub)sub.textContent=msg}
function unlockApp(){document.body.classList.remove("locked")}
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
  el.textContent=msg;
  el.className=`toastBox ${type} show`;
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
async function ghPull(){if(!ghToken()){setGhStatus("GitHub：未设置","off");ghLog("请先设置 Token");lockApp("请输入本机 GitHub Token 解锁。未解锁时不会显示任务模板。");return}try{setGhStatus("GitHub：读取中","sync");migrateLegacyLocalStates();const gist=await ghFetchGist();const cfgResult=await ghParseConfig(gist);
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
const state=ghParseState(gist);const localStates=collectGhLocalStates();const localCount=Object.keys(localStates).length;const result=applyGhStates(state.states||{});if(result.applied===0&&localCount>0){ghLog(`云端为空，本机有 ${localCount} 项，先上传本机状态`);await ghPush(true);unlockApp();return}setGhStatus("GitHub：已同步","on");ghLog(`读取成功：${result.applied} 项${result.migrated?`；已迁移旧Key ${result.migrated} 项`:""}`);unlockApp();renderAll();if(result.migrated>0)setTimeout(()=>ghPush(true),1200)}catch(err){console.error(err);setGhStatus("GitHub：读取失败","err");ghLog(String(err.message||err));lockApp("Token 无效、权限不足，或读取 Gist 失败。请重新输入 Token。")}}
async function ghPush(silent=false){if(!ghToken()){setGhStatus("GitHub：未设置","off");if(!silent)openGhModal();return}try{ghSaving=true;setGhStatus("GitHub：保存中","sync");const data={version:2,privacy:"coded-state-keys",updatedAt:new Date().toISOString(),states:collectGhLocalStates()};await ghPatchState(data);ghSaving=false;setGhStatus("GitHub：已同步","on");ghLog(`保存成功：${Object.keys(data.states).length} 项`);unlockApp();renderAll()}catch(err){console.error(err);ghSaving=false;setGhStatus("GitHub：保存失败","err");ghLog(String(err.message||err))}}
function scheduleGhSave(){if(!ghToken()){setGhStatus("GitHub：未设置","off");return}setGhStatus("GitHub：等待保存","sync");clearTimeout(ghSaveTimer);ghSaveTimer=setTimeout(()=>ghPush(true),900)}
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
function openControlCenter(){
  const m=ensureControlCenterPortal();
  if(!m)return;
  controlBackdrop().classList.remove("hidden");
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden","false");
  document.body.classList.add("controlCenterOpen");
}
function closeControlCenter(){
  const m=controlMenu();
  if(m){
    m.classList.add("hidden");
    m.setAttribute("aria-hidden","true");
  }
  controlBackdrop()?.classList.add("hidden");
  document.body.classList.remove("controlCenterOpen");
}
function toggleControlCenter(){const m=ensureControlCenterPortal();if(!m)return;m.classList.contains("hidden")?openControlCenter():closeControlCenter()}
function initGithubSyncUI(){document.getElementById("lockUnlockBtn")?.addEventListener("click",openGhModal);document.getElementById("githubSetupBtn")?.addEventListener("click",openGhModal);document.getElementById("githubStatus")?.addEventListener("click",openGhModal);document.getElementById("controlGithubBtn")?.addEventListener("click",()=>{closeControlCenter();openGhModal()});document.getElementById("controlPullBtn")?.addEventListener("click",()=>{closeControlCenter();ghPull()});document.getElementById("controlPushBtn")?.addEventListener("click",()=>{closeControlCenter();ghPush(false)});document.getElementById("controlGameQuestEditorBtn")?.addEventListener("click",()=>{closeControlCenter();openGameQuestEditor()});document.getElementById("controlTaskEditorBtn")?.addEventListener("click",()=>{closeControlCenter();openTaskEditor()});document.getElementById("controlRefEditorBtn")?.addEventListener("click",()=>{closeControlCenter();openRefEditor()});document.getElementById("controlClearExpiredBtn")?.addEventListener("click",()=>{closeControlCenter();completeCarryoverTasks()});document.getElementById("controlCenterBtn")?.addEventListener("click",e=>{e.stopPropagation();toggleControlCenter()});document.getElementById("ghCloseBtn")?.addEventListener("click",closeGhModal);document.getElementById("ghSaveTokenBtn")?.addEventListener("click",()=>{const v=document.getElementById("ghTokenInput").value.trim();setGhToken(v);ghLog("Token 已保存到本机，开始同步");showToast("Token 已保存，开始同步","ok");closeGhModal();ghPull()});document.getElementById("ghPullBtn")?.addEventListener("click",ghPull);document.getElementById("ghPushBtn")?.addEventListener("click",()=>ghPush(false));document.getElementById("ghClearTokenBtn")?.addEventListener("click",()=>{if(confirm("确认清除本机保存的 GitHub Token？")){setGhToken("");setGhStatus("GitHub：未设置","off");ghLog("Token 已清除");lockApp("Token 已清除。请输入本机 GitHub Token 解锁。")}});if(ghToken())ghPull();else{setGhStatus("GitHub：未设置","off");lockApp("请输入本机 GitHub Token 解锁。未解锁时不会显示任务模板。")}}


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
  taskEditorLog(`已加载 ${cfg.tasks.length} 个任务。`)
}
function collectEditorConfig(){
  const rows=[...document.querySelectorAll(".cfgTask")];
  const usedStepCodesGlobal=new Map();
  const tasks=rows.map((row,idx)=>{
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
      core:row.querySelector(".cfgCore").checked,
      optional:row.querySelector(".cfgOptional").checked,
      important:row.querySelector(".cfgImportant").checked,
      enabled:row.querySelector(".cfgEnabled").checked,
      steps
    }
  });
  return normalizeTaskConfig({version:3,privacy:"coded-state-keys",updatedAt:new Date().toISOString(),tasks,refs:refGroups,gameQuest:gameQuestConfig});
}
async function saveEditorConfig(){
  const btn=document.getElementById("saveConfigBtn");
  if(!ghToken()){openGhModal();taskEditorLog("请先设置 GitHub Token。");showToast("请先设置 GitHub Token","warn");return}
  try{
    setBtnBusy(btn,true,"同步中…");
    showToast("配置加密同步中…","warn",1600);
    const cfg=collectEditorConfig();
    saveLocalTaskConfig(cfg);
    applyTaskConfig(cfg,true);
    setGhStatus("GitHub：保存配置中","sync");
    await ghPatchConfig(cfg);
    setGhStatus("GitHub：已同步","on");
    taskEditorLog(`配置已加密同步：${cfg.tasks.length} 个任务。`);
    ghLog("任务配置已加密保存到 taskring-config.json");
    showToast("配置已加密同步到 GitHub","ok");
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
  const t={id:makeTaskId(),code:makeTaskCode(),cat:"life",title:"新任务",days:[today],url:"",enabled:true,core:false,optional:false,important:false,steps:[]};
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
function initTaskEditorUI(){
  document.getElementById("taskEditorBtn")?.addEventListener("click",()=>{closeGhModal();openTaskEditor()});
  document.getElementById("taskEditorCloseBtn")?.addEventListener("click",closeTaskEditor);
  document.getElementById("taskEditorBottomCloseBtn")?.addEventListener("click",closeTaskEditor);
  document.getElementById("addTaskBtn")?.addEventListener("click",addEditorTask);
  document.getElementById("saveConfigBtn")?.addEventListener("click",saveEditorConfig);
  document.getElementById("taskEditorBottomSaveBtn")?.addEventListener("click",saveEditorConfig);
  document.getElementById("exportConfigBtn")?.addEventListener("click",exportEditorConfig);
  document.getElementById("importConfigBtn")?.addEventListener("click",importEditorConfig);
  document.getElementById("reloadSavedConfigBtn")?.addEventListener("click",reloadSavedEditorConfig);
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
    core:row.querySelector(".cfgCore").checked,
    optional:row.querySelector(".cfgOptional").checked,
    important:row.querySelector(".cfgImportant").checked,
    enabled:row.querySelector(".cfgEnabled").checked,
    steps
  }
}


/* === v9.0 Reference Library Editor === */
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
  return `<div class="refCfgGroup ${g.enabled===false?"disabled":""}" data-id="${cfgEsc(g.id)}">
    <div class="cfgTop">
      <div><span class="cfgMini">${cfgEsc(g.id||"")}</span></div>
      <div class="cfgOps">
        <button data-refop="up">上移</button><button data-refop="down">下移</button><button data-refop="copy">复制</button><button data-refop="remove" class="ghDangerBtn">删除</button>
      </div>
    </div>
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
  </div>`;
}
function renderRefEditor(){
  const list=document.getElementById("refEditorList");
  if(!list)return;
  const groups=normalizeRefGroups(refGroups&&refGroups.length?refGroups:defaultRefGroups);
  list.innerHTML=groups.map(refEditorGroupHtml).join("");
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
  if(!ghToken()){openGhModal();refEditorLog("请先设置 GitHub Token。");showToast("请先设置 GitHub Token","warn");return}
  try{
    setBtnBusy(btn,true,"同步中…");
    showToast("资料库加密同步中…","warn",1500);
    const refs=collectRefEditorConfig();
    const base=normalizeTaskConfig(taskConfig||buildDefaultConfig());
    const cfg=normalizeTaskConfig({...base,refs,updatedAt:new Date().toISOString()});
    saveLocalTaskConfig(cfg);
    applyTaskConfig(cfg,true);
    setGhStatus("GitHub：保存配置中","sync");
    await ghPatchConfig(cfg);
    setGhStatus("GitHub：已同步","on");
    refEditorLog(`资料库已加密同步：${refs.length} 个分组。`);
    ghLog("资料库配置已合并进 taskring-config.json 并加密同步");
    showToast("资料库已加密同步到 GitHub","ok");
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
  document.getElementById("refEditorList")?.addEventListener("click",e=>{
    const itemBtn=e.target.closest("button[data-refitemop]");
    if(itemBtn){
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
function collectCarryoverToCheckOccurrences(){return carryoverOccurrences().filter(o=>{const st=occurrenceState(o.t,o.dayId,o.cycle);return st.overdue&&!st.done&&!st.failed&&!st.ignored})}
function mobileGroupSummary(list,dayId){const stats={total:list.length,done:0,failed:0,overdue:0,warn:0,ignored:0,pending:0};for(const o of list){const st=occurrenceState(o.t,o.dayId,o.cycle||cycleYmd);if(st.done)stats.done++;if(st.failed)stats.failed++;if(st.overdue)stats.overdue++;if(st.warn)stats.warn++;if(st.ignored)stats.ignored++;if(dayId===today&&!st.done&&!st.failed&&!st.ignored)stats.pending++;}return stats}
function mobileSummaryBadges(stats){const parts=[];if(stats.failed)parts.push(`<span class="mWeekPill fail">× ${stats.failed}</span>`);if(stats.overdue+stats.warn)parts.push(`<span class="mWeekPill warn">! ${stats.overdue+stats.warn}</span>`);if(stats.pending)parts.push(`<span class="mWeekPill pending">• ${stats.pending}</span>`);return parts.join("")}

function completeCarryoverTasks(){const targets=collectCarryoverToCheckOccurrences();if(!targets.length){alert("现在没有跑到今天的过期遗留任务。");return}const names=targets.slice(0,8).map(o=>`・${o.t.title}（原定：${o.prev?"上周":""}${dayName(o.dayId)}）`).join("\n");const more=targets.length>8?`\n……等 ${targets.length} 项`:"";const msg=`危险动作：将一键勾掉 ${targets.length} 个「延后到今天的过期任务」。\n\n这只会处理：单次任务 / 多次任务的最后一次 / 上周日遗留。\n不会处理「未完成×锁定」的无法补签任务。\n\n${names}${more}\n\n确认执行？`;if(!confirm(msg))return;targets.forEach(o=>{syncSetItem(storageKey(o.t.id,o.dayId,o.cycle),true);if(hasSteps(o.t.id)){stepTasks[o.t.id].forEach(s=>setStepDoneRaw(o.t.id,s.id,o.dayId,true,o.cycle))}});renderAll()}
function setDone(taskId,dayId,val,sourceEl=null,syncSteps=true,cycle=cycleYmd){const task=blocks.find(t=>t.id===taskId);if(task&&isFailedOccurrence(task,dayId,cycle)){renderAll();return}const k=storageKey(taskId,dayId,cycle);syncSetItem(k,val);if(syncSteps&&hasSteps(taskId)){stepTasks[taskId].forEach(s=>setStepDoneRaw(taskId,s.id,dayId,val,cycle))}if(val&&sourceEl){playBurst(sourceEl,task?task.cat:"");playGlobalEffect(task?task.cat:"")}renderAll()}
function setStepDone(taskId,stepId,dayId,val,sourceEl=null,cycle=cycleYmd){const task=blocks.find(t=>t.id===taskId);if(task&&isFailedOccurrence(task,dayId,cycle)){renderAll();refreshSubtaskPopover(taskId,dayId,cycle);return}setStepDoneRaw(taskId,stepId,dayId,val,cycle);const allDone=areAllStepsDone(taskId,dayId,cycle);const parentWasDone=isDone(taskId,dayId,cycle);const k=storageKey(taskId,dayId,cycle);syncSetItem(k,allDone);if(allDone&&!parentWasDone&&sourceEl){playBurst(sourceEl,task?task.cat:"");playGlobalEffect(task?task.cat:"")}else if(val&&sourceEl){playBurst(sourceEl,task?task.cat:"")}renderAll();refreshSubtaskPopover(taskId,dayId,cycle)}
function carryoverOccurrences(){const out=[];const todayP=weekPos(today);for(const t of blocks){if(t.days.length===1){const d=t.days[0];if(weekPos(d)<todayP&&!isDone(t.id,d,cycleYmd))out.push({t,dayId:d,cycle:cycleYmd,carry:true})}else{const last=lastScheduledDay(t);if(weekPos(last)<todayP&&!isDone(t.id,last,cycleYmd))out.push({t,dayId:last,cycle:cycleYmd,carry:true})}if(t.days.includes(0)&&isLastScheduled(t,0)&&!isDone(t.id,0,prevCycleYmd)){out.push({t,dayId:0,cycle:prevCycleYmd,carry:true,prev:true})}}return out}
function todayOccurrences(includeDone=true){const carry=carryoverOccurrences();const carryMap=new Map(carry.map(o=>[o.t.id,o]));let arr=[];for(const t of blocks){if(t.days.includes(today))arr.push({t,dayId:today,cycle:cycleYmd,current:true});const c=carryMap.get(t.id);if(c)arr.push(c)}const seen=new Set();arr=arr.filter(o=>{const k=`${o.cycle}_${o.t.id}_${o.dayId}`;if(seen.has(k))return false;seen.add(k);return true});if(!includeDone)arr=arr.filter(o=>!isDone(o.t.id,o.dayId,o.cycle));return arr}
function escapeHtml(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function safeUrl(url){if(!url)return "";try{const u=new URL(url,window.location.href);if(u.protocol==="http:"||u.protocol==="https:")return u.href}catch(e){}return ""}
function refItemHtml(item){
  const title=escapeHtml(item.title);
  const url=safeUrl(item.url);
  return `<div class="refItem">${url?`<a class="refLink" href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`:`<span class="refLink refPlain">${title}</span>`}</div>`;
}
function renderReferenceLibrary(){
  const grid=document.getElementById("refGrid");
  if(!grid)return;
  const groups=(refGroups||[]).filter(g=>g.enabled!==false);
  grid.innerHTML=groups.map(g=>{
    const items=(g.items||[]).filter(i=>i.enabled!==false);
    return `<details class="refGroup" open><summary><span>${escapeHtml(g.title)}</span><span class="refGroupCaret">▾</span></summary><div class="refGroupBody">${items.length?items.map(refItemHtml).join(""):`<div class="refItem"><span class="refLink refPlain">暂未设置链接</span></div>`}</div></details>`;
  }).join("");
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
  return `<button type="button" class="subtaskBtn ${catCls||""}" title="分任务 ${prog.done}/${prog.total}" data-subtask-task="${escapeHtml(t.id)}" data-subtask-day="${dayId}" data-subtask-cycle="${escapeHtml(cycle)}"><span class="subtaskDot"></span><span>分 ${prog.done}/${prog.total}</span></button>`;
}
function visibleDaysForMode(){if(viewMode==="all")return days;return [days.find(d=>d.id===today)]}
function visibleBlocksForMode(){if(viewMode==="all")return blocks;return todayOccurrences(viewMode==="today").map(o=>o.t)}
function cellHtml(t,dayId,cycle=cycleYmd,extraClass=""){const st=occurrenceState(t,dayId,cycle);const checked=st.done?"checked":"";const disabled=st.failed?"disabled data-locked='1'":"";const cls=`${st.done?"done":""} ${st.failed?"failed":""} ${st.overdue?"overdue":""} ${st.warn?"warnMiss":""}`;const label=st.failed?"✕":dayName(dayId);return `<td class="dayCell ${extraClass} ${st.failed?"failedCell":""} ${st.overdue?"overdueCell":""} ${st.warn?"warnCell":""}"><label class="dayCheck ${cls}"><input type="checkbox" data-task="${escapeHtml(t.id)}" data-day="${dayId}" data-cycle="${cycle}" ${checked} ${disabled}><span>${label}</span></label></td>`}
function compactTaskMeta(t,st=null,meta=""){
  const bits=[];
  const tags=tagHtml(t);
  const badges=st?statusBadges(st):"";
  if(tags)bits.push(tags);
  if(badges)bits.push(badges);
  if(meta)bits.push(`<span class="compactMetaText">${meta}</span>`);
  return bits.join("")||`<span class="metaSpacer">&nbsp;</span>`;
}
function taskRowHtml(t,c,metaHtml,stepHtml="",frontCheck="",dayId=stepContextDay(t),cycle=cycleYmd){
  return `<div class="taskRowInner"><div class="taskMainLine">${frontCheck}${taskMiniRingHtml(t,dayId,cycle)}<span class="taskIcon">${escapeHtml(c.icon||"•")}</span>${titleHtml(t)}</div><div class="taskMetaLine">${stepHtml||""}${metaHtml}</div></div>`;
}
function catCellHtml(c){return `<div class="catInner">${escapeHtml(c.name)}</div>`}
function renderTable(){const table=document.getElementById("taskTable");const isAll=viewMode==="all";const vDays=visibleDaysForMode();let html=`<thead><tr><th class="catHead">区分</th><th class="taskHead">任务</th>${isAll?vDays.map(d=>`<th class="dayHead ${d.id===today?"todayHead":""}">${d.name}${d.id===today?"｜今日":""}</th>`).join(""):""}</tr></thead><tbody>`;if(isAll){for(const t of blocks){const c=cats[t.cat]||{name:t.cat,color:"#eef2f7",cls:"",icon:"•"};const ctxDay=stepContextDay(t);html+=`<tr><td class="category ${c.cls}" style="background:${c.color}">${catCellHtml(c)}</td><td class="taskName ${c.cls}Task" style="border-left:5px solid ${c.color}">${taskRowHtml(t,c,compactTaskMeta(t),stepPanelHtml(t,ctxDay,c.cls,cycleYmd),"",ctxDay,cycleYmd)}</td>`;for(const d of vDays){if(t.days.includes(d.id)){html+=cellHtml(t,d.id,cycleYmd,d.id===today?"activeTodayCell":"")}else{html+=`<td class="dayCell blank"></td>`}}html+=`</tr>`}}else{const occs=todayOccurrences(viewMode==="today");if(!occs.length){html+=`<tr><td class="category" style="background:#f4f7fb"><div class="catInner">完成</div></td><td class="taskName"><div class="taskRowInner emptyRow"><div class="taskMainLine">今天剩余任务已经清空。可以休息，或者切到「显示全周」提前推进后面的任务。</div><div class="taskMetaLine"><span class="metaSpacer">&nbsp;</span></div></div></td></tr>`}else{for(const o of occs){const t=o.t;const c=cats[t.cat]||{name:t.cat,color:"#eef2f7",cls:"",icon:"•"};const st=occurrenceState(t,o.dayId,o.cycle);const meta=occurrenceMeta(t,o.dayId,o.cycle);html+=`<tr><td class="category ${c.cls}" style="background:${c.color}">${catCellHtml(c)}</td><td class="taskName ${c.cls}Task" style="border-left:5px solid ${c.color}">${taskRowHtml(t,c,compactTaskMeta(t,st,meta),stepPanelHtml(t,o.dayId,c.cls,o.cycle),frontCheckHtml(t,o.dayId,o.cycle),o.dayId,o.cycle)}</td></tr>`}}}table.innerHTML=html+`</tbody>`}
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
    return `<div class="mTask ${dayId===today&&cycle===cycleYmd?"today":""} ${done?"done":""} ${st.ignored?"ignored":""} ${st.overdue?"overdue":""} ${st.failed?"failed":""} ${st.warn?"warnMiss":""}"><input type="checkbox" data-task="${escapeHtml(t.id)}" data-day="${dayId}" data-cycle="${cycle}" ${done?"checked":""} ${disabled}><div class="mTaskBody">${topLine}<div class="mTitle mTaskTitleLine ${c.cls}Task"><span class="taskIcon">${escapeHtml(c.icon||"•")}</span>${titleHtml(t)}</div><div class="mMeta">${stepSlot}${metaMain}</div></div></div>`;
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
      const list=blocks.filter(t=>t.days.includes(d.id)).map(t=>({t,dayId:d.id,cycle:cycleYmd}));
      return renderGroup(`${d.name}${d.id===today?"｜今日":""}`,list,"",d.id);
    }).join("");
    return;
  }
  const occs=todayOccurrences(viewMode==="today");
  box.innerHTML=occs.map(o=>renderOne(o)).join("")||`<div class="mTask emptyMobileTask"><div></div><div class="mTaskBody"><div class="mTitle">今天剩余任务已经清空</div><div class="mMeta">可以休息，或者切到「显示全周」提前推进后面的任务。</div></div></div>`;
}
function updateProgress(){const occs=todayOccurrences(true);const done=occs.filter(o=>isDone(o.t.id,o.dayId,o.cycle)).length;const total=occs.length;const pct=total?Math.round(done/total*100):0;const carry=carryoverOccurrences().length;document.getElementById("progressText").textContent=`今日完成度 ${done}/${total}（${pct}%）${carry?`｜遗留 ${carry} 项`:""}`;document.getElementById("bar").style.width=pct+"%";document.getElementById("modeText").textContent=viewMode==="today"?"今天+遗留模式":viewMode==="undone"?"今日未完成+遗留模式":"全周模式";document.getElementById("showToday").classList.toggle("active",viewMode==="today");document.getElementById("showAll").classList.toggle("active",viewMode==="all");document.getElementById("showUndone").classList.toggle("active",viewMode==="undone")}


/* === v10.9 Game Quest Board === */
let gameQuestSelectedDay=today;
let gameQuestEditorDay=today;
let gameQuestDraftConfig=null;
const GAMEQUEST_COLLAPSE_KEY=`${GH_PREFIX}gamequest_collapsed`;
function isGameQuestCollapsed(){return localStorage.getItem(GAMEQUEST_COLLAPSE_KEY)==="1"}
function setGameQuestCollapsed(v){localStorage.setItem(GAMEQUEST_COLLAPSE_KEY,v?"1":"0")}
function toggleGameQuestCollapsed(){setGameQuestCollapsed(!isGameQuestCollapsed());renderGameQuestPanel()}
function gameQuestDayKey(dayId){return String(Number(dayId))}
function gameQuestDoneKey(gameId,dayId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_gq_${gameId}_d${dayId}`}
function gameQuestItemKey(gameId,dayId,itemId,cycle=cycleYmd){return `${GH_PREFIX}${cycle}_gqi_${gameId}_d${dayId}_${itemId}`}
function enabledGameQuestGames(cfg=gameQuestConfig){return (cfg?.games||[]).filter(g=>g.enabled!==false)}
function gameQuestTasksFor(gameId,dayId,cfg=gameQuestConfig){
  const day=(cfg?.schedule||{})[gameQuestDayKey(dayId)]||{};
  return normalizeGameQuestTextList(day[gameId]);
}
function gameQuestTaskObjectsFor(gameId,dayId,cfg=gameQuestConfig){
  const used=new Set();
  return gameQuestTasksFor(gameId,dayId,cfg).map((title,idx)=>{
    let id=slugifyId(`${gameId}-${dayId}-${idx+1}-${title}`,`item-${idx+1}`);
    if(used.has(id)){
      let base=id,n=2;
      while(used.has(`${base}-${n}`))n++;
      id=`${base}-${n}`;
    }
    used.add(id);
    return {id,title};
  });
}
function isGameQuestItemDone(gameId,dayId,itemId,cycle=cycleYmd){
  return localStorage.getItem(gameQuestItemKey(gameId,dayId,itemId,cycle))==="1" || localStorage.getItem(gameQuestDoneKey(gameId,dayId,cycle))==="1";
}
function gameQuestEntryState(gameId,dayId,cfg=gameQuestConfig,cycle=cycleYmd){
  const tasks=gameQuestTaskObjectsFor(gameId,dayId,cfg);
  const done=tasks.filter(t=>isGameQuestItemDone(gameId,dayId,t.id,cycle)).length;
  return {tasks,done,total:tasks.length,cardDone:tasks.length>0&&done>=tasks.length};
}
function isGameQuestDone(gameId,dayId,cycle=cycleYmd){return gameQuestEntryState(gameId,dayId,gameQuestConfig,cycle).cardDone}
function setGameQuestItemDone(gameId,dayId,itemId,val,sourceEl=null,cycle=cycleYmd){
  syncSetItem(gameQuestItemKey(gameId,dayId,itemId,cycle),val);
  const tasks=gameQuestTaskObjectsFor(gameId,dayId,gameQuestConfig);
  const allDone=tasks.length?tasks.every(t=>t.id===itemId?val:isGameQuestItemDone(gameId,dayId,t.id,cycle)):false;
  syncSetItem(gameQuestDoneKey(gameId,dayId,cycle),allDone);
  if(val&&sourceEl){playBurst(sourceEl,"gamecreate");playGlobalEffect("gamecreate")}
  renderAll();
}
function setGameQuestDone(gameId,dayId,val,sourceEl=null,cycle=cycleYmd){
  const tasks=gameQuestTaskObjectsFor(gameId,dayId,gameQuestConfig);
  tasks.forEach(t=>syncSetItem(gameQuestItemKey(gameId,dayId,t.id,cycle),val));
  syncSetItem(gameQuestDoneKey(gameId,dayId,cycle),val&&tasks.length>0);
  if(val&&sourceEl){playBurst(sourceEl,"gamecreate");playGlobalEffect("gamecreate")}
  renderAll();
}
function gameQuestEntriesForDay(dayId,cfg=gameQuestConfig){
  return enabledGameQuestGames(cfg).map(g=>{const state=gameQuestEntryState(g.id,dayId,cfg);return {game:g,tasks:state.tasks,done:state.done,total:state.total,cardDone:state.cardDone}}).filter(e=>e.tasks.length>0);
}
function gameQuestStats(dayId){
  const entries=gameQuestEntriesForDay(dayId);
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
function gameQuestTaskListHtml(gameId,dayId,tasks){
  return `<ul class="gameQuestTaskList gameQuestTaskListV2">${tasks.map((t,idx)=>{const done=isGameQuestItemDone(gameId,dayId,t.id,cycleYmd);return `<li class="${done?"done":""}"><button type="button" class="gameQuestMiniCheckBtn gameQuestMiniCheckBtnV2 ${done?"done":""}" data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(gameId)}" data-gamequest-item-day="${dayId}" data-gamequest-item="${escapeHtml(t.id)}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span class="gameQuestTaskNo">${String(idx+1).padStart(2,"0")}</span><span class="gameQuestMiniBox" aria-hidden="true"></span><i>${escapeHtml(t.title)}</i></button></li>`}).join("")}</ul>`;
}
function gameQuestCardHtml(entry,dayId){
  const g=entry.game;
  const done=entry.cardDone;
  const pct=entry.total?Math.round(entry.done/entry.total*100):0;
  return `<article class="gameQuestCard gameQuestCardV2 accent-${escapeHtml(g.accent)} ${done?"done":""}" style="--gq-p:${pct}%">
    <div class="gameQuestCardAura" aria-hidden="true"></div>
    <div class="gameQuestCardTop">
      <button type="button" class="gameQuestCheck ${done?"done":""}" title="${escapeHtml(g.name)} 整卡完成" data-gq-card-btn="1" data-gamequest-game="${escapeHtml(g.id)}" data-gamequest-day="${dayId}" data-cycle="${escapeHtml(cycleYmd)}" aria-pressed="${done?"true":"false"}"><span></span></button>
      <span class="gameQuestIcon gameQuestIconOrb">${escapeHtml(g.icon)}</span>
      <div class="gameQuestNameWrap"><span class="gameQuestName">${escapeHtml(g.name)}</span><span class="gameQuestShort">${escapeHtml(g.short||g.name)}</span></div>
      <span class="gameQuestCount">${entry.done}/${entry.total}</span>
    </div>
    <div class="gameQuestProgressRail"><span></span></div>
    <div class="gameQuestCardBody">
      ${gameQuestTaskListHtml(g.id,dayId,entry.tasks)}
    </div>
  </article>`;
}
function renderGameQuestPanel(){
  const panel=document.getElementById("gameQuestPanel");
  if(!panel)return;
  const collapsed=isGameQuestCollapsed();
  const week=gameQuestWeekStats();
  if(collapsed){
    panel.innerHTML=`<div class="gameQuestShell collapsed"><div class="gameQuestCollapsedBar">
      <span class="gameQuestCollapsedBadge">GAME QUEST</span>
      <strong>游戏作战区</strong>
      <b>${week.done}/${week.total}</b>
      <button type="button" id="gameQuestToggleBtn">展开</button>
      <button type="button" id="gameQuestTodayBtn">今日</button>
    </div></div>`;
    return;
  }
  const selectedStats=gameQuestStats(gameQuestSelectedDay);
  const entries=gameQuestEntriesForDay(gameQuestSelectedDay);
  const cards=entries.length?entries.map(e=>gameQuestCardHtml(e,gameQuestSelectedDay)).join(""):`<div class="gameQuestEmpty"><b>这一天还没有游戏任务。</b><span>去总控里的「游戏任务编辑器」加几条，别让任务板空着。</span></div>`;
  panel.innerHTML=`<div class="gameQuestShell">
    <div class="gameQuestHeader">
      <div class="gameQuestTitleBlock">
        <div class="gameQuestKicker">GAME QUEST BOARD</div>
        <h2>游戏作战区</h2>
        <p>把刷体力、周常、深渊/危局独立出去单独管理。整体跟主任务区同调，但保留一点游戏区的战斗感。</p>
      </div>
      <div class="gameQuestHeaderSide">
        <div class="gameQuestStatus">
          <div class="gameQuestRing" style="--p:${week.pct}%"><span>${week.pct}%</span><em>WEEK</em></div>
          <div><strong>${week.done}/${week.total}</strong><span>本周游戏清理</span></div>
        </div>
        <div class="gameQuestActions">
          <button type="button" class="gameQuestSecondaryBtn gameQuestCollapseBtn" id="gameQuestToggleBtn">收起模块</button>
          <button type="button" class="gameQuestSecondaryBtn" id="gameQuestTodayBtn">回到今日</button>
        </div>
      </div>
    </div>
    <div class="gameQuestDays">${gameQuestDayTabsHtml()}</div>
    <div class="gameQuestSubHead"><span>${escapeHtml(dayName(gameQuestSelectedDay))}${gameQuestSelectedDay===today?"｜今日":""}</span><b>${selectedStats.done}/${selectedStats.total} items ｜ 大任务 ${selectedStats.cardsDone}/${selectedStats.cards}</b></div>
    <div class="gameQuestGrid">${cards}</div>
  </div>`;
}
function openGameQuestEditor(){
  closeControlCenter();
  closeGhModal();
  const modal=document.getElementById("gameQuestEditorModal");
  try{
    gameQuestDraftConfig=deepClone(gameQuestConfig||normalizeGameQuestConfig(defaultGameQuestConfig));
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
const GAMEQUEST_ICON_PRESETS=["🌊","⚡","🚂","🛰️","🌀","🎮","🗡️","✨","🔥","💎","🌙","🧊","🎲","👾","📡","🚀"];
function gameQuestIconPickerHtml(current="🎮"){
  return `<div class="gqIconPicker">${GAMEQUEST_ICON_PRESETS.map(icon=>`<button type="button" class="gqIconPick ${icon===current?"active":""}" data-gq-icon="${escapeHtml(icon)}">${escapeHtml(icon)}</button>`).join("")}</div>`;
}
function gameQuestAccentOptions(selected="cyan"){
  const options=[["cyan","青"],["amber","金"],["violet","紫"],["blue","蓝"],["rose","粉"],["gold","黄"]];
  return options.map(([value,label])=>`<option value="${value}" ${selected===value?"selected":""}>${label}</option>`).join("");
}
function createGameQuestDraftGame(){
  const idx=(gameQuestDraftConfig?.games?.length||0)+1;
  const accents=["cyan","amber","violet","blue","rose","gold"];
  return {id:`gq-${Date.now().toString(36)}-${idx}`,name:`新游戏 ${idx}`,short:`游戏 ${idx}`,icon:"🎮",accent:accents[(idx-1)%accents.length],enabled:true};
}
function addGameQuestGame(){
  collectGameQuestEditorState();
  if(!gameQuestDraftConfig)gameQuestDraftConfig=normalizeGameQuestConfig(gameQuestConfig||defaultGameQuestConfig);
  gameQuestDraftConfig.games.push(createGameQuestDraftGame());
  renderGameQuestEditor();
  gameQuestEditorLog("已新增游戏卡。先占坑，再改名，老办法很稳。🎮");
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
  renderGameQuestEditor();
  gameQuestEditorLog(`已删除：${target.name}`);
}
function collectGameQuestEditorState(){
  if(!gameQuestDraftConfig)return;
  const dayObj={};
  document.querySelectorAll("[data-gq-edit-game]").forEach(area=>{
    const id=area.dataset.gqEditGame;
    const lines=normalizeGameQuestTextList(area.value);
    if(lines.length)dayObj[id]=lines;
  });
  gameQuestDraftConfig.schedule[gameQuestDayKey(gameQuestEditorDay)]=dayObj;
  const games=[...document.querySelectorAll("[data-gq-game-row]")].map((row,idx)=>({
    id:row.dataset.gqGameRow||`gq-${idx+1}`,
    name:row.querySelector('.gqMetaName')?.value.trim()||`游戏 ${idx+1}`,
    short:row.querySelector('.gqMetaShort')?.value.trim()||row.querySelector('.gqMetaName')?.value.trim()||`游戏 ${idx+1}`,
    icon:row.querySelector('.gqMetaIcon')?.value.trim()||'🎮',
    accent:row.querySelector('.gqMetaAccent')?.value||'cyan',
    enabled:row.querySelector('.gqMetaEnabled')?.checked!==false
  }));
  if(games.length)gameQuestDraftConfig.games=games;
}
function renderGameQuestEditor(){
  const list=document.getElementById("gameQuestEditorList");
  const tabs=document.getElementById("gameQuestEditorDays");
  if(!list||!tabs)return;
  const cfg=gameQuestDraftConfig||normalizeGameQuestConfig(gameQuestConfig||defaultGameQuestConfig);
  tabs.innerHTML=days.map(d=>`<button type="button" class="gameQuestEditorDayBtn ${d.id===gameQuestEditorDay?"active":""}" data-gq-editor-day="${d.id}">${escapeHtml(d.name)}${d.id===today?"｜今日":""}</button>`).join("");
  const day=cfg.schedule[gameQuestDayKey(gameQuestEditorDay)]||{};
  const metaRows=(cfg.games||[]).map((g,idx)=>`<div class="gqMetaRow gqMetaRowV2" data-gq-game-row="${escapeHtml(g.id)}">
    <div class="gqMetaIconEditor">
      <div class="gqIconPreview" aria-hidden="true">${escapeHtml(g.icon||'🎮')}</div>
      <div class="gqIconEditorBody">
        <label>图标</label>
        <input class="gqMetaIcon" value="${escapeHtml(g.icon||'🎮')}" maxlength="4" placeholder="🎮">
        ${gameQuestIconPickerHtml(g.icon||'🎮')}
      </div>
    </div>
    <div class="gqMetaField name"><label>大任务名</label><input class="gqMetaName" value="${escapeHtml(g.name||'')}" placeholder="例如：鸣潮"></div>
    <div class="gqMetaField short"><label>简称</label><input class="gqMetaShort" value="${escapeHtml(g.short||g.name||'')}" placeholder="卡片副标题"></div>
    <div class="gqMetaField accent"><label>强调色</label><select class="gqMetaAccent">${gameQuestAccentOptions(g.accent)}</select></div>
    <label class="gqMetaEnabledWrap"><input type="checkbox" class="gqMetaEnabled" ${g.enabled!==false?'checked':''}>启用</label>
    <div class="gqMetaActions"><button type="button" class="gqMetaBtn" data-gq-move="up" data-gq-row-id="${escapeHtml(g.id)}" ${idx===0?'disabled':''}>↑</button><button type="button" class="gqMetaBtn" data-gq-move="down" data-gq-row-id="${escapeHtml(g.id)}" ${idx===cfg.games.length-1?'disabled':''}>↓</button><button type="button" class="gqMetaBtn danger" data-gq-delete="${escapeHtml(g.id)}">删除</button></div>
  </div>`).join('');
  const scheduleRows=(cfg.games||[]).filter(g=>g.enabled!==false).map(g=>{
    const value=normalizeGameQuestTextList(day[g.id]).join("\n");
    return `<div class="gameQuestEditRow gameQuestEditRowV2 accent-${escapeHtml(g.accent)}"><div class="gameQuestEditGame"><span>${escapeHtml(g.icon)}</span><b>${escapeHtml(g.name)}</b><em>${escapeHtml(g.short||g.name)}</em></div><textarea data-gq-edit-game="${escapeHtml(g.id)}" placeholder="一行一条，例如：日常体力&#10;周常清理&#10;深渊/危局检查">${escapeHtml(value)}</textarea></div>`;
  }).join("")||`<div class="gameQuestEmpty compact"><b>还没有启用中的游戏卡。</b><span>先在上面新增或启用一张卡，再回来写每天清单。</span></div>`;
  list.innerHTML=`<section class="gameQuestEditGroup gameQuestScheduleGroup"><div class="gameQuestEditHead"><b>${dayName(gameQuestEditorDay)} 清单</b><span>每张游戏卡下面的分任务，一行一条。这里才是日常编辑主战场。</span></div>${scheduleRows}</section><details class="gameQuestMetaDetails"><summary><span><b>游戏大卡设置</b><em>${(cfg.games||[]).length} 张卡｜改名、图标、排序时再打开</em></span></summary><div class="gameQuestMetaBody"><button type="button" class="gameQuestPrimaryBtn slim" id="addGameQuestCardBtn">+ 新增游戏卡</button><div class="gqMetaGrid">${metaRows}</div></div></details>`;
  gameQuestEditorLog(`正在编辑：${dayName(gameQuestEditorDay)}。清单在上方；大卡设置已折叠，必要时展开。`);
}
function switchGameQuestEditorDay(dayId){
  collectGameQuestEditorState();
  gameQuestEditorDay=Number(dayId);
  renderGameQuestEditor();
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
    gameQuestEditorLog("保存完成。旧兵法：先稳住阵地，再谈花活。🎮");
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
  document.getElementById("gameQuestEditorDays")?.addEventListener("click",e=>{const btn=e.target.closest("[data-gq-editor-day]");if(btn)switchGameQuestEditorDay(Number(btn.dataset.gqEditorDay))});
  document.getElementById("gameQuestEditorList")?.addEventListener("click",e=>{
    const addBtn=e.target.closest("#addGameQuestCardBtn");
    if(addBtn){e.preventDefault();addGameQuestGame();return}
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

const CLASSIC_CUTINS = [
  {kind:"classic",key:"life",cls:"life",title:"LUCY ORDER",sub:"大小姐式推进完成",tail:"beauty / money / life +1",particles:["✦","♥","◆","$","✧"]},
  {kind:"classic",key:"gamecreate",cls:"gamecreate",title:"VIVIAN CHEERS",sub:"甜辣应援发动",tail:"creative firepower ♡",particles:["✦","♥","◆","V","✧"]},
  {kind:"classic",key:"language",cls:"language",title:"REQUIEM INSIGHT",sub:"冷感知性同步",tail:"language circuit / focus +1",particles:["✦","◎","◇","§","✧"]}
];
const RANDOM_CUTIN_POOL = [...CLASSIC_CUTINS, ...RANDOM_CUTIN_CHARACTERS.map(c=>({kind:"image",cls:"custom",...c}))];
const RANDOM_GLOBAL_FX_POOL = ["life","gamecreate","language","stellar","crimson","tide","rose","neon","butterfly","ink"];
function pickRandomItem(arr){return arr[Math.floor(Math.random()*arr.length)]}
function playGlobalEffect(cat){
  if(!document.body)return;
  const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce)return;
  const mobile=window.innerWidth<=900;
  const fx=pickRandomItem(RANDOM_GLOBAL_FX_POOL);
  const wrap=document.createElement("div");
  wrap.className=`globalFX randomGlobalFX ${fx}`;
  document.body.appendChild(wrap);
  const spawn=(className,count,items,setup)=>{
    for(let i=0;i<count;i++){
      const el=document.createElement("span");
      el.className=className;
      if(items&&items.length)el.textContent=items[i%items.length];
      el.style.left=`${Math.random()*100}vw`;
      el.style.setProperty("--dx",`${-90+Math.random()*180}px`);
      el.style.setProperty("--spin",`${-260+Math.random()*520}deg`);
      el.style.setProperty("--angle",`${-24+Math.random()*48}deg`);
      el.style.setProperty("--c1",["#34d8ff","#7b61ff","#ff5f97","#ffe76b","#ff7b4e"][i%5]);
      el.style.setProperty("--c2",["#ff5f97","#34d8ff","#ffe76b","#7b61ff","#ffffff"][i%5]);
      el.style.animationDelay=`${Math.random()*420}ms`;
      if(setup)setup(el,i);
      wrap.appendChild(el);
    }
  };
  const n=mobile?18:34;
  if(fx==="life"){
    spawn("fxFlame",n,null,(el,i)=>{el.style.left=`${Math.round((i+0.5)*100/n)}vw`;el.style.setProperty("--rot",`${-10+Math.random()*20}deg`)});
    spawn("fxCoin",mobile?10:18,["¥","$","◆","✦"],el=>el.style.setProperty("--spin",`${-180+Math.random()*360}deg`));
  }else if(fx==="gamecreate"){
    spawn("fxPetal",mobile?18:32,["✿","❀","✦","✧","✺"],(el,i)=>{el.style.color=["#ff4dd2","#45dfff","#9b6dff","#ffdb4d"][i%4]});
    spawn("fxLightning",mobile?8:14,["⚡","✦"]);
  }else if(fx==="language"){
    spawn("fxDrop",n,null,el=>{el.style.opacity=`${0.34+Math.random()*0.20}`});
    spawn("fxMath",mobile?8:14,["∫","Σ","π","√x","E=mc²","lim","φ","dx","∞"]);
  }else if(fx==="stellar"){
    spawn("fxStarlet",mobile?24:46,["✦","✧","★","✶","✷"]);
    spawn("fxRibbon",mobile?10:18,null);
  }else if(fx==="crimson"){
    spawn("fxSlash",mobile?9:16,null,(el,i)=>{el.style.top=`${-40+Math.random()*28}px`;el.style.setProperty("--c1",i%2?"#ffffff":"#ff2848");el.style.setProperty("--c2",i%2?"#ff2848":"#111729")});
    spawn("fxRose",mobile?12:22,["◆","✦","✕","♢"]);
  }else if(fx==="tide"){
    spawn("fxBubble",mobile?16:30,null,(el)=>{const s=10+Math.random()*18;el.style.width=s+"px";el.style.height=s+"px"});
    spawn("fxRune",mobile?8:14,["∿","≈","◇","✦"]);
  }else if(fx==="rose"){
    spawn("fxRose",mobile?22:40,["✿","❀","✦","♡","✧"]);
  }else if(fx==="neon"){
    spawn("fxRibbon",mobile?18:34,null);
    spawn("fxStarlet",mobile?14:26,["✦","⚡","★","✧"]);
  }else if(fx==="butterfly"){
    spawn("fxButterfly",mobile?16:30,["🦋","✦","◇","✧"],(el,i)=>{el.style.setProperty("--c1",["#9d7cff","#6bdcff","#ff8edb"][i%3])});
  }else if(fx==="ink"){
    spawn("fxRune",mobile?18:32,["墨","◇","◎","✦","§"],(el,i)=>{el.style.setProperty("--c1",i%3?"#1b2436":"#35d8ff")});
    spawn("fxSlash",mobile?6:10,null,(el)=>{el.style.opacity=.36;el.style.setProperty("--c1","#111729");el.style.setProperty("--c2","#35d8ff")});
  }
  setTimeout(()=>wrap.remove(),5400);
}
function playBurst(anchor,cat){
  if(!anchor||!document.body)return;
  const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce)return;
  const rect=anchor.getBoundingClientRect();
  let x=rect.left+rect.width/2;
  let y=rect.top+rect.height/2;
  const mobile=window.innerWidth<=900;
  const marginX=mobile?98:210;
  const marginY=mobile?138:190;
  x=Math.max(marginX,Math.min(window.innerWidth-marginX,x));
  y=Math.max(marginY,Math.min(window.innerHeight-marginY,y));
  const makeClassicCard=(key,title,sub,tail)=>`<div class="avatarCutin ${key}"><div class="avatarHalo ${key}"></div><div class="avatarPortrait ${key}"></div><div class="avatarSpark s1">✦</div><div class="avatarSpark s2">♥</div><div class="avatarSpark s3">✧</div><div class="avatarText"><span class="line1">${title}</span><span class="line2">${sub}</span><span class="line3">${tail}</span></div></div>`;
  const makeImageCard=(cfg)=>`<div class="customCutin bg-${cfg.bg||"pink"}" style="--a1:${cfg.a1};--a2:${cfg.a2}"><div class="customFrame"></div><div class="customPortrait" style="background-image:url('${cfg.img}')"></div><div class="customSigil"></div><div class="customText"><span class="name">${cfg.name}</span><span class="sub">${cfg.sub}</span><span class="tail">${cfg.tail}</span></div></div>`;
  const cfg=pickRandomItem(RANDOM_CUTIN_POOL);
  const burst=document.createElement("div");
  burst.className=`burstFX randomCutin ${cfg.cls||cfg.key}`;
  burst.style.left=x+"px";
  burst.style.top=y+"px";
  const particles=(cfg.particles&&cfg.particles.length?cfg.particles:["✦","✧","◆","♡","★","◇"]);
  const particleHtml=particles.slice(0,7).map((p,i)=>`<span class="particle p${i+1}">${p}</span>`).join("");
  const card=cfg.kind==="classic"?makeClassicCard(cfg.key,cfg.title,cfg.sub,cfg.tail):makeImageCard(cfg);
  burst.innerHTML=`<div class="burstInner">${card}<div class="burstTitle">${cfg.title}</div><div class="burstSub">${cfg.sub}</div>${particleHtml}</div>`;
  document.body.appendChild(burst);
  setTimeout(()=>burst.remove(),580);
}

function orbitDayStats(dayId){
  const list=blocks.filter(t=>t.days.includes(dayId)).map(t=>({t,dayId,cycle:cycleYmd}));
  let done=0,failed=0,overdue=0,warn=0,ignored=0;
  for(const o of list){const st=occurrenceState(o.t,o.dayId,o.cycle);if(st.done)done++;if(st.failed)failed++;if(st.overdue)overdue++;if(st.warn)warn++;if(st.ignored)ignored++;}
  return {total:list.length,done,failed,overdue,warn,ignored,attention:failed+overdue+warn};
}
function renderOrbitPanel(){
  const el=document.getElementById("orbitPanel");
  if(!el)return;
  const occs=todayOccurrences(true);
  const total=occs.length;
  const done=occs.filter(o=>isDone(o.t.id,o.dayId,o.cycle)).length;
  const pct=total?Math.round(done/total*100):100;
  const carry=carryoverOccurrences().length;
  const nodes=days.map(d=>{const s=orbitDayStats(d.id);const p=s.total?Math.round(s.done/s.total*100):100;const cls=[d.id===today?"today":"",s.failed?"failed":"",s.attention&&!s.failed?"attention":""].join(" ");const alert=s.failed?`<span class="orbitFail">×${s.failed}</span>`:s.attention?`<span class="orbitWarn">!${s.attention}</span>`:`<span>${s.done}/${s.total}</span>`;return `<div class="orbitDay ${cls}" title="${escapeHtml(d.name)}：${s.done}/${s.total} 完成${s.attention?`，注意 ${s.attention}`:""}"><div class="orbitDayName">${escapeHtml(d.name)}${d.id===today?"｜今日":""}</div><div class="orbitDayMeta"><span>${s.done}/${s.total}</span>${alert}</div><div class="orbitMeter" style="--w:${p}%"><span></span></div></div>`}).join("");
  el.innerHTML=`<div class="orbitLayout"><div class="orbitCore" style="--pct:${pct}%"><div class="orbitCenter"><span class="orbitPct">${pct}%</span><span class="orbitLabel">TODAY</span><span class="orbitTiny">${done}/${total}${carry?` · 遗留${carry}`:""}</span></div></div><div class="orbitSide"><div class="orbitTop"><div><div class="orbitTitle">Task Ring</div><div class="orbitSub">按日推进，异常高亮。</div></div></div><div class="orbitDays">${nodes}</div></div></div>`;
}

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
function expandAllRefGroups(){const box=document.getElementById("refBox");if(box)box.open=true;document.querySelectorAll(".refGroup").forEach(g=>g.open=true)}
function renderAll(){renderGameQuestPanel();renderTable();renderMobileTabs();renderMobileCards();renderReferenceLibrary();renderOrbitPanel();updateProgress()}
function closeEditorsByBackdrop(target){
  if(target.id==="taskEditorModal")closeTaskEditor();
  if(target.id==="refEditorModal")closeRefEditor();
  if(target.id==="gameQuestEditorModal")closeGameQuestEditor();
  if(target.id==="ghModal")closeGhModal();
}
document.body.addEventListener("click",e=>{const controlGameEditor=e.target.closest("#controlGameQuestEditorBtn");if(controlGameEditor){e.preventDefault();e.stopPropagation();openGameQuestEditor();return}const controlTaskEditor=e.target.closest("#controlTaskEditorBtn");if(controlTaskEditor){e.preventDefault();e.stopPropagation();openTaskEditor();return}const controlRefEditor=e.target.closest("#controlRefEditorBtn");if(controlRefEditor){e.preventDefault();e.stopPropagation();openRefEditor();return}const gqItemBtn=e.target.closest("[data-gq-item-btn]");if(gqItemBtn){e.preventDefault();e.stopPropagation();closeSubtaskPopover();const cyc=gqItemBtn.dataset.cycle||cycleYmd;const next=gqItemBtn.getAttribute("aria-pressed")!=="true";setGameQuestItemDone(gqItemBtn.dataset.gamequestItemGame,Number(gqItemBtn.dataset.gamequestItemDay),gqItemBtn.dataset.gamequestItem,next,gqItemBtn,cyc);return}const gqCardBtn=e.target.closest("[data-gq-card-btn]");if(gqCardBtn){e.preventDefault();e.stopPropagation();closeSubtaskPopover();const cyc=gqCardBtn.dataset.cycle||cycleYmd;const next=gqCardBtn.getAttribute("aria-pressed")!=="true";setGameQuestDone(gqCardBtn.dataset.gamequestGame,Number(gqCardBtn.dataset.gamequestDay),next,gqCardBtn,cyc);return}if(e.target.closest("#controlCenterBtn")||e.target.closest("#controlCenterMenu")){}else closeControlCenter();const gqDay=e.target.closest("[data-gamequest-day-select]");if(gqDay){e.preventDefault();gameQuestSelectedDay=Number(gqDay.dataset.gamequestDaySelect);renderAll();return}const gqToggle=e.target.closest("#gameQuestToggleBtn");if(gqToggle){e.preventDefault();toggleGameQuestCollapsed();return}const gqToday=e.target.closest("#gameQuestTodayBtn");if(gqToday){e.preventDefault();gameQuestSelectedDay=today;renderAll();return}const refBtn=e.target.closest("#refExpandAllBtn");if(refBtn){e.preventDefault();e.stopPropagation();expandAllRefGroups();return}const btn=e.target.closest(".subtaskBtn");if(btn){e.preventDefault();e.stopPropagation();openSubtaskPopover(btn);return}if(e.target.closest(".stepPopoverClose")){e.preventDefault();closeSubtaskPopover();return}if(["taskEditorModal","refEditorModal","gameQuestEditorModal","ghModal"].includes(e.target.id)){closeEditorsByBackdrop(e.target);return}if(!e.target.closest("#subtaskPopover"))closeSubtaskPopover();});document.body.addEventListener("change",e=>{const cb=e.target;if(!cb||!cb.matches('input[type="checkbox"]'))return;if(cb.dataset.locked==="1"||cb.disabled){e.preventDefault();renderAll();return}const cyc=cb.dataset.cycle||cycleYmd;if(cb.matches("[data-gamequest-item-game][data-gamequest-item-day][data-gamequest-item]")){setGameQuestItemDone(cb.dataset.gamequestItemGame,Number(cb.dataset.gamequestItemDay),cb.dataset.gamequestItem,cb.checked,cb,cyc);return}if(cb.matches("[data-gamequest-game][data-gamequest-day]")){setGameQuestDone(cb.dataset.gamequestGame,Number(cb.dataset.gamequestDay),cb.checked,cb,cyc);return}if(cb.matches("[data-parent][data-step][data-day]")){setStepDone(cb.dataset.parent,cb.dataset.step,Number(cb.dataset.day),cb.checked,cb,cyc);return}if(cb.matches("[data-task][data-day]")){setDone(cb.dataset.task,Number(cb.dataset.day),cb.checked,cb,true,cyc)}});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!document.getElementById("gameQuestEditorModal")?.classList.contains("hidden"))closeGameQuestEditor();else if(!document.getElementById("taskEditorModal")?.classList.contains("hidden"))closeTaskEditor();else if(!document.getElementById("refEditorModal")?.classList.contains("hidden"))closeRefEditor();else if(!document.getElementById("ghModal")?.classList.contains("hidden"))closeGhModal();else closeSubtaskPopover();});
function resetCurrentWeek(){if(!confirm("确认重置本周全部勾选？"))return;syncRemoveCycle(cycleYmd);renderAll()}document.getElementById("todayLabel").textContent=`今天：${dayName(today)}`;document.getElementById("cycleLabel").textContent=`周期：${ymd(cycleStart)} 04:00 ～ ${ymd(cycleEnd)} 04:00`;document.getElementById("showToday").addEventListener("click",()=>{viewMode="today";mobileDay=today;renderAll()});document.getElementById("showAll").addEventListener("click",()=>{viewMode="all";renderAll()});document.getElementById("showUndone").addEventListener("click",()=>{viewMode="undone";mobileDay=today;renderAll()});document.getElementById("resetCurrentWeek").addEventListener("click",resetCurrentWeek);document.getElementById("clearExpired")?.addEventListener("click",completeCarryoverTasks);renderAll();initGithubSyncUI();initTaskEditorUI();initRefEditorUI();initGameQuestUI();setInterval(()=>{const refreshedRealNow=new Date();const refreshedOperationalNow=getOperationalDate(refreshedRealNow);const refreshedCycleStart=getCycleStart(refreshedRealNow);const dayChanged=refreshedOperationalNow.getDay()!==today;const cycleChanged=ymd(refreshedCycleStart)!==ymd(cycleStart);if(dayChanged||cycleChanged){location.reload()}},60*1000);
