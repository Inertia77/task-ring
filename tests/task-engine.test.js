const {test}=require("node:test");
const A=require("node:assert/strict");
const E=require("../assets/js/tasks/engine.js");
const C=require("../assets/js/tasks/config.js");
const I=require("../assets/js/data/integrity-core.js");
const at=(day,time="12:00")=>Date.parse(day+"T"+time+":00+09:00");
const def=(type,properties={},overrides={})=>({id:type,title:type,required:true,schedule:{type,...properties},...overrides});
const date="2026-11-17";
const query=(definitions,day=date,now=at(day))=>E.query(definitions,day,row=>({done:row.definition.done||false}),now);

test("Tokyo business date rolls over at 04:00 independent of host/DST",()=>{
  A.equal(E.businessDate(at("2026-11-16","03:59")),"2026-11-15");
  A.equal(E.businessDate(at("2026-11-16","04:00")),"2026-11-16");
  A.equal(E.week("2026-11-15"),"2026-11-09");
  A.equal(E.week("2026-11-16"),"2026-11-16");
  A.equal(E.validDate("2026-02-30"),false);
  A.equal(E.offset("2026-03-08",1),"2026-03-09");
});
test("daily, weekday and weekly carry their appropriate unique period",()=>{
  const daily=def("DAILY"),weds=def("WEEKDAY",{days:[3]}),weekly=def("WEEKLY",{autoEnd:true});
  A.deepEqual(query([daily,weds,weekly]).map(r=>r.definition.id),["DAILY"]);
  A.equal(query([daily],"2026-11-18")[0].period,"2026-11-18");
  A.equal(query([weds],"2026-11-18")[0].period,"2026-11-18");
  A.equal(query([weekly],"2026-11-22")[0].period,"2026-11-16");
  A.equal(query([weekly],"2026-11-29")[0].period,"2026-11-23");
});
test("weekly plans appear on selected days and share their cycle identity",()=>{
  const weekly=def("WEEKLY",{}, {plannedDates:[date,"2026-11-19"],required:false});
  const first=query([weekly])[0],second=query([weekly],"2026-11-19")[0];
  A.equal(first.bucket,"planned");
  A.equal(first.instanceId,second.instanceId);
  A.equal(query([weekly],"2026-11-18").length,0);
});
test("scheduled and recurring policies carry only within the intended occurrence",()=>{
  const scheduled=def("SCHEDULED",{date,missed:"KEEP",mustOnPlan:true});
  const recurring=def("RECURRING",{anchor:date,intervalDays:3,missed:"KEEP"});
  A.equal(query([scheduled],"2026-11-16").length,0);
  A.equal(query([scheduled])[0].required,true);
  A.equal(query([scheduled],"2026-11-18")[0].overdue,true);
  A.equal(query([recurring],"2026-11-18")[0].period,date);
  A.equal(query([recurring],"2026-11-20")[0].period,"2026-11-20");
});
test("date-only, confirmed exact time, and unverified deadline precision differ",()=>{
  const deadline=due=>def("DEADLINE",{due,missed:"KEEP"},{calendarWindow:true});
  A.equal(query([deadline({date,precision:"date"})],date,at(date,"23:59"))[0].overdue,false);
  A.equal(query([deadline({date,precision:"time",at:date+"T10:00:00+09:00"})],date,at(date,"11:00"))[0].overdue,true);
  A.equal(query([deadline({date,precision:"unverified"})],"2026-11-18").length,0);
  const start=def("ONE_TIME",{showToday:true,start:{date,precision:"date"}});
  A.equal(query([start],date,at(date,"04:00")).length,1);
});
test("optional tasks and duplicate references never inflate required metrics",()=>{
  const day=def("DAILY",{}, {done:true}),one=def("ONE_TIME",{showToday:true});
  const reserve=def("OPTIONAL");
  const data=query([day,day,one,reserve]);
  A.deepEqual(E.counts(data),{required:{done:1,total:2},all:{done:1,total:3},remaining:2,deadlines:0});
  A.equal(data.at(-1).done,true);
});
const queue={items:[{id:"a",title:"A"},{id:"b",title:"B"}],paused:false,end:"stop"};
const first={ordinal:0,itemId:"a",date},second={ordinal:1,itemId:"b",date:"2026-11-19"};
test("learning waits for real completion and does not switch on the same day",()=>{
  A.equal(E.sequence(queue,[],date).current.id,"a");
  A.equal(E.sequence(queue,[],"2027-03-19").current.id,"a");
  A.equal(E.sequence(queue,[first],date).current.id,"a");
  A.equal(E.sequence(queue,[first],date).done,true);
  A.equal(E.sequence(queue,[first],"2026-11-18").current.id,"b");
  A.equal(E.sequence(queue,[],"2026-11-18").current.id,"a");
});
test("learning replay is idempotent, handles disabled items, pauses, stop and loop",()=>{
  A.deepEqual(E.sequence(queue,[second,first,first,second],"2026-11-20").accepted,[first,second]);
  A.equal(E.sequence(queue,[first,second],"2026-11-20").current,null);
  A.equal(E.sequence({...queue,end:"loop"},[first,second],"2026-11-20").current.id,"a");
  A.equal(E.sequence({...queue,paused:true},[first],"2026-11-18").current,null);
  A.equal(E.sequence({...queue,items:[{...queue.items[0],enabled:false},queue.items[1]]},[],date).current.id,"b");
  A.equal(E.sequence(queue,[second],"2026-11-20").accepted.length,0);
});
test("state tombstones protect undone sequence events during stale or repeated sync",()=>{
  const key="track-0",old={value:"1",updatedAt:"2026-11-17T03:02:00Z",deviceId:"a",sequence:first};
  const newer={value:"0",updatedAt:"2026-11-17T03:03:00Z",deviceId:"b",sequence:first};
  const merge=(local,remote)=>I.mergeStateRecords({localMeta:{[key]:local},remoteMeta:{[key]:remote}}).stateMeta[key];
  A.equal(merge(newer,old).value,"0");
  A.equal(merge(old,newer).value,"0");
  A.deepEqual(merge(merge(newer,old),old).sequence,{date,itemId:"a"});
});
const legacy=()=>({version:4,tasks:[{id:"t",code:"t001",title:"Task",extension:{value:"retained"},steps:[{id:"s",code:"s01",title:"Step"}]}],
  gameQuest:{games:[{id:"g"}],boards:{daily:{g:[{id:"d",title:"Demo"}]},weekly:{g:[]}}},
  fitness:{sections:[{id:"health"}],days:{}},refs:[{id:"x",items:[{id:"ref",url:"https://example.test/resource"}]}],privateField:{known:false}});
