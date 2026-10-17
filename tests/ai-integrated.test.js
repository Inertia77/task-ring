const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.join(__dirname,"../assets/js/ai-tasks.js"),"utf8");

function setup(){
  const memory=new Map();
  const scheduled={id:"study",code:"t041",title:"AI Study",days:[2,4,0],plan_mode:"scheduled",ai_enabled:true,ai_period:"weekly",ai_target:3,cat:"life",time_category:"science",note:"Test"};
  const weekly={id:"calendar",code:"t044",title:"AI Calendar",days:[0],plan_mode:"weekly",ai_enabled:true,ai_period:"weekly",ai_target:1,cat:"life",time_category:"game",note:"Test"};
  const monthly={id:"policy",code:"t048",title:"AI Policy",days:[6],plan_mode:"weekly",ai_enabled:true,ai_period:"monthly",ai_target:1,cat:"life",time_category:"life",note:"Test"};
  const onDemand={id:"feedback",code:"t042",title:"AI Feedback",days:[],plan_mode:"weekly",ai_enabled:true,ai_period:"on_demand",ai_target:0,cat:"life",time_category:"science",note:"Test"};
  const checks=new Set(),listeners={};
  const ctx={
    blocks:[scheduled,weekly,monthly,onDemand],
    window:{confirm:()=>true,open:()=>{}},
    document:{addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn)},getElementById:()=>null},
    navigator:{clipboard:{writeText:async()=>{}}},
    localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},
    GH_PREFIX:"test_",cycleYmd:"2026-10-12",today:6,operationalNow:new Date("2026-10-17T12:00:00+09:00"),
    ymd:()=> "2026-10-17",
    dayName:day=>String(day),
    isDone:(id,day,cycle)=>checks.has(cycle+":"+id+":"+day),
    occurrenceState:(t,day,cycle)=>({done:checks.has(cycle+":"+t.id+":"+day),prev:false,overdue:false}),
    taskPlanningMode:t=>t.plan_mode,
    taskTimeCategory:t=>t.time_category,
    taskDayHint:t=>t.days.join("・"),
    taskCategoryGlyph:()=>"<svg></svg>",
    taskUiIcon:()=>"<svg></svg>",
    timeCategoryDefs:{game:{name:"游戏"},science:{name:"自然科学"},life:{name:"生活"}},
    escapeHtml:str=>String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;"),
    safeUrl:()=>"",
    syncSetItem:(key,value)=>value?memory.set(key,"1"):memory.delete(key),
    setDone:(id,day,checked,el,sync,cycle)=>{const key=cycle+":"+id+":"+day;if(checked)checks.add(key);else checks.delete(key)},
    renderAll:()=>{},showToast:()=>{},
    console
  };
  vm.runInNewContext(source,ctx,{filename:"ai-tasks.js"});
  return {api:ctx.window.TaskRingAI,ctx,scheduled,weekly,monthly,onDemand,memory,listeners,checks};
}

test("native task integration: weekly and scheduled cards without parallel section",()=>{
  const x=setup();
  assert.equal(typeof x.api.weeklyCard,"function");
  assert.equal(typeof x.api.dailyCard,"function");
  assert.equal(x.api.weeklyStatus(x.weekly).state,"idle");
  const card=x.api.weeklyCard(x.weekly);
  assert.match(card,/weeklyMissionCard/);
  assert.match(card,/AI 执行/);
  assert.match(card,/核验并记次/);
  assert.doesNotMatch(card,/开始计时/);
  const daily=x.api.dailyCard({t:x.scheduled,dayId:6,cycle:"2026-10-12"});
  assert.match(daily,/dailyCard/);
  assert.match(daily,/data-ai-check-task="study"/);
  assert.doesNotMatch(daily,/计时按钮|开始计时/);
  assert.doesNotMatch(source,/aiMissionSection|originalWeeklyPoolBlocks|window\.renderWeeklyPlanPanel=/);
});
test("weekly and monthly AI completion use verified run counts",()=>{
  const x=setup();
  assert.equal(x.api.weeklyStatus(x.weekly).state,"idle");
  x.memory.set("test_ai_2026-10-12_t044_d6_s1","1");
  assert.equal(x.api.weeklyStatus(x.weekly).state,"done");
  assert.equal(x.api.verifiedCount(x.weekly),1);
  assert.equal(x.api.weeklyStatus(x.monthly).state,"idle");
  x.memory.set("test_ai_2026-10_t048_d17_s1","1");
  assert.equal(x.api.weeklyStatus(x.monthly).state,"done");
  x.memory.set("test_ai_2026-10-12_t042_d6_s1","1");
  assert.equal(x.api.weeklyStatus(x.onDemand).state,"done");
});
test("scheduled AI completion reuses the native day-and-cycle key",()=>{
  const x=setup();
  x.checks.add("2026-10-12:study:2");
  x.checks.add("2026-10-12:study:4");
  assert.equal(x.api.verifiedCount(x.scheduled),2);
  assert.match(x.api.dailyCard({t:x.scheduled,dayId:4,cycle:"2026-10-12"}),/checked/);
});
