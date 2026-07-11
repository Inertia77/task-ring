// Completion feedback for TaskRing. Pure DOM/CSS, with bounded queues and cleanup.
(function(){
  "use strict";

  const MAX_QUEUE=3;
  const seenEvents=new Map();
  const queue=[];
  const timers=new Set();
  let activeCutin=false;
  let lastCharacter="";

  const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches===true;
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn()},ms);timers.add(id);return id};
  const escapeText=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  const rectOf=anchor=>{
    if(anchor?.getBoundingClientRect){const r=anchor.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}}
    return {left:window.innerWidth/2-22,top:window.innerHeight/2-22,width:44,height:44};
  };
  const pointOf=rect=>({x:Math.max(24,Math.min(window.innerWidth-24,rect.left+rect.width/2)),y:Math.max(24,Math.min(window.innerHeight-24,rect.top+rect.height/2))});
  const prune=(selector,max)=>{const nodes=[...document.querySelectorAll(selector)];nodes.slice(0,Math.max(0,nodes.length-max+1)).forEach(node=>node.remove())};
  const categoryLabel=cat=>({life:"LIFE",gamecreate:"GAME / CREATE",language:"LEARNING",game:"GAME"}[cat]||"TASK");
  const categoryAccent=cat=>({life:"#b69f25",gamecreate:"#5573c7",language:"#7655a5",game:"#5573c7"}[cat]||"#f2d21a");
  const characters=()=>typeof RANDOM_CUTIN_CHARACTERS!=="undefined"&&Array.isArray(RANDOM_CUTIN_CHARACTERS)?RANDOM_CUTIN_CHARACTERS:[];
  const pickCharacter=()=>{
    const pool=characters();
    if(!pool.length)return null;
    const candidates=pool.length>1?pool.filter(item=>item.key!==lastCharacter):pool;
    const picked=candidates[Math.floor(Math.random()*candidates.length)]||pool[0];
    lastCharacter=picked.key;
    return picked;
  };
  function markSeen(eventId){
    if(!eventId)return false;
    const now=Date.now();
    for(const [key,time] of seenEvents)if(now-time>12000)seenEvents.delete(key);
    if(seenEvents.has(eventId))return true;
    seenEvents.set(eventId,now);
    return false;
  }
  function addCheckPulse(rect){
    prune(".trCheckPulse",4);
    const point=pointOf(rect);
    const pulse=document.createElement("span");
    pulse.className="trCheckPulse";
    pulse.style.left=`${point.x}px`;pulse.style.top=`${point.y}px`;
    pulse.innerHTML="<i></i>";
    document.body.appendChild(pulse);
    later(()=>pulse.remove(),620);
  }
  function addCardSweep(rect,accent){
    if(!rect.width||!rect.height)return;
    prune(".trCardSweep",3);
    const sweep=document.createElement("span");
    sweep.className="trCardSweep";
    sweep.style.cssText=`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;--tr-accent:${accent}`;
    document.body.appendChild(sweep);
    later(()=>sweep.remove(),760);
  }
  function addParticles(point,accent,count,duration=760,ambient=false){
    prune(ambient?".trFxAmbient":".trFxParticles",ambient?3:4);
    const field=document.createElement("div");
    field.className=ambient?"trFxAmbient":"trFxParticles";
    field.style.setProperty("--tr-accent",accent);
    for(let i=0;i<count;i++){
      const particle=document.createElement("i");
      const angle=(Math.PI*2*i/count)+(Math.random()-.5)*.4;
      const distance=(ambient?70:28)+Math.random()*(ambient?150:48);
      particle.style.cssText=`left:${point.x}px;top:${point.y}px;--dx:${Math.cos(angle)*distance}px;--dy:${Math.sin(angle)*distance}px;--delay:${Math.random()*160}ms;--rot:${Math.round(Math.random()*180)}deg`;
      field.appendChild(particle);
    }
    document.body.appendChild(field);
    later(()=>field.remove(),duration);
  }
  function addReducedCue(title){
    document.querySelector(".trReducedCue")?.remove();
    const cue=document.createElement("div");
    cue.className="trReducedCue";
    cue.setAttribute("role","status");
    cue.innerHTML=`<b>✓ 已完成</b><span>${escapeText(title||"任务状态已更新")}</span>`;
    document.body.appendChild(cue);
    later(()=>cue.remove(),1100);
  }
  function addCutin(options,rect){
    prune(".trCutin",1);
    const char=pickCharacter();
    const accent=char?.accent||categoryAccent(options.category);
    const cutin=document.createElement("section");
    cutin.className=`trCutin trCutin--${options.level}`;
    cutin.style.setProperty("--tr-accent",accent);
    cutin.setAttribute("aria-hidden","true");
    const image=char?.img?`<img src="${escapeText(char.img)}" alt="" decoding="async">`:`<div class="trCutinFallback">TR</div>`;
    const label=options.level==="daily"?"DAILY RING CLEAR":options.level==="parent"?"MISSION COMPLETE":"TASK COMPLETE";
    cutin.innerHTML=`<div class="trCutinRail"><span>TR / ${categoryLabel(options.category)}</span><b>CLEAR +01</b></div><div class="trCutinPortrait">${image}</div><div class="trCutinCopy"><span>${label}</span><strong>${escapeText(options.title||char?.title||"任务完成")}</strong><em>${escapeText(char?.name||"TASKRING OPERATOR")} · ${escapeText(char?.sub||"完成状态已确认")}</em></div>`;
    const imageEl=cutin.querySelector("img");
    imageEl?.addEventListener("error",()=>{imageEl.replaceWith(Object.assign(document.createElement("div"),{className:"trCutinFallback",textContent:"TR"}))},{once:true});
    document.body.appendChild(cutin);
    const duration=options.level==="daily"?1900:options.level==="parent"?1600:1250;
    later(()=>cutin.remove(),duration+120);
    const point=pointOf(rect);
    addParticles(point,accent,window.innerWidth<=700?8:14,options.level==="daily"?5000:3800,true);
    later(()=>{activeCutin=false;drain()},duration);
  }
  function run(options){
    const rect=options.rect||rectOf(options.anchor);
    const point=pointOf(rect);
    const accent=categoryAccent(options.category);
    if(reduced()){addReducedCue(options.title);activeCutin=false;drain();return}
    addCheckPulse(rect);
    addParticles(point,accent,options.level==="micro"?(window.innerWidth<=700?4:6):(window.innerWidth<=700?6:9),620);
    if(options.level==="micro"){later(()=>drain(),420);return}
    addCardSweep(options.cardRect||rect,accent);
    activeCutin=true;
    addCutin(options,rect);
  }
  function drain(){
    if(activeCutin||!queue.length)return;
    run(queue.shift());
  }
  function play(input={}){
    const level=["micro","task","parent","daily","summary"].includes(input.level)?input.level:"task";
    const options={...input,level:level==="summary"?"parent":level,rect:rectOf(input.anchor),cardRect:rectOf(input.anchor?.closest?.(".dailyCard,.weeklyMissionCard,.gameQuestCard,.stepRow,.weeklyStepItem")||input.anchor)};
    if(markSeen(options.eventId))return false;
    if(level==="daily"){
      const date=input.date||new Date().toISOString().slice(0,10);
      const key=`taskring_daily_clear_fx_v1_${date}`;
      if(localStorage.getItem(key)==="1")return false;
      localStorage.setItem(key,"1");
    }
    if(options.level==="micro"&&!activeCutin){run(options);return true}
    if(queue.length>=MAX_QUEUE)queue.splice(0,queue.length-MAX_QUEUE+1);
    queue.push(options);drain();return true;
  }
  function preload(){
    characters().forEach(item=>{if(!item.img)return;const img=new Image();img.decoding="async";img.src=item.img});
  }
  function clear(){
    queue.length=0;activeCutin=false;
    timers.forEach(clearTimeout);timers.clear();
    document.querySelectorAll(".trCheckPulse,.trCardSweep,.trFxParticles,.trFxAmbient,.trCutin,.trReducedCue").forEach(el=>el.remove());
  }
  window.TaskRingEffects={play,preload,clear,version:"1.0.0"};
  if("requestIdleCallback" in window)requestIdleCallback(preload,{timeout:2200});else later(preload,700);
})();