test("configuration round trips source IDs, substeps and unknown compatible metadata",()=>{
  const config=legacy();
  A.deepEqual(C.decode(config).config,config);
  const exported=C.exportConfig(config),decoded=C.decode(exported).config;
  A.deepEqual(decoded.tasks,config.tasks);
  A.deepEqual(decoded.privateField,config.privateField);
  A.deepEqual(decoded.refs,config.refs);
  A.equal(C.difference(config,decoded).changed.length,0);
  A.deepEqual(C.exportConfig(decoded),exported);
});
test("backup validates versions, sources, duplicates and separates execution history",()=>{
  const config=legacy(),exported=C.exportConfig(config);
  const backup={kind:"taskring-backup",schemaVersion:1,configuration:exported,execution:{states:{},state_meta:{},time_logs:[],time_logs_deleted:{}}};
  A.deepEqual(C.decode(backup).execution,backup.execution);
  A.equal(C.decode(exported).execution,null);
  A.throws(()=>C.decode({...backup,schemaVersion:2}),/版本/);
  A.throws(()=>C.decode({...exported,sourceMappings:{gameOps:"other-project"}}),/数据源/);
  A.throws(()=>C.decode({...exported,tasks:[...exported.tasks,...exported.tasks]}),/重复/);
  A.throws(()=>C.decode({...exported,tasks:[{...exported.tasks[0],nextSchedule:{type:"RECURRING",intervalDays:0}}]}),/调度/);
});
