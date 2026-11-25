const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const Core=require("../assets/js/data/integrity-core.js");
const src=fs.readFileSync(path.join(__dirname,"../assets/js/workspace-cloud.js"),"utf8");
const clone=x=>JSON.parse(JSON.stringify(x));
const key="taskring_github_v2_2026-11-23_t001_d1";
const config={tasks:[{id:"stable-task",code:"t001",title:"Private fixture"}],gameQuest:{games:[{id:"zzz",name:"Fixture game",priority:1,playTier:1}],boards:{daily:{zzz:[{id:"stable-routine",title:"Routine"}]},weekly:{zzz:[]}}}};
const execution={states:{[key]:"1"},state_meta:{[key]:{value:"1",updatedAt:"2026-11-23T01:00:00Z",deviceId:"old"}},time_logs:[{id:"old-log",ended_at:"2026-11-23T01:00:00Z"}],time_logs_deleted:{removed:"2026-11-23T00:00:00Z"}};
const policy={game_key:"zzz",game_name:"Fixture game",play_tier:1,story_focus:false,game_kind:"live_service",routine_policy:"required",limited_event_policy:"priority",sort_order:1,effective_on:"2026-11-01",updated_at:"2026-11-23T00:00:00Z"};
function harness({missing=false}={}){
  let local=clone(config),localStates={},localMeta={},logs=[],deleted={},row=null,uid="owner",gistReads=0,legacyWrites=0;
  const storage=new Map([["token","legacy-token"]]),calls=[];
  const game={policies:[clone(policy)],operations:[{id:"ops-id",task_key:"ops-key",game:"ZZZ",server:"GLOBAL",task_name:"Old event",task_type:"LIMITED_TIME",priority:"NORMAL",verification:"CONFIRMED",lifecycle_status:"ACTIVE",user_action:"NONE",updated_at:"2026-11-23T00:00:00Z"}],routines:{revision:7,rows:[{game_key:"zzz",board:"daily",task_key:"stable-routine",title:"Routine",enabled:true,lane:"must"}]}};
  const bridge={deviceId:()=>"device",configBaseFingerprint:()=>Core.configFingerprint(config),rememberConflict(){},
    mergeWithRemoteState(remote){return Core.mergeStateRecords({localStates,localMeta,remoteStates:remote.states||{},remoteMeta:remote.state_meta||{},migrationTime:"2026-11-25T00:00:00Z",deviceId:"device"});},
    applyMergedState(m){localStates=clone(m.states);localMeta=clone(m.stateMeta);}};
  const cloud={workspaceSession:()=>({uid,ready:true}),workspaceSignIn:async()=>{},
    async workspaceRpc(name,args){calls.push({name,args:args&&clone(args)});
      if(name==="get_taskring_workspace")return row&&clone(row);
      if(name==="get_game_routine_catalog")return clone(game.routines);
      if(name==="get_taskring_game_configuration")return clone(game);
      if(name==="initialize_taskring_workspace"){assert.equal(row,null);row={configuration:clone(args.p_configuration),execution:clone(args.p_execution),config_revision:1,state_revision:1};return clone(row);}
      if(name==="save_taskring_workspace_config_v2"||name==="import_taskring_workspace"){
        assert.equal(args.p_expected_revision,row.config_revision);
        if(name==="import_taskring_workspace"){assert.equal(args.p_expected_state_revision,row.state_revision);row.execution=clone(args.p_execution);row.state_revision++;}
        row.configuration=clone(args.p_configuration);row.config_revision++;return {workspace:clone(row),game:clone(game)};
      }
      if(name==="save_taskring_workspace_state"){assert.equal(args.p_expected_revision,row.state_revision);row.execution=clone(args.p_execution);row.state_revision++;return clone(row);}
      throw Error("unexpected RPC "+name);
    },
    routineView(raw,catalog=game.routines){const out=clone(raw);out.routineRevision=catalog.revision;out.boards.daily.zzz=catalog.rows.map(r=>({id:r.task_key,title:r.title,enabled:r.enabled,daily_lane:r.lane}));return out;},
    routineChanges(before,after){const a=before.boards.daily.zzz,b=after.boards.daily.zzz;return JSON.stringify(a)===JSON.stringify(b)?[]:[{op:"upsert",game_key:"zzz",board:"daily",task_key:b[0].id,title:b[0].title,lane:"must"}];},refresh:async()=>{}};
  const window={TaskRingGameOpsCloud:cloud,TaskRingIntegrity:{workspaceBridge:bridge,core:Core,configConflictKey:"conflict",hasConfigConflict:()=>false},addEventListener(){}};
  const ctx={window,document:{body:{classList:{contains:()=>false}},getElementById:()=>null,addEventListener(){},hidden:false},navigator:{onLine:true},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    GH_TOKEN_KEY:"token",CONFIG_FILE:"config",GITHUB_STATE_FILE:"state",
    ghFetchGist:async()=>{gistReads++;return {history:[{version:"verified-old"}],files:missing?{config:{content:JSON.stringify(config)}}:{config:{content:JSON.stringify(config)},state:{content:JSON.stringify(execution)}}};},
    ghParseConfig:async()=>({config:clone(config),mode:"encrypted"}),ghParseState:()=>clone(execution),legacyGistToken:()=>storage.get("token")||"",
    ghToken:()=>"",ghPatchFiles:async()=>{legacyWrites++;},ghPatchState:async()=>{},ghPatchConfig:async()=>{},ghPull:async()=>{},ghPush:async()=>{},scheduleGhSave(){},
    saveLocalTaskConfig:c=>(local=clone(c),clone(c)),loadLocalTaskConfig:()=>clone(local),normalizeTaskConfig:clone,applyTaskConfig(){},migrateLegacyLocalStates(){},
    collectGhLocalStates:()=>clone(localStates),readTimeLogs:()=>clone(logs),readDeletedTimeLogMap:()=>clone(deleted),
    mergeGhTimeLogDeletes:m=>{deleted={...deleted,...m}},mergeGhTimeLogs:m=>{logs=clone(m)},setGhStatus(){},ghLog(){},showToast(){},renderAll(){},
    openGhModal(){},restorePreviousCloudConfig(){},ghFetchGistCommits(){},ghFetchGistRevision(){},closeControlCenter(){},confirm:()=>true,setInterval(){},setTimeout(){},clearTimeout(){},console};
  vm.runInNewContext(src,ctx);
  return {ctx,api:window.TaskRingWorkspace,calls,storage,get row(){return row},get local(){return local},get gistReads(){return gistReads},get legacyWrites(){return legacyWrites},switchUser(id){uid=id}};
}
test("verified legacy migration copies config, checks, logs, tombstones and never writes Gist",async()=>{
  const h=harness();
  await h.ctx.ghPull({migration:true,interactive:true});
  assert.equal(h.api.connected(),true);
  assert.equal(h.row.configuration.tasks[0].code,"t001");
  assert.equal(h.row.configuration.gameQuest.boards.daily.zzz.length,0);
  assert.equal(h.row.execution.states[key],"1");
  assert.equal(h.row.execution.time_logs[0].id,"old-log");
  assert.equal(h.row.execution.time_logs_deleted.removed,"2026-11-23T00:00:00Z");
  assert.equal(h.storage.has("token"),false);
  assert.equal(h.gistReads,1);
  await h.ctx.ghPull();
  assert.equal(h.gistReads,1);
  await assert.rejects(h.ctx.ghPatchFiles(),/停用/);
  assert.equal(h.legacyWrites,0);
});
test("missing legacy state cannot initialize the workspace",async()=>{
  const h=harness({missing:true});
  await h.ctx.ghPull({migration:true,interactive:true});
  assert.equal(h.row,null);
  assert.equal(h.api.connected(),false);
  assert.equal(h.storage.has("token"),true);
});
test("one configuration RPC carries manual and JSON changes across game tables",async()=>{
  const h=harness();await h.ctx.ghPull({migration:true,interactive:true});
  const before=h.api.projectConfig(h.local),after=clone(before);
  after.tasks[0].title="Edited";
  after.gameQuest.boards.daily.zzz[0].title="Changed routine";
  after.gameQuest.games[0].playTier=2;
  after.cloudGameConfig.operations=[];
  await h.api.saveConfiguration(after,{before,after,execution:{states:{},state_meta:{},time_logs:[{id:"imported",ended_at:"2026-11-24T00:00:00Z"}],time_logs_deleted:{}}});
  const call=h.calls.find(c=>c.name==="import_taskring_workspace");
  assert.equal(call.args.p_configuration.tasks[0].title,"Edited");
  assert.equal(call.args.p_configuration.cloudGameConfig,undefined);
  assert.equal(call.args.p_routine_revision,7);
  assert.equal(call.args.p_routine_changes[0].task_key,"stable-routine");
  assert.equal(call.args.p_policy_changes[0].next.play_tier,2);
  assert.equal(call.args.p_policy_changes[0].next.routine_policy,"deferred");
  assert.equal(call.args.p_ops_changes[0].op,"archive");
  assert.equal(call.args.p_execution.states[key],"1");
  assert.equal(call.args.p_execution.time_logs.length,2);
});
test("account change blocks any write from an already bound device",async()=>{
  const h=harness();await h.ctx.ghPull({migration:true,interactive:true});
  h.switchUser("different-owner");
  await assert.rejects(h.api.saveConfiguration(h.local),/其他账号/);
  assert.equal(h.api.connected(),false);
});
