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
  let draft=null,base="",expectedBase="",baseline=null,baselineItems=new Map();
  let domain="tasks",selected="",screen="list",keyword="",groupFilter="all",scope="all",visibility="all",notice="",busy=false,legacyBypass=false,returnFocus=null;
  let undoStack=[],redoStack=[],domainMemo=new Map(),treeOpen=new Map();
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
      const item={key,kind,domain:mod,group,identity,obj:value,parent};
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
      if(visibility==="active"&&item.obj.enabled===false)return false;
      if(visibility==="disabled"&&item.obj.enabled!==false)return false;
      const hay=[item.obj.title,item.obj.name,item.obj.note,item.group,item.obj.id,kindName[item.kind]].filter(Boolean).join(" ").toLocaleLowerCase();
      if(query&&!hay.includes(query))return false;
      if(groupFilter!=="all"){
        if(domain==="learning"&&!item.group.startsWith(groupFilter==="LANGUAGE"?"语言":"知识"))return false;
        if(domain==="game"&&!(item.kind==="gameMeta"?item.obj.id===groupFilter:item.identity.startsWith(groupFilter+":")))return false;
        if(domain==="fitness"&&item.kind==="lifeTask"&&!item.identity.startsWith(groupFilter+":"))return false;
        if(domain==="refs"&&!(item.kind==="refGroup"?item.obj.id===groupFilter:item.identity===groupFilter))return false;
      }
      if(domain==="game"&&scope!=="all"&&item.kind==="gameTask"&&!item.identity.endsWith(":"+scope))return false;
      return true;
    });
  }
  function itemSnapshot(item){const q=draft.sequences[item.obj.track];return JSON.stringify(item.kind==="studySettings"?{end:q.end,paused:q.paused}:item.obj)}
  function prepareBaseline(){
    baseline=clone(draft);base=fingerprint(draft);index();
    baselineItems=new Map([...refs.values()].map(item=>[item.key,itemSnapshot(item)]));
  }
  function recordChanged(item){return baselineItems.get(item.key)!==itemSnapshot(item)}
  function changeCount(){
    if(!baseline)return 0;
    const diff=C.difference(baseline,draft);
    return Math.max(isDirty()?1:0,diff.added.length+diff.changed.length+diff.removed.length);
  }
  function snapshot(){return {draft:clone(draft),domain,selected,keyword,groupFilter,scope,visibility,screen}}
  function checkpoint(){
    if(!draft)return;
    undoStack.push(snapshot());if(undoStack.length>30)undoStack.shift();
    redoStack.length=0;
  }
  function restoreSnapshot(state){
    draft=clone(state.draft);domain=state.domain;selected=state.selected;keyword=state.keyword;
    groupFilter=state.groupFilter;scope=state.scope;visibility=state.visibility;screen=state.screen;
    render();
  }
  function undo(){
    if(guardRaw())return;
    flush();
    if(!undoStack.length)return;
    const previous=undoStack.pop();redoStack.push(snapshot());restoreSnapshot(previous);
    notice="已撤销上一步（仍未保存）";render();
  }
  function redo(){
    if(guardRaw())return;
    flush();
    if(!redoStack.length)return;
    const next=redoStack.pop();undoStack.push(snapshot());restoreSnapshot(next);
    notice="已恢复上一步（仍未保存）";render();
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
    const t=item.obj;let h='<h3 class="wb-form-section">01 / 基本信息</h3>';
    h+=field("title","任务名称",t.title,"text",'required maxlength="220"');
    h+=select("module","任务所属区域",area(t),domains.filter(x=>["tasks","weekly","game","fitness"].includes(x[0])).map(x=>[x[0],x[1]]));
    h+=select("priority","任务优先级",priority(t),ON);
    h+=field("cat","分类",t.cat||"life");
    h+=field("time_category","计时类别",t.time_category||"life");
    h+='<h3 class="wb-form-section">02 / 时间与安排</h3>';
    h+=field("estimated_minutes","单次预计时间（分钟）",t.estimated_minutes||0,"number",'min="0"');
    h+=field("weekly_minutes","每周计划时间（分钟）",t.weekly_minutes||0,"number",'min="0"');
    h+='<h3 class="wb-form-section">03 / 任务内容</h3>';
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
    if(item.kind==="gameMeta")return '<h3 class="wb-form-section">01 / 游戏身份</h3>'+
      field("name","游戏名称",v.name)+field("short","简称",v.short)+
      '<h3 class="wb-form-section">02 / 显示与管理</h3>'+
      field("priority","显示顺序",v.priority||1,"number",'min="1"')+
      check("enabled","启用游戏",v.enabled!==false);
    if(item.kind==="gameTask"){
      const weekly=item.group.endsWith("周常");
      return '<h3 class="wb-form-section">01 / 任务基本信息</h3>'+
        '<div class="wb-wide">'+field("title","任务名称",v.title,"text",'required maxlength="220"')+'</div>'+
        (weekly?select("weekly_lane","周常优先级",v.weekly_lane||"steady",[["sprint","优先处理"],["steady","正常周常"],["wait","等待条件"],["optional","有余力"]]):
          select("daily_lane","日常优先级",v.daily_lane||"must",[["must","必须完成"],["optional","有余力"]]))+
        check("enabled","启用此任务",v.enabled!==false)+
        '<h3 class="wb-form-section">02 / 条件与说明</h3>'+
        field("url","关联链接",v.url,"url")+(weekly?field("unlock_hint","解锁条件",v.unlock_hint):"")+
        textarea("note","说明 / 备注",v.note,4);
    }
    if(item.kind==="lifeSection")return field("name","分区名称",v.name)+field("short","分区简称",v.short)+select("accent","颜色",v.accent||"blue",["blue","violet","rose","cyan","slate","green","amber"].map(x=>[x,x]))+textarea("guide","分区指导说明",v.guide,6)+check("enabled","启用分区",v.enabled!==false);
    if(item.kind==="lifeTask")return field("title","行动内容",v.title,"text",'required maxlength="220"')+field("url","关联链接",v.url,"url")+textarea("note","行动说明",v.note,4)+check("optional","可选，不计入必做完成率",v.optional===true)+check("enabled","启用行动",v.enabled!==false);
    if(item.kind==="studySettings"){
      const q=draft.sequences[v.track];
      return '<div class="wb-wide wb-note">完成当天保留当前课程，下一业务日再推进；未完成不跳项，学习历史不会被此编辑器重写。</div>'+
        select("end","队列结束后",q.end,[["stop","停止"],["loop","从头循环"]])+check("paused","暂停学习轨道",q.paused);
    }
    if(item.kind==="studyItem")return field("title","学习内容",v.title,"text",'required maxlength="220"')+field("stage","所属阶段",v.stage)+field("url","课程链接",v.url,"url")+textarea("note","学习要点",v.note,5)+check("enabled","启用课程",v.enabled!==false);
    if(item.kind==="refGroup")return '<h3 class="wb-form-section">01 / 资料分组</h3>'+
      '<div class="wb-wide">'+field("title","分组名称",v.title)+'</div>'+
      check("enabled","启用资料组",v.enabled!==false);
    if(item.kind==="refItem")return '<h3 class="wb-form-section">01 / 资料信息</h3>'+
      '<div class="wb-wide">'+field("title","资料名称",v.title)+'</div>'+
      '<div class="wb-wide">'+field("url","原始资料链接",v.url,"url")+'</div>'+
      check("enabled","启用资料",v.enabled!==false);
    return "";
  }
  function renderToolbar(){
    const count=changeCount(),dirty=isDirty();
    return '<header class="wb-top"><div class="wb-brand"><span class="wb-kicker">TASKRING / CONFIG STUDIO</span>'+
      '<h1 id="wbTitle">任务编辑工作台</h1><p>六个区域，一份配置 · 切换区域不会丢失草稿</p></div>'+
      '<div class="wb-top-actions"><span class="wb-status '+(dirty?"dirty":"")+'" aria-live="polite">'+
      (dirty?'● '+count+' 处待保存':'✓ 当前修改已保存')+'</span>'+
      '<button type="button" class="wb-btn wb-history" data-wb-undo title="撤销（Ctrl+Z）" aria-label="撤销上一项草稿修改" '+(!undoStack.length?'disabled':'')+'>↶</button>'+
      '<button type="button" class="wb-btn wb-history" data-wb-redo title="重做（Ctrl+Shift+Z）" aria-label="重做草稿修改" '+(!redoStack.length?'disabled':'')+'>↷</button>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-json-export>JSON 管理</button>'+
      '<button type="button" class="wb-btn wb-primary" data-wb-save '+(busy?'disabled':'')+'>'+(dirty?'保存 '+count+' 项修改':'保存全部')+'</button>'+
      '<button type="button" class="wb-btn wb-close" data-wb-close aria-label="退出编辑工作台">×</button></div></header>';
  }
  function renderFilters(){
    let x='<div class="wb-list-head"><div><span class="wb-pane-kicker">CONFIGURATION</span><h2>'+esc(labels[domain])+'</h2></div>'+
      '<div class="wb-list-actions"><button type="button" class="wb-btn wb-quiet" data-wb-new>＋ 新增</button>';
    if(["game","fitness","refs"].includes(domain))
      x+='<button type="button" class="wb-btn wb-subtle" data-wb-new-group>＋ '+(domain==="game"?"游戏":domain==="fitness"?"分区":"分组")+'</button>';
    x+='</div></div><label class="wb-search"><span class="wb-sr">搜索当前区域（Ctrl+K）</span>'+
      '<input type="search" data-wb-search placeholder="搜索名称、分类、备注或 ID…" autocomplete="off" value="'+esc(keyword)+'"></label>';
    x+='<div class="wb-filters">';
    if(domain==="game"){
      x+=select("groupFilter","游戏",groupFilter,[["all","全部游戏"],...draft.gameQuest.games.map(g=>[g.id,g.name])])+
        select("scope","类型",scope,[["all","全部"],["daily","日常"],["weekly","周常"]]);
    }else if(domain==="learning")
      x+=select("groupFilter","学习轨道",groupFilter,[["all","全部轨道"],["LANGUAGE","语言"],["KNOWLEDGE","知识"]]);
    else if(domain==="fitness")
      x+=select("groupFilter","星期",groupFilter,[["all","全部星期"],...days.map(day=>[String(day),dayNames[day]])]);
    else if(domain==="refs")
      x+=select("groupFilter","资料分组",groupFilter,[["all","全部分组"],...draft.refs.map(g=>[g.id,g.title])]);
    x+='</div><div class="wb-visibility" aria-label="启用状态筛选">'+
      [["all","全部"],["active","已启用"],["disabled","已停用"]].map(([key,label])=>
        '<button type="button" data-wb-status="'+key+'" aria-pressed="'+(visibility===key)+'" class="'+(visibility===key?"active":"")+'">'+label+'</button>').join("")+
      '</div>';
    return x;
  }
  function entryMarkup(item,nested=false){
    const title=item.obj.title||item.obj.name||(item.kind==="studySettings"?"轨道设置":"未命名");
    return '<button type="button" class="wb-list-entry '+(nested?'wb-tree-item ':'')+
      (selected===item.key?"selected ":"")+(item.obj.enabled===false?"disabled ":"")+
      (recordChanged(item)?"is-changed":"")+'" data-wb-select="'+esc(item.key)+'" aria-current="'+
      (selected===item.key?"true":"false")+'"><span class="wb-entry-name">'+esc(title)+'</span>'+
      '<span class="wb-entry-meta"><small>'+esc(kindName[item.kind])+(item.obj.enabled===false?" · 已停用":"")+
      '</small>'+(recordChanged(item)?'<em>已修改</em>':'')+'</span></button>';
  }
  function treeExpanded(key,fallback=false){
    if(treeOpen.has(key))return treeOpen.get(key);
    if(keyword.trim()||groupFilter!=="all")return true;
    return fallback;
  }
  function treeToggle(key){
    treeOpen.set(key,!treeExpanded(key));
    const listScroll=root.querySelector(".wb-list-items")?.scrollTop||0;
    render();
    const el=[...root.querySelectorAll("[data-wb-tree-toggle]")].find(x=>x.dataset.wbTreeToggle===key);
    el?.focus({preventScroll:true});
    const box=root.querySelector(".wb-list-items");if(box)box.scrollTop=listScroll;
  }
  function treeHeader(key,title,summary,expanded,level=0){
    return '<button type="button" class="wb-tree-toggle" data-wb-tree-toggle="'+esc(key)+'" aria-expanded="'+
      expanded+'" aria-controls="'+esc("wb-tree-"+key.replace(/[^a-z0-9-]/gi,"-"))+'">'+
      '<span class="wb-tree-caret" aria-hidden="true">'+(expanded?"⌄":"›")+'</span>'+
      '<span class="wb-tree-heading">'+esc(title)+'</span><span class="wb-tree-summary">'+esc(summary)+'</span></button>';
  }
  function treePanel(key,content,expanded){
    return '<div class="wb-tree-panel" id="'+esc("wb-tree-"+key.replace(/[^a-z0-9-]/gi,"-"))+
      '" '+(expanded?"":"hidden")+'>'+content+'</div>';
  }
  function gameTree(list){
    const set=new Set(list.map(item=>item.key));
    const all=[...refs.values()];
    const games=draft.gameQuest.games;
    const ids=[...new Set([...games.map(game=>game.id),
      ...Object.keys(draft.gameQuest.boards.daily||{}),...Object.keys(draft.gameQuest.boards.weekly||{})])];
    let html="",visible=0;
    ids.forEach((id,idx)=>{
      const meta=all.find(x=>x.domain==="game"&&x.kind==="gameMeta"&&x.obj.id===id);
      const daily=all.filter(x=>x.kind==="gameTask"&&x.identity===id+":daily"&&set.has(x.key));
      const weekly=all.filter(x=>x.kind==="gameTask"&&x.identity===id+":weekly"&&set.has(x.key));
      const showMeta=!!meta&&set.has(meta.key);
      if(!showMeta&&!daily.length&&!weekly.length)return;
      const game=games.find(x=>x.id===id);
      const name=game?.name||id+" · 未登记";
      const gameKey="game:"+id,expanded=treeExpanded(gameKey,idx===0);
      const renderLane=(board,items)=>{
        if(scope!=="all"&&scope!==board)return "";
        // Keep both lanes navigable when there is no active search or status filter.
        if(!items.length&&(keyword.trim()||visibility!=="all"))return "";
        const laneKey=gameKey+":"+board,open=treeExpanded(laneKey,board==="daily");
        const laneLabel=board==="daily"?"每日任务":"每周任务";
        const groupName=board==="daily"?"日常":"周常";
        return '<div class="wb-tree-lane"><div class="wb-tree-lane-head">'+
          treeHeader(laneKey,laneLabel,items.length+" 项",open,1)+
          '<button type="button" class="wb-tree-add" data-wb-add-game="'+esc(id)+'" data-wb-board="'+board+
          '" title="新增'+esc(name)+' · '+groupName+'" aria-label="在'+esc(name)+groupName+'下新增任务">＋</button></div>'+
          treePanel(laneKey,items.map(item=>entryMarkup(item,true)).join("")||
            '<p class="wb-tree-empty">此处暂无任务</p>',open)+'</div>';
      };
      const d=renderLane("daily",daily),w=renderLane("weekly",weekly);
      let inner='<div class="wb-tree-settings">'+
        (meta&&set.has(meta.key)?entryMarkup(meta,true):'<p class="wb-tree-empty">游戏设置不在当前筛选中</p>')+
        '</div>'+d+w;
      html+='<section class="wb-tree-group" data-wb-game="'+esc(id)+'"><div class="wb-tree-group-head">'+
        treeHeader(gameKey,name,"日常 "+daily.length+" · 周常 "+weekly.length,expanded)+
        (meta?'<button type="button" class="wb-tree-edit" data-wb-select="'+esc(meta.key)+
          '" title="编辑'+esc(name)+'的游戏设置" aria-label="编辑'+esc(name)+'的游戏设置">⚙</button>':"")+
        '</div>'+treePanel(gameKey,inner,expanded)+'</section>';
      visible++;
    });
    return html||'<div class="wb-empty"><strong>没有匹配的游戏任务</strong><p>可以试着清除搜索或更改筛选条件。</p></div>';
  }
  function refsTree(list){
    const set=new Set(list.map(item=>item.key));
    const all=[...refs.values()];
    let html="";
    draft.refs.forEach((group,idx)=>{
      const meta=all.find(x=>x.kind==="refGroup"&&x.obj.id===group.id);
      const children=all.filter(x=>x.kind==="refItem"&&x.identity===group.id&&set.has(x.key));
      const showMeta=!!meta&&set.has(meta.key);
      if(!showMeta&&!children.length)return;
      const key="refs:"+group.id,expanded=treeExpanded(key,idx===0);
      html+='<section class="wb-tree-group" data-wb-ref-group="'+esc(group.id)+'"><div class="wb-tree-group-head">'+
        treeHeader(key,group.title||"未命名分组",children.length+" 条资料",expanded)+
        (meta?'<button type="button" class="wb-tree-edit" data-wb-select="'+esc(meta.key)+
          '" title="编辑资料分组" aria-label="编辑分组：'+esc(group.title)+'">⚙</button>':"")+'</div>'+
        treePanel(key,'<div class="wb-tree-settings">'+
          (showMeta?entryMarkup(meta,true):"")+'</div><div class="wb-tree-ref-actions">'+
          '<span>分组内资料</span><button type="button" class="wb-tree-add wb-tree-add-wide" data-wb-add-ref="'+
          esc(group.id)+'" aria-label="向'+esc(group.title)+'添加资料">＋ 添加资料</button></div>'+
          '<div class="wb-tree-ref-items">'+(children.map(item=>entryMarkup(item,true)).join("")||
            '<p class="wb-tree-empty">暂无资料，点击上方添加</p>')+'</div>',expanded)+'</section>';
    });
    return html||'<div class="wb-empty"><strong>没有匹配的资料</strong><p>可以更改分组或搜索词，或新增一个资料分组。</p></div>';
  }
  function listMarkup(list){
    if(domain==="game")return gameTree(list);
    if(domain==="refs")return refsTree(list);
    let h="",last="";
    list.forEach(item=>{
      if(item.group!==last){h+='<div class="wb-list-group">'+esc(item.group)+'</div>';last=item.group;}
      h+=entryMarkup(item);
    });
    if(!list.length)h+='<div class="wb-empty"><strong>没有匹配的项目</strong><p>可以调整筛选条件，或通过「＋ 新增」添加新项目。</p></div>';
    return h;
  }
  function renderList(){
    const list=filtered();
    return '<div class="wb-list-items" role="group" aria-label="配置项目列表">'+listMarkup(list)+'</div>'+
      '<footer class="wb-list-foot"><span class="wb-count">'+list.length+' 项结果</span><span>草稿未保存前不会写入正式配置</span>'+
      '<details class="wb-compat"><summary>兼容与高级维护</summary><p>少数旧版专属设置仍可在兼容编辑器维护。</p>'+
      '<button type="button" class="wb-btn wb-subtle" data-wb-legacy>打开专业兼容编辑器</button></details></footer>';
  }
  function linkAction(url){
    try{
      const resolved=new URL(url);
      if(!["https:","http:"].includes(resolved.protocol))return "";
      return '<a class="wb-context-link" href="'+esc(resolved.href)+
        '" target="_blank" rel="noopener noreferrer">↗ 打开资料链接</a>';
    }catch(_){return ""}
  }
  function detailContext(item){
    if(item.kind==="gameMeta"){
      const id=item.obj.id,name=item.obj.name||id;
      const daily=(draft.gameQuest.boards.daily[id]||[]).length;
      const weekly=(draft.gameQuest.boards.weekly[id]||[]).length;
      return '<aside class="wb-context-card"><div><strong>游戏配置</strong><p>'+
        esc(name)+' · 日常 '+daily+' 项 / 周常 '+weekly+' 项</p></div>'+
        '<div class="wb-context-actions"><button type="button" data-wb-add-game="'+esc(id)+
        '" data-wb-board="daily">＋ 日常任务</button><button type="button" data-wb-add-game="'+
        esc(id)+'" data-wb-board="weekly">＋ 周常任务</button></div></aside>';
    }
    if(item.kind==="gameTask"){
      const [id,board]=item.identity.split(":");
      const game=draft.gameQuest.games.find(g=>g.id===id);
      const title=game?.name||id,boardLabel=board==="weekly"?"周常":"日常";
      return '<aside class="wb-context-card"><div><strong>'+esc(title)+' / '+boardLabel+
        '</strong><p>这里维护该游戏的'+boardLabel+'任务；限时与周期运营任务仍以 Supabase 为准。</p></div>'+
        '<div class="wb-context-actions"><button type="button" data-wb-add-game="'+esc(id)+
        '" data-wb-board="'+esc(board)+'">＋ 同组新任务</button></div></aside>';
    }
    if(item.kind==="refGroup"){
      const length=(item.obj.items||[]).length;
      return '<aside class="wb-context-card"><div><strong>资料分组</strong><p>当前分组内共有 '+
        length+' 条资料，可直接为此分组新增条目。</p></div>'+
        '<div class="wb-context-actions"><button type="button" data-wb-add-ref="'+esc(item.obj.id)+
        '">＋ 添加资料</button></div></aside>';
    }
    if(item.kind==="refItem"){
      const group=draft.refs.find(g=>g.id===item.identity);
      return '<aside class="wb-context-card"><div><strong>所属分组：'+esc(group?.title||item.identity)+
        '</strong><p>仅编辑当前资料；其他分组和条目不会受到影响。</p></div>'+
        '<div class="wb-context-actions">'+linkAction(item.obj.url||"")+'</div></aside>';
    }
    return "";
  }
  function renderDetail(){
    const item=refs.get(selected);
    if(!item)return '<div class="wb-empty-detail"><span aria-hidden="true">✦</span><h2>选择任务，开始编辑</h2>'+
      '<p>左侧选择已有条目，修改会保留在跨区域草稿中。<br>也可以新建一个项目，最后统一保存。</p>'+
      '<p class="wb-keytips">快捷键：Ctrl/⌘ + K 搜索 · Ctrl/⌘ + S 保存 · Ctrl/⌘ + Z 撤销</p></div>';
    const obj=item.obj,stable=item.kind!=="studySettings";
    const title=obj.title||obj.name||(item.kind==="studySettings"?"轨道设置":"未命名");
    const raw=item.kind==="studySettings"?draft.sequences[obj.track]:obj;
    const all=filtered(),position=all.findIndex(row=>row.key===selected);
    return '<div class="wb-editor-top"><button type="button" class="wb-btn wb-back" data-wb-back>← 返回列表</button>'+
      '<span class="wb-breadcrumb">'+esc(labels[domain])+' / '+esc(item.group)+'</span>'+
      '<div class="wb-switch-record"><button type="button" class="wb-btn wb-quiet" data-wb-step="-1" aria-label="上一项" '+(position<=0?'disabled':'')+'>← 上一项</button>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-step="1" aria-label="下一项" '+(position<0||position>=all.length-1?'disabled':'')+'>下一项 →</button></div></div>'+
      '<div class="wb-editor-heading"><div><span class="wb-kicker">'+esc(kindName[item.kind])+
      (recordChanged(item)?' · 草稿已修改':'')+'</span><h2>'+esc(title)+'</h2></div>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-open-live>在正式页面查看</button></div>'+
      detailContext(item)+
      '<form class="wb-edit-form" data-wb-editor-form data-wb-item="'+esc(item.key)+'"><div class="wb-fields">'+editorFields(item)+'</div></form>'+
      '<details class="wb-raw"><summary>高级 · 编辑单项 JSON</summary>'+
      '<p>此区域只修改当前条目。ID、状态编码保持不变；点击「应用」后仍须保存整个草稿。</p>'+
      '<textarea aria-label="此项原始 JSON" data-wb-raw spellcheck="false">'+esc(JSON.stringify(raw,null,2))+'</textarea>'+
      '<div class="wb-raw-actions"><button type="button" class="wb-btn wb-quiet" data-wb-apply-raw>应用 JSON 到草稿</button>'+
      '<button type="button" class="wb-btn wb-subtle" data-wb-discard-raw>恢复原始文本</button></div></details>'+
      '<div class="wb-editor-actions">'+(stable?'<button type="button" class="wb-btn wb-quiet" data-wb-duplicate>复制为新项</button>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-move="-1">↑ 上移</button>'+
      '<button type="button" class="wb-btn wb-quiet" data-wb-move="1">↓ 下移</button>':'')+
      ((stable&&"enabled" in obj)?'<button type="button" class="wb-btn wb-warning" data-wb-toggle-enabled>'+
        (obj.enabled===false?"启用":"停用")+'</button>':"")+
      '<button type="button" class="wb-btn wb-primary" data-wb-save>保存全部修改</button></div>';
  }
  function render(){
    if(root.hidden||!draft)return;
    ensure();const previousScroll={
      nav:root.querySelector(".wb-nav")?.scrollLeft||0,
      list:root.querySelector(".wb-list-items")?.scrollTop||0,
      editor:root.querySelector(".wb-editor")?.scrollTop||0
    };
    const all=index(),counts=Object.fromEntries(domains.map(([key])=>[key,all.filter(item=>item.domain===key).length]));
    root.dataset.screen=screen;
    root.innerHTML=renderToolbar()+'<div class="wb-layout"><nav class="wb-nav" aria-label="编辑区域">'+
      domains.map(([key,name],i)=>'<button type="button" data-wb-domain="'+key+'" class="'+(domain===key?"active":"")+
        '" aria-current="'+(domain===key?"page":"false")+'"><span class="wb-num">'+String(i+1).padStart(2,"0")+
        '</span><span>'+name+'</span><small>'+counts[key]+'</small></button>').join("")+
      '<div class="wb-nav-tip">本工作台编辑的是任务配置，不会清除打卡历史。游戏限时与周期活动仍由 Supabase 独立维护。</div></nav>'+
      '<section class="wb-lists" aria-label="配置项目">'+renderFilters()+renderList()+'</section>'+
      '<main class="wb-editor" id="wbEditor">'+renderDetail()+'</main></div>'+
      '<footer class="wb-feedback" role="status" aria-live="polite"><span>'+esc(notice||"按 Ctrl/⌘ + S 保存 · Esc 退出 · Ctrl/⌘ + K 搜索")+
      '</span><span class="wb-feedback-progress">'+(isDirty()?changeCount()+' 处待保存':'工作台就绪')+'</span></footer>';
    const form=root.querySelector("[data-wb-editor-form]");
    if(form)form.dataset.wbOriginal=JSON.stringify([...new FormData(form).entries()]);
    const raw=root.querySelector("[data-wb-raw]");if(raw)raw.dataset.wbOriginal=raw.value;
    root.querySelector(".wb-nav").scrollLeft=previousScroll.nav;
    root.querySelector(".wb-list-items").scrollTop=previousScroll.list;
    root.querySelector(".wb-editor").scrollTop=previousScroll.editor;
  }
  function rawPending(){
    const raw=root.querySelector("[data-wb-raw]");
    return !!raw&&raw.value!==raw.dataset.wbOriginal;
  }
  function guardRaw(){
    if(!rawPending())return false;
    notice="JSON 文本尚未应用：请点击「应用 JSON 到草稿」或「恢复原始文本」后继续。";
    const feedback=root.querySelector(".wb-feedback > span");
    if(feedback)feedback.textContent=notice;
    return true;
  }
  function current(){return refs.get(selected)}
  function flush(){
    const form=root.querySelector("[data-wb-editor-form]");
    if(!form)return;
    const values=[...new FormData(form).entries()];
    const initial=JSON.parse(form.dataset.wbOriginal||"[]");
    if(JSON.stringify(values)===JSON.stringify(initial))return;
    const previous=new Map(initial);
    const item=refs.get(form.dataset.wbItem);if(!item)return;
    checkpoint();
    const e=form.elements,get=name=>e.namedItem(name),text=name=>get(name)?.value??"";
    const data=new Map(values),has=name=>data.has(name);
    const changed=name=>String(data.get(name)??"")!==String(previous.get(name)??"")||data.has(name)!==previous.has(name);
    const set=(target,prop,name,transform=value=>value)=>{if(changed(name))target[prop]=transform(text(name));};
    const v=item.obj;
    if(item.kind==="task"){
      set(v,"title","title",x=>x.trim());set(v,"url","url",x=>x.trim());set(v,"note","note");
      set(v,"cat","cat",x=>x.trim()||"life");set(v,"time_category","time_category",x=>x.trim()||"life");
      set(v,"estimated_minutes","estimated_minutes",x=>Math.max(0,Number(x)||0));
      set(v,"weekly_minutes","weekly_minutes",x=>Math.max(0,Number(x)||0));
      if(changed("enabled"))v.enabled=has("enabled");
      if(changed("priority")){
        const p=text("priority");v.core=p==="core"?1:0;v.important=p==="important"?1:0;v.optional=p==="optional";
      }
      const dayChange=days.some(day=>changed("day"+day));
      if(dayChange)v.days=days.filter(day=>has("day"+day));
      const module=text("module");
      if(changed("module")){
        v.plan_mode=module==="weekly"?"weekly":"daily";
        v.nextModule=module;
        if(module!=="game")delete v.nextGameId;
      }
      if(module==="game")set(v,"nextGameId","nextGameId");
      if(changed("steps")){
        const titles=text("steps").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
        const prior=v.steps||[],used=new Set(prior.map(x=>x.code)),allocated=new Set();
        v.steps=titles.map((name,i)=>{
          const old=prior.find((s,j)=>!allocated.has(j)&&s.title===name);
          const j=old?prior.indexOf(old):i<prior.length&&!allocated.has(i)?i:-1;
          if(j>=0){allocated.add(j);return {...prior[j],title:name}}
          const code=idCode("s",[...used],2);used.add(code);
          return {id:code,code,title:name,enabled:true};
        });
      }
      const scheduleChanged=["advanced","scheduleType","scheduleDate","scheduleStart","scheduleDue","missed","interval","showToday"].some(changed)||
        dayChange&&!!v.nextSchedule&&v.nextSchedule.type==="WEEKDAY";
      if(scheduleChanged){
        if(!has("advanced"))delete v.nextSchedule;
        else {
          const prior=v.nextSchedule||{},type=text("scheduleType");
          const bound=(old,date)=>!date?null:old?.date===date?old:{date,precision:"date"};
          const date=text("scheduleDate");
          const opts={...prior,type,missed:text("missed"),date:date||null,
            start:bound(prior.start,text("scheduleStart")),due:bound(prior.due,text("scheduleDue")),showToday:has("showToday")};
          if(type==="WEEKDAY")opts.days=days.filter(day=>has("day"+day));
          if(type==="RECURRING"){opts.anchor=date;opts.intervalDays=Math.max(1,Number(text("interval"))||7)}
          v.nextSchedule=opts;v.nextModule=module;
        }
      }
    }else if(item.kind==="gameMeta"){
      set(v,"name","name",x=>x.trim());set(v,"short","short",x=>x.trim());
      set(v,"priority","priority",x=>Math.max(1,Number(x)||1));
      if(changed("enabled"))v.enabled=has("enabled");
    }else if(item.kind==="gameTask"){
      set(v,"title","title",x=>x.trim());set(v,"url","url",x=>x.trim());set(v,"note","note");
      if(changed("enabled"))v.enabled=has("enabled");
      if(item.group.endsWith("周常")){
        set(v,"weekly_lane","weekly_lane");set(v,"unlock_hint","unlock_hint");
      }else set(v,"daily_lane","daily_lane");
    }else if(item.kind==="lifeSection"){
      set(v,"name","name",x=>x.trim());set(v,"short","short",x=>x.trim());
      set(v,"accent","accent");set(v,"guide","guide");
      if(changed("enabled"))v.enabled=has("enabled");
    }else if(item.kind==="lifeTask"){
      set(v,"title","title",x=>x.trim());set(v,"url","url",x=>x.trim());set(v,"note","note");
      if(changed("optional"))v.optional=has("optional");
      if(changed("enabled"))v.enabled=has("enabled");
    }else if(item.kind==="studySettings"){
      const q=draft.sequences[v.track];set(q,"end","end");
      if(changed("paused"))q.paused=has("paused");
    }else if(item.kind==="studyItem"){
      set(v,"title","title",x=>x.trim());set(v,"stage","stage",x=>x.trim());
      set(v,"url","url",x=>x.trim());set(v,"note","note");
      if(changed("enabled"))v.enabled=has("enabled");
    }else if(item.kind==="refGroup"){
      set(v,"title","title",x=>x.trim());if(changed("enabled"))v.enabled=has("enabled");
    }else if(item.kind==="refItem"){
      set(v,"title","title",x=>x.trim());set(v,"url","url",x=>x.trim());
      if(changed("enabled"))v.enabled=has("enabled");
    }
    form.dataset.wbOriginal=JSON.stringify(values);
  }
  function create(kind,context={}){
    flush();
    checkpoint();
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
      const selectedRow=refs.get(selected);
      const selectedId=selectedRow?.kind==="gameMeta"?selectedRow.obj.id:
        selectedRow?.kind==="gameTask"?selectedRow.identity.split(":")[0]:null;
      const game=draft.gameQuest.games.find(g=>g.id===(context.gameId||groupFilter))||
        draft.gameQuest.games.find(g=>g.id===selectedId)||draft.gameQuest.games[0];
      if(!game){notice="请先新增一个游戏";render();return;}
      const board=context.board||(["daily","weekly"].includes(scope)?scope:
        selectedRow?.kind==="gameTask"?selectedRow.identity.split(":")[1]:"daily");
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
      const selectedRow=refs.get(selected);
      const selectedGroup=selectedRow?.kind==="refGroup"?selectedRow.obj.id:
        selectedRow?.kind==="refItem"?selectedRow.identity:null;
      const group=draft.refs.find(g=>g.id===(context.groupId||groupFilter))||
        draft.refs.find(g=>g.id===selectedGroup)||draft.refs[0];
      if(!group){notice="请先新增一个资料分组";render();return;}
      parent=group.items ||= [];
      obj={id:"wb-ref-"+uuid(),title:"新资料",url:"",enabled:true};parent.push(obj);
    }else return;
    if(domain==="game"&&kind!=="group"){
      treeOpen.set("game:"+((context.gameId)||
        [...draft.gameQuest.games].find(g=>g.id===groupFilter)?.id||
        [...refs.values()].find(item=>item.obj===obj)?.identity.split(":")[0]),true);
    }
    if(domain==="refs"&&kind!=="group"){
      treeOpen.set("refs:"+(context.groupId||groupFilter),true);
    }
    if(kind==="group"&&(domain==="game"||domain==="refs"))
      treeOpen.set((domain==="game"?"game:":"refs:")+obj.id,true);
    index();
    const row=[...refs.values()].find(item=>item.obj===obj);
    if(domain==="game"&&row?.kind==="gameTask"){
      treeOpen.set("game:"+row.identity.split(":")[0],true);
      treeOpen.set("game:"+row.identity,true);
    }
    if(domain==="refs"&&row?.kind==="refItem")treeOpen.set("refs:"+row.identity,true);
    selected=row?.key||"";screen="detail";keyword="";visibility="all";
    if(groupFilter!=="all"&&(
      (domain==="game"&&row?.kind==="gameTask"&&row.identity.split(":")[0]!==groupFilter)||
      (domain==="refs"&&row?.kind==="refItem"&&row.identity!==groupFilter)))groupFilter="all";
    if(domain==="game"&&row?.kind==="gameTask")scope=row.identity.split(":")[1];
    notice="已加入草稿 · 尚未保存到正式配置";render();
    root.querySelector('[name="title"],[name="name"]')?.focus();
  }
  function choose(key){
    flush();selected=key;screen="detail";notice="";render();
    root.querySelector(".wb-editor").scrollTop=0;
  }
  function rememberDomain(){
    domainMemo.set(domain,{selected,keyword,groupFilter,scope,visibility,scroll:root.querySelector(".wb-list-items")?.scrollTop||0});
  }
  function switchDomain(next){
    if(guardRaw())return;
    if(!labels[next]||next===domain)return;
    flush();rememberDomain();
    domain=next;const saved=domainMemo.get(next)||{};
    selected=saved.selected||"";keyword=saved.keyword||"";groupFilter=saved.groupFilter||"all";
    scope=saved.scope||"all";visibility=saved.visibility||"all";screen="list";notice="";
    render();
    root.querySelector(".wb-list-items").scrollTop=saved.scroll||0;
  }
  function stepItem(delta){
    flush();const list=filtered(),i=list.findIndex(x=>x.key===selected),next=list[i+delta];
    if(!next)return;
    selected=next.key;screen="detail";notice="";render();
    root.querySelector(".wb-editor").scrollTop=0;
  }
  function save(){
    if(busy||guardRaw())return;
    flush();
    if(!isDirty()){notice="当前没有需要保存的修改";render();return;}
    try{
      C.validateConfig(draft);
      busy=true;
      const saved=window.TaskRingCommand?.saveWorkbenchConfig?.(clone(draft),expectedBase);
      if(!saved)throw Error("统一保存接口暂不可用");
      const current=storedConfig()||saved;expectedBase=fingerprint(current);draft=clone(current);ensure();prepareBaseline();undoStack=[];redoStack=[];
      notice="✓ 已保存到本机配置；如已连接 Gist，将沿用原有同步与冲突保护机制";
      busy=false;render();
    }catch(error){busy=false;notice="保存失败："+String(error?.message||error);render();}
  }
  function close(force=false){
    const pendingRaw=rawPending();
    if(!force){flush();if((isDirty()||pendingRaw)&&!confirm("还有未保存的编辑草稿或尚未应用的 JSON。关闭会放弃这些修改，确定关闭吗？"))return false;}
    root.hidden=true;root.innerHTML="";document.body.classList.remove("workbenchOpen");
    draft=null;baseline=null;baselineItems.clear();undoStack=[];redoStack=[];domainMemo.clear();treeOpen.clear();refs.clear();returnFocus?.focus?.({preventScroll:true});return true;
  }
  function open(next="tasks"){
    if(!root.hidden){switchDomain(next);return;}
    const saved=storedConfig();
    if(!saved){window.showToast?.("配置仍在初始化，请稍后重试","warn");return;}
    returnFocus=document.getElementById("controlCenterMenu")?.contains(document.activeElement)?document.getElementById("controlCenterBtn"):document.activeElement;
    expectedBase=fingerprint(saved);draft=clone(saved);ensure();prepareBaseline();undoStack=[];redoStack=[];domainMemo.clear();
    domain=labels[next]?next:"tasks";groupFilter="all";scope="all";visibility="all";keyword="";selected="";screen="list";notice="";busy=false;
    window.closeControlCenter?.();
    root.hidden=false;document.body.classList.add("workbenchOpen");render();
    root.querySelector("[data-wb-domain='"+domain+"']")?.focus({preventScroll:true});
  }
  function duplicate(){
    flush();const item=current();if(!item?.parent)return;
    checkpoint();
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
    checkpoint();parent.splice(to,0,parent.splice(from,1)[0]);notice="已调整顺序，尚未保存";render();
  }
  function applyRaw(){
    const item=current();if(!item)return;
    const txt=root.querySelector("[data-wb-raw]")?.value;let next;
    const rollback=clone(draft);
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
      C.validateConfig(draft);undoStack.push({...snapshot(),draft:rollback});if(undoStack.length>30)undoStack.shift();redoStack=[];
      notice="JSON 已应用到草稿，仍需保存全部";render();
    }catch(err){draft=rollback;index();notice="JSON 校验失败："+String(err.message||err);root.querySelector(".wb-feedback").textContent=notice;}
  }
  function onClick(event){
    const el=event.target.closest("button");if(!el)return;
    const d=el.dataset;
    if(rawPending()&&d.wbApplyRaw===undefined&&d.wbDiscardRaw===undefined&&d.wbClose===undefined){guardRaw();return;}
    if(d.wbDomain){switchDomain(d.wbDomain);}
    else if(d.wbTreeToggle!==undefined){flush();treeToggle(d.wbTreeToggle);}
    else if(d.wbAddGame!==undefined)create("item",{gameId:d.wbAddGame,board:d.wbBoard});
    else if(d.wbAddRef!==undefined)create("item",{groupId:d.wbAddRef});
    else if(d.wbSelect){choose(d.wbSelect);}
    else if(d.wbBack!==undefined){flush();screen="list";render();}
    else if(d.wbNew!==undefined)create("item");
    else if(d.wbNewGroup!==undefined)create("group");
    else if(d.wbSave!==undefined)save();
    else if(d.wbUndo!==undefined)undo();
    else if(d.wbRedo!==undefined)redo();
    else if(d.wbStep!==undefined)stepItem(Number(d.wbStep));
    else if(d.wbStatus!==undefined){flush();visibility=d.wbStatus;render();}
    else if(d.wbClose!==undefined)close();
    else if(d.wbDuplicate!==undefined)duplicate();
    else if(d.wbMove!==undefined)move(Number(d.wbMove));
    else if(d.wbToggleEnabled!==undefined){flush();const item=current();if(!item)return;checkpoint();item.obj.enabled=item.obj.enabled===false;notice="已更新启用状态（草稿）";render();}
    else if(d.wbApplyRaw!==undefined)applyRaw();
    else if(d.wbDiscardRaw!==undefined){
      const raw=root.querySelector("[data-wb-raw]");
      if(raw){raw.value=raw.dataset.wbOriginal;notice="已恢复原始 JSON 文本";const tip=root.querySelector(".wb-feedback > span");if(tip)tip.textContent=notice;}
    }
    else if(d.wbLegacy!==undefined){
      const origin={"tasks":"controlTaskEditorBtn","weekly":"controlTaskEditorBtn","game":"controlGameQuestEditorBtn",
        "fitness":"controlFitnessEditorBtn","refs":"controlRefEditorBtn"}[domain];
      if(!close())return;
      legacyBypass=true;
      try{document.getElementById(origin)?.click();}finally{legacyBypass=false;}
    }
    else if(d.wbOpenLive!==undefined){
      if(!close())return;
      window.setActiveAppView?.(domain==="refs"?"library":domain);
    }else if(d.wbJsonExport!==undefined){
      flush();
      if(isDirty()){notice="请先保存全部草稿，再打开 JSON 管理，避免导入时覆盖未保存内容";render();return;}
      window.TaskRingCommand?.openWorkbenchJson?.();
    }
  }
  root.addEventListener("click",onClick);
  root.addEventListener("input",event=>{
    const el=event.target;
    if(el.matches("[data-wb-search]")){
      flush();keyword=el.value;
      const list=filtered(),box=root.querySelector(".wb-list-items");
      if(!box)return;
      // Update only the results, keeping focus and the scroll position of the search input.
      box.innerHTML=listMarkup(list);
      const count=root.querySelector(".wb-count");if(count)count.textContent=list.length+" 项结果";
    }else if(el.closest("[data-wb-editor-form]")){
      const badge=root.querySelector(".wb-status");
      if(badge){badge.textContent="● 当前编辑尚未保存";badge.classList.add("dirty");}
      const undoButton=root.querySelector("[data-wb-undo]");if(undoButton)undoButton.disabled=false;
      const pending=root.querySelector(".wb-feedback-progress");if(pending)pending.textContent="当前条目待保存";
    }
  });
  root.addEventListener("change",event=>{
    const el=event.target;
    if(el.name==="groupFilter"||el.name==="scope"){
      if(guardRaw()){el.value=el.name==="groupFilter"?groupFilter:scope;return;}
      flush();if(el.name==="groupFilter")groupFilter=el.value;else scope=el.value;render();
    }
  });
  root.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();save();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();root.querySelector("[data-wb-search]")?.focus();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"&&!event.target.matches("input,textarea,[contenteditable]")){
      event.preventDefault();if(event.shiftKey)redo();else undo();return;
    }
    if(event.key==="Escape"){
      event.preventDefault();
      if(screen==="detail"&&matchMedia("(max-width:760px)").matches){flush();screen="list";render();}
      else close();
      return;
    }
    if(event.key!=="Tab")return;
    const focusable=[...root.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary")].filter(el=>el.getClientRects().length);
    if(!focusable.length)return;
    if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0].focus();}
  });
  window.addEventListener("beforeunload",event=>{if(!root.hidden&&draft){const pendingRaw=rawPending();flush();if(isDirty()||pendingRaw){event.preventDefault();event.returnValue="";}}});
  // Route the original control-center edit cards into the same full-screen workbench.
  // Their old editors remain in the code for compatibility and recovery.
  document.addEventListener("click",event=>{
    if(legacyBypass)return;
    const el=event.target.closest("#controlWorkbenchBtn,[data-workbench-open],#controlTaskEditorBtn,#controlGameQuestEditorBtn,#controlFitnessEditorBtn,#controlRefEditorBtn");
    if(!el)return;
    const target=el.dataset.workbenchOpen||({controlTaskEditorBtn:"tasks",controlGameQuestEditorBtn:"game",controlFitnessEditorBtn:"fitness",controlRefEditorBtn:"refs"}[el.id])||"tasks";
    event.preventDefault();event.stopImmediatePropagation();open(target);
  },true);
  function hasPendingForm(){
    const form=root.querySelector("[data-wb-editor-form]");
    return rawPending()||(!!form&&JSON.stringify([...new FormData(form).entries()])!==form.dataset.wbOriginal);
  }
  document.getElementById("commandDialog")?.addEventListener("close",()=>{
    if(root.hidden||!draft)return;
    const current=storedConfig();
    if(current&&fingerprint(current)!==expectedBase&&!isDirty()&&!hasPendingForm()){
      expectedBase=fingerprint(current);draft=clone(current);ensure();prepareBaseline();
      undoStack=[];redoStack=[];notice="JSON 导入后已重新读取最新配置";render();
    }
  });
  window.TaskRingWorkbench={open,close,isOpen:()=>!root.hidden,dirty:()=>!root.hidden&&(isDirty()||hasPendingForm())};
})();