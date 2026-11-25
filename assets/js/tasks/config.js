(function(root,factory){
  const dependencies=typeof module==="object"&&module.exports?require("./engine.js"):root.TaskRingTasks;
  const api=factory(dependencies);
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.TaskRingTaskConfig=api;
})(globalThis,function(E){
  "use strict";

  const VERSION=1,record=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const fail=message=>{throw new Error(message)};
  const nonempty=value=>typeof value==="string"&&!!value.trim();
  const allowedModule=module=>E.MODULES.includes(module)&&module!=="learning";
  const validKey=value=>nonempty(value)&&value.length<=300;

  function records(items,label,check,{legacy=false}={}){
    if(!Array.isArray(items))fail(label+"必须是数组");
    const ids=new Set(),codes=new Set();
    items.forEach((item,index)=>{
      if(!record(item)||(!legacy||item.id!=null)&&!validKey(item.id))fail(label+"第 "+(index+1)+" 项的 ID 无效");
      if(item.id&&ids.has(item.id))fail(label+"的 ID 重复："+item.id);
      if(item.code&&codes.has(item.code))fail(label+"的状态编码重复："+item.code);
      if(item.id)ids.add(item.id);
      if(item.code)codes.add(item.code);
      check?.(item);
    });
  }

  function validateConfig(config,legacy=false){
    if(!record(config))fail("配置必须是 JSON 对象");
    if(config.schemaVersion!=null&&config.schemaVersion!==VERSION)fail("当前版本无法读取此配置版本");
    records(config.tasks,"任务",task=>{
      if(!nonempty(task.title))fail("任务名称不能为空");
      if(task.code&&!/^t\d{3,}$/.test(task.code))fail("任务状态编码无效："+task.id);
      if(task.nextSchedule&&(!E.validSchedule(task.nextSchedule)||task.nextSchedule.type==="SEQUENCE"))fail("任务调度无效："+task.title);
      if(task.nextModule&&!allowedModule(task.nextModule))fail("任务所属模块无效："+task.title);
      if(task.steps!=null)records(task.steps,"子任务",step=>{
        if(!nonempty(step.title))fail("子任务名称不能为空");
        if(step.code&&!/^s\d{2,}$/.test(step.code))fail("子任务状态编码无效："+step.id);
      },{legacy});
    },{legacy});
    if(config.sequences!=null&&!record(config.sequences))fail("学习队列格式无效");
    E.TRACKS.forEach(track=>{
      const value=config.sequences?.[track];
      if(value==null)return;
      if(!record(value)||!["stop","loop"].includes(value.end)||typeof value.paused!=="boolean")fail("学习队列规则无效："+track);
      records(value.items,"学习 "+track,item=>{if(!nonempty(item.title))fail("学习内容名称不能为空")});
    });
    if(config.gameQuest!=null&&!record(config.gameQuest))fail("游戏配置无效");
    if(config.gameQuest?.games!=null)records(config.gameQuest.games,"游戏",null,{legacy});
    if(record(config.gameQuest?.boards)){
      ["daily","weekly"].forEach(board=>{
        Object.values(config.gameQuest.boards[board]||{}).forEach(items=>records(items,"游戏 "+board,null,{legacy}));
      });
    }
    if(config.cloudGameConfig!=null){
      if(!record(config.cloudGameConfig))fail("游戏云端配置格式无效");
      for(const [name,key] of [["policies","game_key"],["operations","task_key"]]){
        const rows=config.cloudGameConfig[name];if(rows==null)continue;
        if(!Array.isArray(rows)||rows.some(r=>!record(r)||!nonempty(r[key])))fail("游戏云端 "+name+" 格式无效");
        if(new Set(rows.map(r=>r[key])).size!==rows.length)fail("游戏云端 "+name+" 存在重复 ID");
      }
    }
    if(config.fitness!=null&&!record(config.fitness))fail("生活改善配置无效");
    if(config.fitness?.sections!=null)records(config.fitness.sections,"生活分区",null,{legacy});
    Object.values(config.fitness?.days||{}).forEach(day=>Object.values(day||{}).forEach(items=>{
      if(Array.isArray(items)&&items.every(record))records(items,"生活行动",null,{legacy});
    }));
    if(config.refs!=null)records(config.refs,"资料分组",group=>records(group.items||[],"资料条目",null,{legacy}),{legacy});
    return config;
  }

  function exportConfig(config){
    const {tasks,refs,gameQuest,fitness,sequences,settings,schedules,schemaVersion,cloudGameConfig,...compatibility}=copy(config);
    return {kind:"taskring-config",schemaVersion:VERSION,tasks,modules:{gameQuest,fitness},
      schedules:schedules||{},sequences:sequences||{},references:refs||[],settings:settings||{},
      sourceMappings:{local:"supabase:public.taskring_workspace",gameRoutines:"supabase:public.game_routine_tasks",gamePolicies:"supabase:public.game_play_policies",gameOps:"supabase:public.game_ops_tasks"},...(cloudGameConfig?{cloudGameConfig}:{}),compatibility};
  }

  function decode(input){
    if(!record(input))fail("请选择一个 TaskRing JSON 对象");
    const snapshot=input.kind==="taskring-backup"?input:null;
    const envelope=snapshot?snapshot.configuration:input;
    if(!record(envelope))fail("备份中未找到配置");
    let config;
    if(envelope.kind==="taskring-config"){
      if(envelope.schemaVersion!==VERSION||snapshot&&snapshot.schemaVersion!==VERSION)fail("当前版本无法读取此备份版本");
      if(!record(envelope.modules)||!record(envelope.modules.gameQuest)||!record(envelope.modules.fitness)||!Array.isArray(envelope.references)||
        !record(envelope.sequences)||!record(envelope.settings)||!record(envelope.schedules))fail("统一配置缺少必要分区");
      if(envelope.sourceMappings?.gameOps&&envelope.sourceMappings.gameOps!=="supabase:public.game_ops_tasks")fail("游戏云端数据源和当前站点不一致");
      config={...envelope.compatibility,schemaVersion:VERSION,tasks:envelope.tasks,
        gameQuest:envelope.modules.gameQuest,fitness:envelope.modules.fitness,refs:envelope.references,
        sequences:envelope.sequences,settings:envelope.settings,schedules:envelope.schedules,...(envelope.cloudGameConfig?{cloudGameConfig:envelope.cloudGameConfig}:{})};
    }else if(!envelope.kind&&[1,2,3,4].includes(envelope.version)&&Array.isArray(envelope.tasks)
      &&record(envelope.gameQuest)&&record(envelope.fitness)&&Array.isArray(envelope.refs)){
      config=copy(envelope);
    }else fail("请选择完整的 TaskRing 配置或备份");
    validateConfig(config,!envelope.kind);
    if(snapshot){
      if(!record(snapshot.execution)||!record(snapshot.execution.states)||!record(snapshot.execution.state_meta)||
        !Array.isArray(snapshot.execution.time_logs)||!record(snapshot.execution.time_logs_deleted))fail("备份中的执行历史格式不完整");
      if(Object.entries(snapshot.execution.states).some(([key,value])=>!key.startsWith("taskring_github_v2_")||value!=="1"))fail("备份包含无效的执行状态");
      if(Object.entries(snapshot.execution.state_meta).some(([key,value])=>!key.startsWith("taskring_github_v2_")||!record(value)||!["0","1"].includes(value.value)))fail("备份包含无效的状态记录");
    }
    return {config,execution:snapshot?.execution||null};
  }

  function inventory(config){
    const all={};
    function add(id,value){all[id]=value}
    (config.tasks||[]).forEach(task=>add(E.id("task",task.id),task));
    ["daily","weekly"].forEach(board=>Object.entries(config.gameQuest?.boards?.[board]||{}).forEach(([game,items])=>
      items.forEach(item=>add(E.id("game",board,game,item.id),item))));
    Object.entries(config.fitness?.days||{}).forEach(([day,sections])=>Object.entries(sections).forEach(([section,items])=>
      items.forEach(item=>add(E.id("fitness",day,section,item.id),item))));
    E.TRACKS.forEach(track=>(config.sequences?.[track]?.items||[]).forEach(item=>add(E.id("learning",track,item.id),item)));
    return all;
  }

  function difference(current,candidate,fingerprint=JSON.stringify){
    const before=inventory(current),after=inventory(candidate);
    const keys=Object.keys(after),beforeKeys=Object.keys(before);
    const added=keys.filter(key=>!before[key]),removed=beforeKeys.filter(key=>!after[key]);
    const changed=keys.filter(key=>before[key]&&fingerprint(before[key])!==fingerprint(after[key]));
    return {before:beforeKeys.length,after:keys.length,added,removed,changed};
  }

  return {VERSION,validateConfig,exportConfig,decode,inventory,difference};
});
