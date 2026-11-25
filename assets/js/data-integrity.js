// TaskRing sync/data-integrity hardening. Loaded after app.js and before UI boot.
(function(){
  "use strict";

  const Core=window.TaskRingIntegrityCore;
  if(!Core){console.error("TaskRingIntegrityCore missing");return}

  const STATE_META_KEY="taskring_sync_state_meta_v1";
  const DEVICE_ID_KEY="taskring_sync_device_id_v1";
  const CONFIG_BASE_FP_KEY="taskring_sync_config_base_fp_v1";
  const CLOUD_REV_KEY="taskring_sync_cloud_revision_v1";
  const CONFIG_CONFLICT_KEY="taskring_sync_config_conflict_v1";
  const VALID_TIME_CATEGORIES=new Set(timeCategoryOrder);
  const baseNormalizeTimeCategory=normalizeTimeCategory;
  const baseInferTaskTimeCategory=inferTaskTimeCategory;
  const baseNormalizeTaskConfig=normalizeTaskConfig;
  const baseApplyTaskConfig=applyTaskConfig;
  const baseSaveLocalTaskConfig=saveLocalTaskConfig;

  function nowIso(){return new Date().toISOString()}
  function readJson(key,fallback={}){
    try{const parsed=JSON.parse(localStorage.getItem(key)||"");return parsed&&typeof parsed==="object"?parsed:fallback}catch(_){return fallback}
  }
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function deviceId(){
    let value=localStorage.getItem(DEVICE_ID_KEY)||"";
    if(!value){
      value=`dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
      localStorage.setItem(DEVICE_ID_KEY,value);
    }
    return value;
  }
  function gistRevision(gist){return String(gist?.history?.[0]?.version||gist?.updated_at||gist?.updatedAt||"")}
  function configBaseFingerprint(){return localStorage.getItem(CONFIG_BASE_FP_KEY)||""}
  function recordConfigBaseline(config,gist){
    if(config)localStorage.setItem(CONFIG_BASE_FP_KEY,Core.configFingerprint(config));
    const rev=gistRevision(gist);if(rev)localStorage.setItem(CLOUD_REV_KEY,rev);
    localStorage.removeItem(CONFIG_CONFLICT_KEY);
  }
  function rememberConflict(localConfig,remoteConfig,gist,reason){
    const payload={
      detectedAt:nowIso(),reason:String(reason||"both-changed"),revision:gistRevision(gist),
      localFingerprint:Core.configFingerprint(localConfig),remoteFingerprint:Core.configFingerprint(remoteConfig),
      remoteConfig
    };
    try{writeJson(CONFIG_CONFLICT_KEY,payload)}catch(err){console.warn("sync conflict snapshot failed",err)}
    try{if(remoteConfig)pushLocalConfigBackup(remoteConfig,"云同步冲突：保留云端副本")}catch(err){console.warn("sync conflict backup failed",err)}
  }
  function hasConfigConflict(){return !!localStorage.getItem(CONFIG_CONFLICT_KEY)}

  // Legacy aliases are accepted forever so old local exports/configs do not silently fall back to `life`.
  normalizeTimeCategory=function(value,fallback="life"){
    const canonical=Core.canonicalTimeCategory(value,VALID_TIME_CATEGORIES,"");
    return canonical||baseNormalizeTimeCategory(value,fallback);
  };
  inferTaskTimeCategory=function(raw={}){
    const explicit=raw.time_category||raw.timeCategory;
    if(explicit){
      const canonical=Core.canonicalTimeCategory(explicit,VALID_TIME_CATEGORIES,"");
      if(canonical)return canonical;
      const copy={...raw};delete copy.time_category;delete copy.timeCategory;
      return baseInferTaskTimeCategory(copy);
    }
    return baseInferTaskTimeCategory(raw);
  };

  // v21: `time_category` is the only persisted task classification.
  // The old three-way `cat` value is generated only as a temporary adapter while the
  // legacy normalizer runs, then removed before config reaches memory/storage/Supabase.
  function legacyCatForCategory(category){
    const key=normalizeTimeCategory(category,"life");
    if(key==="game"||key==="creator")return "gamecreate";
    if(key==="language"||key==="it_ai"||key==="science")return "language";
    return "life";
  }
  function prepareLegacyNormalizerInput(config){
    if(!config||!Array.isArray(config.tasks))return config;
    return {...config,tasks:config.tasks.map(task=>{
      const category=inferTaskTimeCategory(task||{});
      return {...task,cat:legacyCatForCategory(category),time_category:category};
    })};
  }
  function stripLegacyTaskCategory(config){
    if(!config||!Array.isArray(config.tasks))return config;
    return {...config,tasks:config.tasks.map(task=>{
      const clean={...task,time_category:inferTaskTimeCategory(task||{})};
      delete clean.cat;
      delete clean.timeCategory;
      return clean;
    })};
  }
  normalizeTaskConfig=function(config){
    return stripLegacyTaskCategory(baseNormalizeTaskConfig(prepareLegacyNormalizerInput(config)));
  };
  applyTaskConfig=function(config,shouldRender=false){
    baseApplyTaskConfig(normalizeTaskConfig(config),false);
    // Existing daily/mobile renderers still read `t.cat`; keep a runtime-only alias that
    // points to the canonical rich category. It is never written back to taskConfig.
    blocks.forEach(task=>{task.cat=taskTimeCategory(task)});
    if(shouldRender&&typeof renderAll==="function")renderAll();
  };

  function installUnifiedCategoryPresentation(){
    if(typeof cats==="undefined"||typeof mobileCatNames==="undefined")return;
    const visualGroups={
      game:{color:"var(--gamecreate)",cls:"gamecreate"},
      creator:{color:"var(--gamecreate)",cls:"gamecreate"},
      language:{color:"var(--language)",cls:"language"},
      it_ai:{color:"var(--language)",cls:"language"},
      science:{color:"var(--language)",cls:"language"},
      body:{color:"var(--life)",cls:"life"},
      economy:{color:"var(--life)",cls:"life"},
      life:{color:"var(--life)",cls:"life"}
    };
    Object.keys(cats).forEach(key=>delete cats[key]);
    Object.keys(mobileCatNames).forEach(key=>delete mobileCatNames[key]);
    timeCategoryOrder.forEach(key=>{
      const visual=visualGroups[key]||visualGroups.life;
      const entry={color:visual.color,cls:visual.cls};
      Object.defineProperty(entry,"name",{enumerable:true,get:()=>timeCategoryDefs[key]?.name||key});
      Object.defineProperty(entry,"icon",{enumerable:true,get:()=>timeCategoryDefs[key]?.icon||"•"});
      cats[key]=entry;
      Object.defineProperty(mobileCatNames,key,{configurable:true,enumerable:true,get:()=>timeCategoryDefs[key]?.short||timeCategoryDefs[key]?.name||key});
    });
  }
  installUnifiedCategoryPresentation();

  function migrateStoredTimeCategories(){
    try{
      const raw=localStorage.getItem(TASK_CONFIG_LOCAL_KEY);if(!raw)return false;
      const config=JSON.parse(raw);if(!Array.isArray(config?.tasks))return false;
      let changed=false;
      config.tasks.forEach(task=>{
        const category=inferTaskTimeCategory(task||{});
        if(task.time_category!==category){task.time_category=category;changed=true}
        if(Object.prototype.hasOwnProperty.call(task,"timeCategory")){delete task.timeCategory;changed=true}
        if(Object.prototype.hasOwnProperty.call(task,"cat")){delete task.cat;changed=true}
      });
      if(changed)localStorage.setItem(TASK_CONFIG_LOCAL_KEY,JSON.stringify(config));
      return changed;
    }catch(err){console.warn("task category migration failed",err);return false}
  }

  // If a caller changes config content but forgets to touch updatedAt, repair the timestamp before saving.
  saveLocalTaskConfig=function(config,reason="覆盖本机配置前自动备份"){
    let candidate=normalizeTaskConfig(config);
    try{
      const current=loadLocalTaskConfig();
      if(current&&Core.configFingerprint(current)!==Core.configFingerprint(candidate)
        &&Core.isoMillis(candidate.updatedAt)<=Core.isoMillis(current.updatedAt)){
        candidate={...candidate,updatedAt:nowIso()};
      }
    }catch(err){console.warn("config timestamp touch skipped",err)}
    return baseSaveLocalTaskConfig(candidate,reason);
  };

  function readStateMeta(){
    const raw=readJson(STATE_META_KEY,{});
    const out={};
    Object.keys(raw).forEach(key=>{if(key.startsWith(GH_PREFIX)&&raw[key]&&typeof raw[key]==="object")out[key]=raw[key]});
    return out;
  }
  function writeStateMeta(meta){writeJson(STATE_META_KEY,meta)}
  function markState(key,value,sequence){
    if(!String(key).startsWith(GH_PREFIX))return;
    const meta=readStateMeta();
    const previous=meta[key];
    const updatedAt=new Date(Math.max(Date.now(),Core.isoMillis(previous?.updatedAt)+1)).toISOString();
    meta[key]={value:value?"1":"0",updatedAt,deviceId:deviceId(),...((sequence||previous?.sequence)?{sequence:sequence||previous.sequence}:{})};
    writeStateMeta(meta);
  }
  function normalizeRemoteStates(states){
    const out={};
    Object.keys(states||{}).forEach(key=>{
      if(states[key]!=="1")return;
      if(key.startsWith(GH_PREFIX)){out[key]="1";return}
      const migrated=migrateLegacyKey(key);if(migrated)out[migrated]="1";
    });
    return out;
  }
  function normalizeRemoteMeta(meta){
    const out={};
    Object.keys(meta||{}).forEach(key=>{
      const target=key.startsWith(GH_PREFIX)?key:migrateLegacyKey(key);
      if(target&&meta[key]&&typeof meta[key]==="object")out[target]=meta[key];
    });
    return out;
  }
  function localStateSnapshot(){return collectGhLocalStates()}
  function mergeWithRemoteState(state){
    return Core.mergeStateRecords({
      localStates:localStateSnapshot(),localMeta:readStateMeta(),
      remoteStates:normalizeRemoteStates(state?.states||{}),remoteMeta:normalizeRemoteMeta(state?.state_meta||state?.stateMeta||{}),
      migrationTime:nowIso(),deviceId:deviceId()
    });
  }
  function applyMergedState(merged){
    const previousMeta=readStateMeta();
    const keys=new Set([...Object.keys(previousMeta),...Object.keys(localStateSnapshot()),...Object.keys(merged.stateMeta||{})]);
    keys.forEach(key=>{
      const record=merged.stateMeta?.[key];
      if(!record)return;
      if(record.value==="1")localStorage.setItem(key,"1");else localStorage.removeItem(key);
    });
    writeStateMeta(merged.stateMeta||{});
  }
  function stateSignature(states,meta){
    const keys=new Set([...Object.keys(states||{}),...Object.keys(meta||{})]);
    return [...keys].sort().map(key=>{
      const record=meta?.[key]||{};
      return `${key}|${states?.[key]==="1"?"1":"0"}|${record.value||""}|${record.updatedAt||record.updated_at||""}|${record.deviceId||record.device_id||""}|${JSON.stringify(record.sequence||null)}`;
    }).join("\n");
  }

  const baseScheduleGhSave=scheduleGhSave;
  syncSetItem=function(key,value,sequence){
    if(value)localStorage.setItem(key,"1");else localStorage.removeItem(key);
    markState(key,!!value,sequence);
    scheduleGhSave();
  };
  syncRemoveCycle=function(cycle=cycleYmd){
    const prefix=`${GH_PREFIX}${cycle}_`;
    const meta=readStateMeta();
    const keys=new Set(Object.keys(meta).filter(key=>key.startsWith(prefix)));
    Object.keys(localStorage).forEach(key=>{if(key.startsWith(prefix))keys.add(key)});
    const stamp=nowIso();
    keys.forEach(key=>{localStorage.removeItem(key);meta[key]={value:"0",updatedAt:stamp,deviceId:deviceId()}});
    writeStateMeta(meta);
    scheduleGhSave();
  };
  // Workspace transport installs the only online synchronization handlers.
  // Do not fall back to the migration source when the new module is unavailable.
  scheduleGhSave=function(){setGhStatus("Supabase：本机缓存","off")};
  void baseScheduleGhSave;
  migrateStoredTimeCategories();
  try{
    const local=loadLocalTaskConfig();
    if(local)applyTaskConfig(local,false);else if(taskConfig)applyTaskConfig(taskConfig,false);
  }catch(err){console.warn("integrity startup normalization skipped",err)}

  window.TaskRingIntegrity={
    version:"1.4.0",
    categorySchema:"time_category-only",
    core:Core,
    stateMetaKey:STATE_META_KEY,
    configConflictKey:CONFIG_CONFLICT_KEY,
    hasConfigConflict,
    readStateMeta,
    workspaceBridge:{mergeWithRemoteState,applyMergedState,stateSignature,deviceId,recordConfigBaseline,configBaseFingerprint,rememberConflict},
    patchConfig:async()=>{throw new Error("Supabase 工作区同步尚未初始化")},
    importState(snapshot){applyMergedState(mergeWithRemoteState(snapshot));renderAll()}
  };
})();