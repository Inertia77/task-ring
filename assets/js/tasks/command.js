(function(){
  "use strict";

  const E=window.TaskRingTasks,S=window.TaskRingTaskSources,C=window.TaskRingTaskConfig;
  const names={tasks:"每日",weekly:"周计划",game:"游戏",learning:"学习",fitness:"生活改善"};
  const esc=escapeHtml,date=()=>ymd(operationalNow);
  const config=()=>taskConfig||loadLocalTaskConfig()||buildDefaultConfig();
  const fingerprint=window.TaskRingIntegrityCore.configFingerprint;
  const shell=document.getElementById("commandCenter");
  const learn=document.getElementById("learningCenter");
  const dialog=document.getElementById("commandDialog");
  const openedDetails=new Set();
  let filter="all",moduleFilter="",statusFilter="",sort="default",rows=new Map(),importPreview=null,editorFingerprint="",weeklyToday=false,formBaseline="";

  const label=(text,input)=>'<label>'+text+input+'</label>';
  const option=(key,text,current)=>'<option value="'+esc(key)+'" '+(key===current?'selected':'')+'>'+esc(text)+'</option>';
  const moduleOptions=()=>E.MODULES.map(key=>option(key,names[key],moduleFilter)).join("");
  const empty=message=>'<p class="commandEmpty">'+message+'</p>';
  const link=(value,name)=>{
    const url=value&&/^https?:\/\//i.test(value)?safeUrl(value):"";
    return url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+name+'</a>':"";
  };
  const todayLabel=()=>date()+" · "+dayName(today);
  function update(host,html){
    if(host.innerHTML===html)return;
    const focus=host.contains(document.activeElement)?document.activeElement:null;
    const key=focus?.dataset.commandFocus;
    host.innerHTML=html;
    if(key)[...host.querySelectorAll("[data-command-focus]")].find(el=>el.dataset.commandFocus===key)?.focus({preventScroll:true});
  }
  function metrics(values){
    const progress=p=>p.total?Math.round(p.done/p.total*100):0;
    const meter=(title,p)=>'<div><span>'+title+'</span><strong>'+p.done+'<small> / '+p.total+'</small></strong>'+
      '<progress aria-label="'+title+'" max="100" value="'+progress(p)+'"></progress></div>';
    return '<div class="commandMetrics">'+meter("必做完成度",values.required)+meter("全部完成度",values.all)+
      '<div><span>今日剩余</span><strong>'+values.remaining+'</strong></div><div><span>截止待处理</span><strong>'+values.deadlines+'</strong></div></div>';
  }
  function deadlineText(row){
    if(!row.deadline?.date)return "";
    const dateText=row.dueToday?"今日截止":row.overdue?"已逾期":"截止 "+row.deadline.date;
    const time=row.deadline.at?new Intl.DateTimeFormat("zh-CN",{timeZone:E.TIME_ZONE,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(row.deadline.at)):"";
    return dateText+(time?" "+time:"")+(row.deadline.precision==="unverified"?"（待核实）":"");
  }
  function card(row,{showSource=true}={}){
    rows.set(row.instanceId,row);
    const d=row.definition,key=esc(row.instanceId),when=deadlineText(row)||(!row.done&&row.overdue?"原定日期已过":"");
    const category=d.category&&d.category!==names[d.module]?d.category:"";
    const condition=row.optional?(d.tier===3?"有余力":d.note?"见备注":"按需安排"):"";
    const details=row.steps?.length||d.note;
    return '<article class="commandCard '+(row.done?'is-done':row.overdue?'is-overdue':'')+'" data-command-row="'+key+'">'+
      '<div class="commandCardMain"><button type="button" class="commandCheck" data-command-toggle="'+key+'" data-command-focus="toggle-'+key+'" aria-pressed="'+!!row.done+'" aria-label="'+esc((row.done?"撤销完成：":"完成：")+d.title)+'" '+(row.canWrite===false?'disabled':'')+'><span aria-hidden="true">'+(row.done?'✓':'')+'</span></button>'+
      '<div><strong>'+esc(d.title)+'</strong><p>'+esc([names[d.module],category,d.tier?"T"+d.tier:"",d.periodLabel,when,condition].filter(Boolean).join(" · "))+'</p></div></div>'+
      '<div class="commandCardActions">'+link(d.url,"打开 ↗")+(showSource?'<button type="button" data-command-source="'+key+'" data-command-focus="source-'+key+'">来源</button>':'')+'</div>'+
      (details?'<details class="commandDetails" data-command-details="'+key+'" '+(openedDetails.has(row.instanceId)?'open':'')+'><summary>'+esc([row.steps?.length?"子任务 "+row.steps.filter(x=>x.done).length+"/"+row.steps.length:"",d.note?"备注":""].filter(Boolean).join(" · "))+'</summary>'+
      (d.note?'<p>'+esc(d.note)+'</p>':'')+(row.steps||[]).map((step,index)=>'<label><input type="checkbox" data-command-step="'+index+'" data-command-focus="step-'+key+'-'+index+'" '+(step.done?'checked':'')+'> '+esc(step.title)+'</label>').join("")+'</details>':'')+'</article>';
  }
  function group(title,items,blank=""){
    if(!items.length&&!blank)return "";
    return '<section class="commandGroup"><h2>'+title+' <small>'+items.length+'</small></h2>'+
      (items.length?'<div class="commandGrid">'+items.map(row=>card(row)).join("")+'</div>':empty(blank))+'</section>';
  }
  function upcoming(){
    const seen=new Set();
    return Array.from({length:7},(_,i)=>E.offset(date(),i+1)).flatMap(day=>{
      const now=Date.parse(day+"T12:00:00+09:00");
      return S.query(day,now).filter(row=>{
        const d=row.definition;
        if(moduleFilter&&moduleFilter!==d.module)return false;
        if(seen.has(row.instanceId)||d.module==="learning"||row.optional)return false;
        if(row.deadline?.date!==day&&row.definition.schedule.date!==day&&!row.planned&&d.source!=="supabase")return false;
        if(d.source==="supabase"&&row.deadline?.date!==day&&d.schedule.start?.date!==day)return false;
        seen.add(row.instanceId);
        return !row.done;
      }).map(row=>({day,row}));
    }).slice(0,15);
  }
  function renderOverview(force=false){
    if(!shell||!taskConfig||(!force&&activeAppView!=="overview"))return;
    const all=S.query(),tally=E.counts(all);
    const cloud=window.TaskRingGameOpsCloud?.commandSnapshot();
    const notices=[!navigator.onLine?"离线 · 本机任务可用":null,
      window.TaskRingIntegrity.hasConfigConflict()?"Gist 配置冲突 · 本机配置保留":null,
      cloud&&cloud.status!=="已同步"?"游戏云端："+cloud.status:null,
      cloud?.error||null].filter(Boolean);
    let shown=all.filter(row=>(!moduleFilter||row.definition.module===moduleFilter)&&
      (statusFilter!=="open"||!row.done)&&(statusFilter!=="done"||row.done));
    if(sort==="module")shown.sort((a,b)=>names[a.definition.module].localeCompare(names[b.definition.module],"zh-CN"));
    const selected=shown.filter(row=>filter==="all"||filter==="required"&&(row.required||row.overdue&&!row.optional)||filter==="optional"&&row.optional);
    const unfinished=selected.filter(row=>!row.done);
    const done=selected.filter(row=>row.done);
    const near=filter==="all"||filter==="upcoming"?upcoming():[];
    const upcomingList=near.map(({day,row})=>'<li><time>'+day.slice(5)+'</time><span>'+esc(row.definition.title)+'</span><small>'+esc(names[row.definition.module])+'</small></li>').join("");
    const running=readActiveTimer();
    update(shell,'<div class="commandHero"><div><div class="commandKicker">COMMAND CENTER</div><h1>任务总览</h1><p>'+todayLabel()+(running?' · '+esc(running.paused?"计时暂停："+running.title:"计时中："+running.title):' · 日本时间')+'</p></div><button type="button" data-command-manage data-command-focus="manage">任务管理</button>'+metrics(tally)+'</div>'+
      '<div class="commandFilters"><div class="commandTabs" role="group" aria-label="总览范围">'+Object.entries({all:"今日全部",required:"今日必做",optional:"有余力",upcoming:"近期"}).map(([key,title])=>
        '<button type="button" aria-pressed="'+(filter===key)+'" data-command-filter="'+key+'" data-command-focus="filter-'+key+'">'+title+'</button>').join("")+'</div>'+
      '<div class="commandSelects"><select aria-label="按模块筛选" data-command-module data-command-focus="module">'+option("","全部模块",moduleFilter)+moduleOptions()+'</select>'+
      '<select aria-label="按完成状态筛选" data-command-status data-command-focus="status">'+option("","全部状态",statusFilter)+option("open","未完成",statusFilter)+option("done","已完成",statusFilter)+'</select>'+
      '<select aria-label="排序方式" data-command-sort data-command-focus="sort">'+option("default","默认排序",sort)+option("module","按模块",sort)+'</select></div></div>'+
      (notices.length?'<p class="commandNotice" role="status">'+notices.map(esc).join(' · ')+'</p>':'')+
      (filter==="upcoming"?'<section class="commandGroup"><h2>未来七天</h2>'+(upcomingList?'<ul class="commandUpcoming">'+upcomingList+'</ul>':empty("这段时间没有符合筛选条件的安排。"))+'</section>':
        group("已逾期",unfinished.filter(x=>x.overdue&&!x.optional))+
        group("今日必做",unfinished.filter(x=>x.bucket==="required"&&!x.overdue))+
        group("今日计划",unfinished.filter(x=>x.bucket==="planned"&&!x.overdue))+
        group("临近截止",unfinished.filter(x=>x.bucket==="deadline"&&!x.overdue))+
        group("有余力任务",unfinished.filter(x=>x.optional))+
        (done.length?'<details class="commandGroup commandDone" data-command-details="done-section" '+(openedDetails.has("done-section")||statusFilter==="done"||unfinished.length===0?'open':'')+'><summary>已完成 '+done.length+'</summary><div class="commandGrid">'+done.map(row=>card(row)).join("")+'</div></details>':'')+
        (!selected.length?empty("没有符合当前筛选条件的任务。"):"")+
        (filter==="all"&&upcomingList?'<section class="commandGroup"><h2>近期预览</h2><ul class="commandUpcoming">'+upcomingList+'</ul></section>':'')
      ));
  }

  function renderLearning(){
    if(!learn)return;
    const todayRows=S.query().filter(row=>row.definition.module==="learning");
    const tracks=E.TRACKS.map(track=>{
      const state=S.trackState(track,date()),items=state.config.items;
      const row=todayRows.find(entry=>entry.definition.track===track);
      const history=state.accepted.slice().reverse().map((entry,index)=>
        '<li><time>'+entry.date+'</time><span>'+esc(items.find(item=>item.id===entry.itemId)?.title||"已移除的学习项")+'</span>'+
        (index===0?'<button type="button" data-study-undo="'+track+'" data-command-focus="undo-'+track+'">撤销最后一次</button>':'')+'</li>').join("");
      return '<section class="commandGroup studyTrack"><header><div><h2>'+S.trackTitles[track]+'</h2><p>'+state.accepted.length+' 次完成 · '+(state.config.paused?'已暂停':state.config.end==="loop"?'队列循环':'学完停止')+'</p></div>'+
        '<button type="button" data-study-settings="'+track+'" data-command-focus="settings-'+track+'">轨道设置</button></header>'+
        (row?card(row,{showSource:false}):empty(state.config.paused?"轨道已暂停。":items.length?"当前没有待学内容。":"添加内容后开始学习。"))+
        '<details class="commandGroup" data-command-details="queue-'+track+'" '+(openedDetails.has("queue-"+track)||!items.length?'open':'')+'><summary>课程队列 '+items.length+'</summary>'+
        '<ol class="studyQueue">'+items.map((item,index)=>'<li><span>'+esc(item.title)+(item.enabled===false?' · 停用':'')+'</span><div>'+
          '<button type="button" data-study-edit="'+track+'" data-study-id="'+esc(item.id)+'" data-command-focus="edit-'+esc(item.id)+'">编辑</button>'+
          '<button type="button" data-study-move="-1" data-study-track="'+track+'" data-study-id="'+esc(item.id)+'" aria-label="上移 '+esc(item.title)+'" '+(!index?'disabled':'')+'>↑</button>'+
          '<button type="button" data-study-move="1" data-study-track="'+track+'" data-study-id="'+esc(item.id)+'" aria-label="下移 '+esc(item.title)+'" '+(index===items.length-1?'disabled':'')+'>↓</button></div></li>').join("")+'</ol>'+
        '<button type="button" data-study-edit="'+track+'" data-command-focus="add-'+track+'">添加学习项</button></details>'+
        (history?'<details class="commandGroup" data-command-details="history-'+track+'" '+(openedDetails.has("history-"+track)?'open':'')+'><summary>完成历史 '+state.accepted.length+'</summary><ol class="studyQueue">'+history+'</ol></details>':'')+'</section>';
    });
    update(learn,'<div class="commandHero"><div><div class="commandKicker">LEARNING</div><h1>学习中心</h1><p>每天各一项。完成后，下一项于次日出现。</p></div></div><div class="studyTracks">'+tracks.join("")+'</div>');
  }

  function renderExtra(view){
    const host=document.getElementById("commandExtra-"+view);
    if(!host||activeAppView!==view)return;
    const list=S.query().filter(row=>row.definition.nextSchedule&&row.definition.module===view);
    host.hidden=!list.length;
    update(host,list.length?'<section class="commandGroup"><h2>统一调度</h2><div class="commandGrid">'+list.map(row=>card(row,{showSource:false})).join("")+'</div></section>':"");
  }

  function render(){
    if(!taskConfig)return;
    rows=new Map();
    renderOverview();
    if(activeAppView==="learning")renderLearning();
    renderExtra(activeAppView);
  }
  function onView(view){
    if(view==="overview")window.TaskRingGameOpsCloud?.refreshOverview();
    render();
  }

  function weeklyControls(task){
    const selected=S.plans(task),state=S.weeklyState(task);
    const planned=selected.includes(date());
    return '<div class="commandWeeklyControls">'+
      '<button type="button" data-command-week-today="'+esc(task.id)+'" aria-pressed="'+planned+'">'+(planned?'取消今日安排':'安排到今天')+'</button>'+
      '<button type="button" data-command-week-done="'+esc(task.id)+'" aria-pressed="'+state.done+'">'+(state.done?'撤销本周执行':'标记本周已执行')+'</button>'+
      '<details data-command-details="week-'+esc(task.id)+'" '+(openedDetails.has("week-"+task.id)?'open':'')+'><summary>本周安排'+(selected.length?' · '+selected.map(day=>day.slice(5)).join("、"):'')+'</summary>'+
      '<div class="commandWeekDays">'+Array.from({length:7},(_,i)=>E.offset(cycleYmd,i)).map(day=>'<label><input type="checkbox" data-command-week-day="'+day+'" data-command-week-task="'+esc(task.id)+'" '+(selected.includes(day)?'checked':'')+'> '+dayName(E.weekday(day))+' '+day.slice(5)+'</label>').join("")+'</div></details></div>';
  }

  function goToSource(row){
    const d=row.definition;
    setActiveAppView(d.module);
    let target;
    if(d.nextSchedule)target=[...document.querySelectorAll("[data-command-row]")].find(el=>el.dataset.commandRow===row.instanceId);
    else if(d.module==="game")target=window.TaskRingGameOpsV6.showTask(d.board,d.gameId,d.sourceId,d.tier,d.lane);
    else if(d.module==="weekly"){
      window.TaskRingWeeklySource?.show();
      target=[...document.querySelectorAll("[data-command-week-today]")].find(el=>el.dataset.commandWeekToday===d.sourceId);
    }else if(d.module==="tasks"){
      setDailyViewMode("today");
      target=[...document.querySelectorAll("[data-task]")].find(el=>el.dataset.task===d.sourceId&&el.getClientRects().length);
    }else if(d.module==="fitness"){
      window.TaskRingFitnessTasks.showDay(today);
      target=[...document.querySelectorAll("[data-fitness-item]")].find(el=>el.dataset.fitnessItem===d.sourceId&&el.dataset.fitnessKind===d.kind);
    }else if(d.module==="learning")target=[...learn.querySelectorAll("[data-command-row]")].find(el=>el.dataset.commandRow===row.instanceId);
    for(let parent=target?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==="DETAILS")parent.open=true;
    if(target)requestAnimationFrame(()=>requestAnimationFrame(()=>{
      target.scrollIntoView({block:"center"});
      if(!target.matches("button,input,a"))target.tabIndex=-1;
      target.focus({preventScroll:true});
    }));
  }

  function openDialog(title,html){
    editorFingerprint=fingerprint(config());
    dialog.innerHTML='<header><h2>'+title+'</h2><button type="button" data-command-dismiss aria-label="关闭">×</button></header>'+
      '<div class="commandDialogBody">'+html+'<p class="commandDialogError" role="alert"></p></div>';
    formBaseline=formSignature();
    if(!dialog.open)dialog.showModal();
    dialog.querySelector("input,select,textarea")?.focus();
  }
  function formSignature(){
    const form=dialog.querySelector("form");
    return form?JSON.stringify([...new FormData(form)]):"";
  }
  const dirty=()=>dialog.open&&formSignature()!==formBaseline;
  function dismiss(){
    if(!dirty()||confirm("此表单还有未保存的修改。关闭并放弃修改？"))dialog.close();
  }
  dialog.addEventListener("cancel",event=>{event.preventDefault();dismiss()});
  function dialogError(message){dialog.querySelector(".commandDialogError").textContent=message}

  function saveConfiguration(candidate,reason,guard=editorFingerprint){
    if(guard&&guard!==fingerprint(config()))throw new Error("配置在编辑期间发生变化。请保留本页输入，重新打开编辑器后再应用。");
    C.validateConfig(candidate);
    const latest=loadLocalTaskConfig();
    const stored=latest&&fingerprint(latest);
    if(stored&&stored!==fingerprint(config()))throw new Error("另一标签页已修改配置。刷新后再应用。");
    const before=config();
    if(!pushLocalConfigBackup(before,reason))throw new Error("无法建立本机回滚点，配置未保存。");
    const saved=saveLocalTaskConfig({...candidate,schemaVersion:C.VERSION,updatedAt:new Date().toISOString()},reason);
    applyTaskConfig(saved,true);
    if(ghToken()&&navigator.onLine){
      setGhStatus("GitHub：保存配置中","sync");
      window.TaskRingIntegrity.patchConfig(saved).then(()=>setGhStatus("GitHub：已同步","on"),()=>{
        setGhStatus("GitHub：配置未同步","err");renderOverview();
      });
    }
    return saved;
  }

  function taskManager(){
    const list=(config().tasks||[]);
    openDialog("任务管理",'<div class="commandManagerActions"><button type="button" data-command-edit="">新建任务</button>'+
      '<button type="button" data-command-json>统一 JSON</button><button type="button" data-command-domain="game">游戏配置</button>'+
      '<button type="button" data-command-domain="fitness">生活配置</button><button type="button" data-command-domain="learning">学习队列</button></div>'+
      label("查找任务",'<input type="search" data-command-task-search placeholder="按名称筛选">')+
      '<ul class="commandManagerList">'+list.map(t=>'<li data-command-manager-task="'+esc(t.title)+'"><span>'+esc(t.title)+(t.enabled===false?' · 停用':'')+'</span>'+
        '<small>'+names[t.nextModule||(isWeeklyPoolTask(t)?"weekly":"tasks")]+'</small><button type="button" data-command-edit="'+esc(t.id)+'">编辑</button></li>').join("")+'</ul>');
  }

  const types={DAILY:"每天",WEEKDAY:"指定星期",WEEKLY:"每周",ONE_TIME:"单次",SCHEDULED:"指定日期",DEADLINE:"截止型",RECURRING:"自定义周期",OPTIONAL:"有余力"};
  function openTaskForm(id){
    const t=taskById(id)||{};
    if(t.id&&!t.nextSchedule){
      dialog.close();openTaskEditor();
      const row=[...document.querySelectorAll("#taskEditorList .cfgTask")].find(el=>el.dataset.id===t.id);
      if(row){row.open=true;row.querySelector(".cfgTitle")?.focus();}
      return;
    }
    const schedule=t.nextSchedule||{type:"SCHEDULED",date:date(),missed:"KEEP"};
    const input=(key,value,type="text",attr="")=>'<input name="'+key+'" type="'+type+'" value="'+esc(value||"")+'" '+attr+'>';
    openDialog(t.id?"编辑任务":"新建任务",'<form data-command-task-form="'+esc(id)+'" class="commandForm">'+
      label("任务名称",input("title",t.title,"text","required maxlength=220"))+
      label("所属模块",'<select name="module">'+Object.keys(names).filter(key=>key!=="learning").map(key=>option(key,names[key],t.nextModule||"tasks")).join("")+'</select>')+
      label("分类",'<select name="category">'+timeCategoryOrder.map(key=>option(key,timeCategoryLabel(key),t.time_category||"life")).join("")+'</select>')+
      label("执行周期",'<select name="type">'+Object.entries(types).map(([key,value])=>option(key,value,schedule.type)).join("")+'</select>')+
      label("安排日期",input("date",schedule.date,"date"))+
      label("开始日期",input("start",schedule.start?.date,"date"))+
      label("开始时刻（日本时间，可留空）",input("startTime",schedule.start?.at?schedule.start.at.slice(11,16):"","time"))+
      label("截止日期",input("due",schedule.due?.date,"date"))+
      label("截止时刻（日本时间，可留空）",input("dueTime",schedule.due?.at?schedule.due.at.slice(11,16):"","time"))+
      label("未完成处理",'<select name="missed">'+option("RESET","按周期重置",schedule.missed)+option("KEEP","保留待办",schedule.missed)+option("EXPIRE","期限后收起",schedule.missed)+'</select>')+
      label("优先级",'<select name="priority">'+option("0","正常",String(t.nextPriority||0))+option("1","较高",String(t.nextPriority||0))+option("2","优先",String(t.nextPriority||0))+'</select>')+
      label("链接",input("url",t.url,"url"))+
      label("重复间隔（天）",input("interval",schedule.intervalDays||7,"number","min=1 max=3650"))+
      '<fieldset class="commandWeekDays"><legend>指定星期</legend>'+[1,2,3,4,5,6,0].map(day=>'<label><input type="checkbox" name="days" value="'+day+'" '+(schedule.days?.includes(day)?'checked':'')+'> '+dayName(day)+'</label>').join("")+'</fieldset>'+
      label("备注",'<textarea name="note">'+esc(t.note)+'</textarea>')+
      label("子任务（每行一项）",'<textarea name="steps">'+esc((t.steps||[]).map(s=>s.title).join("\n"))+'</textarea>')+
      '<div class="commandChecks"><label><input type="checkbox" name="required" '+(!t.optional?'checked':'')+'> 必做</label><label><input type="checkbox" name="showToday" '+(schedule.showToday?'checked':'')+'> 显示在今日</label>'+
      '<label><input type="checkbox" name="enabled" '+(t.enabled!==false?'checked':'')+'> 启用</label></div>'+
      '<footer><button type="submit">保存任务</button></footer></form>');
  }

  function submitTask(form){
    const f=new FormData(form),get=key=>String(f.get(key)||"").trim(),old=taskById(form.dataset.commandTaskForm);
    const current=config(),type=get("type");
    function timeLimit(key){
      const day=get(key),time=get(key+"Time");
      if(time&&!day)throw new Error("设置时刻时也需要填写日期。");
      return day?time?{date:day,precision:"time",at:day+"T"+time+":00+09:00"}:{date:day,precision:"date"}:null;
    }
    const schedule={type,date:get("date")||null,start:timeLimit("start"),due:timeLimit("due"),missed:get("missed"),
      showToday:f.has("showToday"),mustOnPlan:true,autoEnd:f.has("showToday")};
    if(type==="WEEKDAY")schedule.days=f.getAll("days").map(Number);
    if(type==="RECURRING")Object.assign(schedule,{anchor:get("date"),intervalDays:Number(get("interval"))});
    if(!E.validSchedule(schedule))throw new Error("检查周期、安排日期、开始与截止条件。");
    const used=new Set((old?.steps||[]).map(step=>step.code));
    const previous=(old?.steps||[]).slice();
    const steps=get("steps").split("\n").map(line=>line.trim()).filter(Boolean).map(title=>{
      const index=previous.findIndex(step=>step.title===title);
      if(index>=0)return previous.splice(index,1)[0];
      const code=nextCode("s",used);used.add(code);
      return {id:code,code,title,enabled:true};
    });
    const codes=reservedTaskCodes(current);
    current.tasks.forEach(task=>codes.add(task.code));
    const task={...old,id:old?.id||"next-"+crypto.randomUUID(),code:old?.code||nextCode("t",codes),title:get("title"),
      plan_mode:"weekly",days:old?.days||[],time_category:get("category"),nextModule:get("module"),nextSchedule:schedule,
      nextPriority:Number(get("priority")),optional:!f.has("required"),enabled:f.has("enabled"),url:get("url"),note:get("note"),steps};
    const tasks=old?current.tasks.map(entry=>entry.id===old.id?task:entry):[...current.tasks,task];
    saveConfiguration({...current,tasks},"任务管理：编辑前备份");
    dialog.close();
    showToast("任务已保存到本机","ok",2200);
  }

  function snapshot(){
    return {kind:"taskring-backup",schemaVersion:C.VERSION,createdAt:new Date().toISOString(),configuration:C.exportConfig(config()),
      execution:{states:collectGhLocalStates(),state_meta:window.TaskRingIntegrity.readStateMeta(),
        time_logs:readTimeLogs(),time_logs_deleted:readDeletedTimeLogMap()}};
  }
  function jsonManager(){
    importPreview=null;
    openDialog("统一 JSON",'<div class="commandManagerActions"><button type="button" data-command-export="config">导出配置</button><button type="button" data-command-export="backup">导出完整备份</button></div>'+
      '<p>配置包含所有本机模块。完整备份另含本机完成状态和时间账本。游戏限时与周期任务由 Supabase 管理。</p>'+
      label("选择配置或备份",'<input type="file" accept=".json,application/json" data-command-import>')+
      '<p data-command-import-summary role="status"></p>'+
      '<button type="button" data-command-apply-import disabled>应用导入</button>'+
      (readLocalConfigBackups().length?'<button type="button" data-command-rollback>查看配置回滚点</button>':''));
  }
  function previewJson(value){
    const input=C.decode(value);
    const candidate=normalizeTaskConfig(input.config);
    const current=config(),existing=Object.fromEntries(current.tasks.map(task=>[task.id,task.code]));
    const currentByCode=new Map(current.tasks.map(task=>[task.code,task.id]));
    if(candidate.tasks.some(task=>(Object.hasOwn(existing,task.id)&&existing[task.id]!==task.code)||
      (currentByCode.has(task.code)&&currentByCode.get(task.code)!==task.id)))throw new Error("配置的任务 ID 与本机状态编码冲突。");
    const diff=C.difference(current,candidate,window.TaskRingIntegrityCore.stableStringify);
    importPreview={...input,config:candidate};
    const stateCount=input.execution?Object.keys(input.execution.state_meta).length:0;
    const summary=dialog.querySelector("[data-command-import-summary]");
    summary.textContent="任务 "+diff.before+" → "+diff.after+" · 新增 "+diff.added.length+" · 修改 "+diff.changed.length+" · 移出配置 "+diff.removed.length+
      (input.execution?" · 合并 "+stateCount+" 条状态记录与 "+input.execution.time_logs.length+" 条时间日志":" · 现有完成记录继续保留");
    for(const [title,keys,data] of [["新增",diff.added,C.inventory(candidate)],["修改",diff.changed,C.inventory(candidate)],["移出",diff.removed,C.inventory(current)]]){
      if(!keys.length)continue;
      const details=document.createElement("details"),heading=document.createElement("summary"),list=document.createElement("ul");
      heading.textContent=title+" "+keys.length;
      keys.forEach(key=>{const li=document.createElement("li");li.textContent=data[key]?.title||key;list.append(li)});
      details.append(heading,list);summary.append(details);
    }
    dialog.querySelector("[data-command-apply-import]").disabled=false;
  }
  async function readImport(input){
    importPreview=null;
    dialog.querySelector("[data-command-apply-import]").disabled=true;
    dialog.querySelector("[data-command-import-summary]").textContent="";
    dialogError("");
    const file=input.files?.[0];
    if(!file)return;
    if(file.size>12*1024*1024)throw new Error("文件超过 12 MB。请检查是否选择了正确的备份。");
    const value=JSON.parse(await file.text());
    if(input.isConnected&&dialog.open)previewJson(value);
  }
  function applyImport(){
    if(!importPreview)return;
    const {execution}=importPreview;
    if(execution&&!confirm("此操作会按记录版本合并完成历史与时间账本。应用前可下载当前完整备份。继续导入？"))return;
    if(execution)downloadJsonBackupFile("taskring-backup-before-import-"+date()+".json",snapshot());
    saveConfiguration(importPreview.config,"统一 JSON 导入前");
    if(execution){
      window.TaskRingIntegrity.importState(execution);
      mergeGhTimeLogDeletes(execution.time_logs_deleted);
      mergeGhTimeLogs(execution.time_logs);
      renderAll();
      scheduleGhSave();
    }
    dialog.close();
    showToast("已应用 JSON 到本机","ok",2600);
  }
  function showRollback(){
    openDialog("配置回滚",'<p>选择旧配置恢复。本机完成记录与时间日志继续保留。</p><ul class="commandManagerList">'+readLocalConfigBackups().map((backup,index)=>
      '<li><span>'+esc(backup.reason)+' · '+esc(backup.createdAt.slice(0,16).replace("T"," "))+'</span><button type="button" data-command-restore="'+index+'">查看</button></li>').join("")+'</ul>');
  }
  function restorePreview(index){
    const backup=readLocalConfigBackups()[index];
    if(!backup)throw new Error("找不到回滚点");
    jsonManager();
    previewJson(C.exportConfig(backup.config));
  }

  function studyForm(track,id){
    const {config:queue}=S.trackState(track,date()),item=queue.items.find(entry=>entry.id===id)||{};
    openDialog(S.trackTitles[track]+"学习项",'<form class="commandForm" data-study-form="'+track+'" data-study-id="'+esc(id||"")+'">'+
      label("课程名称",'<input required maxlength="220" name="title" value="'+esc(item.title)+'">')+
      label("学习链接",'<input type="url" name="url" value="'+esc(item.url)+'">')+
      label("学习要点",'<textarea name="note">'+esc(item.note)+'</textarea>')+
      '<label><input type="checkbox" name="enabled" '+(item.enabled!==false?'checked':'')+'> 启用</label>'+
      '<footer><button type="submit">保存学习项</button></footer></form>');
  }
  function updateTrack(track,queue,guard=editorFingerprint){
    saveConfiguration({...config(),sequences:{...config().sequences,[track]:queue}},"学习队列修改前",guard);
  }
  function studySettings(track){
    const queue=S.trackState(track,date()).config;
    openDialog(S.trackTitles[track]+"轨道设置",'<form class="commandForm" data-study-track-form="'+track+'">'+
      label("学完之后",'<select name="end">'+option("stop","停止",queue.end)+option("loop","从头循环",queue.end)+'</select>')+
      '<label><input type="checkbox" name="paused" '+(queue.paused?'checked':'')+'> 暂停此轨道</label>'+
      '<footer><button type="submit">保存设置</button></footer></form>');
  }
  function saveStudy(form){
    const track=form.dataset.studyForm||form.dataset.studyTrackForm;
    const {config:queue}=S.trackState(track,date()),f=new FormData(form);
    if(form.dataset.studyTrackForm)updateTrack(track,{...queue,paused:f.has("paused"),end:f.get("end")});
    else{
      const original=queue.items.find(item=>item.id===form.dataset.studyId);
      const title=String(f.get("title")).trim();
      if(!title)throw new Error("请填写课程名称");
      const item={...original,id:original?.id||crypto.randomUUID(),title,url:String(f.get("url")).trim(),
        note:String(f.get("note")).trim(),enabled:f.has("enabled")};
      const items=original?queue.items.map(entry=>entry.id===original.id?item:entry):[...queue.items,item];
      updateTrack(track,{...queue,items});
    }
    dialog.close();
  }

  function click(event){
    const el=event.target.closest("button");
    if(!el)return;
    const d=el.dataset;
    if(d.commandToggle){
      const row=rows.get(d.commandToggle);
      if(!row?.set||row.canWrite===false)return;
      if(activeAppView==="overview"&&!row.done)openedDetails.add("done-section");
      row.set(!row.done,el);
    }else if(d.commandFilter){filter=d.commandFilter;renderOverview();}
    else if(d.commandSource){const row=rows.get(d.commandSource);if(row)goToSource(row);}
    else if(d.commandManage!==undefined){closeControlCenter();taskManager();}
    else if(d.commandEdit!==undefined)openTaskForm(d.commandEdit);
    else if(d.commandJson!==undefined){closeControlCenter();jsonManager();}
    else if(d.commandDismiss!==undefined)dismiss();
    else if(d.commandExport){const value=d.commandExport==="backup"?snapshot():C.exportConfig(config());downloadJsonBackupFile("taskring-"+d.commandExport+"-"+date()+".json",value);}
    else if(d.commandApplyImport!==undefined)applyImport();
    else if(d.commandRollback!==undefined)showRollback();
    else if(d.commandRestore!==undefined)restorePreview(Number(d.commandRestore));
    else if(d.commandDomain){
      dialog.close();
      if(d.commandDomain==="game")openGameQuestEditor();
      if(d.commandDomain==="fitness")document.getElementById("controlFitnessEditorBtn")?.click();
      if(d.commandDomain==="learning")setActiveAppView("learning");
    }else if(d.commandWeekToday){
      const task=taskById(d.commandWeekToday);
      if(task)S.setPlan(task,date(),!S.plans(task).includes(date()));
    }else if(d.commandWeekDone){
      const task=taskById(d.commandWeekDone);
      if(task){const state=S.weeklyState(task);state.set(!state.done);}
    }else if(d.commandWeekFilter!==undefined){
      weeklyToday=!weeklyToday;renderAll(["weekly"]);
    }else if(d.studySettings)studySettings(d.studySettings);
    else if(d.studyEdit)studyForm(d.studyEdit,d.studyId);
    else if(d.studyMove){
      const track=d.studyTrack,{config:queue}=S.trackState(track,date());
      const items=queue.items.slice(),index=items.findIndex(item=>item.id===d.studyId);
      if(index<0||!items[index+Number(d.studyMove)])return;
      const [item]=items.splice(index,1);items.splice(index+Number(d.studyMove),0,item);
      updateTrack(track,{...queue,items},"");
    }else if(d.studyUndo){
      const track=d.studyUndo,last=S.trackState(track,date()).accepted.at(-1);
      if(last&&(last.date===date()||confirm("撤销 "+last.date+" 的完成记录，并回到这项学习内容？")))
        S.setLearning(track,last.ordinal,last.itemId,last.date,false);
    }
  }

  document.addEventListener("click",event=>{
    try{click(event);}catch(err){if(dialog.open)dialogError(err.message);else showToast(err.message,"err",3600);}
  });
  document.addEventListener("change",event=>{
    const el=event.target,d=el.dataset;
    if(d.commandImport!==undefined){readImport(el).catch(err=>{if(el.isConnected)dialogError(err.message)});return;}
    if(d.commandModule!==undefined){moduleFilter=el.value;renderOverview();}
    if(d.commandStatus!==undefined){statusFilter=el.value;renderOverview();}
    if(d.commandSort!==undefined){sort=el.value;renderOverview();}
    if(d.commandStep!==undefined){
      const row=rows.get(el.closest("[data-command-row]")?.dataset.commandRow);
      row?.steps?.[Number(d.commandStep)]?.set(el.checked,el);
    }
    if(d.commandWeekDay){
      const task=taskById(d.commandWeekTask);
      if(task)S.setPlan(task,d.commandWeekDay,el.checked);
    }
  });
  document.addEventListener("input",event=>{
    const search=event.target;
    if(!search.matches("[data-command-task-search]"))return;
    for(const item of dialog.querySelectorAll("[data-command-manager-task]"))item.hidden=!item.dataset.commandManagerTask.toLowerCase().includes(search.value.toLowerCase());
  });
  document.addEventListener("submit",event=>{
    const form=event.target;
    if(!form.matches("[data-command-task-form],[data-study-form],[data-study-track-form]"))return;
    event.preventDefault();
    try{if(form.matches("[data-command-task-form]"))submitTask(form);else saveStudy(form);}catch(err){dialogError(err.message);}
  });
  document.addEventListener("toggle",event=>{
    const key=event.target.dataset?.commandDetails;
    if(!key||!event.target.isConnected)return;
    if(event.target.open)openedDetails.add(key);else openedDetails.delete(key);
  },true);
  addEventListener("offline",()=>renderOverview());
  addEventListener("online",()=>renderOverview());
  addEventListener("taskring-game-policy-changed",()=>renderOverview());
  addEventListener("storage",event=>{
    if(event.key===TASK_CONFIG_LOCAL_KEY&&event.newValue)applyLocalConfigIfAny();
    if(event.key===TASK_CONFIG_LOCAL_KEY||event.key?.startsWith(GH_PREFIX)||event.key===window.TaskRingIntegrity.stateMetaKey)renderAll();
  });

  window.TaskRingCommand={render,renderOverview,onView,weeklyControls,dirty,weekTodayOnly:()=>weeklyToday,resetWeekFilter:()=>{weeklyToday=false},exportConfig:()=>C.exportConfig(config())};
  render();
})();
