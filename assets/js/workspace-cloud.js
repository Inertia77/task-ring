// Supabase is the sole writable workspace backend. Legacy Gist is read once for
// verified cutover, never patched. Existing completion keys stay unchanged.
(function(){
  "use strict";
  const cloud=window.TaskRingGameOpsCloud,I=window.TaskRingIntegrity,B=I.workspaceBridge,Core=I.core;
  const OWNER="taskring_workspace_owner_v1",BASE="taskring_workspace_config_base_v1";
  const legacyFetch=ghFetchGist,legacyParse=ghParseConfig,legacyState=ghParseState;
  const saveLocal=saveLocalTaskConfig,oldStatus=setGhStatus;
  let workspace=null,owner="",queue=Promise.resolve(),stateTimer,configTimer,applying=false,initializing=false,attemptedOwner="";
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
    const out=normalizeTaskConfig(copy(c));
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
    const deleted={...(remote.time_logs_deleted||remote.deleted_time_logs||{})};
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
  function equalState(a,b){
    return Core.stableStringify({states:a.states||{},state_meta:a.state_meta||{},time_logs:a.time_logs||[],time_logs_deleted:a.time_logs_deleted||{}})===
      Core.stableStringify({states:b.states||{},state_meta:b.state_meta||{},time_logs:b.time_logs||[],time_logs_deleted:b.time_logs_deleted||{}});
  }
  async function readWorkspace(uid){
    const data=await rpc("get_taskring_workspace");
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
      const local=loadLocalTaskConfig();
      const decision=Core.decideConfig({local,remote:parsed.config,baseFingerprint:B.configBaseFingerprint()});
      let chosen=decision.source==="local"?local:parsed.config;
      if(decision.source==="conflict"){
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
      accept(reread,uid);bind(uid);
      applyConfig(config,"Supabase 迁移：保留旧本机配置");
      applyExecution(reread.execution);recordBase(config);
      localStorage.removeItem(GH_TOKEN_KEY);
      status("已迁移","on");ghLog("Supabase 迁移完成：配置与执行记录已回读核验，旧 Gist 写入已停用。");
      renderAll();return reread;
    }finally{initializing=false;}
  }
  async function pushState(uid){
    // Compare-and-swap state and merge on conflict, retaining remote historical logs.
    for(let attempt=0;attempt<3;attempt++){
      const remote=await readWorkspace(uid);
      if(!remote)throw Error("尚未迁移工作区");
      const merged=snapshot(remote.execution);applyExecution(merged);
      if(equalState(remote.execution,merged))return remote;
      try{
        const saved=await rpc("save_taskring_workspace_state",{p_expected_revision:remote.state_revision,p_execution:merged});
        accept(saved,uid);applyExecution(saved.execution);return saved;
      }catch(e){if(e.code!=="40001"&&attempt===0)throw e;}
    }
    throw Error("完成记录在其他设备同步中；本机记录已保留，稍后重试");
  }
  async function writeConfig(c,{routineBefore=null,routineAfter=null,guard=null}={}){
    const uid=trustedAccount();
    if(localStorage.getItem(OWNER)!==uid)throw Error("请先完成旧数据迁移或读取云端");
    if(!navigator.onLine)throw Error("离线：配置保留在本机，联网后同步");
    const remote=await readWorkspace(uid);
    if(!remote)throw Error("尚未迁移工作区");
    const candidate=canonicalConfig(c),current=localConfig();
    const remoteFp=fp(remote.configuration),base=baseline();
    if(guard&&guard!==remoteFp)throw Error("云端配置已发生变化，请重新打开编辑器");
    if(base&&remoteFp!==base&&fp(candidate)!==remoteFp){
      B.rememberConflict(candidate,remote.configuration,{updated_at:remote.config_updated_at},"supabase-revision");
      throw Error("云端配置已发生变化，保留本机草稿，未覆盖云端");
    }
    if(!base&&fp(candidate)!==remoteFp)throw Error("本机尚无共同版本，请先读取云端");
    const changes=routineBefore&&routineAfter?cloud.routineChanges(routineBefore,routineAfter):[];
    if(changes.length&&!cloud.routineState().active)throw Error("游戏任务尚未同步");
    if(fp(candidate)===remoteFp&&!changes.length){recordBase(remote.configuration);return remote;}
    const saved=await rpc("save_taskring_workspace_config",{p_expected_revision:remote.config_revision,p_configuration:candidate,p_routine_revision:routineBefore?.routineRevision??null,p_routine_changes:changes});
    accept(saved,uid);recordBase(saved.configuration);
    // Never overwrite a newer local edit that occurred while the request was pending.
    if(fp(localConfig())===fp(current))applyConfig(saved.configuration,"Supabase 配置保存");
    if(changes.length)await cloud.fetchRoutines();
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
    const bound=localStorage.getItem(OWNER);
    if(!bound){
      const existing=localConfig();
      if(existing&&fp(existing)!==fp(remote.configuration)&&!options.interactive){
        status("需确认本机数据","err");ghLog("本机已有配置，需在同步设置明确确认采用 Supabase 云端，防止跨账号覆盖。");return;
      }
      if(existing&&fp(existing)!==fp(remote.configuration)&&!confirm("采用 Supabase 云端工作区？本机旧配置将备份，完成状态按版本合并。"))return;
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
    try{await cloud.workspaceSignIn(values.email,values.password);e.currentTarget.reset();ghPull({interactive:true});}
    catch(err){ghLog(message(err));showToast("Supabase 登录失败","warn");}
  });
  document.getElementById("workspaceMigrateBtn")?.addEventListener("click",()=>ghPull({migration:true,interactive:true}));
  window.addEventListener("taskring-workspace-auth",()=>{
    if(session().uid!==owner){workspace=null;owner="";}
    if(session().uid&&!document.body.classList.contains("locked"))ghPull();
  });
  window.addEventListener("online",()=>{if(ghToken())ghPull();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&ghToken()&&!document.body.classList.contains("locked"))ghPull();});
  setInterval(()=>{if(!document.hidden&&ghToken()&&!document.body.classList.contains("locked"))ghPull();},60000);
  window.TaskRingWorkspace={connected:()=>!!workspace&&owner===session().uid,revision:()=>workspace?.config_revision??null,
    saveConfiguration:(candidate,options={})=>guarded(()=>writeConfig(candidate,options),true),sync:ghPull};
})();
