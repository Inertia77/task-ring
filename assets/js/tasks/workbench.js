/* TaskRing full-screen edit workbench. Draft-only operations until explicit save.
   Existing config IDs, unknown properties, completion state and Supabase remain untouched. */
(function(){
  "use strict";
  const root=document.getElementById("taskWorkbench");
  if(!root)return;
  const C=window.TaskRingTaskConfig;
  const domains=[
    ["tasks","每日任务","check-square"],["weekly","周计划","calendar-days"],
    ["game","游戏作战区","sparkles"],["learning","学习中心","book-open"],
    ["fitness","生活改善","sprout"],["refs","资料库","files"]
  ];
  const dayNames={1:"周一",2:"周二",3:"周三",4:"周四",5:"周五",6:"周六",0:"周日"};
  const days=[1,2,3,4,5,6,0];
  const labels={tasks:"每日任务",weekly:"周计划",game:"游戏作战区",learning:"学习中心",fitness:"生活改善",refs:"资料库"};
  const enc=value=>String(value==null?"":value);
  const esc=value=>enc(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const uuid=()=>crypto.randomUUID();
  const fingerprint=value=>window.TaskRingIntegrityCore.configFingerprint(value);
  const kindName={task:"统一任务",gameMeta:"游戏配置",gameTask:"游戏任务",lifeSection:"改善分区",lifeTask:"生活行动",studySettings:"轨道设置",studyItem:"学习内容",refGroup:"资料分组",refItem:"资料条目"};
  let draft=null,base="",domain="tasks",selected="",screen="list",keyword="",groupFilter="all",scope="all",notice="",busy=false,legacyBypass=false,returnFocus=null;
  let refs=new Map();
  function storedConfig(){return window.TaskRingCommand?.getWorkbenchConfig?.()}
  function isDirty(){return !!draft&&fingerprint(draft)!==base}
  function idCode(prefix,values,length){
    const used=new Set(values.filter(Boolean).map(String));
    for(let i=1;i<100000;i++){const value=prefix+String(i).padStart(length,"0");if(!used.has(value))return value;}
    throw Error("无法生成唯一状态编码");
  }
  function area(task){
    if(["tasks","weekly","game","fitness"].includes(task.nextModule))return task.nextModule;
    return task.plan_mode==="weekly"?"weekly":"tasks";
  }
  function ensure(){
    draft.tasks ||= [];
    draft.gameQuest ||= {version:6,games:[],boards:{daily:{},weekly:{}}};
    draft.gameQuest.games ||= [];
    draft.gameQuest.boards ||= {};
    draft.gameQuest.boards.daily ||= {};
    draft.gameQuest.boards.weekly ||= {};
    draft.fitness ||= {version:2,sections:[],days:{}};
    draft.fitness.sections ||= [];
    draft.fitness.days ||= {};
    draft.sequences ||= {};
    ["LANGUAGE","KNOWLEDGE"].forEach(track=>{draft.sequences[track] ||= {items:[],paused:false,end:"stop"};});
    draft.refs ||= [];
  }
  function index(){
    refs=new Map();const rows=[];
    function push(kind,mod,group,value,parent,identity=group){
      if(!value||!value.id&&kind!=="studySettings")return;
      const key=kind+":"+mod+":"+identity+":"+value.id;
      const item={key,kind,domain:mod,group,obj:value,parent};
      rows.push(item);refs.set(key,item);
    }
    draft.tasks.forEach(task=>push("task",area(task),task.cat||"普通",task,draft.tasks,"root"));
    const gameName=id=>draft.gameQuest.games.find(game=>game.id===id)?.name||id;
    draft.gameQuest.games.forEach(game=>push("gameMeta","game","游戏设置",game,draft.gameQuest.games,"game-meta"));
    ["daily","weekly"].forEach(board=>{
      Object.entries(draft.gameQuest.boards[board]||{}).forEach(([gameId,items])=>{
        (items||[]).forEach(item=>push("gameTask","game",gameName(gameId)+(board==="daily"?" · 日常":" · 周常"),item,items,gameId+":"+board));
      });
    });
    draft.fitness.sections.forEach(section=>push("lifeSection","fitness","分区管理",section,draft.fitness.sections,"life-section"));
    Object.entries(draft.fitness.days).forEach(([day,groups])=>{
      Object.entries(groups||{}).forEach(([sectionId,items])=>{
        (items||[]).forEach(item=>push("lifeTask","fitness",(dayNames[day]||day)+" · "+(draft.fitness.sections.find(s=>s.id===sectionId)?.name||sectionId),item,items,day+":"+sectionId));
      });
    });
    ["LANGUAGE","KNOWLEDGE"].forEach(track=>{
      const queue=draft.sequences[track];
      const name=track==="LANGUAGE"?"语言":"知识";
      const settings={id:"settings-"+track,track};
      push("studySettings","learning",name+" · 设置",settings,null,track);
      queue.items.forEach(item=>push("studyItem","learning",name,item,queue.items,track));
    });
    draft.refs.forEach(group=>{
      push("refGroup","refs","分组管理",group,draft.refs,"ref-groups");
      (group.items||[]).forEach(item=>push("refItem","refs",group.title,item,group.items,group.id));
    });
    return rows;
  }
  function filtered(){
    const query=keyword.trim().toLocaleLowerCase();
    return index().filter(item=>{
      if(item.domain!==domain)return false;
      if(query&&!(item.obj.title||item.obj.name||item.group||kindName[item.kind]).toLocaleLowerCase().includes(query))return false;
      if(groupFilter!=="all"){
        if(domain==="learning"&&!item.group.startsWith(groupFilter==="LANGUAGE"?"语言":"知识"))return false;
        if(domain==="game"&&item.group!=="游戏设置"&&!item.group.startsWith(groupFilter))return false;
        if(domain==="fitness"&&item.kind==="lifeTask"&&!item.group.startsWith(dayNames[groupFilter]))return false;
      }
      if(domain==="game"&&scope!=="all"&&item.kind==="gameTask"&&!item.group.endsWith(scope==="daily"?"日常":"周常"))return false;
      return true;
    });
  }
  function field(name,title,value,type="text",extra=""){
    return '<label class="wb-field"><span>'+esc(title)+'</span><input name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
  }
  function textarea(name,title,value,rows=3){
    return '<label class="wb-field wb-wide"><span>'+esc(title)+'</span><textarea name="'+esc(name)+'" rows="'+rows+'">'+esc(value)+'</textarea></label>';
  }
  function select(name,title,value,options){
    return '<label class="wb-field"><span>'+esc(title)+'</span><select name="'+esc(name)+'">'+options.map(x=>'<option value="'+esc(x[0])+'" '+(String(value)===String(x[0])?'selected':'')+'>'+esc(x[1])+'</option>').join("")+'</select></label>';
  }
  function check(name,title,checked){
    return '<label class="wb-check"><input type="checkbox" name="'+esc(name)+'" '+(checked?"checked":"")+'><span>'+esc(title)+'</span></label>';
  }
  const ON=[["core","核心保底"],["important","重要"],["normal","普通"],["optional","可选"]];
  function priority(task){return task.optional?"optional":task.core?"core":task.important?"important":"normal"}
  function taskEditor(item){
    const t=item.obj;let h="";
    h+=field("title","任务名称",t.title,"text",'required maxlength="220"');
    h+=select("module","任务所属区域",area(t),domains.filter(x=>["tasks","weekly","game","fitness"].includes(x[0])).map(x=>[x[0],x[1]]));
    h+=select("priority","任务优先级",priority(t),ON);
    h+=field("cat","分类",t.cat||"life");
    h+=field("time_category","计时类别",t.time_category||"life");
    h+=field("estimated_minutes","单次预计时间（分钟）",t.estimated_minutes||0,"number",'min="0"');
    h+=field("weekly_minutes","每周计划时间（分钟）",t.weekly_minutes||0,"number",'min="0"');
    h+=field("url","目标链接",t.url,"url");
    if(area(t)==="game")h+=select("nextGameId","关联游戏",t.nextGameId||"",[["","无"],...draft.gameQuest.games.map(g=>[g.id,g.name])]);
    h+='<fieldset class="wb-wide wb-days"><legend>计划星期</legend>'+days.map(d=>check("day"+d,dayNames[d],(t.days||[]).includes(d))).join("")+'</fieldset>';
    h+=textarea("note","任务备注",t.note,4);
    h+=textarea("steps","子任务（每行一项）",(t.steps||[]).map(s=>s.title).join("\n"),4);
    const s=t.nextSchedule;
    h+='<details class="wb-wide wb-advanced" '+(s?'open':'')+'><summary>统一调度规则（高级）</summary><div class="wb-fields">';
    h+=check("advanced","启用统一调度",!!s);
    h+=select("scheduleType","调度类型",s?.type||"DAILY",[["DAILY","每日"],["WEEKDAY","指定星期"],["WEEKLY","每周"],["ONE_TIME","单次"],["SCHEDULED","指定日期"],["DEADLINE","截止"],["RECURRING","自定义间隔"],["OPTIONAL","有余力"]]);
    h+=field("scheduleDate","指定日期 / 循环起始日",s?.date||s?.anchor||"","date");
    h+=field("scheduleStart","开始日期",s?.start?.date||"","date");
    h+=field("scheduleDue","截止日期",s?.due?.date||"","date");
    h+=select("missed","未完成后",s?.missed||"KEEP",[["KEEP","保留待办"],["RESET","周期重置"],["EXPIRE","到期收起"]]);
    h+=field("interval","循环间隔（天）",s?.intervalDays||7,"number",'min="1" max="3650"');
    h+=check("showToday","在今日展示",!!s?.showToday);
    h+='</div><p>已确认的具体时刻及其他高级属性会保留；若修改日期，则按仅日期精度保存。游戏限时和周期任务仍由 Supabase 管理。</p></details>';
    h+=check("enabled","启用任务",t.enabled!==false);
    return h;
  }
  function editorFields(item){
    const v=item.obj;
    if(item.kind==="task")return taskEditor(item);
    if(item.kind==="gameMeta")return field("name","游戏名称",v.name)+field("short","简称",v.short)+field("priority","显示排序",v.priority||1,"number",'min="1"')+check("enabled","启用游戏",v.enabled!==false);
    if(item.kind==="gameTask"){
      const weekly=item.group.endsWith("周常");
      return field("title","任务名称",v.title,"text",'required maxlength="220"')+field("url","链接",v.url,"url")+
        (weekly?select("weekly_lane","周常优先级",v.weekly_lane||"steady",[["sprint","优先处理"],["steady","正常周常"],["wait","等待条件"],["optional","有余力"]]):
          select("daily_lane","日常优先级",v.daily_lane||"must",[["must","必须完成"],["optional","有余力"]]))+
        (weekly?field("unlock_hint","解锁条件",v.unlock_hint):"")+
        textarea("note","说明 / 备注",v.note,4)+check("enabled","启用此任务",v.enabled!==false);
    }
    if(item.kind==="lifeSection")return field("name","分区名称",v.name)+field("short","分区简称",v.short)+select("accent","颜色",v.accent||"blue",["blue","violet","rose","cyan","slate","green","amber"].map(x=>[x,x]))+textarea("guide","分区指导说明",v.guide,6)+check("enabled","启用分区",v.enabled!==false);
    if(item.kind==="lifeTask")return field("title","行动内容",v.title,"text",'required maxlength="220"')+field("url","关联链接",v.url,"url")+textarea("note","行动说明",v.note,4)+check("optional","可选，不计入必做完成率",v.optional===true)+check("enabled","启用行动",v.enabled!==false);
    if(item.kind==="studySettings"){
      const q=draft.sequences[v.track];
      return '<div class="wb-wide wb-note">完成当天保留当前课程，下一业务日再推进；未完成不跳项，学习历史不会被此编辑器重写。</div>'+
        select("end","队列结束后",q.end,[["stop","停止"],["loop","从头循环"]])+check("paused","暂停学习轨道",q.paused);
    }
    if(item.kind==="studyItem")return field("title","学习内容",v.title,"text",'required maxlength="220"')+field("stage","所属阶段",v.stage)+field("url","课程链接",v.url,"url")+textarea("note","学习要点",v.note,5)+check("enabled","启用课程",v.enabled!==false);
    if(item.kind==="refGroup")return field("title","资料组名称",v.title)+check("enabled","启用资料组",v.enabled!==false);
    if(item.kind==="refItem")return field("title","资料名称",v.title)+field("url","链接",v.url,"url")+check("enabled","启用资料",v.enabled!==false);
    return "";
  }
  function renderToolbar(){
    return '<div class="wb-top"><div class="wb-brand"><span class="wb-kicker">TASKRING / CONFIG STUDIO</span>'+
      '<h1 id="wbTitle">统一编辑工作台</h1><p>按区域浏览与编辑，保存时统一写入 TaskRing 配置</p></div>'+
      '<div class="wb-top-actions"><span class="wb-status '+(isDirty()?"dirty":"")+'" aria-live="polite">'+(isDirty()?"● 有未保存修改":"✓ 已同步到草稿基线")+'</span>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-json-export>JSON 导入 / 导出</button>'+
      '<button type="button" class="wb-btn wb-primary" data-wb-save '+(busy?"disabled":"")+'>保存全部</button>'+
      '<button type="button" class="wb-btn wb-close" data-wb-close aria-label="关闭编辑工作台">×</button></div></div>';
  }
  function renderFilters(){
    let x='<div class="wb-list-head"><h2>'+esc(labels[domain])+'</h2><div class="wb-list-actions"><button type="button" class="wb-btn wb-quiet" data-wb-new>＋ 新增</button>';
    if(domain==="game"||domain==="fitness"||domain==="refs")x+='<button type="button" class="wb-btn wb-subtle" data-wb-new-group>＋ '+(domain==="game"?"游戏":domain==="fitness"?"分区":"分组")+'</button>';
    x+='</div></div><label class="wb-search"><span class="wb-sr">搜索当前区域</span><input type="search" data-wb-search placeholder="搜索名称、分类…" value="'+esc(keyword)+'"></label><div class="wb-filters">';
    if(domain==="game"){
      const opts=[["all","全部游戏"],...draft.gameQuest.games.map(g=>[g.name,g.name])];
      x+=select("groupFilter","游戏",groupFilter,opts)+select("scope","任务类型",scope,[["all","全部"],["daily","日常"],["weekly","周常"]]);
    }else if(domain==="learning")x+=select("groupFilter","轨道",groupFilter,[["all","两条轨道"],["LANGUAGE","语言"],["KNOWLEDGE","知识"]]);
    else if(domain==="fitness")x+=select("groupFilter","星期",groupFilter,[["all","全部星期"],...days.map(d=>[String(d),dayNames[d]])]);
    x+='</div>';
    return x;
  }
  function renderList(){
    const list=filtered();
    let h='<div class="wb-list-items" role="listbox" aria-label="配置项目">';
    let last="";
    list.forEach(item=>{
      if(item.group!==last){h+='<div class="wb-list-group">'+esc(item.group)+'</div>';last=item.group;}
      const title=item.obj.title||item.obj.name||(item.kind==="studySettings"?"轨道设置":"未命名");
      h+='<button type="button" class="wb-list-entry '+(selected===item.key?"selected ":"")+(item.obj.enabled===false?"disabled":"")+'" data-wb-select="'+esc(item.key)+'" role="option" aria-selected="'+(selected===item.key)+'">'+
        '<span class="wb-entry-name">'+esc(title)+'</span><small>'+esc(kindName[item.kind])+(item.obj.enabled===false?" · 已停用":"")+'</small></button>';
    });
    if(!list.length)h+='<p class="wb-empty">这里还没有内容。可以新增，或从其他区域切换过来。</p>';
    return h+'</div><div class="wb-list-foot">'+list.length+' 项 · 所有修改先暂存在本机草稿</div>';
  }
  function renderDetail(){
    const item=refs.get(selected);
    if(!item)return '<div class="wb-empty-detail"><span>✦</span><h2>选择一个项目开始编辑</h2><p>从左侧选择已有任务，或者点击「新增」。</p></div>';
    const obj=item.obj,stable=item.kind==="studySettings"?false:true;
    const title=obj.title||obj.name||(item.kind==="studySettings"?"轨道设置":"未命名");
    const raw=item.kind==="studySettings"?draft.sequences[obj.track]:obj;
    return '<div class="wb-editor-top"><button type="button" class="wb-btn wb-back" data-wb-back>← 返回列表</button>'+
      '<span>'+esc(item.group)+'</span></div>'+
      '<div class="wb-editor-heading"><div><span class="wb-kicker">'+esc(kindName[item.kind])+'</span><h2>'+esc(title)+'</h2></div>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-open-live>查看原模块</button></div>'+
      '<form class="wb-edit-form" data-wb-editor-form data-wb-item="'+esc(item.key)+'"><div class="wb-fields">'+editorFields(item)+'</div></form>'+
      '<details class="wb-raw"><summary>高级 · 查看或编辑此项 JSON</summary><p>仅更改当前项目，ID 与状态编码不可修改；应用到草稿后仍需点击「保存全部」。</p>'+
      '<textarea aria-label="此项原始 JSON" data-wb-raw spellcheck="false">'+esc(JSON.stringify(raw,null,2))+'</textarea>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-apply-raw>应用 JSON 到草稿</button></details>'+
      '<div class="wb-editor-actions">'+(stable?'<button type="button" class="wb-btn wb-quiet" data-wb-duplicate>复制项目</button>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-move="-1">上移</button><button type="button" class="wb-btn wb-quiet" data-wb-move="1">下移</button>':'')+
      ((stable&&"enabled" in obj)?'<button type="button" class="wb-btn wb-warning" data-wb-toggle-enabled>'+(obj.enabled===false?"重新启用":"停用项目")+'</button>':"")+
      '<button type="button" class="wb-btn wb-primary" data-wb-save>保存全部修改</button></div>';
  }
  function render(){
    if(root.hidden||!draft)return;
    ensure();
    index();
    // Keep the current selection when filtering; the search controls only the list.
    root.dataset.screen=screen;
    root.innerHTML=renderToolbar()+'<div class="wb-layout"><nav class="wb-nav" aria-label="编辑区域">'+
      domains.map(([key,name],i)=>'<button type="button" data-wb-domain="'+key+'" class="'+(domain===key?"active":"")+'" aria-current="'+(domain===key?"page":"false")+'"><span class="wb-num">'+String(i+1).padStart(2,"0")+'</span>'+name+'</button>').join("")+
      '<div class="wb-nav-tip">配置与完成记录分开存储。保存草稿不会清空原有打卡。</div></nav>'+
      '<div class="wb-lists">'+renderFilters()+renderList()+'</div><main class="wb-editor" id="wbEditor">'+renderDetail()+'</main></div>'+
      '<div class="wb-feedback" role="status" aria-live="polite">'+esc(notice)+'</div>';
  }
  function current(){return refs.get(selected)}
  function flush(){
    const form=root.querySelector("[data-wb-editor-form]");
    if(!form)return;
    const item=refs.get(form.dataset.wbItem);if(!item)return;
    const e=form.elements,get=name=>e.namedItem(name),text=name=>get(name)?.value??"",has=name=>!!get(name)?.checked;
    const v=item.obj;
    if(item.kind==="task"){
      v.title=text("title").trim();v.url=text("url").trim();v.note=text("note");
      v.cat=text("cat").trim()||"life";v.time_category=text("time_category").trim()||"life";
      v.estimated_minutes=Math.max(0,Number(text("estimated_minutes"))||0);
      v.weekly_minutes=Math.max(0,Number(text("weekly_minutes"))||0);
      v.enabled=has("enabled");
      const p=text("priority");v.core=p==="core"?1:0;v.important=p==="important"?1:0;v.optional=p==="optional";
      v.days=days.filter(day=>has("day"+day));
      const module=text("module");v.plan_mode=module==="weekly"?"weekly":"daily";
      if(v.nextSchedule||module==="game"||module==="fitness")v.nextModule=module;
      else delete v.nextModule;
      if(module==="game")v.nextGameId=text("nextGameId");else if(v.nextGameId)delete v.nextGameId;
      const titles=text("steps").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      const prior=v.steps||[],used=new Set(prior.map(x=>x.code)),allocated=new Set();
      v.steps=titles.map((name,i)=>{
        const existing=prior.find((s,j)=>!allocated.has(j)&&s.title===name);
        let j=existing?prior.indexOf(existing):i<prior.length&&!allocated.has(i)?i:-1;
        if(j>=0){allocated.add(j);return {...prior[j],title:name}}
        const code=idCode("s",[...used],2);used.add(code);
        return {id:code,code,title:name,enabled:true};
      });
      if(has("advanced")){
        const previous=v.nextSchedule||{},type=text("scheduleType");
        const bound=(old,date)=>!date?null:old?.date===date?old:{date,precision:"date"};
        const date=text("scheduleDate"),opts={...previous,type,missed:text("missed"),date:date||null,
          start:bound(previous.start,text("scheduleStart")),due:bound(previous.due,text("scheduleDue")),showToday:has("showToday")};
        if(type==="WEEKDAY")opts.days=v.days.slice();
        if(type==="RECURRING"){opts.anchor=date;opts.intervalDays=Math.max(1,Number(text("interval"))||7)}
        v.nextSchedule=opts;v.nextModule=module;
      }else delete v.nextSchedule;
    }else if(item.kind==="gameMeta"){
      v.name=text("name").trim();v.short=text("short").trim();v.priority=Math.max(1,Number(text("priority"))||1);v.enabled=has("enabled");
    }else if(item.kind==="gameTask"){
      v.title=text("title").trim();v.url=text("url").trim();v.note=text("note");v.enabled=has("enabled");
      if(item.group.endsWith("周常")){v.weekly_lane=text("weekly_lane");v.unlock_hint=text("unlock_hint");}
      else v.daily_lane=text("daily_lane");
    }else if(item.kind==="lifeSection"){
      v.name=text("name").trim();v.short=text("short").trim();v.accent=text("accent");v.guide=text("guide");v.enabled=has("enabled");
    }else if(item.kind==="lifeTask"){
      v.title=text("title").trim();v.url=text("url").trim();v.note=text("note");v.optional=has("optional");v.enabled=has("enabled");
    }else if(item.kind==="studySettings"){
      const q=draft.sequences[v.track];q.end=text("end");q.paused=has("paused");
    }else if(item.kind==="studyItem"){
      v.title=text("title").trim();v.stage=text("stage").trim();v.url=text("url").trim();v.note=text("note");v.enabled=has("enabled");
    }else if(item.kind==="refGroup"){v.title=text("title").trim();v.enabled=has("enabled")}
    else if(item.kind==="refItem"){v.title=text("title").trim();v.url=text("url").trim();v.enabled=has("enabled")}
  }
  function create(kind){
    flush();
    let obj,parent,mod=domain;
    if(kind==="group"&&domain==="game"){
      obj={id:"game-"+uuid(),name:"新游戏",short:"NEW",enabled:true,priority:draft.gameQuest.games.length+1,accent:"cyan",icon:"GQ"};
      parent=draft.gameQuest.games;parent.push(obj);draft.gameQuest.boards.daily[obj.id]=[];draft.gameQuest.boards.weekly[obj.id]=[];
    }else if(kind==="group"&&domain==="fitness"){
      obj={id:"life-"+uuid(),name:"新改善分区",short:"LIFE",icon:"＋",accent:"blue",locked:false,enabled:true};parent=draft.fitness.sections;parent.push(obj);
      days.forEach(day=>{draft.fitness.days[String(day)] ||= {};draft.fitness.days[String(day)][obj.id] ||= []});
    }else if(kind==="group"&&domain==="refs"){
      obj={id:"ref-"+uuid(),title:"新资料组",items:[],enabled:true};parent=draft.refs;parent.push(obj);
    }else if(domain==="tasks"||domain==="weekly"){
      const code=idCode("t",[...draft.tasks.map(t=>t.code),...(draft.retired_task_codes||[])],3);
      obj={id:"wb-"+uuid(),code,title:"新任务",cat:"life",time_category:"life",plan_mode:domain==="weekly"?"weekly":"daily",
        days:days.slice(),enabled:true,optional:false,estimated_minutes:15,weekly_minutes:60,note:"",url:"",steps:[]};
      parent=draft.tasks;parent.push(obj);
    }else if(domain==="game"){
      const game=draft.gameQuest.games.find(g=>g.name===groupFilter)||draft.gameQuest.games[0];
      if(!game){notice="请先新增一个游戏";render();return;}
      const board=scope==="weekly"?"weekly":"daily";
      parent=draft.gameQuest.boards[board][game.id] ||= [];
      obj={id:"wb-game-"+uuid(),title:"新游戏任务",enabled:true,url:"",note:""};
      if(board==="daily")obj.daily_lane="must";else obj.weekly_lane="steady";
      parent.push(obj);
    }else if(domain==="fitness"){
      const section=draft.fitness.sections.find(s=>s.enabled!==false)||draft.fitness.sections[0];
      if(!section){notice="请先新增一个改善分区";render();return;}
      const day=groupFilter!=="all"?groupFilter:String(new Date().getDay());
      draft.fitness.days[day] ||= {};parent=draft.fitness.days[day][section.id] ||= [];
      obj={id:"wb-life-"+uuid(),title:"新生活行动",url:"",note:"",optional:false,enabled:true};parent.push(obj);
    }else if(domain==="learning"){
      const track=groupFilter==="KNOWLEDGE"?"KNOWLEDGE":"LANGUAGE";
      parent=draft.sequences[track].items;
      obj={id:"wb-study-"+uuid(),title:"新学习内容",stage:"",url:"",note:"",enabled:true};parent.push(obj);
    }else if(domain==="refs"){
      const group=draft.refs[0];if(!group){create("group");return;}
      parent=group.items ||= [];
      obj={id:"wb-ref-"+uuid(),title:"新资料",url:"",enabled:true};parent.push(obj);
    }else return;
    index();
    const row=[...refs.values()].find(item=>item.obj===obj);
    selected=row?.key||"";screen="detail";keyword="";groupFilter="all";scope="all";
    notice="已加入草稿 · 尚未保存到正式配置";render();
    root.querySelector('[name="title"],[name="name"]')?.focus();
  }
  function choose(key){
    flush();selected=key;screen="detail";notice="";render();
  }
  function save(){
    if(busy)return;
    flush();
    try{
      C.validateConfig(draft);
      busy=true;
      const saved=window.TaskRingCommand?.saveWorkbenchConfig?.(clone(draft),base);
      if(!saved)throw Error("统一保存接口暂不可用");
      draft=clone(saved);base=fingerprint(saved);
      notice="✓ 已保存到本机配置；如已连接 Gist，将沿用原有同步与冲突保护机制";
      busy=false;render();
    }catch(error){busy=false;notice="保存失败："+String(error?.message||error);render();}
  }
  function close(force=false){
    if(!force){flush();if(isDirty()&&!confirm("还有未保存的编辑草稿。关闭会放弃这些修改，确定关闭吗？"))return false;}
    root.hidden=true;root.innerHTML="";document.body.classList.remove("workbenchOpen");
    draft=null;refs.clear();returnFocus?.focus?.({preventScroll:true});return true;
  }
  function open(next="tasks"){
    if(!root.hidden){flush();domain=labels[next]?next:"tasks";groupFilter="all";scope="all";selected="";screen="list";render();return;}
    const saved=storedConfig();
    if(!saved){window.showToast?.("配置仍在初始化，请稍后重试","warn");return;}
    returnFocus=document.activeElement;
    draft=clone(saved);ensure();base=fingerprint(saved);
    domain=labels[next]?next:"tasks";groupFilter="all";scope="all";keyword="";selected="";screen="list";notice="";busy=false;
    window.closeControlCenter?.();
    root.hidden=false;document.body.classList.add("workbenchOpen");render();
    root.querySelector("[data-wb-domain='"+domain+"']")?.focus({preventScroll:true});
  }
  function duplicate(){
    flush();const item=current();if(!item?.parent)return;
    const copy=clone(item.obj);copy.id="wb-"+uuid();
    if(item.kind==="task"){copy.code=idCode("t",[...draft.tasks.map(t=>t.code),...(draft.retired_task_codes||[])],3);
      const used=new Set();copy.steps=(copy.steps||[]).map(s=>{const code=idCode("s",[...used],2);used.add(code);return {...s,id:code,code}});}
    if(item.kind==="refGroup")copy.items=(copy.items||[]).map(entry=>({...entry,id:"wb-ref-"+uuid()}));
    if(item.kind==="gameMeta"){
      for(const board of ["daily","weekly"]){
        draft.gameQuest.boards[board][copy.id]=(draft.gameQuest.boards[board][item.obj.id]||[]).map(task=>({...task,id:"wb-game-"+uuid()}));
      }
    }
    if(item.kind==="lifeSection"){
      days.forEach(day=>{draft.fitness.days[String(day)] ||= {};
        const existing=draft.fitness.days[String(day)][item.obj.id]||[];
        draft.fitness.days[String(day)][copy.id]=existing.map(task=>typeof task==="string"?task:{...task,id:"wb-life-"+uuid()});
      });
    }
    const at=item.parent.indexOf(item.obj);item.parent.splice(at+1,0,copy);
    index();selected=[...refs.values()].find(x=>x.obj===copy)?.key||"";notice="已复制到草稿";render();
  }
  function move(delta){
    flush();const item=current();if(!item?.parent)return;
    const parent=item.parent,from=parent.indexOf(item.obj),to=from+delta;
    if(from<0||to<0||to>=parent.length)return;
    parent.splice(to,0,parent.splice(from,1)[0]);notice="已调整顺序，尚未保存";render();
  }
  function applyRaw(){
    const item=current();if(!item)return;
    const txt=root.querySelector("[data-wb-raw]")?.value;let next;
    try{next=JSON.parse(txt);if(!next||typeof next!=="object"||Array.isArray(next))throw Error("需要一个 JSON 对象");
      if(item.kind==="studySettings"){
        if(next.items||next.end){if(next.end!=="stop"&&next.end!=="loop")throw Error("结束规则无效");
          if(!Array.isArray(next.items)||next.items.length!==draft.sequences[item.obj.track].items.length)throw Error("轨道设置不能修改课程队列，请在列表编辑课程");
          draft.sequences[item.obj.track]={...draft.sequences[item.obj.track],end:next.end,paused:next.paused};
        }else throw Error("请输入完整轨道设置");
      }else{
        if(next.id!==item.obj.id||("code" in item.obj&&next.code!==item.obj.code))throw Error("不能修改 ID 或状态编码");
        if(item.kind==="gameMeta"&&next.priority!==item.obj.priority&&next.priority==null)throw Error("排序值无效");
        const parent=item.parent,index=parent?.indexOf(item.obj);
        if(index<0)throw Error("找不到原项目");
        parent[index]=next;
      }
      C.validateConfig(draft);notice="JSON 已应用到草稿，仍需保存全部";render();
    }catch(err){notice="JSON 校验失败："+String(err.message||err);root.querySelector(".wb-feedback").textContent=notice;}
  }
  function onClick(event){
    const el=event.target.closest("button");if(!el)return;
    const d=el.dataset;
    if(d.wbDomain){flush();domain=d.wbDomain;selected="";keyword="";groupFilter="all";scope="all";screen="list";render();}
    else if(d.wbSelect){choose(d.wbSelect);}
    else if(d.wbBack!==undefined){flush();screen="list";render();}
    else if(d.wbNew!==undefined)create("item");
    else if(d.wbNewGroup!==undefined)create("group");
    else if(d.wbSave!==undefined)save();
    else if(d.wbClose!==undefined)close();
    else if(d.wbDuplicate!==undefined)duplicate();
    else if(d.wbMove!==undefined)move(Number(d.wbMove));
    else if(d.wbToggleEnabled!==undefined){flush();const item=current();item.obj.enabled=item.obj.enabled===false;notice="已更新启用状态（草稿）";render();}
    else if(d.wbApplyRaw!==undefined)applyRaw();
    else if(d.wbOpenLive!==undefined){
      if(!close())return;
      window.setActiveAppView?.(domain==="refs"?"library":domain);
    }else if(d.wbJsonExport!==undefined){
      if(!close())return;
      window.TaskRingCommand?.openWorkbenchJson?.();
    }
  }
  root.addEventListener("click",onClick);
  root.addEventListener("input",event=>{
    const el=event.target;
    if(el.matches("[data-wb-search]")){
      keyword=el.value;
      const list=filtered();
      const box=root.querySelector(".wb-list-items");
      if(!box)return;
      // Re-render just the list without stealing search focus.
      const originalSelected=selected;
      const text=list.map(item=>'<button type="button" class="wb-list-entry '+(originalSelected===item.key?"selected":"")+'" data-wb-select="'+esc(item.key)+'"><span class="wb-entry-name">'+esc(item.obj.title||item.obj.name||"轨道设置")+'</span><small>'+esc(item.group)+'</small></button>').join("");
      box.innerHTML=text||'<p class="wb-empty">没有匹配项目</p>';
    }else if(el.closest("[data-wb-editor-form]")){
      const badge=root.querySelector(".wb-status");
      if(badge){badge.textContent="● 正在编辑草稿";badge.classList.add("dirty");}
    }
  });
  root.addEventListener("change",event=>{
    const el=event.target;
    if(el.name==="groupFilter"||el.name==="scope"){
      flush();if(el.name==="groupFilter")groupFilter=el.value;else scope=el.value;render();
    }
  });
  root.addEventListener("keydown",event=>{
    if(event.key==="Escape"){event.preventDefault();close();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();save();return;}
    if(event.key!=="Tab")return;
    const focusable=[...root.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary")].filter(el=>el.getClientRects().length);
    if(!focusable.length)return;
    if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0].focus();}
  });
  window.addEventListener("beforeunload",event=>{if(!root.hidden&&draft){flush();if(isDirty()){event.preventDefault();event.returnValue="";}}});
  // Route the original control-center edit cards into the same full-screen workbench.
  // Their old editors remain in the code for compatibility and recovery.
  document.addEventListener("click",event=>{
    if(legacyBypass)return;
    const el=event.target.closest("#controlWorkbenchBtn,[data-workbench-open],#controlTaskEditorBtn,#controlGameQuestEditorBtn,#controlFitnessEditorBtn,#controlRefEditorBtn");
    if(!el)return;
    const target=el.dataset.workbenchOpen||({controlTaskEditorBtn:"tasks",controlGameQuestEditorBtn:"game",controlFitnessEditorBtn:"fitness",controlRefEditorBtn:"refs"}[el.id])||"tasks";
    event.preventDefault();event.stopImmediatePropagation();open(target);
  },true);
  window.TaskRingWorkbench={open,close,isOpen:()=>!root.hidden};
})();