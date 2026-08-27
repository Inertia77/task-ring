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
  const baseGhPatchConfig=ghPatchConfig;
  let pushQueued=false;
  let activePushPromise=null;

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
  // legacy normalizer runs, then removed before config reaches memory/storage/Gist.
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

  function hasLegacyTaskCategory(config){
    return Array.isArray(config?.tasks)&&config.tasks.some(task=>task&&Object.prototype.hasOwnProperty.call(task,"cat"));
  }
  ghParseConfig=async function(gist){
    const file=gist.files&&gist.files[CONFIG_FILE];
    if(!file||!file.content)return {config:null,mode:"missing",legacyCategory:false};
    try{
      const raw=JSON.parse(file.content);
      if(raw&&raw.encrypted===true){
        const decrypted=await decryptConfigObject(raw);
        return {config:normalizeTaskConfig(decrypted),mode:"encrypted",legacyCategory:hasLegacyTaskCategory(decrypted)};
      }
      return {config:normalizeTaskConfig(raw),mode:"plaintext",legacyCategory:hasLegacyTaskCategory(raw)};
    }catch(e){
      ghLog("任务配置读取失败，已使用内置默认配置："+e.message);
      return {config:null,mode:"error",legacyCategory:false,error:e};
    }
  };

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
  function markState(key,value,updatedAt=nowIso()){
    if(!String(key).startsWith(GH_PREFIX))return;
    const meta=readStateMeta();
    meta[key]={value:value?"1":"0",updatedAt,deviceId:deviceId()};
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
      return `${key}|${states?.[key]==="1"?"1":"0"}|${record.value||""}|${record.updatedAt||record.updated_at||""}|${record.deviceId||record.device_id||""}`;
    }).join("\n");
  }

  const baseScheduleGhSave=scheduleGhSave;
  syncSetItem=function(key,value){
    if(value)localStorage.setItem(key,"1");else localStorage.removeItem(key);
    markState(key,!!value);
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
  scheduleGhSave=function(){
    if(!ghToken()){setGhStatus(LOCAL_PREVIEW_UNLOCK?"GitHub：本地预览":"GitHub：未设置","off");return}
    setGhStatus("GitHub：等待保存","sync");
    clearTimeout(ghSaveTimer);
    ghSaveTimer=setTimeout(()=>ghPush(true),900);
  };
  void baseScheduleGhSave; // kept only so older debug tooling can see that the function was intentionally replaced.

  async function patchConfigSafely(config,{interactive=false,preloadedGist=null}={}){
    const candidate={...normalizeTaskConfig(config),updatedAt:nowIso()};
    const gist=preloadedGist||await ghFetchGist();
    const remoteResult=await ghParseConfig(gist);
    const remote=remoteResult.config;
    const baseFingerprint=configBaseFingerprint();
    const decision=Core.decideConfig({local:candidate,remote,baseFingerprint});
    if(decision.source==="conflict"){
      rememberConflict(candidate,remote,gist,decision.reason);
      const message="云端配置在本机编辑期间也发生了变化。为防止覆盖，TaskRing 已保留本机并记录云端冲突副本。";
      if(!interactive||!confirm(`${message}\n\n继续保存会用当前本机配置覆盖云端。确认继续？`))throw new Error(message);
    }
    const updated=await baseGhPatchConfig(candidate);
    baseSaveLocalTaskConfig(candidate,"云端写入后统一本机时间戳");
    recordConfigBaseline(candidate,updated);
    return updated;
  }

  ghPatchConfig=async function(config){return patchConfigSafely(config,{interactive:true})};

  ghPush=async function(silent=false){
    if(!ghToken()){setGhStatus("GitHub：未设置","off");if(!silent)openGhModal();return}
    if(ghSaving){pushQueued=true;return activePushPromise}
    ghSaving=true;
    activePushPromise=(async()=>{
      try{
        setGhStatus("GitHub：安全合并中","sync");
        migrateLegacyLocalStates();
        const gist=await ghFetchGist();
        const remoteState=ghParseState(gist);
        const merged=mergeWithRemoteState(remoteState);
        applyMergedState(merged);
        mergeGhTimeLogDeletes(remoteState.time_logs_deleted||remoteState.deleted_time_logs||{});
        mergeGhTimeLogs(remoteState.time_logs||[]);
        const deletedLogs=collectGhDeletedTimeLogs();
        const data={
          version:4,
          privacy:"coded-state-keys + timestamped-state-meta + tombstones + time-logs + weekly-plan",
          updatedAt:nowIso(),
          states:merged.states,
          state_meta:merged.stateMeta,
          time_logs:collectGhTimeLogs(),
          time_logs_deleted:deletedLogs,
          time_logs_meta:{limit:TIME_GH_LOG_LIMIT,deleted_limit:TIME_GH_DELETED_LIMIT,active_timer:"local-only"}
        };
        const updated=await ghPatchState(data);
        const rev=gistRevision(updated);if(rev)localStorage.setItem(CLOUD_REV_KEY,rev);
        if(hasConfigConflict())setGhStatus("GitHub：配置冲突","err");else setGhStatus("GitHub：已同步","on");
        ghLog(`安全保存成功：${Object.keys(data.states).length} 项完成状态；${Object.keys(data.state_meta).length} 项状态元数据；时间记录 ${data.time_logs.length} 条`);
        unlockApp();renderAll();
      }catch(err){
        console.error(err);setGhStatus("GitHub：保存失败","err");ghLog(String(err.message||err));
        if(!silent)showToast("GitHub 安全同步失败；本机数据已保留","warn",3000);
      }finally{
        ghSaving=false;
        if(pushQueued){pushQueued=false;setTimeout(()=>ghPush(true),0)}
      }
    })();
    return activePushPromise;
  };

  ghPull=async function(){
    if(!ghToken()){
      enterLocalMode(true,LOCAL_PREVIEW_UNLOCK?"本地预览模式：未连接云端，只使用内置/本机缓存数据。":"未设置 Gist Token，当前使用本机/内置数据；需要跨设备同步时请填写 Token。");
      return;
    }
    try{
      unlockApp();setGhStatus("GitHub：安全读取中","sync");migrateLegacyLocalStates();
      const gist=await ghFetchGist();
      const cfgResult=await ghParseConfig(gist);
      const localCfg=loadLocalTaskConfig();
      const baseFingerprint=configBaseFingerprint();
      const decision=Core.decideConfig({local:localCfg,remote:cfgResult.config,baseFingerprint});
      let configToUse=localCfg||cfgResult.config||buildDefaultConfig();
      let pushLocalConfig=false;
      let configConflict=false;

      if(decision.source==="remote"){
        configToUse=cfgResult.config;
        if(configToUse)baseSaveLocalTaskConfig(configToUse,"安全同步：接受更新的云端配置");
        if(configToUse)recordConfigBaseline(configToUse,gist);
        ghLog("配置判定：云端有新修改，本机未修改，已安全采用云端配置。");
      }else if(decision.source==="local"){
        configToUse=localCfg;
        pushLocalConfig=!!localCfg;
        ghLog("配置判定：本机有未同步修改，云端没有对应新修改；保留本机并准备上传。");
      }else if(decision.source==="same"){
        configToUse=localCfg||cfgResult.config;
        if(!localCfg&&configToUse)baseSaveLocalTaskConfig(configToUse,"首次同步：保存云端配置到本机");
        if(configToUse)recordConfigBaseline(configToUse,gist);
      }else if(decision.source==="conflict"){
        configConflict=true;
        configToUse=localCfg||cfgResult.config||buildDefaultConfig();
        rememberConflict(localCfg,cfgResult.config,gist,decision.reason);
        ghLog("检测到配置冲突：本机和云端都从上次共同版本发生过修改。已保留本机，云端没有被覆盖。");
        showToast("检测到本机/云端配置冲突：已保留本机，不会静默覆盖","warn",4200);
      }

      applyTaskConfig(configToUse,false);
      if((cfgResult.mode==="plaintext"||cfgResult.legacyCategory)&&!configConflict&&!pushLocalConfig&&cfgResult.config){
        if(cfgResult.legacyCategory)ghLog("检测到旧三分类字段，正在迁移为唯一分类字段并安全写回云端…");
        else ghLog("检测到旧版明文配置，正在安全迁移为加密配置…");
        await patchConfigSafely(cfgResult.config,{interactive:false,preloadedGist:gist});
      }

      const remoteState=ghParseState(gist);
      const remoteStates=normalizeRemoteStates(remoteState.states||{});
      const remoteMeta=normalizeRemoteMeta(remoteState.state_meta||remoteState.stateMeta||{});
      const beforeSignature=stateSignature(remoteStates,remoteMeta);
      const merged=mergeWithRemoteState(remoteState);
      applyMergedState(merged);
      // 完成状态到齐后再检查一次，换设备时也能识别任务 code 的历史继承问题。
      applyTaskConfig(taskConfig,false);
      const deletedResult=mergeGhTimeLogDeletes(remoteState.time_logs_deleted||remoteState.deleted_time_logs||{});
      const timeResult=mergeGhTimeLogs(remoteState.time_logs||[]);
      const afterSignature=stateSignature(merged.states,merged.stateMeta);

      if(pushLocalConfig&&!configConflict){
        await patchConfigSafely(configToUse,{interactive:false,preloadedGist:gist});
      }

      const stateNeedsPush=beforeSignature!==afterSignature||timeResult.changed||deletedResult.changed||!remoteState.state_meta;
      if(stateNeedsPush)await ghPush(true);

      if(configConflict)setGhStatus("GitHub：配置冲突","err");else setGhStatus("GitHub：已同步","on");
      ghLog(`安全读取完成：状态 ${Object.keys(merged.states).length} 项；状态迁移 ${merged.stats.migrated} 项；时间记录 ${timeResult.count} 条${deletedResult.count?`；删除记录 ${deletedResult.count} 条`:""}`);
      unlockApp();renderAll();
    }catch(err){
      console.error(err);setGhStatus("GitHub：读取失败","err");ghLog(String(err.message||err));
      enterLocalMode(false,"Gist 安全同步失败，已继续使用本机/内置数据；不会用失败或旧云端清空本机数据。");
      showToast("Gist 同步失败；本机数据已保留","warn",3000);
    }
  };

  migrateStoredTimeCategories();
  try{
    const local=loadLocalTaskConfig();
    if(local)applyTaskConfig(local,false);else if(taskConfig)applyTaskConfig(taskConfig,false);
  }catch(err){console.warn("integrity startup normalization skipped",err)}

  window.TaskRingIntegrity={
    version:"1.1.0",
    categorySchema:"time_category-only",
    core:Core,
    stateMetaKey:STATE_META_KEY,
    configConflictKey:CONFIG_CONFLICT_KEY,
    hasConfigConflict
  };
})();