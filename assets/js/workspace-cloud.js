// Supabase is the sole writable workspace backend. Legacy Gist is read once for
// verified cutover, never patched. Existing completion keys stay unchanged.
(function(){
  "use strict";
  const cloud=window.TaskRingGameOpsCloud,I=window.TaskRingIntegrity,B=I.workspaceBridge,Core=I.core;
  const OWNER="taskring_workspace_owner_v1",BASE="taskring_workspace_config_base_v1",SYNC_CURSOR="taskring_execution_cursor_v2";
  const legacyFetch=ghFetchGist,legacyParse=ghParseConfig,legacyState=ghParseState;
  const saveLocal=saveLocalTaskConfig,oldStatus=setGhStatus;
  let workspace=null,gameCatalog=null,owner="",queue=Promise.resolve(),stateTimer,configTimer,applying=false,initializing=false,attemptedOwner="";
  const session=()=>cloud.workspaceSession();
  const copy=v=>JSON.parse(JSON.stringify(v));
  const fp=Core.configFingerprint;
  const rpc=(name,args)=>cloud.workspaceRpc(name,args);
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const message=e=>String(e?.message||e);
  function status(label,kind="sync"){setGhStatus("Supabase："+label,kind);}
  setGhStatus=(label,kind="")=>oldStatus(String(label).replace(/^GitHub：?/,"Supabase：").replace(/^Supabase：/,""),kind);
  function trustedAccount(){
    const uid=session().uid,bound=localStorage.getItem(OWNER);
    if(!uid)throw Error("请先登录 Supabase");
    if(bound&&bound!==uid)throw Error("本机已有其他账号的任务缓存。请使用原账号；不会跨账号上传数据。");
    return uid;
  }
  function accept(row,uid){
    if(!row||session().uid!==uid)throw Error("Supabase 工作区读取失败或账号已变化");
    owner=uid;workspace=row;
  }
  function bind(uid){localStorage.setItem(OWNER,uid);}
  function baseline(){return localStorage.getItem(BASE)||"";}
  function recordBase(c){localStorage.setItem(BASE,fp(c));localStorage.removeItem(I.configConflictKey);}
  function canonicalConfig(c){
    const raw=copy(c);delete raw.cloudGameConfig;
    const out=normalizeTaskConfig(raw);
    if(out.gameQuest){
      // Never create a second authoritative game routine catalog.
      out.gameQuest.boards={...out.gameQuest.boards,daily:{},weekly:{}};
      for(const g of out.gameQuest.games||[]){out.gameQuest.boards.daily[g.id]=[];out.gameQuest.boards.weekly[g.id]=[];}
      delete out.gameQuest.routineRevision;
    }
    return out;
  }
  function localConfig(){const c=loadLocalTaskConfig();return c?canonicalConfig(c):null;}
  function applyConfig(c,reason){
    applying=true;
    try{const current=loadLocalTaskConfig();if(!current||fp(current)!==fp(c))saveLocal(c,reason);applyTaskConfig(c,false);}
    finally{applying=false;}
  }
  function snapshot(remote={}){
    const m=B.mergeWithRemoteState(remote);
    const rawDeleted=remote.time_logs_deleted||remote.deleted_time_logs||{};
    const deleted=Array.isArray(rawDeleted)?Object.fromEntries(rawDeleted.map(id=>[id,new Date(0).toISOString()])):{...rawDeleted};
    for(const [id,ts] of Object.entries(readDeletedTimeLogMap()))if(!deleted[id]||String(ts)>String(deleted[id]))deleted[id]=ts;
    const logs=new Map();
    for(const raw of [...(remote.time_logs||[]),...readTimeLogs()]){
      if(!raw?.id||deleted[raw.id])continue;
      const prior=logs.get(raw.id);
      if(!prior||String(raw.ended_at||"")>=String(prior.ended_at||""))logs.set(raw.id,raw);
    }
    return {version:4,states:m.states,state_meta:m.stateMeta,time_logs:[...logs.values()].sort((a,b)=>String(a.ended_at||"").localeCompare(String(b.ended_at||""))),time_logs_deleted:deleted};
  }
  function applyExecution(execution){
    B.applyMergedState(B.mergeWithRemoteState(execution));
    mergeGhTimeLogDeletes(execution.time_logs_deleted||{});
    mergeGhTimeLogs(execution.time_logs||[]);
  }
  function strictStable(value){if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return "["+value.map(strictStable).join(",")+"]";return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+strictStable(value[k])).join(",")+"}";}
  function equalState(a,b){
    return strictStable({states:a.states||{},state_meta:a.state_meta||{},time_logs:a.time_logs||[],time_logs_deleted:a.time_logs_deleted||{}})===
      strictStable({states:b.states||{},state_meta:b.state_meta||{},time_logs:b.time_logs||[],time_logs_deleted:b.time_logs_deleted||{}});
  }
  async function refreshGame(uid){
    const data=await rpc("get_taskring_game_configuration");if(session().uid!==uid)throw Error("登录账号已变化");
    if(!data||!Array.isArray(data.policies)||!Array.isArray(data.operations)||!data.routines)throw Error("游戏配置未完整读取");
    gameCatalog=data;return data;
  }
  function projectConfig(raw){
    if(!gameCatalog)return {...raw,gameQuest:cloud.routineView(raw.gameQuest)};
    const gameQuest=cloud.routineView(raw.gameQuest,gameCatalog.routines);
    const games=(gameQuest.games||[]).map(g=>({...g}));
    for(const p of gameCatalog.policies){
      let g=games.find(x=>x.id===p.game_key);
      if(!g){g={id:p.game_key,name:p.game_name,short:p.game_name,icon:p.game_name.slice(0,1),accent:"slate",enabled:true};games.push(g);}
      Object.assign(g,{name:p.game_name,playTier:p.play_tier,priority:p.sort_order,storyFocus:p.story_focus,gameKind:p.game_kind});
    }
    return {...raw,gameQuest:{...gameQuest,games},cloudGameConfig:{policies:copy(gameCatalog.policies),operations:copy(gameCatalog.operations)}};
  }
  const rowsBy=(rows,key)=>new Map((rows||[]).map(r=>[r[key],r]));
  const policyFields=["game_key","game_name","play_tier","story_focus","game_kind","routine_policy","limited_event_policy","sort_order","effective_on"];
  const opsFields=["task_key","game","server","task_name","task_type","period","open_at","deadline_at","gameplay_end_at","claim_end_at","lifecycle_status","priority","verification","source_level","source_url","notes","last_verified_at","open_date","deadline_date","last_verified_date"];
  const pick=(row,fields)=>Object.fromEntries(fields.map(k=>[k,row?.[k]??null]));
  function catalogChanges(before,after,{importing=false}={}){
    const old=before.cloudGameConfig||{},next=after.cloudGameConfig;
    const originalPolicies=rowsBy(old.policies,"game_key"),policies=rowsBy(next?.policies||old.policies,"game_key");
    // In legacy imports, the embedded game tiers were only old local display
    // metadata. Never overwrite the present policy with that stale metadata.
    if(!importing||next){
      const originalMeta=rowsBy(before.gameQuest?.games,"id");
      for(const g of after.gameQuest?.games||[]){
        const previous=originalMeta.get(g.id),base=policies.get(g.id)||originalPolicies.get(g.id);
        if(!base&&!g.playTier)continue;
        const patch={};
        for(const [key,field] of [["name","game_name"],["playTier","play_tier"],["priority","sort_order"],["storyFocus","story_focus"],["gameKind","game_kind"]]){
          if(g[key]==null||previous&&g[key]===previous[key])continue;
          if(base&&originalPolicies.has(g.id)&&base[field]!==originalPolicies.get(g.id)[field]&&base[field]!==g[key])throw Error("游戏策略与游戏设置字段冲突："+g.id);
          patch[field]=g[key];
        }
        if(!base||Object.keys(patch).length){
          const tier=Number(patch.play_tier??base?.play_tier??g.playTier);
          if(![1,2,3,4,5].includes(tier))throw Error("游戏等级无效："+g.id);
          const row={game_key:g.id,game_name:g.name,play_tier:tier,story_focus:false,game_kind:"live_service",sort_order:Math.max(1,Number(g.priority)||999),...base,...patch};
          if(!base||"play_tier" in patch){row.routine_policy=tier===1?"required":tier===2?"deferred":"none";row.limited_event_policy=tier===1?"priority":tier===5?"none":"deferred";}
          policies.set(g.id,row);
        }
      }
    }
    const policyChanges=[];
    for(const [key,row] of policies){const prior=originalPolicies.get(key)||null;
      if(prior&&Number(row.play_tier)!==Number(prior.play_tier)){
        const tier=Number(row.play_tier);if(![1,2,3,4,5].includes(tier))throw Error("游戏等级无效："+key);
        row.routine_policy=tier===1?"required":tier===2?"deferred":"none";
        row.limited_event_policy=tier===1?"priority":tier===5?"none":"deferred";
      }if(strictStable(pick(row,policyFields))!==strictStable(pick(prior,policyFields)))policyChanges.push({op:"upsert",game_key:key,expected:prior,next:pick(row,policyFields)});}
    // Omission does not physically delete a game policy. Use tier F to retire it.
    const originalOps=rowsBy(old.operations,"task_key"),operations=rowsBy(next?.operations||old.operations,"task_key"),opsChanges=[];
    for(const [key,row] of operations){const prior=originalOps.get(key)||null;if(strictStable(pick(row,opsFields))!==strictStable(pick(prior,opsFields)))opsChanges.push({op:"upsert",task_key:key,expected:prior,next:pick(row,opsFields)});}
    for(const [key,row] of originalOps)if(!operations.has(key))opsChanges.push({op:"archive",task_key:key,expected:row});
    return {policyChanges,opsChanges,routineChanges:cloud.routineChanges(before.gameQuest,after.gameQuest)};
  }
  async function readWorkspace(uid,full=false){
    const data=await rpc(full?"get_taskring_workspace":"get_taskring_workspace_head");
    if(session().uid!==uid)throw Error("登录账号已变化");
    if(data)accept(data,uid);
    return data;
  }
  async function migrate(uid,interactive=false){
    if(initializing)throw Error("迁移正在执行");
    if(!legacyGistToken()&&!interactive)throw Error("请从同步设置启动旧数据迁移");
    initializing=true;
    try{
      status("核验旧数据");
      // Read only. Missing, truncated or undecipherable files never initialize a workspace.
      const gist=await legacyFetch();
      if(!gist?.files?.[CONFIG_FILE]?.content||!gist?.files?.[GITHUB_STATE_FILE]?.content)throw Error("旧配置或执行记录不完整，不能迁移");
      const parsed=await legacyParse(gist);
      if(!parsed.config||parsed.mode==="error")throw Error("旧配置无法解密，不能迁移");
      const execution=legacyState(gist);
      if(!execution||typeof execution.states!=="object"||!execution.states)throw Error("旧执行记录不可用");
      migrateLegacyLocalStates();
      const local=loadLocalTaskConfig();
      const decision=Core.decideConfig({local,remote:parsed.config,baseFingerprint:B.configBaseFingerprint()});
      let chosen=decision.source==="local"?local:parsed.config;
      if(decision.source==="conflict"||local&&!B.configBaseFingerprint()&&fp(local)!==fp(parsed.config)){
        if(!interactive||!confirm("旧 Gist 与本机配置存在冲突。确认采用旧云端配置进行迁移？本机配置会完整保留在迁移备份中。"))throw Error("旧配置存在冲突，需在同步设置确认迁移");
        chosen=parsed.config;
      }
      // Do not migrate an account which has no existing game catalog.
      const routine=await rpc("get_game_routine_catalog");
      if(!routine||!Array.isArray(routine.rows))throw Error("当前 Supabase 账号与现有游戏工作区不匹配");
      const sourceRevision=String(gist.history?.[0]?.version||gist.updated_at||"");
      if(!sourceRevision)throw Error("无法确认旧云端版本");
      const config=canonicalConfig(chosen);
      const merged=snapshot(execution);
      const result=await rpc("initialize_taskring_workspace",{
        p_configuration:config,p_execution:merged,p_source:"legacy_gist",
        p_source_config:{cloud:JSON.parse(gist.files[CONFIG_FILE].content),local},
        p_source_execution:{cloud:execution,local:snapshot({})},
        p_source_revision:sourceRevision
      });
      const reread=await rpc("get_taskring_workspace");
      if(!result||!reread||fp(reread.configuration)!==fp(config)||!equalState(reread.execution,merged))throw Error("迁移回读核验不一致，保留旧凭据并停止");
      accept(reread,uid);bind(uid);await refreshGame(uid);
      applyConfig(config,"Supabase 迁移：保留旧本机配置");
      applyExecution(reread.execution);recordBase(config);
      localStorage.removeItem(GH_TOKEN_KEY);
      status("已迁移","on");ghLog("Supabase 迁移完成：配置与执行记录已回读核验，旧 Gist 写入已停用。");
      renderAll();return reread;
    }finally{initializing=false;}
  }
  function combineExecution(a,b){
    if(!b)return a;
    const merged=Core.mergeStateRecords({localStates:a.states||{},localMeta:a.state_meta||{},remoteStates:b.states||{},remoteMeta:b.state_meta||{},migrationTime:new Date().toISOString(),deviceId:B.deviceId()});
    const deleted={...(a.time_logs_deleted||{})};
    for(const [id,ts] of Object.entries(b.time_logs_deleted||{}))if(!deleted[id]||String(ts)>String(deleted[id]))deleted[id]=ts;
    const logs=new Map();
    for(const log of [...(a.time_logs||[]),...(b.time_logs||[])])if(log?.id&&!deleted[log.id]&&(!logs.has(log.id)||String(log.ended_at||"")>=String(logs.get(log.id).ended_at||"")))logs.set(log.id,log);
    return {version:4,states:merged.states,state_meta:merged.stateMeta,time_logs:[...logs.values()].sort((x,y)=>String(x.ended_at||"").localeCompare(String(y.ended_at||""))),time_logs_deleted:deleted};
  }
  async function initializeFromBackup(config,execution){
    const uid=trustedAccount();
    if(await readWorkspace(uid))throw Error("工作区已存在，请使用正常导入");
    await refreshGame(uid);
    const normalized=canonicalConfig(config),merged=snapshot(execution);
    const saved=await rpc("initialize_taskring_workspace",{p_configuration:normalized,p_execution:merged,p_source:"verified_backup",p_source_config:{backup:config,local:loadLocalTaskConfig()},p_source_execution:{backup:execution,local:snapshot({})},p_source_revision:"backup-"+fp(config)});
    const verified=await rpc("get_taskring_workspace");
    if(!saved||!verified||fp(verified.configuration)!==fp(normalized)||!equalState(verified.execution,merged))throw Error("备份迁移回读核验失败");
    accept(verified,uid);bind(uid);recordBase(normalized);applyConfig(normalized,"Supabase 完整备份迁移前");applyExecution(verified.execution);
    localStorage.removeItem(GH_TOKEN_KEY);status("已迁移","on");renderAll();return verified;
  }
  // Acknowledged per-record versions are persisted with the server cursor.
  // The browser retains its historical cache (needed for historical views and
  // task-code collision protection), but never retransmits unchanged history.
  function stateVersion(record){
    return strictStable([record?.value,record?.updatedAt||record?.updated_at||"",record?.deviceId||record?.device_id||"",record?.sequence||null]);
  }
  function emptyCursor(uid){return {uid,revision:null,meta:{},logs:{},deleted:{}};}
  function readCursor(uid){
    try{
      const data=JSON.parse(localStorage.getItem(SYNC_CURSOR)||"null");
      if(data?.uid===uid&&Number.isSafeInteger(data.revision)&&data.revision>=0&&data.meta&&data.logs&&data.deleted&&localStorage.getItem(I.stateMetaKey))return data;
    }catch(_){}
    return emptyCursor(uid);
  }
  function persistCursor(cursor){
    try{localStorage.setItem(SYNC_CURSOR,JSON.stringify(cursor));}
    catch(_){/* quota or private mode: fall back to safe full bootstrap next time */}
  }
  function observeDelta(cursor,delta){
    if(delta.full){cursor.meta={};cursor.logs={};cursor.deleted={};}
    for(const [key,record] of Object.entries(delta.state_meta||{}))cursor.meta[key]=stateVersion(record);
    // Explicit legacy removal is represented in the index. Keep local history;
    // existing versioned tombstones, not absence, decide completion.
    for(const key of delta.removed||[])delete cursor.meta[key];
    if(Array.isArray(delta.time_logs)){
      cursor.logs={};
      for(const log of delta.time_logs)if(log?.id)cursor.logs[log.id]=strictStable(log);
    }
    if(delta.time_logs_deleted&&typeof delta.time_logs_deleted==="object")cursor.deleted={...delta.time_logs_deleted};
    cursor.revision=Number(delta.revision);
  }
  function buildExecutionPatch(local,cursor){
    const meta={},logs=[],deleted={};
    for(const [key,record] of Object.entries(local.state_meta||{})){
      if(stateVersion(record)!==cursor.meta[key])meta[key]=record;
    }
    for(const [id,stamp] of Object.entries(local.time_logs_deleted||{})){
      if(!cursor.deleted[id]||String(stamp)>String(cursor.deleted[id]))deleted[id]=stamp;
    }
    for(const log of local.time_logs||[]){
      if(log?.id&&!cursor.deleted[log.id]&&!deleted[log.id]&&strictStable(log)!==cursor.logs[log.id])logs.push(log);
    }
    return {meta,logs,deleted};
  }
  async function pushState(uid,extra=null){
    migrateLegacyLocalStates();
    if(localStorage.getItem(OWNER)!==uid)throw Error("本机尚未绑定工作区");
    for(let attempt=0;attempt<3;attempt++){
      const cursor=readCursor(uid);
      const delta=await rpc("get_taskring_execution_delta",{p_since:cursor.revision});
      if(!delta||!Number.isSafeInteger(Number(delta.revision)))throw Error("执行记录增量读取失败");
      if(session().uid!==uid||localStorage.getItem(OWNER)!==uid)throw Error("登录账号已变化");
      // Apply the delta before advancing the durable cursor. A crash before
      // cursor persistence simply replays the same idempotent changes.
      applyExecution(delta);
      observeDelta(cursor,delta);
      const local=extra?snapshot(combineExecution(snapshot({}),extra)):snapshot({});
      if(extra)applyExecution(local);
      // Persist any newly normalized legacy keys before sending the patch.
      B.applyMergedState(B.mergeWithRemoteState(local));
      persistCursor(cursor);
      const patch=buildExecutionPatch(local,cursor);
      if(!Object.keys(patch.meta).length&&!patch.logs.length&&!Object.keys(patch.deleted).length)return workspace;
      try{
        const saved=await rpc("save_taskring_execution_delta",{p_expected_revision:cursor.revision,p_state_meta:patch.meta,p_time_logs:patch.logs.length?patch.logs:null,p_time_logs_deleted:Object.keys(patch.deleted).length?patch.deleted:null});
        if(!saved||!Number.isSafeInteger(Number(saved.revision)))throw Error("执行记录写入未确认");
        if(session().uid!==uid||localStorage.getItem(OWNER)!==uid)throw Error("登录账号已变化");
        // Keep the cursor at the observed revision until the next pull:
        // the server's accepted records and any concurrent later changes
        // will be acknowledged by that pull.
        if(workspace)workspace={...workspace,state_revision:Number(saved.revision)};
        return workspace;
      }catch(e){if(e.code!=="40001")throw e;}
    }
    throw Error("完成记录在其他设备同步中；本机记录已保留，稍后重试");
  }
  async function exportFullExecution(){
    const uid=trustedAccount();
    if(localStorage.getItem(OWNER)!==uid)throw Error("请先连接 Supabase 工作区");
    const remote=await readWorkspace(uid,true);
    if(!remote?.execution)throw Error("完整历史读取失败；未导出不完整备份");
    return snapshot(remote.execution);
  }
  async function writeConfig(c,{before=null,after=null,importing=false,guard=null,execution=null}={}){
    const uid=trustedAccount();
    if(localStorage.getItem(OWNER)!==uid)throw Error("请先完成旧数据迁移或读取云端");
    if(!navigator.onLine)throw Error("离线：配置保留在本机，联网后同步");
    const remote=await readWorkspace(uid,!!execution);
    if(!remote)throw Error("尚未迁移工作区");
    const candidate=canonicalConfig(c),current=localConfig();
    const remoteFp=fp(remote.configuration),base=baseline();
    if(guard&&guard!==remoteFp)throw Error("云端配置已发生变化，请重新打开编辑器");
    if(base&&remoteFp!==base&&fp(candidate)!==remoteFp){
      B.rememberConflict(candidate,remote.configuration,{updated_at:remote.config_updated_at},"supabase-revision");
      throw Error("云端配置已发生变化，保留本机草稿，未覆盖云端");
    }
    if(!base&&fp(candidate)!==remoteFp)throw Error("本机尚无共同版本，请先读取云端");
    const delta=before&&after?catalogChanges(before,after,{importing}):{routineChanges:[],policyChanges:[],opsChanges:[]};
    const gameChanged=delta.routineChanges.length||delta.policyChanges.length||delta.opsChanges.length;
    if(gameChanged&&!gameCatalog)throw Error("游戏配置尚未同步");
    if(fp(candidate)===remoteFp&&!gameChanged&&!execution){recordBase(remote.configuration);return remote;}
    const args={p_expected_revision:remote.config_revision,p_configuration:candidate,p_routine_revision:before?.gameQuest?.routineRevision??null,p_routine_changes:delta.routineChanges,p_policy_changes:delta.policyChanges,p_ops_changes:delta.opsChanges};
    const result=execution?await rpc("import_taskring_workspace",{...args,p_expected_state_revision:remote.state_revision,p_execution:snapshot(combineExecution(remote.execution,execution))}):await rpc("save_taskring_workspace_config_compact",args);
    const saved=result.workspace;accept(saved,uid);gameCatalog=result.game;recordBase(saved.configuration);
    // Never overwrite a newer local edit that occurred while the request was pending.
    if(fp(localConfig())===fp(current))applyConfig(saved.configuration,"Supabase 配置保存");
    if(execution)applyExecution(saved.execution);
    if(gameChanged)await cloud.refresh();
    renderAll();return saved;
  }
  async function pull(options={}){
    if(document.body.classList.contains("locked"))return;
    const uid=trustedAccount();
    const remote=await readWorkspace(uid);
    if(!remote){
      if(options.migration||legacyGistToken()&&attemptedOwner!==uid){attemptedOwner=uid;return migrate(uid,!!options.interactive);}
      status("待迁移","off");ghLog("请通过同步设置启动一次旧数据迁移。");return;
    }
    await refreshGame(uid);
    const bound=localStorage.getItem(OWNER);
    if(!bound){
      const existing=localConfig();
      const localData=!!existing||Object.keys(collectGhLocalStates()).length>0||readTimeLogs().length>0;
      const needsConfirmation=localData&&(!existing||fp(existing)!==fp(remote.configuration));
      if(needsConfirmation&&!options.interactive){
        status("需确认本机数据","err");ghLog("本机已有配置，需在同步设置明确确认采用 Supabase 云端，防止跨账号覆盖。");return;
      }
      if(needsConfirmation&&!confirm("采用 Supabase 云端工作区？本机旧配置将备份，完成状态按版本合并。"))return;
      bind(uid);recordBase(remote.configuration);
      applyConfig(remote.configuration,"绑定 Supabase 工作区前备份");
      if(legacyGistToken())localStorage.removeItem(GH_TOKEN_KEY);
    }else{
      const current=localConfig(),decision=Core.decideConfig({local:current,remote:remote.configuration,baseFingerprint:baseline()});
      if(options.preferRemote){
        if(current&&fp(current)!==fp(remote.configuration)&&options.interactive&&!confirm("采用 Supabase 云端配置？本机旧配置会自动备份。"))return;
        applyConfig(remote.configuration,"手动读取 Supabase 云端前备份");recordBase(remote.configuration);
      }else if(decision.source==="conflict"){
        B.rememberConflict(current,remote.configuration,{updated_at:remote.config_updated_at},"supabase-both-changed");
        status("配置冲突","err");
      }else if(decision.source==="local"){
        await writeConfig(current);
      }else{
        applyConfig(remote.configuration,"读取 Supabase 云端配置");recordBase(remote.configuration);
      }
    }
    await pushState(uid);
    if(!I.hasConfigConflict())status("已同步","on");
    renderAll();
  }
  function guarded(fn,interactive=false){
    return serial(async()=>{try{return await fn();}catch(e){
      status("同步未完成","err");ghLog(message(e));if(interactive)showToast(message(e),"warn",4200);throw e;
    }});
  }
  // Retain old call names as UI compatibility shims, never as Gist writers.
  ghToken=()=>session().uid&&(!localStorage.getItem(OWNER)||localStorage.getItem(OWNER)===session().uid)?"supabase-session":"";
  ghFetchGist=async()=>{throw Error("Gist 已停用，仅允许一次性迁移");};
  ghPatchFiles=async()=>{throw Error("Gist 写入已永久停用");};
  ghPatchState=async()=>{throw Error("Gist 写入已永久停用");};
  ghPatchConfig=c=>guarded(()=>writeConfig(c));
  I.patchConfig=ghPatchConfig;
  ghPull=options=>guarded(()=>pull(options||{}),!!options?.interactive).catch(()=>{});
  ghPush=(silent=false)=>guarded(async()=>{
    const uid=trustedAccount();if(!workspace||owner!==uid)await pull({});
    if(localStorage.getItem(OWNER)!==uid)return;
    await pushState(uid);
    const current=localConfig();
    if(current&&fp(current)!==baseline())await writeConfig(current);
    status("已同步","on");renderAll();
  },!silent).catch(()=>{});
  scheduleGhSave=()=>{
    clearTimeout(stateTimer);if(!ghToken()){status("本机缓存","off");return;}
    status("等待同步");stateTimer=setTimeout(()=>ghPush(true),900);
  };
  saveLocalTaskConfig=function(c,reason){
    const saved=saveLocal(c,reason);
    if(!applying&&workspace&&owner===session().uid&&localStorage.getItem(OWNER)===owner){
      clearTimeout(configTimer);configTimer=setTimeout(()=>{
        const current=localConfig();if(current&&fp(current)!==baseline())ghPatchConfig(current).catch(()=>{});
      },1200);
    }
    return saved;
  };
  openGhModal=function(){
    const modal=document.getElementById("ghModal");if(!modal)return;
    closeControlCenter();
    const panel=document.getElementById("ghGistMasked");
    if(panel)panel.textContent=session().uid?(session().email||"已登录 Supabase")+(workspace?" · 工作区已连接":" · 待迁移/读取"):"未登录 Supabase";
    modal.classList.remove("hidden");modal.setAttribute("aria-hidden","false");
  };
  restorePreviousCloudConfig=async()=>showToast("请使用统一 JSON 的配置回滚点；云端历史已在 Supabase 保存。","warn");
  // Old history endpoints are unreachable from the replacement UI.
  ghFetchGistCommits=async()=>{throw Error("Gist 历史入口已停用");};
  ghFetchGistRevision=async()=>{throw Error("Gist 历史入口已停用");};
  document.getElementById("workspaceLogin")?.addEventListener("submit",async e=>{
    e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));
    const form=e.currentTarget;
    try{await cloud.workspaceSignIn(values.email,values.password);form.reset();ghPull({interactive:true});}
    catch(err){ghLog(message(err));showToast("Supabase 登录失败","warn");}
  });
  document.getElementById("workspaceMigrateBtn")?.addEventListener("click",()=>ghPull({migration:true,interactive:true}));
  window.addEventListener("taskring-workspace-auth",()=>{
    if(session().uid!==owner){workspace=null;gameCatalog=null;owner="";}
    if(session().uid&&!document.body.classList.contains("locked"))ghPull();
  });
  window.addEventListener("online",()=>{if(ghToken())ghPull();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&ghToken()&&!document.body.classList.contains("locked"))ghPull();});
  setInterval(()=>{if(!document.hidden&&ghToken()&&!document.body.classList.contains("locked"))ghPull();},60000);
  window.TaskRingWorkspace={connected:()=>!!workspace&&owner===session().uid&&localStorage.getItem(OWNER)===owner,revision:()=>workspace?.config_revision??null,
    projectConfig,gameReady:()=>!!gameCatalog,catalogChanges,
    exportExecution:()=>guarded(exportFullExecution,true),
    importExecution:execution=>guarded(()=>pushState(trustedAccount(),execution),true),
    initializeFromBackup:(config,execution)=>guarded(()=>initializeFromBackup(config,execution),true),
    saveConfiguration:(candidate,options={})=>guarded(()=>writeConfig(candidate,options),true),sync:ghPull};
})();
