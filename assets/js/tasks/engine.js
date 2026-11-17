(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.TaskRingTasks=api;
})(globalThis,function(){
  "use strict";

  const DAY=86400000;
  const TYPES=["DAILY","WEEKDAY","WEEKLY","ONE_TIME","SCHEDULED","DEADLINE","SEQUENCE","RECURRING","OPTIONAL"];
  const TRACKS=["LANGUAGE","KNOWLEDGE"];
  const MODULES=["tasks","weekly","game","learning","fitness"];
  const POLICIES=["RESET","KEEP","EXPIRE"];
  const TIME_ZONE="Asia/Tokyo";
  const dateFormat=new Intl.DateTimeFormat("en-CA",{timeZone:TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"});
  const emptyTrack=()=>({items:[],paused:false,end:"stop"});

  function dayNumber(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return NaN;
    const ms=Date.parse(value+"T00:00:00Z");
    return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value?ms/DAY:NaN;
  }
  const validDate=value=>Number.isFinite(dayNumber(value));
  const offset=(date,days)=>new Date((dayNumber(date)+days)*DAY).toISOString().slice(0,10);
  const weekday=date=>new Date(dayNumber(date)*DAY).getUTCDay();
  const week=date=>offset(date,-(weekday(date)+6)%7);
  const instance=(id,period)=>JSON.stringify([id,period]);
  const id=(...parts)=>parts.map(value=>encodeURIComponent(String(value))).join("/");
  function businessDate(now=Date.now(),rollover=4){
    const parts=Object.fromEntries(dateFormat.formatToParts(now).map(({type,value})=>[type,value]));
    const date=parts.year+"-"+parts.month+"-"+parts.day;
    return Number(parts.hour)<rollover?offset(date,-1):date;
  }
  function boundary(value,date,now,isEnd){
    if(!value||!validDate(value.date))return false;
    if(value.precision==="time"&&Number.isFinite(Date.parse(value.at)))return isEnd?now>=Date.parse(value.at):now<Date.parse(value.at);
    return isEnd?date>value.date:date<value.date;
  }
  function occurrence(def,date,now=Date.now()){
    if(def.enabled===false)return null;
    const s=def.schedule;
    const calendarDate=businessDate(now,0);
    const windowDate=def.calendarWindow?calendarDate:date;
    const ahead=boundary(s.start,windowDate,now,false),overdue=s.due?.precision!=="unverified"&&boundary(s.due,windowDate,now,true);
    const dueDate=validDate(s.due?.date)?s.due.date:null;
    const dueToday=dueDate===windowDate;
    const planned=def.plannedDates?.includes(date)===true||s.date===date;
    const optional=def.optional===true||s.type==="OPTIONAL";
    const weeklyEnd=offset(week(date),6)===date;
    const sinceAnchor=dayNumber(date)-dayNumber(s.anchor);
    let period="once",today=false,available=!ahead;
    switch(s.type){
      case "DAILY": today=true; period=date; break;
      case "WEEKDAY": today=s.days.includes(weekday(date)); period=date; available&&=today; break;
      case "WEEKLY": today=planned||(s.autoEnd===true&&weeklyEnd); period=week(date); break;
      case "SCHEDULED":
        today=planned;
        available&&=validDate(s.date)&&date>=s.date&&(today||s.missed==="KEEP");
        break;
      case "ONE_TIME": today=planned||s.showToday===true; break;
      case "DEADLINE": today=planned||dueToday; break;
      case "RECURRING":
        available&&=Number.isFinite(sinceAnchor)&&sinceAnchor>=0;
        if(!available)return null;
        period=offset(s.anchor,Math.floor(sinceAnchor/s.intervalDays)*s.intervalDays);
        today=period===date||planned;
        break;
      case "OPTIONAL": today=available; break;
      case "SEQUENCE": today=true; period=s.period; break;
      default: return null;
    }
    if(def.completedToday){today=true;available=true;}
    if(s.missed==="EXPIRE"&&overdue)available=false;
    const carry=s.missed==="KEEP"&&((s.type==="SCHEDULED"&&validDate(s.date)&&date>s.date)||(s.type==="RECURRING"&&date>period));
    const daysUntil=dayNumber(dueDate)-dayNumber(windowDate);
    const near=daysUntil>=0&&daysUntil<=3&&!overdue;
    const bucket=optional
      ?(available?"optional":null)
      :available&&((overdue||carry)&&s.missed!=="EXPIRE"||near)?"deadline"
      :available&&today?(def.required&&!planned||def.required&&s.mustOnPlan?"required":"planned"):null;
    const section=def.completedToday?(optional?"optional":"planned"):bucket==="deadline"&&dueToday&&def.required?"required":bucket;
    return {id:def.id,instanceId:instance(def.id,period),definition:def,period,available,today:available&&today,planned:available&&planned,
      required:available&&def.required===true&&(today&&(!planned||s.mustOnPlan)||dueToday),overdue:available&&(overdue||carry),dueToday,deadline:s.due,
      bucket:section,optional};
  }

  function query(definitions,date,read,now=Date.now()){
    const unique=new Map();
    definitions.forEach(def=>{
      const entry=occurrence(def,date,now);
      if(!entry?.bucket||unique.has(entry.instanceId))return;
      const state=read(entry)||{};
      unique.set(entry.instanceId,{...entry,...state});
    });
    const rank=task=>task.done?5:task.overdue&&!task.optional?0:task.dueToday&&task.required?1:task.required?2:task.optional?4:3;
    return [...unique.values()].sort((a,b)=>rank(a)-rank(b)||
      Number(b.definition.priority||0)-Number(a.definition.priority||0)||
      String(a.deadline?.date||"9999").localeCompare(b.deadline?.date||"9999")||
      a.definition.title.localeCompare(b.definition.title,"zh-CN")||a.instanceId.localeCompare(b.instanceId));
  }
  function counts(rows){
    const today=rows.filter(x=>x.today||x.dueToday||x.optional);
    const required=today.filter(x=>x.required);
    const progress=items=>({done:items.filter(x=>x.done).length,total:items.length});
    return {required:progress(required),all:progress(today),remaining:today.filter(x=>!x.done).length,
      deadlines:rows.filter(x=>!x.done&&(x.dueToday||x.bucket==="deadline")).length};
  }

  // An ordinal identifies the occurrence even after the queue is edited or cycled.
  // Duplicate completions converge on the first day, then the stable item ID.
  function sequence(track=emptyTrack(),events=[],date){
    const items=track.items.filter(item=>item.enabled!==false);
    const accepted=[];
    const ordered=events.filter(e=>validDate(e.date)&&e.date<=date)
      .sort((a,b)=>a.ordinal-b.ordinal||a.date.localeCompare(b.date)||a.itemId.localeCompare(b.itemId));
    for(const e of ordered){
      if(e.ordinal===accepted.length&&(!accepted.length||e.date>accepted.at(-1).date))accepted.push(e);
    }
    const last=accepted.at(-1);
    if(last?.date===date)return {current:track.items.find(item=>item.id===last.itemId)||{id:last.itemId,title:"已移除的学习项"},ordinal:last.ordinal,done:true,accepted};
    if(track.paused||!items.length)return {current:null,ordinal:accepted.length,done:false,accepted};
    const index=last?track.items.findIndex(item=>item.id===last.itemId):-1;
    const completed=new Set(accepted.map(event=>event.itemId));
    const next=track.items.slice(index+1).find(item=>item.enabled!==false&&(track.end==="loop"||!completed.has(item.id)));
    const current=next||(track.end==="loop"?items[0]:items.find(item=>!completed.has(item.id)))||null;
    return {current,ordinal:accepted.length,done:false,accepted};
  }

  function validBoundary(l){
    if(l==null)return true;
    if(!["date","time","unknown","unverified"].includes(l.precision))return false;
    if(l.precision==="unknown")return !l.date&&!l.at;
    if(!validDate(l.date))return false;
    return l.precision==="time"?/(?:Z|[+-]\d{2}:\d{2})$/.test(l.at||"")&&Number.isFinite(Date.parse(l.at))&&businessDate(Date.parse(l.at),0)===l.date:!l.at;
  }
  function validSchedule(s){
    return !!s&&TYPES.includes(s.type)&&POLICIES.includes(s.missed||"RESET")&&validBoundary(s.start)&&validBoundary(s.due)&&
      (!s.start?.date||!s.due?.date||s.start.date<=s.due.date)&&
      (!s.date||validDate(s.date))&&
      (s.type!=="SCHEDULED"||validDate(s.date))&&
      (s.type!=="DEADLINE"||validDate(s.due?.date))&&
      (s.type!=="WEEKDAY"||Array.isArray(s.days)&&s.days.length>0&&s.days.every(v=>Number.isInteger(v)&&v>=0&&v<7))&&
      (s.type!=="RECURRING"||validDate(s.anchor)&&Number.isSafeInteger(s.intervalDays)&&s.intervalDays>0&&s.intervalDays<=3650);
  }

  return {TYPES,TRACKS,MODULES,POLICIES,TIME_ZONE,businessDate,dayNumber,validDate,offset,weekday,week,id,instance,occurrence,query,counts,emptyTrack,sequence,validSchedule};
});
