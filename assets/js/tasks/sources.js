(function(){
  "use strict";

  const E=window.TaskRingTasks, stores=window.TaskRingIntegrity;
  const keyDone=key=>localStorage.getItem(key)==="1";
  let stateMeta={};
  const schedules={daily:{type:"DAILY"},weekly:{type:"WEEKLY"},one:{type:"ONE_TIME"}};
  const trackTitles={LANGUAGE:"语言",KNOWLEDGE:"知识"};
  const weeklyKey=(t,cycle)=>GH_PREFIX+cycle+"_"+t.code+"_next_week_done";
  const weeklyStepKey=(t,step,cycle)=>GH_PREFIX+cycle+"_"+t.code+"_"+step.code+"_w";
  const planKey=(t,date)=>GH_PREFIX+E.week(date)+"_"+t.code+"_next_plan_"+date;
  const learningKey=(track,ordinal)=>GH_PREFIX+"next_sequence_"+track+"_"+ordinal;
  const windowValue=(date,instant,verified)=>date?{date,precision:verified?(instant?"time":"date"):"unverified",...(verified&&instant?{at:instant}:{})}:null;

  function readLocal(key,set,steps=[]){
    const meta=stateMeta[key];
    return {done:keyDone(key),completedAt:meta?.value==="1"?meta.updatedAt:null,set,steps};
  }
  function legacyDaily(task,date){
    const day=E.weekday(date),cycle=E.week(date);
    if(!task.days.includes(day)||isIgnoredOccurrence(task,day,cycle))return null;
    const key=storageKey(task.id,day,cycle);
    return {
      ...task,id:E.id("task",task.id),sourceId:task.id,module:"tasks",source:"local",
      schedule:task.days.length===7?schedules.daily:{type:"WEEKDAY",days:task.days},
      required:!task.optional,optional:!!task.optional,priority:task.important?2:task.core?1:0,
      read:()=>readLocal(key,(value,el)=>setDone(task.id,day,value,el,true,cycle),(stepTasks[task.id]||[]).map(step=>({
        ...step,done:isStepDone(task.id,step.id,day,cycle),set:(value,el)=>setStepDone(task.id,step.id,day,value,el,cycle)
      })))
    };
  }
  function weeklyPlan(task,date){
    const cycle=E.week(date);
    return {
      ...task,id:E.id("task",task.id),sourceId:task.id,module:"weekly",source:"local",
      schedule:schedules.weekly,plannedDates:keyDone(planKey(task,date))?[date]:[],
      required:false,optional:!!task.optional,priority:task.important?2:0,
      read:()=>weeklyState(task,cycle)
    };
  }
  function weeklyState(task,cycle=cycleYmd){
    const key=weeklyKey(task,cycle);
    const steps=(stepTasks[task.id]||[]).map(step=>({...step,done:keyDone(weeklyStepKey(task,step,cycle)),set(value){
      syncSetItem(weeklyStepKey(task,step,cycle),value);renderAll(["weekly"]);
    }}));
    return readLocal(key,value=>{
      syncSetItem(key,value);
      renderAll(["weekly"]);
    },steps);
  }
  function plans(task,cycle=cycleYmd){
    return Array.from({length:7},(_,i)=>E.offset(cycle,i)).filter(date=>keyDone(planKey(task,date)));
  }
  function setPlan(task,date,value){
    if(!E.validDate(date)||E.week(date)!==cycleYmd)return false;
    syncSetItem(planKey(task,date),value);renderAll(["weekly"]);
    return true;
  }
  function nativeTask(task){
    const module=task.nextModule||"tasks";
    return {
      ...task,id:E.id("task",task.id),sourceId:task.id,module,source:"local",
      schedule:task.nextSchedule,required:!task.optional,optional:!!task.optional,
      priority:task.nextPriority??(task.important?2:0),
      read({period}){
        const prefix=GH_PREFIX+"next_task_"+task.code+"|"+period;
        const steps=(task.steps||[]).filter(step=>step.enabled!==false);
        const change=(key,value)=>syncSetItem(key,value);
        return readLocal(prefix,value=>{
          change(prefix,value);steps.forEach(step=>change(prefix+"|"+step.code,value));renderAll();
        },steps.map(step=>({...step,done:keyDone(prefix+"|"+step.code),set(value){
          change(prefix+"|"+step.code,value);
          change(prefix,steps.every(entry=>keyDone(prefix+"|"+entry.code)));renderAll();
        }})));
      }
    };
  }
  function fitness(date){
    const source=window.TaskRingFitnessTasks,day=E.weekday(date),cycle=E.week(date);
    return (source?.itemsForDay(day)||[]).filter(item=>!["indicator","reference","record"].includes(item.kindOfContent))
      .map(item=>({
        ...item,id:E.id("fitness",item.kind,item.id),sourceId:item.id,source:"local",module:"fitness",
        schedule:{type:"WEEKDAY",days:[day]},required:!item.optional,optional:item.optional,category:item.section.name,
        read:()=>readLocal(source.doneKey(day,item.kind,item.id,cycle),(value,el)=>source.setItemDone(day,item.kind,item.id,value,el))
      }));
  }
  function games(date){
    return (window.TaskRingGameOpsV6?.commandTasks()||[]).map(g=>{
      const daily=g.board==="daily",waiting=g.lane==="wait";
      return {
        ...g.task,id:E.id("game",g.board,g.game.id,g.task.id),sourceId:g.task.id,source:"local",
        module:"game",gameId:g.game.id,tier:g.tier,board:g.board,lane:g.lane,category:g.game.name,
        note:[g.task.note,waiting?g.task.unlock_hint:null].filter(Boolean).join("\n"),
        schedule:daily?schedules.daily:{type:"WEEKLY",autoEnd:!waiting},
        required:g.required&&!waiting,optional:!g.required,
        read:()=>date===ymd(operationalNow)?readLocal(g.key,g.set):{}
      };
    });
  }
  function cloud(){
    const cloud=window.TaskRingGameOpsCloud,core=window.TaskRingOpsCore;
    return (cloud?.commandSnapshot().rows||[]).flatMap(({row,tier})=>{
      const done=row.user_action==="DONE";
      const start=core.taskStartDay(row),due=core.taskEndDay(row),verified=row.verification==="CONFIRMED";
      const preciseEnd=row.deadline_date?null:core.deadline(row);
      // An unconfirmed upstream opening with no date remains in the source board.
      if(!start&&row.lifecycle_status==="UPCOMING"&&!done)return [];
      const opening=windowValue(start,row.open_date?null:row.open_at,verified);
      const deadline=windowValue(due,preciseEnd,verified);
      return [{
        id:E.id("supabase",row.id),sourceId:row.id,sourceKey:row.task_key,source:"supabase",module:"game",
        title:row.task_name,category:core.games[row.game],tier,board:"hub",url:row.source_url,note:row.notes,
        periodLabel:row.period,priority:row.priority==="HIGH"?2:0,required:tier!==3&&verified,optional:tier===3,
        schedule:{type:due?"DEADLINE":"ONE_TIME",start:opening,due:deadline,showToday:done,missed:"KEEP"},
        calendarWindow:true,completedToday:done,
        read:()=>({done,completedAt:row.archived_at,canWrite:cloud.commandSnapshot().canWrite,
          set:value=>cloud.commandSetDone(row.id,value)})
      }];
    });
  }
  function trackState(track,date){
    const config=taskConfig?.sequences?.[track]||E.emptyTrack();
    const prefix=learningKey(track,"");
    const events=Object.entries(stores?.readStateMeta()||{}).flatMap(([key,record])=>{
      if(!key.startsWith(prefix)||!record.sequence||record.value!=="1")return [];
      const raw=key.slice(prefix.length);
      return /^\d+$/.test(raw)?[{ordinal:Number(raw),...record.sequence,completedAt:record.updatedAt}]:[];
    });
    return {config,...E.sequence(config,events,date),events};
  }
  function setLearning(track,ordinal,itemId,date,value){
    const state=trackState(track,ymd(operationalNow));
    if(value&&(!state.current||state.ordinal!==ordinal||state.current.id!==itemId||state.done||date!==ymd(operationalNow)))return;
    const last=state.accepted.at(-1);
    if(!value&&(last?.ordinal!==ordinal||last.itemId!==itemId||state.events.some(event=>event.ordinal>ordinal)))return;
    syncSetItem(learningKey(track,ordinal),value,{itemId,date});
    renderAll();
  }
  function learning(date){
    return E.TRACKS.flatMap(track=>{
      const state=trackState(track,date),item=state.current;
      if(!item)return [];
      return [{
        ...item,id:E.id("learning",track,item.id),sourceId:item.id,source:"local",module:"learning",
        track,category:trackTitles[track],schedule:{type:"SEQUENCE",period:state.ordinal},
        required:true,read:()=>({done:state.done,completedAt:state.done?state.accepted.at(-1)?.completedAt:null,
          set:value=>setLearning(track,state.ordinal,item.id,date,value)})
      }];
    });
  }

  function definitions(date){
    return [
      ...ringBlocks().map(task=>legacyDaily(task,date)).filter(Boolean),
      ...weeklyPoolBlocks().map(task=>weeklyPlan(task,date)),
      ...(taskConfig?.tasks||[]).filter(task=>task.nextSchedule&&E.validSchedule(task.nextSchedule)).map(nativeTask),
      ...fitness(date),...games(date),...cloud(),...learning(date)
    ];
  }

  function query(date=ymd(operationalNow),now=Date.now()){
    stateMeta=stores?.readStateMeta()||{};
    return E.query(definitions(date),date,row=>row.definition.read(row),now);
  }

  window.TaskRingTaskSources={query,definitions,plans,setPlan,weeklyState,trackState,setLearning,trackTitles};
})();
