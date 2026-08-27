(() => {
  "use strict";
  if(window.__TASKRING_GAMEQUEST_COMMAND_BOARD__) return;
  window.__TASKRING_GAMEQUEST_COMMAND_BOARD__ = true;
  if(!window.__TASKRING_GAMEQUEST_V3__ || !window.__TASKRING_GAMEQUEST_PRIORITY__){
    console.warn("GameQuest command board requires v3 + priority layers");
    return;
  }

  const FILTER_KEY = "taskring_gamequest_command_filter_v1";
  const VIEW_DEFS = {
    floor:{label:"只做保底", rank:0},
    resource:{label:"拿满抽卡资源", rank:1},
    all:{label:"全部任务", rank:2}
  };
  let commandFilter = VIEW_DEFS[localStorage.getItem(FILTER_KEY)] ? localStorage.getItem(FILTER_KEY) : "resource";

  const PRIORITY = {
    must:{rank:0,label:"保底",hint:"高价值固定资源或临期必领；忙时至少守住这一层。"},
    good:{rank:1,label:"资源",hint:"固定/周期抽卡资源、黑蛋等；想尽量拿满资源就做到这一层。"},
    skip:{rank:2,label:"可摆烂",hint:"养成、排名、常驻或低边际收益；不做通常不影响固定抽卡资源主线。"}
  };

  function cleanPriority(value, fallback="good"){
    const raw=String(value||"").trim().toLowerCase();
    if(["must","p0","s","core","floor","required","保底","必做"].includes(raw)) return "must";
    if(["good","p1","a","resource","recommended","资源","推荐"].includes(raw)) return "good";
    if(["skip","p2","p3","b","c","optional","casual","摆烂","可摆烂","可选"].includes(raw)) return "skip";
    return PRIORITY[raw] ? raw : fallback;
  }
  function rank(task){ return PRIORITY[cleanPriority(task?.priority,"good")]?.rank ?? 1; }
  function visible(task){
    const r=rank(task), limit=VIEW_DEFS[commandFilter]?.rank ?? 1;
    return r<=limit;
  }
  function cleanCadence(value, fallback="weekly"){
    const key=String(value||"").trim().toLowerCase();
    if(key==="periodic") return "cycle";
    if(key==="permanent") return "once";
    return ["weekly","cycle","once","limited"].includes(key) ? key : fallback;
  }
  function gameMap(){
    return new Map((gameQuestConfig?.games||[]).filter(g=>g.enabled!==false).map(g=>[String(g.id),g]));
  }
  function rawWeekly(gameId){
    const source=gameQuestConfig?.weekly?.[gameId]||[];
    return normalizeGameQuestTaskList(source,"weekly").filter(t=>t&&t.enabled!==false);
  }
  function rawDaily(gameId,dayId){
    const source=gameQuestConfig?.schedule?.[String(dayId)]?.[gameId]||[];
    return normalizeGameQuestTaskList(source,"scheduled").filter(t=>t&&t.enabled!==false);
  }
  function isExpired(task){
    if(cleanCadence(task?.cadence,"weekly")!=="limited" || !task?.due_at) return false;
    const ts=Date.parse(task.due_at);
    return Number.isFinite(ts) && Date.now()>ts;
  }
  function effectiveCycle(task){
    const title=String(task?.title||"");
    const cadence=cleanCadence(task?.cadence,"weekly");
    if(/^月度｜/.test(title)){
      const d=new Date(), month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      return `gqmonth-${month}-${stableHashPart(task.id||title)}`;
    }
    if(cadence==="weekly") return cycleYmd;
    return `gqv3-${cadence}-${stableHashPart(String(task?.cycle_key||task?.id||task?.title||"current"))}`;
  }
  function dueMeta(task){
    if(!task?.due_at) return null;
    const ts=Date.parse(task.due_at);
    if(!Number.isFinite(ts)) return null;
    const diff=ts-Date.now();
    const hours=Math.ceil(diff/3600000);
    const days=Math.ceil(diff/86400000);
    const d=new Date(ts);
    const label=`${d.getMonth()+1}/${d.getDate()}`;
    if(diff<0) return {label:"已过期",tone:"expired",sort:99};
    if(hours<=24) return {label:`今日/24h内 · ${label}`,tone:"urgent",sort:0};
    if(days<=3) return {label:`临期 ${days}天 · ${label}`,tone:"urgent",sort:1};
    if(days<=7) return {label:`${days}天 · ${label}`,tone:"soon",sort:2};
    return {label:`截止 ${label}`,tone:"normal",sort:3};
  }
  function isDailyDone(gameId,task,dayId){
    return isGameQuestItemDone(gameId,dayId,task.id,cycleYmd);
  }
  function isWeeklyDone(gameId,task){
    return isGameQuestWeeklyItemDone(gameId,task.id,effectiveCycle(task));
  }
  function noteMarkup(value){
    let text=escapeHtml(String(value||""));
    text=text.replace(/!!(.+?)!!/g,'<strong class="gqNoteCritical">$1</strong>');
    text=text.replace(/\*\*(.+?)\*\*/g,'<strong class="gqNoteStrong">$1</strong>');
    return text;
  }
  function priorityBadge(task){
    const p=cleanPriority(task.priority,"good"),def=PRIORITY[p];
    return `<span class="gqCmdBadge priority ${p}" title="${escapeHtml(def.hint)}">${escapeHtml(def.label)}</span>`;
  }
  function cadenceBadge(task){
    const title=String(task.title||"");
    if(/^月度｜/.test(title)) return `<span class="gqCmdBadge cadence monthly">月度</span>`;
    const c=cleanCadence(task.cadence,"weekly");
    const labels={weekly:"周",cycle:"周期",once:"一次",limited:"限时"};
    return `<span class="gqCmdBadge cadence ${c}">${labels[c]}</span>`;
  }
  function resourceBadge(task){
    return /!!/.test(String(task.note||"")) ? `<span class="gqCmdBadge resource">资源</span>` : "";
  }
  function effortBadge(task){
    const n=Number(task.estimated_minutes);
    return Number.isFinite(n)&&n>0 ? `<span class="gqCmdBadge effort">≈${Math.round(n)}m</span>` : "";
  }
  function serverLabel(game){
    const s=String(game?.short||game?.name||"");
    if(s.includes("国际")) return "国际服";
    if(s.includes("国服")) return "国服";
    return "";
  }

  function allRows(dayId){
    const games=gameMap(), daily=[], weekly=[];
    for(const [gid,game] of games){
      rawDaily(gid,dayId).forEach(task=>{
        daily.push({type:"daily",gameId:gid,game,task,done:isDailyDone(gid,task,dayId)});
      });
      rawWeekly(gid).filter(t=>!isExpired(t)).forEach(task=>{
        weekly.push({type:"weekly",gameId:gid,game,task,done:isWeeklyDone(gid,task),due:dueMeta(task)});
      });
    }
    return {daily,weekly};
  }
  function classify(row){
    if(row.type==="daily") return "daily";
    const t=row.task,title=String(t.title||""),c=cleanCadence(t.cadence,"weekly");
    if(rank(t)>=2) return "optional";
    if(/^月度｜|^版本|^临期|^官方App/.test(title)) return "version";
    if(/^高难|^挑战|^首通|^常驻|^活动资源|^高难活动|^周期/.test(title) || c==="cycle" || c==="once") return "challenge";
    if(c==="limited"){
      if(/高难|挑战|活动资源|临期.*高难/.test(title)) return "challenge";
      return "version";
    }
    return "weekly";
  }
  function sectionRows(dayId){
    const all=allRows(dayId);
    const sections={daily:[],weekly:[],version:[],challenge:[],optional:[]};
    all.daily.forEach(r=>sections.daily.push(r));
    all.weekly.forEach(r=>sections[classify(r)].push(r));
    Object.values(sections).forEach(arr=>arr.sort((a,b)=>{
      const pr=rank(a.task)-rank(b.task);
      if(pr) return pr;
      const da=a.due?.sort??9, db=b.due?.sort??9;
      if(da!==db) return da-db;
      return String(a.game?.short||a.game?.name||"").localeCompare(String(b.game?.short||b.game?.name||""),"zh");
    }));
    return sections;
  }
  function filtered(rows){
    return rows.filter(r=>commandFilter==="all" ? true : visible(r.task));
  }
  function rowHtml(row){
    const {task,game,gameId,done}=row, url=safeUrl(task.url),due=row.due;
    const gameName=String(game?.short||game?.name||gameId), server=serverLabel(game);
    const title=escapeHtml(String(task.title||"").replace(/^(?:每日固定|每日保底|每日资源|每日黑蛋|周固定|周黑蛋|周勾玉|版本必领|版本签到|版本商店|版本活动|版本末检查|临期签到|高难|挑战资源|首通资源|活动资源|高难活动|月度|周养成|周经营|限时养成|高难附加|常驻推进)｜/,""));
    const buttonAttrs=row.type==="daily"
      ? `data-gq-item-btn="1" data-gamequest-item-game="${escapeHtml(gameId)}" data-gamequest-item-day="${gameQuestSelectedDay}" data-gamequest-item="${escapeHtml(task.id)}" data-cycle="${escapeHtml(cycleYmd)}"`
      : `data-gq-weekly-item-btn="1" data-gamequest-weekly-game="${escapeHtml(gameId)}" data-gamequest-weekly-item="${escapeHtml(task.id)}" data-cycle="${escapeHtml(effectiveCycle(task))}"`;
    return `<li class="gqCmdRow ${done?"done":""} p-${cleanPriority(task.priority)} ${due?.tone||""}">
      <div class="gqCmdGame"><span class="gqCmdGameIcon">${escapeHtml(game?.icon||"🎮")}</span><span><b>${escapeHtml(gameName)}</b>${server?`<em>${escapeHtml(server)}</em>`:""}</span></div>
      <button type="button" class="gqCmdCheck" ${buttonAttrs} aria-pressed="${done?"true":"false"}">
        <span class="gqCmdBox" aria-hidden="true"></span>
        <span class="gqCmdMain">
          <span class="gqCmdTitle">${title}</span>
          <span class="gqCmdBadges">${priorityBadge(task)}${resourceBadge(task)}${row.type==="weekly"?cadenceBadge(task):""}${effortBadge(task)}${due?`<span class="gqCmdBadge due ${due.tone}">${escapeHtml(due.label)}</span>`:""}</span>
          ${task.note?`<small class="gqCmdNote">${noteMarkup(task.note)}</small>`:""}
        </span>
      </button>
      ${url?`<a class="gqCmdOpen" href="${url}" target="_blank" rel="noopener noreferrer">打开 ↗</a>`:""}
    </li>`;
  }
  function sectionHtml(key,title,subtitle,rows,always=false){
    const list=filtered(rows);
    if(!always && !list.length) return "";
    const done=list.filter(r=>r.done).length;
    return `<section class="gqCmdSection ${key}">
      <header class="gqCmdSectionHead">
        <div><span>${escapeHtml(subtitle)}</span><strong>${escapeHtml(title)}</strong></div>
        <b>${done}/${list.length}</b>
      </header>
      ${list.length?`<ul class="gqCmdList">${list.map(rowHtml).join("")}</ul>`:`<div class="gqCmdEmpty">当前没有需要处理的任务。</div>`}
    </section>`;
  }
  function dayTabs(){
    const labels=["日","一","二","三","四","五","六"];
    const now=new Date(), today=now.getDay();
    return `<div class="gqCmdDays">${[0,1,2,3,4,5,6].map(d=>`<button type="button" class="${Number(gameQuestSelectedDay)===d?"active":""} ${today===d?"today":""}" data-gq-command-day="${d}"><span>周${labels[d]}</span>${today===d?"<b>今天</b>":""}</button>`).join("")}</div>`;
  }
  function summary(sections){
    const base=[...sections.daily,...sections.weekly,...sections.version,...sections.challenge].filter(r=>visible(r.task));
    const must=base.filter(r=>rank(r.task)===0);
    const resource=base.filter(r=>rank(r.task)<=1);
    const mustDone=must.filter(r=>r.done).length, resourceDone=resource.filter(r=>r.done).length;
    const urgent=base.filter(r=>!r.done&&r.due&&r.due.tone==="urgent").length;
    return {must,mustDone,resource,resourceDone,urgent};
  }
  function optionalFocusHtml(){
    if(commandFilter!=="all") return "";
    const f=gameQuestConfig?.focus;
    if(!f||f.enabled===false) return "";
    const key=`${GH_PREFIX}${cycleYmd}_gqfocus_${f.id||"weekly-focus"}`;
    const done=localStorage.getItem(key)==="1";
    return `<div class="gqCmdFocus ${done?"done":""}">
      <button type="button" data-gq-focus-btn aria-pressed="${done?"true":"false"}"><span class="gqCmdBox"></span><span><b>${escapeHtml(f.title||"自由推进")}</b><small>${noteMarkup(f.note||"")}</small></span></button>
    </div>`;
  }
  function renderCommandBoard(){
    const panel=document.getElementById("gameQuestPanel");
    if(!panel || !gameQuestConfig) return;
    const sections=sectionRows(Number(gameQuestSelectedDay));
    const s=summary(sections);
    const finish=s.must.length>0 && s.mustDone===s.must.length;
    const status=finish ? "保底线已完成，可以收工 😌" : `保底 ${s.mustDone}/${s.must.length}`;
    const resourceText=`资源线 ${s.resourceDone}/${s.resource.length}`;
    panel.innerHTML=`<div class="gqCommandBoard">
      <header class="gqCmdHero">
        <div class="gqCmdHeroCopy"><span>GAME RESOURCE COMMAND</span><strong>游戏资源作战区</strong><p>一页看完：今天固定资源 → 本周资源 → 版本必领 → 周期高难。优先拿抽卡资源，低收益内容允许摆烂。</p></div>
        <div class="gqCmdHeroStats">
          <div class="${finish?"done":""}"><small>STOP LINE</small><b>${escapeHtml(status)}</b></div>
          <div><small>RESOURCE</small><b>${escapeHtml(resourceText)}</b></div>
          ${s.urgent?`<div class="urgent"><small>DEADLINE</small><b>${s.urgent} 项临期</b></div>`:""}
        </div>
      </header>
      <div class="gqCmdToolbar">
        <div class="gqCmdFilters">${Object.entries(VIEW_DEFS).map(([key,def])=>`<button type="button" class="${commandFilter===key?"active":""}" data-gq-command-filter="${key}">${escapeHtml(def.label)}</button>`).join("")}</div>
        <div class="gqCmdLegend"><span><i class="must"></i>保底</span><span><i class="good"></i>固定/周期资源</span><span><i class="skip"></i>可摆烂</span></div>
      </div>
      ${dayTabs()}
      <div class="gqCmdSections">
        ${sectionHtml("daily","今日固定","DAILY / ALL GAMES",sections.daily,true)}
        ${sectionHtml("weekly","本周固定收益","WEEKLY RESOURCE",sections.weekly,true)}
        ${sectionHtml("version","月度 / 版本必领","MONTH / VERSION",sections.version,true)}
        ${sectionHtml("challenge","周期高难 / 临期挑战","ENDGAME / DEADLINE",sections.challenge,true)}
        ${commandFilter==="all"?sectionHtml("optional","可摆烂 / 长期推进","OPTIONAL",sections.optional,false):""}
        ${optionalFocusHtml()}
      </div>
    </div>`;
  }

  renderGameQuestPanel=renderCommandBoard;
  setGameQuestBoardMode=function(){ renderCommandBoard(); };

  document.addEventListener("click",event=>{
    const filter=event.target.closest?.("[data-gq-command-filter]");
    if(filter){
      event.preventDefault();event.stopPropagation();
      commandFilter=VIEW_DEFS[filter.dataset.gqCommandFilter]?filter.dataset.gqCommandFilter:"resource";
      localStorage.setItem(FILTER_KEY,commandFilter);
      renderCommandBoard();
      return;
    }
    const day=event.target.closest?.("[data-gq-command-day]");
    if(day){
      event.preventDefault();event.stopPropagation();
      gameQuestSelectedDay=Number(day.dataset.gqCommandDay);
      renderCommandBoard();
    }
  },true);

  const style=document.createElement("style");
  style.textContent=`
    .gqCommandBoard{display:flex;flex-direction:column;gap:14px}.gqCmdHero{display:flex;justify-content:space-between;gap:18px;padding:20px;border:1px solid var(--line,#d9d4c8);border-radius:20px;background:linear-gradient(135deg,#fffdf7,#f4f7ff)}.gqCmdHeroCopy>span{font-size:11px;font-weight:900;letter-spacing:.14em;color:#8c641a}.gqCmdHeroCopy>strong{display:block;font-size:26px;margin:3px 0 6px}.gqCmdHeroCopy p{margin:0;max-width:720px;color:var(--muted,#746f66);line-height:1.55}.gqCmdHeroStats{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:8px;min-width:min(380px,42vw)}.gqCmdHeroStats>div{padding:11px 13px;border:1px solid var(--line,#d9d4c8);border-radius:13px;background:#fff}.gqCmdHeroStats small{display:block;font-size:10px;letter-spacing:.12em;color:#817b70}.gqCmdHeroStats b{display:block;margin-top:3px;font-size:13px}.gqCmdHeroStats .done{background:#edf8ee}.gqCmdHeroStats .urgent{background:#fff0ed;border-color:#efb2aa}.gqCmdHeroStats .urgent b{color:#b62922}.gqCmdToolbar{display:flex;justify-content:space-between;align-items:center;gap:10px}.gqCmdFilters{display:flex;gap:7px;flex-wrap:wrap}.gqCmdFilters button{border:1px solid var(--line,#d9d4c8);background:#fff;border-radius:999px;padding:9px 13px;font-weight:850;cursor:pointer}.gqCmdFilters button.active{background:#171714;color:#fff;border-color:#171714}.gqCmdLegend{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#756f66}.gqCmdLegend span{display:flex;align-items:center;gap:4px}.gqCmdLegend i{width:8px;height:8px;border-radius:99px}.gqCmdLegend i.must{background:#d8a600}.gqCmdLegend i.good{background:#3f88c5}.gqCmdLegend i.skip{background:#aaa59c}.gqCmdDays{display:flex;gap:6px;overflow-x:auto;padding:1px 0 3px}.gqCmdDays button{min-width:58px;border:1px solid var(--line,#d9d4c8);background:#fff;border-radius:11px;padding:7px 9px;display:flex;flex-direction:column;gap:1px;align-items:center}.gqCmdDays button.active{background:#171714;color:#fff}.gqCmdDays b{font-size:9px;color:#d2a900}.gqCmdSections{display:flex;flex-direction:column;gap:14px}.gqCmdSection{border:1px solid var(--line,#d9d4c8);border-radius:18px;background:var(--paper,#fff);overflow:hidden}.gqCmdSection.challenge{border-color:#dcb99f;box-shadow:0 0 0 1px rgba(199,117,49,.05)}.gqCmdSectionHead{display:flex;justify-content:space-between;align-items:end;padding:14px 16px;border-bottom:1px solid var(--line,#e4dfd4);background:#faf8f3}.gqCmdSection.challenge .gqCmdSectionHead{background:#fff6ed}.gqCmdSectionHead span{display:block;font-size:10px;letter-spacing:.12em;color:#817b70}.gqCmdSectionHead strong{font-size:18px}.gqCmdSectionHead>b{font-size:14px;color:#746f66}.gqCmdList{list-style:none;margin:0;padding:0}.gqCmdRow{display:grid;grid-template-columns:minmax(120px,170px) minmax(0,1fr) auto;align-items:stretch;border-bottom:1px solid #ece8df}.gqCmdRow:last-child{border-bottom:0}.gqCmdRow.done{opacity:.58}.gqCmdRow.urgent{background:#fff9f7}.gqCmdGame{display:flex;align-items:center;gap:8px;padding:12px 10px 12px 14px;border-right:1px solid #eee9de}.gqCmdGameIcon{font-size:20px}.gqCmdGame span:last-child{min-width:0}.gqCmdGame b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gqCmdGame em{display:block;font-style:normal;font-size:10px;color:#8b857a;margin-top:2px}.gqCmdCheck{border:0;background:transparent;padding:10px 12px;display:flex;align-items:flex-start;gap:10px;text-align:left;cursor:pointer;min-width:0}.gqCmdBox{width:18px;height:18px;border:2px solid #aba69d;border-radius:5px;flex:none;margin-top:2px;position:relative}.gqCmdCheck[aria-pressed="true"] .gqCmdBox,.gqCmdFocus button[aria-pressed="true"] .gqCmdBox{background:#171714;border-color:#171714}.gqCmdCheck[aria-pressed="true"] .gqCmdBox:after,.gqCmdFocus button[aria-pressed="true"] .gqCmdBox:after{content:"✓";position:absolute;color:#fff;font-size:12px;left:2px;top:-1px;font-weight:900}.gqCmdMain{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.gqCmdTitle{font-size:14px;font-weight:850;line-height:1.35}.gqCmdBadges{display:flex;flex-wrap:wrap;gap:5px}.gqCmdBadge{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:800;border:1px solid #ddd8ce;background:#f6f4ef;color:#625e56}.gqCmdBadge.priority.must{background:#fff2bf;border-color:#e4c152;color:#695000}.gqCmdBadge.priority.good,.gqCmdBadge.resource{background:#eaf4ff;border-color:#abd0ee;color:#205374}.gqCmdBadge.priority.skip{background:#f1f0ed;color:#777168}.gqCmdBadge.cadence.limited,.gqCmdBadge.due.soon{background:#fff2df;border-color:#eac28a;color:#7c4c0b}.gqCmdBadge.due.urgent{background:#ffe7e2;border-color:#eaa095;color:#a4251e}.gqCmdBadge.cadence.once{background:#f0ebff;color:#5e4888}.gqCmdBadge.cadence.cycle{background:#eef5ff;color:#365e8d}.gqCmdNote{font-size:12px;line-height:1.55;color:#6f6a61}.gqNoteCritical{font-weight:950;color:#b62922;background:#fff0ed;padding:0 3px;border-radius:4px}.gqNoteStrong{font-weight:900;color:#292722}.gqCmdOpen{align-self:center;margin-right:10px;border:1px solid #dcd6ca;border-radius:9px;padding:7px 8px;text-decoration:none;color:inherit;font-size:11px;font-weight:800}.gqCmdEmpty{padding:16px;color:#8b857a;font-size:12px}.gqCmdFocus{border:1px dashed #d7c36e;border-radius:16px;background:#fffdf1}.gqCmdFocus button{width:100%;border:0;background:transparent;padding:12px 14px;display:flex;gap:10px;text-align:left}.gqCmdFocus b{display:block}.gqCmdFocus small{display:block;margin-top:4px;color:#736e62;line-height:1.5}
    @media(max-width:760px){.gqCmdHero{flex-direction:column;padding:15px}.gqCmdHeroCopy>strong{font-size:22px}.gqCmdHeroStats{min-width:0;width:100%;grid-template-columns:1fr 1fr}.gqCmdToolbar{align-items:stretch;flex-direction:column}.gqCmdFilters{display:grid;grid-template-columns:repeat(3,1fr)}.gqCmdFilters button{padding:9px 6px;font-size:11px}.gqCmdLegend{padding:0 3px}.gqCmdRow{grid-template-columns:1fr auto}.gqCmdGame{grid-column:1/-1;border-right:0;border-bottom:1px solid #f0ece4;padding:8px 12px}.gqCmdGameIcon{font-size:16px}.gqCmdGame b,.gqCmdGame em{display:inline}.gqCmdGame em{margin-left:6px}.gqCmdCheck{padding:10px 12px}.gqCmdOpen{grid-column:2;grid-row:2;margin:8px 8px 8px 0}.gqCmdNote{font-size:11px}.gqCmdTitle{font-size:13px}.gqCmdSectionHead{padding:12px 13px}.gqCmdSectionHead strong{font-size:16px}}
  `;
  document.head.appendChild(style);

  try{ renderCommandBoard(); }catch(error){ console.warn("GameQuest command board skipped",error); }
})();